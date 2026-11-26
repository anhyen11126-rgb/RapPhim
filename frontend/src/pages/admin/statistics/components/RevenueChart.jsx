import React, { useState, useRef, useMemo } from 'react';
import { formatCurrency, formatNumber } from '../utils/statisticsFormatter';

/**
 * Tạo đường cong Monotone Cubic Spline (Fritsch-Carlson) qua tập điểm (x, y)
 * Đảm bảo đường biểu đồ mềm mại nhưng KHÔNG bao giờ vượt quá/thấp hơn giá trị thực tế (no overshoot).
 */
function buildMonotonePath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  const n = points.length;
  const dx = [];
  const dy = [];
  const m = [];

  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    dy[i] = points[i + 1].y - points[i].y;
    m[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  const tangents = new Array(n).fill(0);
  tangents[0] = m[0];
  tangents[n - 1] = m[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (m[i - 1] + m[i]) / 2;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / m[i];
      const beta = tangents[i + 1] / m[i];
      const s = alpha * alpha + beta * beta;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        tangents[i] = tau * alpha * m[i];
        tangents[i + 1] = tau * beta * m[i];
      }
    }
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const segDx = (p1.x - p0.x) / 3;
    const cp1x = p0.x + segDx;
    const cp1y = p0.y + tangents[i] * segDx;
    const cp2x = p1.x - segDx;
    const cp2y = p1.y - tangents[i + 1] * segDx;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }

  return d;
}

/**
 * Định dạng nhãn trục Y dễ đọc: 0 đ, 5 triệu, 10 triệu, 15 triệu, 20 triệu...
 */
function formatYAxisLabel(val) {
  const num = Number(val || 0);
  if (num === 0) return '0 đ';
  if (num >= 1000000000) {
    const b = Number((num / 1000000000).toFixed(1));
    return `${String(b).replace('.', ',')} tỷ`;
  }
  if (num >= 1000000) {
    const m = Number((num / 1000000).toFixed(1));
    return `${String(m).replace('.', ',')} triệu`;
  }
  if (num >= 1000) {
    return `${Math.round(num / 1000)}k đ`;
  }
  return `${num} đ`;
}

/**
 * Tự động tính giới hạn trục Y và danh sách 5 mốc chia đẹp (ví dụ 0, 5tr, 10tr, 15tr, 20tr)
 */
function computeYAxisScale(maxDataValue) {
  const rawMax = Math.max(Number(maxDataValue || 0), 1000000);
  const niceSteps = [
    250000,
    500000,
    1000000,
    2000000,
    2500000,
    4000000,
    5000000,
    10000000,
    15000000,
    20000000,
    25000000,
    50000000,
    100000000,
  ];
  const targetStep = rawMax / 4;
  const step = niceSteps.find((s) => s >= targetStep) || Math.ceil(targetStep / 5000000) * 5000000;
  const maxDomain = step * 4;
  const ticks = [0, step, step * 2, step * 3, maxDomain];
  return { maxDomain, ticks };
}

/**
 * Chọn các chỉ số ngày hiển thị nhãn trên trục X để không bị tràn chữ:
 * - Với tháng 30-31 ngày (ví dụ Tháng 10: 01/10, 05/10, 10/10, 15/10, 20/10, 25/10, 31/10)
 * - Với tháng 26 ngày (ví dụ Tháng 11: 01/11, 05/11, 10/11, 15/11, 20/11, 26/11)
 * - Với khoảng <= 10 ngày: hiển thị tất cả các ngày
 */
function resolveXAxisTickIndices(data) {
  const n = data.length;
  if (n === 0) return [];
  if (n <= 10) return data.map((_, idx) => idx);

  const selected = new Set([0, n - 1]);
  const targetDays = new Set([1, 5, 10, 15, 20, 25]);

  data.forEach((item, idx) => {
    const dayNum = Number(String(item.date || '').split('/')[0]);
    if (targetDays.has(dayNum)) {
      // Nếu mốc 25 quá sát ngày cuối (ví dụ ngày cuối là 26/11), ưu tiên hiển thị 26/11 để không chồng nhãn
      if (dayNum === 25 && n - 1 - idx <= 1) return;
      selected.add(idx);
    }
  });

  if (selected.size <= 2) {
    const step = Math.max(1, Math.floor((n - 1) / 6));
    for (let i = 0; i < n; i += step) selected.add(i);
    selected.add(n - 1);
  }

  return Array.from(selected).sort((a, b) => a - b);
}

const RevenueChart = ({ data = [], loading = false }) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  const hasAnyValue = useMemo(
    () =>
      Array.isArray(data) &&
      data.some(
        (d) =>
          (d.netRevenue || 0) > 0 ||
          (d.ticketRevenue || 0) > 0 ||
          (d.concessionRevenue || 0) > 0 ||
          (d.tickets || 0) > 0
      ),
    [data]
  );

  if (loading) {
    return (
      <div className="h-72 flex items-center justify-center bg-[var(--bg-secondary)]/60 rounded-2xl border border-[var(--border-default)]">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data || data.length === 0 || !hasAnyValue) {
    return (
      <div className="h-72 flex flex-col items-center justify-center bg-[var(--bg-secondary)]/60 rounded-2xl border border-[var(--border-default)] text-slate-400 text-xs">
        <svg className="w-8 h-8 text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <span>Chưa có phát sinh doanh thu trong khoảng thời gian đã chọn</span>
      </div>
    );
  }

  // Kích thước hệ tọa độ SVG chuẩn (responsive 100% bên trong khung chứa)
  const SVG_WIDTH = 760;
  const SVG_HEIGHT = 276;
  const PAD_LEFT = 72;
  const PAD_RIGHT = 26;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 36;
  const PLOT_WIDTH = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
  const PLOT_HEIGHT = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const BASE_Y = PAD_TOP + PLOT_HEIGHT;

  const maxDataVal = Math.max(
    ...data.map((d) =>
      Math.max(Number(d.ticketRevenue || 0), Number(d.concessionRevenue || 0), Number(d.netRevenue || 0) * 0.85)
    ),
    1000000
  );
  const { maxDomain, ticks: yTicks } = computeYAxisScale(maxDataVal);

  const getX = (idx) => {
    if (data.length <= 1) return PAD_LEFT + PLOT_WIDTH / 2;
    return PAD_LEFT + (idx / (data.length - 1)) * PLOT_WIDTH;
  };

  const getY = (val) => {
    const clamped = Math.max(0, Math.min(maxDomain, Number(val || 0)));
    return PAD_TOP + PLOT_HEIGHT - (clamped / maxDomain) * PLOT_HEIGHT;
  };

  const ticketPoints = data.map((d, idx) => ({
    x: getX(idx),
    y: getY(d.ticketRevenue || 0),
    val: Number(d.ticketRevenue || 0),
  }));

  const comboPoints = data.map((d, idx) => ({
    x: getX(idx),
    y: getY(d.concessionRevenue || 0),
    val: Number(d.concessionRevenue || 0),
  }));

  const ticketLinePath = buildMonotonePath(ticketPoints);
  const ticketAreaPath =
    ticketPoints.length > 0
      ? `${ticketLinePath} L ${ticketPoints[ticketPoints.length - 1].x.toFixed(2)} ${BASE_Y.toFixed(2)} L ${ticketPoints[0].x.toFixed(2)} ${BASE_Y.toFixed(2)} Z`
      : '';

  const comboLinePath = buildMonotonePath(comboPoints);
  const comboAreaPath =
    comboPoints.length > 0
      ? `${comboLinePath} L ${comboPoints[comboPoints.length - 1].x.toFixed(2)} ${BASE_Y.toFixed(2)} L ${comboPoints[0].x.toFixed(2)} ${BASE_Y.toFixed(2)} Z`
      : '';

  const xTickIndices = resolveXAxisTickIndices(data);

  const handleMouseMove = (e) => {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;
    const clampedX = Math.max(PAD_LEFT, Math.min(PAD_LEFT + PLOT_WIDTH, relX));
    const ratio = data.length > 1 ? (clampedX - PAD_LEFT) / PLOT_WIDTH : 0;
    const nearestIdx = Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
    setHoverIndex(nearestIdx);
  };

  const hoveredItem = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;
  const hoveredTicketPt = hoverIndex !== null ? ticketPoints[hoverIndex] : null;

  return (
    <div className="space-y-3 select-none">
      {/* Vùng Biểu đồ Area + Line SVG */}
      <div className="relative w-full overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-64 sm:h-72 overflow-visible block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Vùng Gradient nhẹ phía dưới đường Doanh thu vé (Tím Holographic) */}
            <linearGradient id="ticketAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.34" />
              <stop offset="65%" stopColor="#7C3AED" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
            </linearGradient>

            {/* Vùng Gradient rất nhẹ phía dưới đường Doanh thu Combo (Vàng Gold) */}
            <linearGradient id="comboAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Các đường lưới ngang mảnh & Nhãn trục Y */}
          {yTicks.map((tickVal, idx) => {
            const yPos = getY(tickVal);
            return (
              <g key={idx}>
                <line
                  x1={PAD_LEFT}
                  y1={yPos}
                  x2={SVG_WIDTH - PAD_RIGHT}
                  y2={yPos}
                  stroke="#1E293B"
                  strokeWidth="1"
                  strokeDasharray={tickVal === 0 ? undefined : '4 4'}
                />
                <text
                  x={PAD_LEFT - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  fill="#94A3B8"
                  fontSize="11"
                  fontWeight="600"
                >
                  {formatYAxisLabel(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Vùng Area dưới đường Doanh thu vé */}
          {ticketAreaPath && <path d={ticketAreaPath} fill="url(#ticketAreaGrad)" />}

          {/* Vùng Area nhẹ dưới đường Doanh thu combo */}
          {comboAreaPath && <path d={comboAreaPath} fill="url(#comboAreaGrad)" />}

          {/* Đường Line Doanh thu Bắp nước & Combo (Màu vàng gold #F59E0B) */}
          {comboLinePath && (
            <path
              d={comboLinePath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Đường Line Doanh thu Vé xem phim (Màu tím holographic #A855F7) */}
          {ticketLinePath && (
            <path
              d={ticketLinePath}
              fill="none"
              stroke="#A855F7"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Các điểm chấm nhỏ trên đường biểu đồ */}
          {ticketPoints.map((pt, idx) => (
            <circle
              key={`tk-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={hoverIndex === idx ? 5 : 2.2}
              fill={hoverIndex === idx ? '#FFFFFF' : '#C084FC'}
              stroke="#9333EA"
              strokeWidth={hoverIndex === idx ? 2.5 : 1}
            />
          ))}

          {comboPoints.map((pt, idx) => (
            <circle
              key={`cb-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={hoverIndex === idx ? 4.5 : 1.8}
              fill={hoverIndex === idx ? '#FEF3C7' : '#FBBF24'}
              stroke="#D97706"
              strokeWidth={hoverIndex === idx ? 2 : 1}
            />
          ))}

          {/* Đường gióng dọc khi Hover */}
          {hoverIndex !== null && hoveredTicketPt && (
            <line
              x1={hoveredTicketPt.x}
              y1={PAD_TOP}
              x2={hoveredTicketPt.x}
              y2={BASE_Y}
              stroke="#A855F7"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity="0.75"
            />
          )}

          {/* Nhãn ngày trên Trục X (Đã lọc thông minh để không bao giờ tràn khung) */}
          {xTickIndices.map((idx) => {
            const item = data[idx];
            if (!item) return null;
            const xPos = getX(idx);
            const isFirst = idx === 0;
            const isLast = idx === data.length - 1;
            const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
            const adjustedX = isFirst ? Math.max(PAD_LEFT - 4, xPos - 6) : isLast ? Math.min(SVG_WIDTH - 4, xPos + 4) : xPos;

            return (
              <g key={`xtick-${idx}`}>
                <line
                  x1={xPos}
                  y1={BASE_Y}
                  x2={xPos}
                  y2={BASE_Y + 5}
                  stroke="#334155"
                  strokeWidth="1"
                />
                <text
                  x={adjustedX}
                  y={BASE_Y + 21}
                  textAnchor={anchor}
                  fill="#94A3B8"
                  fontSize="11"
                  fontWeight="600"
                >
                  {item.date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip Doanh thu khi di chuột vào 1 ngày bất kỳ (Mục 5) */}
        {hoveredItem && hoveredTicketPt && (
          <div
            style={{
              left: `${Math.min(72, Math.max(8, (hoveredTicketPt.x / SVG_WIDTH) * 100 - 14))}%`,
              top: '10px',
            }}
            className="absolute z-30 pointer-events-none bg-[#090D24]/95 border border-purple-500/40 rounded-2xl px-3.5 py-2.5 text-xs text-white shadow-2xl backdrop-blur-md min-w-[215px] space-y-1.5"
          >
            <div className="font-bold text-purple-300 border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>Ngày: {hoveredItem.fullDate || hoveredItem.date}</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>Doanh thu vé:</span>
                </span>
                <strong className="text-purple-300 font-bold">
                  {formatCurrency(hoveredItem.ticketRevenue || 0)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Doanh thu combo:</span>
                </span>
                <strong className="text-amber-300 font-bold">
                  {formatCurrency(hoveredItem.concessionRevenue || 0)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800/90">
                <span className="text-slate-200 font-semibold">Tổng doanh thu:</span>
                <strong className="text-emerald-400 font-black">
                  {formatCurrency(hoveredItem.netRevenue || 0)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4 text-slate-400 pt-0.5">
                <span>Số vé đã bán: <strong className="text-cyan-300">{formatNumber(hoveredItem.tickets || 0)} vé</strong></span>
                <span>Số đơn hợp lệ: <strong className="text-white">{formatNumber(hoveredItem.orders || 0)} đơn</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend Chú giải */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-3 border-t border-[var(--border-default)]/80">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center space-x-2">
            <span className="w-3 h-1 rounded-full bg-purple-400 inline-block"></span>
            <span className="text-slate-300 font-medium">Doanh thu vé xem phim</span>
          </span>
          <span className="flex items-center space-x-2">
            <span className="w-3 h-1 rounded-full bg-amber-400 inline-block"></span>
            <span className="text-slate-300 font-medium">Doanh thu bắp nước & Combo</span>
          </span>
        </div>
        <span className="text-[11px] text-slate-500">
          Đơn vị: VNĐ • Múi giờ chuẩn Asia/Ho_Chi_Minh
        </span>
      </div>
    </div>
  );
};

export default RevenueChart;
