import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Movie from '../models/Movie.js';

/**
 * Lấy danh sách khoản chi phí (có lọc theo tháng, năm, phim, phân loại)
 */
export const getExpenses = async (req, res) => {
  try {
    const { month, year, movieId, type, search = '', page = 1, limit = 20 } = req.query;

    const query = {};

    if (month && Number(month) > 0) {
      query.month = Number(month);
    }
    if (year && Number(year) > 0) {
      query.year = Number(year);
    }
    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      query.movieId = new mongoose.Types.ObjectId(movieId);
    }
    if (type && type !== 'ALL') {
      query.type = type;
    }
    if (search && search.trim().length > 0) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { costCode: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const total = await Expense.countDocuments(query);
    const skip = (Number(page) - 1) * Number(limit);

    const items = await Expense.find(query)
      .populate('movieId', 'title poster posterUrl')
      .populate('cinemaId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Tính tổng kết chi phí
    const aggregateSummary = await Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          directAmount: {
            $sum: {
              $cond: [{ $eq: ['$type', 'DIRECT_MOVIE'] }, '$amount', 0],
            },
          },
          sharedAmount: {
            $sum: {
              $cond: [{ $ne: ['$type', 'DIRECT_MOVIE'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    const summary = aggregateSummary[0] || { totalAmount: 0, directAmount: 0, sharedAmount: 0 };

    res.json({
      success: true,
      data: {
        items,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 1,
        summary,
      },
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách chi phí:', error);
    res.status(500).json({ success: false, message: 'Lỗi nạp danh sách chi phí', error: error.message });
  }
};

/**
 * Thêm một khoản chi phí mới
 */
export const createExpense = async (req, res) => {
  try {
    const { title, type, amount, movieId, cinemaId, date, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Tên khoản chi không được để trống' });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn loại chi phí' });
    }
    if (amount == null || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Số tiền chi phí không hợp lệ' });
    }

    const expenseDate = date ? new Date(date) : new Date();
    const month = expenseDate.getMonth() + 1;
    const year = expenseDate.getFullYear();

    // Tạo mã chi phí tự động: CP-YYYYMM-XXXX
    const count = await Expense.countDocuments({ month, year });
    const costCode = `CP-${year}${String(month).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

    const newExpense = new Expense({
      costCode,
      title: title.trim(),
      type,
      amount: Number(amount),
      movieId: movieId && mongoose.Types.ObjectId.isValid(movieId) ? new mongoose.Types.ObjectId(movieId) : null,
      cinemaId: cinemaId && mongoose.Types.ObjectId.isValid(cinemaId) ? new mongoose.Types.ObjectId(cinemaId) : null,
      date: expenseDate,
      month,
      year,
      notes: notes ? notes.trim() : '',
    });

    await newExpense.save();

    res.status(201).json({
      success: true,
      message: 'Tạo khoản chi phí thành công',
      data: newExpense,
    });
  } catch (error) {
    console.error('Lỗi khi tạo chi phí:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo chi phí', error: error.message });
  }
};

/**
 * Cập nhật một khoản chi phí
 */
export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, amount, movieId, cinemaId, date, notes } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khoản chi phí' });
    }

    if (title != null) expense.title = title.trim();
    if (type != null) expense.type = type;
    if (amount != null) expense.amount = Number(amount);
    if (notes != null) expense.notes = notes.trim();

    if (movieId !== undefined) {
      expense.movieId = movieId && mongoose.Types.ObjectId.isValid(movieId) ? new mongoose.Types.ObjectId(movieId) : null;
    }
    if (cinemaId !== undefined) {
      expense.cinemaId = cinemaId && mongoose.Types.ObjectId.isValid(cinemaId) ? new mongoose.Types.ObjectId(cinemaId) : null;
    }

    if (date) {
      expense.date = new Date(date);
      expense.month = expense.date.getMonth() + 1;
      expense.year = expense.date.getFullYear();
    }

    await expense.save();

    res.json({
      success: true,
      message: 'Cập nhật khoản chi phí thành công',
      data: expense,
    });
  } catch (error) {
    console.error('Lỗi cập nhật chi phí:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật chi phí', error: error.message });
  }
};

/**
 * Xóa một khoản chi phí
 */
export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Expense.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khoản chi phí cần xóa' });
    }

    res.json({
      success: true,
      message: 'Đã xóa khoản chi phí thành công',
    });
  } catch (error) {
    console.error('Lỗi xóa chi phí:', error);
    res.status(500).json({ success: false, message: 'Lỗi xóa chi phí', error: error.message });
  }
};
