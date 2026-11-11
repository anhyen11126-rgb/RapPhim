import mongoose from 'mongoose';
import TicketPricingConfig, { INITIAL_PRICING_FORMATS } from '../models/TicketPricingConfig.js';
import Showtime from '../models/Showtime.js';
import Room from '../models/Room.js';
import { getVNDateParts } from './ai/timezoneUtils.js';

/**
 * Xác định chuẩn định dạng phòng ('2D' | '3D' | 'IMAX' | 'GOLD_CLASS')
 */
export const detectFormatKey = (roomOrFormat = {}) => {
  const str =
    typeof roomOrFormat === 'string'
      ? roomOrFormat.toLowerCase()
      : `${roomOrFormat.roomName || ''} ${roomOrFormat.roomType || ''} ${roomOrFormat.formatFeature || ''} ${roomOrFormat.format || ''}`.toLowerCase();

  if (str.includes('imax')) return 'IMAX';
  if (str.includes('gold class') || str.includes('gold_class') || str.includes('lounge')) {
    return 'GOLD_CLASS';
  }
  if (str.includes('3d')) return '3D';
  return '2D';
};

/**
 * Đảm bảo luôn có cấu hình giá vé trong MongoDB và sửa tự động nếu cấu hình cũ bị nghịch lý (2D >= 3D)
 */
export const ensurePricingConfig = async () => {
  const defaultObj = {
    configKey: 'MAIN_PRICING_CONFIG',
    formats: INITIAL_PRICING_FORMATS,
    holidaySurcharge: 15000,
    note: 'Giá vé được quản lý tập trung tại Admin và đồng bộ theo thời gian thực.',
  };

  if (mongoose.connection.readyState !== 1) {
    return defaultObj;
  }

  try {
    let config = await TicketPricingConfig.findOne({ configKey: 'MAIN_PRICING_CONFIG' }).lean();
    if (!config) {
      const created = await TicketPricingConfig.create(defaultObj);
      config = created.toObject();
    }
    return config;
  } catch (err) {
    console.warn('[PricingConfigService] Lỗi đọc TicketPricingConfig từ DB:', err.message);
    return defaultObj;
  }
};

/**
 * Xác định thứ cuối tuần (Thứ 6, Thứ 7, Chủ Nhật) & khung giờ theo giờ Việt Nam
 */
export const extractTimeSlotMeta = (startTime, explicitTimeStr = '') => {
  const vn = startTime ? getVNDateParts(startTime) : getVNDateParts(new Date());
  let hour = vn ? vn.hour : 19;
  const dayOfWeek = vn ? vn.dayOfWeek : 3;

  if (explicitTimeStr && typeof explicitTimeStr === 'string' && explicitTimeStr.includes(':')) {
    const [h] = explicitTimeStr.split(':').map(Number);
    if (Number.isFinite(h)) hour = h;
  }

  // Cuối tuần: Thứ 6 (5), Thứ 7 (6), Chủ Nhật (0)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  const isLateNight = hour >= 22 || hour < 6;
  const isBefore17 = hour >= 6 && hour < 17;

  const slotKey = isLateNight ? 'lateNight' : isBefore17 ? 'before17' : 'goldenHour';
  const dayKey = isWeekend ? 'weekend' : 'weekday';

  return {
    hour,
    dayOfWeek,
    isWeekend,
    isLateNight,
    isBefore17,
    slotKey,
    dayKey,
  };
};

/**
 * Tính giá vé tiêu chuẩn, VIP, Sweetbox từ cấu hình MongoDB (`TicketPricingConfig`)
 * Nếu `showtime.price` có giá trị riêng trong DB và không yêu cầu tính lại theo ma trận (`preferRuleMatrix`),
 * giữ đúng giá gốc của suất chiếu đó và cộng phụ thu ghế từ config DB.
 */
export const calculatePricesFromConfig = (showtime = {}, config = null, options = {}) => {
  const activeConfig = config?.formats ? config : { formats: INITIAL_PRICING_FORMATS, holidaySurcharge: 15000 };
  const formatKey = detectFormatKey(showtime);
  const formatRule = activeConfig.formats?.[formatKey] || INITIAL_PRICING_FORMATS[formatKey];

  const meta = extractTimeSlotMeta(showtime.startTime || showtime.fullDate || showtime.date, showtime.time);
  const ruleBasePrice = Number(formatRule?.[meta.dayKey]?.[meta.slotKey]) || 55000;

  const explicitDbPrice = Number(showtime.price);
  const useExplicitPrice =
    !options.preferRuleMatrix && Number.isFinite(explicitDbPrice) && explicitDbPrice > 0;

  let priceStandard = useExplicitPrice ? Math.round(explicitDbPrice) : Math.round(ruleBasePrice);
  if (showtime.isHoliday && !useExplicitPrice) {
    priceStandard += Number(activeConfig.holidaySurcharge) || 0;
  }

  const vipSurcharge = Number(formatRule?.vipSurcharge ?? 20000);
  const sweetboxExtra = Number(formatRule?.sweetboxExtra ?? 30000);

  const priceVip = priceStandard + vipSurcharge;
  const priceSweetbox = priceStandard * 2 + sweetboxExtra;

  return {
    format: formatKey,
    roomTypeLabel: formatRule?.roomTypeLabel || formatRule?.label || formatKey,
    priceStandard,
    priceVip,
    priceSweetbox,
    vipSurcharge,
    sweetboxExtra,
    isWeekend: meta.isWeekend,
    slotKey: meta.slotKey,
    dayKey: meta.dayKey,
  };
};

/**
 * Tạo chuỗi khoảng giá vé theo ngày thường / cuối tuần cho phòng chiếu từ cấu hình DB
 */
export const formatRoomPriceRangeFromConfig = (roomTypeOrName, config = null) => {
  const activeConfig = config?.formats ? config : { formats: INITIAL_PRICING_FORMATS };
  const formatKey = detectFormatKey(roomTypeOrName);
  const rule = activeConfig.formats?.[formatKey] || INITIAL_PRICING_FORMATS[formatKey];

  const allValues = [
    rule.weekday.before17,
    rule.weekday.goldenHour,
    rule.weekday.lateNight,
    rule.weekend.before17,
    rule.weekend.goldenHour,
    rule.weekend.lateNight,
  ].filter((v) => Number.isFinite(Number(v)) && Number(v) > 0);

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  return `${minVal.toLocaleString('vi-VN')}đ - ${maxVal.toLocaleString('vi-VN')}đ`;
};

/**
 * Đồng bộ bảng giá mới từ Admin vào các Phòng chiếu (priceRange) & Suất chiếu sắp tới (price)
 */
export const syncDatabaseWithPricingConfig = async (config, options = {}) => {
  const { updateFutureShowtimes = true, nowDate = new Date() } = options;
  if (mongoose.connection.readyState !== 1) return { updatedRooms: 0, updatedShowtimes: 0 };

  let updatedRooms = 0;
  let updatedShowtimes = 0;

  // 1. Cập nhật priceRange cho tất cả phòng chiếu theo cấu hình mới
  const rooms = await Room.find({});
  for (const r of rooms) {
    const expectedRange = formatRoomPriceRangeFromConfig(r.roomType || r.name, config);
    if (r.priceRange !== expectedRange) {
      r.priceRange = expectedRange;
      await r.save();
      updatedRooms += 1;
    }
  }

  // 2. Cập nhật giá các suất chiếu trong tương lai theo cấu hình động mới
  if (updateFutureShowtimes) {
    const futureShowtimes = await Showtime.find({ startTime: { $gte: nowDate } });
    for (const st of futureShowtimes) {
      const calc = calculatePricesFromConfig(
        {
          roomName: st.roomName,
          formatFeature: st.formatFeature,
          startTime: st.startTime,
        },
        config,
        { preferRuleMatrix: true }
      );
      if (st.price !== calc.priceStandard) {
        st.price = calc.priceStandard;
        await st.save();
        updatedShowtimes += 1;
      }
    }
  }

  return { updatedRooms, updatedShowtimes };
};
