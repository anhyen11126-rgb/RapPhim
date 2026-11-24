import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Armchair, AudioLines, CalendarDays, ChevronLeft, ChevronRight, Clapperboard, Crown, MapPin, Monitor } from 'lucide-react';
import api from '../../services/api';
import { cinemaDate, monthLabel, releaseMonth } from '../../utils/cinemaCalendar';
import './movieSchedule.css';

const dayMs = 86400000;
const vietnamDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
const vietnamTime = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const weekday = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'long' });
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const formats = [
  { name: 'IMAX Laser', tone: 'imax', icon: Monitor },
  { name: 'Dolby Atmos', tone: 'atmos', icon: AudioLines },
  { name: 'Gold Class', tone: 'gold', icon: Crown },
];

const dateKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const dateMs = (date) => Date.parse(date + 'T00:00:00Z');

export function scheduleStatus(slot, now) {
  const starts = Date.parse(slot.startTime);
  if (!Number.isFinite(starts) || starts <= now) return { label: 'Đã bắt đầu', disabled: true };
  if (starts - now > 7 * dayMs) return { label: 'Sắp mở bán', disabled: true };
  if (slot.isLocked) return { label: 'Tạm ngừng bán', disabled: true };
  if (slot.availableSeats === 0) return { label: 'Hết vé', disabled: true };
  if (!slot.roomId) return { label: 'Phòng chưa xác định', disabled: true };
  if (slot.availableSeats == null) return { label: 'Xem sơ đồ ghế' };
  return {
    label: 'Còn ' + slot.availableSeats + ' ghế',
    low: slot.totalSeats > 0 && slot.availableSeats / slot.totalSeats <= 0.15,
    available: true,
  };
}

function ScheduleGroup({ format, slots, duration, now, onBook }) {
  const { name, icon: Icon, tone } = format;
  const prices = slots.map(slot => slot.price).filter(Number.isFinite);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const features = [...new Set(slots.map(slot => slot.roomFeature).filter(Boolean))];
  return (
    <section className="sc-group" data-tone={tone} aria-label={name}>
      <div className="sc-brand"><Icon size={29} aria-hidden="true" /><strong>{name}</strong></div>
      <div className="sc-group-body">
        <div className="sc-group-heading">
          <div><h3>Phòng chiếu {name}</h3>{features.length === 1 && <p>{features[0]}</p>}</div>
          {!!prices.length && <p className="sc-range">Giá vé <strong>{currency.format(min)}{max !== min && ' – ' + currency.format(max)}</strong></p>}
        </div>
        {slots.length ? <div className="sc-slots" style={{ '--sc-count': Math.min(slots.length, 6) }}>
          {slots.map(slot => {
            const status = scheduleStatus(slot, now);
            const start = Date.parse(slot.startTime);
            const end = slot.endTime ? Date.parse(slot.endTime) : duration > 0 ? start + duration * 60000 : NaN;
            return (
              <button type="button" className="sc-slot" key={slot.id} disabled={status.disabled} data-low={status.low || undefined}
                onClick={() => onBook(slot)} title={slot.roomName}>
                <span className="sc-hours"><strong>{vietnamTime.format(start)}</strong>{Number.isFinite(end) && <span>~ {vietnamTime.format(end)}</span>}</span>
                {Number.isFinite(slot.price) && <span className="sc-price">{currency.format(slot.price)}</span>}
                <span className="sc-inventory" data-available={slot.availableSeats > 0 && !status.disabled || undefined}>
                  <Armchair size={15} aria-hidden="true" />
                  {slot.availableSeats == null ? 'Chưa có số ghế'
                    : 'Còn ' + slot.availableSeats + (slot.totalSeats == null ? '' : '/' + slot.totalSeats) + ' ghế'}
                </span>
                {(status.disabled || status.low || slot.availableSeats == null) && (
                  <span className={status.low ? 'sc-low' : 'sc-slot-status'}>
                    {status.low ? 'Sắp hết vé' : status.label}
                  </span>
                )}
              </button>
            );
          })}
        </div> : <p className="sc-empty">Chưa có suất chiếu trong ngày.</p>}
      </div>
    </section>
  );
}

export default function MovieShowtimesSection({ movie }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now);
  const today = vietnamDate.format(now);
  const release = cinemaDate(movie.releaseDate);
  const movieMonth = releaseMonth(movie);
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get('date');
  const defaultDate = release > today ? release : today;
  const monthStart = movieMonth ? dateMs(movieMonth + '-01') : null;
  const nextMonth = monthStart == null ? null : Date.UTC(
    new Date(monthStart).getUTCFullYear(), new Date(monthStart).getUTCMonth() + 1, 1,
  );
  const lastDate = nextMonth == null ? null : dateKey(nextMonth - dayMs);
  const endedRun = lastDate != null && today > lastDate;
  const validInitialDate = /^\d{4}-\d{2}-\d{2}$/.test(initialDate ?? '') && Number.isFinite(dateMs(initialDate));
  const [selection, setSelection] = useState(() => ({ day: today, date: validInitialDate ? initialDate : defaultDate }));
  const [result, setResult] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [retry, setRetry] = useState(0);
  const activeDay = useRef(null);
  const autoAdvance = useRef(!validInitialDate);
  const [lookAhead, setLookAhead] = useState(null);
  const requestedDate = selection.day === today && selection.date >= defaultDate ? selection.date : defaultDate;
  const date = lastDate && !endedRun && requestedDate > lastDate ? lastDate : requestedDate;
  const offset = Math.max(0, Math.floor((dateMs(date) - dateMs(defaultDate)) / (7 * dayMs)));
  const weekStart = dateMs(defaultDate) + offset * 7 * dayMs;
  const weekDays = Array.from({ length: 7 }, (_, i) => dateKey(weekStart + i * dayMs))
    .filter(key => lastDate == null || key <= lastDate);
  const lastWeek = nextMonth != null && weekStart + 7 * dayMs >= nextMonth;
  const active = result?.date === date && result?.day === today && result?.retry === retry ? result : null;
  const id = movie._id || movie.id || movie.slug;

  const previousToday = useRef(today);
  useEffect(() => {
    if (previousToday.current !== today) {
      previousToday.current = today;
      autoAdvance.current = true;
    }
  }, [today]);

  useEffect(() => {
    if (endedRun) return;
    const request = new AbortController();
    let timer;

    async function refreshSchedule() {
      try {
        const { data } = await api.get('/movies/' + encodeURIComponent(id) + '/schedule', {
          params: { date }, signal: request.signal,
        });
        if (request.signal.aborted) return;
        setResult({ date, day: today, retry, slots: data.showtimes ?? [] });
        if (data.cinema) setCinema(data.cinema);
      } catch {
        if (!request.signal.aborted) {
          setResult(current => current?.date === date && current.day === today && current.retry === retry && current.slots
            ? { ...current, stale: true } : { date, day: today, retry, error: true });
        }
      } finally {
        if (!request.signal.aborted) timer = window.setTimeout(refreshSchedule, 5000);
      }
    }

    refreshSchedule();
    return () => {
      request.abort();
      window.clearTimeout(timer);
    };
  }, [date, endedRun, id, retry, today]);

  const noBookableSlots = Boolean(active?.slots && !endedRun
    && active.slots.every(slot => scheduleStatus(slot, now).disabled));

  useEffect(() => {
    if (!noBookableSlots) return;
    const request = new AbortController();

    async function findNextDay() {
      for (let step = 1; step <= 7; step++) {
        const candidate = dateKey(dateMs(date) + step * dayMs);
        if (Date.parse(candidate + 'T00:00:00+07:00') > Date.now() + 7 * dayMs) break;
        if (movieMonth && candidate.slice(0, 7) !== movieMonth) break;
        const { data } = await api.get('/movies/' + encodeURIComponent(id) + '/schedule', {
          params: { date: candidate }, signal: request.signal,
        });
        if (request.signal.aborted) return;
        if (data.showtimes?.some(slot => !scheduleStatus(slot, Date.now()).disabled)) {
          setLookAhead({ from: date, date: candidate });
          if (autoAdvance.current) {
            autoAdvance.current = false;
            setSelection({ day: today, date: candidate });
          }
          return;
        }
      }
      if (!request.signal.aborted) setLookAhead({ from: date, date: null });
    }

    findNextDay().catch(() => {
      if (!request.signal.aborted) setLookAhead({ from: date, date: null });
    });
    return () => request.abort();
  }, [noBookableSlots, date, movieMonth, id, today]);

  const chooseDate = (value) => {
    if (endedRun || value < defaultDate || (lastDate && value > lastDate)) return;
    autoAdvance.current = false;
    setSelection({ day: today, date: value });
  };

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    const timer = window.setInterval(updateClock, 1000);
    document.addEventListener('visibilitychange', updateClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateClock);
    };
  }, []);

  useEffect(() => {
    const button = activeDay.current;
    if (!button) return;
    const strip = button.parentElement;
    const bounds = strip.getBoundingClientRect();
    const day = button.getBoundingClientRect();
    if (day.left < bounds.left || day.right > bounds.right) {
      strip.scrollLeft += day.left - bounds.left - 4;
    }
  }, [date]);

  const book = (slot) => {
    if (scheduleStatus(slot, Date.now()).disabled) return;
    const { showtimes, reviews, ...movieInfo } = movie;
    navigate('/booking/seat/' + slot.id, { state: { slotInfo: {
      ...slot, date, time: vietnamTime.format(new Date(slot.startTime)), format: slot.formatFeature || slot.roomType,
      cinemaName: slot.cinemaName || cinema?.name, movie: movieInfo,
    } } });
  };

  const upcomingSlots = (active?.slots ?? []).filter(slot => Date.parse(slot.startTime) > now);
  const visibleFormats = [...formats];
  for (const slot of upcomingSlots) {
    if (!slot.roomType || visibleFormats.some(format => format.name === slot.roomType)) continue;
    visibleFormats.push({ name: slot.roomType, tone: 'imax', icon: Monitor });
  }
  if (upcomingSlots.some(slot => !slot.roomType)) visibleFormats.push({ name: 'Khác', tone: 'imax', icon: Monitor });

  return (
    <section id="showtimes-section" className="sc-shell" aria-labelledby="sc-title">
      <div className="sc-heading"><Clapperboard size={32} aria-hidden="true" /><div>
        <h2 id="sc-title">Lịch chiếu</h2><p>Chọn ngày và suất chiếu phù hợp với bạn</p>
      </div></div>

      {!endedRun && <div className="sc-dates">
        <button className="sc-arrow" type="button" aria-label="Bảy ngày trước" disabled={offset === 0} onClick={() => chooseDate(dateKey(weekStart - 7 * dayMs))}><ChevronLeft /></button>
        <div className="sc-days" data-short-week={weekDays.length < 7 || undefined} aria-label="Ngày chiếu">
          {weekDays.map(key => (
            <button type="button" key={key} ref={date === key ? activeDay : null} aria-pressed={date === key} onClick={() => chooseDate(key)}>
              {key === today && <small>Hôm nay</small>}
              <strong>{key.slice(8)}/{key.slice(5, 7)}</strong>
              <span>{weekday.format(dateMs(key))}</span>
            </button>
          ))}
        </div>
        <button className="sc-arrow" type="button" aria-label="Bảy ngày tiếp theo" disabled={lastWeek} onClick={() => chooseDate(dateKey(weekStart + 7 * dayMs))}><ChevronRight /></button>
        <label className="sc-picker">
          <CalendarDays size={19} aria-hidden="true" /><span>Chọn ngày</span>
          <input type="date" aria-label="Chọn ngày" min={defaultDate} max={lastDate ?? undefined} value={date} onClick={(event) => {
            try { event.currentTarget.showPicker?.(); } catch { /* Native date input remains available. */ }
          }} onChange={(event) => {
            if (event.target.value && event.target.validity.valid) chooseDate(event.target.value);
          }} />
        </label>
      </div>}

      <div className="sc-context">
        {movieMonth && <span className="sc-release">{monthLabel(movieMonth)}</span>}
        {cinema && <Link to={'/theaters?date=' + date} className="sc-location" title={cinema.address} aria-label={cinema.address ? cinema.name + ', ' + cinema.address : cinema.name}>
          <MapPin size={19} aria-hidden="true" />{cinema.name}
        </Link>}
        <div className="sc-legend" aria-label="Loại phòng chiếu">
          {formats.map(({ name, tone }) => <span key={name} data-tone={tone}>{name}</span>)}
        </div>
      </div>

      {!endedRun && lastWeek && nextMonth != null && (
        <Link className="sc-other-films sc-next-month" to={'/theaters?date=' + dateKey(nextMonth)}>
          {'Xem phim tháng '}{dateKey(nextMonth).slice(5, 7)}/{dateKey(nextMonth).slice(0, 4)}
        </Link>
      )}

      {noBookableSlots && (
        <div className="sc-notice" role="status">
          <span>{date === today ? 'Hôm nay không còn suất có thể đặt.' : 'Ngày này chưa có suất mở bán.'}</span>
          {lookAhead?.from === date && lookAhead.date && (
            <button type="button" onClick={() => chooseDate(lookAhead.date)}>
              {'Xem suất ngày '}{lookAhead.date.slice(8)}/{lookAhead.date.slice(5, 7)}
            </button>
          )}
        </div>
      )}

      {active?.stale && <p className="sc-notice" role="status">{'Chưa thể cập nhật số ghế. Đang thử lại…'}</p>}
      <div className="sc-groups" aria-busy={!endedRun && !active}>
        {endedRun ? <p className="sc-empty">
          {'Lịch chiếu của phim trong '}{monthLabel(movieMonth).toLowerCase()}{' đã kết thúc. '}
          <Link className="sc-other-films" to={'/theaters?date=' + today}>{'Xem lịch phim hiện tại'}</Link>
        </p>
        : !active ? <><p role="status" className="sr-only">Đang tải lịch chiếu…</p>
          {formats.map(({ name }) => <div className="sc-skeleton" key={name} aria-hidden="true" />)}</>
          : active.error ? <div className="sc-error" role="status">Không thể tải lịch chiếu. <button type="button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div>
          : visibleFormats.map(format => {
            const slots = upcomingSlots.filter(slot => (slot.roomType || 'Khác') === format.name);
            return slots.length > 0 && <ScheduleGroup key={format.name} format={format}
              slots={slots} duration={movie.duration} now={now} onBook={book} />;
          })}
      </div>
    </section>
  );
}
