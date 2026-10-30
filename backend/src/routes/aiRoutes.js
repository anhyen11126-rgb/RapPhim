import express from 'express';
import { chatWithAI, getAIContext } from '../controllers/aiController.js';

const router = express.Router();

router.post('/chat', chatWithAI);
router.get('/context', getAIContext);

export default router;

