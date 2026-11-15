import React, { useState, useEffect } from 'react';
import statisticsApi from '../services/statisticsApi';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const MovieDetailDrawer = ({ movieId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!movieId) return;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await statisticsApi.getMovieDetail(movieId);
        if (res.data?.data) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Lỗi nạp chi tiết thống kê phim:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [movieId]);

  if (!movieId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Slide-out Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl z-10 text-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Hồ sơ phân tích</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">Dữ liệu thời gian thực</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {data?.movie?.title || 'Chi tiết phim'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Đang tải phân tích tác phẩm...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Không tìm thấy thông tin chi tiết cho bộ phim này.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Banner tóm tắt phim */}
            <div className="flex gap-4 p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60">
              <img
                src={data.movie.poster}
                alt={data.movie.title}
                className="w-24 h-36 rounded-xl object-cover shrink-0 border border-slate-700 shadow"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                }}
              />
              <div className="space-y-1.5 flex-1 min-w-0 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="bg-red-600/20 text-red-400 border border-red-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                    {data.movie.ageRating}
                  </span>
                  <span className="text-amber-400 font-bold">★ {data.movie.rating}</span>
                  <span className="text-slate-400">({data.movie.ratingCount})</span>
                </div>
                <div className="text-slate-300">
                  <strong>Thời lượng:</strong> {data.movie.duration} phút
                </div>
                <div className="text-slate-300">
                  <strong>Thể loại:</strong> {data.movie.genre}
                </div>
                {data.movie.director && (
                  <div className="text-slate-300 truncate">
                    <strong>Đạo diễn:</strong> {data.movie.director}
                  </div>
                )}
                {data.movie.cast && (
                  <div className="text-slate-400 line-clamp-2">
                    <strong>Diễn viên:</strong> {data.movie.cast}
                  </div>
                )}
              </div>
            </div>

            {/* Dãy 4 Chỉ số KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Doanh thu thuần</span>
                <span className="text-sm sm:text-base font-bold text-emerald-400 block mt-1">
                  {formatCurrency(data.stats.totalRevenue)}
                </span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Vé đã bán</span>
                <span className="text-sm sm:text-base font-bold text-white block mt-1">
                  {formatNumber(data.stats.totalTickets)} vé
                </span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Số suất chiếu</span>
                <span className="text-sm sm:text-base font-bold text-white block mt-1">
                  {formatNumber(data.stats.showtimesCount)} suất
                </span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Lấp đầy TB</span>
                <span className="text-sm sm:text-base font-bold text-amber-400 block mt-1">
                  {formatPercent(data.stats.avgOccupancy)}
                </span>
              </div>
            </div>

            {/* Phân bố đánh giá sao */}
            <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Phân bố đánh giá khán giả</span>
                <span className="text-amber-400">Điểm trung bình: {data.movie.rating} / 5.0</span>
              </div>

              <div className="space-y-1.5 text-xs">
                {[5, 4, 3, 2, 1].map((star) => {
                  const keyMap = { 5: 'fiveStar', 4: 'fourStar', 3: 'threeStar', 2: 'twoStar', 1: 'oneStar' };
                  const count = data.ratingBreakdown[keyMap[star]] || 0;
                  const totalCount =
                    Object.values(data.ratingBreakdown).reduce((a, b) => a + b, 0) || 100;
                  const pct = Math.round((count / totalCount) * 100);

                  return (
                    <div key={star} className="flex items-center space-x-2">
                      <span className="w-8 font-semibold text-slate-400">{star} ★</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                      <span className="w-12 text-right text-slate-400 text-[11px]">
                        {count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Danh sách suất chiếu gần nhất của phim */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Các suất chiếu phục vụ ({data.showtimesList?.length || 0})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {(data.showtimesList || []).map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white">{st.roomName}</span>
                      <span className="text-slate-400 ml-2">({st.cinemaName})</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-300">
                        {new Date(st.startTime).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(st.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nhận xét thực tế của khách hàng */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Nhận xét xác thực từ khán giả ({data.reviews?.length || 0})
              </h4>
              <div className="space-y-2">
                {(data.reviews || []).slice(0, 4).map((rev, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-white">{rev.userName || 'Khán giả xem rạp'}</strong>
                      <span className="text-amber-400 font-bold">★ {rev.rating}</span>
                    </div>
                    <p className="text-slate-300 italic">"{rev.comment}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieDetailDrawer;
