import React, { useState } from 'react';

const timeOptions = [
  ['today', 'Hôm nay'], ['yesterday', 'Hôm qua'], ['this_week', 'Tuần này'],
  ['7_days', '7 ngày gần nhất'], ['by_month', 'Theo tháng'],
  ['this_year', 'Cả năm'], ['custom', 'Khoảng ngày tùy chỉnh'],
].map(([value, label]) => ({ value, label }));
const ROOM_TYPES = [
  ['ALL', 'Tất cả loại phòng'], ['IMAX Laser', 'IMAX'],
  ['Dolby Atmos', 'Dolby'], ['Gold Class', 'Gold'],
].map(([value, label]) => ({ value, label }));
const control = 'min-w-0 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5 border border-slate-700 text-white focus:border-cyan-400';

const StatisticsFilter = ({ filters, onChange, movies = [], rooms = [], catalogError }) => {
  const [customOpen, setCustomOpen] = useState(filters.timeRange === 'custom');
  const [localStart, setLocalStart] = useState(filters.customStart);
  const [localEnd, setLocalEnd] = useState(filters.customEnd);
  const selectedYear = Number(filters.year);
  const activeMoviesCount = movies.length;
  const handleTimeRangeChange = (timeRange) => {
    setCustomOpen(timeRange === 'custom');
    if (timeRange !== 'custom') onChange({ ...filters, timeRange, page: 1 });
  };
  const setYear = (value) => {
    const year = Number(value);
    if (Number.isInteger(year) && year >= 1 && year <= 9999) onChange({ ...filters, year, page: 1 });
  };

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3 sm:p-4 space-y-3 shadow-lg">
      {/* 4 Bộ lọc dùng chung: Thời gian, Phim, Loại phòng chiếu, Phòng chiếu vật lý */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`}>
        {/* 1. Dropdown Thời Gian */}
        <div className="flex items-center space-x-2 bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs transition-colors">
          <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-slate-400 font-medium shrink-0">Thời gian:</span>
          <select
            aria-label="Lọc theo thời gian"
            value={customOpen ? 'custom' : filters.timeRange}
            onChange={(e) => handleTimeRangeChange(e.target.value)}
            className="bg-transparent text-white font-semibold outline-none min-w-0 w-full cursor-pointer truncate"
          >
            {timeOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[var(--bg-secondary)] text-white py-1">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Dropdown Phim (Chỉ liệt kê các bộ phim thực sự hoạt động trong kỳ báo cáo & phạm vi phòng đang chọn) */}
        {(
          <div className="flex items-center space-x-2 bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs transition-colors">
            <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
            <span className="text-slate-400 font-medium shrink-0">Phim:</span>
            <select
              aria-label="Lọc theo phim"
              value={filters.movieId || 'ALL'}
              onChange={(e) => onChange({ ...filters, movieId: e.target.value, page: 1 })}
              className="bg-transparent text-white font-semibold outline-none min-w-0 w-full cursor-pointer truncate"
            >
              <option value="ALL" className="bg-[var(--bg-secondary)] text-white">
                {activeMoviesCount > 0
                  ? `Tất cả phim trong kỳ (${activeMoviesCount} phim)`
                  : 'Tất cả phim'}
              </option>
              {filters.movieId !== 'ALL' && !movies.some((movie) =>
                String(movie.id || movie._id || movie.movieId) === filters.movieId
              ) && <option value={filters.movieId}>Phim đang lọc</option>}
              {movies.map((m) => (
                <option
                  key={m.id || m._id || m.movieId}
                  value={m.id || m._id || m.movieId}
                  className="bg-[var(--bg-secondary)] text-white truncate"
                >
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 3. Dropdown Loại phòng chiếu */}
        <div className="flex items-center space-x-2 bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs transition-colors">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span className="text-slate-400 font-medium shrink-0">Loại phòng:</span>
          <select
            aria-label="Lọc theo loại phòng"
            value={filters.roomType || 'ALL'}
            onChange={(e) =>
              onChange({
                ...filters,
                roomType: e.target.value,
                roomId: e.target.value === 'ALL' || rooms.some(
                  (room) => String(room.id || room._id) === filters.roomId && room.roomType === e.target.value
                ) ? filters.roomId : 'ALL',
                page: 1,
              })
            }
            className="bg-transparent text-white font-semibold outline-none min-w-0 w-full cursor-pointer truncate"
          >
            {ROOM_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value} className="bg-[var(--bg-secondary)] text-white">
                {rt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Dropdown Phòng chiếu vật lý (9 phòng) */}
        <div className="flex items-center space-x-2 bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs transition-colors">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span className="text-slate-400 font-medium shrink-0">Phòng:</span>
          <select
            aria-label="Lọc theo phòng vật lý"
            value={filters.roomId || 'ALL'}
            onChange={(e) =>
              onChange({
                ...filters,
                roomId: e.target.value,
                page: 1,
              })
            }
            className="bg-transparent text-white font-semibold outline-none min-w-0 w-full cursor-pointer truncate"
          >
            <option value="ALL" className="bg-[var(--bg-secondary)] text-white">
              Tất cả phòng
            </option>
            {rooms
              .filter((r) => !filters.roomType || filters.roomType === 'ALL' || r.roomType === filters.roomType)
              .map((r) => (
                <option key={r.id || r._id} value={r.id || r._id} className="bg-[var(--bg-secondary)] text-white">
                  {r.roomNumber ? `Phòng ${String(r.roomNumber).padStart(2, '0')}` : r.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {catalogError && <p role="status" className="text-xs text-amber-300">{catalogError}</p>}
      {!customOpen && ['by_month', 'this_year'].includes(filters.timeRange) && (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-700 pt-3 text-xs">
          <div className="flex items-center gap-1">
            <button type="button" className={control} aria-label="Năm trước" onClick={() => setYear(selectedYear - 1)}>‹</button>
            <select className={control} aria-label="Năm báo cáo" value={selectedYear} onChange={(event) => setYear(event.target.value)}>
              {Array.from({ length: 11 }, (_, index) => selectedYear - 5 + index)
                .filter((year) => year >= 1 && year <= 9999)
                .map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <button type="button" className={control} aria-label="Năm sau" onClick={() => setYear(selectedYear + 1)}>›</button>
          </div>
          {filters.timeRange === 'by_month' && (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1" aria-label="Tháng báo cáo">
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <button type="button" key={month} aria-pressed={filters.month === month}
                  className={`${control} aria-pressed:border-cyan-400 aria-pressed:text-cyan-300`}
                  onClick={() => onChange({ ...filters, month, page: 1 })}>T{month}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {customOpen && (
        <form className="flex flex-wrap items-center gap-2 border-t border-slate-700 pt-3 text-xs"
          onSubmit={(event) => {
            event.preventDefault();
            if (localStart && localEnd && localStart <= localEnd) {
              onChange({ ...filters, timeRange: 'custom', customStart: localStart, customEnd: localEnd, page: 1 });
            }
          }}>
          <label className="flex items-center gap-2">Từ ngày
            <input className={control} type="date" required max={localEnd || undefined} value={localStart}
              onChange={(event) => setLocalStart(event.target.value)} />
          </label>
          <label className="flex items-center gap-2">Đến ngày
            <input className={control} type="date" required min={localStart || undefined} value={localEnd}
              onChange={(event) => setLocalEnd(event.target.value)} />
          </label>
          <button type="submit" className="cinema-action rounded-lg px-3 py-1.5 font-bold text-white">Áp dụng</button>
          {localStart && localEnd && localStart > localEnd && <p role="alert" className="text-amber-300">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
        </form>
      )}
    </div>
  );
};

export default StatisticsFilter;
