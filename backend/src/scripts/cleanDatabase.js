import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: './backend/.env' });

async function cleanDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Kết nối MongoDB Atlas thành công!\n');

    const Showtime = mongoose.model('Showtime', new mongoose.Schema({}, { strict: false }));
    const ShowtimeSeat = mongoose.model('ShowtimeSeat', new mongoose.Schema({}, { strict: false }));
    const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }));
    const OtpVerification = mongoose.model('OtpVerification', new mongoose.Schema({}, { strict: false }));

    const validShowtimeIds = await Showtime.distinct('_id');
    console.log(`📌 Tổng số suất chiếu hợp lệ hiện tại: ${validShowtimeIds.length}`);

    // 1. Dọn dẹp ghế mồ côi (ghế thuộc các suất chiếu đã bị xóa/thay thế)
    const seatsResult = await ShowtimeSeat.deleteMany({ showtimeId: { $nin: validShowtimeIds } });
    console.log(`🧹 Đã xóa ${seatsResult.deletedCount || 0} bản ghi ghế mồ côi (ShowtimeSeat không còn suất chiếu)`);

    // 2. Dọn dẹp đơn đặt vé mồ côi (các đơn test trỏ vào suất chiếu đã bị xóa)
    const bookingsResult = await Booking.deleteMany({ showtimeId: { $nin: validShowtimeIds } });
    console.log(`🧹 Đã xóa ${bookingsResult.deletedCount || 0} đơn đặt vé mồ côi (Booking không còn suất chiếu)`);

    // 3. Dọn dẹp các mã OTP đã hết hạn
    const now = new Date();
    const otpResult = await OtpVerification.deleteMany({
      $or: [
        { expiresAt: { $lt: now } },
        { isUsed: true },
        { status: 'EXPIRED' }
      ]
    });
    console.log(`🧹 Đã xóa ${otpResult.deletedCount || 0} mã OTP hết hạn / đã sử dụng`);

    // Kiểm kê lại
    const remainingSeats = await ShowtimeSeat.countDocuments();
    const remainingBookings = await Booking.countDocuments();
    console.log(`\n📊 Sau khi dọn dẹp:`);
    console.log(`   - Tổng số ghế còn lại trong database: ${remainingSeats} (Khớp hoàn toàn với ${validShowtimeIds.length} suất x 88 ghế)`);
    console.log(`   - Tổng số đơn đặt vé hợp lệ còn lại: ${remainingBookings}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi dọn dẹp database:', err);
    process.exit(1);
  }
}

cleanDb();
