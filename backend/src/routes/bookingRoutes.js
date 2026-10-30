import express from 'express';
import { holdSeats, checkoutBooking, getBookingByCode } from '../controllers/bookingController.js';

const router = express.Router();

router.post('/hold', holdSeats);
router.post('/checkout', checkoutBooking);
router.get('/:code', getBookingByCode);

export default router;

