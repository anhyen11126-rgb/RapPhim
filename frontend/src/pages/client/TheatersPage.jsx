import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Danh sách các rạp chiếu mẫu chuẩn theo thiết kế
const THEATERS_DATA = [
  {
    id: 'landmark-81',
    name: 'MovieTix Landmark 81 IMAX',
    isFlagship: true,
    distance: '1.8 km',
    address: 'Tầng B1 Vincom Landmark 81, 720A Điện Biên Phủ, P.22, Q.Bình Thạnh, TP.HCM',
    shortAddress: 'Tầng B1 Vincom Landmark 81, 720A Điện Biên Phủ, P.22, Q.Bình Thạnh',
    rating: '4.9',
    reviewsCount: '2,410',
    tags: ['IMAX Laser', 'Dolby Atmos', 'Gold Class'],
    specialBadge: 'Màn chiếu Laser 22x11m lớn nhất VN',
    image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&auto=format&fit=crop',
    openingHours: '08:00 - 02:00 sáng',
    hotline: '1900 8899',
    parking: 'Hầm B2 - B3 giữ xe 24/7 (Miễn phí 3h xem phim)',
    roomCount: 7,
    movies: [
      {
        id: 'dune-2',
        title: 'Dune: Hành Tinh Cát – Phần 2',
        originalTitle: 'Dune: Part Two • Đạo diễn: Denis Villeneuve',
        ageRating: 'T18',
        poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop',
        ratingPercent: '98% Hài lòng',
        duration: '166 phút',
        genre: 'Khoa học viễn tưởng, Hành động',
        rooms: [
          {
            name: 'Phòng 01 - IMAX Laser 3D',
            feature: 'Màn hình cong 1.43:1',
            priceText: 'Giá từ 160.000đ',
            showtimes: [
              { id: 'st-lm-dune-1', time: '18:30', status: 'AVAILABLE', seatText: 'còn 24 ghế', statusColor: 'text-emerald-400' },
              { id: 'st-lm-dune-2', time: '21:15', status: 'ALMOST_FULL', seatText: 'còn 8 ghế (sắp hết)', statusColor: 'text-amber-400' },
            ],
          },
          {
            name: 'Phòng 03 - 2D Phụ Đề Atmos',
            feature: '64 kênh âm thanh vòm',
            priceText: 'Giá từ 110.000đ',
            showtimes: [
              { id: 'st-lm-dune-3', time: '17:00', status: 'AVAILABLE', seatText: 'còn 45 ghế', statusColor: 'text-slate-400' },
              { id: 'st-lm-dune-4', time: '19:45', status: 'AVAILABLE', seatText: 'còn 42 ghế', statusColor: 'text-slate-400' },
              { id: 'st-lm-dune-5', time: '22:30', status: 'AVAILABLE', seatText: 'còn 50 ghế', statusColor: 'text-slate-400' },
            ],
          },
        ],
      },
      {
        id: 'mai',
        title: 'Mai',
        originalTitle: 'Phim điện ảnh của Trấn Thành',
        ageRating: 'T18',
        badge: 'Đang hợp chiếu & Lịch chiếu',
        poster: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&auto=format&fit=crop',
        ratingPercent: 'Cháy vé liên tục',
        duration: '131 phút',
        genre: 'Tâm lý, Tình cảm',
        rooms: [
          {
            name: 'Phòng 02 - 2D Tiêu Chuẩn',
            priceText: 'Giá từ 95.000đ',
            showtimes: [
              { id: 'st-lm-mai-1', time: '18:00' },
              { id: 'st-lm-mai-2', time: '19:30' },
              { id: 'st-lm-mai-3', time: '20:45' },
              { id: 'st-lm-mai-4', time: '22:15' },
            ],
          },
          {
            name: 'Phòng 05 - VIP Gold Class',
            feature: 'Ghế da Recliner ngả 180°',
            priceText: '250.000đ (Bao gồm Set Bar)',
            showtimes: [
              { id: 'st-lm-mai-5', time: '19:15', seatText: 'Phục vụ vang & snack', statusColor: 'text-amber-300' },
              { id: 'st-lm-mai-6', time: '21:40', seatText: 'Phục vụ vang & snack', statusColor: 'text-amber-300' },
            ],
          },
        ],
      },
      {
        id: 'kung-fu-panda-4',
        title: 'Kung Fu Panda 4',
        originalTitle: 'DreamWorks Animation • Bản lồng tiếng & phụ đề',
        ageRating: 'P',
        poster: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=500&auto=format&fit=crop',
        ratingPercent: 'Thích hợp gia đình',
        duration: '94 phút',
        genre: 'Hoạt hình, Hài hước',
        rooms: [
          {
            name: 'Phòng 04 - 2D Lồng Tiếng',
            feature: 'Thích hợp cho trẻ em',
            priceText: 'Giá từ 85.000đ',
            showtimes: [
              { id: 'st-lm-kfp-1', time: '17:15' },
              { id: 'st-lm-kfp-2', time: '18:45' },
              { id: 'st-lm-kfp-3', time: '20:15' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'vincom-dong-khoi',
    name: 'MovieTix Vincom Đồng Khởi',
    isFlagship: false,
    distance: '3.5 km',
    address: 'Tầng 3 Vincom Center, 72 Lê Thánh Tôn, P.Bến Nghé, Quận 1, TP.HCM',
    shortAddress: 'Tầng 3 Vincom Center, 72 Lê Thánh Tôn, Quận 1',
    rating: '4.8',
    reviewsCount: '1,890',
    tags: ['Dolby Atmos', '4DX Sound'],
    specialBadge: 'Trải nghiệm 4DX rung lắc độc quyền',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop',
    openingHours: '08:30 - 01:30 sáng',
    hotline: '1900 8899',
    parking: 'Hầm B3 gửi xe máy & ô tô',
    roomCount: 6,
    movies: [],
  },
  {
    id: 'sala-thu-thiem',
    name: 'MovieTix Sala Thủ Thiêm',
    isFlagship: false,
    distance: '4.2 km',
    address: 'Tầng 4 Thiso Mall, 10 Mai Chí Thọ, P.Thủ Thiêm, TP.Thủ Đức, TP.HCM',
    shortAddress: 'Tầng 4 Thiso Mall, 10 Mai Chí Thọ, Thủ Đức',
    rating: '4.9',
    reviewsCount: '1,420',
    tags: ['IMAX Laser', 'Sweetbox Lounge'],
    specialBadge: 'Cụm rạp mới khai trương chuẩn quốc tế',
    image: 'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=1200&auto=format&fit=crop',
    openingHours: '09:00 - 01:00 sáng',
    hotline: '1900 8899',
    parking: 'Bãi xe Thiso Mall miễn phí 4h',
    roomCount: 8,
    movies: [],
  },
  {
    id: 'crescent-mall',
    name: 'MovieTix Crescent Mall',
    isFlagship: false,
    distance: '4.8 km',
    address: 'Tầng 5 Crescent Mall, Nguyễn Văn Linh, P.Tân Phú, Quận 7, TP.HCM',
    shortAddress: 'Tầng 5 Crescent Mall, Nguyễn Văn Linh, Quận 7',
    rating: '4.7',
    reviewsCount: '980',
    tags: ['Dolby Atmos', 'Kids Hall'],
    specialBadge: 'Khu vực Kids Cinema & Family Lounge',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop',
    openingHours: '08:30 - 24:00',
    hotline: '1900 8899',
    parking: 'Hầm B1 & B2 Crescent Mall',
    roomCount: 6,
    movies: [],
  },
  {
    id: 'van-hanh-mall',
    name: 'MovieTix Vạn Hạnh Mall',
    isFlagship: false,
    distance: '5.1 km',
    address: 'Tầng 6 Vạn Hạnh Mall, 11 Sư Vạn Hạnh, Phường 12, Quận 10, TP.HCM',
    shortAddress: 'Tầng 6 Vạn Hạnh Mall, 11 Sư Vạn Hạnh, Quận 10',
    rating: '4.8',
    reviewsCount: '2,150',
    tags: ['Dolby Atmos'],
    specialBadge: 'Sảnh chờ phong cách Cyberpunk hiện đại',
    image: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=1200&auto=format&fit=crop',
    openingHours: '08:00 - 01:30 sáng',
    hotline: '1900 8899',
    parking: 'Nhà xe 9 tầng Vạn Hạnh Mall',
    roomCount: 7,
    movies: [],
  },
];

const REGIONS = [
  'Tất cả khu vực',
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Hà Tĩnh',
];

const TECH_FILTERS = ['Tất cả', 'IMAX Laser', 'Dolby Atmos', 'Gold Class'];

const TheatersPage = () => {
  const navigate = useNavigate();
  const [activeRegion, setActiveRegion] = useState('TP. Hồ Chí Minh');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeTech, setActiveTech] = useState('Tất cả');
  const [selectedTheaterId, setSelectedTheaterId] = useState('landmark-81');
  const [activeDateIndex, setActiveDateIndex] = useState(0);
  const [dbFirstShowtimeId, setDbFirstShowtimeId] = useState(null);

  // Sinh 7 ngày liên tiếp tính từ hôm nay
  const dates = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx);
    const dayNames = ['CHỦ NHẬT', 'THỨ 2', 'THỨ 3', 'THỨ 4', 'THỨ 5', 'THỨ 6', 'THỨ 7'];
    const dayStr = idx === 0 ? 'HÔM NAY' : dayNames[d.getDay()];
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
    return { dayStr, dateStr };
  });

  // Tải danh sách phim từ DB để lấy showtimeId thật nếu có
  useEffect(() => {
    const loadDbShowtimes = async () => {
      try {
        const res = await api.get('/movies');
        if (res.data && res.data.length > 0 && res.data[0].firstShowtimeId) {
          setDbFirstShowtimeId(res.data[0].firstShowtimeId);
        }
      } catch (err) {
        console.warn('Không tải được showtimeId từ backend, dùng fallback:', err);
      }
    };
    loadDbShowtimes();
  }, []);

  // Lọc danh sách rạp
  const filteredTheaters = THEATERS_DATA.filter((theater) => {
    const matchSearch =
      theater.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      theater.address.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchTech = activeTech === 'Tất cả' || theater.tags.includes(activeTech);
    return matchSearch && matchTech;
  });

  // Rạp đang chọn
  const selectedTheater =
    THEATERS_DATA.find((t) => t.id === selectedTheaterId) || THEATERS_DATA[0];

  // Chuyển sang màn hình chọn ghế khi click suất chiếu
  const handleSelectShowtime = (showtimeId) => {
    const targetId = dbFirstShowtimeId || showtimeId || '1';
    navigate(`/booking/seat/${targetId}`);
  };

  return (
    <div className="bg-[#0b0f19] min-h-screen text-slate-100 pb-20">
      {/* 1. Thanh lọc Tỉnh / Thành phố */}
      <div className="border-b border-slate-800/80 bg-[#090d16] sticky top-16 z-40">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-0.5">
            {REGIONS.map((region) => (
              <button
                key={region}
                onClick={() => setActiveRegion(region)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeRegion === region
                    ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                {region}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 shrink-0">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-medium text-emerald-400">28 rạp</span>
            <span>đang mở cửa</span>
          </div>
        </div>
      </div>

      {/* 2. Thanh Tìm kiếm & Lọc công nghệ phòng chiếu */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-5 pb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Input Tìm kiếm */}
          <div className="relative flex-1 max-w-2xl">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm tên cụm rạp, quận hoặc địa chỉ đường..."
              className="w-full bg-[#111624] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
            />
          </div>

          {/* Lọc công nghệ */}
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Công nghệ:
            </span>
            <div className="flex items-center space-x-1.5">
              {TECH_FILTERS.map((tech) => (
                <button
                  key={tech}
                  onClick={() => setActiveTech(tech)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTech === tech
                      ? 'bg-[#2563eb] text-white shadow-sm'
                      : 'bg-[#151c2d] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bố cục 2 Cột chính: Danh sách rạp (Trái) & Thông tin chi tiết + Lịch chiếu (Phải) */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI (4 cols): Danh sách các cụm rạp */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                <span>🏢</span>
                <span>Cụm rạp tại {activeRegion === 'Tất cả khu vực' ? 'Toàn quốc' : activeRegion}</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {filteredTheaters.length} rạp
              </span>
            </div>

            <div className="space-y-3">
              {filteredTheaters.map((theater) => {
                const isSelected = theater.id === selectedTheater.id;
                return (
                  <div
                    key={theater.id}
                    onClick={() => setSelectedTheaterId(theater.id)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 border ${
                      isSelected
                        ? 'bg-[#141b2d] border-blue-500/80 shadow-lg shadow-blue-600/10 ring-1 ring-blue-500/50'
                        : 'bg-[#0f1422] border-slate-800/80 hover:bg-[#131929] hover:border-slate-700'
                    }`}
                  >
                    {/* Header Card: Flagship & Khoảng cách */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {theater.isFlagship ? (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center space-x-1">
                          <span>⭐</span>
                          <span>Flagship Cineplex</span>
                        </span>
                      ) : (
                        <div />
                      )}
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center space-x-0.5">
                        <span>📍</span>
                        <span>{theater.distance}</span>
                      </span>
                    </div>

                    {/* Tên rạp */}
                    <h3
                      className={`text-sm font-black tracking-tight mb-1.5 transition-colors ${
                        isSelected ? 'text-white' : 'text-slate-200'
                      }`}
                    >
                      {theater.name}
                    </h3>

                    {/* Địa chỉ */}
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {theater.address}
                    </p>

                    {/* Badges Công nghệ & Xem bản đồ */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {theater.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-slate-800/90 text-slate-300 border border-slate-700/60 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <span className="text-[11px] text-slate-400 hover:text-blue-400 flex items-center space-x-1 transition-colors">
                        <span>🗺️</span>
                        <span>Xem bản đồ</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredTheaters.length === 0 && (
                <div className="p-8 text-center bg-[#0f1422] rounded-2xl border border-slate-800 text-slate-400 text-xs">
                  Không tìm thấy cụm rạp phù hợp với từ khóa "{searchKeyword}".
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI (8 cols): Banner chi tiết rạp & Danh sách Suất chiếu theo ngày */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. HERO BANNER CỤM RẠP ĐANG CHỌN */}
            <div className="bg-[#0f1422] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              {/* Ảnh bìa sảnh rạp sang trọng */}
              <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-900">
                <img
                  src={selectedTheater.image}
                  alt={selectedTheater.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1422] via-[#0f1422]/60 to-transparent" />

                {/* Rating góc trên bên phải */}
                <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md border border-amber-500/30 px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-lg">
                  <span className="text-amber-400 text-xs">⭐</span>
                  <span className="text-white text-xs font-black">{selectedTheater.rating}</span>
                  <span className="text-slate-400 text-[10px]">({selectedTheater.reviewsCount} đánh giá)</span>
                </div>

                {/* Badges nổi bật góc dưới ảnh */}
                <div className="absolute bottom-4 left-6 flex flex-wrap items-center gap-2">
                  {selectedTheater.isFlagship && (
                    <span className="bg-amber-500 text-slate-950 text-xs font-black px-2.5 py-1 rounded-md shadow">
                      ⭐ Cụm rạp Flagship
                    </span>
                  )}
                  {selectedTheater.specialBadge && (
                    <span className="bg-emerald-500/90 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-md shadow">
                      {selectedTheater.specialBadge}
                    </span>
                  )}
                </div>
              </div>

              {/* Thông tin chi tiết rạp */}
              <div className="p-6 sm:p-7 space-y-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {selectedTheater.name}
                  </h1>
                </div>

                {/* Grid 4 thông số */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                  <div className="flex items-start space-x-2.5">
                    <span className="text-base text-red-500 shrink-0">📍</span>
                    <span className="leading-relaxed">{selectedTheater.address}</span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <span className="text-base text-blue-400 shrink-0">🕒</span>
                    <span>Giờ mở cửa: <strong className="text-white">{selectedTheater.openingHours}</strong></span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <span className="text-base text-emerald-400 shrink-0">📞</span>
                    <span>Hotline đặt vé: <strong className="text-white">{selectedTheater.hotline}</strong></span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <span className="text-base text-amber-400 shrink-0">🅿️</span>
                    <span>{selectedTheater.parking}</span>
                  </div>
                </div>

                {/* Thanh nút bấm hành động */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center space-x-3">
                    <button className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors border border-slate-700 flex items-center space-x-1.5 shadow-sm">
                      <span>📍</span>
                      <span>Chỉ đường Google Maps</span>
                    </button>
                    <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-4 py-2 rounded-xl transition-colors border border-slate-700 flex items-center space-x-1.5">
                      <span>📋</span>
                      <span>Bảng giá vé tiêu chuẩn</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>{selectedTheater.roomCount} phòng chiếu đang sẵn sàng</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. CHỌN NGÀY CHIẾU (DATE PICKER) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-base">📅</span>
                  <h3 className="text-base font-black text-white">Lịch chiếu rạp</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">Tháng 10, 2026</span>
              </div>

              {/* Dải 7 ngày cuộn ngang */}
              <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none pb-1">
                {dates.map((item, idx) => {
                  const isActive = idx === activeDateIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveDateIndex(idx)}
                      className={`flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl min-w-[88px] transition-all border ${
                        isActive
                          ? 'bg-[#2563eb] text-white border-blue-500 shadow-lg shadow-blue-600/30 font-bold'
                          : 'bg-[#0f1422] text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className={`text-[10px] tracking-wider font-semibold uppercase ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                        {item.dayStr}
                      </span>
                      <span className={`text-sm font-black mt-0.5 ${isActive ? 'text-white' : 'text-slate-200'}`}>
                        {item.dateStr}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. DANH SÁCH PHIM & KHUNG GIỜ CHIẾU TẠI RẠP */}
            <div className="space-y-5">
              {selectedTheater.movies && selectedTheater.movies.length > 0 ? (
                selectedTheater.movies.map((movie) => (
                  <div
                    key={movie.id}
                    className="bg-[#0f1422] border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 hover:border-slate-700/80 transition-colors"
                  >
                    {/* Phần đầu: Poster & Thông tin phim */}
                    <div className="flex items-start space-x-4">
                      {/* Poster */}
                      <div className="relative w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 shrink-0 shadow-md">
                        <img
                          src={movie.poster}
                          alt={movie.title}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                          {movie.ageRating}
                        </span>
                      </div>

                      {/* Tên phim & metadata */}
                      <div className="flex-1 space-y-1">
                        {movie.badge && (
                          <span className="inline-block bg-red-600/20 text-red-400 border border-red-500/30 text-[9px] font-bold px-2 py-0.5 rounded mb-1">
                            {movie.badge}
                          </span>
                        )}
                        <h4 className="text-lg font-black text-white hover:text-blue-400 transition-colors">
                          <Link to={`/movie/${movie.id}`}>{movie.title}</Link>
                        </h4>
                        <p className="text-xs text-slate-400 font-medium">{movie.originalTitle}</p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-xs text-slate-400">
                          <span className="text-emerald-400 font-bold">{movie.ratingPercent}</span>
                          <span>•</span>
                          <span>{movie.duration}</span>
                          <span>•</span>
                          <span className="text-slate-300">{movie.genre}</span>
                        </div>
                      </div>
                    </div>

                    {/* Danh sách phòng chiếu & các khung giờ */}
                    <div className="space-y-3 pt-2">
                      {movie.rooms.map((room, rIdx) => (
                        <div
                          key={rIdx}
                          className="bg-[#141b2c] border border-slate-800/80 rounded-2xl p-4 space-y-3"
                        >
                          {/* Header phòng: Tên phòng, Đặc tính & Giá vé */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                {room.name}
                              </span>
                              {room.feature && (
                                <span className="text-slate-400 text-[11px]">
                                  • {room.feature}
                                </span>
                              )}
                            </div>
                            <span className="text-slate-400 font-medium text-[11px]">
                              {room.priceText}
                            </span>
                          </div>

                          {/* Các nút bấm Suất chiếu */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            {room.showtimes.map((st, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => handleSelectShowtime(st.id)}
                                className="group relative bg-[#0b0f19] hover:bg-[#2563eb] border border-slate-700/80 hover:border-blue-500 px-4 py-2 rounded-xl text-left transition-all duration-200 shadow-sm"
                              >
                                <span className="block text-sm font-black text-white group-hover:text-white">
                                  {st.time}
                                </span>
                                {st.seatText && (
                                  <span
                                    className={`block text-[10px] font-semibold mt-0.5 group-hover:text-blue-100 ${
                                      st.statusColor || 'text-slate-400'
                                    }`}
                                  >
                                    {st.seatText}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                /* Trường hợp chọn rạp khác chưa có lịch chiếu chi tiết */
                <div className="bg-[#0f1422] border border-slate-800 rounded-3xl p-10 text-center space-y-3">
                  <div className="text-3xl">🍿</div>
                  <h4 className="text-base font-bold text-white">
                    Lịch chiếu hôm nay tại {selectedTheater.name}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Hiện tại suất chiếu hôm nay tại cụm rạp này đang được cập nhật. Bạn vui lòng chọn{' '}
                    <strong className="text-blue-400 cursor-pointer" onClick={() => setSelectedTheaterId('landmark-81')}>
                      MovieTix Landmark 81 IMAX
                    </strong>{' '}
                    để trải nghiệm đặt vé nhanh nhé!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TheatersPage;
