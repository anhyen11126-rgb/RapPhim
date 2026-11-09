import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const ROOM_TYPES = ['IMAX Laser', 'Dolby Atmos', 'RealD 3D', '2D Tiêu chuẩn', '4DX Sound'];

const RoomManagePage = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    roomType: 'IMAX Laser',
    formatFeature: 'Màn chiếu chuẩn điện ảnh • Âm thanh vòm đa chiều',
    priceRange: '45.000đ - 60.000đ',
    defaultSlots: '18:30 • 20:00 • 21:15 • 22:15',
    totalSeats: 88,
    status: 'ACTIVE',
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/rooms');
      setRooms(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách phòng chiếu:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (room = null) => {
    if (room) {
      setEditingRoom(room);
      setFormData({
        name: room.name || '',
        shortName: room.shortName || '',
        roomType: room.roomType || 'IMAX Laser',
        formatFeature: room.formatFeature || '',
        priceRange:
          room.priceRange ||
          (room.roomType === 'IMAX Laser'
            ? '140.000đ - 170.000đ'
            : room.roomType === 'RealD 3D'
            ? '45.000đ - 60.000đ'
            : '45.000đ - 65.000đ'),
        defaultSlots:
          room.defaultSlots ||
          (room.roomType === 'IMAX Laser'
            ? '17:30 • 19:15 • 20:45 • 22:30'
            : room.roomType === 'RealD 3D'
            ? '18:30 • 20:00 • 21:15 • 22:15'
            : '18:00 • 19:45 • 21:15 • 23:00'),
        totalSeats: room.totalSeats || 88,
        status: room.status || 'ACTIVE',
      });
    } else {
      setEditingRoom(null);
      const nextNum = rooms.length + 1;
      setFormData({
        name: `Phòng ${nextNum < 10 ? '0' + nextNum : nextNum} - RealD 3D`,
        shortName: `Phòng ${nextNum} (3D)`,
        roomType: 'RealD 3D',
        formatFeature: '3D Phụ Đề • RealD 3D High Frame Rate • Kính 3D siêu nhẹ',
        priceRange: '45.000đ - 60.000đ',
        defaultSlots: '18:30 • 20:00 • 21:15 • 22:15',
        totalSeats: 88,
        status: 'ACTIVE',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await api.put(`/admin/rooms/${editingRoom.id || editingRoom._id}`, formData);
        alert('Cập nhật thông tin phòng chiếu thành công!');
      } else {
        await api.post('/admin/rooms', formData);
        alert('Thêm phòng chiếu mới thành công!');
      }
      setIsModalOpen(false);
      fetchRooms();
    } catch (err) {
      alert('Thao tác thất bại: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa "${name}"?`)) {
      try {
        await api.delete(`/admin/rooms/${id}`);
        alert('Đã xóa phòng chiếu thành công!');
        fetchRooms();
      } catch (err) {
        alert('Lỗi khi xóa: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleToggleStatus = async (room) => {
    try {
      const nextStatus = room.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE';
      await api.put(`/admin/rooms/${room.id || room._id}`, { status: nextStatus });
      fetchRooms();
    } catch (err) {
      alert('Không thể đổi trạng thái: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredRooms = rooms.filter((r) => {
    const matchSearch =
      (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.shortName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.formatFeature || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'ALL' || r.roomType === filterType;
    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-100 font-sans">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 flex-1 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
                <span>📽️</span>
                <span>Quản Lý Phòng Chiếu Phim</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Hệ thống phòng chiếu tại <strong>D'AVENOR Thanh Khê Plaza (Đà Nẵng)</strong>
              </p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Thêm Phòng Chiếu Mới</span>
            </button>
          </div>

          {/* Thanh lọc & tìm kiếm */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="md:col-span-2 relative">
              <input
                type="text"
                placeholder="Tìm theo tên phòng, công nghệ, màn hình..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">Tất cả công nghệ</option>
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="MAINTENANCE">Đang bảo trì</option>
              </select>
            </div>
          </div>

          {/* Bảng danh sách phòng chiếu */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mb-2"></div>
                <p>Đang tải danh sách phòng chiếu...</p>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Không tìm thấy phòng chiếu nào phù hợp.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800 whitespace-nowrap">
                    <tr>
                      <th className="py-3 px-4">STT</th>
                      <th className="py-3 px-4">Tên phòng chiếu</th>
                      <th className="py-3 px-4">Công nghệ</th>
                      <th className="py-3 px-4">Khung giờ chiếu chuẩn</th>
                      <th className="py-3 px-4">Giá vé chuẩn</th>
                      <th className="py-3 px-4 text-center">Sức chứa</th>
                      <th className="py-3 px-4 text-center">Trạng thái</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredRooms.map((room, idx) => {
                      const defaultSlots =
                        room.defaultSlots ||
                        (room.roomType === 'IMAX Laser'
                          ? '17:30 • 19:15 • 20:45 • 22:30'
                          : room.roomType === 'RealD 3D'
                          ? '18:30 • 20:00 • 21:15 • 22:15'
                          : '18:00 • 19:45 • 21:15 • 23:00');
                      const priceRange =
                        room.priceRange ||
                        (room.roomType === 'IMAX Laser'
                          ? '140.000đ - 170.000đ'
                          : room.roomType === 'RealD 3D'
                          ? '45.000đ - 60.000đ'
                          : '45.000đ - 65.000đ');

                      return (
                        <tr key={room.id || room._id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-400">{room.roomNumber || idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{room.name}</span>
                              <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                                {room.shortName || `Phòng ${room.roomNumber || idx + 1}`}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">{room.formatFeature}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                                room.roomType === 'IMAX Laser'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  : room.roomType === 'RealD 3D'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                              }`}
                            >
                              {room.roomType}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-200 whitespace-nowrap">
                            {defaultSlots}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {priceRange}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400 whitespace-nowrap">
                            {room.totalSeats || 88} ghế
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleStatus(room)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                                room.status === 'ACTIVE'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-amber-500/20 hover:text-amber-300'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-emerald-500/20 hover:text-emerald-300'
                              }`}
                              title="Bấm để chuyển trạng thái"
                            >
                              {room.status === 'ACTIVE' ? '● Đang hoạt động' : '▲ Đang bảo trì'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleOpenModal(room)}
                                className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all text-xs cursor-pointer"
                                title="Chỉnh sửa thông tin phòng"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(room.id || room._id, room.name)}
                                className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-all text-xs cursor-pointer"
                                title="Xóa phòng chiếu"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Thêm / Chỉnh sửa phòng chiếu */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <span>{editingRoom ? '✏️' : '➕'}</span>
                    <span>{editingRoom ? 'Chỉnh Sửa Phòng Chiếu' : 'Thêm Phòng Chiếu Mới'}</span>
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tên phòng chiếu đầy đủ *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Phòng IMAX 01 (Grand Hall), Rạp 03 (Tầng 2)..."
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Tên gọi nhanh (Dropdown)</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Phòng 1, Phòng 2..."
                        value={formData.shortName}
                        onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Công nghệ phòng chiếu *</label>
                      <select
                        value={formData.roomType}
                        onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        {ROOM_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Đặc trưng & Thông số kỹ thuật</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: IMAX Laser 2D • Âm thanh 12 kênh độc quyền..."
                      value={formData.formatFeature}
                      onChange={(e) => setFormData({ ...formData, formatFeature: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Tổng số ghế</label>
                      <input
                        type="number"
                        min="20"
                        max="300"
                        value={formData.totalSeats}
                        onChange={(e) => setFormData({ ...formData, totalSeats: Number(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Trạng thái vận hành</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        <option value="ACTIVE">Đang hoạt động</option>
                        <option value="MAINTENANCE">Đang bảo trì</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-[11px] leading-relaxed">
                    💡 Phòng chiếu được tạo sẽ tự động xuất hiện trong bộ chọn suất chiếu và trang đặt vé của khách hàng.
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30"
                    >
                      {editingRoom ? 'Lưu thay đổi' : 'Tạo phòng chiếu'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default RoomManagePage;

