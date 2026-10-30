import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './prisma.js';

// Import Routes
import movieRoutes from './routes/movieRoutes.js';
import showtimeRoutes from './routes/showtimeRoutes.js';
import concessionRoutes from './routes/concessionRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import movieMongoRoutes from './routes/movieMongoRoutes.js';
import connectDB from './config/db.js';

dotenv.config();

// Khởi chạy kết nối MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Gắn các API Routes
app.use('/api/movies', movieRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/concessions', concessionRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/mongodb/movies', movieMongoRoutes);

// Health Check API
app.get('/api/health', async (req, res) => {
  try {
    const movieCount = await prisma.movie.count();
    const showtimeCount = await prisma.showtime.count();
    const bookingCount = await prisma.booking.count();
    res.json({
      status: 'OK',
      message: 'MovieTix Backend API đang hoạt động bình thường',
      database: {
        connected: true,
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
  console.log(`🚀 MovieTix Backend chạy thành công tại http://localhost:${PORT}`);
  console.log(`🎬 API Phim: http://localhost:${PORT}/api/movies`);
  console.log(`🍃 API Phim MongoDB: http://localhost:${PORT}/api/mongodb/movies`);
  console.log(`🍿 API Bắp nước: http://localhost:${PORT}/api/concessions`);
  console.log(`🤖 API Trợ lý ảo AI: http://localhost:${PORT}/api/ai/chat`);
});
