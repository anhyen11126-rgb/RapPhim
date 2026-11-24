import React, { useState, useEffect, useMemo, useCallback } from 'react';
import StatisticCard from '../components/StatisticCard';
import RevenueChart from '../components/RevenueChart';
import statisticsApi from '../services/statisticsApi';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const EXPENSE_TYPES = [
  { value: 'DIRECT_MOVIE', label: 'Bản quyền phim & Nhà phát hành' },
  { value: 'MARKETING', label: 'Tiếp thị & Quảng cáo' },
  { value: 'OPERATIONAL_CINEMA', label: 'Vận hành cụm rạp' },
  { value: 'STAFF', label: 'Lương & Nhân sự rạp' },
  { value: 'UTILITY', label: 'Điện nước, Mạng & Bảo trì' },
  { value: 'OTHER', label: 'Chi phí khác' },
];

const RevenueTab = ({ data, loading }) => {
  const [tableMode, setTableMode] = useState('monthly'); // 'monthly' | 'daily' | 'movies' | 'expenses'
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // State Quản lý Chi phí thực tế (CRUD Expense)
  const [expensesList, setExpensesList] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [moviesList, setMoviesList] = useState([]);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    type: 'DIRECT_MOVIE',
    amount: '',
    movieId: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [expenseFeedback, setExpenseFeedback] = useState('');

  const metrics = data?.metrics || {};
  const monthlyBreakdown = data?.monthlyBreakdown || [];
  const expensesByCategory = data?.expensesByCategory || [];
  const paymentMethods = data?.paymentMethods || [];
  const rows = data?.revenueTableRows || [];
  const movieRows = data?.movieRevenueRows || [];

  // Tải danh sách chi phí thực tế & danh mục phim
  const fetchExpensesData = useCallback(async () => {
    try {
      setLoadingExpenses(true);
      const [expRes, movRes] = await Promise.all([
        statisticsApi.getExpenses({ limit: 100 }),
        statisticsApi.getFilterMovies(),
      ]);
      if (expRes.data?.data) {
        setExpensesList(expRes.data.data.items || []);
      }
      if (Array.isArray(movRes.data)) {
        setMoviesList(movRes.data);
      }
    } catch (err) {
      console.warn('Lỗi nạp danh sách chi phí:', err.message);
    } finally {
      setLoadingExpenses(false);
    }
  }, []);

  useEffect(() => {
    fetchExpensesData();
  }, [fetchExpensesData]);

  // Xử lý mở Modal thêm / sửa chi phí
  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      title: '',
      type: 'DIRECT_MOVIE',
      amount: '',
      movieId: '',
      date: new Date().toISOString().slice(0, 10),
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
      date: item.date ? new Date(item.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: item.notes || '',
    });
    setShowExpenseModal(true);
  };

  // Submit Form thêm / sửa
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) {
      setExpenseFeedback('✕ Vui lòng nhập đầy đủ Tên khoản chi và Số tiền!');
      return;
    }
    try {
      if (editingExpense) {
        await statisticsApi.updateExpense(editingExpense._id || editingExpense.id, expenseForm);
        setExpenseFeedback('✓ Cập nhật khoản chi thành công!');
      } else {
        await statisticsApi.createExpense(expenseForm);
        setExpenseFeedback('✓ Thêm mới khoản chi thành công!');
      }
      setShowExpenseModal(false);
      fetchExpensesData();
      setTimeout(() => setExpenseFeedback(''), 4000);
    } catch (err) {
      console.error('Lỗi lưu khoản chi:', err);
      setExpenseFeedback('✕ Lưu chi phí thất bại. Vui lòng kiểm tra lại!');
      setTimeout(() => setExpenseFeedback(''), 4000);
    }
  };

  // Xóa khoản chi
  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khoản chi này?')) return;
    try {
      await statisticsApi.deleteExpense(id);
      setExpenseFeedback('✓ Đã xóa khoản chi thành công!');
      fetchExpensesData();
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
        e.type?.toLowerCase().includes(term)
    );
  }, [expensesList, searchTerm]);

  // Phân trang
  const getCurrentItems = () => {
    switch (tableMode) {
      case 'monthly':
        return filteredMonthly;
      case 'daily':
        return filteredRows;
      case 'movies':
        return filteredMovieRows;
      case 'expenses':
        return filteredExpenses;
      default:
        return filteredMonthly;
    }
  };

  const currentItems = getCurrentItems();
  const totalPages = Math.ceil(currentItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentItems.slice(start, start + pageSize);
  }, [currentItems, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Thông báo thao tác nếu có */}
      {expenseFeedback && (
        <div className="p-3 bg-[var(--bg-secondary)] border border-slate-700 rounded-2xl text-xs font-semibold text-emerald-300 shadow-lg animate-fadeIn flex items-center justify-between">
          <span>{expenseFeedback}</span>
          <button onClick={() => setExpenseFeedback('')} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* 1. DÃY 6 CHỈ SỐ TÀI CHÍNH TOÀN DIỆN (DOANH THU - CHI PHÍ - LỢI NHUẬN) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        {/* Chỉ số 1: Doanh thu thuần */}
        <StatisticCard
          title="Doanh Thu Thuần"
          value={metrics.netFormatted || '0 đ'}
          tooltip="Doanh thu thực tế sau khi đã trừ các khoản hoàn vé"
          loading={loading}
          icon="💳"
          iconBg="bg-emerald-500/10 text-emerald-400"
        />

        {/* Chỉ số 2: Tổng chi phí thực tế */}
        <StatisticCard
          title="Tổng Chi Phí"
          value={metrics.expensesFormatted || '0 đ'}
          tooltip="Tổng chi phí phát sinh thực tế gồm bản quyền, marketing và vận hành cụm rạp"
          loading={loading}
          icon="📉"
          iconBg="bg-rose-500/10 text-rose-400"
        />

        {/* Chỉ số 3: Lợi nhuận rạp */}
        <StatisticCard
          title={metrics.profitStatus === 'LOSS' ? 'Lợi Nhuận (Lỗ)' : 'Lợi Nhuận (Lãi)'}
          value={metrics.profitFormatted || '0 đ'}
          subtitle={metrics.profitStatusLabel ? `${metrics.profitStatusLabel} (Biên LN ${metrics.profitMargin}%)` : ''}
          tooltip={`Lợi nhuận = Doanh thu thuần (${metrics.netFormatted}) - Chi phí (${metrics.expensesFormatted})`}
          loading={loading}
          icon={metrics.profitStatus === 'LOSS' ? '⚠️' : '💰'}
          iconBg={metrics.profitStatus === 'LOSS' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}
        />

        {/* Chỉ số 4: Doanh thu vé */}
        <StatisticCard
          title="Doanh Thu Vé"
          value={metrics.ticketFormatted || '0 đ'}
          tooltip="Doanh thu trực tiếp từ bán vé xem phim các định dạng"
          loading={loading}
          icon="🎟️"
          iconBg="bg-blue-500/10 text-blue-400"
        />

        {/* Chỉ số 5: Doanh thu bắp nước */}
        <StatisticCard
          title="Doanh Thu Bắp Nước"
          value={metrics.concessionFormatted || '0 đ'}
          tooltip="Doanh thu từ các combo bắp rang bơ và đồ uống tại quầy Concession"
          loading={loading}
          icon="🍿"
          iconBg="bg-amber-500/10 text-amber-400"
        />

        {/* Chỉ số 6: Tiền đã hoàn */}
        <StatisticCard
          title="Tiền Đã Hoàn"
          value={metrics.refundedFormatted || '0 đ'}
          tooltip="Tổng tiền đã hoàn lại cho khách hàng do hủy vé"
          loading={loading}
          icon="↩️"
          iconBg="bg-slate-700/40 text-slate-300"
        />
      </div>

      {/* 2. BIỂU ĐỒ DOANH THU TOÀN RẠP (VÉ XEM PHIM & BẮP NƯỚC) */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Biểu Đồ Doanh Thu Toàn Rạp</h3>
            <p className="text-xs text-slate-400">
              Diễn biến doanh thu thực tế phân tách giữa Vé xem phim và Dịch vụ Bắp nước theo các ngày
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            Thực thu qua các cổng
          </span>
        </div>

        <RevenueChart data={data?.revenueChartData || []} loading={loading} />
      </div>

      {/* 3. CƠ CẤU CHI PHÍ THỰC TẾ & CƠ CẤU DOANH THU */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Khối Cơ Cấu Chi Phí Thực Tế Rạp (6 Danh Mục Chuẩn) */}
        <div className="lg:col-span-6 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Cơ Cấu Chi Phí Hoạt Động Rạp</h3>
              <p className="text-xs text-slate-400">Phân bổ 6 nhóm chi phí thực tế phục vụ tính lãi/lỗ</p>
            </div>
            <span className="text-xs font-semibold text-rose-400">Chi phí thực tế</span>
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
                    className="h-full bg-gradient-to-r from-rose-600 to-amber-600 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, cat.percent)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[var(--border-default)]/80 text-[11px] text-slate-400 leading-relaxed">
            💡 Chi phí bản quyền phim chiếm tỷ trọng lớn nhất (~46% doanh thu vé), tiếp theo là chi phí điện nước điều hòa và nhân sự vận hành.
          </div>
        </div>

        {/* Khối Cơ Cấu Doanh Thu Sản Phẩm & Thanh Toán */}
        <div className="lg:col-span-6 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Cơ Cấu Doanh Thu & Cổng Thanh Toán</h3>
              <p className="text-xs text-slate-400">Đóng góp giữa Vé xem phim, Bắp nước và Cổng MoMo/VNPAY</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">Tỷ trọng %</span>
          </div>

          {/* Thanh Vé xem phim */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-600"></span>
                  <span>Vé xem phim ({metrics.ticketPercent || 0}%)</span>
                </span>
                <span className="font-bold text-emerald-400">{metrics.ticketFormatted || '0 đ'}</span>
              </div>
              <div className="h-2.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 rounded-full transition-all duration-700"
                  style={{ width: `${metrics.ticketPercent || 0}%` }}
                ></div>
              </div>
            </div>

            {/* Thanh Bắp nước */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                  <span>Bắp nước & Combo ({metrics.concessionPercent || 0}%)</span>
                </span>
                <span className="font-bold text-amber-400">{metrics.concessionFormatted || '0 đ'}</span>
              </div>
              <div className="h-2.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-700"
                  style={{ width: `${metrics.concessionPercent || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Cổng thanh toán */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-default)]">
            {paymentMethods.map((pm) => (
              <div
                key={pm.method}
                className="p-2.5 rounded-xl bg-[var(--bg-surface)]/50 border border-slate-700/50 text-center"
              >
                <span className="text-[10px] text-slate-400 block font-semibold">
                  {pm.method === 'MOMO' ? '🌸 MoMo' : pm.method === 'VNPAY' ? '💳 VNPAY' : '💵 Tiền mặt'}
                </span>
                <span className="text-xs font-bold text-white block mt-0.5">{pm.percent}%</span>
                <span className="text-[10px] text-slate-500 block truncate">{formatCurrency(pm.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. BẢNG BÁO CÁO KINH DOANH CHUYÊN SÂU & QUẢN LÝ CHI PHÍ */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-default)]/80 pb-4">
          <div className="flex items-center space-x-3">
            <div>
              <h3 className="text-base font-bold text-white">Báo Cáo & Quản Lý Tài Chính Rạp</h3>
              <p className="text-xs text-slate-400">Xem báo cáo 12 tháng, chi tiết theo ngày, phim và quản lý chi phí</p>
            </div>

            {/* Chuyển đổi 4 chế độ bảng */}
            <div className="bg-[var(--bg-surface)] p-1 rounded-xl flex items-center space-x-1 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTableMode('monthly');
                  setCurrentPage(1);
                  setSearchTerm('');
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  tableMode === 'monthly' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                12 Tháng
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableMode('daily');
                  setCurrentPage(1);
                  setSearchTerm('');
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  tableMode === 'daily' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Theo ngày
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableMode('movies');
                  setCurrentPage(1);
                  setSearchTerm('');
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  tableMode === 'movies' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Theo phim
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableMode('expenses');
                  setCurrentPage(1);
                  setSearchTerm('');
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  tableMode === 'expenses' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Quản lý chi phí ({expensesList.length})
              </button>
            </div>
          </div>

          {/* Ô tìm kiếm & Nút thêm khoản chi */}
          <div className="flex items-center space-x-2.5">
            <input
              type="text"
              placeholder="Tìm kiếm nội dung..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 w-44 sm:w-52"
            />
            {tableMode === 'expenses' && (
              <button
                type="button"
                onClick={handleOpenAddExpense}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>+ Thêm chi phí</span>
              </button>
            )}
          </div>
        </div>

        {/* BẢNG 1: BÁO CÁO 12 THÁNG KINH DOANH TRONG NĂM (YÊU CẦU 1 CỦA GIẢNG VIÊN) */}
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
                  <th className="py-3 px-3 text-center">Tỷ suất LN</th>
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
                          m.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {m.formattedProfit}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-300">
                        {m.profitMargin}%
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            m.profitStatus === 'PROFIT'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {m.statusLabel}
                        </span>
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

        {/* BẢNG 2: BÁO CÁO DOANH THU THEO NGÀY */}
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
                  <th className="py-3 px-4 text-right font-black text-emerald-400">Lợi nhuận</th>
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
                        {formatCurrency(r.profit || r.netRev)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-500">
                      Không tìm thấy dữ liệu doanh thu phù hợp
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BẢNG 3: BÁO CÁO DOANH THU THEO TỪNG PHIM */}
        {tableMode === 'movies' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4 min-w-[200px]">Bộ phim</th>
                  <th className="py-3 px-3 text-center">Số đơn vé</th>
                  <th className="py-3 px-3 text-center">Số vé bán</th>
                  <th className="py-3 px-4 text-right">Doanh thu vé</th>
                  <th className="py-3 px-4 text-right text-amber-400">Doanh thu bắp nước</th>
                  <th className="py-3 px-4 text-right font-black text-emerald-400">Tổng doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((mv, idx) => (
                    <tr key={mv.movieId || idx} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={mv.poster}
                            alt={mv.title}
                            className="w-9 h-12 rounded-lg object-cover shrink-0 border border-slate-700 shadow"
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop';
                            }}
                          />
                          <span className="font-bold text-white truncate">{mv.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-medium">{formatNumber(mv.orders)}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-200">{formatNumber(mv.tickets)}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{formatCurrency(mv.ticketRevenue)}</td>
                      <td className="py-3 px-4 text-right text-amber-400">{formatCurrency(mv.concessionRevenue)}</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-400">{formatCurrency(mv.totalRevenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500">
                      Chưa có dữ liệu doanh thu phim
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BẢNG 4: QUẢN LÝ DANH MỤC CHI PHÍ THỰC TẾ (EXPENSE MANAGEMENT) */}
        {tableMode === 'expenses' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Mã chi phí</th>
                  <th className="py-3 px-4 min-w-[200px]">Tên khoản chi</th>
                  <th className="py-3 px-3">Phân loại</th>
                  <th className="py-3 px-3">Phim liên quan</th>
                  <th className="py-3 px-3 text-center">Ngày chi</th>
                  <th className="py-3 px-4 text-right font-black text-rose-400">Số tiền (đ)</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {loadingExpenses ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      Đang tải danh sách chi phí...
                    </td>
                  </tr>
                ) : paginatedItems.length > 0 ? (
                  paginatedItems.map((exp) => (
                    <tr key={exp._id || exp.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400 font-bold">{exp.costCode}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-white block">{exp.title}</span>
                        {exp.notes && <span className="text-[10px] text-slate-500 block">{exp.notes}</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className="bg-[var(--bg-surface)] text-slate-300 px-2 py-0.5 rounded text-[10px] border border-slate-700">
                          {EXPENSE_TYPES.find((t) => t.value === exp.type)?.label || exp.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 truncate max-w-[150px]">
                        {exp.movieId?.title || 'Dùng chung toàn rạp'}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {new Date(exp.date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-400">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditExpense(exp)}
                            className="px-2 py-1 bg-[var(--bg-surface)] hover:bg-slate-700 text-slate-300 rounded text-[11px] cursor-pointer"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp._id || exp.id)}
                            className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded text-[11px] cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      Chưa có khoản chi phí nào được ghi nhận.
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

      {/* MODAL THÊM / SỬA KHOẢN CHI THỰC TẾ */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="text-base font-bold text-white">
                {editingExpense ? 'Chỉnh Sửa Khoản Chi' : 'Thêm Khoản Chi Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="w-7 h-7 rounded-full bg-[var(--bg-surface)] hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
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
                  placeholder="Ví dụ: Phí bản quyền phim Captain America..."
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Phân loại chi phí *</label>
                  <select
                    value={expenseForm.type}
                    onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500 cursor-pointer"
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
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              {['DIRECT_MOVIE', 'MARKETING'].includes(expenseForm.type) && (
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Phim liên quan (nếu có)</label>
                  <select
                    value={expenseForm.movieId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, movieId: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="">-- Dùng chung toàn rạp (Không gắn phim) --</option>
                    {moviesList.map((m) => (
                      <option key={m._id || m.id} value={m._id || m.id} className="bg-[var(--bg-secondary)] text-white">
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Ngày phát sinh chi phí *</label>
                <input
                  type="date"
                  required
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Ghi chú / Chứng từ</label>
                <textarea
                  rows="2"
                  placeholder="Ghi chú hóa đơn hoặc mã hợp đồng..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500"
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
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/30 cursor-pointer"
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
