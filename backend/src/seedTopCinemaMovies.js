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

import { exactMoviesList } from './updateExactBanners.js';
const topMoviesData = exactMoviesList;

async function seedTopMovies() {
  console.log('🍃 [MongoDB] Bắt đầu nạp & cập nhật danh sách phim bom tấn chuẩn rạp...');
  await connectDB();

  // 1. Lấy danh sách rạp đang có
  const cinemas = await Cinema.find();
  if (cinemas.length === 0) {
    console.warn('⚠️ Chưa tìm thấy rạp nào trong DB! Hãy chạy seedMongo.js trước nếu cần.');
  }

  const savedMovies = [];

  for (const item of topMoviesData) {
    let movie = await Movie.findOne({ slug: item.slug });

    if (movie) {
      // Cập nhật thông tin và sửa link trailer hoạt động 100%
      movie.title = item.title;
      movie.slug = item.slug;
      movie.posterUrl = item.posterUrl;
      movie.poster = item.poster;
      movie.bannerUrl = item.bannerUrl;
      movie.trailerUrl = item.trailerUrl;
      movie.genre = item.genre;
      movie.duration = item.duration;
      movie.ageRating = item.ageRating;
      movie.description = item.description;
      movie.status = item.status;
      movie.price = item.price;
      await movie.save();
      console.log(`✅ Đã cập nhật phim: "${item.title}" [${item.status}]`);
    } else {
      // Thêm mới phim
      movie = await Movie.create(item);
      console.log(`✨ Đã thêm phim mới: "${item.title}" [${item.status}]`);
    }

    savedMovies.push(movie);

    // 2. Tạo suất chiếu mẫu cho phim nếu phim chưa có suất chiếu nào
    const existingShowtimes = await Showtime.countDocuments({ movieId: movie._id });
    if (existingShowtimes === 0 && cinemas.length > 0) {
      console.log(`🎟️ Đang tạo suất chiếu tự động cho phim: ${movie.title}...`);

      const targetCinemas = cinemas.slice(0, 3); // Tạo suất ở 3 rạp hàng đầu
      const hours = [18, 20, 22];

      for (let cIdx = 0; cIdx < targetCinemas.length; cIdx++) {
        const c = targetCinemas[cIdx];
        const h = hours[cIdx % hours.length];

        const startTime = new Date();
        startTime.setHours(h, 30, 0, 0);
        if (startTime < new Date()) {
          startTime.setDate(startTime.getDate() + 1);
        }

        const roomName = cIdx === 0 ? 'Phòng 01 - IMAX Laser' : 'Phòng 02 - 2D Dolby Atmos';
        const formatFeature = cIdx === 0 ? 'Màn hình cong IMAX 22m' : 'Âm thanh vòm Dolby Atmos';

        const showtime = await Showtime.create({
          cinemaId: c._id,
          movieId: movie._id,
          roomName,
          formatFeature,
          startTime,
          price: movie.price || 95000,
        });

        // Tạo 48 ghế (A1 - F8)
        const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
        const cols = [1, 2, 3, 4, 5, 6, 7, 8];
        const seatDocs = [];

        for (const r of rows) {
          for (const col of cols) {
            const isVip = ['E', 'F'].includes(r);
            seatDocs.push({
              showtimeId: showtime._id,
              seatNumber: `${r}${col}`,
              row: r,
              col: col,
              type: isVip ? 'VIP' : 'STANDARD',
              status: 'AVAILABLE',
            });
          }
        }

        await ShowtimeSeat.insertMany(seatDocs);
      }
    }
  }

  const totalInDb = await Movie.countDocuments();
  console.log(`\n🎉 HOÀN THÀNH: Tổng số phim hiện tại trong DB: ${totalInDb} bộ phim.`);
  process.exit(0);
}

seedTopMovies().catch((err) => {
  console.error('❌ Lỗi khi seed phim:', err);
  process.exit(1);
});
