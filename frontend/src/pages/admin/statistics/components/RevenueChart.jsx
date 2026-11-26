import React from 'react';
import { formatCurrency, formatNumber } from '../utils/statisticsFormatter';

const RevenueChart = ({ data = [], loading = false, showExpenseOverlay = false }) => {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center bg-[var(--bg-secondary)]/60 rounded-2xl border border-[var(--border-default)]">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const hasAnyValue =
    Array.isArray(data) &&
    data.some(
      (d) =>
        (d.netRevenue || 0) > 0 ||
        (d.ticketRevenue || 0) > 0 ||
        (d.concessionRevenue || 0) > 0 ||
        (d.expense || 0) > 0 ||
        (d.tickets || 0) > 0
    );

  if (!data || data.length === 0 || !hasAnyValue) {
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
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.netRevenue || 0, showExpenseOverlay ? d.expense || 0 : 0)),
    100000
  );

  return (
    <div className="space-y-4">
      {/* Biểu đồ Cột trực quan */}
      <div className="h-64 flex items-end justify-between gap-1.5 pt-8 pb-2 px-2 overflow-x-auto">
        {data.map((item, idx) => {
          const rev = item.netRevenue || 0;
          const exp = item.expense || 0;
          const totalPct = rev > 0 ? Math.min(100, Math.max(6, Math.round((rev / maxVal) * 100))) : 2;
          const ticketRatio = rev > 0 ? (item.ticketRevenue || 0) / rev : 1;
          const ticketHeight = rev > 0 ? Math.round(totalPct * ticketRatio) : 0;
          const concessionHeight = rev > 0 ? Math.max(0, totalPct - ticketHeight) : 0;
          const expPct = exp > 0 ? Math.min(100, Math.max(6, Math.round((exp / maxVal) * 100))) : 0;

          return (
            <div key={idx} className="flex-1 min-w-[20px] flex flex-col items-center h-full justify-end group/bar relative">
              {/* Tooltip Hover */}
              <div className="opacity-0 group-hover/bar:opacity-100 transition-opacity bg-slate-950 border border-slate-700 text-white text-[11px] rounded-xl p-2.5 absolute -top-20 z-30 pointer-events-none shadow-2xl whitespace-nowrap space-y-0.5">
                <div className="font-bold text-cyan-300">{item.fullDate || item.date}</div>
                <div>Doanh thu vé: <strong>{formatCurrency(item.ticketRevenue || 0)}</strong></div>
                <div>Doanh thu bắp nước: <strong>{formatCurrency(item.concessionRevenue || 0)}</strong></div>
                <div className="border-t border-[var(--border-default)] pt-0.5 text-emerald-400">
                  Doanh thu thuần: <strong>{formatCurrency(rev)}</strong> ({formatNumber(item.tickets || 0)} vé)
                </div>
                {showExpenseOverlay && (
                  <div className="text-rose-400">
                    Chi phí: <strong>{formatCurrency(exp)}</strong> • Lợi nhuận: <strong>{formatCurrency(rev - exp)}</strong>
                  </div>
                )}
              </div>

              {/* Cột Bar phân tầng */}
              <div className="w-full max-w-[32px] h-full flex items-end justify-center gap-0.5">
                <div className="w-full h-full flex flex-col justify-end rounded-t-lg overflow-hidden bg-[var(--bg-surface)]/30">
                  {concessionHeight > 0 && (
                    <div
                      style={{ height: `${concessionHeight}%` }}
                      className="w-full bg-amber-400 hover:bg-amber-300 transition-all"
                    ></div>
                  )}
                  {ticketHeight > 0 ? (
                    <div
                      style={{ height: `${ticketHeight}%` }}
                      className="w-full bg-gradient-to-t from-violet-600 to-cyan-400 hover:from-violet-500 hover:to-cyan-300 transition-all rounded-t-sm"
                    ></div>
                  ) : (
                    <div style={{ height: '2px' }} className="w-full bg-slate-800"></div>
                  )}
                </div>

                {showExpenseOverlay && expPct > 0 && (
                  <div className="w-2.5 h-full flex flex-col justify-end rounded-t overflow-hidden bg-slate-900/30">
                    <div
                      style={{ height: `${expPct}%` }}
                      className="w-full bg-rose-500 rounded-t"
                    ></div>
                  </div>
                )}
              </div>

              {/* Nhãn ngày trục X */}
              <span className="text-[9px] text-slate-400 font-semibold mt-1.5 truncate max-w-[40px] block text-center">
                {item.date}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend Chú giải */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-3 border-t border-[var(--border-default)]/80">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400"></span>
            <span>Vé xem phim</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>
            <span>Bắp nước & Combo</span>
          </span>
          {showExpenseOverlay && (
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
              <span>Chi phí phát sinh</span>
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500">Đơn vị: VNĐ • Múi giờ chuẩn Asia/Ho_Chi_Minh</span>
      </div>
    </div>
  );
};

export default RevenueChart;
