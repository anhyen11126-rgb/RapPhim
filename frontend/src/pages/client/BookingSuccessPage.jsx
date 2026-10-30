import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';

const BookingSuccessPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const booking = location.state?.booking;

  // Dữ liệu đặt vé chuẩn xác từ kết quả thực tế
  const ticketData = {
    bookingCode: booking?.bookingCode || 'MTX-98234-VN',
    customerName: booking?.customerName || 'Nguyễn Văn An',
    customerEmail: booking?.customerEmail || 'nguyenvanan@gmail.com',
    customerPhone: booking?.customerPhone || '(+84) 0912 345 678',
    movieTitle: booking?.showtime?.movie?.title || 'Dune: Hành Tinh Cát 2',
    movieAgeRating: booking?.showtime?.movie?.ageRating || 'T16',
    theaterName: 'MovieTix Center',
    roomName: booking?.showtime?.roomName || 'Phòng IMAX 03',
    time: booking?.showtime?.startTime
      ? new Date(booking.showtime.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : (booking?.time || '19:15'),
    date: booking?.showtime?.startTime
      ? new Date(booking.showtime.startTime).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
      : (booking?.date || 'Hôm nay (Thứ 6)'),
    seats: Array.isArray(booking?.seatNumbers) ? booking.seatNumbers.join(', ') : (booking?.seats || 'F6, F7'),
    concessions: booking?.concessions || '1x Combo Solo (bắp phô mai + Coca-Cola L)',
    totalAmount: booking?.totalAmount || 299000,
    paymentMethod: booking?.paymentMethod === 'VNPAY' ? 'VNPAY-QR OK' : (booking?.paymentMethod || 'VNPAY-QR OK'),
  };

  const [copied, setCopied] = useState(false);
  const handleCopyCode = () => {
    navigator.clipboard.writeText(ticketData.bookingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 pb-16 selection:bg-blue-500 selection:text-white">
      {/* 1. THANH TIẾN TRÌNH 3 BƯỚC (CHỈ GIỮ LẠI KHUNG VIÊN THUỐC CÁC BƯỚC, BỎ THANH CHỮ NHẬT DÀI) */}
      <div className="pt-8 pb-6 flex items-center justify-center px-4">
        {/* Hộp viên thuốc trung tâm bo tròn */}
        <div className="inline-flex items-center bg-[#0c1220]/90 border border-slate-800/80 rounded-full px-4 sm:px-6 py-2 shadow-lg backdrop-blur-md overflow-x-auto max-w-full">
            {/* BƯỚC 1: Hoàn thành (Chọn ghế) */}
            <div className="flex items-center space-x-2.5 shrink-0">
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
            </div>

            {/* Đường line kết nối xanh lá giữa bước 1 và bước 2 */}
            <div className="w-12 sm:w-20 md:w-24 h-[1.5px] bg-[#059669] mx-3 sm:mx-4 shrink-0"></div>

            {/* BƯỚC 2: Hoàn thành (Đồ ăn & Thanh toán) */}
            <div className="flex items-center space-x-2.5 shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#059669] flex items-center justify-center text-white shadow-sm shrink-0">
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  BƯỚC 2
                </span>
                <span className="text-xs font-extrabold text-white leading-tight mt-0.5">
                  Đồ ăn & Thanh toán
                </span>
              </div>
            </div>

            {/* Đường line kết nối màu xám giữa bước 2 và bước 3 */}
            <div className="w-12 sm:w-20 md:w-24 h-[1.5px] bg-slate-700/80 mx-3 sm:mx-4 shrink-0"></div>

            {/* BƯỚC 3: Đang ở đây (Active Capsule Vé điện tử) */}
            <div className="flex items-center space-x-2.5 bg-[#1b253b] border border-blue-500/35 rounded-full pl-1.5 pr-4 py-1 shadow-[0_0_18px_rgba(37,99,235,0.3)] shrink-0">
              <div className="w-6 h-6 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-xs shadow-sm shrink-0">
                🎟️
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wider leading-none">
                  BƯỚC 3
                </span>
                <span className="text-xs font-black text-white leading-tight mt-0.5">
                  Vé điện tử
                </span>
              </div>
            </div>
          </div>
      </div>

      <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14">
        {/* 2. HEADER THÔNG BÁO THÀNH CÔNG */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          {/* Logo dấu tích xanh tròn phát sáng */}
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
            <span className="text-emerald-400 text-2xl font-black">✓</span>
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-3">
            <span>🛡️</span>
            <span>GIAO DỊCH HOÀN TẤT THÀNH CÔNG</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            Đặt Vé & Thanh Toán Thành Công!
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 mt-2.5 leading-relaxed">
            Mã vé điện tử đã gửi tới <strong className="text-white font-semibold">{ticketData.customerEmail}</strong> và SĐT <strong className="text-white font-semibold">{ticketData.customerPhone}</strong>. Xuất trình mã QR tại cửa kiểm soát hoặc quầy MovieTix Express.
          </p>
        </div>

        {/* 3. BỐ CỤC 2 CỘT: VÉ ĐIỆN TỬ (TRÁI) & CÔNG CỤ XUẤT TRÌNH + CHỈ DẪN (PHẢI) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-10">
          {/* CỘT TRÁI (7 CỘT): CUỐNG VÉ ĐIỆN TỬ E-TICKET CINEMA PASS CÓ VẾT CẮT TICKET CHUẨN MẪU */}
          <div className="lg:col-span-7 bg-[#0d1322] border border-slate-800 rounded-3xl shadow-2xl relative">
            {/* PHẦN TRÊN CỦA VÉ */}
            <div className="p-7 sm:p-8 space-y-6">
              {/* Mã vé & Huy hiệu VIP */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    MÃ VÉ ĐIỆN TỬ
                  </span>
                  <span className="text-xs sm:text-sm font-black font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    #{ticketData.bookingCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700 transition-colors cursor-pointer"
                    title="Sao chép mã vé"
                  >
                    {copied ? 'Đã sao chép' : '📋'}
                  </button>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <span>✪</span>
                  <span>VIP PREMIERE</span>
                </span>
              </div>

              {/* Thông tin phim & Poster thu nhỏ */}
              <div className="flex items-start space-x-4 sm:space-x-5">
                <div className="w-20 h-28 sm:w-24 sm:h-34 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 shrink-0 shadow-md relative">
                  <img
                    src="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop"
                    alt={ticketData.movieTitle}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-1 left-1 bg-red-600 text-white font-black text-[9px] px-1 py-0.2 rounded">
                    {ticketData.movieAgeRating}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="bg-[#1b263b] text-blue-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-blue-400/30 uppercase tracking-wider">
                      IMAX 3D LASER
                    </span>
                    <span className="bg-slate-800 text-slate-300 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-slate-700/50">
                      Phụ đề tiếng Việt
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {ticketData.movieTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Dune: Part Two • Khoa học viễn tưởng • 166 phút
                  </p>

                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold mt-3">
                    <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.15"></path>
                      <path d="m9 12 2 2 4-4" strokeWidth="2.5"></path>
                    </svg>
                    <span>Bảo hiểm hủy vé MovieTix Protection kích hoạt</span>
                  </div>
                </div>
              </div>

              {/* Lưới 4 thông số: Rạp chiếu, Suất chiếu, Vị trí ghế, Thanh toán */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">📽️ Rạp chiếu</span>
                  <span className="font-bold text-white text-xs sm:text-sm block mt-0.5 truncate">{ticketData.theaterName}</span>
                  <span className="text-[10px] text-cyan-400 font-semibold">{ticketData.roomName}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">🕒 Suất chiếu</span>
                  <span className="font-bold text-white text-xs sm:text-sm block mt-0.5">{ticketData.time}</span>
                  <span className="text-[10px] text-slate-400">{ticketData.date}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">💺 Vị trí ghế</span>
                  <span className="font-black text-amber-400 text-sm sm:text-base block mt-0.5">{ticketData.seats}</span>
                  <span className="text-[10px] text-slate-400 font-medium">VIP Prime Gold</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">💳 Thanh toán</span>
                  <span className="font-black text-emerald-400 text-sm sm:text-base block mt-0.5">
                    {ticketData.totalAmount.toLocaleString('vi-VN')} đ
                  </span>
                  <span className="text-[10px] text-slate-400">{ticketData.paymentMethod}</span>
                </div>
              </div>

              {/* Hàng bắp nước kèm theo */}
              <div className="bg-[#12192a] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-sm text-amber-400 shrink-0">
                    🍿
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-400 font-bold block uppercase tracking-wider">
                      Combo bắp nước đã đặt
                    </span>
                    <span className="font-bold text-white text-xs sm:text-sm">{ticketData.concessions}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 text-slate-300 text-[11px] shrink-0 font-medium bg-[#162033] px-3 py-1.5 rounded-lg border border-slate-700/60">
                  <span className="text-amber-400">👤</span>
                  <span>{ticketData.customerName} • Thẻ Vàng</span>
                </div>
              </div>
            </div>

            {/* VẾT CẮT KHUYẾT CUỐNG VÉ RĂNG CƯA GIỮA (INWARD NOTCH CUTOUTS & PERFORATION) */}
            <div className="relative flex items-center justify-between w-full h-8 my-3">
              {/* Vết khuyết bên trái (Inward Notch Left) */}
              <div className="absolute -left-[1px] top-1/2 -translate-y-1/2 z-20 pointer-events-none select-none">
                <svg width="14" height="28" viewBox="0 0 14 28" fill="none">
                  <path
                    d="M 1 0 A 13 14 0 0 1 1 28 L 0 28 L 0 0 Z"
                    fill="#070b13"
                  />
                  <path
                    d="M 1 0 A 13 14 0 0 1 1 28"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1.2"
                  />
                </svg>
              </div>

              {/* Đường nét đứt xé vé */}
              <div className="w-full border-t border-dashed border-slate-700/80 mx-3.5"></div>

              {/* Vết khuyết bên phải (Inward Notch Right - Đối xứng hoàn hảo) */}
              <div className="absolute -right-[1px] top-1/2 -translate-y-1/2 z-20 pointer-events-none select-none -scale-x-100">
                <svg width="14" height="28" viewBox="0 0 14 28" fill="none">
                  <path
                    d="M 1 0 A 13 14 0 0 1 1 28 L 0 28 L 0 0 Z"
                    fill="#070b13"
                  />
                  <path
                    d="M 1 0 A 13 14 0 0 1 1 28"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1.2"
                  />
                </svg>
              </div>
            </div>

            {/* PHẦN DƯỚI: MÃ CHECK-IN NHANH VÀ MÃ VẠCH (CHUẨN 100% THEO ẢNH MẪU) */}
            <div className="p-7 sm:p-8 pt-4 pb-9 text-center space-y-6">
              <div>
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#4c7cf0] block">
                  MÃ CHECK-IN NHANH
                </span>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Quét mã bên dưới để vào phòng chiếu và nhận bắp nước tại line ưu tiên MovieTix Express.
                </p>
              </div>

              {/* Khối Mã QR Trắng trung tâm với biểu tượng phim ở giữa */}
              <div className="inline-block p-5 sm:p-6 bg-white rounded-3xl shadow-2xl relative border-4 border-slate-800/80 my-2">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${ticketData.bookingCode}`}
                  alt="MovieTix Fast Check-in QR"
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl mx-auto"
                />
                {/* Logo icon cuộn phim xanh ở tâm mã QR chuẩn ảnh mẫu */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shadow-lg border-2 border-white">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
                  </svg>
                </div>
              </div>

              {/* Mã vạch Barcode dạng SVG nét chuẩn */}
              <div className="pt-2 pb-1">
                <div className="flex items-center justify-center space-x-[2px] h-12 w-72 mx-auto">
                  {[3, 1, 4, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 1, 3, 2].map((w, idx) => (
                    <div key={idx} className="bg-slate-300 h-full rounded-xs" style={{ width: `${w * 1.8}px` }}></div>
                  ))}
                </div>
                <span className="font-mono text-xs font-bold text-slate-400 tracking-[0.45em] block mt-2 select-all">
                  8 9 3 8 5 2 0 &nbsp; 9 8 2 3 4 1
                </span>
              </div>

              {/* Thông báo thời gian có mặt & Đồng hồ đếm ngược */}
              <div className="bg-[#121824] border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between text-xs text-left shadow-md mt-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 text-sm shrink-0">
                    ⏰
                  </div>
                  <div>
                    <span className="font-bold text-white block text-xs sm:text-sm">Có mặt trước giờ chiếu 15 phút</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">Cửa rạp mở lúc 19:00 để ổn định vị trí</span>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <span className="text-amber-500 font-mono font-black text-sm sm:text-base block">
                    03:38:23
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Đếm ngược</span>
                </div>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (5 CỘT): LƯU TRỮ, CHỈ DẪN & HỖ TRỢ KHẨN CẤP */}
          <div className="lg:col-span-5 space-y-5">
            {/* THẺ 1: LƯU TRỮ & XUẤT TRÌNH VÉ */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>📥</span>
                <span>Lưu Trữ & Xuất Trình Vé</span>
              </span>

              {/* Nút lớn tải PDF */}
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black py-3 rounded-2xl text-xs sm:text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer hover:scale-[1.01]"
              >
                <span>📥</span>
                <span>Tải vé xuống (PDF Bản Chuẩn)</span>
              </button>

              {/* 2 Nút Apple Wallet & Google Wallet */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  className="bg-[#141b2c] hover:bg-[#1c263d] border border-slate-700/80 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <span></span>
                  <span>Apple Wallet</span>
                </button>
                <button
                  type="button"
                  className="bg-[#141b2c] hover:bg-[#1c263d] border border-slate-700/80 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <span>Ⓖ</span>
                  <span>Google Wallet</span>
                </button>
              </div>

              {/* 2 Nút Chia sẻ bạn bè & Lịch sử đặt vé */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="bg-[#141b2c] hover:bg-[#1c263d] border border-slate-700/80 text-slate-300 hover:text-white font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <span>🔗</span>
                  <span>Chia sẻ bạn bè</span>
                </button>
                <Link
                  to="/"
                  className="bg-[#141b2c] hover:bg-[#1c263d] border border-slate-700/80 text-slate-300 hover:text-white font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors text-center"
                >
                  <span>🕒</span>
                  <span>Lịch sử đặt vé</span>
                </Link>
              </div>

              {/* Nút Quay về Trang Chủ */}
              <Link
                to="/"
                className="w-full bg-[#162033] hover:bg-[#1f2d47] border border-slate-700/80 text-slate-200 hover:text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors block text-center mt-2"
              >
                <span>🏠</span>
                <span>Quay về Trang Chủ</span>
              </Link>
            </div>

            {/* THẺ 2: CHỈ DẪN VÀO RẠP & ĐỖ XE */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <span>🧭</span>
                  <span>Chỉ Dẫn Vào Rạp & Đỗ Xe</span>
                </span>
                <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold px-2 py-0.5 rounded">
                  Tầng 5 - Lotte Center
                </span>
              </div>

              {/* Bản đồ định vị */}
              <div className="w-full h-32 rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/80 relative shadow">
                <img
                  src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=600&auto=format&fit=crop"
                  alt="Cinema Location Map"
                  className="w-full h-full object-cover filter brightness-[0.7] contrast-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
                <div className="absolute bottom-2.5 left-3 flex items-center space-x-1.5 text-xs font-bold text-white">
                  <span>📍</span>
                  <span>Số Liễu Giai, Ba Đình, Hà Nội</span>
                </div>
              </div>

              {/* 3 Điều cần lưu ý */}
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-white flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="leading-relaxed">
                    Gửi xe máy tại Hầm B2 hoặc Ô tô tại Xóm B1 (Quét vé xem phim tại quầy vé để nhận ưu đãi gửi xe 4h miễn phí).
                  </p>
                </div>

                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-white flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="leading-relaxed">
                    Đi thang máy trực tiếp lên Tầng 5, sảnh phòng chiếu IMAX C3 nằm cạnh lối vào Premier Lounge.
                  </p>
                </div>

                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-white flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="leading-relaxed">
                    Nhận kính 3D Laser cao cấp đã được khử khuẩn ngay tại cổng soát vé.
                  </p>
                </div>
              </div>
            </div>

            {/* THẺ 3: HỖ TRỢ KHẨN CẤP TẠI RẠP */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg">
                  📞
                </div>
                <div>
                  <h5 className="font-bold text-xs text-white">Hỗ trợ khẩn cấp tại rạp</h5>
                  <p className="text-[10px] text-slate-400">Tổng đài viên giải quyết đổi suất/hoàn huỷ</p>
                </div>
              </div>

              <a
                href="tel:19008899"
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400 font-black text-xs transition-colors flex items-center space-x-1"
              >
                <span>📞</span>
                <span>1900 8899</span>
              </a>
            </div>
          </div>
        </div>

        {/* 4. BANNER TÍCH LŨY ĐIỂM THƯỞNG CINEMA REWARDS */}
        <div className="bg-[#0e1526] border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center space-x-3.5">
            <span className="text-2xl shrink-0">🎁</span>
            <div>
              <h4 className="font-black text-sm text-white">Tích lũy 30 Điểm Cinema Rewards</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Vé xem Dune: Part Two đã cộng điểm thành viên vào tài khoản của bạn, đổi bắp nước miễn phí vào lần xem kế tiếp!
              </p>
            </div>
          </div>

          <button
            type="button"
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors border border-slate-700 shrink-0 cursor-pointer shadow"
          >
            Xem ví quà tặng
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccessPage;
