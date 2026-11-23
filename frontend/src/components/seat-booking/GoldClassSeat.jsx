import React from 'react';

/**
 * ==============================================================================
 * GOLD CLASS VIP RECLINER SOFA SEAT COMPONENT
 * Kích thước cân đối, chuẩn tỉ lệ như ảnh 3, ghế sofa VIP có 2 tay vịn
 * ==============================================================================
 */
const GoldClassSeat = ({
  seatId,
  number,
  isBooked,
  isSelected,
  isVip, // Hàng E, F, G, H là khu vực VIP Premium với viền vàng ánh kim
  onClick,
}) => {
  const handleClick = () => {
    if (!isBooked && onClick) {
      onClick(seatId);
    }
  };

  // 1. TRẠNG THÁI: GHẾ ĐÃ ĐẶT (BOOKED) - RÕ NÉT, NỔI BẬT KHUNG GHẾ VÀ DẤU ✕ RÕ RÀNG
  if (isBooked) {
    return (
      <div
        className="relative w-[31px] h-7 sm:w-[35px] sm:h-8 md:w-[37px] md:h-[31px] flex items-center justify-center select-none cursor-not-allowed opacity-90 shrink-0"
        title={`Ghế Sofa VIP ${seatId} - Đã bán`}
      >
        <svg viewBox="0 0 44 38" className="w-full h-full">
          {/* Tựa đầu ghế */}
          <rect x="11" y="2" width="22" height="8" rx="3" fill="#242B3B" stroke="#64748B" strokeWidth="1.2" />
          {/* Tay vịn trái */}
          <rect x="2" y="8" width="8" height="26" rx="3.5" fill="#1C2230" stroke="#64748B" strokeWidth="1.2" />
          {/* Tay vịn phải */}
          <rect x="34" y="8" width="8" height="26" rx="3.5" fill="#1C2230" stroke="#64748B" strokeWidth="1.2" />
          {/* Đệm ngồi */}
          <rect x="11" y="11" width="22" height="21" rx="3.5" fill="#161B26" stroke="#475569" strokeWidth="1.1" />
          {/* Chân ghế */}
          <rect x="13" y="32" width="18" height="3" rx="1.5" fill="#10141D" />
          {/* Dấu ✕ rõ nét nổi bật */}
          <text
            x="22"
            y="21"
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

  // 2. TRẠNG THÁI: GHẾ ĐANG CHỌN (SELECTED - VIỀN HỒNG NEON VÀ GLOW SÁNG NHƯ F9)
  if (isSelected) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="relative w-[31px] h-7 sm:w-[35px] sm:h-8 md:w-[37px] md:h-[31px] flex items-center justify-center cursor-pointer transition-transform transform scale-105 active:scale-95 focus:outline-none group z-10 shrink-0"
        title={`Ghế Sofa VIP ${seatId} - Đang chọn`}
      >
        <div className="absolute inset-0 bg-[#FF85C8]/35 blur-md rounded-xl pointer-events-none animate-pulse"></div>
        <svg viewBox="0 0 44 38" className="w-full h-full relative z-10 filter drop-shadow-[0_0_8px_#FF85C8]">
          <defs>
            <linearGradient id={`gc-sel-${seatId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFAEE2" />
              <stop offset="50%" stopColor="#FF85C8" />
              <stop offset="100%" stopColor="#C73E8A" />
            </linearGradient>
            <linearGradient id={`gc-sel-cushion-${seatId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF70BF" />
              <stop offset="100%" stopColor="#A8286E" />
            </linearGradient>
          </defs>

          <rect
            x="11"
            y="2"
            width="22"
            height="8"
            rx="3"
            fill={`url(#gc-sel-${seatId})`}
            stroke="#FFFFFF"
            strokeWidth="1.2"
          />

          <rect
            x="2"
            y="8"
            width="8"
            height="26"
            rx="3.5"
            fill={`url(#gc-sel-${seatId})`}
            stroke="#FFFFFF"
            strokeWidth="1.3"
          />

          <rect
            x="34"
            y="8"
            width="8"
            height="26"
            rx="3.5"
            fill={`url(#gc-sel-${seatId})`}
            stroke="#FFFFFF"
            strokeWidth="1.3"
          />

          <rect
            x="11"
            y="11"
            width="22"
            height="21"
            rx="3.5"
            fill={`url(#gc-sel-cushion-${seatId})`}
            stroke="#FFFFFF"
            strokeWidth="1.2"
          />

          <line x1="13" y1="17" x2="31" y2="17" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          <line x1="13" y1="26" x2="31" y2="26" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />

          <rect x="13" y="32" width="18" height="3" rx="1.5" fill="#FFE18F" />

          <text
            x="22"
            y="21"
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

  // 3. TRẠNG THÁI: GHẾ TRỐNG (AVAILABLE) - CHUẨN HOÀNG GIA NHƯ ẢNH 1
  // Hàng VIP (E, F, G, H): Ghế sofa da hoàng kim nổi bật với viền vàng ánh kim rực rỡ
  // Hàng Tiêu Chuẩn (A, B, C, D): Ghế da đen huyền đêm vũ trụ đồng bộ với Navbar kèm viền vàng thanh lịch
  const borderColor = isVip ? '#FFD18A' : '#C5A059';
  const armrestFill = isVip ? '#2A1F13' : '#141829';
  const cushionFill = isVip ? '#1F170E' : '#0F1322';

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative w-[31px] h-7 sm:w-[35px] sm:h-8 md:w-[37px] md:h-[31px] flex items-center justify-center cursor-pointer transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none group shrink-0"
      title={`Ghế Recliner Gold Class ${seatId} - ${isVip ? 'VIP Premium (Vàng Hoàng Gia)' : 'Tiêu Chuẩn (Graphite Viền Vàng)'}`}
    >
      <div className="absolute inset-0 bg-[#FFD18A]/0 group-hover:bg-[#FFD18A]/25 blur-md rounded-xl transition-all duration-200 pointer-events-none"></div>

      <svg viewBox="0 0 44 38" className="w-full h-full relative z-10 transition-all duration-200">
        <defs>
          <linearGradient id={`gc-leather-${seatId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isVip ? '#3D2D1B' : '#1C2138'} />
            <stop offset="100%" stopColor={isVip ? '#24190E' : '#121626'} />
          </linearGradient>
        </defs>

        <rect
          x="11"
          y="2"
          width="22"
          height="8"
          rx="3"
          fill={`url(#gc-leather-${seatId})`}
          stroke={borderColor}
          strokeWidth={isVip ? '1.5' : '1.1'}
          className="group-hover:stroke-[#FFF0BE] transition-colors"
        />

        <rect
          x="2"
          y="8"
          width="8"
          height="26"
          rx="3.5"
          fill={armrestFill}
          stroke={borderColor}
          strokeWidth={isVip ? '1.5' : '1.2'}
          className="group-hover:stroke-[#FFF0BE] transition-colors group-hover:filter group-hover:drop-shadow-[0_0_5px_#FFD18A]"
        />

        <rect
          x="34"
          y="8"
          width="8"
          height="26"
          rx="3.5"
          fill={armrestFill}
          stroke={borderColor}
          strokeWidth={isVip ? '1.5' : '1.2'}
          className="group-hover:stroke-[#FFF0BE] transition-colors group-hover:filter group-hover:drop-shadow-[0_0_5px_#FFD18A]"
        />

        <rect
          x="11"
          y="11"
          width="22"
          height="21"
          rx="3.5"
          fill={cushionFill}
          stroke={isVip ? 'rgba(255,209,138,0.85)' : 'rgba(197,160,89,0.6)'}
          strokeWidth={isVip ? '1.2' : '1'}
          className="group-hover:stroke-[#FFD18A] transition-colors"
        />

        <line
          x1="13"
          y1="17"
          x2="31"
          y2="17"
          stroke={isVip ? 'rgba(255,209,138,0.4)' : 'rgba(197,160,89,0.3)'}
          strokeWidth="0.8"
        />
        <line
          x1="13"
          y1="25"
          x2="31"
          y2="25"
          stroke={isVip ? 'rgba(255,209,138,0.4)' : 'rgba(197,160,89,0.3)'}
          strokeWidth="0.8"
        />

        <rect
          x="13"
          y="32"
          width="18"
          height="3"
          rx="1.5"
          fill={isVip ? '#6D4421' : '#1A2033'}
          stroke={borderColor}
          strokeWidth="0.7"
        />

        <text
          x="22"
          y="21"
          textAnchor="middle"
          dominantBaseline="central"
          className={`text-[10px] font-black transition-all ${
            isVip ? 'fill-[#FFF5E5]' : 'fill-[#E2E8F0]'
          } group-hover:fill-[#FFFFFF]`}
        >
          {number}
        </text>
      </svg>
    </button>
  );
};

export default React.memo(GoldClassSeat);
