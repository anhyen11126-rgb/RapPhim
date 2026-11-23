import React from 'react';
import ImaxSeat from './ImaxSeat';
import DolbySeat from './DolbySeat';
import GoldClassSeat from './GoldClassSeat';

/**
 * ==============================================================================
 * THEATRICAL 88-SEAT AUDITORIUM GRID COMPONENT
 * Sơ đồ chuẩn 88 ghế theo tỷ lệ cân đối hoàn hảo như ảnh 3:
 * - Màn hình cong phát sáng viền quang học như ảnh 2 theo từng phòng
 * - Hàng A - D (12 ghế mỗi hàng: 6 trái + AISLE + 6 phải)
 * - Dải phân cách khu vực VIP / Premium ở giữa hàng D và E
 * - Hàng E - G (12 ghế mỗi hàng: 6 trái + AISLE + 6 phải)
 * - Hàng H (4 ghế: 2 trái + AISLE + 2 phải, căn chính giữa 2 cụm)
 * - Nhãn chữ hàng ghế (A - H) ở cả 2 đầu trái và phải
 * ==============================================================================
 */
const SeatGrid = ({
  roomType = 'IMAX', // 'IMAX' | 'ATMOS' | 'GOLD'
  bookedSeats = [],
  selectedSeats = [],
  onSeatClick,
}) => {
  const isImax = roomType === 'IMAX';
  const isAtmos = roomType === 'ATMOS';
  const isGold = roomType === 'GOLD';

  // Định nghĩa danh sách hàng và cột
  const topRows = ['A', 'B', 'C', 'D'];
  const bottomRows = ['E', 'F', 'G'];
  const leftCols = [1, 2, 3, 4, 5, 6];
  const rightCols = [7, 8, 9, 10, 11, 12];

  // Helper kiểm tra ghế đã đặt
  const checkIsBooked = (seatId) => {
    if (bookedSeats.includes(seatId)) return true;
    if (seatId === 'H1' && bookedSeats.includes('H1-2')) return true;
    if (seatId === 'H2' && bookedSeats.includes('H3-4')) return true;
    if (seatId === 'H3' && bookedSeats.includes('H5-6')) return true;
    if (seatId === 'H4' && bookedSeats.includes('H7-8')) return true;
    return false;
  };

  // Helper render 1 ghế theo loại phòng
  const renderSeatComponent = (seatId, number, isVipOrPremium = false) => {
    const isBooked = checkIsBooked(seatId);
    const isSelected = selectedSeats.includes(seatId);

    if (isGold) {
      return (
        <GoldClassSeat
          key={seatId}
          seatId={seatId}
          number={number}
          isBooked={isBooked}
          isSelected={isSelected}
          isVip={isVipOrPremium}
          onClick={onSeatClick}
        />
      );
    }

    if (isAtmos) {
      return (
        <DolbySeat
          key={seatId}
          seatId={seatId}
          number={number}
          isBooked={isBooked}
          isSelected={isSelected}
          isPremium={isVipOrPremium}
          onClick={onSeatClick}
        />
      );
    }

    return (
      <ImaxSeat
        key={seatId}
        seatId={seatId}
        number={number}
        isBooked={isBooked}
        isSelected={isSelected}
        isVip={isVipOrPremium}
        onClick={onSeatClick}
      />
    );
  };

  // Render 1 hàng ghế chuẩn 12 ghế (6 trái + AISLE + 6 phải)
  const renderRow = (row, isVipRow = false) => {
    return (
      <div key={row} className="flex items-center justify-center space-x-1 sm:space-x-1.5 w-full">
        {/* Nhãn hàng ghế bên trái */}
        <span
          className={`w-5 sm:w-6 text-[11px] sm:text-xs font-black text-center select-none ${
            isGold
              ? isVipRow
                ? 'text-[#FFD18A]'
                : 'text-amber-300/80'
              : isAtmos
              ? isVipRow
                ? 'text-[#00D5FF]'
                : 'text-[#D8B4FF]'
              : isVipRow
              ? 'text-[#E34BFF]'
              : 'text-[#00D9FF]'
          }`}
        >
          {row}
        </span>

        {/* 6 ghế cụm trái (1 - 6) */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          {leftCols.map((col) => renderSeatComponent(`${row}${col}`, col, isVipRow))}
        </div>

        {/* LỐI ĐI Ở GIỮA (AISLE) */}
        <div className="w-8 sm:w-10 md:w-12 flex items-center justify-center select-none shrink-0">
          <span
            className={`text-[8px] font-black tracking-widest uppercase opacity-60 ${
              isGold ? 'text-amber-200' : isAtmos ? 'text-cyan-300' : 'text-blue-300'
            }`}
          >
            AISLE
          </span>
        </div>

        {/* 6 ghế cụm phải (7 - 12) */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          {rightCols.map((col) => renderSeatComponent(`${row}${col}`, col, isVipRow))}
        </div>

        {/* Nhãn hàng ghế bên phải */}
        <span
          className={`w-5 sm:w-6 text-[11px] sm:text-xs font-black text-center select-none ${
            isGold
              ? isVipRow
                ? 'text-[#FFD18A]'
                : 'text-amber-300/80'
              : isAtmos
              ? isVipRow
                ? 'text-[#00D5FF]'
                : 'text-[#D8B4FF]'
              : isVipRow
              ? 'text-[#E34BFF]'
              : 'text-[#00D9FF]'
          }`}
        >
          {row}
        </span>
      </div>
    );
  };

  // Render Hàng H (4 ghế: 2 trái + AISLE + 2 phải, căn giữa theo từng cụm)
  const renderRowH = () => {
    return (
      <div className="flex items-center justify-center space-x-1 sm:space-x-1.5 w-full pt-1.5">
        {/* Nhãn hàng H bên trái */}
        <span
          className={`w-5 sm:w-6 text-[11px] sm:text-xs font-black text-center select-none ${
            isGold ? 'text-[#FFD18A]' : isAtmos ? 'text-[#00D5FF]' : 'text-[#E34BFF]'
          }`}
        >
          H
        </span>

        {/* Cụm 6 vị trí bên trái: 2 ghế 1, 2 căn chính giữa */}
        <div className="flex items-center justify-center space-x-1 sm:space-x-1.5 w-[190px] sm:w-[225px] md:w-[245px]">
          {renderSeatComponent('H1', 1, true)}
          {renderSeatComponent('H2', 2, true)}
        </div>

        {/* LỐI ĐI Ở GIỮA (AISLE) */}
        <div className="w-8 sm:w-10 md:w-12 flex items-center justify-center select-none shrink-0">
          <span
            className={`text-[8px] font-black tracking-widest uppercase opacity-60 ${
              isGold ? 'text-amber-200' : isAtmos ? 'text-cyan-300' : 'text-blue-300'
            }`}
          >
            AISLE
          </span>
        </div>

        {/* Cụm 6 vị trí bên phải: 2 ghế 3, 4 căn chính giữa */}
        <div className="flex items-center justify-center space-x-1 sm:space-x-1.5 w-[190px] sm:w-[225px] md:w-[245px]">
          {renderSeatComponent('H3', 3, true)}
          {renderSeatComponent('H4', 4, true)}
        </div>

        {/* Nhãn hàng H bên phải */}
        <span
          className={`w-5 sm:w-6 text-[11px] sm:text-xs font-black text-center select-none ${
            isGold ? 'text-[#FFD18A]' : isAtmos ? 'text-[#00D5FF]' : 'text-[#E34BFF]'
          }`}
        >
          H
        </span>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[760px] mx-auto flex flex-col items-center select-none">
      {/* ==================================================================== */}
      {/* 1. TIÊU ĐỀ PHÒNG CHIẾU NHỎ GỌN & CÂN ĐỐI (NHƯ ẢNH 3)                 */}
      {/* ==================================================================== */}
      <div className="text-center pt-1 pb-3">
        {isGold ? (
          <div>
            <span className="text-xl sm:text-2xl filter drop-shadow-[0_0_10px_rgba(255,209,138,0.7)] leading-none inline-block">
              👑
            </span>
            <h3 className="text-xl sm:text-2xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#FFF4E8] via-[#FFD18A] to-[#E9A4A8] filter drop-shadow-[0_0_12px_rgba(255,209,138,0.6)] mt-0.5">
              GOLD CLASS
            </h3>
            <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-amber-200/80 uppercase mt-0.5">
              PHÒNG CHIẾU CAO CẤP – TRẢI NGHIỆM ĐIỆN ẢNH ĐẲNG CẤP
            </p>
          </div>
        ) : isAtmos ? (
          <div>
            <div className="flex items-center justify-center space-x-1.5 text-xl sm:text-2xl font-black tracking-tight text-white filter drop-shadow-[0_0_12px_rgba(164,75,255,0.7)]">
              <span className="text-[#00D5FF] text-2xl sm:text-3xl">D<span className="scale-x-[-1] inline-block">D</span></span>
              <span>Dolby</span>
              <span className="text-[#D8B4FF]">Atmos<sup className="text-[10px] align-super">®</sup></span>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-cyan-200/80 uppercase mt-0.5">
              HỆ THỐNG ÂM THANH VÒM 360° • KHÔNG GIAN ĐIỆN ẢNH ĐẲNG CẤP
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-xl sm:text-2xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#FFFFFF] via-[#83F5FF] via-[#00D9FF] to-[#E34BFF] filter drop-shadow-[0_0_12px_rgba(0,217,255,0.7)]">
              IMAX<sup className="text-xs not-italic align-super">®</sup> <span className="text-xs sm:text-sm tracking-[0.25em] text-[#E34BFF] uppercase">LASER</span>
            </h3>
            <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-cyan-200/80 uppercase mt-0.5">
              MÀN HÌNH CHIẾU CONG KHỔ LỚN • CÔNG NGHỆ LASER 4K
            </p>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 2. MÀN HÌNH CONG PHÁT SÁNG THEO ĐÚNG HÌNH ẢNH 2                      */}
      {/* ==================================================================== */}
      <div className="relative w-full max-w-[620px] mx-auto text-center mb-4">
        {/* Vệt sáng aura phản chiếu phía trên */}
        <div
          className={`absolute -top-3 left-1/2 -translate-x-1/2 w-4/5 h-12 blur-2xl pointer-events-none rounded-full ${
            isGold
              ? 'bg-gradient-to-r from-transparent via-[#FFD18A]/35 via-[#FF85C8]/25 to-transparent'
              : isAtmos
              ? 'bg-gradient-to-r from-transparent via-[#7B2CFF]/40 via-[#00D5FF]/30 to-transparent'
              : 'bg-gradient-to-r from-transparent via-[#00D9FF]/40 via-[#E34BFF]/30 to-transparent'
          }`}
        ></div>

        {/* Thanh dải sáng cong quang học (Optical Beam Bar như ảnh 2) */}
        <div className="relative mx-auto w-full pt-1 pb-2 flex flex-col items-center">
          <svg
            viewBox="0 0 640 26"
            className="w-full max-w-[620px] h-6 overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`screen-grad-${roomType}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" stopOpacity="0" />
                <stop
                  offset="20%"
                  stopColor={isGold ? '#FFD18A' : isAtmos ? '#7B2CFF' : '#00D9FF'}
                  stopOpacity="0.75"
                />
                <stop
                  offset="48%"
                  stopColor="#FFFFFF"
                  stopOpacity="1"
                />
                <stop
                  offset="52%"
                  stopColor="#FFFFFF"
                  stopOpacity="1"
                />
                <stop
                  offset="80%"
                  stopColor={isGold ? '#FF85C8' : isAtmos ? '#00D5FF' : '#E34BFF'}
                  stopOpacity="0.75"
                />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </linearGradient>

              {/* Bộ lọc phát sáng Glow chuẩn quang học như ảnh 2 */}
              <filter id={`beam-glow-${roomType}`} x="-20%" y="-100%" width="140%" height="300%">
                <feGaussianBlur stdDeviation="4" result="blur1" />
                <feGaussianBlur stdDeviation="1.5" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="blur2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Dải sáng hào quang phía ngoài */}
            <path
              d="M 12 20 Q 320 2.5 628 20"
              stroke={`url(#screen-grad-${roomType})`}
              strokeWidth="5"
              fill="none"
              opacity="0.65"
              filter={`url(#beam-glow-${roomType})`}
              strokeLinecap="round"
            />
            {/* Lõi tia laser sáng sắc nét ở trung tâm */}
            <path
              d="M 16 20 Q 320 3.5 624 20"
              stroke={`url(#screen-grad-${roomType})`}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
            {/* Điểm nhấn lens flare sáng rực ở tâm */}
            <circle
              cx="320"
              cy="4"
              r="2"
              fill="#FFFFFF"
              filter={`url(#beam-glow-${roomType})`}
            />
          </svg>

          {/* Dải gradient mờ phát quang tỏa xuống khán phòng */}
          <div
            className={`h-5 w-4/5 mx-auto -mt-1 opacity-20 rounded-b-full blur-sm ${
              isGold
                ? 'bg-gradient-to-b from-[#FFD18A] to-transparent'
                : isAtmos
                ? 'bg-gradient-to-b from-[#00D5FF] to-transparent'
                : 'bg-gradient-to-b from-[#00D9FF] to-transparent'
            }`}
          ></div>

          {/* Thanh Pill "MÀN HÌNH (...)" nằm ngay dưới vệt sáng (như ảnh 2 & 3) */}
          <div className="mt-1">
            <div
              className={`inline-flex items-center space-x-2 px-5 py-1 rounded-full border shadow-lg backdrop-blur-md transition-all ${
                isGold
                  ? 'bg-[#0A0E23]/95 border-[#FFD18A]/50 shadow-[0_0_15px_rgba(255,209,138,0.3)] text-[#FFF4E8]'
                  : isAtmos
                  ? 'bg-[#1A0C3D]/95 border-[#A44BFF]/50 shadow-[0_0_15px_rgba(164,75,255,0.35)] text-[#F8F5FF]'
                  : 'bg-[#071A42]/95 border-[#00D9FF]/50 shadow-[0_0_15px_rgba(0,217,255,0.35)] text-[#F5FAFF]'
              }`}
            >
              <span className={`text-xs ${isGold ? 'text-[#FFD18A]' : isAtmos ? 'text-[#00D5FF]' : 'text-[#00D9FF]'}`}>
                🖥️
              </span>
              <span className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase">
                {isGold
                  ? 'MÀN HÌNH (GOLD CLASS)'
                  : isAtmos
                  ? 'MÀN HÌNH (DOLBY ATMOS)'
                  : 'MÀN HÌNH (IMAX LASER)'}
              </span>
            </div>
          </div>
        </div>
      </div>



      {/* ==================================================================== */}
      {/* 4. MA TRẬN 88 GHẾ CHUẨN XÁC, CÂN ĐỐI HOÀN TOÀN NHƯ ẢNH 3             */}
      {/* ==================================================================== */}
      <div className="w-full overflow-x-auto pb-2 flex justify-center">
        <div className="min-w-[540px] sm:min-w-[580px] md:min-w-[620px] flex flex-col items-center space-y-1.5 sm:space-y-2">
          {/* HÀNG A - D: 4 HÀNG × 12 GHẾ TIÊU CHUẨN */}
          {topRows.map((row) => renderRow(row, false))}

          {/* DẢI PHÂN CÁCH KHU VỰC PREMIUM / VIP GIỮA HÀNG D VÀ E (NHƯ ẢNH 3) */}
          <div className="w-full max-w-[500px] my-1.5 sm:my-2 flex items-center justify-center">
            {isGold ? (
              <div className="w-full flex items-center justify-center">
                <div className="h-px bg-gradient-to-r from-transparent via-[#FFD18A]/45 to-transparent flex-1"></div>
                <div className="px-3 py-0.5 rounded-full bg-[#0A0E23]/95 border border-[#FFD18A]/45 shadow-[0_0_12px_rgba(255,209,138,0.3)] mx-2 flex items-center space-x-1.5">
                  <span className="text-[#FFD18A] text-[10px]">👑</span>
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-[#FFD18A] uppercase">
                    KHU VỰC VIP PREMIUM
                  </span>
                  <span className="text-[#FFD18A] text-[10px]">👑</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-[#FFD18A]/45 to-transparent flex-1"></div>
              </div>
            ) : isAtmos ? (
              <div className="w-full flex items-center justify-center">
                <div className="h-px bg-gradient-to-r from-transparent via-[#00D5FF]/45 to-transparent flex-1"></div>
                <div className="px-3 py-0.5 rounded-full bg-[#1A0C3D]/95 border border-[#00D5FF]/45 shadow-[0_0_12px_rgba(0,213,255,0.3)] mx-2 flex items-center space-x-1.5">
                  <span className="text-[#00D5FF] text-[10px]">ılı.</span>
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-[#00D5FF] uppercase">
                    KHU VỰC PREMIUM (ÂM THANH ĐỈNH CAO)
                  </span>
                  <span className="text-[#00D5FF] text-[10px]">.ılı</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-[#00D5FF]/45 to-transparent flex-1"></div>
              </div>
            ) : (
              <div className="w-full flex items-center justify-center">
                <div className="h-px bg-gradient-to-r from-transparent via-[#E34BFF]/45 to-transparent flex-1"></div>
                <div className="px-3 py-0.5 rounded-full bg-[#071A42]/95 border border-[#E34BFF]/45 shadow-[0_0_12px_rgba(227,75,255,0.3)] mx-2 flex items-center space-x-1.5">
                  <span className="text-[#E34BFF] text-[10px]">★</span>
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-[#E34BFF] uppercase">
                    KHU VỰC VIP PRIME (GÓC NHÌN ĐẠI DƯƠNG)
                  </span>
                  <span className="text-[#E34BFF] text-[10px]">★</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-[#E34BFF]/45 to-transparent flex-1"></div>
              </div>
            )}
          </div>

          {/* HÀNG E - G: 3 HÀNG × 12 GHẾ VIP / PREMIUM */}
          {bottomRows.map((row) => renderRow(row, true))}

          {/* HÀNG H: 4 GHẾ ĐÔI / RECLINER VIP CĂN GIỮA */}
          {renderRowH()}
        </div>
      </div>
    </div>
  );
};

export default React.memo(SeatGrid);
