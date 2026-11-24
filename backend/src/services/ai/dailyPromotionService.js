import { getVNDateParts } from './timezoneUtils.js';
import { getVietnameseWeekday } from './promptTemplate.js';

/**
 * Bảng ưu đãi theo từng thứ trong tuần (0: Chủ Nhật -> 6: Thứ 7)
 * Đồng bộ 100% với PromotionsPage.jsx trên Frontend.
 */
export const DAILY_DEAL_BY_WEEKDAY = {
  1: {
    badge: 'ƯU ĐÃI THỨ 2',
    title: 'THỨ 2 KHỞI ĐẦU — GIẢM 25% VÉ 2D',
    code: 'MON25',
    discountTag: 'Giảm 25%',
    description:
      'Giảm ngay 25% giá vé 2D cho tất cả các suất chiếu trong ngày, giảm thêm 15.000đ Combo Khởi Tuần khi đặt kèm vé online.',
  },
  2: {
    badge: 'SIÊU BÃO THỨ 3',
    title: 'THỨ 3 VUI VẺ — ĐỒNG GIÁ VÉ 45K',
    code: 'TUE45K',
    discountTag: 'Đồng giá 45.000đ',
    description:
      'Đồng giá vé 2D chỉ 45.000đ cả ngày Thứ 3, ưu đãi giảm 20% Combo Đôi Bắp Lớn 2 Ngăn + 02 Nước Ngọt khi đặt online.',
  },
  3: {
    badge: 'HAPPY DAY THỨ 4',
    title: 'THỨ 4 HAPPY DAY — ĐỒNG GIÁ 50K MỌI SUẤT',
    code: 'WED50K',
    discountTag: 'Đồng giá 50.000đ',
    description:
      'Đồng giá 50.000đ/vé 2D mọi khung giờ chiếu Thứ 4, miễn phí nâng size bắp lớn khi mua kèm combo bất kỳ.',
  },
  4: {
    badge: 'NGÀY HỘI THÀNH VIÊN',
    title: 'THỨ 5 THÀNH VIÊN — GIẢM 30K & X2 ĐIỂM',
    code: 'THU30K',
    discountTag: 'Giảm 30.000đ & X2 điểm',
    description:
      'Giảm ngay 30.000đ cho đơn từ 150.000đ và nhân đôi điểm tích lũy thành viên khi đăng nhập đặt vé ngày Thứ 5.',
  },
  5: {
    badge: 'QUẨY CUỐI TUẦN THỨ 6',
    title: 'THỨ 6 BÙNG NỔ — COMBO ĐÔI GIẢM 40%',
    code: 'FRI40',
    discountTag: 'Giảm 40% Combo Đôi',
    description:
      'Giảm ngay 40% Combo Bắp Nước Đôi khi đặt từ 02 vé trở lên cho các suất chiếu ngày Thứ 6.',
  },
  6: {
    badge: 'ƯU ĐÃI CUỐI TUẦN THỨ 7',
    title: 'THỨ 7 CỰC ĐÃ — HOÀN 30K VNPAY-QR',
    code: 'SAT30K',
    discountTag: 'Giảm 30.000đ VNPAY-QR',
    description:
      'Thanh toán qua cổng VNPAY-QR giảm ngay 30.000đ cho đơn từ 150.000đ mọi định dạng 2D, IMAX & Gold Class.',
  },
  0: {
    badge: 'CHỦ NHẬT SUM VẦY',
    title: 'CHỦ NHẬT GIA ĐÌNH — MUA 3 TẶNG 1 VÉ',
    code: 'SUNFAM',
    discountTag: 'Mua 3 tặng 1 vé',
    description:
      'Đặt nhóm 04 vé chỉ tính tiền 03 vé cùng suất chiếu, kèm ưu đãi giảm 20% Combo Gia Đình 02 Bắp + 04 Nước.',
  },
};

export const getDailyDealForDate = (targetDate = new Date()) => {
  const vnParts = getVNDateParts(targetDate) || getVNDateParts(new Date());
  const dayIdx = vnParts ? vnParts.dayOfWeek : new Date().getDay();
  const deal = DAILY_DEAL_BY_WEEKDAY[dayIdx] || DAILY_DEAL_BY_WEEKDAY[2];
  return {
    dayIdx,
    weekdayName: getVietnameseWeekday(dayIdx),
    shortDate: vnParts?.displayShortDate || '',
    fullDate: vnParts?.displayDate || '',
    ...deal,
  };
};
