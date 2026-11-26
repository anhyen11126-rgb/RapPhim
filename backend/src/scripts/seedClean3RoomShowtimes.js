import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import mongoose from 'mongoose';
import { configureOptionalDnsServers } from '../config/db.js';
configureOptionalDnsServers();
import Movie from '../models/Movie.js';
import Cinema from '../models/Cinema.js';
import Showtime from '../models/Showtime.js';

// Cấu hình 3 phòng chiếu chuẩn duy nhất theo yêu cầu
const ROOMS = [
  {
    roomName: 'Phòng IMAX Laser',
    formatFeature: 'IMAX Laser 2D',
    price: 150000,
  },
  {
    roomName: 'Phòng Dolby Atmos',
    formatFeature: '2D Dolby Atmos',
    price: 120000,
  },
  {
    roomName: 'Phòng Gold Class',
    formatFeature: 'Gold Class Luxury',
    price: 190000,
  },
];

// Cấu hình khung giờ chuẩn theo yêu cầu:
// - Suất giờ vàng tối: 19:30
// - Suất tiếp theo sau khi hết phim + 30-45 phút dọn dẹp (tầm 22h)
// - Suất chiều và sáng
const SCHEDULE_CONFIGS = {
  // Dune 2: 166 phút (2h46m) -> 19:30 chiếu đến 22:16 + 34p dọn dẹp = 22:50
  'dune-hanh-tinh-cat-phan-2': [
    { hour: 19, minute: 30, isPrime: true },
    { hour: 22, minute: 50 },
    { hour: 16, minute: 0 },
    { hour: 12, minute: 30 },
    { hour: 9, minute: 0 },
  ],
  // Mai: 131 phút (2h11m) -> 19:30 chiếu đến 21:41 + 39p dọn dẹp = 22:20
  'mai': [
    { hour: 19, minute: 30, isPrime: true },
    { hour: 22, minute: 20 },
    { hour: 16, minute: 40 },
    { hour: 13, minute: 50 },
    { hour: 11, minute: 0 },
  ],
  // Deadpool & Wolverine: 128 phút (2h08m) -> 19:30 chiếu đến 21:38 + 37p dọn dẹp = 22:15
  'deadpool-and-wolverine': [
    { hour: 19, minute: 30, isPrime: true },
    { hour: 22, minute: 15 },
    { hour: 16, minute: 40 },
    { hour: 13, minute: 50 },
    { hour: 11, minute: 0 },
  ],
};

const DEFAULT_UPCOMING_SLOTS = [
  { hour: 19, minute: 30, isPrime: true },
  { hour: 22, minute: 0 },
  { hour: 16, minute: 30 },
];

async function seedCleanShowtimes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Kết nối MongoDB Atlas thành công');

    const cinema = await Cinema.findOne();
    const cinemaId = cinema ? cinema._id : new mongoose.Types.ObjectId('6aecb03919dd0ede75638b6e');

    // 1. Dọn sạch toàn bộ showtimes cũ
    await Showtime.deleteMany({});
    console.log('✓ Đã dọn sạch các suất chiếu cũ trong database');

    const movies = await Movie.find({});
    console.log(`Tìm thấy ${movies.length} bộ phim`);

    const baseDate = new Date('2026-11-21T00:00:00.000Z');
    const dayOffsets = [0, 1, 2, 3, 4, 5, 6, 7];

    const showtimesToInsert = [];
    const firstPrimeMap = {};

    for (const movie of movies) {
      const slots = SCHEDULE_CONFIGS[movie.slug] || DEFAULT_UPCOMING_SLOTS;

      for (const dayOffset of dayOffsets) {
        const targetDay = new Date(baseDate);
        targetDay.setDate(baseDate.getDate() + dayOffset);

        for (const slot of slots) {
          const startTime = new Date(targetDay);
          startTime.setHours(slot.hour, slot.minute, 0, 0);

          for (const room of ROOMS) {
            const showtimeDoc = {
              _id: new mongoose.Types.ObjectId(),
              movieId: movie._id,
              cinemaId,
              roomName: room.roomName,
              formatFeature: room.formatFeature,
              startTime,
              price: room.price,
            };

            showtimesToInsert.push(showtimeDoc);

            if (dayOffset === 0 && slot.isPrime && room.roomName === 'Phòng IMAX Laser' && !firstPrimeMap[movie._id.toString()]) {
              firstPrimeMap[movie._id.toString()] = showtimeDoc._id.toString();
            }
          }
        }
      }
    }

    console.log(`Đang lưu đồng loạt ${showtimesToInsert.length} suất chiếu vào MongoDB Atlas...`);
    await Showtime.insertMany(showtimesToInsert);
    console.log(`✓ Đã lưu thành công ${showtimesToInsert.length} suất chiếu!`);

    // Cập nhật firstShowtimeId cho từng phim
    for (const [movieId, firstShowtimeId] of Object.entries(firstPrimeMap)) {
      await Movie.findByIdAndUpdate(movieId, { firstShowtimeId });
    }
    console.log('✓ Đã cập nhật firstShowtimeId cho các bộ phim');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

seedCleanShowtimes();
