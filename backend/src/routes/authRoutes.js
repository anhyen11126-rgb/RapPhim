import express from 'express';
import { register, login, getMe, updateAvatar } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', getMe);
router.put('/avatar', updateAvatar);
router.post('/avatar', updateAvatar);

export default router;

