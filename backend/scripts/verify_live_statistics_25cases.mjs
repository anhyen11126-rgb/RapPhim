import assert from 'node:assert/strict';
import dns from 'node:dns';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import dotenv from 'dotenv';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // fallback to system DNS
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

import { getActiveDbMode, resolveMongoUri } from '../src/config/db.js';
import {
  makeVietnamDate,
  StatisticsPeriodValidationError,
} from '../src/utils/statisticsUtils.js';
import statisticsService from '../src/services/statisticsService.js';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Cinema from '../src/models/Cinema.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import Booking from '../src/models/Booking.js';
import Expense from '../src/models/Expense.js';

const results = [];
const record = (id, title, passed, detail = '') => {
  results.push({ id, title, status: passed ? 'PASS' : 'FAIL', detail });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'} [${id}] ${title}${detail ? ` -> ${detail}` : ''}`);
  if (!passed) throw new Error(`Test ${id} failed: ${detail}`);
};

function build88Seats(showtimeId, roomId) {
  const docs = [];
  for (const row of ['A', 'B', 'C', 'D']) {
    for (let col = 1; col <= 12; col++) {
      docs.push({
        showtimeId,
        roomId,
        seatNumber: `${row}${col}`,
        row,
        col,
        type: 'STANDARD',
        status: 'AVAILABLE',
      });
    }
  }
  for (const row of ['E', 'F', 'G']) {
    for (let col = 1; col <= 12; col++) {
      docs.push({
        showtimeId,
        roomId,
        seatNumber: `${row}${col}`,
        row,
        col,
        type: 'VIP',
        status: 'AVAILABLE',
      });
    }
  }
  for (let col = 1; col <= 4; col++) {
    docs.push({
      showtimeId,
      roomId,
      seatNumber: `H${col}`,
      row: 'H',
      col,
      type: 'SWEETBOX',
      status: 'AVAILABLE',
    });
  }
  return docs;
}

async function runTests() {
  // ============================================================================
  // PHẦN A: ĐỐI SOÁT READ-ONLY TRỰC TIẾP TRÊN MONGODB ATLAS LIVE (movietix_db)
  // ============================================================================
  const activeMode = getActiveDbMode();
  const resolvedUri = resolveMongoUri();
  await mongoose.connect(resolvedUri, { serverSelectionTimeoutMS: 15000 });
  const connName = mongoose.connection.name;

  record(
    'TC01',
    'LIVE kết nối đúng database movietix_db (DB_MODE=LIVE)',
    activeMode === 'LIVE' && connName === 'movietix_db',
    `DB_MODE=${activeMode}, mongoose.connection.name=${connName}`
  );

  // Kiểm tra lỗi validation khi truy vấn tháng 10/2026 trên LIVE
  let octBlocked = false;
  let octErrMsg = '';
  try {
    await statisticsService.getOverviewStats({ timeRange: 'by_month', month: 10, year: 2026 });
  } catch (err) {
    octBlocked = err instanceof StatisticsPeriodValidationError || err?.statusCode === 400;
    octErrMsg = err.message;
  }
  record(
    'TC02_TC03',
    'Tháng 10/2026 bị chặn bởi validation (HTTP 400) & API không trả dữ liệu trước ngày vận hành 01/11/2026',
    octBlocked,
    octErrMsg
  );

  // Đối soát 5 API trên LIVE DB cho Tháng 11/2026
  const liveOverview = await statisticsService.getOverviewStats({
    timeRange: 'by_month',
    month: 11,
    year: 2026,
  });
  const liveRevenue = await statisticsService.getRevenueStats({
    timeRange: 'by_month',
    month: 11,
    year: 2026,
  });
  const liveMovies = await statisticsService.getMoviesStats({
    timeRange: 'by_month',
    month: 11,
    year: 2026,
  });
  const liveShowtimes = await statisticsService.getShowtimesStats({
    timeRange: 'by_month',
    month: 11,
    year: 2026,
    limit: 500,
  });
  const liveFilterMovies = await statisticsService.getPeriodFilterMovies({
    timeRange: 'by_month',
    month: 11,
    year: 2026,
  });

  record(
    'TC04',
    'Báo cáo năm 2026 bắt đầu từ tháng 11 (monthlyBreakdown chỉ gồm Tháng 11 & Tháng 12/2026)',
    liveRevenue.monthlyBreakdown.length === 2 &&
      liveRevenue.monthlyBreakdown[0].month === 11 &&
      liveRevenue.monthlyBreakdown[1].month === 12,
    `Months: ${liveRevenue.monthlyBreakdown.map((m) => m.monthLabel).join(', ')}`
  );

  const liveMovieTitles = liveMovies.items.map((m) => m.title).sort();
  record(
    'TC05',
    'Tháng 11/2026 trên LIVE chỉ có đúng 3 phim thực sự hoạt động (Dune, Mai, Deadpool & Wolverine), không hiển thị 15 phim COMING_SOON',
    liveOverview.kpis.distinctMovies.value === 3 &&
      liveMovies.total === 3 &&
      liveRevenue.movieRevenueRows.length === 3 &&
      liveOverview.schedulePolicyWarning === null,
    `3 phim: ${liveMovieTitles.join(' | ')}`
  );

  record(
    'TC06',
    'Bộ lọc phim (getPeriodFilterMovies) đồng bộ 100% với bảng thống kê (3 phim)',
    liveFilterMovies.total === 3 &&
      liveFilterMovies.items.map((m) => m.title).sort().join('|') === liveMovieTitles.join('|'),
    `Filter movies (${liveFilterMovies.total}): ${liveFilterMovies.items
      .map((m) => `${m.title} (${m.showtimesCount} suất)`)
      .join(', ')}`
  );

  record(
    'TC07',
    'Ba tab thống kê (Overview, Revenue, Movies/Showtimes) đồng bộ tuyệt đối về doanh thu, số vé, số suất hoạt động',
    liveOverview.kpis.netRevenue.value === liveRevenue.metrics.netRevenue &&
      liveRevenue.metrics.netRevenue === liveMovies.summary.totalRevenue &&
      liveOverview.kpis.validTicketsSold.value === liveRevenue.metrics.totalTicketsSold &&
      liveRevenue.metrics.totalTicketsSold === liveMovies.summary.totalTicketsSold &&
      liveOverview.kpis.totalShowtimes.value === liveMovies.summary.totalShowtimes,
    `Revenue=${liveOverview.kpis.netRevenue.value}đ, Tickets=${liveOverview.kpis.validTicketsSold.value}, ActiveShowtimes=${liveOverview.kpis.totalShowtimes.value}, TotalShowtimesWithCancelled=${liveShowtimes.total}`
  );

  record(
    'TC08',
    'Hai bảng hiệu suất phim (Tỷ lệ bán vé vs Tài chính Lợi nhuận) đồng bộ hoàn toàn trên cùng nguồn dữ liệu',
    liveMovies.items.every((m) => {
      const revRow = liveRevenue.movieRevenueRows.find(
        (r) => String(r.movieId) === String(m.movieId)
      );
      return (
        revRow &&
        revRow.showtimesCount === m.showtimesCount &&
        revRow.tickets === m.ticketsSold &&
        revRow.netRevenue === m.revenue
      );
    }),
    'Mọi dòng phim giữa MoviesTab và RevenueTab khớp 100%'
  );

  // Kiểm tra Drawer chi tiết phim cho từng phim trong 3 phim
  for (const mv of liveMovies.items) {
    const detail = await statisticsService.getMovieDetailStats(mv.movieId, {
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });
    assert.equal(detail.stats.showtimesCount, mv.showtimesCount);
    assert.equal(detail.stats.totalTickets, mv.ticketsSold);
    assert.equal(detail.stats.totalRevenue, mv.revenue);
    assert.equal(detail.stats.totalSeats, mv.totalSellableSeats);
  }
  record(
    'TC09',
    'Drawer chi tiết phim (getMovieDetailStats) khớp 100% số suất, tổng ghế, vé bán và doanh thu với bảng',
    true,
    'Đã đối soát cả 3 phim Dune (76 suất), Mai (75 suất), Deadpool & Wolverine (75 suất)'
  );

  // Kiểm tra Drawer chi tiết suất chiếu với ShowtimeSeat
  const sampleShowtime =
    liveShowtimes.items.find((s) => s.bookedSeats > 0) || liveShowtimes.items[0];
  const stDetail = await statisticsService.getShowtimeDetailStats(sampleShowtime.id);
  record(
    'TC10',
    'Drawer chi tiết suất chiếu khớp ShowtimeSeat (88 ghế, tổng ghế = booked + holding + available)',
    stDetail.stats.totalSeats === 88 &&
      stDetail.stats.bookedCount + stDetail.stats.holdingCount + stDetail.stats.availableCount ===
        88 &&
      stDetail.stats.bookedCount === sampleShowtime.bookedSeats,
    `Showtime ${sampleShowtime.id}: total=${stDetail.stats.totalSeats}, booked=${stDetail.stats.bookedCount}, available=${stDetail.stats.availableCount}`
  );

  record(
    'TC11',
    'Không tính suất đã hủy (3 suất CANCELLED) vào công suất ghế mở bán (226 suất × 88 = 19.888 ghế)',
    liveOverview.kpis.totalShowtimes.cancelledCount === 3 &&
      liveOverview.kpis.totalShowtimes.value === 226 &&
      liveOverview.occupancy.totalSellable === 226 * 88,
    `Active=${liveOverview.kpis.totalShowtimes.value}, Cancelled=${liveOverview.kpis.totalShowtimes.cancelledCount}, TotalSellable=${liveOverview.occupancy.totalSellable}`
  );

  record(
    'TC14',
    'Không hiển thị lợi nhuận giả / Hòa vốn khi chưa có chứng từ chi phí (profit = null, status = INSUFFICIENT_DATA)',
    liveOverview.hasExpenseData === false &&
      liveOverview.kpis.profit.value === null &&
      liveOverview.kpis.profit.status === 'INSUFFICIENT_DATA' &&
      liveRevenue.metrics.hasExpenseData === false &&
      liveRevenue.metrics.profitStatus === 'INSUFFICIENT_DATA' &&
      liveMovies.items.every((m) => m.profit === null && m.profitStatus === 'INSUFFICIENT_DATA'),
    `Overview profit=${liveOverview.kpis.profit.formatted}, status=${liveOverview.kpis.profit.statusLabel}`
  );

  record(
    'TC15',
    'Doanh thu VERIFIED (0 đ) và SIMULATED (130.000 đ) được tách biệt rõ ràng, badge là "Doanh thu mô phỏng"',
    liveOverview.revenueSplitByPaymentStatus.verifiedRevenue === 0 &&
      liveOverview.revenueSplitByPaymentStatus.simulatedRevenue === 130000 &&
      liveOverview.revenueSourceBadge === 'Doanh thu mô phỏng',
    `VERIFIED=${liveOverview.revenueSplitByPaymentStatus.verifiedRevenue}đ, SIMULATED=${liveOverview.revenueSplitByPaymentStatus.simulatedRevenue}đ`
  );

  record(
    'TC16',
    'Tháng 11/2026 là tháng đầu vận hành nên không tính tăng trưởng MoM so với tháng 10 (hasValidPreviousPeriod = false, growth = null)',
    liveOverview.hasValidPreviousPeriod === false &&
      liveOverview.isFirstOperatingMonth === true &&
      liveOverview.momComparison.revenue.growth === null &&
      liveOverview.momComparison.tickets.growth === null &&
      liveOverview.kpis.netRevenue.subtitle === 'Tháng đầu vận hành',
    `hasValidPreviousPeriod=${liveOverview.hasValidPreviousPeriod}, note=${liveOverview.momComparisonNote}`
  );

  const csvOverview = await statisticsService.exportStatistics('overview', {
    timeRange: 'by_month',
    month: 11,
    year: 2026,
  });
  const csvMovies = await statisticsService.exportStatistics('movies', {
    timeRange: 'by_month',
    month: 11,
    year: 2026,
  });
  record(
    'TC17',
    'Xuất báo cáo CSV khớp 100% với bộ lọc và số liệu trên UI (UTF-8 BOM, 3 phim, 226 suất, 19.888 ghế, 130.000đ)',
    csvOverview.content.includes('Doanh thu thuần (Theo thời điểm giao dịch),130000') &&
      csvOverview.content.includes('Số bộ phim có lịch chiếu,3') &&
      csvOverview.content.includes('Tổng suất chiếu hoạt động,226') &&
      csvOverview.content.includes('Tổng số ghế mở bán của các suất trong kỳ,19888') &&
      csvMovies.content.includes('Dune: Hành Tinh Cát – Phần 2') &&
      !csvMovies.content.includes('Spider-Man: No Way Home'),
    `CSV fileName=${csvOverview.fileName}`
  );

  // Tháng 12/2026 chưa có lịch chiếu -> hiển thị đúng empty state
  const decOverview = await statisticsService.getOverviewStats({
    timeRange: 'by_month',
    month: 12,
    year: 2026,
  });
  const decMovies = await statisticsService.getMoviesStats({
    timeRange: 'by_month',
    month: 12,
    year: 2026,
  });
  record(
    'TC18',
    'Tháng chưa có lịch chiếu (Tháng 12/2026) trả về đúng trạng thái trống (hasActivityInPeriod = false, 0 phim, 0 suất)',
    decOverview.hasActivityInPeriod === false &&
      decOverview.kpis.distinctMovies.value === 0 &&
      decOverview.kpis.totalShowtimes.value === 0 &&
      decMovies.total === 0,
    `Dec 2026: hasActivity=${decOverview.hasActivityInPeriod}, movies=${decMovies.total}`
  );

  await mongoose.disconnect();

  // ============================================================================
  // PHẦN B: KIỂM THỬ CÁC THAO TÁC ĐỘNG & 4 HẠNG MỤC FINAL VALIDATION
  // TRÊN MONGOMEMORYREPLSET CÔ LẬP (TUYỆT ĐỐI KHÔNG GHI VÀO ATLAS)
  // ============================================================================
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replSet.getUri(), { dbName: 'movietix_isolated_test' });

  try {
    const cinema = await Cinema.create({
      name: "D'AVENOR Thanh Khê Plaza",
      city: 'Đà Nẵng',
      address: 'Thanh Khê, Đà Nẵng',
    });

    const roomImax = await Room.create({
      cinemaId: cinema._id,
      roomNumber: 1,
      name: 'Phòng 01 - IMAX Laser',
      shortName: 'Phòng 01',
      roomType: 'IMAX Laser',
      totalSeats: 88,
      status: 'ACTIVE',
    });

    const [m1, m2, m3, m4, m5, m6] = await Movie.create([
      {
        title: 'Dune: Hành Tinh Cát – Phần 2',
        slug: 'dune-2',
        posterUrl: 'https://example.com/dune.jpg',
        genre: 'Sci-Fi',
        duration: 166,
        status: 'NOW_SHOWING',
      },
      {
        title: 'Mai',
        slug: 'mai',
        posterUrl: 'https://example.com/mai.jpg',
        genre: 'Tâm lý',
        duration: 131,
        status: 'NOW_SHOWING',
      },
      {
        title: 'Deadpool & Wolverine',
        slug: 'deadpool-wolverine',
        posterUrl: 'https://example.com/dp.jpg',
        genre: 'Hành động',
        duration: 128,
        status: 'NOW_SHOWING',
      },
      {
        title: 'Oppenheimer',
        slug: 'oppenheimer',
        posterUrl: 'https://example.com/opp.jpg',
        genre: 'Lịch sử',
        duration: 180,
        status: 'NOW_SHOWING',
      },
      {
        title: 'Interstellar IMAX',
        slug: 'interstellar',
        posterUrl: 'https://example.com/inter.jpg',
        genre: 'Sci-Fi',
        duration: 169,
        status: 'NOW_SHOWING',
      },
      {
        title: 'Avatar: The Way of Water',
        slug: 'avatar-2',
        posterUrl: 'https://example.com/avatar.jpg',
        genre: 'Sci-Fi',
        duration: 192,
        status: 'NOW_SHOWING',
      },
    ]);

    // Tạo 1 suất ĐÃ KẾT THÚC (05/11/2026) cho m1 và 1 suất SẮP CHIẾU (28/11/2026) cho m2
    const pastStart = makeVietnamDate(2026, 11, 5, 10, 0, 0);
    const pastEnd = makeVietnamDate(2026, 11, 5, 12, 46, 0);
    const futureStart = makeVietnamDate(2026, 11, 28, 19, 0, 0);
    const futureEnd = makeVietnamDate(2026, 11, 28, 21, 11, 0);

    const stPast = await Showtime.create({
      movieId: m1._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: pastStart,
      endTime: pastEnd,
      lifecycleStatus: 'COMPLETED',
      price: 130000,
    });

    const stFuture = await Showtime.create({
      movieId: m2._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: futureStart,
      endTime: futureEnd,
      lifecycleStatus: 'UPCOMING',
      price: 130000,
    });

    await ShowtimeSeat.insertMany([
      ...build88Seats(stPast._id, roomImax._id),
      ...build88Seats(stFuture._id, roomImax._id),
    ]);

    // Đặt 3 ghế HOLDING còn hạn trên suất sắp chiếu stFuture
    const futureHoldExpire = new Date(Date.now() + 10 * 60 * 1000);
    await ShowtimeSeat.updateMany(
      { showtimeId: stFuture._id, seatNumber: { $in: ['E1', 'E2', 'E3'] } },
      { $set: { status: 'HOLDING', holdId: 'HOLD-TEST-1', holdExpiresAt: futureHoldExpire } }
    );

    const statsWithHold = await statisticsService.getOverviewStats({
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });

    record(
      'TC12',
      'Không tính ghế HOLDING còn hạn vào số vé đã bán (booked = 0, holding = 3, available = 173)',
      statsWithHold.occupancy.booked === 0 &&
        statsWithHold.occupancy.holding === 3 &&
        statsWithHold.occupancy.totalSellable === 176 &&
        statsWithHold.occupancy.available === 173,
      `booked=${statsWithHold.occupancy.booked}, holding=${statsWithHold.occupancy.holding}, available=${statsWithHold.occupancy.available}`
    );

    record(
      'TC13',
      'Không tính ghế trống của suất đã kết thúc (88 ghế stPast) là ghế khách còn đặt được (completedUnsoldSeats = 88, upcomingAvailableSeats = 85)',
      statsWithHold.occupancy.completedUnsoldSeats === 88 &&
        statsWithHold.occupancy.upcomingAvailableSeats === 85,
      `completedUnsoldSeats=${statsWithHold.occupancy.completedUnsoldSeats}, upcomingAvailableSeats=${statsWithHold.occupancy.upcomingAvailableSeats}`
    );

    // TC19: Admin xếp lịch phim mới (m3) thì thống kê tự cập nhật từ 2 phim lên 3 phim
    const stM3 = await Showtime.create({
      movieId: m3._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: makeVietnamDate(2026, 11, 29, 19, 0, 0),
      endTime: makeVietnamDate(2026, 11, 29, 21, 8, 0),
      lifecycleStatus: 'UPCOMING',
      price: 130000,
    });
    await ShowtimeSeat.insertMany(build88Seats(stM3._id, roomImax._id));

    const statsAfterScheduleM3 = await statisticsService.getOverviewStats({
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });
    record(
      'TC19',
      'Admin xếp lịch phim mới (Deadpool & Wolverine) thì thống kê tự động cập nhật từ 2 phim lên 3 phim (264 ghế mở bán)',
      statsAfterScheduleM3.kpis.distinctMovies.value === 3 &&
        statsAfterScheduleM3.occupancy.totalSellable === 264,
      `distinctMovies=${statsAfterScheduleM3.kpis.distinctMovies.value}, totalSellable=${statsAfterScheduleM3.occupancy.totalSellable}`
    );

    // TC20: Khách đặt vé thành công (2 ghế VIP = 300.000đ + 1 combo 90.000đ = 390.000đ VERIFIED)
    const booking1 = await Booking.create({
      bookingCode: 'MTX-TEST-LIVE-001',
      movieId: m2._id,
      roomId: roomImax._id,
      showtimeId: stFuture._id,
      customerName: 'Khách Kiểm Thử',
      customerPhone: '0905111222',
      seats: 'F5, F6',
      concessions: '1x Combo Solo',
      totalAmount: 390000,
      status: 'PAID',
      paymentStatus: 'VERIFIED',
      priceSnapshot: {
        tickets: [
          { seatNumber: 'F5', price: 150000 },
          { seatNumber: 'F6', price: 150000 },
        ],
        combos: [{ name: 'Combo Solo', quantity: 1, price: 90000 }],
        discount: 0,
      },
      paymentMethod: 'MOMO',
      createdAt: makeVietnamDate(2026, 11, 26, 10, 0, 0),
    });
    await ShowtimeSeat.updateMany(
      { showtimeId: stFuture._id, seatNumber: { $in: ['F5', 'F6'] } },
      { $set: { status: 'BOOKED', bookingId: booking1._id } }
    );

    const statsAfterBooking = await statisticsService.getOverviewStats({
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });
    record(
      'TC20',
      'Khách đặt vé thành công thì doanh thu (+390.000đ), vé bán (+2 vé) và ghế còn trống (-2 ghế) tăng/giảm chính xác',
      statsAfterBooking.kpis.netRevenue.value === 390000 &&
        statsAfterBooking.kpis.ticketRevenue.value === 300000 &&
        statsAfterBooking.kpis.concessionRevenue.value === 90000 &&
        statsAfterBooking.kpis.validTicketsSold.value === 2 &&
        statsAfterBooking.occupancy.upcomingAvailableSeats === 171,
      `netRevenue=${statsAfterBooking.kpis.netRevenue.value}đ, tickets=${statsAfterBooking.kpis.validTicketsSold.value}, upcomingAvail=${statsAfterBooking.occupancy.upcomingAvailableSeats}`
    );

    // TC21: Hủy vé (CANCELLED + REFUNDED) thì thống kê doanh thu, vé hợp lệ và ghế trống cập nhật đúng
    booking1.status = 'CANCELLED';
    booking1.refundStatus = 'REFUNDED';
    booking1.refundAmount = 390000;
    await booking1.save();
    await ShowtimeSeat.updateMany(
      { showtimeId: stFuture._id, seatNumber: { $in: ['F5', 'F6'] } },
      { $set: { status: 'AVAILABLE', bookingId: null } }
    );

    const statsAfterCancel = await statisticsService.getOverviewStats({
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });
    const revAfterCancel = await statisticsService.getRevenueStats({
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });
    record(
      'TC21',
      'Hủy vé hoàn tiền thì doanh thu thuần về 0đ (không bị trừ âm 2 lần), đơn hủy = 1, tiền hoàn = 390.000đ, ghế trống phục hồi lên 173',
      statsAfterCancel.kpis.netRevenue.value === 0 &&
        statsAfterCancel.kpis.validTicketsSold.value === 0 &&
        statsAfterCancel.kpis.validTicketsSold.cancelledOrders === 1 &&
        revAfterCancel.metrics.refundedAmount === 390000 &&
        statsAfterCancel.occupancy.upcomingAvailableSeats === 173,
      `netRevenue=${statsAfterCancel.kpis.netRevenue.value}đ, refunded=${revAfterCancel.metrics.refundedAmount}đ, upcomingAvail=${statsAfterCancel.occupancy.upcomingAvailableSeats}`
    );

    // TC22: Thêm chi phí thực tế thì lợi nhuận, biên lợi nhuận và phân bổ chi phí cập nhật đúng
    await Booking.create({
      bookingCode: 'MTX-TEST-LIVE-002',
      movieId: m1._id,
      roomId: roomImax._id,
      showtimeId: stPast._id,
      customerName: 'Khách 2',
      customerPhone: '0905333444',
      seats: 'E5, E6, E7, E8',
      totalAmount: 600000,
      status: 'PAID',
      paymentStatus: 'VERIFIED',
      paymentMethod: 'VNPAY',
      createdAt: makeVietnamDate(2026, 11, 5, 9, 0, 0),
    });
    await ShowtimeSeat.updateMany(
      { showtimeId: stPast._id, seatNumber: { $in: ['E5', 'E6', 'E7', 'E8'] } },
      { $set: { status: 'BOOKED' } }
    );
    await Expense.create([
      {
        costCode: 'CP-202611-001',
        title: 'Bản quyền phim Dune 2',
        type: 'MOVIE_LICENSE',
        amount: 200000,
        movieId: m1._id,
        date: makeVietnamDate(2026, 11, 2, 10, 0, 0),
        month: 11,
        year: 2026,
      },
      {
        costCode: 'CP-202611-002',
        title: 'Chi phí vận hành điện nước',
        type: 'ELECTRICITY_WATER',
        amount: 100000,
        movieId: null,
        date: makeVietnamDate(2026, 11, 15, 10, 0, 0),
        month: 11,
        year: 2026,
      },
    ]);

    const revWithExpense = await statisticsService.getRevenueStats({
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });
    const sumAllocated = revWithExpense.movieRevenueRows.reduce(
      (s, r) => s + r.allocatedOperationalCost,
      0
    );
    record(
      'TC22',
      'Thêm chi phí (200k trực tiếp + 100k vận hành) -> Lợi nhuận = 600k - 300k = 300k (Biên LN 50%, ROI 100%) & tổng phân bổ 3 phim khớp đúng 100.000đ không lệch số làm tròn',
      revWithExpense.metrics.hasExpenseData === true &&
        revWithExpense.metrics.profit === 300000 &&
        revWithExpense.metrics.profitMargin === 50 &&
        revWithExpense.metrics.roi === 100 &&
        sumAllocated === 100000,
      `profit=${revWithExpense.metrics.profit}đ, margin=${revWithExpense.metrics.profitMargin}%, roi=${revWithExpense.metrics.roi}%, sumAllocated=${sumAllocated}đ`
    );

    // ============================================================================
    // PHẦN C: 4 HẠNG MỤC FINAL VALIDATION (FV01, FV02, FV03, FV04)
    // ============================================================================

    // FV01: Kiểm tra số ghế thực sự còn đặt được (NOW_SHOWING, CLEANING, COMPLETED, LOCKED, thiếu ShowtimeSeat)
    const stNowShowing = await Showtime.create({
      movieId: m1._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: makeVietnamDate(2026, 11, 26, 12, 30, 0),
      endTime: makeVietnamDate(2026, 11, 26, 15, 16, 0),
      lifecycleStatus: 'NOW_SHOWING',
      price: 130000,
    });
    const stCleaning = await Showtime.create({
      movieId: m1._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: makeVietnamDate(2026, 11, 26, 9, 0, 0),
      endTime: makeVietnamDate(2026, 11, 26, 11, 46, 0),
      lifecycleStatus: 'CLEANING',
      price: 130000,
    });
    const stLockedUpcoming = await Showtime.create({
      movieId: m2._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: makeVietnamDate(2026, 11, 30, 19, 0, 0),
      endTime: makeVietnamDate(2026, 11, 30, 21, 11, 0),
      lifecycleStatus: 'UPCOMING',
      isLocked: true,
      price: 130000,
    });
    const stNoSeatDocsUpcoming = await Showtime.create({
      movieId: m3._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: makeVietnamDate(2026, 11, 30, 21, 30, 0),
      endTime: makeVietnamDate(2026, 11, 30, 23, 38, 0),
      lifecycleStatus: 'UPCOMING',
      price: 130000,
    });

    await ShowtimeSeat.insertMany([
      ...build88Seats(stNowShowing._id, roomImax._id),
      ...build88Seats(stCleaning._id, roomImax._id),
      ...build88Seats(stLockedUpcoming._id, roomImax._id),
    ]);

    const fv01Overview = await statisticsService.getOverviewStats({
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });
    const detailNowShowing = await statisticsService.getShowtimeDetailStats(stNowShowing._id);
    const detailCleaning = await statisticsService.getShowtimeDetailStats(stCleaning._id);
    const detailLocked = await statisticsService.getShowtimeDetailStats(stLockedUpcoming._id);
    const detailNoSeats = await statisticsService.getShowtimeDetailStats(stNoSeatDocsUpcoming._id);

    record(
      'FV01',
      'Ghế thực sự còn đặt được (upcomingAvailableSeats) loại trừ hoàn toàn suất NOW_SHOWING, CLEANING, COMPLETED, suất bị Admin khóa (isLocked=true) và suất thiếu ShowtimeSeat',
      detailNowShowing.stats.bookableAvailableCount === 0 &&
        detailCleaning.stats.bookableAvailableCount === 0 &&
        detailLocked.stats.bookableAvailableCount === 0 &&
        detailLocked.stats.lockedUpcomingUnsoldCount === 88 &&
        detailNoSeats.stats.bookableAvailableCount === 0 &&
        fv01Overview.occupancy.upcomingAvailableSeats === 173 && // Chỉ từ stFuture (85) + stM3 (88) = 173 ghế
        fv01Overview.occupancy.lockedUpcomingUnsoldSeats === 88 &&
        fv01Overview.occupancy.missingSeatShowtimesCount === 1,
      `upcomingAvailableSeats=${fv01Overview.occupancy.upcomingAvailableSeats} (chỉ stFuture 85 + stM3 88), lockedUnsold=${fv01Overview.occupancy.lockedUpcomingUnsoldSeats}, completedUnsold=${fv01Overview.occupancy.completedUnsoldSeats}`
    );

    // Xóa 4 suất phụ trợ FV01 để kiểm tra sạch FV02, FV03, FV04
    await ShowtimeSeat.deleteMany({
      showtimeId: { $in: [stNowShowing._id, stCleaning._id, stLockedUpcoming._id] },
    });
    await Showtime.deleteMany({
      _id: {
        $in: [stNowShowing._id, stCleaning._id, stLockedUpcoming._id, stNoSeatDocsUpcoming._id],
      },
    });

    // FV02: Kiểm tra giao dịch khác tháng (Khách đặt vé ngày 29/11 cho suất chiếu 02/12) & hoàn tiền khác tháng
    const stDec1 = await Showtime.create({
      movieId: m4._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: makeVietnamDate(2026, 12, 2, 19, 30, 0),
      endTime: makeVietnamDate(2026, 12, 2, 22, 30, 0),
      lifecycleStatus: 'UPCOMING',
      price: 150000,
    });
    const stDec2 = await Showtime.create({
      movieId: m5._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: makeVietnamDate(2026, 12, 5, 19, 30, 0),
      endTime: makeVietnamDate(2026, 12, 5, 22, 19, 0),
      lifecycleStatus: 'UPCOMING',
      price: 150000,
    });
    const stDec3 = await Showtime.create({
      movieId: m6._id,
      cinemaId: cinema._id,
      roomId: roomImax._id,
      roomName: roomImax.name,
      startTime: makeVietnamDate(2026, 12, 10, 19, 30, 0),
      endTime: makeVietnamDate(2026, 12, 10, 22, 42, 0),
      lifecycleStatus: 'UPCOMING',
      price: 150000,
    });
    await ShowtimeSeat.insertMany([
      ...build88Seats(stDec1._id, roomImax._id),
      ...build88Seats(stDec2._id, roomImax._id),
      ...build88Seats(stDec3._id, roomImax._id),
    ]);

    // Đơn đặt ngày 29/11/2026 cho suất chiếu ngày 02/12/2026 (2 ghế VIP = 300.000đ)
    const crossMonthBooking = await Booking.create({
      bookingCode: 'MTX-CROSS-NOV-DEC-01',
      movieId: m4._id,
      roomId: roomImax._id,
      showtimeId: stDec1._id,
      customerName: 'Khách Đặt Trước T12',
      customerPhone: '0905888999',
      seats: 'F1, F2',
      totalAmount: 300000,
      status: 'PAID',
      paymentStatus: 'VERIFIED',
      paymentMethod: 'MOMO',
      createdAt: makeVietnamDate(2026, 11, 29, 15, 0, 0),
    });
    await ShowtimeSeat.updateMany(
      { showtimeId: stDec1._id, seatNumber: { $in: ['F1', 'F2'] } },
      { $set: { status: 'BOOKED', bookingId: crossMonthBooking._id } }
    );

    const novStatsCross = await statisticsService.getOverviewStats({
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });
    const decStatsCross = await statisticsService.getOverviewStats({
      timeRange: 'by_month',
      month: 12,
      year: 2026,
    });
    const yearStatsCross = await statisticsService.getOverviewStats({
      timeRange: 'this_year',
      year: 2026,
    });
    const m4DetailNov = await statisticsService.getMovieDetailStats(m4._id, {
      timeRange: 'by_month',
      month: 11,
      year: 2026,
    });
    const m4DetailDec = await statisticsService.getMovieDetailStats(m4._id, {
      timeRange: 'by_month',
      month: 12,
      year: 2026,
    });

    record(
      'FV02',
      'Giao dịch đặt ngày 29/11 cho suất chiếu 02/12: Doanh thu 300.000đ ghi nhận ở Tháng 11 (theo createdAt), công suất 2 ghế đã đặt ghi nhận ở Tháng 12 (theo startTime), báo cáo cả năm không trùng không mất',
      novStatsCross.kpis.netRevenue.value === 900000 && // 600k (05/11) + 300k (29/11)
        novStatsCross.kpis.validTicketsSold.value === 6 && // 4 vé + 2 vé giao dịch trong T11
        novStatsCross.occupancy.booked === 4 && // Chỉ 4 ghế thuộc các suất chiếu diễn ra trong T11
        decStatsCross.kpis.netRevenue.value === 0 && // Không trùng doanh thu sang T12
        decStatsCross.occupancy.booked === 2 && // 2 ghế thuộc suất chiếu 02/12 được tính đúng vào công suất T12
        yearStatsCross.kpis.netRevenue.value === 900000 && // Tổng cả năm = 900k (không trùng, không mất)
        yearStatsCross.occupancy.booked === 6 && // Tổng ghế đã đặt cả năm = 4 + 2 = 6 ghế
        m4DetailNov.stats.totalRevenue === 300000 && // Drawer phim m4 ở T11 ghi nhận 300k doanh thu đặt trước
        m4DetailDec.stats.bookedSeats === 2, // Drawer phim m4 ở T12 ghi nhận 2 ghế đã đặt trên suất 02/12
      `Nov(rev=${novStatsCross.kpis.netRevenue.value}đ, txTickets=${novStatsCross.kpis.validTicketsSold.value}, showtimeSeats=${novStatsCross.occupancy.booked}) | Dec(rev=${decStatsCross.kpis.netRevenue.value}đ, showtimeSeats=${decStatsCross.occupancy.booked}) | Year(rev=${yearStatsCross.kpis.netRevenue.value}đ, showtimeSeats=${yearStatsCross.occupancy.booked})`
    );

    // FV03: Kiểm tra quy tắc 3 phim/tháng theo từng tháng đơn lẻ (T11 có 3 phim + T12 có 3 phim khác = Cả năm 6 phim -> HỢP LỆ, không cảnh báo)
    record(
      'FV03',
      'Quy tắc 3 phim/tháng kiểm tra theo từng tháng dương lịch: T11 (3 phim) + T12 (3 phim khác) -> Báo cáo Cả năm có 6 phim vẫn HỢP LỆ (schedulePolicyWarning === null); chỉ cảnh báo khi 1 tháng đơn lẻ > 3 phim',
      novStatsCross.schedulePolicyWarning === null &&
        decStatsCross.schedulePolicyWarning === null &&
        yearStatsCross.kpis.distinctMovies.value === 6 &&
        yearStatsCross.schedulePolicyWarning === null,
      `Year total movies=${yearStatsCross.kpis.distinctMovies.value}, schedulePolicyWarning=${yearStatsCross.schedulePolicyWarning}`
    );

    // FV04: Kiểm tra 3 công thức tỷ lệ lấp đầy phân biệt rõ mẫu số (Toàn kỳ vs Suất đã chiếu vs Suất sắp chiếu)
    // Tại Tháng 11:
    // - Tổng ghế toàn kỳ: 3 suất × 88 = 264 ghế, đã đặt 4 ghế -> overallOccupancyRate = 4 / 264 = 1.52%
    // - Suất đã chiếu (stPast): 88 ghế, đã đặt 4 ghế -> completedOccupancyRate = 4 / 88 = 4.55%
    // - Suất sắp chiếu (stFuture + stM3): 176 ghế, đã đặt 0 ghế -> upcomingOccupancyRate = 0%
    // Tại Tháng 12:
    // - Suất sắp chiếu (3 suất): 264 ghế, đã đặt 2 ghế -> upcomingOccupancyRate = 2 / 264 = 0.76%, completedOccupancyRate = 0%
    record(
      'FV04',
      'Phân biệt chính xác 3 công thức tỷ lệ theo đúng mẫu số: Tỷ lệ bán vé toàn kỳ (1.52%), Tỷ lệ lấp đầy suất đã chiếu (4.55%) và Tỷ lệ đặt trước suất sắp chiếu (T11: 0%, T12: 0.76%)',
      novStatsCross.occupancy.overallOccupancyRate === 1.52 &&
        novStatsCross.occupancy.completedOccupancyRate === 4.55 &&
        novStatsCross.occupancy.upcomingOccupancyRate === 0 &&
        decStatsCross.occupancy.overallOccupancyRate === 0.76 &&
        decStatsCross.occupancy.completedOccupancyRate === 0 &&
        decStatsCross.occupancy.upcomingOccupancyRate === 0.76,
      `Nov(overall=${novStatsCross.occupancy.overallOccupancyRate}%, completed=${novStatsCross.occupancy.completedOccupancyRate}%, upcoming=${novStatsCross.occupancy.upcomingOccupancyRate}%) | Dec(overall=${decStatsCross.occupancy.overallOccupancyRate}%, upcoming=${decStatsCross.occupancy.upcomingOccupancyRate}%)`
    );
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
  }

  console.log(`\n🎉 TẤT CẢ ${results.length} NHÓM KIỂM THỬ CHẤP NHẬN & FINAL VALIDATION ĐỀU ĐẠT 100%!`);
}

runTests().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
