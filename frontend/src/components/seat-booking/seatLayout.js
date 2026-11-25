/**
 * Cấu hình chuẩn dùng chung cho sơ đồ 88 ghế của 9 phòng chiếu vật lý:
 * - 8 hàng ghế: A, B, C, D (Standard) | E, F, G (VIP) | H (Sweetbox / VIP Prime)
 * - 11 ghế mỗi hàng (cột 1..11) -> Tổng cộng 88 ghế
 * - Lối đi trung tâm (AISLE) nằm giữa cột 6 và cột 7 trên toàn bộ các hàng A–H
 */
export const SEAT_LAYOUT_CONFIG = Object.freeze({
  rows: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
  colsPerRow: 11,
  aisleAfterCol: 6,
  totalSeats: 88,
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

/**
 * Xác định cột phân tách lối đi giữa trên một hàng ghế đã sắp xếp theo `col`.
 * Đảm bảo đồng nhất cột 6 | lối đi | cột 7 cho tất cả các hàng A–H của cả 3 loại phòng.
 */
export function resolveRowAisleSplitCol(orderedSeats = []) {
  if (!Array.isArray(orderedSeats) || orderedSeats.length === 0) {
    return SEAT_LAYOUT_CONFIG.aisleAfterCol;
  }
  const maxCol = orderedSeats.at(-1)?.col ?? 0;
  if (maxCol >= 7 && maxCol <= 12) {
    return SEAT_LAYOUT_CONFIG.aisleAfterCol;
  }
  return orderedSeats[Math.ceil(orderedSeats.length / 2) - 1].col;
}

export function createSeatLayout(seats, _roomType) {
  const rows = new Map();
  for (const seat of seats) {
    if (!rows.has(seat.row)) rows.set(seat.row, []);
    rows.get(seat.row).push(seat);
  }

  let height = 0.22;
  let front = -9;
  return [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, entries], index, all) => {
      const crossAisle = label === 'E' && all[index - 1]?.[0] === 'D';
      front += crossAisle ? 1.55 : 0;
      const depth = 1.55;
      const z = front + depth * 0.52;
      const y = height;
      front += depth;
      height += 0.34;

      const ordered = entries.toSorted((a, b) => a.col - b.col);
      const splitCol = resolveRowAisleSplitCol(ordered);
      const withPositions = (group, side) => {
        const widths = group.map(({ type }) => (type === 'SWEETBOX' ? 1.48 : 1.05));
        let edge = side === -1 ? -0.82 - widths.reduce((sum, width) => sum + width, 0) : 0.82;
        return group.map((seat, i) => {
          const x = edge + widths[i] / 2;
          edge += widths[i];
          return { ...seat, x, y, z, width: widths[i] - 0.09 };
        });
      };

      return {
        label,
        crossAisle,
        y,
        z,
        front: front - depth,
        depth,
        left: withPositions(ordered.filter(({ col }) => col <= splitCol), -1),
        right: withPositions(ordered.filter(({ col }) => col > splitCol), 1),
      };
    });
}

export function seatEyePosition(seat) {
  return [seat.x, seat.y + 1.14, seat.z - 0.18];
}
