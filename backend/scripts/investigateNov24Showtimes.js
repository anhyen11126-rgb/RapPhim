import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import Showtime from '../src/models/Showtime.js';
import Booking from '../src/models/Booking.js';
import Room from '../src/models/Room.js';
import Movie from '../src/models/Movie.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';

async function investigate() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('================================================================');
  console.log('       ĐIỀU TRA CHI TIẾT DỮ LIỆU NGÀY 24/11/2026 TRONG MONGODB    ');
  console.log('================================================================\n');

  // Múi giờ Asia/Ho_Chi_Minh: Ngày 2026-11-24 bắt đầu từ 2026-11-24T00:00:00+07:00 (17:00:00Z ngày 23/11)
  // và kết thúc lúc 2026-11-24T23:59:59.999+07:00 (16:59:59.999Z ngày 24/11)
  const dayStartUTC = new Date('2026-11-24T00:00:00+07:00');
  const dayEndUTC = new Date('2026-11-24T23:59:59.999+07:00');
  const lookbackStartUTC = new Date(dayStartUTC.getTime() - 4 * 3600000);

  console.log('Phạm vi ngày 24/11/2026 (Asia/Ho_Chi_Minh):');
  console.log(`- Start: ${dayStartUTC.toISOString()}`);
  console.log(`- End:   ${dayEndUTC.toISOString()}`);
  console.log(`- Lookback Start (-4h): ${lookbackStartUTC.toISOString()}\n`);

  // 1. Tất cả document trong khoảng lookbackStart -> dayEnd (giống query của backend getAdminShowtimes)
  const queryShowtimes = await Showtime.find({
    startTime: { $gte: lookbackStartUTC, $lte: dayEndUTC },
    cancelledAt: null,
  }).populate('movieId', 'title duration').populate('roomId', 'name roomType').lean();

  console.log(`1. SỐ LƯỢNG TRUY VẤN TỪ QUERY BACKEND: ${queryShowtimes.length} suất`);

  // Phân loại: bắt đầu đúng trong ngày 24/11 vs bắt đầu trước 00:00 ngày 24/11
  const startedOnDay = queryShowtimes.filter(s => s.startTime >= dayStartUTC && s.startTime <= dayEndUTC);
  const startedPriorDay = queryShowtimes.filter(s => s.startTime < dayStartUTC);
  console.log(`- Bắt đầu thực sự trong ngày 24/11: ${startedOnDay.length} suất`);
  console.log(`- Bắt đầu từ tối 23/11 kéo dài sang: ${startedPriorDay.length} suất`);

  // Phân bổ theo phòng
  const byRoom = new Map();
  for (const st of queryShowtimes) {
    const rName = st.roomId?.name || st.roomName || 'Không xác định';
    if (!byRoom.has(rName)) byRoom.set(rName, []);
    byRoom.get(rName).push(st);
  }

  console.log('\n2. PHÂN BỔ SUẤT CHIẾU THEO TỪNG PHÒNG VẬT LÝ TRONG NGÀY 24/11:');
  for (const [rName, list] of byRoom.entries()) {
    console.log(`- ${rName}: ${list.length} suất`);
  }

  // Kiểm tra trùng lặp EXACT: Cùng phòng, Cùng phim, Cùng startTime
  const exactDuplicates = new Map();
  for (const st of queryShowtimes) {
    const key = `${st.roomId?._id || st.roomName}|${st.movieId?._id || st.movieId}|${st.startTime.toISOString()}`;
    if (!exactDuplicates.has(key)) exactDuplicates.set(key, []);
    exactDuplicates.get(key).push(st);
  }

  let exactDupCount = 0;
  for (const [key, group] of exactDuplicates.entries()) {
    if (group.length > 1) {
      exactDupCount += (group.length - 1);
    }
  }
  console.log(`\n3. SỐ SUẤT TRÙNG HOÀN TOÀN (Cùng phòng, Cùng phim, Cùng startTime): ${exactDupCount} suất thừa`);

  // Kiểm tra va chạm khoảng thời gian (Overlaps)
  let overlapPairsCount = 0;
  const overlappingShowtimeIds = new Set();
  for (const [, list] of byRoom.entries()) {
    list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const aDur = Number(a.movieId?.duration) || 120;
      const aEnd = a.endTime ? a.endTime.getTime() : a.startTime.getTime() + aDur * 60000;
      const aClean = (a.cleaningMinutes ?? 15) * 60000;
      const aBlockedUntil = aEnd + aClean;

      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.startTime.getTime() >= aBlockedUntil) break;
        overlapPairsCount++;
        overlappingShowtimeIds.add(String(a._id));
        overlappingShowtimeIds.add(String(b._id));
      }
    }
  }
  console.log(`4. SỐ CẶP CHỒNG LẤN THỜI GIAN: ${overlapPairsCount} cặp`);
  console.log(`- Số suất riêng biệt bị chồng lấn: ${overlappingShowtimeIds.size} / ${queryShowtimes.length} suất`);

  // Kiểm tra Booking và Ghế của ngày 24/11
  const showtimeIdsNov24 = queryShowtimes.map(s => s._id);
  const [bookingsNov24, seatCountsNov24] = await Promise.all([
    Booking.find({ showtimeId: { $in: showtimeIdsNov24 } }).lean(),
    ShowtimeSeat.aggregate([
      { $match: { showtimeId: { $in: showtimeIdsNov24 } } },
      { $group: { _id: '$showtimeId', count: { $sum: 1 } } },
    ]),
  ]);

  const seatCountMap = new Map(seatCountsNov24.map(s => [String(s._id), s.count]));
  const missingSeatsCount = queryShowtimes.filter(s => !seatCountMap.has(String(s._id))).length;
  const fullSeatsCount = queryShowtimes.filter(s => seatCountMap.get(String(s._id)) === 88).length;

  console.log(`\n5. BOOKING VÀ SHOWTIME SEAT TRONG NGÀY 24/11:`);
  console.log(`- Tổng số Booking gắn với các suất ngày 24/11: ${bookingsNov24.length} đơn`);
  console.log(`- Số suất có đủ 88 ghế: ${fullSeatsCount} suất`);
  console.log(`- Số suất thiếu hoàn toàn ghế (0 ghế): ${missingSeatsCount} suất`);

  // Kiểm tra thời điểm tạo các suất này (createdAt)
  const createdTimes = new Map();
  for (const st of queryShowtimes) {
    const cTime = st.createdAt ? st.createdAt.toISOString().slice(0, 16) : 'Không có';
    createdTimes.set(cTime, (createdTimes.get(cTime) || 0) + 1);
  }
  console.log('\n6. NGUỒN GỐC THỜI ĐIỂM TẠO CÁC SUẤT NGÀY 24/11 (createdAt):');
  for (const [t, count] of createdTimes.entries()) {
    console.log(`- Lúc ${t}: sinh ra ${count} suất`);
  }

  await mongoose.disconnect();
}

investigate().catch(console.error);
