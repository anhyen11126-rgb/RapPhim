import React, { useState } from 'react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const SORT_OPTIONS = [
  { value: 'ticketsSold:desc', label: 'Bán nhiều vé nhất' },
  { value: 'occupancyRate:desc', label: 'Tỷ lệ lấp đầy cao nhất' },
  { value: 'revenue:desc', label: 'Doanh thu cao nhất' },
  { value: 'profit:desc', label: 'Lợi nhuận cao nhất' },
  { value: 'showtimesCount:desc', label: 'Nhiều suất chiếu nhất' },
  { value: 'lowestPerformance:asc', label: 'Hiệu suất thấp nhất' },
];

const MoviesTab = ({
  moviesData,
  loading,
  error,
  onRetry,
  onSelectMovie,
  onPageChange,
  onSearch,
  onSortChange,
  currentSort = 'ticketsSold:desc',
}) => {
  const [viewMode, setViewMode] = useState('tickets'); // 'tickets' (Tỷ lệ bán vé & Công suất) | 'financial' (Doanh thu, Chi phí & Lợi nhuận)
  const [searchInput, setSearchInput] = useState('');

  if (!loading && error) {
    return (
      <div
        role="alert"
        className="bg-rose-950/40 border border-rose-500/40 rounded-3xl p-8 text-center space-y-4 shadow-xl"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-2xl">
          ⚠️
        </div>
        <h3 className="text-base sm:text-lg font-bold text-white">Không tải được thống kê hiệu suất phim</h3>
        <p className="text-xs text-rose-200/80 max-w-md mx-auto">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl cinema-action text-white text-xs font-bold shadow-lg cursor-pointer"
          >
            Thử lại ngay
          </button>
        )}
      </div>
    );
  }

  const items = moviesData?.items || [];
  const allActiveMovies = moviesData?.allActiveMovies || items.filter((m) => m.showtimesCount > 0 || m.ticketsSold > 0);
  const total = moviesData?.total || 0;
  const page = moviesData?.page || 1;
  const totalPages = moviesData?.totalPages || 1;
  const rankings = moviesData?.rankings || {};
  const summary = moviesData?.summary || {};

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchInput);
  };

  const renderPerformanceBadge = (m) => {
    if (m.performanceStatus === 'HIGH') {
      return (
        <span className="inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/70 text-emerald-400 border-emerald-500/40">
          {m.performanceLabel}
        </span>
      );
    }
    if (m.performanceStatus === 'MEDIUM') {
      return (
        <span className="inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-cyan-950/70 text-cyan-300 border-cyan-500/40">
          {m.performanceLabel}
        </span>
      );
    }
    if (m.performanceStatus === 'LOW') {
      return (
        <span className="inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-950/70 text-amber-300 border-amber-500/40">
          {m.performanceLabel}
        </span>
      );
    }
    if (m.performanceStatus === 'ZERO_SALES') {
      return (
        <span className="inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-950/70 text-rose-300 border-rose-500/40">
          {m.performanceLabel}
        </span>
      );
    }
    return (
      <span className="inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/80 text-slate-400 border-slate-700">
        {m.performanceLabel || 'Chưa có suất chiếu'}
      </span>
    );
  };

  const renderProfitBadge = (m) => {
    if (!m.hasExpenseData || m.profitStatus === 'INSUFFICIENT_DATA') {
      return (
        <span className="inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-950/70 text-amber-300 border-amber-500/40">
          Chưa đủ dữ liệu tính lợi nhuận
        </span>
      );
    }
    if (m.profitStatus === 'PROFIT') {
      return (
        <span className="inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/70 text-emerald-400 border-emerald-500/40">
          Có lãi
        </span>
      );
    }
    if (m.profitStatus === 'BREAKEVEN') {
      return (
        <span className="inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-cyan-950/70 text-cyan-300 border-cyan-500/40">
          Hòa vốn
        </span>
      );
    }
    return (
      <span className="inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-950/70 text-rose-400 border-rose-500/40">
        Thua lỗ
      </span>
    );
  };

  const maxActiveSellable = Math.max(...allActiveMovies.map((m) => m.totalSellableSeats || 0), 1);

  return (
    <div className="space-y-6">
      {/* 1. DÃY 6 THẺ XẾP HẠNG TỔNG KẾT (RANKINGS - ĐÁP ỨNG MỤC VI & VII) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        {/* Phim bán nhiều vé nhất */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Bán nhiều vé nhất</span>
            <span className="text-sm">🎟️</span>
          </div>
          {rankings.topSold?.transactionTicketsSold > 0 ? (
            <div
              onClick={rankings.topSold.tieCount > 1 ? undefined : () => onSelectMovie?.(rankings.topSold.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 line-clamp-2">
                {rankings.topSold.tieCount > 1 ? `${rankings.topSold.tieCount} phim đồng hạng` : rankings.topSold.title}
              </h5>
              <div className="text-sm font-black text-cyan-300 mt-1">
                {formatNumber(rankings.topSold.transactionTicketsSold)} vé giao dịch
              </div>
              {!(rankings.topSold.tieCount > 1) && (
              <span className="text-[10px] text-slate-500">
                Lấp đầy: {rankings.topSold.occupancyRate}% ({rankings.topSold.showtimesCount} suất)
              </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-500">Chưa có phim hoạt động</span>
          )}
        </div>

        {/* Phim có tỷ lệ lấp đầy cao nhất */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Lấp đầy cao nhất</span>
            <span className="text-sm">🌟</span>
          </div>
          {rankings.topOccupancy?.occupancyRate > 0 ? (
            <div
              onClick={rankings.topOccupancy.tieCount > 1 ? undefined : () => onSelectMovie?.(rankings.topOccupancy.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 line-clamp-2">
                {rankings.topOccupancy.tieCount > 1 ? `${rankings.topOccupancy.tieCount} phim đồng hạng` : rankings.topOccupancy.title}
              </h5>
              <div className="text-sm font-black text-amber-400 mt-1">
                {rankings.topOccupancy.occupancyRate}%
              </div>
              {!(rankings.topOccupancy.tieCount > 1) && (
              <span className="text-[10px] text-slate-500">
                {formatNumber(rankings.topOccupancy.showtimeBookedSeats)} vé / {formatNumber(rankings.topOccupancy.totalSellableSeats)} ghế
              </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-500">Chưa có dữ liệu</span>
          )}
        </div>

        {/* Phim doanh thu cao nhất */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Doanh thu cao nhất</span>
            <span className="text-sm">💳</span>
          </div>
          {rankings.topRevenue?.revenue > 0 ? (
            <div
              onClick={rankings.topRevenue.tieCount > 1 ? undefined : () => onSelectMovie?.(rankings.topRevenue.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 line-clamp-2">
                {rankings.topRevenue.tieCount > 1 ? `${rankings.topRevenue.tieCount} phim đồng hạng` : rankings.topRevenue.title}
              </h5>
              <div className="text-sm font-black text-emerald-400 mt-1 whitespace-nowrap">
                {rankings.topRevenue.revenueFormatted}
              </div>
              {!(rankings.topRevenue.tieCount > 1) && (
              <span className="text-[10px] text-slate-500">
                {formatNumber(rankings.topRevenue.ticketsSold)} vé đã bán
              </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-500">Chưa có doanh thu</span>
          )}
        </div>

        {/* Phim sinh lời tốt nhất */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Sinh lời tốt nhất</span>
            <span className="text-sm">💰</span>
          </div>
          {rankings.topProfit ? (
            <div
              onClick={() => onSelectMovie && onSelectMovie(rankings.topProfit.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 line-clamp-2">
                {rankings.topProfit.title}
              </h5>
              <div
                className={`text-sm font-black mt-1 whitespace-nowrap ${
                  (rankings.topProfit.profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {rankings.topProfit.profitFormatted}
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">
                Biên LN: {rankings.topProfit.profitMargin ?? '—'}%
              </span>
            </div>
          ) : (
            <div>
              <span className="text-xs font-bold text-amber-300">Chưa đủ dữ liệu</span>
              <p className="text-[10px] text-slate-500 mt-1">Cần nhập chi phí phim/rạp</p>
            </div>
          )}
        </div>

        {/* Phim bán chậm nhất (trong nhóm có suất chiếu) */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Bán chậm nhất</span>
            <span className="text-sm">📉</span>
          </div>
          {rankings.lowestSold ? (
            <div
              onClick={rankings.lowestSold.tieCount > 1 ? undefined : () => onSelectMovie?.(rankings.lowestSold.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 line-clamp-2">
                {rankings.lowestSold.tieCount > 1 ? `${rankings.lowestSold.tieCount} phim đồng hạng` : rankings.lowestSold.title}
              </h5>
              <div className="text-sm font-bold text-slate-300 mt-1">
                {formatNumber(rankings.lowestSold.ticketsSold)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">vé</span>
              </div>
              {!(rankings.lowestSold.tieCount > 1) && (
              <span className="text-[10px] text-slate-500">
                Lấp đầy: {rankings.lowestSold.occupancyRate}% ({rankings.lowestSold.showtimesCount} suất)
              </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>

        {/* Phim bị lỗ hoặc trạng thái chi phí */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Cảnh báo Lỗ / Chi phí</span>
            <span className="text-sm">⚠️</span>
          </div>
          {!moviesData?.hasExpenseData ? (
            <div>
              <span className="text-xs font-bold text-amber-300">Chưa đủ dữ liệu</span>
              <p className="text-[10px] text-slate-500 mt-1">Chưa ghi nhận chi phí kỳ này</p>
            </div>
          ) : rankings.topLoss ? (
            <div
              onClick={() => onSelectMovie && onSelectMovie(rankings.topLoss.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 line-clamp-2">
                {rankings.topLoss.title}
              </h5>
              <div className="text-sm font-bold text-rose-400 mt-1 whitespace-nowrap">
                {rankings.topLoss.profitFormatted}
              </div>
              <span className="text-[10px] text-rose-400 font-bold">{rankings.topLoss.statusLabel}</span>
            </div>
          ) : (
            <div>
              <span className="text-xs font-bold text-emerald-400">Không có phim lỗ</span>
              <p className="text-[10px] text-slate-500 mt-1">Các phim có chi phí đều dương</p>
            </div>
          )}
        </div>
      </div>

      {/* 2. BIỂU ĐỒ TRỰC QUAN TỶ LỆ BÁN VÉ & SO SÁNH GHẾ ĐÃ BÁN VS GHẾ CHƯA BÁN TỪNG PHIM (MỤC IX.2) */}
      {!loading && allActiveMovies.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Biểu đồ thanh ngang tỷ lệ bán vé của từng phim (6 cols) */}
          <div className="lg:col-span-6 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Biểu Đồ Tỷ Lệ Bán Vé Từng Bộ Phim (%)</h3>
                <p className="text-xs text-slate-400">
                  Tỷ lệ lấp đầy = Số vé đã bán / Tổng ghế mở bán của các suất chiếu trong kỳ
                </p>
              </div>
              <span className="text-xs font-bold text-cyan-300">
                TB toàn rạp: {summary.overallOccupancyRate || 0}%
              </span>
            </div>

            <div className="space-y-3.5">
              {allActiveMovies.slice(0, 8).map((m) => (
                <div
                  key={m.id}
                  onClick={() => onSelectMovie && onSelectMovie(m.id)}
                  className="space-y-1.5 cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white group-hover:text-cyan-300 line-clamp-2 max-w-[240px]">
                      {m.title} ({m.showtimesCount} suất)
                    </span>
                    <span className="font-mono text-slate-300">
                      <strong className="text-cyan-300">{m.occupancyRate}%</strong> ({formatNumber(m.showtimeBookedSeats)} /{' '}
                      {formatNumber(m.totalSellableSeats)} ghế)
                    </span>
                  </div>
                  <div className="h-2.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(m.showtimeBookedSeats > 0 ? 4 : 0, m.occupancyRate))}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Biểu đồ so sánh Ghế đã bán vs Ghế không bán được (Đã chiếu) vs Ghế còn trống (Sắp chiếu) (6 cols) */}
          <div className="lg:col-span-6 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Cơ Cấu Ghế Mở Bán Theo Từng Bộ Phim</h3>
                <p className="text-xs text-slate-400">
                  Ghế đã bán, đang giữ, trống đã đóng bán và còn đặt được
                </p>
              </div>
              <span className="text-xs font-bold text-violet-400">
                Tổng: {formatNumber(summary.totalSellableSeats || 0)} ghế
              </span>
            </div>

            <div className="space-y-3.5">
              {allActiveMovies.slice(0, 8).map((m) => {
                const widthRatio = Math.max(15, Math.round(((m.totalSellableSeats || 0) / maxActiveSellable) * 100));
                const segments = [
                  { label: 'Đã bán', seats: m.showtimeBookedSeats, color: 'bg-cyan-400' },
                  { label: 'Đang giữ', seats: m.holdingSeats, color: 'bg-amber-500' },
                  { label: 'Đóng bán', seats: m.closedUnsoldSeats, color: 'bg-slate-600' },
                  { label: 'Còn đặt được', seats: m.upcomingAvailableSeats, color: 'bg-emerald-500/50' },
                ];
                return (
                  <div key={m.id} className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-bold text-white">{m.title}</span>
                      <div className="flex flex-wrap gap-x-2 text-[11px] text-slate-300">
                        {segments.map(({ label, seats, color }) => <span key={label} className="inline-flex items-center gap-1"><i className={`h-2 w-2 rounded-full ${color}`} />{label}: {formatNumber(seats)}</span>)}
                      </div>
                    </div>
                    <div style={{ width: `${widthRatio}%` }}
                      className="h-2.5 bg-[var(--bg-surface)] rounded-full overflow-hidden flex">
                      {segments.map(({ label, seats, color }) => (
                        <div key={label} className={color} title={`${label}: ${seats} ghế`}
                          style={{ width: `${m.totalSellableSeats ? (seats / m.totalSellableSeats) * 100 : 0}%` }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[var(--border-default)] text-[11px] text-slate-400">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400"></span>
                <span>Ghế đã bán ({formatNumber(summary.totalTicketsSold || 0)})</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-600"></span>
                <span>Không bán được - Đã chiếu ({formatNumber(summary.totalCompletedUnsoldSeats || 0)})</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60"></span>
                <span>Còn có thể đặt - Sắp chiếu ({formatNumber(summary.totalUpcomingAvailableSeats || 0)})</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. BẢNG HIỆU SUẤT TỪNG PHIM (CHUYỂN ĐỔI GIỮA BẢNG TỶ LỆ BÁN VÉ & BẢNG LỢI NHUẬN PHIM) */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-5 shadow-xl">
        {/* Header bảng, Bộ sắp xếp & Nút chuyển đổi chế độ */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[var(--border-default)]/80 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {viewMode === 'tickets'
                  ? 'Bảng Thống Kê Tỷ Lệ Bán Vé & Công Suất Từng Bộ Phim'
                  : 'Bảng Phân Tích Doanh Thu, Chi Phí & Lợi Nhuận Từng Bộ Phim'}
              </h3>
              <p className="text-xs text-slate-400">
                {viewMode === 'tickets'
                  ? 'Bấm vào một bộ phim bất kỳ để mở Drawer xem danh sách từng suất chiếu, phòng chiếu và ghế đã bán'
                  : 'Đối soát doanh thu vé, bắp nước, chi phí bản quyền trực tiếp, chi phí vận hành phân bổ, lợi nhuận, Biên LN và ROI'}
              </p>
            </div>

            {/* Nút Toggle 2 Chế Độ */}
            <div className="bg-[var(--bg-surface)] p-1 rounded-xl flex items-center space-x-1 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('tickets')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'tickets' ? 'cinema-action text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🎟️</span>
                <span>Tỷ lệ bán vé & Công suất</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('financial')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'financial' ? 'cinema-action text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>💰</span>
                <span>Doanh thu, Chi phí & Lợi nhuận</span>
              </button>
            </div>
          </div>

          {/* Bộ sắp xếp & Thanh tìm kiếm phim */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center space-x-1.5 bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-400">Sắp xếp:</span>
              <select
                aria-label="Sắp xếp danh sách phim"
                value={currentSort}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split(':');
                  if (onSortChange) onSortChange(sortBy, sortOrder, e.target.value);
                }}
                className="bg-transparent text-white font-semibold outline-none cursor-pointer text-xs"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[var(--bg-secondary)] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Tìm tên tác phẩm..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 w-44 sm:w-52"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 cinema-action text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
              >
                Tìm
              </button>
            </form>
          </div>
        </div>

        {/* CHẾ ĐỘ 1: BẢNG TỶ LỆ BÁN VÉ & CÔNG SUẤT TỪNG PHIM (MỤC VI.2) */}
        {viewMode === 'tickets' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-2.5 text-center">STT</th>
                  <th className="py-3 px-3 min-w-[220px]">Bộ phim & Thể loại</th>
                  <th className="py-3 px-2.5 text-center">Số suất chiếu</th>
                  <th className="py-3 px-2.5 text-center">Tổng ghế mở bán</th>
                  <th className="py-3 px-2.5 text-center font-bold text-cyan-300">Vé giao dịch</th>
                  <th className="py-3 px-2.5 text-center">Ghế trống</th>
                  <th className="py-3 px-2.5 text-center">Suất cháy vé</th>
                  <th className="py-3 px-3 min-w-[140px]">Tỷ lệ lấp đầy (%)</th>
                  <th className="py-3 px-3 text-right">Doanh thu</th>
                  <th className="py-3 px-2.5 text-center">Xếp hạng</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  <th className="py-3 px-2.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan="12" className="py-16 text-center">
                      <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <span className="text-slate-400 text-xs">Đang nạp dữ liệu thống kê phim...</span>
                    </td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((m, idx) => {
                    const isHot = m.occupancyRate >= 65;
                    const stt = (page - 1) * 20 + idx + 1;
                    return (
                      <tr key={m.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                        <td className="py-3 px-2.5 text-center font-mono text-slate-400">{stt}</td>

                        {/* Poster, Tên phim, Thể loại */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-3">
                            <img
                              src={m.poster || undefined}
                              alt={m.title}
                              className="w-10 h-14 rounded-lg object-cover shrink-0 border border-slate-700 shadow"
                              onError={(e) => {
                                e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-1.5 mb-0.5">
                                <span className="bg-violet-500/20 text-violet-300 border border-violet-500/40 text-[9px] font-black px-1.5 py-0.5 rounded">
                                  {m.ageRating}
                                </span>
                                <span className="text-[10px] text-slate-400">{m.duration} phút</span>
                              </div>
                              <h4
                                onClick={() => onSelectMovie && onSelectMovie(m.id)}
                                className="text-xs font-bold text-white hover:text-cyan-300 cursor-pointer transition-colors line-clamp-2"
                              >
                                {m.title}
                              </h4>
                              <span className="text-[10px] text-slate-400 block truncate">{m.genre}</span>
                            </div>
                          </div>
                        </td>

                        {/* Số suất chiếu (Đã chiếu / Sắp chiếu) */}
                        <td className="py-3 px-2.5 text-center">
                          <strong className="text-white block">{formatNumber(m.showtimesCount)} suất</strong>
                          {m.showtimesCount > 0 && (
                            <span className="text-[10px] text-slate-400 block">
                              Đã chiếu: {m.screenedShowtimesCount || 0} • Sắp: {m.upcomingShowtimesCount || 0}
                            </span>
                          )}
                        </td>

                        {/* Tổng ghế mở bán */}
                        <td className="py-3 px-2.5 text-center font-semibold text-slate-200">
                          {formatNumber(m.totalSellableSeats)}
                        </td>

                        {/* Số vé đã bán */}
                        <td className="py-3 px-2.5 text-center font-black text-cyan-300 text-sm">
                          {formatNumber(m.transactionTicketsSold)}
                          <span className="block text-[10px] font-normal text-slate-400">Ghế đã đặt: {formatNumber(m.showtimeBookedSeats)}</span>
                        </td>

                        {/* Số ghế chưa bán (Tách rõ Đã chiếu không bán được vs Sắp chiếu còn đặt được) */}
                        <td className="py-3 px-2.5 text-center">
                          <strong className="text-slate-300 block">{formatNumber(m.availableSeats)}</strong>
                          {m.showtimesCount > 0 && (
                            <span className="text-[10px] text-slate-500 block">
                              Đóng bán: {formatNumber(m.closedUnsoldSeats)} • Còn mở: {formatNumber(m.upcomingAvailableSeats)}
                            </span>
                          )}
                        </td>

                        {/* Suất cháy vé (Sold Out) */}
                        <td className="py-3 px-2.5 text-center">
                          <strong className={m.soldOutShowtimesCount > 0 ? 'text-amber-400' : 'text-slate-400'}>
                            {formatNumber(m.soldOutShowtimesCount || 0)}
                          </strong>
                          <span className="text-[10px] text-slate-500 block">({m.soldOutRate || 0}%)</span>
                        </td>

                        {/* Tỷ lệ lấp đầy (%) — Phân biệt rõ Toàn kỳ / Suất đã chiếu / Suất sắp chiếu */}
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <strong className={isHot ? 'text-amber-400 font-black' : 'text-cyan-300 font-bold'}>
                                {m.occupancyRate}%
                              </strong>
                              <span className="text-[9px] text-slate-500">
                                {formatNumber(m.ticketsSold)}/{formatNumber(m.totalSellableSeats)}
                              </span>
                            </div>
                            <div className="h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  isHot ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-cyan-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(m.showtimeBookedSeats > 0 ? 4 : 0, m.occupancyRate))}%` }}
                              ></div>
                            </div>
                            <div className="text-[9px] text-slate-400 flex items-center justify-between">
                              <span>Đã chiếu: {m.completedOccupancyRate ?? 0}%</span>
                              <span>Sắp chiếu: {m.upcomingOccupancyRate ?? 0}%</span>
                            </div>
                          </div>
                        </td>

                        {/* Doanh thu */}
                        <td className="py-3 px-3 text-right font-black text-emerald-400">
                          {m.revenueFormatted}
                        </td>

                        {/* Xếp hạng bán chạy */}
                        <td className="py-3 px-2.5 text-center">
                          {m.showtimesCount > 0 || m.ticketsSold > 0 ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-bold text-white">
                              {m.salesRank ? `#${m.salesRank}` : '—'}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Trạng thái hiệu suất */}
                        <td className="py-3 px-3 text-center">{renderPerformanceBadge(m)}</td>

                        {/* Thao tác */}
                        <td className="py-3 px-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectMovie && onSelectMovie(m.id)}
                            className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-violet-600 hover:text-white text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                          >
                            Suất chiếu
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="12" className="py-12 text-center text-slate-500">
                      Không tìm thấy bộ phim nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* CHẾ ĐỘ 2: BẢNG DOANH THU, CHI PHÍ & LỢI NHUẬN TỪNG PHIM (MỤC VII.4) */}
        {viewMode === 'financial' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-3 min-w-[200px]">Bộ phim</th>
                  <th className="py-3 px-2 text-center">Số vé bán</th>
                  <th className="py-3 px-3 text-right">Doanh thu vé</th>
                  <th className="py-3 px-3 text-right text-amber-300">Doanh thu bắp nước</th>
                  <th className="py-3 px-3 text-right font-black text-emerald-400">Doanh thu thuần</th>
                  <th className="py-3 px-3 text-right text-rose-300">Chi phí bản quyền & TT</th>
                  <th className="py-3 px-3 text-right text-amber-300">Chi phí vận hành phân bổ</th>
                  <th className="py-3 px-3 text-right font-bold text-rose-400">Tổng chi phí</th>
                  <th className="py-3 px-3 text-right font-black text-white">Lợi nhuận</th>
                  <th className="py-3 px-2 text-center">Biên LN</th>
                  <th className="py-3 px-2 text-center">ROI</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  <th className="py-3 px-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan="13" className="py-16 text-center">
                      <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <span className="text-slate-400 text-xs">Đang tải phân tích tài chính phim...</span>
                    </td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((m) => {
                    const isProfitable = (m.profit || 0) >= 0;
                    return (
                      <tr key={m.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-3">
                            <img
                              src={m.poster || undefined}
                              alt={m.title}
                              className="w-9 h-12 rounded-lg object-cover shrink-0 border border-slate-700 shadow"
                              onError={(e) => {
                                e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                              }}
                            />
                            <div className="min-w-0">
                              <h4
                                onClick={() => onSelectMovie && onSelectMovie(m.id)}
                                className="text-xs font-bold text-white hover:text-cyan-300 cursor-pointer transition-colors line-clamp-2"
                              >
                                {m.title}
                              </h4>
                              <span className="text-[10px] text-slate-400 block">
                                {m.showtimesCount} suất chiếu ({m.allocationSharePercent == null ? '—' : `${m.allocationSharePercent}%`} phân bổ)
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center font-bold text-cyan-300">
                          {formatNumber(m.transactionTicketsSold)}
                          <span className="block text-[10px] font-normal text-slate-400">Ghế đã đặt: {formatNumber(m.showtimeBookedSeats)}</span>
                        </td>

                        <td className="py-3 px-3 text-right text-slate-300">
                          {m.ticketRevenueFormatted || formatCurrency(m.ticketRevenue || 0)}
                        </td>

                        <td className="py-3 px-3 text-right text-amber-300">
                          {m.concessionRevenueFormatted || formatCurrency(m.concessionRevenue || 0)}
                        </td>

                        <td className="py-3 px-3 text-right font-black text-emerald-400">
                          {m.revenueFormatted}
                        </td>

                        <td className="py-3 px-3 text-right text-rose-300 font-semibold">
                          {m.directExpensesFormatted}
                        </td>

                        <td className="py-3 px-3 text-right text-amber-300 font-semibold">
                          {m.allocatedExpensesFormatted}
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-rose-400">
                          {m.totalExpensesFormatted}
                        </td>

                        <td
                          className={`py-3 px-3 text-right font-black ${
                            !m.hasExpenseData
                              ? 'text-amber-300'
                              : isProfitable
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {m.profitFormatted}
                        </td>

                        <td className="py-3 px-2 text-center font-bold">
                          {m.hasExpenseData && m.profitMargin != null ? `${m.profitMargin}%` : '—'}
                        </td>

                        <td className="py-3 px-2 text-center font-bold">
                          {m.hasExpenseData && m.roi != null ? `${m.roi}%` : '—'}
                        </td>

                        <td className="py-3 px-3 text-center">{renderProfitBadge(m)}</td>

                        <td className="py-3 px-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectMovie && onSelectMovie(m.id)}
                            className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-violet-600 hover:text-white text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="13" className="py-12 text-center text-slate-500">
                      Không tìm thấy dữ liệu tài chính phim.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-default)] text-xs text-slate-400">
            <span>
              Trang {page} / {totalPages} (Tổng {total} phim)
            </span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => onPageChange && onPageChange(page - 1)}
                className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPageChange && onPageChange(i + 1)}
                  className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                    page === i + 1 ? 'cinema-action text-white' : 'bg-[var(--bg-surface)] text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => onPageChange && onPageChange(page + 1)}
                className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoviesTab;
