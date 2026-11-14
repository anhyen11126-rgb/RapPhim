import React, { useState, useEffect, useMemo, useRef } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';
import {
  RefreshCw,
  Download,
  Search,
  Flame,
  Film,
  Users,
  Armchair,
  Lock,
  Unlock,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  FileSpreadsheet,
} from 'lucide-react';

const ShowtimeOccupancyPage = () => {
  // State quản lý dữ liệu
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState({
    totalShowtimes: 0,
    activeCinemasCount: 0,
    imaxRoomsCount: 0,
    totalCapacity: 0,
    totalBooked: 0,
    totalAvailable: 0,
    overallOccupancyRate: 0,
    growthTrend: '+12.4%',
    totalCustomers: 0,
    avgTicketsPerCustomer: 0,
    totalCancelled: 0,
    nearSoldOutCount: 0,
  });
  const [formatCounts, setFormatCounts] = useState({
    all: 0,
    imax: 0,
    atmos: 0,
    digital3d: 0,
    vip: 0,
  });
  const [showtimes, setShowtimes] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(null);

  // Bộ lọc
  const [dateFilter, setDateFilter] = useState('today'); // 'today', 'tomorrow', 'weekend', 'all'
  const [cinemaFilter, setCinemaFilter] = useState('ALL');
  const [formatFilter, setFormatFilter] = useState('ALL'); // 'ALL', 'IMAX Laser', '2D Atmos', '3D Digital', 'VIP Gold Class'
  const [searchQuery, setSearchQuery] = useState('');

  // Tự động làm mới
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [countdown, setCountdown] = useState(30);

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals & Popups
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    roomName: '',
    startTime: '',
    price: 95000,
    formatFeature: '',
  });
  const [lockingAction, setLockingAction] = useState(false);
  const [hoveredSeat, setHoveredSeat] = useState(null);

  // Ngày động hiển thị tab
  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = `${String(tomorrowDate.getDate()).padStart(2, '0')}/${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}`;

  // Tải danh sách rạp
  useEffect(() => {
    fetchCinemas();
  }, []);

  // Tải dữ liệu chính khi đổi bộ lọc
  useEffect(() => {
    fetchAnalytics();
  }, [dateFilter, cinemaFilter, formatFilter]);

  // Bộ đếm đếm ngược tự động làm mới sau 30s
  useEffect(() => {
    if (!autoSyncEnabled) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchAnalytics(false);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoSyncEnabled, dateFilter, cinemaFilter, formatFilter, searchQuery]);

  const fetchCinemas = async () => {
    try {
      const res = await api.get('/admin/cinemas');
      setCinemas(res.data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách rạp:', err);
    }
  };

  const fetchAnalytics = async (isManual = true) => {
    try {
      if (isManual) setSyncing(true);
      const params = {
        date: dateFilter,
        cinemaId: cinemaFilter,
        format: formatFilter,
        search: searchQuery,
      };
      const res = await api.get('/admin/showtimes-occupancy', { params });
      if (res.data?.success) {
        setSummary(res.data.summary || {});
        setFormatCounts(res.data.formatCounts || {});
        const list = res.data.showtimes || [];
        setShowtimes(list);

        // Giữ suất chiếu đang chọn hoặc tự động chọn suất đầu tiên
        if (list.length > 0) {
          setSelectedShowtimeId((prevId) => {
            const exists = list.some((item) => item.id === prevId);
            return exists ? prevId : list[0].id;
          });
        } else {
          setSelectedShowtimeId(null);
        }
      }
    } catch (err) {
      console.error('Lỗi tải thống kê tỷ lệ lấp đầy:', err);
    } finally {
      setLoading(false);
      setSyncing(false);
      setCountdown(30);
    }
  };

  // Suất chiếu đang được chọn trong Live Seat Matrix
  const selectedShowtime = useMemo(() => {
    return showtimes.find((st) => st.id === selectedShowtimeId) || showtimes[0] || null;
  }, [showtimes, selectedShowtimeId]);

  // Lọc kết quả tìm kiếm client-side để phản hồi tức thì
  const filteredShowtimes = useMemo(() => {
    if (!searchQuery.trim()) return showtimes;
    const q = searchQuery.toLowerCase().trim();
    return showtimes.filter(
      (st) =>
        st.movie?.title?.toLowerCase().includes(q) ||
        st.code?.toLowerCase().includes(q) ||
        st.cinema?.name?.toLowerCase().includes(q) ||
        st.screen?.toLowerCase().includes(q)
    );
  }, [showtimes, searchQuery]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredShowtimes.length / itemsPerPage));
  const paginatedShowtimes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredShowtimes.slice(start, start + itemsPerPage);
  }, [filteredShowtimes, currentPage]);

  // Khóa / Mở khóa suất chiếu
  const handleToggleLock = async () => {
    if (!selectedShowtime) return;
    try {
      setLockingAction(true);
      const res = await api.put(`/admin/showtimes/${selectedShowtime.id}/toggle-lock`);
      if (res.data?.success) {
        setShowtimes((prev) =>
          prev.map((st) => (st.id === selectedShowtime.id ? { ...st, isLocked: res.data.isLocked } : st))
        );
      }
    } catch (err) {
      alert('Lỗi cập nhật trạng thái khóa: ' + (err.response?.data?.message || err.message));
    } finally {
      setLockingAction(false);
    }
  };

  // Mở modal đổi phòng / giờ chiếu
  const handleOpenEditModal = () => {
    if (!selectedShowtime) return;
    const localIso = selectedShowtime.startTime
      ? new Date(new Date(selectedShowtime.startTime).getTime() - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : '';
    setEditFormData({
      roomName: selectedShowtime.screen || '',
      startTime: localIso,
      price: selectedShowtime.price || 95000,
      formatFeature: selectedShowtime.format || '',
    });
    setIsEditModalOpen(true);
  };

  // Lưu chỉnh sửa suất chiếu
  const handleSaveEditShowtime = async (e) => {
    e.preventDefault();
    if (!selectedShowtime) return;
    try {
      await api.put(`/admin/showtimes/${selectedShowtime.id}`, editFormData);
      setIsEditModalOpen(false);
      fetchAnalytics(true);
    } catch (err) {
      alert('Lỗi cập nhật suất chiếu: ' + (err.response?.data?.message || err.message));
    }
  };

  // Xuất báo cáo CSV / Excel
  const handleExportCSV = () => {
    if (filteredShowtimes.length === 0) {
      alert('Không có dữ liệu suất chiếu để xuất báo cáo!');
      return;
    }
    const headers = [
      'Mã Suất',
      'Tên Phim',
      'Định Dạng',
      'Cụm Rạp',
      'Phòng Chiếu',
      'Khung Giờ',
      'Trạng Thái',
      'Số Khách Mua',
      'Ghế Đã Đặt',
      'Tổng Ghế',
      'Tỷ Lệ Lấp Đầy (%)',
      'Trạng Thái Khóa',
    ];

    const rows = filteredShowtimes.map((st) => [
      st.code,
      `"${(st.movie?.title || '').replace(/"/g, '""')}"`,
      `"${st.format}"`,
      `"${(st.cinema?.name || '').replace(/"/g, '""')}"`,
      `"${st.screen}"`,
      `"${st.timeRange}"`,
      st.statusLabel,
      st.customerCount,
      st.bookedSeats,
      st.totalSeats,
      st.occupancyPercent,
      st.isLocked ? 'Đã khóa' : 'Mở bán',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BaoCao_TyLeLapDay_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Gom nhóm ghế theo hàng cho Live Seat Matrix
  const seatRows = useMemo(() => {
    if (!selectedShowtime?.seatMatrix) return {};
    const grouped = {};
    for (const seat of selectedShowtime.seatMatrix) {
      if (!grouped[seat.row]) grouped[seat.row] = [];
      grouped[seat.row].push(seat);
    }
    // Sắp xếp các ghế trong mỗi hàng theo số cột tăng dần
    for (const r of Object.keys(grouped)) {
      grouped[r].sort((a, b) => a.col - b.col);
    }
    return grouped;
  }, [selectedShowtime]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-red-500 selection:text-white">
      {/* Sidebar Admin điều hướng */}
      <SidebarAdmin />

      {/* Vùng nội dung chính */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Breadcrumb & Tiêu đề trang */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1.5 font-medium">
                <span>Báo cáo & Phân tích</span>
                <span className="text-slate-600">›</span>
                <span>Vận hành Phòng vé</span>
                <span className="text-slate-600">›</span>
                <span className="text-red-400 font-semibold">Thống kê Suất chiếu & Tỷ lệ lấp đầy</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                Thống kê Suất chiếu & Tỷ lệ lấp đầy
              </h1>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  DỮ LIỆU THỜI GIAN THỰC • AUTO-SYNC 30S
                </span>
                <span className="hidden sm:inline text-slate-500">|</span>
                <span className="hidden sm:inline">
                  Giám sát lượng khách đặt vé, ghế đã bán và công suất phòng chiếu từng rạp theo thời gian thực.
                </span>
              </div>
            </div>

            {/* Action buttons góc trên */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => fetchAnalytics(true)}
                disabled={syncing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-60"
                title="Làm mới ma trận ghế và tỷ lệ lấp đầy"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-red-400' : 'text-slate-400'}`} />
                <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ hệ thống vé'}</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất báo cáo (Excel/PDF)</span>
              </button>
            </div>
          </div>

          {/* Cụm 4 KPI Cards thống kê hàng đầu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Tổng suất chiếu hôm nay */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all shadow-md relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Tổng suất chiếu hôm nay</span>
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Film className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{summary.totalShowtimes || 0}</span>
                <span className="text-xs text-slate-400 font-medium">suất chiếu</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>{summary.activeCinemasCount || 1} cụm rạp hoạt động</span>
                <span className="text-amber-400 font-semibold">{summary.imaxRoomsCount || 0} phòng IMAX Laser</span>
              </div>
            </div>

            {/* Card 2: Tổng ghế đã đặt / Khả dụng */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all shadow-md relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Tổng ghế đã đặt / Khả dụng</span>
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <Armchair className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white">
                  {(summary.totalBooked || 0).toLocaleString('vi-VN')}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  / {(summary.totalCapacity || 0).toLocaleString('vi-VN')} ghế
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>
                  Tỷ lệ lấp đầy TB:{' '}
                  <strong className="text-white font-bold">{summary.overallOccupancyRate || 0}%</strong>
                </span>
                <span className="inline-flex items-center text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">
                  {summary.growthTrend || '+12.4%'}
                </span>
              </div>
            </div>

            {/* Card 3: Lượng khách đặt vé thành công */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all shadow-md relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Lượng khách đặt vé thành công</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">
                  {(summary.totalCustomers || 0).toLocaleString('vi-VN')}
                </span>
                <span className="text-xs text-slate-400 font-medium">khách</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>
                  Bình quân: <strong className="text-slate-200">{summary.avgTicketsPerCustomer || 2.0}</strong> vé/khách
                </span>
                <span className="text-slate-400">{summary.totalCancelled || 0} hủy hoàn</span>
              </div>
            </div>

            {/* Card 4: Suất chiếu sắp cháy vé (>80%) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/20 via-slate-900/90 to-slate-900/50 border border-amber-500/30 hover:border-amber-500/50 transition-all shadow-md relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-300">
                <span>Suất chiếu sắp cháy vé (&gt;80%)</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">{summary.nearSoldOutCount || 0}</span>
                <span className="text-xs text-amber-300/80 font-medium">suất chiếu</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center text-[11px] text-amber-300/90 font-medium">
                <span>! Tăng cường nhân sự quầy & soát vé</span>
              </div>
            </div>
          </div>

          {/* Thanh công cụ tìm kiếm & Bộ lọc nhanh */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3.5">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Ô tìm kiếm */}
              <div className="relative flex-1 min-w-[280px]">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo Tên phim, Mã suất (#SC-DUNE...)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Nhóm nút chọn ngày */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950/90 rounded-xl border border-slate-800 shrink-0">
                <button
                  onClick={() => {
                    setDateFilter('today');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    dateFilter === 'today'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hôm nay ({todayStr})
                </button>
                <button
                  onClick={() => {
                    setDateFilter('tomorrow');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    dateFilter === 'tomorrow'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ngày mai ({tomorrowStr})
                </button>
                <button
                  onClick={() => {
                    setDateFilter('weekend');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    dateFilter === 'weekend'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cuối tuần
                </button>
                <button
                  onClick={() => {
                    setDateFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    dateFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tất cả
                </button>
              </div>

              {/* Dropdown chọn Cụm rạp */}
              <div className="shrink-0">
                <select
                  value={cinemaFilter}
                  onChange={(e) => {
                    setCinemaFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-950/90 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 transition-all cursor-pointer w-full sm:w-auto"
                >
                  <option value="ALL">Tất cả cụm rạp</option>
                  {cinemas.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.name} ({c.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hàng nút lọc theo Định dạng phòng chiếu (Format pills) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] uppercase font-bold text-slate-500 mr-1 tracking-wider">ĐỊNH DẠNG:</span>
                {[
                  { key: 'ALL', label: 'Tất cả', count: formatCounts.all || 0 },
                  { key: 'IMAX Laser', label: 'IMAX Laser', count: formatCounts.imax || 0 },
                  { key: '2D Atmos', label: '2D Atmos', count: formatCounts.atmos || 0 },
                  { key: '3D Digital', label: '3D Digital', count: formatCounts.digital3d || 0 },
                  { key: 'VIP Gold Class', label: 'VIP Gold Class', count: formatCounts.vip || 0 },
                ].map((pill) => (
                  <button
                    key={pill.key}
                    onClick={() => {
                      setFormatFilter(pill.key);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      formatFilter === pill.key
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                        : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {pill.label} ({pill.count})
                  </button>
                ))}
              </div>

              {/* Chú thích màu sắc */}
              <div className="flex items-center gap-3.5 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span>Ghế đã đặt (Booked)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Ghế trống (Available)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>Sắp cháy vé (&gt;80%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bố cục 2 cột chính: Bảng danh sách suất chiếu (Trái) & Live Seat Matrix (Phải) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Cột trái: Bảng danh sách suất chiếu */}
            <div className="xl:col-span-7 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
              {/* Tiêu đề bảng */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">📋</span>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Danh sách Suất chiếu & Tỷ lệ lấp đầy
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-semibold">
                    {filteredShowtimes.length} / {showtimes.length} Suất
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Chỉ ghi nhận giao dịch thanh toán thành công
                </span>
              </div>

              {/* Bảng dữ liệu */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800/80">
                    <tr>
                      <th className="py-3 px-3.5">MÃ SUẤT</th>
                      <th className="py-3 px-3.5">PHIM & ĐỊNH DẠNG</th>
                      <th className="py-3 px-3.5">RẠP & THỜI GIAN</th>
                      <th className="py-3 px-3.5 text-center">KHÁCH MUA</th>
                      <th className="py-3 px-3.5">GHẾ ĐẶT / TRỐNG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
                          Đang tải dữ liệu suất chiếu và ma trận ghế...
                        </td>
                      </tr>
                    ) : paginatedShowtimes.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-slate-400">
                          Không tìm thấy suất chiếu nào phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      paginatedShowtimes.map((st) => {
                        const isSelected = selectedShowtime?.id === st.id;
                        const isDanger = st.occupancyPercent >= 80;
                        return (
                          <tr
                            key={st.id}
                            onClick={() => setSelectedShowtimeId(st.id)}
                            className={`cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-600/15 border-l-4 border-l-blue-500 text-white shadow-inner'
                                : 'hover:bg-slate-800/50 text-slate-300'
                            }`}
                          >
                            {/* Mã suất */}
                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              <div className="font-bold text-slate-200 text-xs tracking-tight">{st.code}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{st.screen}</div>
                              {st.isLocked && (
                                <span className="inline-flex items-center gap-1 mt-1 text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                                  <Lock className="w-2.5 h-2.5" /> Đã khóa
                                </span>
                              )}
                            </td>

                            {/* Phim & Định dạng */}
                            <td className="py-3.5 px-3.5">
                              <div className="flex items-center gap-2.5 min-w-[200px]">
                                <img
                                  src={st.movie?.posterUrl}
                                  alt={st.movie?.title}
                                  className="w-9 h-12 rounded object-cover shrink-0 border border-slate-700/80 shadow"
                                  onError={(e) => {
                                    e.target.src =
                                      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200';
                                  }}
                                />
                                <div>
                                  <div className="font-bold text-white line-clamp-1 text-xs">
                                    {st.movie?.title}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      {st.movie?.ageRating || 'P'}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${st.formatColor}`}
                                    >
                                      {st.format}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Rạp & Thời gian */}
                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              <div className="font-bold text-white text-xs">{st.timeRange}</div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                                {st.cinema?.name}
                              </div>
                              <div className="mt-1">
                                <span
                                  className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    st.status === 'HAPPENING'
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                      : st.status === 'UPCOMING'
                                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {st.statusLabel}
                                </span>
                              </div>
                            </td>

                            {/* Khách mua */}
                            <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                              <div className="font-bold text-slate-200">{st.customerCount} khách</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                ({st.avgTicketsPerCustomer} vé)
                              </div>
                            </td>

                            {/* Ghế đặt / Trống */}
                            <td className="py-3.5 px-3.5 min-w-[160px]">
                              <div className="flex items-center justify-between text-[11px] mb-1 font-semibold">
                                <span className={isDanger ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                                  {st.bookedSeats} / {st.totalSeats}
                                </span>
                                <span className={isDanger ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                                  {st.occupancyPercent}%
                                </span>
                              </div>
                              {/* Thanh tiến trình tỷ lệ lấp đầy */}
                              <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800/80">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isDanger
                                      ? 'bg-gradient-to-r from-amber-500 to-red-500 shadow-sm shadow-red-500/30'
                                      : 'bg-gradient-to-r from-blue-500 to-emerald-400'
                                  }`}
                                  style={{ width: `${Math.min(100, st.occupancyPercent)}%` }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Chân bảng: Bộ đếm tự động làm mới & Phân trang */}
              <div className="p-3.5 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <span>
                    Tự động làm mới sau <strong className="text-slate-200">{countdown}s</strong>
                  </span>
                  <button
                    onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title={autoSyncEnabled ? 'Tạm dừng auto-refresh' : 'Bật lại auto-refresh'}
                  >
                    {autoSyncEnabled ? '⏸' : '▶'}
                  </button>
                </div>

                {/* Nút phân trang */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        currentPage === page
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Cột phải: Live Seat Matrix Panel */}
            <div className="xl:col-span-5 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-xl relative space-y-4">
              {selectedShowtime ? (
                <>
                  {/* Header Live Seat Matrix */}
                  <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                        <span>LIVE SEAT MATRIX</span>
                      </div>
                      <h3 className="text-base font-black text-white mt-1 line-clamp-1">
                        {selectedShowtime.movie?.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedShowtime.code} • {selectedShowtime.format} ({selectedShowtime.screen})
                      </p>
                    </div>

                    <button
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Xem toàn màn hình danh sách khách"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 3 Khối chỉ số nhanh: Đã đặt, Còn trống, Khách mua */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Đã đặt</div>
                      <div className="text-xl font-black text-red-400 mt-0.5">
                        {selectedShowtime.bookedSeats}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {selectedShowtime.occupancyPercent}% lấp đầy
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Còn trống</div>
                      <div className="text-xl font-black text-emerald-400 mt-0.5">
                        {selectedShowtime.availableSeats}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {(100 - selectedShowtime.occupancyPercent).toFixed(1)}% còn lại
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Khách mua</div>
                      <div className="text-xl font-black text-blue-400 mt-0.5">
                        {selectedShowtime.customerCount}
                      </div>
                      <div className="text-[10px] text-slate-400">0 vé hoàn trả</div>
                    </div>
                  </div>

                  {/* Mô phỏng Màn hình chiếu cong IMAX */}
                  <div className="pt-2 text-center">
                    <div className="relative mx-auto w-4/5 h-6">
                      <div className="w-full h-2 rounded-t-full border-t-2 border-cyan-400 shadow-[0_-8px_20px_rgba(34,211,238,0.35)]"></div>
                      <span className="text-[10px] uppercase tracking-widest font-black text-cyan-300/80">
                        MÀN HÌNH CHIẾU CONG {selectedShowtime.formatCategory === 'IMAX Laser' ? 'IMAX' : 'DOLBY'}
                      </span>
                    </div>
                  </div>

                  {/* Ma trận ghế trực quan (Visual Seat Grid) */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                    <div className="min-w-[340px] space-y-1.5 py-1">
                      {Object.keys(seatRows).map((rowLetter) => (
                        <div key={rowLetter} className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="w-4 font-bold text-slate-400 text-center">{rowLetter}</span>
                          <div className="flex-1 flex items-center justify-center gap-1">
                            {seatRows[rowLetter].map((seat) => {
                              const isBooked = seat.status === 'BOOKED';
                              const isVip = seat.type === 'VIP';
                              const isSweetbox = seat.type === 'SWEETBOX';

                              let seatBg = 'bg-emerald-500/80 hover:bg-emerald-400 border-emerald-400/40 text-white';
                              if (isBooked) {
                                seatBg = 'bg-red-500/85 border-red-500/40 text-white';
                              } else if (isVip) {
                                seatBg = 'bg-amber-500/80 hover:bg-amber-400 border-amber-400/40 text-black';
                              } else if (isSweetbox) {
                                seatBg = 'bg-pink-500/80 hover:bg-pink-400 border-pink-400/40 text-white';
                              }

                              return (
                                <button
                                  key={seat.id}
                                  onMouseEnter={() => setHoveredSeat(seat)}
                                  onMouseLeave={() => setHoveredSeat(null)}
                                  className={`h-4.5 rounded text-[9px] font-bold flex items-center justify-center transition-all border shadow-sm ${
                                    isSweetbox ? 'w-8' : 'w-5'
                                  } ${seatBg}`}
                                  title={`${seat.seatNumber} (${seat.type}) - ${
                                    isBooked ? 'Đã đặt' : 'Còn trống'
                                  }`}
                                >
                                  {seat.col}
                                </button>
                              );
                            })}
                          </div>
                          <span className="w-4 font-bold text-slate-400 text-center">{rowLetter}</span>
                        </div>
                      ))}
                    </div>

                    {/* Tooltip hiển thị chi tiết ghế khi rê chuột */}
                    <div className="mt-2 text-center text-[11px] text-slate-400 h-4 font-medium">
                      {hoveredSeat ? (
                        <span className="text-white">
                          Ghế <strong className="text-amber-400">{hoveredSeat.seatNumber}</strong> ({hoveredSeat.type}) •{' '}
                          {hoveredSeat.status === 'BOOKED' ? (
                            <span className="text-red-400 font-bold">
                              Đã bán ({hoveredSeat.customerName || 'Khách đã mua'})
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold">
                              Còn trống ({hoveredSeat.price?.toLocaleString('vi-VN')}đ)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>Rê chuột lên ghế để xem chi tiết vị trí & trạng thái</span>
                      )}
                    </div>
                  </div>

                  {/* Chú thích màu ma trận */}
                  <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-red-500"></span>
                      <span>Ghế đã đặt (Booked)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                      <span>Ghế còn trống</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
                      <span>Hàng VIP Center</span>
                    </div>
                  </div>

                  {/* Nút chính: Xem danh sách khách mua */}
                  <button
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition active:scale-98"
                  >
                    <Users className="w-4 h-4" />
                    <span>Xem danh sách {selectedShowtime.customerCount} khách mua</span>
                  </button>

                  {/* 2 Nút phụ: Đổi phòng/giờ & Khóa suất chiếu */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      onClick={handleOpenEditModal}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700/60"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                      <span>Đổi phòng / giờ chiếu</span>
                    </button>

                    <button
                      onClick={handleToggleLock}
                      disabled={lockingAction}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                        selectedShowtime.isLocked
                          ? 'bg-amber-600/20 border-amber-500/40 text-amber-300 hover:bg-amber-600/30'
                          : 'bg-red-600/20 border-red-500/40 text-red-300 hover:bg-red-600/30'
                      }`}
                    >
                      {selectedShowtime.isLocked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Mở khóa suất</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-red-400" />
                          <span>Khóa suất chiếu</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Thông báo giao dịch mới nhất (Live Ticker) */}
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      <span className="font-bold text-slate-300">Giao dịch mới nhất:</span>{' '}
                      <span className="text-emerald-400 font-semibold">+2 vé</span> (Ghế E7, E8 vừa thanh toán)
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">1 phút trước</span>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-slate-400 text-xs">
                  Vui lòng chọn 1 suất chiếu từ bảng bên trái để xem Live Seat Matrix.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modal 1: Danh sách khách hàng đã mua vé của suất chiếu */}
      {isCustomerModalOpen && selectedShowtime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Danh sách khách mua vé • {selectedShowtime.movie?.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mã suất: {selectedShowtime.code} • {selectedShowtime.timeRange} ({selectedShowtime.screen})
                </p>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {selectedShowtime.customerBookings?.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Chưa có giao dịch khách mua vé thành công cho suất chiếu này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">MÃ ĐƠN</th>
                        <th className="py-2.5 px-3">KHÁCH HÀNG</th>
                        <th className="py-2.5 px-3">SỐ ĐIỆN THOẠI</th>
                        <th className="py-2.5 px-3">GHẾ MUA</th>
                        <th className="py-2.5 px-3 text-right">TỔNG TIỀN</th>
                        <th className="py-2.5 px-3 text-right">GIỜ ĐẶT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {selectedShowtime.customerBookings?.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-800/40 text-slate-300">
                          <td className="py-2.5 px-3 font-bold text-blue-400">{b.bookingCode}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{b.customerName}</td>
                          <td className="py-2.5 px-3 text-slate-400">{b.customerPhone}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                              {b.seats}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                            {(b.totalAmount || 0).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-400">
                            {new Date(b.createdAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Tổng cộng: <strong className="text-white">{selectedShowtime.customerBookings?.length || 0}</strong> đơn
                đặt vé
              </span>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Đổi phòng / giờ chiếu / giá vé */}
      {isEditModalOpen && selectedShowtime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                Điều chỉnh Suất chiếu • {selectedShowtime.code}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditShowtime} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tên phòng chiếu / Screen</label>
                <input
                  type="text"
                  required
                  value={editFormData.roomName}
                  onChange={(e) => setEditFormData({ ...editFormData, roomName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Thời gian bắt đầu chiếu</label>
                <input
                  type="datetime-local"
                  required
                  value={editFormData.startTime}
                  onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Giá vé cơ bản (VNĐ)</label>
                <input
                  type="number"
                  min="30000"
                  step="5000"
                  required
                  value={editFormData.price}
                  onChange={(e) => setEditFormData({ ...editFormData, price: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tính năng định dạng (Format feature)</label>
                <input
                  type="text"
                  value={editFormData.formatFeature}
                  onChange={(e) => setEditFormData({ ...editFormData, formatFeature: e.target.value })}
                  placeholder="Ví dụ: IMAX Laser 3D • Âm thanh vòm 12 kênh"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/30"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowtimeOccupancyPage;

