import express from 'express';
import {
  getCinemas,
  getCinemaShowtimes,
  createCinema,
} from '../controllers/cinemaController.js';

const router = express.Router();

router.get('/', getCinemas);
router.get('/:id/showtimes', getCinemaShowtimes);
router.post('/', createCinema);

export default router;
