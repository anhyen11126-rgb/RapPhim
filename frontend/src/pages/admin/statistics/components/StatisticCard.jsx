import React from 'react';

const StatisticCard = ({
  title,
  value,
  growth = null,
  growthLabel = 'so kỳ trước',
  icon,
  iconBg = 'bg-red-500/10 text-red-400',
  tooltip = '',
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-slate-800 rounded w-24"></div>
          <div className="w-8 h-8 bg-slate-800 rounded-xl"></div>
        </div>
        <div className="h-7 bg-slate-800 rounded w-36"></div>
        <div className="h-3 bg-slate-800 rounded w-20"></div>
      </div>
    );
  }

  const isPositive = growth !== null && growth > 0;
  const isNegative = growth !== null && growth < 0;

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-3 transition-all relative group shadow-md">
      {/* Tooltip hiển thị khi hover nếu có */}
      {tooltip && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-slate-700 text-slate-200 text-[11px] rounded-lg p-2 absolute -top-9 left-4 z-20 pointer-events-none shadow-xl whitespace-nowrap">
          {tooltip}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">{title}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${iconBg}`}>
          {icon}
        </div>
      </div>

      <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
        {value}
      </div>

      <div className="flex items-center space-x-1.5 text-xs">
        {growth !== null && growth !== undefined ? (
          <>
            <span
              className={`font-bold flex items-center space-x-0.5 ${
                isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              <span>{isPositive ? '▲ +' : isNegative ? '▼ ' : '• '}</span>
              <span>{Math.abs(growth)}%</span>
            </span>
            <span className="text-slate-400 font-normal">{growthLabel}</span>
          </>
        ) : (
          <span className="text-slate-400 text-[11px]">Dữ liệu thực tế thời gian thực</span>
        )}
      </div>
    </div>
  );
};

export default StatisticCard;
