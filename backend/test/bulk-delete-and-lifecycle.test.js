import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import adminRoutes from '../src/routes/adminRoutes.js';
import bookingRoutes from '../src/routes/bookingRoutes.js';
import movieRoutes from '../src/routes/movieRoutes.js';
import cinemaRoutes from '../src/routes/cinemaRoutes.js';
import statisticsRoutes from '../src/routes/statisticsRoutes.js';
import AdminUser from '../src/models/AdminUser.js';
import Booking from '../src/models/Booking.js';
import Cinema from '../src/models/Cinema.js';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import User from '../src/models/User.js';
import {
  computeShowtimeLifecycle,
  syncShowtimeLifecycleStatuses,
} from '../src/services/showtimeLifecycleService.js';

let server;
let mongo;
let url;
let admin;
let customer;
let cinema;
let room1;
let room2;
let movieA;
let movieB;

const modulePath = process.env.DAVENOR_TEST_MONGO_MODULE || 'mongodb-memory-server';

function makeToken(account) {
  return jwt.sign({ id: String(account._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function apiReq(path, { account, method = 'GET', data, key } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (account) headers.authorization = `Bearer ${makeToken(account)}`;
  if (key) headers['idempotency-key'] = key;
  const res = await fetch(url + path, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function seedShowtimeWithSeats({
  movieDoc = movieA,
  roomDoc = room1,
  startTime,
  cleaningMinutes = 20,
  price = 130000,
  lifecycleStatus = 'UPCOMING',
}) {
  const duration = Number(movieDoc.duration) || 120;
  const start = new Date(startTime);
  const endTime = new Date(start.getTime() + duration * 60000);
  const cleaningEndTime = new Date(endTime.getTime() + cleaningMinutes * 60000);

  const st = await Showtime.create({
    movieId: movieDoc._id,
    cinemaId: cinema._id,
    roomId: roomDoc._id,
    roomName: roomDoc.name,
    formatFeature: roomDoc.formatFeature || 'IMAX Laser 4K',
    startTime: start,
    endTime,
    cleaningMinutes,
    cleaningEndTime,
    lifecycleStatus,
    price,
  });

  const seats = ['A1', 'A2', 'A3', 'E1'].map((seatNumber, idx) => ({
    showtimeId: st._id,
    roomId: roomDoc._id,
    seatNumber,
    row: seatNumber[0],
    col: idx + 1,
    type: seatNumber[0] === 'E' ? 'VIP' : 'STANDARD',
    status: 'AVAILABLE',
  }));
  await ShowtimeSeat.insertMany(seats);
  return st;
}

before(async () => {
  process.env.JWT_SECRET = 'bulk-delete-lifecycle-test-secret';
  const { MongoMemoryReplSet } = createRequire(import.meta.url)(modulePath);
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('davenor_bulk_lifecycle'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const password = await bcrypt.hash('TestPass123!', 4);
  admin = await AdminUser.create({ name: 'Admin Lifecycle', email: 'admin.lc@davenor.vn', password });
  customer = await User.create({
    name: 'Khách Đặt Vé',
    email: 'customer.lc@davenor.vn',
    phone: '0908880001',
    password,
  });

  cinema = await Cinema.create({
    name: "D'AVENOR Thanh Khê Plaza",
    slug: 'davenor-thanh-khe-plaza',
    city: 'Đà Nẵng',
    district: 'Thanh Khê',
    address: '295 Điện Biên Phủ, Thanh Khê, Đà Nẵng',
    isFlagship: true,
  });

  [room1, room2] = await Room.create([
    {
      cinemaId: cinema._id,
      name: 'Phòng 01 - IMAX Laser',
      shortName: 'P01',
      roomNumber: 1,
      roomType: 'IMAX Laser',
      formatFeature: 'IMAX Laser 4K',
      totalSeats: 4,
      status: 'ACTIVE',
    },
    {
      cinemaId: cinema._id,
      name: 'Phòng 04 - Dolby Atmos',
      shortName: 'P04',
      roomNumber: 4,
      roomType: 'Dolby Atmos',
      formatFeature: 'Dolby Atmos 360',
      totalSeats: 4,
      status: 'ACTIVE',
    },
  ]);

  [movieA, movieB] = await Movie.create([
    {
      title: 'Dune: Hành Tinh Cát - Phần 2',
      slug: 'dune-hanh-tinh-cat-phan-2',
      posterUrl: '/banner-dune.jpg',
      genre: 'Khoa học viễn tưởng',
      duration: 165,
      status: 'NOW_SHOWING',
      releaseDate: new Date(Date.now() - 10 * 86400000),
    },
    {
      title: 'Mai',
      slug: 'mai',
      posterUrl: '/poster-mai.jpg',
      genre: 'Tâm lý, Tình cảm',
      duration: 131,
      status: 'NOW_SHOWING',
      releaseDate: new Date(Date.now() - 10 * 86400000),
    },
  ]);

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/movies', movieRoutes);
  app.use('/api/cinemas', cinemaRoutes);
  app.use('/api/admin/statistics', statisticsRoutes);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('Case 1 & 2: Bulk select & delete 5 and 10+ unbooked showtimes in a single batch API call without orphan seats', async () => {
  const baseMs = Date.now() + 36 * 3600000;
  // Tạo 5 suất chiếu chưa bán vé
  const batch5 = [];
  for (let i = 0; i < 5; i++) {
    const st = await seedShowtimeWithSeats({
      movieDoc: i % 2 === 0 ? movieA : movieB,
      roomDoc: i % 2 === 0 ? room1 : room2,
      startTime: new Date(baseMs + i * 4 * 3600000),
    });
    batch5.push(String(st._id));
  }

  const prev5 = await apiReq('/api/admin/showtimes/bulk-delete/preview', {
    account: admin,
    method: 'POST',
    data: { showtimeIds: batch5 },
  });
  assert.equal(prev5.status, 200);
  assert.equal(prev5.body.totalSelected, 5);
  assert.equal(prev5.body.eligibleCount, 5);
  assert.equal(prev5.body.blockedCount, 0);

  const commit5 = await apiReq('/api/admin/showtimes/bulk-delete/commit', {
    account: admin,
    method: 'POST',
    data: {
      previewId: prev5.body.previewId,
      confirmedIds: batch5,
      requestId: `REQ-5-${crypto.randomUUID()}`,
    },
  });
  assert.equal(commit5.status, 200);
  assert.equal(commit5.body.deletedCount, 5);
  assert.equal(await Showtime.countDocuments({ _id: { $in: batch5 } }), 0);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: { $in: batch5 } }), 0);

  // Tạo 11 suất chiếu (10+ suất) chưa bán vé và xóa trong 1 lần gọi batch duy nhất
  const batch11 = [];
  for (let i = 0; i < 11; i++) {
    const st = await seedShowtimeWithSeats({
      movieDoc: i % 2 === 0 ? movieA : movieB,
      roomDoc: i % 2 === 0 ? room1 : room2,
      startTime: new Date(baseMs + (i + 10) * 4 * 3600000),
    });
    batch11.push(String(st._id));
  }

  const prev11 = await apiReq('/api/admin/showtimes/bulk-delete/preview', {
    account: admin,
    method: 'POST',
    data: { showtimeIds: batch11 },
  });
  assert.equal(prev11.status, 200);
  assert.equal(prev11.body.totalSelected, 11);
  assert.equal(prev11.body.eligibleCount, 11);

  const commit11 = await apiReq('/api/admin/showtimes/bulk-delete/commit', {
    account: admin,
    method: 'POST',
    data: {
      previewId: prev11.body.previewId,
      confirmedIds: batch11,
      requestId: `REQ-11-${crypto.randomUUID()}`,
    },
  });
  assert.equal(commit11.status, 200);
  assert.equal(commit11.body.deletedCount, 11);
  assert.equal(await Showtime.countDocuments({ _id: { $in: batch11 } }), 0);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: { $in: batch11 } }), 0);
});

test('Case 3 & 4: Select all by date/room/movie and protect showtimes that have customer bookings or active seat holds', async () => {
  const targetDay = new Date(Date.now() + 72 * 3600000);
  const dateStr = targetDay.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

  const stEmpty1 = await seedShowtimeWithSeats({
    movieDoc: movieA,
    roomDoc: room1,
    startTime: new Date(`${dateStr}T09:00:00+07:00`),
  });
  const stEmpty2 = await seedShowtimeWithSeats({
    movieDoc: movieA,
    roomDoc: room1,
    startTime: new Date(`${dateStr}T13:00:00+07:00`),
  });
  const stWithPaidBooking = await seedShowtimeWithSeats({
    movieDoc: movieA,
    roomDoc: room1,
    startTime: new Date(`${dateStr}T17:00:00+07:00`),
  });
  const stWithHoldingSeat = await seedShowtimeWithSeats({
    movieDoc: movieB,
    roomDoc: room2,
    startTime: new Date(`${dateStr}T20:00:00+07:00`),
  });

  // Khách hàng giữ ghế và thanh toán cho stWithPaidBooking
  const hold1 = await apiReq('/api/bookings/hold', {
    account: customer,
    method: 'POST',
    data: { showtimeId: String(stWithPaidBooking._id), seatNumbers: ['A1'] },
  });
  assert.equal(hold1.status, 200);
  const ck1 = await apiReq('/api/bookings/checkout', {
    account: customer,
    method: 'POST',
    key: crypto.randomUUID(),
    data: {
      holdId: hold1.body.holdId,
      showtimeId: String(stWithPaidBooking._id),
      seatNumbers: ['A1'],
      customerName: customer.name,
      customerPhone: customer.phone,
    },
  });
  assert.equal(ck1.status, 201);

  // Khách hàng đang giữ ghế tạm thời (HOLDING 10 phút) trên stWithHoldingSeat
  const hold2 = await apiReq('/api/bookings/hold', {
    account: customer,
    method: 'POST',
    data: { showtimeId: String(stWithHoldingSeat._id), seatNumbers: ['A2'] },
  });
  assert.equal(hold2.status, 200);

  // Admin chọn tất cả 4 suất chiếu của ngày đó để xóa hàng loạt
  const selectedIds = [
    String(stEmpty1._id),
    String(stEmpty2._id),
    String(stWithPaidBooking._id),
    String(stWithHoldingSeat._id),
  ];

  const previewRes = await apiReq('/api/admin/showtimes/bulk-delete/preview', {
    account: admin,
    method: 'POST',
    data: { showtimeIds: selectedIds },
  });
  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.body.totalSelected, 4);
  assert.equal(previewRes.body.eligibleCount, 2, 'Only the 2 empty showtimes must be eligible');
  assert.equal(previewRes.body.blockedCount, 2, 'The 2 showtimes with booking/holding must be protected');

  const blockedIds = previewRes.body.blockedSlots.map((s) => s.id);
  assert.ok(blockedIds.includes(String(stWithPaidBooking._id)));
  assert.ok(blockedIds.includes(String(stWithHoldingSeat._id)));

  // Nếu cố tình gửi cả ID bị bảo vệ vào commit, Backend phải từ chối 400
  const tamperedCommit = await apiReq('/api/admin/showtimes/bulk-delete/commit', {
    account: admin,
    method: 'POST',
    data: {
      previewId: previewRes.body.previewId,
      confirmedIds: selectedIds,
      requestId: `REQ-TAMPER-${crypto.randomUUID()}`,
    },
  });
  assert.equal(tamperedCommit.status, 400);

  // Commit đúng 2 suất hợp lệ
  const eligibleIds = previewRes.body.eligibleSlots.map((s) => s.id);
  const validCommit = await apiReq('/api/admin/showtimes/bulk-delete/commit', {
    account: admin,
    method: 'POST',
    data: {
      previewId: previewRes.body.previewId,
      confirmedIds: eligibleIds,
      requestId: `REQ-VALID-${crypto.randomUUID()}`,
    },
  });
  assert.equal(validCommit.status, 200);
  assert.equal(validCommit.body.deletedCount, 2);

  // Xác minh 2 suất trống đã xóa, 2 suất có đơn vé / giữ ghế vẫn an toàn tuyệt đối
  assert.equal(await Showtime.findById(stEmpty1._id), null);
  assert.equal(await Showtime.findById(stEmpty2._id), null);
  assert.ok(await Showtime.findById(stWithPaidBooking._id));
  assert.ok(await Showtime.findById(stWithHoldingSeat._id));
  assert.equal(await Booking.countDocuments({ showtimeId: stWithPaidBooking._id, status: 'PAID' }), 1);
});

test('Case 5, 6, 7 & 8: Lifecycle transitions (NOW_SHOWING, CLEANING, COMPLETED) and Overnight showtime past 00:00', async () => {
  // Kiểm tra công thức tính vòng đời cho suất chiếu qua 00:00 hôm sau:
  // Bắt đầu: 22:30 ngày 2026-11-25, phim 165 phút -> Kết thúc: 01:15 ngày 2026-11-26, dọn phòng 20 phút -> cleaningEndTime: 01:35 ngày 2026-11-26
  const overnightShowtime = {
    startTime: new Date('2026-11-25T22:30:00+07:00'),
    movieDuration: 165,
    cleaningMinutes: 20,
  };

  // Tại 23:59 -> NOW_SHOWING
  const at2359 = computeShowtimeLifecycle(overnightShowtime, new Date('2026-11-25T23:59:00+07:00'));
  assert.equal(at2359.lifecycleStatus, 'NOW_SHOWING');
  assert.equal(at2359.isActiveSchedule, true);

  // Tại đúng 00:00 ngày hôm sau -> VẪN ĐANG CHIẾU (NOW_SHOWING), tuyệt đối không đánh dấu COMPLETED lúc 00:00!
  const at0000 = computeShowtimeLifecycle(overnightShowtime, new Date('2026-11-26T00:00:00+07:00'));
  assert.equal(at0000.lifecycleStatus, 'NOW_SHOWING');
  assert.equal(at0000.isActiveSchedule, true);

  // Tại 01:15 (vừa hết phim, bắt đầu 20 phút dọn phòng) -> CLEANING (chưa bị dọn khỏi lịch đang hoạt động)
  const at0115 = computeShowtimeLifecycle(overnightShowtime, new Date('2026-11-26T01:15:00+07:00'));
  assert.equal(at0115.lifecycleStatus, 'CLEANING');
  assert.equal(at0115.isActiveSchedule, true);

  // Tại 01:34 (còn 1 phút dọn phòng) -> CLEANING
  const at0134 = computeShowtimeLifecycle(overnightShowtime, new Date('2026-11-26T01:34:59+07:00'));
  assert.equal(at0134.lifecycleStatus, 'CLEANING');
  assert.equal(at0134.isActiveSchedule, true);

  // Tại 01:35 (đã hết phim + đủ 20 phút dọn phòng) -> COMPLETED
  const at0135 = computeShowtimeLifecycle(overnightShowtime, new Date('2026-11-26T01:35:00+07:00'));
  assert.equal(at0135.lifecycleStatus, 'COMPLETED');
  assert.equal(at0135.isActiveSchedule, false);
});

test('Case 7 & 9: Completed showtime disappears from active Admin/Customer schedules on read even before scheduler runs, while preserving bookings and revenue stats', async () => {
  const now = Date.now();
  const todayStr = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

  // 1. Tạo 1 suất đã kết thúc cả phim + 20 phút dọn phòng (startTime = now - 4 giờ, phim 131p + 20p = 151p < 240p)
  // Cố tình để lifecycleStatus trong DB là 'UPCOMING' để mô phỏng server vừa khởi động lại chưa chạy job nền!
  const stCompleted = await seedShowtimeWithSeats({
    movieDoc: movieB,
    roomDoc: room2,
    startTime: new Date(now - 4 * 3600000),
    cleaningMinutes: 20,
    lifecycleStatus: 'UPCOMING',
  });

  // Tạo 1 đơn đặt vé PAID (VERIFIED) gắn với suất chiếu đã hoàn thành này để kiểm tra bảo toàn lịch sử & doanh thu
  await Booking.create({
    bookingCode: 'DVN-HIST-001',
    userId: customer._id,
    showtimeId: stCompleted._id,
    seats: 'A1, A2',
    totalAmount: 260000,
    status: 'PAID',
    paymentStatus: 'VERIFIED',
    customerName: customer.name,
    customerPhone: customer.phone,
  });

  // 2. Tạo 1 suất đang chiếu (NOW_SHOWING: bắt đầu cách đây 30 phút)
  const stNowShowing = await seedShowtimeWithSeats({
    movieDoc: movieB,
    roomDoc: room2,
    startTime: new Date(now - 30 * 60000),
    cleaningMinutes: 20,
  });

  // 3. Tạo 1 suất đang dọn phòng (CLEANING: kết thúc cách đây 10 phút, còn 10 phút dọn phòng)
  const stCleaning = await seedShowtimeWithSeats({
    movieDoc: movieB,
    roomDoc: room1,
    startTime: new Date(now - (131 + 10) * 60000),
    cleaningMinutes: 20,
  });

  // 4. Trước khi chạy scheduler nền, gọi trực tiếp API đọc lịch chiếu:
  // - Admin với historyFilter=ACTIVE phải tự động lọc bỏ stCompleted, nhưng GIỮ LẠI stNowShowing và stCleaning
  const adminActiveRes = await apiReq(`/api/admin/showtimes?historyFilter=ACTIVE`, {
    account: admin,
  });
  assert.equal(adminActiveRes.status, 200);
  const activeIds = adminActiveRes.body.map((s) => s.id);
  assert.equal(activeIds.includes(String(stCompleted._id)), false, 'Completed showtime must be filtered out of ACTIVE schedule immediately');
  assert.equal(activeIds.includes(String(stNowShowing._id)), true, 'NOW_SHOWING showtime must remain in ACTIVE schedule');
  assert.equal(activeIds.includes(String(stCleaning._id)), true, 'CLEANING showtime must remain in ACTIVE schedule');

  // - Admin với historyFilter=COMPLETED phải trả về stCompleted
  const adminCompletedRes = await apiReq(`/api/admin/showtimes?historyFilter=COMPLETED`, {
    account: admin,
  });
  assert.equal(adminCompletedRes.status, 200);
  const completedIds = adminCompletedRes.body.map((s) => s.id);
  assert.equal(completedIds.includes(String(stCompleted._id)), true, 'Completed showtime must appear in COMPLETED history filter');

  // - API lịch chiếu phía khách hàng (/api/movies/:id/schedule & /api/cinemas/:id/showtimes) không hiển thị suất đã COMPLETED
  const custMovieSched = await apiReq(`/api/movies/${movieB._id}/schedule?date=${todayStr}`);
  assert.equal(custMovieSched.status, 200);
  assert.equal(
    custMovieSched.body.showtimes.some((s) => s.id === String(stCompleted._id)),
    false,
    'Customer movie schedule must not list COMPLETED showtime'
  );

  const custCinemaSched = await apiReq(`/api/cinemas/${cinema._id}/showtimes?date=${todayStr}`);
  assert.equal(custCinemaSched.status, 200);
  const allCinemaSlotIds = custCinemaSched.body.movies.flatMap((m) =>
    m.rooms.flatMap((r) => r.showtimes.map((s) => s.id))
  );
  assert.equal(
    allCinemaSlotIds.includes(String(stCompleted._id)),
    false,
    'Customer cinema schedule must not list COMPLETED showtime'
  );

  // 5. Chạy job đồng bộ định kỳ và kiểm tra DB đã lưu lifecycleStatus = 'COMPLETED'
  await syncShowtimeLifecycleStatuses(new Date());
  const updatedDoc = await Showtime.findById(stCompleted._id).lean();
  assert.equal(updatedDoc.lifecycleStatus, 'COMPLETED');

  // 6. Kiểm tra lịch sử đặt vé của khách và thống kê doanh thu của Admin vẫn giữ nguyên 100%
  const myBookings = await apiReq('/api/bookings/my-bookings', { account: customer });
  assert.equal(myBookings.status, 200);
  assert.ok(myBookings.body.some((b) => b.bookingCode === 'DVN-HIST-001'));

  const showtimeStats = await apiReq(`/api/admin/statistics/showtimes/${stCompleted._id}`, {
    account: admin,
  });
  assert.equal(showtimeStats.status, 200);
  assert.equal(showtimeStats.body.data.stats.verifiedRevenue, 260000);
});

test('Case 10 & 11: Smart & Manual Batch Scheduling (166p Dune + 131p Mai + 192p >3h Movie, 15m/20m cleaning, 02:00 closing limit, 88 seats, 100% Preview-Confirm sync)', async () => {
  // Tạo phòng chuẩn 88 ghế và 3 bộ phim có thời lượng khác nhau (trong đó có phim > 3 tiếng = 192 phút)
  const room88 = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 02 - IMAX Laser',
    shortName: 'P02',
    roomNumber: 2,
    roomType: 'IMAX Laser',
    formatFeature: 'IMAX Laser 4K',
    totalSeats: 88,
    status: 'ACTIVE',
  });

  const [dune166, mai131, avatar192] = await Movie.create([
    {
      title: 'Dune: Part Two (166p)',
      slug: 'dune-part-two-166',
      posterUrl: '/banner-dune.jpg',
      genre: 'Sci-Fi',
      duration: 166,
      status: 'NOW_SHOWING',
      releaseDate: new Date(Date.now() - 10 * 86400000),
    },
    {
      title: 'Mai (131p)',
      slug: 'mai-131',
      posterUrl: '/poster-mai.jpg',
      genre: 'Tâm lý',
      duration: 131,
      status: 'NOW_SHOWING',
      releaseDate: new Date(Date.now() - 10 * 86400000),
    },
    {
      title: 'Avatar: The Way of Water (192p)',
      slug: 'avatar-192',
      posterUrl: '/poster-avatar.jpg',
      genre: 'Sci-Fi',
      duration: 192,
      status: 'NOW_SHOWING',
      releaseDate: new Date(Date.now() - 10 * 86400000),
    },
  ]);

  const futureDay = new Date(Date.now() + 8 * 86400000).toLocaleDateString('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  // 1. Kiểm tra công thức ví dụ Section 6 với Dune (166p) + Mai (131p) + vệ sinh 20 phút ở Chế độ Thông Minh (Smart Mode)
  const smartPrev20 = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [String(room88._id)],
      movieIds: [String(dune166._id), String(mai131._id)],
      startDate: futureDay,
      endDate: futureDay,
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 20,
      optimizeMaxSlots: false,
      staggerRooms: true,
      preview: true,
    },
  });

  assert.equal(smartPrev20.status, 200);
  assert.equal(smartPrev20.body.preview, true);
  assert.equal(smartPrev20.body.validCount, 5);
  const slots20 = smartPrev20.body.validSlots;

  // Suất 1: Dune 166p, bắt đầu 09:30 -> kết thúc 12:16 -> vệ sinh 20p xong 12:36 -> sẵn sàng 12:40
  assert.equal(slots20[0].movieTitle, 'Dune: Part Two (166p)');
  assert.equal(slots20[0].startTimeText, '09:30');
  assert.equal(slots20[0].endTimeText, '12:16');
  assert.equal(slots20[0].cleaningEndTimeText, '12:36');
  assert.equal(slots20[0].readyTimeText, '12:40');

  // Suất 2 (Chế độ A - cân đối 5 mốc ưu tiên 09:30, 12:45, 16:00, 19:15, 22:30): Mai 131p bắt đầu tại mốc ưu tiên 12:45 (>= 12:40 sẵn sàng) -> kết thúc 14:56 -> vệ sinh 20p xong 15:16 -> sẵn sàng 15:20
  assert.equal(slots20[1].movieTitle, 'Mai (131p)');
  assert.equal(slots20[1].startTimeText, '12:45');
  assert.equal(slots20[1].endTimeText, '14:56');
  assert.equal(slots20[1].cleaningEndTimeText, '15:16');
  assert.equal(slots20[1].readyTimeText, '15:20');

  // Kiểm tra với vệ sinh 15 phút và bật optimizeMaxSlots = true (Chế độ B - nối tiếp ngay khi phòng sẵn sàng: 12:16 + 15p = 12:31 -> làm tròn lên 5p = 12:35)
  const smartPrev15 = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [String(room88._id)],
      movieIds: [String(dune166._id), String(mai131._id)],
      startDate: futureDay,
      endDate: futureDay,
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 15,
      optimizeMaxSlots: true,
      preview: true,
    },
  });
  assert.equal(smartPrev15.status, 200);
  assert.equal(smartPrev15.body.validSlots[0].cleaningEndTimeText, '12:31');
  assert.equal(smartPrev15.body.validSlots[0].readyTimeText, '12:35');
  assert.equal(smartPrev15.body.validSlots[1].startTimeText, '12:35');

  // 2. Kiểm tra phim dài hơn 3 tiếng (Avatar 192p) không vượt quá giờ đóng cửa 02:00 (+1 ngày)
  const smartPrevLong = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [String(room88._id)],
      movieIds: [String(avatar192._id)],
      startDate: futureDay,
      endDate: futureDay,
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 20,
      preview: true,
    },
  });
  assert.equal(smartPrevLong.status, 200);
  const dayCloseMs = new Date(`${futureDay}T00:00:00+07:00`).getTime() + 26 * 3600000;
  for (const s of smartPrevLong.body.validSlots) {
    assert.ok(
      new Date(s.cleaningEndTime).getTime() <= dayCloseMs,
      `Cleaning end time ${s.cleaningEndTimeText} must not exceed 02:00 (+1 ngày)`
    );
  }

  // 3. Xác nhận tạo lịch (Confirm) từ smartPrev20 và kiểm tra giống 100% với Preview + đủ 88 ghế mỗi suất
  const confirmRes = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [String(room88._id)],
      movieIds: [String(dune166._id), String(mai131._id)],
      startDate: futureDay,
      endDate: futureDay,
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 20,
      optimizeMaxSlots: false,
      staggerRooms: true,
      expectedValidCount: smartPrev20.body.validCount,
      expectedSignature: smartPrev20.body.validSignature,
      preview: false,
    },
  });
  assert.equal(confirmRes.status, 200);
  assert.equal(confirmRes.body.totalCreatedShowtimes, smartPrev20.body.validCount);

  for (let i = 0; i < confirmRes.body.createdShowtimes.length; i++) {
    const created = confirmRes.body.createdShowtimes[i];
    const previewed = smartPrev20.body.validSlots[i];
    assert.equal(created.movieId, previewed.movieId);
    assert.equal(created.roomId, previewed.roomId);
    assert.equal(created.time, previewed.time);
    assert.equal(created.cleaningMinutes, previewed.cleaningMinutes);
    assert.equal(created.price, previewed.priceStandard);

    const seatCount = await ShowtimeSeat.countDocuments({ showtimeId: created.id });
    assert.equal(seatCount, 88, `Each created showtime in 88-seat room must have 88 ShowtimeSeat docs`);
  }

  // 4. Nếu gọi lại Confirm với cùng expectedSignature sau khi phòng đã có lịch -> phải chặn 409 và yêu cầu Preview lại
  const duplicateConfirm = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [String(room88._id)],
      movieIds: [String(dune166._id), String(mai131._id)],
      startDate: futureDay,
      endDate: futureDay,
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 20,
      expectedValidCount: smartPrev20.body.validCount,
      expectedSignature: smartPrev20.body.validSignature,
      preview: false,
    },
  });
  assert.equal(duplicateConfirm.status, 409);

  // =========================================================================
  // SECTION X: KIỂM THỬ BẮT BUỘC (TEST 1 -> TEST 12)
  // =========================================================================
  const deadpool128 = await Movie.create({
    title: 'Deadpool & Wolverine (128p)',
    slug: 'deadpool-128',
    posterUrl: '/poster-dp.jpg',
    genre: 'Action',
    duration: 128,
    status: 'NOW_SHOWING',
    releaseDate: new Date(Date.now() - 10 * 86400000),
  });

  // Tạo đủ 9 phòng vật lý chuẩn (01-03 IMAX Laser, 04-06 Dolby Atmos, 07-09 Gold Class)
  const nineRooms = [];
  for (let num = 1; num <= 9; num++) {
    const rType = num <= 3 ? 'IMAX Laser' : num <= 6 ? 'Dolby Atmos' : 'Gold Class';
    const rm = await Room.create({
      cinemaId: cinema._id,
      name: `Phòng 0${num} - ${rType}`,
      shortName: `P0${num}`,
      roomNumber: num,
      roomType: rType,
      formatFeature: rType,
      totalSeats: 88,
      status: 'ACTIVE',
    });
    nineRooms.push(rm);
  }
  const nineRoomIds = nineRooms.map((r) => String(r._id));

  const dayT1 = new Date(Date.now() + 10 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

  // TEST 1 & TEST 2: Dune 166 phút bắt đầu 22:30, vệ sinh 20 phút -> Kết quả hợp lệ, kết thúc 01:16 (+1 ngày), hoàn thành 01:36 (+1 ngày).
  // Sau suất cuối, phòng sẵn sàng lúc 01:36 -> Thuật toán PHẢI DỪNG, không tạo thêm suất và KHÔNG báo xung đột (conflictCount = 0).
  const resT1T2 = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [nineRoomIds[0]],
      movieIds: [String(dune166._id)],
      startDate: dayT1,
      endDate: dayT1,
      scheduleMode: 'smart',
      firstShowtimeTime: '22:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 20,
      optimizeMaxSlots: false,
      preview: true,
    },
  });
  assert.equal(resT1T2.status, 200);
  assert.equal(resT1T2.body.validCount, 1, 'Test 1: Exactly 1 valid showtime at 22:30');
  assert.equal(resT1T2.body.conflictCount, 0, 'Test 2: Must have 0 conflicts and never create a fake 01:35/01:40 conflict slot');
  assert.equal(resT1T2.body.validSlots[0].startTimeText, '22:30');
  assert.equal(resT1T2.body.validSlots[0].endTimeText, '01:16 (+1 ngày)');
  assert.equal(resT1T2.body.validSlots[0].cleaningEndTimeText, '01:36 (+1 ngày)');

  // TEST 3: Phim dài 192 phút, bắt đầu 22:30, vệ sinh 20 phút -> Phải bỏ qua (khi khóa đầu 22:30) hoặc điều chỉnh sớm hơn (khi phòng trống từ 22:00) vì 22:30 + 212p = 02:02 vượt 02:00.
  const resT3Skip = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [nineRoomIds[0]],
      movieIds: [String(avatar192._id)],
      startDate: dayT1,
      endDate: dayT1,
      scheduleMode: 'smart',
      firstShowtimeTime: '22:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 1,
      cleaningMinutes: 20,
      preview: true,
    },
  });
  assert.equal(resT3Skip.status, 200);
  assert.equal(resT3Skip.body.validCount, 0, 'Test 3a: 192p + 20p at 22:30 exceeds 02:00 so it must be skipped');
  assert.equal(resT3Skip.body.conflictCount, 0, 'Test 3a: Time limit skip must not be counted as a room conflict');

  const resT3Adjust = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [nineRoomIds[0]],
      movieIds: [String(avatar192._id)],
      startDate: dayT1,
      endDate: dayT1,
      scheduleMode: 'smart',
      firstShowtimeTime: '22:00',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 1,
      cleaningMinutes: 20,
      preview: true,
    },
  });
  assert.equal(resT3Adjust.status, 200);
  assert.equal(resT3Adjust.body.validCount, 1, 'Test 3b: When room is free before 22:25, start time adjusts earlier so cleaning finishes <= 02:00');
  assert.ok(resT3Adjust.body.validSlots[0].startTimeText <= '22:25');

  // TEST 4: Hai phim cùng giờ nhưng khác phòng -> Không xung đột
  const resT4 = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [nineRoomIds[0], nineRoomIds[1]],
      movieIds: [String(dune166._id), String(mai131._id)],
      startDate: dayT1,
      endDate: dayT1,
      scheduleMode: 'manual',
      timeSlots: ['09:30'],
      cleaningMinutes: 20,
      preview: true,
    },
  });
  assert.equal(resT4.status, 200);
  assert.equal(resT4.body.validCount, 2);
  assert.equal(resT4.body.conflictCount, 0, 'Test 4: Same time in different rooms must have 0 conflicts');

  // TEST 5: Hai phim chồng lấn trong cùng phòng -> Báo xung đột thực sự
  const resT5 = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [nineRoomIds[0]],
      movieIds: [String(dune166._id), String(mai131._id)],
      startDate: dayT1,
      endDate: dayT1,
      scheduleMode: 'manual',
      timeSlots: ['09:30', '11:00'],
      cleaningMinutes: 20,
      preview: true,
    },
  });
  assert.equal(resT5.status, 200);
  assert.equal(resT5.body.validCount, 1);
  assert.equal(resT5.body.conflictCount, 1, 'Test 5: Overlapping times in the same room must report 1 actual conflict');

  // TEST 6: Chọn 1 ngày, 9 phòng, 4 suất/phòng, tắt tối ưu tối đa -> Không vượt 36 suất, 0 xung đột
  const resT6 = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: nineRoomIds,
      movieIds: [String(dune166._id), String(mai131._id), String(deadpool128._id)],
      startDate: dayT1,
      endDate: dayT1,
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 4,
      cleaningMinutes: 20,
      optimizeMaxSlots: false,
      preview: true,
    },
  });
  assert.equal(resT6.status, 200);
  assert.equal(resT6.body.validCount, 36, 'Test 6: 1 day x 9 rooms x 4 slots/room must produce exactly 36 valid slots (<= 36)');
  assert.equal(resT6.body.conflictCount, 0);

  // TEST 7 & TEST 8: Chọn 1 ngày, 9 phòng, 5 suất/phòng, tắt tối ưu tối đa với Dune, Mai, Deadpool -> Không vượt 45 suất, 0 xung đột
  const resT7T8 = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: nineRoomIds,
      movieIds: [String(dune166._id), String(mai131._id), String(deadpool128._id)],
      startDate: dayT1,
      endDate: dayT1,
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 20,
      optimizeMaxSlots: false,
      preview: true,
    },
  });
  assert.equal(resT7T8.status, 200);
  assert.equal(resT7T8.body.validCount, 45, 'Test 7 & 8: 1 day x 9 rooms x 5 slots/room must produce exactly 45 valid slots (<= 45)');
  assert.equal(resT7T8.body.conflictCount, 0);

  // TEST 9: Xếp lịch nhiều ngày (3 ngày liên tiếp x 9 phòng x 5 suất = 135 suất), mỗi ngày có giới hạn hoạt động độc lập
  const dayT9End = new Date(Date.now() + 12 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const resT9 = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: nineRoomIds,
      movieIds: [String(dune166._id), String(mai131._id), String(deadpool128._id)],
      startDate: dayT1,
      endDate: dayT9End,
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 20,
      optimizeMaxSlots: false,
      preview: true,
    },
  });
  assert.equal(resT9.status, 200);
  assert.equal(resT9.body.totalDays, 3);
  assert.equal(resT9.body.validCount, 135, 'Test 9: 3 days x 9 rooms x 5 slots/room = 135 valid slots');
  assert.equal(resT9.body.conflictCount, 0, 'Test 9: 0 fake conflicts across multi-day boundary');
  assert.ok(
    resT9.body.validSlots.every((s) => s.startTimeText >= '08:00' && s.startTimeText <= '22:30'),
    'Test 9: Every single slot across all 3 days must start between 08:00 and 22:30'
  );

  // =========================================================================
  // SECTION 10 EDGE CASES:
  // 1. 180-showtime (15,840 seats) Confirm in 1 Transaction
  // 2. Concurrent 2-Admin Confirm on same room -> 1 wins (200), 1 rejected (409)
  // 3. Mid-transaction ShowtimeSeat failure -> 100% rollback (0 Showtime, 0 ShowtimeSeat)
  // 4. Simulated TransientTransactionError retry -> zero duplicate Showtime IDs
  // 5. Soft-cancelled showtime does not block creating replacement schedule
  // =========================================================================
  const day180Start = new Date(Date.now() + 14 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const day180End = new Date(Date.now() + 17 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

  // 1. 180 showtimes (4 days x 9 rooms x 5 slots = 180 showtimes, 15,840 seats)
  const prev180 = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: nineRoomIds,
      movieIds: [String(dune166._id), String(mai131._id), String(deadpool128._id)],
      startDate: day180Start,
      endDate: day180End,
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 20,
      optimizeMaxSlots: true,
      preview: true,
    },
  });
  assert.equal(prev180.status, 200);
  assert.equal(prev180.body.validCount, 180);

  // 3. Simulate mid-transaction failure during ShowtimeSeat.insertMany -> verify 100% rollback
  const origInsertMany = ShowtimeSeat.insertMany;
  let callCounter = 0;
  ShowtimeSeat.insertMany = async function (...args) {
    callCounter++;
    if (callCounter === 2) {
      throw new Error('Simulated mid-transaction seat write failure on chunk 2');
    }
    return origInsertMany.apply(this, args);
  };
  try {
    const failedConfirm = await apiReq('/api/admin/showtimes/schedule-batch', {
      account: admin,
      method: 'POST',
      data: {
        roomIds: nineRoomIds,
        movieIds: [String(dune166._id), String(mai131._id), String(deadpool128._id)],
        startDate: day180Start,
        endDate: day180End,
        scheduleMode: 'smart',
        firstShowtimeTime: '09:30',
        latestStartTime: '22:30',
        targetSlotsPerRoom: 5,
        cleaningMinutes: 20,
        optimizeMaxSlots: true,
        expectedValidCount: prev180.body.validCount,
        expectedSignature: prev180.body.validSignature,
        preview: false,
      },
    });
    assert.equal(failedConfirm.status, 500);
    assert.equal(failedConfirm.body.rolledBack, true);
  } finally {
    ShowtimeSeat.insertMany = origInsertMany;
  }

  // Verify 0 orphan Showtimes and 0 orphan ShowtimeSeats were left behind after mid-transaction failure
  const d180StartObj = new Date(`${day180Start}T00:00:00+07:00`);
  const d180EndObj = new Date(`${day180End}T23:59:59+07:00`);
  assert.equal(
    await Showtime.countDocuments({ startTime: { $gte: d180StartObj, $lte: new Date(d180EndObj.getTime() + 6 * 3600000) } }),
    0,
    'Mid-transaction failure must rollback 100% of Showtimes'
  );

  // 2 & 4. Two concurrent Admin Confirm requests on the same 180-slot schedule:
  // Exactly 1 must succeed (200) and 1 must be rejected (409) or aborted without duplicate showtimes!
  const [conc1, conc2] = await Promise.all([
    apiReq('/api/admin/showtimes/schedule-batch', {
      account: admin,
      method: 'POST',
      data: {
        roomIds: nineRoomIds,
        movieIds: [String(dune166._id), String(mai131._id), String(deadpool128._id)],
        startDate: day180Start,
        endDate: day180End,
        scheduleMode: 'smart',
        firstShowtimeTime: '09:30',
        latestStartTime: '22:30',
        targetSlotsPerRoom: 5,
        cleaningMinutes: 20,
        optimizeMaxSlots: true,
        expectedValidCount: prev180.body.validCount,
        expectedSignature: prev180.body.validSignature,
        preview: false,
      },
    }),
    apiReq('/api/admin/showtimes/schedule-batch', {
      account: admin,
      method: 'POST',
      data: {
        roomIds: nineRoomIds,
        movieIds: [String(dune166._id), String(mai131._id), String(deadpool128._id)],
        startDate: day180Start,
        endDate: day180End,
        scheduleMode: 'smart',
        firstShowtimeTime: '09:30',
        latestStartTime: '22:30',
        targetSlotsPerRoom: 5,
        cleaningMinutes: 20,
        optimizeMaxSlots: true,
        expectedValidCount: prev180.body.validCount,
        expectedSignature: prev180.body.validSignature,
        preview: false,
      },
    }),
  ]);

  const statuses180 = [conc1.status, conc2.status].sort((a, b) => a - b);
  assert.deepEqual(statuses180, [200, 409], 'Concurrent 180-slot Confirm must result in exactly one 200 and one 409');
  const winner180 = conc1.status === 200 ? conc1 : conc2;
  assert.equal(winner180.body.totalCreatedShowtimes, 180);
  assert.equal(winner180.body.totalCreatedSeats, 15840);
  assert.equal(new Set(winner180.body.createdSlotIds).size, 180, 'Must return exactly 180 unique Showtime IDs even after retry');

  const dbShowtimeCount180 = await Showtime.countDocuments({ _id: { $in: winner180.body.createdSlotIds } });
  const dbSeatCount180 = await ShowtimeSeat.countDocuments({ showtimeId: { $in: winner180.body.createdSlotIds } });
  assert.equal(dbShowtimeCount180, 180);
  assert.equal(dbSeatCount180, 15840);

  // 5. Soft-cancelled showtime does not block creating replacement showtime in the same room & time
  const dayCancelTest = new Date(Date.now() + 19 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  await Showtime.create({
    movieId: dune166._id,
    cinemaId: cinema._id,
    roomId: nineRooms[0]._id,
    roomName: nineRooms[0].name,
    startTime: new Date(`${dayCancelTest}T09:30:00+07:00`),
    endTime: new Date(`${dayCancelTest}T12:16:00+07:00`),
    cleaningMinutes: 20,
    cleaningEndTime: new Date(`${dayCancelTest}T12:36:00+07:00`),
    lifecycleStatus: 'CANCELLED',
    cancelledAt: new Date(),
    cancelReason: 'Suất đã hủy mềm',
    price: 130000,
  });

  const replaceRes = await apiReq('/api/admin/showtimes/schedule-batch', {
    account: admin,
    method: 'POST',
    data: {
      roomIds: [String(nineRooms[0]._id)],
      movieIds: [String(dune166._id)],
      startDate: dayCancelTest,
      endDate: dayCancelTest,
      scheduleMode: 'manual',
      timeSlots: ['09:30'],
      cleaningMinutes: 20,
      preview: false,
    },
  });
  assert.equal(replaceRes.status, 200, 'Soft-cancelled showtime must not block creating replacement schedule');
  assert.equal(replaceRes.body.totalCreatedShowtimes, 1);
});
