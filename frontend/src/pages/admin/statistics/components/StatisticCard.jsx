import React from 'react';

const StatisticCard = ({
  title,
  value,
  exactValue = '',
  growth = null,
  growthLabel = 'so kỳ trước',
  subtitle = '',
  icon,
  iconBg = 'bg-red-500/10 text-red-400',
  tooltip = '',
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 h-full min-h-[128px] flex flex-col justify-between animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-slate-800 rounded w-20"></div>
          <div className="w-7 h-7 bg-slate-800 rounded-lg"></div>
        </div>
        <div className="h-6 bg-slate-800 rounded w-28 my-1"></div>
        <div className="h-2.5 bg-slate-800 rounded w-16"></div>
      </div>
    );
  }

  const isPositive = growth !== null && growth > 0;
  const isNegative = growth !== null && growth < 0;
  const hoverTip = tooltip || exactValue || '';

  return (
    <div
      title={exactValue ? `Giá trị chính xác: ${exactValue}` : tooltip || undefined}
      className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 h-full min-h-[128px] flex flex-col justify-between transition-all relative group shadow-md"
    >
      {/* Tooltip khi hover */}
      {hoverTip && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/95 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 absolute -top-8 left-2 z-20 pointer-events-none shadow-xl whitespace-nowrap">
          {hoverTip}
        </div>
      )}

      {/* Header card: Tiêu đề và Icon nhỏ gọn */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400 truncate">{title}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>

      {/* Số liệu chính: To, Đậm, Màu trắng */}
      <div className="my-1">
        <div className="text-xl sm:text-2xl font-black text-white tracking-tight truncate cursor-default">
          {value}
        </div>
        {exactValue && exactValue !== value && (
          <span className="text-[10px] text-slate-400 hidden group-hover:block font-mono">
            {exactValue}
          </span>
        )}
      </div>

      {/* Footer card: Biến động tăng trưởng nếu có số liệu so sánh */}
      <div className="text-xs min-h-[16px] flex items-center">
        {growth !== null && growth !== undefined ? (
          <div className="flex items-center space-x-1">
            <span
              className={`font-bold text-[11px] flex items-center space-x-0.5 ${
                isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              <span>{isPositive ? '▲ +' : isNegative ? '▼ ' : ''}</span>
              <span>{Math.abs(growth)}%</span>
            </span>
            <span className="text-slate-400 text-[11px] font-normal">{growthLabel}</span>
          </div>
        ) : subtitle ? (
          <span className="text-slate-400 text-[11px] truncate">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
};

export default StatisticCard;
