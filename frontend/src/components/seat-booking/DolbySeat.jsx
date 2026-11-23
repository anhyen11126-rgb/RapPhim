import React from 'react';

/**
 * ==============================================================================
 * DOLBY ATMOS CINEMA SEAT COMPONENT
 * Kích thước cân đối, chuẩn tỉ lệ như ảnh 3, đệm bo cong mềm mại
 * ==============================================================================
 */
const DolbySeat = ({
  seatId,
  number,
  isBooked,
  isSelected,
  isPremium, // Hàng E, F, G là khu vực Premium có viền Cyan
  onClick,
}) => {
  const handleClick = () => {
    if (!isBooked && onClick) {
      onClick(seatId);
    }
  };

  // 1. TRẠNG THÁI: GHẾ ĐÃ ĐẶT (BOOKED) - KHUNG RÕ NÉT VỚI DẤU ✕ SẮC NÉT
  if (isBooked) {
    return (
      <div
        className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-[33px] md:h-[31px] flex items-center justify-center select-none cursor-not-allowed opacity-90 shrink-0"
        title={`Ghế ${seatId} - Đã bán`}
      >
        <svg viewBox="0 0 38 36" className="w-full h-full">
          <path
            d="M 6 12 C 6 5, 32 5, 32 12 L 32 29 C 32 33, 6 33, 6 29 Z"
            fill="#222438"
            stroke="#64748B"
            strokeWidth="1.2"
          />
          <rect x="8" y="15" width="22" height="14" rx="4" fill="#171829" stroke="#475569" strokeWidth="1" />
          <text
            x="19"
            y="22"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[12px] font-black fill-[#E2E8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          >
            ✕
          </text>
        </svg>
      </div>
    );
  }

  // 2. TRẠNG THÁI: GHẾ ĐANG CHỌN (SELECTED - TÍM HỒNG CÓ DẤU CHECK NHƯ F9)
  if (isSelected) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-[33px] md:h-[31px] flex items-center justify-center cursor-pointer transition-transform transform scale-105 active:scale-95 focus:outline-none group z-10 shrink-0"
        title={`Ghế ${seatId} - Đang chọn`}
      >
        <div className="absolute inset-0 bg-[#A44BFF]/35 blur-md rounded-lg pointer-events-none animate-pulse"></div>
        <svg viewBox="0 0 38 36" className="w-full h-full relative z-10 filter drop-shadow-[0_0_8px_#A44BFF]">
          <defs>
            <linearGradient id={`dolby-sel-${seatId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E34BFF" />
              <stop offset="50%" stopColor="#A44BFF" />
              <stop offset="100%" stopColor="#7B2CFF" />
            </linearGradient>
          </defs>

          <path
            d="M 6 12 C 6 5, 32 5, 32 12 L 32 29 C 32 33, 6 33, 6 29 Z"
            fill={`url(#dolby-sel-${seatId})`}
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />

          <rect x="8" y="15" width="22" height="14" rx="4" fill="#8C35EB" fillOpacity="0.9" />

          <path
            d="M 13 21 L 17 25 L 25 17"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
          />
        </svg>
      </button>
    );
  }

  // 3. TRẠNG THÁI: GHẾ TRỐNG (AVAILABLE)
  const borderColor = isPremium ? '#00D5FF' : '#A44BFF';
  const glowHoverColor = isPremium ? '#00D5FF' : '#D8B4FF';

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-[33px] md:h-[31px] flex items-center justify-center cursor-pointer transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none group shrink-0"
      title={`Ghế Dolby Atmos ${seatId} - ${isPremium ? 'Premium (Âm thanh đỉnh cao)' : 'Tiêu chuẩn'}`}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-30 blur-md rounded-lg transition-opacity duration-200 pointer-events-none"
        style={{ backgroundColor: glowHoverColor }}
      ></div>

      <svg viewBox="0 0 38 36" className="w-full h-full relative z-10 transition-all duration-200">
        <defs>
          <linearGradient id={`dolby-bg-${seatId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#221245" />
            <stop offset="100%" stopColor="#120826" />
          </linearGradient>
        </defs>

        <path
          d="M 6 12 C 6 5, 32 5, 32 12 L 32 29 C 32 33, 6 33, 6 29 Z"
          fill={`url(#dolby-bg-${seatId})`}
          stroke={borderColor}
          strokeWidth={isPremium ? '1.5' : '1.3'}
          className="group-hover:stroke-[#D8B4FF] transition-colors"
        />

        <rect
          x="8"
          y="15"
          width="22"
          height="14"
          rx="4"
          fill="#0C051B"
          stroke={isPremium ? 'rgba(0,213,255,0.45)' : 'rgba(164,75,255,0.35)'}
          strokeWidth="0.8"
        />

        <text
          x="19"
          y="22"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[11px] font-bold fill-[#F8F5FF] group-hover:fill-[#FFFFFF] group-hover:font-black transition-all"
        >
          {number}
        </text>
      </svg>
    </button>
  );
};

export default React.memo(DolbySeat);
