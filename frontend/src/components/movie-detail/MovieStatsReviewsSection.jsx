import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const formatReviewDate = (val) => {
  if (!val) return '';
  if (typeof val === 'string' && (val.includes('trước') || val.includes('Vừa xong') || val.includes('hôm'))) {
    return val;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return String(val);
};

const MovieStatsReviewsSection = ({ movie }) => {
  if (!movie) return null;

  // Người dùng hiện tại đang đăng nhập
  const [currentUser, setCurrentUser] = useState(getStoredUser);

  // Form viết bình luận ở thanh dưới cùng
  const [reviewerName, setReviewerName] = useState(currentUser?.name || '');
  const [reviewerRating, setReviewerRating] = useState(5);
  const [reviewerComment, setReviewerComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');

  useEffect(() => {
    const handleAuth = () => {
      const u = getStoredUser();
      setCurrentUser(u);
      if (u?.name && !reviewerName) {
        setReviewerName(u.name);
      }
    };
    window.addEventListener('authChange', handleAuth);
    return () => window.removeEventListener('authChange', handleAuth);
  }, []);

  const [reviewSummary, setReviewSummary] = useState(null);
  const summary = reviewSummary || movie;
  const ratingScore = summary.rating == null ? '—' : Number(summary.rating).toFixed(1);
  const ratingCountText = summary.ratingCount || '0 lượt đánh giá';
  const breakdown = summary.ratingBreakdown || {};
  const totalVotes = Object.values(breakdown).reduce((sum, count) => sum + (count || 0), 0);
  const reviewsList = summary.reviews || [];

  // Trạng thái thu gọn / mở rộng danh sách bình luận (mặc định chỉ hiện 3 bình luận tinh tế nhất)
  const [isExpanded, setIsExpanded] = useState(false);
  const INITIAL_VISIBLE_COUNT = 3;

  const visibleReviews = isExpanded
    ? reviewsList
    : reviewsList.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMoreReviews = reviewsList.length > INITIAL_VISIBLE_COUNT;

  const starRows = [
    { star: 5, label: '5 sao', count: breakdown.fiveStar || 0 },
    { star: 4, label: '4 sao', count: breakdown.fourStar || 0 },
    { star: 3, label: '3 sao', count: breakdown.threeStar || 0 },
    { star: 2, label: '2 sao', count: breakdown.twoStar || 0 },
    { star: 1, label: '1 sao', count: breakdown.oneStar || 0 },
  ];

  // Helper render sao vàng
  const renderStars = (rating) => {
    const stars = [];
    const full = Math.floor(rating);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={i <= full ? 'text-amber-400' : 'text-slate-600'}>
          ★
        </span>
      );
    }
    return stars;
  };

  /**
   * Kiểm tra quyền sở hữu bình luận:
   * CHỈ HIỂN THỊ NÚT XÓA nếu bình luận do chính người dùng hiện tại viết!
   * Người xem khác KHÔNG BAO GIỜ thấy nút xóa của người khác.
   */
  const isMyReview = review => {
    const id = currentUser?.id || currentUser?._id;
    return Boolean(id && review?.userId && String(review.userId) === String(id));
  };

  const handleSubmitReview = async event => {
    event.preventDefault();
    if (!reviewerComment.trim() || isSubmitting) return;
    setSubmitSuccess('');
    try {
      setIsSubmitting(true);
      const { data } = await api.post(`/movies/${movie.id || movie._id}/reviews`, {
        rating: reviewerRating, comment: reviewerComment.trim(),
      });
      setReviewSummary(data);
      setSubmitSuccess('Đã đăng bình luận.');
      setReviewerComment('');
    } catch (error) {
      setSubmitSuccess(error.response?.data?.message || 'Chưa đăng được bình luận.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async review => {
    if (!window.confirm('Xóa bình luận của bạn?')) return;
    try {
      const { data } = await api.delete(`/movies/${movie.id || movie._id}/reviews/${review._id}`);
      setReviewSummary(data);
      setSubmitSuccess('Đã xóa bình luận.');
    } catch (error) {
      setSubmitSuccess(error.response?.data?.message || 'Chưa xóa được bình luận.');
    }
  };

  const posterSrc =
    movie.posterUrl ||
    movie.poster ||
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&auto=format&fit=crop';

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
      {/* 1. HEADER: POSTER NHỎ + TÊN PHIM + BADGE ĐANG CHIẾU */}
      <div className="flex items-start space-x-4 border-b border-[var(--border-default)]/80 pb-5">
        <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl overflow-hidden border border-slate-700/60 shadow-lg shrink-0 bg-[var(--bg-secondary)]">
          <img
            src={posterSrc}
            alt={movie.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src =
                'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&auto=format&fit=crop';
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl font-black text-white truncate">{movie.title}</h3>
          <div className="mt-1.5 flex items-center space-x-2">
            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{movie.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đang chiếu'}</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">• Đánh giá & nhận xét từ khán giả</span>
          </div>
        </div>
      </div>

      {/* 3. KHU VỰC ĐÁNH GIÁ KHÁCH HÀNG (ĐIỂM SỐ + THANH PHÂN BỔ 5 SAO) */}
      <div className="space-y-4">
        <h4 className="text-base sm:text-lg font-bold text-white">Đánh giá khách hàng</h4>

        <div className="flex items-center space-x-3">
          <span className="text-3xl sm:text-4xl font-black text-[#22c55e]">{ratingScore}/5</span>
          <div>
            <div className="flex items-center space-x-1 text-sm">{renderStars(summary.rating || 0)}</div>
            <span className="text-xs text-slate-400 font-medium">{ratingCountText}</span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {starRows.map((row) => {
            const pct = totalVotes > 0 ? Math.round((row.count / (totalVotes || 1)) * 100) : 0;
            return (
              <div key={row.star} className="flex items-center text-xs space-x-3">
                <span className="w-10 text-slate-400 font-medium shrink-0">{row.label}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-surface)]/90 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#22c55e] transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                  ></div>
                </div>
                <span className="w-8 text-right text-slate-400 font-medium shrink-0">{row.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border-default)]/80"></div>

      {/* 4. DANH SÁCH BÌNH LUẬN CỦA KHÁCH HÀNG (THIẾT KẾ RÚT GỌN TINH TẾ) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <span>💬</span>
            <span>Bình luận khách hàng</span>
            <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)]/90 border border-slate-700/80 text-[11px] font-bold text-[var(--cyan)]">
              {reviewsList.length}
            </span>
          </h4>

          {hasMoreReviews && (
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              {isExpanded ? `Đang hiển thị tất cả ${reviewsList.length} bình luận` : `Hiển thị 3/${reviewsList.length} bình luận mới nhất`}
            </span>
          )}
        </div>

        {/* Danh sách bình luận rút gọn & tinh tế */}
        <div
          className={`space-y-2 transition-all duration-300 ${
            isExpanded
              ? 'max-h-[320px] sm:max-h-[350px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-transparent'
              : ''
          }`}
        >
          {visibleReviews.map((rev, idx) => {
            const canDelete = isMyReview(rev);
            return (
              <div
                key={rev._id || rev.id || idx}
                className="bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)]/70 py-2.5 px-3 sm:px-3.5 rounded-xl border border-[var(--border-default)]/70 hover:border-slate-700/60 transition-all duration-200 space-y-1 group/rev"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-[10px] sm:text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                      {(rev.userName || 'K').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-white text-xs sm:text-sm">
                      {rev.userName || 'Khán giả'}
                    </span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span className="text-amber-400 tracking-wider flex items-center text-xs">
                      {renderStars(rev.rating || 5)}
                    </span>
                    {canDelete && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/20 text-[var(--ice-blue)] border border-[var(--cyan)]/30">
                        Của bạn
                      </span>
                    )}
                    {rev.createdAt && (
                      <span className="text-[10px] text-slate-400 hidden sm:inline ml-1 font-medium">
                        {formatReviewDate(rev.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* Nút xóa: CHỈ HIỂN THỊ KHI ĐÚNG LÀ BÌNH LUẬN CỦA CHÍNH CÁ NHÂN ĐÓ */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteReview(rev, idx)}
                      className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors flex items-center space-x-1 px-2 py-0.5 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                      title="Xóa bình luận này của bạn"
                    >
                      <span>🗑️</span>
                      <span>Xóa</span>
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-[13px] text-slate-300 font-normal leading-relaxed pl-7 sm:pl-8">
                  {rev.comment}
                </p>
              </div>
            );
          })}
        </div>

        {/* Nút Xem thêm / Thu gọn bình luận dạng Pill tinh tế */}
        {hasMoreReviews && (
          <div className="pt-0.5 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-4 py-1.5 rounded-full bg-[var(--bg-secondary)]/70 hover:bg-[var(--bg-surface)]/90 border border-slate-700/60 hover:border-[var(--cyan)]/50 text-slate-300 hover:text-white text-xs font-semibold transition-all duration-200 flex items-center space-x-1.5 shadow-sm hover:shadow-[0_0_12px_rgba(59,130,246,0.2)] group cursor-pointer active:scale-95"
            >
              {isExpanded ? (
                <>
                  <span>Thu gọn bình luận</span>
                  <span className="text-slate-400 group-hover:text-[var(--cyan)] transition-transform group-hover:-translate-y-0.5 text-[11px]">
                    ▲
                  </span>
                </>
              ) : (
                <>
                  <span>
                    Xem thêm {reviewsList.length - INITIAL_VISIBLE_COUNT} bình luận khác
                  </span>
                  <span className="text-[var(--cyan)] group-hover:translate-y-0.5 transition-transform text-[11px]">
                    ▼
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 5. FOOTER: THANH VIẾT BÌNH LUẬN Ở PHÍA DƯỚI CÙNG & NÚT NHỎ ĐỂ ĐĂNG (ĐÃ BỎ DẤU MŨI TÊN) */}
      <div className="pt-4 border-t border-[var(--border-default)]/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Bạn đánh giá:</span>
            <div className="flex items-center space-x-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setReviewerRating(s)}
                  className={`text-lg leading-none transition-transform hover:scale-125 cursor-pointer ${
                    s <= reviewerRating ? 'text-amber-400' : 'text-slate-600'
                  }`}
                  title={`${s} sao`}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-amber-400">({reviewerRating} sao)</span>
          </div>

          {!currentUser && (
            <input
              type="text"
              placeholder="Tên của bạn..."
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-[var(--cyan)] w-36"
            />
          )}
        </div>

        {/* Thanh input viết bình luận kèm nút Đăng nhỏ gọn */}
        <form onSubmit={handleSubmitReview} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              required
              placeholder="Viết bình luận..."
              value={reviewerComment}
              onChange={(e) => setReviewerComment(e.target.value)}
              className="w-full bg-[var(--bg-secondary)]/90 border border-slate-700/80 rounded-2xl px-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--cyan)] pr-9 shadow-inner"
            />
            {reviewerComment && (
              <button
                type="button"
                onClick={() => setReviewerComment('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs p-1"
                title="Xóa trắng"
              >
                ✕
              </button>
            )}
          </div>

          {/* Nút nhỏ để đăng lên */}
          <button
            type="submit"
            disabled={isSubmitting || !reviewerComment.trim() || (!currentUser && !reviewerName.trim())}
            className="px-3.5 py-2 cinema-action disabled:bg-[var(--bg-surface)] disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-700/20 active:scale-95 flex items-center space-x-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>{isSubmitting ? '...' : 'Đăng'}</span>
            <span>🚀</span>
          </button>
        </form>

        {submitSuccess && (
          <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center space-x-2 animate-fadeIn">
            <span>✓</span>
            <span>{submitSuccess}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieStatsReviewsSection;
