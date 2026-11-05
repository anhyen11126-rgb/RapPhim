import React from 'react';

const MovieOverviewHighlights = ({ movie, ageBadge, isFavorite, onToggleFavorite }) => {
  if (!movie) return null;

  return (
    <div className="space-y-8">
      {/* Header thông tin phim */}
      <div className="space-y-3">
        {/* Badges Phân Loại & Lời khuyên */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider border uppercase shadow-sm ${ageBadge.bg} ${ageBadge.text} ${ageBadge.border}`}
          >
            {ageBadge.label}
          </span>
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {movie.contentAdvisory || 'Khuyên xem: Cảnh hành động mãn nhãn'}
          </span>
        </div>

        {/* Tiêu đề H1 lớn */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase leading-tight drop-shadow-md">
          {movie.title}
        </h1>

        {/* Subtitle / Tên tiếng Anh & Đạo diễn */}
        <p className="text-sm sm:text-base text-slate-400 font-medium italic">
          {movie.subTitle || `${movie.title} – Đạo diễn ${movie.director || 'Chuyên nghiệp'}`}
        </p>

        {/* Hàng Điểm Đánh Giá & Các Nút Hành Động */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-b border-slate-800/80 pb-5">
          <div className="flex flex-wrap items-center gap-6">
            {/* Rating MovieTix */}
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black text-[#fbbf24]">★ {movie.rating || 4.9}</span>
              <span className="text-xs text-slate-400 font-medium">
                / 5.0
                <br />
                <span className="text-[10px] text-slate-500">{movie.ratingCount || '12.4k lượt đánh giá năm nay'}</span>
              </span>
            </div>

            {/* Rotten Tomatoes */}
            <div className="flex items-center space-x-2 border-l border-slate-800 pl-6">
              <span className="text-2xl">🍅</span>
              <div>
                <span className="text-base font-black text-white">{movie.rottenTomatoes || '94%'}</span>
                <span className="text-xs text-slate-400 ml-1">Rotten Tomatoes</span>
                <p className="text-[10px] text-slate-500">
                  {movie.rottenTomatoesLabel || 'Chứng nhận cà chua tươi (Certified Fresh)'}
                </p>
              </div>
            </div>
          </div>

          {/* Các nút: Yêu thích & Trợ lý AI */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onToggleFavorite}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                isFavorite
                  ? 'bg-red-500/20 text-red-400 border-red-500/50'
                  : 'bg-[#151c2d] hover:bg-slate-800 text-slate-300 border-slate-700/80'
              }`}
            >
              <span>{isFavorite ? '❤️' : '♡'}</span>
              <span>{isFavorite ? 'Đã yêu thích' : 'Yêu thích'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                // Trigger mở chatbot trực tuyến
                const chatBtn =
                  document.querySelector('[title="Trợ lý ảo MovieTix"]') ||
                  document.querySelector('button[title*="Chat"]');
                if (chatBtn) chatBtn.click();
              }}
              className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 flex items-center space-x-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <span>🤖</span>
              <span>Trợ lý AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* KHỐI TÓM TẮT NỘI DUNG */}
      <div className="bg-[#101625] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div>
          <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider border-l-4 border-blue-500 pl-3">
            Tóm tắt nội dung
          </h3>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-3 font-normal">
            {movie.description || 'Hành trình điện ảnh đỉnh cao và đầy cảm xúc đang chờ đón bạn khám phá.'}
          </p>
        </div>

        {/* 3 Thẻ Điểm Nổi Bật Đặc Sắc (Highlights) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          {Array.isArray(movie.highlights) && movie.highlights.length > 0 ? (
            movie.highlights.map((h, idx) => (
              <div key={idx} className="bg-[#141b2c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
                <span className="text-2xl shrink-0">{h.icon || '✨'}</span>
                <div>
                  <h4 className="text-xs font-black text-white leading-snug">{h.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">{h.desc}</p>
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="bg-[#141b2c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
                <span className="text-2xl shrink-0">🎦</span>
                <div>
                  <h4 className="text-xs font-black text-white leading-snug">Khung hình mở rộng 1.43:1</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">Thêm 26% khung hình độc quyền rạp IMAX</p>
                </div>
              </div>
              <div className="bg-[#141b2c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
                <span className="text-2xl shrink-0">🎼</span>
                <div>
                  <h4 className="text-xs font-black text-white leading-snug">Âm thanh Dolby Atmos</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">Âm nhạc hòa âm không gian đỉnh cao</p>
                </div>
              </div>
              <div className="bg-[#141b2c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
                <span className="text-2xl shrink-0">🏜️</span>
                <div>
                  <h4 className="text-xs font-black text-white leading-snug">Kỹ xảo điện ảnh đỉnh cao</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">Ghi hình trên bối cảnh thực địa ngoạn mục</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieOverviewHighlights;

