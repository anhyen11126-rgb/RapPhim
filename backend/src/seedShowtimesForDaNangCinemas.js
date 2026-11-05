import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Movie from './models/Movie.js';
import Cinema from './models/Cinema.js';
import Showtime from './models/Showtime.js';
import ShowtimeSeat from './models/ShowtimeSeat.js';

async function seedDaNangShowtimes() {
  await connectDB();
  console.log('🍃 [MongoDB Atlas] Bắt đầu khởi tạo suất chiếu thực tế cho toàn bộ 12 cụm rạp tại Đà Nẵng...');

  const daNangCinemas = await Cinema.find({ city: 'Đà Nẵng' });
  const movies = await Movie.find({});

  console.log(`📍 Tìm thấy ${daNangCinemas.length} rạp Đà Nẵng và ${movies.length} bộ phim trong Database.`);

  const standardRows = ['A', 'B', 'C', 'D'];
  const vipRows = ['E', 'F', 'G'];
  const sweetboxSeats = ['H1-2', 'H3-4', 'H5-6', 'H7-8'];

  // Định nghĩa các khung giờ chiếu chuẩn theo chính sách giá mới
  const scheduleSlots = [
    { timeStr: '15:15', hour: 15, minute: 15, price: 45000, roomName: 'Phòng 01 - 2D Dolby Atmos' },
    { timeStr: '19:15', hour: 19, minute: 15, price: 50000, roomName: 'Phòng 02 - IMAX Laser' },
    { timeStr: '21:00', hour: 21, minute: 0, price: 50000, roomName: 'Phòng 03 - Dolby 7.1' },
    { timeStr: '22:30', hour: 22, minute: 30, price: 50000, roomName: 'Phòng 01 - Suất Chiếu Khuya' },
  ];

  let totalShowtimesCreated = 0;
  let totalSeatsCreated = 0;

  for (const cinema of daNangCinemas) {
    console.log(`\n🎬 Đang xử lý rạp [${cinema.name}] - Q.${cinema.district || 'Đà Nẵng'}...`);

    // Chọn 4 phim hot nhất để tạo suất chiếu cho cụm rạp này
    const targetMovies = movies.slice(0, 4);

    for (const movie of targetMovies) {
      // Kiểm tra xem đã có suất chiếu cho phim này ở rạp này chưa
      const existingCount = await Showtime.countDocuments({
        cinemaId: cinema._id,
        movieId: movie._id,
      });

      if (existingCount >= 2) {
        continue;
      }

      // Tạo các suất chiếu theo slot
      for (const slot of scheduleSlots) {
        const startTime = new Date();
        startTime.setHours(slot.hour, slot.minute, 0, 0);

        const showtime = await Showtime.create({
          cinemaId: cinema._id,
          movieId: movie._id,
          roomName: slot.roomName,
          formatFeature: slot.roomName.includes('IMAX') ? 'IMAX Laser 4K' : 'Dolby Atmos 360°',
          startTime,
          time: slot.timeStr,
          price: slot.price,
        });

        totalShowtimesCreated++;

        // Tạo ghế đầy đủ: Hàng A-D (ghế thường 1-12), Hàng E-G (ghế VIP 1-12), Hàng H (Sweetbox)
        const seatDocs = [];

        // Ghế thường A-D
        for (const row of standardRows) {
          for (let col = 1; col <= 12; col++) {
            seatDocs.push({
              showtimeId: showtime._id,
              seatNumber: `${row}${col}`,
              row,
              col,
              type: 'STANDARD',
              status: (col === 4 && row === 'C') ? 'BOOKED' : 'AVAILABLE',
            });
          }
        }

        // Ghế VIP E-G
        for (const row of vipRows) {
          for (let col = 1; col <= 12; col++) {
            seatDocs.push({
              showtimeId: showtime._id,
              seatNumber: `${row}${col}`,
              row,
              col,
              type: 'VIP',
              status: (col === 8 && row === 'E') ? 'BOOKED' : 'AVAILABLE',
            });
          }
        }

        // Ghế Sweetbox H
        for (const seatNumber of sweetboxSeats) {
          seatDocs.push({
            showtimeId: showtime._id,
            seatNumber,
            row: 'H',
            col: 1,
            type: 'SWEETBOX',
            status: seatNumber === 'H7-8' ? 'BOOKED' : 'AVAILABLE',
          });
        }

        await ShowtimeSeat.insertMany(seatDocs);
        totalSeatsCreated += seatDocs.length;
      }
    }
  }

  console.log(`\n🎉 HOÀN THÀNH ĐỒNG BỘ MONGODB ATLAS:`);
  console.log(`- Đã tạo thêm: ${totalShowtimesCreated} suất chiếu mới.`);
  console.log(`- Đã tạo thêm: ${totalSeatsCreated} ghế ngồi.`);

  process.exit(0);
}

seedDaNangShowtimes().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

