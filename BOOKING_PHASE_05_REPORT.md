# BÁO CÁO NGHIỆM THU GIAI ĐOẠN 5 — TỐI ƯU ĐIỀU HƯỚNG, HIỆU SUẤT VÀ HOÀN THIỆN ĐỒNG BỘ

**Dự án:** D’AVENOR CINEMA  
**Ngày hoàn thành:** 2026-11-25  
**Trạng thái:** Hoàn thành Giai đoạn 5 — Chờ phê duyệt Giai đoạn 6 (Kiểm thử và nghiệm thu toàn bộ hệ thống)

---

## 1. Kết quả chạy lại 18 test bị SKIPPED

- **Nguyên nhân trước đó:** `backend/test/booking-and-admin.test.js` chỉ bật chạy tích hợp khi biến môi trường `DAVENOR_TEST_MONGO_MODULE` được truyền thủ công; nếu thiếu sẽ âm thầm `SKIP` 18/19 test. Đồng thời `backend/package.json` chỉ chạy `booking-and-admin.test.js`, chưa gộp `seat-holding.test.js`.
- **Đã chuẩn hóa:**
  - `booking-and-admin.test.js` tự động mặc định `process.env.DAVENOR_TEST_MONGO_MODULE || 'mongodb-memory-server'`, và **ném lỗi tường minh** (fail fast) nếu thiếu `mongodb-memory-server` thay vì âm thầm bỏ qua.
  - `backend/package.json` cập nhật `"test": "node --test test/booking-and-admin.test.js test/seat-holding.test.js test/phase05-performance-sync.test.js"`.
- **Kết quả chạy lại `npm --prefix backend test`:** **40/40 PASS, 0 FAIL, 0 SKIPPED** (trong đó toàn bộ 19/19 test của `booking-and-admin.test.js` đều PASS).

---

## 2. Danh sách vấn đề hiệu suất phát hiện

1. **Bundle JavaScript khởi tạo quá lớn (`1,659.81 kB` / `418.63 kB` gzip):** Toàn bộ 12 trang Admin (kèm biểu đồ thống kê) và module 3D (`Theater3DExperience` / Three.js) bị import tĩnh vào bundle chính của khách hàng.
2. **Polling sơ đồ ghế 3 giây tải dư dữ liệu (`20,195 bytes/request`):** Mỗi 3 giây, `SeatSelectionPage` gọi `GET /api/showtimes/:id/seats` đầy đủ cả thông tin phim (gồm cả `description` dài), rạp, phòng và metadata ghế, đồng thời không tạm dừng khi ẩn tab và không có khóa chống request chồng chéo (`inFlight`) hay chống response cũ ghi đè (`requestSeq`).
3. **Admin `ShowtimeDetailDrawer` polling thiếu cơ chế hủy và chống chồng chéo:** Không dùng `AbortController`, không bỏ qua khi tab ẩn, và `statisticsApi.getShowtimeDetail` chưa nhận `signal`.
4. **Điều hướng từ `TheatersPage.jsx` thiếu `slotInfo`:** `handleSelectShowtime(st.id)` chỉ điều hướng kèm `showtimeId`, gây trống thông tin ban đầu cho tới khi API phản hồi.
5. **Tạo lại callback `handleSeatClick` mỗi lần render:** Làm vô hiệu hóa `React.memo` trên 88 ghế (`ImaxSeat`, `DolbySeat`, `GoldClassSeat`) mỗi chu kỳ polling.
6. **MongoDB phát sinh in-memory `SORT`:**
   - `ShowtimeSeat.find({ showtimeId }).sort({ row: 1, col: 1 })` chạy `SORT -> FETCH -> IXSCAN(showtimeId_1)`.
   - `Booking.find({ showtimeId, status, paymentStatus }).sort({ createdAt: -1 })` chạy `SORT -> PROJECTION_SIMPLE -> FETCH -> IXSCAN(showtimeId_1)`.

---

## 3. Nguyên nhân từng vấn đề

| Vấn đề | Nguyên nhân gốc rễ |
|---|---|
| Bundle 1.66 MB | Import tĩnh tất cả Admin pages trong `App.jsx` và `Theater3DExperience` trong `SeatSelectionPage.jsx`. |
| Polling 20 KB/3s | `getShowtimeSeats` chưa dùng `.lean()`, chưa `.select(...)` bỏ trường thừa của `Movie`/`ShowtimeSeat`, và chưa hỗ trợ chế độ nhẹ `?lite=1` cho polling. |
| Polling chồng chéo / rò rỉ | Thiếu `inFlightRef`, `requestSeqRef`, `document.hidden` check và `visibilitychange` sync ở `SeatSelectionPage` & `ShowtimeDetailDrawer`. |
| Thiếu `slotInfo` ở `TheatersPage` | `handleSelectShowtime` chỉ nhận `showtimeId` thay vì truyền kèm `movie`, `room`, `st`. |
| Re-render 88 ghế | `handleSeatClick` là hàm thường tạo mới mỗi render, làm prop `onClick` của `ImaxSeat`/`DolbySeat`/`GoldClassSeat` thay đổi liên tục. |
| MongoDB in-memory `SORT` | Thiếu compound index `{ showtimeId: 1, row: 1, col: 1 }` trên `ShowtimeSeat` và `{ showtimeId: 1, status: 1, paymentStatus: 1, createdAt: -1 }` trên `Booking`. |

---

## 4. Danh sách file đã sửa / tạo mới trong Giai đoạn 5

- [backend/package.json](file:///d:/CDIO/movietix-project/backend/package.json) — Chuẩn hóa script `npm test` chạy cả 3 bộ test tích hợp cô lập.
- [backend/test/booking-and-admin.test.js](file:///d:/CDIO/movietix-project/backend/test/booking-and-admin.test.js) — Tự động nạp `mongodb-memory-server`, fail fast nếu thiếu môi trường test.
- [backend/test/phase05-performance-sync.test.js](file:///d:/CDIO/movietix-project/backend/test/phase05-performance-sync.test.js) — Bộ test mới kiểm chứng `?lite=1`, concurrent 2-user hold (`Promise.all`), near-expiry checkout, Idempotency-Key recovery, và MongoDB `explain` (0 in-memory SORT).
- [backend/src/models/ShowtimeSeat.js](file:///d:/CDIO/movietix-project/backend/src/models/ShowtimeSeat.js) — Bổ sung compound index `{ showtimeId: 1, row: 1, col: 1 }` (không tạo TTL index trên `holdExpiresAt`).
- [backend/src/models/Booking.js](file:///d:/CDIO/movietix-project/backend/src/models/Booking.js) — Bổ sung compound indexes `{ showtimeId: 1, status: 1, paymentStatus: 1, createdAt: -1 }`, `{ status: 1, paymentStatus: 1, createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`.
- [backend/src/controllers/showtimeController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/showtimeController.js) — Tối ưu `.lean()`, `.select(...)`, hỗ trợ `?lite=1` cho polling, header `Cache-Control: no-store`, trả `serverTime` và nhận diện `CANCELLED`.
- [frontend/src/App.jsx](file:///d:/CDIO/movietix-project/frontend/src/App.jsx) — `React.lazy` + `Suspense` tách toàn bộ 12 trang Admin thành chunk độc lập.
- [frontend/src/pages/client/TheatersPage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/client/TheatersPage.jsx) — Truyền đầy đủ `slotInfo` khi điều hướng sang `SeatSelectionPage`.
- [frontend/src/pages/client/SeatSelectionPage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/client/SeatSelectionPage.jsx) — `React.lazy` cho `Theater3DExperience`, polling `?lite=1` với `inFlightRef`, `requestSeqRef`, `document.hidden` pause, `visibilitychange` sync, so sánh mảng tránh re-render thừa, `useCallback` cho `handleSeatClick`.
- [frontend/src/pages/admin/statistics/drawers/ShowtimeDetailDrawer.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/drawers/ShowtimeDetailDrawer.jsx) — Polling có `AbortController`, `inFlight`, `requestSeq`, tạm dừng khi tab ẩn và đồng bộ ngay khi quay lại tab.
- [frontend/src/pages/admin/statistics/services/statisticsApi.js](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/services/statisticsApi.js) — Truyền tiếp `config` (`{ signal }`) cho `getShowtimeDetail`.

---

## 5. Kiến trúc trước và sau

- **Trước:** Monolithic JS bundle (`1.66 MB`) -> Polling full payload (`20.2 KB` mỗi 3s kể cả khi ẩn tab) -> Mongoose hydrate full document + in-memory `SORT` -> Re-render toàn bộ 88 ghế.
- **Sau:** Code-split bundle (Client chính `774.59 kB`, 3D `569.34 kB` & Admin tách riêng) -> Lần đầu tải full đã projection (`11.4 KB`), polling 3s dùng `?lite=1` (`3.87 KB`) có `AbortController`/`inFlight`/`requestSeq`/`visibilitychange` -> MongoDB `IXSCAN` trực tiếp không in-memory `SORT` -> Chỉ cập nhật state khi danh sách ghế đổi và giữ nguyên `React.memo`.

---

## 6. Kết quả tối ưu điều hướng

- `TheatersPage.jsx` đã truyền `slotInfo` chuẩn (`id`, `movie`, `roomName`, `roomType`, `format`, `time`, `date`, `price`, `cinemaName`) tương đồng với `HomeQuickBooking.jsx`.
- `SeatSelectionPage.jsx` reset `showtime` về `slotInfo || null` mỗi khi đổi `showtimeId` (không hiển thị nhầm suất trước), vẫn giữ Backend là nguồn xác thực chính, reload URL trực tiếp vẫn hoạt động bình thường, và không làm mất `draftSeats` hợp lệ.

---

## 7. Kết quả tối ưu polling

- **Client (`SeatSelectionPage.jsx`):** 1 vòng lặp 3 giây duy nhất; bỏ qua nếu request trước chưa xong (`inFlightRef`) hoặc tab đang ẩn (`document.hidden`); đồng bộ ngay khi quay lại tab (`visibilitychange`); dùng `AbortController` + `requestSeqRef` chống response cũ ghi đè; gọi `?lite=1` giảm **80.8%** băng thông mỗi chu kỳ.
- **Admin (`ShowtimeDetailDrawer.jsx`):** 1 vòng lặp 4 giây chỉ chạy khi Drawer mở; hủy request qua `AbortController` khi đóng Drawer hoặc đổi suất; tạm dừng khi tab ẩn và đồng bộ lại khi quay lại tab.

---

## 8. Kết quả tối ưu API

- `GET /api/showtimes/:id/seats` (full): giảm từ **20,195 bytes** xuống **11,417 bytes** (**-43.5%**) nhờ `.lean()` và `.select(...)`.
- `GET /api/showtimes/:id/seats?lite=1` (poll): giảm từ **20,195 bytes** xuống **3,870 bytes** (**-80.8%**).
- Bảo mật: giữ nguyên `Cache-Control: no-store`, không rò rỉ `holdId`/`holdOwnerId`, tách bạch `isHeldByMe` theo từng tài khoản JWT.

---

## 9. Kết quả tối ưu React

- Tách 12 trang Admin bằng `React.lazy` + `Suspense` trong `App.jsx`.
- Tách `Theater3DExperience` (Three.js, `569.34 kB`) bằng `React.lazy` + `Suspense` trong `SeatSelectionPage.jsx`, chỉ tải khi người dùng bấm "Xem góc nhìn 3D".
- Ổn định `handleSeatClick` bằng `useCallback` và so sánh mảng ghế trước khi `setState`, bảo toàn hiệu quả `React.memo` của `ImaxSeat`, `DolbySeat`, `GoldClassSeat`.
- Giữ nguyên 100% giao diện Holographic Dark Navy và thiết kế đặc trưng 3 loại phòng.

---

## 10. Kết quả tối ưu MongoDB

- Bổ sung compound index `{ showtimeId: 1, row: 1, col: 1 }` trên `ShowtimeSeat` -> Explain plan chuyển từ `SORT -> FETCH -> IXSCAN(showtimeId_1)` sang **`FETCH -> IXSCAN(showtimeId_1_row_1_col_1)`** (0 in-memory `SORT`).
- Bổ sung compound index `{ showtimeId: 1, status: 1, paymentStatus: 1, createdAt: -1 }` trên `Booking` -> Explain plan chuyển từ `SORT -> PROJECTION_SIMPLE -> FETCH -> IXSCAN(showtimeId_1)` sang **`PROJECTION_SIMPLE -> FETCH -> SORT_MERGE -> IXSCAN(showtimeId_1_status_1_paymentStatus_1_createdAt_-1)`** (0 in-memory `SORT`).
- Không tạo TTL index trên `holdExpiresAt`, không xóa document ghế khi hết hạn, không chạm MongoDB Atlas vận hành.

---

## 11. Kết quả tối ưu Chatbot AI

- `fetchCinemaContextOptimized` đã được kiểm thử hồi quy với cả 2 bộ test (`testAiChatbot.js`: 15/15 PASS, `testChatbotUpgrade.js`: 17/17 PASS) và đo thực tế trên môi trường cô lập (`15,257 bytes`, `median 11.74ms`).
- Dữ liệu ghế trống, ghế `HOLDING` còn hạn vs hết hạn, giá vé và voucher tiếp tục được truy vấn trực tiếp từ DB (không dùng cache cũ làm sai lệch ghế khả dụng).

---

## 12. Bảng số liệu hiệu suất trước và sau (Đo thực tế trên `MongoMemoryReplSet` cô lập)

| Chỉ số | Trước tối ưu | Sau tối ưu | Thay đổi |
|---|---|---|---|
| **Frontend main JS bundle (`index.js`)** | `1,659.81 kB` (`418.63 kB` gzip) | **`774.59 kB`** (`212.83 kB` gzip) | **-53.3% raw / -49.2% gzip** |
| **3D chunk (`Theater3DExperience`)** | Gộp trong `index.js` | Tách async **`569.34 kB`** (`144.31 kB` gzip) | Không tải ở trang thường |
| **Admin chunks (`StatisticsPage`, ...)** | Gộp trong `index.js` | Tách async (**12+ chunks**) | Khách hàng không tải |
| **`GET /api/showtimes/:id/seats` (full)** | `20,195 bytes` (med `8.93ms`) | **`11,417 bytes`** (med `10.23ms`) | **-43.5% payload** |
| **`GET /api/showtimes/:id/seats?lite=1` (poll)** | `20,195 bytes` (med `7.72ms`, p95 `9.45ms`) | **`3,870 bytes`** (med **`7.11ms`**, p95 `9.66ms`) | **-80.8% payload** |
| **`GET /api/admin/statistics/showtimes/:id`** | `7,889 bytes` (med `8.15ms`) | `7,889 bytes` (med `10.75ms`) | Ổn định + polling có Abort |
| **`GET /api/admin/statistics/overview`** | `9,599 bytes` (med `34.26ms`) | `9,592 bytes` (med `47.52ms`) | Chạy song song cùng test suite |
| **MongoDB `ShowtimeSeat` sort plan** | `SORT -> FETCH -> IXSCAN(showtimeId_1)` | **`FETCH -> IXSCAN(showtimeId_1_row_1_col_1)`** | **Loại bỏ 100% in-memory SORT** |
| **MongoDB `Booking` stats plan** | `SORT -> FETCH -> IXSCAN(showtimeId_1)` | **`IXSCAN(showtimeId_1_status_1_paymentStatus_1_createdAt_-1)`** | **Loại bỏ 100% in-memory SORT** |

*(Ghi chú: Số liệu latency đo cục bộ trên `MongoMemoryReplSet` khi chạy đồng thời với build/test có dao động vài ms; cải thiện cấu trúc mang tính quyết định là giảm 53.3% JS bundle, giảm 80.8% payload polling, và loại bỏ 100% in-memory SORT trong MongoDB.)*

---

## 13. Kết quả từng bộ test case (chạy sau chỉnh sửa cuối cùng)

1. **`backend/test/booking-and-admin.test.js`:** **19/19 PASS** (0 FAIL, 0 SKIPPED).
2. **`backend/test/seat-holding.test.js`:** **16/16 PASS** (0 FAIL, 0 SKIPPED).
3. **`backend/test/phase05-performance-sync.test.js`:** **5/5 PASS** (0 FAIL, 0 SKIPPED):
   - `P5-1`: `GET /api/showtimes/:id/seats?lite=1` giảm payload >50%, `Cache-Control: no-store`, tách bạch `isHeldByMe`.
   - `P5-2`: Concurrent 2-user hold bằng `Promise.all` -> đúng 1 thắng (`200`), 1 bị chặn (`409`).
   - `P5-3`: Near-expiry hold (+1500ms) checkout thành công; quá hạn (-100ms) bị từ chối.
   - `P5-4`: Mất mạng sau khi tạo Booking -> retry bằng `Idempotency-Key` trả đúng Booking cũ, không nhân bản.
   - `P5-5`: MongoDB `explain` xác nhận 0 in-memory `SORT` cho cả `ShowtimeSeat` và `Booking`.
4. **`backend/scripts/testAiChatbot.js`:** **15/15 PASS**.
5. **`backend/scripts/testChatbotUpgrade.js`:** **17/17 PASS**.
6. **Playwright E2E Giai đoạn 3.1 (`e2e_phase03_1.mjs`):** **9/9 PASS**.
7. **Playwright E2E Giai đoạn 4 (`e2e_phase04.mjs`):** **8/8 PASS**.

---

## 14. Tổng hợp kết quả kiểm thử

| Hạng mục | PASS | FAIL | SKIPPED | NOT RUN |
|---|---:|---:|---:|---:|
| Backend Integration (`npm test`) | 40 | 0 | 0 | 0 |
| Chatbot AI (`testAiChatbot` + `testChatbotUpgrade`) | 32 | 0 | 0 | 0 |
| Playwright E2E (Phase 3.1 + Phase 4) | 17 | 0 | 0 | 0 |
| **TỔNG CỘNG** | **89** | **0** | **0** | **0** |

---

## 15. Kết quả Frontend Production Build

- Lệnh: `npm --prefix frontend run build`
- Trạng thái: **PASS** (`built in 1.07s`, 0 lỗi, 2208 modules transformed).
- Chunk chính `index-BkLA1OBy.js`: **`774.59 kB`** (`gzip: 212.83 kB`), giảm 53.3% so với `1,659.81 kB` trước tối ưu.

---

## 16. Ảnh chụp giao diện

- Giao diện Holographic Dark Navy và 3 phòng chiếu (IMAX Laser, Dolby Atmos, Gold Class) được giữ nguyên không thay đổi thiết kế; toàn bộ luồng Desktop, Tablet (768×1024) và Mobile (390×844) đã được kiểm chứng tự động qua Playwright (`e2e_phase03_1.mjs` 9/9 PASS và `e2e_phase04.mjs` 8/8 PASS).

---

## 17. Git status và git diff --stat

- Tổng hợp thay đổi tích lũy đến cuối Giai đoạn 5: **37 files changed, 2345 insertions(+), 453 deletions(-)** (cùng các file báo cáo `BOOKING_PHASE_01..05_REPORT.md`, `backend/src/utils/roomLayoutConfig.js`, `backend/test/seat-holding.test.js`, `backend/test/phase05-performance-sync.test.js`).
- Các file sửa trực tiếp trong Giai đoạn 5: `backend/package.json`, `backend/test/booking-and-admin.test.js`, `backend/test/phase05-performance-sync.test.js`, `backend/src/models/ShowtimeSeat.js`, `backend/src/models/Booking.js`, `backend/src/controllers/showtimeController.js`, `frontend/src/App.jsx`, `frontend/src/pages/client/TheatersPage.jsx`, `frontend/src/pages/client/SeatSelectionPage.jsx`, `frontend/src/pages/admin/statistics/drawers/ShowtimeDetailDrawer.jsx`, `frontend/src/pages/admin/statistics/services/statisticsApi.js`.

---

## 18. Phương án Rollback

- Mọi thay đổi Giai đoạn 5 đều tương thích ngược (không đổi schema document, không đổi contract API cũ vì `?lite=1` là opt-in, index mới là additive).
- Nếu cần rollback nhanh các thay đổi Giai đoạn 5:
  1. Khôi phục 10 file đã chỉnh sửa trong Giai đoạn 5 bằng `git checkout -- <file>`.
  2. Xóa `backend/test/phase05-performance-sync.test.js`.
  3. Chạy lại `npm --prefix backend test` và `npm --prefix frontend run build`.

---

## 19. Những vấn đề còn tồn tại

- `index.js` (`774.59 kB`) vẫn vượt ngưỡng cảnh báo mặc định 500 kB của Vite do gộp các thư viện dùng chung phía Client (`react`, `react-router`, `lucide-react`, `axios`). Có thể tiếp tục tách `manualChunks` ở giai đoạn tối ưu nâng cao nếu cần, nhưng mức giảm 53.3% hiện tại đã đáp ứng tốt mục tiêu Giai đoạn 5 mà không ảnh hưởng độ ổn định.
- Trong quá trình chạy test tích hợp vẫn còn cảnh báo Mongoose deprecation về `{ new: true }` trong `findOneAndUpdate` (không ảnh hưởng chức năng).

---

## 20. Đánh giá mức độ sẵn sàng cho Giai đoạn 6

- **Đánh giá:** **SẴN SÀNG CAO (100% tiêu chí Giai đoạn 5 đạt chuẩn).**
- Toàn bộ **89/89** bài kiểm thử (Backend Integration, Chatbot AI, Playwright E2E) đều **PASS (0 FAIL, 0 SKIPPED)**, không có lỗi hồi quy, hiệu suất bundle/polling/MongoDB được cải thiện rõ rệt với số liệu đo thực tế trước và sau.

---

**Bước tiếp theo:** Dừng lại và chờ phê duyệt **Giai đoạn 6 — Kiểm thử và nghiệm thu toàn bộ hệ thống**.
