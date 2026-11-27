import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import StatisticCard from '../components/StatisticCard';
import RevenueChart from '../components/RevenueChart';
import statisticsApi from '../services/statisticsApi';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const EXPENSE_TYPES = [
  { value: 'MOVIE_LICENSE', label: 'Chi phí bản quyền phim', isDirect: true },
  { value: 'REVENUE_SHARE', label: 'Chia sẻ doanh thu nhà phát hành', isDirect: true },
  { value: 'MARKETING', label: 'Chi phí Marketing & Quảng bá', isDirect: true },
  { value: 'ELECTRICITY_WATER', label: 'Chi phí điện nước & điều hòa', isDirect: false },
  { value: 'STAFF', label: 'Chi phí nhân sự & vận hành ca', isDirect: false },
  { value: 'CLEANING', label: 'Chi phí vệ sinh phòng chiếu', isDirect: false },
  { value: 'MAINTENANCE', label: 'Chi phí bảo trì thiết bị & phòng chiếu', isDirect: false },
  { value: 'CONCESSION_COGS', label: 'Chi phí nguyên liệu bắp nước', isDirect: false },
  { value: 'OTHER', label: 'Chi phí khác', isDirect: false },
];

const EXPENSE_TYPE_LABELS = {
  MOVIE_LICENSE: 'Chi phí bản quyền phim',
  REVENUE_SHARE: 'Chia sẻ doanh thu nhà phát hành',
  DIRECT_MOVIE: 'Bản quyền & Chia sẻ doanh thu phim',
  MARKETING: 'Chi phí Marketing & Quảng bá',
  ELECTRICITY_WATER: 'Chi phí điện nước & điều hòa',
  UTILITY: 'Điện nước & Tiện ích',
  STAFF: 'Chi phí nhân sự & vận hành ca',
  CLEANING: 'Chi phí vệ sinh phòng chiếu',
  MAINTENANCE: 'Chi phí bảo trì thiết bị & phòng chiếu',
  OPERATIONAL_CINEMA: 'Vận hành cụm rạp',
  CONCESSION_COGS: 'Chi phí nguyên liệu bắp nước',
  OTHER: 'Chi phí khác',
};

const keepCurrencyUnit = (value) => value?.replace(/ (?=[đ₫]$)/, '\u00a0');

const RevenueTab = ({
  data,
  loading,
  error,
  onRetry,
  filters,
  moviesList = [],
  roomsList = [],
  onSelectMovie,
  onExpenseMutated,
}) => {
  const [tableMode, setTableMode] = useState('movies'); // 'movies' | 'expenses' | 'monthly' | 'daily'
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // State Quản lý Chi phí thực tế (CRUD Expense)
  const [expensesList, setExpensesList] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const expenseController = useRef(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    type: 'MOVIE_LICENSE',
    amount: '',
    movieId: '',
    roomId: '',
    date: new Date().toISOString().slice(0, 10),
    month: filters?.month || 11,
    year: filters?.year || new Date().getFullYear(),
    notes: '',
  });
  const [expenseFeedback, setExpenseFeedback] = useState('');

  const metrics = data?.metrics || {};
  const monthlyBreakdown = data?.monthlyBreakdown || [];
  const expensesByCategory = data?.expensesByCategory || [];
  const paymentMethods = data?.paymentMethods || [];
  const rows = data?.revenueTableRows || [];
  const movieRows = data?.movieRevenueRows || [];

  // Tải danh sách chi phí thực tế theo bộ lọc kỳ hiện tại
  const fetchExpensesData = useCallback(async () => {
    expenseController.current?.abort();
    const controller = new AbortController();
    expenseController.current = controller;
    setExpenseError('');
    setLoadingExpenses(true);
    try {
      const response = await statisticsApi.getExpenses({ ...filters, limit: 100 }, controller.signal);
      if (controller.signal.aborted) return;
      if (!Array.isArray(response.data?.data?.items)) throw new Error('Thiếu dữ liệu chứng từ');
      setExpensesList(response.data.data.items);
    } catch (err) {
      if (!controller.signal.aborted) setExpenseError(err.response?.data?.message || 'Không tải được chứng từ chi phí.');
    } finally {
      if (!controller.signal.aborted) setLoadingExpenses(false);
    }
  }, [filters]);

  useEffect(() => {
    setExpensesList([]);
    fetchExpensesData();
    return () => expenseController.current?.abort();
  }, [fetchExpensesData]);

  // Xử lý mở Modal thêm / sửa chi phí
  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    const defaultDate =
      filters?.timeRange === 'by_month' && filters?.year && filters?.month
        ? `${filters.year}-${String(filters.month).padStart(2, '0')}-15`
        : new Date().toISOString().slice(0, 10);
    setExpenseForm({
      title: '',
      type: 'MOVIE_LICENSE',
      amount: '',
      movieId: filters?.movieId && filters.movieId !== 'ALL' ? filters.movieId : '',
      roomId: filters?.roomId && filters.roomId !== 'ALL' ? filters.roomId : '',
      date: defaultDate,
      month: filters?.month || 11,
      year: filters?.year || new Date().getFullYear(),
      notes: '',
    });
    setShowExpenseModal(true);
  };

  const handleOpenEditExpense = (item) => {
    setEditingExpense(item);
    setExpenseForm({
      title: item.title,
      type: item.type,
      amount: item.amount,
      movieId: item.movieId?._id || item.movieId || '',
      roomId: item.roomId?._id || item.roomId || '',
      date: item.date ? new Date(item.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      month: item.month || filters?.month || 11,
      year: item.year || filters?.year || new Date().getFullYear(),
      notes: item.notes || '',
    });
    setShowExpenseModal(true);
  };

  // Submit Form thêm / sửa
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.title || expenseForm.amount === '' || Number(expenseForm.amount) < 0) {
      setExpenseFeedback('✕ Vui lòng nhập đầy đủ Tên khoản chi và Số tiền hợp lệ!');
      return;
    }
    try {
      const payload = {
        ...expenseForm,
        amount: Number(expenseForm.amount),
      };
      if (editingExpense) {
        await statisticsApi.updateExpense(editingExpense._id || editingExpense.id, payload);
        setExpenseFeedback('✓ Cập nhật khoản chi thành công! Số liệu lợi nhuận đã được tính lại.');
      } else {
        await statisticsApi.createExpense(payload);
        setExpenseFeedback('✓ Thêm mới khoản chi thành công! Số liệu lợi nhuận đã được tính lại.');
      }
      setShowExpenseModal(false);
      await fetchExpensesData();
      if (onExpenseMutated) onExpenseMutated();
      setTimeout(() => setExpenseFeedback(''), 5000);
    } catch (err) {
      console.error('Lỗi lưu khoản chi:', err);
      setExpenseFeedback('✕ Lưu chi phí thất bại. Vui lòng kiểm tra lại!');
      setTimeout(() => setExpenseFeedback(''), 4000);
    }
  };

  // Xóa khoản chi
  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khoản chi phí này?')) return;
    try {
      await statisticsApi.deleteExpense(id);
      setExpenseFeedback('✓ Đã xóa khoản chi thành công! Báo cáo lợi nhuận đã được cập nhật.');
      await fetchExpensesData();
      if (onExpenseMutated) onExpenseMutated();
      setTimeout(() => setExpenseFeedback(''), 4000);
    } catch (err) {
      console.error('Lỗi xóa chi phí:', err);
      setExpenseFeedback('✕ Không thể xóa khoản chi.');
      setTimeout(() => setExpenseFeedback(''), 4000);
    }
  };

  // Lọc tìm kiếm dữ liệu bảng
  const filteredMonthly = useMemo(() => {
    if (!searchTerm.trim()) return monthlyBreakdown;
    return monthlyBreakdown.filter((m) => m.monthLabel.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [monthlyBreakdown, searchTerm]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    return rows.filter((r) => r.date.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [rows, searchTerm]);

  const filteredMovieRows = useMemo(() => {
    if (!searchTerm.trim()) return movieRows;
    return movieRows.filter((m) => m.title.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [movieRows, searchTerm]);

  const filteredExpenses = useMemo(() => {
    if (!searchTerm.trim()) return expensesList;
    const term = searchTerm.toLowerCase().trim();
    return expensesList.filter(
      (e) =>
        e.title?.toLowerCase().includes(term) ||
        e.costCode?.toLowerCase().includes(term) ||
        e.type?.toLowerCase().includes(term) ||
        e.movieId?.title?.toLowerCase().includes(term)
    );
  }, [expensesList, searchTerm]);

  const getCurrentItems = () => {
    switch (tableMode) {
      case 'movies':
        return filteredMovieRows;
      case 'expenses':
        return filteredExpenses;
      case 'monthly':
        return filteredMonthly;
      case 'daily':
        return filteredRows;
      default:
        return filteredMovieRows;
    }
  };

  const currentItems = getCurrentItems();
  const totalPages = Math.ceil(currentItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentItems.slice(start, start + pageSize);
  }, [currentItems, currentPage, pageSize]);

  if (!loading && error) {
    return (
      <div
        role="alert"
        className="bg-rose-950/40 border border-rose-500/40 rounded-3xl p-8 text-center space-y-4 shadow-xl"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-2xl">
          ⚠️
        </div>
        <h3 className="text-base sm:text-lg font-bold text-white">Không tải được báo cáo Doanh thu & Chi phí</h3>
        <p className="text-xs text-rose-200/80 max-w-md mx-auto">{error}</p>
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

  const renderStatusBadge = (status, label) => {
    if (status === 'PROFIT') {
      return (
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-950/70 text-emerald-400 border-emerald-500/40">
          {label || 'Có lãi'}
        </span>
      );
    }
    if (status === 'BREAKEVEN') {
      return (
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-cyan-950/70 text-cyan-300 border-cyan-500/40">
          {label || 'Hòa vốn'}
        </span>
      );
    }
    if (status === 'LOSS') {
      return (
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-rose-950/70 text-rose-400 border-rose-500/40">
          {label || 'Thua lỗ'}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-950/70 text-amber-300 border-amber-500/40">
        {label || 'Chưa đủ dữ liệu tính lợi nhuận'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Thông báo thao tác nếu có */}
      {expenseFeedback && (
        <div className="p-3 bg-[var(--bg-secondary)] border border-emerald-500/40 rounded-2xl text-xs font-semibold text-emerald-300 shadow-lg animate-fadeIn flex items-center justify-between">
          <span>{expenseFeedback}</span>
          <button onClick={() => setExpenseFeedback('')} className="text-slate-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Cảnh báo rõ ràng khi chưa có dữ liệu chi phí trong kỳ (Mục VII.2) */}
      {!loading && data && !metrics.hasExpenseData && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <strong className="text-amber-300 block">
              ⚠️ Chưa đủ dữ liệu tính lợi nhuận cho kỳ {data.timeRangeLabel}
            </strong>
            <span className="text-slate-300">
              Hệ thống hiện chưa có khoản chi phí bản quyền phim hoặc chi phí vận hành nào trong kỳ này. Để không ghi nhận lợi nhuận 100% sai lệch, vui lòng nhập chi phí thực tế.
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenAddExpense}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer shadow"
          >
            + Nhập chi phí ngay
          </button>
        </div>
      )}

      {/* 1. DÃY 6 CHỈ SỐ TÀI CHÍNH TOÀN DIỆN (DOANH THU - CHI PHÍ - LỢI NHUẬN) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        <StatisticCard
          title="Doanh Thu Thuần"
          value={keepCurrencyUnit(metrics.netFormatted) || '0 đ'}
          exactValue={`Trước chiết khấu: ${metrics.grossFormatted || '0 đ'}`}
          tooltip="Doanh thu thuần hợp lệ = Tổng tiền thanh toán thành công (Vé + Bắp nước - Voucher)"
          loading={loading}
          icon="💳"
          iconBg="bg-emerald-500/10 text-emerald-400"
        />

        <StatisticCard
          title="Tổng Chi Phí"
          value={keepCurrencyUnit(metrics.expensesFormatted) || '0 đ'}
          exactValue={
            metrics.hasExpenseData
              ? `Trực tiếp phim: ${formatCurrency(metrics.directMovieExpenses || 0)} | Vận hành: ${formatCurrency(metrics.sharedOperationalExpenses || 0)}`
              : 'Chưa có chứng từ chi phí'
          }
          tooltip="Tổng chi phí trực tiếp (bản quyền phim, marketing) + chi phí vận hành rạp (điện nước, nhân sự, bảo trì)"
          loading={loading}
          icon="📉"
          iconBg="bg-rose-500/10 text-rose-400"
        />

        <StatisticCard
          title="Lợi nhuận theo chi phí đã ghi nhận"
          value={metrics.hasExpenseData ? keepCurrencyUnit(metrics.profitFormatted) : 'Chưa đủ dữ liệu'}
          valueColor={
            !metrics.hasExpenseData
              ? 'text-amber-300'
              : metrics.profitStatus === 'LOSS'
              ? 'text-rose-400'
              : 'text-emerald-400'
          }
          subtitle={
            metrics.hasExpenseData
              ? `${metrics.profitStatusLabel} • Biên LN: ${metrics.profitMargin == null ? '—' : `${metrics.profitMargin}%`} • ROI: ${metrics.roi == null ? '—' : `${metrics.roi}%`}`
              : 'Chưa đủ dữ liệu tính lợi nhuận'
          }
          tooltip="Lợi nhuận = Doanh thu thuần - Tổng chi phí"
          loading={loading}
          icon={metrics.profitStatus === 'LOSS' ? '⚠️' : '💰'}
          iconBg={metrics.profitStatus === 'LOSS' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}
        />

        <StatisticCard
          title="Doanh Thu Vé"
          value={keepCurrencyUnit(metrics.ticketFormatted) || '0 đ'}
          exactValue={`${formatNumber(metrics.totalTicketsSold || 0)} vé (${metrics.ticketPercent || 0}%)`}
          tooltip="Doanh thu trực tiếp từ bán vé xem phim các định dạng IMAX Laser, Dolby Atmos, Gold Class"
          loading={loading}
          icon="🎟️"
          iconBg="bg-cyan-500/10 text-cyan-400"
        />

        <StatisticCard
          title="Doanh Thu Bắp Nước"
          value={keepCurrencyUnit(metrics.concessionFormatted) || '0 đ'}
          exactValue={`Tỷ trọng: ${metrics.concessionPercent || 0}% tổng doanh thu`}
          tooltip="Doanh thu từ các combo bắp rang bơ và đồ uống đi kèm đơn đặt vé"
          loading={loading}
          icon="🍿"
          iconBg="bg-amber-500/10 text-amber-400"
        />

        <StatisticCard
          title="Tổng tiền đã hoàn"
          value={keepCurrencyUnit(formatCurrency(metrics.totalRefundedAmount))}
          exactValue={`${formatNumber(metrics.cancelledOrders || 0)} đơn hủy (${formatCurrency(metrics.cancelledAmount || 0)})`}
          tooltip="Tổng tiền đã hoàn lại cho khách hàng do hủy vé hoặc hủy suất chiếu"
          loading={loading}
          icon="↩️"
          iconBg="bg-slate-700/40 text-slate-300"
        />
      </div>

      {!loading && data && (
        <div className="grid gap-2 rounded-2xl border border-slate-700 bg-[var(--bg-secondary)] p-4 text-xs text-slate-300 sm:grid-cols-2">
          <span>Doanh thu xác minh: {formatCurrency(metrics.verifiedRevenue)}</span>
          <span>Doanh thu mô phỏng: {formatCurrency(metrics.simulatedRevenue)}</span>
          <span>Hoàn xác minh: {formatCurrency(metrics.verifiedRefundedAmount)}</span>
          <span>Hoàn mô phỏng: {formatCurrency(metrics.simulatedRefundedAmount)}</span>
          <span>Chờ hoàn: {formatCurrency(metrics.pendingRefundAmount)}</span>
          <span>Giá trị đơn đã hủy: {formatCurrency(metrics.cancelledAmount)}</span>
          {metrics.missingRefundAmountCount > 0 && <p role="status" className="sm:col-span-2 text-amber-300">
            {metrics.missingRefundAmountCount} đơn có trạng thái hoàn hoặc chờ hoàn nhưng thiếu số tiền xác định. Các tổng chỉ gồm khoản có số tiền ghi nhận.
          </p>}
          {metrics.refundDateKnown === false && <p className="sm:col-span-2 text-slate-400">Tiền hoàn thống kê theo nhóm đơn tạo trong kỳ.</p>}
          <span>Chi phí trực tiếp phim và phòng: {formatCurrency(metrics.directMovieExpenses + metrics.directRoomExpenses)}</span>
          <span>Chi phí chung đã phân bổ: {formatCurrency(metrics.sharedOperationalExpenses - (metrics.unallocatedSharedExpenses ?? 0))}</span>
          <span>Chi phí chưa phân bổ: {formatCurrency(metrics.unallocatedExpenses)}</span>
          {metrics.revenueSplitWarning && <p role="status" className="sm:col-span-2 text-amber-300">Chưa phân loại {formatCurrency(metrics.unclassifiedRevenue)} do thiếu chi tiết giá giao dịch.</p>}
        </div>
      )}

      {/* 2. BIỂU ĐỒ KẾT HỢP DOANH THU - CHI PHÍ - LỢI NHUẬN */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)]/80 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Biểu Đồ Doanh Thu (Vé + Bắp Nước) & Chi Phí Theo Ngày
            </h3>
            <p className="text-xs text-slate-400">
              Doanh thu hợp lệ theo ngày giao dịch trong kỳ {data?.timeRangeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddExpense}
            className="px-3.5 py-1.5 rounded-xl cinema-action text-white text-xs font-bold shadow cursor-pointer"
          >
            + Thêm khoản chi phí
          </button>
        </div>

        {data?.missingSeatShowtimesCount > 0 && <p role="status" className="text-xs text-amber-300">
          {data.missingSeatShowtimesCount} suất thiếu dữ liệu ghế.
        </p>}
        {!loading && data && <p className="text-xs text-slate-400">
          {metrics.hasExpenseData ? 'Chi phí đánh dấu tại ngày có chứng từ.' : 'Chưa ghi nhận chi phí trong kỳ.'}
          {' '}Trục ngày hiển thị đến hôm nay hoặc ngày kết thúc kỳ.
        </p>}
        <RevenueChart data={data?.revenueChartData || []} loading={loading} showExpenseOverlay={true} />
      </div>

      {/* 3. CƠ CẤU CHI PHÍ THỰC TẾ & CƠ CẤU DOANH THU */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Khối Cơ Cấu Chi Phí Thực Tế Rạp */}
        <div className="lg:col-span-6 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Cơ Cấu Chi Phí Hoạt Động Rạp</h3>
              <p className="text-xs text-slate-400">Phân bổ các danh mục chi phí thực tế trong kỳ</p>
            </div>
            <span className="text-xs font-semibold text-rose-400">{keepCurrencyUnit(metrics.expensesFormatted) || '0 đ'}</span>
          </div>

          <div className="space-y-3">
            {expensesByCategory.map((cat) => (
              <div key={cat.type} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    {cat.label} ({cat.percent}%)
                  </span>
                  <span className="font-bold text-rose-400">{cat.formattedAmount}</span>
                </div>
                <div className="h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 to-amber-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, cat.percent)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[var(--border-default)]/80 text-[11px] text-slate-400 leading-relaxed">
            💡 <strong>Quy tắc phân bổ minh bạch:</strong> Chi phí gắn trực tiếp với phim (Bản quyền phim, Chia sẻ doanh thu, Marketing phim) được tính trực tiếp cho phim đó. Chi phí vận hành chung (Điện nước, Nhân sự, Bảo trì, Vệ sinh) được phân bổ theo tỷ lệ số suất chiếu thực tế của từng bộ phim, không bao giờ tính trùng hai lần.
          </div>
        </div>

        {/* Khối Cơ Cấu Doanh Thu Sản Phẩm & Thanh Toán */}
        <div className="lg:col-span-6 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Cơ Cấu Doanh Thu & Phương Thức Thanh Toán</h3>
              <p className="text-xs text-slate-400">Tỷ trọng giữa Vé xem phim, Bắp nước và Cổng thanh toán</p>
            </div>
            <span className="text-xs font-semibold text-emerald-400">{keepCurrencyUnit(metrics.netFormatted) || '0 đ'}</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400"></span>
                  <span>Vé xem phim ({metrics.ticketPercent || 0}%)</span>
                </span>
                <span className="font-bold text-cyan-300">{keepCurrencyUnit(metrics.ticketFormatted) || '0 đ'}</span>
              </div>
              <div className="h-2.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full transition-all duration-700"
                  style={{ width: `${metrics.ticketPercent || 0}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                  <span>Bắp nước & Combo ({metrics.concessionPercent || 0}%)</span>
                </span>
                <span className="font-bold text-amber-400">{keepCurrencyUnit(metrics.concessionFormatted) || '0 đ'}</span>
              </div>
              <div className="h-2.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-700"
                  style={{ width: `${metrics.concessionPercent || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-default)]">
            {paymentMethods.map((pm) => (
              <div
                key={pm.method}
                className="p-2.5 rounded-xl bg-[var(--bg-surface)]/50 border border-slate-700/50 text-center"
              >
                <span className="text-[10px] text-slate-400 block font-semibold">
                  {pm.method === 'MOMO' ? '🌸 MoMo' : pm.method === 'VNPAY' ? '💳 VNPAY' : pm.method}
                  {pm.simulatedAmount > 0 && pm.simulatedAmount === pm.amount && ' · Mô phỏng'}
                </span>
                <span className="text-xs font-bold text-white block mt-0.5">{pm.percent}%</span>
                <span className="text-[10px] text-slate-500 block">{formatCurrency(pm.amount)}</span>
                {pm.simulatedAmount > 0 && pm.simulatedAmount < pm.amount &&
                  <span className="text-[10px] text-slate-400">Mô phỏng: {formatCurrency(pm.simulatedAmount)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. BẢNG PHÂN TÍCH DOANH THU, CHI PHÍ, LỢI NHUẬN TỪNG PHIM & QUẢN LÝ CHI PHÍ (MỤC VII & VIII) */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[var(--border-default)]/80 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-white">Báo Cáo Lợi Nhuận Phim & Quản Lý Chi Phí Rạp</h3>
              <p className="text-xs text-slate-400">
                Đối soát doanh thu, chi phí bản quyền, chi phí vận hành phân bổ, lợi nhuận, Biên LN và ROI
              </p>
            </div>

            {/* Chuyển đổi 4 chế độ bảng */}
            <div className="bg-[var(--bg-surface)] p-1 rounded-xl flex flex-wrap items-center gap-1 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTableMode('movies');
                  setCurrentPage(1);
                  setSearchTerm('');
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  tableMode === 'movies' ? 'cinema-action text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Lợi nhuận từng phim ({movieRows.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableMode('expenses');
                  setCurrentPage(1);
                  setSearchTerm('');
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  tableMode === 'expenses' ? 'cinema-action text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Quản lý chi phí ({expensesList.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableMode('monthly');
                  setCurrentPage(1);
                  setSearchTerm('');
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  tableMode === 'monthly' ? 'cinema-action text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Theo tháng ({monthlyBreakdown.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableMode('daily');
                  setCurrentPage(1);
                  setSearchTerm('');
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  tableMode === 'daily' ? 'cinema-action text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Theo ngày
              </button>
            </div>
          </div>

          {/* Ô tìm kiếm & Nút thêm khoản chi */}
          <div className="flex items-center space-x-2.5">
            <input
              type="text"
              placeholder="Tìm tên phim, mã chi phí..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 w-44 sm:w-56"
            />
            <button
              type="button"
              onClick={handleOpenAddExpense}
              className="px-3.5 py-1.5 cinema-action text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>+ Thêm chi phí</span>
            </button>
          </div>
        </div>

        {/* BẢNG 1: BẢNG DOANH THU - CHI PHÍ - LỢI NHUẬN - BIÊN LN - ROI TỪNG BỘ PHIM (MỤC VII.4) */}
        {tableMode === 'movies' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-3 min-w-[200px]">Bộ phim</th>
                  <th className="py-3 px-2 text-center">Suất chiếu</th>
                  <th className="py-3 px-2 text-center">Vé bán</th>
                  <th className="py-3 px-3 text-right">Doanh thu vé</th>
                  <th className="py-3 px-3 text-right text-amber-300">Bắp nước</th>
                  <th className="py-3 px-3 text-right font-bold text-white">Doanh thu thuần</th>
                  <th className="py-3 px-3 text-right text-rose-300">Chi phí trực tiếp</th>
                  <th className="py-3 px-3 text-right text-amber-300">Chi phí phân bổ</th>
                  <th className="py-3 px-3 text-right font-bold text-rose-400">Tổng chi phí</th>
                  <th className="py-3 px-3 text-right font-black text-emerald-400">Lợi nhuận</th>
                  <th className="py-3 px-2 text-center">Biên LN</th>
                  <th className="py-3 px-2 text-center">ROI</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((mv, idx) => (
                    <tr key={mv.movieId || idx} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                      <td className="py-3 px-3">
                        <div
                          onClick={() => onSelectMovie && onSelectMovie(mv.movieId)}
                          className="flex items-center space-x-2.5 cursor-pointer group"
                        >
                          <img
                            src={mv.poster || undefined}
                            alt={mv.title}
                            className="w-8 h-11 rounded-lg object-cover shrink-0 border border-slate-700 shadow"
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                            }}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-white group-hover:text-cyan-300 block line-clamp-2">
                              {mv.title}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Tỷ trọng phân bổ: {mv.allocationSharePercent == null ? '—' : `${mv.allocationSharePercent}%`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center text-slate-300">{formatNumber(mv.showtimesCount || 0)}</td>
                      <td className="py-3 px-2 text-center font-bold text-cyan-300">{formatNumber(mv.tickets || 0)}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(mv.ticketRevenue || 0)}</td>
                      <td className="py-3 px-3 text-right text-amber-300">{formatCurrency(mv.concessionRevenue || 0)}</td>
                      <td className="py-3 px-3 text-right font-bold text-white">{formatCurrency(mv.netRevenue || 0)}</td>
                      <td className="py-3 px-3 text-right text-rose-300">{formatCurrency(mv.directExpenses || 0)}</td>
                      <td className="py-3 px-3 text-right text-amber-300">
                        {formatCurrency(mv.allocatedOperationalCost || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-400">{formatCurrency(mv.totalCost || 0)}</td>
                      <td
                        className={`py-3 px-3 text-right font-black ${
                          !mv.hasExpenseData
                            ? 'text-amber-300'
                            : (mv.profit || 0) >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {mv.hasExpenseData ? formatCurrency(mv.profit) : 'Chưa đủ dữ liệu'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold">
                        {mv.hasExpenseData && mv.profitMargin != null ? `${mv.profitMargin}%` : '—'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold">
                        {mv.hasExpenseData && mv.roi != null ? `${mv.roi}%` : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {renderStatusBadge(mv.profitStatus, mv.statusLabel)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="13" className="py-12 text-center text-slate-500">
                      Chưa có dữ liệu phim trong kỳ đã chọn
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BẢNG 2: QUẢN LÝ DANH MỤC CHI PHÍ THỰC TẾ (EXPENSE CRUD - MỤC VIII) */}
        {tableMode === 'expenses' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-3">Mã chi phí</th>
                  <th className="py-3 px-3 min-w-[180px]">Tên khoản chi</th>
                  <th className="py-3 px-3">Loại chi phí</th>
                  <th className="py-3 px-3">Phim / Phòng gắn kết</th>
                  <th className="py-3 px-2 text-center">Kỳ áp dụng</th>
                  <th className="py-3 px-2 text-center">Ngày chi</th>
                  <th className="py-3 px-3 text-right font-black text-rose-400">Số tiền (VNĐ)</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {loadingExpenses ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      Đang tải danh sách chi phí...
                    </td>
                  </tr>
                ) : expenseError ? (
                  <tr><td colSpan="8" className="p-4 text-center text-rose-300" role="alert">
                    {expenseError} <button type="button" className="ml-2 underline" onClick={fetchExpensesData}>Thử lại</button>
                  </td></tr>
                ) : paginatedItems.length > 0 ? (
                  paginatedItems.map((exp) => (
                    <tr key={exp._id || exp.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-400 font-bold">{exp.costCode}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-white block">{exp.title}</span>
                        {exp.notes && <span className="text-[10px] text-slate-500 block">{exp.notes}</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className="bg-[var(--bg-surface)] text-slate-300 px-2 py-0.5 rounded text-[10px] border border-slate-700">
                          {EXPENSE_TYPE_LABELS[exp.type] || exp.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {exp.movieId?.title ? (
                          <span className="text-cyan-300 font-semibold">🎬 {exp.movieId.title}</span>
                        ) : exp.roomId?.name ? (
                          <span className="text-purple-300 font-semibold">🏛️ {exp.roomId.name}</span>
                        ) : (
                          <span className="text-slate-400">Dùng chung toàn rạp</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center text-slate-300 font-mono">
                        {exp.month && exp.year ? `T${exp.month}/${exp.year}` : '—'}
                      </td>
                      <td className="py-3 px-2 text-center text-slate-400 font-mono">
                        {new Date(exp.date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-rose-400">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditExpense(exp)}
                            className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-slate-700 text-slate-200 rounded text-[11px] cursor-pointer"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp._id || exp.id)}
                            className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded text-[11px] cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-500">
                      Chưa có khoản chi phí nào được ghi nhận trong kỳ. Hãy bấm "+ Thêm chi phí" để nhập chi phí bản quyền hoặc vận hành.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BẢNG 3: BÁO CÁO 12 THÁNG KINH DOANH TRONG NĂM */}
        {tableMode === 'monthly' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Tháng</th>
                  <th className="py-3 px-3 text-center">Số vé bán</th>
                  <th className="py-3 px-3 text-center">Suất chiếu</th>
                  <th className="py-3 px-4 text-right">Doanh thu thuần</th>
                  <th className="py-3 px-4 text-right text-rose-300">Tổng chi phí</th>
                  <th className="py-3 px-4 text-right font-black text-emerald-400">Lợi nhuận (Lãi/Lỗ)</th>
                  <th className="py-3 px-3 text-center">Biên LN</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((m, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">{m.monthLabel}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-200">
                        {formatNumber(m.ticketsSold)}
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-400">
                        {formatNumber(m.showtimesCount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-200">
                        {m.formattedRevenue}
                      </td>
                      <td className="py-3.5 px-4 text-right text-rose-400 font-semibold">
                        {m.formattedExpenses}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-black ${
                          !m.hasExpenseData
                            ? 'text-amber-300'
                            : (m.profit || 0) >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {m.formattedProfit}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-300">
                        {m.hasExpenseData && m.profitMargin != null ? `${m.profitMargin}%` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {renderStatusBadge(m.profitStatus, m.statusLabel)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-500">
                      Chưa có dữ liệu kinh doanh 12 tháng
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BẢNG 4: BÁO CÁO DOANH THU THEO NGÀY */}
        {tableMode === 'daily' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Ngày</th>
                  <th className="py-3 px-3 text-center">Đơn thành công</th>
                  <th className="py-3 px-3 text-center">Số vé bán</th>
                  <th className="py-3 px-4 text-right">Doanh thu vé</th>
                  <th className="py-3 px-4 text-right text-amber-400">Bắp nước</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-200">Doanh thu thuần</th>
                  <th className="py-3 px-4 text-right text-rose-400">Chi phí</th>
                  <th className="py-3 px-4 text-right font-black text-emerald-400">Chênh lệch ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((r, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">{r.date}</td>
                      <td className="py-3.5 px-3 text-center">{r.orders}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-200">{formatNumber(r.tickets)}</td>
                      <td className="py-3.5 px-4 text-right text-slate-300">{formatCurrency(r.ticketRev)}</td>
                      <td className="py-3.5 px-4 text-right text-amber-400">{formatCurrency(r.concessionRev)}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-200">{formatCurrency(r.netRev)}</td>
                      <td className="py-3.5 px-4 text-right text-rose-400">{formatCurrency(r.expense || 0)}</td>
                      <td
                        className={`py-3.5 px-4 text-right font-black ${
                          (r.profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.profit == null ? '—' : formatCurrency(r.profit)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-500">
                      Chưa có phát sinh giao dịch hoặc chi phí theo ngày trong kỳ này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-default)] text-xs text-slate-400">
            <span>
              Trang {currentPage} / {totalPages} (Tổng {currentItems.length} bản ghi)
            </span>
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
                    currentPage === i + 1 ? 'cinema-action text-white' : 'bg-[var(--bg-surface)] text-slate-300 hover:bg-slate-700'
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

      {/* MODAL THÊM / SỬA KHOẢN CHI THỰC TẾ (MỤC VIII) */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="text-base font-bold text-white">
                {editingExpense ? 'Chỉnh Sửa Khoản Chi Phí' : 'Thêm Khoản Chi Phí Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="w-7 h-7 rounded-full bg-[var(--bg-surface)] hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Tên khoản chi *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Phí bản quyền phim Dune: Hành Tinh Cát - Phần 2..."
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Loại chi phí *</label>
                  <select
                    value={expenseForm.type}
                    onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {EXPENSE_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-[var(--bg-secondary)] text-white">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Số tiền (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="10000000"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Gắn với bộ phim (tùy chọn)</label>
                  <select
                    value={expenseForm.movieId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, movieId: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="">-- Chi phí chung toàn rạp (Phân bổ) --</option>
                    {moviesList.map((m) => (
                      <option key={m._id || m.id} value={m._id || m.id} className="bg-[var(--bg-secondary)] text-white">
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Gắn với phòng chiếu (tùy chọn)</label>
                  <select
                    value={expenseForm.roomId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, roomId: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="">-- Tất cả 9 phòng chiếu --</option>
                    {roomsList.map((r) => (
                      <option key={r._id || r.id} value={r._id || r.id} className="bg-[var(--bg-secondary)] text-white">
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Ngày chi *</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parts = val.split('-');
                      setExpenseForm({
                        ...expenseForm,
                        date: val,
                        year: parts[0] ? Number(parts[0]) : expenseForm.year,
                        month: parts[1] ? Number(parts[1]) : expenseForm.month,
                      });
                    }}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Tháng áp dụng</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={expenseForm.month}
                    onChange={(e) => setExpenseForm({ ...expenseForm, month: Number(e.target.value) })}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Năm áp dụng</label>
                  <input
                    type="number"
                    min="2020"
                    max="2035"
                    value={expenseForm.year}
                    onChange={(e) => setExpenseForm({ ...expenseForm, year: Number(e.target.value) })}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Ghi chú / Số hóa đơn chứng từ</label>
                <textarea
                  rows="2"
                  placeholder="Ghi chú hợp đồng bản quyền hoặc hóa đơn vận hành..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                ></textarea>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 cinema-action text-white font-bold rounded-xl transition-all shadow-lg cursor-pointer"
                >
                  {editingExpense ? 'Lưu thay đổi' : 'Thêm khoản chi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueTab;
