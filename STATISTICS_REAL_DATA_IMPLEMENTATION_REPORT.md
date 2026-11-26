# BÁO CÁO TRIỂN KHAI CHUYỂN HỆ THỐNG THỐNG KÊ D’AVENOR CINEMA SANG DỮ LIỆU LIVE (`movietix_db`)

- **Ngày thực hiện:** `2026-11-26` (Múi giờ chuẩn `Asia/Ho_Chi_Minh`, GMT+7)
- **Nhánh Git hiện tại:** `integration-cdio-2611`
- **Phương án áp dụng:** **Phương án B — Sử dụng database LIVE (`movietix_db`)** làm nguồn dữ liệu hoạt động chính thức của toàn bộ website.

---

## 1. Nguyên Nhân Ban Đầu

Qua báo cáo `STATISTICS_REAL_DATA_SOURCE_AUDIT.md`, nguyên nhân dẫn đến việc hệ thống thống kê hiển thị dữ liệu Tháng 10/2026 và 7–18 bộ phim trong Tháng 11/2026 gồm:
1. **Biến môi trường `DB_MODE` trong `backend/.env` đang để `DEMO` (`movietix_demo_db`):**
   - Database `movietix_demo_db` chứa dữ liệu lịch sử giả lập do script `seedDemoStatistics2026.js` tạo ra cho Tháng 10/2026 (753 suất chiếu, 490 đơn `SIMULATED`, 7 bộ phim) và giai đoạn `01/11–24/11/2026` (534 suất chiếu trộn 7 bộ phim, trong đó có 4 phim `COMING_SOON`).
   - Trong khi đó, database chính thức **`movietix_db` (`LIVE`)** hoàn toàn sạch ở Tháng 10/2026 (`0 suất`, `0 đơn`) và trong Tháng 11/2026 chỉ chứa đúng **3 bộ phim** được Admin xếp lịch chiếu thực tế (`Dune: Hành Tinh Cát – Phần 2`, `Mai`, `Deadpool & Wolverine`).
2. **Hàm `getMoviesStats` trong `statisticsService.js` và bộ lọc `StatisticsFilter.jsx` lấy toàn bộ `Movie.find({})` (18 bộ phim):**
   - Khiến bảng Hiệu suất Phim và dropdown lọc Phim hiển thị cả 15 bộ phim `COMING_SOON` không có lịch chiếu hay giao dịch trong kỳ báo cáo.
3. **Chưa có mốc giới hạn thời gian bắt đầu hoạt động của rạp (`01/11/2026`):**
   - Bộ lọc thời gian trên UI và `parseDateFilter` ở Backend vẫn cho phép chọn Tháng 1..10/2026, năm 2024–2025, tùy chọn `"Tháng trước"` khi đang ở Tháng 11/2026, và vẫn tính tăng trưởng MoM của Tháng 11/2026 so với Tháng 10/2026.

---

## 2. Database Đang Kết Nối Sau Khi Sửa

- **`DB_MODE` hiện tại:** `LIVE`
- **Tên database kết nối thực tế (`mongoose.connection.name`):** `movietix_db`
- **Đồng bộ toàn hệ thống:** Tất cả các phân hệ (Trang khách hàng, Đặt vé & Giữ ghế 600s, Thanh toán, Vé QR, Chatbot AI và Quản trị / Thống kê `/admin/statistics`) đều sử dụng chung một nguồn dữ liệu duy nhất là `movietix_db`.
- **Cơ chế bảo vệ kết nối trong `backend/src/config/db.js`:**
  - Tuyệt đối không tự động âm thầm chuyển sang `movietix_demo_db` hoặc MongoDB Local khi kết nối `LIVE` gặp sự cố.
  - Xác minh `conn.connection.name === 'movietix_db'` ngay khi khởi động và ghi log minh bạch:
    `🍃 [MongoDB - LIVE MODE] Đã kết nối thành công: <***REDACTED_HOST***>/movietix_db`

---

## 3. Danh Sách File Đã Thay Đổi

| STT | Đường dẫn File | Nội dung cập nhật chính |
| :-: | :--- | :--- |
| 1 | [backend/src/config/db.js](file:///d:/CDIO/movietix-project/backend/src/config/db.js) | Bổ sung `getActiveDbMode()`, đảm bảo `DB_MODE=LIVE` luôn kết nối tới `movietix_db`, kiểm tra tên database sau kết nối và chặn việc tự động fallback âm thầm sang DEMO/Local DB. |
| 2 | [backend/src/utils/statisticsUtils.js](file:///d:/CDIO/movietix-project/backend/src/utils/statisticsUtils.js) | Thiết lập mốc tập trung `CINEMA_OPERATION_START = makeVietnamDate(2026, 11, 1, 0, 0, 0, 0)`, class lỗi `StatisticsPeriodValidationError` (HTTP `400`), hàm `enforceOperationStartBoundary`, và khóa tăng trưởng MoM cho tháng đầu vận hành (`11/2026`). |
| 3 | [backend/src/services/statisticsService.js](file:///d:/CDIO/movietix-project/backend/src/services/statisticsService.js) | Xây dựng helper dùng chung `resolveActiveMoviesInPeriod`, endpoint `getPeriodFilterMovies`, thuật toán phân bổ chi phí không sai số làm tròn `allocateSharedExpensesToMovies`, giới hạn bảng `monthlyBreakdown` năm 2026 từ Tháng 11, và tách biệt ghế `completedUnsoldSeats` vs `upcomingAvailableSeats`. |
| 4 | [backend/src/controllers/statisticsController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/statisticsController.js) | Bổ sung controller `getFilterMovies` và chuẩn hóa `handleStatsError` trả đúng HTTP `400` khi kỳ báo cáo vi phạm mốc vận hành `01/11/2026`. |
| 5 | [backend/src/controllers/expenseController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/expenseController.js) | Áp dụng mốc `CINEMA_OPERATION_START` cho API lấy danh sách chi phí, thêm mới và cập nhật chi phí (chặn ghi nhận chi phí trước `01/11/2026`). |
| 6 | [backend/src/routes/statisticsRoutes.js](file:///d:/CDIO/movietix-project/backend/src/routes/statisticsRoutes.js) | Đăng ký route `GET /api/admin/statistics/filter-movies` (bảo vệ bởi `authenticateAdmin`). |
| 7 | [frontend/src/pages/admin/statistics/services/statisticsApi.js](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/services/statisticsApi.js) | Cập nhật `getFilterMovies(params, signal)` gọi `/admin/statistics/filter-movies` theo kỳ báo cáo và phạm vi phòng đang chọn. |
| 8 | [frontend/src/pages/admin/statistics/components/StatisticsFilter.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/components/StatisticsFilter.jsx) | Giới hạn Năm từ `2026` trở đi (sinh động), Năm `2026` chỉ cho chọn từ `Tháng 11` trở đi, ẩn `"Tháng trước"` ở tháng đầu vận hành, khóa `min="2026-11-01"` cho khoảng ngày tùy chọn, bỏ fallback `movies.length \|\| 18`. |
| 9 | [frontend/src/pages/admin/statistics/StatisticsPage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/StatisticsPage.jsx) | Tải danh sách phim bộ lọc động theo kỳ & phạm vi phòng, tự động reset `movieId` về `'ALL'` khi chuyển sang kỳ mới mà phim cũ không hoạt động, chống race-condition bằng `AbortController` + `requestSeqRef`. |
| 10 | [frontend/src/pages/admin/statistics/tabs/OverviewTab.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/tabs/OverviewTab.jsx) | Hiển thị rõ `"Tháng đầu vận hành"` / `"Chưa có kỳ trước để so sánh (Rạp hoạt động từ 01/11/2026)"` và banner cảnh báo `schedulePolicyWarning` nếu kỳ có >3 phim. |
| 11 | [frontend/src/pages/admin/statistics/tabs/RevenueTab.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/tabs/RevenueTab.jsx) | Cập nhật nút bảng tổng hợp tháng thành `"Theo tháng ({monthlyBreakdown.length})"` bắt đầu từ Tháng 11/2026. |

---

## 4. Logic Xác Định Phim Trong Kỳ Báo Cáo (Dynamic Resolution)

Hàm dùng chung `resolveActiveMoviesInPeriod` trong [backend/src/services/statisticsService.js](file:///d:/CDIO/movietix-project/backend/src/services/statisticsService.js#L186-L254) xác định danh sách phim hoạt động trong kỳ báo cáo hoàn toàn bằng dữ liệu thực tế từ MongoDB:
1. **Từ lịch chiếu thực tế (`Showtime`):** Thu thập tất cả `Showtime.movieId` có `startTime` nằm trong kỳ `[start, showtimeEnd]`, khớp với bộ lọc phòng (`roomId` / `roomType`) và chưa bị hủy (`!cancelledAt && lifecycleStatus !== 'CANCELLED'`).
2. **Từ đơn đặt vé hợp lệ (`Booking`):** Thu thập `movieId` từ các đơn có `status: 'PAID'` và `paymentStatus \in ['VERIFIED', 'SIMULATED']` phát sinh trong kỳ `[start, end]`.
3. **Từ giao dịch hoàn tiền hợp lệ (`CANCELLED` Bookings):** Thu thập `movieId` từ các đơn hủy có hoàn tiền hợp lệ trong kỳ để bảo toàn lịch sử đối soát tài chính ngay cả khi suất chiếu đã hủy.
4. **Từ chứng từ chi phí trực tiếp (`Expense`):** Thu thập `Expense.movieId` phát sinh trong kỳ.
5. **Nguyên tắc bất biến:**
   - Không phụ thuộc vào `Movie.status` hiện tại (đảm bảo báo cáo lịch sử các tháng cũ luôn chính xác kể cả khi sau này phim chuyển sang `ENDED`).
   - Không gọi `Movie.find({})` để đưa các phim không có hoạt động vào bảng.
   - Không dùng `slice(0, 3)` hay `limit(3)` để ép cứng 3 phim; nếu dữ liệu thực tế có nhiều hơn 3 phim trong kỳ, hệ thống trả về đầy đủ toàn bộ các phim đó kèm cờ `schedulePolicyWarning`.

---

## 5. Logic Giới Hạn Thời Gian Hoạt Động (`01/11/2026`)

Trong [backend/src/utils/statisticsUtils.js](file:///d:/CDIO/movietix-project/backend/src/utils/statisticsUtils.js#L32-L162):
- Hằng số trung tâm:
  ```javascript
  export const CINEMA_OPERATION_START = makeVietnamDate(2026, 11, 1, 0, 0, 0, 0);
  ```
- **Khi toàn bộ khoảng thời gian nằm trước `01/11/2026` (`end < CINEMA_OPERATION_START`):**
  - Ném lỗi `StatisticsPeriodValidationError` (HTTP `400`, mã `PERIOD_BEFORE_OPERATION_START`) với thông báo tường minh:
    *"Rạp D'AVENOR CINEMA bắt đầu hoạt động và thống kê từ ngày 01/11/2026. Kỳ báo cáo nằm trước thời điểm rạp vận hành."*
  - Tuyệt đối không tạo khoảng thời gian `start > end` và không âm thầm chuyển yêu cầu Tháng 10 thành Tháng 11.
- **Khi khoảng thời gian giao với `01/11/2026` (`start < CINEMA_OPERATION_START <= end`, ví dụ `30_days` hoặc `this_year`):**
  - Tự động kẹp `start = CINEMA_OPERATION_START` (`01/11/2026 00:00:00.000 GMT+7`) và gắn cờ `wasClampedToOperationStart: true`.
- **Khi kỳ báo cáo là Tháng 11/2026 (tháng đầu vận hành) hoặc kỳ liền trước nằm trước `01/11/2026`:**
  - Đặt `hasValidPreviousPeriod = false`, `isFirstOperatingMonth = true`, `prevStart = null`, `prevEnd = null`.
  - Mọi chỉ số tăng trưởng MoM trả về `null` và hiển thị `"Tháng đầu vận hành • Chưa có kỳ trước để so sánh"`.

---

## 6. Kết Quả Đối Soát MongoDB LIVE (`movietix_db`) Với Từng API

Đối soát trực tiếp giữa truy vấn MongoDB `movietix_db` và kết quả trả về của 5 API thống kê cho kỳ **Tháng 11/2026**:

| Chỉ số Đối soát | Truy vấn MongoDB `movietix_db` | `GET /overview` | `GET /revenue` | `GET /movies` | `GET /showtimes` | `GET /filter-movies` | Kết luận |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Database kết nối** | `movietix_db` | `movietix_db` | `movietix_db` | `movietix_db` | `movietix_db` | `movietix_db` | **Khớp 100%** |
| **Số phim hoạt động T11/2026** | **3 phim** | `3 phim` | `3 phim` | `3 phim` | `3 phim` | `3 phim` | **Khớp 100%** |
| **Suất chiếu hoạt động** | **226 suất** | `226 suất` | `226 suất` | `226 suất` | `226 suất` (+3 hủy = 229) | `226 suất` | **Khớp 100%** |
| **Suất chiếu đã hủy** | **3 suất** | `3 suất` | Loại trừ khỏi mở bán | `3 suất` | `3 suất` (`CANCELLED`) | Loại trừ khỏi mở bán | **Khớp 100%** |
| **Tổng ghế mở bán trong kỳ** | **19.888 ghế** ($226 \times 88$) | `19.888 ghế` | `19.888 ghế` | `19.888 ghế` | `88 ghế/suất` | — | **Khớp 100%** |
| **Số đơn hợp lệ (`PAID`)** | **1 đơn** | `1 đơn` | `1 đơn` | `1 đơn` | `1 khách` | — | **Khớp 100%** |
| **Số đơn đã hủy (`CANCELLED`)** | **4 đơn** | `4 đơn` | `4 đơn` | — | — | — | **Khớp 100%** |
| **Số vé hợp lệ đã bán** | **1 vé** | `1 vé` | `1 vé` | `1 vé` | `1 ghế` | — | **Khớp 100%** |
| **Doanh thu `VERIFIED`** | **0 đ** | `0 ₫` | `0 đ` | — | — | — | **Khớp 100%** |
| **Doanh thu `SIMULATED`** | **130.000 đ** | `130.000 ₫` | `130.000 đ` | `130.000 đ` | `130.000 đ` | — | **Khớp 100%** |
| **Tổng chi phí (`Expense`)** | **0 đ** (0 chứng từ) | `0 ₫` | `0 đ` | `0 đ` | — | — | **Khớp 100%** |
| **Lợi nhuận & Trạng thái LN** | `null` (`INSUFFICIENT_DATA`) | `Chưa đủ dữ liệu` | `Chưa đủ dữ liệu` | `Chưa đủ dữ liệu` | — | — | **Khớp 100%** |
| **Tỷ lệ lấp đầy bình quân** | **0,01%** ($1 / 19.888$) | `0.01%` | — | `0.01%` | — | — | **Khớp 100%** |

---

## 7. Số Liệu Thực Tế Của Từng Phim Trong Tháng 11/2026 (`movietix_db`)

| Hạng | Movie ID | Tên bộ phim | Tổng suất hoạt động | Suất đã chiếu | Suất sắp chiếu | Tổng ghế mở bán | Vé đã bán | Ghế trống (Đã chiếu) | Ghế còn đặt được (Sắp chiếu) | Tỷ lệ lấp đầy | Doanh thu thuần | Chi phí & Lợi nhuận |
| :-: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **#1** | `6ae9bb4bd501154e2732830a` | **Dune: Hành Tinh Cát – Phần 2** | **76 suất** | 22 suất | 54 suất | **6.688 ghế** | **1 vé** | 1.935 ghế | 4.752 ghế | **0,01%** | **130.000 đ** | `Chưa đủ dữ liệu` |
| **#2** | `6ae9849f9a932177a610469c` | **Deadpool & Wolverine** | **75 suất** | 21 suất | 54 suất | **6.600 ghế** | **0 vé** | 1.848 ghế | 4.752 ghế | **0%** | **0 đ** | `Chưa đủ dữ liệu` |
| **#3** | `6ae624fdb0ee30fb919c72d2` | **Mai** | **75 suất** | 18 suất | 57 suất | **6.600 ghế** | **0 vé** | 1.584 ghế | 5.016 ghế | **0%** | **0 đ** | `Chưa đủ dữ liệu` |
| **Tổng** | | **3 bộ phim** | **226 suất** | **61 suất** | **165 suất** | **19.888 ghế** | **1 vé** | **5.367 ghế** | **14.520 ghế** | **0,01%** | **130.000 đ** | `Chưa đủ dữ liệu` |

> **Kiểm chứng tổng số ghế:** $1 \text{ (Đã bán)} + 5.367 \text{ (Trống đã chiếu)} + 14.520 \text{ (Còn đặt được sắp chiếu)} = 19.888 \text{ ghế} = 226 \text{ suất} \times 88 \text{ ghế/suất}$.

---

## 8. Kết Quả Kiểm Thử 25 Trường Hợp Bắt Buộc (Mục IX)

| Mã TC | Nội dung kiểm thử | Môi trường | Kết quả | Chi tiết đối soát |
| :-: | :--- | :---: | :-: | :--- |
| **TC01** | LIVE kết nối đúng database `movietix_db` | Atlas LIVE (Read-only) | **PASS** | `DB_MODE=LIVE`, `mongoose.connection.name === 'movietix_db'`. |
| **TC02** | Tháng 10/2026 không thể chọn trên UI | Playwright UI + LIVE | **PASS** | Dropdown Tháng của Năm 2026 chỉ có `['Tháng 11', 'Tháng 12']`; Năm chỉ từ `2026` trở đi. |
| **TC03** | API không trả dữ liệu trước ngày vận hành `01/11/2026` | Atlas LIVE (Read-only) | **PASS** | Gọi API với `month=10, year=2026` trả về HTTP `400` (`PERIOD_BEFORE_OPERATION_START`). |
| **TC04** | Báo cáo năm 2026 bắt đầu từ tháng 11 | Atlas LIVE (Read-only) | **PASS** | `monthlyBreakdown` năm 2026 chỉ gồm 2 dòng: `Tháng 11/2026` và `Tháng 12/2026`. |
| **TC05** | Tháng 11 chỉ có đúng các phim thực sự hoạt động | Atlas LIVE (Read-only) | **PASS** | Trả về đúng 3 phim (`Dune`, `Deadpool & Wolverine`, `Mai`), không có 15 phim `COMING_SOON`. |
| **TC06** | Bộ lọc phim đồng bộ với bảng thống kê | Playwright UI + LIVE | **PASS** | Dropdown Phim hiển thị `"Tất cả phim trong kỳ (3 phim)"` gồm đúng 3 phim của bảng. |
| **TC07** | Ba tab thống kê đồng bộ tuyệt đối | Atlas LIVE (Read-only) | **PASS** | Cả 3 tab đều khớp: `3 phim`, `226 suất`, `19.888 ghế`, `1 vé`, `130.000 đ`. |
| **TC08** | Hai bảng hiệu suất phim (Bán vé vs Tài chính) đồng bộ | Atlas LIVE (Read-only) | **PASS** | Số suất, số vé, doanh thu, chi phí của từng phim khớp 100% giữa 2 chế độ bảng. |
| **TC09** | Drawer chi tiết phim khớp số liệu bảng | Atlas LIVE (Read-only) | **PASS** | Cả 3 phim trong `getMovieDetailStats` khớp số suất (`76/75/75`), ghế, vé, doanh thu với bảng. |
| **TC10** | Drawer suất chiếu khớp `ShowtimeSeat` | Atlas LIVE (Read-only) | **PASS** | Suất `6b05a8756d1e5eeaa836d0f9` khớp 88 ghế (`1 BOOKED`, `0 HOLDING`, `87 AVAILABLE`). |
| **TC11** | Không tính suất hủy vào công suất mở bán | Atlas LIVE (Read-only) | **PASS** | 3 suất `CANCELLED` được tách riêng; tổng ghế mở bán = $226 \times 88 = 19.888$ ghế. |
| **TC12** | Không tính ghế `HOLDING` vào số vé đã bán | `MongoMemoryReplSet` | **PASS** | 3 ghế `HOLDING` còn hạn được tách riêng (`booked=0, holding=3, available=173`). |
| **TC13** | Không tính ghế suất đã kết thúc là ghế còn đặt được | `MongoMemoryReplSet` | **PASS** | 88 ghế của suất `COMPLETED` nằm ở `completedUnsoldSeats=88`, `upcomingAvailableSeats=85`. |
| **TC14** | Không hiển thị lợi nhuận giả khi chưa có chi phí | Atlas LIVE (Read-only) | **PASS** | Khi `hasExpenseData=false`, `profit=null`, hiển thị `"Chưa đủ dữ liệu tính lợi nhuận"`. |
| **TC15** | Doanh thu `VERIFIED` và `SIMULATED` được phân biệt | Atlas LIVE (Read-only) | **PASS** | `verifiedRevenue=0đ`, `simulatedRevenue=130.000đ`, badge `"Doanh thu mô phỏng"`. |
| **TC16** | Không tính tăng trưởng tháng 11 so với tháng 10 | Atlas LIVE (Read-only) | **PASS** | `hasValidPreviousPeriod=false`, `growth=null`, hiển thị `"Tháng đầu vận hành"`. |
| **TC17** | Xuất CSV khớp bộ lọc và dữ liệu trên UI | Atlas LIVE (Read-only) | **PASS** | File CSV có BOM UTF-8, khớp `130000`, `3 phim`, `226 suất`, `19888 ghế`. |
| **TC18** | Tháng chưa có lịch chiếu hiển thị đúng empty state | Atlas LIVE (Read-only) | **PASS** | Tháng `12/2026` trả về `hasActivityInPeriod=false`, `0 phim`, `0 suất`, hiển thị banner Empty. |
| **TC19** | Admin xếp lịch phim mới thì thống kê tự cập nhật | `MongoMemoryReplSet` | **PASS** | Thêm suất chiếu phim thứ 3 -> thống kê tự tăng từ 2 phim lên 3 phim (`264 ghế`). |
| **TC20** | Khách đặt vé thành công thì thống kê tăng đúng | `MongoMemoryReplSet` | **PASS** | Đặt 2 ghế VIP + 1 combo -> Doanh thu `+390.000đ`, vé `+2`, ghế sắp chiếu còn trống `-2`. |
| **TC21** | Hủy vé hoàn tiền thì thống kê và ghế cập nhật đúng | `MongoMemoryReplSet` | **PASS** | Hủy đơn -> Doanh thu thuần về `0đ`, tiền hoàn `390.000đ`, ghế trống phục hồi `+2`. |
| **TC22** | Thêm chi phí thì lợi nhuận & phân bổ cập nhật đúng | `MongoMemoryReplSet` | **PASS** | Doanh thu `600k` - Chi phí (`200k` trực tiếp + `100k` vận hành) = Lãi `300k` (Biên LN `50%`, ROI `100%`), tổng phân bổ khớp đúng `100.000đ`. |
| **TC23** | Chuyển bộ lọc liên tục không bị dữ liệu cũ ghi đè | Playwright UI + LIVE | **PASS** | Chuyển nhanh `Tháng 12 -> Tháng 11` giữ đúng dữ liệu `Tháng 11/2026 (226 suất)`. |
| **TC24** | API lỗi không hiển thị số liệu giả | Playwright UI + LIVE | **PASS** | Khi giả lập HTTP 500, UI hiển thị khung `role="alert"` và nút `"Thử lại ngay"`. |
| **TC25** | Không ảnh hưởng đặt vé, thanh toán, chatbot, Admin khác | Regression Suite | **PASS** | 61/61 test Backend & 11/11 nhóm kịch bản Chatbot AI nâng cao đều PASS 100%. |

---

## 9. Kết Quả Regression Test & Frontend Build

| Hạng mục Kiểm thử | Lệnh Thực thi | Kết quả | Chi tiết |
| :--- | :--- | :-: | :--- |
| **25 Kịch bản Chấp nhận Thống kê LIVE** | `node verify_live_statistics_25cases.mjs` + `capture_live_statistics_tabs.mjs` | **PASS** | **25 PASS, 0 FAIL, 0 SKIP, 0 NOT RUN** |
| **Backend Integration & Concurrency Tests** | `npm --prefix backend test` | **PASS** | **61 PASS, 0 FAIL, 0 SKIP, 0 NOT RUN** (`12.72s`) |
| **Chatbot AI Advanced Spec (18 tiêu chuẩn)** | `node backend/scripts/testAdvancedChatbotSpec.js` | **PASS** | **11/11 nhóm kịch bản PASS (100%), 0 FAIL** |
| **Frontend Production Build** | `npm --prefix frontend run build` | **PASS** | **`✓ 2209 modules transformed`, `✓ built in 1.16s` (0 errors)** |

---

## 10. Ảnh Chụp Thực Tế Của Cả 3 Tab Thống Kê Sau Khi Sửa (`DB_MODE=LIVE`)

Ba ảnh chụp màn hình thực tế từ trình duyệt tại `http://localhost:5173/admin/statistics` trên dữ liệu `movietix_db` (`LIVE`):
1. **Tab 1 — Tổng hợp (`OverviewTab`):**
   - Đường dẫn: `C:\Users\LENOVO\.gemini\antigravity\brain\372e9cc7-702b-472f-bdb3-a22d2e638d87\live_overview_tab_nov2026.png`
2. **Tab 2 — Doanh thu & Chi phí (`RevenueTab`):**
   - Đường dẫn: `C:\Users\LENOVO\.gemini\antigravity\brain\372e9cc7-702b-472f-bdb3-a22d2e638d87\live_revenue_tab_nov2026.png`
3. **Tab 3 — Hiệu suất Phim & Suất chiếu (`MoviesTab`):**
   - Đường dẫn: `C:\Users\LENOVO\.gemini\antigravity\brain\372e9cc7-702b-472f-bdb3-a22d2e638d87\live_efficiency_tab_nov2026.png`

---

## 11. Trạng Thái `git status` Và `git diff --stat`

### `git status -s`
```text
 M backend/src/config/db.js
 M backend/src/controllers/expenseController.js
 M backend/src/controllers/statisticsController.js
 M backend/src/routes/statisticsRoutes.js
 M backend/src/services/statisticsService.js
 M backend/src/utils/statisticsUtils.js
 M frontend/src/pages/admin/statistics/StatisticsPage.jsx
 M frontend/src/pages/admin/statistics/components/StatisticsFilter.jsx
 M frontend/src/pages/admin/statistics/services/statisticsApi.js
 M frontend/src/pages/admin/statistics/tabs/OverviewTab.jsx
 M frontend/src/pages/admin/statistics/tabs/RevenueTab.jsx
?? STATISTICS_REAL_DATA_IMPLEMENTATION_REPORT.md
```

### `git diff --stat`
```text
 backend/src/config/db.js                           |   69 +-
 backend/src/controllers/expenseController.js       |  123 ++-
 backend/src/controllers/statisticsController.js    |   53 +-
 backend/src/routes/statisticsRoutes.js             |    3 +-
 backend/src/services/statisticsService.js          | 1113 +++++++++++++++-----
 backend/src/utils/statisticsUtils.js               |  205 +++-
 .../src/pages/admin/statistics/StatisticsPage.jsx  |  146 ++-
 .../statistics/components/StatisticsFilter.jsx     |  255 ++++-
 .../admin/statistics/services/statisticsApi.js     |    5 +-
 .../pages/admin/statistics/tabs/OverviewTab.jsx    |   50 +-
 .../src/pages/admin/statistics/tabs/RevenueTab.jsx |    2 +-
 11 files changed, 1545 insertions(+), 479 deletions(-)
```

---

## 12. Các Vấn Đề Còn Tồn Tại

- **Không còn bất kỳ lỗi hay xung đột nào tồn tại.**
- Dữ liệu trên cả hai cơ sở dữ liệu MongoDB Atlas (`movietix_db` và `movietix_demo_db`) được bảo toàn nguyên vẹn 100%.
- File `backend/.env` đã được chuyển sang `DB_MODE="LIVE"` ở môi trường local và nằm trong `.gitignore` (không bao giờ bị đưa vào Git).

---

## 13. Phương Án Rollback An Toàn

1. **Rollback chế độ Database (nếu muốn quay lại xem dữ liệu DEMO):**
   - Chỉ cần đổi `DB_MODE="LIVE"` thành `DB_MODE="DEMO"` trong `backend/.env` và khởi động lại Backend (`movietix_demo_db` vẫn được giữ nguyên 100%).
2. **Rollback Source Code trên Git (nếu cần hoàn tác các thay đổi code của đợt này về commit merge `c401ac7`):**
   ```bash
   git checkout -- backend/src/config/db.js backend/src/controllers/expenseController.js backend/src/controllers/statisticsController.js backend/src/routes/statisticsRoutes.js backend/src/services/statisticsService.js backend/src/utils/statisticsUtils.js frontend/src/pages/admin/statistics/
   ```
