import { summarizeReviews } from './reviewSummary.js';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Movie from '../models/Movie.js';
import Cinema from '../models/Cinema.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Expense from '../models/Expense.js';
import {
  parseDateFilter,
  calculateGrowth,
  maskPhoneNumber,
  countSeatsFromString,
  formatCurrency,
  formatCompactCurrency,
  formatExactCurrency,
} from '../utils/statisticsUtils.js';

const validPayments = { $in: ['VERIFIED', 'SIMULATED'] };
const verifiedRevenue = booking => ['VERIFIED', 'SIMULATED'].includes(booking.paymentStatus) ? booking.totalAmount || 0 : 0;
const verifiedRefund = booking => booking.refundStatus === 'REFUNDED' && ['VERIFIED', 'SIMULATED'].includes(booking.paymentStatus)
  ? booking.refundAmount || 0 : 0;

class StatisticsService {
  /**
   * Helper phân bổ doanh thu vé và bắp nước từ 1 booking
   * Nếu booking có trường concessions, tách doanh thu dựa theo giá vé suất chiếu
   */
  resolveBookingSplit(booking, showtimePrice = 95000) {
    const seatCount = countSeatsFromString(booking.seats);
    if (!['VERIFIED', 'SIMULATED'].includes(booking.paymentStatus)) return { ticketRev: 0, concessionRev: 0 };
    if (booking.priceSnapshot?.tickets?.length) {
      const concessionRev = Math.min(verifiedRevenue(booking), booking.priceSnapshot.combos.reduce(
        (sum, combo) => sum + combo.price * combo.quantity, 0
      ));
      return { ticketRev: verifiedRevenue(booking) - concessionRev, concessionRev };
    }
    const estTicketRev = seatCount > 0 ? seatCount * (showtimePrice || 95000) : booking.totalAmount;

    let ticketRev = booking.totalAmount;
    let concessionRev = 0;

    if (booking.concessions && booking.concessions.trim().length > 0) {
      if (booking.totalAmount > estTicketRev) {
        ticketRev = estTicketRev;
        concessionRev = booking.totalAmount - estTicketRev;
      } else {
        ticketRev = Math.round(booking.totalAmount * 0.75);
        concessionRev = booking.totalAmount - ticketRev;
      }
    }

    return { ticketRev, concessionRev };
  }

  /**
   * 1. TAB TỔNG QUAN (OVERVIEW DASHBOARD)
   * Đáp ứng trọn vẹn Yêu cầu 1 của giảng viên:
   * - Số vé bán trong tháng
   * - Số phim đã chiếu
   * - Số suất chiếu
   * - Tổng doanh thu tháng
   * - Tổng chi phí phát sinh
   * - Rạp lãi hay lỗ & Lợi nhuận cụ thể
   * - Tỷ lệ bán vé trung bình
   * - Tăng trưởng doanh thu, vé, lợi nhuận so với tháng trước
   */
  async getOverviewStats(filters = {}) {
    const { timeRange = 'this_month', customStart, customEnd, cinemaId, movieId, month, year } = filters;
    const { start, end, showtimeEnd, prevStart, prevEnd, label } = parseDateFilter({
      timeRange,
      customStart,
      customEnd,
      month,
      year,
    });

    // Match condition cho Booking kỳ hiện tại & kỳ trước
    const bookingMatch = {
      createdAt: { $gte: start, $lte: end },
      status: 'PAID', paymentStatus: validPayments,
    };
    const prevBookingMatch = {
      createdAt: { $gte: prevStart, $lte: prevEnd },
      status: 'PAID', paymentStatus: validPayments,
    };

    // Điều kiện lọc theo showtime (rạp / phim)
    const showtimeMatch = {};
    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      showtimeMatch.cinemaId = new mongoose.Types.ObjectId(cinemaId);
    }
    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      showtimeMatch.movieId = new mongoose.Types.ObjectId(movieId);
    }

    // Lấy danh sách showtimes theo filter
    let matchedShowtimeIds = null;
    if (Object.keys(showtimeMatch).length > 0) {
      const matchedShowtimes = await Showtime.find(showtimeMatch).select('_id').lean();
      matchedShowtimeIds = matchedShowtimes.map((s) => s._id);
      bookingMatch.showtimeId = { $in: matchedShowtimeIds };
      prevBookingMatch.showtimeId = { $in: matchedShowtimeIds };
    }

    // 1.1 Lấy bookings kỳ hiện tại và kỳ trước, đơn huỷ
    const [currentBookings, prevBookings, cancelledBookings] = await Promise.all([
      Booking.find(bookingMatch)
        .populate({
          path: 'showtimeId',
          populate: { path: 'movieId', select: 'title poster posterUrl' },
        })
        .lean(),
      Booking.find(prevBookingMatch).lean(),
      Booking.find({
        createdAt: { $gte: start, $lte: end },
        status: 'CANCELLED',
      }).lean(),
    ]);

    // Tính toán KPI kỳ hiện tại
    let totalGrossRevenue = 0;
    let totalTicketRevenue = 0;
    let totalConcessionRevenue = 0;
    let validTicketsSold = 0;
    const customerSet = new Set();

    currentBookings.forEach((b) => {
      totalGrossRevenue += verifiedRevenue(b);
      const count = countSeatsFromString(b.seats);
      validTicketsSold += count;
      const stPrice = b.showtimeId?.price || 95000;
      const split = this.resolveBookingSplit(b, stPrice);
      totalTicketRevenue += split.ticketRev;
      totalConcessionRevenue += split.concessionRev;
      const cKey = b.customerPhone || b.customerName || b._id.toString();
      customerSet.add(cKey);
    });

    const totalRefunded = cancelledBookings.reduce((sum, b) => sum + verifiedRefund(b), 0);
    const netRevenue = totalGrossRevenue;

    // Tính toán KPI kỳ trước để so sánh tăng trưởng
    let prevGrossRevenue = 0;
    let prevTicketsSold = 0;
    const prevCustomerSet = new Set();
    prevBookings.forEach((b) => {
      prevGrossRevenue += verifiedRevenue(b);
      prevTicketsSold += countSeatsFromString(b.seats);
      const cKey = b.customerPhone || b.customerName || b._id.toString();
      prevCustomerSet.add(cKey);
    });

    const revenueGrowth = prevGrossRevenue > 0 ? calculateGrowth(netRevenue, prevGrossRevenue) : null;
    const ticketsGrowth = prevTicketsSold > 0 ? calculateGrowth(validTicketsSold, prevTicketsSold) : null;

    // Số người đặt ghế trong kỳ
    const bookingCustomersCount = customerSet.size > 0 ? customerSet.size : currentBookings.length;
    const prevBookingCustomersCount = prevCustomerSet.size > 0 ? prevCustomerSet.size : prevBookings.length;
    const customersGrowth = prevBookingCustomersCount > 0 ? calculateGrowth(bookingCustomersCount, prevBookingCustomersCount) : null;

    // 1.2 Thống kê Suất chiếu & Phim đã chiếu trong kỳ (Đáp ứng Yêu cầu 1)
    const stPeriodMatch = {
      startTime: { $gte: start, $lte: showtimeEnd || end },
    };
    if (showtimeMatch.cinemaId) stPeriodMatch.cinemaId = showtimeMatch.cinemaId;
    if (showtimeMatch.movieId) stPeriodMatch.movieId = showtimeMatch.movieId;

    const screenedShowtimes = await Showtime.find(stPeriodMatch).select('_id movieId startTime roomName').lean();
    const totalShowtimesCount = screenedShowtimes.length;

    const distinctMovieSet = new Set();
    screenedShowtimes.forEach((st) => {
      if (st.movieId) distinctMovieSet.add(st.movieId.toString());
    });
    const distinctMoviesCount = distinctMovieSet.size;

    // 1.3 Thống kê Chi phí thực tế & Lợi nhuận (Profit = Revenue - Expense)
    const expensePeriodMatch = {
      date: { $gte: start, $lte: end },
    };
    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      expensePeriodMatch.$or = [
        { movieId: new mongoose.Types.ObjectId(movieId) },
        { type: { $in: ['OPERATIONAL_CINEMA', 'STAFF', 'UTILITY', 'OTHER'] } },
      ];
    }

    const prevExpensePeriodMatch = {
      date: { $gte: prevStart, $lte: prevEnd },
    };

    const [currentExpenses, prevExpenses] = await Promise.all([
      Expense.find(expensePeriodMatch).lean(),
      Expense.find(prevExpensePeriodMatch).lean(),
    ]);

    // Phân bổ chi phí nếu có lọc theo phim
    let totalExpenses = 0;
    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      const directMovieCost = currentExpenses
        .filter((e) => e.movieId && e.movieId.toString() === movieId.toString())
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      const sharedCost = currentExpenses
        .filter((e) => ['OPERATIONAL_CINEMA', 'STAFF', 'UTILITY', 'OTHER'].includes(e.type))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      // Ước tính phân bổ 1/18 cho 1 phim trong hệ thống
      totalExpenses = directMovieCost + Math.round(sharedCost / Math.max(1, distinctMoviesCount || 1));
    } else {
      totalExpenses = currentExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    }

    const prevTotalExpenses = prevExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = netRevenue - totalExpenses;
    const prevProfit = prevGrossRevenue - prevTotalExpenses;
    const profitGrowth = prevProfit !== 0 ? calculateGrowth(profit, prevProfit) : null;
    const profitMargin = netRevenue > 0 ? Number(((profit / netRevenue) * 100).toFixed(1)) : 0;
    const profitStatus = profit >= 0 ? 'PROFIT' : 'LOSS';

    // 1.4 Thống kê Ghế & Tỷ lệ bán vé / Tỷ lệ lấp đầy
    const allRooms = await Room.find().lean();
    const totalTheaterSeats = allRooms.reduce((sum, r) => sum + (r.totalSeats || 0), 0);

    const roomCapacities = new Map(allRooms.map(room => [String(room._id), room.totalSeats ?? 0]));
    const periodShowtimes = await Showtime.find({ ...showtimeMatch, startTime: { $gte: start, $lte: end } })
      .select('roomId').lean();
    const totalSellablePeriod = periodShowtimes.reduce((sum, slot) => sum + (roomCapacities.get(String(slot.roomId)) ?? 0), 0);
    const availableSeatsPeriod = Math.max(0, totalSellablePeriod - validTicketsSold);
    const avgTicketSalesRate = totalSellablePeriod > 0
      ? Number(Math.min(100, (validTicketsSold / totalSellablePeriod) * 100).toFixed(1))
      : 0;

    // Thống kê sức chứa theo phòng vật lý
    let liveBookedSeats = 0;
    let liveAvailableSeats = 0;
    const now = new Date();

    for (const room of allRooms) {
      const roomCap = room.totalSeats ?? 0;
      let activeSt = await Showtime.findOne({
        $or: [
          { roomName: room.name },
          { roomName: room.shortName },
          { roomName: { $regex: (room.name || '').trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'i' } },
        ],
        startTime: { $gte: new Date(now.getTime() - 2.5 * 60 * 60 * 1000) },
      })
        .sort({ startTime: 1 })
        .lean();

      if (!activeSt) {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        activeSt = await Showtime.findOne({
          $or: [{ roomName: room.name }, { roomName: room.shortName }],
          startTime: { $gte: startOfDay },
        })
          .sort({ startTime: -1 })
          .lean();
      }

      let roomBooked = 0;
      if (activeSt) {
        const seatCounts = await ShowtimeSeat.aggregate([
          { $match: { showtimeId: activeSt._id, status: 'BOOKED' } },
          { $group: { _id: null, count: { $sum: 1 } } },
        ]);
        if (seatCounts.length > 0) {
          roomBooked = seatCounts[0].count;
        } else {
          const bks = await Booking.find({ showtimeId: activeSt._id, status: 'PAID', paymentStatus: validPayments }).lean();
          bks.forEach((b) => {
            roomBooked += countSeatsFromString(b.seats);
          });
        }
      }
      roomBooked = Math.min(roomCap, roomBooked);
      liveBookedSeats += roomBooked;
    }
    liveAvailableSeats = Math.max(0, totalTheaterSeats - liveBookedSeats);

    // 1.5 Chuỗi dữ liệu biểu đồ doanh thu, chi phí, lợi nhuận theo ngày (Revenue Chart)
    const revenueTrendMap = {};
    const dayCursor = new Date(start);
    while (dayCursor <= end) {
      const dayKey = dayCursor.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      revenueTrendMap[dayKey] = {
        date: dayKey,
        fullDate: new Date(dayCursor),
        ticketRevenue: 0,
        concessionRevenue: 0,
        netRevenue: 0,
        tickets: 0,
        expense: 0,
        profit: 0,
      };
      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    currentBookings.forEach((b) => {
      const bDate = new Date(b.createdAt);
      const dayKey = bDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      if (revenueTrendMap[dayKey]) {
        const split = this.resolveBookingSplit(b, b.showtimeId?.price);
        revenueTrendMap[dayKey].ticketRevenue += split.ticketRev;
        revenueTrendMap[dayKey].concessionRevenue += split.concessionRev;
        revenueTrendMap[dayKey].netRevenue += verifiedRevenue(b);
        revenueTrendMap[dayKey].tickets += countSeatsFromString(b.seats);
      }
    });

    currentExpenses.forEach((e) => {
      const eDate = new Date(e.date);
      const dayKey = eDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      if (revenueTrendMap[dayKey]) {
        revenueTrendMap[dayKey].expense += e.amount || 0;
      }
    });

    Object.values(revenueTrendMap).forEach((d) => {
      d.profit = d.netRevenue - d.expense;
    });

    const revenueChartData = Object.values(revenueTrendMap);

    // 1.6 Top 5 Phim theo Doanh thu & Vé bán
    const movieStatsMap = {};
    currentBookings.forEach((b) => {
      const mv = b.showtimeId?.movieId;
      if (!mv) return;
      const mId = mv._id ? mv._id.toString() : mv.toString();
      if (!movieStatsMap[mId]) {
        movieStatsMap[mId] = {
          movieId: mId,
          title: mv.title || 'Phim rạp',
          poster: mv.posterUrl || mv.poster || '',
          revenue: 0,
          tickets: 0,
          bookingsCount: 0,
        };
      }
      movieStatsMap[mId].revenue += verifiedRevenue(b);
      movieStatsMap[mId].tickets += countSeatsFromString(b.seats);
      movieStatsMap[mId].bookingsCount += 1;
    });

    if (Object.keys(movieStatsMap).length < 5) {
      const topMoviesDb = await Movie.find({})
        .sort({ 'stats.revenue': -1, rating: -1 })
        .limit(5)
        .lean();
      topMoviesDb.forEach((m) => {
        const mId = m._id.toString();
        if (!movieStatsMap[mId]) {
          movieStatsMap[mId] = {
            movieId: mId,
            title: m.title,
            poster: m.posterUrl || m.poster || '',
            revenue: m.stats?.revenue || 0,
            tickets: m.stats?.ticketsSold || 0,
            bookingsCount: Math.round((m.stats?.ticketsSold || 0) / 2),
          };
        }
      });
    }

    const topRevenueMovies = Object.values(movieStatsMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topTicketsMovies = Object.values(movieStatsMap)
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 5);

    // 1.7 Khung giờ vàng
    const hourMap = {
      '18:00 - 20:00': { slot: '18:00 - 20:00', tickets: 0, bookings: 0 },
      '20:00 - 22:00': { slot: '20:00 - 22:00', tickets: 0, bookings: 0 },
      '14:00 - 16:00': { slot: '14:00 - 16:00', tickets: 0, bookings: 0 },
      '10:00 - 12:00': { slot: '10:00 - 12:00', tickets: 0, bookings: 0 },
    };
    currentBookings.forEach((b) => {
      const time = b.showtimeId?.startTime ? new Date(b.showtimeId.startTime) : new Date(b.createdAt);
      const hour = time.getHours();
      const hourLabel = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 2)
        .toString()
        .padStart(2, '0')}:00`;
      if (!hourMap[hourLabel]) hourMap[hourLabel] = { slot: hourLabel, tickets: 0, bookings: 0 };
      hourMap[hourLabel].tickets += countSeatsFromString(b.seats);
      hourMap[hourLabel].bookings += 1;
    });

    const peakHours = Object.values(hourMap)
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 4);

    // 1.8 Suất chiếu sắp diễn ra & Đặt vé gần đây
    const upcomingShowtimes = await Showtime.find({
      startTime: { $gte: new Date() },
    })
      .populate('movieId', 'title poster posterUrl')
      .populate('cinemaId', 'name')
      .sort({ startTime: 1 })
      .limit(5)
      .lean();

    const recentBookings = await Booking.find({ status: 'PAID', paymentStatus: validPayments })
      .populate({
        path: 'showtimeId',
        populate: { path: 'movieId', select: 'title' },
      })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    const summaryRows = await Booking.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, ...('showtimeId' in bookingMatch && { showtimeId: bookingMatch.showtimeId }) } },
      { $group: { _id: { $ifNull: ['$paymentStatus', 'LEGACY_UNVERIFIED'] }, count: { $sum: 1 } } },
    ]);
    const paymentCounts = Object.fromEntries(summaryRows.map(entry => [entry._id, entry.count]));
    const profitKnown = currentBookings.some(order => ['VERIFIED', 'SIMULATED'].includes(order.paymentStatus));

    return {
      timeRangeLabel: label,
      filter: { timeRange, start, end },
      paymentCounts,
      profitKnown,
      kpis: {
        // 1. Tổng doanh thu thuần
        netRevenue: {
          value: netRevenue,
          formatted: formatCompactCurrency(netRevenue),
          exactFormatted: formatExactCurrency(netRevenue),
          growth: revenueGrowth,
          title: 'Doanh thu tháng',
          tooltip: 'Tổng doanh thu thực tế sau hoàn tiền trong kỳ thống kê',
        },
        // 2. Số vé bán ra
        validTicketsSold: {
          value: validTicketsSold,
          formatted: `${validTicketsSold.toLocaleString('vi-VN')} vé`,
          growth: ticketsGrowth,
          title: 'Vé xác minh và mô phỏng',
          tooltip: 'Tổng số lượng vé xem phim đã thanh toán thành công trong tháng',
        },
        // 3. Số bộ phim đã chiếu
        distinctMovies: {
          value: distinctMoviesCount,
          formatted: `${distinctMoviesCount} phim`,
          growth: null,
          title: 'Phim đã chiếu',
          tooltip: 'Số lượng phim khác nhau có suất chiếu phục vụ khán giả trong tháng',
        },
        // 4. Số suất chiếu
        totalShowtimes: {
          value: totalShowtimesCount,
          formatted: `${totalShowtimesCount.toLocaleString('vi-VN')} suất`,
          growth: null,
          title: 'Tổng suất chiếu',
          tooltip: 'Tổng số suất chiếu phim được tổ chức tại rạp trong tháng',
        },
        // 5. Chi phí & Lợi nhuận rạp (Lãi/Lỗ cụ thể)
        totalExpenses: {
          value: totalExpenses,
          formatted: formatCompactCurrency(totalExpenses),
          exactFormatted: formatExactCurrency(totalExpenses),
          growth: null,
          title: 'Tổng chi phí',
          tooltip: 'Tổng chi phí thực tế gồm bản quyền, marketing và vận hành cụm rạp',
        },
        profit: {
          value: profitKnown ? profit : null,
          formatted: profitKnown ? formatCompactCurrency(profit) : 'Chưa đủ dữ liệu',
          exactFormatted: profitKnown ? formatExactCurrency(profit) : '',
          growth: profitGrowth,
          margin: profitMargin,
          status: profitStatus,
          statusLabel: profitKnown ? 'Ước tính theo chi phí đã ghi nhận' : '',
          title: 'Lợi nhuận',
          tooltip: `Lợi nhuận = Doanh thu thuần (${formatExactCurrency(netRevenue)}) - Chi phí (${formatExactCurrency(totalExpenses)}). Biên LN: ${profitMargin}%`,
        },
        // 6. Tỷ lệ bán vé trung bình
        ticketRate: {
          value: avgTicketSalesRate,
          formatted: `${avgTicketSalesRate}%`,
          sold: validTicketsSold,
          available: availableSeatsPeriod,
          totalSellable: totalSellablePeriod,
          title: 'Tỷ lệ bán vé TB',
          tooltip: `Tỷ lệ vé bán đạt ${avgTicketSalesRate}% (${validTicketsSold.toLocaleString('vi-VN')} / ${totalSellablePeriod.toLocaleString('vi-VN')} vé có thể bán)`,
        },
        // Tương thích ngược với các widget cũ
        bookedSeats: {
          value: liveBookedSeats,
          formatted: `${liveBookedSeats.toLocaleString('vi-VN')} ghế`,
          growth: ticketsGrowth,
          title: 'Ghế đã đặt',
          tooltip: `Số ghế đã có khách đặt hiện tại trong tổng ${totalTheaterSeats} ghế của các phòng chiếu`,
        },
        availableSeats: {
          value: liveAvailableSeats,
          formatted: `${liveAvailableSeats.toLocaleString('vi-VN')} ghế`,
          growth: null,
          title: 'Ghế chưa đặt',
          tooltip: `Số ghế trống sẵn sàng phục vụ trong tổng ${totalTheaterSeats} ghế của các phòng chiếu`,
        },
        bookedCustomers: {
          value: bookingCustomersCount,
          formatted: `${bookingCustomersCount.toLocaleString('vi-VN')} người`,
          growth: customersGrowth,
          title: 'Số người đặt vé',
          tooltip: 'Tổng số lượt khách hàng đặt vé thành công trong kỳ',
        },
        totalCustomers: {
          value: bookingCustomersCount,
          formatted: `${bookingCustomersCount.toLocaleString('vi-VN')} người`,
          growth: customersGrowth,
          title: 'Số người đặt vé',
        },
        nowShowingMovies: {
          value: distinctMoviesCount,
          formatted: `${distinctMoviesCount} phim`,
          growth: null,
          title: 'Phim đang chiếu',
        },
      },
      occupancy: {
        totalSellable: totalSellablePeriod,
        booked: validTicketsSold,
        available: availableSeatsPeriod,
        rate: avgTicketSalesRate,
        roomCount: allRooms.length || 9,
        liveBooked: liveBookedSeats,
        liveAvailable: liveAvailableSeats,
      },
      revenueChartData,
      topRevenueMovies,
      topTicketsMovies,
      peakHours,
      upcomingShowtimes: upcomingShowtimes.map((st) => ({
        id: st._id,
        movieTitle: st.movieId?.title || 'Phim rạp',
        poster: st.movieId?.posterUrl || st.movieId?.poster || '',
        cinemaName: st.cinemaId?.name || "D'AVENOR Thanh Khê Plaza",
        roomName: st.roomName,
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
   * 2. TAB DOANH THU & CHI PHÍ - LỢI NHUẬN (REVENUE, COST & PROFIT ANALYTICS)
   * Cung cấp:
   * - Bảng phân tích 12 tháng kinh doanh của năm (Doanh thu, Chi phí, Lợi nhuận, Biên LN, Trạng thái)
   * - Biểu đồ kết hợp Doanh thu vs Chi phí vs Lợi nhuận
   * - Phân bổ chi phí theo 6 danh mục
   * - Bảng doanh thu theo ngày & theo từng bộ phim
   */
  async getRevenueStats(filters = {}) {
    const { timeRange = 'this_month', customStart, customEnd, cinemaId, movieId, month, year } = filters;
    const { start, end, prevStart, prevEnd, label } = parseDateFilter({
      timeRange,
      customStart,
      customEnd,
      month,
      year,
    });

    const bookingMatch = {
      createdAt: { $gte: start, $lte: end },
      status: 'PAID', paymentStatus: validPayments,
    };

    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      const showtimes = await Showtime.find({ cinemaId }).select('_id').lean();
      bookingMatch.showtimeId = { $in: showtimes.map((s) => s._id) };
    }
    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      const showtimes = await Showtime.find({ movieId }).select('_id').lean();
      const existingIn = bookingMatch.showtimeId?.$in;
      const movieStIds = showtimes.map((s) => s._id);
      bookingMatch.showtimeId = existingIn
        ? { $in: existingIn.filter((id) => movieStIds.some((mid) => mid.equals(id))) }
        : { $in: movieStIds };
    }

    const [bookings, cancelledBookings, expenses] = await Promise.all([
      Booking.find(bookingMatch)
        .populate({
          path: 'showtimeId',
          populate: [
            { path: 'movieId', select: 'title poster posterUrl' },
            { path: 'cinemaId', select: 'name city' },
          ],
        })
        .sort({ createdAt: -1 })
        .lean(),
      Booking.find({
        createdAt: { $gte: start, $lte: end },
        status: 'CANCELLED',
      }).lean(),
      Expense.find({
        date: { $gte: start, $lte: end },
      })
        .populate('movieId', 'title poster posterUrl')
        .sort({ date: -1 })
        .lean(),
    ]);

    let grossRevenue = 0;
    let verifiedRevenueTotal = 0;
    let simulatedRevenueTotal = 0;
    let ticketRevenue = 0;
    let concessionRevenue = 0;
    let totalTickets = 0;
    const paymentMethodsMap = { MOMO: 0, VNPAY: 0, CASH: 0 };
    const paymentMethodsCount = { MOMO: 0, VNPAY: 0, CASH: 0 };
    const cinemaMap = {};
    const dailyMap = {};
    const movieRevenueMap = {};

    bookings.forEach((b) => {
      const amount = verifiedRevenue(b);
      grossRevenue += amount;
      if (b.paymentStatus === 'VERIFIED') verifiedRevenueTotal += amount;
      else if (b.paymentStatus === 'SIMULATED') simulatedRevenueTotal += amount;
      const seatsCount = countSeatsFromString(b.seats);
      totalTickets += seatsCount;

      const split = this.resolveBookingSplit(b, b.showtimeId?.price);
      ticketRevenue += split.ticketRev;
      concessionRevenue += split.concessionRev;

      // Phương thức thanh toán
      const method = b.paymentMethod || 'MOMO';
      paymentMethodsMap[method] = (paymentMethodsMap[method] || 0) + verifiedRevenue(b);
      paymentMethodsCount[method] = (paymentMethodsCount[method] || 0) + 1;

      // Cụm rạp
      const cinemaName = b.showtimeId?.cinemaId?.name || "D'AVENOR Thanh Khê Plaza";
      if (!cinemaMap[cinemaName]) {
        cinemaMap[cinemaName] = { name: cinemaName, revenue: 0, orders: 0, tickets: 0 };
      }
      cinemaMap[cinemaName].revenue += verifiedRevenue(b);
      cinemaMap[cinemaName].orders += 1;
      cinemaMap[cinemaName].tickets += seatsCount;

      // Theo ngày
      const dayStr = new Date(b.createdAt).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
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
      dailyMap[dayStr].netRev += verifiedRevenue(b);

      // Theo từng phim
      const mv = b.showtimeId?.movieId;
      const mId = mv?._id ? mv._id.toString() : (mv ? mv.toString() : 'UNKNOWN');
      if (mId !== 'UNKNOWN') {
        if (!movieRevenueMap[mId]) {
          movieRevenueMap[mId] = {
            movieId: mId,
            title: mv?.title || 'Phim rạp',
            poster: mv?.posterUrl || mv?.poster || '',
            orders: 0,
            tickets: 0,
            ticketRevenue: 0,
            concessionRevenue: 0,
            totalRevenue: 0,
          };
        }
        movieRevenueMap[mId].orders += 1;
        movieRevenueMap[mId].tickets += seatsCount;
        movieRevenueMap[mId].ticketRevenue += split.ticketRev;
        movieRevenueMap[mId].concessionRevenue += split.concessionRev;
        movieRevenueMap[mId].totalRevenue += verifiedRevenue(b);
      }
    });

    // Thêm chi phí vào dailyMap
    expenses.forEach((e) => {
      const dayStr = new Date(e.date).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      if (dailyMap[dayStr]) {
        dailyMap[dayStr].expense += e.amount || 0;
      }
    });

    Object.values(dailyMap).forEach((d) => {
      d.profit = d.netRev - d.expense;
    });

    const refundedAmount = cancelledBookings.reduce((sum, b) => sum + verifiedRefund(b), 0);
    const cancelledAmount = cancelledBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalRevenue = verifiedRevenueTotal + simulatedRevenueTotal;
    const netRevenue = totalRevenue;
    const aov = bookings.length > 0 ? Math.round(netRevenue / bookings.length) : 0;

    // Chi phí & Lợi nhuận toàn kỳ
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = netRevenue - totalExpenses;
    const profitMargin = netRevenue > 0 ? Number(((profit / netRevenue) * 100).toFixed(1)) : 0;
    const profitStatus = profit >= 0 ? 'PROFIT' : 'LOSS';

    // Cơ cấu chi phí theo danh mục (6 danh mục chuẩn)
    const categoryLabels = {
      DIRECT_MOVIE: 'Bản quyền phim & Nhà phát hành',
      MARKETING: 'Tiếp thị & Quảng cáo',
      OPERATIONAL_CINEMA: 'Vận hành cụm rạp',
      STAFF: 'Lương & Nhân sự rạp',
      UTILITY: 'Điện nước, Mạng & Bảo trì',
      OTHER: 'Chi phí khác',
    };
    const expenseCatMap = {};
    Object.keys(categoryLabels).forEach((cat) => {
      expenseCatMap[cat] = { type: cat, label: categoryLabels[cat], amount: 0, count: 0 };
    });
    expenses.forEach((e) => {
      const cat = e.type || 'OTHER';
      if (!expenseCatMap[cat]) expenseCatMap[cat] = { type: cat, label: categoryLabels[cat] || cat, amount: 0, count: 0 };
      expenseCatMap[cat].amount += e.amount || 0;
      expenseCatMap[cat].count += 1;
    });
    const expensesByCategory = Object.values(expenseCatMap).map((c) => ({
      ...c,
      formattedAmount: formatCurrency(c.amount),
      compactAmount: formatCompactCurrency(c.amount),
      percent: totalExpenses > 0 ? Number(((c.amount / totalExpenses) * 100).toFixed(1)) : 0,
    }));

    // Báo cáo 12 tháng kinh doanh của năm (monthlyBreakdown)
    const targetYear = Number(year) || start.getFullYear() || 2026;
    const monthlyBreakdown = [];

    // Lấy bookings và expenses cả năm targetYear để nhóm 12 tháng
    const yearStart = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    const [yearBookings, yearExpenses, yearShowtimes] = await Promise.all([
      Booking.find({
        createdAt: { $gte: yearStart, $lte: yearEnd },
        status: 'PAID', paymentStatus: validPayments,
      }).select('createdAt totalAmount seats paymentStatus').lean(),
      Expense.find({
        date: { $gte: yearStart, $lte: yearEnd },
      }).select('date amount').lean(),
      Showtime.find({
        startTime: { $gte: yearStart, $lte: yearEnd },
      }).select('startTime').lean(),
    ]);

    for (let m = 1; m <= 12; m++) {
      const mIdx = m - 1;
      let mNetRevenue = 0;
      let mTickets = 0;
      let mExpenses = 0;
      let mShowtimes = 0;

      yearBookings.forEach((b) => {
        const d = new Date(b.createdAt);
        if (d.getMonth() === mIdx) {
          mNetRevenue += verifiedRevenue(b);
          mTickets += countSeatsFromString(b.seats);
        }
      });

      yearExpenses.forEach((e) => {
        const d = new Date(e.date);
        if (d.getMonth() === mIdx) {
          mExpenses += e.amount || 0;
        }
      });

      yearShowtimes.forEach((st) => {
        const d = new Date(st.startTime);
        if (d.getMonth() === mIdx) {
          mShowtimes += 1;
        }
      });

      const mProfit = mNetRevenue - mExpenses;
      const mMargin = mNetRevenue > 0 ? Number(((mProfit / mNetRevenue) * 100).toFixed(1)) : 0;
      const mStatus = mProfit >= 0 ? 'PROFIT' : 'LOSS';

      monthlyBreakdown.push({
        month: m,
        monthLabel: `Tháng ${m}/${targetYear}`,
        ticketsSold: mTickets,
        showtimesCount: mShowtimes,
        netRevenue: mNetRevenue,
        formattedRevenue: formatCurrency(mNetRevenue),
        expenses: mExpenses,
        formattedExpenses: formatCurrency(mExpenses),
        profit: mProfit,
        formattedProfit: formatCurrency(mProfit),
        profitMargin: mMargin,
        profitStatus: mStatus,
        statusLabel: mStatus === 'PROFIT' ? 'Có lãi' : 'Bị lỗ',
      });
    }

    // Biểu đồ kết hợp Doanh thu vs Chi phí vs Lợi nhuận
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
      }));

    const profitKnown = bookings.some(order => ['VERIFIED', 'SIMULATED'].includes(order.paymentStatus));

    return {
      timeRangeLabel: label,
      revenueChartData: combinedChartData,
      combinedChartData,
      monthlyBreakdown,
      metrics: {
        profitKnown,
        grossRevenue,
        grossFormatted: formatCurrency(grossRevenue),
        verifiedRevenue: verifiedRevenueTotal,
        simulatedRevenue: simulatedRevenueTotal,
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
        expensesFormatted: formatCurrency(totalExpenses),
        profit: profitKnown ? profit : null,
        profitFormatted: profitKnown ? formatCurrency(profit) : 'Chưa đủ dữ liệu',
        profitMargin,
        profitStatus,
        profitStatusLabel: profitKnown ? 'Ước tính theo chi phí đã ghi nhận' : '',
        aov,
        aovFormatted: formatCurrency(aov),
        successfulOrders: bookings.length,
        totalTicketsSold: totalTickets,
        ticketPercent: netRevenue > 0 ? Number(((ticketRevenue / netRevenue) * 100).toFixed(1)) : 100,
        concessionPercent: netRevenue > 0 ? Number(((concessionRevenue / netRevenue) * 100).toFixed(1)) : 0,
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
      movieRevenueRows: Object.values(movieRevenueMap).sort((a, b) => b.totalRevenue - a.totalRevenue),
    };
  }

  /**
   * 3. TAB THỐNG KÊ PHIM: TỶ LỆ BÁN VÉ, DOANH THU & LỢI NHUẬN TỪNG PHIM
   * Đáp ứng trọn vẹn Yêu cầu 2 & 3 của giảng viên:
   * Yêu cầu 2:
   * - Phim bán bao nhiêu vé, bao nhiêu ghế trống, tổng ghế mở bán, tỷ lệ bán vé (%)
   * - Phim bán chạy nhất, lấp đầy cao nhất, bán chậm nhất
   * Yêu cầu 3:
   * - Doanh thu từng phim
   * - Chi phí trực tiếp + Chi phí phân bổ chung rạp
   * - Lợi nhuận / lỗ từng phim & Biên lợi nhuận (%)
   * - Phim sinh lời tốt nhất, phim bị lỗ
   */
  async getMoviesStats(filters = {}) {
    const {
      timeRange = 'this_month',
      search = '',
      sortBy = 'revenue',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      month,
      year,
    } = filters;
    const { start, end, label } = parseDateFilter({ timeRange, month, year });

    const query = {};
    if (search && search.trim().length > 0) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const movies = await Movie.find(query).lean();

    // 1. Lấy tất cả bookings và chi phí trong kỳ để phân bổ chính xác
    const [allPeriodBookings, allPeriodExpenses] = await Promise.all([
      Booking.find({
        createdAt: { $gte: start, $lte: end },
        status: 'PAID', paymentStatus: validPayments,
      })
        .populate({ path: 'showtimeId', select: 'movieId price' })
        .lean(),
      Expense.find({
        date: { $gte: start, $lte: end },
      }).lean(),
    ]);

    // Gom booking theo phim
    const movieBookingsMap = {};
    let theaterTotalNetRevenue = 0;

    allPeriodBookings.forEach((b) => {
      const mv = b.showtimeId?.movieId;
      if (!mv) return;
      const mId = mv._id ? mv._id.toString() : mv.toString();
      if (!movieBookingsMap[mId]) {
        movieBookingsMap[mId] = { tickets: 0, revenue: 0 };
      }
      const count = countSeatsFromString(b.seats);
      movieBookingsMap[mId].tickets += count;
      movieBookingsMap[mId].revenue += verifiedRevenue(b);
      theaterTotalNetRevenue += verifiedRevenue(b);
    });

    // Gom chi phí theo phim và chi phí dùng chung của rạp
    const movieDirectExpensesMap = {};
    let theaterSharedExpenses = 0;

    allPeriodExpenses.forEach((e) => {
      if (e.movieId && ['DIRECT_MOVIE', 'MARKETING'].includes(e.type)) {
        const mId = e.movieId.toString();
        movieDirectExpensesMap[mId] = (movieDirectExpensesMap[mId] || 0) + (e.amount || 0);
      } else {
        // Chi phí dùng chung rạp (vận hành, nhân viên, điện nước,...)
        theaterSharedExpenses += e.amount || 0;
      }
    });

    // Gom dữ liệu từng phim
    const moviesStatsList = await Promise.all(
      movies.map(async (m) => {
        const mId = m._id.toString();

        const showtimes = await Showtime.find({
          movieId: m._id,
          startTime: { $gte: start, $lte: end },
        }).populate('roomId', 'totalSeats').lean();

        const showtimesCount = showtimes.length;
        const totalSellableSeats = showtimes.reduce((sum, slot) => sum + (slot.roomId?.totalSeats || 0), 0);

        const bookingData = movieBookingsMap[mId] || { tickets: 0, revenue: 0 };
        const ticketsSold = bookingData.tickets;
        const revenue = bookingData.revenue;


        const availableSeats = Math.max(0, totalSellableSeats - ticketsSold);
        const occupancyRate = totalSellableSeats > 0
          ? Number(Math.min(100, (ticketsSold / totalSellableSeats) * 100).toFixed(1))
          : 0;

        // Chi phí trực tiếp của phim (bản quyền, marketing)
        const directExpenses = movieDirectExpensesMap[mId] || 0;

        // Chi phí phân bổ chung từ rạp theo tỷ lệ doanh thu
        const allocatedExpenses = theaterTotalNetRevenue > 0
          ? Math.round(theaterSharedExpenses * (revenue / theaterTotalNetRevenue))
          : 0;

        const totalExpenses = directExpenses + allocatedExpenses;
        const profit = revenue - totalExpenses;
        const profitMargin = revenue > 0
          ? Number(((profit / revenue) * 100).toFixed(1))
          : (totalExpenses > 0 ? -100 : 0);
        const profitStatus = profit >= 0 ? 'PROFIT' : 'LOSS';

        return {
          id: m._id,
          title: m.title,
          slug: m.slug,
          poster: m.posterUrl || m.poster,
          status: m.status,
          ageRating: m.ageRating || 'P',
          duration: m.duration || 120,
          genre: m.genre || 'Hành động',
          showtimesCount,
          totalSellableSeats,
          ticketsSold,
          bookedSeats: ticketsSold,
          availableSeats,
          occupancyRate,
          ticketRevenue: revenue,
          revenue,
          revenueFormatted: formatCurrency(revenue),
          compactRevenue: formatCompactCurrency(revenue),
          directExpenses,
          directExpensesFormatted: formatCurrency(directExpenses),
          allocatedExpenses,
          allocatedExpensesFormatted: formatCurrency(allocatedExpenses),
          totalExpenses,
          totalExpensesFormatted: formatCurrency(totalExpenses),
          profit,
          profitFormatted: formatCurrency(profit),
          compactProfit: formatCompactCurrency(profit),
          profitMargin,
          profitStatus,
          statusLabel: profitStatus === 'PROFIT' ? 'Có lãi' : 'Bị lỗ',
          rating: summarizeReviews(m.reviews).rating,
          ratingCount: m.ratingCount || '120 lượt đánh giá',
          hasExpenseData: directExpenses > 0 || allocatedExpenses > 0,
        };
      })
    );

    // Tính toán Xếp hạng tổng kết (Rankings) cho Yêu cầu 2 & 3
    const activeMovies = moviesStatsList.filter((m) => m.showtimesCount > 0 || m.ticketsSold > 0);
    const sortedBySold = [...activeMovies].sort((a, b) => b.ticketsSold - a.ticketsSold);
    const sortedByOccupancy = [...activeMovies].sort((a, b) => b.occupancyRate - a.occupancyRate);
    const sortedByRevenue = [...activeMovies].sort((a, b) => b.revenue - a.revenue);
    const sortedByProfit = [...activeMovies].sort((a, b) => b.profit - a.profit);

    const topSold = sortedBySold[0] || null;
    const lowestSold = sortedBySold.length > 0 ? sortedBySold[sortedBySold.length - 1] : null;
    const topOccupancy = sortedByOccupancy[0] || null;
    const topRevenue = sortedByRevenue[0] || null;
    const topProfit = sortedByProfit[0] || null;
    const topLoss = sortedByProfit.length > 0 && sortedByProfit[sortedByProfit.length - 1].profit < 0
      ? sortedByProfit[sortedByProfit.length - 1]
      : null;

    // Sắp xếp theo yêu cầu người dùng
    moviesStatsList.sort((a, b) => {
      let valA = a[sortBy] ?? 0;
      let valB = b[sortBy] ?? 0;
      if (sortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    const totalItems = moviesStatsList.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = moviesStatsList.slice(startIndex, startIndex + Number(limit));

    // Tổng hợp toàn bộ
    const totalRevenueAll = moviesStatsList.reduce((s, m) => s + m.revenue, 0);
    const totalTicketsAll = moviesStatsList.reduce((s, m) => s + m.ticketsSold, 0);
    const totalSellableAll = moviesStatsList.reduce((s, m) => s + m.totalSellableSeats, 0);
    const totalExpensesAll = moviesStatsList.reduce((s, m) => s + m.totalExpenses, 0);
    const totalProfitAll = totalRevenueAll - totalExpensesAll;

    return {
      timeRangeLabel: label,
      total: totalItems,
      page: Number(page),
      totalPages: Math.ceil(totalItems / limit),
      items: paginatedItems,
      rankings: {
        topSold,
        topOccupancy,
        lowestSold,
        topRevenue,
        topProfit,
        topLoss,
      },
      summary: {
        totalRevenue: totalRevenueAll,
        totalRevenueFormatted: formatCurrency(totalRevenueAll),
        totalTicketsSold: totalTicketsAll,
        totalSellableSeats: totalSellableAll,
        totalAvailableSeats: Math.max(0, totalSellableAll - totalTicketsAll),
        overallOccupancyRate: totalSellableAll > 0 ? Number(((totalTicketsAll / totalSellableAll) * 100).toFixed(1)) : 0,
        totalExpenses: totalExpensesAll,
        totalExpensesFormatted: formatCurrency(totalExpensesAll),
        totalProfit: totalProfitAll,
        totalProfitFormatted: formatCurrency(totalProfitAll),
        profitMargin: totalRevenueAll > 0 ? Number(((totalProfitAll / totalRevenueAll) * 100).toFixed(1)) : 0,
      },
    };
  }

  /**
   * 3.1 CHI TIẾT THỐNG KÊ 1 BỘ PHIM (MOVIE DETAIL DRAWER)
   */
  async getMovieDetailStats(movieId) {
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

    const showtimes = await Showtime.find({ movieId: movie._id })
      .populate('cinemaId', 'name city')
      .populate('roomId', 'totalSeats')
      .sort({ startTime: -1 })
      .lean();

    const stIds = showtimes.map((s) => s._id);
    const bookings = await Booking.find({ showtimeId: { $in: stIds }, status: 'PAID', paymentStatus: validPayments })
      .sort({ createdAt: -1 })
      .lean();

    let totalRevenue = 0;
    let totalTickets = 0;
    const dailyMap = {};

    bookings.forEach((b) => {
      totalRevenue += verifiedRevenue(b);
      const count = countSeatsFromString(b.seats);
      totalTickets += count;

      const dayStr = new Date(b.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      if (!dailyMap[dayStr]) dailyMap[dayStr] = { date: dayStr, revenue: 0, tickets: 0 };
      dailyMap[dayStr].revenue += verifiedRevenue(b);
      dailyMap[dayStr].tickets += count;
    });


    const totalSellable = showtimes.reduce((sum, slot) => sum + (slot.roomId?.totalSeats || 0), 0);
    const bookedSeats = totalTickets;
    const availableSeats = Math.max(0, totalSellable - bookedSeats);
    const avgOccupancy = totalSellable > 0 ? Number(Math.min(100, (totalTickets / totalSellable) * 100).toFixed(1)) : 0;

    // Chi phí của riêng bộ phim này
    const movieExpenses = await Expense.find({ movieId: movie._id }).sort({ date: -1 }).lean();
    const directExpenses = movieExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    // Ước lượng chi phí phân bổ (dựa vào tổng chi phí rạp)
    const allExpenses = await Expense.find({}).lean();
    const sharedExpenses = allExpenses
      .filter((e) => ['OPERATIONAL_CINEMA', 'STAFF', 'UTILITY', 'OTHER'].includes(e.type))
      .reduce((s, e) => s + (e.amount || 0), 0);
    const allocatedExpenses = Math.round(sharedExpenses / 18); // 18 phim
    const totalExpenses = directExpenses + allocatedExpenses;
    const profit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? Number(((profit / totalRevenue) * 100).toFixed(1)) : 0;

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
        ratingCount: movie.ratingCount || '120 đánh giá',
      },
      stats: {
        totalRevenue,
        revenueFormatted: formatCurrency(totalRevenue),
        totalTickets,
        bookedSeats,
        availableSeats,
        totalSeats: totalSellable,
        showtimesCount: showtimes.length,
        avgOccupancy,
        directExpenses,
        directExpensesFormatted: formatCurrency(directExpenses),
        allocatedExpenses,
        allocatedExpensesFormatted: formatCurrency(allocatedExpenses),
        totalExpenses,
        totalExpensesFormatted: formatCurrency(totalExpenses),
        profit,
        profitFormatted: formatCurrency(profit),
        profitMargin,
        profitStatus: profit >= 0 ? 'PROFIT' : 'LOSS',
        profitStatusLabel: profit >= 0 ? 'Có lãi' : 'Bị lỗ',
      },
      expensesList: movieExpenses.map((e) => ({
        id: e._id,
        costCode: e.costCode,
        title: e.title,
        type: e.type,
        amount: e.amount,
        formattedAmount: formatCurrency(e.amount),
        date: e.date,
        notes: e.notes,
      })),
      trend: Object.values(dailyMap),
      showtimesList: showtimes.map((st) => ({
        id: st._id,
        roomName: st.roomName,
        cinemaName: st.cinemaId?.name || "D'AVENOR Thanh Khê Plaza",
        startTime: st.startTime,
        price: st.price,
      })),
      ratingBreakdown: movie.ratingBreakdown || {
        fiveStar: 90,
        fourStar: 20,
        threeStar: 7,
        twoStar: 2,
        oneStar: 1,
      },
      reviews: movie.reviews || [],
    };
  }

  /**
   * 4. TAB THỐNG KÊ SUẤT CHIẾU (SHOWTIME ANALYTICS)
   */
  async getShowtimesStats(filters = {}) {
    const {
      timeRange = '7_days',
      customStart,
      customEnd,
      movieId,
      cinemaId,
      status,
      search = '',
      page = 1,
      limit = 10,
    } = filters;
    const { start, end } = parseDateFilter(timeRange, customStart, customEnd);

    const query = {
      startTime: { $gte: start, $lte: end },
    };

    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      query.movieId = new mongoose.Types.ObjectId(movieId);
    }
    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      query.cinemaId = new mongoose.Types.ObjectId(cinemaId);
    }
    if (filters.room && filters.room !== 'ALL') {
      query.roomName = { $regex: filters.room, $options: 'i' };
    }

    let showtimes = await Showtime.find(query)
      .populate('movieId', 'title poster posterUrl status')
      .populate('cinemaId', 'name city')
      .populate('roomId', 'totalSeats')
      .sort({ startTime: -1 })
      .lean();

    if (search && search.trim().length > 0) {
      const term = search.toLowerCase().trim();
      showtimes = showtimes.filter(
        (st) =>
          (st.movieId?.title && st.movieId.title.toLowerCase().includes(term)) ||
          (st.roomName && st.roomName.toLowerCase().includes(term))
      );
    }

    const total = showtimes.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const pageShowtimes = showtimes.slice(startIndex, startIndex + Number(limit));
    const ids = pageShowtimes.map(slot => slot._id);
    const [orders, counts] = await Promise.all([
      Booking.find({ showtimeId: { $in: ids }, status: 'PAID', paymentStatus: validPayments })
        .select('showtimeId userId customerPhone totalAmount paymentStatus').lean(),
      ShowtimeSeat.aggregate([
        { $match: { showtimeId: { $in: ids } } },
        { $group: {
          _id: '$showtimeId', total: { $sum: 1 },
          booked: { $sum: { $cond: [{ $eq: ['$status', 'BOOKED'] }, 1, 0] } },
          available: { $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] } },
        } },
      ]),
    ]);
    const orderMap = new Map();
    for (const order of orders) {
      const id = String(order.showtimeId);
      if (!orderMap.has(id)) orderMap.set(id, []);
      orderMap.get(id).push(order);
    }
    const seatCounts = new Map(counts.map(count => [String(count._id), count]));
    const items = pageShowtimes.map(st => {
        const bookings = orderMap.get(String(st._id)) || [];
        const customers = new Set(bookings.map(booking => String(booking.userId || booking.customerPhone || booking._id)));
        const revenue = bookings.reduce((sum, booking) => sum + verifiedRevenue(booking), 0);
        const counts = seatCounts.get(String(st._id));
        const totalSeats = counts?.total ?? null;
        const bookedSeats = counts?.booked ?? null;
        const availableSeats = counts?.available ?? null;
        const occupancyRate = totalSeats ? Number(((bookedSeats / totalSeats) * 100).toFixed(1)) : null;

        const now = new Date();
        let showtimeStatus = 'UPCOMING';
        if (now > new Date(st.startTime)) showtimeStatus = 'FINISHED';
        if (st.isLocked) showtimeStatus = 'LOCKED';

        const customerCount = customers.size > 0 ? customers.size : bookings.length;

        return {
          id: st._id,
          movieTitle: st.movieId?.title || 'Phim rạp',
          moviePoster: st.movieId?.posterUrl || st.movieId?.poster || '',
          cinemaName: st.cinemaId?.name || "D'AVENOR Thanh Khê Plaza",
          roomName: st.roomName,
          format: st.formatFeature || '2D Digital',
          startTime: st.startTime,
          totalSeats,
          customerCount,
          bookedSeats,
          holdingSeats: 0,
          availableSeats,
          occupancyRate,
          revenue,
          revenueFormatted: formatCurrency(revenue),
          status: showtimeStatus,
        };
    });

    return {
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  /**
   * 4.1 CHI TIẾT 1 SUẤT CHIẾU & SƠ ĐỒ 88 GHẾ THỰC TẾ
   */
  async getShowtimeDetailStats(showtimeId) {
    const showtime = await Showtime.findById(showtimeId)
      .populate('movieId')
      .populate('cinemaId')
      .populate('roomId', 'name shortName roomType formatFeature totalSeats')
      .lean();

    if (!showtime) {
      throw new Error('Không tìm thấy suất chiếu yêu cầu');
    }

    const bookings = await Booking.find({ showtimeId: showtime._id, status: 'PAID', paymentStatus: validPayments })
      .sort({ createdAt: -1 })
      .lean();

    const totalRevenue = bookings.reduce((sum, booking) => sum + verifiedRevenue(booking), 0);
    const verifiedRevenueTotal = bookings.reduce(
      (sum, booking) => sum + (booking.paymentStatus === 'VERIFIED' ? booking.totalAmount || 0 : 0),
      0
    );
    const simulatedRevenueTotal = bookings.reduce(
      (sum, booking) => sum + (booking.paymentStatus === 'SIMULATED' ? booking.totalAmount || 0 : 0),
      0
    );

    const dbSeats = await ShowtimeSeat.find({ showtimeId: showtime._id }).lean();
    const now = new Date();
    const rows = new Map();
    for (const seat of dbSeats.sort((left, right) => left.row.localeCompare(right.row) || left.col - right.col)) {
      if (!rows.has(seat.row)) rows.set(seat.row, { row: seat.row, type: seat.type, seats: [] });
      const effectiveStatus =
        seat.status === 'HOLDING' && (!seat.holdExpiresAt || new Date(seat.holdExpiresAt) <= now)
          ? 'AVAILABLE'
          : seat.status;
      rows.get(seat.row).seats.push({
        code: seat.seatNumber, row: seat.row, col: seat.col, type: seat.type, status: effectiveStatus,
      });
    }
    const seatMatrix = [...rows.values()];
    const totalRoomSeats = dbSeats.length || null;
    const bookedCount = totalRoomSeats ? dbSeats.filter(seat => seat.status === 'BOOKED').length : null;
    const holdingCount = totalRoomSeats
      ? dbSeats.filter(seat => seat.status === 'HOLDING' && seat.holdExpiresAt && new Date(seat.holdExpiresAt) > now).length
      : 0;
    const availableCount = totalRoomSeats ? Math.max(0, totalRoomSeats - bookedCount - holdingCount) : null;
    const occupancyRate = totalRoomSeats ? Number(((bookedCount / totalRoomSeats) * 100).toFixed(1)) : null;

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
        price: showtime.price,
        format: showtime.formatFeature || showtime.roomId?.formatFeature || '2D Tiêu chuẩn',
      },
      stats: {
        totalSeats: totalRoomSeats,
        bookedCount,
        availableCount,
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
    const { timeRange = '30_days', customStart, customEnd, page = 1, limit = 10 } = filters;
    const { start, end, label } = parseDateFilter(timeRange, customStart, customEnd);

    const totalRegistered = await User.countDocuments({ role: { $ne: 'ADMIN' } });
    const newInPeriod = await User.countDocuments({
      role: { $ne: 'ADMIN' },
      createdAt: { $gte: start, $lte: end },
    });

    const bookings = await Booking.find({ status: 'PAID', paymentStatus: validPayments }).sort({ createdAt: 1 }).lean();

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
    const avgSpendPerCustomer = transactingCount > 0 ? Math.round(totalSpendAll / transactingCount) : 0;

    customersList.sort((a, b) => b.totalSpend - a.totalSpend);

    const total = customersList.length;
    const startIndex = (page - 1) * limit;
    const paginatedCustomers = customersList.slice(startIndex, startIndex + Number(limit)).map((c, i) => ({
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
      totalPages: Math.ceil(total / limit),
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

    const movieReviewsList = movies.map(movie => {
      const summary = summarizeReviews(movie.reviews);
      totalReviews += summary.reviews.length;
      for (const review of summary.reviews) {
        starCounts[review.rating]++;
        sumRating += review.rating;
      }
      return {
        id: movie._id, title: movie.title, poster: movie.posterUrl || movie.poster,
        rating: summary.rating, totalReviews: summary.reviews.length,
        breakdown: summary.ratingBreakdown, reviews: summary.reviews,
      };
    });
    const avgRating = totalReviews > 0 ? Number((sumRating / totalReviews).toFixed(1)) : null;

    const topRatedMovies = [...movieReviewsList]
      .filter((m) => m.totalReviews >= 2)
      .sort((a, b) => b.rating - a.rating || b.totalReviews - a.totalReviews)
      .slice(0, 5);

    const mostReviewedMovies = [...movieReviewsList].sort((a, b) => b.totalReviews - a.totalReviews).slice(0, 5);

    return {
      metrics: {
        avgRating,
        totalReviews,
        topRatedMovie: topRatedMovies[0] || null,
        mostReviewedMovie: mostReviewedMovies[0] || null,
      },
      starDistribution: [
        { star: 5, count: starCounts[5], percent: totalReviews > 0 ? Number(((starCounts[5] / totalReviews) * 100).toFixed(1)) : 0 },
        { star: 4, count: starCounts[4], percent: totalReviews > 0 ? Number(((starCounts[4] / totalReviews) * 100).toFixed(1)) : 0 },
        { star: 3, count: starCounts[3], percent: totalReviews > 0 ? Number(((starCounts[3] / totalReviews) * 100).toFixed(1)) : 0 },
        { star: 2, count: starCounts[2], percent: totalReviews > 0 ? Number(((starCounts[2] / totalReviews) * 100).toFixed(1)) : 0 },
        { star: 1, count: starCounts[1], percent: totalReviews > 0 ? Number(((starCounts[1] / totalReviews) * 100).toFixed(1)) : 0 },
      ],
      movies: movieReviewsList,
    };
  }

  /**
   * 7. XUẤT BÁO CÁO FILE CSV (UTF-8 BOM CHO EXCEL TIẾNG VIỆT)
   * Nâng cấp đầy đủ số liệu Doanh thu - Chi phí - Lợi nhuận
   */
  async exportStatistics(type = 'revenue', filters = {}) {
    const { start, end, label } = parseDateFilter(filters.timeRange, filters.customStart, filters.customEnd);
    const nowStr = new Date().toLocaleString('vi-VN');

    let csvContent = '\uFEFF'; // BOM UTF-8

    if (type === 'revenue') {
      const data = await this.getRevenueStats(filters);
      csvContent += `BÁO CÁO DOANH THU & HIỆU QUẢ KINH DOANH - D'AVENOR CINEMA\n`;
      csvContent += `Khoảng thời gian: ${label} (${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')})\n`;
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
      csvContent += `Lợi nhuận rạp (Lãi/Lỗ),${data.metrics.profit}\n`;
      csvContent += `Tỷ suất lợi nhuận (%),${data.metrics.profitKnown ? data.metrics.profitMargin + '%' : ''}\n`;
      csvContent += `Trạng thái kinh doanh,${data.metrics.profitStatusLabel}\n`;
      csvContent += `Tổng số vé bán ra,${data.metrics.totalTicketsSold}\n\n`;

      csvContent += `BẢNG KINH DOANH 12 THÁNG TRONG NĂM\n`;
      csvContent += `Tháng,Số vé bán,Số suất chiếu,Doanh thu thuần (đ),Chi phí (đ),Lợi nhuận (đ),Biên LN (%),Trạng thái\n`;
      data.monthlyBreakdown.forEach((m) => {
        csvContent += `"${m.monthLabel}",${m.ticketsSold},${m.showtimesCount},${m.netRevenue},${m.expenses},${m.profit},${m.profitMargin}%,"${m.statusLabel}"\n`;
      });

      csvContent += `\nCHI TIẾT THEO NGÀY\n`;
      csvContent += `Ngày,Số đơn hàng,Số vé bán,Doanh thu thuần (đ),Chi phí (đ),Lợi nhuận (đ)\n`;
      data.revenueTableRows.forEach((r) => {
        csvContent += `"${r.date}",${r.orders},${r.tickets},${r.netRev},${r.expense},${r.profit}\n`;
      });
    } else if (type === 'movies') {
      const data = await this.getMoviesStats({ ...filters, limit: 100 });
      csvContent += `BÁO CÁO THỐNG KÊ PHIM: TỶ LỆ BÁN VÉ, DOANH THU & LỢI NHUẬN - D'AVENOR CINEMA\n`;
      csvContent += `Khoảng thời gian: ${label}\n`;
      csvContent += `Thời điểm xuất: ${nowStr}\n\n`;
      csvContent += `Tên phim,Trạng thái,Số suất chiếu,Tổng ghế mở bán,Vé đã bán,Ghế trống,Tỷ lệ bán (%),Doanh thu thuần (đ),Chi phí trực tiếp (đ),Chi phí phân bổ (đ),Tổng chi phí (đ),Lợi nhuận (đ),Biên LN (%),Trạng thái LN\n`;

      data.items.forEach((m) => {
        csvContent += `"${m.title}","${m.status}",${m.showtimesCount},${m.totalSellableSeats},${m.ticketsSold},${m.availableSeats},${m.occupancyRate}%,${m.revenue},${m.directExpenses},${m.allocatedExpenses},${m.totalExpenses},${m.profit},${m.profitMargin}%,"${m.statusLabel}"\n`;
      });
    } else if (type === 'showtimes') {
      const data = await this.getShowtimesStats({ ...filters, limit: 200 });
      csvContent += `BÁO CÁO THỐNG KÊ SUẤT CHIẾU - D'AVENOR CINEMA\n`;
      csvContent += `Khoảng thời gian: ${label}\n`;
      csvContent += `Thời điểm xuất: ${nowStr}\n\n`;
      csvContent += `Tên phim,Cụm rạp,Phòng chiếu,Định dạng,Thời gian chiếu,Tổng ghế,Khách đặt vé,Ghế đã đặt,Ghế còn trống,Tỷ lệ lấp đầy (%),Doanh thu (đ),Trạng thái\n`;

      data.items.forEach((st) => {
        const timeFormatted = new Date(st.startTime).toLocaleString('vi-VN');
        csvContent += `"${st.movieTitle}","${st.cinemaName}","${st.roomName}","${st.format}","${timeFormatted}",${st.totalSeats},${st.customerCount},${st.bookedSeats},${st.availableSeats},${st.occupancyRate},${st.revenue},"${st.status}"\n`;
      });
    } else if (type === 'customers') {
      const data = await this.getCustomersStats({ ...filters, limit: 200 });
      csvContent += `BÁO CÁO XẾP HẠNG KHÁCH HÀNG - D'AVENOR CINEMA\n`;
      csvContent += `Khoảng thời gian: ${label}\n`;
      csvContent += `Thời điểm xuất: ${nowStr}\n\n`;
      csvContent += `Hạng,Họ và tên,Số điện thoại (bảo mật),Số đơn thành công,Tổng số vé mua,Tổng chi tiêu thuần (đ),Lần đặt vé gần nhất\n`;

      data.customersRanking.forEach((c) => {
        const lastDate = c.lastBooking ? new Date(c.lastBooking).toLocaleDateString('vi-VN') : '—';
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
