import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarPlus,
  Clock,
  ChevronDown,
  Search,
  X,
  Check,
  Film,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Trash2,
} from 'lucide-react';
import AdminSectionTabs from '../../components/admin/AdminSectionTabs';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import ShowtimeDetailDrawer from './statistics/drawers/ShowtimeDetailDrawer';
import api from '../../services/api';
import {
  calculateDynamicPrices,
  loadPricingConfig,
  DEFAULT_PRICING_CONFIG,
  ROOM_TYPES_ENUM,
  resolveCanonicalRoomType,
} from '../../utils/pricing';

const ShowtimeManagePage = () => {
  const [showtimes, setShowtimes] = useState([]);
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [loading, setLoading] = useState(true);

  // Chế độ xem: 'timeline' (Theo phòng - mặc định), 'movie' (Theo phim), 'list' (Danh sách)
  const [viewMode, setViewMode] = useState('timeline');

  // Quản lý ngày đang xem (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [viewDate, setViewDate] = useState(todayStr);

  // Bộ lọc
  const [filterMovieId, setFilterMovieId] = useState('ALL');
  const [filterRoomType, setFilterRoomType] = useState('ALL');
  const [quickFilter, setQuickFilter] = useState('ALL'); // 'ALL' | 'CONFLICTS' | 'MISSING_SEATS' | 'HIDE_CONFLICTS'

  // Thu gọn / Mở rộng các phim trong Chế độ theo phim (Mặc định mở tất cả)
  const [expandedMovieIds, setExpandedMovieIds] = useState(new Set());

  // Thu gọn / Mở rộng các tầng va chạm trong Timeline phòng (Collision Collapsing)
  const [expandedRoomIds, setExpandedRoomIds] = useState(new Set());

  // Drawer chi tiết suất chiếu
  const [drawerShowtimeId, setDrawerShowtimeId] = useState(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchPreview, setBatchPreview] = useState(null);
  const [showtimeToDelete, setShowtimeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Recurring showtime mode ─────────────────────────────────────────────────
  const [createMode, setCreateMode] = useState('single'); // 'single' | 'recurring'
  const [recurringData, setRecurringData] = useState({
    startDate: '',
    endDate: '',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    timeSlots: [],
    pricingMode: 'fixed',
    manualTimeInput: '',
  });
  const [recurringPreview, setRecurringPreview] = useState(null); // { validSlots, conflictSlots, ... }
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringCommitting, setRecurringCommitting] = useState(false);
  const [previewFilter, setPreviewFilter] = useState('ALL'); // 'ALL'|'VALID'|'CONFLICT'
  const [previewRemovedKeys, setPreviewRemovedKeys] = useState(new Set()); // keys of removed conflict rows

  // Gợi ý khung giờ trống
  const [availableSlots, setAvailableSlots] = useState([]);
  const [alternativeRooms, setAlternativeRooms] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Trạng thái giao diện Modal Tạo Suất Chiếu Mới
  const [isMoviePickerOpen, setIsMoviePickerOpen] = useState(false);
  const [movieSearchKeyword, setMovieSearchKeyword] = useState('');
  const [isSubmittingShowtime, setIsSubmittingShowtime] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('');

  // Form mở 1 suất lẻ
  const [formData, setFormData] = useState({
    movieId: '',
    cinemaId: '',
    roomId: '',
    roomName: '',
    startTime: '',
    price: 80000,
  });

  // Form lên lịch chiếu hàng loạt theo Tuần / Tháng
  const [batchData, setBatchData] = useState({
    cinemaId: 'ALL',
    startDate: todayStr,
    endDate: todayStr,
    selectedMovieIds: [],
    timeSlots: ['09:00', '11:30', '14:00', '16:30', '19:00', '21:30'],
    roomIds: [],
  });

  // Điều hướng ngày: Hôm trước, Hôm sau, Hôm nay
  const handleShiftDay = (delta) => {
    const current = new Date(viewDate + 'T00:00:00+07:00');
    current.setDate(current.getDate() + delta);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    setViewDate(`${y}-${m}-${d}`);
  };

  const handleResetToday = () => {
    setViewDate(todayStr);
  };

  useEffect(() => {
    loadData();
  }, [viewDate]);

  const resolveSuggestedPrice = (roomOrName, startTime, cfg = pricingConfig) => {
    const matchedRoom =
      typeof roomOrName === 'object' && roomOrName !== null
        ? roomOrName
        : rooms.find(
            (rm) =>
              rm.name === roomOrName ||
              String(rm.id || rm._id) === String(formData.roomId)
          );

    return calculateDynamicPrices(
      {
        room: matchedRoom || undefined,
        roomType: matchedRoom?.roomType || resolveCanonicalRoomType(roomOrName),
        roomName: typeof roomOrName === 'string' ? roomOrName : matchedRoom?.name,
        startTime: startTime || new Date().toISOString(),
        useConfigMatrix: true,
      },
      cfg
    ).priceStandard;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = { viewDate };

      const [stResult, mResult, cResult, rResult, cfgResult] = await Promise.allSettled([
        api.get('/admin/showtimes', { params }),
        api.get('/movies'),
        api.get('/admin/cinemas'),
        api.get('/admin/rooms'),
        loadPricingConfig(true),
      ]);

      const activeCfg = (cfgResult.status === 'fulfilled' && cfgResult.value) || DEFAULT_PRICING_CONFIG;
      setPricingConfig(activeCfg);

      const stList = (stResult.status === 'fulfilled' && Array.isArray(stResult.value?.data)) ? stResult.value.data : [];
      const mList = (mResult.status === 'fulfilled' && Array.isArray(mResult.value?.data)) ? mResult.value.data : [];
      const cList = (cResult.status === 'fulfilled' && Array.isArray(cResult.value?.data)) ? cResult.value.data : [];
      const rList = (rResult.status === 'fulfilled' && Array.isArray(rResult.value?.data)) ? rResult.value.data : [];

      setShowtimes(stList);
      setMovies(mList);
      setCinemas(cList);
      setRooms(rList);

      // Mặc định mở rộng tất cả các phim
      setExpandedMovieIds(new Set(mList.map(m => String(m.id || m._id))));

      if (mList.length > 0 && cList.length > 0 && !formData.movieId) {
        const defaultRoom = rList[0];
        setFormData((prev) => ({
          ...prev,
          movieId: mList[0].id || mList[0]._id,
          cinemaId: cList[0].id || cList[0]._id,
          roomId: defaultRoom?._id || defaultRoom?.id || '',
          roomName: defaultRoom?.name || '',
          price: resolveSuggestedPrice(defaultRoom?.name, prev.startTime, activeCfg),
        }));

        setBatchData((prev) => ({
          ...prev,
          cinemaId: cList[0].id || cList[0]._id,
          selectedMovieIds: prev.selectedMovieIds.length > 0
            ? prev.selectedMovieIds
            : mList.slice(0, 4).map((m) => m.id || m._id),
          roomIds: prev.roomIds.length > 0 ? prev.roomIds : rList.map(r => r.id || r._id),
        }));
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu suất chiếu:', err);
    } finally {
      setLoading(false);
    }
  };

  // Tự động kiểm tra gợi ý khung giờ trống khi mở modal và chọn phòng/phim/ngày
  useEffect(() => {
    if (!isModalOpen || !formData.roomId || !formData.movieId || !formData.startTime) {
      setAvailableSlots([]);
      setAlternativeRooms([]);
      return;
    }

    const datePart = formData.startTime.slice(0, 10);
    if (!datePart || datePart.length !== 10) return;

    let isMounted = true;
    setSlotsLoading(true);

    api.get('/admin/showtimes/available-slots', {
      params: {
        roomId: formData.roomId,
        movieId: formData.movieId,
        date: datePart,
      },
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.data?.success) {
          setAvailableSlots(res.data.availableSlots || []);
          setAlternativeRooms(res.data.alternativeRooms || []);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setAvailableSlots([]);
        setAlternativeRooms([]);
      })
      .finally(() => {
        if (isMounted) setSlotsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isModalOpen, formData.roomId, formData.movieId, formData.startTime]);

  // Các helper hiển thị phòng và định dạng phim tương thích
  const formatRoomDisplayName = (r) => {
    if (!r) return '';
    const numMatch = r.name?.match(/Phòng\s*0?(\d+)/i);
    const num = numMatch ? String(numMatch[1]).padStart(2, '0') : String(r.roomNumber || 1).padStart(2, '0');
    const type = r.roomType || 'Tiêu chuẩn';
    return `Phòng ${num} — ${type}`;
  };

  const getRoomTypeTheme = (roomType = '') => {
    const canonical = resolveCanonicalRoomType(roomType);
    if (canonical === ROOM_TYPES_ENUM.IMAX_LASER) {
      return {
        textColor: 'text-[#22D3EE]',
        bgColor: 'bg-[#22D3EE]/10',
        borderColor: 'border-[#22D3EE]/40',
        accent: '#22D3EE',
        name: 'IMAX Laser'
      };
    }
    if (canonical === ROOM_TYPES_ENUM.DOLBY_ATMOS) {
      return {
        textColor: 'text-[#A78BFA]',
        bgColor: 'bg-[#A78BFA]/10',
        borderColor: 'border-[#A78BFA]/40',
        accent: '#A78BFA',
        name: 'Dolby Atmos'
      };
    }
    if (canonical === ROOM_TYPES_ENUM.GOLD_CLASS) {
      return {
        textColor: 'text-[#E5C07B]',
        bgColor: 'bg-[#E5C07B]/10',
        borderColor: 'border-[#E5C07B]/40',
        accent: '#E5C07B',
        name: 'Gold Class'
      };
    }
    return {
      textColor: 'text-[#79D9F5]',
      bgColor: 'bg-[#79D9F5]/10',
      borderColor: 'border-[#79D9F5]/40',
      accent: '#79D9F5',
      name: 'Tiêu chuẩn'
    };
  };

  const getCompatibleFormats = (movie, room) => {
    if (!room) return ['2D Tiêu chuẩn'];
    const canonical = resolveCanonicalRoomType(room);
    if (canonical === ROOM_TYPES_ENUM.IMAX_LASER) {
      return ['2D IMAX Laser', '3D IMAX Laser'];
    }
    if (canonical === ROOM_TYPES_ENUM.DOLBY_ATMOS) {
      return ['2D Dolby Atmos', '3D Dolby Atmos'];
    }
    if (canonical === ROOM_TYPES_ENUM.GOLD_CLASS) {
      return ['2D Gold Class VIP Lounge'];
    }
    return ['2D Tiêu chuẩn'];
  };

  // Movie & Room đang chọn trong modal
  const selectedMovie = useMemo(() => {
    return movies.find(m => String(m.id || m._id) === String(formData.movieId)) || movies[0];
  }, [movies, formData.movieId]);

  const selectedRoom = useMemo(() => {
    return rooms.find(r => String(r.id || r._id) === String(formData.roomId)) || rooms[0];
  }, [rooms, formData.roomId]);

  // Tách ngày và giờ 24h
  const formDate = useMemo(() => {
    return formData.startTime ? formData.startTime.slice(0, 10) : viewDate;
  }, [formData.startTime, viewDate]);

  const formTime = useMemo(() => {
    return formData.startTime && formData.startTime.includes('T') ? formData.startTime.slice(11, 16) : '18:00';
  }, [formData.startTime]);

  const handleFormDateChange = (newDate) => {
    const curTime = formTime || '18:00';
    const newDateTime = `${newDate}T${curTime}`;
    setFormData(prev => ({
      ...prev,
      startTime: newDateTime,
      price: resolveSuggestedPrice(prev.roomName, newDateTime, pricingConfig)
    }));
  };

  const handleFormTimeChange = (newTime) => {
    const curDate = formDate || viewDate;
    const newDateTime = `${curDate}T${newTime}`;
    setFormData(prev => ({
      ...prev,
      startTime: newDateTime,
      price: resolveSuggestedPrice(prev.roomName, newDateTime, pricingConfig)
    }));
  };

  // Tóm tắt 4 mốc thời gian
  const timeSummary = useMemo(() => {
    const dur = Number(selectedMovie?.duration) || 120;
    const [sh, sm] = (formTime || '18:00').split(':').map(Number);
    const startMin = (sh || 0) * 60 + (sm || 0);
    const endMin = startMin + dur;
    const readyMin = endMin + 15;

    const toObj = (totMin) => {
      const isNext = totMin >= 1440;
      const m = totMin % 1440;
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      return { str: `${hh}:${mm}`, isNext };
    };

    return {
      duration: dur,
      startTime: formTime,
      endTime: toObj(endMin),
      cleaningTime: '15 phút',
      readyTime: toObj(readyMin)
    };
  }, [selectedMovie, formTime]);

  // Kiểm tra xung đột thực tế
  const conflictStatus = useMemo(() => {
    if (slotsLoading) return { text: 'Đang kiểm tra...', tone: 'loading' };
    if (!formData.roomId || !formData.startTime) return { text: 'Chưa đủ thông tin', tone: 'idle' };

    const startD = new Date(formData.startTime);
    if (isNaN(startD.getTime())) return { text: 'Thời gian không hợp lệ', tone: 'idle' };
    const dur = Number(selectedMovie?.duration) || 120;
    const startMs = startD.getTime();
    const endMs = startMs + dur * 60000;
    const cleanEndMs = endMs + 15 * 60000;

    const startH = startD.getHours();
    if (startH < 8 && startH >= 2) {
      return { text: 'Vượt khung giờ hoạt động rạp (08:00 - 02:00)', tone: 'warning' };
    }

    const roomShowtimes = showtimes.filter(s =>
      String(s.roomId || s.roomId?._id) === String(formData.roomId) &&
      !s.cancelledAt
    );

    for (const s of roomShowtimes) {
      const sStart = new Date(s.startTime).getTime();
      const sDur = Number(s.movieId?.duration) || 120;
      const sEnd = s.endTime ? new Date(s.endTime).getTime() : sStart + sDur * 60000;
      const sOccupiedEnd = sEnd + (s.cleaningMinutes ?? 15) * 60000;

      if (startMs < sEnd && sStart < endMs) {
        return { text: 'Trùng lịch chiếu với suất khác', tone: 'danger' };
      }
      if (startMs < sOccupiedEnd && sStart < cleanEndMs) {
        return { text: 'Không đủ 15 phút dọn dẹp vệ sinh', tone: 'warning' };
      }
    }

    return { text: 'Không trùng lịch (Sẵn sàng mở bán)', tone: 'success' };
  }, [slotsLoading, formData.roomId, formData.startTime, selectedMovie, showtimes]);

  // Ngày mở bán (tối đa trước 7 ngày)
  const openSaleInfo = useMemo(() => {
    if (!formData.startTime) return { text: 'Chưa chọn ngày', tone: 'muted' };
    const showDate = new Date(formData.startTime);
    const now = new Date();
    const dShow = new Date(showDate.getFullYear(), showDate.getMonth(), showDate.getDate());
    const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((dShow - dNow) / 86400000);

    if (diffDays < 0) {
      return { text: 'Suất chiếu trong quá khứ', tone: 'danger' };
    }
    if (diffDays <= 7) {
      return { text: 'Mở bán ngay (Trong phạm vi 7 ngày)', tone: 'success' };
    }
    const openDate = new Date(dShow.getTime() - 7 * 86400000);
    const dd = String(openDate.getDate()).padStart(2, '0');
    const mm = String(openDate.getMonth() + 1).padStart(2, '0');
    const yyyy = openDate.getFullYear();
    return {
      text: `Mở bán từ ngày ${dd}/${mm}/${yyyy} (Trước 7 ngày)`,
      tone: 'info'
    };
  }, [formData.startTime]);

  // ── Recurring helpers ──────────────────────────────────────────────────────
  const recurringDayLabels = [
    { label: 'CN', value: 0 },
    { label: 'T2', value: 1 },
    { label: 'T3', value: 2 },
    { label: 'T4', value: 3 },
    { label: 'T5', value: 4 },
    { label: 'T6', value: 5 },
    { label: 'T7', value: 6 },
  ];

  const getRecurringStartDate = () =>
    recurringData.startDate || viewDate;

  const getRecurringEndDate = () =>
    recurringData.endDate || viewDate;

  const handleRecurringQuickRange = (days) => {
    const start = getRecurringStartDate();
    const d = new Date(start + 'T12:00:00+07:00');
    d.setDate(d.getDate() + days - 1);
    const end = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    setRecurringData(prev => ({ ...prev, startDate: start, endDate: end }));
    setRecurringPreview(null);
  };

  const handleRecurringEndOfMonth = () => {
    const start = getRecurringStartDate();
    const d = new Date(start + 'T12:00:00+07:00');
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    setRecurringData(prev => ({ ...prev, startDate: start, endDate: end }));
    setRecurringPreview(null);
  };

  const toggleDayOfWeek = (day) => {
    setRecurringData(prev => {
      const set = new Set(prev.daysOfWeek);
      if (set.has(day)) { set.delete(day); } else { set.add(day); }
      return { ...prev, daysOfWeek: [...set] };
    });
    setRecurringPreview(null);
  };

  const toggleRecurringSlot = (time) => {
    setRecurringData(prev => {
      const slots = prev.timeSlots.includes(time)
        ? prev.timeSlots.filter(t => t !== time)
        : [...prev.timeSlots, time].sort();
      return { ...prev, timeSlots: slots };
    });
    setRecurringPreview(null);
  };

  const addManualTimeSlot = () => {
    const t = recurringData.manualTimeInput.trim();
    if (!/^\d{2}:\d{2}$/.test(t)) { alert('Định dạng giờ phải là HH:mm (ví dụ: 09:30)'); return; }
    if (!recurringData.timeSlots.includes(t)) {
      setRecurringData(prev => ({
        ...prev,
        timeSlots: [...prev.timeSlots, t].sort(),
        manualTimeInput: '',
      }));
      setRecurringPreview(null);
    }
  };

  // Expected count (computed locally, no API call)
  const recurringExpectedCount = (() => {
    const start = getRecurringStartDate();
    const end = getRecurringEndDate();
    if (!start || !end || start > end) return 0;
    const msPerDay = 86400000;
    const startMs = new Date(start + 'T00:00:00+07:00').getTime();
    const endMs   = new Date(end   + 'T00:00:00+07:00').getTime();
    const days = Math.round((endMs - startMs) / msPerDay) + 1;
    let count = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(startMs + i * msPerDay);
      const dow = new Date(d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) + 'T12:00:00+07:00').getDay();
      if (recurringData.daysOfWeek.includes(dow)) count++;
    }
    return count * recurringData.timeSlots.length;
  })();

  const handleRecurringPreview = async () => {
    if (!formData.movieId) { alert('Vui lòng chọn bộ phim.'); return; }
    if (!formData.roomId) { alert('Vui lòng chọn phòng chiếu.'); return; }
    const startDate = getRecurringStartDate();
    const endDate = getRecurringEndDate();
    if (!startDate || !endDate) { alert('Vui lòng chọn ngày bắt đầu và kết thúc.'); return; }
    if (startDate > endDate) { alert('Ngày bắt đầu phải trước ngày kết thúc.'); return; }
    if (recurringData.daysOfWeek.length === 0) { alert('Vui lòng chọn ít nhất 1 ngày trong tuần.'); return; }
    if (recurringData.timeSlots.length === 0) { alert('Vui lòng chọn ít nhất 1 khung giờ.'); return; }

    try {
      setRecurringLoading(true);
      setRecurringPreview(null);
      setPreviewRemovedKeys(new Set());
      const res = await api.post('/admin/showtimes/recurring/preview', {
        movieId: formData.movieId,
        roomId: formData.roomId,
        cinemaId: formData.cinemaId,
        formatFeature: selectedFormat || getCompatibleFormats(selectedMovie, selectedRoom)[0] || '2D Tiêu chuẩn',
        startDate,
        endDate,
        daysOfWeek: recurringData.daysOfWeek,
        timeSlots: recurringData.timeSlots,
        pricingMode: recurringData.pricingMode,
        price: formData.price,
      });
      setRecurringPreview(res.data);
      setPreviewFilter('ALL');
    } catch (err) {
      alert('Lỗi khi tạo preview: ' + (err.response?.data?.message || err.message));
    } finally {
      setRecurringLoading(false);
    }
  };

  const handleRecurringCommit = async () => {
    if (!recurringPreview) return;
    const allValid = recurringPreview.validSlots || [];
    const confirmedSlots = allValid
      .filter(s => !previewRemovedKeys.has(s.startTime + s.roomId))
      .map(s => ({
        movieId: s.movieId,
        roomId: s.roomId,
        cinemaId: formData.cinemaId,
        formatFeature: s.formatFeature,
        startTime: s.startTime,
        price: s.price,
      }));

    if (confirmedSlots.length === 0) { alert('Không có suất chiếu hợp lệ để tạo.'); return; }

    const confirmed = window.confirm(`Xác nhận tạo ${confirmedSlots.length} suất chiếu hợp lệ?`);
    if (!confirmed) return;

    try {
      setRecurringCommitting(true);
      const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const res = await api.post('/admin/showtimes/recurring/commit', { confirmedSlots, requestId });
      const { created = [], conflicts = [], failed = [] } = res.data;
      let msg = `Đã tạo ${created.length} suất chiếu thành công!`;
      if (conflicts.length > 0) msg += `\n${conflicts.length} suất bị xung đột.`;
      if (failed.length > 0) msg += `\n${failed.length} suất lỗi kỹ thuật.`;
      alert(msg);
      setIsModalOpen(false);
      setRecurringPreview(null);
      setCreateMode('single');
      await loadData();
    } catch (err) {
      alert('Lỗi khi tạo lịch chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setRecurringCommitting(false);
    }
  };

  // Click vào ô trống trên Timeline: Tự động mở modal và điền sẵn phòng và giờ
  const handleTimelineSlotClick = (room, hour, minute = 0) => {
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    const targetDateTime = `${viewDate}T${hh}:${mm}`;
    const firstMovie = movies[0];

    setFormData((prev) => ({
      ...prev,
      roomId: room._id || room.id,
      roomName: room.name,
      movieId: prev.movieId || (firstMovie?.id || firstMovie?._id || ''),
      startTime: targetDateTime,
      price: resolveSuggestedPrice(room.name, targetDateTime, pricingConfig),
    }));
    const compFormats = getCompatibleFormats(firstMovie, room);
    setSelectedFormat(compFormats[0] || '2D Tiêu chuẩn');
    setIsMoviePickerOpen(false);
    setMovieSearchKeyword('');
    setIsModalOpen(true);
  };

  // Mở modal tạo suất lẻ
  const handleOpenCreateModal = () => {
    const nowTime = new Date();
    nowTime.setMinutes(Math.ceil(nowTime.getMinutes() / 15) * 15, 0, 0);
    const defaultStart = `${viewDate}T${String(nowTime.getHours()).padStart(2, '0')}:${String(nowTime.getMinutes()).padStart(2, '0')}`;
    const firstMovie = movies[0];
    const firstRoom = rooms[0];

    setFormData((prev) => ({
      ...prev,
      startTime: prev.startTime || defaultStart,
      movieId: prev.movieId || (firstMovie?.id || firstMovie?._id || ''),
      roomId: prev.roomId || (firstRoom?.id || firstRoom?._id || ''),
      roomName: prev.roomName || (firstRoom?.name || ''),
      price: prev.price || resolveSuggestedPrice(firstRoom?.name, prev.startTime || defaultStart, pricingConfig),
    }));
    const compFormats = getCompatibleFormats(firstMovie, firstRoom);
    setSelectedFormat(compFormats[0] || '2D Tiêu chuẩn');
    setIsMoviePickerOpen(false);
    setMovieSearchKeyword('');
    setIsModalOpen(true);
  };

  // Tạo 1 suất lẻ an toàn
  const handleCreateShowtime = async (e) => {
    e.preventDefault();
    if (!formData.startTime || !formData.roomId || !formData.movieId) {
      alert('Vui lòng điền đầy đủ phim, phòng chiếu và thời gian bắt đầu!');
      return;
    }
    if (conflictStatus.tone === 'danger') {
      alert('Không thể tạo suất chiếu: ' + conflictStatus.text);
      return;
    }

    try {
      setIsSubmittingShowtime(true);
      await api.post('/admin/showtimes', {
        ...formData,
        formatFeature: selectedFormat || getCompatibleFormats(selectedMovie, selectedRoom)[0] || '2D Tiêu chuẩn'
      });
      alert('Đã khởi tạo suất chiếu mới thành công!');
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert('Không thể tạo suất chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmittingShowtime(false);
    }
  };

  // Mở modal xác nhận xóa / hủy suất chiếu
  const handleRequestDelete = (st) => {
    setShowtimeToDelete(st);
  };

  // Thực hiện xóa suất chiếu sau khi xác nhận
  const handleConfirmDelete = async () => {
    if (!showtimeToDelete) return;
    const id = showtimeToDelete.id || showtimeToDelete._id;
    try {
      setIsDeleting(true);
      const res = await api.delete(`/admin/showtimes/${id}`);
      const msg = res.data?.message || 'Đã xóa suất chiếu thành công!';
      alert(msg);
      if (drawerShowtimeId === id) {
        setDrawerShowtimeId(null);
      }
      setShowtimeToDelete(null);
      await loadData();
    } catch (err) {
      console.error('Lỗi khi xóa suất chiếu:', err);
      alert('Không thể xóa suất chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDeleting(false);
    }
  };

  // Sửa nhanh giá vé
  const handleQuickEditPrice = async (st) => {
    const rawInput = window.prompt(
      `Nhập giá vé cơ bản mới (VNĐ) cho suất ${st.roomName}:`,
      String(st.price || 55000)
    );
    if (rawInput === null) return;
    const nextPrice = Number(rawInput);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ lớn hơn 0!');
      return;
    }
    try {
      await api.put(`/admin/showtimes/${st.id || st._id}`, { price: Math.round(nextPrice) });
      loadData();
    } catch (err) {
      alert('Lỗi cập nhật giá vé: ' + (err.response?.data?.message || err.message));
    }
  };

  // Xếp lịch hàng loạt: Xem trước (Preview)
  const handlePreviewBatch = async () => {
    if (!batchData.startDate || !batchData.endDate) {
      alert('Vui lòng chọn ngày bắt đầu và kết thúc!');
      return;
    }
    if (batchData.selectedMovieIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 bộ phim!');
      return;
    }

    try {
      setBatchLoading(true);
      const res = await api.post('/admin/showtimes/schedule-batch', {
        cinemaId: batchData.cinemaId,
        startDate: batchData.startDate,
        endDate: batchData.endDate,
        movieIds: batchData.selectedMovieIds,
        timeSlots: batchData.timeSlots,
        roomIds: batchData.roomIds,
        preview: true,
      });

      if (res.data?.preview) {
        setBatchPreview(res.data);
      }
    } catch (err) {
      alert('Lỗi xem trước lịch chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setBatchLoading(false);
    }
  };

  // Xếp lịch hàng loạt: Xác nhận ghi Database
  const handleExecuteBatchSchedule = async () => {
    try {
      setBatchLoading(true);
      const res = await api.post('/admin/showtimes/schedule-batch', {
        cinemaId: batchData.cinemaId,
        startDate: batchData.startDate,
        endDate: batchData.endDate,
        movieIds: batchData.selectedMovieIds,
        timeSlots: batchData.timeSlots,
        roomIds: batchData.roomIds,
        preview: false,
      });

      alert(`Đã xếp lịch chiếu hàng loạt thành công! (${res.data?.totalCreatedShowtimes || 0} suất)`);
      setIsBatchModalOpen(false);
      setBatchPreview(null);
      loadData();
    } catch (err) {
      alert('Lỗi xếp lịch chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setBatchLoading(false);
    }
  };

  // Lọc showtimes theo enum room.roomType
  const filteredShowtimes = useMemo(() => {
    return showtimes.filter((st) => {
      const mId = String(st.movieId?._id || st.movieId || '');
      const rType = resolveCanonicalRoomType(st);

      const matchMovie = filterMovieId === 'ALL' || mId === String(filterMovieId);
      const matchRoomType = filterRoomType === 'ALL' || rType === filterRoomType;

      let matchQuick = true;
      if (quickFilter === 'CONFLICTS') matchQuick = Boolean(st.hasConflict);
      if (quickFilter === 'MISSING_SEATS') matchQuick = !st.totalSeats || st.totalSeats === 0;
      if (quickFilter === 'HIDE_CONFLICTS') matchQuick = !st.hasConflict || (st.bookedSeats && st.bookedSeats > 0);

      return matchMovie && matchRoomType && matchQuick;
    });
  }, [showtimes, filterMovieId, filterRoomType, quickFilter]);

  // Sắp xếp 9 phòng chiếu chuẩn theo 3 nhóm vật lý
  const sortedPhysicalRooms = useMemo(() => {
    const list = [...rooms];
    const order = { 'IMAX Laser': 1, 'Dolby Atmos': 2, 'Gold Class': 3 };
    return list.sort((a, b) => {
      const typeDiff = (order[a.roomType] || 99) - (order[b.roomType] || 99);
      if (typeDiff !== 0) return typeDiff;
      return (a.roomNumber || 0) - (b.roomNumber || 0) || a.name.localeCompare(b.name);
    });
  }, [rooms]);

  // Thống kê nhanh trên đầu Timeline
  const statsSummary = useMemo(() => {
    const total = showtimes.length;
    const roomIdsWithShowtimes = new Set(showtimes.map(st => String(st.roomId?._id || st.roomId || st.roomName)));
    const activeRoomsCount = sortedPhysicalRooms.filter(r =>
      roomIdsWithShowtimes.has(String(r._id || r.id)) || showtimes.some(st => (st.roomName || '').includes(r.shortName || r.name))
    ).length;
    const conflictsCount = showtimes.filter(st => st.hasConflict).length;
    const missingSeatsCount = showtimes.filter(st => !st.totalSeats || st.totalSeats === 0).length;

    return { total, activeRoomsCount, conflictsCount, missingSeatsCount };
  }, [showtimes, sortedPhysicalRooms]);

  // Trục thời gian mở rộng: từ 08:00 sáng đến 02:00 sáng hôm sau (18 giờ = 1080 phút)
  const timelineHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
  const startHour = 8;
  const totalTimelineMinutes = 18 * 60; // 1080 phút

  // Tính vị trí vạch giờ hiện tại (Current Time Indicator) nếu đang xem ngày hôm nay
  const currentTimeIndicatorLeft = useMemo(() => {
    if (viewDate !== todayStr) return null;
    const now = new Date();
    const currentMinutes = (now.getHours() * 60 + now.getMinutes()) - (startHour * 60);
    if (currentMinutes < 0 || currentMinutes > totalTimelineMinutes) return null;
    return (currentMinutes / totalTimelineMinutes) * 100;
  }, [viewDate, todayStr, totalTimelineMinutes, startHour]);

  // Thuật toán Multi-lane chống đè khối Timeline khi các suất chiếu bị chồng lấn
  const computeMultiLaneSlots = (roomSlots) => {
    const baseDate = new Date(`${viewDate}T08:00:00+07:00`);
    const timelineEnd = new Date(baseDate.getTime() + totalTimelineMinutes * 60000); // 02:00 sáng hôm sau

    // Lọc những suất thực sự có giao thoa với khung giờ hiển thị [08:00, 02:00 hôm sau]
    // Loại bỏ các suất của đêm hôm trước đã kết thúc trước 08:00 sáng
    const visibleSlots = roomSlots.filter((st) => {
      const stStart = new Date(st.startTime).getTime();
      const movie = st.movieId || {};
      const duration = Number(movie.duration) || 120;
      const cleaning = st.cleaningMinutes ?? 15;
      const stEnd = stStart + (duration + cleaning) * 60000;
      return stEnd > baseDate.getTime() && stStart < timelineEnd.getTime();
    });

    // Ưu tiên suất có khách mua vé (bookedSeats > 0) lên trước để luôn nằm ở Lane 0 / Lane 1, sau đó xếp theo thời gian
    const sorted = [...visibleSlots].sort((a, b) => {
      const aBooked = (a.bookedSeats || 0) > 0 ? 1 : 0;
      const bBooked = (b.bookedSeats || 0) > 0 ? 1 : 0;
      if (aBooked !== bBooked) return bBooked - aBooked;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
    const lanes = []; // lưu timestamp kết thúc của từng lane

    const assigned = sorted.map((st) => {
      const stDate = new Date(st.startTime);
      const movie = st.movieId || {};
      const duration = Number(movie.duration) || 120;
      const cleaning = st.cleaningMinutes ?? 15;

      const stStartMs = stDate.getTime();
      const stEndMs = stStartMs + duration * 60000;
      const totalBlockEndMs = stEndMs + cleaning * 60000;

      // Xử lý suất chiếu bắt đầu trước 08:00 sáng (xuyên đêm từ hôm trước)
      const effectiveStartMs = Math.max(stStartMs, baseDate.getTime());
      const isCarryOver = stStartMs < baseDate.getTime();

      const startMinutes = (effectiveStartMs - baseDate.getTime()) / 60000;
      const leftPct = (startMinutes / totalTimelineMinutes) * 100;

      // Độ rộng thực tế hiển thị trên thước đo
      const visibleDurationMinutes = Math.max(15, (Math.min(stEndMs, timelineEnd.getTime()) - effectiveStartMs) / 60000);
      const widthPct = (visibleDurationMinutes / totalTimelineMinutes) * 100;
      const cleanWidthPct = (cleaning / totalTimelineMinutes) * 100;

      // Tìm lane đầu tiên có thời gian kết thúc nhỏ hơn hoặc bằng effectiveStartMs
      let assignedLane = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (effectiveStartMs >= lanes[i]) {
          assignedLane = i;
          lanes[i] = totalBlockEndMs;
          break;
        }
      }
      if (assignedLane === -1) {
        assignedLane = lanes.length;
        lanes.push(totalBlockEndMs);
      }

      return {
        st,
        leftPct,
        widthPct,
        cleanWidthPct,
        duration,
        cleaning,
        lane: assignedLane,
        isCarryOver,
      };
    });

    const totalLanes = Math.max(1, lanes.length);
    return { assigned, totalLanes };
  };

  // Gom nhóm theo Movie cho Chế độ Theo phim
  const groupedByMovie = useMemo(() => {
    const map = new Map();
    for (const st of filteredShowtimes) {
      const m = st.movieId || {};
      const mId = String(m._id || m.id || 'UNKNOWN');
      if (!map.has(mId)) {
        map.set(mId, {
          movie: m,
          showtimes: [],
          totalBooked: 0,
        });
      }
      const entry = map.get(mId);
      entry.showtimes.push(st);
      entry.totalBooked += (st.bookedSeats || 0);
    }

    return Array.from(map.values()).map(entry => {
      // Phân nhóm theo 3 loại phòng: IMAX Laser, Dolby Atmos, Gold Class
      const byType = {
        'IMAX Laser': [],
        'Dolby Atmos': [],
        'Gold Class': [],
      };

      entry.showtimes.forEach(st => {
        const rType = resolveCanonicalRoomType(st);
        if (byType[rType]) {
          byType[rType].push(st);
        } else {
          byType['IMAX Laser'].push(st);
        }
      });

      // Sắp xếp tăng dần theo giờ chiếu trong từng loại phòng
      Object.keys(byType).forEach(key => {
        byType[key].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      });

      return {
        ...entry,
        byType,
      };
    });
  }, [filteredShowtimes]);

  const toggleExpandMovie = (movieId) => {
    setExpandedMovieIds(prev => {
      const next = new Set(prev);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  };

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-100 font-sans">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 flex-1 space-y-5 overflow-y-auto">
          <AdminSectionTabs />

          {/* Header Quản lý */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center text-sm font-bold">
                  MT
                </span>
                <span>Điều phối lịch chiếu</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Quản lý và điều phối suất chiếu theo 9 phòng vật lý tại cụm rạp <strong>D'AVENOR Thanh Khê Plaza</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Nút Tạo suất */}
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-cyan-600/30 cursor-pointer active:scale-95"
              >
                <span>+</span>
                <span>Tạo suất</span>
              </button>

              {/* Nút Xếp lịch hàng loạt */}
              <button
                type="button"
                onClick={() => {
                  setBatchPreview(null);
                  setIsBatchModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95"
              >
                <span>⚡</span>
                <span>Xếp lịch hàng loạt</span>
              </button>
            </div>
          </div>

          {/* Hàng thẻ Thống kê nhanh */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => setQuickFilter('ALL')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                quickFilter === 'ALL'
                  ? 'bg-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span className="text-[11px] text-slate-400 font-medium block">Tổng suất trong ngày</span>
              <div className="text-xl font-black text-white mt-0.5 font-mono">{statsSummary.total}</div>
            </div>

            <div className="p-3 rounded-xl border bg-slate-900/60 border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">Phòng có lịch chiếu</span>
              <div className="text-xl font-black text-cyan-400 mt-0.5 font-mono">
                {statsSummary.activeRoomsCount} <span className="text-xs text-slate-500 font-normal">/ 9 phòng</span>
              </div>
            </div>

            <div
              onClick={() => setQuickFilter(quickFilter === 'CONFLICTS' ? 'ALL' : 'CONFLICTS')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                quickFilter === 'CONFLICTS'
                  ? 'bg-red-950/60 border-red-500 shadow-lg shadow-red-500/20'
                  : statsSummary.conflictsCount > 0
                  ? 'bg-red-950/30 border-red-900/50 hover:border-red-600'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Suất xung đột</span>
                {statsSummary.conflictsCount > 0 && (
                  <span className="text-[10px] font-black text-red-400 bg-red-950 px-1.5 py-0.5 rounded border border-red-800">
                    Lọc xem
                  </span>
                )}
              </div>
              <div className={`text-xl font-black mt-0.5 font-mono ${statsSummary.conflictsCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {statsSummary.conflictsCount}
              </div>
            </div>

            <div
              onClick={() => setQuickFilter(quickFilter === 'MISSING_SEATS' ? 'ALL' : 'MISSING_SEATS')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                quickFilter === 'MISSING_SEATS'
                  ? 'bg-amber-950/60 border-amber-500 shadow-lg shadow-amber-500/20'
                  : statsSummary.missingSeatsCount > 0
                  ? 'bg-amber-950/30 border-amber-900/50 hover:border-amber-600'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Thiếu dữ liệu ghế</span>
                {statsSummary.missingSeatsCount > 0 && (
                  <span className="text-[10px] font-black text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                    Lọc xem
                  </span>
                )}
              </div>
              <div className={`text-xl font-black mt-0.5 font-mono ${statsSummary.missingSeatsCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {statsSummary.missingSeatsCount}
              </div>
            </div>
          </div>

          {/* Thanh điều khiển trung tâm & Switcher 3 chế độ xem */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Điều hướng Ngày chiếu */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleShiftDay(-1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Xem ngày hôm trước"
                >
                  ◀ Trước
                </button>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-xs">
                  <span className="text-slate-400 mr-2 text-[11px] font-semibold">Ngày:</span>
                  <input
                    type="date"
                    value={viewDate}
                    onChange={(e) => setViewDate(e.target.value)}
                    className="bg-transparent text-white font-mono font-bold focus:outline-none cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleShiftDay(1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Xem ngày tiếp theo"
                >
                  Sau ▶
                </button>
                <button
                  type="button"
                  onClick={handleResetToday}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    viewDate === todayStr ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Hôm nay
                </button>
              </div>

              {/* Chế độ xem: Theo phòng (Mặc định) | Theo phim | Danh sách */}
              <div className="flex items-center bg-slate-950 p-1 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('timeline')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'timeline'
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Theo phòng (Timeline)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('movie')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'movie'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Theo phim
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Danh sách
                </button>
              </div>
            </div>

            {/* Hàng bộ lọc: Phim & Loại phòng */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-slate-800/80 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block font-semibold mb-1">Lọc theo phim:</label>
                <select
                  value={filterMovieId}
                  onChange={(e) => setFilterMovieId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">Tất cả phim ({movies.length} phim)</option>
                  {movies.map((m) => (
                    <option key={m.id || m._id} value={m.id || m._id}>
                      {m.title} ({m.duration}’)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block font-semibold mb-1">Lọc theo loại phòng chiếu:</label>
                <select
                  value={filterRoomType}
                  onChange={(e) => setFilterRoomType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">Tất cả loại phòng (9 phòng)</option>
                  <option value="IMAX Laser">IMAX Laser (Phòng 01, 02, 03)</option>
                  <option value="Dolby Atmos">Dolby Atmos (Phòng 04, 05, 06)</option>
                  <option value="Gold Class">Gold Class (Phòng 07, 08, 09)</option>
                </select>
              </div>

              <div className="flex items-end justify-between text-xs text-slate-400 pb-1">
                <div className="flex items-center flex-wrap gap-2">
                  <span>
                    <span className="text-white font-bold">{filteredShowtimes.length}</span> suất chiếu hiển thị
                  </span>
                  {quickFilter !== 'ALL' && (
                    <span className="text-cyan-400 text-[11px] underline cursor-pointer" onClick={() => setQuickFilter('ALL')}>
                      (Xóa lọc)
                    </span>
                  )}
                  {statsSummary.conflictsCount > 0 && quickFilter !== 'HIDE_CONFLICTS' && (
                    <button
                      type="button"
                      onClick={() => setQuickFilter('HIDE_CONFLICTS')}
                      className="text-[11px] text-amber-300 bg-amber-950/80 border border-amber-600/60 hover:bg-amber-900 px-2 py-0.5 rounded font-bold transition-all cursor-pointer shadow-sm"
                      title="Chỉ hiển thị các suất chiếu hợp lệ hoặc đã có khách đặt vé, ẩn các suất trùng ảo do dữ liệu cũ"
                    >
                      🛡️ Ẩn {statsSummary.conflictsCount} suất trùng ảo
                    </button>
                  )}
                  {quickFilter === 'HIDE_CONFLICTS' && (
                    <button
                      type="button"
                      onClick={() => setQuickFilter('ALL')}
                      className="text-[11px] text-cyan-300 bg-cyan-950/80 border border-cyan-600/60 hover:bg-cyan-900 px-2 py-0.5 rounded font-bold transition-all cursor-pointer shadow-sm"
                    >
                      👁️ Xem lại toàn bộ ({showtimes.length} suất)
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span> IMAX
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span> Atmos
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Gold
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500/40 border border-amber-500 inline-block"></span> 15p dọn phòng
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* VÙNG HIỂN THỊ CHÍNH (THEO 3 CHẾ ĐỘ) */}
          {loading ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-16 text-center text-slate-400">
              <span className="inline-block animate-spin mr-2">🔄</span> Đang nạp lịch chiếu từ MongoDB...
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* CHẾ ĐỘ 1: TIMELINE THEO PHÒNG (MULTI-LANE CHỐNG CHỒNG LẤN KHỐI)           */}
              {/* ========================================================================= */}
              {viewMode === 'timeline' && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <div className="min-w-[1280px]">
                      {/* Header trục ngang cố định: 08:00 đến 02:00 sáng hôm sau */}
                      <div className="flex border-b border-slate-800 bg-slate-950 sticky top-0 z-30">
                        {/* Cột tên phòng cố định (rộng 200px) */}
                        <div className="w-52 shrink-0 p-3.5 border-r border-slate-800 font-bold text-xs text-slate-300 uppercase tracking-wider bg-slate-950 sticky left-0 z-40">
                          Phòng chiếu vật lý
                        </div>

                        {/* Thước đo giờ */}
                        <div className="flex-1 flex relative">
                          {timelineHours.map((hour, idx) => {
                            const displayHour = hour >= 24 ? hour - 24 : hour;
                            return (
                              <div
                                key={hour}
                                className="flex-1 text-center py-2.5 text-[11px] font-mono font-semibold text-slate-400 border-r border-slate-800/60 relative"
                              >
                                {String(displayHour).padStart(2, '0')}:00
                                {hour >= 24 && <span className="text-[9px] text-amber-400 block">+1 ngày</span>}
                                {idx < timelineHours.length - 1 && (
                                  <span className="absolute right-1/2 top-4 bottom-0 w-px bg-slate-800/40"></span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Các hàng của 9 phòng vật lý */}
                      <div className="divide-y divide-slate-800/80">
                        {sortedPhysicalRooms
                          .filter(r => filterRoomType === 'ALL' || r.roomType === filterRoomType)
                          .map((room) => {
                            const isImax = room.roomType === 'IMAX Laser';
                            const isAtmos = room.roomType === 'Dolby Atmos';

                            const badgeColor = isImax
                              ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
                              : isAtmos
                              ? 'bg-purple-950/60 text-purple-300 border-purple-500/30'
                              : 'bg-amber-950/60 text-amber-300 border-amber-500/30';

                            // Lấy tất cả showtime thuộc phòng này
                            const roomKey = String(room._id || room.id);
                            const isExpanded = expandedRoomIds.has(roomKey);
                            const roomShowtimes = filteredShowtimes.filter((st) => {
                              const sRoomId = String(st.roomId?._id || st.roomId || '');
                              const matchId = sRoomId && sRoomId === String(room._id || room.id);
                              const matchName = !sRoomId && (st.roomName || '').includes(room.shortName || room.name);
                              return matchId || matchName;
                            });

                            // Áp dụng thuật toán Multi-lane và Collision Collapsing
                            const { assigned, totalLanes } = computeMultiLaneSlots(roomShowtimes);
                            const isCollapsed = totalLanes > 2 && !isExpanded;
                            const renderAssigned = isCollapsed ? assigned.filter((item) => item.lane < 2) : assigned;
                            const collapsedCount = isCollapsed ? assigned.filter((item) => item.lane >= 2).length : 0;
                            const rowHeightPx = isCollapsed ? 136 : Math.max(76, totalLanes * 46 + 10);

                            return (
                              <div
                                key={room._id || room.id}
                                className="flex hover:bg-slate-800/10 transition-colors group relative"
                                style={{ height: `${rowHeightPx}px` }}
                              >
                                {/* Cột thông tin phòng cố định (Sticky Left) */}
                                <div className="w-52 shrink-0 p-3 border-r border-slate-800 bg-slate-950 sticky left-0 z-20 flex flex-col justify-start">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-white bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 font-mono">
                                      Phòng {room.roomNumber ? String(room.roomNumber).padStart(2, '0') : (room.name.match(/\d+/)?.[0] || '01')}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                      {room.roomType}
                                    </span>
                                  </div>
                                  <div className="font-bold text-xs text-slate-200 truncate mt-1.5" title={room.name}>
                                    {room.name.replace(/^Phòng\s*(Phòng\s*)?\d*\s*[-–]\s*/i, '') || room.name}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {room.totalSeats || 88} ghế
                                    </span>
                                    {totalLanes > 1 && (
                                      <span className="text-[9px] font-black text-red-400 bg-red-950 px-1.5 py-0.5 rounded border border-red-800 flex items-center gap-1" title={`Phát hiện ${totalLanes} tầng suất chiếu bị trùng giờ`}>
                                        <span>⚠️</span> {totalLanes} tầng trùng
                                      </span>
                                    )}
                                  </div>
                                  {totalLanes > 2 && isExpanded && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedRoomIds(prev => {
                                          const next = new Set(prev);
                                          next.delete(roomKey);
                                          return next;
                                        });
                                      }}
                                      className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-semibold mt-1 text-left cursor-pointer"
                                    >
                                      ▴ Thu gọn về 2 tầng
                                    </button>
                                  )}
                                </div>

                                {/* Trục thời gian của phòng */}
                                <div
                                  className="flex-1 relative bg-slate-950/20 cursor-pointer overflow-hidden"
                                  onClick={(e) => {
                                    if (e.target === e.currentTarget) {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const clickX = e.clientX - rect.left;
                                      const ratio = clickX / rect.width;
                                      const clickedMinutes = Math.floor(ratio * totalTimelineMinutes) + startHour * 60;
                                      const hour = Math.floor(clickedMinutes / 60);
                                      const minute = Math.floor((clickedMinutes % 60) / 15) * 15;
                                      handleTimelineSlotClick(room, hour, minute);
                                    }
                                  }}
                                  title="Click vào khoảng trống để xếp suất chiếu tại khung giờ này"
                                >
                                  {/* Lưới vạch giờ nền */}
                                  <div className="absolute inset-0 flex pointer-events-none">
                                    {timelineHours.map((h) => (
                                      <div key={h} className="flex-1 border-r border-slate-800/30 h-full"></div>
                                    ))}
                                  </div>

                                  {/* Vạch giờ hiện tại nếu đang xem hôm nay */}
                                  {currentTimeIndicatorLeft !== null && (
                                    <div
                                      style={{ left: `${currentTimeIndicatorLeft}%` }}
                                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                                    ></div>
                                  )}

                                  {/* Thanh Collision Collapsing khi có quá nhiều tầng va chạm */}
                                  {isCollapsed && collapsedCount > 0 && (
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedRoomIds(prev => {
                                          const next = new Set(prev);
                                          next.add(roomKey);
                                          return next;
                                        });
                                      }}
                                      className="absolute left-2 right-2 top-[96px] h-[30px] bg-slate-900/95 hover:bg-slate-800/90 border border-dashed border-amber-500/60 rounded-lg px-3 flex items-center justify-between text-xs text-amber-300 font-bold cursor-pointer transition-all z-20 shadow-md"
                                      title="Bấm để mở rộng toàn bộ các tầng va chạm"
                                    >
                                      <span className="flex items-center gap-2 truncate">
                                        <span className="text-amber-400">⚠️</span>
                                        <span>Đã thu gọn <strong>+{collapsedCount} suất va chạm</strong> (Ưu tiên suất có khách mua vé ở 2 tầng trên)</span>
                                      </span>
                                      <span className="text-cyan-400 hover:text-cyan-300 text-[11px] underline shrink-0 font-bold ml-2">
                                        Mở rộng tất cả {totalLanes} tầng ▾
                                      </span>
                                    </div>
                                  )}

                                  {/* Render các khối suất chiếu được phân bổ lane */}
                                  {renderAssigned.map(({ st, leftPct, widthPct, cleanWidthPct, duration, lane, isCarryOver }) => {
                                    const stDate = new Date(st.startTime);
                                    const movie = st.movieId || {};
                                    const timeStr = stDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                                    const endDate = new Date(stDate.getTime() + duration * 60000);
                                    const endTimeStr = endDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                                    const booked = st.bookedSeats || 0;
                                    const total = st.totalSeats || 88;
                                    const isConflict = st.hasConflict;

                                    const topPx = lane * 46 + 4;

                                    const blockBg = isConflict
                                      ? 'bg-slate-900/95 border-red-500/80 border-dashed text-slate-100 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                                      : isImax
                                      ? 'bg-slate-900/95 border-cyan-500/60 text-cyan-100 shadow-cyan-500/10'
                                      : isAtmos
                                      ? 'bg-slate-900/95 border-purple-500/60 text-purple-100 shadow-purple-500/10'
                                      : 'bg-slate-900/95 border-amber-500/60 text-amber-100 shadow-amber-500/10';

                                    return (
                                      <React.Fragment key={st.id || st._id}>
                                        {/* Khối phim */}
                                        <div
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDrawerShowtimeId(st.id || st._id);
                                          }}
                                          style={{
                                            left: `${Math.max(0, leftPct)}%`,
                                            width: `${Math.max(3.5, widthPct)}%`,
                                            top: `${topPx}px`,
                                            height: '38px',
                                          }}
                                          className={`absolute border rounded-lg px-2 py-0.5 flex flex-col justify-between overflow-hidden shadow-lg hover:brightness-125 transition-all cursor-pointer z-10 group ${blockBg}`}
                                          title={`🎬 ${movie.title || 'Phim'}\n🕒 ${timeStr} – ${endTimeStr} (${duration} phút)\n🎟️ Đã bán: ${booked}/${total} vé\n💰 Giá: ${(st.price || 0).toLocaleString()}đ\n👉 Click để mở chi tiết suất chiếu & sơ đồ ghế`}
                                        >
                                          <div className="flex items-center justify-between gap-1 leading-tight">
                                            <div className="flex items-center gap-1 min-w-0">
                                              {isCarryOver && (
                                                <span className="text-[9px] text-cyan-300 font-bold bg-cyan-950/90 border border-cyan-500/40 px-1 rounded shrink-0">
                                                  Đêm trước
                                                </span>
                                              )}
                                              <span className="font-bold text-[11px] text-white truncate">
                                                {movie.title || 'Suất chiếu'}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {isConflict && (
                                                  <span className="text-[9px] text-red-300 font-black animate-pulse">
                                                    ⚠️
                                                  </span>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRequestDelete(st);
                                                  }}
                                                  className="opacity-0 group-hover:opacity-100 hover:bg-red-500/30 p-0.5 rounded text-red-300 hover:text-white transition-all cursor-pointer"
                                                  title="Xóa / Hủy suất chiếu này"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              </div>
                                          </div>
                                          <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono leading-none">
                                            <span>{timeStr}–{endTimeStr}</span>
                                            <span className={`px-1 rounded text-[9px] font-bold ${booked > 0 ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                              {booked}/{total}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Khối dọn phòng 15 phút ngay sau suất chiếu */}
                                        <div
                                          style={{
                                            left: `${leftPct + widthPct}%`,
                                            width: `${cleanWidthPct}%`,
                                            top: `${topPx + 2}px`,
                                            height: '34px',
                                          }}
                                          className="absolute bg-amber-500/10 border-l border-r border-amber-500/30 flex items-center justify-center text-[8px] text-amber-300 font-bold uppercase tracking-tighter pointer-events-none z-0 rounded-r-md"
                                          title="Thời gian vệ sinh phòng: 15 phút"
                                        >
                                          15p
                                        </div>
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* CHẾ ĐỘ 2: THEO PHIM (SUB-GROUP THEO LOẠI PHÒNG, SẮP XẾP TĂNG DẦN)          */}
              {/* ========================================================================= */}
              {viewMode === 'movie' && (
                <div className="space-y-4">
                  {groupedByMovie.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
                      Không có suất chiếu nào của các bộ phim trong ngày {viewDate}.
                    </div>
                  ) : (
                    groupedByMovie.map(({ movie, byType, totalBooked, showtimes: mShowtimes }) => {
                      const mId = String(movie._id || movie.id || 'UNKNOWN');
                      const isExpanded = expandedMovieIds.has(mId);

                      return (
                        <div
                          key={mId}
                          className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
                        >
                          {/* Header của từng phim (có thể click để thu gọn / mở rộng) */}
                          <div
                            onClick={() => toggleExpandMovie(mId)}
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors border-b border-slate-800/80"
                          >
                            <div className="flex items-center space-x-3.5">
                              {movie.posterUrl && (
                                <img
                                  src={movie.posterUrl}
                                  alt={movie.title}
                                  className="w-10 h-14 object-cover rounded-lg border border-slate-700 shadow"
                                />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-black text-white">{movie.title}</h3>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-500/30">
                                    {movie.ageRating || 'T16'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {movie.duration} phút • {movie.genre || 'Điện ảnh'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-5">
                              <div className="text-right text-xs font-mono">
                                <span className="text-slate-400 block text-[11px]">Suất chiếu:</span>
                                <span className="text-cyan-400 font-bold">{mShowtimes.length} suất</span>
                              </div>
                              <div className="text-right text-xs font-mono border-l border-slate-800 pl-4">
                                <span className="text-slate-400 block text-[11px]">Vé đã bán:</span>
                                <span className="text-emerald-400 font-bold">{totalBooked} vé</span>
                              </div>
                              <span className="text-slate-400 text-xs px-2 py-1 rounded bg-slate-800">
                                {isExpanded ? '▲ Thu gọn' : '▼ Mở rộng'}
                              </span>
                            </div>
                          </div>

                          {/* Danh sách suất chiếu theo 3 nhóm loại phòng */}
                          {isExpanded && (
                            <div className="p-4 space-y-4 bg-slate-950/30">
                              {['IMAX Laser', 'Dolby Atmos', 'Gold Class'].map((typeKey) => {
                                const list = byType[typeKey] || [];
                                if (list.length === 0) return null;

                                const typeTitleColor = typeKey === 'IMAX Laser'
                                  ? 'text-cyan-300 border-cyan-500/30'
                                  : typeKey === 'Dolby Atmos'
                                  ? 'text-purple-300 border-purple-500/30'
                                  : 'text-amber-300 border-amber-500/30';

                                return (
                                  <div key={typeKey} className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-slate-900 ${typeTitleColor}`}>
                                        {typeKey} ({list.length} suất)
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                                      {list.map((st) => {
                                        const stDate = new Date(st.startTime);
                                        const timeStr = stDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                                        const booked = st.bookedSeats || 0;
                                        const total = st.totalSeats || 88;
                                        const isConflict = st.hasConflict;

                                        return (
                                          <div
                                            key={st.id || st._id}
                                            onClick={() => setDrawerShowtimeId(st.id || st._id)}
                                            className={`bg-slate-950 border ${
                                              isConflict
                                                ? 'border-red-500 hover:border-red-400'
                                                : 'border-slate-800 hover:border-slate-600'
                                            } rounded-xl p-2.5 space-y-1.5 hover:bg-slate-800/40 transition-all cursor-pointer shadow-md group relative`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-base font-black text-white font-mono">{timeStr}</span>
                                              <div className="flex items-center gap-1.5">
                                                {isConflict && (
                                                  <span className="text-[9px] font-black text-red-400 bg-red-950 px-1 rounded border border-red-800">
                                                    Trùng
                                                  </span>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRequestDelete(st);
                                                  }}
                                                  className="opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-400 hover:text-red-400 p-1 rounded transition-all cursor-pointer"
                                                  title="Xóa / Hủy suất chiếu"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                            <div className="text-[11px] text-slate-300 truncate" title={st.roomName}>
                                              {st.roomName.replace(/^Phòng\s*(Phòng\s*)?\d*\s*[-–]\s*/i, '') || st.roomName}
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/80">
                                              <span className="font-bold text-amber-400 font-mono">
                                                {(st.price || 0).toLocaleString()}đ
                                              </span>
                                              <span className="font-mono text-slate-400">
                                                {booked}/{total}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* CHẾ ĐỘ 3: DANH SÁCH (TABLE VIEW)                                          */}
              {/* ========================================================================= */}
              {viewMode === 'list' && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  {filteredShowtimes.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs">
                      Không tìm thấy suất chiếu nào phù hợp.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                            <th className="py-3 px-4">Phim</th>
                            <th className="py-3 px-4">Phòng chiếu</th>
                            <th className="py-3 px-4">Thời gian chiếu</th>
                            <th className="py-3 px-4">Giá vé cơ bản</th>
                            <th className="py-3 px-4 text-center">Tỷ lệ lấp đầy</th>
                            <th className="py-3 px-4 text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-slate-200">
                          {filteredShowtimes.map((st) => {
                            const movie = st.movieId || {};
                            const dateObj = new Date(st.startTime);
                            const timeFormatted = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                            const dateFormatted = dateObj.toLocaleDateString('vi-VN', {
                              weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
                            });
                            const booked = st.bookedSeats || 0;
                            const total = st.totalSeats || 88;
                            const percent = Math.round((booked / total) * 100);

                            return (
                              <tr key={st.id || st._id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center space-x-3">
                                    {movie.posterUrl && (
                                      <img
                                        src={movie.posterUrl}
                                        alt=""
                                        className="w-8 h-12 object-cover rounded-md shrink-0 border border-slate-700 shadow"
                                      />
                                    )}
                                    <div>
                                      <span className="font-bold text-white block">{movie.title || 'Phim đã chọn'}</span>
                                      <span className="text-[10px] text-slate-400">
                                        {movie.duration ? `${movie.duration} phút` : ''} • {movie.ageRating || 'P'}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-semibold text-cyan-300 block">{st.roomName}</span>
                                  <span className="text-[10px] text-slate-400">{st.formatFeature}</span>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <div className="font-mono font-bold text-white text-sm">{timeFormatted}</div>
                                  <div className="text-[10px] text-slate-400 capitalize">{dateFormatted}</div>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                                  <div className="flex items-center space-x-1.5">
                                    <span>{(st.price || 0).toLocaleString()} đ</span>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickEditPrice(st)}
                                      className="text-slate-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
                                      title="Sửa giá nhanh"
                                    >
                                      ✏️
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="inline-block text-center">
                                    <span className="font-mono text-xs font-bold text-slate-200">
                                      {booked} / {total} ghế
                                    </span>
                                    <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1 mx-auto">
                                      <div
                                        className={`h-full ${percent > 70 ? 'bg-red-500' : percent > 40 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                        style={{ width: `${percent}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setDrawerShowtimeId(st.id || st._id)}
                                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                      title="Xem sơ đồ 88 ghế & vé đã bán"
                                    >
                                      Chi tiết
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRequestDelete(st)}
                                      className="px-2.5 py-1 bg-red-950/70 hover:bg-red-900 text-red-300 hover:text-white border border-red-800/50 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                      title="Xóa hoặc hủy suất chiếu"
                                    >
                                      <Trash2 className="w-3 h-3 text-red-400" />
                                      <span>Xóa</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* DRAWER CHI TIẾT SUẤT CHIẾU & SƠ ĐỒ 88 GHẾ                                 */}
          {/* ========================================================================= */}
          {drawerShowtimeId && (
            <ShowtimeDetailDrawer
              showtimeId={drawerShowtimeId}
              onClose={() => setDrawerShowtimeId(null)}
              onRequestDelete={handleRequestDelete}
            />
          )}

          {/* ========================================================================= */}
          {/* MODAL TẠO SUẤT CHIẾU MỚI (HOLOGRAPHIC DARK NAVY THEME)                   */}
          {/* ========================================================================= */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-[#101728] border border-cyan-500/20 w-full max-w-[720px] rounded-[22px] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-[#F1F5F9]">
                {/* 1. Tiêu đề và nút đóng */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#080E1D] border border-[#79D9F5]/30 flex items-center justify-center text-[#79D9F5] shadow-inner">
                      <CalendarPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#F1F5F9] tracking-tight">Tạo suất chiếu mới</h3>
                      <p className="text-xs text-[#94A3B8]">Thiết lập lịch chiếu cho phòng vật lý</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-8 h-8 rounded-xl bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-[#F1F5F9] flex items-center justify-center transition-colors cursor-pointer border border-slate-700/40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* ── Segmented Control: Một ngày / Lặp lịch chiếu ── */}
                <div className="flex rounded-xl overflow-hidden border border-slate-700/60 bg-[#080E1D] p-0.5 gap-0.5">
                  {[{ key: 'single', label: 'Một ngày' }, { key: 'recurring', label: '🔁 Lặp lịch chiếu' }].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setCreateMode(key); setRecurringPreview(null); }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        createMode === key
                          ? 'bg-[#078CA8] text-[#F1F5F9] shadow-sm'
                          : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#192337]/60'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCreateShowtime} className="space-y-4 text-xs">
                  {/* 2. Movie Selection Card */}
                  <div className="space-y-1.5">
                    <label className="block text-[#94A3B8] font-semibold text-xs">Bộ phim trình chiếu *</label>
                    <div className="relative">
                      {/* Thẻ hiển thị phim đang chọn */}
                      <div
                        onClick={() => setIsMoviePickerOpen(!isMoviePickerOpen)}
                        className="bg-[#192337] hover:bg-[#1e2a42] border border-slate-700/70 hover:border-[#79D9F5]/50 rounded-xl p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-all shadow-sm group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedMovie?.poster || selectedMovie?.posterUrl ? (
                            <img
                              src={selectedMovie.poster || selectedMovie.posterUrl}
                              alt={selectedMovie.title}
                              className="w-11 h-16 object-cover rounded-lg border border-slate-700/80 shrink-0 shadow"
                            />
                          ) : (
                            <div className="w-11 h-16 bg-[#080E1D] border border-slate-800 rounded-lg flex items-center justify-center text-[#79D9F5] shrink-0">
                              <Film className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-[#F1F5F9] truncate group-hover:text-[#79D9F5] transition-colors">
                                {selectedMovie?.title || 'Chọn bộ phim'}
                              </h4>
                              {selectedMovie?.ageRating && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                                  {selectedMovie.ageRating}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                              <span>⏱️ {selectedMovie?.duration || 120} phút</span>
                              <span>•</span>
                              <span className="truncate">{selectedMovie?.genre || 'Điện ảnh cao cấp'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-1 rounded-lg bg-[#080E1D] border border-slate-700/60 text-[#94A3B8] group-hover:text-[#79D9F5] shrink-0">
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMoviePickerOpen ? 'rotate-180 text-[#79D9F5]' : ''}`} />
                        </div>
                      </div>

                      {/* Dropdown danh sách phim có thanh tìm kiếm */}
                      {isMoviePickerOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-[#101728] border border-slate-700 rounded-xl p-2.5 shadow-2xl space-y-2 animate-fadeIn">
                          <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                            <input
                              type="text"
                              placeholder="Tìm kiếm phim theo tên hoặc thể loại..."
                              value={movieSearchKeyword}
                              onChange={(e) => setMovieSearchKeyword(e.target.value)}
                              className="w-full bg-[#080E1D] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#79D9F5]"
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {movies
                              .filter(m => (m.title || '').toLowerCase().includes(movieSearchKeyword.toLowerCase()) || (m.genre || '').toLowerCase().includes(movieSearchKeyword.toLowerCase()))
                              .map(m => {
                                const isSel = String(m.id || m._id) === String(formData.movieId);
                                return (
                                  <div
                                    key={m.id || m._id}
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        movieId: m.id || m._id,
                                        price: resolveSuggestedPrice(prev.roomName, prev.startTime, pricingConfig)
                                      }));
                                      setIsMoviePickerOpen(false);
                                      setMovieSearchKeyword('');
                                    }}
                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                      isSel ? 'bg-[#192337] border border-[#79D9F5]/40 text-[#79D9F5]' : 'hover:bg-[#192337]/60 text-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <img
                                        src={m.poster || m.posterUrl}
                                        alt={m.title}
                                        className="w-7 h-10 object-cover rounded border border-slate-800 shrink-0"
                                      />
                                      <div className="truncate">
                                        <span className="text-xs font-bold block truncate">{m.title}</span>
                                        <span className="text-[10px] text-slate-400">{m.duration} phút • {m.ageRating || 'P'}</span>
                                      </div>
                                    </div>
                                    {isSel && <Check className="w-4 h-4 text-[#79D9F5] shrink-0" />}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Phòng chiếu và định dạng phim (2 Cột) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[#94A3B8] font-semibold text-xs">Phòng chiếu vật lý *</label>
                        {selectedRoom && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoomTypeTheme(selectedRoom.roomType).borderColor} ${getRoomTypeTheme(selectedRoom.roomType).bgColor} ${getRoomTypeTheme(selectedRoom.roomType).textColor}`}>
                            {selectedRoom.roomType || 'Tiêu chuẩn'}
                          </span>
                        )}
                      </div>
                      <select
                        value={formData.roomId}
                        onChange={(e) => {
                          const r = rooms.find(item => String(item.id || item._id) === e.target.value);
                          const compFormats = getCompatibleFormats(selectedMovie, r);
                          setSelectedFormat(compFormats[0] || '2D Tiêu chuẩn');
                          setFormData(prev => ({
                            ...prev,
                            roomId: e.target.value,
                            roomName: r?.name || '',
                            price: resolveSuggestedPrice(r?.name, prev.startTime, pricingConfig),
                          }));
                        }}
                        required
                        className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                      >
                        {rooms.filter(room => room.status === 'ACTIVE').map(room => (
                          <option key={room.id || room._id} value={room.id || room._id}>
                            {formatRoomDisplayName(room)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#94A3B8] font-semibold text-xs mb-1">Định dạng phim *</label>
                      <select
                        value={selectedFormat || getCompatibleFormats(selectedMovie, selectedRoom)[0] || '2D Tiêu chuẩn'}
                        onChange={(e) => setSelectedFormat(e.target.value)}
                        className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                      >
                        {getCompatibleFormats(selectedMovie, selectedRoom).map(fmt => (
                          <option key={fmt} value={fmt}>{fmt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ══ RECURRING MODE UI ══════════════════════════════════════════════════════ */}
                  {createMode === 'recurring' && (
                    <div className="space-y-3 text-xs">

                      {/* Date range */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#94A3B8] font-semibold text-xs mb-1">Từ ngày *</label>
                          <input
                            type="date"
                            value={recurringData.startDate || viewDate}
                            onChange={e => { setRecurringData(p => ({ ...p, startDate: e.target.value })); setRecurringPreview(null); }}
                            className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-[#94A3B8] font-semibold text-xs mb-1">Đến ngày *</label>
                          <input
                            type="date"
                            value={recurringData.endDate || viewDate}
                            onChange={e => { setRecurringData(p => ({ ...p, endDate: e.target.value })); setRecurringPreview(null); }}
                            className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Quick range picks */}
                      <div className="flex flex-wrap gap-1.5">
                        {[7, 14, 30].map(d => (
                          <button key={d} type="button" onClick={() => handleRecurringQuickRange(d)}
                            className="px-3 py-1.5 bg-[#192337] hover:bg-[#202d46] border border-slate-700/60 text-[#79D9F5] rounded-xl text-[11px] font-bold cursor-pointer transition-colors">
                            {d} ngày
                          </button>
                        ))}
                        <button type="button" onClick={handleRecurringEndOfMonth}
                          className="px-3 py-1.5 bg-[#192337] hover:bg-[#202d46] border border-slate-700/60 text-[#79D9F5] rounded-xl text-[11px] font-bold cursor-pointer transition-colors">
                          Đến cuối tháng
                        </button>
                      </div>

                      {/* Day of week selector */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[#94A3B8] font-semibold text-xs">Ngày trong tuần</span>
                          <div className="flex gap-1.5">
                            {[{ label: 'Cả tuần', days: [0,1,2,3,4,5,6] }, { label: 'T2–T6', days: [1,2,3,4,5] }, { label: 'T7–CN', days: [0,6] }].map(({ label, days }) => (
                              <button key={label} type="button"
                                onClick={() => { setRecurringData(p => ({ ...p, daysOfWeek: days })); setRecurringPreview(null); }}
                                className="text-[10px] px-2 py-0.5 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-[#79D9F5] border border-slate-700/40 rounded-lg cursor-pointer transition-colors">
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {recurringDayLabels.map(({ label, value }) => {
                            const sel = recurringData.daysOfWeek.includes(value);
                            return (
                              <button key={value} type="button" onClick={() => toggleDayOfWeek(value)}
                                className={`w-10 h-10 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                                  sel ? 'bg-[#078CA8] text-[#F1F5F9] border-[#79D9F5]/60 shadow-sm' : 'bg-[#080E1D] text-[#94A3B8] border-slate-700/60 hover:border-[#79D9F5]/40 hover:text-[#F1F5F9]'
                                }`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Multi-slot time selector */}
                      <div>
                        <label className="block text-[#94A3B8] font-semibold text-xs mb-2">Khung giờ chiếu</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {['08:00','09:30','10:00','11:30','13:00','14:00','15:30','16:30','18:00','19:00','20:30','21:30','22:00'].map(t => {
                            const sel = recurringData.timeSlots.includes(t);
                            return (
                              <button key={t} type="button" onClick={() => toggleRecurringSlot(t)}
                                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border cursor-pointer transition-all ${
                                  sel ? 'bg-[#078CA8] text-white border-[#79D9F5] shadow-sm' : 'bg-[#080E1D] text-[#79D9F5] border-slate-700/60 hover:border-[#79D9F5]/60 hover:bg-[#192337]'
                                }`}>
                                {t}
                              </button>
                            );
                          })}
                        </div>
                        {/* Manual time input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="HH:mm"
                            value={recurringData.manualTimeInput}
                            onChange={e => setRecurringData(p => ({ ...p, manualTimeInput: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualTimeSlot(); } }}
                            className="flex-1 bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] placeholder-slate-600"
                            maxLength={5}
                          />
                          <button type="button" onClick={addManualTimeSlot}
                            className="px-3 py-2 bg-[#192337] hover:bg-[#202d46] text-[#79D9F5] border border-slate-700/60 rounded-xl text-xs font-bold cursor-pointer transition-colors">
                            + Thêm giờ
                          </button>
                        </div>
                        {/* Selected slots summary */}
                        {recurringData.timeSlots.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {recurringData.timeSlots.map(t => (
                              <span key={t} className="flex items-center gap-1 px-2 py-1 bg-[#192337] border border-[#79D9F5]/30 rounded-lg text-[11px] font-mono text-[#79D9F5]">
                                {t}
                                <button type="button" onClick={() => toggleRecurringSlot(t)}
                                  className="text-[#94A3B8] hover:text-rose-400 cursor-pointer transition-colors ml-0.5">
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pricing mode */}
                      <div className="flex items-center justify-between bg-[#080E1D] border border-slate-800 rounded-xl p-3">
                        <span className="text-[#94A3B8] font-semibold">Giá vé:</span>
                        <div className="flex items-center gap-3">
                          <div className="flex rounded-lg overflow-hidden border border-slate-700/60 bg-[#192337] p-0.5 gap-0.5">
                            {[{ key: 'fixed', label: 'Cố định' }, { key: 'auto', label: 'Tự động' }].map(({ key, label }) => (
                              <button key={key} type="button"
                                onClick={() => setRecurringData(p => ({ ...p, pricingMode: key }))}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                  recurringData.pricingMode === key
                                    ? 'bg-[#078CA8] text-white' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                                }`}>
                                {label}
                              </button>
                            ))}
                          </div>
                          {recurringData.pricingMode === 'fixed' && (
                            <div className="flex items-center gap-1">
                              <input type="number" step="5000" min="0" value={formData.price}
                                onChange={e => setFormData(p => ({ ...p, price: Number(e.target.value) }))}
                                className="w-24 bg-[#192337] border border-slate-700 rounded-lg px-2 py-1 text-right text-[#F1F5F9] font-mono font-bold text-xs focus:outline-none focus:border-[#79D9F5]"
                              />
                              <span className="text-[#79D9F5] font-bold">₫</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Summary card */}
                      <div className="bg-[#192337] border border-[#79D9F5]/20 rounded-xl px-4 py-3 flex items-center justify-between">
                        <span className="text-[#94A3B8] text-xs">Dự kiến tạo:</span>
                        <span className="text-[#79D9F5] font-bold text-sm">
                          {recurringData.timeSlots.length > 0 && recurringData.daysOfWeek.length > 0
                            ? `${recurringExpectedCount} suất chiếu`
                            : '—'}
                        </span>
                      </div>

                      {/* Preview button */}
                      <button
                        type="button"
                        onClick={handleRecurringPreview}
                        disabled={recurringLoading || recurringData.timeSlots.length === 0 || recurringData.daysOfWeek.length === 0}
                        className="w-full py-2.5 bg-[#192337] hover:bg-[#202d46] disabled:opacity-40 disabled:cursor-not-allowed border border-[#79D9F5]/40 hover:border-[#79D9F5] text-[#79D9F5] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {recurringLoading ? (
                          <><span className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" /><span>Đang kiểm tra...</span></>
                        ) : '🔍 Kiểm tra & Xem trước lịch chiếu'}
                      </button>

                      {/* Preview table */}
                      {recurringPreview && (
                        <div className="space-y-2">
                          {/* Filter + summary */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex gap-1.5">
                              {[
                                { key: 'ALL', label: `Tất cả (${recurringPreview.totalExpected})` },
                                { key: 'VALID', label: `Hợp lệ (${recurringPreview.validCount})` },
                                { key: 'CONFLICT', label: `Xung đột (${recurringPreview.conflictCount})` },
                              ].map(({ key, label }) => (
                                <button key={key} type="button" onClick={() => setPreviewFilter(key)}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-all ${
                                    previewFilter === key
                                      ? 'bg-[#078CA8] text-white border-[#79D9F5]/60'
                                      : 'bg-[#080E1D] text-[#94A3B8] border-slate-700/60 hover:text-[#F1F5F9]'
                                  }`}>
                                  {label}
                                </button>
                              ))}
                            </div>
                            <span className="text-[#94A3B8] text-[11px]">
                              Hợp lệ: <span className="text-emerald-400 font-bold">{recurringPreview.validCount - previewRemovedKeys.size}</span> suất
                            </span>
                          </div>

                          {/* Table */}
                          <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl bg-[#080E1D]">
                            <table className="w-full text-[11px]">
                              <thead className="sticky top-0 bg-[#101728] border-b border-slate-800">
                                <tr>
                                  {['Ngày', 'Thứ', 'Giờ BD', 'Giờ KT', 'Phòng sẵn sàng', 'Giá', 'Trạng thái'].map(h => (
                                    <th key={h} className="px-2 py-2 text-left text-[#94A3B8] font-semibold">{h}</th>
                                  ))}
                                  <th className="px-2 py-2"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...(recurringPreview.validSlots || []), ...(recurringPreview.conflictSlots || [])]
                                  .filter(s => previewFilter === 'ALL' || s.status === previewFilter)
                                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                  .map((s, i) => {
                                    const key = s.startTime + s.roomId;
                                    const removed = previewRemovedKeys.has(key);
                                    const isConflict = s.status === 'CONFLICT';
                                    const dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
                                    const toLocalTime = (iso) => iso
                                      ? new Date(iso).toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
                                      : '—';
                                    return (
                                      <tr key={i}
                                        className={`border-b border-slate-800/60 ${
                                          removed ? 'opacity-30 line-through' :
                                          isConflict ? 'bg-rose-500/5' : 'hover:bg-[#192337]/30'
                                        }`}>
                                        <td className="px-2 py-1.5 font-mono text-[#F1F5F9]">{s.date}</td>
                                        <td className="px-2 py-1.5 text-[#94A3B8]">{dayNames[s.dayOfWeek]}</td>
                                        <td className="px-2 py-1.5 font-mono text-[#79D9F5]">{toLocalTime(s.startTime)}</td>
                                        <td className="px-2 py-1.5 font-mono text-[#E5C07B]">{toLocalTime(s.endTime)}</td>
                                        <td className="px-2 py-1.5 font-mono text-[#34D399]">{toLocalTime(s.cleanReadyTime)}</td>
                                        <td className="px-2 py-1.5 text-[#F1F5F9]">{s.price ? (s.price / 1000).toFixed(0) + 'k' : '—'}</td>
                                        <td className="px-2 py-1.5">
                                          {isConflict
                                            ? <span className="text-rose-400 font-bold">⚠ {s.conflictReason || 'Xung đột'}</span>
                                            : <span className="text-emerald-400 font-bold">✓ Hợp lệ</span>
                                          }
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {!isConflict && (
                                            <button type="button"
                                              onClick={() => setPreviewRemovedKeys(prev => {
                                                const next = new Set(prev);
                                                if (next.has(key)) next.delete(key); else next.add(key);
                                                return next;
                                              })}
                                              className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer border transition-colors ${
                                                removed
                                                  ? 'text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10'
                                                  : 'text-rose-400 border-rose-500/40 hover:bg-rose-500/10'
                                              }`}>
                                              {removed ? '↩ Khôi phục' : '× Bỏ'}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ══ SINGLE MODE — Date/Time and below ══════════════════════════════════════ */}
                  {createMode === 'single' && (<>
                  {/* 4. Ngày chiếu và giờ bắt đầu (2 Cột tách biệt, 24 giờ) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#94A3B8] font-semibold text-xs mb-1">Ngày chiếu *</label>
                      <input
                        type="date"
                        required
                        value={formDate}
                        onChange={(e) => handleFormDateChange(e.target.value)}
                        className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[#94A3B8] font-semibold text-xs mb-1">Giờ bắt đầu (24 giờ) *</label>
                      <input
                        type="time"
                        step="900"
                        required
                        value={formTime}
                        onChange={(e) => handleFormTimeChange(e.target.value)}
                        className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* 5. Khung giờ khả dụng (Grid 6 cột, scroll riêng) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#79D9F5] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#79D9F5]" />
                        <span>Khung giờ khả dụng</span>
                      </span>
                      {slotsLoading && <span className="text-[#94A3B8] text-[11px] animate-pulse">Đang quét giờ trống...</span>}
                    </div>

                    {availableSlots.length > 0 ? (
                      <div className="max-h-[160px] overflow-y-auto p-1 border border-slate-800/80 bg-[#080E1D]/60 rounded-xl">
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {availableSlots.map((slot) => {
                            const isChosen = formTime === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => handleFormTimeChange(slot)}
                                className={`py-2 px-1 text-center rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                                  isChosen
                                    ? 'bg-[#078CA8] text-white border-[#79D9F5] shadow-sm'
                                    : 'bg-[#192337] text-[#79D9F5] border-slate-700/60 hover:border-[#79D9F5]/60 hover:bg-[#202d46]'
                                }`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#192337]/50 border border-slate-800 rounded-xl p-3 text-center text-xs text-[#94A3B8]">
                        {slotsLoading
                          ? 'Đang kiểm tra dữ liệu khung giờ...'
                          : alternativeRooms.length > 0
                          ? `Phòng này đã hết khung giờ trống. Gợi ý đổi sang: ${alternativeRooms.map(r => formatRoomDisplayName(r)).join(', ')}`
                          : 'Chưa có khung giờ phù hợp hoặc phòng đã kín lịch. Vui lòng chọn ngày khác.'}
                      </div>
                    )}
                  </div>

                  {/* 6. Bốn thẻ tóm tắt thời gian (Bắt đầu - Kết thúc - Vệ sinh - Phòng sẵn sàng) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-[#192337] border border-slate-700/50 rounded-xl p-2.5 text-center space-y-0.5 shadow-sm">
                      <span className="block text-[#94A3B8] text-[10px] font-medium uppercase tracking-wider">Bắt đầu</span>
                      <span className="text-xs font-mono font-bold text-[#79D9F5]">{timeSummary.startTime}</span>
                    </div>

                    <div className="bg-[#192337] border border-slate-700/50 rounded-xl p-2.5 text-center space-y-0.5 shadow-sm">
                      <span className="block text-[#94A3B8] text-[10px] font-medium uppercase tracking-wider">Kết thúc</span>
                      <span className="text-xs font-mono font-bold text-[#E5C07B]">
                        {timeSummary.endTime.str}
                        {timeSummary.endTime.isNext && <span className="text-[10px] ml-1 opacity-80">(+1 ngày)</span>}
                      </span>
                    </div>

                    <div className="bg-[#192337] border border-slate-700/50 rounded-xl p-2.5 text-center space-y-0.5 shadow-sm">
                      <span className="block text-[#94A3B8] text-[10px] font-medium uppercase tracking-wider">Vệ sinh</span>
                      <span className="text-xs font-mono font-bold text-[#CBD5E1]">{timeSummary.cleaningTime}</span>
                    </div>

                    <div className="bg-[#192337] border border-slate-700/50 rounded-xl p-2.5 text-center space-y-0.5 shadow-sm">
                      <span className="block text-[#94A3B8] text-[10px] font-medium uppercase tracking-wider">Phòng sẵn sàng</span>
                      <span className="text-xs font-mono font-bold text-[#34D399]">
                        {timeSummary.readyTime.str}
                        {timeSummary.readyTime.isNext && <span className="text-[10px] ml-1 opacity-80">(+1 ngày)</span>}
                      </span>
                    </div>
                  </div>

                  {/* 7. Khối thông tin bổ sung: Giá vé, Ngày mở bán, Kiểm tra xung đột */}
                  <div className="bg-[#080E1D] border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
                    {/* Dòng 1: Giá vé cơ bản */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                      <span className="text-[#94A3B8] font-medium">Giá vé cơ bản:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="5000"
                          min="0"
                          value={formData.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                          className="w-28 bg-[#192337] border border-slate-700 rounded-lg px-2.5 py-1 text-right text-[#F1F5F9] font-mono font-bold text-xs focus:outline-none focus:border-[#79D9F5]"
                        />
                        <span className="text-[#79D9F5] font-bold">₫</span>
                      </div>
                    </div>

                    {/* Dòng 2: Ngày mở bán */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                      <span className="text-[#94A3B8] font-medium">Ngày mở bán:</span>
                      <span className={`font-semibold text-xs ${
                        openSaleInfo.tone === 'success' ? 'text-emerald-400' :
                        openSaleInfo.tone === 'info' ? 'text-[#79D9F5]' :
                        openSaleInfo.tone === 'danger' ? 'text-rose-400' : 'text-[#94A3B8]'
                      }`}>
                        {openSaleInfo.text}
                      </span>
                    </div>

                    {/* Dòng 3: Kiểm tra xung đột */}
                    <div className="flex items-center justify-between">
                      <span className="text-[#94A3B8] font-medium">Kiểm tra xung đột:</span>
                      <span className={`font-bold text-xs flex items-center gap-1.5 ${
                        conflictStatus.tone === 'success' ? 'text-emerald-400' :
                        conflictStatus.tone === 'danger' ? 'text-rose-400' :
                        conflictStatus.tone === 'warning' ? 'text-amber-400' : 'text-[#94A3B8]'
                      }`}>
                        {conflictStatus.tone === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {(conflictStatus.tone === 'danger' || conflictStatus.tone === 'warning') && <AlertTriangle className="w-3.5 h-3.5" />}
                        <span>{conflictStatus.text}</span>
                      </span>
                    </div>
                  </div>

                  </>)}

                  {/* 8. Nút Hủy bỏ và Tạo suất chiếu */}
                  {createMode === 'single' && (<>
                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-[#F1F5F9] rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700/40"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingShowtime || conflictStatus.tone === 'danger' || !formData.movieId || !formData.roomId || !formData.startTime}
                      className="px-5 py-2 bg-[#078CA8] hover:bg-[#067a93] disabled:opacity-40 disabled:cursor-not-allowed text-[#F1F5F9] rounded-xl text-xs font-bold transition-all shadow-md shadow-[#078CA8]/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingShowtime ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Đang tạo suất...</span>
                        </>
                      ) : (
                        <span>Tạo suất chiếu</span>
                      )}
                    </button>
                  </div>
                  </>)}

                  {/* Recurring footer */}
                  {createMode === 'recurring' && (
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
                      <button type="button" onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-[#F1F5F9] rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700/40">
                        Hủy bỏ
                      </button>
                      {recurringPreview && (
                        <button type="button" onClick={() => { setRecurringPreview(null); setPreviewRemovedKeys(new Set()); }}
                          className="px-4 py-2 bg-[#192337] hover:bg-[#202d46] border border-slate-700/40 text-[#94A3B8] hover:text-[#F1F5F9] rounded-xl text-xs font-semibold cursor-pointer transition-colors">
                          ← Quay lại
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleRecurringCommit}
                        disabled={recurringCommitting || !recurringPreview || (recurringPreview.validCount - previewRemovedKeys.size) === 0}
                        className="px-5 py-2 bg-[#078CA8] hover:bg-[#067a93] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
                        {recurringCommitting
                          ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Đang tạo...</span></>
                          : recurringPreview
                            ? `Xác nhận tạo ${recurringPreview.validCount - previewRemovedKeys.size} suất hợp lệ`
                            : 'Kiểm tra trước'}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL LÊN LỊCH CHIẾU HÀNG LOẠT (CÓ BƯỚC PREVIEW XEM TRƯỚC)                */}
          {/* ========================================================================= */}
          {isBatchModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>⚡</span>
                      <span>Lên Lịch Chiếu Hàng Loạt Thông Minh</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tự động phân bổ suất chiếu cho 9 phòng vật lý, chống trùng lịch và tạo đủ 88 ghế ngồi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBatchModalOpen(false)}
                    className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Khoảng ngày */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Từ ngày *</label>
                      <input
                        type="date"
                        value={batchData.startDate}
                        onChange={(e) => setBatchData({ ...batchData, startDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Đến ngày *</label>
                      <input
                        type="date"
                        value={batchData.endDate}
                        onChange={(e) => setBatchData({ ...batchData, endDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Chọn phim */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Chọn các phim luân phiên chiếu ({batchData.selectedMovieIds.length} phim đã chọn):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      {movies.map((m) => {
                        const isSelected = batchData.selectedMovieIds.includes(m.id || m._id);
                        return (
                          <div
                            key={m.id || m._id}
                            onClick={() => {
                              const exists = batchData.selectedMovieIds.includes(m.id || m._id);
                              setBatchData(prev => ({
                                ...prev,
                                selectedMovieIds: exists
                                  ? prev.selectedMovieIds.filter(id => id !== (m.id || m._id))
                                  : [...prev.selectedMovieIds, (m.id || m._id)],
                              }));
                            }}
                            className={`p-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all flex items-center space-x-2 ${
                              isSelected
                                ? 'bg-cyan-950/80 border-cyan-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>{isSelected ? '☑' : '☐'}</span>
                            <span className="truncate">{m.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chọn phòng vật lý */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Chọn các phòng chiếu ({batchData.roomIds.length} phòng đã chọn):
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {sortedPhysicalRooms.map((r) => {
                        const isSelected = batchData.roomIds.includes(r.id || r._id);
                        return (
                          <div
                            key={r.id || r._id}
                            onClick={() => {
                              const exists = batchData.roomIds.includes(r.id || r._id);
                              setBatchData(prev => ({
                                ...prev,
                                roomIds: exists
                                  ? prev.roomIds.filter(id => id !== (r.id || r._id))
                                  : [...prev.roomIds, (r.id || r._id)],
                              }));
                            }}
                            className={`p-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all flex items-center space-x-1.5 ${
                              isSelected
                                ? 'bg-indigo-950/80 border-indigo-500 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>{isSelected ? '☑' : '☐'}</span>
                            <span className="truncate">{r.name.replace(/Phòng \d+ - /, '')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Khung giờ mặc định */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Các khung giờ bắt đầu trong ngày (chuẩn 15 phút):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['09:00', '11:30', '14:00', '16:30', '19:00', '21:30'].map((slot) => (
                        <span
                          key={slot}
                          className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono font-bold text-cyan-300"
                        >
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Vùng kết quả Xem trước (Preview) */}
                  {batchPreview && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span>📊</span>
                          <span>Kết quả kiểm tra xem trước:</span>
                        </span>
                        <div className="flex items-center space-x-3 font-mono font-bold">
                          <span className="text-emerald-400">✓ {batchPreview.validCount} suất hợp lệ</span>
                          {batchPreview.conflictCount > 0 && (
                            <span className="text-red-400">✗ {batchPreview.conflictCount} suất bị trùng</span>
                          )}
                        </div>
                      </div>

                      {batchPreview.conflictCount > 0 && (
                        <div className="bg-red-950/40 border border-red-800/40 rounded-lg p-2 max-h-24 overflow-y-auto text-[11px] text-red-300 space-y-1 font-mono">
                          {batchPreview.conflictSlots.slice(0, 5).map((c, i) => (
                            <div key={i}>
                              • [{c.date} {c.time}] {c.roomName}: {c.reason}
                            </div>
                          ))}
                          {batchPreview.conflictSlots.length > 5 && (
                            <div>... và {batchPreview.conflictSlots.length - 5} ca khác</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Các nút hành động */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handlePreviewBatch}
                      disabled={batchLoading}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {batchLoading ? <span className="animate-spin">🔄</span> : <span>🔍</span>}
                      <span>Xem trước lịch dự kiến (Preview)</span>
                    </button>

                    <div className="flex items-center space-x-2.5">
                      <button
                        type="button"
                        onClick={() => setIsBatchModalOpen(false)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Đóng
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteBatchSchedule}
                        disabled={batchLoading}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                      >
                        {batchLoading ? 'Đang tạo...' : 'Xác nhận tạo lịch chiếu'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL XÁC NHẬN XÓA / HỦY SUẤT CHIẾU (HOLOGRAPHIC DARK NAVY THEME)        */}
          {/* ========================================================================= */}
          {showtimeToDelete && (() => {
            const st = showtimeToDelete;
            const movie = st.movieId || {};
            const dateObj = new Date(st.startTime);
            const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const dateStr = dateObj.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
            const duration = movie.duration || 120;
            const endObj = st.endTime ? new Date(st.endTime) : new Date(dateObj.getTime() + duration * 60000);
            const endTimeStr = endObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const booked = st.bookedSeats || 0;
            const total = st.totalSeats || 88;
            const isZeroBooked = booked === 0;

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-fadeIn">
                <div className="bg-[#101728] border border-red-500/30 w-full max-w-[560px] rounded-[24px] p-6 shadow-2xl space-y-5 text-[#F1F5F9]">
                  {/* Tiêu đề modal */}
                  <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-red-950/50 border border-red-500/40 flex items-center justify-center text-red-400 shadow-inner">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-wide">
                          {isZeroBooked ? 'Xác nhận xóa hoàn toàn suất chiếu' : 'Xác nhận hủy suất chiếu & hoàn tiền'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Kiểm tra kỹ thông tin suất chiếu trước khi thực hiện thao tác
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setShowtimeToDelete(null)}
                      className="w-8 h-8 rounded-full bg-[#080E1D] hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm transition-all"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Thẻ tóm tắt thông tin suất chiếu */}
                  <div className="bg-[#192337] border border-slate-700/60 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3.5">
                      {movie.posterUrl && (
                        <img
                          src={movie.posterUrl}
                          alt=""
                          className="w-12 h-16 object-cover rounded-xl border border-slate-700 shadow shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white text-base truncate">{movie.title || 'Phim đã chọn'}</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-500/30 shrink-0">
                            {movie.ageRating || 'P'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {duration} phút • {movie.genre || 'Điện ảnh'}
                        </p>
                        <p className="text-xs text-cyan-300 font-semibold mt-1">
                          {st.roomName} {st.formatFeature ? `(${st.formatFeature})` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50 text-xs">
                      <div className="bg-[#080E1D] rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Thời gian chiếu</span>
                        <span className="text-white font-mono font-bold block mt-0.5">
                          {timeStr} – {endTimeStr}
                        </span>
                        <span className="text-[10px] text-slate-400 capitalize block mt-0.5">{dateStr}</span>
                      </div>
                      <div className="bg-[#080E1D] rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Tình trạng vé</span>
                        <span className={`font-mono font-bold block mt-0.5 ${booked > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {booked} / {total} ghế đã đặt
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {booked > 0 ? 'Đã có khách mua' : 'Chưa bán vé nào'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hộp thông báo kịch bản xử lý */}
                  {isZeroBooked ? (
                    <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-200">
                      <span className="text-lg shrink-0">🟢</span>
                      <div className="space-y-1">
                        <p className="font-bold text-emerald-300">Xóa hoàn toàn không để lại rác (Hard Delete):</p>
                        <p className="text-slate-300 leading-relaxed">
                          Suất chiếu này chưa phát sinh bất kỳ đơn đặt vé nào. Hệ thống sẽ xóa vĩnh viễn suất chiếu và giải phóng toàn bộ 88 ghế trong phòng chiếu, đưa phòng về trạng thái hoàn toàn trống để sẵn sàng xếp lịch mới.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-200">
                      <span className="text-lg shrink-0">⚠️</span>
                      <div className="space-y-1">
                        <p className="font-bold text-amber-300">Hủy suất chiếu & ghi nhận hoàn tiền ({booked} vé):</p>
                        <p className="text-slate-300 leading-relaxed">
                          Suất chiếu đã có đơn hàng của khách. Hệ thống sẽ hủy mềm suất chiếu, tự động chuyển các đơn đặt vé sang trạng thái HỦY và ghi nhận hoàn tiền giả lập (Simulated Refund). Nếu đã có vé check-in vào rạp, thao tác sẽ tự động bị chặn.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Nút hành động */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setShowtimeToDelete(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleConfirmDelete}
                      className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
                        isZeroBooked
                          ? 'bg-red-600 hover:bg-red-500 shadow-red-900/40'
                          : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
                      }`}
                    >
                      {isDeleting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Đang thực hiện xóa...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>{isZeroBooked ? 'Xác nhận xóa hoàn toàn' : 'Xác nhận hủy suất & hoàn tiền'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        </main>
      </div>
    </div>
  );
};

export default ShowtimeManagePage;
