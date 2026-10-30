import prisma from '../prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Đăng nhập Admin
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET || 'movietix_jwt_secret_key_2026_cdio',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Đăng nhập thành công',
      token,
      admin: {
        id: admin.id,
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
    const revenueResult = await prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'PAID' },
    });
    const totalRevenue = revenueResult._sum.totalAmount || 0;

    // 2. Tổng số vé đã bán
    const totalTickets = await prisma.showtimeSeat.count({
      where: { status: 'BOOKED' },
    });

    // 3. Tổng số phim & suất chiếu
    const totalMovies = await prisma.movie.count();
    const totalShowtimes = await prisma.showtime.count();

    // 4. Các đơn đặt vé gần nhất (5 đơn)
    const recentBookings = await prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        showtime: {
          include: { movie: true },
        },
      },
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
    const { title, posterUrl, trailerUrl, description, genre, duration, ageRating, releaseDate, status } = req.body;

    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now();

    const movie = await prisma.movie.create({
      data: {
        title,
        slug,
        posterUrl: posterUrl || 'https://via.placeholder.com/300x450',
        trailerUrl,
        description: description || '',
        genre: genre || 'Chưa phân loại',
        duration: parseInt(duration, 10) || 120,
        ageRating: ageRating || 'P',
        releaseDate: releaseDate ? new Date(releaseDate) : new Date(),
        status: status || 'NOW_SHOWING',
      },
    });

    res.status(201).json(movie);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo phim mới', error: error.message });
  }
};

// Quản lý Phim: Cập nhật
export const updateMovie = async (req, res) => {
  try {
    const { id } = req.params;
    const movieId = parseInt(id, 10);
    const data = req.body;

    if (data.duration) data.duration = parseInt(data.duration, 10);
    if (data.releaseDate) data.releaseDate = new Date(data.releaseDate);

    const updated = await prisma.movie.update({
      where: { id: movieId },
      data,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật phim', error: error.message });
  }
};

// Quản lý Phim: Xóa phim
export const deleteMovie = async (req, res) => {
  try {
    const { id } = req.params;
    const movieId = parseInt(id, 10);

    await prisma.movie.delete({
      where: { id: movieId },
    });

    res.json({ success: true, message: 'Đã xóa phim thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa phim', error: error.message });
  }
};

// Quản lý Suất chiếu: Tạo suất chiếu mới kèm ma trận 48 ghế tự động
export const createShowtime = async (req, res) => {
  try {
    const { movieId, roomName, startTime, price } = req.body;

    const showtime = await prisma.showtime.create({
      data: {
        movieId: parseInt(movieId, 10),
        roomName: roomName || 'Phòng 01 - Tiêu chuẩn',
        startTime: new Date(startTime),
        price: parseFloat(price) || 85000,
      },
    });

    // Tạo tự động ma trận 48 ghế (A1 - F8)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const cols = [1, 2, 3, 4, 5, 6, 7, 8];
    const seatsData = [];

    for (const r of rows) {
      for (const c of cols) {
        const isVip = ['C', 'D'].includes(r);
        seatsData.push({
          showtimeId: showtime.id,
          seatNumber: `${r}${c}`,
          row: r,
          col: c,
          type: isVip ? 'VIP' : 'STANDARD',
          status: 'AVAILABLE',
        });
      }
    }
    await prisma.showtimeSeat.createMany({ data: seatsData });

    res.status(201).json({
      message: 'Đã tạo suất chiếu và sinh sơ đồ ghế thành công',
      showtime,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo suất chiếu', error: error.message });
  }
};

// Quản lý Đặt vé: Danh sách đơn vé
export const getAdminBookings = async (req, res) => {
  try {
    const { search } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { bookingCode: { contains: search } },
        { customerPhone: { contains: search } },
        { customerName: { contains: search } },
      ];
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        showtime: {
          include: { movie: true },
        },
      },
    });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đặt vé', error: error.message });
  }
};

