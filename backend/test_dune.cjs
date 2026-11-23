const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Showtime = mongoose.model('Showtime', new mongoose.Schema({}, { strict: false }));
  const Movie = mongoose.model('Movie', new mongoose.Schema({}, { strict: false }));
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }));
  const ShowtimeSeat = mongoose.model('ShowtimeSeat', new mongoose.Schema({}, { strict: false }));

  const dune = await Movie.findOne({ title: /Dune/i });
  console.log('Dune ID:', dune?._id?.toString());

  const showtimes = await Showtime.find({ movie: dune?._id }).sort({ startTime: 1 }).lean();
  console.log('Total Dune showtimes:', showtimes.length);

  for (const st of showtimes) {
    const seats = await ShowtimeSeat.find({ showtime: st._id, status: 'BOOKED' }).lean();
    const bookings = await Booking.find({ showtime: st._id }).lean();
    const d = st.date || (st.startTime ? new Date(st.startTime).toISOString() : 'N/A');
    console.log('ST:', st._id.toString(), '| Date:', d, '| Time:', st.time, '| Room:', (st.roomName || st.roomType), '| BookedSeats:', seats.length, '| Bookings:', bookings.length);
  }

  await mongoose.disconnect();
}
check();
