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

export default mongoose.model('OtpVerification', otpVerificationSchema);

