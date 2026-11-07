import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import connectDB from './config/db.js';
import Showtime from './models/Showtime.js';

async function inspect() {
  await connectDB();
  const showtimes = await Showtime.find({}).limit(15).lean();
  console.log(`\nSample ${showtimes.length} showtimes in MongoDB Atlas:`);
  for (const st of showtimes) {
    console.log(`- Room: [${st.roomName}] | Format: [${st.formatFeature}] | Price: ${st.price} | Time: ${st.time || st.startTime}`);
  }
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});

