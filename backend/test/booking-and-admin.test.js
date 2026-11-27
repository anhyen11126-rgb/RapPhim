import assert from 'node:assert/strict';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bookingRoutes from '../src/routes/bookingRoutes.js';
import adminRoutes from '../src/routes/adminRoutes.js';
import authRoutes from '../src/routes/authRoutes.js';
import movieRoutes from '../src/routes/movieRoutes.js';
import AdminUser from '../src/models/AdminUser.js';
import Booking from '../src/models/Booking.js';
import Cinema from '../src/models/Cinema.js';
import Concession from '../src/models/Concession.js';
import Movie from '../src/models/Movie.js';
import Promotion from '../src/models/Promotion.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import User from '../src/models/User.js';
import { opensMoreThanSevenDaysAhead } from '../src/services/bookingPolicy.js';

let server;
let mongo;
let url;
let movie;
let cinema;
let room;
let combo;
let first;
let second;
let admin;
const modulePath = process.env.DAVENOR_TEST_MONGO_MODULE || 'mongodb-memory-server';
const skip = false;

test('seven days are counted on the Vietnam calendar across midnight and New Year', () => {
  const jan7 = new Date('2027-01-07T23:30:00+07:00');
  assert.equal(opensMoreThanSevenDaysAhead(jan7, new Date('2026-12-31T23:59:59+07:00')), false);
  assert.equal(opensMoreThanSevenDaysAhead(jan7, new Date('2026-12-30T23:59:59+07:00')), true);
});

before(async () => {
  process.env.JWT_SECRET = 'isolated-node-test-secret';
  let MongoMemoryReplSet;
  try {
    ({ MongoMemoryReplSet } = createRequire(import.meta.url)(modulePath));
  } catch (error) {
    throw new Error(
      `Không thể nạp "${modulePath}" để chạy bộ test tích hợp cô lập (MongoMemoryReplSet). ` +
      `Hãy chạy "npm install" trong thư mục backend hoặc cấu hình DAVENOR_TEST_MONGO_MODULE. Chi tiết: ${error.message}`
    );
  }
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('davenor_integration'));
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const password = await bcrypt.hash('isolated-test-password', 4);
  [first, second] = await User.create([
    { name: 'First customer', email: 'first@example.test', phone: '0900000001', password },
    { name: 'Second customer', email: 'second@example.test', phone: '0900000002', password },
  ]);
  admin = await AdminUser.create({ name: 'Admin', email: 'admin@example.test', password });
  cinema = await Cinema.create({ name: 'Isolated Cinema', address: 'Test' });
  room = await Room.create({ name: 'Isolated IMAX', cinemaId: cinema._id, totalSeats: 3 });
  movie = await Movie.create({ title: 'Isolated movie', posterUrl: '/test.jpg', genre: 'Test', duration: 100 });
  combo = await Concession.create({ name: 'Isolated combo', price: 40000 });
  await Promotion.create({ title: 'Isolated voucher', code: 'TEST20', type: 'VOUCHER', discountValue: '20K', expiryDate: '31/12/2099' });

  const app = express();
  app.use(express.json());
  app.use('/bookings', bookingRoutes);
  app.use('/auth', authRoutes);
  app.use('/admin', adminRoutes);
  app.use('/movies', movieRoutes);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

function token(account, options = { expiresIn: '1h' }) {
  return jwt.sign({ id: String(account._id) }, process.env.JWT_SECRET, options);
}

async function request(path, { account, auth, method = 'GET', data, key } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth || account) headers.authorization = 'Bearer ' + (auth || token(account));
  if (key) headers['idempotency-key'] = key;
  const response = await fetch(url + path, { method, headers, body: data && JSON.stringify(data) });
  const type = response.headers.get('content-type');
  return { status: response.status, data: type?.includes('json') ? await response.json() : await response.text() };
}

async function makeShowtime(hours) {
  const slot = await Showtime.create({
    movieId: movie._id, cinemaId: cinema._id, roomId: room._id, roomName: room.name,
    startTime: new Date(Date.now() + hours * 3600000), price: 130000,
  });
  await ShowtimeSeat.insertMany(['A1', 'A2', 'B1'].map((seatNumber, index) => ({
    showtimeId: slot._id, roomId: room._id, seatNumber, row: seatNumber[0],
    col: index === 1 ? 2 : 1, type: 'STANDARD', status: 'AVAILABLE',
  })));
  return slot;
}

async function checkout(slot, account, seatNumbers, overrides = {}, key) {
  const hold = await request('/bookings/hold', {
    account,
    method: 'POST',
    data: { showtimeId: String(slot._id), seatNumbers },
  });
  if (hold.status !== 200) return hold;
  return request('/bookings/checkout', {
    account, method: 'POST', key,
    data: {
      holdId: hold.data.holdId,
      showtimeId: String(slot._id),
      seatNumbers,
      customerName: account.name,
      customerPhone: account.phone,
      totalAmount: 1,
      ...overrides,
    },
  });
}

test('admin routes require a valid admin account and reject expired tokens', { skip }, async () => {
  const route = '/admin/bookings';
  assert.equal((await request(route)).status, 401);
  assert.equal((await request(route, { account: first })).status, 403);
  assert.equal((await request(route, { auth: token(admin, { expiresIn: -1 }) })).status, 401);
  assert.equal((await request(route, { account: admin })).status, 200);
});

test('tokens issued by the normal login route work for customer and admin APIs', { skip }, async () => {
  const login = account => request('/auth/login', {
    method: 'POST', data: { identifier: account.email, password: 'isolated-test-password' },
  });
  const customerLogin = await login(first);
  assert.equal(customerLogin.status, 200, JSON.stringify(customerLogin.data));
  assert.equal((await request('/bookings/my-bookings', { auth: customerLogin.data.token })).status, 200);
  const adminLogin = await login(admin);
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.data));
  assert.equal((await request('/admin/bookings', { auth: adminLogin.data.token })).status, 200);
  assert.equal((await request('/auth/avatar', { method: 'PUT', data: { avatar: '/test', userId: String(second._id) } })).status, 401);
});

test('selecting and holding a seat requires auth, sets HOLDING with 600s TTL without creating a booking', { skip }, async () => {
  const slot = await makeShowtime(40);
  assert.equal((await request('/bookings/hold', { method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } })).status, 401);
  const holdRes = await request('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } });
  assert.equal(holdRes.status, 200);
  assert.ok(holdRes.data.holdId);
  assert.equal(await Booking.countDocuments({ showtimeId: slot._id }), 0);
  const seatDoc = await ShowtimeSeat.findOne({ showtimeId: slot._id, seatNumber: 'A1' });
  assert.equal(seatDoc.status, 'HOLDING');
  assert.equal(String(seatDoc.holdOwnerId), String(first._id));
});

test('checkout recomputes prices, discounts, grants ownership and replays the request once', { skip }, async () => {
  const slot = await makeShowtime(41);
  const key = '32e102f0-0367-4848-a18f-6358deeaa112';
  const selections = { combos: [{ id: String(combo._id), quantity: 2 }], voucherCode: 'TEST20' };
  const created = await checkout(slot, first, ['A1', 'A2'], selections, key);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.booking.totalAmount, 320000);
  assert.equal(created.data.booking.paymentStatus, 'SIMULATED');
  const replay = await request('/bookings/checkout', {
    account: first,
    method: 'POST',
    key,
    data: {
      holdId: created.data.booking.holdId || 'REPLAY-HOLD',
      showtimeId: String(slot._id),
      seatNumbers: ['A1', 'A2'],
      customerName: first.name,
      customerPhone: first.phone,
      totalAmount: 1,
      ...selections,
    },
  });
  assert.equal(replay.data.booking.id, created.data.booking.id);
  assert.equal(await Booking.countDocuments({ showtimeId: slot._id }), 1);
  const owner = await request('/bookings/my-bookings', { account: first });
  assert.ok(owner.data.some(booking => booking.id === created.data.booking.id));
  const foreign = await request('/bookings/' + created.data.booking.bookingCode, { account: second });
  assert.equal(foreign.status, 404);
  assert.equal((await request('/bookings/' + created.data.booking.id + '/cancel', { account: second, method: 'POST' })).status, 404);
});

test('concurrent multi-seat claims commit at most one complete competing booking', { skip }, async () => {
  const slot = await makeShowtime(42);
  const results = await Promise.all([checkout(slot, first, ['A1', 'A2']), checkout(slot, second, ['A2', 'B1'])]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'BOOKED' }), 2);
  assert.equal(await Booking.countDocuments({ showtimeId: slot._id }), 1);
  const anotherSlot = await makeShowtime(43);
  assert.equal((await checkout(anotherSlot, second, ['A2'])).status, 201);
});

test('cancel releases owned seats and a cancelled QR cannot be checked in', { skip }, async () => {
  const slot = await makeShowtime(45);
  const { data } = await checkout(slot, first, ['A1']);
  const path = '/bookings/' + data.booking.id + '/cancel';
  const response = await request(path, { method: 'POST', account: first });
  assert.equal(response.status, 200);
  assert.equal(response.data.refundStatus, 'SIMULATED');
  assert.equal((await request(path, { method: 'POST', account: first })).status, 400);
  assert.equal((await request('/bookings/check-in', { method: 'POST', account: admin, data: { qrToken: data.booking.qrToken } })).status, 404);
  assert.equal((await ShowtimeSeat.findOne({ showtimeId: slot._id, seatNumber: 'A1' })).status, 'AVAILABLE');
});

test('failed exchange keeps the original seat and successful exchange rotates QR', { skip }, async () => {
  const source = await makeShowtime(49);
  const destination = await makeShowtime(50);
  await checkout(destination, second, ['A1']);
  const { data } = await checkout(source, first, ['A1']);
  const path = '/bookings/' + data.booking.id + '/exchange';
  const exchange = seat => request(path, { method: 'POST', account: first, data: { targetShowtimeId: String(destination._id), newSeatNumbers: [seat] } });
  assert.equal((await exchange('A1')).status, 409);
  assert.equal((await Booking.findById(data.booking.id)).qrToken, data.booking.qrToken);
  assert.equal((await ShowtimeSeat.findOne({ showtimeId: source._id, seatNumber: 'A1' })).status, 'BOOKED');
  await Showtime.updateOne({ _id: destination._id }, { $set: { price: 150000 } });
  const exchanged = await exchange('A2');
  assert.equal(exchanged.status, 200, JSON.stringify(exchanged.data));
  assert.notEqual(exchanged.data.booking.qrToken, data.booking.qrToken);
  assert.equal(exchanged.data.priceDiff, 20000);
  const { default: statistics } = await import('../src/services/statisticsService.js');
  const [sourceStats, destinationStats] = await Promise.all([
    statistics.getShowtimeDetailStats(source._id),
    statistics.getShowtimeDetailStats(destination._id),
  ]);
  assert.equal(sourceStats.stats.totalRevenue, 0);
  assert.equal(destinationStats.stats.totalRevenue, 280000);

  assert.equal((await request('/bookings/check-in', { method: 'POST', account: admin, data: { qrToken: data.booking.qrToken } })).status, 404);
  assert.equal((await ShowtimeSeat.findOne({ showtimeId: source._id, seatNumber: 'A1' })).status, 'AVAILABLE');
});

test('only one concurrent admin scan checks in the whole booking', { skip }, async () => {
  const slot = await makeShowtime(46);
  const { data } = await checkout(slot, first, ['A1', 'A2']);
  const scan = account => request('/bookings/check-in', { account, method: 'POST', data: { qrToken: data.booking.qrToken } });
  assert.equal((await scan(first)).status, 403);
  const scans = await Promise.all([scan(admin), scan(admin)]);
  assert.equal(scans.filter(result => result.status === 200).length, 1);
  assert.equal(scans.find(result => result.status === 200).data.booking.seats, 'A1, A2');
  assert.notEqual((await scan(admin)).status, 200);
});

test('physical room overlap is rejected and room identity cannot be edited', { skip }, async () => {
  await makeShowtime(48);
  const startTime = new Date(Date.now() + 60 * 3600000).toISOString();
  const data = { movieId: String(movie._id), roomId: String(room._id), startTime };
  const created = await request('/admin/showtimes', { method: 'POST', account: admin, data });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: created.data.showtime.id }), 3);
  assert.equal((await request('/admin/showtimes', { method: 'POST', account: admin, data })).status, 409);
  assert.equal((await request('/admin/showtimes/' + created.data.showtime.id, { method: 'PUT', account: admin, data: { roomId: String(room._id) } })).status, 400);
});

test('a failed booking insert aborts claimed seats', { skip }, async () => {
  const slot = await makeShowtime(70);
  const originalCreate = Booking.create;
  Booking.create = async () => { throw new Error('Simulated persistence failure'); };
  try {
    assert.equal((await checkout(slot, first, ['A1', 'A2'])).status, 503);
  } finally {
    Booking.create = originalCreate;
  }
  assert.equal(await Booking.countDocuments({ showtimeId: slot._id }), 0);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'BOOKED' }), 0);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'HOLDING' }), 2);
});

test('checkout rejects a past or unopened showtime and cancellation inside 24 hours', { skip }, async () => {
  const past = await makeShowtime(-1);
  const future = await makeShowtime(9 * 24);
  const imminent = await makeShowtime(23);
  assert.equal((await checkout(past, first, ['A1'])).status, 400);
  assert.equal((await checkout(future, first, ['A1'])).status, 400);
  const { data } = await checkout(imminent, first, ['A1']);
  assert.equal((await request('/bookings/' + data.booking.id + '/cancel', { account: first, method: 'POST' })).status, 400);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: imminent._id, status: 'BOOKED' }), 1);
});

test('website availability agrees with Admin and distinguishes simulated vs verified revenue', { skip }, async () => {
  const slot = await makeShowtime(29);
  const purchase = await checkout(slot, first, ['A1']);
  assert.equal(purchase.status, 201);
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(slot.startTime);
  await Movie.updateOne({ _id: movie._id }, { $set: { releaseDate: new Date(day + 'T00:00:00+07:00') } });
  const website = await request('/movies/' + movie._id + '/schedule?date=' + day);
  const adminView = await request('/admin/statistics/showtimes/' + slot._id, { account: admin });
  assert.equal(website.status, 200, JSON.stringify(website.data));
  assert.equal(adminView.status, 200, JSON.stringify(adminView.data));
  const listed = website.data.showtimes.find(item => item.id === String(slot._id));
  assert.equal(listed.availableSeats, 2);
  assert.equal(adminView.data.data.stats.availableCount, listed.availableSeats);
  // Thanh toán mô phỏng được tính vào tổng doanh thu trình diễn (simulatedRevenue), nhưng doanh thu thực đã xác minh (verifiedRevenue) vẫn bằng 0
  assert.equal(adminView.data.data.stats.verifiedRevenue, 0);
  assert.equal(adminView.data.data.stats.simulatedRevenue, 130000);
  assert.equal(adminView.data.data.stats.totalRevenue, 130000);
});

test('review identity comes from the verified account and stored demo votes are ignored', { skip }, async () => {
  const slot = await makeShowtime(6);
  const purchase = await checkout(slot, first, ['A1']);
  assert.equal(purchase.status, 201);
  await Showtime.updateOne({ _id: slot._id }, { $set: { startTime: new Date(Date.now() - 3600000) } });
  await Movie.updateOne({ _id: movie._id }, { $push: { reviews: { userName: 'Unverified demo', rating: 1, comment: 'demo' } } });
  await request('/bookings/check-in', { method: 'POST', account: admin, data: { qrToken: purchase.data.booking.qrToken } });
  const route = '/movies/' + movie._id + '/reviews';
  const payload = { userId: String(second._id), userName: second.name, comment: 'Verified customer', rating: 5 };
  assert.equal((await request(route, { method: 'POST', data: payload })).status, 401);
  assert.equal((await request(route, { method: 'POST', account: second, data: payload })).status, 403);
  const review = await request(route, { method: 'POST', account: first, data: payload });
  assert.equal(review.status, 201, JSON.stringify(review.data));
  assert.equal(review.data.rating, 5);
  assert.equal(review.data.reviews.length, 1);
  assert.equal(review.data.review.userId, String(first._id));
  assert.equal((await request(route + '/' + review.data.review._id, { method: 'DELETE', account: second })).status, 404);
});

test('authenticated overview responds on the isolated test dataset', { skip }, async t => {
  const start = performance.now();
  const overview = await request('/admin/statistics/overview?timeRange=today', { account: admin });
  t.diagnostic('Isolated authenticated GET: ' + Math.round(performance.now() - start) + ' ms');
  assert.equal(overview.status, 200, JSON.stringify(overview.data));
});

test('revenue breakdown separates verified, simulated, cancelled, refunded and CSV uses same totals', { skip }, async () => {
  const slot = await makeShowtime(33);
  const verified = await checkout(slot, first, ['A1']);
  const toRefund = await checkout(slot, first, ['A2']);
  const simulated = await checkout(slot, first, ['B1']);
  assert.equal(verified.status, 201);
  assert.equal(toRefund.status, 201);
  assert.equal(simulated.status, 201);
  await Booking.updateOne({ _id: verified.data.booking.id }, { $set: { paymentStatus: 'VERIFIED' } });
  await Booking.updateOne({ _id: toRefund.data.booking.id }, { $set: {
    status: 'CANCELLED', paymentStatus: 'VERIFIED', refundStatus: 'REFUNDED', refundAmount: 130000,
  } });
  const revenue = await request('/admin/statistics/revenue?timeRange=today', { account: admin });
  const csv = await request('/admin/statistics/export?type=revenue&timeRange=today', { account: admin });
  assert.equal(revenue.status, 200, JSON.stringify(revenue.data));
  const m = revenue.data.data.metrics;
  assert.equal(m.verifiedRevenue, 130000);
  assert.equal(m.simulatedRevenue, m.totalRevenue - 130000);
  assert.equal(m.totalRevenue, m.netRevenue);
  assert.equal(m.refundedAmount, 130000);
  assert.ok(m.cancelledAmount >= 130000);
  assert.equal(csv.status, 200);
  assert.match(csv.data, new RegExp(`Doanh thu thực đã xác minh,${m.verifiedRevenue}`));
  assert.match(csv.data, new RegExp(`Doanh thu mô phỏng,${m.simulatedRevenue}`));
  assert.match(csv.data, new RegExp(`Doanh thu thuần,${m.netRevenue}`));
});

test('physical batch transaction rejects overlapping times without a partial schedule', { skip }, async () => {
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
    .format(new Date(Date.now() + 5 * 86400000));
  const before = await Showtime.countDocuments();
  const data = { roomIds: [String(room._id)], movieIds: [String(movie._id)], startDate: date, endDate: date, timeSlots: ['13:00', '14:00'] };
  assert.equal((await request('/admin/showtimes/schedule-batch', { method: 'POST', account: admin, data })).status, 409);
  assert.equal(await Showtime.countDocuments(), before);
});

test('deactivating a movie preserves its showtimes, seats, and bookings', { skip }, async () => {
  const slot = await makeShowtime(31);
  const { data } = await checkout(slot, first, ['A1']);
  assert.equal((await request('/admin/movies/' + movie._id, { method: 'DELETE', account: admin })).status, 200);
  assert.equal((await Movie.findById(movie._id)).status, 'ENDED');
  assert.equal((await Showtime.findById(slot._id)).isLocked, true);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id }), 3);
  assert.ok(await Booking.exists({ _id: data.booking.id }));
});

test('Group B protection: direct DELETE returns 409 and CANCEL_WITH_REFUND preserves history, invalidates QR, updates stats and is idempotent', { skip }, async () => {
  const slot = await makeShowtime(44);
  const purchase = await checkout(slot, first, ['A1']);
  assert.equal(purchase.status, 201);
  const path = '/admin/showtimes/' + slot._id;

  // 1. DELETE trực tiếp suất Nhóm B (đã có vé) phải trả về 409 Conflict
  const directDelete = await request(path, { account: admin, method: 'DELETE' });
  assert.equal(directDelete.status, 409, JSON.stringify(directDelete.data));
  assert.equal(directDelete.data.hasBookings, true);
  assert.equal((await Showtime.findById(slot._id)).cancelledAt, undefined);

  // 2. CANCEL_WITH_REFUND hợp lệ thực hiện hủy mềm
  const cancelled = await request(path, {
    account: admin,
    method: 'DELETE',
    data: { action: 'CANCEL_WITH_REFUND', reason: 'Bảo trì máy chiếu' },
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
  assert.deepEqual(cancelled.data.affectedOrders, [purchase.data.booking.bookingCode]);

  // 3. Lịch sử suất chiếu và đơn đặt vé được bảo toàn
  const updatedSlot = await Showtime.findById(slot._id);
  assert.ok(updatedSlot.cancelledAt);
  assert.equal(updatedSlot.isLocked, true);
  const booking = await Booking.findById(purchase.data.booking.id);
  assert.equal(booking.status, 'CANCELLED');
  assert.equal(booking.qrToken, null);
  assert.equal(booking.refundStatus, 'SIMULATED');
  assert.equal(booking.refundAmount, booking.totalAmount);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'AVAILABLE' }), 3);

  // 4. QR của vé đã hủy không thể check-in
  const checkInRes = await request('/bookings/check-in', {
    method: 'POST',
    account: admin,
    data: { qrToken: purchase.data.booking.qrToken },
  });
  assert.equal(checkInRes.status, 404);

  // 5. Thống kê doanh thu của suất chiếu bị hủy về 0
  const adminView = await request('/admin/statistics/showtimes/' + slot._id, { account: admin });
  assert.equal(adminView.status, 200);
  assert.equal(adminView.data.data.stats.totalRevenue, 0);

  // 6. Suất chiếu bị hủy không còn xuất hiện trên Website
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(slot.startTime);
  await Movie.updateOne({ _id: movie._id }, { $set: { releaseDate: new Date(day + 'T00:00:00+07:00') } });
  const website = await request('/movies/' + movie._id + '/schedule?date=' + day);
  assert.equal(website.status, 200);
  assert.equal(website.data.showtimes.some((s) => s.id === String(slot._id)), false);

  // 7. Gửi lại CANCEL_WITH_REFUND không tạo hoàn tiền trùng lặp (idempotent)
  const retryCancel = await request(path, {
    account: admin,
    method: 'DELETE',
    data: { action: 'CANCEL_WITH_REFUND', reason: 'Thử lại' },
  });
  assert.equal(retryCancel.status, 200);
  assert.equal(retryCancel.data.alreadyCancelled, true);
  assert.equal(await Booking.countDocuments({ showtimeId: slot._id }), 1);

  assert.equal((await request(path + '/toggle-lock', { account: admin, method: 'PUT' })).status, 409);
});

test('STAT-T01..T06 and T08: historical periods, revenue, refunds, seat scope, expenses and CSV', async () => {
  const { default: statistics } = await import('../src/services/statisticsService.js');
  const { default: Expense } = await import('../src/models/Expense.js');
  const { parseDateFilter } = await import('../src/utils/statisticsUtils.js');
  const reportCinema = await Cinema.create({ name: 'Phase 02 Cinema', slug: 'phase02-cinema', address: 'Test' });
  const reportMovie = await Movie.create({
    title: 'Phase 02 report movie', posterUrl: '/test.jpg', genre: 'Test', duration: 100,
  });
  const oct = { timeRange: 'by_month', month: 10, year: 2026, movieId: String(reportMovie._id) };
  const nov = { ...oct, month: 11 };
  const empty = { ...oct, year: 2025 };
  const today = new Date('2027-01-01T05:00:00.000+07:00');

  assert.equal(parseDateFilter({ timeRange: 'yesterday', now: today }).end.toISOString(), '2026-12-31T16:59:59.999Z');
  assert.equal(parseDateFilter({ timeRange: 'this_week', now: today }).start.toISOString(), '2026-12-27T17:00:00.000Z');
  assert.equal(parseDateFilter({ timeRange: '7_days', now: today }).start.toISOString(), '2026-12-25T17:00:00.000Z');
  assert.equal(parseDateFilter('custom', '2028-02-29', '2028-02-29').end.toISOString(), '2028-02-29T16:59:59.999Z');
  assert.throws(() => parseDateFilter('custom', '2027-02-29', '2027-03-01'), { statusCode: 400 });
  assert.throws(() => parseDateFilter('custom', '2027-03-02', '2027-03-01'), { statusCode: 400 });
  assert.throws(() => parseDateFilter('by_month', null, null, 13, 2026), { statusCode: 400 });
  for (const year of [2025, 2026, 2027]) {
    for (let month = 1; month <= 12; month++) {
      const p = parseDateFilter({ timeRange: 'by_month', month, year });
      assert.equal(p.year, year);
      assert.equal(p.month, month);
    }
  }

  const fixtureRoom = await Room.create({
    name: 'Statistics Dolby', roomNumber: 4, roomType: 'Dolby Atmos',
    cinemaId: reportCinema._id, totalSeats: 4,
  });
  const otherMovie = await Movie.create({ title: 'Statistics no sales', posterUrl: '/test.jpg', genre: 'Test', duration: 100 });
  const showtime = (movieId, startTime, slotRoom = fixtureRoom) => Showtime.create({
    movieId, roomId: slotRoom._id, roomName: slotRoom.name, cinemaId: reportCinema._id,
    startTime: new Date(startTime), price: 999999,
  });
  const [bookedSlot, emptySlot] = await Promise.all([
    showtime(reportMovie._id, '2026-11-01T00:00:00+07:00'),
    showtime(otherMovie._id, '2026-11-03T13:00:00+07:00'),
  ]);
  const order = (bookingCode, createdAt, extra = {}) => ({
    bookingCode, createdAt: new Date(createdAt), updatedAt: new Date('2027-09-01T00:00:00Z'),
    showtimeId: bookedSlot._id, seats: 'A1', totalAmount: 100, status: 'PAID',
    paymentStatus: 'SIMULATED', ...extra,
  });
  await Booking.collection.insertMany([
    order('P02-OCT', '2026-10-31T23:59:59.999+07:00', { concessions: 'legacy combo' }),
    order('P02-NOV', '2026-11-01T00:00:00+07:00', { paymentStatus: 'VERIFIED', totalAmount: 200, customerName: 'Phase 02 customer', customerPhone: '0911111111' }),
    order('P02-RV', '2026-11-01T01:00:00+07:00', { status: 'CANCELLED', paymentStatus: 'VERIFIED', refundStatus: 'REFUNDED', refundAmount: 80 }),
    order('P02-RS', '2026-11-01T02:00:00+07:00', { status: 'CANCELLED', refundStatus: 'SIMULATED', refundAmount: 60 }),
    order('P02-RP', '2026-11-01T03:00:00+07:00', { status: 'CANCELLED', refundStatus: 'PENDING', refundAmount: 20 }),
    order('P02-MISSING', '2026-11-01T03:30:00+07:00', { status: 'CANCELLED', refundStatus: 'SIMULATED' }),
    order('P02-DEFAULTZERO', '2026-11-01T03:35:00+07:00', { status: 'CANCELLED', refundStatus: 'SIMULATED', refundAmount: 0 }),
    order('P02-NONE', '2026-11-01T03:40:00+07:00', { status: 'CANCELLED', refundStatus: 'NONE' }),
    order('P02-P', '2026-11-01T04:00:00+07:00', { status: 'PENDING', paymentStatus: 'PENDING' }),
    order('P02-F', '2026-11-01T05:00:00+07:00', { paymentStatus: 'FAILED' }),
  ]);

  const noCost = await statistics.getRevenueStats(nov);
  assert.equal(noCost.metrics.profitKnown, false);
  assert.equal(noCost.metrics.profit, null);
  assert.equal(noCost.metrics.profitMargin, null);
  assert.equal(noCost.metrics.roi, null);
  const octoberRevenue = await statistics.getRevenueStats(oct);
  assert.equal(octoberRevenue.metrics.netRevenue, 100);
  assert.equal(octoberRevenue.metrics.unclassifiedRevenue, 100);
  const emptyRevenue = await statistics.getRevenueStats(empty);
  assert.equal(emptyRevenue.metrics.netRevenue, 0);
  assert.equal(emptyRevenue.metrics.ticketPercent, 0);
  assert.equal(emptyRevenue.metrics.concessionPercent, 0);
  assert.equal(emptyRevenue.monthlyBreakdown.length, 12);
  const emptyRankings = await statistics.getMoviesStats({ ...nov, movieId: String(otherMovie._id) });
  for (const key of ['topSold', 'topRevenue', 'topOccupancy', 'lowestSold']) {
    assert.equal(emptyRankings.rankings[key], null);
  }

  const expense = (costCode, amount, extra = {}) => ({
    costCode, title: costCode, date: new Date('2026-11-02T00:00:00+07:00'),
    type: 'OTHER', amount, ...extra,
  });
  await Expense.create(expense('P02-ZERO', 0, { movieId: reportMovie._id }));
  const zeroCost = await statistics.getRevenueStats(nov);
  assert.equal(zeroCost.metrics.profitKnown, true);
  assert.equal(zeroCost.metrics.profit, 200);
  assert.equal(zeroCost.metrics.roi, null);

  await Expense.create([
    expense('P02-SHARED', 1001, { cinemaId: reportCinema._id }),
    expense('P02-FILM-ROOM', 100, { movieId: reportMovie._id, roomId: fixtureRoom._id }),
    expense('P02-ROOM', 20, { roomId: fixtureRoom._id }),
    expense('P02-NOSLOT', 50, { date: new Date('2025-10-01T00:00:00+07:00') }),
  ]);

  const fixtureSeats = [
    ['A1', 'BOOKED'],
    ['A2', 'HOLDING', new Date(Date.now() + 3_600_000)],
    ['A3', 'HOLDING', new Date(Date.now() - 3_600_000)],
    ['A4', 'AVAILABLE'],
  ];
  await ShowtimeSeat.collection.insertMany(fixtureSeats.map(([seatNumber, status, holdExpiresAt], index) => ({
    showtimeId: bookedSlot._id, roomId: fixtureRoom._id, seatNumber, status,
    row: 'A', col: index + 1, type: 'STANDARD', holdExpiresAt,
  })));

  const scope = { ...nov, roomId: String(fixtureRoom._id), roomType: 'Dolby Atmos' };
  const [overview, revenue, movies, detail, showtimes, slot, year, noSlotCost] = await Promise.all([
    statistics.getOverviewStats(scope),
    statistics.getRevenueStats(scope),
    statistics.getMoviesStats(scope),
    statistics.getMovieDetailStats(reportMovie._id, scope),
    statistics.getShowtimesStats(scope),
    statistics.getShowtimeDetailStats(bookedSlot._id),
    statistics.getRevenueStats({ timeRange: 'this_year', year: 2026, cinemaId: String(reportCinema._id) }),
    statistics.getRevenueStats({ ...empty, movieId: 'ALL' }),
  ]);

  assert.equal(revenue.metrics.netRevenue, 200);
  assert.equal(revenue.metrics.verifiedRefundedAmount, 80);
  assert.equal(revenue.metrics.simulatedRefundedAmount, 60);
  assert.equal(revenue.metrics.totalRefundedAmount, 140);
  assert.equal(revenue.metrics.pendingRefundAmount, 20);
  assert.equal(revenue.metrics.cancelledAmount, 600);
  assert.equal(revenue.metrics.missingRefundAmountCount, 2);
  assert.equal(overview.kpis.netRevenue.missingRefundAmountCount, 2);
  assert.deepEqual(revenue.revenueChartData.map((day) => day.fullDate),
    overview.revenueChartData.map((day) => day.fullDate));
  assert.equal(revenue.revenueChartData[0].netRevenue, 200);
  assert.equal(revenue.revenueChartData[0].expense, null);
  assert.equal(revenue.revenueChartData[1].netRevenue, 0);
  assert.equal(revenue.revenueChartData[1].expense, revenue.metrics.totalExpenses);
  assert.equal(revenue.metrics.refundDateKnown, false);
  assert.equal(overview.kpis.netRevenue.totalRefundedAmount, 140);
  assert.equal(overview.kpis.netRevenue.value, 200);
  assert.equal(overview.kpis.netRevenue.growth, 100);
  assert.ok([610, 611].includes(revenue.metrics.totalExpenses));
  assert.equal(overview.kpis.totalExpenses.value, revenue.metrics.totalExpenses);
  assert.equal(movies.items[0].totalExpenses, revenue.metrics.totalExpenses);
  assert.equal(detail.stats.totalExpenses, revenue.metrics.totalExpenses);
  assert.equal(year.monthlyBreakdown.length, 12);
  assert.equal(year.monthlyBreakdown[9].netRevenue, 100);
  assert.equal(year.monthlyBreakdown[10].netRevenue, 200);
  assert.equal(noSlotCost.metrics.unallocatedExpenses, 50);

  await showtime(otherMovie._id, '2026-12-01T14:00:00+07:00');
  await Expense.create(expense('P03-DEC-SHARED', 1000, {
    cinemaId: reportCinema._id, date: new Date('2026-12-02T12:00:00+07:00'),
  }));
  const [yearScope, novemberScope, decemberScope, singleDayScope] = await Promise.all([
    statistics.getRevenueStats({ ...scope, timeRange: 'this_year' }),
    statistics.getRevenueStats(scope),
    statistics.getRevenueStats({ ...scope, month: 12 }),
    statistics.getRevenueStats({ ...scope, timeRange: 'custom', customStart: '2026-11-02', customEnd: '2026-11-02' }),
  ]);
  assert.equal(decemberScope.metrics.totalExpenses, 0);
  assert.equal(yearScope.metrics.totalExpenses, novemberScope.metrics.totalExpenses);
  assert.equal(singleDayScope.metrics.totalExpenses, novemberScope.metrics.totalExpenses);
  assert.equal(yearScope.metrics.totalExpenses, yearScope.monthlyBreakdown.reduce((sum, row) => sum + row.expenses, 0));


  assert.equal(overview.cinemaCapacity.periodSoldSeats, 1);
  assert.equal(overview.cinemaCapacity.periodHoldingSeats, 1);
  assert.equal(overview.cinemaCapacity.periodUnsoldSeats, 2);
  assert.equal(overview.cinemaCapacity.closedUnsoldSeats, 2);
  const roomRow = overview.roomOccupancyBreakdown.find((row) => String(row.roomId) === String(fixtureRoom._id));
  const typeRow = overview.roomTypeBreakdown.find((row) => row.roomType === 'Dolby Atmos');
  for (const key of ['showtimesCount', 'totalSellableSeats', 'soldSeats', 'holdingSeats', 'unsoldSeats', 'revenue']) {
    assert.equal(roomRow[key], typeRow[key], key);
  }
  assert.equal(showtimes.items[0].bookedSeats, 1);
  assert.equal(slot.stats.bookedCount, 1);
  assert.equal(detail.stats.bookedSeats, 1);
  assert.equal(movies.items[0].bookedSeats, 1);
  assert.ok(movies.rankings.topSold);
  assert.equal(movies.rankings.lowestSold, null);
  assert.equal(overview.crossPeriodReconciliation.preBookedRevenueFromEarlierPeriodForPeriodShowtimes, 100);
  assert.equal(overview.peakHours.reduce((sum, bucket) => sum + bucket.revenue, 0), 300);
  assert.equal(overview.kpis.averages.avgRevenuePerShowtime, 300);
  assert.equal(overview.revenueChartData.find((day) => day.fullDate === '01/11/2026').occupancyRate, 25);
  const expenseResponse = await request('/admin/statistics/expenses?' + new URLSearchParams(scope), { account: admin });
  assert.equal(expenseResponse.status, 200);
  assert.equal(expenseResponse.data.data.allocatedSummary.totalAmount, revenue.metrics.totalExpenses);
  for (const endpoint of ['filter-movies', 'customers', 'reviews']) {
    const response = await request('/admin/statistics/' + endpoint + '?' + new URLSearchParams(scope), { account: admin });
    assert.equal(response.status, 200, endpoint);
  }

  assert.equal((await statistics.getShowtimeDetailStats(emptySlot._id)).stats.hasSeatRecords, false);

  const { content: csv } = await statistics.exportStatistics('revenue', scope);
  assert.equal(csv.codePointAt(0), 0xfeff);
  assert.match(csv, /Hoàn tiền xác minh,80/);
  assert.match(csv, /Hoàn tiền mô phỏng,60/);
  assert.match(csv, /Đơn thiếu số tiền hoàn,2/);
  assert.match(csv, /Doanh thu thuần,200/);
  const [overviewCsv, movieCsv, showtimeCsv, customerCsv] = await Promise.all(
    ['overview', 'movies', 'showtimes', 'customers'].map((type) => statistics.exportStatistics(type, scope))
  );
  for (const report of [overviewCsv, movieCsv, showtimeCsv, customerCsv]) {
    assert.equal(report.content.codePointAt(0), 0xfeff);
  }
  assert.ok(overviewCsv.content.includes(`Tổng chi phí trong kỳ,${overview.kpis.totalExpenses.value}`));
  assert.ok(movieCsv.content.includes(`,25%,25%,0%,200,${movies.items[0].directExpenses},${movies.items[0].allocatedExpenses},${movies.items[0].totalExpenses},`));
  assert.ok(showtimeCsv.content.includes('"Dolby Atmos"'));
  assert.ok(showtimeCsv.content.includes(',4,2,1,1,2,2,0,25%,300,"FINISHED"'));
  assert.ok(customerCsv.content.includes('"Phase 02 customer","09****1111",1,1,200'));
  const wrongType = await statistics.getRevenueStats({ ...scope, roomType: 'Gold Class' });
  assert.equal(wrongType.metrics.netRevenue, 0);
  assert.equal(wrongType.metrics.totalExpenses, 0);

  const invalid = await request('/admin/statistics/revenue?timeRange=custom&customStart=2026-02-30&customEnd=2026-03-01', { account: admin });
  assert.equal(invalid.status, 400);
  const denied = await request('/admin/statistics/expenses', { account: first });
  assert.equal(denied.status, 403);
});

test('STAT Phase 02: lifecycle, missing Room, bookability and chatbot on isolated MongoDB', async () => {
  const { default: statistics } = await import('../src/services/statisticsService.js');
  const { generateChatResponse } = await import('../src/services/aiService.js');
  const now = Date.now();
  const minute = 60000;
  const date = (offset) => new Date(now + offset * minute);
  const missingRoomId = new mongoose.Types.ObjectId();
  const missingMovie = await Movie.create({
    title: 'Phase 02 lifecycle movie', posterUrl: '/test.jpg', genre: 'Test', duration: 100,
  });
  const scenarios = [
    { name: 'live', start: -20, end: 80, lifecycleStatus: 'COMPLETED', expected: 'NOW_SHOWING' },
    { name: 'cleaning', start: -105, end: -5, expected: 'CLEANING' },
    { name: 'closed', start: -140, end: -40, expected: 'COMPLETED' },
    { name: 'locked', start: 60, end: 160, isLocked: true, expected: 'UPCOMING' },
    { name: 'cancelled', start: 120, end: 220, cancelledAt: new Date(now), expected: 'CANCELLED' },
    { name: 'early', start: 8 * 1440, end: 8 * 1440 + 100, expected: 'UPCOMING' },
    { name: 'open', start: 180, end: 280, expected: 'UPCOMING', bookable: 1 },
    { name: 'orphan', start: 240, end: 340, roomId: missingRoomId, expected: 'UPCOMING' },
  ];
  for (const fixture of scenarios) {
    const slot = await Showtime.create({
      movieId: missingMovie._id, roomId: fixture.roomId || room._id, roomName: fixture.name,
      cinemaId: cinema._id, startTime: date(fixture.start), endTime: date(fixture.end),
      cleaningEndTime: date(fixture.end + 15), lifecycleStatus: fixture.lifecycleStatus,
      isLocked: fixture.isLocked, cancelledAt: fixture.cancelledAt, price: 100000,
    });
    await ShowtimeSeat.create({
      showtimeId: slot._id, roomId: fixture.roomId || room._id, seatNumber: 'A1',
      row: 'A', col: 1, type: 'STANDARD', status: 'AVAILABLE',
    });
    const detail = await statistics.getShowtimeDetailStats(slot._id);
    assert.equal(detail.showtime.lifecycleStatus, fixture.expected, fixture.name);
    assert.equal(detail.stats.bookableAvailableCount, fixture.bookable || 0, fixture.name);
    assert.equal(detail.stats.totalSeats, fixture.expected === 'CANCELLED' ? 0 : 1);
    assert.equal(detail.stats.missingRoom, Boolean(fixture.roomId));
  }
  const answer = await generateChatResponse('Tôi muốn hỏi giá bắp nước tại rạp', { skipLog: true });
  assert.ok((answer.reply || answer).length > 20);
});

test('STAT Phase 02: separate databases keep the LIVE and DEMO totals apart', async () => {
  const { default: statistics } = await import('../src/services/statisticsService.js');
  const priorMode = process.env.DB_MODE;
  const filter = { timeRange: 'by_month', month: 10, year: 2026 };
  try {
    process.env.DB_MODE = 'LIVE';
    const live = await statistics.getOverviewStats(filter);
    assert.equal(live.dbMode, 'LIVE');
    assert.equal(live.kpis.netRevenue.value, 100);
    await mongoose.disconnect();
    await mongoose.connect(mongo.getUri('phase02_demo'));
    process.env.DB_MODE = 'DEMO';
    const demo = await statistics.getOverviewStats(filter);
    assert.equal(demo.dbMode, 'DEMO');
    assert.equal(demo.kpis.netRevenue.value, 0);
    assert.notEqual(live.databaseName, demo.databaseName);
  } finally {
    if (priorMode === undefined) delete process.env.DB_MODE;
    else process.env.DB_MODE = priorMode;
    await mongoose.disconnect();
    await mongoose.connect(mongo.getUri('davenor_integration'));
  }
});

test('STAT Phase 02: sale today for a screening tomorrow keeps both date bases independent', async () => {
  const { default: statistics } = await import('../src/services/statisticsService.js');
  const { parseDateFilter, formatVietnamDateKey } = await import('../src/utils/statisticsUtils.js');
  const day = parseDateFilter('today');
  const tomorrow = new Date(+day.end + 1);
  const advanceMovie = await Movie.create({
    title: 'Phase 02 advance sale', posterUrl: '/test.jpg', genre: 'Test', duration: 100,
  });
  const slot = await Showtime.create({
    movieId: advanceMovie._id, roomId: room._id, roomName: room.name, cinemaId: cinema._id,
    startTime: new Date(+tomorrow + 13 * 3600000), price: 123456,
  });
  await Booking.collection.insertOne({
    bookingCode: 'P02-TODAY-TOMORROW', createdAt: day.start, showtimeId: slot._id,
    seats: 'A1', status: 'PAID', paymentStatus: 'SIMULATED', totalAmount: 123456,
    customerPhone: '0900000099',
  });
  await ShowtimeSeat.create({
    showtimeId: slot._id, roomId: room._id, seatNumber: 'A1',
    row: 'A', col: 1, type: 'STANDARD', status: 'BOOKED',
  });
  const todayFilter = { timeRange: 'today', movieId: String(advanceMovie._id) };
  const tomorrowKey = formatVietnamDateKey(tomorrow, 'YYYY-MM-DD');
  const tomorrowFilter = {
    ...todayFilter, timeRange: 'custom', customStart: tomorrowKey, customEnd: tomorrowKey,
  };
  const [current, future, customers, filters] = await Promise.all([
    statistics.getOverviewStats(todayFilter),
    statistics.getOverviewStats(tomorrowFilter),
    statistics.getCustomersStats(todayFilter),
    statistics.getPeriodFilterMovies({ ...todayFilter, roomId: String(room._id) }),
  ]);
  const efficiency = await statistics.getMoviesStats(tomorrowFilter);
  assert.equal(efficiency.items[0].performanceStatus, 'INSUFFICIENT_SCREENINGS');
  assert.equal(efficiency.items[0].upcomingOccupancyRate, 100);
  assert.equal(current.kpis.netRevenue.value, 123456);
  assert.equal(current.cinemaCapacity.periodSoldSeats, 0);
  assert.equal(current.kpis.distinctMovies.value, 0);
  assert.equal(future.kpis.netRevenue.value, 0);
  assert.equal(future.cinemaCapacity.periodSoldSeats, 1);
  assert.equal(future.kpis.averages.avgRevenuePerShowtime, 123456);
  assert.equal(current.kpis.averages.avgRevenuePerShowtime, 0);
  assert.equal(customers.customersRanking[0].totalSpend, 123456);
  assert.ok(JSON.stringify(filters).includes(String(advanceMovie._id)));
});

test('Final statistics polish keeps four KPI ties and excludes unevaluated screenings', async () => {
  const { default: statistics } = await import('../src/services/statisticsService.js');
  const titles = ['A winner', 'B winner', 'C slow', 'D slow'];
  const films = await Movie.create(titles.map((title) => ({
    title, genre: 'Test', duration: 100, posterUrl: '/test.jpg',
  })));
  const slots = await Showtime.create(films.map((film, index) => ({
    movieId: film._id, cinemaId: cinema._id, roomId: room._id, roomName: room.name,
    startTime: new Date(Date.UTC(2024, 1, index + 1, 7)), price: 100,
  })));
  await ShowtimeSeat.collection.insertMany(slots.map((slot, index) => ({
    showtimeId: slot._id, roomId: room._id, seatNumber: 'A1', row: 'A', col: 1,
    status: index < 2 ? 'BOOKED' : 'AVAILABLE', type: 'STANDARD',
  })));
  await Booking.collection.insertMany(slots.slice(0, 2).map((slot, index) => ({
    bookingCode: 'POLISH-WIN-' + index, showtimeId: slot._id, seats: 'A1',
    createdAt: slot.startTime, paymentStatus: 'SIMULATED', status: 'PAID',
    paymentMethod: 'VNPAY', totalAmount: 100,
  })));
  const filter = { timeRange: 'by_month', month: 2, year: 2024 };
  const [movies, revenue, future] = await Promise.all([
    statistics.getMoviesStats(filter),
    statistics.getRevenueStats(filter),
    statistics.getRevenueStats({ timeRange: 'by_month', month: 1, year: 2099 }),
  ]);
  for (const key of ['topSold', 'topOccupancy', 'topRevenue', 'lowestSold']) {
    assert.equal(movies.rankings[key].tieCount, 2, key);
  }
  assert.equal(movies.rankings.lowestSold.title, 'C slow');
  assert.equal(revenue.paymentMethods.find((method) => method.method === 'VNPAY').simulatedAmount, 200);
  assert.equal(future.revenueChartData[0].status, 'FUTURE');
  assert.equal(future.revenueChartData[0].netRevenue, null);
});

test('Admin cancellation records only eligible refunds and commits exactly once under contention', async (t) => {
  const { default: AuditLog } = await import('../src/models/AuditLog.js');
  const reportMovie = await Movie.create({
    title: 'Refund consistency test', posterUrl: '/test.jpg', genre: 'Test', duration: 100,
  });
  const slot = await makeShowtime(42);
  await Showtime.updateOne({ _id: slot._id }, { movieId: reportMovie._id });
  const purchases = [];
  for (const seat of ['A1', 'A2', 'B1']) {
    const purchase = await checkout(slot, first, [seat]);
    assert.equal(purchase.status, 201);
    purchases.push(purchase.data.booking);
  }
  const paid = await Booking.find({ showtimeId: slot._id }).lean();
  const simulatedTotal = purchases.slice(0, 2).reduce((sum, booking) => sum + booking.totalAmount, 0);
  const verifiedAmount = purchases[2].totalAmount;
  await Booking.updateOne({ _id: purchases[2].id }, { paymentStatus: 'VERIFIED' });
  await Booking.collection.insertMany([
    { bookingCode: 'REFUND-PENDING', status: 'PENDING', paymentStatus: 'PENDING', totalAmount: 15, qrToken: 'refund-pending' },
    { bookingCode: 'REFUND-PRIOR', status: 'PAID', paymentStatus: 'VERIFIED', totalAmount: 57, refundStatus: 'REFUNDED', refundAmount: 37, qrToken: 'refund-prior' },
    { bookingCode: 'REFUND-HISTORY', status: 'CANCELLED', paymentStatus: 'SIMULATED', totalAmount: 12, refundStatus: 'SIMULATED' },
  ].map((order) => ({ ...order, showtimeId: slot._id, createdAt: paid[0].createdAt })));

  const path = '/admin/showtimes/' + slot._id;
  const cancel = () => request(path, { account: admin, method: 'DELETE', data: { action: 'CANCEL_WITH_REFUND' } });

  const writeFailure = t.mock.method(AuditLog, 'create', async () => { throw new Error('Forced rollback'); });
  try {
    assert.equal((await cancel()).status, 500);
  } finally {
    writeFailure.mock.restore();
  }
  assert.ok(!(await Showtime.findById(slot._id)).cancelledAt);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'BOOKED' }), 3);
  const beforeRetry = await Booking.findById(purchases[0].id).lean();
  assert.equal(beforeRetry.status, 'PAID');
  assert.equal(beforeRetry.qrToken, purchases[0].qrToken);
  assert.equal(beforeRetry.refundAmount, 0);
  assert.equal(beforeRetry.refundStatus, 'NONE');

  const results = await Promise.all([cancel(), cancel()]);
  assert.ok(results.every(({ status }) => status === 200));
  assert.deepEqual(results.map(({ data }) => data.affectedOrdersCount).sort(), [0, 5]);
  assert.equal(results.filter(({ data }) => data.alreadyCancelled).length, 1);
  assert.equal(await AuditLog.countDocuments({ actionType: 'CANCEL_SHOWTIME', showtimeIds: slot._id }), 1);
  assert.equal((await cancel()).data.alreadyCancelled, true);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'AVAILABLE', bookingId: null, holdId: null }), 3);

  const rows = await Booking.find({ showtimeId: slot._id }).lean();
  for (let index = 0; index < purchases.length; index++) {
    const order = rows.find((row) => String(row._id) === purchases[index].id);
    assert.equal(order.status, 'CANCELLED');
    assert.equal(order.qrToken, null);
    assert.equal(order.refundStatus, index === 2 ? 'PENDING' : 'SIMULATED');
    assert.equal(order.refundAmount, purchases[index].totalAmount);
  }
  for (const [code, status, amount] of [['REFUND-PENDING', 'NONE', 0], ['REFUND-PRIOR', 'REFUNDED', 37]]) {
    const order = rows.find((row) => row.bookingCode === code);
    assert.equal(order.status, 'CANCELLED');
    assert.equal(order.refundStatus, status);
    assert.equal(order.refundAmount, amount);
    assert.equal(order.qrToken, null);
  }
  assert.equal(rows.find((row) => row.bookingCode === 'REFUND-HISTORY').refundAmount, undefined);

  const params = new URLSearchParams({ timeRange: 'today', movieId: reportMovie.id });
  const overview = await request('/admin/statistics/overview?' + params, { account: admin });
  const revenue = await request('/admin/statistics/revenue?' + params, { account: admin });
  const expected = {
    verifiedRefundedAmount: 37, simulatedRefundedAmount: simulatedTotal,
    pendingRefundAmount: verifiedAmount, totalRefundedAmount: simulatedTotal + 37,
    cancelledAmount: simulatedTotal + verifiedAmount + 15 + 57 + 12, missingRefundAmountCount: 1,
  };
  assert.equal(overview.data.data.kpis.netRevenue.value, 0);
  assert.equal(revenue.data.data.metrics.netRevenue, 0);
  for (const [key, amount] of Object.entries(expected)) {
    assert.equal(overview.data.data.kpis.netRevenue[key], amount, key);
    assert.equal(revenue.data.data.metrics[key], amount, key);
  }
  for (const type of ['overview', 'revenue']) {
    const csv = await request('/admin/statistics/export?' + params + '&type=' + type, { account: admin });
    assert.equal(csv.status, 200);
    assert.ok(csv.data.includes('Hoàn tiền mô phỏng,' + simulatedTotal + '\n'));
    assert.ok(csv.data.includes('Chờ hoàn tiền,' + verifiedAmount + '\n'));
    assert.ok(csv.data.includes('Đơn thiếu số tiền hoàn,1\n'));
  }
});
