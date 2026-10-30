import express from 'express';
import { getConcessions } from '../controllers/concessionController.js';

const router = express.Router();

router.get('/', getConcessions);

export default router;

