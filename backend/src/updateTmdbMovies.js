import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Movie from './models/Movie.js';

const updatedMoviesData = [
  {
    title: 'Dune: Hành Tinh Cát – Phần 2',
    slug: 'dune-hanh-tinh-cat-phan-2',
    poster: 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/uhUO7vQQKvCTfQWubOt5MAKokbL.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
    genre: 'Khoa Học Viễn Tưởng, Hành Động, Phiêu Lưu',
    duration: 166,
    ageRating: 'T16',
    description: 'Paul Atreides hợp lực cùng Chani và tộc người Fremen để trả thù những kẻ đã hủy diệt gia tộc mình, đồng thời đối mặt với lựa chọn nghiệt ngã giữa tình yêu và định mệnh cứu rỗi vũ trụ.',
    status: 'NOW_SHOWING',
    price: 110000,
  },
  {
    title: 'Oppenheimer',
    slug: 'oppenheimer',
    poster: 'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/nb3xI8XI3w4pMVZ38VijbsyBqP4.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
    genre: 'Tiểu Sử, Lịch Sử, Kịch Tính',
    duration: 180,
    ageRating: 'T18',
    description: 'Tác phẩm đoạt giải Oscar của Christopher Nolan tái hiện cuộc đời đầy kịch tính của J. Robert Oppenheimer, cha đẻ bom nguyên tử trong Dự án Manhattan thời Thế chiến thứ hai.',
    status: 'NOW_SHOWING',
    price: 95000,
  },
  {
    title: 'Mai',
    slug: 'mai',
    poster: 'https://upload.wikimedia.org/wikipedia/vi/3/36/Mai_2024_poster.jpg',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/vi/3/36/Mai_2024_poster.jpg',
    bannerUrl: 'https://images.fptplay53.net/media/OTT/VOD/2024/09/11/mai-fpt-play-1726033804392_Landscape.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=q6g4hT1k2eI',
    genre: 'Tâm Lý, Tình Cảm, Gia Đình',
    duration: 131,
    ageRating: 'T18',
    description: 'Bộ phim điện ảnh cảm động của đạo diễn Trấn Thành kể về Mai - một người phụ nữ chịu nhiều định kiến xã hội và vết thương quá khứ, khao khát tìm lại hạnh phúc chân thật bên Dương.',
    status: 'NOW_SHOWING',
    price: 95000,
  },
  {
    title: 'Godzilla x Kong: Đế Chế Mới',
    slug: 'godzilla-x-kong-de-che-moi',
    poster: 'https://image.tmdb.org/t/p/w780/tMefBSflR6PGQLv7WvFPpKLZkyk.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w780/tMefBSflR6PGQLv7WvFPpKLZkyk.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/qrGtVFxaD8c7et0jUtaYhyTzzPg.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=lV1OOlGwExg',
    genre: 'Hành Động, Phiêu Lưu, Viễn Tưởng',
    duration: 115,
    ageRating: 'T13',
    description: 'Hai quái thú huyền thoại Godzilla và Kong phải gạt bỏ hiềm khích, bắt tay nhau chống lại một mối đe dọa sinh tử chưa từng thấy ẩn sâu trong lòng Trái Đất Rỗng.',
    status: 'NOW_SHOWING',
    price: 105000,
  },
  {
    title: 'Spider-Man: No Way Home (Người Nhện: Không Còn Nhà)',
    slug: 'spider-man-no-way-home',
    poster: 'https://image.tmdb.org/t/p/w780/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w780/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/zD5v1E4joAzFvmAEytt7fM3ivyT.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=JfVOs4VSpmA',
    genre: 'Hành Động, Phiêu Lưu, Siêu Anh Hùng',
    duration: 148,
    ageRating: 'T13',
    description: 'Danh tính bị phơi bày, Peter Parker nhờ cậy Doctor Strange thực hiện bùa phép lãng quên. Tuy nhiên câu thần chú sai lệch đã xé toạc đa vũ trụ, mở đường cho dàn ác nhân nguy hiểm nhất tràn vào.',
    status: 'NOW_SHOWING',
    price: 95000,
  },
  {
    title: 'Quật Mộ Trùng Ma (Exhuma)',
    slug: 'quat-mo-trung-ma',
    poster: 'https://image.tmdb.org/t/p/w780/6dasJ58GGFcC62H9KuukAryltUp.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w780/6dasJ58GGFcC62H9KuukAryltUp.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/kYWk8TW5TkpCWkB0mkUm72N0lb8.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=s56fN1vL-7s',
    genre: 'Kinh Dị, Bí Ẩn, Giật Gân',
    duration: 134,
    ageRating: 'T18',
    description: 'Hai pháp sư, một thầy phong thủy và một chuyên gia tang lễ nhận hợp đồng di dời một ngôi mộ cổ kỳ quái ở vùng hẻo lánh Hàn Quốc, từ đó vô tình giải phóng ác linh kinh hoàng gieo rắc tai ương.',
    status: 'NOW_SHOWING',
    price: 90000,
  },
  {
    title: 'Deadpool & Wolverine',
    slug: 'deadpool-and-wolverine',
    poster: 'https://image.tmdb.org/t/p/w780/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w780/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/cOoVcVQ3i1m5b2xtqKBtoTSbxC1.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=73_1biulkYk',
    genre: 'Hành Động, Hài Hước, Siêu Anh Hùng',
    duration: 128,
    ageRating: 'T18',
    description: 'Cơ quan Quản lý Phương sai Thời gian (TVA) lôi kéo Deadpool vào sứ mệnh giải cứu đa vũ trụ, buộc anh phải hợp tác cùng một Wolverine đang chán đời và cực kỳ bất đắc dĩ.',
    status: 'NOW_SHOWING',
    price: 110000,
  },
  {
    title: 'Kung Fu Panda 4',
    slug: 'kung-fu-panda-4',
    poster: 'https://image.tmdb.org/t/p/w780/kDp1vUBnMpe8ak4rjgl3cLELqjU.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w780/kDp1vUBnMpe8ak4rjgl3cLELqjU.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/3ffPx9jqg0yj9y1KWeagT7D20CB.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=_inKs4eeHiI',
    genre: 'Hoạt Hình, Hài Hước, Gia Đình',
    duration: 94,
    ageRating: 'P',
    description: 'Gấu Po được định mệnh lựa chọn làm Thủ lĩnh Tinh thần Thung lũng Hòa Bình. Chú phải tìm kiếm và huấn luyện Thần Long Đại Hiệp mới trước khi đối đầu Ả Tắc Kè Bông biến hình hiểm độc.',
    status: 'NOW_SHOWING',
    price: 90000,
  },
];

async function updateMovies() {
  await connectDB();

  console.log('🎬 Bắt đầu cập nhật poster & banner chất lượng cao chuẩn rạp...');

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
      { new: true }
    );

    if (updated) {
      console.log(`✅ Cập nhật thành công: ${updated.title}`);
      console.log(`   - Poster: ${updated.poster}`);
      console.log(`   - Banner: ${updated.bannerUrl}`);
      console.log(`   - Trailer: ${updated.trailerUrl}`);
    } else {
      console.log(`⚠️ Không tìm thấy phim phù hợp để cập nhật: ${item.title}`);
    }
  }

  // Đếm lại tổng số phim và kiểm tra xem có phim nào thừa hoặc không hợp lệ không
  const total = await Movie.countDocuments();
  console.log(`\n🎉 Hoàn thành! Tổng số phim trong Database: ${total}`);

  await mongoose.disconnect();
}

updateMovies().catch((err) => {
  console.error('❌ Lỗi cập nhật:', err);
  process.exit(1);
});

