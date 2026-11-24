import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminSectionTabs from '../../components/admin/AdminSectionTabs';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const paymentLabels = {
  SIMULATED: 'Mô phỏng', VERIFIED: 'Đã xác minh',
  PENDING: 'Chờ thanh toán', FAILED: 'Thất bại', LEGACY_UNVERIFIED: 'Chưa đối soát',
};

export default function BookingManagePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const loading = !error && (result?.search !== search || result?.page !== page || result?.retry !== retry);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const { data } = await api.get('/admin/bookings', { params: { search, page }, signal: controller.signal });
        if (!controller.signal.aborted) setResult({ ...data, search, retry });
      } catch {
        if (!controller.signal.aborted) setError('Không tải được đơn đặt vé.');
      }
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [search, page, retry]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-main)]">
      <SidebarAdmin />
      <div className="min-w-0 flex-1">
        <TopbarAdmin />
        <main className="space-y-5 p-4 sm:p-6">
          <AdminSectionTabs />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Đơn đặt vé</h1>
            <div className="flex gap-4 text-sm text-cyan-300">
              <Link to="/admin/concessions">Quản lý combo</Link>
              <Link to="/admin/promotions">Quản lý ưu đãi</Link>
            </div>
          </div>
          <label className="block max-w-md space-y-1 text-sm text-slate-300">
            <span>Tìm đơn đặt vé</span>
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); setError(''); }}
              placeholder="Mã vé, tên hoặc số điện thoại" className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5" />
          </label>
          {error ? (
            <p role="alert" className="text-rose-300">{error} <button onClick={() => { setError(''); setRetry(n => n + 1); }}>Thử lại</button></p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800" aria-busy={loading}>
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-900 text-slate-300"><tr>
                  {['Mã vé', 'Khách hàng', 'Phim', 'Ghế', 'Tổng tiền', 'Thanh toán'].map(label => <th key={label} className="p-3">{label}</th>)}
                </tr></thead>
                <tbody className={loading ? 'opacity-60' : ''}>
                  {result?.bookings.map(booking => (
                    <tr key={booking.id} className="border-t border-slate-800">
                      <td className="p-3"><button onClick={() => setSelectedBooking(booking)} className="text-cyan-300">{booking.bookingCode}</button></td>
                      <td className="p-3">{booking.customerName}</td>
                      <td className="p-3">{booking.showtime?.movie?.title || 'Chưa xác định'}</td>
                      <td className="p-3">{booking.seats}</td>
                      <td className="p-3">{money.format(booking.totalAmount)}</td>
                      <td className="p-3">{paymentLabels[booking.paymentStatus] || 'Chưa đối soát'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <p role="status" className="p-4 text-sm text-slate-400">Đang tải đơn đặt vé…</p>}
              {!loading && !result?.bookings.length && <p className="p-4 text-sm text-slate-400">Không tìm thấy đơn phù hợp.</p>}
            </div>
          )}
          <div className="flex items-center gap-4 text-sm">
            <button disabled={loading || page === 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Trang trước</button>
            <span>Trang {page}</span>
            <button disabled={loading || !result || page * result.limit >= result.total}
              onClick={() => setPage(page + 1)} className="disabled:opacity-40">Trang sau</button>
          </div>
        </main>
      </div>
      {selectedBooking && <aside aria-label="Chi tiết đơn" className="fixed inset-y-0 right-0 z-50 w-full max-w-md space-y-3 overflow-y-auto border-l border-slate-700 bg-slate-900 p-6 shadow-xl">
        <div className="flex justify-between gap-4"><h2 className="font-semibold">{selectedBooking.bookingCode}</h2>
          <button onClick={() => setSelectedBooking(null)} className="text-cyan-300">Đóng</button>
        </div>
        <p>{selectedBooking.customerName} · {selectedBooking.customerPhone}</p>
        <p>{selectedBooking.showtime?.movie?.title} · {selectedBooking.showtime?.roomName}</p>
        <p>Ghế {selectedBooking.seats}</p>
        <p>Combo {selectedBooking.concessions || '—'}</p>
        <p>Ưu đãi {selectedBooking.priceSnapshot?.voucherCode || '—'}</p>
        <p>Tổng {money.format(selectedBooking.totalAmount)}</p>
        <p>Thanh toán {paymentLabels[selectedBooking.paymentStatus] || 'Chưa đối soát'}</p>
        <p>{selectedBooking.isCheckedIn ? 'Đã soát vé' : selectedBooking.status === 'CANCELLED' ? 'Đã hủy' : 'Chưa soát vé'}</p>
        {!!selectedBooking.exchangeHistory?.length && <p>Đã đổi vé {selectedBooking.exchangeHistory.length} lần</p>}
      </aside>}
    </div>
  );
}
