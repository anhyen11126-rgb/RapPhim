import mongoose from 'mongoose';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';

// Lấy danh sách phim (kèm lọc theo trạng thái / thể loại / tìm kiếm)
export const getMovies = async (req, res) => {
  try {
    const { status, genre, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }
    if (genre) {
      filter.genre = { $regex: genre, $options: 'i' };
    }
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    const movies = await Movie.find(filter).sort({ releaseDate: -1 }).lean();

    // Lấy thêm firstShowtimeId và số lượng showtime cho từng phim
    const moviesWithShowtimes = await Promise.all(
      movies.map(async (m) => {
        const showtimes = await Showtime.find({ movieId: m._id }).sort({ startTime: 1 }).select('_id startTime').lean();
        return {
          ...m,
          id: m._id.toString(),
          firstShowtimeId: showtimes.length > 0 ? showtimes[0]._id.toString() : null,
          _count: { showtimes: showtimes.length },
        };
      })
    );

    res.json(moviesWithShowtimes);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách phim', error: error.message });
  }
};

// Lấy chi tiết 1 phim kèm danh sách suất chiếu
export const getMovieById = async (req, res) => {
  try {
    const { id } = req.params;

    let movie = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      movie = await Movie.findById(id).lean();
    } else {
      // Tìm theo slug hoặc trường khác nếu id không phải ObjectId
      movie = await Movie.findOne({ slug: id }).lean();
    }

    if (!movie) {
      return res.status(404).json({ message: 'Không tìm thấy phim yêu cầu' });
    }

    // Lấy danh sách suất chiếu
    const showtimes = await Showtime.find({ movieId: movie._id })
      .sort({ startTime: 1 })
      .select('_id roomName startTime price')
      .lean();

    const formattedShowtimes = showtimes.map((st) => ({
      ...st,
      id: st._id.toString(),
    }));

    res.json({
      ...movie,
      id: movie._id.toString(),
      showtimes: formattedShowtimes,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin chi tiết phim', error: error.message });
  }
};
