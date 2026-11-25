/**
 * Cấu hình chuẩn dùng chung cho 9 phòng chiếu vật lý (thuộc 3 công nghệ phòng)
 * và sơ đồ 88 ghế (8 hàng A–H × 11 cột, lối đi giữa cột 6 và cột 7).
 */

export const ROOM_TYPES_ENUM = Object.freeze({
  IMAX_LASER: 'IMAX Laser',
  DOLBY_ATMOS: 'Dolby Atmos',
  GOLD_CLASS: 'Gold Class',
  REALD_3D: 'RealD 3D',
  STANDARD_2D: '2D Tiêu chuẩn',
  SOUND_4DX: '4DX Sound',
});

export const ACTIVE_CINEMA_ROOM_TYPES = Object.freeze([
  ROOM_TYPES_ENUM.IMAX_LASER,
  ROOM_TYPES_ENUM.DOLBY_ATMOS,
  ROOM_TYPES_ENUM.GOLD_CLASS,
]);

export const SEAT_GRID_CONFIG = Object.freeze({
  rows: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
  colsPerRow: 11,
  aisleAfterCol: 6,
  totalSeats: 88,
  tierCounts: Object.freeze({ STANDARD: 44, VIP: 33, SWEETBOX: 11 }),
  rowBaseScores: Object.freeze({
    A: 35,
    B: 60,
    C: 80,
    D: 92,
    E: 100,
    F: 95,
    G: 85,
    H: 78,
  }),
});

const ENUM_LOOKUP = new Map([
  ['imax laser', ROOM_TYPES_ENUM.IMAX_LASER],
  ['imax', ROOM_TYPES_ENUM.IMAX_LASER],
  ['dolby atmos', ROOM_TYPES_ENUM.DOLBY_ATMOS],
  ['atmos', ROOM_TYPES_ENUM.DOLBY_ATMOS],
  ['gold class', ROOM_TYPES_ENUM.GOLD_CLASS],
  ['gold_class', ROOM_TYPES_ENUM.GOLD_CLASS],
  ['gold', ROOM_TYPES_ENUM.GOLD_CLASS],
  ['reald 3d', ROOM_TYPES_ENUM.REALD_3D],
  ['3d', ROOM_TYPES_ENUM.REALD_3D],
  ['2d tiêu chuẩn', ROOM_TYPES_ENUM.STANDARD_2D],
  ['2d', ROOM_TYPES_ENUM.STANDARD_2D],
  ['4dx sound', ROOM_TYPES_ENUM.SOUND_4DX],
]);

/**
 * Nhận diện chuẩn enum công nghệ phòng chiếu (`Room.roomType`).
 * - Ưu tiên tuyệt đối trường enum `room.roomType` / `roomId.roomType` / `roomType`.
 * - Chỉ fallback sang tên phòng khi dữ liệu cũ/mock test không truyền `roomType`.
 */
export const resolveCanonicalRoomType = (input) => {
  if (!input) return '';

  const rawEnum =
    typeof input === 'string'
      ? input.trim()
      : String(
          input.room?.roomType ||
            (typeof input.roomId === 'object' ? input.roomId?.roomType : '') ||
            input.roomType ||
            ''
        ).trim();

  if (rawEnum) {
    const direct = ENUM_LOOKUP.get(rawEnum.toLowerCase());
    if (direct) return direct;
  }

  // Fallback an toàn cho bản ghi/mock test cũ chưa populate roomType
  const fallbackText =
    typeof input === 'string'
      ? input.toLowerCase()
      : `${input.room?.name || ''} ${typeof input.roomId === 'object' ? input.roomId?.name || '' : ''} ${input.roomName || ''} ${input.name || ''}`.toLowerCase();

  if (fallbackText.includes('imax')) return ROOM_TYPES_ENUM.IMAX_LASER;
  if (fallbackText.includes('gold class') || fallbackText.includes('gold_class') || fallbackText.includes('gold') || fallbackText.includes('lounge')) {
    return ROOM_TYPES_ENUM.GOLD_CLASS;
  }
  if (fallbackText.includes('atmos') || fallbackText.includes('dolby')) return ROOM_TYPES_ENUM.DOLBY_ATMOS;
  if (fallbackText.includes('reald') || fallbackText.includes('3d')) return ROOM_TYPES_ENUM.REALD_3D;
  if (fallbackText.includes('4dx')) return ROOM_TYPES_ENUM.SOUND_4DX;
  if (fallbackText.trim()) return ROOM_TYPES_ENUM.STANDARD_2D;

  return '';
};

/**
 * Chuyển enum công nghệ phòng sang khóa giao diện phòng ('IMAX' | 'ATMOS' | 'GOLD')
 */
export const resolveRoomThemeKey = (input) => {
  const canonical = resolveCanonicalRoomType(input);
  if (canonical === ROOM_TYPES_ENUM.GOLD_CLASS) return 'GOLD';
  if (canonical === ROOM_TYPES_ENUM.DOLBY_ATMOS) return 'ATMOS';
  return 'IMAX';
};

/**
 * Phân tách rõ Công nghệ phòng (`room.roomType`), Định dạng chiếu (`formatFeature`)
 * và Khóa bảng giá vé (`TicketPricingConfig.formats`: '2D' | '3D' | 'IMAX' | 'GOLD_CLASS').
 */
export const resolvePricingFormatKey = (roomOrShowtime = {}) => {
  if (typeof roomOrShowtime === 'string') {
    const clean = roomOrShowtime.trim().toLowerCase();
    if (clean === 'imax' || clean === 'imax laser') return 'IMAX';
    if (clean === 'gold_class' || clean === 'gold class' || clean === 'gold') return 'GOLD_CLASS';
    if (clean === '3d' || clean === 'reald 3d') return '3D';
    if (clean === '2d' || clean === 'dolby atmos' || clean === '2d tiêu chuẩn') return '2D';
  }

  const canonicalRoomType = resolveCanonicalRoomType(roomOrShowtime);
  const formatText =
    typeof roomOrShowtime === 'string'
      ? roomOrShowtime.toLowerCase()
      : `${roomOrShowtime?.formatFeature || ''} ${roomOrShowtime?.format || ''}`.toLowerCase();

  if (canonicalRoomType === ROOM_TYPES_ENUM.IMAX_LASER) return 'IMAX';
  if (canonicalRoomType === ROOM_TYPES_ENUM.GOLD_CLASS) return 'GOLD_CLASS';
  if (canonicalRoomType === ROOM_TYPES_ENUM.REALD_3D) return '3D';

  if (
    canonicalRoomType === ROOM_TYPES_ENUM.DOLBY_ATMOS ||
    canonicalRoomType === ROOM_TYPES_ENUM.STANDARD_2D ||
    canonicalRoomType === ROOM_TYPES_ENUM.SOUND_4DX
  ) {
    if (/\b3d\b/i.test(formatText) || formatText.includes('reald')) return '3D';
    return '2D';
  }

  // Fallback cuối khi chỉ truyền formatFeature mà không có thông tin phòng
  if (formatText.includes('imax')) return 'IMAX';
  if (formatText.includes('gold class') || formatText.includes('gold_class') || formatText.includes('lounge')) {
    return 'GOLD_CLASS';
  }
  if (/\b3d\b/i.test(formatText) || formatText.includes('reald')) return '3D';
  return '2D';
};

/**
 * Xác định cột phân tách lối đi giữa trên một hàng ghế đã sắp xếp tăng dần theo `col`.
 * Cấu hình chuẩn 88 ghế (11 cột 1..11): lối đi nằm giữa cột 6 và cột 7 (`aisleAfterCol = 6`).
 */
export const resolveRowAisleSplitCol = (orderedRowSeats = []) => {
  if (!Array.isArray(orderedRowSeats) || orderedRowSeats.length === 0) {
    return SEAT_GRID_CONFIG.aisleAfterCol;
  }
  const maxCol = orderedRowSeats[orderedRowSeats.length - 1]?.col ?? 0;
  if (maxCol >= 7 && maxCol <= 12) {
    return SEAT_GRID_CONFIG.aisleAfterCol;
  }
  return orderedRowSeats[Math.ceil(orderedRowSeats.length / 2) - 1].col;
};
