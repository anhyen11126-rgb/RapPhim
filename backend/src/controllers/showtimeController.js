import prisma from '../prisma.js';

// Lấy thông tin 1 suất chiếu
export const getShowtimeById = async (req, res) => {
  try {
    const { id } = req.params;
    const showtimeId = parseInt(id, 10);

    const showtime = await prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: {
        movie: true,
      },
    });

    if (!showtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }

    res.json(showtime);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin suất chiếu', error: error.message });
  }
};

// Lấy sơ đồ ghế và trạng thái thực tế của suất chiếu
export const getShowtimeSeats = async (req, res) => {
  try {
    const { id } = req.params;
    const showtimeId = parseInt(id, 10);

    // Tự động giải phóng các ghế giữ tạm thời (HOLDING) đã hết hạn
    const now = new Date();
    await prisma.showtimeSeat.updateMany({
      where: {
        showtimeId,
        status: 'HOLDING',
        holdExpiresAt: { lt: now },
      },
      data: {
        status: 'AVAILABLE',
        holdExpiresAt: null,
      },
    });

    // Truy vấn danh sách ghế
    const seats = await prisma.showtimeSeat.findMany({
      where: { showtimeId },
      orderBy: [{ row: 'asc' }, { col: 'asc' }],
    });

    const showtime = await prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: { movie: true },
    });

    res.json({
      showtime,
      seats,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy sơ đồ ghế', error: error.message });
  }
};

