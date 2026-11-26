import mongoose from 'mongoose';

const showtimeSchema = new mongoose.Schema(
  {
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
      required: true,
      index: true,
    },
    cinemaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cinema',
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      index: true,
    },
    roomName: {
      type: String,
      required: true,
      default: 'Phòng 01 - 2D',
    },
    formatFeature: {
      type: String,
      default: '', // Ví dụ: "Màn hình cong 1.43:1", "64 kênh âm thanh vòm"
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: Date,
    cancelledAt: Date,
    cancelReason: { type: String, default: '' },
    batchId: { type: String, default: null, index: true },
    requestId: { type: String, default: null, index: true },
    requestFingerprint: { type: String, default: null },
    creationSource: { type: String, enum: ['MANUAL', 'RECURRING', 'BULK'], default: 'MANUAL' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bookingRevision: { type: Number, default: 0, select: false },
    cleaningMinutes: { type: Number, min: 0, max: 60, default: 20 },
    cleaningEndTime: { type: Date, default: null, index: true },
    lifecycleStatus: {
      type: String,
      enum: ['UPCOMING', 'NOW_SHOWING', 'CLEANING', 'COMPLETED', 'CANCELLED'],
      default: 'UPCOMING',
      index: true,
    },
    price: {
      type: Number,
      required: true,
      default: 95000,
    },
    isLocked: {
      type: Boolean,
      default: false,
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

showtimeSchema.index({ movieId: 1, startTime: 1 });
showtimeSchema.index({ roomId: 1, startTime: 1, cancelledAt: 1 });
showtimeSchema.index({ roomId: 1, lifecycleStatus: 1, startTime: 1, endTime: 1 });

// Virtual relationship tới Movie
showtimeSchema.virtual('movie', {
  ref: 'Movie',
  localField: 'movieId',
  foreignField: '_id',
  justOne: true,
});

// Virtual relationship tới Cinema
showtimeSchema.virtual('cinema', {
  ref: 'Cinema',
  localField: 'cinemaId',
  foreignField: '_id',
  justOne: true,
});

const Showtime = mongoose.models.Showtime || mongoose.model('Showtime', showtimeSchema);
export default Showtime;
