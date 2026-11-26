import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { invalidateMoviesCache } from '../../services/clientDataCache';

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

const MovieStatsReviewsSection = ({ movie, onScrollToBooking, onRatingSync }) => {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [reviewSummary, setReviewSummary] = useState(null);

  // Composer ở cuối khung: KHÔNG mặc định 5 sao
  const [reviewerRating, setReviewerRating] = useState(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);

  // Thu gọn/mở rộng danh sách bình luận gốc (mặc định 3 bình luận)
  const [isExpanded, setIsExpanded] = useState(false);
  const INITIAL_VISIBLE_COUNT = 3;

  // Tương tác bình luận: phản hồi, menu ba chấm, chỉnh sửa trực tiếp
  const [expandedRepliesMap, setExpandedRepliesMap] = useState({});
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editCommentDraft, setEditCommentDraft] = useState('');
  const [editRatingDraft, setEditRatingDraft] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [busyActionId, setBusyActionId] = useState(null);

  const menuContainerRef = useRef(null);

  useEffect(() => {
    const handleAuth = () => {
      setCurrentUser(getStoredUser());
    };
    window.addEventListener('authChange', handleAuth);
    return () => window.removeEventListener('authChange', handleAuth);
  }, []);

  // Tự động ẩn thông báo trạng thái (xanh/đỏ) sau 3 giây
  useEffect(() => {
    if (!submitFeedback) return undefined;
    const timer = setTimeout(() => setSubmitFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [submitFeedback]);

  // Đóng menu 3 chấm khi click ra ngoài
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (openMenuId && menuContainerRef.current && !menuContainerRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenuId]);

  if (!movie) return null;

  const movieId = movie.id || movie._id;
  const summary = reviewSummary || movie;
  const eligibility = summary.viewerEligibility || movie.viewerEligibility || {
    isLoggedIn: Boolean(currentUser),
    hasBookedTicket: false,
    hasWatchedMovie: false,
    canComment: Boolean(currentUser),
    canRate: false,
    existingRatingReviewId: null,
    existingRating: null,
  };
  const canRate = Boolean(currentUser && eligibility.canRate);

  const hasVerifiedRating = summary.rating != null && Number.isFinite(Number(summary.rating));
  const ratingScore = hasVerifiedRating ? Number(summary.rating).toFixed(1) : null;
  const ratingCountText = summary.ratingCount || '0 lượt đánh giá';
  const breakdown = summary.ratingBreakdown || {};
  const totalVotes = Object.values(breakdown).reduce((sum, count) => sum + (count || 0), 0);

  const customerReviews = summary.reviews || [];
  const demoReviews = summary.demoReviews || movie.demoReviews || [];
  const reviewsList = [...customerReviews, ...demoReviews];
  const commentCount = Number.isFinite(Number(summary.commentCount)) ? Number(summary.commentCount) : reviewsList.length;

  const visibleReviews = isExpanded ? reviewsList : reviewsList.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMoreReviews = reviewsList.length > INITIAL_VISIBLE_COUNT;

  const starRows = [
    { star: 5, label: '5 sao', count: breakdown.fiveStar || 0 },
    { star: 4, label: '4 sao', count: breakdown.fourStar || 0 },
    { star: 3, label: '3 sao', count: breakdown.threeStar || 0 },
    { star: 2, label: '2 sao', count: breakdown.twoStar || 0 },
    { star: 1, label: '1 sao', count: breakdown.oneStar || 0 },
  ];

  const renderStars = (rating) => {
    const stars = [];
    const full = Math.round(Number(rating) || 0);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={i <= full ? 'text-amber-400' : 'text-slate-600'}>
          ★
        </span>
      );
    }
    return stars;
  };

  const isMyItem = (item) => {
    const id = currentUser?.id || currentUser?._id;
    return Boolean(id && item?.userId && String(item.userId) === String(id) && !item?.isDemo);
  };

  const requireLoginNotice = (actionLabel) => {
    setSubmitFeedback({
      type: 'error',
      text: `Vui lòng đăng nhập để ${actionLabel}.`,
    });
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!currentUser || !reviewerComment.trim() || isSubmitting) return;
    setSubmitFeedback(null);
    try {
      setIsSubmitting(true);
      const payload = {
        comment: reviewerComment.trim(),
        rating: canRate && reviewerRating ? reviewerRating : null,
      };
      const { data } = await api.post(`/movies/${movieId}/reviews`, payload);
      setReviewSummary(data);
      invalidateMoviesCache();
      onRatingSync?.(data);
      setSubmitFeedback({
        type: 'success',
        text: data.updated
          ? 'Đã cập nhật đánh giá sao của bạn.'
          : payload.rating
          ? 'Đã đăng đánh giá và bình luận thành công.'
          : 'Đã đăng bình luận thành công.',
      });
      setReviewerComment('');
      setReviewerRating(null);
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Chưa đăng được bình luận.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async (rev) => {
    if (!currentUser) {
      requireLoginNotice('thích bình luận');
      return;
    }
    if (!rev?._id || busyActionId) return;
    try {
      setBusyActionId(`like-${rev._id}`);
      const { data } = await api.post(`/movies/${movieId}/reviews/${rev._id}/like`);
      setReviewSummary((prev) => ({ ...(prev || movie), ...data }));
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Không thể cập nhật lượt thích.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleToggleReplyLike = async (revId, reply) => {
    if (!currentUser) {
      requireLoginNotice('thích phản hồi');
      return;
    }
    if (!revId || !reply?._id || busyActionId) return;
    try {
      setBusyActionId(`reply-like-${reply._id}`);
      const { data } = await api.post(`/movies/${movieId}/reviews/${revId}/replies/${reply._id}/like`);
      setReviewSummary((prev) => ({ ...(prev || movie), ...data }));
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Không thể cập nhật lượt thích phản hồi.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleOpenReply = (revId, mentionName = '') => {
    if (!currentUser) {
      requireLoginNotice('trả lời bình luận');
      return;
    }
    const prefix = mentionName ? `@${mentionName} ` : '';
    if (replyingToId === revId && !mentionName) {
      setReplyingToId(null);
      setReplyDraft('');
    } else {
      setReplyingToId(revId);
      setReplyDraft(prefix);
      setExpandedRepliesMap((prev) => ({ ...prev, [revId]: true }));
    }
  };

  const handleSubmitReply = async (event, revId) => {
    event.preventDefault();
    if (!currentUser || !replyDraft.trim() || replySubmitting) return;
    try {
      setReplySubmitting(true);
      const { data } = await api.post(`/movies/${movieId}/reviews/${revId}/replies`, {
        comment: replyDraft.trim(),
      });
      setReviewSummary((prev) => ({ ...(prev || movie), ...data }));
      setReplyDraft('');
      setReplyingToId(null);
      setExpandedRepliesMap((prev) => ({ ...prev, [revId]: true }));
      setSubmitFeedback({ type: 'success', text: 'Đã gửi phản hồi.' });
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Không thể gửi phản hồi.',
      });
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleDeleteReply = async (revId, replyId) => {
    if (!window.confirm('Xóa phản hồi này của bạn?')) return;
    try {
      const { data } = await api.delete(`/movies/${movieId}/reviews/${revId}/replies/${replyId}`);
      setReviewSummary((prev) => ({ ...(prev || movie), ...data }));
      setSubmitFeedback({ type: 'success', text: 'Đã xóa phản hồi.' });
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Không thể xóa phản hồi.',
      });
    }
  };

  const handleStartEdit = (rev) => {
    setOpenMenuId(null);
    setEditingReviewId(rev._id);
    setEditCommentDraft(rev.comment || '');
    setEditRatingDraft(Number.isInteger(rev.rating) ? rev.rating : null);
  };

  const handleSaveEdit = async (event, rev) => {
    event.preventDefault();
    if (!editCommentDraft.trim() || editSubmitting) return;
    try {
      setEditSubmitting(true);
      const payload = { comment: editCommentDraft.trim() };
      if (canRate && (Number.isInteger(rev.rating) || editRatingDraft !== null)) {
        payload.rating = editRatingDraft;
      }
      const { data } = await api.patch(`/movies/${movieId}/reviews/${rev._id}`, payload);
      setReviewSummary((prev) => ({ ...(prev || movie), ...data }));
      invalidateMoviesCache();
      onRatingSync?.(data);
      setEditingReviewId(null);
      setEditCommentDraft('');
      setEditRatingDraft(null);
      setSubmitFeedback({ type: 'success', text: 'Đã cập nhật bình luận.' });
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Không thể cập nhật bình luận.',
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteReview = async (review) => {
    setOpenMenuId(null);
    if (!window.confirm('Xóa bình luận của bạn?')) return;
    try {
      const { data } = await api.delete(`/movies/${movieId}/reviews/${review._id}`);
      setReviewSummary((prev) => ({ ...(prev || movie), ...data }));
      invalidateMoviesCache();
      onRatingSync?.(data);
      setSubmitFeedback({ type: 'success', text: 'Đã xóa bình luận.' });
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Chưa xóa được bình luận.',
      });
    }
  };

  const handleReportReview = async (review) => {
    setOpenMenuId(null);
    if (!currentUser) {
      requireLoginNotice('báo cáo bình luận');
      return;
    }
    try {
      const { data } = await api.post(`/movies/${movieId}/reviews/${review._id}/report`, {
        reason: 'Nội dung không phù hợp',
      });
      setSubmitFeedback({
        type: 'success',
        text: data.message || 'Đã ghi nhận báo cáo bình luận.',
      });
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Không thể gửi báo cáo bình luận.',
      });
    }
  };

  const posterSrc =
    movie.posterUrl ||
    movie.poster ||
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&auto=format&fit=crop';

  return (
    <div
      ref={menuContainerRef}
      className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative"
    >
      {/* 1. HEADER: POSTER NHỎ + TÊN PHIM + BADGE ĐANG CHIẾU (GIỮ NGUYÊN 100%) */}
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

      {/* 2. KHU VỰC ĐÁNH GIÁ KHÁCH HÀNG (GIỮ NGUYÊN THIẾT KẾ BIỂU ĐỒ; 0 LƯỢT = 0% ĐỘ RỘNG) */}
      <div className="space-y-4">
        <h4 className="text-base sm:text-lg font-bold text-white">Đánh giá khách hàng</h4>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            {hasVerifiedRating ? (
              <span className="text-3xl sm:text-4xl font-black text-[#22c55e]">{ratingScore}/5</span>
            ) : (
              <span className="text-lg sm:text-xl font-black text-slate-300">Chưa có đánh giá</span>
            )}
            <div>
              <div className="flex items-center space-x-1 text-sm">{renderStars(summary.rating || 0)}</div>
              <span className="text-xs text-slate-400 font-medium">
                Khách hàng D’AVENOR • {ratingCountText}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {starRows.map((row) => {
            const pct = totalVotes > 0 && row.count > 0 ? Math.round((row.count / totalVotes) * 100) : 0;
            return (
              <div key={row.star} className="flex items-center text-xs space-x-3">
                <span className="w-10 text-slate-400 font-medium shrink-0">{row.label}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-surface)]/90 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#22c55e] transition-all duration-700"
                    style={{ width: `${row.count > 0 ? Math.min(100, pct) : 0}%` }}
                  ></div>
                </div>
                <span className="w-8 text-right text-slate-400 font-medium shrink-0">{row.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border-default)]/80"></div>

      {/* 3. DANH SÁCH BÌNH LUẬN KHÁCH HÀNG (GIỮ NGUYÊN BỐ CỤC THẺ, BỔ SUNG THANH TƯƠNG TÁC & PHẢN HỒI) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <span>💬</span>
            <span>Bình luận khách hàng</span>
            <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)]/90 border border-slate-700/80 text-[11px] font-bold text-[var(--cyan)]">
              {commentCount}
            </span>
          </h4>

          {hasMoreReviews && (
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              {isExpanded
                ? `Đang hiển thị tất cả ${reviewsList.length} bình luận`
                : `Hiển thị ${INITIAL_VISIBLE_COUNT}/${reviewsList.length} bình luận mới nhất`}
            </span>
          )}
        </div>

        {reviewsList.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">
            Chưa có bình luận nào cho bộ phim này. Hãy là người đầu tiên chia sẻ cảm nhận hoặc đặt câu hỏi!
          </p>
        ) : (
          <div
            className={`space-y-2 transition-all duration-300 ${
              isExpanded
                ? 'max-h-[420px] sm:max-h-[460px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-transparent'
                : ''
            }`}
          >
            {visibleReviews.map((rev, idx) => {
              const revId = rev._id || rev.id || `rev-${idx}`;
              const isMine = isMyItem(rev);
              const isDemoItem = rev.source === 'DEMO' || Boolean(rev.isDemo);
              const hasStarRating = Number.isFinite(Number(rev.rating)) && Number(rev.rating) >= 1 && Number(rev.rating) <= 5;
              const replies = Array.isArray(rev.replies) ? rev.replies : [];
              const isRepliesOpen = Boolean(expandedRepliesMap[revId]);
              const isEditing = editingReviewId === rev._id;
              const isMenuOpen = openMenuId === revId;

              return (
                <div
                  key={revId}
                  className="bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)]/70 py-2.5 px-3 sm:px-3.5 rounded-xl border border-[var(--border-default)]/70 hover:border-slate-700/60 transition-all duration-200 space-y-1.5 group/rev relative"
                >
                  {/* Hàng tiêu đề thẻ bình luận */}
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1 min-w-0">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-[10px] sm:text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                        {(rev.userName || 'K').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-white text-xs sm:text-sm">
                        {rev.userName || 'Khán giả'}
                      </span>

                      {hasStarRating && (
                        <>
                          <span className="text-slate-600 hidden sm:inline">•</span>
                          <span className="text-amber-400 tracking-wider flex items-center text-xs">
                            {renderStars(rev.rating)}
                          </span>
                        </>
                      )}

                      {isDemoItem ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-700/60 text-slate-300 border border-slate-500/40">
                          Đánh giá mẫu / Tham khảo
                        </span>
                      ) : rev.verifiedAttendance ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-0.5">
                          <span>✓</span>
                          <span>Đã xem phim</span>
                        </span>
                      ) : rev.hasBookedTicket ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          Đã đặt vé
                        </span>
                      ) : null}

                      {isMine && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-[var(--ice-blue)] border border-[var(--cyan)]/30">
                          Của bạn
                        </span>
                      )}

                      {rev.createdAt && (
                        <span className="text-[10px] text-slate-400 hidden sm:inline ml-1 font-medium">
                          {formatReviewDate(rev.createdAt)}
                          {rev.updatedAt ? ' (đã sửa)' : ''}
                        </span>
                      )}
                    </div>

                    {/* Menu dấu ba chấm (chỉnh sửa / xóa với chủ sở hữu; báo cáo với người khác) */}
                    {rev._id && (
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(isMenuOpen ? null : revId)}
                          aria-label="Tùy chọn bình luận"
                          className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer text-sm leading-none"
                        >
                          ⋯
                        </button>
                        {isMenuOpen && (
                          <div className="absolute right-0 top-6 z-30 w-40 rounded-xl bg-[#0B1026] border border-slate-700/80 shadow-xl py-1 text-xs">
                            {isMine ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(rev)}
                                  className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-800/80 hover:text-white cursor-pointer"
                                >
                                  Chỉnh sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReview(rev)}
                                  className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                >
                                  Xóa bình luận
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReportReview(rev)}
                                className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-slate-800/80 hover:text-amber-300 cursor-pointer"
                              >
                                Báo cáo bình luận
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Nội dung bình luận hoặc form chỉnh sửa trực tiếp */}
                  {isEditing ? (
                    <form onSubmit={(e) => handleSaveEdit(e, rev)} className="pl-7 sm:pl-8 space-y-2 pt-1">
                      {canRate && (hasStarRating || !eligibility.existingRatingReviewId) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span>Đánh giá sao:</span>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setEditRatingDraft(editRatingDraft === s ? null : s)}
                              className={`text-sm leading-none cursor-pointer ${
                                editRatingDraft && s <= editRatingDraft ? 'text-amber-400' : 'text-slate-600'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        type="text"
                        required
                        maxLength={2000}
                        value={editCommentDraft}
                        onChange={(e) => setEditCommentDraft(e.target.value)}
                        className="w-full bg-[#0B1026]/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--cyan)]"
                      />
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="submit"
                          disabled={editSubmitting || !editCommentDraft.trim()}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          {editSubmitting ? 'Đang lưu...' : 'Lưu'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingReviewId(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-xs sm:text-[13px] text-slate-300 font-normal leading-relaxed pl-7 sm:pl-8">
                      {rev.comment}
                    </p>
                  )}

                  {/* Thanh tương tác nhỏ gọn bên dưới nội dung bình luận */}
                  {!isEditing && rev._id && (
                    <div className="pl-7 sm:pl-8 flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleLike(rev)}
                        disabled={busyActionId === `like-${rev._id}`}
                        className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                          rev.likedByCurrentUser ? 'text-rose-400 font-semibold' : 'hover:text-slate-200'
                        }`}
                      >
                        <span>{rev.likedByCurrentUser ? '♥' : '♡'}</span>
                        <span>{rev.likesCount || 0} lượt thích</span>
                      </button>

                      <span className="text-slate-600">·</span>

                      <button
                        type="button"
                        onClick={() => handleOpenReply(revId)}
                        className="hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        Trả lời
                      </button>

                      {replies.length > 0 && (
                        <>
                          <span className="text-slate-600">·</span>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRepliesMap((prev) => ({ ...prev, [revId]: !prev[revId] }))
                            }
                            className="text-slate-300 hover:text-[var(--cyan)] transition-colors cursor-pointer font-medium"
                          >
                            {isRepliesOpen ? 'Ẩn phản hồi' : `Xem ${replies.length} phản hồi`}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Ô nhập trả lời nhỏ ngay bên dưới bình luận cha (KHÔNG mở modal) */}
                  {replyingToId === revId && rev._id && (
                    <form
                      onSubmit={(e) => handleSubmitReply(e, rev._id)}
                      className="ml-7 sm:ml-8 pl-3 border-l border-slate-700/70 pt-1.5 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        required
                        maxLength={1500}
                        placeholder={`Trả lời ${rev.userName || 'khán giả'}...`}
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        className="flex-1 bg-[#0B1026]/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-[var(--cyan)]"
                      />
                      <button
                        type="submit"
                        disabled={replySubmitting || !replyDraft.trim()}
                        className="px-3 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-white text-[11px] font-semibold disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        {replySubmitting ? '...' : 'Gửi'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(null);
                          setReplyDraft('');
                        }}
                        className="px-2 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer shrink-0"
                      >
                        Hủy
                      </button>
                    </form>
                  )}

                  {/* Danh sách phản hồi thụt lề có đường kẻ dọc mảnh (mặc định thu gọn) */}
                  {isRepliesOpen && replies.length > 0 && (
                    <div className="ml-7 sm:ml-8 pl-3 border-l border-slate-700/70 space-y-2 pt-1.5">
                      {replies.map((rep, rIdx) => {
                        const isMyReply = isMyItem(rep);
                        return (
                          <div key={rep._id || `rep-${rIdx}`} className="space-y-0.5">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="w-4 h-4 rounded-full bg-slate-700 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                                  {(rep.userName || 'K').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-slate-100">{rep.userName || 'Khán giả'}</span>
                                {rep.verifiedAttendance && !rep.isDemo && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    ✓ Đã xem phim
                                  </span>
                                )}
                                {!rep.verifiedAttendance && rep.hasBookedTicket && !rep.isDemo && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                    Đã đặt vé
                                  </span>
                                )}
                                {rep.createdAt && (
                                  <span className="text-[10px] text-slate-500">{formatReviewDate(rep.createdAt)}</span>
                                )}
                              </div>
                              {isMyReply && rep._id && rev._id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReply(rev._id, rep._id)}
                                  className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                                >
                                  Xóa
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed pl-5">{rep.comment}</p>
                            {rep._id && rev._id && (
                              <div className="pl-5 pt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                                <button
                                  type="button"
                                  onClick={() => handleToggleReplyLike(rev._id, rep)}
                                  disabled={busyActionId === `reply-like-${rep._id}`}
                                  className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                    rep.likedByCurrentUser
                                      ? 'text-rose-400 font-semibold'
                                      : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  <span>{rep.likedByCurrentUser ? '♥' : '♡'}</span>
                                  <span>{rep.likesCount || 0} lượt thích</span>
                                </button>
                                <span className="text-slate-600">·</span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReply(revId, rep.userName || '')}
                                  className="hover:text-slate-200 transition-colors cursor-pointer"
                                >
                                  Trả lời
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Nút Xem thêm / Thu gọn bình luận dạng Pill tinh tế (GIỮ NGUYÊN) */}
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
                  <span>Xem thêm {reviewsList.length - INITIAL_VISIBLE_COUNT} bình luận khác</span>
                  <span className="text-[var(--cyan)] group-hover:translate-y-0.5 transition-transform text-[11px]">
                    ▼
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 4. FOOTER: KHU VỰC ĐĂNG BÌNH LUẬN & ĐÁNH GIÁ SAO (GIỮ NGUYÊN VỊ TRÍ CUỐI GIAO DIỆN) */}
      <div className="pt-4 border-t border-[var(--border-default)]/80 space-y-3">
        {!currentUser ? (
          <div className="p-4 rounded-2xl bg-[#0B1026]/80 border border-[#AA9BFF]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-slate-200 font-medium">
              Vui lòng đăng nhập hoặc đăng ký tài khoản để đánh giá và bình luận về bộ phim.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/login"
                state={{ from: location.pathname }}
                className="px-4 py-2 cinema-action text-[#0B1026] rounded-xl text-xs font-black transition-all shadow"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                state={{ from: location.pathname }}
                className="px-4 py-2 bg-[#171936] hover:bg-[#20204B] text-[#E9D5FF] border border-[#AA9BFF]/35 rounded-xl text-xs font-bold transition-all"
              >
                Đăng ký
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="text-slate-400 font-medium">Bạn đánh giá:</span>
                <div
                  className={`flex items-center space-x-0.5 ${!canRate ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={
                    canRate
                      ? 'Chọn từ 1–5 sao (không bắt buộc nếu chỉ muốn bình luận)'
                      : 'Đánh giá sao sẽ được mở sau khi bạn đã xem phim'
                  }
                >
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!canRate}
                      onClick={() => setReviewerRating(reviewerRating === s ? null : s)}
                      className={`text-lg leading-none transition-transform ${
                        canRate ? 'hover:scale-125 cursor-pointer' : 'cursor-not-allowed'
                      } ${canRate && reviewerRating && s <= reviewerRating ? 'text-amber-400' : 'text-slate-600'}`}
                      aria-label={`Chọn ${s} sao`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {canRate ? (
                  <span className="text-[11px] font-medium text-amber-400">
                    {reviewerRating ? `(${reviewerRating} sao)` : '(Tùy chọn — bỏ trống để chỉ bình luận)'}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">(Chỉ mở sau khi xem phim)</span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                Đăng với tài khoản <strong className="text-white">{currentUser.name}</strong>
              </span>
            </div>

            {!canRate && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 bg-[#0B1026]/50 border border-slate-700/60 rounded-xl px-3 py-2">
                <span>
                  Bạn có thể bình luận và tìm hiểu về bộ phim. Đánh giá sao sẽ được mở sau khi bạn đã xem phim.
                </span>
                {onScrollToBooking && (
                  <button
                    type="button"
                    onClick={onScrollToBooking}
                    className="text-[var(--cyan)] hover:underline font-semibold shrink-0 cursor-pointer"
                  >
                    Đặt vé xem phim →
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  maxLength={2000}
                  placeholder={
                    canRate
                      ? 'Viết nhận xét hoặc bình luận của bạn về bộ phim...'
                      : 'Đặt câu hỏi hoặc viết bình luận về bộ phim...'
                  }
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

              <button
                type="submit"
                disabled={isSubmitting || !reviewerComment.trim()}
                className="px-3.5 py-2 cinema-action disabled:bg-[var(--bg-surface)] disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-700/20 active:scale-95 flex items-center space-x-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>{isSubmitting ? '...' : 'Đăng'}</span>
                <span>🚀</span>
              </button>
            </form>
          </>
        )}

        {submitFeedback && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 animate-fadeIn border ${
              submitFeedback.type === 'error'
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <span>{submitFeedback.type === 'error' ? '⚠️' : '✓'}</span>
            <span>{submitFeedback.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieStatsReviewsSection;
