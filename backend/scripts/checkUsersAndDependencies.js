import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import AdminUser from '../src/models/AdminUser.js';
import Room from '../src/models/Room.js';
import Movie from '../src/models/Movie.js';
import Cinema from '../src/models/Cinema.js';
import TicketPricingConfig from '../src/models/TicketPricingConfig.js';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== KIỂM TRA DỮ LIỆU NỀN TẢNG (FOUNDATION DATA) ===');
  
  const [users, adminUsers, rooms, movies, cinemas, pricing] = await Promise.all([
    User.find().select('name email role tier points createdAt').lean(),
    AdminUser.find().select('username role email').lean(),
    Room.find().select('name type capacity status physicalHallNumber').lean(),
    Movie.find().select('title duration status').lean(),
    Cinema.find().select('name address rooms').lean(),
    TicketPricingConfig.find().lean(),
  ]);

  console.log(`- Users (${users.length} tài khoản):`);
  const roles = {};
  let usersWithPoints = 0;
  users.forEach(u => {
    roles[u.role] = (roles[u.role] || 0) + 1;
    if (u.points > 0) usersWithPoints++;
  });
  console.log('  Phân bổ role:', roles);
  console.log(`  Số user có điểm thưởng (>0): ${usersWithPoints}`);

  console.log(`- Admin Users (${adminUsers.length} tài khoản):`, adminUsers);
  console.log(`- Cinema (${cinemas.length} cụm rạp):`, cinemas.map(c => c.name));
  console.log(`- Pricing Config (${pricing.length} cấu hình bảng giá)`);
  console.log(`- Rooms (${rooms.length} phòng vật lý):`);
  rooms.forEach(r => {
    console.log(`  [Phòng ${r.physicalHallNumber || 'N/A'}] ${r.name} - Loại: ${r.type} - Sức chứa: ${r.capacity} ghế - Trạng thái: ${r.status}`);
  });
  console.log(`- Movies (${movies.length} bộ phim đang chiếu/sắp chiếu):`);
  movies.forEach((m, idx) => {
    console.log(`  ${idx+1}. ${m.title} (${m.duration} phút) [${m.status}]`);
  });

  await mongoose.disconnect();
}

check().catch(console.error);
