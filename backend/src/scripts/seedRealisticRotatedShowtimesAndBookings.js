import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import Movie from '../models/Movie.js';
import Cinema from '../models/Cinema.js';
import Room from '../models/Room.js';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';

// Cấu hình 8 phòng chiếu chuẩn rạp D'AVENOR Thanh Khê
const ROOM_PRICES = {
  'IMAX Laser': 155000,
  'Dolby Atmos': 115000,
  'VIP Recliner': 145000,
  '4DX Sound': 140000,
  'RealD 3D': 115000,
  '2D Tiêu chuẩn': 95000,
};

// Cấu hình phân chia phim luân phiên theo 4 đợt (Weekly Movie Rotation)
const ROTATION_SEASONS = [
  {
    name: 'Đợt 1: Tuần Sử Thi & Bom Tấn Kỷ Lục (25/10 - 02/11/2026)',
    startDate: '2026-10-25',
    endDate: '2026-11-02',
    movieSlugs: [
      'oppenheimer',
      'dune-hanh-tinh-cat-phan-2',
      'avatar-the-way-of-water',
      'spider-man-no-way-home',
    ],
  },
  {
    name: 'Đợt 2: Tuần Hiện Tượng Châu Á & Kỷ Lục Phòng Vé (03/11 - 11/11/2026)',
    startDate: '2026-11-03',
    endDate: '2026-11-11',
    movieSlugs: [
      'mai',
      'quat-mo-trung-ma',
      'inside-out-2',
      'venom-the-last-dance',
    ],
  },
  {
    name: 'Đợt 3: Tuần Gia Đình & Hài Kịch Thượng Lưu (12/11 - 20/11/2026)',
    startDate: '2026-11-12',
    endDate: '2026-11-20', // Bao gồm Hôm qua 16/11 & Hôm nay 17/11
    movieSlugs: [
      'co-dau-hao-mon',
      'lat-mat-7-mot-dieu-uoc',
      'deadpool-and-wolverine',
      'kung-fu-panda-4',
      'godzilla-x-kong-de-che-moi',
    ],
  },
  {
    name: 'Đợt 4: Tuần Khởi Chiếu Mới & Suất Chiếu Sớm (21/11 - 28/11/2026)',
    startDate: '2026-11-21',
    endDate: '2026-11-28',
    movieSlugs: [
      'transformers-one',
      'moana-2',
      'mufasa-the-lion-king',
      'captain-america-brave-new-world',
      'joker-folie-a-deux',
    ],
  },
];

// Các khung giờ chiếu trong ngày (Sáng, Trưa/Chiều, Tối giờ vàng)
const TIME_SLOTS = [
  { start: '10:00', end: '12:30', peakWeight: 0.62 },
  { start: '13:45', end: '16:15', peakWeight: 0.74 },
  { start: '19:15', end: '21:45', peakWeight: 0.92, isHot: true },
];

const CONCESSION_COMBOS = [
  { name: 'Combo Solo (1 Bắp + 1 Nước)', price: 89000 },
  { name: 'Combo Đôi Cinema (1 Bắp + 2 Nước)', price: 129000 },
  { name: 'Combo Gia Đình VIP (2 Bắp + 4 Nước)', price: 189000 },
  { name: 'Bắp Phô Mai & Nước Ngọt L', price: 95000 },
];

const PAYMENT_METHODS = ['MOMO', 'VNPAY', 'CASH'];

// Danh sách họ và tên khách hàng thực tế
const VIETNAMESE_NAMES = [
  'Nguyễn Hoàng Nam', 'Trần Bảo Anh', 'Lê Minh Quân', 'Phạm Quỳnh Chi',
  'Vũ Đức Thịnh', 'Đặng Thảo Vy', 'Bùi Gia Huy', 'Đỗ Thanh Hương',
  'Dương Hải Đăng', 'Lý Gia Hân', 'Mai Trung Kiên', 'Trịnh Phương Thảo',
  'Đoàn Nhật Minh', 'Cao Thùy Linh', 'Hồ Hoàng Long', 'Tạ Minh Tuấn',
  'Phan Bảo Trâm', 'Vương Đình Khang', 'Lương Kim Oanh', 'Nguyễn Đăng Khoa',
  'Trần Quỳnh Nga', 'Lê Phúc Thịnh', 'Huỳnh Gia Huy', 'Võ Tuyết Nhi',
];

async function seedRotatedData() {
  console.log('🚀 Bắt đầu kiến thiết dữ liệu thực tế & luân chuyển phim (Rotation Schedule)...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Kết nối MongoDB Atlas thành công!');

  const cinema = await Cinema.findOne({});
  if (!cinema) {
    console.error('Không tìm thấy Cinema!');
    process.exit(1);
  }

  const rooms = await Room.find({ cinemaId: cinema._id }).sort({ roomNumber: 1 });
  if (rooms.length === 0) {
    console.error('Không tìm thấy Room!');
    process.exit(1);
  }
  console.log(`✓ Tìm thấy ${rooms.length} phòng chiếu tại [${cinema.name}]`);

  const movies = await Movie.find({});
  const movieBySlug = Object.fromEntries(movies.map((m) => [m.slug, m]));
  console.log(`✓ Tìm thấy ${movies.length} bộ phim trong cơ sở dữ liệu`);

  const users = await User.find({ role: { $ne: 'ADMIN' } });
  console.log(`✓ Tìm thấy ${users.length} tài khoản khách hàng`);

  // 1. Cập nhật trạng thái hiển thị phim (status) theo tuần chiếu
  console.log('\n--- BƯỚC 1: CẬP NHẬT TRẠNG THÁI LUÂN PHIÊN CÁC BỘ PHIM ---');
  for (const m of movies) {
    const inSeason3 = ROTATION_SEASONS[2].movieSlugs.includes(m.slug);
    const inSeason2 = ROTATION_SEASONS[1].movieSlugs.includes(m.slug);
    const inSeason1 = ROTATION_SEASONS[0].movieSlugs.includes(m.slug);
    const inSeason4 = ROTATION_SEASONS[3].movieSlugs.includes(m.slug);

    if (inSeason3 || inSeason2) {
      m.status = 'NOW_SHOWING';
    } else if (inSeason4) {
      m.status = 'COMING_SOON';
    } else if (inSeason1) {
      m.status = 'NOW_SHOWING'; // Chiếu lại đặc biệt
    }
    await m.save();
    console.log(`  Phim [${m.title}] -> Trạng thái: ${m.status}`);
  }

  // 2. Dọn sạch showtimes, showtimeseats, bookings cũ để tái cấu trúc
  console.log('\n--- BƯỚC 2: DỌN SẠCH DỮ LIỆU CŨ ĐỂ TÁI LẬP LỊCH TRÌNH CHUẨN XÁC ---');
  await Promise.all([
    Showtime.deleteMany({}),
    ShowtimeSeat.deleteMany({}),
    Booking.deleteMany({}),
  ]);
  console.log('✓ Đã dọn sạch showtimes, showtimeseats và bookings cũ');

  // 3. Khởi tạo danh sách ngày từ 25/10/2026 đến 28/11/2026 (35 ngày liên tiếp)
  console.log('\n--- BƯỚC 3: TẠO SUẤT CHIẾU VÀ ĐƠN ĐẶT VÉ LUÂN PHIÊN THEO TỪNG ĐỢT ---');
  const allDates = [];
  const startDay = new Date('2026-10-25T00:00:00.000Z');
  const endDay = new Date('2026-11-28T00:00:00.000Z');

  const curr = new Date(startDay);
  while (curr <= endDay) {
    allDates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  console.log(`Tổng số ngày cần lên lịch chiếu: ${allDates.length} ngày`);

  let totalShowtimesCreated = 0;
  let totalSeatsCreated = 0;
  let totalBookingsCreated = 0;
  let totalRevenueCreated = 0;
  let globalBookingCounter = 1000;

  // Xử lý từng ngày
  for (let dIdx = 0; dIdx < allDates.length; dIdx++) {
    const day = allDates[dIdx];
    const dateStr = day.toISOString().slice(0, 10);

    // Xác định đợt chiếu cho ngày này (Rotation Season)
    let currentSeason = ROTATION_SEASONS.find(
      (s) => dateStr >= s.startDate && dateStr <= s.endDate
    );
    if (!currentSeason) currentSeason = ROTATION_SEASONS[2]; // fallback season 3

    // Danh sách phim đang được luân phiên phục vụ trong tuần này
    const availableMovies = currentSeason.movieSlugs
      .map((slug) => movieBySlug[slug])
      .filter(Boolean);

    if (availableMovies.length === 0) continue;

    const dayShowtimes = [];
    const dayShowtimeSeats = [];
    const dayBookings = [];

    // Tạo 3 ca chiếu cho mỗi phòng (8 phòng x 3 ca = 24 suất/ngày)
    for (let rIdx = 0; rIdx < rooms.length; rIdx++) {
      const room = rooms[rIdx];
      const basePrice = ROOM_PRICES[room.roomType] || 95000;

      for (let sIdx = 0; sIdx < TIME_SLOTS.length; sIdx++) {
        const slot = TIME_SLOTS[sIdx];
        // Phân bổ luân phiên các phim trong tuần cho các phòng
        const movieIndex = (rIdx * 2 + sIdx + dIdx) % availableMovies.length;
        const selectedMovie = availableMovies[movieIndex];

        const [startH, startM] = slot.start.split(':').map(Number);

        // Giờ VN (GMT+7) -> chuyển sang UTC để lưu Date
        const startTime = new Date(day);
        startTime.setUTCHours(startH - 7, startM, 0, 0);

        const showtimeDoc = new Showtime({
          movieId: selectedMovie._id,
          cinemaId: cinema._id,
          roomName: room.name,
          formatFeature: room.formatFeature || room.roomType,
          startTime,
          price: basePrice,
          isLocked: false,
        });
        dayShowtimes.push(showtimeDoc);

        // Tạo 88 ghế cho suất chiếu này
        // Hàng A-D: Ghế STANDARD (48 ghế)
        // Hàng E-G: Ghế VIP (30 ghế)
        // Hàng H: Ghế SWEETBOX (10 ghế)
        const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const seatsInShowtime = [];
        const bookedSeatsForOrders = [];

        // Tỷ lệ lấp đầy: Giờ vàng (slot 3) đạt 85% - 94%, giờ chiều đạt 70% - 80%, giờ sáng đạt 55% - 68%
        // Cuối tuần tăng thêm 8%
        const isWeekend = day.getUTCDay() === 6 || day.getUTCDay() === 0;
        let occupancyRate = slot.peakWeight + (isWeekend ? 0.08 : 0);
        if (room.roomType === 'IMAX Laser' || room.roomType === 'Dolby Atmos') {
          occupancyRate += 0.06;
        }
        occupancyRate = Math.min(0.95, Math.max(0.55, occupancyRate));

        for (const row of rows) {
          const seatCountInRow = row === 'H' ? 10 : row >= 'E' ? 10 : 12;
          for (let col = 1; col <= seatCountInRow; col++) {
            const seatCode = `${row}${String(col).padStart(2, '0')}`;
            let seatType = 'STANDARD';
            let seatPrice = basePrice;

            if (row >= 'E' && row <= 'G') {
              seatType = 'VIP';
              seatPrice = basePrice + 15000;
            } else if (row === 'H') {
              seatType = 'SWEETBOX';
              seatPrice = basePrice + 35000;
            }

            // Tỷ lệ đặt theo vị trí hàng
            let rowFactor = 1.0;
            if (row >= 'C' && row <= 'F') rowFactor = 1.25;
            else if (row === 'A') rowFactor = 0.65;

            const isBooked = Math.random() < occupancyRate * rowFactor;
            const seatStatus = isBooked ? 'BOOKED' : 'AVAILABLE';

            const seatObj = {
              showtimeId: showtimeDoc._id,
              seatNumber: seatCode,
              row,
              col,
              status: seatStatus,
              type: seatType,
              price: seatPrice, // Dùng để tính tiền đơn hàng
            };
            seatsInShowtime.push(seatObj);

            if (isBooked) {
              bookedSeatsForOrders.push(seatObj);
            }
          }
        }

        dayShowtimeSeats.push(...seatsInShowtime);

        // Tạo các đơn đặt vé Booking từ các ghế đã BOOKED
        let seatPtr = 0;
        while (seatPtr < bookedSeatsForOrders.length) {
          const groupSize = Math.min(
            bookedSeatsForOrders.length - seatPtr,
            Math.floor(Math.random() * 3) + 1 // 1 đến 3 vé mỗi đơn
          );

          const orderSeats = bookedSeatsForOrders.slice(seatPtr, seatPtr + groupSize);
          seatPtr += groupSize;

          const seatCodesStr = orderSeats.map((s) => s.seatNumber).join(', ');
          const ticketSum = orderSeats.reduce((sum, s) => sum + s.price, 0);

          // 40% khách mua kèm bắp nước
          const hasConcessions = Math.random() < 0.42;
          const combo = hasConcessions
            ? CONCESSION_COMBOS[Math.floor(Math.random() * CONCESSION_COMBOS.length)]
            : null;
          const comboPrice = combo ? combo.price : 0;
          const comboText = combo ? combo.name : '';

          const totalAmount = ticketSum + comboPrice;

          // Chọn người dùng ngẫu nhiên
          const randomUser = users.length > 0 ? users[Math.floor(Math.random() * users.length)] : null;
          const randomName = randomUser?.name || VIETNAMESE_NAMES[Math.floor(Math.random() * VIETNAMESE_NAMES.length)];
          const randomPhone = randomUser?.phone || `09${Math.floor(10000000 + Math.random() * 90000000)}`;
          const randomEmail = randomUser?.email || `khach.${Math.floor(1000 + Math.random() * 9000)}@gmail.com`;

          // Thời gian tạo đơn: trước giờ chiếu từ 15 phút đến 120 phút (vẫn nằm trong cùng ngày)
          const bookMinutesBefore = Math.floor(Math.random() * 105) + 15;
          const bookingCreatedAt = new Date(startTime.getTime() - bookMinutesBefore * 60000);

          globalBookingCounter++;
          const bookingCode = `MTX-${dateStr.replace(/-/g, '').slice(2)}-${globalBookingCounter}`;

          const bookingDoc = {
            bookingCode,
            showtimeId: showtimeDoc._id,
            customerName: randomName,
            customerPhone: randomPhone,
            customerEmail: randomEmail,
            seats: seatCodesStr,
            totalAmount,
            concessions: comboText,
            status: 'PAID',
            paymentMethod: PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)],
            createdAt: bookingCreatedAt,
            updatedAt: bookingCreatedAt,
          };

          dayBookings.push(bookingDoc);
          totalRevenueCreated += totalAmount;
        }
      }
    }

    // Lưu vào database theo batch cho ngày này
    await Showtime.insertMany(dayShowtimes);
    
    // Loại bỏ thuộc tính tạm price trước khi chèn vào ShowtimeSeat schema
    const cleanSeats = dayShowtimeSeats.map(({ price, ...rest }) => rest);
    await ShowtimeSeat.insertMany(cleanSeats);
    await Booking.insertMany(dayBookings);

    totalShowtimesCreated += dayShowtimes.length;
    totalSeatsCreated += dayShowtimeSeats.length;
    totalBookingsCreated += dayBookings.length;

    console.log(
      `✓ [${dateStr}] -> ${dayShowtimes.length} suất | ${dayBookings.length} đơn đặt vé | Phim: ${availableMovies.map((m) => m.title.slice(0, 15)).join(', ')}`
    );
  }

  console.log('\n======================================================');
  console.log('🎉 TỔNG KẾT KIẾN TẠO DỮ LIỆU ĐIỆN ẢNH & DOANH SỐ THẬT:');
  console.log(`- Tổng số suất chiếu đã tạo: ${totalShowtimesCreated.toLocaleString('vi-VN')} suất`);
  console.log(`- Tổng số ghế (ShowtimeSeat): ${totalSeatsCreated.toLocaleString('vi-VN')} ghế`);
  console.log(`- Tổng số đơn đặt vé (Booking): ${totalBookingsCreated.toLocaleString('vi-VN')} đơn`);
  console.log(`- Tổng doanh thu thực sinh: ${totalRevenueCreated.toLocaleString('vi-VN')} đ`);
  console.log('======================================================\n');

  process.exit(0);
}

seedRotatedData().catch((err) => {
  console.error('Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
