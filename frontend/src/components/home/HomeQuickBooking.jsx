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

// Phân bố chuẩn 18 bộ phim theo 6 tháng (mỗi tháng đúng 3 bộ phim)
// Tháng 11/2026 (Đang chiếu), Tháng 12/2026 và các tháng năm 2027 (T1, T2, T3, T4/2027) là Sắp chiếu
const MONTHLY_SCHEDULE = [
  {
    month: 11,
    year: 2026,
    code: 'month-2026-11',
    label: 'Tháng 11/2026 (Hiện tại)',
    defaultDate: '2026-11-21',
    status: 'NOW_SHOWING',
    statusLabel: 'Đang công chiếu tại rạp',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    slugs: ['dune-hanh-tinh-cat-phan-2', 'mai', 'deadpool-and-wolverine'],
  },
  {
    month: 12,
    year: 2026,
    code: 'month-2026-12',
    label: 'Tháng 12/2026',
    defaultDate: '2026-12-15',
    status: 'COMING_SOON',
    statusLabel: 'Sắp chiếu',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    slugs: ['moana-2', 'mufasa-the-lion-king', 'venom-the-last-dance'],
  },
  {
    month: 1,
    year: 2027,
    code: 'month-2027-01',
    label: 'Tháng 01/2027',
    defaultDate: '2027-01-15',
    status: 'COMING_SOON',
    statusLabel: 'Sắp chiếu',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    slugs: ['co-dau-hao-mon', 'transformers-one', 'inside-out-2'],
  },
  {
    month: 2,
    year: 2027,
    code: 'month-2027-02',
    label: 'Tháng 02/2027',
    defaultDate: '2027-02-15',
    status: 'COMING_SOON',
    statusLabel: 'Sắp chiếu',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    slugs: ['captain-america-brave-new-world', 'joker-folie-a-deux', 'kung-fu-panda-4'],
  },
  {
    month: 3,
    year: 2027,
    code: 'month-2027-03',
    label: 'Tháng 03/2027',
    defaultDate: '2027-03-15',
    status: 'COMING_SOON',
    statusLabel: 'Sắp chiếu',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    slugs: ['quat-mo-trung-ma', 'lat-mat-7-mot-dieu-uoc', 'godzilla-x-kong-de-che-moi'],
  },
  {
    month: 4,
    year: 2027,
    code: 'month-2027-04',
    label: 'Tháng 04/2027',
    defaultDate: '2027-04-15',
    status: 'COMING_SOON',
    statusLabel: 'Sắp chiếu',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    slugs: ['oppenheimer', 'spider-man-no-way-home', 'avatar-the-way-of-water'],
  },
];

// Hàm bóc tách tháng/năm từ lựa chọn Ngày chiếu
const parseSelectedDateInfo = (val) => {
  if (!val || val === 'Hôm nay' || val === 'Ngày mai' || val === 'Ngày kia') {
    return { month: 11, year: 2026, dateStr: '2026-11-21', isPast: false };
  }
  if (typeof val === 'string' && val.startsWith('month-')) {
    const parts = val.replace('month-', '').split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const isPast = y < 2026 || (y === 2026 && m < 11);
    return { month: m, year: y, dateStr: `${parts[0]}-${parts[1].padStart(2, '0')}-15`, isPast };
  }
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const isPast = y < 2026 || (y === 2026 && m < 11);
    return { month: m, year: y, dateStr: val, isPast };
  }
  return { month: 11, year: 2026, dateStr: '2026-11-21', isPast: false };
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
    // Suất chiếu buổi sáng (09:30 & 10:30)
    {
      id: `${movieId}-0930-imax`,
      time: '09:30',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 130000,
    },
    {
      id: `${movieId}-0930-atmos`,
      time: '09:30',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 100000,
    },
    {
      id: `${movieId}-0930-gold`,
      time: '09:30',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 170000,
    },
    {
      id: `${movieId}-1030-imax`,
      time: '10:30',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 130000,
    },
    {
      id: `${movieId}-1030-atmos`,
      time: '10:30',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 100000,
    },
    {
      id: `${movieId}-1030-gold`,
      time: '10:30',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 170000,
    },
    // Suất chiếu buổi chiều (14:00 & 16:30)
    {
      id: `${movieId}-1400-imax`,
      time: '14:00',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 140000,
    },
    {
      id: `${movieId}-1400-atmos`,
      time: '14:00',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 110000,
    },
    {
      id: `${movieId}-1400-gold`,
      time: '14:00',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 180000,
    },
    {
      id: `${movieId}-1630-imax`,
      time: '16:30',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 140000,
    },
    {
      id: `${movieId}-1630-atmos`,
      time: '16:30',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 110000,
    },
    {
      id: `${movieId}-1630-gold`,
      time: '16:30',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 180000,
    },
    // Suất chiếu giờ vàng tối 19:30
    {
      id: `${movieId}-1930-imax`,
      time: '19:30',
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 150000,
    },
    {
      id: `${movieId}-1930-atmos`,
      time: '19:30',
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 120000,
    },
    {
      id: `${movieId}-1930-gold`,
      time: '19:30',
      roomName: 'Phòng Gold Class',
      format: 'Gold Class Luxury',
      price: 190000,
    },
    // Suất chiếu ca khuya
    {
      id: `${movieId}-${lateTimeStr}-imax`,
      time: lateTimeStr,
      roomName: 'Phòng IMAX Laser',
      format: 'IMAX Laser 2D',
      price: 150000,
    },
    {
      id: `${movieId}-${lateTimeStr}-atmos`,
      time: lateTimeStr,
      roomName: 'Phòng Dolby Atmos',
      format: '2D Dolby Atmos',
      price: 120000,
    },
    {
      id: `${movieId}-${lateTimeStr}-gold`,
      time: lateTimeStr,
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
  const dateInputRef = useRef(null);

  // Đóng dropdown phim khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (movieDropdownRef.current && !movieDropdownRef.current.contains(event.target)) {
        setIsMovieDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Xác định lịch tháng tương ứng với ngày chiếu đang được chọn
  const { month, year, dateStr, isPast } = useMemo(
    () => parseSelectedDateInfo(selectedDate),
    [selectedDate]
  );

  // Kiểm tra ngày đã qua (trước ngày 21/11/2026) -> không thể đặt vé
  const isPastDate = useMemo(() => {
    if (!selectedDate || selectedDate === 'Hôm nay' || selectedDate === 'Ngày mai' || selectedDate === 'Ngày kia') {
      return false;
    }
    if (typeof selectedDate === 'string' && selectedDate.startsWith('month-')) {
      const parts = selectedDate.replace('month-', '').split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return y < 2026 || (y === 2026 && m < 11);
    }
    return selectedDate < '2026-11-21';
  }, [selectedDate]);

  // Kiểm tra xem có phải là ngày tương lai từ ngày 22/11/2026 trở đi (Đặt vé trước bình thường)
  const isAdvanceBooking = useMemo(() => {
    if (selectedDate === 'Ngày mai' || selectedDate === 'Ngày kia') return true;
    if (typeof selectedDate === 'string' && selectedDate.startsWith('month-')) {
      return selectedDate !== 'month-2026-11';
    }
    if (selectedDate > '2026-11-21') return true;
    return false;
  }, [selectedDate]);

  const currentSchedule = useMemo(() => {
    const matched =
      MONTHLY_SCHEDULE.find((s) => s.month === month && s.year === year) ||
      MONTHLY_SCHEDULE.find((s) => s.status === 'NOW_SHOWING') ||
      MONTHLY_SCHEDULE[0];

    // Nếu người dùng chọn ngày/tháng trong quá khứ (trước tháng 11/2026)
    if (isPast || isPastDate) {
      return {
        ...matched,
        status: 'ENDED',
        statusLabel: 'Phim đã công chiếu',
        badgeColor: 'text-slate-300 bg-slate-700/60 border-slate-600/40',
      };
    }
    return matched;
  }, [month, year, isPast, isPastDate]);

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
        if (quickBookingMovies[0].showtimes && quickBookingMovies[0].showtimes.length > 0) {
          setSelectedShowtimeId(String(quickBookingMovies[0].showtimes[0].id));
        }
      }
    }
  }, [quickBookingMovies, selectedMovieId, setSelectedMovieId, setSelectedShowtimeId]);

  const activeMovie =
    quickBookingMovies.find((m) => String(m.id) === String(selectedMovieId)) ||
    quickBookingMovies[0];
  const activeBadge = getAgeBadgeStyle(activeMovie?.ageRating);

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

  // Đồng bộ suất chiếu khi danh sách thay đổi
  useEffect(() => {
    if (availableShowtimes.length > 0) {
      const isCurrentInList = availableShowtimes.some((st) => String(st.id) === String(selectedShowtimeId));
      if (!isCurrentInList) {
        setSelectedShowtimeId(String(availableShowtimes[0].id));
      }
    }
  }, [availableShowtimes, selectedShowtimeId, setSelectedShowtimeId]);

  // Xử lý khi chọn ngày từ Date Picker:
  // - Nếu ngày cũ trước 21/11 (như 20/11) thì bị chặn / bôi đen
  // - Nếu từ ngày 21/11, 22/11 trở đi thì vẫn chọn coi lịch phim bình thường
  const handleDateChangeFromPicker = (val) => {
    if (!val) return;
    if (val < '2026-11-21') {
      alert('Không thể chọn ngày chiếu trong quá khứ! Vui lòng chọn từ ngày 21/11/2026 trở đi.');
      return;
    }

    if (val === '2026-11-21') {
      setSelectedDate('Hôm nay');
      return;
    }
    if (val === '2026-11-22') {
      setSelectedDate('Ngày mai');
      return;
    }
    if (val === '2026-11-23') {
      setSelectedDate('Ngày kia');
      return;
    }

    if (val.startsWith('2026-11')) {
      setSelectedDate('month-2026-11');
      return;
    }
    if (val.startsWith('2026-12')) {
      setSelectedDate('month-2026-12');
      return;
    }
    if (val.startsWith('2027-01')) {
      setSelectedDate('month-2027-01');
      return;
    }
    if (val.startsWith('2027-02')) {
      setSelectedDate('month-2027-02');
      return;
    }
    if (val.startsWith('2027-03')) {
      setSelectedDate('month-2027-03');
      return;
    }
    if (val.startsWith('2027-04')) {
      setSelectedDate('month-2027-04');
      return;
    }
    setSelectedDate('month-2026-11');
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

    const targetShowtimeId =
      selectedShowtimeId ||
      activeMovie?.firstShowtimeId ||
      availableShowtimes[0]?.id ||
      '6aecb21dd70710fc53a15c06';

    const chosenSlot =
      availableShowtimes.find((st) => String(st.id) === String(targetShowtimeId)) ||
      availableShowtimes[0];

    navigate(`/booking/seat/${targetShowtimeId}`, {
      state: {
        slotInfo: {
          id: targetShowtimeId,
          showtimeId: targetShowtimeId,
          roomName: chosenSlot?.roomName || 'Phòng VIP Recliner 06',
          format: chosenSlot?.format || 'IMAX Laser 2D',
          time: chosenSlot?.time || '19:30',
          price: chosenSlot?.price || 95000,
          cinemaName: selectedTheater || "D'AVENOR Thanh Khê Plaza",
        },
      },
    });
  };

  return (
    <section className="relative z-30 max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 mt-2 sm:mt-3">
      <div className="bg-[#101521] border border-slate-800/90 rounded-2xl p-4 shadow-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          {/* 1. Chọn Phim */}
          <div className="sm:col-span-1 lg:col-span-3 space-y-1 relative" ref={movieDropdownRef}>
            <div className="flex items-center justify-between h-5">
              <label className="text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                <span>🎬</span>
                <span>Phim</span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                {currentSchedule.label.replace(' (Hiện tại)', '')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsMovieDropdownOpen(!isMovieDropdownOpen)}
              className={`w-full h-[38px] bg-[#1b2232] hover:bg-[#232c40] border ${
                isMovieDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700/60'
              } rounded-xl px-2.5 text-xs font-bold text-white transition-all text-left flex items-center justify-between gap-1.5 cursor-pointer group shadow-inner`}
            >
              <div className="flex items-center space-x-1.5 min-w-0">
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${activeBadge.bg} ${activeBadge.text} ${activeBadge.border}`}
                >
                  {activeMovie?.ageRating || 'T18'}
                </span>
                <span className="truncate text-slate-100 group-hover:text-blue-300 transition-colors">
                  {activeMovie?.title || 'Chọn phim'}
                </span>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                {currentSchedule.status === 'ENDED' ? (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Đã công chiếu
                  </span>
                ) : currentSchedule.status === 'COMING_SOON' ? (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    Sắp chiếu
                  </span>
                ) : (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Đang chiếu
                  </span>
                )}
                <span
                  className={`text-slate-400 text-[10px] transform transition-transform ${
                    isMovieDropdownOpen ? 'rotate-180 text-blue-400' : ''
                  }`}
                >
                  ▼
                </span>
              </div>
            </button>

            {/* Floating Dropdown Menu */}
            {isMovieDropdownOpen && (
              <div className="absolute left-0 bottom-full sm:bottom-auto sm:top-full mb-2 sm:mb-0 sm:mt-2 w-[330px] sm:w-[390px] bg-[#121826]/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl p-2.5 shadow-2xl z-50 animate-in fade-in duration-150">
                <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-800/80">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-amber-400 text-xs">
                      {currentSchedule.status === 'NOW_SHOWING'
                        ? '🎬'
                        : currentSchedule.status === 'COMING_SOON'
                        ? '🍿'
                        : '🎞️'}
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">
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
                          if (m.showtimes && m.showtimes.length > 0) {
                            setSelectedShowtimeId(String(m.showtimes[0].id));
                          }
                          setIsMovieDropdownOpen(false);
                        }}
                        className={`flex items-center space-x-3 p-2 rounded-xl cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500/80 shadow-md shadow-blue-500/10'
                            : 'bg-[#182133]/60 hover:bg-[#202b42] border-transparent hover:border-slate-700'
                        }`}
                      >
                        <img
                          src={m.poster || m.posterUrl}
                          alt={m.title}
                          className="w-11 h-14 object-cover rounded-lg shrink-0 shadow-md border border-slate-700/50"
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
                            <span className="text-[10px] text-amber-400 font-bold flex items-center">
                              ★ {m.rating || '4.8'}
                            </span>
                            <span className="text-[10px] text-slate-400">• {m.duration || 120} phút</span>
                            {m.status === 'ENDED' && (
                              <span className="text-[8px] font-bold text-slate-400 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">
                                Đã công chiếu
                              </span>
                            )}
                          </div>

                          <h5
                            className={`text-xs font-bold truncate ${
                              isSelected ? 'text-blue-300' : 'text-slate-100'
                            }`}
                          >
                            {m.title}
                          </h5>

                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {['IMAX LASER', 'ATMOS', 'GOLD CLASS'].map((fmt, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] font-bold bg-slate-800/90 text-amber-300/90 px-1.5 py-0.5 rounded border border-amber-500/30"
                              >
                                {fmt}
                              </span>
                            ))}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow">
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
              <label className="text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                <span className="text-amber-500">📍</span>
                <span>Rạp chiếu</span>
              </label>
            </div>
            {cinemas.length > 1 ? (
              <div className="relative">
                <select
                  value={selectedTheater}
                  onChange={(e) => setSelectedTheater(e.target.value)}
                  className="w-full h-[38px] bg-[#1b2232] border border-slate-700/60 rounded-xl px-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-7"
                >
                  {cinemas.map((c) => (
                    <option key={c.id || c._id} value={c.name}>
                      {c.district ? `[Q.${c.district}] ` : ''}{c.name}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-2.5 text-slate-500 text-[10px] pointer-events-none">
                  ⌵
                </span>
              </div>
            ) : (
              <div
                className="w-full h-[38px] bg-[#1b2232] border border-slate-700/60 rounded-xl px-3 text-xs font-bold text-white select-none shadow-sm flex items-center space-x-1.5"
                title="D'AVENOR Thanh Khê Plaza - 295 Điện Biên Phủ, Q. Thanh Khê, Đà Nẵng"
              >
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                  Q. Thanh Khê
                </span>
                <span className="truncate text-slate-100 font-bold">
                  D'AVENOR Thanh Khê Plaza
                </span>
              </div>
            )}
          </div>

          {/* 3. Chọn Ngày & Lịch Chiếu (Hỗ trợ mở Lịch/Datepicker + chia đều 3 phim theo tháng) */}
          <div className="sm:col-span-1 lg:col-span-2 space-y-1">
            <div className="flex items-center h-5">
              <label className="text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                <span className="text-emerald-500">📅</span>
                <span>Ngày chiếu</span>
              </label>
            </div>

            <div className="relative">
              {/* Native Date Picker với min="2026-11-21" để bôi đen / vô hiệu hóa tất cả các ngày trong quá khứ */}
              <input
                ref={dateInputRef}
                type="date"
                min="2026-11-21"
                max="2027-12-31"
                value={dateStr}
                onChange={(e) => handleDateChangeFromPicker(e.target.value)}
                className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                tabIndex={-1}
              />

              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-[38px] bg-[#1b2232] border border-slate-700/60 rounded-xl px-2.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-12 truncate"
              >
                <optgroup label="── NGÀY GẦN NHẤT ──">
                  <option value="Hôm nay">Hôm nay (21-11)</option>
                  <option value="Ngày mai">Ngày mai (22-11)</option>
                  <option value="Ngày kia">Ngày kia (23-11)</option>
                </optgroup>

                <optgroup label="── LỊCH CHIẾU THEO THÁNG (3 PHIM/THÁNG) ──">
                  <option value="month-2026-11">🟢 Tháng 11/2026 (Đang chiếu: Dune 2, Mai, Deadpool)</option>
                  <option value="month-2026-12">🟡 Tháng 12/2026 (Sắp chiếu: Moana 2, Mufasa, Venom)</option>
                  <option value="month-2027-01">🟡 Tháng 01/2027 (Sắp chiếu: Cô Dâu, Transformers, Inside Out)</option>
                  <option value="month-2027-02">🟡 Tháng 02/2027 (Sắp chiếu: Cap 4, Joker 2, Panda 4)</option>
                  <option value="month-2027-03">🟡 Tháng 03/2027 (Sắp chiếu: Quật Mộ, Lật Mặt, Godzilla)</option>
                  <option value="month-2027-04">🟡 Tháng 04/2027 (Sắp chiếu: Oppenheimer, Spider-Man, Avatar)</option>
                </optgroup>
              </select>

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenNativeDatePicker();
                  }}
                  className="p-1 hover:bg-slate-700/80 rounded text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                  title="Mở lịch chọn ngày chiếu"
                >
                  <span className="text-xs">📅</span>
                </button>
                <span className="text-slate-500 text-[10px] pointer-events-none">⌵</span>
              </div>
            </div>
          </div>

          {/* 4. Chọn Suất Chiếu */}
          <div className="sm:col-span-1 lg:col-span-2 space-y-1">
            <div className="flex items-center h-5">
              <label className="text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                <span className="text-blue-400">🕒</span>
                <span>Suất chiếu</span>
              </label>
            </div>
            <div className="relative">
              <select
                value={selectedShowtimeId}
                onChange={(e) => setSelectedShowtimeId(e.target.value)}
                disabled={isPastDate || currentSchedule.status === 'ENDED'}
                className="w-full h-[38px] bg-[#1b2232] border border-slate-700/60 rounded-xl px-2.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-7 disabled:opacity-60 disabled:cursor-not-allowed truncate"
              >
                {isPastDate ? (
                  <option value="ended">Đã kết thúc suất chiếu</option>
                ) : (
                  availableShowtimes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.time ? `${st.time} - ` : ''}{st.roomName || 'IMAX Laser'}
                    </option>
                  ))
                )}
              </select>
              <span className="absolute right-3 top-2.5 text-slate-500 text-[10px] pointer-events-none">
                ⌵
              </span>
            </div>
          </div>

          {/* 5. Nút Đặt Vé Ngay */}
          <div className="sm:col-span-2 lg:col-span-2">
            {isPastDate ? (
              <button
                type="button"
                disabled
                className="w-full h-[38px] bg-slate-800/80 text-slate-500 border border-slate-700/50 font-bold px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 cursor-not-allowed opacity-60 shadow"
                title="Ngày chiếu trong quá khứ - Không thể đặt vé"
              >
                <span>⛔</span>
                <span>Ngày chiếu đã qua</span>
              </button>
            ) : isAdvanceBooking ? (
              <button
                type="button"
                onClick={handleQuickBooking}
                className="w-full h-[38px] bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-amber-600/30 cursor-pointer hover:scale-105 active:scale-95"
                title="Đặt trước vé xem phim"
              >
                <span>🎫</span>
                <span>Đặt trước vé</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickBooking}
                className="w-full h-[38px] bg-[#2563eb] hover:bg-blue-600 text-white font-black px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-blue-600/30 cursor-pointer hover:scale-105 active:scale-95"
              >
                <span>🎟️</span>
                <span>Đặt vé ngay</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeQuickBooking;
