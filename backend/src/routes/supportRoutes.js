import express from 'express';
import {
  getFaqs,
  voteFaq,
  submitSupportTicket,
} from '../controllers/supportController.js';

const router = express.Router();

router.get('/faqs', getFaqs);
router.post('/faqs/:id/vote', voteFaq);
router.post('/tickets', submitSupportTicket);

export default router;
