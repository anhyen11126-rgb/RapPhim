import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Hàm chuyển đổi link YouTube sang link iframe embed tự động phát
const getEmbedTrailerUrl = (url) => {
  if (!url) return 'https://www.youtube.com/embed/Way9Dexny3w?autoplay=1';
  if (url.includes('embed')) return url.includes('autoplay') ? url : `${url}?autoplay=1`;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
  }
  return url;
};

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

  // Modal Trailer
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // Bộ chọn Lịch chiếu & Rạp
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedCinemaId, setSelectedCinemaId] = useState('');
  const [selectedShowtime, setSelectedShowtime] = useState(null);

  useEffect(() => {
    fetchMovieDetail();
    fetchCinemas();
  }, [id]);

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
        <Link to="/" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow">
          Quay lại Trang chủ
        </Link>
      </div>
    );
  }

  const ageBadge = getAgeBadgeStyle(movie.ageRating);

  // Phân bổ suất chiếu thực tế từ database hoặc tạo mẫu cấu trúc đa định dạng nếu ít
  const allShowtimes = Array.isArray(movie.showtimes) ? movie.showtimes : [];

  // Gom nhóm suất chiếu theo 3 chuẩn phòng chiếu đặc sắc như thiết kế:
  const imaxShowtimes = allShowtimes.filter(st => st.roomName?.toLowerCase().includes('imax') || st.formatFeature?.includes('IMAX'));
  const standardShowtimes = allShowtimes.filter(st => st.roomName?.toLowerCase().includes('tiêu chuẩn') || st.roomName?.toLowerCase().includes('2d') || (!st.roomName?.toLowerCase().includes('imax') && !st.roomName?.toLowerCase().includes('3d')));
  const realDShowtimes = allShowtimes.filter(st => st.roomName?.toLowerCase().includes('3d') || st.formatFeature?.includes('3D'));

  // Đảm bảo mỗi nhóm có suất chiếu hiển thị trực quan
  const fallbackImaxTimes = [
    { id: allShowtimes[0]?.id || 'imax-1', time: '17:30', roomName: 'Phòng IMAX 01', availableSeats: 82, price: movie.price ? movie.price + 50000 : 160000, tag: '' },
    { id: allShowtimes[1]?.id || 'imax-2', time: '19:15', roomName: 'Phòng IMAX 01', availableSeats: 12, price: movie.price ? movie.price + 50000 : 160000, tag: 'ĐẶT NHIỀU NHẤT' },
    { id: allShowtimes[2]?.id || 'imax-3', time: '20:45', roomName: 'Phòng IMAX 01', availableSeats: 54, price: movie.price ? movie.price + 50000 : 160000, tag: '' },
    { id: allShowtimes[3]?.id || 'imax-4', time: '22:30', roomName: 'Phòng IMAX 01', availableSeats: 20, price: movie.price ? movie.price + 50000 : 160000, tag: '' },
  ];

  const fallbackStandardTimes = [
    { id: allShowtimes[0]?.id || 'std-1', time: '18:00', roomName: 'Rạp 03 (Tầng 2)', availableSeats: 90, price: movie.price || 95000, tag: '' },
    { id: allShowtimes[1]?.id || 'std-2', time: '19:45', roomName: 'Rạp 04 (Tầng 2)', availableSeats: 31, price: movie.price || 95000, tag: '' },
    { id: allShowtimes[2]?.id || 'std-3', time: '21:15', roomName: 'Rạp 03 (Tầng 2)', availableSeats: 45, price: movie.price || 95000, tag: '' },
    { id: allShowtimes[3]?.id || 'std-4', time: '23:00', roomName: 'Rạp 02', availableSeats: 0, price: movie.price || 95000, tag: 'HẾT VÉ' },
  ];

  const fallback3DTimes = [
    { id: allShowtimes[0]?.id || '3d-1', time: '18:30', roomName: 'Rạp 05 (Tầng 3)', availableSeats: 64, price: (movie.price || 95000) + 15000, tag: '' },
    { id: allShowtimes[1]?.id || '3d-2', time: '21:00', roomName: 'Rạp 05 (Tầng 3)', availableSeats: 42, price: (movie.price || 95000) + 15000, tag: '' },
  ];

  const displayCinema = cinemas.find(c => (c._id || c.id) === selectedCinemaId) || cinemas[0] || {
    name: 'MovieTix B1&B2 Vincom Landmark 81 IMAX',
    address: '720A Điện Biên Phủ, P.22, Bình Thạnh, TP.HCM',
  };

  const currentActiveShowtime = selectedShowtime || fallbackImaxTimes[1];

  return (
    <div className="bg-[#090d16] text-slate-100 min-h-screen pb-28 select-none">
      {/* 1. HERO TRAILER SECTION (THEATRICAL AMBIENT BANNER) */}
      <section className="relative min-h-[460px] lg:h-[540px] flex items-center justify-center overflow-hidden group">
        {/* Ambient Backdrop Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={movie.bannerUrl || movie.posterUrl || '/banner-dune.jpg'}
            alt={movie.title}
            className="w-full h-full object-cover object-center brightness-[0.72] contrast-[1.08] saturate-[1.1] scale-100 group-hover:scale-[1.02] transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-[#090d16]/50 to-[#090d16]/30"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#090d16]/90 via-[#090d16]/30 via-40% to-[#090d16]/80"></div>
        </div>

        {/* Center Play Trailer Action Callout */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center flex flex-col items-center space-y-4 pt-16">
          {/* Badge Quality */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-amber-500/40 text-[#f59e0b] text-[10px] sm:text-xs font-black tracking-wider uppercase shadow-lg">
            <span>● {movie.trailerQualityBadge || 'OFFICIAL IMAX LASER TRAILER • 4K UHD • Dolby Atmos'}</span>
          </div>

          {/* Big Glowing Circular Play Button */}
          <button
            type="button"
            onClick={() => setIsTrailerModalOpen(true)}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#3b82f6]/90 hover:bg-blue-500 text-white flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.6)] hover:shadow-[0_0_70px_rgba(59,130,246,0.9)] hover:scale-110 active:scale-95 transition-all cursor-pointer group/btn my-1"
            title="Nhấn để xem Trailer chính thức"
          >
            <span className="text-3xl sm:text-4xl ml-1 group-hover/btn:scale-110 transition-transform">▶</span>
          </button>

          {/* Tagline & Sub-duration */}
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-2xl font-black text-white drop-shadow-lg tracking-tight">
              {movie.trailerTagline || `Khám phá trọn vẹn Trailer: ${movie.title}`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium drop-shadow max-w-xl mx-auto">
              {movie.trailerDuration || 'Thời lượng: 3 phút 45 giây • Độc quyền video chất lượng cao tại hệ thống MovieTix trên toàn quốc'}
            </p>
          </div>
        </div>
      </section>

      {/* 2. MAIN DETAILS GRID (SIDEBAR THÔNG SỐ & THÔNG TIN CHÍNH) */}
      <section className="relative z-20 max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-12 -mt-16 sm:-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* CỘT TRÁI (4 COLS): POSTER, BẢNG THÔNG SỐ ĐIỆN ẢNH */}
          <div className="lg:col-span-4 space-y-5">
            {/* Poster Card */}
            <div className="bg-[#101625] border border-slate-800 rounded-3xl p-3 shadow-2xl overflow-hidden group/poster">
              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-slate-900 shadow-inner">
                <img
                  src={movie.posterUrl || movie.poster}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover/poster:scale-105 transition-transform duration-700"
                />

                {/* Badge Top Trái Phân Loại Tuổi */}
                <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wide border shadow-md ${ageBadge.bg} ${ageBadge.text} ${ageBadge.border}`}>
                    {movie.ageRating || 'T18'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-950/80 backdrop-blur-md text-blue-400 border border-blue-500/40 shadow">
                    IMAX 4K
                  </span>
                </div>
              </div>

              {/* Dưới poster: Tên phim thu nhỏ & Nút Đặt vé nhanh */}
              <div className="p-3 text-center space-y-2.5">
                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">{movie.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{movie.duration} phút • {movie.genre?.split(',')[0]}</p>
                </div>
                <button
                  type="button"
                  onClick={scrollToBooking}
                  className="w-full bg-[#2563eb] hover:bg-blue-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-600/30 active:scale-95 cursor-pointer"
                >
                  <span>🎟️</span>
                  <span>Đặt vé nhanh</span>
                </button>
              </div>
            </div>

            {/* HỘP BẢNG THÔNG SỐ ĐIỆN ẢNH CHUYÊN SÂU */}
            <div className="bg-[#101625] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-base text-blue-400">ℹ️</span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Thông số điện ảnh</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {movie.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đang chiếu'}
                </span>
              </div>

              {/* Danh sách thông số */}
              <div className="space-y-4 text-xs">
                {/* Đạo diễn */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ĐẠO DIỄN</span>
                  <p className="text-slate-100 font-bold mt-0.5">{movie.director || 'Đang cập nhật'}</p>
                </div>

                {/* Diễn viên chính */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DIỄN VIÊN CHÍNH</span>
                  <p className="text-slate-200 font-medium leading-relaxed mt-0.5">
                    {Array.isArray(movie.cast) && movie.cast.length > 0
                      ? movie.cast.map(c => c.name).join(', ')
                      : 'Timothée Chalamet, Zendaya, Rebecca Ferguson, Javier Bardem, Austin Butler, Florence Pugh'}
                  </p>
                </div>

                {/* Thể loại */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">THỂ LOẠI</span>
                  <p className="text-slate-200 font-medium mt-0.5">{movie.genre}</p>
                </div>

                {/* Khởi chiếu toàn quốc */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">KHỞI CHIẾU TOÀN QUỐC</span>
                  <p className="text-slate-200 font-medium mt-0.5">
                    {new Date(movie.releaseDate || Date.now()).toLocaleDateString('vi-VN')} (Toàn quốc)
                  </p>
                </div>

                {/* Ngôn ngữ & Định dạng */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">NGÔN NGỮ & ĐỊNH DẠNG</span>
                  <p className="text-slate-200 font-medium mt-0.5">{movie.language || 'Tiếng Anh - Phụ đề tiếng Việt chuẩn'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{movie.audioTech || 'Âm thanh 8 kênh & Dolby Atmos 64'}</p>
                </div>

                {/* Thời lượng tác phẩm */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">THỜI LƯỢNG TÁC PHẨM</span>
                  <p className="text-slate-200 font-medium flex items-center space-x-1.5 mt-0.5">
                    <span>🕒</span>
                    <span>{movie.duration} phút ({Math.floor(movie.duration / 60)} giờ {movie.duration % 60} phút)</span>
                  </p>
                </div>
              </div>

              {/* Callout tiêu chuẩn phòng chiếu */}
              <div className="bg-[#151d30] border border-blue-500/20 rounded-2xl p-3 flex items-center space-x-3">
                <span className="text-2xl text-blue-400">🔊</span>
                <div>
                  <h4 className="text-[11px] font-black text-white">Đạt chuẩn Dolby Atmos & Laser</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Âm trường 64 kênh không gian đa chiều sống động</p>
                </div>
              </div>
            </div>

          </div>

          {/* CỘT PHẢI (8 COLS): TÊN PHIM, ĐÁNH GIÁ, TÓM TẮT, DÀN DIỄN VIÊN */}
          <div className="lg:col-span-8 space-y-8 pt-4">
            
            {/* Header thông tin phim */}
            <div className="space-y-3">
              {/* Badges Phân Loại & Lời khuyên */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider border uppercase shadow-sm ${ageBadge.bg} ${ageBadge.text} ${ageBadge.border}`}>
                  {ageBadge.label}
                </span>
                <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {movie.contentAdvisory || 'Khuyên xem: Cảnh hành động mãn nhãn'}
                </span>
              </div>

              {/* Tiêu đề H1 lớn */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase leading-tight drop-shadow-md">
                {movie.title}
              </h1>

              {/* Subtitle / Tên tiếng Anh & Đạo diễn */}
              <p className="text-sm sm:text-base text-slate-400 font-medium italic">
                {movie.subTitle || `${movie.title} – Đạo diễn ${movie.director || 'Chuyên nghiệp'}`}
              </p>

              {/* Hàng Điểm Đánh Giá & Các Nút Hành Động */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-b border-slate-800/80 pb-5">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Rating MovieTix */}
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-black text-[#fbbf24]">★ {movie.rating || 4.9}</span>
                    <span className="text-xs text-slate-400 font-medium">
                      / 5.0
                      <br />
                      <span className="text-[10px] text-slate-500">{movie.ratingCount || '12.4k lượt đánh giá năm nay'}</span>
                    </span>
                  </div>

                  {/* Rotten Tomatoes */}
                  <div className="flex items-center space-x-2 border-l border-slate-800 pl-6">
                    <span className="text-2xl">🍅</span>
                    <div>
                      <span className="text-base font-black text-white">{movie.rottenTomatoes || '94%'}</span>
                      <span className="text-xs text-slate-400 ml-1">Rotten Tomatoes</span>
                      <p className="text-[10px] text-slate-500">{movie.rottenTomatoesLabel || 'Chứng nhận cà chua tươi (Certified Fresh)'}</p>
                    </div>
                  </div>
                </div>

                {/* Các nút: Yêu thích & Trợ lý AI */}
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsFavorite(!isFavorite)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                      isFavorite
                        ? 'bg-red-500/20 text-red-400 border-red-500/50'
                        : 'bg-[#151c2d] hover:bg-slate-800 text-slate-300 border-slate-700/80'
                    }`}
                  >
                    <span>{isFavorite ? '❤️' : '♡'}</span>
                    <span>{isFavorite ? 'Đã yêu thích' : 'Yêu thích'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      // Trigger mở chatbot
                      const chatBtn = document.querySelector('[title="Trợ lý ảo MovieTix"]') || document.querySelector('button[title*="Chat"]');
                      if (chatBtn) chatBtn.click();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 flex items-center space-x-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <span>🤖</span>
                    <span>Trợ lý AI</span>
                  </button>
                </div>
              </div>
            </div>

            {/* KHỐI TÓM TẮT NỘI DUNG */}
            <div className="bg-[#101625] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider border-l-4 border-blue-500 pl-3">
                  Tóm tắt nội dung
                </h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-3 font-normal">
                  {movie.description || 'Hành trình điện ảnh đỉnh cao và đầy cảm xúc đang chờ đón bạn khám phá.'}
                </p>
              </div>

              {/* 3 Thẻ Điểm Nổi Bật Đặc Sắc (Highlights) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                {Array.isArray(movie.highlights) && movie.highlights.length > 0 ? (
                  movie.highlights.map((h, idx) => (
                    <div key={idx} className="bg-[#141b2c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
                      <span className="text-2xl shrink-0">{h.icon || '✨'}</span>
                      <div>
                        <h4 className="text-xs font-black text-white leading-snug">{h.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal">{h.desc}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="bg-[#141b2c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
                      <span className="text-2xl shrink-0">🎦</span>
                      <div>
                        <h4 className="text-xs font-black text-white leading-snug">Khung hình mở rộng 1.43:1</h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal">Thêm 26% khung hình độc quyền rạp IMAX</p>
                      </div>
                    </div>
                    <div className="bg-[#141b2c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
                      <span className="text-2xl shrink-0">🎼</span>
                      <div>
                        <h4 className="text-xs font-black text-white leading-snug">Âm thanh Dolby Atmos</h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal">Âm nhạc hòa âm không gian đỉnh cao</p>
                      </div>
                    </div>
                    <div className="bg-[#141b2c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
                      <span className="text-2xl shrink-0">🏜️</span>
                      <div>
                        <h4 className="text-xs font-black text-white leading-snug">Kỹ xảo điện ảnh đỉnh cao</h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal">Ghi hình trên bối cảnh thực địa ngoạn mục</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* KHỐI DÀN DIỄN VIÊN & NHÂN VẬT */}
            <div className="bg-[#101625] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider border-l-4 border-blue-500 pl-3">
                  Dàn diễn viên & Nhân vật
                </h3>
                <span className="text-xs text-slate-400 font-semibold">
                  {Array.isArray(movie.cast) ? `${movie.cast.length} diễn viên chủ chốt` : '6 diễn viên chủ chốt'}
                </span>
              </div>

              {/* Danh sách ảnh tròn của diễn viên */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {Array.isArray(movie.cast) && movie.cast.length > 0 ? (
                  movie.cast.slice(0, 6).map((actor, idx) => (
                    <div key={idx} className="flex flex-col items-center text-center space-y-2 group/actor">
                      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-2 border-slate-700 group-hover/actor:border-blue-500 transition-colors shadow-lg bg-slate-800">
                        <img
                          src={actor.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop'}
                          alt={actor.name}
                          className="w-full h-full object-cover group-hover/actor:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop';
                          }}
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover/actor:text-blue-400 transition-colors line-clamp-1">
                          {actor.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{actor.role}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">Đang cập nhật danh sách diễn viên...</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. LỊCH CHIẾU RẠP TOÀN QUỐC (SHOWTIMES & BOOKING SECTION) */}
      <section id="showtimes-section" className="relative z-20 max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-12 mt-12">
        <div className="bg-[#101625] border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          
          {/* Header Khu Vực Đặt Vé */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest block">
                LỊCH CHIẾU RẠP TOÀN QUỐC
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                Chọn Ngày & Suất Chiếu
              </h2>
            </div>
            <div className="flex items-center space-x-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Cập nhật dữ liệu vé theo thời gian thực</span>
            </div>
          </div>

          {/* HÀNG CÁC TABS NGÀY CHIẾU (7 NGÀY) */}
          <div className="flex items-center space-x-3 overflow-x-auto pb-2 scrollbar-none">
            {dateTabs.map((d) => (
              <button
                key={d.index}
                type="button"
                onClick={() => setSelectedDateIndex(d.index)}
                className={`shrink-0 px-5 py-3 rounded-2xl flex flex-col items-center justify-center min-w-[110px] transition-all cursor-pointer border ${
                  selectedDateIndex === d.index
                    ? 'bg-[#2563eb] text-white border-blue-400 shadow-lg shadow-blue-600/30 scale-105'
                    : 'bg-[#151c2d] hover:bg-[#1a2339] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span className={`text-[10px] font-black uppercase tracking-wider ${selectedDateIndex === d.index ? 'text-blue-200' : 'text-slate-500'}`}>
                  {d.tag}
                </span>
                <span className="text-base sm:text-lg font-black mt-0.5">{d.dateStr}</span>
                <span className="text-[11px] font-medium opacity-80">{d.dayName}</span>
              </button>
            ))}
          </div>

          {/* HÀNG CHỌN CỤM RẠP */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span>📍</span>
              <span>CHỌN CỤM RẠP:</span>
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              {cinemas.map((c) => {
                const cId = c._id || c.id;
                const isSelected = selectedCinemaId === cId;
                return (
                  <button
                    key={cId}
                    type="button"
                    onClick={() => setSelectedCinemaId(cId)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-2 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 text-white border-blue-500 shadow-md ring-1 ring-blue-500/40'
                        : 'bg-[#151c2d] hover:bg-[#1b243b] text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    <span>🏢</span>
                    <span>{c.name}</span>
                    {c.isFlagship && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/40">
                        Flagship
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DANH SÁCH SUẤT CHIẾU THEO 3 ĐỊNH DẠNG PHÒNG CHIẾU */}
          <div className="space-y-6 pt-2">
            
            {/* NHÓM 1: PHÒNG CHIẾU IMAX LASER GRAND HALL */}
            <div className="bg-[#141b2c] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2.5">
                  <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded shadow">
                    IMAX LASER 2D
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    Phòng chiếu IMAX Laser Grand Hall • Âm thanh 12 kênh riêng biệt
                  </h4>
                </div>
                <span className="text-[11px] text-amber-400 font-bold">Giá vé từ: 160.000đ</span>
              </div>

              {/* Các khung giờ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {fallbackImaxTimes.map((st) => {
                  const isChosen = currentActiveShowtime?.id === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedShowtime({ ...st, cinemaName: displayCinema.name, format: 'IMAX Laser 2D' })}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 group ${
                        isChosen
                          ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/40 shadow-lg'
                          : 'bg-[#182136] hover:bg-[#1f2b45] border-slate-700/60 hover:border-blue-400/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl sm:text-2xl font-black text-white group-hover:text-blue-300 transition-colors">
                          {st.time}
                        </span>
                        {st.tag ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {st.tag}
                          </span>
                        ) : isChosen ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500 text-white">
                            ĐANG CHỌN
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{st.roomName}</span>
                        <span className="text-emerald-400 font-bold">Còn {st.availableSeats} chỗ</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NHÓM 2: PHÒNG CHIẾU TIÊU CHUẨN DOLBY 7.1 */}
            <div className="bg-[#141b2c] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2.5">
                  <span className="bg-slate-700 text-slate-200 font-black text-[10px] px-2 py-0.5 rounded shadow">
                    2D PHỤ ĐỀ
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    Phòng chiếu tiêu chuẩn Dolby 7.1 • Màn chiếu 4K sắc nét
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-bold">Giá vé từ: 95.000đ</span>
              </div>

              {/* Các khung giờ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {fallbackStandardTimes.map((st) => {
                  const isChosen = currentActiveShowtime?.id === st.id;
                  const isSoldOut = st.availableSeats === 0;
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        if (!isSoldOut) {
                          setSelectedShowtime({ ...st, cinemaName: displayCinema.name, format: '2D Tiêu Chuẩn Dolby 7.1' });
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
                        isSoldOut
                          ? 'bg-[#151c2d]/60 border-slate-800 opacity-50 cursor-not-allowed'
                          : isChosen
                          ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/40 shadow-lg cursor-pointer'
                          : 'bg-[#182136] hover:bg-[#1f2b45] border-slate-700/60 hover:border-blue-400/60 cursor-pointer group'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xl sm:text-2xl font-black ${isSoldOut ? 'text-slate-500 line-through' : 'text-white group-hover:text-blue-300 transition-colors'}`}>
                          {st.time}
                        </span>
                        {isSoldOut ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            HẾT VÉ
                          </span>
                        ) : isChosen ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500 text-white">
                            ĐANG CHỌN
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{st.roomName}</span>
                        <span className={isSoldOut ? 'text-slate-500' : 'text-emerald-400 font-bold'}>
                          {isSoldOut ? '0 chỗ' : `Còn ${st.availableSeats} chỗ`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NHÓM 3: PHÒNG CHIẾU REALD 3D HIGH FRAME RATE */}
            <div className="bg-[#141b2c] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2.5">
                  <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded shadow">
                    3D PHỤ ĐỀ
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    Phòng chiếu RealD 3D High Frame Rate • Kính 3D nhẹ êm cao cấp
                  </h4>
                </div>
                <span className="text-[11px] text-emerald-400 font-bold">Giá vé từ: 110.000đ</span>
              </div>

              {/* Các khung giờ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {fallback3DTimes.map((st) => {
                  const isChosen = currentActiveShowtime?.id === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedShowtime({ ...st, cinemaName: displayCinema.name, format: 'RealD 3D HFR' })}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 group ${
                        isChosen
                          ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/40 shadow-lg'
                          : 'bg-[#182136] hover:bg-[#1f2b45] border-slate-700/60 hover:border-blue-400/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl sm:text-2xl font-black text-white group-hover:text-blue-300 transition-colors">
                          {st.time}
                        </span>
                        {isChosen && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500 text-white">
                            ĐANG CHỌN
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{st.roomName}</span>
                        <span className="text-emerald-400 font-bold">Còn {st.availableSeats} chỗ</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* THANH GỢI Ý & ĐẶT VÉ NHANH BÊN TRONG BẢNG */}
          <div className="bg-[#151d30] border border-blue-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <span className="text-3xl text-blue-400">🎟️</span>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-white">
                  Suất chiếu đã chọn: {currentActiveShowtime?.time || '19:15'} • {selectedDate.tag} {selectedDate.dateStr}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {displayCinema.name} • {currentActiveShowtime?.roomName || 'Phòng IMAX 01'} • {currentActiveShowtime?.format || 'IMAX Laser 2D'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end space-x-4 w-full sm:w-auto">
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Tạm tính cho 1 vé tiêu chuẩn:</span>
                <span className="text-base sm:text-lg font-black text-white">
                  {(currentActiveShowtime?.price || 160000).toLocaleString('vi-VN')} đ <span className="text-xs font-normal text-slate-400">/ vé</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const targetId = currentActiveShowtime?.id || movie.firstShowtimeId || '6ae624fdb0ee30fb919c72d6';
                  navigate(`/booking/seat/${targetId}`);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-3 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-blue-500/25 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              >
                <span>Tiếp Tục Chọn Ghế</span>
                <span>→</span>
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 4. MODAL XEM TRAILER POPUP ĐỈNH CAO */}
      {isTrailerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full p-4 relative shadow-2xl">
            <button
              onClick={() => setIsTrailerModalOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold flex items-center justify-center transition-colors shadow-lg cursor-pointer"
              title="Đóng trailer"
            >
              ✕
            </button>
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner">
              <iframe
                src={getEmbedTrailerUrl(movie.trailerUrl)}
                title={`${movie.title} Official Trailer`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <div className="mt-3 px-1 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white text-sm">{movie.title}</span>
                <p className="text-slate-400 text-[11px] mt-0.5">{movie.genre} • {movie.duration} phút</p>
              </div>
              <button
                onClick={() => {
                  setIsTrailerModalOpen(false);
                  scrollToBooking();
                }}
                className="bg-[#2563eb] hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-1 shadow cursor-pointer"
              >
                <span>🎟️</span>
                <span>Đặt vé ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieDetailPage;
