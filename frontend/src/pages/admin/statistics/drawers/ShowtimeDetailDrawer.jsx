import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import statisticsApi from '../services/statisticsApi';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';
import { SEAT_LAYOUT_CONFIG, resolveRowAisleSplitCol } from '../../../../components/seat-booking/seatLayout';

const ShowtimeDetailDrawer = ({ showtimeId, onClose, onRequestDelete }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setData(null);
    setError('');
    if (!showtimeId) return;
    let activeController = null;
    let isInFlight = false;
    let requestSeq = 0;
    let isDisposed = false;

    const fetchDetail = async (isSilent = false) => {
      if (isDisposed || (isSilent && (isInFlight || document.hidden))) return;
      isInFlight = true;
      const mySeq = ++requestSeq;
      const controller = new AbortController();
      activeController = controller;

      try {
        if (!isSilent) setLoading(true);
        const res = await statisticsApi.getShowtimeDetail(showtimeId, { signal: controller.signal });
        if (isDisposed || controller.signal.aborted || mySeq !== requestSeq) return;
        if (!res.data?.data) throw new Error('Thiếu dữ liệu suất chiếu');
        setData(res.data.data);
        setError('');
      } catch (err) {
        if (!controller.signal.aborted && err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          setError(err.response?.data?.message || 'Không tải được chi tiết suất chiếu.');
        }
      } finally {
        isInFlight = false;
        if (!isSilent && !isDisposed && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchDetail(false);

    // Tự động đồng bộ thời gian thực mỗi 4 giây khi Drawer mở & tab đang hiển thị
    const syncInterval = setInterval(() => {
      fetchDetail(true);
    }, 4000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDetail(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isDisposed = true;
      if (activeController) activeController.abort();
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showtimeId, retry]);

  if (!showtimeId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Slide-out Drawer Panel */}
      <div className="relative w-full max-w-3xl bg-[var(--bg-secondary)] border-l border-[var(--border-default)] h-full overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl z-10 text-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border-default)] pb-4">
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
          <div className="flex items-center gap-2">
            {data && onRequestDelete && (
              <button
                type="button"
                onClick={() => {
                  onRequestDelete({
                    id: showtimeId,
                    _id: showtimeId,
                    roomName: data.showtime?.roomName,
                    formatFeature: data.showtime?.format,
                    startTime: data.showtime?.startTime,
                    endTime: data.showtime?.endTime,
                    bookedSeats: data.stats?.bookedCount || 0,
                    totalSeats: data.stats?.totalSeats ?? 0,
                    price: data.showtime?.price || 0,
                    movieId: {
                      title: data.showtime?.movieTitle,
                      posterUrl: data.showtime?.moviePosterUrl,
                    },
                  });
                }}
                className="px-3 py-1.5 bg-red-950/70 hover:bg-red-900 border border-red-500/40 text-red-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow-red-900/30"
                title="Xóa hoặc hủy suất chiếu này"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Xóa suất</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[var(--bg-surface)] hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-rose-300">
          <span>{error}</span>
          <button type="button" className="cinema-action rounded-lg px-3 py-2" onClick={() => setRetry((value) => value + 1)}>Thử lại</button>
        </div>}
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
              <div className="bg-[var(--bg-surface)]/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Doanh thu suất</span>
                <span className="text-sm sm:text-base font-bold text-emerald-400 block mt-1">
                  {formatCurrency(data.stats.totalRevenue)}
                </span>
              </div>
              <div className="bg-[var(--bg-surface)]/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Ghế đã đặt</span>
                <span className="text-sm sm:text-base font-bold text-white block mt-1">
                  {data.stats.bookedCount} / {data.stats.totalSeats} ghế
                </span>
              </div>
              <div className="bg-[var(--bg-surface)]/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">
                  Ghế còn đặt được
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-200 block mt-1">
                  {data.stats.bookableAvailableCount} ghế
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Trống đã đóng bán: {data.stats.closedUnsoldCount} ghế
                </span>
              </div>
              {data.stats.holdingCount > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
                  <span className="text-[11px] text-amber-300 block">Đang giữ tạm (10p)</span>
                  <span className="text-sm sm:text-base font-bold text-amber-300 block mt-1">
                    {data.stats.holdingCount} ghế
                  </span>
                </div>
              )}
              <div className="bg-[var(--bg-surface)]/60 border border-slate-700/70 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Tỷ lệ lấp đầy</span>
                <span className="text-sm sm:text-base font-bold text-amber-400 block mt-1">
                  {formatPercent(data.stats.occupancyRate)}
                </span>
              </div>
            </div>

            {data.stats.missingRoom && <p role="status" className="text-amber-300 text-xs">Thiếu dữ liệu phòng chiếu.</p>}
            {!data.stats.hasSeatRecords && <p role="status" className="text-amber-300 text-xs">Thiếu sơ đồ ghế cho suất chiếu.</p>}
            {/* SƠ ĐỒ MA TRẬN 88 GHẾ THỰC TẾ (CHỈ XEM THEO DÕI) */}
            <div className="bg-slate-950 border border-[var(--border-default)] p-5 rounded-2xl space-y-4 text-center">
              <div className="relative mb-5">
                <div className="h-2 w-3/4 mx-auto bg-gradient-to-r from-transparent via-red-600 to-transparent rounded-full shadow-[0_0_12px_rgba(220,38,38,0.5)]"></div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mt-1.5">
                  MÀN HÌNH CHIẾU ({data.showtime.format})
                </span>
              </div>

              {/* Các hàng ghế A -> H (A–G: 12 ghế 6+6, H: 4 ghế 2+2 = 88 ghế, lối đi AISLE chính giữa) */}
              <div className="overflow-x-auto"><div className="space-y-2 min-w-[410px] max-w-xl mx-auto select-none">
                {data.seatMatrix.map((r) => {
                  const ordered = (r.seats || []).slice().sort((a, b) => Number(a.col) - Number(b.col));
                  const aisleAfterCol = resolveRowAisleSplitCol(ordered);
                  const leftSeats = ordered.filter((s) => Number(s.col) <= aisleAfterCol);
                  const rightSeats = ordered.filter((s) => Number(s.col) > aisleAfterCol);
                  const renderAdminSeat = (s) => {
                    const isBooked = s.status === 'BOOKED';
                    const isHolding = s.status === 'HOLDING';
                    return (
                      <div
                        key={s.code}
                        title={`${s.code} (${s.type}) - ${isBooked ? 'Đã đặt' : isHolding ? 'Đang giữ tạm (10p)' : data.showtime.isBookableUpcoming ? 'Còn đặt được' : 'Trống, đã đóng bán'}`}
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md text-[9px] font-bold flex items-center justify-center pointer-events-none transition-all ${
                          isBooked
                            ? 'bg-red-600 text-white border border-red-500 shadow-sm shadow-red-600/30'
                            : isHolding
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-400/60 shadow-sm shadow-amber-500/20'
                            : s.type === 'VIP'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : s.type === 'SWEETBOX'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-[var(--bg-surface)] text-slate-300 border border-slate-700'
                        }`}
                      >
                        {s.code}
                      </div>
                    );
                  };

                  return (
                    <div key={r.row} className="grid grid-cols-[1.25rem_1fr_2.25rem_1fr_1.25rem] items-center gap-1.5">
                      <span className="text-right font-mono font-bold text-xs text-slate-400">{r.row}</span>
                      <div className="flex items-center justify-end gap-1.5">{leftSeats.map(renderAdminSeat)}</div>
                      <div className="flex items-center justify-center select-none text-[8px] font-black text-slate-500 tracking-wider">
                        AISLE
                      </div>
                      <div className="flex items-center justify-start gap-1.5">{rightSeats.map(renderAdminSeat)}</div>
                      <span className="text-left font-mono font-bold text-xs text-slate-400">{r.row}</span>
                    </div>
                  );
                })}
              </div>

              </div>
              {/* Chú giải trạng thái ghế */}
              <div className="flex flex-wrap items-center justify-center gap-3.5 text-xs text-slate-400 pt-4 border-t border-[var(--border-default)]">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-red-600 border border-red-500"></span>
                  <span>Đã đặt ({data.stats.bookedCount})</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500/25 border border-amber-400/60"></span>
                  <span>Đang giữ tạm ({data.stats.holdingCount || 0})</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-[var(--bg-surface)] border border-slate-700 text-slate-300"></span>
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
                    <thead className="bg-[var(--bg-surface)] text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
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
                        <tr key={b.id} className="hover:bg-[var(--bg-surface)]/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-white">{b.bookingCode}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">{b.customerName}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{b.customerPhone}</td>
                          <td className="py-2.5 px-3 font-semibold text-amber-400">{b.seats}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-400">
                            {formatCurrency(b.totalAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-slate-700 text-slate-300">
                              {b.paymentMethod}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 bg-[var(--bg-surface)]/20 rounded-xl border border-[var(--border-default)]">
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
