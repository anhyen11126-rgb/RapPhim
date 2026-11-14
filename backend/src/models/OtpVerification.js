import mongoose from 'mongoose';

const otpVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['register', 'reset_password'],
      default: 'register',
    },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'EXPIRED'],
      default: 'PENDING',
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    senderEmail: {
      type: String,
      default: 'rapphim265@gmail.com',
    },
    errorMessage: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// TTL Index: Tự động xóa vĩnh viễn các bản ghi OTP hết hạn khỏi MongoDB Atlas để cơ sở dữ liệu luôn nhẹ
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpVerification', otpVerificationSchema);

