# BÁO CÁO NGHIỆM THU CUỐI CÙNG — XOAY VÒNG THÔNG TIN XÁC THỰC & KIỂM ĐỊNH HỆ THỐNG (`SECURITY CREDENTIAL ROTATION & SYSTEM VALIDATION`)

- **Dự án:** D’AVENOR CINEMA
- **Nhánh làm việc:** `fix/mongodb-dns-root-cause` (tách từ `main` tại commit `001733e`)
- **Ngày thực hiện:** 26/11/2026
- **Trạng thái nghiệm thu tổng thể:** **`USER ACTION REQUIRED`** *(Đã hoàn tất tự động 100% xoay vòng `JWT_SECRET` 256-bit, chuẩn hóa `backend/.env` UTF-8 No BOM, loại bỏ toàn bộ mật khẩu/URI/khóa bí mật hard-code trong working tree, và kiểm thử hồi quy; đang dừng đúng tại bước xoay vòng mật khẩu trên **MongoDB Atlas Console** và **Google App Passwords** do yêu cầu người dùng đăng nhập và xác thực 2 bước trực tiếp trên trình duyệt).*

---

## 1. Trạng thái bảo mật trước và sau khi xử lý

| Hạng mục bảo mật | Trạng thái TRƯỚC khi xử lý | Trạng thái SAU khi xử lý trên nhánh `fix/mongodb-dns-root-cause` |
| :--- | :--- | :--- |
| **`JWT_SECRET` trong `backend/.env`** | Sử dụng chuỗi khóa tĩnh định danh theo dự án (`[REDACTED]`). | **ĐÃ XOAY VÒNG (`COMPLETED`)**: Đã sinh và cập nhật khóa ngẫu nhiên mật mã học **256-bit (64 ký tự hex)** bằng `crypto.randomBytes(32)`. Token cũ bị từ chối 100% (`HTTP 401`). |
| **Hard-code `JWT_SECRET` dự phòng trong mã nguồn** | Tồn tại fallback chuỗi khóa tĩnh trong `backend/src/services/ai/bookingLookupService.js` và `backend/scripts/testAll.js`. | **ĐÃ KHẮC PHỤC (`COMPLETED`)**: Đã gỡ bỏ hoàn toàn chuỗi fallback tĩnh, bắt buộc đọc từ `process.env.JWT_SECRET` và xác thực thuật toán `HS256`. |
| **Hard-code MongoDB URI & mật khẩu trong mã nguồn** | Tồn tại chuỗi fallback `mongodb+srv://[REDACTED]` trong 4 script: `seedDemoStatistics2026.js`, `inspect_expenses.js`, `test_overview_stats.js`, `updateMovieRatings.js`. | **ĐÃ KHẮC PHỤC (`COMPLETED`)**: Đã gỡ bỏ 100% URI/mật khẩu hard-code trong cả 4 script, bắt buộc đọc từ biến môi trường; bổ sung chốt chặn `[SAFETY ABORT]` chống ghi nhầm vào database LIVE. |
| **Hard-code Google DNS trong mã nguồn** | 6 script tiện ích gọi cứng `dns.setServers(['8.8.8.8', '1.1.1.1'])`. | **ĐÃ KHẮC PHỤC (`COMPLETED`)**: Đã chuyển sang sử dụng `configureOptionalDnsServers()` từ `backend/src/config/db.js`, mặc định dùng DNS hệ thống. |
| **Chuẩn hóa `backend/.env`** | Lỗi mã hóa ký tự tiếng Việt ở dòng 16; `DNS_SERVERS` đang bật cưỡng bức. | **ĐÃ CHUẨN HÓA (`COMPLETED`)**: Định dạng **UTF-8 No BOM**, không lỗi tiếng Việt, `# DNS_SERVERS=8.8.8.8,8.8.4.4` ở trạng thái comment dự phòng, được `.gitignore` bảo vệ hoàn toàn. |
| **MongoDB Atlas Database User Password** | Mật khẩu từng xuất hiện trong lịch sử commit `e5d971f` (`[REDACTED]`). | **`USER ACTION REQUIRED`**: Cần Quản trị viên đăng nhập trực tiếp vào `https://cloud.mongodb.com/` để đổi mật khẩu trên Atlas Console và cập nhật vào 3 biến URI trong `backend/.env`. |
| **Gmail App Password (`EMAIL_PASS`)** | Mật khẩu ứng dụng hiện tại trong `backend/.env` (`[REDACTED]`). | **`USER ACTION REQUIRED`**: Cần Quản trị viên đăng nhập và xác minh 2 bước (2FA/OTP) trực tiếp tại `https://myaccount.google.com/apppasswords` để tạo App Password mới, thu hồi mã cũ và cập nhật vào `backend/.env`. |

---

## 2. Kết quả thay mới MongoDB Atlas Database User Password (Phase 2)

- **Trạng thái:** **`USER ACTION REQUIRED` (Dừng chờ người dùng xác thực trên trình duyệt)**
- **Lý do kỹ thuật:**
  - Khi Agent khởi chạy Browser Subagent để kiểm tra phiên đăng nhập tại `https://cloud.mongodb.com/`, trình duyệt Chrome chưa mở cổng gỡ lỗi từ xa (`DevToolsActivePort` không tồn tại) và Agent không có phiên đăng nhập đã xác thực vào tài khoản MongoDB Atlas của người dùng.
  - Theo đúng quy định tại Mục 2 & Mục 13 (*"Nếu cần đăng nhập, xác minh OTP, CAPTCHA hoặc xác thực hai bước, hãy dừng tại bước đó để người dùng hỗ trợ trực tiếp. Không yêu cầu người dùng gửi mật khẩu hoặc mã OTP qua cuộc trò chuyện. Không giả lập việc thay mật khẩu thành công"*), Agent dừng đúng tại bước này để người dùng thực hiện đổi mật khẩu trực tiếp trên giao diện MongoDB Atlas Console.
- **Chuẩn bị sẵn sàng từ phía hệ thống:**
  - Toàn bộ vị trí đọc `MONGODB_LIVE_URI`, `MONGODB_DEMO_URI`, `MONGODB_URI` trong `backend/src/config/db.js` và các script đã được đồng bộ 100% để nhận mật khẩu mới từ `backend/.env` ngay khi người dùng cập nhật.

---

## 3. Kết quả thay mới Gmail App Password (Phase 3)

- **Trạng thái:** **`USER ACTION REQUIRED` (Dừng chờ người dùng xác minh 2 bước trên Google Account)**
- **Lý do kỹ thuật:**
  - Trang quản lý Mật khẩu ứng dụng của Google (`https://myaccount.google.com/apppasswords`) luôn bắt buộc người dùng nhập lại mật khẩu chính của tài khoản Google và hoàn tất Xác minh 2 bước (2-Step Verification / OTP trên thiết bị cá nhân).
  - Tuân thủ tuyệt đối nguyên tắc không yêu cầu mật khẩu/OTP qua chat và không can thiệp cơ chế xác thực của Google, bước tạo App Password mới và thu hồi App Password cũ cần được người dùng thao tác trực tiếp trên trang Google Account.
- **Cơ chế tự động nạp lại trong Backend:**
  - Hàm `generateAndSendEmailOtp` trong `backend/src/controllers/authController.js` (dòng 412) đã có cơ chế `dotenv.config({ path: BACKEND_ENV_PATH, override: true })`, tự động đọc giá trị `EMAIL_PASS` mới nhất từ `backend/.env` ở mỗi lần gửi OTP mà không cần sửa code.

---

## 4. Kết quả thay mới `JWT_SECRET` (Phase 4)

- **Trạng thái:** **`COMPLETED` (Đã hoàn thành 100%)**
- **Chi tiết thực hiện:**
  1. Sử dụng module gốc `node:crypto` (`crypto.randomBytes(32).toString('hex')`) để sinh khóa ngẫu nhiên **256-bit (64 ký tự hex)** đạt chuẩn mật mã học.
  2. Cập nhật trực tiếp vào dòng `JWT_SECRET="[REDACTED]"` trong tệp `backend/.env` theo chuẩn **UTF-8 No BOM**, hoàn toàn không in giá trị khóa cũ hoặc mới ra màn hình terminal hay log.
  3. Loại bỏ hoàn toàn chuỗi fallback khóa tĩnh cũ trong `backend/src/services/ai/bookingLookupService.js` và `backend/scripts/testAll.js`, đảm bảo không còn bất kỳ thành phần nào trong hệ thống chấp nhận token được ký bằng khóa cũ.
- **Lưu ý vận hành cho người dùng:**
  - Do `JWT_SECRET` đã được thay mới hoàn toàn, **tất cả các phiên đăng nhập (JWT token) cũ đang lưu trong `localStorage` của trình duyệt sẽ tự động hết hiệu lực (`HTTP 401`)**. Người dùng và Quản trị viên chỉ cần đăng nhập lại trên giao diện web để nhận token mới. Toàn bộ tài khoản người dùng và Admin trong cơ sở dữ liệu được giữ nguyên 100%.

---

## 5. Trạng thái thu hồi thông tin xác thực cũ

| Thông tin xác thực | Trạng thái thu hồi khóa/mật khẩu cũ | Minh chứng xác thực |
| :--- | :---: | :--- |
| **`JWT_SECRET` cũ** | **ĐÃ VÔ HIỆU HÓA 100% (`REVOKED`)** | Kiểm thử `SEC-JWT-04`: Token ký bằng khóa cũ gửi tới `/api/admin/statistics/overview` bị từ chối ngay lập tức với mã `HTTP 401 Unauthorized`. |
| **MongoDB Atlas Password cũ** | **CHỜ NGƯỜI DÙNG THU HỒI TRÊN ATLAS (`PENDING USER ACTION`)** | Đã xóa khỏi toàn bộ mã nguồn hiện tại; mật khẩu cũ trên Atlas sẽ chính thức hết hiệu lực ngay khi người dùng nhấn **Update User** trong mục **Database Access** trên MongoDB Atlas Console. |
| **Gmail App Password cũ** | **CHỜ NGƯỜI DÙNG THU HỒI TRÊN GOOGLE (`PENDING USER ACTION`)** | Sẽ hết hiệu lực ngay khi người dùng nhấn biểu tượng thùng rác (Revoke) bên cạnh App Password cũ tại `https://myaccount.google.com/apppasswords`. |
| **Mật khẩu cluster thử nghiệm cũ (`movietix.m3q8h`, `cluster0.p7qsl`)** | **ĐÃ GỠ KHỎI WORKING TREE (`REMOVED FROM CODE`)** | Đã xóa khỏi `inspect_expenses.js`, `test_overview_stats.js`, `updateMovieRatings.js`. Nếu các tài khoản trên cluster thử nghiệm cũ vẫn còn tồn tại trên tài khoản Atlas cá nhân, khuyến nghị người dùng xóa hoặc đổi mật khẩu trên Atlas. |

---

## 6. Kết quả kiểm tra MongoDB LIVE và DEMO (`SEC-DB-01` đến `SEC-DB-07`)

| Mã Test | Nội dung kiểm thử | Kết quả | Chi tiết nghiệm thu thực tế |
| :---: | :--- | :---: | :--- |
| **SEC-DB-01** | `LIVE` (`movietix_db`) kết nối bằng thông tin xác thực mới | **PENDING USER ROTATION** *(Hiện kết nối **PASS** trên cấu hình `.env` hiện tại)* | Sẽ chạy lệnh xác nhận chỉ đọc ngay sau khi người dùng cập nhật mật khẩu mới trên Atlas và trong `backend/.env`. |
| **SEC-DB-02** | `DEMO` (`movietix_demo_db`) kết nối bằng thông tin xác thực mới | **PENDING USER ROTATION** *(Hiện kết nối **PASS** trên cấu hình `.env` hiện tại)* | Sẽ chạy lệnh xác nhận chỉ đọc ngay sau khi người dùng cập nhật mật khẩu mới trên Atlas và trong `backend/.env`. |
| **SEC-DB-03** | Thông tin xác thực MongoDB cũ đã bị thu hồi | **PENDING USER ROTATION** | Cần người dùng đổi mật khẩu trên MongoDB Atlas Console để mật khẩu cũ trong commit `e5d971f` bị từ chối kết nối. |
| **SEC-DB-04** | Không fallback từ `LIVE` sang `DEMO` khi lỗi kết nối | **PASS** | Khi giả lập lỗi kết nối `LIVE`, `connectDB()` ghi log lỗi `[MongoDB - LIVE MODE]` và tuyệt đối không kết nối sang `movietix_demo_db`. |
| **SEC-DB-05** | Không kết nối nhầm database giữa `LIVE` và `DEMO` | **PASS** | `DB_MODE=LIVE` kết nối chính xác `movietix_db`; `DB_MODE=DEMO` kết nối chính xác `movietix_demo_db`; `seedDemoStatistics2026.js` có chốt chặn `[SAFETY ABORT]`. |
| **SEC-DB-06** | DNS mặc định vẫn hoạt động (không cần `DNS_SERVERS`) | **PASS** | `# DNS_SERVERS=8.8.8.8,8.8.4.4` đang đóng comment; `dns.getServers()` mặc định phân giải thành công 3 shards SRV, TXT và TLS `27017`. |
| **SEC-DB-07** | Không phát sinh ghi dữ liệu ngoài phạm vi cho phép | **PASS** | Toàn bộ kiểm thử có thao tác ghi đều chạy trên `MongoMemoryReplSet` cô lập; kiểm toán `startShowtimeLifecycleScheduler` và snapshot số lượng bản ghi trên cả `LIVE` và `DEMO` giữ nguyên 100%. |

---

## 7. Kết quả kiểm tra SMTP và OTP (`SEC-MAIL-01` đến `SEC-MAIL-05`)

| Mã Test | Nội dung kiểm thử | Kết quả | Chi tiết nghiệm thu thực tế |
| :---: | :--- | :---: | :--- |
| **SEC-MAIL-01** | SMTP xác thực thành công với App Password mới | **PENDING USER ROTATION** | Chờ người dùng tạo App Password 16 ký tự mới trên Google Account và cập nhật vào `EMAIL_PASS` trong `backend/.env`. |
| **SEC-MAIL-02** | App Password cũ đã bị thu hồi | **PENDING USER ROTATION** | Chờ người dùng nhấn xóa (Revoke) App Password cũ tại `https://myaccount.google.com/apppasswords`. |
| **SEC-MAIL-03** | Luồng OTP đăng ký hoạt động | **PASS (Isolated Test)** | Kiểm thử luồng tạo mã OTP 6 chữ số, lưu `OtpVerification` với TTL 5 phút và xác thực kích hoạt tài khoản hoạt động chính xác trên `MongoMemoryReplSet`. |
| **SEC-MAIL-04** | Luồng OTP quên mật khẩu hoạt động | **PASS (Isolated Test)** | Kiểm thử luồng tạo mã OTP khôi phục mật khẩu (`type: 'reset_password'`) và đặt lại mật khẩu hoạt động chính xác trên `MongoMemoryReplSet`. |
| **SEC-MAIL-05** | Không hiển thị App Password trong log | **PASS** | Kiểm toán mã nguồn `backend/src/controllers/authController.js`: biến `emailPass` và `cleanPass` chỉ được mã hóa Base64 gửi qua socket TLS `smtp.gmail.com:465`, không bao giờ được in ra `console.log`, `console.error` hay response JSON. |

---

## 8. Kết quả kiểm tra JWT và Phân quyền (`SEC-JWT-01` đến `SEC-JWT-06`)

Đã thực thi bộ kiểm thử tự động trên `MongoMemoryReplSet` cô lập với khóa `JWT_SECRET` 256-bit mới được xoay vòng trong `backend/.env`:

| Mã Test | Nội dung kiểm thử | Kết quả | Chi tiết nghiệm thu thực tế |
| :---: | :--- | :---: | :--- |
| **SEC-JWT-01** | Đăng nhập khách hàng thành công (`POST /api/auth/login`) | **PASS** | Trả về `HTTP 200 OK`, sinh JWT token mới hợp lệ cho tài khoản `CUSTOMER`. |
| **SEC-JWT-02** | Đăng nhập Admin thành công (`POST /api/admin/login`) | **PASS** | Trả về `HTTP 200 OK`, sinh JWT token mới hợp lệ cho tài khoản `ADMIN`. |
| **SEC-JWT-03** | Token mới hoạt động trên API được bảo vệ | **PASS** | Gọi `GET /api/admin/statistics/overview` với token Admin mới trả về `HTTP 200 OK`. |
| **SEC-JWT-04** | Token cũ (ký bằng khóa cũ trước khi xoay vòng) bị từ chối | **PASS** | Gọi `GET /api/admin/statistics/overview` với token ký bằng khóa cũ bị chặn ngay lập tức với `HTTP 401 Unauthorized`. |
| **SEC-JWT-05** | Khách hàng không truy cập được API Admin | **PASS** | Gọi `GET /api/admin/statistics/overview` bằng token `CUSTOMER` mới bị từ chối với `HTTP 403 Forbidden`. |
| **SEC-JWT-06** | Không lộ `JWT_SECRET` trong response, log hoặc chatbot | **PASS** | Kiểm tra response JSON, log server và bài test `TC09 [10.1]` của AI Chatbot đều chặn và che (`[REDACTED]`) mọi truy vấn liên quan tới `JWT_SECRET` và `.env`. |

*(Ghi chú về Refresh Token: Hệ thống xác thực hiện tại sử dụng Stateless JWT chuẩn `HS256` kèm kiểm tra sự tồn tại của tài khoản và `role` trực tiếp từ MongoDB trong `authMiddleware.js` ở mỗi request; không sử dụng bảng refresh token lưu khóa cũ nên việc đổi `JWT_SECRET` vô hiệu hóa 100% mọi phiên cũ ngay lập tức mà không để lại lỗ hổng).*

---

## 9. Kết quả kiểm thử hồi quy toàn hệ thống (Phase 7)

Toàn bộ kiểm thử có thao tác ghi dữ liệu đều được thực thi trên **`MongoMemoryReplSet` cô lập**, hoàn toàn không ghi lên MongoDB Atlas `LIVE` hoặc `DEMO`:

| Hạng mục kiểm thử | Lệnh thực thi | Kết quả | Chi tiết |
| :--- | :--- | :---: | :--- |
| **Backend Automated Test Suite (8 bộ test)** | `npm --prefix backend test` | **PASS (95/95)** | Toàn bộ **95/95** test cases đạt 100% (`fail 0`) trong `16.4s`:<br>- Tính năng lặp lịch chiếu (`recurring-showtimes.test.js`: 22/22 cases)<br>- Đặt vé, giữ ghế 600s TTL & chống giữ trùng (`seat-holding.test.js`: 30/30 cases)<br>- Thanh toán, hủy vé, hoàn tiền, đổi vé & xoay vòng QR (`booking-and-admin.test.js`, `phase06-acceptance.test.js`)<br>- Xóa hàng loạt & bảo vệ suất chiếu có vé (`bulk-delete-and-lifecycle.test.js`)<br>- Phân quyền Admin/Customer & Thống kê (`phase05-performance-sync.test.js`, `group02-qb09-fixes.test.js`, `group03-search-detail-review.test.js`) |
| **Advanced AI Chatbot Specification Tests** | `node backend/scripts/testAdvancedChatbotSpec.js` | **PASS (11/11)** | Đạt **11/11** nhóm kịch bản nâng cao (18 tiêu chuẩn nghiệp vụ, tiếng Việt/tiếng Anh và bảo mật chống lộ `.env`/API Key). |
| **Frontend Production Build** | `npm --prefix frontend run build` | **PASS** | Vite `v8.3.5` biên dịch thành công `2209 modules` vào `frontend/dist` trong `1.25s`, không có lỗi. |

---

## 10. Kết quả kiểm toán bảo mật toàn bộ Source Code & Bundle (Phase 6)

1. **Rà soát 4 tệp script từng chứa URI/mật khẩu fallback:**
   - [seedDemoStatistics2026.js](file:///d:/CDIO/movietix-project/backend/scripts/seedDemoStatistics2026.js): Đã gỡ bỏ hoàn toàn chuỗi fallback URI/mật khẩu; bắt buộc nạp `process.env.MONGODB_LIVE_URI || process.env.MONGODB_URI`; bổ sung chốt chặn `[SAFETY ABORT]` chống ghi nhầm vào `movietix_db`.
   - [inspect_expenses.js](file:///d:/CDIO/movietix-project/backend/scripts/inspect_expenses.js): Đã gỡ bỏ hoàn toàn chuỗi fallback `mongodb+srv://[REDACTED]@movietix.m3q8h.mongodb.net/...`; bắt buộc nạp từ `process.env.MONGO_URI || process.env.MONGODB_URI`.
   - [test_overview_stats.js](file:///d:/CDIO/movietix-project/backend/scripts/test_overview_stats.js): Đã gỡ bỏ hoàn toàn chuỗi fallback `mongodb+srv://[REDACTED]@movietix.m3q8h.mongodb.net/...`; bắt buộc nạp từ `process.env.MONGO_URI || process.env.MONGODB_URI`.
   - [updateMovieRatings.js](file:///d:/CDIO/movietix-project/backend/src/scripts/updateMovieRatings.js): Đã gỡ bỏ hoàn toàn chuỗi fallback `mongodb+srv://[REDACTED]@cluster0.p7qsl.mongodb.net/...`; bắt buộc nạp từ `process.env.MONGODB_URI`.
2. **Rà soát các tệp chứa `JWT_SECRET` fallback:**
   - [bookingLookupService.js](file:///d:/CDIO/movietix-project/backend/src/services/ai/bookingLookupService.js): Đã xóa chuỗi fallback khóa tĩnh ở dòng 9, chuyển sang đọc động `process.env.JWT_SECRET` và chỉ định rõ `{ algorithms: ['HS256'] }`.
   - [testAll.js](file:///d:/CDIO/movietix-project/backend/scripts/testAll.js): Đã xóa chuỗi fallback khóa tĩnh ở dòng 237, bắt buộc yêu cầu `process.env.JWT_SECRET`.
3. **Quét toàn bộ Working Tree, Test Fixtures, Backups và Frontend Production Bundle (`frontend/dist`):**
   - Quét `frontend/dist`: **0** kết quả chứa `mongodb+srv`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMAIL_PASS` hay mật khẩu database.
   - Quét `backend/backups`: Chỉ chứa dữ liệu JSON của các collection nghiệp vụ (`movies`, `showtimes`, `bookings`, `showtimeseats`) và tên host shard trong `backup_manifest.json`; **0** kết quả chứa mật khẩu, URI có thông tin đăng nhập, `JWT_SECRET` hay `EMAIL_PASS`.
   - Quét toàn bộ file được Git theo dõi (`git grep`): **0** kết quả chứa `mongodb+srv://` kèm thông tin xác thực thật (ngoại trừ dòng mẫu `mongodb+srv://<username>:<password>@cluster.mongodb.net/...` trong `backend/.env.example`).

---

## 11. Kết quả kiểm toán Lịch sử Git (Git History Audit)

| Commit Hash | Ngày commit | Tệp xuất hiện trong lịch sử | Phạm vi ảnh hưởng | Hướng xử lý chuẩn |
| :---: | :---: | :--- | :--- | :--- |
| *(Không có)* | *(Không có)* | `backend/.env` | Tệp `backend/.env` **chưa bao giờ** bị commit vào lịch sử Git. | Giữ nguyên quy tắc chặn `**/.env` và `*.env` trong `.gitignore`. |
| `e5d971f` *(merge qua `a88be1b`)* | `2026-11-26` | `backend/scripts/seedDemoStatistics2026.js` | Chứa chuỗi fallback URI kèm mật khẩu của Database User trên cluster Atlas hiện tại (`[REDACTED]`). | Đã xóa khỏi working tree trên nhánh `fix/mongodb-dns-root-cause`. **Bắt buộc đổi mật khẩu Database User trên MongoDB Atlas Console** để vô hiệu hóa hoàn toàn mật khẩu lưu trong commit `e5d971f`. |
| `62045f6` | `2026-11-25` | `backend/scripts/inspect_expenses.js`<br>`backend/scripts/test_overview_stats.js` | Chứa chuỗi fallback URI tới cluster thử nghiệm cũ (`movietix.m3q8h.mongodb.net`). | Đã xóa khỏi working tree. Nếu cluster cũ vẫn còn tồn tại trên tài khoản Atlas, người dùng nên xóa user hoặc tắt cluster đó. |
| `7f29487` | `2026-11-21` | `backend/src/scripts/updateMovieRatings.js` | Chứa chuỗi fallback URI tới cluster thử nghiệm cũ (`cluster0.p7qsl.mongodb.net`). | Đã xóa khỏi working tree. Nếu cluster cũ vẫn còn tồn tại, người dùng nên xóa user hoặc tắt cluster đó. |

- **Khuyến nghị về Git History:**
  - Tuân thủ quy tắc an toàn: **Không tự ý rewrite Git history (`git filter-repo` / `git filter-branch`) và không `git push --force`** để tránh làm hỏng lịch sử commit chung của nhóm đồ án CDIO.
  - Ngay sau khi Quản trị viên đổi mật khẩu Database User trên MongoDB Atlas Console, chuỗi mật khẩu cũ trong commit `e5d971f` sẽ trở thành vô giá trị hoàn toàn mà không cần viết lại lịch sử Git.

---

## 12. Danh sách File thay đổi trên nhánh `fix/mongodb-dns-root-cause`

Kết quả `git status` và `git diff --stat` (12 tệp mã nguồn được chỉnh sửa + 2 tệp báo cáo Markdown mới; `0` lỗi `git diff --check`):

1. [backend/scripts/capture_live_statistics_tabs.mjs](file:///d:/CDIO/movietix-project/backend/scripts/capture_live_statistics_tabs.mjs) *(Gỡ hard-code Google DNS, dùng `configureOptionalDnsServers()`)*
2. [backend/scripts/inspect_expenses.js](file:///d:/CDIO/movietix-project/backend/scripts/inspect_expenses.js) *(Gỡ hard-code MongoDB URI/mật khẩu fallback)*
3. [backend/scripts/seedDemoStatistics2026.js](file:///d:/CDIO/movietix-project/backend/scripts/seedDemoStatistics2026.js) *(Gỡ hard-code MongoDB URI/mật khẩu fallback, dùng `configureOptionalDnsServers()`, bổ sung chốt chặn `[SAFETY ABORT]` bảo vệ LIVE DB)*
4. [backend/scripts/testAll.js](file:///d:/CDIO/movietix-project/backend/scripts/testAll.js) *(Gỡ hard-code `JWT_SECRET` fallback)*
5. [backend/scripts/test_overview_stats.js](file:///d:/CDIO/movietix-project/backend/scripts/test_overview_stats.js) *(Gỡ hard-code MongoDB URI/mật khẩu fallback)*
6. [backend/scripts/verify_live_statistics_25cases.mjs](file:///d:/CDIO/movietix-project/backend/scripts/verify_live_statistics_25cases.mjs) *(Gỡ hard-code Google DNS, dùng `configureOptionalDnsServers()`)*
7. [backend/src/scripts/checkMoviesStatus.js](file:///d:/CDIO/movietix-project/backend/src/scripts/checkMoviesStatus.js) *(Gỡ hard-code Google DNS, dùng `configureOptionalDnsServers()`)*
8. [backend/src/scripts/distribute18MoviesByMonth.js](file:///d:/CDIO/movietix-project/backend/src/scripts/distribute18MoviesByMonth.js) *(Gỡ hard-code Google DNS, dùng `configureOptionalDnsServers()`)*
9. [backend/src/scripts/seedClean3RoomShowtimes.js](file:///d:/CDIO/movietix-project/backend/src/scripts/seedClean3RoomShowtimes.js) *(Gỡ hard-code Google DNS, dùng `configureOptionalDnsServers()`)*
10. [backend/src/scripts/updateMovieRatings.js](file:///d:/CDIO/movietix-project/backend/src/scripts/updateMovieRatings.js) *(Gỡ hard-code MongoDB URI/mật khẩu fallback)*
11. [backend/src/scripts/updateMoviesStatusTo3NowShowing.js](file:///d:/CDIO/movietix-project/backend/src/scripts/updateMoviesStatusTo3NowShowing.js) *(Gỡ hard-code Google DNS, dùng `configureOptionalDnsServers()`)*
12. [backend/src/services/ai/bookingLookupService.js](file:///d:/CDIO/movietix-project/backend/src/services/ai/bookingLookupService.js) *(Gỡ hard-code `JWT_SECRET` fallback, bắt buộc xác thực `HS256` bằng `process.env.JWT_SECRET`)*
13. [MONGODB_DNS_ROOT_CAUSE_REPORT.md](file:///d:/CDIO/movietix-project/MONGODB_DNS_ROOT_CAUSE_REPORT.md) *(Báo cáo kiểm toán DNS & Bảo mật đã làm sạch thông tin nhạy cảm)*
14. [SECURITY_CREDENTIAL_ROTATION_FINAL_REPORT.md](file:///d:/CDIO/movietix-project/SECURITY_CREDENTIAL_ROTATION_FINAL_REPORT.md) *(Báo cáo nghiệm thu xoay vòng thông tin xác thực này)*

*(Tệp cấu hình local `backend/.env` đã được cập nhật `JWT_SECRET` 256-bit mới và chuẩn hóa UTF-8 No BOM; `git check-ignore backend/.env` xác nhận tệp được `.gitignore` bảo vệ và `git ls-files backend/.env` rỗng).*

---

## 13. Các bước cần người dùng hỗ trợ trực tiếp (`USER ACTION REQUIRED`)

Để chuyển trạng thái từ `USER ACTION REQUIRED` sang `SECURITY CREDENTIAL ROTATION COMPLETED`, bạn chỉ cần thực hiện trực tiếp 2 thao tác xác thực trên trình duyệt (không gửi mật khẩu hay mã OTP vào khung chat):

### Bước A — Đổi mật khẩu Database User trên MongoDB Atlas Console
1. Mở trình duyệt và đăng nhập vào [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. Chọn Project của dự án -> vào mục **Security** -> **Database Access**.
3. Tìm Database User đang dùng trong `backend/.env` -> nhấn **Edit** -> nhấn **Edit Password**.
4. Chọn **Autogenerate Secure Password** (hoặc đặt mật khẩu mạnh mới chỉ gồm chữ cái và chữ số để không cần URL-encode; nếu có ký tự đặc biệt như `@`, `:`, `/`, `?`, `#`, `%` thì URL-encode trước khi ghép vào URI) -> nhấn **Update User** và chờ Atlas đồng bộ xong (khoảng 10–30 giây).
5. Mở tệp [backend/.env](file:///d:/CDIO/movietix-project/backend/.env) trên máy và thay mật khẩu mới vào đúng vị trí mật khẩu trong cả 3 dòng:
   - `MONGODB_LIVE_URI` (dòng 7)
   - `MONGODB_DEMO_URI` (dòng 9)
   - `MONGODB_URI` (dòng 11)

### Bước B — Tạo Gmail App Password mới và thu hồi mã cũ
1. Mở trình duyệt và truy cập [Google App Passwords](https://myaccount.google.com/apppasswords), đăng nhập bằng tài khoản Gmail gửi OTP (đang khai báo tại `EMAIL_USER` trong `backend/.env`) và hoàn tất Xác minh 2 bước.
2. Tạo một App Password mới đặt tên là `D'AVENOR CINEMA`.
3. Sao chép chuỗi 16 ký tự vừa sinh và cập nhật vào dòng `EMAIL_PASS="..."` (dòng 14) trong tệp [backend/.env](file:///d:/CDIO/movietix-project/backend/.env).
4. Trên trang Google App Passwords, nhấn biểu tượng **Thùng rác (Delete/Revoke)** bên cạnh App Password cũ để vô hiệu hóa hoàn toàn mã cũ.

### Bước C — Báo cho Agent để chạy kiểm định xác nhận cuối cùng
- Ngay sau khi bạn lưu tệp `backend/.env` với 2 mật khẩu mới trên, hãy nhắn cho tôi (ví dụ: *"Tôi đã cập nhật xong mật khẩu Atlas và Gmail App Password trong .env"*). Tôi sẽ lập tức chạy kiểm tra kết nối chỉ đọc `SEC-DB-01`, `SEC-DB-02`, `SEC-MAIL-01` và cập nhật trạng thái báo cáo thành `SECURITY CREDENTIAL ROTATION COMPLETED`.

---

## 14. Các rủi ro còn tồn tại

1. **Trước khi hoàn tất Bước A và Bước B ở Mục 13:**
   - Mật khẩu MongoDB cũ từng xuất hiện trong lịch sử commit `e5d971f` vẫn còn hiệu lực trên MongoDB Atlas cho đến khi bạn nhấn **Update User** trên Atlas Console.
2. **Khi chuyển sang mạng Wi-Fi khác chặn truy vấn DNS `SRV`:**
   - Nếu chuyển sang mạng Wi-Fi công cộng/trường học làm Node.js `dns.getServers()` rơi về `127.0.0.1`, bạn chỉ cần mở `backend/.env` và bỏ dấu `#` ở dòng `DNS_SERVERS=8.8.8.8,8.8.4.4`.

---

## 15. Phương án phục hồi nếu kết nối thất bại (Rollback & Recovery Plan)

1. **Nếu sau khi đổi mật khẩu MongoDB Atlas mà Backend báo lỗi `Authentication failed`:**
   - **Nguyên nhân thường gặp:** Mật khẩu mới chứa ký tự đặc biệt chưa được URL-encode (ví dụ `@`, `:`, `/`, `%`, `#`), hoặc chỉ mới cập nhật 1 trong 3 biến (`MONGODB_LIVE_URI`, `MONGODB_DEMO_URI`, `MONGODB_URI`), hoặc Atlas chưa đồng bộ xong (thường mất 10–30 giây sau khi nhấn *Update User*).
   - **Cách khắc phục tức thời:** Vào lại **MongoDB Atlas -> Database Access -> Edit User -> Edit Password**, tạo mật khẩu mới chỉ bao gồm chữ cái (`A-Z`, `a-z`) và chữ số (`0-9`) dài 24–32 ký tự, nhấn **Update User**, cập nhật đồng bộ vào cả 3 dòng `MONGODB_LIVE_URI`, `MONGODB_DEMO_URI`, `MONGODB_URI` trong `backend/.env`, chờ 15 giây rồi khởi động lại Backend.
2. **Nếu sau khi đổi `EMAIL_PASS` mà gửi OTP báo lỗi `SMTP Error (235 expected): 535-5.7.8 Username and Password not accepted`:**
   - **Nguyên nhân thường gặp:** Dán nhầm mật khẩu đăng nhập Gmail chính thay vì Mật khẩu ứng dụng 16 ký tự, hoặc thừa/thiếu ký tự khi sao chép.
   - **Cách khắc phục tức thời:** Tạo lại một Mật khẩu ứng dụng 16 ký tự mới tại `https://myaccount.google.com/apppasswords` và dán chính xác vào `EMAIL_PASS` trong `backend/.env` (hàm gửi mail tự động loại bỏ khoảng trắng giữa các cụm 4 ký tự).
3. **Nếu trình duyệt báo lỗi `401 Unauthorized` sau khi xoay vòng `JWT_SECRET`:**
   - Đăng xuất (Logout) trên giao diện Khách hàng / Admin rồi đăng nhập lại để trình duyệt nhận JWT token mới được ký bằng khóa 256-bit mới.
