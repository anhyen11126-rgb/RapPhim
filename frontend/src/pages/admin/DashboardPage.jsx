import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const DashboardPage = () => {
  const [data, setData] = useState({
    stats: {
      totalRevenue: 0,
      totalTickets: 0,
      totalMovies: 0,
      totalShowtimes: 0,
      totalCinemas: 0,
      totalUsers: 0,
    },
    recentBookings: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/dashboard/stats');
      setData(res.data);
    } catch (err) {
      console.error('Lỗi khi tải thống kê:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Tổng Doanh Thu',
      value: `${(data.stats.totalRevenue || 0).toLocaleString('vi-VN')} đ`,
      sub: 'Hóa đơn đã thanh toán',
      icon: '💰',
      color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
    },
    {
      title: 'Số Vé Đã Bán',
      value: `${data.stats.totalTickets || 0} vé`,
      sub: 'Ghế đã hoàn tất đặt',
      icon: '🎟️',
      color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
    },
    {
      title: 'Hệ Thống Cụm Rạp',
      value: `${data.stats.totalCinemas || 22} rạp`,
      sub: 'Trên 9 tỉnh thành',
      icon: '🏢',
      color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    },
    {
      title: 'Số Suất Chiếu Đã Mở',
      value: `${data.stats.totalShowtimes || 0} suất`,
      sub: 'Hôm nay & sắp tới',
      icon: '🕒',
      color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
    },
    {
      title: 'Phim Đang Chiếu',
      value: `${data.stats.totalMovies || 0} phim`,
      sub: 'Spider-Man, Dune 2, Mai...',
      icon: '🎬',
      color: 'from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-400',
    },
    {
      title: 'Hội Viên D\'AVENOR',
      value: `${data.stats.totalUsers || 0} thành viên`,
      sub: 'Tích điểm & Hạng thẻ',
      icon: '👥',
      color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
    },
  ];

  const quickActions = [
    { to: '/admin/cinemas', title: 'Quản Lý Cụm Rạp', icon: '🏢', desc: 'Thêm/sửa 22 cụm rạp toàn quốc' },
    { to: '/admin/showtimes', title: 'Mở Suất Chiếu', icon: '🕒', desc: 'Lên lịch chiếu & ma trận 48 ghế' },
    { to: '/admin/movies', title: 'Quản Lý Phim', icon: '🎬', desc: 'Thêm phim bom tấn, trailer, poster' },
    { to: '/admin/bookings', title: 'Duyệt Đơn Đặt Vé', icon: '🎟️', desc: 'Tra cứu mã vé & xác nhận thanh toán' },
    { to: '/admin/concessions', title: 'Bắp Nước & Combo', icon: '🍿', desc: 'Cập nhật giá combo F&B' },
    { to: '/admin/promotions', title: 'Mã Giảm Giá', icon: '🏷️', desc: 'Tạo voucher khuyến mãi mới' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col">
        <TopbarAdmin />
        <main className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-black">Bảng Điều Khiển & Thống Kê</h1>
              <p className="text-xs text-slate-400">Dữ liệu doanh thu và lượt đặt vé thực tế từ hệ thống</p>
            </div>
            <button
              onClick={fetchStats}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
            >
              🔄 Làm mới dữ liệu
            </button>
          </div>

          {/* Cards thống kê */}
          {loading ? (
            <div className="py-12 text-center text-slate-400">Đang tải số liệu thống kê...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {statCards.map((s, idx) => (
                <div
                  key={idx}
                  className={`bg-slate-900 border p-5 rounded-2xl shadow-lg flex items-center justify-between transition-all hover:border-slate-700 ${s.color}`}
                >
                  <div>
                    <p className="text-xs text-slate-400 font-semibold">{s.title}</p>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5">{s.value}</h3>
                    <p className="text-[11px] text-slate-400 mt-1">{s.sub}</p>
                  </div>
                  <div className="text-3xl p-3 bg-slate-800/80 rounded-2xl shrink-0 border border-slate-700/50">
                    {s.icon}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lối tắt quản trị nhanh */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <span>⚡ Lối Tắt Quản Trị Hệ Thống D'AVENOR</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action, idx) => (
                <Link
                  key={idx}
                  to={action.to}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 hover:border-red-500/50 transition-all flex items-center space-x-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl group-hover:scale-110 transition-transform shrink-0">
                    {action.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                      {action.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{action.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Bảng đơn vé gần nhất */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4 flex items-center space-x-2">
              <span>🧾 Đơn Đặt Vé Gần Nhất</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Mã đơn</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3">Phim & Suất chiếu</th>
                    <th className="px-4 py-3">Ghế đã đặt</th>
                    <th className="px-4 py-3">Tổng tiền</th>
                    <th className="px-4 py-3 rounded-r-lg">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.recentBookings.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                        Chưa có đơn đặt vé nào trong hệ thống.
                      </td>
                    </tr>
                  ) : (
                    data.recentBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-red-400">#{b.bookingCode}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{b.customerName}</div>
                          <div className="text-xs text-slate-500">{b.customerPhone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white font-medium">{b.showtime?.movie?.title}</div>
                          <div className="text-xs text-slate-500">{b.showtime?.roomName}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-white">{b.seats}</td>
                        <td className="px-4 py-3 font-bold text-emerald-400">
                          {b.totalAmount?.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-medium">
                            {b.status === 'PAID' ? 'Đã thanh toán' : b.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
