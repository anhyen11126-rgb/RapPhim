import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import Room from '../models/Room.js';
import Cinema from '../models/Cinema.js';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Booking from '../models/Booking.js';
import Movie from '../models/Movie.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB!');

  const cinemas = await Cinema.find({}).lean();
  console.log(`Found ${cinemas.length} cinemas:`);
  for (const c of cinemas) {
    const rooms = await Room.find({ cinemaId: c._id }).lean();
    console.log(`- Cinema [${c.name}] has ${rooms.length} rooms`);
  }

  const allRooms = await Room.find({}).lean();
  console.log(`\nTotal rooms in database: ${allRooms.length}`);
  allRooms.forEach((r, idx) => {
    console.log(`  Room ${idx + 1}: ${r.name} (${r.roomType}) - ${r.totalSeats} seats, cinemaId: ${r.cinemaId}`);
  });

  const totalSeatsInSeatsCollection = await ShowtimeSeat.countDocuments({});
  const totalShowtimes = await Showtime.countDocuments({});
  const totalBookings = await Booking.countDocuments({});
  console.log(`\nShowtimes: ${totalShowtimes}, ShowtimeSeats: ${totalSeatsInSeatsCollection}, Bookings: ${totalBookings}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
