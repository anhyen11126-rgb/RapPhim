import express from 'express';
import {
  getMovies,
  getMovieById,
  addMovieReview,
  deleteMovieReview,
} from '../controllers/movieController.js';

const router = express.Router();

router.get('/', getMovies);
router.get('/:id', getMovieById);
router.post('/:id/reviews', addMovieReview);
router.delete('/:id/reviews/:reviewId', deleteMovieReview);
router.delete('/:id/reviews', deleteMovieReview);

export default router;

