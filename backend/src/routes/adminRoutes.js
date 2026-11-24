import express from 'express';
import {
  adminLogin,
  getDashboardStats,
  createMovie,
  updateMovie,
  deleteMovie,
  createShowtime,
  updateShowtime,
  getAdminShowtimes,
  getAvailableShowtimeSlots,
  batchScheduleShowtimes,
  deleteShowtime,
  previewRecurringShowtimes,
  commitRecurringShowtimes,
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


// Public route: Đăng nhập
router.post('/login', adminLogin);

// Module Thống kê & Báo cáo hoàn chỉnh D'AVENOR CINEMA
router.use('/statistics', statisticsRoutes);

// Quản lý Phòng chiếu (Mounted trực tiếp tại /api/admin/rooms)
router.use('/rooms', roomRoutes);

// Protected routes (cần Bearer Token)
router.get('/dashboard/stats', authenticateAdmin, getDashboardStats);

// Quản lý Phim & Thống kê Chi tiết Phim từ Database
router.get('/movie-analytics/:id', authenticateAdmin, getMovieAnalytics);
router.post('/movies', authenticateAdmin, createMovie);
router.put('/movies/:id', authenticateAdmin, updateMovie);
router.delete('/movies/:id', authenticateAdmin, deleteMovie);

// Quản lý Cụm rạp
router.get('/cinemas', authenticateAdmin, getAdminCinemas);
router.post('/cinemas', authenticateAdmin, createCinema);
router.put('/cinemas/:id', authenticateAdmin, updateCinema);
router.delete('/cinemas/:id', authenticateAdmin, deleteCinema);

// Quản lý Suất chiếu & Thống kê Tỷ lệ lấp đầy
router.get('/showtimes', authenticateAdmin, getAdminShowtimes);
router.get('/showtimes/available-slots', authenticateAdmin, getAvailableShowtimeSlots);
router.post('/showtimes/schedule-batch', authenticateAdmin, batchScheduleShowtimes);
router.post('/showtimes/recurring/preview', authenticateAdmin, previewRecurringShowtimes);
router.post('/showtimes/recurring/commit', authenticateAdmin, commitRecurringShowtimes);
router.get('/showtimes-occupancy', authenticateAdmin, getShowtimeOccupancyAnalytics);
router.put('/showtimes/:id/toggle-lock', authenticateAdmin, toggleShowtimeLock);
router.get('/showtimes/:id/bookings', authenticateAdmin, getShowtimeBookings);
router.post('/showtimes', authenticateAdmin, createShowtime);
router.put('/showtimes/:id', authenticateAdmin, updateShowtime);
router.delete('/showtimes/:id', authenticateAdmin, deleteShowtime);

// Quản lý Bảng giá vé (Cấu hình động từ MongoDB)
router.get('/pricing', authenticateAdmin, getAdminPricingConfig);
router.put('/pricing', authenticateAdmin, updateAdminPricingConfig);

// Quản lý Đặt vé
router.get('/bookings', authenticateAdmin, getAdminBookings);
router.put('/bookings/:id/status', authenticateAdmin, updateBookingStatus);

// Quản lý Khách hàng & Thành viên
router.get('/users', authenticateAdmin, getAdminUsers);
router.delete('/users/:id', authenticateAdmin, deleteAdminUser);

// Quản lý Bắp nước
router.get('/concessions', authenticateAdmin, getAdminConcessions);
router.post('/concessions', authenticateAdmin, createConcession);
router.delete('/concessions/:id', authenticateAdmin, deleteConcession);

// Quản lý Khuyến mãi & Voucher
router.get('/promotions', authenticateAdmin, getAdminPromotions);
router.post('/promotions', authenticateAdmin, createPromotion);
router.delete('/promotions/:id', authenticateAdmin, deletePromotion);

// Quản lý Mã xác thực OTP (Database & Email)
router.get('/otps', authenticateAdmin, getAdminOtps);
router.post('/otps', authenticateAdmin, sendAdminTestOtp);
router.delete('/otps/:id', authenticateAdmin, deleteAdminOtp);
router.delete('/otps-cleanup/expired', authenticateAdmin, clearExpiredAdminOtps);

// Quản lý Trợ lý ảo Chatbot AI (Database, Kho tri thức FAQ & Lịch sử Chat)
router.get('/chatbot', authenticateAdmin, getAdminChatbotData);
router.put('/chatbot/config', authenticateAdmin, updateAdminChatbotConfig);
router.post('/chatbot/faqs', authenticateAdmin, addAdminChatbotFaq);
router.put('/chatbot/faqs/:faqId', authenticateAdmin, updateAdminChatbotFaq);
router.delete('/chatbot/faqs/:faqId', authenticateAdmin, deleteAdminChatbotFaq);
router.delete('/chatbot/logs/:id', authenticateAdmin, deleteAdminChatLog);
router.delete('/chatbot/logs-cleanup/all', authenticateAdmin, clearAdminChatLogs);

export default router;

