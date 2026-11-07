/**
 * Hệ thống tính toán giá vé động (Dynamic Pricing) chuẩn hóa theo:
 * 1. Phân loại phòng chiếu / công nghệ (IMAX Laser, VIP Gold Class, RealD 3D, 2D Tiêu chuẩn Dolby)
 * 2. Ngày trong tuần (Thứ 2 - Thứ 5 vs Thứ 6 - Chủ Nhật)
 * 3. Khung giờ chiếu (Trước 17:00, Sau 17:00, Suất khuya sau 22:00)
 */

export const getRoomPriceRange = (format, isWeekend) => {
  const f = (format || '').toLowerCase();
  if (f.includes('imax')) {
    return isWeekend
      ? { min: 140000, max: 360000, label: '140.000đ ~ 360.000đ' }
      : { min: 140000, max: 340000, label: '140.000đ ~ 340.000đ' };
  }
  if (f.includes('3d')) {
    return isWeekend
      ? { min: 65000, max: 180000, label: '65.000đ ~ 180.000đ' }
      : { min: 60000, max: 150000, label: '60.000đ ~ 150.000đ' };
  }
  // 2D Dolby Tiêu chuẩn
  return isWeekend
    ? { min: 50000, max: 160000, label: '50.000đ ~ 160.000đ' }
    : { min: 45000, max: 120000, label: '45.000đ ~ 120.000đ' };
};

export const calculateDynamicPrices = (showtime) => {
  let dateObj = null;
  if (showtime?.startTime) {
    dateObj = new Date(showtime.startTime);
  } else if (showtime?.fullDate) {
    dateObj = new Date(showtime.fullDate);
  } else if (showtime?.date) {
    dateObj = new Date(showtime.date);
  }
  if (!dateObj || isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }

  // Lấy giờ từ chuỗi time (ví dụ "19:15" hay "22:30") hoặc từ Date
  let hour = dateObj.getHours();
  let minute = dateObj.getMinutes();
  if (showtime?.time && typeof showtime.time === 'string' && showtime.time.includes(':')) {
    const [h, m] = showtime.time.split(':').map(Number);
    if (!isNaN(h)) hour = h;
    if (!isNaN(m)) minute = m;
  }

  const dayOfWeek = dateObj.getDay(); // 0: Chủ Nhật (Thứ 8), 1: T2, ..., 5: T6, 6: T7
  // Thứ Sáu, Thứ Bảy, Chủ Nhật là Cuối tuần
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  // Suất chiếu khuya từ 22:00 / 22:30 trở đi (hoặc trước 6:00 sáng) giá sẽ rẻ hơn
  const isLateNight = hour >= 22 || hour < 6;
  const isBefore17 = hour < 17;

  // Nhận diện loại phòng chiếu từ roomName, format, hoặc formatFeature
  const roomNameStr = (showtime?.roomName || '').toLowerCase();
  const formatStr = (showtime?.format || showtime?.formatFeature || '').toLowerCase();
  const fullSpec = `${roomNameStr} ${formatStr}`;

  const isImax = fullSpec.includes('imax');
  const isGoldClass = fullSpec.includes('gold class') || fullSpec.includes('lounge');
  const is3D = fullSpec.includes('3d');

  // ==========================================
  // 1. PHÒNG CHIẾU IMAX LASER GRAND HALL (Đỉnh cao công nghệ)
  // ==========================================
  if (isImax) {
    let basePrice = 160000;

    if (isLateNight) {
      // Suất khuya từ 22:30 giá rẻ hơn
      basePrice = 140000;
    } else if (isWeekend) {
      // Cuối tuần T6, T7, CN giá cao hơn
      basePrice = isBefore17 ? 160000 : 170000;
    } else {
      // Ngày thường T2 - T5
      basePrice = isBefore17 ? 140000 : 160000;
    }

    if (showtime?.isHoliday) {
      basePrice = 180000;
    }

    return {
      priceStandard: basePrice,
      priceVip: basePrice + 25000,
      priceSweetbox: basePrice * 2 + 20000,
      roomTypeLabel: 'IMAX Laser Grand Hall',
      timeSlotLabel: isLateNight
        ? 'Suất khuya sau 22:00'
        : isWeekend
        ? isBefore17
          ? 'Cuối tuần trước 17:00'
          : 'Giờ vàng cuối tuần'
        : isBefore17
        ? 'Ngày thường trước 17:00'
        : 'Giờ vàng ngày thường',
      dayLabel: isWeekend ? 'Thứ 6 - CN' : 'Thứ 2 - T5',
    };
  }

  // ==========================================
  // 2. PHÒNG CHIẾU VIP GOLD CLASS / LOUNGE
  // ==========================================
  if (isGoldClass) {
    const basePrice = isWeekend ? 220000 : 200000;
    return {
      priceStandard: basePrice,
      priceVip: basePrice + 30000,
      priceSweetbox: basePrice * 2,
      roomTypeLabel: 'VIP Gold Class Lounge',
      timeSlotLabel: isWeekend ? 'Suất chiếu cuối tuần' : 'Suất chiếu ngày thường',
      dayLabel: isWeekend ? 'Thứ 6 - CN' : 'Thứ 2 - T5',
    };
  }

  // ==========================================
  // 3. PHÒNG CHIẾU REALD 3D HIGH FRAME RATE
  // ==========================================
  if (is3D) {
    let basePrice = 65000;
    let vipAdd = 20000;
    let sweetboxPrice = 150000;

    if (isLateNight) {
      // Suất khuya 22:30 rẻ hơn
      basePrice = isWeekend ? 65000 : 60000;
      vipAdd = 20000;
      sweetboxPrice = isWeekend ? 150000 : 140000;
    } else if (isWeekend) {
      // Cuối tuần T6, T7, CN giá cao hơn
      basePrice = isBefore17 ? 75000 : 80000;
      vipAdd = 20000;
      sweetboxPrice = 180000;
    } else {
      // Ngày thường T2 - T5
      basePrice = isBefore17 ? 60000 : 65000;
      vipAdd = 20000;
      sweetboxPrice = 150000;
    }

    if (showtime?.isHoliday) {
      basePrice = 90000;
      sweetboxPrice = 200000;
    }

    return {
      priceStandard: basePrice,
      priceVip: basePrice + vipAdd,
      priceSweetbox: sweetboxPrice,
      roomTypeLabel: 'Phòng chiếu RealD 3D',
      timeSlotLabel: isLateNight
        ? 'Suất 3D khuya sau 22:00'
        : isWeekend
        ? isBefore17
          ? '3D cuối tuần trước 17:00'
          : '3D giờ vàng cuối tuần'
        : isBefore17
        ? '3D ngày thường trước 17:00'
        : '3D ngày thường sau 17:00',
      dayLabel: isWeekend ? 'Thứ 6 - CN' : 'Thứ 2 - T5',
    };
  }

  // ==========================================
  // 4. PHÒNG CHIẾU 2D TIÊU CHUẨN / DOLBY 7.1 / DOLBY ATMOS
  // ==========================================
  let stdPrice = 50000;
  let vipPrice = 70000;
  let sweetboxPrice = 120000;
  let timeLabel = 'Sau 17:00 (Ngày thường)';
  let dayText = isWeekend ? 'Thứ Sáu - Chủ Nhật' : 'Thứ 2 - Thứ 5';

  if (isLateNight) {
    // Suất khuya từ 22:30 giá vé rẻ hơn một chút
    stdPrice = isWeekend ? 50000 : 45000;
    vipPrice = isWeekend ? 75000 : 65000;
    sweetboxPrice = isWeekend ? 130000 : 110000;
    timeLabel = 'Suất chiếu khuya (sau 22:00)';
  } else if (showtime?.isHoliday) {
    stdPrice = 70000;
    vipPrice = 95000;
    sweetboxPrice = 170000;
    timeLabel = 'Ngày Lễ / Tết';
    dayText = 'Lễ Tết';
  } else if (isWeekend) {
    // Cuối tuần T6, T7, CN giá cao hơn
    if (isBefore17) {
      stdPrice = 60000;
      vipPrice = 85000;
      sweetboxPrice = 150000;
      timeLabel = 'Trước 17:00 (Cuối tuần)';
    } else {
      stdPrice = 65000;
      vipPrice = 90000;
      sweetboxPrice = 160000;
      timeLabel = 'Sau 17:00 (Giờ vàng cuối tuần)';
    }
  } else {
    // Thứ 2, 3, 4, 5 (Ngày thường giá thấp hơn cuối tuần)
    if (isBefore17) {
      stdPrice = 45000;
      vipPrice = 70000;
      sweetboxPrice = 110000;
      timeLabel = 'Trước 17:00 (Ngày thường)';
    } else {
      stdPrice = 50000;
      vipPrice = 70000;
      sweetboxPrice = 120000;
      timeLabel = 'Sau 17:00 (Ngày thường)';
    }
  }

  return {
    priceStandard: stdPrice,
    priceVip: vipPrice,
    priceSweetbox: sweetboxPrice,
    roomTypeLabel: '2D Dolby Tiêu Chuẩn',
    timeSlotLabel: timeLabel,
    dayLabel: dayText,
  };
};
