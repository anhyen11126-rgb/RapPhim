import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Họ và tên không được để trống'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email không được để trống'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Số điện thoại không được để trống'],
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Mật khẩu không được để trống'],
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'VIP', 'ADMIN'],
      default: 'CUSTOMER',
    },
    tier: {
      type: String,
      enum: ['STANDARD', 'GOLD_TIER', 'DIAMOND'],
      default: 'GOLD_TIER',
    },
    points: {
      type: Number,
      default: 100, // Tặng 100 điểm khởi tạo khi đăng ký mới
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.password;
        return ret;
      },
    },
  }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;

