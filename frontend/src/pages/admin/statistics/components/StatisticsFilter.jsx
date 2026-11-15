import React, { useState } from 'react';

const TIME_PRESETS = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'yesterday', label: 'Hôm qua' },
  { id: '7_days', label: '7 ngày qua' },
  { id: '30_days', label: '30 ngày qua' },
  { id: 'this_month', label: 'Tháng này' },
  { id: 'last_month', label: 'Tháng trước' },
  { id: 'this_year', label: 'Năm nay' },
  { id: 'all', label: 'Toàn thời gian' },
  { id: 'custom', label: 'Tùy chỉnh...' },
];

const StatisticsFilter = ({
  filters,
  onChange,
  cinemas = [],
  movies = [],
  showMovieFilter = true,
}) => {
  const [isCustomOpen, setIsCustomOpen] = useState(filters.timeRange === 'custom');

  const handleTimeRangeClick = (rangeId) => {
    if (rangeId === 'custom') {
      setIsCustomOpen(true);
      onChange({ ...filters, timeRange: 'custom' });
    } else {
      setIsCustomOpen(false);
      onChange({ ...filters, timeRange: rangeId });
    }
  };

  const handleCustomDateChange = (field, value) => {
    onChange({
      ...filters,
      timeRange: 'custom',
      [field]: value,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
          <span className="text-xs font-semibold text-slate-400 mr-1 shrink-0 flex items-center space-x-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Kỳ:</span>
          </span>

          {TIME_PRESETS.map((preset) => {
            const isActive = filters.timeRange === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleTimeRangeClick(preset.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Dropdowns Lọc Rạp & Phim */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Lọc theo Cụm rạp */}
          <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400">Rạp:</span>
            <select
              value={filters.cinemaId || 'ALL'}
              onChange={(e) => onChange({ ...filters, cinemaId: e.target.value })}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">Tất cả cụm rạp</option>
              {cinemas.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id} className="bg-slate-900 text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Phim (nếu phù hợp tab) */}
          {showMovieFilter && (
            <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-400">Phim:</span>
              <select
                value={filters.movieId || 'ALL'}
                onChange={(e) => onChange({ ...filters, movieId: e.target.value })}
                className="bg-transparent text-white font-semibold outline-none max-w-[180px] truncate cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">Tất cả phim</option>
                {movies.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id} className="bg-slate-900 text-white truncate">
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Hàng chọn ngày Custom nếu chọn Tùy chỉnh */}
      {isCustomOpen && (
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-3 text-xs animate-fadeIn">
          <span className="text-slate-400 font-semibold">Khoảng ngày tùy chỉnh:</span>
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Từ</span>
            <input
              type="date"
              value={filters.customStart || ''}
              onChange={(e) => handleCustomDateChange('customStart', e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-semibold outline-none focus:border-red-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Đến</span>
            <input
              type="date"
              value={filters.customEnd || ''}
              onChange={(e) => handleCustomDateChange('customEnd', e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-semibold outline-none focus:border-red-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StatisticsFilter;
