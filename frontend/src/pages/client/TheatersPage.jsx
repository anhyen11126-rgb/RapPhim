import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { getCinemasCached, getCachedData } from '../../services/clientDataCache';
import { FALLBACK_CINEMAS, resolveCanonicalCinema } from '../../constants/cinemas';
import {
  calculateDynamicPrices,
  loadPricingConfig,
  DEFAULT_PRICING_CONFIG,
  ROOM_TYPES_ENUM,
  ACTIVE_CINEMA_ROOM_TYPES,
  resolveCanonicalRoomType,
  getRoomThemeStyles,
} from '../../utils/pricing';

const TECH_FILTERS = ['Tất cả', 'IMAX Laser', 'Dolby Atmos', 'Gold Class'];

const PRICE_MATRIX_FORMATS = [
  { key: 'IMAX', label: 'IMAX Laser Grand Hall', roomType: 'IMAX Laser', roomName: 'Phòng 01 - IMAX Laser' },
  { key: '2D', label: 'Dolby Atmos', roomType: 'Dolby Atmos', roomName: 'Phòng 04 - Dolby Atmos' },
  { key: 'GOLD_CLASS', label: 'VIP Gold Class Lounge', roomType: 'Gold Class', roomName: 'Phòng 07 - Gold Class' },
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

  // Khởi tạo tức thì cụm rạp duy nhất từ cache/chuẩn để hiển thị UI ngay và gọi API lịch chiếu song song
  const initialCanonicalCinema = resolveCanonicalCinema(getCachedData('GET:/cinemas?city=Đà Nẵng&district=Thanh Khê').data);

  // State dữ liệu rạp từ API
  const [cinemas, setCinemas] = useState([initialCanonicalCinema]);
  const [loadingCinemas, setLoadingCinemas] = useState(false);
  const [selectedCinemaId, setSelectedCinemaId] = useState(initialCanonicalCinema.id);

  // State lịch chiếu của rạp đang chọn
  const [cinemaDetails, setCinemaDetails] = useState(initialCanonicalCinema);
  const [moviesWithShowtimes, setMoviesWithShowtimes] = useState([]);
  const [monthMovies, setMonthMovies] = useState([]);
  const [loadingShowtimes, setLoadingShowtimes] = useState(true);
  const [activeDateIndex, setActiveDateIndex] = useState(0);

  // Modal Bảng giá vé tiêu chuẩn (dùng cache có sẵn, không ép tải lại thừa)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceDayType, setPriceDayType] = useState('WEEKDAY'); // 'WEEKDAY' | 'WEEKEND'
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);

  useEffect(() => {
    loadPricingConfig(false).then((cfg) => {
      if (cfg) setPricingConfig(cfg);
    });
  }, []);

  const [searchParams] = useSearchParams();
  const dateFromLink = searchParams.get('date') || '';
  const [customDate, setCustomDate] = useState(() => /^\d{4}-\d{2}-\d{2}$/.test(dateFromLink) ? dateFromLink : '');
  const nextMonth = new Date();
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStart = nextMonth.getFullYear() + '-' + String(nextMonth.getMonth() + 1).padStart(2, '0') + '-01';

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
    } else if (type === 'next_month') {
      setCustomDate(nextMonthStart);
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

        const rawList = await getCinemasCached(params);
        const data = rawList && rawList.length > 0 ? rawList : null;

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

    const request = new AbortController();
    const fetchCinemaShowtimes = async () => {
      try {
        setLoadingShowtimes(true);
        setMoviesWithShowtimes([]);
        setMonthMovies([]);
        const selectedDate = customDate || dates[activeDateIndex]?.isoDate;
        const res = await api.get(`/cinemas/${selectedCinemaId}/showtimes`, {
          params: { date: selectedDate, view: 'published' }, signal: request.signal,
        });

        if (res.data && !request.signal.aborted) {
          setCinemaDetails(res.data.cinema);
          setMoviesWithShowtimes(res.data.movies || []);
          setMonthMovies(res.data.monthMovies ?? []);
        }
      } catch (err) {
        if (request.signal.aborted) return;
        console.warn('Lỗi khi tải lịch chiếu rạp:', err.message);
        const currentCinema = cinemas.find((c) => c.id === selectedCinemaId) || FALLBACK_CINEMAS.find((c) => c.id === selectedCinemaId);
        if (currentCinema) {
          setCinemaDetails(currentCinema);
        }
      } finally {
        if (!request.signal.aborted) setLoadingShowtimes(false);
      }
    };

    fetchCinemaShowtimes();
    return () => request.abort();
  }, [selectedCinemaId, activeDateIndex, customDate]);

  // Điều hướng sang màn hình chọn ghế với showtimeId thật từ DB kèm slotInfo hiển thị tức thì
  const handleSelectShowtime = (showtimeId, movie = null, room = null, st = null) => {
    const selectedDateIso = customDate || dates[activeDateIndex]?.isoDate || new Date().toISOString().slice(0, 10);
    const slotInfo = movie && room && st
      ? {
          id: showtimeId,
          _id: showtimeId,
          movie: {
            id: movie.id || movie._id,
            _id: movie._id || movie.id,
            title: movie.title,
            posterUrl: movie.posterUrl,
            duration: movie.duration,
            genre: movie.genre,
            ageRating: movie.ageRating,
          },
          roomName: room.name,
          roomType: resolveCanonicalRoomType(room),
          format: room.feature || resolveCanonicalRoomType(room),
          time: st.time,
          date: selectedDateIso,
          price: st.priceStandard || st.price,
          ticketPrices:
            st.priceStandard && st.priceVip && st.priceSweetbox
              ? { standard: st.priceStandard, vip: st.priceVip, sweetbox: st.priceSweetbox }
              : undefined,
          cinemaName: cinemaDetails?.name || "D'AVENOR Thanh Khê Plaza",
        }
      : undefined;

    navigate(`/booking/seat/${showtimeId}`, slotInfo ? { state: { slotInfo } } : undefined);
  };

  // Kiểm tra phòng chiếu có khớp với công nghệ đã chọn dựa trên enum room.roomType kết hợp định dạng phim
  const isRoomMatchingTech = (room, tech) => {
    if (!tech || tech === 'Tất cả') return true;
    const canonicalType = resolveCanonicalRoomType(room);
    const feature = (room.feature || '').toLowerCase();

    if (tech === ROOM_TYPES_ENUM.IMAX_LASER) {
      return canonicalType === ROOM_TYPES_ENUM.IMAX_LASER;
    }
    if (tech === ROOM_TYPES_ENUM.DOLBY_ATMOS) {
      return canonicalType === ROOM_TYPES_ENUM.DOLBY_ATMOS;
    }
    if (tech === ROOM_TYPES_ENUM.GOLD_CLASS) {
      return canonicalType === ROOM_TYPES_ENUM.GOLD_CLASS;
    }
    if (tech === ROOM_TYPES_ENUM.REALD_3D) {
      return canonicalType === ROOM_TYPES_ENUM.REALD_3D || /\b3d\b/i.test(feature) || feature.includes('reald');
    }
    return canonicalType.toLowerCase() === tech.toLowerCase();
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
    <div className="bg-[var(--bg-main)] min-h-screen text-[var(--text-main)] pb-20">
      {/* 1. THANH TÌM KIẾM & LỌC CÔNG NGHỆ PHÒNG CHIẾU */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-8 pb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Lọc công nghệ */}
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap">
              Công nghệ:
            </span>
            <div className="flex items-center space-x-1.5">
              {TECH_FILTERS.map((tech) => (
                <button
                  key={tech}
                  onClick={() => setActiveTech(tech)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${activeTech === tech
                    ? 'bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] font-black shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[#20204B] border border-[#AA9BFF]/25'
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
              <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center space-x-2">
                <span>🏢</span>
                <span>Cụm rạp D'AVENOR Thanh Khê</span>
              </h2>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {cinemas.length} rạp
              </span>
            </div>

            {loadingCinemas ? (
              <div className="p-8 text-center bg-[var(--bg-secondary)] rounded-2xl border border-[#AA9BFF]/20 text-[var(--text-muted)] text-xs">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[#42DFFF] border-t-transparent mb-2"></div>
                <p>Đang tải danh sách rạp từ Database...</p>
              </div>
            ) : cinemas.length === 0 ? (
              <div className="p-8 text-center bg-[var(--bg-secondary)] rounded-2xl border border-[#AA9BFF]/20 text-[var(--text-muted)] text-xs">
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
                        ? 'bg-[var(--bg-secondary)] border-2 border-[#42DFFF] shadow-[0_0_20px_rgba(66,223,255,0.25)] ring-1 ring-[#83F5FF]/50'
                        : 'bg-[var(--bg-secondary)]/70 border-[#AA9BFF]/20 hover:bg-[#20204B] hover:border-[#AA9BFF]/40'
                        }`}
                    >
                      {/* Header rạp: Flagship & Khoảng cách */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {cinema.isFlagship ? (
                          <span className="bg-[#A855F7]/20 text-[#F4A5FF] border border-[#A855F7]/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center space-x-1">
                            <span>⭐</span>
                            <span>Flagship Cineplex</span>
                          </span>
                        ) : (
                          <div />
                        )}
                        <span className="text-[11px] font-bold text-[#42DFFF] flex items-center space-x-0.5">
                          <span>📍</span>
                          <span>{cinema.distance || 'Gần bạn'}</span>
                        </span>
                      </div>

                      {/* Tên rạp */}
                      <h3
                        className={`text-sm font-black tracking-tight mb-1.5 transition-colors ${isSelected ? 'text-[#83F5FF]' : 'text-[var(--text-main)]'
                          }`}
                      >
                        {cinema.name}
                      </h3>

                      {/* Địa chỉ */}
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed mb-3">
                        {cinema.address}
                      </p>

                      {/* Thẻ công nghệ (Chỉ hiển thị 3 loại phòng chuẩn: IMAX Laser, Dolby Atmos, Gold Class với đúng màu nhận diện) */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#AA9BFF]/15">
                        {ACTIVE_CINEMA_ROOM_TYPES.map((tag) => {
                          const tagTheme = getRoomThemeStyles(tag);
                          const isTagActive = activeTech === tag;
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTech(isTagActive ? 'Tất cả' : tag);
                              }}
                              className={`border text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                                isTagActive ? tagTheme.tagActive : tagTheme.tagIdle
                              }`}
                              title={`Lọc phòng chiếu ${tag}`}
                            >
                              {tag}
                            </button>
                          );
                        })}
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
                <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/25 rounded-2xl overflow-hidden shadow-2xl">
                  {/* Ảnh rạp */}
                  <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-[var(--bg-main)]">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-[#11152F] via-[#11152F]/60 to-transparent" />

                    {/* Rating góc trên bên phải */}
                    <div className="absolute top-4 right-4 bg-[var(--bg-main)]/80 backdrop-blur-md border border-[#42DFFF]/40 px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-lg">
                      <span className="text-[#42DFFF] text-xs">⭐</span>
                      <span className="text-white text-xs font-black">{cinemaDetails.rating || '4.9'}</span>
                      <span className="text-[var(--text-muted)] text-[10px]">({cinemaDetails.reviewsCount || '1500'} đánh giá)</span>
                    </div>

                    {/* Badges nổi bật góc dưới ảnh */}
                    <div className="absolute bottom-4 left-6 flex flex-wrap items-center gap-2">
                      {cinemaDetails.isFlagship && (
                        <span className="bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] text-xs font-black px-2.5 py-1 rounded-md shadow">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[var(--text-muted)]">
                      <div className="flex items-start space-x-2.5">
                        <span className="text-base text-pink-400 shrink-0">📍</span>
                        <span className="leading-relaxed">{cinemaDetails.address}</span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <span className="text-base text-[#42DFFF] shrink-0">🕒</span>
                        <span>Giờ mở cửa: <strong className="text-white">{cinemaDetails.openingHours || '08:00 - 02:00 sáng'}</strong></span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <span className="text-base text-emerald-400 shrink-0">📞</span>
                        <span>Hotline đặt vé: <strong className="text-white">{cinemaDetails.hotline || '1900 8899'}</strong></span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <span className="text-base text-[#83F5FF] shrink-0">🅿️</span>
                        <span>{cinemaDetails.parking || 'Hầm giữ xe 24/7'}</span>
                      </div>
                    </div>

                    {/* Nút hành động */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#AA9BFF]/20">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsPriceModalOpen(true)}
                          className="bg-[#20204B] hover:bg-[#25234D] text-[var(--text-main)] hover:text-[#83F5FF] text-xs font-bold px-4 py-2 rounded-xl transition-colors border border-[#AA9BFF]/30 hover:border-[#42DFFF]/50 flex items-center space-x-1.5 cursor-pointer"
                        >
                          <span>📋</span>
                          <span>Bảng giá vé tiêu chuẩn</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{cinemaDetails.roomCount || 9} phòng chiếu đang sẵn sàng</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CHỌN NGÀY CHIẾU & ĐIỀU HƯỚNG THEO TUẦN / THÁNG */}
                <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[#AA9BFF]/25 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">📅</span>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Lịch chiếu theo tuần & tháng</h3>
                    </div>
                    
                    {/* Các nút nhảy nhanh theo tuần/tháng */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => jumpToPeriod('this_week')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          !customDate && activeDateIndex === 0
                            ? 'bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] font-black shadow-sm'
                            : 'bg-[#20204B] text-[var(--text-muted)] hover:text-white hover:bg-[#25234D]'
                        }`}
                      >
                        ⚡ Tuần này
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToPeriod('next_week')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#20204B] text-[var(--text-muted)] hover:text-white hover:bg-[#25234D] transition-all"
                      >
                        ⏩ Tuần sau
                      </button>
                      <button type="button" onClick={() => jumpToPeriod('next_month')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#20204B] text-[#F4A5FF] hover:bg-[#25234D] border border-[#A855F7]/30">
                        {'Tháng '}{nextMonth.getMonth() + 1}/{nextMonth.getFullYear()}
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
                          className="bg-[var(--bg-main)] border border-[#AA9BFF]/30 text-xs text-[var(--text-main)] rounded-lg px-2 py-1 outline-none focus:border-[#42DFFF] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {customDate && !dates.some((d) => d.isoDate === customDate) && (
                    <div className="flex items-center justify-between bg-[#20204B] border border-[#42DFFF]/40 px-3 py-1.5 rounded-xl text-xs text-[#83F5FF]">
                      <span>Đang xem lịch ngày: <strong className="text-white">{customDate}</strong></span>
                      <button
                        type="button"
                        onClick={() => { setCustomDate(''); setActiveDateIndex(0); }}
                        className="text-xs text-[#42DFFF] hover:underline"
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
                            ? 'bg-gradient-to-r from-[#A855F7] to-[#42DFFF] text-[#0B1026] border-[#42DFFF] shadow-[0_0_12px_rgba(66,223,255,0.4)] font-bold'
                            : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-white border-[#AA9BFF]/20 hover:bg-[#20204B]'
                            }`}
                        >
                          <span className={`text-[10px] tracking-wider font-semibold uppercase ${isActive ? 'text-[#0B1026]' : 'text-[#929ABD]'}`}>
                            {item.dayStr}
                          </span>
                          <span className={`text-sm font-black mt-0.5 ${isActive ? 'text-[#0B1026]' : 'text-[var(--text-main)]'}`}>
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
                    <div className="flex items-center justify-between bg-[#20204B] border border-[#42DFFF]/40 px-4 py-2.5 rounded-2xl text-xs text-[#83F5FF] shadow-sm animate-fadeIn">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">🎯</span>
                        <span>
                          Đang lọc các phòng chiếu công nghệ: <strong className="text-white font-bold bg-[var(--bg-secondary)] px-2 py-0.5 rounded border border-[#42DFFF]/40">{activeTech}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTech('Tất cả')}
                        className="text-[#42DFFF] hover:text-white underline font-semibold transition-colors flex items-center space-x-1"
                      >
                        <span>✕</span>
                        <span>Xem tất cả phòng</span>
                      </button>
                    </div>
                  )}

                  {loadingShowtimes ? (
                    <div className="p-12 text-center bg-[var(--bg-secondary)] rounded-3xl border border-[#AA9BFF]/25 text-[var(--text-muted)] text-xs">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#42DFFF] border-t-transparent mb-2"></div>
                      <p>Đang đồng bộ suất chiếu thời gian thực từ Database...</p>
                    </div>
                  ) : filteredMovies.length > 0 ? (
                    filteredMovies.map((movie) => (
                      <div
                        key={movie.id}
                        className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/25 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 hover:border-[#42DFFF]/40 transition-colors"
                      >
                        {/* Header: Poster & Thông tin phim */}
                        <div className="flex items-start space-x-4">
                          <div className="relative w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-main)] shrink-0 shadow-md">
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
                            <h4 className="text-lg font-black text-white hover:text-[#42DFFF] transition-colors">
                              <Link to={`/movie/${movie.id}`}>{movie.title}</Link>
                            </h4>
                            <p className="text-xs text-[var(--text-muted)] font-medium">{movie.originalTitle}</p>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-xs text-[var(--text-muted)]">
                              <span className="text-emerald-400 font-bold">{movie.ratingPercent || '98% Hài lòng'}</span>
                              <span>•</span>
                              <span>{movie.duration}</span>
                              <span>•</span>
                              <span className="text-[var(--text-main)]">{movie.genre}</span>
                            </div>
                          </div>
                        </div>

                        {/* Danh sách phòng & các khung giờ (Phân biệt màu tự động theo roomType của 9 phòng vật lý) */}
                        <div className="space-y-3 pt-2">
                          {movie.rooms && movie.rooms.map((room, rIdx) => {
                            const roomTheme = getRoomThemeStyles(room);
                            return (
                              <div
                                key={rIdx}
                                className={`border rounded-2xl p-4 space-y-3 ${roomTheme.roomCard}`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center space-x-2">
                                    <span className={roomTheme.roomBadge}>
                                      {room.name}
                                    </span>
                                    {room.feature && (
                                      <span className={`text-[11px] font-medium ${roomTheme.featureText}`}>
                                        • {room.feature}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[var(--text-muted)] font-medium text-[11px]">
                                    {room.priceText}
                                  </span>
                                </div>

                                {/* Các nút bấm Suất chiếu liên kết thẳng tới SeatSelectionPage */}
                                <div className="flex flex-wrap items-center gap-2.5">
                                  {room.showtimes.map((st) => (
                                    <button
                                      key={st.id}
                                      onClick={() => handleSelectShowtime(st.id, movie, room, st)}
                                      className={`group relative px-3.5 py-2 rounded-xl text-left transition-all duration-200 shadow-sm cursor-pointer ${roomTheme.slotBtn}`}
                                    >
                                      <div className="flex items-baseline space-x-2">
                                        <span className="block text-sm font-black text-white">
                                          {st.time}
                                        </span>
                                        {st.price && (
                                          <span className={`text-[11px] font-bold transition-colors ${roomTheme.priceText}`}>
                                            Từ {st.price.toLocaleString('vi-VN')} đ
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className={`block text-[10px] font-semibold mt-0.5 ${
                                          st.statusColor || 'text-emerald-400'
                                        }`}
                                      >
                                        {st.seatText}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : moviesWithShowtimes.length > 0 && activeTech !== 'Tất cả' ? (
                    <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/25 rounded-3xl p-10 text-center space-y-3">
                      <div className="text-3xl">🎬</div>
                      <h4 className="text-base font-bold text-white">
                        Không có phòng chiếu công nghệ "{activeTech}"
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                        Không tìm thấy phòng chiếu áp dụng công nghệ <span className="text-[#42DFFF] font-semibold">{activeTech}</span> trong ngày đã chọn.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTech('Tất cả')}
                        className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#42DFFF] text-[#0B1026] text-xs font-bold shadow-md transition-colors"
                      >
                        <span>✨</span>
                        <span>Xem tất cả công nghệ</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/25 rounded-3xl p-10 text-center space-y-3">
                      <div className="text-3xl">🍿</div>
                      <h4 className="text-base font-bold text-white">
                        Chưa có suất chiếu trong ngày đã chọn tại rạp này
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                        Vui lòng chọn ngày khác trên thanh lịch chiếu để xem các suất chiếu có sẵn tại <strong>{cinemaDetails?.name || "D'AVENOR Thanh Khê Plaza"}</strong>.
                      </p>
                      {monthMovies.length > 0 && (
                        <ul className="flex flex-wrap justify-center gap-2" aria-label={'Phim khởi chiếu trong tháng'}>
                          {monthMovies.map(movie => <li key={movie._id}>
                            <Link to={'/movie/' + movie._id} className="inline-block rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--cyan)]">
                              {movie.title}
                            </Link>
                          </li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/25 rounded-3xl p-16 text-center text-[var(--text-muted)] text-sm">
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

