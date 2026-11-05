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

// Danh sách toàn diện 12 cụm rạp D'AVENOR CINEMA phủ khắp 6 quận tại TP. Đà Nẵng
export const DA_NANG_CINEMAS_DATA = [
  // 1. QUẬN HẢI CHÂU (Trung tâm)
  {
    name: "D'AVENOR Indochina Riverside",
    slug: 'indochina-riverside-danang',
    city: 'Đà Nẵng',
    district: 'Hải Châu',
    address: 'Tầng 3 Indochina Riverside Mall, 74 Bạch Đằng, Q. Hải Châu, Đà Nẵng',
    distance: '1.0 km',
    isFlagship: false,
    rating: 4.9,
    reviewsCount: 1650,
    tags: ['IMAX Laser', 'Gold Class'],
    specialBadge: 'Phòng chiếu chuẩn quốc tế view sông Hàn',
    image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
    openingHours: '08:00 - 02:00 sáng',
    hotline: '1900 8899',
    parking: 'Hầm B1 & B2 Indochina Mall',
    roomCount: 6,
  },
  {
    name: "D'AVENOR Lotte Mart Đà Nẵng",
    slug: 'lotte-mart-danang',
    city: 'Đà Nẵng',
    district: 'Hải Châu',
    address: 'Tầng 5 Lotte Mart Đà Nẵng, 06 Nại Nam, P. Hòa Cường Bắc, Q. Hải Châu, Đà Nẵng',
    distance: '2.8 km',
    isFlagship: false,
    rating: 4.8,
    reviewsCount: 1420,
    tags: ['Dolby Atmos', 'Sweetbox Lounge'],
    specialBadge: 'Cụm rạp giải trí gia đình số 1',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop',
    openingHours: '08:30 - 01:30 sáng',
    hotline: '1900 8899',
    parking: 'Bãi đỗ xe Lotte Mart miễn phí',
    roomCount: 7,
  },

  // 2. QUẬN SƠN TRÀ
  {
    name: "D'AVENOR Vincom Ngô Quyền",
    slug: 'vincom-ngo-quyen-danang',
    city: 'Đà Nẵng',
    district: 'Sơn Trà',
    address: 'Tầng 4 Vincom Plaza, 910A Ngô Quyền, Q. Sơn Trà, Đà Nẵng',
    distance: '1.2 km',
    isFlagship: true,
    rating: 4.9,
    reviewsCount: 2150,
    tags: ['Dolby Atmos', '4DX Sound', 'IMAX Laser'],
    specialBadge: 'Cụm rạp Flagship lớn nhất bán đảo Sơn Trà',
    image: 'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=1200&auto=format&fit=crop',
    openingHours: '08:00 - 02:00 sáng',
    hotline: '1900 8899',
    parking: 'Hầm B2 Vincom Ngô Quyền',
    roomCount: 8,
  },
  {
    name: "D'AVENOR Sơn Trà Marina Cineplex",
    slug: 'sontra-marina-danang',
    city: 'Đà Nẵng',
    district: 'Sơn Trà',
    address: 'Khu du lịch Sơn Trà Marina, Đường Hoàng Sa, Bán đảo Sơn Trà, Q. Sơn Trà, Đà Nẵng',
    distance: '3.6 km',
    isFlagship: false,
    rating: 4.9,
    reviewsCount: 980,
    tags: ['IMAX Laser', 'VIP Lounge'],
    specialBadge: 'Rạp chiếu bên vịnh biển Santorini độc đáo',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop',
    openingHours: '09:00 - 01:00 sáng',
    hotline: '1900 8899',
    parking: 'Bãi đỗ xe bến thuyền Marina',
    roomCount: 5,
  },

  // 3. QUẬN THANH KHÊ
  {
    name: "D'AVENOR Thanh Khê Plaza",
    slug: 'thanhkhe-plaza-danang',
    city: 'Đà Nẵng',
    district: 'Thanh Khê',
    address: 'Tầng 4 TTTM Thanh Khê Plaza, 295 Điện Biên Phủ, P. Chính Gián, Q. Thanh Khê, Đà Nẵng',
    distance: '2.1 km',
    isFlagship: false,
    rating: 4.8,
    reviewsCount: 1120,
    tags: ['Dolby Atmos', '4DX Sound'],
    specialBadge: 'Tâm điểm mua sắm & điện ảnh sầm uất',
    image: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=1200&auto=format&fit=crop',
    openingHours: '08:30 - 01:30 sáng',
    hotline: '1900 8899',
    parking: 'Hầm giữ xe 24/7',
    roomCount: 6,
  },
  {
    name: "D'AVENOR Co.opmart Dũng Sĩ Thanh Khê",
    slug: 'coopmart-thanhkhe-danang',
    city: 'Đà Nẵng',
    district: 'Thanh Khê',
    address: 'Tầng 3 Siêu thị Co.opmart, 478 Điện Biên Phủ, P. Thanh Khê Đông, Q. Thanh Khê, Đà Nẵng',
    distance: '2.9 km',
    isFlagship: false,
    rating: 4.7,
    reviewsCount: 890,
    tags: ['Dolby Atmos', 'Kids Hall'],
    specialBadge: 'Cụm rạp thân thiện với gia đình & học sinh sinh viên',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop',
    openingHours: '08:30 - 23:30',
    hotline: '1900 8899',
    parking: 'Bãi xe Co.opmart rộng rãi',
    roomCount: 5,
  },

  // 4. QUẬN CẨM LỆ
  {
    name: "D'AVENOR Cẩm Lệ Megamall",
    slug: 'camle-megamall-danang',
    city: 'Đà Nẵng',
    district: 'Cẩm Lệ',
    address: 'Tầng 4 Cẩm Lệ Megamall, 102 Cách Mạng Tháng 8, P. Khuê Trung, Q. Cẩm Lệ, Đà Nẵng',
    distance: '3.8 km',
    isFlagship: false,
    rating: 4.8,
    reviewsCount: 960,
    tags: ['Dolby Atmos', 'IMAX Laser'],
    specialBadge: 'Màn chiếu sắc nét tại cửa ngõ Tây Nam thành phố',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop',
    openingHours: '08:30 - 01:00 sáng',
    hotline: '1900 8899',
    parking: 'Hầm B1-B2 Megamall',
    roomCount: 6,
  },
  {
    name: "D'AVENOR Hòa Xuân Riverside Cineplex",
    slug: 'hoaxuan-riverside-danang',
    city: 'Đà Nẵng',
    district: 'Cẩm Lệ',
    address: 'Đại lộ Võ Chí Công, KĐT Sinh Thái Nam Hòa Xuân, Q. Cẩm Lệ, Đà Nẵng',
    distance: '4.5 km',
    isFlagship: false,
    rating: 4.9,
    reviewsCount: 820,
    tags: ['Sweetbox Lounge', 'Gold Class'],
    specialBadge: 'Không gian xem phim hiện đại view sông Cẩm Lệ',
    image: 'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=1200&auto=format&fit=crop',
    openingHours: '09:00 - 01:00 sáng',
    hotline: '1900 8899',
    parking: 'Bãi đỗ ô tô ngoài trời miễn phí',
    roomCount: 5,
  },

  // 5. QUẬN NGŨ HÀNH SƠN
  {
    name: "D'AVENOR Ngũ Hành Sơn Resort Cinema",
    slug: 'nguhanhson-resort-danang',
    city: 'Đà Nẵng',
    district: 'Ngũ Hành Sơn',
    address: 'Tầng 2 Luxury Complex, Đường Võ Nguyên Giáp, P. Khuê Mỹ, Q. Ngũ Hành Sơn, Đà Nẵng',
    distance: '4.2 km',
    isFlagship: false,
    rating: 4.9,
    reviewsCount: 1350,
    tags: ['IMAX Laser', 'Gold Class'],
    specialBadge: 'Trải nghiệm xem phim nghỉ dưỡng sang trọng bậc nhất',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop',
    openingHours: '08:30 - 02:00 sáng',
    hotline: '1900 8899',
    parking: 'Bãi đỗ xe Resort có bảo vệ 24/7',
    roomCount: 6,
  },
  {
    name: "D'AVENOR FPT City Đà Nẵng",
    slug: 'fptcity-danang',
    city: 'Đà Nẵng',
    district: 'Ngũ Hành Sơn',
    address: 'Tòa nhà FPT Complex, Đường Nam Kỳ Khởi Nghĩa, P. Hòa Hải, Q. Ngũ Hành Sơn, Đà Nẵng',
    distance: '6.5 km',
    isFlagship: false,
    rating: 4.8,
    reviewsCount: 910,
    tags: ['Dolby Atmos', 'Students Hall'],
    specialBadge: 'Ưu đãi vé xem phim đặc biệt cho sinh viên và giới công nghệ',
    image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
    openingHours: '08:30 - 00:30',
    hotline: '1900 8899',
    parking: 'Khu gửi xe FPT City',
    roomCount: 5,
  },

  // 6. QUẬN LIÊN CHIỂU
  {
    name: "D'AVENOR Liên Chiểu Center",
    slug: 'lienchieu-center-danang',
    city: 'Đà Nẵng',
    district: 'Liên Chiểu',
    address: 'Tầng 4 TTTM Hòa Khánh, 437 Tôn Đức Thắng, P. Hòa Khánh Nam, Q. Liên Chiểu, Đà Nẵng',
    distance: '5.0 km',
    isFlagship: false,
    rating: 4.8,
    reviewsCount: 1280,
    tags: ['Dolby Atmos', 'Sweetbox Lounge'],
    specialBadge: 'Cụm rạp trung tâm quận Liên Chiểu',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop',
    openingHours: '08:00 - 01:30 sáng',
    hotline: '1900 8899',
    parking: 'Hầm giữ xe TTTM Hòa Khánh',
    roomCount: 6,
  },
  {
    name: "D'AVENOR Đại Học Bách Khoa Cineplex",
    slug: 'hoakhanh-univ-danang',
    city: 'Đà Nẵng',
    district: 'Liên Chiểu',
    address: '54 Nguyễn Lương Bằng, P. Hòa Khánh Bắc, Q. Liên Chiểu, Đà Nẵng',
    distance: '5.8 km',
    isFlagship: false,
    rating: 4.9,
    reviewsCount: 1540,
    tags: ['Dolby Atmos', 'Students Hall'],
    specialBadge: 'Rạp phim hot nhất làng đại học & KCN Hòa Khánh',
    image: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=1200&auto=format&fit=crop',
    openingHours: '08:00 - 01:00 sáng',
    hotline: '1900 8899',
    parking: 'Bãi đỗ xe máy & ô tô sinh viên',
    roomCount: 7,
  },
];

async function updateCinemasAndPricing() {
  await connectDB();
  console.log('🔄 Bắt đầu nạp cụm rạp Đà Nẵng và chuẩn hóa bảng giá mới...');

  // 1. Nạp và đồng bộ 12 cụm rạp cho 6 quận tại Đà Nẵng
  for (const cData of DA_NANG_CINEMAS_DATA) {
    let cinema = await Cinema.findOne({ slug: cData.slug });
    if (!cinema) {
      cinema = await Cinema.findOne({ name: cData.name });
    }

    if (cinema) {
      Object.assign(cinema, cData);
      await cinema.save();
      console.log(`✅ Đã cập nhật rạp: [${cData.name}] - Q.${cData.district}`);
    } else {
      await Cinema.create(cData);
      console.log(`✨ Đã tạo mới rạp: [${cData.name}] - Q.${cData.district}`);
    }
  }

  // 2. Chuẩn hóa giá vé trên từng Movie (mặc định 45k - 50k ngày thường)
  const movies = await Movie.find({});
  for (const m of movies) {
    m.price = 50000; // Giá tiêu chuẩn ngày thường
    await m.save();
  }
  console.log(`🎬 Đã chuẩn hóa giá gốc ${movies.length} phim về mức tiêu chuẩn 50.000đ.`);

  // 3. Chuẩn hóa giá của toàn bộ Showtime trong Database theo công thức:
  // - Thứ 2, 3, 4, 5:
  //    * Suất trước 17:00: 45.000 VNĐ
  //    * Suất từ 17:00 - 22:00: 50.000 VNĐ
  //    * Suất khuya sau 22:00: 50.000 VNĐ
  // - Thứ 6, Thứ 7, Chủ Nhật:
  //    * Suất trước 17:00: 60.000 VNĐ
  //    * Suất sau 17:00: 65.000 VNĐ
  //    * Suất khuya sau 22:00: 50.000 VNĐ
  const showtimes = await Showtime.find({});
  let stCount = 0;

  for (const st of showtimes) {
    let dateObj = st.startTime ? new Date(st.startTime) : new Date();
    if (isNaN(dateObj.getTime())) dateObj = new Date();

    let hour = dateObj.getHours();
    if (st.time && typeof st.time === 'string' && st.time.includes(':')) {
      const [h] = st.time.split(':').map(Number);
      if (!isNaN(h)) hour = h;
    }

    const day = dateObj.getDay(); // 0 = CN, 1 = T2, 2 = T3, 3 = T4, 4 = T5, 5 = T6, 6 = T7
    const isWeekend = day === 0 || day === 5 || day === 6;
    const isLateNight = hour >= 22 || hour < 6;
    const isBefore17 = hour < 17;

    let targetPrice = 50000;

    if (isLateNight) {
      targetPrice = 50000;
    } else if (!isWeekend) {
      targetPrice = isBefore17 ? 45000 : 50000;
    } else {
      targetPrice = isBefore17 ? 60000 : 65000;
    }

    st.price = targetPrice;
    await st.save();
    stCount++;
  }

  console.log(`🎉 Đã đồng bộ giá chuẩn mới cho ${stCount} suất chiếu thành công!`);
  process.exit(0);
}

updateCinemasAndPricing().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

