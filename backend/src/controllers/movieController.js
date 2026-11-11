import mongoose from 'mongoose';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import { ensure3DShowtimesSynced } from './cinemaController.js';

let hasSyncedMovieFormats = false;

export const resolveMovieFormatSpec = (m = {}) => {
  const title = (m.title || '').toLowerCase();
  const genre = (m.genre || '').toLowerCase();

  let defaultTech = 'IMAX';
  let defaultFormats = ['2D', '3D', 'IMAX'];

  if (title.includes('oppenheimer')) {
    defaultTech = 'Dolby 7.1';
    defaultFormats = ['2D', '70mm IMAX'];
  } else if (title.includes('godzilla') || title.includes('venom') || title.includes('deadpool') || title.includes('spider')) {
    defaultTech = '4DX';
    defaultFormats = ['2D', '3D', '4DX'];
  } else if (
    title.includes('cô dâu') ||
    title.includes('mai') ||
    title.includes('lật mặt') ||
    title.includes('quật mộ') ||
    genre.includes('tâm lý') ||
    genre.includes('gia đình')
  ) {
    defaultTech = 'Dolby 7.1';
    defaultFormats = ['2D', 'Dolby 7.1'];
  } else if (title.includes('inside out') || title.includes('panda') || title.includes('transformers') || genre.includes('hoạt hình')) {
    defaultTech = 'RealD 3D';
    defaultFormats = ['2D', '3D', 'RealD 3D'];
  } else if (title.includes('dune') || title.includes('avatar')) {
    defaultTech = 'IMAX';
    defaultFormats = ['2D', '3D', 'IMAX'];
  }

  const rawFormats = Array.isArray(m.formats) ? m.formats : [];
  const isLegacyDefault =
    rawFormats.length === 0 ||
    rawFormats.join(',') === 'IMAX Laser,3D,2D Dolby Atmos' ||
    rawFormats.some((f) => f === '2D Dolby Atmos' || f === 'IMAX Laser');

  const finalTech =
    !m.techFormat || m.techFormat === 'IMAX Laser' ? defaultTech : m.techFormat;
  const finalFormats = isLegacyDefault ? defaultFormats : rawFormats;

  return {
    techFormat: finalTech,
    formats: finalFormats,
  };
};

export const ensureMovieFormatsClean = async () => {
  if (hasSyncedMovieFormats) return;
  try {
    const allMovies = await Movie.find({});
    for (const doc of allMovies) {
      const spec = resolveMovieFormatSpec(doc);
      const currentJoin = Array.isArray(doc.formats) ? doc.formats.join(',') : '';
      if (doc.techFormat !== spec.techFormat || currentJoin !== spec.formats.join(',')) {
        doc.techFormat = spec.techFormat;
        doc.formats = spec.formats;
        await doc.save();
      }
    }
    hasSyncedMovieFormats = true;
  } catch (err) {
    console.warn('Movie formats sync warning:', err.message);
  }
};

// Lấy danh sách phim (kèm lọc theo trạng thái / thể loại / tìm kiếm)
export const getMovies = async (req, res) => {
  try {
    await ensure3DShowtimesSynced();
    await ensureMovieFormatsClean();
    const { status, genre, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }
    if (genre) {
      filter.genre = { $regex: genre, $options: 'i' };
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const movies = await Movie.find(filter).sort({ releaseDate: -1 }).lean();

    // Lấy thêm firstShowtimeId và danh sách showtimes thực tế cho từng phim
    const moviesWithShowtimes = await Promise.all(
      movies.map(async (m) => {
        const showtimes = await Showtime.find({ movieId: m._id })
          .sort({ startTime: 1 })
          .select('_id startTime roomName formatFeature price')
          .lean();

        const formattedShowtimes = showtimes.map((st) => {
          const startTimeDate = new Date(st.startTime);
          const timeStr = startTimeDate.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return {
            id: st._id.toString(),
            time: timeStr,
            roomName: st.roomName || 'Phòng 01 - IMAX Laser',
            format: st.formatFeature || 'IMAX Laser',
            price: st.price || 95000,
          };
        });

        const spec = resolveMovieFormatSpec(m);

        return {
          ...m,
          ...spec,
          id: m._id.toString(),
          firstShowtimeId: showtimes.length > 0 ? showtimes[0]._id.toString() : null,
          showtimes: formattedShowtimes,
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
    await ensureMovieFormatsClean();
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

    // Lấy danh sách suất chiếu kèm chi tiết rạp chiếu
    const showtimes = await Showtime.find({ movieId: movie._id })
      .populate('cinemaId', 'name city address slug isFlagship rating distance')
      .sort({ startTime: 1 })
      .lean();

    const formattedShowtimes = showtimes.map((st) => ({
      ...st,
      id: st._id.toString(),
      cinema: st.cinemaId
        ? {
            id: st.cinemaId._id ? st.cinemaId._id.toString() : st.cinemaId.id,
            name: st.cinemaId.name,
            city: st.cinemaId.city,
            address: st.cinemaId.address,
            slug: st.cinemaId.slug,
            isFlagship: st.cinemaId.isFlagship,
            distance: st.cinemaId.distance,
          }
        : null,
    }));

    const spec = resolveMovieFormatSpec(movie);

    res.json({
      ...movie,
      ...spec,
      id: movie._id.toString(),
      showtimes: formattedShowtimes,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin chi tiết phim', error: error.message });
  }
};
