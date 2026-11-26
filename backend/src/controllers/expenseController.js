import mongoose from 'mongoose';
import Expense, { DIRECT_MOVIE_EXPENSE_TYPES, EXPENSE_CATEGORY_LABELS } from '../models/Expense.js';
import { getVietnamParts, parseDateFilter } from '../utils/statisticsUtils.js';

/**
 * Lấy danh sách khoản chi phí (có lọc theo kỳ thời gian, tháng, năm, phim, phòng, phân loại)
 */
export const getExpenses = async (req, res) => {
  try {
    const {
      timeRange,
      customStart,
      customEnd,
      month,
      year,
      movieId,
      roomId,
      type,
      search = '',
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};

    if (timeRange) {
      const { start, end, month: parsedMonth, year: parsedYear } = parseDateFilter({
        timeRange,
        customStart,
        customEnd,
        month,
        year,
      });
      if (timeRange === 'by_month' && parsedMonth && parsedYear) {
        query.$or = [
          { month: Number(parsedMonth), year: Number(parsedYear) },
          { date: { $gte: start, $lte: end } },
        ];
      } else {
        query.date = { $gte: start, $lte: end };
      }
    } else {
      if (month && Number(month) > 0) {
        query.month = Number(month);
      }
      if (year && Number(year) > 0) {
        query.year = Number(year);
      }
    }

    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      query.movieId = new mongoose.Types.ObjectId(movieId);
    }
    if (roomId && roomId !== 'ALL' && mongoose.Types.ObjectId.isValid(roomId)) {
      query.roomId = new mongoose.Types.ObjectId(roomId);
    }
    if (type && type !== 'ALL') {
      query.type = type;
    }
    if (search && search.trim().length > 0) {
      const searchCond = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { costCode: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchCond }];
        delete query.$or;
      } else {
        query.$or = searchCond;
      }
    }

    const total = await Expense.countDocuments(query);
    const skip = (Number(page) - 1) * Number(limit);

    const rawItems = await Expense.find(query)
      .populate('movieId', 'title poster posterUrl')
      .populate('roomId', 'roomNumber name shortName roomType')
      .populate('cinemaId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const items = rawItems.map((item) => ({
      ...item,
      id: item._id.toString(),
      categoryLabel: EXPENSE_CATEGORY_LABELS[item.type] || item.type,
      isDirectMovieCost: Boolean(item.movieId) || DIRECT_MOVIE_EXPENSE_TYPES.includes(item.type),
    }));

    const aggregateSummary = await Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          directAmount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ['$type', DIRECT_MOVIE_EXPENSE_TYPES] },
                    { $ne: [{ $ifNull: ['$movieId', null] }, null] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
          sharedAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: [{ $in: ['$type', DIRECT_MOVIE_EXPENSE_TYPES] }] },
                    { $eq: [{ $ifNull: ['$movieId', null] }, null] },
                  ],
                },
                '$amount',
                0,
              ],
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
    const { title, type, amount, movieId, roomId, cinemaId, date, month: reqMonth, year: reqYear, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Tên khoản chi không được để trống' });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn loại chi phí' });
    }
    if (amount == null || Number.isNaN(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Số tiền chi phí không hợp lệ' });
    }

    const expenseDate = date ? new Date(date) : new Date();
    const vnParts = getVietnamParts(expenseDate);
    const month = reqMonth ? Number(reqMonth) : vnParts.month;
    const year = reqYear ? Number(reqYear) : vnParts.year;

    // Tạo mã chi phí tự động không trùng lặp: CP-YYYYMM-XXXX
    const count = await Expense.countDocuments({ month, year });
    const randSuffix = String(Date.now()).slice(-3);
    const costCode = `CP-${year}${String(month).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}${randSuffix}`;

    const newExpense = new Expense({
      costCode,
      title: title.trim(),
      type,
      amount: Number(amount),
      movieId: movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId) ? new mongoose.Types.ObjectId(movieId) : null,
      roomId: roomId && roomId !== 'ALL' && mongoose.Types.ObjectId.isValid(roomId) ? new mongoose.Types.ObjectId(roomId) : null,
      cinemaId: cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId) ? new mongoose.Types.ObjectId(cinemaId) : null,
      date: expenseDate,
      month,
      year,
      notes: notes ? notes.trim() : '',
    });

    await newExpense.save();
    const populated = await Expense.findById(newExpense._id)
      .populate('movieId', 'title poster posterUrl')
      .populate('roomId', 'roomNumber name shortName roomType')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Tạo khoản chi phí thành công',
      data: {
        ...populated,
        id: populated._id.toString(),
        categoryLabel: EXPENSE_CATEGORY_LABELS[populated.type] || populated.type,
      },
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
    const { title, type, amount, movieId, roomId, cinemaId, date, month: reqMonth, year: reqYear, notes } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khoản chi phí' });
    }

    if (title != null) expense.title = title.trim();
    if (type != null) expense.type = type;
    if (amount != null) expense.amount = Number(amount);
    if (notes != null) expense.notes = notes.trim();

    if (movieId !== undefined) {
      expense.movieId = movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)
        ? new mongoose.Types.ObjectId(movieId)
        : null;
    }
    if (roomId !== undefined) {
      expense.roomId = roomId && roomId !== 'ALL' && mongoose.Types.ObjectId.isValid(roomId)
        ? new mongoose.Types.ObjectId(roomId)
        : null;
    }
    if (cinemaId !== undefined) {
      expense.cinemaId = cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)
        ? new mongoose.Types.ObjectId(cinemaId)
        : null;
    }

    if (date) {
      expense.date = new Date(date);
      const vnParts = getVietnamParts(expense.date);
      expense.month = reqMonth ? Number(reqMonth) : vnParts.month;
      expense.year = reqYear ? Number(reqYear) : vnParts.year;
    } else {
      if (reqMonth) expense.month = Number(reqMonth);
      if (reqYear) expense.year = Number(reqYear);
    }

    await expense.save();
    const populated = await Expense.findById(expense._id)
      .populate('movieId', 'title poster posterUrl')
      .populate('roomId', 'roomNumber name shortName roomType')
      .lean();

    res.json({
      success: true,
      message: 'Cập nhật khoản chi phí thành công',
      data: {
        ...populated,
        id: populated._id.toString(),
        categoryLabel: EXPENSE_CATEGORY_LABELS[populated.type] || populated.type,
      },
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
