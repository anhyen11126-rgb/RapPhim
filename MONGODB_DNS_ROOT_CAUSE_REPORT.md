# BÁO CÁO KIỂM TOÁN NGUYÊN NHÂN GỐC RỄ & KHẮC PHỤC LỖI DNS MONGODB ATLAS (`querySrv ECONNREFUSED`)

- **Dự án:** D’AVENOR CINEMA
- **Nhánh làm việc:** `fix/mongodb-dns-root-cause` (tách từ `main` tại commit `001733e`)
- **Hệ điều hành:** Windows 11 (x64)
- **Môi trường Runtime:** Node.js `v24.14.1` | npm `11.11.0` | `c-ares 1.34.6` | `libuv 1.51.0`
- **Cơ sở dữ liệu:** MongoDB Atlas (`<ATLAS_CLUSTER_HOST>`)
  - Database LIVE: `movietix_db`
  - Database DEMO: `movietix_demo_db`
- **Ngày hoàn thành kiểm toán:** 26/11/2026
- **Trạng thái nghiệm thu:**
  - `DNS DEFAULT WORKING ON CURRENT NETWORK`
  - `ROOT CAUSE PARTIALLY VERIFIED` *(Đã xác minh cơ chế kỹ thuật và bằng chứng cấu hình; chưa tái kiểm tra trực tiếp trên mạng Wi-Fi từng gặp lỗi do mạng đó hiện không nằm trong vùng phủ sóng)*
  - `SECURITY CREDENTIAL ROTATION REQUIRED` *(Yêu cầu Quản trị viên xoay vòng mật khẩu Database User, Gmail App Password và JWT Secret theo hướng dẫn tại Mục 11)*

---

## 1. Tóm tắt kết quả xử lý (Executive Summary)

1. **Kết luận trung thực về trạng thái DNS và nguyên nhân gốc rễ:**
   - **`DNS DEFAULT WORKING ON CURRENT NETWORK`**: Trên môi trường mạng Wi-Fi hiện tại (cấp phát DNS qua DHCP), Node.js `v24.14.1` (`c-ares 1.34.6`) tự động nhận diện máy chủ DNS mặc định của hệ thống mà không cần biến môi trường `DNS_SERVERS` và không cần gọi `dns.setServers()`. Toàn bộ truy vấn `resolveSrv`, `resolveTxt`, `lookup` và kết nối `TLS 27017` tới cả 3 shard MongoDB Atlas đều thành công 100%.
   - **`ROOT CAUSE PARTIALLY VERIFIED`**:
     - Đã xác minh đầy đủ cơ chế kỹ thuật tại sao `nslookup`/`Resolve-DnsName` của Windows thành công trong khi Node.js `dns.resolveSrv()` từng trả về `127.0.0.1` và báo lỗi `querySrv ECONNREFUSED`: `dns.resolveSrv()` chạy qua thư viện `c-ares` (`1.34.6`) độc lập với dịch vụ `Dnscache` của Windows. Khi `c-ares` không đọc được máy chủ DNS unicast hợp lệ từ cấu hình adapter tại thời điểm khởi tạo (hoặc chỉ gặp các địa chỉ placeholder IPv6 site-local `fec0:0:0:ffff::1..3` / trạng thái chuyển tiếp profile Wi-Fi tĩnh), `c-ares` tự động rơi về (fallback) địa chỉ loopback `127.0.0.1`. Do Windows không chạy DNS daemon lắng nghe tại `127.0.0.1:53`, gói tin UDP/TCP tới `127.0.0.1:53` bị từ chối với lỗi `querySrv ECONNREFUSED`.
     - Tuy nhiên, vì hệ thống đã chuyển sang mạng Wi-Fi hiện tại từ trước phiên kiểm toán này và mạng Wi-Fi từng xảy ra lỗi hiện không nằm trong vùng phủ sóng (`NOT RUN` đối với bài kiểm thử tái kết nối mạng cũ), không kết luận `ROOT CAUSE RESOLVED` trên mọi môi trường mạng khi chưa tái kiểm tra trực tiếp trên mạng Wi-Fi từng gây lỗi.
2. **Chuẩn hóa cấu hình ứng dụng & mã nguồn:**
   - Giữ `DNS_SERVERS` ở trạng thái đóng comment (`# DNS_SERVERS=8.8.8.8,8.8.4.4`) trong `backend/.env` (đã sửa lỗi mã hóa tiếng Việt dòng 16 và chuẩn hóa UTF-8).
   - Giữ nguyên cơ chế cấu hình DNS tùy chọn `configureOptionalDnsServers()` trong `backend/src/config/db.js` làm phương án dự phòng an toàn khi mạng cục bộ chặn truy vấn SRV.
   - Đã gỡ bỏ các lệnh hard-code `dns.setServers(['8.8.8.8', '1.1.1.1'])` trong 6 script tiện ích và gỡ bỏ chuỗi fallback URI chứa thông tin xác thực hard-code trong `backend/scripts/seedDemoStatistics2026.js`, đồng thời bổ sung chốt chặn an toàn (`[SAFETY ABORT]`) không cho phép script seed DEMO ghi nhầm vào database LIVE.

---

## 2. Kết quả điều tra Windows Network & DNS (Phase 1 — Mục 4.1)

### 2.1. Danh sách Network Adapters & Giao diện mạng
Kết quả kiểm tra qua `Get-NetAdapter`, `Get-NetIPConfiguration` và `Get-DnsClientServerAddress` (đã ẩn danh thông tin định danh mạng nội bộ):

| Tên Adapter | Loại giao diện | Trạng thái | Default Gateway | Cấu hình DNS trên Adapter |
| :--- | :--- | :---: | :---: | :--- |
| **Wi-Fi** | Wireless LAN 802.11ax | **Up** (Active Internet) | Có (`<LAN_GATEWAY_IPV4>`) | IPv4: `<LAN_DNS_IPV4>` (DHCP)<br>IPv6: `<LAN_DNS_IPV6>` (DHCPv6/RA) |
| **VMware Network Adapter VMnet1** | Virtual Host-only Adapter | **Up** (Local VM) | Không có | IPv4: *(Trống)*<br>IPv6: `fec0:0:0:ffff::1..3` (Site-local placeholder) |
| **VMware Network Adapter VMnet8** | Virtual NAT Adapter | **Up** (Local VM) | Không có | IPv4: *(Trống)*<br>IPv6: `fec0:0:0:ffff::1..3` (Site-local placeholder) |
| **Ethernet** | Physical Ethernet Controller | Disconnected | Không có | IPv6: `fec0:0:0:ffff::1..3` |
| **Bluetooth Network Connection** | Bluetooth PAN | Disconnected | Không có | IPv6: `fec0:0:0:ffff::1..3` |

### 2.2. Kiểm tra dịch vụ DNS, NRPT, Hosts, Proxy/VPN và Cổng 53 nội bộ
- **Dịch vụ Windows DNS Client (`Get-Service Dnscache`):** Trạng thái `Running` (`StartType: Automatic`).
- **Chính sách NRPT (`Get-DnsClientNrptPolicy`):** Trống (không có quy tắc chuyển hướng DNS theo namespace).
- **Tệp `C:\Windows\System32\drivers\etc\hosts`:** Chỉ chứa bình luận mặc định của Windows, không có bất kỳ dòng cấu hình nào ghi đè `mongodb.net`, `localhost` hay `127.0.0.1`.
- **Kiểm tra cổng 53 trên localhost (`netstat -ano | Select-String ":53 "`):**
  - Không có bất kỳ tiến trình nào lắng nghe trên `127.0.0.1:53` hoặc `[::1]:53` (không có local DNS proxy hay dịch vụ VPN chiếm quyền cổng 53).
- **Kiểm tra Registry `HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters`:**
  - `NameServer` toàn cục: `""` (trống).
  - Giao diện Wi-Fi đang kết nối nhận `DhcpNameServer` hợp lệ từ router DHCP.
  - Nhật ký `Microsoft-Windows-NetworkProfile/Operational` xác nhận máy đã chuyển từ profile mạng Wi-Fi trước đó sang profile mạng Wi-Fi hiện tại. Hiện tại mạng Wi-Fi từng gặp lỗi không khả dụng trong phạm vi kết nối để tái kiểm tra trực tiếp.

---

## 3. Kết quả điều tra Node.js và `c-ares` (Phase 1 — Mục 4.2)

- **Đường dẫn thực thi (`where.exe node`):** `C:\Program Files\nodejs\node.exe` (1 bản cài đặt Node.js duy nhất trên hệ thống).
- **Thông số `process.versions`:**
  - `node`: `24.14.1`
  - `v8`: `13.6.233.17-node.40`
  - **`ares` (`c-ares`)**: `1.34.6`
  - `uv` (`libuv`): `1.51.0`
  - `openssl`: `3.5.5`
- **Biến môi trường toàn cục:** `NODE_OPTIONS` không được thiết lập; không có biến `DNS_SERVERS` ở cấp User hay System Environment Variables của Windows.
- **Kết quả gọi `dns.getServers()` mặc định trong Node.js (không gọi `dns.setServers()`):**
  - Trả về danh sách máy chủ DNS IPv4/IPv6 của router mạng hiện tại (`["<LAN_DNS_IPV4>", "<LAN_DNS_IPV6>"]`), **không** trả về `127.0.0.1`.

---

## 4. Phân tích kỹ thuật: Vì sao Node.js từng nhận `127.0.0.1` và báo lỗi `querySrv ECONNREFUSED`

```
+-----------------------------------------------------------------------------------+
|                        KIẾN TRÚC PHÂN GIẢI DNS TRÊN WINDOWS                       |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Nhánh 1: Windows OS Resolver]                                                   |
|  nslookup / Resolve-DnsName / Node.js dns.lookup()                                |
|       │                                                                           |
|       ▼                                                                           |
|  Windows API GetAddrInfoW() ──(RPC nội bộ)──► Dịch vụ Windows Dnscache            |
|       │                                       (Đọc đúng DNS theo Wi-Fi Profile)   |
|       └──► THÀNH CÔNG                                                             |
|                                                                                   |
|  ───────────────────────────────────────────────────────────────────────────────  |
|                                                                                   |
|  [Nhánh 2: Thư viện c-ares 1.34.6 trong Node.js]                                  |
|  mongodb+srv:// ──► dns.resolveSrv() & dns.resolveTxt()                           |
|       │                                                                           |
|       ▼                                                                           |
|  c-ares get_iphlpapi_dns_info() gọi GetAdaptersAddresses() khi khởi tạo           |
|       │                                                                           |
|       ├──► Khi không lấy được DNS unicast hợp lệ từ adapter (hoặc chỉ còn         |
|       │    fec0:0:0:ffff::1..3 / trạng thái cấu hình profile Wi-Fi tĩnh):         |
|       │    c-ares tự động gán fallback = 127.0.0.1                                |
|       │                                                                           |
|       └──► Gửi gói UDP/TCP trực tiếp tới 127.0.0.1:53                             |
|            (Windows KHÔNG chạy DNS daemon tại 127.0.0.1:53)                       |
|            ──► Kernel Windows trả về lỗi: querySrv ECONNREFUSED                   |
+-----------------------------------------------------------------------------------+
```

1. **Sự khác biệt giữa `mongodb+srv://` và truy vấn tên miền thông thường:**
   - Khi kết nối bằng chuỗi `mongodb+srv://<ATLAS_CLUSTER_HOST>/...`, MongoDB Node.js Driver bắt buộc phải gọi `dns.resolveSrv('_mongodb._tcp.<ATLAS_CLUSTER_HOST>')` và `dns.resolveTxt('<ATLAS_CLUSTER_HOST>')`.
   - Trong Node.js, toàn bộ nhóm hàm `dns.resolve*()` (`resolveSrv`, `resolveTxt`, `resolve4`, `resolve6`) được thực thi bởi thư viện C **`c-ares` (`1.34.6`)**, hoàn toàn bỏ qua dịch vụ `Dnscache` của Windows.
2. **Cơ chế Fallback về `127.0.0.1` của `c-ares`:**
   - Trong mã nguồn khởi tạo của `c-ares` trên Windows (`ares_init.c`), `c-ares` truy vấn danh sách máy chủ DNS từ cấu trúc adapter qua `GetAdaptersAddresses()`. Nếu tại thời điểm khởi tạo, danh sách máy chủ DNS unicast đọc được bị rỗng hoặc bị bộ lọc loại bỏ (ví dụ chỉ thấy các địa chỉ site-local IPv6 `fec0:0:0:ffff::1..3` trên các card mạng ảo hoặc khi cấu hình DNS theo từng profile Wi-Fi trên Windows chưa xuất hiện trong trường `NameServer` của giao diện), `c-ares` sẽ tự động nạp `127.0.0.1` làm máy chủ DNS dự phòng cuối cùng.
   - Trên Windows, dịch vụ `Dnscache` hoạt động qua RPC và **không mở cổng `127.0.0.1:53`**. Do đó, mọi gói tin truy vấn `resolveSrv` gửi vào `127.0.0.1:53` đều bị từ chối tức thì với lỗi `querySrv ECONNREFUSED`.
3. **Phạm vi xác minh hiện tại (`ROOT CAUSE PARTIALLY VERIFIED`):**
   - Cơ chế kỹ thuật trên giải thích khớp 100% hiện tượng `dns.getServers()` trả về `['127.0.0.1']` trong khi `Resolve-DnsName` của Windows vẫn phân giải được SRV.
   - Do mạng Wi-Fi từng xảy ra lỗi hiện không khả dụng tại vị trí kiểm thử, việc tái kiểm tra trực tiếp trên mạng Wi-Fi cũ được ghi nhận là `NOT RUN`.

---

## 5. Kết quả kiểm tra kết nối MongoDB Atlas bằng DNS mặc định (Phase 1 — Mục 4.3)

Với DNS mặc định của hệ thống trên mạng hiện tại và **không** cấu hình `DNS_SERVERS`:

1. **Truy vấn bản ghi `SRV` (`_mongodb._tcp.<ATLAS_CLUSTER_HOST>`):**
   - Phân giải thành công 3 bản ghi SRV tương ứng với 3 shard hosts ở cổng `27017` (`priority: 0`, `weight: 0`).
2. **Truy vấn bản ghi `TXT` (`<ATLAS_CLUSTER_HOST>`):**
   - Phân giải thành công tham số replicaSet và `authSource=admin`.
3. **Phân giải IP (`dns.promises.lookup`) và bắt tay `TLS 27017` tới từng Shard Host:**
   - Cả 3 shard hosts đều phân giải thành công địa chỉ IPv4 công cộng và hoàn tất bắt tay `TLSv1.3` ở cổng `27017` (`authorized: true`).

---

## 6. Những thay đổi đã thực hiện và Kiểm toán 7 Script tiện ích (Phases 2, 3 & Final Validation)

### 6.1. Cấp hệ điều hành Windows (OS-Level)
- **Không thực hiện bất kỳ thay đổi nào ở cấp hệ điều hành Windows** (không sửa Registry, Network Adapter, Firewall hay Windows Services).

### 6.2. Chuẩn hóa tệp `backend/.env` và giữ cơ chế DNS tùy chọn trong `backend/src/config/db.js`
1. **`backend/.env` (Local, được `.gitignore` bảo vệ):**
   - Đã sửa lỗi mã hóa tiếng Việt ở dòng 16, lưu chuẩn **UTF-8 (No BOM)**.
   - Đã đóng comment dòng 17 (`# DNS_SERVERS=8.8.8.8,8.8.4.4`) để Backend mặc định dùng DNS của hệ điều hành.
2. **`backend/src/config/db.js`:**
   - Giữ nguyên hàm `configureOptionalDnsServers()`. Khi `DNS_SERVERS` bị comment hoặc để trống, hàm trả về `{ configured: false, servers: dns.getServers() }` và **không** gọi `dns.setServers()`.

### 6.3. Kiểm toán chi tiết 7 Script tiện ích đã chỉnh sửa
Chỉ kiểm tra mã nguồn, cú pháp (`node --check`) và kiểm thử cô lập trên `MongoMemoryReplSet` (tuyệt đối không chạy các script seed/update lên MongoDB Atlas):

| STT | Đường dẫn Script | Đường dẫn import `configureOptionalDnsServers` | Thứ tự nạp `dotenv` trước khi cấu hình DNS | Kiểm tra cú pháp (`node --check`) | Đánh giá an toàn Database đích & Side Effects |
| :-: | :--- | :--- | :---: | :---: | :--- |
| 1 | `backend/scripts/capture_live_statistics_tabs.mjs` | `../src/config/db.js` (Chính xác) | `dotenv.config(...)` ở dòng 23 -> `configureOptionalDnsServers()` ở dòng 24 | **PASS** | Script chỉ đọc phục vụ chụp ảnh nghiệm thu; không có side effect khi import. |
| 2 | `backend/scripts/seedDemoStatistics2026.js` | `../src/config/db.js` (Chính xác) | `dotenv.config(...)` ở dòng 29 -> `configureOptionalDnsServers()` ở dòng 30 | **PASS** | Đã gỡ bỏ URI/mật khẩu hard-code. Đã bổ sung chốt chặn `[SAFETY ABORT]`: bắt buộc `DEMO_URI` phải khớp `/\/movietix_demo_db(\?|$)/`, khác `LIVE_URI`, và `demoConn.name === 'movietix_demo_db'`. Trên `liveConn` chỉ có 4 lệnh chỉ đọc (`find`, `countDocuments`), tuyệt đối không thể ghi nhầm dữ liệu DEMO vào LIVE. |
| 3 | `backend/scripts/verify_live_statistics_25cases.mjs` | `../src/config/db.js` (Chính xác) | `dotenv.config(...)` ở dòng 13 (và trong `db.js`) -> `configureOptionalDnsServers()` ở dòng 16 | **PASS** | Script kiểm thử chạy trên `MongoMemoryReplSet` cô lập và chỉ đọc cấu hình URI; không ghi lên Atlas. |
| 4 | `backend/src/scripts/checkMoviesStatus.js` | `../config/db.js` (Chính xác) | `dotenv.config(...)` ở dòng 2 -> `configureOptionalDnsServers()` ở dòng 5 | **PASS** | Script tiện ích chỉ đọc (`Movie.find`, `Showtime.countDocuments`). |
| 5 | `backend/src/scripts/distribute18MoviesByMonth.js` | `../config/db.js` (Chính xác) | `dotenv.config(...)` ở dòng 5 -> `configureOptionalDnsServers()` ở dòng 8 | **PASS** | Script tiện ích quản trị độc lập; không được import bởi Backend runtime; không có fallback nhầm giữa DEMO và LIVE. |
| 6 | `backend/src/scripts/seedClean3RoomShowtimes.js` | `../config/db.js` (Chính xác) | `dotenv.config(...)` ở dòng 5 -> `configureOptionalDnsServers()` ở dòng 8 | **PASS** | Script tiện ích quản trị độc lập; không được import bởi Backend runtime. |
| 7 | `backend/src/scripts/updateMoviesStatusTo3NowShowing.js` | `../config/db.js` (Chính xác) | `dotenv.config(...)` ở dòng 2 -> `configureOptionalDnsServers()` ở dòng 5 | **PASS** | Script tiện ích quản trị độc lập; không được import bởi Backend runtime. |

---

## 7. So sánh cấu hình trước và sau khi xử lý (Đã ẩn danh toàn bộ thông tin nhạy cảm)

### Trước khi xử lý (`backend/.env` dòng 1–17)
```dotenv
PORT=5000
JWT_SECRET="***MASKED***"
GEMINI_API_KEY="***MASKED***"
# Chế độ Database: DEMO (movietix_demo_db phục vụ báo cáo CDIO) hoặc LIVE (movietix_db gốc)
DB_MODE="LIVE"
# Database LIVE gốc (Giữ nguyên 100% không đụng chạm)
MONGODB_LIVE_URI="mongodb+srv://<DB_USER>:***MASKED***@<ATLAS_CLUSTER_HOST>/movietix_db?retryWrites=true&w=majority"
# Database DEMO cô lập trên cùng cluster MongoDB Atlas
MONGODB_DEMO_URI="mongodb+srv://<DB_USER>:***MASKED***@<ATLAS_CLUSTER_HOST>/movietix_demo_db?retryWrites=true&w=majority"
# Biến MONGODB_URI mặc định trỏ tới database đang kích hoạt
MONGODB_URI="mongodb+srv://<DB_USER>:***MASKED***@<ATLAS_CLUSTER_HOST>/movietix_db?retryWrites=true&w=majority"
# Cấu hình Gmail gửi OTP
EMAIL_USER="<MASKED_EMAIL>"
EMAIL_PASS="***MASKED***"

# C?u hnh DNS ty ch?n cho Node.js d? kh?c ph?c l?i querySrv ECONNREFUSED khi k?t n?i MongoDB Atlas
DNS_SERVERS=8.8.8.8,8.8.4.4
```

### Sau khi chuẩn hóa (`backend/.env` dòng 1–17, chuẩn UTF-8)
```dotenv
PORT=5000
JWT_SECRET="***MASKED***"
GEMINI_API_KEY="***MASKED***"
# Chế độ Database: DEMO (movietix_demo_db phục vụ báo cáo CDIO) hoặc LIVE (movietix_db gốc)
DB_MODE="LIVE"
# Database LIVE gốc (Giữ nguyên 100% không đụng chạm)
MONGODB_LIVE_URI="mongodb+srv://<DB_USER>:***MASKED***@<ATLAS_CLUSTER_HOST>/movietix_db?retryWrites=true&w=majority"
# Database DEMO cô lập trên cùng cluster MongoDB Atlas
MONGODB_DEMO_URI="mongodb+srv://<DB_USER>:***MASKED***@<ATLAS_CLUSTER_HOST>/movietix_demo_db?retryWrites=true&w=majority"
# Biến MONGODB_URI mặc định trỏ tới database đang kích hoạt
MONGODB_URI="mongodb+srv://<DB_USER>:***MASKED***@<ATLAS_CLUSTER_HOST>/movietix_db?retryWrites=true&w=majority"
# Cấu hình Gmail gửi OTP
EMAIL_USER="<MASKED_EMAIL>"
EMAIL_PASS="***MASKED***"

# Cấu hình DNS tùy chọn cho Node.js (Mặc định tắt để dùng DNS hệ thống; chỉ bật khi mạng cục bộ chặn truy vấn SRV)
# DNS_SERVERS=8.8.8.8,8.8.4.4
```

---

## 8. Kết quả kiểm thử DNS (`DNS-01` đến `DNS-08`)

| Mã Test | Nội dung kiểm thử | Kết quả | Chi tiết nghiệm thu thực tế |
| :---: | :--- | :---: | :--- |
| **DNS-01** | Node.js sử dụng DNS mặc định mà không gọi `dns.setServers()` | **PASS** | `configured: false`, `dns.getServers()` trả về DNS mặc định của mạng hiện tại (`["<LAN_DNS_IPV4>", "<LAN_DNS_IPV6>"]`) |
| **DNS-02** | `dns.promises.resolveSrv` thành công với DNS mặc định | **PASS** | Phân giải thành công 3 shard hosts ở cổng `27017` |
| **DNS-03** | `dns.promises.resolveTxt` thành công với DNS mặc định | **PASS** | Phân giải thành công bản ghi TXT (`authSource=admin&replicaSet=...`) |
| **DNS-04** | `dns.promises.lookup` và kết nối TLS `27017` tới các shard host thành công | **PASS** | Cả 3 shard hosts đều phân giải IPv4 và bắt tay `TLSv1.3` thành công (`authorized: true`) |
| **DNS-05** | Khởi động lại tiến trình Node.js nhiều lần vẫn thành công | **PASS** | Chạy 5 tiến trình Node.js độc lập liên tiếp, cả 5/5 lần đều nhận DNS mặc định và phân giải `SRV`/`TXT` thành công |
| **DNS-06** | Mở terminal mới và kiểm tra lại vẫn thành công | **PASS** | Khởi tạo phiên `powershell.exe -NoProfile` độc lập, phân giải `SRV` thành công với DNS mặc định (`shards=3`) |
| **DNS-07** | Kiểm tra sau khi khởi động lại Windows | **NOT RUN** | Không thực hiện thay đổi cấp hệ điều hành và không tự ý khởi động lại máy |
| **DNS-08** | Tái kiểm tra DNS mặc định trên mạng Wi-Fi từng gặp lỗi trước đó | **NOT RUN** | Mạng Wi-Fi từng xảy ra lỗi hiện không nằm trong vùng phủ sóng (`IsPreviousErrorNetworkInRange: False`) |

---

## 9. Kết quả kiểm thử Backend LIVE, DEMO và Phân tích Startup Jobs (`BE-01` đến `BE-10`)

### 9.1. Bảng kết quả kiểm thử `BE-01` đến `BE-10`

| Mã Test | Nội dung kiểm thử | Kết quả | Chi tiết nghiệm thu thực tế |
| :---: | :--- | :---: | :--- |
| **BE-01** | Backend khởi động với `DB_MODE=LIVE` mà không có `DNS_SERVERS` | **PASS** | Khởi động thành công bằng DNS mặc định, kết nối `movietix_db` (`movies=18, showtimes=229, bookings=5`) |
| **BE-02** | Backend khởi động với `DB_MODE=DEMO` mà không có `DNS_SERVERS` | **PASS** | Khởi động thành công bằng DNS mặc định, kết nối `movietix_demo_db` (`movies=18, showtimes=1516, bookings=942`) |
| **BE-03** | Log xác nhận kết nối đúng `movietix_db` khi `LIVE` và `movietix_demo_db` khi `DEMO` | **PASS** | Log in chính xác `[MongoDB - LIVE MODE] .../movietix_db` và `[MongoDB - DEMO MODE] .../movietix_demo_db`; không có log ghi đè DNS |
| **BE-04** | `GET http://localhost:5000/api/health` trả về `200 OK` | **PASS** | Trả về `{"status":"OK","database":{"type":"MongoDB Atlas","connected":true,"movies":18,"showtimes":229,"bookings":5}}` |
| **BE-05** | `GET http://localhost:5000/api/movies` trả về `200 OK` | **PASS** | Trả về `HTTP 200 OK` với danh sách 18 bộ phim |
| **BE-06** | API suất chiếu và phòng chiếu chỉ đọc trả về `200 OK` | **PASS** | `GET /api/rooms` -> `HTTP 200 OK`; `GET /api/admin/showtimes` -> `HTTP 200 OK` |
| **BE-07** | API thống kê chỉ đọc trả về `200 OK` | **PASS** | `GET /api/admin/statistics/overview?month=11&year=2026` -> `HTTP 200 OK` (`success: true`) |
| **BE-08** | `nodemon` reload khi chạy `npm run dev` không làm lỗi kết nối MongoDB | **PASS** | Kích hoạt `nodemon` hot-reload, tiến trình tự khởi động lại và kết nối lại `movietix_db` thành công ở cả 2 lần liên tiếp |
| **BE-09** | Không tự động fallback từ `LIVE` sang `DEMO` khi lỗi kết nối | **PASS** | Khi giả lập lỗi kết nối `LIVE` trên tiến trình cô lập, hệ thống in cảnh báo `KHÔNG tự động chuyển sang database DEMO` và trả về `null` |
| **BE-10** | Kiểm toán Startup Jobs, Auto-Seed và tính toàn vẹn dữ liệu `LIVE` / `DEMO` | **PASS** | Xem phân tích chi tiết cơ chế Startup Jobs tại Mục 9.2 bên dưới |

### 9.2. Kiểm toán Startup Jobs, Auto-Seed và các thao tác ghi dữ liệu khi Backend khởi động (Mục 7 Final Validation)
Không chỉ dựa vào số lượng bản ghi (`countDocuments`) trước và sau kiểm thử, mã nguồn khởi động của Backend (`backend/src/server.js`, `backend/src/config/db.js`, và các module liên quan) đã được kiểm toán trực tiếp:

1. **Không có cơ chế Auto-Seed khi khởi động Backend:**
   - Trong `backend/src/server.js` và `backend/src/config/db.js`, **không** có bất kỳ lệnh gọi hàm seed, migrate, xóa hay khởi tạo dữ liệu mẫu nào khi server khởi động.
2. **Phân tích tác vụ nền duy nhất khi khởi động (`startShowtimeLifecycleScheduler`):**
   - Trong `backend/src/server.js` (dòng 31–33):
     ```js
     connectDB().then(() => {
       startShowtimeLifecycleScheduler(60000);
     });
     ```
   - Trong `backend/src/services/showtimeLifecycleService.js` (dòng 149–163):
     - Khi `startShowtimeLifecycleScheduler(60000)` được gọi, nó đặt một `setTimeout(runTick, 1500)` (chạy lần đầu sau 1.5 giây) và `setInterval(runTick, 60000)` (chạy định kỳ mỗi 60 giây).
     - Hàm `syncShowtimeLifecycleStatuses(now)` truy vấn các suất chiếu có `lifecycleStatus` chưa phải `COMPLETED`/`CANCELLED` và tính toán trạng thái thời gian thực (`UPCOMING` -> `NOW_SHOWING` -> `CLEANING` -> `COMPLETED`) dựa trên `startTime`, `endTime` và `cleaningEndTime`.
     - **Chỉ khi** một suất chiếu trên database có `lifecycleStatus` cũ lệch với thời gian thực (ví dụ suất chiếu vừa kết thúc thời gian chiếu hoặc vừa hết giờ dọn phòng), hàm này mới thực hiện `Showtime.bulkWrite` (`updateOne` trên các trường `lifecycleStatus`, `endTime`, `cleaningMinutes`, `cleaningEndTime`) để đồng bộ trạng thái vòng đời suất chiếu; nếu các suất chiếu đã ở đúng trạng thái theo thời gian thực (`needsUpdate === false`), `bulkOps` rỗng (`updated: 0`) và không có lệnh ghi nào được gửi tới MongoDB.
     - Ngoài `syncShowtimeLifecycleStatuses`, không có bất kỳ collection nào khác (`movies`, `bookings`, `showtimeseats`, `users`, `adminusers`, `expenses`, `cinemas`, `rooms`, `concessions`, `promotions`) có startup job hay thao tác ghi tự động khi khởi động server.

---

## 10. Kết quả kiểm thử hồi quy toàn hệ thống (Phase 4 — Mục 7.3)

| Hạng mục kiểm thử | Lệnh thực thi | Kết quả | Chi tiết |
| :--- | :--- | :---: | :--- |
| **Backend Automated Tests (Recurring Showtimes, Seat Holding, Booking, Admin Auth, Search & Review)** | `npm --prefix backend test` | **PASS (95/95)** | Toàn bộ **95/95** test cases trong 8 bộ test chạy trên `MongoMemoryReplSet` cô lập đạt 100% (`fail 0`) |
| **Advanced AI Chatbot Specification Tests** | `node backend/scripts/testAdvancedChatbotSpec.js` | **PASS (11/11)** | Toàn bộ **11/11** nhóm kịch bản nâng cao (18 tiêu chuẩn nghiệp vụ & bảo mật) đạt 100% |
| **Isolated 7-Script & Safety Guard Validation** | `node scratch/validate_7_scripts_and_startup.mjs` | **PASS** | Cả 7 script đạt kiểm tra cú pháp, thứ tự `dotenv`, đường dẫn import và chốt chặn `[SAFETY ABORT]` trên `seedDemoStatistics2026.js` |
| **Frontend Production Build** | `npm --prefix frontend run build` | **PASS** | Vite `v8.3.5` biên dịch thành công `2209 modules` trong `1.83s` |

---

## 11. Kiểm toán Lịch sử Git & Hướng dẫn xoay vòng thông tin xác thực (`SECURITY CREDENTIAL ROTATION REQUIRED`)

### 11.1. Phạm vi Commit trong lịch sử Git từng chứa thông tin xác thực hard-code
Thực hiện rà soát chỉ đọc trên lịch sử Git (`git log --all --full-history -S "mongodb+srv://"`) mà không hiển thị giá trị mật khẩu:

| Loại thông tin trong lịch sử Git | Commit giới thiệu | Ngày commit | Tệp liên quan | Trạng thái hiện tại trên nhánh `fix/mongodb-dns-root-cause` |
| :--- | :---: | :---: | :--- | :--- |
| **Tệp `backend/.env`** | *(Không có)* | *(Không có)* | `backend/.env` | **Chưa từng bị commit vào Git.** Được bảo vệ bởi `.gitignore` (`**/.env`, `*.env`). |
| **URI fallback chứa thông tin đăng nhập của cluster Atlas hiện tại** | `e5d971f` *(được merge vào `main` qua `a88be1b`)* | `2026-11-26` | `backend/scripts/seedDemoStatistics2026.js` (dòng 33) | **Đã xóa bỏ hoàn toàn khỏi working tree** trên nhánh `fix/mongodb-dns-root-cause`. Tuy nhiên bản ghi vẫn còn lưu trong lịch sử commit `e5d971f` (**Bắt buộc xoay vòng mật khẩu Database User**). |
| **URI fallback tới các cluster thử nghiệm cũ từ giai đoạn đầu dự án** | `62045f6`<br>`7f29487` | `2026-11-25`<br>`2026-11-21` | `backend/scripts/inspect_expenses.js`<br>`backend/scripts/test_overview_stats.js`<br>`backend/src/scripts/updateMovieRatings.js` | Chứa chuỗi fallback tới các cluster cũ không còn sử dụng (`movietix.m3q8h.mongodb.net`, `cluster0.p7qsl.mongodb.net`), không phải cluster hoạt động hiện tại. |

*(Lưu ý tuân thủ quy tắc: Agent tuyệt đối không tự ý rewrite Git history, không `git filter-branch`, không `git push --force` và không tự ý đổi mật khẩu của người dùng).*

### 11.2. Hướng dẫn Quản trị viên xoay vòng (Rotate) thông tin nhạy cảm
Do mật khẩu Database User của cluster hiện tại từng xuất hiện trong commit `e5d971f` và các thông tin trong `backend/.env` đã được hiển thị trên máy local trong quá trình gỡ lỗi trước đây, trạng thái bảo mật được đánh dấu là **`SECURITY CREDENTIAL ROTATION REQUIRED`**. Quản trị viên cần thực hiện xoay vòng 3 thông tin sau:

1. **Xoay vòng mật khẩu MongoDB Atlas Database User (Ưu tiên cao nhất):**
   - Đăng nhập vào [MongoDB Atlas Console](https://cloud.mongodb.com/) -> chọn Project của dự án.
   - Vào **Security** -> **Database Access** -> chọn Database User hiện tại -> nhấn **Edit**.
   - Tại mục **Password Authentication**, nhấn **Edit Password** -> chọn **Autogenerate Secure Password** -> nhấn **Update User**.
   - Cập nhật mật khẩu mới vào cả 3 biến `MONGODB_LIVE_URI`, `MONGODB_DEMO_URI`, và `MONGODB_URI` trong tệp `backend/.env` trên máy local, sau đó khởi động lại Backend.
2. **Xoay vòng Gmail App Password (`EMAIL_PASS`):**
   - Truy cập trang Quản lý Tài khoản Google của email gửi OTP -> **Bảo mật (Security)** -> **Xác minh 2 bước (2-Step Verification)** -> **Mật khẩu ứng dụng (App passwords)**.
   - Xóa (Revoke) mật khẩu ứng dụng 16 ký tự hiện tại và tạo mật khẩu ứng dụng 16 ký tự mới.
   - Cập nhật giá trị mới vào biến `EMAIL_PASS` trong `backend/.env`.
3. **Xoay vòng khóa ký token (`JWT_SECRET`):**
   - Chạy lệnh sau trên terminal để sinh khóa ngẫu nhiên 256-bit (64 ký tự hex):
     ```powershell
     node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
     ```
   - Cập nhật giá trị mới vào biến `JWT_SECRET` trong `backend/.env`.

---

## 12. Trạng thái Git hiện tại

- **Nhánh hiện tại:** `fix/mongodb-dns-root-cause` (tách từ `main` tại commit `001733e`).
- **Kết quả kiểm tra `git check-ignore backend/.env`:** `backend/.env` (được `.gitignore` chặn hoàn toàn).
- **Kết quả kiểm tra `git ls-files backend/.env`:** *(Trống — không bị Git theo dõi)*.
- **Kết quả kiểm tra `git diff --check`:** Sạch 100% (0 lỗi whitespace hay conflict marker).
- **Danh sách tệp thay đổi (`git status` / `git diff --stat`):**
  - `backend/scripts/capture_live_statistics_tabs.mjs`
  - `backend/scripts/seedDemoStatistics2026.js`
  - `backend/scripts/verify_live_statistics_25cases.mjs`
  - `backend/src/scripts/checkMoviesStatus.js`
  - `backend/src/scripts/distribute18MoviesByMonth.js`
  - `backend/src/scripts/seedClean3RoomShowtimes.js`
  - `backend/src/scripts/updateMoviesStatusTo3NowShowing.js`
  - `MONGODB_DNS_ROOT_CAUSE_REPORT.md` (Tệp báo cáo mới, đã được làm sạch toàn bộ thông tin cá nhân, tên Wi-Fi, IP nội bộ, email và username database)

---

## 13. Rủi ro còn lại và Hướng xử lý khi chuyển mạng

1. **Rủi ro khi quay lại mạng Wi-Fi từng gặp lỗi hoặc mạng chặn truy vấn DNS `SRV`:**
   - Vì mạng Wi-Fi từng gây lỗi chưa được tái kiểm tra trực tiếp (`DNS-08: NOT RUN`), nếu khi chuyển lại mạng đó mà `dns.getServers()` của Node.js lại rơi về `127.0.0.1`, Quản trị viên có thể áp dụng ngay 1 trong 2 phương án đã chuẩn bị sẵn:
     - **Phương án A (Cấp ứng dụng — Tức thời):** Mở `backend/.env` và bỏ dấu `#` ở dòng `DNS_SERVERS=8.8.8.8,8.8.4.4`. Hàm `configureOptionalDnsServers()` trong `backend/src/config/db.js` sẽ tự động kích hoạt.
     - **Phương án B (Cấp Windows Adapter):** Cấu hình DNS tĩnh trực tiếp trên thuộc tính IPv4 của Adapter Wi-Fi (`Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses ("8.8.8.8","8.8.4.4")`) thay vì cấu hình per-SSID trong Windows Settings.
2. **Rủi ro lộ mật khẩu cũ trong lịch sử commit `e5d971f`:**
   - Sẽ được triệt tiêu hoàn toàn ngay sau khi Quản trị viên đổi mật khẩu Database User trên MongoDB Atlas Console theo Mục 11.2.

---

## 14. Kết luận tổng hợp

- **`DNS DEFAULT WORKING ON CURRENT NETWORK`**: Trên mạng hiện tại, Node.js và Backend D’AVENOR CINEMA kết nối ổn định 100% tới cả `movietix_db` (`LIVE`) và `movietix_demo_db` (`DEMO`) bằng DNS mặc định của hệ thống mà không cần bật `DNS_SERVERS`.
- **`ROOT CAUSE PARTIALLY VERIFIED`**: Đã xác minh đầy đủ cơ chế `c-ares 1.34.6` fallback về `127.0.0.1` gây lỗi `querySrv ECONNREFUSED` trên Windows, nhưng chưa tái kiểm tra trực tiếp trên mạng Wi-Fi từng gặp lỗi do mạng đó hiện không khả dụng (`NOT RUN`).
- **`SECURITY CREDENTIAL ROTATION REQUIRED`**: Mã nguồn trên nhánh `fix/mongodb-dns-root-cause` và báo cáo này đã được làm sạch 100% thông tin nhạy cảm; Quản trị viên cần xoay vòng mật khẩu Database User trên MongoDB Atlas, Gmail App Password và `JWT_SECRET` trước khi vận hành chính thức.
