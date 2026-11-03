import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';

const MovieDetailPage = () => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovieDetail();
  }, [id]);

  const fetchMovieDetail = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/movies/${id}`);
      setMovie(res.data);
    } catch (error) {
      console.error('Lỗi khi tải chi tiết phim:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent mb-2"></div>
        <p>Đang tải thông tin phim...</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="py-24 text-center text-slate-400">
        <p className="text-xl">Không tìm thấy thông tin bộ phim này.</p>
        <Link to="/" className="text-red-500 underline mt-4 inline-block">Quay lại Trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white">
      {/* Cinematic Ambient Backdrop */}
      {movie.bannerUrl && (
        <div className="absolute top-0 left-0 w-full h-[450px] overflow-hidden -z-10 select-none pointer-events-none opacity-25">
          <img
            src={movie.bannerUrl}
            alt=""
            className="w-full h-full object-cover filter blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/80 to-[#0B0F19]" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Thông tin phim */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="aspect-[2/3] bg-slate-800 rounded-xl overflow-hidden shadow-2xl max-w-sm mx-auto md:max-w-none w-full border border-white/10">
            <img
              src={movie.posterUrl || movie.poster || 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg'}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
          </div>
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center space-x-3">
            <span className="bg-red-600 text-xs uppercase px-2.5 py-1 rounded font-bold">
              {movie.ageRating}
            </span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-700">
              {movie.status === 'NOW_SHOWING' ? 'Đang chiếu' : 'Sắp chiếu'}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white">{movie.title}</h1>
          <p className="text-slate-400 text-sm">
            Thể loại: <span className="text-slate-200">{movie.genre}</span> • Thời lượng: <span className="text-slate-200">{movie.duration} phút</span>
          </p>

          <div className="pt-2">
            <h3 className="text-lg font-bold text-slate-200 mb-1">Tóm tắt nội dung:</h3>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              {movie.description || 'Chưa có thông tin tóm tắt.'}
            </p>
          </div>

          {movie.trailerUrl && (
            <div className="pt-2">
              <a
                href={movie.trailerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg border border-slate-700 text-sm font-medium transition-colors"
              >
                <span>▶ Xem Trailer YouTube</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Lịch chiếu thực tế từ Database */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold mb-6 text-red-500 flex items-center space-x-2">
          <span>🕒 Lịch Chiếu & Suất Chiếu Hôm Nay</span>
        </h2>

        {!movie.showtimes || movie.showtimes.length === 0 ? (
          <p className="text-slate-400 italic">Hiện tại chưa có suất chiếu nào được mở cho bộ phim này.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {movie.showtimes.map((st) => {
              const timeString = new Date(st.startTime).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={st.id}
                  className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-col justify-between hover:border-red-500/50 transition-all"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block">{st.roomName}</span>
                    <span className="text-2xl font-black text-white mt-1 block">{timeString}</span>
                    <span className="text-xs text-red-400 font-bold block mt-1">
                      Giá vé: {st.price?.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <Link
                    to={`/booking/seat/${st.id}`}
                    className="mt-4 block text-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-colors text-sm"
                  >
                    Chọn ghế
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>
  );
};

export default MovieDetailPage;
