/**
 * seedAllDaNangShowtimes.js - Phiên bản chuẩn hóa kiến trúc D'AVENOR CINEMA
 * Sử dụng chung thuật toán điều phối khoa học:
 * - 9 phòng chiếu vật lý lấy trực tiếp từ MongoDB
 * - Kiểm tra va chạm khung giờ (startTime < occupiedEnd && occupiedEndTime > slotStart)
 * - Tự động sinh đầy đủ 88 ghế ShowtimeSeat
 * - Không cho phép tạo lịch rỗng ghế hoặc chồng lấn
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Movie from '../src/models/Movie.js';
import Cinema from '../src/models/Cinema.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import { generateStandard88Seats } from './migrateShowtimeData.js';

export async function seedRollingShowtimes(daysCount = 14, apply = false) {
  await connectDB();
  console.log(`🍃 [MongoDB Atlas] Điều phối lịch chiếu an toàn ${daysCount} ngày tới cho cụm rạp D'AVENOR Thanh Khê (Đà Nẵng)...`);

  const cinema = await Cinema.findOne({ city: 'Đà Nẵng' });
  const movies = await Movie.find({ status: { $ne: 'ENDED' } });
  const physicalRooms = await Room.find({ status: 'ACTIVE' }).sort({ roomNumber: 1 });

  if (!cinema) {
    console.error('❌ Không tìm thấy rạp nào ở Đà Nẵng!');
    return;
  }
  if (movies.length === 0) {
    console.error('❌ Không tìm thấy phim nào trong database!');
    return;
  }
  if (physicalRooms.length === 0) {
    console.error('❌ Không tìm thấy phòng chiếu nào active!');
    return;
  }

  console.log(`📍 Rạp: ${cinema.name} | ${physicalRooms.length} phòng vật lý active | ${movies.length} bộ phim.`);

  // Khung giờ rạp mở cửa chuẩn:
  const standardTimeSlots = [
    { hour: 9, minute: 0 },
    { hour: 11, minute: 30 },
    { hour: 14, minute: 0 },
    { hour: 16, minute: 30 },
    { hour: 19, minute: 0 },
    { hour: 21, minute: 30 },
  ];

  let totalPlanned = 0;
  let totalConflictsPrevented = 0;
  const createdShowtimes = [];

  const now = new Date();
  for (let d = 0; d < daysCount; d++) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + d);

    for (let rIdx = 0; rIdx < physicalRooms.length; rIdx++) {
      const room = physicalRooms[rIdx];
      // Luân phiên phim phù hợp với định dạng phòng
      const compatibleMovies = movies.filter(m => {
        if (room.roomType === 'IMAX Laser') return m.formats?.includes('IMAX') || m.techFormat === 'IMAX';
        if (room.roomType === 'Dolby Atmos') return m.formats?.some(f => f.includes('Atmos') || f.includes('Dolby') || f.includes('3D'));
        return true;
      });
      const eligiblePool = compatibleMovies.length > 0 ? compatibleMovies : movies;

      for (let sIdx = 0; sIdx < standardTimeSlots.length; sIdx++) {
        const slot = standardTimeSlots[sIdx];
        const assignedMovie = eligiblePool[(d * physicalRooms.length + rIdx + sIdx) % eligiblePool.length];
        const duration = Number(assignedMovie.duration) || 120;
        const cleaningMinutes = 15;

        const startTime = new Date(targetDate);
        startTime.setHours(slot.hour, slot.minute, 0, 0);

        const endTime = new Date(startTime.getTime() + duration * 60000);
        const occupiedEndTime = new Date(endTime.getTime() + cleaningMinutes * 60000);

        // Kiểm tra va chạm lịch với các suất hiện có
        const conflict = await Showtime.findOne({
          roomId: room._id,
          cancelledAt: null,
          startTime: { $lt: occupiedEndTime },
          $expr: {
            $gt: [
              { $add: [{ $ifNull: ['$endTime', { $add: ['$startTime', 120 * 60000] }] }, { $multiply: [{ $ifNull: ['$cleaningMinutes', 15] }, 60000] }] },
              startTime
            ]
          }
        });

        if (conflict) {
          totalConflictsPrevented++;
          continue;
        }

        totalPlanned++;
        if (apply) {
          const stDoc = await Showtime.create({
            movieId: assignedMovie._id,
            roomId: room._id,
            cinemaId: cinema._id,
            roomName: room.name,
            formatFeature: room.formatFeature || room.roomType,
            startTime,
            endTime,
            cleaningMinutes,
            price: room.roomType === 'IMAX Laser' ? 140000 : room.roomType === 'Dolby Atmos' ? 110000 : 180000,
            isLocked: false,
          });

          // Sinh đầy đủ 88 ghế cho suất mới
          const seats = generateStandard88Seats(room._id, stDoc._id);
          await ShowtimeSeat.insertMany(seats);
          createdShowtimes.push(stDoc._id);
        }
      }
    }
  }

  console.log(`\n📊 KẾT QUẢ ${apply ? 'THỰC THI' : 'DRY-RUN'}:`);
  console.log(`- Suất dự kiến tạo: ${totalPlanned} suất (phân bổ đều cho cả ${physicalRooms.length} phòng)`);
  console.log(`- Suất xung đột được ngăn chặn: ${totalConflictsPrevented} suất`);
  if (!apply) {
    console.log(`[DRY-RUN] Chưa có thay đổi nào vào Database. Gọi với apply = true để xác nhận ghi.`);
  }
}

if (process.argv[1]?.endsWith('seedAllDaNangShowtimes.js')) {
  const isApply = process.argv.includes('--apply');
  seedRollingShowtimes(7, isApply).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
