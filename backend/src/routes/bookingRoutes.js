import express from 'express';
import {
  holdSeats,
  checkoutBooking,
  getBookingByCode,
  getMyBookings,
  cancelBooking,
  exchangeBooking,
  checkInBooking,
} from '../controllers/bookingController.js';

const router = express.Router();

router.post('/hold', holdSeats);
router.post('/checkout', checkoutBooking);
router.get('/my-bookings', getMyBookings);
router.post('/check-in', checkInBooking);
router.post('/:id/cancel', cancelBooking);
router.post('/:id/exchange', exchangeBooking);
router.get('/:code', getBookingByCode);

export default router;

