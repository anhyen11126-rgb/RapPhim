import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import api from '../../services/api';
import SeatGrid from '../../components/seat-booking/SeatGrid';
import SeatLegendBar from '../../components/seat-booking/SeatLegendBar';
import SeatBottomActionBar from '../../components/seat-booking/SeatBottomActionBar';
import { calculateDynamicPrices, loadPricingConfig, DEFAULT_PRICING_CONFIG } from '../../utils/pricing';

const SeatSelectionPage = () => {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const slotInfo = location.state?.slotInfo;

  const [showtime, setShowtime] = useState(slotInfo || null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [holdingLoading, setHoldingLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);

  useEffect(() => {
    loadPricingConfig().then((cfg) => {
      if (cfg) setPricingConfig(cfg);
    });
  }, []);

  // Lắng nghe thao tác cuộn chuột để tự động ẩn thanh thông tin phim phía dưới Navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchSeats();
  }, [showtimeId]);

  const fetchSeats = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get(`/showtimes/${showtimeId}/seats`);
      if (res.data?.showtime) {
        // Hợp nhất dữ liệu suất chiếu từ DB và slot được người dùng chọn
        setShowtime({
          ...res.data.showtime,
          ...(slotInfo || {}),
          format: slotInfo?.format || res.data.showtime.format || res.data.showtime.formatFeature || '2D Tiêu Chuẩn',
          roomName: slotInfo?.roomName || res.data.showtime.roomName || 'Phòng Chiếu 01',
          time: slotInfo?.time || res.data.showtime.time,
          price: slotInfo?.price || res.data.showtime.price,
          cinemaName: slotInfo?.cinemaName || res.data.showtime.cinema?.name || 'D\'AVENOR CINEMA',
        });
      }
      if (res.data?.seats && Array.isArray(res.data.seats)) {
        const booked = res.data.seats
          .filter(
            (s) =>
              s.status === 'BOOKED' ||
              (s.status === 'HOLDING' && s.holdExpiresAt && new Date(s.holdExpiresAt) > new Date())
          )
          .map((s) => s.seatNumber);
        setBookedSeats(booked);
      } else {
        setBookedSeats([]);
      }
    } catch (err) {
      console.warn('Lỗi tải dữ liệu suất chiếu từ DB:', err);
      setErrorMsg('Không thể tải sơ đồ ghế cho suất chiếu này. Vui lòng thử lại!');
      setBookedSeats([]);
    } finally {
      setLoading(false);
    }
  };

  // Tính giá vé động theo ngày trong tuần, khung giờ và quy định cụ thể của từng loại ghế
  const {
    priceStandard: PRICE_STANDARD,
    priceVip: PRICE_VIP,
    priceSweetbox: PRICE_SWEETBOX,
    timeSlotLabel,
    roomTypeLabel,
  } = calculateDynamicPrices(showtime, pricingConfig);

  const handleSeatClick = (seatId) => {
    if (bookedSeats.includes(seatId)) return;

    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seatId));
    } else {
      setSelectedSeats([...selectedSeats, seatId]);
    }
  };

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

      try {
        await api.post('/bookings/hold', {
          showtimeId: showtimeId || showtime?._id?.toString() || showtime?.id,
          seatNumbers: selectedSeats,
        });
      } catch (err) {
        console.warn('Giữ ghế backend (tiếp tục thanh toán):', err?.response?.data?.message || err.message);
      }

      navigate('/checkout', {
        state: {
          showtimeId: showtimeId || showtime?._id?.toString() || showtime?.id,
          showtime: {
            ...showtime,
            format: showtime?.format || roomTypeLabel,
            cinemaName: showtime?.cinemaName || showtime?.cinema?.name,
          },
          selectedSeats,
          seatTotal: calculateTotal(),
          ticketPrices: {
            standard: PRICE_STANDARD,
            vip: PRICE_VIP,
            sweetbox: PRICE_SWEETBOX,
          },
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
        <p className="text-slate-400 text-sm font-semibold">Đang tải sơ đồ phòng chiếu...</p>
      </div>
    );
  }

  const standardRows = ['A', 'B', 'C', 'D'];
  const vipRows = ['E', 'F', 'G'];
  const leftCols = [1, 2, 3, 4, 5, 6];
  const rightCols = [7, 8, 9, 10, 11, 12];

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 pb-12 selection:bg-blue-500 selection:text-white">
      {/* 1. THANH TIÊU ĐỀ TRÊN CÙNG: QUAY LẠI + TIẾN TRÌNH 3 BƯỚC (TỰ ĐỘNG ẨN MƯỢT MÀ KHI CUỘN/KÉO CHUỘT) */}
      <div
        className={`w-full bg-[#0b101a]/95 backdrop-blur-xl border-b border-slate-800/90 transition-all duration-300 ease-in-out overflow-hidden shadow-xl ${
          isScrolled
            ? 'max-h-0 py-0 mb-0 opacity-0 border-transparent pointer-events-none'
            : 'max-h-48 py-3.5 mb-6 opacity-100'
        }`}
      >
        <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3.5">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else if (showtime?.movie?._id || showtime?.movie?.id || showtime?.movieId) {
                  const mId = showtime?.movie?._id || showtime?.movie?.id || showtime?.movieId;
                  navigate(`/movie/${mId}`);
                } else {
                  navigate('/');
                }
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#151d2d] hover:bg-[#202b3f] border border-slate-700/70 text-slate-200 hover:text-white flex items-center justify-center text-sm transition-all shadow-md shrink-0 cursor-pointer active:scale-95"
              title="Quay lại trang chi tiết & chọn suất chiếu"
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
                <span
                  className={`font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider border shadow-sm ${
                    (showtime?.format || roomTypeLabel || '').toLowerCase().includes('imax')
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : (showtime?.format || roomTypeLabel || '').toLowerCase().includes('3d')
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                  }`}
                >
                  {showtime?.format || roomTypeLabel || '2D TIÊU CHUẨN'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-1 flex-wrap">
                {(showtime?.cinemaName || showtime?.cinema?.name) && (
                  <>
                    <span className="flex items-center gap-1 text-slate-300 font-medium">
                      <span className="text-red-400">📍</span>
                      <span>{showtime?.cinemaName || showtime?.cinema?.name}</span>
                    </span>
                    <span className="text-slate-600">•</span>
                  </>
                )}
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className="text-blue-400">📽</span>
                  <span>{showtime?.roomName || 'Phòng Chiếu 01'}</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className="text-amber-400">🕒</span>
                  <span>{showtime?.time || '19:15'} ({timeSlotLabel})</span>
                </span>
                <span className="text-slate-600">•</span>
                <span>{showtime?.movie?.duration || 120} phút</span>
              </div>
            </div>
          </div>

          {/* Thanh tiến trình 3 bước */}
          <div className="inline-flex items-center bg-[#0c1220]/90 border border-slate-800/80 rounded-full px-4 sm:px-5 py-1.5 shadow-lg backdrop-blur-md overflow-x-auto max-w-full">
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

            <div className="w-10 sm:w-16 h-[1.5px] bg-slate-700/80 mx-2.5 sm:mx-3 shrink-0"></div>

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

            <div className="w-10 sm:w-16 h-[1.5px] bg-slate-700/80 mx-2.5 sm:mx-3 shrink-0"></div>

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
        {/* 2. MA TRẬN GHẾ NGỒI */}
        <SeatGrid
          standardRows={standardRows}
          vipRows={vipRows}
          leftCols={leftCols}
          rightCols={rightCols}
          bookedSeats={bookedSeats}
          selectedSeats={selectedSeats}
          onSeatClick={handleSeatClick}
          priceStandard={PRICE_STANDARD}
          priceVip={PRICE_VIP}
          priceSweetbox={PRICE_SWEETBOX}
        />

        {/* 3. BẢNG CHÚ THÍCH LOẠI GHẾ */}
        <SeatLegendBar
          priceStandard={PRICE_STANDARD}
          priceVip={PRICE_VIP}
          priceSweetbox={PRICE_SWEETBOX}
          selectedSeats={selectedSeats}
          timeSlotLabel={timeSlotLabel}
          roomTypeLabel={roomTypeLabel}
          format={showtime?.format}
        />
      </div>

      {/* 4. THANH HÀNH ĐỘNG CỐ ĐỊNH MÉP DƯỚI */}
      <SeatBottomActionBar
        selectedSeats={selectedSeats}
        totalAmount={calculateTotal()}
        onResetSeats={() => setSelectedSeats([])}
        onProceed={handleProceed}
        holdingLoading={holdingLoading}
      />
    </div>
  );
};

export default SeatSelectionPage;
