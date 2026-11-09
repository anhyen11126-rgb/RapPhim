import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';
import { resolvePromotionVisuals } from '../../utils/visualResolver';

const PROMO_IMAGE_PRESETS = [
  { label: '🏎️ Thứ 4 Happy Day (Màn chiếu bom tấn)', url: '/images/promotions/promo-happy-day.png' },
  { label: '🥤 Combo Avatar Limited (Tặng Ly VIP)', url: '/images/promotions/promo-avatar-combo.png' },
  { label: '👑 Thẻ Hội Viên VIP D\'AVENOR Prime', url: '/images/promotions/promo-vip-prime.png' },
  { label: '🎒 Ưu Đãi Học Sinh - Sinh Viên U22', url: '/images/promotions/promo-student-u22.png' },
  { label: '💳 Quét VNPAY-QR Giảm Giá Cuối Tuần', url: '/images/promotions/promo-vnpay-qr.png' },
  { label: '🎬 Phòng Chiếu IMAX Laser & Gold Class', url: '/images/promotions/promo-imax-gold.png' },
];

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
    image: '/images/promotions/promo-happy-day.png',
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/promotions');
      const mapped = (res.data || []).map((p) => resolvePromotionVisuals(p));
      setPromotions(mapped);
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
        image: '/images/promotions/promo-happy-day.png',
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
                Quản lý chương trình khuyến mãi nổi bật và mã giảm giá thanh toán vé D'AVENOR CLUB.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-red-600/20 cursor-pointer"
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
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-bold whitespace-nowrap">
                      <th className="py-3.5 px-4 w-[42%]">Chương trình / Hình ảnh</th>
                      <th className="py-3.5 px-4">Phân loại / Mã</th>
                      <th className="py-3.5 px-4">Mức ưu đãi</th>
                      <th className="py-3.5 px-4">Thời hạn / Áp dụng</th>
                      <th className="py-3.5 px-4 text-center">Trạng thái</th>
                      <th className="py-3.5 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {promotions.map((p) => {
                      const validDate = p.expiryDate
                        ? p.expiryDate
                        : p.validUntil
                        ? new Date(p.validUntil).toLocaleDateString('vi-VN')
                        : 'Đang áp dụng';
                      return (
                        <tr key={p.id || p._id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4 max-w-[380px] xl:max-w-[460px]">
                            <div className="flex items-center space-x-3 min-w-0">
                              <img
                                src={p.image || '/images/promotions/promo-happy-day.png'}
                                alt={p.title}
                                className="w-16 h-10 rounded-lg object-cover border border-slate-700 shrink-0 bg-slate-950"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-white block text-sm truncate">{p.title}</span>
                                <span className="text-[11px] text-slate-400 block truncate">
                                  {p.description || p.conditions}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-block px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono font-black text-xs">
                              {p.code || p.type || 'PROGRAM'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                            {p.badgeSpecial ||
                              p.discountValue ||
                              (p.discountAmount
                                ? `- ${Number(p.discountAmount).toLocaleString('vi-VN')} đ`
                                : p.discountPercent
                                ? `- ${p.discountPercent}%`
                                : 'Ưu đãi đặc biệt')}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-medium whitespace-nowrap">
                            {p.badgeTop || validDate}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                              <span>Đang kích hoạt</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDelete(p.id || p._id, p.title)}
                              className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all text-xs cursor-pointer"
                              title="Xóa ưu đãi"
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
                  <h3 className="text-lg font-bold text-white">Tạo Mã Voucher / Ưu Đãi Mới</h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
                  >
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
                    <label className="block text-slate-300 font-semibold mb-1">Hình ảnh banner</label>
                    <select
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500 mb-2"
                    >
                      {PROMO_IMAGE_PRESETS.map((preset) => (
                        <option key={preset.url} value={preset.url}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Mô tả điều kiện áp dụng</label>
                    <textarea
                      rows="2"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="VD: Áp dụng cho đơn vé từ 2 người trở lên tại rạp D'AVENOR Thanh Khê Plaza."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    ></textarea>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 cursor-pointer"
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
