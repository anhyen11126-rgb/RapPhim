import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import Showtime from '../src/models/Showtime.js';
import Booking from '../src/models/Booking.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import Room from '../src/models/Room.js';
import Movie from '../src/models/Movie.js';

async function audit194Showtimes() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('================================================================');
  console.log('   KIỂM TRA CHUYÊN SÂU 194 SUẤT CHIẾU CÓ KHÁCH MUA VÉ (NHÓM C)   ');
  console.log('================================================================\n');

  // Lấy danh sách 194 showtimeId có booking
  const distinctShowtimesInBookings = await Booking.distinct('showtimeId');
  const bookedShowtimes = await Showtime.find({ _id: { $in: distinctShowtimesInBookings } })
    .populate('movieId', 'title duration').populate('roomId', 'name roomType totalSeats').lean();

  console.log(`1. Tổng số suất chiếu có Booking: ${bookedShowtimes.length} suất`);

  // A. Kiểm tra va chạm giữa các suất chiếu có vé trong cùng phòng
  const byRoom = new Map();
  for (const st of bookedShowtimes) {
    const rId = String(st.roomId?._id || st.roomId);
    if (!byRoom.has(rId)) byRoom.set(rId, []);
    byRoom.get(rId).push(st);
  }

  let overlapPairsCount = 0;
  const overlappingPairs = [];
  for (const [rId, list] of byRoom.entries()) {
    list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const aDur = a.movieId?.duration || 120;
      const aClean = (a.cleaningMinutes ?? 15) * 60000;
      const aOccupied = (a.endTime ? new Date(a.endTime).getTime() : a.startTime.getTime() + aDur * 60000) + aClean;

      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.startTime.getTime() >= aOccupied) break;
        overlapPairsCount++;
        overlappingPairs.push({ aId: a._id, bId: b._id, room: a.roomId?.name, timeA: a.startTime, timeB: b.startTime });
      }
    }
  }

  console.log(`2. KIỂM TRA CHỒNG LẤN GIỮA CÁC SUẤT CÓ BOOKING (+15p dọn):`);
  console.log(`- Số cặp va chạm: ${overlapPairsCount} cặp`);
  if (overlapPairsCount > 0) {
    console.log('  ⚠️ CÁC CẶP CÓ VÉ BỊ CHỒNG LẤN CẦN ADMIN XỬ LÝ THỦ CÔNG:');
    overlappingPairs.slice(0, 10).forEach((p, idx) => {
      console.log(`  [${idx+1}] Phòng: ${p.room} | Suất A: ${p.aId} (${p.timeA.toISOString()}) vs Suất B: ${p.bId} (${p.timeB.toISOString()})`);
    });
  } else {
    console.log('  ✅ 100% các suất có vé khách hàng KHÔNG HỀ va chạm nhau!');
  }

  // B. Kiểm tra tính toàn vẹn ghế và Booking
  const allBookingsOnThese = await Booking.find({ showtimeId: { $in: bookedShowtimes.map(s => s._id) } }).lean();
  console.log(`\n3. ĐỐI SOÁT VÉ VÀ GHẾ TRÊN ${allBookingsOnThese.length} ĐƠN HÀNG:`);

  let duplicateSeatCount = 0;
  const bookingsBySt = new Map();
  for (const b of allBookingsOnThese) {
    const sId = String(b.showtimeId);
    if (!bookingsBySt.has(sId)) bookingsBySt.set(sId, []);
    bookingsBySt.get(sId).push(b);
  }

  for (const [sId, bList] of bookingsBySt.entries()) {
    const seatsSoldInShowtime = new Set();
    for (const b of bList) {
      const seats = (b.seats || '').split(/[,•|]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      for (const s of seats) {
        if (seatsSoldInShowtime.has(s)) {
          duplicateSeatCount++;
        }
        seatsSoldInShowtime.add(s);
      }
    }
  }
  console.log(`- Số trường hợp bán trùng ghế (cùng 1 ghế bán cho 2 khách): ${duplicateSeatCount}`);

  // C. Kiểm tra số suất thiếu ShowtimeSeat trong 194 suất này
  const stIds = bookedShowtimes.map(s => s._id);
  const seatsAgg = await ShowtimeSeat.aggregate([
    { $match: { showtimeId: { $in: stIds } } },
    { $group: { _id: '$showtimeId', count: { $sum: 1 } } }
  ]);
  const seatMap = new Map(seatsAgg.map(s => [String(s._id), s.count]));

  let showtimesWith0Seats = 0;
  let showtimesWith88Seats = 0;
  let showtimesWithOtherSeats = 0;
  for (const st of bookedShowtimes) {
    const cnt = seatMap.get(String(st._id)) || 0;
    if (cnt === 0) showtimesWith0Seats++;
    else if (cnt === 88) showtimesWith88Seats++;
    else showtimesWithOtherSeats++;
  }
  console.log(`\n4. TÌNH TRẠNG SHOWTIMESEAT TRÊN 194 SUẤT CÓ BOOKING:`);
  console.log(`- Suất có đủ 88 ghế: ${showtimesWith88Seats}`);
  console.log(`- Suất có 0 ghế: ${showtimesWith0Seats}`);
  console.log(`- Suất có số ghế khác 88: ${showtimesWithOtherSeats}`);

  await mongoose.disconnect();
}

audit194Showtimes().catch(console.error);
