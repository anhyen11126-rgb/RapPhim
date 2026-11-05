import React from 'react';

// Hàm chuyển đổi link YouTube sang link iframe embed tự động phát
export const getEmbedTrailerUrl = (url) => {
  if (!url) return 'https://www.youtube.com/embed/Way9Dexny3w?autoplay=1';
  if (url.includes('embed')) return url.includes('autoplay') ? url : `${url}?autoplay=1`;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
  }
  return url;
};

const MovieHeroTrailer = ({
  movie,
  isTrailerModalOpen,
  onOpenTrailer,
  onCloseTrailer,
  onScrollToBooking,
}) => {
  if (!movie) return null;

  return (
    <>
      {/* 1. HERO TRAILER SECTION (THEATRICAL AMBIENT BANNER) */}
      <section className="relative min-h-[460px] lg:h-[540px] flex items-center justify-center overflow-hidden group">
        {/* Ambient Backdrop Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={movie.bannerUrl || movie.posterUrl || '/banner-dune.jpg'}
            alt={movie.title}
            className="w-full h-full object-cover object-center brightness-[0.72] contrast-[1.08] saturate-[1.1] scale-100 group-hover:scale-[1.02] transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-[#090d16]/50 to-[#090d16]/30"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#090d16]/90 via-[#090d16]/30 via-40% to-[#090d16]/80"></div>
        </div>

        {/* Center Play Trailer Action Callout */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center flex flex-col items-center space-y-4 pt-16">
          {/* Badge Quality */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-amber-500/40 text-[#f59e0b] text-[10px] sm:text-xs font-black tracking-wider uppercase shadow-lg">
            <span>● {movie.trailerQualityBadge || 'OFFICIAL IMAX LASER TRAILER • 4K UHD • Dolby Atmos'}</span>
          </div>

          {/* Big Glowing Circular Play Button */}
          <button
            type="button"
            onClick={onOpenTrailer}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#3b82f6]/90 hover:bg-blue-500 text-white flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.6)] hover:shadow-[0_0_70px_rgba(59,130,246,0.9)] hover:scale-110 active:scale-95 transition-all cursor-pointer group/btn my-1"
            title="Nhấn để xem Trailer chính thức"
          >
            <span className="text-3xl sm:text-4xl ml-1 group-hover/btn:scale-110 transition-transform">▶</span>
          </button>

          {/* Tagline & Sub-duration */}
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-2xl font-black text-white drop-shadow-lg tracking-tight">
              {movie.trailerTagline || `Khám phá trọn vẹn Trailer: ${movie.title}`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium drop-shadow max-w-xl mx-auto">
              {movie.trailerDuration || 'Thời lượng: 3 phút 45 giây • Độc quyền video chất lượng cao tại hệ thống MovieTix trên toàn quốc'}
            </p>
          </div>
        </div>
      </section>

      {/* 2. MODAL XEM TRAILER POPUP ĐỈNH CAO */}
      {isTrailerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full p-4 relative shadow-2xl">
            <button
              onClick={onCloseTrailer}
              className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold flex items-center justify-center transition-colors shadow-lg cursor-pointer"
              title="Đóng trailer"
            >
              ✕
            </button>
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner">
              <iframe
                src={getEmbedTrailerUrl(movie.trailerUrl)}
                title={`${movie.title} Official Trailer`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <div className="mt-3 px-1 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white text-sm">{movie.title}</span>
                <p className="text-slate-400 text-[11px] mt-0.5">{movie.genre} • {movie.duration} phút</p>
              </div>
              <button
                onClick={() => {
                  onCloseTrailer();
                  if (onScrollToBooking) onScrollToBooking();
                }}
                className="bg-[#2563eb] hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-1 shadow cursor-pointer"
              >
                <span>🎟️</span>
                <span>Đặt vé ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MovieHeroTrailer;

