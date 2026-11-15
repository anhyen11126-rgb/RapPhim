import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import Movie from '../models/Movie.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const movies = await Movie.find({}).lean();
  for (const m of movies) {
    console.log({
      slug: m.slug,
      title: m.title,
      director: m.director,
      genre: m.genre,
      castCount: (m.cast || []).length,
      firstCast: (m.cast || [])[0],
      duration: m.duration,
      ageRating: m.ageRating,
    });
  }
  process.exit(0);
}

main();
