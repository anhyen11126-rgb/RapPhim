import { authenticateCustomer, optionalAuthenticateCustomer } from '../middleware/authMiddleware.js';
import express from 'express';
import {
  getMovies,
  getMovieById,
  getMovieSchedule,
  addMovieReview,
  updateMovieReview,
  deleteMovieReview,
  toggleLikeMovieReview,
  addMovieReviewReply,
  toggleLikeMovieReviewReply,
  deleteMovieReviewReply,
  reportMovieReview,
} from '../controllers/movieController.js';

const router = express.Router();

router.get('/', getMovies);
router.get('/:id/schedule', getMovieSchedule);
router.get('/:id', optionalAuthenticateCustomer, getMovieById);
router.post('/:id/reviews', authenticateCustomer, addMovieReview);
router.patch('/:id/reviews/:reviewId', authenticateCustomer, updateMovieReview);
router.delete('/:id/reviews/:reviewId', authenticateCustomer, deleteMovieReview);
router.post('/:id/reviews/:reviewId/like', authenticateCustomer, toggleLikeMovieReview);
router.post('/:id/reviews/:reviewId/replies', authenticateCustomer, addMovieReviewReply);
router.post('/:id/reviews/:reviewId/replies/:replyId/like', authenticateCustomer, toggleLikeMovieReviewReply);
router.delete('/:id/reviews/:reviewId/replies/:replyId', authenticateCustomer, deleteMovieReviewReply);
router.post('/:id/reviews/:reviewId/report', authenticateCustomer, reportMovieReview);

export default router;

