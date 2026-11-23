import React, { useState } from 'react';
import CheckoutPromotions from './CheckoutPromotions';

const CheckoutOrderSummary = ({
  showtime,
  selectedSeats,
  seatTotal,
  concessions,
  comboQuantities,
  popcornFlavors,
  selectedFlavor,
  subtotal,
  grandTotal,
  voucherCode,
  setVoucherCode,
  isVoucherApplied,
  discountAmount,
  onApplyVoucher,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerEmail,
  setCustomerEmail,
  paymentMethod,
  isSubmitting,
  onInitiatePayment,
  showQRModal,
  setShowQRModal,
  onExecuteCheckout,
}) => {
  const [agreedTerms, setAgreedTerms] = useState(true);

  const selectedCombosList = concessions.filter((c) => (comboQuantities[c.id] || 0) > 0);

  return (
    <div className="space-y-6">
      {/* Thẻ 1: Tóm Tắt Đơn Vé */}
      <div className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#BEC5E5]">
            TÓM TẮT ĐƠN ĐẶT VÉ
          </span>
          <span className="bg-[#20204B] text-[#42DFFF] border border-[#42DFFF]/40 text-[10px] font-black px-2 py-0.5 rounded uppercase">
            {showtime?.format || '2D Tiêu Chuẩn'}
          </span>
        </div>

        <h2 className="text-lg font-black text-white">
          {showtime?.movie?.title || 'Dune: Hành Tinh Cát 2'}
        </h2>
        <p className="text-xs text-[#BEC5E5] mt-0.5">
          {showtime?.format || '2D Phụ đề'} • {showtime?.movie?.ageRating || 'T16'}
        </p>

        <div className="flex items-center gap-2 text-xs text-[#BEC5E5] mt-2.5 pb-4 border-b border-[#AA9BFF]/15 flex-wrap">
          {(showtime?.cinemaName || showtime?.cinema?.name) && (
            <>
              <span className="flex items-center gap-1 font-medium">
                <span className="text-red-400">📍</span>
                <span>{showtime?.cinemaName || showtime?.cinema?.name}</span>
              </span>
              <span className="text-slate-600">•</span>
            </>
          )}
          <span className="flex items-center gap-1 font-medium">
            <span className="text-[#42DFFF]">📽️</span>
            <span>{showtime?.roomName || "Phòng Chiếu 01"}</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 font-medium">
            <span className="text-[#83F5FF]">🕒</span>
            <span>{showtime?.time || '19:15'}</span>
          </span>
        </div>

        {/* Chi tiết từng mục */}
        <div className="py-4 space-y-2.5 border-b border-[#AA9BFF]/15 text-xs">
          {/* Vé ghế */}
          <div className="flex items-center justify-between">
            <span className="text-[#BEC5E5] flex items-center gap-1.5">
              <span>💺</span>
              <span>
                Ghế: <strong>{selectedSeats.join(', ')}</strong>
              </span>
            </span>
            <span className="font-bold text-white">
              {seatTotal.toLocaleString('vi-VN')} đ
            </span>
          </div>

          {/* Các combo đã chọn */}
          {selectedCombosList.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-[#BEC5E5]">
              <span className="flex items-center gap-1.5">
                <span>🍿</span>
                <span>
                  {comboQuantities[c.id]}x {c.title} (bắp{' '}
                  {popcornFlavors
                    .find((f) => f.id === selectedFlavor)
                    ?.name.toLowerCase()
                    .replace('★ ', '')}
                  )
                </span>
              </span>
              <span className="font-bold text-white">
                {(comboQuantities[c.id] * c.price).toLocaleString('vi-VN')} đ
              </span>
            </div>
          ))}

          {/* Tạm tính */}
          <div className="flex items-center justify-between pt-2 text-[#BEC5E5] font-semibold border-t border-[#AA9BFF]/15">
            <span>
              Tạm tính ({selectedSeats.length + Object.values(comboQuantities).reduce((a, b) => a + b, 0)} món)
            </span>
            <span className="text-slate-200">
              {subtotal.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>

        {/* Ô NHẬP MÃ VOUCHER */}
        <CheckoutPromotions
          voucherCode={voucherCode}
          setVoucherCode={setVoucherCode}
          isVoucherApplied={isVoucherApplied}
          discountAmount={discountAmount}
          onApplyVoucher={onApplyVoucher}
        />

        {/* TỔNG THANH TOÁN */}
        <div className="pt-4 flex items-end justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#BEC5E5] block">
              TỔNG THANH TOÁN
            </span>
            <span className="text-[10px] text-[#BEC5E5]/60 block">
              Đã bao gồm thuế GTGT
            </span>
          </div>
          <div className="text-right">
            <p className="text-2xl sm:text-3xl font-black text-[#42DFFF] tracking-tight">
              {grandTotal.toLocaleString('vi-VN')}{' '}
              <span className="text-sm font-bold text-[#83F5FF]">đ</span>
            </p>
          </div>
        </div>
      </div>

      {/* Thẻ 2: THÔNG TIN KHÁCH HÀNG & NÚT THANH TOÁN */}
      <div className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl p-5 shadow-2xl space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
          <span>📋</span>
          <span>Thông tin người nhận vé</span>
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[#BEC5E5] font-medium block mb-1">Họ và tên *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#42DFFF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[#BEC5E5] font-medium block mb-1">Số điện thoại *</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0912 345 678"
                className="w-full bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#42DFFF]"
              />
            </div>
            <div>
              <label className="text-[#BEC5E5] font-medium block mb-1">Email nhận vé *</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#42DFFF]"
              />
            </div>
          </div>
        </div>

        {/* Checkbox điều khoản */}
        <label className="flex items-start space-x-2 pt-1 text-[11px] text-[#BEC5E5] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            className="mt-0.5 rounded border-[#AA9BFF]/30 bg-[#0B1026] text-[#42DFFF] focus:ring-0"
          />
          <span>
            Tôi đồng ý với điều khoản dịch vụ và chính sách vé của D'AVENOR CINEMA.
          </span>
        </label>

        {/* Nút bấm tiến hành thanh toán */}
        <button
          type="button"
          onClick={onInitiatePayment}
          disabled={isSubmitting || !agreedTerms}
          className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide transition-all shadow-xl flex items-center justify-center space-x-2 cursor-pointer ${
            !agreedTerms || isSubmitting
              ? 'bg-[#20204B] text-[#BEC5E5]/40 border border-[#AA9BFF]/15 cursor-not-allowed'
              : 'bg-gradient-to-r from-[#F9B8FF] via-[#D99BFF] via-[#86DEFF] to-[#B4F7FF] text-[#0B1026] hover:brightness-108 shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)] hover:scale-[1.01]'
          }`}
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Đang xử lý giao dịch...</span>
            </>
          ) : (
            <>
              <span>Tiến hành thanh toán</span>
              <span>→</span>
            </>
          )}
        </button>
      </div>

      {/* MODAL MÃ QR THANH TOÁN (VNPAY / MOMO) */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#0e1424] border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-black text-white uppercase tracking-wider">
                Quét mã QR để thanh toán
              </span>
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=D_AVENOR_CINEMA_${grandTotal}_VND`}
                alt="QR Thanh Toán"
                className="w-48 h-48 block mx-auto"
              />
            </div>

            <p className="text-xs text-slate-300">
              Sử dụng app <strong>{paymentMethod}</strong> hoặc ngân hàng để quét mã thanh toán <strong>{grandTotal.toLocaleString('vi-VN')} đ</strong>.
            </p>

            <button
              type="button"
              onClick={onExecuteCheckout}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors shadow-lg shadow-emerald-600/30 cursor-pointer"
            >
              ✓ Tôi đã hoàn tất chuyển tiền
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutOrderSummary;

