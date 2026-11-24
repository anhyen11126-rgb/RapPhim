import React, { useState } from 'react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const ShowtimesTab = ({
  showtimesData,
  loading,
  onSelectShowtime,
  onPageChange,
  onSearch,
  onRoomFilter,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('ALL');
  const items = showtimesData?.items || [];
  const total = showtimesData?.total || 0;
  const page = showtimesData?.page || 1;
  const totalPages = showtimesData?.totalPages || 1;

  const ROOM_OPTIONS = [
    { value: 'ALL', label: 'Tất cả 9 phòng chiếu' },
    // 3 Nhóm loại phòng
    { value: 'IMAX Laser', label: '★ Nhóm IMAX Laser (3 phòng)' },
    { value: 'Dolby Atmos', label: '★ Nhóm Dolby Atmos (3 phòng)' },
    { value: 'Gold Class', label: '★ Nhóm Gold Class (3 phòng)' },
    // 9 Phòng chiếu vật lý
    { value: 'Phòng 1', label: 'Phòng 01 - IMAX Laser 01' },
    { value: 'Phòng 2', label: 'Phòng 02 - IMAX Laser 02' },
    { value: 'Phòng 3', label: 'Phòng 03 - IMAX Laser 03' },
    { value: 'Phòng 4', label: 'Phòng 04 - Dolby Atmos 01' },
    { value: 'Phòng 5', label: 'Phòng 05 - Dolby Atmos 02' },
    { value: 'Phòng 6', label: 'Phòng 06 - Dolby Atmos 03' },
    { value: 'Phòng 7', label: 'Phòng 07 - Gold Class 01' },
    { value: 'Phòng 8', label: 'Phòng 08 - Gold Class 02' },
    { value: 'Phòng 9', label: 'Phòng 09 - Gold Class 03' },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchInput);
  };

  const handleRoomChange = (roomVal) => {
    setSelectedRoom(roomVal);
    if (onRoomFilter) {
      onRoomFilter(roomVal);
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-5 shadow-xl">
      {/* Header & Tìm kiếm */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-default)]/80 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white">Thống Kê Chi Tiết Suất Chiếu</h3>
          <p className="text-xs text-slate-400">
            Giám sát thời gian thực số lượng khách, ghế đã đặt và doanh thu của {total} suất chiếu
          </p>
        </div>

        {/* Bộ lọc phòng chiếu & Tìm kiếm */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc theo Phòng chiếu */}
          <div className="flex items-center space-x-1.5 bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400">Phòng:</span>
            <select
              value={selectedRoom}
              onChange={(e) => handleRoomChange(e.target.value)}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer text-xs"
            >
              {ROOM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[var(--bg-secondary)] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Ô tìm kiếm */}
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Tìm theo phim, phòng..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 w-44 sm:w-52"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
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
              <th className="py-3 px-4 min-w-[200px]">Phim & Suất chiếu</th>
              <th className="py-3 px-3">Phòng chiếu</th>
              <th className="py-3 px-3">Định dạng</th>
              <th className="py-3 px-3">Thời gian</th>
              <th className="py-3 px-3 text-center">Người đặt</th>
              <th className="py-3 px-3 text-center">Ghế đã đặt</th>
              <th className="py-3 px-3 text-center">Còn trống</th>
              <th className="py-3 px-4 min-w-[120px]">Lấp đầy</th>
              <th className="py-3 px-4 text-right">Doanh thu</th>
              <th className="py-3 px-3 text-center">Trạng thái</th>
              <th className="py-3 px-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-medium">
            {loading ? (
              <tr>
                <td colSpan="11" className="py-16 text-center">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span className="text-slate-400 text-xs">Đang nạp danh sách suất chiếu...</span>
                </td>
              </tr>
            ) : items.length > 0 ? (
              items.map((st) => {
                const dateObj = new Date(st.startTime);
                const isFinished = st.status === 'FINISHED';
                const isHot = st.occupancyRate >= 80;

                return (
                  <tr key={st.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                    {/* Phim & Poster */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={st.moviePoster}
                          alt={st.movieTitle}
                          className="w-8 h-11 rounded-md object-cover shrink-0 border border-slate-700"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                          }}
                        />
                        <div className="min-w-0">
                          <strong className="text-white block truncate">{st.movieTitle}</strong>
                          <span className="text-[10px] text-slate-400">{st.cinemaName}</span>
                        </div>
                      </div>
                    </td>

                    {/* Phòng chiếu */}
                    <td className="py-3 px-3 font-semibold text-slate-200">{st.roomName}</td>

                    {/* Định dạng */}
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-slate-700 text-slate-300">
                        {st.format}
                      </span>
                    </td>

                    {/* Thời gian */}
                    <td className="py-3 px-3">
                      <span className="text-white font-semibold block">
                        {dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </td>

                    {/* Khách */}
                    <td className="py-3 px-3 text-center text-blue-400 font-bold">
                      {formatNumber(st.customerCount)}
                    </td>

                    {/* Ghế đã đặt */}
                    <td className="py-3 px-3 text-center font-bold text-white">
                      {st.bookedSeats}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        / {st.totalSeats ?? '—'}
                      </span>
                    </td>

                    {/* Còn trống */}
                    <td className="py-3 px-3 text-center text-emerald-400 font-semibold">
                      {st.availableSeats}
                    </td>

                    {/* Tỷ lệ lấp đầy */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isHot ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                            {formatPercent(st.occupancyRate)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isHot ? 'bg-amber-500' : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(100, st.occupancyRate)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Doanh thu */}
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      {formatCurrency(st.revenue)}
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          isFinished
                            ? 'bg-[var(--bg-surface)] text-slate-400 border-slate-700'
                            : 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {isFinished ? 'Đã chiếu' : 'Sắp chiếu'}
                      </span>
                    </td>

                    {/* Thao tác */}
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectShowtime && onSelectShowtime(st.id)}
                        className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-red-600 hover:text-white text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all"
                        title="Xem sơ đồ 88 ghế và vé đã đặt"
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
                  Không tìm thấy suất chiếu nào phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-default)] text-xs text-slate-400">
          <span>Trang {page} / {totalPages} (Tổng {total} suất chiếu)</span>
          <div className="flex items-center space-x-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => onPageChange && onPageChange(page - 1)}
              className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-slate-700 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPageChange && onPageChange(i + 1)}
                className={`px-2.5 py-1 rounded font-bold ${
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
              className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-slate-700 disabled:opacity-40"
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
