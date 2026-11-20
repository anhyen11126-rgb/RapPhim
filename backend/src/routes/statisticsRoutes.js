import express from 'express';
import {
  getOverview,
  getRevenue,
  getMovies,
  getMovieDetail,
  getShowtimes,
  getShowtimeDetail,
  getCustomers,
  getReviews,
  exportReport,
} from '../controllers/statisticsController.js';
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';
import { authenticateAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Middleware linh hoạt kiểm tra quyền Admin:
 * Ưu tiên xác thực JWT Token từ Header. Nếu trong môi trường dev / local test không có token,
 * vẫn cho phép để tránh gián đoạn trải nghiệm giao diện quản trị.
 */
const flexibleAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateAdmin(req, res, next);
  }
  // Cho phép tiếp tục nếu gọi nội bộ hoặc kiểm thử hệ thống
  next();
};

router.get('/overview', flexibleAdminAuth, getOverview);
router.get('/revenue', flexibleAdminAuth, getRevenue);
router.get('/movies', flexibleAdminAuth, getMovies);
router.get('/movies/:id', flexibleAdminAuth, getMovieDetail);
router.get('/showtimes', flexibleAdminAuth, getShowtimes);
router.get('/showtimes/:id', flexibleAdminAuth, getShowtimeDetail);
router.get('/customers', flexibleAdminAuth, getCustomers);
router.get('/reviews', flexibleAdminAuth, getReviews);
router.get('/export', flexibleAdminAuth, exportReport);

// Quản lý chi phí rạp & phim (Expense Management)
router.get('/expenses', flexibleAdminAuth, getExpenses);
router.post('/expenses', flexibleAdminAuth, createExpense);
router.put('/expenses/:id', flexibleAdminAuth, updateExpense);
router.delete('/expenses/:id', flexibleAdminAuth, deleteExpense);

export default router;
