# 🎬 D’AVENOR CINEMA — Hệ thống Đặt vé & Quản lý Rạp chiếu phim + Trợ lý ảo AI

> Dự án đồ án **CDIO** xây dựng hệ thống quản lý rạp chiếu phim và đặt vé trực tuyến cho cụm rạp **D’AVENOR Thanh Khê Plaza** (Đà Nẵng), tích hợp cơ chế giữ ghế thực sự 600 giây trong MongoDB, giao diện 3D, bảng điều khiển thống kê và Trợ lý ảo AI (Google Gemini + Database Fallback).

---

## 🏗️ 1. Kiến trúc & Công nghệ (Tech Stack)

- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router DOM, Axios, Lucide Icons, Three.js (`Theater3DExperience` lazy-loaded), phong cách **Holographic Dark Navy**.
- **Backend:** Node.js (ESM), Express.js, MongoDB & Mongoose (Replica Set Transactions), JWT Authentication (`authenticateCustomer` & `authenticateAdmin`), Bcryptjs, Nodemailer.
- **AI Assistant:** Google Gemini API + RAG Context thời gian thực từ MongoDB (`cinemaContextService.js`) + Database Fallback khi Gemini lỗi/timeout.
- **Kiểm thử tự động:** Node Built-in Test Runner (`node --test`), `mongodb-memory-server` (`MongoMemoryReplSet` cô lập), Playwright E2E & Responsive UI.

---

## 🏛️ 2. Cấu hình nghiệp vụ chuẩn hóa

- **Cụm rạp duy nhất:** D’AVENOR Thanh Khê Plaza (Đà Nẵng).
- **9 phòng chiếu vật lý thuộc 3 công nghệ:**
  - Phòng 01–03: **IMAX Laser**
  - Phòng 04–06: **Dolby Atmos**
  - Phòng 07–09: **Gold Class**
- **Sơ đồ ghế:** 88 ghế/suất chiếu (`8 hàng A–H × 11 cột 1–11`, lối đi `AISLE` giữa cột 6 và 7).
- **Giữ ghế thực sự 600 giây (10 phút):** Lưu trạng thái `HOLDING`, `holdId`, `holdOwnerId`, `holdCreatedAt`, `holdExpiresAt` trong MongoDB; đếm ngược `MM:SS` theo `serverTime + expiresAt`, không reset khi reload.
- **Thanh toán mô phỏng (`SIMULATED`):** Phục vụ trình diễn đồ án CDIO; hỗ trợ `Idempotency-Key` chống tạo đơn trùng, tự động tính lại giá vé/combo/voucher ở Backend, tách bạch `simulatedRevenue` và `verifiedRevenue` trên Dashboard/CSV.
- **Vé điện tử & Quản trị:** Mã QR check-in 1 lần, đổi/hủy vé theo quy tắc >24h, bảo vệ suất chiếu Nhóm A/B (`CANCEL_WITH_REFUND`), polling sơ đồ ghế nhẹ (`?lite=1`) tự dừng khi ẩn tab.

---

## 🚀 3. Cài đặt & Cấu hình môi trường

### Bước 1: Cài đặt dependencies
```bash
npm --prefix backend install
npm --prefix frontend install
```

### Bước 2: Cấu hình biến môi trường
Tạo file `backend/.env` từ mẫu `backend/.env.example`:
```env
PORT=5000
MONGO_URI="mongodb+srv://<user>:<password>@<cluster>/movietix_db"
JWT_SECRET="your-strong-jwt-secret"
GEMINI_API_KEY="your-gemini-api-key"
```
*(Lưu ý: Không commit file `.env` chứa thông tin bí mật lên Git — đã được chặn trong `.gitignore`.)*

### Bước 3: Khởi chạy dự án (Development)
Mở 2 terminal:
```bash
# Terminal 1 — Backend (http://localhost:5000)
npm --prefix backend run dev

# Terminal 2 — Frontend (http://localhost:5173)
npm --prefix frontend run dev
```

### Bước 4: Build Production Frontend
```bash
npm --prefix frontend run build
```

---

## 🧪 4. Hướng dẫn chạy toàn bộ 104 bài kiểm thử (0 FAIL, 0 SKIPPED)

Toàn bộ bài kiểm thử ghi/xóa đều chạy trên **`MongoMemoryReplSet` cô lập** — tuyệt đối không làm ảnh hưởng đến dữ liệu vận hành trên MongoDB Atlas.

### 4.1. Backend Integration Tests (49 tests)
Chạy đồng thời 4 bộ test (`booking-and-admin.test.js`, `seat-holding.test.js`, `phase05-performance-sync.test.js`, `phase06-acceptance.test.js`):
```bash
npm --prefix backend test
```
*(Ghi chú: Tự động nạp `mongodb-memory-server` từ `backend/node_modules`; nếu thiếu sẽ báo lỗi rõ ràng thay vì âm thầm bỏ qua.)*

### 4.2. Chatbot AI Tests (32 tests)
```bash
node backend/scripts/testAiChatbot.js
node backend/scripts/testChatbotUpgrade.js
```

### 4.3. Playwright E2E & Responsive UI Tests (23 tests)
Đảm bảo đã cài trình duyệt Chromium của Playwright (chỉ cần chạy 1 lần nếu chưa có):
```bash
npx --prefix frontend playwright install chromium
```
Chạy lần lượt 3 bộ Playwright E2E trên môi trường cô lập (`MongoMemoryReplSet` + Express + Vite riêng):
```bash
# 1. Luồng đặt vé E2E đầy đủ, giữ ghế 600s, countdown, reload, QR, Dolby Tablet & Gold Class Mobile (9 tests)
node frontend/e2e/e2e_phase03_1.mjs

# 2. Đồng bộ Client A/B, Admin stats, Chatbot AI, cross-account holdId, Idempotency-Key, Admin cancel (8 tests)
node frontend/e2e/e2e_phase04.mjs

# 3. Kiểm thử Responsive 4 độ phân giải (1920x1080, 1366x768, 768x1024, 390x844) & xuất ảnh nghiệm thu (6 tests)
node frontend/e2e/e2e_phase06_ui.mjs
```

---

## 📸 5. Ảnh chụp giao diện nghiệm thu

6 ảnh chụp nghiệm thu tự động được lưu tại thư mục [`docs/acceptance-screenshots/`](docs/acceptance-screenshots/):
- `01_home_desktop_1920.png` — Trang chủ (Desktop 1920×1080)
- `02_theaters_laptop_1366.png` — Cụm rạp & lịch chiếu (Laptop 1366×768)
- `03_imax_seat_desktop_1920.png` — Phòng IMAX Laser 88 ghế (Desktop 1920×1080)
- `04_dolby_seat_tablet_768.png` — Phòng Dolby Atmos 88 ghế (Tablet 768×1024)
- `05_goldclass_seat_mobile_390.png` — Phòng Gold Class 88 ghế (Mobile 390×844)
- `06_admin_statistics_desktop_1920.png` — Admin Dashboard Thống kê (Desktop 1920×1080)
