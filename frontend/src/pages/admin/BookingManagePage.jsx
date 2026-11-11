import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const BookingManagePage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBookings();
  }, [searchTerm]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const url = searchTerm
        ? `/admin/bookings?search=${encodeURIComponent(searchTerm)}`
        : '/admin/bookings';
      const res = await api.get(url);
      setBookings(res.data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách vé:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/admin/bookings/${id}/status`, { status: newStatus });
      fetchBookings();
    } catch (err) {
      alert('Lỗi cập nhật trạng thái: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black">Quản Lý Đơn Đặt Vé & Hóa Đơn</h1>
              <p className="text-xs text-slate-400">Tra cứu toàn bộ lịch sử mua vé và ghế ngồi của khách hàng</p>
            </div>
            <input
              type="text"
              placeholder="🔍 Tìm theo mã vé, SĐT, tên khách..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-full sm:w-80 shadow-md"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Mã vé</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Phim & Phòng chiếu</th>
                  <th className="px-4 py-3">Ghế ngồi</th>
                  <th className="px-4 py-3">Bắp nước</th>
                  <th className="px-4 py-3">Tổng tiền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Ngày đặt</th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-10 text-center text-slate-400">
                      Đang tải danh sách đơn đặt vé...
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                      Không tìm thấy đơn đặt vé nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-black text-red-400">
                        #{b.bookingCode}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{b.customerName}</div>
                        <div className="text-xs text-slate-500">{b.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{b.showtime?.movie?.title}</div>
                        <div className="text-xs text-slate-500">{b.showtime?.roomName}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-400">{b.seats}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-xs truncate">
                        {b.concessions || 'Không'}
                      </td>
                      <td className="px-4 py-3 font-black text-white">
                        {b.totalAmount?.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            b.status === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {b.status === 'PAID' ? 'Đã thanh toán' : b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(b.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {b.status !== 'PAID' && (
                            <button
                              onClick={() => handleStatusChange(b.id || b._id, 'PAID')}
                              className="px-2 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded text-[11px] font-bold transition-all"
                              title="Xác nhận thanh toán"
                            >
                              ✓ Duyệt
                            </button>
                          )}
                          {b.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                if (window.confirm('Bạn có chắc muốn hủy đơn vé này không?')) {
                                  handleStatusChange(b.id || b._id, 'CANCELLED');
                                }
                              }}
                              className="px-2 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded text-[11px] font-bold transition-all"
                              title="Hủy vé"
                            >
                              ✕ Hủy
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
};

export default BookingManagePage;
