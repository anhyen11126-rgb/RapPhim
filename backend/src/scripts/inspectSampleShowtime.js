import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function inspectSample() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const sampleSt = await db.collection('showtimes').findOne({});
  console.log('Sample showtime:', JSON.stringify(sampleSt, null, 2));

  const sampleSeats = await db.collection('showtimeseats').find({ showtimeId: sampleSt._id }).limit(5).toArray();
  console.log('Sample seats:', JSON.stringify(sampleSeats, null, 2));

  const totalSeats = await db.collection('showtimeseats').countDocuments({ showtimeId: sampleSt._id });
  console.log('Total seats for this showtime:', totalSeats);

  process.exit(0);
}
inspectSample();
