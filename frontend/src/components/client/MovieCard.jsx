import React from 'react';
import { Link } from 'react-router-dom';

const MovieCard = ({ movie }) => {
  const movieDetailPath = `/movie/${movie?.id || movie?._id || movie?.slug}`;

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-300 flex flex-col group">
      {/* Poster & Top Badges - Bấm trực tiếp vào ảnh Poster để xem chi tiết phim */}
      <Link
        to={movieDetailPath}
        className="block relative aspect-[2/3] overflow-hidden bg-slate-800 cursor-pointer"
        title={`Xem chi tiết phim: ${movie?.title}`}
      >
        <img
          src={movie?.poster || movie?.posterUrl || 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg'}
          alt={movie?.title || 'Phim'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex items-center space-x-1.5">
          <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow">
            {movie?.ageRating || 'T16'}
          </span>
          <span className="bg-slate-900/80 backdrop-blur-md text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10 shadow">
            {movie?.techFormat || 'IMAX'}
          </span>
        </div>

        {/* Rating Badge */}
        <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center space-x-1 shadow">
          <span className="text-amber-400 text-xs">⭐</span>
          <span className="text-white text-xs font-bold">{movie?.rating || '4.8'}</span>
        </div>
      </Link>

      {/* Info Body */}
      <div className="p-4 flex flex-col flex-1 justify-between space-y-3">
        <div className="space-y-1.5">
          {/* Format & Duration */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center space-x-1">
              <span>🕒</span>
              <span>{movie?.duration || 120} phút</span>
            </span>
            <span className="text-slate-300 font-semibold">{movie?.formats || '2D • 3D • IMAX'}</span>
          </div>

          <p className="text-[11px] text-slate-500 line-clamp-1">{movie?.genre || 'Hành động'}</p>

          <Link to={movieDetailPath} className="block group-hover:text-blue-400 transition-colors">
            <h3 className="text-white font-bold text-base line-clamp-1 hover:text-blue-400 transition-colors">
              {movie?.title}
            </h3>
          </Link>

          <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
            {movie?.description || 'Hành trình điện ảnh kịch tính và hấp dẫn trên màn ảnh rộng.'}
          </p>
        </div>

        {/* Nút Đặt vé toàn chiều rộng (Đã gỡ bỏ nút dấu chấm than) */}
        <div className="pt-2">
          <Link
            to={movie?.firstShowtimeId ? `/booking/seat/${movie.firstShowtimeId}` : movieDetailPath}
            className="w-full bg-[#1b2234] hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 border border-slate-700/80 hover:border-blue-500 shadow-md hover:shadow-blue-500/20 active:scale-[0.98]"
          >
            <span>🎟️</span>
            <span>{movie?.status === 'COMING_SOON' ? 'Đặt trước vé' : 'Đặt vé ngay'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
