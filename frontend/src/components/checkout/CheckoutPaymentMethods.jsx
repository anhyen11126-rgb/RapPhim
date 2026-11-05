import React from 'react';

const CheckoutPaymentMethods = ({ paymentMethod, setPaymentMethod }) => {
  return (
    <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center text-xs">
            💳
          </span>
          <span>Phương thức thanh toán</span>
        </span>
        <span className="text-[10px] text-slate-400 font-medium">Bảo mật PCI-DSS 256-bit</span>
      </div>

      {/* 4 Lựa chọn thanh toán với logo và icon phụ */}
      <div className="space-y-2.5">
        {/* 1. VNPAY-QR */}
        <div
          onClick={() => setPaymentMethod('VNPAY')}
          className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
            paymentMethod === 'VNPAY'
              ? 'bg-[#151f33] border-blue-500/80 shadow-md shadow-blue-500/10'
              : 'bg-[#121828] hover:bg-[#182136] border-slate-800/90'
          }`}
        >
          {/* Custom Radio Button */}
          <div className="shrink-0 flex items-center justify-center">
            {paymentMethod === 'VNPAY' ? (
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center bg-blue-500/20 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600"></div>
            )}
          </div>

          {/* Logo VNPAY */}
          <div className="w-12 h-8 rounded-lg bg-[#140b0f] border border-red-500/30 flex items-center justify-center font-black text-[11px] text-red-500 tracking-tighter shrink-0 shadow-sm">
            VNPAY
          </div>

          {/* Nội dung text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-white">VNPAY-QR</span>
              <span className="text-[9px] bg-amber-500 text-[#0c1017] px-1.5 py-0.2 rounded font-black tracking-tight">
                Khuyên dùng
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Quét mã QR từ 30+ ứng dụng ngân hàng
            </p>
          </div>

          {/* Icon QR Code */}
          <div className="text-slate-400 shrink-0 pr-1" title="Quét mã QR">
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
        </div>

        {/* 2. MoMo */}
        <div
          onClick={() => setPaymentMethod('MOMO')}
          className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
            paymentMethod === 'MOMO'
              ? 'bg-[#151f33] border-blue-500/80 shadow-md shadow-blue-500/10'
              : 'bg-[#121828] hover:bg-[#182136] border-slate-800/90'
          }`}
        >
          <div className="shrink-0 flex items-center justify-center">
            {paymentMethod === 'MOMO' ? (
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center bg-blue-500/20 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600"></div>
            )}
          </div>

          <div className="w-12 h-8 rounded-lg bg-[#a50064] flex items-center justify-center font-black text-[11px] text-white tracking-tight shrink-0 shadow-sm">
            MoMo
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-xs font-black text-white block">Ví điện tử MoMo</span>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Hoàn tiền 5% cho thành viên Vàng
            </p>
          </div>

          <span className="text-slate-500 text-sm shrink-0 pr-1">›</span>
        </div>

        {/* 3. ATM Nội địa (NAPAS) */}
        <div
          onClick={() => setPaymentMethod('ATM')}
          className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
            paymentMethod === 'ATM'
              ? 'bg-[#151f33] border-blue-500/80 shadow-md shadow-blue-500/10'
              : 'bg-[#121828] hover:bg-[#182136] border-slate-800/90'
          }`}
        >
          <div className="shrink-0 flex items-center justify-center">
            {paymentMethod === 'ATM' ? (
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center bg-blue-500/20 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600"></div>
            )}
          </div>

          <div className="w-12 h-8 rounded-lg bg-[#0e1d2f] border border-cyan-500/40 flex items-center justify-center font-black text-[10px] text-cyan-400 tracking-wider shrink-0 shadow-sm">
            NAPAS
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-xs font-black text-white block">
              Thẻ ATM nội địa (Internet Banking)
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Tất cả ngân hàng tại Việt Nam
            </p>
          </div>

          <div className="text-slate-400 shrink-0 pr-1">
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2"></rect>
              <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
          </div>
        </div>

        {/* 4. Thẻ Quốc Tế (VISA / Mastercard) */}
        <div
          onClick={() => setPaymentMethod('VISA')}
          className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
            paymentMethod === 'VISA'
              ? 'bg-[#151f33] border-blue-500/80 shadow-md shadow-blue-500/10'
              : 'bg-[#121828] hover:bg-[#182136] border-slate-800/90'
          }`}
        >
          <div className="shrink-0 flex items-center justify-center">
            {paymentMethod === 'VISA' ? (
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center bg-blue-500/20 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600"></div>
            )}
          </div>

          <div className="w-12 h-8 rounded-lg bg-[#0f172a] border border-slate-700 flex items-center justify-center space-x-1 shrink-0 shadow-sm">
            <span className="font-black text-[9px] text-[#2563eb] italic">VISA</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block -ml-0.5"></span>
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block -ml-1"></span>
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-xs font-black text-white block">
              Thẻ thanh toán Quốc Tế
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Visa, Mastercard, JCB, American Express
            </p>
          </div>

          <span className="text-slate-500 text-sm shrink-0 pr-1">›</span>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPaymentMethods;

