import React from 'react';
import { formatNumber, formatPercent } from '../utils/statisticsFormatter';

const OccupancyChart = ({ occupancy = {}, loading = false }) => {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center bg-slate-900/60 rounded-2xl border border-slate-800">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const booked = occupancy.booked || 0;
  const available = occupancy.available || 0;
  const holding = occupancy.holding || 0;
  const total = occupancy.totalSellable || (booked + available + holding);
  const rate = occupancy.rate ?? (total > 0 ? Number(((booked / total) * 100).toFixed(1)) : 0);

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
          {/* Vòng Ghế đã đặt (Màu đỏ D'AVENOR) */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#dc2626"
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
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1">
            Lấp đầy
          </span>
        </div>
      </div>

      {/* Legend và chi tiết số lượng ghế */}
      <div className="space-y-3 text-xs w-full sm:w-auto">
        <div className="flex items-center justify-between sm:space-x-8">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-600"></span>
            <span className="text-slate-300 font-medium">Ghế đã đặt:</span>
          </div>
          <div className="text-right">
            <strong className="text-white font-bold">{formatNumber(booked)}</strong>
            <span className="text-slate-500 text-[11px] ml-1">({formatPercent((booked / (total || 1)) * 100)})</span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:space-x-8">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-slate-700"></span>
            <span className="text-slate-300 font-medium">Ghế chưa đặt:</span>
          </div>
          <div className="text-right">
            <strong className="text-emerald-400 font-bold">{formatNumber(available)}</strong>
            <span className="text-slate-500 text-[11px] ml-1">({formatPercent((available / (total || 1)) * 100)})</span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:space-x-8">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-slate-300 font-medium">Đang giữ chỗ:</span>
          </div>
          <div className="text-right">
            <strong className="text-amber-400 font-bold">{formatNumber(holding)}</strong>
            <span className="text-slate-500 text-[11px] ml-1">({formatPercent((holding / (total || 1)) * 100)})</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Tổng ghế toàn rạp:</span>
          <span className="font-bold text-white">{formatNumber(total || 704)} ghế</span>
        </div>
      </div>
    </div>
  );
};

export default OccupancyChart;
