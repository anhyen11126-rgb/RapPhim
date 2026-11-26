import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  // Bộ lọc lịch sử: 'ACTIVE' (Mặc định: UPCOMING, NOW_SHOWING, CLEANING) | 'COMPLETED' | 'CANCELLED' | 'ALL'
  const [historyFilter, setHistoryFilter] = useState('ACTIVE');
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now());

  // Chế độ Chọn xóa suất chiếu hàng loạt (Bulk Select & Delete)
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  const [selectedShowtimeIds, setSelectedShowtimeIds] = useState(() => new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeletePreview, setBulkDeletePreview] = useState(null);
  const [isBulkPreviewLoading, setIsBulkPreviewLoading] = useState(false);
  const [isBulkCommitting, setIsBulkCommitting] = useState(false);
  const [bulkDeleteBanner, setBulkDeleteBanner] = useState(null);

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
  const [isConfirmingBatch, setIsConfirmingBatch] = useState(false);
  const isConfirmingBatchRef = useRef(false);
  const [batchPreview, setBatchPreview] = useState(null);
  const [showtimeToDelete, setShowtimeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Recurring showtime mode ─────────────────────────────────────────────────
  const [createMode, setCreateMode] = useState('single'); // 'single' | 'recurring'
  const [recurringData, setRecurringData] = useState({
    startDate: '',
    endDate: '',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
    timeSlots: [],
    pricingMode: 'auto',
    cleaningMinutes: 20,
    skipConflicts: true,
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

  // Form lên lịch chiếu hàng loạt thông minh (Smart & Manual)
  const DEFAULT_BATCH_MANUAL_SLOTS = ['09:30', '12:45', '16:00', '19:15', '22:30'];
  const [batchData, setBatchData] = useState({
    cinemaId: 'ALL',
    startDate: todayStr,
    endDate: todayStr,
    selectedMovieIds: [],
    roomIds: [],
    scheduleMode: 'smart', // 'smart' | 'manual'
    firstShowtimeTime: '09:30',
    latestStartTime: '22:30',
    targetSlotsPerRoom: 5,
    cleaningMinutes: 20,
    optimizeMaxSlots: false,
    staggerRooms: true,
    timeSlots: [...DEFAULT_BATCH_MANUAL_SLOTS],
  });
  const [batchMovieSearch, setBatchMovieSearch] = useState('');
  const [batchNewTimeInput, setBatchNewTimeInput] = useState('');
  const [batchTimeSlotError, setBatchTimeSlotError] = useState('');
  const [batchPreviewFilter, setBatchPreviewFilter] = useState('ALL'); // 'ALL' | 'VALID' | 'CONFLICT'
  const [collapsedPreviewGroups, setCollapsedPreviewGroups] = useState(() => new Set());

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

  // Tự động cập nhật đồng hồ thời gian thực (mỗi 15s) và đồng bộ nền (mỗi 60s) để tự động dọn suất đã chiếu xong
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setLiveNowMs(Date.now());
    }, 15000);
    const syncInterval = setInterval(() => {
      loadData(true);
    }, 60000);
    return () => {
      clearInterval(clockInterval);
      clearInterval(syncInterval);
    };
  }, [viewDate]);

  useEffect(() => {
    if (!bulkDeleteBanner) return undefined;
    const t = setTimeout(() => setBulkDeleteBanner(null), 6000);
    return () => clearTimeout(t);
  }, [bulkDeleteBanner]);

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

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = { viewDate, includeCancelled: 'true' };

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
      setLiveNowMs(Date.now());

      // Mặc định mở rộng tất cả các phim
      setExpandedMovieIds((prev) => (prev.size > 0 ? prev : new Set(mList.map(m => String(m.id || m._id)))));

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
          roomIds: prev.roomIds.length > 0 ? prev.roomIds : rList.map((r) => String(r.id || r._id)),
        }));
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu suất chiếu:', err);
    } finally {
      if (!silent) setLoading(false);
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

  // Tóm tắt 4 mốc thời gian (endTime = startTime + movieDuration, cleaningEndTime = endTime + 20 phút)
  const timeSummary = useMemo(() => {
    const dur = Number(selectedMovie?.duration) || 120;
    const [sh, sm] = (formTime || '18:00').split(':').map(Number);
    const startMin = (sh || 0) * 60 + (sm || 0);
    const endMin = startMin + dur;
    const readyMin = endMin + 20;

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
      cleaningTime: '20 phút',
      readyTime: toObj(readyMin)
    };
  }, [selectedMovie, formTime]);

  // Kiểm tra xung đột thực tế (bỏ qua suất đã COMPLETED hoặc CANCELLED)
  const conflictStatus = useMemo(() => {
    if (slotsLoading) return { text: 'Đang kiểm tra...', tone: 'loading' };
    if (!formData.roomId || !formData.startTime) return { text: 'Chưa đủ thông tin', tone: 'idle' };

    const startD = new Date(formData.startTime);
    if (isNaN(startD.getTime())) return { text: 'Thời gian không hợp lệ', tone: 'idle' };
    const dur = Number(selectedMovie?.duration) || 120;
    const startMs = startD.getTime();
    const endMs = startMs + dur * 60000;
    const cleanEndMs = endMs + 20 * 60000;

    const startH = startD.getHours();
    if (startH < 8 && startH >= 2) {
      return { text: 'Vượt khung giờ hoạt động rạp (08:00 - 02:00)', tone: 'warning' };
    }

    const roomShowtimes = showtimes.filter(s => {
      if (String(s.roomId || s.roomId?._id) !== String(formData.roomId)) return false;
      if (s.cancelledAt) return false;
      const sStart = new Date(s.startTime).getTime();
      const sDur = Number(s.movieId?.duration) || 120;
      const sEnd = s.endTime ? new Date(s.endTime).getTime() : sStart + sDur * 60000;
      const sClean = (s.cleaningMinutes >= 15 && s.cleaningMinutes <= 20 ? s.cleaningMinutes : 20) * 60000;
      return liveNowMs < (sEnd + sClean);
    });

    for (const s of roomShowtimes) {
      const sStart = new Date(s.startTime).getTime();
      const sDur = Number(s.movieId?.duration) || 120;
      const sEnd = s.endTime ? new Date(s.endTime).getTime() : sStart + sDur * 60000;
      const sCleanMin = s.cleaningMinutes >= 15 && s.cleaningMinutes <= 20 ? s.cleaningMinutes : 20;
      const sOccupiedEnd = sEnd + sCleanMin * 60000;

      if (startMs < sEnd && sStart < endMs) {
        return { text: 'Trùng lịch chiếu với suất khác', tone: 'danger' };
      }
      if (startMs < sOccupiedEnd && sStart < cleanEndMs) {
        return { text: `Không đủ ${sCleanMin} phút dọn dẹp vệ sinh`, tone: 'warning' };
      }
    }

    return { text: 'Không trùng lịch (Sẵn sàng mở bán)', tone: 'success' };
  }, [slotsLoading, formData.roomId, formData.startTime, selectedMovie, showtimes, liveNowMs]);

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
    { label: 'T2', fullLabel: 'Thứ 2', value: 1 },
    { label: 'T3', fullLabel: 'Thứ 3', value: 2 },
    { label: 'T4', fullLabel: 'Thứ 4', value: 3 },
    { label: 'T5', fullLabel: 'Thứ 5', value: 4 },
    { label: 'T6', fullLabel: 'Thứ 6', value: 5 },
    { label: 'T7', fullLabel: 'Thứ 7', value: 6 },
    { label: 'CN', fullLabel: 'Chủ Nhật', value: 0 },
  ];

  const getRecurringStartDate = () =>
    recurringData.startDate || viewDate;

  const getRecurringEndDate = () =>
    recurringData.endDate || viewDate;

  const handleRecurringQuickRange = (days) => {
    const clampedDays = Math.min(30, Math.max(1, Number(days) || 7));
    const start = getRecurringStartDate();
    const d = new Date(start + 'T12:00:00+07:00');
    d.setDate(d.getDate() + clampedDays - 1);
    const end = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    setRecurringData(prev => ({ ...prev, startDate: start, endDate: end }));
    setRecurringPreview(null);
  };

  const handleRecurringEndOfMonth = () => {
    const start = getRecurringStartDate();
    const d = new Date(start + 'T12:00:00+07:00');
    const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const maxAllowedDate = new Date(d.getTime() + 29 * 86400000);
    const targetEnd = lastDayOfMonth.getTime() > maxAllowedDate.getTime() ? maxAllowedDate : lastDayOfMonth;
    const end = targetEnd.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    setRecurringData(prev => ({ ...prev, startDate: start, endDate: end }));
    setRecurringPreview(null);
  };

  const handleRecurringMonthYearPick = (yearMonth) => {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) return;
    const [yStr, mStr] = yearMonth.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const start = `${yearMonth}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDay = Math.min(30, lastDay);
    const end = `${yearMonth}-${String(endDay).padStart(2, '0')}`;
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
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)) {
      alert('Định dạng giờ phải là 24h HH:mm (ví dụ: 09:30 hoặc 19:15)');
      return;
    }
    const [hh, mm] = t.split(':').map(Number);
    const totalMin = hh * 60 + mm;
    if (totalMin < 8 * 60 || totalMin > 22 * 60 + 30) {
      alert('Giờ bắt đầu suất chiếu phải nằm trong khung giờ mở suất của rạp (08:00 – 22:30).');
      return;
    }
    if (!recurringData.timeSlots.includes(t)) {
      setRecurringData(prev => ({
        ...prev,
        timeSlots: [...prev.timeSlots, t].sort(),
        manualTimeInput: '',
      }));
      setRecurringPreview(null);
    } else {
      setRecurringData(prev => ({ ...prev, manualTimeInput: '' }));
    }
  };

  // Expected metrics (computed locally, no API call)
  const recurringRangeMetrics = (() => {
    const start = getRecurringStartDate();
    const end = getRecurringEndDate();
    if (!start || !end || start > end) return { rangeDays: 0, matchedDaysCount: 0, expectedShowtimes: 0 };
    const msPerDay = 86400000;
    const startMs = new Date(start + 'T00:00:00+07:00').getTime();
    const endMs   = new Date(end   + 'T00:00:00+07:00').getTime();
    const days = Math.round((endMs - startMs) / msPerDay) + 1;
    let matchedDays = 0;
    for (let i = 0; i < Math.min(days, 366); i++) {
      const d = new Date(startMs + i * msPerDay);
      const dow = new Date(d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) + 'T12:00:00+07:00').getUTCDay();
      if (recurringData.daysOfWeek.includes(dow)) matchedDays++;
    }
    return {
      rangeDays: days,
      matchedDaysCount: matchedDays,
      expectedShowtimes: matchedDays * recurringData.timeSlots.length,
    };
  })();
  const recurringExpectedCount = recurringRangeMetrics.expectedShowtimes;

  const handleRecurringPreview = async () => {
    if (!formData.movieId) { alert('Vui lòng chọn bộ phim.'); return; }
    if (!formData.roomId) { alert('Vui lòng chọn phòng chiếu.'); return; }
    const startDate = getRecurringStartDate();
    const endDate = getRecurringEndDate();
    if (!startDate || !endDate) { alert('Vui lòng chọn ngày bắt đầu và kết thúc.'); return; }
    if (startDate > endDate) { alert('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'); return; }
    if (recurringRangeMetrics.rangeDays > 30) {
      alert(`Khoảng ngày lặp lịch tối đa 30 ngày (hiện tại ${recurringRangeMetrics.rangeDays} ngày).`);
      return;
    }
    if (recurringData.daysOfWeek.length === 0) { alert('Vui lòng chọn ít nhất 1 thứ trong tuần.'); return; }
    if (recurringData.timeSlots.length === 0) { alert('Vui lòng chọn ít nhất 1 khung giờ.'); return; }
    if (recurringExpectedCount > 180) {
      alert(`Tổng số suất dự kiến (${recurringExpectedCount} suất) vượt quá giới hạn tối đa 180 suất mỗi lần lặp lịch.`);
      return;
    }

    try {
      setRecurringLoading(true);
      setRecurringPreview(null);
      setPreviewRemovedKeys(new Set());
      const res = await api.post('/admin/showtimes/recurring/preview', {
        movieId: formData.movieId,
        roomId: formData.roomId,
        cinemaId: selectedRoom?.cinemaId || formData.cinemaId,
        formatFeature: selectedFormat || getCompatibleFormats(selectedMovie, selectedRoom)[0] || '2D Tiêu chuẩn',
        startDate,
        endDate,
        daysOfWeek: recurringData.daysOfWeek,
        timeSlots: recurringData.timeSlots,
        pricingMode: recurringData.pricingMode,
        price: formData.price,
        cleaningMinutes: recurringData.cleaningMinutes || 20,
        skipConflicts: recurringData.skipConflicts,
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
    if (!recurringData.skipConflicts && Number(recurringPreview.conflictCount) > 0) {
      alert('Có suất chiếu bị trùng lịch. Vui lòng bật "Bỏ qua các suất bị trùng lịch" hoặc điều chỉnh lại khung giờ trước khi xác nhận.');
      return;
    }
    const allValid = recurringPreview.validSlots || [];
    const confirmedSlots = allValid
      .filter(s => !previewRemovedKeys.has(s.startTime + s.roomId))
      .map(s => ({
        movieId: s.movieId,
        roomId: s.roomId,
        cinemaId: selectedRoom?.cinemaId || formData.cinemaId,
        formatFeature: s.formatFeature,
        startTime: s.startTime,
        price: s.price,
        cleaningMinutes: s.cleaningMinutes || recurringData.cleaningMinutes || 20,
      }));

    if (confirmedSlots.length === 0) { alert('Không có suất chiếu hợp lệ để tạo.'); return; }

    const confirmed = window.confirm(
      `Xác nhận tạo ${confirmedSlots.length} suất chiếu hợp lệ (${confirmedSlots.length * (recurringPreview.totalSeatsPerShowtime || 88)} ghế)?`
    );
    if (!confirmed) return;

    try {
      setRecurringCommitting(true);
      const requestId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      const res = await api.post('/admin/showtimes/recurring/commit', {
        movieId: formData.movieId,
        roomId: formData.roomId,
        cinemaId: selectedRoom?.cinemaId || formData.cinemaId,
        formatFeature: selectedFormat || getCompatibleFormats(selectedMovie, selectedRoom)[0] || '2D Tiêu chuẩn',
        startDate: getRecurringStartDate(),
        endDate: getRecurringEndDate(),
        daysOfWeek: recurringData.daysOfWeek,
        timeSlots: recurringData.timeSlots,
        pricingMode: recurringData.pricingMode,
        price: formData.price,
        cleaningMinutes: recurringData.cleaningMinutes || 20,
        skipConflicts: recurringData.skipConflicts,
        previewSignature: recurringPreview.previewSignature,
        confirmedSlots,
        requestId,
      });
      const { created = [], skipped = [], conflicts = [], failed = [] } = res.data;
      let msg = `Đã tạo ${created.length} suất chiếu thành công (${created.length * (recurringPreview.totalSeatsPerShowtime || 88)} ghế)!`;
      if (skipped.length > 0) msg += `\nĐã bỏ qua ${skipped.length} suất bị trùng lịch.`;
      else if (conflicts.length > 0) msg += `\n${conflicts.length} suất bị xung đột.`;
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
    setRecurringData((prev) => ({
      ...prev,
      startDate: viewDate,
      endDate: prev.endDate && prev.endDate >= viewDate ? prev.endDate : viewDate,
      timeSlots: prev.timeSlots.includes(`${hh}:${mm}`) ? prev.timeSlots : [...prev.timeSlots, `${hh}:${mm}`].sort(),
    }));
    setRecurringPreview(null);
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

  // Mở popup Xếp lịch hàng loạt thông minh:
  // - Mặc định 0 phim được chọn (selectedMovieIds: [])
  // - Ngày mặc định lấy từ ngày Admin đang xem trên Timeline (viewDate)
  // - Mặc định chọn đủ 9 phòng vật lý
  const handleOpenBatchModal = () => {
    setBatchPreview(null);
    setBatchMovieSearch('');
    setBatchNewTimeInput('');
    setBatchTimeSlotError('');
    setBatchPreviewFilter('ALL');
    setBatchData((prev) => ({
      ...prev,
      cinemaId: cinemas[0]?.id || cinemas[0]?._id || prev.cinemaId || 'ALL',
      startDate: viewDate,
      endDate: viewDate,
      selectedMovieIds: [],
      roomIds: sortedPhysicalRooms.map((r) => String(r.id || r._id)),
      scheduleMode: 'smart',
      firstShowtimeTime: '09:30',
      latestStartTime: '22:30',
      targetSlotsPerRoom: 5,
      cleaningMinutes: 20,
      optimizeMaxSlots: false,
      staggerRooms: true,
      timeSlots: [...DEFAULT_BATCH_MANUAL_SLOTS],
    }));
    setIsBatchModalOpen(true);
  };

  // Cập nhật trường cấu hình trong popup Xếp lịch hàng loạt -> tự động yêu cầu Preview lại
  const updateBatchField = (updater) => {
    setBatchPreview(null);
    setBatchData((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
  };

  const validateManualTimeSlotValue = (val) => {
    const clean = String(val || '').trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clean)) {
      return { valid: false, message: 'Giờ chiếu phải đúng định dạng HH:mm (ví dụ: 09:30).' };
    }
    const [h, m] = clean.split(':').map(Number);
    const totalMin = h * 60 + m;
    if (totalMin < 8 * 60 || totalMin > 22 * 60 + 30) {
      return { valid: false, message: 'Giờ bắt đầu suất chiếu phải nằm trong khung mở suất của rạp (08:00 – 22:30).' };
    }
    return { valid: true, clean };
  };

  const handleUpdateBatchTimeSlot = (index, newValue) => {
    const clean = String(newValue || '').trim();
    setBatchPreview(null);
    setBatchData((prev) => {
      const next = [...prev.timeSlots];
      next[index] = clean;
      return { ...prev, timeSlots: next };
    });

    const check = validateManualTimeSlotValue(clean);
    if (!check.valid) {
      setBatchTimeSlotError(check.message);
      return;
    }
    const duplicates = batchData.timeSlots.some((t, i) => i !== index && t.trim() === clean);
    if (duplicates) {
      setBatchTimeSlotError(`Khung giờ "${clean}" bị trùng lặp.`);
      return;
    }
    setBatchTimeSlotError('');
  };

  const handleDeleteBatchTimeSlot = (index) => {
    setBatchPreview(null);
    setBatchTimeSlotError('');
    setBatchData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_, i) => i !== index),
    }));
  };

  const handleAddBatchTimeSlot = () => {
    const check = validateManualTimeSlotValue(batchNewTimeInput);
    if (!check.valid) {
      setBatchTimeSlotError(check.message);
      return;
    }
    if (batchData.timeSlots.some((t) => t.trim() === check.clean)) {
      setBatchTimeSlotError(`Khung giờ "${check.clean}" đã tồn tại trong danh sách.`);
      return;
    }
    setBatchTimeSlotError('');
    setBatchNewTimeInput('');
    setBatchPreview(null);
    setBatchData((prev) => ({
      ...prev,
      timeSlots: [...prev.timeSlots, check.clean].sort(),
    }));
  };

  const handleResetBatchTimeSlots = () => {
    setBatchTimeSlotError('');
    setBatchNewTimeInput('');
    setBatchPreview(null);
    setBatchData((prev) => ({
      ...prev,
      timeSlots: [...DEFAULT_BATCH_MANUAL_SLOTS],
    }));
  };

  const buildBatchSchedulePayload = (isPreview) => {
    const base = {
      cinemaId: batchData.cinemaId,
      startDate: batchData.startDate,
      endDate: batchData.endDate,
      movieIds: batchData.selectedMovieIds.map(String),
      roomIds: batchData.roomIds.map(String),
      scheduleMode: batchData.scheduleMode,
      cleaningMinutes: Number(batchData.cleaningMinutes) === 15 ? 15 : 20,
      preview: Boolean(isPreview),
    };

    if (batchData.scheduleMode === 'smart') {
      base.firstShowtimeTime = batchData.firstShowtimeTime || '09:30';
      base.latestStartTime = batchData.latestStartTime || '22:30';
      base.targetSlotsPerRoom = Number(batchData.targetSlotsPerRoom) || 5;
      base.optimizeMaxSlots = Boolean(batchData.optimizeMaxSlots);
      base.staggerRooms = Boolean(batchData.staggerRooms);
    } else {
      base.timeSlots = batchData.timeSlots.map((t) => t.trim());
    }

    if (!isPreview && batchPreview) {
      base.expectedValidCount = batchPreview.validCount;
      base.expectedSignature = batchPreview.validSignature;
    }

    return base;
  };

  // Xếp lịch hàng loạt: Xem trước (Preview)
  const handlePreviewBatch = async () => {
    if (!batchData.startDate || !batchData.endDate) {
      alert('Vui lòng chọn ngày bắt đầu và kết thúc!');
      return;
    }
    if (batchData.startDate > batchData.endDate) {
      alert('Ngày bắt đầu không được lớn hơn ngày kết thúc!');
      return;
    }
    if (batchData.selectedMovieIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 bộ phim trước khi xem trước lịch dự kiến!');
      return;
    }
    if (batchData.roomIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 phòng chiếu!');
      return;
    }

    if (batchData.scheduleMode === 'manual') {
      if (!batchData.timeSlots.length) {
        setBatchTimeSlotError('Vui lòng thêm ít nhất 1 khung giờ chiếu.');
        return;
      }
      for (const slot of batchData.timeSlots) {
        const check = validateManualTimeSlotValue(slot);
        if (!check.valid) {
          setBatchTimeSlotError(check.message);
          return;
        }
      }
      const uniqueSet = new Set(batchData.timeSlots.map((t) => t.trim()));
      if (uniqueSet.size !== batchData.timeSlots.length) {
        setBatchTimeSlotError('Danh sách khung giờ đang có giờ trùng nhau. Vui lòng chỉnh sửa hoặc xóa giờ trùng.');
        return;
      }
      setBatchTimeSlotError('');
    }

    try {
      setBatchLoading(true);
      const res = await api.post('/admin/showtimes/schedule-batch', buildBatchSchedulePayload(true));

      if (res.data?.preview) {
        setBatchPreview(res.data);
      }
    } catch (err) {
      alert('Lỗi xem trước lịch chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setBatchLoading(false);
    }
  };

  // Xếp lịch hàng loạt: Xác nhận ghi Database (Chống bấm đúp, giữ form khi lỗi, thông báo rõ trạng thái rollback/409)
  const handleExecuteBatchSchedule = async () => {
    if (isConfirmingBatchRef.current || batchLoading) {
      return;
    }
    if (!batchPreview || !batchPreview.validCount) {
      alert('Vui lòng bấm "Xem trước lịch dự kiến" và đảm bảo có ít nhất 1 suất chiếu hợp lệ trước khi xác nhận!');
      return;
    }
    if (batchData.selectedMovieIds.length === 0 || batchData.roomIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 phim và 1 phòng chiếu!');
      return;
    }

    try {
      isConfirmingBatchRef.current = true;
      setIsConfirmingBatch(true);
      setBatchLoading(true);
      const res = await api.post('/admin/showtimes/schedule-batch', buildBatchSchedulePayload(false));

      alert(`Đã xếp lịch chiếu hàng loạt thành công! (${res.data?.totalCreatedShowtimes || 0} suất chiếu, đủ 88 ghế/suất)`);
      setIsBatchModalOpen(false);
      setBatchPreview(null);
      await loadData();
    } catch (err) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.message || err.message;
      const rolledBack = err.response?.data?.rolledBack;
      if (status === 409) {
        setBatchPreview(null);
        alert(`Xung đột lịch chiếu (HTTP 409): ${serverMsg}\nDữ liệu form của bạn vẫn được giữ nguyên, vui lòng bấm "Xem trước lịch dự kiến" lại.`);
      } else {
        const rollbackNote = rolledBack
          ? '\nToàn bộ giao dịch đã được rollback an toàn trên MongoDB (không có dữ liệu dở dang).'
          : '';
        alert(`Lỗi xếp lịch chiếu: ${serverMsg}${rollbackNote}`);
      }
    } finally {
      isConfirmingBatchRef.current = false;
      setIsConfirmingBatch(false);
      setBatchLoading(false);
    }
  };

  // ── Vòng đời suất chiếu theo thời gian thực (endTime = startTime + duration, cleaningEndTime = endTime + cleaningMinutes) ──
  const resolveShowtimeLifecycle = (st, nowMs = liveNowMs) => {
    const startMs = new Date(st.startTime).getTime();
    const duration = Number(st.movieId?.duration || st.movie?.duration) || 120;
    const rawEndMs = st.endTime ? new Date(st.endTime).getTime() : NaN;
    const endMs = Number.isFinite(rawEndMs) && rawEndMs > startMs ? rawEndMs : startMs + duration * 60000;
    const rawClean = Number(st.cleaningMinutes);
    const cleaningMinutes = Number.isFinite(rawClean) && rawClean >= 15 && rawClean <= 20 ? Math.round(rawClean) : 20;
    const cleaningEndMs = endMs + cleaningMinutes * 60000;

    let lifecycleStatus = 'UPCOMING';
    if (st.cancelledAt) {
      lifecycleStatus = 'CANCELLED';
    } else if (nowMs >= cleaningEndMs) {
      lifecycleStatus = 'COMPLETED';
    } else if (nowMs >= endMs) {
      lifecycleStatus = 'CLEANING';
    } else if (nowMs >= startMs) {
      lifecycleStatus = 'NOW_SHOWING';
    } else {
      lifecycleStatus = 'UPCOMING';
    }

    const isActiveSchedule =
      lifecycleStatus === 'UPCOMING' ||
      lifecycleStatus === 'NOW_SHOWING' ||
      lifecycleStatus === 'CLEANING';

    return {
      lifecycleStatus,
      startMs,
      endMs,
      cleaningMinutes,
      cleaningEndMs,
      duration,
      isActiveSchedule,
    };
  };

  const showtimesWithLifecycle = useMemo(() => {
    return showtimes.map((st) => {
      const lc = resolveShowtimeLifecycle(st, liveNowMs);
      return {
        ...st,
        lifecycleStatus: lc.lifecycleStatus,
        cleaningMinutes: lc.cleaningMinutes,
        cleaningEndTime: new Date(lc.cleaningEndMs).toISOString(),
        isActiveSchedule: lc.isActiveSchedule,
        hasConflict: lc.isActiveSchedule ? Boolean(st.hasConflict) : false,
      };
    });
  }, [showtimes, liveNowMs]);

  const historyFilterCounts = useMemo(() => {
    let active = 0;
    let completed = 0;
    let cancelled = 0;
    for (const st of showtimesWithLifecycle) {
      if (st.lifecycleStatus === 'CANCELLED') cancelled++;
      else if (st.lifecycleStatus === 'COMPLETED') completed++;
      else active++;
    }
    return {
      ACTIVE: active,
      COMPLETED: completed,
      CANCELLED: cancelled,
      ALL: showtimesWithLifecycle.length,
    };
  }, [showtimesWithLifecycle]);

  const historyFilteredShowtimes = useMemo(() => {
    return showtimesWithLifecycle.filter((st) => {
      if (historyFilter === 'ACTIVE') return st.isActiveSchedule;
      if (historyFilter === 'COMPLETED') return st.lifecycleStatus === 'COMPLETED';
      if (historyFilter === 'CANCELLED') return st.lifecycleStatus === 'CANCELLED';
      return true;
    });
  }, [showtimesWithLifecycle, historyFilter]);

  // Lọc showtimes theo phim, loại phòng, bộ lọc nhanh và bộ lọc lịch sử
  const filteredShowtimes = useMemo(() => {
    return historyFilteredShowtimes.filter((st) => {
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
  }, [historyFilteredShowtimes, filterMovieId, filterRoomType, quickFilter]);

  // ── Các hàm điều khiển Chọn xóa suất chiếu hàng loạt (Bulk Delete) ──
  const handleToggleBulkSelectMode = () => {
    setIsBulkSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedShowtimeIds(new Set());
        setBulkDeletePreview(null);
        setIsBulkDeleteModalOpen(false);
      } else {
        setDrawerShowtimeId(null);
      }
      return next;
    });
  };

  const handleExitBulkSelectMode = () => {
    setIsBulkSelectMode(false);
    setSelectedShowtimeIds(new Set());
    setBulkDeletePreview(null);
    setIsBulkDeleteModalOpen(false);
  };

  const handleToggleSelectShowtime = (showtimeId) => {
    const idStr = String(showtimeId || '');
    if (!idStr) return;
    setSelectedShowtimeIds((prev) => {
      const next = new Set(prev);
      if (next.has(idStr)) next.delete(idStr);
      else next.add(idStr);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredShowtimes.map((st) => String(st.id || st._id)).filter(Boolean);
    setSelectedShowtimeIds(new Set(ids));
  };

  const handleClearBulkSelection = () => {
    setSelectedShowtimeIds(new Set());
  };

  const handleToggleSelectMovieGroup = (movieShowtimes = []) => {
    const groupIds = movieShowtimes.map((st) => String(st.id || st._id)).filter(Boolean);
    if (!groupIds.length) return;
    setSelectedShowtimeIds((prev) => {
      const next = new Set(prev);
      const allSelected = groupIds.every((id) => next.has(id));
      if (allSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleOpenBulkDeletePreview = async () => {
    const ids = Array.from(selectedShowtimeIds);
    if (ids.length === 0) return;

    try {
      setIsBulkPreviewLoading(true);
      setBulkDeletePreview(null);
      setIsBulkDeleteModalOpen(true);

      const res = await api.post('/admin/showtimes/bulk-delete/preview', {
        showtimeIds: ids,
      });
      setBulkDeletePreview(res.data);
    } catch (err) {
      alert('Lỗi khi kiểm tra danh sách suất chiếu cần xóa: ' + (err.response?.data?.message || err.message));
      setIsBulkDeleteModalOpen(false);
    } finally {
      setIsBulkPreviewLoading(false);
    }
  };

  const handleCommitBulkDelete = async () => {
    if (!bulkDeletePreview?.previewId || !Array.isArray(bulkDeletePreview?.eligibleSlots)) return;
    const confirmedIds = bulkDeletePreview.eligibleSlots.map((s) => String(s.id || s.showtimeId));
    if (confirmedIds.length === 0) return;

    try {
      setIsBulkCommitting(true);
      const requestId = `BULK-DEL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const res = await api.post('/admin/showtimes/bulk-delete/commit', {
        previewId: bulkDeletePreview.previewId,
        confirmedIds,
        requestId,
        reason: `Admin xóa hàng loạt ${confirmedIds.length} suất chiếu trên trang Điều phối lịch chiếu`,
      });

      const deletedCount = res.data?.deletedCount ?? confirmedIds.length;
      const skippedCount = res.data?.skippedCount ?? 0;

      setIsBulkDeleteModalOpen(false);
      setBulkDeletePreview(null);
      setSelectedShowtimeIds(new Set());
      setIsBulkSelectMode(false);
      setBulkDeleteBanner({
        deletedCount,
        skippedCount,
        blockedCount: bulkDeletePreview.blockedCount || 0,
        message: res.data?.message || `Đã xóa thành công ${deletedCount} suất chiếu.`,
      });

      await loadData();
    } catch (err) {
      alert('Lỗi khi xóa hàng loạt suất chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsBulkCommitting(false);
    }
  };

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

  // Thống kê nhanh trên đầu Timeline (đồng bộ theo bộ lọc lịch sử hiện tại, mặc định là Lịch đang hoạt động)
  const statsSummary = useMemo(() => {
    const total = historyFilteredShowtimes.length;
    const roomIdsWithShowtimes = new Set(historyFilteredShowtimes.map(st => String(st.roomId?._id || st.roomId || st.roomName)));
    const activeRoomsCount = sortedPhysicalRooms.filter(r =>
      roomIdsWithShowtimes.has(String(r._id || r.id)) || historyFilteredShowtimes.some(st => (st.roomName || '').includes(r.shortName || r.name))
    ).length;
    const conflictsCount = historyFilteredShowtimes.filter(st => st.hasConflict).length;
    const missingSeatsCount = historyFilteredShowtimes.filter(st => !st.totalSeats || st.totalSeats === 0).length;

    return { total, activeRoomsCount, conflictsCount, missingSeatsCount };
  }, [historyFilteredShowtimes, sortedPhysicalRooms]);

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

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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
                data-testid="open-batch-schedule-btn"
                onClick={handleOpenBatchModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95"
              >
                <span>⚡</span>
                <span>Xếp lịch hàng loạt</span>
              </button>

              {/* Nút thứ 3: Chọn xóa suất chiếu (có icon thùng rác và màu đỏ) */}
              <button
                type="button"
                data-testid="bulk-select-toggle-btn"
                onClick={handleToggleBulkSelectMode}
                className={`font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg cursor-pointer active:scale-95 border ${
                  isBulkSelectMode
                    ? 'bg-rose-700 hover:bg-rose-600 text-white border-rose-400 ring-2 ring-rose-500/40 shadow-rose-600/40'
                    : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500/40 shadow-rose-600/30'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBulkSelectMode ? `Đang chọn xóa (${selectedShowtimeIds.size})` : 'Chọn xóa suất chiếu'}</span>
              </button>
            </div>
          </div>

          {/* Thông báo kết quả xóa hàng loạt */}
          {bulkDeleteBanner && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-200 shadow-lg animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>{bulkDeleteBanner.message}</strong>
                  {bulkDeleteBanner.blockedCount > 0 && (
                    <span className="text-amber-300 ml-2">
                      (Đã bảo vệ {bulkDeleteBanner.blockedCount} suất chiếu có đơn vé hoặc đang chiếu)
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBulkDeleteBanner(null)}
                className="text-slate-400 hover:text-white px-2 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Thanh điều khiển Chế độ Chọn Xóa Hàng Loạt */}
          {isBulkSelectMode && (
            <div
              data-testid="bulk-delete-toolbar"
              className="bg-rose-950/40 border border-rose-500/50 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl animate-fadeIn"
            >
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-600/30 border border-rose-500/50 text-rose-200 font-bold">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    Đã chọn <strong className="text-white font-mono text-sm" data-testid="bulk-selected-count">{selectedShowtimeIds.size}</strong> / {filteredShowtimes.length} suất hiển thị
                  </span>
                </span>
                <span className="text-slate-300 hidden md:inline">
                  Bấm trực tiếp vào các khối suất chiếu trên Timeline, Theo phim hoặc Danh sách để chọn nhiều suất cùng lúc.
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="bulk-select-all-btn"
                  onClick={handleSelectAllFiltered}
                  disabled={filteredShowtimes.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-colors cursor-pointer"
                >
                  ☑ Chọn tất cả ({filteredShowtimes.length})
                </button>
                <button
                  type="button"
                  data-testid="bulk-clear-all-btn"
                  onClick={handleClearBulkSelection}
                  disabled={selectedShowtimeIds.size === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  ☐ Bỏ chọn tất cả
                </button>
                <button
                  type="button"
                  data-testid="bulk-delete-confirm-trigger-btn"
                  onClick={handleOpenBulkDeletePreview}
                  disabled={selectedShowtimeIds.size === 0 || isBulkPreviewLoading}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa {selectedShowtimeIds.size} suất đã chọn</span>
                </button>
                <button
                  type="button"
                  data-testid="bulk-exit-mode-btn"
                  onClick={handleExitBulkSelectMode}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Thoát chế độ chọn
                </button>
              </div>
            </div>
          )}

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

            {/* Bộ lọc lịch sử: Lịch đang hoạt động (mặc định) | Lịch đã hoàn thành | Lịch đã hủy | Tất cả lịch */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5" data-testid="history-filter-tabs">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Bộ lọc lịch sử:</span>
                {[
                  { key: 'ACTIVE', label: 'Lịch đang hoạt động', count: historyFilterCounts.ACTIVE, activeClass: 'bg-emerald-600/25 text-emerald-300 border-emerald-500/50' },
                  { key: 'COMPLETED', label: 'Lịch đã hoàn thành', count: historyFilterCounts.COMPLETED, activeClass: 'bg-cyan-600/25 text-cyan-300 border-cyan-500/50' },
                  { key: 'CANCELLED', label: 'Lịch đã hủy', count: historyFilterCounts.CANCELLED, activeClass: 'bg-rose-600/25 text-rose-300 border-rose-500/50' },
                  { key: 'ALL', label: 'Tất cả lịch', count: historyFilterCounts.ALL, activeClass: 'bg-indigo-600/25 text-indigo-300 border-indigo-500/50' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    data-testid={`history-tab-${tab.key}`}
                    onClick={() => setHistoryFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      historyFilter === tab.key
                        ? tab.activeClass
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-slate-900/90 text-[10px] font-mono">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400">
                Tự động hoàn thành sau khi hết phim + <strong className="text-amber-300">20 phút</strong> vệ sinh phòng
              </span>
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
                    <span className="w-2.5 h-2.5 rounded bg-amber-500/40 border border-amber-500 inline-block"></span> 20p dọn phòng
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
                                  {renderAssigned.map(({ st, leftPct, widthPct, cleanWidthPct, duration, cleaning, lane, isCarryOver }) => {
                                    const stIdStr = String(st.id || st._id);
                                    const isSelectedForBulk = selectedShowtimeIds.has(stIdStr);
                                    const stDate = new Date(st.startTime);
                                    const movie = st.movieId || {};
                                    const timeStr = stDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
                                    const endDate = new Date(stDate.getTime() + duration * 60000);
                                    const endTimeStr = endDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

                                    const booked = st.bookedSeats || 0;
                                    const total = st.totalSeats || 88;
                                    const isConflict = st.hasConflict;

                                    const topPx = lane * 46 + 4;

                                    const blockBg = isBulkSelectMode && isSelectedForBulk
                                      ? 'bg-rose-950/95 border-rose-400 ring-2 ring-rose-500/70 text-white shadow-[0_0_12px_rgba(244,63,94,0.45)]'
                                      : isConflict
                                      ? 'bg-slate-900/95 border-red-500/80 border-dashed text-slate-100 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                                      : isImax
                                      ? 'bg-slate-900/95 border-cyan-500/60 text-cyan-100 shadow-cyan-500/10'
                                      : isAtmos
                                      ? 'bg-slate-900/95 border-purple-500/60 text-purple-100 shadow-purple-500/10'
                                      : 'bg-slate-900/95 border-amber-500/60 text-amber-100 shadow-amber-500/10';

                                    return (
                                      <React.Fragment key={stIdStr}>
                                        {/* Khối phim */}
                                        <div
                                          data-testid={`timeline-showtime-${stIdStr}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (isBulkSelectMode) {
                                              handleToggleSelectShowtime(stIdStr);
                                            } else {
                                              setDrawerShowtimeId(stIdStr);
                                            }
                                          }}
                                          style={{
                                            left: `${Math.max(0, leftPct)}%`,
                                            width: `${Math.max(3.5, widthPct)}%`,
                                            top: `${topPx}px`,
                                            height: '38px',
                                          }}
                                          className={`absolute border rounded-lg px-2 py-0.5 flex flex-col justify-between overflow-hidden shadow-lg hover:brightness-125 transition-all cursor-pointer z-10 group ${blockBg}`}
                                          title={`🎬 ${movie.title || 'Phim'}\n🕒 ${timeStr} – ${endTimeStr} (${duration} phút + ${cleaning || 20}p dọn phòng)\n🎟️ Đã bán: ${booked}/${total} vé\n💰 Giá: ${(st.price || 0).toLocaleString()}đ\n👉 ${isBulkSelectMode ? 'Click để chọn / bỏ chọn xóa hàng loạt' : 'Click để mở chi tiết suất chiếu & sơ đồ ghế'}`}
                                        >
                                          <div className="flex items-center justify-between gap-1 leading-tight">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              {isBulkSelectMode && (
                                                <input
                                                  type="checkbox"
                                                  checked={isSelectedForBulk}
                                                  onChange={() => {}}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleSelectShowtime(stIdStr);
                                                  }}
                                                  className="w-3.5 h-3.5 accent-rose-500 rounded cursor-pointer shrink-0"
                                                />
                                              )}
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
                                                {st.lifecycleStatus === 'NOW_SHOWING' && (
                                                  <span className="text-[8px] font-bold px-1 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                                                    Đang chiếu
                                                  </span>
                                                )}
                                                {st.lifecycleStatus === 'CLEANING' && (
                                                  <span className="text-[8px] font-bold px-1 rounded bg-amber-500/30 text-amber-200 border border-amber-500/40">
                                                    Dọn phòng
                                                  </span>
                                                )}
                                                {st.lifecycleStatus === 'COMPLETED' && (
                                                  <span className="text-[8px] font-bold px-1 rounded bg-slate-700 text-slate-300">
                                                    Hoàn thành
                                                  </span>
                                                )}
                                                {st.lifecycleStatus === 'CANCELLED' && (
                                                  <span className="text-[8px] font-bold px-1 rounded bg-rose-900/80 text-rose-200">
                                                    Đã hủy
                                                  </span>
                                                )}
                                                {isConflict && (
                                                  <span className="text-[9px] text-red-300 font-black animate-pulse">
                                                    ⚠️
                                                  </span>
                                                )}
                                                {!isBulkSelectMode && (
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
                                                )}
                                              </div>
                                          </div>
                                          <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono leading-none">
                                            <span>{timeStr}–{endTimeStr}</span>
                                            <span className={`px-1 rounded text-[9px] font-bold ${booked > 0 ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                              {booked}/{total}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Khối dọn phòng sau suất chiếu */}
                                        <div
                                          style={{
                                            left: `${leftPct + widthPct}%`,
                                            width: `${cleanWidthPct}%`,
                                            top: `${topPx + 2}px`,
                                            height: '34px',
                                          }}
                                          className="absolute bg-amber-500/10 border-l border-r border-amber-500/30 flex items-center justify-center text-[8px] text-amber-300 font-bold uppercase tracking-tighter pointer-events-none z-0 rounded-r-md"
                                          title={`Thời gian vệ sinh phòng: ${cleaning || 20} phút`}
                                        >
                                          {cleaning || 20}p
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
                              {isBulkSelectMode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleSelectMovieGroup(mShowtimes);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-xs font-bold cursor-pointer"
                                >
                                  {mShowtimes.every((s) => selectedShowtimeIds.has(String(s.id || s._id)))
                                    ? '☐ Bỏ chọn phim này'
                                    : '☑ Chọn tất cả phim này'}
                                </button>
                              )}
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
                                        const stIdStr = String(st.id || st._id);
                                        const isSelectedForBulk = selectedShowtimeIds.has(stIdStr);
                                        const stDate = new Date(st.startTime);
                                        const timeStr = stDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
                                        const booked = st.bookedSeats || 0;
                                        const total = st.totalSeats || 88;
                                        const isConflict = st.hasConflict;

                                        return (
                                          <div
                                            key={stIdStr}
                                            data-testid={`movie-showtime-${stIdStr}`}
                                            onClick={() => {
                                              if (isBulkSelectMode) {
                                                handleToggleSelectShowtime(stIdStr);
                                              } else {
                                                setDrawerShowtimeId(stIdStr);
                                              }
                                            }}
                                            className={`bg-slate-950 border ${
                                              isBulkSelectMode && isSelectedForBulk
                                                ? 'border-rose-400 ring-2 ring-rose-500/60 bg-rose-950/30'
                                                : isConflict
                                                ? 'border-red-500 hover:border-red-400'
                                                : 'border-slate-800 hover:border-slate-600'
                                            } rounded-xl p-2.5 space-y-1.5 hover:bg-slate-800/40 transition-all cursor-pointer shadow-md group relative`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                {isBulkSelectMode && (
                                                  <input
                                                    type="checkbox"
                                                    checked={isSelectedForBulk}
                                                    onChange={() => {}}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleToggleSelectShowtime(stIdStr);
                                                    }}
                                                    className="w-3.5 h-3.5 accent-rose-500 rounded cursor-pointer"
                                                  />
                                                )}
                                                <span className="text-base font-black text-white font-mono">{timeStr}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                {isConflict && (
                                                  <span className="text-[9px] font-black text-red-400 bg-red-950 px-1 rounded border border-red-800">
                                                    Trùng
                                                  </span>
                                                )}
                                                {!isBulkSelectMode && (
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
                                                )}
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
                            {isBulkSelectMode && (
                              <th className="py-3 px-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={
                                    filteredShowtimes.length > 0 &&
                                    filteredShowtimes.every((s) => selectedShowtimeIds.has(String(s.id || s._id)))
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) handleSelectAllFiltered();
                                    else handleClearBulkSelection();
                                  }}
                                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                                />
                              </th>
                            )}
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
                            const stIdStr = String(st.id || st._id);
                            const isSelectedForBulk = selectedShowtimeIds.has(stIdStr);
                            const movie = st.movieId || {};
                            const dateObj = new Date(st.startTime);
                            const timeFormatted = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const dateFormatted = dateObj.toLocaleDateString('vi-VN', {
                              weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
                            });
                            const booked = st.bookedSeats || 0;
                            const total = st.totalSeats || 88;
                            const percent = Math.round((booked / total) * 100);

                            return (
                              <tr
                                key={stIdStr}
                                data-testid={`list-showtime-${stIdStr}`}
                                onClick={() => {
                                  if (isBulkSelectMode) {
                                    handleToggleSelectShowtime(stIdStr);
                                  }
                                }}
                                className={`transition-colors ${
                                  isBulkSelectMode
                                    ? isSelectedForBulk
                                      ? 'bg-rose-950/30 hover:bg-rose-950/40 cursor-pointer'
                                      : 'hover:bg-slate-800/40 cursor-pointer'
                                    : 'hover:bg-slate-800/40'
                                }`}
                              >
                                {isBulkSelectMode && (
                                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isSelectedForBulk}
                                      onChange={() => handleToggleSelectShowtime(stIdStr)}
                                      className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                                    />
                                  </td>
                                )}
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

                {/* ── Segmented Control: Tạo 1 suất / Lặp lịch chiếu ── */}
                <div className="flex rounded-xl overflow-hidden border border-slate-700/60 bg-[#080E1D] p-0.5 gap-0.5">
                  {[{ key: 'single', label: 'Tạo 1 suất' }, { key: 'recurring', label: '🔁 Lặp lịch chiếu' }].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      data-testid={`create-mode-${key}-btn`}
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
                                      setRecurringPreview(null);
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
                        data-testid="modal-room-select"
                        value={formData.roomId}
                        onChange={(e) => {
                          const r = rooms.find(item => String(item.id || item._id) === e.target.value);
                          const compFormats = getCompatibleFormats(selectedMovie, r);
                          setSelectedFormat(compFormats[0] || '2D Tiêu chuẩn');
                          setRecurringPreview(null);
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
                        data-testid="modal-format-select"
                        value={selectedFormat || getCompatibleFormats(selectedMovie, selectedRoom)[0] || '2D Tiêu chuẩn'}
                        onChange={(e) => { setSelectedFormat(e.target.value); setRecurringPreview(null); }}
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
                    <div className="space-y-3 text-xs" data-testid="recurring-mode-panel">

                      {/* Date range + Compact Month/Year & Quick Range Selector */}
                      <div className="bg-[#080E1D]/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[#94A3B8] font-semibold text-xs flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#79D9F5]" />
                            <span>Khoảng ngày lặp lịch (Tối đa 30 ngày / 180 suất)</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#94A3B8]">Chọn nhanh tháng:</span>
                            <input
                              type="month"
                              data-testid="recurring-month-picker"
                              value={(recurringData.startDate || viewDate).slice(0, 7)}
                              onChange={(e) => handleRecurringMonthYearPick(e.target.value)}
                              className="bg-[#192337] border border-slate-700/80 rounded-lg px-2 py-1 text-[11px] text-[#79D9F5] font-mono font-bold focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[#94A3B8] font-semibold text-[11px] mb-1">Từ ngày *</label>
                            <input
                              type="date"
                              data-testid="recurring-start-date"
                              value={recurringData.startDate || viewDate}
                              onChange={e => { setRecurringData(p => ({ ...p, startDate: e.target.value })); setRecurringPreview(null); }}
                              className="w-full bg-[#101728] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-[#94A3B8] font-semibold text-[11px] mb-1">Đến ngày *</label>
                            <input
                              type="date"
                              data-testid="recurring-end-date"
                              value={recurringData.endDate || viewDate}
                              onChange={e => { setRecurringData(p => ({ ...p, endDate: e.target.value })); setRecurringPreview(null); }}
                              className="w-full bg-[#101728] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Quick range picks */}
                        <div className="flex items-center justify-between flex-wrap gap-1.5 pt-0.5">
                          <div className="flex flex-wrap gap-1.5">
                            {[7, 14, 30].map(d => (
                              <button key={d} type="button" onClick={() => handleRecurringQuickRange(d)}
                                className="px-2.5 py-1 bg-[#192337] hover:bg-[#202d46] border border-slate-700/60 text-[#79D9F5] rounded-lg text-[11px] font-bold cursor-pointer transition-colors">
                                {d} ngày
                              </button>
                            ))}
                            <button type="button" onClick={handleRecurringEndOfMonth}
                              className="px-2.5 py-1 bg-[#192337] hover:bg-[#202d46] border border-slate-700/60 text-[#79D9F5] rounded-lg text-[11px] font-bold cursor-pointer transition-colors">
                              Đến cuối tháng
                            </button>
                          </div>
                          <span className={`text-[11px] font-mono font-bold ${
                            recurringRangeMetrics.rangeDays > 30 ? 'text-rose-400' : 'text-[#94A3B8]'
                          }`}>
                            Phạm vi: {recurringRangeMetrics.rangeDays} ngày ({recurringRangeMetrics.matchedDaysCount} ngày khớp thứ)
                          </span>
                        </div>
                      </div>

                      {/* Day of week selector (Thứ 2 -> Chủ Nhật) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[#94A3B8] font-semibold text-xs">Các thứ trong tuần *</span>
                          <div className="flex gap-1.5">
                            {[
                              { label: 'Cả tuần', days: [1, 2, 3, 4, 5, 6, 0] },
                              { label: 'Ngày thường', days: [1, 2, 3, 4, 5] },
                              { label: 'Cuối tuần', days: [6, 0] },
                            ].map(({ label, days }) => (
                              <button key={label} type="button"
                                data-testid={`recurring-days-preset-${label}`}
                                onClick={() => { setRecurringData(p => ({ ...p, daysOfWeek: days })); setRecurringPreview(null); }}
                                className="text-[10px] px-2.5 py-1 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-[#79D9F5] border border-slate-700/50 rounded-lg font-bold cursor-pointer transition-colors">
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1.5">
                          {recurringDayLabels.map(({ label, fullLabel, value }) => {
                            const sel = recurringData.daysOfWeek.includes(value);
                            return (
                              <button key={value} type="button"
                                data-testid={`recurring-day-btn-${value}`}
                                title={fullLabel}
                                onClick={() => toggleDayOfWeek(value)}
                                className={`py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all flex flex-col items-center justify-center ${
                                  sel
                                    ? 'bg-[#078CA8] text-[#F1F5F9] border-[#79D9F5]/70 shadow-sm'
                                    : 'bg-[#080E1D] text-[#94A3B8] border-slate-700/60 hover:border-[#79D9F5]/40 hover:text-[#F1F5F9]'
                                }`}>
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Multi-slot time selector */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[#94A3B8] font-semibold text-xs">
                            Khung giờ chiếu (24h — Chọn nhiều khung giờ) *
                          </label>
                          <span className="text-[11px] text-[#79D9F5] font-mono font-bold">
                            Đã chọn: {recurringData.timeSlots.length} khung giờ
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {['08:30','09:30','10:30','12:00','13:15','14:30','16:00','17:30','19:00','19:30','20:30','21:30','22:30'].map(t => {
                            const sel = recurringData.timeSlots.includes(t);
                            return (
                              <button key={t} type="button"
                                data-testid={`recurring-slot-preset-${t}`}
                                onClick={() => toggleRecurringSlot(t)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold border cursor-pointer transition-all ${
                                  sel
                                    ? 'bg-[#078CA8] text-white border-[#79D9F5] shadow-sm'
                                    : 'bg-[#080E1D] text-[#79D9F5] border-slate-700/60 hover:border-[#79D9F5]/60 hover:bg-[#192337]'
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
                            data-testid="recurring-manual-time-input"
                            placeholder="Nhập giờ 24h HH:mm (VD: 15:45)"
                            list="davenor-24h-time-options"
                            value={recurringData.manualTimeInput}
                            onChange={e => setRecurringData(p => ({ ...p, manualTimeInput: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualTimeSlot(); } }}
                            className="flex-1 bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] placeholder-slate-500"
                            maxLength={5}
                          />
                          <button type="button"
                            data-testid="recurring-add-time-btn"
                            onClick={addManualTimeSlot}
                            className="px-3.5 py-2 bg-[#192337] hover:bg-[#202d46] text-[#79D9F5] border border-slate-700/60 rounded-xl text-xs font-bold cursor-pointer transition-colors">
                            + Thêm giờ
                          </button>
                        </div>
                        {/* Selected slots summary with per-slot availability from Preview */}
                        {recurringData.timeSlots.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {recurringData.timeSlots.map(t => {
                              const avail = recurringPreview?.slotAvailability?.[t];
                              return (
                                <span key={t} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#192337] border border-[#79D9F5]/40 rounded-lg text-[11px] font-mono text-[#79D9F5]">
                                  <strong>{t}</strong>
                                  {avail && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans font-bold ${
                                      avail.conflict === 0
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : avail.available > 0
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}>
                                      {avail.available}/{avail.available + avail.conflict} ngày
                                    </span>
                                  )}
                                  <button type="button" onClick={() => toggleRecurringSlot(t)}
                                    className="text-[#94A3B8] hover:text-rose-400 cursor-pointer transition-colors ml-0.5 font-bold">
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Pricing mode, Cleaning time & Skip conflicts option */}
                      <div className="bg-[#080E1D] border border-slate-800 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/70">
                          <span className="text-[#94A3B8] font-semibold">Giá vé từng suất:</span>
                          <div className="flex items-center gap-2.5">
                            <div className="flex rounded-lg overflow-hidden border border-slate-700/60 bg-[#192337] p-0.5 gap-0.5">
                              {[
                                { key: 'auto', label: 'Tự động theo khung giờ/phòng' },
                                { key: 'fixed', label: 'Cố định' },
                              ].map(({ key, label }) => (
                                <button key={key} type="button"
                                  onClick={() => { setRecurringData(p => ({ ...p, pricingMode: key })); setRecurringPreview(null); }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
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
                                  onChange={e => { setFormData(p => ({ ...p, price: Number(e.target.value) })); setRecurringPreview(null); }}
                                  className="w-24 bg-[#192337] border border-slate-700 rounded-lg px-2 py-1 text-right text-[#F1F5F9] font-mono font-bold text-xs focus:outline-none focus:border-[#79D9F5]"
                                />
                                <span className="text-[#79D9F5] font-bold">₫</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/70">
                          <span className="text-[#94A3B8] font-semibold">Thời gian dọn vệ sinh phòng:</span>
                          <select
                            data-testid="recurring-cleaning-select"
                            value={recurringData.cleaningMinutes || 20}
                            onChange={(e) => { setRecurringData(p => ({ ...p, cleaningMinutes: Number(e.target.value) })); setRecurringPreview(null); }}
                            className="bg-[#192337] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-[#F1F5F9] font-bold focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                          >
                            <option value={20}>20 phút (Chuẩn vận hành)</option>
                            <option value={15}>15 phút (Tối thiểu)</option>
                          </select>
                        </div>

                        <label className="flex items-center justify-between gap-3 cursor-pointer select-none pt-0.5">
                          <div>
                            <span className="text-[#F1F5F9] font-bold block">Bỏ qua các suất bị trùng lịch</span>
                            <span className="text-[11px] text-[#94A3B8]">
                              {recurringData.skipConflicts
                                ? 'Chỉ tạo các suất hợp lệ và tự động bỏ qua suất bị trùng mà không ghi đè suất cũ.'
                                : 'Chế độ nghiêm ngặt (All-or-Nothing): Chặn tạo nếu có bất kỳ suất nào bị trùng lịch.'}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            data-testid="recurring-skip-conflicts-checkbox"
                            checked={Boolean(recurringData.skipConflicts)}
                            onChange={(e) => setRecurringData(p => ({ ...p, skipConflicts: e.target.checked }))}
                            className="w-4 h-4 accent-[#078CA8] rounded cursor-pointer shrink-0"
                          />
                        </label>
                      </div>

                      {/* Pre-preview Summary card */}
                      <div className="bg-[#192337] border border-[#79D9F5]/20 rounded-xl px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                        <div className="text-[#94A3B8] text-xs">
                          <span>Dự kiến: </span>
                          <strong className="text-[#F1F5F9]">{recurringRangeMetrics.matchedDaysCount} ngày</strong>
                          <span> × </span>
                          <strong className="text-[#F1F5F9]">{recurringData.timeSlots.length} khung giờ</strong>
                        </div>
                        <span className={`font-bold text-sm font-mono ${
                          recurringExpectedCount > 180 ? 'text-rose-400' : 'text-[#79D9F5]'
                        }`}>
                          {recurringData.timeSlots.length > 0 && recurringData.daysOfWeek.length > 0
                            ? `${recurringExpectedCount} suất chiếu (${recurringExpectedCount * (Number(selectedRoom?.totalSeats) || 88)} ghế)`
                            : '—'}
                        </span>
                      </div>

                      {/* Preview button */}
                      <button
                        type="button"
                        data-testid="recurring-preview-btn"
                        onClick={handleRecurringPreview}
                        disabled={
                          recurringLoading ||
                          recurringData.timeSlots.length === 0 ||
                          recurringData.daysOfWeek.length === 0 ||
                          recurringRangeMetrics.rangeDays > 30 ||
                          recurringExpectedCount > 180
                        }
                        className="w-full py-2.5 bg-[#192337] hover:bg-[#202d46] disabled:opacity-40 disabled:cursor-not-allowed border border-[#79D9F5]/40 hover:border-[#79D9F5] text-[#79D9F5] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {recurringLoading ? (
                          <><span className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" /><span>Đang kiểm tra xung đột trên từng ngày & từng khung giờ...</span></>
                        ) : '🔍 Xem trước lịch chiếu'}
                      </button>

                      {/* Preview Result Panel */}
                      {recurringPreview && (() => {
                        const activeValidCount = Math.max(0, (recurringPreview.validCount || 0) - previewRemovedKeys.size);
                        const seatsPerSlot = Number(recurringPreview.totalSeatsPerShowtime) || Number(selectedRoom?.totalSeats) || 88;
                        const activeExpectedSeats = activeValidCount * seatsPerSlot;
                        return (
                          <div className="space-y-2.5 bg-[#080E1D]/90 border border-[#79D9F5]/30 rounded-xl p-3" data-testid="recurring-preview-panel">
                            {/* Header Metadata Summary */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                              <div>
                                <div className="text-xs font-bold text-white">
                                  🎬 {recurringPreview.movieTitle || selectedMovie?.title} ({recurringPreview.duration || selectedMovie?.duration} phút)
                                </div>
                                <div className="text-[11px] text-[#79D9F5] font-semibold">
                                  🏛️ {recurringPreview.roomName || selectedRoom?.name} • {recurringPreview.formatFeature || selectedFormat} • Vệ sinh {recurringPreview.cleaningMinutes || 20} phút
                                </div>
                              </div>
                              <div className="text-right font-mono text-[11px] text-[#94A3B8]">
                                <div>📅 {recurringPreview.startDate} → {recurringPreview.endDate}</div>
                                <div>Số ngày thực tế được chọn: <strong className="text-white">{recurringPreview.selectedDaysCount} ngày</strong></div>
                              </div>
                            </div>

                            {/* 4 KPI cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="bg-[#101728] border border-slate-800 rounded-xl p-2">
                                <span className="text-[10px] text-[#94A3B8] block">Tổng số suất dự kiến</span>
                                <span className="text-sm font-black text-white font-mono" data-testid="recurring-preview-total">
                                  {recurringPreview.totalExpected}
                                </span>
                              </div>
                              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2">
                                <span className="text-[10px] text-emerald-300 block">Số suất hợp lệ</span>
                                <span className="text-sm font-black text-emerald-400 font-mono" data-testid="recurring-preview-valid">
                                  {activeValidCount}
                                </span>
                              </div>
                              <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-2">
                                <span className="text-[10px] text-rose-300 block">Số suất xung đột</span>
                                <span className="text-sm font-black text-rose-400 font-mono" data-testid="recurring-preview-conflict">
                                  {recurringPreview.conflictCount}
                                </span>
                              </div>
                              <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-2">
                                <span className="text-[10px] text-cyan-300 block">Tổng số ghế hợp lệ</span>
                                <span className="text-sm font-black text-[#79D9F5] font-mono" data-testid="recurring-preview-seats">
                                  {activeExpectedSeats.toLocaleString('vi-VN')} ghế
                                </span>
                              </div>
                            </div>

                            {/* Warning banner if conflicts exist and skipConflicts is false */}
                            {recurringPreview.conflictCount > 0 && !recurringData.skipConflicts && (
                              <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl px-3 py-2 text-[11px] text-rose-200 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                <span>
                                  Phát hiện <strong>{recurringPreview.conflictCount} suất xung đột</strong>. Vui lòng bật tùy chọn <strong>"Bỏ qua các suất bị trùng lịch"</strong> hoặc đổi khung giờ để tiếp tục tạo.
                                </span>
                              </div>
                            )}

                            {/* Filter tabs */}
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
                                        : 'bg-[#101728] text-[#94A3B8] border-slate-700/60 hover:text-[#F1F5F9]'
                                    }`}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <span className="text-[#94A3B8] text-[11px]">
                                Sẵn sàng tạo: <span className="text-emerald-400 font-bold">{activeValidCount} suất</span> ({activeExpectedSeats} ghế)
                              </span>
                            </div>

                            {/* Table */}
                            <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl bg-[#101728]">
                              <table className="w-full text-[11px]">
                                <thead className="sticky top-0 bg-[#192337] border-b border-slate-800 z-10">
                                  <tr>
                                    {['Ngày chiếu', 'Thứ', 'Bắt đầu', 'Kết thúc', 'Vệ sinh xong', 'Giá vé', 'Trạng thái / Lý do'].map(h => (
                                      <th key={h} className="px-2 py-2 text-left text-[#94A3B8] font-semibold whitespace-nowrap">{h}</th>
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
                                          data-testid={`recurring-preview-row-${i}`}
                                          className={`border-b border-slate-800/60 ${
                                            removed ? 'opacity-30 line-through' :
                                            isConflict ? 'bg-rose-950/25' : 'hover:bg-[#192337]/50'
                                          }`}>
                                          <td className="px-2 py-1.5 font-mono text-[#F1F5F9] whitespace-nowrap">{s.date}</td>
                                          <td className="px-2 py-1.5 text-[#94A3B8] whitespace-nowrap">{dayNames[s.dayOfWeek]}</td>
                                          <td className="px-2 py-1.5 font-mono font-bold text-[#79D9F5] whitespace-nowrap">{s.startTimeText || toLocalTime(s.startTime)}</td>
                                          <td className="px-2 py-1.5 font-mono text-[#E5C07B] whitespace-nowrap">{s.endTimeText || toLocalTime(s.endTime)}</td>
                                          <td className="px-2 py-1.5 font-mono text-[#34D399] whitespace-nowrap">
                                            {s.cleaningEndTimeText || toLocalTime(s.cleanReadyTime)} (+{s.cleaningMinutes || recurringPreview.cleaningMinutes || 20}p)
                                          </td>
                                          <td className="px-2 py-1.5 font-mono font-bold text-[#F1F5F9] whitespace-nowrap">
                                            {s.price ? `${Number(s.price).toLocaleString('vi-VN')}₫` : '—'}
                                          </td>
                                          <td className="px-2 py-1.5">
                                            {isConflict
                                              ? <span className="text-rose-400 font-bold">⚠ {s.conflictReason || s.reason || 'Xung đột'}</span>
                                              : <span className="text-emerald-400 font-bold">✓ Hợp lệ ({s.totalSeats || 88} ghế)</span>
                                            }
                                          </td>
                                          <td className="px-2 py-1.5 whitespace-nowrap">
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
                        );
                      })()}
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
                      <label className="block text-[#94A3B8] font-semibold text-xs mb-1">Giờ bắt đầu (24h — HH:mm) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="HH:mm (VD: 18:00)"
                        maxLength={5}
                        list="davenor-24h-time-options"
                        required
                        value={formTime}
                        onChange={(e) => handleFormTimeChange(e.target.value)}
                        className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono font-bold focus:outline-none focus:border-[#79D9F5]"
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
                          ← Chỉnh lại
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="recurring-commit-btn"
                        onClick={handleRecurringCommit}
                        disabled={
                          recurringCommitting ||
                          !recurringPreview ||
                          (recurringPreview.validCount - previewRemovedKeys.size) <= 0 ||
                          (!recurringData.skipConflicts && Number(recurringPreview.conflictCount) > 0)
                        }
                        className="px-5 py-2 bg-[#078CA8] hover:bg-[#067a93] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
                        {recurringCommitting
                          ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Đang tạo lịch...</span></>
                          : recurringPreview
                            ? `Xác nhận tạo lịch (${Math.max(0, recurringPreview.validCount - previewRemovedKeys.size)} suất)`
                            : 'Xác nhận tạo lịch'}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL LÊN LỊCH CHIẾU HÀNG LOẠT THÔNG MINH (SMART & MANUAL + PREVIEW)      */}
          {/* ========================================================================= */}
          {isBatchModalOpen && (() => {
            const normBatchQuery = batchMovieSearch
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[đĐ]/g, 'd')
              .toLowerCase()
              .trim();

            const filteredBatchMovies = movies.filter((m) => {
              if (!normBatchQuery) return true;
              const titleNorm = String(m.title || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[đĐ]/g, 'd')
                .toLowerCase();
              return titleNorm.includes(normBatchQuery);
            });

            const allRoomIds = sortedPhysicalRooms.map((r) => String(r.id || r._id));
            const isAllRoomsSelected =
              allRoomIds.length > 0 && allRoomIds.every((id) => batchData.roomIds.includes(id));

            const previewAllSlots = Array.isArray(batchPreview?.allSlots)
              ? batchPreview.allSlots
              : [
                  ...(Array.isArray(batchPreview?.validSlots)
                    ? batchPreview.validSlots.map((s) => ({ ...s, status: 'VALID' }))
                    : []),
                  ...(Array.isArray(batchPreview?.conflictSlots)
                    ? batchPreview.conflictSlots.map((s) => ({ ...s, status: 'CONFLICT' }))
                    : []),
                ];

            const displayedPreviewSlots = previewAllSlots.filter((s) => {
              if (batchPreviewFilter === 'VALID') return s.status === 'VALID';
              if (batchPreviewFilter === 'CONFLICT') return s.status === 'CONFLICT';
              return true;
            });

            // Nhóm lịch dự kiến theo Ngày & Phòng để cho phép thu gọn / mở rộng
            const groupedPreviewByDayRoom = (() => {
              const map = new Map();
              for (const slot of displayedPreviewSlots) {
                const gKey = `${slot.date}||${slot.roomId || slot.roomName}`;
                if (!map.has(gKey)) {
                  const summary = (batchPreview?.roomDaySummaries || []).find(
                    (r) => r.date === slot.date && String(r.roomId) === String(slot.roomId)
                  );
                  map.set(gKey, {
                    groupKey: gKey,
                    date: slot.date,
                    roomId: slot.roomId,
                    roomName: slot.roomName,
                    roomType: slot.roomType || resolveCanonicalRoomType(slot),
                    summary,
                    slots: [],
                  });
                }
                map.get(gKey).slots.push(slot);
              }
              return Array.from(map.values());
            })();

            const canPreview =
              !batchLoading &&
              Boolean(batchData.startDate) &&
              Boolean(batchData.endDate) &&
              batchData.selectedMovieIds.length > 0 &&
              batchData.roomIds.length > 0 &&
              (batchData.scheduleMode === 'smart' || batchData.timeSlots.length > 0);

            const canConfirm =
              !batchLoading &&
              Boolean(batchPreview) &&
              Number(batchPreview?.validCount) > 0 &&
              batchData.selectedMovieIds.length > 0 &&
              batchData.roomIds.length > 0;

            return (
              <div
                data-testid="batch-schedule-modal"
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-fadeIn"
              >
                <div
                  className={`bg-[#0B1120] border border-slate-800 w-full ${
                    batchPreview ? 'max-w-[1060px]' : 'max-w-[760px]'
                  } rounded-[24px] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-slate-100 transition-all`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between border-b border-slate-800/80 pb-3.5">
                    <div>
                      <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-tight">
                        <span className="text-amber-400">⚡</span>
                        <span>Lên lịch chiếu hàng loạt thông minh</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tự động phân bổ suất chiếu cho 9 phòng vật lý, chống trùng lịch và tạo đủ 88 ghế.
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="close-batch-modal-btn"
                      onClick={() => setIsBatchModalOpen(false)}
                      className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer border border-slate-800"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Thanh quy tắc giờ hoạt động của rạp */}
                  <div className="bg-[#081C2E]/80 border border-cyan-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-cyan-300 font-semibold flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Giờ hoạt động của rạp</span>
                    </span>
                    <span className="font-mono font-black text-cyan-300">
                      08:00 – 02:00 (+1 ngày)
                    </span>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Khoảng ngày (mặc định theo viewDate trên Timeline) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Từ ngày *</label>
                        <input
                          type="date"
                          data-testid="batch-start-date"
                          value={batchData.startDate}
                          onChange={(e) => updateBatchField({ startDate: e.target.value })}
                          className="w-full bg-[#070B16] border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Đến ngày *</label>
                        <input
                          type="date"
                          data-testid="batch-end-date"
                          value={batchData.endDate}
                          onChange={(e) => updateBatchField({ endDate: e.target.value })}
                          className="w-full bg-[#070B16] border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Chọn phim (Mặc định 0 phim được chọn, có tìm kiếm, Chọn tất cả / Bỏ chọn tất cả và hiển thị thời lượng thực tế) */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-slate-200 font-bold">
                          Chọn phim (<span data-testid="batch-selected-movies-count" className="text-cyan-400">{batchData.selectedMovieIds.length}</span> phim đã chọn)
                        </label>
                        <div className="flex items-center gap-3 text-[11px] font-bold">
                          <button
                            type="button"
                            data-testid="batch-select-all-movies-btn"
                            onClick={() =>
                              updateBatchField({
                                selectedMovieIds: filteredBatchMovies.map((m) => String(m.id || m._id)),
                              })
                            }
                            className="text-cyan-400 hover:text-cyan-300 cursor-pointer"
                          >
                            Chọn tất cả
                          </button>
                          <span className="text-slate-700">|</span>
                          <button
                            type="button"
                            data-testid="batch-clear-all-movies-btn"
                            onClick={() => updateBatchField({ selectedMovieIds: [] })}
                            className="text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            Bỏ chọn tất cả
                          </button>
                        </div>
                      </div>

                      {/* Ô tìm kiếm phim */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          data-testid="batch-movie-search-input"
                          value={batchMovieSearch}
                          onChange={(e) => setBatchMovieSearch(e.target.value)}
                          placeholder="Tìm kiếm phim theo tên..."
                          className="w-full bg-[#070B16] border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                        />
                        {batchMovieSearch && (
                          <button
                            type="button"
                            onClick={() => setBatchMovieSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Lưới thẻ checkbox phim */}
                      <div
                        data-testid="batch-movies-grid"
                        className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1"
                      >
                        {filteredBatchMovies.map((m) => {
                          const mId = String(m.id || m._id);
                          const isSelected = batchData.selectedMovieIds.includes(mId);
                          const dur = Number(m.duration) || 120;
                          return (
                            <div
                              key={mId}
                              data-testid={`batch-movie-option-${mId}`}
                              data-selected={isSelected ? 'true' : 'false'}
                              onClick={() => {
                                updateBatchField((prev) => {
                                  const exists = prev.selectedMovieIds.includes(mId);
                                  return {
                                    ...prev,
                                    selectedMovieIds: exists
                                      ? prev.selectedMovieIds.filter((id) => id !== mId)
                                      : [...prev.selectedMovieIds, mId],
                                  };
                                });
                              }}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                                isSelected
                                  ? 'bg-[#082B3E]/90 border-[#22D3EE] text-white shadow-[0_0_12px_rgba(34,211,238,0.18)]'
                                  : 'bg-[#070B16] border-slate-800/90 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full mt-0.5 flex items-center justify-center shrink-0 border transition-colors ${
                                  isSelected
                                    ? 'bg-[#22D3EE] border-[#22D3EE] text-slate-950'
                                    : 'border-slate-600 bg-transparent'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-[11px] text-white truncate" title={m.title}>
                                  {m.title}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  {dur} phút
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chọn 9 phòng vật lý với 3 bảng màu nhận diện chuẩn: IMAX Laser (Cyan), Dolby Atmos (Purple), Gold Class (Gold) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-200 font-bold">
                          Chọn phòng chiếu (<span data-testid="batch-selected-rooms-count" className="text-cyan-400">{batchData.roomIds.length}</span>/{sortedPhysicalRooms.length})
                        </label>
                        <div className="flex items-center gap-3 text-[11px] font-bold">
                          <button
                            type="button"
                            data-testid="batch-select-all-rooms-btn"
                            onClick={() => updateBatchField({ roomIds: allRoomIds })}
                            className="text-cyan-400 hover:text-cyan-300 cursor-pointer"
                          >
                            Chọn tất cả
                          </button>
                          <span className="text-slate-700">|</span>
                          <button
                            type="button"
                            data-testid="batch-clear-all-rooms-btn"
                            onClick={() => updateBatchField({ roomIds: [] })}
                            className="text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            Bỏ chọn tất cả
                          </button>
                        </div>
                      </div>

                      <div data-testid="batch-rooms-grid" className="grid grid-cols-3 gap-2">
                        {sortedPhysicalRooms.map((r, idx) => {
                          const rId = String(r.id || r._id);
                          const isSelected = batchData.roomIds.includes(rId);
                          const canonicalType = resolveCanonicalRoomType(r);
                          const numMatch = r.name?.match(/\d+/);
                          const roomNumStr = r.roomNumber
                            ? String(r.roomNumber).padStart(2, '0')
                            : numMatch
                            ? String(numMatch[0]).padStart(2, '0')
                            : String(idx + 1).padStart(2, '0');

                          const isImax = canonicalType === 'IMAX Laser';
                          const isAtmos = canonicalType === 'Dolby Atmos';

                          // Phân biệt rõ 3 màu: IMAX Laser (#22D3EE Cyan), Dolby Atmos (#C084FC Purple), Gold Class (#F6CF65 Gold)
                          const selectedCardClass = isImax
                            ? 'bg-[#082B3E]/85 border-[#22D3EE] text-white shadow-[0_0_12px_rgba(34,211,238,0.16)]'
                            : isAtmos
                            ? 'bg-[#22133B]/85 border-[#C084FC] text-white shadow-[0_0_12px_rgba(192,132,252,0.16)]'
                            : 'bg-[#2D220E]/85 border-[#F6CF65] text-white shadow-[0_0_12px_rgba(246,207,101,0.16)]';

                          const unselectedCardClass = isImax
                            ? 'bg-[#070B16] border-[#22D3EE]/25 text-slate-400 hover:border-[#22D3EE]/50'
                            : isAtmos
                            ? 'bg-[#070B16] border-[#C084FC]/25 text-slate-400 hover:border-[#C084FC]/50'
                            : 'bg-[#070B16] border-[#F6CF65]/25 text-slate-400 hover:border-[#F6CF65]/50';

                          const techLabelColor = isImax
                            ? 'text-[#22D3EE]'
                            : isAtmos
                            ? 'text-[#C084FC]'
                            : 'text-[#F6CF65]';

                          const checkCircleClass = isSelected
                            ? isImax
                              ? 'bg-[#22D3EE] border-[#22D3EE] text-slate-950'
                              : isAtmos
                              ? 'bg-[#C084FC] border-[#C084FC] text-slate-950'
                              : 'bg-[#F6CF65] border-[#F6CF65] text-slate-950'
                            : 'border-slate-600 bg-transparent';

                          return (
                            <div
                              key={rId}
                              data-testid={`batch-room-option-${roomNumStr}`}
                              data-room-type={canonicalType}
                              data-selected={isSelected ? 'true' : 'false'}
                              onClick={() => {
                                updateBatchField((prev) => {
                                  const exists = prev.roomIds.includes(rId);
                                  return {
                                    ...prev,
                                    roomIds: exists
                                      ? prev.roomIds.filter((id) => id !== rId)
                                      : [...prev.roomIds, rId],
                                  };
                                });
                              }}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                                isSelected ? selectedCardClass : unselectedCardClass
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full mt-0.5 flex items-center justify-center shrink-0 border transition-colors ${checkCircleClass}`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-white leading-tight">
                                  Phòng {roomNumStr}
                                </div>
                                <div className={`text-[11px] font-semibold truncate mt-0.5 ${techLabelColor}`}>
                                  {canonicalType}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Phương thức xếp lịch: Chế độ A (Xếp lịch thông minh - mặc định) | Chế độ B (Tùy chỉnh khung giờ) */}
                    <div className="space-y-3 pt-1">
                      <label className="block text-slate-200 font-bold">Phương thức xếp lịch</label>
                      <div className="inline-flex items-center bg-[#070B16] p-1 rounded-xl border border-slate-800 gap-1">
                        <button
                          type="button"
                          data-testid="batch-mode-smart-btn"
                          onClick={() => updateBatchField({ scheduleMode: 'smart' })}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            batchData.scheduleMode === 'smart'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>⚡</span>
                          <span>Xếp lịch thông minh</span>
                        </button>
                        <button
                          type="button"
                          data-testid="batch-mode-manual-btn"
                          onClick={() => updateBatchField({ scheduleMode: 'manual' })}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            batchData.scheduleMode === 'manual'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>🕒</span>
                          <span>Tùy chỉnh khung giờ</span>
                        </button>
                      </div>

                      <datalist id="davenor-24h-time-options">
                        {[
                          '08:00', '08:30', '09:00', '09:15', '09:30', '09:45',
                          '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '12:45',
                          '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
                          '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
                          '19:00', '19:15', '19:30', '20:00', '20:30', '21:00',
                          '21:30', '21:45', '22:00', '22:15', '22:30',
                        ].map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>

                      {batchData.scheduleMode === 'smart' ? (
                        /* ── CHẾ ĐỘ A: XẾP LỊCH THÔNG MINH (KHUNG GIỜ 24H) ── */
                        <div className="space-y-3 bg-[#070B16]/80 border border-slate-800/90 rounded-2xl p-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">
                                Giờ chiếu đầu tiên (24h)
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="09:30"
                                  maxLength={5}
                                  list="davenor-24h-time-options"
                                  data-testid="batch-first-showtime-input"
                                  value={batchData.firstShowtimeTime}
                                  onChange={(e) => updateBatchField({ firstShowtimeTime: e.target.value })}
                                  className="w-full bg-[#0B1120] border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 pr-12 text-white font-mono font-bold text-xs focus:outline-none"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-cyan-400/80 pointer-events-none">
                                  24H
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">
                                Giờ bắt đầu muộn nhất (24h, tối đa 22:30)
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="22:30"
                                  maxLength={5}
                                  list="davenor-24h-time-options"
                                  data-testid="batch-latest-start-input"
                                  value={batchData.latestStartTime}
                                  onChange={(e) => updateBatchField({ latestStartTime: e.target.value })}
                                  className="w-full bg-[#0B1120] border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 pr-12 text-white font-mono font-bold text-xs focus:outline-none"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-cyan-400/80 pointer-events-none">
                                  24H
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">
                                Số suất mong muốn / phòng
                              </label>
                              <select
                                data-testid="batch-target-slots-select"
                                disabled={batchData.optimizeMaxSlots}
                                value={batchData.targetSlotsPerRoom}
                                onChange={(e) => updateBatchField({ targetSlotsPerRoom: Number(e.target.value) })}
                                className={`w-full bg-[#0B1120] border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-white font-bold text-xs focus:outline-none ${
                                  batchData.optimizeMaxSlots ? 'opacity-40 cursor-not-allowed' : ''
                                }`}
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                  <option key={n} value={n}>
                                    {n} suất
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">
                                Thời gian vệ sinh phòng
                              </label>
                              <select
                                data-testid="batch-cleaning-minutes-select"
                                value={batchData.cleaningMinutes}
                                onChange={(e) => updateBatchField({ cleaningMinutes: Number(e.target.value) })}
                                className="w-full bg-[#0B1120] border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-white font-bold text-xs focus:outline-none"
                              >
                                <option value={20}>20 phút</option>
                                <option value={15}>15 phút</option>
                              </select>
                            </div>
                          </div>

                          {/* Hai lựa chọn loại trừ lẫn nhau: A. Xếp theo số suất mong muốn vs B. Tối ưu số suất tối đa */}
                          <div className="space-y-2 pt-1">
                            <span className="block text-slate-400 font-semibold text-[11px]">
                              Chế độ phân bổ số suất mỗi phòng (loại trừ lẫn nhau):
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div
                                data-testid="batch-allocation-target-radio"
                                onClick={() => updateBatchField({ optimizeMaxSlots: false })}
                                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                  !batchData.optimizeMaxSlots
                                    ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                    : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="slotAllocationMode"
                                  checked={!batchData.optimizeMaxSlots}
                                  onChange={() => updateBatchField({ optimizeMaxSlots: false })}
                                  className="mt-0.5 accent-cyan-400 cursor-pointer"
                                />
                                <div>
                                  <div className="font-bold text-xs text-white">
                                    A. Xếp theo số suất mong muốn ({batchData.targetSlotsPerRoom} suất/phòng)
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    Phân bổ cân đối Sáng – Trưa – Chiều – Tối – Đêm, không vượt quá {batchData.targetSlotsPerRoom} suất/phòng.
                                  </div>
                                </div>
                              </div>

                              <div
                                data-testid="batch-optimize-slots-checkbox"
                                onClick={() => updateBatchField({ optimizeMaxSlots: true })}
                                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                  batchData.optimizeMaxSlots
                                    ? 'bg-amber-950/40 border-amber-400 text-white'
                                    : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="slotAllocationMode"
                                  checked={batchData.optimizeMaxSlots}
                                  onChange={() => updateBatchField({ optimizeMaxSlots: true })}
                                  className="mt-0.5 accent-amber-400 cursor-pointer"
                                />
                                <div>
                                  <div className="font-bold text-xs text-white">
                                    B. Tối ưu số suất tối đa
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    Tự tính số suất hợp lệ tối đa theo thời lượng phim (vô hiệu hóa số suất cố định).
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-0.5">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-200 font-semibold">
                              <input
                                type="checkbox"
                                data-testid="batch-stagger-rooms-checkbox"
                                checked={batchData.staggerRooms}
                                onChange={(e) => updateBatchField({ staggerRooms: e.target.checked })}
                                className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                              />
                              <span>Tự động xếp lệch giờ giữa các phòng</span>
                            </label>
                          </div>

                          <div className="bg-[#081C2E]/70 border border-cyan-500/25 rounded-xl p-3 text-[11px] text-cyan-200/90 leading-relaxed">
                            💡 Hệ thống tự tính thời lượng thực tế từng phim và thời gian vệ sinh ({batchData.cleaningMinutes} phút), làm tròn giờ bắt đầu suất kế tiếp lên mốc 5 phút. Tất cả phim phải kết thúc và vệ sinh xong trước <strong>02:00 sáng (+1 ngày)</strong>.
                          </div>
                        </div>
                      ) : (
                        /* ── CHẾ ĐỘ B: TÙY CHỈNH KHUNG GIỜ ── */
                        <div className="space-y-3 bg-[#070B16]/80 border border-slate-800/90 rounded-2xl p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-slate-300 font-semibold">
                              Danh sách khung giờ bắt đầu ({batchData.timeSlots.length} khung giờ):
                            </span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 text-[11px]">Vệ sinh:</span>
                                <select
                                  data-testid="batch-manual-cleaning-select"
                                  value={batchData.cleaningMinutes}
                                  onChange={(e) => updateBatchField({ cleaningMinutes: Number(e.target.value) })}
                                  className="bg-[#0B1120] border border-slate-800 rounded-lg px-2 py-1 text-white font-bold text-xs"
                                >
                                  <option value={20}>20 phút</option>
                                  <option value={15}>15 phút</option>
                                </select>
                              </div>
                              <button
                                type="button"
                                data-testid="batch-reset-timeslots-btn"
                                onClick={handleResetBatchTimeSlots}
                                className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                              >
                                Khôi phục giờ mặc định
                              </button>
                            </div>
                          </div>

                          {/* Danh sách chip giờ 24h có thể chỉnh sửa và xóa */}
                          <div data-testid="batch-manual-timeslots-list" className="flex flex-wrap gap-2">
                            {batchData.timeSlots.map((slot, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1 bg-[#0B1120] border border-cyan-500/40 rounded-xl px-2.5 py-1.5"
                              >
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="HH:mm"
                                  maxLength={5}
                                  list="davenor-24h-time-options"
                                  data-testid={`batch-timeslot-input-${idx}`}
                                  value={slot}
                                  onChange={(e) => handleUpdateBatchTimeSlot(idx, e.target.value)}
                                  className="w-14 bg-transparent text-cyan-300 font-mono font-bold text-xs text-center focus:outline-none"
                                />
                                <button
                                  type="button"
                                  data-testid={`batch-timeslot-delete-${idx}`}
                                  onClick={() => handleDeleteBatchTimeSlot(idx)}
                                  className="text-slate-400 hover:text-rose-400 ml-1 font-bold cursor-pointer"
                                  title="Xóa khung giờ này"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Thêm giờ mới (Định dạng 24h HH:mm) */}
                          <div className="flex items-center gap-2 pt-1">
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="HH:mm (VD: 21:45)"
                                maxLength={5}
                                list="davenor-24h-time-options"
                                data-testid="batch-add-timeslot-input"
                                value={batchNewTimeInput}
                                onChange={(e) => setBatchNewTimeInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddBatchTimeSlot();
                                  }
                                }}
                                className="w-40 bg-[#0B1120] border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-1.5 pr-10 text-white font-mono font-bold text-xs focus:outline-none"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-cyan-400/70 pointer-events-none">
                                24H
                              </span>
                            </div>
                            <button
                              type="button"
                              data-testid="batch-add-timeslot-btn"
                              onClick={handleAddBatchTimeSlot}
                              className="px-3.5 py-1.5 rounded-xl bg-cyan-600/25 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 font-bold text-xs transition-all cursor-pointer"
                            >
                              + Thêm giờ
                            </button>
                          </div>

                          {batchTimeSlotError && (
                            <div
                              data-testid="batch-timeslot-error"
                              className="text-[11px] text-rose-400 font-semibold bg-rose-950/40 border border-rose-500/30 rounded-xl px-3 py-2"
                            >
                              ⚠️ {batchTimeSlotError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tóm tắt lựa chọn + Nút Xem trước lịch dự kiến */}
                    <div className="bg-[#070B16] border border-slate-800/90 rounded-2xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Số phim được chọn</span>
                          <span className="text-base font-black text-cyan-400">
                            {batchData.selectedMovieIds.length} phim
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Số phòng được chọn</span>
                          <span className="text-base font-black text-purple-400">
                            {batchData.roomIds.length} phòng
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid="batch-preview-btn"
                        onClick={handlePreviewBatch}
                        disabled={!canPreview}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-white disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow"
                      >
                        {batchLoading ? (
                          <>
                            <span className="animate-spin">🔄</span>
                            <span>Đang tính toán lịch chiếu dự kiến...</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="w-4 h-4" />
                            <span>Xem trước lịch dự kiến</span>
                          </>
                        )}
                      </button>

                      {!batchPreview && (
                        <p className="text-[11px] text-slate-400 text-center">
                          {batchData.selectedMovieIds.length === 0
                            ? 'Vui lòng tích chọn ít nhất 1 bộ phim để xem trước lịch dự kiến.'
                            : 'Xác nhận tạo lịch chỉ được bật sau khi kiểm tra Preview hợp lệ.'}
                        </p>
                      )}
                    </div>

                    {/* Bảng chi tiết Kết quả Preview (Tách riêng Hợp lệ, Xung đột thực sự & Không đủ thời gian bố trí) */}
                    {batchPreview && (
                      <div
                        data-testid="batch-preview-results"
                        className="bg-[#070B16] border border-cyan-500/30 rounded-2xl p-4 space-y-3.5"
                      >
                        {/* 6 Thẻ bộ đếm Preview độc lập (Section VII) */}
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                          <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-2">
                            <span className="text-[10px] text-slate-400 block">Số ngày xếp lịch</span>
                            <span className="text-sm font-black text-white font-mono" data-testid="batch-preview-days-count">
                              {batchPreview.totalDays || 1} ngày
                            </span>
                          </div>
                          <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-2">
                            <span className="text-[10px] text-slate-400 block">Số phim đã chọn</span>
                            <span className="text-sm font-black text-cyan-300 font-mono">
                              {batchPreview.selectedMoviesCount ?? batchData.selectedMovieIds.length} phim
                            </span>
                          </div>
                          <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-2">
                            <span className="text-[10px] text-slate-400 block">Số phòng đã chọn</span>
                            <span className="text-sm font-black text-purple-300 font-mono">
                              {batchPreview.selectedRoomsCount ?? batchData.roomIds.length} phòng
                            </span>
                          </div>
                          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-2">
                            <span className="text-[10px] text-emerald-300 block">Suất hợp lệ</span>
                            <span className="text-sm font-black text-emerald-400 font-mono" data-testid="batch-preview-valid-count">
                              {batchPreview.validCount}
                            </span>
                          </div>
                          <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-2">
                            <span className="text-[10px] text-rose-300 block">Xung đột thực sự</span>
                            <span className="text-sm font-black text-rose-400 font-mono" data-testid="batch-preview-conflict-count">
                              {batchPreview.conflictCount || 0}
                            </span>
                          </div>
                          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2">
                            <span className="text-[10px] text-amber-300 block">Thiếu quỹ thời gian</span>
                            <span className="text-sm font-black text-amber-400 font-mono" data-testid="batch-preview-unallocated-count">
                              {batchPreview.unallocatedCount || 0}
                            </span>
                          </div>
                        </div>

                        {/* Thông báo tổng kết bố trí (VD: "Đã bố trí 42/45 suất. Có 3 suất không đủ thời gian để bố trí.") */}
                        {batchPreview.allocationSummaryText && (
                          <div
                            data-testid="batch-preview-allocation-summary"
                            className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 border ${
                              (batchPreview.unallocatedCount || 0) > 0
                                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                            }`}
                          >
                            <span>📌 {batchPreview.allocationSummaryText}</span>
                            {!batchData.optimizeMaxSlots && batchPreview.requestedTotalSlots && (
                              <span className="font-mono text-[11px] shrink-0">
                                {batchPreview.validCount}/{batchPreview.requestedTotalSlots} suất
                              </span>
                            )}
                          </div>
                        )}

                        {/* Vùng hiển thị riêng chi tiết lỗi xung đột thực sự (nếu có) để không làm cao dòng bảng */}
                        {Array.isArray(batchPreview.conflictSlots) && batchPreview.conflictSlots.length > 0 && (
                          <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-3 space-y-1.5 text-[11px]">
                            <div className="font-bold text-rose-300">
                              ⚠️ Chi tiết {batchPreview.conflictSlots.length} xung đột chồng lấn phòng chiếu:
                            </div>
                            <div className="max-h-24 overflow-y-auto space-y-1 pr-1 font-mono text-rose-200">
                              {batchPreview.conflictSlots.map((c, i) => (
                                <div key={i}>
                                  • [{c.date} • {c.startTimeText || c.time}] {c.roomName} ({c.movieTitle}): {c.reason}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Thanh lọc bảng & nút Thu gọn / Mở rộng các nhóm Ngày - Phòng */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              📊 Chi tiết lịch dự kiến theo Ngày & Phòng ({groupedPreviewByDayRoom.length} nhóm):
                            </span>
                            <button
                              type="button"
                              onClick={() => setCollapsedPreviewGroups(new Set())}
                              className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                            >
                              Mở rộng tất cả
                            </button>
                            <span className="text-slate-700">|</span>
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedPreviewGroups(new Set(groupedPreviewByDayRoom.map((g) => g.groupKey)))
                              }
                              className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                            >
                              Thu gọn tất cả
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setBatchPreviewFilter('ALL')}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                                batchPreviewFilter === 'ALL'
                                  ? 'bg-slate-800 text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Tất cả ({previewAllSlots.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setBatchPreviewFilter('VALID')}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                                batchPreviewFilter === 'VALID'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                  : 'text-emerald-400 hover:text-emerald-300'
                              }`}
                            >
                              ✓ Hợp lệ ({batchPreview.validCount})
                            </button>
                            {batchPreview.conflictCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setBatchPreviewFilter('CONFLICT')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                                  batchPreviewFilter === 'CONFLICT'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                    : 'text-rose-400 hover:text-rose-300'
                                }`}
                              >
                                ✗ Xung đột ({batchPreview.conflictCount})
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Danh sách nhóm theo Ngày & Phòng + Bảng 10 cột chuẩn (Section VIII) */}
                        <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                          {groupedPreviewByDayRoom.map((group) => {
                            const isCollapsed = collapsedPreviewGroups.has(group.groupKey);
                            const isImax = group.roomType === 'IMAX Laser';
                            const isAtmos = group.roomType === 'Dolby Atmos';
                            const roomBadgeClass = isImax
                              ? 'text-[#22D3EE] border-[#22D3EE]/40 bg-[#22D3EE]/10'
                              : isAtmos
                              ? 'text-[#C084FC] border-[#C084FC]/40 bg-[#C084FC]/10'
                              : 'text-[#F6CF65] border-[#F6CF65]/40 bg-[#F6CF65]/10';
                            const roomTextClass = isImax
                              ? 'text-[#22D3EE]'
                              : isAtmos
                              ? 'text-[#C084FC]'
                              : 'text-[#F6CF65]';

                            const validInGroup = group.slots.filter((s) => s.status === 'VALID').length;
                            const reqInGroup = group.summary?.requestedSlots;

                            return (
                              <div
                                key={group.groupKey}
                                className="border border-slate-800/90 rounded-xl overflow-hidden bg-[#0B1120]"
                              >
                                <div
                                  onClick={() => {
                                    setCollapsedPreviewGroups((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(group.groupKey)) next.delete(group.groupKey);
                                      else next.add(group.groupKey);
                                      return next;
                                    });
                                  }}
                                  className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-900 flex items-center justify-between cursor-pointer border-b border-slate-800/70"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono font-bold text-slate-300 text-xs">
                                      📅 {group.date}
                                    </span>
                                    <span className={`font-bold text-xs ${roomTextClass}`}>
                                      {group.roomName}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${roomBadgeClass}`}>
                                      {group.roomType}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px]">
                                    {group.summary?.note && (
                                      <span className="text-amber-300 text-[10px]" title={group.summary.note}>
                                        ⚠️ Thiếu {group.summary.unallocatedSlots} suất
                                      </span>
                                    )}
                                    <span className="font-mono font-bold text-emerald-400">
                                      {reqInGroup ? `${validInGroup}/${reqInGroup} suất` : `${validInGroup} suất`}
                                    </span>
                                    <span className="text-slate-400 text-[10px]">
                                      {isCollapsed ? '▼ Mở' : '▲ Thu gọn'}
                                    </span>
                                  </div>
                                </div>

                                {!isCollapsed && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-[11px]">
                                      <thead>
                                        <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-bold uppercase text-[10px] whitespace-nowrap">
                                          <th className="py-2 px-2.5">Ngày</th>
                                          <th className="py-2 px-2.5">Phòng</th>
                                          <th className="py-2 px-2.5">Phim</th>
                                          <th className="py-2 px-2.5 text-center">Thời lượng</th>
                                          <th className="py-2 px-2.5 text-center">Bắt đầu</th>
                                          <th className="py-2 px-2.5 text-center">Kết thúc</th>
                                          <th className="py-2 px-2.5 text-center">Vệ sinh xong</th>
                                          <th className="py-2 px-2.5 text-right">Giá vé</th>
                                          <th className="py-2 px-2.5 text-center">Số ghế</th>
                                          <th className="py-2 px-2.5 text-center">Trạng thái</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/60">
                                        {group.slots.map((slot, idx) => {
                                          const isConflict = slot.status === 'CONFLICT';
                                          return (
                                            <tr
                                              key={idx}
                                              data-testid={`batch-preview-row-${idx}`}
                                              className={
                                                isConflict
                                                  ? 'bg-rose-950/25 text-rose-200'
                                                  : 'hover:bg-slate-900/50'
                                              }
                                            >
                                              <td className="py-2 px-2.5 font-mono whitespace-nowrap text-slate-300">
                                                {slot.date}
                                              </td>
                                              <td className={`py-2 px-2.5 font-bold whitespace-nowrap ${roomTextClass}`}>
                                                {slot.roomName}
                                              </td>
                                              <td
                                                className="py-2 px-2.5 font-bold text-white max-w-[180px] truncate"
                                                title={slot.movieTitle}
                                              >
                                                {slot.movieTitle}
                                              </td>
                                              <td className="py-2 px-2.5 text-center font-mono whitespace-nowrap text-slate-300">
                                                {slot.duration} phút
                                              </td>
                                              <td className="py-2 px-2.5 text-center font-mono font-bold text-white whitespace-nowrap">
                                                {slot.startTimeText || slot.time}
                                              </td>
                                              <td className="py-2 px-2.5 text-center font-mono font-semibold text-slate-200 whitespace-nowrap">
                                                {slot.endTimeText}
                                              </td>
                                              <td className="py-2 px-2.5 text-center font-mono whitespace-nowrap">
                                                <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[10px]">
                                                  {slot.cleaningEndTimeText} (+{slot.cleaningMinutes}p)
                                                </span>
                                              </td>
                                              <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-300 whitespace-nowrap">
                                                {slot.price ? `${Number(slot.price).toLocaleString('vi-VN')}đ` : '--'}
                                              </td>
                                              <td className="py-2 px-2.5 text-center font-mono whitespace-nowrap text-slate-300">
                                                {slot.totalSeats || 88} ghế
                                              </td>
                                              <td className="py-2 px-2.5 text-center whitespace-nowrap">
                                                {isConflict ? (
                                                  <span
                                                    className="inline-block px-2.5 py-0.5 rounded-md bg-rose-950 border border-rose-500/60 text-rose-300 font-bold text-[10px] whitespace-nowrap cursor-help"
                                                    title={slot.reason || 'Xung đột lịch chiếu trong cùng phòng'}
                                                  >
                                                    Xung đột
                                                  </span>
                                                ) : (
                                                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold text-[10px] whitespace-nowrap">
                                                    Hợp lệ
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsBatchModalOpen(false)}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Đóng
                      </button>
                      <button
                        type="button"
                        data-testid="batch-confirm-create-btn"
                        onClick={handleExecuteBatchSchedule}
                        disabled={!canConfirm || isConfirmingBatch}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                      >
                        {isConfirmingBatch || batchLoading
                          ? 'Đang tạo lịch chiếu...'
                          : batchPreview?.validCount
                          ? `Xác nhận tạo ${batchPreview.validCount} suất chiếu`
                          : 'Xác nhận tạo lịch chiếu'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

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

          {/* ========================================================================= */}
          {/* MODAL XÁC NHẬN XÓA HÀNG LOẠT SUẤT CHIẾU (BULK DELETE PREVIEW & COMMIT)   */}
          {/* ========================================================================= */}
          {isBulkDeleteModalOpen && (
            <div
              data-testid="bulk-delete-modal"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-fadeIn"
            >
              <div className="bg-[#101728] border border-rose-500/30 w-full max-w-[680px] rounded-[24px] p-6 shadow-2xl space-y-5 text-[#F1F5F9] max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-wide">
                        Xác nhận xóa hàng loạt suất chiếu
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Hệ thống kiểm tra an toàn từng suất chiếu trước khi thực hiện giao dịch xóa trên MongoDB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBulkCommitting}
                    onClick={() => setIsBulkDeleteModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-[#080E1D] hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {isBulkPreviewLoading || !bulkDeletePreview ? (
                  <div className="py-12 text-center text-slate-300 text-xs space-y-2">
                    <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p>Đang kiểm tra trạng thái đơn vé và ghế của {selectedShowtimeIds.size} suất chiếu...</p>
                  </div>
                ) : (
                  <>
                    {/* 3 Thẻ chỉ số tổng quan */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-[#080E1D] border border-slate-800 rounded-2xl p-3">
                        <span className="text-[11px] text-slate-400 block">Tổng số suất đã chọn</span>
                        <span className="text-2xl font-black text-white font-mono" data-testid="preview-total-selected">
                          {bulkDeletePreview.totalSelected || 0}
                        </span>
                      </div>
                      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3">
                        <span className="text-[11px] text-emerald-300 block">Số suất được phép xóa</span>
                        <span className="text-2xl font-black text-emerald-400 font-mono" data-testid="preview-eligible-count">
                          {bulkDeletePreview.eligibleCount || 0}
                        </span>
                      </div>
                      <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-3">
                        <span className="text-[11px] text-amber-300 block">Số suất bị bảo vệ</span>
                        <span className="text-2xl font-black text-amber-400 font-mono" data-testid="preview-blocked-count">
                          {bulkDeletePreview.blockedCount || 0}
                        </span>
                      </div>
                    </div>

                    {/* Danh sách suất bị bảo vệ kèm lý do */}
                    {Array.isArray(bulkDeletePreview.blockedSlots) && bulkDeletePreview.blockedSlots.length > 0 && (
                      <div className="bg-amber-950/25 border border-amber-500/40 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Danh sách suất bị bảo vệ và lý do không được xóa ({bulkDeletePreview.blockedSlots.length} suất):</span>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                          {bulkDeletePreview.blockedSlots.map((slot) => {
                            const tStr = new Date(slot.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                            const dStr = new Date(slot.startTime).toLocaleDateString('vi-VN');
                            return (
                              <div
                                key={slot.id}
                                data-testid={`blocked-slot-${slot.id}`}
                                className="bg-[#080E1D]/90 border border-amber-500/20 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                              >
                                <div>
                                  <span className="font-bold text-white">{slot.movieTitle}</span>
                                  <span className="text-cyan-300 ml-2 font-semibold">{slot.roomName}</span>
                                  <span className="text-slate-400 ml-2 font-mono">({tStr} • {dStr})</span>
                                </div>
                                <span className="text-amber-300 font-semibold text-[11px]">
                                  🛡️ {slot.reason}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Danh sách suất được phép xóa */}
                    {Array.isArray(bulkDeletePreview.eligibleSlots) && bulkDeletePreview.eligibleSlots.length > 0 && (
                      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-300">
                            🟢 Suất hợp lệ sẽ được xóa hoàn toàn & giải phóng {bulkDeletePreview.totalSeatsToRelease || 0} ghế ({bulkDeletePreview.eligibleSlots.length} suất):
                          </span>
                        </div>
                        <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                          {bulkDeletePreview.eligibleSlots.map((slot) => {
                            const tStr = new Date(slot.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                            const dStr = new Date(slot.startTime).toLocaleDateString('vi-VN');
                            return (
                              <div
                                key={slot.id}
                                className="bg-[#080E1D]/80 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                              >
                                <div className="truncate">
                                  <span className="font-bold text-white">{slot.movieTitle}</span>
                                  <span className="text-cyan-300 ml-2">{slot.roomName}</span>
                                </div>
                                <span className="text-slate-300 font-mono shrink-0">
                                  {tStr} • {dStr}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
                      <button
                        type="button"
                        disabled={isBulkCommitting}
                        onClick={() => setIsBulkDeleteModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Đóng / Hủy
                      </button>
                      <button
                        type="button"
                        data-testid="bulk-commit-delete-btn"
                        disabled={isBulkCommitting || !bulkDeletePreview.eligibleCount}
                        onClick={handleCommitBulkDelete}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-rose-900/40 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isBulkCommitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Đang xóa hàng loạt...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            <span>Xác nhận xóa {bulkDeletePreview.eligibleCount || 0} suất hợp lệ</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default ShowtimeManagePage;
