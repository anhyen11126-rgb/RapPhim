import mongoose from 'mongoose';
import Room from '../models/Room.js';
import Cinema from '../models/Cinema.js';
import Showtime from '../models/Showtime.js';
import {
  ensurePricingConfig,
  formatRoomPriceRangeFromConfig,
} from '../services/pricingConfigService.js';

// Danh sách 8 phòng chuẩn ban đầu của cụm rạp D'AVENOR Thanh Khê Plaza (88 ghế/phòng = 704 ghế)
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
    name: 'Rạp 02 (Tầng 2 - 2D Tiêu chuẩn)',
    shortName: 'Phòng 2 (2D)',
    roomType: '2D Tiêu chuẩn',
    formatFeature: '2D Digital Phụ đề • Màn chiếu phẳng 4K sắc nét',
    defaultSlots: '10:00 • 13:00 • 15:45 • 18:30 • 21:15',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 3,
    name: 'Rạp 03 (Tầng 2 - 2D Dolby Atmos)',
    shortName: 'Phòng 3 (Dolby Atmos)',
    roomType: 'Dolby Atmos',
    formatFeature: '2D Dolby Atmos 64 kênh • Âm thanh vòm đa chiều 360°',
    defaultSlots: '11:15 • 14:30 • 17:45 • 20:30 • 23:00',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 4,
    name: 'Rạp 04 (Tầng 3 - 4DX Sound)',
    shortName: 'Phòng 4 (4DX Sound)',
    roomType: '4DX Sound',
    formatFeature: '4DX Dynamic Motion • Hiệu ứng âm thanh và rung chuyển ghế',
    defaultSlots: '10:30 • 13:30 • 16:30 • 19:30 • 22:15',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 5,
    name: 'Rạp 05 (Tầng 3 - RealD 3D)',
    shortName: 'Phòng 5 (RealD 3D)',
    roomType: 'RealD 3D',
    formatFeature: '3D Phụ Đề • RealD 3D High Frame Rate • Kính 3D siêu nhẹ',
    defaultSlots: '12:00 • 15:00 • 18:00 • 21:00',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 6,
    name: 'Phòng VIP Recliner 06 (Tầng 3)',
    shortName: 'Phòng 6 (VIP Recliner)',
    roomType: '2D Tiêu chuẩn',
    formatFeature: 'Ghế bọc da chỉnh điện ngả 180° • Phục vụ bắp nước tận nơi',
    defaultSlots: '11:00 • 14:00 • 17:00 • 20:00 • 22:45',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 7,
    name: 'Rạp 07 (Tầng 4 - Studio 2D)',
    shortName: 'Phòng 7 (Studio 2D)',
    roomType: '2D Tiêu chuẩn',
    formatFeature: 'Màn chiếu cong điện ảnh • Máy chiếu Laser 4K Christie',
    defaultSlots: '09:45 • 12:45 • 15:45 • 18:45 • 21:45',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 8,
    name: 'Phòng Grand Luxe 08 (Tầng 4)',
    shortName: 'Phòng 8 (Grand Luxe)',
    roomType: 'Dolby Atmos',
    formatFeature: 'Phòng chiếu sang trọng bậc nhất • Âm thanh Dolby Atmos siêu thực',
    defaultSlots: '10:15 • 13:15 • 16:15 • 19:15 • 22:15',
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
    if (cinemaId && cinemaId !== 'ALL' && mongoose.Types.ObjectId.isValid(cinemaId)) {
      filter.cinemaId = new mongoose.Types.ObjectId(cinemaId);
      cinema = await Cinema.findById(cinemaId).lean();
    } else {
      // Mặc định tìm cụm rạp D'AVENOR Thanh Khê Plaza nếu cần seed
      cinema = await Cinema.findOne({ city: 'Đà Nẵng' }).lean() || await Cinema.findOne().lean();
      // Không gán filter.cinemaId để hiển thị đầy đủ tất cả phòng trong Database
    }

    let rooms = await Room.find(filter).sort({ roomNumber: 1, createdAt: 1 }).lean();

    // Tự động khởi tạo 8 phòng chuẩn nếu DB chưa có
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

