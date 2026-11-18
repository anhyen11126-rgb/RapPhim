import React, { useState, useEffect, useCallback } from 'react';
import SidebarAdmin from '../../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../../components/admin/TopbarAdmin';
import StatisticsHeader from './components/StatisticsHeader';
import StatisticsFilter from './components/StatisticsFilter';
import OverviewTab from './tabs/OverviewTab';
import RevenueTab from './tabs/RevenueTab';
import MoviesTab from './tabs/MoviesTab';
import ShowtimesTab from './tabs/ShowtimesTab';
import CustomersTab from './tabs/CustomersTab';
import ReviewsTab from './tabs/ReviewsTab';
import MovieDetailDrawer from './drawers/MovieDetailDrawer';
import ShowtimeDetailDrawer from './drawers/ShowtimeDetailDrawer';
import statisticsApi from './services/statisticsApi';

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: '📊' },
  { id: 'revenue', label: 'Doanh thu', icon: '💳' },
  { id: 'movies', label: 'Phim', icon: '🎬' },
  { id: 'showtimes', label: 'Suất chiếu', icon: '🕒' },
  { id: 'customers', label: 'Khách hàng', icon: '👥' },
  { id: 'reviews', label: 'Đánh giá', icon: '⭐' },
];

const StatisticsPage = () => {
  // Tab hiện tại
  const [activeTab, setActiveTab] = useState('overview');

  // Bộ lọc dùng chung (Global Filter)
  const [filters, setFilters] = useState({
    timeRange: '7_days',
    customStart: '',
    customEnd: '',
    cinemaId: 'ALL',
    movieId: 'ALL',
  });

  // Dữ liệu cho các Tab
  const [overviewData, setOverviewData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [moviesData, setMoviesData] = useState(null);
  const [showtimesData, setShowtimesData] = useState(null);
  const [customersData, setCustomersData] = useState(null);
  const [reviewsData, setReviewsData] = useState(null);

  // Danh mục để chọn trên thanh lọc
  const [cinemasList, setCinemasList] = useState([]);
  const [moviesList, setMoviesList] = useState([]);

  // Trạng thái tải dữ liệu
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [notification, setNotification] = useState('');

  // Trạng thái Drawers xem chi tiết
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(null);

  // 1. Nạp danh mục rạp & phim cho bộ lọc
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        const [cinemasRes, moviesRes] = await Promise.all([
          statisticsApi.getCinemas(),
          statisticsApi.getFilterMovies(),
        ]);
        if (Array.isArray(cinemasRes.data)) setCinemasList(cinemasRes.data);
        if (Array.isArray(moviesRes.data)) setMoviesList(moviesRes.data);
      } catch (err) {
        console.warn('Lỗi nạp danh mục bộ lọc:', err.message);
      }
    };
    fetchDropdownOptions();
  }, []);

  // 2. Nạp dữ liệu theo Tab và Bộ lọc đang kích hoạt
  const fetchTabData = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) setIsRefreshing(true);
        else setLoading(true);

        const currentFilters = { ...filters };

        if (activeTab === 'overview') {
          const res = await statisticsApi.getOverview(currentFilters);
          if (res.data?.data) setOverviewData(res.data.data);
        } else if (activeTab === 'revenue') {
          const res = await statisticsApi.getRevenue(currentFilters);
          if (res.data?.data) setRevenueData(res.data.data);
        } else if (activeTab === 'movies') {
          const res = await statisticsApi.getMovies(currentFilters);
          if (res.data?.data) setMoviesData(res.data.data);
        } else if (activeTab === 'showtimes') {
          const res = await statisticsApi.getShowtimes(currentFilters);
          if (res.data?.data) setShowtimesData(res.data.data);
        } else if (activeTab === 'customers') {
          const res = await statisticsApi.getCustomers(currentFilters);
          if (res.data?.data) setCustomersData(res.data.data);
        } else if (activeTab === 'reviews') {
          const res = await statisticsApi.getReviews(currentFilters);
          if (res.data?.data) setReviewsData(res.data.data);
        }

        const now = new Date();
        setLastUpdated(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu thống kê:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeTab, filters]
  );

  useEffect(() => {
    fetchTabData();
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
    <div className="flex bg-[#0a0e17] min-h-screen text-slate-200 font-sans">
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
            <div className="p-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs font-semibold text-emerald-300 shadow-lg animate-fadeIn flex items-center justify-between">
              <span>{notification}</span>
              <button onClick={() => setNotification('')} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* 2. Global Filter Bar dùng chung */}
          <StatisticsFilter
            filters={filters}
            onChange={(newFilters) => setFilters(newFilters)}
            cinemas={cinemasList}
            movies={moviesList}
            showMovieFilter={activeTab !== 'movies' && activeTab !== 'customers'}
          />

          {/* 3. Dãy 6 Tabs điều hướng chuyên nghiệp */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 ring-1 ring-red-500'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
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
                onSelectMovie={(id) => setSelectedMovieId(id)}
                onSelectShowtime={(id) => setSelectedShowtimeId(id)}
              />
            )}

            {activeTab === 'revenue' && (
              <RevenueTab data={revenueData} loading={loading} />
            )}

            {activeTab === 'movies' && (
              <MoviesTab
                moviesData={moviesData}
                loading={loading}
                onSelectMovie={(id) => setSelectedMovieId(id)}
                onPageChange={(p) => setFilters({ ...filters, page: p })}
                onSearch={(term) => setFilters({ ...filters, search: term, page: 1 })}
              />
            )}

            {activeTab === 'showtimes' && (
              <ShowtimesTab
                showtimesData={showtimesData}
                loading={loading}
                onSelectShowtime={(id) => setSelectedShowtimeId(id)}
                onPageChange={(p) => setFilters({ ...filters, page: p })}
                onSearch={(term) => setFilters({ ...filters, search: term, page: 1 })}
                onRoomFilter={(room) => setFilters({ ...filters, room, page: 1 })}
              />
            )}

            {activeTab === 'customers' && (
              <CustomersTab
                customersData={customersData}
                loading={loading}
                onPageChange={(p) => setFilters({ ...filters, page: p })}
              />
            )}

            {activeTab === 'reviews' && (
              <ReviewsTab
                reviewsData={reviewsData}
                loading={loading}
                onSelectMovie={(id) => setSelectedMovieId(id)}
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
