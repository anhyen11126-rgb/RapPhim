import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';
import { VIETNAM_PROVINCES } from '../../constants/provinces';

const CinemaManagePage = () => {
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCinema, setEditingCinema] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    city: 'TP. Hồ Chí Minh',
    address: '',
    hotline: '1900 8899',
    openingHours: '08:30 - 24:00',
    parking: 'Hầm giữ xe 24/7 (Miễn phí 3h)',
    roomCount: 7,
    isFlagship: false,
    specialBadge: '',
    image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
    tags: ['Dolby Atmos', 'IMAX Laser'],
  });

  useEffect(() => {
    fetchCinemas();
  }, []);

  const fetchCinemas = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/cinemas');
      setCinemas(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách rạp:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (cinema = null) => {
    if (cinema) {
      setEditingCinema(cinema);
      setFormData({
        name: cinema.name,
        city: cinema.city,
        address: cinema.address,
        hotline: cinema.hotline || '1900 8899',
        openingHours: cinema.openingHours || '08:30 - 24:00',
        parking: cinema.parking || 'Hầm giữ xe 24/7',
        roomCount: cinema.roomCount || 7,
        isFlagship: !!cinema.isFlagship,
        specialBadge: cinema.specialBadge || '',
        image: cinema.image || '',
        tags: cinema.tags || ['Dolby Atmos'],
      });
    } else {
      setEditingCinema(null);
      setFormData({
        name: "D'AVENOR ",
        city: 'TP. Hồ Chí Minh',
        address: '',
        hotline: '1900 8899',
        openingHours: '08:30 - 24:00',
        parking: 'Hầm giữ xe 24/7 (Miễn phí 3h)',
        roomCount: 7,
        isFlagship: false,
        specialBadge: '',
        image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
        tags: ['Dolby Atmos', 'IMAX Laser'],
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCinema) {
        await api.put(`/admin/cinemas/${editingCinema.id || editingCinema._id}`, formData);
        alert('Cập nhật cụm rạp thành công!');
      } else {
        await api.post('/admin/cinemas', formData);
        alert('Thêm cụm rạp mới thành công!');
      }
      setIsModalOpen(false);
      fetchCinemas();
    } catch (err) {
      alert('Thao tác thất bại: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa cụm rạp "${name}"? Toàn bộ suất chiếu của rạp này cũng sẽ bị xóa!`)) {
      try {
        await api.delete(`/admin/cinemas/${id}`);
        fetchCinemas();
        alert('Đã xóa cụm rạp thành công!');
      } catch (err) {
        alert('Lỗi xóa rạp: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const toggleTag = (tag) => {
    if (formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
    } else {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
  };

  const filteredCinemas = cinemas.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCity = filterCity === 'ALL' || c.city === filterCity;
    return matchSearch && matchCity;
  });

  const uniqueCities = Array.from(new Set(cinemas.map((c) => c.city)));

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
                <span>🏢</span>
                <span>Quản Lý Cụm Rạp Chiếu Phim</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Quản lý {cinemas.length} cụm rạp D'AVENOR trên toàn quốc, cập nhật số phòng chiếu và công nghệ.
              </p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-red-600/20"
            >
              <span>➕</span>
              <span>Thêm Cụm Rạp Mới</span>
            </button>
          </div>

          {/* Thanh lọc & tìm kiếm */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Tìm theo tên rạp hoặc địa chỉ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400 whitespace-nowrap">Tỉnh/Thành:</span>
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              >
                <option value="ALL">Tất cả ({cinemas.length} rạp)</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city} ({cinemas.filter((c) => c.city === city).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bảng danh sách rạp */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách rạp...</div>
            ) : filteredCinemas.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">Không tìm thấy cụm rạp phù hợp</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Tên cụm rạp</th>
                      <th className="py-3 px-4">Tỉnh / Thành</th>
                      <th className="py-3 px-4">Địa chỉ</th>
                      <th className="py-3 px-4 text-center">Phòng</th>
                      <th className="py-3 px-4">Công nghệ</th>
                      <th className="py-3 px-4">Hotline</th>
                      <th className="py-3 px-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {filteredCinemas.map((c) => (
                      <tr key={c.id || c._id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white flex items-center space-x-2">
                            <span>{c.name}</span>
                            {c.isFlagship && (
                              <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-black border border-amber-500/30">
                                FLAGSHIP
                              </span>
                            )}
                          </div>
                          {c.specialBadge && (
                            <span className="text-[10px] text-blue-400 block mt-0.5">{c.specialBadge}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-300">{c.city}</td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={c.address}>
                          {c.address}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white">{c.roomCount || 6}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {c.tags?.map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">{c.hotline || '1900 8899'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleOpenModal(c)}
                              className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all text-xs"
                              title="Chỉnh sửa"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(c.id || c._id, c.name)}
                              className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all text-xs"
                              title="Xóa rạp"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Thêm / Sửa Cụm rạp */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <h3 className="text-lg font-bold text-white">
                    {editingCinema ? 'Chỉnh sửa cụm rạp' : 'Thêm cụm rạp D\'AVENOR mới'}
                  </h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-white text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tên cụm rạp *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="VD: D'AVENOR Vincom Landmark 81 IMAX"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Tỉnh / Thành phố *</label>
                      <select
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                      >
                        {VIETNAM_PROVINCES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Số phòng chiếu *</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formData.roomCount}
                        onChange={(e) => setFormData({ ...formData, roomCount: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Địa chỉ chi tiết *</label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="VD: Tầng B1 Vincom Landmark 81, 720A Điện Biên Phủ, Q.Bình Thạnh"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Hotline</label>
                      <input
                        type="text"
                        value={formData.hotline}
                        onChange={(e) => setFormData({ ...formData, hotline: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Giờ mở cửa</label>
                      <input
                        type="text"
                        value={formData.openingHours}
                        onChange={(e) => setFormData({ ...formData, openingHours: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Thông tin bãi đỗ xe</label>
                    <input
                      type="text"
                      value={formData.parking}
                      onChange={(e) => setFormData({ ...formData, parking: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">Công nghệ phòng chiếu</label>
                    <div className="flex flex-wrap gap-2">
                      {['IMAX Laser', 'Dolby Atmos', 'Gold Class', '4DX Sound', 'Sweetbox Lounge', 'Kids Hall'].map(
                        (tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                              formData.tags.includes(tag)
                                ? 'bg-red-600 text-white border-red-500'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                          >
                            {formData.tags.includes(tag) ? '✓ ' : '+ '}
                            {tag}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="isFlagship"
                      checked={formData.isFlagship}
                      onChange={(e) => setFormData({ ...formData, isFlagship: e.target.checked })}
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-800 border-slate-700"
                    />
                    <label htmlFor="isFlagship" className="text-xs text-slate-200 font-semibold cursor-pointer">
                      Đây là Cụm rạp Flagship (Tiêu biểu / Nổi bật nhất)
                    </label>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30"
                    >
                      {editingCinema ? 'Lưu thay đổi' : 'Thêm mới ngay'}
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

export default CinemaManagePage;

