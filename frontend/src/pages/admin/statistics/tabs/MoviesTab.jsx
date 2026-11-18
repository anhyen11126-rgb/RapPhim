import React, { useState } from 'react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const MoviesTab = ({ moviesData, loading, onSelectMovie, onPageChange, onSearch, onSort }) => {
  const [searchInput, setSearchInput] = useState('');
  const items = moviesData?.items || [];
  const total = moviesData?.total || 0;
  const page = moviesData?.page || 1;
  const totalPages = moviesData?.totalPages || 1;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchInput);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
      {/* Header & Thanh tìm kiếm / lọc */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white">Thống Kê Hiệu Suất Từng Bộ Phim</h3>
          <p className="text-xs text-slate-400">
            Theo dõi lượng vé bán, tỷ lệ lấp đầy ghế và doanh thu thuần chi tiết của toàn bộ {total} tác phẩm
          </p>
        </div>

        {/* Thanh tìm kiếm phim */}
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Tìm tên phim..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 w-48 sm:w-56"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow"
          >
            Tìm
          </button>
        </form>
      </div>

      {/* Bảng danh sách phim */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
            <tr>
              <th className="py-3 px-4 min-w-[220px]">Tác phẩm điện ảnh</th>
              <th className="py-3 px-3 text-center">Trạng thái</th>
              <th className="py-3 px-3 text-center">Suất chiếu</th>
              <th className="py-3 px-3 text-center">Vé đã bán</th>
              <th className="py-3 px-3 text-center">Ghế đã đặt</th>
              <th className="py-3 px-3 text-center">Ghế còn trống</th>
              <th className="py-3 px-4 min-w-[130px]">Tỷ lệ lấp đầy</th>
              <th className="py-3 px-4 text-right">Tổng doanh thu</th>
              <th className="py-3 px-3 text-center">Đánh giá</th>
              <th className="py-3 px-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-medium">
            {loading ? (
              <tr>
                <td colSpan="10" className="py-16 text-center">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span className="text-slate-400 text-xs">Đang nạp dữ liệu phim...</span>
                </td>
              </tr>
            ) : items.length > 0 ? (
              items.map((m) => {
                const isHot = m.occupancyRate >= 80;
                return (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Cột 1: Gộp Poster & Tên phim + Độ tuổi */}
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
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {m.status === 'NOW_SHOWING' ? 'Đang chiếu' : m.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đã kết thúc'}
                      </span>
                    </td>

                    {/* Suất chiếu */}
                    <td className="py-3 px-3 text-center font-bold text-slate-200">
                      {formatNumber(m.showtimesCount)}
                    </td>

                    {/* Vé đã bán */}
                    <td className="py-3 px-3 text-center font-bold text-white">
                      {formatNumber(m.ticketsSold)}
                    </td>

                    {/* Ghế đã đặt */}
                    <td className="py-3 px-3 text-center font-bold text-amber-400">
                      {formatNumber(m.bookedSeats || m.ticketsSold)}
                    </td>

                    {/* Ghế còn trống */}
                    <td className="py-3 px-3 text-center text-slate-400">
                      {formatNumber(m.availableSeats)}
                    </td>

                    {/* Tỷ lệ lấp đầy (Progress Bar) */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <strong className={isHot ? 'text-amber-400' : 'text-slate-300'}>
                            {formatPercent(m.occupancyRate)}
                          </strong>
                          <span className="text-[9px] text-slate-500">
                            {formatNumber(m.bookedSeats)}/{(m.bookedSeats + m.availableSeats)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isHot ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(100, m.occupancyRate)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Doanh thu vé */}
                    <td className="py-3 px-4 text-right font-black text-emerald-400">
                      {formatCurrency(m.ticketRevenue)}
                    </td>

                    {/* Đánh giá */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <span className="text-amber-400 font-bold">★ {m.rating}</span>
                      </div>
                      <span className="text-[9px] text-slate-500 block">{m.ratingCount}</span>
                    </td>

                    {/* Thao tác xem chi tiết */}
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectMovie && onSelectMovie(m.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-red-600 hover:text-white text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                        title="Xem hồ sơ chi tiết tác phẩm"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="10" className="py-12 text-center text-slate-500">
                  Không tìm thấy bộ phim nào phù hợp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
          <span>Trang {page} / {totalPages} (Tổng {total} phim)</span>
          <div className="flex items-center space-x-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => onPageChange && onPageChange(page - 1)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPageChange && onPageChange(i + 1)}
                className={`px-2.5 py-1 rounded font-bold ${
                  page === i + 1 ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => onPageChange && onPageChange(page + 1)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoviesTab;
