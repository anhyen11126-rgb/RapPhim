import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';
import {
  calculateDynamicPrices,
  loadPricingConfig,
  DEFAULT_PRICING_CONFIG,
} from '../../utils/pricing';

const ShowtimeManagePage = () => {
  const [showtimes, setShowtimes] = useState([]);
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  // Bộ lọc
  const [filterCinemaId, setFilterCinemaId] = useState('ALL');
  const [filterMovieId, setFilterMovieId] = useState('ALL');
  const [filterRoomTech, setFilterRoomTech] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('ALL'); // 'ALL', 'this_week', 'next_week', 'month_11', 'month_12', 'custom'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Form mở 1 suất lẻ
  const [formData, setFormData] = useState({
    movieId: '',
    cinemaId: '',
    roomName: 'Rạp 05 (Tầng 3 - RealD 3D)',
    startTime: '',
    price: 80000,
  });

  // Form lên lịch chiếu hàng loạt theo Tuần / Tháng
  const [batchData, setBatchData] = useState({
    cinemaId: 'ALL',
    startDate: '',
    endDate: '',
    selectedMovieIds: [],
    timeSlots: ['09:30', '13:45', '17:15', '19:45', '22:15'],
    overwriteExisting: true,
  });

  const now = new Date();

  useEffect(() => {
    loadData();
  }, [periodFilter, filterStartDate, filterEndDate]);

  const resolveSuggestedPrice = (roomName, startTime, cfg = pricingConfig) => {
    return calculateDynamicPrices(
      {
        roomName,
        startTime: startTime || new Date().toISOString(),
        useConfigMatrix: true,
      },
      cfg
    ).priceStandard;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (periodFilter !== 'ALL' && periodFilter !== 'custom') {
        params.period = periodFilter;
      } else if (periodFilter === 'custom' && filterStartDate && filterEndDate) {
        params.startDate = filterStartDate;
        params.endDate = filterEndDate;
      }

      const [stRes, mRes, cRes, rRes, loadedPricing] = await Promise.all([
        api.get('/admin/showtimes', { params }),
        api.get('/movies'),
        api.get('/admin/cinemas'),
        api.get('/admin/rooms'),
        loadPricingConfig(true),
      ]);
      const activeCfg = loadedPricing || DEFAULT_PRICING_CONFIG;
      setPricingConfig(activeCfg);
      setShowtimes(stRes.data || []);
      setMovies(mRes.data || []);
      setCinemas(cRes.data || []);
      setRooms(rRes.data || []);

      if (mRes.data?.length > 0 && cRes.data?.length > 0) {
        const defaultRoomName = rRes.data?.[0]?.name || 'Phòng IMAX 01 (Grand Hall)';
        setFormData((prev) => ({
          ...prev,
          movieId: mRes.data[0].id || mRes.data[0]._id,
          cinemaId: cRes.data[0].id || cRes.data[0]._id,
          roomName: defaultRoomName,
          price: resolveSuggestedPrice(defaultRoomName, prev.startTime, activeCfg),
        }));

        // Khởi tạo các phim được chọn cho batch scheduler nếu chưa có
        setBatchData((prev) => ({
          ...prev,
          selectedMovieIds: prev.selectedMovieIds.length > 0
            ? prev.selectedMovieIds
            : mRes.data.slice(0, 4).map((m) => m.id || m._id),
        }));
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu suất chiếu:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleCreateShowtime = async (e) => {
    e.preventDefault();
    if (!formData.startTime) {
      alert('Vui lòng chọn ngày và giờ chiếu!');
      return;
    }

    try {
      await api.post('/admin/showtimes', formData);
      alert('Đã tạo suất chiếu mới và tự động sinh 88 ghế ngồi!');
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert('Không thể tạo suất chiếu: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa suất chiếu này? Các ghế liên kết cũng sẽ bị hủy!')) {
      try {
        await api.delete(`/admin/showtimes/${id}`);
        loadData();
        alert('Đã xóa suất chiếu thành công!');
      } catch (err) {
        alert('Lỗi xóa suất chiếu: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  // Thiết lập nhanh khoảng thời gian cho Batch Scheduler
  const applyQuickBatchPeriod = (type) => {
    const d = new Date();
    let s = '';
    let e = '';

    if (type === 'this_week') {
      const dayOfWeek = d.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      s = mon.toISOString().slice(0, 10);
      e = sun.toISOString().slice(0, 10);
    } else if (type === 'next_week') {
      const dayOfWeek = d.getDay();
      const diffToNextMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const nextMon = new Date(d);
      nextMon.setDate(d.getDate() + diffToNextMon);
      const nextSun = new Date(nextMon);
      nextSun.setDate(nextMon.getDate() + 6);
      s = nextMon.toISOString().slice(0, 10);
      e = nextSun.toISOString().slice(0, 10);
    } else if (type === 'month_11') {
      s = `${d.getFullYear()}-11-01`;
      e = `${d.getFullYear()}-11-30`;
    } else if (type === 'month_12') {
      s = `${d.getFullYear()}-12-01`;
      e = `${d.getFullYear()}-12-31`;
    }

    setBatchData((prev) => ({
      ...prev,
      startDate: s,
      endDate: e,
    }));
  };

  // Mở modal xếp lịch theo tuần / tháng
  const handleOpenBatchModal = () => {
    if (!batchData.startDate || !batchData.endDate) {
      applyQuickBatchPeriod('this_week');
    }
    setIsBatchModalOpen(true);
  };

  // Gửi tạo lịch chiếu hàng loạt lên MongoDB
  const handleExecuteBatchSchedule = async (e) => {
    e.preventDefault();
    if (!batchData.startDate || !batchData.endDate) {
      alert('Vui lòng chọn ngày bắt đầu và kết thúc!');
      return;
    }
    if (batchData.selectedMovieIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 bộ phim để xếp lịch chiếu!');
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
        overwriteExisting: batchData.overwriteExisting,
      });

      alert(`🎉 ${res.data?.message || 'Đã xếp lịch chiếu hàng loạt thành công!'}`);
      setIsBatchModalOpen(false);
      loadData();
    } catch (err) {
      alert('Lỗi xếp lịch chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setBatchLoading(false);
    }
  };

  // Toggle chọn phim trong Batch Scheduler
  const toggleMovieSelection = (movieId) => {
    setBatchData((prev) => {
      const exists = prev.selectedMovieIds.includes(movieId);
      if (exists) {
        return { ...prev, selectedMovieIds: prev.selectedMovieIds.filter((id) => id !== movieId) };
      } else {
        return { ...prev, selectedMovieIds: [...prev.selectedMovieIds, movieId] };
      }
    });
  };

  // Toggle khung giờ chiếu
  const toggleTimeSlot = (slot) => {
    setBatchData((prev) => {
      const exists = prev.timeSlots.includes(slot);
      if (exists) {
        if (prev.timeSlots.length <= 1) {
          alert('Cần giữ lại ít nhất 1 khung giờ chiếu trong ngày!');
          return prev;
        }
        return { ...prev, timeSlots: prev.timeSlots.filter((s) => s !== slot) };
      } else {
        return { ...prev, timeSlots: [...prev.timeSlots, slot].sort() };
      }
    });
  };

  const filteredShowtimes = showtimes.filter((st) => {
    const cId = st.cinemaId?._id || st.cinemaId?.id || st.cinemaId;
    const mId = st.movieId?._id || st.movieId?.id || st.movieId;
    const rName = (st.roomName || '').toLowerCase();
    const matchCinema = filterCinemaId === 'ALL' || cId === filterCinemaId;
    const matchMovie = filterMovieId === 'ALL' || mId === filterMovieId;
    let matchRoom = true;
    if (filterRoomTech === 'IMAX') matchRoom = rName.includes('imax');
    else if (filterRoomTech === '3D') matchRoom = rName.includes('3d') || rName.includes('05');
    else if (filterRoomTech === '2D') matchRoom = !rName.includes('imax') && !rName.includes('3d') && !rName.includes('05');
    return matchCinema && matchMovie && matchRoom;
  });

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-100 font-sans">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 flex-1 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1.5 font-medium">
                <span>Hệ thống vận hành</span>
                <span className="text-slate-600">›</span>
                <span className="text-red-400 font-semibold">Quản lý Suất chiếu & Ghế ngồi</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-2">
                <span>🕒</span>
                <span>Quản Lý & Lên Lịch Chiếu Phim</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Lên lịch chiếu phim linh hoạt theo <strong>Tuần này, Tuần sau, Tháng 11 hoặc Tháng 12</strong>. Thay đổi tại đây sẽ cập nhật ngay lập tức sang trang Khách hàng.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Nút Lên Lịch Chiếu Theo Tuần / Tháng */}
              <button
                onClick={handleOpenBatchModal}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-blue-600/30 cursor-pointer active:scale-95"
              >
                <span>🗓️</span>
                <span>Lên Lịch Chiếu Theo Tuần / Tháng</span>
              </button>

              {/* Nút Mở 1 Suất Lẻ */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-red-600/30 cursor-pointer active:scale-95"
              >
                <span>➕</span>
                <span>Mở Suất Chiếu Lẻ</span>
              </button>
            </div>
          </div>

          {/* Thanh lọc xem theo Tuần / Tháng */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] uppercase font-bold text-slate-400 mr-2 tracking-wider">XEM THEO ĐỢT:</span>
                {[
                  { key: 'ALL', label: 'Tất cả' },
                  { key: 'this_week', label: 'Tuần này' },
                  { key: 'next_week', label: 'Tuần sau' },
                  { key: 'month_11', label: 'Tháng 11/2026' },
                  { key: 'month_12', label: 'Tháng 12/2026' },
                ].map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriodFilter(p.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      periodFilter === p.key
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 text-[11px]">Từ:</span>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => {
                    setFilterStartDate(e.target.value);
                    setPeriodFilter('custom');
                  }}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-red-500"
                />
                <span className="text-slate-400 text-[11px]">Đến:</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => {
                    setFilterEndDate(e.target.value);
                    setPeriodFilter('custom');
                  }}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Bộ lọc theo Phim & Cụm rạp */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
              <div>
                <label className="text-[11px] text-slate-400 block font-semibold mb-1">Cụm rạp:</label>
                <select
                  value={filterCinemaId}
                  onChange={(e) => setFilterCinemaId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  <option value="ALL">Tất cả cụm rạp ({cinemas.length} rạp)</option>
                  {cinemas.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      [{c.city}] {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block font-semibold mb-1">Bộ phim:</label>
                <select
                  value={filterMovieId}
                  onChange={(e) => setFilterMovieId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  <option value="ALL">Tất cả phim ({movies.length} phim)</option>
                  {movies.map((m) => (
                    <option key={m.id || m._id} value={m.id || m._id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block font-semibold mb-1">Định dạng phòng:</label>
                <select
                  value={filterRoomTech}
                  onChange={(e) => setFilterRoomTech(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  <option value="ALL">Tất cả phòng chiếu</option>
                  <option value="IMAX">Phòng 1 - IMAX Laser</option>
                  <option value="2D">Phòng 2 - 2D Dolby Atmos</option>
                  <option value="3D">Phòng 3 - RealD 3D</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bảng danh sách suất chiếu */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <span className="inline-block animate-spin mr-2">🔄</span> Đang tải danh sách suất chiếu từ Database...
              </div>
            ) : filteredShowtimes.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Chưa có suất chiếu nào phù hợp với bộ lọc đã chọn. Bạn có thể bấm <strong>"Lên Lịch Chiếu Theo Tuần / Tháng"</strong> để tạo lịch nhanh!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                      <th className="py-3 px-4">Phim</th>
                      <th className="py-3 px-4">Cụm rạp</th>
                      <th className="py-3 px-4">Phòng chiếu</th>
                      <th className="py-3 px-4">Thời gian chiếu</th>
                      <th className="py-3 px-4">Giá vé cơ bản</th>
                      <th className="py-3 px-4 text-center">Tỷ lệ lấp đầy ghế</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {filteredShowtimes.map((st) => {
                      const movie = st.movie || st.movieId;
                      const cinema = st.cinema || st.cinemaId;
                      const dateObj = new Date(st.startTime);
                      const timeFormatted = dateObj.toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const dateFormatted = dateObj.toLocaleDateString('vi-VN', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      });

                      const booked = st.bookedSeats || 0;
                      const total = st.totalSeats || 88;
                      const percent = Math.round((booked / total) * 100);

                      return (
                        <tr key={st.id || st._id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              {movie?.posterUrl && (
                                <img
                                  src={movie.posterUrl}
                                  alt=""
                                  className="w-8 h-12 object-cover rounded-md shrink-0 border border-slate-700 shadow"
                                />
                              )}
                              <div>
                                <span className="font-bold text-white block">{movie?.title || 'Phim đã chọn'}</span>
                                <span className="text-[10px] text-slate-400">
                                  {movie?.duration ? `${movie.duration} phút` : ''} • {movie?.ageRating || 'P'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-200 block">{cinema?.name || 'Cụm rạp D\'AVENOR'}</span>
                            <span className="text-[10px] text-slate-400">{cinema?.city || ''}</span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-blue-400">{st.roomName}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-amber-400 block font-mono text-sm">{timeFormatted}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{dateFormatted}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span>{Number(st.price || 0).toLocaleString('vi-VN')} đ</span>
                              <button
                                type="button"
                                onClick={() => handleQuickEditPrice(st)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition-colors"
                                title="Sửa nhanh giá suất chiếu"
                              >
                                ✏️
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-slate-300">
                                {booked} / {total} ghế
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  percent > 50
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : percent > 0
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                }`}
                              >
                                {percent}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDelete(st.id || st._id)}
                              className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all text-xs cursor-pointer"
                              title="Hủy suất chiếu"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal 1: LÊN LỊCH CHIẾU THEO TUẦN / THÁNG (BATCH SCHEDULER) */}
          {isBatchModalOpen && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl text-white max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <span>🗓️</span>
                      <span>Lên Lịch Chiếu Phim Theo Tuần / Tháng</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chọn các phim sẽ chiếu trong tuần này, tuần sau hoặc tháng 12. Khi áp dụng, hệ thống sẽ tự động tạo lịch chiếu cho rạp và đồng bộ ngay với khách hàng.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsBatchModalOpen(false)}
                    className="text-slate-400 hover:text-white text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleExecuteBatchSchedule} className="space-y-4 text-xs overflow-y-auto p-1 flex-1">
                  {/* Bước 1: Chọn đợt chiếu */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">
                      1. Chọn khoảng thời gian áp dụng *
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[
                        { key: 'this_week', label: '⚡ Tuần này' },
                        { key: 'next_week', label: '📅 Tuần sau' },
                        { key: 'month_11', label: '🍂 Tháng 11/2026' },
                        { key: 'month_12', label: '🎄 Tháng 12/2026' },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => applyQuickBatchPeriod(item.key)}
                          className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 cursor-pointer active:scale-95"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Từ ngày:</label>
                        <input
                          type="date"
                          required
                          value={batchData.startDate}
                          onChange={(e) => setBatchData({ ...batchData, startDate: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Đến ngày:</label>
                        <input
                          type="date"
                          required
                          value={batchData.endDate}
                          onChange={(e) => setBatchData({ ...batchData, endDate: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bước 2: Chọn Cụm rạp */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">
                      2. Áp dụng cho Cụm rạp *
                    </label>
                    <select
                      value={batchData.cinemaId}
                      onChange={(e) => setBatchData({ ...batchData, cinemaId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">🌐 Tất cả các cụm rạp toàn quốc ({cinemas.length} cụm rạp)</option>
                      {cinemas.map((c) => (
                        <option key={c.id || c._id} value={c.id || c._id}>
                          [{c.city}] {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bước 3: Chọn danh sách phim sẽ chiếu trong đợt này */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-slate-300 font-bold">
                        3. Chọn các Phim sẽ chiếu trong đợt này * ({batchData.selectedMovieIds.length} phim đã chọn)
                      </label>
                      <div className="space-x-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() =>
                            setBatchData({
                              ...batchData,
                              selectedMovieIds: movies.map((m) => m.id || m._id),
                            })
                          }
                          className="text-blue-400 hover:underline cursor-pointer"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchData({ ...batchData, selectedMovieIds: [] })}
                          className="text-slate-400 hover:underline cursor-pointer"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1 bg-slate-950/60 rounded-2xl border border-slate-800">
                      {movies.map((m) => {
                        const mId = m.id || m._id;
                        const isSelected = batchData.selectedMovieIds.includes(mId);
                        return (
                          <div
                            key={mId}
                            onClick={() => toggleMovieSelection(mId)}
                            className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="accent-blue-500 rounded pointer-events-none"
                            />
                            <img
                              src={m.posterUrl}
                              alt=""
                              className="w-7 h-10 object-cover rounded shrink-0 border border-slate-700"
                            />
                            <div className="min-w-0">
                              <div className="font-bold truncate text-[11px]">{m.title}</div>
                              <div className="text-[9px] text-slate-400">{m.duration}p • {m.ageRating || 'P'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bước 4: Chọn các khung giờ chiếu trong ngày */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">
                      4. Khung giờ chiếu trong ngày ({batchData.timeSlots.length} khung giờ)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        '09:30',
                        '11:15',
                        '13:45',
                        '16:00',
                        '17:15',
                        '19:45',
                        '21:15',
                        '22:30',
                      ].map((slot) => {
                        const isPicked = batchData.timeSlots.includes(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => toggleTimeSlot(slot)}
                            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                              isPicked
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {isPicked ? '✓ ' : ''}{slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bước 5: Tùy chọn thay thế phim cũ */}
                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchData.overwriteExisting}
                        onChange={(e) =>
                          setBatchData({ ...batchData, overwriteExisting: e.target.checked })
                        }
                        className="accent-blue-500 w-4 h-4 rounded cursor-pointer"
                      />
                      <span>Xóa/Thay thế các suất cũ chưa có vé đặt trong khoảng thời gian này</span>
                    </label>
                    <p className="text-[10px] text-slate-400 pl-6">
                      (Đảm bảo chuyển hẳn sang các bộ phim mới cho tuần sau / tháng sau mà không bị trùng lặp phim cũ)
                    </p>
                  </div>

                  {/* Nút thực hiện */}
                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={batchLoading}
                      onClick={() => setIsBatchModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={batchLoading}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>{batchLoading ? '⏳ Đang tạo ma trận ghế...' : '🚀 Lên Lịch Chiếu Ngay'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal 2: Mở suất chiếu lẻ */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <h3 className="text-lg font-bold text-white">Mở 1 Suất Chiếu Lẻ</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateShowtime} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Chọn bộ phim *</label>
                    <select
                      value={formData.movieId}
                      onChange={(e) => setFormData({ ...formData, movieId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    >
                      {movies.map((m) => (
                        <option key={m.id || m._id} value={m.id || m._id}>
                          {m.title} ({m.duration} phút)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Chọn Cụm rạp *</label>
                    <select
                      value={formData.cinemaId}
                      onChange={(e) => setFormData({ ...formData, cinemaId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    >
                      {cinemas.map((c) => (
                        <option key={c.id || c._id} value={c.id || c._id}>
                          [{c.city}] {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Phòng chiếu & Định dạng</label>
                      <select
                        value={formData.roomName}
                        onChange={(e) => {
                          const selectedRoom = e.target.value;
                          setFormData({
                            ...formData,
                            roomName: selectedRoom,
                            price: resolveSuggestedPrice(selectedRoom, formData.startTime),
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                      >
                        {rooms.length > 0 ? (
                          rooms.map((r) => (
                            <option key={r.id || r._id} value={r.name}>
                              {r.name} ({r.roomType})
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Phòng IMAX 01 (Grand Hall)">Phòng IMAX 01 (Grand Hall)</option>
                            <option value="Rạp 03 (Tầng 2 - 2D Dolby)">Rạp 03 (Tầng 2 - 2D Dolby)</option>
                            <option value="Rạp 05 (Tầng 3 - RealD 3D)">Rạp 05 (Tầng 3 - RealD 3D)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Giá vé cơ bản (VNĐ) *</label>
                      <input
                        type="number"
                        step="5000"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Ngày & Giờ chiếu *</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.startTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          startTime: e.target.value,
                          price: resolveSuggestedPrice(formData.roomName, e.target.value),
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30"
                    >
                      Khởi tạo suất chiếu
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ShowtimeManagePage;
