import mongoose from 'mongoose';

const movieMongoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tên phim không được để trống'],
      trim: true,
    },
    poster: {
      type: String,
      required: [true, 'Link ảnh poster không được để trống'],
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
    description: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      default: 95000,
    },
    status: {
      type: String,
      enum: ['NOW_SHOWING', 'COMING_SOON', 'ENDED'],
      default: 'NOW_SHOWING',
    },
  },
  {
    timestamps: true, // Tự động quản lý createdAt và updatedAt
  }
);

const MovieMongo = mongoose.model('MovieMongo', movieMongoSchema);
export default MovieMongo;

