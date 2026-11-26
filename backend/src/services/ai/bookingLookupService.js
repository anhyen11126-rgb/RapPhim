import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Booking from '../../models/Booking.js';
import User from '../../models/User.js';
import AdminUser from '../../models/AdminUser.js';
import { getVNDateParts, getRelativeDayLabel } from './timezoneUtils.js';
import { formatVND } from './pricingService.js';

const getJwtSecret = () => process.env.JWT_SECRET;

const STATUS_LABELS_VI = {
  PAID: 'Đã thanh toán thành công ✅',
  PENDING: 'Chưa thanh toán ⏳',
  CANCELLED: 'Đã hủy ❌',
  EXCHANGED: 'Đã đổi suất chiếu 🔄',
};

const STATUS_LABELS_EN = {
  PAID: 'Paid ✅',
  PENDING: 'Unpaid / Pending ⏳',
  CANCELLED: 'Cancelled ❌',
  EXCHANGED: 'Exchanged 🔄',
};

const normalizePhone = (phone = '') => String(phone || '').replace(/[\s.-]/g, '').trim();

/**
 * Xác thực JWT từ Authorization header (Bearer token).
 * TUYỆT ĐỐI KHÔNG tin tưởng email/SĐT hoặc vai trò tự khai từ req.body.
 */
export const extractAuthenticatedUserFromHeader = async (authHeader = '') => {
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const secret = getJwtSecret();
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
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

    const fallbackEmail = String(decoded?.email || '').toLowerCase().trim();
    const fallbackPhone = normalizePhone(decoded?.phone || '');
    if (!userId && !fallbackEmail && !fallbackPhone) return null;

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
 * Kiểm tra tin nhắn có cố tình cung cấp email / SĐT của người khác để xem vé không.
 */
const detectsThirdPartyIdentifier = (message = '', authUser = null) => {
  const raw = String(message || '');
  const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && authUser?.email) {
    if (emailMatch[0].toLowerCase().trim() !== String(authUser.email).toLowerCase().trim()) {
      return true;
    }
  }
  const phoneMatch = raw.match(/\b((?:\+?84|0)[35789]\d{8})\b/);
  if (phoneMatch && authUser?.phone) {
    const cleanTarget = normalizePhone(phoneMatch[1]).replace(/^\+84/, '0');
    const cleanSelf = normalizePhone(authUser.phone).replace(/^\+84/, '0');
    if (cleanSelf && cleanTarget !== cleanSelf) {
      return true;
    }
  }
  return false;
};

/**
 * Truy vấn đơn đặt vé thuộc quyền sở hữu của đúng người dùng đã xác thực.
 * Phân biệt rõ:
 * - mode = 'LATEST': Chỉ lấy đơn đặt vé mới nhất vừa thực hiện (Mục 8.1)
 * - mode = 'HISTORY': Lấy lịch sử đặt vé và phân nhóm trạng thái (Mục 8.2)
 * - mode = 'OTHER_USER': Từ chối truy cập vé của người khác (Mục 8.3)
 */
export const lookupUserBookings = async ({
  authUser = null,
  bookingCode = null,
  mode = 'HISTORY',
  userMessage = '',
  nowDate = new Date(),
  mockBookings = null,
}) => {
  if (mode === 'OTHER_USER' || (authUser && detectsThirdPartyIdentifier(userMessage, authUser))) {
    return {
      forbiddenOtherUser: true,
      requiresAuth: false,
      bookings: [],
      notFoundForUser: false,
    };
  }

  // Nếu chưa đăng nhập mà cố tra theo email/SĐT người khác
  if (!authUser && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\b(?:0[35789]\d{8})\b/.test(userMessage)) {
    return {
      forbiddenOtherUser: true,
      requiresAuth: false,
      bookings: [],
      notFoundForUser: false,
    };
  }

  if (!authUser || (!authUser.id && !authUser.email && !authUser.phone)) {
    return { requiresAuth: true, bookings: [], notFoundForUser: false, forbiddenOtherUser: false };
  }

  const userIdStr = String(authUser.id || '').trim();
  const userEmail = String(authUser.email || '').toLowerCase().trim();
  const userPhone = normalizePhone(authUser.phone || '');
  const requestedCode = bookingCode ? String(bookingCode).trim().toUpperCase() : null;
  const maxLimit = mode === 'LATEST' && !requestedCode ? 1 : 20;

  let rawBookings = [];

  if (Array.isArray(mockBookings)) {
    const owned = mockBookings.filter((b) => {
      const bUserId = b.userId ? String(b.userId).trim() : '';
      const bEmail = String(b.customerEmail || '').toLowerCase().trim();
      const bPhone = normalizePhone(b.customerPhone || '');
      const belongsToUser =
        (userIdStr && bUserId && bUserId === userIdStr) ||
        (userEmail && bEmail === userEmail) ||
        (userPhone && bPhone === userPhone);
      if (!belongsToUser) return false;
      if (requestedCode && String(b.bookingCode || '').toUpperCase() !== requestedCode) return false;
      return true;
    });
    owned.sort((a, b) => new Date(b.createdAt || b.startTime || 0) - new Date(a.createdAt || a.startTime || 0));
    rawBookings = owned.slice(0, maxLimit);
  } else {
    if (mongoose.connection.readyState !== 1) {
      return {
        requiresAuth: false,
        bookings: [],
        notFoundForUser: false,
        forbiddenOtherUser: false,
        dbUnavailable: true,
      };
    }

    const ownerConditions = [];
    if (userIdStr && mongoose.Types.ObjectId.isValid(userIdStr)) {
      ownerConditions.push({ userId: new mongoose.Types.ObjectId(userIdStr) });
    }
    if (userEmail) {
      ownerConditions.push({
        customerEmail: new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
    }
    if (userPhone) {
      ownerConditions.push({ customerPhone: userPhone });
    }

    if (ownerConditions.length === 0) {
      return { requiresAuth: true, bookings: [], notFoundForUser: false, forbiddenOtherUser: false };
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
      .limit(maxLimit)
      .lean();
  }

  const formatted = rawBookings.map((b) => {
    const st = b.showtimeId && typeof b.showtimeId === 'object' ? b.showtimeId : null;
    const movieTitle = st?.movieId?.title || b.movieTitle || 'Phim tại rạp';
    const cinemaName = st?.cinemaId?.name || b.cinemaName || "D'AVENOR Thanh Khê Plaza";
    const roomName = st?.roomName || b.roomName || 'Phòng chiếu tiêu chuẩn';
    const startTime = st?.startTime || b.startTime || null;
    const startObj = startTime ? new Date(startTime) : null;
    const isPastShowtime = Boolean(startObj && !Number.isNaN(startObj.getTime()) && startObj.getTime() <= nowDate.getTime());
    const vnParts = startTime ? getVNDateParts(startTime) : null;
    const relativeLabel = startTime ? getRelativeDayLabel(startTime, nowDate) : '';
    const statusUpper = String(b.status || 'PAID').toUpperCase();
    const paymentStatusUpper = String(b.paymentStatus || (statusUpper === 'PAID' ? 'VERIFIED' : 'PENDING')).toUpperCase();

    let bucket = 'LATEST_ACTIVE';
    if (statusUpper === 'CANCELLED') {
      bucket = 'CANCELLED';
    } else if (statusUpper === 'PENDING' || paymentStatusUpper === 'UNPAID' || paymentStatusUpper === 'FAILED') {
      bucket = 'UNPAID';
    } else if (isPastShowtime || b.isCheckedIn) {
      bucket = 'PAST_WATCHED';
    }

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
      status: statusUpper,
      paymentStatus: paymentStatusUpper,
      statusLabelVi: STATUS_LABELS_VI[statusUpper] || statusUpper,
      statusLabelEn: STATUS_LABELS_EN[statusUpper] || statusUpper,
      paymentMethod: b.paymentMethod || '',
      isCheckedIn: Boolean(b.isCheckedIn),
      isPastShowtime,
      bucket,
      createdAt: b.createdAt || null,
    };
  });

  return {
    requiresAuth: false,
    forbiddenOtherUser: false,
    mode,
    bookings: formatted,
    notFoundForUser: Boolean(requestedCode && formatted.length === 0),
  };
};

const formatSingleTicketBlock = (b, lang = 'vi', indexPrefix = '') => {
  if (lang === 'en') {
    const timePart = b.time ? `**${b.time}** (${b.date})` : 'Updating time';
    const checkInNote = b.isCheckedIn ? ' • Checked in' : '';
    const comboNote = b.concessions ? `\n  🍿 Concessions: ${b.concessions}` : '';
    return `${indexPrefix}🎟️ Code: **\`${b.bookingCode}\`** — **${b.movieTitle}**\n  🕒 Showtime: ${timePart} | **${b.roomName}** (${b.cinemaName})\n  💺 Seats: **${b.seats}** | Total: **${b.totalAmountFormatted}** (${b.paymentMethod || 'Online'})\n  📌 Status: **${b.statusLabelEn}**${checkInNote}${comboNote}`;
  }

  const timePart = b.time ? `**${b.time}** (${b.relativeDayLabel || b.date})` : 'Đang cập nhật giờ';
  const checkInNote = b.isCheckedIn ? ' • Đã soát vé' : ' • Chưa soát vé';
  const comboNote = b.concessions ? `\n  🍿 Combo: ${b.concessions}` : '';
  return `${indexPrefix}🎟️ Mã đặt vé: **\`${b.bookingCode}\`** — **${b.movieTitle}**\n  🕒 Suất chiếu: ${timePart} | **${b.roomName}** (${b.cinemaName})\n  💺 Ghế: **${b.seats}** | Tổng tiền: **${b.totalAmountFormatted}** (${b.paymentMethod || 'Online'})\n  📌 Trạng thái: **${b.statusLabelVi}**${checkInNote}${comboNote}`;
};

/**
 * Tạo phản hồi chuẩn xác, bảo mật cho intent BOOKING_LOOKUP (hỗ trợ VI & EN)
 */
export const buildBookingLookupReply = ({
  lookupResult,
  bookingCode = null,
  authUser = null,
  primaryCinema = {},
  language = 'vi',
}) => {
  const isEn = language === 'en';
  const cinemaHotline = primaryCinema?.hotline || '1900 8899';

  // 8.3. Chặn xem vé của người khác
  if (lookupResult.forbiddenOtherUser) {
    return {
      reply: isEn
        ? 'Sorry, I cannot provide another person\'s booking information for security reasons. You can only look up tickets belonging to your own account.'
        : 'Xin lỗi, mình không thể cung cấp thông tin đặt vé của người khác vì lý do bảo mật. Bạn chỉ có thể tra cứu những vé thuộc tài khoản của mình.',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  if (lookupResult.requiresAuth) {
    return {
      reply: isEn
        ? '🔐 Please **sign in to your account** first so I can securely check your ticket bookings.\n\n👉 [Sign in ➔](/auth)'
        : '🔐 Để bảo mật thông tin đặt vé, bạn vui lòng **đăng nhập tài khoản** trước khi tra cứu nhé!\n\n👉 [Đăng nhập ngay ➔](/auth)',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  if (lookupResult.dbUnavailable) {
    return {
      reply: isEn
        ? 'I cannot load information from the system right now. Please try again in a few minutes!'
        : 'Hiện tại mình chưa thể tải được thông tin từ hệ thống. Bạn vui lòng thử lại sau ít phút nhé!',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  if (lookupResult.notFoundForUser) {
    return {
      reply: isEn
        ? `I could not find booking code **${bookingCode}** under your account (**${authUser?.name || 'yours'}**). For security reasons, you can only view tickets belonging to your own account. If you need payment reconciliation, please contact Hotline **${cinemaHotline}**.`
        : `Mình không tìm thấy đơn đặt vé có mã **${bookingCode}** gắn với tài khoản **${authUser?.name || 'của bạn'}**. Vì lý do bảo mật, bạn chỉ có thể tra cứu những vé thuộc tài khoản của mình (hoặc liên hệ Hotline **${cinemaHotline}** nếu cần đối soát giao dịch).`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // 8.1. Kiểm tra vé vừa đặt (chỉ hiển thị đơn mới nhất, không đổ toàn bộ lịch sử cũ)
  if (lookupResult.mode === 'LATEST' && !bookingCode) {
    const latest = lookupResult.bookings?.[0];
    if (!latest || (latest.bucket === 'PAST_WATCHED' && latest.isPastShowtime)) {
      return {
        reply: isEn
          ? 'I could not find any new ticket booking on your account at the moment.'
          : 'Hiện tại mình chưa tìm thấy giao dịch đặt vé mới nào của bạn.',
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    return {
      reply: isEn
        ? `🎟️ **Your latest ticket booking (${authUser?.name || 'Account'}):**\n\n${formatSingleTicketBlock(latest, 'en')}\n\n👉 [View My Tickets & QR Code ➔](/my-tickets)`
        : `🎟️ **Giao dịch đặt vé mới nhất của ${authUser?.name || 'bạn'}:**\n\n${formatSingleTicketBlock(latest, 'vi')}\n\n👉 [Mở Vé của tôi & Mã QR ➔](/my-tickets)`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // Trường hợp chưa có bất kỳ đơn vé nào
  if (!lookupResult.bookings || lookupResult.bookings.length === 0) {
    return {
      reply: isEn
        ? 'I could not find any ticket bookings under your account at the moment.'
        : 'Hiện tại mình chưa tìm thấy giao dịch đặt vé mới nào của bạn.',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // Nếu tra theo 1 mã cụ thể thuộc chính chủ
  if (bookingCode && lookupResult.bookings.length === 1) {
    const b = lookupResult.bookings[0];
    return {
      reply: isEn
        ? `🎟️ **Ticket Details:**\n\n${formatSingleTicketBlock(b, 'en')}\n\n👉 [Open My Tickets ➔](/my-tickets)`
        : `🎟️ **Chi tiết đơn đặt vé của ${authUser?.name || 'bạn'}:**\n\n${formatSingleTicketBlock(b, 'vi')}\n\n👉 [Mở Vé của tôi & Mã QR ➔](/my-tickets)`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // 8.2. Xem lịch sử đặt vé: Phân biệt rõ 4 nhóm (Vé mới nhất / Vé đã xem / Vé đã hủy / Vé chưa thanh toán)
  const newestActive = lookupResult.bookings.filter((b) => b.bucket === 'LATEST_ACTIVE');
  const pastWatched = lookupResult.bookings.filter((b) => b.bucket === 'PAST_WATCHED');
  const unpaid = lookupResult.bookings.filter((b) => b.bucket === 'UNPAID');
  const cancelled = lookupResult.bookings.filter((b) => b.bucket === 'CANCELLED');

  const sections = [];
  if (newestActive.length > 0) {
    const title = isEn ? '🟢 **Latest / Upcoming Tickets:**' : '🟢 **Vé mới nhất / Sắp xem:**';
    sections.push(
      `${title}\n${newestActive.map((b, i) => formatSingleTicketBlock(b, language, `${i + 1}. `)).join('\n\n')}`
    );
  }
  if (unpaid.length > 0) {
    const title = isEn ? '⏳ **Unpaid Tickets:**' : '⏳ **Vé chưa thanh toán:**';
    sections.push(
      `${title}\n${unpaid.map((b, i) => formatSingleTicketBlock(b, language, `${i + 1}. `)).join('\n\n')}`
    );
  }
  if (pastWatched.length > 0) {
    const title = isEn ? '🎬 **Past Watched Tickets:**' : '🎬 **Vé đã xem trong quá khứ:**';
    sections.push(
      `${title}\n${pastWatched.map((b, i) => formatSingleTicketBlock(b, language, `${i + 1}. `)).join('\n\n')}`
    );
  }
  if (cancelled.length > 0) {
    const title = isEn ? '❌ **Cancelled Tickets:**' : '❌ **Vé đã hủy:**';
    sections.push(
      `${title}\n${cancelled.map((b, i) => formatSingleTicketBlock(b, language, `${i + 1}. `)).join('\n\n')}`
    );
  }

  const header = isEn
    ? `🎟️ **Booking History for ${authUser?.name || 'your account'} (${lookupResult.bookings.length} bookings):**`
    : `🎟️ **Lịch sử đặt vé của ${authUser?.name || 'bạn'} (${lookupResult.bookings.length} đơn):**`;
  const footer = isEn
    ? '👉 [Open My Tickets & QR Codes ➔](/my-tickets)'
    : '👉 [Mở Vé của tôi & Mã QR ➔](/my-tickets)';

  return {
    reply: `${header}\n\n${sections.join('\n\n')}\n\n${footer}`,
    movieCard: null,
    movieCards: [],
    quickReplies: [],
    recommendedMovie: '',
  };
};
