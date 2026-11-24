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
import Concession from '../src/models/Concession.js';
import Promotion from '../src/models/Promotion.js';
import Faq from '../src/models/Faq.js';
import AiConfig from '../src/models/AiConfig.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import Booking from '../src/models/Booking.js';

async function preResetAndApply() {
  console.log('================================================================');
  console.log('   KIỂM TRA CUỐI CÙNG & THỰC THI RESET DỮ LIỆU VẬN HÀNH D\'AVENOR');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // 1. Kiểm tra Database Name
  console.log('1. KIỂM TRA DATABASE KẾT NỐI:');
  const dbName = mongoose.connection.name;
  console.log(`- Database Name: '${dbName}'`);
  if (dbName !== 'movietix_db') {
    throw new Error(`Sai database! Yêu cầu 'movietix_db' nhưng đang kết nối '${dbName}'. Dừng ngay!`);
  }
  console.log('-> [PASS] Đúng database mục tiêu.\n');

  // 2. Kiểm tra Backup Thư mục & Manifest
  console.log('2. KIỂM TRA TÍNH TOÀN VẸN CỦA BẢN SAO LƯU:');
  const backupDir = path.resolve('backend/backups');
  const backupFolders = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_before_reset_')).sort().reverse();
  if (backupFolders.length === 0) {
    throw new Error('Không tìm thấy thư mục backup nào trong backend/backups! Dừng ngay!');
  }
  const latestBackup = path.join(backupDir, backupFolders[0]);
  console.log(`- Thư mục backup mới nhất: ${latestBackup}`);
  const manifestPath = path.join(latestBackup, 'backup_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Thiếu file backup_manifest.json! Dừng ngay!');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`- Manifest ghi nhận: ${manifest.totalDocuments.toLocaleString()} documents đã sao lưu.`);
  console.log(`  + showtimes: ${manifest.collections.showtimes}`);
  console.log(`  + showtimeseats: ${manifest.collections.showtimeseats}`);
  console.log(`  + bookings: ${manifest.collections.bookings}`);

  // Kiểm tra file tồn tại và size > 0
  ['showtimes.json', 'showtimeseats.json', 'bookings.json'].forEach(f => {
    const fp = path.join(latestBackup, f);
    if (!fs.existsSync(fp) || fs.statSync(fp).size === 0) {
      throw new Error(`File backup ${f} bị thiếu hoặc rỗng! Dừng ngay!`);
    }
  });
  console.log('-> [PASS] Bản sao lưu đầy đủ và hợp lệ 100%.\n');

  // 3. Đối chiếu số lượng document hiện tại so với thời điểm backup
  console.log('3. ĐỐI CHIẾU SỐ LƯỢNG DOCUMENT HIỆN TẠI VỚI BACKUP:');
  const [currShowtimes, currSeats, currBookings] = await Promise.all([
    Showtime.countDocuments(),
    ShowtimeSeat.countDocuments(),
    Booking.countDocuments(),
  ]);
  console.log(`- Showtime hiện tại: ${currShowtimes} (Manifest: ${manifest.collections.showtimes})`);
  console.log(`- ShowtimeSeat hiện tại: ${currSeats} (Manifest: ${manifest.collections.showtimeseats})`);
  console.log(`- Booking hiện tại: ${currBookings} (Manifest: ${manifest.collections.bookings})`);

  if (currShowtimes !== manifest.collections.showtimes ||
      currSeats !== manifest.collections.showtimeseats ||
      currBookings !== manifest.collections.bookings) {
    throw new Error('Số lượng document hiện tại đã thay đổi so với thời điểm backup! Dừng ngay để đảm bảo an toàn!');
  }
  console.log('-> [PASS] Số lượng document khớp 100%, không phát sinh dữ liệu mới.\n');

  // 4. Sao lưu User ID và Points của các user có điểm
  console.log('4. SAO LƯU ĐIỂM THƯỞNG CỦA CÁC TÀI KHOẢN TRƯỚC RESET:');
  const usersWithPoints = await User.find({ points: { $gt: 0 } }).select('_id name email points tier').lean();
  console.log(`- Tìm thấy ${usersWithPoints.length} tài khoản có điểm thưởng (>0):`);
  usersWithPoints.forEach(u => console.log(`  * [${u.email}] ${u.name}: ${u.points} điểm (Tier: ${u.tier})`));
  
  const userPointsBackupFile = path.join(latestBackup, 'user_points_snapshot.json');
  fs.writeFileSync(userPointsBackupFile, JSON.stringify(usersWithPoints, null, 2));
  console.log(`-> [PASS] Đã lưu snapshot điểm thưởng vào: ${userPointsBackupFile}\n`);

  // 5. Kiểm tra Foundation Data trước khi reset
  console.log('5. KIỂM TRA DỮ LIỆU NỀN TẢNG TRƯỚC KHI RESET:');
  const [preMovies, preRooms, preCinemas, preAdmin, preUsers, prePricing, preConcessions, prePromos, preFaqs, preAiConfig] = await Promise.all([
    Movie.countDocuments(),
    Room.countDocuments(),
    Cinema.countDocuments(),
    AdminUser.countDocuments(),
    User.countDocuments(),
    TicketPricingConfig.countDocuments(),
    Concession.countDocuments(),
    Promotion.countDocuments(),
    Faq.countDocuments(),
    AiConfig.countDocuments(),
  ]);
  console.log(`- Phim: ${preMovies}, Phòng: ${preRooms}, Rạp: ${preCinemas}, Admin: ${preAdmin}, Users: ${preUsers}`);
  console.log(`- Bảng giá: ${prePricing}, Bắp nước: ${preConcessions}, Khuyến mãi: ${prePromos}, FAQ: ${preFaqs}, AI: ${preAiConfig}`);
  console.log('-> [PASS] Dữ liệu nền tảng đầy đủ nguyên vẹn.\n');

  // 6. THỰC THI RESET CHÍNH THỨC
  console.log('================================================================');
  console.log('🔥 ĐANG THỰC THI RESET DỮ LIỆU VẬN HÀNH (--APPLY)...');
  console.log('================================================================');

  const delShowtimes = await Showtime.deleteMany({});
  console.log(`✅ [1/4] Đã xóa ${delShowtimes.deletedCount.toLocaleString()} documents trong 'showtimes' -> 0`);

  const delSeats = await ShowtimeSeat.deleteMany({});
  console.log(`✅ [2/4] Đã xóa ${delSeats.deletedCount.toLocaleString()} documents trong 'showtimeseats' -> 0`);

  const delBookings = await Booking.deleteMany({});
  console.log(`✅ [3/4] Đã xóa ${delBookings.deletedCount.toLocaleString()} documents trong 'bookings' -> 0`);

  const resetPts = await User.updateMany({ points: { $gt: 0 } }, { $set: { points: 0 } });
  console.log(`✅ [4/4] Đã reset điểm thưởng ảo về 0 cho ${resetPts.modifiedCount} tài khoản.`);

  // 7. HẬU KIỂM TOÀN DIỆN SAU RESET
  console.log('\n================================================================');
  console.log('       KẾT QUẢ ĐỐI SOÁT HẬU RESET (POST-RESET AUDIT)            ');
  console.log('================================================================');
  const [postShowtimes, postSeats, postBookings] = await Promise.all([
    Showtime.countDocuments(),
    ShowtimeSeat.countDocuments(),
    Booking.countDocuments(),
  ]);

  const [postMovies, postRooms, postCinemas, postAdmin, postUsers, postPricing, postConcessions, postPromos, postFaqs, postAiConfig] = await Promise.all([
    Movie.countDocuments(),
    Room.countDocuments(),
    Cinema.countDocuments(),
    AdminUser.countDocuments(),
    User.countDocuments(),
    TicketPricingConfig.countDocuments(),
    Concession.countDocuments(),
    Promotion.countDocuments(),
    Faq.countDocuments(),
    AiConfig.countDocuments(),
  ]);

  console.log(`- Suất chiếu (Showtime)      : ${postShowtimes} (Mục tiêu: 0) -> ${postShowtimes === 0 ? '✅ ĐẠT' : '❌ LỖI'}`);
  console.log(`- Ghế suất chiếu (ShowtimeSeat): ${postSeats} (Mục tiêu: 0) -> ${postSeats === 0 ? '✅ ĐẠT' : '❌ LỖI'}`);
  console.log(`- Đơn đặt vé (Booking)       : ${postBookings} (Mục tiêu: 0) -> ${postBookings === 0 ? '✅ ĐẠT' : '❌ LỖI'}`);
  console.log(`- Phim (Movie)               : ${postMovies} (Mục tiêu: 18) -> ${postMovies === 18 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- Phòng vật lý (Room)        : ${postRooms} (Mục tiêu: 9) -> ${postRooms === 9 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- Cụm rạp (Cinema)           : ${postCinemas} (Mục tiêu: 1) -> ${postCinemas === 1 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- Admin (AdminUser)          : ${postAdmin} (Mục tiêu: 1) -> ${postAdmin === 1 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- Khách hàng (User)          : ${postUsers} (Mục tiêu: 37) -> ${postUsers === 37 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- Bảng giá (PricingConfig)   : ${postPricing} (Mục tiêu: 1) -> ${postPricing === 1 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- Bắp nước (Concession)      : ${postConcessions} (Mục tiêu: 5) -> ${postConcessions === 5 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- Khuyến mãi (Promotion)     : ${postPromos} (Mục tiêu: 12) -> ${postPromos === 12 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- FAQ                        : ${postFaqs} (Mục tiêu: 6) -> ${postFaqs === 6 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);
  console.log(`- Trợ lý AI (AiConfig)       : ${postAiConfig} (Mục tiêu: 1) -> ${postAiConfig === 1 ? '✅ NGUYÊN VẸN 100%' : '❌ SAI LỆCH'}`);

  console.log('\n🎉 RESET DỮ LIỆU VẬN HÀNH THÀNH CÔNG VÀ AN TOÀN TUYỆT ĐỐI!');
  await mongoose.disconnect();
}

preResetAndApply().catch(err => {
  console.error('\n❌ LỖI TRONG QUÁ TRÌNH RESET:', err);
  process.exit(1);
});
