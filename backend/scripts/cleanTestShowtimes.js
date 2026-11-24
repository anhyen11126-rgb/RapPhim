import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  const stCount = await Showtime.countDocuments();
  console.log('Số showtime hiện tại:', stCount);
  if (stCount > 0) {
    const sts = await Showtime.find().select('_id roomName startTime').lean();
    console.log('Các showtime tồn tại:', sts);
    await Showtime.deleteMany({});
    await ShowtimeSeat.deleteMany({});
    console.log('✅ Đã dọn dẹp sạch sẽ toàn bộ test showtime và test seats!');
  }
  const finalCount = await Showtime.countDocuments();
  const finalSeats = await ShowtimeSeat.countDocuments();
  console.log(`Số showtime sau khi dọn: ${finalCount}`);
  console.log(`Số ghế sau khi dọn: ${finalSeats}`);
  await mongoose.disconnect();
}

clean().catch(console.error);
