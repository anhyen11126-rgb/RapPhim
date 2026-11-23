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

    const stId = targetShowtime._id;

    // 3. Đảm bảo 88 ghế của suất chiếu này đã tồn tại trong ShowtimeSeat
    await ensureShowtimeSeats(stId);

    // 4. BƯỚC NGUYÊN TỬ (ATOMIC CONCURRENCY CHECK):
    // Sinh ID và mã vé duy nhất cho giao dịch này
    const tempBookingId = new mongoose.Types.ObjectId();
    const bookingCode = `MTX${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

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
        showtimeId: stId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.toString().trim(),
        customerEmail: customerEmail ? customerEmail.trim().toLowerCase() : '',
        seats: normalizedSeats.join(', '),
        concessions: concessions || '',
        totalAmount: parseFloat(totalAmount),
        status: 'PAID',
        paymentMethod,
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
