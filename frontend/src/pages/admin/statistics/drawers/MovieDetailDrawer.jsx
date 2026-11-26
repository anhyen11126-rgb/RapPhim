import React, { useState, useEffect } from 'react';
import statisticsApi from '../services/statisticsApi';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const MovieDetailDrawer = ({ movieId, filters = {}, onClose, onSelectShowtime }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!movieId) return;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await statisticsApi.getMovieDetail(movieId, {
          timeRange: filters.timeRange,
          month: filters.month,
          year: filters.year,
          customStart: filters.customStart,
          customEnd: filters.customEnd,
        });
        if (res.data?.data) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Lỗi nạp chi tiết thống kê phim:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [movieId, filters.timeRange, filters.month, filters.year, filters.customStart, filters.customEnd]);

  if (!movieId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Slide-out Drawer Panel */}
      <div className="relative w-full max-w-3xl bg-[var(--bg-secondary)] border-l border-[var(--border-default)] h-full overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl z-10 text-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border-default)] pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                Hồ sơ phân tích hiệu suất bán vé, suất chiếu & lợi nhuận phim
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {data?.movie?.title || 'Chi tiết phim'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--bg-surface)] hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Đang tải phân tích tác phẩm & danh sách suất chiếu...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Không tìm thấy thông tin chi tiết cho bộ phim này.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Banner tóm tắt phim */}
            <div className="flex gap-4 p-4 rounded-2xl bg-[var(--bg-surface)]/50 border border-slate-700/60">
              <img
                src={data.movie.poster}
                alt={data.movie.title}
                className="w-24 h-36 rounded-xl object-cover shrink-0 border border-slate-700 shadow"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                }}
              />
              <div className="space-y-1.5 flex-1 min-w-0 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="bg-violet-600/20 text-violet-300 border border-violet-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                    {data.movie.ageRating}
                  </span>
                  <span className="text-amber-400 font-bold">★ {data.movie.rating}</span>
                  <span className="text-slate-400">({data.movie.ratingCount})</span>
                </div>
                <div className="text-slate-300">
                  <strong>Thời lượng:</strong> {data.movie.duration} phút
                </div>
                <div className="text-slate-300">
                  <strong>Thể loại:</strong> {data.movie.genre}
                </div>
                {data.movie.director && (
                  <div className="text-slate-300 truncate">
                    <strong>Đạo diễn:</strong> {data.movie.director}
                  </div>
                )}
                {data.movie.cast && (
                  <div className="text-slate-400 line-clamp-2">
                    <strong>Diễn viên:</strong> {data.movie.cast}
                  </div>
                )}
              </div>
            </div>

            {/* 1. Dãy Chỉ số Hiệu Suất Bán Vé & Công Suất */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                1. Hiệu suất bán vé & Công suất ghế ngồi
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-[var(--bg-surface)]/60 border border-slate-700/70 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Số suất chiếu</span>
                  <span className="text-sm font-bold text-white block mt-1">
                    {formatNumber(data.stats.showtimesCount)} suất
                  </span>
                </div>
                <div className="bg-[var(--bg-surface)]/60 border border-slate-700/70 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Tổng ghế mở bán</span>
                  <span className="text-sm font-bold text-slate-200 block mt-1">
                    {formatNumber(data.stats.totalSeats)} ghế
                  </span>
                </div>
                <div className="bg-[var(--bg-surface)]/60 border border-slate-700/70 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Vé đã bán</span>
                  <span className="text-sm font-bold text-cyan-300 block mt-1">
                    {formatNumber(data.stats.totalTickets)} vé
                  </span>
                </div>
                <div className="bg-[var(--bg-surface)]/60 border border-slate-700/70 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Ghế còn đặt được</span>
                  <span className="text-sm font-bold text-emerald-400 block mt-1">
                    {formatNumber(data.stats.upcomingAvailableSeats ?? 0)} ghế
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Trống đã chiếu: {formatNumber(data.stats.completedUnsoldSeats ?? 0)}
                  </span>
                </div>
                <div className="bg-[var(--bg-surface)]/60 border border-slate-700/70 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Tỷ lệ bán vé toàn kỳ</span>
                  <span className="text-sm font-bold text-amber-400 block mt-1">
                    {formatPercent(data.stats.avgOccupancy)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Đã chiếu: {formatPercent(data.stats.completedOccupancyRate || 0)} • Sắp: {formatPercent(data.stats.upcomingOccupancyRate || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Dãy Chỉ số Tài chính: Doanh Thu, Chi Phí & Lợi Nhuận */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  2. Báo cáo Tài chính & Lợi nhuận phim
                </h4>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    !data.stats.hasExpenseData
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      : data.stats.profitStatus === 'PROFIT'
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                      : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
                  }`}
                >
                  {data.stats.profitStatusLabel}
                  {data.stats.hasExpenseData && data.stats.profitMargin != null
                    ? ` (Biên LN ${data.stats.profitMargin}%${data.stats.roi != null ? ` • ROI ${data.stats.roi}%` : ''})`
                    : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-slate-950/60 border border-[var(--border-default)] p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Doanh thu thuần</span>
                  <strong className="text-emerald-400 text-xs block mt-0.5">
                    {data.stats.revenueFormatted}
                  </strong>
                </div>
                <div className="bg-slate-950/60 border border-[var(--border-default)] p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Chi phí trực tiếp</span>
                  <strong className="text-rose-300 text-xs block mt-0.5">
                    {data.stats.directExpensesFormatted || '0 đ'}
                  </strong>
                </div>
                <div className="bg-slate-950/60 border border-[var(--border-default)] p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Chi phí vận hành phân bổ</span>
                  <strong className="text-amber-300 text-xs block mt-0.5">
                    {data.stats.allocatedExpensesFormatted || '0 đ'}
                  </strong>
                </div>
                <div className="bg-slate-950/60 border border-[var(--border-default)] p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Lợi nhuận thuần</span>
                  <strong
                    className={`text-xs block mt-0.5 font-black ${
                      !data.stats.hasExpenseData
                        ? 'text-amber-300'
                        : (data.stats.profit || 0) >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {data.stats.profitFormatted}
                  </strong>
                </div>
              </div>
            </div>

            {/* 3. Danh sách các chứng từ / khoản chi trực tiếp của phim */}
            {data.expensesList && data.expensesList.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  3. Danh mục chi phí trực tiếp ({data.expensesList.length} khoản chi)
                </h4>
                <div className="space-y-2">
                  {data.expensesList.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3 rounded-xl bg-[var(--bg-surface)]/50 border border-slate-700/60 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[10px] text-slate-400 bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">
                            {exp.costCode}
                          </span>
                          <span className="font-bold text-white">{exp.title}</span>
                          <span className="text-[10px] text-cyan-300">({exp.categoryLabel})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Ngày: {new Date(exp.date).toLocaleDateString('vi-VN')} • {exp.notes || 'Không có ghi chú'}
                        </div>
                      </div>
                      <span className="font-bold text-rose-400 text-xs shrink-0">
                        {exp.formattedAmount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Danh sách từng suất chiếu của phim (MỤC VI.4: Ngày, Giờ, Phòng, Tổng ghế, Đã bán, Chưa bán, Lấp đầy, Doanh thu) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  4. Chi tiết từng suất chiếu của phim ({data.showtimesList?.length || 0} suất)
                </h4>
                <span className="text-[11px] text-slate-400">
                  Suất cháy vé: <strong className="text-amber-400">{data.stats.soldOutShowtimesCount || 0}</strong>
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]/20">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[var(--bg-surface)] text-slate-400 font-bold uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Ngày & Giờ</th>
                      <th className="py-2.5 px-3">Phòng chiếu</th>
                      <th className="py-2.5 px-2 text-center">Tổng ghế</th>
                      <th className="py-2.5 px-2 text-center">Đã bán</th>
                      <th className="py-2.5 px-2 text-center">Còn trống</th>
                      <th className="py-2.5 px-2.5 text-center">Lấp đầy</th>
                      <th className="py-2.5 px-3 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {(data.showtimesList || []).map((st) => (
                      <tr
                        key={st.id}
                        onClick={() => {
                          if (onSelectShowtime) {
                            onClose();
                            onSelectShowtime(st.id);
                          }
                        }}
                        className="hover:bg-[var(--bg-surface)]/60 cursor-pointer transition-colors"
                      >
                        <td className="py-2 px-3 font-mono text-white">
                          {new Date(st.startTime).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-200">{st.roomName}</span>
                        </td>
                        <td className="py-2 px-2 text-center text-slate-400">{st.totalSeats || 88}</td>
                        <td className="py-2 px-2 text-center font-bold text-cyan-300">{st.soldSeats || 0}</td>
                        <td className="py-2 px-2 text-center text-slate-400">{st.unsoldSeats ?? 88}</td>
                        <td className="py-2 px-2.5 text-center font-bold text-amber-400">
                          {st.occupancyRate || 0}%
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">
                          {st.revenueFormatted || formatCurrency(st.revenue || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieDetailDrawer;
