import api from '../services/api';

/**
 * Giá khởi tạo đồng bộ với TicketPricingConfig ban đầu của hệ thống (chỉ dùng tạm trong lúc chờ API /api/pricing phản hồi).
 * Đảm bảo quy tắc bất biến: 2D < RealD 3D < IMAX < Gold Class, và Ghế Thường < Ghế VIP < Sweetbox.
 */
export const DEFAULT_PRICING_CONFIG = {
  formats: {
    '2D': {
      label: '2D Dolby Atmos / Tiêu chuẩn',
      roomTypeLabel: '2D Dolby Atmos',
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

export const ROOM_TYPES_ENUM = Object.freeze({
  IMAX_LASER: 'IMAX Laser',
  DOLBY_ATMOS: 'Dolby Atmos',
  GOLD_CLASS: 'Gold Class',
  REALD_3D: 'RealD 3D',
  STANDARD_2D: '2D Tiêu chuẩn',
  SOUND_4DX: '4DX Sound',
});

export const ACTIVE_CINEMA_ROOM_TYPES = Object.freeze([
  ROOM_TYPES_ENUM.IMAX_LASER,
  ROOM_TYPES_ENUM.DOLBY_ATMOS,
  ROOM_TYPES_ENUM.GOLD_CLASS,
]);

const ENUM_LOOKUP = new Map([
  ['imax laser', ROOM_TYPES_ENUM.IMAX_LASER],
  ['imax', ROOM_TYPES_ENUM.IMAX_LASER],
  ['dolby atmos', ROOM_TYPES_ENUM.DOLBY_ATMOS],
  ['atmos', ROOM_TYPES_ENUM.DOLBY_ATMOS],
  ['gold class', ROOM_TYPES_ENUM.GOLD_CLASS],
  ['gold_class', ROOM_TYPES_ENUM.GOLD_CLASS],
  ['gold', ROOM_TYPES_ENUM.GOLD_CLASS],
  ['reald 3d', ROOM_TYPES_ENUM.REALD_3D],
  ['3d', ROOM_TYPES_ENUM.REALD_3D],
  ['2d tiêu chuẩn', ROOM_TYPES_ENUM.STANDARD_2D],
  ['2d', ROOM_TYPES_ENUM.STANDARD_2D],
  ['4dx sound', ROOM_TYPES_ENUM.SOUND_4DX],
]);

/**
 * Nhận diện chuẩn enum công nghệ phòng chiếu (`room.roomType`).
 * - Ưu tiên tuyệt đối enum `room.roomType` / `roomId.roomType` / `roomType` từ MongoDB.
 * - Chỉ fallback sang tên phòng khi bản ghi cũ chưa truyền `roomType`.
 */
export const resolveCanonicalRoomType = (input) => {
  if (!input) return '';

  const rawEnum =
    typeof input === 'string'
      ? input.trim()
      : String(
          input.room?.roomType ||
            (typeof input.roomId === 'object' ? input.roomId?.roomType : '') ||
            input.roomType ||
            ''
        ).trim();

  if (rawEnum) {
    const direct = ENUM_LOOKUP.get(rawEnum.toLowerCase());
    if (direct) return direct;
  }

  const fallbackText =
    typeof input === 'string'
      ? input.toLowerCase()
      : `${input.room?.name || ''} ${typeof input.roomId === 'object' ? input.roomId?.name || '' : ''} ${input.roomName || ''} ${input.name || ''}`.toLowerCase();

  if (fallbackText.includes('imax') || /\b(phòng|phong|p)\s*0?[123]\b/i.test(fallbackText)) {
    return ROOM_TYPES_ENUM.IMAX_LASER;
  }
  if (
    fallbackText.includes('gold class') ||
    fallbackText.includes('gold_class') ||
    fallbackText.includes('gold') ||
    fallbackText.includes('lounge') ||
    /\b(phòng|phong|p)\s*0?[789]\b/i.test(fallbackText)
  ) {
    return ROOM_TYPES_ENUM.GOLD_CLASS;
  }
  if (
    fallbackText.includes('atmos') ||
    fallbackText.includes('dolby') ||
    /\b(phòng|phong|p)\s*0?[456]\b/i.test(fallbackText)
  ) {
    return ROOM_TYPES_ENUM.DOLBY_ATMOS;
  }
  if (fallbackText.includes('reald') || fallbackText.includes('3d')) return ROOM_TYPES_ENUM.REALD_3D;
  if (fallbackText.includes('4dx')) return ROOM_TYPES_ENUM.SOUND_4DX;
  if (fallbackText.trim()) return ROOM_TYPES_ENUM.STANDARD_2D;

  return '';
};

/**
 * Chuyển enum công nghệ phòng sang khóa theme UI ('IMAX' | 'ATMOS' | 'GOLD')
 */
export const resolveRoomThemeKey = (input) => {
  const canonical = resolveCanonicalRoomType(input);
  if (canonical === ROOM_TYPES_ENUM.GOLD_CLASS) return 'GOLD';
  if (canonical === ROOM_TYPES_ENUM.DOLBY_ATMOS) return 'ATMOS';
  return 'IMAX';
};

/**
 * Bảng màu nhận diện dùng chung theo từng công nghệ phòng chiếu (đồng bộ với SeatGrid & SeatSelectionPage):
 * - IMAX Laser (Phòng 01, 02, 03): Xanh cyan neon #22D3EE
 * - Dolby Atmos (Phòng 04, 05, 06): Tím holographic #C084FC
 * - Gold Class (Phòng 07, 08, 09): Vàng gold #F6CF65
 */
export const ROOM_THEME_STYLES = Object.freeze({
  IMAX: {
    key: 'IMAX',
    roomType: ROOM_TYPES_ENUM.IMAX_LASER,
    accentHex: '#22D3EE',
    roomCard:
      'bg-[#071A3E]/35 border-[#22D3EE]/35 hover:border-[#22D3EE]/60 shadow-[0_0_18px_rgba(34,211,238,0.08)] transition-colors',
    roomBadge:
      'font-bold text-[#22D3EE] bg-[#0B2545]/85 px-2 py-0.5 rounded border border-[#22D3EE]/45 shadow-[0_0_10px_rgba(34,211,238,0.18)]',
    featureText: 'text-[#67E8F9]',
    slotBtn:
      'bg-[#0B1633]/90 hover:bg-[#0E2952] border border-[#22D3EE]/35 hover:border-[#22D3EE] hover:shadow-[0_0_14px_rgba(34,211,238,0.35)]',
    priceText: 'text-[#22D3EE] group-hover:text-[#67E8F9]',
    tagIdle:
      'bg-[#0B2545]/75 text-[#22D3EE] border-[#22D3EE]/40 hover:bg-[#0E315C] hover:border-[#22D3EE] hover:shadow-[0_0_10px_rgba(34,211,238,0.25)]',
    tagActive:
      'bg-[#22D3EE]/20 text-[#67E8F9] border-[#22D3EE] shadow-[0_0_12px_rgba(34,211,238,0.35)] ring-1 ring-[#22D3EE]/50',
  },
  ATMOS: {
    key: 'ATMOS',
    roomType: ROOM_TYPES_ENUM.DOLBY_ATMOS,
    accentHex: '#C084FC',
    roomCard:
      'bg-[#1B0E3A]/35 border-[#C084FC]/35 hover:border-[#C084FC]/60 shadow-[0_0_18px_rgba(192,132,252,0.08)] transition-colors',
    roomBadge:
      'font-bold text-[#C084FC] bg-[#24124D]/85 px-2 py-0.5 rounded border border-[#C084FC]/45 shadow-[0_0_10px_rgba(192,132,252,0.18)]',
    featureText: 'text-[#D8B4FE]',
    slotBtn:
      'bg-[#160D33]/90 hover:bg-[#271556] border border-[#C084FC]/35 hover:border-[#C084FC] hover:shadow-[0_0_14px_rgba(192,132,252,0.35)]',
    priceText: 'text-[#C084FC] group-hover:text-[#E9D5FF]',
    tagIdle:
      'bg-[#24124D]/75 text-[#C084FC] border-[#C084FC]/40 hover:bg-[#311868] hover:border-[#C084FC] hover:shadow-[0_0_10px_rgba(192,132,252,0.25)]',
    tagActive:
      'bg-[#C084FC]/20 text-[#E9D5FF] border-[#C084FC] shadow-[0_0_12px_rgba(192,132,252,0.35)] ring-1 ring-[#C084FC]/50',
  },
  GOLD: {
    key: 'GOLD',
    roomType: ROOM_TYPES_ENUM.GOLD_CLASS,
    accentHex: '#F6CF65',
    roomCard:
      'bg-[#2A1E0D]/35 border-[#F6CF65]/35 hover:border-[#F6CF65]/60 shadow-[0_0_18px_rgba(246,207,101,0.08)] transition-colors',
    roomBadge:
      'font-bold text-[#F6CF65] bg-[#36260F]/85 px-2 py-0.5 rounded border border-[#F6CF65]/45 shadow-[0_0_10px_rgba(246,207,101,0.18)]',
    featureText: 'text-[#FDE68A]',
    slotBtn:
      'bg-[#1F170B]/90 hover:bg-[#352610] border border-[#F6CF65]/35 hover:border-[#F6CF65] hover:shadow-[0_0_14px_rgba(246,207,101,0.35)]',
    priceText: 'text-[#F6CF65] group-hover:text-[#FEF08A]',
    tagIdle:
      'bg-[#36260F]/75 text-[#F6CF65] border-[#F6CF65]/40 hover:bg-[#473214] hover:border-[#F6CF65] hover:shadow-[0_0_10px_rgba(246,207,101,0.25)]',
    tagActive:
      'bg-[#F6CF65]/20 text-[#FEF08A] border-[#F6CF65] shadow-[0_0_12px_rgba(246,207,101,0.35)] ring-1 ring-[#F6CF65]/50',
  },
});

export const getRoomThemeStyles = (input) => {
  const themeKey = resolveRoomThemeKey(input);
  return ROOM_THEME_STYLES[themeKey] || ROOM_THEME_STYLES.IMAX;
};

/**
 * Nhận diện chuẩn khóa bảng giá vé ('2D' | '3D' | 'IMAX' | 'GOLD_CLASS')
 * phân biệt rõ Công nghệ phòng (`room.roomType`) với Định dạng phim (`formatFeature`).
 */
export const detectFormatKey = (roomOrFormat = '') => {
  if (typeof roomOrFormat === 'string') {
    const clean = roomOrFormat.trim().toLowerCase();
    if (clean === 'imax' || clean === 'imax laser') return 'IMAX';
    if (clean === 'gold_class' || clean === 'gold class' || clean === 'gold') return 'GOLD_CLASS';
    if (clean === '3d' || clean === 'reald 3d') return '3D';
    if (clean === '2d' || clean === 'dolby atmos' || clean === '2d tiêu chuẩn') return '2D';
  }

  const canonicalRoomType = resolveCanonicalRoomType(roomOrFormat);
  const formatText =
    typeof roomOrFormat === 'string'
      ? roomOrFormat.toLowerCase()
      : `${roomOrFormat?.formatFeature || ''} ${roomOrFormat?.format || ''}`.toLowerCase();

  if (canonicalRoomType === ROOM_TYPES_ENUM.IMAX_LASER) return 'IMAX';
  if (canonicalRoomType === ROOM_TYPES_ENUM.GOLD_CLASS) return 'GOLD_CLASS';
  if (canonicalRoomType === ROOM_TYPES_ENUM.REALD_3D) return '3D';

  if (
    canonicalRoomType === ROOM_TYPES_ENUM.DOLBY_ATMOS ||
    canonicalRoomType === ROOM_TYPES_ENUM.STANDARD_2D ||
    canonicalRoomType === ROOM_TYPES_ENUM.SOUND_4DX
  ) {
    if (/\b3d\b/i.test(formatText) || formatText.includes('reald')) return '3D';
    return '2D';
  }

  if (formatText.includes('imax')) return 'IMAX';
  if (formatText.includes('gold class') || formatText.includes('gold_class') || formatText.includes('lounge')) {
    return 'GOLD_CLASS';
  }
  if (/\b3d\b/i.test(formatText) || formatText.includes('reald')) return '3D';
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
