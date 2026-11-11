import api from '../services/api';

/**
 * Giá khởi tạo đồng bộ với TicketPricingConfig ban đầu của hệ thống (chỉ dùng tạm trong lúc chờ API /api/pricing phản hồi).
 * Đảm bảo quy tắc bất biến: 2D < RealD 3D < IMAX < Gold Class, và Ghế Thường < Ghế VIP < Sweetbox.
 */
export const DEFAULT_PRICING_CONFIG = {
  formats: {
    '2D': {
      label: '2D Dolby Atmos / Tiêu chuẩn',
      roomTypeLabel: '2D Dolby Tiêu Chuẩn',
      vipSurcharge: 20000,
      sweetboxExtra: 30000,
      weekday: { before17: 45000, goldenHour: 55000, lateNight: 45000 },
      weekend: { before17: 55000, goldenHour: 65000, lateNight: 55000 },
    },
    '3D': {
      label: 'RealD 3D High Frame Rate',
      roomTypeLabel: 'Phòng chiếu RealD 3D',
      vipSurcharge: 20000,
      sweetboxExtra: 30000,
      weekday: { before17: 65000, goldenHour: 80000, lateNight: 65000 },
      weekend: { before17: 80000, goldenHour: 95000, lateNight: 80000 },
    },
    IMAX: {
      label: 'IMAX Laser Grand Hall',
      roomTypeLabel: 'IMAX Laser Grand Hall',
      vipSurcharge: 25000,
      sweetboxExtra: 30000,
      weekday: { before17: 130000, goldenHour: 150000, lateNight: 130000 },
      weekend: { before17: 150000, goldenHour: 170000, lateNight: 140000 },
    },
    GOLD_CLASS: {
      label: 'VIP Gold Class Lounge',
      roomTypeLabel: 'VIP Gold Class Lounge',
      vipSurcharge: 30000,
      sweetboxExtra: 30000,
      weekday: { before17: 190000, goldenHour: 210000, lateNight: 190000 },
      weekend: { before17: 210000, goldenHour: 230000, lateNight: 210000 },
    },
  },
  holidaySurcharge: 15000,
};

let cachedPricingConfig = null;
let inflightPromise = null;

export const getActivePricingConfig = () => cachedPricingConfig || DEFAULT_PRICING_CONFIG;

export const setCachedPricingConfig = (config) => {
  if (config && config.formats) {
    cachedPricingConfig = config;
  }
  return getActivePricingConfig();
};

/**
 * Tải cấu hình bảng giá vé trực tiếp từ MongoDB (/api/pricing)
 */
export const loadPricingConfig = async (force = false) => {
  if (!force && cachedPricingConfig) {
    return cachedPricingConfig;
  }
  if (!force && inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = api
    .get('/pricing')
    .then((res) => {
      if (res.data?.config?.formats) {
        cachedPricingConfig = res.data.config;
      }
      return getActivePricingConfig();
    })
    .catch(() => getActivePricingConfig())
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
};

/**
 * Nhận diện chuẩn khóa định dạng phòng ('2D' | '3D' | 'IMAX' | 'GOLD_CLASS')
 */
export const detectFormatKey = (roomOrFormat = '') => {
  const combined =
    typeof roomOrFormat === 'string'
      ? roomOrFormat.toLowerCase()
      : `${roomOrFormat?.roomName || ''} ${roomOrFormat?.roomType || ''} ${roomOrFormat?.format || ''} ${roomOrFormat?.formatFeature || ''}`.toLowerCase();

  if (combined.includes('imax')) return 'IMAX';
  if (combined.includes('gold class') || combined.includes('gold_class') || combined.includes('lounge')) {
    return 'GOLD_CLASS';
  }
  if (combined.includes('3d')) return '3D';
  return '2D';
};

/**
 * Tính khoảng giá vé dao động động hoàn toàn từ cấu hình MongoDB
 */
export const getRoomPriceRange = (format, isWeekend, customConfig = null) => {
  const activeConfig = customConfig?.formats ? customConfig : getActivePricingConfig();
  const formatKey = detectFormatKey(format);
  const rule = activeConfig.formats?.[formatKey] || DEFAULT_PRICING_CONFIG.formats[formatKey];
  const dayRates = isWeekend ? rule.weekend : rule.weekday;

  const baseVals = [dayRates.before17, dayRates.goldenHour, dayRates.lateNight].filter(
    (v) => Number.isFinite(Number(v)) && Number(v) > 0
  );
  const minVal = baseVals.length > 0 ? Math.min(...baseVals) : 45000;
  const maxBase = baseVals.length > 0 ? Math.max(...baseVals) : 65000;
  const maxSweetbox = maxBase * 2 + Number(rule.sweetboxExtra ?? 30000);

  return {
    min: minVal,
    max: maxSweetbox,
    maxStandard: maxBase,
    label: `${minVal.toLocaleString('vi-VN')}đ ~ ${maxSweetbox.toLocaleString('vi-VN')}đ`,
    standardRangeLabel: `${minVal.toLocaleString('vi-VN')}đ - ${maxBase.toLocaleString('vi-VN')}đ`,
  };
};

/**
 * Tính giá vé động theo cấu hình Admin trong MongoDB + giá gốc suất chiếu nếu có:
 * 1. Phân loại phòng chiếu (`2D`, `3D`, `IMAX`, `GOLD_CLASS`)
 * 2. Ngày trong tuần (Thứ 2–Thứ 5 vs Thứ 6–Chủ Nhật)
 * 3. Khung giờ chiếu (`before17` < 17:00, `goldenHour` 17:00–21:59, `lateNight` >= 22:00)
 * 4. Hạng ghế (`Standard`, `VIP`, `Sweetbox`)
 */
export const calculateDynamicPrices = (showtime, customConfig = null) => {
  const activeConfig = customConfig?.formats ? customConfig : getActivePricingConfig();

  let dateObj = null;
  if (showtime?.startTime) {
    dateObj = new Date(showtime.startTime);
  } else if (showtime?.fullDate) {
    dateObj = new Date(showtime.fullDate);
  } else if (showtime?.date) {
    dateObj = new Date(showtime.date);
  }
  if (!dateObj || Number.isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }

  let hour = dateObj.getHours();
  if (showtime?.time && typeof showtime.time === 'string' && showtime.time.includes(':')) {
    const [h] = showtime.time.split(':').map(Number);
    if (Number.isFinite(h)) hour = h;
  }

  const dayOfWeek = dateObj.getDay(); // 0: CN, 5: T6, 6: T7
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  const isLateNight = hour >= 22 || hour < 6;
  const isBefore17 = hour >= 6 && hour < 17;

  const formatKey = detectFormatKey(showtime);
  const rule = activeConfig.formats?.[formatKey] || DEFAULT_PRICING_CONFIG.formats[formatKey];

  const dayKey = isWeekend ? 'weekend' : 'weekday';
  const slotKey = isLateNight ? 'lateNight' : isBefore17 ? 'before17' : 'goldenHour';

  let ruleBasePrice = Number(rule?.[dayKey]?.[slotKey]) || 55000;
  if (showtime?.isHoliday) {
    ruleBasePrice += Number(activeConfig.holidaySurcharge ?? 15000);
  }

  // Nếu suất chiếu từ DB có gắn giá riêng (và không yêu cầu xem ma trận chuẩn) thì ưu tiên dùng giá thực tế của suất đó
  const explicitDbPrice = Number(showtime?.price);
  const useExplicitPrice =
    !showtime?.useConfigMatrix && Number.isFinite(explicitDbPrice) && explicitDbPrice > 0;

  const priceStandard = useExplicitPrice ? Math.round(explicitDbPrice) : Math.round(ruleBasePrice);
  const vipSurcharge = Number(rule?.vipSurcharge ?? (formatKey === 'IMAX' ? 25000 : 20000));
  const sweetboxExtra = Number(rule?.sweetboxExtra ?? 30000);

  const priceVip = priceStandard + vipSurcharge;
  const priceSweetbox = priceStandard * 2 + sweetboxExtra;

  const timeSlotLabel = showtime?.isHoliday
    ? 'Ngày Lễ / Tết'
    : isLateNight
      ? 'Suất khuya (từ 22:00)'
      : isBefore17
        ? isWeekend
          ? 'Trước 17:00 (Cuối tuần)'
          : 'Trước 17:00 (Ngày thường)'
        : isWeekend
          ? 'Giờ vàng (Cuối tuần)'
          : 'Giờ vàng (Ngày thường)';

  return {
    formatKey,
    priceStandard,
    priceVip,
    priceSweetbox,
    roomTypeLabel: rule?.roomTypeLabel || rule?.label || formatKey,
    timeSlotLabel,
    dayLabel: isWeekend ? 'Thứ 6 - Chủ Nhật' : 'Thứ 2 - Thứ 5',
  };
};
