import React, { useState } from 'react';
import api from '../../services/api';

const MovieStatsReviewsSection = ({ movie, onScrollToBooking }) => {
  if (!movie) return null;

  // Trạng thái mở form viết nhận xét của khách
  const [isAddingReview, setIsAddingReview] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerRating, setReviewerRating] = useState(5);
  const [reviewerComment, setReviewerComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');

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

  // Danh sách nhận xét khách hàng
  const defaultReviews = [
    {
      userName: 'Nguyễn Văn A',
      rating: 5,
      comment: 'Hình ảnh đẹp, âm thanh sống động, nội dung rất cuốn hút.',
      createdAt: '2 ngày trước',
    },
    {
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

  // Xử lý gửi nhận xét mới
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewerName.trim() || !reviewerComment.trim()) return;

    try {
      setIsSubmitting(true);
      const movieId = movie.id || movie._id;
      const res = await api.post(`/movies/${movieId}/reviews`, {
        userName: reviewerName.trim(),
        rating: reviewerRating,
        comment: reviewerComment.trim(),
      });

      const newRev = res.data?.review || {
        userName: reviewerName.trim(),
        rating: reviewerRating,
        comment: reviewerComment.trim(),
        createdAt: 'Vừa xong',
      };

      setReviewsList([newRev, ...reviewsList]);
      setSubmitSuccess('Cảm ơn bạn! Đánh giá đã được ghi nhận vào hệ thống.');
      setReviewerName('');
      setReviewerComment('');
      setReviewerRating(5);
      setIsAddingReview(false);
      setTimeout(() => setSubmitSuccess(''), 4000);
    } catch (err) {
      console.warn('Gửi nhận xét offline fallback:', err.message);
      // Fallback lưu trực tiếp tại client nếu backend gặp lỗi
      const fallbackRev = {
        userName: reviewerName.trim(),
        rating: reviewerRating,
        comment: reviewerComment.trim(),
        createdAt: 'Vừa xong',
      };
      setReviewsList([fallbackRev, ...reviewsList]);
      setSubmitSuccess('Cảm ơn bạn đã gửi đánh giá cho bộ phim!');
      setReviewerName('');
      setReviewerComment('');
      setIsAddingReview(false);
      setTimeout(() => setSubmitSuccess(''), 4000);
    } finally {
      setIsSubmitting(false);
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
          <p className="text-xs text-slate-400 mt-1 font-medium">Đánh giá & nhận xét của khán giả</p>
        </div>
      </div>

      {/* ĐÁNH GIÁ KHÁCH HÀNG & THANH PHÂN BỔ SAO */}
      <div className="space-y-4">
        <h4 className="text-base sm:text-lg font-bold text-white">Đánh giá khách hàng</h4>

        {/* Điểm số và mức độ hài lòng */}
        <div className="flex items-center space-x-4">
          <span className="text-3xl sm:text-4xl font-black text-[#22c55e] leading-none">
            {ratingScore}/5
          </span>
          <div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-300">
              <span className="text-amber-400 text-sm tracking-widest leading-none">★★★★★</span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-slate-200">{ratingCountText}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Mức độ hài lòng của khách hàng</p>
          </div>
        </div>

        {/* Các thanh tỷ lệ sao từ 5 sao xuống 1 sao */}
        <div className="space-y-2 pt-1">
          {starRows.map((row) => {
            const pct = Math.round((row.count / totalVotes) * 100);
            return (
              <div key={row.star} className="flex items-center text-xs">
                <span className="w-12 text-slate-300 font-medium shrink-0">{row.label}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-800/90 overflow-hidden mx-3">
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

      {/* 4. NHẬN XÉT KHÁCH HÀNG & NÚT VIẾT ĐÁNH GIÁ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base sm:text-lg font-bold text-white">Nhận xét khách hàng</h4>
          <button
            type="button"
            onClick={() => setIsAddingReview(!isAddingReview)}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/30 px-3 py-1.5 rounded-xl transition-all"
          >
            {isAddingReview ? 'Đóng' : '✏️ Viết nhận xét'}
          </button>
        </div>

        {submitSuccess && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 animate-fadeIn">
            ✓ {submitSuccess}
          </div>
        )}

        {/* Form nhập nhận xét mới */}
        {isAddingReview && (
          <form
            onSubmit={handleSubmitReview}
            className="bg-[#141b2d] border border-blue-500/40 rounded-2xl p-4 space-y-3 animate-fadeIn"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Họ và tên của bạn:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lê Minh Trí"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full bg-[#0d121f] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Số sao:</label>
                <select
                  value={reviewerRating}
                  onChange={(e) => setReviewerRating(Number(e.target.value))}
                  className="bg-[#0d121f] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-400 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={5}>★★★★★ (5 sao - Xuất sắc)</option>
                  <option value={4}>★★★★☆ (4 sao - Rất hay)</option>
                  <option value={3}>★★★☆☆ (3 sao - Khá)</option>
                  <option value={2}>★★☆☆☆ (2 sao - Trung bình)</option>
                  <option value={1}>★☆☆☆☆ (1 sao - Kém)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Nhận xét chi tiết về phim:
              </label>
              <textarea
                required
                rows={2}
                placeholder="Chia sẻ cảm nhận của bạn về diễn xuất, âm thanh, hình ảnh..."
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                className="w-full bg-[#0d121f] border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingReview(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Đang gửi...' : 'Gửi nhận xét'}
              </button>
            </div>
          </form>
        )}

        {/* Danh sách nhận xét */}
        <div className="space-y-4">
          {reviewsList.slice(0, 4).map((rev, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-bold text-white text-sm">{rev.userName || 'Khán giả'}</span>
                <span className="text-slate-500">•</span>
                <span className="text-amber-400 tracking-wider">
                  {renderStars(rev.rating || 5)}
                </span>
                {rev.createdAt && (
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {typeof rev.createdAt === 'string'
                      ? rev.createdAt
                      : new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                {rev.comment}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. FOOTER: GHI CHÚ MINH HỌA & NÚT TRÒN CUỘN XUỐNG ĐẶT VÉ (THEO ĐÚNG MOCKUP) */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <p className="text-[11px] text-slate-400 font-medium italic">
          Số liệu minh họa, không phải dữ liệu thực tế.
        </p>

        {/* Nút tròn có mũi tên xuống như trong ảnh người dùng gửi */}
        <button
          type="button"
          onClick={() => {
            if (onScrollToBooking) {
              onScrollToBooking();
            } else {
              const el = document.getElementById('showtimes-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 text-white flex items-center justify-center transition-all duration-200 shadow-md active:scale-95 group/arrow"
          title="Cuộn xuống xem lịch và đặt vé"
        >
          <span className="text-base group-hover/arrow:translate-y-0.5 transition-transform duration-200">
            ↓
          </span>
        </button>
      </div>
    </div>
  );
};

export default MovieStatsReviewsSection;
