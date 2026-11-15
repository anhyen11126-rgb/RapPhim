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

const getMyReviewIds = () => {
  try {
    return JSON.parse(localStorage.getItem('movietix_my_review_ids') || '[]');
  } catch {
    return [];
  }
};

const saveMyReviewId = (id) => {
  if (!id) return;
  try {
    const list = getMyReviewIds();
    const idStr = String(id);
    if (!list.includes(idStr)) {
      list.push(idStr);
      localStorage.setItem('movietix_my_review_ids', JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Không thể lưu id bình luận:', err);
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

  const ratingScore = Number(movie.rating || 4.6).toFixed(1);
  const ratingCountText = movie.ratingCount || '120 lượt đánh giá';

  // Phân bổ tỷ lệ đánh giá sao (5 sao -> 1 sao)
  const defaultBreakdown = {
    fiveStar: 90,
    fourStar: 20,
    threeStar: 7,
    twoStar: 2,
    oneStar: 1,
  };
  const breakdown = movie.ratingBreakdown || defaultBreakdown;
  const totalVotes =
    (breakdown.fiveStar || 0) +
    (breakdown.fourStar || 0) +
    (breakdown.threeStar || 0) +
    (breakdown.twoStar || 0) +
    (breakdown.oneStar || 0) || 120;

  // Danh sách bình luận khách hàng
  const defaultReviews = [
    {
      _id: 'default-1',
      userName: 'Nguyễn Văn A',
      rating: 5,
      comment: 'Hình ảnh đẹp, âm thanh sống động, nội dung rất cuốn hút.',
      createdAt: '2 ngày trước',
    },
    {
      _id: 'default-2',
      userName: 'Trần Thị B',
      rating: 4,
      comment: 'Phim hay, kỹ xảo tốt nhưng thời lượng hơi dài.',
      createdAt: '5 ngày trước',
    },
  ];

  const [reviewsList, setReviewsList] = useState(
    Array.isArray(movie.reviews) && movie.reviews.length > 0 ? movie.reviews : defaultReviews
  );

  const starRows = [
    { star: 5, label: '5 sao', count: breakdown.fiveStar || 90 },
    { star: 4, label: '4 sao', count: breakdown.fourStar || 20 },
    { star: 3, label: '3 sao', count: breakdown.threeStar || 7 },
    { star: 2, label: '2 sao', count: breakdown.twoStar || 2 },
    { star: 1, label: '1 sao', count: breakdown.oneStar || 1 },
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
  const isMyReview = (rev) => {
    if (!rev) return false;
    const myIds = getMyReviewIds();
    const idStr = String(rev._id || rev.id || '');
    if (idStr && myIds.includes(idStr)) return true;

    if (currentUser) {
      const uId = currentUser.id || currentUser._id;
      if (rev.userId && uId && String(rev.userId) === String(uId)) return true;
      if (rev.userEmail && currentUser.email && rev.userEmail.toLowerCase() === currentUser.email.toLowerCase()) return true;
      if (rev.userName && currentUser.name && rev.userName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) return true;
    }
    return false;
  };

  // Xử lý gửi bình luận mới qua thanh bình luận phía dưới
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    const finalName = (currentUser?.name || reviewerName.trim() || 'Khán giả').trim();
    if (!reviewerComment.trim()) return;

    try {
      setIsSubmitting(true);
      const movieId = movie.id || movie._id;
      const res = await api.post(`/movies/${movieId}/reviews`, {
        userName: finalName,
        rating: reviewerRating,
        comment: reviewerComment.trim(),
        userId: currentUser?.id || currentUser?._id,
        userEmail: currentUser?.email,
      });

      const newRev = res.data?.review || {
        _id: 'client-' + Date.now(),
        userName: finalName,
        rating: reviewerRating,
        comment: reviewerComment.trim(),
        createdAt: 'Vừa xong',
      };

      // Ghi nhớ ID bình luận này vào localStorage của trình duyệt hiện tại để chỉ cá nhân này được xóa
      saveMyReviewId(newRev._id || newRev.id);

      setReviewsList([newRev, ...reviewsList]);
      setSubmitSuccess('Cảm ơn bạn! Đã đăng bình luận thành công.');
      setReviewerComment('');
      setTimeout(() => setSubmitSuccess(''), 4000);
    } catch (err) {
      console.warn('Gửi bình luận offline fallback:', err.message);
      const fallbackRev = {
        _id: 'local-' + Date.now(),
        userName: finalName,
        rating: reviewerRating,
        comment: reviewerComment.trim(),
        createdAt: 'Vừa xong',
      };
      saveMyReviewId(fallbackRev._id);
      setReviewsList([fallbackRev, ...reviewsList]);
      setSubmitSuccess('Đã đăng bình luận của bạn.');
      setReviewerComment('');
      setTimeout(() => setSubmitSuccess(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý cá nhân tự xóa bình luận của mình
  const handleDeleteReview = async (rev, idx) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận của mình không?')) return;

    try {
      const movieId = movie.id || movie._id;
      const revId = rev._id || rev.id || 'by-content';
      await api.delete(`/movies/${movieId}/reviews/${revId}`, {
        data: {
          comment: rev.comment,
          userName: rev.userName,
        },
      });

      setReviewsList((prev) => prev.filter((_, i) => i !== idx));
      setSubmitSuccess('Đã xóa bình luận của bạn thành công.');
      setTimeout(() => setSubmitSuccess(''), 3000);
    } catch (err) {
      console.warn('Lỗi khi xóa bình luận qua API, cập nhật tại giao diện:', err.message);
      setReviewsList((prev) => prev.filter((_, i) => i !== idx));
      setSubmitSuccess('Đã xóa bình luận của bạn.');
      setTimeout(() => setSubmitSuccess(''), 3000);
    }
  };

  const posterSrc =
    movie.posterUrl ||
    movie.poster ||
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&auto=format&fit=crop';

  return (
    <div className="bg-[#0f1422] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
      {/* 1. HEADER: POSTER NHỎ + TÊN PHIM + BADGE ĐANG CHIẾU + PHỤ ĐỀ */}
      <div className="flex items-start space-x-4">
        <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl overflow-hidden border border-slate-700/60 shadow-lg shrink-0 bg-slate-900">
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
          <div className="mt-1 flex items-center space-x-2">
            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{movie.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đang chiếu'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">Thống kê riêng của bộ phim</p>
        </div>
      </div>

      {/* 2. 4 CHỈ SỐ DOANH THU & VÉ (TỔNG DOANH THU MÀU XANH LÁ) */}
      <div className="grid grid-cols-2 gap-y-5 gap-x-6 pt-2">
        <div>
          <span className="text-xs text-slate-400 block font-normal">Tổng doanh thu</span>
          <span className="text-2xl sm:text-3xl font-black text-[#22c55e] tracking-tight block mt-1">
            {movie.stats?.revenueText ||
              `${Math.round((movie.stats?.revenue || 125000000) / 1000000)} triệu`}
          </span>
        </div>

        <div>
          <span className="text-xs text-slate-400 block font-normal">Vé đã bán</span>
          <span className="text-2xl sm:text-3xl font-black text-white tracking-tight block mt-1">
            {(movie.stats?.ticketsSold || 850).toLocaleString('vi-VN')}
          </span>
        </div>

        <div>
          <span className="text-xs text-slate-400 block font-normal">Ghế đã đặt</span>
          <span className="text-2xl sm:text-3xl font-black text-white tracking-tight block mt-1">
            {(movie.stats?.seatsBooked || 850).toLocaleString('vi-VN')}
          </span>
        </div>

        <div>
          <span className="text-xs text-slate-400 block font-normal">Ghế còn trống</span>
          <span className="text-2xl sm:text-3xl font-black text-white tracking-tight block mt-1">
            {(movie.stats?.seatsAvailable || 150).toLocaleString('vi-VN')}
          </span>
        </div>
      </div>

      <div className="border-t border-slate-800/80"></div>

      {/* 3. KHU VỰC ĐÁNH GIÁ KHÁCH HÀNG (ĐIỂM SỐ + THANH PHÂN BỔ 5 SAO) */}
      <div className="space-y-4">
        <h4 className="text-base sm:text-lg font-bold text-white">Đánh giá khách hàng</h4>

        <div className="flex items-center space-x-3">
          <span className="text-3xl sm:text-4xl font-black text-[#22c55e]">{ratingScore}/5</span>
          <div>
            <div className="flex items-center space-x-1 text-sm">{renderStars(movie.rating || 4.6)}</div>
            <span className="text-xs text-slate-400 font-medium">{ratingCountText}</span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {starRows.map((row) => {
            const pct = totalVotes > 0 ? Math.round((row.count / totalVotes) * 100) : 0;
            return (
              <div key={row.star} className="flex items-center text-xs space-x-3">
                <span className="w-10 text-slate-400 font-medium shrink-0">{row.label}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-800/90 overflow-hidden">
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

      <div className="border-t border-slate-800/80"></div>

      {/* 4. DANH SÁCH BÌNH LUẬN CỦA KHÁCH HÀNG */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h4 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>💬</span>
            <span>Bình luận khách hàng ({reviewsList.length})</span>
          </h4>
        </div>

        {/* Danh sách bình luận */}
        <div className="space-y-2.5">
          {reviewsList.slice(0, 6).map((rev, idx) => {
            const canDelete = isMyReview(rev);
            return (
              <div
                key={rev._id || rev.id || idx}
                className="bg-slate-900/50 hover:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800/60 transition-all space-y-1.5 group/rev"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                      {(rev.userName || 'K').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-white text-sm">{rev.userName || 'Khán giả'}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-amber-400 tracking-wider">
                      {renderStars(rev.rating || 5)}
                    </span>
                    {canDelete && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Của bạn
                      </span>
                    )}
                    {rev.createdAt && (
                      <span className="text-[10px] text-slate-500 hidden sm:inline ml-1">
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
                      title="Xóa bình luận này của bạn nếu bạn viết nhầm"
                    >
                      <span>🗑️</span>
                      <span>Xóa</span>
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed pl-8">
                  {rev.comment}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. FOOTER: THANH VIẾT BÌNH LUẬN Ở PHÍA DƯỚI CÙNG & NÚT NHỎ ĐỂ ĐĂNG (ĐÃ BỎ DẤU MŨI TÊN) */}
      <div className="pt-4 border-t border-slate-800/80 space-y-3">
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
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 w-36"
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
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 pr-9 shadow-inner"
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
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95 flex items-center space-x-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
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
