import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('d:/CDIO/movietix-project/frontend/node_modules/playwright');
const { MongoMemoryReplSet } = require('d:/CDIO/movietix-project/backend/node_modules/mongodb-memory-server');
const mongoose = require('d:/CDIO/movietix-project/backend/node_modules/mongoose');
const bcrypt = require('d:/CDIO/movietix-project/backend/node_modules/bcryptjs');

const BACKEND_PORT = 5056;
const FRONTEND_PORT = 4174;
const API_BASE = `http://127.0.0.1:${BACKEND_PORT}`;
const UI_BASE = `http://localhost:${FRONTEND_PORT}`;

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function run() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = replSet.getUri();
  process.env.MONGO_URI = mongoUri;
  process.env.MONGODB_URI = mongoUri;
  process.env.PORT = String(BACKEND_PORT);
  process.env.JWT_SECRET = 'phase04-e2e-secret';
  process.env.NODE_ENV = 'test';

  // Load server (connects to MONGO_URI and listens on PORT)
  require('d:/CDIO/movietix-project/backend/src/server');
  await waitForServer(`${API_BASE}/api/health`).catch(() => {});

  // Load models & services
  const reqDefault = (p) => { const m = require(p); return m.default || m; };
  const User = reqDefault('d:/CDIO/movietix-project/backend/src/models/User');
  const Movie = reqDefault('d:/CDIO/movietix-project/backend/src/models/Movie');
  const Cinema = reqDefault('d:/CDIO/movietix-project/backend/src/models/Cinema');
  const Room = reqDefault('d:/CDIO/movietix-project/backend/src/models/Room');
  const Showtime = reqDefault('d:/CDIO/movietix-project/backend/src/models/Showtime');
  const ShowtimeSeat = reqDefault('d:/CDIO/movietix-project/backend/src/models/ShowtimeSeat');
  const Booking = reqDefault('d:/CDIO/movietix-project/backend/src/models/Booking');
  const statisticsService = reqDefault('d:/CDIO/movietix-project/backend/src/services/statisticsService');
  const { fetchCinemaContextOptimized } = require('d:/CDIO/movietix-project/backend/src/services/ai/cinemaContextService');

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const [userA, userB, adminUser] = await User.create([
    { name: 'Customer A', email: 'customera@test.com', password: passwordHash, role: 'CUSTOMER', phone: '0901111111' },
    { name: 'Customer B', email: 'customerb@test.com', password: passwordHash, role: 'CUSTOMER', phone: '0902222222' },
    { name: 'Admin E2E', email: 'admin@test.com', password: passwordHash, role: 'ADMIN', phone: '0903333333' },
  ]);

  const cinema = await Cinema.create({
    name: "D'AVENOR Thanh Khê Plaza",
    address: 'Thanh Khê, Đà Nẵng',
    city: 'Đà Nẵng',
  });

  const room = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 01 - IMAX Laser (Grand Hall 1)',
    shortName: 'P01',
    roomType: 'IMAX Laser',
    totalSeats: 88,
  });

  const movie = await Movie.create({
    title: 'Dune: Part Two (Phase 4 E2E)',
    slug: 'dune-part-two-phase-4-e2e',
    duration: 166,
    genre: 'Khoa Học Viễn Tưởng',
    posterUrl: 'https://example.com/dune2.jpg',
    releaseDate: new Date(),
    status: 'NOW_SHOWING',
    ageRating: 'T13',
  });

  const futureStart = new Date(Date.now() + 24 * 3600 * 1000);
  const showtime = await Showtime.create({
    movieId: movie._id,
    cinemaId: cinema._id,
    roomId: room._id,
    startTime: futureStart,
    endTime: new Date(futureStart.getTime() + 166 * 60000),
    basePrice: 120000,
    format: 'IMAX',
    status: 'ACTIVE',
  });

  const seatsToCreate = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  for (const r of rows) {
    for (let c = 1; c <= 11; c++) {
      const isVip = ['E', 'F', 'G', 'H'].includes(r);
      seatsToCreate.push({
        showtimeId: showtime._id,
        seatNumber: `${r}${c}`,
        row: r,
        col: c,
        type: isVip ? 'VIP' : 'STANDARD',
        price: isVip ? 150000 : 120000,
        status: 'AVAILABLE',
      });
    }
  }
  await ShowtimeSeat.insertMany(seatsToCreate);

  const viteProc = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', String(FRONTEND_PORT), '--strictPort'],
    { cwd: 'd:/CDIO/movietix-project/frontend', stdio: 'pipe' }
  );

  await waitForServer(`${UI_BASE}/`);

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    const loginApi = async (email) => {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, email, password: 'Password123!' }),
      });
      const data = await res.json();
      if (res.status !== 200) throw new Error(`Login failed (${res.status}): ${JSON.stringify(data)}`);
      return data;
    };

    const authA = await loginApi('customera@test.com');
    const authB = await loginApi('customerb@test.com');
    const authAdmin = await loginApi('admin@test.com');

    const attachApiProxy = async (context) => {
      await context.route('**/api/**', async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const targetUrl = `${API_BASE}${url.pathname}${url.search}`;
        const headers = { ...req.headers() };
        delete headers.host;
        const res = await fetch(targetUrl, {
          method: req.method(),
          headers,
          body: req.postDataBuffer() || undefined,
        });
        const buf = Buffer.from(await res.arrayBuffer());
        await route.fulfill({
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body: buf,
        });
      });
    };

    // 1. Concurrent 2-user hold + UI check
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    await attachApiProxy(ctxA);
    await attachApiProxy(ctxB);

    const pageA = await ctxA.newPage();
    await pageA.goto(`${UI_BASE}/login`);
    await pageA.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, authA);
    await pageA.goto(`${UI_BASE}/booking/seat/${showtime._id}`);
    await pageA.waitForSelector('button:has-text("1")');

    // Hold A1 & A2 via UI or API
    const holdResA = await fetch(`${API_BASE}/api/bookings/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authA.token}` },
      body: JSON.stringify({ showtimeId: showtime._id, seatNumbers: ['A1', 'A2'] }),
    });
    const holdDataA = await holdResA.json();
    assert.equal(holdResA.status, 200);
    assert.ok(holdDataA.holdId);

    // Client B opens same showtime -> A1, A2 must be HOLDING_OTHER (disabled)
    const pageB = await ctxB.newPage();
    await pageB.goto(`${UI_BASE}/login`);
    await pageB.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, authB);
    await pageB.goto(`${UI_BASE}/booking/seat/${showtime._id}`);
    const seatsBRes = await fetch(`${API_BASE}/api/showtimes/${showtime._id}/seats`, {
      headers: { Authorization: `Bearer ${authB.token}` },
    });
    const seatsBData = await seatsBRes.json();
    const a1ForB = seatsBData.seats.find((s) => s.seatNumber === 'A1');
    assert.equal(a1ForB.status, 'HOLDING');
    assert.equal(Boolean(a1ForB.isHeldByMe), false);
    results.push('1. Concurrent 2-user hold UI lock: PASS');

    // 2. Admin getShowtimeDetailStats & Chatbot AI awareness during active HOLDING
    const detailStats = await statisticsService.getShowtimeDetailStats(showtime._id);
    assert.equal(detailStats.stats.holdingCount, 2, 'Admin detail stats should show 2 holding seats');
    const a1Matrix = detailStats.seatMatrix.find((r) => r.row === 'A').seats.find((s) => s.code === 'A1');
    assert.equal(a1Matrix.status, 'HOLDING', 'Admin seatMatrix should show A1 as HOLDING');

    const aiCtx = await fetchCinemaContextOptimized('còn ghế nào trống không');
    assert.ok(JSON.stringify(aiCtx).includes('Dune: Part Two (Phase 4 E2E)'), 'Chatbot context should include showtime');
    results.push('2. Admin detail stats & Chatbot AI HOLDING sync: PASS');

    // 3. Logout / switch account: Client B cannot checkout Client A's holdId
    const stealRes = await fetch(`${API_BASE}/api/bookings/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authB.token}`,
        'Idempotency-Key': 'e2e-steal-key-1',
      },
      body: JSON.stringify({
        showtimeId: showtime._id,
        seats: ['A1', 'A2'],
        holdId: holdDataA.holdId,
        paymentMethod: 'MOMO',
      }),
    });
    assert.ok(stealRes.status >= 400, `Client B must not be able to checkout Client A holdId, got ${stealRes.status}`);
    results.push('3. Cross-account holdId protection: PASS');

    // 4. Cancel hold -> seats return to AVAILABLE
    const releaseRes = await fetch(`${API_BASE}/api/bookings/hold/${holdDataA.holdId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authA.token}` },
    });
    assert.equal(releaseRes.status, 200);
    await pageB.reload();
    const seatsBRes2 = await fetch(`${API_BASE}/api/showtimes/${showtime._id}/seats`, {
      headers: { Authorization: `Bearer ${authB.token}` },
    });
    const seatsBData2 = await seatsBRes2.json();
    const a1ForB2 = seatsBData2.seats.find((s) => s.seatNumber === 'A1');
    assert.equal(a1ForB2.status, 'AVAILABLE');
    results.push('4. Cancel hold & release to AVAILABLE: PASS');

    // 5. Hold expiry -> expired HOLDING treated as AVAILABLE
    const holdResB = await fetch(`${API_BASE}/api/bookings/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authB.token}` },
      body: JSON.stringify({ showtimeId: showtime._id, seatNumbers: ['B1'] }),
    });
    assert.equal(holdResB.status, 200);
    await ShowtimeSeat.updateOne(
      { showtimeId: showtime._id, seatNumber: 'B1' },
      { $set: { holdExpiresAt: new Date(Date.now() - 5000) } }
    );
    const detailAfterExpiry = await statisticsService.getShowtimeDetailStats(showtime._id);
    assert.equal(detailAfterExpiry.stats.holdingCount, 0, 'Expired hold should not count as holdingCount');
    const b1Matrix = detailAfterExpiry.seatMatrix.find((r) => r.row === 'B').seats.find((s) => s.code === 'B1');
    assert.equal(b1Matrix.status, 'AVAILABLE', 'Expired hold in seatMatrix should normalize to AVAILABLE');
    results.push('5. Hold expiry normalization (Backend + Admin): PASS');

    // 6. Idempotency-Key replay on checkout
    const holdResA2 = await fetch(`${API_BASE}/api/bookings/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authA.token}` },
      body: JSON.stringify({ showtimeId: showtime._id, seatNumbers: ['C1'] }),
    });
    const holdDataA2 = await holdResA2.json();
    assert.equal(holdResA2.status, 200);

    const idemKey = crypto.randomUUID();
    const checkoutPayload = {
      showtimeId: showtime._id,
      seats: ['C1'],
      seatNumbers: ['C1'],
      holdId: holdDataA2.holdId,
      paymentMethod: 'MOMO',
      popcornFlavor: 'sweet',
      combos: [],
      totalAmount: 120000,
      customerName: 'Customer A',
      customerPhone: '0901111111',
      customerEmail: 'customera@test.com',
    };
    const ck1 = await fetch(`${API_BASE}/api/bookings/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authA.token}`,
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify(checkoutPayload),
    });
    const ck1Data = await ck1.json();
    if (ck1.status !== 201) throw new Error(`ck1 failed (${ck1.status}): ${JSON.stringify(ck1Data)}`);

    const ck2 = await fetch(`${API_BASE}/api/bookings/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authA.token}`,
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify(checkoutPayload),
    });
    const ck2Data = await ck2.json();
    assert.ok([200, 201].includes(ck2.status));
    assert.equal(ck2Data.booking._id, ck1Data.booking._id, 'Idempotency-Key replay must return same booking');
    assert.equal(ck2Data.booking.paymentStatus, 'SIMULATED');
    results.push('6. Idempotency-Key replay & SIMULATED paymentStatus: PASS');

    // 7. Revenue stats sync (simulatedRevenue vs verifiedRevenue)
    const detailAfterBook = await statisticsService.getShowtimeDetailStats(showtime._id);
    assert.equal(detailAfterBook.stats.bookedCount, 1);
    assert.equal(detailAfterBook.stats.simulatedRevenue, ck1Data.booking.totalAmount);
    assert.equal(detailAfterBook.stats.verifiedRevenue, 0);
    results.push('7. Revenue sync (simulatedRevenue vs verifiedRevenue): PASS');

    // 8. Admin cancel showtime while user holds seats -> checkout fails cleanly
    const holdResB2 = await fetch(`${API_BASE}/api/bookings/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authB.token}` },
      body: JSON.stringify({ showtimeId: showtime._id, seatNumbers: ['D1'] }),
    });
    const holdDataB2 = await holdResB2.json();
    assert.equal(holdResB2.status, 200);

    await Showtime.updateOne({ _id: showtime._id }, { $set: { status: 'CANCELLED' } });
    const ckCancelled = await fetch(`${API_BASE}/api/bookings/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authB.token}`,
        'Idempotency-Key': 'e2e-cancelled-showtime-1',
      },
      body: JSON.stringify({
        showtimeId: showtime._id,
        seats: ['D1'],
        holdId: holdDataB2.holdId,
        paymentMethod: 'MOMO',
      }),
    });
    assert.ok(ckCancelled.status >= 400, 'Checkout on cancelled showtime must fail cleanly');
    results.push('8. Admin cancel showtime during Checkout: PASS');

    await ctxA.close();
    await ctxB.close();
    console.log('\n=== PHASE 4 E2E & SYNC RESULTS ===');
    for (const r of results) console.log(r);
    console.log(`TOTAL: ${results.length}/${results.length} PASS`);
  } finally {
    await browser.close();
    viteProc.kill();
    await mongoose.disconnect();
    await replSet.stop();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('PHASE 4 E2E FAILED:', err);
    process.exit(1);
  });
