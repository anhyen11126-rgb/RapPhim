import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import Showtime from '../src/models/Showtime.js';
import Booking from '../src/models/Booking.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import Room from '../src/models/Room.js';
import Movie from '../src/models/Movie.js';

async function verifyScope() {
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('================================================================');
  console.log('   XÁC MINH TRỰC TIẾP TOÀN BỘ SỐ LIỆU THEO PHẠM VI CHÍNH XÁC   ');
  console.log('================================================================\n');

  // Khung thời gian ngày 24/11/2026 (Asia/Ho_Chi_Minh: UTC+7)
  // Ngày 24/11/2026 bắt đầu từ 2026-11-23T17:00:00.000Z đến 2026-11-24T16:59:59.999Z
  const dayStart = new Date('2026-11-24T00:00:00+07:00');
  const dayEnd = new Date('2026-11-24T23:59:59.999+07:00');
  const lookbackStart = new Date(dayStart.getTime() - 4 * 3600000); // 20:00 ngày 23/11 UTC+7

  // 1. Phân tích 378 suất đang hiển thị trên Admin ngày 24/11
  // Query hiện tại của Backend adminController.js
  const currentAdminShowtimes = await Showtime.find({
    startTime: { $gte: lookbackStart, $lte: dayEnd },
    cancelledAt: null,
  }).populate('movieId', 'title duration').populate('roomId', 'name roomType').lean();

  console.log(`1. TỔNG SỐ SUẤT QUERY ADMIN TRẢ VỀ: ${currentAdminShowtimes.length} suất`);

  const startedToday = [];
  const startedYesterday = [];
  for (const st of currentAdminShowtimes) {
    if (st.startTime >= dayStart && st.startTime <= dayEnd) {
      startedToday.push(st);
    } else if (st.startTime < dayStart) {
      startedYesterday.push(st);
    }
  }
  console.log(`- Số suất thực sự bắt đầu trong ngày 24/11/2026: ${startedToday.length} suất`);
  console.log(`- Số suất thuộc ngày hôm trước (23/11) kéo sang: ${startedYesterday.length} suất`);

  // Phân tích các suất hôm trước: Có suất nào kết thúc trước 08:00 sáng 24/11 không?
  const timelineStart = new Date('2026-11-24T08:00:00+07:00');
  let endedBefore08 = 0;
  let runningAfter08 = 0;
  for (const st of startedYesterday) {
    const dur = st.movieId?.duration || 120;
    const clean = st.cleaningMinutes || 15;
    const occupiedEnd = st.endTime?.getTime() || (st.startTime.getTime() + (dur + clean) * 60000);
    if (occupiedEnd <= timelineStart.getTime()) {
      endedBefore08++;
    } else {
      runningAfter08++;
    }
  }
  console.log(`  + Trong ${startedYesterday.length} suất đêm hôm trước:`);
  console.log(`    * Đã kết thúc trước 08:00 sáng 24/11: ${endedBefore08} suất (đây chính là nhóm bị lỗi kẹp mốc 08:00)`);
  console.log(`    * Kéo dài qua 08:00 sáng 24/11: ${runningAfter08} suất\n`);

  // 2. Kiểm tra xung đột thực tế trên tập 378 suất
  const byRoom = new Map();
  for (const st of currentAdminShowtimes) {
    const rId = String(st.roomId?._id || st.roomId || st.roomName);
    if (!byRoom.has(rId)) byRoom.set(rId, []);
    byRoom.get(rId).push(st);
  }

  let overlapShowtimesNov24 = new Set();
  let overlapPairsNov24 = 0;
  for (const [rId, list] of byRoom.entries()) {
    list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const aDur = a.movieId?.duration || 120;
      const aClean = a.cleaningMinutes || 15;
      const aEnd = a.endTime?.getTime() || (a.startTime.getTime() + aDur * 60000);
      const aOccupied = aEnd + aClean * 60000;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.startTime.getTime() >= aOccupied) break;
        overlapPairsNov24++;
        overlapShowtimesNov24.add(String(a._id));
        overlapShowtimesNov24.add(String(b._id));
      }
    }
  }
  console.log(`2. KIỂM TRA CHỒNG LẤN TRONG NGÀY 24/11:`);
  console.log(`- Số cặp chồng lấn thời gian (+15p dọn): ${overlapPairsNov24} cặp`);
  console.log(`- Số suất chiếu bị ảnh hưởng bởi chồng lấn: ${overlapShowtimesNov24.size} / ${currentAdminShowtimes.length} suất\n`);

  // 3. Xác minh số suất thiếu ShowtimeSeat
  const currentIds = currentAdminShowtimes.map(s => s._id);
  const seatsCountPerShowtime = await ShowtimeSeat.aggregate([
    { $match: { showtimeId: { $in: currentIds } } },
    { $group: { _id: '$showtimeId', count: { $sum: 1 } } }
  ]);
  const seatMap = new Map(seatsCountPerShowtime.map(s => [String(s._id), s.count]));

  let zeroSeatsNov24 = 0;
  let partialSeatsNov24 = 0;
  let fullSeatsNov24 = 0;
  for (const id of currentIds) {
    const count = seatMap.get(String(id)) || 0;
    if (count === 0) zeroSeatsNov24++;
    else if (count === 88) fullSeatsNov24++;
    else partialSeatsNov24++;
  }
  console.log(`3. TÌNH TRẠNG SHOWTIMESEAT RIÊNG TRONG NGÀY 24/11:`);
  console.log(`- Số suất có đủ 88 ghế: ${fullSeatsNov24} suất`);
  console.log(`- Số suất hoàn toàn không có ghế (0 ghế): ${zeroSeatsNov24} suất (chính xác con số ~306 suất!)`);
  console.log(`- Số suất có số ghế bất thường (!= 88): ${partialSeatsNov24} suất\n`);

  // Toàn bộ database để phân biệt
  const totalShowtimesInDb = await Showtime.countDocuments();
  const showtimesWithSeats = await ShowtimeSeat.distinct('showtimeId');
  const showtimesWithoutSeatsDb = await Showtime.countDocuments({
    _id: { $nin: showtimesWithSeats },
    cancelledAt: null
  });
  console.log(`TỔNG THỂ TOÀN BỘ DATABASE ĐỂ ĐỐI CHIẾU:`);
  console.log(`- Tổng số suất chiếu toàn database: ${totalShowtimesInDb} suất`);
  console.log(`- Tổng số suất thiếu ghế toàn database: ${showtimesWithoutSeatsDb} suất\n`);

  // 4. Xác minh Booking: Toàn database vs Riêng ngày 24/11
  const allBookingsCount = await Booking.countDocuments();
  const bookingsNov24 = await Booking.find({ showtimeId: { $in: currentIds } }).lean();

  console.log(`4. XÁC MINH SỐ LƯỢNG BOOKING:`);
  console.log(`- Tổng số đơn Booking trong TOÀN BỘ HỆ THỐNG: ${allBookingsCount} đơn`);
  console.log(`- Tổng số đơn Booking RIÊNG TRÊN CÁC SUẤT NGÀY 24/11: ${bookingsNov24.length} đơn`);

  // Phân loại trạng thái Booking trên ngày 24/11
  const statsNov24 = { PAID: 0, PENDING: 0, CANCELLED: 0, EXCHANGED: 0 };
  const paymentStatsNov24 = { VERIFIED: 0, SIMULATED: 0, PENDING: 0, FAILED: 0, LEGACY_UNVERIFIED: 0 };
  for (const b of bookingsNov24) {
    statsNov24[b.status] = (statsNov24[b.status] || 0) + 1;
    paymentStatsNov24[b.paymentStatus] = (paymentStatsNov24[b.paymentStatus] || 0) + 1;
  }
  console.log(`  + Trạng thái đơn Booking ngày 24/11:`, statsNov24);
  console.log(`  + Trạng thái thanh toán Booking ngày 24/11:`, paymentStatsNov24);

  // Phân loại trạng thái Booking toàn database
  const allStatusStats = await Booking.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const allPaymentStats = await Booking.aggregate([
    { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
  ]);
  console.log(`\n  + Trạng thái đơn Booking TOÀN DATABASE:`, Object.fromEntries(allStatusStats.map(s => [s._id, s.count])));
  console.log(`  + Trạng thái thanh toán TOÀN DATABASE:`, Object.fromEntries(allPaymentStats.map(s => [s._id, s.count])));

  // 5. Kiểm tra trường hợp 2 suất cùng phòng chồng lấn nhau mà ĐỀU CÓ BOOKING KHÁCH
  const bookedShowtimeIds = new Set(bookingsNov24.map(b => String(b.showtimeId)));
  console.log(`\n5. KIỂM TRA XUNG ĐỘNG CÙNG CÓ BOOKING KHÁCH TRÊN NGÀY 24/11:`);
  console.log(`- Số suất có booking trên ngày 24/11: ${bookedShowtimeIds.size} suất`);

  let conflictBetweenTwoBookedShowtimes = [];
  const bookedShowtimeList = currentAdminShowtimes.filter(s => bookedShowtimeIds.has(String(s._id)));
  for (let i = 0; i < bookedShowtimeList.length; i++) {
    for (let j = i + 1; j < bookedShowtimeList.length; j++) {
      const a = bookedShowtimeList[i];
      const b = bookedShowtimeList[j];
      const sameRoom = String(a.roomId?._id || a.roomId) === String(b.roomId?._id || b.roomId);
      if (sameRoom) {
        const aDur = a.movieId?.duration || 120;
        const aClean = a.cleaningMinutes || 15;
        const aEnd = a.endTime?.getTime() || (a.startTime.getTime() + aDur * 60000);
        const aOccupied = aEnd + aClean * 60000;
        const bDur = b.movieId?.duration || 120;
        const bClean = b.cleaningMinutes || 15;
        const bEnd = b.endTime?.getTime() || (b.startTime.getTime() + bDur * 60000);
        const bOccupied = bEnd + bClean * 60000;

        const overlaps = a.startTime.getTime() < bOccupied && aOccupied > b.startTime.getTime();
        if (overlaps) {
          conflictBetweenTwoBookedShowtimes.push({ aId: a._id, bId: b._id, room: a.roomId?.name || a.roomName });
        }
      }
    }
  }
  console.log(`- Số cặp suất cùng phòng, chồng lấn thời gian MÀ ĐỀU CÓ KHÁCH ĐẶT VÉ: ${conflictBetweenTwoBookedShowtimes.length} cặp`);
  if (conflictBetweenTwoBookedShowtimes.length > 0) {
    console.log('  ⚠️ Cần đưa vào danh sách đối soát thủ công:', conflictBetweenTwoBookedShowtimes);
  } else {
    console.log('  ✅ 100% các suất có Booking trên ngày 24/11 KHÔNG va chạm nhau!');
  }

  await mongoose.disconnect();
}

verifyScope().catch(err => {
  console.error(err);
  process.exit(1);
});
