import React, { useState, useMemo } from 'react';

export const CINEMA_OPERATION_START_YEAR = 2026;
export const CINEMA_OPERATION_START_MONTH = 11;
export const CINEMA_OPERATION_MIN_DATE = '2026-11-01';

const ALL_MONTHS = [
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

const ROOM_TYPES = [
  { value: 'ALL', label: 'Tất cả loại phòng (3 công nghệ)' },
  { value: 'IMAX Laser', label: 'IMAX Laser (Phòng 01 - 03)' },
  { value: 'Dolby Atmos', label: 'Dolby Atmos (Phòng 04 - 06)' },
  { value: 'Gold Class', label: 'Gold Class (Phòng 07 - 09)' },
];

/**
 * Lấy tháng và năm hiện tại theo múi giờ chuẩn Asia/Ho_Chi_Minh
 */
const getCurrentVietnamMonthYear = () => {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  const rawMonth = Number(parts.find((p) => p.type === 'month')?.value || 11);
  const rawYear = Number(parts.find((p) => p.type === 'year')?.value || 2026);
  const year = Math.max(CINEMA_OPERATION_START_YEAR, rawYear);
  const month =
    year === CINEMA_OPERATION_START_YEAR
      ? Math.max(CINEMA_OPERATION_START_MONTH, rawMonth)
      : rawMonth;
  return { month, year };
};

const StatisticsFilter = ({
  filters,
  onChange,
  movies = [],
  rooms = [],
  showMovieFilter = true,
}) => {
  const [localStart, setLocalStart] = useState(filters.customStart || CINEMA_OPERATION_MIN_DATE);
  const [localEnd, setLocalEnd] = useState(filters.customEnd || '');
  const [customWarning, setCustomWarning] = useState('');

  const vnNow = useMemo(() => getCurrentVietnamMonthYear(), []);

  // Sinh danh sách năm động từ năm bắt đầu vận hành (2026) trở đi, tuyệt đối không có năm < 2026
  const availableYears = useMemo(() => {
    const maxYear = Math.max(vnNow.year + 1, CINEMA_OPERATION_START_YEAR + 1);
    const list = [];
    for (let y = CINEMA_OPERATION_START_YEAR; y <= maxYear; y++) {
      list.push(y);
    }
    return list;
  }, [vnNow.year]);

  const selectedYear = Math.max(
    CINEMA_OPERATION_START_YEAR,
    Number(filters.year) || vnNow.year
  );

  // Năm 2026 chỉ cho phép chọn từ Tháng 11 trở đi (11, 12); các năm sau (2027+) có đủ Tháng 1..12
  const availableMonths = useMemo(() => {
    if (selectedYear === CINEMA_OPERATION_START_YEAR) {
      return ALL_MONTHS.filter((m) => m.value >= CINEMA_OPERATION_START_MONTH);
    }
    return ALL_MONTHS;
  }, [selectedYear]);

  const selectedMonth =
    selectedYear === CINEMA_OPERATION_START_YEAR
      ? Math.max(CINEMA_OPERATION_START_MONTH, Number(filters.month) || vnNow.month)
      : Number(filters.month) || 1;

  // Kiểm tra có đang ở tháng đầu vận hành (11/2026) hay không để ẩn tùy chọn "Tháng trước"
  const isCurrentlyInFirstOperatingMonth =
    vnNow.year === CINEMA_OPERATION_START_YEAR &&
    vnNow.month <= CINEMA_OPERATION_START_MONTH &&
    selectedYear === CINEMA_OPERATION_START_YEAR &&
    selectedMonth <= CINEMA_OPERATION_START_MONTH;

  const timeOptions = useMemo(() => {
    const opts = [
      { value: 'by_month', label: 'Theo tháng cụ thể (Báo cáo tháng)' },
      { value: 'this_month', label: 'Tháng này' },
    ];
    if (!isCurrentlyInFirstOperatingMonth) {
      opts.push({ value: 'last_month', label: 'Tháng trước' });
    }
    opts.push(
      { value: 'today', label: 'Hôm nay' },
      { value: '7_days', label: '7 ngày gần nhất' },
      { value: '30_days', label: '30 ngày gần nhất' },
      { value: 'this_year', label: 'Cả năm (Từ T11/2026)' },
      { value: 'custom', label: 'Tùy chọn khoảng ngày...' }
    );
    return opts;
  }, [isCurrentlyInFirstOperatingMonth]);

  const handleTimeRangeChange = (val) => {
    setCustomWarning('');
    if (val === 'by_month') {
      onChange({
        ...filters,
        timeRange: 'by_month',
        month: selectedMonth,
        year: selectedYear,
        page: 1,
      });
    } else if (val === 'custom') {
      const safeStart =
        localStart && localStart >= CINEMA_OPERATION_MIN_DATE
          ? localStart
          : CINEMA_OPERATION_MIN_DATE;
      setLocalStart(safeStart);
      onChange({
        ...filters,
        timeRange: 'custom',
        customStart: safeStart,
        customEnd: localEnd,
        page: 1,
      });
    } else {
      onChange({
        ...filters,
        timeRange: val,
        page: 1,
      });
    }
  };

  const handleYearChange = (newYearNum) => {
    const validYear = Math.max(CINEMA_OPERATION_START_YEAR, Number(newYearNum));
    const validMonth =
      validYear === CINEMA_OPERATION_START_YEAR
        ? Math.max(CINEMA_OPERATION_START_MONTH, selectedMonth)
        : selectedMonth;
    onChange({
      ...filters,
      year: validYear,
      month: validMonth,
      page: 1,
    });
  };

  const handleMonthChange = (newMonthNum) => {
    const validMonth =
      selectedYear === CINEMA_OPERATION_START_YEAR
        ? Math.max(CINEMA_OPERATION_START_MONTH, Number(newMonthNum))
        : Number(newMonthNum);
    onChange({
      ...filters,
      month: validMonth,
      year: selectedYear,
      page: 1,
    });
  };

  const handleApplyCustom = () => {
    if (localStart && localStart < CINEMA_OPERATION_MIN_DATE) {
      setCustomWarning(
        "Rạp D'AVENOR CINEMA bắt đầu hoạt động từ ngày 01/11/2026. Vui lòng chọn ngày từ 01/11/2026 trở đi."
      );
      return;
    }
    if (localEnd && localEnd < CINEMA_OPERATION_MIN_DATE) {
      setCustomWarning(
        "Rạp D'AVENOR CINEMA bắt đầu hoạt động từ ngày 01/11/2026. Ngày kết thúc không được trước 01/11/2026."
      );
      return;
    }
    if (localStart && localEnd && localEnd < localStart) {
      setCustomWarning('Ngày kết thúc không được nhỏ hơn ngày bắt đầu.');
      return;
    }
    setCustomWarning('');
    onChange({
      ...filters,
      timeRange: 'custom',
      customStart: localStart || CINEMA_OPERATION_MIN_DATE,
      customEnd: localEnd,
      page: 1,
    });
  };

  const activeMoviesCount = Array.isArray(movies) ? movies.length : 0;

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-3 sm:p-4 space-y-3 shadow-lg">
      {/* 4 Bộ lọc dùng chung: Thời gian, Phim, Loại phòng chiếu, Phòng chiếu vật lý */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showMovieFilter ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
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
            value={filters.timeRange || 'by_month'}
            onChange={(e) => handleTimeRangeChange(e.target.value)}
            className="bg-transparent text-white font-semibold outline-none w-full cursor-pointer truncate"
          >
            {timeOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[var(--bg-secondary)] text-white py-1">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Dropdown Phim (Chỉ liệt kê các bộ phim thực sự hoạt động trong kỳ báo cáo & phạm vi phòng đang chọn) */}
        {showMovieFilter && (
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
              className="bg-transparent text-white font-semibold outline-none w-full cursor-pointer truncate"
            >
              <option value="ALL" className="bg-[var(--bg-secondary)] text-white">
                {activeMoviesCount > 0
                  ? `Tất cả phim trong kỳ (${activeMoviesCount} phim)`
                  : 'Chưa có phim xếp lịch trong kỳ'}
              </option>
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
                roomId: 'ALL',
                room: 'ALL',
                page: 1,
              })
            }
            className="bg-transparent text-white font-semibold outline-none w-full cursor-pointer truncate"
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
                room: e.target.value,
                page: 1,
              })
            }
            className="bg-transparent text-white font-semibold outline-none w-full cursor-pointer truncate"
          >
            <option value="ALL" className="bg-[var(--bg-secondary)] text-white">
              Tất cả 9 phòng vật lý (792 ghế)
            </option>
            {rooms
              .filter((r) => !filters.roomType || filters.roomType === 'ALL' || r.roomType === filters.roomType)
              .map((r) => (
                <option key={r.id || r._id} value={r.id || r._id} className="bg-[var(--bg-secondary)] text-white">
                  {r.name} ({r.totalSeats || 88} ghế)
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Lọc theo tháng & năm cụ thể (khi chọn 'by_month') */}
      {filters.timeRange === 'by_month' && (
        <div className="pt-2.5 border-t border-[var(--border-default)]/80 flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>Chọn kỳ báo cáo tháng:</span>
            </span>
            <div className="flex items-center space-x-2">
              <select
                aria-label="Chọn tháng báo cáo"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-[var(--bg-surface)] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold outline-none focus:border-cyan-400 text-xs cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value} className="bg-[var(--bg-secondary)] text-white">
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Chọn năm báo cáo"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="bg-[var(--bg-surface)] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold outline-none focus:border-cyan-400 text-xs cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y} className="bg-[var(--bg-secondary)] text-white">
                    Năm {y}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-slate-500 text-[11px] italic">
              (Rạp hoạt động từ 01/11/2026 • Múi giờ chuẩn Asia/Ho_Chi_Minh)
            </span>
          </div>

          {(filters.movieId !== 'ALL' || (filters.roomType && filters.roomType !== 'ALL') || (filters.roomId && filters.roomId !== 'ALL')) && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  movieId: 'ALL',
                  roomType: 'ALL',
                  roomId: 'ALL',
                  room: 'ALL',
                  page: 1,
                })
              }
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      )}

      {/* Tùy chọn khoảng ngày tùy chỉnh (khi chọn 'custom') */}
      {filters.timeRange === 'custom' && (
        <div className="pt-2.5 border-t border-[var(--border-default)]/80 space-y-2 text-xs animate-fadeIn">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400 font-semibold flex items-center space-x-1">
              <span>Khoảng ngày tùy chọn (Từ 01/11/2026):</span>
            </span>
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">Từ</span>
              <input
                type="date"
                min={CINEMA_OPERATION_MIN_DATE}
                value={localStart}
                onChange={(e) => {
                  setLocalStart(e.target.value);
                  setCustomWarning('');
                }}
                className="bg-[var(--bg-surface)] border border-slate-700 rounded-lg px-2.5 py-1 text-white font-medium outline-none focus:border-cyan-400 text-xs"
              />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">Đến</span>
              <input
                type="date"
                min={localStart && localStart >= CINEMA_OPERATION_MIN_DATE ? localStart : CINEMA_OPERATION_MIN_DATE}
                value={localEnd}
                onChange={(e) => {
                  setLocalEnd(e.target.value);
                  setCustomWarning('');
                }}
                className="bg-[var(--bg-surface)] border border-slate-700 rounded-lg px-2.5 py-1 text-white font-medium outline-none focus:border-cyan-400 text-xs"
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
          {customWarning && (
            <div className="text-amber-300 font-semibold text-[11px] bg-amber-950/40 border border-amber-500/40 rounded-lg px-3 py-1.5">
              ⚠️ {customWarning}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatisticsFilter;
