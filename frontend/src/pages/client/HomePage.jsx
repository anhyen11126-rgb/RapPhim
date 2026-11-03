import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MovieCard from '../../components/client/MovieCard';
import api from '../../services/api';

// Hàm lấy kiểu dáng nhãn theo phân loại độ tuổi
const getAgeBadgeStyle = (ageRating) => {
  switch (ageRating) {
    case 'T11':
    case 'P':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/50',
        label: ageRating === 'T11' ? 'T11 - Trên 11 tuổi' : 'P - Mọi lứa tuổi',
      };
    case 'T13':
      return {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        border: 'border-yellow-500/50',
        label: 'T13 - Trên 13 tuổi',
      };
    case 'T16':
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/50',
        label: 'T16 - Trên 16 tuổi',
      };
    case 'T18':
    default:
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/50',
        label: 'T18 - Trên 18 tuổi',
      };
  }
};

// Hàm chuyển đổi link YouTube sang link iframe embed tự động phát
const getEmbedTrailerUrl = (url) => {
  if (!url) return 'https://www.youtube.com/embed/Way9Dexny3w?autoplay=1';
  if (url.includes('embed')) return url.includes('autoplay') ? url : `${url}?autoplay=1`;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
  }
  return url;
};

// Hàm lấy ảnh nền banner điện ảnh chất lượng cao theo từng bộ phim
const getMovieBackdrop = (m) => {
  if (!m) return '/banner-dune.jpg';
  if (m.bannerUrl) return m.bannerUrl;
  if (m.backdrop) return m.backdrop;
  return m.posterUrl || m.poster || '/banner-dune.jpg';
};

const HomePage = () => {
  const navigate = useNavigate();
  const [moviesList, setMoviesList] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('NOW_SHOWING');

  // Hero Banner Slider State
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHoveringHero, setIsHoveringHero] = useState(false);

  // Quick Booking Bar State
  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [selectedTheater, setSelectedTheater] = useState('');
  const [selectedDate, setSelectedDate] = useState('Hôm nay');
  const [selectedShowtimeId, setSelectedShowtimeId] = useState('');
  const [isMovieDropdownOpen, setIsMovieDropdownOpen] = useState(false);
  const movieDropdownRef = useRef(null);

  // Trailer Modal State
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [activeTrailerMovie, setActiveTrailerMovie] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Tự động chuyển phim trên banner sau mỗi 6 giây (Tạm dừng khi di chuột hoặc khi đang mở xem trailer)
  useEffect(() => {
    if (moviesList.length <= 1 || isHoveringHero || isTrailerOpen) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % moviesList.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [moviesList.length, isHoveringHero, isTrailerOpen]);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (movieDropdownRef.current && !movieDropdownRef.current.contains(event.target)) {
        setIsMovieDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [resMovies, resCinemas] = await Promise.all([
        api.get('/movies'),
        api.get('/cinemas'),
      ]);

      if (resMovies.data && Array.isArray(resMovies.data)) {
        const formattedMovies = resMovies.data.map((m) => ({
          id: m.id || m._id?.toString(),
          title: m.title,
          slug: m.slug,
          genre: m.genre || 'Hành động, Phiêu lưu',
          ageRating: m.ageRating || 'T16',
          ageDescription:
            m.ageRating === 'P'
              ? 'Phim dành cho mọi lứa tuổi'
              : `Phim cấm khán giả dưới ${m.ageRating ? m.ageRating.replace('T', '') : 16} tuổi`,
          techFormat: Array.isArray(m.formats) && m.formats.length > 0 ? m.formats[0] : (m.techFormat || 'IMAX Laser'),
          rating: m.rating || '4.8',
          duration: m.duration || 120,
          formats: Array.isArray(m.formats) && m.formats.length > 0 ? m.formats : ['2D', '3D', 'IMAX Laser'],
          poster: m.poster || m.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
          posterUrl: m.posterUrl || m.poster,
          bannerUrl: m.bannerUrl || '',
          trailerUrl: m.trailerUrl || '',
          description: m.description || '',
          status: m.status || 'NOW_SHOWING',
          firstShowtimeId: m.firstShowtimeId,
          showtimes: m.showtimes || (m.firstShowtimeId ? [{ id: m.firstShowtimeId, roomName: 'Phòng 01 - IMAX Laser', time: '19:30' }] : []),
        }));

        setMoviesList(formattedMovies);
        if (formattedMovies.length > 0) {
          setSelectedMovieId(String(formattedMovies[0].id));
          if (formattedMovies[0].firstShowtimeId) {
            setSelectedShowtimeId(String(formattedMovies[0].firstShowtimeId));
          }
        }
      }

      if (resCinemas.data && Array.isArray(resCinemas.data)) {
        setCinemas(resCinemas.data);
        if (resCinemas.data.length > 0) {
          setSelectedTheater(resCinemas.data[0].name);
        }
      }
    } catch (err) {
      console.warn('Lỗi tải dữ liệu trang chủ từ máy chủ:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Điều khiển chuyển phim banner
  const handleNextHero = () => {
    if (moviesList.length === 0) return;
    setHeroIndex((prev) => (prev + 1) % moviesList.length);
  };

  const handlePrevHero = () => {
    if (moviesList.length === 0) return;
    setHeroIndex((prev) => (prev - 1 + moviesList.length) % moviesList.length);
  };

  const handleSelectHero = (idx) => {
    setHeroIndex(idx);
  };

  // Phim hiện tại đang hiển thị trên Banner Hero
  const currentHeroMovie = moviesList[heroIndex] || moviesList[0] || {
    id: 1,
    title: 'DUNE: HÀNH TINH CÁT 2',
    genre: 'Khoa Học Viễn Tưởng, Hành Động',
    duration: 166,
    ageRating: 'T18',
    rating: '8.9',
    techFormat: 'IMAX Laser • Dolby Atmos',
    description: 'Hành trình huyền thoại của Paul Atreides khi anh liên kết cùng Chani và tộc người Fremen để trả thù những kẻ đã tàn sát gia tộc, đối mặt với sự lựa chọn khốc liệt giữa tình yêu và định mệnh vũ trụ.',
    poster: '/banner-dune.jpg',
  };
  const heroBadge = getAgeBadgeStyle(currentHeroMovie?.ageRating);

  // Phim kế tiếp hiển thị ở thẻ TIẾP THEO bên phải
  const nextHeroIndex = moviesList.length > 0 ? (heroIndex + 1) % moviesList.length : 0;
  const nextHeroMovie = moviesList[nextHeroIndex] || currentHeroMovie;

  // Phim hiện đang được chọn trong Thanh Đặt Vé Nhanh
  const activeMovie = moviesList.find((m) => String(m.id) === String(selectedMovieId)) || moviesList[0];
  const activeBadge = getAgeBadgeStyle(activeMovie?.ageRating);

  // Danh sách suất chiếu theo phim đang chọn
  const availableShowtimes = activeMovie?.showtimes && activeMovie.showtimes.length > 0
    ? activeMovie.showtimes
    : [
      { id: activeMovie?.firstShowtimeId || '6ae624fdb0ee30fb919c72d6', roomName: 'IMAX Laser (Phòng 1)', time: '19:30' },
      { id: '6ae624fdb0ee30fb919c7307', roomName: '2D Dolby Atmos (Phòng 2)', time: '21:45' },
    ];

  const handleQuickBooking = () => {
    const targetShowtimeId = selectedShowtimeId || activeMovie?.firstShowtimeId || availableShowtimes[0]?.id || '6ae624fdb0ee30fb919c72d6';
    navigate(`/booking/seat/${targetShowtimeId}`);
  };

  // Lọc phim theo các tabs
  const nowShowingMovies = moviesList.filter((m) => m.status === 'NOW_SHOWING' || !m.status);
  const comingSoonMovies = moviesList.filter((m) => m.status === 'COMING_SOON');
  const specialMovies = moviesList.filter(
    (m) => (Array.isArray(m.formats) && m.formats.some((f) => f.includes('IMAX'))) || m.ageRating === 'T18'
  );

  let displayedMovies = nowShowingMovies;
  if (activeTab === 'COMING_SOON') displayedMovies = comingSoonMovies;
  if (activeTab === 'SPECIAL') displayedMovies = specialMovies;

  return (
    <div className="bg-[#0c1017] text-slate-100 min-h-screen">
      {/* 1. HERO SECTION (CINEMATIC BILLBOARD BANNER WITH CAROUSEL) */}
      <section
        onMouseEnter={() => setIsHoveringHero(true)}
        onMouseLeave={() => setIsHoveringHero(false)}
        className="relative min-h-[500px] lg:h-[560px] flex items-end overflow-hidden group/hero select-none"
      >
        {/* Background Image với hiệu ứng chuyển cảnh mượt mà */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            key={currentHeroMovie?.id || heroIndex}
            src={getMovieBackdrop(currentHeroMovie)}
            alt={currentHeroMovie?.title || 'Banner'}
            className="w-full h-full object-cover object-center filter brightness-[0.82] contrast-[1.08] saturate-[1.05] transition-all duration-700 ease-in-out scale-100 group-hover/hero:scale-[1.02]"
            onError={(e) => {
              e.target.src = '/banner-dune.jpg';
            }}
          />
          {/* Lớp phủ chuyển màu Linear tinh chỉnh: Rõ nét hình ảnh nhân vật bên phải, êm dịu dễ đọc chữ bên trái */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c1017] via-[#0c1017]/30 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c1017]/95 via-[#0c1017]/40 via-40% to-transparent"></div>
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0c1017]/60 to-transparent"></div>
        </div>

        {/* Nút chuyển phim Trước (‹) và Sau (›) nổi ở hai bên cạnh */}
        <button
          type="button"
          onClick={handlePrevHero}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-blue-600/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all opacity-0 group-hover/hero:opacity-100 shadow-2xl cursor-pointer hover:scale-110 active:scale-95"
          title="Phim trước đó"
        >
          <span className="text-xl font-bold leading-none mb-0.5">‹</span>
        </button>
        <button
          type="button"
          onClick={handleNextHero}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-blue-600/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all opacity-0 group-hover/hero:opacity-100 shadow-2xl cursor-pointer hover:scale-110 active:scale-95"
          title="Phim tiếp theo"
        >
          <span className="text-xl font-bold leading-none mb-0.5">›</span>
        </button>

        {/* Hero Content - Rộng Rãi Căn Lề Ra Hai Bên */}
        <div className="relative z-10 max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 w-full pt-28 sm:pt-36 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            {/* Left Column (8 cols): Thông tin chi tiết phim đang chiếu trên Banner */}
            <div className="lg:col-span-8 space-y-4 animate-in fade-in duration-300">
              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-black tracking-wider uppercase border ${currentHeroMovie?.status === 'COMING_SOON'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-[#064e3b]/80 text-[#34d399] border-[#059669]/40'
                    }`}
                >
                  {currentHeroMovie?.status === 'COMING_SOON' ? 'SẮP KHỞI CHIẾU' : 'ĐANG CÔNG CHIẾU TOÀN CẦU'}
                </span>
                <span className="text-slate-300 font-medium text-[11px] px-1">
                  {currentHeroMovie?.techFormat || 'IMAX Laser • Dolby Atmos'}
                </span>
                <span className="bg-[#78350f]/80 text-[#fbbf24] border border-[#d97706]/40 px-2 py-0.5 rounded text-[11px] font-black flex items-center space-x-1">
                  <span>★</span>
                  <span>{currentHeroMovie?.rating || '4.9'} IMDb</span>
                </span>
              </div>

              {/* Big Title H1 */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                {currentHeroMovie?.title}
              </h1>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-200 font-medium drop-shadow-md">
                <span>{currentHeroMovie?.genre || 'Khoa Học Viễn Tưởng, Hành Động'}</span>
                <span>•</span>
                <span>{currentHeroMovie?.duration || 120} phút</span>
                <span>•</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${heroBadge.bg} ${heroBadge.text} ${heroBadge.border}`}
                >
                  {heroBadge.label}
                </span>
              </div>

              {/* Synopsis */}
              <p className="text-slate-200 text-xs sm:text-sm leading-relaxed max-w-xl font-normal line-clamp-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                {currentHeroMovie?.description ||
                  'Hành trình điện ảnh kịch tính và ngoạn mục đang chờ đón bạn thưởng thức tại hệ thống rạp D\'AVENOR CINEMA.'}
              </p>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {/* Đặt vé ngay */}
                <Link
                  to={`/booking/seat/${currentHeroMovie?.firstShowtimeId || '6ae624fdb0ee30fb919c72d6'}`}
                  className="bg-[#9bb4fb] hover:bg-[#86a1f8] text-[#0a1120] font-black px-5 py-2.5 rounded-lg text-xs flex items-center space-x-2 transition-all shadow-md hover:scale-105 active:scale-95"
                >
                  <span>🎟️</span>
                  <span>{currentHeroMovie?.status === 'COMING_SOON' ? 'Đặt trước vé ngay' : 'Đặt vé ngay'}</span>
                </Link>

                {/* Xem trailer */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTrailerMovie(currentHeroMovie);
                    setIsTrailerOpen(true);
                  }}
                  className="bg-[#1b2333]/90 hover:bg-[#28334a] text-white border border-slate-700 font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center space-x-2 transition-colors cursor-pointer active:scale-95"
                >
                  <span>▶</span>
                  <span>Xem trailer</span>
                </button>

                {/* Checkmark: Độc quyền phòng chiếu IMAX */}
                <span className="flex items-center space-x-1.5 text-xs text-[#f59e0b] font-medium ml-1">
                  <span className="w-3.5 h-3.5 rounded-full border border-amber-500/80 flex items-center justify-center text-[9px] font-black">
                    ✓
                  </span>
                  <span>Độc quyền phòng chiếu IMAX</span>
                </span>
              </div>
            </div>

            {/* Right Column: Floating Next Movie Card (4 cols) & Slide Dots */}
            <div className="hidden lg:flex lg:col-span-4 flex-col items-end justify-end space-y-3">
              {/* Slider Dots Indicator */}
              <div className="flex items-center space-x-1.5 pr-0.5">
                {moviesList.slice(0, 8).map((m, idx) => (
                  <button
                    key={m.id || idx}
                    type="button"
                    onClick={() => handleSelectHero(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${heroIndex === idx
                      ? 'w-7 bg-[#9bb4fb] shadow-sm shadow-blue-400/50'
                      : 'w-2 bg-slate-700 hover:bg-slate-500'
                      }`}
                    title={`Chuyển đến: ${m.title}`}
                  />
                ))}
              </div>

              {/* Floating Next Movie Card - Bấm để chuyển sang phim tiếp theo */}
              <div
                onClick={handleNextHero}
                className="bg-[#111726]/90 backdrop-blur-xl border border-slate-800 hover:border-blue-500/80 rounded-xl p-3 flex items-center space-x-3 w-80 shadow-2xl hover:scale-[1.02] transition-all cursor-pointer group active:scale-95"
                title="Bấm để chuyển sang phim tiếp theo"
              >
                <img
                  src={nextHeroMovie?.poster || nextHeroMovie?.posterUrl || '/banner-dune.jpg'}
                  alt={nextHeroMovie?.title || 'Phim tiếp theo'}
                  className="w-12 h-14 object-cover rounded-md shadow group-hover:scale-105 transition-transform shrink-0"
                  onError={(e) => {
                    e.target.src = '/banner-dune.jpg';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-black tracking-widest text-[#f59e0b] block">
                      TIẾP THEO
                    </span>
                    <span className="text-[10px] text-blue-400 font-bold">
                      {nextHeroIndex + 1}/{moviesList.length}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors truncate mt-0.5">
                    {nextHeroMovie?.title || 'Phim tiếp theo'}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {nextHeroMovie?.genre || 'Suất chiếu đặc biệt'}
                  </p>
                </div>
                <span className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all text-sm pr-1">
                  ›
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FLOATING QUICK BOOKING BAR (THANH ĐẶT VÉ NHANH) */}
      <section className="relative z-30 max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 mt-2 sm:mt-3">
        <div className="bg-[#101521] border border-slate-800/90 rounded-2xl p-4 shadow-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
            {/* 1. Chọn Phim (Custom Dropdown với đầy đủ phim, nhãn phân loại, poster) */}
            <div className="space-y-1 relative" ref={movieDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                  <span>🎬</span>
                  <span>Phim</span>
                </label>
                {/* Nhãn hướng dẫn click */}
                <button
                  type="button"
                  onClick={() => setIsMovieDropdownOpen(!isMovieDropdownOpen)}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-all flex items-center gap-1 cursor-pointer"
                  title="Nhấn để mở danh sách phim"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  <span>Click chọn phim ({moviesList.length})</span>
                </button>
              </div>

              {/* Trigger Button hiển thị phim đang chọn và nhãn độ tuổi */}
              <button
                type="button"
                onClick={() => setIsMovieDropdownOpen(!isMovieDropdownOpen)}
                className={`w-full bg-[#1b2232] hover:bg-[#232c40] border ${isMovieDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700/60'
                  } rounded-xl px-3 py-2 text-xs font-bold text-white transition-all text-left flex items-center justify-between gap-2 cursor-pointer group shadow-inner`}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${activeBadge.bg} ${activeBadge.text} ${activeBadge.border}`}
                  >
                    {activeMovie?.ageRating || 'T18'}
                  </span>
                  <span className="truncate text-slate-100 group-hover:text-blue-300 transition-colors">
                    {activeMovie?.title || 'Chọn phim'}
                  </span>
                </div>
                <span
                  className={`text-slate-400 text-[10px] transform transition-transform shrink-0 ${isMovieDropdownOpen ? 'rotate-180 text-blue-400' : ''
                    }`}
                >
                  ▼
                </span>
              </button>

              {/* Floating Dropdown Menu */}
              {isMovieDropdownOpen && (
                <div className="absolute left-0 bottom-full sm:bottom-auto sm:top-full mb-2 sm:mb-0 sm:mt-2 w-[330px] sm:w-[390px] bg-[#121826]/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl p-2.5 shadow-2xl z-50 animate-in fade-in duration-150">
                  {/* Dropdown Header */}
                  <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-amber-400 text-xs">🍿</span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                        Phim Đang Chiếu Rạp
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      {moviesList.length} phim sẵn sàng
                    </span>
                  </div>

                  {/* Danh sách phim với poster và nhãn chi tiết */}
                  <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                    {moviesList.map((m) => {
                      const isSelected = String(m.id) === String(selectedMovieId);
                      const badge = getAgeBadgeStyle(m.ageRating);
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMovieId(String(m.id));
                            if (m.showtimes && m.showtimes.length > 0) {
                              setSelectedShowtimeId(String(m.showtimes[0].id));
                            }
                            setIsMovieDropdownOpen(false);
                          }}
                          className={`flex items-center space-x-3 p-2 rounded-xl cursor-pointer transition-all border ${isSelected
                            ? 'bg-blue-600/20 border-blue-500/80 shadow-md shadow-blue-500/10'
                            : 'bg-[#182133]/60 hover:bg-[#202b42] border-transparent hover:border-slate-700'
                            }`}
                        >
                          {/* Poster */}
                          <img
                            src={m.poster}
                            alt={m.title}
                            className="w-11 h-14 object-cover rounded-lg shrink-0 shadow-md border border-slate-700/50"
                            onError={(e) => {
                              e.target.src = '/banner-dune.jpg';
                            }}
                          />

                          {/* Thông tin phim */}
                          <div className="flex-1 min-w-0">
                            {/* Hàng nhãn phân loại */}
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
                                title={m.ageDescription}
                              >
                                {m.ageRating}
                              </span>
                              <span className="text-[10px] text-amber-400 font-bold flex items-center">
                                ★ {m.rating}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                • {m.duration} phút
                              </span>
                            </div>

                            {/* Tên phim */}
                            <h5
                              className={`text-xs font-bold truncate ${isSelected ? 'text-blue-300' : 'text-slate-100'
                                }`}
                            >
                              {m.title}
                            </h5>

                            {/* Nhãn định dạng công nghệ */}
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {(Array.isArray(m.formats) ? m.formats : [m.formats || '2D']).map((fmt, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] font-medium bg-slate-800/90 text-slate-300 px-1.5 py-0.2 rounded border border-slate-700/50"
                                >
                                  {fmt}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Dấu tích chọn */}
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow">
                              ✓
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Chọn Rạp */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                <span className="text-amber-500">📍</span>
                <span>Rạp chiếu</span>
              </label>
              <div className="relative">
                <select
                  value={selectedTheater}
                  onChange={(e) => setSelectedTheater(e.target.value)}
                  className="w-full bg-[#1b2232] border border-slate-700/60 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-7"
                >
                  {cinemas.length > 0 ? (
                    cinemas.map((c) => (
                      <option key={c.id || c._id} value={c.name}>
                        {c.name}
                      </option>
                    ))
                  ) : (
                    <option value="D'AVENOR Landmark 81">D'AVENOR Landmark 81</option>
                  )}
                </select>
                <span className="absolute right-3 top-2.5 text-slate-500 text-[10px] pointer-events-none">⌵</span>
              </div>
            </div>

            {/* 3. Chọn Ngày */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                <span className="text-emerald-500">📅</span>
                <span>Ngày chiếu</span>
              </label>
              <div className="relative">
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-[#1b2232] border border-slate-700/60 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-7"
                >
                  <option value="Hôm nay">
                    Hôm nay ({new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })})
                  </option>
                  <option value="Ngày mai">
                    Ngày mai ({new Date(Date.now() + 86400000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })})
                  </option>
                  <option value="Ngày kia">
                    Ngày kia ({new Date(Date.now() + 172800000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })})
                  </option>
                </select>
                <span className="absolute right-3 top-2.5 text-slate-500 text-[10px] pointer-events-none">⌵</span>
              </div>
            </div>

            {/* 4. Chọn Suất Chiếu */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                <span className="text-cyan-400">🕒</span>
                <span>Suất chiếu</span>
              </label>
              <div className="relative">
                <select
                  value={selectedShowtimeId}
                  onChange={(e) => setSelectedShowtimeId(e.target.value)}
                  className="w-full bg-[#1b2232] border border-slate-700/60 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-7"
                >
                  {availableShowtimes.map((st) => (
                    <option key={st.id || st._id} value={st.id || st._id}>
                      {st.time || (st.startTime ? new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '19:30')} • {st.roomName || 'IMAX Laser'}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-2.5 text-slate-500 text-[10px] pointer-events-none">⌵</span>
              </div>
            </div>

            {/* 5. Nút Mua Vé Nhanh */}
            <div>
              <button
                type="button"
                onClick={handleQuickBooking}
                className="w-full bg-[#9bb4fb] hover:bg-[#86a1f8] text-[#0a1120] font-black py-2 rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>⚡</span>
                <span>Mua vé nhanh</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PHẦN PHIM TẠI RẠP (KHÁM PHÁ ĐIỆN ẢNH) */}
      <section className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 pt-16 pb-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center space-x-2 text-[11px] font-bold text-red-500 uppercase tracking-widest mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              <span>KHÁM PHÁ ĐIỆN ẢNH</span>
            </div>
            <h2 className="text-3xl font-black text-white">Phim Tại Rạp</h2>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('NOW_SHOWING')}
              className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${activeTab === 'NOW_SHOWING'
                ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30'
                : 'bg-[#131926] text-slate-400 hover:text-white border border-slate-800'
                }`}
            >
              Đang chiếu ({nowShowingMovies.length})
            </button>
            <button
              onClick={() => setActiveTab('COMING_SOON')}
              className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${activeTab === 'COMING_SOON'
                ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30'
                : 'bg-[#131926] text-slate-400 hover:text-white border border-slate-800'
                }`}
            >
              Sắp chiếu ({comingSoonMovies.length})
            </button>
            <button
              onClick={() => setActiveTab('SPECIAL')}
              className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${activeTab === 'SPECIAL'
                ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30'
                : 'bg-[#131926] text-slate-400 hover:text-white border border-slate-800'
                }`}
            >
              Suất đặc biệt ({specialMovies.length})
            </button>
            <button
              onClick={() => {
                const chatBtn = document.querySelector('button[title="Trò chuyện với AI"]');
                if (chatBtn) chatBtn.click();
              }}
              className="px-4 py-1.5 rounded-full bg-[#131926] border border-slate-800 text-slate-300 hover:text-white hover:border-blue-500 transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <span className="text-blue-400">🤖</span>
              <span>Trợ lý AI</span>
            </button>
          </div>
        </div>

        {/* Danh sách thẻ phim */}
        {displayedMovies.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-[#101521] rounded-2xl border border-slate-800">
            <p className="text-base font-semibold">Chưa có phim trong danh mục này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayedMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}

        {/* Nút Xem tất cả phim */}
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => setActiveTab('NOW_SHOWING')}
            className="px-6 py-2 rounded-full bg-[#131926] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-800 transition-colors inline-flex items-center space-x-2 cursor-pointer"
          >
            <span>Tổng cộng {moviesList.length} bộ phim rạp chọn lọc</span>
            <span>→</span>
          </button>
        </div>
      </section>

      {/* 4. TRẢI NGHIỆM ĐIỆN ẢNH ĐỈNH CAO (CÔNG NGHỆ HÀNG ĐẦU) */}
      <section className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 py-16 border-t border-slate-900">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest block mb-1">
              CÔNG NGHỆ HÀNG ĐẦU
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Trải Nghiệm Điện Ảnh Đỉnh Cao
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-md">
            D'AVENOR CINEMA trang bị hệ thống phòng chiếu hiện đại tiêu chuẩn Hollywood, mang lại cảm xúc thị giác và thính giác siêu thực.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: IMAX */}
          <div className="bg-gradient-to-b from-[#222f44]/90 to-[#172233]/90 backdrop-blur-xl border border-slate-600/60 rounded-2xl p-6 space-y-4 hover:border-blue-400/70 hover:from-[#283850]/95 hover:to-[#1b283b]/95 transition-all shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black tracking-wider text-white">IMAX®</span>
              <span className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-400/40 flex items-center justify-center text-blue-400 text-sm font-bold shadow-sm">
                🖥️
              </span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Laser Siêu Nét 4K</h4>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Màn hình cong vĩ đại trải dài tầm nhìn ngoại vi cùng hệ thống máy chiếu Laser thế hệ mới nhất cho độ tương phản ngoạn mục.
              </p>
            </div>
            <a href="#theaters" className="inline-block text-xs text-blue-400 hover:text-blue-300 font-bold pt-1">
              Tìm cụm rạp IMAX ›
            </a>
          </div>

          {/* Card 2: ATMOS */}
          <div className="bg-gradient-to-b from-[#222f44]/90 to-[#172233]/90 backdrop-blur-xl border border-slate-600/60 rounded-2xl p-6 space-y-4 hover:border-emerald-400/70 hover:from-[#283850]/95 hover:to-[#1b283b]/95 transition-all shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black tracking-wider text-emerald-400">ATMOS</span>
              <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 text-sm font-bold shadow-sm">
                🔊
              </span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Âm Thanh Đa Chiều 360°</h4>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Hơn 64 loa độc lập bao phủ toàn bộ phòng chiếu, dẫn truyền từng tiếng thở và tiếng động cơ lướt chân thực xung quanh bạn.
              </p>
            </div>
            <a href="#theaters" className="inline-block text-xs text-emerald-400 hover:text-emerald-300 font-bold pt-1">
              Khám phá Dolby Atmos ›
            </a>
          </div>

          {/* Card 3: GOLD CLASS */}
          <div className="bg-gradient-to-b from-[#222f44]/90 to-[#172233]/90 backdrop-blur-xl border border-slate-600/60 rounded-2xl p-6 space-y-4 hover:border-amber-400/70 hover:from-[#283850]/95 hover:to-[#1b283b]/95 transition-all shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black tracking-wider text-amber-400">GOLD CLASS</span>
              <span className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 text-sm font-bold shadow-sm">
                ★
              </span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Ghế Da Recliner & Đồ Ăn VIP</h4>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Ghế sofa điều chỉnh điện ngả 180 độ, phục vụ ẩm thực cao cấp tận ghế và phòng chờ đón khách thương gia đẳng cấp.
              </p>
            </div>
            <a href="#theaters" className="inline-block text-xs text-amber-400 hover:text-amber-300 font-bold pt-1">
              Dịch vụ VIP Lounge ›
            </a>
          </div>
        </div>
      </section>

      {/* 5. PROMOTION BANNER (HỘI VIÊN D'AVENOR CLUB) */}
      <section id="promotions" className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 py-6">
        <div className="bg-gradient-to-b from-[#222f44]/90 to-[#172233]/90 backdrop-blur-xl border border-slate-600/60 rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-amber-500/15 text-amber-400 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border border-amber-500/40 shadow-sm">
              🎟️
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                ĐẶC QUYỀN HỘI VIÊN D'AVENOR CLUB
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Tặng ngay 01 vé xem phim 2D & Bắp nước miễn phí
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Đăng ký thành viên mới hôm nay. Tích lũy 10% điểm thưởng cho mỗi giao dịch mua vé trực tuyến.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="w-full sm:w-auto flex-shrink-0 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black px-7 py-3 rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/25 hover:scale-105"
          >
            Đăng ký miễn phí
          </button>
        </div>
      </section>

      {/* 6. ĐỐI TÁC THANH TOÁN BẢO MẬT */}
      <section className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 py-8 border-t border-slate-900">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2.5">
            {/* Logo khiên xanh có dấu tích chuẩn mockup */}
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
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
              ĐỐI TÁC THANH TOÁN BẢO MẬT
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 font-semibold text-slate-400 text-xs">
            <span className="hover:text-white transition-colors cursor-pointer">MoMo</span>
            <span className="hover:text-white transition-colors cursor-pointer">ZaloPay</span>
            <span className="hover:text-white transition-colors cursor-pointer">VNPay</span>
            <span className="hover:text-white transition-colors cursor-pointer">Apple Pay</span>
            <span className="hover:text-white transition-colors cursor-pointer">VISA / Mastercard</span>
          </div>
        </div>
      </section>

      {/* Trailer Modal (phát trailer theo đúng phim đang chọn trên Banner) */}
      {isTrailerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full p-4 relative shadow-2xl">
            <button
              onClick={() => {
                setIsTrailerOpen(false);
                setActiveTrailerMovie(null);
              }}
              className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold flex items-center justify-center transition-colors shadow-lg cursor-pointer"
              title="Đóng trailer"
            >
              ✕
            </button>
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner">
              <iframe
                src={getEmbedTrailerUrl((activeTrailerMovie || currentHeroMovie)?.trailerUrl)}
                title={`${(activeTrailerMovie || currentHeroMovie)?.title || 'Phim'} Official Trailer`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <div className="mt-3 px-1 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white text-sm">{(activeTrailerMovie || currentHeroMovie)?.title}</span>
                <p className="text-slate-400 text-[11px] mt-0.5">{(activeTrailerMovie || currentHeroMovie)?.genre} • {(activeTrailerMovie || currentHeroMovie)?.duration} phút</p>
              </div>
              <Link
                to={`/booking/seat/${(activeTrailerMovie || currentHeroMovie)?.firstShowtimeId || '6ae624fdb0ee30fb919c72d6'}`}
                onClick={() => {
                  setIsTrailerOpen(false);
                  setActiveTrailerMovie(null);
                }}
                className="bg-[#2563eb] hover:bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 shadow"
              >
                <span>🎟️</span>
                <span>Đặt vé ngay</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
