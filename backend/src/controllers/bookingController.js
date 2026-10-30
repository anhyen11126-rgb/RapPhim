import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Showtime from '../models/Showtime.js';
import Movie from '../models/Movie.js';

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
