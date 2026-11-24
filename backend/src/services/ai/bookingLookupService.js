import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Booking from '../../models/Booking.js';
import User from '../../models/User.js';
import AdminUser from '../../models/AdminUser.js';
import { getVNDateParts, getRelativeDayLabel } from './timezoneUtils.js';
import { formatVND } from './pricingService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'movietix_jwt_secret_key_2026_cdio';

const STATUS_LABELS = {
  PAID: 'Đã thanh toán thành công ✅',
  PENDING: 'Chờ thanh toán ⏳',
  CANCELLED: 'Đã hủy ❌',
  EXCHANGED: 'Đã đổi suất chiếu 🔄',
};

const normalizePhone = (phone = '') => String(phone || '').replace(/[\s.-]/g, '').trim();

/**
 * Xác thực JWT tùy chọn từ Authorization header (Bearer token).
 * TUYỆT ĐỐI KHÔNG tin tưởng email/SĐT gửi từ req.body để tra cứu dữ liệu cá nhân.
 */
export const extractAuthenticatedUserFromHeader = async (authHeader = '') => {
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded?.id || decoded?.userId || decoded?._id || null;

    if (userId && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(String(userId))) {
      const dbUser = await User.findById(userId).select('name email phone role').lean().catch(() => null);
      if (dbUser) {
        return {
          id: String(dbUser._id),
          name: dbUser.name || decoded.name || 'Khách hàng',
          email: String(dbUser.email || '').toLowerCase().trim(),
          phone: normalizePhone(dbUser.phone || ''),
          role: dbUser.role || 'CUSTOMER',
        };
      }
      const adminUser = await AdminUser.findById(userId).select('name email role').lean().catch(() => null);
      if (adminUser) {
        return {
          id: String(adminUser._id),
          name: adminUser.name || decoded.name || 'Quản trị viên',
          email: String(adminUser.email || '').toLowerCase().trim(),
          phone: '',
          role: adminUser.role || 'ADMIN',
        };
      }
    }

    // Nếu token hợp lệ nhưng DB chưa sẵn sàng hoặc là token có sẵn email/phone
    const fallbackEmail = String(decoded?.email || '').toLowerCase().trim();
    const fallbackPhone = normalizePhone(decoded?.phone || '');
    if (!fallbackEmail && !fallbackPhone) return null;

    return {
      id: userId ? String(userId) : '',
      name: decoded?.name || 'Khách hàng',
      email: fallbackEmail,
      phone: fallbackPhone,
      role: decoded?.role || 'CUSTOMER',
    };
  } catch {
    return null;
  }
};

/**
 * Truy vấn các đơn đặt vé thuộc quyền sở hữu của đúng người dùng đã xác thực.
 * Không bao giờ cho phép truy cập đơn hàng của người dùng khác.
 */
export const lookupUserBookings = async ({
  authUser = null,
  bookingCode = null,
  nowDate = new Date(),
  mockBookings = null,
}) => {
  if (!authUser || (!authUser.email && !authUser.phone)) {
    return { requiresAuth: true, bookings: [], notFoundForUser: false };
  }

  const userEmail = String(authUser.email || '').toLowerCase().trim();
  const userPhone = normalizePhone(authUser.phone || '');
  const requestedCode = bookingCode ? String(bookingCode).trim().toUpperCase() : null;

  let rawBookings = [];

  if (Array.isArray(mockBookings)) {
    rawBookings = mockBookings.filter((b) => {
      const bEmail = String(b.customerEmail || '').toLowerCase().trim();
      const bPhone = normalizePhone(b.customerPhone || '');
      const belongsToUser = (userEmail && bEmail === userEmail) || (userPhone && bPhone === userPhone);
      if (!belongsToUser) return false;
      if (requestedCode && String(b.bookingCode || '').toUpperCase() !== requestedCode) return false;
      return true;
    });
  } else {
    if (mongoose.connection.readyState !== 1) {
      return { requiresAuth: false, bookings: [], notFoundForUser: false, dbUnavailable: true };
    }

    const ownerConditions = [];
    if (userEmail) {
      ownerConditions.push({ customerEmail: new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    }
    if (userPhone) {
      ownerConditions.push({ customerPhone: userPhone });
    }

    const query = { $or: ownerConditions };
    if (requestedCode) {
      query.bookingCode = new RegExp(`^${requestedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    rawBookings = await Booking.find(query)
      .populate({
        path: 'showtimeId',
        select: 'movieId cinemaId roomName formatFeature startTime',
        populate: [
          { path: 'movieId', select: 'title ageRating' },
          { path: 'cinemaId', select: 'name' },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
  }

  const formatted = rawBookings.map((b) => {
    const st = b.showtimeId && typeof b.showtimeId === 'object' ? b.showtimeId : null;
    const movieTitle = st?.movieId?.title || b.movieTitle || 'Phim tại rạp';
    const cinemaName = st?.cinemaId?.name || b.cinemaName || "D'AVENOR Thanh Khê Plaza";
    const roomName = st?.roomName || b.roomName || 'Phòng chiếu tiêu chuẩn';
    const startTime = st?.startTime || b.startTime || null;
    const vnParts = startTime ? getVNDateParts(startTime) : null;
    const relativeLabel = startTime ? getRelativeDayLabel(startTime, nowDate) : '';

    return {
      bookingCode: b.bookingCode || '',
      movieTitle,
      cinemaName,
      roomName,
      time: vnParts ? vnParts.timeStr : '',
      date: vnParts ? vnParts.displayDate : '',
      relativeDayLabel: relativeLabel,
      seats: String(b.seats || '').trim(),
      concessions: String(b.concessions || '').trim(),
      totalAmount: Number(b.totalAmount) || 0,
      totalAmountFormatted: formatVND(b.totalAmount || 0),
      status: String(b.status || 'PAID').toUpperCase(),
      statusLabel: STATUS_LABELS[String(b.status || 'PAID').toUpperCase()] || b.status,
      paymentMethod: b.paymentMethod || '',
      isCheckedIn: Boolean(b.isCheckedIn),
    };
  });

  return {
    requiresAuth: false,
    bookings: formatted,
    notFoundForUser: Boolean(requestedCode && formatted.length === 0),
  };
};

/**
 * Tạo phản hồi thân thiện, bảo mật cho intent BOOKING_LOOKUP
 */
export const buildBookingLookupReply = ({
  lookupResult,
  bookingCode = null,
  authUser = null,
  primaryCinema = {},
}) => {
  const cinemaHotline = primaryCinema?.hotline || '1900 8899';

  if (lookupResult.requiresAuth) {
    return {
      reply: `🔐 Để bảo mật thông tin cá nhân và đơn đặt vé của bạn, bạn vui lòng **đăng nhập tài khoản** trước khi tra cứu nhé!\n\n👉 [Đăng nhập ngay ➔](/login)\n\nSau khi đăng nhập, bạn có thể hỏi lại mình ngay tại đây hoặc xem mã QR tại mục [Vé của tôi ➔](/my-tickets).`,
      movieCard: null,
      movieCards: [],
      quickReplies: ['Các bộ phim đang chiếu hiện tại?', 'Chính sách đổi/hủy vé'],
      recommendedMovie: '',
    };
  }

  if (lookupResult.dbUnavailable) {
    return {
      reply: `Hiện hệ thống tra cứu đơn vé đang tạm gián đoạn. Bạn vui lòng kiểm tra tại mục [Vé của tôi ➔](/my-tickets) hoặc gọi Hotline **${cinemaHotline}** để được hỗ trợ ngay nhé!`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  if (lookupResult.notFoundForUser) {
    return {
      reply: `Mình không tìm thấy đơn đặt vé có mã **${bookingCode}** gắn với tài khoản **${authUser?.name || 'của bạn'}**.\n\nBạn vui lòng kiểm tra lại mã vé hoặc mở mục [Vé của tôi ➔](/my-tickets) để xem toàn bộ lịch sử đặt vé. Nếu cần hỗ trợ đối soát giao dịch, hãy liên hệ Hotline **${cinemaHotline}** nhé!`,
      movieCard: null,
      movieCards: [],
      quickReplies: ['Xem tất cả vé của tôi', 'Tôi bị trừ tiền nhưng chưa nhận vé'],
      recommendedMovie: '',
    };
  }

  if (!lookupResult.bookings || lookupResult.bookings.length === 0) {
    return {
      reply: `Tài khoản **${authUser?.name || 'của bạn'}** hiện chưa có đơn đặt vé nào trong hệ thống **D'AVENOR CINEMA**.\n\nBạn có muốn xem danh sách phim đang chiếu hôm nay để đặt vé ngay không? 🎬`,
      movieCard: null,
      movieCards: [],
      quickReplies: ['Các bộ phim đang chiếu hiện tại?', 'Tối nay có suất chiếu nào?'],
      recommendedMovie: '',
    };
  }

  const lines = lookupResult.bookings.map((b, idx) => {
    const timePart = b.time ? `**${b.time}** (${b.relativeDayLabel || b.date})` : 'Đang cập nhật giờ';
    const checkInNote = b.isCheckedIn ? ' • Đã check-in' : ' • Chưa check-in';
    const comboNote = b.concessions ? `\n  🍿 Combo: ${b.concessions}` : '';
    return `${idx + 1}. 🎟️ Mã vé: **\`${b.bookingCode}\`** — **${b.movieTitle}**\n  🕒 Suất: ${timePart} | **${b.roomName}** (${b.cinemaName})\n  💺 Ghế: **${b.seats}** | Tổng tiền: **${b.totalAmountFormatted}** (${b.paymentMethod || 'Online'})\n  📌 Trạng thái: **${b.statusLabel}**${checkInNote}${comboNote}`;
  });

  return {
    reply: `🎟️ **Thông tin đơn đặt vé của ${authUser?.name || 'bạn'} (${lookupResult.bookings.length} đơn gần nhất):**\n\n${lines.join('\n\n')}\n\n👉 [Mở Vé của tôi & Mã QR ➔](/my-tickets)`,
    movieCard: null,
    movieCards: [],
    quickReplies: ['Chính sách đổi suất chiếu', 'Các bộ phim đang chiếu hiện tại?'],
    recommendedMovie: '',
  };
};
