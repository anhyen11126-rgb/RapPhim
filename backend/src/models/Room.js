import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    cinemaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cinema',
      required: true,
      index: true,
    },
    roomNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    name: {
      type: String,
      required: [true, 'Tên phòng chiếu không được để trống'],
      trim: true,
    },
    shortName: {
      type: String,
      trim: true,
      default: 'Phòng 1',
    },
    roomType: {
      type: String,
      enum: ['IMAX Laser', 'Dolby Atmos', 'RealD 3D', '2D Tiêu chuẩn', '4DX Sound'],
      default: 'IMAX Laser',
    },
    formatFeature: {
      type: String,
      default: 'Màn hình chuẩn điện ảnh • Âm thanh vòm đa chiều',
    },
    priceRange: {
      type: String,
      default: '45.000đ - 65.000đ',
    },
    defaultSlots: {
      type: String,
      default: '18:00 • 19:45 • 21:15 • 22:30',
    },
    totalSeats: {
      type: Number,
      default: 88,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'MAINTENANCE'],
      default: 'ACTIVE',
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

const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);
export default Room;

