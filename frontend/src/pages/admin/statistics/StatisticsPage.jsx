import React, { useState, useEffect, useCallback, useRef } from 'react';
import SidebarAdmin from '../../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../../components/admin/TopbarAdmin';
import StatisticsHeader from './components/StatisticsHeader';
import StatisticsFilter, {
  CINEMA_OPERATION_START_YEAR,
  CINEMA_OPERATION_START_MONTH,
} from './components/StatisticsFilter';
import OverviewTab from './tabs/OverviewTab';
import RevenueTab from './tabs/RevenueTab';
import MoviesTab from './tabs/MoviesTab';
import ShowtimesTab from './tabs/ShowtimesTab';
import MovieDetailDrawer from './drawers/MovieDetailDrawer';
import ShowtimeDetailDrawer from './drawers/ShowtimeDetailDrawer';
import statisticsApi from './services/statisticsApi';

const TABS = [
  { id: 'overview', label: 'Tổng hợp', icon: '📊' },
  { id: 'revenue', label: 'Doanh thu & Chi phí', icon: '💳' },
  { id: 'efficiency', label: 'Hiệu suất', icon: '🎬' },
];

const StatisticsPage = () => {
  // Tab hiện tại
  const [activeTab, setActiveTab] = useState('overview');
  const [efficiency, setEfficiency] = useState('movies');
  const activeReport = activeTab === 'efficiency' ? efficiency : activeTab;

  const [filters, setFilters] = useState(() => {
    const parts = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date());
    const rawMonth = Number(parts.find((part) => part.type === 'month').value);
    const rawYear = Number(parts.find((part) => part.type === 'year').value);
    const validYear = Math.max(CINEMA_OPERATION_START_YEAR, rawYear);
    const validMonth =
      validYear === CINEMA_OPERATION_START_YEAR
        ? Math.max(CINEMA_OPERATION_START_MONTH, rawMonth)
        : rawMonth;

    return {
      timeRange: 'by_month',
      month: validMonth,
      year: validYear,
      customStart: '',
      customEnd: '',
      movieId: 'ALL',
      roomId: 'ALL',
      roomType: 'ALL',
      room: 'ALL',
      sortBy: 'ticketsSold',
      sortOrder: 'desc',
      status: 'ALL',
      page: 1,
    };
  });

  // Dữ liệu cho các Tabs chính
  const [overviewData, setOverviewData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [moviesData, setMoviesData] = useState(null);
  const [showtimesData, setShowtimesData] = useState(null);

  // Danh mục phim trong kỳ & 9 phòng chiếu cho thanh lọc
  const [moviesList, setMoviesList] = useState([]);
  const [roomsList, setRoomsList] = useState([]);

  // Trạng thái tải dữ liệu & Chống Race-condition khi chuyển bộ lọc nhanh
  const requestControllerRef = useRef(null);
  const requestSeqRef = useRef(0);
  const filterMoviesControllerRef = useRef(null);
  const filterMoviesSeqRef = useRef(0);

  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [notification, setNotification] = useState('');

  // Trạng thái Drawers xem chi tiết
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(null);

  // 1. Nạp danh sách 9 phòng chiếu vật lý
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomsRes = await statisticsApi.getRooms();
        const roomsArr = Array.isArray(roomsRes.data)
          ? roomsRes.data
          : Array.isArray(roomsRes.data?.data)
          ? roomsRes.data.data
          : Array.isArray(roomsRes.data?.rooms)
          ? roomsRes.data.rooms
          : [];
        if (roomsArr.length > 0) setRoomsList(roomsArr);
      } catch (err) {
        console.warn('Lỗi nạp danh mục phòng chiếu:', err.message);
      }
    };
    fetchRooms();
  }, []);

  // 1.2. Nạp danh sách Phim động theo đúng kỳ báo cáo và phạm vi phòng đang chọn
  // Nếu movieId đang chọn không thuộc kỳ báo cáo mới -> tự động reset movieId về 'ALL' (Mục V.7 & V.9)
  useEffect(() => {
    filterMoviesControllerRef.current?.abort();
    const controller = new AbortController();
    filterMoviesControllerRef.current = controller;
    const mySeq = ++filterMoviesSeqRef.current;

    const fetchPeriodMovies = async () => {
      try {
        const res = await statisticsApi.getFilterMovies(
          {
            timeRange: filters.timeRange,
            month: filters.month,
            year: filters.year,
            customStart: filters.customStart,
            customEnd: filters.customEnd,
            roomType: filters.roomType,
            roomId: filters.roomId,
            room: filters.room,
          },
          controller.signal
        );
        if (controller.signal.aborted || mySeq !== filterMoviesSeqRef.current) return;

        const periodMovies = Array.isArray(res.data?.data?.items)
          ? res.data.data.items
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];

        setMoviesList(periodMovies);

        if (filters.movieId && filters.movieId !== 'ALL') {
          const existsInNewPeriod = periodMovies.some(
            (m) => String(m.id || m._id || m.movieId) === String(filters.movieId)
          );
          if (!existsInNewPeriod) {
            setFilters((prev) =>
              prev.movieId !== 'ALL' ? { ...prev, movieId: 'ALL', page: 1 } : prev
            );
          }
        }
      } catch (err) {
        if (!controller.signal.aborted && err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          if (mySeq === filterMoviesSeqRef.current) {
            setMoviesList([]);
          }
        }
      }
    };

    fetchPeriodMovies();
    return () => controller.abort();
  }, [
    filters.timeRange,
    filters.month,
    filters.year,
    filters.customStart,
    filters.customEnd,
    filters.roomType,
    filters.roomId,
    filters.room,
    filters.movieId,
  ]);

  // 2. Nạp dữ liệu theo Tab và Bộ lọc đang kích hoạt (Chống race-condition bằng requestSeqRef + AbortController)
  const fetchTabData = useCallback(
    async (isManualRefresh = false) => {
      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;
      const mySeq = ++requestSeqRef.current;

      setLoadError('');
      try {
        if (isManualRefresh) setIsRefreshing(true);
        else setLoading(true);

        const currentFilters = { ...filters };

        if (activeReport === 'overview') {
          const res = await statisticsApi.getOverview(currentFilters, controller.signal);
          if (!controller.signal.aborted && mySeq === requestSeqRef.current && res.data?.data) {
            setOverviewData(res.data.data);
          }
        } else if (activeReport === 'revenue') {
          const res = await statisticsApi.getRevenue(currentFilters, controller.signal);
          if (!controller.signal.aborted && mySeq === requestSeqRef.current && res.data?.data) {
            setRevenueData(res.data.data);
          }
        } else if (activeReport === 'movies') {
          const res = await statisticsApi.getMovies(currentFilters, controller.signal);
          if (!controller.signal.aborted && mySeq === requestSeqRef.current && res.data?.data) {
            setMoviesData(res.data.data);
          }
        } else if (activeReport === 'showtimes') {
          const res = await statisticsApi.getShowtimes(currentFilters, controller.signal);
          if (!controller.signal.aborted && mySeq === requestSeqRef.current && res.data?.data) {
            setShowtimesData(res.data.data);
          }
        }

        if (controller.signal.aborted || mySeq !== requestSeqRef.current) return;
        const now = new Date();
        setLastUpdated(
          now.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } catch (err) {
        if (
          !controller.signal.aborted &&
          mySeq === requestSeqRef.current &&
          err?.name !== 'CanceledError' &&
          err?.code !== 'ERR_CANCELED'
        ) {
          const msg =
            err?.response?.data?.message ||
            'Không tải được báo cáo từ máy chủ thống kê. Vui lòng kiểm tra kết nối và thử lại.';
          setLoadError(msg);
        }
      } finally {
        if (!controller.signal.aborted && mySeq === requestSeqRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [activeReport, filters]
  );

  useEffect(() => {
    fetchTabData();
    return () => requestControllerRef.current?.abort();
  }, [fetchTabData]);

  // Xử lý xuất báo cáo CSV / Excel
  const handleExportReport = async (exportType = 'revenue') => {
    try {
      setIsExporting(true);
      const res = await statisticsApi.exportReport(exportType, filters);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Bao_Cao_${exportType.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setNotification(`✓ Xuất file báo cáo ${exportType.toUpperCase()} thành công!`);
      setTimeout(() => setNotification(''), 4000);
    } catch (err) {
      console.error('Lỗi xuất file báo cáo:', err);
      setNotification('✕ Không thể xuất báo cáo. Vui lòng thử lại sau.');
      setTimeout(() => setNotification(''), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const currentSortValue = `${filters.sortBy || 'ticketsSold'}:${filters.sortOrder || 'desc'}`;

  return (
    <div className="flex bg-[var(--bg-main)] min-h-screen text-slate-200 font-sans">
      {/* Sidebar Admin bên trái */}
      <SidebarAdmin />

      {/* Vùng nội dung chính */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1720px] mx-auto w-full">
          {/* 1. Header Trang Thống Kê & Báo Cáo */}
          <StatisticsHeader
            lastUpdated={lastUpdated}
            hasError={Boolean(loadError)}
            onRefresh={() => fetchTabData(true)}
            onExport={handleExportReport}
            isRefreshing={isRefreshing}
            isExporting={isExporting}
            activeTab={activeTab}
          />

          {/* Thông báo thao tác xuất file nếu có */}
          {notification && (
            <div className="p-3 bg-[var(--bg-secondary)] border border-slate-700 rounded-2xl text-xs font-semibold text-emerald-300 shadow-lg animate-fadeIn flex items-center justify-between">
              <span>{notification}</span>
              <button onClick={() => setNotification('')} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {/* 2. Global Filter Bar dùng chung: Thời gian, Phim trong kỳ, Loại phòng, Phòng vật lý */}
          <StatisticsFilter
            filters={filters}
            onChange={(newFilters) => setFilters(newFilters)}
            movies={moviesList}
            rooms={roomsList}
            showMovieFilter={activeReport !== 'movies'}
          />

          {/* 3. Dãy 3 Tabs điều hướng chính: Tổng hợp, Doanh thu & Chi phí, Hiệu suất */}
          <div className="flex items-center gap-2 border-b border-[var(--border-default)] pb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'cinema-action text-white shadow-lg shadow-violet-700/30 ring-1 ring-[var(--violet)]'
                      : 'bg-[var(--bg-secondary)] text-slate-400 hover:text-white hover:bg-[var(--bg-surface)] border border-[var(--border-default)]'
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* 4. Nội dung chi tiết của Tab đang chọn */}
          <div className="transition-all duration-300">
            {activeTab === 'overview' && (
              <OverviewTab
                data={overviewData}
                loading={loading}
                error={loadError}
                onRetry={() => fetchTabData(true)}
                onSelectMovie={(id) => setSelectedMovieId(id)}
                onSelectShowtime={(id) => setSelectedShowtimeId(id)}
                onOpenExpenseManager={() => setActiveTab('revenue')}
              />
            )}

            {activeTab === 'revenue' && (
              <RevenueTab
                data={revenueData}
                loading={loading}
                error={loadError}
                onRetry={() => fetchTabData(true)}
                filters={filters}
                moviesList={moviesList}
                roomsList={roomsList}
                onSelectMovie={(id) => setSelectedMovieId(id)}
                onExpenseMutated={() => fetchTabData(true)}
              />
            )}

            {activeTab === 'efficiency' && (
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  ['movies', 'Hiệu suất Phim & Lợi nhuận'],
                  ['showtimes', 'Chi tiết Suất chiếu & 88 Ghế'],
                ].map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={efficiency === key}
                    onClick={() => {
                      setEfficiency(key);
                      setFilters((current) => ({ ...current, page: 1, search: '' }));
                    }}
                    className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs sm:text-sm font-bold cursor-pointer transition-all aria-pressed:border-cyan-400 aria-pressed:bg-cyan-500/10 aria-pressed:text-cyan-300"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {activeReport === 'movies' && (
              <MoviesTab
                moviesData={moviesData}
                loading={loading}
                error={loadError}
                onRetry={() => fetchTabData(true)}
                onSelectMovie={(id) => setSelectedMovieId(id)}
                onPageChange={(p) => setFilters({ ...filters, page: p })}
                onSearch={(term) => setFilters({ ...filters, search: term, page: 1 })}
                currentSort={currentSortValue}
                onSortChange={(sortBy, sortOrder) =>
                  setFilters({ ...filters, sortBy, sortOrder, page: 1 })
                }
              />
            )}

            {activeReport === 'showtimes' && (
              <ShowtimesTab
                showtimesData={showtimesData}
                loading={loading}
                error={loadError}
                onRetry={() => fetchTabData(true)}
                onSelectShowtime={(id) => setSelectedShowtimeId(id)}
                onPageChange={(p) => setFilters({ ...filters, page: p })}
                onSearch={(term) => setFilters({ ...filters, search: term, page: 1 })}
                onRoomFilter={(roomVal) =>
                  setFilters({
                    ...filters,
                    room: roomVal,
                    roomId: roomVal,
                    page: 1,
                  })
                }
                currentStatus={filters.status || 'ALL'}
                onStatusFilter={(st) => setFilters({ ...filters, status: st, page: 1 })}
              />
            )}
          </div>
        </main>
      </div>

      {/* Slide-out Drawer: Chi tiết phim khi Admin click */}
      {selectedMovieId && (
        <MovieDetailDrawer
          movieId={selectedMovieId}
          filters={filters}
          onClose={() => setSelectedMovieId(null)}
          onSelectShowtime={(stId) => setSelectedShowtimeId(stId)}
        />
      )}

      {/* Slide-out Drawer: Chi tiết suất chiếu & Sơ đồ 88 ghế thực tế khi Admin click */}
      {selectedShowtimeId && (
        <ShowtimeDetailDrawer
          showtimeId={selectedShowtimeId}
          onClose={() => setSelectedShowtimeId(null)}
        />
      )}
    </div>
  );
};

export default StatisticsPage;
