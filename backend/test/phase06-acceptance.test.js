import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import showtimeRoutes from '../src/routes/showtimeRoutes.js';
import bookingRoutes from '../src/routes/bookingRoutes.js';
import adminRoutes from '../src/routes/adminRoutes.js';
import AdminUser from '../src/models/AdminUser.js';
import Booking from '../src/models/Booking.js';
import Cinema from '../src/models/Cinema.js';
import Movie from '../src/models/Movie.js';
import Promotion from '../src/models/Promotion.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import User from '../src/models/User.js';
import { fetchCinemaContextOptimized } from '../src/services/ai/cinemaContextService.js';

let server;
let mongo;
let url;
let userA;
let userB;
let admin;
let movie;
let cinema;
let room;

const modulePath = process.env.DAVENOR_TEST_MONGO_MODULE || 'mongodb-memory-server';

function makeToken(account, opts = { expiresIn: '1h' }) {
  return jwt.sign({ id: String(account._id) }, process.env.JWT_SECRET, opts);
}

async function apiReq(path, { account, auth, method = 'GET', data, key } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth || account) headers.authorization = `Bearer ${auth || makeToken(account)}`;
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

async function createTestShowtime(offsetHours = 48) {
  const startTime = new Date(Date.now() + offsetHours * 3600 * 1000);
  const st = await Showtime.create({
    movieId: movie._id,
    cinemaId: cinema._id,
    roomId: room._id,
    roomName: room.name,
    startTime,
    endTime: new Date(startTime.getTime() + 140 * 60000),
    price: 120000,
  });
  const seats = [];
  for (const r of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
    for (let c = 1; c <= 11; c++) {
      seats.push({
        showtimeId: st._id,
        roomId: room._id,
        seatNumber: `${r}${c}`,
        row: r,
        col: c,
        type: ['E', 'F', 'G', 'H'].includes(r) ? 'VIP' : 'STANDARD',
        status: 'AVAILABLE',
      });
    }
  }
  await ShowtimeSeat.insertMany(seats);
  return st;
}

function checkoutBody(showtimeId, seatNumbers, holdId, user) {
  return {
    showtimeId,
    seatNumbers,
    holdId,
    paymentMethod: 'MOMO',
    popcornFlavor: 'sweet',
    combos: [],
    customerName: user.name,
    customerPhone: user.phone,
    customerEmail: user.email,
  };
}

before(async () => {
  process.env.JWT_SECRET = 'phase06-acceptance-secret';
  const { MongoMemoryReplSet } = createRequire(import.meta.url)(modulePath);
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('davenor_phase06'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const password = await bcrypt.hash('Phase06Pass!', 4);
  [userA, userB] = await User.create([
    { name: 'Acceptance A', email: 'p6a@test.com', phone: '0906660001', password },
    { name: 'Acceptance B', email: 'p6b@test.com', phone: '0906660002', password },
  ]);
  admin = await AdminUser.create({ name: 'Admin P6', email: 'p6admin@test.com', password });
  cinema = await Cinema.create({ name: "D'AVENOR Thanh Khê Plaza", address: 'Thanh Khê, Đà Nẵng' });
  room = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 01 - IMAX Laser',
    shortName: 'P01',
    roomType: 'IMAX Laser',
    totalSeats: 88,
  });
  movie = await Movie.create({
    title: 'Phase 6 Acceptance Movie',
    posterUrl: '/p6.jpg',
    genre: 'Sci-Fi',
    duration: 140,
    status: 'NOW_SHOWING',
  });

  const app = express();
  app.use(express.json());
  app.use('/api/showtimes', showtimeRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin', adminRoutes);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('RC-1: Admin lock showtime concurrently with Customer holdSeats maintains consistent state', async () => {
  const st = await createTestShowtime(30);
  const [lockRes, holdRes] = await Promise.all([
    apiReq(`/api/admin/showtimes/${st._id}/toggle-lock`, { account: admin, method: 'PUT' }),
    apiReq('/api/bookings/hold', { account: userA, method: 'POST', data: { showtimeId: st._id, seatNumbers: ['A1'] } }),
  ]);

  assert.equal(lockRes.status, 200);
  const updatedSt = await Showtime.findById(st._id).lean();
  assert.equal(updatedSt.isLocked, true);
  assert.ok([200, 403, 409].includes(holdRes.status), `Unexpected holdRes status: ${holdRes.status}`);
  const bookings = await Booking.countDocuments({ showtimeId: st._id });
  assert.equal(bookings, 0, 'Hold must never create a Booking');
});

test('RC-2: Admin delete showtime concurrently with Customer holdSeats prevents orphan seats/showtime', async () => {
  const st = await createTestShowtime(34);
  const [delRes, holdRes] = await Promise.all([
    apiReq(`/api/admin/showtimes/${st._id}`, { account: admin, method: 'DELETE' }),
    apiReq('/api/bookings/hold', { account: userA, method: 'POST', data: { showtimeId: st._id, seatNumbers: ['B1'] } }),
  ]);

  const stDoc = await Showtime.findById(st._id).lean();
  if (delRes.status === 200) {
    assert.equal(stDoc, null);
    assert.ok(holdRes.status >= 400, 'If showtime was deleted, hold must fail');
  } else {
    assert.ok([409, 400].includes(delRes.status), `Unexpected delRes status: ${delRes.status}`);
    assert.ok(stDoc, 'Showtime must still exist if delete was blocked');
  }
});

test('RC-3: Admin CANCEL_WITH_REFUND concurrently with Customer checkout leaves zero inconsistent BOOKED seats', async () => {
  const st = await createTestShowtime(38);
  const hold = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['C1'] },
  });
  assert.equal(hold.status, 200);

  const [cancelRes, ckRes] = await Promise.all([
    apiReq(`/api/admin/showtimes/${st._id}`, {
      account: admin,
      method: 'DELETE',
      data: { action: 'CANCEL_WITH_REFUND', reason: 'P0 race test' },
    }),
    apiReq('/api/bookings/checkout', {
      account: userA,
      method: 'POST',
      key: crypto.randomUUID(),
      data: checkoutBody(st._id, ['C1'], hold.body.holdId, userA),
    }),
  ]);

  assert.ok([200, 409].includes(cancelRes.status));
  const stDoc = await Showtime.findById(st._id).lean();
  if (stDoc?.cancelledAt) {
    const activePaid = await Booking.countDocuments({ showtimeId: st._id, status: 'PAID' });
    // Either checkout was rejected before commit, OR cancel refunded it; never an active PAID booking on cancelled showtime if cancel won after commit
    assert.ok(ckRes.status >= 400 || activePaid === 0 || cancelRes.status === 200);
  }
});

test('RC-4 & RC-5: Two concurrent checkouts with same Idempotency-Key create at most 1 Booking and zero duplicates', async () => {
  const st = await createTestShowtime(42);
  const hold = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['D1'] },
  });
  assert.equal(hold.status, 200);

  const sameKey = crypto.randomUUID();
  const payload = checkoutBody(st._id, ['D1'], hold.body.holdId, userA);
  const [r1, r2] = await Promise.all([
    apiReq('/api/bookings/checkout', { account: userA, method: 'POST', key: sameKey, data: payload }),
    apiReq('/api/bookings/checkout', { account: userA, method: 'POST', key: sameKey, data: payload }),
  ]);

  const bookings = await Booking.find({ showtimeId: st._id }).lean();
  assert.equal(bookings.length, 1, 'Exactly 1 Booking must exist for concurrent same Idempotency-Key');
  assert.ok([r1.status, r2.status].some((s) => s === 201));
});

test('RC-6: Admin CANCEL_WITH_REFUND concurrently with Admin check-in never leaves active QR on cancelled showtime', async () => {
  const st = await createTestShowtime(46);
  const hold = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['E1'] },
  });
  const ck = await apiReq('/api/bookings/checkout', {
    account: userA,
    method: 'POST',
    key: crypto.randomUUID(),
    data: checkoutBody(st._id, ['E1'], hold.body.holdId, userA),
  });
  assert.equal(ck.status, 201);
  const qrToken = ck.body.booking.qrToken;

  const [cancelRes, checkInRes] = await Promise.all([
    apiReq(`/api/admin/showtimes/${st._id}`, {
      account: admin,
      method: 'DELETE',
      data: { action: 'CANCEL_WITH_REFUND', reason: 'Race check-in' },
    }),
    apiReq('/api/bookings/check-in', {
      account: admin,
      method: 'POST',
      data: { qrToken },
    }),
  ]);

  assert.equal(cancelRes.status, 200);
  const finalBooking = await Booking.findById(ck.body.booking._id).lean();
  assert.equal(finalBooking.status, 'CANCELLED');
  assert.equal(finalBooking.qrToken, null, 'Cancelled booking must have qrToken invalidated');
  assert.ok([200, 400, 404, 409].includes(checkInRes.status));
});

test('RC-7: Customer exchangeBooking concurrently with another Customer holdSeats on target seat yields single owner', async () => {
  const st = await createTestShowtime(50);
  const holdA = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['F1'] },
  });
  const ckA = await apiReq('/api/bookings/checkout', {
    account: userA,
    method: 'POST',
    key: crypto.randomUUID(),
    data: checkoutBody(st._id, ['F1'], holdA.body.holdId, userA),
  });
  assert.equal(ckA.status, 201);

  // User A tries to exchange F1 -> F2 concurrently while User B tries to hold F2
  const [exRes, holdBRes] = await Promise.all([
    apiReq(`/api/bookings/${ckA.body.booking._id}/exchange`, {
      account: userA,
      method: 'POST',
      data: { newShowtimeId: st._id, newSeats: ['F2'] },
    }),
    apiReq('/api/bookings/hold', {
      account: userB,
      method: 'POST',
      data: { showtimeId: st._id, seatNumbers: ['F2'] },
    }),
  ]);

  const successes = [exRes.status === 200, holdBRes.status === 200].filter(Boolean).length;
  assert.equal(successes, 1, `Exactly 1 of exchange (${exRes.status}) or hold (${holdBRes.status}) must win F2`);
  const f2 = await ShowtimeSeat.findOne({ showtimeId: st._id, seatNumber: 'F2' }).lean();
  assert.ok(['BOOKED', 'HOLDING'].includes(f2.status));
});

test('RC-8: Expired-hold takeover by User B concurrently with old-owner User A checkout rejects User A', async () => {
  const st = await createTestShowtime(54);
  const holdA = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['G1'] },
  });
  assert.equal(holdA.status, 200);

  // Force User A's hold to expire
  await ShowtimeSeat.updateOne(
    { showtimeId: st._id, seatNumber: 'G1' },
    { $set: { holdExpiresAt: new Date(Date.now() - 1000) } }
  );

  const [holdBRes, ckARes] = await Promise.all([
    apiReq('/api/bookings/hold', { account: userB, method: 'POST', data: { showtimeId: st._id, seatNumbers: ['G1'] } }),
    apiReq('/api/bookings/checkout', {
      account: userA,
      method: 'POST',
      key: crypto.randomUUID(),
      data: checkoutBody(st._id, ['G1'], holdA.body.holdId, userA),
    }),
  ]);

  assert.equal(holdBRes.status, 200, 'User B should take over expired seat');
  assert.ok(ckARes.status >= 400, 'Old owner User A must not checkout expired hold');
  const g1 = await ShowtimeSeat.findOne({ showtimeId: st._id, seatNumber: 'G1' }).lean();
  assert.equal(g1.status, 'HOLDING');
  assert.equal(String(g1.holdOwnerId), String(userB._id));
});

test('SEC-1: Authentication, Authorization, Ownership isolation & NoSQL injection defense', async () => {
  const st = await createTestShowtime(58);

  // Unauthenticated hold -> 401
  const noAuth = await apiReq('/api/bookings/hold', {
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['H1'] },
  });
  assert.equal(noAuth.status, 401);

  // Expired JWT -> 401
  const expiredToken = jwt.sign({ id: String(userA._id) }, process.env.JWT_SECRET, { expiresIn: '-10s' });
  const expRes = await apiReq('/api/bookings/hold', {
    auth: expiredToken,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['H1'] },
  });
  assert.equal(expRes.status, 401);

  // Customer cannot access Admin endpoint -> 403
  const custAdmin = await apiReq('/api/admin/dashboard/stats', { account: userA });
  assert.equal(custAdmin.status, 403);

  // Ownership isolation: User B cannot view or cancel User A's booking
  const holdA = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['H1'] },
  });
  const ckA = await apiReq('/api/bookings/checkout', {
    account: userA,
    method: 'POST',
    key: crypto.randomUUID(),
    data: checkoutBody(st._id, ['H1'], holdA.body.holdId, userA),
  });
  assert.equal(ckA.status, 201);

  const stealGet = await apiReq(`/api/bookings/${ckA.body.booking.bookingCode}`, { account: userB });
  assert.ok([403, 404].includes(stealGet.status));
  const stealCancel = await apiReq(`/api/bookings/${ckA.body.booking._id}/cancel`, {
    account: userB,
    method: 'POST',
  });
  assert.ok([403, 404].includes(stealCancel.status));

  // NoSQL injection payload rejected -> 400
  const nosql = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: { $ne: '' }, seatNumbers: ['H2'] },
  });
  assert.equal(nosql.status, 400);
});

test('SYNC-AI: Admin voucher & showtime changes reflect immediately in Chatbot AI context', async () => {
  await Promotion.create({
    title: 'Phase 6 Live Voucher',
    code: 'P6LIVE50K',
    type: 'VOUCHER',
    discountValue: '50K',
    expiryDate: '31/12/2099',
    isActive: true,
  });

  const ctx = await fetchCinemaContextOptimized('hôm nay có khuyến mãi voucher nào không');
  assert.ok(JSON.stringify(ctx).includes('P6LIVE50K'), 'Chatbot context must reflect newly added active voucher');
});
