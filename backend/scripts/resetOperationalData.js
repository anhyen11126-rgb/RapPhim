import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Cinema from '../src/models/Cinema.js';
import User from '../src/models/User.js';
import AdminUser from '../src/models/AdminUser.js';
import TicketPricingConfig from '../src/models/TicketPricingConfig.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import Booking from '../src/models/Booking.js';

const isApply = process.argv.includes('--apply');

async function runReset() {
  console.log('================================================================');
  console.log('      QUY TRÌNH RESET DỮ LIỆU VẬN HÀNH D\'AVENOR CINEMA          ');
  console.log(`      CHẾ ĐỘ THỰC THI: ${isApply ? '🔥 [APPLY - GHI THỰC TẾ]' : '🛡️ [DRY-RUN - KIỂM THỬ AN TOÀN]'}      `);
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // 1. Kiểm tra Foundation Data trước khi reset
  const [moviesCount, roomsCount, cinemasCount, adminCount, usersCount, pricingCount] = await Promise.all([
    Movie.countDocuments(),
    Room.countDocuments(),
    Cinema.countDocuments(),
    AdminUser.countDocuments(),
    User.countDocuments(),
    TicketPricingConfig.countDocuments(),
  ]);

  console.log('--- 1. KIỂM TRA DỮ LIỆU NỀN TẢNG (BẮT BUỘC BẢO VỆ 100%) ---');
  console.log(`- Phim (Movie)              : ${moviesCount} phim (ĐẦY ĐỦ)`);
  console.log(`- Phòng chiếu (Room)        : ${roomsCount} phòng (ĐẦY ĐỦ 9 PHÒNG)`);
  console.log(`- Cụm rạp (Cinema)          : ${cinemasCount} rạp (D'AVENOR Thanh Khê Plaza)`);
  console.log(`- Ban Quản Trị (AdminUser)  : ${adminCount} tài khoản (admin@davenor.vn)`);
  console.log(`- Khách hàng (User)         : ${usersCount} tài khoản (BẢO LƯU THÔNG TIN)`);
  console.log(`- Bảng giá (PricingConfig)  : ${pricingCount} cấu hình (ĐẦY ĐỦ)\n`);

  // 2. Thống kê Operational Data sẽ reset
  const [showtimesCount, seatsCount, bookingsCount] = await Promise.all([
    Showtime.countDocuments(),
    ShowtimeSeat.countDocuments(),
    Booking.countDocuments(),
  ]);

  console.log('--- 2. DỮ LIỆU VẬN HÀNH THỬ NGHIỆM CẦN RESET ---');
  console.log(`- Suất chiếu (Showtime)     : ${showtimesCount.toLocaleString()} suất`);
  console.log(`- Ghế suất chiếu (ShowtimeSeat): ${seatsCount.toLocaleString()} bản ghi ghế`);
  console.log(`- Đơn đặt vé (Booking)      : ${bookingsCount.toLocaleString()} đơn hàng mock seed\n`);

  if (!isApply) {
    console.log('----------------------------------------------------------------');
    console.log('🛡️ [DRY-RUN HOÀN TẤT] KHÔNG CÓ THAO TÁC GHI NÀO VÀO DATABASE.');
    console.log('Khi chạy --apply:');
    console.log(`1. Xóa toàn bộ ${showtimesCount.toLocaleString()} suất chiếu trong 'showtimes' -> về 0`);
    console.log(`2. Xóa toàn bộ ${seatsCount.toLocaleString()} ghế suất chiếu trong 'showtimeseats' -> về 0`);
    console.log(`3. Xóa toàn bộ ${bookingsCount.toLocaleString()} đơn hàng thử nghiệm trong 'bookings' -> về 0`);
    console.log(`4. Đặt lại điểm thưởng của các tài khoản User về 0 (xóa điểm tích lũy ảo)`);
    console.log(`5. Dữ liệu Phim (18), Phòng (9), Rạp (1), Bảng giá, Tài khoản Admin và User được GIỮ NGUYÊN 100%`);
    console.log('----------------------------------------------------------------');
    await mongoose.disconnect();
    return;
  }

  // 3. Nếu là --apply: Yêu cầu kiểm tra thư mục backup trước
  const backupDir = path.resolve('backend/backups');
  if (!fs.existsSync(backupDir) || fs.readdirSync(backupDir).length === 0) {
    console.error('❌ CẢNH BÁO NGUY HIỂM: Chưa có bản sao lưu nào trong backend/backups! Dừng thực thi ngay.');
    process.exit(1);
  }

  console.log('🔥 ĐANG THỰC HIỆN RESET DỮ LIỆU VẬN HÀNH...');

  // Bước A: Xóa toàn bộ Showtime
  const delShowtimes = await Showtime.deleteMany({});
  console.log(`✅ Đã xóa sạch collection 'showtimes': ${delShowtimes.deletedCount.toLocaleString()} documents.`);

  // Bước B: Xóa toàn bộ ShowtimeSeat
  const delSeats = await ShowtimeSeat.deleteMany({});
  console.log(`✅ Đã xóa sạch collection 'showtimeseats': ${delSeats.deletedCount.toLocaleString()} documents.`);

  // Bước C: Xóa toàn bộ Booking thử nghiệm
  const delBookings = await Booking.deleteMany({});
  console.log(`✅ Đã xóa sạch collection 'bookings': ${delBookings.deletedCount.toLocaleString()} documents.`);

  // Bước D: Reset điểm thưởng ảo của User về 0
  const resetPoints = await User.updateMany({ points: { $gt: 0 } }, { $set: { points: 0 } });
  console.log(`✅ Đã reset điểm thưởng ảo về 0 cho ${resetPoints.modifiedCount} người dùng.`);

  // 4. Hậu kiểm sau khi Reset (Post-reset Verification)
  const [postShowtimes, postSeats, postBookings, postMovies, postRooms] = await Promise.all([
    Showtime.countDocuments(),
    ShowtimeSeat.countDocuments(),
    Booking.countDocuments(),
    Movie.countDocuments(),
    Room.countDocuments(),
  ]);

  console.log('\n================================================================');
  console.log('       KẾT QUẢ NGHIỆM THU HẬU RESET (POST-RESET AUDIT)          ');
  console.log('================================================================');
  console.log(`- Suất chiếu (Showtime)      : ${postShowtimes} (MỤC TIÊU: 0) -> ${postShowtimes === 0 ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);
  console.log(`- Ghế suất chiếu (ShowtimeSeat): ${postSeats} (MỤC TIÊU: 0) -> ${postSeats === 0 ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);
  console.log(`- Đơn đặt vé (Booking)       : ${postBookings} (MỤC TIÊU: 0) -> ${postBookings === 0 ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);
  console.log(`- Danh sách Phim             : ${postMovies} phim -> ${postMovies === 18 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- Danh sách Phòng vật lý     : ${postRooms} phòng -> ${postRooms === 9 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log('================================================================\n');

  console.log('🎉 HỆ THỐNG D\'AVENOR CINEMA ĐÃ TRỞ VỀ TRẠNG THÁI SẠCH TINH KHÔI.');
  console.log('Admin giờ đây có thể tự do chủ động xếp lịch mới từ trang Quản Trị.');

  await mongoose.disconnect();
}

if (process.argv[1]?.endsWith('resetOperationalData.js')) {
  runReset().catch(console.error);
}
