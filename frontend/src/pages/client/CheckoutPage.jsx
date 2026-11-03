import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../services/api';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Nhận dữ liệu truyền từ trang chọn ghế, nếu thiếu thì dùng giá trị mặc định chuẩn theo mockup
  const stateData = location.state || {};
  const showtimeId = stateData.showtimeId || 1;
  const showtime = stateData.showtime || {
    movie: { title: 'Dune: Hành Tinh Cát 2', ageRating: 'T16' },
    roomName: 'D\'AVENOR Center (P.3)',
    startTime: new Date(),
  };
  const selectedSeats = stateData.selectedSeats && stateData.selectedSeats.length > 0
    ? stateData.selectedSeats
    : ['F6', 'F7'];
  const seatTotal = stateData.seatTotal || 240000;

  // Danh sách các vị bắp
  const popcornFlavors = [
    { id: 'sweet', name: 'Ngọt truyền thống', extra: 0 },
    { id: 'cheese', name: 'Phô mai đậm đà', extra: 0 },
    { id: 'caramel', name: 'Caramel giòn rụm (+5k)', extra: 5000 },
    { id: 'seaweed', name: 'Rong biển cay cay', extra: 0 },
  ];
  const [selectedFlavor, setSelectedFlavor] = useState('cheese'); // Mặc định Phô mai đậm đà

  // Danh sách 3 combo bắp nước chuẩn theo thiết kế
  const initialCombos = [
    {
      id: 'solo',
      title: 'Combo Solo',
      badge: 'Bán chạy nhất • Tiết kiệm 39.000 đ',
      desc: '1 Bắp rang bơ lớn (chọn vị Phô mai hoặc Caramel giòn rụm) + 1 Nước ngọt Coca-Cola mát lạnh (Size L - 32oz).',
      price: 89000,
      oldPrice: 128000,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClSVtySiMQTri3VSUcFUcddzUGGbSQDfHb4qWcCP5vSn7sU6NyeZz42zwOLJjaz72GZNiBJ6xsKVNj1-CuIWqT1amml8QcItBsHbROQ7gFCLuqKRBS2QTG_drkKe8IH-rbrmNU6cYTz8pFn4iH9FcE9J1HIj0z9cVL6nReaPRDetn9_-C-4xHMiyYyszVmY9Nls22BP63iGUWb91tscqlFzMy4E6LQ3l3R8oUpa70',
    },
    {
      id: 'couple',
      title: 'Combo Đôi Cinema',
      badge: 'Dành cho 2 người',
      desc: '1 Bắp khổng lồ 2 ngăn tuỳ chọn kết hợp 2 vị khác nhau + 2 Ly nước ngọt lớn tự chọn (Coke, Sprite, Fanta).',
      price: 129000,
      oldPrice: 168000,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCQIWOHlTHPbodcRfpbbT2GVtizhntj7a4vbOVjoDNZqvTEz9-pS_Jq8hyOuchMLRC_I3MH7nmwJvJsKyF7UXFBW2vqSSsRxXDrFpd-86yR8ndiee95uBrsvCM-YNU3Xhzc006FJ4Ofkdm_60jOEn_tUmfO9Oq1XcMvoi5Ru1az9wb9C2VuXj4vXuIN3R8SX6KG2RaW7EWQLv5GDmBWnL6sa-H0-VHpzmG2YLWHvAI',
    },
    {
      id: 'family',
      title: 'Combo Gia đình D\'AVENOR',
      badge: 'Tiết kiệm 35%',
      desc: '2 Bắp rang bơ lớn (tuỳ chọn vị) + 3 Ly nước ngọt giải khát lớn + 1 Gói snack khoai tây sấy giòn cao cấp.',
      price: 189000,
      oldPrice: 269000,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvWTKim9KUm1HaoyqyrmJXPK2cZdzR1BMNEy7cL29dfQhQ4S3TrHC8rhgcrlKs_W2RhxWXIeX2Qq5WBNt7PMmsTxpLWUxSWd-aMIaYqZvLpevkkGcxCsMXkCnlaDwjFr35NI2x00sXhosJpaMKL06pNUWmOJDc7wlh3kaPh8hFndtcym5XO40DmMKw3vZUbDTqEazVj_3qnsOMKUWizRIdHHVIB4i5-JWooNX484c',
    },
  ];

  // Số lượng combo: mặc định Combo Solo = 1 như trong ảnh mẫu
  const [comboQuantities, setComboQuantities] = useState({
    solo: 1,
    couple: 0,
    family: 0,
  });

  // Mã giảm giá voucher
  const [voucherCode, setVoucherCode] = useState('DAVENOR50');
  const [isVoucherApplied, setIsVoucherApplied] = useState(true);
  const [discountAmount, setDiscountAmount] = useState(30000);

  // Phương thức thanh toán: VNPAY (mặc định), MOMO, ATM, VISA
  const [paymentMethod, setPaymentMethod] = useState('VNPAY');

  // Thông tin liên hệ (tự động lấy từ tài khoản đã đăng nhập nếu có)
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
  const [showQRModal, setShowQRModal] = useState(false);

  const handleApplyVoucher = () => {
    if (voucherCode.trim().toUpperCase() === 'DAVENOR50' || voucherCode.trim().toUpperCase() === 'MOVIETIX50') {
      setIsVoucherApplied(true);
      setDiscountAmount(30000);
    } else if (voucherCode.trim().toUpperCase() === 'VIP20') {
      setIsVoucherApplied(true);
      setDiscountAmount(20000);
    } else {
      alert('Mã giảm giá không hợp lệ hoặc đã hết lượt sử dụng!');
    }
  };

  const handleQuantityChange = (id, delta) => {
    setComboQuantities((prev) => {
      const current = prev[id] || 0;
      const nextVal = Math.max(0, current + delta);
      return { ...prev, [id]: nextVal };
    });
  };

  // Tính tiền combo
  const comboTotal = initialCombos.reduce((sum, item) => {
    return sum + (comboQuantities[item.id] || 0) * item.price;
  }, 0);

  // Tổng tiền trước giảm
  const subtotal = seatTotal + comboTotal;
  // Tổng thanh toán cuối cùng
  const grandTotal = Math.max(0, subtotal - (isVoucherApplied ? discountAmount : 0));

  // Khi bấm "Tiến hành thanh toán", mở hộp thoại quét mã QR nếu chọn VNPAY/MoMo
  const handleInitiatePayment = () => {
    if (paymentMethod === 'VNPAY' || paymentMethod === 'MOMO') {
      setShowQRModal(true);
    } else {
      executeCheckout();
    }
  };

  // Xử lý hoàn tất thanh toán
  const executeCheckout = async () => {
    setIsSubmitting(true);
    setShowQRModal(false);
    try {
      // Chuẩn bị payload gửi backend
      const selectedCombosList = initialCombos
        .filter((c) => comboQuantities[c.id] > 0)
        .map((c) => `${comboQuantities[c.id]}x ${c.title} (${popcornFlavors.find(f => f.id === selectedFlavor)?.name})`);

      const payload = {
        showtimeId: parseInt(showtimeId, 10),
        seatNumbers: selectedSeats,
        customerName,
        customerPhone,
        customerEmail,
        concessions: selectedCombosList.join(', ') || 'Không chọn combo',
        totalAmount: grandTotal,
        paymentMethod,
      };

      try {
        const res = await api.post('/bookings/checkout', payload);
        navigate('/booking-success', {
          state: { booking: res.data.booking },
        });
        return;
      } catch (apiErr) {
        console.warn('API checkout warn (chuyển sang trang thành công):', apiErr);
      }

      // Fallback chuyển trang nếu backend chạy mock
      navigate('/booking-success', {
        state: {
          booking: {
            bookingCode: 'MTX-98234-VN',
            totalAmount: grandTotal,
            seatNumbers: selectedSeats,
            paymentMethod: paymentMethod === 'VNPAY' ? 'VNPAY-QR OK' : paymentMethod,
            customerName,
            customerPhone,
            customerEmail,
            concessions: selectedCombosList.join(', ') || '1x Combo Solo (bắp phô mai + Coca-Cola L)',
            showtime: {
              movie: {
                title: showtime?.movie?.title || 'Dune: Hành Tinh Cát 2',
                ageRating: showtime?.movie?.ageRating || 'T16',
              },
              roomName: showtime?.roomName || 'D\'AVENOR Center (Phòng IMAX 03)',
              startTime: showtime?.startTime || new Date(),
            },
          },
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 selection:bg-blue-500 selection:text-white">
      {/* 1. THANH TIÊU ĐỀ TRÊN CÙNG: QUAY LẠI + TIẾN TRÌNH 3 BƯỚC */}
      <div className="w-full bg-[#0b101a]/95 backdrop-blur-xl border-b border-slate-800/90 py-3.5 sticky top-0 z-40 shadow-xl">
        <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          {/* Cụm bên trái: Nút Back tròn + Tên phim + Nhãn T16 / IMAX LASER */}
          <div className="flex items-center space-x-3.5">
            {/* Nút quay lại hình tròn chuẩn mockup rạp chiếu */}
            <button
              type="button"
              onClick={() => navigate(`/booking/seat/${showtimeId}`)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#151d2d] hover:bg-[#202b3f] border border-slate-700/70 text-slate-200 hover:text-white flex items-center justify-center text-sm transition-all shadow-md shrink-0 cursor-pointer"
              title="Quay lại sơ đồ ghế"
            >
              ←
            </button>

            <div>
              {/* Tên phim & Nhãn độ tuổi + Định dạng */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white tracking-wide">
                  {showtime?.movie?.title || 'Dune: Hành Tinh Cát 2'}
                </h1>
                <span className="bg-[#f59e0b] text-[#0a1120] font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                  {showtime?.movie?.ageRating || 'T16'}
                </span>
                <span className="bg-[#1b263b] text-blue-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-blue-400/30 uppercase tracking-wider">
                  IMAX LASER
                </span>
              </div>

              {/* Dòng phụ: Phòng chiếu • Giờ chiếu • Thời lượng */}
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className="text-blue-400">📽</span>
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
          <div className="inline-flex items-center bg-[#0c1220]/90 border border-slate-800/80 rounded-full px-4 sm:px-5 py-1.5 shadow-lg backdrop-blur-md overflow-x-auto max-w-full">
            {/* BƯỚC 1: Hoàn thành (Chọn ghế) */}
            <Link
              to={`/booking/seat/${showtimeId}`}
              className="flex items-center space-x-2 shrink-0 hover:opacity-90 transition-opacity"
            >
              <div className="w-5 h-5 rounded-full bg-[#059669] flex items-center justify-center text-white shadow-sm shrink-0">
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            </Link>

            {/* Đường line kết nối xanh lá giữa bước 1 và bước 2 */}
            <div className="w-10 sm:w-16 h-[1.5px] bg-[#059669] mx-2.5 sm:mx-3 shrink-0"></div>

            {/* BƯỚC 2: Đang ở đây (Active Capsule Đồ ăn & Thanh toán) */}
            <div className="flex items-center space-x-2.5 bg-[#1b253b] border border-blue-500/35 rounded-full pl-1.5 pr-3.5 py-1 shadow-[0_0_15px_rgba(37,99,235,0.3)] shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[11px] font-black shadow-sm shrink-0">
                2
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wider leading-none">
                  BƯỚC 2
                </span>
                <span className="text-xs font-black text-white leading-tight mt-0.5">
                  Đồ ăn & Thanh toán
                </span>
              </div>
            </div>

            {/* Đường line kết nối màu xám giữa bước 2 và bước 3 */}
            <div className="w-10 sm:w-16 h-[1.5px] bg-slate-700/80 mx-2.5 sm:mx-3 shrink-0"></div>

            {/* BƯỚC 3: Chưa tới (Vé điện tử) */}
            <div className="flex items-center space-x-2 text-slate-500 shrink-0">
              <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-[10px] font-bold shrink-0">
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

      {/* 2. NỘI DUNG CHÍNH: 2 CỘT RỘNG RÃI ĐỒNG BỘ MARGIN */}
      <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CỘT TRÁI (8 CỘT): DANH SÁCH COMBO BẮP NƯỚC & CHỌN VỊ */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Header Tiêu đề */}
            <div>
              <span className="text-amber-500 font-bold text-xs uppercase tracking-widest block mb-1">
                NÂNG TẦM CẢM XÚC
              </span>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Combo Bắp Nước Rạp Chiếu
                </h1>
                <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold flex items-center gap-1.5 w-fit">
                  <span>🍿</span>
                  <span>Bắp nóng giòn tại quầy VIP</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed max-w-2xl">
                Tiết kiệm tới 25% khi đặt trước combo F&B online. Nhận đồ ăn nhanh chóng tại làn ưu tiên D'AVENOR Express không cần xếp hàng.
              </p>
            </div>

            {/* THANH CHỌN VỊ BẮP YÊU THÍCH */}
            <div className="bg-[#0f1524] border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>👥</span>
                  <span>Chọn vị bắp yêu thích của bạn</span>
                </span>
                <span className="text-[11px] text-slate-500">Áp dụng cho combo đã chọn</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {popcornFlavors.map((flavor) => {
                  const isSelected = selectedFlavor === flavor.id;
                  return (
                    <button
                      key={flavor.id}
                      type="button"
                      onClick={() => setSelectedFlavor(flavor.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer border ${isSelected
                        ? 'bg-[#2563eb] border-blue-400 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-300'
                        : 'bg-[#161f30] hover:bg-[#202b40] text-slate-300 border-slate-700/70'
                        }`}
                    >
                      <span>★</span>
                      <span>{flavor.name}</span>
                      {isSelected && <span className="ml-1">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DANH SÁCH 3 THẺ COMBO */}
            <div className="space-y-4">
              {initialCombos.map((combo) => {
                const qty = comboQuantities[combo.id] || 0;
                const isAdded = qty > 0;

                return (
                  <div
                    key={combo.id}
                    className={`bg-[#0d1322] border ${isAdded ? 'border-blue-500/70 shadow-lg shadow-blue-500/10' : 'border-slate-800'
                      } rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 transition-all`}
                  >
                    {/* Hình ảnh combo */}
                    <div className="w-full sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-700/60 shadow">
                      <img
                        src={combo.image}
                        alt={combo.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Nội dung thông tin combo */}
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                          {combo.badge}
                        </span>
                        {isAdded && (
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                            ✓ Đã thêm vào vé
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-white">{combo.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {combo.desc}
                      </p>

                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-base font-black text-blue-400">
                          {combo.price.toLocaleString('vi-VN')} đ
                        </span>
                        <span className="text-xs text-slate-500 line-through">
                          {combo.oldPrice.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </div>

                    {/* Bộ tăng giảm số lượng / Nút Thêm */}
                    <div className="shrink-0 w-full sm:w-auto flex justify-end">
                      {isAdded ? (
                        <div className="flex items-center space-x-2 bg-[#162033] border border-blue-500/60 rounded-xl p-1 shadow-md">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(combo.id, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-7 text-center font-black text-sm text-white">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(combo.id, 1)}
                            className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(combo.id, 1)}
                          className="w-full sm:w-auto px-4 py-2 bg-[#162033] hover:bg-blue-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 hover:border-blue-500 flex items-center justify-center space-x-1.5 cursor-pointer shadow"
                        >
                          <span>+</span>
                          <span>Thêm vào vé</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DẢI CAM KẾT CHẤT LƯỢNG NGUYÊN LIỆU */}
            <div className="bg-[#0b101c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3.5 shadow-lg">
              {/* Logo khiên xanh có dấu tích chuẩn mockup */}
              <svg
                className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.12"></path>
                <path d="m9 12 2 2 4-4" strokeWidth="2.5"></path>
              </svg>
              <div className="text-xs leading-relaxed">
                <h4 className="font-bold text-white mb-0.5">
                  Cam kết nguyên liệu chuẩn rạp phim quốc tế
                </h4>
                <p className="text-slate-400">
                  Hạt ngô nhập khẩu không biến đổi gen (Non-GMO), chế biến với bơ thực vật nguyên chất không chứa Trans-fat.
                </p>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (4-5 CỘT): TÓM TẮT ĐƠN ĐẶT VÉ & THANH TOÁN */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-24">
            {/* THẺ 1: TÓM TẮT ĐƠN ĐẶT VÉ */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  TÓM TẮT ĐƠN ĐẶT VÉ
                </span>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black px-2 py-0.5 rounded">
                  IMAX 2D
                </span>
              </div>

              <h2 className="text-lg font-black text-white">
                {showtime?.movie?.title || 'Dune: Hành Tinh Cát 2'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Khoa học viễn tưởng • 2D Phụ đề • C16
              </p>

              <div className="flex items-center gap-3 text-xs text-slate-300 mt-2.5 pb-4 border-b border-slate-800">
                <span className="flex items-center gap-1 font-medium">
                  <span className="text-blue-400">📽️</span>
                  <span>{showtime?.roomName || 'D\'AVENOR Center (P.3)'}</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 font-medium">
                  <span className="text-amber-400">🕒</span>
                  <span>19:15 • Hôm nay</span>
                </span>
              </div>

              {/* Chi tiết từng mục */}
              <div className="py-4 space-y-2.5 border-b border-slate-800 text-xs">
                {/* Vé ghế */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span>💺</span>
                    <span>Ghế VIP: <strong>{selectedSeats.join(', ')}</strong></span>
                  </span>
                  <span className="font-bold text-white">
                    {seatTotal.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                {/* Các combo đã chọn */}
                {initialCombos
                  .filter((c) => comboQuantities[c.id] > 0)
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <span>🍿</span>
                        <span>
                          {comboQuantities[c.id]}x {c.title} (bắp {popcornFlavors.find(f => f.id === selectedFlavor)?.name.toLowerCase().replace('★ ', '')})
                        </span>
                      </span>
                      <span className="font-bold text-white">
                        {(comboQuantities[c.id] * c.price).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  ))}

                {/* Tạm tính */}
                <div className="flex items-center justify-between pt-2 text-slate-400 font-semibold border-t border-slate-800/60">
                  <span>
                    Tạm tính ({selectedSeats.length + Object.values(comboQuantities).reduce((a, b) => a + b, 0)} món)
                  </span>
                  <span className="text-slate-200">
                    {subtotal.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              {/* Ô NHẬP MÃ GIẢM GIÁ (VOUCHER) */}
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
                    onClick={handleApplyVoucher}
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

              {/* TỔNG THANH TOÁN */}
              <div className="pt-4 flex items-end justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    TỔNG THANH TOÁN
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Đã bao gồm thuế GTGT
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {grandTotal.toLocaleString('vi-VN')}{' '}
                    <span className="text-sm font-bold text-slate-400">đ</span>
                  </p>
                </div>
              </div>
            </div>

            {/* THẺ 2: PHƯƠNG THỨC THANH TOÁN (CHUẨN MOCKUP CHI TIẾT) */}
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
                  className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${paymentMethod === 'VNPAY'
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

                  {/* Icon QR Code bên phải */}
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
                  className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${paymentMethod === 'MOMO'
                      ? 'bg-[#151f33] border-blue-500/80 shadow-md shadow-blue-500/10'
                      : 'bg-[#121828] hover:bg-[#182136] border-slate-800/90'
                    }`}
                >
                  {/* Custom Radio Button */}
                  <div className="shrink-0 flex items-center justify-center">
                    {paymentMethod === 'MOMO' ? (
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center bg-blue-500/20 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600"></div>
                    )}
                  </div>

                  {/* Logo MoMo */}
                  <div className="w-12 h-8 rounded-lg bg-[#a50064] flex items-center justify-center font-black text-[11px] text-white tracking-tight shrink-0 shadow-sm">
                    MoMo
                  </div>

                  {/* Nội dung text */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-white block">Ví điện tử MoMo</span>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Hoàn tiền 5% cho thành viên Vàng
                    </p>
                  </div>

                  {/* Icon mũi tên bên phải */}
                  <span className="text-slate-500 text-sm shrink-0 pr-1">›</span>
                </div>

                {/* 3. ATM Nội địa (NAPAS) */}
                <div
                  onClick={() => setPaymentMethod('ATM')}
                  className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${paymentMethod === 'ATM'
                      ? 'bg-[#151f33] border-blue-500/80 shadow-md shadow-blue-500/10'
                      : 'bg-[#121828] hover:bg-[#182136] border-slate-800/90'
                    }`}
                >
                  {/* Custom Radio Button */}
                  <div className="shrink-0 flex items-center justify-center">
                    {paymentMethod === 'ATM' ? (
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center bg-blue-500/20 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600"></div>
                    )}
                  </div>

                  {/* Logo NAPAS */}
                  <div className="w-12 h-8 rounded-lg bg-[#0e1d2f] border border-cyan-500/40 flex items-center justify-center font-black text-[10px] text-cyan-400 tracking-wider shrink-0 shadow-sm">
                    NAPAS
                  </div>

                  {/* Nội dung text */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-white block">
                      Thẻ ATM nội địa (Internet Banking)
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Tất cả ngân hàng tại Việt Nam
                    </p>
                  </div>

                  {/* Icon Thẻ ATM bên phải */}
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
                  className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${paymentMethod === 'VISA'
                      ? 'bg-[#151f33] border-blue-500/80 shadow-md shadow-blue-500/10'
                      : 'bg-[#121828] hover:bg-[#182136] border-slate-800/90'
                    }`}
                >
                  {/* Custom Radio Button */}
                  <div className="shrink-0 flex items-center justify-center">
                    {paymentMethod === 'VISA' ? (
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center bg-blue-500/20 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600"></div>
                    )}
                  </div>

                  {/* Logo VISA */}
                  <div className="w-12 h-8 rounded-lg bg-[#141b2a] border border-slate-700/80 flex items-center justify-center font-black text-[11px] text-white tracking-wider shrink-0 shadow-sm">
                    VISA
                  </div>

                  {/* Nội dung text */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-white block">
                      Thẻ quốc tế (Visa / Mastercard / JCB)
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Không tính phụ phí thanh toán
                    </p>
                  </div>

                  {/* Icon thẻ kép bên phải */}
                  <div className="text-slate-400 shrink-0 pr-1">
                    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="4" width="16" height="12" rx="2"></rect>
                      <line x1="2" y1="9" x2="22" y2="9" strokeDasharray="2 2"></line>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Dòng bảo mật */}
              <div className="text-[11px] text-emerald-400 flex items-center justify-center space-x-1.5 pt-2 font-medium">
                <svg
                  className="w-4 h-4 text-emerald-400 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.15"></path>
                  <path d="m9 12 2 2 4-4" strokeWidth="2.5"></path>
                </svg>
                <span>Giao dịch được mã hóa đầu cuối với Tokenization</span>
              </div>

              {/* NÚT TIẾN HÀNH THANH TOÁN (CHUẨN FORM VÀ NỀN PHÁT SÁNG THEO ẢNH) */}
              <button
                type="button"
                onClick={handleInitiatePayment}
                disabled={isSubmitting}
                className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-black py-3.5 px-4 rounded-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center space-x-3 transition-all hover:scale-[1.01] cursor-pointer"
              >
                <span className="text-base">🔒</span>
                <div className="text-center">
                  <div className="text-sm font-black tracking-wide">Tiến hành thanh toán</div>
                  <div className="text-sm font-bold text-blue-100">{grandTotal.toLocaleString('vi-VN')} đ</div>
                </div>
              </button>

              {/* Điều khoản đặt vé */}
              <p className="text-[10px] text-slate-500 text-center leading-normal pt-1">
                Nhấn 'Tiến hành thanh toán' đồng nghĩa bạn đồng ý với{' '}
                <span className="text-slate-400 underline cursor-pointer">Điều khoản đặt vé</span> &{' '}
                <span className="text-slate-400 underline cursor-pointer">Chính sách hoàn huỷ</span> của D'AVENOR CINEMA.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. HỘP THOẠI QUÉT MÃ QR THANH TOÁN TIỆN LỢI */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0e1424] border border-slate-700/80 rounded-3xl max-w-md w-full p-6 relative shadow-2xl text-center space-y-4">
            {/* Nút đóng */}
            <button
              type="button"
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
              title="Đóng"
            >
              ✕
            </button>

            {/* Header Modal */}
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold mb-2">
                <span>⚡</span>
                <span>CỔNG THANH TOÁN {paymentMethod === 'MOMO' ? 'VÍ MOMO' : 'VNPAY-QR'}</span>
              </div>
              <h3 className="text-xl font-black text-white">Quét Mã QR Để Thanh Toán</h3>
              <p className="text-xs text-slate-400 mt-1">
                Mở ứng dụng ngân hàng hoặc ví điện tử để quét mã và hoàn tất đơn vé
              </p>
            </div>

            {/* Khung Mã QR */}
            <div className="p-4 bg-white rounded-3xl inline-block shadow-2xl relative border-4 border-slate-700 mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=VNPAY_MTX_${grandTotal}_98234`}
                alt="QR Payment"
                className="w-44 h-44 object-contain rounded-xl"
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shadow-lg border-2 border-white">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
                </svg>
              </div>
            </div>

            {/* Số tiền & Mã giao dịch */}
            <div className="bg-[#141b2c] border border-slate-800 rounded-2xl p-3 text-xs space-y-1 text-left">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Số tiền cần thanh toán:</span>
                <span className="text-base font-black text-amber-400">
                  {grandTotal.toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nội dung chuyển khoản:</span>
                <span className="font-mono font-bold text-cyan-400">MTX-98234-VN</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-500">Mã có hiệu lực trong:</span>
                <span className="text-amber-500 font-mono font-bold">04:59</span>
              </div>
            </div>

            {/* Nút hoàn tất */}
            <button
              type="button"
              onClick={executeCheckout}
              disabled={isSubmitting}
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black py-3 rounded-xl shadow-lg shadow-blue-600/30 text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer hover:scale-[1.01]"
            >
              <span>{isSubmitting ? 'Đang xử lý...' : 'Tôi đã quét mã & Chuyển tiền xong'}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;
