import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import adminRoutes from '../src/routes/adminRoutes.js';
import bookingRoutes from '../src/routes/bookingRoutes.js';
import movieRoutes from '../src/routes/movieRoutes.js';
import cinemaRoutes from '../src/routes/cinemaRoutes.js';
import showtimeRoutes from '../src/routes/showtimeRoutes.js';
import statisticsRoutes from '../src/routes/statisticsRoutes.js';
import AdminUser from '../src/models/AdminUser.js';
import Booking from '../src/models/Booking.js';
import Cinema from '../src/models/Cinema.js';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import TicketPricingConfig from '../src/models/TicketPricingConfig.js';
import User from '../src/models/User.js';
import { SEAT_GRID_CONFIG } from '../src/utils/roomLayoutConfig.js';

let server;
let mongo;
let url;
let admin;
let customer;
let cinema;
let roomImax;
let roomAtmos;
let roomGold;
let roomMaintenance;
let movieActive;
let movieEnded;

const modulePath = process.env.DAVENOR_TEST_MONGO_MODULE || 'mongodb-memory-server';

function makeToken(account) {
  return jwt.sign({ id: String(account._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function apiReq(path, { account, method = 'GET', data } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (account) headers.authorization = `Bearer ${makeToken(account)}`;
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

before(async () => {
  process.env.JWT_SECRET = 'recurring-showtimes-test-secret';
  const { MongoMemoryReplSet } = createRequire(import.meta.url)(modulePath);
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('davenor_recurring_showtimes_test'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const password = await bcrypt.hash('TestPass123!', 4);
  admin = await AdminUser.create({
    name: 'Admin Recurring',
    email: 'admin.recurring@davenor.vn',
    password,
  });
  customer = await User.create({
    name: 'Khách Recurring',
    email: 'customer.recurring@davenor.vn',
    phone: '0909998887',
    password,
  });

  cinema = await Cinema.create({
    name: "D'AVENOR CINEMA - ĐÀ NẴNG FLAGSHIP",
    slug: 'davenor-da-nang-flagship',
    city: 'Đà Nẵng',
    address: 'Tầng 5 Lotte Mart Đà Nẵng',
    isFlagship: true,
  });

  roomImax = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 01 — IMAX Laser',
    shortName: 'P01',
    roomNumber: 1,
    roomType: 'IMAX Laser',
    formatFeature: '2D IMAX Laser',
    totalSeats: 88,
    status: 'ACTIVE',
  });

  roomAtmos = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 04 — Dolby Atmos',
    shortName: 'P04',
    roomNumber: 4,
    roomType: 'Dolby Atmos',
    formatFeature: '2D Dolby Atmos',
    totalSeats: 88,
    status: 'ACTIVE',
  });

  roomGold = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 07 — Gold Class',
    shortName: 'P07',
    roomNumber: 7,
    roomType: 'Gold Class',
    formatFeature: '2D Gold Class VIP Lounge',
    totalSeats: 88,
    status: 'ACTIVE',
  });

  roomMaintenance = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 02 — IMAX Laser',
    shortName: 'P02',
    roomNumber: 2,
    roomType: 'IMAX Laser',
    formatFeature: '2D IMAX Laser',
    totalSeats: 88,
    status: 'MAINTENANCE',
  });

  movieActive = await Movie.create({
    title: 'Dune: Hành Tinh Cát – Phần 2',
    slug: 'dune-hanh-tinh-cat-phan-2',
    posterUrl: 'https://example.com/dune.jpg',
    description: 'Bom tấn khoa học viễn tưởng',
    duration: 120,
    genre: 'Khoa học viễn tưởng',
    ageRating: 'T13',
    releaseDate: new Date('2026-11-01T00:00:00+07:00'),
    status: 'NOW_SHOWING',
    price: 90000,
  });

  movieEnded = await Movie.create({
    title: 'Phim Đã Ngừng Chiếu',
    slug: 'phim-da-ngung-chieu',
    posterUrl: 'https://example.com/ended.jpg',
    description: 'Phim đã kết thúc',
    duration: 110,
    genre: 'Hành động',
    ageRating: 'T16',
    releaseDate: new Date('2026-10-01T00:00:00+07:00'),
    status: 'ENDED',
    price: 85000,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/movies', movieRoutes);
  app.use('/api/cinemas', cinemaRoutes);
  app.use('/api/showtimes', showtimeRoutes);
  app.use('/api/admin/statistics', statisticsRoutes);

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  url = `http://127.0.0.1:${addr.port}`;
});

beforeEach(async () => {
  await Showtime.deleteMany({});
  await ShowtimeSeat.deleteMany({});
  await Booking.deleteMany({});
});

after(async () => {
  if (server) {
    server.close();
    await once(server, 'close');
  }
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

// 1. Tạo 1 suất lẻ như hiện tại vẫn hoạt động bình thường
test('01. Tạo 1 suất lẻ qua POST /api/admin/showtimes vẫn hoạt động bình thường và đủ 88 ghế', async () => {
  const res = await apiReq('/api/admin/showtimes', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startTime: '2026-12-10T18:00',
      formatFeature: '3D IMAX Laser',
    },
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.showtime);
  assert.equal(res.body.showtime.formatFeature, '3D IMAX Laser');
  const seatCount = await ShowtimeSeat.countDocuments({ showtimeId: res.body.showtime._id });
  assert.equal(seatCount, 88);
});

// 2. Lặp lịch cả tuần (7 ngày × 2 khung giờ = 14 suất)
test('02. Lặp lịch cả tuần (7 ngày × 2 khung giờ = 14 suất) tạo đủ 14 suất chiếu', async () => {
  // 2026-12-07 (Mon) -> 2026-12-13 (Sun) = 7 days
  const res = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-07',
      endDate: '2026-12-13',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      timeSlots: ['10:00', '19:00'],
      formatFeature: '2D IMAX Laser',
      skipConflicts: false,
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.createdCount, 14);
  assert.equal(res.body.totalSeatsCreated, 14 * 88);
  const countInDb = await Showtime.countDocuments({ roomId: roomImax._id });
  assert.equal(countInDb, 14);
});

// 3. Lặp lịch ngày thường T2–T6
test('03. Lặp lịch ngày thường T2–T6 chỉ tạo suất từ Thứ 2 đến Thứ 6', async () => {
  const res = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomAtmos._id),
      startDate: '2026-12-07',
      endDate: '2026-12-13',
      daysOfWeek: [1, 2, 3, 4, 5],
      timeSlots: ['14:00', '18:00'],
      skipConflicts: false,
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.createdCount, 10); // 5 weekdays * 2 slots
  for (const st of res.body.createdShowtimes) {
    const dow = new Date(st.startTime).getUTCDay();
    assert.ok(dow >= 1 && dow <= 5);
  }
});

// 4. Lặp lịch cuối tuần T7–CN
test('04. Lặp lịch cuối tuần T7–CN chỉ tạo suất Thứ 7 và Chủ Nhật', async () => {
  const res = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomGold._id),
      startDate: '2026-12-07',
      endDate: '2026-12-13',
      daysOfWeek: [6, 0],
      timeSlots: ['09:30', '15:30', '20:30'],
      skipConflicts: false,
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.createdCount, 6); // 2 weekend days * 3 slots
});

// 5. Lặp lịch các thứ tùy chọn (T2, T4, T6)
test('05. Lặp lịch các thứ tùy chọn (T2, T4, T6)', async () => {
  const res = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-07',
      endDate: '2026-12-13',
      daysOfWeek: [1, 3, 5],
      timeSlots: ['19:30'],
      skipConflicts: false,
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.createdCount, 3);
});

// 6. Lặp lịch qua ranh giới tháng (28/12/2026 → 03/01/2027)
test('06. Lặp lịch qua ranh giới tháng và năm (28/12/2026 -> 03/01/2027)', async () => {
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-28',
      endDate: '2027-01-03',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      timeSlots: ['18:00'],
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.selectedDaysCount, 7);
  assert.equal(preview.body.validCount, 7);
  const dates = preview.body.validSlots.map((s) => s.date);
  assert.deepEqual(dates, [
    '2026-12-28',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
    '2027-01-03',
  ]);
});

// 7. Lặp lịch nhưng không có ngày nào khớp thứ đã chọn
test('07. Lặp lịch nhưng không có ngày nào khớp thứ đã chọn trả về 0 suất hợp lệ', async () => {
  // 2026-12-07 is Monday (1), 2026-12-08 is Tuesday (2). Choosing Sunday (0) matches 0 days
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-07',
      endDate: '2026-12-08',
      daysOfWeek: [0],
      timeSlots: ['19:00'],
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.selectedDaysCount, 0);
  assert.equal(preview.body.totalExpected, 0);
  assert.equal(preview.body.validCount, 0);
});

// 8. Lặp lịch có trùng giờ trong cùng yêu cầu (ví dụ 18:00 và 19:00 cho phim 120 phút)
test('08. Lặp lịch có trùng giờ trong cùng yêu cầu (18:00 và 19:00 cho phim 120 phút)', async () => {
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      daysOfWeek: [4], // Thursday
      timeSlots: ['18:00', '19:00'],
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.validCount, 1);
  assert.equal(preview.body.conflictCount, 1);
  assert.equal(preview.body.validSlots[0].time, '18:00');
  assert.equal(preview.body.conflictSlots[0].time, '19:00');
  assert.match(preview.body.conflictSlots[0].conflictReason, /cùng yêu cầu/);
});

// 9. Lặp lịch trùng với suất đã có trong DB cùng phòng
test('09. Lặp lịch trùng với suất đã có trong DB cùng phòng', async () => {
  await apiReq('/api/admin/showtimes', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startTime: '2026-12-10T18:00',
    },
  });

  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-11',
      daysOfWeek: [4, 5],
      timeSlots: ['19:00'],
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.validCount, 1); // 2026-12-11 19:00 is valid
  assert.equal(preview.body.conflictCount, 1); // 2026-12-10 19:00 conflicts with 18:00
});

// 10. Lặp lịch thiếu 20 phút dọn phòng
test('10. Lặp lịch thiếu 20 phút dọn phòng bị báo xung đột chính xác', async () => {
  // Existing showtime 18:00 -> 20:00 (120m) + 20m cleaning = blocked until 20:20
  await apiReq('/api/admin/showtimes', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startTime: '2026-12-10T18:00',
      cleaningMinutes: 20,
    },
  });

  // Candidate at 20:10 lacks 10 minutes of cleaning time; candidate at 20:20 is valid
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      daysOfWeek: [4],
      timeSlots: ['20:10', '20:20'],
      cleaningMinutes: 20,
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.conflictCount, 1);
  assert.equal(preview.body.conflictSlots[0].time, '20:10');
  assert.equal(preview.body.validCount, 1);
  assert.equal(preview.body.validSlots[0].time, '20:20');
});

// 11. Lặp lịch vượt giờ đóng cửa 02:00 sáng hôm sau
test('11. Lặp lịch vượt giờ đóng cửa 02:00 sáng hôm sau bị từ chối trong Preview', async () => {
  // Movie is 120 mins + 20 mins cleaning = 140 mins (2h20m).
  // Starting at 23:50 ends cleaning at 02:10 (+1 day) > 02:00 -> conflict!
  // Also start > 23:30 is outside operating start window.
  // Let's test 23:45 and also a 200-min movie starting at 23:00 (23:00 + 200m + 20m = 02:40 > 02:00)
  const longMovie = await Movie.create({
    title: 'Long Epic Movie',
    slug: 'long-epic-movie-' + Date.now(),
    posterUrl: 'https://example.com/long.jpg',
    description: 'Phim sử thi 200 phút',
    duration: 200,
    genre: 'Sử thi',
    ageRating: 'T13',
    releaseDate: new Date('2026-11-01T00:00:00+07:00'),
    status: 'NOW_SHOWING',
  });

  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(longMovie._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      daysOfWeek: [4],
      timeSlots: ['23:00'],
      cleaningMinutes: 20,
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.validCount, 0);
  assert.equal(preview.body.conflictCount, 1);
  assert.match(preview.body.conflictSlots[0].conflictReason, /02:00/);
});

// 12. Lặp lịch có suất chiếu qua nửa đêm 00:00–02:00 của ngày trước
test('12. Lặp lịch phát hiện đúng va chạm với suất chiếu qua nửa đêm 00:00–02:00 của ngày trước', async () => {
  // Existing showtime on 2026-12-09 at 22:30 (120m + 20m cleaning -> ends 00:50 on 2026-12-10)
  await Showtime.create({
    movieId: movieActive._id,
    cinemaId: cinema._id,
    roomId: roomImax._id,
    roomName: roomImax.name,
    formatFeature: roomImax.formatFeature,
    startTime: new Date('2026-12-09T22:30:00+07:00'),
    endTime: new Date('2026-12-10T00:30:00+07:00'),
    cleaningMinutes: 20,
    cleaningEndTime: new Date('2026-12-10T00:50:00+07:00'),
    lifecycleStatus: 'UPCOMING',
    price: 90000,
  });

  // Preview starting 2026-12-10 at 08:30 should not conflict, and lookback query loads 2026-12-09 overnight showtime without error
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      daysOfWeek: [4],
      timeSlots: ['08:30'],
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.validCount, 1);
});

// 13. Lặp lịch trước ngày khởi chiếu phim
test('13. Lặp lịch trước ngày khởi chiếu phim bị gắn cờ xung đột chính xác', async () => {
  const futureMovie = await Movie.create({
    title: 'Avatar 3',
    slug: 'avatar-3-' + Date.now(),
    posterUrl: 'https://example.com/avatar3.jpg',
    description: 'Bom tấn sắp chiếu',
    duration: 150,
    genre: 'Viễn tưởng',
    ageRating: 'T13',
    releaseDate: new Date('2026-12-15T00:00:00+07:00'),
    status: 'COMING_SOON',
  });

  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(futureMovie._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-14',
      endDate: '2026-12-15',
      daysOfWeek: [1, 2],
      timeSlots: ['18:00'],
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.conflictCount, 1);
  assert.equal(preview.body.conflictSlots[0].date, '2026-12-14');
  assert.match(preview.body.conflictSlots[0].conflictReason, /khởi chiếu/);
  assert.equal(preview.body.validCount, 1);
  assert.equal(preview.body.validSlots[0].date, '2026-12-15');
});

// 14. Lặp lịch cho phòng đang MAINTENANCE
test('14. Lặp lịch cho phòng đang MAINTENANCE bị từ chối HTTP 400', async () => {
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomMaintenance._id),
      startDate: '2026-12-10',
      endDate: '2026-12-12',
      daysOfWeek: [4, 5, 6],
      timeSlots: ['18:00'],
    },
  });
  assert.equal(preview.status, 400);
  assert.match(preview.body.message, /bảo trì|MAINTENANCE/i);
});

// 15. Lặp lịch cho phim ENDED
test('15. Lặp lịch cho phim ENDED bị từ chối HTTP 400', async () => {
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieEnded._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-12',
      daysOfWeek: [4, 5, 6],
      timeSlots: ['18:00'],
    },
  });
  assert.equal(preview.status, 400);
  assert.match(preview.body.message, /ngừng chiếu|ENDED/i);
});

// 16. Preview không ghi dữ liệu vào DB
test('16. Preview là 100% READ-ONLY: không tạo Showtime, ShowtimeSeat hoặc TicketPricingConfig trong DB', async () => {
  await TicketPricingConfig.deleteMany({});
  const beforeShowtimes = await Showtime.countDocuments({});
  const beforeSeats = await ShowtimeSeat.countDocuments({});
  const beforePricing = await TicketPricingConfig.countDocuments({});

  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-07',
      endDate: '2026-12-13',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      timeSlots: ['10:00', '18:00'],
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.validCount, 14);

  const afterShowtimes = await Showtime.countDocuments({});
  const afterSeats = await ShowtimeSeat.countDocuments({});
  const afterPricing = await TicketPricingConfig.countDocuments({});
  assert.equal(afterShowtimes, beforeShowtimes);
  assert.equal(afterSeats, beforeSeats);
  assert.equal(afterPricing, beforePricing);
});

// 17. Commit với skipConflicts = false khi có 1 suất trùng -> không tạo suất nào
test('17. Commit với skipConflicts = false khi có 1 suất trùng -> rollback 100%, không tạo suất nào', async () => {
  // Existing showtime on 2026-12-10 at 18:00
  await apiReq('/api/admin/showtimes', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startTime: '2026-12-10T18:00',
    },
  });

  const commitRes = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-09',
      endDate: '2026-12-11',
      daysOfWeek: [3, 4, 5], // Wed, Thu, Fri
      timeSlots: ['18:00'],
      skipConflicts: false,
    },
  });

  assert.equal(commitRes.status, 409);
  assert.equal(commitRes.body.rolledBack, true);
  assert.equal(commitRes.body.createdCount, 0);
  assert.equal(commitRes.body.conflicts.length, 1);

  // Only the 1 pre-existing showtime remains in DB
  const totalInDb = await Showtime.countDocuments({ roomId: roomImax._id });
  assert.equal(totalInDb, 1);
});

// 18. Commit với skipConflicts = true khi có 1 suất trùng -> tạo các suất hợp lệ, bỏ qua đúng 1 suất trùng
test('18. Commit với skipConflicts = true khi có 1 suất trùng -> tạo các suất hợp lệ, bỏ qua đúng 1 suất trùng', async () => {
  await apiReq('/api/admin/showtimes', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startTime: '2026-12-10T18:00',
    },
  });

  const commitRes = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-09',
      endDate: '2026-12-11',
      daysOfWeek: [3, 4, 5], // 3 days
      timeSlots: ['18:00'],
      skipConflicts: true,
    },
  });

  assert.equal(commitRes.status, 201);
  assert.equal(commitRes.body.createdCount, 2); // Dec 09 and Dec 11 created
  assert.equal(commitRes.body.skippedCount, 1); // Dec 10 skipped
  assert.equal(commitRes.body.skipped[0].date, '2026-12-10');

  const totalInDb = await Showtime.countDocuments({ roomId: roomImax._id });
  assert.equal(totalInDb, 3); // 1 existing + 2 newly created
});

// 19. Mỗi suất được tạo có đúng 88 ghế ShowtimeSeat với trạng thái AVAILABLE
test('19. Mỗi suất được tạo có đúng 88 ghế ShowtimeSeat chuẩn sơ đồ A–G (12 ghế) + H (4 ghế), tất cả AVAILABLE', async () => {
  const commitRes = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-12',
      daysOfWeek: [4, 5, 6],
      timeSlots: ['18:00'],
      skipConflicts: false,
    },
  });
  assert.equal(commitRes.status, 201);
  assert.equal(commitRes.body.createdCount, 3);

  for (const st of commitRes.body.createdShowtimes) {
    const seats = await ShowtimeSeat.find({ showtimeId: st.id }).lean();
    assert.equal(seats.length, 88);
    assert.ok(seats.every((s) => s.status === 'AVAILABLE' && !s.bookingId && !s.holdId));
    const rowH = seats.filter((s) => s.row === 'H');
    assert.equal(rowH.length, 4);
    for (const r of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      assert.equal(seats.filter((s) => s.row === r).length, 12);
    }
  }
});

// 20. Không có bất kỳ Showtime nào thiếu ghế nếu tạo ghế gặp lỗi
test('20. Không có bất kỳ Showtime nào thiếu ghế (orphan showtime) nếu quá trình insertMany ghế gặp lỗi', async () => {
  const origInsertMany = ShowtimeSeat.insertMany;
  ShowtimeSeat.insertMany = async () => {
    throw new Error('Simulated seat insertion failure');
  };
  try {
    const res = await apiReq('/api/admin/showtimes/recurring/commit', {
      account: admin,
      method: 'POST',
      data: {
        movieId: String(movieActive._id),
        roomId: String(roomImax._id),
        startDate: '2026-12-10',
        endDate: '2026-12-11',
        daysOfWeek: [4, 5],
        timeSlots: ['18:00'],
        skipConflicts: false,
      },
    });
    assert.equal(res.status, 500);
    const orphanCount = await Showtime.countDocuments({ roomId: roomImax._id });
    assert.equal(orphanCount, 0);
  } finally {
    ShowtimeSeat.insertMany = origInsertMany;
  }
});

// 21. Khách hàng có thể tải sơ đồ ghế và giữ ghế từ suất được tạo bằng lặp lịch
test('21. Khách hàng có thể tải sơ đồ 88 ghế và giữ ghế từ suất chiếu được tạo bằng lặp lịch (trong cửa sổ 7 ngày)', async () => {
  // Schedule a showtime 2 days from now so it is within the 7-day booking window
  const twoDaysAhead = new Date(Date.now() + 2 * 86400000);
  const dateStr = twoDaysAhead.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const dow = new Date(`${dateStr}T12:00:00+07:00`).getUTCDay();

  const commitRes = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: dateStr,
      endDate: dateStr,
      daysOfWeek: [dow],
      timeSlots: ['19:30'],
      skipConflicts: false,
    },
  });
  assert.equal(commitRes.status, 201);
  const showtimeId = commitRes.body.createdShowtimes[0].id;

  // Load seat map
  const seatsRes = await apiReq(`/api/showtimes/${showtimeId}/seats`);
  assert.equal(seatsRes.status, 200);
  const seatsArray = Array.isArray(seatsRes.body) ? seatsRes.body : seatsRes.body.seats;
  assert.equal(seatsArray.length, 88);

  // Hold seat E5
  const holdRes = await apiReq('/api/bookings/hold', {
    account: customer,
    method: 'POST',
    data: { showtimeId, seatNumbers: ['E5'] },
  });
  assert.equal(holdRes.status, 200);
  assert.deepEqual(holdRes.body.seatNumbers, ['E5']);
});

// 22. Lịch chiếu tháng kế tiếp hiển thị đúng trên API/trang khách hàng
test('22. Lịch chiếu tháng kế tiếp (khác tháng với releaseDate) hiển thị đầy đủ trên API khách hàng (/movies/:id/schedule & /cinemas/:id/showtimes?view=published)', async () => {
  // movieActive was released in 2026-11, schedule showtime in 2026-12
  const commitRes = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-05',
      endDate: '2026-12-05',
      daysOfWeek: [6], // Saturday
      timeSlots: ['19:30'],
      skipConflicts: false,
    },
  });
  assert.equal(commitRes.status, 201);

  const movieSched = await apiReq(`/api/movies/${movieActive._id}/schedule?date=2026-12-05`);
  assert.equal(movieSched.status, 200);
  assert.equal(movieSched.body.showtimes.length, 1);
  assert.equal(movieSched.body.showtimes[0].availableSeats, 88);

  const cinemaSched = await apiReq(`/api/cinemas/${cinema._id}/showtimes?view=published&date=2026-12-05`);
  assert.equal(cinemaSched.status, 200);
  assert.equal(cinemaSched.body.movies.length, 1);
  assert.equal(cinemaSched.body.movies[0].title, movieActive.title);
});

// 23. Hai yêu cầu Commit đồng thời cho cùng phòng và khung giờ không tạo trùng suất chiếu
test('23. Hai yêu cầu Commit đồng thời (concurrency) cho cùng phòng và khung giờ không bao giờ tạo trùng suất chiếu', async () => {
  const payload = {
    movieId: String(movieActive._id),
    roomId: String(roomImax._id),
    startDate: '2026-12-15',
    endDate: '2026-12-16',
    daysOfWeek: [2, 3],
    timeSlots: ['18:00'],
    skipConflicts: false,
  };

  const [r1, r2] = await Promise.all([
    apiReq('/api/admin/showtimes/recurring/commit', { account: admin, method: 'POST', data: payload }),
    apiReq('/api/admin/showtimes/recurring/commit', { account: admin, method: 'POST', data: payload }),
  ]);

  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [201, 409]);

  const countInDb = await Showtime.countDocuments({ roomId: roomImax._id });
  assert.equal(countInDb, 2);
});

// 24. Gửi lặp lại cùng một yêu cầu Commit khi double-click hoặc retry không tạo nhân đôi suất chiếu
test('24. Idempotency: Gửi lặp lại cùng một requestId khi double-click hoặc retry bị chặn 409 và không tạo nhân đôi suất chiếu', async () => {
  const requestId = 'REQ-IDEMPOTENT-' + crypto.randomUUID();
  const payload = {
    movieId: String(movieActive._id),
    roomId: String(roomAtmos._id),
    startDate: '2026-12-18',
    endDate: '2026-12-18',
    daysOfWeek: [5],
    timeSlots: ['19:00'],
    skipConflicts: true,
    requestId,
  };

  const first = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: payload,
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.createdCount, 1);

  const duplicate = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: payload,
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.duplicateRequest, true);

  const countInDb = await Showtime.countDocuments({ roomId: roomAtmos._id });
  assert.equal(countInDb, 1);
});

// 25. Khung giờ hoặc thứ bị trùng lặp trong cùng payload được loại trùng chính xác
test('25. Khung giờ hoặc thứ bị trùng lặp trong cùng payload được loại trùng chính xác', async () => {
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      daysOfWeek: [4, 4, 4],
      timeSlots: ['09:30', '09:30', '18:00', '18:00'],
    },
  });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.body.daysOfWeek, [4]);
  assert.deepEqual(preview.body.timeSlots, ['09:30', '18:00']);
  assert.equal(preview.body.totalExpected, 2);
  assert.equal(preview.body.validCount, 2);
});

// 26. Lịch phòng thay đổi sau bước Preview được phát hiện lại tại bước Commit
test('26. Lịch phòng thay đổi sau bước Preview được phát hiện lại tại bước Commit (stale preview protection)', async () => {
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-20',
      endDate: '2026-12-21',
      daysOfWeek: [0, 1],
      timeSlots: ['18:00'],
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.validCount, 2);

  // Another Admin inserts a conflicting showtime on 2026-12-20 18:00 after Preview
  await apiReq('/api/admin/showtimes', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startTime: '2026-12-20T18:00',
    },
  });

  // 26a. Commit with skipConflicts = false rejects with 409 and creates 0 new showtimes
  const strictCommit = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      confirmedSlots: preview.body.validSlots,
      previewSignature: preview.body.previewSignature,
      skipConflicts: false,
    },
  });
  assert.equal(strictCommit.status, 409);
  assert.equal(strictCommit.body.requiresRePreview, true);
  assert.equal(await Showtime.countDocuments({ roomId: roomImax._id }), 1);

  // 26b. Commit with skipConflicts = true skips the newly conflicting slot and creates the remaining 1 valid slot
  const skipCommit = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      confirmedSlots: preview.body.validSlots,
      previewSignature: preview.body.previewSignature,
      skipConflicts: true,
    },
  });
  assert.equal(skipCommit.status, 201);
  assert.equal(skipCommit.body.createdCount, 1);
  assert.equal(skipCommit.body.skippedCount, 1);
  assert.equal(skipCommit.body.skipped[0].date, '2026-12-20');
});

// 27. Vượt giới hạn khoảng ngày hoặc số lượng suất dự kiến bị từ chối đúng quy định
test('27. Vượt giới hạn 30 ngày hoặc 180 suất dự kiến bị từ chối HTTP 400', async () => {
  // 31 days range -> rejected
  const overRange = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-01',
      endDate: '2026-12-31', // 31 days
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      timeSlots: ['18:00'],
    },
  });
  assert.equal(overRange.status, 400);
  assert.match(overRange.body.message, /30 ngày/);

  // 30 days * 7 slots = 210 > 180 expected showtimes -> rejected
  const overSlots = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-01',
      endDate: '2026-12-30', // 30 days
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      timeSlots: ['08:30', '10:30', '12:30', '14:30', '16:30', '18:30', '20:30'],
    },
  });
  assert.equal(overSlots.status, 400);
  assert.match(overSlots.body.message, /180 suất/);
});

// 28. Định dạng chiếu formatFeature được kiểm tra tương thích với phòng và lưu đúng vào Showtime
test('28. Định dạng chiếu formatFeature không tương thích phòng bị từ chối 400, tương thích được lưu đúng vào Showtime', async () => {
  // Incompatible: 3D IMAX Laser in Gold Class room
  const badFmt = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomGold._id),
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      daysOfWeek: [4],
      timeSlots: ['18:00'],
      formatFeature: '3D IMAX Laser',
    },
  });
  assert.equal(badFmt.status, 400);
  assert.match(badFmt.body.message, /không tương thích/i);

  // Compatible: 3D Dolby Atmos in Dolby Atmos room
  const goodCommit = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomAtmos._id),
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      daysOfWeek: [4],
      timeSlots: ['18:00'],
      formatFeature: '3D Dolby Atmos',
      skipConflicts: false,
    },
  });
  assert.equal(goodCommit.status, 201);
  const createdDoc = await Showtime.findById(goodCommit.body.createdShowtimes[0].id).lean();
  assert.equal(createdDoc.formatFeature, '3D Dolby Atmos');
});

// 29. Ngày và giờ tạo suất chiếu nhất quán khi môi trường chạy ở TZ=UTC và TZ=Asia/Ho_Chi_Minh
test('29. Múi giờ nhất quán: startTime lưu chính xác theo giờ Việt Nam (+07:00) bất kể TZ=UTC hay Asia/Ho_Chi_Minh', async () => {
  const prevTz = process.env.TZ;
  try {
    process.env.TZ = 'UTC';
    const previewUtc = await apiReq('/api/admin/showtimes/recurring/preview', {
      account: admin,
      method: 'POST',
      data: {
        movieId: String(movieActive._id),
        roomId: String(roomImax._id),
        startDate: '2026-12-10',
        endDate: '2026-12-10',
        daysOfWeek: [4],
        timeSlots: ['19:30'],
      },
    });
    assert.equal(previewUtc.status, 200);
    // 2026-12-10T19:30:00+07:00 is 2026-12-10T12:30:00.000Z in UTC
    assert.equal(previewUtc.body.validSlots[0].startTime, '2026-12-10T12:30:00.000Z');

    process.env.TZ = 'Asia/Ho_Chi_Minh';
    const previewVn = await apiReq('/api/admin/showtimes/recurring/preview', {
      account: admin,
      method: 'POST',
      data: {
        movieId: String(movieActive._id),
        roomId: String(roomImax._id),
        startDate: '2026-12-10',
        endDate: '2026-12-10',
        daysOfWeek: [4],
        timeSlots: ['19:30'],
      },
    });
    assert.equal(previewVn.status, 200);
    assert.equal(previewVn.body.validSlots[0].startTime, '2026-12-10T12:30:00.000Z');
  } finally {
    if (prevTz === undefined) delete process.env.TZ;
    else process.env.TZ = prevTz;
  }
});

// 30. REC-01: Đối chiếu 1-1 toàn bộ 88 ghế (seatNumber, row, col, type, status) giữa suất tạo đơn lẻ và suất tạo lặp trên tất cả loại phòng
test('30. REC-01: So sánh 1-1 từng ghế (seatNumber, row, col, type, status) giữa suất tạo đơn lẻ và suất tạo lặp', async () => {
  const singleRes = await apiReq('/api/admin/showtimes', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startTime: '2026-12-10T10:00',
    },
  });
  assert.equal(singleRes.status, 201);

  const recurringRes = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-11',
      endDate: '2026-12-11',
      daysOfWeek: [5],
      timeSlots: ['10:00'],
      skipConflicts: false,
    },
  });
  assert.equal(recurringRes.status, 201);

  const singleSeats = await ShowtimeSeat.find({ showtimeId: singleRes.body.showtime._id })
    .sort({ row: 1, col: 1 })
    .lean();
  const recurringSeats = await ShowtimeSeat.find({ showtimeId: recurringRes.body.createdShowtimes[0].id })
    .sort({ row: 1, col: 1 })
    .lean();

  assert.equal(singleSeats.length, 88);
  assert.equal(recurringSeats.length, 88);

  const mapSeatSpec = (s) => ({
    seatNumber: s.seatNumber,
    row: s.row,
    col: s.col,
    type: s.type,
    status: s.status,
    hasBooking: Boolean(s.bookingId),
    hasHold: Boolean(s.holdId || s.holdOwnerId || s.holdExpiresAt),
  });

  assert.deepEqual(recurringSeats.map(mapSeatSpec), singleSeats.map(mapSeatSpec));
});

// 31. REC-03: Phân quyền API preview và commit (401 khi không đăng nhập, 403 khi đăng nhập tài khoản CUSTOMER)
test('31. REC-03: Phân quyền API preview và commit trả về 401 khi không đăng nhập và 403 khi dùng tài khoản CUSTOMER', async () => {
  const payload = {
    movieId: String(movieActive._id),
    roomId: String(roomImax._id),
    startDate: '2026-12-10',
    endDate: '2026-12-10',
    daysOfWeek: [4],
    timeSlots: ['18:00'],
  };

  const unauthPreview = await apiReq('/api/admin/showtimes/recurring/preview', { method: 'POST', data: payload });
  assert.equal(unauthPreview.status, 401);

  const unauthCommit = await apiReq('/api/admin/showtimes/recurring/commit', { method: 'POST', data: payload });
  assert.equal(unauthCommit.status, 401);

  const customerPreview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: customer,
    method: 'POST',
    data: payload,
  });
  assert.equal(customerPreview.status, 403);

  const customerCommit = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: customer,
    method: 'POST',
    data: payload,
  });
  assert.equal(customerCommit.status, 403);
});

// 32. REC-04 & REC-05: Đồng bộ quy tắc giờ mở suất cuối 22:30 và vệ sinh 15–20 phút giữa Lặp lịch, Xếp lịch hàng loạt và Available-Slots
test('32. REC-04 & REC-05: Đồng bộ quy tắc giờ mở suất 08:00–22:30 và kết thúc vệ sinh <= 02:00 (+1 ngày)', async () => {
  // Recurring showtime at 23:00 (> 22:30) is flagged as CONFLICT in Preview
  const lateRecurring = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      daysOfWeek: [4],
      timeSlots: ['23:00'],
    },
  });
  assert.equal(lateRecurring.status, 200);
  assert.equal(lateRecurring.body.conflictCount, 1);
  assert.match(lateRecurring.body.conflictSlots[0].conflictReason, /22:30/);

  // Available slots never suggest a slot > 22:30
  const availRes = await apiReq(
    `/api/admin/showtimes/available-slots?roomId=${roomImax._id}&movieId=${movieActive._id}&date=2026-12-10`,
    { account: admin }
  );
  assert.equal(availRes.status, 200);
  assert.ok(availRes.body.availableSlots.includes('08:00'));
  assert.ok(availRes.body.availableSlots.includes('22:30'));
  assert.ok(!availRes.body.availableSlots.some((t) => t > '22:30'));
});

// 33. REC-06: Chống giả mạo previewSignature, chống chèn suất ngoài Preview và bỏ qua giá vé giả mạo khi pricingMode=auto
test('33. REC-06: Chặn giả mạo previewSignature, chặn chèn confirmedSlots ngoài Preview và không tin giá vé client tự gửi khi pricingMode=auto', async () => {
  const preview = await apiReq('/api/admin/showtimes/recurring/preview', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomImax._id),
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      daysOfWeek: [4],
      timeSlots: ['18:00'],
      pricingMode: 'auto',
    },
  });
  assert.equal(preview.status, 200);
  const validSlot = preview.body.validSlots[0];
  const expectedAutoPrice = validSlot.price;

  // 33a. Tampered signature -> 400
  const tamperedSigRes = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      confirmedSlots: [validSlot],
      previewSignature: preview.body.previewSignature + 'TAMPERED',
      skipConflicts: true,
    },
  });
  assert.equal(tamperedSigRes.status, 400);

  // 33b. Injecting an unapproved slot not in previewSignature -> 400
  const injectedSlot = {
    ...validSlot,
    startTime: new Date('2026-12-10T20:30:00+07:00').toISOString(),
  };
  const injectedRes = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      confirmedSlots: [validSlot, injectedSlot],
      previewSignature: preview.body.previewSignature,
      skipConflicts: true,
    },
  });
  assert.equal(injectedRes.status, 400);

  // 33c. Client tampers price to 1 VND in auto pricing mode -> backend recalculates true matrix price
  const tamperedPriceSlot = { ...validSlot, price: 1 };
  const autoPriceCommit = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      confirmedSlots: [tamperedPriceSlot],
      previewSignature: preview.body.previewSignature,
      pricingMode: 'auto',
      skipConflicts: true,
    },
  });
  assert.equal(autoPriceCommit.status, 201);
  assert.equal(autoPriceCommit.body.createdShowtimes[0].price, expectedAutoPrice);
});

// 34. REC-06: Idempotency bền vững trong MongoDB và từ chối khi tái sử dụng requestId với payload khác
test('34. REC-06: Idempotency bền vững trong MongoDB và từ chối 409 với payloadMismatch=true khi dùng lại requestId cho payload khác', async () => {
  const reqId = 'REQ-PERSIST-' + crypto.randomUUID();
  const firstCommit = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomAtmos._id),
      startDate: '2026-12-12',
      endDate: '2026-12-12',
      daysOfWeek: [6],
      timeSlots: ['14:00'],
      requestId: reqId,
      skipConflicts: false,
    },
  });
  assert.equal(firstCommit.status, 201);

  // Verify requestId and requestFingerprint are persisted on Showtime document in MongoDB
  const savedDoc = await Showtime.findById(firstCommit.body.createdShowtimes[0].id).lean();
  assert.equal(savedDoc.requestId, reqId);
  assert.ok(savedDoc.requestFingerprint);

  // Reuse same requestId with DIFFERENT payload (timeSlots: ['18:00']) -> rejected with 409 and payloadMismatch = true
  const mismatchCommit = await apiReq('/api/admin/showtimes/recurring/commit', {
    account: admin,
    method: 'POST',
    data: {
      movieId: String(movieActive._id),
      roomId: String(roomAtmos._id),
      startDate: '2026-12-12',
      endDate: '2026-12-12',
      daysOfWeek: [6],
      timeSlots: ['18:00'],
      requestId: reqId,
      skipConflicts: false,
    },
  });
  assert.equal(mismatchCommit.status, 409);
  assert.equal(mismatchCommit.body.duplicateRequest, true);
  assert.equal(mismatchCommit.body.payloadMismatch, true);
});
