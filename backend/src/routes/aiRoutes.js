import express from 'express';
import { chatWithAI, getAIContext, getPublicAiConfig } from '../controllers/aiController.js';

const router = express.Router();

router.post('/chat', chatWithAI);
router.get('/context', getAIContext);
router.get('/config', getPublicAiConfig);

export default router;
