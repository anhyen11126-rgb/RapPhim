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
  const available = Math.max(0, Number(occupancy.available ?? total - booked - holding));

  const exactRate =
    occupancy.rate != null
      ? Number(occupancy.rate)
      : total > 0
      ? Number(((booked / total) * 100).toFixed(2))
      : 0;

  const roomCount = Number(occupancy.roomCount || 9);
  const seatsPerRoom = Number(occupancy.seatsPerRoom || 88);
  const totalPhysicalSeats = Number(occupancy.totalPhysicalSeats || roomCount * seatsPerRoom);
  const activeShowtimesCount = Number(occupancy.activeShowtimesCount || 0);

  if (total === 0 && activeShowtimesCount === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-[var(--bg-secondary)]/60 rounded-2xl border border-[var(--border-default)] text-slate-400 text-xs p-4 text-center">
        <span className="text-2xl mb-2">🪑</span>
        <span className="font-semibold text-slate-300">Chưa có suất chiếu mở bán trong kỳ được chọn</span>
        <span className="text-[11px] text-slate-500 mt-1">
          Sức chứa vật lý cụm rạp: {roomCount} phòng × {seatsPerRoom} ghế = {formatNumber(totalPhysicalSeats)} ghế
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

  const bookedPct = total > 0 ? Number(((booked / total) * 100).toFixed(2)) : 0;
  const availablePct = total > 0 ? Number(((available / total) * 100).toFixed(2)) : 0;
  const holdingPct = total > 0 ? Number(((holding / total) * 100).toFixed(2)) : 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
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
        {/* 1. Ghế đã bán (Cyan) */}
        <div className="flex items-center justify-between sm:space-x-6">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
            <span className="text-slate-300 font-medium">Ghế đã bán:</span>
          </div>
          <div className="text-right">
            <strong className="text-cyan-300 font-bold">{formatNumber(booked)}</strong>
            <span className="text-slate-400 text-[11px] ml-1">({formatPercent(bookedPct, 2)})</span>
          </div>
        </div>

        {/* 2. Ghế chưa bán (Xanh xám) */}
        <div className="flex items-center justify-between sm:space-x-6">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-slate-600"></span>
            <span className="text-slate-300 font-medium">Ghế chưa bán:</span>
          </div>
          <div className="text-right">
            <strong className="text-slate-200 font-bold">{formatNumber(available)}</strong>
            <span className="text-slate-400 text-[11px] ml-1">({formatPercent(availablePct, 2)})</span>
          </div>
        </div>

        {/* 3. Ghế đang giữ (Vàng cam) */}
        <div className="flex items-center justify-between sm:space-x-6">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-slate-300 font-medium">Ghế đang giữ:</span>
          </div>
          <div className="text-right">
            <strong className="text-amber-400 font-bold">{formatNumber(holding)}</strong>
            <span className="text-slate-400 text-[11px] ml-1">({formatPercent(holdingPct, 2)})</span>
          </div>
        </div>

        {/* Phân biệt rõ Tổng sức chứa trong kỳ, 3 tỷ lệ theo mẫu số vs Cấu hình 9 phòng vật lý (792 ghế) */}
        <div className="pt-2 border-t border-[var(--border-default)] space-y-1 text-[11px] text-slate-400">
          <div className="flex items-center justify-between gap-4">
            <span>Trống đã chiếu / Còn đặt được (Sắp chiếu):</span>
            <span className="font-semibold text-slate-200">
              {formatNumber(occupancy.completedUnsoldSeats || 0)} /{' '}
              <strong className="text-emerald-400">{formatNumber(occupancy.upcomingAvailableSeats || 0)} ghế</strong>
            </span>
          </div>
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
            <span>Ghế vật lý toàn rạp ({roomCount} phòng × {seatsPerRoom} ghế):</span>
            <span className="font-bold text-cyan-300">{formatNumber(totalPhysicalSeats)} ghế</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OccupancyChart;
