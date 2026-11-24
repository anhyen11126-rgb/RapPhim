import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import Showtime from '../src/models/Showtime.js';
import Booking from '../src/models/Booking.js';
import Room from '../src/models/Room.js';
import Movie from '../src/models/Movie.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('--- KẾT QUẢ XÁC MINH 8 ĐIỂM CHƯA NHẤT QUÁN ---');

  // 1. Total showtimes & distinct overlapping showtimes
  const showtimes = await Showtime.find({ cancelledAt: null }).populate('movieId', 'duration').lean();
  console.log('Tổng số suất chiếu chưa hủy (cancelledAt: null):', showtimes.length);

  // Group by room
  const byRoom = new Map();
  for (const st of showtimes) {
    const rId = String(st.roomId || st.cinemaId + '/' + st.roomName);
    if (!byRoom.has(rId)) byRoom.set(rId, []);
    byRoom.get(rId).push(st);
  }

  let overlapPairsCount = 0;
  const overlappingShowtimeIds = new Set();
  const overlapDetails = [];

  for (const [rId, list] of byRoom.entries()) {
    list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const aDur = Number(a.movieId?.duration) || 120;
      const aEnd = a.endTime?.getTime() || (a.startTime.getTime() + aDur * 60000);
      const aBlockedUntil = aEnd + (a.cleaningMinutes || 15) * 60000;

      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.startTime.getTime() >= aBlockedUntil) break;
        // Overlap!
        overlapPairsCount++;
        overlappingShowtimeIds.add(String(a._id));
        overlappingShowtimeIds.add(String(b._id));
        if (overlapDetails.length < 5) {
          overlapDetails.push({
            room: a.roomName,
            aId: a._id,
            aStart: a.startTime.toISOString(),
            bId: b._id,
            bStart: b.startTime.toISOString(),
          });
        }
      }
    }
  }

  console.log('Số cặp chồng lấn (Overlap Pairs):', overlapPairsCount);
  console.log('Số suất chiếu riêng biệt thuộc các cặp chồng lấn:', overlappingShowtimeIds.size);
  console.log('Mẫu 5 cặp chồng lấn đầu tiên:', overlapDetails);

  // 2. Kiểm tra Bookings trên các suất chồng lấn
  const allBookings = await Booking.find().lean();
  console.log('Tổng số Booking trong toàn hệ thống:', allBookings.length);
  const bookingsOnOverlaps = await Booking.find({
    showtimeId: { $in: Array.from(overlappingShowtimeIds) }
  }).lean();
  console.log('Số Booking trên các suất chồng lấn:', bookingsOnOverlaps.length);
  const paidBookingsOnOverlaps = bookingsOnOverlaps.filter(b => b.status === 'PAID');
  console.log('Số Booking PAID trên các suất chồng lấn:', paidBookingsOnOverlaps.length);
  if (bookingsOnOverlaps.length > 0) {
    console.log('Chi tiết Booking trên suất chồng lấn:', bookingsOnOverlaps.map(b => ({
      id: b._id,
      code: b.bookingCode,
      showtimeId: b.showtimeId,
      status: b.status,
      seats: b.seats,
      amount: b.totalAmount,
    })));
  }

  // 3. Phân bổ ShowtimeSeat
  const seatCounts = await ShowtimeSeat.aggregate([
    { $group: { _id: '$showtimeId', count: { $sum: 1 } } }
  ]);
  const showtimeWithSeatsMap = new Map(seatCounts.map(s => [String(s._id), s.count]));
  const showtimeMissingSeats = showtimes.filter(st => !showtimeWithSeatsMap.has(String(st._id)));
  const showtimePartialSeats = showtimes.filter(st => {
    const c = showtimeWithSeatsMap.get(String(st._id));
    return c && c !== 88;
  });
  console.log('Số suất có đúng 88 ghế:', showtimes.filter(st => showtimeWithSeatsMap.get(String(st._id)) === 88).length);
  console.log('Số suất thiếu TOÀN BỘ ghế (0 ghế):', showtimeMissingSeats.length);
  console.log('Số suất thiếu MỘT PHẦN ghế (!= 88):', showPartialSeatsInfo(showtimePartialSeats, showtimeWithSeatsMap));

  function showPartialSeatsInfo(partials, map) {
    if (partials.length === 0) return 0;
    return partials.map(p => ({ id: p._id, count: map.get(String(p._id)) }));
  }

  // 4. Kiểm tra cấu hình ghế Room
  const rooms = await Room.find().lean();
  console.log('\nDanh sách 9 phòng vật lý:');
  for (const r of rooms) {
    const templates = await ShowtimeSeat.aggregate([
      { $match: { roomId: r._id } },
      { $group: { _id: '$showtimeId', count: { $sum: 1 } } },
    ]);
    const counts = templates.map(t => t.count);
    const showtimesInRoom = showtimes.filter(st => String(st.roomId) === String(r._id));
    console.log(`- Phòng ${r.name} (${r.roomType}): totalSeats=${r.totalSeats}, status=${r.status}, showtimesCount=${showtimesInRoom.length}, templatesCount=[${counts.slice(0, 3).join(', ')}]`);
  }

  // 5. Kiểm tra movie showtimes DB vs frontend count
  const movies = await Movie.find().lean();
  console.log('\nThống kê số suất theo phim:');
  for (const m of movies) {
    const rawCount = await Showtime.countDocuments({ movieId: m._id, cancelledAt: null });
    const futureCount = await Showtime.countDocuments({ movieId: m._id, cancelledAt: null, startTime: { $gte: new Date() } });
    console.log(`- Phim "${m.title}": Tổng suất=${rawCount}, Suất tương lai=${futureCount}, techFormat=${m.techFormat}, formats=${m.formats}, rating=${m.rating}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
