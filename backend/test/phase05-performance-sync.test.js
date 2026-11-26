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
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import User from '../src/models/User.js';

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
  return {
    status: res.status,
    headers: res.headers,
    bytes: Buffer.byteLength(text, 'utf8'),
    body: text ? JSON.parse(text) : null,
  };
}

async function createTestShowtime(offsetHours = 36) {
  const startTime = new Date(Date.now() + offsetHours * 3600 * 1000);
  const st = await Showtime.create({
    movieId: movie._id,
    cinemaId: cinema._id,
    roomId: room._id,
    roomName: room.name,
    startTime,
    endTime: new Date(startTime.getTime() + 150 * 60000),
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

before(async () => {
  process.env.JWT_SECRET = 'phase05-isolated-secret';
  const { MongoMemoryReplSet } = createRequire(import.meta.url)(modulePath);
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('davenor_phase05'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const password = await bcrypt.hash('Phase05Pass!', 4);
  [userA, userB] = await User.create([
    { name: 'User A', email: 'p5a@test.com', phone: '0905550001', password },
    { name: 'User B', email: 'p5b@test.com', phone: '0905550002', password },
  ]);
  admin = await AdminUser.create({ name: 'Admin P5', email: 'p5admin@test.com', password });
  cinema = await Cinema.create({ name: "D'AVENOR Thanh Khê Plaza", address: 'Thanh Khê, Đà Nẵng' });
  room = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 01 - IMAX Laser',
    shortName: 'P01',
    roomType: 'IMAX Laser',
    totalSeats: 88,
  });
  movie = await Movie.create({
    title: 'Phase 5 Perf Movie',
    posterUrl: '/p5.jpg',
    genre: 'Sci-Fi',
    duration: 150,
    description: 'Long movie description '.repeat(60),
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

test('P5-1: GET /api/showtimes/:id/seats?lite=1 reduces payload significantly and isolates isHeldByMe per user', async () => {
  const st = await createTestShowtime(30);

  // User A holds E5
  const holdRes = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['E5'] },
  });
  assert.equal(holdRes.status, 200);

  const fullA = await apiReq(`/api/showtimes/${st._id}/seats`, { account: userA });
  const liteA = await apiReq(`/api/showtimes/${st._id}/seats?lite=1`, { account: userA });
  const liteB = await apiReq(`/api/showtimes/${st._id}/seats?lite=1`, { account: userB });

  assert.equal(fullA.status, 200);
  assert.equal(liteA.status, 200);
  assert.equal(liteA.body.lite, true);
  assert.equal(liteA.headers.get('cache-control'), 'no-store');
  assert.ok(liteA.bytes < fullA.bytes * 0.5, `Expected lite (${liteA.bytes}B) < 50% of full (${fullA.bytes}B)`);

  const seatA = liteA.body.seats.find((s) => s.seatNumber === 'E5');
  const seatB = liteB.body.seats.find((s) => s.seatNumber === 'E5');
  assert.equal(seatA.status, 'HOLDING');
  assert.equal(seatA.isHeldByMe, true);
  assert.equal(seatB.status, 'HOLDING');
  assert.equal(seatB.isHeldByMe, undefined);
  assert.equal(seatB.holdId, undefined);
  assert.equal(seatB.holdOwnerId, undefined);
});

test('P5-2: True concurrent 2-user hold via Promise.all allows exactly 1 winner', async () => {
  const st = await createTestShowtime(34);
  const [resA, resB] = await Promise.all([
    apiReq('/api/bookings/hold', { account: userA, method: 'POST', data: { showtimeId: st._id, seatNumbers: ['F6'] } }),
    apiReq('/api/bookings/hold', { account: userB, method: 'POST', data: { showtimeId: st._id, seatNumbers: ['F6'] } }),
  ]);

  const statuses = [resA.status, resB.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 409]);
});

test('P5-3: Near-expiry hold succeeds before deadline and fails after deadline', async () => {
  const st = await createTestShowtime(38);
  const hold1 = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['D5'] },
  });
  assert.equal(hold1.status, 200);

  // Move holdExpiresAt to +1500ms (still valid, near expiry) -> checkout succeeds
  await ShowtimeSeat.updateOne(
    { showtimeId: st._id, seatNumber: 'D5' },
    { $set: { holdExpiresAt: new Date(Date.now() + 1500) } }
  );
  const ckOk = await apiReq('/api/bookings/checkout', {
    account: userA,
    method: 'POST',
    key: crypto.randomUUID(),
    data: {
      showtimeId: st._id,
      seatNumbers: ['D5'],
      holdId: hold1.body.holdId,
      paymentMethod: 'MOMO',
      popcornFlavor: 'sweet',
      combos: [],
      customerName: 'User A',
      customerPhone: '0905550001',
      customerEmail: 'p5a@test.com',
    },
  });
  assert.equal(ckOk.status, 201);

  // Now hold D6 and move holdExpiresAt to -100ms (just expired) -> checkout fails
  const hold2 = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['D6'] },
  });
  assert.equal(hold2.status, 200);
  await ShowtimeSeat.updateOne(
    { showtimeId: st._id, seatNumber: 'D6' },
    { $set: { holdExpiresAt: new Date(Date.now() - 100) } }
  );
  const ckExpired = await apiReq('/api/bookings/checkout', {
    account: userA,
    method: 'POST',
    key: crypto.randomUUID(),
    data: {
      showtimeId: st._id,
      seatNumbers: ['D6'],
      holdId: hold2.body.holdId,
      paymentMethod: 'MOMO',
      popcornFlavor: 'sweet',
      combos: [],
      customerName: 'User A',
      customerPhone: '0905550001',
      customerEmail: 'p5a@test.com',
    },
  });
  assert.ok(ckExpired.status >= 400);
});

test('P5-4: Simulated network drop after Booking creation recovers exact Booking via Idempotency-Key', async () => {
  const st = await createTestShowtime(42);
  const hold = await apiReq('/api/bookings/hold', {
    account: userA,
    method: 'POST',
    data: { showtimeId: st._id, seatNumbers: ['G5'] },
  });
  assert.equal(hold.status, 200);

  const idemKey = crypto.randomUUID();
  const payload = {
    showtimeId: st._id,
    seatNumbers: ['G5'],
    holdId: hold.body.holdId,
    paymentMethod: 'MOMO',
    popcornFlavor: 'sweet',
    combos: [],
    customerName: 'User A',
    customerPhone: '0905550001',
    customerEmail: 'p5a@test.com',
  };

  // First request commits Booking on server
  const firstAttempt = await apiReq('/api/bookings/checkout', {
    account: userA,
    method: 'POST',
    key: idemKey,
    data: payload,
  });
  assert.equal(firstAttempt.status, 201);

  // Client retries with same Idempotency-Key after simulated network timeout
  const retryAttempt = await apiReq('/api/bookings/checkout', {
    account: userA,
    method: 'POST',
    key: idemKey,
    data: payload,
  });
  assert.ok([200, 201].includes(retryAttempt.status));
  assert.equal(retryAttempt.body.booking._id, firstAttempt.body.booking._id);

  const count = await Booking.countDocuments({ showtimeId: st._id });
  assert.equal(count, 1, 'Must not duplicate Booking on Idempotency-Key retry');
});

test('P5-5: MongoDB compound indexes eliminate in-memory SORT for ShowtimeSeat and Booking queries', async () => {
  const st = await createTestShowtime(46);

  const seatExplain = await ShowtimeSeat.find({ showtimeId: st._id })
    .sort({ row: 1, col: 1 })
    .lean()
    .explain('executionStats');
  const bookingExplain = await Booking.find({
    showtimeId: st._id,
    status: 'PAID',
    paymentStatus: { $in: ['VERIFIED', 'SIMULATED'] },
  })
    .sort({ createdAt: -1 })
    .lean()
    .explain('executionStats');

  const hasSort = (plan) => {
    let node = plan;
    while (node) {
      if (node.stage === 'SORT') return true;
      node = node.inputStage || (node.inputStages && node.inputStages[0]);
    }
    return false;
  };

  assert.equal(hasSort(seatExplain.queryPlanner.winningPlan), false, 'ShowtimeSeat query should not use in-memory SORT');
  assert.equal(hasSort(bookingExplain.queryPlanner.winningPlan), false, 'Booking query should not use in-memory SORT');
});
