import express from 'express';
import { authenticateAdmin } from '../middleware/authMiddleware.js';
import {
  getPromotions,
  applyVoucher,
  createPromotion,
} from '../controllers/promotionController.js';

const router = express.Router();

router.get('/', getPromotions);
router.post('/apply', applyVoucher);
router.post('/', authenticateAdmin, createPromotion);

export default router;

