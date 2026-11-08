import express from 'express';
import { register, login, getMe, updateAvatar, resetPassword, sendEmailOtp, verifyEmailOtp } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', getMe);
router.put('/avatar', updateAvatar);
router.post('/avatar', updateAvatar);
router.post('/reset-password', resetPassword);
router.post('/send-email-otp', sendEmailOtp);
router.post('/verify-email-otp', verifyEmailOtp);

export default router;

