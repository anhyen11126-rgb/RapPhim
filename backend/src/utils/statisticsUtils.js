/**
 * Tiện ích xử lý thời gian, số liệu và định dạng cho Module Thống kê & Báo cáo
 * Múi giờ chuẩn: Asia/Ho_Chi_Minh (GMT+7)
 */

// Chuyển đổi múi giờ sang GMT+7
export const getVietnamDate = (date = new Date()) => {
  const d = new Date(date);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 7);
};

/**
 * Phân tích khoảng thời gian lọc (Global Time Range)
 * Hỗ trợ đúng 6 tùy chọn chuẩn:
 * 1. today: 00:00:00 hôm nay đến thời điểm hiện tại
 * 2. 7_days: 00:00:00 cách đây 6 ngày đến thời điểm hiện tại
 * 3. this_month: 00:00:00 ngày 1 tháng này đến thời điểm hiện tại
 * 4. last_month: 00:00:00 ngày 1 tháng trước đến 23:59:59.999 ngày cuối tháng trước
 * 5. this_year: 00:00:00 ngày 1/1 năm nay đến thời điểm hiện tại
 * 6. custom: 00:00:00 ngày bắt đầu đến 23:59:59.999 ngày kết thúc
 */
export const parseDateFilter = (
  timeRange = 'this_month',
  customStart = null,
  customEnd = null,
  month = null,
  year = null
) => {
  // Hỗ trợ truyền 1 object options: parseDateFilter({ timeRange, month, year, customStart, customEnd })
  if (typeof timeRange === 'object' && timeRange !== null) {
    const opts = timeRange;
    timeRange = opts.timeRange || 'this_month';
    customStart = opts.customStart || null;
    customEnd = opts.customEnd || null;
    month = opts.month || null;
    year = opts.year || null;
  }

  const now = new Date();
  let start = new Date();
  let end = new Date();
  let showtimeEnd = new Date();
  let prevStart = new Date();
  let prevEnd = new Date();
  let label = 'Tháng này';

  // Nếu có chỉ định month & year cụ thể (theo Yêu cầu 1 của giảng viên)
  if (timeRange === 'by_month' || (month != null && year != null)) {
    const m = Number(month) || (now.getMonth() + 1);
    const y = Number(year) || now.getFullYear();

    start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    // Nếu là tháng hiện tại thì end tính đến hiện tại, nếu tháng khác thì tính trọn tháng
    const isCurrentMonth = y === now.getFullYear() && m === (now.getMonth() + 1);
    end = isCurrentMonth ? new Date(now) : new Date(y, m, 0, 23, 59, 59, 999);
    showtimeEnd = new Date(y, m, 0, 23, 59, 59, 999);

    // Kỳ trước: tháng trước đó
    const prevMonthDate = new Date(y, m - 2, 1);
    const prevM = prevMonthDate.getMonth() + 1;
    const prevY = prevMonthDate.getFullYear();
    prevStart = new Date(prevY, prevM - 1, 1, 0, 0, 0, 0);
    prevEnd = new Date(prevY, prevM, 0, 23, 59, 59, 999);

    label = `Tháng ${m}/${y}`;
    return { start, end, showtimeEnd, prevStart, prevEnd, label, month: m, year: y };
  }

  switch (timeRange) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now);
      showtimeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 1);
      label = 'Hôm nay';
      break;
    }
    case '7_days': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      end = new Date(now);
      showtimeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const duration = 7 * 24 * 60 * 60 * 1000;
      prevStart = new Date(start.getTime() - duration);
      prevEnd = new Date(start.getTime() - 1);
      label = '7 ngày qua';
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now);
      showtimeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      label = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
      break;
    }
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      showtimeEnd = new Date(end);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      label = `Tháng trước (${start.getMonth() + 1}/${start.getFullYear()})`;
      break;
    }
    case 'this_year': {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now);
      showtimeEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
      label = `Năm ${now.getFullYear()}`;
      break;
    }
    case 'custom': {
      if (customStart) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      }
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      } else {
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      }
      showtimeEnd = new Date(end);
      const duration = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - duration);
      label = `${start.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`;
      break;
    }
    default: {
      // Mặc định an toàn: 7 ngày qua
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      end = new Date(now);
      showtimeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const duration = 7 * 24 * 60 * 60 * 1000;
      prevStart = new Date(start.getTime() - duration);
      prevEnd = new Date(start.getTime() - 1);
      label = '7 ngày qua';
      break;
    }
  }

  return { start, end, showtimeEnd, prevStart, prevEnd, label };
};

/**
 * Tính tỷ lệ tăng trưởng so với kỳ trước (%)
 */
export const calculateGrowth = (current = 0, previous = 0) => {
  if (!previous || previous === 0) {
    if (current > 0) return 100;
    return 0;
  }
  const growth = ((current - previous) / previous) * 100;
  return Number(growth.toFixed(1));
};

/**
 * Che một phần số điện thoại bảo mật thông tin cá nhân
 * Ví dụ: "0914827083" -> "09****7083"
 */
export const maskPhoneNumber = (phone = '') => {
  if (!phone) return '—';
  const clean = String(phone).trim();
  if (clean.length < 7) return clean;
  return clean.slice(0, 2) + '****' + clean.slice(-4);
};

/**
 * Đếm số lượng ghế từ chuỗi lưu seats
 * Ví dụ: "A1, A2, A3" -> 3 ghế
 */
export const countSeatsFromString = (seatsStr = '') => {
  if (!seatsStr) return 0;
  return seatsStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length;
};

/**
 * Định dạng tiền tệ VND chính xác
 * Ví dụ: 1852389000 -> "1.852.389.000 ₫"
 */
export const formatExactCurrency = (amount = 0) => {
  return `${Number(amount || 0).toLocaleString('vi-VN')} ₫`;
};

/**
 * Định dạng tiền tệ rút gọn hiện đại (cho thẻ KPI)
 * Ví dụ: 1852389000 -> "1,85 tỷ ₫", 125000000 -> "125 tr ₫"
 */
export const formatCompactCurrency = (amount = 0) => {
  const num = Number(amount || 0);
  if (num >= 1000000000) {
    const b = (num / 1000000000).toFixed(2).replace(/\.00$/, '').replace('.', ',');
    return `${b} tỷ ₫`;
  }
  if (num >= 1000000) {
    const m = (num / 1000000).toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return `${m} tr ₫`;
  }
  return formatExactCurrency(num);
};

/**
 * Định dạng tiền tệ VND
 */
export const formatCurrency = (amount = 0) => {
  return `${Number(amount || 0).toLocaleString('vi-VN')} đ`;
};
