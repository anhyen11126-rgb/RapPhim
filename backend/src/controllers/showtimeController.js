import { opensMoreThanSevenDaysAhead } from '../services/bookingPolicy.js';
import mongoose from 'mongoose';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';

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

export const getStoredShowtimeSeats = showtimeId =>
  ShowtimeSeat.find({ showtimeId }).sort({ row: 1, col: 1 }).lean();

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
    if (!mongoose.isObjectIdOrHexString(id)) return res.sendStatus(400);
    const targetShowtime = await Showtime.findById(id).populate('movieId cinemaId roomId');

    if (!targetShowtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu yêu cầu' });
    }

    const showtimeId = targetShowtime._id;

    const rawSeats = await getStoredShowtimeSeats(showtimeId);

    // Tính toán số liệu thống kê thời gian thực từ dữ liệu thực tế
    const totalSeats = rawSeats.length;
    const bookedSeats = rawSeats.filter((s) => s.status === 'BOOKED');
    const bookedSeatsCount = bookedSeats.length;
    const availableSeatsCount = rawSeats.filter(seat => seat.status === 'AVAILABLE').length;
    const occupancyRate = ((totalSeats ? bookedSeatsCount / totalSeats : 0) * 100).toFixed(1) + '%';

    // Xác định trạng thái mở bán (Quy tắc 7 ngày & giờ chiếu)
    const now = new Date();
    const stStart = new Date(targetShowtime.startTime);
    const diffMs = stStart.getTime() - now.getTime();

    let saleStatus = 'OPEN_FOR_SALE';
    let saleMessage = 'Đang mở bán';

    if (diffMs <= 0) {
      saleStatus = 'STARTED';
      saleMessage = 'Suất chiếu đã bắt đầu hoặc đã kết thúc';
    } else if (opensMoreThanSevenDaysAhead(stStart, now)) {
      saleStatus = 'COMING_SOON';
      saleMessage = 'Chưa mở bán. Hệ thống chỉ mở bán vé trước tối đa 7 ngày.';
    } else if (targetShowtime.isLocked || targetShowtime.roomId?.status === 'MAINTENANCE' || !rawSeats.length) {
      saleStatus = 'LOCKED';
      saleMessage = 'Suất chiếu chưa khả dụng để đặt vé.';
    }

    const seats = rawSeats.map((s) => ({
      id: s._id.toString(),
      seatNumber: normalizeSeatCode(s.seatNumber),
      row: s.row,
      col: s.col,
      type: s.type,
      status: s.status,
      price: s.price,
    }));

    const showtimeData = targetShowtime.toObject();

    res.json({
      success: true,
      roomId: targetShowtime.roomId?._id ?? rawSeats.find((seat) => seat.roomId)?.roomId,
      totalSeats,
      bookedSeatsCount,
      availableSeatsCount,
      occupancyRate,
      saleStatus,
      saleMessage,
      showtime: {
        ...showtimeData,
        id: showtimeData._id.toString(),
        movie: showtimeData.movieId
          ? { ...showtimeData.movieId, id: showtimeData.movieId._id.toString() }
          : null,
        cinema: showtimeData.cinemaId
          ? { ...showtimeData.cinemaId, id: showtimeData.cinemaId._id.toString() }
          : null,
        room: showtimeData.roomId
          ? { ...showtimeData.roomId, id: showtimeData.roomId._id.toString() }
          : null,
      },
      seats,
    });
  } catch (error) {
    console.error('Lỗi khi lấy sơ đồ ghế:', error);
    res.status(500).json({ message: 'Lỗi khi lấy sơ đồ ghế', error: error.message });
  }
};

/**
 * Thuật toán Gợi ý ghế thông minh (Smart Seat Recommender)
 * - Tự động tìm cụm 1-4 ghế liền kề nhau trên cùng một hàng.
 * - Tuyệt đối KHÔNG cắt ngang lối đi (Dãy Trái: 1-6, Dãy Phải: 7-12; Hàng H: 1-2 & 3-4).
 * - Phân tích điểm ngọt (Sweet Spot) tối ưu góc nhìn và khoảng cách tới màn hình.
 * - Ưu tiên theo sở thích: "CENTER", "VIP", "NEAR_SCREEN", "FAR_SCREEN".
 */
export const recommendSeats = async (req, res) => {
  try {
    const { id } = req.params;
    const count = Math.min(4, Math.max(1, parseInt(req.query.count, 10) || 2));
    const preference = (req.query.preference || 'CENTER').toUpperCase(); // 'CENTER' | 'VIP' | 'NEAR_SCREEN' | 'FAR_SCREEN'

    if (!mongoose.isObjectIdOrHexString(id)) return res.sendStatus(400);
    const targetShowtime = await Showtime.findById(id);

    if (!targetShowtime) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu' });
    }

    const rawSeats = await getStoredShowtimeSeats(targetShowtime._id);
    const availableSeatSet = new Set(
      rawSeats.filter((s) => s.status === 'AVAILABLE').map((s) => normalizeSeatCode(s.seatNumber))
    );

    // Xây dựng các cụm ghế khả thi trên từng hàng
    // Hàng A-G: Block trái cols [1..6], Block phải cols [7..12]
    // Hàng H: Block trái cols [1..2], Block phải cols [3..4]
    const candidates = [];

    const rowsConfig = [
      { row: 'A', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'STANDARD', baseRowScore: 35 },
      { row: 'B', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'STANDARD', baseRowScore: 60 },
      { row: 'C', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'STANDARD', baseRowScore: 80 },
      { row: 'D', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'STANDARD', baseRowScore: 92 },
      { row: 'E', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'VIP', baseRowScore: 100 },
      { row: 'F', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'VIP', baseRowScore: 95 },
      { row: 'G', left: [1, 2, 3, 4, 5, 6], right: [7, 8, 9, 10, 11, 12], type: 'VIP', baseRowScore: 85 },
      { row: 'H', left: [1, 2], right: [3, 4], type: 'SWEETBOX', baseRowScore: 75 },
    ];

    rowsConfig.forEach((cfg) => {
      [cfg.left, cfg.right].forEach((blockCols, blockIdx) => {
        const sideName = blockIdx === 0 ? 'Dãy trái' : 'Dãy phải';
        if (blockCols.length < count) return;

        for (let i = 0; i <= blockCols.length - count; i++) {
          const sliceCols = blockCols.slice(i, i + count);
          const seatCodes = sliceCols.map((c) => `${cfg.row}${c}`);

          // Kiểm tra toàn bộ ghế trong cụm có khả dụng không
          const allAvailable = seatCodes.every((code) => availableSeatSet.has(code));
          if (!allAvailable) continue;

          // Tính điểm số sweet-spot
          let score = cfg.baseRowScore;

          // Tính khoảng cách tâm cột tới trục giữa (trục giữa rạp là 6.5)
          const avgCol = sliceCols.reduce((sum, c) => sum + c, 0) / count;
          const distFromCenterAisle = Math.abs(avgCol - 6.5);
          score += Math.max(0, 30 - distFromCenterAisle * 6);

          // Điều chỉnh theo sở thích khách hàng
          if (preference === 'CENTER') {
            // Điểm ngọt hoàn hảo: Hàng D, E, F và gần trục giữa
            if (['D', 'E', 'F'].includes(cfg.row)) score += 35;
            if (cfg.row === 'E') score += 15;
            if (avgCol >= 3.5 && avgCol <= 9.5) score += 20;
          } else if (preference === 'VIP') {
            // Ưu tiên hàng VIP E, F, G hoặc H
            if (cfg.type === 'VIP') score += 40;
            if (cfg.type === 'SWEETBOX') score += 35;
          } else if (preference === 'NEAR_SCREEN') {
            // Ưu tiên hàng B, C, D (gần vừa phải, trừ hàng A vì quá sát)
            if (['B', 'C', 'D'].includes(cfg.row)) score += 45;
            if (cfg.row === 'A') score -= 15;
          } else if (preference === 'FAR_SCREEN') {
            // Ưu tiên hàng F, G, H
            if (['F', 'G', 'H'].includes(cfg.row)) score += 45;
          }

          let label = `${count} ghế liền kề hàng ${cfg.row} (${sideName})`;
          if (['E', 'F'].includes(cfg.row) && avgCol >= 4 && avgCol <= 9) {
            label = `Điểm ngọt vàng hàng ${cfg.row} - Góc nhìn chuẩn điện ảnh`;
          } else if (cfg.type === 'VIP') {
            label = `Khu vực VIP hàng ${cfg.row} cao cấp`;
          }

          candidates.push({
            row: cfg.row,
            cols: sliceCols,
            seatCodes,
            type: cfg.type,
            side: sideName,
            score: Math.round(score),
            label,
          });
        }
      });
    });

    // Sắp xếp các cụm ghế khả dụng theo điểm số giảm dần
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return res.json({
        success: false,
        message: `Rất tiếc, không còn cụm ${count} ghế liền kề phù hợp trong suất chiếu này.`,
        bestRecommendation: null,
        alternatives: [],
      });
    }

    const bestRecommendation = candidates[0];
    // Lấy tối đa 3 lựa chọn thay thế (ở các hàng khác nhau nếu có)
    const alternatives = [];
    const usedRows = new Set([bestRecommendation.row]);

    for (let i = 1; i < candidates.length && alternatives.length < 3; i++) {
      const cand = candidates[i];
      if (!usedRows.has(cand.row) || alternatives.length >= 2) {
        alternatives.push(cand);
        usedRows.add(cand.row);
      }
    }

    res.json({
      success: true,
      count,
      preference,
      bestRecommendation,
      alternatives,
    });
  } catch (error) {
    console.error('Lỗi gợi ý ghế:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gợi ý ghế: ' + error.message });
  }
};
