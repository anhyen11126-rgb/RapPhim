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

/**
 * Sinh cấu trúc mẫu chuẩn 88 ghế theo quy cách của D'AVENOR CINEMA:
 * - Hàng A - D: 12 ghế/hàng (6 trái + LỐI ĐI + 6 phải) -> 48 ghế STANDARD
 * - Hàng E - G: 12 ghế/hàng (6 trái + LỐI ĐI + 6 phải) -> 36 ghế VIP
 * - Hàng H: 4 ghế (2 trái + LỐI ĐI + 2 phải) -> 4 ghế SWEETBOX/VIP RECLINER
 * Tổng cộng: 48 + 36 + 4 = Đúng 88 ghế
 */
export const generate88SeatsTemplate = (showtimeId) => {
  const seats = [];
  const standardRows = ['A', 'B', 'C', 'D'];
  const vipRows = ['E', 'F', 'G'];

  // Hàng A - D: 48 ghế STANDARD
  for (const row of standardRows) {
    for (let col = 1; col <= 12; col++) {
      seats.push({
        showtimeId,
        seatNumber: `${row}${col}`,
        row,
        col,
        type: 'STANDARD',
        status: 'AVAILABLE',
      });
    }
  }

  // Hàng E - G: 36 ghế VIP
  for (const row of vipRows) {
    for (let col = 1; col <= 12; col++) {
      seats.push({
        showtimeId,
        seatNumber: `${row}${col}`,
        row,
        col,
        type: 'VIP',
        status: 'AVAILABLE',
      });
    }
  }

  // Hàng H: 4 ghế SWEETBOX / VIP RECLINER
  for (let col = 1; col <= 4; col++) {
    seats.push({
      showtimeId,
      seatNumber: `H${col}`,
      row: 'H',
      col,
      type: 'SWEETBOX',
      status: 'AVAILABLE',
    });
  }

  return seats;
};

/**
 * Đảm bảo 88 ghế của suất chiếu tồn tại trong Database và trạng thái được đối soát đồng bộ
 * chính xác 100% với các đơn đặt vé (Booking) hợp lệ trong suất chiếu.
 */
export const ensureShowtimeSeats = async (showtimeId) => {
  const stId = new mongoose.Types.ObjectId(showtimeId);
  const existingSeats = await ShowtimeSeat.find({ showtimeId: stId }).lean();

  // Truy vấn toàn bộ vé đã thanh toán (PAID) thực tế của suất chiếu này
  const paidBookings = await Booking.find({ showtimeId: stId, status: 'PAID' }).lean();
  const bookedSeatSet = new Set();

  paidBookings.forEach((b) => {
    if (b.seats) {
      b.seats
        .split(',')
        .map((s) => normalizeSeatCode(s))
        .filter(Boolean)
        .forEach((code) => bookedSeatSet.add(code));
    }
  });

  // Kiểm tra xem phòng chiếu đã có đúng cấu trúc 88 ghế chưa
  const hasExact88 =
    existingSeats.length === 88 &&
    existingSeats.filter((s) => s.row === 'H').length === 4;

  if (!hasExact88) {
    // Nếu chưa có hoặc cấu hình cũ sai lệch (vd: 8x11), tạo mới chuẩn 88 ghế
    await ShowtimeSeat.deleteMany({ showtimeId: stId });
    const templateSeats = generate88SeatsTemplate(stId);
    templateSeats.forEach((s) => {
      if (bookedSeatSet.has(s.seatNumber)) {
        s.status = 'BOOKED';
      }
    });
    await ShowtimeSeat.insertMany(templateSeats);
    return await ShowtimeSeat.find({ showtimeId: stId }).sort({ row: 1, col: 1 }).lean();
  }

  // Nếu đã có 88 ghế, đồng bộ trạng thái thực tế
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
    } else if (!shouldBeBooked && s.status === 'BOOKED' && !s.bookingId) {
      // Ghế ảo không có đơn thanh toán thực -> khôi phục trạng thái trống
      updates.push(
        ShowtimeSeat.updateOne(
          { _id: s._id },
          { $set: { status: 'AVAILABLE', bookingId: null, holdExpiresAt: null } }
        )
      );
    } else if (s.status === 'HOLDING') {
      // Xóa bỏ trạng thái giữ tạm thời theo yêu cầu
      updates.push(
        ShowtimeSeat.updateOne(
          { _id: s._id },
          { $set: { status: 'AVAILABLE', holdExpiresAt: null } }
        )
      );
    }
  });

  if (updates.length > 0) {
    await Promise.all(updates);
    return await ShowtimeSeat.find({ showtimeId: stId }).sort({ row: 1, col: 1 }).lean();
  }

  return existingSeats;
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
        .populate('cinemaId');
    } else {
      targetShowtime = await findOrCreateShowtimeFromKey(id, queryDate);
      if (targetShowtime) {
        await targetShowtime.populate('movieId');
        await targetShowtime.populate('cinemaId');
      }
    }

    if (!targetShowtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu yêu cầu' });
    }

    const showtimeId = targetShowtime._id;

    // Đảm bảo và đồng bộ chính xác 88 ghế theo Booking thực tế của suất chiếu này
    const rawSeats = await ensureShowtimeSeats(showtimeId);

    // Tính toán số liệu thống kê thời gian thực từ dữ liệu thực tế
    const totalSeats = 88;
    const bookedSeats = rawSeats.filter((s) => s.status === 'BOOKED');
    const bookedSeatsCount = bookedSeats.length;
    const availableSeatsCount = Math.max(0, totalSeats - bookedSeatsCount);
    const occupancyRate = ((bookedSeatsCount / totalSeats) * 100).toFixed(1) + '%';

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
      totalSeats,
      bookedSeatsCount,
      availableSeatsCount,
      occupancyRate,
      showtime: {
        ...showtimeData,
        id: showtimeData._id.toString(),
        movie: showtimeData.movieId
          ? { ...showtimeData.movieId, id: showtimeData.movieId._id.toString() }
          : null,
        cinema: showtimeData.cinemaId
          ? { ...showtimeData.cinemaId, id: showtimeData.cinemaId._id.toString() }
          : null,
      },
      seats,
    });
  } catch (error) {
    console.error('Lỗi khi lấy sơ đồ ghế:', error);
    res.status(500).json({ message: 'Lỗi khi lấy sơ đồ ghế', error: error.message });
  }
};
