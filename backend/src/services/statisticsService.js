import { summarizeReviews } from './reviewSummary.js';
import { opensMoreThanSevenDaysAhead } from './bookingPolicy.js';
import { DEFAULT_CLEANING_MINUTES, normalizeCleaningMinutes } from './showtimeLifecycleService.js';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Movie from '../models/Movie.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Expense, { DIRECT_MOVIE_EXPENSE_TYPES, EXPENSE_CATEGORY_LABELS } from '../models/Expense.js';
import {
  parseDateFilter,
  calculateGrowth,
  maskPhoneNumber,
  countSeatsFromString,
  formatCurrency,
  formatCompactCurrency,
  formatExactCurrency,
  getVietnamParts,
  makeVietnamDate,
  formatVietnamDateKey,
  CINEMA_OPERATION_START,
  CINEMA_OPERATION_START_YEAR,
  CINEMA_OPERATION_START_MONTH,
  CINEMA_OPERATION_START_LABEL,
} from '../utils/statisticsUtils.js';

const validPayments = { $in: ['VERIFIED', 'SIMULATED'] };
const verifiedRevenue = (booking) =>
  ['VERIFIED', 'SIMULATED'].includes(booking.paymentStatus) ? Number(booking.totalAmount || 0) : 0;
const verifiedRefund = (booking) =>
  booking.refundStatus === 'REFUNDED' &&
  ['VERIFIED', 'SIMULATED'].includes(booking.paymentStatus)
    ? Number(booking.refundAmount || 0)
    : 0;

class StatisticsService {
  /**
   * Giải quyết khoảng thời gian lọc từ request query của Admin Statistics.
   * Bật strictValidation khi truy vấn theo tháng cụ thể (by_month), tháng trước (last_month),
   * cả năm (this_year) hoặc khoảng ngày tùy chỉnh (custom) để trả lỗi 400 rõ ràng nếu toàn bộ kỳ < 01/11/2026.
   */
  resolvePeriodFilter(filters = {}) {
    const {
      timeRange = 'this_month',
      customStart,
      customEnd,
      month,
      year,
      strictValidation,
    } = filters;

    const shouldStrict =
      strictValidation !== undefined
        ? Boolean(strictValidation)
        : ['by_month', 'last_month', 'this_year', 'custom'].includes(timeRange) ||
          (month != null && year != null);

    return parseDateFilter({
      timeRange,
      customStart,
      customEnd,
      month,
      year,
      strictValidation: shouldStrict,
    });
  }

  /**
   * Helper tách doanh thu vé, bắp nước và chiết khấu từ 1 booking
   */
  resolveBookingSplit(booking, showtimePrice = 95000) {
    const seatCount = countSeatsFromString(booking.seats);
    const netAmount = verifiedRevenue(booking);
    if (!['VERIFIED', 'SIMULATED'].includes(booking.paymentStatus)) {
      return { ticketRev: 0, concessionRev: 0, discountAmount: 0, grossAmount: 0 };
    }

    const discountAmount = Number(booking.priceSnapshot?.discount || 0);

    if (booking.priceSnapshot?.tickets?.length || booking.priceSnapshot?.combos?.length) {
      const rawTicketRev = (booking.priceSnapshot.tickets || []).reduce(
        (sum, t) => sum + Number(t.price || showtimePrice || 0),
        0
      );
      const rawComboRev = (booking.priceSnapshot.combos || []).reduce(
        (sum, c) => sum + Number(c.price || 0) * Number(c.quantity || 1),
        0
      );
      const concessionRev = Math.min(netAmount, rawComboRev);
      const ticketRev = Math.max(0, netAmount - concessionRev);
      return {
        ticketRev,
        concessionRev,
        discountAmount,
        grossAmount: Math.max(netAmount + discountAmount, rawTicketRev + rawComboRev),
      };
    }

    const estTicketRev = seatCount > 0 ? seatCount * (showtimePrice || 95000) : netAmount;
    let ticketRev = netAmount;
    let concessionRev = 0;

    if (booking.concessions && booking.concessions.trim().length > 0) {
      if (netAmount > estTicketRev) {
        ticketRev = estTicketRev;
        concessionRev = netAmount - estTicketRev;
      } else {
        ticketRev = Math.round(netAmount * 0.75);
        concessionRev = netAmount - ticketRev;
      }
    }

    return {
      ticketRev,
      concessionRev,
      discountAmount,
      grossAmount: netAmount + discountAmount,
    };
  }

  /**
   * Xác định trạng thái vòng đời thực tế của suất chiếu theo thời gian hiện tại:
   * - CANCELLED: cancelledAt != null hoặc lifecycleStatus === 'CANCELLED'
   * - COMPLETED: now >= cleaningEndTime hoặc lifecycleStatus === 'COMPLETED'
   * - CLEANING: endTime <= now < cleaningEndTime hoặc lifecycleStatus === 'CLEANING'
   * - NOW_SHOWING: startTime <= now < endTime hoặc lifecycleStatus === 'NOW_SHOWING'
   * - UPCOMING: now < startTime (chưa bắt đầu chiếu)
   */
  resolveShowtimeLifecycle(showtime, now = new Date()) {
    if (showtime.cancelledAt || showtime.lifecycleStatus === 'CANCELLED') {
      return 'CANCELLED';
    }
    const startMs = new Date(showtime.startTime).getTime();
    const durationMin = Number(showtime.movieDuration ?? showtime.movieId?.duration ?? 120);
    const endMs = showtime.endTime
      ? new Date(showtime.endTime).getTime()
      : startMs + durationMin * 60 * 1000;
    const cleaningMinutes = normalizeCleaningMinutes(
      showtime.cleaningMinutes,
      DEFAULT_CLEANING_MINUTES
    );
    const cleaningEndMs = showtime.cleaningEndTime
      ? new Date(showtime.cleaningEndTime).getTime()
      : endMs + cleaningMinutes * 60 * 1000;
    const nowMs = now.getTime();

    if (nowMs >= cleaningEndMs || showtime.lifecycleStatus === 'COMPLETED') {
      return 'COMPLETED';
    }
    if ((nowMs >= endMs && nowMs < cleaningEndMs) || showtime.lifecycleStatus === 'CLEANING') {
      return 'CLEANING';
    }
    if ((nowMs >= startMs && nowMs < endMs) || showtime.lifecycleStatus === 'NOW_SHOWING') {
      return 'NOW_SHOWING';
    }
    return 'UPCOMING';
  }

  /**
   * Kiểm tra suất chiếu có thực sự đang được phép mở bán ghế cho khách đặt vé hay không
   * (đồng bộ 100% với quy tắc nghiệp vụ trong bookingController.holdSeats):
   * 1. Chưa bắt đầu chiếu (lifecycle === 'UPCOMING' && startTime > now)
   * 2. Chưa bị hủy (!cancelledAt && lifecycle !== 'CANCELLED')
   * 3. Không bị Admin khóa (!isLocked)
   * 4. Phòng chiếu đang hoạt động (room.status !== 'MAINTENANCE')
   * 5. Có bản ghi ShowtimeSeat hợp lệ (hasSeatRecords === true)
   * 6. Đang trong thời gian cho phép mở bán (!opensMoreThanSevenDaysAhead(startTime, now) hoặc enforceSalesWindow=false khi xem công suất suất sắp chiếu chưa khóa)
   */
  evaluateShowtimeBookability(showtime, { lifecycle, hasSeatRecords, roomDoc, now = new Date() }) {
    const startDate = new Date(showtime.startTime);
    const notStarted = lifecycle === 'UPCOMING' && startDate.getTime() > now.getTime();
    const notCancelled = !showtime.cancelledAt && lifecycle !== 'CANCELLED';
    const notLocked = !showtime.isLocked;
    const roomStatus = String(roomDoc?.status || showtime.roomId?.status || 'ACTIVE').toUpperCase();
    const roomActive = roomStatus === 'ACTIVE';
    const withinSevenDayWindow = notStarted && !opensMoreThanSevenDaysAhead(startDate, now);

    // Ghế của suất sắp chiếu thực sự có thể đặt (chưa chiếu, không hủy, không khóa, phòng active, có ShowtimeSeat)
    const isBookableUpcoming =
      notStarted && notCancelled && notLocked && roomActive && Boolean(hasSeatRecords);

    // Ghế đang mở bán ngay tại thời điểm `now` trong cửa sổ 7 ngày của bookingPolicy
    const isWithinImmediateSalesWindow = isBookableUpcoming && withinSevenDayWindow;

    return {
      isBookableUpcoming,
      isWithinImmediateSalesWindow,
      withinSevenDayWindow,
      isLockedUpcoming: notStarted && notCancelled && Boolean(showtime.isLocked),
      isBeyondSalesWindowUpcoming: isBookableUpcoming && !withinSevenDayWindow,
      isMissingSeatsUpcoming: notStarted && notCancelled && notLocked && !hasSeatRecords,
    };
  }

  /**
   * Xây dựng bộ lọc phòng/rạp/phim thống nhất cho Showtime
   */
  async buildShowtimeFilter({ cinemaId, movieId, roomId, roomType, room }, allRooms = null) {
    const rooms = allRooms || (await Room.find({}).sort({ roomNumber: 1 }).lean());
    const match = {};

    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      match.cinemaId = new mongoose.Types.ObjectId(cinemaId);
    }
    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      match.movieId = new mongoose.Types.ObjectId(movieId);
    }

    const effectiveRoom = roomId && roomId !== 'ALL' ? roomId : room && room !== 'ALL' ? room : null;
    let filteredRoomIds = null;

    if (roomType && roomType !== 'ALL') {
      const matchedRooms = rooms.filter(
        (r) => (r.roomType || '').toLowerCase() === String(roomType).toLowerCase()
      );
      filteredRoomIds = matchedRooms.map((r) => r._id);
    }

    if (effectiveRoom) {
      if (mongoose.Types.ObjectId.isValid(effectiveRoom)) {
        const targetId = new mongoose.Types.ObjectId(effectiveRoom);
        filteredRoomIds = filteredRoomIds
          ? filteredRoomIds.filter((id) => id.equals(targetId))
          : [targetId];
      } else {
        const term = String(effectiveRoom).trim().toLowerCase();
        const byTypeOrName = rooms.filter(
          (r) =>
            (r.roomType && r.roomType.toLowerCase() === term) ||
            (r.name && r.name.toLowerCase().includes(term)) ||
            (r.shortName && r.shortName.toLowerCase().includes(term)) ||
            `phòng 0${r.roomNumber}` === term ||
            `phòng ${r.roomNumber}` === term
        );
        if (byTypeOrName.length > 0) {
          const ids = byTypeOrName.map((r) => r._id);
          filteredRoomIds = filteredRoomIds
            ? filteredRoomIds.filter((id) => ids.some((mId) => mId.equals(id)))
            : ids;
        } else {
          match.roomName = { $regex: String(effectiveRoom).trim(), $options: 'i' };
        }
      }
    }

    if (filteredRoomIds !== null) {
      match.roomId = { $in: filteredRoomIds };
    }

    return { match, rooms };
  }

  /**
   * HELPER DÙNG CHUNG (MỤC IV):
   * Xác định động danh sách các bộ phim thực sự có hoạt động trong kỳ báo cáo từ:
   * - Showtime.movieId (các suất chiếu được xếp lịch trong kỳ, bao gồm cả suất đã hủy nếu có phát sinh)
   * - Booking hợp lệ (PAID + VERIFIED/SIMULATED) và các đơn hủy có hoàn tiền (CANCELLED + REFUNDED) trong kỳ
   * - Expense trực tiếp gắn với phim trong kỳ
   *
   * Tuyệt đối KHÔNG hard-code tên phim, KHÔNG dùng Movie.status làm điều kiện duy nhất,
   * KHÔNG dùng Movie.find({}) để đẩy 15 phim không có hoạt động vào bảng, và KHÔNG dùng slice(0, 3) để giấu dữ liệu.
   */
  async resolveActiveMoviesInPeriod({
    periodShowtimes = [],
    periodBookings = [],
    cancelledBookings = [],
    periodExpenses = [],
    search = '',
  }) {
    const activeMovieIdSet = new Set();
    const scheduledMoviesByMonthMap = new Map(); // Map<'YYYY-MM', Set<movieId>>

    const extractMovieId = (raw) => {
      if (!raw) return null;
      const idStr = String(raw._id || raw);
      return mongoose.Types.ObjectId.isValid(idStr) ? idStr : null;
    };

    // 1. Từ suất chiếu hoạt động trong kỳ -> đồng thời gom theo từng tháng dương lịch (YYYY-MM theo giờ Việt Nam)
    for (const st of periodShowtimes) {
      if (st.cancelledAt || st.lifecycleStatus === 'CANCELLED') continue;
      const mId = extractMovieId(st.movieId);
      if (!mId) continue;
      activeMovieIdSet.add(mId);

      if (st.startTime) {
        const { year, month } = getVietnamParts(st.startTime);
        if (year && month) {
          const monthKey = `${year}-${String(month).padStart(2, '0')}`;
          if (!scheduledMoviesByMonthMap.has(monthKey)) {
            scheduledMoviesByMonthMap.set(monthKey, new Set());
          }
          scheduledMoviesByMonthMap.get(monthKey).add(mId);
        }
      }
    }

    // 2. Từ các giao dịch đặt vé hợp lệ trong kỳ (kể cả giao dịch đặt trước cho suất chiếu tháng sau)
    for (const b of periodBookings) {
      const mId = extractMovieId(b.movieId) || extractMovieId(b.showtimeId?.movieId);
      if (mId) activeMovieIdSet.add(mId);
    }

    // 3. Từ các giao dịch hủy có hoàn tiền hợp lệ trong kỳ (để đối soát tài chính, KHÔNG tính vào giới hạn 3 phim xếp lịch/tháng)
    for (const cb of cancelledBookings) {
      if (verifiedRefund(cb) > 0 || ['VERIFIED', 'SIMULATED'].includes(cb.paymentStatus)) {
        const mId = extractMovieId(cb.movieId) || extractMovieId(cb.showtimeId?.movieId);
        if (mId) activeMovieIdSet.add(mId);
      }
    }

    // 4. Từ các chứng từ chi phí trực tiếp gắn với phim trong kỳ (KHÔNG tính vào giới hạn 3 phim xếp lịch/tháng)
    for (const exp of periodExpenses) {
      const mId = extractMovieId(exp.movieId);
      if (mId) activeMovieIdSet.add(mId);
    }

    if (activeMovieIdSet.size === 0) {
      return {
        movies: [],
        activeMovieIds: [],
        schedulePolicyWarning: null,
        monthlyScheduledMoviesBreakdown: {},
      };
    }

    const objectIds = Array.from(activeMovieIdSet).map((id) => new mongoose.Types.ObjectId(id));
    const query = { _id: { $in: objectIds } };
    if (search && search.trim().length > 0) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const movies = await Movie.find(query).lean();

    // Kiểm tra quy tắc 3 phim/tháng THEO TỪNG THÁNG ĐƠN LẺ (không gộp tổng phim của cả năm/nhiều tháng)
    const monthlyScheduledMoviesBreakdown = {};
    const exceededMonths = [];
    for (const [monthKey, movieSet] of Array.from(scheduledMoviesByMonthMap.entries()).sort()) {
      const [yStr, mStr] = monthKey.split('-');
      const count = movieSet.size;
      monthlyScheduledMoviesBreakdown[monthKey] = {
        month: Number(mStr),
        year: Number(yStr),
        label: `Tháng ${Number(mStr)}/${yStr}`,
        scheduledMoviesCount: count,
        movieIds: Array.from(movieSet),
        exceedsLimit: count > 3,
      };
      if (count > 3) {
        exceededMonths.push(`Tháng ${Number(mStr)}/${yStr} (${count} phim)`);
      }
    }

    const schedulePolicyWarning =
      exceededMonths.length > 0
        ? `Cảnh báo nghiệp vụ: Phát hiện tháng vượt mức quy hoạch chuẩn 3 phim có lịch chiếu/tháng tại ${exceededMonths.join(', ')}. Hệ thống vẫn phản ánh đầy đủ toàn bộ số phim thực tế.`
        : null;

    return {
      movies,
      activeMovieIds: Array.from(activeMovieIdSet),
      schedulePolicyWarning,
      monthlyScheduledMoviesBreakdown,
    };
  }

  /**
   * API lấy danh sách phim động cho Dropdown Bộ lọc Thống kê theo đúng kỳ báo cáo và phạm vi phòng đang chọn
   */
  async getPeriodFilterMovies(filters = {}) {
    const { cinemaId, roomId, roomType, room } = filters;
    const parsedDate = this.resolvePeriodFilter(filters);
    const { start, end, showtimeEnd, label, month: targetMonth, year: targetYear } = parsedDate;

    const { match: showtimeFilterMatch } = await this.buildShowtimeFilter({
      cinemaId,
      roomId,
      roomType,
      room,
    });

    const periodShowtimeQuery = {
      ...showtimeFilterMatch,
      startTime: { $gte: start, $lte: showtimeEnd || end },
    };

    const periodShowtimes = await Showtime.find(periodShowtimeQuery)
      .populate('movieId', 'title slug poster posterUrl duration genre status ageRating')
      .lean();

    const showtimeIds = periodShowtimes.map((s) => s._id);
    const bookingMatch = {
      createdAt: { $gte: start, $lte: end },
      status: 'PAID',
      paymentStatus: validPayments,
    };
    if (Object.keys(showtimeFilterMatch).length > 0) {
      bookingMatch.showtimeId = { $in: showtimeIds };
    }

    const [periodBookings, periodExpenses] = await Promise.all([
      Booking.find(bookingMatch)
        .populate({ path: 'showtimeId', select: 'movieId' })
        .select('movieId showtimeId totalAmount seats paymentStatus')
        .lean(),
      this.findExpensesInPeriod({
        start,
        end,
        month: targetMonth,
        year: targetYear,
        timeRange: filters.timeRange || 'by_month',
        roomId,
      }),
    ]);

    const { movies, schedulePolicyWarning } = await this.resolveActiveMoviesInPeriod({
      periodShowtimes,
      periodBookings,
      periodExpenses,
    });

    const showtimesCountByMovie = new Map();
    for (const st of periodShowtimes) {
      if (st.cancelledAt || st.lifecycleStatus === 'CANCELLED') continue;
      const mId = String(st.movieId?._id || st.movieId || '');
      if (mId) {
        showtimesCountByMovie.set(mId, (showtimesCountByMovie.get(mId) || 0) + 1);
      }
    }

    const items = movies
      .map((m) => {
        const mId = String(m._id);
        return {
          id: mId,
          _id: mId,
          title: m.title,
          slug: m.slug,
          poster: m.posterUrl || m.poster || '',
          genre: m.genre || '',
          duration: m.duration || 120,
          status: m.status,
          showtimesCount: showtimesCountByMovie.get(mId) || 0,
        };
      })
      .sort((a, b) => b.showtimesCount - a.showtimesCount || a.title.localeCompare(b.title));

    return {
      timeRangeLabel: label,
      total: items.length,
      schedulePolicyWarning,
      items,
    };
  }

  /**
   * Tính toán công suất ghế mở bán thực tế từ ShowtimeSeat & Room cho danh sách suất chiếu
   * - Tự động loại bỏ suất chiếu đã hủy (CANCELLED) khỏi công suất hoạt động.
   * - Tách biệt rõ:
   *   + bookedSeats (vé đã bán trên ShowtimeSeat)
   *   + holdingSeats (ghế đang giữ tạm còn hạn 600s)
   *   + completedUnsoldSeats (ghế trống của suất đã kết thúc / đang chiếu / đang dọn phòng - KHÔNG còn đặt được)
   *   + lockedUpcomingSeats (ghế của suất sắp chiếu nhưng bị Admin khóa isLocked=true - KHÔNG còn đặt được)
   *   + upcomingAvailableSeats (ghế thực sự còn được phép đặt của suất sắp chiếu: chưa bắt đầu, chưa hủy, không bị khóa, phòng ACTIVE, có bản ghi ShowtimeSeat hợp lệ, không BOOKED và không HOLDING còn hạn)
   *   + immediateWindowBookableSeats (ghế còn đặt được ngay trong cửa sổ mở bán 7 ngày của bookingPolicy)
   * - Nếu suất chiếu thiếu bản ghi ShowtimeSeat: cảnh báo missingSeatShowtimesCount và KHÔNG dùng fallback 88 ghế để khẳng định suất đó có 88 ghế khả dụng thực tế.
   */
  async computeShowtimeSeatStats(showtimes, roomMap, now = new Date()) {
    const activeShowtimes = showtimes.filter(
      (st) => !st.cancelledAt && st.lifecycleStatus !== 'CANCELLED'
    );
    const activeIds = activeShowtimes.map((st) => st._id);

    let seatAgg = [];
    if (activeIds.length > 0) {
      seatAgg = await ShowtimeSeat.aggregate([
        { $match: { showtimeId: { $in: activeIds } } },
        {
          $group: {
            _id: '$showtimeId',
            totalSeats: { $sum: 1 },
            bookedSeats: {
              $sum: { $cond: [{ $eq: ['$status', 'BOOKED'] }, 1, 0] },
            },
            holdingSeats: {
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
          },
        },
      ]);
    }

    const seatMap = new Map(seatAgg.map((row) => [String(row._id), row]));
    const perShowtimeMap = new Map();
    let totalSellableSeats = 0;
    let totalVerifiedSeatDocs = 0;
    let totalHoldingSeats = 0;
    let totalCompletedSeats = 0;
    let totalUpcomingSeats = 0;
    let totalUpcomingVerifiedSeats = 0;
    let totalUpcomingHoldingSeats = 0;
    let totalCompletedHoldingSeats = 0;
    let totalLockedUpcomingSeats = 0;
    let totalLockedUpcomingUnsoldSeats = 0;
    let totalImmediateWindowBookableSeats = 0;
    let totalBeyondWindowBookableSeats = 0;
    let lockedUpcomingShowtimesCount = 0;
    let cleaningShowtimesCount = 0;
    let missingSeatShowtimesCount = 0;
    const missingSeatShowtimeIds = [];

    for (const st of showtimes) {
      const stId = String(st._id);
      const lifecycle = this.resolveShowtimeLifecycle(st, now);
      if (lifecycle === 'CANCELLED') {
        perShowtimeMap.set(stId, {
          totalSeats: 0,
          verifiedSeatDocsCount: 0,
          bookedSeatsFromSeatDoc: 0,
          holdingSeats: 0,
          hasSeatRecords: false,
          isLocked: Boolean(st.isLocked),
          isBookableUpcoming: false,
          isWithinImmediateSalesWindow: false,
          bookableAvailableSeats: 0,
          lockedUpcomingUnsoldSeats: 0,
          lifecycle,
        });
        continue;
      }

      if (lifecycle === 'CLEANING') {
        cleaningShowtimesCount += 1;
      }

      const agg = seatMap.get(stId);
      const roomDoc = roomMap.get(String(st.roomId?._id || st.roomId));
      const fallbackRoomCap = Number(roomDoc?.totalSeats || st.roomId?.totalSeats || 88);
      const hasSeatRecords = Boolean(agg && agg.totalSeats > 0);

      if (!hasSeatRecords) {
        missingSeatShowtimesCount += 1;
        missingSeatShowtimeIds.push(stId);
      }

      const totalSeats = hasSeatRecords ? agg.totalSeats : fallbackRoomCap;
      const verifiedSeatDocsCount = hasSeatRecords ? agg.totalSeats : 0;
      const bookedSeatsFromSeatDoc = hasSeatRecords ? agg.bookedSeats : 0;
      const holdingSeats = hasSeatRecords ? agg.holdingSeats : 0;

      const bookability = this.evaluateShowtimeBookability(st, {
        lifecycle,
        hasSeatRecords,
        roomDoc,
        now,
      });

      totalSellableSeats += totalSeats;
      totalVerifiedSeatDocs += verifiedSeatDocsCount;
      totalHoldingSeats += holdingSeats;

      let bookableAvailableSeats = 0;
      let lockedUpcomingUnsoldSeats = 0;

      if (
        lifecycle === 'COMPLETED' ||
        lifecycle === 'NOW_SHOWING' ||
        lifecycle === 'CLEANING'
      ) {
        totalCompletedSeats += totalSeats;
        totalCompletedHoldingSeats += holdingSeats;
      } else {
        totalUpcomingSeats += totalSeats;
        if (bookability.isLockedUpcoming) {
          lockedUpcomingShowtimesCount += 1;
          totalLockedUpcomingSeats += totalSeats;
          lockedUpcomingUnsoldSeats = Math.max(
            0,
            totalSeats - bookedSeatsFromSeatDoc - holdingSeats
          );
          totalLockedUpcomingUnsoldSeats += lockedUpcomingUnsoldSeats;
        } else if (bookability.isBookableUpcoming) {
          totalUpcomingVerifiedSeats += verifiedSeatDocsCount;
          totalUpcomingHoldingSeats += holdingSeats;
          bookableAvailableSeats = Math.max(
            0,
            verifiedSeatDocsCount - bookedSeatsFromSeatDoc - holdingSeats
          );
          if (bookability.isWithinImmediateSalesWindow) {
            totalImmediateWindowBookableSeats += bookableAvailableSeats;
          } else {
            totalBeyondWindowBookableSeats += bookableAvailableSeats;
          }
        }
      }

      perShowtimeMap.set(stId, {
        totalSeats,
        verifiedSeatDocsCount,
        bookedSeatsFromSeatDoc,
        holdingSeats,
        hasSeatRecords,
        isLocked: Boolean(st.isLocked),
        isBookableUpcoming: bookability.isBookableUpcoming,
        isWithinImmediateSalesWindow: bookability.isWithinImmediateSalesWindow,
        withinSevenDayWindow: bookability.withinSevenDayWindow,
        bookableAvailableSeats,
        lockedUpcomingUnsoldSeats,
        lifecycle,
      });
    }

    return {
      perShowtimeMap,
      totalSellableSeats,
      totalVerifiedSeatDocs,
      totalHoldingSeats,
      totalCompletedSeats,
      totalUpcomingSeats,
      totalUpcomingVerifiedSeats,
      totalUpcomingHoldingSeats,
      totalCompletedHoldingSeats,
      totalLockedUpcomingSeats,
      totalLockedUpcomingUnsoldSeats,
      totalImmediateWindowBookableSeats,
      totalBeyondWindowBookableSeats,
      lockedUpcomingShowtimesCount,
      cleaningShowtimesCount,
      missingSeatShowtimesCount,
      missingSeatShowtimeIds,
    };
  }

  /**
   * Helper lấy danh sách chi phí khớp với kỳ báo cáo
   */
  async findExpensesInPeriod({ start, end, month, year, timeRange, movieId, roomId }) {
    const query = {};
    if (timeRange === 'by_month' && month && year) {
      query.$or = [
        { month: Number(month), year: Number(year) },
        { date: { $gte: start, $lte: end } },
      ];
    } else {
      query.date = { $gte: start, $lte: end };
    }

    if (roomId && roomId !== 'ALL' && mongoose.Types.ObjectId.isValid(roomId)) {
      query.roomId = new mongoose.Types.ObjectId(roomId);
    }

    const expenses = await Expense.find(query)
      .populate('movieId', 'title poster posterUrl duration')
      .populate('roomId', 'roomNumber name shortName roomType')
      .sort({ date: -1 })
      .lean();

    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      return expenses.filter(
        (e) => !e.movieId || String(e.movieId._id || e.movieId) === String(movieId)
      );
    }
    return expenses;
  }

  /**
   * Helper phân bổ chi phí vận hành dùng chung cho các bộ phim trong kỳ
   * Đảm bảo tổng chi phí phân bổ của các phim khớp chính xác 100% với totalSharedOperationalExpenses (không lệch 1-2đ do làm tròn).
   */
  allocateSharedExpensesToMovies(
    movieEntries = [],
    totalSharedOperationalExpenses = 0,
    { allocationMethod = 'SHOWTIMES', totalTheaterShowtimes = 0, totalTheaterScreeningMinutes = 0, totalNetRevenue = 0 } = {}
  ) {
    if (!Array.isArray(movieEntries) || movieEntries.length === 0) return;

    const activeCount = movieEntries.length;
    const rawShares = movieEntries.map((mv) => {
      const stCount = Number(mv.showtimesCount || 0);
      const rev = Number(mv.netRevenue ?? mv.revenue ?? 0);
      const mins = Number(mv.screeningMinutes || stCount * Number(mv.duration || 120));

      if (allocationMethod === 'DURATION' && totalTheaterScreeningMinutes > 0) {
        return mins / totalTheaterScreeningMinutes;
      }
      if (allocationMethod === 'REVENUE' && totalNetRevenue > 0) {
        return rev / totalNetRevenue;
      }
      if (totalTheaterShowtimes > 0) {
        return stCount / totalTheaterShowtimes;
      }
      if (totalNetRevenue > 0) {
        return rev / totalNetRevenue;
      }
      return 1 / activeCount;
    });

    let allocatedSum = 0;
    let primaryIdx = 0;
    let maxWeight = -1;

    movieEntries.forEach((mv, idx) => {
      const shareRatio = rawShares[idx] || 0;
      if (shareRatio > maxWeight) {
        maxWeight = shareRatio;
        primaryIdx = idx;
      }
      mv.allocationSharePercent = Number((shareRatio * 100).toFixed(2));
      const rounded = Math.round(totalSharedOperationalExpenses * shareRatio);
      mv._allocatedCost = rounded;
      allocatedSum += rounded;
    });

    const roundingDiff = totalSharedOperationalExpenses - allocatedSum;
    if (roundingDiff !== 0 && movieEntries[primaryIdx] && totalSharedOperationalExpenses > 0) {
      movieEntries[primaryIdx]._allocatedCost = Math.max(
        0,
        movieEntries[primaryIdx]._allocatedCost + roundingDiff
      );
    }
  }

  /**
   * 1. TAB TỔNG HỢP (MONTHLY BUSINESS OVERVIEW DASHBOARD)
   */
  async getOverviewStats(filters = {}) {
    const {
      timeRange = 'this_month',
      cinemaId,
      movieId,
      roomId,
      roomType,
      room,
    } = filters;

    const parsedDate = this.resolvePeriodFilter(filters);
    const {
      start,
      end,
      chartEnd,
      showtimeEnd,
      prevStart,
      prevEnd,
      label,
      prevLabel,
      month: targetMonth,
      year: targetYear,
      hasValidPreviousPeriod,
      isFirstOperatingMonth,
      momComparisonNote,
      wasClampedToOperationStart,
    } = parsedDate;

    const allRooms = await Room.find({}).sort({ roomNumber: 1 }).lean();
    const activePhysicalRooms = allRooms.filter((r) => r.status !== 'MAINTENANCE');
    const physicalRoomsCount = allRooms.length;
    const totalPhysicalSeats = allRooms.reduce((sum, r) => sum + Number(r.totalSeats || 0), 0);
    const roomMap = new Map(allRooms.map((r) => [String(r._id), r]));

    const { match: showtimeFilterMatch } = await this.buildShowtimeFilter(
      { cinemaId, movieId, roomId, roomType, room },
      allRooms
    );

    const hasEntityFilter = Object.keys(showtimeFilterMatch).length > 0;
    let filteredShowtimeIds = null;
    if (hasEntityFilter) {
      const matchedShowtimes = await Showtime.find(showtimeFilterMatch).select('_id').lean();
      filteredShowtimeIds = matchedShowtimes.map((s) => s._id);
    }

    const periodShowtimeQuery = {
      ...showtimeFilterMatch,
      startTime: { $gte: start, $lte: showtimeEnd || end },
    };

    const bookingMatch = {
      createdAt: { $gte: start, $lte: end },
      status: 'PAID',
      paymentStatus: validPayments,
    };
    // Đơn hủy/hoàn tiền trong kỳ: khớp theo ngày tạo đơn HOẶC ngày xử lý hoàn tiền (updatedAt) trong kỳ để hỗ trợ hoàn tiền khác tháng mà không thất thoát
    const cancelledBookingMatch = {
      status: 'CANCELLED',
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { refundStatus: 'REFUNDED', updatedAt: { $gte: start, $lte: end } },
      ],
    };

    if (filteredShowtimeIds !== null) {
      bookingMatch.showtimeId = { $in: filteredShowtimeIds };
      cancelledBookingMatch.showtimeId = { $in: filteredShowtimeIds };
    }

    const prevBookingsPromise =
      hasValidPreviousPeriod && prevStart && prevEnd
        ? Booking.find({
            createdAt: { $gte: prevStart, $lte: prevEnd },
            status: 'PAID',
            paymentStatus: validPayments,
            ...(filteredShowtimeIds !== null ? { showtimeId: { $in: filteredShowtimeIds } } : {}),
          })
            .populate({ path: 'showtimeId', select: 'price movieId roomId' })
            .lean()
        : Promise.resolve([]);

    const prevShowtimesPromise =
      hasValidPreviousPeriod && prevStart && prevEnd
        ? Showtime.find({
            ...showtimeFilterMatch,
            startTime: { $gte: prevStart, $lte: prevEnd },
          })
            .populate('roomId', 'totalSeats')
            .lean()
        : Promise.resolve([]);

    const prevExpensesPromise =
      hasValidPreviousPeriod && prevStart && prevEnd
        ? this.findExpensesInPeriod({
            start: prevStart,
            end: prevEnd,
            month: getVietnamParts(prevStart).month,
            year: getVietnamParts(prevStart).year,
            timeRange: timeRange === 'by_month' ? 'by_month' : timeRange,
            movieId,
            roomId,
          })
        : Promise.resolve([]);

    const [
      currentBookings,
      prevBookings,
      cancelledBookings,
      periodShowtimes,
      prevPeriodShowtimes,
      currentExpenses,
      prevExpenses,
    ] = await Promise.all([
      Booking.find(bookingMatch)
        .populate({
          path: 'showtimeId',
          populate: [
            { path: 'movieId', select: 'title poster posterUrl duration genre status' },
            { path: 'roomId', select: 'roomNumber name shortName roomType totalSeats' },
          ],
        })
        .sort({ createdAt: -1 })
        .lean(),
      prevBookingsPromise,
      Booking.find(cancelledBookingMatch).lean(),
      Showtime.find(periodShowtimeQuery)
        .populate('movieId', 'title poster posterUrl duration genre status')
        .populate('roomId', 'roomNumber name shortName roomType totalSeats')
        .sort({ startTime: 1 })
        .lean(),
      prevShowtimesPromise,
      this.findExpensesInPeriod({
        start,
        end,
        month: targetMonth,
        year: targetYear,
        timeRange,
        movieId,
        roomId,
      }),
      prevExpensesPromise,
    ]);

    const now = new Date();
    const seatStats = await this.computeShowtimeSeatStats(periodShowtimes, roomMap, now);
    const activePeriodShowtimesForIds = periodShowtimes.filter(
      (st) => !st.cancelledAt && st.lifecycleStatus !== 'CANCELLED'
    );
    const periodActiveShowtimeIdSet = new Set(
      activePeriodShowtimesForIds.map((st) => String(st._id))
    );

    // Truy vấn đầy đủ tất cả đơn PAID của các suất chiếu diễn ra trong kỳ (kể cả đơn khách đặt trước từ tháng trước, VD đặt ngày 29/11 cho suất tháng 12)
    // để tính chính xác công suất ghế & doanh thu theo lịch chiếu mà không trùng hay mất vé
    const showtimeBoundBookings =
      activePeriodShowtimesForIds.length > 0
        ? await Booking.find({
            showtimeId: { $in: activePeriodShowtimesForIds.map((st) => st._id) },
            status: 'PAID',
            paymentStatus: validPayments,
          })
            .select('showtimeId movieId seats totalAmount paymentStatus createdAt priceSnapshot concessions')
            .lean()
        : [];

    // Xác định động danh sách phim có hoạt động trong kỳ báo cáo (Mục IV)
    const {
      movies: activeMoviesDocsInPeriod,
      activeMovieIds,
      schedulePolicyWarning,
      monthlyScheduledMoviesBreakdown,
    } = await this.resolveActiveMoviesInPeriod({
      periodShowtimes,
      periodBookings: currentBookings,
      cancelledBookings,
      periodExpenses: currentExpenses,
    });

    // Phân loại suất chiếu trong kỳ theo trạng thái vòng đời
    let completedShowtimesCount = 0;
    let nowShowingShowtimesCount = 0;
    let cleaningShowtimesCount = 0;
    let upcomingShowtimesCount = 0;
    let lockedUpcomingShowtimesCount = 0;
    let cancelledShowtimesCount = 0;
    const activePeriodShowtimes = [];
    const screenedMovieIdsInPeriod = new Set();

    for (const st of periodShowtimes) {
      const seatInfo = seatStats.perShowtimeMap.get(String(st._id));
      const lifecycle = seatInfo?.lifecycle || this.resolveShowtimeLifecycle(st, now);
      if (lifecycle === 'CANCELLED') {
        cancelledShowtimesCount += 1;
        continue;
      }
      activePeriodShowtimes.push(st);
      const mId = st.movieId?._id
        ? String(st.movieId._id)
        : st.movieId
        ? String(st.movieId)
        : null;

      if (lifecycle === 'COMPLETED') {
        completedShowtimesCount += 1;
        if (mId) screenedMovieIdsInPeriod.add(mId);
      } else if (lifecycle === 'CLEANING') {
        cleaningShowtimesCount += 1;
        completedShowtimesCount += 1;
        if (mId) screenedMovieIdsInPeriod.add(mId);
      } else if (lifecycle === 'NOW_SHOWING') {
        nowShowingShowtimesCount += 1;
        if (mId) screenedMovieIdsInPeriod.add(mId);
      } else {
        upcomingShowtimesCount += 1;
        if (st.isLocked) {
          lockedUpcomingShowtimesCount += 1;
        }
      }
    }

    const totalActiveShowtimesCount = activePeriodShowtimes.length;
    const distinctMoviesCount = activeMovieIds.length;
    const screenedMoviesCount = screenedMovieIdsInPeriod.size;

    // 1. Tính toán DOANH THU & VÉ THEO THỜI ĐIỂM GHI NHẬN GIAO DỊCH (Booking.createdAt trong kỳ)
    let totalGrossRevenue = 0;
    let totalDiscountAmount = 0;
    let totalTicketRevenue = 0;
    let totalConcessionRevenue = 0;
    let verifiedRevenueTotal = 0;
    let simulatedRevenueTotal = 0;
    let validTicketsSold = 0; // Tổng vé bán theo thời điểm giao dịch trong kỳ
    let crossPeriodAdvanceTicketsCount = 0; // Vé giao dịch trong kỳ này nhưng của suất chiếu kỳ sau (VD mua 29/11 cho suất T12)
    let crossPeriodAdvanceRevenue = 0;
    const customerSet = new Set();

    currentBookings.forEach((b) => {
      const netAmt = verifiedRevenue(b);
      if (b.paymentStatus === 'VERIFIED') verifiedRevenueTotal += netAmt;
      else if (b.paymentStatus === 'SIMULATED') simulatedRevenueTotal += netAmt;

      const count = countSeatsFromString(b.seats);
      validTicketsSold += count;

      const stPrice = b.showtimeId?.price || 95000;
      const split = this.resolveBookingSplit(b, stPrice);
      totalTicketRevenue += split.ticketRev;
      totalConcessionRevenue += split.concessionRev;
      totalDiscountAmount += split.discountAmount;
      totalGrossRevenue += split.grossAmount;

      const cKey = b.customerPhone || b.customerName || String(b._id);
      customerSet.add(cKey);

      const stId = String(b.showtimeId?._id || b.showtimeId || '');
      if (stId && !periodActiveShowtimeIdSet.has(stId)) {
        crossPeriodAdvanceTicketsCount += count;
        crossPeriodAdvanceRevenue += netAmt;
      }
    });

    // 2. Gom số ghế & doanh thu THEO SUẤT CHIẾU DIỄN RA TRONG KỲ (Showtime.startTime trong kỳ)
    const showtimeRevenueMap = new Map();
    const showtimeSoldMap = new Map();
    let preBookedFromEarlierPeriodTicketsCount = 0; // Vé của suất chiếu kỳ này nhưng khách đã đặt từ kỳ trước
    let preBookedFromEarlierPeriodRevenue = 0;

    showtimeBoundBookings.forEach((b) => {
      const stId = String(b.showtimeId?._id || b.showtimeId || '');
      if (!stId) return;
      const netAmt = verifiedRevenue(b);
      const count = countSeatsFromString(b.seats);
      showtimeRevenueMap.set(stId, (showtimeRevenueMap.get(stId) || 0) + netAmt);
      showtimeSoldMap.set(stId, (showtimeSoldMap.get(stId) || 0) + count);

      const createdMs = new Date(b.createdAt).getTime();
      if (createdMs < start.getTime() || createdMs > end.getTime()) {
        preBookedFromEarlierPeriodTicketsCount += count;
        preBookedFromEarlierPeriodRevenue += netAmt;
      }
    });

    const netRevenue = verifiedRevenueTotal + simulatedRevenueTotal;
    const cancelledOrdersCount = cancelledBookings.length;
    const cancelledTicketsCount = cancelledBookings.reduce(
      (sum, b) => sum + countSeatsFromString(b.seats),
      0
    );
    const totalRefunded = cancelledBookings.reduce((sum, b) => {
      const refTimestamp = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt).getTime();
      const inPeriod =
        (refTimestamp >= start.getTime() && refTimestamp <= end.getTime()) ||
        (new Date(b.createdAt).getTime() >= start.getTime() &&
          new Date(b.createdAt).getTime() <= end.getTime());
      return inPeriod ? sum + verifiedRefund(b) : sum;
    }, 0);

    // Doanh thu & vé kỳ trước (chỉ tính nếu hasValidPreviousPeriod === true)
    let prevNetRevenue = 0;
    let prevTicketsSold = 0;
    const prevCustomerSet = new Set();
    if (hasValidPreviousPeriod) {
      prevBookings.forEach((b) => {
        prevNetRevenue += verifiedRevenue(b);
        prevTicketsSold += countSeatsFromString(b.seats);
        const cKey = b.customerPhone || b.customerName || String(b._id);
        prevCustomerSet.add(cKey);
      });
    }

    const prevActiveShowtimes = hasValidPreviousPeriod
      ? prevPeriodShowtimes.filter((st) => !st.cancelledAt && st.lifecycleStatus !== 'CANCELLED')
      : [];
    const prevShowtimesCount = prevActiveShowtimes.length;
    const prevSellableSeats = prevActiveShowtimes.reduce(
      (sum, st) =>
        sum + Number(st.roomId?.totalSeats || roomMap.get(String(st.roomId))?.totalSeats || 88),
      0
    );
    const prevOccupancyRate =
      prevSellableSeats > 0
        ? Number(((prevTicketsSold / prevSellableSeats) * 100).toFixed(2))
        : 0;

    // Công suất ghế kỳ hiện tại (Mục VII & Final Validation Mục 1, 2, 4):
    // - Tách biệt rõ:
    //   + validTicketsSold: Số vé bán theo ngày phát sinh giao dịch trong kỳ (Booking.createdAt)
    //   + periodShowtimeBookedSeats: Số ghế đã đặt của các suất chiếu diễn ra trong kỳ (Showtime.startTime)
    //   + completedUnsoldSeats: Ghế trống của suất đã kết thúc / đang chiếu / đang dọn phòng (KHÔNG còn đặt được)
    //   + lockedUpcomingUnsoldSeats: Ghế trống của suất sắp chiếu nhưng bị Admin khóa (KHÔNG còn đặt được)
    //   + upcomingAvailableSeats: Ghế thực sự còn được phép đặt của các suất sắp chiếu hợp lệ (!isLocked, có ShowtimeSeat, chưa bắt đầu, chưa hủy, không BOOKED/HOLDING)
    const totalSellablePeriod = seatStats.totalSellableSeats;
    const totalHoldingPeriod = seatStats.totalHoldingSeats || 0;
    let completedSoldSeats = 0;
    let upcomingSoldSeats = 0;
    let upcomingBookableSoldSeats = 0;
    let lockedUpcomingSoldSeats = 0;

    for (const st of activePeriodShowtimes) {
      const stId = String(st._id);
      const info = seatStats.perShowtimeMap.get(stId);
      const soldForSt = Math.max(
        info?.bookedSeatsFromSeatDoc || 0,
        showtimeSoldMap.get(stId) || 0
      );
      if (
        info?.lifecycle === 'COMPLETED' ||
        info?.lifecycle === 'NOW_SHOWING' ||
        info?.lifecycle === 'CLEANING'
      ) {
        completedSoldSeats += soldForSt;
      } else {
        upcomingSoldSeats += soldForSt;
        if (info?.isLocked) {
          lockedUpcomingSoldSeats += soldForSt;
        } else if (info?.isBookableUpcoming) {
          upcomingBookableSoldSeats += soldForSt;
        }
      }
    }

    const periodShowtimeBookedSeats = completedSoldSeats + upcomingSoldSeats;
    const availableSeatsPeriod = Math.max(
      0,
      totalSellablePeriod - periodShowtimeBookedSeats - totalHoldingPeriod
    );
    const completedUnsoldSeats = Math.max(
      0,
      seatStats.totalCompletedSeats - completedSoldSeats - (seatStats.totalCompletedHoldingSeats || 0)
    );
    const lockedUpcomingUnsoldSeats = Math.max(
      0,
      (seatStats.totalLockedUpcomingSeats || 0) - lockedUpcomingSoldSeats
    );
    // Ghế thực sự còn được phép đặt: chỉ thuộc các suất sắp chiếu hợp lệ (!isLocked, có ShowtimeSeat, chưa bắt đầu, chưa hủy)
    const upcomingAvailableSeats = Math.max(
      0,
      seatStats.totalUpcomingVerifiedSeats -
        upcomingBookableSoldSeats -
        (seatStats.totalUpcomingHoldingSeats || 0)
    );

    // 3 Tỷ lệ công suất chuẩn hóa theo đúng mẫu số (Final Validation Mục 4):
    // (1) Tỷ lệ bán vé trên tổng ghế mở bán toàn kỳ
    const exactOccupancyRatio =
      totalSellablePeriod > 0 ? (periodShowtimeBookedSeats / totalSellablePeriod) * 100 : 0;
    const avgTicketSalesRate =
      totalSellablePeriod > 0
        ? Number(Math.min(100, exactOccupancyRatio).toFixed(2))
        : 0;
    // (2) Tỷ lệ lấp đầy của các suất đã/đang chiếu
    const completedOccupancyRate =
      seatStats.totalCompletedSeats > 0
        ? Number(
            Math.min(100, (completedSoldSeats / seatStats.totalCompletedSeats) * 100).toFixed(2)
          )
        : 0;
    // (3) Tỷ lệ đặt trước của các suất sắp chiếu
    const upcomingOccupancyRate =
      seatStats.totalUpcomingSeats > 0
        ? Number(
            Math.min(100, (upcomingSoldSeats / seatStats.totalUpcomingSeats) * 100).toFixed(2)
          )
        : 0;

    // Chi phí & Lợi nhuận kỳ hiện tại
    const hasExpenseData = currentExpenses.length > 0;
    let totalExpenses = 0;
    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      const directMovieCost = currentExpenses
        .filter((e) => e.movieId && String(e.movieId._id || e.movieId) === String(movieId))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const sharedCost = currentExpenses
        .filter((e) => !e.movieId && !DIRECT_MOVIE_EXPENSE_TYPES.includes(e.type))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      totalExpenses =
        directMovieCost + Math.round(sharedCost / Math.max(1, distinctMoviesCount || 1));
    } else {
      totalExpenses = currentExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    }

    const prevHasExpenseData = hasValidPreviousPeriod && prevExpenses.length > 0;
    const prevTotalExpenses = hasValidPreviousPeriod
      ? prevExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
      : 0;

    // QUY TẮC BẮT BUỘC: Không coi chi phí = 0 là lợi nhuận 100% hoặc Hòa vốn khi chưa có chứng từ chi phí
    const profitKnown = hasExpenseData;
    const profit = profitKnown ? netRevenue - totalExpenses : null;
    const prevProfit = prevHasExpenseData ? prevNetRevenue - prevTotalExpenses : null;

    const profitMargin =
      profitKnown && netRevenue > 0
        ? Number(((profit / netRevenue) * 100).toFixed(1))
        : profitKnown && totalExpenses > 0
        ? -100
        : null;

    const profitStatus = !profitKnown
      ? 'INSUFFICIENT_DATA'
      : profit > 0
      ? 'PROFIT'
      : profit === 0
      ? 'BREAKEVEN'
      : 'LOSS';

    const profitStatusLabel = !profitKnown
      ? 'Chưa đủ dữ liệu tính lợi nhuận'
      : profit > 0
      ? 'Có lãi'
      : profit === 0
      ? 'Hòa vốn'
      : 'Thua lỗ';

    // So sánh tăng trưởng MoM (Nếu Tháng 11/2026 là tháng đầu vận hành -> hasValidPreviousPeriod = false -> growth = null)
    const revenueGrowth = calculateGrowth(netRevenue, prevNetRevenue, hasValidPreviousPeriod);
    const ticketsGrowth = calculateGrowth(validTicketsSold, prevTicketsSold, hasValidPreviousPeriod);
    const showtimesGrowth = calculateGrowth(
      totalActiveShowtimesCount,
      prevShowtimesCount,
      hasValidPreviousPeriod
    );
    const occupancyGrowth = calculateGrowth(
      avgTicketSalesRate,
      prevOccupancyRate,
      hasValidPreviousPeriod
    );
    const expensesGrowth = calculateGrowth(
      totalExpenses,
      prevTotalExpenses,
      hasValidPreviousPeriod
    );
    const profitGrowth =
      hasValidPreviousPeriod && profitKnown && prevProfit !== null && prevProfit !== 0
        ? calculateGrowth(profit, prevProfit, hasValidPreviousPeriod)
        : null;

    const bookingCustomersCount = customerSet.size;
    const prevBookingCustomersCount = prevCustomerSet.size;
    const customersGrowth = calculateGrowth(
      bookingCustomersCount,
      prevBookingCustomersCount,
      hasValidPreviousPeriod
    );

    const totalCalendarDaysInPeriod = Math.max(
      1,
      Math.round(((chartEnd || end).getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    );
    const avgRevenuePerShowtime =
      totalActiveShowtimesCount > 0 ? Math.round(netRevenue / totalActiveShowtimesCount) : 0;
    const avgRevenuePerScreenedShowtime =
      completedShowtimesCount + nowShowingShowtimesCount > 0
        ? Math.round(netRevenue / (completedShowtimesCount + nowShowingShowtimesCount))
        : 0;
    const avgRevenuePerDay = Math.round(netRevenue / totalCalendarDaysInPeriod);

    // Thống kê theo từng phòng chiếu (9 phòng vật lý) & theo loại phòng (IMAX Laser, Dolby Atmos, Gold Class)
    const roomBreakdownMap = new Map();
    for (const r of allRooms) {
      roomBreakdownMap.set(String(r._id), {
        roomId: String(r._id),
        roomNumber: r.roomNumber,
        roomName: r.name,
        shortName: r.shortName,
        roomType: r.roomType,
        physicalSeats: Number(r.totalSeats || 88),
        status: r.status,
        showtimesCount: 0,
        completedShowtimesCount: 0,
        upcomingShowtimesCount: 0,
        totalSellableSeats: 0,
        soldSeats: 0,
        holdingSeats: 0,
        unsoldSeats: 0,
        occupancyRate: 0,
        revenue: 0,
        revenueFormatted: '0 đ',
      });
    }

    const roomTypeBreakdownMap = {
      'IMAX Laser': {
        roomType: 'IMAX Laser',
        roomsCount: allRooms.filter((r) => r.roomType === 'IMAX Laser').length,
        physicalSeats: allRooms
          .filter((r) => r.roomType === 'IMAX Laser')
          .reduce((s, r) => s + Number(r.totalSeats || 88), 0),
        showtimesCount: 0,
        totalSellableSeats: 0,
        soldSeats: 0,
        unsoldSeats: 0,
        occupancyRate: 0,
        revenue: 0,
      },
      'Dolby Atmos': {
        roomType: 'Dolby Atmos',
        roomsCount: allRooms.filter((r) => r.roomType === 'Dolby Atmos').length,
        physicalSeats: allRooms
          .filter((r) => r.roomType === 'Dolby Atmos')
          .reduce((s, r) => s + Number(r.totalSeats || 88), 0),
        showtimesCount: 0,
        totalSellableSeats: 0,
        soldSeats: 0,
        unsoldSeats: 0,
        occupancyRate: 0,
        revenue: 0,
      },
      'Gold Class': {
        roomType: 'Gold Class',
        roomsCount: allRooms.filter((r) => r.roomType === 'Gold Class').length,
        physicalSeats: allRooms
          .filter((r) => r.roomType === 'Gold Class')
          .reduce((s, r) => s + Number(r.totalSeats || 88), 0),
        showtimesCount: 0,
        totalSellableSeats: 0,
        soldSeats: 0,
        unsoldSeats: 0,
        occupancyRate: 0,
        revenue: 0,
      },
    };

    for (const st of activePeriodShowtimes) {
      const stId = String(st._id);
      const rId = String(st.roomId?._id || st.roomId || '');
      const seatInfo = seatStats.perShowtimeMap.get(stId);
      const stCap = seatInfo?.totalSeats || 88;
      const stSold = Math.max(
        seatInfo?.bookedSeatsFromSeatDoc || 0,
        showtimeSoldMap.get(stId) || 0
      );
      const stHold = seatInfo?.holdingSeats || 0;
      const stRev = showtimeRevenueMap.get(stId) || 0;

      const rEntry = roomBreakdownMap.get(rId);
      if (rEntry) {
        rEntry.showtimesCount += 1;
        if (seatInfo?.lifecycle === 'COMPLETED' || seatInfo?.lifecycle === 'NOW_SHOWING') {
          rEntry.completedShowtimesCount += 1;
        } else {
          rEntry.upcomingShowtimesCount += 1;
        }
        rEntry.totalSellableSeats += stCap;
        rEntry.soldSeats += stSold;
        rEntry.holdingSeats += stHold;
        rEntry.revenue += stRev;
      }

      const rType = rEntry?.roomType || st.roomId?.roomType || 'IMAX Laser';
      if (roomTypeBreakdownMap[rType]) {
        roomTypeBreakdownMap[rType].showtimesCount += 1;
        roomTypeBreakdownMap[rType].totalSellableSeats += stCap;
        roomTypeBreakdownMap[rType].soldSeats += stSold;
        roomTypeBreakdownMap[rType].revenue += stRev;
      }
    }

    const roomOccupancyBreakdown = Array.from(roomBreakdownMap.values()).map((r) => {
      const unsold = Math.max(0, r.totalSellableSeats - r.soldSeats - r.holdingSeats);
      const occ =
        r.totalSellableSeats > 0
          ? Number(Math.min(100, (r.soldSeats / r.totalSellableSeats) * 100).toFixed(2))
          : 0;
      return {
        ...r,
        unsoldSeats: unsold,
        occupancyRate: occ,
        revenueFormatted: formatCurrency(r.revenue),
      };
    });

    const roomTypeBreakdown = Object.values(roomTypeBreakdownMap).map((rt) => {
      const unsold = Math.max(0, rt.totalSellableSeats - rt.soldSeats);
      const occ =
        rt.totalSellableSeats > 0
          ? Number(Math.min(100, (rt.soldSeats / rt.totalSellableSeats) * 100).toFixed(2))
          : 0;
      const revShare =
        netRevenue > 0 ? Number(((rt.revenue / netRevenue) * 100).toFixed(1)) : 0;
      return {
        ...rt,
        unsoldSeats: unsold,
        occupancyRate: occ,
        revenueSharePercent: revShare,
        revenueFormatted: formatCurrency(rt.revenue),
      };
    });

    // Chuỗi dữ liệu biểu đồ theo ngày trong kỳ (Asia/Ho_Chi_Minh)
    const revenueTrendMap = {};
    const startParts = getVietnamParts(start);
    const endParts = getVietnamParts(chartEnd || end);
    let cursorMs = makeVietnamDate(startParts.year, startParts.month, startParts.day, 0, 0, 0, 0).getTime();
    const endDayMs = makeVietnamDate(endParts.year, endParts.month, endParts.day, 0, 0, 0, 0).getTime();

    while (cursorMs <= endDayMs) {
      const cDate = new Date(cursorMs);
      const dayKey = formatVietnamDateKey(cDate, 'DD/MM');
      const fullDateKey = formatVietnamDateKey(cDate, 'DD/MM/YYYY');
      revenueTrendMap[fullDateKey] = {
        date: dayKey,
        fullDate: fullDateKey,
        rawDate: cDate,
        ticketRevenue: 0,
        concessionRevenue: 0,
        netRevenue: 0,
        tickets: 0,
        orders: 0,
        showtimesCount: 0,
        sellableSeats: 0,
        occupancyRate: 0,
        expense: 0,
        profit: 0,
      };
      cursorMs += 24 * 60 * 60 * 1000;
    }

    currentBookings.forEach((b) => {
      const fullKey = formatVietnamDateKey(b.createdAt, 'DD/MM/YYYY');
      if (revenueTrendMap[fullKey]) {
        const split = this.resolveBookingSplit(b, b.showtimeId?.price);
        revenueTrendMap[fullKey].ticketRevenue += split.ticketRev;
        revenueTrendMap[fullKey].concessionRevenue += split.concessionRev;
        revenueTrendMap[fullKey].netRevenue += verifiedRevenue(b);
        revenueTrendMap[fullKey].tickets += countSeatsFromString(b.seats);
        revenueTrendMap[fullKey].orders += 1;
      }
    });

    activePeriodShowtimes.forEach((st) => {
      const fullKey = formatVietnamDateKey(st.startTime, 'DD/MM/YYYY');
      if (revenueTrendMap[fullKey]) {
        const seatInfo = seatStats.perShowtimeMap.get(String(st._id));
        revenueTrendMap[fullKey].showtimesCount += 1;
        revenueTrendMap[fullKey].sellableSeats += seatInfo?.totalSeats || 88;
      }
    });

    currentExpenses.forEach((e) => {
      const fullKey = formatVietnamDateKey(e.date, 'DD/MM/YYYY');
      if (revenueTrendMap[fullKey]) {
        revenueTrendMap[fullKey].expense += Number(e.amount || 0);
      }
    });

    Object.values(revenueTrendMap).forEach((d) => {
      d.profit = d.netRevenue - d.expense;
      d.occupancyRate =
        d.sellableSeats > 0
          ? Number(Math.min(100, (d.tickets / d.sellableSeats) * 100).toFixed(2))
          : 0;
    });

    const revenueChartData = Object.values(revenueTrendMap);

    // Thống kê các bộ phim thực sự có hoạt động trong kỳ (KHÔNG dùng dữ liệu tĩnh m.stats từ Movie model!)
    const movieStatsMap = {};
    for (const mv of activeMoviesDocsInPeriod) {
      const mId = String(mv._id);
      movieStatsMap[mId] = {
        movieId: mId,
        id: mId,
        title: mv.title || 'Phim rạp',
        poster: mv.posterUrl || mv.poster || '',
        genre: mv.genre || '',
        status: mv.status,
        revenue: 0,
        ticketRevenue: 0,
        concessionRevenue: 0,
        tickets: 0,
        bookingsCount: 0,
        showtimesCount: 0,
        totalSellableSeats: 0,
        occupancyRate: 0,
      };
    }

    activePeriodShowtimes.forEach((st) => {
      const mv = st.movieId;
      if (!mv) return;
      const mId = String(mv._id || mv);
      if (!movieStatsMap[mId]) {
        movieStatsMap[mId] = {
          movieId: mId,
          id: mId,
          title: mv.title || 'Phim rạp',
          poster: mv.posterUrl || mv.poster || '',
          genre: mv.genre || '',
          status: mv.status,
          revenue: 0,
          ticketRevenue: 0,
          concessionRevenue: 0,
          tickets: 0,
          bookingsCount: 0,
          showtimesCount: 0,
          totalSellableSeats: 0,
          occupancyRate: 0,
        };
      }
      const seatInfo = seatStats.perShowtimeMap.get(String(st._id));
      movieStatsMap[mId].showtimesCount += 1;
      movieStatsMap[mId].totalSellableSeats += seatInfo?.totalSeats || 88;
    });

    currentBookings.forEach((b) => {
      const mv = b.showtimeId?.movieId;
      if (!mv) return;
      const mId = String(mv._id || mv);
      if (!movieStatsMap[mId]) {
        movieStatsMap[mId] = {
          movieId: mId,
          id: mId,
          title: mv.title || 'Phim rạp',
          poster: mv.posterUrl || mv.poster || '',
          genre: mv.genre || '',
          status: mv.status,
          revenue: 0,
          ticketRevenue: 0,
          concessionRevenue: 0,
          tickets: 0,
          bookingsCount: 0,
          showtimesCount: 0,
          totalSellableSeats: 0,
          occupancyRate: 0,
        };
      }
      const split = this.resolveBookingSplit(b, b.showtimeId?.price);
      movieStatsMap[mId].revenue += verifiedRevenue(b);
      movieStatsMap[mId].ticketRevenue += split.ticketRev;
      movieStatsMap[mId].concessionRevenue += split.concessionRev;
      movieStatsMap[mId].tickets += countSeatsFromString(b.seats);
      movieStatsMap[mId].bookingsCount += 1;
    });

    Object.values(movieStatsMap).forEach((m) => {
      m.occupancyRate =
        m.totalSellableSeats > 0
          ? Number(Math.min(100, (m.tickets / m.totalSellableSeats) * 100).toFixed(2))
          : 0;
    });

    const allPeriodMovies = Object.values(movieStatsMap).sort(
      (a, b) =>
        b.revenue - a.revenue ||
        b.tickets - a.tickets ||
        b.showtimesCount - a.showtimesCount ||
        a.title.localeCompare(b.title)
    );

    const topRevenueMovies = allPeriodMovies.slice(0, 5);
    const topTicketsMovies = [...allPeriodMovies]
      .sort(
        (a, b) =>
          b.tickets - a.tickets ||
          b.occupancyRate - a.occupancyRate ||
          b.showtimesCount - a.showtimesCount
      )
      .slice(0, 5);

    // Phân tích theo khung giờ chiếu (Time Slot Performance)
    const timeSlotBuckets = [
      {
        key: 'MORNING',
        slot: '08:00 - 12:00 (Sáng)',
        minHour: 8,
        maxHour: 12,
        showtimesCount: 0,
        sellableSeats: 0,
        tickets: 0,
        bookings: 0,
        revenue: 0,
      },
      {
        key: 'AFTERNOON',
        slot: '12:00 - 17:00 (Chiều)',
        minHour: 12,
        maxHour: 17,
        showtimesCount: 0,
        sellableSeats: 0,
        tickets: 0,
        bookings: 0,
        revenue: 0,
      },
      {
        key: 'PRIME_EVENING',
        slot: '17:00 - 21:00 (Giờ vàng tối)',
        minHour: 17,
        maxHour: 21,
        showtimesCount: 0,
        sellableSeats: 0,
        tickets: 0,
        bookings: 0,
        revenue: 0,
      },
      {
        key: 'LATE_NIGHT',
        slot: '21:00 - 02:00 (Đêm khuya)',
        minHour: 21,
        maxHour: 26,
        showtimesCount: 0,
        sellableSeats: 0,
        tickets: 0,
        bookings: 0,
        revenue: 0,
      },
    ];

    const findBucketForDate = (dt) => {
      const { hour } = getVietnamParts(dt);
      const normHour = hour < 6 ? hour + 24 : hour;
      return (
        timeSlotBuckets.find((b) => normHour >= b.minHour && normHour < b.maxHour) ||
        timeSlotBuckets[timeSlotBuckets.length - 1]
      );
    };

    activePeriodShowtimes.forEach((st) => {
      const bucket = findBucketForDate(st.startTime);
      const seatInfo = seatStats.perShowtimeMap.get(String(st._id));
      bucket.showtimesCount += 1;
      bucket.sellableSeats += seatInfo?.totalSeats || 88;
    });

    currentBookings.forEach((b) => {
      const refTime = b.showtimeId?.startTime || b.createdAt;
      const bucket = findBucketForDate(refTime);
      bucket.tickets += countSeatsFromString(b.seats);
      bucket.bookings += 1;
      bucket.revenue += verifiedRevenue(b);
    });

    const peakHours = timeSlotBuckets.map((b) => ({
      ...b,
      occupancyRate:
        b.sellableSeats > 0
          ? Number(Math.min(100, (b.tickets / b.sellableSeats) * 100).toFixed(2))
          : 0,
      revenueFormatted: formatCurrency(b.revenue),
    }));

    // Suất chiếu sắp diễn ra & Đặt vé gần đây
    const upcomingShowtimes = await Showtime.find({
      ...showtimeFilterMatch,
      cancelledAt: null,
      lifecycleStatus: { $ne: 'CANCELLED' },
      startTime: { $gte: now },
    })
      .populate('movieId', 'title poster posterUrl')
      .populate('cinemaId', 'name')
      .populate('roomId', 'roomNumber name shortName roomType totalSeats')
      .sort({ startTime: 1 })
      .limit(6)
      .lean();

    const recentBookings = currentBookings.slice(0, 6);

    const summaryRows = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'PAID',
          ...(filteredShowtimeIds !== null ? { showtimeId: { $in: filteredShowtimeIds } } : {}),
        },
      },
      { $group: { _id: { $ifNull: ['$paymentStatus', 'LEGACY_UNVERIFIED'] }, count: { $sum: 1 } } },
    ]);
    const paymentCounts = Object.fromEntries(summaryRows.map((entry) => [entry._id, entry.count]));

    const hasActivityInPeriod =
      totalActiveShowtimesCount > 0 ||
      currentBookings.length > 0 ||
      cancelledBookings.length > 0 ||
      currentExpenses.length > 0;

    const dbMode = String(process.env.DB_MODE || 'LIVE').trim().toUpperCase();
    const isSimulatedMode =
      dbMode === 'DEMO' ||
      (simulatedRevenueTotal > 0 && verifiedRevenueTotal === 0) ||
      (paymentCounts.SIMULATED || 0) > (paymentCounts.VERIFIED || 0);

    return {
      timeRangeLabel: label,
      dbMode,
      databaseName: mongoose.connection?.name || 'movietix_db',
      operationStartDate: CINEMA_OPERATION_START,
      operationStartLabel: CINEMA_OPERATION_START_LABEL,
      wasClampedToOperationStart,
      isFirstOperatingMonth,
      hasValidPreviousPeriod,
      momComparisonNote,
      schedulePolicyWarning,
      monthlyScheduledMoviesBreakdown,
      isSimulatedMode,
      revenueSourceBadge: isSimulatedMode ? 'Doanh thu mô phỏng' : 'Dòng tiền thực',
      crossPeriodReconciliation: {
        recognitionBasis: {
          revenueBasis: 'TRANSACTION_DATE (Booking.createdAt)',
          capacityBasis: 'SHOWTIME_DATE (Showtime.startTime)',
        },
        transactionTicketsSoldInPeriod: validTicketsSold,
        showtimeBookedSeatsInPeriod: periodShowtimeBookedSeats,
        advanceTicketsBookedInPeriodForFutureShowtimes: crossPeriodAdvanceTicketsCount,
        advanceRevenueBookedInPeriodForFutureShowtimes: crossPeriodAdvanceRevenue,
        preBookedTicketsFromEarlierPeriodForPeriodShowtimes: preBookedFromEarlierPeriodTicketsCount,
        preBookedRevenueFromEarlierPeriodForPeriodShowtimes: preBookedFromEarlierPeriodRevenue,
      },
      filter: {
        timeRange,
        start,
        end,
        month: targetMonth,
        year: targetYear,
        movieId: movieId || 'ALL',
        roomId: roomId || room || 'ALL',
        roomType: roomType || 'ALL',
      },
      periodMovies: allPeriodMovies,
      hasActivityInPeriod,
      paymentCounts,
      revenueSplitByPaymentStatus: {
        verifiedRevenue: verifiedRevenueTotal,
        verifiedRevenueFormatted: formatExactCurrency(verifiedRevenueTotal),
        simulatedRevenue: simulatedRevenueTotal,
        simulatedRevenueFormatted: formatExactCurrency(simulatedRevenueTotal),
      },
      profitKnown,
      hasExpenseData,
      cinemaCapacity: {
        physicalRoomsCount,
        activePhysicalRoomsCount: activePhysicalRooms.length,
        seatsPerRoom: 88,
        totalPhysicalSeats,
        periodActiveShowtimesCount: totalActiveShowtimesCount,
        periodCompletedShowtimesCount: completedShowtimesCount,
        periodNowShowingShowtimesCount: nowShowingShowtimesCount,
        periodCleaningShowtimesCount: cleaningShowtimesCount,
        periodUpcomingShowtimesCount: upcomingShowtimesCount,
        periodLockedUpcomingShowtimesCount: lockedUpcomingShowtimesCount,
        periodCancelledShowtimesCount: cancelledShowtimesCount,
        periodSellableSeats: totalSellablePeriod,
        periodSoldSeats: periodShowtimeBookedSeats,
        transactionTicketsSold: validTicketsSold,
        periodHoldingSeats: totalHoldingPeriod,
        periodUnsoldSeats: availableSeatsPeriod,
        completedSellableSeats: seatStats.totalCompletedSeats,
        completedSoldSeats,
        completedUnsoldSeats,
        completedOccupancyRate,
        upcomingSellableSeats: seatStats.totalUpcomingSeats,
        upcomingSoldSeats,
        upcomingAvailableSeats,
        upcomingOccupancyRate,
        lockedUpcomingSellableSeats: seatStats.totalLockedUpcomingSeats || 0,
        lockedUpcomingUnsoldSeats,
        immediateWindowBookableSeats: seatStats.totalImmediateWindowBookableSeats || 0,
        beyondWindowBookableSeats: seatStats.totalBeyondWindowBookableSeats || 0,
        missingSeatShowtimesCount: seatStats.missingSeatShowtimesCount,
      },
      momComparison: {
        previousPeriodLabel: prevLabel || 'Tháng đầu vận hành',
        hasValidPreviousPeriod,
        isFirstOperatingMonth,
        note: momComparisonNote,
        revenue: { current: netRevenue, previous: prevNetRevenue, growth: revenueGrowth },
        tickets: { current: validTicketsSold, previous: prevTicketsSold, growth: ticketsGrowth },
        showtimes: {
          current: totalActiveShowtimesCount,
          previous: prevShowtimesCount,
          growth: showtimesGrowth,
        },
        occupancyRate: {
          current: avgTicketSalesRate,
          previous: prevOccupancyRate,
          growth: occupancyGrowth,
        },
        expenses: { current: totalExpenses, previous: prevTotalExpenses, growth: expensesGrowth },
        profit: { current: profit, previous: prevProfit, growth: profitGrowth },
      },
      kpis: {
        netRevenue: {
          value: netRevenue,
          formatted: formatCompactCurrency(netRevenue),
          exactFormatted: formatExactCurrency(netRevenue),
          ticketRevenue: totalTicketRevenue,
          ticketRevenueFormatted: formatExactCurrency(totalTicketRevenue),
          concessionRevenue: totalConcessionRevenue,
          concessionRevenueFormatted: formatExactCurrency(totalConcessionRevenue),
          verifiedRevenue: verifiedRevenueTotal,
          simulatedRevenue: simulatedRevenueTotal,
          grossRevenue: totalGrossRevenue,
          discountAmount: totalDiscountAmount,
          refundedAmount: totalRefunded,
          growth: revenueGrowth,
          subtitle: !hasValidPreviousPeriod ? 'Tháng đầu vận hành' : undefined,
          title: 'Doanh thu thuần',
          tooltip: `Vé: ${formatExactCurrency(totalTicketRevenue)} • Bắp nước: ${formatExactCurrency(totalConcessionRevenue)} • Hoàn tiền: ${formatExactCurrency(totalRefunded)}`,
        },
        // 2. Doanh thu vé
        ticketRevenue: {
          value: totalTicketRevenue,
          formatted: formatCompactCurrency(totalTicketRevenue),
          exactFormatted: formatExactCurrency(totalTicketRevenue),
          title: 'Doanh thu bán vé',
        },
        // 3. Doanh thu bắp nước
        concessionRevenue: {
          value: totalConcessionRevenue,
          formatted: formatCompactCurrency(totalConcessionRevenue),
          exactFormatted: formatExactCurrency(totalConcessionRevenue),
          title: 'Doanh thu bắp nước',
        },
        // 4. Số vé hợp lệ đã bán
        validTicketsSold: {
          value: validTicketsSold,
          formatted: `${validTicketsSold.toLocaleString('vi-VN')} vé`,
          successfulOrders: currentBookings.length,
          cancelledOrders: cancelledOrdersCount,
          cancelledTickets: cancelledTicketsCount,
          growth: ticketsGrowth,
          subtitle: !hasValidPreviousPeriod ? 'Tháng đầu vận hành' : undefined,
          title: 'Vé hợp lệ đã bán',
          tooltip: `${currentBookings.length} đơn thành công (${validTicketsSold} vé) • ${cancelledOrdersCount} đơn hủy/hoàn (${cancelledTicketsCount} vé)`,
        },
        // 5. Số bộ phim có suất chiếu thực tế trong kỳ
        distinctMovies: {
          value: distinctMoviesCount,
          screenedMoviesCount,
          formatted: `${distinctMoviesCount} phim`,
          growth: null,
          title: 'Phim có lịch chiếu',
          tooltip: `${distinctMoviesCount} bộ phim có suất chiếu trong kỳ (${screenedMoviesCount} phim đã/đang chiếu thực tế)`,
        },
        // 6. Số suất chiếu trong kỳ
        totalShowtimes: {
          value: totalActiveShowtimesCount,
          completedCount: completedShowtimesCount,
          nowShowingCount: nowShowingShowtimesCount,
          upcomingCount: upcomingShowtimesCount,
          cancelledCount: cancelledShowtimesCount,
          formatted: `${totalActiveShowtimesCount.toLocaleString('vi-VN')} suất`,
          growth: showtimesGrowth,
          subtitle:
            cancelledShowtimesCount > 0
              ? `Đã loại trừ ${cancelledShowtimesCount} suất hủy`
              : !hasValidPreviousPeriod
              ? 'Tháng đầu vận hành'
              : undefined,
          title: 'Suất chiếu hoạt động',
          tooltip: `Đã chiếu: ${completedShowtimesCount} • Đang chiếu: ${nowShowingShowtimesCount} • Sắp chiếu: ${upcomingShowtimesCount} • Đã hủy: ${cancelledShowtimesCount}`,
        },
        // 7. Tổng chi phí
        totalExpenses: {
          value: totalExpenses,
          formatted: formatCompactCurrency(totalExpenses),
          exactFormatted: formatExactCurrency(totalExpenses),
          hasExpenseData,
          expenseRecordsCount: currentExpenses.length,
          growth: expensesGrowth,
          title: 'Tổng chi phí',
          tooltip: hasExpenseData
            ? `Tổng hợp từ ${currentExpenses.length} khoản chi phí thực tế trong kỳ`
            : 'Chưa có chứng từ chi phí nào được ghi nhận trong kỳ này',
        },
        // 8. Lợi nhuận & Biên lợi nhuận
        profit: {
          value: profit,
          formatted: profitKnown ? formatCompactCurrency(profit) : 'Chưa đủ dữ liệu',
          exactFormatted: profitKnown
            ? formatExactCurrency(profit)
            : 'Chưa ghi nhận chi phí trong kỳ',
          growth: profitGrowth,
          margin: profitMargin,
          status: profitStatus,
          statusLabel: profitStatusLabel,
          title: 'Lợi nhuận rạp',
          tooltip: profitKnown
            ? `Lợi nhuận = Doanh thu thuần (${formatExactCurrency(netRevenue)}) - Chi phí (${formatExactCurrency(totalExpenses)}). Biên LN: ${profitMargin}%`
            : 'Cần nhập chi phí thực tế tại Tab Doanh thu & Chi phí để tính lợi nhuận và biên lợi nhuận chính xác',
        },
        // 9. Tỷ lệ bán vé / Công suất lấp đầy (phân biệt rõ 3 tỷ lệ theo mẫu số)
        ticketRate: {
          value: avgTicketSalesRate,
          formatted: `${avgTicketSalesRate}%`,
          overallOccupancyRate: avgTicketSalesRate,
          completedOccupancyRate,
          upcomingOccupancyRate,
          sold: periodShowtimeBookedSeats,
          transactionTicketsSold: validTicketsSold,
          holding: totalHoldingPeriod,
          available: availableSeatsPeriod,
          totalSellable: totalSellablePeriod,
          growth: occupancyGrowth,
          title: 'Tỷ lệ bán vé trên tổng ghế mở bán',
          tooltip: `Đã đặt ${periodShowtimeBookedSeats.toLocaleString('vi-VN')} / ${totalSellablePeriod.toLocaleString('vi-VN')} ghế mở bán trong kỳ • Suất đã chiếu: ${completedOccupancyRate}% • Suất sắp chiếu: ${upcomingOccupancyRate}%`,
        },
        // 10. Doanh thu trung bình / suất & / ngày
        averages: {
          avgRevenuePerShowtime,
          avgRevenuePerShowtimeFormatted: formatExactCurrency(avgRevenuePerShowtime),
          avgRevenuePerScreenedShowtime,
          avgRevenuePerScreenedShowtimeFormatted: formatExactCurrency(
            avgRevenuePerScreenedShowtime
          ),
          avgRevenuePerDay,
          avgRevenuePerDayFormatted: formatExactCurrency(avgRevenuePerDay),
        },
        // Tương thích ngược
        bookedSeats: {
          value: periodShowtimeBookedSeats,
          formatted: `${periodShowtimeBookedSeats.toLocaleString('vi-VN')} ghế`,
          growth: ticketsGrowth,
          title: 'Ghế đã đặt của suất trong kỳ',
          tooltip: `Số ghế đã đặt trên tổng ${totalSellablePeriod.toLocaleString('vi-VN')} ghế mở bán của các suất chiếu trong kỳ`,
        },
        availableSeats: {
          value: availableSeatsPeriod,
          formatted: `${availableSeatsPeriod.toLocaleString('vi-VN')} ghế`,
          growth: null,
          title: 'Ghế trống vật lý trong kỳ',
          tooltip: `Đã chiếu không bán được: ${completedUnsoldSeats.toLocaleString('vi-VN')} ghế • Sắp chiếu thực sự còn đặt được: ${upcomingAvailableSeats.toLocaleString('vi-VN')} ghế${lockedUpcomingUnsoldSeats > 0 ? ` • Suất tạm khóa: ${lockedUpcomingUnsoldSeats.toLocaleString('vi-VN')} ghế` : ''}`,
        },
        bookedCustomers: {
          value: bookingCustomersCount,
          formatted: `${bookingCustomersCount.toLocaleString('vi-VN')} khách`,
          growth: customersGrowth,
          title: 'Khách hàng đặt vé',
          tooltip: 'Tổng số khách hàng thanh toán vé thành công trong kỳ',
        },
        totalCustomers: {
          value: bookingCustomersCount,
          formatted: `${bookingCustomersCount.toLocaleString('vi-VN')} khách`,
          growth: customersGrowth,
          title: 'Khách hàng đặt vé',
        },
        nowShowingMovies: {
          value: distinctMoviesCount,
          formatted: `${distinctMoviesCount} phim`,
          growth: null,
          title: 'Phim có lịch chiếu',
        },
      },
      occupancy: {
        totalSellable: totalSellablePeriod,
        booked: periodShowtimeBookedSeats,
        transactionTicketsSold: validTicketsSold,
        holding: totalHoldingPeriod,
        available: availableSeatsPeriod,
        completedSellableSeats: seatStats.totalCompletedSeats,
        completedSoldSeats,
        completedUnsoldSeats,
        completedOccupancyRate,
        upcomingSellableSeats: seatStats.totalUpcomingSeats,
        upcomingSoldSeats,
        upcomingAvailableSeats,
        upcomingOccupancyRate,
        lockedUpcomingSellableSeats: seatStats.totalLockedUpcomingSeats || 0,
        lockedUpcomingUnsoldSeats,
        immediateWindowBookableSeats: seatStats.totalImmediateWindowBookableSeats || 0,
        beyondWindowBookableSeats: seatStats.totalBeyondWindowBookableSeats || 0,
        rate: avgTicketSalesRate,
        overallOccupancyRate: avgTicketSalesRate,
        exactRate: exactOccupancyRatio,
        roomCount: physicalRoomsCount,
        activeRoomCount: activePhysicalRooms.length,
        seatsPerRoom: 88,
        totalPhysicalSeats,
        activeShowtimesCount: totalActiveShowtimesCount,
        completedShowtimesCount,
        nowShowingShowtimesCount,
        cleaningShowtimesCount,
        upcomingShowtimesCount,
        lockedUpcomingShowtimesCount,
        cancelledShowtimesCount,
        missingSeatShowtimesCount: seatStats.missingSeatShowtimesCount,
      },
      roomOccupancyBreakdown,
      roomTypeBreakdown,
      revenueChartData,
      topRevenueMovies,
      topTicketsMovies,
      peakHours,
      upcomingShowtimes: upcomingShowtimes.map((st) => ({
        id: st._id,
        movieTitle: st.movieId?.title || 'Phim rạp',
        poster: st.movieId?.posterUrl || st.movieId?.poster || '',
        cinemaName: st.cinemaId?.name || "D'AVENOR Thanh Khê Plaza",
        roomId: st.roomId?._id || st.roomId || null,
        roomName: st.roomId?.name || st.roomName,
        roomType: st.roomId?.roomType || null,
        startTime: st.startTime,
        price: st.price,
      })),
      recentBookings: recentBookings.map((b) => ({
        id: b._id,
        bookingCode: b.bookingCode,
        customerName: b.customerName,
        movieTitle: b.showtimeId?.movieId?.title || 'Phim rạp',
        seats: b.seats,
        totalAmount: b.totalAmount,
        paymentMethod: b.paymentMethod,
        createdAt: b.createdAt,
      })),
    };
  }

  /**
   * 2. TAB DOANH THU & CHI PHÍ - LỢI NHUẬN (REVENUE, COST & PROFITABILITY ANALYTICS)
   */
  async getRevenueStats(filters = {}) {
    const {
      timeRange = 'this_month',
      cinemaId,
      movieId,
      roomId,
      roomType,
      room,
      allocationMethod = 'SHOWTIMES',
    } = filters;

    const parsedDate = this.resolvePeriodFilter(filters);
    const {
      start,
      end,
      showtimeEnd,
      label,
      month: targetMonth,
      year: targetYear,
    } = parsedDate;

    const allRooms = await Room.find({}).sort({ roomNumber: 1 }).lean();
    const roomMap = new Map(allRooms.map((r) => [String(r._id), r]));
    const { match: showtimeFilterMatch } = await this.buildShowtimeFilter(
      { cinemaId, movieId, roomId, roomType, room },
      allRooms
    );

    const hasEntityFilter = Object.keys(showtimeFilterMatch).length > 0;
    let filteredShowtimeIds = null;
    if (hasEntityFilter) {
      const matchedShowtimes = await Showtime.find(showtimeFilterMatch).select('_id').lean();
      filteredShowtimeIds = matchedShowtimes.map((s) => s._id);
    }

    const bookingMatch = {
      createdAt: { $gte: start, $lte: end },
      status: 'PAID',
      paymentStatus: validPayments,
    };
    const cancelledMatch = {
      status: 'CANCELLED',
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { refundStatus: 'REFUNDED', updatedAt: { $gte: start, $lte: end } },
      ],
    };
    if (filteredShowtimeIds !== null) {
      bookingMatch.showtimeId = { $in: filteredShowtimeIds };
      cancelledMatch.showtimeId = { $in: filteredShowtimeIds };
    }

    const periodShowtimeQuery = {
      ...showtimeFilterMatch,
      cancelledAt: null,
      lifecycleStatus: { $ne: 'CANCELLED' },
      startTime: { $gte: start, $lte: showtimeEnd || end },
    };

    const [bookings, cancelledBookings, expenses, periodShowtimes] = await Promise.all([
      Booking.find(bookingMatch)
        .populate({
          path: 'showtimeId',
          populate: [
            { path: 'movieId', select: 'title poster posterUrl duration genre status' },
            { path: 'cinemaId', select: 'name city' },
            { path: 'roomId', select: 'roomNumber name shortName roomType totalSeats' },
          ],
        })
        .sort({ createdAt: -1 })
        .lean(),
      Booking.find(cancelledMatch)
        .populate({
          path: 'showtimeId',
          populate: { path: 'movieId', select: 'title poster posterUrl duration genre' },
        })
        .lean(),
      this.findExpensesInPeriod({
        start,
        end,
        month: targetMonth,
        year: targetYear,
        timeRange,
        movieId,
        roomId,
      }),
      Showtime.find(periodShowtimeQuery)
        .populate('movieId', 'title poster posterUrl duration genre status')
        .populate('roomId', 'roomNumber name shortName roomType totalSeats')
        .lean(),
    ]);

    const { movies: activeMoviesDocsInPeriod, schedulePolicyWarning } =
      await this.resolveActiveMoviesInPeriod({
        periodShowtimes,
        periodBookings: bookings,
        cancelledBookings,
        periodExpenses: expenses,
      });

    let grossRevenue = 0;
    let totalDiscountAmount = 0;
    let verifiedRevenueTotal = 0;
    let simulatedRevenueTotal = 0;
    let ticketRevenue = 0;
    let concessionRevenue = 0;
    let totalTickets = 0;
    const paymentMethodsMap = { MOMO: 0, VNPAY: 0, CASH: 0 };
    const paymentMethodsCount = { MOMO: 0, VNPAY: 0, CASH: 0 };
    const cinemaMap = {};
    const dailyMap = {};
    const movieProfitMap = {};

    const ensureMovieProfitEntry = (mv) => {
      if (!mv) return null;
      const mId = String(mv._id || mv);
      if (!movieProfitMap[mId]) {
        movieProfitMap[mId] = {
          movieId: mId,
          id: mId,
          title: mv.title || 'Phim rạp',
          poster: mv.posterUrl || mv.poster || '',
          genre: mv.genre || '',
          duration: Number(mv.duration || 120),
          showtimesCount: 0,
          screeningMinutes: 0,
          totalSellableSeats: 0,
          orders: 0,
          tickets: 0,
          grossRevenue: 0,
          discountAmount: 0,
          refundedAmount: 0,
          ticketRevenue: 0,
          concessionRevenue: 0,
          totalRevenue: 0,
          netRevenue: 0,
          licenseCost: 0,
          marketingCost: 0,
          directOtherCost: 0,
          directExpenses: 0,
          allocatedOperationalCost: 0,
          totalCost: 0,
          profit: null,
          profitMargin: null,
          roi: null,
          profitStatus: 'INSUFFICIENT_DATA',
          statusLabel: 'Chưa đủ dữ liệu tính lợi nhuận',
          hasExpenseData: false,
        };
      }
      return movieProfitMap[mId];
    };

    for (const mv of activeMoviesDocsInPeriod) {
      ensureMovieProfitEntry(mv);
    }

    let totalTheaterShowtimesInPeriod = 0;
    let totalTheaterScreeningMinutes = 0;

    periodShowtimes.forEach((st) => {
      const entry = ensureMovieProfitEntry(st.movieId);
      if (!entry) return;
      const roomCap = Number(
        st.roomId?.totalSeats || roomMap.get(String(st.roomId))?.totalSeats || 88
      );
      const dur = Number(st.movieId?.duration || 120);
      entry.showtimesCount += 1;
      entry.screeningMinutes += dur;
      entry.totalSellableSeats += roomCap;
      totalTheaterShowtimesInPeriod += 1;
      totalTheaterScreeningMinutes += dur;
    });

    bookings.forEach((b) => {
      const amount = verifiedRevenue(b);
      if (b.paymentStatus === 'VERIFIED') verifiedRevenueTotal += amount;
      else if (b.paymentStatus === 'SIMULATED') simulatedRevenueTotal += amount;

      const seatsCount = countSeatsFromString(b.seats);
      totalTickets += seatsCount;

      const split = this.resolveBookingSplit(b, b.showtimeId?.price);
      ticketRevenue += split.ticketRev;
      concessionRevenue += split.concessionRev;
      totalDiscountAmount += split.discountAmount;
      grossRevenue += split.grossAmount;

      const method = b.paymentMethod || 'MOMO';
      paymentMethodsMap[method] = (paymentMethodsMap[method] || 0) + amount;
      paymentMethodsCount[method] = (paymentMethodsCount[method] || 0) + 1;

      const cinemaName = b.showtimeId?.cinemaId?.name || "D'AVENOR Thanh Khê Plaza";
      if (!cinemaMap[cinemaName]) {
        cinemaMap[cinemaName] = { name: cinemaName, revenue: 0, orders: 0, tickets: 0 };
      }
      cinemaMap[cinemaName].revenue += amount;
      cinemaMap[cinemaName].orders += 1;
      cinemaMap[cinemaName].tickets += seatsCount;

      const dayStr = formatVietnamDateKey(b.createdAt, 'DD/MM/YYYY');
      if (!dailyMap[dayStr]) {
        dailyMap[dayStr] = {
          date: dayStr,
          rawDate: new Date(b.createdAt),
          orders: 0,
          tickets: 0,
          ticketRev: 0,
          concessionRev: 0,
          refunded: 0,
          netRev: 0,
          expense: 0,
          profit: 0,
        };
      }
      dailyMap[dayStr].orders += 1;
      dailyMap[dayStr].tickets += seatsCount;
      dailyMap[dayStr].ticketRev += split.ticketRev;
      dailyMap[dayStr].concessionRev += split.concessionRev;
      dailyMap[dayStr].netRev += amount;

      const entry = ensureMovieProfitEntry(b.showtimeId?.movieId);
      if (entry) {
        entry.orders += 1;
        entry.tickets += seatsCount;
        entry.grossRevenue += split.grossAmount;
        entry.discountAmount += split.discountAmount;
        entry.ticketRevenue += split.ticketRev;
        entry.concessionRevenue += split.concessionRev;
        entry.totalRevenue += amount;
        entry.netRevenue += amount;
      }
    });

    cancelledBookings.forEach((cb) => {
      const refAmt = verifiedRefund(cb);
      const refDate =
        cb.refundStatus === 'REFUNDED' &&
        cb.updatedAt &&
        new Date(cb.updatedAt) >= start &&
        new Date(cb.updatedAt) <= end
          ? cb.updatedAt
          : cb.createdAt;
      const dayStr = formatVietnamDateKey(refDate, 'DD/MM/YYYY');
      if (dailyMap[dayStr]) {
        dailyMap[dayStr].refunded += refAmt;
      }
      const entry = ensureMovieProfitEntry(cb.showtimeId?.movieId);
      if (entry) {
        entry.refundedAmount += refAmt;
      }
    });

    let totalDirectMovieExpenses = 0;
    let totalSharedOperationalExpenses = 0;

    expenses.forEach((e) => {
      const amt = Number(e.amount || 0);
      const dayStr = formatVietnamDateKey(e.date, 'DD/MM/YYYY');
      if (!dailyMap[dayStr]) {
        dailyMap[dayStr] = {
          date: dayStr,
          rawDate: new Date(e.date),
          orders: 0,
          tickets: 0,
          ticketRev: 0,
          concessionRev: 0,
          refunded: 0,
          netRev: 0,
          expense: 0,
          profit: 0,
        };
      }
      dailyMap[dayStr].expense += amt;

      if (e.movieId) {
        const entry = ensureMovieProfitEntry(e.movieId);
        if (entry) {
          if (['MOVIE_LICENSE', 'REVENUE_SHARE', 'DIRECT_MOVIE'].includes(e.type)) {
            entry.licenseCost += amt;
          } else if (e.type === 'MARKETING') {
            entry.marketingCost += amt;
          } else {
            entry.directOtherCost += amt;
          }
          entry.directExpenses += amt;
          totalDirectMovieExpenses += amt;
        }
      } else {
        totalSharedOperationalExpenses += amt;
      }
    });

    const totalRevenue = verifiedRevenueTotal + simulatedRevenueTotal;
    const netRevenue = totalRevenue;
    const refundedAmount = cancelledBookings.reduce((sum, b) => sum + verifiedRefund(b), 0);
    const cancelledAmount = cancelledBookings.reduce(
      (sum, b) => sum + Number(b.totalAmount || 0),
      0
    );
    const aov = bookings.length > 0 ? Math.round(netRevenue / bookings.length) : 0;

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const hasExpenseData = expenses.length > 0;

    const hasVerifiedBookings = bookings.some((order) =>
      ['VERIFIED', 'SIMULATED'].includes(order.paymentStatus)
    );
    const profitKnown = hasExpenseData || hasVerifiedBookings;
    const profit = profitKnown ? netRevenue - totalExpenses : null;
    const profitMargin =
      hasExpenseData && netRevenue > 0
        ? Number(((profit / netRevenue) * 100).toFixed(1))
        : hasExpenseData && totalExpenses > 0
        ? -100
        : 0;
    const roi =
      hasExpenseData && totalExpenses > 0
        ? Number(((profit / totalExpenses) * 100).toFixed(1))
        : null;

    const profitStatus = !hasExpenseData
      ? 'INSUFFICIENT_DATA'
      : profit > 0
      ? 'PROFIT'
      : profit === 0
      ? 'BREAKEVEN'
      : 'LOSS';

    const profitStatusLabel = !hasExpenseData
      ? 'Chưa đủ dữ liệu tính lợi nhuận'
      : profit > 0
      ? 'Có lãi'
      : profit === 0
      ? 'Hòa vốn'
      : 'Thua lỗ';

    Object.values(dailyMap).forEach((d) => {
      d.profit = d.netRev - d.expense;
    });

    const movieEntries = Object.values(movieProfitMap);
    this.allocateSharedExpensesToMovies(movieEntries, totalSharedOperationalExpenses, {
      allocationMethod,
      totalTheaterShowtimes: totalTheaterShowtimesInPeriod,
      totalTheaterScreeningMinutes,
      totalNetRevenue: netRevenue,
    });

    movieEntries.forEach((mv) => {
      mv.allocatedOperationalCost = mv._allocatedCost || 0;
      delete mv._allocatedCost;
      mv.totalCost = mv.directExpenses + mv.allocatedOperationalCost;
      mv.hasExpenseData =
        mv.directExpenses > 0 || mv.allocatedOperationalCost > 0 || hasExpenseData;

      if (mv.hasExpenseData) {
        mv.profit = mv.netRevenue - mv.totalCost;
        mv.profitMargin =
          mv.netRevenue > 0
            ? Number(((mv.profit / mv.netRevenue) * 100).toFixed(1))
            : mv.totalCost > 0
            ? -100
            : 0;
        mv.roi =
          mv.totalCost > 0
            ? Number(((mv.profit / mv.totalCost) * 100).toFixed(1))
            : null;
        if (mv.profit > 0) {
          mv.profitStatus = 'PROFIT';
          mv.statusLabel = 'Có lãi';
        } else if (mv.profit === 0) {
          mv.profitStatus = 'BREAKEVEN';
          mv.statusLabel = 'Hòa vốn';
        } else {
          mv.profitStatus = 'LOSS';
          mv.statusLabel = 'Thua lỗ';
        }
      } else {
        mv.profit = null;
        mv.profitMargin = null;
        mv.roi = null;
        mv.profitStatus = 'INSUFFICIENT_DATA';
        mv.statusLabel = 'Chưa đủ dữ liệu tính lợi nhuận';
      }
    });

    const standardCategories = [
      'MOVIE_LICENSE',
      'REVENUE_SHARE',
      'MARKETING',
      'ELECTRICITY_WATER',
      'STAFF',
      'CLEANING',
      'MAINTENANCE',
      'CONCESSION_COGS',
      'OTHER',
    ];
    const normalizeCategoryKey = (rawType) => {
      if (rawType === 'DIRECT_MOVIE') return 'MOVIE_LICENSE';
      if (rawType === 'OPERATIONAL_CINEMA') return 'MAINTENANCE';
      if (rawType === 'UTILITY') return 'ELECTRICITY_WATER';
      return standardCategories.includes(rawType) ? rawType : 'OTHER';
    };

    const expenseCatMap = {};
    standardCategories.forEach((cat) => {
      expenseCatMap[cat] = {
        type: cat,
        label: EXPENSE_CATEGORY_LABELS[cat] || cat,
        amount: 0,
        count: 0,
      };
    });

    expenses.forEach((e) => {
      const cat = normalizeCategoryKey(e.type);
      expenseCatMap[cat].amount += Number(e.amount || 0);
      expenseCatMap[cat].count += 1;
    });

    const expensesByCategory = Object.values(expenseCatMap)
      .filter(
        (c) =>
          c.amount > 0 ||
          [
            'MOVIE_LICENSE',
            'MARKETING',
            'ELECTRICITY_WATER',
            'STAFF',
            'MAINTENANCE',
            'CONCESSION_COGS',
          ].includes(c.type)
      )
      .map((c) => ({
        ...c,
        formattedAmount: formatCurrency(c.amount),
        compactAmount: formatCompactCurrency(c.amount),
        percent: totalExpenses > 0 ? Number(((c.amount / totalExpenses) * 100).toFixed(1)) : 0,
      }));

    // Báo cáo các tháng kinh doanh của năm (Asia/Ho_Chi_Minh)
    // Năm 2026: Rạp bắt đầu hoạt động từ Tháng 11/2026 nên bảng tháng chỉ bắt đầu từ Tháng 11/2026.
    const reportYear = Math.max(
      CINEMA_OPERATION_START_YEAR,
      Number(targetYear) || getVietnamParts(start).year || CINEMA_OPERATION_START_YEAR
    );
    const startMonthOfYear =
      reportYear === CINEMA_OPERATION_START_YEAR ? CINEMA_OPERATION_START_MONTH : 1;
    const yearStart = makeVietnamDate(reportYear, startMonthOfYear, 1, 0, 0, 0, 0);
    const yearEnd = makeVietnamDate(reportYear, 12, 31, 23, 59, 59, 999);

    const [yearBookings, yearExpenses, yearShowtimes] = await Promise.all([
      Booking.find({
        createdAt: { $gte: yearStart, $lte: yearEnd },
        status: 'PAID',
        paymentStatus: validPayments,
        ...(filteredShowtimeIds !== null ? { showtimeId: { $in: filteredShowtimeIds } } : {}),
      })
        .select('createdAt totalAmount seats paymentStatus')
        .lean(),
      Expense.find({
        $and: [
          { date: { $gte: CINEMA_OPERATION_START } },
          {
            $or: [
              { year: reportYear, month: { $gte: startMonthOfYear } },
              { date: { $gte: yearStart, $lte: yearEnd } },
            ],
          },
        ],
      })
        .select('date month year amount')
        .lean(),
      Showtime.find({
        ...showtimeFilterMatch,
        cancelledAt: null,
        lifecycleStatus: { $ne: 'CANCELLED' },
        startTime: { $gte: yearStart, $lte: yearEnd },
      })
        .select('startTime')
        .lean(),
    ]);

    const monthlyBreakdown = [];
    for (let m = startMonthOfYear; m <= 12; m++) {
      let mNetRevenue = 0;
      let mTickets = 0;
      let mExpenses = 0;
      let mExpenseRecords = 0;
      let mShowtimes = 0;

      yearBookings.forEach((b) => {
        const p = getVietnamParts(b.createdAt);
        if (p.year === reportYear && p.month === m) {
          mNetRevenue += verifiedRevenue(b);
          mTickets += countSeatsFromString(b.seats);
        }
      });

      yearExpenses.forEach((e) => {
        const eMonth = e.month || getVietnamParts(e.date).month;
        const eYear = e.year || getVietnamParts(e.date).year;
        if (eYear === reportYear && eMonth === m) {
          mExpenses += Number(e.amount || 0);
          mExpenseRecords += 1;
        }
      });

      yearShowtimes.forEach((st) => {
        const p = getVietnamParts(st.startTime);
        if (p.year === reportYear && p.month === m) {
          mShowtimes += 1;
        }
      });

      const mHasExpense = mExpenseRecords > 0;
      const mProfit = mHasExpense ? mNetRevenue - mExpenses : null;
      const mMargin =
        mHasExpense && mNetRevenue > 0
          ? Number(((mProfit / mNetRevenue) * 100).toFixed(1))
          : mHasExpense && mExpenses > 0
          ? -100
          : null;
      const mStatus = !mHasExpense
        ? 'INSUFFICIENT_DATA'
        : mProfit > 0
        ? 'PROFIT'
        : mProfit === 0
        ? 'BREAKEVEN'
        : 'LOSS';
      const mStatusLabel = !mHasExpense
        ? mNetRevenue > 0 || mShowtimes > 0
          ? 'Chưa đủ dữ liệu tính lợi nhuận'
          : 'Chưa phát sinh'
        : mProfit > 0
        ? 'Có lãi'
        : mProfit === 0
        ? 'Hòa vốn'
        : 'Thua lỗ';

      monthlyBreakdown.push({
        month: m,
        year: reportYear,
        monthLabel: `Tháng ${m}/${reportYear}`,
        ticketsSold: mTickets,
        showtimesCount: mShowtimes,
        netRevenue: mNetRevenue,
        formattedRevenue: formatCurrency(mNetRevenue),
        expenses: mExpenses,
        hasExpenseData: mHasExpense,
        formattedExpenses: formatCurrency(mExpenses),
        profit: mProfit,
        formattedProfit: mHasExpense ? formatCurrency(mProfit) : 'Chưa đủ dữ liệu',
        profitMargin: mMargin,
        profitStatus: mStatus,
        statusLabel: mStatusLabel,
      });
    }

    const combinedChartData = Object.values(dailyMap)
      .sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate))
      .map((d) => ({
        date: d.date.slice(0, 5),
        fullDate: d.date,
        netRevenue: d.netRev,
        expense: d.expense,
        profit: d.profit,
        ticketRevenue: d.ticketRev,
        concessionRevenue: d.concessionRev,
        tickets: d.tickets,
        orders: d.orders,
      }));

    const sortedMovieProfitRows = movieEntries.sort(
      (a, b) =>
        (b.profit ?? -Infinity) - (a.profit ?? -Infinity) ||
        b.netRevenue - a.netRevenue ||
        b.showtimesCount - a.showtimesCount ||
        a.title.localeCompare(b.title)
    );

    return {
      timeRangeLabel: label,
      operationStartDate: CINEMA_OPERATION_START,
      operationStartLabel: CINEMA_OPERATION_START_LABEL,
      schedulePolicyWarning,
      allocationMethod,
      hasExpenseData,
      periodMovies: sortedMovieProfitRows,
      revenueChartData: combinedChartData,
      combinedChartData,
      monthlyBreakdown,
      metrics: {
        profitKnown,
        hasExpenseData,
        grossRevenue: Math.max(grossRevenue, netRevenue),
        grossFormatted: formatCurrency(Math.max(grossRevenue, netRevenue)),
        discountAmount: totalDiscountAmount,
        discountFormatted: formatCurrency(totalDiscountAmount),
        verifiedRevenue: verifiedRevenueTotal,
        verifiedRevenueFormatted: formatCurrency(verifiedRevenueTotal),
        simulatedRevenue: simulatedRevenueTotal,
        simulatedRevenueFormatted: formatCurrency(simulatedRevenueTotal),
        totalRevenue,
        cancelledAmount,
        netRevenue,
        netFormatted: formatCurrency(netRevenue),
        ticketRevenue,
        ticketFormatted: formatCurrency(ticketRevenue),
        concessionRevenue,
        concessionFormatted: formatCurrency(concessionRevenue),
        refundedAmount,
        refundedFormatted: formatCurrency(refundedAmount),
        totalExpenses,
        directMovieExpenses: totalDirectMovieExpenses,
        sharedOperationalExpenses: totalSharedOperationalExpenses,
        expensesFormatted: formatCurrency(totalExpenses),
        profit,
        profitFormatted: hasExpenseData
          ? formatCurrency(profit)
          : 'Chưa đủ dữ liệu tính lợi nhuận',
        profitMargin,
        roi,
        profitStatus,
        profitStatusLabel,
        aov,
        aovFormatted: formatCurrency(aov),
        successfulOrders: bookings.length,
        cancelledOrders: cancelledBookings.length,
        totalTicketsSold: totalTickets,
        ticketPercent:
          netRevenue > 0 ? Number(((ticketRevenue / netRevenue) * 100).toFixed(1)) : 100,
        concessionPercent:
          netRevenue > 0 ? Number(((concessionRevenue / netRevenue) * 100).toFixed(1)) : 0,
      },
      expensesByCategory,
      paymentMethods: Object.keys(paymentMethodsMap).map((k) => ({
        method: k,
        amount: paymentMethodsMap[k],
        count: paymentMethodsCount[k],
        percent: netRevenue > 0 ? Number(((paymentMethodsMap[k] / netRevenue) * 100).toFixed(1)) : 0,
      })),
      cinemaBreakdown: Object.values(cinemaMap),
      revenueTableRows: Object.values(dailyMap).sort((a, b) => b.rawDate - a.rawDate),
      movieRevenueRows: sortedMovieProfitRows,
    };
  }

  /**
   * 3. TAB HIỆU SUẤT PHIM & SUẤT CHIẾU (MOVIE & SHOWTIME CAPACITY ANALYTICS)
   * Chỉ thống kê các bộ phim thực sự có hoạt động (lịch chiếu / giao dịch / chi phí) trong kỳ báo cáo đang chọn.
   * Không hiển thị 15 phim không có hoạt động chỉ để lấp đầy bảng.
   */
  async getMoviesStats(filters = {}) {
    const {
      timeRange = 'this_month',
      search = '',
      sortBy = 'ticketsSold',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      roomId,
      roomType,
      room,
      includeInactiveMovies = 'false',
    } = filters;

    const parsedDate = this.resolvePeriodFilter(filters);
    const {
      start,
      end,
      showtimeEnd,
      label,
      month: targetMonth,
      year: targetYear,
    } = parsedDate;

    const allRooms = await Room.find({}).sort({ roomNumber: 1 }).lean();
    const roomMap = new Map(allRooms.map((r) => [String(r._id), r]));
    const { match: showtimeFilterMatch } = await this.buildShowtimeFilter(
      { roomId, roomType, room },
      allRooms
    );

    const periodShowtimeQuery = {
      ...showtimeFilterMatch,
      startTime: { $gte: start, $lte: showtimeEnd || end },
    };

    const [periodShowtimes, allPeriodExpenses] = await Promise.all([
      Showtime.find(periodShowtimeQuery)
        .populate('roomId', 'roomNumber name shortName roomType totalSeats')
        .populate('movieId', 'title duration genre poster posterUrl status ageRating slug reviews')
        .lean(),
      this.findExpensesInPeriod({
        start,
        end,
        month: targetMonth,
        year: targetYear,
        timeRange,
        roomId,
      }),
    ]);

    const now = new Date();
    const seatStats = await this.computeShowtimeSeatStats(periodShowtimes, roomMap, now);
    const activePeriodShowtimes = periodShowtimes.filter(
      (st) => !st.cancelledAt && st.lifecycleStatus !== 'CANCELLED'
    );
    const activeShowtimeIds = activePeriodShowtimes.map((st) => st._id);
    const activeShowtimeIdSet = new Set(activeShowtimeIds.map((id) => String(id)));

    const hasRoomEntityFilter = Object.keys(showtimeFilterMatch).length > 0;
    let filteredShowtimeIds = null;
    if (hasRoomEntityFilter) {
      const matchedShowtimes = await Showtime.find(showtimeFilterMatch).select('_id').lean();
      filteredShowtimeIds = matchedShowtimes.map((s) => s._id);
    }

    const bookingMatch = {
      createdAt: { $gte: start, $lte: end },
      status: 'PAID',
      paymentStatus: validPayments,
    };
    const cancelledBookingMatch = {
      status: 'CANCELLED',
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { refundStatus: 'REFUNDED', updatedAt: { $gte: start, $lte: end } },
      ],
    };
    if (filteredShowtimeIds !== null) {
      bookingMatch.showtimeId = { $in: filteredShowtimeIds };
      cancelledBookingMatch.showtimeId = { $in: filteredShowtimeIds };
    }

    const [allPeriodBookings, showtimeBoundBookings, cancelledBookings] = await Promise.all([
      Booking.find(bookingMatch)
        .populate({
          path: 'showtimeId',
          select: 'movieId roomId roomName startTime price',
        })
        .lean(),
      activeShowtimeIds.length > 0
        ? Booking.find({
            showtimeId: { $in: activeShowtimeIds },
            status: 'PAID',
            paymentStatus: validPayments,
          })
            .populate({
              path: 'showtimeId',
              select: 'movieId roomId roomName startTime price',
            })
            .lean()
        : Promise.resolve([]),
      Booking.find(cancelledBookingMatch)
        .populate({
          path: 'showtimeId',
          select: 'movieId',
        })
        .lean(),
    ]);

    let movies = [];
    let schedulePolicyWarning = null;
    let monthlyScheduledMoviesBreakdown = {};

    if (String(includeInactiveMovies) === 'true') {
      const movieQuery = {};
      if (search && search.trim().length > 0) {
        movieQuery.title = { $regex: search.trim(), $options: 'i' };
      }
      movies = await Movie.find(movieQuery).lean();
    } else {
      const resolved = await this.resolveActiveMoviesInPeriod({
        periodShowtimes,
        periodBookings: allPeriodBookings,
        cancelledBookings,
        periodExpenses: allPeriodExpenses,
        search,
      });
      movies = resolved.movies;
      schedulePolicyWarning = resolved.schedulePolicyWarning;
      monthlyScheduledMoviesBreakdown = resolved.monthlyScheduledMoviesBreakdown || {};
    }

    // 1. Gom booking THEO NGÀY GIAO DỊCH TRONG KỲ (Booking.createdAt) cho báo cáo doanh thu tài chính
    const movieBookingsMap = {};
    let theaterTotalNetRevenue = 0;

    allPeriodBookings.forEach((b) => {
      const mv = b.showtimeId?.movieId || b.movieId;
      if (!mv) return;
      const mId = String(mv._id || mv);
      if (!movieBookingsMap[mId]) {
        movieBookingsMap[mId] = {
          tickets: 0,
          orders: 0,
          ticketRevenue: 0,
          concessionRevenue: 0,
          netRevenue: 0,
          grossRevenue: 0,
          discountAmount: 0,
          advanceTicketsForFutureShowtimes: 0,
        };
      }
      const count = countSeatsFromString(b.seats);
      const netAmt = verifiedRevenue(b);
      const split = this.resolveBookingSplit(b, b.showtimeId?.price);

      movieBookingsMap[mId].tickets += count;
      movieBookingsMap[mId].orders += 1;
      movieBookingsMap[mId].ticketRevenue += split.ticketRev;
      movieBookingsMap[mId].concessionRevenue += split.concessionRev;
      movieBookingsMap[mId].netRevenue += netAmt;
      movieBookingsMap[mId].grossRevenue += split.grossAmount;
      movieBookingsMap[mId].discountAmount += split.discountAmount;
      theaterTotalNetRevenue += netAmt;

      const stId = String(b.showtimeId?._id || b.showtimeId || '');
      if (stId && !activeShowtimeIdSet.has(stId)) {
        movieBookingsMap[mId].advanceTicketsForFutureShowtimes += count;
      }
    });

    // 2. Gom ghế đã đặt & doanh thu THEO SUẤT CHIẾU DIỄN RA TRONG KỲ (Showtime.startTime)
    const showtimeTicketsMap = new Map();
    const showtimeRevenueMap = new Map();
    showtimeBoundBookings.forEach((b) => {
      const stId = String(b.showtimeId?._id || b.showtimeId || '');
      if (!stId) return;
      const count = countSeatsFromString(b.seats);
      const netAmt = verifiedRevenue(b);
      showtimeTicketsMap.set(stId, (showtimeTicketsMap.get(stId) || 0) + count);
      showtimeRevenueMap.set(stId, (showtimeRevenueMap.get(stId) || 0) + netAmt);
    });

    // Gom suất chiếu theo phim
    const showtimesByMovieMap = new Map();
    let totalTheaterActiveShowtimes = 0;

    for (const st of periodShowtimes) {
      const mId = String(st.movieId?._id || st.movieId || '');
      if (!mId) continue;
      if (!showtimesByMovieMap.has(mId)) showtimesByMovieMap.set(mId, []);
      showtimesByMovieMap.get(mId).push(st);
      if (!st.cancelledAt && st.lifecycleStatus !== 'CANCELLED') {
        totalTheaterActiveShowtimes += 1;
      }
    }

    // Gom chi phí trực tiếp theo phim & chi phí vận hành chung
    const movieDirectExpensesMap = {};
    let theaterSharedExpenses = 0;
    const hasTheaterExpenseData = allPeriodExpenses.length > 0;

    allPeriodExpenses.forEach((e) => {
      const amt = Number(e.amount || 0);
      if (e.movieId) {
        const mId = String(e.movieId._id || e.movieId);
        if (!movieDirectExpensesMap[mId]) {
          movieDirectExpensesMap[mId] = { license: 0, marketing: 0, other: 0, total: 0 };
        }
        if (['MOVIE_LICENSE', 'REVENUE_SHARE', 'DIRECT_MOVIE'].includes(e.type)) {
          movieDirectExpensesMap[mId].license += amt;
        } else if (e.type === 'MARKETING') {
          movieDirectExpensesMap[mId].marketing += amt;
        } else {
          movieDirectExpensesMap[mId].other += amt;
        }
        movieDirectExpensesMap[mId].total += amt;
      } else {
        theaterSharedExpenses += amt;
      }
    });

    // Tính toán chi tiết cho từng bộ phim hoạt động trong kỳ
    const moviesStatsList = movies.map((m) => {
      const mId = String(m._id);
      const movieShowtimes = showtimesByMovieMap.get(mId) || [];

      let activeShowtimesCount = 0;
      let completedShowtimesCount = 0;
      let nowShowingShowtimesCount = 0;
      let cleaningShowtimesCount = 0;
      let upcomingShowtimesCount = 0;
      let lockedUpcomingShowtimesCount = 0;
      let cancelledShowtimesCount = 0;
      let soldOutShowtimesCount = 0;

      let totalSellableSeats = 0;
      let completedSellableSeats = 0;
      let upcomingSellableSeats = 0;
      let upcomingVerifiedSellableSeats = 0;
      let lockedUpcomingSellableSeats = 0;
      let completedSoldSeats = 0;
      let upcomingSoldSeats = 0;
      let upcomingVerifiedSoldSeats = 0;
      let lockedUpcomingSoldSeats = 0;
      let bookedFromSeatDocs = 0;
      let showtimeBoundTicketsSold = 0;
      let holdingSeatsCount = 0;
      let upcomingHoldingSeatsCount = 0;
      let completedHoldingSeatsCount = 0;

      for (const st of movieShowtimes) {
        const stId = String(st._id);
        const seatInfo = seatStats.perShowtimeMap.get(stId);
        const lifecycle = seatInfo?.lifecycle || this.resolveShowtimeLifecycle(st, now);

        if (lifecycle === 'CANCELLED') {
          cancelledShowtimesCount += 1;
          continue;
        }

        activeShowtimesCount += 1;
        const stCap = seatInfo?.totalSeats || 88;
        const stSold = Math.max(
          seatInfo?.bookedSeatsFromSeatDoc || 0,
          showtimeTicketsMap.get(stId) || 0
        );
        const stHold = seatInfo?.holdingSeats || 0;
        bookedFromSeatDocs += seatInfo?.bookedSeatsFromSeatDoc || 0;
        showtimeBoundTicketsSold += stSold;
        holdingSeatsCount += stHold;

        totalSellableSeats += stCap;
        if (stSold >= stCap && stCap > 0) {
          soldOutShowtimesCount += 1;
        }

        if (lifecycle === 'COMPLETED') {
          completedShowtimesCount += 1;
          completedSellableSeats += stCap;
          completedSoldSeats += stSold;
          completedHoldingSeatsCount += stHold;
        } else if (lifecycle === 'CLEANING') {
          cleaningShowtimesCount += 1;
          completedShowtimesCount += 1;
          completedSellableSeats += stCap;
          completedSoldSeats += stSold;
          completedHoldingSeatsCount += stHold;
        } else if (lifecycle === 'NOW_SHOWING') {
          nowShowingShowtimesCount += 1;
          completedSellableSeats += stCap;
          completedSoldSeats += stSold;
          completedHoldingSeatsCount += stHold;
        } else {
          upcomingShowtimesCount += 1;
          upcomingSellableSeats += stCap;
          upcomingSoldSeats += stSold;
          if (seatInfo?.isLocked) {
            lockedUpcomingShowtimesCount += 1;
            lockedUpcomingSellableSeats += stCap;
            lockedUpcomingSoldSeats += stSold;
          } else if (seatInfo?.isBookableUpcoming) {
            upcomingHoldingSeatsCount += stHold;
            upcomingVerifiedSellableSeats += seatInfo.verifiedSeatDocsCount || stCap;
            upcomingVerifiedSoldSeats += stSold;
          }
        }
      }

      const bookingData = movieBookingsMap[mId] || {
        tickets: 0,
        orders: 0,
        ticketRevenue: 0,
        concessionRevenue: 0,
        netRevenue: 0,
        grossRevenue: 0,
        discountAmount: 0,
        advanceTicketsForFutureShowtimes: 0,
      };

      // Số ghế đã đặt của các suất chiếu diễn ra trong kỳ (tử số của Tỷ lệ lấp đầy công suất)
      const periodShowtimeBookedSeats = Math.max(showtimeBoundTicketsSold, bookedFromSeatDocs);
      // Số vé bán theo ngày phát sinh giao dịch trong kỳ
      const transactionTicketsSold = bookingData.tickets;
      const ticketsSold =
        activeShowtimesCount > 0 ? periodShowtimeBookedSeats : transactionTicketsSold;
      const revenue = bookingData.netRevenue;
      const ticketRevenue = bookingData.ticketRevenue;
      const concessionRevenue = bookingData.concessionRevenue;

      const availableSeats = Math.max(
        0,
        totalSellableSeats - periodShowtimeBookedSeats - holdingSeatsCount
      );
      const completedUnsoldSeats = Math.max(
        0,
        completedSellableSeats - completedSoldSeats - completedHoldingSeatsCount
      );
      const lockedUpcomingUnsoldSeats = Math.max(
        0,
        lockedUpcomingSellableSeats - lockedUpcomingSoldSeats
      );
      const upcomingAvailableSeats = Math.max(
        0,
        upcomingVerifiedSellableSeats - upcomingVerifiedSoldSeats - upcomingHoldingSeatsCount
      );

      // 3 Tỷ lệ công suất chuẩn hóa theo đúng mẫu số (Final Validation Mục 4)
      const occupancyRate =
        totalSellableSeats > 0
          ? Number(Math.min(100, (periodShowtimeBookedSeats / totalSellableSeats) * 100).toFixed(2))
          : 0;
      const completedOccupancyRate =
        completedSellableSeats > 0
          ? Number(Math.min(100, (completedSoldSeats / completedSellableSeats) * 100).toFixed(2))
          : 0;
      const upcomingOccupancyRate =
        upcomingSellableSeats > 0
          ? Number(Math.min(100, (upcomingSoldSeats / upcomingSellableSeats) * 100).toFixed(2))
          : 0;

      const soldOutRate =
        activeShowtimesCount > 0
          ? Number(((soldOutShowtimesCount / activeShowtimesCount) * 100).toFixed(1))
          : 0;

      let performanceStatus = 'NO_SHOWTIMES';
      let performanceLabel = 'Chưa có suất chiếu';
      if (activeShowtimesCount > 0) {
        if (occupancyRate >= 20) {
          performanceStatus = 'HIGH';
          performanceLabel = 'Bán chạy cao';
        } else if (occupancyRate >= 8) {
          performanceStatus = 'MEDIUM';
          performanceLabel = 'Hiệu suất ổn định';
        } else if (ticketsSold > 0) {
          performanceStatus = 'LOW';
          performanceLabel = 'Cần tối ưu suất';
        } else {
          performanceStatus = 'ZERO_SALES';
          performanceLabel = 'Chưa phát sinh vé';
        }
      }

      const directObj = movieDirectExpensesMap[mId] || {
        license: 0,
        marketing: 0,
        other: 0,
        total: 0,
      };

      return {
        id: m._id,
        movieId: mId,
        title: m.title,
        slug: m.slug,
        poster: m.posterUrl || m.poster,
        status: m.status,
        ageRating: m.ageRating || 'P',
        duration: m.duration || 120,
        genre: m.genre || 'Điện ảnh',
        showtimesCount: activeShowtimesCount,
        screenedShowtimesCount: completedShowtimesCount + nowShowingShowtimesCount,
        completedShowtimesCount,
        nowShowingShowtimesCount,
        cleaningShowtimesCount,
        upcomingShowtimesCount,
        lockedUpcomingShowtimesCount,
        cancelledShowtimesCount,
        soldOutShowtimesCount,
        soldOutRate,
        totalSellableSeats,
        completedSellableSeats,
        completedSoldSeats,
        upcomingSellableSeats,
        upcomingSoldSeats,
        ticketsSold,
        showtimeBookedSeats: periodShowtimeBookedSeats,
        transactionTicketsSold,
        advanceTicketsForFutureShowtimes: bookingData.advanceTicketsForFutureShowtimes || 0,
        bookedSeats: periodShowtimeBookedSeats,
        holdingSeats: holdingSeatsCount,
        availableSeats,
        completedUnsoldSeats,
        lockedUpcomingUnsoldSeats,
        upcomingAvailableSeats,
        occupancyRate,
        overallOccupancyRate: occupancyRate,
        completedOccupancyRate,
        upcomingOccupancyRate,
        performanceStatus,
        performanceLabel,
        ordersCount: bookingData.orders,
        grossRevenue: bookingData.grossRevenue,
        discountAmount: bookingData.discountAmount,
        ticketRevenue,
        ticketRevenueFormatted: formatCurrency(ticketRevenue),
        concessionRevenue,
        concessionRevenueFormatted: formatCurrency(concessionRevenue),
        revenue,
        netRevenue: revenue,
        revenueFormatted: formatCurrency(revenue),
        compactRevenue: formatCompactCurrency(revenue),
        licenseCost: directObj.license,
        marketingCost: directObj.marketing,
        directOtherCost: directObj.other,
        directExpenses: directObj.total,
        directExpensesFormatted: formatCurrency(directObj.total),
        allocatedExpenses: 0,
        allocatedExpensesFormatted: '0 đ',
        allocationSharePercent: 0,
        totalExpenses: directObj.total,
        totalExpensesFormatted: formatCurrency(directObj.total),
        profit: null,
        profitFormatted: 'Chưa đủ dữ liệu',
        compactProfit: 'Chưa đủ dữ liệu',
        profitMargin: null,
        roi: null,
        profitStatus: 'INSUFFICIENT_DATA',
        statusLabel: 'Chưa đủ dữ liệu tính lợi nhuận',
        rating: summarizeReviews(m.reviews).rating,
        ratingCount: summarizeReviews(m.reviews).ratingCount,
        hasExpenseData: false,
      };
    });

    // Phân bổ chi phí vận hành chính xác (không lệch số làm tròn)
    this.allocateSharedExpensesToMovies(moviesStatsList, theaterSharedExpenses, {
      allocationMethod: 'SHOWTIMES',
      totalTheaterShowtimes: totalTheaterActiveShowtimes,
      totalNetRevenue: theaterTotalNetRevenue,
    });

    moviesStatsList.forEach((item) => {
      const allocatedExpenses = item._allocatedCost || 0;
      delete item._allocatedCost;
      const totalExpenses = item.directExpenses + allocatedExpenses;
      const hasExpenseData =
        item.directExpenses > 0 || allocatedExpenses > 0 || hasTheaterExpenseData;
      const profit = hasExpenseData ? item.revenue - totalExpenses : null;
      const profitMargin =
        hasExpenseData && item.revenue > 0
          ? Number(((profit / item.revenue) * 100).toFixed(1))
          : hasExpenseData && totalExpenses > 0
          ? -100
          : null;
      const roi =
        hasExpenseData && totalExpenses > 0
          ? Number(((profit / totalExpenses) * 100).toFixed(1))
          : null;
      const profitStatus = !hasExpenseData
        ? 'INSUFFICIENT_DATA'
        : profit > 0
        ? 'PROFIT'
        : profit === 0
        ? 'BREAKEVEN'
        : 'LOSS';
      const statusLabel = !hasExpenseData
        ? 'Chưa đủ dữ liệu tính lợi nhuận'
        : profit > 0
        ? 'Có lãi'
        : profit === 0
        ? 'Hòa vốn'
        : 'Thua lỗ';

      item.allocatedExpenses = allocatedExpenses;
      item.allocatedExpensesFormatted = formatCurrency(allocatedExpenses);
      item.totalExpenses = totalExpenses;
      item.totalExpensesFormatted = formatCurrency(totalExpenses);
      item.hasExpenseData = hasExpenseData;
      item.profit = profit;
      item.profitFormatted = hasExpenseData ? formatCurrency(profit) : 'Chưa đủ dữ liệu';
      item.compactProfit = hasExpenseData ? formatCompactCurrency(profit) : 'Chưa đủ dữ liệu';
      item.profitMargin = profitMargin;
      item.roi = roi;
      item.profitStatus = profitStatus;
      item.statusLabel = statusLabel;
    });

    // Gán thứ hạng bán chạy (salesRank) theo số vé bán -> tỷ lệ lấp đầy -> doanh thu
    const rankedBySales = [...moviesStatsList].sort(
      (a, b) =>
        b.ticketsSold - a.ticketsSold ||
        b.occupancyRate - a.occupancyRate ||
        b.revenue - a.revenue ||
        b.showtimesCount - a.showtimesCount ||
        a.title.localeCompare(b.title)
    );
    const salesRankMap = new Map(rankedBySales.map((item, idx) => [String(item.id), idx + 1]));
    moviesStatsList.forEach((item) => {
      item.salesRank = salesRankMap.get(String(item.id)) || null;
    });

    // Tính toán Xếp hạng tổng kết (Rankings) từ các phim có hoạt động thực tế trong kỳ
    const activeMovies = moviesStatsList.filter((m) => m.showtimesCount > 0 || m.ticketsSold > 0);
    const sortedBySold = [...activeMovies].sort(
      (a, b) => b.ticketsSold - a.ticketsSold || b.occupancyRate - a.occupancyRate
    );
    const sortedByOccupancy = [...activeMovies].sort(
      (a, b) => b.occupancyRate - a.occupancyRate || b.ticketsSold - a.ticketsSold
    );
    const sortedByRevenue = [...activeMovies].sort(
      (a, b) => b.revenue - a.revenue || b.ticketsSold - a.ticketsSold
    );
    const moviesWithExpense = activeMovies.filter((m) => m.hasExpenseData && m.profit !== null);
    const sortedByProfit = [...moviesWithExpense].sort((a, b) => b.profit - a.profit);

    const topSold = sortedBySold[0] || null;
    const lowestSold = sortedBySold.length > 0 ? sortedBySold[sortedBySold.length - 1] : null;
    const topOccupancy = sortedByOccupancy[0] || null;
    const lowestOccupancy =
      sortedByOccupancy.length > 0 ? sortedByOccupancy[sortedByOccupancy.length - 1] : null;
    const topRevenue = sortedByRevenue[0] || null;
    const topProfit = sortedByProfit[0] || null;
    const topLoss =
      sortedByProfit.length > 0 && sortedByProfit[sortedByProfit.length - 1].profit < 0
        ? sortedByProfit[sortedByProfit.length - 1]
        : null;

    // Sắp xếp danh sách phim theo bộ lọc sortBy & sortOrder
    moviesStatsList.sort((a, b) => {
      if (
        sortOrder === 'desc' &&
        (a.showtimesCount > 0) !== (b.showtimesCount > 0) &&
        sortBy !== 'lowestPerformance'
      ) {
        return a.showtimesCount > 0 ? -1 : 1;
      }
      if (sortBy === 'lowestPerformance') {
        const aActive = a.showtimesCount > 0 ? 0 : 1;
        const bActive = b.showtimesCount > 0 ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return a.occupancyRate - b.occupancyRate || a.ticketsSold - b.ticketsSold;
      }
      const rawA = a[sortBy];
      const rawB = b[sortBy];
      const valA = rawA === null || rawA === undefined ? -Infinity : Number(rawA);
      const valB = rawB === null || rawB === undefined ? -Infinity : Number(rawB);
      if (valA === valB) {
        return (
          b.showtimesCount - a.showtimesCount ||
          b.ticketsSold - a.ticketsSold ||
          a.title.localeCompare(b.title)
        );
      }
      if (sortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    const totalItems = moviesStatsList.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedItems = moviesStatsList.slice(startIndex, startIndex + Number(limit));

    const totalRevenueAll = moviesStatsList.reduce((s, m) => s + m.revenue, 0);
    const totalTicketsAll = moviesStatsList.reduce((s, m) => s + m.ticketsSold, 0);
    const totalTransactionTicketsAll = moviesStatsList.reduce(
      (s, m) => s + (m.transactionTicketsSold ?? m.ticketsSold),
      0
    );
    const totalSellableAll = moviesStatsList.reduce((s, m) => s + m.totalSellableSeats, 0);
    const totalCompletedSellableAll = moviesStatsList.reduce(
      (s, m) => s + (m.completedSellableSeats || 0),
      0
    );
    const totalCompletedSoldAll = moviesStatsList.reduce(
      (s, m) => s + (m.completedSoldSeats || 0),
      0
    );
    const totalUpcomingSellableAll = moviesStatsList.reduce(
      (s, m) => s + (m.upcomingSellableSeats || 0),
      0
    );
    const totalUpcomingSoldAll = moviesStatsList.reduce(
      (s, m) => s + (m.upcomingSoldSeats || 0),
      0
    );
    const totalHoldingAll = moviesStatsList.reduce((s, m) => s + (m.holdingSeats || 0), 0);
    const totalCompletedUnsoldAll = moviesStatsList.reduce((s, m) => s + m.completedUnsoldSeats, 0);
    const totalLockedUpcomingUnsoldAll = moviesStatsList.reduce(
      (s, m) => s + (m.lockedUpcomingUnsoldSeats || 0),
      0
    );
    const totalUpcomingAvailableAll = moviesStatsList.reduce(
      (s, m) => s + m.upcomingAvailableSeats,
      0
    );
    const totalShowtimesAll = moviesStatsList.reduce((s, m) => s + m.showtimesCount, 0);
    const totalSoldOutShowtimesAll = moviesStatsList.reduce(
      (s, m) => s + m.soldOutShowtimesCount,
      0
    );
    const totalExpensesAll = moviesStatsList.reduce((s, m) => s + m.totalExpenses, 0);
    const totalProfitAll = hasTheaterExpenseData ? totalRevenueAll - totalExpensesAll : null;

    return {
      timeRangeLabel: label,
      operationStartDate: CINEMA_OPERATION_START,
      operationStartLabel: CINEMA_OPERATION_START_LABEL,
      schedulePolicyWarning,
      monthlyScheduledMoviesBreakdown,
      hasExpenseData: hasTheaterExpenseData,
      total: totalItems,
      activeMoviesCount: activeMovies.length,
      page: Number(page),
      totalPages: Math.ceil(totalItems / Number(limit)) || 1,
      items: paginatedItems,
      allActiveMovies: activeMovies,
      periodMovies: moviesStatsList,
      rankings: {
        topSold,
        topOccupancy,
        lowestSold,
        lowestOccupancy,
        topRevenue,
        topProfit,
        topLoss,
      },
      summary: {
        activeMoviesCount: activeMovies.length,
        totalShowtimes: totalShowtimesAll,
        totalSoldOutShowtimes: totalSoldOutShowtimesAll,
        totalRevenue: totalRevenueAll,
        totalRevenueFormatted: formatCurrency(totalRevenueAll),
        totalTicketsSold: totalTicketsAll,
        totalTransactionTicketsSold: totalTransactionTicketsAll,
        totalSellableSeats: totalSellableAll,
        totalHoldingSeats: totalHoldingAll,
        totalAvailableSeats: Math.max(0, totalSellableAll - totalTicketsAll - totalHoldingAll),
        totalCompletedUnsoldSeats: totalCompletedUnsoldAll,
        totalLockedUpcomingUnsoldSeats: totalLockedUpcomingUnsoldAll,
        totalUpcomingAvailableSeats: totalUpcomingAvailableAll,
        missingSeatShowtimesCount: seatStats.missingSeatShowtimesCount,
        overallOccupancyRate:
          totalSellableAll > 0
            ? Number(((totalTicketsAll / totalSellableAll) * 100).toFixed(2))
            : 0,
        completedOccupancyRate:
          totalCompletedSellableAll > 0
            ? Number(((totalCompletedSoldAll / totalCompletedSellableAll) * 100).toFixed(2))
            : 0,
        upcomingOccupancyRate:
          totalUpcomingSellableAll > 0
            ? Number(((totalUpcomingSoldAll / totalUpcomingSellableAll) * 100).toFixed(2))
            : 0,
        totalExpenses: totalExpensesAll,
        totalExpensesFormatted: formatCurrency(totalExpensesAll),
        hasExpenseData: hasTheaterExpenseData,
        totalProfit: totalProfitAll,
        totalProfitFormatted: hasTheaterExpenseData
          ? formatCurrency(totalProfitAll)
          : 'Chưa đủ dữ liệu',
        profitMargin:
          hasTheaterExpenseData && totalRevenueAll > 0
            ? Number(((totalProfitAll / totalRevenueAll) * 100).toFixed(1))
            : null,
      },
    };
  }

  /**
   * 3.1 CHI TIẾT THỐNG KÊ 1 BỘ PHIM (MOVIE DETAIL DRAWER)
   */
  async getMovieDetailStats(movieId, filters = {}) {
    let movie = null;
    if (mongoose.Types.ObjectId.isValid(movieId)) {
      movie = await Movie.findById(movieId).lean();
    }
    if (!movie) {
      movie = await Movie.findOne({ slug: movieId }).lean();
    }
    if (!movie) {
      throw new Error('Không tìm thấy thông tin bộ phim yêu cầu');
    }

    const allRooms = await Room.find({}).lean();
    const roomMap = new Map(allRooms.map((r) => [String(r._id), r]));
    const { match: roomFilterMatch } = await this.buildShowtimeFilter(
      {
        cinemaId: filters.cinemaId,
        roomId: filters.roomId,
        roomType: filters.roomType,
        room: filters.room,
      },
      allRooms
    );

    const showtimeQuery = {
      ...roomFilterMatch,
      movieId: movie._id,
    };

    let periodRange = null;
    if (filters.timeRange || filters.month || filters.year) {
      periodRange = this.resolvePeriodFilter(filters);
      showtimeQuery.startTime = {
        $gte: periodRange.start,
        $lte: periodRange.showtimeEnd || periodRange.end,
      };
    } else {
      showtimeQuery.startTime = { $gte: CINEMA_OPERATION_START };
    }

    const showtimes = await Showtime.find(showtimeQuery)
      .populate('cinemaId', 'name city')
      .populate('roomId', 'roomNumber name shortName roomType totalSeats')
      .sort({ startTime: -1 })
      .lean();

    const now = new Date();
    const seatStats = await this.computeShowtimeSeatStats(showtimes, roomMap, now);

    const stIds = showtimes.map((s) => s._id);

    // 1. Lấy tất cả các đơn PAID thuộc các suất chiếu diễn ra trong kỳ của bộ phim (kể cả khách mua trước từ tháng trước) -> Tính công suất ghế & bảng suất chiếu
    // 2. Lấy tất cả các đơn PAID phát sinh giao dịch trong kỳ của bộ phim (createdAt trong kỳ) -> Tính doanh thu giao dịch trong kỳ (không mất doanh thu đặt trước cho tháng sau)
    const txBookingQuery = {
      status: 'PAID',
      paymentStatus: validPayments,
    };
    if (periodRange) {
      txBookingQuery.createdAt = { $gte: periodRange.start, $lte: periodRange.end };
    } else {
      txBookingQuery.createdAt = { $gte: CINEMA_OPERATION_START };
    }

    const allMovieShowtimeIds = await Showtime.find({
      ...roomFilterMatch,
      movieId: movie._id,
    })
      .select('_id')
      .lean();
    txBookingQuery.showtimeId = { $in: allMovieShowtimeIds.map((s) => s._id) };

    const [showtimeBoundBookings, transactionBookings] = await Promise.all([
      stIds.length > 0
        ? Booking.find({
            showtimeId: { $in: stIds },
            status: 'PAID',
            paymentStatus: validPayments,
          })
            .sort({ createdAt: -1 })
            .lean()
        : Promise.resolve([]),
      Booking.find(txBookingQuery).sort({ createdAt: -1 }).lean(),
    ]);

    let totalRevenue = 0;
    let totalTicketRevenue = 0;
    let totalConcessionRevenue = 0;
    let totalTickets = 0;
    const dailyMap = {};
    const stBookingStatsMap = new Map();

    // Tính doanh thu giao dịch trong kỳ từ transactionBookings
    transactionBookings.forEach((b) => {
      const netAmt = verifiedRevenue(b);
      const count = countSeatsFromString(b.seats);
      const split = this.resolveBookingSplit(b, 95000);

      totalRevenue += netAmt;
      totalTicketRevenue += split.ticketRev;
      totalConcessionRevenue += split.concessionRev;
      totalTickets += count;

      const dayStr = formatVietnamDateKey(b.createdAt, 'DD/MM');
      if (!dailyMap[dayStr]) dailyMap[dayStr] = { date: dayStr, revenue: 0, tickets: 0 };
      dailyMap[dayStr].revenue += netAmt;
      dailyMap[dayStr].tickets += count;
    });

    // Tính số vé & doanh thu gắn với từng suất chiếu diễn ra trong kỳ từ showtimeBoundBookings
    let showtimeBoundTicketsTotal = 0;
    let showtimeBoundRevenueTotal = 0;
    showtimeBoundBookings.forEach((b) => {
      const netAmt = verifiedRevenue(b);
      const count = countSeatsFromString(b.seats);
      showtimeBoundTicketsTotal += count;
      showtimeBoundRevenueTotal += netAmt;

      const sId = String(b.showtimeId);
      const cur = stBookingStatsMap.get(sId) || { tickets: 0, revenue: 0, orders: 0 };
      cur.tickets += count;
      cur.revenue += netAmt;
      cur.orders += 1;
      stBookingStatsMap.set(sId, cur);
    });

    const activeShowtimes = showtimes.filter(
      (st) => !st.cancelledAt && st.lifecycleStatus !== 'CANCELLED'
    );
    const totalSellable = seatStats.totalSellableSeats;
    const totalHolding = seatStats.totalHoldingSeats || 0;

    let bookedFromSeatDocs = 0;
    let completedSoldSeats = 0;
    let upcomingSoldSeats = 0;
    let upcomingBookableSoldSeats = 0;
    let lockedUpcomingSoldSeats = 0;
    for (const st of activeShowtimes) {
      const sId = String(st._id);
      const seatInfo = seatStats.perShowtimeMap.get(sId);
      const bkInfo = stBookingStatsMap.get(sId) || { tickets: 0 };
      const soldForSt = Math.max(seatInfo?.bookedSeatsFromSeatDoc || 0, bkInfo.tickets);
      bookedFromSeatDocs += seatInfo?.bookedSeatsFromSeatDoc || 0;
      if (
        seatInfo?.lifecycle === 'COMPLETED' ||
        seatInfo?.lifecycle === 'NOW_SHOWING' ||
        seatInfo?.lifecycle === 'CLEANING'
      ) {
        completedSoldSeats += soldForSt;
      } else {
        upcomingSoldSeats += soldForSt;
        if (seatInfo?.isLocked) {
          lockedUpcomingSoldSeats += soldForSt;
        } else if (seatInfo?.isBookableUpcoming) {
          upcomingBookableSoldSeats += soldForSt;
        }
      }
    }

    const bookedSeats = Math.max(showtimeBoundTicketsTotal, bookedFromSeatDocs);
    const availableSeats = Math.max(0, totalSellable - bookedSeats - totalHolding);
    const completedUnsoldSeats = Math.max(
      0,
      seatStats.totalCompletedSeats - completedSoldSeats - (seatStats.totalCompletedHoldingSeats || 0)
    );
    const lockedUpcomingUnsoldSeats = Math.max(
      0,
      (seatStats.totalLockedUpcomingSeats || 0) - lockedUpcomingSoldSeats
    );
    const upcomingAvailableSeats = Math.max(
      0,
      seatStats.totalUpcomingVerifiedSeats -
        upcomingBookableSoldSeats -
        (seatStats.totalUpcomingHoldingSeats || 0)
    );
    const avgOccupancy =
      totalSellable > 0
        ? Number(Math.min(100, (bookedSeats / totalSellable) * 100).toFixed(2))
        : 0;
    const completedOccupancyRate =
      seatStats.totalCompletedSeats > 0
        ? Number(
            Math.min(100, (completedSoldSeats / seatStats.totalCompletedSeats) * 100).toFixed(2)
          )
        : 0;
    const upcomingOccupancyRate =
      seatStats.totalUpcomingSeats > 0
        ? Number(
            Math.min(100, (upcomingSoldSeats / seatStats.totalUpcomingSeats) * 100).toFixed(2)
          )
        : 0;

    const expQuery = { movieId: movie._id };
    const sharedExpQuery = { movieId: null };
    const totalStQuery = {
      ...roomFilterMatch,
      cancelledAt: null,
      lifecycleStatus: { $ne: 'CANCELLED' },
    };
    if (periodRange) {
      expQuery.date = { $gte: periodRange.start, $lte: periodRange.end };
      sharedExpQuery.date = { $gte: periodRange.start, $lte: periodRange.end };
      totalStQuery.startTime = {
        $gte: periodRange.start,
        $lte: periodRange.showtimeEnd || periodRange.end,
      };
    } else {
      expQuery.date = { $gte: CINEMA_OPERATION_START };
      sharedExpQuery.date = { $gte: CINEMA_OPERATION_START };
      totalStQuery.startTime = { $gte: CINEMA_OPERATION_START };
    }

    const [movieExpenses, allSharedExpenses, allActiveTheaterShowtimes] = await Promise.all([
      Expense.find(expQuery).sort({ date: -1 }).lean(),
      Expense.find(sharedExpQuery).lean(),
      Showtime.find(totalStQuery).select('movieId').lean(),
    ]);

    const directExpenses = movieExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const sharedExpenses = allSharedExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    // Sử dụng cùng thuật toán allocateSharedExpensesToMovies để khớp 100% đến từng đồng với bảng
    const showtimeCountsByMovie = new Map();
    for (const st of allActiveTheaterShowtimes) {
      const mId = String(st.movieId);
      showtimeCountsByMovie.set(mId, (showtimeCountsByMovie.get(mId) || 0) + 1);
    }
    const targetMovieIdStr = String(movie._id);
    if (!showtimeCountsByMovie.has(targetMovieIdStr) && activeShowtimes.length > 0) {
      showtimeCountsByMovie.set(targetMovieIdStr, activeShowtimes.length);
    }
    const tempEntries = Array.from(showtimeCountsByMovie.entries()).map(([mId, stCount]) => ({
      movieId: mId,
      showtimesCount: stCount,
      netRevenue: mId === targetMovieIdStr ? totalRevenue : 0,
    }));
    this.allocateSharedExpensesToMovies(tempEntries, sharedExpenses, {
      allocationMethod: 'SHOWTIMES',
      totalTheaterShowtimes: allActiveTheaterShowtimes.length,
    });
    const matchedAlloc = tempEntries.find((e) => e.movieId === targetMovieIdStr);
    const allocatedExpenses = matchedAlloc ? matchedAlloc._allocatedCost || 0 : 0;

    const totalExpenses = directExpenses + allocatedExpenses;
    const hasExpenseData = movieExpenses.length > 0 || allSharedExpenses.length > 0;
    const profit = hasExpenseData ? totalRevenue - totalExpenses : null;
    const profitMargin =
      hasExpenseData && totalRevenue > 0
        ? Number(((profit / totalRevenue) * 100).toFixed(1))
        : hasExpenseData && totalExpenses > 0
        ? -100
        : null;
    const roi =
      hasExpenseData && totalExpenses > 0
        ? Number(((profit / totalExpenses) * 100).toFixed(1))
        : null;

    const showtimesList = showtimes.map((st) => {
      const sId = String(st._id);
      const seatInfo = seatStats.perShowtimeMap.get(sId);
      const bkInfo = stBookingStatsMap.get(sId) || { tickets: 0, revenue: 0, orders: 0 };
      const totalSeats = seatInfo?.totalSeats || Number(st.roomId?.totalSeats || 88);
      const soldSeats = Math.max(seatInfo?.bookedSeatsFromSeatDoc || 0, bkInfo.tickets);
      const holdingSeats = seatInfo?.holdingSeats || 0;
      const unsoldSeats = Math.max(0, totalSeats - soldSeats - holdingSeats);
      const occ =
        totalSeats > 0 ? Number(Math.min(100, (soldSeats / totalSeats) * 100).toFixed(2)) : 0;
      const lifecycle = seatInfo?.lifecycle || this.resolveShowtimeLifecycle(st, now);

      return {
        id: st._id,
        roomId: st.roomId?._id || st.roomId || null,
        roomNumber: st.roomId?.roomNumber || null,
        roomName: st.roomId?.name || st.roomName,
        shortRoomName: st.roomId?.shortName || st.roomName,
        roomType: st.roomId?.roomType || null,
        cinemaName: st.cinemaId?.name || "D'AVENOR Thanh Khê Plaza",
        startTime: st.startTime,
        endTime: st.endTime,
        price: st.price,
        totalSeats,
        hasSeatRecords: Boolean(seatInfo?.hasSeatRecords),
        soldSeats,
        holdingSeats,
        unsoldSeats,
        occupancyRate: occ,
        isSoldOut: soldSeats >= totalSeats && totalSeats > 0,
        revenue: bkInfo.revenue,
        revenueFormatted: formatCurrency(bkInfo.revenue),
        ordersCount: bkInfo.orders,
        lifecycleStatus: lifecycle,
      };
    });

    const soldOutShowtimesCount = showtimesList.filter(
      (s) => s.lifecycleStatus !== 'CANCELLED' && s.isSoldOut
    ).length;

    return {
      movie: {
        id: movie._id,
        title: movie.title,
        slug: movie.slug,
        poster: movie.posterUrl || movie.poster,
        banner: movie.bannerUrl,
        duration: movie.duration,
        genre: movie.genre,
        ageRating: movie.ageRating,
        director: movie.director,
        cast: Array.isArray(movie.cast) ? movie.cast.map((c) => c.name).join(', ') : '',
        status: movie.status,
        rating: summarizeReviews(movie.reviews).rating,
        ratingCount: summarizeReviews(movie.reviews).ratingCount,
      },
      stats: {
        totalRevenue,
        showtimeBoundRevenue: showtimeBoundRevenueTotal,
        ticketRevenue: totalTicketRevenue,
        concessionRevenue: totalConcessionRevenue,
        revenueFormatted: formatCurrency(totalRevenue),
        totalTickets: activeShowtimes.length > 0 ? bookedSeats : totalTickets,
        transactionTicketsSold: totalTickets,
        bookedSeats,
        holdingSeats: totalHolding,
        availableSeats,
        completedSellableSeats: seatStats.totalCompletedSeats,
        completedSoldSeats,
        completedUnsoldSeats,
        completedOccupancyRate,
        upcomingSellableSeats: seatStats.totalUpcomingSeats,
        upcomingSoldSeats,
        upcomingAvailableSeats,
        upcomingOccupancyRate,
        lockedUpcomingUnsoldSeats,
        totalSeats: totalSellable,
        showtimesCount: activeShowtimes.length,
        cancelledShowtimesCount: showtimes.length - activeShowtimes.length,
        soldOutShowtimesCount,
        missingSeatShowtimesCount: seatStats.missingSeatShowtimesCount,
        avgOccupancy,
        overallOccupancyRate: avgOccupancy,
        hasExpenseData,
        directExpenses,
        directExpensesFormatted: formatCurrency(directExpenses),
        allocatedExpenses,
        allocatedExpensesFormatted: formatCurrency(allocatedExpenses),
        totalExpenses,
        totalExpensesFormatted: formatCurrency(totalExpenses),
        profit,
        profitFormatted: hasExpenseData
          ? formatCurrency(profit)
          : 'Chưa đủ dữ liệu tính lợi nhuận',
        profitMargin,
        roi,
        profitStatus: !hasExpenseData
          ? 'INSUFFICIENT_DATA'
          : profit > 0
          ? 'PROFIT'
          : profit === 0
          ? 'BREAKEVEN'
          : 'LOSS',
        profitStatusLabel: !hasExpenseData
          ? 'Chưa đủ dữ liệu tính lợi nhuận'
          : profit > 0
          ? 'Có lãi'
          : profit === 0
          ? 'Hòa vốn'
          : 'Thua lỗ',
      },
      expensesList: movieExpenses.map((e) => ({
        id: e._id,
        costCode: e.costCode,
        title: e.title,
        type: e.type,
        categoryLabel: EXPENSE_CATEGORY_LABELS[e.type] || e.type,
        amount: e.amount,
        formattedAmount: formatCurrency(e.amount),
        date: e.date,
        notes: e.notes,
      })),
      trend: Object.values(dailyMap),
      showtimesList,
      ratingBreakdown: summarizeReviews(movie.reviews).ratingBreakdown,
      reviews: summarizeReviews(movie.reviews).reviews,
    };
  }

  /**
   * 4. TAB THỐNG KÊ SUẤT CHIẾU (SHOWTIME ANALYTICS)
   */
  async getShowtimesStats(filters = {}) {
    const {
      movieId,
      cinemaId,
      roomId,
      roomType,
      room,
      status,
      search = '',
      page = 1,
      limit = 15,
    } = filters;

    const parsedDate = this.resolvePeriodFilter(filters);
    const { start, end, showtimeEnd, label } = parsedDate;

    const allRooms = await Room.find({}).sort({ roomNumber: 1 }).lean();
    const roomMap = new Map(allRooms.map((r) => [String(r._id), r]));
    const { match: showtimeFilterMatch } = await this.buildShowtimeFilter(
      { cinemaId, movieId, roomId, roomType, room },
      allRooms
    );

    const query = {
      ...showtimeFilterMatch,
      startTime: { $gte: start, $lte: showtimeEnd || end },
    };

    let showtimes = await Showtime.find(query)
      .populate('movieId', 'title poster posterUrl status duration genre')
      .populate('cinemaId', 'name city')
      .populate('roomId', 'roomNumber name shortName roomType formatFeature totalSeats')
      .sort({ startTime: -1 })
      .lean();

    const { movies: periodMoviesDocs, schedulePolicyWarning } =
      await this.resolveActiveMoviesInPeriod({
        periodShowtimes: showtimes,
      });

    const now = new Date();
    if (status && status !== 'ALL') {
      showtimes = showtimes.filter((st) => {
        const lc = this.resolveShowtimeLifecycle(st, now);
        if (status === 'FINISHED') return lc === 'COMPLETED';
        return lc === status;
      });
    }

    if (search && search.trim().length > 0) {
      const term = search.toLowerCase().trim();
      showtimes = showtimes.filter(
        (st) =>
          (st.movieId?.title && st.movieId.title.toLowerCase().includes(term)) ||
          (st.roomName && st.roomName.toLowerCase().includes(term)) ||
          (st.roomId?.name && st.roomId.name.toLowerCase().includes(term)) ||
          (st.roomId?.roomType && st.roomId.roomType.toLowerCase().includes(term))
      );
    }

    const total = showtimes.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const pageShowtimes = showtimes.slice(startIndex, startIndex + Number(limit));
    const ids = pageShowtimes.map((slot) => slot._id);

    const [orders, counts] = await Promise.all([
      Booking.find({
        showtimeId: { $in: ids },
        status: 'PAID',
        paymentStatus: validPayments,
      })
        .select('showtimeId userId customerPhone seats totalAmount paymentStatus')
        .lean(),
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
            available: { $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const orderMap = new Map();
    for (const order of orders) {
      const id = String(order.showtimeId);
      if (!orderMap.has(id)) orderMap.set(id, []);
      orderMap.get(id).push(order);
    }
    const seatCounts = new Map(counts.map((count) => [String(count._id), count]));

    const items = pageShowtimes.map((st) => {
      const bookings = orderMap.get(String(st._id)) || [];
      const customers = new Set(
        bookings.map((booking) => String(booking.userId || booking.customerPhone || booking._id))
      );
      const revenue = bookings.reduce((sum, booking) => sum + verifiedRevenue(booking), 0);
      const bookedFromOrders = bookings.reduce(
        (sum, booking) => sum + countSeatsFromString(booking.seats),
        0
      );

      const c = seatCounts.get(String(st._id));
      const roomDoc = roomMap.get(String(st.roomId?._id || st.roomId));
      const hasSeatRecords = Boolean(c && c.total > 0);
      const totalSeats = hasSeatRecords
        ? c.total
        : Number(st.roomId?.totalSeats || roomDoc?.totalSeats || 88);
      const bookedSeats = hasSeatRecords ? Math.max(c.booked, bookedFromOrders) : bookedFromOrders;
      const holdingSeats = hasSeatRecords ? c.holding || 0 : 0;
      const availableSeats = Math.max(0, totalSeats - bookedSeats - holdingSeats);
      const occupancyRate =
        totalSeats > 0
          ? Number(Math.min(100, (bookedSeats / totalSeats) * 100).toFixed(2))
          : 0;

      const lifecycle = this.resolveShowtimeLifecycle(st, now);
      let showtimeStatus = 'UPCOMING';
      if (lifecycle === 'CANCELLED') showtimeStatus = 'CANCELLED';
      else if (lifecycle === 'COMPLETED') showtimeStatus = 'FINISHED';
      else if (lifecycle === 'CLEANING') showtimeStatus = 'CLEANING';
      else if (lifecycle === 'NOW_SHOWING') showtimeStatus = 'NOW_SHOWING';
      else if (st.isLocked) showtimeStatus = 'LOCKED';

      const bookability = this.evaluateShowtimeBookability(st, {
        lifecycle,
        hasSeatRecords,
        roomDoc,
        now,
      });
      const isBookableUpcoming = bookability.isBookableUpcoming;
      const bookableAvailableSeats = isBookableUpcoming ? availableSeats : 0;
      const lockedUpcomingUnsoldSeats = bookability.isLockedUpcoming ? availableSeats : 0;
      const completedUnsoldSeats =
        lifecycle === 'COMPLETED' || lifecycle === 'NOW_SHOWING' || lifecycle === 'CLEANING'
          ? availableSeats
          : 0;

      const customerCount = customers.size > 0 ? customers.size : bookings.length;

      return {
        id: st._id,
        movieId: st.movieId?._id || st.movieId || null,
        movieTitle: st.movieId?.title || 'Phim rạp',
        moviePoster: st.movieId?.posterUrl || st.movieId?.poster || '',
        cinemaName: st.cinemaId?.name || "D'AVENOR Thanh Khê Plaza",
        roomId: st.roomId?._id || st.roomId || null,
        roomNumber: st.roomId?.roomNumber || roomDoc?.roomNumber || null,
        roomName: st.roomId?.name || st.roomName,
        shortRoomName: st.roomId?.shortName || roomDoc?.shortName || st.roomName,
        roomType: st.roomId?.roomType || roomDoc?.roomType || 'IMAX Laser',
        format: st.roomId?.roomType || st.formatFeature || 'IMAX Laser',
        startTime: st.startTime,
        endTime: st.endTime,
        price: st.price,
        totalSeats,
        hasSeatRecords,
        customerCount,
        bookedSeats,
        holdingSeats,
        availableSeats,
        bookableAvailableSeats,
        lockedUpcomingUnsoldSeats,
        completedUnsoldSeats,
        isBookableUpcoming,
        isWithinImmediateSalesWindow: bookability.isWithinImmediateSalesWindow,
        isLocked: Boolean(st.isLocked),
        occupancyRate,
        isSoldOut: bookedSeats >= totalSeats && totalSeats > 0,
        revenue,
        revenueFormatted: formatCurrency(revenue),
        status: showtimeStatus,
        lifecycleStatus: lifecycle,
      };
    });

    return {
      timeRangeLabel: label,
      operationStartDate: CINEMA_OPERATION_START,
      operationStartLabel: CINEMA_OPERATION_START_LABEL,
      schedulePolicyWarning,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      items,
      periodMovies: periodMoviesDocs.map((m) => ({
        id: String(m._id),
        _id: String(m._id),
        title: m.title,
        poster: m.posterUrl || m.poster || '',
      })),
      rooms: allRooms.map((r) => ({
        id: String(r._id),
        roomNumber: r.roomNumber,
        name: r.name,
        shortName: r.shortName,
        roomType: r.roomType,
        totalSeats: r.totalSeats,
      })),
    };
  }

  /**
   * 4.1 CHI TIẾT 1 SUẤT CHIẾU & SƠ ĐỒ 88 GHẾ THỰC TẾ
   */
  async getShowtimeDetailStats(showtimeId) {
    const showtime = await Showtime.findById(showtimeId)
      .populate('movieId')
      .populate('cinemaId')
      .populate('roomId', 'roomNumber name shortName roomType formatFeature totalSeats')
      .lean();

    if (!showtime) {
      throw new Error('Không tìm thấy suất chiếu yêu cầu');
    }

    const bookings = await Booking.find({
      showtimeId: showtime._id,
      status: 'PAID',
      paymentStatus: validPayments,
    })
      .sort({ createdAt: -1 })
      .lean();

    const totalRevenue = bookings.reduce((sum, booking) => sum + verifiedRevenue(booking), 0);
    const verifiedRevenueTotal = bookings.reduce(
      (sum, booking) => sum + (booking.paymentStatus === 'VERIFIED' ? booking.totalAmount || 0 : 0),
      0
    );
    const simulatedRevenueTotal = bookings.reduce(
      (sum, booking) =>
        sum + (booking.paymentStatus === 'SIMULATED' ? booking.totalAmount || 0 : 0),
      0
    );

    const dbSeats = await ShowtimeSeat.find({ showtimeId: showtime._id }).lean();
    const now = new Date();
    const lifecycle = this.resolveShowtimeLifecycle(showtime, now);
    const rows = new Map();
    for (const seat of dbSeats.sort(
      (left, right) => left.row.localeCompare(right.row) || left.col - right.col
    )) {
      if (!rows.has(seat.row)) rows.set(seat.row, { row: seat.row, type: seat.type, seats: [] });
      const effectiveStatus =
        seat.status === 'HOLDING' && (!seat.holdExpiresAt || new Date(seat.holdExpiresAt) <= now)
          ? 'AVAILABLE'
          : seat.status;
      rows.get(seat.row).seats.push({
        code: seat.seatNumber,
        row: seat.row,
        col: seat.col,
        type: seat.type,
        status: effectiveStatus,
      });
    }
    const seatMatrix = [...rows.values()];
    const hasSeatRecords = dbSeats.length > 0;
    const totalRoomSeats = hasSeatRecords ? dbSeats.length : null;
    const bookedCount = hasSeatRecords
      ? dbSeats.filter((seat) => seat.status === 'BOOKED').length
      : null;
    const holdingCount = hasSeatRecords
      ? dbSeats.filter(
          (seat) =>
            seat.status === 'HOLDING' && seat.holdExpiresAt && new Date(seat.holdExpiresAt) > now
        ).length
      : 0;
    const availableCount = hasSeatRecords
      ? Math.max(0, totalRoomSeats - bookedCount - holdingCount)
      : null;
    const bookability = this.evaluateShowtimeBookability(showtime, {
      lifecycle,
      hasSeatRecords,
      roomDoc: showtime.roomId,
      now,
    });
    const bookableAvailableCount =
      hasSeatRecords && bookability.isBookableUpcoming ? availableCount : 0;
    const lockedUpcomingUnsoldCount =
      hasSeatRecords && bookability.isLockedUpcoming ? availableCount : 0;
    const completedUnsoldCount =
      hasSeatRecords &&
      (lifecycle === 'COMPLETED' || lifecycle === 'NOW_SHOWING' || lifecycle === 'CLEANING')
        ? availableCount
        : 0;
    const occupancyRate = hasSeatRecords
      ? Number(((bookedCount / totalRoomSeats) * 100).toFixed(2))
      : null;

    return {
      showtime: {
        id: showtime._id,
        movieTitle: showtime.movieId?.title,
        moviePoster: showtime.movieId?.posterUrl || showtime.movieId?.poster,
        cinemaName: showtime.cinemaId?.name,
        roomId: showtime.roomId?._id || null,
        roomName: showtime.roomId?.name || showtime.roomName,
        roomType: showtime.roomId?.roomType || null,
        aisleAfterCol: 6,
        startTime: showtime.startTime,
        endTime: showtime.endTime,
        price: showtime.price,
        isLocked: Boolean(showtime.isLocked),
        lifecycleStatus: lifecycle,
        isBookableUpcoming: bookability.isBookableUpcoming,
        isWithinImmediateSalesWindow: bookability.isWithinImmediateSalesWindow,
        format:
          showtime.roomId?.roomType ||
          showtime.formatFeature ||
          showtime.roomId?.formatFeature ||
          'IMAX Laser',
      },
      stats: {
        hasSeatRecords,
        totalSeats: totalRoomSeats,
        bookedCount,
        availableCount,
        bookableAvailableCount,
        lockedUpcomingUnsoldCount,
        completedUnsoldCount,
        holdingCount,
        occupancyRate,
        totalRevenue,
        verifiedRevenue: verifiedRevenueTotal,
        simulatedRevenue: simulatedRevenueTotal,
        revenueFormatted: formatCurrency(totalRevenue),
      },
      seatMatrix,
      bookings: bookings.map((b) => ({
        id: b._id,
        bookingCode: b.bookingCode,
        customerName: b.customerName,
        customerPhone: maskPhoneNumber(b.customerPhone),
        seats: b.seats,
        totalAmount: b.totalAmount,
        paymentMethod: b.paymentMethod,
        createdAt: b.createdAt,
      })),
    };
  }

  /**
   * 5. TAB THỐNG KÊ KHÁCH HÀNG (CUSTOMER ANALYTICS)
   */
  async getCustomersStats(filters = {}) {
    const {
      page = 1,
      limit = 10,
    } = filters;
    const { start, end, label } = this.resolvePeriodFilter(filters);

    const totalRegistered = await User.countDocuments({ role: { $ne: 'ADMIN' } });
    const newInPeriod = await User.countDocuments({
      role: { $ne: 'ADMIN' },
      createdAt: { $gte: start, $lte: end },
    });

    const bookings = await Booking.find({
      createdAt: { $gte: CINEMA_OPERATION_START },
      status: 'PAID',
      paymentStatus: validPayments,
    })
      .sort({ createdAt: 1 })
      .lean();

    const customerAggregation = {};
    bookings.forEach((b) => {
      const key = b.customerPhone || b.customerEmail || b.customerName;
      if (!key) return;

      if (!customerAggregation[key]) {
        customerAggregation[key] = {
          name: b.customerName || 'Khách hàng',
          phone: b.customerPhone || '',
          email: b.customerEmail || '',
          successfulOrders: 0,
          totalTickets: 0,
          totalSpend: 0,
          firstBooking: b.createdAt,
          lastBooking: b.createdAt,
        };
      }

      customerAggregation[key].successfulOrders += 1;
      customerAggregation[key].totalTickets += countSeatsFromString(b.seats);
      customerAggregation[key].totalSpend += verifiedRevenue(b);
      if (new Date(b.createdAt) > new Date(customerAggregation[key].lastBooking)) {
        customerAggregation[key].lastBooking = b.createdAt;
      }
    });

    const customersList = Object.values(customerAggregation);
    const transactingCount = customersList.length;
    const returningCount = customersList.filter((c) => c.successfulOrders >= 2).length;
    const totalSpendAll = customersList.reduce((sum, c) => sum + c.totalSpend, 0);
    const avgSpendPerCustomer =
      transactingCount > 0 ? Math.round(totalSpendAll / transactingCount) : 0;

    customersList.sort((a, b) => b.totalSpend - a.totalSpend);

    const total = customersList.length;
    const startIndex = (page - 1) * limit;
    const paginatedCustomers = customersList
      .slice(startIndex, startIndex + Number(limit))
      .map((c, i) => ({
        rank: startIndex + i + 1,
        name: c.name,
        maskedPhone: maskPhoneNumber(c.phone),
        successfulOrders: c.successfulOrders,
        totalTickets: c.totalTickets,
        totalSpend: c.totalSpend,
        spendFormatted: formatCurrency(c.totalSpend),
        lastBooking: c.lastBooking,
      }));

    return {
      timeRangeLabel: label,
      metrics: {
        totalRegistered,
        newInPeriod,
        transactingCount,
        returningCount,
        avgSpendPerCustomer,
        avgSpendFormatted: formatCurrency(avgSpendPerCustomer),
      },
      customersRanking: paginatedCustomers,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 6. TAB ĐÁNH GIÁ (REVIEW ANALYTICS)
   */
  async getReviewsStats() {
    const movies = await Movie.find({}).lean();

    let totalReviews = 0;
    let sumRating = 0;
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    const movieReviewsList = movies.map((movie) => {
      const summary = summarizeReviews(movie.reviews);
      totalReviews += summary.reviews.length;
      for (const review of summary.reviews) {
        starCounts[review.rating]++;
        sumRating += review.rating;
      }
      return {
        id: movie._id,
        title: movie.title,
        poster: movie.posterUrl || movie.poster,
        rating: summary.rating,
        totalReviews: summary.reviews.length,
        breakdown: summary.ratingBreakdown,
        reviews: summary.reviews,
      };
    });
    const avgRating = totalReviews > 0 ? Number((sumRating / totalReviews).toFixed(1)) : null;

    const topRatedMovies = [...movieReviewsList]
      .filter((m) => m.totalReviews >= 2)
      .sort((a, b) => b.rating - a.rating || b.totalReviews - a.totalReviews)
      .slice(0, 5);

    const mostReviewedMovies = [...movieReviewsList]
      .sort((a, b) => b.totalReviews - a.totalReviews)
      .slice(0, 5);

    return {
      metrics: {
        avgRating,
        totalReviews,
        topRatedMovie: topRatedMovies[0] || null,
        mostReviewedMovie: mostReviewedMovies[0] || null,
      },
      starDistribution: [
        {
          star: 5,
          count: starCounts[5],
          percent:
            totalReviews > 0 ? Number(((starCounts[5] / totalReviews) * 100).toFixed(1)) : 0,
        },
        {
          star: 4,
          count: starCounts[4],
          percent:
            totalReviews > 0 ? Number(((starCounts[4] / totalReviews) * 100).toFixed(1)) : 0,
        },
        {
          star: 3,
          count: starCounts[3],
          percent:
            totalReviews > 0 ? Number(((starCounts[3] / totalReviews) * 100).toFixed(1)) : 0,
        },
        {
          star: 2,
          count: starCounts[2],
          percent:
            totalReviews > 0 ? Number(((starCounts[2] / totalReviews) * 100).toFixed(1)) : 0,
        },
        {
          star: 1,
          count: starCounts[1],
          percent:
            totalReviews > 0 ? Number(((starCounts[1] / totalReviews) * 100).toFixed(1)) : 0,
        },
      ],
      movies: movieReviewsList,
    };
  }

  /**
   * 7. XUẤT BÁO CÁO FILE CSV (UTF-8 BOM CHO EXCEL TIẾNG VIỆT - MỤC XI)
   * Khớp 100% với bộ lọc hiện tại, mốc vận hành 01/11/2026 và số liệu đang hiển thị trên UI
   */
  async exportStatistics(type = 'revenue', filters = {}) {
    const { start, end, label } = this.resolvePeriodFilter(filters);
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    let csvContent = '\uFEFF'; // BOM UTF-8

    if (type === 'overview') {
      const data = await this.getOverviewStats(filters);
      csvContent += `BÁO CÁO TỔNG HỢP HOẠT ĐỘNG KINH DOANH - D'AVENOR CINEMA\n`;
      csvContent += `Khoảng thời gian: ${label} (${formatVietnamDateKey(start)} - ${formatVietnamDateKey(end)})\n`;
      csvContent += `Thời điểm xuất: ${nowStr}\n\n`;
      csvContent += `CHỈ SỐ KINH DOANH TỔNG HỢP\n`;
      csvContent += `Doanh thu thuần (Theo thời điểm giao dịch),${data.kpis.netRevenue.value}\n`;
      csvContent += `Doanh thu vé xem phim,${data.kpis.ticketRevenue.value}\n`;
      csvContent += `Doanh thu bắp nước,${data.kpis.concessionRevenue.value}\n`;
      csvContent += `Số vé hợp lệ đã bán (Theo thời điểm giao dịch),${data.kpis.validTicketsSold.value}\n`;
      csvContent += `Số đơn đặt thành công,${data.kpis.validTicketsSold.successfulOrders}\n`;
      csvContent += `Số đơn hủy/hoàn,${data.kpis.validTicketsSold.cancelledOrders}\n`;
      csvContent += `Số bộ phim có lịch chiếu,${data.kpis.distinctMovies.value}\n`;
      csvContent += `Tổng suất chiếu hoạt động,${data.kpis.totalShowtimes.value}\n`;
      csvContent += `Suất đã chiếu,${data.kpis.totalShowtimes.completedCount}\n`;
      csvContent += `Suất đang chiếu,${data.kpis.totalShowtimes.nowShowingCount}\n`;
      csvContent += `Suất sắp chiếu,${data.kpis.totalShowtimes.upcomingCount}\n`;
      csvContent += `Suất đã hủy,${data.kpis.totalShowtimes.cancelledCount}\n`;
      csvContent += `Tổng số ghế mở bán của các suất trong kỳ,${data.occupancy.totalSellable}\n`;
      csvContent += `Tổng số ghế đã đặt của các suất trong kỳ,${data.occupancy.booked}\n`;
      csvContent += `Tổng số ghế đang giữ tạm,${data.occupancy.holding || 0}\n`;
      csvContent += `Tổng số ghế trống vật lý,${data.occupancy.available}\n`;
      csvContent += `Ghế không bán được (Suất đã/đang chiếu),${data.occupancy.completedUnsoldSeats}\n`;
      csvContent += `Ghế thực sự còn được phép đặt (Suất sắp chiếu mở bán),${data.occupancy.upcomingAvailableSeats}\n`;
      csvContent += `Tỷ lệ bán vé trên tổng ghế mở bán toàn kỳ (%),${data.occupancy.rate}%\n`;
      csvContent += `Tỷ lệ lấp đầy của các suất đã chiếu (%),${data.occupancy.completedOccupancyRate ?? 0}%\n`;
      csvContent += `Tỷ lệ đặt trước của các suất sắp chiếu (%),${data.occupancy.upcomingOccupancyRate ?? 0}%\n`;
      csvContent += `Tổng chi phí trong kỳ,${data.kpis.totalExpenses.value}\n`;
      csvContent += `Lợi nhuận rạp,${data.kpis.profit.value ?? 'Chưa đủ dữ liệu'}\n`;
      csvContent += `Biên lợi nhuận (%),${data.kpis.profit.margin != null ? data.kpis.profit.margin + '%' : 'Chưa đủ dữ liệu'}\n\n`;

      csvContent += `HIỆU SUẤT CÔNG SUẤT THEO 9 PHÒNG VẬT LÝ\n`;
      csvContent += `Phòng,Loại phòng,Ghế vật lý,Số suất chiếu,Tổng ghế mở bán,Ghế đã bán,Ghế trống,Tỷ lệ lấp đầy (%),Doanh thu (đ)\n`;
      (data.roomOccupancyBreakdown || []).forEach((r) => {
        csvContent += `"${r.roomName}","${r.roomType}",${r.physicalSeats},${r.showtimesCount},${r.totalSellableSeats},${r.soldSeats},${r.unsoldSeats},${r.occupancyRate}%,${r.revenue}\n`;
      });
    } else if (type === 'revenue') {
      const data = await this.getRevenueStats(filters);
      csvContent += `BÁO CÁO DOANH THU, CHI PHÍ & LỢI NHUẬN - D'AVENOR CINEMA\n`;
      csvContent += `Khoảng thời gian: ${label} (${formatVietnamDateKey(start)} - ${formatVietnamDateKey(end)})\n`;
      csvContent += `Thời điểm xuất: ${nowStr}\n\n`;
      csvContent += `CHỈ SỐ TÀI CHÍNH TỔNG QUAN\n`;
      csvContent += `Doanh thu thực đã xác minh,${data.metrics.verifiedRevenue}\n`;
      csvContent += `Doanh thu mô phỏng,${data.metrics.simulatedRevenue}\n`;
      csvContent += `Tổng doanh thu hợp lệ,${data.metrics.totalRevenue}\n`;
      csvContent += `Tổng doanh thu trước hoàn tiền,${data.metrics.grossRevenue}\n`;
      csvContent += `Tổng số tiền đã hoàn,${data.metrics.refundedAmount}\n`;
      csvContent += `Giá trị đơn đã hủy,${data.metrics.cancelledAmount}\n`;
      csvContent += `Doanh thu thuần,${data.metrics.netRevenue}\n`;
      csvContent += `Doanh thu vé xem phim,${data.metrics.ticketRevenue}\n`;
      csvContent += `Doanh thu bắp nước,${data.metrics.concessionRevenue}\n`;
      csvContent += `Tổng chi phí phát sinh,${data.metrics.totalExpenses}\n`;
      csvContent += `Lợi nhuận rạp (Lãi/Lỗ),${data.metrics.hasExpenseData ? data.metrics.profit : 'Chưa đủ dữ liệu'}\n`;
      csvContent += `Tỷ suất lợi nhuận (%),${data.metrics.hasExpenseData ? data.metrics.profitMargin + '%' : 'Chưa đủ dữ liệu'}\n`;
      csvContent += `Trạng thái kinh doanh,${data.metrics.profitStatusLabel}\n`;
      csvContent += `Tổng số vé bán ra,${data.metrics.totalTicketsSold}\n\n`;

      csvContent += `PHÂN TÍCH DOANH THU, CHI PHÍ & LỢI NHUẬN TỪNG BỘ PHIM\n`;
      csvContent += `Bộ phim,Số suất chiếu,Số vé bán,Doanh thu vé (đ),Doanh thu bắp nước (đ),Doanh thu thuần (đ),Chi phí bản quyền & trực tiếp (đ),Chi phí vận hành phân bổ (đ),Tổng chi phí (đ),Lợi nhuận (đ),Biên LN (%),ROI (%),Trạng thái\n`;
      (data.movieRevenueRows || []).forEach((mv) => {
        csvContent += `"${mv.title}",${mv.showtimesCount},${mv.tickets},${mv.ticketRevenue},${mv.concessionRevenue},${mv.netRevenue},${mv.directExpenses},${mv.allocatedOperationalCost},${mv.totalCost},${mv.profit ?? 'N/A'},${mv.profitMargin != null ? mv.profitMargin + '%' : 'N/A'},${mv.roi != null ? mv.roi + '%' : 'N/A'},"${mv.statusLabel}"\n`;
      });

      csvContent += `\nBẢNG KINH DOANH THEO THÁNG TRONG NĂM (TỪ THÁNG 11/2026)\n`;
      csvContent += `Tháng,Số vé bán,Số suất chiếu,Doanh thu thuần (đ),Chi phí (đ),Lợi nhuận (đ),Biên LN (%),Trạng thái\n`;
      data.monthlyBreakdown.forEach((m) => {
        csvContent += `"${m.monthLabel}",${m.ticketsSold},${m.showtimesCount},${m.netRevenue},${m.expenses},${m.profit ?? 'N/A'},${m.profitMargin != null ? m.profitMargin + '%' : 'N/A'},"${m.statusLabel}"\n`;
      });

      csvContent += `\nCHI TIẾT THEO NGÀY\n`;
      csvContent += `Ngày,Số đơn hàng,Số vé bán,Doanh thu thuần (đ),Chi phí (đ),Lợi nhuận (đ)\n`;
      data.revenueTableRows.forEach((r) => {
        csvContent += `"${r.date}",${r.orders},${r.tickets},${r.netRev},${r.expense},${r.profit}\n`;
      });
    } else if (type === 'movies') {
      const data = await this.getMoviesStats({ ...filters, limit: 200 });
      csvContent += `BÁO CÁO HIỆU SUẤT BÁN VÉ, CÔNG SUẤT & LỢI NHUẬN TỪNG PHIM - D'AVENOR CINEMA\n`;
      csvContent += `Khoảng thời gian: ${label}\n`;
      csvContent += `Thời điểm xuất: ${nowStr}\n\n`;
      csvContent += `Hạng,Tên phim,Thể loại,Trạng thái,Số suất chiếu,Suất đã chiếu,Suất sắp chiếu,Suất cháy vé,Tổng ghế mở bán,Vé đã bán (Suất trong kỳ),Ghế không bán được (Đã chiếu),Ghế thực sự còn đặt được (Sắp chiếu),Tỷ lệ bán vé toàn kỳ (%),Tỷ lệ lấp đầy suất đã chiếu (%),Tỷ lệ đặt trước suất sắp chiếu (%),Doanh thu thuần (đ),Chi phí trực tiếp (đ),Chi phí phân bổ (đ),Tổng chi phí (đ),Lợi nhuận (đ),Biên LN (%),ROI (%),Trạng thái LN\n`;

      data.items.forEach((m) => {
        csvContent += `${m.salesRank || ''},"${m.title}","${m.genre}","${m.status}",${m.showtimesCount},${m.screenedShowtimesCount},${m.upcomingShowtimesCount},${m.soldOutShowtimesCount},${m.totalSellableSeats},${m.ticketsSold},${m.completedUnsoldSeats},${m.upcomingAvailableSeats},${m.occupancyRate}%,${m.completedOccupancyRate ?? 0}%,${m.upcomingOccupancyRate ?? 0}%,${m.revenue},${m.directExpenses},${m.allocatedExpenses},${m.totalExpenses},${m.profit ?? 'N/A'},${m.profitMargin != null ? m.profitMargin + '%' : 'N/A'},${m.roi != null ? m.roi + '%' : 'N/A'},"${m.statusLabel}"\n`;
      });
    } else if (type === 'showtimes') {
      const data = await this.getShowtimesStats({ ...filters, limit: 500 });
      csvContent += `BÁO CÁO THỐNG KÊ SUẤT CHIẾU - D'AVENOR CINEMA\n`;
      csvContent += `Khoảng thời gian: ${label}\n`;
      csvContent += `Thời điểm xuất: ${nowStr}\n\n`;
      csvContent += `Tên phim,Cụm rạp,Phòng chiếu,Loại phòng,Thời gian chiếu,Tổng ghế,Khách đặt vé,Ghế đã bán,Ghế đang giữ,Ghế còn trống,Tỷ lệ lấp đầy (%),Doanh thu (đ),Trạng thái\n`;

      data.items.forEach((st) => {
        const timeFormatted = new Date(st.startTime).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        csvContent += `"${st.movieTitle}","${st.cinemaName}","${st.roomName}","${st.roomType}","${timeFormatted}",${st.totalSeats},${st.customerCount},${st.bookedSeats},${st.holdingSeats},${st.availableSeats},${st.occupancyRate}%,${st.revenue},"${st.status}"\n`;
      });
    } else if (type === 'customers') {
      const data = await this.getCustomersStats({ ...filters, limit: 200 });
      csvContent += `BÁO CÁO XẾP HẠNG KHÁCH HÀNG - D'AVENOR CINEMA\n`;
      csvContent += `Khoảng thời gian: ${label}\n`;
      csvContent += `Thời điểm xuất: ${nowStr}\n\n`;
      csvContent += `Hạng,Họ và tên,Số điện thoại (bảo mật),Số đơn thành công,Tổng số vé mua,Tổng chi tiêu thuần (đ),Lần đặt vé gần nhất\n`;

      data.customersRanking.forEach((c) => {
        const lastDate = c.lastBooking ? formatVietnamDateKey(c.lastBooking) : '—';
        csvContent += `${c.rank},"${c.name}","${c.maskedPhone}",${c.successfulOrders},${c.totalTickets},${c.totalSpend},"${lastDate}"\n`;
      });
    }

    return {
      fileName: `Bao_Cao_${type.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`,
      content: csvContent,
    };
  }
}

export default new StatisticsService();
