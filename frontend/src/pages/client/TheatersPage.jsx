import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { FALLBACK_CINEMAS } from '../../constants/cinemas';

const REGIONS = [
  'Tất cả quận',
  'Hải Châu',
  'Thanh Khê',
  'Sơn Trà',
  'Cẩm Lệ',
  'Ngũ Hành Sơn',
  'Liên Chiểu',
];

const TECH_FILTERS = ['Tất cả', 'IMAX Laser', 'Dolby Atmos', 'Gold Class'];

const TheatersPage = () => {
  const navigate = useNavigate();

  // State bộ lọc quận huyện tại Đà Nẵng
  const [activeRegion, setActiveRegion] = useState(() => {
    return localStorage.getItem('selectedDistrict') || 'Tất cả quận';
  });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeTech, setActiveTech] = useState('Tất cả');

  const handleSelectRegion = (region) => {
    setActiveRegion(region);
    localStorage.setItem('selectedDistrict', region);
  };

  // State dữ liệu rạp từ API
  const [cinemas, setCinemas] = useState([]);
  const [loadingCinemas, setLoadingCinemas] = useState(true);
  const [selectedCinemaId, setSelectedCinemaId] = useState(null);

  // State lịch chiếu của rạp đang chọn
  const [cinemaDetails, setCinemaDetails] = useState(null);
  const [moviesWithShowtimes, setMoviesWithShowtimes] = useState([]);
  const [loadingShowtimes, setLoadingShowtimes] = useState(false);
  const [activeDateIndex, setActiveDateIndex] = useState(0);

  // Sinh 7 ngày liên tiếp tính từ hôm nay theo giờ địa phương chuẩn
  const dates = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx);
    const dayNames = ['CHỦ NHẬT', 'THỨ 2', 'THỨ 3', 'THỨ 4', 'THỨ 5', 'THỨ 6', 'THỨ 7'];
    const dayStr = idx === 0 ? 'HÔM NAY' : dayNames[d.getDay()];
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;
    return { dayStr, dateStr, isoDate };
  });

  // 1. Tải danh sách rạp từ API Backend khi thay đổi bộ lọc (Khu vực, Công nghệ, Tìm kiếm)
  useEffect(() => {
    const fetchCinemas = async () => {
      try {
        setLoadingCinemas(true);
        const params = { city: 'Đà Nẵng' };
        if (activeRegion && activeRegion !== 'Tất cả quận' && activeRegion !== 'Tất cả khu vực') {
          params.district = activeRegion;
        }
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
          if (activeRegion && activeRegion !== 'Tất cả quận' && activeRegion !== 'Tất cả khu vực') {
            fallback = fallback.filter((c) => (c.district || c.address || '').toLowerCase().includes(activeRegion.toLowerCase()));
          }
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
        if (activeRegion && activeRegion !== 'Tất cả quận' && activeRegion !== 'Tất cả khu vực') {
          fallback = fallback.filter((c) => (c.district || c.address || '').toLowerCase().includes(activeRegion.toLowerCase()));
        }
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
  }, [activeRegion, activeTech, searchKeyword]);

  // 2. Tải lịch chiếu chi tiết của rạp đang chọn theo ngày từ Database
  useEffect(() => {
    if (!selectedCinemaId) return;

    const fetchCinemaShowtimes = async () => {
      try {
        setLoadingShowtimes(true);
        const selectedDate = dates[activeDateIndex]?.isoDate;
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
  }, [selectedCinemaId, activeDateIndex]);

  // Điều hướng sang màn hình chọn ghế với showtimeId thật từ DB
  const handleSelectShowtime = (showtimeId) => {
    navigate(`/booking/seat/${showtimeId}`);
  };

  return (
    <div className="bg-[#0b0f19] min-h-screen text-slate-100 pb-20">
      {/* 1. THANH LỌC KHU VỰC / TỈNH THÀNH */}
      <div className="border-b border-slate-800/80 bg-[#090d16] sticky top-16 z-40">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-0.5">
            {REGIONS.map((region) => (
              <button
                key={region}
                onClick={() => handleSelectRegion(region)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeRegion === region
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
              >
                {region}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 shrink-0">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-medium text-emerald-400">{cinemas.length} rạp</span>
            <span>đang hoạt động</span>
          </div>
        </div>
      </div>

      {/* 2. THANH TÌM KIẾM & LỌC CÔNG NGHỆ PHÒNG CHIẾU */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-5 pb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 max-w-2xl">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm tên cụm rạp, quận hoặc địa chỉ đường..."
              className="w-full bg-[#111624] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
            />
          </div>

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

      {/* 3. BỐ CỤC 2 CỘT CHÍNH TẢI ĐỘNG TỪ DATABASE */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI (4 cols): Danh sách Cụm rạp lấy từ Database */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                <span>🏢</span>
                <span>Cụm rạp tại {activeRegion === 'Tất cả quận' || activeRegion === 'Tất cả khu vực' ? 'Đà Nẵng' : `Q. ${activeRegion}`}</span>
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
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {cinema.tags && cinema.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-slate-800/90 text-slate-300 border border-slate-700/60 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <span className="text-[11px] text-slate-400 hover:text-blue-400 flex items-center space-x-1 transition-colors">
                          <span>🗺️</span>
                          <span>Xem bản đồ</span>
                        </span>
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
                      src={cinemaDetails.image || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop'}
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
                      <div className="flex items-center space-x-3">
                        <button className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors border border-slate-700 flex items-center space-x-1.5 shadow-sm">
                          <span>📍</span>
                          <span>Chỉ đường Google Maps</span>
                        </button>
                        <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-4 py-2 rounded-xl transition-colors border border-slate-700 flex items-center space-x-1.5">
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

                {/* 2. CHỌN NGÀY CHIẾU */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">📅</span>
                      <h3 className="text-base font-black text-white">Lịch chiếu rạp</h3>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">Tháng {new Date().getMonth() + 1}, {new Date().getFullYear()}</span>
                  </div>

                  <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none pb-1">
                    {dates.map((item, idx) => {
                      const isActive = idx === activeDateIndex;
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveDateIndex(idx)}
                          className={`flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl min-w-[88px] transition-all border ${isActive
                            ? 'bg-[#2563eb] text-white border-blue-500 shadow-lg shadow-blue-600/30 font-bold'
                            : 'bg-[#0f1422] text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800/60'
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
                  {loadingShowtimes ? (
                    <div className="p-12 text-center bg-[#0f1422] rounded-3xl border border-slate-800 text-slate-400 text-xs">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mb-2"></div>
                      <p>Đang đồng bộ suất chiếu thời gian thực từ Database...</p>
                    </div>
                  ) : moviesWithShowtimes.length > 0 ? (
                    moviesWithShowtimes.map((movie) => (
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

                        {/* Danh sách phòng & các khung giờ */}
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
                  ) : (
                    <div className="bg-[#0f1422] border border-slate-800 rounded-3xl p-10 text-center space-y-3">
                      <div className="text-3xl">🍿</div>
                      <h4 className="text-base font-bold text-white">
                        Chưa có suất chiếu trong ngày đã chọn tại rạp này
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Bạn có thể chọn rạp <strong>D'AVENOR Vincom Ngô Quyền</strong> hoặc chọn ngày khác để xem các suất chiếu có sẵn trong Database.
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
    </div>
  );
};

export default TheatersPage;

