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
    price: {
      type: Number,
      required: true,
      default: 95000,
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
