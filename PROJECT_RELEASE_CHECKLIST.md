# PROJECT RELEASE CHECKLIST — D’AVENOR CINEMA (CHỐT PHIÊN BẢN CDIO)

**Dự án:** D’AVENOR CINEMA  
**Ngày chốt phiên bản:** 2026-11-25  
**Trạng thái:** Đã hoàn tất 12/12 hạng mục chốt phiên bản — **Chờ xác nhận commit và merge** (chưa chạy `git commit`, `git push`, hay `git merge`).

---

## 1. Bảng kiểm tra các việc đã hoàn thành & chưa thực hiện

| # | Hạng mục | Trạng thái | Kết quả xác minh |
|---|---|---|---|
| 1 | Kiểm tra `git status`, `git diff` & toàn bộ file untracked | **Hoàn thành** | 38 file sửa (`+2431 / -488`), các file mới: `roomLayoutConfig.js`, 3 bộ test backend, 3 script Playwright E2E, 6 ảnh chụp nghiệm thu, 8 file báo cáo |
| 2 | Kiểm tra source code, test, `package.json`, `package-lock.json` | **Hoàn thành** | Không lỗi cú pháp, không refactor thừa, build frontend `1.18s` (0 lỗi) |
| 3 | Kiểm tra `.gitignore` & bảo mật bí mật | **Hoàn thành** | `.gitignore` chặn `.env`, `**/.env`, `node_modules/`, `dist/`; `git ls-files` chỉ có `backend/.env.example`, không lộ secret ở frontend |
| 4 | Xác minh `npm --prefix backend test` chạy đủ 49 tests | **Hoàn thành** | **49/49 PASS, 0 FAIL, 0 SKIPPED** (`booking-and-admin`: 19, `seat-holding`: 16, `phase05`: 5, `phase06`: 9) |
| 5 | Bổ sung hướng dẫn chạy đầy đủ 23 Playwright test vào `README.md` | **Hoàn thành** | Đã lưu 3 script vào `frontend/e2e/` và ghi hướng dẫn chi tiết trong `README.md` |
| 6 | Kiểm tra unique index & cơ chế `Idempotency-Key` | **Hoàn thành** | Đã xác minh `bookingCode` unique index + `requestSignature` SHA-256 trong Transaction |
| 7 | Kiểm tra `autoIndex` & kế hoạch triển khai MongoDB Index | **Hoàn thành** | Không chỉnh sửa Atlas; đã lập kế hoạch index an toàn bên dưới |
| 8 | Xác minh tương thích khi rollback có phiên giữ ghế đang hoạt động | **Hoàn thành** | Đã phân tích đầy đủ kịch bản rollback Backend & Frontend bên dưới |
| 9 | Lưu 6 ảnh chụp giao diện nghiệm thu vào dự án | **Hoàn thành** | Đã lưu tại `docs/acceptance-screenshots/` (6 file PNG) |
| 10 | Hoàn thiện `README.md` | **Hoàn thành** | Đã cập nhật đầy đủ kiến trúc, cấu hình 9 phòng/88 ghế/600s, cài đặt, `.env`, chạy dự án và chạy 104 test |
| 11 | Đề xuất chia commit theo nhóm chức năng | **Hoàn thành** | 5 nhóm commit rõ ràng (Mục 5 bên dưới) |
| 12 | Kịch bản trình diễn đồ án CDIO | **Hoàn thành** | Kịch bản 10–12 phút đầy đủ Client → Admin → Chatbot AI (Mục 6 bên dưới) |

### Những việc CHƯA thực hiện (theo đúng phạm vi phê duyệt)
- **Chưa chạy** `git add`, `git commit`, `git push`, hoặc `git merge` vào `main` (đang chờ xác nhận từ người dùng).
- **Chưa chạy** bất kỳ thao tác ghi/reset/seed/tạo index thủ công nào lên **MongoDB Atlas vận hành**.
- **Chưa tích hợp** cổng thanh toán tiền thật (VNPAY/MoMo IPN) — giữ nguyên chế độ `SIMULATED` cho trình diễn CDIO.

---

## 2. Xác minh Unique Index & Cơ chế chống tạo Booking trùng (`Idempotency-Key`)

- **Schema (`backend/src/models/Booking.js`):**
  - `bookingCode`: `{ type: String, required: true, unique: true, index: true }`.
  - `requestSignature`: `{ type: String, select: false }`.
- **Controller (`backend/src/controllers/bookingController.js`):**
  - Kiểm tra định dạng UUID của header `Idempotency-Key` (`/^[a-f\d-]{36}$/i`).
  - Sinh `bookingCode` định danh theo `Idempotency-Key` + `req.user._id` và `requestSignature = sha256([showtimeId, sortedSeats, combos, popcornFlavor, voucherCode, paymentMethod])`.
  - Trong Mongoose Transaction: kiểm tra `Booking.findOne({ bookingCode, userId })`:
    - Nếu tồn tại và khớp `requestSignature` → trả lại đúng Booking cũ (idempotent replay).
    - Nếu tồn tại nhưng khác `requestSignature` → trả `409 Conflict` (`Mã yêu cầu đã dùng cho lựa chọn khác`).
    - Nếu 2 request gửi đồng thời (`Promise.all`) → Unique Index `bookingCode_1` ở tầng MongoDB đảm bảo tối đa **1** document Booking được tạo (đã kiểm chứng bởi `RC-4 & RC-5` và `P5-4`).

---

## 3. Kiểm tra `autoIndex` & Kế hoạch triển khai MongoDB Index

- **Hiện trạng:** Mongoose sử dụng mặc định `autoIndex: true` (phù hợp cho dev/test và môi trường trình diễn CDIO quy mô nhỏ). Không có TTL index trên `holdExpiresAt` của `ShowtimeSeat`.
- **Các compound index mới cần có khi triển khai:**
  - `ShowtimeSeat`: `{ showtimeId: 1, row: 1, col: 1 }`
  - `Booking`: `{ showtimeId: 1, status: 1, paymentStatus: 1, createdAt: -1 }`, `{ status: 1, paymentStatus: 1, createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`
- **Kế hoạch triển khai an toàn trên môi trường Production/Atlas (không tự ý chạy ngay):**
  1. Ở môi trường Production lưu lượng cao, khuyến nghị đặt `autoIndex: false` trong `mongoose.connect` và tạo index theo cửa sổ bảo trì bằng lệnh `createIndexes` (MongoDB 4.2+ tự động build index không khóa đọc/ghi toàn collection).
  2. Kiểm tra lại bằng `explain('executionStats')` để xác nhận 0 in-memory `SORT`.
  3. **Tuyệt đối không** tạo TTL index trên `ShowtimeSeat.holdExpiresAt`.

---

## 4. Xác minh tương thích khi Rollback có phiên giữ ghế đang hoạt động

| Kịch bản Rollback | Hành vi với phiên `HOLDING` đang sống | Đánh giá an toàn |
|---|---|---|
| **Rollback Frontend trước, Backend giữ nguyên** | Frontend cũ vẫn nhận đầy đủ JSON từ `GET /api/showtimes/:id/seats` (vì `?lite=1` chỉ là opt-in). Ghế đang `HOLDING` vẫn bị khóa an toàn ở Backend; sau tối đa 600s tự mở lại `AVAILABLE`. | **An toàn (Backward-compatible)** |
| **Rollback Backend về bản trước GĐ 5** | Bản trước GĐ 5 vẫn đọc các trường `holdId`, `holdOwnerId`, `holdExpiresAt`, `status: 'HOLDING'`. Frontend GĐ 5 gọi `?lite=1` sẽ nhận full response (do Backend cũ bỏ qua query `lite=1`) và vẫn parse `res.data.seats` bình thường. | **An toàn (Backward-compatible)** |
| **Rollback Backend về bản trước GĐ 2 (chưa có `holdId`)** | Các document `ShowtimeSeat` đang `HOLDING` có thêm field `holdId`/`holdOwnerId`/`holdCreatedAt` không gây lỗi đọc; tuy nhiên **cần rollback đồng bộ Frontend** nếu quay về bản trước GĐ 2 để không gọi endpoint `/api/bookings/hold`. | **Cần rollback đồng bộ FE + BE** |

---

## 5. Các lệnh Git đề xuất (Tương thích Windows PowerShell)

> **Lưu ý:** Các nhóm thay đổi từ Giai đoạn 1 → 6 có sự phụ thuộc chặt chẽ giữa Backend (`roomLayoutConfig.js`, `bookingController.js`, `showtimeController.js`, `statisticsService.js`) và Frontend (`SeatSelectionPage.jsx`, `CheckoutPage.jsx`, `ShowtimeDetailDrawer.jsx`). Do đó khuyến nghị thực hiện **1 commit tổng hợp ổn định** trên nhánh `release/cdio-v1.0` để mọi điểm trên lịch sử Git đều build và PASS 104/104 test:

```powershell
# Tạo nhánh release bảo toàn main
git checkout -b release/cdio-v1.0

# Stage toàn bộ source code, test, ảnh nghiệm thu và tài liệu (đã kiểm tra không có .env / secrets)
git add README.md backend/ frontend/ docs/acceptance-screenshots/ `
        BOOKING_SYSTEM_AUDIT.md BOOKING_PHASE_*.md PROJECT_RELEASE_CHECKLIST.md

# Kiểm tra lại nội dung sắp commit
git diff --cached --stat

# Tạo commit ổn định cho phiên bản CDIO v1.0
git commit -m "release(cdio-v1.0): complete D'AVENOR Cinema booking system, 600s seat holding, sync, perf & 104 tests"
```

---

## 6. Kịch bản trình diễn đồ án CDIO (10–12 phút)

### Phần A — Trải nghiệm Khách hàng & Chống đặt trùng (4 phút)
1. **Trang chủ & Cụm rạp (`/`, `/theaters`):** Giới thiệu giao diện Holographic Dark Navy của cụm rạp duy nhất **D’AVENOR Thanh Khê Plaza** với 3 công nghệ phòng (**IMAX Laser**, **Dolby Atmos**, **Gold Class**). Bấm chọn 1 suất chiếu → chuyển tức thì sang `/booking/seat/:showtimeId` không nhấp nháy.
2. **Sơ đồ 88 ghế & Góc nhìn 3D:** Trình diễn sơ đồ 8 hàng `A–H` × 11 cột có lối đi giữa cột 6–7, bật **Gợi ý ghế thông minh** và bấm **Xem góc nhìn 3D** (nhấn mạnh module 3D chỉ tải khi bấm, giúp giảm 53.3% JS khởi tạo).
3. **Giữ ghế 600 giây & Chống đặt trùng thời gian thực:**
   - Trình duyệt 1 (Khách A): Chọn 2 ghế (VD: `E5, E6`), bấm **Tiếp tục** → chuyển sang **Checkout** với đồng hồ đếm ngược `09:59`. Reload trang → đồng hồ giữ nguyên thời gian thực từ server, không reset về `10:00`.
   - Trình duyệt 2 (Khách B — chế độ ẩn danh): Mở cùng suất chiếu → thấy `E5, E6` hiển thị màu hổ phách **`Đang được khách khác giữ`** và không thể chọn.
4. **Thanh toán mô phỏng & Vé QR:** Tại Khách A, chọn 1 Combo + nhập Voucher hợp lệ → bấm **Thanh toán mô phỏng** (nêu rõ chế độ `SIMULATED` dành cho đồ án) → hiển thị trang **Đặt vé thành công** kèm mã **QR Code** và kiểm tra trong **Vé của tôi**.

### Phần B — Đồng bộ Quản trị Admin, Thống kê & Bảo vệ suất chiếu (4 phút)
5. **Admin Thống kê (`/admin/statistics`):**
   - Mở **Chi tiết suất chiếu (`ShowtimeDetailDrawer`)**: Chỉ rõ sơ đồ ghế cập nhật đồng bộ ghế `Đã đặt` (đỏ) và ghế `Đang giữ tạm` (hổ phách, không cộng vào doanh thu).
   - Chỉ rõ phần tách bạch **Doanh thu mô phỏng (`simulatedRevenue`)** và **Doanh thu thực (`verifiedRevenue`)**, xuất thử file **CSV** khớp số liệu.
6. **Check-in QR 1 lần (`/admin/check-in`):** Quét/nhập mã QR của Khách A → check-in thành công lần 1; thử quét lại lần 2 → hệ thống chặn trùng.
7. **Bảo vệ suất chiếu Nhóm B (`/admin/showtimes`):** Thử xóa trực tiếp suất chiếu đã có vé → hệ thống chặn (`409`) và hướng dẫn dùng luồng **Hủy suất & Hoàn tiền mô phỏng (`CANCEL_WITH_REFUND`)** để bảo toàn lịch sử & vô hiệu QR.

### Phần C — Trợ lý ảo Chatbot AI đồng bộ thời gian thực (2–3 phút)
8. Mở **ChatWidget** ở góc phải màn hình và hỏi liên tiếp:
   - *"Hôm nay có phim gì đang chiếu và còn mấy ghế trống?"* → Số ghế trống khớp chính xác sau khi Khách A vừa đặt vé.
   - *"Gợi ý giúp mình 4 ghế liền nhau"* → Gợi ý đúng 4 ghế liền kề không cắt ngang lối đi 6–7 và tránh ghế `BOOKED`/`HOLDING`.
   - *"Hôm nay có voucher khuyến mãi gì không?"* → Trả về voucher đang hoạt động từ MongoDB kèm nút bấm đặt vé dẫn đúng `showtimeId`.

### Phần D — Minh chứng chất lượng kỹ thuật (1 phút)
9. Chạy nhanh `npm --prefix backend test` ngay trên terminal trình diễn → **49/49 PASS trong ~6 giây** trên `MongoMemoryReplSet` cô lập (kèm báo cáo tổng **104/104 PASS**).

---

**Trạng thái hiện tại:** Đã chốt xong toàn bộ tài liệu và kiểm chứng. Dừng lại chờ bạn xác nhận **commit và merge**.
