import express from 'express';
import {
  createMovieMongo,
  getAllMoviesMongo,
  getMovieMongoById,
  updateMovieMongo,
  deleteMovieMongo,
} from '../controllers/movieMongoController.js';

const router = express.Router();

// Route cho danh sách và tạo mới: /api/mongodb/movies
router.route('/')
  .get(getAllMoviesMongo)      // Lấy danh sách phim
  .post(createMovieMongo);     // Tạo phim mới

// Route theo ID cụ thể: /api/mongodb/movies/:id
router.route('/:id')
  .get(getMovieMongoById)      // Xem chi tiết 1 phim
  .put(updateMovieMongo)       // Cập nhật phim
  .delete(deleteMovieMongo);   // Xóa phim

export default router;

