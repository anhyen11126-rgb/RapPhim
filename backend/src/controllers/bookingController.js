import prisma from '../prisma.js';

// Khóa ghế tạm thời trong 5 phút khi khách chuyển sang màn hình thanh toán
export const holdSeats = async (req, res) => {
  try {
    const { showtimeId, seatNumbers } = req.body;

    if (!showtimeId || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      return res.status(400).json({ message: 'Dữ liệu chọn ghế không hợp lệ' });
    }

    const stId = parseInt(showtimeId, 10);
    const now = new Date();

    // Tìm các ghế yêu cầu
    const requestedSeats = await prisma.showtimeSeat.findMany({
      where: {
        showtimeId: stId,
        seatNumber: { in: seatNumbers },
      },
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
    await prisma.showtimeSeat.updateMany({
      where: {
        showtimeId: stId,
        seatNumber: { in: seatNumbers },
      },
      data: {
        status: 'HOLDING',
        holdExpiresAt,
      },
    });

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

    const stId = parseInt(showtimeId, 10);

    // Kiểm tra xem có ghế nào đã BOOKED chưa
    const alreadyBooked = await prisma.showtimeSeat.findMany({
      where: {
        showtimeId: stId,
        seatNumber: { in: seatNumbers },
        status: 'BOOKED',
      },
    });

    if (alreadyBooked.length > 0) {
      return res.status(409).json({
        message: 'Một số ghế bạn chọn đã được thanh toán bởi khách khác.',
      });
    }

    // Sinh mã vé duy nhất: #MTX + 6 chữ số ngẫu nhiên
    const bookingCode = `MTX${Math.floor(100000 + Math.random() * 900000)}`;

    // Dùng Transaction để đảm bảo tính toàn vẹn (ACID)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Tạo bản ghi Booking
      const newBooking = await tx.booking.create({
        data: {
          bookingCode,
          showtimeId: stId,
          customerName,
          customerPhone,
          customerEmail: customerEmail || null,
          seats: seatNumbers.join(', '),
          concessions: concessions || '',
          totalAmount: parseFloat(totalAmount),
          status: 'PAID',
          paymentMethod,
        },
      });

      // 2. Chuyển trạng thái các ghế sang BOOKED
      await tx.showtimeSeat.updateMany({
        where: {
          showtimeId: stId,
          seatNumber: { in: seatNumbers },
        },
        data: {
          status: 'BOOKED',
          holdExpiresAt: null,
          bookingId: newBooking.id,
        },
      });

      return newBooking;
    });

    // Truy vấn đầy đủ thông tin vé kèm phim và suất chiếu để trả về
    const fullBooking = await prisma.booking.findUnique({
      where: { id: result.id },
      include: {
        showtime: {
          include: {
            movie: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Đặt vé thành công!',
      booking: fullBooking,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thanh toán đặt vé', error: error.message });
  }
};

// Tra cứu vé theo mã vé (dành cho xuất vé QR code hoặc tìm kiếm)
export const getBookingByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { bookingCode: code },
      include: {
        showtime: {
          include: {
            movie: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy vé với mã này' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tra cứu mã vé', error: error.message });
  }
};

