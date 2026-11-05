import React from 'react';

const SeatBottomActionBar = ({
  selectedSeats,
  totalAmount,
  onResetSeats,
  onProceed,
  holdingLoading,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f19]/95 backdrop-blur-2xl border-t border-slate-800/90 py-3 shadow-2xl">
      <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Cụm bên trái: Ghế đã chọn + Tạm tính vé */}
        <div className="flex items-center space-x-4 sm:space-x-6 flex-wrap">
          <div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              GHẾ ĐÃ CHỌN ({selectedSeats.length} GHẾ)
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedSeats.length > 0 ? (
                selectedSeats.map((seatId) => {
                  const isVip = ['E', 'F', 'G'].some((r) => seatId.startsWith(r));
                  const isSweetbox = seatId.startsWith('H');
                  return (
                    <span
                      key={seatId}
                      className="bg-blue-600/20 border border-blue-500/60 text-blue-300 font-bold px-2 py-0.5 rounded text-xs flex items-center gap-1 shadow-sm"
                    >
                      <span>{seatId}</span>
                      {isVip && <span className="text-[10px] text-amber-400 font-bold">(VIP)</span>}
                      {isSweetbox && (
                        <span className="text-[10px] text-rose-400 font-bold">(SWEETBOX)</span>
                      )}
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-slate-500 italic">Chưa chọn ghế</span>
              )}
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-slate-800"></div>

          <div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
              TẠM TÍNH VÉ
            </span>
            <p className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
              {totalAmount.toLocaleString('vi-VN')}{' '}
              <span className="text-xs font-bold text-amber-500/80">đ</span>
            </p>
          </div>
        </div>

        {/* Cụm bên phải: Nút Chọn lại + Nút Tiếp tục chọn bắp nước */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end pr-28 sm:pr-32">
          <button
            type="button"
            onClick={onResetSeats}
            className="px-4 py-2 bg-[#161f30] hover:bg-[#202b40] text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm font-bold transition-colors border border-slate-700/80 flex items-center space-x-1.5 cursor-pointer shadow"
            title="Bỏ chọn tất cả ghế"
          >
            <span>↺</span>
            <span>Chọn lại</span>
          </button>

          <button
            type="button"
            onClick={onProceed}
            disabled={holdingLoading || selectedSeats.length === 0}
            className={`px-6 sm:px-7 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center space-x-2 shadow-lg shadow-blue-500/25 cursor-pointer ${
              selectedSeats.length === 0
                ? 'bg-blue-600/40 text-blue-200/50 cursor-not-allowed'
                : 'bg-[#3b82f6] hover:bg-[#2563eb] text-white hover:scale-102'
            }`}
          >
            <span>{holdingLoading ? 'Đang giữ ghế...' : 'Tiếp tục chọn bắp nước'}</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SeatBottomActionBar;

