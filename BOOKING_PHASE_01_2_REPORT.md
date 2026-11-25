# BÁO CÁO NGHIỆM THU GIAI ĐOẠN 1.2 — CHUẨN HÓA NGHIỆP VỤ DOANH THU VÀ BẢO VỆ SUẤT CHIẾU
**Dự án:** D'AVENOR CINEMA (`movietix-project`)  
**Thời điểm hoàn thành:** 25/11/2026  
**Phạm vi:** Chuẩn hóa phân tách doanh thu thực/mô phỏng/hoàn/hủy, hoàn thiện bảo vệ suất chiếu Nhóm B (`deleteShowtimeSafe`), xác minh cơ chế thanh toán và chạy toàn bộ bộ kiểm thử hồi quy.

---

## 1. Nguyên nhân chính xác của 3 test FAIL trước đó
1. **Test 13 & Test 16 (Doanh thu):** Trước đây `statisticsService.js` chỉ trả về tổng gộp `netRevenue` / `totalRevenue` (bao gồm cả đơn `VERIFIED` và `SIMULATED`), chưa tách riêng trường `verifiedRevenue` và `simulatedRevenue`. Bộ test cũ lại kỳ vọng `totalRevenue = 0` và `netRevenue = 130000` (loại trừ hoàn toàn đơn `SIMULATED`).
2. **Test 19 (Bảo vệ suất chiếu Nhóm B):** Bộ test cũ gọi `DELETE /admin/showtimes/:id` trực tiếp không kèm `{ action: 'CANCEL_WITH_REFUND' }`, trong khi `deleteShowtimeSafe` đã nâng cấp quy tắc bảo vệ Nhóm B: trả về `409 Conflict` nếu gọi xóa thông thường trên suất đã có vé đặt. Ngoài ra, trong `deleteShowtimeSafe`, thao tác hủy mềm trước đây chưa xóa `qrToken: null`, chưa gán `refundAmount`, và chưa kiểm tra `slot.cancelledAt` trước nhánh kiểm tra đơn đang hoạt động (dẫn đến gọi lại lần 2 bị rơi vào nhánh xóa cứng).

---

## 2. Quy tắc nghiệp vụ Doanh thu (Trước và Sau)
- **Trước:** `totalRevenue` và `netRevenue` gộp chung `VERIFIED` + `SIMULATED` mà không có trường phân tách; chưa xuất `verifiedRevenue`, `simulatedRevenue`, `cancelledAmount` ra API và file CSV.
- **Sau:**
  - `verifiedRevenue`: Doanh thu thanh toán thực đã xác minh (`paymentStatus === 'VERIFIED'`, `status === 'PAID'`).
  - `simulatedRevenue`: Doanh thu thanh toán mô phỏng phục vụ trình diễn (`paymentStatus === 'SIMULATED'`, `status === 'PAID'`).
  - `totalRevenue` / `netRevenue`: Tổng doanh thu hợp lệ (`verifiedRevenue + simulatedRevenue`). Không tính đơn `PENDING`, `FAILED` hoặc `CANCELLED`; không trừ tiền hoàn hai lần; không tính trùng tiền vé và combo.
  - `refundedAmount`: Tổng số tiền đã hoàn (`refundStatus === 'REFUNDED'`).
  - `cancelledAmount`: Tổng giá trị các đơn đã hủy (`status === 'CANCELLED'`).
  - **Đồng bộ:** `getRevenueStats`, `getShowtimeDetailStats` và `exportStatistics` (CSV) đều dùng chung một quy tắc tính toán.

---

## 3. Quy tắc Bảo vệ Suất chiếu Nhóm B & Cơ chế Thanh toán
- **Nhóm A (0 vé đặt):** Cho phép xóa cứng (`Hard Delete`) trong Mongoose Transaction.
- **Nhóm B (Đã có vé đặt):**
  - `DELETE` thông thường trả về **HTTP 409 Conflict**.
  - Chỉ cho phép hủy mềm qua `{ action: 'CANCEL_WITH_REFUND' }` nếu chưa có vé check-in (`!isCheckedIn`).
  - Thực hiện trong Mongoose Transaction: gán `cancelledAt`, `isLocked: true`, chuyển đơn sang `CANCELLED`, **vô hiệu hóa `qrToken: null`**, ghi nhận `refundAmount`, phân biệt `refundStatus` (`PENDING` nếu đơn `VERIFIED`, `SIMULATED` nếu đơn mô phỏng) và giải phóng ghế về `AVAILABLE`.
  - **Idempotent:** Nếu suất đã có `cancelledAt`, mọi request hủy lặp lại đều trả về `{ success: true, alreadyCancelled: true }` mà không tạo hoàn tiền trùng lặp và không xóa cứng lịch sử.
- **Xác minh cơ chế thanh toán hiện tại:** Hệ thống hiện tại **chỉ sử dụng thanh toán mô phỏng (`paymentStatus: 'SIMULATED'`)** trong `checkoutBooking` (`bookingController.js`) phục vụ trình diễn đồ án; chưa tích hợp webhook/callback cổng thanh toán tiền thật (VNPAY/MOMO thật). Đã kiểm tra toàn bộ quy trình tính giá phía server, `Idempotency-Key` và transaction khóa ghế `claimSeats`.

---

## 4. Danh sách file đã sửa
1. [backend/src/services/statisticsService.js](file:///d:/CDIO/movietix-project/backend/src/services/statisticsService.js) — Bổ sung phân tách `verifiedRevenue`, `simulatedRevenue`, `totalRevenue`, `cancelledAmount` trong `getRevenueStats`, `getShowtimeDetailStats` và `exportStatistics` (CSV).
2. [backend/src/controllers/bulkShowtimeController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/bulkShowtimeController.js) — Cập nhật `deleteShowtimeSafe`: kiểm tra `slot.cancelledAt` idempotent trước, vô hiệu hóa `qrToken: null`, ghi nhận `refundAmount`, phân biệt `refundStatus` (`PENDING` vs `SIMULATED`) và trả về `affectedOrders`.
3. [backend/test/booking-and-admin.test.js](file:///d:/CDIO/movietix-project/backend/test/booking-and-admin.test.js) — Cập nhật Test 13, Test 16 theo quy tắc phân tách doanh thu và tách Test 19 thành đầy đủ 7 kịch bản kiểm thử Nhóm B.

---

## 5. Kết quả kiểm thử hồi quy
- **`npm test` (`booking-and-admin.test.js` trên `MongoMemoryReplSet`):**
  - **19 PASS, 0 FAIL, 0 SKIPPED** (`3.76s`).
  - Bao gồm toàn bộ 7 kịch bản Nhóm B (409 khi DELETE trực tiếp, CANCEL_WITH_REFUND hủy mềm, bảo toàn lịch sử, QR bị vô hiệu hóa không check-in được, thống kê về 0, ẩn khỏi Website, idempotent khi gửi lại).
- **Chatbot AI:**
  - `node scripts/testAiChatbot.js`: **15/15 PASS (100%)**.
  - `node scripts/testChatbotUpgrade.js`: **17/17 PASS (100%)**.
- **Frontend Production Build (`npm --prefix frontend run build`):**
  - **PASS** (`958ms`, `2207 modules transformed`, **0 lỗi**).

---

## 6. Đánh giá mức độ sẵn sàng cho Giai đoạn 2
- **Sẵn sàng 100%:** Toàn bộ 19/19 test tích hợp, 32/32 test Chatbot AI và production build Frontend đều đạt **PASS (0 FAIL, 0 SKIPPED)**.
- Chờ phê duyệt để triển khai **Giai đoạn 2 — Cơ chế giữ ghế thực sự (`HOLDING`) trong MongoDB trong 10 phút**.
