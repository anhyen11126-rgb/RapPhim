import express from 'express';
import { getMovies, getMovieById, addMovieReview } from '../controllers/movieController.js';

const router = express.Router();

router.get('/', getMovies);
router.get('/:id', getMovieById);
router.post('/:id/reviews', addMovieReview);

export default router;

