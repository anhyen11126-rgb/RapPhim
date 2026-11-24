import mongoose from 'mongoose';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Movie from '../models/Movie.js';
import Cinema from '../models/Cinema.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';

/**
 * Chuẩn hóa mã ghế (ví dụ: "A01" -> "A1", "H04" -> "H4", "c4" -> "C4")
 */
export const normalizeSeatCode = (raw) => {
  if (!raw) return '';
  const trimmed = String(raw).trim().toUpperCase();
  const match = trimmed.match(/^([A-Z])0*(\d+)$/);
  if (match) {
    return `${match[1]}${parseInt(match[2], 10)}`;
  }
  return trimmed;
};

// The rotated analytics seed has a distinct code and does not issue a QR ticket.
export const isAnalyticsSeedBooking = (booking) =>
  !booking.qrToken && /^MTX-\d{6}-\d+$/.test(booking.bookingCode ?? '');

export function paidSeatCodes(bookings) {
  const codes = new Set();
  for (const booking of bookings) {
    if (isAnalyticsSeedBooking(booking)) continue;
    for (const rawCode of (booking.seats ?? '').split(',')) {
      const code = normalizeSeatCode(rawCode);
      if (code) codes.add(code);
    }
  }
  return codes;
}

async function findRoomSeatTemplate(room, showtimeId) {
  const [template] = await ShowtimeSeat.aggregate([
    { $match: { roomId: room._id, showtimeId: { $ne: showtimeId } } },
    { $group: { _id: '$showtimeId', size: { $sum: 1 }, created: { $max: '$createdAt' } } },
    { $match: { size: room.totalSeats } },
    { $sort: { created: -1, _id: -1 } },
    { $limit: 1 },
  ]);
  if (!template) return [];
  return ShowtimeSeat.find({ showtimeId: template._id, roomId: room._id }).select('seatNumber row col type').lean();
}

export const ensureShowtimeSeats = async (showtimeId) => {
  const stId = new mongoose.Types.ObjectId(showtimeId);
  const [existingSeats, paidBookings] = await Promise.all([
    ShowtimeSeat.find({ showtimeId: stId }).lean(),
    Booking.find({ showtimeId: stId, status: 'PAID' }).select('bookingCode qrToken seats').lean(),
  ]);
  const bookedSeatSet = paidSeatCodes(paidBookings);
  const seedIds = new Set(paidBookings.filter(isAnalyticsSeedBooking).map(booking => String(booking._id)));

  const withPaidStatus = (seats) => seats.map(seat => ({
    ...seat, status: bookedSeatSet.has(normalizeSeatCode(seat.seatNumber)) ? 'BOOKED' : 'AVAILABLE',
  }));

  // Use the stored layout of the same physical room when opening a new showtime.
  if (!existingSeats.length) {
    const showtime = await Showtime.findById(stId).select('roomId roomName cinemaId').populate('roomId').lean();
    const room = showtime?.roomId ?? (showtime && await Room.findOne({
      cinemaId: showtime.cinemaId,
      name: showtime.roomName,
    }).lean());
    if (!Number.isInteger(room?.totalSeats) || room.totalSeats <= 0) return [];
    const template = await findRoomSeatTemplate(room, stId);
    if (template.length !== room.totalSeats) return [];

    await ShowtimeSeat.bulkWrite(template.map(({ seatNumber, row, col, type }) => ({
      updateOne: {
        filter: { showtimeId: stId, seatNumber },
        update: { $setOnInsert: {
          showtimeId: stId, seatNumber, row, col, type,
          roomId: room._id,
          status: bookedSeatSet.has(normalizeSeatCode(seatNumber)) ? 'BOOKED' : 'AVAILABLE',
        } },
        upsert: true,
      },
    })));
    return withPaidStatus(await ShowtimeSeat.find({ showtimeId: stId }).sort({ row: 1, col: 1 }).lean());
  }

  const updates = [];
  existingSeats.forEach((s) => {
    const norm = normalizeSeatCode(s.seatNumber);
    const shouldBeBooked = bookedSeatSet.has(norm);
    if (shouldBeBooked && s.status !== 'BOOKED') {
      updates.push(
        ShowtimeSeat.updateOne(
          { _id: s._id },
          { $set: { status: 'BOOKED', holdExpiresAt: null } }
        )
      );
    } else if (!shouldBeBooked && s.status === 'BOOKED' && (!s.bookingId || seedIds.has(String(s.bookingId)))) {
      // Guard against clearing a seat acquired by a concurrent checkout.
      updates.push(
        ShowtimeSeat.updateOne(
          { _id: s._id, status: 'BOOKED', bookingId: s.bookingId ?? null },
          { $set: { status: 'AVAILABLE', bookingId: null, holdExpiresAt: null } }
        )
      );
    } else if (s.status === 'HOLDING') {
      // Xóa bỏ trạng thái giữ tạm thời theo yêu cầu
      updates.push(
        ShowtimeSeat.updateOne(
          { _id: s._id, status: 'HOLDING', bookingId: s.bookingId ?? null },
          { $set: { status: 'AVAILABLE', holdExpiresAt: null } }
        )
      );
    }
  });

  if (updates.length > 0) {
    await Promise.all(updates);
    return withPaidStatus(await ShowtimeSeat.find({ showtimeId: stId }).sort({ row: 1, col: 1 }).lean());
  }

  return withPaidStatus(existingSeats);
};

/**
 * Tìm hoặc tự động tạo suất chiếu trong Database khi nhận composite slot key
 */
export const findOrCreateShowtimeFromKey = async (id, queryDate = null) => {
  const parts = id.split('-');
  let movieDoc = null;

  if (mongoose.Types.ObjectId.isValid(parts[0])) {
    movieDoc = await Movie.findById(parts[0]).lean();
  }
  if (!movieDoc) {
    const slugCandidate = parts.slice(0, Math.max(1, parts.length - 2)).join('-') || parts[0];
    movieDoc = await Movie.findOne({
      $or: [
        { slug: slugCandidate },
        { slug: new RegExp(slugCandidate, 'i') },
        { title: new RegExp(parts[0], 'i') },
      ],
    }).lean();
  }
  if (!movieDoc) {
    movieDoc = await Movie.findOne().lean();
  }

  // Xác định loại phòng và định dạng chiếu
  let roomName = 'Phòng IMAX Laser';
  let formatFeature = 'IMAX Laser 2D';
  let price = 150000;
  if (id.toLowerCase().includes('atmos')) {
    roomName = 'Phòng Dolby Atmos';
    formatFeature = '2D Dolby Atmos';
    price = 120000;
  } else if (id.toLowerCase().includes('gold')) {
    roomName = 'Phòng Gold Class';
    formatFeature = 'Gold Class Luxury';
    price = 190000;
  }

  // Xác định giờ bắt đầu
  let hour = 19;
  let minute = 30;
  const timeMatch = id.match(/(\d{2})(\d{2})/);
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
  }

  // Xác định ngày chiếu
  let targetDate = new Date();
  if (queryDate && /^\d{4}-\d{2}-\d{2}/.test(queryDate)) {
    const [y, m, d] = queryDate.split('-').map(Number);
    targetDate = new Date(y, m - 1, d);
  }
  targetDate.setHours(hour, minute, 0, 0);

  const cinema = (await Cinema.findOne().lean()) || {
    _id: new mongoose.Types.ObjectId('6aecb03919dd0ede75638b6e'),
    name: "D'AVENOR Thanh Khê Plaza",
  };

  // Tìm kiếm suất chiếu thực tế trong database
  let existingShowtime = await Showtime.findOne({
    movieId: movieDoc._id,
    roomName,
    startTime: {
      $gte: new Date(targetDate.getTime() - 15 * 60 * 1000),
      $lte: new Date(targetDate.getTime() + 15 * 60 * 1000),
    },
  });

  if (!existingShowtime) {
    existingShowtime = await Showtime.create({
      movieId: movieDoc._id,
      cinemaId: cinema._id,
      roomName,
      formatFeature,
      startTime: targetDate,
      price,
      isLocked: false,
    });
  }

  return existingShowtime;
};

// Lấy thông tin 1 suất chiếu
export const getShowtimeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }

    const showtime = await Showtime.findById(id)
      .populate('movieId')
      .populate('cinemaId')
      .lean();

    if (!showtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }

    res.json({
      ...showtime,
      id: showtime._id.toString(),
      movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
      cinema: showtime.cinemaId ? { ...showtime.cinemaId, id: showtime.cinemaId._id.toString() } : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin suất chiếu', error: error.message });
  }
};

// Lấy sơ đồ 88 ghế thực tế và trạng thái đặt ghế độc lập theo suất chiếu
export const getShowtimeSeats = async (req, res) => {
  try {
    const { id } = req.params;
    const { date: queryDate } = req.query;

    let targetShowtime = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      targetShowtime = await Showtime.findById(id)
        .populate('movieId')
        .populate('cinemaId')
        .populate('roomId');
    } else {
      targetShowtime = await findOrCreateShowtimeFromKey(id, queryDate);
      if (targetShowtime) {
        await targetShowtime.populate('movieId');
        await targetShowtime.populate('cinemaId');
        await targetShowtime.populate('roomId');
      }
    }

    if (!targetShowtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu yêu cầu' });
    }

    const showtimeId = targetShowtime._id;

    // Đảm bảo và đồng bộ chính xác 88 ghế theo Booking thực tế của suất chiếu này
    const rawSeats = await ensureShowtimeSeats(showtimeId);

    // Tính toán số liệu thống kê thời gian thực từ dữ liệu thực tế
    const totalSeats = rawSeats.length;
    const bookedSeats = rawSeats.filter((s) => s.status === 'BOOKED');
    const bookedSeatsCount = bookedSeats.length;
    const availableSeatsCount = Math.max(0, totalSeats - bookedSeatsCount);
    const occupancyRate = ((totalSeats ? bookedSeatsCount / totalSeats : 0) * 100).toFixed(1) + '%';

    // Xác định trạng thái mở bán (Quy tắc 7 ngày & giờ chiếu)
    const now = new Date();
    const stStart = new Date(targetShowtime.startTime);
    const diffMs = stStart.getTime() - now.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let saleStatus = 'OPEN_FOR_SALE';
    let saleMessage = 'Đang mở bán';

    if (diffMs < 0) {
      saleStatus = 'STARTED';
      saleMessage = 'Suất chiếu đã bắt đầu hoặc đã kết thúc';
    } else if (diffMs > sevenDaysMs) {
      saleStatus = 'COMING_SOON';
      saleMessage = 'Chưa mở bán. Hệ thống chỉ mở bán vé trước tối đa 7 ngày.';
    }

    const seats = rawSeats.map((s) => ({
      id: s._id.toString(),
      seatNumber: normalizeSeatCode(s.seatNumber),
      row: s.row,
      col: s.col,
      type: s.type,
      status: s.status === 'BOOKED' ? 'BOOKED' : 'AVAILABLE',
      price: s.price,
    }));

    const showtimeData = targetShowtime.toObject();

    res.json({
      success: true,
      roomId: targetShowtime.roomId?._id ?? rawSeats.find((seat) => seat.roomId)?.roomId,
      totalSeats,
      bookedSeatsCount,
      availableSeatsCount,
      occupancyRate,
      saleStatus,
      saleMessage,
      showtime: {
        ...showtimeData,
        id: showtimeData._id.toString(),
        movie: showtimeData.movieId
          ? { ...showtimeData.movieId, id: showtimeData.movieId._id.toString() }
          : null,
        cinema: showtimeData.cinemaId
          ? { ...showtimeData.cinemaId, id: showtimeData.cinemaId._id.toString() }
          : null,
        room: showtimeData.roomId
          ? { ...showtimeData.roomId, id: showtimeData.roomId._id.toString() }
          : null,
      },
      seats,
    });
  } catch (error) {
    console.error('Lỗi khi lấy sơ đồ ghế:', error);
    res.status(500).json({ message: 'Lỗi khi lấy sơ đồ ghế', error: error.message });
  }
};

/**
 * Thuật toán Gợi ý ghế thông minh (Smart Seat Recommender)
 * - Tự động tìm cụm 1-4 ghế liền kề nhau trên cùng một hàng.
 * - Tuyệt đối KHÔNG cắt ngang lối đi (Dãy Trái: 1-6, Dãy Phải: 7-12; Hàng H: 1-2 & 3-4).
 * - Phân tích điểm ngọt (Sweet Spot) tối ưu góc nhìn và khoảng cách tới màn hình.
 * - Ưu tiên theo sở thích: "CENTER", "VIP", "NEAR_SCREEN", "FAR_SCREEN".
 */
export const recommendSeats = async (req, res) => {
  try {
    const { id } = req.params;
    const count = Math.min(4, Math.max(1, parseInt(req.query.count, 10) || 2));
    const preference = (req.query.preference || 'CENTER').toUpperCase(); // 'CENTER' | 'VIP' | 'NEAR_SCREEN' | 'FAR_SCREEN'

    let targetShowtime = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      targetShowtime = await Showtime.findById(id);
    } else {
      targetShowtime = await findOrCreateShowtimeFromKey(id);
    }

    if (!targetShowtime) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu' });
    }

    const rawSeats = await ensureShowtimeSeats(targetShowtime._id);
    const availableSeatSet = new Set(
      rawSeats.filter((s) => s.status !== 'BOOKED').map((s) => normalizeSeatCode(s.seatNumber))
    );

    // Xây dựng các cụm ghế khả thi trên từng hàng
    // Hàng A-G: Block trái cols [1..6], Block phải cols [7..12]
    // Hàng H: Block trái cols [1..2], Block phải cols [3..4]
    const candidates = [];

    const rowsConfig = [
      { row: 'A', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'STANDARD', baseRowScore: 35 },
      { row: 'B', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'STANDARD', baseRowScore: 60 },
      { row: 'C', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'STANDARD', baseRowScore: 80 },
      { row: 'D', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'STANDARD', baseRowScore: 92 },
      { row: 'E', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'VIP', baseRowScore: 100 },
      { row: 'F', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'VIP', baseRowScore: 95 },
      { row: 'G', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'VIP', baseRowScore: 85 },
      { row: 'H', left: [1, 2], right: [3, 4], type: 'SWEETBOX', baseRowScore: 75 },
    ];

    rowsConfig.forEach((cfg) => {
      [cfg.left, cfg.right].forEach((blockCols, blockIdx) => {
        const sideName = blockIdx === 0 ? 'Dãy trái' : 'Dãy phải';
        if (blockCols.length < count) return;

        for (let i = 0; i <= blockCols.length - count; i++) {
          const sliceCols = blockCols.slice(i, i + count);
          const seatCodes = sliceCols.map((c) => `${cfg.row}${c}`);

          // Kiểm tra toàn bộ ghế trong cụm có khả dụng không
          const allAvailable = seatCodes.every((code) => availableSeatSet.has(code));
          if (!allAvailable) continue;

          // Tính điểm số sweet-spot
          let score = cfg.baseRowScore;

          // Tính khoảng cách tâm cột tới trục giữa (trục giữa rạp là 6.5)
          const avgCol = sliceCols.reduce((sum, c) => sum + c, 0) / count;
          const distFromCenterAisle = Math.abs(avgCol - 6.5);
          score += Math.max(0, 30 - distFromCenterAisle * 6);

          // Điều chỉnh theo sở thích khách hàng
          if (preference === 'CENTER') {
            // Điểm ngọt hoàn hảo: Hàng D, E, F và gần trục giữa
            if (['D', 'E', 'F'].includes(cfg.row)) score += 35;
            if (cfg.row === 'E') score += 15;
            if (avgCol >= 3.5 && avgCol <= 9.5) score += 20;
          } else if (preference === 'VIP') {
            // Ưu tiên hàng VIP E, F, G hoặc H
            if (cfg.type === 'VIP') score += 40;
            if (cfg.type === 'SWEETBOX') score += 35;
          } else if (preference === 'NEAR_SCREEN') {
            // Ưu tiên hàng B, C, D (gần vừa phải, trừ hàng A vì quá sát)
            if (['B', 'C', 'D'].includes(cfg.row)) score += 45;
            if (cfg.row === 'A') score -= 15;
          } else if (preference === 'FAR_SCREEN') {
            // Ưu tiên hàng F, G, H
            if (['F', 'G', 'H'].includes(cfg.row)) score += 45;
          }

          let label = `${count} ghế liền kề hàng ${cfg.row} (${sideName})`;
          if (['E', 'F'].includes(cfg.row) && avgCol >= 4 && avgCol <= 9) {
            label = `Điểm ngọt vàng hàng ${cfg.row} - Góc nhìn chuẩn điện ảnh`;
          } else if (cfg.type === 'VIP') {
            label = `Khu vực VIP hàng ${cfg.row} cao cấp`;
          }

          candidates.push({
            row: cfg.row,
            cols: sliceCols,
            seatCodes,
            type: cfg.type,
            side: sideName,
            score: Math.round(score),
            label,
          });
        }
      });
    });

    // Sắp xếp các cụm ghế khả dụng theo điểm số giảm dần
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return res.json({
        success: false,
        message: `Rất tiếc, không còn cụm ${count} ghế liền kề phù hợp trong suất chiếu này.`,
        bestRecommendation: null,
        alternatives: [],
      });
    }

    const bestRecommendation = candidates[0];
    // Lấy tối đa 3 lựa chọn thay thế (ở các hàng khác nhau nếu có)
    const alternatives = [];
    const usedRows = new Set([bestRecommendation.row]);

    for (let i = 1; i < candidates.length && alternatives.length < 3; i++) {
      const cand = candidates[i];
      if (!usedRows.has(cand.row) || alternatives.length >= 2) {
        alternatives.push(cand);
        usedRows.add(cand.row);
      }
    }

    res.json({
      success: true,
      count,
      preference,
      bestRecommendation,
      alternatives,
    });
  } catch (error) {
    console.error('Lỗi gợi ý ghế:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gợi ý ghế: ' + error.message });
  }
};
