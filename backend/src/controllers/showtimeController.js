import mongoose from 'mongoose';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Movie from '../models/Movie.js';

// Lấy thông tin 1 suất chiếu
export const getShowtimeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }

    const showtime = await Showtime.findById(id).populate('movieId').lean();

    if (!showtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }

    res.json({
      ...showtime,
      id: showtime._id.toString(),
      movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin suất chiếu', error: error.message });
  }
};

// Lấy sơ đồ ghế và trạng thái thực tế của suất chiếu
export const getShowtimeSeats = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }

    const showtimeId = new mongoose.Types.ObjectId(id);

    // Tự động giải phóng các ghế giữ tạm thời (HOLDING) đã hết hạn
    const now = new Date();
    await ShowtimeSeat.updateMany(
      {
        showtimeId,
        status: 'HOLDING',
        holdExpiresAt: { $lt: now },
      },
      {
        $set: {
          status: 'AVAILABLE',
          holdExpiresAt: null,
        },
      }
    );

    // Truy vấn danh sách ghế
    const rawSeats = await ShowtimeSeat.find({ showtimeId })
      .sort({ row: 1, col: 1 })
      .lean();

    const seats = rawSeats.map((s) => ({
      ...s,
      id: s._id.toString(),
    }));

    const showtime = await Showtime.findById(showtimeId).populate('movieId').lean();

    if (!showtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }

    res.json({
      showtime: {
        ...showtime,
        id: showtime._id.toString(),
        movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
      },
      seats,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy sơ đồ ghế', error: error.message });
  }
};
