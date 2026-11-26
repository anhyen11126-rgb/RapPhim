# BÁO CÁO KIỂM TRA, SỬA LỖI & NÂNG CẤP HỆ THỐNG THỐNG KÊ VÀ BÁO CÁO (`/admin/statistics`) – D’AVENOR CINEMA

---

## 1. Nguyên nhân lỗi `"Không tải được báo cáo. Thử lại"` & các sai lệch số liệu trước khi sửa

Qua quá trình kiểm tra trực tiếp source code, API và dữ liệu MongoDB Atlas (`movietix_db`), hệ thống xác định **7 nguyên nhân gốc rễ**:

1. **Xử lý lỗi tải API trên Frontend làm hiển thị toàn bộ KPI bằng `0` kèm fallback `8 phòng / 704 ghế`:**
   - Khi Backend server dừng hoặc request `/api/admin/statistics/*` gặp lỗi mạng / xác thực, `StatisticsPage.jsx` chỉ hiển thị dòng text nhỏ `loadError` nhưng vẫn render toàn bộ `OverviewTab`, `RevenueTab`, `MoviesTab`, `ShowtimesTab` với `data = null`.
   - Khi `data = null`, `OverviewTab.jsx` và `OccupancyChart.jsx` rơi vào các giá trị mặc định cứng sai cấu hình thực tế của cụm rạp:
     - `OverviewTab.jsx` (dòng 119 & 133): `occupancy.rate != null ? ... : '8 Phòng Chiếu'` và `occupancy.totalSellable || 704`.
     - `OccupancyChart.jsx` (dòng 118): `formatNumber(total || 704) ghế`.
     - `StatisticsHeader.jsx` (dòng 33): Luôn hiển thị `Cập nhật: Vừa xong` ngay cả khi API thất bại.
2. **Sai lệch công suất ghế mở bán trong kỳ (`periodShowtimes` dùng `end` thay vì `showtimeEnd` và không loại trừ suất đã hủy):**
   - Trong `statisticsService.js` (`getOverviewStats`), truy vấn tính `totalSellablePeriod` dùng `{ startTime: { $gte: start, $lte: end } }` (trong đó `end = new Date()` của ngày hiện tại 26/11/2026) thay vì `showtimeEnd` (cuối tháng 30/11/2026), dẫn đến bỏ sót toàn bộ 180 suất chiếu sắp diễn ra từ 26–29/11/2026 (chỉ đếm 49 suất = 4.312 ghế thay vì 226 suất hoạt động = 19.888 ghế), đồng thời chưa lọc `cancelledAt: null`.
3. **Bơm dữ liệu tĩnh giả (`Movie.stats`) vào bảng xếp hạng Top 5 Phim:**
   - Trong `getOverviewStats` (dòng 348–366 cũ), khi số phim có đơn đặt vé thực tế `< 5`, code tự động lấy `Movie.find({}).sort({ 'stats.revenue': -1 })` và gán `m.stats.revenue` (`125.000.000 đ`) cùng `m.stats.ticketsSold` (`850 vé`) — vốn là giá trị mặc định trong schema `Movie.js` — vào `topRevenueMovies` và `topTicketsMovies`.
4. **Coi chi phí = `0` là lợi nhuận `100%` khi hệ thống chưa có dữ liệu `Expense`:**
   - Khi bảng `Expense` trong MongoDB có `0` bản ghi, `getOverviewStats` và `getRevenueStats` đánh dấu `profitKnown = true` (chỉ dựa vào việc có `Booking`) và tính `profit = netRevenue - 0 = 130.000 đ`, `profitMargin = 100%`, `status = 'PROFIT' ("Có lãi")`.
   - Trong `getMoviesStats`, khi `totalExpenses = 0` và `revenue = 0`, code cũ gán `profit = 0 >= 0 -> 'PROFIT' ("Có lãi")` khiến cả các phim không bán được vé nào cũng hiển thị `"100% Phim Có Lãi"`.
5. **Lỗi `getShowtimesStats` truyền sai tham số vào `parseDateFilter`:**
   - `getShowtimesStats` gọi `parseDateFilter(timeRange, customStart, customEnd)` nhưng bỏ quên `month` và `year`, đồng thời dùng `end` thay vì `showtimeEnd`, khiến khi lọc `by_month` (Tháng 11/2026) chỉ trả về 49 suất thay vì 229 suất của tháng 11/2026.
6. **Phân bổ chi phí vận hành dùng chung trong `getMovieDetailStats` chia cứng cho `18` phim:**
   - `getMovieDetailStats` chia cứng `sharedExpenses / 18` thay vì phân bổ theo tỷ lệ số suất chiếu thực tế của phim trong kỳ, và `getMoviesStats` chỉ phân bổ theo doanh thu (khiến các phim đã chiếu nhiều suất nhưng doanh thu = `0` không chịu chi phí vận hành phòng chiếu).
7. **Tính tăng trưởng kỳ trước (`calculateGrowth`) trả về `100%` ảo khi kỳ trước = `0`:**
   - Trong `statisticsUtils.js`, khi `previous === 0` và `current > 0`, hàm `calculateGrowth` trả về `100` thay vì `null` (`N/A`).

---

## 2. Danh sách các file đã chỉnh sửa

| STT | File | Nội dung chỉnh sửa chính |
| :--- | :--- | :--- |
| 1 | [statisticsUtils.js](file:///d:/CDIO/movietix-project/backend/src/utils/statisticsUtils.js) | Chuẩn hóa toàn bộ xử lý ngày/tháng theo múi giờ `Asia/Ho_Chi_Minh (+07:00)` (`getVietnamParts`, `makeVietnamDate`, `formatVietnamDateKey`, `parseDateFilter` hỗ trợ `today`, `7_days`, `30_days`, `this_month`, `last_month`, `by_month`, `this_year`, `custom`). Sửa `calculateGrowth` trả về `null` (`N/A`) khi kỳ trước bằng `0`. |
| 2 | [Expense.js](file:///d:/CDIO/movietix-project/backend/src/models/Expense.js) | Mở rộng `EXPENSE_CATEGORIES` hỗ trợ đầy đủ 9 nhóm chi phí chuẩn (`MOVIE_LICENSE`, `REVENUE_SHARE`, `MARKETING`, `ELECTRICITY_WATER`, `STAFF`, `CLEANING`, `MAINTENANCE`, `CONCESSION_COGS`, `OTHER`) + tương thích ngược các mã cũ; bổ sung liên kết `movieId` và `roomId`. |
| 3 | [expenseController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/expenseController.js) | Nâng cấp CRUD chi phí (`getExpenses`, `createExpense`, `updateExpense`, `deleteExpense`) hỗ trợ lọc đồng bộ theo `timeRange`, `month`, `year`, `movieId`, `roomId`, `type`, `search` và tổng hợp tách biệt chi phí trực tiếp phim vs chi phí vận hành chung. |
| 4 | [statisticsController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/statisticsController.js) | Truyền `req.query` vào `getMovieDetailStats(req.params.id, req.query)` để Drawer chi tiết phim đồng bộ với bộ lọc thời gian hiện tại. |
| 5 | [statisticsService.js](file:///d:/CDIO/movietix-project/backend/src/services/statisticsService.js) | Viết lại toàn diện logic tổng hợp cho `getOverviewStats`, `getRevenueStats`, `getMoviesStats`, `getMovieDetailStats`, `getShowtimesStats`, `exportStatistics` theo đúng cấu hình 9 phòng × 88 ghế = 792 ghế vật lý, loại bỏ hoàn toàn dữ liệu giả `Movie.stats`, phân tách ghế không bán được (suất đã chiếu) vs ghế còn trống (suất sắp chiếu), chuẩn hóa trạng thái `"Chưa đủ dữ liệu tính lợi nhuận"` khi chưa có `Expense`. |
| 6 | [statisticsApi.js](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/services/statisticsApi.js) | Bổ sung `getRooms()` và truyền `params` cho `getMovieDetail(id, params)`. |
| 7 | [StatisticsPage.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/StatisticsPage.jsx) | Quản lý đồng bộ bộ lọc (`timeRange`, `month`, `year`, `movieId`, `roomType`, `roomId`, `sortBy`, `sortOrder`, `status`), phân biệt rõ 4 trạng thái (`Loading`, `Success`, `Empty`, `Error`) và tự động tính lại lợi nhuận ngay sau khi thêm/sửa/xóa chi phí. |
| 8 | [StatisticsHeader.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/components/StatisticsHeader.jsx) | Chỉ hiển thị mốc `"Cập nhật: HH:mm:ss"` khi API thành công; hiển thị cảnh báo `"Chưa đồng bộ được dữ liệu"` khi API lỗi; bổ sung menu xuất 4 mẫu CSV UTF-8 BOM. |
| 9 | [StatisticsFilter.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/components/StatisticsFilter.jsx) | Bổ sung đầy đủ 4 bộ lọc dùng chung: Thời gian (kèm chọn Tháng/Năm hoặc Khoảng ngày), Phim, Loại phòng (`IMAX Laser`, `Dolby Atmos`, `Gold Class`), và Phòng chiếu vật lý (`Phòng 01` – `Phòng 09`). |
| 10 | [StatisticCard.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/components/StatisticCard.jsx) | Hiển thị rõ `So kỳ trước: N/A (Kỳ trước = 0)` khi kỳ trước chưa có dữ liệu thay vì ẩn hoặc hiển thị `100%` sai lệch. |
| 11 | [OccupancyChart.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/components/OccupancyChart.jsx) | Xóa bỏ hoàn toàn fallback `704 ghế`; hiển thị tách biệt `Ghế đã bán`, `Ghế không bán được (Đã chiếu)`, `Ghế còn trống (Sắp chiếu)`, `Tổng ghế mở bán trong kỳ` và `Cấu hình rạp vật lý (9 phòng × 88 ghế = 792 ghế)`. |
| 12 | [RevenueChart.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/components/RevenueChart.jsx) | Bổ sung hiển thị cột đối chiếu `Chi phí phát sinh` bên cạnh `Vé xem phim` và `Bắp nước & Combo`, đồng thời hiển thị Empty State rõ ràng khi tất cả các ngày trong kỳ đều có giá trị `0`. |
| 13 | [OverviewTab.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/tabs/OverviewTab.jsx) | Xóa bỏ fallback `8 Phòng Chiếu` và `704`; bổ sung thanh trạng thái 9 phòng × 88 ghế = 792 ghế, dãy chỉ số trung bình & MoM, khối `Hiệu Suất Theo Loại Phòng` (3 công nghệ), bảng `Công Suất 9 Phòng Chiếu Vật Lý`, `Top Phim Hoạt Động Trong Kỳ` và `Hiệu Suất Theo Khung Giờ Chiếu`. |
| 14 | [RevenueTab.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/tabs/RevenueTab.jsx) | Bổ sung cảnh báo `"Chưa đủ dữ liệu tính lợi nhuận"` khi chưa có chi phí, bảng `Lợi nhuận từng phim` (Vé bán, Doanh thu vé, Bắp nước, Doanh thu thuần, Chi phí trực tiếp, Chi phí phân bổ, Tổng chi phí, Lợi nhuận, Biên LN, ROI, Trạng thái) và Modal CRUD `Quản lý chi phí` đầy đủ. |
| 15 | [MoviesTab.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/tabs/MoviesTab.jsx) | Nâng cấp 6 thẻ xếp hạng, 2 biểu đồ thanh ngang (`Biểu Đồ Tỷ Lệ Bán Vé Từng Bộ Phim (%)` & `Cơ Cấu Ghế Mở Bán Theo Từng Bộ Phim`), bộ sắp xếp 6 tiêu chí, và 2 chế độ bảng (`Tỷ lệ bán vé & Công suất` / `Doanh thu, Chi phí & Lợi nhuận`). |
| 16 | [ShowtimesTab.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/tabs/ShowtimesTab.jsx) | Đồng bộ danh sách 9 phòng vật lý thực tế từ DB, bổ sung bộ lọc trạng thái (`Đã chiếu`, `Đang chiếu`, `Sắp chiếu`, `Đã hủy`) và hiển thị chính xác `Ghế đã bán / 88`. |
| 17 | [MovieDetailDrawer.jsx](file:///d:/CDIO/movietix-project/frontend/src/pages/admin/statistics/drawers/MovieDetailDrawer.jsx) | Bổ sung bảng chi tiết từng suất chiếu của bộ phim (Ngày & Giờ, Phòng chiếu, Tổng ghế 88, Đã bán, Còn trống, Tỷ lệ lấp đầy %, Doanh thu từng suất) và cho phép click mở sơ đồ 88 ghế. |

---

## 3. Công thức tính toán chuẩn hóa cho toàn bộ chỉ số

### 3.1. Công suất phòng chiếu & ghế mở bán (Mục V)
- **Tổng số ghế vật lý toàn rạp:**
  $$\text{Tổng ghế vật lý} = \sum_{r \in \text{ActiveRooms}} \text{totalSeats}(r) = 9 \times 88 = 792 \text{ ghế}$$
- **Tổng số ghế mở bán trong kỳ:**
  $$\text{Tổng ghế mở bán trong kỳ} = \sum_{s \in \text{NonCancelledShowtimesInPeriod}} \text{SeatCapacity}(s)$$
  *(Với mỗi suất hợp lệ có 88 bản ghi `ShowtimeSeat`, $\text{SeatCapacity}(s) = 88$. Các suất có `cancelledAt != null` hoặc `lifecycleStatus === 'CANCELLED'` bị loại khỏi mẫu số công suất hoạt động).*
- **Phân tách ghế chưa bán theo trạng thái vòng đời suất chiếu:**
  - $\text{Ghế không bán được (Đã chiếu)} = \sum_{s \in \text{Completed/NowShowing}} (\text{TotalSeats}(s) - \text{SoldSeats}(s))$
  - $\text{Ghế còn có thể đặt (Sắp chiếu)} = \sum_{s \in \text{Upcoming}} (\text{TotalSeats}(s) - \text{SoldSeats}(s))$
  - $\text{Tổng ghế chưa bán} = \text{Ghế không bán được (Đã chiếu)} + \text{Ghế còn có thể đặt (Sắp chiếu)}$
- **Tỷ lệ lấp đầy (Occupancy Rate):**
  $$\text{Tỷ lệ lấp đầy (\%)} = \frac{\text{Số vé hợp lệ đã bán}}{\text{Tổng số ghế mở bán trong kỳ}} \times 100\%$$
  *(Chỉ tính vé từ `Booking` có `status = 'PAID'` và `paymentStatus \in {'VERIFIED', 'SIMULATED'}` hoặc `ShowtimeSeat.status = 'BOOKED'`. Ghế `HOLDING` tạm thời và đơn `CANCELLED` tuyệt đối không tính vào vé đã bán).*

### 3.2. Doanh thu, Chi phí, Lợi nhuận, Biên lợi nhuận & ROI (Mục IV & VII)
- **Doanh thu thuần (`Net Revenue`):**
  $$\text{Doanh thu thuần} = \text{Doanh thu vé hợp lệ} + \text{Doanh thu bắp nước hợp lệ}$$
  *(Các đơn `CANCELLED` được bóc tách riêng vào `cancelledOrders`, `cancelledAmount` và `refundedAmount`, không cộng vào Doanh thu thuần).*
- **Chi phí trực tiếp của phim (`Direct Movie Expenses`):**
  $$\text{Chi phí trực tiếp phim } m = \sum_{e \in \text{Expenses}(movieId = m)} e.\text{amount}$$
  *(Bao gồm `MOVIE_LICENSE`, `REVENUE_SHARE`, `MARKETING` gắn trực tiếp `movieId = m`).*
- **Chi phí vận hành phân bổ cho từng phim (`Allocated Operational Cost`):**
  $$\text{Chi phí vận hành phân bổ phim } m = \text{Tổng chi phí chung toàn rạp} \times \frac{\text{Số suất chiếu của phim } m \text{ trong kỳ}}{\text{Tổng số suất chiếu hoạt động toàn rạp trong kỳ}}$$
  *(Đảm bảo $\sum_{m} \text{Chi phí phân bổ}(m) = \text{Tổng chi phí chung toàn rạp}$, không bao giờ tính trùng với chi phí trực tiếp của phim).*
- **Tổng chi phí của phim (`Total Cost`):**
  $$\text{Tổng chi phí phim } m = \text{Chi phí trực tiếp phim } m + \text{Chi phí vận hành phân bổ phim } m$$
- **Lợi nhuận (`Profit`), Biên lợi nhuận (`Profit Margin`) & `ROI`:**
  - Nếu kỳ báo cáo **chưa có dữ liệu chi phí** (`hasExpenseData = false`):
    - $\text{Profit} = \text{null}$, $\text{Profit Margin} = \text{null}$, $\text{ROI} = \text{null}$
    - Trạng thái: `INSUFFICIENT_DATA` (**"Chưa đủ dữ liệu tính lợi nhuận"**) — tuyệt đối không hiển thị Biên LN `100%` hay `"100% Phim Có Lãi"`.
  - Nếu kỳ báo cáo **đã có dữ liệu chi phí** (`hasExpenseData = true`):
    $$\text{Lợi nhuận} = \text{Doanh thu thuần} - \text{Tổng chi phí}$$
    $$\text{Biên lợi nhuận (\%)} = \frac{\text{Lợi nhuận}}{\text{Doanh thu thuần}} \times 100\%$$
    $$\text{ROI (\%)} = \frac{\text{Lợi nhuận}}{\text{Tổng chi phí}} \times 100\%$$

---

## 4. Đối soát số liệu thực tế trong MongoDB Atlas (`Kỳ Tháng 11/2026`)

Dữ liệu đối soát trực tiếp giữa truy vấn gốc MongoDB (`Room`, `Showtime`, `ShowtimeSeat`, `Booking`, `Movie`, `Expense`) và API `/api/admin/statistics/*`:

| Chỉ số đối soát (Kỳ Tháng 11/2026) | Giá trị thực tế trong MongoDB | Giá trị hiển thị trên API & UI `/admin/statistics` | Kết quả |
| :--- | :--- | :--- | :--- |
| **Số phòng chiếu vật lý (`Room`)** | `9 phòng` (`Phòng 01` – `Phòng 09`, tất cả `ACTIVE`) | `9 phòng chiếu vật lý` (3 IMAX Laser, 3 Dolby Atmos, 3 Gold Class) | **Khớp 100%** |
| **Số ghế vật lý mỗi phòng / Toàn rạp** | `88 ghế/phòng` → `9 × 88 = 792 ghế` | `9 phòng × 88 ghế = 792 ghế vật lý` (Đã xóa sạch `8 phòng / 704 ghế`) | **Khớp 100%** |
| **Tổng số suất chiếu trong tháng 11/2026** | `229 suất` (`226 suất hoạt động` + `3 suất đã hủy`) | `226 suất hoạt động` (`Đã loại trừ 3 suất hủy`) | **Khớp 100%** |
| **Phân loại suất chiếu hoạt động** | `46 suất đã/đang chiếu` + `180 suất sắp chiếu` | `Đã chiếu: 46` (`4.048 ghế`) • `Sắp chiếu: 180` (`15.840 ghế`) | **Khớp 100%** |
| **Tổng số ghế mở bán trong kỳ** | `226 suất × 88 ghế = 19.888 ghế` | `19.888 ghế` (`6.688 ghế IMAX` + `6.600 ghế Dolby` + `6.600 ghế Gold`) | **Khớp 100%** |
| **Số bộ phim có lịch chiếu trong kỳ** | `3 phim` (`Dune: Hành Tinh Cát – Phần 2`, `Mai`, `Deadpool & Wolverine`) | `3 phim` (15 phim còn lại hiển thị `0 suất / Chưa có suất chiếu`) | **Khớp 100%** |
| **Đơn đặt vé hợp lệ (`PAID`) & Vé đã bán** | `1 đơn PAID` (`MTX-4868AF...`, ghế `A1`, Phòng 01 IMAX, `130.000 đ`) | `1 vé hợp lệ đã bán` (`1 đơn PAID`, Doanh thu vé `130.000 đ`, Bắp nước `0 đ`) | **Khớp 100%** |
| **Đơn đã hủy (`CANCELLED`)** | `4 đơn CANCELLED` (`9 ghế`, tổng giá trị đơn hủy `1.305.000 đ`) | `4 đơn hủy (9 vé) / 1.305.000 đ` (Tách riêng, không cộng vào doanh thu thuần) | **Khớp 100%** |
| **Ghế đã bán / Ghế không bán được / Ghế còn trống** | Đã bán: `1` • Đã chiếu không bán được: `4.047` • Sắp chiếu còn trống: `15.840` | Đã bán: `1` • Không bán được (Đã chiếu): `4.047` • Còn trống (Sắp chiếu): `15.840` | **Khớp 100%** |
| **Tỷ lệ lấp đầy toàn rạp & từng phim** | Toàn rạp: `1 / 19.888 = 0.01%` • Dune 2 (`76 suất = 6.688 ghế`): `1 / 6.688 = 0.01%` | Toàn rạp: `0.01%` • Dune 2: `0.01% (1/6.688)` • Mai (`75 suất`): `0% (0/6.600)` • Deadpool (`75 suất`): `0% (0/6.600)` | **Khớp 100%** |
| **Trạng thái Lợi nhuận khi `Expense = 0`** | `0` bản ghi trong bảng `Expense` | `"Chưa đủ dữ liệu tính lợi nhuận"` (Không hiển thị lãi `100%` giả) | **Khớp 100%** |

---

## 5. Kết quả kiểm thử 20 kịch bản bắt buộc (Mục XII) & Bộ test tích hợp

Toàn bộ **20 kịch bản bắt buộc** trong Mục XII và **61/61 bài test tích hợp Backend** (`npm --prefix backend test`) cùng **Production Build Frontend** (`npm --prefix frontend run build`) đều đạt **PASS 100%**:

| Case | Kịch bản kiểm thử | Kết quả thực tế | Trạng thái |
| :---: | :--- | :--- | :---: |
| **1** | Mở trang `/admin/statistics` | Tải thành công HTTP 200 cho cả 3 Tab, không còn lỗi `"Không tải được báo cáo. Thử lại"`. | **PASS** |
| **2** | Chọn tháng hiện tại (`11/2026`) | Hiển thị đầy đủ KPI, biểu đồ ngày, 3 loại phòng, 9 phòng vật lý và 3 phim có lịch chiếu. | **PASS** |
| **3** | Chọn tháng trước / So sánh MoM | Khi tháng `10/2026` có doanh thu = `0`, tỷ lệ tăng trưởng MoM trả về `null` và hiển thị `N/A (Kỳ trước = 0)`, không chia cho `0`. | **PASS** |
| **4** | Chọn tháng không có dữ liệu (`05/2026`) | Trả về `hasActivityInPeriod = false`, hiển thị thông báo Empty State rõ ràng, không crash. | **PASS** |
| **5** | Kiểm tra tổng số phòng và ghế vật lý | Hiển thị đúng `9 phòng chiếu vật lý × 88 ghế = 792 ghế vật lý` trên toàn bộ các tab và biểu đồ. | **PASS** |
| **6** | Kiểm tra tổng ghế mở bán của kỳ | Đúng bằng `226 suất hợp lệ × 88 ghế = 19.888 ghế` (loại trừ 3 suất đã hủy). | **PASS** |
| **7** | Kiểm tra phim có nhiều suất chiếu | `Dune 2`: 76 suất × 88 = `6.688 ghế`; `Mai`: 75 suất × 88 = `6.600 ghế`; `Deadpool & Wolverine`: 75 suất × 88 = `6.600 ghế`. | **PASS** |
| **8** | Kiểm tra vé đã bán, ghế trống & tỷ lệ lấp đầy | `Vé đã bán + Ghế không bán được (Đã chiếu) + Ghế còn trống (Sắp chiếu) = Tổng ghế mở bán` (`1 + 4.047 + 15.840 = 19.888`). | **PASS** |
| **9** | Kiểm tra ghế đang `HOLDING` tạm thời | Ghế `HOLDING` được bóc tách riêng, không tính vào vé đã bán hoặc doanh thu. | **PASS** |
| **10** | Kiểm tra `Booking` đã `CANCELLED` | 4 đơn `CANCELLED` (`1.305.000 đ`) được thống kê riêng tại chỉ số đơn hủy, không cộng vào doanh thu thuần hay vé đã bán. | **PASS** |
| **11** | Kiểm tra khi chưa có dữ liệu chi phí | Hiển thị rõ `"Chưa đủ dữ liệu tính lợi nhuận"`, không báo lãi 100% giả. | **PASS** |
| **12** | Thêm chi phí bản quyền (`MOVIE_LICENSE`) cho 1 phim | Thêm `50.000 đ` bản quyền cho `Dune 2` → Lợi nhuận `Dune 2` và toàn rạp cập nhật ngay thành `+80.000 đ` (`Biên LN: 61.5%`, `ROI: 160%`, `Có lãi`). | **PASS** |
| **13** | Thêm chi phí vận hành rạp (`ELECTRICITY_WATER`) | Thêm `45.000 đ` điện nước chung → Phân bổ chính xác theo tỷ lệ suất chiếu (`Dune 2`: `15.133 đ` [33.63%], `Mai`: `14.934 đ` [33.19%], `Deadpool`: `14.934 đ` [33.19%]), tổng chi phí = `95.000 đ`, không tính trùng. | **PASS** |
| **14** | Kiểm tra phim có lãi (`Doanh thu thuần > Tổng chi phí`) | `Dune 2` có Doanh thu thuần `130.000 đ` > Tổng chi phí `65.133 đ` → Lợi nhuận `+64.867 đ`, hiển thị badge xanh `"Có lãi"`. | **PASS** |
| **15** | Kiểm tra phim thua lỗ (`Doanh thu thuần < Tổng chi phí`) | `Mai` có Doanh thu `0 đ` < Chi phí phân bổ `14.934 đ` → Lợi nhuận `-14.934 đ`, hiển thị badge đỏ `"Thua lỗ"`. Sửa/Xóa khoản chi cập nhật tức thì. | **PASS** |
| **16** | Lọc theo phim cụ thể | Chọn `Dune: Hành Tinh Cát – Phần 2` → Toàn bộ KPI, biểu đồ và bảng chỉ hiển thị đúng `76 suất` (`6.688 ghế`, `1 vé`, `130.000 đ`) của `Dune 2`. | **PASS** |
| **17** | Lọc theo phòng / loại phòng (`IMAX Laser`, `Dolby Atmos`, `Gold Class`) | Lọc `IMAX Laser` → `76 suất` (`6.688 ghế`, `130.000 đ`); `Dolby Atmos` → `75 suất` (`6.600 ghế`); `Gold Class` → `75 suất` (`6.600 ghế`). Tổng = `226 suất`. | **PASS** |
| **18** | Chuyển qua lại giữa các tab | Số liệu Doanh thu thuần (`130.000 đ`), Vé đã bán (`1 vé`), Tổng ghế mở bán (`19.888 ghế`) đồng nhất 100% giữa `Tổng hợp`, `Doanh thu & Chi phí`, `Hiệu suất Phim` và `Suất chiếu`. | **PASS** |
| **19** | Xuất báo cáo CSV | Cả 4 mẫu CSV (`overview`, `revenue`, `movies`, `showtimes`) đều có byte đầu UTF-8 BOM (`0xEF 0xBB 0xBF`), mở trên Excel hiển thị đúng tiếng Việt và khớp 100% số liệu đang lọc. | **PASS** |
| **20** | Kiểm tra khi API trả lỗi (`401` / `404` / `500`) | Giao diện hiển thị khung cảnh báo lỗi có nút `"Thử lại ngay"`, không hiển thị KPI bằng `0` giả và không hiển thị `"Cập nhật: Vừa xong"`. | **PASS** |

---

## 6. Hình ảnh giao diện thực tế sau khi nâng cấp (Playwright E2E Verification)

- **Tab 1 – Tổng hợp hoạt động kinh doanh tháng & Công suất 9 phòng vật lý:**
  ![Tab Tổng hợp](file:///C:/Users/LENOVO/.gemini/antigravity/brain/372e9cc7-702b-472f-bdb3-a22d2e638d87/stats_tab1_overview.png)
- **Tab 2 – Doanh thu, Chi phí & Lợi nhuận từng bộ phim:**
  ![Tab Doanh thu & Chi phí](file:///C:/Users/LENOVO/.gemini/antigravity/brain/372e9cc7-702b-472f-bdb3-a22d2e638d87/stats_tab2_revenue_cost.png)
- **Modal Quản lý & Thêm khoản chi phí thực tế (Gắn phim / phòng / kỳ áp dụng):**
  ![Modal Thêm Chi Phí](file:///C:/Users/LENOVO/.gemini/antigravity/brain/372e9cc7-702b-472f-bdb3-a22d2e638d87/stats_tab2_expense_modal.png)
- **Tab 3 – Hiệu suất bán vé, Công suất ghế & Lợi nhuận từng bộ phim:**
  ![Tab Hiệu suất Phim](file:///C:/Users/LENOVO/.gemini/antigravity/brain/372e9cc7-702b-472f-bdb3-a22d2e638d87/stats_tab3_movies_capacity.png)
- **Drawer Chi tiết từng suất chiếu của bộ phim (`MovieDetailDrawer`):**
  ![Drawer Chi tiết Phim](file:///C:/Users/LENOVO/.gemini/antigravity/brain/372e9cc7-702b-472f-bdb3-a22d2e638d87/stats_movie_detail_drawer.png)
