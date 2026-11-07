import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Movie from './models/Movie.js';
import Cinema from './models/Cinema.js';
import Showtime from './models/Showtime.js';
import ShowtimeSeat from './models/ShowtimeSeat.js';

export async function seedRollingShowtimes(daysCount = 14) {
  await connectDB();
  console.log(`🍃 [MongoDB Atlas] Khởi tạo lịch chiếu liên tục ${daysCount} ngày tới cho tất cả 12 cụm rạp Đà Nẵng...`);

  const cinemas = await Cinema.find({ city: 'Đà Nẵng' });
  const movies = await Movie.find({});

  if (cinemas.length === 0) {
    console.error('❌ Không tìm thấy rạp nào ở Đà Nẵng!');
    return;
  }
  if (movies.length === 0) {
    console.error('❌ Không tìm thấy phim nào trong database!');
    return;
  }

  console.log(`📍 Tìm thấy ${cinemas.length} rạp Đà Nẵng và ${movies.length} bộ phim.`);

  // Chọn 4-5 phim hot nhất chiếu thường xuyên
  const primaryMovies = movies.filter((m) =>
    ['dune-hanh-tinh-cat-phan-2', 'mai', 'kung-fu-panda-4', 'godzilla-x-kong-de-che-moi', 'quat-mo-trung-ma', 'lat-mat-7-mot-dieu-uoc'].includes(m.slug)
  );
  const featuredMovies = primaryMovies.length >= 3 ? primaryMovies : movies.slice(0, 5);

  const standardRows = ['A', 'B', 'C', 'D'];
  const vipRows = ['E', 'F', 'G'];
  const sweetboxSeats = [
    { row: 'H', col: 1, seatNumber: 'H1-2' },
    { row: 'H', col: 3, seatNumber: 'H3-4' },
    { row: 'H', col: 5, seatNumber: 'H5-6' },
    { row: 'H', col: 7, seatNumber: 'H7-8' },
  ];

  const now = new Date();
  let totalCreatedShowtimes = 0;
  let totalCreatedSeats = 0;

  for (let d = 0; d < daysCount; d++) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + d);
    targetDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);

    const dayOfWeek = targetDate.getDay(); // 0: CN, 5: T6, 6: T7
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

    const dateStr = `${targetDate.getDate()}/${targetDate.getMonth() + 1}`;
    console.log(`\n📅 Đang tạo lịch chiếu ngày ${dateStr} (${isWeekend ? 'Cuối tuần' : 'Trong tuần'})...`);

    for (const cinema of cinemas) {
      // Kiểm tra xem rạp này ngày này đã có suất chiếu chưa
      const existingCount = await Showtime.countDocuments({
        cinemaId: cinema._id,
        startTime: { $gte: targetDate, $lt: nextDate },
      });

      if (existingCount >= 6) {
        // Đã có đủ suất chiếu cho ngày này
        continue;
      }

      // Xây dựng các phòng chiếu & suất chiếu theo chuẩn giá của rạp
      // Định nghĩa các phòng và khung giờ:
      const roomConfigs = [
        {
          roomName: cinema.tags?.includes('IMAX Laser') ? 'Phòng IMAX 01' : 'Phòng Chiếu 01 (Dolby Atmos)',
          formatFeature: cinema.tags?.includes('IMAX Laser') ? 'IMAX Laser 2D • Âm thanh 12 kênh độc quyền' : '2D Phụ Đề • Âm thanh vòm Dolby Atmos',
          formatType: cinema.tags?.includes('IMAX Laser') ? 'imax' : '2d',
          slots: [
            { timeStr: '17:30', hour: 17, minute: 30 },
            { timeStr: '19:15', hour: 19, minute: 15 },
            { timeStr: '20:45', hour: 20, minute: 45 },
            { timeStr: '22:30', hour: 22, minute: 30 }, // Suất khuya
          ],
        },
        {
          roomName: 'Rạp 03 (Tầng 2)',
          formatFeature: '2D Phụ Đề • Chuẩn Dolby 7.1 • Màn chiếu 4K',
          formatType: '2d',
          slots: [
            { timeStr: '18:00', hour: 18, minute: 0 },
            { timeStr: '19:45', hour: 19, minute: 45 },
            { timeStr: '21:15', hour: 21, minute: 15 },
            { timeStr: '23:00', hour: 23, minute: 0 }, // Suất khuya
          ],
        },
        {
          roomName: 'Rạp 05 (Tầng 3)',
          formatFeature: '3D Phụ Đề • RealD 3D High Frame Rate • Kính 3D siêu nhẹ',
          formatType: '3d',
          slots: [
            { timeStr: '18:30', hour: 18, minute: 30 },
            { timeStr: '21:00', hour: 21, minute: 0 },
          ],
        },
      ];

      // Gán phim cho từng phòng
      for (let rIdx = 0; rIdx < roomConfigs.length; rIdx++) {
        const room = roomConfigs[rIdx];
        const assignedMovie = featuredMovies[rIdx % featuredMovies.length];

        for (const slot of room.slots) {
          const startTime = new Date(targetDate);
          startTime.setHours(slot.hour, slot.minute, 0, 0);

          const isLate = slot.hour >= 22;

          // Tính giá chuẩn đồng bộ
          let calculatedPrice = 50000;
          if (room.formatType === 'imax') {
            calculatedPrice = isLate ? 140000 : (isWeekend ? 170000 : 160000);
          } else if (room.formatType === '3d') {
            calculatedPrice = isLate ? 60000 : (isWeekend ? 80000 : 65000);
          } else {
            // 2D
            calculatedPrice = isLate ? 45000 : (isWeekend ? 65000 : 50000);
          }

          // Kiểm tra xem suất chiếu này đã tồn tại chưa
          const exists = await Showtime.findOne({
            cinemaId: cinema._id,
            movieId: assignedMovie._id,
            startTime,
          });

          if (!exists) {
            const showtime = await Showtime.create({
              cinemaId: cinema._id,
              movieId: assignedMovie._id,
              roomName: room.roomName,
              formatFeature: room.formatFeature,
              startTime,
              price: calculatedPrice,
            });

            totalCreatedShowtimes++;

            // Tạo ghế cho suất chiếu này
            const seats = [];
            // A-D (ghế thường)
            for (const row of standardRows) {
              for (let col = 1; col <= 12; col++) {
                const isBooked = (col === 4 && row === 'C') || (col === 7 && row === 'B');
                seats.push({
                  showtimeId: showtime._id,
                  seatNumber: `${row}${col}`,
                  row,
                  col,
                  type: 'STANDARD',
                  status: isBooked ? 'BOOKED' : 'AVAILABLE',
                });
              }
            }

            // E-G (ghế VIP)
            for (const row of vipRows) {
              for (let col = 1; col <= 12; col++) {
                const isBooked = (col === 8 && row === 'E') || (col === 5 && row === 'F');
                seats.push({
                  showtimeId: showtime._id,
                  seatNumber: `${row}${col}`,
                  row,
                  col,
                  type: 'VIP',
                  status: isBooked ? 'BOOKED' : 'AVAILABLE',
                });
              }
            }

            // H (Sweetbox)
            for (const sb of sweetboxSeats) {
              seats.push({
                showtimeId: showtime._id,
                seatNumber: sb.seatNumber,
                row: sb.row,
                col: sb.col,
                type: 'SWEETBOX',
                status: 'AVAILABLE',
              });
            }

            await ShowtimeSeat.insertMany(seats);
            totalCreatedSeats += seats.length;
          }
        }
      }
    }
  }

  console.log(`\n🎉 HOÀN TẤT ĐẨY LÊN DATABASE!`);
  console.log(`✅ Tổng số suất chiếu mới tạo trong MongoDB Atlas: ${totalCreatedShowtimes}`);
  console.log(`✅ Tổng số ghế mới tạo trong MongoDB Atlas: ${totalCreatedSeats}`);
}

// Chạy trực tiếp nếu gọi từ command line
if (process.argv[1] && process.argv[1].includes('seedAllDaNangShowtimes')) {
  seedRollingShowtimes(10)
    .then(() => {
      console.log('✨ Seed hoàn tất 100%!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Lỗi khi seed:', err);
      process.exit(1);
    });
}

