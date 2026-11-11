import { getVNDateParts } from './timezoneUtils.js';

/**
 * Định dạng số tiền sang chuỗi VNĐ chuẩn (VD: 95000 -> "95.000đ")
 */
export const formatVND = (amount) => {
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return '0đ';
  return `${Math.round(num).toLocaleString('vi-VN')}đ`;
};

/**
 * Xác định định dạng phòng chiếu chuẩn từ roomName, roomType và formatFeature thực tế trong DB
 */
export const detectShowtimeFormat = (showtime = {}) => {
  const roomName = String(showtime.roomName || showtime.room?.name || '').toLowerCase();
  const roomType = String(showtime.roomType || showtime.room?.type || '').toLowerCase();
  const formatFeature = String(showtime.formatFeature || showtime.format || '').toLowerCase();
  const combined = `${roomName} ${roomType} ${formatFeature}`;

  if (combined.includes('imax')) return 'IMAX';
  if (combined.includes('gold class') || combined.includes('gold_class')) return 'GOLD_CLASS';
  if (combined.includes('3d')) return '3D';
  return '2D';
};

/**
 * Nhãn hiển thị định dạng phòng chiếu
 */
export const getFormatDisplayLabel = (format = '2D') => {
  switch (format) {
    case 'IMAX':
      return 'IMAX Laser 3D';
    case 'GOLD_CLASS':
      return 'Gold Class Luxury';
    case '3D':
      return 'RealD 3D';
    default:
      return '2D Standard';
  }
};

/**
 * Tính giá vé chính xác từ dữ liệu Showtime trong Database.
 * - Tuyệt đối KHÔNG ghi đè bằng 45.000đ / 50.000đ giả.
 * - Tuyệt đối KHÔNG tự áp dụng ưu đãi HSSV hoặc suất khuya.
 * - Sử dụng đúng giá gốc `showtime.price` trong MongoDB và tính phụ thu hạng ghế (Standard / VIP / Sweetbox)
 *   thống nhất với quy tắc hạng ghế của hệ thống đặt vé.
 */
export const calculateShowtimePrices = (showtime = {}, pricingConfig = null) => {
  const format = detectShowtimeFormat(showtime);
  const rawDbPrice = Number(showtime.price);
  const configRule = pricingConfig?.formats?.[format];

  // Giá cơ sở theo loại phòng (ưu tiên lấy từ TicketPricingConfig nếu có)
  const defaultRoomBasePrices = {
    IMAX: configRule?.weekday?.goldenHour || 150000,
    GOLD_CLASS: configRule?.weekday?.goldenHour || 210000,
    '3D': configRule?.weekday?.goldenHour || 80000,
    '2D': configRule?.weekday?.goldenHour || 55000,
  };

  const priceStandard =
    Number.isFinite(rawDbPrice) && rawDbPrice > 0
      ? Math.round(rawDbPrice)
      : defaultRoomBasePrices[format] || 55000;

  // Phụ thu hạng ghế đồng bộ với TicketPricingConfig trong MongoDB
  const vipSurcharge =
    Number.isFinite(Number(configRule?.vipSurcharge))
      ? Number(configRule.vipSurcharge)
      : format === 'IMAX'
        ? 25000
        : format === 'GOLD_CLASS'
          ? 30000
          : 20000;

  const sweetboxExtra =
    Number.isFinite(Number(configRule?.sweetboxExtra))
      ? Number(configRule.sweetboxExtra)
      : 30000;

  const priceVip = priceStandard + vipSurcharge;
  const priceSweetbox = priceStandard * 2 + sweetboxExtra;

  const vnParts = showtime.startTime ? getVNDateParts(showtime.startTime) : null;

  return {
    format,
    roomTypeLabel: configRule?.roomTypeLabel || getFormatDisplayLabel(format),
    priceStandard,
    priceVip,
    priceSweetbox,
    isWeekend: Boolean(vnParts?.isWeekend),
  };
};

/**
 * Hàm tương thích ngược `resolveDisplayPrice` trả về giá vé tiêu chuẩn thực tế của suất chiếu
 */
export const resolveDisplayPrice = (showtimeOrRoomName = {}, startTime = null, rawPrice = null) => {
  if (typeof showtimeOrRoomName === 'object' && showtimeOrRoomName !== null) {
    return calculateShowtimePrices(showtimeOrRoomName).priceStandard;
  }
  return calculateShowtimePrices({
    roomName: showtimeOrRoomName,
    startTime,
    price: rawPrice,
  }).priceStandard;
};

/**
 * Tính tổng tiền cho số lượng vé theo hạng ghế yêu cầu
 */
export const calculateTicketQuote = (showtime, quantity = 1, seatType = 'STANDARD') => {
  const count = Math.max(1, Math.min(50, Number(quantity) || 1));
  const prices = calculateShowtimePrices(showtime);
  const normalizedType = String(seatType || 'STANDARD').toUpperCase();

  let unitPrice = prices.priceStandard;
  let seatTypeLabel = 'Ghế Thường (Standard)';

  if (normalizedType === 'VIP') {
    unitPrice = prices.priceVip;
    seatTypeLabel = 'Ghế VIP';
  } else if (normalizedType === 'SWEETBOX' || normalizedType === 'COUPLE') {
    unitPrice = prices.priceSweetbox;
    seatTypeLabel = 'Ghế Đôi (Sweetbox)';
  }

  const totalPrice = unitPrice * count;

  return {
    quantity: count,
    seatType: normalizedType,
    seatTypeLabel,
    unitPrice,
    totalPrice,
    unitPriceFormatted: formatVND(unitPrice),
    totalPriceFormatted: formatVND(totalPrice),
    allTierPrices: prices,
  };
};

