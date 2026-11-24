import mongoose from 'mongoose';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import Booking from '../models/Booking.js';
import Cinema from '../models/Cinema.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import { normalizeSeatCode, paidSeatCodes } from './showtimeController.js';
import { ensure3DShowtimesSynced } from './cinemaController.js';

let hasSyncedMovieFormats = false;

// Hàm phân tích và tính toán thống kê, đánh giá đồng bộ cho từng bộ phim
export const resolveMovieStatsAndReviews = async (movie, showtimes = []) => {
  const showtimeIds = showtimes.map((st) => st._id || st.id);

  let realRevenue = 0;
  let realTickets = 0;

  if (showtimeIds.length > 0) {
    try {
      const paidBookings = await Booking.find({
        showtimeId: { $in: showtimeIds },
        status: 'PAID',
      }).select('totalAmount seats').lean();

      for (const b of paidBookings) {
        realRevenue += b.totalAmount || 0;
        const seatCount = b.seats ? b.seats.split(',').filter(Boolean).length : 1;
        realTickets += seatCount;
      }
    } catch (e) {
      console.warn('Không thể gom nhóm bookings cho stats phim:', e.message);
    }
  }

  const titleLower = (movie.title || '').toLowerCase();

  // Mẫu đánh giá và thông số chuẩn theo từng phim
  let baseRevenue = 125000000;
  let baseTickets = 850;
  let baseAvailable = 150;
  let baseRating = 4.6;
  let baseCount = 120;
  let baseBreakdown = {
    fiveStar: 90,
    fourStar: 20,
    threeStar: 7,
    twoStar: 2,
    oneStar: 1,
  };
  let baseReviews = [
    {
      userName: 'Nguyễn Văn A',
      rating: 5,
      comment: 'Hình ảnh đẹp, âm thanh sống động, nội dung rất cuốn hút.',
      createdAt: new Date(Date.now() - 3600000 * 24 * 2),
    },
    {
      userName: 'Trần Thị B',
      rating: 4,
      comment: 'Phim hay, kỹ xảo tốt nhưng thời lượng hơi dài.',
      createdAt: new Date(Date.now() - 3600000 * 24 * 5),
    },
  ];

  if (titleLower.includes('mai')) {
    baseRevenue = 168000000;
    baseTickets = 1150;
    baseAvailable = 90;
    baseRating = 4.8;
    baseCount = 210;
    baseBreakdown = { fiveStar: 165, fourStar: 33, threeStar: 8, twoStar: 3, oneStar: 1 };
    baseReviews = [
      {
        userName: 'Lê Phương Thảo',
        rating: 5,
        comment: 'Phim quá cảm xúc, diễn xuất của Phương Anh Đào và Tuấn Trần chạm đến trái tim.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 1),
      },
      {
        userName: 'Nguyễn Văn A',
        rating: 5,
        comment: 'Hình ảnh đẹp, âm thanh sống động, nội dung rất cuốn hút.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 3),
      },
      {
        userName: 'Trần Thị B',
        rating: 4,
        comment: 'Phim tình cảm sâu sắc, nhiều phân đoạn lấy nước mắt khán giả.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 6),
      },
    ];
  } else if (titleLower.includes('dune')) {
    baseRevenue = 135000000;
    baseTickets = 910;
    baseAvailable = 140;
    baseRating = 4.9;
    baseCount = 154;
    baseBreakdown = { fiveStar: 120, fourStar: 24, threeStar: 7, twoStar: 2, oneStar: 1 };
    baseReviews = [
      {
        userName: 'Nguyễn Văn A',
        rating: 5,
        comment: 'Hình ảnh đẹp, âm thanh sống động, nội dung rất cuốn hút.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 2),
      },
      {
        userName: 'Trần Thị B',
        rating: 4,
        comment: 'Phim hay, kỹ xảo tốt nhưng thời lượng hơi dài.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 4),
      },
      {
        userName: 'Đặng Minh Khôi',
        rating: 5,
        comment: 'Âm thanh Hans Zimmer rung chuyển cả phòng chiếu, siêu phẩm điện ảnh năm nay!',
        createdAt: new Date(Date.now() - 3600000 * 24 * 7),
      },
    ];
  } else if (titleLower.includes('godzilla')) {
    baseRevenue = 140000000;
    baseTickets = 950;
    baseAvailable = 130;
    baseRating = 4.6;
    baseCount = 135;
    baseBreakdown = { fiveStar: 98, fourStar: 26, threeStar: 8, twoStar: 2, oneStar: 1 };
    baseReviews = [
      {
        userName: 'Vũ Đình Nam',
        rating: 5,
        comment: 'Các phân cảnh đấm nhau giữa Kong và Godzilla mãn nhãn cực kỳ, âm thanh rung chuyển rạp!',
        createdAt: new Date(Date.now() - 3600000 * 24 * 2),
      },
      {
        userName: 'Trần Thị B',
        rating: 4,
        comment: 'Phim hay, kỹ xảo tốt nhưng thời lượng hơi dài.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 5),
      },
      {
        userName: 'Nguyễn Văn A',
        rating: 5,
        comment: 'Hình ảnh đẹp, âm thanh sống động, nội dung rất cuốn hút.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 7),
      },
    ];
  } else if (titleLower.includes('panda')) {
    baseRevenue = 112000000;
    baseTickets = 820;
    baseAvailable = 160;
    baseRating = 4.7;
    baseCount = 128;
    baseBreakdown = { fiveStar: 95, fourStar: 23, threeStar: 7, twoStar: 2, oneStar: 1 };
    baseReviews = [
      {
        userName: 'Nguyễn Bảo Anh',
        rating: 5,
        comment: 'Po vẫn hài hước và dễ thương như ngày nào. Cả gia đình mình xem cười nghiêng ngả!',
        createdAt: new Date(Date.now() - 3600000 * 24 * 1),
      },
      {
        userName: 'Nguyễn Văn A',
        rating: 5,
        comment: 'Hình ảnh đẹp, âm thanh sống động, nội dung rất cuốn hút.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 3),
      },
      {
        userName: 'Trần Thị B',
        rating: 4,
        comment: 'Phim vui nhộn, đồ họa rực rỡ, rất thích hợp xem cùng gia đình.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 6),
      },
    ];
  } else if (titleLower.includes('oppenheimer')) {
    baseRevenue = 155000000;
    baseTickets = 980;
    baseAvailable = 120;
    baseRating = 4.9;
    baseCount = 180;
    baseBreakdown = { fiveStar: 162, fourStar: 14, threeStar: 3, twoStar: 1, oneStar: 0 };
    baseReviews = [
      {
        userName: 'Trần Quốc Cường',
        rating: 5,
        comment: 'Kiệt tác của Christopher Nolan! Nhạc phim và diễn xuất của Cillian Murphy xuất sắc không tì vết.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 2),
      },
      {
        userName: 'Nguyễn Văn A',
        rating: 5,
        comment: 'Hình ảnh đẹp, âm thanh sống động, nội dung rất cuốn hút.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 4),
      },
      {
        userName: 'Trần Thị B',
        rating: 4,
        comment: 'Phim hay, chiều sâu triết lý cao, xem rất đáng đồng tiền.',
        createdAt: new Date(Date.now() - 3600000 * 24 * 8),
      },
    ];
  }

  // Kết hợp đánh giá của người dùng từ MongoDB nếu có
  const customReviews = Array.isArray(movie.reviews) ? movie.reviews : [];
  const allReviews = [...customReviews, ...baseReviews];

  // Tính toán số liệu thống kê tổng hợp (đồng bộ cho tất cả các bộ phim)
  const totalRevenue = baseRevenue + realRevenue;
  const totalTickets = baseTickets + realTickets;
  const totalSeatsBooked = totalTickets;
  const totalSeatsAvailable = Math.max(20, baseAvailable - realTickets);

  return {
    stats: {
      revenue: totalRevenue,
      revenueText: `${Math.round(totalRevenue / 1000000)} triệu`,
      ticketsSold: totalTickets,
      seatsBooked: totalSeatsBooked,
      seatsAvailable: totalSeatsAvailable,
    },
    rating: movie.rating || baseRating,
    ratingCount: `${baseCount + customReviews.length} lượt đánh giá`,
    ratingBreakdown: movie.ratingBreakdown || baseBreakdown,
    reviews: allReviews,
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
    const showtimes = localRelease && (date < localRelease || date.slice(0, 7) !== localRelease.slice(0, 7))
      ? [] : await Showtime.find({
      movieId: movie._id,
      startTime: { $gte: start, $lt: new Date(start.getTime() + dayMs) },
    }).populate('roomId', 'name roomType formatFeature totalSeats')
      .populate('cinemaId', 'name address')
      .sort({ startTime: 1 }).lean();

    const ids = showtimes.map(({ _id }) => _id);
    const [seats, bookings, cinema] = await Promise.all([
      ShowtimeSeat.find({ showtimeId: { $in: ids } }).select('showtimeId seatNumber').lean(),
      Booking.find({ showtimeId: { $in: ids }, status: 'PAID' }).select('showtimeId seats bookingCode qrToken').lean(),
      Cinema.findOne().sort({ _id: 1 }).select('name address').lean(),
    ]);
    const bookingsByShowtime = new Map();
    for (const booking of bookings) {
      const key = String(booking.showtimeId);
      if (!bookingsByShowtime.has(key)) bookingsByShowtime.set(key, []);
      bookingsByShowtime.get(key).push(booking);
    }
    const sold = new Map([...bookingsByShowtime].map(([key, orders]) => [key, paidSeatCodes(orders)]));

    const counts = new Map();
    for (const seat of seats) {
      const key = String(seat.showtimeId);
      const count = counts.get(key) ?? { total: 0, available: 0 };
      count.total++;
      if (!sold.get(key)?.has(normalizeSeatCode(seat.seatNumber))) count.available++;
      counts.set(key, count);
    }

    res.set('Cache-Control', 'no-store');
    return res.json({
      cinema: showtimes.find(slot => slot.cinemaId)?.cinemaId ?? cinema,
      showtimes: showtimes.map(({ _id, roomId, roomName, cinemaId, startTime, endTime, price, isLocked, formatFeature }) => ({
        id: String(_id), roomId: roomId?._id ?? null, roomName: roomId?.name ?? roomName,
        roomType: roomId?.roomType, roomFeature: roomId?.formatFeature,
        cinemaName: cinemaId?.name, startTime, endTime, price, isLocked, formatFeature,
        availableSeats: counts.get(String(_id))?.available ?? (roomId?.totalSeats > 0
          ? Math.max(0, roomId.totalSeats - (sold.get(String(_id))?.size ?? 0)) : null),
        totalSeats: counts.get(String(_id))?.total ?? roomId?.totalSeats ?? null,
      })),
    });
  } catch {
    return res.sendStatus(500);
  }
};

export const getMovieById = async (req, res) => {
  try {
    if (req.query?.schedule !== 'read-only') await ensureMovieFormatsClean();
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
    const { userName, rating, comment, userId, userEmail } = req.body;

    if (!userName || !userName.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tên người đánh giá' });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập nội dung nhận xét' });
    }

    const star = Math.min(5, Math.max(1, Number(rating) || 5));

    let movie = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      movie = await Movie.findById(id);
    } else {
      movie = await Movie.findOne({ slug: id });
    }

    if (!movie) {
      return res.status(404).json({ message: 'Không tìm thấy phim yêu cầu' });
    }

    const newReview = {
      userName: userName.trim(),
      userId: userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : undefined,
      userEmail: userEmail ? String(userEmail).trim() : undefined,
      rating: star,
      comment: comment.trim(),
      createdAt: new Date(),
    };

    if (!Array.isArray(movie.reviews)) movie.reviews = [];
    movie.reviews.unshift(newReview);

    // Cập nhật ratingBreakdown
    if (!movie.ratingBreakdown) {
      movie.ratingBreakdown = { fiveStar: 90, fourStar: 20, threeStar: 7, twoStar: 2, oneStar: 1 };
    }
    if (star === 5) movie.ratingBreakdown.fiveStar = (movie.ratingBreakdown.fiveStar || 0) + 1;
    else if (star === 4) movie.ratingBreakdown.fourStar = (movie.ratingBreakdown.fourStar || 0) + 1;
    else if (star === 3) movie.ratingBreakdown.threeStar = (movie.ratingBreakdown.threeStar || 0) + 1;
    else if (star === 2) movie.ratingBreakdown.twoStar = (movie.ratingBreakdown.twoStar || 0) + 1;
    else if (star === 1) movie.ratingBreakdown.oneStar = (movie.ratingBreakdown.oneStar || 0) + 1;

    // Tính điểm trung bình mới
    const totalVotes =
      (movie.ratingBreakdown.fiveStar || 0) +
      (movie.ratingBreakdown.fourStar || 0) +
      (movie.ratingBreakdown.threeStar || 0) +
      (movie.ratingBreakdown.twoStar || 0) +
      (movie.ratingBreakdown.oneStar || 0);

    const weightedScore =
      (movie.ratingBreakdown.fiveStar || 0) * 5 +
      (movie.ratingBreakdown.fourStar || 0) * 4 +
      (movie.ratingBreakdown.threeStar || 0) * 3 +
      (movie.ratingBreakdown.twoStar || 0) * 2 +
      (movie.ratingBreakdown.oneStar || 0) * 1;

    if (totalVotes > 0) {
      movie.rating = Number((weightedScore / totalVotes).toFixed(1));
      movie.ratingCount = `${totalVotes} lượt đánh giá`;
    }

    await movie.save();

    res.status(201).json({
      message: 'Gửi nhận xét thành công',
      review: newReview,
      rating: movie.rating,
      ratingCount: movie.ratingCount,
      ratingBreakdown: movie.ratingBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi nhận xét phim', error: error.message });
  }
};

// Khách hàng xóa bình luận / nhận xét phim nếu viết nhầm
export const deleteMovieReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const { comment, userName } = req.body || {};

    let movie = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      movie = await Movie.findById(id);
    } else {
      movie = await Movie.findOne({ slug: id });
    }

    if (!movie) {
      return res.status(404).json({ message: 'Không tìm thấy phim yêu cầu' });
    }

    if (!Array.isArray(movie.reviews)) movie.reviews = [];

    let removedReview = null;

    if (reviewId && reviewId !== 'by-content' && mongoose.Types.ObjectId.isValid(reviewId)) {
      removedReview = movie.reviews.find((r) => r._id?.toString() === reviewId);
      movie.reviews = movie.reviews.filter((r) => r._id?.toString() !== reviewId);
    } else if (comment) {
      const idx = movie.reviews.findIndex(
        (r) => r.comment === comment && (!userName || r.userName === userName)
      );
      if (idx !== -1) {
        removedReview = movie.reviews[idx];
        movie.reviews.splice(idx, 1);
      }
    } else if (reviewId) {
      const idx = movie.reviews.findIndex((r) => r._id?.toString() === reviewId);
      if (idx !== -1) {
        removedReview = movie.reviews[idx];
        movie.reviews.splice(idx, 1);
      }
    }

    // Cập nhật lại ratingBreakdown nếu có xóa review
    if (removedReview && movie.ratingBreakdown) {
      const star = removedReview.rating || 5;
      if (star === 5) movie.ratingBreakdown.fiveStar = Math.max(0, (movie.ratingBreakdown.fiveStar || 0) - 1);
      else if (star === 4) movie.ratingBreakdown.fourStar = Math.max(0, (movie.ratingBreakdown.fourStar || 0) - 1);
      else if (star === 3) movie.ratingBreakdown.threeStar = Math.max(0, (movie.ratingBreakdown.threeStar || 0) - 1);
      else if (star === 2) movie.ratingBreakdown.twoStar = Math.max(0, (movie.ratingBreakdown.twoStar || 0) - 1);
      else if (star === 1) movie.ratingBreakdown.oneStar = Math.max(0, (movie.ratingBreakdown.oneStar || 0) - 1);

      const totalVotes =
        (movie.ratingBreakdown.fiveStar || 0) +
        (movie.ratingBreakdown.fourStar || 0) +
        (movie.ratingBreakdown.threeStar || 0) +
        (movie.ratingBreakdown.twoStar || 0) +
        (movie.ratingBreakdown.oneStar || 0);

      const weightedScore =
        (movie.ratingBreakdown.fiveStar || 0) * 5 +
        (movie.ratingBreakdown.fourStar || 0) * 4 +
        (movie.ratingBreakdown.threeStar || 0) * 3 +
        (movie.ratingBreakdown.twoStar || 0) * 2 +
        (movie.ratingBreakdown.oneStar || 0) * 1;

      if (totalVotes > 0) {
        movie.rating = Number((weightedScore / totalVotes).toFixed(1));
        movie.ratingCount = `${totalVotes} lượt đánh giá`;
      }
    }

    await movie.save();

    res.json({
      success: true,
      message: 'Đã xóa bình luận thành công',
      reviews: movie.reviews,
      rating: movie.rating,
      ratingCount: movie.ratingCount,
      ratingBreakdown: movie.ratingBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa nhận xét phim', error: error.message });
  }
};
