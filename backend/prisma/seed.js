import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu nạp dữ liệu mẫu (Seeding Database)...');

  // Xóa sạch dữ liệu cũ theo thứ tự quan hệ
  await prisma.showtimeSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.showtime.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.concession.deleteMany();
  await prisma.adminUser.deleteMany();

  // 1. Tạo tài khoản Admin mặc định
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.adminUser.create({
    data: {
      email: 'admin@movietix.vn',
      name: 'Ban Quản Trị MovieTix',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Đã tạo tài khoản Admin: admin@movietix.vn / admin123');

  // 2. Tạo danh mục Bắp Nước (Concessions)
  const concessions = await Promise.all([
    prisma.concession.create({
      data: {
        name: 'Bắp Rang Bơ (Ngọt/Phô Mai)',
        price: 55000,
        description: 'Bắp ngô nổ truyền thống thơm lừng vị bơ hoặc phô mai hảo hạng',
      },
    }),
    prisma.concession.create({
      data: {
        name: 'Nước Ngọt Coca-Cola (L)',
        price: 30000,
        description: 'Ly lớn 32oz ướp lạnh sảng khoái',
      },
    }),
    prisma.concession.create({
      data: {
        name: 'Combo Solo (1 Bắp + 1 Nước)',
        price: 79000,
        description: 'Phù hợp thưởng thức phim một mình trọn vẹn',
      },
    }),
    prisma.concession.create({
      data: {
        name: 'Combo Couple (1 Bắp Lớn + 2 Nước)',
        price: 109000,
        description: 'Lựa chọn lý tưởng cho 2 người',
      },
    }),
  ]);
  console.log(`✅ Đã tạo ${concessions.length} gói bắp nước`);

  // 3. Tạo danh sách Phim mẫu
  const movies = await Promise.all([
    prisma.movie.create({
      data: {
        title: 'Dune: Hành Tinh Cát - Phần Hai',
        slug: 'dune-hanh-tinh-cat-phan-2',
        posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop',
        trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
        description: 'Paul Atreides hợp nhất với Chani và người Fremen để trả thù những kẻ đã hủy hoại gia đình anh trong cuộc chiến sinh tử giành quyền kiểm soát gia vị.',
        genre: 'Khoa học viễn tưởng, Hành động',
        duration: 166,
        ageRating: 'T16',
        releaseDate: new Date('2026-03-01'),
        status: 'NOW_SHOWING',
      },
    }),
    prisma.movie.create({
      data: {
        title: 'Oppenheimer',
        slug: 'oppenheimer',
        posterUrl: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=500&auto=format&fit=crop',
        trailerUrl: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
        description: 'Câu chuyện lịch sử về nhà vật lý lý thuyết J. Robert Oppenheimer, người chỉ huy dự án Manhattan phát triển vũ khí hạt nhân đầu tiên của nhân loại.',
        genre: 'Tiểu sử, Lịch sử, Kịch tính',
        duration: 180,
        ageRating: 'T18',
        releaseDate: new Date('2026-07-20'),
        status: 'NOW_SHOWING',
      },
    }),
    prisma.movie.create({
      data: {
        title: 'Spider-Man: Du Hành Vũ Trụ Nhện',
        slug: 'spider-man-du-hanh-vu-tru-nhen',
        posterUrl: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=500&auto=format&fit=crop',
        trailerUrl: 'https://www.youtube.com/watch?v=cqGjhVJWtEg',
        description: 'Miles Morales du hành qua đa vũ trụ, đối mặt với nhóm Người Nhện chịu trách nhiệm bảo vệ sự tồn vong của thế giới.',
        genre: 'Hoạt hình, Hành động, Gia đình',
        duration: 140,
        ageRating: 'T11',
        releaseDate: new Date('2026-06-01'),
        status: 'NOW_SHOWING',
      },
    }),
    prisma.movie.create({
      data: {
        title: 'Quật Mộ Trùng Ma (Exhuma)',
        slug: 'quat-mo-trung-ma',
        posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop',
        trailerUrl: 'https://www.youtube.com/watch?v=s1X9e_89d38',
        description: 'Hai pháp sư, một chuyên gia phong thủy và một nhân viên tang lễ nhận một khoản tiền khổng lồ để di dời một ngôi mộ bí ẩn nhưng vô tình giải phóng thế lực tà ác.',
        genre: 'Kinh dị, Bí ẩn, Giật gân',
        duration: 134,
        ageRating: 'T18',
        releaseDate: new Date('2026-03-15'),
        status: 'NOW_SHOWING',
      },
    }),
  ]);
  console.log(`✅ Đã tạo ${movies.length} bộ phim`);

  // 4. Tạo Suất Chiếu (Showtimes) & Sơ đồ ghế (ShowtimeSeats)
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
  const cols = [1, 2, 3, 4, 5, 6, 7, 8];

  const dune = movies[0];
  const oppenheimer = movies[1];

  const now = new Date();
  const today10h = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30);
  const today14h = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0);
  const today19h = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 30);
  const today21h = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 45);

  const showtimeList = [
    { movie: dune, room: 'Phòng 01 - IMAX Laser', time: today19h, price: 110000 },
    { movie: dune, room: 'Phòng 02 - 2D Dolby Atmos', time: today21h, price: 85000 },
    { movie: oppenheimer, room: 'Phòng 01 - IMAX Laser', time: today14h, price: 110000 },
    { movie: oppenheimer, room: 'Phòng 03 - 2D Tiêu chuẩn', time: today10h, price: 75000 },
  ];

  for (const st of showtimeList) {
    const createdShowtime = await prisma.showtime.create({
      data: {
        movieId: st.movie.id,
        roomName: st.room,
        startTime: st.time,
        price: st.price,
      },
    });

    // Tạo 48 ghế (A1 - F8) cho suất chiếu này
    const seatData = [];
    for (const r of rows) {
      for (const c of cols) {
        const isVip = ['C', 'D'].includes(r);
        seatData.push({
          showtimeId: createdShowtime.id,
          seatNumber: `${r}${c}`,
          row: r,
          col: c,
          type: isVip ? 'VIP' : 'STANDARD',
          status: 'AVAILABLE',
        });
      }
    }
    await prisma.showtimeSeat.createMany({ data: seatData });
  }
  console.log(`✅ Đã tạo 4 suất chiếu và khởi tạo ma trận 48 ghế cho mỗi suất chiếu`);

  // 5. Tạo 1 Đơn Đặt Vé mẫu để kiểm tra
  const firstShowtime = await prisma.showtime.findFirst({
    where: { movieId: dune.id },
  });

  if (firstShowtime) {
    const sampleBooking = await prisma.booking.create({
      data: {
        bookingCode: 'MTX892144',
        showtimeId: firstShowtime.id,
        customerName: 'Nguyễn Văn A',
        customerPhone: '0901234567',
        customerEmail: 'nguyenvana@gmail.com',
        seats: 'C4, C5',
        concessions: '1x Combo Couple (1 Bắp Lớn + 2 Nước)',
        totalAmount: 329000,
        status: 'PAID',
        paymentMethod: 'MOMO',
      },
    });

    // Đánh dấu C4, C5 là đã đặt
    await prisma.showtimeSeat.updateMany({
      where: {
        showtimeId: firstShowtime.id,
        seatNumber: { in: ['C4', 'C5'] },
      },
      data: {
        status: 'BOOKED',
        bookingId: sampleBooking.id,
      },
    });
    console.log('✅ Đã tạo đơn vé mẫu #MTX892144 (ghế C4, C5 đã khóa BOOKED)');
  }

  console.log('🎉 Hoàn tất Seed dữ liệu mẫu cho MovieTix!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

