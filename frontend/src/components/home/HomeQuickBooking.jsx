import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { cinemaDate, monthLabel, releaseMonth } from '../../utils/cinemaCalendar';

const getAgeBadgeStyle = (ageRating) => {
  switch (ageRating) {
    case 'T11':
    case 'P':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/50',
        label: ageRating === 'T11' ? 'T11' : 'P',
      };
    case 'T13':
      return {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        border: 'border-yellow-500/50',
        label: 'T13',
      };
    case 'T16':
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/50',
        label: 'T16',
      };
    case 'T18':
    default:
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/50',
        label: 'T18',
      };
  }
};

// Helper lấy chuỗi YYYY-MM-DD theo giờ thực tế địa phương
export const getIsoDateString = (dateObj) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Helper lấy nhãn ngày ngắn (DD-MM)
export const getFormattedDayMonth = (dateObj) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}`;
};

// Sinh 3 mốc ngày gần nhất linh hoạt theo thời gian thực (Hôm nay, Ngày mai, Ngày kia)
export const getDynamicRecentDays = () => {
  const now = new Date();

  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const dayAfter = new Date(now);
  dayAfter.setDate(now.getDate() + 2);

  return {
    today: {
      key: 'Hôm nay',
      dateStr: getIsoDateString(today),
      label: `Hôm nay (${getFormattedDayMonth(today)})`,
      dateObj: today,
    },
    tomorrow: {
      key: 'Ngày mai',
      dateStr: getIsoDateString(tomorrow),
      label: `Ngày mai (${getFormattedDayMonth(tomorrow)})`,
      dateObj: tomorrow,
    },
    dayAfter: {
      key: 'Ngày kia',
      dateStr: getIsoDateString(dayAfter),
      label: `Ngày kia (${getFormattedDayMonth(dayAfter)})`,
      dateObj: dayAfter,
    },
  };
};

// Sinh lịch chiếu 6 tháng linh hoạt theo năm/tháng thực tế hiện tại
// Tháng hiện tại là "Đang chiếu", 5 tháng tiếp theo là "Sắp chiếu"
function monthSchedule(month, today, movies) {
  const status = month < today ? 'ENDED' : month === today ? 'NOW_SHOWING' : 'COMING_SOON';
  const label = monthLabel(month);
  const [year, number] = month.split('-').map(Number);
  return {
    year, month: number, label, code: 'month-' + month, status,
    dropdownLabel: label + ' (' + movies.length + ' phim)',
    badgeColor: status === 'NOW_SHOWING'
      ? 'text-cyan-200 bg-cyan-500/10 border-cyan-400/30'
      : 'text-violet-200 bg-violet-500/10 border-violet-400/30',
  };
}

// Hàm bóc tách tháng/năm từ lựa chọn Ngày chiếu một cách linh hoạt theo giờ thực tế
export const parseSelectedDateInfo = (val) => {
  const dynamicDays = getDynamicRecentDays();
  const todayIso = dynamicDays.today.dateStr;

  if (!val || val === 'Hôm nay') {
    const d = dynamicDays.today.dateObj;
    return {
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      dateStr: dynamicDays.today.dateStr,
      isPast: false,
    };
  }
  if (val === 'Ngày mai') {
    const d = dynamicDays.tomorrow.dateObj;
    return {
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      dateStr: dynamicDays.tomorrow.dateStr,
      isPast: false,
    };
  }
  if (val === 'Ngày kia') {
    const d = dynamicDays.dayAfter.dateObj;
    return {
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      dateStr: dynamicDays.dayAfter.dateStr,
      isPast: false,
    };
  }
  if (typeof val === 'string' && val.startsWith('month-')) {
    const parts = val.replace('month-', '').split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    const isPast = y < curY || (y === curY && m < curM);
    const isCurrentMonth = y === curY && m === curM;
    const dateStr = isCurrentMonth ? todayIso : `${parts[0]}-${parts[1].padStart(2, '0')}-15`;
    return { month: m, year: y, dateStr, isPast };
  }
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const isPast = val < todayIso;
    return { month: m, year: y, dateStr: val, isPast };
  }
  const d = dynamicDays.today.dateObj;
  return {
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    dateStr: todayIso,
    isPast: false,
  };
};

const HomeQuickBooking = ({
  moviesList,
  cinemas,
  selectedMovieId,
  setSelectedMovieId,
  selectedTheater,
  setSelectedTheater,
  selectedDate,
  setSelectedDate,
  selectedShowtimeId,
  setSelectedShowtimeId,
}) => {
  const navigate = useNavigate();
  const [isMovieDropdownOpen, setIsMovieDropdownOpen] = useState(false);
  const movieDropdownRef = useRef(null);

  // Popover chọn suất chiếu tinh tế (Hàng ngang / Hàng dọc)
  const [isShowtimeDropdownOpen, setIsShowtimeDropdownOpen] = useState(false);
  const [showtimeFilter, setShowtimeFilter] = useState('ALL'); // 'ALL' | 'IMAX' | 'ATMOS' | 'GOLD'
  const [showtimeLayout, setShowtimeLayout] = useState('HORIZONTAL'); // 'HORIZONTAL' | 'VERTICAL'
  const showtimeDropdownRef = useRef(null);

  const dateInputRef = useRef(null);

  // Đóng dropdown phim và suất chiếu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (movieDropdownRef.current && !movieDropdownRef.current.contains(event.target)) {
        setIsMovieDropdownOpen(false);
      }
      if (showtimeDropdownRef.current && !showtimeDropdownRef.current.contains(event.target)) {
        setIsShowtimeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 3 mốc ngày gần nhất linh hoạt theo thời gian thực (Hôm nay, Ngày mai, Ngày kia)
  const dynamicDays = useMemo(() => getDynamicRecentDays(), []);

  // Lịch 6 tháng luân phiên linh hoạt từ tháng hiện tại
  const todayMonth = cinemaDate().slice(0, 7);
  const monthlySchedule = [...new Set([todayMonth, ...moviesList.map(releaseMonth).filter(Boolean)])]
    .sort().map(key => monthSchedule(key, todayMonth, moviesList.filter(movie => releaseMonth(movie) === key)));

  // Xác định lịch tháng tương ứng với ngày chiếu đang được chọn
  const { month, year, dateStr: selectedDay } = useMemo(
    () => parseSelectedDateInfo(selectedDate),
    [selectedDate]
  );

  // Kiểm tra ngày đã qua so với ngày thực tế hôm nay -> không thể đặt vé
  const isPastDate = useMemo(() => {
    const todayIso = dynamicDays.today.dateStr;
    if (!selectedDate || selectedDate === 'Hôm nay' || selectedDate === 'Ngày mai' || selectedDate === 'Ngày kia') {
      return false;
    }
    if (typeof selectedDate === 'string' && selectedDate.startsWith('month-')) {
      const parts = selectedDate.replace('month-', '').split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const now = new Date();
      const curY = now.getFullYear();
      const curM = now.getMonth() + 1;
      return y < curY || (y === curY && m < curM);
    }
    return selectedDate < todayIso;
  }, [selectedDate, dynamicDays]);

  const currentMonth = year + '-' + String(month).padStart(2, '0');
  const currentSchedule = monthSchedule(currentMonth, todayMonth, []);
  const quickBookingMovies = moviesList.filter(movie => releaseMonth(movie) === currentMonth);
  const activeMovie = quickBookingMovies.find(movie => String(movie.id) === String(selectedMovieId)) || quickBookingMovies[0];
  const activeMovieId = activeMovie?.id || activeMovie?._id;
  const activeBadge = getAgeBadgeStyle(activeMovie?.ageRating);
  const dateStr = typeof selectedDate === 'string' && selectedDate.startsWith('month-')
    ? [currentMonth + '-01', cinemaDate(), cinemaDate(activeMovie?.releaseDate)].sort().at(-1) : selectedDay;

  // Phim của tháng hiện tại -> "Đặt vé"
  // Phim của các tháng tương lai -> "Đặt trước vé"
  const isAdvanceBooking = Date.parse(dateStr + 'T00:00:00+07:00') - Date.now() > 7 * 86400000;
  const [schedule, setSchedule] = useState(null);
  const showtimeKey = activeMovieId + '/' + dateStr;
  useEffect(() => {
    if (!activeMovieId || isPastDate) return;
    const request = new AbortController();
    api.get('/movies/' + encodeURIComponent(activeMovieId) + '/schedule', { params: { date: dateStr }, signal: request.signal })
      .then(({ data }) => {
        if (!request.signal.aborted) setSchedule({ key: showtimeKey, slots: data.showtimes ?? [] });
      })
      .catch(() => { if (!request.signal.aborted) setSchedule({ key: showtimeKey, slots: [] }); });
    return () => request.abort();
  }, [showtimeKey, activeMovieId, dateStr, isPastDate]);

  const availableShowtimes = useMemo(() => {
    if (isPastDate || schedule?.key !== showtimeKey) return [];
    const now = Date.now();
    return schedule.slots.filter(slot => {
      const start = Date.parse(slot.startTime);
      return slot.roomId && !slot.isLocked && slot.availableSeats !== 0 && start > now && start - now <= 7 * 86400000;
    }).map(slot => ({
      ...slot,
      time: new Date(slot.startTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }),
    }));
  }, [isPastDate, schedule, showtimeKey]);

  // Đồng bộ suất chiếu: Nếu suất đã chọn không còn trong danh sách thì trả về trống để hiển thị "Chọn suất chiếu"
  useEffect(() => {
    if (selectedShowtimeId) {
      const isCurrentInList = availableShowtimes.some((st) => String(st.id) === String(selectedShowtimeId));
      if (!isCurrentInList) {
        setSelectedShowtimeId('');
      }
    }
  }, [availableShowtimes, selectedShowtimeId, setSelectedShowtimeId]);

  // Suất chiếu đang được chọn hiện tại (null nếu chưa chọn)
  const selectedShowtimeObj = useMemo(() => {
    if (!selectedShowtimeId) return null;
    return availableShowtimes.find((st) => String(st.id) === String(selectedShowtimeId)) || null;
  }, [availableShowtimes, selectedShowtimeId]);

  // Nhóm các suất chiếu theo 3 phòng vật lý (IMAX Laser, Dolby Atmos, Gold Class)
  const showtimesByRoom = useMemo(() => {
    const groups = {
      IMAX: {
        key: 'IMAX',
        badge: 'IMAX® Laser',
        roomName: 'Phòng IMAX Laser',
        badgeStyle: 'bg-gradient-to-r from-[#00d9ff]/25 to-[#00d9ff]/10 border-[#00d9ff]/60 text-[#42DFFF] shadow-[0_0_15px_rgba(0,217,255,0.25)]',
        activeBtnStyle: 'bg-[#00d9ff] text-slate-950 font-black shadow-[0_0_15px_rgba(0,217,255,0.7)] border-[#00d9ff] scale-105',
        idleBtnStyle: 'bg-[#0b162c] hover:bg-[#122448] text-slate-200 border-[#00d9ff]/30 hover:border-[#00d9ff]/70',
        slots: [],
      },
      ATMOS: {
        key: 'ATMOS',
        badge: 'DO Dolby Atmos',
        roomName: 'Phòng Dolby Atmos',
        badgeStyle: 'bg-gradient-to-r from-[#9333ea]/25 to-[#9333ea]/10 border-[#a855f7]/60 text-[#c084fc] shadow-[0_0_15px_rgba(168,85,247,0.25)]',
        activeBtnStyle: 'bg-[#a855f7] text-white font-black shadow-[0_0_15px_rgba(168,85,247,0.7)] border-[#a855f7] scale-105',
        idleBtnStyle: 'bg-[#1b0d30] hover:bg-[#2b164c] text-slate-200 border-[#a855f7]/30 hover:border-[#a855f7]/70',
        slots: [],
      },
      GOLD: {
        key: 'GOLD',
        badge: '👑 Gold Class',
        roomName: 'Phòng Gold Class',
        badgeStyle: 'bg-gradient-to-r from-[#ffd18a]/25 to-[#ffd18a]/10 border-[#ffd18a]/60 text-[#ffd18a] shadow-[0_0_15px_rgba(255,209,138,0.25)]',
        activeBtnStyle: 'bg-[#ffd18a] text-slate-950 font-black shadow-[0_0_15px_rgba(255,209,138,0.7)] border-[#ffd18a] scale-105',
        idleBtnStyle: 'bg-[#22170b] hover:bg-[#382613] text-slate-200 border-[#ffd18a]/30 hover:border-[#ffd18a]/70',
        slots: [],
      },
    };

    availableShowtimes.forEach((st) => {
      const room = (st.roomType || '').toLowerCase();
      if (room.includes('gold')) {
        groups.GOLD.slots.push(st);
      } else if (room.includes('atmos')) {
        groups.ATMOS.slots.push(st);
      } else {
        groups.IMAX.slots.push(st);
      }
    });

    return groups;
  }, [availableShowtimes, activeMovie]);

  // Xử lý khi chọn ngày từ Date Picker:
  // - Nếu ngày cũ trong quá khứ so với hôm nay thì chặn và cảnh báo
  // - Cho phép chọn từ ngày hôm nay trở đi linh hoạt
  const handleDateChangeFromPicker = (val) => {
    if (!val) return;
    // Đổi ngày thì reset suất chiếu về trống để hiển thị "Chọn suất chiếu"
    setSelectedShowtimeId('');
    const todayIso = dynamicDays.today.dateStr;
    if (val < todayIso) {
      alert(`Không thể chọn ngày chiếu trong quá khứ! Vui lòng chọn từ ngày hôm nay (${dynamicDays.today.label}) trở đi.`);
      return;
    }

    if (val === dynamicDays.today.dateStr) {
      setSelectedDate('Hôm nay');
      return;
    }
    if (val === dynamicDays.tomorrow.dateStr) {
      setSelectedDate('Ngày mai');
      return;
    }
    if (val === dynamicDays.dayAfter.dateStr) {
      setSelectedDate('Ngày kia');
      return;
    }

    setSelectedDate(val);
  };

  // Mở Native Date Picker Calendar của trình duyệt
  const handleOpenNativeDatePicker = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  const handleQuickBooking = () => {
    // Nếu là ngày trong quá khứ thì chặn không cho đặt vé
    if (isPastDate) {
      alert('Không thể đặt vé cho ngày chiếu đã qua trong quá khứ!');
      return;
    }

    if (!selectedShowtimeId) {
      setIsShowtimeDropdownOpen(true);
      return;
    }

    const targetShowtimeId = selectedShowtimeId;

    const chosenSlot = availableShowtimes.find(slot => String(slot.id) === String(targetShowtimeId));
    if (!chosenSlot || Date.parse(chosenSlot.startTime) <= Date.now()) {
      setSelectedShowtimeId('');
      return;
    }
    const { roomName, roomType, price, time, roomId, startTime, formatFeature } = chosenSlot;

    const slotInfo = {
      id: targetShowtimeId,
      showtimeId: targetShowtimeId,
      movieId: activeMovie?.id || activeMovie?._id,
      movie: {
        id: activeMovie?.id || activeMovie?._id,
        _id: activeMovie?._id || activeMovie?.id,
        title: activeMovie?.title || 'Phim đang chọn',
        ageRating: activeMovie?.ageRating || 'T18',
        duration: activeMovie?.duration || 120,
        poster: activeMovie?.poster || activeMovie?.posterUrl,
        genre: activeMovie?.genre || 'Điện ảnh cao cấp',
        slug: activeMovie?.slug,
        rating: activeMovie?.rating || null,
        status: activeMovie?.status || 'NOW_SHOWING',
      },
      roomName,
      roomType,
      roomId,
      startTime,
      format: formatFeature || roomType,
      time,
      date: dateStr || dynamicDays.today.dateStr,
      price,
      cinemaName: selectedTheater || "D'AVENOR Thanh Khê Plaza",
    };

    navigate(`/booking/seat/${targetShowtimeId}`, {
      state: { slotInfo },
    });
  };

  return (
    <section className="relative z-30 max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 mt-2 sm:mt-3">
      <div className="bg-[#11152F]/95 backdrop-blur-xl border border-[#AA9BFF]/25 rounded-2xl p-4 shadow-[0_12px_40px_rgba(11,16,38,0.9),0_0_25px_rgba(66,223,255,0.12)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          {/* 1. Chọn Phim */}
          <div className="sm:col-span-1 lg:col-span-3 space-y-1 relative" ref={movieDropdownRef}>
            <div className="flex items-center justify-between h-5">
              <label className="text-[11px] font-medium text-[#BEC5E5] flex items-center space-x-1.5">
                <span className="text-[#42DFFF]">🎬</span>
                <span>Phim</span>
              </label>
              <span className="text-[10px] text-[#BEC5E5]/70 font-medium">
                {currentSchedule.label.replace(' (Hiện tại)', '')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsMovieDropdownOpen(!isMovieDropdownOpen)}
              className={`w-full h-[38px] bg-[#0B1026] hover:bg-[#20204B] border ${isMovieDropdownOpen ? 'border-[#42DFFF] ring-2 ring-[#42DFFF]/20' : 'border-[#AA9BFF]/25'
                } rounded-xl px-2.5 text-xs font-bold text-[#F8F7FF] transition-all text-left flex items-center justify-between gap-1.5 cursor-pointer group shadow-inner`}
            >
              <div className="flex items-center space-x-1.5 min-w-0">
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${activeBadge.bg} ${activeBadge.text} ${activeBadge.border}`}
                >
                  {activeMovie?.ageRating || 'T18'}
                </span>
                <span className="truncate text-[#F8F7FF] group-hover:text-[#83F5FF] transition-colors">
                  {activeMovie?.title || 'Chọn phim'}
                </span>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                {currentSchedule.status === 'ENDED' ? (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#20204B] text-[#BEC5E5] border border-[#AA9BFF]/20">
                    Đã công chiếu
                  </span>
                ) : currentSchedule.status === 'COMING_SOON' ? (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-[#F4A5FF] border border-[#A855F7]/30">
                    Sắp chiếu
                  </span>
                ) : (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-[#42DFFF] border border-[#42DFFF]/30">
                    Đang chiếu
                  </span>
                )}
                <span
                  className={`text-[#BEC5E5] text-[10px] transform transition-transform ${isMovieDropdownOpen ? 'rotate-180 text-[#42DFFF]' : ''
                    }`}
                >
                  ▼
                </span>
              </div>
            </button>

            {/* Floating Dropdown Menu */}
            {isMovieDropdownOpen && (
              <div className="absolute left-0 bottom-full sm:bottom-auto sm:top-full mb-2 sm:mb-0 sm:mt-2 w-[330px] sm:w-[390px] bg-[#11152F]/98 backdrop-blur-2xl border border-[#AA9BFF]/30 rounded-2xl p-2.5 shadow-[0_16px_50px_rgba(11,16,38,0.95),0_0_30px_rgba(168,85,247,0.2)] z-50 animate-in fade-in duration-150">
                <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-[#AA9BFF]/20">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[#42DFFF] text-xs">
                      {currentSchedule.status === 'NOW_SHOWING'
                        ? '🎬'
                        : currentSchedule.status === 'COMING_SOON'
                          ? '🍿'
                          : '🎞️'}
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#F8F7FF]">
                      {currentSchedule.status === 'NOW_SHOWING'
                        ? 'Phim Đang Chiếu Tại Rạp'
                        : currentSchedule.status === 'COMING_SOON'
                          ? 'Phim Sắp Chiếu'
                          : 'Phim Đã Công Chiếu'}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${currentSchedule.badgeColor}`}
                  >
                    {quickBookingMovies.length} phim {currentSchedule.status === 'NOW_SHOWING' ? 'đang chiếu' : currentSchedule.status === 'COMING_SOON' ? 'sắp chiếu' : 'đã chiếu'} ({currentSchedule.label.replace(' (Hiện tại)', '')})
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                  {quickBookingMovies.map((m) => {
                    const isSelected = String(m.id) === String(activeMovieId);
                    const badge = getAgeBadgeStyle(m.ageRating);
                    return (
                      <div
                        key={m.id || m._id || m.slug}
                        onClick={() => {
                          setSelectedMovieId(String(m.id));
                          setSelectedShowtimeId('');
                          setIsMovieDropdownOpen(false);
                        }}
                        className={`flex items-center space-x-3 p-2 rounded-xl cursor-pointer transition-all border ${isSelected
                          ? 'bg-purple-950/60 border-[#42DFFF]/80 shadow-md shadow-cyan-500/10'
                          : 'bg-[#0B1026]/70 hover:bg-[#20204B] border-[#AA9BFF]/15 hover:border-[#AA9BFF]/40'
                          }`}
                      >
                        <img
                          src={m.poster || m.posterUrl}
                          alt={m.title}
                          className="w-11 h-14 object-cover rounded-lg shrink-0 shadow-md border border-[#AA9BFF]/20"
                          onError={(e) => {
                            e.target.src = '/banner-dune.jpg';
                          }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
                              title={m.ageDescription}
                            >
                              {m.ageRating}
                            </span>
                            {m.rating ? (
                              <span className="text-[10px] text-[#83F5FF] font-bold flex items-center">
                                ★ {Number(m.rating).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[9px] text-[#8E95B8] italic">
                                Chưa có đánh giá
                              </span>
                            )}
                            <span className="text-[10px] text-[#BEC5E5]">• {m.duration || 120} phút</span>
                            {m.status === 'ENDED' && (
                              <span className="text-[8px] font-bold text-[#BEC5E5] bg-[#20204B] px-1 py-0.5 rounded border border-[#AA9BFF]/20">
                                Đã công chiếu
                              </span>
                            )}
                          </div>

                          <h5
                            className={`text-xs font-bold truncate ${isSelected ? 'text-[#83F5FF]' : 'text-[#F8F7FF]'
                              }`}
                          >
                            {m.title}
                          </h5>

                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {(Array.isArray(m.formats) ? m.formats : (m.formats ? m.formats.split(/[,•|]+/) : [m.techFormat || '2D']))
                              .slice(0, 3)
                              .map((fmt, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] font-bold bg-[#20204B] text-[#83F5FF] px-1.5 py-0.5 rounded border border-[#42DFFF]/30 uppercase"
                                >
                                  {String(fmt).trim()}
                                </span>
                              ))}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#F4A5FF] to-[#42DFFF] text-[#0B1026] flex items-center justify-center text-[10px] font-black shrink-0 shadow">
                            ✓
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Rạp chiếu (Cố định cụm rạp duy nhất Thanh Khê Plaza) */}
          <div className="sm:col-span-1 lg:col-span-3 space-y-1">
            <div className="flex items-center h-5">
              <label className="text-[11px] font-medium text-[#BEC5E5] flex items-center space-x-1.5">
                <span className="text-[#42DFFF]">📍</span>
                <span>Rạp chiếu</span>
              </label>
            </div>
            {cinemas.length > 1 ? (
              <div className="relative">
                <select
                  value={selectedTheater}
                  onChange={(e) => setSelectedTheater(e.target.value)}
                  className="w-full h-[38px] bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3 text-xs font-bold text-[#F8F7FF] focus:outline-none focus:border-[#42DFFF] appearance-none cursor-pointer pr-7"
                >
                  {cinemas.map((c) => (
                    <option key={c.id || c._id} value={c.name}>
                      {c.district ? `[Q.${c.district}] ` : ''}{c.name}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-2.5 text-[#BEC5E5] text-[10px] pointer-events-none">
                  ⌵
                </span>
              </div>
            ) : (
              <div
                className="w-full h-[38px] bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3 text-xs font-bold text-[#F8F7FF] select-none shadow-sm flex items-center space-x-1.5"
                title="D'AVENOR Thanh Khê Plaza - 295 Điện Biên Phủ, Q. Thanh Khê, Đà Nẵng"
              >
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-purple-900/60 text-[#83F5FF] border border-[#42DFFF]/40 shrink-0">
                  Q. Thanh Khê
                </span>
                <span className="truncate text-[#F8F7FF] font-bold">
                  D'AVENOR Thanh Khê Plaza
                </span>
              </div>
            )}
          </div>

          {/* 3. Chọn Ngày & Lịch Chiếu (Hỗ trợ mở Lịch/Datepicker + chia đều 3 phim theo tháng) */}
          <div className="sm:col-span-1 lg:col-span-2 space-y-1">
            <div className="flex items-center h-5">
              <label className="text-[11px] font-medium text-[#BEC5E5] flex items-center space-x-1.5">
                <span className="text-[#42DFFF]">📅</span>
                <span>Ngày chiếu</span>
              </label>
            </div>

            <div className="relative">
              {/* Native Date Picker đồng bộ linh hoạt từ ngày hôm nay trở đi */}
              <input
                ref={dateInputRef}
                type="date"
                min={dynamicDays.today.dateStr}
                max={`${new Date().getFullYear() + 2}-12-31`}
                value={dateStr}
                onChange={(e) => handleDateChangeFromPicker(e.target.value)}
                className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                tabIndex={-1}
              />

              <select
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedShowtimeId('');
                }}
                className="w-full h-[38px] bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-2.5 text-xs font-bold text-[#F8F7FF] focus:outline-none focus:border-[#42DFFF] appearance-none cursor-pointer pr-12 truncate"
              >
                {/^\d{4}-\d{2}-\d{2}$/.test(selectedDate ?? '') && <option value={selectedDate}>{selectedDate.split('-').reverse().join('/')}</option>}
                <optgroup label=" ── NGÀY GẦN NHẤT ──">
                  <option value="Hôm nay">{dynamicDays.today.label}</option>
                  <option value="Ngày mai">{dynamicDays.tomorrow.label}</option>
                  <option value="Ngày kia">{dynamicDays.dayAfter.label}</option>
                </optgroup>

                <optgroup label="── LỊCH CHIẾU THEO THÁNG ──">
                  {monthlySchedule.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.dropdownLabel}
                    </option>
                  ))}
                </optgroup>
              </select>

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenNativeDatePicker();
                  }}
                  className="p-1 hover:bg-[#20204B] rounded text-[#BEC5E5] hover:text-[#42DFFF] transition-colors cursor-pointer"
                  title="Mở lịch chọn ngày chiếu"
                >
                  <span className="text-xs">📅</span>
                </button>
                <span className="text-[#BEC5E5] text-[10px] pointer-events-none">⌵</span>
              </div>
            </div>
          </div>

          {/* 4. Chọn Suất Chiếu */}
          <div className="sm:col-span-1 lg:col-span-2 space-y-1 relative" ref={showtimeDropdownRef}>
            <div className="flex items-center h-5">
              <label className="text-[11px] font-medium text-[#BEC5E5] flex items-center space-x-1.5">
                <span className="text-[#42DFFF]">🕒</span>
                <span>Suất chiếu</span>
              </label>
            </div>
            <div className="relative">
              {/* Nút Trigger Suất Chiếu: Hiển thị chữ "Chọn suất chiếu" (thế vô chỗ 09:30) */}
              <button
                type="button"
                onClick={() =>
                  !isPastDate &&
                  currentSchedule.status !== 'ENDED' &&
                  setIsShowtimeDropdownOpen(!isShowtimeDropdownOpen)
                }
                disabled={isPastDate || currentSchedule.status === 'ENDED'}
                className={`w-full h-[38px] bg-[#0B1026] border rounded-xl px-3 text-xs font-bold flex items-center justify-between transition-all cursor-pointer truncate ${
                  isShowtimeDropdownOpen
                    ? 'border-[#42DFFF] shadow-[0_0_12px_rgba(66,223,255,0.3)] text-white'
                    : 'border-[#AA9BFF]/25 hover:border-[#42DFFF]/60 text-[#F8F7FF]'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span className="truncate">
                  {isPastDate ? (
                    <span className="text-slate-400">Đã kết thúc suất chiếu</span>
                  ) : selectedShowtimeId && selectedShowtimeObj ? (
                    <span className="flex items-center space-x-1 truncate">
                      <strong className="text-[#42DFFF] font-black">{selectedShowtimeObj.time}</strong>
                      <span className="text-slate-200 font-semibold">- {selectedShowtimeObj.roomName}</span>
                    </span>
                  ) : selectedShowtimeId ? (
                    <span className="flex items-center space-x-1 truncate">
                      <strong className="text-[#42DFFF] font-black">{selectedShowtimeId}</strong>
                    </span>
                  ) : (
                    <span className="text-[#CBD5E1] font-semibold tracking-wide">Chọn suất chiếu</span>
                  )}
                </span>
                <span
                  className={`text-[#BEC5E5] text-[10px] transform transition-transform ml-1.5 ${
                    isShowtimeDropdownOpen ? 'rotate-180 text-[#42DFFF]' : ''
                  }`}
                >
                  ▼
                </span>
              </button>

              {/* FLOATING POPOVER: GIỮ NGUYÊN DUY NHẤT 3 HÀNG PHÒNG VÀ GIỜ CHIẾU PHÍA DƯỚI (XÓA BỎ TOÀN BỘ HEADER RƯỜM RÀ) */}
              {isShowtimeDropdownOpen && (
                <div className="absolute right-0 bottom-full sm:bottom-auto sm:top-full mb-2 sm:mb-0 sm:mt-2 w-[340px] sm:w-[580px] md:w-[680px] max-w-[95vw] bg-[#090D22]/98 backdrop-blur-2xl border border-[#42DFFF]/40 rounded-2xl p-3 sm:p-3.5 shadow-[0_20px_60px_rgba(5,8,20,0.98),0_0_35px_rgba(66,223,255,0.25)] z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="space-y-2.5">
                    {!availableShowtimes.length && <p className="p-2 text-sm text-[#BEC5E5]">
                      {schedule?.key !== showtimeKey && activeMovieId ? 'Đang tải suất chiếu…' : 'Hiện chưa có lịch chiếu. Vui lòng quay lại sau.'}
                    </p>}
                    {Object.values(showtimesByRoom).filter(group => group.slots.length).map((grp) => (
                      <div
                        key={grp.key}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 rounded-2xl bg-[#0e142e]/60 border border-white/5 hover:border-white/15 transition-all"
                      >
                        {/* Cột trái: Badge Phòng chiếu */}
                        <div
                          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center shrink-0 w-full sm:w-[130px] border shadow-sm ${grp.badgeStyle}`}
                        >
                          <span>{grp.badge}</span>
                        </div>

                        {/* Cột phải: Dãy nút giờ chiếu nằm ngang */}
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          {grp.slots.map((st) => {
                            const isSelected = String(st.id) === String(selectedShowtimeId);
                            return (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  setSelectedShowtimeId(String(st.id));
                                  setIsShowtimeDropdownOpen(false);
                                }}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                  isSelected ? grp.activeBtnStyle : grp.idleBtnStyle
                                }`}
                              >
                                {st.time}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5. Nút Đặt Vé Ngay */}
          <div className="sm:col-span-2 lg:col-span-2">
            {isPastDate ? (
              <button
                type="button"
                disabled
                className="w-full h-[38px] bg-[#20204B] text-[#BEC5E5]/50 border border-[#AA9BFF]/15 font-bold px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 cursor-not-allowed opacity-60 shadow"
                title="Ngày chiếu trong quá khứ - Không thể đặt vé"
              >
                <span>⛔</span>
                <span>Ngày chiếu đã qua</span>
              </button>
            ) : isAdvanceBooking ? (
              <button
                type="button"
                disabled={!activeMovieId}
                onClick={() => navigate('/movie/' + activeMovieId + '?date=' + dateStr)}
                className="w-full h-[38px] cinema-action font-black px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)] hover:brightness-108 cursor-pointer"
                title="Xem lịch chiếu"
              >
                <span>🎫</span>
                <span>Xem lịch chiếu</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickBooking}
                className="w-full h-[38px] cinema-action font-black px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)] hover:brightness-108 cursor-pointer"
                title="Đặt vé xem phim"
              >
                <span>🎟️</span>
                <span>Đặt vé</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeQuickBooking;
