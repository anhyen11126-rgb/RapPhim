# Báo cáo xác minh sau audit D’AVENOR CINEMA

Phạm vi đã sửa gồm mã ứng dụng, kiểm thử MongoDB cô lập và đối chiếu môi trường hiện tại ở chế độ chỉ đọc. Chưa triển khai và chưa chạy migration. Các đơn cũ vẫn được lưu. Phiên xác thực dùng `JWT_SECRET` đã cấu hình. Giao dịch đang dùng chế độ mô phỏng và được phân loại riêng.

## Kết quả chính

| Chức năng | Trước khi sửa | Thay đổi | Bằng chứng | Phần còn lại |
|---|---|---|---|---|
| Phân quyền và vé | Có route Admin và API vé thiếu xác thực hoặc kiểm tra chủ đơn | Tra tài khoản từ JWT và MongoDB. Chủ đơn lấy từ `Booking.userId` | Bài tích hợp token hết hạn, khách thường, Admin, tài khoản khác và đăng nhập thật | Chưa chạy toàn bộ ma trận bảo mật trên tất cả API |
| Thanh toán | Trình duyệt gửi tổng tiền và checkout ghi `PAID` | Backend định giá từ dữ liệu DB, lưu giá mua, ghi rõ `SIMULATED` và hỗ trợ gửi lại yêu cầu checkout | Định giá, voucher, combo, retry cùng khóa và kiểm tra doanh thu thực đã chạy | Chưa có cấu hình cổng, callback, đối soát hoặc hoàn tiền bằng tiền thật |
| Ghế, đổi/hủy và soát vé | Ghi nhiều bước, QR cũ có nguy cơ dùng lại | Transaction ghế và đơn. Hủy/đổi cập nhật đúng ghế, QR đổi theo đơn. QR soát cho toàn bộ ghế | Có bài tranh ghế, lỗi ghi đơn, đổi có giá chênh lệch, hủy lặp và soát đồng thời | Ghế thiếu sở hữu legacy vẫn cần đối chiếu |
| Lịch chiếu | Dùng tên phòng, mẫu ghế mặc định và lịch hàng loạt có thể ghi đè | Chọn Room ID, kiểm tra chồng lịch, dùng sơ đồ cùng phòng, khóa bán và giữ lịch sử | Kiểm thử tạo, chồng lịch đơn và batch, chặn đổi phòng, ngừng phim | Hủy suất có vé mới dừng ở khóa bán. Cần xác minh sơ đồ còn thiếu |
| Báo cáo và AI | Doanh thu lẫn dữ liệu cũ, công thức ghế mặc định, AI dùng 86 ghế giả | Tách nguồn thanh toán, dùng bản ghi ghế, gộp truy vấn trang suất và bỏ fallback 86 | Kiểm thử Website–Admin–DB, đối soát CSV, đo Overview | Chưa kiểm thử đầy đủ Chatbot, chưa chứng nhận đầy đủ công suất và chi phí của dữ liệu cũ |
| Admin | Bốn mục, nhiều màn có mã nhưng bị chuyển hướng | Năm nhóm, mở lại các màn hữu ích, drawer đơn, tab QR, bảng đơn phân trang, retry | Chrome smoke với API fixture cho Đơn đặt vé và Soát vé | Chưa hồi quy mọi tab, drawer và camera 3D |

## MongoDB và dry-run

| Phòng | Loại | Sức chứa | Số suất liên kết Room ID |
|---|---|---:|---:|
| 01 | IMAX Laser | 88 | 888 |
| 02 | IMAX Laser | 88 | 24 |
| 03 | IMAX Laser | 88 | 23 |
| 04 | Dolby Atmos | 88 | 0 |
| 05 | Dolby Atmos | 88 | 876 |
| 06 | Dolby Atmos | 88 | 0 |
| 07 | Gold Class | 88 | 0 |
| 08 | Gold Class | 88 | 0 |
| 09 | Gold Class | 88 | 876 |

Đây là số suất có khóa Room ID trực tiếp, không phải kết luận về lịch sử vận hành từng phòng.

- 2.691 suất, 91.344 bản ghi ghế, 29.064 Booking. Có 0 Booking liên kết User ID, 0 giao dịch xác minh và 0 giao dịch mô phỏng trong DB đọc lại. Toàn bộ 29.064 đơn legacy chưa đối soát và không có đủ chứng cứ để tự gán chủ sở hữu.
- 27.215 Booking tham chiếu suất chiếu không còn tồn tại. 10.479 ghế `BOOKED` không tìm được Booking. Có 0 khóa mã ghế trùng, 0 ghế `BOOKED` gắn đơn ở sai suất theo phép đối chiếu được chạy.
- 4 suất thiếu Room ID, 0 ứng viên duy nhất khớp chính xác theo tên phòng và cụm rạp. 264 ghế thiếu Room ID và không suy ra được qua suất. 1.655 suất chưa có bản ghi ghế. Có 0 suất với Room ID hiện hữu nhưng liên kết cụm rạp không khớp theo phép đối chiếu.
- Đọc trước và sau sửa source giữ nguyên tổng số phòng, suất, ghế và Booking. MongoDB xác nhận replica set hỗ trợ transaction. Chưa thêm index. Tận dụng index duy nhất hiện có trên Booking Code và cặp Showtime ID, Seat Number.
- Script `backend/scripts/auditAdminData.js` thực hiện kiểm tra chỉ đọc. Khi có dữ liệu chứng minh Room ID, chủ vé hoặc thanh toán, cần lập danh sách các bản ghi đề xuất thay đổi, sao lưu những collection liên quan, chạy dry-run lần nữa và xin duyệt. Rollback dữ liệu bằng bản lưu trước của đúng các bản ghi đã đổi. Rollback ứng dụng bằng phiên bản source trước thay đổi sau khi kiểm tra tương thích với đơn mới. Không đưa code cũ tự gán PAID trở lại quy trình thanh toán.

## Kiến trúc Admin

- **Tổng quan** gồm Tổng hợp, Doanh thu & Chi phí, Hiệu suất. Hiệu suất có hai chế độ Phim và Suất chiếu.
- **Phim & Lịch chiếu** gồm Danh sách phim, Lịch chiếu và Bảng giá. Giờ vệ sinh mặc định là **15 phút** cho suất mới.
- **Phòng & Ghế** mở danh sách phòng và thao tác bảo trì hiện có. Trang theo dõi ghế theo suất vẫn truy cập được bằng URL cũ. Phòng chưa có cấu hình ghế xác nhận sẽ báo thiếu cấu hình.
- **Vé & Khách hàng** gồm Đơn đặt vé, Soát vé QR và Khách hàng. Màn Đơn đặt vé có drawer và truy cập các trang combo, ưu đãi.
- **Trợ lý AI** gồm Cấu hình & FAQ, Kiểm thử phản hồi, Lịch sử & Thống kê.

## Kiểm thử và hiệu suất

19 bài Node đã chạy trên replica set tạm, 19 PASS, 0 FAIL. Chrome smoke dùng dữ liệu kiểm thử cô lập với các kích thước 1366×768 và 390×844. Build Vite thành công, cảnh báo chunk chính vượt 500 kB. Kiểm tra cú pháp Node cho 76 file source và test cùng script dry-run đã đạt.

Endpoint Overview được đo trên harness HTTP cục bộ với phân quyền Admin, cùng MongoDB chỉ đọc và bộ lọc tháng 11/2026. Ba lượt bản trước là **10.580, 9.540, 7.940 ms**. Ba lượt bản sau là **3.133, 2.762, 2.853 ms**. Cả sáu lượt trả 200. Trung vị giảm từ **9.540 ms** xuống **2.853 ms**. Bản sau lọc legacy ra khỏi các chỉ số vé hợp lệ, vì vậy số bản ghi được xử lý khác nhau giữa hai phiên bản. Phép đo này áp dụng cho bộ lọc và dữ liệu đã thử, chưa đại diện cho tải đồng thời hoặc phân vị production.

Ma trận 70 yêu cầu có **47 PASS, 0 FAIL, 3 BLOCKED, 20 NOT TESTED**. Mỗi bài tự động có thể bao phủ nhiều mục.

| STT | Ca nghiệm thu | Trạng thái | Bằng chứng hoặc giới hạn |
|---:|---|---|---|
| 1 | Khách đăng ký tài khoản mới | NOT TESTED | Chưa chạy đăng ký có OTP đầu cuối. |
| 2 | Đăng nhập và xác thực đúng User ID | PASS | Đăng nhập thật qua route Auth trên replica set cô lập và dùng token cho API. |
| 3 | Khách A không xem được vé khách B | PASS | GET mã vé và POST hủy đơn từ tài khoản khác trả 404. |
| 4 | Khách không truy cập được API Admin | PASS | API Admin thử ba trường hợp khách thường, thiếu token, token hết hạn. |
| 5 | Chỉnh sửa tổng tiền từ trình duyệt không làm sai giá | PASS | Payload gửi tổng bằng 1. Server ghi lại đúng giá DB, combo và voucher. |
| 6 | Click ghế không tạo Booking | PASS | Endpoint chọn ghế không tạo Booking. |
| 7 | Click ghế không giữ ghế | PASS | Ghế giữ nguyên AVAILABLE sau thao tác chọn. |
| 8 | Mua thành công một ghế | PASS | Checkout một ghế thành công và DB ghi BOOKED. |
| 9 | Mua nhiều ghế trong một đơn | PASS | Checkout A1, A2 tạo đúng một đơn. |
| 10 | Hai khách mua cùng một ghế đồng thời | PASS | Hai yêu cầu tranh A2 chỉ có một đơn thành công, không bán một phần. |
| 11 | Hai khách mua các ghế khác nhau | NOT TESTED | Chưa chạy song song hai yêu cầu đặt hai ghế khác nhau. |
| 12 | Thanh toán thất bại | BLOCKED | Checkout đang ở chế độ mô phỏng thành công, dự án chưa có cổng thanh toán hoặc sandbox để kiểm thử giao dịch ngân hàng thất bại. |
| 13 | Callback thanh toán lặp | BLOCKED | Chưa có callback nhà cung cấp. Đã kiểm chứng gửi lại yêu cầu checkout mô phỏng với cùng Idempotency-Key. |
| 14 | Thanh toán thành công nhưng bước tạo vé gặp lỗi | PASS | Cưỡng bức lỗi ghi Booking, toàn bộ ghế quay về AVAILABLE. |
| 15 | Vé xuất hiện trong Vé của tôi | PASS | Đơn vừa mua xuất hiện trong API Vé của tôi của đúng tài khoản. |
| 16 | Refresh không làm mất vé | NOT TESTED | Chưa kiểm tra refresh Vé của tôi bằng trình duyệt. |
| 17 | Đăng nhập thiết bị khác vẫn xem đúng vé | NOT TESTED | Chưa kiểm tra trên thiết bị hoặc phiên trình duyệt thứ hai. |
| 18 | Ghế đã bán không thể mua lại | PASS | Checkout cạnh tranh trả 409 và giữ đúng một đơn hợp lệ. |
| 19 | Ghế cùng mã ở suất khác không bị ảnh hưởng | PASS | Mã ghế ở suất thứ hai vẫn đặt được. |
| 20 | Ghế cùng mã ở phòng khác không bị ảnh hưởng | NOT TESTED | Chưa có bài thử tách biệt trên hai phòng vật lý. |
| 21 | Đặt vé đúng biên 7 ngày | NOT TESTED | Hàm lịch kiểm tra ngày thứ bảy. Chưa có ca HTTP đúng ngày biên. |
| 22 | Đặt vé vượt quá 7 ngày | PASS | API từ chối suất cách chín ngày. |
| 23 | Đặt vé sau khi suất bắt đầu | PASS | API từ chối suất trong quá khứ. |
| 24 | Hủy vé trước đúng 24 giờ | NOT TESTED | Chưa cố định đồng hồ để thử đúng 24:00:00. |
| 25 | Hủy vé khi còn dưới 24 giờ | PASS | API từ chối hủy vé trước suất 23 giờ. |
| 26 | Hủy vé giải phóng đúng ghế | PASS | Sau hủy, đúng ghế gắn với đơn chuyển về AVAILABLE. |
| 27 | Hủy vé lặp không hoàn tiền hai lần | PASS | Hủy lại bị từ chối. Trạng thái hoàn mô phỏng ghi một lần. |
| 28 | Đổi vé thành công | PASS | Đổi sang ghế còn trống thành công trong transaction. |
| 29 | Đổi vé thất bại vẫn giữ vé cũ | PASS | Đổi sang ghế bận giữ nguyên QR và ghế của đơn cũ. |
| 30 | Đổi vé có chênh lệch giá | PASS | Suất đích đắt hơn 20.000 đ, API trả đúng chênh lệch mô phỏng. |
| 31 | QR cũ sau đổi vé không hợp lệ | PASS | Token cũ trả 404 sau khi đổi. |
| 32 | QR của vé đã hủy không hợp lệ | PASS | Token của đơn đã hủy trả 404. |
| 33 | Check-in thành công | PASS | Admin quét thành công và phản hồi đủ ghế của đơn. |
| 34 | Quét QR lần thứ hai | PASS | Quét tiếp cùng token bị từ chối. |
| 35 | Hai Admin quét QR đồng thời | PASS | Hai lần quét đồng thời chỉ có một phản hồi thành công. |
| 36 | Tạo suất chiếu không trùng lịch | PASS | Admin tạo suất với roomId. Ba ghế mẫu hợp lệ được sao chép trong môi trường test. |
| 37 | Tạo suất chiếu bị chồng giờ | PASS | Suất chồng lịch trả 409. |
| 38 | Tạo suất hàng loạt bị trùng lịch | PASS | Batch chồng lịch trả 409 và không lưu một phần. |
| 39 | Không thể đổi phòng suất đã tạo | PASS | PUT thay đổi Room ID trả 400. |
| 40 | Hủy suất đã có khách mua vé | PASS | Đã thử suất có đơn mô phỏng. Suất bị hủy, giữ lịch sử, giải phóng ghế, vô hiệu hóa QR và ghi hoàn mô phỏng. Đơn cần đối soát được giữ để xử lý riêng. |
| 41 | Ngừng chiếu phim không mất lịch sử Booking | PASS | Ngừng phim khóa mở bán nhưng Booking, Showtime và ShowtimeSeat vẫn tồn tại. |
| 42 | Kiểm tra đủ 9 phòng vật lý | PASS | Dry-run MongoDB thực xác nhận chín phòng, ba phòng mỗi loại. |
| 43 | Kiểm tra dữ liệu Room ID legacy | PASS | Dry-run đối chiếu khóa Room ID, có bốn suất và 264 ghế thiếu dữ liệu. |
| 44 | Kiểm tra sơ đồ ghế từng phòng | BLOCKED | Chưa có sơ đồ ghế đủ căn cứ cho phòng 04, 06, 07 và 08. |
| 45 | Sơ đồ 2D và 3D cùng Seat ID | NOT TESTED | Chưa kiểm tra tương tác 2D/3D bằng trình duyệt. |
| 46 | Chọn ghế 3D không bị nhảy vị trí | NOT TESTED | Chưa kiểm tra chuyển động ghế ở 3D. |
| 47 | Camera ngôi thứ nhất đúng ghế | NOT TESTED | Chưa kiểm tra camera ở ghế thật. |
| 48 | Số ghế trên Website khớp Admin | PASS | Lịch Website và chi tiết suất Admin trả cùng kết quả hai ghế còn trống. |
| 49 | Số ghế trên Admin khớp MongoDB | PASS | Kết quả lấy từ ba bản ghi ghế sau giao dịch mua một ghế trong DB cô lập. |
| 50 | AI trả đúng số ghế còn trống | NOT TESTED | Chưa chạy kiểm thử AI số ghế với nhà cung cấp và FAQ thực. |
| 51 | AI không tự bịa dữ liệu khi thiếu | NOT TESTED | Đã bỏ fallback 86 ghế trong source. Chưa nghiệm thu đủ dạng câu hỏi. |
| 52 | Thống kê đúng số đơn và số vé | NOT TESTED | Đã kiểm tra số ghế và số đơn trên checkout. Chưa đối chiếu mọi báo cáo kỳ. |
| 53 | Thống kê đúng doanh thu theo nguồn thanh toán | PASS | Fixture gồm mô phỏng, đã xác minh và đã hủy. Chỉ doanh thu đủ điều kiện đi vào số thuần. |
| 54 | Hoàn tiền không bị trừ doanh thu hai lần | PASS | Khớp tổng thuần của đơn còn hiệu lực. Khoản hoàn của đơn hủy được ghi riêng. |
| 55 | Tỷ lệ lấp đầy đúng mẫu số | NOT TESTED | Chưa kiểm tra đầy đủ các mẫu số cho suất thiếu sơ đồ hoặc sai liên kết legacy. |
| 56 | Báo cáo CSV khớp giao diện | PASS | Đối chiếu tổng thuần trên API Revenue và CSV cùng bộ lọc. |
| 57 | Bộ lọc ngày, tuần, tháng, năm | NOT TESTED | Chưa chạy đủ mọi bộ lọc ngày, tuần, tháng, năm. |
| 58 | Kiểm tra qua 00:00 giờ Việt Nam | PASS | So sánh hai thời điểm ngay trước 00:00 qua biên Việt Nam. |
| 59 | Kiểm tra qua cuối tháng và cuối năm | PASS | Kiểm thử biên ngày qua 31/12 và 01/01. |
| 60 | Combo và ưu đãi tính đúng tổng tiền | PASS | Tổng đủ 2 vé, 2 combo và voucher 20.000 đ. |
| 61 | Đánh giá phim không giả mạo người dùng | PASS | API chọn danh tính từ token. Tài khoản chưa soát vé và xóa đánh giá người khác bị từ chối. |
| 62 | Dữ liệu review mẫu không ảnh hưởng điểm thật | PASS | Review fixture không có cờ xác minh bị loại khỏi điểm công bố. |
| 63 | Admin hiển thị đúng 5 mục chính | PASS | Chrome xác nhận đúng năm liên kết sidebar. |
| 64 | Các tab và drawer hoạt động đúng | NOT TESTED | Chrome đã mở drawer đơn và tab Soát vé. Chưa thử tất cả drawer và tab. |
| 65 | Không còn route chuyển hướng sai | NOT TESTED | Đã chạy route Đơn đặt vé và Soát vé. Chưa chạy toàn bộ URL cũ. |
| 66 | Loading, Empty State và Error State | NOT TESTED | Chrome đã thử lỗi 503 và nút Thử lại trên Đơn đặt vé. Chưa thử mọi trạng thái mọi trang. |
| 67 | Chuyển tab nhanh không ghi đè dữ liệu | NOT TESTED | Đã thêm AbortController. Chưa kiểm thử chuyển tab nhanh với phản hồi đảo thứ tự. |
| 68 | Kiểm tra responsive | PASS | Smoke test Đơn đặt vé ở 1366×768 và 390×844. Document mobile không cuộn ngang. |
| 69 | Kiểm tra build Frontend và Backend | PASS | Vite build thành công. Node kiểm tra cú pháp backend và nạp các route trong bài tích hợp. |
| 70 | Kiểm tra không làm hỏng chức năng cũ | NOT TESTED | Chưa chạy hồi quy toàn Website, đặc biệt 3D và các màn ngoài Admin. |

Ảnh kiểm thử giao diện với API cô lập. [Desktop](./admin-bookings-desktop.png) · [Mobile](./admin-bookings-mobile.png)

## Source

Thay đổi backend tập trung vào Booking, Movie, Room và Showtime. Các route sửa gồm Auth, Admin, Rooms, Bookings, Movies, Promotions, Cinemas và Statistics. Màn Admin tái sử dụng quản lý phim, lịch, bảng giá, phòng, khách, combo, ưu đãi và Chatbot. Thay đổi frontend khách nằm trong các luồng vé, lịch, đổi/hủy và đánh giá. AuthPage và authRoutes có thay đổi sẵn trong worktree từ trước.

### File chỉnh sửa
- `backend/src/controllers/adminController.js`
- `backend/src/controllers/authController.js`
- `backend/src/controllers/bookingController.js`
- `backend/src/controllers/movieController.js`
- `backend/src/controllers/promotionController.js`
- `backend/src/controllers/roomController.js`
- `backend/src/controllers/showtimeController.js`
- `backend/src/middleware/authMiddleware.js`
- `backend/src/models/Booking.js`
- `backend/src/models/Movie.js`
- `backend/src/models/Room.js`
- `backend/src/models/Showtime.js`
- `backend/src/routes/adminRoutes.js`
- `backend/src/routes/bookingRoutes.js`
- `backend/src/routes/cinemaRoutes.js`
- `backend/src/routes/movieRoutes.js`
- `backend/src/routes/promotionRoutes.js`
- `backend/src/routes/roomRoutes.js`
- `backend/src/routes/statisticsRoutes.js`
- `backend/src/services/ai/cinemaContextService.js`
- `backend/src/services/ai/geminiService.js`
- `backend/src/services/ai/responseBuilder.js`
- `backend/src/services/statisticsService.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/App.jsx`
- `frontend/src/components/admin/SidebarAdmin.jsx`
- `frontend/src/components/admin/TopbarAdmin.jsx`
- `frontend/src/components/checkout/CheckoutOrderSummary.jsx`
- `frontend/src/components/checkout/CheckoutPaymentMethods.jsx`
- `frontend/src/components/movie-detail/MovieOverviewHighlights.jsx`
- `frontend/src/components/movie-detail/MovieShowtimesSection.jsx`
- `frontend/src/components/movie-detail/MovieStatsReviewsSection.jsx`
- `frontend/src/pages/admin/BookingManagePage.jsx`
- `frontend/src/pages/admin/ChatbotManagePage.jsx`
- `frontend/src/pages/admin/MovieManagePage.jsx`
- `frontend/src/pages/admin/PricingManagePage.jsx`
- `frontend/src/pages/admin/ShowtimeManagePage.jsx`
- `frontend/src/pages/admin/UserManagePage.jsx`
- `frontend/src/pages/admin/statistics/StatisticsPage.jsx`
- `frontend/src/pages/admin/statistics/services/statisticsApi.js`
- `frontend/src/pages/admin/statistics/tabs/OverviewTab.jsx`
- `frontend/src/pages/admin/statistics/tabs/RevenueTab.jsx`
- `frontend/src/pages/admin/statistics/tabs/ShowtimesTab.jsx`
- `frontend/src/pages/client/BookingSuccessPage.jsx`
- `frontend/src/pages/client/CheckoutPage.jsx`
- `frontend/src/pages/client/MyTicketsPage.jsx`
- `frontend/src/pages/client/SeatSelectionPage.jsx`

### File mới

- `docs/admin-verification.md`
- `docs/admin-bookings-desktop.png`
- `docs/admin-bookings-mobile.png`
- `backend/scripts/auditAdminData.js`
- `backend/test/booking-and-admin.test.js`
- `backend/src/services/bookingPolicy.js`
- `backend/src/services/reviewSummary.js`
- `frontend/src/components/admin/AdminSectionTabs.jsx`
- `frontend/src/components/checkout/TicketQr.jsx`
- `frontend/src/components/checkout/TicketChanges.jsx`
- `frontend/src/pages/admin/CheckInManagePage.jsx`
