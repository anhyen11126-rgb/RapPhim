import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';
import Booking from '../models/Booking.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import Cinema from '../models/Cinema.js';
import User from '../models/User.js';
import Concession from '../models/Concession.js';
import Promotion from '../models/Promotion.js';
import OtpVerification from '../models/OtpVerification.js';
import AiConfig from '../models/AiConfig.js';
import AiChatLog from '../models/AiChatLog.js';
import TicketPricingConfig, { INITIAL_PRICING_FORMATS } from '../models/TicketPricingConfig.js';
import {
  ensurePricingConfig,
  calculatePricesFromConfig,
  syncDatabaseWithPricingConfig,
} from '../services/pricingConfigService.js';
import { ensureCleanConcessions, resolveConcessionVisuals } from './concessionController.js';
import { ensureCleanPromotions, resolvePromotionVisuals } from './promotionController.js';
import { ensure3DShowtimesSynced, resolveCinemaImage, DEFAULT_CINEMA_BANNER } from './cinemaController.js';
import { generateAndSendEmailOtp } from './authController.js';
import { ensureAiConfig } from '../services/aiService.js';

// Đăng nhập Admin
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const admin = await AdminUser.findOne({
      $or: [
        { email: cleanEmail },
        { email: cleanEmail.replace('@davenor.vn', '@movietix.vn') },
        { email: cleanEmail.replace('@movietix.vn', '@davenor.vn') }
      ]
    });

    if (!admin) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { id: admin._id.toString(), email: admin.email, role: admin.role },
      process.env.JWT_SECRET || 'movietix_jwt_secret_key_2026_cdio',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Đăng nhập thành công',
      token,
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi đăng nhập', error: error.message });
  }
};

// Thống kê Dashboard
export const getDashboardStats = async (req, res) => {
  try {
    // 1. Tổng doanh thu từ các đơn PAID
    const revenueResult = await Booking.aggregate([
      { $match: { status: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // 2. Tổng số vé đã bán
    const totalTickets = await ShowtimeSeat.countDocuments({ status: 'BOOKED' });

    // 3. Tổng số phim, suất chiếu, rạp & thành viên
    const totalMovies = await Movie.countDocuments();
    const totalShowtimes = await Showtime.countDocuments();
    const totalCinemas = await Cinema.countDocuments();
    const totalUsers = await User.countDocuments();

    // 4. Các đơn đặt vé gần nhất (5 đơn)
    const rawRecentBookings = await Booking.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: 'showtimeId',
        populate: { path: 'movieId' },
      })
      .lean();

    const recentBookings = rawRecentBookings.map((b) => {
      const showtime = b.showtimeId;
      return {
        ...b,
        id: b._id.toString(),
        showtime: showtime
          ? {
              ...showtime,
              id: showtime._id.toString(),
              movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
            }
          : null,
      };
    });

    res.json({
      stats: {
        totalRevenue,
        totalTickets,
        totalMovies,
        totalShowtimes,
        totalCinemas,
        totalUsers,
      },
      recentBookings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy thống kê', error: error.message });
  }
};

// Quản lý Phim: Tạo phim mới
export const createMovie = async (req, res) => {
  try {
    const {
      title,
      posterUrl,
      poster,
      trailerUrl,
      description,
      genre,
      duration,
      ageRating,
      techFormat,
      formats,
      rating,
      releaseDate,
      status,
      price,
    } = req.body;

    const slug =
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '') +
      '-' +
      Date.now();

    const parsedFormats = Array.isArray(formats)
      ? formats.map((f) => String(f).trim()).filter(Boolean)
      : typeof formats === 'string' && formats.trim()
      ? formats
          .split(/[,•|]+/)
          .map((f) => f.trim())
          .filter(Boolean)
      : ['2D', '3D', techFormat || 'IMAX'];

    const resolvedPoster =
      posterUrl ||
      poster ||
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop';

    const movie = await Movie.create({
      title,
      slug,
      posterUrl: resolvedPoster,
      poster: resolvedPoster,
      trailerUrl: trailerUrl || '',
      description: description || '',
      genre: genre || 'Chưa phân loại',
      duration: parseInt(duration, 10) || 120,
      ageRating: ageRating || 'T16',
      techFormat: techFormat || parsedFormats[parsedFormats.length - 1] || 'IMAX',
      formats: parsedFormats,
      rating: rating ? String(rating) : '4.8',
      releaseDate: releaseDate ? new Date(releaseDate) : new Date(),
      status: status || 'NOW_SHOWING',
      price: parseFloat(price) || 95000,
    });

    res.status(201).json({
      ...movie.toObject(),
      id: movie._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo phim mới', error: error.message });
  }
};

// Quản lý Phim: Cập nhật
export const updateMovie = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    if (data.duration) data.duration = parseInt(data.duration, 10);
    if (data.releaseDate) data.releaseDate = new Date(data.releaseDate);
    if (data.posterUrl && !data.poster) data.poster = data.posterUrl;
    if (data.poster && !data.posterUrl) data.posterUrl = data.poster;
    if (data.formats !== undefined) {
      data.formats = Array.isArray(data.formats)
        ? data.formats.map((f) => String(f).trim()).filter(Boolean)
        : typeof data.formats === 'string' && data.formats.trim()
        ? data.formats
            .split(/[,•|]+/)
            .map((f) => f.trim())
            .filter(Boolean)
        : ['2D', '3D', data.techFormat || 'IMAX'];
    }
    if (data.rating !== undefined) {
      data.rating = String(data.rating);
    }

    const updated = await Movie.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy phim để cập nhật' });
    }

    res.json({
      ...updated,
      id: updated._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật phim', error: error.message });
  }
};

// Quản lý Phim: Xóa phim
export const deleteMovie = async (req, res) => {
  try {
    const { id } = req.params;

    // Xóa phim và các suất chiếu, ghế liên quan
    const showtimes = await Showtime.find({ movieId: id });
    const showtimeIds = showtimes.map((st) => st._id);

    await ShowtimeSeat.deleteMany({ showtimeId: { $in: showtimeIds } });
    await Showtime.deleteMany({ movieId: id });
    await Movie.findByIdAndDelete(id);

    res.json({ success: true, message: 'Đã xóa phim thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa phim', error: error.message });
  }
};

// Quản lý Suất chiếu: Tạo suất chiếu mới kèm ma trận 88 ghế tự động
export const createShowtime = async (req, res) => {
  try {
    const { movieId, cinemaId, roomName, formatFeature, startTime, price } = req.body;

    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({ message: 'ID phim không hợp lệ' });
    }

    let targetCinemaId = cinemaId;
    if (!targetCinemaId || !mongoose.Types.ObjectId.isValid(targetCinemaId)) {
      const dnCinema = await Cinema.findOne({ city: 'Đà Nẵng' });
      targetCinemaId = dnCinema ? dnCinema._id : undefined;
    }

    const rName = roomName || 'Phòng IMAX 01 (Grand Hall)';
    const defaultFeature = rName.toLowerCase().includes('3d')
      ? '3D Phụ Đề • RealD 3D High Frame Rate • Kính 3D siêu nhẹ'
      : rName.toLowerCase().includes('imax')
      ? 'IMAX Laser 2D • Âm thanh 12 kênh độc quyền'
      : '2D Phụ Đề • Chuẩn Dolby 7.1 • Màn chiếu 4K';

    const pricingConfig = await ensurePricingConfig();
    const parsedExplicitPrice = Number(price);
    const resolvedShowtimePrice =
      Number.isFinite(parsedExplicitPrice) && parsedExplicitPrice > 0
        ? Math.round(parsedExplicitPrice)
        : calculatePricesFromConfig(
            { roomName: rName, formatFeature: formatFeature || defaultFeature, startTime },
            pricingConfig,
            { preferRuleMatrix: true }
          ).priceStandard;

    const showtime = await Showtime.create({
      movieId: new mongoose.Types.ObjectId(movieId),
      cinemaId: targetCinemaId ? new mongoose.Types.ObjectId(targetCinemaId) : undefined,
      roomName: rName,
      formatFeature: formatFeature || defaultFeature,
      startTime: new Date(startTime),
      price: resolvedShowtimePrice,
    });

    // Tạo tự động ma trận 88 ghế (A-D Standard, E-G VIP, H Sweetbox)
    const standardRows = ['A', 'B', 'C', 'D'];
    const vipRows = ['E', 'F', 'G'];
    const sweetboxSeats = [
      { row: 'H', col: 1, seatNumber: 'H1-2' },
      { row: 'H', col: 3, seatNumber: 'H3-4' },
      { row: 'H', col: 5, seatNumber: 'H5-6' },
      { row: 'H', col: 7, seatNumber: 'H7-8' },
    ];
    const seatsData = [];

    for (const r of standardRows) {
      for (let c = 1; c <= 12; c++) {
        seatsData.push({
          showtimeId: showtime._id,
          seatNumber: `${r}${c}`,
          row: r,
          col: c,
          type: 'STANDARD',
          status: 'AVAILABLE',
        });
      }
    }
    for (const r of vipRows) {
      for (let c = 1; c <= 12; c++) {
        seatsData.push({
          showtimeId: showtime._id,
          seatNumber: `${r}${c}`,
          row: r,
          col: c,
          type: 'VIP',
          status: 'AVAILABLE',
        });
      }
    }
    for (const sb of sweetboxSeats) {
      seatsData.push({
        showtimeId: showtime._id,
        seatNumber: sb.seatNumber,
        row: sb.row,
        col: sb.col,
        type: 'SWEETBOX',
        status: 'AVAILABLE',
      });
    }
    await ShowtimeSeat.insertMany(seatsData);

    res.status(201).json({
      message: 'Đã tạo suất chiếu và sinh sơ đồ ghế thành công',
      showtime: {
        ...showtime.toObject(),
        id: showtime._id.toString(),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo suất chiếu', error: error.message });
  }
};

// Quản lý Đặt vé: Danh sách đơn vé
export const getAdminBookings = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { bookingCode: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
      ];
    }

    const rawBookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .populate({
        path: 'showtimeId',
        populate: { path: 'movieId' },
      })
      .lean();

    const bookings = rawBookings.map((b) => {
      const showtime = b.showtimeId;
      return {
        ...b,
        id: b._id.toString(),
        showtime: showtime
          ? {
              ...showtime,
              id: showtime._id.toString(),
              movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
            }
          : null,
      };
    });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đặt vé', error: error.message });
  }
};

// Cập nhật trạng thái vé
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await Booking.findByIdAndUpdate(id, { status }, { new: true });
    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy đơn đặt vé' });
    }

    res.json({ message: 'Cập nhật trạng thái thành công', booking });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật trạng thái', error: error.message });
  }
};

// ==================== QUẢN LÝ CỤM RẠP ====================
export const getAdminCinemas = async (req, res) => {
  try {
    const cinemas = await Cinema.find().sort({ isFlagship: -1, createdAt: -1 }).lean();
    res.json(
      cinemas.map((c) => ({
        ...c,
        image: resolveCinemaImage(c.image),
        id: c._id.toString(),
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách rạp', error: error.message });
  }
};

export const createCinema = async (req, res) => {
  try {
    const { name, city, address, hotline, openingHours, parking, tags, roomCount, isFlagship, specialBadge, image } = req.body;
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-') + '-' + Date.now();

    const cinema = await Cinema.create({
      name,
      slug,
      city,
      address,
      hotline: hotline || '1900 8899',
      openingHours: openingHours || '08:30 - 24:00',
      parking: parking || 'Hầm giữ xe 24/7',
      tags: Array.isArray(tags) ? tags : ['Dolby Atmos'],
      roomCount: parseInt(roomCount, 10) || 6,
      isFlagship: !!isFlagship,
      specialBadge: specialBadge || '',
      image: image || DEFAULT_CINEMA_BANNER,
    });

    res.status(201).json({ ...cinema.toObject(), id: cinema._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thêm cụm rạp', error: error.message });
  }
};

export const updateCinema = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Cinema.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Không tìm thấy rạp' });
    res.json({ ...updated.toObject(), id: updated._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật rạp', error: error.message });
  }
};

export const deleteCinema = async (req, res) => {
  try {
    const { id } = req.params;
    const showtimes = await Showtime.find({ cinemaId: id });
    const showtimeIds = showtimes.map((s) => s._id);
    await ShowtimeSeat.deleteMany({ showtimeId: { $in: showtimeIds } });
    await Showtime.deleteMany({ cinemaId: id });
    await Cinema.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa cụm rạp thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa cụm rạp', error: error.message });
  }
};

// ==================== QUẢN LÝ SUẤT CHIẾU ====================
export const getAdminShowtimes = async (req, res) => {
  try {
    await ensure3DShowtimesSynced();
    const rawShowtimes = await Showtime.find()
      .sort({ startTime: -1 })
      .populate('movieId', 'title posterUrl duration ageRating')
      .populate('cinemaId', 'name city')
      .limit(120)
      .lean();

    const showtimes = await Promise.all(
      rawShowtimes.map(async (st) => {
        const totalSeats = await ShowtimeSeat.countDocuments({ showtimeId: st._id });
        const bookedSeats = await ShowtimeSeat.countDocuments({ showtimeId: st._id, status: 'BOOKED' });
        return {
          ...st,
          id: st._id.toString(),
          movie: st.movieId,
          cinema: st.cinemaId,
          totalSeats,
          bookedSeats,
        };
      })
    );

    res.json(showtimes);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách suất chiếu', error: error.message });
  }
};

export const deleteShowtime = async (req, res) => {
  try {
    const { id } = req.params;
    await ShowtimeSeat.deleteMany({ showtimeId: id });
    await Showtime.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa suất chiếu' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa suất chiếu', error: error.message });
  }
};

// ==================== QUẢN LÝ KHÁCH HÀNG / THÀNH VIÊN ====================
export const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const bookingCount = await Booking.countDocuments({ customerEmail: u.email });
        return {
          ...u,
          id: u._id.toString(),
          bookingCount,
        };
      })
    );
    res.json(usersWithStats);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách thành viên', error: error.message });
  }
};

// ==================== QUẢN LÝ BẮP NƯỚC ====================
export const getAdminConcessions = async (req, res) => {
  try {
    await ensureCleanConcessions();
    const concessions = await Concession.find().sort({ price: 1 }).lean();
    res.json(
      concessions.map((c) => {
        const visuals = resolveConcessionVisuals(c);
        return {
          ...c,
          ...visuals,
          id: c._id.toString(),
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy bắp nước', error: error.message });
  }
};

export const createConcession = async (req, res) => {
  try {
    const { name, price, description, image, category, badge } = req.body;
    const visuals = resolveConcessionVisuals({ name, image, category, badge });
    const c = await Concession.create({
      name,
      price: parseFloat(price) || 50000,
      description: description || '',
      category: visuals.category,
      badge: visuals.badge,
      image: visuals.image,
      imageUrl: visuals.imageUrl,
    });
    res.status(201).json({ ...c.toObject(), id: c._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo bắp nước', error: error.message });
  }
};

export const deleteConcession = async (req, res) => {
  try {
    const { id } = req.params;
    await Concession.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa bắp nước' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa bắp nước', error: error.message });
  }
};

// ==================== QUẢN LÝ KHUYẾN MÃI ====================
export const getAdminPromotions = async (req, res) => {
  try {
    await ensureCleanPromotions();
    const promotions = await Promotion.find().sort({ order: 1, createdAt: -1 }).lean();
    res.json(
      promotions.map((p) => ({
        ...p,
        ...resolvePromotionVisuals(p),
        id: p._id.toString(),
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy khuyến mãi', error: error.message });
  }
};

export const createPromotion = async (req, res) => {
  try {
    const { title, code, discountPercent, discountAmount, description, validUntil, image, type, category } = req.body;
    const visuals = resolvePromotionVisuals({ title, image, type: type || 'VOUCHER' });
    const promo = await Promotion.create({
      type: type || 'VOUCHER',
      category: category || 'TICKET',
      title,
      code: code ? code.toUpperCase() : 'PROMO' + Math.floor(Math.random() * 1000),
      discountValue: discountAmount
        ? `GIẢM ${Math.round(Number(discountAmount) / 1000)}K`
        : discountPercent
        ? `GIẢM ${discountPercent}%`
        : 'ƯU ĐÃI VIP',
      discountPercent: discountPercent ? parseInt(discountPercent, 10) : 0,
      discountAmount: discountAmount ? parseInt(discountAmount, 10) : 0,
      description: description || '',
      conditions: description || 'Áp dụng tại D\'AVENOR Thanh Khê Plaza',
      expiryDate: validUntil ? `HSD: ${new Date(validUntil).toLocaleDateString('vi-VN')}` : 'HSD: 31/12/2026',
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 86400000),
      image: visuals.image,
      isActive: true,
    });
    res.status(201).json({ ...promo.toObject(), id: promo._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo khuyến mãi', error: error.message });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    await Promotion.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa khuyến mãi' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa khuyến mãi', error: error.message });
  }
};

// ==================== QUẢN LÝ MÃ XÁC THỰC OTP (DATABASE & EMAIL) ====================
export const getAdminOtps = async (req, res) => {
  try {
    const now = new Date();
    // Tự động chuyển các mã PENDING đã quá 5 phút sang EXPIRED trong Database
    await OtpVerification.updateMany(
      { status: 'PENDING', expiresAt: { $lt: now } },
      { $set: { status: 'EXPIRED' } }
    );

    const otps = await OtpVerification.find().sort({ createdAt: -1 }).limit(100).lean();
    const senderEmail =
      process.env.EMAIL_USER?.trim() && process.env.EMAIL_USER?.trim() !== 'your_email@gmail.com'
        ? process.env.EMAIL_USER.trim()
        : 'rapphim265@gmail.com';

    res.json({
      senderEmail,
      otps: otps.map((item) => ({
        ...item,
        id: item._id.toString(),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách mã OTP', error: error.message });
  }
};

export const sendAdminTestOtp = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập địa chỉ Email nhận mã OTP' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const result = await generateAndSendEmailOtp({
      email: cleanEmail,
      type: type === 'reset_password' ? 'reset_password' : 'register',
    });

    res.status(201).json({
      success: true,
      message: result.emailSent
        ? `Đã tạo mã OTP (${result.otpCode}) và gửi thành công tới hộp thư ${cleanEmail}!`
        : `Đã lưu mã OTP (${result.otpCode}) vào Database (Lỗi SMTP: ${result.emailErrorMsg || 'Không xác định'})`,
      otp: result.otpRecord
        ? { ...result.otpRecord.toObject(), id: result.otpRecord._id.toString() }
        : null,
      emailSent: result.emailSent,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo và gửi mã OTP', error: error.message });
  }
};

export const deleteAdminOtp = async (req, res) => {
  try {
    const { id } = req.params;
    await OtpVerification.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa bản ghi OTP khỏi Database' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa mã OTP', error: error.message });
  }
};

export const clearExpiredAdminOtps = async (req, res) => {
  try {
    const result = await OtpVerification.deleteMany({
      status: { $in: ['EXPIRED', 'VERIFIED'] },
    });
    res.json({
      success: true,
      message: `Đã dọn dẹp ${result.deletedCount || 0} mã OTP đã sử dụng / hết hạn khỏi Database.`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi dọn dẹp mã OTP', error: error.message });
  }
};

// ==================== QUẢN LÝ TRỢ LÝ ẢO CHATBOT AI (DATABASE & LOGS) ====================
export const getAdminChatbotData = async (req, res) => {
  try {
    const [config, logs, movieCount, showtimeCount, concessionCount, promoCount] = await Promise.all([
      ensureAiConfig(),
      AiChatLog.find().sort({ createdAt: -1 }).limit(100).lean(),
      Movie.countDocuments(),
      Showtime.countDocuments(),
      Concession.countDocuments(),
      Promotion.countDocuments({ isActive: true }),
    ]);

    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY.trim() !== '' &&
        process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY'
    );

    res.json({
      config: {
        ...config.toObject(),
        id: config._id.toString(),
      },
      logs: logs.map((l) => ({
        ...l,
        id: l._id.toString(),
      })),
      ragStats: {
        hasGeminiKey,
        engineMode: hasGeminiKey ? 'Gemini 1.5 Flash + Database RAG' : 'Database RAG Engine (Trực tiếp MongoDB)',
        movies: movieCount,
        showtimes: showtimeCount,
        concessions: concessionCount,
        promotions: promoCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy dữ liệu quản lý Chatbot AI', error: error.message });
  }
};

export const updateAdminChatbotConfig = async (req, res) => {
  try {
    const { botName, botVersion, welcomeMessage, systemPromptNote, isEnabled, quickChips } = req.body;
    const config = await ensureAiConfig();

    if (botName !== undefined) config.botName = botName;
    if (botVersion !== undefined) config.botVersion = botVersion;
    if (welcomeMessage !== undefined) config.welcomeMessage = welcomeMessage;
    if (systemPromptNote !== undefined) config.systemPromptNote = systemPromptNote;
    if (isEnabled !== undefined) config.isEnabled = Boolean(isEnabled);
    if (Array.isArray(quickChips)) {
      config.quickChips = quickChips.filter((c) => c && c.label && c.query);
    }

    await config.save();
    res.json({
      success: true,
      message: 'Đã lưu cấu hình Trợ lý AI vào Database thành công!',
      config,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật cấu hình Chatbot AI', error: error.message });
  }
};

export const addAdminChatbotFaq = async (req, res) => {
  try {
    const { title, keywords, category, answer } = req.body;
    if (!title || !keywords || !answer) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Tiêu đề, Từ khóa và Câu trả lời mẫu' });
    }

    const config = await ensureAiConfig();
    config.faqs.unshift({
      title: title.trim(),
      keywords: keywords.trim(),
      category: category || 'POLICY',
      answer: answer.trim(),
      isActive: true,
    });
    await config.save();

    res.status(201).json({
      success: true,
      message: 'Đã thêm kịch bản câu trả lời mới vào Kho tri thức AI!',
      faqs: config.faqs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thêm kịch bản FAQ cho AI', error: error.message });
  }
};

export const updateAdminChatbotFaq = async (req, res) => {
  try {
    const { faqId } = req.params;
    const { title, keywords, category, answer, isActive } = req.body;

    const config = await ensureAiConfig();
    const faqItem = config.faqs.id(faqId);
    if (!faqItem) {
      return res.status(404).json({ message: 'Không tìm thấy kịch bản câu hỏi này' });
    }

    if (title !== undefined) faqItem.title = title;
    if (keywords !== undefined) faqItem.keywords = keywords;
    if (category !== undefined) faqItem.category = category;
    if (answer !== undefined) faqItem.answer = answer;
    if (isActive !== undefined) faqItem.isActive = Boolean(isActive);

    await config.save();
    res.json({
      success: true,
      message: 'Đã cập nhật kịch bản tri thức AI!',
      faqs: config.faqs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật kịch bản FAQ', error: error.message });
  }
};

export const deleteAdminChatbotFaq = async (req, res) => {
  try {
    const { faqId } = req.params;
    const config = await ensureAiConfig();
    config.faqs = config.faqs.filter((f) => f._id.toString() !== faqId);
    await config.save();

    res.json({
      success: true,
      message: 'Đã xóa kịch bản hỏi đáp khỏi Kho tri thức AI',
      faqs: config.faqs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa kịch bản FAQ', error: error.message });
  }
};

export const deleteAdminChatLog = async (req, res) => {
  try {
    const { id } = req.params;
    await AiChatLog.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa bản ghi hội thoại' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa lịch sử chat', error: error.message });
  }
};

export const clearAdminChatLogs = async (req, res) => {
  try {
    const result = await AiChatLog.deleteMany({});
    res.json({
      success: true,
      message: `Đã xóa toàn bộ ${result.deletedCount || 0} lịch sử hội thoại AI.`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi dọn dẹp lịch sử chat', error: error.message });
  }
};

// ==================== QUẢN LÝ BẢNG GIÁ VÉ & CẬP NHẬT GIÁ SUẤT CHIẾU ====================
export const updateShowtime = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }
    const { price, roomName, startTime, formatFeature } = req.body;
    const updatePayload = {};
    if (price !== undefined) {
      const numPrice = Number(price);
      if (!Number.isFinite(numPrice) || numPrice < 0) {
        return res.status(400).json({ message: 'Giá vé phải là số hợp lệ không âm' });
      }
      updatePayload.price = Math.round(numPrice);
    }
    if (roomName !== undefined) updatePayload.roomName = roomName;
    if (startTime !== undefined) updatePayload.startTime = new Date(startTime);
    if (formatFeature !== undefined) updatePayload.formatFeature = formatFeature;

    const updated = await Showtime.findByIdAndUpdate(id, updatePayload, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }
    res.json({ success: true, showtime: { ...updated, id: updated._id.toString() } });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật suất chiếu', error: error.message });
  }
};

export const getAdminPricingConfig = async (req, res) => {
  try {
    const config = await ensurePricingConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải cấu hình bảng giá vé', error: error.message });
  }
};

const sanitizeFormatPricingRule = (incomingRule = {}, fallbackRule = {}) => {
  const toValidInt = (val, def) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : def;
  };
  return {
    label: incomingRule.label || fallbackRule.label,
    roomTypeLabel: incomingRule.roomTypeLabel || fallbackRule.roomTypeLabel,
    vipSurcharge: toValidInt(incomingRule.vipSurcharge, fallbackRule.vipSurcharge),
    sweetboxExtra: toValidInt(incomingRule.sweetboxExtra, fallbackRule.sweetboxExtra),
    weekday: {
      before17: toValidInt(incomingRule.weekday?.before17, fallbackRule.weekday.before17),
      goldenHour: toValidInt(incomingRule.weekday?.goldenHour, fallbackRule.weekday.goldenHour),
      lateNight: toValidInt(incomingRule.weekday?.lateNight, fallbackRule.weekday.lateNight),
    },
    weekend: {
      before17: toValidInt(incomingRule.weekend?.before17, fallbackRule.weekend.before17),
      goldenHour: toValidInt(incomingRule.weekend?.goldenHour, fallbackRule.weekend.goldenHour),
      lateNight: toValidInt(incomingRule.weekend?.lateNight, fallbackRule.weekend.lateNight),
    },
  };
};

export const updateAdminPricingConfig = async (req, res) => {
  try {
    const { formats, holidaySurcharge, note, applyToExistingShowtimes = true } = req.body || {};
    const existing = await ensurePricingConfig();

    const nextFormats = {};
    for (const fmtKey of ['2D', '3D', 'IMAX', 'GOLD_CLASS']) {
      const baseFallback = existing.formats?.[fmtKey] || INITIAL_PRICING_FORMATS[fmtKey];
      nextFormats[fmtKey] = sanitizeFormatPricingRule(formats?.[fmtKey] || {}, baseFallback);
    }

    // Kiểm tra logic phân cấp 2D < 3D < IMAX để tránh cấu hình sai lệch ngược đời
    const f2D = nextFormats['2D'];
    const f3D = nextFormats['3D'];
    const fImax = nextFormats.IMAX;
    for (const dayKey of ['weekday', 'weekend']) {
      for (const slotKey of ['before17', 'goldenHour', 'lateNight']) {
        if (f3D[dayKey][slotKey] <= f2D[dayKey][slotKey]) {
          return res.status(400).json({
            message: `Giá vé 3D (${f3D[dayKey][slotKey].toLocaleString('vi-VN')}đ) phải cao hơn giá vé 2D (${f2D[dayKey][slotKey].toLocaleString('vi-VN')}đ) ở tất cả khung giờ!`,
          });
        }
        if (fImax[dayKey][slotKey] <= f3D[dayKey][slotKey]) {
          return res.status(400).json({
            message: `Giá vé IMAX (${fImax[dayKey][slotKey].toLocaleString('vi-VN')}đ) phải cao hơn giá vé 3D (${f3D[dayKey][slotKey].toLocaleString('vi-VN')}đ) ở tất cả khung giờ!`,
          });
        }
      }
    }

    const updated = await TicketPricingConfig.findOneAndUpdate(
      { configKey: 'MAIN_PRICING_CONFIG' },
      {
        $set: {
          formats: nextFormats,
          holidaySurcharge:
            holidaySurcharge !== undefined && Number(holidaySurcharge) >= 0
              ? Math.round(Number(holidaySurcharge))
              : existing.holidaySurcharge,
          note: note !== undefined ? String(note).slice(0, 300) : existing.note,
        },
      },
      { new: true, upsert: true }
    ).lean();

    const syncResult = await syncDatabaseWithPricingConfig(updated, {
      updateFutureShowtimes: Boolean(applyToExistingShowtimes),
    });

    res.json({
      success: true,
      message: `Đã lưu bảng giá vé mới (đồng bộ ${syncResult.updatedRooms} phòng chiếu${applyToExistingShowtimes ? ` và ${syncResult.updatedShowtimes} suất chiếu sắp tới` : ''})!`,
      config: updated,
      syncResult,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật bảng giá vé', error: error.message });
  }
};
