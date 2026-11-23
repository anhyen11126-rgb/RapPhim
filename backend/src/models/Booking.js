import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    showtimeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Showtime',
      required: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      default: '',
      trim: true,
    },
    seats: {
      type: String, // Chuỗi lưu tên ghế "A1, A2"
      required: true,
    },
    concessions: {
      type: String,
      default: '',
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'CANCELLED', 'EXCHANGED'],
      default: 'PAID',
    },
    paymentMethod: {
      type: String,
      enum: ['MOMO', 'VNPAY', 'CASH'],
      default: 'MOMO',
    },
    qrToken: {
      type: String,
      default: null,
      index: true,
    },
    isCheckedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    exchangeHistory: {
      type: Array,
      default: [],
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
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        return ret;
      },
    },
  }
);

// Virtual relationship tới Showtime
bookingSchema.virtual('showtime', {
  ref: 'Showtime',
  localField: 'showtimeId',
  foreignField: '_id',
  justOne: true,
});

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
export default Booking;

