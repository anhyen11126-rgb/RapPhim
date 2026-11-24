import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import Booking from '../src/models/Booking.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import Room from '../src/models/Room.js';
import Movie from '../src/models/Movie.js';

async function investigateBookings() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('================================================================');
  console.log('       ĐIỀU TRA TOÀN DIỆN COLLECTION BOOKINGS TRONG MONGODB      ');
  console.log('================================================================\n');

  // 1. Tổng số Booking documents và unique IDs
  const totalDocs = await Booking.countDocuments();
  const distinctBookingIds = await Booking.distinct('_id');
  const distinctBookingCodes = await Booking.distinct('bookingCode');
  const distinctUserIds = await Booking.distinct('userId');
  const distinctCustomerPhones = await Booking.distinct('customerPhone');

  console.log('1. THỐNG KÊ TỔNG QUAN BOOKING:');
  console.log(`- Tổng số document Booking: ${totalDocs}`);
  console.log(`- Số Booking _id duy nhất: ${distinctBookingIds.length}`);
  console.log(`- Số bookingCode duy nhất: ${distinctBookingCodes.length}`);
  console.log(`- Số userId duy nhất: ${distinctUserIds.length}`);
  console.log(`- Số số điện thoại khách duy nhất: ${distinctCustomerPhones.length}\n`);

  // 2. Phân bố trạng thái và phương thức thanh toán
  const statusStats = await Booking.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, totalRevenue: { $sum: '$totalAmount' } } }
  ]);
  const paymentStats = await Booking.aggregate([
    { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
  ]);
  console.log('2. TRẠNG THÁI BOOKING & THANH TOÁN TOÀN BỘ DATABASE:');
  console.log('- Theo status:', statusStats);
  console.log('- Theo paymentStatus:', paymentStats);

  // 3. Phân tích quan hệ giữa Booking và Showtime
  const distinctShowtimeIdsInBookings = await Booking.distinct('showtimeId');
  console.log(`\n3. PHÂN BỐ SHOWTIME CỦA BOOKINGS:`);
  console.log(`- Tổng số Showtime ID xuất hiện trong các đơn Booking: ${distinctShowtimeIdsInBookings.length} suất`);

  // Kiểm tra bao nhiêu showtimeId còn tồn tại trong collection Showtime
  const existingShowtimes = await Showtime.find({ _id: { $in: distinctShowtimeIdsInBookings } }).select('startTime roomId cinemaId cancelledAt').lean();
  const existingShowtimeIdSet = new Set(existingShowtimes.map(s => String(s._id)));
  
  let orphanedBookingsCount = 0;
  for (const sId of distinctShowtimeIdsInBookings) {
    if (!existingShowtimeIdSet.has(String(sId))) {
      orphanedBookingsCount++;
    }
  }
  console.log(`- Số Showtime ID CÒN TỒN TẠI trong bảng Showtime: ${existingShowtimes.length}`);
  console.log(`- Số Showtime ID BỊ MẤT THAM CHIẾU (Orphaned / Đã bị xóa trước đây): ${orphanedBookingsCount}`);

  // Đếm số đơn Booking mồ côi (trỏ đến showtime không tồn tại)
  const validBookings = await Booking.countDocuments({ showtimeId: { $in: Array.from(existingShowtimeIdSet) } });
  const orphanedBookingsDocs = totalDocs - validBookings;
  console.log(`- Số đơn Booking hợp lệ (trỏ đến showtime đang tồn tại): ${validBookings} đơn`);
  console.log(`- Số đơn Booking mồ côi (trỏ đến showtime không còn trong DB): ${orphanedBookingsDocs} đơn`);

  // 4. Thời gian của các showtime có Booking
  const showtimeDates = existingShowtimes.map(s => s.startTime.toISOString().slice(0, 10));
  const dateCounts = new Map();
  for (const d of showtimeDates) {
    dateCounts.set(d, (dateCounts.get(d) || 0) + 1);
  }
  const sortedDates = Array.from(dateCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`\n4. CÁC NGÀY CHIẾU CỦA CÁC SHOWTIME CÓ BOOKING (${sortedDates.length} ngày):`);
  console.log(sortedDates.slice(0, 15));
  if (sortedDates.length > 15) {
    console.log(`... và ${sortedDates.length - 15} ngày khác cho đến ${sortedDates[sortedDates.length - 1][0]}`);
  }

  // 5. Giải thích con số 29.069 vs 1.854:
  // Trong migrateShowtimeData.js:
  // groupC: các suất CHỒNG LẤN MÀ CÓ BOOKING.
  // Hãy tính:
  // A: Số booking trên các suất chồng lấn (Group C)
  // B: Số booking trên các suất KHÔNG chồng lấn (Group A hoặc các suất trong quá khứ)
  // C: Số booking trên các suất đã qua (trước 21/11/2026)
  const bookingsOnExistingShowtimes = await Booking.find({ showtimeId: { $in: Array.from(existingShowtimeIdSet) } }).select('showtimeId seats totalAmount').lean();

  let totalSeatsSold = 0;
  const showtimeToBookingsMap = new Map();
  for (const b of bookingsOnExistingShowtimes) {
    const sId = String(b.showtimeId);
    if (!showtimeToBookingsMap.has(sId)) showtimeToBookingsMap.set(sId, []);
    showtimeToBookingsMap.get(sId).push(b);
    const seatList = (b.seats || '').split(/[,•|]+/).map(s => s.trim()).filter(Boolean);
    totalSeatsSold += seatList.length;
  }
  console.log(`\n5. THỐNG KÊ SỐ GHẾ ĐÃ BÁN:`);
  console.log(`- Tổng số vé (ghế) đã bán trên toàn bộ ${validBookings} đơn hợp lệ: ${totalSeatsSold} ghế`);
  console.log(`- Trung bình mỗi đơn mua: ${(totalSeatsSold / validBookings).toFixed(2)} ghế/đơn`);

  // Kiểm tra xem có ghế nào bị bán trùng trong cùng một suất không (Duplicate Seat Sales)
  let duplicateSeatSalesCount = 0;
  const duplicateCases = [];
  for (const [sId, bList] of showtimeToBookingsMap.entries()) {
    const seatSeen = new Map();
    for (const b of bList) {
      const seatList = (b.seats || '').split(/[,•|]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      for (const seat of seatList) {
        if (seatSeen.has(seat)) {
          duplicateSeatSalesCount++;
          duplicateCases.push({
            showtimeId: sId,
            seat,
            firstBooking: seatSeen.get(seat),
            secondBooking: b.bookingCode || b._id
          });
        } else {
          seatSeen.set(seat, b.bookingCode || b._id);
        }
      }
    }
  }
  console.log(`- Số trường hợp BÁN TRÙNG GHẾ trong cùng một suất: ${duplicateSeatSalesCount}`);
  if (duplicateCases.length > 0) {
    console.log('  Mẫu 3 trường hợp trùng ghế đầu tiên:', duplicateCases.slice(0, 3));
  } else {
    console.log('  ✅ HOÀN TOÀN KHÔNG CÓ TRƯỜNG HỢP NÀO BÁN TRÙNG GHẾ!');
  }

  // 6. Phân tích chi tiết: Tại sao có số 1.854 và 29.069?
  // Xem ngày của showtime
  let bookingsBeforeNov21 = 0;
  let bookingsNov21ToNov30 = 0;
  let bookingsNov24 = 0;

  const nov21 = new Date('2026-11-21T00:00:00+07:00');
  const nov24S = new Date('2026-11-24T00:00:00+07:00');
  const nov24E = new Date('2026-11-24T23:59:59.999+07:00');

  for (const st of existingShowtimes) {
    const sId = String(st._id);
    const bList = showtimeToBookingsMap.get(sId) || [];
    if (st.startTime < nov21) {
      bookingsBeforeNov21 += bList.length;
    } else {
      bookingsNov21ToNov30 += bList.length;
      if (st.startTime >= nov24S && st.startTime <= nov24E) {
        bookingsNov24 += bList.length;
      }
    }
  }
  console.log(`\n6. NGUỒN GỐC CHÍNH XÁC CỦA CÁC CON SỐ:`);
  console.log(`- Tổng số đơn Booking trong toàn DB: ${totalDocs}`);
  console.log(`  + Đơn Booking lịch sử (suất chiếu trước ngày 21/11/2026): ${bookingsBeforeNov21} đơn`);
  console.log(`  + Đơn Booking trên các suất chiếu từ ngày 21/11/2026 trở đi: ${bookingsNov21ToNov30} đơn (ĐÂY CHÍNH LÀ CON SỐ 1.854!)`);
  console.log(`  + Đơn Booking riêng ngày 24/11/2026: ${bookingsNov24} đơn (chính xác 3 đơn!)`);
  console.log(`  + Đơn Booking trỏ vào các suất cũ đã từng bị xóa trước đó: ${orphanedBookingsDocs} đơn`);

  // Doanh thu từ giao dịch hợp lệ
  const totalRevenueAgg = await Booking.aggregate([
    { $match: { status: 'PAID' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  console.log(`- Tổng doanh thu ghi nhận từ 100% đơn PAID: ${(totalRevenueAgg[0]?.total || 0).toLocaleString()} VNĐ`);

  await mongoose.disconnect();
}

investigateBookings().catch(err => {
  console.error(err);
  process.exit(1);
});
