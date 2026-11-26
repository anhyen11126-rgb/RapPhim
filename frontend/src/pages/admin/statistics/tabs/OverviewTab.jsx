import React from 'react';
import StatisticCard from '../components/StatisticCard';
import RevenueChart from '../components/RevenueChart';
import OccupancyChart from '../components/OccupancyChart';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const ROOM_TYPE_COLORS = {
  'IMAX Laser': {
    badge: 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40',
    bar: 'bg-cyan-400',
    text: 'text-cyan-300',
  },
  'Dolby Atmos': {
    badge: 'bg-purple-950/70 text-purple-300 border-purple-500/40',
    bar: 'bg-purple-400',
    text: 'text-purple-300',
  },
  'Gold Class': {
    badge: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
    bar: 'bg-amber-400',
    text: 'text-amber-300',
  },
};

const OverviewTab = ({
  data,
  loading,
  error,
  onRetry,
  onSelectMovie,
  onSelectShowtime,
}) => {
  if (!loading && error) {
    return (
      <div
        role="alert"
        className="bg-rose-950/40 border border-rose-500/40 rounded-3xl p-8 text-center space-y-4 shadow-xl"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-2xl">
          ⚠️
        </div>
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-white">Không tải được báo cáo tổng hợp</h3>
          <p className="text-xs text-rose-200/80 max-w-md mx-auto">
            {error || 'Đã xảy ra lỗi khi kết nối tới máy chủ thống kê. Hệ thống không hiển thị số 0 giả khi API gặp sự cố.'}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl cinema-action text-white text-xs font-bold shadow-lg cursor-pointer"
          >
            Thử lại ngay
          </button>
        )}
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const occupancy = data?.occupancy || {};
  const cinemaCapacity = data?.cinemaCapacity || {};
  const mom = data?.momComparison || {};
  const roomOccupancyBreakdown = data?.roomOccupancyBreakdown || [];
  const roomTypeBreakdown = data?.roomTypeBreakdown || [];
  const topRevenueMovies = data?.topRevenueMovies || [];
  const peakHours = data?.peakHours || [];
  const upcomingShowtimes = data?.upcomingShowtimes || [];
  const revenueSplit = data?.revenueSplitByPaymentStatus || {};

  const physicalRoomsCount = cinemaCapacity.physicalRoomsCount || occupancy.roomCount || 9;
  const totalPhysicalSeats = cinemaCapacity.totalPhysicalSeats || occupancy.totalPhysicalSeats || 792;

  const isSimulatedMode =
    data?.isSimulatedMode ??
    ((data?.paymentCounts?.SIMULATED || 0) > 0 && (data?.paymentCounts?.VERIFIED || 0) === 0);

  const revenueBadgeLabel =
    data?.revenueSourceBadge || (isSimulatedMode ? 'Doanh thu mô phỏng' : 'Dòng tiền thực');

  const profitValueColor = !data?.profitKnown
    ? 'text-amber-300'
    : kpis.profit?.status === 'LOSS'
      ? 'text-rose-400'
      : 'text-emerald-400';

  const occupancyDisplayRate =
    occupancy.rate != null
      ? formatPercent(occupancy.rate, 2)
      : occupancy.totalSellable > 0
        ? formatPercent((occupancy.booked / occupancy.totalSellable) * 100, 2)
        : '0%';

  return (
    <div className="space-y-6">
      {/* Thanh trạng thái đối soát giao dịch SIMULATED / VERIFIED & cấu hình 9 phòng vật lý */}
      {!loading && data && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/80 bg-[var(--bg-secondary)]/90 px-4 py-3 text-xs text-slate-300 shadow">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-cyan-300">
              Cấu hình rạp chuẩn: {physicalRoomsCount} phòng chiếu vật lý × 88 ghế = {formatNumber(totalPhysicalSeats)} ghế vật lý
            </span>
            <span className="text-slate-600">|</span>
            <span>
              Kỳ báo cáo: <strong className="text-white">{data.timeRangeLabel}</strong>
            </span>
            {cinemaCapacity.missingSeatShowtimesCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 font-semibold">
                Cảnh báo: {cinemaCapacity.missingSeatShowtimesCount} suất thiếu dữ liệu ShowtimeSeat
              </span>
            )}
          </div>
          {data.paymentCounts && (
            <div className="flex flex-wrap items-center gap-3 text-slate-400">
              <span>
                Đã xác minh (VERIFIED):{' '}
                <strong className="text-emerald-400">
                  {data.paymentCounts.VERIFIED ?? 0} đơn ({revenueSplit.verifiedRevenueFormatted || '0 ₫'})
                </strong>
              </span>
              <span>·</span>
              <span>
                Mô phỏng (SIMULATED):{' '}
                <strong className="text-purple-300">
                  {data.paymentCounts.SIMULATED ?? 0} đơn ({revenueSplit.simulatedRevenueFormatted || kpis.netRevenue?.exactFormatted || '0 ₫'})
                </strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Cảnh báo nghiệp vụ nếu kỳ báo cáo có > 3 bộ phim phát sinh lịch chiếu */}
      {!loading && data?.schedulePolicyWarning && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-xs text-amber-200 flex items-center justify-between">
          <span>⚠️ {data.schedulePolicyWarning}</span>
        </div>
      )}

      {/* Trạng thái Empty khi kỳ được chọn hoàn toàn chưa có dữ liệu */}
      {!loading && data && !data.hasActivityInPeriod && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-200 flex items-center justify-between">
          <span>
            ℹ️ Chưa có dữ liệu giao dịch hoặc suất chiếu trong kỳ <strong>{data.timeRangeLabel}</strong>. Bạn có thể chọn kỳ báo cáo khác (ví dụ Tháng 11/2026) để xem số liệu hoạt động.
          </span>
        </div>
      )}

      {/* 1. DÃY 6 KPI CARDS CHỦ CHỐT */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* KPI 1: Doanh Thu Thuần */}
        <StatisticCard
          title={kpis.netRevenue?.title || 'Doanh thu thuần'}
          value={kpis.netRevenue?.formatted || '0 ₫'}
          exactValue={
            kpis.netRevenue?.value != null
              ? `Vé: ${kpis.netRevenue?.ticketRevenueFormatted || '0 ₫'} | Combo: ${kpis.netRevenue?.concessionRevenueFormatted || '0 ₫'}`
              : ''
          }
          growth={kpis.netRevenue?.growth}
          subtitle={kpis.netRevenue?.subtitle}
          showGrowthNA={kpis.netRevenue?.growth === null && !kpis.netRevenue?.subtitle}
          tooltip={kpis.netRevenue?.tooltip}
          loading={loading}
          icon="💳"
          iconBg="bg-emerald-500/10 text-emerald-400"
        />

        {/* KPI 2: Vé Hợp Lệ Đã Bán */}
        <StatisticCard
          title={kpis.validTicketsSold?.title || 'Vé hợp lệ đã bán'}
          value={kpis.validTicketsSold?.formatted || '0 vé'}
          exactValue={
            kpis.validTicketsSold
              ? `${formatNumber(kpis.validTicketsSold.successfulOrders || 0)} đơn hợp lệ`
              : ''
          }
          growth={kpis.validTicketsSold?.growth}
          subtitle={kpis.validTicketsSold?.subtitle}
          showGrowthNA={kpis.validTicketsSold?.growth === null && !kpis.validTicketsSold?.subtitle}
          tooltip={kpis.validTicketsSold?.tooltip}
          loading={loading}
          icon="🎟️"
          iconBg="bg-cyan-500/10 text-cyan-400"
        />

        {/* KPI 3: Phim Có Lịch Chiếu */}
        <StatisticCard
          title={kpis.distinctMovies?.title || 'Phim có lịch chiếu'}
          value={kpis.distinctMovies?.formatted || '0 phim'}
          exactValue={
            kpis.distinctMovies
              ? `${kpis.distinctMovies.screenedMoviesCount || 0} phim đã/đang chiếu trong kỳ`
              : ''
          }
          subtitle="Tính từ suất chiếu thực tế"
          tooltip={kpis.distinctMovies?.tooltip}
          loading={loading}
          icon="🎬"
          iconBg="bg-purple-500/10 text-purple-400"
        />

        {/* KPI 4: Suất Chiếu Hoạt Động */}
        <StatisticCard
          title={kpis.totalShowtimes?.title || 'Suất chiếu hoạt động'}
          value={kpis.totalShowtimes?.formatted || '0 suất'}
          exactValue={
            kpis.totalShowtimes
              ? `Đã chiếu: ${kpis.totalShowtimes.completedCount || 0} | Sắp chiếu: ${kpis.totalShowtimes.upcomingCount || 0}`
              : ''
          }
          growth={kpis.totalShowtimes?.growth}
          subtitle={
            kpis.totalShowtimes?.cancelledCount > 0
              ? `Đã loại trừ ${kpis.totalShowtimes.cancelledCount} suất hủy`
              : kpis.totalShowtimes?.subtitle
          }
          showGrowthNA={kpis.totalShowtimes?.growth === null && !kpis.totalShowtimes?.subtitle}
          tooltip={kpis.totalShowtimes?.tooltip}
          loading={loading}
          icon="⏱️"
          iconBg="bg-amber-500/10 text-amber-400"
        />

        {/* KPI 5: Tổng Chi Phí */}
        <StatisticCard
          title={kpis.totalExpenses?.title || 'Tổng chi phí'}
          value={kpis.totalExpenses?.formatted || '0 ₫'}
          exactValue={
            kpis.totalExpenses?.hasExpenseData
              ? `${kpis.totalExpenses.expenseRecordsCount} chứng từ (${kpis.totalExpenses.exactFormatted})`
              : 'Chưa ghi nhận chi phí trong kỳ'
          }
          growth={kpis.totalExpenses?.growth}
          subtitle={!kpis.totalExpenses?.hasExpenseData ? 'Bấm Tab Doanh thu & Chi phí để nhập' : undefined}
          tooltip={kpis.totalExpenses?.tooltip}
          loading={loading}
          icon="📉"
          iconBg="bg-rose-500/10 text-rose-400"
        />

        {/* KPI 6: Lợi Nhuận Rạp */}
        <StatisticCard
          title={kpis.profit?.title || 'Lợi nhuận rạp'}
          value={kpis.profit?.formatted || 'Chưa đủ dữ liệu'}
          exactValue={kpis.profit?.exactFormatted || ''}
          growth={kpis.profit?.growth}
          valueColor={profitValueColor}
          subtitle={
            data?.profitKnown && kpis.profit?.margin != null
              ? `${kpis.profit.statusLabel} • Biên LN: ${kpis.profit.margin}%`
              : kpis.profit?.statusLabel || 'Chưa đủ dữ liệu tính lợi nhuận'
          }
          tooltip={kpis.profit?.tooltip}
          loading={loading}
          icon={kpis.profit?.status === 'LOSS' ? '⚠️' : '💰'}
          iconBg={
            kpis.profit?.status === 'LOSS'
              ? 'bg-rose-500/10 text-rose-400'
              : !data?.profitKnown
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-emerald-500/10 text-emerald-400'
          }
        />
      </div>

      {/* 1.2 DÃY CHỈ SỐ BỔ SUNG THÁNG & SO SÁNH THÁNG TRƯỚC (MoM) */}
      {!loading && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Doanh thu TB / Suất chiếu</span>
              <strong className="text-sm sm:text-base font-black text-white mt-0.5 block">
                {kpis.averages?.avgRevenuePerShowtimeFormatted || '0 ₫'}
              </strong>
              <span className="text-[10px] text-slate-500">
                Tính trên {formatNumber(kpis.totalShowtimes?.value || 0)} suất hoạt động
              </span>
            </div>
            <span className="text-lg">📽️</span>
          </div>

          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Doanh thu TB / Ngày trong kỳ</span>
              <strong className="text-sm sm:text-base font-black text-cyan-300 mt-0.5 block">
                {kpis.averages?.avgRevenuePerDayFormatted || '0 ₫'}
              </strong>
              <span className="text-[10px] text-slate-500">
                Vé: {kpis.ticketRevenue?.formatted || '0 ₫'} • Combo: {kpis.concessionRevenue?.formatted || '0 ₫'}
              </span>
            </div>
            <span className="text-lg">📅</span>
          </div>

          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Tổng sức chứa trong kỳ</span>
              <strong className="text-sm sm:text-base font-black text-white mt-0.5 block">
                {formatNumber(occupancy.totalSellable || 0)} ghế
              </strong>
              <span className="text-[10px] text-slate-500">
                Đã bán: {formatNumber(occupancy.booked || 0)} • Chưa bán: {formatNumber(occupancy.available || 0)}
              </span>
            </div>
            <span className="text-lg">🪑</span>
          </div>

          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">
                {mom.hasValidPreviousPeriod === false
                  ? 'So sánh kỳ trước (MoM)'
                  : `So sánh với ${mom.previousPeriodLabel || 'Kỳ trước'} (MoM)`}
              </span>
              {mom.hasValidPreviousPeriod === false ? (
                <>
                  <strong className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5 block">
                    Tháng đầu vận hành
                  </strong>
                  <span className="text-[10px] text-slate-400">
                    Chưa có kỳ trước để so sánh (Rạp hoạt động từ 01/11/2026)
                  </span>
                </>
              ) : (
                <>
                  <strong className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5 block">
                    DT: {mom.revenue?.growth != null ? `${mom.revenue.growth > 0 ? '+' : ''}${mom.revenue.growth}%` : 'N/A'} • Vé:{' '}
                    {mom.tickets?.growth != null ? `${mom.tickets.growth > 0 ? '+' : ''}${mom.tickets.growth}%` : 'N/A'}
                  </strong>
                  <span className="text-[10px] text-slate-500">
                    Suất: {mom.showtimes?.growth != null ? `${mom.showtimes.growth > 0 ? '+' : ''}${mom.showtimes.growth}%` : 'N/A'} • Lấp đầy:{' '}
                    {mom.occupancyRate?.growth != null ? `${mom.occupancyRate.growth > 0 ? '+' : ''}${mom.occupancyRate.growth}%` : 'N/A'}
                  </span>
                </>
              )}
            </div>
            <span className="text-lg">📈</span>
          </div>
        </div>
      )}

      {/* 2. KHỐI BIỂU ĐỒ DIỄN BIẾN DOANH THU & DONUT TỶ LỆ BÁN VÉ / CÔNG SUẤT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (7 cols): Biểu đồ Diễn biến Doanh thu (Area + Line Chart) */}
        <div className="lg:col-span-7 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Diễn biến Doanh thu</h3>
              <p className="text-xs text-slate-400">
                Doanh thu vé xem phim và bắp nước qua các ngày ({data?.timeRangeLabel || ''})
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                isSimulatedMode
                  ? 'text-purple-300 bg-purple-950/60 border-purple-500/40'
                  : 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30'
              }`}
            >
              {revenueBadgeLabel}
            </span>
          </div>

          <RevenueChart data={data?.revenueChartData || []} loading={loading} showExpenseOverlay={true} />
        </div>

        {/* Cột phải (5 cols): Tỷ lệ bán vé trung bình & công suất phòng chiếu */}
        <div className="lg:col-span-5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Tỷ Lệ Bán Vé & Công Suất</h3>
              <p className="text-xs text-slate-400">
                Tỷ lệ bán vé trên tổng ghế mở bán của các suất trong kỳ ({physicalRoomsCount} phòng • {formatNumber(totalPhysicalSeats)} ghế vật lý)
              </p>
            </div>
            <span className="text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
              Bán vé toàn kỳ: {occupancyDisplayRate}
            </span>
          </div>

          <OccupancyChart occupancy={occupancy} loading={loading} />

          <div className="pt-2 border-t border-[var(--border-default)]/60 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              Ghế đã bán: <strong className="text-cyan-300 font-bold">{formatNumber(occupancy.booked || 0)}</strong>
            </span>
            <span>
              Ghế chưa bán: <strong className="text-slate-300 font-bold">{formatNumber(occupancy.available || 0)}</strong>
            </span>
            <span>
              Tổng sức chứa trong kỳ:{' '}
              <strong className="text-white font-bold">{formatNumber(occupancy.totalSellable || 0)} ghế</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. KHỐI THÔNG TIN BỔ SUNG: TOP 5 PHIM DOANH THU CAO NHẤT & KHUNG GIỜ CAO ĐIỂM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Phim trong kỳ (6 cols) */}
        <div className="lg:col-span-6 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Top 5 Phim Doanh Thu Cao Nhất</h3>
              <p className="text-xs text-slate-400">Các tác phẩm đạt doanh số cao nhất trong kỳ đang chọn</p>
            </div>
            <span className="text-xs font-bold text-cyan-300">Bảng Xếp Hạng</span>
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
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                        idx === 0
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
                      <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {m.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        <strong className="text-cyan-300">{formatNumber(m.tickets || 0)} vé đã bán</strong> •{' '}
                        {formatNumber(m.showtimesCount || 0)} suất ({formatPercent(m.occupancyRate || 0, 2)})
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-emerald-400 block">{formatCurrency(m.revenue)}</span>
                    <span className="text-[10px] text-slate-500">Doanh thu thuần</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">Chưa có số liệu phim trong kỳ này</div>
            )}
          </div>
        </div>

        {/* Hiệu suất theo Khung giờ chiếu & Suất chiếu sắp diễn ra (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Khung giờ cao điểm */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Hiệu Suất Theo Khung Giờ Chiếu</h3>
                <p className="text-xs text-slate-400">Phân bổ suất chiếu, vé bán và doanh thu theo 4 ca trong ngày</p>
              </div>
              <span className="text-xs font-bold text-amber-400">Ca chiếu</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {peakHours.map((slot, idx) => (
                <div
                  key={idx}
                  className="bg-[var(--bg-surface)]/40 border border-slate-700/60 rounded-2xl p-3.5 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-white block">{slot.slot}</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      {formatNumber(slot.showtimesCount || 0)} suất • Lấp đầy {formatPercent(slot.occupancyRate || 0, 1)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-cyan-300 block">{formatNumber(slot.tickets)} vé</span>
                    <span className="text-[10px] text-emerald-400 font-semibold block">
                      {slot.revenueFormatted || formatCurrency(slot.revenue || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suất chiếu sắp diễn ra */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
              <h3 className="text-base font-bold text-white">Suất Chiếu Sắp Bắt Đầu</h3>
              <span className="text-xs text-slate-400">Bấm vào suất để xem sơ đồ 88 ghế</span>
            </div>

            <div className="space-y-2">
              {upcomingShowtimes.length > 0 ? (
                upcomingShowtimes.slice(0, 4).map((st) => (
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
                    <span className="text-amber-400 font-semibold shrink-0 ml-2">
                      {new Date(st.startTime).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-500">Không có suất chiếu sắp bắt đầu</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. HIỆU SUẤT THEO LOẠI PHÒNG (IMAX LASER / DOLBY ATMOS / GOLD CLASS) & 9 PHÒNG VẬT LÝ */}
      {roomOccupancyBreakdown.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái (4 cols): Cơ cấu theo 3 loại phòng */}
          <div className="lg:col-span-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Hiệu Suất Theo Loại Phòng</h3>
                <p className="text-xs text-slate-400">Tỷ trọng doanh thu & công suất 3 hạng phòng</p>
              </div>
              <span className="text-xs font-bold text-violet-400">3 Công nghệ</span>
            </div>

            <div className="space-y-3.5">
              {roomTypeBreakdown.map((rt) => {
                const style = ROOM_TYPE_COLORS[rt.roomType] || ROOM_TYPE_COLORS['IMAX Laser'];
                return (
                  <div
                    key={rt.roomType}
                    className="p-3.5 rounded-2xl bg-[var(--bg-surface)]/40 border border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${style.badge}`}>
                          {rt.roomType}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ({rt.roomsCount} phòng • {formatNumber(rt.physicalSeats)} ghế)
                        </span>
                      </div>
                      <strong className="text-xs font-black text-emerald-400">{rt.revenueFormatted}</strong>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 pt-1">
                      <div>
                        <span className="text-slate-500 block">Suất chiếu</span>
                        <strong>{formatNumber(rt.showtimesCount)} suất</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Vé / Mở bán</span>
                        <strong>
                          {formatNumber(rt.soldSeats)} / {formatNumber(rt.totalSellableSeats)}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block">Tỷ lệ lấp đầy</span>
                        <strong className={style.text}>{formatPercent(rt.occupancyRate, 2)}</strong>
                      </div>
                    </div>

                    <div className="h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${style.bar}`}
                        style={{ width: `${Math.min(100, Math.max(rt.soldSeats > 0 ? 4 : 0, rt.occupancyRate))}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cột phải (8 cols): Bảng công suất 9 phòng chiếu vật lý */}
          <div className="lg:col-span-8 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Công Suất 9 Phòng Chiếu Vật Lý</h3>
                <p className="text-xs text-slate-400">
                  Thống kê số suất chiếu, tổng sức chứa trong kỳ, ghế đã bán và doanh thu của từng phòng (88 ghế/phòng)
                </p>
              </div>
              <span className="text-xs font-bold text-cyan-300">9 Phòng × 88 Ghế = 792 Ghế</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Phòng chiếu</th>
                    <th className="py-2.5 px-2.5">Loại phòng</th>
                    <th className="py-2.5 px-2 text-center">Ghế vật lý</th>
                    <th className="py-2.5 px-2 text-center">Số suất</th>
                    <th className="py-2.5 px-2.5 text-center">Sức chứa kỳ</th>
                    <th className="py-2.5 px-2.5 text-center">Đã bán</th>
                    <th className="py-2.5 px-2.5 text-center">Chưa bán</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Lấp đầy (%)</th>
                    <th className="py-2.5 px-3 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {roomOccupancyBreakdown.map((r) => {
                    const style = ROOM_TYPE_COLORS[r.roomType] || ROOM_TYPE_COLORS['IMAX Laser'];
                    return (
                      <tr key={r.roomId} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{r.roomName}</td>
                        <td className="py-2.5 px-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${style.badge}`}>
                            {r.roomType}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-400">{r.physicalSeats}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-200">{formatNumber(r.showtimesCount)}</td>
                        <td className="py-2.5 px-2.5 text-center text-slate-300">{formatNumber(r.totalSellableSeats)}</td>
                        <td className="py-2.5 px-2.5 text-center font-bold text-cyan-300">{formatNumber(r.soldSeats)}</td>
                        <td className="py-2.5 px-2.5 text-center text-slate-400">{formatNumber(r.unsoldSeats)}</td>
                        <td className="py-2.5 px-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={style.text}>{formatPercent(r.occupancyRate, 2)}</span>
                            </div>
                            <div className="h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${style.bar}`}
                                style={{ width: `${Math.min(100, Math.max(r.soldSeats > 0 ? 5 : 0, r.occupancyRate))}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{r.revenueFormatted}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
