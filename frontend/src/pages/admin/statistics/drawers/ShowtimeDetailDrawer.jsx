import React, { useState, useEffect } from 'react';
import statisticsApi from '../services/statisticsApi';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const ShowtimeDetailDrawer = ({ showtimeId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!showtimeId) return;
    const fetchDetail = async (isSilent = false) => {
      try {
        if (!isSilent) setLoading(true);
        const res = await statisticsApi.getShowtimeDetail(showtimeId);
        if (res.data?.data) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Lỗi nạp chi tiết suất chiếu:', err);
      } finally {
        if (!isSilent) setLoading(false);
      }
    };

    fetchDetail(false);

    // Tự động đồng bộ liên tục thời gian thực mỗi 4 giây cho Admin
    const syncInterval = setInterval(() => {
      fetchDetail(true);
    }, 4000);

    return () => clearInterval(syncInterval);
  }, [showtimeId]);

  if (!showtimeId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Slide-out Drawer Panel */}
      <div className="relative w-full max-w-3xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl z-10 text-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Chi tiết suất chiếu</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">Theo dõi trực tiếp (Read-only)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {data?.showtime?.movieTitle || 'Suất chiếu'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {data?.showtime?.roomName} • {data?.showtime?.cinemaName} • {data?.showtime?.format}
            </p>
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
            <p className="text-xs text-slate-400">Đang tải trạng thái suất chiếu & sơ đồ ghế...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Không tìm thấy thông tin suất chiếu yêu cầu.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dãy KPI tóm tắt */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Doanh thu suất</span>
                <span className="text-sm sm:text-base font-bold text-emerald-400 block mt-1">
                  {formatCurrency(data.stats.totalRevenue)}
                </span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Ghế đã đặt</span>
                <span className="text-sm sm:text-base font-bold text-white block mt-1">
                  {data.stats.bookedCount} / {data.stats.totalSeats} ghế
                </span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Ghế còn trống</span>
                <span className="text-sm sm:text-base font-bold text-slate-200 block mt-1">
                  {data.stats.availableCount} ghế
                </span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Tỷ lệ lấp đầy</span>
                <span className="text-sm sm:text-base font-bold text-amber-400 block mt-1">
                  {formatPercent(data.stats.occupancyRate)}
                </span>
              </div>
            </div>

            {/* SƠ ĐỒ MA TRẬN 88 GHẾ THỰC TẾ (CHỈ XEM THEO DÕI) */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4 text-center">
              <div className="relative mb-5">
                <div className="h-2 w-3/4 mx-auto bg-gradient-to-r from-transparent via-red-600 to-transparent rounded-full shadow-[0_0_12px_rgba(220,38,38,0.5)]"></div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mt-1.5">
                  MÀN HÌNH CHIẾU ({data.showtime.format})
                </span>
              </div>

              {/* Các hàng ghế A -> H */}
              <div className="space-y-2 max-w-xl mx-auto select-none">
                {data.seatMatrix.map((r) => {
                  const isRowH = r.row === 'H';
                  return (
                    <div key={r.row} className="flex items-center justify-center space-x-2">
                      <span className="w-5 text-right font-mono font-bold text-xs text-slate-400">{r.row}</span>
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {r.seats.map((s, idx) => {
                          const isBooked = s.status === 'BOOKED';
                          const isAisleBreak = (isRowH && idx === 2) || (!isRowH && idx === 6);

                          return (
                            <React.Fragment key={s.code}>
                              {isAisleBreak && (
                                <div className="w-6 flex items-center justify-center select-none text-[8px] font-black text-slate-500 tracking-wider">
                                  AISLE
                                </div>
                              )}
                              <div
                                title={`${s.code} (${s.type}) - ${isBooked ? 'Đã đặt' : 'Còn trống'}`}
                                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md text-[9px] font-bold flex items-center justify-center pointer-events-none transition-all ${
                                  isBooked
                                    ? 'bg-red-600 text-white border border-red-500 shadow-sm shadow-red-600/30'
                                    : s.type === 'VIP'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : s.type === 'SWEETBOX'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {s.code}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <span className="w-5 text-left font-mono font-bold text-xs text-slate-400">{r.row}</span>
                    </div>
                  );
                })}
              </div>

              {/* Chú giải trạng thái ghế */}
              <div className="flex flex-wrap items-center justify-center gap-3.5 text-xs text-slate-400 pt-4 border-t border-slate-800">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-red-600 border border-red-500"></span>
                  <span>Đã đặt ({data.stats.bookedCount})</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700 text-slate-300"></span>
                  <span>Ghế Thường trống (A-D)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300"></span>
                  <span>Ghế VIP trống (E-G)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300"></span>
                  <span>Sweetbox đôi trống (H)</span>
                </span>
              </div>
            </div>

            {/* DANH SÁCH VÉ ĐÃ ĐẶT TRONG SUẤT NÀY */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Giao dịch đặt vé trong ca này ({data.bookings?.length || 0} đơn)
              </h4>

              {data.bookings && data.bookings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Mã đơn</th>
                        <th className="py-2.5 px-3">Khách hàng</th>
                        <th className="py-2.5 px-3">Số ĐT</th>
                        <th className="py-2.5 px-3">Ghế đã đặt</th>
                        <th className="py-2.5 px-3">Tổng tiền</th>
                        <th className="py-2.5 px-3 text-right">Hình thức</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-white">{b.bookingCode}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">{b.customerName}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{b.customerPhone}</td>
                          <td className="py-2.5 px-3 font-semibold text-amber-400">{b.seats}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-400">
                            {formatCurrency(b.totalAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                              {b.paymentMethod}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-800/20 rounded-xl border border-slate-800">
                  Chưa có giao dịch đặt vé nào cho suất chiếu này.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowtimeDetailDrawer;
