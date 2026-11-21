import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import mongoose from 'mongoose';
import Movie from '../models/Movie.js';

// Phân chia 18 bộ phim đều cho 6 tháng liên tiếp (mỗi tháng đúng 3 bộ phim)
// Tháng 11/2026 (Đang công chiếu tại rạp), Tháng 12/2026 và các tháng năm 2027 (T1, T2, T3, T4/2027) là Sắp chiếu
const SCHEDULE_BY_MONTH = [
  {
    monthLabel: 'Tháng 11/2026 (Hiện tại)',
    monthNumber: 11,
    year: 2026,
    releaseDate: new Date('2026-11-15T00:00:00.000Z'),
    status: 'NOW_SHOWING', // Đang công chiếu tại rạp
    movieSlugs: [
      'dune-hanh-tinh-cat-phan-2',
      'mai',
      'deadpool-and-wolverine',
    ],
  },
  {
    monthLabel: 'Tháng 12/2026',
    monthNumber: 12,
    year: 2026,
    releaseDate: new Date('2026-12-15T00:00:00.000Z'),
    status: 'COMING_SOON', // Sắp chiếu
    movieSlugs: [
      'moana-2',
      'mufasa-the-lion-king',
      'venom-the-last-dance',
    ],
  },
  {
    monthLabel: 'Tháng 01/2027',
    monthNumber: 1,
    year: 2027,
    releaseDate: new Date('2027-01-15T00:00:00.000Z'),
    status: 'COMING_SOON', // Sắp chiếu
    movieSlugs: [
      'co-dau-hao-mon',
      'transformers-one',
      'inside-out-2',
    ],
  },
  {
    monthLabel: 'Tháng 02/2027',
    monthNumber: 2,
    year: 2027,
    releaseDate: new Date('2027-02-15T00:00:00.000Z'),
    status: 'COMING_SOON', // Sắp chiếu
    movieSlugs: [
      'captain-america-brave-new-world',
      'joker-folie-a-deux',
      'kung-fu-panda-4',
    ],
  },
  {
    monthLabel: 'Tháng 03/2027',
    monthNumber: 3,
    year: 2027,
    releaseDate: new Date('2027-03-15T00:00:00.000Z'),
    status: 'COMING_SOON', // Sắp chiếu
    movieSlugs: [
      'quat-mo-trung-ma',
      'lat-mat-7-mot-dieu-uoc',
      'godzilla-x-kong-de-che-moi',
    ],
  },
  {
    monthLabel: 'Tháng 04/2027',
    monthNumber: 4,
    year: 2027,
    releaseDate: new Date('2027-04-15T00:00:00.000Z'),
    status: 'COMING_SOON', // Sắp chiếu
    movieSlugs: [
      'oppenheimer',
      'spider-man-no-way-home',
      'avatar-the-way-of-water',
    ],
  },
];

async function updateSchedule() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Kết nối MongoDB Atlas thành công');

  for (const group of SCHEDULE_BY_MONTH) {
    for (const slug of group.movieSlugs) {
      await Movie.findOneAndUpdate(
        { slug },
        {
          $set: {
            releaseDate: group.releaseDate,
            status: group.status,
          },
        }
      );
    }
    console.log(`✓ [${group.monthLabel}] -> ${group.status}: ${group.movieSlugs.join(', ')}`);
  }

  const allMovies = await Movie.find({}, 'title slug status releaseDate').sort({ releaseDate: 1 }).lean();
  console.log('\n--- TỔNG HỢP 18 PHIM THEO 6 THÁNG (MỖI THÁNG 3 PHIM) ---');
  allMovies.forEach((m) => {
    const d = new Date(m.releaseDate);
    const mStr = `T${d.getMonth() + 1}/${d.getFullYear()}`;
    const tag = m.status === 'NOW_SHOWING' ? '🟢 ĐANG CÔNG CHIẾU' : m.status === 'ENDED' ? '⚪ ĐÃ CÔNG CHIẾU' : '🟡 SẮP CHIẾU';
    console.log(`[${mStr}] [${tag}] "${m.title}"`);
  });

  await mongoose.disconnect();
}

updateSchedule().catch((err) => {
  console.error(err);
  process.exit(1);
});
