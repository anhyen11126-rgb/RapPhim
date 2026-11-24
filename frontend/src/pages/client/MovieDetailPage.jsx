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

  // Modal Trailer & Trạng thái yêu thích
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setMovie(null);
    api.get('/movies/' + encodeURIComponent(id), { params: { schedule: 'read-only' }, signal: request.signal })
      .then(({ data }) => setMovie(data))
      .catch(() => {})
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => request.abort();
  }, [id]);

  const scrollToBooking = () => {
    const el = document.getElementById('showtimes-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center text-slate-400 py-32 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold tracking-wide text-slate-300">Đang nạp dữ liệu phim điện ảnh...</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center text-slate-400 py-32 space-y-4">
        <span className="text-4xl">🎬</span>
        <p className="text-xl font-bold text-white">Không tìm thấy thông tin bộ phim này.</p>
        <Link
          to="/"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow"
        >
          Quay lại Trang chủ
        </Link>
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
              movie={movie}
              onScrollToBooking={scrollToBooking}
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
