import mongoose from 'mongoose';
import Room from '../models/Room.js';
import Cinema from '../models/Cinema.js';
import Showtime from '../models/Showtime.js';
import {
  ensurePricingConfig,
  formatRoomPriceRangeFromConfig,
} from '../services/pricingConfigService.js';

// Danh sách phòng chuẩn ban đầu của cụm rạp D'AVENOR Thanh Khê Plaza (khoảng giá tự động tính theo TicketPricingConfig)
const DEFAULT_ROOMS = [
  {
    roomNumber: 1,
    name: 'Phòng IMAX 01 (Grand Hall)',
    shortName: 'Phòng 1 (IMAX)',
    roomType: 'IMAX Laser',
    formatFeature: 'IMAX Laser 2D • Âm thanh 12 kênh độc quyền',
    defaultSlots: '17:30 • 19:15 • 20:45 • 22:30',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 2,
    name: 'Rạp 03 (Tầng 2 - 2D Dolby)',
    shortName: 'Phòng 2 (Dolby)',
    roomType: 'Dolby Atmos',
    formatFeature: '2D Phụ Đề • Chuẩn Dolby 7.1 • Màn chiếu 4K sắc nét',
    defaultSlots: '18:00 • 19:45 • 21:15 • 23:00',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 3,
    name: 'Rạp 05 (Tầng 3 - RealD 3D)',
    shortName: 'Phòng 3 (RealD 3D)',
    roomType: 'RealD 3D',
    formatFeature: '3D Phụ Đề • RealD 3D High Frame Rate • Kính 3D siêu nhẹ',
    defaultSlots: '18:30 • 20:00 • 21:15 • 22:15',
    totalSeats: 88,
    status: 'ACTIVE',
  },
];

// Lấy danh sách tất cả các phòng chiếu
export const getRooms = async (req, res) => {
  try {
    const { cinemaId } = req.query;
    const filter = {};
    const pricingConfig = await ensurePricingConfig();

    let cinema = null;
    if (cinemaId && mongoose.Types.ObjectId.isValid(cinemaId)) {
      filter.cinemaId = cinemaId;
      cinema = await Cinema.findById(cinemaId).lean();
    } else {
      // Mặc định lấy cụm rạp D'AVENOR Thanh Khê Plaza
      cinema = await Cinema.findOne({ city: 'Đà Nẵng' }).lean();
      if (cinema) {
        filter.cinemaId = cinema._id;
      }
    }

    let rooms = await Room.find(filter).sort({ roomNumber: 1, createdAt: 1 }).lean();

    // Tự động khởi tạo 3 phòng chuẩn nếu DB chưa có
    if (rooms.length === 0 && cinema) {
      const toInsert = DEFAULT_ROOMS.map((r) => ({
        ...r,
        priceRange: formatRoomPriceRangeFromConfig(r.roomType || r.name, pricingConfig),
        cinemaId: cinema._id,
      }));
      await Room.insertMany(toInsert);
      rooms = await Room.find(filter).sort({ roomNumber: 1, createdAt: 1 }).lean();
    } else {
      // Đồng bộ khung giờ & khoảng giá vé động từ TicketPricingConfig
      for (const r of rooms) {
        const def = DEFAULT_ROOMS.find((d) => d.roomNumber === r.roomNumber || d.roomType === r.roomType);
        const computedRange = formatRoomPriceRangeFromConfig(r.roomType || r.name, pricingConfig);
        const nextSlots = !r.defaultSlots && def ? def.defaultSlots : r.defaultSlots;
        if (r.priceRange !== computedRange || nextSlots !== r.defaultSlots) {
          await Room.findByIdAndUpdate(r._id, {
            priceRange: computedRange,
            defaultSlots: nextSlots,
          });
          r.priceRange = computedRange;
          r.defaultSlots = nextSlots;
        }
      }
    }

    res.json(rooms.map((r) => ({ ...r, id: r._id.toString() })));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách phòng chiếu', error: error.message });
  }
};

// Tạo phòng chiếu mới
export const createRoom = async (req, res) => {
  try {
    const { name, shortName, roomType, formatFeature, priceRange, totalSeats, status, cinemaId } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Tên phòng chiếu là bắt buộc' });
    }

    let targetCinemaId = cinemaId;
    if (!targetCinemaId || !mongoose.Types.ObjectId.isValid(targetCinemaId)) {
      const cinema = await Cinema.findOne({ city: 'Đà Nẵng' });
      targetCinemaId = cinema ? cinema._id : null;
    }

    if (!targetCinemaId) {
      return res.status(400).json({ message: 'Không tìm thấy cụm rạp để liên kết phòng' });
    }

    const pricingConfig = await ensurePricingConfig();
    const resolvedType = roomType || '2D Tiêu chuẩn';
    const computedRange = formatRoomPriceRangeFromConfig(resolvedType, pricingConfig);

    const count = await Room.countDocuments({ cinemaId: targetCinemaId });
    const newRoom = await Room.create({
      cinemaId: targetCinemaId,
      roomNumber: count + 1,
      name,
      shortName: shortName || `Phòng ${count + 1}`,
      roomType: resolvedType,
      formatFeature: formatFeature || 'Màn chiếu tiêu chuẩn • Âm thanh vòm',
      priceRange: priceRange || computedRange,
      totalSeats: totalSeats || 88,
      status: status || 'ACTIVE',
    });

    res.status(201).json({ ...newRoom.toObject(), id: newRoom._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo phòng chiếu mới', error: error.message });
  }
};

// Cập nhật thông tin phòng chiếu
export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const room = await Room.findByIdAndUpdate(id, updateData, { new: true }).lean();
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng chiếu yêu cầu' });
    }

    res.json({ ...room, id: room._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật phòng chiếu', error: error.message });
  }
};

// Xóa phòng chiếu
export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng chiếu' });
    }

    // Kiểm tra xem phòng có suất chiếu trong tương lai không
    const hasShowtimes = await Showtime.exists({
      roomName: room.name,
      startTime: { $gte: new Date() },
    });

    if (hasShowtimes) {
      return res.status(400).json({
        message: 'Không thể xóa phòng chiếu đang có lịch chiếu trong tương lai. Hãy chuyển sang trạng thái Bảo trì!',
      });
    }

    await Room.findByIdAndDelete(id);
    res.json({ message: 'Đã xóa phòng chiếu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa phòng chiếu', error: error.message });
  }
};

