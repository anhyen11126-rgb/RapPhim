import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Các module thành phần con được tách biệt rõ ràng (tránh conflict khi nhóm cùng làm)
import MovieHeroTrailer from '../../components/movie-detail/MovieHeroTrailer';
import MovieSidebarInfo from '../../components/movie-detail/MovieSidebarInfo';
import MovieOverviewHighlights from '../../components/movie-detail/MovieOverviewHighlights';
import MovieCastSection from '../../components/movie-detail/MovieCastSection';
import MovieShowtimesSection from '../../components/movie-detail/MovieShowtimesSection';

// Kiểu dáng phân loại độ tuổi chuẩn rạp
const getAgeBadgeStyle = (ageRating) => {
  switch (ageRating) {
    case 'T11':
    case 'P':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/50',
        label: ageRating === 'T11' ? 'T11 - PHIM CHO KHÁN GIẢ TRÊN 11 TUỔI' : 'P - PHIM DÀNH CHO MỌI LỨA TUỔI',
      };
    case 'T13':
      return {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        border: 'border-yellow-500/50',
        label: 'T13 - PHIM CẤM KHÁN GIẢ DƯỚI 13 TUỔI',
      };
    case 'T16':
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/50',
        label: 'T16 - PHIM CẤM KHÁN GIẢ DƯỚI 16 TUỔI',
      };
    case 'T18':
    default:
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/50',
        label: 'T18 - PHIM DÀNH CHO KHÁN GIẢ TRÊN 18 TUỔI',
      };
  }
};

const MovieDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [movie, setMovie] = useState(null);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Trailer & Trạng thái yêu thích
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // Bộ chọn Lịch chiếu & Rạp
  const [selectedCity, setSelectedCity] = useState(
    () => localStorage.getItem('selectedCity') || 'TP. Hồ Chí Minh'
  );
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedCinemaId, setSelectedCinemaId] = useState('');
  const [selectedShowtime, setSelectedShowtime] = useState(null);

  // Lắng nghe thay đổi tỉnh/thành phố từ Header Navbar
  useEffect(() => {
    const handleCitySync = (e) => {
      if (e.detail) {
        setSelectedCity(e.detail);
      }
    };
    window.addEventListener('cityChange', handleCitySync);
    return () => window.removeEventListener('cityChange', handleCitySync);
  }, []);

  useEffect(() => {
    fetchMovieDetail();
    fetchCinemas();
  }, [id]);

  // Lọc danh sách cụm rạp theo đúng Tỉnh / Thành Phố đang chọn trên Navbar hoặc Selector
  const normalizeCity = (c) => (c || '').toLowerCase().replace(/^tp\.?\s*/i, '').trim();

  const filteredCinemas = useMemo(() => {
    if (!cinemas || cinemas.length === 0) return [];
    if (!selectedCity || selectedCity === 'Tất cả khu vực') return cinemas;
    const normSelected = normalizeCity(selectedCity);
    const matched = cinemas.filter((c) => {
      const normCinemaCity = normalizeCity(c.city);
      return (
        normCinemaCity.includes(normSelected) ||
        normSelected.includes(normCinemaCity) ||
        (c.address && c.address.toLowerCase().includes(normSelected))
      );
    });
    return matched.length > 0 ? matched : cinemas;
  }, [cinemas, selectedCity]);

  // Tự động chọn rạp đầu tiên của khu vực mới khi danh sách rạp lọc thay đổi
  useEffect(() => {
    if (filteredCinemas && filteredCinemas.length > 0) {
      const isCurrentInList = filteredCinemas.some((c) => (c._id || c.id) === selectedCinemaId);
      if (!isCurrentInList) {
        setSelectedCinemaId(filteredCinemas[0]._id || filteredCinemas[0].id);
      }
    }
  }, [filteredCinemas, selectedCinemaId]);

  const fetchMovieDetail = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/movies/${id}`);
      setMovie(res.data);
      if (res.data?.showtimes && res.data.showtimes.length > 0) {
        setSelectedShowtime(res.data.showtimes[0]);
      }
    } catch (error) {
      console.error('Lỗi khi tải chi tiết phim:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCinemas = async () => {
    try {
      const res = await api.get('/cinemas');
      if (Array.isArray(res.data)) {
        setCinemas(res.data);
        if (res.data.length > 0) {
          setSelectedCinemaId(res.data[0]._id || res.data[0].id);
        }
      }
    } catch (e) {
      console.warn('Không tải được danh sách rạp:', e);
    }
  };

  const scrollToBooking = () => {
    const el = document.getElementById('showtimes-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Tạo danh sách 7 ngày liên tiếp từ hôm nay
  const generateDateTabs = () => {
    const tabs = [];
    const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      let tag = '';
      if (i === 0) tag = 'HÔM NAY';
      else if (i === 1) tag = 'NGÀY MAI';
      else if (d.getDay() === 0 || d.getDay() === 6) tag = 'CUỐI TUẦN';
      else tag = `NGÀY ${i + 1}`;

      const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dayName = daysOfWeek[d.getDay()];

      tabs.push({
        index: i,
        tag,
        dateStr,
        dayName,
        fullDate: d,
      });
    }
    return tabs;
  };

  const dateTabs = generateDateTabs();
  const selectedDate = dateTabs[selectedDateIndex] || dateTabs[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center text-slate-400 py-32 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold tracking-wide text-slate-300">Đang nạp dữ liệu phim điện ảnh...</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center text-slate-400 py-32 space-y-4">
        <span className="text-4xl">🎬</span>
        <p className="text-xl font-bold text-white">Không tìm thấy thông tin bộ phim này.</p>
        <Link
          to="/"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow"
        >
          Quay lại Trang chủ
        </Link>
      </div>
    );
  }

  const ageBadge = getAgeBadgeStyle(movie.ageRating);

  // Phân bổ suất chiếu thực tế từ database
  const allShowtimes = Array.isArray(movie.showtimes) ? movie.showtimes : [];
  const realShowtimeIds = allShowtimes.map((st) => st._id || st.id || st.showtimeId).filter(Boolean);
  const primaryShowtimeId = movie.firstShowtimeId || realShowtimeIds[0] || '6ae624fdb0ee30fb919c72d6';

  const fallbackImaxTimes = [
    {
      id: 'imax-1',
      realId: realShowtimeIds[0] || primaryShowtimeId,
      time: '17:30',
      roomName: 'Phòng IMAX 01',
      availableSeats: 82,
      price: 160000,
      tag: '',
    },
    {
      id: 'imax-2',
      realId: realShowtimeIds[1] || primaryShowtimeId,
      time: '19:15',
      roomName: 'Phòng IMAX 01',
      availableSeats: 12,
      price: 160000,
      tag: 'ĐẶT NHIỀU NHẤT',
    },
    {
      id: 'imax-3',
      realId: realShowtimeIds[2] || primaryShowtimeId,
      time: '20:45',
      roomName: 'Phòng IMAX 01',
      availableSeats: 54,
      price: 160000,
      tag: '',
    },
    {
      id: 'imax-4',
      realId: realShowtimeIds[3] || primaryShowtimeId,
      time: '22:30',
      roomName: 'Phòng IMAX 01',
      availableSeats: 20,
      price: 140000,
      tag: '',
    },
  ];

  const fallbackStandardTimes = [
    {
      id: 'std-1',
      realId: realShowtimeIds[0] || primaryShowtimeId,
      time: '18:00',
      roomName: 'Rạp 03 (Tầng 2)',
      availableSeats: 90,
      price: 50000,
      tag: '',
    },
    {
      id: 'std-2',
      realId: realShowtimeIds[1] || primaryShowtimeId,
      time: '19:45',
      roomName: 'Rạp 04 (Tầng 2)',
      availableSeats: 31,
      price: 50000,
      tag: '',
    },
    {
      id: 'std-3',
      realId: realShowtimeIds[2] || primaryShowtimeId,
      time: '21:15',
      roomName: 'Rạp 03 (Tầng 2)',
      availableSeats: 45,
      price: 50000,
      tag: '',
    },
    {
      id: 'std-4',
      realId: realShowtimeIds[3] || primaryShowtimeId,
      time: '23:00',
      roomName: 'Rạp 02',
      availableSeats: 0,
      price: 50000,
      tag: 'HẾT VÉ',
    },
  ];

  const fallback3DTimes = [
    {
      id: '3d-1',
      realId: realShowtimeIds[0] || primaryShowtimeId,
      time: '18:30',
      roomName: 'Rạp 05 (Tầng 3)',
      availableSeats: 64,
      price: 50000,
      tag: '',
    },
    {
      id: '3d-2',
      realId: realShowtimeIds[1] || primaryShowtimeId,
      time: '20:00',
      roomName: 'Rạp 05 (Tầng 3)',
      availableSeats: 48,
      price: 50000,
      tag: '',
    },
    {
      id: '3d-3',
      realId: realShowtimeIds[2] || primaryShowtimeId,
      time: '21:15',
      roomName: 'Rạp 05 (Tầng 3)',
      availableSeats: 42,
      price: 50000,
      tag: '',
    },
    {
      id: '3d-4',
      realId: realShowtimeIds[3] || primaryShowtimeId,
      time: '22:15',
      roomName: 'Rạp 05 (Tầng 3)',
      availableSeats: 28,
      price: 45000,
      tag: 'GIÁ ƯU ĐÃI',
    },
  ];

  const displayCinema =
    filteredCinemas.find((c) => (c._id || c.id) === selectedCinemaId) ||
    filteredCinemas[0] ||
    cinemas[0] || {
      name: "D'AVENOR Vincom Ngô Quyền",
      address: 'Tầng 4 Vincom Plaza, 910A Ngô Quyền, Q. Sơn Trà, Đà Nẵng',
    };

  // Helper tính giờ kết thúc suất chiếu
  const getEndTime = (timeStr, durationMins = 120) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const totalMins = h * 60 + m + (Number(durationMins) || 120);
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `~${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const currentActiveShowtime = selectedShowtime || {
    ...fallbackImaxTimes[1],
    cinemaName: displayCinema.name,
    format: 'IMAX Laser 2D',
  };

  const handleSelectSlot = (st, formatName, directToSeat = false) => {
    const slotData = {
      ...st,
      cinemaName: displayCinema.name,
      format: formatName,
      startTime: selectedDate?.fullDate,
    };
    setSelectedShowtime(slotData);
    if (directToSeat) {
      const targetId = st.realId || primaryShowtimeId;
      navigate(`/booking/seat/${targetId}`, {
        state: { slotInfo: slotData },
      });
    }
  };

  return (
    <div className="bg-[#090d16] text-slate-100 min-h-screen pb-28 select-none">
      {/* 1. HERO TRAILER SECTION (THEATRICAL AMBIENT BANNER & MODAL) */}
      <MovieHeroTrailer
        movie={movie}
        isTrailerModalOpen={isTrailerModalOpen}
        onOpenTrailer={() => setIsTrailerModalOpen(true)}
        onCloseTrailer={() => setIsTrailerModalOpen(false)}
        onScrollToBooking={scrollToBooking}
      />

      {/* 2. MAIN DETAILS GRID (SIDEBAR THÔNG SỐ & THÔNG TIN CHÍNH) */}
      <section className="relative z-20 max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-12 -mt-16 sm:-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CỘT TRÁI (4 COLS): POSTER, BẢNG THÔNG SỐ ĐIỆN ẢNH */}
          <MovieSidebarInfo
            movie={movie}
            ageBadge={ageBadge}
            onScrollToBooking={scrollToBooking}
          />

          {/* CỘT PHẢI (8 COLS): TÊN PHIM, ĐÁNH GIÁ, TÓM TẮT, DÀN DIỄN VIÊN */}
          <div className="lg:col-span-8 space-y-8 pt-4">
            <MovieOverviewHighlights
              movie={movie}
              ageBadge={ageBadge}
              isFavorite={isFavorite}
              onToggleFavorite={() => setIsFavorite(!isFavorite)}
            />

            <MovieCastSection cast={movie.cast} />
          </div>
        </div>
      </section>

      {/* 3. LỊCH CHIẾU RẠP TOÀN QUỐC (SHOWTIMES & BOOKING SECTION) */}
      <MovieShowtimesSection
        movie={movie}
        dateTabs={dateTabs}
        selectedDateIndex={selectedDateIndex}
        onSelectDateIndex={setSelectedDateIndex}
        selectedCity={selectedCity}
        filteredCinemas={filteredCinemas}
        selectedCinemaId={selectedCinemaId}
        onSelectCinemaId={setSelectedCinemaId}
        fallbackImaxTimes={fallbackImaxTimes}
        fallbackStandardTimes={fallbackStandardTimes}
        fallback3DTimes={fallback3DTimes}
        currentActiveShowtime={currentActiveShowtime}
        onSelectSlot={handleSelectSlot}
        getEndTime={getEndTime}
        selectedDate={selectedDate}
        displayCinema={displayCinema}
        onProceedToBooking={() => {
          const targetId = currentActiveShowtime?.realId || primaryShowtimeId;
          const finalSlot = {
            ...currentActiveShowtime,
            cinemaName: displayCinema.name,
            startTime: selectedDate?.fullDate,
          };
          navigate(`/booking/seat/${targetId}`, {
            state: { slotInfo: finalSlot },
          });
        }}
      />
    </div>
  );
};

export default MovieDetailPage;
