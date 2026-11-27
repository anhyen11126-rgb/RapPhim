import { countSeatsFromString } from '../utils/statisticsUtils.js';
import crypto from 'node:crypto';
import statisticsService from '../services/statisticsService.js';
import Room from '../models/Room.js';
import { businessDate } from '../services/bookingPolicy.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';
import Booking from '../models/Booking.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import Cinema from '../models/Cinema.js';
import User from '../models/User.js';
import Concession from '../models/Concession.js';
import Promotion from '../models/Promotion.js';
import OtpVerification from '../models/OtpVerification.js';
import AiConfig from '../models/AiConfig.js';
import AiChatLog from '../models/AiChatLog.js';
import TicketPricingConfig, { INITIAL_PRICING_FORMATS } from '../models/TicketPricingConfig.js';
import {
  ensurePricingConfig,
  calculatePricesFromConfig,
  syncDatabaseWithPricingConfig,
} from '../services/pricingConfigService.js';
import {
  ROOM_TYPES_ENUM,
  SEAT_GRID_CONFIG,
  buildStandard88SeatTemplates,
  resolveCanonicalRoomType,
} from '../utils/roomLayoutConfig.js';
import { ensureCleanConcessions, resolveConcessionVisuals } from './concessionController.js';
import { ensureCleanPromotions, resolvePromotionVisuals } from './promotionController.js';
import { resolveCinemaImage, DEFAULT_CINEMA_BANNER } from './cinemaController.js';
import { generateAndSendEmailOtp } from './authController.js';
import {
  computeShowtimeLifecycle,
  DEFAULT_CLEANING_MINUTES,
  normalizeCleaningMinutes,
} from '../services/showtimeLifecycleService.js';
import { ensureAiConfig } from '../services/aiService.js';

// Đăng nhập Admin
export const adminLogin = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) return res.sendStatus(503);
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const admin = await AdminUser.findOne({
      $or: [
        { email: cleanEmail },
        { email: cleanEmail.replace('@davenor.vn', '@movietix.vn') },
        { email: cleanEmail.replace('@movietix.vn', '@davenor.vn') }
      ]
    });

    if (!admin) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { id: admin._id.toString(), email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Đăng nhập thành công',
      token,
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi đăng nhập', error: error.message });
  }
};

// Thống kê Dashboard
export const getDashboardStats = async (req, res) => {
  try {
    // 1. Tổng doanh thu từ các đơn PAID
    const revenueResult = await Booking.aggregate([
      { $match: { status: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // 2. Tổng số vé đã bán
    const totalTickets = await ShowtimeSeat.countDocuments({ status: 'BOOKED' });

    // 3. Tổng số phim, suất chiếu, rạp & thành viên
    const totalMovies = await Movie.countDocuments();
    const totalShowtimes = await Showtime.countDocuments();
    const totalCinemas = await Cinema.countDocuments();
    const totalUsers = await User.countDocuments();

    // 4. Các đơn đặt vé gần nhất (5 đơn)
    const rawRecentBookings = await Booking.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: 'showtimeId',
        populate: { path: 'movieId' },
      })
      .lean();

    const recentBookings = rawRecentBookings.map((b) => {
      const showtime = b.showtimeId;
      return {
        ...b,
        id: b._id.toString(),
        showtime: showtime
          ? {
            ...showtime,
            id: showtime._id.toString(),
            movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
          }
          : null,
      };
    });

    res.json({
      stats: {
        totalRevenue,
        totalTickets,
        totalMovies,
        totalShowtimes,
        totalCinemas,
        totalUsers,
      },
      recentBookings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy thống kê', error: error.message });
  }
};

// Quản lý Phim: Tạo phim mới
export const createMovie = async (req, res) => {
  try {
    const {
      title,
      posterUrl,
      poster,
      trailerUrl,
      description,
      genre,
      duration,
      ageRating,
      techFormat,
      formats,
      rating,
      releaseDate,
      status,
      price,
    } = req.body;

    const slug =
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '') +
      '-' +
      Date.now();

    const parsedFormats = Array.isArray(formats)
      ? formats.map((f) => String(f).trim()).filter(Boolean)
      : typeof formats === 'string' && formats.trim()
        ? formats
          .split(/[,•|]+/)
          .map((f) => f.trim())
          .filter(Boolean)
        : ['2D', '3D', techFormat || 'IMAX'];

    const resolvedPoster =
      posterUrl ||
      poster ||
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop';

    const movie = await Movie.create({
      title,
      slug,
      posterUrl: resolvedPoster,
      poster: resolvedPoster,
      trailerUrl: trailerUrl || '',
      description: description || '',
      genre: genre || 'Chưa phân loại',
      duration: parseInt(duration, 10) || 120,
      ageRating: ageRating || 'T16',
      techFormat: techFormat || parsedFormats[parsedFormats.length - 1] || 'IMAX',
      formats: parsedFormats,
      rating: rating ? String(rating) : '4.8',
      releaseDate: releaseDate ? new Date(releaseDate) : new Date(),
      status: status || 'NOW_SHOWING',
      price: parseFloat(price) || 95000,
    });

    res.status(201).json({
      ...movie.toObject(),
      id: movie._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo phim mới', error: error.message });
  }
};

// Quản lý Phim: Cập nhật
export const updateMovie = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    if (data.duration) data.duration = parseInt(data.duration, 10);
    if (data.releaseDate) data.releaseDate = new Date(data.releaseDate);
    if (data.posterUrl && !data.poster) data.poster = data.posterUrl;
    if (data.poster && !data.posterUrl) data.posterUrl = data.poster;
    if (data.formats !== undefined) {
      data.formats = Array.isArray(data.formats)
        ? data.formats.map((f) => String(f).trim()).filter(Boolean)
        : typeof data.formats === 'string' && data.formats.trim()
          ? data.formats
            .split(/[,•|]+/)
            .map((f) => f.trim())
            .filter(Boolean)
          : ['2D', '3D', data.techFormat || 'IMAX'];
    }
    if (data.rating !== undefined) {
      data.rating = String(data.rating);
    }

    const updated = await Movie.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy phim để cập nhật' });
    }

    res.json({
      ...updated,
      id: updated._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật phim', error: error.message });
  }
};

// Quản lý Phim: Xóa phim
export const deleteMovie = async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(400);
  await Movie.findByIdAndUpdate(req.params.id, { status: 'ENDED' });
  await Showtime.updateMany({ movieId: req.params.id, startTime: { $gt: new Date() } }, { isLocked: true });
  return res.json({ success: true, message: 'Đã ngừng chiếu phim và bảo toàn lịch sử.' });
};

class ScheduleConflict extends Error {}

const VALID_SEAT_TYPES = new Set(['STANDARD', 'VIP', 'SWEETBOX']);

/**
 * Kiểm tra tính hợp lệ của mẫu ghế theo cấu hình phòng:
 * - Đúng tổng số ghế của phòng (ví dụ 88 ghế).
 * - Không trùng mã ghế (seatNumber) hoặc tọa độ (row, col).
 * - Nếu là phòng 88 ghế chuẩn của D'AVENOR CINEMA: phải khớp sơ đồ chuẩn A-G (12 ghế/hàng) và H (4 ghế),
 *   tuyệt đối không dùng nhầm mẫu ghế cũ 8x11 (H có 11 ghế).
 */
function isValidRoomSeatTemplate(seats = [], expectedTotalSeats = 88) {
  if (!Array.isArray(seats) || seats.length !== expectedTotalSeats || expectedTotalSeats <= 0) {
    return false;
  }
  const seenSeatNumbers = new Set();
  const seenCoords = new Set();
  const rowCounts = new Map();

  for (const s of seats) {
    const row = String(s?.row || '').trim().toUpperCase();
    const col = Number(s?.col);
    const seatNumber = String(s?.seatNumber || '').trim().toUpperCase();
    const type = String(s?.type || 'STANDARD').trim().toUpperCase();

    if (!row || !Number.isInteger(col) || col <= 0 || !seatNumber || !VALID_SEAT_TYPES.has(type)) {
      return false;
    }
    const coordKey = `${row}:${col}`;
    if (seenSeatNumbers.has(seatNumber) || seenCoords.has(coordKey)) {
      return false;
    }
    seenSeatNumbers.add(seatNumber);
    seenCoords.add(coordKey);
    rowCounts.set(row, (rowCounts.get(row) || 0) + 1);
  }

  if (expectedTotalSeats === SEAT_GRID_CONFIG.totalSeats) {
    for (const r of SEAT_GRID_CONFIG.rows) {
      const expectedRowCols = SEAT_GRID_CONFIG.rowColsMap[r];
      if (rowCounts.get(r) !== expectedRowCols) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Chuẩn bị mẫu ghế hợp lệ cho 1 phòng (chỉ đọc tối đa 1 lần, ưu tiên sơ đồ chuẩn 88 ghế đã thiết kế).
 */
async function resolveSeatTemplatesForRoom(room, session = null) {
  const expectedTotal = Number(room?.totalSeats) || SEAT_GRID_CONFIG.totalSeats;
  if (expectedTotal === SEAT_GRID_CONFIG.totalSeats) {
    const canonical88 = buildStandard88SeatTemplates();
    if (isValidRoomSeatTemplate(canonical88, expectedTotal)) {
      return canonical88;
    }
  }

  let seatTemplates = [];
  const aggQuery = ShowtimeSeat.aggregate([
    { $match: { roomId: room._id } },
    { $group: { _id: '$showtimeId', count: { $sum: 1 } } },
    { $match: { count: expectedTotal } },
    { $sort: { _id: -1 } },
    { $limit: 1 },
  ]);
  if (session) aggQuery.session(session);
  const [template] = await aggQuery;

  if (template) {
    const findQuery = ShowtimeSeat.find({ roomId: room._id, showtimeId: template._id })
      .select('row col seatNumber type')
      .lean();
    if (session) findQuery.session(session);
    const candidate = await findQuery;
    if (isValidRoomSeatTemplate(candidate, expectedTotal)) {
      seatTemplates = candidate;
    }
  }

  if (!seatTemplates.length) {
    const fallback = buildStandard88SeatTemplates();
    seatTemplates = expectedTotal === SEAT_GRID_CONFIG.totalSeats
      ? fallback
      : fallback.slice(0, expectedTotal);
  }
  return seatTemplates;
}

async function getPricingConfigReadOnly() {
  const defaultObj = {
    configKey: 'MAIN_PRICING_CONFIG',
    formats: INITIAL_PRICING_FORMATS,
    holidaySurcharge: 15000,
    note: 'Giá vé được quản lý tập trung tại Admin và đồng bộ theo thời gian thực.',
  };
  if (mongoose.connection.readyState !== 1) return defaultObj;
  try {
    const config = await TicketPricingConfig.findOne({ configKey: 'MAIN_PRICING_CONFIG' }).lean();
    return config || defaultObj;
  } catch {
    return defaultObj;
  }
}

function getCompatibleFormatsForRoom(room) {
  const canonical = resolveCanonicalRoomType(room);
  if (canonical === ROOM_TYPES_ENUM.IMAX_LASER) {
    return ['2D IMAX Laser', '3D IMAX Laser', 'IMAX Laser', 'IMAX', '2D', '3D'];
  }
  if (canonical === ROOM_TYPES_ENUM.DOLBY_ATMOS) {
    return ['2D Dolby Atmos', '3D Dolby Atmos', 'Dolby Atmos', '2D', '3D', 'Âm thanh vòm Dolby Atmos'];
  }
  if (canonical === ROOM_TYPES_ENUM.GOLD_CLASS) {
    return ['2D Gold Class VIP Lounge', 'Gold Class', '2D', 'Ghế Sofa da cao cấp'];
  }
  return ['2D Tiêu chuẩn', '2D'];
}

function isFormatCompatibleWithRoom(formatFeature, room) {
  if (!formatFeature || typeof formatFeature !== 'string' || !formatFeature.trim()) return true;
  const clean = formatFeature.trim();
  if (room?.formatFeature && clean.toLowerCase() === String(room.formatFeature).trim().toLowerCase()) {
    return true;
  }
  const canonical = resolveCanonicalRoomType(room);
  const lower = clean.toLowerCase();
  if (canonical === ROOM_TYPES_ENUM.IMAX_LASER) {
    if (lower.includes('gold class') || lower.includes('dolby atmos') || lower.includes('4dx')) return false;
    return true;
  }
  if (canonical === ROOM_TYPES_ENUM.DOLBY_ATMOS) {
    if (lower.includes('imax') || lower.includes('gold class') || lower.includes('4dx')) return false;
    return true;
  }
  if (canonical === ROOM_TYPES_ENUM.GOLD_CLASS) {
    if (lower.includes('imax') || lower.includes('dolby atmos') || lower.includes('3d') || lower.includes('4dx')) return false;
    return true;
  }
  return getCompatibleFormatsForRoom(room).some((f) => f.toLowerCase() === lower);
}

async function scheduleInRoom({ room, movie, start, price, pricing, session, formatFeature: fmtOverride, batchId, creationSource, createdBy, cleaningMinutes: customCleaning }) {
  const duration = Number(movie.duration);
  const cleaningMinutes = normalizeCleaningMinutes(customCleaning, DEFAULT_CLEANING_MINUTES);
  if (!Number.isFinite(duration) || duration <= 0) throw new ScheduleConflict('Phim chưa có thời lượng hợp lệ.');
  if (movie.status === 'ENDED') throw new ScheduleConflict('Phim đã ngừng chiếu, không thể xếp lịch.');
  if (movie.releaseDate && businessDate(start) < businessDate(movie.releaseDate)) {
    throw new ScheduleConflict('Suất chiếu sớm hơn ngày khởi chiếu.');
  }
  const cleanFmt = (typeof fmtOverride === 'string' && fmtOverride.trim()) ? fmtOverride.trim() : undefined;
  if (cleanFmt && !isFormatCompatibleWithRoom(cleanFmt, room)) {
    throw new ScheduleConflict(`Định dạng "${cleanFmt}" không tương thích với loại phòng "${room.roomType || room.name}".`);
  }
  const resolvedFormatFeature = cleanFmt ?? room.formatFeature;
  const endTime = new Date(start.getTime() + duration * 60000);
  const cleaningEndTime = new Date(endTime.getTime() + cleaningMinutes * 60000);
  const blockedUntil = cleaningEndTime.getTime();
  const now = new Date();

  const existing = await Showtime.find({
    $or: [{ roomId: room._id }, { roomId: null, cinemaId: room.cinemaId, roomName: { $in: [room.name, room.shortName].filter(Boolean) } }],
    cancelledAt: null,
  }).select('movieId startTime endTime cleaningMinutes cleaningEndTime lifecycleStatus cancelledAt').populate('movieId', 'duration').session(session).lean();
  const overlaps = existing.some(slot => {
    const slotLifecycle = computeShowtimeLifecycle(slot, now);
    if (slotLifecycle.lifecycleStatus === 'COMPLETED' || slotLifecycle.lifecycleStatus === 'CANCELLED') {
      return false;
    }
    const slotStart = slotLifecycle.startTime.getTime();
    const slotBlockedUntil = slotLifecycle.cleaningEndTime.getTime();
    // Chặn mọi va chạm với suất chiếu đang hoạt động: trùng giờ bắt đầu, bao phủ, chồng lấn một phần, hoặc thiếu thời gian dọn phòng
    return start.getTime() < slotBlockedUntil && blockedUntil > slotStart;
  });
  if (overlaps) throw new ScheduleConflict(`Khung giờ chồng lịch chiếu hoặc không đủ ${cleaningMinutes} phút dọn dẹp vệ sinh phòng.`);

  const expectedSeats = Number(room.totalSeats) || SEAT_GRID_CONFIG.totalSeats;
  const seatTemplates = await resolveSeatTemplatesForRoom(room, session);
  if (!isValidRoomSeatTemplate(seatTemplates, expectedSeats)) {
    throw new Error(`Mẫu sơ đồ ghế của phòng ${room.name} không hợp lệ (${seatTemplates.length}/${expectedSeats} ghế).`);
  }

  const calculated = calculatePricesFromConfig({
    roomName: room.name, roomType: room.roomType, formatFeature: resolvedFormatFeature, startTime: start,
  }, pricing, { preferRuleMatrix: true });
  const initialLifecycle = computeShowtimeLifecycle({
    startTime: start,
    endTime,
    cleaningMinutes,
  }, now);
  const [showtime] = await Showtime.create([{
    movieId: movie._id, cinemaId: room.cinemaId, roomId: room._id, roomName: room.name,
    formatFeature: resolvedFormatFeature, startTime: start, endTime, cleaningMinutes,
    cleaningEndTime,
    lifecycleStatus: initialLifecycle.lifecycleStatus,
    price: price ?? calculated.priceStandard,
    batchId: batchId || null,
    creationSource: creationSource || 'MANUAL',
    createdBy: createdBy || null,
  }], { session });
  const insertedSeats = await ShowtimeSeat.insertMany(seatTemplates.map(({ row, col, seatNumber, type }) => ({
    roomId: room._id, showtimeId: showtime._id, row, col, seatNumber, type, status: 'AVAILABLE',
  })), { session });
  if (!Array.isArray(insertedSeats) || insertedSeats.length !== expectedSeats) {
    throw new Error(`Không khởi tạo đủ ${expectedSeats} ghế cho suất chiếu.`);
  }
  return showtime;
}

async function lockRoom(roomId, session) {
  const room = await Room.findOneAndUpdate(
    { _id: roomId, status: 'ACTIVE' }, { $inc: { scheduleRevision: 1 } }, { returnDocument: 'after', session }
  );
  if (!room) throw new ScheduleConflict('Phòng không có hoặc đang bảo trì.');
  return room;
}

export const createShowtime = async (req, res) => {
  try {
    const { movieId, cinemaId, roomId, roomName, startTime, price, cleaningMinutes, formatFeature } = req.body;
    const timestamp = typeof startTime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startTime)
      ? startTime + ':00+07:00' : startTime;
    const start = new Date(timestamp);
    if (!mongoose.isObjectIdOrHexString(movieId) || !Number.isFinite(start.getTime()) || start <= new Date()
        || (price != null && (!Number.isSafeInteger(Number(price)) || Number(price) <= 0))) {
      return res.status(400).json({ message: 'Phim, giờ bắt đầu hoặc giá vé không hợp lệ.' });
    }
    const [movie, pricing] = await Promise.all([Movie.findById(movieId), ensurePricingConfig()]);
    if (!movie) return res.status(404).json({ message: 'Không tìm thấy phim.' });
    if (movie.status === 'ENDED') {
      return res.status(400).json({ message: 'Phim đã ngừng chiếu, không thể tạo suất chiếu.' });
    }
    let targetRoomId = roomId;
    if (targetRoomId == null && typeof roomName === 'string') {
      const matches = await Room.find({ name: roomName, ...(mongoose.isObjectIdOrHexString(cinemaId) && { cinemaId }) }).select('_id').limit(2);
      if (matches.length === 1) targetRoomId = matches[0]._id;
    }
    if (!mongoose.isObjectIdOrHexString(targetRoomId)) {
      return res.status(400).json({ message: 'Vui lòng chọn phòng vật lý.' });
    }

    const showtime = await mongoose.connection.transaction(async session => {
      const room = await lockRoom(targetRoomId, session);
      if (cinemaId && cinemaId !== 'ALL' && String(room.cinemaId) !== cinemaId) {
        throw new ScheduleConflict('Phòng không thuộc cụm rạp đã chọn.');
      }
      return scheduleInRoom({
        room,
        movie,
        start,
        price: price == null ? undefined : Number(price),
        pricing,
        session,
        cleaningMinutes,
        formatFeature,
      });
    });
    return res.status(201).json({ message: 'Đã tạo suất chiếu.', showtime });
  } catch (error) {
    if (error instanceof ScheduleConflict) return res.status(409).json({ message: error.message });
    console.error('Schedule creation failed:', error.name);
    return res.status(500).json({ message: 'Không thể tạo suất chiếu.' });
  }
};

// Quản lý Đặt vé: Danh sách đơn vé
export const getAdminBookings = async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const page = Math.min(100000, Math.max(1, parseInt(req.query.page, 10) || 1));
    const limit = 30;
    const filter = {};

    if (search) {
      filter.$or = [
        { bookingCode: { $regex: escapedSearch, $options: 'i' } },
        { customerPhone: { $regex: escapedSearch, $options: 'i' } },
        { customerName: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [rawBookings, total] = await Promise.all([Booking.find(filter)
      .select('-qrToken')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: 'showtimeId',
        populate: { path: 'movieId' },
      })
      .lean(), Booking.countDocuments(filter)]);

    const bookings = rawBookings.map((b) => {
      const showtime = b.showtimeId;
      return {
        ...b,
        id: b._id.toString(),
        showtime: showtime
          ? {
            ...showtime,
            id: showtime._id.toString(),
            movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
          }
          : null,
      };
    });

    res.json({ bookings, page, limit, total });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đặt vé', error: error.message });
  }
};

// Cập nhật trạng thái vé
export const updateBookingStatus = (_req, res) => {
  return res.status(405).json({ message: 'Trạng thái đơn thay đổi qua nghiệp vụ đặt, đổi, hủy hoặc soát vé.' });
};

// ==================== QUẢN LÝ CỤM RẠP ====================
export const getAdminCinemas = async (req, res) => {
  try {
    const cinemas = await Cinema.find().sort({ isFlagship: -1, createdAt: -1 }).lean();
    res.json(
      cinemas.map((c) => ({
        ...c,
        image: resolveCinemaImage(c.image),
        id: c._id.toString(),
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách rạp', error: error.message });
  }
};

export const createCinema = async (req, res) => {
  try {
    const { name, city, address, hotline, openingHours, parking, tags, roomCount, isFlagship, specialBadge, image } = req.body;
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-') + '-' + Date.now();

    const cinema = await Cinema.create({
      name,
      slug,
      city,
      address,
      hotline: hotline || '1900 8899',
      openingHours: openingHours || '08:30 - 24:00',
      parking: parking || 'Hầm giữ xe 24/7',
      tags: Array.isArray(tags) ? tags : ['Dolby Atmos'],
      roomCount: parseInt(roomCount, 10) || 6,
      isFlagship: !!isFlagship,
      specialBadge: specialBadge || '',
      image: image || DEFAULT_CINEMA_BANNER,
    });

    res.status(201).json({ ...cinema.toObject(), id: cinema._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thêm cụm rạp', error: error.message });
  }
};

export const updateCinema = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Cinema.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Không tìm thấy rạp' });
    res.json({ ...updated.toObject(), id: updated._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật rạp', error: error.message });
  }
};

export const deleteCinema = async (req, res) => {
  try {
    const { id } = req.params;
    const showtimes = await Showtime.find({ cinemaId: id });
    const showtimeIds = showtimes.map((s) => s._id);
    await ShowtimeSeat.deleteMany({ showtimeId: { $in: showtimeIds } });
    await Showtime.deleteMany({ cinemaId: id });
    await Cinema.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa cụm rạp thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa cụm rạp', error: error.message });
  }
};

// ==================== QUẢN LÝ SUẤT CHIẾU ====================
export const getAdminShowtimes = async (req, res) => {
  try {
    const {
      period,
      startDate,
      endDate,
      viewDate,
      cinemaId,
      movieId,
      roomId,
      roomType,
      includeCancelled,
      historyFilter,
    } = req.query;
    const filter = {};
    const now = new Date();
    const normalizedHistoryFilter = String(historyFilter || '').toUpperCase();

    const shouldQueryCancelled =
      includeCancelled === 'true' ||
      normalizedHistoryFilter === 'CANCELLED' ||
      normalizedHistoryFilter === 'ALL';

    if (!shouldQueryCancelled) {
      filter.cancelledAt = null;
    }

    if (viewDate) {
      // Khung hiển thị rạp: Từ 08:00 sáng đến 02:00 sáng hôm sau (18 tiếng)
      const timelineStart = new Date(`${viewDate}T08:00:00+07:00`);
      const timelineEnd = new Date(timelineStart.getTime() + 18 * 3600000);

      // Tra cứu phạm vi an toàn: Suất chiếu có thể giao nhau với [timelineStart, timelineEnd]
      const queryMinStart = new Date(timelineStart.getTime() - 5 * 3600000);
      filter.startTime = { $gte: queryMinStart, $lt: timelineEnd };
    } else if (startDate && endDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      filter.startTime = { $gte: s, $lte: e };
    } else if (period === 'this_week') {
      const dayOfWeek = now.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      mon.setHours(0, 0, 0, 0);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sun.setHours(23, 59, 59, 999);
      filter.startTime = { $gte: mon, $lte: sun };
    } else if (period === 'next_week') {
      const dayOfWeek = now.getDay();
      const diffToNextMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + diffToNextMon);
      nextMon.setHours(0, 0, 0, 0);
      const nextSun = new Date(nextMon);
      nextSun.setDate(nextMon.getDate() + 6);
      nextSun.setHours(23, 59, 59, 999);
      filter.startTime = { $gte: nextMon, $lte: nextSun };
    } else if (period === 'month_11') {
      const mStart = new Date(now.getFullYear(), 10, 1, 0, 0, 0, 0);
      const mEnd = new Date(now.getFullYear(), 10, 30, 23, 59, 59, 999);
      filter.startTime = { $gte: mStart, $lte: mEnd };
    } else if (period === 'month_12') {
      const mStart = new Date(now.getFullYear(), 11, 1, 0, 0, 0, 0);
      const mEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      filter.startTime = { $gte: mStart, $lte: mEnd };
    }

    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      filter.cinemaId = new mongoose.Types.ObjectId(cinemaId);
    }
    if (movieId && movieId !== 'ALL' && mongoose.Types.ObjectId.isValid(movieId)) {
      filter.movieId = new mongoose.Types.ObjectId(movieId);
    }
    if (roomId && roomId !== 'ALL' && mongoose.Types.ObjectId.isValid(roomId)) {
      filter.roomId = new mongoose.Types.ObjectId(roomId);
    }

    const queryLimit = viewDate ? 1000 : 400;
    const rawShowtimes = await Showtime.find(filter)
      .sort({ startTime: 1 })
      .populate('movieId', 'title posterUrl poster duration ageRating genre formats techFormat rating')
      .populate('cinemaId', 'name city')
      .populate('roomId', 'name shortName roomType totalSeats status formatFeature')
      .limit(queryLimit)
      .lean();

    // Tính toán trạng thái vòng đời (UPCOMING, NOW_SHOWING, CLEANING, COMPLETED, CANCELLED) theo thời gian thực
    const lifecycleById = new Map();
    const bulkSyncOps = [];
    for (const st of rawShowtimes) {
      const lifecycle = computeShowtimeLifecycle(st, now);
      lifecycleById.set(String(st._id), lifecycle);

      const storedEndMs = st.endTime ? new Date(st.endTime).getTime() : 0;
      const storedCleaningEndMs = st.cleaningEndTime ? new Date(st.cleaningEndTime).getTime() : 0;
      if (
        st.lifecycleStatus !== lifecycle.lifecycleStatus ||
        st.cleaningMinutes !== lifecycle.cleaningMinutes ||
        storedEndMs !== lifecycle.endTime.getTime() ||
        storedCleaningEndMs !== lifecycle.cleaningEndTime.getTime()
      ) {
        bulkSyncOps.push({
          updateOne: {
            filter: { _id: st._id },
            update: {
              $set: {
                lifecycleStatus: lifecycle.lifecycleStatus,
                endTime: lifecycle.endTime,
                cleaningMinutes: lifecycle.cleaningMinutes,
                cleaningEndTime: lifecycle.cleaningEndTime,
              },
            },
          },
        });
      }
    }

    if (bulkSyncOps.length > 0) {
      Showtime.bulkWrite(bulkSyncOps, { ordered: false }).catch(() => {});
    }

    // Áp dụng nguyên tắc giao nhau thời gian (Interval Intersection) khi xem theo viewDate:
    // startTime < timelineEnd && cleaningEndTime > timelineStart
    let validIntersectingShowtimes = rawShowtimes;
    if (viewDate) {
      const timelineStart = new Date(`${viewDate}T08:00:00+07:00`).getTime();
      const timelineEnd = timelineStart + 18 * 3600000; // 02:00 sáng hôm sau

      validIntersectingShowtimes = rawShowtimes.filter((st) => {
        const lc = lifecycleById.get(String(st._id)) || computeShowtimeLifecycle(st, now);
        const stStart = lc.startTime.getTime();
        const occupiedEndTime = lc.cleaningEndTime.getTime();
        return stStart < timelineEnd && occupiedEndTime > timelineStart;
      });
    }

    // Lọc theo roomType chuẩn enum nếu có yêu cầu
    let filteredList = validIntersectingShowtimes;
    if (roomType && roomType !== 'ALL') {
      filteredList = validIntersectingShowtimes.filter((st) => resolveCanonicalRoomType(st) === roomType);
    }

    const showtimeIds = filteredList.map((st) => st._id);
    const seatStats = await ShowtimeSeat.aggregate([
      { $match: { showtimeId: { $in: showtimeIds } } },
      {
        $group: {
          _id: '$showtimeId',
          totalSeats: { $sum: 1 },
          bookedSeats: {
            $sum: { $cond: [{ $eq: ['$status', 'BOOKED'] }, 1, 0] },
          },
        },
      },
    ]);

    const statsMap = new Map();
    for (const stat of seatStats) {
      statsMap.set(stat._id.toString(), stat);
    }

    // Kiểm tra xung đột (conflict detection) chỉ tính trên các suất đang hoạt động (UPCOMING / NOW_SHOWING / CLEANING)
    // Suất đã COMPLETED hoặc CANCELLED không còn chiếm phòng chiếu thực tế nên không báo xung đột giả
    const byRoom = new Map();
    for (const st of filteredList) {
      const lc = lifecycleById.get(String(st._id));
      if (!lc || !lc.isActiveSchedule) continue;
      const rKey = String(st.roomId?._id || st.roomName || 'UNKNOWN');
      if (!byRoom.has(rKey)) byRoom.set(rKey, []);
      byRoom.get(rKey).push(st);
    }

    const conflictSet = new Set();
    for (const [, rList] of byRoom.entries()) {
      rList.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      for (let i = 0; i < rList.length; i++) {
        const a = rList[i];
        const aLc = lifecycleById.get(String(a._id)) || computeShowtimeLifecycle(a, now);
        const aBlocked = aLc.cleaningEndTime.getTime();

        for (let j = i + 1; j < rList.length; j++) {
          const b = rList[j];
          if (new Date(b.startTime).getTime() >= aBlocked) break;
          conflictSet.add(String(a._id));
          conflictSet.add(String(b._id));
        }
      }
    }

    let showtimes = filteredList.map((st) => {
      const stat = statsMap.get(st._id.toString());
      const hasConflict = conflictSet.has(st._id.toString());
      const lc = lifecycleById.get(String(st._id)) || computeShowtimeLifecycle(st, now);
      const stStart = lc.startTime.getTime();
      const occupiedEndTime = lc.cleaningEndTime.getTime();

      let timelineCategory = 'DAY_SHOWTIME';
      if (viewDate) {
        const dayStart = new Date(`${viewDate}T00:00:00+07:00`).getTime();
        const dayEnd = new Date(`${viewDate}T23:59:59.999+07:00`).getTime();
        if (stStart < dayStart) {
          timelineCategory = 'OVERNIGHT_PRIOR';
        } else if (occupiedEndTime > dayEnd) {
          timelineCategory = 'OVERNIGHT_NEXT';
        }
      }

      return {
        ...st,
        id: st._id.toString(),
        movie: st.movieId,
        cinema: st.cinemaId,
        room: st.roomId,
        endTime: lc.endTime.toISOString(),
        cleaningMinutes: lc.cleaningMinutes,
        cleaningEndTime: lc.cleaningEndTime.toISOString(),
        occupiedEndTime: lc.cleaningEndTime.toISOString(),
        lifecycleStatus: lc.lifecycleStatus,
        isActiveSchedule: lc.isActiveSchedule,
        totalSeats: stat?.totalSeats ?? null,
        bookedSeats: stat?.bookedSeats || 0,
        availableSeats: stat?.totalSeats ? Math.max(0, stat.totalSeats - (stat.bookedSeats || 0)) : null,
        timelineCategory,
        hasConflict,
      };
    });

    if (normalizedHistoryFilter === 'ACTIVE') {
      showtimes = showtimes.filter((st) => st.isActiveSchedule);
    } else if (normalizedHistoryFilter === 'COMPLETED') {
      showtimes = showtimes.filter((st) => st.lifecycleStatus === 'COMPLETED');
    } else if (normalizedHistoryFilter === 'CANCELLED') {
      showtimes = showtimes.filter((st) => st.lifecycleStatus === 'CANCELLED');
    }

    res.json(showtimes);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách suất chiếu', error: error.message });
  }
};

// Gợi ý khung giờ trống không chồng lấn và tương thích phòng cho Admin
export const getAvailableShowtimeSlots = async (req, res) => {
  try {
    const { roomId, movieId, date, cleaningMinutes: queryCleaning } = req.query;
    if (!roomId || !movieId || !date) {
      return res.status(400).json({ message: 'Vui lòng cung cấp roomId, movieId và date (YYYY-MM-DD).' });
    }

    const [room, movie] = await Promise.all([
      Room.findById(roomId).lean(),
      Movie.findById(movieId).lean(),
    ]);

    if (!room) return res.status(404).json({ message: 'Phòng không tồn tại.' });
    if (!movie) return res.status(404).json({ message: 'Phim không tồn tại.' });

    if (room.status === 'MAINTENANCE') {
      return res.json({
        roomStatus: 'MAINTENANCE',
        message: 'Phòng đang bảo trì, không thể xếp lịch.',
        availableSlots: [],
        alternativeRooms: [],
      });
    }

    const duration = Number(movie.duration) || 120;
    const cleaningMinutes = normalizeCleaningMinutes(queryCleaning, DEFAULT_CLEANING_MINUTES);
    const totalSlotMinutes = duration + cleaningMinutes;
    const now = new Date();

    // Tìm các suất chiếu đã có trong ngày đó
    const dayStart = new Date(`${date}T00:00:00+07:00`);
    const dayEnd = new Date(`${date}T23:59:59.999+07:00`);
    const lookbackStart = new Date(dayStart.getTime() - 4 * 3600000);
    const lookaheadEnd = new Date(dayEnd.getTime() + 4 * 3600000);

    const existing = await Showtime.find({
      roomId: room._id,
      cancelledAt: null,
      startTime: { $gte: lookbackStart, $lte: lookaheadEnd },
    }).populate('movieId', 'duration').lean();

    const occupiedIntervals = existing
      .map(slot => computeShowtimeLifecycle(slot, now))
      .filter(lc => lc.isActiveSchedule)
      .map(lc => ({
        start: lc.startTime.getTime(),
        end: lc.cleaningEndTime.getTime(),
      }));

    const availableSlots = [];
    const CLOSE_LIMIT_MIN = 26 * 60; // 02:00 sáng hôm sau

    // Khung giờ rạp mở suất từ 08:00 đến 22:30 (bước 15 phút), kết thúc + vệ sinh trước 02:00 (+1 ngày) theo múi giờ Việt Nam (+07:00)
    for (let hour = 8; hour <= 22; hour++) {
      for (const minute of [0, 15, 30, 45]) {
        if (hour === 22 && minute > 30) continue;

        const startMin = hour * 60 + minute;
        if (startMin + totalSlotMinutes > CLOSE_LIMIT_MIN) continue;

        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        const candidateStart = new Date(`${date}T${hh}:${mm}:00+07:00`);
        const candidateStartTime = candidateStart.getTime();
        const candidateEndTime = candidateStartTime + totalSlotMinutes * 60000;

        if (candidateStartTime <= Date.now()) continue;

        const isColliding = occupiedIntervals.some(occ =>
          candidateStartTime < occ.end && candidateEndTime > occ.start
        );

        if (!isColliding) {
          availableSlots.push(`${hh}:${mm}`);
        }
      }
    }

    let alternativeRooms = [];
    if (availableSlots.length === 0) {
      alternativeRooms = await Room.find({
        _id: { $ne: room._id },
        roomType: room.roomType,
        status: 'ACTIVE',
      }).select('name roomType formatFeature totalSeats').lean();
    }

    res.json({
      success: true,
      roomId: room._id,
      roomName: room.name,
      roomType: room.roomType,
      movieId: movie._id,
      movieTitle: movie.title,
      duration,
      cleaningMinutes,
      totalSlotMinutes,
      availableSlots,
      alternativeRooms,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tìm khung giờ trống', error: error.message });
  }
};

// Helper định dạng phút từ 00:00 của ngày đang xét sang chuỗi HH:mm (kèm +1 ngày nếu >= 24:00)
function formatMinutesToVNTime(totalMinutes, includeNextDayTag = false) {
  const isNextDay = totalMinutes >= 1440;
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');
  return includeNextDayTag && isNextDay ? `${hh}:${mm} (+1 ngày)` : `${hh}:${mm}`;
}

function parseHHMMToMinutes(timeStr, fallbackMinutes) {
  if (typeof timeStr !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeStr.trim())) {
    return fallbackMinutes;
  }
  const [h, m] = timeStr.trim().split(':').map(Number);
  return h * 60 + m;
}

/**
 * Xây dựng các mốc giờ ưu tiên (preferred anchors) phân bổ đều trong ngày vận hành (Sáng - Trưa - Chiều - Tối - Đêm)
 * dựa trên số suất mong muốn mỗi phòng (1..8) và khoảng [firstStartMin..userLatestStartMin].
 * - Khi desiredCount = 5 và khung mặc định [09:30..22:30]: trả về đúng 5 mốc mẫu [09:30, 12:45, 16:00, 19:15, 22:30].
 */
function buildPreferredDayAnchors(desiredCount, firstStartMin, userLatestStartMin) {
  if (desiredCount <= 1) return [firstStartMin];
  if (
    desiredCount === 5 &&
    firstStartMin === 9 * 60 + 30 &&
    userLatestStartMin === 22 * 60 + 30
  ) {
    return [9 * 60 + 30, 12 * 60 + 45, 16 * 60, 19 * 60 + 15, 22 * 60 + 30];
  }
  const span = Math.max(0, userLatestStartMin - firstStartMin);
  const step = span / (desiredCount - 1);
  const anchors = [];
  for (let i = 0; i < desiredCount; i++) {
    const raw = firstStartMin + i * step;
    const rounded5 = Math.round(raw / 5) * 5;
    anchors.push(Math.min(userLatestStartMin, Math.max(firstStartMin, rounded5)));
  }
  return anchors;
}

/**
 * Bộ lập kế hoạch xếp lịch chiếu hàng loạt dùng chung 100% giữa Preview và Confirm.
 * Quy tắc nghiêm ngặt:
 * 1. Giờ mở cửa: 08:00, suất đầu mặc định: 09:30, suất cuối bắt đầu muộn nhất: 22:30, đóng cửa: 02:00 sáng hôm sau.
 * 2. Sau 22:30 tuyệt đối không tạo thêm suất chiếu mới cho ngày vận hành đó.
 * 3. Các suất bắt đầu <= 22:30 được phép chiếu qua 00:00 nếu kết thúc phim + vệ sinh <= 02:00 sáng hôm sau.
 * 4. Khi giờ phòng sẵn sàng cho suất kế tiếp > 22:30 (VD: hoàn thành lúc 01:36 hôm sau), dừng ngay vòng lặp của ngày đó,
 *    TUYỆT ĐỐI KHÔNG tạo suất ảo lúc 01:35/01:36 để đưa vào conflictSlots.
 * 5. Tách biệt rõ:
 *    - validSlots: Các suất chiếu hợp lệ sẽ được tạo.
 *    - conflictSlots: Chỉ chứa các xung đột chồng lấn thời gian thực sự trong cùng một Room ID.
 *    - unallocatedCount / roomDaySummaries: Số suất không đủ quỹ thời gian để bố trí so với số suất mong muốn.
 */
function planBatchSchedule({
  roomsInOrder,
  moviesInOrder,
  startMsDay,
  endMsDay,
  scheduleMode = 'smart',
  firstShowtimeTime = '09:30',
  latestStartTime = '22:30',
  targetSlotsPerRoom = 5,
  cleaningMinutes = 20,
  optimizeMaxSlots = false,
  staggerRooms = true,
  timeSlots = [],
  existingShowtimes = [],
  pricingConfig = null,
  now = new Date(),
}) {
  const DAY_MS = 86400000;
  const OPEN_MINUTES = 8 * 60; // 08:00
  const CLOSE_MINUTES = 26 * 60; // 02:00 sáng hôm sau (1560 phút tính từ 00:00 ngày vận hành)
  const HARD_LATEST_START_MINUTES = 22 * 60 + 30; // 22:30 (1350 phút)

  const cleanMin = normalizeCleaningMinutes(cleaningMinutes, DEFAULT_CLEANING_MINUTES);
  const firstStartMin = Math.max(
    OPEN_MINUTES,
    Math.min(HARD_LATEST_START_MINUTES, parseHHMMToMinutes(firstShowtimeTime, 9 * 60 + 30))
  );
  const userLatestStartMin = Math.max(
    firstStartMin,
    Math.min(HARD_LATEST_START_MINUTES, parseHHMMToMinutes(latestStartTime, HARD_LATEST_START_MINUTES))
  );

  // Chế độ số lượng suất loại trừ lẫn nhau:
  // - optimizeMaxSlots = false (Mặc định): Xếp theo số suất mong muốn (targetSlotsPerRoom, mặc định 5, không vượt số suất đã chọn)
  // - optimizeMaxSlots = true: Tối ưu số suất tối đa trong khung giờ hoạt động
  const isOptimizeMax = Boolean(optimizeMaxSlots);
  const desiredCount = Math.max(1, Math.min(8, Number(targetSlotsPerRoom) || 5));
  const maxSlotsCap = isOptimizeMax ? 10 : desiredCount;
  const nowMs = now.getTime();

  const totalDays = Math.max(1, Math.round((endMsDay - startMsDay) / DAY_MS) + 1);
  const avgMovieDuration =
    moviesInOrder.reduce((sum, m) => sum + (Number(m.duration) || 120), 0) /
    Math.max(1, moviesInOrder.length);

  // Gom các khoảng thời gian đã bị chiếm bởi suất chiếu hiện có trong DB theo từng Room ID độc lập
  // Loại trừ suất đã hủy (cancelledAt != null) và suất đã hoàn thành (COMPLETED)
  const dbOccupiedByRoom = new Map();
  for (const s of existingShowtimes) {
    if (s.cancelledAt) continue;
    const lc = computeShowtimeLifecycle(s, now);
    if (lc.lifecycleStatus === 'COMPLETED' || lc.lifecycleStatus === 'CANCELLED') continue;
    const rId = String(s.roomId?._id || s.roomId || '');
    if (!rId) continue;
    if (!dbOccupiedByRoom.has(rId)) dbOccupiedByRoom.set(rId, []);
    const sStart = lc.startTime.getTime();
    const sCleanEnd = lc.cleaningEndTime.getTime();
    const sTimeLabel = lc.startTime.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    dbOccupiedByRoom.get(rId).push({
      start: sStart,
      end: sCleanEnd,
      movieEnd: lc.endTime.getTime(),
      label: `${sTimeLabel} (${s.movieId?.title || 'Suất hiện có'})`,
      isExisting: true,
    });
  }

  const validSlots = [];
  const conflictSlots = [];
  const allSlots = [];
  const roomDaySummaries = [];
  let requestedTotalSlots = 0;
  let unallocatedCount = 0;

  for (let roomIndex = 0; roomIndex < roomsInOrder.length; roomIndex++) {
    const room = roomsInOrder[roomIndex];
    const roomIdStr = String(room._id);
    const canonicalRoomType = resolveCanonicalRoomType(room);
    const roomTotalSeats = Number(room.totalSeats) || 88;

    // Danh sách khoảng chiếm phòng của riêng Room ID này (bản sao độc lập cho từng phòng)
    const roomOcc = [...(dbOccupiedByRoom.get(roomIdStr) || [])].sort((a, b) => a.start - b.start);

    let dayIndex = 0;
    for (let dayEpoch = startMsDay; dayEpoch <= endMsDay; dayEpoch += DAY_MS, dayIndex++) {
      const dateStr = businessDate(new Date(dayEpoch));
      const dayMidnightMs = new Date(`${dateStr}T00:00:00+07:00`).getTime();

      if (room.status === 'MAINTENANCE') {
        const reqForDay = isOptimizeMax ? 0 : desiredCount;
        requestedTotalSlots += reqForDay;
        unallocatedCount += reqForDay;
        roomDaySummaries.push({
          date: dateStr,
          roomId: roomIdStr,
          roomName: room.name,
          roomType: canonicalRoomType,
          requestedSlots: isOptimizeMax ? null : desiredCount,
          allocatedSlots: 0,
          conflictCount: 0,
          unallocatedSlots: reqForDay,
          note: 'Phòng đang bảo trì (MAINTENANCE).',
        });
        continue;
      }

      if (scheduleMode === 'manual') {
        // ── CHẾ ĐỘ B: TÙY CHỈNH KHUNG GIỜ ──
        requestedTotalSlots += timeSlots.length;
        let manualAllocated = 0;
        let manualConflicts = 0;
        let manualUnallocated = 0;

        for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
          const timeStr = timeSlots[slotIndex];
          const slotStartMin = parseHHMMToMinutes(timeStr, -1);
          const movie = moviesInOrder[(roomIndex + dayIndex + slotIndex) % moviesInOrder.length];
          const dur = Number(movie.duration) || 120;

          if (slotStartMin < 0) {
            manualUnallocated++;
            unallocatedCount++;
            continue;
          }

          const startMs = dayMidnightMs + slotStartMin * 60000;
          const endMin = slotStartMin + dur;
          const cleanEndMin = endMin + cleanMin;
          const readyMin = Math.ceil(cleanEndMin / 5) * 5;
          const endMs = startMs + dur * 60000;
          const cleanEndMs = endMs + cleanMin * 60000;
          const readyMs = dayMidnightMs + readyMin * 60000;

          const calculatedPrices = calculatePricesFromConfig(
            {
              roomName: room.name,
              roomType: canonicalRoomType,
              formatFeature: room.formatFeature,
              startTime: new Date(startMs),
            },
            pricingConfig
          );

          const baseSlotInfo = {
            date: dateStr,
            roomId: roomIdStr,
            roomName: room.name,
            roomNumber: room.roomNumber,
            roomType: canonicalRoomType,
            movieId: String(movie._id),
            movieTitle: movie.title,
            duration: dur,
            time: formatMinutesToVNTime(slotStartMin, false),
            startTimeText: formatMinutesToVNTime(slotStartMin, false),
            endTimeText: formatMinutesToVNTime(endMin, true),
            cleaningMinutes: cleanMin,
            cleaningEndTimeText: formatMinutesToVNTime(cleanEndMin, true),
            readyTimeText: formatMinutesToVNTime(readyMin, true),
            startTime: new Date(startMs).toISOString(),
            endTime: new Date(endMs).toISOString(),
            cleaningEndTime: new Date(cleanEndMs).toISOString(),
            readyTime: new Date(readyMs).toISOString(),
            price: calculatedPrices.priceStandard,
            priceStandard: calculatedPrices.priceStandard,
            priceVip: calculatedPrices.priceVip,
            priceSweetbox: calculatedPrices.priceSweetbox,
            totalSeats: roomTotalSeats,
          };

          // 1. Kiểm tra chồng lấn thời gian thực sự trong cùng Room ID
          const colliding = roomOcc.find((occ) => startMs < occ.end && cleanEndMs > occ.start);
          if (colliding) {
            manualConflicts++;
            const cSlot = {
              ...baseSlotInfo,
              status: 'CONFLICT',
              reason: `Trùng lịch trong cùng phòng với suất ${colliding.label}.`,
            };
            conflictSlots.push(cSlot);
            allSlots.push(cSlot);
            continue;
          }

          // 2. Kiểm tra giới hạn giờ hoạt động (08:00 - 22:30, kết thúc + vệ sinh <= 02:00 hôm sau) và thời gian quá khứ
          if (
            slotStartMin < OPEN_MINUTES ||
            slotStartMin > HARD_LATEST_START_MINUTES ||
            cleanEndMin > CLOSE_MINUTES ||
            startMs <= nowMs ||
            (movie.releaseDate && dateStr < businessDate(movie.releaseDate))
          ) {
            manualUnallocated++;
            unallocatedCount++;
            continue;
          }

          // 3. Hợp lệ
          const vSlot = { ...baseSlotInfo, status: 'VALID', reason: null };
          validSlots.push(vSlot);
          allSlots.push(vSlot);
          manualAllocated++;
          roomOcc.push({
            start: startMs,
            end: cleanEndMs,
            movieEnd: endMs,
            label: `${baseSlotInfo.startTimeText} (${movie.title})`,
          });
        }

        roomDaySummaries.push({
          date: dateStr,
          roomId: roomIdStr,
          roomName: room.name,
          roomType: canonicalRoomType,
          requestedSlots: timeSlots.length,
          allocatedSlots: manualAllocated,
          conflictCount: manualConflicts,
          unallocatedSlots: manualUnallocated,
          note:
            manualUnallocated > 0
              ? `Có ${manualUnallocated} khung giờ vượt giới hạn 22:30 / 02:00 (+1 ngày) hoặc đã qua.`
              : null,
        });
      } else {
        // ── CHẾ ĐỘ A: XẾP LỊCH THÔNG MINH (SMART MODE) ──
        // Mỗi Room ID và mỗi ngày vận hành có biến thời gian độc lập, khởi tạo lại từ firstStartMin
        const singleMovieStaggerOffset =
          staggerRooms && moviesInOrder.length === 1 && roomIndex > 0 && firstStartMin + (roomIndex % 3) * 10 <= userLatestStartMin
            ? (roomIndex % 3) * 10
            : 0;
        let cursorMin = firstStartMin + singleMovieStaggerOffset;

        // Nếu xếp cho ngày hôm nay và giờ hiện tại đã qua cursorMin, đẩy lên mốc 5 phút tiếp theo
        const nowOffsetMin = Math.ceil((nowMs - dayMidnightMs + 60000) / 60000);
        if (nowOffsetMin > cursorMin) {
          cursorMin = Math.ceil(nowOffsetMin / 5) * 5;
        }

        // Xây dựng các mốc ưu tiên cân đối trong ngày (09:30, 12:45, 16:00, 19:15, 22:30) khi ở chế độ Xếp theo số suất mong muốn
        const preferredAnchors = !isOptimizeMax
          ? buildPreferredDayAnchors(desiredCount, firstStartMin + singleMovieStaggerOffset, userLatestStartMin)
          : [];

        let placedInRoomDay = 0;
        let rotationStep = 0;
        let stopReason = null;

        while (placedInRoomDay < maxSlotsCap && rotationStep < maxSlotsCap + 8) {
          // Điều kiện dừng 1: Giờ phòng sẵn sàng đã vượt quá giới hạn mở suất cuối (22:30 hoặc userLatestStartMin)
          if (cursorMin > userLatestStartMin || cursorMin > HARD_LATEST_START_MINUTES) {
            stopReason = `Phòng hoàn thành vệ sinh sau ${formatMinutesToVNTime(userLatestStartMin, false)}, dừng mở suất mới trong ngày.`;
            break;
          }

          const primaryIdx = (roomIndex + dayIndex + rotationStep) % moviesInOrder.length;
          rotationStep++;

          // Xác định mốc bắt đầu mục tiêu (kết hợp giữa cursorMin sẵn sàng và mốc ưu tiên cân đối trong ngày)
          let targetStartMin = cursorMin;
          if (!isOptimizeMax && placedInRoomDay < preferredAnchors.length) {
            const anchorMin = preferredAnchors[placedInRoomDay];
            const remainingSlotsAfterThis = Math.max(0, desiredCount - placedInRoomDay - 1);
            const estimatedMinutesForRest = Math.ceil(
              remainingSlotsAfterThis * (avgMovieDuration + cleanMin + 5)
            );
            const primaryMovieDur = Number(moviesInOrder[primaryIdx]?.duration) || 120;
            // Giới hạn trễ nhất của suất hiện tại để các suất còn lại vẫn kịp bắt đầu trước hoặc đúng userLatestStartMin
            const latestToFitRemaining =
              remainingSlotsAfterThis > 0
                ? Math.floor((userLatestStartMin - estimatedMinutesForRest) / 5) * 5
                : userLatestStartMin;

            // Chỉ kéo giờ về phía mốc anchor nếu vẫn đảm bảo đủ quỹ giờ cho các suất phía sau và không vượt giới hạn đóng cửa 02:00
            const maxStartForPrimary = Math.min(
              userLatestStartMin,
              HARD_LATEST_START_MINUTES,
              Math.floor((CLOSE_MINUTES - primaryMovieDur - cleanMin) / 5) * 5
            );
            const feasibleAnchor = Math.min(anchorMin, latestToFitRemaining, maxStartForPrimary);
            targetStartMin = Math.max(cursorMin, feasibleAnchor);
          }

          // Thử chọn bộ phim phù hợp tại vị trí targetStartMin (ưu tiên phim đến lượt luân phiên; nếu quá dài vượt 02:00 thì tìm phim khác trong danh sách Admin đã chọn)
          let selectedPlan = null;

          for (let offset = 0; offset < moviesInOrder.length; offset++) {
            const candidateMovie = moviesInOrder[(primaryIdx + offset) % moviesInOrder.length];
            const candidateDur = Number(candidateMovie.duration) || 120;

            if (candidateMovie.releaseDate && dateStr < businessDate(candidateMovie.releaseDate)) {
              continue;
            }

            // Giờ bắt đầu muộn nhất cho phép của bộ phim này để kết thúc + vệ sinh <= 02:00 sáng hôm sau
            const maxAllowedStartForMovie = Math.min(
              userLatestStartMin,
              HARD_LATEST_START_MINUTES,
              Math.floor((CLOSE_MINUTES - candidateDur - cleanMin) / 5) * 5
            );

            if (cursorMin > maxAllowedStartForMovie) {
              // Ngay cả khi bắt đầu ngay lúc phòng vừa dọn xong (cursorMin), bộ phim này vẫn vượt 22:30 hoặc vượt 02:00
              continue;
            }

            // Nếu targetStartMin (do neo theo mốc 22:30) làm phim dài (VD 192p) vượt 02:00, tự động kéo giờ bắt đầu sớm hơn về maxAllowedStartForMovie (VD 22:20/22:25) miễn là >= cursorMin
            let candStartMin = Math.min(targetStartMin, maxAllowedStartForMovie);
            candStartMin = Math.max(cursorMin, candStartMin);

            // Kiểm tra và trượt qua các suất chiếu đã tồn tại trong cùng phòng (chỉ tính những suất nằm trong ngày vận hành này)
            let bumped = true;
            let guard = 0;
            while (bumped && guard < 20) {
              bumped = false;
              guard++;
              const sMs = dayMidnightMs + candStartMin * 60000;
              const cEndMs = sMs + (candidateDur + cleanMin) * 60000;
              const hit = roomOcc.find((occ) => sMs < occ.end && cEndMs > occ.start);
              if (hit) {
                const hitEndMin = Math.ceil((hit.end - dayMidnightMs) / 60000);
                candStartMin = Math.max(candStartMin + 5, Math.ceil(hitEndMin / 5) * 5);
                bumped = true;
              }
            }

            const candEndMin = candStartMin + candidateDur;
            const candCleanEndMin = candEndMin + cleanMin;

            // Kiểm tra 4 điều kiện bắt buộc trước khi chấp nhận:
            // 1. candStartMin <= 22:30 (và <= userLatestStartMin)
            // 2. candCleanEndMin <= 02:00 hôm sau (CLOSE_MINUTES = 1560)
            // 3. Không trùng lịch DB trong cùng phòng
            // 4. Không trùng suất vừa đề xuất trong cùng phòng
            if (
              candStartMin <= maxAllowedStartForMovie &&
              candStartMin <= HARD_LATEST_START_MINUTES &&
              candCleanEndMin <= CLOSE_MINUTES
            ) {
              selectedPlan = {
                movie: candidateMovie,
                dur: candidateDur,
                startMin: candStartMin,
                endMin: candEndMin,
                cleanEndMin: candCleanEndMin,
                readyMin: Math.ceil(candCleanEndMin / 5) * 5,
              };
              break;
            }
          }

          // Nếu không còn bộ phim nào trong danh sách Admin chọn có thể xếp vừa trước 22:30 / 02:00 -> DỪNG NGAY, không tạo suất ảo!
          if (!selectedPlan) {
            stopReason =
              'Không còn bộ phim nào đã chọn có thể kết thúc chiếu và vệ sinh phòng trước giờ đóng cửa 02:00 (+1 ngày) hoặc trước giới hạn mở suất cuối 22:30.';
            break;
          }

          const { movie: chosenMovie, dur: chosenDur, startMin, endMin, cleanEndMin, readyMin } = selectedPlan;
          const startMs = dayMidnightMs + startMin * 60000;
          const endMs = startMs + chosenDur * 60000;
          const cleanEndMs = endMs + cleanMin * 60000;
          const readyMs = dayMidnightMs + readyMin * 60000;

          const calculatedPrices = calculatePricesFromConfig(
            {
              roomName: room.name,
              roomType: canonicalRoomType,
              formatFeature: room.formatFeature,
              startTime: new Date(startMs),
            },
            pricingConfig
          );

          const validItem = {
            date: dateStr,
            roomId: roomIdStr,
            roomName: room.name,
            roomNumber: room.roomNumber,
            roomType: canonicalRoomType,
            movieId: String(chosenMovie._id),
            movieTitle: chosenMovie.title,
            duration: chosenDur,
            time: formatMinutesToVNTime(startMin, false),
            startTimeText: formatMinutesToVNTime(startMin, false),
            endTimeText: formatMinutesToVNTime(endMin, true),
            cleaningMinutes: cleanMin,
            cleaningEndTimeText: formatMinutesToVNTime(cleanEndMin, true),
            readyTimeText: formatMinutesToVNTime(readyMin, true),
            startTime: new Date(startMs).toISOString(),
            endTime: new Date(endMs).toISOString(),
            cleaningEndTime: new Date(cleanEndMs).toISOString(),
            readyTime: new Date(readyMs).toISOString(),
            price: calculatedPrices.priceStandard,
            priceStandard: calculatedPrices.priceStandard,
            priceVip: calculatedPrices.priceVip,
            priceSweetbox: calculatedPrices.priceSweetbox,
            totalSeats: roomTotalSeats,
            status: 'VALID',
            reason: null,
          };

          validSlots.push(validItem);
          allSlots.push(validItem);
          roomOcc.push({
            start: startMs,
            end: cleanEndMs,
            movieEnd: endMs,
            label: `${validItem.startTimeText} (${chosenMovie.title})`,
          });

          placedInRoomDay++;
          cursorMin = readyMin;

          // Điều kiện dừng 2: Ngay sau khi xếp xong 1 suất, nếu giờ phòng sẵn sàng (cursorMin) đã vượt quá 22:30 -> dừng luôn cho ngày vận hành này
          if (cursorMin > userLatestStartMin || cursorMin > HARD_LATEST_START_MINUTES) {
            stopReason = `Suất cuối kết thúc vệ sinh lúc ${validItem.cleaningEndTimeText} (sau giới hạn mở suất 22:30), hoàn tất lịch trong ngày.`;
            break;
          }
        }

        const reqForRoomDay = isOptimizeMax ? placedInRoomDay : desiredCount;
        const shortfall = isOptimizeMax ? 0 : Math.max(0, desiredCount - placedInRoomDay);
        requestedTotalSlots += reqForRoomDay;
        unallocatedCount += shortfall;

        roomDaySummaries.push({
          date: dateStr,
          roomId: roomIdStr,
          roomName: room.name,
          roomType: canonicalRoomType,
          requestedSlots: isOptimizeMax ? null : desiredCount,
          allocatedSlots: placedInRoomDay,
          conflictCount: 0,
          unallocatedSlots: shortfall,
          note:
            shortfall > 0
              ? stopReason || `Chỉ đủ thời gian bố trí ${placedInRoomDay}/${desiredCount} suất trước 22:30 / 02:00 (+1 ngày).`
              : null,
        });
      }
    }
  }

  const validSignature = validSlots
    .map((s) => `${s.roomId}|${s.movieId}|${s.startTime}|${s.cleaningMinutes}`)
    .join(';');

  let allocationSummaryText = '';
  if (scheduleMode === 'smart' && isOptimizeMax) {
    allocationSummaryText = `Chế độ tối ưu tối đa: Đã bố trí ${validSlots.length} suất hợp lệ trên ${roomsInOrder.length} phòng trong ${totalDays} ngày.`;
  } else if (unallocatedCount > 0) {
    allocationSummaryText = `Đã bố trí ${validSlots.length}/${requestedTotalSlots} suất. Có ${unallocatedCount} suất không đủ thời gian để bố trí.`;
  } else {
    allocationSummaryText = `Đã bố trí đủ ${validSlots.length}/${requestedTotalSlots} suất hợp lệ theo yêu cầu.`;
  }

  return {
    scheduleMode,
    slotAllocationMode: isOptimizeMax ? 'MAX' : 'TARGET',
    optimizeMaxSlots: isOptimizeMax,
    targetSlotsPerRoom: isOptimizeMax ? null : desiredCount,
    cleaningMinutes: cleanMin,
    totalDays,
    selectedMoviesCount: moviesInOrder.length,
    selectedRoomsCount: roomsInOrder.length,
    requestedTotalSlots,
    validCount: validSlots.length,
    conflictCount: conflictSlots.length,
    unallocatedCount,
    allocationSummaryText,
    roomDaySummaries,
    validSlots,
    conflictSlots,
    allSlots,
    validSignature,
  };
}

// Xếp lịch chiếu phim hàng loạt thông minh (Smart & Manual) cho Admin
export const batchScheduleShowtimes = async (req, res) => {
  try {
    const {
      roomIds,
      startDate,
      endDate,
      movieIds,
      timeSlots,
      preview,
      scheduleMode: rawMode,
      firstShowtimeTime = '09:30',
      latestStartTime = '22:30',
      targetSlotsPerRoom = 5,
      cleaningMinutes: rawCleaning = 20,
      optimizeMaxSlots = false,
      staggerRooms = true,
      expectedValidCount,
      expectedSignature,
    } = req.body;

    const day = 86400000;
    const start = new Date(startDate + 'T00:00:00+07:00');
    const end = new Date(endDate + 'T00:00:00+07:00');

    // Xác định chế độ xếp lịch: nếu client truyền scheduleMode thì dùng scheduleMode;
    // nếu không truyền nhưng có mảng timeSlots (tương thích ngược với test cũ) thì dùng 'manual', ngược lại 'smart'
    const scheduleMode =
      rawMode === 'smart' || rawMode === 'manual'
        ? rawMode
        : Array.isArray(timeSlots) && timeSlots.length > 0
        ? 'manual'
        : 'smart';

    if (
      !Number.isFinite(+start) ||
      !Number.isFinite(+end) ||
      start > end ||
      +end - +start > 30 * day ||
      businessDate(start) !== startDate ||
      businessDate(end) !== endDate ||
      !Array.isArray(roomIds) ||
      !roomIds.length ||
      !roomIds.every(mongoose.isObjectIdOrHexString) ||
      !Array.isArray(movieIds) ||
      !movieIds.length ||
      !movieIds.every(mongoose.isObjectIdOrHexString)
    ) {
      return res.status(400).json({ message: 'Vui lòng chọn đầy đủ ngày hợp lệ, ít nhất 1 bộ phim và ít nhất 1 phòng chiếu.' });
    }

    let normalizedTimeSlots = [];
    if (scheduleMode === 'manual') {
      if (
        !Array.isArray(timeSlots) ||
        !timeSlots.length ||
        !timeSlots.every((time) => typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time.trim()))
      ) {
        return res.status(400).json({ message: 'Chế độ tùy chỉnh yêu cầu ít nhất 1 khung giờ hợp lệ (HH:mm).' });
      }
      const trimmed = timeSlots.map((t) => t.trim());
      if (new Set(trimmed).size !== trimmed.length) {
        return res.status(400).json({ message: 'Danh sách khung giờ tùy chỉnh không được chứa khung giờ trùng lặp.' });
      }
      normalizedTimeSlots = [...trimmed].sort((a, b) => parseHHMMToMinutes(a, 0) - parseHHMMToMinutes(b, 0));
    }

    const uniqueRoomIds = [...new Set(roomIds.map(String))];
    const uniqueMovieIds = [...new Set(movieIds.map(String))];

    const [moviesFromDb, roomsFromDb, pricing] = await Promise.all([
      Movie.find({ _id: { $in: uniqueMovieIds } }).lean(),
      Room.find({ _id: { $in: uniqueRoomIds } }).lean(),
      ensurePricingConfig(),
    ]);

    if (moviesFromDb.length !== uniqueMovieIds.length) {
      return res.status(404).json({ message: 'Một số phim đã chọn không tồn tại trong cơ sở dữ liệu.' });
    }
    if (roomsFromDb.length !== uniqueRoomIds.length) {
      return res.status(404).json({ message: 'Một số phòng chiếu đã chọn không tồn tại trong cơ sở dữ liệu.' });
    }

    // Giữ đúng thứ tự phim Admin đã tích chọn
    const movieById = new Map(moviesFromDb.map((m) => [String(m._id), m]));
    const moviesInOrder = uniqueMovieIds.map((id) => movieById.get(id)).filter(Boolean);

    // Sắp xếp phòng vật lý theo đúng thứ tự Phòng 01 -> 09 (IMAX Laser -> Dolby Atmos -> Gold Class)
    const roomTypeOrder = { 'IMAX Laser': 1, 'Dolby Atmos': 2, 'Gold Class': 3 };
    const roomsInOrder = [...roomsFromDb].sort((a, b) => {
      const tA = roomTypeOrder[resolveCanonicalRoomType(a)] || 99;
      const tB = roomTypeOrder[resolveCanonicalRoomType(b)] || 99;
      if (tA !== tB) return tA - tB;
      return (a.roomNumber || 0) - (b.roomNumber || 0) || String(a.name || '').localeCompare(String(b.name || ''));
    });

    const cleaningMinutes = normalizeCleaningMinutes(rawCleaning, DEFAULT_CLEANING_MINUTES);
    const now = new Date();

    // 1. NHÁNH PREVIEW: Không ghi vào MongoDB, trả về chi tiết toàn bộ suất dự kiến và xung đột
    const roomNamesForLegacyMatch = roomsInOrder
      .flatMap((r) => [r.name, r.shortName])
      .filter(Boolean);
    const cinemaIdsForLegacyMatch = [
      ...new Set(roomsInOrder.map((r) => String(r.cinemaId || '')).filter(mongoose.isObjectIdOrHexString)),
    ];
    const existingShowtimeFilter = {
      $or: [
        { roomId: { $in: uniqueRoomIds } },
        ...(roomNamesForLegacyMatch.length > 0
          ? [
              {
                roomId: null,
                ...(cinemaIdsForLegacyMatch.length > 0 ? { cinemaId: { $in: cinemaIdsForLegacyMatch } } : {}),
                roomName: { $in: roomNamesForLegacyMatch },
              },
            ]
          : []),
      ],
      cancelledAt: null,
      startTime: { $gte: new Date(+start - day), $lte: new Date(+end + 2 * day) },
    };

    if (preview) {
      const existingShowtimes = await Showtime.find(existingShowtimeFilter)
        .populate('movieId', 'title duration')
        .lean();

      const plan = planBatchSchedule({
        roomsInOrder,
        moviesInOrder,
        startMsDay: +start,
        endMsDay: +end,
        scheduleMode,
        firstShowtimeTime,
        latestStartTime,
        targetSlotsPerRoom,
        cleaningMinutes,
        optimizeMaxSlots: Boolean(optimizeMaxSlots),
        staggerRooms: Boolean(staggerRooms),
        timeSlots: normalizedTimeSlots,
        existingShowtimes,
        pricingConfig: pricing,
        now,
      });

      return res.json({
        success: true,
        preview: true,
        ...plan,
      });
    }

    // 2. NHÁNH CONFIRM (TẠO LỊCH HÀNG LOẠT TRONG 1 TRANSACTION DUY NHẤT - BULK INSERT):
    // Bước 1: Chuẩn bị và kiểm tra mẫu ghế 1 lần duy nhất cho từng Room ID trước khi mở Transaction
    for (const m of moviesInOrder) {
      const dur = Number(m.duration);
      if (!Number.isFinite(dur) || dur <= 0) {
        return res.status(409).json({ message: `Phim "${m.title}" chưa có thời lượng hợp lệ.` });
      }
    }

    const seatTemplatesByRoomId = new Map();
    for (const rm of roomsInOrder) {
      const expectedTotal = Number(rm.totalSeats) || SEAT_GRID_CONFIG.totalSeats;
      const templates = await resolveSeatTemplatesForRoom(rm, null);
      if (!isValidRoomSeatTemplate(templates, expectedTotal)) {
        return res.status(409).json({
          message: `Cấu hình mẫu ghế của phòng "${rm.name}" không hợp lệ (yêu cầu đúng ${expectedTotal} ghế, không trùng mã/tọa độ).`,
        });
      }
      seatTemplatesByRoomId.set(String(rm._id), templates);
    }

    const batchId =
      'BATCH-' +
      Date.now().toString(36).toUpperCase() +
      '-' +
      Math.random().toString(36).slice(2, 7).toUpperCase();

    // Sắp xếp Room ID theo thứ tự từ điển nhất quán khi lockRoom để chống deadlock khi 2 Admin thao tác đồng thời
    const roomsSortedForLock = [...roomsInOrder].sort((a, b) =>
      String(a._id).localeCompare(String(b._id))
    );

    const txResult = await mongoose.connection.transaction(async (session) => {
      // Khởi tạo toàn bộ mảng tích lũy BÊN TRONG callback Transaction để nếu MongoDB retry TransientTransactionError,
      // dữ liệu từ lần thử bị rollback trước đó tuyệt đối không bị lẫn vào kết quả trả về.
      const txCreatedSlotIds = [];
      const txCreatedShowtimes = [];

      // Bước 2: Khóa toàn bộ các phòng vật lý liên quan theo thứ tự Room ID nhất quán
      const lockedRoomMap = new Map();
      for (const rm of roomsSortedForLock) {
        const locked = await lockRoom(rm._id, session);
        lockedRoomMap.set(String(rm._id), locked);
      }

      // Đọc toàn bộ lịch chiếu hiện có trong phạm vi thời gian (bao gồm cả suất qua ngày hôm sau) ngay trong Transaction
      const existingInTx = await Showtime.find(existingShowtimeFilter)
        .populate('movieId', 'title duration')
        .session(session)
        .lean();

      // Ánh xạ các bản ghi cũ thiếu roomId (nếu có) về đúng roomId theo tên phòng để kiểm tra xung đột chính xác
      const normalizedExistingInTx = existingInTx.map((st) => {
        if (st.roomId) return st;
        const matchedRoom = roomsInOrder.find(
          (r) => st.roomName === r.name || (r.shortName && st.roomName === r.shortName)
        );
        return matchedRoom ? { ...st, roomId: matchedRoom._id } : st;
      });

      const txNow = new Date();
      const txPlan = planBatchSchedule({
        roomsInOrder,
        moviesInOrder,
        startMsDay: +start,
        endMsDay: +end,
        scheduleMode,
        firstShowtimeTime,
        latestStartTime,
        targetSlotsPerRoom,
        cleaningMinutes,
        optimizeMaxSlots: Boolean(optimizeMaxSlots),
        staggerRooms: Boolean(staggerRooms),
        timeSlots: normalizedTimeSlots,
        existingShowtimes: normalizedExistingInTx,
        pricingConfig: pricing,
        now: txNow,
      });

      // Nếu gọi trực tiếp không qua Preview (như test kiểm tra xung đột) và có xung đột khung giờ -> từ chối 409
      if (expectedValidCount == null && expectedSignature == null && txPlan.conflictCount > 0 && scheduleMode === 'manual') {
        throw new ScheduleConflict(txPlan.conflictSlots[0]?.reason || 'Khung giờ chồng lịch chiếu.');
      }

      // So sánh expectedValidCount và expectedSignature với kết quả Preview
      if (
        (expectedValidCount != null && Number(expectedValidCount) !== txPlan.validCount) ||
        (expectedSignature && expectedSignature !== txPlan.validSignature)
      ) {
        throw new ScheduleConflict(
          'Dữ liệu lịch chiếu trong phòng vừa thay đổi hoặc phát sinh xung đột mới. Vui lòng bấm Xem trước lịch dự kiến (Preview) lại trước khi xác nhận.'
        );
      }

      if (txPlan.validSlots.length === 0) {
        throw new ScheduleConflict(
          txPlan.conflictSlots[0]?.reason || 'Không có suất chiếu hợp lệ nào để tạo.'
        );
      }

      // Bước 3: Kiểm tra toàn bộ điều kiện nghiệp vụ tương đương scheduleInRoom & chuẩn bị mảng Showtime + ShowtimeSeat
      const showtimeDocsToInsert = [];
      const allSeatDocsToInsert = [];
      const createdByUserId = req.admin?._id || req.user?._id || null;

      // Tập khoảng thời gian theo từng phòng để hậu kiểm không có bất kỳ 2 suất nào chồng lấn nhau hoặc chồng với DB
      const verifyIntervalsByRoom = new Map();
      for (const st of normalizedExistingInTx) {
        if (st.cancelledAt) continue;
        const lc = computeShowtimeLifecycle(st, txNow);
        if (lc.lifecycleStatus === 'COMPLETED' || lc.lifecycleStatus === 'CANCELLED') continue;
        const rKey = String(st.roomId?._id || st.roomId || '');
        if (!rKey) continue;
        if (!verifyIntervalsByRoom.has(rKey)) verifyIntervalsByRoom.set(rKey, []);
        verifyIntervalsByRoom.get(rKey).push({
          startMs: lc.startTime.getTime(),
          endMs: lc.cleaningEndTime.getTime(),
        });
      }

      for (const slot of txPlan.validSlots) {
        const roomDoc = lockedRoomMap.get(String(slot.roomId));
        const movieDoc = movieById.get(String(slot.movieId));
        if (!roomDoc) {
          throw new ScheduleConflict('Phòng không tồn tại hoặc đang bảo trì.');
        }
        if (!movieDoc) {
          throw new ScheduleConflict('Phim đã chọn không tồn tại.');
        }

        const duration = Number(movieDoc.duration);
        if (!Number.isFinite(duration) || duration <= 0) {
          throw new ScheduleConflict(`Phim "${movieDoc.title}" chưa có thời lượng hợp lệ.`);
        }

        const slotStart = new Date(slot.startTime);
        const slotStartMs = slotStart.getTime();
        if (!Number.isFinite(slotStartMs) || slotStartMs <= txNow.getTime()) {
          throw new ScheduleConflict('Không thể tạo suất chiếu ở thời điểm đã qua.');
        }

        if (movieDoc.releaseDate && businessDate(slotStart) < businessDate(movieDoc.releaseDate)) {
          throw new ScheduleConflict(`Suất chiếu phim "${movieDoc.title}" sớm hơn ngày khởi chiếu.`);
        }

        const slotCleaningMinutes = normalizeCleaningMinutes(slot.cleaningMinutes, cleaningMinutes);
        const slotEnd = new Date(slotStartMs + duration * 60000);
        const slotCleaningEnd = new Date(slotEnd.getTime() + slotCleaningMinutes * 60000);
        const slotBlockedUntilMs = slotCleaningEnd.getTime();

        const rKey = String(roomDoc._id);
        if (!verifyIntervalsByRoom.has(rKey)) verifyIntervalsByRoom.set(rKey, []);
        const roomIntervals = verifyIntervalsByRoom.get(rKey);
        const hasOverlap = roomIntervals.some(
          (iv) => slotStartMs < iv.endMs && slotBlockedUntilMs > iv.startMs
        );
        if (hasOverlap) {
          throw new ScheduleConflict(
            `Khung giờ ${slot.time} ngày ${slot.date} tại ${roomDoc.name} chồng lịch chiếu hoặc không đủ ${slotCleaningMinutes} phút dọn dẹp vệ sinh phòng.`
          );
        }
        roomIntervals.push({ startMs: slotStartMs, endMs: slotBlockedUntilMs });

        const calculated = calculatePricesFromConfig(
          {
            roomName: roomDoc.name,
            roomType: roomDoc.roomType,
            formatFeature: roomDoc.formatFeature,
            startTime: slotStart,
          },
          pricing
        );

        const initialLifecycle = computeShowtimeLifecycle(
          {
            startTime: slotStart,
            endTime: slotEnd,
            cleaningMinutes: slotCleaningMinutes,
          },
          txNow
        );

        const showtimeId = new mongoose.Types.ObjectId();
        const resolvedPrice = slot.priceStandard ?? calculated.priceStandard;

        showtimeDocsToInsert.push({
          _id: showtimeId,
          movieId: movieDoc._id,
          cinemaId: roomDoc.cinemaId,
          roomId: roomDoc._id,
          roomName: roomDoc.name,
          formatFeature: roomDoc.formatFeature || '',
          startTime: slotStart,
          endTime: slotEnd,
          cleaningMinutes: slotCleaningMinutes,
          cleaningEndTime: slotCleaningEnd,
          lifecycleStatus: initialLifecycle.lifecycleStatus,
          price: resolvedPrice,
          batchId,
          creationSource: 'BULK',
          createdBy: createdByUserId,
          isLocked: false,
        });

        const roomTemplates = seatTemplatesByRoomId.get(rKey);
        for (let sIdx = 0; sIdx < roomTemplates.length; sIdx++) {
          const tmpl = roomTemplates[sIdx];
          allSeatDocsToInsert.push({
            roomId: roomDoc._id,
            showtimeId,
            row: tmpl.row,
            col: tmpl.col,
            seatNumber: tmpl.seatNumber,
            type: tmpl.type,
            status: 'AVAILABLE',
          });
        }

        const showtimeIdStr = showtimeId.toString();
        txCreatedSlotIds.push(showtimeIdStr);
        txCreatedShowtimes.push({
          id: showtimeIdStr,
          roomId: rKey,
          roomName: roomDoc.name,
          movieId: String(movieDoc._id),
          movieTitle: movieDoc.title,
          date: slot.date,
          time: slot.time,
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          cleaningMinutes: slotCleaningMinutes,
          price: resolvedPrice,
        });
      }

      // Bước 3: Ghi toàn bộ Showtime hợp lệ bằng 1 lệnh Showtime.insertMany trong cùng Transaction session
      await Showtime.insertMany(showtimeDocsToInsert, { session, ordered: true });

      // Bước 4: Ghi toàn bộ ShowtimeSeat theo từng nhóm 3.520 ghế (40 suất x 88 ghế) tuần tự trong cùng Transaction session
      const SEAT_BATCH_CHUNK_SIZE = 3520;
      for (let offset = 0; offset < allSeatDocsToInsert.length; offset += SEAT_BATCH_CHUNK_SIZE) {
        const chunk = allSeatDocsToInsert.slice(offset, offset + SEAT_BATCH_CHUNK_SIZE);
        await ShowtimeSeat.insertMany(chunk, { session, ordered: true });
      }

      return {
        totalCreatedShowtimes: showtimeDocsToInsert.length,
        totalCreatedSeats: allSeatDocsToInsert.length,
        createdSlotIds: txCreatedSlotIds,
        createdShowtimes: txCreatedShowtimes,
      };
    });

    return res.json({
      success: true,
      batchId,
      scheduleMode,
      cleaningMinutes,
      totalCreatedShowtimes: txResult.totalCreatedShowtimes,
      totalCreatedSeats: txResult.totalCreatedSeats,
      createdSlotIds: txResult.createdSlotIds,
      createdShowtimes: txResult.createdShowtimes,
      message: `Đã tạo thành công ${txResult.totalCreatedShowtimes} suất chiếu (${txResult.totalCreatedSeats.toLocaleString('vi-VN')} ghế).`,
    });
  } catch (error) {
    if (error instanceof ScheduleConflict) {
      return res.status(409).json({
        message: error.message,
        requiresRePreview: true,
        rolledBack: true,
      });
    }
    console.error('Batch scheduling failed:', error.name, error.message);
    return res.status(500).json({
      message: 'Chưa thể tạo lịch chiếu hàng loạt. Toàn bộ giao dịch đã được rollback an toàn, vui lòng thử lại.',
      rolledBack: true,
    });
  }
};

// ==================== QUẢN LÝ KHÁCH HÀNG / THÀNH VIÊN ====================
export const getAdminUsers = async (req, res) => {
  try {
    const [users, purchaseStats] = await Promise.all([
      User.find().select('name email phone avatar role createdAt tier points').sort({ createdAt: -1 }).lean(),
      Booking.aggregate([
        { $match: { userId: { $type: 'objectId' }, status: 'PAID', paymentStatus: { $in: ['SIMULATED', 'VERIFIED'] } } },
        {
          $group: {
            _id: '$userId', bookingCount: { $sum: 1 },
            totalTickets: { $sum: { $size: { $split: ['$seats', ','] } } },
            totalSpend: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'VERIFIED'] }, '$totalAmount', 0] } },
          }
        },
      ]),
    ]);
    const byUser = new Map(purchaseStats.map(({ _id, ...stats }) => [String(_id), stats]));
    const usersWithStats = users.map(user => ({
      ...user, id: String(user._id), bookingCount: 0, totalTickets: 0, totalSpend: 0,
      ...byUser.get(String(user._id)),
    }));
    res.json(usersWithStats);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách thành viên', error: error.message });
  }
};

export const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID tài khoản không hợp lệ' });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản người dùng' });
    }
    await User.findByIdAndDelete(id);
    res.json({
      success: true,
      message: `Đã xóa tài khoản "${user.name || user.email}" thành công khỏi hệ thống`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa tài khoản người dùng', error: error.message });
  }
};

// ==================== QUẢN LÝ BẮP NƯỚC ====================
export const getAdminConcessions = async (req, res) => {
  try {
    await ensureCleanConcessions();
    const concessions = await Concession.find().sort({ price: 1 }).lean();
    res.json(
      concessions.map((c) => {
        const visuals = resolveConcessionVisuals(c);
        return {
          ...c,
          ...visuals,
          id: c._id.toString(),
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy bắp nước', error: error.message });
  }
};

export const createConcession = async (req, res) => {
  try {
    const { name, price, description, image, category, badge } = req.body;
    const visuals = resolveConcessionVisuals({ name, image, category, badge });
    const c = await Concession.create({
      name,
      price: parseFloat(price) || 50000,
      description: description || '',
      category: visuals.category,
      badge: visuals.badge,
      image: visuals.image,
      imageUrl: visuals.imageUrl,
    });
    res.status(201).json({ ...c.toObject(), id: c._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo bắp nước', error: error.message });
  }
};

export const deleteConcession = async (req, res) => {
  try {
    const { id } = req.params;
    await Concession.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa bắp nước' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa bắp nước', error: error.message });
  }
};

// ==================== QUẢN LÝ KHUYẾN MÃI ====================
export const getAdminPromotions = async (req, res) => {
  try {
    await ensureCleanPromotions();
    const promotions = await Promotion.find().sort({ order: 1, createdAt: -1 }).lean();
    res.json(
      promotions.map((p) => ({
        ...p,
        ...resolvePromotionVisuals(p),
        id: p._id.toString(),
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy khuyến mãi', error: error.message });
  }
};

export const createPromotion = async (req, res) => {
  try {
    const { title, code, discountPercent, discountAmount, description, validUntil, image, type, category } = req.body;
    const visuals = resolvePromotionVisuals({ title, image, type: type || 'VOUCHER' });
    const promo = await Promotion.create({
      type: type || 'VOUCHER',
      category: category || 'TICKET',
      title,
      code: code ? code.toUpperCase() : 'PROMO' + Math.floor(Math.random() * 1000),
      discountValue: discountAmount
        ? `GIẢM ${Math.round(Number(discountAmount) / 1000)}K`
        : discountPercent
          ? `GIẢM ${discountPercent}%`
          : 'ƯU ĐÃI VIP',
      discountPercent: discountPercent ? parseInt(discountPercent, 10) : 0,
      discountAmount: discountAmount ? parseInt(discountAmount, 10) : 0,
      description: description || '',
      conditions: description || 'Áp dụng tại D\'AVENOR Thanh Khê Plaza',
      expiryDate: validUntil ? `HSD: ${new Date(validUntil).toLocaleDateString('vi-VN')}` : 'HSD: 31/12/2026',
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 86400000),
      image: visuals.image,
      isActive: true,
    });
    res.status(201).json({ ...promo.toObject(), id: promo._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo khuyến mãi', error: error.message });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    await Promotion.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa khuyến mãi' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa khuyến mãi', error: error.message });
  }
};

// ==================== QUẢN LÝ MÃ XÁC THỰC OTP (DATABASE & EMAIL) ====================
export const getAdminOtps = async (req, res) => {
  try {
    const otps = await OtpVerification.find().select('email type status expiresAt createdAt').sort({ createdAt: -1 }).limit(100).lean();

    res.json({
      otps: otps.map((item) => ({
        ...item,
        id: item._id.toString(),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách mã OTP', error: error.message });
  }
};

export const sendAdminTestOtp = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập địa chỉ Email nhận mã OTP' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Dọn dẹp các mã OTP đã hết hạn hoặc mã cũ của email này để Database luôn nhẹ
    await OtpVerification.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { email: cleanEmail, status: 'PENDING' },
        { status: 'EXPIRED' },
      ],
    });

    const result = await generateAndSendEmailOtp({
      email: cleanEmail,
      type: type === 'reset_password' ? 'reset_password' : 'register',
    });

    res.status(201).json({
      success: true,
      message: result.emailSent ? 'Đã gửi email OTP.' : 'Không gửi được email OTP.',
      emailSent: result.emailSent,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo và gửi mã OTP', error: error.message });
  }
};

export const deleteAdminOtp = async (req, res) => {
  try {
    const { id } = req.params;
    await OtpVerification.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa bản ghi OTP khỏi Database' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa mã OTP', error: error.message });
  }
};

export const clearExpiredAdminOtps = async (req, res) => {
  try {
    const now = new Date();
    const result = await OtpVerification.deleteMany({
      $or: [
        { expiresAt: { $lt: now } },
        { status: { $in: ['EXPIRED', 'VERIFIED'] } },
      ],
    });
    res.json({
      success: true,
      message: `Đã dọn dẹp ${result.deletedCount || 0} mã OTP đã sử dụng / hết hạn khỏi Database.`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi dọn dẹp mã OTP', error: error.message });
  }
};

// ==================== QUẢN LÝ TRỢ LÝ ẢO CHATBOT AI (DATABASE & LOGS) ====================
export const getAdminChatbotData = async (req, res) => {
  try {
    const [config, logs, movieCount, showtimeCount, concessionCount, promoCount] = await Promise.all([
      ensureAiConfig(),
      AiChatLog.find().sort({ createdAt: -1 }).limit(100).lean(),
      Movie.countDocuments(),
      Showtime.countDocuments(),
      Concession.countDocuments(),
      Promotion.countDocuments({ isActive: true }),
    ]);

    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim() !== '' &&
      process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY'
    );

    res.json({
      config: {
        ...config.toObject(),
        id: config._id.toString(),
      },
      logs: logs.map((l) => ({
        ...l,
        id: l._id.toString(),
      })),
      ragStats: {
        hasGeminiKey,
        engineMode: hasGeminiKey ? 'Gemini 1.5 Flash + Database RAG' : 'Database RAG Engine (Trực tiếp MongoDB)',
        movies: movieCount,
        showtimes: showtimeCount,
        concessions: concessionCount,
        promotions: promoCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy dữ liệu quản lý Chatbot AI', error: error.message });
  }
};

export const updateAdminChatbotConfig = async (req, res) => {
  try {
    const { botName, botVersion, welcomeMessage, systemPromptNote, isEnabled, quickChips } = req.body;
    const config = await ensureAiConfig();

    if (botName !== undefined) config.botName = botName;
    if (botVersion !== undefined) config.botVersion = botVersion;
    if (welcomeMessage !== undefined) config.welcomeMessage = welcomeMessage;
    if (systemPromptNote !== undefined) config.systemPromptNote = systemPromptNote;
    if (isEnabled !== undefined) config.isEnabled = Boolean(isEnabled);
    if (Array.isArray(quickChips)) {
      config.quickChips = quickChips.filter((c) => c && c.label && c.query);
    }

    await config.save();
    res.json({
      success: true,
      message: 'Đã lưu cấu hình Trợ lý AI vào Database thành công!',
      config,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật cấu hình Chatbot AI', error: error.message });
  }
};

export const addAdminChatbotFaq = async (req, res) => {
  try {
    const { title, keywords, category, answer } = req.body;
    if (!title || !keywords || !answer) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Tiêu đề, Từ khóa và Câu trả lời mẫu' });
    }

    const config = await ensureAiConfig();
    config.faqs.unshift({
      title: title.trim(),
      keywords: keywords.trim(),
      category: category || 'POLICY',
      answer: answer.trim(),
      isActive: true,
    });
    await config.save();

    res.status(201).json({
      success: true,
      message: 'Đã thêm kịch bản câu trả lời mới vào Kho tri thức AI!',
      faqs: config.faqs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thêm kịch bản FAQ cho AI', error: error.message });
  }
};

export const updateAdminChatbotFaq = async (req, res) => {
  try {
    const { faqId } = req.params;
    const { title, keywords, category, answer, isActive } = req.body;

    const config = await ensureAiConfig();
    const faqItem = config.faqs.id(faqId);
    if (!faqItem) {
      return res.status(404).json({ message: 'Không tìm thấy kịch bản câu hỏi này' });
    }

    if (title !== undefined) faqItem.title = title;
    if (keywords !== undefined) faqItem.keywords = keywords;
    if (category !== undefined) faqItem.category = category;
    if (answer !== undefined) faqItem.answer = answer;
    if (isActive !== undefined) faqItem.isActive = Boolean(isActive);

    await config.save();
    res.json({
      success: true,
      message: 'Đã cập nhật kịch bản tri thức AI!',
      faqs: config.faqs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật kịch bản FAQ', error: error.message });
  }
};

export const deleteAdminChatbotFaq = async (req, res) => {
  try {
    const { faqId } = req.params;
    const config = await ensureAiConfig();
    config.faqs = config.faqs.filter((f) => f._id.toString() !== faqId);
    await config.save();

    res.json({
      success: true,
      message: 'Đã xóa kịch bản hỏi đáp khỏi Kho tri thức AI',
      faqs: config.faqs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa kịch bản FAQ', error: error.message });
  }
};

export const deleteAdminChatLog = async (req, res) => {
  try {
    const { id } = req.params;
    await AiChatLog.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa bản ghi hội thoại' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa lịch sử chat', error: error.message });
  }
};

export const clearAdminChatLogs = async (req, res) => {
  try {
    const result = await AiChatLog.deleteMany({});
    res.json({
      success: true,
      message: `Đã xóa toàn bộ ${result.deletedCount || 0} lịch sử hội thoại AI.`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi dọn dẹp lịch sử chat', error: error.message });
  }
};

// ==================== QUẢN LÝ BẢNG GIÁ VÉ & CẬP NHẬT GIÁ SUẤT CHIẾU ====================
export const updateShowtime = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }
    if (['roomId', 'roomName', 'cinemaId', 'startTime', 'endTime', 'formatFeature'].some(field => Object.hasOwn(req.body, field))) {
      return res.status(400).json({ message: 'Phòng và thời gian của suất chiếu đã tạo được lưu cố định.' });
    }
    const { price } = req.body;
    const updatePayload = {};
    if (price !== undefined) {
      const numPrice = Number(price);
      if (!Number.isFinite(numPrice) || numPrice < 0) {
        return res.status(400).json({ message: 'Giá vé phải là số hợp lệ không âm' });
      }
      updatePayload.price = Math.round(numPrice);
    }

    const updated = await Showtime.findByIdAndUpdate(id, updatePayload, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }
    res.json({ success: true, showtime: { ...updated, id: updated._id.toString() } });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật suất chiếu', error: error.message });
  }
};

export const getAdminPricingConfig = async (req, res) => {
  try {
    const config = await ensurePricingConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải cấu hình bảng giá vé', error: error.message });
  }
};

const sanitizeFormatPricingRule = (incomingRule = {}, fallbackRule = {}) => {
  const toValidInt = (val, def) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : def;
  };
  return {
    label: incomingRule.label || fallbackRule.label,
    roomTypeLabel: incomingRule.roomTypeLabel || fallbackRule.roomTypeLabel,
    vipSurcharge: toValidInt(incomingRule.vipSurcharge, fallbackRule.vipSurcharge),
    sweetboxExtra: toValidInt(incomingRule.sweetboxExtra, fallbackRule.sweetboxExtra),
    weekday: {
      before17: toValidInt(incomingRule.weekday?.before17, fallbackRule.weekday.before17),
      goldenHour: toValidInt(incomingRule.weekday?.goldenHour, fallbackRule.weekday.goldenHour),
      lateNight: toValidInt(incomingRule.weekday?.lateNight, fallbackRule.weekday.lateNight),
    },
    weekend: {
      before17: toValidInt(incomingRule.weekend?.before17, fallbackRule.weekend.before17),
      goldenHour: toValidInt(incomingRule.weekend?.goldenHour, fallbackRule.weekend.goldenHour),
      lateNight: toValidInt(incomingRule.weekend?.lateNight, fallbackRule.weekend.lateNight),
    },
  };
};

export const updateAdminPricingConfig = async (req, res) => {
  try {
    const { formats, holidaySurcharge, note, applyToExistingShowtimes = true } = req.body || {};
    const existing = await ensurePricingConfig();

    const nextFormats = {};
    for (const fmtKey of ['2D', '3D', 'IMAX', 'GOLD_CLASS']) {
      const baseFallback = existing.formats?.[fmtKey] || INITIAL_PRICING_FORMATS[fmtKey];
      nextFormats[fmtKey] = sanitizeFormatPricingRule(formats?.[fmtKey] || {}, baseFallback);
    }

    // Kiểm tra logic phân cấp 2D < 3D < IMAX để tránh cấu hình sai lệch ngược đời
    const f2D = nextFormats['2D'];
    const f3D = nextFormats['3D'];
    const fImax = nextFormats.IMAX;
    for (const dayKey of ['weekday', 'weekend']) {
      for (const slotKey of ['before17', 'goldenHour', 'lateNight']) {
        if (f3D[dayKey][slotKey] <= f2D[dayKey][slotKey]) {
          return res.status(400).json({
            message: `Giá vé 3D (${f3D[dayKey][slotKey].toLocaleString('vi-VN')}đ) phải cao hơn giá vé 2D (${f2D[dayKey][slotKey].toLocaleString('vi-VN')}đ) ở tất cả khung giờ!`,
          });
        }
        if (fImax[dayKey][slotKey] <= f3D[dayKey][slotKey]) {
          return res.status(400).json({
            message: `Giá vé IMAX (${fImax[dayKey][slotKey].toLocaleString('vi-VN')}đ) phải cao hơn giá vé 3D (${f3D[dayKey][slotKey].toLocaleString('vi-VN')}đ) ở tất cả khung giờ!`,
          });
        }
      }
    }

    const updated = await TicketPricingConfig.findOneAndUpdate(
      { configKey: 'MAIN_PRICING_CONFIG' },
      {
        $set: {
          formats: nextFormats,
          holidaySurcharge:
            holidaySurcharge !== undefined && Number(holidaySurcharge) >= 0
              ? Math.round(Number(holidaySurcharge))
              : existing.holidaySurcharge,
          note: note !== undefined ? String(note).slice(0, 300) : existing.note,
        },
      },
      { new: true, upsert: true }
    ).lean();

    const syncResult = await syncDatabaseWithPricingConfig(updated, {
      updateFutureShowtimes: Boolean(applyToExistingShowtimes),
    });

    res.json({
      success: true,
      message: `Đã lưu bảng giá vé mới (đồng bộ ${syncResult.updatedRooms} phòng chiếu${applyToExistingShowtimes ? ` và ${syncResult.updatedShowtimes} suất chiếu sắp tới` : ''})!`,
      config: updated,
      syncResult,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật bảng giá vé', error: error.message });
  }
};

// ==================== THỐNG KÊ SUẤT CHIẾU & TỶ LỆ LẤP ĐẦY (LIVE OCCUPANCY & SEAT MATRIX) ====================

const formatTimeHHmm = (date) => {
  if (!date) return '00:00';
  const d = new Date(date);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const getMovieAcronym = (title = '') => {
  if (!title) return 'SHOW';
  const clean = title.replace(/[:\-–—.,!?()[\]]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  if (/^(dune|mai|avatar|oppenheimer|godzilla|conan|transformers)/i.test(words[0])) {
    return words[0].slice(0, 4).toUpperCase();
  }
  const acronym = words.map((w) => w[0]).join('').slice(0, 5).toUpperCase();
  return acronym || 'SHOW';
};

const detectShowtimeFormat = (roomOrName = '', formatFeature = '') => {
  const canonicalType = resolveCanonicalRoomType(
    typeof roomOrName === 'string' ? { roomName: roomOrName } : roomOrName
  );
  const featText = String(formatFeature || '').toLowerCase();

  if (canonicalType === ROOM_TYPES_ENUM.IMAX_LASER) {
    return {
      category: 'IMAX Laser',
      badge: /\b3d\b/i.test(featText) ? 'IMAX 3D Laser' : 'IMAX Laser',
      color: 'from-amber-500/20 to-amber-600/30 text-amber-300 border-amber-500/40',
    };
  }
  if (canonicalType === ROOM_TYPES_ENUM.GOLD_CLASS) {
    return {
      category: 'VIP Gold Class',
      badge: featText.includes('bed') ? 'VIP Bed Recliner' : 'VIP Gold Class',
      color: 'from-purple-500/20 to-purple-600/30 text-purple-300 border-purple-500/40',
    };
  }
  if (canonicalType === ROOM_TYPES_ENUM.REALD_3D || /\b3d\b/i.test(featText)) {
    return {
      category: '3D Digital',
      badge: featText.includes('lồng tiếng') ? '3D Lồng tiếng' : 'RealD 3D',
      color: 'from-cyan-500/20 to-cyan-600/30 text-cyan-300 border-cyan-500/40',
    };
  }
  return {
    category: '2D Atmos',
    badge: canonicalType === ROOM_TYPES_ENUM.DOLBY_ATMOS || featText.includes('atmos') ? '2D Atmos' : '2D Tiêu chuẩn',
    color: 'from-blue-500/20 to-blue-600/30 text-blue-300 border-blue-500/40',
  };
};

// Đảm bảo ghế cho suất chiếu
export const getShowtimeOccupancyAnalytics = async (req, res) => {
  try {
    const { date = 'today', cinemaId = 'ALL', format = 'ALL', search = '' } = req.query;


    // 1. Xác định thời gian lọc
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (date === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (date === 'tomorrow') {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      startDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0, 0);
      endDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999);
    } else if (date === 'weekend') {
      const dayOfWeek = now.getDay();
      const daysUntilSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7;
      const sat = new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
      startDate = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate(), 0, 0, 0, 0);
      const sun = new Date(sat.getTime() + 24 * 60 * 60 * 1000);
      endDate = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 23, 59, 59, 999);
    } else if (date && date !== 'all' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split('-').map(Number);
      startDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      endDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    }

    // 2. Xây dựng filter query cho Showtime
    const filter = {};
    if (startDate && endDate) {
      filter.startTime = { $gte: startDate, $lte: endDate };
    }
    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      filter.cinemaId = new mongoose.Types.ObjectId(cinemaId);
    }

    let showtimes = await Showtime.find(filter)
      .sort({ startTime: 1 })
      .populate('movieId', 'title posterUrl poster ageRating duration genre')
      .populate('cinemaId', 'name city address')
      .lean();

    // Fallback thông minh: Nếu ngày hôm nay chưa có suất chiếu được tạo, mở rộng tìm các suất chiếu gần nhất hoặc tất cả
    if (showtimes.length === 0 && date === 'today') {
      const fallbackFilter = {};
      if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
        fallbackFilter.cinemaId = new mongoose.Types.ObjectId(cinemaId);
      }
      showtimes = await Showtime.find(fallbackFilter)
        .sort({ startTime: -1 })
        .limit(30)
        .populate('movieId', 'title posterUrl poster ageRating duration genre')
        .populate('cinemaId', 'name city address')
        .lean();
    }

    // Lọc theo search (tên phim, rạp, mã suất)
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      showtimes = showtimes.filter((st) => {
        const title = st.movieId?.title?.toLowerCase() || '';
        const cinema = st.cinemaId?.name?.toLowerCase() || '';
        const room = st.roomName?.toLowerCase() || '';
        const acronym = getMovieAcronym(st.movieId?.title).toLowerCase();
        return title.includes(s) || cinema.includes(s) || room.includes(s) || acronym.includes(s);
      });
    }

    // 3. Xử lý từng suất chiếu: Tính toán ma trận ghế và khách hàng
    const processedShowtimes = [];
    let grandTotalSeats = 0;
    let grandBookedSeats = 0;
    let grandCustomers = 0;
    let nearSoldOutTotal = 0;
    const uniqueCinemas = new Set();
    let imaxRoomsTotal = 0;

    const formatCounters = {
      all: 0,
      imax: 0,
      atmos: 0,
      digital3d: 0,
      vip: 0,
    };

    for (const st of showtimes) {
      const fmt = detectShowtimeFormat(st.roomName, st.formatFeature);

      formatCounters.all++;
      if (fmt.category === 'IMAX Laser') formatCounters.imax++;
      else if (fmt.category === '2D Atmos') formatCounters.atmos++;
      else if (fmt.category === '3D Digital') formatCounters.digital3d++;
      else if (fmt.category === 'VIP Gold Class') formatCounters.vip++;

      if (format !== 'ALL' && fmt.category !== format) {
        continue;
      }

      if (st.cinemaId?._id) {
        uniqueCinemas.add(st.cinemaId._id.toString());
      }
      if (fmt.category === 'IMAX Laser') {
        imaxRoomsTotal++;
      }

      const seats = await ShowtimeSeat.find({ showtimeId: st._id }).lean();

      const bookings = await Booking.find({ showtimeId: st._id, status: 'PAID' })
        .sort({ createdAt: -1 })
        .lean();

      // Đồng bộ ghế đã BOOKED
      for (const b of bookings) {
        if (b.seats) {
          const seatNames = b.seats.split(',').map((s) => s.trim());
          for (const s of seats) {
            if (seatNames.includes(s.seatNumber) && s.status !== 'BOOKED') {
              s.status = 'BOOKED';
              s.customerName = b.customerName;
            }
          }
        }
      }

      let bookedCount = seats.filter((s) => s.status === 'BOOKED').length;
      const totalCount = seats.length;

      let customerCount = bookings.length;
      if (customerCount === 0 && bookedCount > 0) {
        customerCount = Math.ceil(bookedCount / 2);
      }

      const occupancyRate = totalCount > 0 ? Number(((bookedCount / totalCount) * 100).toFixed(1)) : 0;
      const availableCount = totalCount - bookedCount;
      const isNearSoldOut = occupancyRate >= 80;

      if (isNearSoldOut) nearSoldOutTotal++;
      grandTotalSeats += totalCount;
      grandBookedSeats += bookedCount;
      grandCustomers += customerCount;

      const avgTickets = customerCount > 0 ? Number((bookedCount / customerCount).toFixed(2)) : 0;

      const startTime = new Date(st.startTime);
      const durationMin = st.movieId?.duration || 120;
      const endTime = new Date(startTime.getTime() + durationMin * 60000);

      let status = 'UPCOMING';
      let statusLabel = 'Sắp chiếu';
      if (now < startTime) {
        status = 'UPCOMING';
        statusLabel = 'Sắp chiếu';
      } else if (now <= endTime) {
        status = 'HAPPENING';
        statusLabel = 'Đang chiếu';
      } else {
        status = 'ENDED';
        statusLabel = 'Đã kết thúc';
      }

      const codeAcronym = getMovieAcronym(st.movieId?.title);
      const timeStr = `${String(startTime.getHours()).padStart(2, '0')}${String(startTime.getMinutes()).padStart(2, '0')}`;
      const showtimeCode = `#SC-${codeAcronym}-${timeStr}`;

      const seatMatrix = seats.map((s) => ({
        id: s._id ? s._id.toString() : s.seatNumber,
        seatNumber: s.seatNumber,
        row: s.row,
        col: s.col,
        type: s.type,
        status: s.status,
        price: s.type === 'VIP' ? (st.price + 20000) : s.type === 'SWEETBOX' ? (st.price * 2) : st.price,
        customerName: s.customerName || (s.status === 'BOOKED' ? 'Khách đã mua' : ''),
      }));

      const customerBookings = bookings.map((b) => ({
        id: b._id.toString(),
        bookingCode: b.bookingCode,
        customerName: b.customerName,
        customerPhone: b.customerPhone ? b.customerPhone.replace(/(\d{4})\d{3}(\d{3})/, '$1***$2') : '',
        customerEmail: b.customerEmail || '',
        seats: b.seats,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
      }));

      processedShowtimes.push({
        id: st._id.toString(),
        code: showtimeCode,
        screen: st.roomName || 'Screen 01',
        movie: {
          id: st.movieId?._id?.toString() || '',
          title: st.movieId?.title || 'Phim đang cập nhật',
          posterUrl: st.movieId?.posterUrl || st.movieId?.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
          ageRating: st.movieId?.ageRating || 'P',
          duration: durationMin,
        },
        format: fmt.badge,
        formatCategory: fmt.category,
        formatColor: fmt.color,
        cinema: {
          id: st.cinemaId?._id?.toString() || '',
          name: st.cinemaId?.name || "D'AVENOR Cineplex",
          city: st.cinemaId?.city || 'Đà Nẵng',
        },
        startTime: st.startTime,
        endTime,
        timeRange: `${formatTimeHHmm(startTime)} - ${formatTimeHHmm(endTime)}`,
        status,
        statusLabel,
        isLocked: !!st.isLocked,
        totalSeats: totalCount,
        bookedSeats: bookedCount,
        availableSeats: availableCount,
        occupancyPercent: occupancyRate,
        customerCount,
        avgTicketsPerCustomer: avgTickets,
        isNearSoldOut,
        price: st.price,
        seatMatrix,
        customerBookings,
      });
    }

    const overallOccupancyRate = grandTotalSeats > 0 ? Number(((grandBookedSeats / grandTotalSeats) * 100).toFixed(1)) : 0;
    const avgOverallTickets = grandCustomers > 0 ? Number((grandBookedSeats / grandCustomers).toFixed(1)) : 2.0;

    const summary = {
      totalShowtimes: processedShowtimes.length,
      activeCinemasCount: uniqueCinemas.size || 1,
      imaxRoomsCount: imaxRoomsTotal,
      totalCapacity: grandTotalSeats,
      totalBooked: grandBookedSeats,
      totalAvailable: grandTotalSeats - grandBookedSeats,
      overallOccupancyRate,
      growthTrend: '+12.4%',
      totalCustomers: grandCustomers,
      avgTicketsPerCustomer: avgOverallTickets,
      totalCancelled: 0,
      nearSoldOutCount: nearSoldOutTotal,
    };

    res.json({
      success: true,
      summary,
      formatCounts: formatCounters,
      showtimes: processedShowtimes,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Lỗi thống kê suất chiếu & tỷ lệ lấp đầy:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tính toán thống kê suất chiếu', error: error.message });
  }
};

export const toggleShowtimeLock = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }
    const showtime = await Showtime.findById(id);
    if (!showtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }
    if (showtime.cancelledAt) return res.status(409).json({ message: 'Suất đã hủy.' });
    showtime.isLocked = !showtime.isLocked;
    await showtime.save();
    res.json({
      success: true,
      isLocked: showtime.isLocked,
      message: showtime.isLocked ? 'Đã khóa suất chiếu thành công' : 'Đã mở khóa suất chiếu thành công',
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật trạng thái khóa suất chiếu', error: error.message });
  }
};

export const getShowtimeBookings = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }
    const bookings = await Booking.find({ showtimeId: id, status: 'PAID' })
      .select('-qrToken')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách đặt vé của suất chiếu', error: error.message });
  }
};

export const getMovieAnalytics = async (req, res) => {
  try {
    const analytics = await statisticsService.getMovieDetailStats(req.params.id);
    return res.json({ success: true, analytics });
  } catch {
    return res.status(404).json({ message: 'Không tìm thấy thống kê phim.' });
  }
};


// ════════════════════════════════════════════════════════════════════════════════
// RECURRING SHOWTIME – Shared Validation, Read-Only Preview & Transactional Commit
// ════════════════════════════════════════════════════════════════════════════════
const RECURRING_MAX_RANGE_DAYS = 30;
const RECURRING_MAX_EXPECTED_SLOTS = 180;
const RECURRING_OPEN_MIN = 8 * 60;           // 08:00
const RECURRING_LATEST_START_MIN = 22 * 60 + 30; // 22:30 (đồng bộ chuẩn vận hành rạp)
const RECURRING_CLOSING_LIMIT_MIN = 26 * 60; // 02:00 (+1 ngày)

function computeRecurringSignSecret() {
  return String(process.env.JWT_SECRET || 'davenor-recurring-signature-secret');
}

function buildRecurringSignature({
  movieId,
  roomId,
  formatFeature,
  startDate,
  endDate,
  daysOfWeek,
  timeSlots,
  cleaningMinutes,
  validIsoList,
}) {
  const payload = [
    String(movieId),
    String(roomId),
    String(formatFeature || ''),
    String(startDate || ''),
    String(endDate || ''),
    Array.isArray(daysOfWeek) ? [...daysOfWeek].sort((a, b) => a - b).join(',') : '',
    Array.isArray(timeSlots) ? [...timeSlots].sort().join(',') : '',
    String(cleaningMinutes || DEFAULT_CLEANING_MINUTES),
    Array.isArray(validIsoList) ? [...validIsoList].sort().join('|') : '',
  ].join('::');
  const hmac = crypto.createHmac('sha256', computeRecurringSignSecret()).update(payload).digest('hex');
  return `${payload}::SIG=${hmac}`;
}

function computeRecurringRequestFingerprint({
  movieId,
  roomId,
  formatFeature,
  cleaningMinutes,
  pricingMode,
  price,
  skipConflicts,
  candidateIsoList,
}) {
  const raw = JSON.stringify({
    movieId: String(movieId || ''),
    roomId: String(roomId || ''),
    formatFeature: String(formatFeature || ''),
    cleaningMinutes: Number(cleaningMinutes || DEFAULT_CLEANING_MINUTES),
    pricingMode: String(pricingMode || 'auto'),
    price: pricingMode === 'fixed' ? Number(price || 0) : null,
    skipConflicts: Boolean(skipConflicts),
    slots: Array.isArray(candidateIsoList) ? [...candidateIsoList].sort() : [],
  });
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function normalizeRecurringInputs(body = {}) {
  const {
    movieId,
    roomId,
    cinemaId,
    formatFeature,
    startDate,
    endDate,
    daysOfWeek,
    timeSlots,
    pricingMode = 'auto',
    price,
    cleaningMinutes: rawCleaning,
    skipConflicts = false,
  } = body;

  if (!mongoose.isObjectIdOrHexString(movieId)) {
    return { error: { status: 400, message: 'movieId không hợp lệ.' } };
  }
  if (!mongoose.isObjectIdOrHexString(roomId)) {
    return { error: { status: 400, message: 'roomId không hợp lệ.' } };
  }
  if (typeof startDate !== 'string' || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { error: { status: 400, message: 'startDate / endDate phải đúng định dạng YYYY-MM-DD.' } };
  }
  const startDateObj = new Date(`${startDate}T00:00:00+07:00`);
  const endDateObj = new Date(`${endDate}T00:00:00+07:00`);
  if (!Number.isFinite(startDateObj.getTime()) || !Number.isFinite(endDateObj.getTime())
      || businessDate(startDateObj) !== startDate || businessDate(endDateObj) !== endDate) {
    return { error: { status: 400, message: 'Ngày bắt đầu hoặc kết thúc không hợp lệ.' } };
  }
  if (startDate > endDate) {
    return { error: { status: 400, message: 'Ngày bắt đầu (startDate) phải nhỏ hơn hoặc bằng ngày kết thúc (endDate).' } };
  }

  const msPerDay = 86400000;
  const startMs = startDateObj.getTime();
  const endMs = endDateObj.getTime();
  const rangeDays = Math.round((endMs - startMs) / msPerDay) + 1;
  if (rangeDays > RECURRING_MAX_RANGE_DAYS) {
    return { error: { status: 400, message: `Khoảng ngày lặp lịch tối đa ${RECURRING_MAX_RANGE_DAYS} ngày (yêu cầu ${rangeDays} ngày).` } };
  }

  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
    return { error: { status: 400, message: 'Vui lòng chọn ít nhất 1 thứ trong tuần.' } };
  }
  const uniqueDays = [];
  const seenDays = new Set();
  for (const rawDay of daysOfWeek) {
    const d = Number(rawDay);
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      return { error: { status: 400, message: `Thứ trong tuần "${rawDay}" không hợp lệ (chấp nhận 0..6).` } };
    }
    if (!seenDays.has(d)) {
      seenDays.add(d);
      uniqueDays.push(d);
    }
  }

  if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
    return { error: { status: 400, message: 'Vui lòng chọn ít nhất 1 khung giờ chiếu.' } };
  }
  const uniqueTimeSlots = [];
  const seenSlots = new Set();
  for (const rawSlot of timeSlots) {
    const clean = typeof rawSlot === 'string' ? rawSlot.trim() : '';
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clean)) {
      return { error: { status: 400, message: `Khung giờ "${rawSlot}" không đúng định dạng 24h HH:mm.` } };
    }
    if (!seenSlots.has(clean)) {
      seenSlots.add(clean);
      uniqueTimeSlots.push(clean);
    }
  }
  uniqueTimeSlots.sort();

  const normalizedPricingMode = pricingMode === 'fixed' ? 'fixed' : 'auto';
  if (normalizedPricingMode === 'fixed' && (price == null || !Number.isSafeInteger(Number(price)) || Number(price) <= 0)) {
    return { error: { status: 400, message: 'Giá vé cố định không hợp lệ.' } };
  }

  // Count matching days and total expected showtimes before querying DB
  const matchedDates = [];
  for (let d = 0; d < rangeDays; d++) {
    const dateMs = startMs + d * msPerDay;
    const dateStr = businessDate(new Date(dateMs));
    const dow = new Date(`${dateStr}T12:00:00+07:00`).getUTCDay();
    if (seenDays.has(dow)) {
      matchedDates.push({ dateStr, dow });
    }
  }

  const totalExpected = matchedDates.length * uniqueTimeSlots.length;
  if (totalExpected > RECURRING_MAX_EXPECTED_SLOTS) {
    return {
      error: {
        status: 400,
        message: `Tổng số suất dự kiến (${totalExpected} suất) vượt quá giới hạn tối đa ${RECURRING_MAX_EXPECTED_SLOTS} suất mỗi lần lặp lịch.`,
      },
    };
  }

  const cleaningMinutes = normalizeCleaningMinutes(rawCleaning, DEFAULT_CLEANING_MINUTES);

  return {
    params: {
      movieId,
      roomId,
      cinemaId,
      formatFeature: typeof formatFeature === 'string' && formatFeature.trim() ? formatFeature.trim() : '',
      startDate,
      endDate,
      startMs,
      endMs,
      rangeDays,
      daysOfWeek: uniqueDays,
      timeSlots: uniqueTimeSlots,
      matchedDates,
      totalExpected,
      pricingMode: normalizedPricingMode,
      price: normalizedPricingMode === 'fixed' ? Number(price) : undefined,
      cleaningMinutes,
      skipConflicts: Boolean(skipConflicts),
    },
  };
}

function buildRecurringPlan({ params, movie, room, existingShowtimes, pricing, now = new Date() }) {
  const duration = Number(movie.duration);
  const cleaningMinutes = params.cleaningMinutes;
  const durationMs = duration * 60000;
  const cleaningMs = cleaningMinutes * 60000;
  const usedFormatFeature = params.formatFeature || room.formatFeature || '2D Tiêu chuẩn';
  const roomTotalSeats = Number(room.totalSeats) || SEAT_GRID_CONFIG.totalSeats;
  const canonicalRoomType = resolveCanonicalRoomType(room);
  const localRelease = movie.releaseDate ? businessDate(movie.releaseDate) : null;
  const nowMs = now.getTime();

  // Build occupied intervals from existing active showtimes (including overnight from previous day)
  const existingIntervals = [];
  for (const st of existingShowtimes) {
    const lc = computeShowtimeLifecycle(st, now);
    if (lc.lifecycleStatus === 'COMPLETED' || lc.lifecycleStatus === 'CANCELLED') continue;
    const s = lc.startTime.getTime();
    const e = lc.endTime.getTime();
    const blockedUntil = lc.cleaningEndTime.getTime();
    const stDate = businessDate(lc.startTime);
    const stStartText = lc.startTime.toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    const stCleanText = lc.cleaningEndTime.toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    existingIntervals.push({
      s,
      e,
      blockedUntil,
      source: 'EXISTING_DB',
      label: `${st.movieId?.title || 'Suất hiện có'} (${stDate} ${stStartText}–${stCleanText})`,
    });
  }

  const validSlots = [];
  const conflictSlots = [];
  const batchIntervals = [];

  for (const { dateStr, dow } of params.matchedDates) {
    for (const slot of params.timeSlots) {
      const slotStartObj = new Date(`${dateStr}T${slot}:00+07:00`);
      const slotStart = slotStartObj.getTime();
      const slotEnd = slotStart + durationMs;
      const slotBlock = slotEnd + cleaningMs;

      const startMin = parseHHMMToMinutes(slot, 0);
      const endMin = startMin + duration;
      const cleanEndMin = endMin + cleaningMinutes;
      const readyMin = Math.ceil(cleanEndMin / 5) * 5;

      const startTimeText = formatMinutesToVNTime(startMin, false);
      const endTimeText = formatMinutesToVNTime(endMin, true);
      const cleaningEndTimeText = formatMinutesToVNTime(cleanEndMin, true);
      const readyTimeText = formatMinutesToVNTime(readyMin, true);

      const calculated = calculatePricesFromConfig(
        {
          roomName: room.name,
          roomType: canonicalRoomType,
          formatFeature: usedFormatFeature,
          startTime: slotStartObj,
        },
        pricing,
        { preferRuleMatrix: true }
      );
      const resolvedPrice = params.pricingMode === 'fixed' ? params.price : calculated.priceStandard;

      let conflictReason = null;

      if (localRelease && dateStr < localRelease) {
        conflictReason = `Trước ngày khởi chiếu phim (${localRelease}).`;
      } else if (slotStart <= nowMs) {
        conflictReason = 'Thời gian chiếu đã qua (nằm trong quá khứ).';
      } else if (startMin < RECURRING_OPEN_MIN || startMin > RECURRING_LATEST_START_MIN || cleanEndMin > RECURRING_CLOSING_LIMIT_MIN) {
        conflictReason = 'Vượt khung giờ vận hành rạp (mở suất 08:00–22:30, kết thúc & vệ sinh xong trước 02:00 sáng hôm sau).';
      } else {
        const dbConflict = existingIntervals.find((iv) => slotStart < iv.blockedUntil && slotBlock > iv.s);
        if (dbConflict) {
          conflictReason = `Trùng lịch chiếu hoặc thiếu ${cleaningMinutes} phút dọn phòng với ${dbConflict.label}.`;
        } else {
          const intraConflict = batchIntervals.find((iv) => slotStart < iv.blockedUntil && slotBlock > iv.s);
          if (intraConflict) {
            conflictReason = `Trùng lịch hoặc thiếu ${cleaningMinutes} phút dọn phòng với suất ${intraConflict.slot} trong cùng yêu cầu (${intraConflict.label}).`;
          }
        }
      }

      const slotRecord = {
        slotKey: `${slotStartObj.toISOString()}||${String(room._id)}`,
        date: dateStr,
        dayOfWeek: dow,
        time: slot,
        startTimeText,
        endTimeText,
        cleaningEndTimeText,
        readyTimeText,
        cleaningMinutes,
        duration,
        movieId: String(movie._id),
        movieTitle: movie.title,
        roomId: String(room._id),
        roomName: room.name,
        roomType: canonicalRoomType,
        totalSeats: roomTotalSeats,
        formatFeature: usedFormatFeature,
        startTime: slotStartObj.toISOString(),
        endTime: new Date(slotEnd).toISOString(),
        cleanReadyTime: new Date(slotBlock).toISOString(),
        price: resolvedPrice,
        priceVip: calculated.priceVip,
        priceSweetbox: calculated.priceSweetbox,
      };

      if (conflictReason) {
        conflictSlots.push({
          ...slotRecord,
          status: 'CONFLICT',
          conflictReason,
          reason: conflictReason,
        });
      } else {
        batchIntervals.push({
          s: slotStart,
          e: slotEnd,
          blockedUntil: slotBlock,
          slot,
          label: `${dateStr} ${startTimeText}–${cleaningEndTimeText}`,
        });
        validSlots.push({
          ...slotRecord,
          status: 'VALID',
        });
      }
    }
  }

  const slotAvailability = {};
  for (const t of params.timeSlots) {
    slotAvailability[t] = { available: 0, conflict: 0, totalDays: params.matchedDates.length };
  }
  for (const vs of validSlots) {
    if (slotAvailability[vs.time]) slotAvailability[vs.time].available++;
  }
  for (const cs of conflictSlots) {
    if (slotAvailability[cs.time]) slotAvailability[cs.time].conflict++;
  }

  const previewSignature = buildRecurringSignature({
    movieId: movie._id,
    roomId: room._id,
    formatFeature: usedFormatFeature,
    startDate: params.startDate,
    endDate: params.endDate,
    daysOfWeek: params.daysOfWeek,
    timeSlots: params.timeSlots,
    cleaningMinutes: params.cleaningMinutes,
    validIsoList: validSlots.map((s) => s.startTime),
  });

  return {
    movieId: String(movie._id),
    movieTitle: movie.title,
    duration,
    releaseDate: localRelease,
    roomId: String(room._id),
    roomName: room.name,
    roomType: canonicalRoomType,
    cinemaId: String(room.cinemaId),
    formatFeature: usedFormatFeature,
    cleaningMinutes,
    totalSeatsPerShowtime: roomTotalSeats,
    startDate: params.startDate,
    endDate: params.endDate,
    rangeDays: params.rangeDays,
    selectedDaysCount: params.matchedDates.length,
    daysOfWeek: params.daysOfWeek,
    timeSlots: params.timeSlots,
    totalExpected: validSlots.length + conflictSlots.length,
    validCount: validSlots.length,
    conflictCount: conflictSlots.length,
    totalExpectedSeats: validSlots.length * roomTotalSeats,
    validSlots,
    conflictSlots,
    slotAvailability,
    previewSignature,
  };
}

export const previewRecurringShowtimes = async (req, res) => {
  try {
    const normalized = normalizeRecurringInputs(req.body);
    if (normalized.error) {
      return res.status(normalized.error.status).json({ message: normalized.error.message });
    }
    const { params } = normalized;

    // 100% READ-ONLY: Use getPricingConfigReadOnly() instead of ensurePricingConfig() so zero DB writes occur
    const [movie, room, pricing] = await Promise.all([
      Movie.findById(params.movieId).lean(),
      Room.findById(params.roomId).lean(),
      getPricingConfigReadOnly(),
    ]);

    if (!movie) return res.status(404).json({ message: 'Không tìm thấy phim.' });
    if (movie.status === 'ENDED') {
      return res.status(400).json({ message: 'Phim đã ngừng chiếu (ENDED), không thể xếp lịch lặp.' });
    }
    const duration = Number(movie.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      return res.status(400).json({ message: 'Phim chưa có thời lượng hợp lệ.' });
    }

    if (!room) return res.status(404).json({ message: 'Phòng chiếu không tồn tại.' });
    if (room.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Phòng chiếu đang bảo trì (MAINTENANCE), không thể xếp lịch.' });
    }
    if (params.cinemaId && params.cinemaId !== 'ALL' && String(room.cinemaId) !== String(params.cinemaId)) {
      return res.status(400).json({ message: 'Phòng không thuộc cụm rạp đã chọn.' });
    }
    if (params.formatFeature && !isFormatCompatibleWithRoom(params.formatFeature, room)) {
      return res.status(400).json({
        message: `Định dạng "${params.formatFeature}" không tương thích với loại phòng "${room.roomType || room.name}".`,
      });
    }

    // Query existing showtimes with 1-day lookback & lookahead to catch overnight showtimes crossing 00:00-02:00
    const lookbackStart = new Date(params.startMs - 86400000);
    const lookaheadEnd = new Date(params.endMs + 2 * 86400000);
    const existingShowtimes = await Showtime.find({
      $or: [
        { roomId: room._id },
        { roomId: null, cinemaId: room.cinemaId, roomName: { $in: [room.name, room.shortName].filter(Boolean) } },
      ],
      cancelledAt: null,
      startTime: { $gte: lookbackStart, $lte: lookaheadEnd },
    })
      .select('movieId startTime endTime cleaningMinutes cleaningEndTime lifecycleStatus cancelledAt')
      .populate('movieId', 'title duration')
      .lean();

    const plan = buildRecurringPlan({
      params,
      movie,
      room,
      existingShowtimes,
      pricing,
      now: new Date(),
    });

    return res.json(plan);
  } catch (error) {
    console.error('previewRecurringShowtimes error:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo preview lịch chiếu lặp.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// RECURRING SHOWTIME – Commit (creates Showtime + 88 ShowtimeSeats atomically)
// ════════════════════════════════════════════════════════════════════════════════
const _recurringRequestCache = new Map();

export const commitRecurringShowtimes = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      confirmedSlots,
      requestId,
      skipConflicts: rawSkipConflicts,
      cleaningMinutes: rawCleaningMinutes,
      previewSignature,
      pricingMode: rawPricingMode,
      price: rawFixedPrice,
    } = body;

    const cleanReqId =
      requestId && typeof requestId === 'string' && requestId.trim() ? requestId.trim() : null;

    const hasRecurringParams =
      Boolean(body.startDate) &&
      Boolean(body.endDate) &&
      Array.isArray(body.daysOfWeek) &&
      Array.isArray(body.timeSlots);

    const hasConfirmedSlots = Array.isArray(confirmedSlots) && confirmedSlots.length > 0;

    if (!hasRecurringParams && !hasConfirmedSlots) {
      return res.status(400).json({ message: 'Danh sách suất chiếu xác nhận hoặc tham số lặp lịch trống.' });
    }

    if (hasConfirmedSlots && confirmedSlots.length > RECURRING_MAX_EXPECTED_SLOTS) {
      return res.status(400).json({
        message: `Tối đa ${RECURRING_MAX_EXPECTED_SLOTS} suất chiếu mỗi lần tạo hàng loạt.`,
      });
    }

    let normalizedParams = null;
    if (hasRecurringParams) {
      const normalized = normalizeRecurringInputs(body);
      if (normalized.error) {
        return res.status(normalized.error.status).json({ message: normalized.error.message });
      }
      normalizedParams = normalized.params;
    }

    // Resolve target movieId & roomId (fixed single movie & single physical room per recurring schedule)
    const targetMovieId = normalizedParams?.movieId || confirmedSlots?.[0]?.movieId || body.movieId;
    const targetRoomId = normalizedParams?.roomId || confirmedSlots?.[0]?.roomId || body.roomId;
    const targetCinemaId = normalizedParams?.cinemaId || confirmedSlots?.[0]?.cinemaId || body.cinemaId;
    const cleaningMinutes = normalizeCleaningMinutes(
      normalizedParams?.cleaningMinutes ?? rawCleaningMinutes ?? confirmedSlots?.[0]?.cleaningMinutes,
      DEFAULT_CLEANING_MINUTES
    );
    const skipConflicts = rawSkipConflicts !== undefined ? Boolean(rawSkipConflicts) : false;
    const effectivePricingMode =
      normalizedParams?.pricingMode || (rawPricingMode === 'fixed' ? 'fixed' : 'auto');
    const effectiveFixedPrice =
      effectivePricingMode === 'fixed'
        ? normalizedParams?.price ?? (Number.isSafeInteger(Number(rawFixedPrice)) && Number(rawFixedPrice) > 0 ? Number(rawFixedPrice) : undefined)
        : undefined;
    if (effectivePricingMode === 'fixed' && !effectiveFixedPrice) {
      return res.status(400).json({ message: 'Giá vé cố định không hợp lệ.' });
    }

    if (!mongoose.isObjectIdOrHexString(targetMovieId) || !mongoose.isObjectIdOrHexString(targetRoomId)) {
      return res.status(400).json({ message: 'movieId hoặc roomId không hợp lệ.' });
    }

    // Ensure all confirmedSlots belong to the same single movie and single room
    if (hasConfirmedSlots) {
      for (const s of confirmedSlots) {
        if (String(s.movieId) !== String(targetMovieId) || String(s.roomId) !== String(targetRoomId)) {
          return res.status(400).json({
            message: 'Tính năng lặp lịch cố định một bộ phim và một phòng chiếu vật lý trong suốt đợt lặp.',
          });
        }
      }
    }

    const [movie, initialRoom, pricing] = await Promise.all([
      Movie.findById(targetMovieId).lean(),
      Room.findById(targetRoomId).lean(),
      ensurePricingConfig(),
    ]);

    if (!movie) return res.status(404).json({ message: 'Không tìm thấy phim.' });
    if (movie.status === 'ENDED') {
      return res.status(400).json({ message: 'Phim đã ngừng chiếu (ENDED), không thể tạo lịch lặp.' });
    }
    const duration = Number(movie.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      return res.status(400).json({ message: 'Phim chưa có thời lượng hợp lệ.' });
    }

    if (!initialRoom) return res.status(404).json({ message: 'Phòng chiếu không tồn tại.' });
    if (initialRoom.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Phòng chiếu đang bảo trì (MAINTENANCE), không thể tạo lịch.' });
    }
    if (targetCinemaId && targetCinemaId !== 'ALL' && String(initialRoom.cinemaId) !== String(targetCinemaId)) {
      return res.status(400).json({ message: 'Phòng không thuộc cụm rạp đã chọn.' });
    }

    const requestedFormat =
      normalizedParams?.formatFeature ||
      (typeof body.formatFeature === 'string' && body.formatFeature.trim() ? body.formatFeature.trim() : '') ||
      (typeof confirmedSlots?.[0]?.formatFeature === 'string' && confirmedSlots[0].formatFeature.trim()
        ? confirmedSlots[0].formatFeature.trim()
        : '');

    if (requestedFormat && !isFormatCompatibleWithRoom(requestedFormat, initialRoom)) {
      return res.status(400).json({
        message: `Định dạng "${requestedFormat}" không tương thích với loại phòng "${initialRoom.roomType || initialRoom.name}".`,
      });
    }

    const usedFormatFeature = requestedFormat || initialRoom.formatFeature || '2D Tiêu chuẩn';

    // Validate previewSignature if provided (tamper resistance)
    let signatureApprovedIsoSet = null;
    if (previewSignature !== undefined && previewSignature !== null && previewSignature !== '') {
      if (typeof previewSignature !== 'string' || !previewSignature.includes('::SIG=')) {
        return res.status(400).json({
          message: 'previewSignature không hợp lệ hoặc đã bị chỉnh sửa trái phép.',
        });
      }
      const [rawSigPayload, providedHmac] = previewSignature.split('::SIG=');
      const expectedHmac = crypto
        .createHmac('sha256', computeRecurringSignSecret())
        .update(rawSigPayload)
        .digest('hex');
      if (providedHmac !== expectedHmac) {
        return res.status(400).json({
          message: 'previewSignature không khớp chữ ký bảo mật (phát hiện can thiệp dữ liệu Preview).',
        });
      }
      const sigParts = rawSigPayload.split('::');
      const [sigMovieId, sigRoomId, sigFormat, sigStart, sigEnd, sigDays, sigTimes, sigCleaning, sigValidIsos] = sigParts;
      if (
        String(sigMovieId) !== String(movie._id) ||
        String(sigRoomId) !== String(initialRoom._id) ||
        String(sigFormat) !== String(usedFormatFeature) ||
        String(sigCleaning) !== String(cleaningMinutes) ||
        (normalizedParams &&
          (String(sigStart) !== String(normalizedParams.startDate) ||
            String(sigEnd) !== String(normalizedParams.endDate) ||
            String(sigDays) !== [...normalizedParams.daysOfWeek].sort((a, b) => a - b).join(',') ||
            String(sigTimes) !== [...normalizedParams.timeSlots].sort().join(',')))
      ) {
        return res.status(400).json({
          message: 'Tham số Commit không khớp với phiên Preview đã ký. Vui lòng xem trước lại lịch chiếu.',
        });
      }
      signatureApprovedIsoSet = new Set(sigValidIsos ? sigValidIsos.split('|').filter(Boolean) : []);
    }

    // Build candidate list to evaluate inside the transaction
    let candidateSlots = [];
    let preExcludedConflicts = [];
    let requestedCount = 0;

    if (normalizedParams) {
      const generatedIsoSet = new Set();
      for (const { dateStr } of normalizedParams.matchedDates) {
        for (const slot of normalizedParams.timeSlots) {
          generatedIsoSet.add(new Date(`${dateStr}T${slot}:00+07:00`).toISOString());
        }
      }

      // Reject any confirmedSlot that was NOT part of the recurring parameters or NOT approved in previewSignature
      if (hasConfirmedSlots) {
        for (const s of confirmedSlots) {
          const parsed = new Date(s.startTime);
          if (!Number.isFinite(parsed.getTime())) {
            return res.status(400).json({ message: 'startTime trong confirmedSlots không hợp lệ.' });
          }
          const iso = parsed.toISOString();
          if (!generatedIsoSet.has(iso)) {
            return res.status(400).json({
              message: `Suất chiếu "${s.startTime}" trong confirmedSlots không nằm trong khung lặp lịch đã chọn.`,
            });
          }
          if (signatureApprovedIsoSet && !signatureApprovedIsoSet.has(iso)) {
            return res.status(400).json({
              message: `Suất chiếu "${s.startTime}" không thuộc danh sách hợp lệ của phiên Preview.`,
            });
          }
        }
      }

      const allowedIsoSet = hasConfirmedSlots
        ? new Set(confirmedSlots.map((s) => new Date(s.startTime).toISOString()))
        : null;

      for (const { dateStr, dow } of normalizedParams.matchedDates) {
        for (const slot of normalizedParams.timeSlots) {
          const slotStartObj = new Date(`${dateStr}T${slot}:00+07:00`);
          const iso = slotStartObj.toISOString();
          if (allowedIsoSet && !allowedIsoSet.has(iso)) {
            if (!skipConflicts) {
              // Keep in candidateSlots so skipConflicts=false still checks all requested slots
            } else {
              // Admin or Preview excluded this slot when skipConflicts=true -> do NOT recreate it
              continue;
            }
          }
          candidateSlots.push({
            date: dateStr,
            dayOfWeek: dow,
            time: slot,
            startTimeObj: slotStartObj,
            formatFeature: usedFormatFeature,
            price: effectivePricingMode === 'fixed' ? effectiveFixedPrice : undefined,
          });
        }
      }
      requestedCount = hasConfirmedSlots && skipConflicts ? confirmedSlots.length : normalizedParams.totalExpected;
    } else {
      // Only confirmedSlots provided
      const seenIso = new Set();
      for (const s of confirmedSlots) {
        const startObj = new Date(s.startTime);
        if (!Number.isFinite(startObj.getTime())) {
          return res.status(400).json({ message: 'startTime trong confirmedSlots không hợp lệ.' });
        }
        const iso = startObj.toISOString();
        if (signatureApprovedIsoSet && !signatureApprovedIsoSet.has(iso)) {
          return res.status(400).json({
            message: `Suất chiếu "${s.startTime}" không thuộc danh sách hợp lệ của phiên Preview.`,
          });
        }
        if (seenIso.has(iso)) continue;
        seenIso.add(iso);
        const dateStr = businessDate(startObj);
        const timeStr = startObj.toLocaleTimeString('sv-SE', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
        });
        const dow = new Date(`${dateStr}T12:00:00+07:00`).getUTCDay();
        const slotFmt =
          typeof s.formatFeature === 'string' && s.formatFeature.trim()
            ? s.formatFeature.trim()
            : usedFormatFeature;
        if (!isFormatCompatibleWithRoom(slotFmt, initialRoom)) {
          return res.status(400).json({
            message: `Định dạng "${slotFmt}" không tương thích với loại phòng "${initialRoom.roomType || initialRoom.name}".`,
          });
        }
        // Never trust client-supplied price unless pricingMode === 'fixed'
        candidateSlots.push({
          date: dateStr,
          dayOfWeek: dow,
          time: timeStr,
          startTimeObj: startObj,
          formatFeature: slotFmt,
          price: effectivePricingMode === 'fixed' ? effectiveFixedPrice : undefined,
        });
      }
      candidateSlots.sort((a, b) => a.startTimeObj.getTime() - b.startTimeObj.getTime());
      if (candidateSlots.length > 1) {
        const minDate = candidateSlots[0].date;
        const maxDate = candidateSlots[candidateSlots.length - 1].date;
        const spanDays =
          Math.round(
            (new Date(`${maxDate}T00:00:00+07:00`).getTime() - new Date(`${minDate}T00:00:00+07:00`).getTime()) /
              86400000
          ) + 1;
        if (spanDays > RECURRING_MAX_RANGE_DAYS) {
          return res.status(400).json({
            message: `Khoảng ngày lặp lịch tối đa ${RECURRING_MAX_RANGE_DAYS} ngày (yêu cầu ${spanDays} ngày).`,
          });
        }
      }
      requestedCount = candidateSlots.length;
    }

    // Persistent + In-Memory Idempotency Check with Payload Fingerprint Verification
    const requestFingerprint = cleanReqId
      ? computeRecurringRequestFingerprint({
          movieId: movie._id,
          roomId: initialRoom._id,
          formatFeature: usedFormatFeature,
          cleaningMinutes,
          pricingMode: effectivePricingMode,
          price: effectiveFixedPrice,
          skipConflicts,
          candidateIsoList: candidateSlots.map((c) => c.startTimeObj.toISOString()),
        })
      : null;

    if (cleanReqId) {
      const cachedEntry = _recurringRequestCache.get(cleanReqId);
      if (cachedEntry) {
        const isPayloadMismatch = cachedEntry.fingerprint !== requestFingerprint;
        return res.status(409).json({
          message: isPayloadMismatch
            ? 'requestId đã được sử dụng với dữ liệu payload khác. Từ chối thực thi.'
            : 'Yêu cầu tạo lịch lặp này đã được xử lý (chống gửi trùng lặp).',
          duplicateRequest: true,
          payloadMismatch: isPayloadMismatch,
        });
      }

      const existingByRequestId = await Showtime.findOne({ requestId: cleanReqId })
        .select('_id requestFingerprint')
        .lean();
      if (existingByRequestId) {
        const isPayloadMismatch =
          Boolean(existingByRequestId.requestFingerprint) &&
          existingByRequestId.requestFingerprint !== requestFingerprint;
        _recurringRequestCache.set(cleanReqId, {
          fingerprint: existingByRequestId.requestFingerprint || requestFingerprint,
          timestamp: Date.now(),
        });
        return res.status(409).json({
          message: isPayloadMismatch
            ? 'requestId đã tồn tại trong cơ sở dữ liệu với dữ liệu payload khác. Từ chối thực thi.'
            : 'Yêu cầu tạo lịch lặp này đã được ghi nhận trong cơ sở dữ liệu (chống gửi trùng lặp sau khi khởi động lại).',
          duplicateRequest: true,
          payloadMismatch: isPayloadMismatch,
        });
      }
    }

    if (candidateSlots.length > RECURRING_MAX_EXPECTED_SLOTS) {
      return res.status(400).json({
        message: `Tổng số suất dự kiến (${candidateSlots.length}) vượt quá giới hạn tối đa ${RECURRING_MAX_EXPECTED_SLOTS} suất.`,
      });
    }

    const batchId =
      'BATCH-' +
      Date.now().toString(36).toUpperCase() +
      '-' +
      Math.random().toString(36).slice(2, 7).toUpperCase();

    const expectedRoomSeats = Number(initialRoom.totalSeats) || SEAT_GRID_CONFIG.totalSeats;
    const seatTemplates = await resolveSeatTemplatesForRoom(initialRoom);
    if (!isValidRoomSeatTemplate(seatTemplates, expectedRoomSeats)) {
      return res.status(500).json({
        message: `Sơ đồ mẫu ghế của phòng ${initialRoom.name} không hợp lệ (${seatTemplates.length}/${expectedRoomSeats} ghế).`,
      });
    }

    const localRelease = movie.releaseDate ? businessDate(movie.releaseDate) : null;
    const durationMs = duration * 60000;
    const cleaningMs = cleaningMinutes * 60000;
    const canonicalRoomType = resolveCanonicalRoomType(initialRoom);

    let txResult = null;

    await mongoose.connection.transaction(async (session) => {
      // Lock the target physical room (increments scheduleRevision, serializes concurrent commits)
      const room = await lockRoom(initialRoom._id, session);
      const now = new Date();
      const nowMs = now.getTime();

      const minStartMs = candidateSlots.length
        ? Math.min(...candidateSlots.map((c) => c.startTimeObj.getTime()))
        : nowMs;
      const maxStartMs = candidateSlots.length
        ? Math.max(...candidateSlots.map((c) => c.startTimeObj.getTime()))
        : nowMs;

      const lookbackStart = new Date(minStartMs - 86400000);
      const lookaheadEnd = new Date(maxStartMs + 2 * 86400000);

      const existingShowtimes = await Showtime.find({
        $or: [
          { roomId: room._id },
          { roomId: null, cinemaId: room.cinemaId, roomName: { $in: [room.name, room.shortName].filter(Boolean) } },
        ],
        cancelledAt: null,
        startTime: { $gte: lookbackStart, $lte: lookaheadEnd },
      })
        .select('movieId startTime endTime cleaningMinutes cleaningEndTime lifecycleStatus cancelledAt')
        .populate('movieId', 'title duration')
        .session(session)
        .lean();

      const existingIntervals = [];
      for (const st of existingShowtimes) {
        const lc = computeShowtimeLifecycle(st, now);
        if (lc.lifecycleStatus === 'COMPLETED' || lc.lifecycleStatus === 'CANCELLED') continue;
        const s = lc.startTime.getTime();
        const blockedUntil = lc.cleaningEndTime.getTime();
        const stDate = businessDate(lc.startTime);
        const stStartText = lc.startTime.toLocaleTimeString('sv-SE', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
        });
        const stCleanText = lc.cleaningEndTime.toLocaleTimeString('sv-SE', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
        });
        existingIntervals.push({
          s,
          blockedUntil,
          label: `${st.movieId?.title || 'Suất hiện có'} (${stDate} ${stStartText}–${stCleanText})`,
        });
      }

      const validToCreate = [];
      const detectedConflicts = [...preExcludedConflicts];
      const batchIntervals = [];

      for (const cand of candidateSlots) {
        const slotStart = cand.startTimeObj.getTime();
        const slotEnd = slotStart + durationMs;
        const slotBlock = slotEnd + cleaningMs;
        const startMin = parseHHMMToMinutes(cand.time, 0);
        const endMin = startMin + duration;
        const cleanEndMin = endMin + cleaningMinutes;

        let reason = null;
        if (localRelease && cand.date < localRelease) {
          reason = `Trước ngày khởi chiếu phim (${localRelease}).`;
        } else if (slotStart <= nowMs) {
          reason = 'Thời gian chiếu đã qua (nằm trong quá khứ).';
        } else if (startMin < RECURRING_OPEN_MIN || startMin > RECURRING_LATEST_START_MIN || cleanEndMin > RECURRING_CLOSING_LIMIT_MIN) {
          reason = 'Vượt khung giờ vận hành rạp (08:00–22:30, kết thúc vệ sinh trước 02:00 sáng hôm sau).';
        } else {
          const dbConflict = existingIntervals.find((iv) => slotStart < iv.blockedUntil && slotBlock > iv.s);
          if (dbConflict) {
            reason = `Trùng lịch chiếu hoặc thiếu ${cleaningMinutes} phút dọn phòng với ${dbConflict.label}.`;
          } else {
            const intraConflict = batchIntervals.find((iv) => slotStart < iv.blockedUntil && slotBlock > iv.s);
            if (intraConflict) {
              reason = `Trùng lịch hoặc thiếu ${cleaningMinutes} phút dọn phòng với suất ${intraConflict.time} trong cùng yêu cầu.`;
            }
          }
        }

        const calculated = calculatePricesFromConfig(
          {
            roomName: room.name,
            roomType: canonicalRoomType,
            formatFeature: cand.formatFeature,
            startTime: cand.startTimeObj,
          },
          pricing,
          { preferRuleMatrix: true }
        );
        const resolvedPrice = cand.price ?? calculated.priceStandard;

        if (reason) {
          detectedConflicts.push({
            date: cand.date,
            dayOfWeek: cand.dayOfWeek,
            time: cand.time,
            movieId: String(movie._id),
            movieTitle: movie.title,
            roomId: String(room._id),
            roomName: room.name,
            formatFeature: cand.formatFeature,
            startTime: cand.startTimeObj.toISOString(),
            endTime: new Date(slotEnd).toISOString(),
            cleanReadyTime: new Date(slotBlock).toISOString(),
            price: resolvedPrice,
            status: 'CONFLICT',
            conflictReason: reason,
            reason,
          });
        } else {
          batchIntervals.push({ s: slotStart, blockedUntil: slotBlock, time: cand.time });
          validToCreate.push({
            ...cand,
            slotEndObj: new Date(slotEnd),
            slotBlockObj: new Date(slotBlock),
            resolvedPrice,
          });
        }
      }

      // If skipConflicts === false and ANY conflict exists, abort entire transaction (All-or-Nothing)
      if (!skipConflicts && detectedConflicts.length > 0) {
        const err = new ScheduleConflict(
          `Phát hiện ${detectedConflicts.length} suất chiếu bị xung đột lịch hoặc không hợp lệ. Đã hủy toàn bộ giao dịch (không tạo lịch một phần).`
        );
        err.conflicts = detectedConflicts;
        err.requiresRePreview = Boolean(previewSignature);
        throw err;
      }

      const showtimeDocsToInsert = [];
      for (const item of validToCreate) {
        const initialLifecycle = computeShowtimeLifecycle(
          {
            startTime: item.startTimeObj,
            endTime: item.slotEndObj,
            cleaningMinutes,
          },
          now
        );
        showtimeDocsToInsert.push({
          _id: new mongoose.Types.ObjectId(),
          movieId: movie._id,
          cinemaId: room.cinemaId,
          roomId: room._id,
          roomName: room.name,
          formatFeature: item.formatFeature,
          startTime: item.startTimeObj,
          endTime: item.slotEndObj,
          cleaningMinutes,
          cleaningEndTime: item.slotBlockObj,
          lifecycleStatus: initialLifecycle.lifecycleStatus,
          price: item.resolvedPrice,
          batchId,
          requestId: cleanReqId,
          requestFingerprint,
          creationSource: 'RECURRING',
          createdBy: req.admin?._id || req.user?._id || null,
        });
      }

      let insertedShowtimes = [];
      if (showtimeDocsToInsert.length > 0) {
        insertedShowtimes = await Showtime.insertMany(showtimeDocsToInsert, { session, ordered: true });
        const allSeatDocs = [];
        for (const stDoc of insertedShowtimes) {
          for (const { row, col, seatNumber, type } of seatTemplates) {
            allSeatDocs.push({
              roomId: room._id,
              showtimeId: stDoc._id,
              row,
              col,
              seatNumber,
              type,
              status: 'AVAILABLE',
            });
          }
        }
        const insertedSeats = await ShowtimeSeat.insertMany(allSeatDocs, { session, ordered: true });
        if (!Array.isArray(insertedSeats) || insertedSeats.length !== insertedShowtimes.length * expectedRoomSeats) {
          throw new Error(
            `Lỗi toàn vẹn ghế: chỉ tạo được ${insertedSeats?.length || 0}/${
              insertedShowtimes.length * expectedRoomSeats
            } ghế.`
          );
        }
      }

      const createdList = insertedShowtimes.map((stDoc) => ({
        id: String(stDoc._id),
        _id: String(stDoc._id),
        movieId: String(stDoc.movieId),
        movieTitle: movie.title,
        roomId: String(stDoc.roomId),
        roomName: stDoc.roomName,
        formatFeature: stDoc.formatFeature,
        startTime: stDoc.startTime,
        endTime: stDoc.endTime,
        cleaningMinutes: stDoc.cleaningMinutes,
        cleaningEndTime: stDoc.cleaningEndTime,
        price: stDoc.price,
        totalSeats: expectedRoomSeats,
      }));

      txResult = {
        created: createdList,
        skipped: skipConflicts ? detectedConflicts : [],
        conflicts: detectedConflicts,
      };
    });

    if (cleanReqId) {
      _recurringRequestCache.set(cleanReqId, {
        fingerprint: requestFingerprint,
        timestamp: Date.now(),
      });
      setTimeout(() => _recurringRequestCache.delete(cleanReqId), 10 * 60 * 1000).unref();
    }

    const created = txResult?.created || [];
    const skipped = txResult?.skipped || [];
    const conflicts = txResult?.conflicts || [];
    const failed = [];

    return res.status(201).json({
      message:
        skipped.length === 0
          ? `Đã tạo thành công ${created.length} suất chiếu (${created.length * expectedRoomSeats} ghế).`
          : `Đã tạo ${created.length}/${requestedCount} suất chiếu hợp lệ, bỏ qua ${skipped.length} suất bị trùng lịch.`,
      batchId,
      requestedCount,
      createdCount: created.length,
      successCount: created.length,
      skippedCount: skipped.length,
      failedCount: 0,
      totalSeatsCreated: created.length * expectedRoomSeats,
      createdShowtimes: created,
      created,
      skipped,
      conflicts,
      failed,
    });
  } catch (error) {
    if (error instanceof ScheduleConflict) {
      return res.status(409).json({
        message: error.message,
        rolledBack: true,
        requiresRePreview: Boolean(error.requiresRePreview),
        createdCount: 0,
        successCount: 0,
        skippedCount: 0,
        failedCount: 0,
        createdShowtimes: [],
        created: [],
        conflicts: error.conflicts || [],
        skipped: [],
        failed: [],
      });
    }
    console.error('commitRecurringShowtimes error:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo lịch chiếu lặp.', error: error.message });
  }
};
