/**
 * Hệ thống tính toán giá vé động (Dynamic Pricing) theo ngày trong tuần, khung giờ và loại ghế:
 * - Thứ 2, 3, 4, 5:
 *    * Trước 17:00: Ghế thường 45.000 VNĐ | Ghế VIP 70.000 VNĐ | Sweetbox 110.000 VNĐ
 *    * Sau 17:00: Ghế thường 50.000 VNĐ | Ghế VIP 70.000 VNĐ | Sweetbox 120.000 VNĐ
 * - Thứ Sáu, Thứ Bảy, Chủ Nhật (Cuối tuần):
 *    * Trước 17:00: Ghế thường 60.000 VNĐ | Ghế VIP 85.000 VNĐ | Sweetbox 150.000 VNĐ
 *    * Sau 17:00: Ghế thường 65.000 VNĐ | Ghế VIP 90.000 VNĐ | Sweetbox 160.000 VNĐ
 * - Suất chiếu khuya (sau 22:00):
 *    * Ghế thường: từ 50.000 VNĐ | Ghế VIP 70.000 VNĐ | Sweetbox 110.000 VNĐ
 * - Ngày Lễ / Tết (hoặc suất chiếu đặc biệt):
 *    * Ghế thường: 70.000 VNĐ | Ghế VIP 95.000 VNĐ | Sweetbox 170.000 VNĐ
 */

export const calculateDynamicPrices = (showtime) => {
  let dateObj = null;
  if (showtime?.startTime) {
    dateObj = new Date(showtime.startTime);
  }
  if (!dateObj || isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }

  // Lấy giờ từ chuỗi time (ví dụ "19:15" hay "22:30") hoặc từ Date
  let hour = dateObj.getHours();
  if (showtime?.time && typeof showtime.time === 'string' && showtime.time.includes(':')) {
    const [h] = showtime.time.split(':').map(Number);
    if (!isNaN(h)) hour = h;
  }

  const dayOfWeek = dateObj.getDay(); // 0: Chủ Nhật, 1: Thứ 2, ..., 5: Thứ 6, 6: Thứ 7
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  const isLateNight = hour >= 22 || hour < 6;
  const isBefore17 = hour < 17;

  // 1. Suất chiếu khuya (sau 22:00)
  if (isLateNight) {
    return {
      priceStandard: 50000,
      priceVip: 70000,
      priceSweetbox: 110000,
      timeSlotLabel: 'Suất chiếu khuya (sau 22:00)',
      dayLabel: isWeekend ? 'Cuối tuần' : 'Ngày thường',
    };
  }

  // 2. Ngày Lễ / Tết
  if (showtime?.isHoliday) {
    return {
      priceStandard: 70000,
      priceVip: 95000,
      priceSweetbox: 170000,
      timeSlotLabel: 'Ngày Lễ / Tết',
      dayLabel: 'Lễ Tết',
    };
  }

  // 3. Thứ Sáu, Thứ Bảy, Chủ Nhật (Cuối tuần)
  if (isWeekend) {
    if (isBefore17) {
      return {
        priceStandard: 60000,
        priceVip: 85000,
        priceSweetbox: 150000,
        timeSlotLabel: 'Trước 17:00 (Cuối tuần)',
        dayLabel: 'Thứ Sáu - Chủ Nhật',
      };
    } else {
      return {
        priceStandard: 65000,
        priceVip: 90000,
        priceSweetbox: 160000,
        timeSlotLabel: 'Sau 17:00 (Giờ vàng cuối tuần)',
        dayLabel: 'Thứ Sáu - Chủ Nhật',
      };
    }
  }

  // 4. Thứ 2, 3, 4, 5 (Ngày thường trong tuần)
  if (isBefore17) {
    return {
      priceStandard: 45000,
      priceVip: 70000,
      priceSweetbox: 110000,
      timeSlotLabel: 'Trước 17:00 (Ngày thường)',
      dayLabel: 'Thứ 2 - Thứ 5',
    };
  } else {
    return {
      priceStandard: 50000,
      priceVip: 70000,
      priceSweetbox: 120000,
      timeSlotLabel: 'Sau 17:00 (Ngày thường)',
      dayLabel: 'Thứ 2 - Thứ 5',
    };
  }
};

