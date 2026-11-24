import express from 'express';
import { authenticateAdmin } from '../middleware/authMiddleware.js';
import {
  getCinemas,
  getCinemaShowtimes,
  createCinema,
} from '../controllers/cinemaController.js';

const router = express.Router();

router.get('/', getCinemas);
router.get('/:id/showtimes', getCinemaShowtimes);
router.post('/', authenticateAdmin, createCinema);

export default router;

