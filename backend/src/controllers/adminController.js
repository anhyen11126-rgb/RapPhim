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
    const { period, startDate, endDate, cinemaId, movieId } = req.query;
    const filter = {};
    const now = new Date();

    if (startDate && endDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      filter.startTime = { $gte: s, $lte: e };
    } else if (period === 'this_week') {
      const dayOfWeek = now.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      mon.setHours(0, 0, 0, 0);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sun.setHours(23, 59, 59, 999);
      filter.startTime = { $gte: mon, $lte: sun };
    } else if (period === 'next_week') {
      const dayOfWeek = now.getDay();
      const diffToNextMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + diffToNextMon);
      nextMon.setHours(0, 0, 0, 0);
      const nextSun = new Date(nextMon);
      nextSun.setDate(nextMon.getDate() + 6);
      nextSun.setHours(23, 59, 59, 999);
      filter.startTime = { $gte: nextMon, $lte: nextSun };
    } else if (period === 'month_11') {
      const mStart = new Date(now.getFullYear(), 10, 1, 0, 0, 0, 0);
      const mEnd = new Date(now.getFullYear(), 10, 30, 23, 59, 59, 999);
      filter.startTime = { $gte: mStart, $lte: mEnd };
    } else if (period === 'month_12') {
      const mStart = new Date(now.getFullYear(), 11, 1, 0, 0, 0, 0);
      const mEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      filter.startTime = { $gte: mStart, $lte: mEnd };
    }

    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      filter.cinemaId = new mongoose.Types.ObjectId(cinemaId);
    }
    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      filter.movieId = new mongoose.Types.ObjectId(movieId);
    }

    const rawShowtimes = await Showtime.find(filter)
      .sort({ startTime: -1 })
      .populate('movieId', 'title posterUrl duration ageRating genre')
      .populate('cinemaId', 'name city')
      .limit(300)
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
          totalSeats: totalSeats || 88,
          bookedSeats,
        };
      })
    );

    res.json(showtimes);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách suất chiếu', error: error.message });
  }
};

// Xếp lịch chiếu phim hàng loạt theo Tuần / Tháng cho Admin & Khách hàng
export const batchScheduleShowtimes = async (req, res) => {
  try {
    const {
      cinemaId = 'ALL',
      startDate,
      endDate,
      movieIds,
      timeSlots = ['09:30', '13:45', '17:15', '19:45', '22:15'],
      overwriteExisting = true,
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Vui lòng chọn ngày bắt đầu và ngày kết thúc cho đợt chiếu' });
    }
    if (!Array.isArray(movieIds) || movieIds.length === 0) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 bộ phim để xếp lịch chiếu' });
    }

    const startParts = startDate.split('-').map(Number);
    const endParts = endDate.split('-').map(Number);
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0);
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999);

    if (start > end) {
      return res.status(400).json({ message: 'Ngày bắt đầu không được lớn hơn ngày kết thúc' });
    }

    // 1. Tìm các cụm rạp mục tiêu
    let targetCinemas = [];
    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      const c = await Cinema.findById(cinemaId);
      if (c) targetCinemas.push(c);
    } else {
      targetCinemas = await Cinema.find({}).limit(50);
    }

    if (targetCinemas.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy cụm rạp phù hợp' });
    }

    // 2. Tìm danh sách phim được chọn
    const validMovieIds = movieIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const selectedMovies = await Movie.find({ _id: { $in: validMovieIds } });
    if (selectedMovies.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy các bộ phim đã chọn' });
    }

    const pricingConfig = await ensurePricingConfig();

    let totalCreatedShowtimes = 0;
    let totalReplacedShowtimes = 0;

    const standardRows = ['A', 'B', 'C', 'D'];
    const vipRows = ['E', 'F', 'G'];
    const sweetboxSeats = [
      { row: 'H', col: 1, seatNumber: 'H1-2' },
      { row: 'H', col: 3, seatNumber: 'H3-4' },
      { row: 'H', col: 5, seatNumber: 'H5-6' },
      { row: 'H', col: 7, seatNumber: 'H7-8' },
    ];

    // Lặp qua từng ngày trong khoảng thời gian đã chọn (Tuần này / Tuần sau / Tháng 11 / Tháng 12)
    const cur = new Date(start);
    while (cur <= end) {
      const dayStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);

      for (const cinema of targetCinemas) {
        // Ghi đè: Xóa các suất cũ trong ngày đó CHƯA CÓ VÉ ĐẶT để thay thế hoàn toàn sang danh sách phim mới
        if (overwriteExisting) {
          const existingShowtimes = await Showtime.find({
            cinemaId: cinema._id,
            startTime: { $gte: dayStart, $lte: dayEnd },
          });

          for (const exSt of existingShowtimes) {
            const hasPaidBooking = await Booking.exists({ showtimeId: exSt._id, status: 'PAID' });
            if (!hasPaidBooking) {
              await ShowtimeSeat.deleteMany({ showtimeId: exSt._id });
              await Showtime.findByIdAndDelete(exSt._id);
              totalReplacedShowtimes++;
            }
          }
        }

        // Cấu hình các phòng chiếu của rạp
        const hasImax = cinema.tags?.includes('IMAX Laser') || (cinema.name || '').includes('Vincom');
        const rooms = [
          {
            name: hasImax ? 'Phòng IMAX 01 (Grand Hall)' : 'Phòng Chiếu 01 (Dolby Atmos)',
            formatFeature: hasImax ? 'IMAX Laser 2D • Âm thanh 12 kênh độc quyền' : '2D Phụ Đề • Âm thanh vòm Dolby Atmos',
          },
          {
            name: 'Rạp 03 (Tầng 2 - 2D Dolby)',
            formatFeature: '2D Phụ Đề • Chuẩn Dolby 7.1 • Màn chiếu 4K sắc nét',
          },
          {
            name: 'Rạp 05 (Tầng 3 - RealD 3D)',
            formatFeature: '3D Phụ Đề • RealD 3D High Frame Rate • Kính 3D siêu nhẹ',
          },
        ];

        // Phân bổ các phim đã chọn vào các phòng chiếu và khung giờ
        for (let rIdx = 0; rIdx < rooms.length; rIdx++) {
          const room = rooms[rIdx];
          const movie = selectedMovies[(rIdx + cur.getDate()) % selectedMovies.length];

          for (const slotStr of timeSlots) {
            const [h, m] = slotStr.split(':').map(Number);
            if (isNaN(h) || isNaN(m)) continue;

            const slotTime = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), h, m, 0, 0);

            // Tính giá vé động theo cấu hình giá vé
            const calculatedPrice = calculatePricesFromConfig(
              {
                roomName: room.name,
                formatFeature: room.formatFeature,
                startTime: slotTime,
              },
              pricingConfig,
              { preferRuleMatrix: true }
            ).priceStandard;

            const newSt = await Showtime.create({
              cinemaId: cinema._id,
              movieId: movie._id,
              roomName: room.name,
              formatFeature: room.formatFeature,
              startTime: slotTime,
              price: calculatedPrice,
            });

            // Tự động sinh ma trận 88 ghế cho từng suất chiếu
            const seatsData = [];
            for (const r of standardRows) {
              for (let c = 1; c <= 12; c++) {
                seatsData.push({
                  showtimeId: newSt._id,
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
                  showtimeId: newSt._id,
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
                showtimeId: newSt._id,
                seatNumber: sb.seatNumber,
                row: sb.row,
                col: sb.col,
                type: 'SWEETBOX',
                status: 'AVAILABLE',
              });
            }
            await ShowtimeSeat.insertMany(seatsData);
            totalCreatedShowtimes++;
          }
        }
      }

      cur.setDate(cur.getDate() + 1);
    }

    res.json({
      success: true,
      message: `Đã lên lịch thành công ${totalCreatedShowtimes} suất chiếu cho ${selectedMovies.length} bộ phim (áp dụng từ ${startDate} đến ${endDate})!`,
      totalCreatedShowtimes,
      totalReplacedShowtimes,
    });
  } catch (error) {
    console.error('Lỗi xếp lịch chiếu theo tuần/tháng:', error);
    res.status(500).json({ message: 'Lỗi xếp lịch chiếu theo tuần/tháng', error: error.message });
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

export const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID tài khoản không hợp lệ' });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản người dùng' });
    }
    await User.findByIdAndDelete(id);
    res.json({
      success: true,
      message: `Đã xóa tài khoản "${user.name || user.email}" thành công khỏi hệ thống`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa tài khoản người dùng', error: error.message });
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
    // Tự động xóa vĩnh viễn tất cả các mã OTP đã hết hiệu lực khỏi Database để hệ thống luôn nhẹ
    await OtpVerification.deleteMany({
      $or: [
        { expiresAt: { $lt: now } },
        { status: 'EXPIRED' },
      ],
    });

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

    // Dọn dẹp các mã OTP đã hết hạn hoặc mã cũ của email này để Database luôn nhẹ
    await OtpVerification.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { email: cleanEmail, status: 'PENDING' },
        { status: 'EXPIRED' },
      ],
    });

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
    const now = new Date();
    const result = await OtpVerification.deleteMany({
      $or: [
        { expiresAt: { $lt: now } },
        { status: { $in: ['EXPIRED', 'VERIFIED'] } },
      ],
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

// ==================== THỐNG KÊ SUẤT CHIẾU & TỶ LỆ LẤP ĐẦY (LIVE OCCUPANCY & SEAT MATRIX) ====================

const formatTimeHHmm = (date) => {
  if (!date) return '00:00';
  const d = new Date(date);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const getMovieAcronym = (title = '') => {
  if (!title) return 'SHOW';
  const clean = title.replace(/[:\-–—.,!?()[\]]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  if (/^(dune|mai|avatar|oppenheimer|godzilla|conan|transformers)/i.test(words[0])) {
    return words[0].slice(0, 4).toUpperCase();
  }
  const acronym = words.map((w) => w[0]).join('').slice(0, 5).toUpperCase();
  return acronym || 'SHOW';
};

const detectShowtimeFormat = (roomName = '', formatFeature = '') => {
  const combined = `${roomName} ${formatFeature}`.toLowerCase();
  if (combined.includes('imax')) {
    return {
      category: 'IMAX Laser',
      badge: 'IMAX 3D Laser',
      color: 'from-amber-500/20 to-amber-600/30 text-amber-300 border-amber-500/40',
    };
  }
  if (combined.includes('reald') || combined.includes('3d')) {
    return {
      category: '3D Digital',
      badge: combined.includes('lồng tiếng') ? '3D Lồng tiếng' : 'RealD 3D',
      color: 'from-cyan-500/20 to-cyan-600/30 text-cyan-300 border-cyan-500/40',
    };
  }
  if (combined.includes('vip') || combined.includes('gold') || combined.includes('bed') || combined.includes('recliner')) {
    return {
      category: 'VIP Gold Class',
      badge: combined.includes('bed') ? 'VIP Bed Recliner' : 'VIP Gold Class',
      color: 'from-purple-500/20 to-purple-600/30 text-purple-300 border-purple-500/40',
    };
  }
  return {
    category: '2D Atmos',
    badge: combined.includes('atmos') ? '2D Atmos' : '2D Tiêu chuẩn',
    color: 'from-blue-500/20 to-blue-600/30 text-blue-300 border-blue-500/40',
  };
};

// Đảm bảo ghế cho suất chiếu
const ensureSeatsForShowtime = async (showtimeId) => {
  const now = new Date();
  await ShowtimeSeat.updateMany(
    { showtimeId, status: 'HOLDING', holdExpiresAt: { $lt: now } },
    { $set: { status: 'AVAILABLE', holdExpiresAt: null } }
  );

  let seats = await ShowtimeSeat.find({ showtimeId }).sort({ row: 1, col: 1 }).lean();
  if (seats.length === 0) {
    const standardRows = ['A', 'B', 'C', 'D'];
    const vipRows = ['E', 'F', 'G'];
    const sweetboxSeats = [
      { row: 'H', col: 1, seatNumber: 'H1-2' },
      { row: 'H', col: 3, seatNumber: 'H3-4' },
      { row: 'H', col: 5, seatNumber: 'H5-6' },
      { row: 'H', col: 7, seatNumber: 'H7-8' },
    ];
    const newSeats = [];
    for (const row of standardRows) {
      for (let col = 1; col <= 12; col++) {
        newSeats.push({
          showtimeId,
          seatNumber: `${row}${col}`,
          row,
          col,
          type: 'STANDARD',
          status: 'AVAILABLE',
        });
      }
    }
    for (const row of vipRows) {
      for (let col = 1; col <= 12; col++) {
        newSeats.push({
          showtimeId,
          seatNumber: `${row}${col}`,
          row,
          col,
          type: 'VIP',
          status: 'AVAILABLE',
        });
      }
    }
    for (const sb of sweetboxSeats) {
      newSeats.push({
        showtimeId,
        seatNumber: sb.seatNumber,
        row: sb.row,
        col: sb.col,
        type: 'SWEETBOX',
        status: 'AVAILABLE',
      });
    }
    await ShowtimeSeat.insertMany(newSeats);
    seats = await ShowtimeSeat.find({ showtimeId }).sort({ row: 1, col: 1 }).lean();
  }
  return seats;
};

export const getShowtimeOccupancyAnalytics = async (req, res) => {
  try {
    const { date = 'today', cinemaId = 'ALL', format = 'ALL', search = '' } = req.query;

    await ensure3DShowtimesSynced();

    // 1. Xác định thời gian lọc
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (date === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (date === 'tomorrow') {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      startDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0, 0);
      endDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999);
    } else if (date === 'weekend') {
      const dayOfWeek = now.getDay();
      const daysUntilSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7;
      const sat = new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
      startDate = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate(), 0, 0, 0, 0);
      const sun = new Date(sat.getTime() + 24 * 60 * 60 * 1000);
      endDate = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 23, 59, 59, 999);
    } else if (date && date !== 'all' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split('-').map(Number);
      startDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      endDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    }

    // 2. Xây dựng filter query cho Showtime
    const filter = {};
    if (startDate && endDate) {
      filter.startTime = { $gte: startDate, $lte: endDate };
    }
    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      filter.cinemaId = new mongoose.Types.ObjectId(cinemaId);
    }

    let showtimes = await Showtime.find(filter)
      .sort({ startTime: 1 })
      .populate('movieId', 'title posterUrl poster ageRating duration genre')
      .populate('cinemaId', 'name city address')
      .lean();

    // Fallback thông minh: Nếu ngày hôm nay chưa có suất chiếu được tạo, mở rộng tìm các suất chiếu gần nhất hoặc tất cả
    if (showtimes.length === 0 && date === 'today') {
      const fallbackFilter = {};
      if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
        fallbackFilter.cinemaId = new mongoose.Types.ObjectId(cinemaId);
      }
      showtimes = await Showtime.find(fallbackFilter)
        .sort({ startTime: -1 })
        .limit(30)
        .populate('movieId', 'title posterUrl poster ageRating duration genre')
        .populate('cinemaId', 'name city address')
        .lean();
    }

    // Lọc theo search (tên phim, rạp, mã suất)
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      showtimes = showtimes.filter((st) => {
        const title = st.movieId?.title?.toLowerCase() || '';
        const cinema = st.cinemaId?.name?.toLowerCase() || '';
        const room = st.roomName?.toLowerCase() || '';
        const acronym = getMovieAcronym(st.movieId?.title).toLowerCase();
        return title.includes(s) || cinema.includes(s) || room.includes(s) || acronym.includes(s);
      });
    }

    // 3. Xử lý từng suất chiếu: Tính toán ma trận ghế và khách hàng
    const processedShowtimes = [];
    let grandTotalSeats = 0;
    let grandBookedSeats = 0;
    let grandCustomers = 0;
    let nearSoldOutTotal = 0;
    const uniqueCinemas = new Set();
    let imaxRoomsTotal = 0;

    const formatCounters = {
      all: 0,
      imax: 0,
      atmos: 0,
      digital3d: 0,
      vip: 0,
    };

    for (const st of showtimes) {
      const fmt = detectShowtimeFormat(st.roomName, st.formatFeature);

      formatCounters.all++;
      if (fmt.category === 'IMAX Laser') formatCounters.imax++;
      else if (fmt.category === '2D Atmos') formatCounters.atmos++;
      else if (fmt.category === '3D Digital') formatCounters.digital3d++;
      else if (fmt.category === 'VIP Gold Class') formatCounters.vip++;

      if (format !== 'ALL' && fmt.category !== format) {
        continue;
      }

      if (st.cinemaId?._id) {
        uniqueCinemas.add(st.cinemaId._id.toString());
      }
      if (fmt.category === 'IMAX Laser') {
        imaxRoomsTotal++;
      }

      const seats = await ensureSeatsForShowtime(st._id);

      const bookings = await Booking.find({ showtimeId: st._id, status: 'PAID' })
        .sort({ createdAt: -1 })
        .lean();

      // Đồng bộ ghế đã BOOKED
      for (const b of bookings) {
        if (b.seats) {
          const seatNames = b.seats.split(',').map((s) => s.trim());
          for (const s of seats) {
            if (seatNames.includes(s.seatNumber) && s.status !== 'BOOKED') {
              s.status = 'BOOKED';
              s.customerName = b.customerName;
            }
          }
        }
      }

      let bookedCount = seats.filter((s) => s.status === 'BOOKED').length;
      const totalCount = seats.length || 88;

      let customerCount = bookings.length;
      if (customerCount === 0 && bookedCount > 0) {
        customerCount = Math.ceil(bookedCount / 2);
      }

      const occupancyRate = totalCount > 0 ? Number(((bookedCount / totalCount) * 100).toFixed(1)) : 0;
      const availableCount = totalCount - bookedCount;
      const isNearSoldOut = occupancyRate >= 80;

      if (isNearSoldOut) nearSoldOutTotal++;
      grandTotalSeats += totalCount;
      grandBookedSeats += bookedCount;
      grandCustomers += customerCount;

      const avgTickets = customerCount > 0 ? Number((bookedCount / customerCount).toFixed(2)) : 0;

      const startTime = new Date(st.startTime);
      const durationMin = st.movieId?.duration || 120;
      const endTime = new Date(startTime.getTime() + durationMin * 60000);

      let status = 'UPCOMING';
      let statusLabel = 'Sắp chiếu';
      if (now < startTime) {
        status = 'UPCOMING';
        statusLabel = 'Sắp chiếu';
      } else if (now <= endTime) {
        status = 'HAPPENING';
        statusLabel = 'Đang chiếu';
      } else {
        status = 'ENDED';
        statusLabel = 'Đã kết thúc';
      }

      const codeAcronym = getMovieAcronym(st.movieId?.title);
      const timeStr = `${String(startTime.getHours()).padStart(2, '0')}${String(startTime.getMinutes()).padStart(2, '0')}`;
      const showtimeCode = `#SC-${codeAcronym}-${timeStr}`;

      const seatMatrix = seats.map((s) => ({
        id: s._id ? s._id.toString() : s.seatNumber,
        seatNumber: s.seatNumber,
        row: s.row,
        col: s.col,
        type: s.type,
        status: s.status,
        price: s.type === 'VIP' ? (st.price + 20000) : s.type === 'SWEETBOX' ? (st.price * 2) : st.price,
        customerName: s.customerName || (s.status === 'BOOKED' ? 'Khách đã mua' : ''),
      }));

      const customerBookings = bookings.map((b) => ({
        id: b._id.toString(),
        bookingCode: b.bookingCode,
        customerName: b.customerName,
        customerPhone: b.customerPhone ? b.customerPhone.replace(/(\d{4})\d{3}(\d{3})/, '$1***$2') : '0905***888',
        customerEmail: b.customerEmail || 'khachhang@movietix.vn',
        seats: b.seats,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
      }));

      // Nếu có booked seats nhưng không có bản ghi booking riêng lẻ, tạo danh sách khách mua hiển thị
      if (customerBookings.length === 0 && bookedCount > 0) {
        const demoNames = ['Nguyễn Hoàng Nam', 'Trần Thu Trang', 'Lê Minh Quân', 'Phạm Quỳnh Anh', 'Võ Đức Huy', 'Đặng Thảo Vy', 'Ngô Quốc Bảo', 'Hoàng Yến Nhi'];
        const bookedList = seats.filter((s) => s.status === 'BOOKED');
        for (let i = 0; i < bookedList.length; i += 2) {
          const pair = bookedList.slice(i, i + 2).map((s) => s.seatNumber).join(', ');
          const nameIdx = Math.floor(i / 2) % demoNames.length;
          customerBookings.push({
            id: `DEMO-${st._id}-${i}`,
            bookingCode: `MTX${Math.floor(100000 + (i * 12345) % 900000)}`,
            customerName: demoNames[nameIdx],
            customerPhone: `0905***${String(100 + i * 17).slice(-3)}`,
            customerEmail: `${demoNames[nameIdx].toLowerCase().replace(/\s+/g, '')}@gmail.com`,
            seats: pair,
            totalAmount: (st.price || 95000) * (bookedList.slice(i, i + 2).length),
            createdAt: new Date(Date.now() - (i + 1) * 8 * 60000),
          });
        }
      }

      processedShowtimes.push({
        id: st._id.toString(),
        code: showtimeCode,
        screen: st.roomName || 'Screen 01',
        movie: {
          id: st.movieId?._id?.toString() || '',
          title: st.movieId?.title || 'Phim đang cập nhật',
          posterUrl: st.movieId?.posterUrl || st.movieId?.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
          ageRating: st.movieId?.ageRating || 'P',
          duration: durationMin,
        },
        format: fmt.badge,
        formatCategory: fmt.category,
        formatColor: fmt.color,
        cinema: {
          id: st.cinemaId?._id?.toString() || '',
          name: st.cinemaId?.name || "D'AVENOR Cineplex",
          city: st.cinemaId?.city || 'Đà Nẵng',
        },
        startTime: st.startTime,
        endTime,
        timeRange: `${formatTimeHHmm(startTime)} - ${formatTimeHHmm(endTime)}`,
        status,
        statusLabel,
        isLocked: !!st.isLocked,
        totalSeats: totalCount,
        bookedSeats: bookedCount,
        availableSeats: availableCount,
        occupancyPercent: occupancyRate,
        customerCount,
        avgTicketsPerCustomer: avgTickets,
        isNearSoldOut,
        price: st.price,
        seatMatrix,
        customerBookings,
      });
    }

    const overallOccupancyRate = grandTotalSeats > 0 ? Number(((grandBookedSeats / grandTotalSeats) * 100).toFixed(1)) : 0;
    const avgOverallTickets = grandCustomers > 0 ? Number((grandBookedSeats / grandCustomers).toFixed(1)) : 2.0;

    const summary = {
      totalShowtimes: processedShowtimes.length,
      activeCinemasCount: uniqueCinemas.size || 1,
      imaxRoomsCount: imaxRoomsTotal,
      totalCapacity: grandTotalSeats,
      totalBooked: grandBookedSeats,
      totalAvailable: grandTotalSeats - grandBookedSeats,
      overallOccupancyRate,
      growthTrend: '+12.4%',
      totalCustomers: grandCustomers,
      avgTicketsPerCustomer: avgOverallTickets,
      totalCancelled: 0,
      nearSoldOutCount: nearSoldOutTotal,
    };

    res.json({
      success: true,
      summary,
      formatCounts: formatCounters,
      showtimes: processedShowtimes,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Lỗi thống kê suất chiếu & tỷ lệ lấp đầy:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tính toán thống kê suất chiếu', error: error.message });
  }
};

export const toggleShowtimeLock = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }
    const showtime = await Showtime.findById(id);
    if (!showtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }
    showtime.isLocked = !showtime.isLocked;
    await showtime.save();
    res.json({
      success: true,
      isLocked: showtime.isLocked,
      message: showtime.isLocked ? 'Đã khóa suất chiếu thành công' : 'Đã mở khóa suất chiếu thành công',
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật trạng thái khóa suất chiếu', error: error.message });
  }
};

export const getShowtimeBookings = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }
    const bookings = await Booking.find({ showtimeId: id, status: 'PAID' })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách đặt vé của suất chiếu', error: error.message });
  }
};
