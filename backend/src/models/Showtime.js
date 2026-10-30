import mongoose from 'mongoose';

const showtimeSchema = new mongoose.Schema(
  {
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
      required: true,
    },
    roomName: {
      type: String,
      required: true,
      default: 'Phòng 01 - 2D',
    },
    startTime: {
      type: Date,
      required: true,
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

// Virtual relationship tới Movie nếu cần
showtimeSchema.virtual('movie', {
  ref: 'Movie',
  localField: 'movieId',
  foreignField: '_id',
  justOne: true,
});

const Showtime = mongoose.models.Showtime || mongoose.model('Showtime', showtimeSchema);
export default Showtime;
