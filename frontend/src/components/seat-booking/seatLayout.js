export function createSeatLayout(seats, roomType) {
  const rows = new Map();
  for (const seat of seats) {
    if (!rows.has(seat.row)) rows.set(seat.row, []);
    rows.get(seat.row).push(seat);
  }

  let height = 0.22;
  let front = -9;
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, entries], index, all) => {
    const crossAisle = label === 'E' && all[index - 1]?.[0] === 'D';
    front += crossAisle ? 1.55 : 0;
    const depth = 1.55;
    const z = front + depth * 0.52;
    const y = height;
    front += depth;
    height += 0.34;

    const ordered = entries.toSorted((a, b) => a.col - b.col);
    const splitCol = roomType === 'IMAX' && ordered.at(-1).col <= 12
      ? (label === 'H' && ordered.at(-1).col <= 4 ? 2 : 6)
      : ordered[Math.ceil(ordered.length / 2) - 1].col;
    const withPositions = (group, side) => {
      const widths = group.map(({ type }) => type === 'SWEETBOX' ? 1.48 : 1.05);
      let edge = side === -1 ? -0.82 - widths.reduce((sum, width) => sum + width, 0) : 0.82;
      return group.map((seat, i) => {
        const x = edge + widths[i] / 2;
        edge += widths[i];
        return { ...seat, x, y, z, width: widths[i] - 0.09 };
      });
    };

    return {
      label, crossAisle, y, z, front: front - depth, depth,
      left: withPositions(ordered.filter(({ col }) => col <= splitCol), -1),
      right: withPositions(ordered.filter(({ col }) => col > splitCol), 1),
    };
  });
}

export function seatEyePosition(seat) {
  return [seat.x, seat.y + 1.14, seat.z - 0.18];
}
