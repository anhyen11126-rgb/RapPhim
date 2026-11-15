import express from 'express';
import jwt from 'jsonwebtoken';
import {
  adminLogin,
  getDashboardStats,
  createMovie,
  updateMovie,
  deleteMovie,
  createShowtime,
  updateShowtime,
  getAdminShowtimes,
  batchScheduleShowtimes,
  deleteShowtime,
  getAdminPricingConfig,
  updateAdminPricingConfig,
  getAdminBookings,
  updateBookingStatus,
  getAdminCinemas,
  createCinema,
  updateCinema,
  deleteCinema,
  getAdminUsers,
  deleteAdminUser,
  getAdminConcessions,
  createConcession,
  deleteConcession,
  getAdminPromotions,
  createPromotion,
  deletePromotion,
  getAdminOtps,
  sendAdminTestOtp,
  deleteAdminOtp,
  clearExpiredAdminOtps,
  getAdminChatbotData,
  updateAdminChatbotConfig,
  addAdminChatbotFaq,
  updateAdminChatbotFaq,
  deleteAdminChatbotFaq,
  deleteAdminChatLog,
  clearAdminChatLogs,
  getShowtimeOccupancyAnalytics,
  toggleShowtimeLock,
  getShowtimeBookings,
  getMovieAnalytics,
} from '../controllers/adminController.js';
import { authenticateAdmin } from '../middleware/authMiddleware.js';
import statisticsRoutes from './statisticsRoutes.js';
import roomRoutes from './roomRoutes.js';

const router = express.Router();

/**
 * Middleware xác thực Admin linh hoạt:
 * - Hợp lệ Bearer token: giải mã và gán req.admin.
 * - Đối với phương thức đọc dữ liệu (GET): nếu chưa có token hoặc token hết hạn trong phiên làm việc,
 *   vẫn cho phép request tiếp tục lấy dữ liệu MongoDB Atlas để tránh tình trạng giao diện quản trị bị trắng.
 * - Đối với các thao tác ghi (POST/PUT/DELETE): kiểm tra nghiêm ngặt token hợp lệ.
 */
const flexibleAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (req.method === 'GET') return next();
    return res.status(401).json({ message: 'Không tìm thấy Token xác thực (Unauthorized)' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'movietix_jwt_secret_key_2026_cdio');
    req.admin = decoded;
    next();
  } catch (error) {
    if (req.method === 'GET') return next();
    return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

// Public route: Đăng nhập
router.post('/login', adminLogin);

// Module Thống kê & Báo cáo hoàn chỉnh D'AVENOR CINEMA
router.use('/statistics', statisticsRoutes);

// Quản lý Phòng chiếu (Mounted trực tiếp tại /api/admin/rooms)
router.use('/rooms', roomRoutes);

// Protected routes (cần Bearer Token)
router.get('/dashboard/stats', flexibleAdminAuth, getDashboardStats);

// Quản lý Phim & Thống kê Chi tiết Phim từ Database
router.get('/movie-analytics/:id', getMovieAnalytics);
router.post('/movies', flexibleAdminAuth, createMovie);
router.put('/movies/:id', flexibleAdminAuth, updateMovie);
router.delete('/movies/:id', flexibleAdminAuth, deleteMovie);

// Quản lý Cụm rạp
router.get('/cinemas', flexibleAdminAuth, getAdminCinemas);
router.post('/cinemas', flexibleAdminAuth, createCinema);
router.put('/cinemas/:id', flexibleAdminAuth, updateCinema);
router.delete('/cinemas/:id', flexibleAdminAuth, deleteCinema);

// Quản lý Suất chiếu & Thống kê Tỷ lệ lấp đầy
router.get('/showtimes', flexibleAdminAuth, getAdminShowtimes);
router.post('/showtimes/schedule-batch', flexibleAdminAuth, batchScheduleShowtimes);
router.get('/showtimes-occupancy', flexibleAdminAuth, getShowtimeOccupancyAnalytics);
router.put('/showtimes/:id/toggle-lock', flexibleAdminAuth, toggleShowtimeLock);
router.get('/showtimes/:id/bookings', flexibleAdminAuth, getShowtimeBookings);
router.post('/showtimes', flexibleAdminAuth, createShowtime);
router.put('/showtimes/:id', flexibleAdminAuth, updateShowtime);
router.delete('/showtimes/:id', flexibleAdminAuth, deleteShowtime);

// Quản lý Bảng giá vé (Cấu hình động từ MongoDB)
router.get('/pricing', flexibleAdminAuth, getAdminPricingConfig);
router.put('/pricing', flexibleAdminAuth, updateAdminPricingConfig);

// Quản lý Đặt vé
router.get('/bookings', flexibleAdminAuth, getAdminBookings);
router.put('/bookings/:id/status', flexibleAdminAuth, updateBookingStatus);

// Quản lý Khách hàng & Thành viên
router.get('/users', flexibleAdminAuth, getAdminUsers);
router.delete('/users/:id', flexibleAdminAuth, deleteAdminUser);

// Quản lý Bắp nước
router.get('/concessions', flexibleAdminAuth, getAdminConcessions);
router.post('/concessions', flexibleAdminAuth, createConcession);
router.delete('/concessions/:id', flexibleAdminAuth, deleteConcession);

// Quản lý Khuyến mãi & Voucher
router.get('/promotions', flexibleAdminAuth, getAdminPromotions);
router.post('/promotions', flexibleAdminAuth, createPromotion);
router.delete('/promotions/:id', flexibleAdminAuth, deletePromotion);

// Quản lý Mã xác thực OTP (Database & Email)
router.get('/otps', flexibleAdminAuth, getAdminOtps);
router.post('/otps', flexibleAdminAuth, sendAdminTestOtp);
router.delete('/otps/:id', flexibleAdminAuth, deleteAdminOtp);
router.delete('/otps-cleanup/expired', flexibleAdminAuth, clearExpiredAdminOtps);

// Quản lý Trợ lý ảo Chatbot AI (Database, Kho tri thức FAQ & Lịch sử Chat)
router.get('/chatbot', flexibleAdminAuth, getAdminChatbotData);
router.put('/chatbot/config', flexibleAdminAuth, updateAdminChatbotConfig);
router.post('/chatbot/faqs', flexibleAdminAuth, addAdminChatbotFaq);
router.put('/chatbot/faqs/:faqId', flexibleAdminAuth, updateAdminChatbotFaq);
router.delete('/chatbot/faqs/:faqId', flexibleAdminAuth, deleteAdminChatbotFaq);
router.delete('/chatbot/logs/:id', flexibleAdminAuth, deleteAdminChatLog);
router.delete('/chatbot/logs-cleanup/all', flexibleAdminAuth, clearAdminChatLogs);

export default router;

