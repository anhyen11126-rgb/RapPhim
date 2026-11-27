import { getCancellationRefundUpdate } from '../services/bookingRefundService.js';
import Room from '../models/Room.js';
import Concession from '../models/Concession.js';
import { calculatePricesFromConfig, ensurePricingConfig } from '../services/pricingConfigService.js';
import { resolveVoucher } from './promotionController.js';
import { opensMoreThanSevenDaysAhead } from '../services/bookingPolicy.js';
import mongoose from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import Booking from '../models/Booking.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Showtime from '../models/Showtime.js';
import { normalizeSeatCode } from './showtimeController.js';


/**
 * Xử lý yêu cầu chọn ghế:
 * Theo nguyên tắc mới: KHÔNG khóa ghế tạm thời trong DB khi khách chỉ chọn ghế.
 * Ghế chỉ mang tính chất chọn hiển thị trên client.
 */
class BookingConflict extends Error {}

async function assertSellableShowtime(showtime, session) {
  const result = await Showtime.updateOne({
    _id: showtime._id,
    startTime: { $gt: new Date() },
    roomId: showtime.roomId,
    price: showtime.price,
    isLocked: { $ne: true },
    cancelledAt: null,
  }, { $inc: { bookingRevision: 1 } }, { session });
  if (result.modifiedCount !== 1) throw new BookingConflict('Suất chiếu vừa thay đổi. Vui lòng tải lại.');
}

const HOLD_DURATION_SECONDS = 600; // 10 phút

async function claimSeats(showtimeId, seatNumbers, bookingId, session, holdOptions = {}) {
  const { holdId, userId, now = new Date() } = holdOptions;

  if (holdId) {
    // Kiểm tra đúng phiên giữ ghế của người sở hữu, chưa hết hạn và khớp danh sách ghế
    const heldSeats = await ShowtimeSeat.find({
      showtimeId,
      holdId,
      holdOwnerId: userId,
      status: 'HOLDING',
      holdExpiresAt: { $gt: now },
    })
      .select('seatNumber')
      .session(session)
      .lean();

    const heldSet = new Set(heldSeats.map((s) => s.seatNumber));
    const exactMatch =
      heldSeats.length === seatNumbers.length && seatNumbers.every((code) => heldSet.has(code));

    if (!exactMatch) {
      throw new BookingConflict('Phiên giữ ghế không hợp lệ, đã hết hạn hoặc không khớp danh sách ghế.');
    }

    const result = await ShowtimeSeat.updateMany(
      {
        showtimeId,
        seatNumber: { $in: seatNumbers },
        status: 'HOLDING',
        holdId,
        holdOwnerId: userId,
        holdExpiresAt: { $gt: now },
      },
      {
        $set: {
          status: 'BOOKED',
          bookingId,
          holdId: null,
          holdOwnerId: null,
          holdCreatedAt: null,
          holdExpiresAt: null,
        },
      },
      { session }
    );
    if (result.modifiedCount !== seatNumbers.length) {
      throw new BookingConflict('Phiên giữ ghế vừa hết hạn hoặc thay đổi. Vui lòng chọn lại.');
    }
    return;
  }

  // Tương thích ngược khi chưa truyền holdId: chỉ cho phép ghế AVAILABLE hoặc HOLDING đã hết hạn
  const result = await ShowtimeSeat.updateMany(
    {
      showtimeId,
      seatNumber: { $in: seatNumbers },
      $or: [
        { status: 'AVAILABLE' },
        { status: 'HOLDING', holdExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: 'BOOKED',
        bookingId,
        holdId: null,
        holdOwnerId: null,
        holdCreatedAt: null,
        holdExpiresAt: null,
      },
    },
    { session }
  );
  if (result.modifiedCount !== seatNumbers.length) {
    throw new BookingConflict('Một số ghế không còn khả dụng. Vui lòng chọn lại.');
  }
}

async function releaseSeats(booking, session) {
  const seatNumbers = booking.seats.split(',').map(normalizeSeatCode).filter(Boolean);
  const released = await ShowtimeSeat.updateMany(
    { showtimeId: booking.showtimeId._id, seatNumber: { $in: seatNumbers }, bookingId: booking._id, status: 'BOOKED' },
    { $set: { status: 'AVAILABLE', bookingId: null, holdExpiresAt: null } },
    { session }
  );
  if (released.modifiedCount !== seatNumbers.length) {
    throw new BookingConflict('Cần đối chiếu lại ghế thuộc đơn trước khi tiếp tục.');
  }
}

function bookingWriteError(res, error) {
  if (error instanceof BookingConflict) {
    return res.status(409).json({ success: false, message: error.message });
  }
  console.error('Booking write failed:', error.name);
  return res.status(503).json({ success: false, message: 'Chưa thể cập nhật vé. Vui lòng kiểm tra Vé của tôi trước khi thử lại.' });
}

export const holdSeats = async (req, res) => {
  try {
    const { showtimeId, seatNumbers } = req.body;

    if (
      !mongoose.isObjectIdOrHexString(showtimeId) ||
      !Array.isArray(seatNumbers) ||
      seatNumbers.length === 0 ||
      !seatNumbers.every((s) => typeof s === 'string' && s.trim())
    ) {
      return res.status(400).json({ success: false, message: 'Dữ liệu chọn ghế không hợp lệ' });
    }

    const normalizedSeats = [...new Set(seatNumbers.map((s) => normalizeSeatCode(s)))];
    const targetShowtime = await Showtime.findById(showtimeId);
    if (!targetShowtime) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu yêu cầu.' });
    }
    if (targetShowtime.cancelledAt) {
      return res.status(409).json({ success: false, message: 'Suất chiếu này đã bị hủy.' });
    }
    if (targetShowtime.isLocked) {
      return res.status(403).json({ success: false, message: 'Suất chiếu này hiện đang tạm khóa.' });
    }

    const now = new Date();
    const showtimeStart = new Date(targetShowtime.startTime);
    if (opensMoreThanSevenDaysAhead(showtimeStart, now)) {
      return res.status(400).json({ success: false, message: 'Suất chiếu chưa mở bán (tối đa 7 ngày).' });
    }
    if (showtimeStart.getTime() <= now.getTime()) {
      return res.status(400).json({ success: false, message: 'Suất chiếu đã bắt đầu hoặc đã qua.' });
    }

    const activeRoom = targetShowtime.roomId
      ? await Room.exists({ _id: targetShowtime.roomId, status: 'ACTIVE' })
      : null;
    if (!activeRoom) {
      return res.status(409).json({ success: false, message: 'Suất chiếu chưa có phòng hoạt động.' });
    }

    const existingCount = await ShowtimeSeat.countDocuments({
      showtimeId: targetShowtime._id,
      seatNumber: { $in: normalizedSeats },
    });
    if (existingCount !== normalizedSeats.length) {
      return res.status(400).json({ success: false, message: 'Một số ghế không tồn tại trong suất chiếu.' });
    }

    const holdResult = await mongoose.connection.transaction(async (session) => {
      await assertSellableShowtime(targetShowtime, session);

      // Kiểm tra nếu chính user này đang giữ đúng nhóm ghế này và còn hạn -> trả về phiên cũ, KHÔNG gia hạn vô hạn
      const currentOwned = await ShowtimeSeat.find({
        showtimeId: targetShowtime._id,
        seatNumber: { $in: normalizedSeats },
        status: 'HOLDING',
        holdOwnerId: req.user._id,
        holdExpiresAt: { $gt: now },
      })
        .select('holdId holdExpiresAt')
        .session(session)
        .lean();

      if (
        currentOwned.length === normalizedSeats.length &&
        currentOwned[0]?.holdId &&
        currentOwned.every((s) => s.holdId === currentOwned[0].holdId)
      ) {
        return {
          holdId: currentOwned[0].holdId,
          expiresAt: currentOwned[0].holdExpiresAt,
          reused: true,
        };
      }

      const holdId = 'HOLD-' + randomBytes(12).toString('hex').toUpperCase();
      const expiresAt = new Date(now.getTime() + HOLD_DURATION_SECONDS * 1000);

      const updateRes = await ShowtimeSeat.updateMany(
        {
          showtimeId: targetShowtime._id,
          seatNumber: { $in: normalizedSeats },
          $or: [
            { status: 'AVAILABLE' },
            { status: 'HOLDING', holdExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            status: 'HOLDING',
            holdId,
            holdOwnerId: req.user._id,
            holdCreatedAt: now,
            holdExpiresAt: expiresAt,
          },
        },
        { session }
      );

      if (updateRes.modifiedCount !== normalizedSeats.length) {
        throw new BookingConflict('Một số ghế đã được khách hàng khác giữ hoặc đặt. Vui lòng chọn lại.');
      }

      return { holdId, expiresAt, reused: false };
    });

    return res.json({
      success: true,
      holdId: holdResult.holdId,
      showtimeId: String(targetShowtime._id),
      seatNumbers: normalizedSeats,
      expiresAt: new Date(holdResult.expiresAt).toISOString(),
      serverTime: now.toISOString(),
      reused: holdResult.reused,
    });
  } catch (error) {
    return bookingWriteError(res, error);
  }
};

export const getHoldSession = async (req, res) => {
  try {
    const { holdId } = req.params;
    if (!holdId || typeof holdId !== 'string' || !holdId.trim()) {
      return res.status(400).json({ success: false, message: 'Mã phiên giữ ghế không hợp lệ.' });
    }

    const now = new Date();
    const seats = await ShowtimeSeat.find({ holdId: holdId.trim(), status: 'HOLDING' })
      .select('showtimeId seatNumber row col type holdOwnerId holdCreatedAt holdExpiresAt')
      .lean();

    if (!seats.length) {
      return res.status(404).json({ success: false, code: 'HOLD_NOT_FOUND', message: 'Phiên giữ ghế không tồn tại hoặc đã kết thúc.' });
    }

    const isOwner = seats.every((s) => String(s.holdOwnerId) === String(req.user._id));
    if (!isOwner) {
      return res.status(403).json({ success: false, code: 'HOLD_FORBIDDEN', message: 'Bạn không có quyền truy cập phiên giữ ghế này.' });
    }

    const expiresAt = seats[0].holdExpiresAt ? new Date(seats[0].holdExpiresAt) : null;
    if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
      return res.status(410).json({
        success: false,
        code: 'HOLD_EXPIRED',
        showtimeId: String(seats[0].showtimeId),
        message: 'Phiên giữ ghế đã hết hạn. Vui lòng chọn lại ghế.',
      });
    }

    const showtime = await Showtime.findById(seats[0].showtimeId)
      .populate('movieId')
      .populate('cinemaId')
      .populate('roomId')
      .lean();

    if (!showtime || showtime.cancelledAt || showtime.isLocked) {
      return res.status(409).json({
        success: false,
        code: 'SHOWTIME_UNAVAILABLE',
        showtimeId: String(seats[0].showtimeId),
        message: 'Suất chiếu này hiện đã bị khóa hoặc hủy.',
      });
    }

    const pricingConfig = await ensurePricingConfig();
    const calculatedPrices = calculatePricesFromConfig(
      {
        ...showtime,
        room: showtime.roomId,
        roomId: showtime.roomId,
        roomType: showtime.roomId?.roomType,
        roomName: showtime.roomId?.name || showtime.roomName,
      },
      pricingConfig
    );
    const priceByType = {
      STANDARD: calculatedPrices.priceStandard,
      VIP: calculatedPrices.priceVip,
      SWEETBOX: calculatedPrices.priceSweetbox,
    };
    const ticketLines = seats.map((s) => {
      const seatType = String(s.type || 'STANDARD').toUpperCase();
      return {
        seatNumber: normalizeSeatCode(s.seatNumber),
        type: seatType,
        price: priceByType[seatType] ?? calculatedPrices.priceStandard,
      };
    });
    const seatTotal = ticketLines.reduce((sum, item) => sum + item.price, 0);
    const ticketPrices = {
      standard: calculatedPrices.priceStandard,
      vip: calculatedPrices.priceVip,
      sweetbox: calculatedPrices.priceSweetbox,
    };

    return res.json({
      success: true,
      holdId: holdId.trim(),
      showtimeId: String(seats[0].showtimeId),
      seatNumbers: ticketLines.map((s) => s.seatNumber),
      seatTotal,
      ticketPrices,
      ticketLines,
      expiresAt: expiresAt.toISOString(),
      serverTime: now.toISOString(),
      showtime: {
        ...showtime,
        id: showtime._id.toString(),
        price: calculatedPrices.priceStandard,
        roomName: showtime.roomId?.name || showtime.roomName,
        roomType: showtime.roomId?.roomType,
        ticketPrices,
        movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
        cinema: showtime.cinemaId ? { ...showtime.cinemaId, id: showtime.cinemaId._id.toString() } : null,
        room: showtime.roomId ? { ...showtime.roomId, id: showtime.roomId._id.toString() } : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi khi kiểm tra phiên giữ ghế', error: error.message });
  }
};

export const releaseHoldSeats = async (req, res) => {
  try {
    const { holdId } = req.params;
    if (!holdId || typeof holdId !== 'string' || !holdId.trim()) {
      return res.status(400).json({ success: false, message: 'Mã giữ ghế không hợp lệ.' });
    }

    const seatsWithHold = await ShowtimeSeat.find({ holdId: holdId.trim(), status: 'HOLDING' })
      .select('holdOwnerId')
      .lean();

    if (!seatsWithHold.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên giữ ghế đang hoạt động.' });
    }

    const isOwner = seatsWithHold.every((s) => String(s.holdOwnerId) === String(req.user._id));
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy phiên giữ ghế này.' });
    }

    const released = await ShowtimeSeat.updateMany(
      { holdId: holdId.trim(), holdOwnerId: req.user._id, status: 'HOLDING' },
      {
        $set: {
          status: 'AVAILABLE',
          holdId: null,
          holdOwnerId: null,
          holdCreatedAt: null,
          holdExpiresAt: null,
        },
      }
    );

    return res.json({
      success: true,
      releasedCount: released.modifiedCount,
      message: 'Đã giải phóng ghế giữ thành công.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi khi giải phóng ghế giữ', error: error.message });
  }
};

/**
 * Xác nhận thanh toán & Tạo mã vé điện tử chính thức
 */
export const checkoutBooking = async (req, res) => {
  try {
    const {
      showtimeId,
      seatNumbers,
      customerName,
      customerPhone,
      customerEmail,
      combos = [],
      popcornFlavor = 'cheese',
      voucherCode,
      paymentMethod = 'MOMO',
      holdId,
    } = req.body;

    if (typeof holdId !== 'string' || !holdId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng giữ ghế hợp lệ trước khi thực hiện thanh toán.',
      });
    }

    if (
      !mongoose.isObjectIdOrHexString(showtimeId) ||
      !Array.isArray(seatNumbers) ||
      seatNumbers.length === 0 ||
      !seatNumbers.every(seat => typeof seat === 'string' && seat.trim()) ||
      typeof customerName !== 'string' || !customerName.trim() ||
      typeof customerPhone !== 'string' || !customerPhone.trim() ||
      (customerEmail != null && typeof customerEmail !== 'string') ||
      !['MOMO', 'VNPAY', 'CASH', 'ATM', 'VISA'].includes(paymentMethod) ||
      !['sweet', 'cheese', 'caramel', 'seaweed'].includes(popcornFlavor) ||
      !Array.isArray(combos) ||
      !combos.every(combo => mongoose.isObjectIdOrHexString(combo?.id) &&
        Number.isSafeInteger(combo.quantity) && combo.quantity > 0) ||
      new Set(combos.map(combo => combo.id)).size !== combos.length
    ) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin đặt vé và danh sách ghế.',
      });
    }

    // 1. Chuẩn hóa danh sách ghế: ["A1", "A2", ...]
    const normalizedSeats = [...new Set(seatNumbers.map((s) => normalizeSeatCode(s)))];

    // 2. Tìm suất chiếu trong Database
    const targetShowtime = await Showtime.findById(showtimeId);

    if (!targetShowtime) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy suất chiếu yêu cầu.',
      });
    }

    if (targetShowtime.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Suất chiếu này hiện đang tạm khóa hoặc điều chỉnh lịch chiếu bởi ban quản trị. Không thể thanh toán.',
      });
    }

    // Kiểm tra quy tắc mở bán: Tối đa 7 ngày trước ngày chiếu & chưa bắt đầu
    const now = new Date();
    const showtimeStart = new Date(targetShowtime.startTime);

    if (opensMoreThanSevenDaysAhead(showtimeStart, now)) {
      return res.status(400).json({
        success: false,
        message: 'Suất chiếu này chưa mở bán. Rạp chỉ mở bán vé trước tối đa 7 ngày theo quy định!',
      });
    }

    if (showtimeStart.getTime() <= now.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'Suất chiếu này đã bắt đầu hoặc đã qua. Không thể đặt vé mới!',
      });
    }

    const activeRoom = targetShowtime.roomId
      ? await Room.findOne({ _id: targetShowtime.roomId, status: 'ACTIVE' })
          .select('name roomType formatFeature')
          .lean()
      : null;
    if (!activeRoom) {
      return res.status(409).json({ success: false, message: 'Suất chiếu chưa có phòng được xác nhận.' });
    }
    const stId = targetShowtime._id;


    const [seatDocs, comboDocs, pricingConfig] = await Promise.all([
      ShowtimeSeat.find({ showtimeId: stId, seatNumber: { $in: normalizedSeats } }).lean(),
      Concession.find({ _id: { $in: combos.map(combo => combo.id) } }).lean(),
      ensurePricingConfig(),
    ]);
    if (seatDocs.length !== normalizedSeats.length || comboDocs.length !== combos.length) {
      return res.status(400).json({ success: false, message: 'Ghế hoặc combo không hợp lệ.' });
    }
    const prices = calculatePricesFromConfig(
      { ...targetShowtime.toObject(), room: activeRoom, roomType: activeRoom.roomType },
      pricingConfig
    );
    const ticketPrices = { STANDARD: prices.priceStandard, VIP: prices.priceVip, SWEETBOX: prices.priceSweetbox };
    const ticketLines = seatDocs.map(seat => ({ seatNumber: seat.seatNumber, price: ticketPrices[seat.type] }));
    const comboLines = comboDocs.map(combo => {
      const flavor = ['COMBO', 'POPCORN'].includes(combo.category) ? popcornFlavor : undefined;
      return {
        concessionId: combo._id, name: combo.name, flavor,
        price: combo.price + (flavor === 'caramel' ? 5000 : 0),
        quantity: combos.find(selection => selection.id === String(combo._id)).quantity,
      };
    });
    const subtotal = ticketLines.reduce((sum, ticket) => sum + ticket.price, 0)
      + comboLines.reduce((sum, combo) => sum + combo.price * combo.quantity, 0);
    if (!Number.isSafeInteger(subtotal) || subtotal < 0) {
      return res.status(409).json({ success: false, message: 'Chưa xác định được giá của đơn.' });
    }
    const voucher = voucherCode ? await resolveVoucher(voucherCode, subtotal, now) : null;
    if (voucherCode && !voucher) {
      return res.status(400).json({ success: false, message: 'Mã voucher không hợp lệ hoặc đã hết hạn.' });
    }
    const discount = voucher?.discountAmount ?? 0;

    // 4. BƯỚC NGUYÊN TỬ (ATOMIC CONCURRENCY CHECK):
    // Sinh ID, mã vé và mã QR token duy nhất cho giao dịch này
    const tempBookingId = new mongoose.Types.ObjectId();
    const requestKey = req.get('Idempotency-Key');
    if (requestKey && !/^[a-f\d-]{36}$/i.test(requestKey)) {
      return res.status(400).json({ success: false, message: 'Mã yêu cầu đặt vé không hợp lệ.' });
    }
    const bookingCode = requestKey
      ? 'MTX-' + createHash('sha256').update(req.user.id + ':' + requestKey).digest('hex').slice(0, 32).toUpperCase()
      : 'MTX-' + randomBytes(16).toString('hex').toUpperCase();
    const requestSignature = createHash('sha256').update(JSON.stringify([
      showtimeId, [...normalizedSeats].sort(), combos, popcornFlavor, voucherCode ?? null, paymentMethod,
    ])).digest('hex');
    const qrToken = randomBytes(24).toString('hex');

    const newBooking = await mongoose.connection.transaction(async session => {
      if (requestKey) {
        const existing = await Booking.findOne({ bookingCode, userId: req.user._id }).select('+requestSignature').session(session);
        if (existing) {
          if (existing.requestSignature !== requestSignature) throw new BookingConflict('Mã yêu cầu đã dùng cho lựa chọn khác.');
          return existing;
        }
      }
      await assertSellableShowtime(targetShowtime, session);
      await claimSeats(stId, normalizedSeats, tempBookingId, session, {
        holdId: typeof holdId === 'string' && holdId.trim() ? holdId.trim() : null,
        userId: req.user._id,
        now,
      });
      const [created] = await Booking.create([{
        _id: tempBookingId,
        bookingCode,
        requestSignature,
        qrToken,
        showtimeId: stId,
        userId: req.user._id,
        roomId: targetShowtime.roomId,
        movieId: targetShowtime.movieId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.toString().trim(),
        customerEmail: customerEmail ? customerEmail.trim().toLowerCase() : '',
        seats: normalizedSeats.join(', '),
        concessions: comboLines.map(combo => `${combo.quantity}x ${combo.name}`).join(', '),
        totalAmount: subtotal - discount,
        paymentStatus: 'SIMULATED',
        priceSnapshot: { tickets: ticketLines, combos: comboLines, voucherCode: voucher?.voucher.code, discount },
        status: 'PAID',
        paymentMethod,
        isCheckedIn: false,
      }], { session });
      return created;
    });

    // Truy vấn đầy đủ thông tin vé kèm phim và suất chiếu để trả về client
    const showtime = await Showtime.findById(stId)
      .populate('movieId')
      .populate('cinemaId')
      .lean();

    const formattedBooking = {
      ...newBooking.toObject({ transform: (_doc, ret) => { delete ret.requestSignature; return ret; } }),
      id: newBooking._id.toString(),
      showtime: showtime
        ? {
            ...showtime,
            id: showtime._id.toString(),
            movie: showtime.movieId
              ? { ...showtime.movieId, id: showtime.movieId._id.toString() }
              : null,
            cinema: showtime.cinemaId
              ? { ...showtime.cinemaId, id: showtime.cinemaId._id.toString() }
              : null,
          }
        : null,
    };

    return res.status(201).json({
      success: true,
      message: 'Đặt vé thành công!',
      booking: formattedBooking,
    });
  } catch (error) {
    return bookingWriteError(res, error);
  }
};

// Lấy danh sách vé & lịch sử đặt vé của người dùng hiện tại
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'showtimeId',
        populate: [
          { path: 'movieId' },
          { path: 'cinemaId' },
          { path: 'roomId', select: 'name roomType' },
        ],
      })
      .select('-requestSignature')
      .lean();

    const formatted = bookings.map((b) => ({
      ...b,
      id: b._id.toString(),
      showtime: b.showtimeId
        ? {
            ...b.showtimeId,
            id: b.showtimeId._id.toString(),
            movie: b.showtimeId.movieId
              ? { ...b.showtimeId.movieId, id: b.showtimeId.movieId._id.toString() }
              : null,
            cinema: b.showtimeId.cinemaId
              ? { ...b.showtimeId.cinemaId, id: b.showtimeId.cinemaId._id.toString() }
              : null,
          }
        : null,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách vé của người dùng', error: error.message });
  }
};

// Tra cứu vé theo mã vé (dành cho xuất vé QR code hoặc tìm kiếm)
export const getBookingByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const booking = await Booking.findOne({ bookingCode: code, userId: req.user._id }).select('-requestSignature').populate({
      path: 'showtimeId',
      populate: [
        { path: 'movieId' },
        { path: 'cinemaId' },
      ],
    });

    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy vé với mã này' });
    }

    const showtime = booking.showtimeId;
    const formattedBooking = {
      ...booking.toObject(),
      id: booking._id.toString(),
      showtime: showtime
        ? {
            ...showtime.toObject(),
            id: showtime._id.toString(),
            movie: showtime.movieId ? { ...showtime.movieId.toObject(), id: showtime.movieId._id.toString() } : null,
            cinema: showtime.cinemaId ? { ...showtime.cinemaId.toObject(), id: showtime.cinemaId._id.toString() } : null,
          }
        : null,
    };

    res.json(formattedBooking);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tra cứu mã vé', error: error.message });
  }
};

/**
 * Hủy vé tự nguyện (Yêu cầu ít nhất 24 giờ trước giờ chiếu - Phần 10)
 */
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    let booking = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      booking = await Booking.findOne({ _id: id, userId: req.user._id }).populate('showtimeId');
    } else {
      booking = await Booking.findOne({ bookingCode: id, userId: req.user._id }).populate('showtimeId');
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt vé yêu cầu.' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Đơn đặt vé này đã được hủy trước đó.' });
    }

    if (booking.status !== 'PAID' || booking.paymentStatus !== 'SIMULATED') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn đặt vé hợp lệ đã thanh toán.' });
    }

    if (booking.isCheckedIn) {
      return res.status(400).json({ success: false, message: 'Vé đã được check-in tại quầy soát vé. Không thể hủy!' });
    }

    const showtime = booking.showtimeId;
    if (!showtime || !showtime.startTime) {
      return res.status(400).json({ success: false, message: 'Không xác định được thời gian suất chiếu của vé.' });
    }

    // Kiểm tra quy tắc 24 giờ chính xác
    const now = new Date();
    const showtimeStart = new Date(showtime.startTime);
    const hoursRemaining = (showtimeStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining < 24) {
      return res.status(400).json({
        success: false,
        message: `Chính sách rạp D'AVENOR chỉ cho phép hủy vé trước giờ chiếu ít nhất 24 giờ. Suất chiếu này chỉ còn ${hoursRemaining.toFixed(1)} giờ nữa là bắt đầu.`,
      });
    }

    const refund = await mongoose.connection.transaction(async (session) => {
      const match = {
        _id: booking._id, status: 'PAID', paymentStatus: 'SIMULATED',
        qrToken: booking.qrToken, isCheckedIn: { $ne: true },
      };
      const current = await Booking.findOne(match).session(session).lean();
      if (!current) throw new BookingConflict('Đơn vừa thay đổi. Vui lòng tải lại.');
      const refund = getCancellationRefundUpdate(current);
      await Booking.updateOne(match, { $set: { status: 'CANCELLED', qrToken: null, ...refund } }, { session });
      await releaseSeats(current, session);
      return {
        refundAmount: Object.hasOwn(refund, 'refundAmount') ? refund.refundAmount : current.refundAmount ?? null,
        refundStatus: refund.refundStatus ?? current.refundStatus,
      };
    });

    return res.json({
      success: true,
      message: refund.refundStatus === 'SIMULATED'
        ? 'Vé đã hủy. Khoản hoàn tiền ghi nhận chỉ là mô phỏng.'
        : 'Vé đã hủy. Trạng thái hoàn tiền được ghi nhận bên dưới.',
      ...refund,
      bookingCode: booking.bookingCode,
    });
  } catch (error) {
    return bookingWriteError(res, error);
  }
};

/**
 * Đổi vé tự nguyện (Yêu cầu ít nhất 24 giờ trước giờ chiếu - Phần 11)
 */
export const exchangeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetShowtimeId, newSeatNumbers } = req.body;

    if (!mongoose.isObjectIdOrHexString(targetShowtimeId) || !Array.isArray(newSeatNumbers) || !newSeatNumbers.length || !newSeatNumbers.every(seat => typeof seat === 'string' && seat.trim())) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp suất chiếu mới và danh sách ghế muốn đổi.' });
    }

    let booking = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      booking = await Booking.findOne({ _id: id, userId: req.user._id }).populate('showtimeId');
    } else {
      booking = await Booking.findOne({ bookingCode: id, userId: req.user._id }).populate('showtimeId');
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt vé yêu cầu đổi.' });
    }

    if (booking.status !== 'PAID' || booking.paymentStatus !== 'SIMULATED' || !booking.showtimeId) {
      return res.status(400).json({ success: false, message: 'Chỉ có thể đổi vé cho đơn đặt vé hợp lệ đang hoạt động.' });
    }

    if (booking.isCheckedIn) {
      return res.status(400).json({ success: false, message: 'Vé đã được check-in tại quầy soát vé. Không thể đổi!' });
    }

    // Kiểm tra quy tắc 24 giờ của vé cũ
    const now = new Date();
    const oldShowtimeStart = new Date(booking.showtimeId.startTime);
    const hoursRemaining = (oldShowtimeStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining < 24) {
      return res.status(400).json({
        success: false,
        message: `Chính sách rạp chỉ hỗ trợ đổi vé trước giờ chiếu ít nhất 24 giờ. Suất cũ chỉ còn ${hoursRemaining.toFixed(1)} giờ.`,
      });
    }

    // Tìm suất chiếu mới
    const targetShowtime = await Showtime.findById(targetShowtimeId).populate('movieId').populate('cinemaId');
    if (!targetShowtime) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu mới yêu cầu.' });
    }

    const activeTargetRoom = targetShowtime.roomId
      ? await Room.findOne({ _id: targetShowtime.roomId, status: 'ACTIVE' })
          .select('name roomType formatFeature')
          .lean()
      : null;
    if (targetShowtime.isLocked || !activeTargetRoom) {
      return res.status(409).json({ success: false, message: 'Suất mới chưa đủ điều kiện mở bán.' });
    }

    const newStart = new Date(targetShowtime.startTime);
    if (newStart.getTime() <= now.getTime()) {
      return res.status(400).json({ success: false, message: 'Suất chiếu mới đã bắt đầu hoặc đã qua.' });
    }
    if (opensMoreThanSevenDaysAhead(newStart, now)) {
      return res.status(400).json({ success: false, message: 'Suất chiếu mới chưa mở bán (vượt quá 7 ngày).' });
    }

    // Chuẩn hóa danh sách ghế mới
    const normalizedNewSeats = [...new Set(newSeatNumbers.map((s) => normalizeSeatCode(s)))];

    const prices = calculatePricesFromConfig(
      { ...targetShowtime.toObject(), room: activeTargetRoom, roomType: activeTargetRoom.roomType },
      await ensurePricingConfig()
    );
    const ticketPrices = { STANDARD: prices.priceStandard, VIP: prices.priceVip, SWEETBOX: prices.priceSweetbox };
    const newSeats = await ShowtimeSeat.find({
      showtimeId: targetShowtime._id, seatNumber: { $in: normalizedNewSeats },
    }).lean();
    const tickets = newSeats.map(seat => ({ seatNumber: seat.seatNumber, price: ticketPrices[seat.type] }));
    const priceSnapshot = booking.priceSnapshot.toObject();
    const oldTickets = priceSnapshot.tickets.reduce((sum, ticket) => sum + ticket.price, 0);
    const newTickets = tickets.reduce((sum, ticket) => sum + ticket.price, 0);
    if (newSeats.length !== normalizedNewSeats.length || !Number.isSafeInteger(newTickets)) {
      return res.status(400).json({ success: false, message: 'Ghế mới hoặc giá vé không hợp lệ.' });
    }
    const newTotal = Math.max(0, booking.totalAmount + newTickets - oldTickets);
    const priceDiff = newTotal - booking.totalAmount;
    const newQrToken = randomBytes(24).toString('hex');

    const exchanged = await mongoose.connection.transaction(async session => {
      const updated = await Booking.findOneAndUpdate(
        { _id: booking._id, status: 'PAID', qrToken: booking.qrToken, isCheckedIn: { $ne: true } },
        {
          $set: {
            showtimeId: targetShowtime._id, roomId: targetShowtime.roomId, movieId: targetShowtime.movieId,
            seats: normalizedNewSeats.join(', '), totalAmount: newTotal, qrToken: newQrToken,
            priceSnapshot: { ...priceSnapshot, tickets },
          },
          $push: { exchangeHistory: {
            fromShowtimeId: booking.showtimeId._id, fromShowtimeDate: booking.showtimeId.startTime,
            fromRoomName: booking.showtimeId.roomName, oldSeats: booking.seats,
            exchangedAt: new Date(), priceDiff, paymentStatus: 'SIMULATED',
          } },
        },
        { new: true, session }
      );
      if (!updated) throw new BookingConflict('Đơn vừa thay đổi. Vui lòng tải lại.');
      await assertSellableShowtime(targetShowtime, session);
      await claimSeats(targetShowtime._id, normalizedNewSeats, booking._id, session);
      await releaseSeats(booking, session);
      return updated;
    });

    return res.json({
      success: true,
      message: 'Đổi vé thành công! Mã QR mới đã được phát hành.',
      booking: {
        ...exchanged.toObject({ transform: (_doc, ret) => { delete ret.requestSignature; return ret; } }),
        id: booking._id.toString(),
        qrToken: newQrToken,
        showtime: targetShowtime,
      },
      priceDiff,
    });
  } catch (error) {
    return bookingWriteError(res, error);
  }
};

/**
 * Quét QR Check-in vé điện tử tại rạp (Phần 13)
 */
export const checkInBooking = async (req, res) => {
  try {
    const { qrToken } = req.body;

    if (typeof qrToken !== 'string' || !qrToken.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã QR vé điện tử.' });
    }

    const query = { qrToken: qrToken.trim() };
    const booking = await Booking.findOne(query)
      .populate({
        path: 'showtimeId',
        populate: [{ path: 'movieId' }, { path: 'cinemaId' }, { path: 'roomId' }],
      });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé hợp lệ hoặc mã QR không tồn tại trong hệ thống.' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Vé này ĐÃ BỊ HỦY trước đó. Không thể check-in vào rạp!' });
    }

    if (booking.status !== 'PAID' || !['SIMULATED', 'VERIFIED'].includes(booking.paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Vé chưa đủ điều kiện soát.' });
    }

    if (booking.isCheckedIn) {
      return res.status(400).json({
        success: false,
        alreadyCheckedIn: true,
        message: `Vé này ĐÃ CHECK-IN vào lúc ${new Date(booking.checkedInAt).toLocaleString('vi-VN')}! Mỗi vé chỉ được check-in 1 lần duy nhất.`,
        checkedInAt: booking.checkedInAt,
      });
    }

    // Đánh dấu check-in hợp lệ
    const checkedInAt = new Date();
    const updated = await Booking.updateOne(
      { ...query, _id: booking._id, status: 'PAID', paymentStatus: { $in: ['SIMULATED', 'VERIFIED'] }, isCheckedIn: { $ne: true } },
      { $set: { isCheckedIn: true, checkedInAt } }
    );
    if (updated.modifiedCount !== 1) {
      return res.status(409).json({ success: false, message: 'V? ?? ???c so?t ho?c v?a thay ??i.' });
    }

    return res.json({
      success: true,
      message: 'Check-in vé thành công! Chúc quý khách xem phim vui vẻ tại D\'AVENOR CINEMA.',
      checkedInAt,
      booking: {
        id: booking._id.toString(),
        bookingCode: booking.bookingCode,
        customerName: booking.customerName,
        seats: booking.seats,
        showtime: booking.showtimeId,
      },
    });
  } catch (error) {
    console.error('Lỗi check-in:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi soát vé: ' + error.message });
  }
};
