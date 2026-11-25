import { summarizeReviews } from '../services/reviewSummary.js';
import mongoose from 'mongoose';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import Booking from '../models/Booking.js';
import Cinema from '../models/Cinema.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';

let hasSyncedMovieFormats = false;

// Hàm phân tích và tính toán thống kê, đánh giá đồng bộ cho từng bộ phim
export const resolveMovieStatsAndReviews = async (movie, showtimes = []) => {
  const byId = showtimes.map(slot => slot._id).filter(Boolean);
  const bookings = await Booking.find({ showtimeId: { $in: byId }, status: 'PAID', paymentStatus: { $in: ['VERIFIED', 'SIMULATED'] } })
    .select('seats totalAmount paymentStatus').lean();
  const revenue = bookings.reduce((sum, booking) => sum + (booking.paymentStatus === 'VERIFIED' ? booking.totalAmount : 0), 0);
  const ticketsSold = bookings.reduce((sum, booking) => sum + booking.seats.split(',').filter(seat => seat.trim()).length, 0);
  return {
    stats: { revenue, revenueText: Math.round(revenue / 1000000) + ' triệu', ticketsSold, seatsBooked: ticketsSold },
    ...summarizeReviews(movie.reviews),
  };
};

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

        // Chỉ chấp nhận 3 phòng chuẩn duy nhất: Phòng IMAX Laser, Phòng Dolby Atmos, Phòng Gold Class
        const validRooms = ['Phòng IMAX Laser', 'Phòng Dolby Atmos', 'Phòng Gold Class'];
        const cleanShowtimes = showtimes.filter((st) =>
          validRooms.some((vr) => (st.roomName || '').includes(vr.replace('Phòng ', '')))
        );

        const formattedShowtimes = cleanShowtimes.map((st) => {
          const startTimeDate = new Date(st.startTime);
          const timeStr = startTimeDate.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const dateStr = startTimeDate.toISOString().slice(0, 10);
          return {
            id: st._id.toString(),
            date: dateStr,
            time: timeStr,
            roomName: st.roomName || 'Phòng IMAX Laser',
            format: st.formatFeature || 'IMAX Laser 2D',
            price: st.price || 150000,
          };
        });

        // Sắp xếp ưu tiên: Giờ vàng 19:30 lên trước, sau đó là ca tiếp theo (sau khi dọn dẹp) 22:xx rồi mới đến ca ngày
        formattedShowtimes.sort((a, b) => {
          const getPriority = (t) => {
            if (t === '19:30') return 1;
            if (t && t.startsWith('22:')) return 2;
            if (t && t.startsWith('16:')) return 3;
            if (t && (t.startsWith('13:') || t.startsWith('12:'))) return 4;
            return 5;
          };
          const pA = getPriority(a.time);
          const pB = getPriority(b.time);
          if (pA !== pB) return pA - pB;

          const roomOrder = ['IMAX', 'Atmos', 'Gold'];
          const rA = roomOrder.findIndex((ro) => (a.roomName || '').includes(ro));
          const rB = roomOrder.findIndex((ro) => (b.roomName || '').includes(ro));
          return (rA === -1 ? 99 : rA) - (rB === -1 ? 99 : rB);
        });

        // Tìm suất 19:30 Phòng IMAX Laser làm firstShowtimeId
        const primeImax = formattedShowtimes.find(
          (st) => st.time === '19:30' && (st.roomName || '').includes('IMAX')
        );
        const resolvedFirstId = primeImax ? primeImax.id : (formattedShowtimes[0]?.id || null);

        const spec = resolveMovieFormatSpec(m);
        const statsAndReviews = await resolveMovieStatsAndReviews(m, showtimes);

        return {
          ...m,
          ...spec,
          ...statsAndReviews,
          id: m._id.toString(),
          firstShowtimeId: resolvedFirstId,
          showtimes: formattedShowtimes,
          _count: { showtimes: formattedShowtimes.length },
        };
      })
    );

    // Ưu tiên 3 bộ phim Đang Chiếu Tại Rạp (Dune 2, Mai, Deadpool & Wolverine) lên đầu danh sách
    const prioritySlugs = ['dune-hanh-tinh-cat-phan-2', 'mai', 'deadpool-and-wolverine'];
    moviesWithShowtimes.sort((a, b) => {
      const aPriority = prioritySlugs.indexOf(a.slug);
      const bPriority = prioritySlugs.indexOf(b.slug);
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      if (a.status === 'NOW_SHOWING' && b.status !== 'NOW_SHOWING') return -1;
      if (b.status === 'NOW_SHOWING' && a.status !== 'NOW_SHOWING') return 1;
      return 0;
    });

    res.json(moviesWithShowtimes);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách phim', error: error.message });
  }
};

// Lấy chi tiết 1 phim kèm danh sách suất chiếu
export const getMovieSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const start = typeof date === 'string' ? new Date(date + 'T00:00:00+07:00') : new Date(NaN);
    const dayMs = 86400000;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Number.isFinite(start.getTime())
      || new Date(start.getTime() + 7 * 3600000).toISOString().slice(0, 10) !== date) {
      return res.sendStatus(400);
    }

    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };
    const movie = await Movie.findOne(query).select('releaseDate').lean();
    if (!movie) return res.sendStatus(404);

    const localRelease = movie.releaseDate?.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const showtimes = localRelease && date < localRelease
      ? [] : await Showtime.find({
      movieId: movie._id,
      startTime: { $gte: start, $lt: new Date(start.getTime() + dayMs) },
      cancelledAt: null,
      isLocked: { $ne: true },
    }).populate('roomId', 'name roomType formatFeature totalSeats')
      .populate('cinemaId', 'name address')
      .sort({ startTime: 1 }).lean();

    const ids = showtimes.map(({ _id }) => _id);
    const [countsByShowtime, cinema] = await Promise.all([
      ShowtimeSeat.aggregate([
        { $match: { showtimeId: { $in: ids } } },
        { $group: {
          _id: '$showtimeId', total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] } },
        } },
      ]),
      Cinema.findOne().sort({ _id: 1 }).select('name address').lean(),
    ]);
    const counts = new Map(countsByShowtime.map(row => [String(row._id), row]));

    res.set('Cache-Control', 'no-store');
    return res.json({
      cinema: showtimes.find(slot => slot.cinemaId)?.cinemaId ?? cinema,
      showtimes: showtimes.map(({ _id, roomId, roomName, cinemaId, startTime, endTime, price, isLocked, formatFeature }) => ({
        id: String(_id), roomId: roomId?._id ?? null, roomName: roomId?.name ?? roomName,
        roomType: roomId?.roomType, roomFeature: roomId?.formatFeature,
        cinemaName: cinemaId?.name, startTime, endTime, price, isLocked, formatFeature,
        availableSeats: counts.get(String(_id))?.available ?? null,
        totalSeats: counts.get(String(_id))?.total ?? roomId?.totalSeats ?? null,
      })),
    });
  } catch {
    return res.sendStatus(500);
  }
};

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
    const statsAndReviews = await resolveMovieStatsAndReviews(movie, showtimes);

    res.json({
      ...movie,
      ...spec,
      ...statsAndReviews,
      id: movie._id.toString(),
      showtimes: formattedShowtimes,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin chi tiết phim', error: error.message });
  }
};

// Khách hàng gửi đánh giá & nhận xét mới cho bộ phim
export const addMovieReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== 'string' || !comment.trim() || comment.length > 2000) {
      return res.status(400).json({ message: 'Nhập điểm đánh giá và nhận xét hợp lệ.' });
    }

    const query = mongoose.isObjectIdOrHexString(id) ? { _id: id } : { slug: id };
    const movie = await Movie.findOne(query).select('_id');
    if (!movie) return res.sendStatus(404);
    const showtimes = await Showtime.find({ movieId: movie._id, startTime: { $lte: new Date() } }).distinct('_id');
    const attended = await Booking.exists({
      userId: req.user._id, showtimeId: { $in: showtimes }, status: 'PAID',
      paymentStatus: { $in: ['VERIFIED', 'SIMULATED'] }, isCheckedIn: true,
    });
    if (!attended) return res.status(403).json({ message: 'Chỉ tài khoản đã soát vé của phim này được đánh giá.' });

    const review = {
      _id: new mongoose.Types.ObjectId(), userName: req.user.name, userId: req.user._id,
      rating, comment: comment.trim(), createdAt: new Date(), verifiedAttendance: true,
    };
    const updated = await Movie.findOneAndUpdate(
      { _id: movie._id, reviews: { $not: { $elemMatch: { userId: req.user._id, verifiedAttendance: true } } } },
      { $push: { reviews: { $each: [review], $position: 0 } } }, { new: true }
    ).select('reviews');
    if (!updated) return res.status(409).json({ message: 'Bạn đã đánh giá phim này.' });
    return res.status(201).json({ ...summarizeReviews(updated.reviews), review });
  } catch (error) {
    console.error('Review write failed:', error.name);
    return res.status(500).json({ message: 'Không lưu được đánh giá.' });
  }
};

export const deleteMovieReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    if (!mongoose.isObjectIdOrHexString(reviewId)) return res.sendStatus(400);
    const movie = mongoose.isObjectIdOrHexString(id) ? { _id: id } : { slug: id };
    const review = { _id: new mongoose.Types.ObjectId(reviewId), userId: req.user._id };
    const updated = await Movie.findOneAndUpdate(
      { ...movie, reviews: { $elemMatch: review } }, { $pull: { reviews: review } }, { new: true }
    ).select('reviews');
    if (!updated) return res.sendStatus(404);
    return res.json({ success: true, ...summarizeReviews(updated.reviews) });
  } catch (error) {
    console.error('Review removal failed:', error.name);
    return res.status(500).json({ message: 'Không xóa được đánh giá.' });
  }
};
