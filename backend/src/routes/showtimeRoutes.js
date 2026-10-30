import express from 'express';
import { getShowtimeById, getShowtimeSeats } from '../controllers/showtimeController.js';

const router = express.Router();

router.get('/:id', getShowtimeById);
router.get('/:id/seats', getShowtimeSeats);

export default router;

