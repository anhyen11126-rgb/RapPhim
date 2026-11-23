import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import api from '../../services/api';
import SeatGrid from '../../components/seat-booking/SeatGrid';
import MovieInfoSidebar from '../../components/seat-booking/MovieInfoSidebar';
import SeatLegendBar from '../../components/seat-booking/SeatLegendBar';
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
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);

  useEffect(() => {
    loadPricingConfig().then((cfg) => {
      if (cfg) setPricingConfig(cfg);
    });
  }, []);

  useEffect(() => {
    fetchSeats();
  }, [showtimeId]);

  const fetchSeats = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const dateParam = slotInfo?.date ? `?date=${encodeURIComponent(slotInfo.date)}` : '';
      const res = await api.get(`/showtimes/${showtimeId}/seats${dateParam}`);

      if (res.data?.showtime) {
        // Hợp nhất dữ liệu suất chiếu thực tế từ DB và slot được người dùng chọn
        setShowtime({
          ...res.data.showtime,
          ...(slotInfo || {}),
          id: res.data.showtime.id || res.data.showtime._id,
          _id: res.data.showtime._id || res.data.showtime.id,
          movie: slotInfo?.movie || res.data.showtime.movie,
          format: slotInfo?.format || res.data.showtime.format || res.data.showtime.formatFeature || 'IMAX Laser 2D',
          roomName: slotInfo?.roomName || res.data.showtime.roomName || 'Phòng IMAX Laser',
          roomType: slotInfo?.roomType || (
            (slotInfo?.roomName || res.data.showtime.roomName || '').toLowerCase().includes('atmos')
              ? 'ATMOS'
              : (slotInfo?.roomName || res.data.showtime.roomName || '').toLowerCase().includes('gold')
              ? 'GOLD'
              : 'IMAX'
          ),
          time: slotInfo?.time || res.data.showtime.time,
          date: slotInfo?.date || res.data.showtime.date || res.data.showtime.startTime || new Date().toISOString().slice(0, 10),
          price: slotInfo?.price || res.data.showtime.price,
          cinemaName: slotInfo?.cinemaName || res.data.showtime.cinema?.name || "D'AVENOR Thanh Khê Plaza",
        });
      } else if (slotInfo) {
        setShowtime(slotInfo);
      }

      if (res.data?.seats && Array.isArray(res.data.seats)) {
        // Chỉ lấy những ghế thực tế đã được thanh toán (BOOKED) trong Database
        const booked = res.data.seats
          .filter((s) => s.status === 'BOOKED')
          .map((s) => s.seatNumber);
        setBookedSeats(booked);
      } else {
        setBookedSeats([]);
      }
    } catch (err) {
      console.warn('Lỗi tải dữ liệu suất chiếu từ DB:', err);
      if (slotInfo) {
        setShowtime(slotInfo);
        setBookedSeats([]);
      } else {
        setErrorMsg('Không thể tải sơ đồ ghế cho suất chiếu này. Vui lòng thử lại!');
        setBookedSeats([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Hàm định dạng ngày chiếu tiếng Việt linh hoạt kèm thứ trong tuần
  const formatVietnameseDate = (rawDate) => {
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    if (!rawDate) {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      return `${dayNames[now.getDay()]}, ${d}/${m}/${now.getFullYear()}`;
    }

    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      const [y, m, d] = rawDate.split('T')[0].split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = dayNames[dateObj.getDay()];
      const dStr = String(d).padStart(2, '0');
      const mStr = String(m).padStart(2, '0');
      return `${dayName}, ${dStr}/${mStr}/${y}`;
    }

    if (typeof rawDate === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(rawDate)) {
      const [d, m, y] = rawDate.split('/').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = dayNames[dateObj.getDay()];
      const dStr = String(d).padStart(2, '0');
      const mStr = String(m).padStart(2, '0');
      return `${dayName}, ${dStr}/${mStr}/${y}`;
    }

    const dateObj = new Date(rawDate);
    if (!isNaN(dateObj.getTime())) {
      const dayName = dayNames[dateObj.getDay()];
      const dStr = String(dateObj.getDate()).padStart(2, '0');
      const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
      return `${dayName}, ${dStr}/${mStr}/${dateObj.getFullYear()}`;
    }

    return String(rawDate);
  };

  // Nhận diện chuẩn loại phòng chiếu: 'IMAX' | 'ATMOS' | 'GOLD'
  const currentRoomType =
    showtime?.roomType ||
    ((showtime?.roomName || '').toLowerCase().includes('atmos')
      ? 'ATMOS'
      : (showtime?.roomName || '').toLowerCase().includes('gold')
      ? 'GOLD'
      : 'IMAX');

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

  const handleProceed = () => {
    if (selectedSeats.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ghế để tiếp tục!');
      return;
    }

    const targetShowtimeId = showtime?._id?.toString() || showtime?.id || showtimeId;

    navigate('/checkout', {
      state: {
        showtimeId: targetShowtimeId,
        showtime: {
          ...showtime,
          id: targetShowtimeId,
          format: showtime?.format || roomTypeLabel,
          cinemaName: showtime?.cinemaName || showtime?.cinema?.name || "D'AVENOR Thanh Khê Plaza",
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
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030D25] flex flex-col items-center justify-center text-white">
        <div className="inline-block animate-spin rounded-full h-11 w-11 border-4 border-[#00D9FF] border-t-transparent mb-3 shadow-[0_0_15px_#00D9FF]"></div>
        <p className="text-slate-300 text-sm font-semibold tracking-wide">
          Đang tải không gian phòng chiếu cao cấp...
        </p>
      </div>
    );
  }

  // Cấu hình chuyển màu mượt mà từ xanh tím Navbar (#0B1026) dần xuống màu của từng phòng và kết nối êm vào chân trang (#070A18)
  const roomTheme =
    currentRoomType === 'GOLD'
      ? {
          // Nền trang sang trọng đồng bộ hoàn hảo cùng Navbar (#0B1026): Obsidian cyber navy sâu thẳm, vầng quang kim hoàng gia (#FFD18A)
          pageBgGradient:
            'bg-gradient-to-b from-[#0B1026] via-[#090E22] via-[#0B1129] via-[#080C1E] to-[#070A18]',
          ambientAura:
            'radial-gradient(ellipse 90% 50% at 50% 18%, rgba(255, 209, 138, 0.16), rgba(229, 169, 60, 0.08) 45%, transparent 75%)',
          subBarBg: 'bg-gradient-to-r from-[#0B1026]/95 via-[#0F1532]/95 to-[#0B1026]/95',
          subBarBorder:
            'border-b border-[#FFD18A]/35 shadow-[0_6px_25px_rgba(255,209,138,0.12)]',
          backBtn:
            'border-[#FFD18A]/40 text-amber-100 hover:border-[#FFD18A]/80 hover:text-white hover:bg-[#FFD18A]/10',
          stepperBg:
            'bg-[#0A0F25]/90 border-[#FFD18A]/40 shadow-[0_0_15px_rgba(255,209,138,0.15)]',
          step1Circle:
            'bg-gradient-to-r from-[#FFD18A] via-[#E5A93C] to-[#FF85C8] text-[#0A0E23] shadow-[0_0_10px_rgba(255,209,138,0.8)]',
          step1Box: 'bg-[#FFD18A]/20 border-[#FFD18A]/50 text-[#FFF5E6]',
          stepLine: 'bg-[#FFD18A]/35',
          stepOtherText: 'text-amber-100/60',
          gridCardBg:
            'border-[#FFD18A]/35 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(255,209,138,0.12)] bg-[#0A0E24]/85',
          bottomDivider: 'from-transparent via-[#FFD18A]/45 to-transparent',
        }
      : currentRoomType === 'ATMOS'
      ? {
          // Nền trang chuyển tiếp: Navbar xanh tím #0B1026 -> Tím vòm Atmos #16072D -> #110524 -> #0E041E -> Chân trang #070A18
          pageBgGradient:
            'bg-gradient-to-b from-[#0B1026] via-[#15062C] via-[#120525] via-[#0E041D] to-[#070A18]',
          ambientAura:
            'radial-gradient(ellipse 90% 45% at 50% 20%, rgba(123, 44, 255, 0.15), rgba(0, 213, 255, 0.06) 50%, transparent 80%)',
          subBarBg: 'bg-gradient-to-b from-[#0B1026] via-[#100624] to-[#14062B]',
          subBarBorder:
            'border-b border-[#7B2CFF]/25 shadow-[0_6px_25px_rgba(123,44,255,0.08)]',
          backBtn:
            'border-[#7B2CFF]/30 text-purple-100 hover:border-[#7B2CFF]/60 hover:text-white hover:bg-[#7B2CFF]/10',
          stepperBg:
            'bg-[#100625]/90 border-[#7B2CFF]/35 shadow-[0_0_15px_rgba(123,44,255,0.15)]',
          step1Circle:
            'bg-gradient-to-r from-[#7B2CFF] to-[#00D5FF] text-white shadow-[0_0_10px_rgba(164,75,255,0.7)]',
          step1Box: 'bg-[#7B2CFF]/20 border-[#7B2CFF]/45 text-white',
          stepLine: 'bg-[#7B2CFF]/30',
          stepOtherText: 'text-purple-200/50',
          gridCardBg:
            'border-[#7B2CFF]/25 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(123,44,255,0.08)] bg-[#0E061E]/85',
          bottomDivider: 'from-transparent via-[#7B2CFF]/35 to-transparent',
        }
      : {
          // Nền trang chuyển tiếp: Navbar xanh tím #0B1026 -> Đại dương IMAX Laser #051433 -> #030D25 -> #02091C -> Chân trang #070A18
          pageBgGradient:
            'bg-gradient-to-b from-[#0B1026] via-[#051433] via-[#030D25] via-[#02091C] to-[#070A18]',
          ambientAura:
            'radial-gradient(ellipse 90% 45% at 50% 20%, rgba(0, 217, 255, 0.14), rgba(139, 61, 255, 0.06) 50%, transparent 80%)',
          subBarBg: 'bg-gradient-to-b from-[#0B1026] via-[#041029] to-[#051332]',
          subBarBorder:
            'border-b border-[#00D9FF]/25 shadow-[0_6px_25px_rgba(0,217,255,0.08)]',
          backBtn:
            'border-[#00D9FF]/30 text-cyan-100 hover:border-[#00D9FF]/60 hover:text-white hover:bg-[#00D9FF]/10',
          stepperBg:
            'bg-[#030D25]/90 border-[#00D9FF]/35 shadow-[0_0_15px_rgba(0,217,255,0.15)]',
          step1Circle:
            'bg-gradient-to-r from-[#00D9FF] to-[#006DFF] text-[#030D25] shadow-[0_0_10px_rgba(0,217,255,0.7)]',
          step1Box: 'bg-[#00D9FF]/20 border-[#00D9FF]/45 text-white',
          stepLine: 'bg-[#00D9FF]/30',
          stepOtherText: 'text-slate-400',
          gridCardBg:
            'border-[#00D9FF]/25 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(0,217,255,0.08)] bg-[#030D25]/85',
          bottomDivider: 'from-transparent via-[#00D9FF]/35 to-transparent',
        };

  return (
    <div
      className={`min-h-screen ${roomTheme.pageBgGradient} text-[#F8F7FF] pb-24 selection:bg-[#00D9FF] selection:text-[#030D25] transition-colors duration-500 relative`}
    >
      {/* Vầng sáng quang học ambient hòa trộn theo màu phòng chiếu */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: roomTheme.ambientAura }}
      ></div>

      {/* 1. THANH TIÊU ĐỀ TRÊN CÙNG: QUAY LẠI + TIẾN TRÌNH 3 BƯỚC */}
      <div
        className={`w-full ${roomTheme.subBarBg} ${roomTheme.subBarBorder} backdrop-blur-xl py-3 mb-4 shadow-xl animate-smooth-fade relative z-20`}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
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
              className={`w-9 h-9 rounded-full bg-white/5 border ${roomTheme.backBtn} flex items-center justify-center text-sm transition-all shadow-md shrink-0 cursor-pointer active:scale-95`}
              title="Quay lại trang trước"
            >
              ←
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white tracking-wide">
                  {showtime?.movie?.title || 'Dune: Hành Tinh Cát 2'}
                </h1>
                <span className="bg-[#f59e0b] text-[#0a1120] font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                  {showtime?.movie?.ageRating || '13+'}
                </span>
                <span
                  className={`font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider border shadow-sm ${
                    currentRoomType === 'GOLD'
                      ? 'bg-[#FFD18A]/20 text-[#FFD18A] border-[#FFD18A]/50 shadow-[0_0_12px_rgba(255,209,138,0.3)]'
                      : currentRoomType === 'ATMOS'
                      ? 'bg-[#7B2CFF]/20 text-[#D8B4FF] border-[#7B2CFF]/50 shadow-[0_0_12px_rgba(123,44,255,0.3)]'
                      : 'bg-[#00D9FF]/20 text-[#83F5FF] border-[#00D9FF]/50 shadow-[0_0_12px_rgba(0,217,255,0.3)]'
                  }`}
                >
                  {showtime?.format || (currentRoomType === 'GOLD' ? 'GOLD CLASS LUXURY' : currentRoomType === 'ATMOS' ? '2D DOLBY ATMOS' : 'IMAX LASER 2D')}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className="text-red-400">📍</span>
                  <span>{showtime?.cinemaName || showtime?.cinema?.name || "D'AVENOR Thanh Khê Plaza"}</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className={currentRoomType === 'GOLD' ? 'text-amber-400' : currentRoomType === 'ATMOS' ? 'text-purple-400' : 'text-cyan-400'}>
                    📽
                  </span>
                  <span className="font-bold text-white">
                    {showtime?.roomName || (currentRoomType === 'GOLD' ? 'Phòng Gold Class' : currentRoomType === 'ATMOS' ? 'Phòng Dolby Atmos' : 'Phòng IMAX Laser')}
                  </span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className="text-blue-400">📅</span>
                  <span className="font-semibold text-white">
                    {formatVietnameseDate(showtime?.date || showtime?.startTime)}
                  </span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className="text-amber-400">🕒</span>
                  <span className="font-bold text-white">{showtime?.time || '19:30'}</span>
                  <span className="text-slate-400">({timeSlotLabel})</span>
                </span>
                <span className="text-slate-600">•</span>
                <span>{showtime?.movie?.duration || 120} phút</span>
              </div>
            </div>
          </div>

          {/* Thanh tiến trình 3 bước đồng bộ màu sắc theo phòng */}
          <div
            className={`inline-flex items-center ${roomTheme.stepperBg} rounded-full px-4 py-1.5 shadow-lg backdrop-blur-md overflow-x-auto max-w-full`}
          >
            <div className={`flex items-center space-x-2 ${roomTheme.step1Box} rounded-full pl-1.5 pr-3 py-0.5 shrink-0`}>
              <div className={`w-4 h-4 rounded-full ${roomTheme.step1Circle} flex items-center justify-center text-[10px] font-black shrink-0`}>
                1
              </div>
              <span className="text-xs font-black leading-tight">
                Chọn ghế
              </span>
            </div>

            <div className={`w-8 sm:w-12 h-[1px] ${roomTheme.stepLine} mx-2 shrink-0`}></div>

            <div className={`flex items-center space-x-1.5 ${roomTheme.stepOtherText} shrink-0`}>
              <div className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold shrink-0">
                2
              </div>
              <span className="text-xs font-medium">
                Đồ ăn & Thanh toán
              </span>
            </div>

            <div className={`w-8 sm:w-12 h-[1px] ${roomTheme.stepLine} mx-2 shrink-0`}></div>

            <div className={`flex items-center space-x-1.5 ${roomTheme.stepOtherText} shrink-0`}>
              <div className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold shrink-0">
                3
              </div>
              <span className="text-xs font-medium">
                Vé điện tử
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KHU VỰC CHÍNH (SIDEBAR TRÁI + SƠ ĐỒ 88 GHẾ PHẢI) */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 relative z-10">
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8 justify-center">
          {/* CỘT TRÁI: SIDEBAR THÔNG TIN PHIM & CÔNG NGHỆ PHÒNG (GIỐNG ẢNH THAM KHẢO) */}
          <MovieInfoSidebar
            movie={showtime?.movie}
            showtime={showtime}
            roomType={currentRoomType}
          />

          {/* CỘT PHẢI: KHÔNG GIAN PHÒNG CHIẾU & MA TRẬN 88 GHẾ */}
          <div className={`flex-1 w-full min-w-0 backdrop-blur-2xl border rounded-2xl p-4 sm:p-6 relative overflow-hidden flex flex-col items-center transition-all ${roomTheme.gridCardBg}`}>
            <SeatGrid
              roomType={currentRoomType}
              bookedSeats={bookedSeats}
              selectedSeats={selectedSeats}
              onSeatClick={handleSeatClick}
            />
          </div>
        </div>
      </main>

      {/* 3. DẢI CHUYỂN TIẾP MƯỢT XUỐNG CHÂN TRANG (FOOTER) - KHÔNG BỊ CẮT MÀU ĐỘT NGỘT */}
      <div className="w-full relative mt-8 pb-4 flex flex-col items-center pointer-events-none">
        <div className={`h-[1px] w-full max-w-[1400px] bg-gradient-to-r ${roomTheme.bottomDivider}`}></div>
        <div className="h-16 w-full bg-gradient-to-b from-transparent to-[#070A18]"></div>
      </div>

      {/* 4. THANH ĐIỀU KHIỂN & CHÚ THÍCH CỐ ĐỊNH Ở ĐÁY TRANG (GIỐNG ẢNH THAM KHẢO) */}
      <SeatLegendBar
        roomType={currentRoomType}
        bookedSeats={bookedSeats}
        selectedSeats={selectedSeats}
        totalAmount={calculateTotal()}
        onProceed={handleProceed}
      />
    </div>
  );
};

export default SeatSelectionPage;
