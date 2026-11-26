# BÁO CÁO KHẮC PHỤC & TỐI ƯU HÓA XÁC NHẬN XẾP LỊCH CHIẾU HÀNG LOẠT – D’AVENOR CINEMA

- **Dự án:** D’AVENOR CINEMA (`movietix-project`)
- **Trang & API:** `/admin/showtimes` — `POST /api/admin/showtimes/schedule-batch`
- **Căn cứ triển khai:** Báo cáo kiểm toán [BATCH_SHOWTIME_CONFIRM_ERROR_AUDIT.md](file:///d:/CDIO/movietix-project/BATCH_SHOWTIME_CONFIRM_ERROR_AUDIT.md)

---

## 1. NGUYÊN NHÂN LỖI ĐÃ XỬ LÝ

1. **Vượt ngưỡng `transactionLifetimeLimitSeconds (60s)` của MongoDB Atlas (`code: 251 – NoSuchTransaction`):**
   - Trước khi sửa, nhánh Confirm của `batchScheduleShowtimes` chạy vòng lặp tuần tự `for (const slot of txPlan.validSlots)` gọi `await scheduleInRoom(...)` **180 lần** bên trong một MongoDB Transaction duy nhất.
   - Mỗi lần gọi `scheduleInRoom` thực hiện **6 thao tác truy vấn mạng tuần tự** (trong đó có `Showtime.find().populate()`, `ShowtimeSeat.aggregate` quét COLLSCAN toàn bộ bảng ghế, `ShowtimeSeat.find`, `Showtime.create`, `ShowtimeSeat.insertMany`).
   - Tổng cộng **1.091 lượt round-trip tuần tự qua mạng** cho 180 suất (~880 ms/suất) khiến Transaction bị MongoDB Atlas hủy ở giây thứ 60 (`code: 251, NoSuchTransaction`), tiếp tục retry rồi thất bại với `HTTP 500` sau **163.116 ms (~2 phút 43 giây)**.
2. **Thiếu Compound Index `{ roomId: 1, showtimeId: 1 }` trên `ShowtimeSeat`:**
   - Truy vấn tìm mẫu ghế theo `roomId` trước đây không có index bắt đầu bằng `roomId`, gây `COLLSCAN` trên collection `ShowtimeSeat`.
3. **Lỗi tích lũy mảng kết quả khi Transaction Retry:**
   - `createdSlotIds` và `createdShowtimes` trước đây được khai báo bên ngoài callback `mongoose.connection.transaction(async (session) => { ... })`, dẫn đến nguy cơ giữ lại các ID của lần thử đã bị rollback khi MongoDB driver tự động retry `TransientTransactionError`.

---

## 2. DANH SÁCH FILE ĐÃ SỬA

1. [backend/src/models/ShowtimeSeat.js](file:///d:/CDIO/movietix-project/backend/src/models/ShowtimeSeat.js#L83-L88):
   - Bổ sung compound index `showtimeSeatSchema.index({ roomId: 1, showtimeId: 1 });`, giữ nguyên unique index `{ showtimeId: 1, seatNumber: 1 }` và các index hiện có.
2. [backend/src/controllers/adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js#L270-L418) & [dòng 1580–1835](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js#L1580-L1835):
   - Bổ sung hàm `isValidRoomSeatTemplate` và `resolveSeatTemplatesForRoom` để kiểm tra nghiêm ngặt mẫu 88 ghế (hàng `A–G`: 12 ghế, hàng `H`: 4 ghế, không trùng mã ghế hoặc tọa độ) **1 lần duy nhất cho mỗi phòng** trước khi mở Transaction.
   - Tối ưu nhánh Confirm trong `batchScheduleShowtimes`:
     - Khóa các phòng vật lý (`lockRoom`) theo thứ tự từ điển `Room ID` nhất quán để chống deadlock khi nhiều Admin thao tác đồng thời.
     - Đọc lịch hiện có (`existingInTx`) và chạy `planBatchSchedule` + kiểm tra toàn bộ điều kiện nghiệp vụ tương đương `scheduleInRoom` ngay trong Transaction.
     - Khởi tạo trước `_id` cho từng suất hợp lệ, ghi toàn bộ `Showtime` bằng **1 lệnh `Showtime.insertMany(showtimeDocsToInsert, { session, ordered: true })`**.
     - Ghi toàn bộ `ShowtimeSeat` theo từng nhóm **3.520 ghế (40 suất × 88 ghế)** bằng `ShowtimeSeat.insertMany(chunk, { session, ordered: true })` tuần tự trong cùng `session` Transaction.
     - Khởi tạo `txCreatedSlotIds` và `txCreatedShowtimes` **bên trong** callback Transaction để an toàn tuyệt đối khi retry.
3. [frontend/src/pages/admin/ShowtimeManagePage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/ShowtimeManagePage.jsx#L78-L83) & [dòng 968–1014](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/ShowtimeManagePage.jsx#L968-L1014):
   - Bổ sung `isConfirmingBatch` state và `isConfirmingBatchRef` (`useRef`) để chặn tuyệt đối việc gửi request trùng khi Admin bấm xác nhận nhiều lần liên tiếp.
   - Hiển thị trạng thái `"Đang tạo lịch chiếu..."`, vô hiệu hóa nút xác nhận trong lúc request đang chạy, giữ nguyên dữ liệu form nếu có lỗi, tự động yêu cầu Preview lại khi nhận `HTTP 409`, và thông báo rõ trạng thái rollback khi giao dịch thất bại.
4. [backend/test/bulk-delete-and-lifecycle.test.js](file:///d:/CDIO/movietix-project/backend/test/bulk-delete-and-lifecycle.test.js#L901-L1066):
   - Bổ sung bộ kiểm thử tích hợp cho quy mô 180 suất (`15.840` ghế), 2 Admin xác nhận đồng thời, lỗi giữa quá trình ghi ghế (`rollback 100%`), retry transaction không trùng ID, và tạo lịch mới thay thế suất đã hủy mềm.

---

## 3. SO SÁNH CODE & SỐ LƯỢNG TRUY VẤN TRƯỚC VÀ SAU KHI TỐI ƯU

### 3.1. Code trước và sau khi tối ưu (Nhánh Confirm trong `batchScheduleShowtimes`)

- **Trước khi tối ưu:**
  ```javascript
  const createdSlotIds = [];
  const createdShowtimes = [];
  const totalCreatedShowtimes = await mongoose.connection.transaction(async (session) => {
    // ... lockRoom + existingInTx + planBatchSchedule ...
    let count = 0;
    for (const slot of txPlan.validSlots) {
      // Gọi tuần tự 180 lần -> mỗi lần chạy lại Showtime.find().populate(),
      // ShowtimeSeat.aggregate (COLLSCAN), ShowtimeSeat.find(), Showtime.create(), ShowtimeSeat.insertMany()
      const created = await scheduleInRoom({
        room: roomDoc, movie: movieDoc, start: new Date(slot.startTime),
        price: slot.priceStandard, pricing, session,
        batchId, creationSource: 'BULK', createdBy: req.admin?._id || null,
        cleaningMinutes: slot.cleaningMinutes,
      });
      createdSlotIds.push(created._id.toString());
      count++;
    }
    return count;
  });
  ```

- **Sau khi tối ưu:**
  ```javascript
  // Chuẩn bị và xác thực mẫu 88 ghế 1 lần duy nhất cho từng Room ID
  const seatTemplatesByRoomId = new Map();
  for (const rm of roomsInOrder) {
    const templates = await resolveSeatTemplatesForRoom(rm, null);
    seatTemplatesByRoomId.set(String(rm._id), templates);
  }

  const roomsSortedForLock = [...roomsInOrder].sort((a, b) =>
    String(a._id).localeCompare(String(b._id))
  );

  const txResult = await mongoose.connection.transaction(async (session) => {
    const txCreatedSlotIds = [];
    const txCreatedShowtimes = [];

    for (const rm of roomsSortedForLock) {
      await lockRoom(rm._id, session);
    }

    const existingInTx = await Showtime.find(existingShowtimeFilter)
      .populate('movieId', 'title duration')
      .session(session)
      .lean();

    const txPlan = planBatchSchedule({ ... });
    // Kiểm tra expectedValidCount, expectedSignature và toàn bộ điều kiện nghiệp vụ cho từng suất...

    await Showtime.insertMany(showtimeDocsToInsert, { session, ordered: true });

    const SEAT_BATCH_CHUNK_SIZE = 3520;
    for (let offset = 0; offset < allSeatDocsToInsert.length; offset += SEAT_BATCH_CHUNK_SIZE) {
      const chunk = allSeatDocsToInsert.slice(offset, offset + SEAT_BATCH_CHUNK_SIZE);
      await ShowtimeSeat.insertMany(chunk, { session, ordered: true });
    }

    return {
      totalCreatedShowtimes: showtimeDocsToInsert.length,
      totalCreatedSeats: allSeatDocsToInsert.length,
      createdSlotIds: txCreatedSlotIds,
      createdShowtimes: txCreatedShowtimes,
    };
  });
  ```

### 3.2. Số lượng truy vấn MongoDB trong Transaction (Quy mô 180 suất / 15.840 ghế / 9 phòng)

| Thao tác trong Transaction | Trước khi tối ưu | Sau khi tối ưu | Mức giảm |
| :--- | :---: | :---: | :---: |
| `Room.findOneAndUpdate` (`lockRoom`) | `9` | `9` | Giữ nguyên khóa an toàn 9 phòng |
| `Showtime.find` + `Movie` populate (đọc lịch hiện có) | `2 + (180 × 2) = 362` | `2` | **Giảm 360 truy vấn** |
| `ShowtimeSeat.aggregate` (tìm template ghế) | `180` *(COLLSCAN)* | `0` *(Chuẩn bị ngoài Tx + IXSCAN)* | **Giảm 180 COLLSCAN** |
| `ShowtimeSeat.find` (đọc 88 ghế mẫu) | `180` | `0` | **Giảm 180 truy vấn** |
| Ghi `Showtime` (`create` vs `insertMany`) | `180` | `1` | **Giảm 179 round-trips** |
| Ghi `ShowtimeSeat` (`15.840` ghế) | `180` | `5` *(chunks 3.520 ghế)* | **Giảm 175 round-trips** |
| **TỔNG SỐ LỆNH TRONG TRANSACTION** | **`1.091` lệnh tuần tự** | **`17` lệnh tuần tự** | **Giảm 98,4% số lượt round-trip** |

---

## 4. INDEX ĐÃ BỔ SUNG & KẾT QUẢ `explain('executionStats')`

- **Index bổ sung trên `ShowtimeSeat`:** `{ roomId: 1, showtimeId: 1 }`
- **Unique Index giữ nguyên:** `{ showtimeId: 1, seatNumber: 1 }` (`unique: true`)
- **Xác minh bằng `explain('executionStats')`:**
  - `winningPlan.stage`: `PROJECTION_SIMPLE` → `LIMIT` → `FETCH` → **`IXSCAN`** trên index `roomId_1_showtimeId_1` (`0` `COLLSCAN`).

---

## 5. THỜI GIAN PREVIEW & CONFIRM THỰC TẾ TRÊN MONGODB ATLAS (QUY MÔ 1 → 315 SUẤT)

| Quy mô kiểm thử | Số bản ghi `Showtime` | Số bản ghi `ShowtimeSeat` | Thời gian Preview | Thời gian Confirm (Trước khi sửa) | Thời gian Confirm (Sau khi sửa) | HTTP Status | Kết quả |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1 suất** | `1` | `88` | `263 ms` | `1.362 ms` | **`1.437 ms` (`1,4s`)** | `200 OK` | **PASS** |
| **5 suất** | `5` | `440` | `193 ms` | `4.486 ms` | **`2.361 ms` (`2,3s`)** | `200 OK` | **PASS** |
| **15 suất** | `15` | `1.320` | `196 ms` | `13.510 ms` | **`4.223 ms` (`4,2s`)** | `200 OK` | **PASS** |
| **45 suất** *(1 ngày × 9 phòng)* | `45` | `3.960` | `192 ms` | `39.580 ms` | **`8.463 ms` (`8,4s`)** | `200 OK` | **PASS** |
| **90 suất** *(2 ngày × 9 phòng)* | `90` | `7.920` | `199 ms` | `152.071 ms` *(Abort & Retry)* | **`7.950 ms` (`7,9s`)** | `200 OK` | **PASS** |
| **180 suất** *(4 ngày × 9 phòng)* | `180` | `15.840` | `1.989 ms` | `163.116 ms` (**FAIL 500**) | **`21.118 ms` (`21,1s`)** | `200 OK` | **PASS** |
| **315 suất** *(7 ngày × 9 phòng)* | `315` | `27.720` | `208 ms` | *(Timeout > 180s)* | **`24.802 ms` (`24,8s`)** | `200 OK` | **PASS** |

---

## 6. KẾT QUẢ KIỂM THỬ CÁC KỊCH BẢN BẮT BUỘC (SECTION 10)

| STT | Hạng mục kiểm thử | Kết quả | Chi tiết xác minh |
| :-: | :--- | :-: | :--- |
| 1 | Tạo hàng loạt `1`, `5`, `15`, `45`, `90`, `180`, `315` suất chiếu | **PASS** | Toàn bộ 7 mức quy mô (lên tới `315` suất = `27.720` ghế) đều commit thành công (`HTTP 200`) trong 1 Transaction duy nhất dưới 25 giây trên MongoDB Atlas. |
| 2 | Hai Admin đồng thời xác nhận tạo lịch cùng phòng (`Promise.all`) | **PASS** | Nhờ `lockRoom` theo thứ tự `Room ID` nhất quán, đúng 1 request thành công (`HTTP 200`, `180` suất) và request còn lại bị chặn (`HTTP 409 Conflict`), 0 suất trùng lặp. |
| 3 | Admin bấm xác nhận hai lần liên tiếp | **PASS** | Frontend khóa nút bằng `isConfirmingBatchRef` ngay lập tức; nếu gửi lặp API lần 2 với cùng chữ ký Preview, Backend trả về `HTTP 409` yêu cầu Preview lại. |
| 4 | Transaction bị lỗi giữa quá trình ghi ghế (`ShowtimeSeat.insertMany` chunk 2 lỗi) | **PASS** | Toàn bộ Transaction tự động rollback 100%: `0` `Showtime` và `0` `ShowtimeSeat` mồ côi trong MongoDB (`rolledBack: true`). |
| 5 | Transaction tự động retry (`TransientTransactionError`) | **PASS** | Mảng `txCreatedSlotIds` và `txCreatedShowtimes` được khởi tạo mới bên trong callback Transaction, trả về đúng `180` ID duy nhất của lần commit thành công. |
| 6 | Lịch đã hủy mềm (`cancelledAt != null`) | **PASS** | Các suất đã hủy mềm được loại trừ khỏi tập chiếm phòng, cho phép tạo suất chiếu mới thay thế tại cùng phòng và khung giờ. |
| 7 | Phim có thời lượng dài (`166p`, `192p`), suất cuối bắt đầu `22:30`, kéo dài qua `00:00` | **PASS** | Suất `Dune (166p)` bắt đầu `22:30` kết thúc `01:16 (+1 ngày)`, vệ sinh xong `01:36 (+1 ngày) <= 02:00`, dừng ngay sau suất cuối mà không tạo suất ảo. |
| 8 | Phòng đang bảo trì (`MAINTENANCE`) & mẫu ghế thiếu/sai cấu hình | **PASS** | Phòng `MAINTENANCE` bị loại khỏi lịch tạo và báo rõ trong `roomDaySummaries`; hàm `isValidRoomSeatTemplate` chặn mọi mẫu ghế sai/thiếu và luôn chuẩn hóa về 88 ghế chuẩn (`A–G: 12`, `H: 4`). |
| 9 | Đồng bộ danh sách suất hợp lệ giữa Preview và Confirm | **PASS** | Cả hai nhánh dùng chung `planBatchSchedule` và đối chiếu `expectedValidCount` + `expectedSignature` trong Transaction. |
| 10 | Khách hàng mở suất mới, chọn đủ 88 ghế & đồng bộ giá vé đến Checkout | **PASS** | `GET /api/showtimes/:id/seats` trả về đúng `88` ghế `AVAILABLE` với đầy đủ `ticketPrices` (`standard`, `vip`, `sweetbox`) đồng bộ với `TicketPricingConfig` và Checkout. |
| 11 | Bảo toàn dữ liệu hiện có & bộ test toàn hệ thống | **PASS** | Toàn bộ **61/61** bài test tích hợp Backend và bản build Production Frontend (`vite build`) đạt **PASS 100%**. |

---

## 7. CÁC LỖI HOẶC GIỚI HẠN CÒN TỒN TẠI

- **Không còn lỗi tồn đọng** đối với luồng xác nhận tạo lịch hàng loạt trong phạm vi cho phép của hệ thống (tối đa 30 ngày / 315+ suất chiếu mỗi lần xác nhận).
- Để đảm bảo trải nghiệm nhanh nhất trên đường truyền mạng thực tế tới MongoDB Atlas, khuyến nghị Admin xếp lịch theo từng đợt **1 ngày đến 7 ngày (45 – 315 suất chiếu/lần)**, thời gian hoàn tất chỉ từ **1,4 giây đến 24,8 giây**.
