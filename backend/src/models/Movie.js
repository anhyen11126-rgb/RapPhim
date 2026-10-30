import mongoose from 'mongoose';

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tên phim không được để trống'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
    },
    posterUrl: {
      type: String,
      required: [true, 'Link poster không được để trống'],
    },
    poster: {
      type: String, // Hỗ trợ tương thích ngược cho cả poster và posterUrl
    },
    trailerUrl: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    genre: {
      type: String,
      required: [true, 'Thể loại phim không được để trống'],
    },
    duration: {
      type: Number,
      required: [true, 'Thời lượng phim không được để trống'],
    },
    ageRating: {
      type: String,
      enum: ['P', 'T11', 'T13', 'T16', 'T18'],
      default: 'P',
    },
    releaseDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['NOW_SHOWING', 'COMING_SOON', 'ENDED'],
      default: 'NOW_SHOWING',
    },
    price: {
      type: Number,
      default: 95000,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        if (!ret.poster) ret.poster = ret.posterUrl;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        if (!ret.poster) ret.poster = ret.posterUrl;
        return ret;
      },
    },
  }
);

// Tự động gán poster = posterUrl trước khi lưu nếu chưa có
movieSchema.pre('save', function (next) {
  if (this.posterUrl && !this.poster) {
    this.poster = this.posterUrl;
  } else if (this.poster && !this.posterUrl) {
    this.posterUrl = this.poster;
  }
  next();
});

const Movie = mongoose.models.Movie || mongoose.model('Movie', movieSchema);
export default Movie;
