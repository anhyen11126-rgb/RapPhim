import { useState } from 'react';
import AdminSectionTabs from '../../components/admin/AdminSectionTabs';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

export default function CheckInManagePage() {
  const [qrToken, setQrToken] = useState('');
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(false);

  async function checkIn(event) {
    event.preventDefault();
    if (pending || !qrToken.trim()) return;
    setPending(true);
    setResult(null);
    try {
      const { data } = await api.post('/bookings/check-in', { qrToken: qrToken.trim() });
      setResult({ success: true, message: `Đã soát toàn bộ ghế ${data.booking.seats} của đơn ${data.booking.bookingCode}.` });
      setQrToken('');
    } catch (error) {
      setResult({ success: false, message: error.response?.data?.message || 'Chưa soát được vé. Vui lòng thử lại.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-main)]">
      <SidebarAdmin />
      <div className="min-w-0 flex-1"><TopbarAdmin />
        <main className="space-y-5 p-4 sm:p-6">
          <AdminSectionTabs />
          <h1 className="text-2xl font-semibold">Soát vé QR</h1>
          <form onSubmit={checkIn} className="max-w-lg space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
            <label className="block space-y-2">
              <span>Nội dung QR từ máy quét</span>
              <input autoComplete="off" value={qrToken} onChange={event => setQrToken(event.target.value)}
                required className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5" />
            </label>
            <button disabled={pending} className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">
              {pending ? 'Đang kiểm tra…' : 'Xác nhận soát vé'}
            </button>
            {result && <p role="status" className={result.success ? 'text-emerald-300' : 'text-rose-300'}>{result.message}</p>}
          </form>
        </main>
      </div>
    </div>
  );
}
