import express from 'express';
import {
  getPromotions,
  applyVoucher,
  createPromotion,
} from '../controllers/promotionController.js';

const router = express.Router();

router.get('/', getPromotions);
router.post('/apply', applyVoucher);
router.post('/', createPromotion);

export default router;

