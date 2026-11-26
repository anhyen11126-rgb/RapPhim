import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';
import { configureOptionalDnsServers } from '../config/db.js';
configureOptionalDnsServers();
import Movie from '../models/Movie.js';

// 3 bộ phim được chọn làm "Đang chiếu tại rạp"
const NOW_SHOWING_SLUGS = [
  'dune-hanh-tinh-cat-phan-2', // Dune: Hành Tinh Cát – Phần 2 (Bom tấn IMAX quốc tế)
  'mai',                      // Mai (Hiện tượng phòng vé Việt Nam)
  'deadpool-and-wolverine',   // Deadpool & Wolverine (Bom tấn hành động Marvel)
];

async function updateStatus() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Kết nối MongoDB Atlas thành công');

  // 1. Cập nhật tất cả phim thành COMING_SOON trước
  const resAll = await Movie.updateMany({}, { $set: { status: 'COMING_SOON' } });
  console.log(`✓ Đã đặt ${resAll.modifiedCount} phim thành COMING_SOON (Sắp chiếu)`);

  // 2. Cập nhật 3 phim được chọn thành NOW_SHOWING
  const resNow = await Movie.updateMany(
    { slug: { $in: NOW_SHOWING_SLUGS } },
    { $set: { status: 'NOW_SHOWING' } }
  );
  console.log(`✓ Đã đặt ${resNow.modifiedCount} phim thành NOW_SHOWING (Đang chiếu tại rạp)`);

  const list = await Movie.find({}, 'title slug status').sort({ status: -1 }).lean();
  console.log('\n--- KẾT QUẢ PHÂN LOẠI TRẠNG THÁI PHIM ---');
  list.forEach(m => {
    console.log(`[${m.status === 'NOW_SHOWING' ? '🟢 ĐANG CHIẾU' : '🟡 SẮP CHIẾU'}] ${m.title}`);
  });

  await mongoose.disconnect();
}

updateStatus().catch(err => {
  console.error(err);
  process.exit(1);
});
