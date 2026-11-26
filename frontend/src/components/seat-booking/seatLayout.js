/**
 * Cấu hình chuẩn dùng chung cho sơ đồ 88 ghế của phòng chiếu:
 * - Hàng A–G: mỗi hàng 12 ghế (chia đều 6 ghế bên trái 1..6 và 6 ghế bên phải 7..12)
 * - Hàng H: 4 ghế còn lại (chia đều 2 ghế bên trái H1..H2 và 2 ghế bên phải H3..H4, căn đối xứng)
 * - Tổng cộng: 7 × 12 + 4 = 88 ghế
 * - Lối đi trung tâm (AISLE) nằm chính giữa phòng trên toàn bộ các hàng A–H
 */
export const SEAT_LAYOUT_CONFIG = Object.freeze({
  rows: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
  colsPerRow: 12,
  rowColsMap: Object.freeze({ A: 12, B: 12, C: 12, D: 12, E: 12, F: 12, G: 12, H: 4 }),
  aisleAfterCol: 6,
  rowHCols: 4,
  rowHAisleAfterCol: 2,
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

export function getRowSeatCount(rowLabel) {
  return SEAT_LAYOUT_CONFIG.rowColsMap[String(rowLabel || '').toUpperCase()] ?? SEAT_LAYOUT_CONFIG.colsPerRow;
}

/**
 * Xác định cột phân tách lối đi giữa trên một hàng ghế đã sắp xếp theo `col`.
 * - Hàng 12 ghế (A–G): tách sau cột 6 (6 trái | AISLE | 6 phải).
 * - Hàng 4 ghế (H): tách sau cột thứ 2 (2 trái | AISLE | 2 phải, đối xứng).
 */
export function resolveRowAisleSplitCol(orderedSeats = []) {
  if (!Array.isArray(orderedSeats) || orderedSeats.length === 0) {
    return SEAT_LAYOUT_CONFIG.aisleAfterCol;
  }
  if (orderedSeats.length <= 6) {
    return orderedSeats[Math.ceil(orderedSeats.length / 2) - 1].col;
  }
  const maxCol = orderedSeats.at(-1)?.col ?? 0;
  if (maxCol >= 7 && maxCol <= 12) {
    return SEAT_LAYOUT_CONFIG.aisleAfterCol;
  }
  return orderedSeats[Math.ceil(orderedSeats.length / 2) - 1].col;
}

export function createSeatLayout(seats, roomType) {
  const isImax = !roomType || roomType === 'IMAX' || String(roomType).toUpperCase().includes('IMAX');
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
        const widths = group.map(({ type }) => (!isImax && type === 'SWEETBOX' ? 1.48 : 1.05));
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
