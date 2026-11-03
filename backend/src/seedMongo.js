import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './config/db.js';
import AdminUser from './models/AdminUser.js';
import Concession from './models/Concession.js';
import Movie from './models/Movie.js';
import Cinema from './models/Cinema.js';
import Showtime from './models/Showtime.js';
import ShowtimeSeat from './models/ShowtimeSeat.js';
import Booking from './models/Booking.js';
import Promotion from './models/Promotion.js';
import Faq from './models/Faq.js';
import User from './models/User.js';

async function seed() {
  console.log('🍃 [MongoDB] Bắt đầu kết nối & nạp dữ liệu mẫu vào Database...');
  await connectDB();

  try {
    // 1. Dọn dẹp sạch dữ liệu cũ
    await ShowtimeSeat.deleteMany({});
    await Booking.deleteMany({});
    await Showtime.deleteMany({});
    await Cinema.deleteMany({});
    await Movie.deleteMany({});
    await Promotion.deleteMany({});
    await Faq.deleteMany({});
    await Concession.deleteMany({});
    await AdminUser.deleteMany({});
    await User.deleteMany({});
    console.log('🧹 Đã xóa sạch các collection cũ trong MongoDB');

    // 2. Tạo tài khoản Admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await AdminUser.create({
      email: 'admin@D'AVENOR.vn',
      name: 'Ban Quản Trị D'AVENOR',
      password: hashedPassword,
      role: 'ADMIN',
    });
    console.log(`👤 Đã tạo Admin: ${admin.email} (pass: admin123)`);

    // Tạo tài khoản Khách hàng mẫu
    const customerPassword = await bcrypt.hash('123456', 10);
    const demoUser = await User.create({
      name: 'Nguyễn Văn A',
      email: 'nguyen.van.a@example.com',
      phone: '0912345678',
      password: customerPassword,
      role: 'VIP',
      tier: 'GOLD_TIER',
      points: 250,
    });
    console.log(`👤 Đã tạo Khách hàng mẫu: ${demoUser.email} / ${demoUser.phone} (pass: 123456)`);

    // 3. Tạo danh mục Bắp Nước (Concessions)
    const concessions = await Concession.create([
      {
        name: 'Bắp Rang Bơ (Ngọt/Phô Mai)',
        price: 55000,
        description: 'Bắp ngô nổ truyền thống thơm lừng vị bơ hoặc phô mai hảo hạng',
        imageUrl: 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=300&auto=format&fit=crop',
      },
      {
        name: 'Nước Ngọt Coca-Cola (L)',
        price: 30000,
        description: 'Ly lớn 32oz ướp lạnh sảng khoái',
        imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&auto=format&fit=crop',
      },
      {
        name: 'Combo Solo (1 Bắp + 1 Nước)',
        price: 79000,
        description: 'Phù hợp thưởng thức phim một mình trọn vẹn',
        imageUrl: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=300&auto=format&fit=crop',
      },
      {
        name: 'Combo Couple (1 Bắp Lớn + 2 Nước)',
        price: 109000,
        description: 'Lựa chọn lý tưởng cho 2 người',
        imageUrl: 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?w=300&auto=format&fit=crop',
      },
    ]);
    console.log(`🍿 Đã tạo ${concessions.length} gói bắp nước`);

    // 4. Tạo các Cụm rạp (Cinemas)
    const cinemas = await Cinema.create([
      {
        name: 'D'AVENOR Landmark 81 IMAX',
        slug: 'landmark-81-imax',
        city: 'TP. Hồ Chí Minh',
        address: 'Tầng B1 Vincom Landmark 81, 720A Điện Biên Phủ, P.22, Q.Bình Thạnh, TP.HCM',
        distance: '1.8 km',
        isFlagship: true,
        rating: 4.9,
        reviewsCount: 2410,
        tags: ['IMAX Laser', 'Dolby Atmos', 'Gold Class'],
        specialBadge: 'Màn chiếu Laser 22x11m lớn nhất VN',
        image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
        openingHours: '08:00 - 02:00 sáng',
        hotline: '1900 8899',
        parking: 'Hầm B2 - B3 giữ xe 24/7 (Miễn phí 3h xem phim)',
        roomCount: 7,
      },
      {
        name: 'D'AVENOR Vincom Đồng Khởi',
        slug: 'vincom-dong-khoi',
        city: 'TP. Hồ Chí Minh',
        address: 'Tầng 3 Vincom Center, 72 Lê Thánh Tôn, P.Bến Nghé, Quận 1, TP.HCM',
        distance: '3.5 km',
        isFlagship: false,
        rating: 4.8,
        reviewsCount: 1890,
        tags: ['Dolby Atmos', '4DX Sound'],
        specialBadge: 'Trải nghiệm 4DX rung lắc độc quyền',
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop',
        openingHours: '08:30 - 01:30 sáng',
        hotline: '1900 8899',
        parking: 'Hầm B3 gửi xe máy & ô tô',
        roomCount: 6,
      },
      {
        name: 'D'AVENOR Sala Thủ Thiêm',
        slug: 'sala-thu-thiem',
        city: 'TP. Hồ Chí Minh',
        address: 'Tầng 4 Thiso Mall, 10 Mai Chí Thọ, P.Thủ Thiêm, TP.Thủ Đức, TP.HCM',
        distance: '4.2 km',
        isFlagship: false,
        rating: 4.9,
        reviewsCount: 1420,
        tags: ['IMAX Laser', 'Sweetbox Lounge'],
        specialBadge: 'Cụm rạp mới khai trương chuẩn quốc tế',
        image: 'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=1200&auto=format&fit=crop',
        openingHours: '09:00 - 01:00 sáng',
        hotline: '1900 8899',
        parking: 'Bãi xe Thiso Mall miễn phí 4h',
        roomCount: 8,
      },
      {
        name: 'D'AVENOR Crescent Mall',
        slug: 'crescent-mall',
        city: 'TP. Hồ Chí Minh',
        address: 'Tầng 5 Crescent Mall, Nguyễn Văn Linh, P.Tân Phú, Quận 7, TP.HCM',
        distance: '4.8 km',
        isFlagship: false,
        rating: 4.7,
        reviewsCount: 980,
        tags: ['Dolby Atmos', 'Kids Hall'],
        specialBadge: 'Khu vực Kids Cinema & Family Lounge',
        image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop',
        openingHours: '08:30 - 24:00',
        hotline: '1900 8899',
        parking: 'Hầm B1 & B2 Crescent Mall',
        roomCount: 6,
      },
      {
        name: 'D'AVENOR Vạn Hạnh Mall',
        slug: 'van-hanh-mall',
        city: 'TP. Hồ Chí Minh',
        address: 'Tầng 6 Vạn Hạnh Mall, 11 Sư Vạn Hạnh, Phường 12, Quận 10, TP.HCM',
        distance: '5.1 km',
        isFlagship: false,
        rating: 4.8,
        reviewsCount: 2150,
        tags: ['Dolby Atmos'],
        specialBadge: 'Sảnh chờ phong cách Cyberpunk hiện đại',
        image: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=1200&auto=format&fit=crop',
        openingHours: '08:00 - 01:30 sáng',
        hotline: '1900 8899',
        parking: 'Nhà xe 9 tầng Vạn Hạnh Mall',
        roomCount: 7,
      },
      // Hà Nội
      {
        name: 'D'AVENOR Vincom Bà Triệu',
        slug: 'vincom-ba-trieu',
        city: 'Hà Nội',
        address: 'Tầng 6 Vincom Center, 191 Bà Triệu, Q.Hai Bà Trưng, Hà Nội',
        distance: '2.1 km',
        isFlagship: true,
        rating: 4.9,
        reviewsCount: 3100,
        tags: ['IMAX Laser', 'Dolby Atmos', 'Gold Class'],
        specialBadge: 'Cụm rạp flagship thủ đô với phòng chiếu IMAX thế hệ mới',
        image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
        openingHours: '08:00 - 02:00 sáng',
        hotline: '1900 8899',
        parking: 'Hầm B1 & B2 Vincom Bà Triệu',
        roomCount: 8,
      },
      {
        name: 'D'AVENOR Lotte Mall Tây Hồ',
        slug: 'lotte-mall-tay-ho',
        city: 'Hà Nội',
        address: 'Tầng 4 Lotte Mall, 272 Võ Chí Công, Tây Hồ, Hà Nội',
        distance: '4.5 km',
        isFlagship: false,
        rating: 4.9,
        reviewsCount: 2240,
        tags: ['IMAX Laser', 'Sweetbox Lounge'],
        specialBadge: 'Trải nghiệm rạp chiếu cao cấp phong cách Hàn Quốc',
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop',
        openingHours: '08:30 - 01:30 sáng',
        hotline: '1900 8899',
        parking: 'Bãi đỗ xe thông minh Lotte Mall',
        roomCount: 9,
      },
      // Đà Nẵng
      {
        name: 'D'AVENOR Vincom Ngô Quyền',
        slug: 'vincom-ngo-quyen-danang',
        city: 'Đà Nẵng',
        address: 'Tầng 4 Vincom Plaza, 910A Ngô Quyền, Q.Sơn Trà, Đà Nẵng',
        distance: '1.2 km',
        isFlagship: true,
        rating: 4.8,
        reviewsCount: 1650,
        tags: ['Dolby Atmos', '4DX Sound'],
        specialBadge: 'Rạp chiếu view sông Hàn lung linh',
        image: 'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=1200&auto=format&fit=crop',
        openingHours: '08:30 - 01:00 sáng',
        hotline: '1900 8899',
        parking: 'Hầm gửi xe Vincom Plaza miễn phí',
        roomCount: 6,
      },
      // Hải Phòng
      {
        name: 'D'AVENOR Aeon Mall Lê Chân',
        slug: 'aeon-mall-le-chan-haiphong',
        city: 'Hải Phòng',
        address: 'Tầng 3 Aeon Mall, Số 10 Võ Nguyên Giáp, Q.Lê Chân, Hải Phòng',
        distance: '3.0 km',
        isFlagship: false,
        rating: 4.9,
        reviewsCount: 1820,
        tags: ['IMAX Laser', 'Dolby Atmos'],
        specialBadge: 'Màn chiếu IMAX Laser khổng lồ tại thành phố Cảng',
        image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop',
        openingHours: '09:00 - 24:00',
        hotline: '1900 8899',
        parking: 'Bãi đỗ xe Aeon Mall sức chứa 5000 xe',
        roomCount: 8,
      },
      // Cần Thơ
      {
        name: 'D'AVENOR Vincom Hùng Vương',
        slug: 'vincom-hung-vuong-cantho',
        city: 'Cần Thơ',
        address: 'Số 2 Hùng Vương, P.Thới Bình, Q.Ninh Kiều, Cần Thơ',
        distance: '1.5 km',
        isFlagship: false,
        rating: 4.8,
        reviewsCount: 1340,
        tags: ['Dolby Atmos', 'Gold Class'],
        specialBadge: 'Cụm rạp chuẩn quốc tế trung tâm Tây Đô',
        image: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=1200&auto=format&fit=crop',
        openingHours: '08:30 - 24:00',
        hotline: '1900 8899',
        parking: 'Hầm B1 Vincom Plaza',
        roomCount: 6,
      },
      // Hà Tĩnh
      {
        name: 'D'AVENOR Vincom Hà Tĩnh',
        slug: 'vincom-ha-tinh',
        city: 'Hà Tĩnh',
        address: 'Tầng 3 Vincom Plaza Hà Tĩnh, Ngã tư Hà Huy Tập - Hàm Nghi, TP.Hà Tĩnh',
        distance: '0.8 km',
        isFlagship: false,
        rating: 4.9,
        reviewsCount: 1120,
        tags: ['Dolby Atmos', 'Kids Hall'],
        specialBadge: 'Cụm rạp điện ảnh hiện đại bậc nhất khu vực Bắc Trung Bộ',
        image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
        openingHours: '08:30 - 23:30',
        hotline: '1900 8899',
        parking: 'Bãi đỗ xe Vincom Hà Tĩnh rộng rãi',
        roomCount: 5,
      },
      // Bình Dương
      {
        name: 'D'AVENOR Aeon Mall Bình Dương',
        slug: 'aeon-mall-binh-duong',
        city: 'Bình Dương',
        address: 'Số 01 Đại lộ Bình Dương, Khu phố Bình Giao, TP.Thuận An, Bình Dương',
        distance: '2.5 km',
        isFlagship: false,
        rating: 4.8,
        reviewsCount: 1750,
        tags: ['IMAX Laser', 'Dolby Atmos'],
        specialBadge: 'Phòng chiếu laser sắc nét phục vụ tín đồ điện ảnh Bình Dương',
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop',
        openingHours: '09:00 - 24:00',
        hotline: '1900 8899',
        parking: 'Bãi xe Aeon Mall Canary',
        roomCount: 7,
      },
      // Đồng Nai
      {
        name: 'D'AVENOR Vincom Biên Hòa',
        slug: 'vincom-bien-hoa',
        city: 'Đồng Nai',
        address: '1096 Phạm Văn Thuận, P.Tân Mai, TP.Biên Hòa, Đồng Nai',
        distance: '1.9 km',
        isFlagship: false,
        rating: 4.7,
        reviewsCount: 1290,
        tags: ['Dolby Atmos'],
        specialBadge: 'Cụm rạp sôi động tại trung tâm Biên Hòa',
        image: 'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=1200&auto=format&fit=crop',
        openingHours: '08:30 - 24:00',
        hotline: '1900 8899',
        parking: 'Hầm B1 Vincom Biên Hòa',
        roomCount: 6,
      },
      // Khánh Hòa
      {
        name: 'D'AVENOR Vincom Nha Trang',
        slug: 'vincom-nha-trang',
        city: 'Khánh Hòa',
        address: 'Tầng 4 Vincom Plaza Trần Phú, 78-80 Trần Phú, Lộc Thọ, Nha Trang, Khánh Hòa',
        distance: '1.0 km',
        isFlagship: false,
        rating: 4.8,
        reviewsCount: 1480,
        tags: ['Dolby Atmos', 'Gold Class'],
        specialBadge: 'Rạp chiếu phố biển Nha Trang chuẩn 5 sao',
        image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop',
        openingHours: '08:30 - 01:00 sáng',
        hotline: '1900 8899',
        parking: 'Hầm gửi xe Vincom Trần Phú',
        roomCount: 6,
      },
    ]);
    console.log(`🏢 Đã tạo ${cinemas.length} cụm rạp trong Database`);

    // 5. Tạo danh sách Phim chính thức với TMDB poster & backdrop 4K
    const movies = await Movie.create([
      {
        title: 'Dune: Hành Tinh Cát – Phần 2',
        slug: 'dune-hanh-tinh-cat-phan-2',
        posterUrl: 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
        poster: 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/original/uhUO7vQQKvCTfQWubOt5MAKokbL.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
        description: 'Paul Atreides hợp lực cùng Chani và tộc người Fremen để trả thù những kẻ đã hủy diệt gia tộc mình, đồng thời đối mặt với lựa chọn nghiệt ngã giữa tình yêu và định mệnh vũ trụ.',
        genre: 'Khoa Học Viễn Tưởng, Hành Động, Phiêu Lưu',
        duration: 166,
        ageRating: 'T16',
        releaseDate: new Date('2026-03-01'),
        status: 'NOW_SHOWING',
        price: 110000,
      },
      {
        title: 'Mai',
        slug: 'mai',
        posterUrl: 'https://upload.wikimedia.org/wikipedia/vi/3/36/Mai_2024_poster.jpg',
        poster: 'https://upload.wikimedia.org/wikipedia/vi/3/36/Mai_2024_poster.jpg',
        bannerUrl: 'https://images.fptplay53.net/media/OTT/VOD/2024/09/11/mai-fpt-play-1726033804392_Landscape.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=q6g4hT1k2eI',
        description: 'Phim điện ảnh tình cảm sâu sắc của đạo diễn Trấn Thành về cuộc đời người phụ nữ tên Mai khao khát tìm thấy tình yêu chân thật.',
        genre: 'Tâm Lý, Tình Cảm, Gia Đình',
        duration: 131,
        ageRating: 'T18',
        releaseDate: new Date('2026-02-10'),
        status: 'NOW_SHOWING',
        price: 95000,
      },
      {
        title: 'Spider-Man: No Way Home (Người Nhện: Không Còn Nhà)',
        slug: 'spider-man-no-way-home',
        posterUrl: 'https://image.tmdb.org/t/p/w780/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
        poster: 'https://image.tmdb.org/t/p/w780/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/original/zD5v1E4joAzFvmAEytt7fM3ivyT.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=JfVOs4VSpmA',
        description: 'Sau khi danh tính Người Nhện bị bại lộ, phép thuật rạn nứt của Doctor Strange đã vô tình mở toang đa vũ trụ, giải phóng dàn ác nhân nguy hiểm nhất.',
        genre: 'Hành Động, Phiêu Lưu, Siêu Anh Hùng',
        duration: 148,
        ageRating: 'T13',
        releaseDate: new Date('2026-04-10'),
        status: 'NOW_SHOWING',
        price: 95000,
      },
      {
        title: 'Quật Mộ Trùng Ma (Exhuma)',
        slug: 'quat-mo-trung-ma',
        posterUrl: 'https://image.tmdb.org/t/p/w780/6dasJ58GGFcC62H9KuukAryltUp.jpg',
        poster: 'https://image.tmdb.org/t/p/w780/6dasJ58GGFcC62H9KuukAryltUp.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/original/kYWk8TW5TkpCWkB0mkUm72N0lb8.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=s56fN1vL-7s',
        description: 'Hai pháp sư, một thầy phong thủy và một chuyên gia tang lễ hợp tác di dời ngôi mộ cổ kỳ quái ở Hàn Quốc, giải phóng ác linh kinh hoàng.',
        genre: 'Kinh Dị, Bí Ẩn, Giật Gân',
        duration: 134,
        ageRating: 'T18',
        releaseDate: new Date('2026-03-15'),
        status: 'NOW_SHOWING',
        price: 90000,
      },
      {
        title: 'Oppenheimer',
        slug: 'oppenheimer',
        posterUrl: 'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        poster: 'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/original/nb3xI8XI3w4pMVZ38VijbsyBqP4.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
        description: 'Câu chuyện lịch sử về nhà vật lý lý thuyết J. Robert Oppenheimer và dự án Manhattan chế tạo quả bom nguyên tử đầu tiên.',
        genre: 'Tiểu Sử, Lịch Sử, Kịch Tính',
        duration: 180,
        ageRating: 'T18',
        releaseDate: new Date('2026-07-20'),
        status: 'NOW_SHOWING',
        price: 95000,
      },
      {
        title: 'Deadpool & Wolverine',
        slug: 'deadpool-and-wolverine',
        posterUrl: 'https://image.tmdb.org/t/p/w780/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
        poster: 'https://image.tmdb.org/t/p/w780/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/original/cOoVcVQ3i1m5b2xtqKBtoTSbxC1.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=73_1biulkYk',
        genre: 'Hành Động, Hài Hước, Siêu Anh Hùng',
        duration: 128,
        ageRating: 'T18',
        releaseDate: new Date('2026-07-26'),
        status: 'NOW_SHOWING',
        price: 110000,
      },
      {
        title: 'Godzilla x Kong: Đế Chế Mới',
        slug: 'godzilla-x-kong-de-che-moi',
        posterUrl: 'https://image.tmdb.org/t/p/w780/tMefBSflR6PGQLv7WvFPpKLZkyk.jpg',
        poster: 'https://image.tmdb.org/t/p/w780/tMefBSflR6PGQLv7WvFPpKLZkyk.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/original/qrGtVFxaD8c7et0jUtaYhyTzzPg.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=lV1OOlGwExg',
        genre: 'Hành Động, Phiêu Lưu, Viễn Tưởng',
        duration: 115,
        ageRating: 'T13',
        releaseDate: new Date('2026-03-29'),
        status: 'NOW_SHOWING',
        price: 105000,
      },
      {
        title: 'Kung Fu Panda 4',
        slug: 'kung-fu-panda-4',
        posterUrl: 'https://image.tmdb.org/t/p/w780/kDp1vUBnMpe8ak4rjgl3cLELqjU.jpg',
        poster: 'https://image.tmdb.org/t/p/w780/kDp1vUBnMpe8ak4rjgl3cLELqjU.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/original/3ffPx9jqg0yj9y1KWeagT7D20CB.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=_inKs4eeHiI',
        genre: 'Hoạt Hình, Hài Hước, Gia Đình',
        duration: 94,
        ageRating: 'P',
        releaseDate: new Date('2026-03-08'),
        status: 'NOW_SHOWING',
        price: 90000,
      },
    ]);
    console.log(`🎬 Đã tạo ${movies.length} bộ phim`);

    // 6. Tạo Suất chiếu (Showtimes) và Ghế (ShowtimeSeat)
    const landmarkCinema = cinemas[0];
    const duneMovie = movies[0];
    const maiMovie = movies[1];
    const pandaMovie = movies[2];

    const showtimesToCreate = [
      // Dune 2 tại Landmark 81 IMAX
      {
        cinemaId: landmarkCinema._id,
        movieId: duneMovie._id,
        roomName: 'Phòng 01 - IMAX Laser 3D',
        formatFeature: 'Màn hình cong 1.43:1',
        hour: 18,
        min: 30,
        price: 160000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: duneMovie._id,
        roomName: 'Phòng 01 - IMAX Laser 3D',
        formatFeature: 'Màn hình cong 1.43:1',
        hour: 21,
        min: 15,
        price: 160000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: duneMovie._id,
        roomName: 'Phòng 03 - 2D Phụ Đề Atmos',
        formatFeature: '64 kênh âm thanh vòm',
        hour: 17,
        min: 0,
        price: 110000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: duneMovie._id,
        roomName: 'Phòng 03 - 2D Phụ Đề Atmos',
        formatFeature: '64 kênh âm thanh vòm',
        hour: 19,
        min: 45,
        price: 110000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: duneMovie._id,
        roomName: 'Phòng 03 - 2D Phụ Đề Atmos',
        formatFeature: '64 kênh âm thanh vòm',
        hour: 22,
        min: 30,
        price: 110000,
      },

      // Mai tại Landmark 81 IMAX
      {
        cinemaId: landmarkCinema._id,
        movieId: maiMovie._id,
        roomName: 'Phòng 02 - 2D Tiêu Chuẩn',
        formatFeature: 'Màn chiếu sắc nét 4K',
        hour: 18,
        min: 0,
        price: 95000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: maiMovie._id,
        roomName: 'Phòng 02 - 2D Tiêu Chuẩn',
        formatFeature: 'Màn chiếu sắc nét 4K',
        hour: 19,
        min: 30,
        price: 95000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: maiMovie._id,
        roomName: 'Phòng 02 - 2D Tiêu Chuẩn',
        formatFeature: 'Màn chiếu sắc nét 4K',
        hour: 20,
        min: 45,
        price: 95000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: maiMovie._id,
        roomName: 'Phòng 02 - 2D Tiêu Chuẩn',
        formatFeature: 'Màn chiếu sắc nét 4K',
        hour: 22,
        min: 15,
        price: 95000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: maiMovie._id,
        roomName: 'Phòng 05 - VIP Gold Class',
        formatFeature: 'Ghế da Recliner ngả 180°',
        hour: 19,
        min: 15,
        price: 250000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: maiMovie._id,
        roomName: 'Phòng 05 - VIP Gold Class',
        formatFeature: 'Ghế da Recliner ngả 180°',
        hour: 21,
        min: 40,
        price: 250000,
      },

      // Kung Fu Panda 4 tại Landmark 81 IMAX
      {
        cinemaId: landmarkCinema._id,
        movieId: pandaMovie._id,
        roomName: 'Phòng 04 - 2D Lồng Tiếng',
        formatFeature: 'Thích hợp cho trẻ em',
        hour: 17,
        min: 15,
        price: 85000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: pandaMovie._id,
        roomName: 'Phòng 04 - 2D Lồng Tiếng',
        formatFeature: 'Thích hợp cho trẻ em',
        hour: 18,
        min: 45,
        price: 85000,
      },
      {
        cinemaId: landmarkCinema._id,
        movieId: pandaMovie._id,
        roomName: 'Phòng 04 - 2D Lồng Tiếng',
        formatFeature: 'Thích hợp cho trẻ em',
        hour: 20,
        min: 15,
        price: 85000,
      },
    ];

    // Thêm các suất chiếu cho các rạp còn lại
    for (let i = 1; i < cinemas.length; i++) {
      const c = cinemas[i];
      showtimesToCreate.push(
        {
          cinemaId: c._id,
          movieId: duneMovie._id,
          roomName: 'Phòng 01 - 2D Dolby Atmos',
          formatFeature: 'Âm thanh vòm sống động',
          hour: 18,
          min: 0,
          price: 105000,
        },
        {
          cinemaId: c._id,
          movieId: duneMovie._id,
          roomName: 'Phòng 01 - 2D Dolby Atmos',
          formatFeature: 'Âm thanh vòm sống động',
          hour: 21,
          min: 0,
          price: 105000,
        },
        {
          cinemaId: c._id,
          movieId: maiMovie._id,
          roomName: 'Phòng 02 - 2D Tiêu Chuẩn',
          formatFeature: 'Màn chiếu 4K Laser',
          hour: 19,
          min: 30,
          price: 95000,
        }
      );
    }

    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const cols = [1, 2, 3, 4, 5, 6, 7, 8];
    let createdShowtimesCount = 0;
    let createdSeatsCount = 0;

    for (const item of showtimesToCreate) {
      const startTime = new Date();
      startTime.setHours(item.hour, item.min, 0, 0);

      const showtime = await Showtime.create({
        cinemaId: item.cinemaId,
        movieId: item.movieId,
        roomName: item.roomName,
        formatFeature: item.formatFeature,
        startTime,
        price: item.price,
      });
      createdShowtimesCount++;

      // Tự động sinh ma trận 48 ghế (A1 - F8)
      const seatDocs = [];
      for (const r of rows) {
        for (const c of cols) {
          const isVip = ['E', 'F'].includes(r);
          seatDocs.push({
            showtimeId: showtime._id,
            seatNumber: `${r}${c}`,
            row: r,
            col: c,
            type: isVip ? 'VIP' : 'STANDARD',
            status: 'AVAILABLE',
          });
        }
      }
      await ShowtimeSeat.insertMany(seatDocs);
      createdSeatsCount += seatDocs.length;
    }

    // 7. Tạo Kho Khuyến Mãi & Voucher
    await Promotion.create([
      // Hero Deal
      {
        type: 'HERO_DEAL',
        badgeTop: '⚡ SIÊU BÃO THỨ 3 TOÀN QUỐC',
        title: 'THỨ 3 VUI VẺ — ĐỒNG GIÁ VÉ 45K',
        description:
          'Thưởng thức mọi bom tấn màn ảnh rộng Laser hiện đại nhất D'AVENOR với giá vé chỉ 45.000đ. Tặng kèm 01 bắp ngọt Caramel thơm lừng khi áp dụng mua vé đôi online hôm nay.',
        discountValue: '-50%',
        subtitle: 'Bắp Lớn + Nước Ngọt',
        conditions: 'Miễn phí cho bạn và đối tác/bạn bè',
        image: 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=600&auto=format&fit=crop',
        buttonText: 'Săn ưu đãi ngay',
        buttonAction: '/theaters',
        order: 1,
      },

      // Vouchers đổi thưởng
      {
        type: 'VOUCHER',
        title: 'Giảm 20K Vé Phim',
        badgeTop: 'VÉ PHIM',
        expiryDate: 'HSD: 15/12',
        discountValue: 'GIẢM 20K',
        conditions: 'Đơn từ 120.000đ áp dụng cho mọi định dạng phim 2D.',
        code: 'MTX20K',
        order: 1,
      },
      {
        type: 'VOUCHER',
        title: 'Giảm 15% Bắp Nước',
        badgeTop: 'BẮP NƯỚC',
        expiryDate: 'HSD: 18/12',
        discountValue: 'GIẢM 15%',
        conditions: 'Áp dụng trực tiếp Combo Bắp Nước đơn từ 1 phần.',
        code: 'POPCORN15',
        order: 2,
      },
      {
        type: 'VOUCHER',
        title: 'Vé 45.000đ Học Sinh U22',
        badgeTop: 'HỌC SINH U22',
        expiryDate: 'HSD: 30/12',
        discountValue: 'VÉ 45.000Đ',
        conditions: 'Áp dụng thẻ HSSV & CCCD mọi khung giờ trong ngày.',
        code: 'STUDENT45',
        order: 3,
      },
      {
        type: 'VOUCHER',
        title: 'Hoàn 30K VNPAY-QR',
        badgeTop: 'VNPAY-QR',
        expiryDate: 'HSD: 28/12',
        discountValue: 'HOÀN 30K',
        conditions: 'Thanh toán qua ví điện tử VNPAY-QR cho đơn từ 150.000đ.',
        code: 'VNPAY30',
        order: 4,
      },
      {
        type: 'VOUCHER',
        title: 'Tặng Nước IMAX Laser',
        badgeTop: 'IMAX LASER',
        expiryDate: 'HSD: 24/12',
        discountValue: 'TẶNG NƯỚC',
        conditions: 'Nhận 01 ly nước ngọt 32oz khi xem tại Landmark 81.',
        code: 'IMAXFREE',
        order: 5,
      },

      // 6 Chương trình khuyến mãi nổi bật
      {
        type: 'PROGRAM',
        category: 'TICKET',
        badgeTop: '📅 Mỗi thứ 4 hàng tuần',
        badgeSpecial: '50.000đ',
        badgeColor: 'amber',
        title: 'Thứ 4 Happy Day – Đồng Giá 50K Mọi Định Dạng',
        description:
          'Thưởng thức tất cả các bom tấn điện ảnh với mức giá ưu đãi đồng nhất 50.000đ/vé vào mỗi thứ Tư hàng tuần tại toàn bộ cụm rạp.',
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop',
        metadataLeft: '📍 Tất cả cụm rạp',
        metadataRight: '📅 Cả ngày Thứ 4',
        buttonText: 'Đặt vé ngay',
        buttonAction: '/theaters',
        order: 1,
      },
      {
        type: 'PROGRAM',
        category: 'CONCESSION',
        badgeTop: '🥤 15/11 - 30/11/2026',
        badgeSpecial: 'TẶNG LY VIP',
        badgeColor: 'emerald',
        title: 'Combo Bắp Nước Avatar Limited Edition – Tặng Bình Nước',
        description:
          'Sở hữu ngay ly nước phiên bản cực kỳ tinh xảo kèm bắp nước lớn, tặng kèm voucher giảm giá 20% cho lần xem phim tiếp theo.',
        image: 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?w=600&auto=format&fit=crop',
        metadataLeft: '🍿 Bắp Jumbo + Nước 32oz',
        metadataRight: '🎁 Còn 150 bộ',
        buttonText: 'Mua combo',
        buttonAction: '/checkout',
        order: 2,
      },
      {
        type: 'PROGRAM',
        category: 'VIP',
        badgeTop: '👑 Dành riêng hội viên VIP',
        badgeSpecial: 'X3 POINTS',
        badgeColor: 'amber',
        title: 'Đặc Quyền Hội Viên D'AVENOR Prime – Nhân 3 Điểm Tích Lũy',
        description:
          'Tích lũy gấp 3 lần điểm thưởng cho tất cả các giao dịch vé và bắp nước trực tuyến, đổi vé miễn phí dễ dàng trong tháng sinh nhật.',
        image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&auto=format&fit=crop',
        metadataLeft: '⭐ Hạng Vàng & Kim Cương',
        metadataRight: '🎁 Tặng vé sinh nhật',
        buttonText: 'Nâng cấp VIP',
        buttonAction: '/admin/login',
        order: 3,
      },
      {
        type: 'PROGRAM',
        category: 'STUDENT',
        badgeTop: '🎒 Thứ 2 - Thứ 6 (Trước 17:00)',
        badgeSpecial: '45.000đ',
        badgeColor: 'blue',
        title: 'Ưu Đãi Học Sinh - Sinh Viên & U22: Giá Vé Đồng Nhất',
        description:
          'Xuất trình thẻ HSSV hoặc CCCD dưới 22 tuổi để nhận ngay giá vé ưu đãi 45.000đ áp dụng cho tất cả suất chiếu 2D trước 17h00.',
        image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop',
        metadataLeft: '🎓 Thẻ HSSV / CCCD',
        metadataRight: 'Không giới hạn số vé',
        buttonText: 'Đặt vé áp dụng',
        buttonAction: '/theaters',
        order: 4,
      },
      {
        type: 'PROGRAM',
        category: 'PAYMENT',
        badgeTop: '💳 Thứ 6, Thứ 7 & CN',
        badgeSpecial: '-25.000đ',
        badgeColor: 'amber',
        title: 'Quét VNPAY-QR – Giảm Ngay 25.000đ Vào Cuối Tuần',
        description:
          'Nhập mã VNPAYMOVIE khi thanh toán đơn hàng từ 150.000đ tại cổng thanh toán trực tuyến D'AVENOR (số lượng có hạn mỗi tuần).',
        image: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=600&auto=format&fit=crop',
        metadataLeft: '🏦 Cổng VNPAY',
        metadataRight: '🎁 Còn 420 suất tuần này',
        buttonText: 'Đặt vé ngay',
        buttonAction: '/theaters',
        order: 5,
      },
      {
        type: 'PROGRAM',
        category: 'EXPERIENCE',
        badgeTop: '📍 Landmark 81 & Sala',
        badgeSpecial: 'GIẢM 20%',
        badgeColor: 'amber',
        title: 'Gói Trải Nghiệm IMAX Laser & Gold Class – Sang Trọng Đẳng Cấp',
        description:
          'Trải nghiệm công nghệ chiếu phim đỉnh cao màn hình cực đại và ghế sofa VIP ngả khoang riêng với mức giá ưu đãi đặc biệt cho cặp đôi.',
        image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop',
        metadataLeft: '🎬 Định dạng IMAX Laser & Gold',
        metadataRight: '🍷 Tặng cồn & nước cao cấp',
        buttonText: 'Chọn ghế IMAX',
        buttonAction: '/theaters',
        order: 6,
      },
    ]);
    console.log(`🎁 Đã tạo toàn bộ Kho Khuyến Mãi & Voucher trong MongoDB`);

    // 8. Tạo Danh mục Câu hỏi thường gặp (FAQ)
    await Faq.create([
      {
        question: 'Tôi đã bị trừ tiền ngân hàng nhưng chưa nhận được mã vé hoặc SMS xác nhận?',
        answer:
          'Bạn hoàn toàn yên tâm, hệ thống D'AVENOR luôn bảo lưu giao dịch hợp lệ:\n• Vui lòng kiểm tra kỹ thư mục Hộp thư rác (Spam / Junk) hoặc SMS điện thoại đã đăng ký.\n• Mở mục "Vé của tôi" trên ứng dụng D'AVENOR để đối chiếu tức thì theo số điện thoại đặt vé.\n• Nếu sau 15 phút trạng thái chưa được cập nhật, hãy nhập Mã giao dịch ngân hàng vào biểu mẫu bên cạnh hoặc liên hệ tổng đài 1900 8866 để nhân viên kích hoạt giữ ghế khẩn cấp.',
        category: 'PAYMENT',
        likes: 428,
        dislikes: 12,
        isDefaultOpen: true,
        order: 1,
      },
      {
        question: 'Quy định độ tuổi xem phim T13, T16, T18 tại rạp D'AVENOR như thế nào?',
        answer:
          'Hệ thống rạp D'AVENOR áp dụng quy chuẩn phân loại độ tuổi của Bộ Văn hóa, Thể thao và Du lịch:\n• Nhãn P: Phim dành cho mọi đối tượng khán giả.\n• Nhãn T13: Dành cho khán giả từ đủ 13 tuổi trở lên.\n• Nhãn T16: Dành cho khán giả từ đủ 16 tuổi trở lên.\n• Nhãn T18: Dành cho khán giả từ đủ 18 tuổi trở lên.\n*Lưu ý: Quý khách vui lòng mang theo Căn cước công dân hoặc ứng dụng VNeID để nhân viên đối soát tại cửa vào.',
        category: 'TICKET_CINEMA',
        likes: 312,
        dislikes: 5,
        isDefaultOpen: false,
        order: 2,
      },
      {
        question: 'Vé đã thanh toán thành công có được hoàn tiền hoặc đổi suất chiếu không?',
        answer:
          'Theo quy định chung, vé xem phim đã thanh toán thành công KHÔNG thể hoàn tiền mặt. Tuy nhiên, khách hàng thành viên có thể được hỗ trợ đổi suất chiếu hoặc chuyển sang phim khác trước giờ chiếu ít nhất 60 phút tại quầy vé của cụm rạp đã đặt vé.',
        category: 'TICKET_CINEMA',
        likes: 245,
        dislikes: 8,
        isDefaultOpen: false,
        order: 3,
      },
      {
        question: 'Làm thế nào để áp dụng cùng lúc nhiều mã giảm giá và voucher bắp nước?',
        answer:
          'Tại bước Thanh toán (Checkout), hệ thống cho phép bạn áp dụng đồng thời tối đa 01 voucher giảm giá vé xem phim và 01 voucher ưu đãi bắp nước combo. Bạn chỉ cần nhập mã tại ô "Mã Voucher" hoặc chọn từ danh sách voucher đã lưu.',
        category: 'PAYMENT',
        likes: 189,
        dislikes: 3,
        isDefaultOpen: false,
        order: 4,
      },
      {
        question: 'Tôi đến rạp trễ thì có được vào phòng chiếu không?',
        answer:
          'Quý khách vẫn có thể vào phòng chiếu bình thường sau giờ chiếu phim. Tuy nhiên, để không làm ảnh hưởng đến trải nghiệm của các khán giả khác trong rạp, nhân viên soát vé sẽ hỗ trợ dùng đèn pin dẫn bạn vào chỗ ngồi đã đặt một cách nhanh chóng và trật tự.',
        category: 'TICKET_CINEMA',
        likes: 156,
        dislikes: 2,
        isDefaultOpen: false,
        order: 5,
      },
      {
        question: 'Làm sao để đặt vé nguyên phòng hoặc tổ chức sự kiện họp báo tại rạp D'AVENOR?',
        answer:
          'D'AVENOR cung cấp dịch vụ thuê trọn phòng chiếu (Hall Rental) cho sự kiện công ty, họp fanclub, sinh nhật hoặc chiếu phim riêng tư cho đoàn từ 20 người trở lên. Vui lòng liên hệ bộ phận B2B qua hotline 1900 8866 hoặc gửi yêu cầu vào form bên cạnh để nhận báo giá ưu đãi trong 2 giờ.',
        category: 'MEMBERSHIP',
        likes: 210,
        dislikes: 4,
        isDefaultOpen: false,
        order: 6,
      },
    ]);
    console.log(`❓ Đã tạo toàn bộ Danh mục FAQ Hỏi Đáp Trực Tiếp trong MongoDB`);

    console.log(`🎟️ Đã tạo ${createdShowtimesCount} suất chiếu và ${createdSeatsCount} ghế ngồi trong MongoDB`);
    console.log('🎉 [MongoDB] Toàn bộ dữ liệu Rạp, Phim, Suất chiếu & Ghế đã được lưu thành công vào Database!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi nạp dữ liệu:', error);
    process.exit(1);
  }
}

seed();

