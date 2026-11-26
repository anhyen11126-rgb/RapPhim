import React from 'react';

/**
 * ==============================================================================
 * IMAX LASER CINEMA SEAT COMPONENT
 * Kích thước cân đối, chuẩn tỉ lệ như ảnh 3, sắc nét công nghệ cao
 * ==============================================================================
 */
const ImaxSeat = ({
  seatId,
  number,
  isBooked,
  isHoldingOther,
  isHoldingSelf,
  isSelected,
  isVip,
  onClick,
}) => {
  const handleClick = () => {
    if (!isBooked && !isHoldingOther && onClick) {
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
          <rect x="7" y="2" width="24" height="6" rx="2.5" fill="#242C3D" stroke="#64748B" strokeWidth="1.2" />
          <rect x="3" y="8" width="32" height="25" rx="5" fill="#1A2232" stroke="#64748B" strokeWidth="1.2" />
          <rect x="6" y="15" width="26" height="15" rx="3" fill="#131B29" stroke="#475569" strokeWidth="1" />
          <text
            x="19"
            y="23"
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

  // 1b. TRẠNG THÁI: GHẾ ĐANG ĐƯỢC KHÁCH KHÁC GIỮ (HOLDING_OTHER)
  if (isHoldingOther) {
    return (
      <div
        className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-[33px] md:h-[31px] flex items-center justify-center select-none cursor-not-allowed opacity-90 shrink-0"
        title={`Ghế ${seatId} - Đang được khách khác giữ`}
      >
        <svg viewBox="0 0 38 36" className="w-full h-full">
          <rect x="7" y="2" width="24" height="6" rx="2.5" fill="#2A1F0D" stroke="#F59E0B" strokeWidth="1.2" />
          <rect x="3" y="8" width="32" height="25" rx="5" fill="#1F1609" stroke="#F59E0B" strokeWidth="1.2" />
          <rect x="6" y="15" width="26" height="15" rx="3" fill="#140E05" stroke="#B45309" strokeWidth="1" />
          <text
            x="19"
            y="23"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[11px] font-black fill-[#FCD34D]"
          >
            ⏳
          </text>
        </svg>
      </div>
    );
  }

  // 2. TRẠNG THÁI: GHẾ ĐANG CHỌN (SELECTED - HỒNG TÍM NEON)
  if (isSelected) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-[33px] md:h-[31px] flex items-center justify-center cursor-pointer transition-transform transform scale-105 active:scale-95 focus:outline-none group z-10 shrink-0"
        title={`Ghế ${seatId} - Đang chọn`}
      >
        <div className="absolute inset-0 bg-[#E34BFF]/35 blur-md rounded-lg pointer-events-none animate-pulse"></div>
        <svg viewBox="0 0 38 36" className="w-full h-full relative z-10 filter drop-shadow-[0_0_8px_#E34BFF]">
          <defs>
            <linearGradient id={`imax-sel-${seatId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF77FF" />
              <stop offset="50%" stopColor="#E34BFF" />
              <stop offset="100%" stopColor="#9B3DFF" />
            </linearGradient>
          </defs>
          <rect x="7" y="2" width="24" height="6" rx="2.5" fill={`url(#imax-sel-${seatId})`} stroke="#FFFFFF" strokeWidth="1.2" />
          <rect x="3" y="8" width="32" height="25" rx="5" fill={`url(#imax-sel-${seatId})`} stroke="#FFFFFF" strokeWidth="1.4" />
          <rect x="6" y="15" width="26" height="15" rx="3" fill="#D638F5" fillOpacity="0.9" />
          <text
            x="19"
            y="23"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[11px] font-black fill-[#FFFFFF] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          >
            {number}
          </text>
        </svg>
      </button>
    );
  }

  // 3. TRẠNG THÁI: GHẾ TRỐNG (AVAILABLE)
  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-[33px] md:h-[31px] flex items-center justify-center cursor-pointer transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none group shrink-0"
      title={`Ghế IMAX ${seatId} - ${isVip ? 'VIP Prime' : 'Tiêu chuẩn'}`}
    >
      <div className="absolute inset-0 bg-[#00D9FF]/0 group-hover:bg-[#00D9FF]/20 blur-md rounded-lg transition-all duration-200 pointer-events-none"></div>

      <svg viewBox="0 0 38 36" className="w-full h-full relative z-10 transition-all duration-200">
        <defs>
          <linearGradient id={`imax-bg-${seatId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0D1E45" />
            <stop offset="100%" stopColor="#071330" />
          </linearGradient>
        </defs>

        <rect
          x="7"
          y="2"
          width="24"
          height="6"
          rx="2.5"
          fill={`url(#imax-bg-${seatId})`}
          stroke={isVip ? '#8B3DFF' : '#00D9FF'}
          strokeWidth="1.2"
          className="group-hover:stroke-[#83F5FF] transition-colors"
        />

        <rect
          x="3"
          y="8"
          width="32"
          height="25"
          rx="5"
          fill={`url(#imax-bg-${seatId})`}
          stroke={isVip ? '#8B3DFF' : '#00D9FF'}
          strokeWidth={isVip ? '1.5' : '1.3'}
          className="group-hover:stroke-[#83F5FF] transition-colors group-hover:filter group-hover:drop-shadow-[0_0_6px_#00D9FF]"
        />

        <rect
          x="6"
          y="15"
          width="26"
          height="15"
          rx="3"
          fill="#060E22"
          stroke={isVip ? 'rgba(139,61,255,0.4)' : 'rgba(0,217,255,0.35)'}
          strokeWidth="0.8"
        />

        <text
          x="19"
          y="23"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[11px] font-bold fill-[#F5FAFF] group-hover:fill-[#FFFFFF] group-hover:font-black transition-all"
        >
          {number}
        </text>
      </svg>
    </button>
  );
};

export default React.memo(ImaxSeat);
