import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Movie from './models/Movie.js';

import { exactMoviesList } from './updateExactBanners.js';
const updatedMoviesData = exactMoviesList;

async function updateMovies() {
  await connectDB();
  console.log('🎬 Bắt đầu đồng bộ danh mục phim bom tấn rạp...');

  for (const item of updatedMoviesData) {
    const updated = await Movie.findOneAndUpdate(
      {
        $or: [
          { slug: item.slug },
          { title: { $regex: item.slug.replace(/-/g, ' '), $options: 'i' } },
          { title: { $regex: item.title.split(' ')[0], $options: 'i' } },
        ],
      },
      {
        $set: {
          title: item.title,
          slug: item.slug,
          poster: item.poster,
          posterUrl: item.posterUrl,
          bannerUrl: item.bannerUrl,
          trailerUrl: item.trailerUrl,
          genre: item.genre,
          duration: item.duration,
          ageRating: item.ageRating,
          description: item.description,
          status: item.status,
          price: item.price,
        },
      },
      { new: true, upsert: true }
    );
    console.log(`✅ [${updated.status}] ${updated.title}`);
  }

  console.log('\n🎉 Đã cập nhật thành công toàn bộ phim!');
  process.exit(0);
}

updateMovies().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
