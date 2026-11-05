import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Movie from './models/Movie.js';
import Showtime from './models/Showtime.js';

async function standardizePricing() {
  await connectDB();
  console.log('🔄 Đang chuẩn hóa giá vé toàn hệ thống D\'AVENOR CINEMA...');

  // 1. Phân bổ giá vé chuẩn theo thể loại và tầm vóc phim:
  // - Phim Bom tấn điện ảnh đỉnh cao (IMAX / Sci-Fi / Marvel): 105.000đ
  // - Phim Tiêu chuẩn (Gia đình, Hoạt hình, Tâm lý tình cảm): 95.000đ
  const blockbusters = [
    'dune-hanh-tinh-cat-phan-2',
    'avatar-the-way-of-water',
    'deadpool-and-wolverine',
    'godzilla-x-kong-de-che-moi',
    'venom-the-last-dance',
    'captain-america-brave-new-world',
    'joker-folie-a-deux',
    'oppenheimer',
    'spider-man-no-way-home',
  ];

  const movies = await Movie.find({});
  for (const m of movies) {
    const isBlockbuster = blockbusters.some(b => m.slug && (m.slug.includes(b) || b.includes(m.slug)));
    const newPrice = isBlockbuster ? 105000 : 95000;
    m.price = newPrice;
    await m.save();
    console.log(`🎬 Phim [${m.title}] => Giá vé 2D chuẩn: ${newPrice.toLocaleString('vi-VN')} đ`);
  }

  // 2. Chuẩn hóa giá vé của tất cả Showtime trong database theo chuẩn rạp:
  // - IMAX Laser (Phòng 01 / IMAX): 160.000đ
  // - RealD 3D (Phòng 3D): movie.price + 15.000đ
  // - VIP Gold Class / Lounge: 250.000đ
  // - 2D (Tiêu chuẩn / Dolby Atmos / Lồng tiếng / Phụ đề): movie.price
  const showtimes = await Showtime.find({}).populate('movieId');
  let updatedCount = 0;

  for (const st of showtimes) {
    const movieBasePrice = st.movieId?.price || 95000;
    const roomLower = (st.roomName || '').toLowerCase();
    let calculatedPrice = movieBasePrice;

    if (roomLower.includes('imax')) {
      calculatedPrice = 160000;
    } else if (roomLower.includes('gold class') || roomLower.includes('vip')) {
      calculatedPrice = 250000;
    } else if (roomLower.includes('3d') || (st.formatFeature && st.formatFeature.includes('3D'))) {
      calculatedPrice = movieBasePrice + 15000;
    } else {
      calculatedPrice = movieBasePrice;
    }

    if (st.price !== calculatedPrice) {
      st.price = calculatedPrice;
      await st.save();
      updatedCount++;
    }
  }

  console.log(`\n🎉 Hoàn thành! Đã chuẩn hóa ${updatedCount} suất chiếu đồng bộ chính xác 100%!`);
  process.exit(0);
}

standardizePricing().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
