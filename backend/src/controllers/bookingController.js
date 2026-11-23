import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Booking from '../models/Booking.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Showtime from '../models/Showtime.js';
import Movie from '../models/Movie.js';
import {
  normalizeSeatCode,
  ensureShowtimeSeats,
  findOrCreateShowtimeFromKey,
} from './showtimeController.js';

const JWT_SECRET = process.env.JWT_SECRET || 'movietix_jwt_secret_key_2026_cdio';

/**
 * Xử lý yêu cầu chọn ghế:
 * Theo nguyên tắc mới: KHÔNG khóa ghế tạm thời trong DB khi khách chỉ chọn ghế.
 * Ghế chỉ mang tính chất chọn hiển thị trên client.
 */
export const holdSeats = async (req, res) => {
  try {
    const { showtimeId, seatNumbers } = req.body;

    if (!showtimeId || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      return res.status(400).json({ message: 'Dữ liệu chọn ghế không hợp lệ' });
    }

    res.json({
      success: true,
      message: 'Đã ghi nhận ghế chọn trên giao diện',
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi chọn ghế', error: error.message });
  }
};

/**
 * Xác nhận thanh toán & Tạo mã vé điện tử chính thức
 * Cơ chế CONCURRENCY-SAFE NGUYÊN TỬ: Chống bán trùng ghế 100% giữa 2 khách hàng cùng đặt một lúc.
 */
export const checkoutBooking = async (req, res) => {
  try {
    const {
      showtimeId,
      seatNumbers,
      customerName,
      customerPhone,
      customerEmail,
      concessions,
      totalAmount,
      paymentMethod = 'MOMO',
    } = req.body;

    if (
      !showtimeId ||
      !Array.isArray(seatNumbers) ||
      seatNumbers.length === 0 ||
      !customerName ||
      !customerPhone
    ) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin đặt vé và danh sách ghế.',
      });
    }

    // 1. Chuẩn hóa danh sách ghế: ["A1", "A2", ...]
    const normalizedSeats = [...new Set(seatNumbers.map((s) => normalizeSeatCode(s)))];

    // 2. Tìm suất chiếu trong Database
    let targetShowtime = null;
    if (mongoose.Types.ObjectId.isValid(showtimeId)) {
      targetShowtime = await Showtime.findById(showtimeId);
    } else {
      targetShowtime = await findOrCreateShowtimeFromKey(showtimeId);
    }

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
    const maxAdvanceMs = 7 * 24 * 60 * 60 * 1000;

    if (showtimeStart.getTime() - now.getTime() > maxAdvanceMs) {
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

    const stId = targetShowtime._id;

    // 3. Đảm bảo 88 ghế của suất chiếu này đã tồn tại trong ShowtimeSeat
    await ensureShowtimeSeats(stId);

    // 4. BƯỚC NGUYÊN TỬ (ATOMIC CONCURRENCY CHECK):
    // Sinh ID, mã vé và mã QR token duy nhất cho giao dịch này
    const tempBookingId = new mongoose.Types.ObjectId();
    const bookingCode = `MTX${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
    const qrToken = `DAV-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Thực hiện Atomic Update: Chỉ cập nhật những ghế thuộc suất này VÀ chưa bị BOOKED
    const acquireResult = await ShowtimeSeat.updateMany(
      {
        showtimeId: stId,
        seatNumber: { $in: normalizedSeats },
        status: { $ne: 'BOOKED' },
      },
      {
        $set: {
          status: 'BOOKED',
          bookingId: tempBookingId,
          holdExpiresAt: null,
        },
      }
    );

    // Kiểm tra xem có đúng TẤT CẢ các ghế được chiếm độc quyền thành công không
    if (acquireResult.modifiedCount !== normalizedSeats.length) {
      // Xung đột đồng thời: Đã có ít nhất 1 ghế vừa được khách khác thanh toán thành công trước!
      // Hoàn nguyên (rollback) những ghế mà giao dịch này lỡ cập nhật
      if (acquireResult.modifiedCount > 0) {
        await ShowtimeSeat.updateMany(
          {
            showtimeId: stId,
            bookingId: tempBookingId,
          },
          {
            $set: {
              status: 'AVAILABLE',
              bookingId: null,
              holdExpiresAt: null,
            },
          }
        );
      }

      // Tìm tên các ghế đã bị người khác mua trước để báo chi tiết
      const bookedConflicts = await ShowtimeSeat.find({
        showtimeId: stId,
        seatNumber: { $in: normalizedSeats },
        bookingId: { $ne: tempBookingId },
        status: 'BOOKED',
      }).lean();

      const conflictNames =
        bookedConflicts.map((s) => s.seatNumber).join(', ') || normalizedSeats.join(', ');

      return res.status(409).json({
        success: false,
        conflict: true,
        message: `Rất tiếc! Ghế (${conflictNames}) vừa được khách khác thanh toán thành công trước đó. Vui lòng chọn ghế khác!`,
        conflictSeats: bookedConflicts.map((s) => s.seatNumber),
      });
    }

    // 5. Toàn bộ ghế đã được giữ an toàn, tiến hành tạo Booking chính thức
    let newBooking;
    try {
      newBooking = await Booking.create({
        _id: tempBookingId,
        bookingCode,
        qrToken,
        showtimeId: stId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.toString().trim(),
        customerEmail: customerEmail ? customerEmail.trim().toLowerCase() : '',
        seats: normalizedSeats.join(', '),
        concessions: concessions || '',
        totalAmount: parseFloat(totalAmount),
        status: 'PAID',
        paymentMethod,
        isCheckedIn: false,
      });
    } catch (createErr) {
      // Nếu việc tạo Booking thất bại, rollback trả lại ghế ngay lập tức
      await ShowtimeSeat.updateMany(
        {
          showtimeId: stId,
          bookingId: tempBookingId,
        },
        {
          $set: {
            status: 'AVAILABLE',
            bookingId: null,
            holdExpiresAt: null,
          },
        }
      );
      throw createErr;
    }

    // Truy vấn đầy đủ thông tin vé kèm phim và suất chiếu để trả về client
    const showtime = await Showtime.findById(stId)
      .populate('movieId')
      .populate('cinemaId')
      .lean();

    const formattedBooking = {
      ...newBooking.toObject(),
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
    console.error('Lỗi khi thanh toán đặt vé:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi thanh toán đặt vé: ' + error.message,
    });
  }
};

// Lấy danh sách vé & lịch sử đặt vé của người dùng hiện tại
export const getMyBookings = async (req, res) => {
  try {
    let email = req.query.email;
    let phone = req.query.phone;

    // Nếu client gửi kèm Bearer JWT Token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.email) email = decoded.email;
        if (decoded.phone) phone = decoded.phone;
      } catch (e) {
        // Token không hợp lệ thì tiếp tục dựa vào query
      }
    }

    if (!email && !phone) {
      return res.json([]);
    }

    const queryConditions = [];
    if (email) {
      queryConditions.push({ customerEmail: email.toLowerCase().trim() });
    }
    if (phone) {
      queryConditions.push({ customerPhone: phone.toString().replace(/[\s.-]/g, '') });
      queryConditions.push({ customerPhone: phone.trim() });
    }

    const bookings = await Booking.find({ $or: queryConditions })
      .sort({ createdAt: -1 })
      .populate({
        path: 'showtimeId',
        populate: [
          { path: 'movieId' },
          { path: 'cinemaId' },
        ],
      })
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

    const booking = await Booking.findOne({ bookingCode: code }).populate({
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
      booking = await Booking.findById(id).populate('showtimeId');
    } else {
      booking = await Booking.findOne({ bookingCode: id }).populate('showtimeId');
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt vé yêu cầu.' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Đơn đặt vé này đã được hủy trước đó.' });
    }

    if (booking.status !== 'PAID') {
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

    // Tiến hành hủy vé & giải phóng ghế
    const seatList = (booking.seats || '')
      .split(',')
      .map((s) => normalizeSeatCode(s))
      .filter(Boolean);

    await ShowtimeSeat.updateMany(
      {
        showtimeId: showtime._id,
        seatNumber: { $in: seatList },
        bookingId: booking._id,
      },
      {
        $set: {
          status: 'AVAILABLE',
          bookingId: null,
          holdExpiresAt: null,
        },
      }
    );

    booking.status = 'CANCELLED';
    booking.qrToken = null; // Vô hiệu hóa QR code cũ
    booking.refundAmount = booking.totalAmount;
    await booking.save();

    return res.json({
      success: true,
      message: 'Hủy vé thành công! Số tiền hoàn lại sẽ được chuyển về phương thức thanh toán ban đầu của quý khách.',
      refundAmount: booking.refundAmount,
      bookingCode: booking.bookingCode,
    });
  } catch (error) {
    console.error('Lỗi hủy vé:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xử lý hủy vé: ' + error.message });
  }
};

/**
 * Đổi vé tự nguyện (Yêu cầu ít nhất 24 giờ trước giờ chiếu - Phần 11)
 */
export const exchangeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetShowtimeId, newSeatNumbers } = req.body;

    if (!targetShowtimeId || !Array.isArray(newSeatNumbers) || newSeatNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp suất chiếu mới và danh sách ghế muốn đổi.' });
    }

    let booking = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      booking = await Booking.findById(id).populate('showtimeId');
    } else {
      booking = await Booking.findOne({ bookingCode: id }).populate('showtimeId');
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt vé yêu cầu đổi.' });
    }

    if (booking.status !== 'PAID') {
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

    const newStart = new Date(targetShowtime.startTime);
    if (newStart.getTime() <= now.getTime()) {
      return res.status(400).json({ success: false, message: 'Suất chiếu mới đã bắt đầu hoặc đã qua.' });
    }
    if (newStart.getTime() - now.getTime() > 7 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ success: false, message: 'Suất chiếu mới chưa mở bán (vượt quá 7 ngày).' });
    }

    // Chuẩn hóa danh sách ghế mới
    const normalizedNewSeats = [...new Set(newSeatNumbers.map((s) => normalizeSeatCode(s)))];
    await ensureShowtimeSeats(targetShowtime._id);

    // BƯỚC NGUYÊN TỬ: Chiếm giữ ghế mới trước khi nhả ghế cũ
    const acquireResult = await ShowtimeSeat.updateMany(
      {
        showtimeId: targetShowtime._id,
        seatNumber: { $in: normalizedNewSeats },
        status: { $ne: 'BOOKED' },
      },
      {
        $set: {
          status: 'BOOKED',
          bookingId: booking._id,
          holdExpiresAt: null,
        },
      }
    );

    if (acquireResult.modifiedCount !== normalizedNewSeats.length) {
      // Rollback những ghế mới lỡ cập nhật
      if (acquireResult.modifiedCount > 0) {
        await ShowtimeSeat.updateMany(
          { showtimeId: targetShowtime._id, bookingId: booking._id, seatNumber: { $in: normalizedNewSeats } },
          { $set: { status: 'AVAILABLE', bookingId: null } }
        );
      }
      return res.status(409).json({
        success: false,
        message: 'Một số ghế bạn chọn ở suất chiếu mới vừa có khách khác mua. Vui lòng chọn ghế khác!',
      });
    }

    // Giải phóng ghế cũ
    const oldSeatsList = (booking.seats || '').split(',').map((s) => normalizeSeatCode(s)).filter(Boolean);
    await ShowtimeSeat.updateMany(
      {
        showtimeId: booking.showtimeId._id,
        seatNumber: { $in: oldSeatsList },
        bookingId: booking._id,
      },
      {
        $set: {
          status: 'AVAILABLE',
          bookingId: null,
          holdExpiresAt: null,
        },
      }
    );

    // Tính toán lại chênh lệch giá vé
    const newSeatDocs = await ShowtimeSeat.find({ showtimeId: targetShowtime._id, seatNumber: { $in: normalizedNewSeats } });
    const newSeatTotal = newSeatDocs.reduce((acc, s) => acc + (s.price || targetShowtime.price || 150000), 0);
    const priceDiff = newSeatTotal - booking.totalAmount;

    // Cập nhật booking, sinh mã QR token mới (vô hiệu hóa mã QR cũ)
    const newQrToken = `DAV-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    booking.exchangeHistory.push({
      fromShowtimeId: booking.showtimeId._id,
      fromShowtimeDate: booking.showtimeId.startTime,
      fromRoomName: booking.showtimeId.roomName,
      oldSeats: booking.seats,
      exchangedAt: new Date(),
    });

    booking.showtimeId = targetShowtime._id;
    booking.seats = normalizedNewSeats.join(', ');
    booking.totalAmount = newSeatTotal;
    booking.qrToken = newQrToken;
    await booking.save();

    return res.json({
      success: true,
      message: 'Đổi vé thành công! Mã QR mới đã được phát hành.',
      booking: {
        ...booking.toObject(),
        id: booking._id.toString(),
        qrToken: newQrToken,
        showtime: targetShowtime,
      },
      priceDiff,
    });
  } catch (error) {
    console.error('Lỗi đổi vé:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xử lý đổi vé: ' + error.message });
  }
};

/**
 * Quét QR Check-in vé điện tử tại rạp (Phần 13)
 */
export const checkInBooking = async (req, res) => {
  try {
    const { qrToken, bookingCode } = req.body;

    if (!qrToken && !bookingCode) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã QR token hoặc mã vé điện tử.' });
    }

    const query = qrToken ? { qrToken } : { bookingCode };
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

    if (booking.status !== 'PAID') {
      return res.status(400).json({ success: false, message: 'Vé chưa được thanh toán thành công.' });
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
    booking.isCheckedIn = true;
    booking.checkedInAt = new Date();
    await booking.save();

    return res.json({
      success: true,
      message: 'Check-in vé thành công! Chúc quý khách xem phim vui vẻ tại D\'AVENOR CINEMA.',
      checkedInAt: booking.checkedInAt,
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
