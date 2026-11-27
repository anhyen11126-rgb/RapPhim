import React from 'react';
import { formatNumber, formatPercent } from '../utils/statisticsFormatter';

const OccupancyChart = ({ occupancy = {}, loading = false }) => {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center bg-[var(--bg-secondary)]/60 rounded-2xl border border-[var(--border-default)]">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const booked = Number(occupancy.booked || 0);
  const holding = Number(occupancy.holding || 0);
  const total = Number(occupancy.totalSellable ?? 0);
  const bookable = Number(occupancy.upcomingAvailableSeats ?? 0);
  const closed = Number(occupancy.closedUnsoldSeats ?? 0);

  const exactRate =
    occupancy.rate != null
      ? Number(occupancy.rate)
      : total > 0
      ? Number(((booked / total) * 100).toFixed(2))
      : 0;

  const roomCount = Number(occupancy.roomCount ?? 0);
  const totalPhysicalSeats = Number(occupancy.totalPhysicalSeats ?? 0);
  const activeShowtimesCount = Number(occupancy.activeShowtimesCount || 0);

  if (total === 0 && activeShowtimesCount === 0) {
    return (
      <div className="min-h-24 flex flex-col items-center justify-center bg-[var(--bg-secondary)]/60 rounded-2xl border border-[var(--border-default)] text-slate-400 text-xs p-4 text-center">
        <span className="text-2xl mb-2">🪑</span>
        <span className="font-semibold text-slate-300">Chưa có suất chiếu hoạt động trong kỳ</span>
        <span className="text-[11px] text-slate-500 mt-1">
          Sức chứa vật lý cụm rạp: {roomCount} phòng • {formatNumber(totalPhysicalSeats)} ghế
        </span>
      </div>
    );
  }

  // Tính toán góc SVG vòng tròn Donut
  const radius = 68;
  const circumference = 2 * Math.PI * radius;

  const bookedFraction = total > 0 ? Math.min(1, booked / total) : 0;
  const holdingFraction = total > 0 ? Math.min(1 - bookedFraction, holding / total) : 0;

  const bookedDash = bookedFraction * circumference;
  const holdingDash = holdingFraction * circumference;

  const legend = [
    { label: 'Ghế đã bán', count: booked, color: 'bg-cyan-400', text: 'text-cyan-300' },
    { label: 'Ghế đang giữ', count: holding, color: 'bg-amber-500', text: 'text-amber-400' },
    { label: 'Ghế trống đã đóng bán', count: closed, color: 'bg-slate-600', text: 'text-slate-200' },
    { label: 'Ghế thực sự còn đặt được', count: bookable, color: 'bg-emerald-400', text: 'text-emerald-400' },
  ];

  return (
    <div className="flex flex-col xl:flex-row items-center justify-around gap-6 py-2">
      {/* Vòng tròn Donut Chart SVG */}
      <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
          {/* Vòng nền: Ghế chưa bán (Màu xanh xám #334155) */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#334155"
            strokeWidth="16"
            fill="transparent"
          />

          {bookable > 0 && total > 0 && (
            <circle cx="80" cy="80" r={radius} stroke="#34D399" strokeWidth="16" fill="none"
              strokeDasharray={`${(bookable / total) * circumference} ${circumference}`}
              strokeDashoffset={-bookedDash - holdingDash} />
          )}
          {/* Vòng Ghế đang giữ tạm (Màu vàng cam #F59E0B) */}
          {holding > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="#F59E0B"
              strokeWidth="16"
              fill="transparent"
              strokeDasharray={`${holdingDash} ${circumference}`}
              strokeDashoffset={-bookedDash}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}

          {/* Vòng Ghế đã bán (Màu Cyan #22D3EE) */}
          {booked > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="#22D3EE"
              strokeWidth="16"
              fill="transparent"
              strokeDasharray={`${bookedDash} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          )}
        </svg>

        {/* Nhãn chính giữa Donut: Khớp 100% với tỷ lệ phía trên, tối đa 2 chữ số thập phân */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-2xl sm:text-3xl font-black text-white leading-none">
            {formatPercent(exactRate, 2)}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-300 mt-1">
            Lấp đầy
          </span>
        </div>
      </div>

      {/* Legend và chi tiết số lượng ghế */}
      <div className="space-y-2.5 text-xs w-full sm:w-auto">
        {legend.map(({ label, count, color, text }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-full ${color}`} />
              <span className="font-medium text-slate-300">{label}:</span>
            </div>
            <div className="shrink-0 text-right">
              <strong className={text}>{formatNumber(count)}</strong>
              <span className="ml-1 text-[11px] text-slate-400">
                ({formatPercent(total > 0 ? count / total * 100 : 0, 2)})
              </span>
            </div>
          </div>
        ))}
        <div className="pt-2 border-t border-[var(--border-default)] space-y-1 text-[11px] text-slate-400">
          <div className="flex items-center justify-between gap-4">
            <span>Lấp đầy suất đã chiếu / Đặt trước sắp chiếu:</span>
            <span className="font-semibold text-amber-300">
              {formatPercent(occupancy.completedOccupancyRate || 0, 2)} /{' '}
              <span className="text-cyan-300">{formatPercent(occupancy.upcomingOccupancyRate || 0, 2)}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Tổng sức chứa trong kỳ ({formatNumber(activeShowtimesCount)} suất):</span>
            <span className="font-bold text-white">{formatNumber(total)} ghế</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Ghế vật lý toàn rạp ({roomCount} phòng):</span>
            <span className="font-bold text-cyan-300">{formatNumber(totalPhysicalSeats)} ghế</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OccupancyChart;
