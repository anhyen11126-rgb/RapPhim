import mongoose from 'mongoose';
import Room from '../models/Room.js';
import Cinema from '../models/Cinema.js';
import Showtime from '../models/Showtime.js';
import {
  ensurePricingConfig,
  formatRoomPriceRangeFromConfig,
} from '../services/pricingConfigService.js';

export const getRooms = async (req, res) => {
  try {
    const { cinemaId } = req.query;
    if (cinemaId && cinemaId !== 'ALL' && !mongoose.isObjectIdOrHexString(cinemaId)) return res.sendStatus(400);
    const filter = cinemaId && cinemaId !== 'ALL' ? { cinemaId } : {};
    const rooms = await Room.find(filter).sort({ roomNumber: 1, createdAt: 1 }).lean();
    return res.json(rooms.map(room => ({ ...room, id: String(room._id) })));
  } catch (error) {
    console.error('Rooms query failed:', error.name);
    return res.status(500).json({ message: 'Không thể tải danh sách phòng.' });
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
    if (!mongoose.isObjectIdOrHexString(id)) return res.sendStatus(400);
    const allowed = ['name', 'shortName', 'roomType', 'formatFeature', 'priceRange', 'defaultSlots', 'totalSeats', 'status'];
    const updateData = Object.fromEntries(allowed.filter(field => Object.hasOwn(req.body, field)).map(field => [field, req.body[field]]));
    if (!Object.keys(updateData).length) return res.sendStatus(400);

    const room = await Room.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after', runValidators: true }).lean();
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
      $or: [{ roomId: room._id }, { cinemaId: room.cinemaId, roomName: room.name }],
    });

    if (hasShowtimes) {
      return res.status(400).json({
        message: 'Không thể xóa phòng chiếu đã có lịch chiếu. Hãy chuyển sang trạng thái Bảo trì!',
      });
    }

    await Room.findByIdAndDelete(id);
    res.json({ message: 'Đã xóa phòng chiếu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa phòng chiếu', error: error.message });
  }
};

