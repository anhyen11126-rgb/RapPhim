import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const UserManagePage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.phone && u.phone.includes(term))
    );
  });

  return (
    <div className="flex bg-slate-950 min-h-screen">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 flex-1 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
                <span>👥</span>
                <span>Quản Lý Khách Hàng & Hội Viên</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Theo dõi danh sách khách hàng, điểm tích lũy và phân hạng hội viên D'AVENOR CLUB.
              </p>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs">
              <span className="text-slate-400">Tổng số hội viên:</span>
              <span className="font-bold text-white text-sm">{users.length}</span>
            </div>
          </div>

          {/* Tìm kiếm */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Tìm theo tên, email hoặc số điện thoại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Bảng danh sách hội viên */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách thành viên...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">Không tìm thấy thành viên phù hợp</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Khách hàng</th>
                      <th className="py-3 px-4">Số điện thoại</th>
                      <th className="py-3 px-4">Hạng thành viên</th>
                      <th className="py-3 px-4 text-center">Điểm thưởng</th>
                      <th className="py-3 px-4 text-center">Số vé đã đặt</th>
                      <th className="py-3 px-4">Ngày đăng ký</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {filteredUsers.map((u) => {
                      const dateJoined = u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString('vi-VN')
                        : 'Mới';
                      return (
                        <tr key={u.id || u._id} className="hover:bg-slate-800/50 transition-colors">
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
                                u.tier === 'GOLD' || u.tier === 'VIP'
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

