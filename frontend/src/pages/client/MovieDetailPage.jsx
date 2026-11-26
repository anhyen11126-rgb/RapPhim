import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';

// Các module thành phần con được tách biệt rõ ràng (tránh conflict khi nhóm cùng làm)
import MovieHeroTrailer from '../../components/movie-detail/MovieHeroTrailer';
import MovieSidebarInfo from '../../components/movie-detail/MovieSidebarInfo';
import MovieOverviewHighlights from '../../components/movie-detail/MovieOverviewHighlights';
import MovieCastSection from '../../components/movie-detail/MovieCastSection';
import MovieStatsReviewsSection from '../../components/movie-detail/MovieStatsReviewsSection';
import MovieShowtimesSection from '../../components/movie-detail/MovieShowtimesSection';

// Kiểu dáng phân loại độ tuổi chuẩn rạp
const getAgeBadgeStyle = (ageRating) => {
  switch (ageRating) {
    case 'T11':
    case 'P':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/50',
        label: ageRating === 'T11' ? 'T11 - PHIM CHO KHÁN GIẢ TRÊN 11 TUỔI' : 'P - PHIM DÀNH CHO MỌI LỨA TUỔI',
      };
    case 'T13':
      return {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        border: 'border-yellow-500/50',
        label: 'T13 - PHIM CẤM KHÁN GIẢ DƯỚI 13 TUỔI',
      };
    case 'T16':
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/50',
        label: 'T16 - PHIM CẤM KHÁN GIẢ DƯỚI 16 TUỔI',
      };
    case 'T18':
    default:
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/50',
        label: 'T18 - PHIM DÀNH CHO KHÁN GIẢ TRÊN 18 TUỔI',
      };
  }
};

const MovieDetailPage = () => {
  const { id } = useParams();

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // { type: 'NOT_FOUND'|'INVALID_ID'|'NETWORK'|'SERVER', title, message }
  const [retryCount, setRetryCount] = useState(0);

  // Modal Trailer & Trạng thái yêu thích
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setMovie(null);
    setErrorState(null);

    api.get('/movies/' + encodeURIComponent(id || ''), {
      params: { schedule: 'read-only' },
      signal: request.signal,
    })
      .then(({ data }) => {
        if (request.signal.aborted) return;
        if (!data || (!data.id && !data._id)) {
          setErrorState({
            type: 'NOT_FOUND',
            title: 'Không tìm thấy bộ phim này',
            message: 'Bộ phim có thể đã ngừng chiếu, bị ẩn hoặc đường dẫn không còn tồn tại.',
          });
          return;
        }
        setMovie(data);
      })
      .catch((err) => {
        if (request.signal.aborted || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        const status = err?.response?.status;
        if (!err?.response) {
          setErrorState({
            type: 'NETWORK',
            title: 'Không thể kết nối tới máy chủ',
            message: 'Vui lòng kiểm tra kết nối mạng của bạn và thử tải lại trang.',
          });
        } else if (status === 400) {
          setErrorState({
            type: 'INVALID_ID',
            title: 'Mã phim không hợp lệ',
            message: 'Đường dẫn phim không đúng định dạng. Vui lòng chọn phim từ danh sách.',
          });
        } else if (status === 404) {
          setErrorState({
            type: 'NOT_FOUND',
            title: 'Không tìm thấy thông tin bộ phim này',
            message: 'Phim không tồn tại trong hệ thống hoặc đã bị gỡ khỏi lịch chiếu.',
          });
        } else {
          setErrorState({
            type: 'SERVER',
            title: 'Đã có lỗi khi tải dữ liệu phim',
            message: 'Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau ít phút.',
          });
        }
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });

    return () => request.abort();
  }, [id, retryCount]);

  const scrollToBooking = () => {
    const el = document.getElementById('showtimes-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center text-slate-400 py-32 space-y-4">
        <div className="w-12 h-12 border-4 border-[#42DFFF] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold tracking-wide text-slate-300">Đang nạp dữ liệu phim điện ảnh...</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center text-slate-300 px-4 py-32">
        <div className="max-w-md w-full bg-[#11152F]/90 border border-[#AA9BFF]/30 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <span className="text-5xl block">🎬</span>
          <h1 className="text-xl font-black text-white">
            {errorState?.title || 'Không tìm thấy thông tin bộ phim này.'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {errorState?.message || 'Bộ phim không tồn tại hoặc đã ngừng chiếu tại D’AVENOR CINEMA.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {(errorState?.type === 'NETWORK' || errorState?.type === 'SERVER') && (
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-[#83F5FF] border border-[#42DFFF]/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Thử lại
              </button>
            )}
            <Link
              to="/theaters"
              className="px-4 py-2.5 bg-[#171936] hover:bg-[#20204B] text-[#E9D5FF] border border-[#AA9BFF]/35 rounded-xl text-xs font-bold transition-all"
            >
              Quay lại danh sách phim
            </Link>
            <Link
              to="/"
              className="px-4 py-2.5 cinema-action text-[#0B1026] rounded-xl text-xs font-black transition-all shadow"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ageBadge = getAgeBadgeStyle(movie.ageRating);

  return (
    <div className="bg-[var(--bg-main)] text-[var(--text-main)] min-h-screen pb-28 select-none">
      {/* 1. HERO TRAILER SECTION (THEATRICAL AMBIENT BANNER & MODAL) */}
      <MovieHeroTrailer
        movie={movie}
        isTrailerModalOpen={isTrailerModalOpen}
        onOpenTrailer={() => setIsTrailerModalOpen(true)}
        onCloseTrailer={() => setIsTrailerModalOpen(false)}
        onScrollToBooking={scrollToBooking}
      />

      {/* 2. MAIN DETAILS GRID (SIDEBAR THÔNG SỐ & THÔNG TIN CHÍNH) */}
      <section className="relative z-20 max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-12 -mt-16 sm:-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CỘT TRÁI (4 COLS): POSTER, BẢNG THÔNG SỐ ĐIỆN ẢNH */}
          <MovieSidebarInfo
            movie={movie}
            ageBadge={ageBadge}
            onScrollToBooking={scrollToBooking}
          />

          {/* CỘT PHẢI (8 COLS): TÊN PHIM, ĐÁNH GIÁ, TÓM TẮT, DÀN DIỄN VIÊN */}
          <div className="lg:col-span-8 space-y-8 pt-4">
            <MovieOverviewHighlights
              movie={movie}
              ageBadge={ageBadge}
              isFavorite={isFavorite}
              onToggleFavorite={() => setIsFavorite(!isFavorite)}
            />

            <MovieCastSection cast={movie.cast} />

            {/* THỐNG KÊ DOANH THU, VÉ, GHẾ & ĐÁNH GIÁ RIÊNG TỪNG BỘ PHIM */}
            <MovieStatsReviewsSection
              key={movie.id || movie._id || id}
              movie={movie}
              onScrollToBooking={scrollToBooking}
              onRatingSync={(data) =>
                setMovie((prev) =>
                  prev
                    ? {
                        ...prev,
                        rating: data.rating,
                        ratingCount: data.ratingCount,
                        ratingBreakdown: data.ratingBreakdown,
                      }
                    : prev
                )
              }
            />
          </div>
        </div>
      </section>

      {/* 3. LỊCH CHIẾU RẠP TOÀN QUỐC (SHOWTIMES & BOOKING SECTION) */}
      <MovieShowtimesSection key={id} movie={movie} />
    </div>
  );
};

export default MovieDetailPage;
