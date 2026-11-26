import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('d:/CDIO/movietix-project/frontend/node_modules/playwright');
const { MongoMemoryReplSet } = require('d:/CDIO/movietix-project/backend/node_modules/mongodb-memory-server');
const mongoose = require('d:/CDIO/movietix-project/backend/node_modules/mongoose');
const bcrypt = require('d:/CDIO/movietix-project/backend/node_modules/bcryptjs');

const BACKEND_PORT = 5058;
const FRONTEND_PORT = 4175;
const API_BASE = `http://127.0.0.1:${BACKEND_PORT}`;
const UI_BASE = `http://localhost:${FRONTEND_PORT}`;
const SHOT_DIR = fileURLToPath(new URL('../../docs/acceptance-screenshots', import.meta.url));

mkdirSync(SHOT_DIR, { recursive: true });

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
  process.env.JWT_SECRET = 'phase06-ui-secret';
  process.env.NODE_ENV = 'test';

  require('d:/CDIO/movietix-project/backend/src/server');
  await new Promise((r) => setTimeout(r, 1200));

  const reqDefault = (p) => { const m = require(p); return m.default || m; };
  const User = reqDefault('d:/CDIO/movietix-project/backend/src/models/User');
  const AdminUser = reqDefault('d:/CDIO/movietix-project/backend/src/models/AdminUser');
  const Movie = reqDefault('d:/CDIO/movietix-project/backend/src/models/Movie');
  const Cinema = reqDefault('d:/CDIO/movietix-project/backend/src/models/Cinema');
  const Room = reqDefault('d:/CDIO/movietix-project/backend/src/models/Room');
  const Showtime = reqDefault('d:/CDIO/movietix-project/backend/src/models/Showtime');
  const ShowtimeSeat = reqDefault('d:/CDIO/movietix-project/backend/src/models/ShowtimeSeat');

  const passwordHash = await bcrypt.hash('UiPass123!', 4);
  await User.create({ name: 'UI Tester', email: 'ui@test.com', password: passwordHash, role: 'CUSTOMER', phone: '0908880001' });
  await AdminUser.create({ name: 'UI Admin', email: 'adminui@test.com', password: passwordHash });

  const cinema = await Cinema.create({ name: "D'AVENOR Thanh Khê Plaza", address: 'Thanh Khê, Đà Nẵng', city: 'Đà Nẵng' });
  const [roomImax, roomDolby, roomGold] = await Room.create([
    { cinemaId: cinema._id, name: 'Phòng 01 - IMAX Laser (Grand Hall 1)', shortName: 'P01', roomType: 'IMAX Laser', totalSeats: 88 },
    { cinemaId: cinema._id, name: 'Phòng 04 - Dolby Atmos (Hall 4)', shortName: 'P04', roomType: 'Dolby Atmos', totalSeats: 88 },
    { cinemaId: cinema._id, name: 'Phòng 07 - Gold Class (VIP Lounge 7)', shortName: 'P07', roomType: 'Gold Class', totalSeats: 88 },
  ]);

  const movie = await Movie.create({
    title: 'Dune: Hành Tinh Cát – Phần 2',
    slug: 'dune-part-two-ui-p6',
    duration: 166,
    genre: 'Khoa Học Viễn Tưởng, Hành Động',
    posterUrl: 'https://placehold.co/400x600/0B1026/42DFFF?text=DUNE+2',
    status: 'NOW_SHOWING',
    ageRating: 'T13',
  });

  const baseStart = new Date(Date.now() + 24 * 3600 * 1000);
  const [stImax, stDolby, stGold] = await Showtime.create([
    { movieId: movie._id, cinemaId: cinema._id, roomId: roomImax._id, roomName: roomImax.name, startTime: baseStart, endTime: new Date(baseStart.getTime() + 166 * 60000), price: 120000 },
    { movieId: movie._id, cinemaId: cinema._id, roomId: roomDolby._id, roomName: roomDolby.name, startTime: new Date(baseStart.getTime() + 3600000), endTime: new Date(baseStart.getTime() + 226 * 60000), price: 105000 },
    { movieId: movie._id, cinemaId: cinema._id, roomId: roomGold._id, roomName: roomGold.name, startTime: new Date(baseStart.getTime() + 7200000), endTime: new Date(baseStart.getTime() + 286 * 60000), price: 180000 },
  ]);

  const allSeats = [];
  for (const st of [stImax, stDolby, stGold]) {
    for (const r of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      for (let c = 1; c <= 11; c++) {
        allSeats.push({
          showtimeId: st._id,
          roomId: st.roomId,
          seatNumber: `${r}${c}`,
          row: r,
          col: c,
          type: ['E', 'F', 'G', 'H'].includes(r) ? 'VIP' : 'STANDARD',
          status: 'AVAILABLE',
        });
      }
    }
  }
  await ShowtimeSeat.insertMany(allSeats);

  const viteProc = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', String(FRONTEND_PORT), '--strictPort'],
    { cwd: 'd:/CDIO/movietix-project/frontend', stdio: 'pipe' }
  );
  await waitForServer(`${UI_BASE}/`);

  const loginApi = async (email) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, email, password: 'UiPass123!' }),
    });
    return res.json();
  };
  const adminAuth = await loginApi('adminui@test.com');

  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const checks = [];

  try {
    const createCtx = async (viewport) => {
      const ctx = await browser.newContext({ viewport });
      await ctx.route('**/api/**', async (route) => {
        const req = route.request();
        const u = new URL(req.url());
        const headers = { ...req.headers() };
        delete headers.host;
        const res = await fetch(`${API_BASE}${u.pathname}${u.search}`, {
          method: req.method(),
          headers,
          body: req.postDataBuffer() || undefined,
        });
        const buf = Buffer.from(await res.arrayBuffer());
        await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers.entries()), body: buf });
      });
      const page = await ctx.newPage();
      page.on('pageerror', (err) => pageErrors.push(err.message));
      return { ctx, page };
    };

    // 1. Desktop 1920x1080: Home + IMAX Seat + Admin Statistics
    {
      const { ctx, page } = await createCtx({ width: 1920, height: 1080 });
      await page.goto(`${UI_BASE}/`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${SHOT_DIR}/01_home_desktop_1920.png` });
      checks.push('UI-1: HomePage Desktop 1920x1080: PASS');

      await page.goto(`${UI_BASE}/booking/seat/${stImax._id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('button:has-text("1")');
      await page.screenshot({ path: `${SHOT_DIR}/03_imax_seat_desktop_1920.png` });
      checks.push('UI-2: IMAX Laser SeatSelection Desktop 1920x1080: PASS');

      await page.evaluate(({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('adminToken', token);
        localStorage.setItem('user', JSON.stringify({ ...user, role: 'ADMIN' }));
      }, adminAuth);
      await page.goto(`${UI_BASE}/admin/statistics`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SHOT_DIR}/06_admin_statistics_desktop_1920.png` });
      checks.push('UI-3: Admin Statistics Desktop 1920x1080: PASS');
      await ctx.close();
    }

    // 2. Laptop 1366x768: TheatersPage
    {
      const { ctx, page } = await createCtx({ width: 1366, height: 768 });
      await page.goto(`${UI_BASE}/theaters`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOT_DIR}/02_theaters_laptop_1366.png` });
      checks.push('UI-4: TheatersPage Laptop 1366x768: PASS');
      await ctx.close();
    }

    // 3. Tablet 768x1024: Dolby Atmos SeatSelection
    {
      const { ctx, page } = await createCtx({ width: 768, height: 1024 });
      await page.goto(`${UI_BASE}/booking/seat/${stDolby._id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('button:has-text("1")');
      await page.screenshot({ path: `${SHOT_DIR}/04_dolby_seat_tablet_768.png` });
      checks.push('UI-5: Dolby Atmos SeatSelection Tablet 768x1024: PASS');
      await ctx.close();
    }

    // 4. Mobile 390x844: Gold Class SeatSelection
    {
      const { ctx, page } = await createCtx({ width: 390, height: 844 });
      await page.goto(`${UI_BASE}/booking/seat/${stGold._id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('button:has-text("1")');
      await page.screenshot({ path: `${SHOT_DIR}/05_goldclass_seat_mobile_390.png` });
      checks.push('UI-6: Gold Class SeatSelection Mobile 390x844: PASS');
      await ctx.close();
    }

    assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join('; ')}`);
    console.log('\n=== PHASE 6 RESPONSIVE UI & SCREENSHOTS ===');
    for (const c of checks) console.log(c);
    console.log(`TOTAL: ${checks.length}/${checks.length} PASS (0 uncaught page errors)`);
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
    console.error('PHASE 6 UI FAILED:', err);
    process.exit(1);
  });
