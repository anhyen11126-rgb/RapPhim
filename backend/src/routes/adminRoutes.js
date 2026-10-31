import express from 'express';
import {
  adminLogin,
  adminRegister,
  getDashboardStats,
  createMovie,
  updateMovie,
  deleteMovie,
  createShowtime,
  getAdminBookings,
} from '../controllers/adminController.js';
import { authenticateAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route: Đăng nhập & Đăng ký
router.post('/login', adminLogin);
router.post('/register', adminRegister);

// Protected routes (cần Bearer Token)
router.get('/dashboard/stats', authenticateAdmin, getDashboardStats);
router.post('/movies', authenticateAdmin, createMovie);
router.put('/movies/:id', authenticateAdmin, updateMovie);
router.delete('/movies/:id', authenticateAdmin, deleteMovie);
router.post('/showtimes', authenticateAdmin, createShowtime);
router.get('/bookings', authenticateAdmin, getAdminBookings);

export default router;

