import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const PromotionManagePage = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    code: '',
    discountAmount: 30000,
    discountPercent: 0,
    description: '',
    validUntil: '',
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/promotions');
      setPromotions(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải khuyến mãi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/promotions', formData);
      alert('Tạo mã khuyến mãi mới thành công!');
      setIsModalOpen(false);
      setFormData({
        title: '',
        code: '',
        discountAmount: 30000,
        discountPercent: 0,
        description: '',
        validUntil: '',
      });
      fetchPromotions();
    } catch (err) {
      alert('Lỗi tạo mã: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Bạn có chắc muốn xóa mã ưu đãi "${title}" không?`)) {
      try {
        await api.delete(`/admin/promotions/${id}`);
        fetchPromotions();
        alert('Đã xóa khuyến mãi thành công!');
      } catch (err) {
        alert('Lỗi xóa: ' + (err.response?.data?.message || err.message));
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
                <span>🏷️</span>
                <span>Quản Lý Khuyến Mãi & Voucher</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Tạo mã giảm giá, voucher chiết khấu thanh toán vé cho khách hàng D'AVENOR CLUB.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-red-600/20"
            >
              <span>➕</span>
              <span>Tạo Mã Ưu Đãi Mới</span>
            </button>
          </div>

          {/* Danh sách khuyến mãi */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách ưu đãi...</div>
            ) : promotions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">Chưa có mã khuyến mãi nào</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Tên chương trình</th>
                      <th className="py-3 px-4">Mã Voucher</th>
                      <th className="py-3 px-4">Mức giảm giá</th>
                      <th className="py-3 px-4">Hạn áp dụng</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {promotions.map((p) => {
                      const validDate = p.validUntil ? new Date(p.validUntil).toLocaleDateString('vi-VN') : 'Vô thời hạn';
                      return (
                        <tr key={p.id || p._id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-white block text-sm">{p.title}</span>
                            <span className="text-[11px] text-slate-400 line-clamp-1">{p.description}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono font-black text-xs">
                              {p.code || 'CHƯA CÓ MÃ'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                            {p.discountAmount
                              ? `- ${Number(p.discountAmount).toLocaleString('vi-VN')} đ`
                              : p.discountPercent
                              ? `- ${p.discountPercent}%`
                              : 'Ưu đãi tặng kèm'}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-medium">{validDate}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Đang kích hoạt
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDelete(p.id || p._id, p.title)}
                              className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all text-xs"
                              title="Xóa voucher"
                            >
                              🗑️
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

          {/* Modal Tạo Voucher */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <h3 className="text-lg font-bold text-white">Tạo Mã Voucher Khuyến Mãi Mới</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tên chương trình ưu đãi *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="VD: Tri Ân Khách Hàng - Giảm 30.000đ"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Mã Code nhập (Voucher Code) *</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="VD: DAVENOR30, VIP50"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500 font-mono uppercase font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Số tiền giảm (VNĐ)</label>
                      <input
                        type="number"
                        step="5000"
                        value={formData.discountAmount}
                        onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Ngày hết hạn</label>
                      <input
                        type="date"
                        value={formData.validUntil}
                        onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Mô tả điều kiện áp dụng</label>
                    <textarea
                      rows="2"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="VD: Áp dụng cho đơn vé từ 2 người trở lên tại tất cả cụm rạp D'AVENOR."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    ></textarea>
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
                      Kích hoạt Voucher
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

export default PromotionManagePage;

