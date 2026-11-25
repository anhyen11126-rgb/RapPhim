import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    requestSignature: { type: String, select: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    showtimeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Showtime',
      required: true,
      index: true,
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
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SIMULATED', 'VERIFIED', 'FAILED', 'LEGACY_UNVERIFIED'],
      default: 'LEGACY_UNVERIFIED',
    },
    priceSnapshot: {
      tickets: [{ _id: false, seatNumber: String, price: Number }],
      combos: [{ _id: false, concessionId: mongoose.Schema.Types.ObjectId, name: String, flavor: String, quantity: Number, price: Number }],
      voucherCode: String,
      discount: Number,
    },
    paymentMethod: {
      type: String,
      enum: ['MOMO', 'VNPAY', 'CASH', 'ATM', 'VISA'],
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
    refundStatus: {
      type: String,
      enum: ['NONE', 'SIMULATED', 'PENDING', 'REFUNDED', 'FAILED'],
      default: 'NONE',
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

bookingSchema.index({ showtimeId: 1, status: 1, paymentStatus: 1, createdAt: -1 });
bookingSchema.index({ status: 1, paymentStatus: 1, createdAt: -1 });
bookingSchema.index({ userId: 1, createdAt: -1 });

// Virtual relationship tới Showtime
bookingSchema.virtual('showtime', {
  ref: 'Showtime',
  localField: 'showtimeId',
  foreignField: '_id',
  justOne: true,
});

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
export default Booking;

