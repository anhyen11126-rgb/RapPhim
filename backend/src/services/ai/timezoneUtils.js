/**
 * Utilities xử lý ngày giờ chuẩn theo múi giờ Việt Nam (Asia/Ho_Chi_Minh - UTC+7)
 * Đảm bảo tính nhất quán tuyệt đối dù server chạy ở UTC hay bất kỳ timezone nào.
 */

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Bỏ dấu tiếng Việt phục vụ nhận diện biểu thức thời gian chính xác với ranh giới từ ASCII (\b)
 */
const stripTones = (str = '') =>
  String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

/**
 * Chuyển một Date hoặc chuỗi thời gian sang các thành phần lịch theo giờ Việt Nam (UTC+7)
 */
export const getVNDateParts = (inputDate = new Date()) => {
  const d = inputDate instanceof Date ? inputDate : new Date(inputDate);
  if (Number.isNaN(d.getTime())) {
    return null;
  }

  // Dịch sang mốc UTC+7 để đọc các trường bằng getUTC*
  const vnShifted = new Date(d.getTime() + VN_OFFSET_MS);
  const year = vnShifted.getUTCFullYear();
  const month = vnShifted.getUTCMonth() + 1; // 1-12
  const day = vnShifted.getUTCDate(); // 1-31
  const hour = vnShifted.getUTCHours(); // 0-23
  const minute = vnShifted.getUTCMinutes(); // 0-59
  const dayOfWeek = vnShifted.getUTCDay(); // 0 (CN) - 6 (Thứ 7)

  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = `${year}-${pad(month)}-${pad(day)}`;
  const displayDate = `${pad(day)}/${pad(month)}/${year}`;
  const displayShortDate = `${pad(day)}/${pad(month)}`;
  const timeStr = `${pad(hour)}:${pad(minute)}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    dayOfWeek,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    dateKey,
    displayDate,
    displayShortDate,
    timeStr,
    timestamp: d.getTime(),
  };
};

/**
 * Tạo đối tượng Date (mốc thực UTC) từ năm, tháng, ngày, giờ, phút theo múi giờ Asia/Ho_Chi_Minh
 */
export const createVNDate = (year, month, day, hour = 0, minute = 0, second = 0, ms = 0) => {
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second, ms) - VN_OFFSET_MS;
  return new Date(utcMillis);
};

/**
 * Lấy khoảng đầu ngày (00:00:00.000) và cuối ngày (23:59:59.999) theo giờ Việt Nam
 */
export const getVNDayBounds = (year, month, day) => {
  return {
    startOfDay: createVNDate(year, month, day, 0, 0, 0, 0),
    endOfDay: createVNDate(year, month, day, 23, 59, 59, 999),
  };
};

/**
 * Nhãn ngày tương đối so với thời điểm hiện tại (hôm nay / ngày mai / ngày kia / ngày DD/MM/YYYY)
 * Tuyệt đối không gắn nhãn "hôm nay" cho mọi suất chiếu khác ngày.
 */
export const getRelativeDayLabel = (targetDate, nowDate = new Date()) => {
  const targetParts = getVNDateParts(targetDate);
  const nowParts = getVNDateParts(nowDate);
  if (!targetParts || !nowParts) return '';

  const targetDayStart = createVNDate(targetParts.year, targetParts.month, targetParts.day).getTime();
  const nowDayStart = createVNDate(nowParts.year, nowParts.month, nowParts.day).getTime();
  const diffDays = Math.round((targetDayStart - nowDayStart) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return `hôm nay (${targetParts.displayShortDate})`;
  if (diffDays === 1) return `ngày mai (${targetParts.displayShortDate})`;
  if (diffDays === 2) return `ngày kia (${targetParts.displayShortDate})`;
  return `ngày ${targetParts.displayDate}`;
};

/**
 * Trích xuất yêu cầu ngày chiếu từ câu hỏi người dùng (hôm nay, ngày mai, ngày kia, hoặc DD/MM[/YYYY])
 */
export const parseVietnameseDateFromText = (text = '', nowDate = new Date()) => {
  const lower = String(text || '').toLowerCase().trim();
  const noTone = stripTones(lower);
  const nowParts = getVNDateParts(nowDate);
  if (!nowParts) return null;

  // 1. Kiểm tra định dạng ngày cụ thể DD/MM/YYYY hoặc DD-MM-YYYY hoặc DD/MM
  const explicitDateMatch = noTone.match(
    /\b(?:ngay\s*)?(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/i
  );
  if (explicitDateMatch) {
    const day = Number(explicitDateMatch[1]);
    const month = Number(explicitDateMatch[2]);
    let year = explicitDateMatch[3] ? Number(explicitDateMatch[3]) : nowParts.year;
    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const target = createVNDate(year, month, day, 12, 0, 0);
      const parts = getVNDateParts(target);
      const bounds = getVNDayBounds(parts.year, parts.month, parts.day);
      return {
        type: 'SPECIFIC_DATE',
        dateKey: parts.dateKey,
        displayDate: parts.displayDate,
        displayShortDate: parts.displayShortDate,
        label: getRelativeDayLabel(target, nowDate),
        ...bounds,
      };
    }
  }

  // 2. Ngày kia / ngày mốt (+2 ngày)
  if (/\b(ngay\s+kia|ngay\s+mot|hom\s+kia)\b/i.test(noTone)) {
    const target = new Date(nowDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    const parts = getVNDateParts(target);
    const bounds = getVNDayBounds(parts.year, parts.month, parts.day);
    return {
      type: 'DAY_AFTER',
      dateKey: parts.dateKey,
      displayDate: parts.displayDate,
      displayShortDate: parts.displayShortDate,
      label: `ngày kia (${parts.displayShortDate})`,
      ...bounds,
    };
  }

  // 3. Ngày mai / tối mai / sáng mai / chiều mai / trưa mai (+1 ngày)
  if (/\b(ngay\s+mai|toi\s+mai|sang\s+mai|chieu\s+mai|trua\s+mai|dem\s+mai|hom\s+sau)\b/i.test(noTone)) {
    const target = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000);
    const parts = getVNDateParts(target);
    const bounds = getVNDayBounds(parts.year, parts.month, parts.day);
    return {
      type: 'TOMORROW',
      dateKey: parts.dateKey,
      displayDate: parts.displayDate,
      displayShortDate: parts.displayShortDate,
      label: `ngày mai (${parts.displayShortDate})`,
      ...bounds,
    };
  }

  // 4. Hôm nay / tối nay / chiều nay / sáng nay / trưa nay / đêm nay / bây giờ
  if (
    /\b(hom\s+nay|toi\s+nay|chieu\s+nay|sang\s+nay|trua\s+nay|dem\s+nay|bay\s+gio|hien\s+tai)\b/i.test(
      noTone
    )
  ) {
    const bounds = getVNDayBounds(nowParts.year, nowParts.month, nowParts.day);
    return {
      type: 'TODAY',
      dateKey: nowParts.dateKey,
      displayDate: nowParts.displayDate,
      displayShortDate: nowParts.displayShortDate,
      label: `hôm nay (${nowParts.displayShortDate})`,
      ...bounds,
    };
  }

  return null;
};

/**
 * Trích xuất bộ lọc khung giờ từ câu hỏi người dùng
 */
export const parseTimeFilterFromText = (text = '') => {
  const lower = String(text || '').toLowerCase();
  const noTone = stripTones(lower);

  // Khoảng giờ: "từ 21h đến 22h", "21h-22h", "21h - 22h"
  const rangeMatch = noTone.match(
    /\b(?:tu\s*)?(\d{1,2})(?:h|:)(\d{2})?\s*(?:den|toi|\-|–)\s*(\d{1,2})(?:h|:)?(\d{2})?\b/i
  );
  if (rangeMatch) {
    const startH = Number(rangeMatch[1]);
    const startM = rangeMatch[2] ? Number(rangeMatch[2]) : 0;
    const endH = Number(rangeMatch[3]);
    const endM = rangeMatch[4] ? Number(rangeMatch[4]) : 59;
    if (startH >= 0 && startH <= 23 && endH >= 0 && endH <= 23) {
      return {
        type: 'RANGE',
        minMinutes: startH * 60 + startM,
        maxMinutes: endH * 60 + endM,
        label: `từ ${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')} đến ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      };
    }
  }

  // Sau X giờ: "sau 19h", "sau 20:00", "từ 19h trở đi"
  const afterMatch = noTone.match(/\b(?:sau|tu)\s*(\d{1,2})(?:h|:)(\d{2})?\s*(?:gio|tro\s+di|toi)?\b/i);
  if (afterMatch && !noTone.includes('tu khoa')) {
    let h = Number(afterMatch[1]);
    const m = afterMatch[2] ? Number(afterMatch[2]) : 0;
    if (h < 12 && /\b(toi|chieu|dem)\b/i.test(noTone)) h += 12;
    if (h >= 0 && h <= 23) {
      return {
        type: 'AFTER',
        minMinutes: h * 60 + m,
        maxMinutes: 23 * 60 + 59,
        label: `sau ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      };
    }
  }

  // Trước X giờ: "trước 17h"
  const beforeMatch = noTone.match(/\btruoc\s*(\d{1,2})(?:h|:)(\d{2})?\b/i);
  if (beforeMatch) {
    const h = Number(beforeMatch[1]);
    const m = beforeMatch[2] ? Number(beforeMatch[2]) : 0;
    if (h >= 0 && h <= 23) {
      return {
        type: 'BEFORE',
        minMinutes: 0,
        maxMinutes: h * 60 + m,
        label: `trước ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      };
    }
  }

  // Giờ cụ thể: "lúc 21:15", "suất 19h30", "20:00", "21h15"
  const exactMatch = noTone.match(/\b(?:luc|suat|gio|vao)?\s*(\d{1,2})(?:h|:)(\d{2})\b/i);
  if (exactMatch) {
    const h = Number(exactMatch[1]);
    const m = Number(exactMatch[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      const exactTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      return {
        type: 'EXACT',
        exactTime,
        minMinutes: h * 60 + m,
        maxMinutes: h * 60 + m,
        label: `lúc ${exactTime}`,
      };
    }
  }

  // Giờ chẵn dạng "lúc 20h", "suất 19h"
  const hourOnlyMatch = noTone.match(/\b(?:luc|suat)\s*(\d{1,2})\s*(?:h|gio)\b/i);
  if (hourOnlyMatch) {
    let h = Number(hourOnlyMatch[1]);
    if (h < 12 && /\b(toi|dem|chieu)\b/i.test(noTone)) h += 12;
    if (h >= 0 && h <= 23) {
      const exactTime = `${String(h).padStart(2, '0')}:00`;
      return {
        type: 'HOUR',
        exactTime,
        minMinutes: h * 60,
        maxMinutes: h * 60 + 59,
        label: `khoảng ${h}h`,
      };
    }
  }

  // Buổi trong ngày
  if (/\b(suat\s+khuya|dem\s+khuya|sau\s+22h)\b/i.test(noTone)) {
    return {
      type: 'PERIOD',
      period: 'LATE_NIGHT',
      minMinutes: 22 * 60,
      maxMinutes: 23 * 60 + 59,
      label: 'suất khuya (từ 22:00)',
    };
  }
  if (/\b(buoi\s+toi|toi\s+nay|toi\s+mai)\b/i.test(noTone)) {
    return {
      type: 'PERIOD',
      period: 'EVENING',
      minMinutes: 17 * 60,
      maxMinutes: 23 * 60 + 59,
      label: 'buổi tối (từ 17:00)',
    };
  }
  if (/\b(buoi\s+chieu|chieu\s+nay|chieu\s+mai)\b/i.test(noTone)) {
    return {
      type: 'PERIOD',
      period: 'AFTERNOON',
      minMinutes: 12 * 60,
      maxMinutes: 17 * 60 + 59,
      label: 'buổi chiều (12:00 - 17:59)',
    };
  }
  if (/\b(buoi\s+sang|sang\s+nay|sang\s+mai)\b/i.test(noTone)) {
    return {
      type: 'PERIOD',
      period: 'MORNING',
      minMinutes: 6 * 60,
      maxMinutes: 11 * 60 + 59,
      label: 'buổi sáng (trước 12:00)',
    };
  }

  return null;
};
