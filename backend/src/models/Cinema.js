import mongoose from 'mongoose';

const cinemaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên cụm rạp không được để trống'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      unique: true,
    },
    city: {
      type: String,
      required: [true, 'Tỉnh / Thành phố không được để trống'],
      default: 'TP. Hồ Chí Minh',
      index: true,
    },
    district: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    address: {
      type: String,
      required: [true, 'Địa chỉ rạp không được để trống'],
    },
    distance: {
      type: String,
      default: '1.5 km',
    },
    isFlagship: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: 4.9,
    },
    reviewsCount: {
      type: Number,
      default: 1500,
    },
    tags: {
      type: [String],
      default: ['Dolby Atmos'],
    },
    specialBadge: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      required: true,
      default: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
    },
    openingHours: {
      type: String,
      default: '08:00 - 02:00 sáng',
    },
    hotline: {
      type: String,
      default: '1900 8899',
    },
    parking: {
      type: String,
      default: 'Hầm giữ xe 24/7 (Miễn phí 3h xem phim)',
    },
    roomCount: {
      type: Number,
      default: 7,
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

const Cinema = mongoose.models.Cinema || mongoose.model('Cinema', cinemaSchema);
export default Cinema;

