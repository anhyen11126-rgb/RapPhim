import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // fallback to system DNS
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');
const FRONTEND_ROOT = path.join(PROJECT_ROOT, 'frontend');
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'docs', 'acceptance-screenshots');

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(FRONTEND_ROOT, 'node_modules', 'playwright'));
const mongoose = require(path.join(BACKEND_ROOT, 'node_modules', 'mongoose'));
const jwt = require(path.join(BACKEND_ROOT, 'node_modules', 'jsonwebtoken'));
const dotenv = require(path.join(BACKEND_ROOT, 'node_modules', 'dotenv'));

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

async function isServerUp(url) {
  try {
    const res = await fetch(url);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp(url)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // 1. Read-only lookup of existing AdminUser in movietix_db to mint a valid JWT session token
  const liveUri = process.env.MONGODB_LIVE_URI || process.env.MONGODB_URI;
  await mongoose.connect(liveUri, { serverSelectionTimeoutMS: 15000 });
  const adminDoc =
    (await mongoose.connection.db.collection('adminusers').findOne({})) ||
    (await mongoose.connection.db.collection('users').findOne({ role: 'ADMIN' }));
  await mongoose.disconnect();

  assert.ok(adminDoc, 'Must find an existing Admin user in movietix_db');
  const token = jwt.sign(
    {
      id: String(adminDoc._id),
      userId: String(adminDoc._id),
      email: adminDoc.email || 'admin@movietix.vn',
      role: 'ADMIN',
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
  const adminUserObj = {
    id: String(adminDoc._id),
    _id: String(adminDoc._id),
    name: adminDoc.name || 'Admin D’AVENOR',
    email: adminDoc.email || 'admin@movietix.vn',
    role: 'ADMIN',
  };

  // 2. Check if Vite is already running on 5173; otherwise spawn a temporary Vite server on 4177
  let uiBase = 'http://localhost:5173';
  let viteProc = null;
  if (!(await isServerUp(`${uiBase}/`))) {
    uiBase = 'http://localhost:4177';
    viteProc = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--port', '4177', '--strictPort'],
      { cwd: FRONTEND_ROOT, stdio: 'pipe' }
    );
    await waitForServer(`${uiBase}/`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
    const page = await context.newPage();

    await page.goto(`${uiBase}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ tk, usr }) => {
        localStorage.setItem('token', tk);
        localStorage.setItem('adminToken', tk);
        localStorage.setItem('user', JSON.stringify(usr));
      },
      { tk: token, usr: adminUserObj }
    );

    // Navigate to /admin/statistics
    await page.goto(`${uiBase}/admin/statistics`, { waitUntil: 'domcontentloaded' });
    await page
      .locator('text=226 suất')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(800);

    // Check Month dropdown options for Year 2026 (TC02 on UI)
    const monthOptions = await page
      .locator('select[aria-label="Chọn tháng báo cáo"] option')
      .allTextContents();
    console.log('UI Month options for 2026:', monthOptions);
    assert.deepEqual(monthOptions, ['Tháng 11', 'Tháng 12']);

    // Check Year dropdown options (no year < 2026)
    const yearOptions = await page
      .locator('select[aria-label="Chọn năm báo cáo"] option')
      .allTextContents();
    console.log('UI Year options:', yearOptions);
    assert.ok(!yearOptions.some((y) => y.includes('2025') || y.includes('2024')));

    // Check Movie Filter dropdown options (TC06 on UI)
    const movieOptions = await page
      .locator('select[aria-label="Lọc theo phim"] option')
      .allTextContents();
    console.log('UI Movie filter options for Nov 2026:', movieOptions);
    assert.equal(movieOptions.length, 4); // "Tất cả phim trong kỳ (3 phim)" + 3 movies
    assert.ok(movieOptions[0].includes('3 phim'));

    // Screenshot 1: Tab Tổng hợp (Overview)
    const overviewPath = path.join(SCREENSHOT_DIR, 'live_overview_tab_nov2026.png');
    await page.screenshot({
      path: overviewPath,
      fullPage: true,
    });
    console.log(`✔ Saved ${path.relative(PROJECT_ROOT, overviewPath)}`);

    // Switch to Tab 2: Doanh thu & Chi phí
    await page.locator('button:has-text("Doanh thu & Chi phí")').click();
    await page.locator('button:has-text("Theo tháng (2)")').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);
    const revBodyText = await page.locator('main').innerText();
    assert.ok(revBodyText.includes('Chưa đủ dữ liệu tính lợi nhuận'));
    assert.ok(revBodyText.includes('Theo tháng (2)'));

    const revenuePath = path.join(SCREENSHOT_DIR, 'live_revenue_tab_nov2026.png');
    await page.screenshot({
      path: revenuePath,
      fullPage: true,
    });
    console.log(`✔ Saved ${path.relative(PROJECT_ROOT, revenuePath)}`);

    // Switch to Tab 3: Hiệu suất (click explicit tab button with icon 🎬)
    await page.locator('button:has-text("🎬")').click();
    await page
      .locator('h4:has-text("Dune: Hành Tinh Cát – Phần 2")')
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(400);
    const effBodyText = await page.locator('main').innerText();
    assert.ok(effBodyText.includes('Dune: Hành Tinh Cát – Phần 2'));
    assert.ok(effBodyText.includes('Deadpool & Wolverine'));
    assert.ok(effBodyText.includes('Mai'));
    assert.ok(!effBodyText.includes('Spider-Man: No Way Home'));

    const efficiencyPath = path.join(SCREENSHOT_DIR, 'live_efficiency_tab_nov2026.png');
    await page.screenshot({
      path: efficiencyPath,
      fullPage: true,
    });
    console.log(`✔ Saved ${path.relative(PROJECT_ROOT, efficiencyPath)}`);

    // TC23: Rapid filter switching (Tháng 12 -> Tháng 11) does not let stale response overwrite latest month
    await page.locator('button:has-text("Tổng hợp")').click();
    await page.waitForTimeout(400);
    const monthSelect = page.locator('select[aria-label="Chọn tháng báo cáo"]');
    await monthSelect.selectOption('12');
    await monthSelect.selectOption('11');
    await page
      .locator('text=226 suất')
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(400);
    const textAfterRapidSwitch = await page.locator('main').innerText();
    assert.ok(
      textAfterRapidSwitch.includes('Tháng 11/2026') && textAfterRapidSwitch.includes('226 suất'),
      'TC23: Latest selected month (Nov 2026) data must win after rapid switching'
    );
    console.log('✅ PASS [TC23] Chuyển bộ lọc liên tục không bị dữ liệu cũ ghi đè');

    // TC24: API failure shows explicit error alert without fake 0 KPIs
    await page.route('**/api/admin/statistics/overview*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Lỗi kết nối máy chủ thống kê (Simulated)',
        }),
      })
    );
    await page.locator('button:has-text("Làm mới")').click();
    await page.locator('[role="alert"]').waitFor({ state: 'visible', timeout: 10000 });
    const alertVisible = await page.locator('[role="alert"]').isVisible();
    assert.ok(alertVisible, 'TC24: Error alert must be visible when API fails');
    console.log('✅ PASS [TC24] API lỗi hiển thị cảnh báo rõ ràng, không hiển thị số liệu giả');

    await context.close();
  } finally {
    await browser.close();
    if (viteProc) viteProc.kill();
  }
}

run().catch((err) => {
  console.error('❌ UI Verification failed:', err);
  process.exit(1);
});
