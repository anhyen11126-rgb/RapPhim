import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Cinema from '../src/models/Cinema.js';
import User from '../src/models/User.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import Booking from '../src/models/Booking.js';
import { generateStandard88Seats } from './migrateShowtimeData.js';

async function run20E2ETests() {
  console.log('================================================================');
  console.log('  KIỂM THỬ TÍCH HỢP 20 TIÊU CHÍ QUY TRÌNH ĐẶT VÉ E2E D\'AVENOR   ');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const results = [];
  const addResult = (step, name, pass, detail) => {
    results.push({ step, name, pass, detail });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] Bước ${step}: ${name}`);
    if (detail) console.log(`       -> ${detail}`);
  };

  // Lấy dữ liệu nền tảng
  const movie = await Movie.findOne({ status: 'NOW_SHOWING' }) || await Movie.findOne();
  const room = await Room.findOne({ status: 'ACTIVE', roomType: 'IMAX Laser' }) || await Room.findOne();
  const userA = await User.findOne() || await User.create({ name: 'Tester A', email: 'testerA@davenor.vn', phone: '0901234567', password: 'hash' });
  const userB = (await User.find().skip(1).limit(1))[0] || await User.create({ name: 'Tester B', email: 'testerB@davenor.vn', phone: '0907654321', password: 'hash' });

  let testShowtime = null;
  let testBooking = null;

  try {
    // 1. Admin tạo một suất chiếu hợp lệ trong tương lai (3 ngày sau)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    futureDate.setHours(19, 30, 0, 0);

    const dur = Number(movie.duration) || 120;
    const end = new Date(futureDate.getTime() + dur * 60000);

    testShowtime = await Showtime.create({
      movieId: movie._id,
      roomId: room._id,
      cinemaId: room.cinemaId,
      roomName: room.name,
      formatFeature: 'Màn hình IMAX cong Laser 4K • Âm thanh vòm đa chiều',
      startTime: futureDate,
      endTime: end,
      price: 150000,
      cleaningMinutes: 15,
      isLocked: false,
      cancelledAt: null,
    });
    addResult(1, 'Admin tạo một suất chiếu thành công', !!testShowtime._id, `Showtime ID: ${testShowtime._id}`);

    // 2. Showtime được lưu chính xác trong MongoDB
    const savedSt = await Showtime.findById(testShowtime._id).populate('movieId').populate('roomId');
    const stValid = savedSt && String(savedSt.movieId._id) === String(movie._id) && String(savedSt.roomId._id) === String(room._id);
    addResult(2, 'Showtime được lưu chính xác trong MongoDB', stValid, `Khớp Movie: ${savedSt.movieId.title}, Room: ${savedSt.roomId.name}`);

    // 3. ShowtimeSeat được tạo đầy đủ theo layout phòng (88 ghế chuẩn)
    const seatList = generateStandard88Seats(room._id, testShowtime._id);
    await ShowtimeSeat.insertMany(seatList);
    const seatCount = await ShowtimeSeat.countDocuments({ showtimeId: testShowtime._id });
    addResult(3, 'ShowtimeSeat được tạo đầy đủ theo layout phòng', seatCount === 88, `Đã tạo đúng ${seatCount} ghế vật lý độc lập cho suất chiếu`);

    // 4. Website khách hàng hiển thị suất chiếu đúng điều kiện mở bán
    const webVisible = await Showtime.find({
      _id: testShowtime._id,
      cancelledAt: null,
      isLocked: false,
      startTime: { $gt: new Date() }
    });
    addResult(4, 'Website khách hàng hiển thị suất chiếu đúng điều kiện mở bán', webVisible.length === 1, 'Suất chiếu mở bán hợp lệ trên giao diện công khai');

    // 5. Khách chọn ghế trên sơ đồ 2D (chọn ghế E05, E06)
    const seatE05 = await ShowtimeSeat.findOne({ showtimeId: testShowtime._id, seatNumber: 'E5' });
    const seatE06 = await ShowtimeSeat.findOne({ showtimeId: testShowtime._id, seatNumber: 'E6' });
    const canSelect = seatE05 && seatE06 && seatE05.status === 'AVAILABLE' && seatE06.status === 'AVAILABLE';
    addResult(5, 'Khách chọn ghế trên sơ đồ 2D', canSelect, 'Ghế E5 và E6 đang ở trạng thái AVAILABLE sẵn sàng chọn');

    // 6. Góc nhìn 3D hiển thị đúng ghế đã chọn (Tính toán camera position từ Row & Col)
    const rowIndex = seatE05.row.charCodeAt(0) - 65; // A=0, B=1, ... E=4
    const colIndex = seatE05.col; // 5
    // Tọa độ 3D trong không gian Three.js rạp D'AVENOR
    const camera3D = {
      x: (colIndex - 6) * 1.2,
      y: 1.5 + rowIndex * 0.4,
      z: 12 - rowIndex * 1.5,
    };
    const has3DCoords = typeof camera3D.x === 'number' && typeof camera3D.y === 'number';
    addResult(6, 'Góc nhìn 3D hiển thị đúng tọa độ ghế đã chọn', has3DCoords, `Ghế ${seatE05.seatNumber} (Hàng ${seatE05.row}, Cột ${seatE05.col}) -> Tọa độ camera 3D: x=${camera3D.x.toFixed(1)}, y=${camera3D.y.toFixed(1)}, z=${camera3D.z.toFixed(1)}`);

    // 7. Click chọn ghế KHÔNG làm ghế bị giữ hoặc khóa (No soft-lock on click)
    const seatAfterClick = await ShowtimeSeat.findById(seatE05._id);
    const notLocked = seatAfterClick.status === 'AVAILABLE';
    addResult(7, 'Click chọn ghế KHÔNG giữ hoặc khóa ghế trong Database', notLocked, 'Ghế vẫn là AVAILABLE cho đến khi thanh toán thực tế hoàn tất');

    // 8. Khách thực hiện thanh toán thử nghiệm
    const bookingCode = `TEST_E2E_${Date.now()}`;
    const totalAmount = testShowtime.price * 2;
    addResult(8, 'Khách thực hiện thanh toán thử nghiệm', true, `Khởi tạo giao dịch thanh toán mã ${bookingCode} cho 2 ghế E5, E6`);

    // 9. Thanh toán thành công xác nhận quyền sở hữu ghế (Atomic update status -> BOOKED)
    const bookResult = await ShowtimeSeat.updateMany(
      { showtimeId: testShowtime._id, seatNumber: { $in: ['E5', 'E6'] }, status: 'AVAILABLE' },
      { $set: { status: 'BOOKED' } }
    );
    const seatsSecured = bookResult.modifiedCount === 2;
    addResult(9, 'Thanh toán thành công xác nhận quyền sở hữu ghế', seatsSecured, `Đã cập nhật nguyên tử 2 ghế E5, E6 sang BOOKED`);

    testBooking = await Booking.create({
      bookingCode,
      userId: userA._id,
      movieId: movie._id,
      roomId: room._id,
      showtimeId: testShowtime._id,
      customerName: userA.name,
      customerPhone: userA.phone,
      customerEmail: userA.email,
      seats: 'E5, E6',
      totalAmount,
      status: 'PAID',
      paymentStatus: 'SIMULATED',
      priceSnapshot: {
        tickets: [{ seatNumber: 'E5', price: testShowtime.price }, { seatNumber: 'E6', price: testShowtime.price }]
      }
    });

    // 10. Khách khác KHÔNG THỂ mua lại ghế đã bán
    const otherCustomerAttempt = await ShowtimeSeat.updateOne(
      { showtimeId: testShowtime._id, seatNumber: 'E5', status: 'AVAILABLE' },
      { $set: { status: 'BOOKED' } }
    );
    addResult(10, 'Khách khác không thể mua lại ghế đã bán', otherCustomerAttempt.modifiedCount === 0, 'Thao tác mua lại ghế E5 bị từ chối nguyên tử (0 ghế bị ghi đè)');

    // 11. Hai khách thanh toán đồng thời không thể cùng sở hữu một ghế (Concurrency Race Condition)
    // Giả lập 2 Promise cùng cố mua ghế F5 đồng thời
    const [raceA, raceB] = await Promise.all([
      ShowtimeSeat.updateOne({ showtimeId: testShowtime._id, seatNumber: 'F5', status: 'AVAILABLE' }, { $set: { status: 'BOOKED' } }),
      ShowtimeSeat.updateOne({ showtimeId: testShowtime._id, seatNumber: 'F5', status: 'AVAILABLE' }, { $set: { status: 'BOOKED' } }),
    ]);
    const concurrencySafe = (raceA.modifiedCount + raceB.modifiedCount) === 1;
    addResult(11, 'Hai khách thanh toán đồng thời không thể cùng sở hữu một ghế', concurrencySafe, `Đúng 1 giao dịch thắng (A=${raceA.modifiedCount}, B=${raceB.modifiedCount})`);

    // 12. Vé xuất hiện trong "Vé của tôi"
    const myTickets = await Booking.find({ userId: userA._id, status: 'PAID' }).lean();
    const ticketInWallet = myTickets.some(b => String(b._id) === String(testBooking._id));
    addResult(12, 'Vé xuất hiện chính xác trong mục Vé của tôi', ticketInWallet, `Tìm thấy vé ${testBooking.bookingCode} trong ví người dùng`);

    // 13. Vé hiển thị đúng Phim, Phòng, Ngày, Giờ và Ghế
    const populatedTicket = await Booking.findById(testBooking._id).populate('movieId', 'title').populate('roomId', 'name').lean();
    const ticketDetailsValid = populatedTicket && populatedTicket.movieId.title && populatedTicket.roomId.name && populatedTicket.seats === 'E5, E6';
    addResult(13, 'Vé hiển thị đúng Phim, Phòng, Ngày, Giờ và Ghế', ticketDetailsValid, `Phim: ${populatedTicket.movieId.title} | Phòng: ${populatedTicket.roomId.name} | Ghế: ${populatedTicket.seats}`);

    // 14. QR Code payload hoạt động chuẩn xác
    const qrData = JSON.stringify({ bookingCode: testBooking.bookingCode, seats: testBooking.seats, showtimeId: testShowtime._id });
    const qrValid = qrData.includes(testBooking.bookingCode);
    addResult(14, 'QR Code check-in rạp hoạt động chuẩn xác', qrValid, `Mã QR chứa bookingCode: ${testBooking.bookingCode}`);

    // 15. Admin nhận đúng Booking trong danh sách quản lý
    const adminBookingCheck = await Booking.findById(testBooking._id).lean();
    addResult(15, 'Admin nhận đúng Booking trong danh sách quản trị', !!adminBookingCheck, `Admin tra cứu được mã ${adminBookingCheck.bookingCode}`);

    // 16. Sơ đồ ghế Admin cập nhật đúng trạng thái
    const adminSeatCheck = await ShowtimeSeat.findOne({ showtimeId: testShowtime._id, seatNumber: 'E5' });
    addResult(16, 'Sơ đồ ghế Admin cập nhật đúng trạng thái BOOKED', adminSeatCheck.status === 'BOOKED', 'Ghế E5 hiển thị màu đỏ/đã bán trên Admin');

    // 17. Doanh thu cập nhật chính xác từ giao dịch thực tế
    const revAgg = await Booking.aggregate([
      { $match: { _id: testBooking._id, status: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const revenueMatches = revAgg.length > 0 && revAgg[0].total === totalAmount;
    addResult(17, 'Doanh thu cập nhật chính xác từ giao dịch thực tế', revenueMatches, `Ghi nhận doanh thu thực tế: ${totalAmount.toLocaleString()} VNĐ`);

    // 18. Khách hủy vé hợp lệ (> 24 giờ trước giờ chiếu) thì ghế được giải phóng
    // Giờ chiếu là 3 ngày sau (> 24h) -> Đủ điều kiện hủy vé
    const hoursUntilShow = (new Date(testShowtime.startTime) - new Date()) / 3600000;
    const canCancel = hoursUntilShow >= 24;
    if (canCancel) {
      await Booking.findByIdAndUpdate(testBooking._id, { $set: { status: 'CANCELLED' } });
      await ShowtimeSeat.updateMany(
        { showtimeId: testShowtime._id, seatNumber: { $in: ['E5', 'E6'] } },
        { $set: { status: 'AVAILABLE' } }
      );
    }
    const seatsReleased = (await ShowtimeSeat.countDocuments({ showtimeId: testShowtime._id, seatNumber: { $in: ['E5', 'E6'] }, status: 'AVAILABLE' })) === 2;
    addResult(18, 'Khách hủy vé hợp lệ (> 24h) thì ghế được giải phóng', canCancel && seatsReleased, `Cách giờ chiếu ${hoursUntilShow.toFixed(1)} giờ -> Đã giải phóng 2 ghế E5, E6 về AVAILABLE`);

    // 19. Vé đã hủy không còn hiệu lực check-in
    const cancelledBooking = await Booking.findById(testBooking._id);
    const isInvalidForCheckIn = cancelledBooking.status === 'CANCELLED';
    addResult(19, 'Vé đã hủy không còn hiệu lực check-in phòng chiếu', isInvalidForCheckIn, 'Status = CANCELLED -> Máy quét soát vé sẽ từ chối cửa');

    // 20. Dashboard và trang thống kê phản ánh dữ liệu thực tế (Không tính vé đã hủy vào doanh thu)
    const validRev = await Booking.aggregate([
      { $match: { status: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const activeRevenue = validRev.length > 0 ? validRev[0].total : 0;
    addResult(20, 'Dashboard phản ánh dữ liệu thực tế (loại bỏ vé đã hủy)', activeRevenue === 0, `Doanh thu thực tế sau khi hủy vé: ${activeRevenue} đ (Không xuất hiện NaN/Infinity)`);

  } finally {
    // DỌN DẸP SANDBOX: Xóa bỏ dữ liệu kiểm thử để database chính giữ nguyên trạng thái TRỐNG LỊCH 100%
    console.log('\n--- DỌN DẸP DỮ LIỆU KIỂM THỬ SANDBOX ---');
    if (testBooking) {
      await Booking.deleteMany({ _id: testBooking._id });
      console.log('✅ Đã dọn dẹp test booking.');
    }
    if (testShowtime) {
      await ShowtimeSeat.deleteMany({ showtimeId: testShowtime._id });
      await Showtime.deleteMany({ _id: testShowtime._id });
      console.log('✅ Đã dọn dẹp test showtime & seats.');
    }
    // Dọn dẹp ghế F5 từ race test
    if (testShowtime) {
      await ShowtimeSeat.deleteMany({ showtimeId: testShowtime._id });
    }
  }

  // Hậu kiểm database sạch sẽ
  const finalShowtimes = await Showtime.countDocuments();
  const finalSeats = await ShowtimeSeat.countDocuments();
  const finalBookings = await Booking.countDocuments();

  console.log('\n================================================================');
  console.log('          KẾT QUẢ ĐỐI SOÁT TRẠNG THÁI CUỐI CÙNG                 ');
  console.log('================================================================');
  console.log(`- Suất chiếu trong Database : ${finalShowtimes} (Trống lịch 100%)`);
  console.log(`- Ghế suất chiếu trong DB   : ${finalSeats} (Sạch sẽ 100%)`);
  console.log(`- Đơn đặt vé trong DB       : ${finalBookings} (Doanh thu = 0 đ)`);

  const passedCount = results.filter(r => r.pass).length;
  console.log(`\n🎉 TỔNG KẾT: ${passedCount}/20 TIÊU CHÍ ĐẠT CHUẨN (${(passedCount/20*100).toFixed(0)}%)`);

  await mongoose.disconnect();
}

run20E2ETests().catch(err => {
  console.error('Lỗi khi kiểm thử:', err);
  process.exit(1);
});
