import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { FALLBACK_CINEMAS } from '../../constants/cinemas';
import { calculateDynamicPrices, loadPricingConfig, DEFAULT_PRICING_CONFIG } from '../../utils/pricing';

const TECH_FILTERS = ['Tất cả', 'IMAX Laser', 'Dolby Atmos', 'RealD 3D'];

const PRICE_MATRIX_FORMATS = [
  { key: '2D', label: '2D Dolby Atmos / Tiêu chuẩn', roomName: 'Rạp 03 - 2D Dolby' },
  { key: '3D', label: 'RealD 3D High Frame Rate', roomName: 'Rạp 05 - RealD 3D' },
  { key: 'IMAX', label: 'IMAX Laser Grand Hall', roomName: 'Phòng IMAX 01' },
];

const PRICE_TIME_SLOTS = [
  { label: 'Trước 17:00', time: '14:00' },
  { label: 'Giờ vàng (17:00 – 21:59)', time: '19:30' },
  { label: 'Suất khuya (từ 22:00)', time: '22:30' },
];

const TheatersPage = () => {
  const navigate = useNavigate();

  // State bộ lọc và tìm kiếm rạp
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeTech, setActiveTech] = useState('Tất cả');

  // State dữ liệu rạp từ API
  const [cinemas, setCinemas] = useState([]);
  const [loadingCinemas, setLoadingCinemas] = useState(true);
  const [selectedCinemaId, setSelectedCinemaId] = useState(null);

  // State lịch chiếu của rạp đang chọn
  const [cinemaDetails, setCinemaDetails] = useState(null);
  const [moviesWithShowtimes, setMoviesWithShowtimes] = useState([]);
  const [loadingShowtimes, setLoadingShowtimes] = useState(false);
  const [activeDateIndex, setActiveDateIndex] = useState(0);

  // Modal Bảng giá vé tiêu chuẩn (nạp động từ MongoDB)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceDayType, setPriceDayType] = useState('WEEKDAY'); // 'WEEKDAY' | 'WEEKEND'
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);

  useEffect(() => {
    loadPricingConfig(true).then((cfg) => {
      if (cfg) setPricingConfig(cfg);
    });
  }, []);

  const [customDate, setCustomDate] = useState('');

  // Sinh 30 ngày liên tiếp tính từ hôm nay theo giờ địa phương chuẩn (hỗ trợ xem tuần này, tuần sau, tháng 11, tháng 12)
  const dates = Array.from({ length: 30 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx);
    const dayNames = ['CHỦ NHẬT', 'THỨ 2', 'THỨ 3', 'THỨ 4', 'THỨ 5', 'THỨ 6', 'THỨ 7'];
    const dayStr = idx === 0 ? 'HÔM NAY' : idx === 1 ? 'NGÀY MAI' : dayNames[d.getDay()];
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;
    return { dayStr, dateStr, isoDate, d };
  });

  const jumpToPeriod = (type) => {
    const d = new Date();
    setCustomDate('');
    if (type === 'this_week') {
      setActiveDateIndex(0);
    } else if (type === 'next_week') {
      const dayOfWeek = d.getDay();
      const diffToNextMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const nextMon = new Date(d);
      nextMon.setDate(d.getDate() + diffToNextMon);
      const nextMonIso = nextMon.toISOString().slice(0, 10);
      const foundIdx = dates.findIndex((item) => item.isoDate === nextMonIso);
      if (foundIdx !== -1) setActiveDateIndex(foundIdx);
      else setActiveDateIndex(7);
    } else if (type === 'month_11') {
      const foundIdx = dates.findIndex((item) => item.isoDate.startsWith(`${d.getFullYear()}-11`));
      if (foundIdx !== -1) setActiveDateIndex(foundIdx);
    } else if (type === 'month_12') {
      const foundIdx = dates.findIndex((item) => item.isoDate.startsWith(`${d.getFullYear()}-12`));
      if (foundIdx !== -1) setActiveDateIndex(foundIdx);
      else {
        setCustomDate(`${d.getFullYear()}-12-01`);
      }
    }
  };

  // 1. Tải danh sách rạp từ API Backend khi thay đổi bộ lọc (Khu vực, Công nghệ, Tìm kiếm)
  useEffect(() => {
    const fetchCinemas = async () => {
      try {
        setLoadingCinemas(true);
        const params = { city: 'Đà Nẵng', district: 'Thanh Khê' };
        if (activeTech && activeTech !== 'Tất cả') params.tech = activeTech;
        if (searchKeyword.trim()) params.search = searchKeyword.trim();

        const res = await api.get('/cinemas', { params });
        const data = res.data && res.data.length > 0 ? res.data : null;

        if (data) {
          setCinemas(data);
          const isCurrentSelectedStillInList = data.some((c) => c.id === selectedCinemaId);
          if (!selectedCinemaId || !isCurrentSelectedStillInList) {
            setSelectedCinemaId(data[0].id);
          }
        } else {
          // Lọc từ danh sách chuẩn nếu backend trả về rỗng
          let fallback = [...FALLBACK_CINEMAS];
          if (activeTech && activeTech !== 'Tất cả') {
            fallback = fallback.filter((c) => c.tags?.includes(activeTech));
          }
          if (searchKeyword.trim()) {
            const kw = searchKeyword.toLowerCase();
            fallback = fallback.filter((c) => c.name.toLowerCase().includes(kw) || c.address.toLowerCase().includes(kw));
          }
          setCinemas(fallback);
          if (fallback.length > 0) {
            setSelectedCinemaId(fallback[0].id);
          } else {
            setSelectedCinemaId(null);
            setCinemaDetails(null);
            setMoviesWithShowtimes([]);
          }
        }
      } catch (err) {
        console.warn('Backend chưa phản hồi, sử dụng danh sách cụm rạp chuẩn:', err.message);
        let fallback = [...FALLBACK_CINEMAS];
        if (activeTech && activeTech !== 'Tất cả') {
          fallback = fallback.filter((c) => c.tags?.includes(activeTech));
        }
        if (searchKeyword.trim()) {
          const kw = searchKeyword.toLowerCase();
          fallback = fallback.filter((c) => c.name.toLowerCase().includes(kw) || c.address.toLowerCase().includes(kw));
        }
        setCinemas(fallback);
        if (fallback.length > 0) {
          setSelectedCinemaId(fallback[0].id);
        } else {
          setSelectedCinemaId(null);
          setCinemaDetails(null);
          setMoviesWithShowtimes([]);
        }
      } finally {
        setLoadingCinemas(false);
      }
    };

    fetchCinemas();
  }, [activeTech, searchKeyword]);

  // 2. Tải lịch chiếu chi tiết của rạp đang chọn theo ngày từ Database
  useEffect(() => {
    if (!selectedCinemaId) return;

    const fetchCinemaShowtimes = async () => {
      try {
        setLoadingShowtimes(true);
        const selectedDate = customDate || dates[activeDateIndex]?.isoDate;
        const res = await api.get(`/cinemas/${selectedCinemaId}/showtimes`, {
          params: { date: selectedDate },
        });

        if (res.data) {
          setCinemaDetails(res.data.cinema);
          setMoviesWithShowtimes(res.data.movies || []);
        }
      } catch (err) {
        console.warn('Lỗi khi tải lịch chiếu rạp:', err.message);
        const currentCinema = cinemas.find((c) => c.id === selectedCinemaId) || FALLBACK_CINEMAS.find((c) => c.id === selectedCinemaId);
        if (currentCinema) {
          setCinemaDetails(currentCinema);
        }
      } finally {
        setLoadingShowtimes(false);
      }
    };

    fetchCinemaShowtimes();
  }, [selectedCinemaId, activeDateIndex, customDate]);

  // Điều hướng sang màn hình chọn ghế với showtimeId thật từ DB
  const handleSelectShowtime = (showtimeId) => {
    navigate(`/booking/seat/${showtimeId}`);
  };

  // Hàm kiểm tra phòng chiếu có khớp với công nghệ đã chọn hay không
  const isRoomMatchingTech = (room, tech) => {
    if (!tech || tech === 'Tất cả') return true;
    const name = (room.name || '').toLowerCase();
    const feature = (room.feature || '').toLowerCase();
    const combined = `${name} ${feature}`;

    if (tech === 'IMAX Laser') {
      return combined.includes('imax');
    }
    if (tech === 'RealD 3D') {
      return (combined.includes('3d') || combined.includes('reald')) && !combined.includes('imax');
    }
    if (tech === 'Dolby Atmos') {
      if (combined.includes('imax') || combined.includes('3d')) return false;
      return combined.includes('dolby') || combined.includes('atmos') || combined.includes('2d');
    }
    return combined.includes(tech.toLowerCase());
  };

  // Danh sách phim và phòng chiếu sau khi lọc theo công nghệ đã chọn
  const filteredMovies = React.useMemo(() => {
    if (!moviesWithShowtimes || moviesWithShowtimes.length === 0) return [];

    return moviesWithShowtimes
      .map((movie) => {
        const matchingRooms = (movie.rooms || []).filter((room) =>
          isRoomMatchingTech(room, activeTech)
        );
        return {
          ...movie,
          rooms: matchingRooms,
        };
      })
      .filter((movie) => movie.rooms.length > 0);
  }, [moviesWithShowtimes, activeTech]);

  return (
    <div className="bg-[#0b0f19] min-h-screen text-slate-100 pb-20">
      {/* 1. THANH TÌM KIẾM & LỌC CÔNG NGHỆ PHÒNG CHIẾU */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-8 pb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Lọc công nghệ */}
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Công nghệ:
            </span>
            <div className="flex items-center space-x-1.5">
              {TECH_FILTERS.map((tech) => (
                <button
                  key={tech}
                  onClick={() => setActiveTech(tech)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeTech === tech
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : 'bg-[#151c2d] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                    }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. BỐ CỤC 2 CỘT CHÍNH TẢI ĐỘNG TỪ DATABASE */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI (4 cols): Danh sách Cụm rạp lấy từ Database */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                <span>🏢</span>
                <span>Cụm rạp D'AVENOR Thanh Khê</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {cinemas.length} rạp
              </span>
            </div>

            {loadingCinemas ? (
              <div className="p-8 text-center bg-[#0f1422] rounded-2xl border border-slate-800 text-slate-400 text-xs">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent mb-2"></div>
                <p>Đang tải danh sách rạp từ Database...</p>
              </div>
            ) : cinemas.length === 0 ? (
              <div className="p-8 text-center bg-[#0f1422] rounded-2xl border border-slate-800 text-slate-400 text-xs">
                Không tìm thấy cụm rạp nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="space-y-3">
                {cinemas.map((cinema) => {
                  const isSelected = cinema.id === selectedCinemaId;
                  return (
                    <div
                      key={cinema.id}
                      onClick={() => setSelectedCinemaId(cinema.id)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 border ${isSelected
                        ? 'bg-[#141b2d] border-blue-500/80 shadow-lg shadow-blue-600/10 ring-1 ring-blue-500/50'
                        : 'bg-[#0f1422] border-slate-800/80 hover:bg-[#131929] hover:border-slate-700'
                        }`}
                    >
                      {/* Header rạp: Flagship & Khoảng cách */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {cinema.isFlagship ? (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center space-x-1">
                            <span>⭐</span>
                            <span>Flagship Cineplex</span>
                          </span>
                        ) : (
                          <div />
                        )}
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center space-x-0.5">
                          <span>📍</span>
                          <span>{cinema.distance || 'Gần bạn'}</span>
                        </span>
                      </div>

                      {/* Tên rạp */}
                      <h3
                        className={`text-sm font-black tracking-tight mb-1.5 transition-colors ${isSelected ? 'text-white' : 'text-slate-200'
                          }`}
                      >
                        {cinema.name}
                      </h3>

                      {/* Địa chỉ */}
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                        {cinema.address}
                      </p>

                      {/* Thẻ công nghệ */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/60">
                        {cinema.tags && cinema.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTech(tag);
                            }}
                            className={`border text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all ${activeTech === tag
                              ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/30'
                              : 'bg-slate-800/90 text-slate-300 border-slate-700/60 hover:text-white hover:bg-slate-700'
                              }`}
                            title={`Lọc phòng chiếu ${tag}`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CỘT PHẢI (8 cols): Banner chi tiết rạp & Danh sách Suất chiếu theo ngày */}
          <div className="lg:col-span-8 space-y-6">
            {cinemaDetails ? (
              <>
                {/* 1. HERO BANNER CỤM RẠP */}
                <div className="bg-[#0f1422] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  {/* Ảnh rạp */}
                  <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-900">
                    <img
                      src={
                        !cinemaDetails.image ||
                        cinemaDetails.image.includes('photo-1517604931442') ||
                        cinemaDetails.image.includes('images.unsplash.com')
                          ? '/images/cinemas/davenor-flagship-cinema.jpg'
                          : cinemaDetails.image
                      }
                      alt={cinemaDetails.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f1422] via-[#0f1422]/60 to-transparent" />

                    {/* Rating góc trên bên phải */}
                    <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md border border-amber-500/30 px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-lg">
                      <span className="text-amber-400 text-xs">⭐</span>
                      <span className="text-white text-xs font-black">{cinemaDetails.rating || '4.9'}</span>
                      <span className="text-slate-400 text-[10px]">({cinemaDetails.reviewsCount || '1500'} đánh giá)</span>
                    </div>

                    {/* Badges nổi bật góc dưới ảnh */}
                    <div className="absolute bottom-4 left-6 flex flex-wrap items-center gap-2">
                      {cinemaDetails.isFlagship && (
                        <span className="bg-amber-500 text-slate-950 text-xs font-black px-2.5 py-1 rounded-md shadow">
                          ⭐ Cụm rạp Flagship
                        </span>
                      )}
                      {cinemaDetails.specialBadge && (
                        <span className="bg-emerald-500/90 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-md shadow">
                          {cinemaDetails.specialBadge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thông tin chi tiết rạp */}
                  <div className="p-6 sm:p-7 space-y-5">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {cinemaDetails.name}
                      </h1>
                    </div>

                    {/* Grid thông số */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                      <div className="flex items-start space-x-2.5">
                        <span className="text-base text-red-500 shrink-0">📍</span>
                        <span className="leading-relaxed">{cinemaDetails.address}</span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <span className="text-base text-blue-400 shrink-0">🕒</span>
                        <span>Giờ mở cửa: <strong className="text-white">{cinemaDetails.openingHours || '08:00 - 02:00 sáng'}</strong></span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <span className="text-base text-emerald-400 shrink-0">📞</span>
                        <span>Hotline đặt vé: <strong className="text-white">{cinemaDetails.hotline || '1900 8899'}</strong></span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <span className="text-base text-amber-400 shrink-0">🅿️</span>
                        <span>{cinemaDetails.parking || 'Hầm giữ xe 24/7'}</span>
                      </div>
                    </div>

                    {/* Nút hành động */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsPriceModalOpen(true)}
                          className="bg-slate-800 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 text-xs font-bold px-4 py-2 rounded-xl transition-colors border border-slate-700 hover:border-amber-500/50 flex items-center space-x-1.5 cursor-pointer"
                        >
                          <span>📋</span>
                          <span>Bảng giá vé tiêu chuẩn</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{cinemaDetails.roomCount || 7} phòng chiếu đang sẵn sàng</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CHỌN NGÀY CHIẾU & ĐIỀU HƯỚNG THEO TUẦN / THÁNG */}
                <div className="bg-[#0f1422] p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">📅</span>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Lịch chiếu theo tuần & tháng</h3>
                    </div>
                    
                    {/* Các nút nhảy nhanh theo tuần/tháng theo yêu cầu */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => jumpToPeriod('this_week')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          !customDate && activeDateIndex === 0
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        ⚡ Tuần này
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToPeriod('next_week')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                      >
                        ⏩ Tuần sau
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToPeriod('month_11')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-900/40 text-indigo-300 hover:bg-indigo-800/60 transition-all border border-indigo-700/40"
                      >
                        🍂 Tháng 11
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToPeriod('month_12')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-900/40 text-purple-300 hover:bg-purple-800/60 transition-all border border-purple-700/40"
                      >
                        ❄️ Tháng 12
                      </button>
                      
                      {/* Chọn ngày cụ thể bất kỳ */}
                      <div className="flex items-center pl-1">
                        <input
                          type="date"
                          value={customDate || dates[activeDateIndex]?.isoDate || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomDate(val);
                            const idx = dates.findIndex((d) => d.isoDate === val);
                            if (idx !== -1) setActiveDateIndex(idx);
                          }}
                          className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1 outline-none focus:border-blue-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {customDate && !dates.some((d) => d.isoDate === customDate) && (
                    <div className="flex items-center justify-between bg-blue-950/40 border border-blue-500/40 px-3 py-1.5 rounded-xl text-xs text-blue-200">
                      <span>Đang xem lịch ngày: <strong className="text-white">{customDate}</strong></span>
                      <button
                        type="button"
                        onClick={() => { setCustomDate(''); setActiveDateIndex(0); }}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        Quay lại hôm nay ↺
                      </button>
                    </div>
                  )}

                  {/* Thanh cuộn 30 ngày */}
                  <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none pb-1">
                    {dates.map((item, idx) => {
                      const isActive = !customDate ? idx === activeDateIndex : item.isoDate === customDate;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setCustomDate('');
                            setActiveDateIndex(idx);
                          }}
                          className={`flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl min-w-[88px] transition-all border ${isActive
                            ? 'bg-[#2563eb] text-white border-blue-500 shadow-lg shadow-blue-600/30 font-bold'
                            : 'bg-[#141b2d] text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800/60'
                            }`}
                        >
                          <span className={`text-[10px] tracking-wider font-semibold uppercase ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                            {item.dayStr}
                          </span>
                          <span className={`text-sm font-black mt-0.5 ${isActive ? 'text-white' : 'text-slate-200'}`}>
                            {item.dateStr}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. DANH SÁCH PHIM & KHUNG GIỜ CHIẾU THỰC TẾ TRONG DATABASE */}
                <div className="space-y-5">
                  {/* Banner hiển thị bộ lọc công nghệ đang hoạt động */}
                  {activeTech !== 'Tất cả' && (
                    <div className="flex items-center justify-between bg-blue-950/40 border border-blue-500/30 px-4 py-2.5 rounded-2xl text-xs text-blue-200 shadow-sm animate-fadeIn">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">🎯</span>
                        <span>
                          Đang lọc các phòng chiếu công nghệ: <strong className="text-white font-bold bg-blue-600/40 px-2 py-0.5 rounded border border-blue-400/30">{activeTech}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTech('Tất cả')}
                        className="text-blue-400 hover:text-white underline font-semibold transition-colors flex items-center space-x-1"
                      >
                        <span>✕</span>
                        <span>Xem tất cả phòng</span>
                      </button>
                    </div>
                  )}

                  {loadingShowtimes ? (
                    <div className="p-12 text-center bg-[#0f1422] rounded-3xl border border-slate-800 text-slate-400 text-xs">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mb-2"></div>
                      <p>Đang đồng bộ suất chiếu thời gian thực từ Database...</p>
                    </div>
                  ) : filteredMovies.length > 0 ? (
                    filteredMovies.map((movie) => (
                      <div
                        key={movie.id}
                        className="bg-[#0f1422] border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 hover:border-slate-700/80 transition-colors"
                      >
                        {/* Header: Poster & Thông tin phim */}
                        <div className="flex items-start space-x-4">
                          <div className="relative w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 shrink-0 shadow-md">
                            <img
                              src={movie.poster || 'https://via.placeholder.com/150'}
                              alt={movie.title}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                              {movie.ageRating}
                            </span>
                          </div>

                          <div className="flex-1 space-y-1">
                            <h4 className="text-lg font-black text-white hover:text-blue-400 transition-colors">
                              <Link to={`/movie/${movie.id}`}>{movie.title}</Link>
                            </h4>
                            <p className="text-xs text-slate-400 font-medium">{movie.originalTitle}</p>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-xs text-slate-400">
                              <span className="text-emerald-400 font-bold">{movie.ratingPercent || '98% Hài lòng'}</span>
                              <span>•</span>
                              <span>{movie.duration}</span>
                              <span>•</span>
                              <span className="text-slate-300">{movie.genre}</span>
                            </div>
                          </div>
                        </div>

                        {/* Danh sách phòng & các khung giờ sau khi đã lọc theo công nghệ */}
                        <div className="space-y-3 pt-2">
                          {movie.rooms && movie.rooms.map((room, rIdx) => (
                            <div
                              key={rIdx}
                              className="bg-[#141b2c] border border-slate-800/80 rounded-2xl p-4 space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                    {room.name}
                                  </span>
                                  {room.feature && (
                                    <span className="text-slate-400 text-[11px]">
                                      • {room.feature}
                                    </span>
                                  )}
                                </div>
                                <span className="text-slate-400 font-medium text-[11px]">
                                  {room.priceText}
                                </span>
                              </div>

                              {/* Các nút bấm Suất chiếu liên kết thẳng tới SeatSelectionPage */}
                              <div className="flex flex-wrap items-center gap-2.5">
                                {room.showtimes.map((st) => (
                                  <button
                                    key={st.id}
                                    onClick={() => handleSelectShowtime(st.id)}
                                    className="group relative bg-[#0b0f19] hover:bg-[#2563eb] border border-slate-700/80 hover:border-blue-500 px-3.5 py-2 rounded-xl text-left transition-all duration-200 shadow-sm"
                                  >
                                    <div className="flex items-baseline space-x-2">
                                      <span className="block text-sm font-black text-white group-hover:text-white">
                                        {st.time}
                                      </span>
                                      {st.price && (
                                        <span className="text-[11px] font-bold text-amber-400 group-hover:text-yellow-200">
                                          {st.price.toLocaleString('vi-VN')} đ
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`block text-[10px] font-semibold mt-0.5 group-hover:text-blue-100 ${st.statusColor || 'text-slate-400'
                                        }`}
                                    >
                                      {st.seatText}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : moviesWithShowtimes.length > 0 && activeTech !== 'Tất cả' ? (
                    <div className="bg-[#0f1422] border border-slate-800 rounded-3xl p-10 text-center space-y-3">
                      <div className="text-3xl">🎬</div>
                      <h4 className="text-base font-bold text-white">
                        Không có phòng chiếu công nghệ "{activeTech}"
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Không tìm thấy phòng chiếu áp dụng công nghệ <span className="text-blue-400 font-semibold">{activeTech}</span> trong ngày đã chọn.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTech('Tất cả')}
                        className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
                      >
                        <span>✨</span>
                        <span>Xem tất cả công nghệ</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#0f1422] border border-slate-800 rounded-3xl p-10 text-center space-y-3">
                      <div className="text-3xl">🍿</div>
                      <h4 className="text-base font-bold text-white">
                        Chưa có suất chiếu trong ngày đã chọn tại rạp này
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Vui lòng chọn ngày khác trên thanh lịch chiếu để xem các suất chiếu có sẵn tại <strong>{cinemaDetails?.name || "D'AVENOR Thanh Khê Plaza"}</strong>.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-[#0f1422] border border-slate-800 rounded-3xl p-16 text-center text-slate-400 text-sm">
                Vui lòng chọn một cụm rạp ở danh sách bên trái để xem chi tiết lịch chiếu.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL BẢNG GIÁ VÉ TIÊU CHUẨN ĐỒNG BỘ LOGIC PRICING */}
      {isPriceModalOpen && (
        <div
          onClick={() => setIsPriceModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f1422] border border-slate-700/80 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>📋</span>
                  <span>Bảng Giá Vé Tiêu Chuẩn — {cinemaDetails?.name || "D'AVENOR CINEMA"}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Áp dụng đồng bộ theo định dạng phòng chiếu, ngày trong tuần và từng hạng ghế.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPriceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
              {/* Chuyển đổi Thứ 2 - Thứ 5 / Thứ 6 - CN */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPriceDayType('WEEKDAY')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      priceDayType === 'WEEKDAY'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Thứ 2 – Thứ 5 (Ngày thường)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceDayType('WEEKEND')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      priceDayType === 'WEEKEND'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Thứ 6 – Chủ Nhật (Cuối tuần)
                  </button>
                </div>

                <span className="text-[11px] text-emerald-400 font-semibold">
                  ● Đơn vị: VNĐ / vé (Sweetbox: cặp 2 ghế)
                </span>
              </div>

              {/* Bảng giá chi tiết */}
              <div className="space-y-4">
                {PRICE_MATRIX_FORMATS.map((fmt) => {
                  // Ngày 2026-11-11 là Thứ 4 (Weekday), 2026-11-14 là Thứ 7 (Weekend)
                  const refDate = priceDayType === 'WEEKEND' ? '2026-11-14' : '2026-11-11';
                  return (
                    <div
                      key={fmt.key}
                      className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden"
                    >
                      <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-black text-white">
                          🎬 {fmt.label}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                          {fmt.roomName}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="text-[10px] uppercase text-slate-400 bg-slate-950/50">
                            <tr>
                              <th className="px-4 py-2.5">Khung giờ chiếu</th>
                              <th className="px-4 py-2.5 text-right">Ghế Thường (A–D)</th>
                              <th className="px-4 py-2.5 text-right text-amber-400">Ghế VIP (E–G)</th>
                              <th className="px-4 py-2.5 text-right text-pink-400">Ghế Đôi Sweetbox (H)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70">
                            {PRICE_TIME_SLOTS.map((slot) => {
                              const prices = calculateDynamicPrices(
                                {
                                  roomName: fmt.roomName,
                                  formatFeature: fmt.label,
                                  fullDate: `${refDate}T${slot.time}:00`,
                                  time: slot.time,
                                  useConfigMatrix: true,
                                },
                                pricingConfig
                              );
                              return (
                                <tr key={slot.time} className="hover:bg-slate-800/30">
                                  <td className="px-4 py-2.5 font-semibold text-white">{slot.label}</td>
                                  <td className="px-4 py-2.5 text-right font-bold text-slate-200">
                                    {prices.priceStandard.toLocaleString('vi-VN')}đ
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-amber-400">
                                    {prices.priceVip.toLocaleString('vi-VN')}đ
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-pink-400">
                                    {prices.priceSweetbox.toLocaleString('vi-VN')}đ
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-400 border-t border-slate-800">
                <span>💡 Giá vé thực tế sẽ hiển thị chi tiết khi bạn chọn suất chiếu và sơ đồ ghế.</span>
                <button
                  type="button"
                  onClick={() => setIsPriceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                >
                  Đóng bảng giá
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TheatersPage;

