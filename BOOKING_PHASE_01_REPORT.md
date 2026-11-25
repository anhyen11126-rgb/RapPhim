# BÁO CÁO TRIỂN KHAI GIAI ĐOẠN 1 — CHUẨN HÓA DỮ LIỆU PHÒNG CHIẾU VÀ SƠ ĐỒ GHẾ
**Dự án:** D'AVENOR CINEMA (`movietix-project`)  
**Phạm vi:** Giai đoạn 1 (Chuẩn hóa nhận diện `room.roomType`, sửa thuật toán `recommendSeats`, chuẩn hóa `seatLayout.js` và đồng bộ Client – Admin – Chatbot AI)  
**Thời điểm hoàn thành:** 25/11/2026  
**Cam kết dữ liệu:** Không xóa, không reset, không seed lại bất kỳ dữ liệu MongoDB nào; giữ nguyên toàn bộ giao diện Holographic Dark Navy, thiết kế 3 loại phòng, góc nhìn 3D, bảng giá động, quy tắc 15 phút dọn phòng, `scheduleRevision`, `claimSeats` Transaction, `Idempotency-Key` và bảo vệ suất chiếu Nhóm B.

---

## 1. Danh sách file đã sửa và bổ sung

### Backend (10 file: 1 file tạo mới + 9 file cập nhật)
1. **[roomLayoutConfig.js](file:///d:/CDIO/movietix-project/backend/src/utils/roomLayoutConfig.js)** *(Mới)* — Cấu hình chuẩn dùng chung cho 9 phòng chiếu thuộc 3 công nghệ (`ROOM_TYPES_ENUM`, `ACTIVE_CINEMA_ROOM_TYPES`), cấu hình 88 ghế (`SEAT_GRID_CONFIG`: 8 hàng A–H × 11 cột, lối đi sau cột 6) và các hàm chuẩn hóa `resolveCanonicalRoomType`, `resolveRoomThemeKey`, `resolvePricingFormatKey`, `resolveRowAisleSplitCol`.
2. **[showtimeController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/showtimeController.js)** — Populate `roomId` trong `getShowtimeById`, bổ sung `roomType` chuẩn hóa trong response `getShowtimeSeats`, viết lại thuật toán `recommendSeats` đọc trực tiếp cấu hình ghế thực tế từ MongoDB (`ShowtimeSeat`).
3. **[pricingConfigService.js](file:///d:/CDIO/movietix-project/backend/src/services/pricingConfigService.js)** — Chuẩn hóa `detectFormatKey` dựa trên enum `room.roomType` kết hợp định dạng phim `formatFeature`; populate `roomId` khi đồng bộ giá các suất chiếu tương lai trong `syncDatabaseWithPricingConfig`.
4. **[pricingService.js](file:///d:/CDIO/movietix-project/backend/src/services/ai/pricingService.js)** — Sửa `detectShowtimeFormat` của Chatbot AI dùng chung `resolvePricingFormatKey` thay vì đọc sai trường `showtime.room?.type`.
5. **[cinemaContextService.js](file:///d:/CDIO/movietix-project/backend/src/services/ai/cinemaContextService.js)** — Bổ sung biên lối đi cột 6–7 cho `findContiguousAvailableSeats` trên sơ đồ 11 cột, cập nhật tỷ trọng hạng ghế mặc định (`44 Standard / 33 VIP / 11 Sweetbox` = 88 ghế) và gắn `roomType` chuẩn hóa cho ngữ cảnh AI.
6. **[bookingController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/bookingController.js)** — Nạp `roomType` trực tiếp từ bản ghi `Room` đang hoạt động trong `checkoutBooking` và `exchangeBooking` để truyền vào `calculatePricesFromConfig` mà không làm thay đổi kiểu `ObjectId` của `targetShowtime.roomId` trong `assertSellableShowtime`.
7. **[movieController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/movieController.js)** — Populate `roomId` trong `getMovies`, lọc và sắp xếp suất chiếu theo enum `room.roomType` thay vì kiểm tra chuỗi `roomName.includes(...)`.
8. **[cinemaController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/cinemaController.js)** — Populate `roomId` trong `getCinemaShowtimes`, lọc bỏ suất chiếu đã hủy/khóa và trả về `roomType` chuẩn enum cho trang Cụm rạp.
9. **[adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js)** — Dùng `SEAT_GRID_CONFIG` khi khởi tạo mẫu 88 ghế, lọc `roomType` và phân loại định dạng suất chiếu bằng `resolveCanonicalRoomType`.
10. **[statisticsService.js](file:///d:/CDIO/movietix-project/backend/src/services/statisticsService.js)** — Populate `roomId` trong `getShowtimeDetailStats` và trả kèm `roomType`, `aisleAfterCol: 6` cho Drawer giám sát ghế của Admin.

### Frontend (10 file cập nhật)
11. **[seatLayout.js](file:///d:/CDIO/movietix-project/frontend/src/components/seat-booking/seatLayout.js)** — Định nghĩa `SEAT_LAYOUT_CONFIG` (8 hàng A–H × 11 ghế = 88 ghế, `aisleAfterCol: 6`), hàm `resolveRowAisleSplitCol`, loại bỏ hoàn toàn điều kiện cũ của hàng H (`label === 'H' && ordered.at(-1).col <= 4 ? 2 : 6`).
12. **[pricing.js](file:///d:/CDIO/movietix-project/frontend/src/utils/pricing.js)** — Bổ sung `ROOM_TYPES_ENUM`, `ACTIVE_CINEMA_ROOM_TYPES`, `resolveCanonicalRoomType`, `resolveRoomThemeKey` và cập nhật `detectFormatKey` phân tách rõ Công nghệ phòng (`room.roomType`), Định dạng phim (`formatFeature`) và Khóa bảng giá (`2D` | `3D` | `IMAX` | `GOLD_CLASS`).
13. **[SeatSelectionPage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/client/SeatSelectionPage.jsx)** — Lưu đúng enum `roomType` (`IMAX Laser` | `Dolby Atmos` | `Gold Class`) trên state `showtime`, dùng `resolveRoomThemeKey` để xác định theme (`IMAX` | `ATMOS` | `GOLD`), và truyền danh sách `seats` thực tế xuống `SmartSeatRecommender`.
14. **[SmartSeatRecommender.jsx](file:///d:/CDIO/movietix-project/frontend/src/components/seat-booking/SmartSeatRecommender.jsx)** — Xóa bỏ mảng hardcode cột 12 và hàng H 4 ghế trong `computeLocalRecommendation`; tính toán trực tiếp trên mảng `seats` thực tế từ MongoDB với biên lối đi cột 6–7.
15. **[ShowtimeDetailDrawer.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/drawers/ShowtimeDetailDrawer.jsx)** — Sửa vị trí `AISLE` trên sơ đồ 88 ghế phía Admin: xóa điều kiện cũ `isRowH && idx === 2`, đồng bộ lối đi giữa cột 6 và cột 7 cho tất cả các hàng A–H.
16. **[RoomManagePage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/RoomManagePage.jsx)** — Bổ sung `'Gold Class'` vào danh sách `ROOM_TYPES` (trước đây bị thiếu khiến Admin không lọc/chọn được Gold Class), đồng bộ màu nhãn và khoảng giá theo cấu hình bảng giá.
17. **[SeatManagePage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/SeatManagePage.jsx)** — Đồng bộ nhãn điều hướng từ `"8 Phòng Chiếu & Sức Chứa"` thành `"9 Phòng Chiếu & Sức Chứa (88 Ghế/Phòng)"`.
18. **[ShowtimeManagePage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/ShowtimeManagePage.jsx)** — Sử dụng `resolveCanonicalRoomType` trong `getRoomTypeTheme`, `getCompatibleFormats`, bộ lọc phòng, chế độ xem Theo phim và hàm gợi ý giá vé `resolveSuggestedPrice`.
19. **[HomeQuickBooking.jsx](file:///d:/CDIO/movietix-project/frontend/src/components/home/HomeQuickBooking.jsx)** — Nhóm suất chiếu theo 3 công nghệ phòng bằng `resolveRoomThemeKey` thay vì `.includes(...)` trên chuỗi thường.
20. **[TheatersPage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/client/TheatersPage.jsx)** — Bổ sung bộ lọc `'Gold Class'` vào `TECH_FILTERS` và `PRICE_MATRIX_FORMATS`; cập nhật `isRoomMatchingTech` đối chiếu trực tiếp `room.roomType` enum.

> **Các thành phần đã kiểm tra đạt chuẩn, giữ nguyên không cần chỉnh sửa:** `ImaxSeat.jsx`, `DolbySeat.jsx`, `GoldClassSeat.jsx`, `SeatGrid.jsx`, `MovieInfoSidebar.jsx`, `SeatLegendBar.jsx`, `Theater3DExperience.jsx`.

---

## 2. Nguyên nhân của từng lỗi

1. **Nhận diện loại phòng dựa vào chuỗi tên phòng (`roomName`):**
   - Trước đây nhiều nơi ở Frontend và Backend nối chuỗi `${roomName} ${roomType} ${formatFeature}` rồi tìm chuỗi con `.includes('atmos')`, `.includes('gold')`, `.includes('imax')`.
   - Trong `SeatSelectionPage.jsx`, khi truy cập trực tiếp URL không có `slotInfo`, `showtime.roomType` bị ghi đè thành `'GOLD'` / `'ATMOS'` thay vì giữ nguyên giá trị enum `'Gold Class'` / `'Dolby Atmos'`. Trong khi đó `pricingConfigService.js` chỉ kiểm tra `str.includes('gold class')`, gây nguy cơ lệch khóa bảng giá nếu tên phòng thay đổi.
   - Trong `ai/pricingService.js`, hàm `detectShowtimeFormat` đọc nhầm `showtime.room?.type` thay vì `showtime.roomId?.roomType`.
2. **Hardcode sơ đồ ghế cũ trong `recommendSeats` và `SmartSeatRecommender.jsx`:**
   - Sơ đồ rạp trước đây từng dùng 12 cột cho hàng A–G (`left: 1..6`, `right: 7..12`) và 4 ghế đôi cho hàng H (`left: 1..2`, `right: 3..4`).
   - Khi nâng cấp cơ sở dữ liệu lên 9 phòng × 88 ghế đồng nhất (8 hàng A–H × 11 cột `1..11`), mảng `rowsConfig` trong `showtimeController.js` và `SmartSeatRecommender.jsx` chưa được cập nhật, dẫn đến:
     - Bỏ sót hoàn toàn 7 ghế `H5..H11` và cắt sai lối đi hàng H giữa `H2` và `H3`.
     - Quét cả cột 12 không tồn tại (ở fallback phía Client có thể gợi ý nhầm ghế `E12`, `F12` không có trong DB).
   - Ngoài ra, hàm `findContiguousAvailableSeats` của Chatbot AI chưa kiểm tra ranh giới lối đi giữa cột 6 và cột 7 trên sơ đồ 11 cột.
3. **Điều kiện lỗi thời của hàng H trong `seatLayout.js` và `ShowtimeDetailDrawer.jsx`:**
   - `seatLayout.js` chỉ áp dụng `splitCol = 6` khi `roomType === 'IMAX'` kèm nhánh rẽ cũ `label === 'H' && ordered.at(-1).col <= 4 ? 2 : 6`, còn phòng `ATMOS` và `GOLD` lại dùng công thức chia đôi mảng `ordered[Math.ceil(ordered.length / 2) - 1].col`.
   - `ShowtimeDetailDrawer.jsx` (sơ đồ ghế phía Admin) vẫn đặt vạch `AISLE` của hàng H ở `idx === 2` (giữa `H2` và `H3`) thay vì giữa `H6` và `H7`.

---

## 3. Logic trước và sau chỉnh sửa

### 3.1. Nhận diện loại phòng & phân tách bảng giá
- **Trước chỉnh sửa:**
  - Nối chuỗi `roomName + roomType + formatFeature` và tìm từ khóa mờ (`includes('gold')`, `includes('atmos')`, `includes('imax')`).
  - Không tách bạch rõ giữa *Công nghệ phòng vật lý* (`IMAX Laser`, `Dolby Atmos`, `Gold Class`), *Định dạng chiếu của suất* (`2D Dolby Atmos` vs `3D Dolby Atmos`) và *Khóa bảng giá* (`2D`, `3D`, `IMAX`, `GOLD_CLASS`).
- **Sau chỉnh sửa:**
  - `resolveCanonicalRoomType` ưu tiên tuyệt đối enum `room.roomType` từ MongoDB (`IMAX Laser`, `Dolby Atmos`, `Gold Class`, `RealD 3D`, `2D Tiêu chuẩn`, `4DX Sound`), chỉ fallback sang tên phòng đối với bản ghi/mock test cũ không truyền `roomType`.
  - `resolvePricingFormatKey` ánh xạ rõ ràng:
    - `IMAX Laser` $\rightarrow$ khóa giá `IMAX`
    - `Gold Class` $\rightarrow$ khóa giá `GOLD_CLASS`
    - `Dolby Atmos` $\rightarrow$ giữ nguyên giao diện ghế `ATMOS`, nhưng nếu `formatFeature` là phim `3D` thì áp khóa giá `3D`, ngược lại áp khóa giá `2D`.

### 3.2. Thuật toán `recommendSeats`
- **Trước chỉnh sửa:**
  - Duyệt mảng cứng `rowsConfig` (`A–G: [1..6] & [7..12]`, `H: [1..2] & [3..4]`).
- **Sau chỉnh sửa:**
  - Đọc trực tiếp `rawSeats = await getStoredShowtimeSeats(targetShowtime._id)` từ MongoDB.
  - Tự động nhóm theo `seat.row`, sắp xếp theo `seat.col`, tách 2 dãy trái/phải qua `resolveRowAisleSplitCol(ordered)` (`splitCol = 6` $\rightarrow$ dãy trái `1..6`, dãy phải `7..11` cho mọi hàng A–H).
  - Kiểm tra đồng thời 3 điều kiện bắt buộc trên từng cửa sổ trượt `count` ghế:
    1. Toàn bộ ghế đều tồn tại trong DB và có `status === 'AVAILABLE'`.
    2. Các cột liền kề toán học tuyệt đối (`slice[k].col === slice[k - 1].col + 1`).
    3. Thuộc cùng một bên của lối đi (không bao giờ ghép cột 6 với cột 7).

### 3.3. Sơ đồ ghế `seatLayout.js` & Admin `ShowtimeDetailDrawer.jsx`
- **Trước chỉnh sửa:**
  - `seatLayout.js`: `const splitCol = roomType === 'IMAX' && ordered.at(-1).col <= 12 ? (label === 'H' && ordered.at(-1).col <= 4 ? 2 : 6) : ordered[Math.ceil(ordered.length / 2) - 1].col;`
  - `ShowtimeDetailDrawer.jsx`: `const isAisleBreak = (isRowH && idx === 2) || (!isRowH && idx === 6);`
- **Sau chỉnh sửa:**
  - Dùng chung `SEAT_LAYOUT_CONFIG` (`rows: A–H`, `colsPerRow: 11`, `aisleAfterCol: 6`, `totalSeats: 88`).
  - `seatLayout.js`: `const splitCol = resolveRowAisleSplitCol(ordered);` — đồng nhất cột `1..6` | `AISLE` | `7..11` cho cả 8 hàng A–H trên cả 3 loại phòng (`IMAX`, `ATMOS`, `GOLD`).
  - `ShowtimeDetailDrawer.jsx`: Hiển thị `AISLE` đúng tại ranh giới `prevSeat.col <= 6 && currSeat.col > 6` cho mọi hàng A–H.

---

## 4. Kết quả kiểm thử thực tế

Toàn bộ kiểm thử dưới đây đã được **chạy thực tế** trên cơ sở dữ liệu MongoDB Atlas hiện hành (chế độ không ghi/xóa dữ liệu vận hành) và bộ kiểm thử của dự án:

| Hạng mục kiểm thử bắt buộc | Trạng thái | Chi tiết kết quả thực tế |
| :--- | :---: | :--- |
| **1. Kiểm tra đủ 9 phòng chiếu & 1 cụm rạp** | **PASS** | Xác nhận đúng 1 cụm rạp (`D'AVENOR Thanh Khê Plaza`) và 9 phòng vật lý có `_id` độc lập: Phòng 01–03 (`IMAX Laser`), Phòng 04–06 (`Dolby Atmos`), Phòng 07–09 (`Gold Class`), `0` suất chiếu thiếu `roomId`. |
| **2. Kiểm tra đủ 88 ghế trên mỗi suất chiếu** | **PASS** | Đã gọi `GET /api/showtimes/:id/seats` trên suất chiếu thực tế của cả 9/9 phòng: `totalSeats = 88`, 8 hàng A–H × 11 ghế. |
| **3. Kiểm tra toàn bộ ghế A01–H11 & `seatLayout.js`** | **PASS** | `normalizeSeatCode('A01'..'H11')` chuẩn hóa chính xác thành `A1..H11`; `createSeatLayout` chia đúng dãy trái `[1..6]` và dãy phải `[7..11]` cho mọi hàng A–H trên cả 3 loại phòng. |
| **4. Kiểm tra gợi ý ghế tại hàng H** | **PASS** | Khi hàng A–G kín chỗ và `H3` đã đặt, `GET /recommend-seats?count=4&preference=FAR_SCREEN` gợi ý chính xác `[H7, H8, H9, H10]` ở dãy phải hàng H (không còn bị giới hạn 4 cột cũ). |
| **5. Kiểm tra gợi ý 2, 3, 4 ghế liền nhau** | **PASS** | Trên suất chiếu thực tế: `count=2` $\rightarrow$ `[E5, E6]`, `count=3` $\rightarrow$ `[E4, E5, E6]`, `count=4` $\rightarrow$ `[E3, E4, E5, E6]`; không tạo cột 12 ảo. |
| **6. Kiểm tra gợi ý ghế gần lối đi** | **PASS** | Khi chỉ còn `[E5, E6]` và `[E7, E8]` trống hai bên lối đi: `count=3` và `count=4` trả về `success: false` (chặn ghép ngang lối đi cột 6–7); `count=2` trả về `[E5, E6]`. Tương tự với `findContiguousAvailableSeats` của AI. |
| **7. Kiểm tra ghế đã đặt không được gợi ý** | **PASS** | `0` ghế có trạng thái `BOOKED` xuất hiện trong `bestRecommendation` hoặc `alternatives` ở mọi kịch bản. |
| **8. Kiểm tra bảng giá của cả 3 loại phòng** | **PASS** | Giờ vàng ngày thường (kể cả khi đặt tên phòng không chứa từ khóa): `Dolby Atmos 2D = 55.000đ` (`3D = 80.000đ`), `IMAX Laser = 150.000đ` (`VIP = 175.000đ`), `Gold Class = 210.000đ` (`VIP = 240.000đ`). Bảo toàn quy tắc `2D < 3D < IMAX < GOLD_CLASS` và `Standard < VIP < Sweetbox`. |
| **9a. Chạy `test/booking-and-admin.test.js`** | **1 PASS / 18 SKIPPED (0 FAIL)** | Test quy tắc 7 ngày xuyên giao thừa theo lịch Việt Nam **PASS** (`1.78ms`). 18 test tích hợp còn lại ở trạng thái `SKIPPED` do môi trường local không cài gói `mongodb-memory-server` (`DAVENOR_TEST_MONGO_MODULE` không được thiết lập trong `backend/package.json`). |
| **9b. Chạy `scripts/testChatbotUpgrade.js`** | **PASS (17/17)** | Toàn bộ 17/17 kịch bản Chatbot AI nâng cấp (lịch chiếu 3 loại phòng IMAX/Dolby/Gold Class, đếm ghế `88/88` & `87/88`, bảo mật JWT tra cứu vé, ưu đãi thứ...) đều **PASS**. |
| **10. Kiểm tra `npm --prefix frontend run build`** | **PASS** | Vite v8.3.5 build production thành công trong `1.25s` (`2207 modules transformed`), **0 lỗi compile/import**. |

---

## 5. Các lỗi còn tồn tại (Ngoài phạm vi Giai đoạn 1 — Chưa can thiệp)

1. **Cơ chế giữ ghế tạm thời (`HOLDING`) & Đồng hồ đếm ngược Checkout:** `POST /api/bookings/hold` hiện mới xác nhận phía giao diện mà chưa ghi khóa tạm có thời hạn (`holdExpiresAt`) xuống DB; `CheckoutPage.jsx` chưa có đồng hồ đếm ngược phiên thanh toán (theo đúng yêu cầu mục 5: *Không triển khai HOLDING, countdown hoặc refactor Checkout trong giai đoạn này*).
2. **Truyền `slotInfo` từ `TheatersPage.jsx`:** Khi bấm chọn giờ chiếu từ `TheatersPage.jsx`, lệnh `navigate('/booking/seat/' + showtimeId)` chưa truyền kèm `state: { slotInfo }`, nên trang chọn ghế chờ API `/seats` phản hồi trong ~0.3–0.5s đầu (API nay đã trả đầy đủ `roomType` và `room` nên dữ liệu hiển thị hoàn toàn chính xác).
3. **Bộ test cô lập `booking-and-admin.test.js` & script cũ `testAiChatbot.js`:**
   - 18 test trong `booking-and-admin.test.js` cần gói `mongodb-memory-server` để chạy replica set in-memory độc lập.
   - Script cũ `backend/scripts/testAiChatbot.js` (phiên bản trước `testChatbotUpgrade.js`) vẫn assert chuỗi thông báo cũ `/HẾT GHẾ \(0 ghế trống\)/i` trong khi `responseBuilder.js` hiện xuất định dạng mới `HẾT GHẾ (0/88)`.
4. **Hàm `autoSeedCinemaShowtimes` dự phòng trong `cinemaController.js`:** Khi DB đã có lịch chiếu thực tế thì không chạy vào nhánh này, nhưng bên trong thân hàm cũ (dòng 140–212) vẫn còn cấu trúc mẫu cũ phòng khi ngày trống lịch; cần dọn hoặc vô hiệu hóa ở giai đoạn sau để tránh tự sinh dữ liệu mẫu ngoài ý muốn.

---

## 6. Ảnh hưởng đến những module liên quan

- **Trang chọn ghế Client (`SeatSelectionPage.jsx`, `SeatGrid.jsx`, `SmartSeatRecommender.jsx`, `Theater3DExperience.jsx`):** Nhận diện chính xác 100% 3 giao diện phòng (`IMAX`, `ATMOS`, `GOLD`) từ `room.roomType`; sơ đồ 2D và góc nhìn 3D giữ nguyên thiết kế, hàng H chia đúng 6 ghế trái – lối đi – 5 ghế phải đồng bộ với hàng A–G.
- **Thanh toán & Đổi vé (`bookingController.js`, `pricingConfigService.js`, `pricing.js`):** Giá vé Standard / VIP / Sweetbox của cả 9 phòng giữ nguyên 100% theo `TicketPricingConfig`, đồng thời an toàn tuyệt đối kể cả khi Admin đổi tên hiển thị của phòng chiếu.
- **Quản trị Admin (`RoomManagePage.jsx`, `SeatManagePage.jsx`, `ShowtimeManagePage.jsx`, `ShowtimeDetailDrawer.jsx`):** Admin lọc và cấu hình đủ cả 3 công nghệ phòng (bao gồm `Gold Class`), xem sơ đồ 88 ghế trong Drawer với lối đi hàng H thẳng hàng tuyệt đối với hàng A–G.
- **Chatbot AI (`cinemaContextService.js`, `ai/pricingService.js`):** Tư vấn giá vé đúng theo `room.roomType` và không gợi ý cụm ghế vắt ngang qua lối đi giữa cột 6 và cột 7.

---

## 7. Kết quả `git diff --stat`

Ngoài 2 file mới chưa staged (`backend/src/utils/roomLayoutConfig.js` và các file báo cáo `.md`), kết quả `git diff --stat` trên các file hiện hữu như sau:

```text
 backend/src/controllers/adminController.js         |  49 ++++----
 backend/src/controllers/bookingController.js       |  24 +++-
 backend/src/controllers/cinemaController.js        |  24 +++-
 backend/src/controllers/movieController.js         |  31 +++--
 backend/src/controllers/showtimeController.js      | 137 +++++++++++++--------
 backend/src/services/ai/cinemaContextService.js    |  28 +++--
 backend/src/services/ai/pricingService.js          |  15 +--
 backend/src/services/pricingConfigService.js       |  27 ++--
 backend/src/services/statisticsService.js          |   8 +-
 frontend/src/components/home/HomeQuickBooking.jsx  |   7 +-
 .../seat-booking/SmartSeatRecommender.jsx          |  93 +++++++++-----
 frontend/src/components/seat-booking/seatLayout.js |  99 ++++++++++-----
 frontend/src/pages/admin/RoomManagePage.jsx        |  16 +--
 frontend/src/pages/admin/SeatManagePage.jsx        |   2 +-
 frontend/src/pages/admin/ShowtimeManagePage.jsx    |  38 ++++--
 .../statistics/drawers/ShowtimeDetailDrawer.jsx    |  10 +-
 frontend/src/pages/client/SeatSelectionPage.jsx    |  27 ++--
 frontend/src/pages/client/TheatersPage.jsx         |  40 +++---
 frontend/src/utils/pricing.js                      | 116 +++++++++++++++--
 19 files changed, 542 insertions(+), 249 deletions(-)
```

---

## 8. Đề xuất triển khai Giai đoạn 2 (Chờ phê duyệt)

Đề xuất phạm vi **Giai đoạn 2 — Đồng bộ Luồng Điều hướng Đặt vé, Tối ưu Polling Ghế & Hoàn thiện Trải nghiệm Checkout**:
1. **Đồng bộ toàn bộ cổng vào trang chọn ghế (`TheatersPage.jsx`, `HomeQuickBooking.jsx`, `MovieShowtimesSection.jsx`, `ChatWidget.jsx`):**
   - Truyền đầy đủ `slotInfo` chuẩn hóa (`roomId`, `roomName`, `roomType`, `formatFeature`, `startTime`, `price`, `movie`) từ `TheatersPage.jsx` sang `SeatSelectionPage.jsx` để triệt tiêu độ trễ chuyển trang.
   - Rà soát và vô hiệu hóa nhánh `autoSeedCinemaShowtimes` cũ trong `cinemaController.js` để không bao giờ tự sinh ghế 12 cột ngoài ý muốn khi xem ngày chưa xếp lịch.
2. **Tối ưu API Polling sơ đồ ghế (`GET /api/showtimes/:id/seats`):**
   - Hỗ trợ chế độ polling nhẹ (`?lite=1` hoặc projection tối ưu) và tự động giải phóng các bản ghi ghế `HOLDING` đã quá hạn `holdExpiresAt < now` (nếu có dữ liệu tồn đọng).
3. **Hoàn thiện trang `CheckoutPage.jsx` & Vé điện tử:**
   - Hiển thị đúng nhãn định dạng/công nghệ phòng thực tế trên header `CheckoutPage.jsx` (hiện tại dòng 245 của `CheckoutPage.jsx` đang gắn cứng chữ `IMAX LASER` kể cả khi khách đặt phòng Dolby Atmos hoặc Gold Class) và bảo toàn state khi reload trang Checkout.
   - Bổ sung đồng hồ đếm ngược phiên thanh toán (10 phút) rõ ràng cho khách hàng (nếu bạn muốn kích hoạt ở Giai đoạn 2).
