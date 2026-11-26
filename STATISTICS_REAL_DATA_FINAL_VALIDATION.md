# BÁO CÁO NGHIỆM THU & XÁC NHẬN CUỐI CÙNG — HỆ THỐNG THỐNG KÊ DỮ LIỆU LIVE (`STATISTICS_REAL_DATA_FINAL_VALIDATION`)

- **Dự án:** Hệ thống Quản lý & Đặt vé Rạp chiếu phim **D’AVENOR CINEMA** (`d:\CDIO\movietix-project`)
- **Nhánh Git hiện tại:** `integration-cdio-2611`
- **Cơ sở dữ liệu vận hành:** `DB_MODE=LIVE` (`movietix_db` trên MongoDB Atlas)
- **Mốc bắt đầu hoạt động & thống kê:** `CINEMA_OPERATION_START = 01/11/2026 00:00:00.000 (Asia/Ho_Chi_Minh, GMT+7)`
- **Ngày hoàn tất kiểm định:** `2026-11-26`

---

## 1. Kiểm Tra & Hoàn Thiện Logic Ghế Thực Sự Còn Đặt Được (`computeShowtimeSeatStats` & `upcomingAvailableSeats`)

### 1.1. Quy tắc 6 điều kiện bắt buộc cho ghế còn được phép đặt (`evaluateShowtimeBookability`)
Trong [backend/src/services/statisticsService.js](file:///d:/CDIO/movietix-project/backend/src/services/statisticsService.js#L168-L214), hàm `evaluateShowtimeBookability` và `computeShowtimeSeatStats` đã được chuẩn hóa đồng bộ 100% với quy tắc mở bán ghế trong [backend/src/controllers/bookingController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/bookingController.js#L133-L180):

1. **Chưa bắt đầu chiếu:** `lifecycle === 'UPCOMING'` và `new Date(showtime.startTime).getTime() > now.getTime()`.
2. **Chưa bị hủy:** `!showtime.cancelledAt && showtime.lifecycleStatus !== 'CANCELLED'`.
3. **Không bị Admin khóa:** `!showtime.isLocked` (`isLocked !== true`).
4. **Phòng chiếu đang hoạt động:** `room.status === 'ACTIVE'` (không thuộc phòng đang `MAINTENANCE`).
5. **Có bản ghi `ShowtimeSeat` hợp lệ:** `hasSeatRecords === true` (`agg.totalSeats > 0`). Tuyệt đối không dùng fallback 88 ghế để khẳng định một suất chưa khởi tạo `ShowtimeSeat` có 88 ghế khả dụng.
6. **Trạng thái ghế trên `ShowtimeSeat`:** Ghế không ở trạng thái `BOOKED` và không ở trạng thái `HOLDING` còn hạn (`holdExpiresAt > now`). Đồng thời phân tách rõ `immediateWindowBookableSeats` (ghế nằm trong cửa sổ mở bán 7 ngày của `opensMoreThanSevenDaysAhead` trong `bookingPolicy.js`) và `beyondWindowBookableSeats`.

### 1.2. Phân biệt rõ Ghế trống vật lý vs Ghế thực sự còn được phép đặt theo từng trạng thái suất chiếu

| Trạng thái Suất chiếu | Vòng đời / Cờ | `availableSeats` (Ghế trống vật lý) | `completedUnsoldSeats` (Trống suất đã/đang chiếu) | `lockedUpcomingUnsoldSeats` (Trống suất bị khóa) | `upcomingAvailableSeats` / `bookableAvailableCount` (Thực sự còn đặt được) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Suất sắp chiếu hợp lệ** | `UPCOMING`, `!isLocked`, `hasSeatRecords=true` | $88 - \text{booked} - \text{holding}$ | `0` | `0` | **$88 - \text{booked} - \text{holding}$** |
| **Suất sắp chiếu bị Admin khóa** | `UPCOMING`, `isLocked=true` | $88 - \text{booked} - \text{holding}$ | `0` | **$88 - \text{booked} - \text{holding}$** | **`0`** |
| **Suất sắp chiếu thiếu `ShowtimeSeat`** | `UPCOMING`, `hasSeatRecords=false` | $88 - \text{booked}$ | `0` | `0` | **`0`** (+ cảnh báo `missingSeatShowtimesCount`) |
| **Suất đang chiếu** | `NOW_SHOWING` (`startTime <= now < endTime`) | $88 - \text{booked} - \text{holding}$ | **$88 - \text{booked} - \text{holding}$** | `0` | **`0`** |
| **Suất đang dọn phòng** | `CLEANING` (`endTime <= now < cleaningEndTime`) | $88 - \text{booked} - \text{holding}$ | **$88 - \text{booked} - \text{holding}$** | `0` | **`0`** |
| **Suất đã kết thúc** | `COMPLETED` (`now >= cleaningEndTime`) | $88 - \text{booked} - \text{holding}$ | **$88 - \text{booked} - \text{holding}$** | `0` | **`0`** |
| **Suất đã hủy** | `CANCELLED` (`cancelledAt != null`) | `0` | `0` | `0` | **`0`** (loại khỏi `totalSellableSeats`) |

- **Kết quả kiểm thử tự động (`FV01` trong `verify_live_statistics_25cases.mjs`):** **PASS 100%** (`detailNowShowing.stats.bookableAvailableCount === 0`, `detailCleaning.stats.bookableAvailableCount === 0`, `detailLocked.stats.bookableAvailableCount === 0`, `detailNoSeats.stats.bookableAvailableCount === 0`).

---

## 2. Kiểm Tra Giao Dịch Khác Tháng & Hoàn Tiền Khác Tháng (Cross-Month Reconciliation)

### 2.1. Nguyên tắc hạch toán kép không trùng, không sót
Trong [backend/src/services/statisticsService.js](file:///d:/CDIO/movietix-project/backend/src/services/statisticsService.js#L883-L1065) và [backend/src/utils/statisticsUtils.js](file:///d:/CDIO/movietix-project/backend/src/utils/statisticsUtils.js#L225-L365):

1. **Báo cáo Doanh thu & Dòng tiền (`netRevenue`, `ticketRevenue`, `concessionRevenue`, `validTicketsSold`):**
   - Ghi nhận theo **thời điểm phát sinh giao dịch** (`Booking.createdAt \in [start, end]`).
   - Khi xem báo cáo theo tháng (`by_month`, `this_month`), biên `end` bao phủ trọn vẹn đến ngày cuối cùng của tháng (`23:59:59.999` của ngày `30/11` hoặc `31/12`), trong khi biên trục biểu đồ ngày (`chartEnd`) dừng ở ngày hiện tại nếu đang trong tháng hiện hành.
   - Các giao dịch hủy có hoàn tiền (`status: 'CANCELLED', refundStatus: 'REFUNDED'`) được đối soát theo cả thời điểm tạo đơn và thời điểm hoàn tiền (`updatedAt`), đảm bảo đơn mua tháng 11 nhưng hoàn tiền sang tháng 12 không bị thất thoát.
2. **Báo cáo Hiệu suất ghế & Công suất suất chiếu (`occupancy.booked`, `roomOccupancyBreakdown`, `showtimesStats`, `movie.showtimeBookedSeats`):**
   - Ghi nhận theo **thời điểm diễn ra suất chiếu** (`Showtime.startTime \in [start, showtimeEnd]`).
   - Truy vấn độc lập `showtimeBoundBookings` (`Booking.find({ showtimeId: { $in: activePeriodShowtimeIds }, status: 'PAID', paymentStatus: validPayments })`) kết hợp với `ShowtimeSeat.status === 'BOOKED'` của các suất chiếu trong kỳ.
3. **Sửa lỗi thất thoát giao dịch khác tháng trong `getMovieDetailStats` (Drawer chi tiết phim):**
   - Trước khi sửa: `getMovieDetailStats` lọc đồng thời `showtimeId \in periodShowtimes` **VÀ** `createdAt \in [periodStart, periodEnd]`, khiến đơn khách đặt ngày `29/11` cho suất chiếu `02/12` bị rơi khỏi cả báo cáo Tháng 11 lẫn báo cáo Tháng 12 của Drawer phim.
   - Sau khi sửa: Tách bạch `transactionBookings` (đơn của phim có `createdAt` trong kỳ -> tính doanh thu giao dịch trong kỳ) và `showtimeBoundBookings` (đơn gắn với các suất chiếu của phim có `startTime` trong kỳ -> tính số ghế đã đặt trên từng suất chiếu trong kỳ).

### 2.2. Kết quả kiểm thử kịch bản khách đặt vé ngày `29/11/2026` cho suất chiếu ngày `02/12/2026` (`FV02`)
- **Đơn hàng kiểm thử:** Khách đặt 2 ghế VIP (`F1, F2`), thanh toán `300.000 đ` (`VERIFIED`) vào ngày `29/11/2026 15:00` cho suất chiếu ngày `02/12/2026 19:30` (cùng với 1 đơn `600.000 đ` / 4 ghế của suất chiếu ngày `05/11/2026`).
- **Kết quả đối soát:**
  - **Kỳ Tháng 11/2026:**
    - Doanh thu thuần theo ngày giao dịch: $600.000 + 300.000 = \mathbf{900.000\text{ đ}}$ (`6 vé` giao dịch trong T11).
    - Số ghế đã đặt của các suất chiếu diễn ra trong T11: **`4 ghế`** (không cộng nhầm 2 ghế của suất tháng 12 vào mẫu số ghế tháng 11).
    - Đối soát `crossPeriodReconciliation`: `advanceTicketsBookedInPeriodForFutureShowtimes = 2`, `advanceRevenueBookedInPeriodForFutureShowtimes = 300000`.
  - **Kỳ Tháng 12/2026:**
    - Doanh thu thuần phát sinh mới trong T12: **`0 đ`** (không tính trùng `300.000 đ` đã ghi nhận ở T11).
    - Số ghế đã đặt của các suất chiếu diễn ra trong T12: **`2 ghế`** (`F1, F2` trên suất `02/12/2026`), `overallOccupancyRate = 0.76%` ($2 / 264$ ghế).
    - Đối soát `crossPeriodReconciliation`: `preBookedTicketsFromEarlierPeriodForPeriodShowtimes = 2`, `preBookedRevenueFromEarlierPeriodForPeriodShowtimes = 300000`.
  - **Kỳ Cả năm 2026 (`this_year`):**
    - Tổng doanh thu thuần cả năm: **`900.000 đ`** (không trùng, không mất).
    - Tổng số ghế đã đặt của các suất chiếu cả năm: $4 + 2 = \mathbf{6\text{ ghế}}$.

---

## 3. Kiểm Tra Quy Tắc 3 Phim/Tháng Theo Từng Tháng Dương Lịch (`schedulePolicyWarning`)

Trong [backend/src/services/statisticsService.js](file:///d:/CDIO/movietix-project/backend/src/services/statisticsService.js#L265-L364):
- Hàm `resolveActiveMoviesInPeriod` gom các suất chiếu hoạt động (`!st.cancelledAt && st.lifecycleStatus !== 'CANCELLED'`) theo từng tháng dương lịch tại Việt Nam (`YYYY-MM` từ `getVietnamParts(st.startTime)`).
- Trả về cấu trúc chi tiết `monthlyScheduledMoviesBreakdown`:
  ```json
  {
    "2026-11": {
      "month": 11,
      "year": 2026,
      "label": "Tháng 11/2026",
      "scheduledMoviesCount": 3,
      "exceedsLimit": false
    }
  }
  ```
- **Quy tắc cảnh báo:**
  - Chỉ bật `schedulePolicyWarning` khi **có ít nhất 1 tháng dương lịch đơn lẻ** có `scheduledMoviesCount > 3`.
  - Các bộ phim chỉ phát sinh giao dịch hoàn tiền hoặc chứng từ chi phí nhưng không xếp lịch chiếu trong tháng đó vẫn được hiển thị đầy đủ để đối soát tài chính nhưng **không** bị tính là vi phạm giới hạn 3 phim xếp lịch/tháng.
  - Khi xem báo cáo nhiều tháng hoặc cả năm (`this_year`): Tháng 11 có 3 phim + Tháng 12 có 3 phim khác = tổng cộng **6 bộ phim trong báo cáo năm** -> **`schedulePolicyWarning === null` (Hợp lệ 100%, đã kiểm chứng tại `FV03`)**.

---

## 4. Chuẩn Hóa Công Thức & Tên Gọi 3 Tỷ Lệ Bán Vé / Công Suất Lấp Đầy

Hệ thống đã tách bạch rõ 3 chỉ số với tử số, mẫu số và nhãn hiển thị riêng biệt trên cả API, UI (`OverviewTab`, `OccupancyChart`, `MoviesTab`, `MovieDetailDrawer`, `ShowtimeDetailDrawer`) và file xuất CSV:

| Mã trường API | Tên hiển thị trên UI & CSV | Công thức tính chính xác | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `overallOccupancyRate` (`rate`) | **Tỷ lệ bán vé toàn kỳ (%)** | $$\frac{\text{periodShowtimeBookedSeats}}{\text{totalSellableSeats}} \times 100$$ | Tỷ lệ ghế đã đặt trên tổng số ghế mở bán của tất cả các suất chiếu hoạt động trong kỳ. |
| `completedOccupancyRate` | **Tỷ lệ lấp đầy suất đã chiếu (%)** | $$\frac{\text{completedSoldSeats}}{\text{completedSellableSeats}} \times 100$$ | Hiệu suất lấp đầy thực tế của các suất đã chiếu / đang chiếu trong kỳ. |
| `upcomingOccupancyRate` | **Tỷ lệ đặt trước suất sắp chiếu (%)** | $$\frac{\text{upcomingSoldSeats}}{\text{upcomingSellableSeats}} \times 100$$ | Tỷ lệ vé khách đã đặt trước trên tổng ghế của các suất sắp chiếu trong kỳ. |

- **Kết quả kiểm thử tự động (`FV04`):** Với 1 suất đã chiếu bán 4/88 ghế và 2 suất sắp chiếu bán 0/176 ghế trong Tháng 11 -> `overallOccupancyRate = 1.52%` ($4/264$), `completedOccupancyRate = 4.55%` ($4/88$), `upcomingOccupancyRate = 0%` ($0/176$). Sang Tháng 12 với 3 suất sắp chiếu bán trước 2/264 ghế -> `overallOccupancyRate = 0.76%`, `completedOccupancyRate = 0%`, `upcomingOccupancyRate = 0.76%`.

---

## 5. Rà Soát Toàn Bộ Nguồn Dữ Liệu Tĩnh (`Movie.stats` & `Movie.analytics`)

Kết quả quét toàn bộ source code `backend/src` và `frontend/src` cho các trường tĩnh trong `Movie` schema:

| STT | File / Module | Trường liên quan | Trạng thái & Cách xử lý |
| :-: | :--- | :--- | :--- |
| 1 | [backend/src/models/Movie.js](file:///d:/CDIO/movietix-project/backend/src/models/Movie.js#L89-L182) | `stats`, `analytics`, `ratingBreakdown` | **Giữ nguyên schema & dữ liệu MongoDB** theo đúng yêu cầu không xóa schema hoặc dữ liệu DB. |
| 2 | [backend/src/controllers/movieController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/movieController.js#L19-L330) | `stats`, `analytics`, `rating`, `ratingCount`, `ratingBreakdown` | Khi trả dữ liệu cho client tại `getMovies` và `getMovieById`, controller luôn ghi đè `stats` từ `Booking` thực tế, ghi đè `rating/ratingCount/ratingBreakdown` từ `summarizeReviews(movie.reviews)` thực tế, và **đã bổ sung `analytics: null`** để không bao giờ lộ object `movie.analytics` tĩnh ra API. |
| 3 | [backend/src/services/statisticsService.js](file:///d:/CDIO/movietix-project/backend/src/services/statisticsService.js) | Không đọc `Movie.stats` hay `Movie.analytics` | **100% tính toán động** từ `Showtime`, `ShowtimeSeat`, `Booking`, `Expense` và `summarizeReviews(movie.reviews)`. |
| 4 | [backend/src/controllers/adminController.js](file:///d:/CDIO/movietix-project/backend/src/controllers/adminController.js#L2850-L2857) | `getMovieAnalytics` (`GET /api/admin/movie-analytics/:id`) | Gọi trực tiếp `statisticsService.getMovieDetailStats(req.params.id)` (dữ liệu thực 100%, không đọc `Movie.analytics`). |
| 5 | [frontend/src/components/movie-detail/MovieStatsReviewsSection.jsx](file:///d:/CDIO/movietix-project/frontend/src/components/movie-detail/MovieStatsReviewsSection.jsx#L89-L122) | `rating`, `ratingCount`, `ratingBreakdown` | Chỉ hiển thị kết quả từ `summarizeReviews` do `getMovieById` và API `/movies/:id/reviews` trả về; không đọc `movie.stats` hay `movie.analytics`. |
| 6 | `backend/src/scripts/seed8RoomsAndMovieAnalytics.js` & `updateMoviesDataAndAnalytics.js` | `m.analytics = ...` | Các script seed cũ; không được gọi bởi runtime server hay bất kỳ API nào. |

---

## 6. Tính Tái Lập Của Script Kiểm Thử & Ảnh Chụp Tài Liệu Dự Án

### 6.1. Script kiểm thử dùng đường dẫn tương đối trong kho mã nguồn
Hai script kiểm thử đã được lưu trực tiếp vào `backend/scripts/` sử dụng `fileURLToPath(import.meta.url)` và `path.resolve(__dirname, ...)` (không phụ thuộc đường dẫn tuyệt đối của máy cá nhân):
1. [backend/scripts/verify_live_statistics_25cases.mjs](file:///d:/CDIO/movietix-project/backend/scripts/verify_live_statistics_25cases.mjs) — Kiểm thử tự động 25 trường hợp chấp nhận + 4 trường hợp Final Validation (`FV01`–`FV04`).
   - Lệnh chạy từ thư mục gốc dự án:
     ```bash
     node backend/scripts/verify_live_statistics_25cases.mjs
     ```
2. [backend/scripts/capture_live_statistics_tabs.mjs](file:///d:/CDIO/movietix-project/backend/scripts/capture_live_statistics_tabs.mjs) — Kiểm thử giao diện tự động bằng Playwright (`TC02`, `TC06`, `TC23`, `TC24`) và chụp ảnh 3 tab thống kê LIVE.
   - Lệnh chạy từ thư mục gốc dự án:
     ```bash
     node backend/scripts/capture_live_statistics_tabs.mjs
     ```

### 6.2. Ảnh chụp màn hình thực tế trong thư mục tài liệu dự án (`docs/acceptance-screenshots/`)
Ba ảnh chụp toàn trang của 3 tab thống kê ở chế độ `DB_MODE=LIVE` (`movietix_db`) đã được lưu tại:
- [docs/acceptance-screenshots/live_overview_tab_nov2026.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/live_overview_tab_nov2026.png)
- [docs/acceptance-screenshots/live_revenue_tab_nov2026.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/live_revenue_tab_nov2026.png)
- [docs/acceptance-screenshots/live_efficiency_tab_nov2026.png](file:///d:/CDIO/movietix-project/docs/acceptance-screenshots/live_efficiency_tab_nov2026.png)

---

## 7. Tổng Hợp Kết Quả Chạy Test (`PASS` / `FAIL` / `SKIP` / `NOT RUN`)

| Bộ Kiểm Thử | Lệnh Thực Thi | Tổng Số Test | PASS | FAIL | SKIP | NOT RUN |
| :--- | :--- | :-: | :-: | :-: | :-: | :-: |
| **1. Acceptance & Final Validation (`TC01`–`TC22`, `FV01`–`FV04`)** | `node backend/scripts/verify_live_statistics_25cases.mjs` | **25** | **25** | `0` | `0` | `0` |
| **2. Playwright Live UI & E2E (`TC02`, `TC06`, `TC23`, `TC24` + 3 Screenshots)** | `node backend/scripts/capture_live_statistics_tabs.mjs` | **5** | **5** | `0` | `0` | `0` |
| **3. Backend Integration & Concurrency Suite (7 test files)** | `npm --prefix backend test` | **61** | **61** | `0` | `0` | `0` |
| **4. Chatbot AI Advanced Spec (18 tiêu chuẩn)** | `node backend/scripts/testAdvancedChatbotSpec.js` | **11** | **11** | `0` | `0` | `0` |
| **5. Frontend Production Build (Vite)** | `npm --prefix frontend run build` | **1** | **1** | `0` | `0` | `0` |
| **TỔNG CỘNG** | | **103** | **103** | **`0`** | **`0`** | **`0`** |

---

## 8. Danh Sách File Thay Đổi & Trạng Thái Git Hiện Tại

### `git status -s`
```text
 M backend/src/config/db.js
 M backend/src/controllers/expenseController.js
 M backend/src/controllers/movieController.js
 M backend/src/controllers/statisticsController.js
 M backend/src/routes/statisticsRoutes.js
 M backend/src/services/statisticsService.js
 M backend/src/utils/statisticsUtils.js
 M frontend/src/pages/admin/statistics/StatisticsPage.jsx
 M frontend/src/pages/admin/statistics/components/OccupancyChart.jsx
 M frontend/src/pages/admin/statistics/components/StatisticsFilter.jsx
 M frontend/src/pages/admin/statistics/drawers/MovieDetailDrawer.jsx
 M frontend/src/pages/admin/statistics/drawers/ShowtimeDetailDrawer.jsx
 M frontend/src/pages/admin/statistics/services/statisticsApi.js
 M frontend/src/pages/admin/statistics/tabs/MoviesTab.jsx
 M frontend/src/pages/admin/statistics/tabs/OverviewTab.jsx
 M frontend/src/pages/admin/statistics/tabs/RevenueTab.jsx
?? STATISTICS_REAL_DATA_IMPLEMENTATION_REPORT.md
?? STATISTICS_REAL_DATA_FINAL_VALIDATION.md
?? backend/scripts/capture_live_statistics_tabs.mjs
?? backend/scripts/verify_live_statistics_25cases.mjs
?? docs/acceptance-screenshots/live_efficiency_tab_nov2026.png
?? docs/acceptance-screenshots/live_overview_tab_nov2026.png
?? docs/acceptance-screenshots/live_revenue_tab_nov2026.png
```

### `git diff --stat`
```text
 backend/src/config/db.js                           |   69 +-
 backend/src/controllers/expenseController.js       |  123 +-
 backend/src/controllers/movieController.js         |    2 +
 backend/src/controllers/statisticsController.js    |   53 +-
 backend/src/routes/statisticsRoutes.js             |    3 +-
 backend/src/services/statisticsService.js          | 1736 ++++++++++++++++----
 backend/src/utils/statisticsUtils.js               |  217 ++-
 .../src/pages/admin/statistics/StatisticsPage.jsx  |  146 +-
 .../admin/statistics/components/OccupancyChart.jsx |   16 +-
 .../statistics/components/StatisticsFilter.jsx     |  255 ++-
 .../admin/statistics/drawers/MovieDetailDrawer.jsx |   14 +-
 .../statistics/drawers/ShowtimeDetailDrawer.jsx    |   11 +-
 .../admin/statistics/services/statisticsApi.js     |    5 +-
 .../src/pages/admin/statistics/tabs/MoviesTab.jsx  |    6 +-
 .../pages/admin/statistics/tabs/OverviewTab.jsx    |   54 +-
 .../src/pages/admin/statistics/tabs/RevenueTab.jsx |    2 +-
 16 files changed, 2162 insertions(+), 550 deletions(-)
```
