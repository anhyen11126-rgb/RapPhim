import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Import Mongoose Models for Health Check
import Movie from './models/Movie.js';
import Showtime from './models/Showtime.js';
import Booking from './models/Booking.js';

// Import Routes
import movieRoutes from './routes/movieRoutes.js';
import showtimeRoutes from './routes/showtimeRoutes.js';
import concessionRoutes from './routes/concessionRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import cinemaRoutes from './routes/cinemaRoutes.js';
import promotionRoutes from './routes/promotionRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import authRoutes from './routes/authRoutes.js';
import connectDB from './config/db.js';

dotenv.config();

// Khởi chạy kết nối MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Gắn các API Routes chính
app.use('/api/movies', movieRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/concessions', concessionRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/cinemas', cinemaRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/auth', authRoutes);

// Health Check API
app.get('/api/health', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    let movieCount = 0;
    let showtimeCount = 0;
    let bookingCount = 0;

    if (isConnected) {
      movieCount = await Movie.countDocuments();
      showtimeCount = await Showtime.countDocuments();
      bookingCount = await Booking.countDocuments();
    }

    res.json({
      status: isConnected ? 'OK' : 'DISCONNECTED',
      message: isConnected
        ? "D'AVENOR CINEMA Backend API (MongoDB Atlas) đang hoạt động bình thường"
        : 'Chưa kết nối được tới MongoDB Database',
      database: {
        type: 'MongoDB Atlas',
        connected: isConnected,
        movies: movieCount,
        showtimes: showtimeCount,
        bookings: bookingCount,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// Khởi chạy Server
app.listen(PORT, () => {
  console.log(`🚀 D'AVENOR CINEMA Backend chạy thành công tại http://localhost:${PORT}`);
  console.log(`🎬 API Phim: http://localhost:${PORT}/api/movies`);
  console.log(`🍿 API Bắp nước: http://localhost:${PORT}/api/concessions`);
  console.log(`🤖 API Trợ lý ảo AI: http://localhost:${PORT}/api/ai/chat`);
});
