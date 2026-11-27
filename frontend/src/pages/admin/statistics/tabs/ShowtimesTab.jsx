import React, { useState } from 'react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const ShowtimesTab = ({
  showtimesData,
  loading,
  error,
  onRetry,
  onSelectShowtime,
  onPageChange,
  onSearch,
  onRoomFilter,
  onStatusFilter,
  currentStatus = 'ALL',
  rooms = [],
  roomId = 'ALL',
  roomType = 'ALL',
}) => {
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
        <h3 className="text-base sm:text-lg font-bold text-white">Không tải được thống kê suất chiếu</h3>
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

  const items = showtimesData?.items || [];
  const total = showtimesData?.total || 0;
  const page = showtimesData?.page || 1;
  const totalPages = showtimesData?.totalPages || 1;
  const ROOM_OPTIONS = [
    { value: 'ALL', label: 'Tất cả phòng' },
    ...rooms.filter((room) => roomType === 'ALL' || room.roomType === roomType).map((room) => ({
      value: room.id || room._id,
      label: room.roomNumber ? `Phòng ${String(room.roomNumber).padStart(2, '0')}` : room.name,
    })),
  ];

  const STATUS_OPTIONS = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'COMPLETED', label: 'Đã chiếu' },
    { value: 'NOW_SHOWING', label: 'Đang chiếu' },
    { value: 'CLEANING', label: 'Đang dọn phòng' },
    { value: 'UPCOMING', label: 'Sắp chiếu' },
    { value: 'CANCELLED', label: 'Đã hủy' },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchInput);
  };

  const handleRoomChange = (roomVal) => {
    if (onRoomFilter) {
      onRoomFilter(roomVal);
    }
  };

  const renderLifecycleBadge = (st) => {
    const lc = st.lifecycleStatus || st.status;
    if (lc === 'CANCELLED') {
      return (
        <span className="whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-950/70 text-rose-400 border-rose-500/40">
          Đã hủy
        </span>
      );
    }
    if (lc === 'NOW_SHOWING') {
      return (
        <span className="whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-cyan-950/70 text-cyan-300 border-cyan-500/40">
          Đang chiếu
        </span>
      );
    }
    if (lc === 'CLEANING') {
      return <span className="whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-950/70 px-2 py-0.5 text-[10px] font-bold text-amber-300">Đang dọn phòng</span>;
    }
    if (lc === 'COMPLETED' || lc === 'FINISHED') {
      return (
        <span className="whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[var(--bg-surface)] text-slate-400 border-slate-700">
          Đã chiếu
        </span>
      );
    }
    return (
      <span className="whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-500/30">
        Sắp chiếu
      </span>
    );
  };

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-5 shadow-xl">
      {showtimesData?.missingSeatShowtimesOnPage > 0 &&
        <p role="status" className="text-xs text-amber-300">{showtimesData.missingSeatShowtimesOnPage} suất trên trang thiếu dữ liệu ghế.</p>}
      {/* Header & Tìm kiếm */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border-default)]/80 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white">Thống Kê Chi Tiết Suất Chiếu ({formatNumber(total)} suất)</h3>
          <p className="text-xs text-slate-400">
            Giám sát số ghế mở bán, ghế đã bán, ghế trống và doanh thu của từng suất chiếu thực tế
          </p>
        </div>

        {/* Bộ lọc phòng chiếu, trạng thái & Tìm kiếm */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400">Trạng thái:</span>
            <select
              value={currentStatus}
              onChange={(e) => onStatusFilter && onStatusFilter(e.target.value)}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer text-xs"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[var(--bg-secondary)] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400">Phòng:</span>
            <select
              aria-label="Phòng trong danh sách suất chiếu"
              value={roomId}
              onChange={(e) => handleRoomChange(e.target.value)}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer text-xs max-w-[200px] truncate"
            >
              {ROOM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[var(--bg-secondary)] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Tìm theo phim, phòng..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 w-44 sm:w-52"
            />
            <button
              type="submit"
              className="px-3 py-1.5 cinema-action text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
            >
              Tìm
            </button>
          </form>
        </div>
      </div>

      {/* Bảng dữ liệu suất chiếu */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
            <tr>
              <th className="py-3 px-4 min-w-[200px]">Phim & Rạp</th>
              <th className="py-3 px-3">Phòng chiếu</th>
              <th className="py-3 px-3">Loại phòng</th>
              <th className="py-3 px-3">Ngày & Giờ chiếu</th>
              <th className="py-3 px-2.5 text-center">Khách</th>
              <th className="py-3 px-2.5 text-center">Ghế đã bán</th>
              <th className="py-3 px-2.5 text-center">Ghế trống</th>
              <th className="py-3 px-3 min-w-[120px]">Lấp đầy (%)</th>
              <th className="py-3 px-3 text-right">Doanh thu</th>
              <th className="py-3 px-3 text-center">Trạng thái</th>
              <th className="py-3 px-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-medium">
            {loading ? (
              <tr>
                <td colSpan="11" className="py-16 text-center">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span className="text-slate-400 text-xs">Đang nạp danh sách suất chiếu...</span>
                </td>
              </tr>
            ) : items.length > 0 ? (
              items.map((st) => {
                const dateObj = new Date(st.startTime);
                const isHot = (st.occupancyRate || 0) >= 75;

                return (
                  <tr key={st.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                    {/* Phim & Poster */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={st.moviePoster || undefined}
                          alt={st.movieTitle}
                          className="w-8 h-11 rounded-md object-cover shrink-0 border border-slate-700"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                          }}
                        />
                        <div className="min-w-0">
                          <strong className="text-white block truncate">{st.movieTitle}</strong>
                          {(st.missingRoom || (!st.hasSeatRecords && st.lifecycleStatus !== 'CANCELLED')) &&
                            <span className="text-amber-300 text-[11px]">{st.missingRoom ? 'Thiếu phòng chiếu' : 'Thiếu dữ liệu ghế'}</span>}
                          <span className="text-[10px] text-slate-400">{st.cinemaName}</span>
                        </div>
                      </div>
                    </td>

                    {/* Phòng chiếu */}
                    <td className="py-3 px-3 font-semibold text-slate-200">{st.roomName}</td>

                    {/* Loại phòng */}
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          st.roomType === 'IMAX Laser'
                            ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40'
                            : st.roomType === 'Dolby Atmos'
                            ? 'bg-purple-950/70 text-purple-300 border-purple-500/40'
                            : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {{ 'IMAX Laser': 'IMAX', 'Dolby Atmos': 'Dolby', 'Gold Class': 'Gold' }[st.roomType] || '—'}
                      </span>
                    </td>

                    {/* Thời gian */}
                    <td className="py-3 px-3">
                      <span className="text-white font-semibold block">
                        {dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </td>

                    {/* Khách */}
                    <td className="py-3 px-2.5 text-center text-cyan-300 font-bold">
                      {formatNumber(st.customerCount)}
                    </td>

                    {/* Ghế đã bán */}
                    <td className="py-3 px-2.5 text-center font-bold text-white">
                      {st.bookedSeats ?? 0}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        / {st.totalSeats ?? '—'}
                      </span>
                    </td>

                    {/* Còn trống */}
                    <td className="py-3 px-2.5 text-center text-emerald-400 font-semibold">
                      <span>{st.availableSeats ?? '—'}</span>
                      <span className="block text-[10px] text-slate-400">
                        Giữ: {st.holdingSeats} • Đóng: {st.closedUnsoldSeats} • Đặt được: {st.bookableAvailableSeats}
                      </span>
                    </td>

                    {/* Tỷ lệ lấp đầy */}
                    <td className="py-3 px-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isHot ? 'text-amber-400 font-bold' : 'text-cyan-300'}>
                            {formatPercent(st.occupancyRate || 0)}
                          </span>
                          {st.isSoldOut && (
                            <span className="text-[9px] font-black text-rose-400 uppercase">Cháy vé</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isHot ? 'bg-amber-500' : 'bg-cyan-400'}`}
                            style={{ width: `${Math.min(100, Math.max((st.bookedSeats || 0) > 0 ? 4 : 0, st.occupancyRate || 0))}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Doanh thu */}
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {formatCurrency(st.revenue)}
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3 px-3 text-center">{renderLifecycleBadge(st)}</td>

                    {/* Thao tác */}
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectShowtime && onSelectShowtime(st.id)}
                        className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-violet-600 hover:text-white text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                        title="Xem sơ đồ ghế và vé đã đặt"
                      >
                        Sơ đồ ghế
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="11" className="py-12 text-center text-slate-500">
                  Không tìm thấy suất chiếu nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-default)] text-xs text-slate-400">
          <span>
            Trang {page} / {totalPages} (Tổng {formatNumber(total)} suất chiếu)
          </span>
          <div className="flex items-center space-x-1 flex-wrap gap-y-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => onPageChange && onPageChange(page - 1)}
              className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(10, totalPages) }).map((_, i) => (
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
  );
};

export default ShowtimesTab;
