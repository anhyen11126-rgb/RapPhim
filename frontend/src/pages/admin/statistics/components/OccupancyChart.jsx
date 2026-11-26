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

  const booked = occupancy.booked || 0;
  const available = occupancy.available || 0;
  const holding = occupancy.holding || 0;
  const total = occupancy.totalSellable ?? 0;
  const rate = occupancy.rate ?? (total > 0 ? Number(((booked / total) * 100).toFixed(2)) : 0);

  const roomCount = occupancy.roomCount || 9;
  const seatsPerRoom = occupancy.seatsPerRoom || 88;
  const totalPhysicalSeats = occupancy.totalPhysicalSeats || roomCount * seatsPerRoom;
  const activeShowtimesCount = occupancy.activeShowtimesCount || 0;

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

  const bookedOffset = circumference - (booked / (total || 1)) * circumference;
  const holdingOffset = circumference - (holding / (total || 1)) * circumference;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
      {/* Vòng tròn Donut Chart SVG */}
      <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
          {/* Vòng nền (Ghế trống - Xám slate) */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#1e293b"
            strokeWidth="16"
            fill="transparent"
          />
          {/* Vòng Ghế đang giữ (Màu vàng amber) */}
          {holding > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="#f59e0b"
              strokeWidth="16"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={holdingOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
          {/* Vòng Ghế đã bán (Màu Cyan/Emerald) */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#22d3ee"
            strokeWidth="16"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={bookedOffset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>

        {/* Nhãn chính giữa Donut */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-2xl sm:text-3xl font-black text-white leading-none">
            {formatPercent(rate)}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-300 mt-1">
            Lấp đầy
          </span>
        </div>
      </div>

      {/* Legend và chi tiết số lượng ghế */}
      <div className="space-y-2.5 text-xs w-full sm:w-auto">
        <div className="flex items-center justify-between sm:space-x-6">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
            <span className="text-slate-300 font-medium">Ghế đã bán:</span>
          </div>
          <div className="text-right">
            <strong className="text-cyan-300 font-bold">{formatNumber(booked)}</strong>
            <span className="text-slate-500 text-[11px] ml-1">
              ({formatPercent(total > 0 ? (booked / total) * 100 : 0)})
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:space-x-6">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-slate-600"></span>
            <span className="text-slate-300 font-medium">Ghế không bán được (Đã chiếu):</span>
          </div>
          <div className="text-right">
            <strong className="text-slate-300 font-bold">
              {formatNumber(occupancy.completedUnsoldSeats ?? 0)}
            </strong>
          </div>
        </div>

        <div className="flex items-center justify-between sm:space-x-6">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300 font-medium">Ghế còn trống (Sắp chiếu):</span>
          </div>
          <div className="text-right">
            <strong className="text-emerald-400 font-bold">
              {formatNumber(occupancy.upcomingAvailableSeats ?? available)}
            </strong>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--border-default)] space-y-1 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span>Tổng ghế mở bán trong kỳ ({formatNumber(activeShowtimesCount)} suất):</span>
            <span className="font-bold text-white">{formatNumber(total)} ghế</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Cấu hình rạp vật lý ({roomCount} phòng × {seatsPerRoom} ghế):</span>
            <span className="font-bold text-cyan-300">{formatNumber(totalPhysicalSeats)} ghế</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OccupancyChart;
