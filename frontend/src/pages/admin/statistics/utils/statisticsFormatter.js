/**
 * Format tiền tệ VND
 * Ví dụ: 125000000 -> "125.000.000 đ"
 */
export const formatCurrency = (val = 0) => {
  return `${Number(val || 0).toLocaleString('vi-VN')} đ`;
};

/**
 * Format tiền tệ VND chính xác
 * Ví dụ: 1852389000 -> "1.852.389.000 ₫"
 */
export const formatExactCurrency = (val = 0) => {
  return `${Number(val || 0).toLocaleString('vi-VN')} ₫`;
};

/**
 * Format tiền tệ rút gọn hiện đại (cho thẻ KPI)
 * Ví dụ: 1852389000 -> "1,85 tỷ ₫", 125000000 -> "125 tr ₫"
 */
export const formatCompactCurrency = (val = 0) => {
  const num = Number(val || 0);
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
 * Format số lượng có dấu phân cách
 * Ví dụ: 15420 -> "15.420"
 */
export const formatNumber = (val = 0) => {
  return Number(val || 0).toLocaleString('vi-VN');
};

/**
 * Format phần trăm
 * Ví dụ: 78.5 -> "78.5%"
 */
export const formatPercent = (val = 0) => {
  return `${Number(val || 0).toFixed(1)}%`;
};

/**
 * Format ngày giờ theo định dạng tiếng Việt
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Che số điện thoại bảo mật thông tin
 */
export const maskPhone = (phone = '') => {
  if (!phone) return '—';
  const str = String(phone).trim();
  if (str.length < 7) return str;
  return str.slice(0, 2) + '****' + str.slice(-4);
};
