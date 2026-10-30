import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../services/api';

const SeatSelectionPage = () => {
  const { showtimeId } = useParams();
  const navigate = useNavigate();

  const [showtime, setShowtime] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState(['B4', 'B5', 'C9', 'C10', 'E3', 'E4']);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [holdingLoading, setHoldingLoading] = useState(false);

  // Danh sách ghế đã bán mẫu
  const defaultBookedSeats = ['B4', 'B5', 'C9', 'C10', 'E3', 'E4', 'G5', 'G6', 'H7-8'];

  useEffect(() => {
    fetchSeats();
  }, [showtimeId]);

  const fetchSeats = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get(`/showtimes/${showtimeId}/seats`);
      if (res.data?.showtime) {
        setShowtime(res.data.showtime);
      }
      if (res.data?.seats && Array.isArray(res.data.seats)) {
        const booked = res.data.seats
          .filter((s) => s.status === 'BOOKED' || s.status === 'HOLDING')
          .map((s) => s.seatNumber);
        setBookedSeats(booked.length > 0 ? booked : defaultBookedSeats);
      } else {
        setBookedSeats(defaultBookedSeats);
      }
    } catch (err) {
      console.warn('Dùng dữ liệu suất chiếu mặc định:', err);
      setShowtime({
        id: showtimeId || 1,
        movie: { title: 'Dune: Hành Tinh Cát 2', posterUrl: '/banner-dune.jpg', ageRating: 'T16' },
        roomName: 'Phòng 01 - IMAX Laser',
        startTime: new Date(),
        price: 95000,
      });
      setBookedSeats(defaultBookedSeats);
    } finally {
      setLoading(false);
    }
  };

  // Giá vé theo từng phân loại ghế
  const basePrice = showtime?.price || 95000;
  const PRICE_STANDARD = basePrice;
  const PRICE_VIP = basePrice + 25000;
  const PRICE_SWEETBOX = basePrice * 2 + 20000;

  const isBooked = (seatId) => bookedSeats.includes(seatId);

  const handleSeatClick = (seatId) => {
    if (isBooked(seatId)) return;

    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seatId));
    } else {
      setSelectedSeats([...selectedSeats, seatId]);
    }
  };

  // Tính tổng tiền theo các ghế đã chọn
  const calculateTotal = () => {
    let sum = 0;
    selectedSeats.forEach((seatId) => {
      if (seatId.startsWith('H')) {
        sum += PRICE_SWEETBOX;
      } else if (['E', 'F', 'G'].some((r) => seatId.startsWith(r))) {
        sum += PRICE_VIP;
      } else {
        sum += PRICE_STANDARD;
      }
    });
    return sum;
  };

  const handleProceed = async () => {
    if (selectedSeats.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ghế để tiếp tục!');
      return;
    }

    try {
      setHoldingLoading(true);
      setErrorMsg('');

      // Gọi API giữ ghế
      try {
        await api.post('/bookings/hold', {
          showtimeId: String(showtimeId),
          seatNumbers: selectedSeats,
        });
      } catch (err) {
        console.warn('Giữ ghế backend (tiếp tục thanh toán):', err?.response?.data?.message || err.message);
      }

      navigate('/checkout', {
        state: {
          showtimeId: showtimeId || 1,
          showtime: showtime || {
            movie: { title: 'Dune: Hành Tinh Cát 2', ageRating: 'T16' },
            roomName: 'Phòng 01 - IMAX Laser',
            startTime: new Date(),
          },
          selectedSeats,
          seatTotal: calculateTotal(),
        },
      });
    } finally {
      setHoldingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080d17] flex flex-col items-center justify-center text-white">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-cyan-400 border-t-transparent mb-3"></div>
        <p className="text-slate-400 text-sm font-semibold">Đang tải sơ đồ phòng chiếu IMAX...</p>
      </div>
    );
  }

  // Định nghĩa các hàng ghế
  const standardRows = ['A', 'B', 'C', 'D'];
  const vipRows = ['E', 'F', 'G'];
  const leftCols = [1, 2, 3, 4, 5, 6];
  const rightCols = [7, 8, 9, 10, 11, 12];

  // Render từng ghế đơn
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
          onClick={() => handleSeatClick(seatId)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#3b82f6] border border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.7)] text-white flex items-center justify-center text-xs font-black transition-all transform scale-105 cursor-pointer"
          title={`Ghế ${seatId} - Đang chọn`}
        >
          ✓
        </button>
      );
    }

    // Ghế VIP chưa chọn
    if (isVip) {
      return (
        <button
          key={seatId}
          type="button"
          onClick={() => handleSeatClick(seatId)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#182133] hover:bg-[#23314d] border border-amber-500/30 text-amber-100/90 hover:border-amber-400 flex items-center justify-center text-xs font-bold transition-all cursor-pointer shadow-sm"
          title={`Ghế VIP ${seatId} - 120.000 đ`}
        >
          {colNumber}
        </button>
      );
    }

    // Ghế thường chưa chọn
    return (
      <button
        key={seatId}
        type="button"
        onClick={() => handleSeatClick(seatId)}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#141b29] hover:bg-[#1e2a40] border border-slate-700/60 text-slate-300 hover:border-blue-400 flex items-center justify-center text-xs font-semibold transition-all cursor-pointer shadow-sm"
        title={`Ghế ${seatId} - 95.000 đ`}
      >
        {colNumber}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 pb-12 selection:bg-blue-500 selection:text-white">
      {/* 1. THANH TIÊU ĐỀ TRÊN CÙNG: CĂN LỀ RỘNG RÃI ĐỒNG BỘ VỚI NAVBAR VÀ TRANG CHỦ */}
      <div className="w-full bg-[#0b101a]/95 backdrop-blur-xl border-b border-slate-800/90 py-3.5 mb-6 sticky top-0 z-40 shadow-xl">
        <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          {/* Cụm bên trái: Nút Back tròn + Tên phim + Nhãn T16 / IMAX LASER + Suất chiếu */}
          <div className="flex items-center space-x-3.5">
            {/* Nút quay lại hình tròn về trang chủ */}
            <Link
              to="/"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#151d2d] hover:bg-[#202b3f] border border-slate-700/70 text-slate-200 hover:text-white flex items-center justify-center text-sm transition-all shadow-md shrink-0 cursor-pointer"
              title="Quay lại trang chủ"
            >
              ←
            </Link>

            <div>
              {/* Tên phim & Nhãn độ tuổi + Định dạng */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white tracking-wide">
                  {showtime?.movie?.title || 'Dune: Hành Tinh Cát 2'}
                </h1>
                {/* Nhãn T16 */}
                <span className="bg-[#f59e0b] text-[#0a1120] font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                  {showtime?.movie?.ageRating || 'T16'}
                </span>
                {/* Nhãn IMAX LASER */}
                <span className="bg-[#1b263b] text-blue-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-blue-400/30 uppercase tracking-wider">
                  IMAX LASER
                </span>
              </div>

              {/* Dòng phụ: Phòng chiếu • Giờ chiếu • Thời lượng */}
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-1 flex-wrap">
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

          {/* Cụm bên phải: Thanh tiến trình 3 bước chuẩn Mockup */}
          <div className="inline-flex items-center bg-[#0c1220]/90 border border-slate-800/80 rounded-full px-4 sm:px-5 py-1.5 shadow-lg backdrop-blur-md overflow-x-auto max-w-full">
            {/* BƯỚC 1: Đang ở đây (Active Capsule Chọn ghế) */}
            <div className="flex items-center space-x-2.5 bg-[#1b253b] border border-blue-500/35 rounded-full pl-1.5 pr-3.5 py-1 shadow-[0_0_15px_rgba(37,99,235,0.3)] shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[11px] font-black shadow-sm shrink-0">
                1
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wider leading-none">
                  BƯỚC 1
                </span>
                <span className="text-xs font-black text-white leading-tight mt-0.5">
                  Chọn ghế
                </span>
              </div>
            </div>

            {/* Đường line kết nối màu xám giữa bước 1 và bước 2 */}
            <div className="w-10 sm:w-16 h-[1.5px] bg-slate-700/80 mx-2.5 sm:mx-3 shrink-0"></div>

            {/* BƯỚC 2: Chưa tới (Đồ ăn & Thanh toán) */}
            <div className="flex items-center space-x-2 text-slate-500 shrink-0">
              <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-[10px] font-bold shrink-0">
                2
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider leading-none">
                  BƯỚC 2
                </span>
                <span className="text-xs font-bold text-slate-500 leading-tight mt-0.5">
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

      <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14">

        {/* 1. MÀN HÌNH CHIẾU CONG PHÁT SÁNG (CURVED SCREEN WITH AMBIENT GLOW) */}
        <div className="relative w-full max-w-2xl mx-auto pt-4 pb-12 text-center">
          {/* Quầng sáng màn chiếu */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4/5 h-16 bg-cyan-500/15 blur-3xl rounded-full pointer-events-none"></div>

          {/* Đường cong màn hình chiếu Neon */}
          <div className="relative mx-auto h-3.5 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-t-[140px] shadow-[0_4px_30px_rgba(34,211,238,0.7)] border-t border-cyan-300/80"></div>

          {/* Nhãn Màn hình */}
          <div className="mt-5 inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-[#0d1424]/90 border border-slate-700/80 text-[11px] font-bold tracking-widest uppercase text-slate-300 shadow-xl backdrop-blur-md">
            <span className="text-cyan-400 text-xs">🖥️</span>
            <span>MÀN HÌNH CHIẾU Ở HƯỚNG NÀY</span>
          </div>
        </div>

        {/* 2. MA TRẬN GHẾ (THEATER SEAT GRID) */}
        <div className="w-full max-w-3xl mx-auto overflow-x-auto pb-6">
          <div className="min-w-[560px] flex flex-col items-center space-y-2.5">
            {/* KHU VỰC GHẾ THƯỜNG (A, B, C, D) */}
            {standardRows.map((row) => (
              <div key={row} className="flex items-center justify-center space-x-2 w-full">
                {/* Ký hiệu hàng bên trái */}
                <span className="w-6 text-xs text-slate-400 font-bold text-center select-none">{row}</span>

                {/* 6 ghế cánh trái */}
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  {leftCols.map((col) => renderSeat(`${row}${col}`, col, false))}
                </div>

                {/* LỐI ĐI Ở GIỮA (AISLE) */}
                <div className="w-14 sm:w-16 flex items-center justify-center select-none">
                  {row === 'A' ? (
                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                      AISLE
                    </span>
                  ) : (
                    <div className="w-full"></div>
                  )}
                </div>

                {/* 6 ghế cánh phải */}
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  {rightCols.map((col) => renderSeat(`${row}${col}`, col, false))}
                </div>

                {/* Ký hiệu hàng bên phải */}
                <span className="w-6 text-xs text-slate-400 font-bold text-center select-none">{row}</span>
              </div>
            ))}

            {/* DẢI PHÂN CÁCH: KHU VỰC VIP PRIME */}
            <div className="relative w-full flex items-center justify-center py-3 my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800/90"></div>
              </div>
              <div className="relative px-4 py-0.5 bg-[#070b13] text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-amber-400 flex items-center space-x-1.5 border border-amber-500/40 rounded-full shadow-lg">
                <span className="text-xs">✪</span>
                <span>KHU VỰC VIP PRIME</span>
              </div>
            </div>

            {/* KHU VỰC GHẾ VIP (E, F, G) */}
            {vipRows.map((row) => (
              <div key={row} className="flex items-center justify-center space-x-2 w-full">
                {/* Ký hiệu hàng bên trái */}
                <span className="w-6 text-xs text-slate-400 font-bold text-center select-none">{row}</span>

                {/* 6 ghế cánh trái */}
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  {leftCols.map((col) => renderSeat(`${row}${col}`, col, true))}
                </div>

                {/* Lối đi ở giữa */}
                <div className="w-14 sm:w-16 flex items-center justify-center select-none"></div>

                {/* 6 ghế cánh phải */}
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  {rightCols.map((col) => renderSeat(`${row}${col}`, col, true))}
                </div>

                {/* Ký hiệu hàng bên phải */}
                <span className="w-6 text-xs text-slate-400 font-bold text-center select-none">{row}</span>
              </div>
            ))}

            {/* HÀNG GHẾ ĐÔI / SWEETBOX (ROW H) */}
            <div className="flex items-center justify-center space-x-2 w-full pt-4">
              <span className="w-6 text-xs text-slate-400 font-bold text-center select-none">H</span>

              <div className="flex items-center space-x-2">
                {/* Cặp H1-2 */}
                <button
                  type="button"
                  onClick={() => handleSeatClick('H1-2')}
                  className={`h-8 px-3 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    selectedSeats.includes('H1-2')
                      ? 'bg-[#3b82f6] border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.7)]'
                      : 'bg-[#182133] hover:bg-[#23314d] border-rose-500/40 text-rose-300'
                  }`}
                  title="Ghế đôi Sweetbox H1-2 - 210.000 đ"
                >
                  <span>♡</span>
                  <span>H1-2</span>
                </button>

                {/* Cặp H3-4 */}
                <button
                  type="button"
                  onClick={() => handleSeatClick('H3-4')}
                  className={`h-8 px-3 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    selectedSeats.includes('H3-4')
                      ? 'bg-[#3b82f6] border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.7)]'
                      : 'bg-[#182133] hover:bg-[#23314d] border-rose-500/40 text-rose-300'
                  }`}
                  title="Ghế đôi Sweetbox H3-4 - 210.000 đ"
                >
                  <span>♡</span>
                  <span>H3-4</span>
                </button>
              </div>

              {/* Lối đi giữa hàng H */}
              <div className="w-16 sm:w-20 flex items-center justify-center select-none">
                <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">
                  SWEETBOX
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {/* Cặp H5-6 */}
                <button
                  type="button"
                  onClick={() => handleSeatClick('H5-6')}
                  className={`h-8 px-3 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    selectedSeats.includes('H5-6')
                      ? 'bg-[#3b82f6] border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.7)]'
                      : 'bg-[#182133] hover:bg-[#23314d] border-rose-500/40 text-rose-300'
                  }`}
                  title="Ghế đôi Sweetbox H5-6 - 210.000 đ"
                >
                  <span>♡</span>
                  <span>H5-6</span>
                </button>

                {/* Cặp H7-8 (Đã bán) */}
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

        {/* 3. THANH CHÚ THÍCH LOẠI GHẾ (LEGEND BAR) */}
        <div className="w-full max-w-4xl mx-auto bg-[#0d1320]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl mt-8 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 items-center">
            {/* 1. Ghế thường */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-[#141b29] border border-slate-700/70 flex items-center justify-center text-xs font-bold text-slate-300 shadow">
                1
              </div>
              <div>
                <p className="text-xs font-bold text-white">Ghế thường</p>
                <p className="text-[11px] text-slate-400 font-medium">95.000 đ</p>
              </div>
            </div>

            {/* 2. Ghế VIP */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-[#182133] border border-amber-500/40 flex items-center justify-center text-[10px] font-black text-amber-400 shadow">
                VIP
              </div>
              <div>
                <p className="text-xs font-bold text-amber-400">Ghế VIP</p>
                <p className="text-[11px] text-slate-400 font-medium">120.000 đ</p>
              </div>
            </div>

            {/* 3. Đang chọn */}
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

            {/* 4. Đã bán */}
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

        {/* 4. ĐẶC TÍNH CÔNG NGHỆ PHÒNG CHIẾU (3 BULLETS DƯỚI BẢNG CHÚ THÍCH) */}
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

      {/* 5. THANH THANH TOÁN DÍNH MÉP DƯỚI (STICKY BOTTOM ACTION BAR CHUẨN MOCKUP) */}
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
                        {isSweetbox && <span className="text-[10px] text-rose-400 font-bold">(SWEETBOX)</span>}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-500 italic">Chưa chọn ghế</span>
                )}
              </div>
            </div>

            {/* Đường phân cách dọc */}
            <div className="hidden sm:block h-8 w-px bg-slate-800"></div>

            <div>
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                TẠM TÍNH VÉ
              </span>
              <p className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
                {calculateTotal().toLocaleString('vi-VN')} <span className="text-xs font-bold text-amber-500/80">đ</span>
              </p>
            </div>
          </div>

          {/* Cụm bên phải: Nút Chọn lại + Tiếp tục chọn bắp nước (chừa chỗ cho nút Trợ lý AI góc phải) */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end pr-28 sm:pr-32">
            <button
              type="button"
              onClick={() => setSelectedSeats([])}
              className="px-4 py-2 bg-[#161f30] hover:bg-[#202b40] text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm font-bold transition-colors border border-slate-700/80 flex items-center space-x-1.5 cursor-pointer shadow"
              title="Bỏ chọn tất cả ghế"
            >
              <span>↺</span>
              <span>Chọn lại</span>
            </button>

            <button
              type="button"
              onClick={handleProceed}
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
    </div>
  );
};

export default SeatSelectionPage;
