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


router.get('/overview', authenticateAdmin, getOverview);
router.get('/revenue', authenticateAdmin, getRevenue);
router.get('/movies', authenticateAdmin, getMovies);
router.get('/movies/:id', authenticateAdmin, getMovieDetail);
router.get('/showtimes', authenticateAdmin, getShowtimes);
router.get('/showtimes/:id', authenticateAdmin, getShowtimeDetail);
router.get('/customers', authenticateAdmin, getCustomers);
router.get('/reviews', authenticateAdmin, getReviews);
router.get('/export', authenticateAdmin, exportReport);

// Quản lý chi phí rạp & phim (Expense Management)
router.get('/expenses', authenticateAdmin, getExpenses);
router.post('/expenses', authenticateAdmin, createExpense);
router.put('/expenses/:id', authenticateAdmin, updateExpense);
router.delete('/expenses/:id', authenticateAdmin, deleteExpense);

export default router;
