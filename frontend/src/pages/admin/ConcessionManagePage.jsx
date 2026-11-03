import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const ConcessionManagePage = () => {
  const [concessions, setConcessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    price: 65000,
    description: '',
    image: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=500&auto=format&fit=crop',
  });

  useEffect(() => {
    fetchConcessions();
  }, []);

  const fetchConcessions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/concessions');
      setConcessions(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải bắp nước:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/concessions', formData);
      alert('Thêm gói bắp nước mới thành công!');
      setIsModalOpen(false);
      setFormData({
        name: '',
        price: 65000,
        description: '',
        image: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=500&auto=format&fit=crop',
      });
      fetchConcessions();
    } catch (err) {
      alert('Lỗi tạo bắp nước: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Bạn có chắc muốn xóa món "${name}" không?`)) {
      try {
        await api.delete(`/admin/concessions/${id}`);
        fetchConcessions();
        alert('Đã xóa món thành công!');
      } catch (err) {
        alert('Lỗi xóa món: ' + (err.response?.data?.message || err.message));
      }
    }
  };

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
                <span>🍿</span>
                <span>Quản Lý Bắp Nước & Combo</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Quản lý thực đơn F&B, combo bắp rang bơ, nước ngọt tại quầy D'AVENOR Express.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-red-600/20"
            >
              <span>➕</span>
              <span>Thêm Combo Bắp Nước</span>
            </button>
          </div>

          {/* Grid danh sách bắp nước */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Đang tải thực đơn bắp nước...</div>
          ) : concessions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">Chưa có combo bắp nước nào</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {concessions.map((c) => (
                <div
                  key={c.id || c._id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div className="h-40 overflow-hidden relative bg-slate-800">
                    <img
                      src={c.image || 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=500&auto=format&fit=crop'}
                      alt={c.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-amber-400 font-mono font-bold text-xs">
                      {Number(c.price || 0).toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="font-bold text-white text-sm">{c.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {c.description || 'Combo bắp nước chuẩn vị rạp chiếu phim.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end">
                      <button
                        onClick={() => handleDelete(c.id || c._id, c.name)}
                        className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-950/40 border border-red-500/20 transition-all font-semibold"
                      >
                        🗑️ Xóa món
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal Thêm Bắp Nước */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <h3 className="text-lg font-bold text-white">Thêm Combo Bắp Nước Mới</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tên món / Combo *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="VD: Combo Sweet Couple (1 Bắp ngọt + 2 Coca)"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Giá bán (VNĐ) *</label>
                    <input
                      type="number"
                      step="5000"
                      min="10000"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Mô tả chi tiết</label>
                    <textarea
                      rows="2"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="VD: 01 Bắp Caramel thơm giòn cỡ lớn + 02 Nước ngọt Coca-Cola 32oz"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Link hình ảnh (URL)</label>
                    <input
                      type="url"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30"
                    >
                      Thêm vào thực đơn
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

export default ConcessionManagePage;

