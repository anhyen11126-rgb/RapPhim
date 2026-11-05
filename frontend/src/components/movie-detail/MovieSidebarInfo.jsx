import React from 'react';

const MovieSidebarInfo = ({ movie, ageBadge, onScrollToBooking }) => {
  if (!movie) return null;

  return (
    <div className="lg:col-span-4 space-y-5">
      {/* Poster Card */}
      <div className="bg-[#101625] border border-slate-800 rounded-3xl p-3 shadow-2xl overflow-hidden group/poster">
        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-slate-900 shadow-inner">
          <img
            src={movie.posterUrl || movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover group-hover/poster:scale-105 transition-transform duration-700"
          />

          {/* Badge Top Trái Phân Loại Tuổi */}
          <div className="absolute top-3 left-3 flex items-center space-x-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wide border shadow-md ${ageBadge.bg} ${ageBadge.text} ${ageBadge.border}`}
            >
              {movie.ageRating || 'T18'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-950/80 backdrop-blur-md text-blue-400 border border-blue-500/40 shadow">
              IMAX 4K
            </span>
          </div>
        </div>

        {/* Dưới poster: Tên phim thu nhỏ & Nút Đặt vé nhanh */}
        <div className="p-3 text-center space-y-2.5">
          <div>
            <h3 className="text-sm font-bold text-white line-clamp-1">{movie.title}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {movie.duration} phút • {movie.genre?.split(',')[0]}
            </p>
          </div>
          <button
            type="button"
            onClick={onScrollToBooking}
            className="w-full bg-[#2563eb] hover:bg-blue-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-600/30 active:scale-95 cursor-pointer"
          >
            <span>🎟️</span>
            <span>Đặt vé nhanh</span>
          </button>
        </div>
      </div>

      {/* HỘP BẢNG THÔNG SỐ ĐIỆN ẢNH CHUYÊN SÂU */}
      <div className="bg-[#101625] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-base text-blue-400">ℹ️</span>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Thông số điện ảnh</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {movie.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đang chiếu'}
          </span>
        </div>

        {/* Danh sách thông số */}
        <div className="space-y-4 text-xs">
          {/* Đạo diễn */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ĐẠO DIỄN</span>
            <p className="text-slate-100 font-bold mt-0.5">{movie.director || 'Đang cập nhật'}</p>
          </div>

          {/* Diễn viên chính */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DIỄN VIÊN CHÍNH</span>
            <p className="text-slate-200 font-medium leading-relaxed mt-0.5">
              {Array.isArray(movie.cast) && movie.cast.length > 0
                ? movie.cast.map((c) => c.name).join(', ')
                : 'Đang cập nhật danh sách diễn viên'}
            </p>
          </div>

          {/* Thể loại */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">THỂ LOẠI</span>
            <p className="text-slate-200 font-medium mt-0.5">{movie.genre}</p>
          </div>

          {/* Khởi chiếu toàn quốc */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">KHỞI CHIẾU TOÀN QUỐC</span>
            <p className="text-slate-200 font-medium mt-0.5">
              {new Date(movie.releaseDate || Date.now()).toLocaleDateString('vi-VN')} (Toàn quốc)
            </p>
          </div>

          {/* Ngôn ngữ & Định dạng */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">NGÔN NGỮ & ĐỊNH DẠNG</span>
            <p className="text-slate-200 font-medium mt-0.5">{movie.language || 'Tiếng Anh - Phụ đề tiếng Việt chuẩn'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{movie.audioTech || 'Âm thanh 8 kênh & Dolby Atmos 64'}</p>
          </div>

          {/* Thời lượng tác phẩm */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">THỜI LƯỢNG TÁC PHẨM</span>
            <p className="text-slate-200 font-medium flex items-center space-x-1.5 mt-0.5">
              <span>🕒</span>
              <span>
                {movie.duration} phút ({Math.floor(movie.duration / 60)} giờ {movie.duration % 60} phút)
              </span>
            </p>
          </div>
        </div>

        {/* Callout tiêu chuẩn phòng chiếu */}
        <div className="bg-[#151d30] border border-blue-500/20 rounded-2xl p-3 flex items-center space-x-3">
          <span className="text-2xl text-blue-400">🔊</span>
          <div>
            <h4 className="text-[11px] font-black text-white">Đạt chuẩn Dolby Atmos & Laser</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Âm trường 64 kênh không gian đa chiều sống động</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieSidebarInfo;

