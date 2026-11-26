import mongoose from 'mongoose';
import { getVietnamParts } from '../utils/statisticsUtils.js';

export const EXPENSE_CATEGORIES = [
  'MOVIE_LICENSE',      // Chi phí bản quyền phim
  'REVENUE_SHARE',      // Chia sẻ doanh thu nhà phát hành
  'ELECTRICITY_WATER',  // Chi phí điện nước, điều hòa
  'STAFF',              // Chi phí nhân sự
  'CLEANING',           // Chi phí vệ sinh
  'MAINTENANCE',        // Chi phí bảo trì phòng chiếu & thiết bị
  'MARKETING',          // Chi phí marketing
  'CONCESSION_COGS',    // Chi phí nguyên liệu bắp nước
  'OTHER',              // Chi phí khác
  // Tương thích ngược với các mã cũ
  'DIRECT_MOVIE',
  'OPERATIONAL_CINEMA',
  'UTILITY',
];

export const DIRECT_MOVIE_EXPENSE_TYPES = [
  'MOVIE_LICENSE',
  'REVENUE_SHARE',
  'DIRECT_MOVIE',
];

export const EXPENSE_CATEGORY_LABELS = {
  MOVIE_LICENSE: 'Chi phí bản quyền phim',
  REVENUE_SHARE: 'Chia sẻ doanh thu nhà phát hành',
  DIRECT_MOVIE: 'Bản quyền & Chia sẻ doanh thu phim',
  MARKETING: 'Chi phí Marketing & Quảng bá',
  ELECTRICITY_WATER: 'Chi phí điện nước & điều hòa',
  UTILITY: 'Điện nước, Mạng & Tiện ích',
  STAFF: 'Chi phí nhân sự & vận hành ca',
  CLEANING: 'Chi phí vệ sinh phòng chiếu',
  MAINTENANCE: 'Chi phí bảo trì thiết bị & phòng chiếu',
  OPERATIONAL_CINEMA: 'Vận hành cụm rạp',
  CONCESSION_COGS: 'Chi phí nguyên liệu bắp nước',
  OTHER: 'Chi phí khác',
};

const expenseSchema = new mongoose.Schema(
  {
    costCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Tên khoản chi không được để trống'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Loại chi phí không được để trống'],
      enum: EXPENSE_CATEGORIES,
      default: 'MOVIE_LICENSE',
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền chi phí không được để trống'],
      min: [0, 'Số tiền không được âm'],
    },
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
      default: null,
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
      index: true,
    },
    cinemaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cinema',
      default: null,
    },
    date: {
      type: Date,
      required: [true, 'Ngày phát sinh chi phí không được để trống'],
      index: true,
      default: Date.now,
    },
    month: {
      type: Number, // 1 - 12
      index: true,
    },
    year: {
      type: Number,
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        return ret;
      },
    },
  }
);

expenseSchema.pre('save', function (next) {
  if (this.date && (!this.month || !this.year)) {
    const parts = getVietnamParts(this.date);
    if (!this.month) this.month = parts.month;
    if (!this.year) this.year = parts.year;
  }
  if (typeof next === 'function') {
    next();
  }
});

const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

export default Expense;
