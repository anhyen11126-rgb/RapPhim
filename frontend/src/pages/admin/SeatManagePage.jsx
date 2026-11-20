import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import ShowtimesTab from './statistics/tabs/ShowtimesTab';
import ShowtimeDetailDrawer from './statistics/drawers/ShowtimeDetailDrawer';
import statisticsApi from './statistics/services/statisticsApi';

const SeatManagePage = () => {
  const [showtimesData, setShowtimesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(null);

  const [filters, setFilters] = useState({
    timeRange: '7_days',
    room: 'ALL',
    search: '',
    page: 1,
  });

  const fetchShowtimes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await statisticsApi.getShowtimes(filters);
      if (res.data?.data) {
        setShowtimesData(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách ghế theo suất chiếu:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchShowtimes();
  }, [fetchShowtimes]);

  return (
    <div className="flex bg-[#0a0e17] min-h-screen text-slate-200 font-sans">
      <SidebarAdmin />

      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1720px] mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Hạ Tầng Rạp Chiếu</span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400">Giám Sát Ghế Thời Gian Thực</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                Theo Dõi Sơ Đồ Ghế & Tình Trạng Chỗ Ngồi
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Xem ma trận sơ đồ ghế thực tế theo từng suất chiếu, phòng chiếu và đối soát các đơn đặt vé của khách hàng
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              <Link
                to="/admin/rooms"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center space-x-1.5"
              >
                <span>🏢</span>
                <span>Cấu Hình Phòng & Sức Chứa</span>
              </Link>
            </div>
          </div>

          {/* Sub-tabs điều hướng giữa Cấu hình Phòng và Sơ đồ Ghế */}
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Link
              to="/admin/rooms"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center space-x-2 transition-all cursor-pointer"
            >
              <span>📽️</span>
              <span>8 Phòng Chiếu & Sức Chứa</span>
            </Link>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white shadow-md shadow-red-600/30 flex items-center space-x-2 cursor-default"
            >
              <span>💺</span>
              <span>Sơ Đồ Ghế Theo Suất Chiếu</span>
            </button>
          </div>

          {/* Dữ liệu suất chiếu & ma trận ghế */}
          <ShowtimesTab
            showtimesData={showtimesData}
            loading={loading}
            onSelectShowtime={(id) => setSelectedShowtimeId(id)}
            onPageChange={(p) => setFilters({ ...filters, page: p })}
            onSearch={(term) => setFilters({ ...filters, search: term, page: 1 })}
            onRoomFilter={(room) => setFilters({ ...filters, room, page: 1 })}
          />
        </main>
      </div>

      {/* Sơ đồ 88 ghế chi tiết khi Admin click xem */}
      {selectedShowtimeId && (
        <ShowtimeDetailDrawer
          showtimeId={selectedShowtimeId}
          onClose={() => setSelectedShowtimeId(null)}
        />
      )}
    </div>
  );
};

export default SeatManagePage;
