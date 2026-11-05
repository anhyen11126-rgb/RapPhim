import React from 'react';

const CheckoutPromotions = ({
  voucherCode,
  setVoucherCode,
  isVoucherApplied,
  discountAmount,
  onApplyVoucher,
}) => {
  return (
    <div className="py-4 border-b border-slate-800 space-y-2">
      <label className="block text-[11px] font-bold text-slate-400">
        Mã ưu đãi / Voucher D'AVENOR
      </label>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={voucherCode}
          onChange={(e) => setVoucherCode(e.target.value)}
          placeholder="Nhập mã giảm giá..."
          className="flex-1 bg-[#141b2b] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-bold text-white uppercase tracking-wider focus:outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={onApplyVoucher}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-700"
        >
          Áp dụng
        </button>
      </div>

      {/* Thông báo áp dụng mã */}
      {isVoucherApplied && (
        <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg mt-1.5">
          <span>✓ Đã giảm với '{voucherCode}'</span>
          <span>-{discountAmount.toLocaleString('vi-VN')} đ</span>
        </div>
      )}
    </div>
  );
};

export default CheckoutPromotions;

