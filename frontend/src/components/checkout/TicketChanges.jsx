import { useEffect, useState } from 'react';
import api from '../../services/api';
import { cinemaDate } from '../../utils/cinemaCalendar';

const clock = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const dayMs = 86400000;

export default function TicketChanges({ booking, onChanged }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(cinemaDate());
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [seats, setSeats] = useState([]);
  const [selection, setSelection] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const movieId = booking.showtime?.movie?.id;
  const canChange = booking.status === 'PAID' && !booking.isCheckedIn && booking.paymentStatus === 'SIMULATED'
    && Date.parse(booking.showtime?.startTime) - Date.now() >= dayMs;

  useEffect(() => {
    if (!open || !date || !movieId) return;
    const request = new AbortController();
    api.get(`/movies/${movieId}/schedule`, { params: { date }, signal: request.signal })
      .then(({ data }) => {
        if (request.signal.aborted) return;
        setSlots((data.showtimes || []).filter(slot =>
          slot.id !== booking.showtime?.id && slot.roomId && !slot.isLocked &&
          Number(slot.availableSeats) > 0 && Date.parse(slot.startTime) > Date.now()
        ));
        setLoading(false);
      })
      .catch(() => {
        if (!request.signal.aborted) { setMessage('Không tải được suất chiếu.'); setLoading(false); }
      });
    return () => request.abort();
  }, [open, date, movieId, booking.showtime?.id]);

  async function selectSlot(id) {
    setSlotId(id);
    setSeats([]);
    setSelection([]);
    setMessage('');
    if (!id) return;
    setPending(true);
    try {
      const { data } = await api.get(`/showtimes/${id}/seats`);
      setSeats((data.seats || []).filter(seat => seat.status === 'AVAILABLE'));
    } catch {
      setMessage('Không tải được ghế cho suất đã chọn.');
    } finally {
      setPending(false);
    }
  }

  async function submit(action) {
    const cancel = action === 'cancel';
    if (pending || (!cancel && (!slotId || !selection.length))) return;
    if (!window.confirm(cancel ? 'Hủy đơn và giải phóng toàn bộ ghế trong đơn?' : 'Xác nhận đổi suất và ghế đã chọn?')) return;
    setPending(true);
    setMessage('');
    try {
      const { data } = await api.post(`/bookings/${booking.id}/${action}`, cancel ? {} : {
        targetShowtimeId: slotId, newSeatNumbers: selection,
      });
      setMessage(cancel ? data.message : `Đã đổi vé. Chênh lệch mô phỏng ${money.format(data.priceDiff)}.`);
      setOpen(false);
      onChanged();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Chưa cập nhật được vé.');
    } finally {
      setPending(false);
    }
  }

  if (!canChange && !message) return null;
  const button = 'rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold disabled:opacity-50';
  return <section aria-label="Đổi hoặc hủy vé" className="space-y-3 rounded-xl border border-slate-700 p-3">
    {canChange && <>
      <p className="text-xs text-slate-300">Đổi hoặc hủy trước giờ chiếu ít nhất 24 giờ.</p>
      <div className="flex gap-2">
        <button type="button" className={button} disabled={pending || !movieId}
          onClick={() => { if (!open) { setLoading(true); setMessage(''); } setOpen(value => !value); }}>Đổi vé</button>
        <button type="button" className={button + ' text-rose-300'} disabled={pending} onClick={() => submit('cancel')}>Hủy vé</button>
      </div>
      {open && <div className="space-y-3">
        <label className="block text-sm">Ngày chiếu mới
          <input type="date" min={cinemaDate()} max={cinemaDate(Date.now() + 7 * dayMs)} value={date}
            onChange={event => {
              setDate(event.target.value); setSlotId(''); setSlots([]); setSeats([]); setSelection([]);
              setLoading(Boolean(event.target.value)); setMessage('');
            }} className="ml-2 rounded-lg bg-slate-900 p-2" />
        </label>
        {loading ? <p role="status">Đang tải suất chiếu…</p> : slots.length === 0 ? <p>Chưa có suất phù hợp.</p> : <>
          <label className="block text-sm">Suất chiếu mới
            <select value={slotId} onChange={event => selectSlot(event.target.value)} disabled={pending}
              className="mt-1 w-full rounded-lg bg-slate-900 p-2">
              <option value="">Chọn suất</option>
              {slots.map(slot => <option key={slot.id} value={slot.id}>{clock.format(new Date(slot.startTime))} · {slot.roomName}</option>)}
            </select>
          </label>
          {slotId && !pending && !seats.length && <p>Chưa có ghế khả dụng.</p>}
          <div className="flex flex-wrap gap-2">
            {seats.map(seat => <button key={seat.id} type="button" aria-pressed={selection.includes(seat.seatNumber)}
              onClick={() => setSelection(current => current.includes(seat.seatNumber)
                ? current.filter(item => item !== seat.seatNumber) : [...current, seat.seatNumber])}
              className={button + ' aria-pressed:border-cyan-300 aria-pressed:text-cyan-300'}>{seat.seatNumber}</button>)}
          </div>
          <button type="button" disabled={pending || !selection.length}
            className={button + ' text-cyan-300'} onClick={() => submit('exchange')}>Xác nhận đổi {selection.length || ''} ghế</button>
        </>}
      </div>}
    </>}
    {message && <p role="status" className="text-sm text-slate-200">{message}</p>}
  </section>;
}
