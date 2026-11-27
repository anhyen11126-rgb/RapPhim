/**
 * Tiện ích xử lý thời gian, số liệu và định dạng cho Module Thống kê & Báo cáo
 * Múi giờ chuẩn: Asia/Ho_Chi_Minh (GMT+7)
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Trích xuất các thành phần ngày/giờ theo múi giờ Asia/Ho_Chi_Minh (+07:00)
 */
export const getVietnamParts = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const shifted = new Date(d.getTime() + VN_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1, // 1..12
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds(),
  };
};

/**
 * Tạo Date UTC tương ứng với một mốc thời gian địa phương tại Việt Nam (+07:00)
 */
export const makeVietnamDate = (year, month, day = 1, hour = 0, minute = 0, second = 0, ms = 0) => {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, ms);
  return new Date(+date - VN_OFFSET_MS);
};

/**
 * MỐC BẮT ĐẦU HOẠT ĐỘNG VÀ THỐNG KÊ CHÍNH THỨC CỦA RẠP D’AVENOR CINEMA
 * 01/11/2026 00:00:00.000 (Asia/Ho_Chi_Minh, GMT+7)
 */
export const CINEMA_OPERATION_START_YEAR = 2026;
export const CINEMA_OPERATION_START_MONTH = 11;
export const CINEMA_OPERATION_START_DAY = 1;
export const CINEMA_OPERATION_START = makeVietnamDate(2026, 11, 1, 0, 0, 0, 0);
export const CINEMA_OPERATION_START_LABEL = '01/11/2026';

export class StatisticsPeriodValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StatisticsPeriodValidationError';
    this.statusCode = 400;
    this.code = 'INVALID_STATISTICS_PERIOD';
    this.details = details;
  }
}

/**
 * Lấy số ngày trong một tháng dương lịch
 */
export const getDaysInMonth = (year, month) => {
  return getVietnamParts(makeVietnamDate(year, month + 1, 0)).day;
};

/**
 * Định dạng chuỗi ngày YYYY-MM-DD hoặc DD/MM/YYYY hoặc DD/MM theo múi giờ Việt Nam
 */
export const formatVietnamDateKey = (date, format = 'DD/MM/YYYY') => {
  const { year, month, day } = getVietnamParts(date);
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year).padStart(4, '0');
  if (format === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
  if (format === 'DD/MM') return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
};

// Chuyển đổi múi giờ sang GMT+7 (tương thích ngược)
export const getVietnamDate = (date = new Date()) => {
  const d = new Date(date);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + VN_OFFSET_MS);
};

const DAY_MS = 86_400_000;

function calendarNumber(value, fallback, min, max) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new StatisticsPeriodValidationError('Tháng hoặc năm không hợp lệ.');
  }
  return number;
}

function parseCalendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new StatisticsPeriodValidationError('Ngày phải có định dạng YYYY-MM-DD.');
  }
  const [year, month, day] = String(value).split('-').map(Number);
  const date = makeVietnamDate(year, month, day);
  if (year < 1 || formatVietnamDateKey(date, 'YYYY-MM-DD') !== value) {
    throw new StatisticsPeriodValidationError('Ngày không hợp lệ.');
  }
  return date;
}

export const parseDateFilter = (
  timeRange = 'this_month', customStart = null, customEnd = null, month = null, year = null
) => {
  let now = new Date();
  if (timeRange && typeof timeRange === 'object') {
    const options = timeRange;
    ({ timeRange = 'this_month', customStart, customEnd, month, year } = options);
    now = options.now ?? now;
  }
  const vn = getVietnamParts(now);
  const today = makeVietnamDate(vn.year, vn.month, vn.day);
  const followingDay = new Date(+today + DAY_MS);
  const selectedYear = calendarNumber(year, vn.year, 1, 9999);
  const selectedMonth = calendarNumber(month, vn.month, 1, 12);
  let start;
  let until;
  let prevStart;
  let label;
  let prevLabel = 'Kỳ liền trước';

  switch (timeRange) {
    case 'today':
    case 'yesterday':
    case 'this_week':
    case '7_days':
    case '30_days': {
      const weekday = new Date(+today + VN_OFFSET_MS).getUTCDay();
      const offset = { today: 0, yesterday: 1, this_week: (weekday + 6) % 7, '7_days': 6, '30_days': 29 };
      start = new Date(+today - offset[timeRange] * DAY_MS);
      until = timeRange === 'this_week' ? new Date(+start + 7 * DAY_MS)
        : timeRange === 'yesterday' ? today : followingDay;
      label = { today: 'Hôm nay', yesterday: 'Hôm qua', this_week: 'Tuần này', '7_days': '7 ngày gần nhất', '30_days': '30 ngày gần nhất' }[timeRange];
      break;
    }
    case 'custom':
      start = parseCalendarDay(customStart);
      until = new Date(+parseCalendarDay(customEnd) + DAY_MS);
      if (until <= start) {
        throw new StatisticsPeriodValidationError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      }
      label = `${formatVietnamDateKey(start)} – ${formatVietnamDateKey(new Date(+until - 1))}`;
      break;
    case 'this_year':
    case 'by_year':
      start = makeVietnamDate(selectedYear, 1);
      until = makeVietnamDate(selectedYear + 1, 1);
      prevStart = makeVietnamDate(selectedYear - 1, 1);
      label = `Năm ${selectedYear}`;
      prevLabel = `Năm ${selectedYear - 1}`;
      break;
    case 'last_month':
    case 'by_month':
    case 'this_month':
    default: {
      const offset = timeRange === 'last_month' ? -1 : 0;
      const y = offset ? vn.year : selectedYear;
      const m = (offset ? vn.month : selectedMonth) + offset;
      start = makeVietnamDate(y, m);
      until = makeVietnamDate(y, m + 1);
      prevStart = makeVietnamDate(y, m - 1);
      const current = getVietnamParts(start);
      const previous = getVietnamParts(prevStart);
      label = `Tháng ${current.month}/${current.year}`;
      prevLabel = `Tháng ${previous.month}/${previous.year}`;
      break;
    }
  }

  const end = new Date(+until - 1);
  const period = getVietnamParts(start);
  return {
    start,
    end,
    chartEnd: new Date(Math.max(+start, Math.min(+end, +followingDay - 1))),
    showtimeEnd: end,
    prevStart: prevStart ?? new Date(2 * +start - +until),
    prevEnd: new Date(+start - 1),
    label,
    prevLabel,
    month: period.month,
    year: period.year,
    hasValidPreviousPeriod: true,
    isFirstOperatingMonth: false,
    momComparisonNote: null,
  };
};

/**
 * Tính tỷ lệ tăng trưởng so với kỳ trước (%)
 * Trả về null khi kỳ trước không có mẫu số hữu hạn khác 0.
 */
export const calculateGrowth = (current = 0, previous = 0, hasValidPreviousPeriod = true) => {
  if (!hasValidPreviousPeriod || !Number.isFinite(Number(previous)) || Number(previous) === 0 ||
      !Number.isFinite(Number(current))) {
    return null;
  }
  const growth = ((Number(current) - Number(previous)) / Math.abs(Number(previous))) * 100;
  return Number(growth.toFixed(1));
};

/**
 * Che một phần số điện thoại bảo mật thông tin cá nhân
 */
export const maskPhoneNumber = (phone = '') => {
  if (!phone) return '—';
  const clean = String(phone).trim();
  if (clean.length < 7) return clean;
  return clean.slice(0, 2) + '****' + clean.slice(-4);
};

/**
 * Đếm số lượng ghế từ chuỗi lưu seats
 */
export const countSeatsFromString = (seatsStr = '') => {
  if (!seatsStr) return 0;
  if (Array.isArray(seatsStr)) return seatsStr.filter(Boolean).length;
  return String(seatsStr)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length;
};

/**
 * Định dạng tiền tệ VND chính xác
 */
export const formatExactCurrency = (amount = 0) => {
  return `${Number(amount || 0).toLocaleString('vi-VN')} ₫`;
};

/**
 * Định dạng tiền tệ rút gọn hiện đại (cho thẻ KPI)
 */
export const formatCompactCurrency = (amount = 0) => {
  const num = Number(amount || 0);
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs >= 1000000000) {
    const b = (abs / 1000000000).toFixed(2).replace(/\.00$/, '').replace('.', ',');
    return `${sign}${b} tỷ ₫`;
  }
  if (abs >= 1000000) {
    const m = (abs / 1000000).toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return `${sign}${m} tr ₫`;
  }
  return formatExactCurrency(num);
};

/**
 * Định dạng tiền tệ VND
 */
export const formatCurrency = (amount = 0) => {
  return `${Number(amount || 0).toLocaleString('vi-VN')} đ`;
};
