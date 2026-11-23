import React from 'react';

/**
 * ==============================================================================
 * FLOATING THEATRICAL SEAT LEGEND & ACTION BAR
 * Thanh chú thích và điều khiển đặt vé cố định ở đáy trang.
 * - Đã xóa bỏ mục "Ghế cho người khuyết tật" theo yêu cầu.
 * - Icon chú thích sử dụng hình thu nhỏ chính xác của từng loại ghế trong phòng.
 * - Đồng bộ bảng màu và phong cách Holographic cho cả 3 phòng.
 * ==============================================================================
 */
const SeatLegendBar = ({
  roomType = 'IMAX', // 'IMAX' | 'ATMOS' | 'GOLD'
  seats = [],
  bookedSeats = [],
  selectedSeats = [],
  totalAmount = 0,
  onProceed,
}) => {
  const isImax = roomType === 'IMAX';
  const isAtmos = roomType === 'ATMOS';
  const isGold = roomType === 'GOLD';

  // Tính toán số lượng ghế thực tế thời gian thực
  const totalSeats = seats.length;
  const bookedCount = bookedSeats.length;
  const selectedCount = selectedSeats.length;
  const availableCount = Math.max(0, totalSeats - bookedCount - selectedCount);
  const occupancyRate = totalSeats > 0 ? ((bookedCount / totalSeats) * 100).toFixed(1) : '0.0';

  const isAvailable = ({ seatNumber }) => !bookedSeats.includes(seatNumber) && !selectedSeats.includes(seatNumber);
  const availableVipCount = seats.filter((seat) => seat.type !== 'STANDARD' && isAvailable(seat)).length;
  const availableStandardCount = availableCount - availableVipCount;

  // Cấu hình viền, nền và màu nút bấm Tiếp tục theo từng phòng
  const barConfig = isGold
    ? {
        barBorder:
          'border-[#FFD18A]/45 shadow-[0_10px_40px_rgba(0,0,0,0.95),0_0_25px_rgba(255,209,138,0.25)]',
        barBg: 'bg-[#0A0E23]/95',
        activeBtnGradient:
          'bg-gradient-to-r from-[#FFD18A] via-[#E5A93C] to-[#FF85C8] text-[#0A0E23] hover:brightness-110 shadow-[0_0_20px_rgba(255,209,138,0.5),0_0_10px_rgba(229,169,60,0.4)]',
        statHighlight: 'text-[#FFD18A]',
      }
    : isAtmos
    ? {
        barBorder:
          'border-[#7B2CFF]/40 shadow-[0_10px_40px_rgba(16,6,37,0.95),0_0_25px_rgba(123,44,255,0.3)]',
        barBg: 'bg-[#100625]/95',
        activeBtnGradient:
          'bg-gradient-to-r from-[#7B2CFF] via-[#A44BFF] to-[#00D5FF] text-white hover:brightness-110 shadow-[0_0_20px_rgba(164,75,255,0.5),0_0_12px_rgba(0,213,255,0.3)]',
        statHighlight: 'text-[#00D5FF]',
      }
    : {
        barBorder:
          'border-[#00D9FF]/40 shadow-[0_10px_40px_rgba(3,13,37,0.95),0_0_25px_rgba(0,217,255,0.3)]',
        barBg: 'bg-[#030D25]/95',
        activeBtnGradient:
          'bg-gradient-to-r from-[#00D9FF] via-[#006DFF] to-[#8B3DFF] text-white hover:brightness-110 shadow-[0_0_20px_rgba(0,217,255,0.5),0_0_12px_rgba(139,61,255,0.3)]',
        statHighlight: 'text-[#00D9FF]',
      };

  return (
    <div className="fixed bottom-3 sm:bottom-5 left-0 right-0 z-50 px-4 sm:px-6 pointer-events-none">
      <div
        className={`max-w-[1360px] mx-auto rounded-full py-2 sm:py-2.5 px-4 sm:px-6 backdrop-blur-2xl border ${barConfig.barBg} ${barConfig.barBorder} flex flex-col md:flex-row items-center justify-between gap-3 pointer-events-auto transition-all duration-300`}
      >
        {/* 1. KHU VỰC CHÚ THÍCH CÁC LOẠI GHẾ (HÌNH THU NHỎ CHUẨN XÁC KÈM SỐ LƯỢNG THỰC TẾ) */}
        <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-center text-[11px] sm:text-xs">
          {/* A. GHẾ TIÊU CHUẨN (STANDARD - HÀNG A-D: 48 GHẾ) */}
          <div className="flex items-center space-x-1.5">
            {isGold ? (
              <svg viewBox="0 0 44 40" className="w-[22px] h-[20px] shrink-0">
                <rect x="11" y="2" width="22" height="9" rx="3" fill="#141829" stroke="#C5A059" strokeWidth="1.3" />
                <rect x="2" y="9" width="8" height="27" rx="3.5" fill="#101424" stroke="#C5A059" strokeWidth="1.3" />
                <rect x="34" y="9" width="8" height="27" rx="3.5" fill="#101424" stroke="#C5A059" strokeWidth="1.3" />
                <rect x="11" y="12" width="22" height="22" rx="3.5" fill="#0D1120" stroke="rgba(197,160,89,0.5)" strokeWidth="1" />
              </svg>
            ) : isAtmos ? (
              <svg viewBox="0 0 38 38" className="w-5 h-5 shrink-0">
                <path d="M 6 12 C 6 5, 32 5, 32 12 L 32 30 C 32 34, 6 34, 6 30 Z" fill="#1A0C3D" stroke="#A44BFF" strokeWidth="1.4" />
                <rect x="8" y="16" width="22" height="14" rx="4" fill="#0C051B" stroke="rgba(164,75,255,0.4)" strokeWidth="0.8" />
              </svg>
            ) : (
              <svg viewBox="0 0 38 38" className="w-5 h-5 shrink-0">
                <rect x="7" y="2" width="24" height="6" rx="2.5" fill="#0C1424" stroke="#00D9FF" strokeWidth="1.4" />
                <rect x="3" y="8" width="32" height="26" rx="5" fill="#071330" stroke="#00D9FF" strokeWidth="1.4" />
                <rect x="6" y="16" width="26" height="15" rx="3" fill="#060E22" stroke="rgba(0,217,255,0.4)" strokeWidth="0.8" />
              </svg>
            )}
            <span className="text-slate-300 font-semibold">Ghế tiêu chuẩn</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-700/60 border border-slate-500/50 text-slate-200 font-black text-[10px] leading-tight">
              {availableStandardCount}
            </span>
          </div>

          {/* B. GHẾ PREMIUM / VIP (NẾU CÓ TRONG PHÒNG) */}
          {isGold && (
            <div className="flex items-center space-x-1.5">
              <svg viewBox="0 0 44 40" className="w-[22px] h-[20px] shrink-0 filter drop-shadow-[0_0_4px_rgba(255,209,138,0.6)]">
                <rect x="11" y="2" width="22" height="9" rx="3" fill="#2A1F13" stroke="#FFD18A" strokeWidth="1.4" />
                <rect x="2" y="9" width="8" height="27" rx="3.5" fill="#1F170E" stroke="#FFD18A" strokeWidth="1.4" />
                <rect x="34" y="9" width="8" height="27" rx="3.5" fill="#1F170E" stroke="#FFD18A" strokeWidth="1.4" />
                <rect x="11" y="12" width="22" height="22" rx="3.5" fill="#17110A" stroke="rgba(255,209,138,0.85)" strokeWidth="1" />
              </svg>
              <span className="text-[#FFD18A] font-bold">Ghế VIP Premium</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-[#FFD18A]/50 text-[#FFD18A] font-black text-[10px] leading-tight shadow-[0_0_8px_rgba(255,209,138,0.25)]">
                {availableVipCount}
              </span>
            </div>
          )}

          {isAtmos && (
            <div className="flex items-center space-x-1.5">
              <svg viewBox="0 0 38 38" className="w-5 h-5 shrink-0 filter drop-shadow-[0_0_4px_rgba(0,213,255,0.5)]">
                <path d="M 6 12 C 6 5, 32 5, 32 12 L 32 30 C 32 34, 6 34, 6 30 Z" fill="#1A0C3D" stroke="#00D5FF" strokeWidth="1.5" />
                <rect x="8" y="16" width="22" height="14" rx="4" fill="#0C051B" stroke="rgba(0,213,255,0.6)" strokeWidth="0.8" />
              </svg>
              <span className="text-[#00D5FF] font-bold">Ghế Premium</span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 border border-[#00D5FF]/50 text-[#00D5FF] font-black text-[10px] leading-tight shadow-[0_0_8px_rgba(0,213,255,0.25)]">
                {availableVipCount}
              </span>
            </div>
          )}

          {isImax && (
            <div className="flex items-center space-x-1.5">
              <svg viewBox="0 0 38 38" className="w-5 h-5 shrink-0 filter drop-shadow-[0_0_4px_rgba(139,61,255,0.5)]">
                <rect x="7" y="2" width="24" height="6" rx="2.5" fill="#130D2E" stroke="#8B3DFF" strokeWidth="1.4" />
                <rect x="3" y="8" width="32" height="26" rx="5" fill="#0D0724" stroke="#8B3DFF" strokeWidth="1.4" />
                <rect x="6" y="16" width="26" height="15" rx="3" fill="#080417" stroke="rgba(139,61,255,0.4)" strokeWidth="0.8" />
              </svg>
              <span className="text-[#E34BFF] font-bold">Ghế VIP Prime</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 border border-[#8B3DFF]/50 text-[#E34BFF] font-black text-[10px] leading-tight shadow-[0_0_8px_rgba(139,61,255,0.25)]">
                {availableVipCount}
              </span>
            </div>
          )}

          {/* C. GHẾ ĐANG CHỌN (SELECTED) */}
          <div className="flex items-center space-x-1.5">
            {isGold ? (
              <svg viewBox="0 0 44 40" className="w-[22px] h-[20px] shrink-0 filter drop-shadow-[0_0_8px_#FF85C8]">
                <rect x="11" y="2" width="22" height="9" rx="3" fill="#FF85C8" stroke="#FFFFFF" strokeWidth="1.3" />
                <rect x="2" y="9" width="8" height="27" rx="3.5" fill="#FF85C8" stroke="#FFFFFF" strokeWidth="1.3" />
                <rect x="34" y="9" width="8" height="27" rx="3.5" fill="#FF85C8" stroke="#FFFFFF" strokeWidth="1.3" />
                <rect x="11" y="12" width="22" height="22" rx="3.5" fill="#A8286E" stroke="#FFFFFF" strokeWidth="1.2" />
                <path d="M 16 23 L 20 27 L 28 19" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : isAtmos ? (
              <svg viewBox="0 0 38 38" className="w-5 h-5 shrink-0 filter drop-shadow-[0_0_8px_#A44BFF]">
                <path d="M 6 12 C 6 5, 32 5, 32 12 L 32 30 C 32 34, 6 34, 6 30 Z" fill="#A44BFF" stroke="#FFFFFF" strokeWidth="1.4" />
                <rect x="8" y="16" width="22" height="14" rx="4" fill="#8C35EB" />
                <path d="M 13 22 L 17 26 L 25 18" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 38 38" className="w-5 h-5 shrink-0 filter drop-shadow-[0_0_8px_#E34BFF]">
                <rect x="7" y="2" width="24" height="6" rx="2.5" fill="#E34BFF" stroke="#FFFFFF" strokeWidth="1.2" />
                <rect x="3" y="8" width="32" height="26" rx="5" fill="#E34BFF" stroke="#FFFFFF" strokeWidth="1.4" />
                <rect x="6" y="16" width="26" height="15" rx="3" fill="#D638F5" />
                <path d="M 13 22 L 17 26 L 25 18" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span className="text-white font-bold">Ghế đang chọn</span>
            <span className="px-1.5 py-0.2 rounded-full bg-pink-500/25 border border-pink-400/50 text-[#FF85C8] font-black text-[10px] leading-tight shadow-[0_0_8px_rgba(255,133,200,0.3)]">
              {selectedCount}
            </span>
          </div>

          {/* D. GHẾ ĐÃ ĐẶT (BOOKED) - KHUNG TITANIUM SLATE RÕ NÉT & DẤU ✕ SẮC SẢO NỔI BẬT */}
          <div className="flex items-center space-x-1.5">
            {isGold ? (
              <svg viewBox="0 0 44 40" className="w-[22px] h-[20px] shrink-0">
                <rect x="11" y="2" width="22" height="9" rx="3" fill="#242B3B" stroke="#64748B" strokeWidth="1.2" />
                <rect x="2" y="9" width="8" height="27" rx="3.5" fill="#1C2230" stroke="#64748B" strokeWidth="1.2" />
                <rect x="34" y="9" width="8" height="27" rx="3.5" fill="#1C2230" stroke="#64748B" strokeWidth="1.2" />
                <rect x="11" y="12" width="22" height="22" rx="3.5" fill="#161B26" stroke="#475569" strokeWidth="1.1" />
                <text x="22" y="23" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#E2E8F0" fontWeight="900">✕</text>
              </svg>
            ) : isAtmos ? (
              <svg viewBox="0 0 38 38" className="w-5 h-5 shrink-0">
                <path d="M 6 12 C 6 5, 32 5, 32 12 L 32 30 C 32 34, 6 34, 6 30 Z" fill="#222438" stroke="#64748B" strokeWidth="1.2" />
                <rect x="8" y="16" width="22" height="14" rx="4" fill="#171829" stroke="#475569" strokeWidth="1" />
                <text x="19" y="23" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#E2E8F0" fontWeight="900">✕</text>
              </svg>
            ) : (
              <svg viewBox="0 0 38 38" className="w-5 h-5 shrink-0">
                <rect x="7" y="2" width="24" height="6" rx="2.5" fill="#242C3D" stroke="#64748B" strokeWidth="1.2" />
                <rect x="3" y="8" width="32" height="26" rx="5" fill="#1A2232" stroke="#64748B" strokeWidth="1.2" />
                <rect x="6" y="16" width="26" height="15" rx="3" fill="#131B29" stroke="#475569" strokeWidth="1" />
                <text x="19" y="24" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#E2E8F0" fontWeight="900">✕</text>
              </svg>
            )}
            <span className="text-slate-300 font-semibold">Ghế đã đặt</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-700/80 border border-slate-600 text-slate-200 font-black text-[10px] leading-tight">
              {bookedCount}
            </span>
          </div>
        </div>

        {/* 2. KHU VỰC THỐNG KÊ CHI TIẾT (TỔNG: 88, TRỐNG: X, ĐÃ BÁN: Y, ĐÃ CHỌN: Z, TỔNG TIỀN) VÀ NÚT TIẾP TỤC */}
        <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
          <div className="flex items-center space-x-2 text-xs sm:text-sm font-semibold text-slate-300">
            <span>
              Tổng:{' '}
              <strong className="text-white font-black">{totalSeats}</strong>
            </span>
            <span className="text-white/20">|</span>
            <span>
              Trống:{' '}
              <strong className="text-emerald-400 font-black">{availableCount}</strong>
            </span>
            <span className="text-white/20">|</span>
            <span>
              Đã bán:{' '}
              <strong className="text-slate-300 font-black">{bookedCount}</strong>
            </span>
            <span className="text-white/20">|</span>
            <span>
              Đang chọn:{' '}
              <strong className={`font-black ${barConfig.statHighlight}`}>
                {selectedSeats.length}
              </strong>
            </span>
            {bookedCount > 0 && (
              <>
                <span className="text-white/20">|</span>
                <span className="text-amber-300/80 font-bold text-[11px] hidden xl:inline">
                  Lấp đầy: <strong className="text-amber-300 font-black">{occupancyRate}%</strong>
                </span>
              </>
            )}
            {totalAmount > 0 && (
              <>
                <span className="text-white/20">|</span>
                <span className="text-white font-black tracking-tight text-sm sm:text-base">
                  {totalAmount.toLocaleString('vi-VN')}{' '}
                  <span className="text-xs font-semibold text-slate-400">đ</span>
                </span>
              </>
            )}
          </div>

          {/* Nút Tiếp tục */}
          <button
            type="button"
            onClick={onProceed}
            disabled={selectedSeats.length === 0}
            className={`px-5 sm:px-7 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-black transition-all duration-200 flex items-center space-x-1.5 cursor-pointer active:scale-95 ${
              selectedSeats.length === 0
                ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                : barConfig.activeBtnGradient
            }`}
          >
            <span>Tiếp tục</span>
            <span className="text-sm">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SeatLegendBar);
