import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Showtime from './models/Showtime.js';

async function updateRoomTierPricing() {
  await connectDB();
  console.log('🔄 Bắt đầu đồng bộ bảng giá phân cấp theo từng loại phòng chiếu trong MongoDB Atlas...');

  const showtimes = await Showtime.find({});
  let imaxCount = 0;
  let goldClassCount = 0;
  let threeDCount = 0;
  let standardCount = 0;

  for (const st of showtimes) {
    const roomLower = (st.roomName || '').toLowerCase();
    const formatLower = (st.formatFeature || '').toLowerCase();

    let dateObj = st.startTime ? new Date(st.startTime) : new Date();
    if (isNaN(dateObj.getTime())) dateObj = new Date();

    let hour = dateObj.getHours();
    if (st.time && typeof st.time === 'string' && st.time.includes(':')) {
      const [h] = st.time.split(':').map(Number);
      if (!isNaN(h)) hour = h;
    }

    const day = dateObj.getDay(); // 0: CN, 5: T6, 6: T7
    const isWeekend = day === 0 || day === 5 || day === 6;
    const isBefore17 = hour < 17;
    const isLateNight = hour >= 22 || hour < 6;

    let targetPrice = 50000;

    // 1. Phân loại phòng chiếu IMAX Laser (Phòng cao cấp nhất)
    if (roomLower.includes('imax') || formatLower.includes('imax')) {
      if (isLateNight) {
        targetPrice = 140000;
      } else if (isWeekend) {
        targetPrice = isBefore17 ? 160000 : 170000;
      } else {
        targetPrice = isBefore17 ? 140000 : 160000;
      }
      imaxCount++;
    }
    // 2. Phân loại phòng chiếu VIP Gold Class / Lounge
    else if (roomLower.includes('gold class') || roomLower.includes('lounge') || formatLower.includes('gold class')) {
      targetPrice = isWeekend ? 220000 : 200000;
      goldClassCount++;
    }
    // 3. Phân loại phòng chiếu 3D / RealD 3D
    else if (roomLower.includes('3d') || formatLower.includes('3d')) {
      if (isLateNight) {
        targetPrice = 60000;
      } else if (isWeekend) {
        targetPrice = isBefore17 ? 75000 : 80000;
      } else {
        targetPrice = isBefore17 ? 60000 : 65000;
      }
      threeDCount++;
    }
    // 4. Phân loại phòng chiếu 2D Tiêu chuẩn / Dolby 7.1 / Dolby Atmos
    else {
      if (isLateNight) {
        targetPrice = 50000;
      } else if (isWeekend) {
        targetPrice = isBefore17 ? 60000 : 65000;
      } else {
        targetPrice = isBefore17 ? 45000 : 50000;
      }
      standardCount++;
    }

    st.price = targetPrice;
    await st.save();
  }

  console.log(`\n🎉 HOÀN TẤT ĐỒNG BỘ GIÁ THEO LOẠI PHÒNG CHIẾU TRÊN MONGODB ATLAS:`);
  console.log(`- Phòng IMAX Laser: ${imaxCount} suất chiếu (giá vé 140.000đ - 170.000đ)`);
  console.log(`- Phòng VIP Gold Class: ${goldClassCount} suất chiếu (giá vé 200.000đ - 220.000đ)`);
  console.log(`- Phòng 3D RealD: ${threeDCount} suất chiếu (giá vé 60.000đ - 80.000đ)`);
  console.log(`- Phòng 2D Tiêu chuẩn / Atmos: ${standardCount} suất chiếu (giá vé 45.000đ - 65.000đ)`);
  console.log(`Tổng cộng: ${showtimes.length} suất chiếu đã được cập nhật chính xác!`);

  process.exit(0);
}

updateRoomTierPricing().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

