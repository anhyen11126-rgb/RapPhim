import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';
import Booking from '../models/Booking.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';

// Đăng nhập Admin
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
    }

    const admin = await AdminUser.findOne({ email: email.toLowerCase().trim() });

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

// Đăng ký Tài khoản Quản trị / Quản lý cụm rạp
export const adminRegister = async (req, res) => {
  try {
    const { email, password, name, role = 'ADMIN' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await AdminUser.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ message: 'Email này đã tồn tại trong hệ thống. Vui lòng đăng nhập.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await AdminUser.create({
      email: cleanEmail,
      password: hashedPassword,
      name: name.trim(),
      role: role || 'ADMIN',
    });

    const token = jwt.sign(
      { id: newAdmin._id.toString(), email: newAdmin.email, role: newAdmin.role },
      process.env.JWT_SECRET || 'movietix_jwt_secret_key_2026_cdio',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Đăng ký tài khoản quản trị thành công!',
      token,
      admin: {
        id: newAdmin._id.toString(),
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi đăng ký tài khoản', error: error.message });
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

    // 3. Tổng số phim & suất chiếu
    const totalMovies = await Movie.countDocuments();
    const totalShowtimes = await Showtime.countDocuments();

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
