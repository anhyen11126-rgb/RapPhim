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
    const { title, posterUrl, trailerUrl, description, genre, duration, ageRating, releaseDate, status, price } = req.body;

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

    const movie = await Movie.create({
      title,
      slug,
      posterUrl: posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop',
      poster: posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop',
      trailerUrl: trailerUrl || '',
      description: description || '',
      genre: genre || 'Chưa phân loại',
      duration: parseInt(duration, 10) || 120,
      ageRating: ageRating || 'P',
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

// Quản lý Suất chiếu: Tạo suất chiếu mới kèm ma trận 48 ghế tự động
export const createShowtime = async (req, res) => {
  try {
    const { movieId, roomName, startTime, price } = req.body;

    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({ message: 'ID phim không hợp lệ' });
    }

    const showtime = await Showtime.create({
      movieId: new mongoose.Types.ObjectId(movieId),
      roomName: roomName || 'Phòng 01 - Tiêu chuẩn',
      startTime: new Date(startTime),
      price: parseFloat(price) || 85000,
    });

    // Tạo tự động ma trận 48 ghế (A1 - F8)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const cols = [1, 2, 3, 4, 5, 6, 7, 8];
    const seatsData = [];

    for (const r of rows) {
      for (const c of cols) {
        const isVip = ['E', 'F'].includes(r);
        seatsData.push({
          showtimeId: showtime._id,
          seatNumber: `${r}${c}`,
          row: r,
          col: c,
          type: isVip ? 'VIP' : 'STANDARD',
          status: 'AVAILABLE',
        });
      }
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
    res.json(cinemas.map((c) => ({ ...c, id: c._id.toString() })));
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
      image: image || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
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
    const rawShowtimes = await Showtime.find()
      .sort({ startTime: -1 })
      .populate('movieId', 'title posterUrl duration ageRating')
      .populate('cinemaId', 'name city')
      .limit(100)
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
    const concessions = await Concession.find().lean();
    res.json(concessions.map((c) => ({ ...c, id: c._id.toString() })));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy bắp nước', error: error.message });
  }
};

export const createConcession = async (req, res) => {
  try {
    const { name, price, description, image } = req.body;
    const c = await Concession.create({
      name,
      price: parseFloat(price) || 50000,
      description: description || '',
      image: image || 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=500&auto=format&fit=crop',
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
    const promotions = await Promotion.find().sort({ createdAt: -1 }).lean();
    res.json(promotions.map((p) => ({ ...p, id: p._id.toString() })));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy khuyến mãi', error: error.message });
  }
};

export const createPromotion = async (req, res) => {
  try {
    const { title, code, discountPercent, discountAmount, description, validUntil } = req.body;
    const promo = await Promotion.create({
      title,
      code: code ? code.toUpperCase() : 'PROMO' + Math.floor(Math.random() * 1000),
      discountPercent: discountPercent ? parseInt(discountPercent, 10) : 0,
      discountAmount: discountAmount ? parseInt(discountAmount, 10) : 0,
      description: description || '',
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 86400000),
      status: 'ACTIVE',
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
