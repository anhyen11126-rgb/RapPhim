import React from 'react';

const StatisticCard = ({
  title,
  value,
  exactValue = '',
  growth = null,
  showGrowthNA = false,
  growthLabel = 'so kỳ trước',
  subtitle = '',
  icon,
  iconBg = 'bg-cyan-500/10 text-cyan-400',
  valueColor = 'text-white',
  tooltip = '',
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-4 sm:p-5 h-full min-h-[128px] flex flex-col justify-between animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-[var(--bg-surface)] rounded w-20"></div>
          <div className="w-7 h-7 bg-[var(--bg-surface)] rounded-lg"></div>
        </div>
        <div className="h-6 bg-[var(--bg-surface)] rounded w-28 my-1"></div>
        <div className="h-2.5 bg-[var(--bg-surface)] rounded w-16"></div>
      </div>
    );
  }

  const isPositive = growth !== null && growth !== undefined && growth > 0;
  const isNegative = growth !== null && growth !== undefined && growth < 0;
  const hoverTip = tooltip || exactValue || '';

  return (
    <div
      title={exactValue ? `Giá trị chính xác: ${exactValue}` : tooltip || undefined}
      className="bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 h-full min-h-[128px] flex flex-col justify-between transition-all relative group shadow-md"
    >
      {/* Tooltip khi hover */}
      {hoverTip && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/95 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 absolute -top-8 left-2 z-20 pointer-events-none shadow-xl whitespace-nowrap max-w-xs truncate">
          {hoverTip}
        </div>
      )}

      {/* Header card: Tiêu đề và Icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400 truncate">{title}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>

      {/* Số liệu chính */}
      <div className="my-1">
        <div className={`text-lg sm:text-xl font-black tracking-tight truncate cursor-default ${valueColor}`}>
          {value}
        </div>
        {exactValue && exactValue !== value && (
          <span className="text-[10px] text-slate-400 block truncate font-mono mt-0.5">
            {exactValue}
          </span>
        )}
      </div>

      {/* Footer card: Biến động tăng trưởng hoặc phụ đề */}
      <div className="text-xs min-h-[16px] flex items-center justify-between gap-1">
        {growth !== null && growth !== undefined ? (
          <div className="flex items-center space-x-1">
            <span
              className={`font-bold text-[11px] flex items-center space-x-0.5 ${
                isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              <span>{isPositive ? '▲ +' : isNegative ? '▼ -' : ''}</span>
              <span>{Math.abs(growth)}%</span>
            </span>
            <span className="text-slate-400 text-[11px] font-normal">{growthLabel}</span>
          </div>
        ) : subtitle ? (
          <span className="text-slate-400 text-[11px] truncate">{subtitle}</span>
        ) : showGrowthNA ? (
          <span className="text-slate-500 text-[10px]">So kỳ trước: N/A (Kỳ trước = 0)</span>
        ) : null}
      </div>
    </div>
  );
};

export default StatisticCard;
