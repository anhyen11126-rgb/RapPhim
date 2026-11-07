import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Cinema from './models/Cinema.js';
import Showtime from './models/Showtime.js';
import ShowtimeSeat from './models/ShowtimeSeat.js';
import { DA_NANG_CINEMAS_DATA } from './updateDaNangCinemasAndPricing.js';

async function cleanToOnlyDaNangCinemas() {
  await connectDB();
  console.log('🔄 Bắt đầu dọn dẹp hệ thống rạp: Chỉ giữ duy nhất 12 cụm rạp tại Đà Nẵng...');

  // 1. Tìm các rạp không thuộc Đà Nẵng
  const nonDaNangCinemas = await Cinema.find({ city: { $ne: 'Đà Nẵng' } });
  console.log(`📍 Tìm thấy ${nonDaNangCinemas.length} cụm rạp ngoài Đà Nẵng cần xóa.`);

  if (nonDaNangCinemas.length > 0) {
    const nonDaNangIds = nonDaNangCinemas.map(c => c._id);
    
    // Tìm các showtimes của các rạp này
    const nonDaNangShowtimes = await Showtime.find({ cinemaId: { $in: nonDaNangIds } });
    const showtimeIds = nonDaNangShowtimes.map(st => st._id);
    
    // Xóa ghế của các suất chiếu này
    const deletedSeats = await ShowtimeSeat.deleteMany({ showtimeId: { $in: showtimeIds } });
    console.log(`- Đã xóa ${deletedSeats.deletedCount} ghế của các rạp ngoài Đà Nẵng.`);

    // Xóa suất chiếu
    const deletedShowtimes = await Showtime.deleteMany({ cinemaId: { $in: nonDaNangIds } });
    console.log(`- Đã xóa ${deletedShowtimes.deletedCount} suất chiếu của các rạp ngoài Đà Nẵng.`);

    // Xóa rạp ngoài Đà Nẵng
    const deletedCinemas = await Cinema.deleteMany({ _id: { $in: nonDaNangIds } });
    console.log(`- Đã xóa ${deletedCinemas.deletedCount} cụm rạp ngoài Đà Nẵng.`);
  }

  // 2. Đồng bộ đảm bảo đủ 12 cụm rạp tại Đà Nẵng với thông tin chuẩn
  for (const cData of DA_NANG_CINEMAS_DATA) {
    await Cinema.findOneAndUpdate(
      { name: cData.name },
      { $set: cData },
      { upsert: true, new: true }
    );
  }

  const remaining = await Cinema.find({});
  console.log(`\n🎉 HOÀN TẤT! Hiện tại hệ thống có đúng ${remaining.length} cụm rạp:`);
  remaining.forEach(c => {
    console.log(`- [${c.district}] ${c.name} - ${c.address}`);
  });

  process.exit(0);
}

cleanToOnlyDaNangCinemas().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

