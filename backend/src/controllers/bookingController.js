import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Booking from '../models/Booking.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Showtime from '../models/Showtime.js';
import Movie from '../models/Movie.js';

const JWT_SECRET = process.env.JWT_SECRET || 'movietix_jwt_secret_key_2026_cdio';

// Khóa ghế tạm thời trong 5 phút khi khách chuyển sang màn hình thanh toán
export const holdSeats = async (req, res) => {
  try {
    const { showtimeId, seatNumbers } = req.body;

    if (!showtimeId || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      return res.status(400).json({ message: 'Dữ liệu chọn ghế không hợp lệ' });
    }

    if (!mongoose.Types.ObjectId.isValid(showtimeId)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }

    const stId = new mongoose.Types.ObjectId(showtimeId);
    const now = new Date();

    const targetShowtime = await Showtime.findById(stId);
    if (!targetShowtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }
    if (targetShowtime.isLocked) {
      return res.status(403).json({
        message: 'Suất chiếu này hiện đang tạm khóa hoặc điều chỉnh lịch chiếu bởi ban quản trị. Vui lòng chọn suất chiếu khác.',
      });
    }

    // Tìm các ghế yêu cầu
    const requestedSeats = await ShowtimeSeat.find({
      showtimeId: stId,
      seatNumber: { $in: seatNumbers },
    });

    // Kiểm tra xem có ghế nào đã bị đặt (BOOKED) hoặc đang được người khác giữ (HOLDING hợp lệ) không
    const unavailableSeats = requestedSeats.filter((seat) => {
      if (seat.status === 'BOOKED') return true;
      if (seat.status === 'HOLDING' && seat.holdExpiresAt && seat.holdExpiresAt > now) {
        return true;
      }
      return false;
    });

    if (unavailableSeats.length > 0) {
      const seatNames = unavailableSeats.map((s) => s.seatNumber).join(', ');
      return res.status(409).json({
        message: `Rất tiếc! Ghế (${seatNames}) vừa có khách khác giữ hoặc đã được thanh toán. Vui lòng chọn ghế khác.`,
      });
    }

    // Khóa giữ ghế 5 phút
    const holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await ShowtimeSeat.updateMany(
      {
        showtimeId: stId,
        seatNumber: { $in: seatNumbers },
      },
      {
        $set: {
          status: 'HOLDING',
          holdExpiresAt,
        },
      }
    );

    res.json({
      success: true,
      message: 'Đã giữ ghế thành công trong 5 phút',
      holdExpiresAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi giữ ghế', error: error.message });
  }
};

// Xác nhận thanh toán & Tạo mã vé điện tử
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

    if (!showtimeId || !seatNumbers || seatNumbers.length === 0 || !customerName || !customerPhone) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin đặt vé' });
    }

    if (!mongoose.Types.ObjectId.isValid(showtimeId)) {
      return res.status(400).json({ message: 'ID suất chiếu không hợp lệ' });
    }

    const stId = new mongoose.Types.ObjectId(showtimeId);

    const targetShowtime = await Showtime.findById(stId);
    if (!targetShowtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }
    if (targetShowtime.isLocked) {
      return res.status(403).json({
        message: 'Suất chiếu này hiện đang tạm khóa hoặc điều chỉnh lịch chiếu bởi ban quản trị. Không thể thanh toán.',
      });
    }

    // Kiểm tra xem có ghế nào đã BOOKED chưa
    const alreadyBooked = await ShowtimeSeat.find({
      showtimeId: stId,
      seatNumber: { $in: seatNumbers },
      status: 'BOOKED',
    });

    if (alreadyBooked.length > 0) {
      return res.status(409).json({
        message: 'Một số ghế bạn chọn đã được thanh toán bởi khách khác.',
      });
    }

    // Sinh mã vé duy nhất: #MTX + 6 chữ số ngẫu nhiên
    const bookingCode = `MTX${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Tạo bản ghi Booking
    const newBooking = await Booking.create({
      bookingCode,
      showtimeId: stId,
      customerName,
      customerPhone,
      customerEmail: customerEmail || '',
      seats: seatNumbers.join(', '),
      concessions: concessions || '',
      totalAmount: parseFloat(totalAmount),
      status: 'PAID',
      paymentMethod,
    });

    // 2. Chuyển trạng thái các ghế sang BOOKED
    await ShowtimeSeat.updateMany(
      {
        showtimeId: stId,
        seatNumber: { $in: seatNumbers },
      },
      {
        $set: {
          status: 'BOOKED',
          holdExpiresAt: null,
          bookingId: newBooking._id,
        },
      }
    );

    // Truy vấn đầy đủ thông tin vé kèm phim và suất chiếu để trả về
    const showtime = await Showtime.findById(stId).populate('movieId').lean();
    const formattedBooking = {
      ...newBooking.toObject(),
      id: newBooking._id.toString(),
      showtime: showtime
        ? {
            ...showtime,
            id: showtime._id.toString(),
            movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
          }
        : null,
    };

    res.status(201).json({
      success: true,
      message: 'Đặt vé thành công!',
      booking: formattedBooking,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thanh toán đặt vé', error: error.message });
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
      populate: { path: 'movieId' },
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
          }
        : null,
    };

    res.json(formattedBooking);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tra cứu mã vé', error: error.message });
  }
};
