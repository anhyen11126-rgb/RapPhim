import express from 'express';
import { register, login, getMe, updateAvatar, resetPassword, sendEmailOtp, verifyEmailOtp } from '../controllers/authController.js';

const router = express.Router();

function limitAuthRequests(maxRequests, windowMs) {
  const attempts = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, state] of attempts) if (state.expires <= now) attempts.delete(ip);
  }, windowMs);
  cleanup.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let state = attempts.get(key);
    if (!state || state.expires <= now) {
      state = { count: 0, expires: now + windowMs };
      attempts.set(key, state);
    }
    if (state.count >= maxRequests) {
      res.set('Retry-After', String(Math.ceil((state.expires - now) / 1000)));
      return res.status(429).json({ message: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.' });
    }
    state.count++;
    return next();
  };
}

const loginLimit = limitAuthRequests(15, 10 * 60 * 1000);
const otpSendLimit = limitAuthRequests(8, 10 * 60 * 1000);
const otpVerifyLimit = limitAuthRequests(20, 10 * 60 * 1000);

router.post('/register', otpVerifyLimit, register);
router.post('/login', loginLimit, login);
router.get('/me', getMe);
router.put('/avatar', updateAvatar);
router.post('/avatar', updateAvatar);
router.post('/reset-password', otpVerifyLimit, resetPassword);
router.post('/send-email-otp', otpSendLimit, sendEmailOtp);
router.post('/verify-email-otp', otpVerifyLimit, verifyEmailOtp);

export default router;

