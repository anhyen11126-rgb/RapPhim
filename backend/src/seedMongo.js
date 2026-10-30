import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './config/db.js';
import AdminUser from './models/AdminUser.js';
import Concession from './models/Concession.js';
import Movie from './models/Movie.js';
import Showtime from './models/Showtime.js';
import ShowtimeSeat from './models/ShowtimeSeat.js';
import Booking from './models/Booking.js';

async function seed() {
  console.log('🍃 [MongoDB] Bắt đầu kết nối & nạp dữ liệu mẫu...');
  await connectDB();

  try {
    // 1. Xóa sạch dữ liệu cũ
    await ShowtimeSeat.deleteMany({});
    await Booking.deleteMany({});
    await Showtime.deleteMany({});
    await Movie.deleteMany({});
    await Concession.deleteMany({});
    await AdminUser.deleteMany({});
    console.log('🧹 Đã dọn dẹp các collection cũ');

    // 2. Tạo tài khoản Admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await AdminUser.create({
      email: 'admin@movietix.vn',
      name: 'Ban Quản Trị MovieTix',
      password: hashedPassword,
      role: 'ADMIN',
    });
    console.log(`👤 Đã tạo Admin: ${admin.email} (pass: admin123)`);

    // 3. Tạo danh mục Bắp Nước
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

    // 4. Tạo danh sách Phim
    const movies = await Movie.create([
      {
        title: 'Dune: Hành Tinh Cát - Phần Hai',
        slug: 'dune-hanh-tinh-cat-phan-2',
        posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop',
        poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop',
        trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
        description: 'Paul Atreides hợp nhất với Chani và người Fremen để trả thù những kẻ đã hủy hoại gia đình anh.',
        genre: 'Khoa học viễn tưởng, Hành động',
        duration: 166,
        ageRating: 'T16',
        releaseDate: new Date('2026-03-01'),
        status: 'NOW_SHOWING',
        price: 95000,
      },
      {
        title: 'Oppenheimer',
        slug: 'oppenheimer',
        posterUrl: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=500&auto=format&fit=crop',
        poster: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=500&auto=format&fit=crop',
        trailerUrl: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
        description: 'Câu chuyện lịch sử về nhà vật lý lý thuyết J. Robert Oppenheimer và dự án Manhattan.',
        genre: 'Tiểu sử, Lịch sử, Kịch tính',
        duration: 180,
        ageRating: 'T18',
        releaseDate: new Date('2026-07-20'),
        status: 'NOW_SHOWING',
        price: 95000,
      },
      {
        title: 'Spider-Man: Du Hành Vũ Trụ Nhện',
        slug: 'spider-man-du-hanh-vu-tru-nhen',
        posterUrl: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=500&auto=format&fit=crop',
        poster: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=500&auto=format&fit=crop',
        trailerUrl: 'https://www.youtube.com/watch?v=cqGjhVJWtEg',
        description: 'Miles Morales du hành qua đa vũ trụ, đối mặt với nhóm Người Nhện bảo vệ thực tại.',
        genre: 'Hoạt hình, Hành động, Gia đình',
        duration: 140,
        ageRating: 'P',
        releaseDate: new Date('2026-06-02'),
        status: 'NOW_SHOWING',
        price: 85000,
      },
      {
        title: 'Quật Mộ Trùng Ma (Exhuma)',
        slug: 'quat-mo-trung-ma',
        posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop',
        poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop',
        trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        description: 'Hai pháp sư, một thầy phong thủy và một chuyên viên mai táng cùng khai quật ngôi mộ bí ẩn.',
        genre: 'Kinh dị, Bí ẩn, Giật gân',
        duration: 134,
        ageRating: 'T16',
        releaseDate: new Date('2026-03-15'),
        status: 'NOW_SHOWING',
        price: 90000,
      },
      {
        title: 'Avatar 3: Lửa Và Tro Tàn',
        slug: 'avatar-3-lua-va-tro-tan',
        posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop',
        poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop',
        trailerUrl: '',
        description: 'Phần tiếp theo khám phá tộc người Tro Tàn (Ash People) đầy hiếu chiến trên hành tinh Pandora.',
        genre: 'Khoa học viễn tưởng, Phiêu lưu',
        duration: 190,
        ageRating: 'T13',
        releaseDate: new Date('2026-12-18'),
        status: 'COMING_SOON',
        price: 110000,
      },
    ]);
    console.log(`🎬 Đã tạo ${movies.length} bộ phim`);

    // 5. Tạo Suất Chiếu & Ma Trận 48 Ghế cho các phim NOW_SHOWING
    const rows = ['A', 'B', 'C', 'D', 'E', 'F']; // 6 hàng
    const cols = [1, 2, 3, 4, 5, 6, 7, 8]; // 8 cột -> 48 ghế/suất

    const nowMovies = movies.filter((m) => m.status === 'NOW_SHOWING');
    let totalShowtimes = 0;
    let totalSeats = 0;

    for (const movie of nowMovies) {
      // Mỗi phim tạo 3 suất chiếu hôm nay
      const times = [
        { hour: 10, min: 0, room: 'Phòng 01 - 2D Dolby' },
        { hour: 15, min: 30, room: 'Phòng 02 - 3D Laser' },
        { hour: 20, min: 0, room: 'Phòng VIP - IMAX Laser' },
      ];

      for (const t of times) {
        const startTime = new Date();
        startTime.setHours(t.hour, t.min, 0, 0);

        const showtime = await Showtime.create({
          movieId: movie._id,
          roomName: t.room,
          startTime,
          price: movie.price,
        });
        totalShowtimes++;

        // Tạo 48 ghế
        const seatDocs = [];
        for (const r of rows) {
          for (const c of cols) {
            const isVip = r === 'E' || r === 'F';
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
        totalSeats += seatDocs.length;
      }
    }

    console.log(`🎟️ Đã tạo ${totalShowtimes} suất chiếu và ${totalSeats} ghế ngồi thời gian thực`);
    console.log('🎉 [MongoDB] Hoàn tất nạp dữ liệu mẫu thành công!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi nạp dữ liệu:', error);
    process.exit(1);
  }
}

seed();

