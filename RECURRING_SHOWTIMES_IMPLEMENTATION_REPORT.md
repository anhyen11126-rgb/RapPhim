# BÁO CÁO TRIỂN KHAI TÍNH NĂNG LẶP LỊCH CHIẾU (RECURRING SHOWTIMES) – D'AVENOR CINEMA

- **Ngày thực hiện:** 26/11/2026
- **Nhánh làm việc (Git Branch):** `feature/recurring-showtimes` (tách từ `main` sạch tại commit `2ffda29`)
- **Môi trường Database:** Giữ nguyên cấu hình hiện tại, không can thiệp `.env`, không ghi/xóa/seed dữ liệu trên MongoDB Atlas (`movietix_db` và `movietix_demo_db`). Toàn bộ kiểm thử ghi dữ liệu chạy trên `MongoMemoryReplSet` độc lập.

---

## 1. Danh sách File đã tạo và chỉnh sửa

| STT | Đường dẫn File | Loại thay đổi | Mô tả chi tiết |
| :--- | :--- | :--- | :--- |
| 1 | [backend/src/controllers/adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js) | Chỉnh sửa | • Bổ sung `getPricingConfigReadOnly()` để đảm bảo bước Preview 100% READ-ONLY (không tự động ghi `TicketPricingConfig` vào DB).<br>• Bổ sung `getCompatibleFormatsForRoom()` và `isFormatCompatibleWithRoom()` để kiểm tra tính tương thích giữa `formatFeature` và `room.roomType`.<br>• Cập nhật `createShowtime` và `scheduleInRoom` để nhận, kiểm tra và lưu đúng `formatFeature` từ request.<br>• Chuẩn hóa `getAvailableShowtimeSlots` tính mốc giờ theo `+07:00` (`Asia/Ho_Chi_Minh`) thay vì `setHours()` phụ thuộc múi giờ máy chủ.<br>• Thiết kế bộ hàm dùng chung `normalizeRecurringInputs()` và `buildRecurringPlan()` cho cả `previewRecurringShowtimes` và `commitRecurringShowtimes`.<br>• Nâng cấp `commitRecurringShowtimes` chạy trong MongoDB Transaction với `lockRoom(roomId, session)` (`$inc: { scheduleRevision: 1 }`), hỗ trợ đầy đủ 2 chế độ `skipConflicts = false` (All-or-Nothing rollback 409) và `skipConflicts = true` (bỏ qua suất trùng, tạo nguyên tử suất hợp lệ + 88 ghế `ShowtimeSeat`), kèm chống gửi trùng qua `requestId`. |
| 2 | [backend/src/controllers/cinemaController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/cinemaController.js) | Chỉnh sửa | • Gỡ bỏ điều kiện chặn cứng `screening.slice(0, 7) !== release.slice(0, 7)` tại API `GET /api/cinemas/:id/showtimes?view=published` để các suất chiếu hợp lệ được xếp lịch sang tháng kế tiếp vẫn hiển thị cho khách hàng (vẫn giữ kiểm tra `screening >= release`, trạng thái phim, suất chưa hủy/khóa và cửa sổ mở bán 7 ngày). |
| 3 | [frontend/src/pages/admin/ShowtimeManagePage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/ShowtimeManagePage.jsx) | Chỉnh sửa | • Hoàn thiện 2 chế độ ngay trong Modal Tạo suất chiếu: **"Tạo 1 suất"** và **"🔁 Lặp lịch chiếu"**.<br>• Bổ sung bộ chọn nhanh tháng/năm (`type="month"`), khoảng ngày `Từ ngày` – `Đến ngày` (giới hạn tối đa 30 ngày / 180 suất), các thứ trong tuần từ **Thứ 2 đến Chủ Nhật** (`T2..CN`) kèm nút chọn nhanh **Cả tuần**, **Ngày thường**, **Cuối tuần**.<br>• Bổ sung chọn nhiều khung giờ 24h (`HH:mm`), hiển thị huy hiệu độ khả dụng từng khung giờ trên số ngày đã chọn (`4/4 ngày`, `3/4 ngày`), chọn thời gian vệ sinh phòng (`20 phút` / `15 phút`), giá vé tự động theo ma trận phòng/khung giờ, và tùy chọn **"Bỏ qua các suất bị trùng lịch (`skipConflicts`)"**.<br>• Tự động vô hiệu hóa Preview cũ khi Admin thay đổi bất kỳ thông số nào (phim, phòng, định dạng, ngày, thứ, khung giờ, thời gian vệ sinh, chế độ giá). |
| 4 | [frontend/src/components/movie-detail/MovieShowtimesSection.jsx](file:///d:/CDIO/movietix-project/frontend/src/components/movie-detail/MovieShowtimesSection.jsx) | Chỉnh sửa | • Gỡ bỏ giới hạn khóa lịch chiếu trong cùng tháng `releaseDate` (`lastDate` cuối tháng khởi chiếu và `candidate.slice(0, 7) !== movieMonth`) để trang Chi tiết phim hiển thị được lịch chiếu lặp qua ranh giới tháng/năm. |
| 5 | [frontend/src/components/home/HomeMovieTabs.jsx](file:///d:/CDIO/movietix-project/frontend/src/components/home/HomeMovieTabs.jsx) | Chỉnh sửa | • Cho phép phim đang chiếu (`NOW_SHOWING`, đã qua ngày khởi chiếu và có suất chiếu sắp tới) tiếp tục hiển thị khi bước sang tháng kế tiếp. |
| 6 | [frontend/src/components/home/HomeQuickBooking.jsx](file:///d:/CDIO/movietix-project/frontend/src/components/home/HomeQuickBooking.jsx) | Chỉnh sửa | • Cho phép thanh Đặt vé nhanh hiển thị phim có suất chiếu hợp lệ trong tháng đang chọn bên cạnh tháng khởi chiếu. |
| 7 | [backend/test/recurring-showtimes.test.js](file:///d:/CDIO/movietix-project/backend/test/recurring-showtimes.test.js) | Tạo mới | • Bộ 29 kịch bản kiểm thử tích hợp toàn diện cho tính năng lặp lịch chiếu trên `MongoMemoryReplSet`. |
| 8 | [backend/package.json](file:///d:/CDIO/movietix-project/backend/package.json) | Chỉnh sửa | • Tích hợp `test/recurring-showtimes.test.js` vào lệnh `npm test`. |

---

## 2. Cấu trúc Payload và Response của `preview` và `commit`

### 2.1. API Xem trước lịch chiếu lặp (`POST /api/admin/showtimes/recurring/preview`)
- **Đặc tính:** **100% READ-ONLY** — chỉ đọc dữ liệu và kiểm tra xung đột trên bộ nhớ, tuyệt đối không ghi bất kỳ document nào vào MongoDB.
- **Request Payload:**
```json
{
  "movieId": "6745...",
  "roomId": "6745...",
  "cinemaId": "6745...",
  "formatFeature": "2D IMAX Laser",
  "startDate": "2026-12-07",
  "endDate": "2026-12-10",
  "daysOfWeek": [1, 2, 3, 4, 5, 6, 0],
  "timeSlots": ["10:30", "19:00"],
  "pricingMode": "auto",
  "cleaningMinutes": 20,
  "skipConflicts": true
}
```
- **Response (`200 OK`):**
```json
{
  "movieId": "6745...",
  "movieTitle": "Dune: Hành Tinh Cát – Phần 2",
  "duration": 166,
  "releaseDate": "2026-11-01",
  "roomId": "6745...",
  "roomName": "Phòng 01 — IMAX Laser",
  "roomType": "IMAX Laser",
  "formatFeature": "2D IMAX Laser",
  "cleaningMinutes": 20,
  "totalSeatsPerShowtime": 88,
  "startDate": "2026-12-07",
  "endDate": "2026-12-10",
  "rangeDays": 4,
  "selectedDaysCount": 4,
  "daysOfWeek": [1, 2, 3, 4, 5, 6, 0],
  "timeSlots": ["10:30", "19:00"],
  "totalExpected": 8,
  "validCount": 7,
  "conflictCount": 1,
  "totalExpectedSeats": 616,
  "slotAvailability": {
    "10:30": { "available": 4, "conflict": 0, "totalDays": 4 },
    "19:00": { "available": 3, "conflict": 1, "totalDays": 4 }
  },
  "previewSignature": "...",
  "validSlots": [
    {
      "date": "2026-12-07",
      "dayOfWeek": 1,
      "time": "10:30",
      "startTimeText": "10:30",
      "endTimeText": "13:16",
      "cleaningEndTimeText": "13:36",
      "cleaningMinutes": 20,
      "duration": 166,
      "price": 130000,
      "totalSeats": 88,
      "status": "VALID"
    }
  ],
  "conflictSlots": [
    {
      "date": "2026-12-07",
      "dayOfWeek": 1,
      "time": "19:00",
      "startTimeText": "19:00",
      "endTimeText": "21:46",
      "cleaningEndTimeText": "22:06",
      "cleaningMinutes": 20,
      "price": 150000,
      "status": "CONFLICT",
      "conflictReason": "Trùng lịch chiếu hoặc thiếu 20 phút dọn phòng với Dune: Hành Tinh Cát – Phần 2 (2026-12-07 19:00–22:06)."
    }
  ]
}
```

### 2.2. API Xác nhận tạo lịch chiếu lặp (`POST /api/admin/showtimes/recurring/commit`)
- **Request Payload:** Hỗ trợ truyền đồng thời thông số lặp lịch + `confirmedSlots` từ Preview + `skipConflicts` + `previewSignature` + `requestId` (chống double-click/retry).
- **Response khi thành công (`201 Created`):**
```json
{
  "message": "Đã tạo 7/7 suất chiếu hợp lệ, bỏ qua 0 suất bị trùng lịch.",
  "batchId": "BATCH-...",
  "requestedCount": 7,
  "createdCount": 7,
  "successCount": 7,
  "skippedCount": 0,
  "failedCount": 0,
  "totalSeatsCreated": 616,
  "createdShowtimes": [...],
  "created": [...],
  "skipped": [],
  "conflicts": [],
  "failed": []
}
```
- **Response khi `skipConflicts = false` và phát hiện xung đột (`409 Conflict`):** Rollback toàn bộ giao dịch MongoDB (`rolledBack: true`, `createdCount: 0`) kèm danh sách chi tiết `conflicts`.

---

## 3. Cơ chế tạo 88 ghế `ShowtimeSeat` và kiểm soát Transaction

1. **Khóa phòng vật lý trong Transaction (`lockRoom`):**
   - Trước khi kiểm tra xung đột và ghi dữ liệu tại bước Commit, hệ thống gọi `lockRoom(roomId, session)` thực hiện `Room.findOneAndUpdate({ _id: roomId, status: 'ACTIVE' }, { $inc: { scheduleRevision: 1 } }, { session })`.
   - Cơ chế này tuần tự hóa (serialize) hai Admin cùng xếp lịch vào một phòng chiếu tại cùng thời điểm, chặn hoàn toàn race condition tạo trùng suất.
2. **Khởi tạo 88 ghế chuẩn sơ đồ D'AVENOR CINEMA:**
   - Sử dụng `resolveSeatTemplatesForRoom(room)` và kiểm định qua `isValidRoomSeatTemplate(seatTemplates, 88)`:
     - Hàng `A`–`G`: 12 ghế/hàng (`A`–`D`: 48 ghế `STANDARD`, `E`–`G`: 36 ghế `VIP`).
     - Hàng `H`: 4 ghế đôi `SWEETBOX` (`H1`–`H4`).
     - Tổng cộng đúng **88 ghế / suất chiếu**, tất cả khởi tạo mới với `status: 'AVAILABLE'`, không sao chép `bookingId`, `holdId` hay trạng thái ghế từ suất chiếu cũ.
3. **Tính nguyên tử (Atomicity) giữa `Showtime` và `ShowtimeSeat`:**
   - Toàn bộ `Showtime.insertMany` và `ShowtimeSeat.insertMany` diễn ra trong cùng một MongoDB Transaction (`session`).
   - Sau khi chèn ghế, hệ thống đối chiếu `insertedSeats.length === insertedShowtimes.length * 88`. Nếu thiếu bất kỳ ghế nào hoặc gặp lỗi DB, toàn bộ Transaction tự động abort/rollback, đảm bảo **không bao giờ tồn tại suất chiếu mồ côi thiếu ghế**.

---

## 4. Các giới hạn và quy tắc nghiệp vụ đã áp dụng

- **Cố định 1 phim & 1 phòng vật lý cho mỗi đợt lặp:** Không tự động xoay vòng nhiều phim trong tính năng lặp lịch.
- **Giới hạn an toàn trên cả Frontend & Backend:**
  - Khoảng ngày tối đa: **30 ngày** (`rangeDays <= 30`).
  - Tổng số suất dự kiến tối đa mỗi lần tạo: **180 suất** (`totalExpected <= 180`).
- **Múi giờ chuẩn:** Toàn bộ phép tính ngày/giờ sử dụng cố định `Asia/Ho_Chi_Minh` (`+07:00`), nhất quán tuyệt đối dù máy chủ chạy ở `TZ=UTC` hay `TZ=Asia/Ho_Chi_Minh`.
- **Giờ vận hành rạp & suất qua nửa đêm:**
  - Giờ mở suất từ `08:00` đến `23:30`, và thời điểm kết thúc phim + thời gian vệ sinh (`15` hoặc `20` phút, mặc định `20` phút) phải hoàn tất trước `02:00 sáng hôm sau (+1 ngày)`.
  - Truy vấn lịch hiện có luôn lùi 1 ngày (`startMs - 86400000`) và tiến 2 ngày để bắt chính xác các suất chiếu khuya kéo dài qua `00:00–02:00` sáng cũng như các suất chiếu legacy (`roomId: null` khớp theo `roomName`/`shortName`).

---

## 5. Các điểm lọc theo tháng đã kiểm tra và điều chỉnh cho luồng khách hàng

1. **`backend/src/controllers/cinemaController.js` (dòng 399):**
   - Trước đây: `if (published && release && (screening < release || screening.slice(0, 7) !== release.slice(0, 7))) continue;` khiến các suất chiếu sang tháng kế tiếp của phim phát hành tháng trước bị ẩn trên trang Rạp chiếu (`/theaters`).
   - Đã sửa thành: `if (published && release && screening < release) continue;` (vẫn giữ nguyên kiểm tra ngày khởi chiếu, trạng thái `UPCOMING`, không hủy, không khóa).
2. **`frontend/src/components/movie-detail/MovieShowtimesSection.jsx` (dòng 93 & 162):**
   - Trước đây: Khóa `lastDate` vào ngày cuối cùng của tháng `releaseDate` và dừng tìm kiếm lịch chiếu khi `candidate.slice(0, 7) !== movieMonth`.
   - Đã sửa: Cho phép khách hàng chọn và tự động chuyển tới ngày có suất chiếu hợp lệ ở tháng tiếp theo trong phạm vi mở bán, chỉ đóng lịch khi `movie.status === 'ENDED'`.
3. **`frontend/src/components/home/HomeMovieTabs.jsx` & `frontend/src/components/home/HomeQuickBooking.jsx`:**
   - Bổ sung điều kiện hiển thị các bộ phim `NOW_SHOWING` đã khởi chiếu và có suất chiếu hợp lệ trong tháng đang xem.

---

## 6. Kết quả chạy 29 ca kiểm thử tích hợp & kiểm thử hồi quy

### 6.1. Bộ 29 ca kiểm thử lặp lịch chiếu (`node --test backend/test/recurring-showtimes.test.js`)
**Kết quả: 29/29 PASS (0 FAIL)**

| # | Kịch bản kiểm thử | Kết quả |
| :---: | :--- | :---: |
| 01 | Tạo 1 suất lẻ qua `POST /api/admin/showtimes` vẫn hoạt động bình thường và đủ 88 ghế | **PASS** |
| 02 | Lặp lịch cả tuần (7 ngày × 2 khung giờ = 14 suất) tạo đủ 14 suất chiếu | **PASS** |
| 03 | Lặp lịch ngày thường T2–T6 chỉ tạo suất từ Thứ 2 đến Thứ 6 | **PASS** |
| 04 | Lặp lịch cuối tuần T7–CN chỉ tạo suất Thứ 7 và Chủ Nhật | **PASS** |
| 05 | Lặp lịch các thứ tùy chọn (T2, T4, T6) | **PASS** |
| 06 | Lặp lịch qua ranh giới tháng và năm (`28/12/2026` → `03/01/2027`) | **PASS** |
| 07 | Lặp lịch nhưng không có ngày nào khớp thứ đã chọn trả về 0 suất hợp lệ | **PASS** |
| 08 | Lặp lịch có trùng giờ trong cùng yêu cầu (`18:00` và `19:00` cho phim 120 phút) | **PASS** |
| 09 | Lặp lịch trùng với suất đã có trong DB cùng phòng | **PASS** |
| 10 | Lặp lịch thiếu 20 phút dọn phòng bị báo xung đột chính xác | **PASS** |
| 11 | Lặp lịch vượt giờ đóng cửa `02:00` sáng hôm sau bị từ chối trong Preview | **PASS** |
| 12 | Lặp lịch phát hiện đúng va chạm với suất chiếu qua nửa đêm `00:00–02:00` của ngày trước | **PASS** |
| 13 | Lặp lịch trước ngày khởi chiếu phim bị gắn cờ xung đột chính xác | **PASS** |
| 14 | Lặp lịch cho phòng đang `MAINTENANCE` bị từ chối HTTP 400 | **PASS** |
| 15 | Lặp lịch cho phim `ENDED` bị từ chối HTTP 400 | **PASS** |
| 16 | Preview là 100% READ-ONLY: không tạo `Showtime`, `ShowtimeSeat` hoặc `TicketPricingConfig` trong DB | **PASS** |
| 17 | Commit với `skipConflicts = false` khi có 1 suất trùng → rollback 100%, không tạo suất nào | **PASS** |
| 18 | Commit với `skipConflicts = true` khi có 1 suất trùng → tạo các suất hợp lệ, bỏ qua đúng 1 suất trùng | **PASS** |
| 19 | Mỗi suất được tạo có đúng 88 ghế `ShowtimeSeat` chuẩn sơ đồ A–G (12 ghế) + H (4 ghế), tất cả `AVAILABLE` | **PASS** |
| 20 | Không có bất kỳ `Showtime` nào thiếu ghế (orphan showtime) nếu quá trình `insertMany` ghế gặp lỗi | **PASS** |
| 21 | Khách hàng có thể tải sơ đồ 88 ghế và giữ ghế từ suất chiếu được tạo bằng lặp lịch (trong cửa sổ 7 ngày) | **PASS** |
| 22 | Lịch chiếu tháng kế tiếp (khác tháng với `releaseDate`) hiển thị đầy đủ trên API khách hàng | **PASS** |
| 23 | Hai yêu cầu Commit đồng thời (concurrency) cho cùng phòng và khung giờ không bao giờ tạo trùng suất chiếu | **PASS** |
| 24 | Idempotency: Gửi lặp lại cùng một `requestId` khi double-click hoặc retry bị chặn 409 và không tạo nhân đôi | **PASS** |
| 25 | Khung giờ hoặc thứ bị trùng lặp trong cùng payload được loại trùng chính xác | **PASS** |
| 26 | Lịch phòng thay đổi sau bước Preview được phát hiện lại tại bước Commit (stale preview protection) | **PASS** |
| 27 | Vượt giới hạn 30 ngày hoặc 180 suất dự kiến bị từ chối HTTP 400 | **PASS** |
| 28 | Định dạng chiếu `formatFeature` không tương thích phòng bị từ chối 400, tương thích được lưu đúng vào `Showtime` | **PASS** |
| 29 | Múi giờ nhất quán: `startTime` lưu chính xác theo giờ Việt Nam (`+07:00`) bất kể `TZ=UTC` hay `Asia/Ho_Chi_Minh` | **PASS** |

### 6.2. Kết quả kiểm thử hồi quy toàn hệ thống & Build
- **Toàn bộ 8 bộ test Backend (`npm --prefix backend test`):** **90/90 PASS (0 FAIL)**.
- **Kiểm thử Chatbot AI nâng cao (`node backend/scripts/testAdvancedChatbotSpec.js`):** **11/11 nhóm kịch bản PASS 100%**.
- **Production Build Frontend (`npm --prefix frontend run build`):** **PASS (`✓ built in 1.34s`, 0 lỗi biên dịch)**.

---

## 7. Hình ảnh nghiệm thu giao diện thực tế

1. **Chế độ Tạo 1 suất (`single` mode):**
   - [modal_single_showtime.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/modal_single_showtime.png)
2. **Chế độ Lặp lịch chiếu (`recurring` mode):**
   - [modal_recurring_showtimes.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/modal_recurring_showtimes.png)
3. **Bảng Xem trước lịch chiếu có suất hợp lệ và suất xung đột (`preview` panel):**
   - [modal_recurring_preview_conflicts.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/modal_recurring_preview_conflicts.png)
