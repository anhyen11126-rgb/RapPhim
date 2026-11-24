import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import Showtime from '../src/models/Showtime.js';
import Booking from '../src/models/Booking.js';
import Room from '../src/models/Room.js';
import Movie from '../src/models/Movie.js';

async function auditNov24() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('================================================================');
  console.log('   ĐỐI SOÁT CHI TIẾT TỪNG SUẤT CHIẾU TRONG NGÀY 24/11/2026      ');
  console.log('================================================================\n');

  // Múi giờ Asia/Ho_Chi_Minh:
  const dayStart = new Date('2026-11-24T00:00:00+07:00');
  const dayEnd = new Date('2026-11-24T23:59:59.999+07:00');
  const timelineStart = new Date('2026-11-24T08:00:00+07:00');
  const timelineEnd = new Date('2026-11-25T02:00:00+07:00');
  const lookbackStart = new Date(dayStart.getTime() - 4 * 3600000); // 20:00 ngày 23/11

  // 1. Toàn bộ showtimes theo query cũ (-4h lookback)
  const queryShowtimes = await Showtime.find({
    startTime: { $gte: lookbackStart, $lte: dayEnd },
    cancelledAt: null
  }).populate('movieId', 'title duration').populate('roomId', 'name roomType').lean();

  console.log(`1. TỔNG SỐ SUẤT TỪ QUERY CŨ (-4h lookback): ${queryShowtimes.length} suất`);

  // Phân bổ theo thời gian bắt đầu
  const priorDayShowtimes = queryShowtimes.filter(s => s.startTime < dayStart);
  const calendarDayShowtimes = queryShowtimes.filter(s => s.startTime >= dayStart && s.startTime <= dayEnd);

  console.log(`- Suất bắt đầu ngày 23/11 (từ 20:00 đến 23:59): ${priorDayShowtimes.length} suất`);
  console.log(`- Suất bắt đầu đúng ngày 24/11 (từ 00:00 đến 23:59): ${calendarDayShowtimes.length} suất`);

  // Kiểm tra từng suất trong 54 suất ngày 23/11 xem occupiedEndTime
  let endedBefore08 = 0;
  let runningIntoTimeline = 0;
  for (const s of priorDayShowtimes) {
    const dur = s.movieId?.duration || 120;
    const clean = s.cleaningMinutes || 15;
    const end = s.endTime ? new Date(s.endTime).getTime() : s.startTime.getTime() + dur * 60000;
    const occupied = end + clean * 60000;
    if (occupied <= timelineStart.getTime()) {
      endedBefore08++;
    } else {
      runningIntoTimeline++;
    }
  }
  console.log(`  + Suất ngày 23/11 đã kết thúc trước 08:00 sáng 24/11: ${endedBefore08} suất`);
  console.log(`  + Suất ngày 23/11 giao nhau với Timeline [08:00 - 02:00]: ${runningIntoTimeline} suất\n`);

  // 2. Phân loại 325 suất bắt đầu ngày 24/11 vào Nhóm A, B, C, D
  const allBookings = await Booking.find().select('showtimeId status seats totalAmount').lean();
  const bookingMap = new Map();
  for (const b of allBookings) {
    const sId = String(b.showtimeId);
    if (!bookingMap.has(sId)) bookingMap.set(sId, []);
    bookingMap.get(sId).push(b);
  }

  // Tìm các suất va chạm trong tập 325 suất
  const byRoom = new Map();
  for (const st of calendarDayShowtimes) {
    const rId = String(st.roomId?._id || st.roomId || st.roomName);
    if (!byRoom.has(rId)) byRoom.set(rId, []);
    byRoom.get(rId).push(st);
  }

  const overlappingIds = new Set();
  for (const [rId, list] of byRoom.entries()) {
    list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const aDur = a.movieId?.duration || 120;
      const aClean = a.cleaningMinutes || 15;
      const aEnd = a.endTime ? new Date(a.endTime).getTime() : a.startTime.getTime() + aDur * 60000;
      const aOccupied = aEnd + aClean * 60000;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.startTime.getTime() >= aOccupied) break;
        overlappingIds.add(String(a._id));
        overlappingIds.add(String(b._id));
      }
    }
  }

  const groupA = [];
  const groupB = [];
  const groupC = [];
  const groupD = [];

  for (const st of calendarDayShowtimes) {
    const sId = String(st._id);
    const bList = bookingMap.get(sId) || [];
    const isOverlap = overlappingIds.has(sId);

    if (!st.movieId || !st.roomId) {
      groupD.push({ st, reason: 'Lỗi tham chiếu movie/room' });
      continue;
    }

    if (bList.length > 0) {
      groupC.push({ st, bookingsCount: bList.length, isOverlap });
    } else if (isOverlap) {
      groupB.push({ st, bookingsCount: 0 });
    } else {
      groupA.push({ st, bookingsCount: 0 });
    }
  }

  console.log(`2. PHÂN LOẠI CHI TIẾT 325 SUẤT BẮT ĐẦU TRONG NGÀY 24/11/2026:`);
  console.log(`- NHÓM A (Hợp lệ, KHÔNG chồng lấn, 0 Booking): ${groupA.length} suất`);
  console.log(`- NHÓM B (Chồng lấn ảo, 0 Booking -> HỦY MỀM): ${groupB.length} suất`);
  console.log(`- NHÓM C (CÓ BOOKING KHÁCH -> BẢO TOÀN): ${groupC.length} suất`);
  console.log(`- NHÓM D (Lỗi tham chiếu): ${groupD.length} suất`);
  console.log(`TỔNG CỘNG: ${groupA.length} + ${groupB.length} + ${groupC.length} + ${groupD.length} = ${groupA.length + groupB.length + groupC.length + groupD.length} suất!`);

  if (groupD.length > 0) {
    console.log('\nChi tiết suất Nhóm D ngày 24/11:');
    groupD.forEach(d => {
      console.log(`- ID: ${d.st._id} | roomName: ${d.st.roomName} | roomId: ${d.st.roomId} | movieId: ${d.st.movieId} | Giờ: ${d.st.startTime.toISOString()}`);
    });
  }

  if (groupA.length > 0) {
    console.log('\nChi tiết suất Nhóm A ngày 24/11:');
    groupA.forEach(a => {
      console.log(`- ID: ${a.st._id} | Phim: ${a.st.movieId?.title} | Phòng: ${a.st.roomId?.name} | Giờ: ${a.st.startTime.toISOString()}`);
    });
  }

  if (groupC.length > 0) {
    console.log('\nChi tiết suất Nhóm C ngày 24/11:');
    groupC.forEach(c => {
      console.log(`- ID: ${c.st._id} | Phim: ${c.st.movieId?.title} | Phòng: ${c.st.roomId?.name} | Giờ: ${c.st.startTime.toISOString()} | Bookings: ${c.bookingsCount}`);
    });
  }

  // 3. Phân biệt theo các khung thời gian Timeline
  let insideTimeline = 0;
  let overnightNextDay = 0;
  for (const st of calendarDayShowtimes) {
    const dur = st.movieId?.duration || 120;
    const clean = st.cleaningMinutes || 15;
    const end = st.endTime ? new Date(st.endTime).getTime() : st.startTime.getTime() + dur * 60000;
    const occupied = end + clean * 60000;

    const startsInTimeline = st.startTime >= timelineStart && st.startTime < timelineEnd;
    const occupiedInTimeline = st.startTime < timelineEnd && occupied > timelineStart.getTime();
    if (occupiedInTimeline) insideTimeline++;
    if (occupied > dayEnd.getTime()) overnightNextDay++;
  }
  console.log(`\n3. THỐNG KÊ THEO KHUNG TIMELINE [08:00 NGÀY 24/11 -> 02:00 NGÀY 25/11]:`);
  console.log(`- Suất có giao nhau với khung Timeline: ${insideTimeline} suất`);
  console.log(`- Suất bắt đầu ngày 24/11 kéo dài qua nửa đêm sang ngày 25/11: ${overnightNextDay} suất`);

  await mongoose.disconnect();
}

auditNov24().catch(err => {
  console.error(err);
  process.exit(1);
});
