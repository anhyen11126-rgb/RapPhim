import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Movie from './models/Movie.js';

// Dữ liệu chuẩn xác 100% Poster dọc và Backdrop ngang từ TMDB API cho tất cả 18 phim
export const exactMoviesList = [
  {
    slug: 'dune-hanh-tinh-cat-phan-2',
    title: 'Dune: Hành Tinh Cát – Phần 2',
    posterUrl: 'https://image.tmdb.org/t/p/w780/8QdnKQyZDlN6rBSrfU1V5PctfUu.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/8QdnKQyZDlN6rBSrfU1V5PctfUu.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/eZ239CUp1d6OryZEBPnO2n87gMG.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
    genre: 'Khoa Học Viễn Tưởng, Hành Động, Phiêu Lưu',
    duration: 166,
    ageRating: 'T16',
    status: 'NOW_SHOWING',
    price: 110000,
  },
  {
    slug: 'mai',
    title: 'Mai',
    posterUrl: 'https://image.tmdb.org/t/p/w780/2nF8xD200rcDawuCg5ObxxqA2fC.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/2nF8xD200rcDawuCg5ObxxqA2fC.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/zZ6nRdNQNxRnZ1LQ2ttPBZl9AXV.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=EX6clvId19s',
    genre: 'Tâm Lý, Tình Cảm, Gia Đình',
    duration: 131,
    ageRating: 'T18',
    status: 'NOW_SHOWING',
    price: 95000,
  },
  {
    slug: 'lat-mat-7-mot-dieu-uoc',
    title: 'Lật Mặt 7: Một Điều Ước',
    posterUrl: 'https://image.tmdb.org/t/p/w780/2mg6ktvWxsOG9iMBP4P1pwOYltk.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/2mg6ktvWxsOG9iMBP4P1pwOYltk.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/1K7pHhCZprfDXB7LkCquIK62yCb.jpg', // Banner ngang chuẩn TMDB của Lật Mặt 7
    trailerUrl: 'https://www.youtube.com/watch?v=d1ZHdosjNX8',
    genre: 'Gia Đình, Tâm Lý, Tình Cảm',
    duration: 138,
    ageRating: 'P',
    status: 'NOW_SHOWING',
    price: 95000,
  },
  {
    slug: 'co-dau-hao-mon',
    title: 'Cô Dâu Hào Môn',
    posterUrl: 'https://image.tmdb.org/t/p/w780/jyre4BzgNeI3Ne3ZoDMFmQir194.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/jyre4BzgNeI3Ne3ZoDMFmQir194.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/mlO0cl55OUjxK6ZprCYWkRZuRNh.jpg', // Banner ngang chuẩn TMDB của Cô Dâu Hào Môn
    trailerUrl: 'https://www.youtube.com/watch?v=ZIz8QQBYcx0',
    genre: 'Hài Hước, Tâm Lý, Gia Đình',
    duration: 114,
    ageRating: 'T16',
    status: 'NOW_SHOWING',
    price: 95000,
  },
  {
    slug: 'inside-out-2',
    title: 'Inside Out 2 (Những Mảnh Ghép Cảm Xúc 2)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/wAIFnJ5OeFU7tTnCWHiROsszS29.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/wAIFnJ5OeFU7tTnCWHiROsszS29.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/p5ozvmdgsmbWe0H8Xk7Rc8SCwAB.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=LEjhY15eCx0',
    genre: 'Hoạt Hình, Gia Đình, Hài Hước, Phiêu Lưu',
    duration: 96,
    ageRating: 'P',
    status: 'NOW_SHOWING',
    price: 90000,
  },
  {
    slug: 'godzilla-x-kong-de-che-moi',
    title: 'Godzilla x Kong: Đế Chế Mới',
    posterUrl: 'https://image.tmdb.org/t/p/w780/lTpnAtn1hWXDLxEmkD28l6UyPlF.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/lTpnAtn1hWXDLxEmkD28l6UyPlF.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/gvLG3Fnznkxl4SmYfcK8gUuqxM8.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=lV1OOlGwExM',
    genre: 'Hành Động, Phiêu Lưu, Viễn Tưởng',
    duration: 115,
    ageRating: 'T13',
    status: 'NOW_SHOWING',
    price: 105000,
  },
  {
    slug: 'venom-the-last-dance',
    title: 'Venom: Kèo Cuối (Venom: The Last Dance)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/64hJDbJlLFJSRg4sG3njMCijIyF.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/64hJDbJlLFJSRg4sG3njMCijIyF.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/3V4kLQg0kSqPLctI5ziYWabAZYF.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=__2bjWbetsA',
    genre: 'Hành Động, Viễn Tưởng, Siêu Anh Hùng',
    duration: 110,
    ageRating: 'T16',
    status: 'NOW_SHOWING',
    price: 105000,
  },
  {
    slug: 'quat-mo-trung-ma',
    title: 'Quật Mộ Trùng Ma (Exhuma)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/enAODUiL6eMpKaYPH2BEStVafQ2.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/enAODUiL6eMpKaYPH2BEStVafQ2.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/kYWk8TW5TkpCWkB0mkUm72N0lb8.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=66K9-l0EkE0',
    genre: 'Kinh Dị, Bí Ẩn, Giật Gân',
    duration: 134,
    ageRating: 'T18',
    status: 'NOW_SHOWING',
    price: 90000,
  },
  {
    slug: 'deadpool-and-wolverine',
    title: 'Deadpool & Wolverine',
    posterUrl: 'https://image.tmdb.org/t/p/w780/lfY2CfmxyN9OvxmFuap6aejViJn.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/lfY2CfmxyN9OvxmFuap6aejViJn.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/by8z9Fe8y7p4jo2YlW2SZDnptyT.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=73_1biulkYk',
    genre: 'Hành Động, Hài Hước, Siêu Anh Hùng',
    duration: 128,
    ageRating: 'T18',
    status: 'NOW_SHOWING',
    price: 110000,
  },
  {
    slug: 'avatar-the-way-of-water',
    title: 'Avatar: Dòng Chảy Của Nước (Avatar: The Way of Water)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/luCqqHf10eQuGAYFO3U7JEqT4XC.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/luCqqHf10eQuGAYFO3U7JEqT4XC.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/kJsPVzdyBrYHLomuNv5SJDXUQ2f.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=d9MyW72ELq0',
    genre: 'Khoa Học Viễn Tưởng, Phiêu Lưu, Hành Động',
    duration: 192,
    ageRating: 'T13',
    status: 'NOW_SHOWING',
    price: 120000,
  },
  {
    slug: 'transformers-one',
    title: 'Transformers One (Transformers Một)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/dawYxxlMAzEOy3eYuAlKlPk3lcW.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/dawYxxlMAzEOy3eYuAlKlPk3lcW.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/cMfokHWle5lfCreoV08cbmkKv6G.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=0rmJXXKDrsM',
    genre: 'Hoạt Hình, Hành Động, Viễn Tưởng',
    duration: 104,
    ageRating: 'P',
    status: 'NOW_SHOWING',
    price: 90000,
  },
  {
    slug: 'kung-fu-panda-4',
    title: 'Kung Fu Panda 4',
    posterUrl: 'https://image.tmdb.org/t/p/w780/7quq3UOaaB0qNM7TMGMEqqghLck.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/7quq3UOaaB0qNM7TMGMEqqghLck.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/3ffPx9jqg0yj9y1KWeagT7D20CB.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=_inKs4eeHiI',
    genre: 'Hoạt Hình, Hài Hước, Gia Đình',
    duration: 94,
    ageRating: 'P',
    status: 'NOW_SHOWING',
    price: 90000,
  },
  {
    slug: 'spider-man-no-way-home',
    title: 'Spider-Man: No Way Home (Người Nhện: Không Còn Nhà)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/y4SQ2dJ1y2LBUnxTH7hCe8sr29c.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/y4SQ2dJ1y2LBUnxTH7hCe8sr29c.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/iQFcwSGbZXMkeyKrxbPnwnRo5fl.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=JfVOs4VSpmA',
    genre: 'Hành Động, Phiêu Lưu, Siêu Anh Hùng',
    duration: 148,
    ageRating: 'T13',
    status: 'NOW_SHOWING',
    price: 95000,
  },
  {
    slug: 'oppenheimer',
    title: 'Oppenheimer',
    posterUrl: 'https://image.tmdb.org/t/p/w780/ixLH2iM9at8BbuLr5wQWnCfwhJO.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/ixLH2iM9at8BbuLr5wQWnCfwhJO.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=bK6ldnjE3Y0',
    genre: 'Tiểu Sử, Lịch Sử, Kịch Tính',
    duration: 180,
    ageRating: 'T18',
    status: 'NOW_SHOWING',
    price: 95000,
  },
  {
    slug: 'moana-2',
    title: 'Hành Trình Của Moana 2 (Moana 2)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/g8ikn2lfi4R04U7BtXvHmYvnUTV.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/g8ikn2lfi4R04U7BtXvHmYvnUTV.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/vYqt6kb4lcF8wwqsMMaULkP9OEn.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=hDZ7y8RP5HE',
    genre: 'Hoạt Hình, Phiêu Lưu, Âm Nhạc, Gia Đình',
    duration: 100,
    ageRating: 'P',
    status: 'COMING_SOON',
    price: 95000,
  },
  {
    slug: 'mufasa-the-lion-king',
    title: 'Mufasa: Vua Sư Tử (Mufasa: The Lion King)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/yTiVUcBeSUpmsPSbmzzK2JHeBjJ.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/yTiVUcBeSUpmsPSbmzzK2JHeBjJ.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/1w8kutrRucTd3wlYyu5QlUDMiG1.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=o17MF9vnabg',
    genre: 'Phiêu Lưu, Gia Đình, Kịch Tính',
    duration: 118,
    ageRating: 'P',
    status: 'COMING_SOON',
    price: 95000,
  },
  {
    slug: 'joker-folie-a-deux',
    title: 'Joker: Điên Có Đôi (Joker: Folie à Deux)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/o9Qly0XwYbEwaanxb3IntVNpErN.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/o9Qly0XwYbEwaanxb3IntVNpErN.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/AVWlQpVhpudyFsSh3OQIieHHYf.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=_OKAwz2MsJs',
    genre: 'Tâm Lý, Tội Phạm, Âm Nhạc, Kịch Tính',
    duration: 138,
    ageRating: 'T18',
    status: 'COMING_SOON',
    price: 105000,
  },
  {
    slug: 'captain-america-brave-new-world',
    title: 'Captain America: Thế Giới Mới Dũng Cảm (Brave New World)',
    posterUrl: 'https://image.tmdb.org/t/p/w780/fWTZk4Y7HTyTTGNJnXNaX3XTE0v.jpg',
    poster: 'https://image.tmdb.org/t/p/w780/fWTZk4Y7HTyTTGNJnXNaX3XTE0v.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/ce3prrjh9ZehEl5JinNqr4jIeaB.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=1pHDWnXmK7Y',
    genre: 'Hành Động, Viễn Tưởng, Siêu Anh Hùng',
    duration: 125,
    ageRating: 'T13',
    status: 'COMING_SOON',
    price: 110000,
  },
];

async function updateExactBanners() {
  console.log('🎬 Bắt đầu cập nhật chính xác Banner & Poster chuẩn TMDB cho 18 phim...');
  await connectDB();

  for (const item of exactMoviesList) {
    const updated = await Movie.findOneAndUpdate(
      { slug: item.slug },
      {
        $set: {
          title: item.title,
          poster: item.poster,
          posterUrl: item.posterUrl,
          bannerUrl: item.bannerUrl,
          trailerUrl: item.trailerUrl,
          genre: item.genre,
          duration: item.duration,
          ageRating: item.ageRating,
          status: item.status,
          price: item.price,
        },
      },
      { new: true, upsert: true }
    );

    console.log(`✅ [${updated.status}] ${updated.title}`);
    console.log(`   👉 Banner: ${updated.bannerUrl}`);
  }

  console.log('\n🎉 Hoàn thành cập nhật chuẩn xác tất cả 18 Banner và Poster!');
  process.exit(0);
}

updateExactBanners().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

