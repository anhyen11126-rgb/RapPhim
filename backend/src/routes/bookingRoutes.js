import express from 'express';
import { authenticateAdmin, authenticateCustomer } from '../middleware/authMiddleware.js';
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
router.post('/checkout', authenticateCustomer, checkoutBooking);
router.get('/my-bookings', authenticateCustomer, getMyBookings);
router.post('/check-in', authenticateAdmin, checkInBooking);
router.post('/:id/cancel', authenticateCustomer, cancelBooking);
router.post('/:id/exchange', authenticateCustomer, exchangeBooking);
router.get('/:code', authenticateCustomer, getBookingByCode);

export default router;

