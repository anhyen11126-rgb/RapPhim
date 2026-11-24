import React from 'react';
import StatisticCard from '../components/StatisticCard';
import RevenueChart from '../components/RevenueChart';
import OccupancyChart from '../components/OccupancyChart';
import { formatCurrency, formatNumber } from '../utils/statisticsFormatter';

const OverviewTab = ({ data, loading, onSelectMovie, onSelectShowtime }) => {
  const kpis = data?.kpis || {};
  const occupancy = data?.occupancy || {};
  const topRevenueMovies = data?.topRevenueMovies || [];
  const topTicketsMovies = data?.topTicketsMovies || [];
  const peakHours = data?.peakHours || [];
  const upcomingShowtimes = data?.upcomingShowtimes || [];
  const recentBookings = data?.recentBookings || [];

  return (
    <div className="space-y-6">
      {/* 1. DÃY 6 KPI CARDS CHỦ CHỐT */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* KPI 1: Tổng Doanh Thu Tháng */}
        <StatisticCard
          title={kpis.netRevenue?.title || 'Doanh thu tháng'}
          value={kpis.netRevenue?.formatted || '0 đ'}
          exactValue={kpis.netRevenue?.exactFormatted || ''}
          growth={kpis.netRevenue?.growth}
          tooltip={kpis.netRevenue?.tooltip || 'Tổng doanh thu thực tế sau hoàn tiền trong kỳ'}
          loading={loading}
          icon="💳"
          iconBg="bg-emerald-500/10 text-emerald-400"
        />

        {/* KPI 2: Số Vé Bán Ra Trong Tháng */}
        <StatisticCard
          title={kpis.validTicketsSold?.title || 'Vé đã bán'}
          value={kpis.validTicketsSold?.formatted || '0 vé'}
          exactValue={kpis.validTicketsSold?.value != null ? `${kpis.validTicketsSold.value.toLocaleString('vi-VN')} vé` : ''}
          growth={kpis.validTicketsSold?.growth}
          tooltip={kpis.validTicketsSold?.tooltip || 'Tổng số vé bán ra từ các đơn đặt thành công trong tháng'}
          loading={loading}
          icon="🎟️"
          iconBg="bg-blue-500/10 text-blue-400"
        />

        {/* KPI 3: Số Bộ Phim Đã Chiếu */}
        <StatisticCard
          title={kpis.distinctMovies?.title || 'Phim đã chiếu'}
          value={kpis.distinctMovies?.formatted || '0 phim'}
          exactValue={kpis.distinctMovies?.value != null ? `${kpis.distinctMovies.value} tác phẩm` : ''}
          tooltip={kpis.distinctMovies?.tooltip || 'Số lượng phim khác nhau có suất chiếu phục vụ trong tháng'}
          loading={loading}
          icon="🎬"
          iconBg="bg-purple-500/10 text-purple-400"
        />

        {/* KPI 4: Tổng Số Suất Chiếu */}
        <StatisticCard
          title={kpis.totalShowtimes?.title || 'Tổng suất chiếu'}
          value={kpis.totalShowtimes?.formatted || '0 suất'}
          exactValue={kpis.totalShowtimes?.value != null ? `${kpis.totalShowtimes.value.toLocaleString('vi-VN')} suất chiếu` : ''}
          tooltip={kpis.totalShowtimes?.tooltip || 'Tổng số suất chiếu phim phục vụ khán giả tại rạp trong tháng'}
          loading={loading}
          icon="⏱️"
          iconBg="bg-amber-500/10 text-amber-400"
        />

        {/* KPI 5: Tổng Chi Phí Phát Sinh */}
        <StatisticCard
          title={kpis.totalExpenses?.title || 'Tổng chi phí'}
          value={kpis.totalExpenses?.formatted || '0 đ'}
          exactValue={kpis.totalExpenses?.exactFormatted || ''}
          tooltip={kpis.totalExpenses?.tooltip || 'Tổng chi phí thực tế gồm bản quyền, marketing và vận hành rạp'}
          loading={loading}
          icon="📉"
          iconBg="bg-rose-500/10 text-rose-400"
        />

        {/* KPI 6: Lợi Nhuận Rạp (Lãi/Lỗ Cụ Thể & Biên Lợi Nhuận) */}
        <StatisticCard
          title={kpis.profit?.title || 'Lợi nhuận rạp'}
          value={kpis.profit?.formatted || '0 đ'}
          exactValue={kpis.profit?.exactFormatted || ''}
          growth={kpis.profit?.growth}
          subtitle={kpis.profit?.statusLabel ? `${kpis.profit.statusLabel} (Biên LN ${kpis.profit.margin}%)` : ''}
          tooltip={kpis.profit?.tooltip || 'Lợi nhuận = Doanh thu thuần trừ Tổng chi phí'}
          loading={loading}
          icon={kpis.profit?.status === 'LOSS' ? '⚠️' : '💰'}
          iconBg={kpis.profit?.status === 'LOSS' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}
        />
      </div>

      {/* 2. KHỐI BIỂU ĐỒ DOANH THU & DONUT TỶ LỆ BÁN VÉ / CÔNG SUẤT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (7 cols): Biểu đồ Doanh thu */}
        <div className="lg:col-span-7 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Diễn biến Doanh thu</h3>
              <p className="text-xs text-slate-400">Doanh thu vé xem phim và bắp nước qua các ngày</p>
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
              Dòng tiền thực
            </span>
          </div>

          <RevenueChart data={data?.revenueChartData || []} loading={loading} />
        </div>

        {/* Cột phải (5 cols): Tỷ lệ bán vé trung bình & công suất phòng chiếu */}
        <div className="lg:col-span-5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Tỷ Lệ Bán Vé & Công Suất</h3>
              <p className="text-xs text-slate-400">Hiệu suất lấp đầy ghế bình quân toàn cụm rạp</p>
            </div>
            <span className="text-xs font-semibold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 rounded-lg">
              {occupancy.rate != null ? `Tỷ lệ bán: ${occupancy.rate}%` : '8 Phòng Chiếu'}
            </span>
          </div>

          <OccupancyChart occupancy={occupancy} loading={loading} />

          <div className="pt-2 border-t border-[var(--border-default)]/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Ghế đã bán: <strong className="text-emerald-400 font-bold">{formatNumber(occupancy.booked || 0)}</strong>
            </span>
            <span>
              Ghế trống: <strong className="text-slate-300 font-bold">{formatNumber(occupancy.available || 0)}</strong>
            </span>
            <span>
              Tổng mở bán: <strong className="text-white font-bold">{formatNumber(occupancy.totalSellable || 704)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. KHỐI THÔNG TIN BỔ SUNG: TOP PHIM & KHUNG GIỜ VÀNG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 5 Phim doanh thu cao nhất (6 cols) */}
        <div className="lg:col-span-6 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Top 5 Phim Doanh Thu Cao Nhất</h3>
              <p className="text-xs text-slate-400">Các tác phẩm đạt doanh số ấn tượng trong kỳ</p>
            </div>
            <span className="text-xs font-bold text-red-500">Bảng Xếp Hạng</span>
          </div>

          <div className="space-y-2.5">
            {topRevenueMovies.length > 0 ? (
              topRevenueMovies.map((m, idx) => (
                <div
                  key={m.movieId || idx}
                  onClick={() => onSelectMovie && onSelectMovie(m.movieId)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-surface)]/40 hover:bg-[var(--bg-surface)]/80 border border-slate-700/50 cursor-pointer transition-all group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${idx === 0
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : idx === 1
                            ? 'bg-slate-300 text-slate-950 font-black'
                            : idx === 2
                              ? 'bg-amber-700 text-white font-black'
                              : 'bg-[var(--bg-surface)] text-slate-400'
                        }`}
                    >
                      {idx + 1}
                    </span>
                    <img
                      src={m.poster}
                      alt={m.title}
                      className="w-9 h-12 rounded-lg object-cover shrink-0 border border-slate-700"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate">
                        {m.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatNumber(m.tickets)} vé đã bán</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-emerald-400 block">{formatCurrency(m.revenue)}</span>
                    <span className="text-[10px] text-slate-500">Doanh thu thuần</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">Chưa có số liệu phim</div>
            )}
          </div>
        </div>

        {/* Khung giờ có lượng khách cao nhất & Suất chiếu sắp diễn ra (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Khung giờ vàng */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Khung Giờ Cao Điểm</h3>
                <p className="text-xs text-slate-400">Các khung giờ khán giả đến rạp xem phim nhiều nhất</p>
              </div>
              <span className="text-xs font-bold text-amber-400">Giờ Vàng</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {peakHours.map((slot, idx) => (
                <div
                  key={idx}
                  className="bg-[var(--bg-surface)]/40 border border-slate-700/60 rounded-2xl p-3 text-center space-y-1"
                >
                  <span className="text-[10px] font-semibold text-slate-400 block">{slot.slot}</span>
                  <span className="text-lg font-black text-white block">{formatNumber(slot.tickets)}</span>
                  <span className="text-[10px] text-slate-500 block">vé xem phim</span>
                </div>
              ))}
            </div>
          </div>

          {/* Suất chiếu sắp diễn ra */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
              <h3 className="text-base font-bold text-white">Suất Chiếu Sắp Bắt Đầu</h3>
              <span className="text-xs text-slate-400">Theo thời gian thực</span>
            </div>

            <div className="space-y-2">
              {upcomingShowtimes.slice(0, 3).map((st) => (
                <div
                  key={st.id}
                  onClick={() => onSelectShowtime && onSelectShowtime(st.id)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface)]/40 hover:bg-[var(--bg-surface)]/80 border border-slate-700/40 text-xs cursor-pointer transition-all"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <div className="truncate">
                      <span className="font-bold text-white">{st.movieTitle}</span>
                      <span className="text-slate-400 ml-1.5 font-normal">({st.roomName})</span>
                    </div>
                  </div>
                  <span className="text-amber-400 font-semibold shrink-0">
                    {new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
