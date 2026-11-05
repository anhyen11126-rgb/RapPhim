import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import connectDB from './config/db.js';
import Cinema from './models/Cinema.js';
import Showtime from './models/Showtime.js';

async function check() {
  await connectDB();
  const cinemas = await Cinema.find({ city: 'Đà Nẵng' });
  console.log(`\n📊 Tìm thấy ${cinemas.length} rạp Đà Nẵng trong MongoDB Atlas:`);
  for (const c of cinemas) {
    const count = await Showtime.countDocuments({ cinemaId: c._id });
    console.log(`- [${c.name}] (${c.district || 'Hải Châu'}): ${count} suất chiếu`);
  }
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});

