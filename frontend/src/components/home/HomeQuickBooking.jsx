import React, { useState, useRef, useEffect } from 'react';
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (movieDropdownRef.current && !movieDropdownRef.current.contains(event.target)) {
        setIsMovieDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeMovie =
    moviesList.find((m) => String(m.id) === String(selectedMovieId)) || moviesList[0];
  const activeBadge = getAgeBadgeStyle(activeMovie?.ageRating);

  const availableShowtimes =
    activeMovie?.showtimes && activeMovie.showtimes.length > 0
      ? activeMovie.showtimes
      : [
          {
            id: activeMovie?.firstShowtimeId || '6ae624fdb0ee30fb919c72d6',
            roomName: 'IMAX Laser (Phòng 1)',
            format: 'IMAX Laser 2D',
            time: '19:30',
          },
          {
            id: '6ae624fdb0ee30fb919c7307',
            roomName: '2D Dolby Atmos (Phòng 2)',
            format: '2D Tiêu Chuẩn',
            time: '21:15',
            price: 50000,
          },
          {
            id: '6ae624fdb0ee30fb919c7318',
            roomName: 'RealD 3D (Phòng 3)',
            format: 'RealD 3D HFR',
            time: '21:15',
            price: 50000,
          },
        ];

  // Tự động đồng bộ suất chiếu đã chọn khi danh sách suất chiếu của phim thay đổi
  useEffect(() => {
    if (availableShowtimes.length > 0) {
      const isCurrentInList = availableShowtimes.some((st) => String(st.id) === String(selectedShowtimeId));
      if (!isCurrentInList) {
        setSelectedShowtimeId(String(availableShowtimes[0].id));
      }
    }
  }, [selectedMovieId, availableShowtimes, selectedShowtimeId, setSelectedShowtimeId]);

  const handleQuickBooking = () => {
    const targetShowtimeId =
      selectedShowtimeId ||
      activeMovie?.firstShowtimeId ||
      availableShowtimes[0]?.id ||
      '6ae624fdb0ee30fb919c72d6';

    const chosenSlot =
      availableShowtimes.find((st) => String(st.id) === String(targetShowtimeId)) ||
      availableShowtimes[0];

    navigate(`/booking/seat/${targetShowtimeId}`, {
      state: {
        slotInfo: {
          id: targetShowtimeId,
          showtimeId: targetShowtimeId,
          roomName: chosenSlot?.roomName || 'Phòng Chiếu 01',
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
              <button
                type="button"
                onClick={() => setIsMovieDropdownOpen(!isMovieDropdownOpen)}
                className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-all flex items-center gap-1 cursor-pointer"
                title="Nhấn để mở danh sách phim"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                <span>Click chọn phim ({moviesList.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMovieDropdownOpen(!isMovieDropdownOpen)}
              className={`w-full h-[38px] bg-[#1b2232] hover:bg-[#232c40] border ${
                isMovieDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700/60'
              } rounded-xl px-3 text-xs font-bold text-white transition-all text-left flex items-center justify-between gap-2 cursor-pointer group shadow-inner`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${activeBadge.bg} ${activeBadge.text} ${activeBadge.border}`}
                >
                  {activeMovie?.ageRating || 'T18'}
                </span>
                <span className="truncate text-slate-100 group-hover:text-blue-300 transition-colors">
                  {activeMovie?.title || 'Chọn phim'}
                </span>
              </div>
              <span
                className={`text-slate-400 text-[10px] transform transition-transform shrink-0 ${
                  isMovieDropdownOpen ? 'rotate-180 text-blue-400' : ''
                }`}
              >
                ▼
              </span>
            </button>

            {/* Floating Dropdown Menu */}
            {isMovieDropdownOpen && (
              <div className="absolute left-0 bottom-full sm:bottom-auto sm:top-full mb-2 sm:mb-0 sm:mt-2 w-[330px] sm:w-[390px] bg-[#121826]/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl p-2.5 shadow-2xl z-50 animate-in fade-in duration-150">
                <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-800/80">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-amber-400 text-xs">🍿</span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                      Phim Đang Chiếu Rạp
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    {moviesList.length} phim sẵn sàng
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                  {moviesList.map((m) => {
                    const isSelected = String(m.id) === String(selectedMovieId);
                    const badge = getAgeBadgeStyle(m.ageRating);
                    return (
                      <div
                        key={m.id}
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
                          src={m.poster}
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
                              ★ {m.rating}
                            </span>
                            <span className="text-[10px] text-slate-400">• {m.duration} phút</span>
                          </div>

                          <h5
                            className={`text-xs font-bold truncate ${
                              isSelected ? 'text-blue-300' : 'text-slate-100'
                            }`}
                          >
                            {m.title}
                          </h5>

                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {(Array.isArray(m.formats) ? m.formats : [m.formats || '2D']).map(
                              (fmt, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] font-medium bg-slate-800/90 text-slate-300 px-1.5 py-0.2 rounded border border-slate-700/50"
                                >
                                  {fmt}
                                </span>
                              )
                            )}
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

          {/* 2. Rạp chiếu (Cố định cụm rạp duy nhất Thanh Khê) */}
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

          {/* 3. Chọn Ngày */}
          <div className="sm:col-span-1 lg:col-span-2 space-y-1">
            <div className="flex items-center h-5">
              <label className="text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                <span className="text-emerald-500">📅</span>
                <span>Ngày chiếu</span>
              </label>
            </div>
            <div className="relative">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-[38px] bg-[#1b2232] border border-slate-700/60 rounded-xl px-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-7"
              >
                <option value="Hôm nay">
                  Hôm nay ({new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })})
                </option>
                <option value="Ngày mai">
                  Ngày mai ({new Date(Date.now() + 86400000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })})
                </option>
                <option value="Ngày kia">
                  Ngày kia ({new Date(Date.now() + 172800000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })})
                </option>
              </select>
              <span className="absolute right-3 top-2.5 text-slate-500 text-[10px] pointer-events-none">
                ⌵
              </span>
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
                className="w-full h-[38px] bg-[#1b2232] border border-slate-700/60 rounded-xl px-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-7"
              >
                {availableShowtimes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.time || '19:30'} - {st.roomName || 'IMAX Laser'}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-2.5 text-slate-500 text-[10px] pointer-events-none">
                ⌵
              </span>
            </div>
          </div>

          {/* 5. Nút Đặt Vé Ngay */}
          <div className="sm:col-span-2 lg:col-span-2">
            <button
              type="button"
              onClick={handleQuickBooking}
              className="w-full h-[38px] bg-[#2563eb] hover:bg-blue-600 text-white font-black px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-blue-600/30 cursor-pointer hover:scale-105 active:scale-95"
            >
              <span>🎟️</span>
              <span>Đặt vé ngay</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeQuickBooking;

