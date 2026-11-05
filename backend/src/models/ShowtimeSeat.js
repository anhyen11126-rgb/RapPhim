import mongoose from 'mongoose';

const showtimeSeatSchema = new mongoose.Schema(
  {
    showtimeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Showtime',
      required: true,
      index: true,
    },
    seatNumber: {
      type: String,
      required: true,
    },
    row: {
      type: String,
      required: true,
    },
    col: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['STANDARD', 'VIP', 'SWEETBOX'],
      default: 'STANDARD',
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'HOLDING', 'BOOKED'],
      default: 'AVAILABLE',
      index: true,
    },
    holdExpiresAt: {
      type: Date,
      default: null,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
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

// Đảm bảo trong 1 suất chiếu, số ghế là duy nhất
showtimeSeatSchema.index({ showtimeId: 1, seatNumber: 1 }, { unique: true });

const ShowtimeSeat = mongoose.models.ShowtimeSeat || mongoose.model('ShowtimeSeat', showtimeSeatSchema);
export default ShowtimeSeat;

