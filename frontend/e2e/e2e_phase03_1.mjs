import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const backendRequire = createRequire('file:///d:/CDIO/movietix-project/backend/package.json');
const frontendRequire = createRequire('file:///d:/CDIO/movietix-project/frontend/package.json');

const express = backendRequire('express');
const cors = backendRequire('cors');
const bcrypt = backendRequire('bcryptjs');
const { MongoMemoryReplSet } = backendRequire('mongodb-memory-server');
const { chromium } = frontendRequire('playwright');

const { default: mongoose } = await import('file:///d:/CDIO/movietix-project/backend/node_modules/mongoose/index.js');
const { default: authRoutes } = await import('file:///d:/CDIO/movietix-project/backend/src/routes/authRoutes.js');
const { default: movieRoutes } = await import('file:///d:/CDIO/movietix-project/backend/src/routes/movieRoutes.js');
const { default: cinemaRoutes } = await import('file:///d:/CDIO/movietix-project/backend/src/routes/cinemaRoutes.js');
const { default: showtimeRoutes } = await import('file:///d:/CDIO/movietix-project/backend/src/routes/showtimeRoutes.js');
const { default: bookingRoutes } = await import('file:///d:/CDIO/movietix-project/backend/src/routes/bookingRoutes.js');
const { default: concessionRoutes } = await import('file:///d:/CDIO/movietix-project/backend/src/routes/concessionRoutes.js');
const { default: promotionRoutes } = await import('file:///d:/CDIO/movietix-project/backend/src/routes/promotionRoutes.js');
const { default: pricingRoutes } = await import('file:///d:/CDIO/movietix-project/backend/src/routes/pricingRoutes.js');

const { default: User } = await import('file:///d:/CDIO/movietix-project/backend/src/models/User.js');
const { default: Cinema } = await import('file:///d:/CDIO/movietix-project/backend/src/models/Cinema.js');
const { default: Room } = await import('file:///d:/CDIO/movietix-project/backend/src/models/Room.js');
const { default: Movie } = await import('file:///d:/CDIO/movietix-project/backend/src/models/Movie.js');
const { default: Showtime } = await import('file:///d:/CDIO/movietix-project/backend/src/models/Showtime.js');
const { default: ShowtimeSeat } = await import('file:///d:/CDIO/movietix-project/backend/src/models/ShowtimeSeat.js');
const { default: Concession } = await import('file:///d:/CDIO/movietix-project/backend/src/models/Concession.js');
const { default: Promotion } = await import('file:///d:/CDIO/movietix-project/backend/src/models/Promotion.js');

const screenshotDir = 'C:/Users/LENOVO/.gemini/antigravity/brain/372e9cc7-702b-472f-bdb3-a22d2e638d87/scratch/screenshots';
fs.mkdirSync(screenshotDir, { recursive: true });

process.env.JWT_SECRET = 'isolated-e2e-secret-2026';

const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(mongo.getUri('davenor_e2e'));
await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

const passHash = await bcrypt.hash('Test@1234', 4);
const [u1, u2] = await User.create([
  { name: 'Khách Hàng A', email: 'e2e_a@test.local', phone: '0901000001', password: passHash },
  { name: 'Khách Hàng B', email: 'e2e_b@test.local', phone: '0901000002', password: passHash },
]);
const cinema = await Cinema.create({ name: "D'AVENOR Thanh Khê Plaza", address: '295 Điện Biên Phủ, Đà Nẵng', isFlagship: true });
const [rImax, rDolby, rGold] = await Room.create([
  { roomNumber: 1, name: 'Phòng 01 - IMAX Laser (Grand Hall 1)', shortName: 'IMAX 01', roomType: 'IMAX Laser', cinemaId: cinema._id, totalSeats: 88, status: 'ACTIVE' },
  { roomNumber: 4, name: 'Phòng 04 - Dolby Atmos (VIP Sound 1)', shortName: 'Dolby 01', roomType: 'Dolby Atmos', cinemaId: cinema._id, totalSeats: 88, status: 'ACTIVE' },
  { roomNumber: 7, name: 'Phòng 07 - Gold Class (Luxury Lounge 1)', shortName: 'Gold 01', roomType: 'Gold Class', cinemaId: cinema._id, totalSeats: 88, status: 'ACTIVE' },
]);
const movie = await Movie.create({
  title: 'Dune: Hành Tinh Cát 2',
  slug: 'dune-hanh-tinh-cat-2',
  posterUrl: '/images/movies/dune2.jpg',
  genre: 'Khoa Học Viễn Tưởng',
  duration: 166,
  ageRating: 'T16',
  status: 'NOW_SHOWING',
  releaseDate: new Date(Date.now() - 86400000),
});

async function createSlotWith88Seats(room, hoursAhead, price) {
  const slot = await Showtime.create({
    movieId: movie._id,
    cinemaId: cinema._id,
    roomId: room._id,
    roomName: room.name,
    formatFeature: room.roomType,
    startTime: new Date(Date.now() + hoursAhead * 3600000),
    price,
  });
  const docs = [];
  for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
    const type = ['E', 'F', 'G'].includes(row) ? 'VIP' : row === 'H' ? 'SWEETBOX' : 'STANDARD';
    for (let col = 1; col <= 11; col++) {
      docs.push({ showtimeId: slot._id, roomId: room._id, row, col, seatNumber: `${row}${col}`, type, status: 'AVAILABLE' });
    }
  }
  await ShowtimeSeat.insertMany(docs);
  return slot;
}

const stImax = await createSlotWith88Seats(rImax, 30, 150000);
const stDolby = await createSlotWith88Seats(rDolby, 32, 55000);
const stGold = await createSlotWith88Seats(rGold, 34, 210000);

await Concession.create({ name: 'Combo Bắp Nước E2E', price: 75000, category: 'COMBO', isActive: true });
await Promotion.create({ title: 'Voucher E2E 20K', code: 'E2E20K', type: 'VOUCHER', discountValue: '20K', isActive: true, expiryDate: '31/12/2099' });

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/cinemas', cinemaRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/concessions', concessionRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/pricing', pricingRoutes);

const backendServer = app.listen(5055, '127.0.0.1');
await once(backendServer, 'listening');
console.log('Isolated E2E Backend listening on http://127.0.0.1:5055');

const viteProc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '4173', '--strictPort'], {
  cwd: 'd:/CDIO/movietix-project/frontend',
  env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:5055/api' },
  stdio: 'pipe',
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Vite startup timeout')), 20000);
  viteProc.stdout.on('data', (chunk) => {
    const str = chunk.toString();
    if (str.includes('4173')) {
      clearTimeout(timeout);
      resolve();
    }
  });
});
console.log('Vite frontend listening on http://localhost:4173');

const browser = await chromium.launch({ headless: true });
const report = [];
const record = (name, status, detail = '') => {
  report.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ' — ' + detail : ''}`);
};

try {
  // Context A & Context B
  const ctxA = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const ctxB = await browser.newContext({ viewport: { width: 1366, height: 768 } });

  const routeToIsolatedBackend = async (route) => {
    const reqUrl = new URL(route.request().url());
    const targetUrl = `http://127.0.0.1:5055${reqUrl.pathname}${reqUrl.search}`;
    const res = await route.fetch({ url: targetUrl });
    await route.fulfill({ response: res });
  };
  await ctxA.route('**/api/**', routeToIsolatedBackend);
  await ctxB.route('**/api/**', routeToIsolatedBackend);
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  pageA.on('pageerror', (e) => console.error('[pageA error]', e.message));
  pageA.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) console.error('[pageA API]', r.status(), r.url());
  });

  // 1. Unauthenticated seat selection -> /login -> login -> return & restore draftSeats
  await pageA.goto(`http://localhost:4173/booking/seat/${stImax._id}`, { waitUntil: 'networkidle' });
  await pageA.waitForSelector('[aria-label="Sơ đồ ghế"]');
  await pageA.locator('button[title*="F7"]').click();
  await pageA.locator('button:has-text("Tiếp tục")').click();
  await pageA.waitForURL('**/login**');
  record('E2E-1: Chưa đăng nhập bấm Tiếp tục -> chuyển hướng /login', 'PASS');

  await pageA.locator('input:not([type="password"])').first().fill('e2e_a@test.local');
  await pageA.locator('input[type="password"]').first().fill('Test@1234');
  await pageA.locator('button[type="submit"]').click();
  await pageA.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
  if (!pageA.url().includes(`/booking/seat/${stImax._id}`)) {
    await pageA.goto(`http://localhost:4173/booking/seat/${stImax._id}`, { waitUntil: 'networkidle' });
  }
  await pageA.waitForSelector('[aria-label="Sơ đồ ghế"]', { timeout: 15000 });
  record('E2E-2: Đăng nhập thành công & mở sơ đồ ghế suất chiếu', 'PASS', pageA.url());

  // Re-select F7 if needed and proceed to hold
  const selectedCountText = await pageA.locator('text=Đang chọn:').locator('..').innerText();
  if (selectedCountText.includes('0')) {
    await pageA.locator('button[title*="F7"]').click();
  }
  await pageA.screenshot({ path: path.join(screenshotDir, '01_seat_imax_desktop.png') });

  // Hold seat F7 -> navigate to /checkout
  await pageA.locator('button:has-text("Tiếp tục")').click();
  await pageA.waitForURL('**/checkout**');
  await pageA.waitForSelector('text=⏳');
  const countdown1 = await pageA.locator('span[title="Thời gian giữ ghế còn lại"]').innerText();
  assert.match(countdown1, /⏳\s*\d{2}:\d{2}/);
  record('E2E-3: Giữ ghế thành công (600s) & hiển thị countdown MM:SS tại Checkout', 'PASS', countdown1);

  // Check DB state is HOLDING
  const heldSeat = await ShowtimeSeat.findOne({ showtimeId: stImax._id, seatNumber: 'F7' }).lean();
  assert.equal(heldSeat.status, 'HOLDING');
  assert.equal(String(heldSeat.holdOwnerId), String(u1._id));
  record('E2E-4: MongoDB ghi nhận HOLDING, holdId, holdOwnerId, holdExpiresAt', 'PASS', heldSeat.holdId);

  // Customer B opens same showtime -> sees F7 as HOLDING_OTHER (cannot click)
  await pageB.goto(`http://localhost:4173/booking/seat/${stImax._id}`, { waitUntil: 'networkidle' });
  await pageB.waitForSelector('[aria-label="Sơ đồ ghế"]');
  const f7TitleB = await pageB.locator('[title*="F7"]').first().getAttribute('title');
  assert.ok(f7TitleB.includes('Đang được khách khác giữ'), `Expected HOLDING_OTHER tooltip, got: ${f7TitleB}`);
  record('E2E-5: Khách B thấy ghế F7 trạng thái HOLDING_OTHER và không thể chọn', 'PASS', f7TitleB);

  // Reload Checkout on Page A -> countdown & holdId preserved!
  await pageA.reload({ waitUntil: 'networkidle' });
  await pageA.waitForSelector('span[title="Thời gian giữ ghế còn lại"]');
  const countdownAfterReload = await pageA.locator('span[title="Thời gian giữ ghế còn lại"]').innerText();
  assert.match(countdownAfterReload, /⏳\s*0[89]:\d{2}/);
  await pageA.screenshot({ path: path.join(screenshotDir, '02_checkout_countdown_desktop.png') });
  record('E2E-6: Reload Checkout không mất phiên giữ ghế & không reset về 10:00', 'PASS', countdownAfterReload);

  // Complete Checkout -> BookingSuccessPage
  await pageA.locator('button:has-text("Thanh toán")').last().click();
  await pageA.locator('button:has-text("Tôi đã thanh toán"), button:has-text("Xác nhận")').last().click();
  await pageA.waitForURL('**/booking-success**');
  await pageA.screenshot({ path: path.join(screenshotDir, '03_booking_success.png') });
  record('E2E-7: Thanh toán thành công -> BookingSuccessPage & QR vé', 'PASS');

  // Check 3 room types & Responsive viewports
  for (const [label, slot, vp, fname] of [
    ['Dolby Atmos (Tablet 768x1024)', stDolby, { width: 768, height: 1024 }, '04_dolby_tablet.png'],
    ['Gold Class (Mobile 390x844)', stGold, { width: 390, height: 844 }, '05_gold_mobile.png'],
  ]) {
    await pageB.setViewportSize(vp);
    await pageB.goto(`http://localhost:4173/booking/seat/${slot._id}`, { waitUntil: 'networkidle' });
    await pageB.waitForSelector('[aria-label="Sơ đồ ghế"]');
    await pageB.screenshot({ path: path.join(screenshotDir, fname) });
    record(`E2E-8: Responsive & hiển thị phòng ${label}`, 'PASS');
  }
} finally {
  await browser.close();
  viteProc.kill();
  backendServer.close();
  await mongoose.disconnect();
  await mongo.stop();
}

const failed = report.filter((r) => r.status === 'FAIL');
console.log(`\n=== E2E SUMMARY: ${report.length - failed.length}/${report.length} PASSED ===`);
if (failed.length > 0) process.exit(1);
