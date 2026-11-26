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
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms) - VN_OFFSET_MS;
  return new Date(utcMs);
};

/**
 * Lấy số ngày trong một tháng dương lịch
 */
export const getDaysInMonth = (year, month) => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

/**
 * Định dạng chuỗi ngày YYYY-MM-DD hoặc DD/MM/YYYY hoặc DD/MM theo múi giờ Việt Nam
 */
export const formatVietnamDateKey = (date, format = 'DD/MM/YYYY') => {
  const { year, month, day } = getVietnamParts(date);
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  if (format === 'YYYY-MM-DD') return `${year}-${mm}-${dd}`;
  if (format === 'DD/MM') return `${dd}/${mm}`;
  return `${dd}/${mm}/${year}`;
};

// Chuyển đổi múi giờ sang GMT+7 (tương thích ngược)
export const getVietnamDate = (date = new Date()) => {
  const d = new Date(date);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + VN_OFFSET_MS);
};

/**
 * Phân tích khoảng thời gian lọc (Global Time Range) theo múi giờ Asia/Ho_Chi_Minh (+07:00)
 * Hỗ trợ đầy đủ các tùy chọn:
 * - today: Hôm nay (00:00:00 -> 23:59:59.999)
 * - 7_days: 7 ngày gần nhất
 * - 30_days: 30 ngày gần nhất
 * - this_month: Tháng này
 * - last_month: Tháng trước
 * - by_month: Tháng/năm cụ thể (ví dụ month=11, year=2026)
 * - this_year: Năm nay
 * - custom: Khoảng ngày tùy chọn (customStart -> customEnd)
 *
 * Lưu ý quan trọng (Mục 6):
 * - Với tháng đã qua (ví dụ Tháng 10/2026): hiển thị đầy đủ từ 01/10 đến 31/10.
 * - Với tháng hiện tại (ví dụ Tháng 11/2026, hôm nay là 26/11/2026):
 *   biểu đồ doanh thu và giao dịch chỉ tính đến hết ngày hiện tại (26/11/2026),
 *   tuyệt đối không hiển thị ngày tương lai 27–30/11 trên biểu đồ doanh thu!
 */
export const parseDateFilter = (
  timeRange = 'this_month',
  customStart = null,
  customEnd = null,
  month = null,
  year = null
) => {
  if (typeof timeRange === 'object' && timeRange !== null) {
    const opts = timeRange;
    timeRange = opts.timeRange || 'this_month';
    customStart = opts.customStart ?? null;
    customEnd = opts.customEnd ?? null;
    month = opts.month ?? null;
    year = opts.year ?? null;
  }

  const now = new Date();
  const vnNow = getVietnamParts(now);

  let start;
  let end;
  let chartEnd;
  let showtimeEnd;
  let prevStart;
  let prevEnd;
  let label = 'Tháng này';
  let resolvedMonth = vnNow.month;
  let resolvedYear = vnNow.year;

  if (
    timeRange === 'by_month' ||
    (month != null &&
      year != null &&
      !['custom', 'today', '7_days', '30_days', 'last_month', 'this_year'].includes(timeRange))
  ) {
    const m = Math.min(12, Math.max(1, Number(month) || vnNow.month));
    const y = Number(year) || vnNow.year;
    resolvedMonth = m;
    resolvedYear = y;

    const daysInTargetMonth = getDaysInMonth(y, m);
    const isCurrentMonth = y === vnNow.year && m === vnNow.month;
    const isFutureMonth = y > vnNow.year || (y === vnNow.year && m > vnNow.month);

    start = makeVietnamDate(y, m, 1, 0, 0, 0, 0);
    // Nếu là tháng hiện tại (11/2026), giới hạn ngày doanh thu đến hết ngày hiện tại (26/11/2026 23:59:59.999)
    const activeEndDay = isCurrentMonth ? vnNow.day : daysInTargetMonth;
    end = makeVietnamDate(y, m, activeEndDay, 23, 59, 59, 999);
    chartEnd = isFutureMonth
      ? makeVietnamDate(y, m, 1, 0, 0, 0, 0)
      : makeVietnamDate(y, m, activeEndDay, 23, 59, 59, 999);
    showtimeEnd = makeVietnamDate(y, m, daysInTargetMonth, 23, 59, 59, 999);

    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const daysInPrevMonth = getDaysInMonth(prevY, prevM);
    prevStart = makeVietnamDate(prevY, prevM, 1, 0, 0, 0, 0);
    prevEnd = makeVietnamDate(prevY, prevM, daysInPrevMonth, 23, 59, 59, 999);

    label = `Tháng ${m}/${y}`;
    return {
      start,
      end,
      chartEnd,
      showtimeEnd,
      prevStart,
      prevEnd,
      label,
      month: m,
      year: y,
      prevLabel: `Tháng ${prevM}/${prevY}`,
    };
  }

  switch (timeRange) {
    case 'today': {
      start = makeVietnamDate(vnNow.year, vnNow.month, vnNow.day, 0, 0, 0, 0);
      end = makeVietnamDate(vnNow.year, vnNow.month, vnNow.day, 23, 59, 59, 999);
      chartEnd = new Date(end);
      showtimeEnd = new Date(end);
      prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
      prevEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      label = 'Hôm nay';
      break;
    }
    case '7_days': {
      const todayStart = makeVietnamDate(vnNow.year, vnNow.month, vnNow.day, 0, 0, 0, 0);
      start = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      end = makeVietnamDate(vnNow.year, vnNow.month, vnNow.day, 23, 59, 59, 999);
      chartEnd = new Date(end);
      showtimeEnd = new Date(end);
      const duration = 7 * 24 * 60 * 60 * 1000;
      prevStart = new Date(start.getTime() - duration);
      prevEnd = new Date(start.getTime() - 1);
      label = '7 ngày qua';
      break;
    }
    case '30_days': {
      const todayStart = makeVietnamDate(vnNow.year, vnNow.month, vnNow.day, 0, 0, 0, 0);
      start = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
      end = makeVietnamDate(vnNow.year, vnNow.month, vnNow.day, 23, 59, 59, 999);
      chartEnd = new Date(end);
      showtimeEnd = new Date(end);
      const duration = 30 * 24 * 60 * 60 * 1000;
      prevStart = new Date(start.getTime() - duration);
      prevEnd = new Date(start.getTime() - 1);
      label = '30 ngày qua';
      break;
    }
    case 'this_month': {
      const m = vnNow.month;
      const y = vnNow.year;
      const daysInTargetMonth = getDaysInMonth(y, m);
      start = makeVietnamDate(y, m, 1, 0, 0, 0, 0);
      end = makeVietnamDate(y, m, vnNow.day, 23, 59, 59, 999);
      chartEnd = new Date(end);
      showtimeEnd = makeVietnamDate(y, m, daysInTargetMonth, 23, 59, 59, 999);

      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      const daysInPrevMonth = getDaysInMonth(prevY, prevM);
      prevStart = makeVietnamDate(prevY, prevM, 1, 0, 0, 0, 0);
      prevEnd = makeVietnamDate(prevY, prevM, daysInPrevMonth, 23, 59, 59, 999);
      label = `Tháng ${m}/${y}`;
      break;
    }
    case 'last_month': {
      const m = vnNow.month === 1 ? 12 : vnNow.month - 1;
      const y = vnNow.month === 1 ? vnNow.year - 1 : vnNow.year;
      resolvedMonth = m;
      resolvedYear = y;
      const daysInTargetMonth = getDaysInMonth(y, m);
      start = makeVietnamDate(y, m, 1, 0, 0, 0, 0);
      end = makeVietnamDate(y, m, daysInTargetMonth, 23, 59, 59, 999);
      chartEnd = new Date(end);
      showtimeEnd = new Date(end);

      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      const daysInPrevMonth = getDaysInMonth(prevY, prevM);
      prevStart = makeVietnamDate(prevY, prevM, 1, 0, 0, 0, 0);
      prevEnd = makeVietnamDate(prevY, prevM, daysInPrevMonth, 23, 59, 59, 999);
      label = `Tháng trước (${m}/${y})`;
      break;
    }
    case 'this_year': {
      const y = Number(year) || vnNow.year;
      resolvedYear = y;
      start = makeVietnamDate(y, 1, 1, 0, 0, 0, 0);
      end = y === vnNow.year
        ? makeVietnamDate(y, vnNow.month, vnNow.day, 23, 59, 59, 999)
        : makeVietnamDate(y, 12, 31, 23, 59, 59, 999);
      chartEnd = new Date(end);
      showtimeEnd = makeVietnamDate(y, 12, 31, 23, 59, 59, 999);
      prevStart = makeVietnamDate(y - 1, 1, 1, 0, 0, 0, 0);
      prevEnd = makeVietnamDate(y - 1, 12, 31, 23, 59, 59, 999);
      label = `Năm ${y}`;
      break;
    }
    case 'custom': {
      if (customStart) {
        const parts = String(customStart).split('-').map(Number);
        if (parts.length === 3 && !parts.some(Number.isNaN)) {
          start = makeVietnamDate(parts[0], parts[1], parts[2], 0, 0, 0, 0);
        } else {
          const p = getVietnamParts(new Date(customStart));
          start = makeVietnamDate(p.year, p.month, p.day, 0, 0, 0, 0);
        }
      } else {
        start = makeVietnamDate(vnNow.year, vnNow.month, 1, 0, 0, 0, 0);
      }

      if (customEnd) {
        const parts = String(customEnd).split('-').map(Number);
        if (parts.length === 3 && !parts.some(Number.isNaN)) {
          end = makeVietnamDate(parts[0], parts[1], parts[2], 23, 59, 59, 999);
        } else {
          const p = getVietnamParts(new Date(customEnd));
          end = makeVietnamDate(p.year, p.month, p.day, 23, 59, 59, 999);
        }
      } else {
        end = makeVietnamDate(vnNow.year, vnNow.month, vnNow.day, 23, 59, 59, 999);
      }

      if (end < start) {
        const tmp = start;
        const pEnd = getVietnamParts(end);
        const pTmp = getVietnamParts(tmp);
        start = makeVietnamDate(pEnd.year, pEnd.month, pEnd.day, 0, 0, 0, 0);
        end = makeVietnamDate(pTmp.year, pTmp.month, pTmp.day, 23, 59, 59, 999);
      }

      chartEnd = new Date(end);
      showtimeEnd = new Date(end);
      const duration = Math.max(24 * 60 * 60 * 1000, end.getTime() - start.getTime() + 1);
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(start.getTime() - duration);
      label = `${formatVietnamDateKey(start)} – ${formatVietnamDateKey(end)}`;
      break;
    }
    default: {
      const m = vnNow.month;
      const y = vnNow.year;
      const daysInTargetMonth = getDaysInMonth(y, m);
      start = makeVietnamDate(y, m, 1, 0, 0, 0, 0);
      end = makeVietnamDate(y, m, vnNow.day, 23, 59, 59, 999);
      chartEnd = new Date(end);
      showtimeEnd = makeVietnamDate(y, m, daysInTargetMonth, 23, 59, 59, 999);
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      const daysInPrevMonth = getDaysInMonth(prevY, prevM);
      prevStart = makeVietnamDate(prevY, prevM, 1, 0, 0, 0, 0);
      prevEnd = makeVietnamDate(prevY, prevM, daysInPrevMonth, 23, 59, 59, 999);
      label = `Tháng ${m}/${y}`;
      break;
    }
  }

  return {
    start,
    end,
    chartEnd: chartEnd || end,
    showtimeEnd,
    prevStart,
    prevEnd,
    label,
    month: resolvedMonth,
    year: resolvedYear,
  };
};

/**
 * Tính tỷ lệ tăng trưởng so với kỳ trước (%)
 * Nếu kỳ trước không có dữ liệu (= 0), trả về null để UI hiển thị N/A thay vì chia cho 0 hoặc 100% ảo.
 */
export const calculateGrowth = (current = 0, previous = 0) => {
  if (previous === null || previous === undefined || Number(previous) === 0) {
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
