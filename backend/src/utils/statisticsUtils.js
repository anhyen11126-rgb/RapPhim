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
 * Hỗ trợ: today, yesterday, 7_days, 30_days, this_month, last_month, this_year, custom, all
 */
export const parseDateFilter = (timeRange = '7_days', customStart = null, customEnd = null) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();
  let prevStart = new Date();
  let prevEnd = new Date();
  let label = '7 ngày gần nhất';

  switch (timeRange) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      // Kỳ trước: ngày hôm qua
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 1);
      label = 'Hôm nay';
      break;
    }
    case 'yesterday': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      // Kỳ trước: ngày hôm kia
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 1);
      label = 'Hôm qua';
      break;
    }
    case '7_days': {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      // Kỳ trước: 7 ngày trước đó nữa
      const duration = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - duration);
      label = '7 ngày gần nhất';
      break;
    }
    case '30_days': {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      const duration = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - duration);
      label = '30 ngày gần nhất';
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      // Kỳ trước: tháng trước
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      label = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
      break;
    }
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      // Kỳ trước: tháng trước nữa
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      label = `Tháng trước (${start.getMonth() + 1}/${start.getFullYear()})`;
      break;
    }
    case 'this_year': {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      // Kỳ trước: năm trước
      prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      label = `Năm ${now.getFullYear()}`;
      break;
    }
    case 'custom': {
      if (customStart) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      } else {
        end = new Date();
      }
      const duration = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - duration);
      label = `${start.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`;
      break;
    }
    case 'all':
    default: {
      start = new Date('2020-01-01T00:00:00.000Z');
      end = new Date('2030-12-31T23:59:59.999Z');
      prevStart = new Date('2010-01-01T00:00:00.000Z');
      prevEnd = new Date('2019-12-31T23:59:59.999Z');
      label = 'Toàn thời gian';
      break;
    }
  }

  return { start, end, prevStart, prevEnd, label };
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
 * Định dạng tiền tệ VND
 */
export const formatCurrency = (amount = 0) => {
  return `${Number(amount || 0).toLocaleString('vi-VN')} đ`;
};
