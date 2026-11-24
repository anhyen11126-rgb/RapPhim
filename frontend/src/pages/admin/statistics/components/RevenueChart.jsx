import React from 'react';
import { formatCurrency, formatNumber } from '../utils/statisticsFormatter';

const RevenueChart = ({ data = [], loading = false }) => {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center bg-[var(--bg-secondary)]/60 rounded-2xl border border-[var(--border-default)]">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-[var(--bg-secondary)]/60 rounded-2xl border border-[var(--border-default)] text-slate-400 text-xs">
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

  // Tìm giá trị max để tính tỷ lệ cột
  const maxRev = Math.max(...data.map((d) => d.netRevenue || 0), 100000);

  return (
    <div className="space-y-4">
      {/* Biểu đồ Cột trực quan */}
      <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-2 px-2">
        {data.map((item, idx) => {
          const totalPct = Math.min(100, Math.max(4, Math.round(((item.netRevenue || 0) / maxRev) * 100)));
          const ticketRatio = item.netRevenue > 0 ? (item.ticketRevenue || 0) / item.netRevenue : 1;
          const ticketHeight = Math.round(totalPct * ticketRatio);
          const concessionHeight = totalPct - ticketHeight;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group/bar relative">
              {/* Tooltip Hover */}
              <div className="opacity-0 group-hover/bar:opacity-100 transition-opacity bg-slate-950 border border-slate-700 text-white text-[11px] rounded-xl p-2.5 absolute -top-16 z-30 pointer-events-none shadow-2xl whitespace-nowrap space-y-0.5">
                <div className="font-bold text-amber-400">{item.date}</div>
                <div>Doanh thu vé: <strong>{formatCurrency(item.ticketRevenue)}</strong></div>
                <div>Doanh thu bắp nước: <strong>{formatCurrency(item.concessionRevenue)}</strong></div>
                <div className="border-t border-[var(--border-default)] pt-0.5 text-emerald-400">
                  Tổng thuần: <strong>{formatCurrency(item.netRevenue)}</strong> ({formatNumber(item.tickets)} vé)
                </div>
              </div>

              {/* Cột Bar phân tầng (Vé ở dưới, bắp nước ở trên) */}
              <div className="w-full max-w-[36px] flex flex-col justify-end rounded-t-lg overflow-hidden bg-[var(--bg-surface)]/40">
                {/* Phần Bắp nước (Màu cam) */}
                {concessionHeight > 0 && (
                  <div
                    style={{ height: `${concessionHeight}%` }}
                    className="w-full bg-amber-500 hover:bg-amber-400 transition-all"
                  ></div>
                )}
                {/* Phần Vé xem phim (Màu đỏ D'AVENOR) */}
                <div
                  style={{ height: `${ticketHeight}%` }}
                  className="w-full bg-[var(--neon-purple)] hover:bg-violet-500 transition-all rounded-t-sm"
                ></div>
              </div>

              {/* Nhãn ngày trục X */}
              <span className="text-[10px] text-slate-400 font-semibold mt-2 truncate max-w-[42px] block text-center">
                {item.date}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend Chú giải */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-3 border-t border-[var(--border-default)]/80">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--neon-purple)]"></span>
            <span>Vé xem phim</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
            <span>Bắp nước & Combo</span>
          </span>
        </div>
        <span className="text-[11px] text-slate-500">Đơn vị: VNĐ • Tự động tính theo thời gian thực</span>
      </div>
    </div>
  );
};

export default RevenueChart;
