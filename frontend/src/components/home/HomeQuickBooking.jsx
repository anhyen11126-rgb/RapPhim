import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

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
export const generateDynamicMonthlySchedule = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 - 12

  const movieSlices = [
    {
      status: 'NOW_SHOWING',
      statusLabel: 'Đang công chiếu tại rạp',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      shortNames: 'Dune 2, Mai, Deadpool',
      slugs: ['dune-hanh-tinh-cat-phan-2', 'mai', 'deadpool-and-wolverine'],
    },
    {
      status: 'COMING_SOON',
      statusLabel: 'Sắp chiếu',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      shortNames: 'Moana 2, Mufasa, Venom',
      slugs: ['moana-2', 'mufasa-the-lion-king', 'venom-the-last-dance'],
    },
    {
      status: 'COMING_SOON',
      statusLabel: 'Sắp chiếu',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      shortNames: 'Cô Dâu, Transformers, Inside Out',
      slugs: ['co-dau-hao-mon', 'transformers-one', 'inside-out-2'],
    },
    {
      status: 'COMING_SOON',
      statusLabel: 'Sắp chiếu',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      shortNames: 'Cap 4, Joker 2, Panda 4',
      slugs: ['captain-america-brave-new-world', 'joker-folie-a-deux', 'kung-fu-panda-4'],
    },
    {
      status: 'COMING_SOON',
      statusLabel: 'Sắp chiếu',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      shortNames: 'Quật Mộ, Lật Mặt, Godzilla',
      slugs: ['quat-mo-trung-ma', 'lat-mat-7-mot-dieu-uoc', 'godzilla-x-kong-de-che-moi'],
    },
    {
      status: 'COMING_SOON',
      statusLabel: 'Sắp chiếu',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      shortNames: 'Oppenheimer, Spider-Man, Avatar',
      slugs: ['oppenheimer', 'spider-man-no-way-home', 'avatar-the-way-of-water'],
    },
  ];

  return movieSlices.map((slice, idx) => {
    const targetDate = new Date(currentYear, currentMonth - 1 + idx, 1);
    const m = targetDate.getMonth() + 1;
    const y = targetDate.getFullYear();
    const mStr = String(m).padStart(2, '0');
    const isCurrent = idx === 0;

    return {
      month: m,
      year: y,
      code: `month-${y}-${mStr}`,
      label: `Tháng ${mStr}/${y}${isCurrent ? ' (Hiện tại)' : ''}`,
      dropdownLabel: `Tháng ${mStr}/${y} (${isCurrent ? 'Đang chiếu' : 'Sắp chiếu'}: ${slice.shortNames})`,
      defaultDate: isCurrent ? getIsoDateString(now) : `${y}-${mStr}-15`,
      status: slice.status,
      statusLabel: slice.statusLabel,
      badgeColor: slice.badgeColor,
      slugs: slice.slugs,
    };
  });
};

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

// Tính toán chính xác khung giờ chiếu dựa trên thời lượng phim và khoảng nghỉ dọn dẹp (30-45 phút)
// Chỉ gồm đúng 3 phòng: Phòng IMAX Laser, Phòng Dolby Atmos, Phòng Gold Class
const getCleanShowtimesForMovie = (movie) => {
  const duration = movie?.duration || 120;
  const slug = movie?.slug || '';
  const movieId = movie?.id || 'm';

  // Suất giờ vàng tối là 19:30
  // Tính giờ suất tiếp theo sau khi hết phim + 30-45 phút dọn dẹp
  let lateHour = 22;
  let lateMinute = 15;

  if (slug === 'dune-hanh-tinh-cat-phan-2' || duration >= 160) {
    // 166 phút -> 19:30 chiếu đến 22:16 + 34p dọn dẹp = 22:50
    lateHour = 22;
    lateMinute = 50;
  } else if (slug === 'mai' || (duration >= 130 && duration < 140)) {
    // 131 phút -> 19:30 chiếu đến 21:41 + 39p dọn dẹp = 22:20
    lateHour = 22;
    lateMinute = 20;
  } else if (slug === 'deadpool-and-wolverine' || (duration >= 120 && duration < 130)) {
    // 128 phút -> 19:30 chiếu đến 21:38 + 37p dọn dẹp = 22:15
    lateHour = 22;
    lateMinute = 15;
  } else {
    const endMinutes = 19 * 60 + 30 + duration;
    const nextSlotMinutes = endMinutes + 35;
    lateHour = Math.floor(nextSlotMinutes / 60) % 24;
    lateMinute = Math.round((nextSlotMinutes % 60) / 5) * 5;
  }

  const lateTimeStr = `${String(lateHour).padStart(2, '0')}:${String(lateMinute).padStart(2, '0')}`;

  return [
    // 1. Phòng IMAX Laser: 09:30, 12:30, 15:30, 18:30, 21:30
    {
      id: `${movieId}-0930-imax`,
      time: '09:30',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 130000,
    },
    {
      id: `${movieId}-1230-imax`,
      time: '12:30',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 140000,
    },
    {
      id: `${movieId}-1530-imax`,
      time: '15:30',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 140000,
    },
    {
      id: `${movieId}-1830-imax`,
      time: '18:30',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 150000,
    },
    {
      id: `${movieId}-2130-imax`,
      time: '21:30',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 150000,
    },

    // 2. Phòng Dolby Atmos: 09:30, 12:30, 15:30, 18:30, 21:30
    {
      id: `${movieId}-0930-atmos`,
      time: '09:30',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 100000,
    },
    {
      id: `${movieId}-1230-atmos`,
      time: '12:30',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 110000,
    },
    {
      id: `${movieId}-1530-atmos`,
      time: '15:30',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 110000,
    },
    {
      id: `${movieId}-1830-atmos`,
      time: '18:30',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 120000,
    },
    {
      id: `${movieId}-2130-atmos`,
      time: '21:30',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 120000,
    },

    // 3. Phòng Gold Class: 10:00, 13:00, 16:00, 19:00, 22:00
    {
      id: `${movieId}-1000-gold`,
      time: '10:00',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 170000,
    },
    {
      id: `${movieId}-1300-gold`,
      time: '13:00',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 180000,
    },
    {
      id: `${movieId}-1600-gold`,
      time: '16:00',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 180000,
    },
    {
      id: `${movieId}-1900-gold`,
      time: '19:00',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 190000,
    },
    {
      id: `${movieId}-2200-gold`,
      time: '22:00',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 190000,
    },
  ];
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
  const monthlySchedule = useMemo(() => generateDynamicMonthlySchedule(), []);

  // Xác định lịch tháng tương ứng với ngày chiếu đang được chọn
  const { month, year, dateStr, isPast } = useMemo(
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

  const currentSchedule = useMemo(() => {
    const matched =
      monthlySchedule.find((s) => s.month === month && s.year === year) ||
      monthlySchedule.find((s) => s.status === 'NOW_SHOWING') ||
      monthlySchedule[0];

    // Nếu người dùng chọn ngày/tháng trong quá khứ so với thời điểm hiện tại
    if (isPast || isPastDate) {
      return {
        ...matched,
        status: 'ENDED',
        statusLabel: 'Phim đã công chiếu',
        badgeColor: 'text-slate-300 bg-slate-700/60 border-slate-600/40',
      };
    }
    return matched;
  }, [month, year, isPast, isPastDate, monthlySchedule]);

  // Lọc chính xác 3 bộ phim tương ứng với tháng đó
  const quickBookingMovies = useMemo(() => {
    if (!moviesList || moviesList.length === 0) return [];
    const matched = currentSchedule.slugs
      .map((slug) => moviesList.find((m) => m.slug === slug))
      .filter(Boolean);

    if (matched.length > 0) return matched;

    // Fallback nếu chưa tải đủ dữ liệu
    const fallback = moviesList.filter((m) => m.status === currentSchedule.status);
    return fallback.length > 0 ? fallback.slice(0, 3) : moviesList.slice(0, 3);
  }, [moviesList, currentSchedule]);

  // Tự động chọn phim đầu tiên trong tháng khi chuyển sang tháng/ngày mới
  useEffect(() => {
    if (quickBookingMovies.length > 0) {
      const isCurrentInList = quickBookingMovies.some((m) => String(m.id) === String(selectedMovieId));
      if (!isCurrentInList) {
        setSelectedMovieId(String(quickBookingMovies[0].id));
      }
    }
  }, [quickBookingMovies, selectedMovieId, setSelectedMovieId]);

  const activeMovie =
    quickBookingMovies.find((m) => String(m.id) === String(selectedMovieId)) ||
    quickBookingMovies[0];
  const activeBadge = getAgeBadgeStyle(activeMovie?.ageRating);

  // Phim của tháng hiện tại -> "Đặt vé"
  // Phim của các tháng tương lai -> "Đặt trước vé"
  const isAdvanceBooking = useMemo(() => {
    if (activeMovie?.status === 'COMING_SOON') return true;
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    if (year > curY || (year === curY && month > curM)) return true;
    if (currentSchedule?.status === 'COMING_SOON') return true;
    return false;
  }, [activeMovie?.status, year, month, currentSchedule?.status]);

  // Cấu hình suất chiếu thích ứng: Chỉ gồm 3 phòng (IMAX Laser, Dolby Atmos, Gold Class)
  // và tuân thủ chặt chẽ thời lượng phim + thời gian dọn dẹp (30-45 phút)
  const availableShowtimes = useMemo(() => {
    if (isPastDate || currentSchedule.status === 'ENDED') {
      return [
        {
          id: 'ended-status',
          roomName: 'Đã hoàn thành đợt chiếu rạp',
          format: 'Lịch sử chiếu',
          time: 'Đã kết thúc',
        },
      ];
    }

    if (activeMovie?.showtimes && activeMovie.showtimes.length > 0) {
      // Chỉ chấp nhận đúng 3 phòng theo yêu cầu
      const validKeywords = ['IMAX', 'Atmos', 'Gold'];
      const filtered = activeMovie.showtimes.filter((st) =>
        validKeywords.some((kw) => (st.roomName || '').includes(kw))
      );

      // Chuẩn hóa tên phòng hiển thị cho đồng bộ: Phòng IMAX Laser, Phòng Dolby Atmos, Phòng Gold Class
      const standardized = filtered.map((st) => {
        let cleanRoom = 'Phòng IMAX Laser';
        if ((st.roomName || '').includes('Atmos')) cleanRoom = 'Phòng Dolby Atmos';
        if ((st.roomName || '').includes('Gold')) cleanRoom = 'Phòng Gold Class';
        return {
          ...st,
          roomName: cleanRoom,
        };
      });

      // Lọc theo ngày hiện tại hoặc deduplicate theo cặp [time + roomName]
      const onDay = standardized.filter((st) => !st.date || st.date === dateStr);
      const candidates = onDay.length > 0 ? onDay : standardized;

      const seen = new Set();
      const uniqueSlots = [];
      for (const st of candidates) {
        const key = `${st.time}_${st.roomName}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSlots.push(st);
        }
      }

      // Sắp xếp theo trình tự thời gian tự nhiên: Ca sáng (09:xx, 10:xx) -> Ca chiều (14:xx, 16:xx) -> Giờ vàng (19:30) -> Ca khuya (22:xx)
      uniqueSlots.sort((a, b) => {
        const getPriority = (t) => {
          if (t && (t.startsWith('08:') || t.startsWith('09:'))) return 1;
          if (t && (t.startsWith('10:') || t.startsWith('11:'))) return 2;
          if (t && (t.startsWith('13:') || t.startsWith('14:'))) return 3;
          if (t && (t.startsWith('15:') || t.startsWith('16:') || t.startsWith('17:'))) return 4;
          if (t === '19:30') return 5;
          if (t && t.startsWith('22:')) return 6;
          return 7;
        };
        const pA = getPriority(a.time);
        const pB = getPriority(b.time);
        if (pA !== pB) return pA - pB;

        if (a.time !== b.time) return (a.time || '').localeCompare(b.time || '');

        const roomOrder = ['IMAX', 'Atmos', 'Gold'];
        const rA = roomOrder.findIndex((ro) => (a.roomName || '').includes(ro));
        const rB = roomOrder.findIndex((ro) => (b.roomName || '').includes(ro));
        return (rA === -1 ? 99 : rA) - (rB === -1 ? 99 : rB);
      });

      // Giữ các suất Sáng (08:xx-11:xx), Chiều (13:xx-17:xx), Giờ vàng 19:30 và ca khuya (22:xx) cho 3 phòng
      const primeSlots = uniqueSlots.filter(
        (st) =>
          (st.time && (st.time.startsWith('08:') || st.time.startsWith('09:') || st.time.startsWith('10:') || st.time.startsWith('11:'))) ||
          (st.time && (st.time.startsWith('13:') || st.time.startsWith('14:') || st.time.startsWith('15:') || st.time.startsWith('16:') || st.time.startsWith('17:'))) ||
          st.time === '19:30' ||
          (st.time && st.time.startsWith('22:'))
      );

      if (primeSlots.length > 0) {
        return primeSlots;
      }

      if (uniqueSlots.length > 0) {
        return uniqueSlots;
      }
    }

    // Fallback chuẩn theo thời lượng phim và thời gian dọn dẹp (Sáng, Chiều, Tối 19:30 và Khuya 22:xx)
    return getCleanShowtimesForMovie(activeMovie);
  }, [isPastDate, currentSchedule.status, activeMovie, dateStr]);

  // Đồng bộ suất chiếu: Nếu suất đã chọn không còn trong danh sách thì trả về trống để hiển thị "Chọn suất chiếu"
  useEffect(() => {
    if (availableShowtimes.length > 0 && selectedShowtimeId) {
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
    const movieId = activeMovie?.id || activeMovie?._id || 'dune-2';
    const defaultSlots = {
      IMAX: [
        { id: `${movieId}-0930-imax`, time: '09:30', roomName: 'Phòng IMAX Laser' },
        { id: `${movieId}-1230-imax`, time: '12:30', roomName: 'Phòng IMAX Laser' },
        { id: `${movieId}-1530-imax`, time: '15:30', roomName: 'Phòng IMAX Laser' },
        { id: `${movieId}-1830-imax`, time: '18:30', roomName: 'Phòng IMAX Laser' },
        { id: `${movieId}-2130-imax`, time: '21:30', roomName: 'Phòng IMAX Laser' },
      ],
      ATMOS: [
        { id: `${movieId}-0930-atmos`, time: '09:30', roomName: 'Phòng Dolby Atmos' },
        { id: `${movieId}-1230-atmos`, time: '12:30', roomName: 'Phòng Dolby Atmos' },
        { id: `${movieId}-1530-atmos`, time: '15:30', roomName: 'Phòng Dolby Atmos' },
        { id: `${movieId}-1830-atmos`, time: '18:30', roomName: 'Phòng Dolby Atmos' },
        { id: `${movieId}-2130-atmos`, time: '21:30', roomName: 'Phòng Dolby Atmos' },
      ],
      GOLD: [
        { id: `${movieId}-1000-gold`, time: '10:00', roomName: 'Phòng Gold Class' },
        { id: `${movieId}-1300-gold`, time: '13:00', roomName: 'Phòng Gold Class' },
        { id: `${movieId}-1600-gold`, time: '16:00', roomName: 'Phòng Gold Class' },
        { id: `${movieId}-1900-gold`, time: '19:00', roomName: 'Phòng Gold Class' },
        { id: `${movieId}-2200-gold`, time: '22:00', roomName: 'Phòng Gold Class' },
      ],
    };

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
      const room = (st.roomName || '').toLowerCase();
      if (room.includes('gold')) {
        groups.GOLD.slots.push(st);
      } else if (room.includes('atmos')) {
        groups.ATMOS.slots.push(st);
      } else {
        groups.IMAX.slots.push(st);
      }
    });

    ['IMAX', 'ATMOS', 'GOLD'].forEach((k) => {
      if (groups[k].slots.length === 0) {
        groups[k].slots = defaultSlots[k];
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

    const matchedMonth = monthlySchedule.find((s) => val.startsWith(`${s.year}-${String(s.month).padStart(2, '0')}`));
    if (matchedMonth) {
      setSelectedDate(matchedMonth.code);
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

    const chosenSlot =
      availableShowtimes.find((st) => String(st.id) === String(targetShowtimeId)) ||
      availableShowtimes[0];

    const cleanRoomName = chosenSlot?.roomName || 'Phòng IMAX Laser';
    const roomType = cleanRoomName.toLowerCase().includes('atmos')
      ? 'ATMOS'
      : cleanRoomName.toLowerCase().includes('gold')
      ? 'GOLD'
      : 'IMAX';

    const format =
      chosenSlot?.format ||
      (roomType === 'GOLD'
        ? 'Gold Class Luxury'
        : roomType === 'ATMOS'
        ? '2D Dolby Atmos'
        : 'IMAX Laser 2D');

    const time = chosenSlot?.time || '19:30';
    const price =
      chosenSlot?.price ||
      (roomType === 'GOLD' ? 190000 : roomType === 'ATMOS' ? 120000 : 150000);

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
        rating: activeMovie?.rating || '4.8',
        status: activeMovie?.status || 'NOW_SHOWING',
      },
      roomName: cleanRoomName,
      roomType, // 'IMAX' | 'ATMOS' | 'GOLD'
      format,
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
                    3 phim {currentSchedule.status === 'NOW_SHOWING' ? 'đang chiếu' : currentSchedule.status === 'COMING_SOON' ? 'sắp chiếu' : 'đã chiếu'} ({currentSchedule.label.replace(' (Hiện tại)', '')})
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                  {quickBookingMovies.map((m) => {
                    const isSelected = String(m.id) === String(selectedMovieId);
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
                            <span className="text-[10px] text-[#83F5FF] font-bold flex items-center">
                              ★ {m.rating || '4.8'}
                            </span>
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
                            {['IMAX LASER', 'ATMOS', 'GOLD CLASS'].map((fmt, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] font-bold bg-[#20204B] text-[#83F5FF] px-1.5 py-0.5 rounded border border-[#42DFFF]/30"
                              >
                                {fmt}
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
                <optgroup label="── NGÀY GẦN NHẤT ──">
                  <option value="Hôm nay">{dynamicDays.today.label}</option>
                  <option value="Ngày mai">{dynamicDays.tomorrow.label}</option>
                  <option value="Ngày kia">{dynamicDays.dayAfter.label}</option>
                </optgroup>

                <optgroup label="── LỊCH CHIẾU THEO THÁNG (3 PHIM/THÁNG) ──">
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
                    {Object.values(showtimesByRoom).map((grp) => (
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
                onClick={handleQuickBooking}
                className="w-full h-[38px] bg-gradient-to-r from-[#F9B8FF] via-[#D99BFF] via-[#86DEFF] to-[#B4F7FF] text-[#0B1026] font-black px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)] hover:brightness-108 cursor-pointer"
                title="Đặt trước vé xem phim"
              >
                <span>🎫</span>
                <span>Đặt trước vé</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickBooking}
                className="w-full h-[38px] bg-gradient-to-r from-[#F9B8FF] via-[#D99BFF] via-[#86DEFF] to-[#B4F7FF] text-[#0B1026] font-black px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)] hover:brightness-108 cursor-pointer"
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
