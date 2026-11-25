import express from 'express';
import { authenticateAdmin, authenticateCustomer } from '../middleware/authMiddleware.js';
import {
  holdSeats,
  getHoldSession,
  releaseHoldSeats,
  checkoutBooking,
  getBookingByCode,
  getMyBookings,
  cancelBooking,
  exchangeBooking,
  checkInBooking,
} from '../controllers/bookingController.js';

const router = express.Router();

router.post('/hold', authenticateCustomer, holdSeats);
router.get('/hold/:holdId', authenticateCustomer, getHoldSession);
router.delete('/hold/:holdId', authenticateCustomer, releaseHoldSeats);
router.post('/checkout', authenticateCustomer, checkoutBooking);
router.get('/my-bookings', authenticateCustomer, getMyBookings);
router.post('/check-in', authenticateAdmin, checkInBooking);
router.post('/:id/cancel', authenticateCustomer, cancelBooking);
router.post('/:id/exchange', authenticateCustomer, exchangeBooking);
router.get('/:code', authenticateCustomer, getBookingByCode);

export default router;

