import React from 'react';

const SeatBottomActionBar = ({
  selectedSeats,
  totalAmount,
  onResetSeats,
  onProceed,
  holdingLoading,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#11152F]/95 backdrop-blur-2xl border-t border-[#AA9BFF]/25 py-3 shadow-2xl">
      <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Cụm bên trái: Ghế đã chọn + Tạm tính vé */}
        <div className="flex items-center space-x-4 sm:space-x-6 flex-wrap">
          <div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#BEC5E5] block mb-1">
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
                      className="bg-[#20204B] border border-[#AA9BFF]/40 text-[#83F5FF] font-bold px-2 py-0.5 rounded text-xs flex items-center gap-1 shadow-sm"
                    >
                      <span>{seatId}</span>
                      {isVip && <span className="text-[10px] text-[#A855F7] font-bold">(VIP)</span>}
                      {isSweetbox && (
                        <span className="text-[10px] text-pink-400 font-bold">(SWEETBOX)</span>
                      )}
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-[#BEC5E5]/50 italic">Chưa chọn ghế</span>
              )}
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-[#AA9BFF]/20"></div>

          <div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#BEC5E5] block mb-0.5">
              TẠM TÍNH VÉ
            </span>
            <p className="text-xl sm:text-2xl font-black text-[#42DFFF] tracking-tight">
              {totalAmount.toLocaleString('vi-VN')}{' '}
              <span className="text-xs font-bold text-[#42DFFF]/80">đ</span>
            </p>
          </div>
        </div>

        {/* Cụm bên phải: Nút Chọn lại + Nút Tiếp tục chọn bắp nước */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end pr-28 sm:pr-32">
          <button
            type="button"
            onClick={onResetSeats}
            className="px-4 py-2 bg-[#20204B] hover:bg-[#25234D] text-[#BEC5E5] hover:text-[#F8F7FF] rounded-xl text-xs sm:text-sm font-bold transition-colors border border-[#AA9BFF]/25 flex items-center space-x-1.5 cursor-pointer shadow"
            title="Bỏ chọn tất cả ghế"
          >
            <span>↺</span>
            <span>Chọn lại</span>
          </button>

          <button
            type="button"
            onClick={onProceed}
            disabled={holdingLoading || selectedSeats.length === 0}
            className={`px-6 sm:px-7 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center space-x-2 cursor-pointer ${
              selectedSeats.length === 0
                ? 'bg-[#20204B] text-[#BEC5E5]/40 border border-[#AA9BFF]/15 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#F9B8FF] via-[#D99BFF] via-[#86DEFF] to-[#B4F7FF] text-[#0B1026] hover:brightness-108 hover:scale-102 shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)]'
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

