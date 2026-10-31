import express from 'express';
import { holdSeats, checkoutBooking, getBookingByCode, getMyBookings } from '../controllers/bookingController.js';

const router = express.Router();

router.post('/hold', holdSeats);
router.post('/checkout', checkoutBooking);
router.get('/my-bookings', getMyBookings);
router.get('/:code', getBookingByCode);

export default router;

