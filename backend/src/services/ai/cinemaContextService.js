import mongoose from 'mongoose';
import Movie from '../../models/Movie.js';
import Showtime from '../../models/Showtime.js';
import ShowtimeSeat from '../../models/ShowtimeSeat.js';
import Cinema from '../../models/Cinema.js';
import Concession from '../../models/Concession.js';
import Promotion from '../../models/Promotion.js';
import { ensurePricingConfig } from '../pricingConfigService.js';
import { getVNDateParts, getRelativeDayLabel } from './timezoneUtils.js';
import { calculateShowtimePrices, formatVND } from './pricingService.js';

/**
 * Kiểm tra một ghế trong ShowtimeSeat có thực sự đang trống tại thời điểm `nowDate` hay không.
 * - Ghế trống hợp lệ khi:
 *   + status === 'AVAILABLE'
 *   + HOẶC status === 'HOLDING' nhưng holdExpiresAt đã hết hạn (holdExpiresAt < nowDate)
 * - Ghế KHÔNG trống khi:
 *   + status === 'BOOKED'
 *   + HOẶC status === 'HOLDING' và (holdExpiresAt >= nowDate hoặc không có holdExpiresAt)
 */
export const isSeatAvailableAt = (seat, nowDate = new Date()) => {
  if (!seat || typeof seat !== 'object') return false;
  const status = String(seat.status || '').toUpperCase();
  if (status === 'AVAILABLE') return true;
  if (status === 'HOLDING') {
    if (!seat.holdExpiresAt) return false;
    const expiresAt = new Date(seat.holdExpiresAt);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < nowDate.getTime();
  }
  return false;
};

/**
 * Tìm các dãy ghế liền nhau (cùng hàng `row`, số cột `col` liên tiếp) có độ dài >= `requiredCount`.
 * Trả về danh sách các cụm ghế liền nhau tìm được (VD: [['F5', 'F6', 'F7', 'F8'], ...])
 */
export const findContiguousAvailableSeats = (
  seats = [],
  requiredCount = 2,
  nowDate = new Date(),
  preferredSeatType = null
) => {
  const count = Math.max(1, Number(requiredCount) || 1);
  if (!Array.isArray(seats) || seats.length === 0) return [];

  // Lọc danh sách ghế thực sự trống
  const availableSeats = seats.filter((s) => {
    if (!isSeatAvailableAt(s, nowDate)) return false;
    if (preferredSeatType && String(s.type || '').toUpperCase() !== preferredSeatType.toUpperCase()) {
      return false;
    }
    return true;
  });

  if (availableSeats.length < count) return [];

  // Nhóm theo từng hàng ghế (A, B, C, D, E, F, G, H)
  const byRow = new Map();
  for (const s of availableSeats) {
    const row = String(s.row || s.seatNumber?.match(/^[A-Za-z]+/)?.[0] || '').toUpperCase();
    const col =
      Number.isFinite(Number(s.col)) && Number(s.col) > 0
        ? Number(s.col)
        : Number(String(s.seatNumber || '').replace(/^[A-Za-z]+/, ''));

    if (!row || !Number.isFinite(col)) continue;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push({
      seatNumber: s.seatNumber || `${row}${col}`,
      row,
      col,
      type: s.type || 'STANDARD',
    });
  }

  const contiguousBlocks = [];

  // Ưu tiên sắp xếp các hàng trung tâm đẹp trước (E, F, G -> D, C -> B, A -> H)
  const rowPriority = ['F', 'E', 'G', 'D', 'C', 'B', 'A', 'H'];
  const sortedRows = [...byRow.keys()].sort((a, b) => {
    const idxA = rowPriority.indexOf(a);
    const idxB = rowPriority.indexOf(b);
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });

  for (const row of sortedRows) {
    const rowSeats = byRow.get(row).sort((a, b) => a.col - b.col);
    if (rowSeats.length < count) continue;

    // Duyệt cửa sổ trượt để tìm dãy ghế có số cột liên tiếp (col[i+1] - col[i] === 1)
    let streak = [rowSeats[0]];
    for (let i = 1; i < rowSeats.length; i++) {
      if (rowSeats[i].col === rowSeats[i - 1].col + 1) {
        streak.push(rowSeats[i]);
      } else {
        if (streak.length >= count) {
          contiguousBlocks.push(streak.slice(0, count).map((x) => x.seatNumber));
        }
        streak = [rowSeats[i]];
      }
    }
    if (streak.length >= count) {
      contiguousBlocks.push(streak.slice(0, count).map((x) => x.seatNumber));
    }
  }

  return contiguousBlocks;
};

/**
 * Kiểm tra suất chiếu có hợp lệ để tạo link đặt vé `/booking/seat/{showtimeId}` hay không.
 * Yêu cầu bắt buộc:
 * - `showtimeId` tồn tại, hợp lệ và KHÔNG trùng với `movieId`
 * - `startTime > nowDate` (chưa chiếu / chưa hết hạn)
 * - `availableSeats > 0` (chưa hết ghế)
 * - Trạng thái không bị đóng bán (`status !== 'CLOSED'`, `status !== 'CANCELLED'`)
 */
export const isValidShowtimeForBooking = (showtime, movieId = null, nowDate = new Date()) => {
  if (!showtime || typeof showtime !== 'object') return false;

  const stId = String(showtime.showtimeId || showtime._id || '').trim();
  if (!stId) return false;

  // Không bao giờ dùng movieId làm showtimeId
  if (movieId && stId === String(movieId).trim()) {
    return false;
  }

  // Kiểm tra định dạng ObjectId 24 ký tự hex (hoặc chuỗi ID suất chiếu hợp lệ không phải số giả 1, 2)
  if (!/^[a-fA-F0-9]{24}$/.test(stId) && !stId.startsWith('st_')) {
    return false;
  }

  // Kiểm tra trạng thái mở bán
  const stStatus = String(showtime.status || 'OPEN').toUpperCase();
  if (stStatus === 'CLOSED' || stStatus === 'CANCELLED' || stStatus === 'INACTIVE') {
    return false;
  }

  // Kiểm tra thời gian chiếu chưa qua
  if (showtime.startTime) {
    const start = new Date(showtime.startTime);
    if (Number.isNaN(start.getTime()) || start.getTime() <= nowDate.getTime()) {
      return false;
    }
  }

  // Kiểm tra số ghế trống > 0
  const avail = Number(showtime.availableSeats);
  if (!Number.isFinite(avail) || avail <= 0) {
    return false;
  }

  return true;
};

/**
 * Sinh đường dẫn đặt vé hợp lệ hoặc trả về `null` nếu không đủ điều kiện
 */
export const buildValidBookingLink = (showtime, movieId = null, nowDate = new Date()) => {
  if (!isValidShowtimeForBooking(showtime, movieId, nowDate)) {
    return null;
  }
  return `/booking/seat/${String(showtime.showtimeId || showtime._id).trim()}`;
};

/**
 * Kiểm tra khuyến mãi / voucher còn hiệu lực tại thời điểm `nowDate`
 */
export const isPromotionValid = (promo, nowDate = new Date()) => {
  if (!promo || typeof promo !== 'object') return false;

  if (promo.isActive === false) return false;
  const status = String(promo.status || 'ACTIVE').toUpperCase();
  if (status === 'INACTIVE' || status === 'EXPIRED' || status === 'DISABLED') {
    return false;
  }

  const nowMs = nowDate.getTime();

  // Kiểm tra ngày bắt đầu nếu có
  const startRaw = promo.startDate || promo.validFrom;
  if (startRaw) {
    const startMs = new Date(startRaw).getTime();
    if (!Number.isNaN(startMs) && startMs > nowMs) return false;
  }

  // Kiểm tra ngày kết thúc (hỗ trợ cả endDate, expiryDate, validUntil)
  const endRaw = promo.endDate || promo.expiryDate || promo.validUntil;
  if (endRaw) {
    const endMs = new Date(endRaw).getTime();
    if (!Number.isNaN(endMs) && endMs < nowMs) return false;
  }

  return true;
};

/**
 * Chuẩn hóa dữ liệu ngữ cảnh rạp chiếu từ danh sách raw (dùng chung cho cả truy vấn MongoDB thực tế
 * và dữ liệu mock trong Unit Tests).
 *
 * Tuyệt đối:
 * - KHÔNG tự bịa suất chiếu 3D giả
 * - KHÔNG dùng `availableSeatsCount || 42`
 * - KHÔNG gợi ý suất chiếu đã qua (`startTime <= nowDate`)
 * - KHÔNG ghi đè giá vé 45k/50k
 */
export const buildNormalizedCinemaContext = ({
  movies = [],
  showtimes = [],
  seatsByShowtimeId = new Map(),
  cinemas = [],
  concessions = [],
  promotions = [],
  pricingConfig = null,
  nowDate = new Date(),
}) => {
  const cinemaMap = new Map();
  for (const c of cinemas) {
    if (c && c._id) {
      cinemaMap.set(String(c._id), c);
    }
  }

  // Nhóm các suất chiếu hợp lệ (chưa qua giờ chiếu) theo movieId
  const showtimesByMovieId = new Map();

  for (const st of showtimes) {
    if (!st || !st.movieId || !st.startTime) continue;

    const startTime = new Date(st.startTime);
    if (Number.isNaN(startTime.getTime())) continue;

    // 2.4. Loại bỏ hoàn toàn suất chiếu đã qua
    if (startTime.getTime() <= nowDate.getTime()) continue;

    // Kiểm tra trạng thái mở bán của suất chiếu
    const stStatus = String(st.status || 'OPEN').toUpperCase();
    if (stStatus === 'CLOSED' || stStatus === 'CANCELLED') continue;

    const stId = String(st._id || st.showtimeId || '');
    const movieIdStr = String(st.movieId?._id || st.movieId);

    // 2.2. Tính số ghế trống thực tế từ dữ liệu ShowtimeSeat
    const seatInfo = seatsByShowtimeId.get(stId);
    let availableSeats = 0;
    let totalSeats = 88;
    let seatsInitialized = false;
    let rawSeats = [];
    let availableByTier = { STANDARD: 0, VIP: 0, SWEETBOX: 0 };

    if (seatInfo) {
      if (Array.isArray(seatInfo)) {
        // Trường hợp truyền mảng ghế chi tiết
        rawSeats = seatInfo;
        seatsInitialized = rawSeats.length > 0;
        totalSeats = rawSeats.length || 88;
        if (seatsInitialized) {
          availableSeats = 0;
          for (const s of rawSeats) {
            if (isSeatAvailableAt(s, nowDate)) {
              availableSeats += 1;
              const tier = String(s.type || 'STANDARD').toUpperCase();
              if (availableByTier[tier] !== undefined) {
                availableByTier[tier] += 1;
              }
            }
          }
        } else {
          // Chưa khởi tạo bản ghi ShowtimeSeat nào trong DB -> mặc định 86/88 ghế trống theo showtimeController
          availableSeats = 86;
          availableByTier = { STANDARD: 47, VIP: 35, SWEETBOX: 4 };
        }
      } else if (typeof seatInfo === 'object') {
        // Trường hợp truyền kết quả aggregation { totalInitialized, availableCount, seats }
        seatsInitialized = Number(seatInfo.totalInitialized) > 0;
        totalSeats = seatsInitialized ? Number(seatInfo.totalInitialized) : 88;
        if (seatsInitialized) {
          // Giữ nguyên 0 nếu availableCount === 0! Không bao giờ fallback || 42
          availableSeats = Math.max(0, Number(seatInfo.availableCount) || 0);
          availableByTier = {
            STANDARD: Number(seatInfo.availableStandard) || 0,
            VIP: Number(seatInfo.availableVip) || 0,
            SWEETBOX: Number(seatInfo.availableSweetbox) || 0,
          };
        } else {
          availableSeats = 86;
          availableByTier = { STANDARD: 47, VIP: 35, SWEETBOX: 4 };
        }
        if (Array.isArray(seatInfo.seats)) {
          rawSeats = seatInfo.seats;
        }
      }
    } else if (typeof st.availableSeats === 'number') {
      // Hỗ trợ trường hợp truyền trực tiếp số ghế (kể cả availableSeats === 0)
      seatsInitialized = true;
      availableSeats = Math.max(0, st.availableSeats);
    } else {
      // Chưa có bản ghi ghế nào trong ShowtimeSeat cho suất chiếu mới tạo
      seatsInitialized = false;
      availableSeats = 86;
      availableByTier = { STANDARD: 47, VIP: 35, SWEETBOX: 4 };
    }

    // 2.3. Tính giá vé chuẩn từ Database & cấu hình giá Admin
    const pricing = calculateShowtimePrices(st, pricingConfig);

    // 2.4. Xử lý ngày giờ theo đúng múi giờ Asia/Ho_Chi_Minh
    const vnParts = getVNDateParts(startTime);
    const relativeDayLabel = getRelativeDayLabel(startTime, nowDate);

    const cinemaDoc =
      (st.cinemaId && typeof st.cinemaId === 'object' ? st.cinemaId : null) ||
      cinemaMap.get(String(st.cinemaId || '')) ||
      null;

    const normalizedShowtime = {
      showtimeId: stId,
      movieId: movieIdStr,
      time: vnParts ? vnParts.timeStr : '',
      date: vnParts ? vnParts.displayDate : '',
      shortDate: vnParts ? vnParts.displayShortDate : '',
      dateKey: vnParts ? vnParts.dateKey : '',
      relativeDayLabel,
      startTime: startTime.toISOString(),
      hour: vnParts ? vnParts.hour : 0,
      minute: vnParts ? vnParts.minute : 0,
      dayMinutes: vnParts ? vnParts.hour * 60 + vnParts.minute : 0,
      roomName: st.roomName || 'Phòng 01 - 2D',
      cinemaName: cinemaDoc?.name || st.cinemaName || "D'AVENOR Thanh Khê Plaza",
      cinemaAddress: cinemaDoc?.address || '',
      format: pricing.format,
      roomTypeLabel: pricing.roomTypeLabel,
      formatFeature: st.formatFeature || pricing.roomTypeLabel,
      price: pricing.priceStandard,
      priceStandard: pricing.priceStandard,
      priceVip: pricing.priceVip,
      priceSweetbox: pricing.priceSweetbox,
      priceFormatted: formatVND(pricing.priceStandard),
      priceVipFormatted: formatVND(pricing.priceVip),
      priceSweetboxFormatted: formatVND(pricing.priceSweetbox),
      availableSeats,
      totalSeats,
      seatsInitialized,
      availableByTier,
      rawSeats,
      isSoldOut: availableSeats <= 0,
      bookingLink: buildValidBookingLink(
        { showtimeId: stId, startTime, availableSeats, status: st.status },
        movieIdStr,
        nowDate
      ),
    };

    if (!showtimesByMovieId.has(movieIdStr)) {
      showtimesByMovieId.set(movieIdStr, []);
    }
    showtimesByMovieId.get(movieIdStr).push(normalizedShowtime);
  }

  // Chuẩn hóa danh sách phim kèm các suất chiếu thực tế từ MongoDB
  const moviesWithDetails = movies.map((m) => {
    const movieIdStr = String(m._id || m.id || '');
    const movieShowtimes = (showtimesByMovieId.get(movieIdStr) || []).sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const supportedFormats = [...new Set(movieShowtimes.map((s) => s.format))];

    return {
      _id: movieIdStr,
      title: m.title,
      genre: m.genre || 'Đang cập nhật',
      duration: m.duration || 120,
      rating: m.rating || 4.5,
      ageRating: m.ageRating || 'P',
      status: m.status || 'NOW_SHOWING',
      posterUrl: m.posterUrl || '',
      description: m.description || '',
      director: m.director || '',
      cast: Array.isArray(m.cast) ? m.cast : [],
      supportedFormats,
      has3D: supportedFormats.includes('3D'),
      hasIMAX: supportedFormats.includes('IMAX'),
      showtimes: movieShowtimes,
    };
  });

  // Lọc danh sách khuyến mãi thực sự còn hạn và đang active
  const validPromotions = promotions
    .filter((p) => isPromotionValid(p, nowDate))
    .map((p) => {
      const endRaw = p.endDate || p.expiryDate || p.validUntil;
      const endParts = endRaw ? getVNDateParts(endRaw) : null;
      return {
        _id: String(p._id || ''),
        title: p.title,
        code: p.code || '',
        badgeText: p.badgeText || '',
        discountPercent: p.discountPercent || 0,
        discountAmount: p.discountAmount || 0,
        minOrderValue: p.minOrderValue || 0,
        description: p.description || '',
        category: p.category || 'GENERAL',
        endDate: endParts ? endParts.displayDate : null,
      };
    });

  // Chuẩn hóa danh sách combo bắp nước
  const normalizedConcessions = concessions
    .filter((c) => c && c.isActive !== false)
    .map((c) => ({
      _id: String(c._id || ''),
      name: c.name,
      price: Number(c.price) || 0,
      priceFormatted: formatVND(c.price),
      description: c.description || '',
      category: c.category || 'COMBO',
      badge: c.badge || '',
    }));

  // Chuẩn hóa danh sách rạp chiếu
  const normalizedCinemas =
    cinemas.length > 0
      ? cinemas.map((c) => ({
          _id: String(c._id || ''),
          name: c.name,
          address: c.address,
          city: c.city || 'Đà Nẵng',
        }))
      : [
          {
            name: "D'AVENOR Thanh Khê Plaza",
            address: 'Tầng 4–5 TTTM Thanh Khê Plaza, 279 Điện Biên Phủ, Q. Thanh Khê, Đà Nẵng',
            city: 'Đà Nẵng',
          },
          {
            name: "D'AVENOR Vincom Ngô Quyền",
            address: 'Tầng 4 Vincom Plaza, 910A Ngô Quyền, Q. Sơn Trà, Đà Nẵng',
            city: 'Đà Nẵng',
          },
          {
            name: "D'AVENOR Hải Châu Center",
            address: 'Tầng 5 Indochina Riverside, 74 Bạch Đằng, Q. Hải Châu, Đà Nẵng',
            city: 'Đà Nẵng',
          },
        ];

  return {
    nowIso: nowDate.toISOString(),
    nowVN: getVNDateParts(nowDate),
    cinemas: normalizedCinemas,
    movies: moviesWithDetails,
    concessions: normalizedConcessions,
    promotions: validPromotions,
  };
};

/**
 * Truy vấn ngữ cảnh rạp chiếu từ MongoDB đã được tối ưu hóa:
 * - Batch query cho Showtime và ShowtimeSeat (triệt tiêu hoàn toàn lỗi N+1 queries)
 * - Chỉ lấy các trường cần thiết bằng `.select()` và `.lean()`
 * - Không thực hiện thao tác ghi/xóa DB trên luồng đọc chat
 * - Cho phép lấy chi tiết danh sách ghế khi người dùng hỏi về ghế liền nhau / sơ đồ ghế
 */
export const fetchCinemaContextOptimized = async (options = {}) => {
  const {
    nowDate = new Date(),
    includeSeatDetails = false,
    targetMovieId = null,
  } = options;

  if (mongoose.connection.readyState !== 1) {
    return buildNormalizedCinemaContext({
      movies: [],
      showtimes: [],
      seatsByShowtimeId: new Map(),
      cinemas: [],
      concessions: [],
      promotions: [],
      nowDate,
    });
  }

  try {
    const movieQuery = { status: { $in: ['NOW_SHOWING', 'COMING_SOON'] } };
    if (targetMovieId && mongoose.Types.ObjectId.isValid(String(targetMovieId))) {
      movieQuery._id = targetMovieId;
    }

    // 1. Truy vấn song song Movies, Cinemas, Concessions, Promotions & TicketPricingConfig
    const [movies, cinemas, concessions, promotions, pricingConfig] = await Promise.all([
      Movie.find(movieQuery)
        .select('title genre duration rating releaseDate status ageRating posterUrl description director cast')
        .sort({ rating: -1 })
        .limit(20)
        .lean(),
      Cinema.find({})
        .select('name address city')
        .lean()
        .catch(() => []),
      Concession.find({})
        .select('name price description category badge')
        .sort({ price: 1 })
        .lean()
        .catch(() => []),
      Promotion.find({ status: 'ACTIVE' })
        .select('title code badgeText discountPercent discountAmount minOrderValue description category startDate endDate status')
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => []),
      ensurePricingConfig().catch(() => null),
    ]);

    const movieIds = movies.map((m) => m._id);

    // 2. Batch query TẤT CẢ suất chiếu chưa qua của các bộ phim trên trong 1 câu lệnh duy nhất
    const showtimes =
      movieIds.length > 0
        ? await Showtime.find({
            movieId: { $in: movieIds },
            startTime: { $gt: nowDate },
          })
            .select('movieId cinemaId roomName formatFeature startTime price')
            .sort({ startTime: 1 })
            .lean()
        : [];

    const showtimeIds = showtimes.map((st) => st._id);
    const seatsByShowtimeId = new Map();

    // 3. Batch query / Aggregation đếm số ghế trống chính xác cho toàn bộ showtimeIds trong 1 lần gọi
    if (showtimeIds.length > 0) {
      if (includeSeatDetails) {
        const allSeats = await ShowtimeSeat.find({
          showtimeId: { $in: showtimeIds },
        })
          .select('showtimeId seatNumber row col type status holdExpiresAt')
          .lean();

        for (const stId of showtimeIds) {
          seatsByShowtimeId.set(String(stId), []);
        }
        for (const seat of allSeats) {
          const key = String(seat.showtimeId);
          if (!seatsByShowtimeId.has(key)) {
            seatsByShowtimeId.set(key, []);
          }
          seatsByShowtimeId.get(key).push(seat);
        }
      } else {
        const seatStats = await ShowtimeSeat.aggregate([
          { $match: { showtimeId: { $in: showtimeIds } } },
          {
            $project: {
              showtimeId: 1,
              type: 1,
              isAvailable: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$status', 'AVAILABLE'] },
                      {
                        $and: [
                          { $eq: ['$status', 'HOLDING'] },
                          { $ne: ['$holdExpiresAt', null] },
                          { $lt: ['$holdExpiresAt', nowDate] },
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
          {
            $group: {
              _id: '$showtimeId',
              totalInitialized: { $sum: 1 },
              availableCount: { $sum: '$isAvailable' },
              availableStandard: {
                $sum: {
                  $cond: [{ $and: [{ $eq: ['$type', 'STANDARD'] }, { $eq: ['$isAvailable', 1] }] }, 1, 0],
                },
              },
              availableVip: {
                $sum: {
                  $cond: [{ $and: [{ $eq: ['$type', 'VIP'] }, { $eq: ['$isAvailable', 1] }] }, 1, 0],
                },
              },
              availableSweetbox: {
                $sum: {
                  $cond: [{ $and: [{ $eq: ['$type', 'SWEETBOX'] }, { $eq: ['$isAvailable', 1] }] }, 1, 0],
                },
              },
            },
          },
        ]);

        for (const stat of seatStats) {
          seatsByShowtimeId.set(String(stat._id), stat);
        }
      }
    }

    return buildNormalizedCinemaContext({
      movies,
      showtimes,
      seatsByShowtimeId,
      cinemas,
      concessions,
      promotions,
      pricingConfig,
      nowDate,
    });
  } catch (error) {
    console.error('[CinemaContextService] Lỗi truy vấn dữ liệu MongoDB:', error.message);
    return buildNormalizedCinemaContext({
      movies: [],
      showtimes: [],
      seatsByShowtimeId: new Map(),
      cinemas: [],
      concessions: [],
      promotions: [],
      nowDate,
    });
  }
};
