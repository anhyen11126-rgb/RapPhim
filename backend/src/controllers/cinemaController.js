import mongoose from 'mongoose';
import Cinema from '../models/Cinema.js';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Movie from '../models/Movie.js';

// Lấy danh sách rạp (kèm lọc theo thành phố, công nghệ, tìm kiếm)
export const getCinemas = async (req, res) => {
  try {
    const { city, tech, search } = req.query;
    const filter = {};

    if (city && city !== 'Tất cả khu vực') {
      filter.city = city;
    }

    if (tech && tech !== 'Tất cả') {
      filter.tags = tech;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    const cinemas = await Cinema.find(filter).sort({ isFlagship: -1, createdAt: 1 }).lean();

    const formatted = cinemas.map((c) => ({
      ...c,
      id: c._id.toString(),
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách rạp', error: error.message });
  }
};

// Lấy chi tiết 1 rạp kèm toàn bộ lịch chiếu & số ghế trống thực tế
export const getCinemaShowtimes = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query; // YYYY-MM-DD (tùy chọn)

    let cinema = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      cinema = await Cinema.findById(id).lean();
    } else {
      cinema = await Cinema.findOne({ slug: id }).lean();
    }

    if (!cinema) {
      return res.status(404).json({ message: 'Không tìm thấy cụm rạp yêu cầu' });
    }

    // Xác định khoảng thời gian của ngày cần xem lịch chiếu
    let startOfDay, endOfDay;
    if (date) {
      startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
    } else {
      startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date();
      endOfDay.setDate(endOfDay.getDate() + 3); // Lấy 3 ngày tới nếu chưa chọn ngày
      endOfDay.setHours(23, 59, 59, 999);
    }

    // Truy vấn các suất chiếu của rạp này
    const showtimes = await Showtime.find({
      cinemaId: cinema._id,
      startTime: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ startTime: 1 })
      .populate('movieId')
      .lean();

    // Nhóm các suất chiếu theo từng Phim
    const moviesMap = new Map();

    for (const st of showtimes) {
      if (!st.movieId) continue;

      const movie = st.movieId;
      const movieIdStr = movie._id.toString();

      if (!moviesMap.has(movieIdStr)) {
        moviesMap.set(movieIdStr, {
          id: movieIdStr,
          title: movie.title,
          originalTitle: movie.slug || movie.title,
          ageRating: movie.ageRating || 'P',
          poster: movie.posterUrl || movie.poster,
          duration: `${movie.duration || 120} phút`,
          genre: movie.genre || 'Hành động',
          ratingPercent: '98% Hài lòng',
          roomsMap: new Map(),
        });
      }

      // Đếm số ghế trống thực tế trong DB
      const availableSeatsCount = await ShowtimeSeat.countDocuments({
        showtimeId: st._id,
        status: 'AVAILABLE',
      });

      const totalSeatsCount = await ShowtimeSeat.countDocuments({
        showtimeId: st._id,
      });

      const movieEntry = moviesMap.get(movieIdStr);
      const roomName = st.roomName || 'Phòng 01 - Tiêu chuẩn';

      if (!movieEntry.roomsMap.has(roomName)) {
        movieEntry.roomsMap.set(roomName, {
          name: roomName,
          feature: st.formatFeature || 'Âm thanh vòm Dolby Atmos',
          priceText: `Giá từ ${st.price.toLocaleString('vi-VN')}đ`,
          showtimes: [],
        });
      }

      const timeStr = new Date(st.startTime).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      movieEntry.roomsMap.get(roomName).showtimes.push({
        id: st._id.toString(),
        time: timeStr,
        price: st.price,
        availableSeats: availableSeatsCount,
        totalSeats: totalSeatsCount,
        seatText: `còn ${availableSeatsCount} ghế`,
        statusColor: availableSeatsCount <= 10 ? 'text-amber-400' : 'text-emerald-400',
      });
    }

    // Chuyển cấu trúc Map thành Array cho Frontend render
    const formattedMovies = Array.from(moviesMap.values()).map((m) => ({
      id: m.id,
      title: m.title,
      originalTitle: m.originalTitle,
      ageRating: m.ageRating,
      poster: m.poster,
      duration: m.duration,
      genre: m.genre,
      ratingPercent: m.ratingPercent,
      rooms: Array.from(m.roomsMap.values()),
    }));

    res.json({
      cinema: {
        ...cinema,
        id: cinema._id.toString(),
      },
      movies: formattedMovies,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy lịch chiếu của rạp', error: error.message });
  }
};

// Tạo rạp mới (Admin)
export const createCinema = async (req, res) => {
  try {
    const data = req.body;
    if (!data.name || !data.address) {
      return res.status(400).json({ message: 'Tên và địa chỉ rạp là bắt buộc' });
    }

    const slug =
      data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-') +
      '-' +
      Date.now();

    const cinema = await Cinema.create({
      ...data,
      slug,
    });

    res.status(201).json({
      ...cinema.toObject(),
      id: cinema._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo rạp mới', error: error.message });
  }
};

