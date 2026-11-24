import React, { useState, useMemo } from 'react';
import StatisticCard from '../components/StatisticCard';
import { formatNumber } from '../utils/statisticsFormatter';

const ReviewsTab = ({ reviewsData, loading, onSelectMovie }) => {
  const [selectedStarFilter, setSelectedStarFilter] = useState('ALL');
  const [selectedMovieId, setSelectedMovieId] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const metrics = reviewsData?.metrics || {};
  const starDistribution = reviewsData?.starDistribution || [];
  const movies = reviewsData?.movies || [];

  // Gom toàn bộ nhận xét chi tiết của các phim
  const allReviews = useMemo(() => {
    const list = [];
    movies.forEach((m) => {
      if (Array.isArray(m.reviews)) {
        m.reviews.forEach((r) => {
          list.push({
            ...r,
            movieId: m.id,
            movieTitle: m.title,
            moviePoster: m.poster,
          });
        });
      }
    });
    return list;
  }, [movies]);

  // Bộ lọc nhận xét
  const filteredReviews = useMemo(() => {
    return allReviews.filter((r) => {
      const matchStar = selectedStarFilter === 'ALL' || Number(r.rating) === Number(selectedStarFilter);
      const matchMovie = selectedMovieId === 'ALL' || r.movieId === selectedMovieId;
      const matchSearch =
        !searchTerm.trim() ||
        (r.userName && r.userName.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
        (r.comment && r.comment.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
        (r.movieTitle && r.movieTitle.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      return matchStar && matchMovie && matchSearch;
    });
  }, [allReviews, selectedStarFilter, selectedMovieId, searchTerm]);

  const totalPages = Math.ceil(filteredReviews.length / pageSize) || 1;
  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReviews.slice(start, start + pageSize);
  }, [filteredReviews, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* 1. DÃY 4 KPI CHỦ CHỐT */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatisticCard
          title="Điểm Đánh Giá Trung Bình"
          value={`${metrics.avgRating || 4.8} / 5.0`}
          tooltip="Điểm trung bình cộng có trọng số dựa trên toàn bộ lượt đánh giá khán giả"
          loading={loading}
          icon="⭐"
          iconBg="bg-amber-500/10 text-amber-400"
        />

        <StatisticCard
          title="Tổng Số Lượt Đánh Giá"
          value={`${formatNumber(metrics.totalReviews || 0)} lượt`}
          tooltip="Tổng số lượt vote sao và phản hồi từ khán giả đã xem phim"
          loading={loading}
          icon="📝"
          iconBg="bg-blue-500/10 text-blue-400"
        />

        <StatisticCard
          title="Tác Phẩm Đánh Giá Cao Nhất"
          value={metrics.topRatedMovie?.title || 'Dune 2'}
          tooltip="Phim đạt rating cao nhất (đáp ứng điều kiện tối thiểu từ 2 lượt đánh giá trở lên)"
          loading={loading}
          icon="🏆"
          iconBg="bg-emerald-500/10 text-emerald-400"
        />

        <StatisticCard
          title="Phim Nhiều Đánh Giá Nhất"
          value={metrics.mostReviewedMovie?.title || 'Spider-Man'}
          tooltip="Tác phẩm thu hút lượng khán giả để lại nhận xét đông đảo nhất"
          loading={loading}
          icon="🔥"
          iconBg="bg-red-500/10 text-red-400"
        />
      </div>

      {/* 2. PHÂN BỐ SAO & BẢNG ĐÁNH GIÁ THEO PHIM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Phân bố 1-5 sao toàn hệ thống (5 cols) */}
        <div className="lg:col-span-5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Phân Bố Sao Đánh Giá</h3>
              <p className="text-xs text-slate-400">Tỷ trọng các mức sao trên toàn hệ thống</p>
            </div>
            <span className="text-xs font-bold text-amber-400">{metrics.avgRating || 4.8} ★</span>
          </div>

          <div className="space-y-3 pt-2">
            {starDistribution.map((row) => (
              <div key={row.star} className="flex items-center text-xs space-x-3">
                <span className="w-10 font-bold text-amber-400 shrink-0">{row.star} ★</span>
                <div className="flex-1 h-3 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, row.percent)}%` }}
                  ></div>
                </div>
                <span className="w-20 text-right text-slate-300 font-semibold shrink-0">
                  {formatNumber(row.count)} <span className="text-slate-500 text-[10px]">({row.percent}%)</span>
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 pt-3 border-t border-[var(--border-default)]/80 leading-relaxed">
            🛡️ <strong className="text-white">Xác thực 100%:</strong> Chỉ những tài khoản đã mua vé thành công và hoàn tất suất chiếu mới được ghi nhận đánh giá vào cơ sở dữ liệu.
          </p>
        </div>

        {/* Bảng Đánh Giá Theo Phim (7 cols) */}
        <div className="lg:col-span-7 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Bảng Đánh Giá Từng Bộ Phim</h3>
              <p className="text-xs text-slate-400">Điểm số và phân bổ đánh giá chi tiết theo từng tác phẩm</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">{movies.length} Phim</span>
          </div>

          <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Phim</th>
                  <th className="py-2.5 px-3 text-center">Điểm TB</th>
                  <th className="py-2.5 px-3 text-center">Tổng nhận xét</th>
                  <th className="py-2.5 px-3 text-center">5 sao</th>
                  <th className="py-2.5 px-3 text-center">4 sao</th>
                  <th className="py-2.5 px-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {movies.map((m) => (
                  <tr key={m.id} className="hover:bg-[var(--bg-surface)]/40">
                    <td className="py-2.5 px-3 font-semibold text-white truncate max-w-[200px]">
                      {m.title}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-400">
                      ★ {m.rating}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-200">
                      {formatNumber(m.totalReviews)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-400">
                      {m.breakdown?.fiveStar || 0}
                    </td>
                    <td className="py-2.5 px-3 text-center text-blue-400">
                      {m.breakdown?.fourStar || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectMovie && onSelectMovie(m.id)}
                        className="text-xs text-red-400 hover:text-white font-semibold"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. DANH SÁCH NHẬN XÉT THỰC TẾ & BỘ LỌC */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-default)]/80 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Nhận Xét Thực Tế Của Khán Giả</h3>
            <p className="text-xs text-slate-400">
              Bộ lọc phản hồi của khán giả theo số sao và tác phẩm xem rạp ({filteredReviews.length} nhận xét)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Lọc theo sao */}
            <div className="flex items-center space-x-1 bg-[var(--bg-surface)] rounded-xl p-1 text-xs">
              {['ALL', '5', '4', '3', '2', '1'].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedStarFilter(star)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    selectedStarFilter === star
                      ? 'bg-red-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {star === 'ALL' ? 'Tất cả' : `${star}★`}
                </button>
              ))}
            </div>

            {/* Ô tìm kiếm nhận xét */}
            <input
              type="text"
              placeholder="Tìm theo nội dung..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 w-44"
            />
          </div>
        </div>

        {/* Lưới các thẻ nhận xét thực tế */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedReviews.length > 0 ? (
            paginatedReviews.map((rev, idx) => {
              const reviewDateStr = rev.createdAt
                ? new Date(rev.createdAt).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : 'Gần đây';

              return (
                <div
                  key={idx}
                  className="bg-[var(--bg-surface)]/40 border border-slate-700/60 rounded-2xl p-4 space-y-2.5 text-xs hover:border-slate-600 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 font-bold flex items-center justify-center shrink-0">
                        {rev.userName ? rev.userName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <strong className="text-white block">{rev.userName || 'Khán giả xem rạp'}</strong>
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                          <span className="truncate max-w-[130px]">{rev.movieTitle}</span>
                          <span>•</span>
                          <span className="text-slate-500">{reviewDateStr}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-amber-400 font-black shrink-0 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded text-[11px]">
                      ★ {rev.rating}
                    </span>
                  </div>

                  <p className="text-slate-300 italic line-clamp-3 leading-relaxed">
                    "{rev.comment}"
                  </p>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-xs text-slate-500">
              Không tìm thấy nhận xét nào phù hợp với bộ lọc.
            </div>
          )}
        </div>

        {/* Phân trang nhận xét */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-default)] text-xs text-slate-400">
            <span>Trang {currentPage} / {totalPages} (Tổng {filteredReviews.length} nhận xét)</span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                    currentPage === i + 1 ? 'bg-red-600 text-white' : 'bg-[var(--bg-surface)] text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewsTab;
