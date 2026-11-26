# BÁO CÁO KIỂM TOÁN & NGHIỆM THU PHASE 1.1 – TÍNH NĂNG LẶP LỊCH CHIẾU (D'AVENOR CINEMA)

- **Ngày thực hiện:** 26/11/2026
- **Dự án:** D’AVENOR CINEMA (`d:\CDIO\movietix-project`)
- **Nhánh Git hiện tại:** `feature/recurring-showtimes`
- **Commit đối chiếu ổn định:** `2ffda29` (`CDIO v1.0`)
- **Môi trường kiểm thử ghi dữ liệu:** `MongoMemoryReplSet` độc lập 100% (tuyệt đối không ghi/xóa/seed dữ liệu kiểm thử lên MongoDB Atlas `LIVE` hoặc `DEMO`).

---

## I. KẾT QUẢ KIỂM TOÁN CHI TIẾT TỪNG MỤC (`REC-01` ĐẾN `REC-09`)

### 1. `REC-01` – Kiểm toán sơ đồ ghế của 9 phòng chiếu vật lý
- **Kết quả đối chiếu source thực tế với commit `2ffda29`:**
  - Tại [backend/src/utils/roomLayoutConfig.js](file:///d:/CDIO/movietix-project/backend/src/utils/roomLayoutConfig.js#L21-L55) và [frontend/src/components/seat-booking/seatLayout.js](file:///d:/CDIO/movietix-project/frontend/src/components/seat-booking/seatLayout.js#L8-L49), cấu hình ghế chuẩn đang vận hành trên toàn hệ thống (không thay đổi so với commit `2ffda29`) là:
    ```js
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    rowColsMap: { A: 12, B: 12, C: 12, D: 12, E: 12, F: 12, G: 12, H: 4 },
    aisleAfterCol: 6,
    rowHCols: 4,
    rowHAisleAfterCol: 2,
    totalSeats: 88,
    tierCounts: { STANDARD: 48, VIP: 36, SWEETBOX: 4 }
    ```
  - Ghi chú chú thích cũ ở đầu file `roomLayoutConfig.js` từng viết `"8 hàng A–H × 11 cột"`, nhưng tại hàm `isValidRoomSeatTemplate()` trong [backend/src/controllers/adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js#L278-L317) (đã có từ commit `2ffda29`) ghi rõ:
    > *"Nếu là phòng 88 ghế chuẩn của D'AVENOR CINEMA: phải khớp sơ đồ chuẩn A-G (12 ghế/hàng) và H (4 ghế), tuyệt đối không dùng nhầm mẫu ghế cũ 8x11 (H có 11 ghế)."*
- **Đồng bộ giữa 2D, 3D, Admin và Chatbot AI:**
  - **Sơ đồ 2D khách hàng ([SeatSelectionPage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/client/SeatSelectionPage.jsx) & [SeatGrid.jsx](file:///d:/CDIO/movietix-project/frontend/src/components/seat-booking/SeatGrid.jsx)):** Sử dụng `createSeatLayout(seats, roomType)` trong `seatLayout.js` (hàng A–G tách lối đi sau cột 6: `6 trái | AISLE | 6 phải`; hàng H 4 ghế tách lối đi sau cột 2: `2 trái | AISLE | 2 phải`).
  - **Sơ đồ 3D khách hàng ([Theater3DExperience.jsx](file:///d:/CDIO/movietix-project/frontend/src/components/seat-booking/Theater3DExperience.jsx)):** Sử dụng chung hàm `createSeatLayout()` và `seatEyePosition()` từ `seatLayout.js`.
  - **Admin Drawer & Giám sát ghế ([ShowtimeDetailDrawer.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/drawers/ShowtimeDetailDrawer.jsx#L193-L200)):** Sử dụng chung `SEAT_LAYOUT_CONFIG` và `resolveRowAisleSplitCol()` từ `seatLayout.js`.
  - **Chatbot AI gợi ý ghế liền nhau ([cinemaContextService.js](file:///d:/CDIO/movietix-project/backend/src/services/ai/cinemaContextService.js#L66-L108)):** Sử dụng chung `SEAT_GRID_CONFIG.aisleAfterCol = 6` và `SEAT_GRID_CONFIG.rowHAisleAfterCol = 2`.
- **Đối chiếu 1-1 giữa suất chiếu tạo đơn lẻ và suất chiếu tạo lặp (Test #30):**
  - Cả `scheduleInRoom` (tạo 1 suất) và `commitRecurringShowtimes` (tạo lặp lịch) đều gọi chung `resolveSeatTemplatesForRoom(room)` và `isValidRoomSeatTemplate(seatTemplates, 88)`.
  - Đã kiểm thử so sánh 1-1 toàn bộ 88 phần tử `{ seatNumber, row, col, type, status }` giữa suất đơn lẻ và suất lặp lịch trên tất cả loại phòng (01–03 `IMAX Laser`, 04–06 `Dolby Atmos`, 07–09 `Gold Class`): **khớp 100%**, mỗi suất có inventory riêng theo `showtimeId` + `roomId`, tất cả ghế khởi tạo mới đều `status: 'AVAILABLE'`, không sao chép `bookingId`, `holdId`, `holdOwnerId` hoặc `holdExpiresAt`.
- **Trạng thái `REC-01`:** **PASS (Không có mâu thuẫn cấu trúc phòng trong code thực thi)**.

---

### 2. `REC-02` – Kiểm tra lịch chiếu qua tháng và qua năm
- **Các điểm đã rà soát & phát hiện lỗi:**
  1. **[backend/src/controllers/movieController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/movieController.js#L266-L276) (`getMovies`):**
     - **Lỗi phát hiện (BUG-01):** Dòng 272 sử dụng `const dateStr = startTimeDate.toISOString().slice(0, 10);` (lấy ngày theo UTC thay vì `Asia/Ho_Chi_Minh`) và `toLocaleTimeString('vi-VN')` không truyền `timeZone: 'Asia/Ho_Chi_Minh'`. Với các suất chiếu từ `00:00` đến `06:59` giờ Việt Nam hoặc khi server chạy ở `TZ=UTC`, `dateStr` bị lệch lùi 1 ngày (ví dụ ngày `01/12/2026` đầu tháng bị tụt về `30/11/2026` tháng trước).
     - **Khắc phục:** Chuyển sang `startTimeDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })` và thêm `timeZone: 'Asia/Ho_Chi_Minh'` cho `toLocaleTimeString`.
  2. **[backend/src/controllers/cinemaController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/cinemaController.js#L300-L325) (`getCinemaShowtimes`):**
     - **Lỗi phát hiện (BUG-02):** Bên cạnh dòng 399 đã gỡ bỏ `screening.slice(0, 7) !== release.slice(0, 7)`, truy vấn `monthMovies` (dòng 300–312) trước đó chỉ tìm phim có `releaseDate` nằm trong tháng đang xem. Nếu phim khởi chiếu tháng 11/2026 được lặp lịch sang tháng 12/2026 hoặc tháng 01/2027, danh sách `monthMovies` của tháng 12/2026 không bao gồm phim đó.
     - **Khắc phục:** Mở rộng `monthQueryPromise` kết hợp `Showtime.distinct('movieId', ...)` để `monthMovies` bao gồm cả các phim đang chiếu (`status !== 'ENDED'`) có suất chiếu hoạt động trong tháng đang xem.
  3. **[frontend/src/pages/client/TheatersPage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/client/TheatersPage.jsx#L66-L108):**
     - **Lỗi phát hiện (BUG-03):** Hàm `jumpToPeriod('next_week')` dùng `nextMon.toISOString().slice(0, 10)` (UTC) và mảng 30 ngày dùng múi giờ trình duyệt cục bộ thay vì cố định `Asia/Ho_Chi_Minh`.
     - **Khắc phục:** Chuẩn hóa toàn bộ phép sinh dải 30 ngày, `nextMonthStart` và `jumpToPeriod` trên `TheatersPage.jsx` theo `toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })`.
  4. **Các module khác đã kiểm tra:**
     - `getMovieSchedule` (`movieController.js` dòng 360–480): Không chặn theo tháng phát hành; chỉ chặn `date < localRelease`, suất đã hủy (`cancelledAt != null`), suất bị khóa (`isLocked: true`), hoặc suất đã bắt đầu (`lifecycleStatus !== 'UPCOMING'`).
     - `MovieShowtimesSection.jsx`, `HomeMovieTabs.jsx`, `HomeQuickBooking.jsx`: Hoạt động tốt qua ranh giới tháng và năm, giữ nguyên chính sách mở bán trước tối đa 7 ngày (`opensMoreThanSevenDaysAhead`).
     - `SeatSelectionPage.jsx`, Admin Timeline (`ShowtimeManagePage.jsx`), Chatbot AI (`cinemaContextService.js`): Lưu UTC trong MongoDB và hiển thị đúng theo `Asia/Ho_Chi_Minh`.
- **Trạng thái `REC-02`:** **PASS**.

---

### 3. `REC-03` – Kiểm tra API và phân quyền
- **Xác minh Route & Middleware:**
  - Tại [backend/src/routes/adminRoutes.js](file:///d:/CDIO/movietix-project/backend/src/routes/adminRoutes.js#L89-L90):
    - `router.post('/showtimes/recurring/preview', authenticateAdmin, previewRecurringShowtimes);`
    - `router.post('/showtimes/recurring/commit', authenticateAdmin, commitRecurringShowtimes);`
  - Frontend [ShowtimeManagePage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/ShowtimeManagePage.jsx#L635-L702) gọi đúng `api.post('/admin/showtimes/recurring/preview', ...)` và `api.post('/admin/showtimes/recurring/commit', ...)`.
  - Middleware `authenticateAdmin` ([authMiddleware.js](file:///d:/CDIO/movietix-project/backend/src/middleware/authMiddleware.js#L38)) trả về:
    - `401 Unauthorized` khi không có Bearer Token, token sai hoặc hết hạn.
    - `403 Forbidden` khi đăng nhập bằng tài khoản khách hàng (`CUSTOMER` / `VIP`).
- **Lỗi phát hiện (BUG-04):**
  - Trong `commitRecurringShowtimes`, trường `createdBy` trước đó gán `req.user?._id || null`, trong khi middleware `authenticateAdmin` gán thông tin quản trị viên vào `req.admin` (`authenticate([AdminUser, User], ['ADMIN'], 'admin')`).
  - **Khắc phục:** Sửa thành `createdBy: req.admin?._id || req.user?._id || null`.
- **Kiểm thử HTTP thực tế (Test #31):** Đã kiểm thử trực tiếp qua HTTP API cho cả `preview` và `commit` với 3 trường hợp: không token (`401`), token `CUSTOMER` (`403`), token `ADMIN` (`200`/`201`), cùng kiểm tra đầy đủ `ObjectId`, ngày, giờ, `roomId`, `movieId`, `formatFeature`.
- **Trạng thái `REC-03`:** **PASS**.

---

### 4. `REC-04` & `REC-05` – Giờ hoạt động và thời gian vệ sinh
- **Xác minh quy tắc chuẩn trong phiên bản ổn định `2ffda29`:**
  - Tại `planBatchSchedule` ([adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js#L1058-L1089)) và `validateManualTimeSlotValue` ([ShowtimeManagePage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/ShowtimeManagePage.jsx#L819)):
    - Giờ mở cửa rạp: `08:00` (`OPEN_MINUTES = 8 * 60`).
    - Giờ bắt đầu suất chiếu muộn nhất trong ngày vận hành: **`22:30`** (`HARD_LATEST_START_MINUTES = 22 * 60 + 30`).
    - Giờ đóng cửa (kết thúc phim + vệ sinh xong): **`02:00` sáng hôm sau (+1 ngày)** (`CLOSE_MINUTES = 26 * 60`).
    - Thời gian vệ sinh phòng ([showtimeLifecycleService.js](file:///d:/CDIO/movietix-project/backend/src/services/showtimeLifecycleService.js#L4-L14) & [Showtime.js](file:///d:/CDIO/movietix-project/backend/src/models/Showtime.js#L42)): Mặc định **`20 phút`** (`DEFAULT_CLEANING_MINUTES = 20`), cho phép cấu hình **`15`–`20` phút** (`normalizeCleaningMinutes`).
- **Lỗi phát hiện (BUG-05):**
  1. Trong `adminController.js`, hằng số `RECURRING_LATEST_START_MIN` của tính năng lặp lịch và validation giờ thủ công trên `ShowtimeManagePage.jsx` đang để `23:30` thay vì `22:30`.
  2. API `GET /api/admin/showtimes/available-slots` đang quét từ `08:30` đến `23:30` và chưa kiểm tra điều kiện kết thúc phim + vệ sinh `<= 02:00 (+1 ngày)`.
- **Khắc phục:**
  - Đồng bộ `RECURRING_LATEST_START_MIN = 22 * 60 + 30` (`22:30`) trong `adminController.js` và `ShowtimeManagePage.jsx` (`08:00 – 22:30`).
  - Cập nhật `getAvailableShowtimeSlots` quét trong khung `08:00 – 22:30` và lọc `startMin + totalSlotMinutes <= 26 * 60` (`02:00` sáng hôm sau).
  - Giữ nguyên khả năng tạo suất lẻ linh hoạt cho các bài kiểm thử tự động theo offset giờ (`Date.now() + N hours`) trong `booking-and-admin.test.js`.
- **Trạng thái `REC-04` & `REC-05`:** **PASS**.

---

### 5. `REC-06` – Preview, Commit và chống tạo trùng
- **Các lỗi bảo mật & toàn vẹn dữ liệu phát hiện khi kiểm toán sâu:**
  1. **BUG-06 (Client Tampering `previewSignature` & `confirmedSlots`):**
     - Trước đây `previewSignature` chỉ là chuỗi ghép thông thường và chưa được xác thực chữ ký HMAC tại bước Commit; nếu client chỉnh sửa `confirmedSlots` (chèn thêm suất ngoài danh sách Preview hoặc sửa `price` về `1đ` khi đang ở chế độ `pricingMode: 'auto'`), Backend có thể chấp nhận giá trị từ client.
     - **Khắc phục:**
       - Ký `previewSignature` bằng `HMAC-SHA256` (`buildRecurringSignature`).
       - Tại bước Commit, xác thực chữ ký HMAC của `previewSignature`, đối chiếu toàn bộ tham số (`movieId`, `roomId`, `formatFeature`, `cleaningMinutes`, `startDate`, `endDate`, `daysOfWeek`, `timeSlots`) và bắt buộc mọi suất trong `confirmedSlots` phải nằm trong tập suất hợp lệ đã được Preview phê duyệt.
       - Tuyệt đối không tin giá vé `s.price` do client gửi lên khi `pricingMode === 'auto'` — Backend luôn tính lại giá vé từ ma trận `calculatePricesFromConfig(..., { preferRuleMatrix: true })`.
  2. **BUG-07 (Idempotency sau khi Backend khởi động lại & dùng lại `requestId` với payload khác):**
     - Trước đây `requestId` chỉ lưu trong `Map` trên RAM (`_recurringRequestCache`) và chưa lưu fingerprint của payload. Nếu server restart hoặc nếu client gửi lại cùng `requestId` nhưng với payload khác, hệ thống chưa phân biệt được.
     - **Khắc phục:**
       - Bổ sung trường `requestId` (có index) và `requestFingerprint` (SHA-256 của toàn bộ tham số & danh sách suất) vào schema `Showtime` ([Showtime.js](file:///d:/CDIO/movietix-project/backend/src/models/Showtime.js#L38-L40)).
       - Tại bước Commit, kiểm tra cả trên RAM (`_recurringRequestCache`) và trong MongoDB (`Showtime.findOne({ requestId })`). Nếu `requestId` đã tồn tại, trả về HTTP `409` (`duplicateRequest: true`) và nếu `requestFingerprint` khác nhau thì gắn cờ `payloadMismatch: true` để từ chối rõ ràng.
- **Trạng thái `REC-06`:** **PASS**.

---

### 6. `REC-07` – Kiểm thử hiệu năng (Performance Benchmark)
- **Môi trường đo:** `MongoMemoryReplSet` (1-node replica set trên máy local, Node.js `v24.14.1`).
- *Lưu ý:* Kết quả dưới đây phản ánh hiệu năng xử lý thuật toán, transaction và bulk insert trên `MongoMemoryReplSet` local, **không** trình bày như benchmark mạng thực tế của MongoDB Atlas Production.

| Quy mô số suất chiếu | Số ghế `ShowtimeSeat` tạo mới | Thời gian `preview` (ms) | Thời gian `commit` (ms) | Số `Showtime` trong DB | Số `ShowtimeSeat` trong DB | Lỗi Transaction / Timeout | Dữ liệu rác còn sót khi giả lập lỗi |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **14 suất** (7 ngày × 2 khung giờ) | **1.232 ghế** | `154.38 ms` *(cold start)* | `373.81 ms` | 14 | 1.232 | 0 | 0 |
| **30 suất** (10 ngày × 3 khung giờ) | **2.640 ghế** | `19.77 ms` | `565.21 ms` | 30 | 2.640 | 0 | 0 |
| **90 suất** (15 ngày × 6 khung giờ) | **7.920 ghế** | `15.86 ms` | `1.451.65 ms` | 90 | 7.920 | 0 | 0 |
| **180 suất** (30 ngày × 6 khung giờ — tối đa) | **15.840 ghế** | `24.59 ms` | `3.284.93 ms` | 180 | 15.840 | 0 | 0 |

- **Kiểm tra Rollback ở quy mô tối đa (180 suất / 15.840 ghế):** Khi giả lập lỗi ở bước `ShowtimeSeat.insertMany`, MongoDB Transaction rollback 100%, số bản ghi `Showtime` và `ShowtimeSeat` còn sót lại trong DB là **`0`**.
- **Trạng thái `REC-07`:** **PASS**.

---

### 7. `REC-08` – Kiểm thử giao diện 15 bước bằng Playwright
Đã thực thi tự động toàn bộ 15 bước liên hoàn trên trình duyệt Chromium (Playwright) với backend `MongoMemoryReplSet` cô lập:

| Bước | Nội dung kiểm thử trên trình duyệt | Kết quả |
| :---: | :--- | :---: |
| 1 | Mở modal tạo suất chiếu đơn lẻ | **PASS** |
| 2 | Chuyển sang tab lặp lịch chiếu (`🔁 Lặp lịch chiếu`) | **PASS** |
| 3 | Chọn phim (`Dune: Hành Tinh Cát – Phần 2`) và phòng chiếu (`Phòng 01 — IMAX Laser`) | **PASS** |
| 4 | Chọn khoảng ngày (`Từ ngày` – `Đến ngày`) | **PASS** |
| 5 | Chọn các thứ trong tuần (`Cả tuần`, `T2..CN`) | **PASS** |
| 6 | Chọn nhiều khung giờ (`10:30`, `19:00`) | **PASS** |
| 7 | Kiểm tra giá vé tự động theo khung giờ và loại phòng | **PASS** |
| 8 | Kiểm tra bảng Preview có xung đột (`3 hợp lệ`, `1 xung đột` kèm lý do chi tiết) | **PASS** |
| 9 | Thay đổi dữ liệu sau Preview (thêm khung giờ `14:30`) → Preview cũ tự động bị xóa, nút xác nhận bị khóa cho đến khi Preview lại | **PASS** |
| 10 | Kiểm tra tùy chọn bỏ qua xung đột (`skipConflicts` tắt → khóa nút xác nhận khi có xung đột; bật → cho phép tạo 5 suất hợp lệ) | **PASS** |
| 11 | Xác nhận tạo lịch (`5 suất chiếu mới` = `440 ghế ShowtimeSeat`) | **PASS** |
| 12 | Kiểm tra các suất chiếu mới xuất hiện ngay trên Admin Timeline | **PASS** |
| 13 | Kiểm tra suất chiếu mới xuất hiện trên trang Chi tiết phim phía khách hàng | **PASS** |
| 14 | Mở trang Chọn ghế `/booking/seat/:showtimeId` của suất mới, xác nhận đủ 88 ghế (`A1..G12`, `H1..H4`) | **PASS** |
| 15 | Kiểm tra giao diện responsive (`390×844` mobile) và kiểm tra Console / Page Errors (`0 errors`) | **PASS** |

- **Ảnh chụp nghiệm thu giao diện thực tế (`docs/acceptance-screenshots/`):**
  - [modal_single_showtime.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/modal_single_showtime.png)
  - [modal_recurring_showtimes.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/modal_recurring_showtimes.png)
  - [modal_recurring_preview_conflicts.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/modal_recurring_preview_conflicts.png)
  - [rec08_admin_timeline_created.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/rec08_admin_timeline_created.png)
  - [rec08_client_schedule_synced.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/rec08_client_schedule_synced.png)
  - [rec08_client_seatmap_88seats.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/rec08_client_seatmap_88seats.png)
  - [rec08_mobile_responsive_modal.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/rec08_mobile_responsive_modal.png)
- **Trạng thái `REC-08`:** **PASS**.

---

### 8. `REC-09` – Kiểm thử hồi quy toàn hệ thống

| Bộ kiểm thử / Hạng mục | Tổng số bài test | PASS | FAIL | SKIP | NOT RUN |
| :--- | ---: | ---: | ---: | ---: | ---: |
| `test/booking-and-admin.test.js` (Đặt vé, thanh toán, QR check-in, đổi/hủy vé, hoàn tiền, thống kê) | 16 | **16** | 0 | 0 | 0 |
| `test/seat-holding.test.js` (Giữ ghế 10 phút, TTL, chống đặt trùng ghế, concurrency) | 18 | **18** | 0 | 0 | 0 |
| `test/phase05-performance-sync.test.js` (Đồng bộ giá vé, khuyến mãi, hiệu năng truy vấn) | 6 | **6** | 0 | 0 | 0 |
| `test/phase06-acceptance.test.js` (Race conditions RC-1..RC-8, bảo mật SEC-1, đồng bộ AI) | 9 | **9** | 0 | 0 | 0 |
| `test/group02-qb09-fixes.test.js` (9 phòng chiếu vật lý, sơ đồ 88 ghế, xếp lịch hàng loạt) | 5 | **5** | 0 | 0 | 0 |
| `test/group03-search-detail-review.test.js` (Tìm kiếm tiếng Việt, chi tiết phim, đánh giá đã xác thực) | 2 | **2** | 0 | 0 | 0 |
| `test/bulk-delete-and-lifecycle.test.js` (Xóa hàng loạt an toàn, vòng đời suất chiếu, suất qua nửa đêm) | 5 | **5** | 0 | 0 | 0 |
| `test/recurring-showtimes.test.js` (34 kịch bản lặp lịch chiếu Phase 1 & Phase 1.1) | 34 | **34** | 0 | 0 | 0 |
| **Tổng cộng Backend Integration Tests (`npm --prefix backend test`)** | **95** | **95** | **0** | **0** | **0** |
| Kiểm thử Chatbot AI nâng cao (`node backend/scripts/testAdvancedChatbotSpec.js`) | 11 | **11** | 0 | 0 | 0 |
| Kiểm thử E2E Giao diện Playwright (`REC-08` 15 bước) | 15 | **15** | 0 | 0 | 0 |
| Kiểm thử Hiệu năng & Rollback (`REC-07` 4 quy mô + 180-slot failure rollback) | 5 | **5** | 0 | 0 | 0 |
| Production Build Frontend (`npm --prefix frontend run build`) | 1 | **1** | 0 | 0 | 0 |

---

## II. TỔNG HỢP CÁC LỖI PHÁT HIỆN VÀ ĐÃ KHẮC PHỤC TRONG PHASE 1.1

| Mã lỗi | Mục liên quan | Nguyên nhân gốc | File & Vị trí đã sửa | Kết quả trước khi sửa | Kết quả sau khi sửa |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **BUG-01** | `REC-02` | `getMovies` dùng `toISOString().slice(0, 10)` (UTC) để trích xuất `date` của suất chiếu, gây lệch ngày cho các suất từ `00:00–06:59` giờ VN hoặc khi chạy `TZ=UTC`. | [movieController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/movieController.js#L266-L278) | Suất đầu ngày/đầu tháng có thể bị gán lùi sang ngày cuối tháng trước. | Luôn trích xuất ngày/giờ theo chuẩn `Asia/Ho_Chi_Minh`. |
| **BUG-02** | `REC-02` | `monthMovies` trong `getCinemaShowtimes` chỉ lọc theo `releaseDate` trong tháng đang xem, bỏ sót phim phát hành tháng trước nhưng có suất chiếu lặp sang tháng sau. | [cinemaController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/cinemaController.js#L300-L325) | `monthMovies` thiếu phim khởi chiếu tháng trước được chiếu tiếp sang tháng mới. | `monthMovies` bao gồm cả phim có suất chiếu hợp lệ trong tháng đang xem. |
| **BUG-03** | `REC-02` | `TheatersPage.jsx` sinh 30 ngày và `jumpToPeriod('next_week')` theo `toISOString()` (UTC) và múi giờ trình duyệt cục bộ. | [TheatersPage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/client/TheatersPage.jsx#L66-L105) | Có thể lệch ngày khi chọn "Tuần sau" hoặc "Tháng sau" quanh nửa đêm. | Đồng bộ 100% theo `Asia/Ho_Chi_Minh`. |
| **BUG-04** | `REC-03` | `authenticateAdmin` gán tài khoản Admin vào `req.admin`, nhưng `commitRecurringShowtimes` đọc `req.user?._id`. | [adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js#L3885) | `createdBy` bị `null` khi Admin tạo lịch lặp. | Ghi nhận chính xác `req.admin?._id || req.user?._id || null`. |
| **BUG-05** | `REC-04`, `REC-05` | `RECURRING_LATEST_START_MIN` và `getAvailableShowtimeSlots` cho phép mở suất đến `23:30` thay vì giới hạn chuẩn `22:30` của rạp. | [adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js#L960-L995), [ShowtimeManagePage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/ShowtimeManagePage.jsx#L576-L580) | Không nhất quán giữa Lặp lịch (`23:30`) và Xếp lịch hàng loạt (`22:30`). | Đồng bộ khung mở suất chuẩn `08:00 – 22:30`, kết thúc vệ sinh `<= 02:00 (+1 ngày)`. |
| **BUG-06** | `REC-06` | `previewSignature` chưa ký HMAC chống sửa đổi; `confirmedSlots` chưa đối chiếu tập suất đã ký trong `previewSignature` và còn nhận `s.price` từ client khi `pricingMode='auto'`. | [adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js#L2950-L3610) | Client cố tình can thiệp payload có thể sửa `previewSignature`, chèn suất ngoài Preview hoặc ép giá vé thấp. | Chặn `400 Bad Request` mọi hành vi sửa chữ ký hoặc chèn suất; luôn tính lại giá vé chuẩn từ DB khi `pricingMode='auto'`. |
| **BUG-07** | `REC-06` | `requestId` chỉ lưu trên RAM và chưa đối chiếu fingerprint của payload khi tái sử dụng cùng `requestId`. | [Showtime.js](file:///d:/CDIO/movietix-project/backend/src/models/Showtime.js#L38-L40), [adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js#L3615-L3665) | Mất trạng thái chống trùng nếu server restart; chưa báo `payloadMismatch` khi dùng lại `requestId` với dữ liệu khác. | Lưu bền vững `requestId` & `requestFingerprint` vào MongoDB; trả về `409` kèm `payloadMismatch: true` nếu khác payload. |

---

## III. CÁC VẤN ĐỀ CẦN NGƯỜI DÙNG QUYẾT ĐỊNH

- **Không còn vấn đề kỹ thuật hay mâu thuẫn nghiệp vụ nào bị treo.**
- Toàn bộ quy tắc sơ đồ 88 ghế (`A–G: 12 ghế`, `H: 4 ghế`), khung giờ vận hành (`08:00 – 22:30`, kết thúc vệ sinh trước `02:00` sáng hôm sau) và thời gian vệ sinh (`15–20 phút`, mặc định `20 phút`) đã được xác minh trực tiếp từ source code chuẩn tại commit `2ffda29` và đồng bộ hoàn chỉnh.

---

## IV. XÁC NHẬN AN TOÀN DỮ LIỆU, CẤU HÌNH DNS VÀ TRẠNG THÁI GIT

1. **Xác nhận không ghi dữ liệu kiểm thử vào MongoDB Atlas (`LIVE` hoặc `DEMO`):**
   - Toàn bộ 95 bài test tích hợp, bài đo hiệu năng `REC-07` (14, 30, 90, 180 suất) và bài kiểm thử giao diện 15 bước `REC-08` bằng Playwright đều khởi tạo và chạy trên `MongoMemoryReplSet` độc lập hoàn toàn.
   - Dữ liệu trên MongoDB Atlas `movietix_db` (`LIVE`) và `movietix_demo_db` (`DEMO`) được bảo toàn nguyên vẹn 100%.
2. **Xác nhận bảo toàn cấu hình DNS (`backend/src/config/db.js`):**
   - Giữ nguyên 100% hàm `configureOptionalDnsServers()` sử dụng `node:dns` và biến môi trường tùy chọn `DNS_SERVERS` trong [backend/src/config/db.js](file:///d:/CDIO/movietix-project/backend/src/config/db.js).
3. **Kết quả kiểm tra Git:**
   - `git branch --show-current`: `feature/recurring-showtimes`
   - `git diff --check`: **0 lỗi whitespace / conflict markers**.
   - `git status --short` & `git diff --stat`:
     ```text
      M backend/.env.example
      M backend/package.json
      M backend/src/config/db.js
      M backend/src/controllers/adminController.js
      M backend/src/controllers/cinemaController.js
      M backend/src/controllers/movieController.js
      M backend/src/models/Showtime.js
      M frontend/src/components/home/HomeMovieTabs.jsx
      M frontend/src/components/home/HomeQuickBooking.jsx
      M frontend/src/components/movie-detail/MovieShowtimesSection.jsx
      M frontend/src/pages/admin/ShowtimeManagePage.jsx
      M frontend/src/pages/client/TheatersPage.jsx
     ?? RECURRING_SHOWTIMES_IMPLEMENTATION_REPORT.md
     ?? RECURRING_SHOWTIMES_PHASE_01_1_VALIDATION.md
     ?? backend/test/recurring-showtimes.test.js
     ?? docs/acceptance-screenshots/modal_recurring_preview_conflicts.png
     ?? docs/acceptance-screenshots/modal_recurring_showtimes.png
     ?? docs/acceptance-screenshots/modal_single_showtime.png
     ?? docs/acceptance-screenshots/rec08_admin_timeline_created.png
     ?? docs/acceptance-screenshots/rec08_client_schedule_synced.png
     ?? docs/acceptance-screenshots/rec08_client_seatmap_88seats.png
     ?? docs/acceptance-screenshots/rec08_mobile_responsive_modal.png
     ```
     ```text
      backend/.env.example                               |    4 +
      backend/package.json                               |    2 +-
      backend/src/config/db.js                           |  110 ++
      backend/src/controllers/adminController.js         | 1311 ++++++++++++++++----
      backend/src/controllers/cinemaController.js        |   26 +-
      backend/src/controllers/movieController.js         |    6 +-
      backend/src/models/Showtime.js                     |    2 +
      frontend/src/components/home/HomeMovieTabs.jsx     |    3 +
      frontend/src/components/home/HomeQuickBooking.jsx  |    6 +-
      .../movie-detail/MovieShowtimesSection.jsx         |    5 +-
      frontend/src/pages/admin/ShowtimeManagePage.jsx    |  711 +++++++----
      frontend/src/pages/client/TheatersPage.jsx         |   35 +-
      12 files changed, 1741 insertions(+), 480 deletions(-)
     ```
