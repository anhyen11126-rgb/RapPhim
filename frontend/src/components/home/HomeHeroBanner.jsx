import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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

const getMovieBackdrop = (m) => {
  if (!m) return '/banner-dune.jpg';
  if (m.bannerUrl) return m.bannerUrl;
  if (m.backdrop) return m.backdrop;
  return m.posterUrl || m.poster || '/banner-dune.jpg';
};

const HomeHeroBanner = ({
  moviesList,
  heroIndex,
  onPrevHero,
  onNextHero,
  onSelectHero,
  setIsHoveringHero,
}) => {
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [activeTrailerMovie, setActiveTrailerMovie] = useState(null);

  const currentHeroMovie = moviesList[heroIndex] || moviesList[0] || {
    id: 1,
    title: 'DUNE: HÀNH TINH CÁT 2',
    genre: 'Khoa Học Viễn Tưởng, Hành Động',
    duration: 166,
    ageRating: 'T18',
    rating: '8.9',
    techFormat: 'IMAX Laser • Dolby Atmos',
    description:
      'Hành trình huyền thoại của Paul Atreides khi anh liên kết cùng Chani và tộc người Fremen để trả thù những kẻ đã tàn sát gia tộc, đối mặt với sự lựa chọn khốc liệt giữa tình yêu và định mệnh vũ trụ.',
    poster: '/banner-dune.jpg',
  };
  const heroBadge = getAgeBadgeStyle(currentHeroMovie?.ageRating);

  const nextHeroIndex = moviesList.length > 0 ? (heroIndex + 1) % moviesList.length : 0;
  const nextHeroMovie = moviesList[nextHeroIndex] || currentHeroMovie;

  return (
    <>
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c1017] via-[#0c1017]/30 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c1017]/95 via-[#0c1017]/40 via-40% to-transparent"></div>
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0c1017]/60 to-transparent"></div>
        </div>

        {/* Nút chuyển phim Trước (‹) và Sau (›) */}
        <button
          type="button"
          onClick={onPrevHero}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-blue-600/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all opacity-0 group-hover/hero:opacity-100 shadow-2xl cursor-pointer hover:scale-110 active:scale-95"
          title="Phim trước đó"
        >
          <span className="text-xl font-bold leading-none mb-0.5">‹</span>
        </button>
        <button
          type="button"
          onClick={onNextHero}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-blue-600/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all opacity-0 group-hover/hero:opacity-100 shadow-2xl cursor-pointer hover:scale-110 active:scale-95"
          title="Phim tiếp theo"
        >
          <span className="text-xl font-bold leading-none mb-0.5">›</span>
        </button>

        {/* Hero Content */}
        <div className="relative z-10 max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 w-full pt-28 sm:pt-36 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            {/* Cột trái: Thông tin chi tiết phim */}
            <div className="lg:col-span-8 space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-black tracking-wider uppercase border ${
                    currentHeroMovie?.status === 'COMING_SOON'
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

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                {currentHeroMovie?.title}
              </h1>

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

              <p className="text-slate-200 text-xs sm:text-sm leading-relaxed max-w-xl font-normal line-clamp-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                {currentHeroMovie?.description ||
                  "Hành trình điện ảnh kịch tính và ngoạn mục đang chờ đón bạn thưởng thức tại hệ thống rạp D'AVENOR CINEMA."}
              </p>

              {/* Hàng nút bấm */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={`/booking/seat/${currentHeroMovie?.firstShowtimeId || '6ae624fdb0ee30fb919c72d6'}`}
                  className="bg-[#9bb4fb] hover:bg-[#86a1f8] text-[#0a1120] font-black px-5 py-2.5 rounded-lg text-xs flex items-center space-x-2 transition-all shadow-md hover:scale-105 active:scale-95"
                >
                  <span>🎟️</span>
                  <span>
                    {currentHeroMovie?.status === 'COMING_SOON' ? 'Đặt trước vé ngay' : 'Đặt vé ngay'}
                  </span>
                </Link>

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

                <span className="flex items-center space-x-1.5 text-xs text-[#f59e0b] font-medium ml-1">
                  <span className="w-3.5 h-3.5 rounded-full border border-amber-500/80 flex items-center justify-center text-[9px] font-black">
                    ✓
                  </span>
                  <span>Độc quyền phòng chiếu IMAX</span>
                </span>
              </div>
            </div>

            {/* Cột phải: Floating Next Movie Card & Slide Dots */}
            <div className="hidden lg:flex lg:col-span-4 flex-col items-end justify-end space-y-3">
              {/* Slider Dots */}
              <div className="flex items-center space-x-1.5 pr-0.5">
                {moviesList.slice(0, 8).map((m, idx) => (
                  <button
                    key={m.id || idx}
                    type="button"
                    onClick={() => onSelectHero(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      heroIndex === idx
                        ? 'w-7 bg-[#9bb4fb] shadow-sm shadow-blue-400/50'
                        : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                    title={`Chuyển đến: ${m.title}`}
                  />
                ))}
              </div>

              {/* Floating Next Movie Card */}
              <div
                onClick={onNextHero}
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

      {/* Trailer Modal */}
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
                <span className="font-bold text-white text-sm">
                  {(activeTrailerMovie || currentHeroMovie)?.title}
                </span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {(activeTrailerMovie || currentHeroMovie)?.genre} •{' '}
                  {(activeTrailerMovie || currentHeroMovie)?.duration} phút
                </p>
              </div>
              <Link
                to={`/booking/seat/${
                  (activeTrailerMovie || currentHeroMovie)?.firstShowtimeId || '6ae624fdb0ee30fb919c72d6'
                }`}
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
    </>
  );
};

export default HomeHeroBanner;

