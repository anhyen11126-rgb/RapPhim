import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const UserManagePage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách người dùng:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (u) => {
    const userId = u.id || u._id;
    const userName = u.name || u.email;

    const confirmed = window.confirm(
      `⚠️ CẢNH BÁO XÓA TÀI KHOẢN:\n\nBạn có chắc chắn muốn xóa vĩnh viễn tài khoản của người dùng "${userName}" (${u.email}) khỏi hệ thống?\n\nThao tác này sẽ gỡ bỏ toàn bộ thông tin hội viên khỏi cơ sở dữ liệu và không thể hoàn tác!`
    );

    if (!confirmed) return;

    try {
      setDeletingId(userId);
      const res = await api.delete(`/admin/users/${userId}`);

      // Cập nhật state ngay lập tức
      setUsers((prev) => prev.filter((item) => (item.id || item._id) !== userId));

      setNotification({
        type: 'success',
        message: res.data?.message || `Đã xóa tài khoản "${userName}" thành công khỏi hệ thống!`,
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Không thể xóa tài khoản người dùng';
      setNotification({
        type: 'error',
        message: `Lỗi: ${errMsg}`,
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.phone && u.phone.includes(term))
    );
  });

  const vipCount = users.filter((u) => u.tier === 'VIP' || u.tier === 'GOLD' || u.tier === 'GOLD_TIER' || u.tier === 'DIAMOND').length;
  const standardCount = users.length - vipCount;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-100 font-sans">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 flex-1 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1.5 font-medium">
                <span>Hệ thống quản trị</span>
                <span className="text-slate-600">›</span>
                <span className="text-red-400 font-semibold">Quản lý Khách hàng & Hội viên</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <span>👥</span>
                <span>Quản Lý Khách Hàng & Hội Viên</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Theo dõi danh sách khách hàng, điểm tích lũy, phân hạng hội viên và quản lý xóa tài khoản người dùng.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchUsers}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <span>🔄</span>
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Thông báo thao tác */}
          {notification && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between animate-fade-in ${
                notification.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              <span>{notification.message}</span>
              <button
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-white text-xs font-bold ml-4"
              >
                ✕
              </button>
            </div>
          )}

          {/* 3 Thẻ thống kê nhanh */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Tổng số hội viên</span>
              <div className="text-2xl font-black text-white mt-1">{users.length} khách hàng</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Đã đăng ký tài khoản trên hệ thống</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Hội viên Thường (Standard)</span>
              <div className="text-2xl font-black text-blue-400 mt-1">{standardCount} thành viên</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tích lũy điểm xem phim cơ bản</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider">Hội viên VIP / Gold Club</span>
              <div className="text-2xl font-black text-amber-400 mt-1">{vipCount} thành viên</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Hưởng ưu đãi đặc quyền giá vé & combo</div>
            </div>
          </div>

          {/* Thanh tìm kiếm */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Tìm theo tên khách, email hoặc số điện thoại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-all"
              />
            </div>
            <div className="text-xs text-slate-400 self-center">
              Hiển thị <strong className="text-white">{filteredUsers.length}</strong> / {users.length} tài khoản
            </div>
          </div>

          {/* Bảng danh sách hội viên */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <span className="inline-block animate-spin mr-2">🔄</span> Đang tải danh sách thành viên...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Không tìm thấy tài khoản người dùng nào phù hợp với bộ lọc tìm kiếm.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                      <th className="py-3 px-4">Khách hàng</th>
                      <th className="py-3 px-4">Số điện thoại</th>
                      <th className="py-3 px-4">Hạng thành viên</th>
                      <th className="py-3 px-4 text-center">Điểm thưởng</th>
                      <th className="py-3 px-4 text-center">Số vé đã đặt</th>
                      <th className="py-3 px-4">Ngày đăng ký</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {filteredUsers.map((u) => {
                      const userId = u.id || u._id;
                      const dateJoined = u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString('vi-VN')
                        : 'Mới';
                      const isDeleting = deletingId === userId;

                      return (
                        <tr key={userId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 font-bold flex items-center justify-center shrink-0">
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <span className="font-bold text-white block">{u.name || 'Khách hàng'}</span>
                                <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">{u.phone || 'Chưa cập nhật'}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                u.tier === 'GOLD' || u.tier === 'GOLD_TIER' || u.tier === 'VIP' || u.tier === 'DIAMOND'
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              ⭐ {u.tier || 'STANDARD'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-400 font-mono">
                            {u.points || 0} pts
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-white font-mono">
                            {u.bookingCount || 0} vé
                          </td>
                          <td className="py-3 px-4 text-slate-400">{dateJoined}</td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                              title="Xóa vĩnh viễn tài khoản người dùng khỏi hệ thống"
                            >
                              <span>🗑️</span>
                              <span>{isDeleting ? 'Đang xóa...' : 'Xóa tài khoản'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserManagePage;
