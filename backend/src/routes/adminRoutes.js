import express from 'express';
import {
  adminLogin,
  getDashboardStats,
  createMovie,
  updateMovie,
  deleteMovie,
  createShowtime,
  getAdminShowtimes,
  deleteShowtime,
  getAdminBookings,
  updateBookingStatus,
  getAdminCinemas,
  createCinema,
  updateCinema,
  deleteCinema,
  getAdminUsers,
  getAdminConcessions,
  createConcession,
  deleteConcession,
  getAdminPromotions,
  createPromotion,
  deletePromotion,
} from '../controllers/adminController.js';
import { authenticateAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
// jchjcjd
// Public route: Đăng nhập
router.post('/login', adminLogin);

// Protected routes (cần Bearer Token)
router.get('/dashboard/stats', authenticateAdmin, getDashboardStats);

// Quản lý Phim
router.post('/movies', authenticateAdmin, createMovie);
router.put('/movies/:id', authenticateAdmin, updateMovie);
router.delete('/movies/:id', authenticateAdmin, deleteMovie);
//jjjj
// Quản lý Cụm rạp
router.get('/cinemas', authenticateAdmin, getAdminCinemas);
router.post('/cinemas', authenticateAdmin, createCinema);
router.put('/cinemas/:id', authenticateAdmin, updateCinema);
router.delete('/cinemas/:id', authenticateAdmin, deleteCinema);

// Quản lý Suất chiếu
router.get('/showtimes', authenticateAdmin, getAdminShowtimes);
router.post('/showtimes', authenticateAdmin, createShowtime);
router.delete('/showtimes/:id', authenticateAdmin, deleteShowtime);

// Quản lý Đặt vé
router.get('/bookings', authenticateAdmin, getAdminBookings);
router.put('/bookings/:id/status', authenticateAdmin, updateBookingStatus);

// Quản lý Khách hàng & Thành viên
router.get('/users', authenticateAdmin, getAdminUsers);

// Quản lý Bắp nước
router.get('/concessions', authenticateAdmin, getAdminConcessions);
router.post('/concessions', authenticateAdmin, createConcession);
router.delete('/concessions/:id', authenticateAdmin, deleteConcession);

// Quản lý Khuyến mãi & Voucher
router.get('/promotions', authenticateAdmin, getAdminPromotions);
router.post('/promotions', authenticateAdmin, createPromotion);
router.delete('/promotions/:id', authenticateAdmin, deletePromotion);

export default router;

