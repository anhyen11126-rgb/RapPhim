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
const modulePath = process.env.DAVENOR_TEST_MONGO_MODULE;
const skip = modulePath ? false : 'Provide a mongodb-memory-server module path for isolated integration tests.';

test('seven days are counted on the Vietnam calendar across midnight and New Year', () => {
  const jan7 = new Date('2027-01-07T23:30:00+07:00');
  assert.equal(opensMoreThanSevenDaysAhead(jan7, new Date('2026-12-31T23:59:59+07:00')), false);
  assert.equal(opensMoreThanSevenDaysAhead(jan7, new Date('2026-12-30T23:59:59+07:00')), true);
});

before(async () => {
  if (skip) return;
  process.env.JWT_SECRET = 'isolated-node-test-secret';
  const { MongoMemoryReplSet } = createRequire(import.meta.url)(modulePath);
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

function checkout(slot, account, seatNumbers, overrides = {}, key) {
  return request('/bookings/checkout', {
    account, method: 'POST', key,
    data: { showtimeId: String(slot._id), seatNumbers, customerName: account.name, customerPhone: account.phone, totalAmount: 1, ...overrides },
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

test('selecting a seat does not mutate its state or create a booking', { skip }, async () => {
  const slot = await makeShowtime(40);
  assert.equal((await request('/bookings/hold', { method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } })).status, 200);
  assert.equal(await Booking.countDocuments({ showtimeId: slot._id }), 0);
  assert.equal((await ShowtimeSeat.findOne({ showtimeId: slot._id, seatNumber: 'A1' })).status, 'AVAILABLE');
});

test('checkout recomputes prices, discounts, grants ownership and replays the request once', { skip }, async () => {
  const slot = await makeShowtime(41);
  const key = '32e102f0-0367-4848-a18f-6358deeaa112';
  const selections = { combos: [{ id: String(combo._id), quantity: 2 }], voucherCode: 'TEST20' };
  const created = await checkout(slot, first, ['A1', 'A2'], selections, key);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.booking.totalAmount, 320000);
  assert.equal(created.data.booking.paymentStatus, 'SIMULATED');
  const replay = await checkout(slot, first, ['A1', 'A2'], selections, key);
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
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'AVAILABLE' }), 3);
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

test('website availability agrees with Admin and excludes simulation from verified revenue', { skip }, async () => {
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
  assert.equal(adminView.data.data.stats.totalRevenue, 0);
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

test('verified revenue excludes simulated and cancelled amounts and CSV uses same total', { skip }, async () => {
  const slot = await makeShowtime(33);
  const verified = await checkout(slot, first, ['A1']);
  const toRefund = await checkout(slot, first, ['A2']);
  await checkout(slot, first, ['B1']);
  await Booking.updateOne({ _id: verified.data.booking.id }, { $set: { paymentStatus: 'VERIFIED' } });
  await Booking.updateOne({ _id: toRefund.data.booking.id }, { $set: {
    status: 'CANCELLED', paymentStatus: 'VERIFIED', refundStatus: 'REFUNDED', refundAmount: 130000,
  } });
  const revenue = await request('/admin/statistics/revenue?timeRange=today', { account: admin });
  const csv = await request('/admin/statistics/export?type=revenue&timeRange=today', { account: admin });
  assert.equal(revenue.status, 200, JSON.stringify(revenue.data));
  assert.equal(revenue.data.data.metrics.netRevenue, 130000);
  assert.equal(revenue.data.data.metrics.refundedAmount, 130000);
  assert.equal(csv.status, 200);
  assert.match(csv.data, /Doanh thu thuần,130000/);
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

test('admin cancellation keeps history and invalidates issued simulated tickets', { skip }, async () => {
  const slot = await makeShowtime(44);
  const purchase = await checkout(slot, first, ['A1']);
  assert.equal(purchase.status, 201);
  const path = '/admin/showtimes/' + slot._id;
  const cancelled = await request(path, { account: admin, method: 'DELETE' });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
  assert.deepEqual(cancelled.data.affectedOrders, [purchase.data.booking.bookingCode]);
  assert.ok((await Showtime.findById(slot._id)).cancelledAt);
  const booking = await Booking.findById(purchase.data.booking.id);
  assert.equal(booking.status, 'CANCELLED');
  assert.equal(booking.qrToken, null);
  assert.equal(booking.refundStatus, 'SIMULATED');
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'AVAILABLE' }), 3);
  assert.equal((await request(path + '/toggle-lock', { account: admin, method: 'PUT' })).status, 409);
});
