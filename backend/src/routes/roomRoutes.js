import express from 'express';
import { authenticateAdmin } from '../middleware/authMiddleware.js';
import {
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
} from '../controllers/roomController.js';

const router = express.Router();

router.get('/', getRooms);
router.post('/', authenticateAdmin, createRoom);
router.put('/:id', authenticateAdmin, updateRoom);
router.delete('/:id', authenticateAdmin, deleteRoom);

export default router;

