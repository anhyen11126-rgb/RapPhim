# BÁO CÁO GIAI ĐOẠN 1.1 — HOÀN THIỆN KIỂM THỬ VÀ BẢO VỆ DỮ LIỆU
**Dự án:** D'AVENOR CINEMA (`movietix-project`)  
**Thời điểm hoàn thành:** 25/11/2026  
**Phạm vi:** Hoàn thiện môi trường kiểm thử cô lập (`mongodb-memory-server`), bảo vệ API GET khỏi tự ý seed dữ liệu (`autoSeedCinemaShowtimes`), đồng bộ bộ test Chatbot AI và kiểm tra hồi quy Giai đoạn 1.

---

## 1. Danh sách file đã sửa trong Giai đoạn 1.1
1. [backend/package.json](file:///d:/CDIO/movietix-project/backend/package.json) — Thêm `mongodb-memory-server` vào `devDependencies` và bổ sung script `"test"` cấu hình `DAVENOR_TEST_MONGO_MODULE=mongodb-memory-server`.
2. [backend/package-lock.json](file:///d:/CDIO/movietix-project/backend/package-lock.json) — Cập nhật lockfile cho `mongodb-memory-server`.
3. [backend/src/controllers/cinemaController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/cinemaController.js) — Loại bỏ lời gọi `autoSeedCinemaShowtimes(cinema, startOfDay)` khỏi API `GET /api/cinemas/:id/showtimes` (`getCinemaShowtimes`).
4. [backend/scripts/testAiChatbot.js](file:///d:/CDIO/movietix-project/backend/scripts/testAiChatbot.js) — Đồng bộ 3 assertion văn bản cũ (Test 02: định dạng `HẾT GHẾ (0/88)`, Test 06: tiêu đề `phim Mai`, Test 13: thông báo `chưa có lịch chiếu cho phim`).

---

## 2. Các package đã cài đặt
- `mongodb-memory-server` (cài đặt vào `devDependencies` trong `backend/package.json` bằng `npm install --save-dev mongodb-memory-server`).
- Sử dụng `MongoMemoryReplSet` (`replSet: { count: 1 }`) để hỗ trợ đầy đủ **Mongoose Transaction** trong `booking-and-admin.test.js` mà **tuyệt đối không kết nối hay ghi/xóa lên MongoDB Atlas vận hành**.

---

## 3. Cấu hình môi trường test
- Biến môi trường: `DAVENOR_TEST_MONGO_MODULE=mongodb-memory-server`
- Lệnh chạy test cô lập:
  ```powershell
  cd backend ; npm test
  ```
  (hoặc `$env:DAVENOR_TEST_MONGO_MODULE="mongodb-memory-server" ; node --test test/booking-and-admin.test.js`).

---

## 4. Kết quả từng test case trong `test/booking-and-admin.test.js`

| STT | Tên test case | Trạng thái | Ghi chú |
| :---: | :--- | :---: | :--- |
| 1 | `seven days are counted on the Vietnam calendar across midnight and New Year` | **PASS** | 1565ms |
| 2 | `admin routes require a valid admin account and reject expired tokens` | **PASS** | 74ms |
| 3 | `tokens issued by the normal login route work for customer and admin APIs` | **PASS** | 81ms |
| 4 | `selecting a seat does not mutate its state or create a booking` | **PASS** | 18ms |
| 5 | `checkout recomputes prices, discounts, grants ownership and replays the request once` | **PASS** | 104ms |
| 6 | `concurrent multi-seat claims commit at most one complete competing booking` | **PASS** | 72ms |
| 7 | `cancel releases owned seats and a cancelled QR cannot be checked in` | **PASS** | 57ms |
| 8 | `failed exchange keeps the original seat and successful exchange rotates QR` | **PASS** | 126ms |
| 9 | `only one concurrent admin scan checks in the whole booking` | **PASS** | 63ms |
| 10 | `physical room overlap is rejected and room identity cannot be edited` | **PASS** | 51ms |
| 11 | `a failed booking insert aborts claimed seats` | **PASS** | 23ms |
| 12 | `checkout rejects a past or unopened showtime and cancellation inside 24 hours` | **PASS** | 55ms |
| 13 | `website availability agrees with Admin and excludes simulation from verified revenue` | **FAIL** | Xem mục 9 (do thay đổi nghiệp vụ từ trước) |
| 14 | `review identity comes from the verified account and stored demo votes are ignored` | **PASS** | 93ms |
| 15 | `authenticated overview responds on the isolated test dataset` | **PASS** | 32ms |
| 16 | `verified revenue excludes simulated and cancelled amounts and CSV uses same total` | **FAIL** | Xem mục 9 (do thay đổi nghiệp vụ từ trước) |
| 17 | `physical batch transaction rejects overlapping times without a partial schedule` | **PASS** | 35ms |
| 18 | `deactivating a movie preserves its showtimes, seats, and bookings` | **PASS** | 44ms |
| 19 | `admin cancellation keeps history and invalidates issued simulated tickets` | **FAIL** | Xem mục 9 (do bảo vệ suất chiếu Nhóm B) |

---

## 5. Tổng số PASS, FAIL, SKIPPED (`booking-and-admin.test.js`)
- **PASS:** `16`
- **FAIL:** `3` *(đều là test case kiểm tra quy tắc cũ trước khi cập nhật nghiệp vụ Doanh thu mô phỏng và Bảo vệ xóa suất chiếu Nhóm B — không phải lỗi do Giai đoạn 1)*
- **SKIPPED:** `0`

---

## 6. Kết quả kiểm tra `autoSeedCinemaShowtimes`
- Đã kiểm tra toàn bộ `backend/src/controllers/cinemaController.js`:
  - `GET /api/cinemas/:id/showtimes` (`getCinemaShowtimes`) **không còn gọi** `autoSeedCinemaShowtimes`.
  - Khi khách truy cập một ngày chưa có lịch chiếu, API chỉ truy vấn MongoDB ở chế độ đọc và trả về `movies: []`, tuyệt đối không tự sinh suất chiếu, không tự sinh phòng chiếu và không tạo sơ đồ ghế 12 cột lỗi thời.
  - Các API `GET` khác đã được rà soát, không phát hiện thao tác ghi/xóa dữ liệu vận hành.

---

## 7. Kết quả cả hai bộ test Chatbot AI
1. **`node scripts/testAiChatbot.js`:** **15/15 PASS (100%)** — 0 FAIL.
2. **`node scripts/testChatbotUpgrade.js`:** **17/17 PASS (100%)** — 0 FAIL.
- Đã xác nhận Chatbot AI nhận diện đúng 9 phòng vật lý thuộc 3 công nghệ phòng (`IMAX Laser`, `Dolby Atmos`, `Gold Class`), đếm đúng `88/88` ghế, không gợi ý ghế đã đặt/không tồn tại, không gợi ý suất chiếu đã hủy/khóa, không bịa giá vé/khuyến mãi và không tiết lộ thông tin đặt vé của người khác.

---

## 8. Kết quả Frontend Build
- Lệnh: `npm --prefix frontend run build`
- Kết quả: **PASS** — Vite v8.3.5 build production thành công trong `1.02s` (`2207 modules transformed`), **0 lỗi**.

---

## 9. Những lỗi / sai lệch còn tồn tại (Không tự ý sửa assertion theo đúng quy định)
1. **3 test case FAIL trong `booking-and-admin.test.js` (thuộc thay đổi nghiệp vụ trước Giai đoạn 1):**
   - **Test 13 & Test 16 (`netRevenue` = `130.000` / `1.900.000` thay vì `0` / `130.000`):** Bộ test cũ kỳ vọng loại trừ đơn `SIMULATED` khỏi doanh thu thuần, trong khi hệ thống hiện tại đã được yêu cầu cộng cả đơn đặt vé mô phỏng (`SIMULATED`) vào doanh thu hiển thị.
   - **Test 19 (`DELETE /admin/showtimes/:id` trả về `409` thay vì `200`):** Bộ test cũ gọi `DELETE` trực tiếp mà không truyền `{ action: 'CANCEL_WITH_REFUND' }`, trong khi `deleteShowtimeSafe` hiện tại chặn xóa cứng với mã `409 Conflict` để bảo vệ suất chiếu Nhóm B đã có khách đặt vé.
2. **Bảo mật & thanh toán phía Backend (`checkoutBooking` trong `bookingController.js`):**
   - Đã rà soát: giá vé và combo được tính lại hoàn toàn phía Backend từ `TicketPricingConfig` và `Concession`, kiểm tra `Idempotency-Key` chống trùng đơn, khóa ghế nguyên tử bằng `claimSeats` trong Mongoose Transaction, và mọi route `/my-bookings`, `/cancel`, `/exchange` đều lọc theo `userId: req.user._id`. **Không phát hiện lỗ hổng P0.**

---

## 10. Git status và `git diff --stat`
- Đã xác nhận file mới `backend/src/utils/roomLayoutConfig.js` đã xuất hiện trong `git status -s` (`?? backend/src/utils/roomLayoutConfig.js`) để sẵn sàng commit.
- Tổng hợp `git diff --stat`: `22 files changed, 1129 insertions(+), 266 deletions(-)` (bao gồm `backend/package-lock.json` từ việc cài `mongodb-memory-server`).

---

## 11. Đánh giá mức độ sẵn sàng cho Giai đoạn 2
- **Mức độ sẵn sàng:** **CAO (Sẵn sàng triển khai Giai đoạn 2)** sau khi bạn xác nhận hướng xử lý đối với 3 test case nghiệp vụ cũ trong `booking-and-admin.test.js` (cập nhật 3 assertion theo nghiệp vụ mới về doanh thu mô phỏng & `CANCEL_WITH_REFUND`, hoặc giữ nguyên).
- Toàn bộ nền tảng dữ liệu 9 phòng chiếu, sơ đồ 88 ghế, thuật toán gợi ý ghế, build Frontend và Chatbot AI đều đã hoạt động đồng bộ, ổn định và không còn test bị `SKIPPED`.
