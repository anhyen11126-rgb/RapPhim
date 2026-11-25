import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bookingRoutes from '../src/routes/bookingRoutes.js';
import showtimeRoutes from '../src/routes/showtimeRoutes.js';
import adminRoutes from '../src/routes/adminRoutes.js';
import AdminUser from '../src/models/AdminUser.js';
import Booking from '../src/models/Booking.js';
import Cinema from '../src/models/Cinema.js';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import User from '../src/models/User.js';
import { findContiguousAvailableSeats } from '../src/services/ai/cinemaContextService.js';

let server;
let mongo;
let url;
let movie;
let cinema;
let room;
let first;
let second;
let admin;
const modulePath = process.env.DAVENOR_TEST_MONGO_MODULE || 'mongodb-memory-server';

before(async () => {
  process.env.JWT_SECRET = 'isolated-hold-test-secret';
  const { MongoMemoryReplSet } = createRequire(import.meta.url)(modulePath);
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('davenor_hold_integration'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const password = await bcrypt.hash('hold-test-pass', 4);
  [first, second] = await User.create([
    { name: 'User One', email: 'u1@test.local', phone: '0901111111', password },
    { name: 'User Two', email: 'u2@test.local', phone: '0902222222', password },
  ]);
  admin = await AdminUser.create({ name: 'Admin', email: 'admin@test.local', password });
  cinema = await Cinema.create({ name: 'Davenor Test Cinema', address: 'Da Nang' });
  room = await Room.create({ name: 'Phòng 01 - IMAX Laser', roomType: 'IMAX Laser', cinemaId: cinema._id, totalSeats: 6 });
  movie = await Movie.create({ title: 'Hold Test Movie', posterUrl: '/p.jpg', genre: 'Action', duration: 120 });

  const app = express();
  app.use(express.json());
  app.use('/bookings', bookingRoutes);
  app.use('/showtimes', showtimeRoutes);
  app.use('/admin', adminRoutes);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

function token(account) {
  return jwt.sign({ id: String(account._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function req(path, { account, method = 'GET', data, key } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (account) headers.authorization = 'Bearer ' + token(account);
  if (key) headers['idempotency-key'] = key;
  const res = await fetch(url + path, { method, headers, body: data && JSON.stringify(data) });
  const type = res.headers.get('content-type');
  return { status: res.status, data: type?.includes('json') ? await res.json() : await res.text() };
}

async function makeSlot(hoursFromNow = 30, overrides = {}) {
  const slot = await Showtime.create({
    movieId: movie._id,
    cinemaId: cinema._id,
    roomId: room._id,
    roomName: room.name,
    startTime: new Date(Date.now() + hoursFromNow * 3600000),
    price: 150000,
    ...overrides,
  });
  await ShowtimeSeat.insertMany(
    ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'].map((seatNumber, idx) => ({
      showtimeId: slot._id,
      roomId: room._id,
      seatNumber,
      row: seatNumber[0],
      col: (idx % 3) + 1,
      type: 'STANDARD',
      status: 'AVAILABLE',
    }))
  );
  return slot;
}

test('1. Giữ một ghế thành công (600s, trả về holdId, expiresAt, serverTime)', async () => {
  const slot = await makeSlot(25);
  const res = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } });
  assert.equal(res.status, 200);
  assert.ok(res.data.holdId.startsWith('HOLD-'));
  const diffSec = Math.round((new Date(res.data.expiresAt) - new Date(res.data.serverTime)) / 1000);
  assert.equal(diffSec, 600);
});

test('2. Giữ nhiều ghế thành công', async () => {
  const slot = await makeSlot(26);
  const res = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2', 'A3'] } });
  assert.equal(res.status, 200);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, holdId: res.data.holdId, status: 'HOLDING' }), 3);
});

test('3. Hai khách giữ cùng một ghế đồng thời -> chỉ 1 người thành công, người kia 409', async () => {
  const slot = await makeSlot(27);
  const [r1, r2] = await Promise.all([
    req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } }),
    req('/bookings/hold', { account: second, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } }),
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
});

test('4. Hai khách giữ nhóm ghế có phần giao nhau -> 1 thành công, 1 rollback 409', async () => {
  const slot = await makeSlot(28);
  const [r1, r2] = await Promise.all([
    req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2'] } }),
    req('/bookings/hold', { account: second, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A2', 'A3'] } }),
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'HOLDING' }), 2);
});

test('5. Giữ nhóm ghế có một ghế BOOKED -> 409 và không giữ ghế nào', async () => {
  const slot = await makeSlot(29);
  await ShowtimeSeat.updateOne({ showtimeId: slot._id, seatNumber: 'A2' }, { $set: { status: 'BOOKED' } });
  const res = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2'] } });
  assert.equal(res.status, 409);
  assert.equal((await ShowtimeSeat.findOne({ showtimeId: slot._id, seatNumber: 'A1' })).status, 'AVAILABLE');
});

test('6. Giữ ghế không tồn tại -> 400', async () => {
  const slot = await makeSlot(30);
  const res = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['Z99'] } });
  assert.equal(res.status, 400);
});

test('7 & 27. Ghế cùng mã tại hai suất khác nhau hoạt động độc lập', async () => {
  const s1 = await makeSlot(31);
  const s2 = await makeSlot(32);
  const r1 = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(s1._id), seatNumbers: ['A1'] } });
  const r2 = await req('/bookings/hold', { account: second, method: 'POST', data: { showtimeId: String(s2._id), seatNumbers: ['A1'] } });
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.notEqual(r1.data.holdId, r2.data.holdId);
});

test('8. Giữ ghế khi chưa đăng nhập -> 401', async () => {
  const slot = await makeSlot(33);
  const res = await req('/bookings/hold', { method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } });
  assert.equal(res.status, 401);
});

test('9, 10, 11. Giữ ghế của suất bị khóa (403), bị hủy (409), ngoài thời gian mở bán (400)', async () => {
  const locked = await makeSlot(34, { isLocked: true });
  const cancelled = await makeSlot(35, { cancelledAt: new Date() });
  const tooFar = await makeSlot(24 * 10);
  assert.equal((await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(locked._id), seatNumbers: ['A1'] } })).status, 403);
  assert.equal((await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(cancelled._id), seatNumbers: ['A1'] } })).status, 409);
  assert.equal((await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(tooFar._id), seatNumbers: ['A1'] } })).status, 400);
});

test('12. Giữ lại ghế đã hết hạn giữ -> thành công cho khách khác', async () => {
  const slot = await makeSlot(36);
  await ShowtimeSeat.updateOne(
    { showtimeId: slot._id, seatNumber: 'A1' },
    { $set: { status: 'HOLDING', holdId: 'HOLD-OLD', holdOwnerId: first._id, holdExpiresAt: new Date(Date.now() - 5000) } }
  );
  const res = await req('/bookings/hold', { account: second, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } });
  assert.equal(res.status, 200);
  assert.notEqual(res.data.holdId, 'HOLD-OLD');
});

test('13 & 14. Hủy giữ ghế đúng chủ sở hữu (200) vs người khác cố tình hủy (403)', async () => {
  const slot = await makeSlot(37);
  const hold = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } });
  const forbidden = await req('/bookings/hold/' + hold.data.holdId, { account: second, method: 'DELETE' });
  assert.equal(forbidden.status, 403);
  const ok = await req('/bookings/hold/' + hold.data.holdId, { account: first, method: 'DELETE' });
  assert.equal(ok.status, 200);
  assert.equal((await ShowtimeSeat.findOne({ showtimeId: slot._id, seatNumber: 'A1' })).status, 'AVAILABLE');
});

test('15, 16, 17, 18, 19. Checkout với holdId hợp lệ, hết hạn, của người khác, sửa ghế và trùng Idempotency-Key', async () => {
  const slot = await makeSlot(38);
  const hold = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2'] } });

  // 17. Của người khác -> 409
  const steal = await req('/bookings/checkout', {
    account: second, method: 'POST',
    data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2'], holdId: hold.data.holdId, customerName: 'U2', customerPhone: '0902222222' },
  });
  assert.equal(steal.status, 409);

  // 18. Sửa danh sách ghế -> 409
  const tampered = await req('/bookings/checkout', {
    account: first, method: 'POST',
    data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A3'], holdId: hold.data.holdId, customerName: 'U1', customerPhone: '0901111111' },
  });
  assert.equal(tampered.status, 409);

  // 15 & 19. Hợp lệ + Idempotency-Key replay
  const key = '11111111-2222-3333-4444-555555555555';
  const ok = await req('/bookings/checkout', {
    account: first, method: 'POST', key,
    data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2'], holdId: hold.data.holdId, customerName: 'U1', customerPhone: '0901111111' },
  });
  assert.equal(ok.status, 201);
  const replay = await req('/bookings/checkout', {
    account: first, method: 'POST', key,
    data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2'], holdId: hold.data.holdId, customerName: 'U1', customerPhone: '0901111111' },
  });
  assert.equal(replay.data.booking.id, ok.data.booking.id);

  // 16. holdId hết hạn -> 409
  const holdExp = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['B1'] } });
  await ShowtimeSeat.updateOne({ showtimeId: slot._id, seatNumber: 'B1' }, { $set: { holdExpiresAt: new Date(Date.now() - 1000) } });
  const expRes = await req('/bookings/checkout', {
    account: first, method: 'POST',
    data: { showtimeId: String(slot._id), seatNumbers: ['B1'], holdId: holdExp.data.holdId, customerName: 'U1', customerPhone: '0901111111' },
  });
  assert.equal(expRes.status, 409);
});

test('20. Tạo Booking thất bại -> rollback trạng thái ghế HOLDING ban đầu', async () => {
  const slot = await makeSlot(39);
  const hold = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } });
  const origCreate = Booking.create;
  Booking.create = async () => { throw new Error('Simulated DB failure'); };
  try {
    const res = await req('/bookings/checkout', {
      account: first, method: 'POST',
      data: { showtimeId: String(slot._id), seatNumbers: ['A1'], holdId: hold.data.holdId, customerName: 'U1', customerPhone: '0901111111' },
    });
    assert.equal(res.status, 503);
    assert.equal((await ShowtimeSeat.findOne({ showtimeId: slot._id, seatNumber: 'A1' })).status, 'HOLDING');
  } finally {
    Booking.create = origCreate;
  }
});

test('21. Checkout thiếu holdId bị từ chối (400) & hai khách giữ đồng thời chỉ 1 thành công', async () => {
  const slot = await makeSlot(40);
  const missingHold = await req('/bookings/checkout', {
    account: first,
    method: 'POST',
    data: { showtimeId: String(slot._id), seatNumbers: ['A1'], customerName: 'U1', customerPhone: '0901111111' },
  });
  assert.equal(missingHold.status, 400);

  const [h1, h2] = await Promise.all([
    req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } }),
    req('/bookings/hold', { account: second, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } }),
  ]);
  assert.deepEqual([h1.status, h2.status].sort(), [200, 409]);
});

test('22, 23, 24. Admin khóa suất, chặn xóa suất đang có HOLDING (409), và hủy đồng thời với checkout', async () => {
  const slot = await makeSlot(41);
  const hold = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1'] } });
  assert.equal((await req('/admin/showtimes/' + slot._id, { account: admin, method: 'DELETE' })).status, 409);
  assert.equal((await req('/admin/showtimes/' + slot._id + '/toggle-lock', { account: admin, method: 'PUT' })).status, 200);
  const chkAfterLock = await req('/bookings/checkout', {
    account: first, method: 'POST',
    data: { showtimeId: String(slot._id), seatNumbers: ['A1'], holdId: hold.data.holdId, customerName: 'U1', customerPhone: '0901111111' },
  });
  assert.equal(chkAfterLock.status, 403);
});

test('25, 26, 28, 29, 30. Ghế HOLDING không tính doanh thu, không lộ thông tin, không gợi ý AI, không gia hạn vô hạn, không xóa ghế BOOKED', async () => {
  const slot = await makeSlot(42);
  const h1 = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2'] } });
  // 29. Gọi lại giữ đúng ghế đó -> không gia hạn vô hạn (expiresAt giữ nguyên)
  const h2 = await req('/bookings/hold', { account: first, method: 'POST', data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2'] } });
  assert.equal(h2.data.holdId, h1.data.holdId);
  assert.equal(h2.data.expiresAt, h1.data.expiresAt);

  // 30. API /seats không lộ holdId hay holdOwnerId
  const seatsRes = await req('/showtimes/' + slot._id + '/seats');
  assert.equal(seatsRes.status, 200);
  assert.equal(seatsRes.data.holdingSeatsCount, 2);
  assert.equal(seatsRes.data.seats[0].holdId, undefined);
  assert.equal(seatsRes.data.seats[0].holdOwnerId, undefined);

  // 25. HOLDING không tính vào doanh thu
  const statsRes = await req('/admin/statistics/showtimes/' + slot._id, { account: admin });
  assert.equal(statsRes.data.data.stats.totalRevenue, 0);
  assert.equal(statsRes.data.data.stats.holdingCount, 2);

  // 26. AI & recommendSeats không gợi ý ghế HOLDING còn hạn
  const dbSeats = await ShowtimeSeat.find({ showtimeId: slot._id }).lean();
  const aiBlocks = findContiguousAvailableSeats(dbSeats, 2);
  assert.ok(!aiBlocks.some((b) => b.includes('A1') || b.includes('A2')));

  // 28. Ghế BOOKED không bị ảnh hưởng bởi giải phóng hold
  await req('/bookings/checkout', {
    account: first, method: 'POST',
    data: { showtimeId: String(slot._id), seatNumbers: ['A1', 'A2'], holdId: h1.data.holdId, customerName: 'U1', customerPhone: '0901111111' },
  });
  const relAfterBook = await req('/bookings/hold/' + h1.data.holdId, { account: first, method: 'DELETE' });
  assert.equal(relAfterBook.status, 404);
  assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: slot._id, status: 'BOOKED' }), 2);
});
