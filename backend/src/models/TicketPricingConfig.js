import mongoose from 'mongoose';

const dayRatesSchema = new mongoose.Schema(
  {
    before17: { type: Number, required: true, min: 0 },
    goldenHour: { type: Number, required: true, min: 0 },
    lateNight: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const formatPricingRuleSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    roomTypeLabel: { type: String, required: true },
    vipSurcharge: { type: Number, required: true, min: 0 },
    sweetboxExtra: { type: Number, required: true, min: 0 },
    weekday: { type: dayRatesSchema, required: true },
    weekend: { type: dayRatesSchema, required: true },
  },
  { _id: false }
);

export const INITIAL_PRICING_FORMATS = {
  '2D': {
    label: '2D Dolby Atmos / Tiêu chuẩn',
    roomTypeLabel: '2D Dolby Tiêu Chuẩn',
    vipSurcharge: 20000,
    sweetboxExtra: 30000,
    weekday: {
      before17: 45000,
      goldenHour: 55000,
      lateNight: 45000,
    },
    weekend: {
      before17: 55000,
      goldenHour: 65000,
      lateNight: 55000,
    },
  },
  '3D': {
    label: 'RealD 3D High Frame Rate',
    roomTypeLabel: 'Phòng chiếu RealD 3D',
    vipSurcharge: 20000,
    sweetboxExtra: 30000,
    weekday: {
      before17: 65000,
      goldenHour: 80000,
      lateNight: 65000,
    },
    weekend: {
      before17: 80000,
      goldenHour: 95000,
      lateNight: 80000,
    },
  },
  IMAX: {
    label: 'IMAX Laser Grand Hall',
    roomTypeLabel: 'IMAX Laser Grand Hall',
    vipSurcharge: 25000,
    sweetboxExtra: 30000,
    weekday: {
      before17: 130000,
      goldenHour: 150000,
      lateNight: 130000,
    },
    weekend: {
      before17: 150000,
      goldenHour: 170000,
      lateNight: 140000,
    },
  },
  GOLD_CLASS: {
    label: 'VIP Gold Class Lounge',
    roomTypeLabel: 'VIP Gold Class Lounge',
    vipSurcharge: 30000,
    sweetboxExtra: 30000,
    weekday: {
      before17: 190000,
      goldenHour: 210000,
      lateNight: 190000,
    },
    weekend: {
      before17: 210000,
      goldenHour: 230000,
      lateNight: 210000,
    },
  },
};

const ticketPricingConfigSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      default: 'MAIN_PRICING_CONFIG',
      unique: true,
    },
    formats: {
      '2D': { type: formatPricingRuleSchema, default: () => INITIAL_PRICING_FORMATS['2D'] },
      '3D': { type: formatPricingRuleSchema, default: () => INITIAL_PRICING_FORMATS['3D'] },
      IMAX: { type: formatPricingRuleSchema, default: () => INITIAL_PRICING_FORMATS.IMAX },
      GOLD_CLASS: {
        type: formatPricingRuleSchema,
        default: () => INITIAL_PRICING_FORMATS.GOLD_CLASS,
      },
    },
    holidaySurcharge: {
      type: Number,
      default: 15000,
      min: 0,
    },
    note: {
      type: String,
      default: 'Giá vé được quản lý tập trung tại Admin và đồng bộ theo thời gian thực.',
    },
  },
  { timestamps: true }
);

const TicketPricingConfig =
  mongoose.models.TicketPricingConfig ||
  mongoose.model('TicketPricingConfig', ticketPricingConfigSchema);

export default TicketPricingConfig;
