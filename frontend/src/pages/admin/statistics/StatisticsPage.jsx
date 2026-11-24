import React, { useState, useEffect, useCallback, useRef } from 'react';
import SidebarAdmin from '../../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../../components/admin/TopbarAdmin';
import StatisticsHeader from './components/StatisticsHeader';
import StatisticsFilter from './components/StatisticsFilter';
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
    const parts = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric' })
      .formatToParts(new Date());
    return {
    timeRange: 'by_month',
    month: Number(parts.find(part => part.type === 'month').value),
    year: Number(parts.find(part => part.type === 'year').value),
    customStart: '',
    customEnd: '',
    movieId: 'ALL',
    };
  });

  // Dữ liệu cho 4 Tabs chính
  const [overviewData, setOverviewData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [moviesData, setMoviesData] = useState(null);
  const [showtimesData, setShowtimesData] = useState(null);

  // Danh mục phim để chọn trên thanh lọc
  const [moviesList, setMoviesList] = useState([]);

  // Trạng thái tải dữ liệu
  const request = useRef(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [notification, setNotification] = useState('');

  // Trạng thái Drawers xem chi tiết
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(null);

  // 1. Nạp danh mục phim cho bộ lọc
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        const moviesRes = await statisticsApi.getFilterMovies();
        if (Array.isArray(moviesRes.data)) setMoviesList(moviesRes.data);
      } catch (err) {
        console.warn('Lỗi nạp danh mục phim bộ lọc:', err.message);
      }
    };
    fetchDropdownOptions();
  }, []);

  // 2. Nạp dữ liệu theo Tab và Bộ lọc đang kích hoạt
  const fetchTabData = useCallback(
    async (isManualRefresh = false) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoadError('');
      try {
        if (isManualRefresh) setIsRefreshing(true);
        else setLoading(true);

        const currentFilters = { ...filters };

        if (activeReport === 'overview') {
          const res = await statisticsApi.getOverview(currentFilters, controller.signal);
          if (!controller.signal.aborted && res.data?.data) setOverviewData(res.data.data);
        } else if (activeReport === 'revenue') {
          const res = await statisticsApi.getRevenue(currentFilters, controller.signal);
          if (!controller.signal.aborted && res.data?.data) setRevenueData(res.data.data);
        } else if (activeReport === 'movies') {
          const res = await statisticsApi.getMovies(currentFilters, controller.signal);
          if (!controller.signal.aborted && res.data?.data) setMoviesData(res.data.data);
        } else if (activeReport === 'showtimes') {
          const res = await statisticsApi.getShowtimes(currentFilters, controller.signal);
          if (!controller.signal.aborted && res.data?.data) setShowtimesData(res.data.data);
        }

        if (controller.signal.aborted) return;
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (err) {
        if (!controller.signal.aborted) setLoadError('Không tải được báo cáo.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [activeReport, filters]
  );

  useEffect(() => {
    fetchTabData();
    return () => request.current?.abort();
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
      link.setAttribute('download', `Bao_Cao_${exportType.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
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
              <button onClick={() => setNotification('')} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* 2. Global Filter Bar dùng chung: 2 bộ lọc Thời gian & Phim */}
          <StatisticsFilter
            filters={filters}
            onChange={(newFilters) => setFilters(newFilters)}
            movies={moviesList}
            showMovieFilter={activeTab !== 'movies'}
          />

          {/* 3. Dãy 4 Tabs điều hướng chính: Tổng quan, Doanh thu & Chi phí, Phim & Lợi nhuận, Suất chiếu */}
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
            {loadError && <p className="text-rose-300" role="alert">{loadError}{' '}
              <button onClick={() => fetchTabData(true)} className="text-cyan-300">Thử lại</button>
            </p>}
            {activeTab === 'overview' && (
              <OverviewTab
                data={overviewData}
                loading={loading}
                onSelectMovie={(id) => setSelectedMovieId(id)}
                onSelectShowtime={(id) => setSelectedShowtimeId(id)}
              />
            )}

            {activeTab === 'revenue' && (
              <RevenueTab data={revenueData} loading={loading} />
            )}

            {activeTab === 'efficiency' && <div className="mb-4 flex flex-wrap gap-2">
              {[['movies', 'Phim'], ['showtimes', 'Suất chiếu']].map(([key, label]) => (
                <button type="button" key={key} aria-pressed={efficiency === key}
                  onClick={() => { setEfficiency(key); setFilters(current => ({ ...current, page: 1, search: '', room: 'ALL' })); }}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm aria-pressed:border-cyan-400 aria-pressed:text-cyan-300">{label}</button>
              ))}
            </div>}

            {activeReport === 'movies' && (
              <MoviesTab
                moviesData={moviesData}
                loading={loading}
                onSelectMovie={(id) => setSelectedMovieId(id)}
                onPageChange={(p) => setFilters({ ...filters, page: p })}
                onSearch={(term) => setFilters({ ...filters, search: term, page: 1 })}
              />
            )}

            {activeReport === 'showtimes' && (
              <ShowtimesTab
                showtimesData={showtimesData}
                loading={loading}
                onSelectShowtime={(id) => setSelectedShowtimeId(id)}
                onPageChange={(p) => setFilters({ ...filters, page: p })}
                onSearch={(term) => setFilters({ ...filters, search: term, page: 1 })}
                onRoomFilter={(room) => setFilters({ ...filters, room, page: 1 })}
              />
            )}
          </div>
        </main>
      </div>

      {/* Slide-out Drawer: Chi tiết phim khi Admin click */}
      {selectedMovieId && (
        <MovieDetailDrawer movieId={selectedMovieId} onClose={() => setSelectedMovieId(null)} />
      )}

      {/* Slide-out Drawer: Chi tiết suất chiếu & Sơ đồ 88 ghế thực tế khi Admin click */}
      {selectedShowtimeId && (
        <ShowtimeDetailDrawer showtimeId={selectedShowtimeId} onClose={() => setSelectedShowtimeId(null)} />
      )}
    </div>
  );
};

export default StatisticsPage;
