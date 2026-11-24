import React, { useState } from 'react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const MoviesTab = ({ moviesData, loading, onSelectMovie, onPageChange, onSearch, onSort }) => {
  const [viewMode, setViewMode] = useState('tickets'); // 'tickets' (Yêu cầu 2) | 'financial' (Yêu cầu 3)
  const [searchInput, setSearchInput] = useState('');

  const items = moviesData?.items || [];
  const total = moviesData?.total || 0;
  const page = moviesData?.page || 1;
  const totalPages = moviesData?.totalPages || 1;
  const rankings = moviesData?.rankings || {};
  const summary = moviesData?.summary || {};

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchInput);
  };

  return (
    <div className="space-y-6">
      {/* 1. DÃY 5 THẺ XẾP HẠNG TỔNG KẾT (RANKINGS - ĐÁP ỨNG TRỌN VẸN YÊU CẦU 2 & 3 CỦA GIẢNG VIÊN) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        {/* Phim bán nhiều vé nhất */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Bán nhiều vé nhất</span>
            <span className="text-sm">🎟️</span>
          </div>
          {rankings.topSold ? (
            <div
              onClick={() => onSelectMovie && onSelectMovie(rankings.topSold.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-red-400 truncate">
                {rankings.topSold.title}
              </h5>
              <div className="text-sm font-black text-emerald-400 mt-1">
                {formatNumber(rankings.topSold.ticketsSold)} <span className="text-[10px] text-slate-400 font-normal">vé</span>
              </div>
              <span className="text-[10px] text-slate-500">Lấp đầy: {rankings.topSold.occupancyRate}%</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>

        {/* Phim có tỷ lệ lấp đầy cao nhất */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Lấp đầy cao nhất</span>
            <span className="text-sm">🌟</span>
          </div>
          {rankings.topOccupancy ? (
            <div
              onClick={() => onSelectMovie && onSelectMovie(rankings.topOccupancy.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-red-400 truncate">
                {rankings.topOccupancy.title}
              </h5>
              <div className="text-sm font-black text-amber-400 mt-1">
                {rankings.topOccupancy.occupancyRate}%
              </div>
              <span className="text-[10px] text-slate-500">{formatNumber(rankings.topOccupancy.ticketsSold)} vé đã bán</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>

        {/* Phim doanh thu cao nhất */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Doanh thu cao nhất</span>
            <span className="text-sm">💳</span>
          </div>
          {rankings.topRevenue ? (
            <div
              onClick={() => onSelectMovie && onSelectMovie(rankings.topRevenue.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-red-400 truncate">
                {rankings.topRevenue.title}
              </h5>
              <div className="text-sm font-black text-emerald-400 mt-1 truncate">
                {rankings.topRevenue.revenueFormatted}
              </div>
              <span className="text-[10px] text-slate-500">{formatNumber(rankings.topRevenue.ticketsSold)} vé bán</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">—</span>
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
              <h5 className="text-xs font-bold text-white group-hover:text-red-400 truncate">
                {rankings.topProfit.title}
              </h5>
              <div className="text-sm font-black text-emerald-400 mt-1 truncate">
                {rankings.topProfit.profitFormatted}
              </div>
              <span className="text-[10px] text-emerald-500/80 font-bold">Biên LN: {rankings.topProfit.profitMargin}%</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>

        {/* Phim bán chậm nhất */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Bán chậm nhất</span>
            <span className="text-sm">📉</span>
          </div>
          {rankings.lowestSold ? (
            <div
              onClick={() => onSelectMovie && onSelectMovie(rankings.lowestSold.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-red-400 truncate">
                {rankings.lowestSold.title}
              </h5>
              <div className="text-sm font-bold text-slate-300 mt-1">
                {formatNumber(rankings.lowestSold.ticketsSold)} <span className="text-[10px] text-slate-400 font-normal">vé</span>
              </div>
              <span className="text-[10px] text-slate-500">Lấp đầy: {rankings.lowestSold.occupancyRate}%</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>

        {/* Phim bị lỗ hoặc LN thấp nhất */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>Cần chú ý / Lỗ</span>
            <span className="text-sm">⚠️</span>
          </div>
          {rankings.topLoss ? (
            <div
              onClick={() => onSelectMovie && onSelectMovie(rankings.topLoss.id)}
              className="cursor-pointer group"
            >
              <h5 className="text-xs font-bold text-white group-hover:text-red-400 truncate">
                {rankings.topLoss.title}
              </h5>
              <div className="text-sm font-bold text-rose-400 mt-1 truncate">
                {rankings.topLoss.profitFormatted}
              </div>
              <span className="text-[10px] text-rose-500 font-bold">{rankings.topLoss.statusLabel}</span>
            </div>
          ) : (
            <div>
              <span className="text-xs font-bold text-emerald-400">100% Phim Có Lãi</span>
              <p className="text-[10px] text-slate-500 mt-1">Không có tác phẩm nào bị lỗ</p>
            </div>
          )}
        </div>
      </div>

      {/* 2. BẢNG HIỆU SUẤT TỪNG PHIM (CHUYỂN ĐỔI GIỮA YÊU CẦU 2 VÀ YÊU CẦU 3) */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-5 shadow-xl">
        {/* Header bảng & Nút chuyển đổi chế độ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-default)]/80 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {viewMode === 'tickets' ? 'Bảng Thống Kê Tỷ Lệ Bán Vé Từng Phim' : 'Bảng Doanh Thu & Lợi Nhuận Từng Phim'}
              </h3>
              <p className="text-xs text-slate-400">
                {viewMode === 'tickets'
                  ? 'Theo dõi số vé đã bán, ghế còn trống và tỷ lệ lấp đầy bình quân từng tác phẩm'
                  : 'Báo cáo chi tiết doanh thu, chi phí trực tiếp, chi phí phân bổ và lãi/lỗ của từng phim'}
              </p>
            </div>

            {/* Nút Toggle 2 Chế Độ Đáp Ứng Yêu Cầu 2 & Yêu Cầu 3 */}
            <div className="bg-[var(--bg-surface)] p-1 rounded-xl flex items-center space-x-1 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('tickets')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'tickets' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🎟️</span>
                <span>Tỷ lệ bán vé (Yêu cầu 2)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('financial')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'financial' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>💰</span>
                <span>Doanh thu & Lợi nhuận (Yêu cầu 3)</span>
              </button>
            </div>
          </div>

          {/* Thanh tìm kiếm phim */}
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Tìm tên tác phẩm..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 w-48 sm:w-56"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
            >
              Tìm
            </button>
          </form>
        </div>

        {/* CHẾ ĐỘ 1: BẢNG TỶ LỆ BÁN VÉ TỪNG PHIM (YÊU CẦU 2 CỦA GIẢNG VIÊN) */}
        {viewMode === 'tickets' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4 min-w-[220px]">Tác phẩm điện ảnh</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  <th className="py-3 px-3 text-center">Suất chiếu</th>
                  <th className="py-3 px-3 text-center font-bold text-white">Vé đã bán</th>
                  <th className="py-3 px-3 text-center">Ghế còn trống</th>
                  <th className="py-3 px-3 text-center">Tổng ghế mở bán</th>
                  <th className="py-3 px-4 min-w-[140px]">Tỷ lệ bán vé (%)</th>
                  <th className="py-3 px-4 text-right">Doanh thu thuần</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-16 text-center">
                      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <span className="text-slate-400 text-xs">Đang nạp dữ liệu phim...</span>
                    </td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((m) => {
                    const isHot = m.occupancyRate >= 70;
                    return (
                      <tr key={m.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                        {/* Cột 1: Poster & Tên phim */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={m.poster}
                              alt={m.title}
                              className="w-10 h-14 rounded-lg object-cover shrink-0 border border-slate-700 shadow"
                              onError={(e) => {
                                e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-1.5 mb-1">
                                <span className="bg-red-600/20 text-red-400 border border-red-500/40 text-[9px] font-black px-1.5 py-0.5 rounded">
                                  {m.ageRating}
                                </span>
                                <span className="text-[10px] text-slate-400">{m.duration}'</span>
                                <span className="text-amber-400 text-[10px] font-bold">★ {m.rating}</span>
                              </div>
                              <h4
                                onClick={() => onSelectMovie && onSelectMovie(m.id)}
                                className="text-xs font-bold text-white hover:text-red-400 cursor-pointer transition-colors truncate"
                              >
                                {m.title}
                              </h4>
                              <span className="text-[10px] text-slate-400 block truncate">{m.genre}</span>
                            </div>
                          </div>
                        </td>

                        {/* Trạng thái */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              m.status === 'NOW_SHOWING'
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                                : m.status === 'COMING_SOON'
                                ? 'bg-amber-950/60 text-amber-400 border-amber-500/30'
                                : 'bg-[var(--bg-surface)] text-slate-400 border-slate-700'
                            }`}
                          >
                            {m.status === 'NOW_SHOWING' ? 'Đang chiếu' : m.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đã kết thúc'}
                          </span>
                        </td>

                        {/* Suất chiếu */}
                        <td className="py-3 px-3 text-center font-bold text-slate-200">
                          {formatNumber(m.showtimesCount)}
                        </td>

                        {/* Vé đã bán (Phim bán được bao nhiêu vé) */}
                        <td className="py-3 px-3 text-center font-black text-white text-sm">
                          {formatNumber(m.ticketsSold)}
                        </td>

                        {/* Ghế còn trống (Phim còn bao nhiêu ghế trống) */}
                        <td className="py-3 px-3 text-center text-slate-400 font-semibold">
                          {formatNumber(m.availableSeats)}
                        </td>

                        {/* Tổng số vé có thể bán */}
                        <td className="py-3 px-3 text-center text-slate-300 font-medium">
                          {formatNumber(m.totalSellableSeats)}
                        </td>

                        {/* Tỷ lệ bán vé (%) */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <strong className={isHot ? 'text-amber-400 font-black' : 'text-slate-300 font-bold'}>
                                {m.occupancyRate}%
                              </strong>
                              <span className="text-[9px] text-slate-500">
                                {formatNumber(m.ticketsSold)}/{formatNumber(m.totalSellableSeats)}
                              </span>
                            </div>
                            <div className="h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  isHot ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-red-600'
                                }`}
                                style={{ width: `${Math.min(100, m.occupancyRate)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* Doanh thu */}
                        <td className="py-3 px-4 text-right font-black text-emerald-400">
                          {m.revenueFormatted}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectMovie && onSelectMovie(m.id)}
                            className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-red-600 hover:text-white text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-500">
                      Không tìm thấy bộ phim nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* CHẾ ĐỘ 2: BẢNG DOANH THU & LỢI NHUẬN TỪNG PHIM (YÊU CẦU 3 CỦA GIẢNG VIÊN) */}
        {viewMode === 'financial' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4 min-w-[200px]">Bộ phim</th>
                  <th className="py-3 px-4 text-right font-black text-emerald-400">Doanh thu thuần</th>
                  <th className="py-3 px-4 text-right text-rose-300">Chi phí trực tiếp</th>
                  <th className="py-3 px-4 text-right text-amber-300">Chi phí phân bổ</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-200">Tổng chi phí</th>
                  <th className="py-3 px-4 text-right font-black text-white">Lợi nhuận (Lãi/Lỗ)</th>
                  <th className="py-3 px-3 text-center">Biên LN</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-16 text-center">
                      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <span className="text-slate-400 text-xs">Đang tải phân tích tài chính phim...</span>
                    </td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((m) => {
                    const isProfitable = m.profit >= 0;
                    return (
                      <tr key={m.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                        {/* Cột 1: Tên phim */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={m.poster}
                              alt={m.title}
                              className="w-9 h-12 rounded-lg object-cover shrink-0 border border-slate-700 shadow"
                              onError={(e) => {
                                e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                              }}
                            />
                            <div className="min-w-0">
                              <h4
                                onClick={() => onSelectMovie && onSelectMovie(m.id)}
                                className="text-xs font-bold text-white hover:text-red-400 cursor-pointer transition-colors truncate"
                              >
                                {m.title}
                              </h4>
                              <span className="text-[10px] text-slate-400 block">{m.genre}</span>
                            </div>
                          </div>
                        </td>

                        {/* Doanh thu thuần */}
                        <td className="py-3 px-4 text-right font-black text-emerald-400">
                          {m.revenueFormatted}
                        </td>

                        {/* Chi phí trực tiếp */}
                        <td className="py-3 px-4 text-right text-rose-300 font-semibold">
                          {m.directExpensesFormatted}
                        </td>

                        {/* Chi phí phân bổ chung */}
                        <td className="py-3 px-4 text-right text-amber-300 font-semibold">
                          {m.allocatedExpensesFormatted}
                        </td>

                        {/* Tổng chi phí */}
                        <td className="py-3 px-4 text-right font-bold text-slate-200">
                          {m.totalExpensesFormatted}
                        </td>

                        {/* Lợi nhuận (Lãi hoặc Lỗ) */}
                        <td
                          className={`py-3 px-4 text-right font-black text-sm ${
                            isProfitable ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {m.profitFormatted}
                        </td>

                        {/* Biên lợi nhuận (%) */}
                        <td
                          className={`py-3 px-3 text-center font-bold ${
                            isProfitable ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {m.profitMargin}%
                        </td>

                        {/* Trạng thái */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isProfitable
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {m.statusLabel}
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectMovie && onSelectMovie(m.id)}
                            className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-red-600 hover:text-white text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-500">
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
            <span>Trang {page} / {totalPages} (Tổng {total} phim)</span>
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
                    page === i + 1 ? 'bg-red-600 text-white' : 'bg-[var(--bg-surface)] text-slate-300 hover:bg-slate-700'
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
