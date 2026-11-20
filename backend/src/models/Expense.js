import mongoose from 'mongoose';

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
      enum: [
        'DIRECT_MOVIE',       // Chi phí trực tiếp phim (Bản quyền, chia sẻ doanh thu nhà phát hành)
        'MARKETING',          // Chi phí quảng bá, marketing & truyền thông
        'OPERATIONAL_CINEMA', // Vận hành, bảo trì máy chiếu & âm thanh rạp
        'STAFF',              // Lương & phụ cấp nhân sự rạp
        'UTILITY',            // Điện, nước, internet & tiện ích
        'OTHER',              // Chi phí hành chính & khác
      ],
      default: 'OPERATIONAL_CINEMA',
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

// Tự động gán month và year theo ngày phát sinh trước khi lưu
expenseSchema.pre('save', function (next) {
  if (this.date) {
    const d = new Date(this.date);
    this.month = d.getMonth() + 1;
    this.year = d.getFullYear();
  }
  if (typeof next === 'function') {
    next();
  }
});

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
