import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import Booking from '../models/Booking.js';

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB!');
    
    const movies = await Movie.find({}).lean();
    console.log(`Found ${movies.length} movies in MongoDB:`);
    for (const m of movies) {
      const showtimeCount = await Showtime.countDocuments({ movieId: m._id });
      console.log({
        id: m._id.toString(),
        slug: m.slug,
        title: m.title,
        status: m.status,
        posterUrl: m.posterUrl,
        poster: m.poster,
        bannerUrl: m.bannerUrl,
        showtimes: showtimeCount,
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
