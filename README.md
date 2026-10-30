# 🎬 MovieTix - Cinema Management & AI Assistant (RAG)

> Hệ thống quản lý rạp chiếu phim tích hợp Trợ lý ảo AI ứng dụng công nghệ RAG (Retrieval-Augmented Generation).

---

## 🏗️ Kiến trúc & Công nghệ (Tech Stack)

* **Frontend:** React (Vite), Tailwind CSS v4, React Router DOM, Axios, Lucide Icons.
* **Backend:** Node.js, Express.js, Prisma ORM (SQLite / PostgreSQL / MySQL), JWT, Bcrypt.
* **AI Engine:** Google Gemini API (`gemini-1.5-flash`) + RAG Pipeline thời gian thực + Fallback Engine.

---

## 🚀 Hướng dẫn khởi chạy dự án

### 1. Khởi động Backend (Port 5000)
Mở cửa sổ Terminal 1:
```bash
cd movietix-project/backend
npm run dev
```
* Backend sẽ chạy tại: `http://localhost:5000`
* Kiểm tra API sức khỏe hệ thống: `http://localhost:5000/api/health`

*(Tùy chọn) Thêm Gemini API Key:* Mở file `backend/.env` và dán API key của bạn vào:
```env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

### 2. Khởi động Frontend (Port 5173)
Mở cửa sổ Terminal 2:
```bash
cd movietix-project/frontend
npm run dev
```
* Truy cập ứng dụng tại: `http://localhost:5173`

---

## 📱 Danh sách 10 Màn hình & Đường dẫn (Routes)

### Cụm màn hình Khách hàng (Client Portal):
1. **Màn hình 1 - Trang chủ (`/`):** Banner, tìm kiếm phim, danh sách phim đang chiếu từ DB.
2. **Màn hình 2 - Chi tiết phim (`/movie/:id`):** Thông tin phim, trailer, lịch chiếu & phòng chiếu hôm nay.
3. **Màn hình 3 - Chọn ghế (`/booking/seat/:showtimeId`):** Sơ đồ ma trận 48 ghế thời gian thực (ghế thường, ghế VIP, ghế đã đặt), cơ chế khóa ghế 5 phút chống trùng vé.
4. **Màn hình 4 - Thanh toán (`/checkout`):** Chọn combo bắp nước, nhập thông tin liên hệ, phương thức thanh toán.
5. **Màn hình 5 - Vé điện tử (`/booking-success`):** Xuất vé điện tử QR Code động theo mã vé `#MTX...`.
6. **Màn hình 6 - Chatbot AI nổi (Góc phải màn hình):** Trợ lý ảo RAG đọc trực tiếp dữ liệu từ Database, tư vấn giờ chiếu, giá vé, số ghế trống kèm **nút bấm đặt vé trực tiếp**.

### Cụm màn hình Quản trị viên (Admin Portal):
7. **Màn hình 7 - Đăng nhập Admin (`/admin/login`):**
   * **Email:** `admin@movietix.vn`
   * **Mật khẩu:** `admin123`
8. **Màn hình 8 - Bảng điều khiển (`/admin/dashboard`):** Thống kê tổng doanh thu, số vé bán, danh sách giao dịch mới nhất.
9. **Màn hình 9 - Quản lý Phim & Suất chiếu (`/admin/movies`):** Thêm phim mới, xóa phim, mở suất chiếu mới (tự động sinh 48 ghế).
10. **Màn hình 10 - Quản lý Đặt vé (`/admin/bookings`):** Tra cứu toàn bộ đơn đặt vé theo mã vé, SĐT, tên khách hàng.

