import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function inspectDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas successfully!\n');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`=== DATABASE: ${db.databaseName} ===`);
    console.log(`Tổng số collections: ${collections.length}\n`);

    const summary = [];

    for (const col of collections) {
      const colName = col.name;
      const count = await db.collection(colName).countDocuments();
      summary.push({ name: colName, count });
    }

    // Sắp xếp theo tên
    summary.sort((a, b) => a.name.localeCompare(b.name));

    console.log('--- DANH SÁCH & SỐ LƯỢNG DOCUMENTS TỪNG BẢNG ---');
    summary.forEach((s, idx) => {
      console.log(`${idx + 1}. [${s.name}]: ${s.count} bản ghi`);
    });
    console.log('\n==============================================\n');

    // Chi tiết từng bảng chính
    // 1. Phim (movies)
    const movies = await db.collection('movies').find({}).project({ title: 1, slug: 1, status: 1, ageRating: 1, duration: 1, rating: 1, techFormat: 1 }).toArray();
    console.log(`--- CHI TIẾT [movies] (${movies.length} phim) ---`);
    movies.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.title} | Slug: ${m.slug} | Trạng thái: ${m.status} | Độ tuổi: ${m.ageRating} | Thời lượng: ${m.duration}' | Đánh giá: ${m.rating}★ | Định dạng: ${m.techFormat}`);
    });
    console.log('\n');

    // 2. Rạp (cinemas)
    const cinemas = await db.collection('cinemas').find({}).toArray();
    console.log(`--- CHI TIẾT [cinemas] (${cinemas.length} cụm rạp) ---`);
    cinemas.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} | Thành phố: ${c.city} | Địa chỉ: ${c.address} | Số phòng: ${c.roomCount || 'N/A'}`);
    });
    console.log('\n');

    // 3. Phòng chiếu (rooms)
    const rooms = await db.collection('rooms').find({}).toArray();
    console.log(`--- CHI TIẾT [rooms] (${rooms.length} phòng chiếu) ---`);
    rooms.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name} | Số phòng: ${r.roomNumber} | Loại: ${r.roomType} | Ghế: ${r.totalSeats} | Trạng thái: ${r.status}`);
    });
    console.log('\n');

    // 4. Suất chiếu (showtimes)
    const showtimesCount = await db.collection('showtimes').countDocuments();
    const sampleShowtimes = await db.collection('showtimes').find({}).limit(5).toArray();
    console.log(`--- CHI TIẾT [showtimes] (Tổng: ${showtimesCount} suất chiếu) ---`);
    sampleShowtimes.forEach((st, i) => {
      console.log(`  Mẫu ${i + 1}: ID: ${st._id} | MovieId: ${st.movieId} | RoomId: ${st.roomId} | CinemaId: ${st.cinemaId} | Start: ${st.startTime} | Format: ${st.format} | Price: ${st.price}`);
    });
    console.log('\n');

    // 5. Vé & Ghế suất chiếu (showtimeseats)
    const showtimeSeatsCount = await db.collection('showtimeseats').countDocuments();
    console.log(`--- CHI TIẾT [showtimeseats] (Tổng: ${showtimeSeatsCount} bản ghi trạng thái ghế) ---\n`);

    // 6. Đơn đặt vé (bookings)
    const bookingsCount = await db.collection('bookings').countDocuments();
    const sampleBookings = await db.collection('bookings').find({}).limit(5).toArray();
    console.log(`--- CHI TIẾT [bookings] (Tổng: ${bookingsCount} đơn đặt vé) ---`);
    sampleBookings.forEach((b, i) => {
      console.log(`  Đơn ${i + 1}: Mã: ${b.bookingCode || b._id} | Khách: ${b.customerName || b.userId} | Tổng tiền: ${b.totalAmount} đ | Trạng thái: ${b.status} | Ghế: ${b.seats}`);
    });
    console.log('\n');

    // 7. Người dùng (users)
    const usersCount = await db.collection('users').countDocuments();
    const users = await db.collection('users').find({}).project({ name: 1, email: 1, role: 1, phone: 1 }).toArray();
    console.log(`--- CHI TIẾT [users] (${usersCount} tài khoản người dùng) ---`);
    users.forEach((u, i) => {
      console.log(`  ${i + 1}. Tên: ${u.name} | Email: ${u.email} | Vai trò: ${u.role || 'USER'} | SĐT: ${u.phone || 'N/A'}`);
    });
    console.log('\n');

    // 8. Admin Users (adminusers)
    const adminUsersCount = await db.collection('adminusers').countDocuments();
    const adminUsers = await db.collection('adminusers').find({}).project({ username: 1, email: 1, role: 1 }).toArray();
    console.log(`--- CHI TIẾT [adminusers] (${adminUsersCount} tài khoản admin) ---`);
    adminUsers.forEach((a, i) => {
      console.log(`  ${i + 1}. Username: ${a.username} | Email: ${a.email} | Role: ${a.role}`);
    });
    console.log('\n');

    // 9. Bắp nước / Combo (concessions)
    const concessions = await db.collection('concessions').find({}).toArray();
    console.log(`--- CHI TIẾT [concessions] (${concessions.length} món bắp nước / combo) ---`);
    concessions.forEach((cn, i) => {
      console.log(`  ${i + 1}. ${cn.name} | Giá: ${cn.price} đ | Danh mục: ${cn.category} | Trạng thái: ${cn.status}`);
    });
    console.log('\n');

    // 10. Khuyến mãi / Voucher (promotions)
    const promotions = await db.collection('promotions').find({}).toArray();
    console.log(`--- CHI TIẾT [promotions] (${promotions.length} chương trình khuyến mãi / voucher) ---`);
    promotions.forEach((p, i) => {
      console.log(`  ${i + 1}. Mã: ${p.code} | Tiêu đề: ${p.title} | Giảm: ${p.discountPercent ? p.discountPercent + '%' : p.discountAmount + ' đ'} | Hạn: ${p.endDate}`);
    });
    console.log('\n');

    // 11. Mã OTP (otpverifications)
    const otps = await db.collection('otpverifications').find({}).toArray();
    console.log(`--- CHI TIẾT [otpverifications] (${otps.length} bản ghi OTP) ---`);
    otps.forEach((o, i) => {
      console.log(`  ${i + 1}. Email: ${o.email} | OTP: ${o.otp} | Mục đích: ${o.purpose} | Hết hạn: ${o.expiresAt} | Đã dùng: ${o.isUsed}`);
    });
    console.log('\n');

    // 12. Cấu hình bảng giá (ticketpricingconfigs)
    const pricingConfigs = await db.collection('ticketpricingconfigs').find({}).toArray();
    console.log(`--- CHI TIẾT [ticketpricingconfigs] (${pricingConfigs.length} cấu hình giá vé) ---`);
    pricingConfigs.forEach((pc, i) => {
      console.log(`  Cấu hình ID: ${pc._id} | Cập nhật lúc: ${pc.updatedAt}`);
    });
    console.log('\n');

    // 13. Chatbot FAQ & Config (faqs, aiconfigs, aichatlogs)
    const faqsCount = await db.collection('faqs').countDocuments();
    const aiConfigsCount = await db.collection('aiconfigs').countDocuments();
    const chatLogsCount = await db.collection('aichatlogs').countDocuments();
    console.log(`--- CHI TIẾT CHATBOT AI ---`);
    console.log(`  - FAQs (Kho tri thức câu hỏi thường gặp): ${faqsCount}`);
    console.log(`  - AiConfigs (Cấu hình trợ lý ảo): ${aiConfigsCount}`);
    console.log(`  - AiChatLogs (Lịch sử hội thoại chatbot): ${chatLogsCount}`);
    console.log('\n');

    // 14. Support tickets nếu có
    const hasTickets = collections.find(c => c.name === 'supporttickets');
    if (hasTickets) {
      const ticketsCount = await db.collection('supporttickets').countDocuments();
      console.log(`--- CHI TIẾT [supporttickets]: ${ticketsCount} phiếu hỗ trợ ---`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Lỗi kiểm tra database:', err);
    process.exit(1);
  }
}

inspectDb();
