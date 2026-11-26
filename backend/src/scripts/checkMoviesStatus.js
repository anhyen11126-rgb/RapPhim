import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';
import { configureOptionalDnsServers } from '../config/db.js';
configureOptionalDnsServers();
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const movies = await Movie.find({}).lean();
  console.log('--- SHOWTIMES PER MOVIE ---');
  for (const m of movies) {
    const count = await Showtime.countDocuments({ movieId: m._id });
    console.log(`- "${m.title}" (slug: ${m.slug}) => ${count} showtimes`);
  }
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
