import { summarizeReviews } from '../services/reviewSummary.js';
import mongoose from 'mongoose';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import Booking from '../models/Booking.js';
import Cinema from '../models/Cinema.js';
import Room from '../models/Room.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import {
  ACTIVE_CINEMA_ROOM_TYPES,
  ROOM_TYPES_ENUM,
  resolveCanonicalRoomType,
} from '../utils/roomLayoutConfig.js';
import { computeShowtimeLifecycle } from '../services/showtimeLifecycleService.js';

let hasSyncedMovieFormats = false;

// Hàm phân tích và tính toán thống kê, đánh giá đồng bộ cho từng bộ phim
export const resolveMovieStatsAndReviews = async (movie, showtimes = [], currentUserId = null) => {
  const byId = showtimes.map(slot => slot._id).filter(Boolean);
  const bookings = await Booking.find({ showtimeId: { $in: byId }, status: 'PAID', paymentStatus: { $in: ['VERIFIED', 'SIMULATED'] } })
    .select('seats totalAmount paymentStatus').lean();
  const revenue = bookings.reduce((sum, booking) => sum + (booking.paymentStatus === 'VERIFIED' ? booking.totalAmount : 0), 0);
  const ticketsSold = bookings.reduce((sum, booking) => sum + booking.seats.split(',').filter(seat => seat.trim()).length, 0);
  return {
    stats: { revenue, revenueText: Math.round(revenue / 1000000) + ' triệu', ticketsSold, seatsBooked: ticketsSold },
    analytics: null,
    ...summarizeReviews(movie.reviews, currentUserId),
  };
};

// Kiểm tra quyền bình luận & đánh giá sao thực tế theo Booking + Showtime + Check-in của đúng bộ phim
export const resolveViewerMovieEligibility = async (movieId, userId, reviews = []) => {
  if (!userId) {
    return {
      isLoggedIn: false,
      hasBookedTicket: false,
      hasWatchedMovie: false,
      canComment: false,
      canRate: false,
      existingRatingReviewId: null,
      existingRating: null,
    };
  }
  const showtimes = await Showtime.find({ movieId, cancelledAt: null }).distinct('_id');
  const bookings = showtimes.length
    ? await Booking.find({
        userId,
        showtimeId: { $in: showtimes },
        status: 'PAID',
        paymentStatus: { $in: ['VERIFIED', 'SIMULATED'] },
      })
        .select('isCheckedIn')
        .lean()
    : [];
  const hasBookedTicket = bookings.length > 0;
  const hasWatchedMovie = bookings.some((b) => b.isCheckedIn === true);
  const existingRated = (reviews || []).find(
    (r) =>
      !r?.isDemo &&
      r?.verifiedAttendance &&
      String(r?.userId) === String(userId) &&
      Number.isInteger(r?.rating) &&
      r.rating >= 1 &&
      r.rating <= 5
  );

  return {
    isLoggedIn: true,
    hasBookedTicket,
    hasWatchedMovie,
    canComment: true,
    canRate: hasWatchedMovie,
    existingRatingReviewId: existingRated ? String(existingRated._id) : null,
    existingRating: existingRated ? existingRated.rating : null,
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

// Chuẩn hóa tiếng Việt không dấu, chữ thường, xử lý đ/Đ và khoảng trắng (SEARCH-04)
export const normalizeVietnameseText = (raw = '') =>
  String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Tách các từ dẫn tự nhiên ("tìm phim", "bộ phim", "xem phim", "phim") nếu còn từ khóa phía sau
export const extractMovieSearchQuery = (raw = '') => {
  const norm = normalizeVietnameseText(raw);
  if (!norm) return '';
  const stripped = norm.replace(/^(?:tim\s+phim|bo\s+phim|xem\s+phim|phim)\s+/i, '').trim();
  return stripped || norm;
};

// Lấy danh sách phim (kèm lọc theo trạng thái / thể loại / tìm kiếm tiếng Việt không dấu)
export const getMovies = async (req, res) => {
  try {
    const { status, genre, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    const rawMovies = await Movie.find(filter).sort({ releaseDate: -1 }).lean();
    const normGenre = genre ? normalizeVietnameseText(genre) : '';
    const normSearch = search ? extractMovieSearchQuery(search) : '';
    const searchTokens = normSearch ? normSearch.split(' ').filter(Boolean) : [];

    // Lọc theo thể loại & tìm kiếm tiếng Việt có/không dấu + xếp hạng độ khớp
    const scoredMovies = [];
    for (const m of rawMovies) {
      if (normGenre && normGenre !== 'tat ca') {
        const mGenreNorm = normalizeVietnameseText(m.genre);
        if (!mGenreNorm.includes(normGenre)) continue;
      }

      let score = 0;
      if (normSearch) {
        const titleNorm = normalizeVietnameseText(m.title);
        const slugNorm = normalizeVietnameseText((m.slug || '').replace(/-/g, ' '));
        const genreNorm = normalizeVietnameseText(m.genre);
        const descNorm = normalizeVietnameseText(m.description);
        const castNorm = normalizeVietnameseText(
          Array.isArray(m.cast) ? m.cast.map((c) => (typeof c === 'string' ? c : c?.name || '')).join(' ') : ''
        );

        if (titleNorm === normSearch || slugNorm === normSearch) score = 100;
        else if (titleNorm.startsWith(normSearch) || slugNorm.startsWith(normSearch)) score = 80;
        else if (titleNorm.includes(normSearch) || slugNorm.includes(normSearch)) score = 60;
        else if (searchTokens.length > 1 && searchTokens.every((t) => titleNorm.includes(t) || slugNorm.includes(t))) score = 50;
        else if (genreNorm.includes(normSearch) || castNorm.includes(normSearch)) score = 30;
        else if (descNorm.includes(normSearch)) score = 15;
        else continue;
      }
      scoredMovies.push({ movie: m, score });
    }

    if (normSearch) {
      scoredMovies.sort((a, b) => b.score - a.score);
    }

    const movies = scoredMovies.map((item) => item.movie);
    const movieIds = movies.map((m) => m._id);

    // Tối ưu N+1: Gọi song song 2 truy vấn hàng loạt thay vì 55 truy vấn rời rạc
    const [allShowtimes, allRooms] = movieIds.length
      ? await Promise.all([
          Showtime.find({ movieId: { $in: movieIds }, cancelledAt: null })
            .sort({ startTime: 1 })
            .select('_id movieId startTime endTime cleaningMinutes cleaningEndTime lifecycleStatus roomId roomName formatFeature price')
            .lean(),
          Room.find({}).select('_id name roomType formatFeature totalSeats').lean(),
        ])
      : [[], []];

    const roomById = new Map(allRooms.map((r) => [String(r._id), r]));
    const showtimesByMovie = new Map();
    const allShowtimeIds = [];
    for (const st of allShowtimes) {
      const mKey = String(st.movieId);
      const roomDoc = st.roomId ? roomById.get(String(st.roomId)) || null : null;
      const hydrated = { ...st, roomId: roomDoc };
      if (!showtimesByMovie.has(mKey)) showtimesByMovie.set(mKey, []);
      showtimesByMovie.get(mKey).push(hydrated);
      allShowtimeIds.push(st._id);
    }

    // Gom toàn bộ Booking PAID cho tất cả showtime trong 1 truy vấn duy nhất
    const allBookings = allShowtimeIds.length
      ? await Booking.find({
          showtimeId: { $in: allShowtimeIds },
          status: 'PAID',
          paymentStatus: { $in: ['VERIFIED', 'SIMULATED'] },
        })
          .select('showtimeId seats totalAmount paymentStatus')
          .lean()
      : [];

    const bookingsByShowtime = new Map();
    for (const b of allBookings) {
      const sKey = String(b.showtimeId);
      if (!bookingsByShowtime.has(sKey)) bookingsByShowtime.set(sKey, []);
      bookingsByShowtime.get(sKey).push(b);
    }

    const now = new Date();
    const moviesWithShowtimes = movies.map((m) => {
      const showtimes = showtimesByMovie.get(String(m._id)) || [];

      // Nhận diện chuẩn theo enum room.roomType của 3 loại phòng và chỉ mở bán các suất chưa qua giờ bắt đầu (UPCOMING)
      const cleanShowtimes = showtimes.filter((st) => {
        if (!ACTIVE_CINEMA_ROOM_TYPES.includes(resolveCanonicalRoomType(st))) return false;
        const lc = computeShowtimeLifecycle({ ...st, movieDuration: m.duration }, now);
        return lc.lifecycleStatus === 'UPCOMING';
      });

      const formattedShowtimes = cleanShowtimes.map((st) => {
        const startTimeDate = new Date(st.startTime);
        const timeStr = startTimeDate.toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const dateStr = startTimeDate.toLocaleDateString('sv-SE', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const canonicalRoomType = resolveCanonicalRoomType(st);
        return {
          id: st._id.toString(),
          date: dateStr,
          time: timeStr,
          roomId: st.roomId?._id?.toString() || null,
          roomName: st.roomId?.name || st.roomName || 'Phòng IMAX Laser',
          roomType: canonicalRoomType,
          format: st.formatFeature || st.roomId?.formatFeature || canonicalRoomType,
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

        const rA = ACTIVE_CINEMA_ROOM_TYPES.indexOf(a.roomType);
        const rB = ACTIVE_CINEMA_ROOM_TYPES.indexOf(b.roomType);
        return (rA === -1 ? 99 : rA) - (rB === -1 ? 99 : rB);
      });

      // Tìm suất 19:30 thuộc công nghệ IMAX Laser làm firstShowtimeId
      const primeImax = formattedShowtimes.find(
        (st) => st.time === '19:30' && st.roomType === ROOM_TYPES_ENUM.IMAX_LASER
      );
      const resolvedFirstId = primeImax ? primeImax.id : (formattedShowtimes[0]?.id || null);

      const spec = resolveMovieFormatSpec(m);
      let revenue = 0;
      let ticketsSold = 0;
      for (const st of showtimes) {
        const stBookings = bookingsByShowtime.get(String(st._id)) || [];
        for (const booking of stBookings) {
          if (booking.paymentStatus === 'VERIFIED') revenue += booking.totalAmount || 0;
          ticketsSold += (booking.seats || '').split(',').filter((seat) => seat.trim()).length;
        }
      }
      const statsAndReviews = {
        stats: { revenue, revenueText: Math.round(revenue / 1000000) + ' triệu', ticketsSold, seatsBooked: ticketsSold },
        analytics: null,
        ...summarizeReviews(m.reviews),
      };

      return {
        ...m,
        ...spec,
        ...statsAndReviews,
        externalRating: Number.isFinite(Number(m.rating)) ? Number(m.rating) : null,
        id: m._id.toString(),
        firstShowtimeId: resolvedFirstId,
        showtimes: formattedShowtimes,
        _count: { showtimes: formattedShowtimes.length },
      };
    });

    // Chỉ áp dụng sắp xếp ưu tiên mặc định khi KHÔNG có từ khóa tìm kiếm (tránh ghi đè thứ tự khớp tên chính xác)
    if (!normSearch) {
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
    }

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
    const movie = await Movie.findOne(query).select('releaseDate duration').lean();
    if (!movie) return res.sendStatus(404);

    const localRelease = movie.releaseDate?.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const rawShowtimes = localRelease && date < localRelease
      ? [] : await Showtime.find({
      movieId: movie._id,
      startTime: { $gte: start, $lt: new Date(start.getTime() + dayMs) },
      cancelledAt: null,
      isLocked: { $ne: true },
    }).populate('roomId', 'name roomType formatFeature totalSeats')
      .populate('cinemaId', 'name address')
      .sort({ startTime: 1 }).lean();

    const now = new Date();
    const completedUpdateIds = [];
    const showtimes = rawShowtimes.filter((st) => {
      const lifecycle = computeShowtimeLifecycle({ ...st, movieDuration: movie.duration }, now);
      if (lifecycle.lifecycleStatus === 'COMPLETED' && st.lifecycleStatus !== 'COMPLETED') {
        completedUpdateIds.push(st._id);
      }
      // Suất đã qua giờ bắt đầu (NOW_SHOWING, CLEANING, COMPLETED) không còn mở bán vé cho khách hàng
      return lifecycle.lifecycleStatus === 'UPCOMING';
    });

    if (completedUpdateIds.length > 0) {
      Showtime.updateMany(
        { _id: { $in: completedUpdateIds } },
        { $set: { lifecycleStatus: 'COMPLETED' } }
      ).catch(() => {});
    }

    const ids = showtimes.map(({ _id }) => _id);
    const [countsByShowtime, cinema] = await Promise.all([
      ShowtimeSeat.aggregate([
        { $match: { showtimeId: { $in: ids } } },
        {
          $group: {
            _id: '$showtimeId',
            total: { $sum: 1 },
            booked: { $sum: { $cond: [{ $eq: ['$status', 'BOOKED'] }, 1, 0] } },
            holding: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'HOLDING'] },
                      { $gt: ['$holdExpiresAt', now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            available: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$status', 'AVAILABLE'] },
                      {
                        $and: [
                          { $eq: ['$status', 'HOLDING'] },
                          {
                            $or: [
                              { $eq: ['$holdExpiresAt', null] },
                              { $lte: ['$holdExpiresAt', now] },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Cinema.findOne().sort({ isFlagship: -1, _id: 1 }).select('name address').lean(),
    ]);
    const counts = new Map(countsByShowtime.map(row => [String(row._id), row]));

    res.set('Cache-Control', 'no-store');
    return res.json({
      cinema: showtimes.find(slot => slot.cinemaId)?.cinemaId ?? cinema,
      showtimes: showtimes.map(({ _id, roomId, roomName, cinemaId, startTime, endTime, price, isLocked, formatFeature }) => {
        const row = counts.get(String(_id));
        const availableSeats = row?.available ?? null;
        const totalSeats = row?.total ?? roomId?.totalSeats ?? null;
        return {
          id: String(_id), roomId: roomId?._id ?? null, roomName: roomId?.name ?? roomName,
          roomType: roomId?.roomType, roomFeature: roomId?.formatFeature,
          cinemaName: cinemaId?.name, startTime, endTime, price, isLocked, formatFeature,
          availableSeats,
          holdingSeats: row?.holding ?? 0,
          bookedSeats: row?.booked ?? 0,
          totalSeats,
          isSoldOut: availableSeats === 0,
        };
      }),
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

    const now = new Date();
    const activeBookingShowtimes = showtimes.filter((st) => {
      if (st.cancelledAt || st.isLocked) return false;
      const lc = computeShowtimeLifecycle({ ...st, movieDuration: movie.duration }, now);
      return lc.lifecycleStatus === 'UPCOMING';
    });

    const formattedShowtimes = activeBookingShowtimes.map((st) => ({
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
    const currentUserId = req.user?._id || null;
    const [statsAndReviews, viewerEligibility] = await Promise.all([
      resolveMovieStatsAndReviews(movie, showtimes, currentUserId),
      resolveViewerMovieEligibility(movie._id, currentUserId, movie.reviews),
    ]);

    res.json({
      ...movie,
      ...spec,
      ...statsAndReviews,
      viewerEligibility,
      externalRating: Number.isFinite(Number(movie.rating)) ? Number(movie.rating) : null,
      id: movie._id.toString(),
      showtimes: formattedShowtimes,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin chi tiết phim', error: error.message });
  }
};

const findMovieQueryByParam = (id) => (mongoose.isObjectIdOrHexString(id) ? { _id: id } : { slug: id });
const sanitizeCommentText = (text) => (typeof text === 'string' ? text.replace(/[<>]/g, '').trim() : '');

// Đồng bộ luôn rating, ratingCount, ratingBreakdown xuống document Movie trong MongoDB sau mọi thay đổi đánh giá
const syncMovieRatingFields = async (movieId, summary) => {
  if (!movieId || !summary) return;
  await Movie.updateOne(
    { _id: movieId },
    {
      $set: {
        rating: summary.rating,
        ratingCount: summary.ratingCount,
        ratingBreakdown: summary.ratingBreakdown,
      },
    }
  ).catch(() => {});
};

// Khách hàng đăng bình luận thông thường (mọi tài khoản đăng nhập) HOẶC đánh giá sao (chỉ tài khoản đã xem phim)
export const addMovieReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const sanitizedComment = sanitizeCommentText(comment);
    const hasRating = rating !== undefined && rating !== null && rating !== '';

    if (!sanitizedComment || sanitizedComment.length > 2000) {
      return res.status(400).json({ message: 'Vui lòng nhập nội dung bình luận hợp lệ (tối đa 2000 ký tự).' });
    }
    if (hasRating && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Điểm đánh giá phải là số nguyên từ 1 đến 5 sao.' });
    }

    const movie = await Movie.findOne(findMovieQueryByParam(id)).select('_id reviews');
    if (!movie) return res.sendStatus(404);

    const eligibility = await resolveViewerMovieEligibility(movie._id, req.user._id, movie.reviews);

    if (hasRating) {
      if (!eligibility.hasWatchedMovie) {
        return res.status(403).json({
          message: 'Chỉ tài khoản đã soát vé xem phim này mới được đánh giá sao.',
        });
      }

      // Mỗi khách hàng chỉ có 1 đánh giá sao có hiệu lực cho mỗi phim — cập nhật đánh giá sao hiện có (giữ nguyên likes & replies)
      const existingUpdated = await Movie.findOneAndUpdate(
        {
          _id: movie._id,
          reviews: {
            $elemMatch: {
              userId: req.user._id,
              verifiedAttendance: true,
              isDemo: { $ne: true },
              rating: { $gte: 1, $lte: 5 },
            },
          },
        },
        {
          $set: {
            'reviews.$.rating': rating,
            'reviews.$.comment': sanitizedComment,
            'reviews.$.userName': req.user.name,
            'reviews.$.updatedAt': new Date(),
          },
        },
        { returnDocument: 'after' }
      ).select('reviews');

      if (existingUpdated) {
        const updatedReview = existingUpdated.reviews.find(
          (r) =>
            !r.isDemo &&
            r.verifiedAttendance &&
            String(r.userId) === String(req.user._id) &&
            Number.isInteger(r.rating)
        );
        const summary = summarizeReviews(existingUpdated.reviews, req.user._id);
        await syncMovieRatingFields(movie._id, summary);
        const nextEligibility = await resolveViewerMovieEligibility(movie._id, req.user._id, existingUpdated.reviews);
        return res.status(200).json({
          ...summary,
          viewerEligibility: nextEligibility,
          review: updatedReview,
          updated: true,
        });
      }

      const review = {
        _id: new mongoose.Types.ObjectId(),
        userName: req.user.name,
        userId: req.user._id,
        rating,
        comment: sanitizedComment,
        likes: [],
        replies: [],
        createdAt: new Date(),
        verifiedAttendance: true,
        hasBookedTicket: true,
        isDemo: false,
      };
      const updated = await Movie.findOneAndUpdate(
        {
          _id: movie._id,
          reviews: {
            $not: {
              $elemMatch: {
                userId: req.user._id,
                verifiedAttendance: true,
                isDemo: { $ne: true },
                rating: { $gte: 1, $lte: 5 },
              },
            },
          },
        },
        { $push: { reviews: { $each: [review], $position: 0 } } },
        { returnDocument: 'after' }
      ).select('reviews');
      if (!updated) return res.status(409).json({ message: 'Bạn đã đánh giá phim này.' });
      const summary = summarizeReviews(updated.reviews, req.user._id);
      await syncMovieRatingFields(movie._id, summary);
      const nextEligibility = await resolveViewerMovieEligibility(movie._id, req.user._id, updated.reviews);
      return res.status(201).json({
        ...summary,
        viewerEligibility: nextEligibility,
        review,
      });
    }

    // Bình luận thông thường (không đánh giá sao): mọi tài khoản đăng nhập đều có thể đăng nhiều bình luận
    const plainComment = {
      _id: new mongoose.Types.ObjectId(),
      userName: req.user.name,
      userId: req.user._id,
      rating: null,
      comment: sanitizedComment,
      likes: [],
      replies: [],
      createdAt: new Date(),
      verifiedAttendance: eligibility.hasWatchedMovie,
      hasBookedTicket: eligibility.hasBookedTicket,
      isDemo: false,
    };
    const updated = await Movie.findOneAndUpdate(
      { _id: movie._id },
      { $push: { reviews: { $each: [plainComment], $position: 0 } } },
      { returnDocument: 'after' }
    ).select('reviews');
    if (!updated) return res.sendStatus(404);
    const nextEligibility = await resolveViewerMovieEligibility(movie._id, req.user._id, updated.reviews);
    return res.status(201).json({
      ...summarizeReviews(updated.reviews, req.user._id),
      viewerEligibility: nextEligibility,
      review: plainComment,
    });
  } catch (error) {
    console.error('Review write failed:', error.name);
    return res.status(500).json({ message: 'Không lưu được bình luận.' });
  }
};

// Chỉnh sửa bình luận / đánh giá của chính khách hàng (kiểm tra quyền sở hữu ở Backend)
export const updateMovieReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    if (!mongoose.isObjectIdOrHexString(reviewId)) return res.sendStatus(400);
    const sanitizedComment = sanitizeCommentText(req.body?.comment);
    if (!sanitizedComment || sanitizedComment.length > 2000) {
      return res.status(400).json({ message: 'Nội dung bình luận không hợp lệ.' });
    }

    const movie = await Movie.findOne(findMovieQueryByParam(id)).select('_id reviews');
    if (!movie) return res.sendStatus(404);

    const target = movie.reviews.find((r) => String(r._id) === String(reviewId));
    if (!target) return res.sendStatus(404);
    if (!target.userId || String(target.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Bạn chỉ có thể chỉnh sửa bình luận của chính mình.' });
    }

    const setFields = {
      'reviews.$.comment': sanitizedComment,
      'reviews.$.updatedAt': new Date(),
    };

    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'rating')) {
      const nextRating = req.body.rating;
      if (nextRating === null || nextRating === '') {
        setFields['reviews.$.rating'] = null;
      } else {
        if (!Number.isInteger(nextRating) || nextRating < 1 || nextRating > 5) {
          return res.status(400).json({ message: 'Điểm đánh giá phải từ 1 đến 5 sao.' });
        }
        const eligibility = await resolveViewerMovieEligibility(movie._id, req.user._id, movie.reviews);
        if (!eligibility.hasWatchedMovie) {
          return res.status(403).json({ message: 'Chỉ tài khoản đã xem phim mới được đánh giá sao.' });
        }
        const anotherRated = movie.reviews.find(
          (r) =>
            String(r._id) !== String(reviewId) &&
            !r.isDemo &&
            r.verifiedAttendance &&
            String(r.userId) === String(req.user._id) &&
            Number.isInteger(r.rating) &&
            r.rating >= 1 &&
            r.rating <= 5
        );
        if (anotherRated) {
          return res.status(409).json({ message: 'Mỗi khách hàng chỉ có một đánh giá sao có hiệu lực cho mỗi phim.' });
        }
        setFields['reviews.$.rating'] = nextRating;
        setFields['reviews.$.verifiedAttendance'] = true;
      }
    }

    const updated = await Movie.findOneAndUpdate(
      { _id: movie._id, reviews: { $elemMatch: { _id: new mongoose.Types.ObjectId(reviewId), userId: req.user._id } } },
      { $set: setFields },
      { returnDocument: 'after' }
    ).select('reviews');
    if (!updated) return res.sendStatus(404);

    const summary = summarizeReviews(updated.reviews, req.user._id);
    await syncMovieRatingFields(movie._id, summary);
    const nextEligibility = await resolveViewerMovieEligibility(movie._id, req.user._id, updated.reviews);
    return res.json({
      success: true,
      ...summary,
      viewerEligibility: nextEligibility,
    });
  } catch (error) {
    console.error('Review update failed:', error.name);
    return res.status(500).json({ message: 'Không thể cập nhật bình luận.' });
  }
};

export const deleteMovieReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    if (!mongoose.isObjectIdOrHexString(reviewId)) return res.sendStatus(400);
    const movieQuery = findMovieQueryByParam(id);
    const reviewFilter = { _id: new mongoose.Types.ObjectId(reviewId), userId: req.user._id };
    const updated = await Movie.findOneAndUpdate(
      { ...movieQuery, reviews: { $elemMatch: reviewFilter } },
      { $pull: { reviews: reviewFilter } },
      { returnDocument: 'after' }
    ).select('_id reviews');
    if (!updated) return res.sendStatus(404);
    const summary = summarizeReviews(updated.reviews, req.user._id);
    await syncMovieRatingFields(updated._id, summary);
    const nextEligibility = await resolveViewerMovieEligibility(updated._id, req.user._id, updated.reviews);
    return res.json({
      success: true,
      ...summary,
      viewerEligibility: nextEligibility,
    });
  } catch (error) {
    console.error('Review removal failed:', error.name);
    return res.status(500).json({ message: 'Không xóa được đánh giá.' });
  }
};

// Thích / bỏ thích bình luận (mỗi tài khoản tối đa 1 lượt thích trên mỗi bình luận)
export const toggleLikeMovieReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    if (!mongoose.isObjectIdOrHexString(reviewId)) return res.sendStatus(400);

    const movie = await Movie.findOne(findMovieQueryByParam(id)).select('_id reviews');
    if (!movie) return res.sendStatus(404);

    const target = movie.reviews.find((r) => String(r._id) === String(reviewId));
    if (!target) return res.sendStatus(404);

    const alreadyLiked = Array.isArray(target.likes) && target.likes.some((uid) => String(uid) === String(req.user._id));
    const updateOp = alreadyLiked
      ? { $pull: { 'reviews.$.likes': req.user._id } }
      : { $addToSet: { 'reviews.$.likes': req.user._id } };

    const updated = await Movie.findOneAndUpdate(
      { _id: movie._id, 'reviews._id': new mongoose.Types.ObjectId(reviewId) },
      updateOp,
      { returnDocument: 'after' }
    ).select('reviews');
    if (!updated) return res.sendStatus(404);

    return res.json({
      success: true,
      liked: !alreadyLiked,
      ...summarizeReviews(updated.reviews, req.user._id),
    });
  } catch (error) {
    console.error('Review like toggle failed:', error.name);
    return res.status(500).json({ message: 'Không thể cập nhật lượt thích.' });
  }
};

// Trả lời một bình luận cha (lưu trực tiếp trong MongoDB, liên kết đúng reviewId)
export const addMovieReviewReply = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    if (!mongoose.isObjectIdOrHexString(reviewId)) return res.sendStatus(400);
    const sanitizedComment = sanitizeCommentText(req.body?.comment);
    if (!sanitizedComment || sanitizedComment.length > 1500) {
      return res.status(400).json({ message: 'Vui lòng nhập nội dung phản hồi hợp lệ (tối đa 1500 ký tự).' });
    }

    const movie = await Movie.findOne(findMovieQueryByParam(id)).select('_id reviews');
    if (!movie) return res.sendStatus(404);

    const eligibility = await resolveViewerMovieEligibility(movie._id, req.user._id, movie.reviews);
    const reply = {
      _id: new mongoose.Types.ObjectId(),
      userId: req.user._id,
      userName: req.user.name,
      comment: sanitizedComment,
      verifiedAttendance: eligibility.hasWatchedMovie,
      hasBookedTicket: eligibility.hasBookedTicket,
      isDemo: false,
      likes: [],
      createdAt: new Date(),
    };

    const updated = await Movie.findOneAndUpdate(
      { _id: movie._id, 'reviews._id': new mongoose.Types.ObjectId(reviewId) },
      { $push: { 'reviews.$.replies': reply } },
      { returnDocument: 'after' }
    ).select('reviews');
    if (!updated) return res.sendStatus(404);

    return res.status(201).json({
      success: true,
      reply,
      ...summarizeReviews(updated.reviews, req.user._id),
    });
  } catch (error) {
    console.error('Reply write failed:', error.name);
    return res.status(500).json({ message: 'Không thể gửi phản hồi.' });
  }
};

// Thích / bỏ thích một phản hồi
export const toggleLikeMovieReviewReply = async (req, res) => {
  try {
    const { id, reviewId, replyId } = req.params;
    if (!mongoose.isObjectIdOrHexString(reviewId) || !mongoose.isObjectIdOrHexString(replyId)) {
      return res.sendStatus(400);
    }

    const movie = await Movie.findOne(findMovieQueryByParam(id)).select('_id reviews');
    if (!movie) return res.sendStatus(404);

    const parent = movie.reviews.find((r) => String(r._id) === String(reviewId));
    const reply = parent?.replies?.find((rep) => String(rep._id) === String(replyId));
    if (!reply) return res.sendStatus(404);

    const alreadyLiked = Array.isArray(reply.likes) && reply.likes.some((uid) => String(uid) === String(req.user._id));
    const updateOp = alreadyLiked
      ? { $pull: { 'reviews.$[rev].replies.$[rep].likes': req.user._id } }
      : { $addToSet: { 'reviews.$[rev].replies.$[rep].likes': req.user._id } };

    const updated = await Movie.findOneAndUpdate(
      { _id: movie._id },
      updateOp,
      {
        arrayFilters: [
          { 'rev._id': new mongoose.Types.ObjectId(reviewId) },
          { 'rep._id': new mongoose.Types.ObjectId(replyId) },
        ],
        returnDocument: 'after',
      }
    ).select('reviews');
    if (!updated) return res.sendStatus(404);

    return res.json({
      success: true,
      liked: !alreadyLiked,
      ...summarizeReviews(updated.reviews, req.user._id),
    });
  } catch (error) {
    console.error('Reply like toggle failed:', error.name);
    return res.status(500).json({ message: 'Không thể cập nhật lượt thích phản hồi.' });
  }
};

// Xóa phản hồi của chính khách hàng
export const deleteMovieReviewReply = async (req, res) => {
  try {
    const { id, reviewId, replyId } = req.params;
    if (!mongoose.isObjectIdOrHexString(reviewId) || !mongoose.isObjectIdOrHexString(replyId)) {
      return res.sendStatus(400);
    }

    const updated = await Movie.findOneAndUpdate(
      {
        ...findMovieQueryByParam(id),
        reviews: {
          $elemMatch: {
            _id: new mongoose.Types.ObjectId(reviewId),
            replies: { $elemMatch: { _id: new mongoose.Types.ObjectId(replyId), userId: req.user._id } },
          },
        },
      },
      {
        $pull: {
          'reviews.$.replies': { _id: new mongoose.Types.ObjectId(replyId), userId: req.user._id },
        },
      },
      { returnDocument: 'after' }
    ).select('reviews');
    if (!updated) return res.sendStatus(404);

    return res.json({
      success: true,
      ...summarizeReviews(updated.reviews, req.user._id),
    });
  } catch (error) {
    console.error('Reply removal failed:', error.name);
    return res.status(500).json({ message: 'Không thể xóa phản hồi.' });
  }
};

// Báo cáo bình luận của người khác
export const reportMovieReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    if (!mongoose.isObjectIdOrHexString(reviewId)) return res.sendStatus(400);
    const reason = sanitizeCommentText(req.body?.reason) || 'Nội dung không phù hợp';

    const movie = await Movie.findOne(findMovieQueryByParam(id)).select('_id reviews');
    if (!movie) return res.sendStatus(404);

    const target = movie.reviews.find((r) => String(r._id) === String(reviewId));
    if (!target) return res.sendStatus(404);
    if (target.userId && String(target.userId) === String(req.user._id)) {
      return res.status(400).json({ message: 'Bạn không thể tự báo cáo bình luận của mình.' });
    }

    const alreadyReported = Array.isArray(target.reports) && target.reports.some((rep) => String(rep.userId) === String(req.user._id));
    if (!alreadyReported) {
      await Movie.updateOne(
        { _id: movie._id, 'reviews._id': new mongoose.Types.ObjectId(reviewId) },
        {
          $push: {
            'reviews.$.reports': {
              userId: req.user._id,
              reason: reason.slice(0, 300),
              createdAt: new Date(),
            },
          },
        }
      );
    }

    return res.json({
      success: true,
      message: alreadyReported
        ? 'Bạn đã báo cáo bình luận này trước đó.'
        : 'Đã ghi nhận báo cáo bình luận. Cảm ơn bạn đã phản hồi.',
    });
  } catch (error) {
    console.error('Review report failed:', error.name);
    return res.status(500).json({ message: 'Không thể gửi báo cáo bình luận.' });
  }
};
