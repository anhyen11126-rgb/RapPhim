import mongoose from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import Showtime from '../../models/Showtime.js';
import ShowtimeSeat from '../../models/ShowtimeSeat.js';
import Room from '../../models/Room.js';
import Booking from '../../models/Booking.js';
import SupportTicket from '../../models/SupportTicket.js';
import { ensurePricingConfig, calculatePricesFromConfig } from '../pricingConfigService.js';
import { resolveVoucher } from '../../controllers/promotionController.js';
import { opensMoreThanSevenDaysAhead } from '../bookingPolicy.js';
import { INTENTS, removeVietnameseTones } from './intentService.js';
import { isSeatAvailableAt, findContiguousAvailableSeats } from './cinemaContextService.js';
import { buildInteractiveMovieCards, buildSafeMovieCard, filterShowtimesByEntities } from './responseBuilder.js';
import { formatVND } from './pricingService.js';

const normalizeSeatCodeLocal = (raw = '') => {
  const trimmed = String(raw || '').trim().toUpperCase();
  const match = trimmed.match(/^([A-Z])0*(\d+)$/);
  return match ? `${match[1]}${parseInt(match[2], 10)}` : trimmed;
};

/**
 * Tải sơ đồ ghế thực tế cho 1 suất chiếu (ưu tiên dữ liệu DB mới nhất, hỗ trợ mock rawSeats trong test)
 */
const loadRealtimeSeatsForShowtime = async (showtimeObj, nowDate = new Date()) => {
  const stId = String(showtimeObj?.showtimeId || showtimeObj?._id || '');
  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(stId)) {
    const dbSeats = await ShowtimeSeat.find({ showtimeId: stId })
      .select('seatNumber row col type status holdExpiresAt')
      .sort({ row: 1, col: 1 })
      .lean()
      .catch(() => []);
    if (dbSeats.length > 0) {
      return dbSeats.map((s) => ({
        ...s,
        seatNumber: normalizeSeatCodeLocal(s.seatNumber),
      }));
    }
  }
  if (Array.isArray(showtimeObj?.rawSeats) && showtimeObj.rawSeats.length > 0) {
    return showtimeObj.rawSeats.map((s) => ({
      ...s,
      seatNumber: normalizeSeatCodeLocal(s.seatNumber),
    }));
  }
  return [];
};

/**
 * Tóm tắt sơ đồ ghế thực tế theo trạng thái (Ghế trống, Đã đặt, Đang giữ, Đang chọn)
 */
const formatSeatMapSummary = (seats = [], selectedSeats = [], reqQty = 2, nowDate = new Date(), isEn = false) => {
  const selectedSet = new Set(selectedSeats.map(normalizeSeatCodeLocal));
  const availableList = [];
  const bookedList = [];
  const holdingList = [];
  const availableByRow = new Map();

  for (const s of seats) {
    const code = normalizeSeatCodeLocal(s.seatNumber);
    const row = String(s.row || code[0] || 'A').toUpperCase();
    if (isSeatAvailableAt(s, nowDate)) {
      availableList.push(code);
      if (!availableByRow.has(row)) availableByRow.set(row, []);
      availableByRow.get(row).push(code);
    } else if (String(s.status || '').toUpperCase() === 'HOLDING') {
      holdingList.push(code);
    } else {
      bookedList.push(code);
    }
  }

  const contiguous = findContiguousAvailableSeats(seats, reqQty, nowDate);
  const rowPreviewLines = [...availableByRow.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([row, codes]) => {
      const sample = codes.length > 8 ? `${codes.slice(0, 8).join(', ')}... (${codes.length})` : codes.join(', ');
      return isEn ? `  • Row **${row}**: ${sample}` : `  • Hàng **${row}**: ${sample}`;
    });

  const bookedSample =
    bookedList.length === 0
      ? isEn
        ? 'None'
        : 'Chưa có'
      : bookedList.length <= 12
        ? bookedList.join(', ')
        : `${bookedList.slice(0, 12).join(', ')} (+${bookedList.length - 12})`;

  const holdingSample =
    holdingList.length === 0
      ? isEn
        ? 'None'
        : 'Không có'
      : holdingList.join(', ');

  const selectedSample =
    selectedSet.size > 0 ? [...selectedSet].join(', ') : isEn ? 'None yet' : 'Chưa chọn';

  const suggestLine =
    contiguous.length > 0
      ? isEn
        ? `\n✨ **Suggested ${reqQty} adjacent seats:** **${contiguous.slice(0, 3).map((b) => b.join(', ')).join('** | **')}**`
        : `\n✨ **Gợi ý ${reqQty} ghế trống cạnh nhau:** **${contiguous.slice(0, 3).map((b) => b.join(', ')).join('** | **')}**`
      : '';

  if (isEn) {
    return [
      `🟢 **Available seats (${availableList.length}/${seats.length}):**`,
      ...rowPreviewLines,
      `🔴 **Booked seats (${bookedList.length}):** ${bookedSample}`,
      `🟡 **Held seats (${holdingList.length}):** ${holdingSample}`,
      `🔵 **Your selected seats:** **${selectedSample}**${suggestLine}`,
    ].join('\n');
  }

  return [
    `🟢 **Ghế trống (${availableList.length}/${seats.length}):**`,
    ...rowPreviewLines,
    `🔴 **Ghế đã đặt (${bookedList.length}):** ${bookedSample}`,
    `🟡 **Ghế đang được giữ (${holdingList.length}):** ${holdingSample}`,
    `🔵 **Ghế đang chọn:** **${selectedSample}**${suggestLine}`,
  ].join('\n');
};

/**
 * Thực thi đặt vé nguyên tử (Atomic Transaction) thật vào MongoDB — chỉ chạy khi khách đã XÁC NHẬN ở Bước 6.
 */
const executeAtomicBookingInDb = async ({
  showtimeId,
  selectedSeats,
  voucherCode,
  authUser,
  customerName,
  customerPhone,
  customerEmail,
  nowDate = new Date(),
  mockBookingExecutor = null,
}) => {
  if (typeof mockBookingExecutor === 'function') {
    return mockBookingExecutor({
      showtimeId,
      selectedSeats,
      voucherCode,
      authUser,
      customerName,
      customerPhone,
      customerEmail,
      nowDate,
    });
  }

  if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(String(showtimeId))) {
    return { ok: false, reason: 'DB_UNAVAILABLE' };
  }

  const normalizedSeats = [...new Set(selectedSeats.map(normalizeSeatCodeLocal))];
  const targetShowtime = await Showtime.findById(showtimeId).lean();
  if (!targetShowtime || targetShowtime.isLocked || targetShowtime.cancelledAt) {
    return { ok: false, reason: 'SHOWTIME_UNAVAILABLE' };
  }

  const start = new Date(targetShowtime.startTime);
  if (start.getTime() <= nowDate.getTime() || opensMoreThanSevenDaysAhead(start, nowDate)) {
    return { ok: false, reason: 'SHOWTIME_CLOSED' };
  }

  if (!targetShowtime.roomId || !(await Room.exists({ _id: targetShowtime.roomId, status: 'ACTIVE' }))) {
    return { ok: false, reason: 'ROOM_UNCONFIRMED' };
  }

  const [seatDocs, pricingConfig] = await Promise.all([
    ShowtimeSeat.find({ showtimeId: targetShowtime._id, seatNumber: { $in: normalizedSeats } }).lean(),
    ensurePricingConfig(),
  ]);

  if (seatDocs.length !== normalizedSeats.length) {
    return { ok: false, reason: 'INVALID_SEATS' };
  }

  const unavailable = seatDocs.filter((s) => !isSeatAvailableAt(s, nowDate));
  if (unavailable.length > 0) {
    return {
      ok: false,
      reason: 'SEAT_TAKEN',
      takenSeats: unavailable.map((s) => normalizeSeatCodeLocal(s.seatNumber)),
    };
  }

  const prices = calculatePricesFromConfig(targetShowtime, pricingConfig);
  const ticketPrices = {
    STANDARD: prices.priceStandard,
    VIP: prices.priceVip,
    SWEETBOX: prices.priceSweetbox,
  };
  const ticketLines = seatDocs.map((seat) => ({
    seatNumber: normalizeSeatCodeLocal(seat.seatNumber),
    price: ticketPrices[seat.type] || prices.priceStandard,
  }));
  const subtotal = ticketLines.reduce((sum, t) => sum + t.price, 0);
  const appliedVoucher = voucherCode ? await resolveVoucher(voucherCode, subtotal, nowDate) : null;
  const discount = appliedVoucher?.discountAmount ?? 0;
  const finalAmount = Math.max(0, subtotal - discount);

  const tempBookingId = new mongoose.Types.ObjectId();
  const bookingCode = `DAV-${randomBytes(4).toString('hex').toUpperCase()}`;
  const rawQrToken = randomBytes(24).toString('hex');
  const qrTokenHash = createHash('sha256').update(rawQrToken).digest('hex');

  try {
    await mongoose.connection.transaction(async (session) => {
      const stUpdate = await Showtime.updateOne(
        {
          _id: targetShowtime._id,
          startTime: { $gt: new Date() },
          roomId: targetShowtime.roomId,
          isLocked: { $ne: true },
          cancelledAt: null,
        },
        { $inc: { bookingRevision: 1 } },
        { session }
      );
      if (stUpdate.modifiedCount !== 1) {
        throw new Error('SHOWTIME_CHANGED');
      }

      // Giải phóng ghế HOLDING đã hết hạn trước khi khóa ghế
      await ShowtimeSeat.updateMany(
        {
          showtimeId: targetShowtime._id,
          seatNumber: { $in: normalizedSeats },
          status: 'HOLDING',
          holdExpiresAt: { $lt: new Date() },
        },
        { $set: { status: 'AVAILABLE', holdExpiresAt: null } },
        { session }
      );

      const claimed = await ShowtimeSeat.updateMany(
        {
          showtimeId: targetShowtime._id,
          seatNumber: { $in: normalizedSeats },
          status: 'AVAILABLE',
        },
        {
          $set: {
            status: 'BOOKED',
            bookingId: tempBookingId,
            holdExpiresAt: null,
          },
        },
        { session }
      );

      if (claimed.modifiedCount !== normalizedSeats.length) {
        throw new Error('SEAT_CONFLICT');
      }

      await Booking.create(
        [
          {
            _id: tempBookingId,
            bookingCode,
            qrToken: qrTokenHash,
            userId:
              authUser?.id && mongoose.Types.ObjectId.isValid(authUser.id)
                ? new mongoose.Types.ObjectId(authUser.id)
                : null,
            showtimeId: targetShowtime._id,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: (customerEmail || '').trim(),
            seats: normalizedSeats.join(', '),
            ticketLines,
            comboLines: [],
            concessions: '',
            voucherCode: appliedVoucher ? appliedVoucher.voucher.code : '',
            discountAmount: discount,
            totalAmount: finalAmount,
            paymentMethod: 'VNPAY',
            status: 'PAID',
            paymentStatus: 'SIMULATED',
          },
        ],
        { session }
      );
    });

    return {
      ok: true,
      bookingCode,
      totalAmount: finalAmount,
      discountAmount: discount,
      appliedVoucherCode: appliedVoucher ? appliedVoucher.voucher.code : null,
      seats: normalizedSeats,
    };
  } catch (err) {
    if (err.message === 'SEAT_CONFLICT') {
      return { ok: false, reason: 'SEAT_TAKEN', takenSeats: normalizedSeats };
    }
    return { ok: false, reason: 'TRANSACTION_FAILED' };
  }
};

/**
 * Kiểm tra xem lượt hội thoại hiện tại có nên xử lý qua Quy trình đặt vé thông minh 6 bước (Mục 7) hay không.
 */
export const shouldHandleSmartBookingFlow = ({ intent, entities, sessionContext }) => {
  const activeFlow = sessionContext?.bookingFlow?.active === true;
  if (entities.wantsSmartBooking) return true;
  if (!activeFlow) return false;

  if (entities.isCancelFlowAction || entities.isConfirmAction) return true;

  // Nếu khách chuyển hẳn sang tra cứu vé, hỏi địa chỉ, chính sách, bảo mật hoặc ngoài phạm vi -> thoát luồng tạm thời
  const escapeIntents = [
    INTENTS.OUT_OF_SCOPE,
    INTENTS.BOOKING_LOOKUP,
    INTENTS.CINEMA_LOCATION,
    INTENTS.ROOM_INFO,
    INTENTS.PROMOTION_VOUCHER,
    INTENTS.CONCESSION_COMBO,
    INTENTS.CUSTOMER_SUPPORT,
    INTENTS.PAYMENT_SUPPORT,
  ];
  if (escapeIntents.includes(intent)) {
    return false;
  }

  return true;
};

/**
 * Xử lý Quy trình đặt vé thông minh 6 bước (Mục 7) — hỗ trợ cả tiếng Việt & tiếng Anh.
 */
export const handleSmartBookingTurn = async ({
  userMessage = '',
  entities = {},
  contextData = {},
  sessionContext = null,
  authUser = null,
  nowDate = new Date(),
  mockBookingExecutor = null,
}) => {
  const prevFlow =
    sessionContext?.bookingFlow && sessionContext.bookingFlow.active
      ? { ...sessionContext.bookingFlow }
      : {
          active: true,
          step: 'INIT',
          language: entities.language || 'vi',
          ticketQuantity: null,
          dateKey: null,
          dateLabel: null,
          dateLabelEn: null,
          timeFilter: null,
          movieId: null,
          movieTitle: null,
          showtimeId: null,
          selectedSeats: [],
          voucherCode: null,
          customerName: null,
          customerPhone: null,
        };

  const lang =
    entities.language === 'en' || (prevFlow.language === 'en' && entities.language !== 'vi')
      ? 'en'
      : 'vi';
  const isEn = lang === 'en';
  prevFlow.language = lang;

  // Cho phép khách hủy luồng đặt vé bất kỳ lúc nào
  if (entities.isCancelFlowAction) {
    return {
      reply: isEn
        ? 'Your ticket booking process has been cancelled. Let me know anytime if you would like to check movies or showtimes!'
        : 'Đã hủy quy trình đặt vé hiện tại. Khi nào cần xem lịch chiếu hoặc đặt vé mới, bạn cứ nhắn mình nhé!',
      intent: INTENTS.BOOKING_GUIDE,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      bookingFlow: null,
    };
  }

  const movies = contextData.movies || [];

  // 1. Cập nhật số lượng vé (nếu chưa có hoặc đang ở bước hỏi số lượng, hoặc khách nói rõ "X vé")
  const explicitTicketMention = /\b(\d{1,2})\s*(ve|tickets?)\b/i.test(removeVietnameseTones(userMessage));
  if (entities.ticketQuantity && (!prevFlow.ticketQuantity || prevFlow.step === 'ASK_QTY_DATE' || explicitTicketMention)) {
    prevFlow.ticketQuantity = entities.ticketQuantity;
    if (prevFlow.selectedSeats.length > 0 && prevFlow.selectedSeats.length !== prevFlow.ticketQuantity) {
      prevFlow.selectedSeats = [];
    }
  }

  // 2. Cập nhật ngày & khung giờ xem
  if (entities.dateFilter && !entities.dateFilter.isPastDate) {
    if (prevFlow.dateKey && prevFlow.dateKey !== entities.dateFilter.dateKey) {
      prevFlow.showtimeId = null;
      prevFlow.selectedSeats = [];
    }
    prevFlow.dateKey = entities.dateFilter.dateKey;
    prevFlow.dateLabel = entities.dateFilter.label;
    prevFlow.dateLabelEn = entities.dateFilter.labelEn || entities.dateFilter.displayDate;
  }
  if (entities.timeFilter && !prevFlow.showtimeId) {
    prevFlow.timeFilter = entities.timeFilter;
  }

  // Kiểm tra nếu khách chọn ngày đã qua
  if (entities.dateFilter?.isPastDate) {
    return {
      reply: isEn
        ? `Showtimes for **${entities.dateFilter.labelEn || entities.dateFilter.displayDate}** have already passed. Please choose today or an upcoming date within the next 7 days.`
        : `Ngày **${entities.dateFilter.label}** đã qua nên không thể đặt vé. Bạn vui lòng chọn hôm nay hoặc ngày chiếu sắp tới nhé!`,
      intent: INTENTS.BOOKING_GUIDE,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      bookingFlow: prevFlow,
    };
  }

  // 3. Cập nhật bộ phim khách chọn
  if (entities.matchedMovie) {
    if (prevFlow.movieId && String(prevFlow.movieId) !== String(entities.matchedMovie._id)) {
      prevFlow.showtimeId = null;
      prevFlow.selectedSeats = [];
    }
    prevFlow.movieId = String(entities.matchedMovie._id);
    prevFlow.movieTitle = entities.matchedMovie.title;
  }

  // =========================================================================
  // BƯỚC 1: XÁC ĐỊNH SỐ LƯỢNG VÉ VÀ NGÀY XEM (Chỉ hỏi phần còn thiếu, phân biệt đã chọn phim hay chưa!)
  // =========================================================================
  if (!prevFlow.ticketQuantity || !prevFlow.dateKey) {
    prevFlow.step = 'ASK_QTY_DATE';
    const pickedMovieObj = prevFlow.movieId
      ? movies.find((m) => String(m._id) === String(prevFlow.movieId))
      : null;

    if (!prevFlow.ticketQuantity && !prevFlow.dateKey) {
      // Nếu khách đã nêu đích danh 1 bộ phim (VD: "đặt vé phim Dune") -> chỉ hỏi số vé & ngày cho ĐÚNG phim đó
      if (pickedMovieObj) {
        const singleCards = buildInteractiveMovieCards(
          [{ movie: pickedMovieObj, showtimes: pickedMovieObj.showtimes || [] }],
          nowDate
        );
        return {
          reply: isEn
            ? `How many tickets would you like to book for **${pickedMovieObj.title}**, and for which date (e.g., today, tonight, or tomorrow)?`
            : `Bạn muốn đặt **bao nhiêu vé** xem phim **${pickedMovieObj.title}** và xem vào **ngày nào** (ví dụ: hôm nay, tối nay hoặc ngày mai)?`,
          intent: INTENTS.BOOKING_GUIDE,
          movieCard: singleCards[0] || null,
          movieCards: singleCards,
          quickReplies: [],
          bookingFlow: prevFlow,
        };
      }

      // Nếu khách hỏi đặt vé CHUNG (VD: "đặt vé phim", "tôi muốn đặt vé") -> hỏi số lượng vé & ngày xem, gợi ý phim đang chiếu
      const showingNow = movies.filter((m) => m.status === 'NOW_SHOWING');
      const previewCards = buildInteractiveMovieCards(
        showingNow.map((m) => ({ movie: m, showtimes: m.showtimes || [] })),
        nowDate
      );
      const showingNames = showingNow.map((m) => `**${m.title}**`).join(', ');
      const showingNote = showingNames
        ? isEn
          ? `\n\n🎬 *Currently showing:* ${showingNames}.`
          : `\n\n🎬 *Các phim đang chiếu hiện tại:* ${showingNames}.`
        : '';
      return {
        reply: isEn
          ? `How many tickets would you like to book, and for which date (e.g., tonight or tomorrow)?${showingNote}`
          : `Bạn muốn đặt **bao nhiêu vé** và xem vào **ngày nào** (ví dụ: tối nay hoặc ngày mai)?${showingNote}`,
        intent: INTENTS.BOOKING_GUIDE,
        movieCard: null,
        movieCards: previewCards,
        quickReplies: [],
        bookingFlow: prevFlow,
      };
    }
    if (!prevFlow.ticketQuantity) {
      const movieNoteVi = pickedMovieObj ? ` cho phim **${pickedMovieObj.title}**` : '';
      const movieNoteEn = pickedMovieObj ? ` for **${pickedMovieObj.title}**` : '';
      return {
        reply: isEn
          ? `Got it — watching${movieNoteEn} **${prevFlow.dateLabelEn || prevFlow.dateLabel}**. How many tickets would you like to book?`
          : `Mình đã ghi nhận lịch xem${movieNoteVi} vào **${prevFlow.dateLabel}**. Bạn muốn đặt **bao nhiêu vé**?`,
        intent: INTENTS.BOOKING_GUIDE,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        bookingFlow: prevFlow,
      };
    }
    const movieNoteVi = pickedMovieObj ? ` xem phim **${pickedMovieObj.title}**` : '';
    const movieNoteEn = pickedMovieObj ? ` for **${pickedMovieObj.title}**` : '';
    return {
      reply: isEn
        ? `Got it — **${prevFlow.ticketQuantity} ticket(s)**${movieNoteEn}. Which date would you like to watch (e.g., today, tonight, or tomorrow)?`
        : `Mình đã ghi nhận **${prevFlow.ticketQuantity} vé**${movieNoteVi}. Bạn muốn xem vào **ngày nào** (ví dụ: hôm nay, tối nay hoặc ngày mai)?`,
      intent: INTENTS.BOOKING_GUIDE,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      bookingFlow: prevFlow,
    };
  }

  // =========================================================================
  // BƯỚC 2: HỎI KHÁCH MUỐN XEM PHIM NÀO (Hiển thị đúng các phim có suất phù hợp)
  // =========================================================================
  if (!prevFlow.movieId) {
    prevFlow.step = 'ASK_MOVIE';
    const filterEntities = {
      dateFilter: { dateKey: prevFlow.dateKey },
      timeFilter: prevFlow.timeFilter,
    };

    let matchingMovies = movies
      .filter((m) => m.status === 'NOW_SHOWING')
      .map((m) => ({
        movie: m,
        slots: filterShowtimesByEntities(m.showtimes || [], filterEntities).filter(
          (s) => s.availableSeats >= prevFlow.ticketQuantity
        ),
      }))
      .filter((g) => g.slots.length > 0);

    // Nếu lọc theo buổi tối không còn suất nhưng cả ngày đó vẫn có suất -> mở rộng sang cả ngày đó và báo rõ
    let relaxedTimeNote = '';
    if (matchingMovies.length === 0 && prevFlow.timeFilter) {
      matchingMovies = movies
        .filter((m) => m.status === 'NOW_SHOWING')
        .map((m) => ({
          movie: m,
          slots: (m.showtimes || []).filter(
            (s) => s.dateKey === prevFlow.dateKey && s.availableSeats >= prevFlow.ticketQuantity
          ),
        }))
        .filter((g) => g.slots.length > 0);
      if (matchingMovies.length > 0) {
        prevFlow.timeFilter = null;
        relaxedTimeNote = isEn
          ? '*(No evening showtimes matched, showing available slots on the same day)*\n\n'
          : '*(Khung giờ bạn hỏi hiện chưa có suất, mình hiển thị các suất còn ghế trong ngày)*\n\n';
      }
    }

    if (matchingMovies.length === 0) {
      // Tìm ngày gần nhất có suất để gợi ý
      const nextAvailableDates = [
        ...new Set(
          movies.flatMap((m) =>
            (m.showtimes || [])
              .filter((s) => s.availableSeats >= prevFlow.ticketQuantity)
              .map((s) => s.shortDate || s.date)
          )
        ),
      ].slice(0, 4);

      const altHint =
        nextAvailableDates.length > 0
          ? isEn
            ? ` Available dates with open seats: **${nextAvailableDates.join(', ')}**. Which date would you prefer?`
            : ` Hiện hệ thống đang có suất chiếu vào ngày: **${nextAvailableDates.join(', ')}**. Bạn có muốn đổi sang ngày này không?`
          : '';

      prevFlow.dateKey = null;
      prevFlow.step = 'ASK_QTY_DATE';
      return {
        reply: isEn
          ? `There are currently no showtimes with ${prevFlow.ticketQuantity} available seat(s) for **${prevFlow.dateLabelEn || prevFlow.dateLabel}**.${altHint}`
          : `Hiện tại không có suất chiếu nào còn đủ **${prevFlow.ticketQuantity} ghế** vào **${prevFlow.dateLabel}**.${altHint}`,
        intent: INTENTS.BOOKING_GUIDE,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        bookingFlow: prevFlow,
      };
    }

    const movieLines = matchingMovies.map(({ movie: m, slots }, idx) => {
      const times = [...new Set(slots.map((s) => s.time))].join(', ');
      return isEn
        ? `${idx + 1}. 🎬 **${m.title}** (${m.ageRating} | ${m.genre} | ${m.duration} mins) — Showtimes: **${times}**`
        : `${idx + 1}. 🎬 **${m.title}** (${m.ageRating} | ${m.genre} | ${m.duration} phút) — Giờ chiếu: **${times}**`;
    });

    const cards = buildInteractiveMovieCards(
      matchingMovies.map(({ movie, slots }) => ({ movie, showtimes: slots })),
      nowDate
    );

    return {
      reply: isEn
        ? `${relaxedTimeNote}Which movie would you like to watch **${prevFlow.dateLabelEn || prevFlow.dateLabel}** (**${prevFlow.ticketQuantity} ticket(s)**)? Here are the movies with available showtimes:\n\n${movieLines.join('\n')}`
        : `${relaxedTimeNote}Bạn muốn xem bộ phim nào vào **${prevFlow.dateLabel}** (**${prevFlow.ticketQuantity} vé**)? Hiện có các bộ phim đang có suất chiếu phù hợp:\n\n${movieLines.join('\n')}`,
      intent: INTENTS.BOOKING_GUIDE,
      movieCard: cards[0] || null,
      movieCards: cards,
      quickReplies: [],
      bookingFlow: prevFlow,
    };
  }

  const selectedMovie = movies.find((m) => String(m._id) === String(prevFlow.movieId));
  if (!selectedMovie) {
    prevFlow.movieId = null;
    prevFlow.step = 'ASK_MOVIE';
    return {
      reply: isEn
        ? 'I could not find that movie in the active list. Which movie would you like to watch?'
        : 'Mình chưa tìm thấy phim đó trong danh sách đang chiếu. Bạn muốn chọn bộ phim nào?',
      intent: INTENTS.BOOKING_GUIDE,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      bookingFlow: prevFlow,
    };
  }

  // Các suất chiếu của phim đã chọn trong ngày
  let movieDaySlots = (selectedMovie.showtimes || []).filter((s) => s.dateKey === prevFlow.dateKey);
  if (movieDaySlots.length === 0) {
    movieDaySlots = selectedMovie.showtimes || [];
  }

  // Thử khớp suất chiếu nếu khách vừa nhập giờ chiếu và/hoặc phòng chiếu
  if (!prevFlow.showtimeId && movieDaySlots.length > 0) {
    const msgNoTone = removeVietnameseTones(userMessage);
    let candidateSlots = movieDaySlots;

    if (entities.timeFilter?.exactTime) {
      const exactMatches = candidateSlots.filter((s) => s.time === entities.timeFilter.exactTime);
      if (exactMatches.length > 0) candidateSlots = exactMatches;
    } else if (entities.timeFilter) {
      const rangeMatches = filterShowtimesByEntities(candidateSlots, { timeFilter: entities.timeFilter });
      if (rangeMatches.length === 1) candidateSlots = rangeMatches;
    }

    if (entities.format) {
      const fmtMatches = candidateSlots.filter((s) => s.format === entities.format);
      if (fmtMatches.length > 0) candidateSlots = fmtMatches;
    }

    const explicitRoomMatch = candidateSlots.filter((s) => {
      const rNoTone = removeVietnameseTones(s.roomName || '');
      return (
        (msgNoTone.includes('phong 01') && rNoTone.includes('01')) ||
        (msgNoTone.includes('phong 02') && rNoTone.includes('02')) ||
        (msgNoTone.includes('dolby') && rNoTone.includes('dolby')) ||
        (msgNoTone.includes('gold') && rNoTone.includes('gold')) ||
        (msgNoTone.includes('imax') && rNoTone.includes('imax'))
      );
    });
    if (explicitRoomMatch.length > 0) {
      candidateSlots = explicitRoomMatch;
    }

    // Chỉ tự gán showtimeId khi khách ĐÃ chủ động chỉ định giờ chiếu / phòng ở bước ASK_SHOWTIME (không tự chọn ở Bước 2!)
    const userSpecifiedSlotSignal =
      prevFlow.step === 'ASK_SHOWTIME' &&
      Boolean(entities.timeFilter?.exactTime || entities.format || explicitRoomMatch.length > 0);

    if (userSpecifiedSlotSignal && candidateSlots.length === 1) {
      prevFlow.showtimeId = String(candidateSlots[0].showtimeId);
    } else if (userSpecifiedSlotSignal && candidateSlots.length > 1 && entities.timeFilter?.exactTime) {
      // Cùng 1 khung giờ có nhiều phòng -> hỏi rõ phòng chiếu
      const roomLines = candidateSlots.map(
        (s, i) =>
          `${i + 1}. **${s.time}** — **${s.roomName}** (${s.format}) | ${s.priceFormatted} | ${isEn ? `${s.availableSeats} seats left` : `Còn ${s.availableSeats} ghế trống`}`
      );
      return {
        reply: isEn
          ? `There are multiple rooms at **${entities.timeFilter.exactTime}** for **${selectedMovie.title}**. Which room would you like?\n\n${roomLines.join('\n')}`
          : `Khung giờ **${entities.timeFilter.exactTime}** của phim **${selectedMovie.title}** có các phòng chiếu sau, bạn chọn phòng nào?\n\n${roomLines.join('\n')}`,
        intent: INTENTS.BOOKING_GUIDE,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        bookingFlow: prevFlow,
      };
    }
  }

  // =========================================================================
  // BƯỚC 3: CHỌN SUẤT CHIẾU VÀ PHÒNG CHIẾU
  // =========================================================================
  if (!prevFlow.showtimeId) {
    prevFlow.step = 'ASK_SHOWTIME';
    const openSlots = movieDaySlots.filter((s) => s.availableSeats >= prevFlow.ticketQuantity);

    if (openSlots.length === 0) {
      prevFlow.movieId = null;
      prevFlow.step = 'ASK_MOVIE';
      return {
        reply: isEn
          ? `**${selectedMovie.title}** currently has no showtimes with ${prevFlow.ticketQuantity} available seat(s) on **${prevFlow.dateLabelEn || prevFlow.dateLabel}**. Would you like to pick another movie or date?`
          : `Phim **${selectedMovie.title}** hiện không còn suất chiếu nào đủ **${prevFlow.ticketQuantity} ghế trống** vào **${prevFlow.dateLabel}**. Bạn muốn chọn phim khác hay đổi ngày xem?`,
        intent: INTENTS.BOOKING_GUIDE,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        bookingFlow: prevFlow,
      };
    }

    const slotLines = openSlots.map((s, idx) =>
      isEn
        ? `${idx + 1}. 🕒 **${s.time}** (${s.date}) | **${s.roomName}** | Format: **${s.format}** | Price: **${s.priceFormatted}** (VIP: ${s.priceVipFormatted}) | **${s.availableSeats}** seats available`
        : `${idx + 1}. 🕒 **${s.time}** (${s.date}) | **${s.roomName}** | Định dạng: **${s.format}** | Giá vé: **${s.priceFormatted}** (VIP: ${s.priceVipFormatted}) | Còn **${s.availableSeats}** ghế trống`
    );

    const cards = buildInteractiveMovieCards([{ movie: selectedMovie, showtimes: openSlots }], nowDate);

    return {
      reply: isEn
        ? `Here are the available showtimes for **${selectedMovie.title}** (**${prevFlow.ticketQuantity} ticket(s)**):\n\n${slotLines.join('\n')}\n\nWhich showtime and room would you like to choose?`
        : `Các suất chiếu thực tế của phim **${selectedMovie.title}** (đặt **${prevFlow.ticketQuantity} vé**):\n\n${slotLines.join('\n')}\n\nBạn muốn chọn **giờ chiếu** và **phòng chiếu** nào?`,
      intent: INTENTS.BOOKING_GUIDE,
      movieCard: cards[0] || null,
      movieCards: cards,
      quickReplies: [],
      bookingFlow: prevFlow,
    };
  }

  const chosenShowtime =
    (selectedMovie.showtimes || []).find((s) => String(s.showtimeId) === String(prevFlow.showtimeId)) || null;

  if (!chosenShowtime) {
    prevFlow.showtimeId = null;
    prevFlow.step = 'ASK_SHOWTIME';
    return {
      reply: isEn
        ? 'That showtime is no longer available. Please choose another showtime.'
        : 'Suất chiếu bạn chọn hiện không còn khả dụng. Bạn vui lòng chọn lại suất chiếu khác nhé!',
      intent: INTENTS.BOOKING_GUIDE,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      bookingFlow: prevFlow,
    };
  }

  const realtimeSeats = await loadRealtimeSeatsForShowtime(chosenShowtime, nowDate);

  // =========================================================================
  // BƯỚC 4: CHỌN GHẾ TRÊN SƠ ĐỒ GHẾ THỰC TẾ
  // =========================================================================
  if (
    prevFlow.step === 'ASK_SHOWTIME' ||
    (prevFlow.step === 'ASK_SEATS' && entities.selectedSeatCodes?.length > 0) ||
    prevFlow.selectedSeats.length !== prevFlow.ticketQuantity
  ) {
    // Nếu khách vừa gửi danh sách ghế muốn chọn ở Bước 4
    if (prevFlow.step === 'ASK_SEATS' && Array.isArray(entities.selectedSeatCodes) && entities.selectedSeatCodes.length > 0) {
      if (realtimeSeats.length === 0) {
        return {
          reply: isEn
            ? `Seat map data for this showtime is not initialized yet. Please select your seats directly here:\n👉 [Open Seat Map ➔](${chosenShowtime.bookingLink})`
            : `Sơ đồ ghế của suất chiếu này đang cần mở trực tiếp trên giao diện đặt vé:\n👉 [Mở sơ đồ chọn ghế ➔](${chosenShowtime.bookingLink})`,
          intent: INTENTS.BOOKING_GUIDE,
          movieCard: buildSafeMovieCard(chosenShowtime, selectedMovie, nowDate),
          movieCards: [],
          quickReplies: [],
          bookingFlow: prevFlow,
        };
      }

      const seatLookup = new Map(realtimeSeats.map((s) => [normalizeSeatCodeLocal(s.seatNumber), s]));
      const invalidCodes = [];
      const unavailableCodes = [];
      const validChosen = [];

      for (const code of entities.selectedSeatCodes) {
        const norm = normalizeSeatCodeLocal(code);
        const doc = seatLookup.get(norm);
        if (!doc) {
          invalidCodes.push(norm);
        } else if (!isSeatAvailableAt(doc, nowDate)) {
          unavailableCodes.push(norm);
        } else {
          validChosen.push(norm);
        }
      }

      if (invalidCodes.length > 0) {
        const mapSummary = formatSeatMapSummary(realtimeSeats, prevFlow.selectedSeats, prevFlow.ticketQuantity, nowDate, isEn);
        return {
          reply: isEn
            ? `⚠️ Seat(s) **${invalidCodes.join(', ')}** do not exist in **${chosenShowtime.roomName}**. Please choose valid available seat codes:\n\n${mapSummary}`
            : `⚠️ Mã ghế **${invalidCodes.join(', ')}** không tồn tại trong sơ đồ **${chosenShowtime.roomName}**. Bạn vui lòng chọn đúng mã ghế trống hợp lệ:\n\n${mapSummary}`,
          intent: INTENTS.BOOKING_GUIDE,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          bookingFlow: prevFlow,
        };
      }

      if (unavailableCodes.length > 0) {
        const mapSummary = formatSeatMapSummary(realtimeSeats, [], prevFlow.ticketQuantity, nowDate, isEn);
        return {
          reply: isEn
            ? `⚠️ Seat(s) **${unavailableCodes.join(', ')}** are already booked or being held. Please select available seats instead:\n\n${mapSummary}`
            : `⚠️ Ghế **${unavailableCodes.join(', ')}** hiện đã có người đặt hoặc đang được giữ chỗ. Bạn vui lòng chọn ghế trống khác nhé:\n\n${mapSummary}`,
          intent: INTENTS.BOOKING_GUIDE,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          bookingFlow: prevFlow,
        };
      }

      const mergedSeats = [...new Set([...prevFlow.selectedSeats, ...validChosen])];
      if (mergedSeats.length !== prevFlow.ticketQuantity) {
        prevFlow.selectedSeats = mergedSeats.slice(0, prevFlow.ticketQuantity);
        const remaining = prevFlow.ticketQuantity - prevFlow.selectedSeats.length;
        const mapSummary = formatSeatMapSummary(realtimeSeats, prevFlow.selectedSeats, prevFlow.ticketQuantity, nowDate, isEn);
        return {
          reply: isEn
            ? `You are booking **${prevFlow.ticketQuantity}** ticket(s) and have selected **${prevFlow.selectedSeats.join(', ')}**. Please choose **${remaining}** more available seat(s):\n\n${mapSummary}`
            : `Bạn đang đặt **${prevFlow.ticketQuantity} vé**, hiện đã chọn ghế **${prevFlow.selectedSeats.join(', ')}**. Vui lòng chọn thêm **${remaining} ghế trống** nữa:\n\n${mapSummary}`,
          intent: INTENTS.BOOKING_GUIDE,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          bookingFlow: prevFlow,
        };
      }

      prevFlow.selectedSeats = mergedSeats;
      prevFlow.step = 'CONFIRM';
    } else if (prevFlow.selectedSeats.length !== prevFlow.ticketQuantity) {
      prevFlow.step = 'ASK_SEATS';
      if (realtimeSeats.length === 0) {
        return {
          reply: isEn
            ? `You selected **${selectedMovie.title}** at **${chosenShowtime.time}** (${chosenShowtime.roomName}). Please open the interactive seat map to pick your **${prevFlow.ticketQuantity}** seat(s):\n\n👉 [Select Seats & Checkout ➔](${chosenShowtime.bookingLink})`
            : `Bạn đã chọn phim **${selectedMovie.title}** — suất **${chosenShowtime.time}** (${chosenShowtime.roomName}). Vui lòng mở sơ đồ phòng chiếu để chọn **${prevFlow.ticketQuantity} ghế** và xác nhận đặt vé:\n\n👉 [Mở sơ đồ chọn ghế ➔](${chosenShowtime.bookingLink})`,
          intent: INTENTS.BOOKING_GUIDE,
          movieCard: buildSafeMovieCard(chosenShowtime, selectedMovie, nowDate),
          movieCards: [],
          quickReplies: [],
          bookingFlow: prevFlow,
        };
      }

      const mapSummary = formatSeatMapSummary(realtimeSeats, prevFlow.selectedSeats, prevFlow.ticketQuantity, nowDate, isEn);
      return {
        reply: isEn
          ? `💺 **Real-time Seat Map — ${selectedMovie.title} (${chosenShowtime.time}, ${chosenShowtime.roomName}):**\n\n${mapSummary}\n\nPlease reply with the **${prevFlow.ticketQuantity} seat code(s)** you want to select (e.g., \`F5, F6\`).`
          : `💺 **Sơ đồ ghế thực tế — ${selectedMovie.title} (Suất ${chosenShowtime.time}, ${chosenShowtime.roomName}):**\n\n${mapSummary}\n\nBạn vui lòng nhập **${prevFlow.ticketQuantity} mã ghế trống** muốn chọn (ví dụ: \`F5, F6\`).`,
        intent: INTENTS.BOOKING_GUIDE,
        movieCard: buildSafeMovieCard(chosenShowtime, selectedMovie, nowDate),
        movieCards: [],
        quickReplies: [],
        bookingFlow: prevFlow,
      };
    }
  }

  // Ghi nhận mã voucher hoặc thông tin liên hệ khách gửi bổ sung ở bước CONFIRM
  const voucherMatch = userMessage.match(/\b(?:ma|voucher|code)\s*[:=]?\s*([A-Z0-9_-]{4,16})\b/i);
  if (voucherMatch) {
    prevFlow.voucherCode = voucherMatch[1].toUpperCase();
  }
  const phoneInMsg = userMessage.match(/\b((?:\+?84|0)[35789]\d{8})\b/);
  if (phoneInMsg) {
    prevFlow.customerPhone = phoneInMsg[1].replace(/^\+84/, '0');
  }

  // Tính tổng tiền chính xác theo từng ghế thực tế trong ShowtimeSeat
  const seatLookup = new Map(realtimeSeats.map((s) => [normalizeSeatCodeLocal(s.seatNumber), s]));
  const tierPrices = {
    STANDARD: chosenShowtime.priceStandard,
    VIP: chosenShowtime.priceVip,
    SWEETBOX: chosenShowtime.priceSweetbox,
  };
  const subtotal = prevFlow.selectedSeats.reduce((sum, code) => {
    const sDoc = seatLookup.get(code);
    const tier = String(sDoc?.type || 'STANDARD').toUpperCase();
    return sum + (tierPrices[tier] || chosenShowtime.priceStandard);
  }, 0);

  // =========================================================================
  // BƯỚC 6: HOÀN TẤT KHI KHÁCH XÁC NHẬN ĐẶT VÉ
  // =========================================================================
  if (prevFlow.step === 'CONFIRM' && (entities.isConfirmAction || Boolean(phoneInMsg && prevFlow.waitingContact))) {
    const finalName = authUser?.name || prevFlow.customerName || 'Khách hàng';
    const finalPhone = authUser?.phone || prevFlow.customerPhone || '';
    const finalEmail = authUser?.email || '';

    if (!finalPhone) {
      prevFlow.waitingContact = true;
      return {
        reply: isEn
          ? 'Please sign in at [Sign In ➔](/auth) or reply with your **10-digit Vietnam phone number** (e.g., `0912345678`) to confirm and issue your ticket.'
          : 'Để hệ thống ghi nhận vé chính chủ, bạn vui lòng [Đăng nhập ➔](/auth) hoặc nhắn **số điện thoại 10 số** của bạn (ví dụ: `0912345678`) để hoàn tất đặt vé nhé!',
        intent: INTENTS.BOOKING_GUIDE,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        bookingFlow: prevFlow,
      };
    }

    const txResult = await executeAtomicBookingInDb({
      showtimeId: chosenShowtime.showtimeId,
      selectedSeats: prevFlow.selectedSeats,
      voucherCode: prevFlow.voucherCode,
      authUser,
      customerName: finalName,
      customerPhone: finalPhone,
      customerEmail: finalEmail,
      nowDate,
      mockBookingExecutor,
    });

    if (!txResult.ok) {
      if (txResult.reason === 'SEAT_TAKEN') {
        prevFlow.selectedSeats = [];
        prevFlow.step = 'ASK_SEATS';
        const refreshedSeats = await loadRealtimeSeatsForShowtime(chosenShowtime, nowDate);
        const mapSummary = formatSeatMapSummary(refreshedSeats, [], prevFlow.ticketQuantity, nowDate, isEn);
        return {
          reply: isEn
            ? `⚠️ Seat(s) **${(txResult.takenSeats || []).join(', ')}** were just booked by another customer. No charge was made. Please select available seats again:\n\n${mapSummary}`
            : `⚠️ Ghế **${(txResult.takenSeats || []).join(', ')}** vừa được khách hàng khác đặt trước nên giao dịch chưa được tạo. Bạn vui lòng chọn lại ghế trống khác nhé:\n\n${mapSummary}`,
          intent: INTENTS.BOOKING_GUIDE,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          bookingFlow: prevFlow,
        };
      }

      return {
        reply: isEn
          ? `The system could not finalize the transaction automatically right now. Your booking has **not** been created yet — please complete checkout directly here:\n👉 [Complete Checkout (${prevFlow.selectedSeats.join(', ')}) ➔](${chosenShowtime.bookingLink})`
          : `Hiện hệ thống chưa thể xác nhận giao dịch trực tiếp lúc này (đơn vé **chưa** được tạo). Bạn vui lòng hoàn tất thanh toán trực tiếp tại trang đặt ghế nhé:\n👉 [Hoàn tất đặt ghế (${prevFlow.selectedSeats.join(', ')}) ➔](${chosenShowtime.bookingLink})`,
        intent: INTENTS.BOOKING_GUIDE,
        movieCard: buildSafeMovieCard(chosenShowtime, selectedMovie, nowDate),
        movieCards: [],
        quickReplies: [],
        bookingFlow: prevFlow,
      };
    }

    return {
      reply: isEn
        ? `🎉 **Booking Confirmed Successfully!**\n\n• **Booking Code:** **\`${txResult.bookingCode}\`**\n• **Movie:** **${selectedMovie.title}**\n• **Showtime:** **${chosenShowtime.time}** (${chosenShowtime.date})\n• **Room:** **${chosenShowtime.roomName}** (${chosenShowtime.format})\n• **Seats (${txResult.seats.length}):** **${txResult.seats.join(', ')}**\n• **Total Paid:** **${formatVND(txResult.totalAmount)}**\n\n👉 [View Your Ticket & QR Code ➔](/my-tickets)`
        : `🎉 **Đặt vé thành công!**\n\n• **Mã đặt vé:** **\`${txResult.bookingCode}\`**\n• **Phim:** **${selectedMovie.title}**\n• **Suất chiếu:** **${chosenShowtime.time}** (${chosenShowtime.date})\n• **Phòng chiếu:** **${chosenShowtime.roomName}** (${chosenShowtime.format})\n• **Số lượng & Vị trí ghế (${txResult.seats.length} vé):** **${txResult.seats.join(', ')}**\n• **Tổng thanh toán:** **${formatVND(txResult.totalAmount)}**\n\n👉 [Xem mã QR tại Vé của tôi ➔](/my-tickets)`,
      intent: INTENTS.BOOKING_GUIDE,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      bookingFlow: null,
    };
  }

  // =========================================================================
  // BƯỚC 5: XÁC NHẬN THÔNG TIN ĐẶT VÉ TRƯỚC KHI TẠO ĐƠN
  // =========================================================================
  prevFlow.step = 'CONFIRM';
  const promoText = prevFlow.voucherCode
    ? prevFlow.voucherCode
    : isEn
      ? 'None'
      : 'Không áp dụng';

  return {
    reply: isEn
      ? `📋 **Please confirm your booking details:**\n\n• **Movie:** **${selectedMovie.title}**\n• **Showtime:** **${chosenShowtime.time}** (${chosenShowtime.date})\n• **Room:** **${chosenShowtime.roomName}** (${chosenShowtime.format})\n• **Quantity:** **${prevFlow.ticketQuantity}** ticket(s)\n• **Seats:** **${prevFlow.selectedSeats.join(', ')}**\n• **Combo & Promo:** ${promoText}\n• **Total Amount:** **${formatVND(subtotal)}**\n\nReply **Confirm** to place your booking (or **Cancel** to abort), or complete payment on the checkout page: [Open Seat Checkout ➔](${chosenShowtime.bookingLink})`
      : `📋 **Xác nhận thông tin đặt vé của bạn:**\n\n• **Phim:** **${selectedMovie.title}**\n• **Suất chiếu:** **${chosenShowtime.time}** (${chosenShowtime.date})\n• **Phòng chiếu:** **${chosenShowtime.roomName}** (${chosenShowtime.format})\n• **Số lượng vé:** **${prevFlow.ticketQuantity}** vé\n• **Vị trí ghế:** **${prevFlow.selectedSeats.join(', ')}**\n• **Combo & Ưu đãi:** ${promoText}\n• **Tổng tiền:** **${formatVND(subtotal)}**\n\nBạn vui lòng nhắn **Xác nhận** để tạo đơn đặt vé (hoặc nhắn **Hủy** nếu muốn thay đổi), hoặc thao tác trực tiếp tại [Trang thanh toán ghế ➔](${chosenShowtime.bookingLink}).`,
    intent: INTENTS.BOOKING_GUIDE,
    movieCard: buildSafeMovieCard(chosenShowtime, selectedMovie, nowDate),
    movieCards: [],
    quickReplies: [],
    bookingFlow: prevFlow,
  };
};

/**
 * Tạo phiếu yêu cầu hỗ trợ thật trong MongoDB (Mục 9.5) khi khách yêu cầu kết nối nhân viên và đã xác thực tài khoản.
 * Tuyệt đối không giả vờ nhân viên đã kết nối trực tiếp khi chưa có xác nhận.
 */
export const createSupportHandoffTicketIfPossible = async ({
  authUser = null,
  userMessage = '',
  safeHistory = [],
}) => {
  if (!authUser || (!authUser.email && !authUser.phone) || mongoose.connection.readyState !== 1) {
    return null;
  }

  try {
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const ticketCode = `SPT-${randomCode}-VN`;
    const recentTranscript = safeHistory
      .slice(-4)
      .map((h) => `[${h.sender === 'user' ? 'Khách' : 'Bot'}]: ${h.text}`)
      .concat(`[Khách]: ${userMessage}`)
      .join('\n')
      .slice(0, 1500);

    await SupportTicket.create({
      ticketCode,
      fullName: authUser.name || 'Khách hàng thành viên',
      contact: authUser.phone || authUser.email,
      bookingCode: '',
      category: 'Yêu cầu kết nối nhân viên từ AI Chatbot',
      content: recentTranscript,
    });

    return {
      ticketCode,
      status: 'PENDING_STAFF',
    };
  } catch {
    return null;
  }
};
