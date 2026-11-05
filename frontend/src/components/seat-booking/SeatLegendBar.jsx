import React from 'react';

const SeatLegendBar = ({
  priceStandard,
  priceVip,
  priceSweetbox,
  selectedSeats,
  timeSlotLabel,
}) => {
  return (
    <div className="w-full">
      {/* 1. THANH CHÚ THÍCH LOẠI GHẾ (LEGEND BAR) */}
      <div className="w-full max-w-4xl mx-auto bg-[#0d1320]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl mt-8 mb-6 space-y-3">
        {/* Banner thông báo chính sách giá vé động */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2.5 border-b border-slate-800/70 gap-2 text-[11px]">
          <div className="flex items-center space-x-2">
            <span className="text-amber-400">🏷️</span>
            <span className="font-bold text-slate-200">
              Khung giờ: <span className="text-blue-400">{timeSlotLabel || 'Tiêu chuẩn'}</span>
            </span>
          </div>
          <span className="text-slate-400 text-[10px]">
            T2 - T5: thường 45k - 50k, VIP 70k • Cuối tuần (T6-CN): 60k - 90k • Suất khuya: từ 50k
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 items-center pt-1">
          {/* 1. Ghế thường */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#141b29] border border-slate-700/70 flex items-center justify-center text-xs font-bold text-slate-300 shadow">
              1
            </div>
            <div>
              <p className="text-xs font-bold text-white">Ghế thường</p>
              <p className="text-[11px] text-blue-400 font-semibold">
                {priceStandard.toLocaleString('vi-VN')} đ
              </p>
            </div>
          </div>

          {/* 2. Ghế VIP */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#182133] border border-amber-500/40 flex items-center justify-center text-[10px] font-black text-amber-400 shadow">
              VIP
            </div>
            <div>
              <p className="text-xs font-bold text-amber-400">Ghế VIP</p>
              <p className="text-[11px] text-amber-300 font-semibold">
                {priceVip.toLocaleString('vi-VN')} đ
              </p>
            </div>
          </div>

          {/* 3. Ghế Sweetbox */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#182133] border border-rose-500/40 flex items-center justify-center text-xs font-bold text-rose-300 shadow">
              ♡
            </div>
            <div>
              <p className="text-xs font-bold text-rose-400">Sweetbox</p>
              <p className="text-[11px] text-rose-300 font-semibold">
                {priceSweetbox.toLocaleString('vi-VN')} đ
              </p>
            </div>
          </div>

          {/* 4. Đang chọn */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#3b82f6] border border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.6)] flex items-center justify-center text-xs font-black text-white">
              ✓
            </div>
            <div>
              <p className="text-xs font-bold text-blue-400">Đang chọn</p>
              <p className="text-[11px] text-slate-200 font-semibold truncate max-w-[120px]">
                {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'Chưa chọn'}
              </p>
            </div>
          </div>

          {/* 5. Đã bán */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#0e1422] border border-slate-800 flex items-center justify-center text-xs font-bold text-slate-600">
              ✕
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Đã bán</p>
              <p className="text-[11px] text-slate-500 font-medium">Không khả dụng</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ĐẶC TÍNH CÔNG NGHỆ PHÒNG CHIẾU */}
      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400 font-medium mb-12 pt-2">
        <div className="flex items-center space-x-2 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Hệ thống Dolby Atmos 128 kênh</span>
        </div>
        <div className="flex items-center space-x-2 text-cyan-400">
          <span>👁</span>
          <span>Màn chiếu IMAX cong 22m x 12m</span>
        </div>
        <div className="flex items-center space-x-2 text-amber-400">
          <span>💺</span>
          <span>Ghế Recliner góc ngả 135°</span>
        </div>
      </div>
    </div>
  );
};

export default SeatLegendBar;
