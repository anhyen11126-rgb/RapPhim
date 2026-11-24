import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import CheckoutCombos from '../../components/checkout/CheckoutCombos';
import CheckoutPaymentMethods from '../../components/checkout/CheckoutPaymentMethods';
import CheckoutOrderSummary from '../../components/checkout/CheckoutOrderSummary';
import {
  resolveConcessionImage,
  resolveConcessionBadge,
  deduplicateConcessions,
} from '../../utils/visualResolver';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const stateData = location.state || {};
  const showtimeId = stateData.showtimeId || stateData.showtime?._id || stateData.showtime?.id;
  const showtime = stateData.showtime || {
    movie: { title: 'Dune: Hành Tinh Cát 2', ageRating: 'T16' },
    roomName: "D'AVENOR Center (P.3)",
    startTime: new Date(),
  };
  const selectedSeats =
    stateData.selectedSeats && stateData.selectedSeats.length > 0
      ? stateData.selectedSeats
      : ['F6', 'F7'];
  const seatTotal = typeof stateData.seatTotal === 'number' ? stateData.seatTotal : 140000;

  const goBackToSeats = () => {
    if (stateData.returnToSeatHistory) {
      navigate(-1);
    } else if (showtimeId) {
      navigate('/booking/seat/' + encodeURIComponent(showtimeId), {
        replace: true,
        state: { slotInfo: stateData.showtime, draftSeats: stateData.selectedSeats },
      });
    } else {
      navigate('/theaters', { replace: true });
    }
  };

  // Danh sách các vị bắp
  const popcornFlavors = [
    { id: 'sweet', name: 'Ngọt truyền thống', extra: 0 },
    { id: 'cheese', name: 'Phô mai đậm đà', extra: 0 },
    { id: 'caramel', name: 'Caramel giòn rụm (+5k)', extra: 5000 },
    { id: 'seaweed', name: 'Rong biển cay cay', extra: 0 },
  ];
  const [selectedFlavor, setSelectedFlavor] = useState('cheese');

  // Danh mục bắp nước tải từ Database
  const [concessions, setConcessions] = useState([]);
  const [comboQuantities, setComboQuantities] = useState({});

  // Mã giảm giá voucher
  const [voucherCode, setVoucherCode] = useState('');
  const [isVoucherApplied, setIsVoucherApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Phương thức thanh toán
  const [paymentMethod, setPaymentMethod] = useState('VNPAY');

  // Thông tin liên hệ
  const [customerName, setCustomerName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
      return u.name || '';
    } catch {
      return '';
    }
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
      return u.phone || '';
    } catch {
      return '';
    }
  });
  const [customerEmail, setCustomerEmail] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
      return u.email || '';
    } catch {
      return '';
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const checkoutRequest = useRef(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    fetchConcessions();
  }, []);

  const fetchConcessions = async () => {
    try {
      const res = await api.get('/concessions');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const cleaned = deduplicateConcessions(res.data);
        const mapped = cleaned.map((c) => ({
          id: c.id || c._id,
          title: c.name,
          category: c.category,
          badge: resolveConcessionBadge(c),
          desc: c.description || "Sản phẩm phục vụ nóng giòn tại quầy D'AVENOR Express.",
          price: c.price,
          oldPrice: Math.round(c.price * 1.25),
          image: resolveConcessionImage(c),
        }));
        setConcessions(mapped);
      }
    } catch (err) {
      console.warn('Lỗi tải danh mục bắp nước từ DB:', err);
    }
  };

  const handleQuantityChange = (id, delta) => {
    setComboQuantities((prev) => {
      const current = prev[id] || 0;
      const nextVal = Math.max(0, current + delta);
      return { ...prev, [id]: nextVal };
    });
  };

  // Tính tiền combo từ danh mục động
  const comboTotal = concessions.reduce((sum, item) => {
    const flavorExtra = ['COMBO', 'POPCORN'].includes(item.category)
      ? popcornFlavors.find(flavor => flavor.id === selectedFlavor)?.extra ?? 0 : 0;
    return sum + (comboQuantities[item.id] || 0) * (item.price + flavorExtra);
  }, 0);

  // Tổng tiền trước giảm
  const subtotal = seatTotal + comboTotal;
  // Tổng thanh toán cuối cùng
  const grandTotal = Math.max(0, subtotal - (isVoucherApplied ? discountAmount : 0));

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      alert('Vui lòng nhập mã voucher giảm giá!');
      return;
    }
    try {
      const res = await api.post('/promotions/apply', {
        code: voucherCode.trim(),
        totalAmount: subtotal,
      });
      if (res.data?.success) {
        setIsVoucherApplied(true);
        setDiscountAmount(res.data.discountAmount ?? 0);
        alert(
          `✓ Áp dụng thành công mã ${voucherCode.toUpperCase()}: giảm ${(
            res.data.discountAmount ?? 0
          ).toLocaleString('vi-VN')} đ`
        );
      } else {
        alert(res.data?.message || 'Mã giảm giá không hợp lệ');
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Mã voucher không hợp lệ hoặc đã hết hạn!');
    }
  };

  const handleInitiatePayment = () => {
    setShowQRModal(true);
  };

  const executeCheckout = async () => {
    setIsSubmitting(true);
    setShowQRModal(false);
    try {
      const payload = {
        showtimeId: String(showtimeId || showtime?._id || showtime?.id || ''),
        seatNumbers: selectedSeats,
        customerName,
        customerPhone,
        customerEmail,
        combos: concessions.filter(combo => comboQuantities[combo.id] > 0).map(combo => ({
          id: combo.id, quantity: comboQuantities[combo.id],
        })),
        popcornFlavor: selectedFlavor,
        voucherCode: isVoucherApplied ? voucherCode.trim() : undefined,
        paymentMethod,
      };

      try {
        const selection = JSON.stringify(payload);
        if (checkoutRequest.current?.selection !== selection) {
          checkoutRequest.current = { selection, key: crypto.randomUUID() };
        }
        const res = await api.post('/bookings/checkout', payload, {
          headers: { 'Idempotency-Key': checkoutRequest.current.key },
        });
        if (res.data?.success && res.data?.booking) {
          navigate('/booking-success', {
            state: { booking: res.data.booking },
          });
          return;
        }
      } catch (apiErr) {
        console.error('Lỗi khi thực hiện đặt vé & thanh toán:', apiErr);
        const errMsg =
          apiErr.response?.data?.message ||
          'Không thể hoàn tất thanh toán đặt vé. Vui lòng thử lại!';
        alert(`⚠️ ${errMsg}`);

        // Nếu ghế bị xung đột do khách khác vừa mua trước (HTTP 409 Conflict)
        // Đưa khách quay lại trang chọn ghế để cập nhật lại sơ đồ ghế mới nhất
        if (apiErr.response?.status === 409) {
          goBackToSeats();
        }
        return;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] selection:bg-[#42DFFF] selection:text-[#0B1026]">
      {/* 1. THANH TIÊU ĐỀ TRÊN CÙNG: QUAY LẠI + TIẾN TRÌNH 3 BƯỚC (HIỆN RA DẦN DẦN) */}
      <div className="w-full bg-[var(--bg-secondary)]/95 backdrop-blur-xl border-b border-[#AA9BFF]/20 py-3.5 sticky top-0 z-40 shadow-xl animate-smooth-fade">
        <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          {/* Cụm bên trái: Nút Back tròn + Tên phim + Nhãn T16 / IMAX LASER */}
          <div className="flex items-center space-x-3.5">
            <button
              type="button"
              onClick={goBackToSeats}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] border border-slate-700/70 text-slate-200 hover:text-white flex items-center justify-center text-sm transition-all shadow-md shrink-0 cursor-pointer"
              title="Quay lại sơ đồ ghế"
            >
              ←
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white tracking-wide">
                  {showtime?.movie?.title || 'Dune: Hành Tinh Cát 2'}
                </h1>
                <span className="bg-[#f59e0b] text-[#0a1120] font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                  {showtime?.movie?.ageRating || 'T16'}
                </span>
                <span className="bg-[var(--bg-card)] text-[var(--ice-blue)] font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-blue-400/30 uppercase tracking-wider">
                  IMAX LASER
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className="text-[var(--cyan)]">📽</span>
                  <span>{showtime?.roomName || 'Phòng Chiếu 03'}</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className="text-amber-400">🕒</span>
                  <span>Hôm nay 19:15</span>
                </span>
                <span className="text-slate-600">•</span>
                <span>166 phút</span>
              </div>
            </div>
          </div>

          {/* Thanh tiến trình 3 bước chuẩn Mockup */}
          <div className="inline-flex items-center bg-[var(--bg-main)]/90 border border-[var(--border-default)]/80 rounded-full px-4 sm:px-5 py-1.5 shadow-lg backdrop-blur-md overflow-x-auto max-w-full">
            {/* BƯỚC 1: Hoàn thành (Chọn ghế) */}
            <button
              type="button"
              onClick={goBackToSeats}
              className="flex items-center space-x-2 shrink-0 hover:opacity-90 transition-opacity"
            >
              <div className="w-5 h-5 rounded-full bg-[#059669] flex items-center justify-center text-white shadow-sm shrink-0">
                <svg
                  className="w-3 h-3 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  BƯỚC 1
                </span>
                <span className="text-xs font-extrabold text-white leading-tight mt-0.5">
                  Chọn ghế
                </span>
              </div>
            </button>

            <div className="w-10 sm:w-16 h-[1.5px] bg-[#059669] mx-2.5 sm:mx-3 shrink-0"></div>

            {/* BƯỚC 2: Đang ở đây (Đồ ăn & Thanh toán) */}
            <div className="flex items-center space-x-2.5 bg-[var(--bg-card)] border border-[var(--cyan)]/35 rounded-full pl-1.5 pr-3.5 py-1 shadow-[0_0_15px_rgba(37,99,235,0.3)] shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[11px] font-black shadow-sm shrink-0">
                2
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-[var(--ice-blue)] uppercase tracking-wider leading-none">
                  BƯỚC 2
                </span>
                <span className="text-xs font-black text-white leading-tight mt-0.5">
                  Đồ ăn & Thanh toán
                </span>
              </div>
            </div>

            <div className="w-10 sm:w-16 h-[1.5px] bg-slate-700/80 mx-2.5 sm:mx-3 shrink-0"></div>

            {/* BƯỚC 3: Vé điện tử */}
            <div className="flex items-center space-x-2 text-slate-500 shrink-0">
              <div className="w-5 h-5 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-slate-500 text-[10px] font-bold shrink-0">
                3
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider leading-none">
                  BƯỚC 3
                </span>
                <span className="text-xs font-bold text-slate-500 leading-tight mt-0.5">
                  Vé điện tử
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. NỘI DUNG CHÍNH: 2 CỘT */}
      <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CỘT TRÁI (8 CỘT): DANH SÁCH COMBO BẮP NƯỚC */}
          <div className="lg:col-span-7 xl:col-span-8">
            <CheckoutCombos
              popcornFlavors={popcornFlavors}
              selectedFlavor={selectedFlavor}
              setSelectedFlavor={setSelectedFlavor}
              concessions={concessions}
              comboQuantities={comboQuantities}
              onQuantityChange={handleQuantityChange}
            />
          </div>

          {/* CỘT PHẢI (4-5 CỘT): TÓM TẮT ĐƠN HÀNG, PHƯƠNG THỨC THANH TOÁN */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-24">
            <CheckoutOrderSummary
              showtime={showtime}
              selectedSeats={selectedSeats}
              seatTotal={seatTotal}
              concessions={concessions}
              comboQuantities={comboQuantities}
              popcornFlavors={popcornFlavors}
              selectedFlavor={selectedFlavor}
              subtotal={subtotal}
              grandTotal={grandTotal}
              voucherCode={voucherCode}
              setVoucherCode={value => { setVoucherCode(value); setIsVoucherApplied(false); }}
              isVoucherApplied={isVoucherApplied}
              discountAmount={discountAmount}
              onApplyVoucher={handleApplyVoucher}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              paymentMethod={paymentMethod}
              isSubmitting={isSubmitting}
              onInitiatePayment={handleInitiatePayment}
              showQRModal={showQRModal}
              setShowQRModal={setShowQRModal}
              onExecuteCheckout={executeCheckout}
            />

            <CheckoutPaymentMethods
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
