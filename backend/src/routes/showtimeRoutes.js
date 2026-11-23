import express from 'express';
import {
  getShowtimeById,
  getShowtimeSeats,
  recommendSeats,
} from '../controllers/showtimeController.js';

const router = express.Router();

router.get('/:id/recommend-seats', recommendSeats);
router.get('/:id/seats', getShowtimeSeats);
router.get('/:id', getShowtimeById);

export default router;

