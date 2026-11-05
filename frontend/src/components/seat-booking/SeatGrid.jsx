import React from 'react';

const SeatGrid = ({
  standardRows,
  vipRows,
  leftCols,
  rightCols,
  bookedSeats,
  selectedSeats,
  onSeatClick,
  priceStandard,
  priceVip,
  priceSweetbox,
}) => {
  const isBooked = (seatId) => bookedSeats.includes(seatId);

  const renderSeat = (seatId, colNumber, isVip = false) => {
    const booked = isBooked(seatId);
    const selected = selectedSeats.includes(seatId);

    if (booked) {
      return (
        <button
          key={seatId}
          type="button"
          disabled
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#0e1422] border border-slate-800/80 text-slate-600 flex items-center justify-center text-xs font-semibold cursor-not-allowed select-none"
          title={`Ghế ${seatId} - Đã bán`}
        >
          ✕
        </button>
      );
    }

    if (selected) {
      return (
        <button
          key={seatId}
          type="button"
          onClick={() => onSeatClick(seatId)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#3b82f6] border border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.7)] text-white flex items-center justify-center text-xs font-black transition-all transform scale-105 cursor-pointer"
          title={`Ghế ${seatId} - Đang chọn`}
        >
          ✓
        </button>
      );
    }

    if (isVip) {
      return (
        <button
          key={seatId}
          type="button"
          onClick={() => onSeatClick(seatId)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#182133] hover:bg-[#23314d] border border-amber-500/30 text-amber-100/90 hover:border-amber-400 flex items-center justify-center text-xs font-bold transition-all cursor-pointer shadow-sm"
          title={`Ghế VIP ${seatId} - ${priceVip.toLocaleString('vi-VN')} đ`}
        >
          {colNumber}
        </button>
      );
    }

    return (
      <button
        key={seatId}
        type="button"
        onClick={() => onSeatClick(seatId)}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#141b29] hover:bg-[#1e2a40] border border-slate-700/60 text-slate-300 hover:border-blue-400 flex items-center justify-center text-xs font-semibold transition-all cursor-pointer shadow-sm"
        title={`Ghế ${seatId} - ${priceStandard.toLocaleString('vi-VN')} đ`}
      >
        {colNumber}
      </button>
    );
  };

  return (
    <div>
      {/* 1. MÀN HÌNH CHIẾU CONG PHÁT SÁNG */}
      <div className="relative w-full max-w-2xl mx-auto pt-4 pb-12 text-center">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4/5 h-16 bg-cyan-500/15 blur-3xl rounded-full pointer-events-none"></div>
        <div className="relative mx-auto h-3.5 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-t-[140px] shadow-[0_4px_30px_rgba(34,211,238,0.7)] border-t border-cyan-300/80"></div>

        <div className="mt-5 inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-[#0d1424]/90 border border-slate-700/80 text-[11px] font-bold tracking-widest uppercase text-slate-300 shadow-xl backdrop-blur-md">
          <span className="text-cyan-400 text-xs">🖥️</span>
          <span>MÀN HÌNH CHIẾU Ở HƯỚNG NÀY</span>
        </div>
      </div>

      {/* 2. MA TRẬN GHẾ */}
      <div className="w-full max-w-3xl mx-auto overflow-x-auto pb-6">
        <div className="min-w-[560px] flex flex-col items-center space-y-2.5">
          {/* KHU VỰC GHẾ THƯỜNG (A, B, C, D) */}
          {standardRows.map((row) => (
            <div key={row} className="flex items-center justify-center space-x-2 w-full">
              <span className="w-6 text-xs text-slate-400 font-bold text-center select-none">
                {row}
              </span>

              <div className="flex items-center space-x-1.5 sm:space-x-2">
                {leftCols.map((col) => renderSeat(`${row}${col}`, col, false))}
              </div>

              <div className="w-10 sm:w-12 flex items-center justify-center select-none">
                <span className="text-[9px] font-bold tracking-widest text-slate-600 uppercase">
                  AISLE
                </span>
              </div>

              <div className="flex items-center space-x-1.5 sm:space-x-2">
                {rightCols.map((col) => renderSeat(`${row}${col}`, col, false))}
              </div>

              <span className="w-6 text-xs text-slate-400 font-bold text-center select-none">
                {row}
              </span>
            </div>
          ))}

          {/* DẢI PHÂN CÁCH KHU VỰC VIP PRIME */}
          <div className="w-full max-w-md my-3 flex items-center justify-center">
            <div className="h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent flex-1"></div>
            <span className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-[#0d1320] border border-amber-500/30 rounded-full py-0.5 shadow-sm">
              ★ KHU VỰC VIP PRIME
            </span>
            <div className="h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent flex-1"></div>
          </div>

          {/* KHU VỰC GHẾ VIP (E, F, G) */}
          {vipRows.map((row) => (
            <div key={row} className="flex items-center justify-center space-x-2 w-full">
              <span className="w-6 text-xs text-amber-400 font-bold text-center select-none">
                {row}
              </span>

              <div className="flex items-center space-x-1.5 sm:space-x-2">
                {leftCols.map((col) => renderSeat(`${row}${col}`, col, true))}
              </div>

              <div className="w-10 sm:w-12 flex items-center justify-center select-none">
                <span className="text-[9px] font-bold tracking-widest text-slate-600 uppercase">
                  AISLE
                </span>
              </div>

              <div className="flex items-center space-x-1.5 sm:space-x-2">
                {rightCols.map((col) => renderSeat(`${row}${col}`, col, true))}
              </div>

              <span className="w-6 text-xs text-amber-400 font-bold text-center select-none">
                {row}
              </span>
            </div>
          ))}

          {/* HÀNG GHẾ ĐÔI / SWEETBOX (ROW H) */}
          <div className="flex items-center justify-center space-x-2 w-full pt-4">
            <span className="w-6 text-xs text-slate-400 font-bold text-center select-none">H</span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onSeatClick('H1-2')}
                className={`h-8 px-3 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  selectedSeats.includes('H1-2')
                    ? 'bg-[#3b82f6] border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.7)]'
                    : 'bg-[#182133] hover:bg-[#23314d] border-rose-500/40 text-rose-300'
                }`}
                title={`Ghế đôi Sweetbox H1-2 - ${priceSweetbox.toLocaleString('vi-VN')} đ`}
              >
                <span>♡</span>
                <span>H1-2</span>
              </button>

              <button
                type="button"
                onClick={() => onSeatClick('H3-4')}
                className={`h-8 px-3 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  selectedSeats.includes('H3-4')
                    ? 'bg-[#3b82f6] border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.7)]'
                    : 'bg-[#182133] hover:bg-[#23314d] border-rose-500/40 text-rose-300'
                }`}
                title={`Ghế đôi Sweetbox H3-4 - ${priceSweetbox.toLocaleString('vi-VN')} đ`}
              >
                <span>♡</span>
                <span>H3-4</span>
              </button>
            </div>

            <div className="w-16 sm:w-20 flex items-center justify-center select-none">
              <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">
                SWEETBOX
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onSeatClick('H5-6')}
                className={`h-8 px-3 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  selectedSeats.includes('H5-6')
                    ? 'bg-[#3b82f6] border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.7)]'
                    : 'bg-[#182133] hover:bg-[#23314d] border-rose-500/40 text-rose-300'
                }`}
                title={`Ghế đôi Sweetbox H5-6 - ${priceSweetbox.toLocaleString('vi-VN')} đ`}
              >
                <span>♡</span>
                <span>H5-6</span>
              </button>

              <button
                type="button"
                disabled
                className="h-8 px-3 rounded-lg bg-[#0e1422] border border-slate-800/80 text-slate-600 flex items-center space-x-1 text-xs font-semibold cursor-not-allowed select-none"
                title="Ghế đôi Sweetbox H7-8 - Đã bán"
              >
                <span>✕</span>
                <span>H7-8</span>
              </button>
            </div>

            <span className="w-6 text-xs text-slate-400 font-bold text-center select-none">H</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatGrid;

