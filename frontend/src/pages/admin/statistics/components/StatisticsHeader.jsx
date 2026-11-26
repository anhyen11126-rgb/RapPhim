import React, { useState } from 'react';

const StatisticsHeader = ({
  lastUpdated,
  hasError = false,
  onRefresh,
  onExport,
  isRefreshing = false,
  isExporting = false,
  activeTab = 'overview',
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleSelectExport = (type) => {
    setShowExportMenu(false);
    if (onExport) onExport(type);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-default)] pb-3.5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Thống kê & Báo cáo
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Theo dõi doanh thu, vé bán, công suất 9 phòng chiếu vật lý (792 ghế) và lợi nhuận từng bộ phim.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Thời gian cập nhật gần nhất - Chỉ hiển thị khi API tải thành công, không hiển thị "Vừa xong" khi API lỗi */}
        {lastUpdated && !hasError ? (
          <div className="flex items-center space-x-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] px-3 py-1.5 rounded-xl text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>
              Cập nhật: <strong className="text-white font-medium">{lastUpdated}</strong>
            </span>
          </div>
        ) : hasError ? (
          <div className="flex items-center space-x-2 bg-rose-950/60 border border-rose-500/40 px-3 py-1.5 rounded-xl text-xs text-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>Chưa đồng bộ được dữ liệu</span>
          </div>
        ) : null}

        {/* Nút Làm mới dữ liệu */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-1.5 bg-[var(--bg-surface)] hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
          title="Làm mới dữ liệu từ hệ thống"
        >
          <svg
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>{isRefreshing ? 'Đang nạp...' : 'Làm mới'}</span>
        </button>

        {/* Nút Xuất báo cáo */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className="flex items-center space-x-1.5 cinema-action active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-violet-700/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>{isExporting ? 'Đang xuất...' : 'Xuất báo cáo'}</span>
            <svg className="w-3 h-3 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-[var(--bg-secondary)] border border-slate-700 rounded-2xl shadow-2xl py-1.5 z-30 animate-fadeIn text-xs">
              <div className="px-3 py-1.5 font-bold text-slate-400 border-b border-[var(--border-default)] text-[10px] uppercase tracking-wider">
                Chọn mẫu báo cáo (Excel/CSV UTF-8)
              </div>
              <button
                type="button"
                onClick={() => handleSelectExport('overview')}
                className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--bg-surface)] text-slate-200 flex items-center justify-between cursor-pointer"
              >
                <span>Báo cáo Tổng hợp tháng & 9 phòng</span>
                <span className="text-[10px] text-cyan-400 font-semibold">CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectExport('revenue')}
                className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--bg-surface)] text-slate-200 flex items-center justify-between cursor-pointer"
              >
                <span>Báo cáo Doanh thu, Chi phí & Lợi nhuận</span>
                <span className="text-[10px] text-emerald-400 font-semibold">CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectExport('movies')}
                className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--bg-surface)] text-slate-200 flex items-center justify-between cursor-pointer"
              >
                <span>Báo cáo Tỷ lệ bán vé & Lợi nhuận Phim</span>
                <span className="text-[10px] text-violet-400 font-semibold">CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectExport('showtimes')}
                className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--bg-surface)] text-slate-200 flex items-center justify-between cursor-pointer"
              >
                <span>Báo cáo Chi tiết Suất chiếu</span>
                <span className="text-[10px] text-amber-400 font-semibold">CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatisticsHeader;
