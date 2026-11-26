import { opensMoreThanSevenDaysAhead } from '../services/bookingPolicy.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import {
  SEAT_GRID_CONFIG,
  resolveCanonicalRoomType,
  resolveRowAisleSplitCol,
} from '../utils/roomLayoutConfig.js';
import {
  ensurePricingConfig,
  calculatePricesFromConfig,
} from '../services/pricingConfigService.js';

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
  ShowtimeSeat.find({ showtimeId })
    .select('_id showtimeId roomId seatNumber row col type status holdExpiresAt holdOwnerId price')
    .sort({ row: 1, col: 1 })
    .lean();

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
      .populate('roomId')
      .lean();

    if (!showtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu' });
    }

    res.json({
      ...showtime,
      id: showtime._id.toString(),
      roomType: resolveCanonicalRoomType(showtime),
      movie: showtime.movieId ? { ...showtime.movieId, id: showtime.movieId._id.toString() } : null,
      cinema: showtime.cinemaId ? { ...showtime.cinemaId, id: showtime.cinemaId._id.toString() } : null,
      room: showtime.roomId ? { ...showtime.roomId, id: showtime.roomId._id.toString() } : null,
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
    const isLite = req.query.lite === '1' || req.query.lite === 'true';

    const targetShowtime = isLite
      ? await Showtime.findById(id)
          .select('_id startTime isLocked cancelledAt roomId')
          .populate('roomId', 'status')
          .lean()
      : await Showtime.findById(id)
          .populate('movieId', 'title slug posterUrl duration genre ageRating rating releaseDate status')
          .populate('cinemaId', 'name address city')
          .populate('roomId', 'name shortName roomType formatFeature totalSeats status')
          .lean();

    if (!targetShowtime) {
      return res.status(404).json({ message: 'Không tìm thấy suất chiếu yêu cầu' });
    }

    const showtimeId = targetShowtime._id;

    const rawSeats = isLite
      ? await ShowtimeSeat.find({ showtimeId })
          .select('seatNumber status holdExpiresAt holdOwnerId')
          .lean()
      : await getStoredShowtimeSeats(showtimeId);
    const now = new Date();

    const isActiveHold = (seat) =>
      seat.status === 'HOLDING' && seat.holdExpiresAt && new Date(seat.holdExpiresAt).getTime() > now.getTime();

    const effectiveStatus = (seat) => {
      if (seat.status === 'BOOKED') return 'BOOKED';
      if (isActiveHold(seat)) return 'HOLDING';
      return 'AVAILABLE';
    };

    // Tính toán số liệu thống kê thời gian thực (phân biệt rõ Trống, Đang giữ, Đã đặt)
    const totalSeats = rawSeats.length;
    let bookedSeatsCount = 0;
    let holdingSeatsCount = 0;
    let availableSeatsCount = 0;
    for (const s of rawSeats) {
      const st = effectiveStatus(s);
      if (st === 'BOOKED') bookedSeatsCount += 1;
      else if (st === 'HOLDING') holdingSeatsCount += 1;
      else availableSeatsCount += 1;
    }
    const occupancyRate = ((totalSeats ? bookedSeatsCount / totalSeats : 0) * 100).toFixed(1) + '%';

    // Xác định trạng thái mở bán (Quy tắc 7 ngày & giờ chiếu)
    const stStart = new Date(targetShowtime.startTime);
    const diffMs = stStart.getTime() - now.getTime();

    let saleStatus = 'OPEN_FOR_SALE';
    let saleMessage = 'Đang mở bán';

    if (targetShowtime.cancelledAt) {
      saleStatus = 'CANCELLED';
      saleMessage = 'Suất chiếu đã bị hủy.';
    } else if (diffMs <= 0) {
      saleStatus = 'STARTED';
      saleMessage = 'Suất chiếu đã bắt đầu hoặc đã kết thúc';
    } else if (opensMoreThanSevenDaysAhead(stStart, now)) {
      saleStatus = 'COMING_SOON';
      saleMessage = 'Chưa mở bán. Hệ thống chỉ mở bán vé trước tối đa 7 ngày.';
    } else if (targetShowtime.isLocked || targetShowtime.roomId?.status === 'MAINTENANCE' || !rawSeats.length) {
      saleStatus = 'LOCKED';
      saleMessage = 'Suất chiếu chưa khả dụng để đặt vé.';
    }

    // Xác định user hiện tại nếu có gửi Bearer token (không bắt buộc đăng nhập để xem sơ đồ ghế)
    let currentUserId = null;
    const authHeader = req.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ') && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET);
        if (decoded?.id) currentUserId = String(decoded.id);
      } catch {
        currentUserId = null;
      }
    }

    if (isLite) {
      const liteSeats = rawSeats.map((s) => {
        const status = effectiveStatus(s);
        const isHeldByMe = Boolean(
          status === 'HOLDING' && currentUserId && s.holdOwnerId && String(s.holdOwnerId) === currentUserId
        );
        return {
          seatNumber: normalizeSeatCode(s.seatNumber),
          status,
          ...(isHeldByMe ? { isHeldByMe: true } : {}),
        };
      });

      res.set('Cache-Control', 'no-store');
      return res.json({
        success: true,
        lite: true,
        serverTime: now.toISOString(),
        totalSeats,
        bookedSeatsCount,
        holdingSeatsCount,
        availableSeatsCount,
        occupancyRate,
        saleStatus,
        saleMessage,
        seats: liteSeats,
      });
    }

    const canonicalRoomType = resolveCanonicalRoomType(targetShowtime);
    const pricingConfig = await ensurePricingConfig();
    const calculatedPrices = calculatePricesFromConfig(
      {
        ...targetShowtime,
        room: targetShowtime.roomId,
        roomId: targetShowtime.roomId,
        roomType: canonicalRoomType,
        roomName: targetShowtime.roomId?.name || targetShowtime.roomName,
      },
      pricingConfig
    );
    const priceByType = {
      STANDARD: calculatedPrices.priceStandard,
      VIP: calculatedPrices.priceVip,
      SWEETBOX: calculatedPrices.priceSweetbox,
    };

    const seats = rawSeats.map((s) => {
      const status = effectiveStatus(s);
      const isHeldByMe = Boolean(
        status === 'HOLDING' && currentUserId && s.holdOwnerId && String(s.holdOwnerId) === currentUserId
      );
      const seatType = String(s.type || 'STANDARD').toUpperCase();
      return {
        id: s._id.toString(),
        seatNumber: normalizeSeatCode(s.seatNumber),
        row: s.row,
        col: s.col,
        type: seatType,
        status,
        ...(isHeldByMe ? { isHeldByMe: true } : {}),
        price: priceByType[seatType] ?? calculatedPrices.priceStandard,
      };
    });

    const showtimeData = targetShowtime;
    const ticketPrices = {
      standard: calculatedPrices.priceStandard,
      vip: calculatedPrices.priceVip,
      sweetbox: calculatedPrices.priceSweetbox,
      vipSurcharge: calculatedPrices.vipSurcharge,
      sweetboxExtra: calculatedPrices.sweetboxExtra,
      formatKey: calculatedPrices.format,
      roomTypeLabel: calculatedPrices.roomTypeLabel,
    };

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      serverTime: now.toISOString(),
      roomId: targetShowtime.roomId?._id ?? rawSeats.find((seat) => seat.roomId)?.roomId,
      totalSeats,
      bookedSeatsCount,
      holdingSeatsCount,
      availableSeatsCount,
      occupancyRate,
      saleStatus,
      saleMessage,
      ticketPrices,
      showtime: {
        ...showtimeData,
        id: showtimeData._id.toString(),
        price: calculatedPrices.priceStandard,
        roomType: canonicalRoomType,
        ticketPrices,
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
 * - Đọc trực tiếp cấu hình ghế thực tế từ MongoDB (`ShowtimeSeat`), không hardcode ghế ảo.
 * - Hỗ trợ đầy đủ 8 hàng A–H × 11 cột (88 ghế) với lối đi giữa cột 6 và cột 7.
 * - Tự động tìm cụm 1–4 ghế trống liền kề trên cùng một hàng, tuyệt đối KHÔNG cắt ngang lối đi.
 * - Phân tích điểm ngọt (Sweet Spot) theo sở thích: "CENTER", "VIP", "NEAR_SCREEN", "FAR_SCREEN".
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
    if (!rawSeats.length) {
      return res.json({
        success: false,
        message: 'Suất chiếu hiện chưa có sơ đồ ghế khả dụng.',
        bestRecommendation: null,
        alternatives: [],
      });
    }

    const now = new Date();
    // Nhóm toàn bộ ghế thực tế trong MongoDB theo từng hàng A–H (chỉ coi AVAILABLE hoặc HOLDING đã hết hạn là trống)
    const seatsByRow = new Map();
    for (const seat of rawSeats) {
      const rowLabel = String(seat.row || '').trim().toUpperCase();
      const colNum = Number(seat.col);
      if (!rowLabel || !Number.isFinite(colNum)) continue;
      if (!seatsByRow.has(rowLabel)) seatsByRow.set(rowLabel, []);
      const isExpiredHold =
        seat.status === 'HOLDING' && seat.holdExpiresAt && new Date(seat.holdExpiresAt).getTime() <= now.getTime();
      seatsByRow.get(rowLabel).push({
        seatCode: normalizeSeatCode(seat.seatNumber),
        row: rowLabel,
        col: colNum,
        type: String(seat.type || 'STANDARD').toUpperCase(),
        status: seat.status === 'AVAILABLE' || isExpiredHold ? 'AVAILABLE' : String(seat.status || '').toUpperCase(),
      });
    }

    const candidates = [];

    for (const [rowLabel, rowEntries] of [...seatsByRow.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const ordered = rowEntries.slice().sort((a, b) => a.col - b.col);
      const splitCol = resolveRowAisleSplitCol(ordered);
      const aisleCenter = splitCol + 0.5;
      const baseRowScore = SEAT_GRID_CONFIG.rowBaseScores[rowLabel] ?? 70;

      const leftBlock = ordered.filter((s) => s.col <= splitCol);
      const rightBlock = ordered.filter((s) => s.col > splitCol);

      [leftBlock, rightBlock].forEach((blockSeats, blockIdx) => {
        const sideName = blockIdx === 0 ? 'Dãy trái' : 'Dãy phải';
        if (blockSeats.length < count) return;

        for (let i = 0; i <= blockSeats.length - count; i++) {
          const slice = blockSeats.slice(i, i + count);

          // 1. Đảm bảo tất cả ghế trong cụm đều đang trống (AVAILABLE) trong DB
          if (!slice.every((s) => s.status === 'AVAILABLE')) continue;

          // 2. Đảm bảo số cột thực sự liền kề nhau (col[k] === col[k-1] + 1), không nhảy cóc qua ghế thiếu
          let isStrictlyAdjacent = true;
          for (let k = 1; k < slice.length; k++) {
            if (slice[k].col !== slice[k - 1].col + 1) {
              isStrictlyAdjacent = false;
              break;
            }
          }
          if (!isStrictlyAdjacent) continue;

          const sliceCols = slice.map((s) => s.col);
          const seatCodes = slice.map((s) => s.seatCode);
          const dominantType = slice[0].type;

          // Tính điểm số sweet-spot
          let score = baseRowScore;
          const avgCol = sliceCols.reduce((sum, c) => sum + c, 0) / count;
          const distFromCenterAisle = Math.abs(avgCol - aisleCenter);
          score += Math.max(0, 30 - distFromCenterAisle * 6);

          // Điều chỉnh theo sở thích khách hàng
          if (preference === 'CENTER') {
            if (['D', 'E', 'F'].includes(rowLabel)) score += 35;
            if (rowLabel === 'E') score += 15;
            if (avgCol >= 3.5 && avgCol <= 9.5) score += 20;
          } else if (preference === 'VIP') {
            if (dominantType === 'VIP') score += 40;
            if (dominantType === 'SWEETBOX') score += 38;
          } else if (preference === 'NEAR_SCREEN') {
            if (['B', 'C', 'D'].includes(rowLabel)) score += 45;
            if (rowLabel === 'A') score -= 15;
          } else if (preference === 'FAR_SCREEN') {
            if (['F', 'G', 'H'].includes(rowLabel)) score += 45;
            if (rowLabel === 'H') score += 10;
          }

          let label = `${count} ghế liền kề hàng ${rowLabel} (${sideName})`;
          if (['E', 'F'].includes(rowLabel) && avgCol >= 4 && avgCol <= 9) {
            label = `Điểm ngọt vàng hàng ${rowLabel} - Góc nhìn chuẩn điện ảnh`;
          } else if (dominantType === 'VIP' || dominantType === 'SWEETBOX') {
            label = `Khu vực VIP hàng ${rowLabel} cao cấp`;
          }

          candidates.push({
            row: rowLabel,
            cols: sliceCols,
            seatCodes,
            type: dominantType,
            side: sideName,
            score: Math.round(score),
            label,
          });
        }
      });
    }

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
