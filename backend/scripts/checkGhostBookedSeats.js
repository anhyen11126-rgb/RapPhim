import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import Booking from '../src/models/Booking.js';

async function checkGhostBookedSeats() {
  await mongoose.connect(process.env.MONGODB_URI);
  const dryRunFile = path.resolve('backend/data/dry_run_affected_ids.json');
  const data = JSON.parse(fs.readFileSync(dryRunFile, 'utf-8'));
  const groupBIds = data.groupB_ProposedSoftDeleteIds.map(id => new mongoose.Types.ObjectId(id));

  const bookedSeats = await ShowtimeSeat.find({
    showtimeId: { $in: groupBIds },
    status: { $in: ['BOOKED', 'HOLDING'] }
  }).limit(10).lean();

  console.log('Mẫu 5 ghế BOOKED trên Nhóm B:');
  console.log(bookedSeats.slice(0, 5));

  // Kiểm tra bookingId trên các ghế này
  const withBookingId = await ShowtimeSeat.countDocuments({
    showtimeId: { $in: groupBIds },
    status: 'BOOKED',
    bookingId: { $ne: null }
  });
  const withoutBookingId = await ShowtimeSeat.countDocuments({
    showtimeId: { $in: groupBIds },
    status: 'BOOKED',
    $or: [{ bookingId: null }, { bookingId: { $exists: false } }]
  });

  console.log(`- Ghế BOOKED có bookingId: ${withBookingId}`);
  console.log(`- Ghế BOOKED KHÔNG CÓ bookingId (Ghế ảo do seed): ${withoutBookingId}`);

  // Nếu có bookingId, kiểm tra xem booking đó có tồn tại trong Booking collection không
  if (withBookingId > 0) {
    const sampleSeatWithBooking = await ShowtimeSeat.findOne({
      showtimeId: { $in: groupBIds },
      status: 'BOOKED',
      bookingId: { $ne: null }
    }).lean();
    const relatedBooking = await Booking.findById(sampleSeatWithBooking.bookingId);
    console.log('Mẫu booking liên quan:', relatedBooking);
  }

  await mongoose.disconnect();
}

checkGhostBookedSeats().catch(console.error);
