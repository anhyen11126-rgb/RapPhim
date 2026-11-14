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
    bannerUrl: {
      type: String, // Ảnh ngang chất lượng cao dùng cho Hero Banner
      default: '',
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
    director: {
      type: String,
      default: '',
    },
    subTitle: {
      type: String,
      default: '',
    },
    cast: [
      {
        name: { type: String, default: '' },
        role: { type: String, default: '' },
        avatar: { type: String, default: '' },
      },
    ],
    highlights: [
      {
        icon: { type: String, default: '✨' },
        title: { type: String, default: '' },
        desc: { type: String, default: '' },
      },
    ],
    rating: {
      type: Number,
      default: 4.6,
    },
    ratingCount: {
      type: String,
      default: '120 lượt đánh giá',
    },
    stats: {
      revenue: { type: Number, default: 125000000 },
      ticketsSold: { type: Number, default: 850 },
      seatsBooked: { type: Number, default: 850 },
      seatsAvailable: { type: Number, default: 150 },
    },
    ratingBreakdown: {
      fiveStar: { type: Number, default: 90 },
      fourStar: { type: Number, default: 20 },
      threeStar: { type: Number, default: 7 },
      twoStar: { type: Number, default: 2 },
      oneStar: { type: Number, default: 1 },
    },
    reviews: [
      {
        userName: { type: String, default: '' },
        rating: { type: Number, default: 5 },
        comment: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    rottenTomatoes: {
      type: String,
      default: '94%',
    },
    rottenTomatoesLabel: {
      type: String,
      default: 'Chứng nhận cà chua tươi (Certified Fresh)',
    },
    contentAdvisory: {
      type: String,
      default: 'Khuyên xem: Cảnh hành động mãn nhãn',
    },
    language: {
      type: String,
      default: 'Tiếng Anh - Phụ đề tiếng Việt chuẩn',
    },
    audioTech: {
      type: String,
      default: 'Âm thanh 8 kênh & Dolby Atmos 64',
    },
    trailerTagline: {
      type: String,
      default: 'Khám phá trọn vẹn Trailer chính thức sắc nét',
    },
    trailerDuration: {
      type: String,
      default: 'Thời lượng: 2 phút 45 giây • Độc quyền video chất lượng cao tại MovieTix',
    },
    trailerQualityBadge: {
      type: String,
      default: 'OFFICIAL IMAX LASER TRAILER • 4K UHD • Dolby Atmos',
    },
    techFormat: {
      type: String,
      default: 'IMAX',
    },
    formats: {
      type: [String],
      default: ['2D', '3D', 'IMAX'],
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
movieSchema.pre('save', function () {
  if (this.posterUrl && !this.poster) {
    this.poster = this.posterUrl;
  } else if (this.poster && !this.posterUrl) {
    this.posterUrl = this.poster;
  }
});

const Movie = mongoose.models.Movie || mongoose.model('Movie', movieSchema);
export default Movie;

