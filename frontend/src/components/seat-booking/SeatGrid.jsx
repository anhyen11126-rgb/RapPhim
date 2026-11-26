import React from 'react';
import ImaxSeat from './ImaxSeat';
import DolbySeat from './DolbySeat';
import GoldClassSeat from './GoldClassSeat';

const SeatGrid = ({
  roomType = 'IMAX',
  rows,
  bookedSeats = [],
  holdingOtherSeats = [],
  holdingSelfSeats = [],
  selectedSeats = [],
  onSeatClick,
}) => {
  const isGold = roomType === 'GOLD';
  const isAtmos = roomType === 'ATMOS';
  const isImax = !isGold && !isAtmos;
  const Seat = isGold ? GoldClassSeat : isAtmos ? DolbySeat : ImaxSeat;
  const dividerStyle = isGold
    ? 'border-amber-400/25 bg-amber-500/10 text-amber-200'
    : isAtmos
      ? 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200'
      : 'border-purple-400/25 bg-purple-500/10 text-purple-200';

  const renderSeat = ({ id, seatNumber, col, type }) => (
    <div key={id} className={!isImax && type === 'SWEETBOX' ? 'flex min-w-11 justify-center rounded-md border border-purple-400/30' : undefined}>
      <Seat seatId={seatNumber} number={col}
        isBooked={bookedSeats.includes(seatNumber)}
        isHoldingOther={holdingOtherSeats.includes(seatNumber)}
        isHoldingSelf={holdingSelfSeats.includes(seatNumber)}
        isSelected={selectedSeats.includes(seatNumber)}
        isVip={type !== 'STANDARD'} isPremium={type !== 'STANDARD'}
        onClick={onSeatClick}
      />
    </div>
  );

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



      {rows.length ? (
        <div className="w-full overflow-x-auto pb-2" aria-label="Sơ đồ ghế">
          <div className="mx-auto w-max min-w-[540px] space-y-2">
            {rows.map(({ label, crossAisle, left, right }) => (
              <React.Fragment key={label}>
                {crossAisle && (
                  <div className={`my-3 rounded-lg border py-2 text-center text-xs font-bold ${dividerStyle}`}>
                    VIP PRIME
                  </div>
                )}
                <div className="grid grid-cols-[1.25rem_1fr_2.5rem_1fr_1.25rem] items-center gap-2 text-center">
                  <span className="text-xs font-bold text-cyan-200">{label}</span>
                  <div className="flex min-w-[216px] justify-end gap-1">{left.map(renderSeat)}</div>
                  <div className="text-[8px] font-bold text-slate-400">AISLE</div>
                  <div className="flex min-w-[216px] justify-start gap-1">{right.map(renderSeat)}</div>
                  <span className="text-xs font-bold text-cyan-200">{label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-300">{'Su\u1ea5t chi\u1ebfu ch\u01b0a c\u00f3 s\u01a1 \u0111\u1ed3 gh\u1ebf.'}</p>
      )}

    </div>
  );
};

export default React.memo(SeatGrid);
