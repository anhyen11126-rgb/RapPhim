import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['HERO_DEAL', 'VOUCHER', 'PROGRAM'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    subtitle: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      enum: ['ALL', 'TICKET', 'CONCESSION', 'STUDENT', 'PAYMENT', 'VIP', 'EXPERIENCE'],
      default: 'TICKET',
      index: true,
    },
    code: {
      type: String,
      trim: true,
      default: '',
    },
    discountValue: {
      type: String,
      default: '', // e.g. "GIẢM 20K", "45.000đ", "-50%", "TẶNG NƯỚC"
    },
    conditions: {
      type: String,
      default: '',
    },
    expiryDate: {
      type: String,
      default: '31/12/2026',
    },
    badgeTop: {
      type: String,
      default: '',
    },
    badgeSpecial: {
      type: String,
      default: '',
    },
    badgeColor: {
      type: String,
      default: 'amber', // amber, emerald, blue, red
    },
    image: {
      type: String,
      default: '',
    },
    metadataLeft: {
      type: String,
      default: '',
    },
    metadataRight: {
      type: String,
      default: '',
    },
    buttonText: {
      type: String,
      default: 'Đặt vé ngay',
    },
    buttonAction: {
      type: String,
      default: '/theaters',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
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

const Promotion = mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema);
export default Promotion;
