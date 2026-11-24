import React, { useState } from 'react';

const TIME_OPTIONS = [
  { value: 'this_month', label: 'Tháng này' },
  { value: 'by_month', label: 'Theo tháng cụ thể (Báo cáo tháng)' },
  { value: '7_days', label: '7 ngày qua' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'last_month', label: 'Tháng trước' },
  { value: 'this_year', label: 'Cả năm nay' },
  { value: 'custom', label: 'Tùy chọn khoảng ngày...' },
];

const MONTHS = [
  { value: 1, label: 'Tháng 1' },
  { value: 2, label: 'Tháng 2' },
  { value: 3, label: 'Tháng 3' },
  { value: 4, label: 'Tháng 4' },
  { value: 5, label: 'Tháng 5' },
  { value: 6, label: 'Tháng 6' },
  { value: 7, label: 'Tháng 7' },
  { value: 8, label: 'Tháng 8' },
  { value: 9, label: 'Tháng 9' },
  { value: 10, label: 'Tháng 10' },
  { value: 11, label: 'Tháng 11' },
  { value: 12, label: 'Tháng 12' },
];

const YEARS = [2026, 2025, 2024];

const StatisticsFilter = ({
  filters,
  onChange,
  movies = [],
  showMovieFilter = true,
}) => {
  const [localStart, setLocalStart] = useState(filters.customStart || '');
  const [localEnd, setLocalEnd] = useState(filters.customEnd || '');

  const handleTimeRangeChange = (val) => {
    if (val === 'by_month') {
      onChange({
        ...filters,
        timeRange: 'by_month',
        month: filters.month || 11,
        year: filters.year || 2026,
      });
    } else if (val === 'custom') {
      onChange({
        ...filters,
        timeRange: 'custom',
        customStart: localStart,
        customEnd: localEnd,
      });
    } else {
      onChange({
        ...filters,
        timeRange: val,
      });
    }
  };

  const handleApplyCustom = () => {
    onChange({
      ...filters,
      timeRange: 'custom',
      customStart: localStart,
      customEnd: localEnd,
    });
  };

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3 sm:p-4 space-y-3 shadow-lg">
      {/* 2 Dropdown Bộ Lọc Cân Đối: Thời gian & Phim */}
      <div className={`grid grid-cols-1 ${showMovieFilter ? 'md:grid-cols-2' : 'md:grid-cols-2'} gap-3 sm:gap-4`}>
        {/* 1. Dropdown Thời Gian */}
        <div className="flex items-center space-x-2 bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs transition-colors">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-slate-400 font-medium shrink-0">Thời gian:</span>
          <select
            value={filters.timeRange || 'by_month'}
            onChange={(e) => handleTimeRangeChange(e.target.value)}
            className="bg-transparent text-white font-semibold outline-none w-full cursor-pointer truncate"
          >
            {TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[var(--bg-secondary)] text-white py-1">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Dropdown Phim */}
        {showMovieFilter && (
          <div className="flex items-center space-x-2 bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs transition-colors">
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
            <span className="text-slate-400 font-medium shrink-0">Phim:</span>
            <select
              value={filters.movieId || 'ALL'}
              onChange={(e) => onChange({ ...filters, movieId: e.target.value })}
              className="bg-transparent text-white font-semibold outline-none w-full cursor-pointer truncate"
            >
              <option value="ALL" className="bg-[var(--bg-secondary)] text-white">Tất cả phim</option>
              {movies.map((m) => (
                <option key={m.id || m._id} value={m.id || m._id} className="bg-[var(--bg-secondary)] text-white truncate">
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Lọc theo tháng & năm cụ thể (khi chọn 'by_month') */}
      {filters.timeRange === 'by_month' && (
        <div className="pt-2.5 border-t border-[var(--border-default)]/80 flex flex-wrap items-center gap-3 text-xs animate-fadeIn">
          <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Chọn kỳ báo cáo tháng:</span>
          </span>
          <div className="flex items-center space-x-2">
            <select
              value={filters.month || 11}
              onChange={(e) => onChange({ ...filters, month: Number(e.target.value) })}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold outline-none focus:border-red-500 text-xs cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value} className="bg-[var(--bg-secondary)] text-white">
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={filters.year || 2026}
              onChange={(e) => onChange({ ...filters, year: Number(e.target.value) })}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold outline-none focus:border-red-500 text-xs cursor-pointer"
            >
              {YEARS.map((y) => (
                <option key={y} value={y} className="bg-[var(--bg-secondary)] text-white">
                  Năm {y}
                </option>
              ))}
            </select>
          </div>
          <span className="text-slate-500 text-[11px] italic">
            (Xem đầy đủ báo cáo kinh doanh, chi phí và lợi nhuận của tháng được chọn)
          </span>
        </div>
      )}

      {/* Tùy chọn khoảng ngày tùy chỉnh (khi chọn 'custom') */}
      {filters.timeRange === 'custom' && (
        <div className="pt-2.5 border-t border-[var(--border-default)]/80 flex flex-wrap items-center gap-3 text-xs animate-fadeIn">
          <span className="text-slate-400 font-semibold flex items-center space-x-1">
            <span>Khoảng ngày tùy chọn:</span>
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Từ</span>
            <input
              type="date"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-lg px-2.5 py-1 text-white font-medium outline-none focus:border-red-500 text-xs"
            />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Đến</span>
            <input
              type="date"
              value={localEnd}
              onChange={(e) => setLocalEnd(e.target.value)}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-lg px-2.5 py-1 text-white font-medium outline-none focus:border-red-500 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyCustom}
            className="px-3.5 py-1 cinema-action text-white font-bold rounded-lg transition-all shadow-md text-xs cursor-pointer"
          >
            Áp dụng
          </button>
        </div>
      )}
    </div>
  );
};

export default StatisticsFilter;
