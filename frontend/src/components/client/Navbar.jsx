import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  VIETNAM_PROVINCES,
  POPULAR_CITIES,
  CITIES_WITH_CINEMAS,
  removeVietnameseTones,
} from '../../constants/provinces';

// Bộ sưu tập ảnh đại diện phim hot và nhân vật cinema
const PRESET_AVATARS = [
  {
    id: 'spiderman',
    name: 'Spider-Man',
    url: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=300&auto=format&fit=crop',
    tag: 'Marvel',
  },
  {
    id: 'dune',
    name: 'Dune Sci-Fi',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop',
    tag: 'Sci-Fi',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Hero',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop',
    tag: 'Action',
  },
  {
    id: 'batman',
    name: 'Dark Knight',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop',
    tag: 'DC',
  },
  {
    id: 'vip_gold',
    name: 'D\'Avenor VIP Gold',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop',
    tag: 'VIP',
  },
  {
    id: 'popart',
    name: 'Pop Art Cinema',
    url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop',
    tag: 'Art',
  },
  {
    id: 'retro_3d',
    name: '3D Glasses Movie',
    url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&auto=format&fit=crop',
    tag: 'Cinema',
  },
  {
    id: 'filmreel',
    name: 'Film Director',
    url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=300&auto=format&fit=crop',
    tag: 'Director',
  },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // State người dùng hiện tại
  const [currentUser, setCurrentUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // State Modal Đổi Ảnh Đại Diện (Avatar)
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarActiveTab, setAvatarActiveTab] = useState('presets'); // 'presets' | 'upload' | 'url'
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState('');
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  // State vị trí tỉnh / thành phố
  const [selectedCity, setSelectedCity] = useState(
    () => localStorage.getItem('selectedCity') || 'TP. Hồ Chí Minh'
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const locationRef = useRef(null);

  // State tìm kiếm phim trực tiếp từ Database MongoDB
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchRef = useRef(null);

  const loadUser = () => {
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    loadUser();

    // Lắng nghe sự kiện đăng nhập / đăng xuất từ AuthPage
    window.addEventListener('authChange', loadUser);
    window.addEventListener('storage', loadUser);

    // Đóng dropdown, modal vị trí & kết quả tìm kiếm phim khi click ra ngoài
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (locationRef.current && !locationRef.current.contains(event.target)) {
        setIsLocationModalOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Đồng bộ nếu có trang khác thay đổi tỉnh thành
    const handleCitySync = (e) => {
      if (e.detail) {
        setSelectedCity(e.detail);
      }
    };
    window.addEventListener('cityChange', handleCitySync);

    return () => {
      window.removeEventListener('authChange', loadUser);
      window.removeEventListener('storage', loadUser);
      window.removeEventListener('cityChange', handleCitySync);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Tìm kiếm phim thời gian thực từ Database MongoDB
  useEffect(() => {
    if (!movieSearchQuery.trim()) {
      setMovieSearchResults([]);
      setIsSearchDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchLoading(true);
        setIsSearchDropdownOpen(true);
        const res = await api.get('/movies', {
          params: { search: movieSearchQuery.trim() },
        });
        setMovieSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.warn('Lỗi tìm kiếm phim từ database:', err);
        setMovieSearchResults([]);
      } finally {
        setIsSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [movieSearchQuery]);

  const handleSelectMovie = (movie) => {
    setIsSearchDropdownOpen(false);
    setMovieSearchQuery('');
    navigate(`/movie/${movie.id || movie._id || movie.slug}`);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (movieSearchResults.length > 0) {
        handleSelectMovie(movieSearchResults[0]);
      }
    } else if (e.key === 'Escape') {
      setIsSearchDropdownOpen(false);
    }
  };

  const handleSelectCity = (city) => {
    setSelectedCity(city);
    localStorage.setItem('selectedCity', city);
    window.dispatchEvent(new CustomEvent('cityChange', { detail: city }));
    setIsLocationModalOpen(false);
    setLocationSearch('');
  };

  // Lọc danh sách tỉnh thành theo từ khóa tìm kiếm
  const filteredProvinces = VIETNAM_PROVINCES.filter((province) => {
    if (!locationSearch.trim()) return true;
    const searchNorm = removeVietnameseTones(locationSearch);
    const provinceNorm = removeVietnameseTones(province);
    if (searchNorm === 'hcm' || searchNorm === 'sg' || searchNorm === 'sai gon') {
      return province === 'TP. Hồ Chí Minh';
    }
    if (searchNorm === 'hn') return province === 'Hà Nội';
    if (searchNorm === 'dn') return province === 'Đà Nẵng';
    if (searchNorm === 'hp') return province === 'Hải Phòng';
    return provinceNorm.includes(searchNorm);
  });

  const handleOpenAvatarModal = () => {
    setIsDropdownOpen(false);
    setSelectedAvatarUrl(currentUser?.avatar || '');
    setCustomAvatarInput(
      currentUser?.avatar && currentUser.avatar.startsWith('http') ? currentUser.avatar : ''
    );
    setAvatarMessage({ type: '', text: '' });
    setIsAvatarModalOpen(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarMessage({
        type: 'error',
        text: 'Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP, JPEG)!',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage({
        type: 'error',
        text: 'Kích thước file ảnh không được vượt quá 5MB!',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedAvatarUrl(event.target.result);
      setAvatarMessage({
        type: 'success',
        text: 'Đã tải ảnh lên thành công. Bấm "Lưu Thay Đổi" để áp dụng ảnh mới!',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async () => {
    try {
      setIsUpdatingAvatar(true);
      setAvatarMessage({ type: '', text: '' });

      const newAvatar = selectedAvatarUrl ? selectedAvatarUrl.trim() : '';

      const token = localStorage.getItem('token');
      const payload = {
        avatar: newAvatar,
        userId: currentUser?.id || currentUser?._id,
        email: currentUser?.email,
      };

      const res = await api.put('/auth/avatar', payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // Cập nhật localStorage
      const updatedUser = {
        ...currentUser,
        avatar: newAvatar,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      // Bắn sự kiện đồng bộ toàn bộ app
      window.dispatchEvent(new Event('authChange'));

      setAvatarMessage({
        type: 'success',
        text: res.data?.message || 'Cập nhật ảnh đại diện thành công!',
      });

      setTimeout(() => {
        setIsAvatarModalOpen(false);
      }, 900);
    } catch (err) {
      console.error('Lỗi cập nhật ảnh đại diện:', err);
      setAvatarMessage({
        type: 'error',
        text: err.response?.data?.message || 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại!',
      });
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleResetToDefaultAvatar = () => {
    setSelectedAvatarUrl('');
    setCustomAvatarInput('');
    setAvatarMessage({
      type: 'info',
      text: 'Đã chọn ảnh đại diện con người mặc định. Bấm "Lưu Thay Đổi" để xác nhận.',
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setCurrentUser(null);
    setIsDropdownOpen(false);
    window.dispatchEvent(new Event('authChange'));
    navigate('/');
  };

  return (
    <header className="bg-[#0b0f19] border-b border-slate-800/80 sticky top-0 z-50 transition-all">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-10 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center space-x-5 lg:space-x-7">
          <Link
            to="/"
            className="group flex items-center space-x-3 transition-all duration-300"
            title="D'AVENOR CINEMA"
          >
            {/* Logo hình chữ nhật bo viền phát sáng tràn viền */}
            <div className="h-9 sm:h-10 w-[86px] sm:w-[96px] rounded-xl overflow-hidden border border-slate-700/80 group-hover:border-blue-400 group-hover:shadow-[0_0_18px_rgba(59,130,246,0.65),0_0_35px_rgba(37,99,235,0.3)] group-hover:ring-1 group-hover:ring-blue-400/50 transition-all duration-300 shrink-0">
              <img
                src="/Logo.png"
                alt="D'AVENOR CINEMA Logo"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 block"
              />
            </div>
          </Link>

          {/* Nav Items */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto scrollbar-none">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${location.pathname === '/'
                ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900 font-medium'
                }`}
            >
              Phim
            </Link>

            <Link
              to="/theaters"
              className={`px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${location.pathname === '/theaters'
                ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900 font-medium'
                }`}
            >
              Rạp chiếu
            </Link>

            <Link
              to="/promotions"
              className={`px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${location.pathname === '/promotions'
                ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900 font-medium'
                }`}
            >
              Ưu đãi
            </Link>

            <Link
              to="/support"
              className={`px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${location.pathname === '/support'
                ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900 font-medium'
                }`}
            >
              Hỗ trợ
            </Link>


          </nav>
        </div>

        {/* Right: Search, Location, User Auth & Profile */}
        <div className="flex items-center space-x-3">
          {/* Thanh tìm kiếm phim thời gian thực kết nối Database MongoDB */}
          <div className="relative hidden md:block w-56 lg:w-72" ref={searchRef}>
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={movieSearchQuery}
              onChange={(e) => setMovieSearchQuery(e.target.value)}
              onFocus={() => {
                if (movieSearchQuery.trim()) setIsSearchDropdownOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm phim, diễn viên, rạp..."
              className="w-full bg-[#131926] border border-slate-800 rounded-full pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {movieSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setMovieSearchQuery('');
                  setMovieSearchResults([]);
                  setIsSearchDropdownOpen(false);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}

            {/* Menu Dropdown hiển thị kết quả phim tìm kiếm từ Database */}
            {isSearchDropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-[#0c1220] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-2 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">
                    KẾT QUẢ TÌM KIẾM ({movieSearchResults.length})
                  </span>
                  {isSearchLoading && (
                    <span className="text-blue-400 flex items-center gap-1 font-semibold">
                      <span className="w-2.5 h-2.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                      Đang tra cứu...
                    </span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                  {isSearchLoading && movieSearchResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Đang tìm kiếm phim trong hệ thống...
                    </div>
                  ) : movieSearchResults.length === 0 ? (
                    <div className="py-6 px-4 text-center space-y-1">
                      <p className="text-xs font-semibold text-slate-300">
                        Không tìm thấy phim với từ khóa "{movieSearchQuery}"
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Thử tìm theo tên khác như 'Spider-Man', 'Dune', 'Mai', 'Godzilla'...
                      </p>
                    </div>
                  ) : (
                    movieSearchResults.map((m) => (
                      <div
                        key={m.id || m._id}
                        onClick={() => handleSelectMovie(m)}
                        className="p-3 hover:bg-[#141c2e] transition-colors cursor-pointer flex items-center space-x-3 group"
                      >
                        <div className="w-11 h-15 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
                          <img
                            src={m.posterUrl || m.poster || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop'}
                            alt={m.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="text-xs font-black text-white group-hover:text-blue-400 transition-colors truncate">
                              {m.title}
                            </span>
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {m.ageRating || 'T16'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {m.genre} • {m.duration} phút
                          </p>
                          <div className="flex items-center space-x-2 text-[10px]">
                            <span className="text-emerald-400 font-semibold">
                              ● {m.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đang chiếu'}
                            </span>
                            <span className="text-amber-400">⭐ 4.9</span>
                          </div>
                        </div>
                        <span className="text-slate-500 group-hover:text-blue-400 text-xs">➔</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-3.5 py-2 bg-[#090d16] border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
                  Nhấn vào phim để xem chi tiết & chọn suất chiếu
                </div>
              </div>
            )}
          </div>

          {/* Location selector với Modal chọn 63 Tỉnh Thành & Thanh Tìm Kiếm Nhanh */}
          <div className="relative" ref={locationRef}>
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(!isLocationModalOpen)}
              className="hidden sm:flex items-center space-x-1.5 bg-[#131926] hover:bg-[#1a2336] border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-300 transition-all cursor-pointer select-none"
              title="Chọn Tỉnh / Thành phố xem rạp"
            >
              <span className="text-red-400 text-xs">📍</span>
              <span className="font-semibold text-[11px] text-white max-w-[125px] truncate">
                {selectedCity}
              </span>
              <span className="text-slate-500 text-[9px]">▼</span>
            </button>

            {/* Modal / Dropdown chọn Tỉnh Thành */}
            {isLocationModalOpen && (
              <div className="absolute right-0 sm:left-auto sm:right-0 mt-2 w-[340px] sm:w-[480px] bg-[#0c1220] border border-slate-800 rounded-3xl shadow-2xl p-4 sm:p-5 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center space-x-2">
                    <span className="text-base text-red-400">📍</span>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Chọn Tỉnh / Thành Phố Xem Rạp
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Chọn khu vực để hiển thị cụm rạp D'AVENOR CINEMA và lịch chiếu gần bạn nhất
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(false)}
                    className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Thanh tìm kiếm nhanh tỉnh thành */}
                <div className="pt-3 pb-2.5">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                      🔍
                    </span>
                    <input
                      type="text"
                      autoFocus
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      placeholder="Tìm nhanh tỉnh, thành phố (VD: Hà Nội, Đà Nẵng, Cần Thơ...)"
                      className="w-full bg-[#12192a] border border-slate-700/80 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    {locationSearch && (
                      <button
                        type="button"
                        onClick={() => setLocationSearch('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Khu vực phổ biến (Pills bấm nhanh) */}
                {!locationSearch && (
                  <div className="pb-3 border-b border-slate-800/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Khu vực nổi bật:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_CITIES.map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => handleSelectCity(city)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${selectedCity === city
                            ? 'bg-[#2563eb] text-white font-bold shadow-md shadow-blue-600/30'
                            : 'bg-[#141b2c] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                            }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Danh sách toàn bộ 63 Tỉnh Thành */}
                <div className="pt-3">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    <span>Toàn bộ 63 tỉnh thành ({filteredProvinces.length})</span>
                    <span className="text-emerald-400 font-medium">● Có rạp D'AVENOR</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                    {filteredProvinces.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500">
                        Không tìm thấy tỉnh thành nào khớp với "{locationSearch}"
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {filteredProvinces.map((city) => {
                          const isSelected = selectedCity === city;
                          const hasCinema = CITIES_WITH_CINEMAS.includes(city);

                          return (
                            <button
                              key={city}
                              type="button"
                              onClick={() => handleSelectCity(city)}
                              className={`p-2 rounded-xl text-left text-xs transition-all flex items-center justify-between group cursor-pointer ${isSelected
                                ? 'bg-blue-600/20 border border-blue-500 text-blue-300 font-bold'
                                : 'bg-[#12192a]/80 hover:bg-[#182238] border border-slate-800/80 text-slate-300 hover:text-white'
                                }`}
                            >
                              <span className="truncate pr-1">{city}</span>
                              <div className="flex items-center space-x-1 shrink-0">
                                {hasCinema && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                                    title="Có rạp D'AVENOR CINEMA đang hoạt động"
                                  />
                                )}
                                {isSelected && (
                                  <span className="text-blue-400 text-[10px] font-bold">✓</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer chỉ dẫn chuyển đến trang Rạp chiếu */}
                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    Đang chọn: <strong className="text-white">{selectedCity}</strong>
                  </span>
                  <Link
                    to="/theaters"
                    onClick={() => setIsLocationModalOpen(false)}
                    className="text-blue-400 hover:text-blue-300 font-bold hover:underline flex items-center space-x-1"
                  >
                    <span>Xem rạp & suất chiếu</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Nút tắt chuyển nhanh sang trang Admin nếu là tài khoản Quản trị */}
          {currentUser?.role === 'ADMIN' && (
            <Link
              to="/admin/dashboard"
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-black shadow-md shadow-red-600/30 border border-red-400/40 transition-all hover:scale-105 shrink-0 cursor-pointer"
              title="Vào Bảng điều khiển Quản trị viên Admin"
            >
              <span>🛡️</span>
              <span>Trang Admin</span>
            </Link>
          )}

          {/* Người dùng đã đăng nhập HOẶC Nút Đăng nhập / Đăng ký */}
          {currentUser ? (
            <div className="relative" ref={dropdownRef}>
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2.5 bg-[#121929] hover:bg-slate-800 border border-slate-700/80 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all hover:border-slate-600 shadow-sm"
              >
                {/* Avatar cá nhân HOẶC Icon hình con người chuẩn */}
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600/80 flex items-center justify-center shrink-0 shadow-inner">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name || 'User Avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold text-white block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-amber-400 font-semibold block leading-none">
                    {currentUser.role === 'ADMIN' ? '🛡️ BAN QUẢN TRỊ' : (currentUser.tier === 'GOLD_TIER' ? '⭐ GOLD TIER' : 'Hội viên')} • {currentUser.points || (currentUser.role === 'ADMIN' ? 'Admin' : 100)}
                  </span>
                </div>
                <span className="text-slate-500 text-[9px]">▼</span>
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#0f1422] border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 space-y-1">
                  <div className="px-4 py-3 border-b border-slate-800/80 flex items-center space-x-3">
                    {/* Bấm vào avatar để đổi ảnh đại diện */}
                    <div
                      onClick={handleOpenAvatarModal}
                      title="Bấm để đổi ảnh đại diện"
                      className="relative group w-11 h-11 rounded-full overflow-hidden bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-slate-600 hover:border-blue-400 flex items-center justify-center shrink-0 cursor-pointer shadow-md transition-all hover:scale-105"
                    >
                      {currentUser.avatar ? (
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                        📷 Đổi
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">TÀI KHOẢN D'AVENOR</span>
                        <button
                          type="button"
                          onClick={handleOpenAvatarModal}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
                        >
                          Đổi ảnh
                        </button>
                      </div>
                      <strong className="text-xs text-white block truncate">{currentUser.name}</strong>
                      <span className="text-[11px] text-slate-400 block truncate">{currentUser.email}</span>
                    </div>
                  </div>

                  <Link
                    to="/my-tickets"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                  >
                    <span>🎟️</span>
                    <span>Vé của tôi & Lịch sử</span>
                  </Link>

                  <Link
                    to="/promotions"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                  >
                    <span>🎁</span>
                    <span>Kho Voucher đổi thưởng</span>
                  </Link>

                  {/* Nút Đổi ảnh đại diện */}
                  <button
                    type="button"
                    onClick={handleOpenAvatarModal}
                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors font-medium cursor-pointer"
                  >
                    <span>🖼️</span>
                    <span>Đổi ảnh đại diện</span>
                  </button>

                  {currentUser.role === 'ADMIN' && (
                    <Link
                      to="/admin/dashboard"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center justify-between px-3.5 py-2.5 mx-2 my-1.5 text-xs text-amber-200 hover:text-white bg-gradient-to-r from-red-600/30 via-amber-600/25 to-red-600/30 hover:from-red-600/50 hover:to-amber-600/50 border border-amber-500/40 rounded-xl transition-all font-black shadow-md shadow-amber-500/10 cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-base">🪪</span>
                        <span>Vào Trang Quản Trị Admin</span>
                      </div>
                      <span className="text-amber-400 text-xs">➔</span>
                    </Link>
                  )}

                  <div className="border-t border-slate-800/80 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left flex items-center space-x-2 px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      <span>🚪</span>
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                state={{ from: location.pathname !== '/login' && location.pathname !== '/register' ? location.pathname + location.search : '/' }}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center space-x-1.5"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                <span>Đăng nhập</span>
              </Link>

              <Link
                to="/register"
                state={{ from: location.pathname !== '/login' && location.pathname !== '/register' ? location.pathname + location.search : '/' }}
                className="hidden sm:inline-flex bg-[#121929] hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-800 transition-colors"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* MODAL THAY ĐỔI ẢNH ĐẠI DIỆN */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-[#0e1424] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <span className="text-xl">🖼️</span>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Đổi Ảnh Đại Diện
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cá nhân hóa tài khoản D'AVENOR CINEMA của bạn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Xem trước Avatar hiện tại / mới */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#141b2e] p-4 rounded-2xl border border-slate-800/80">
              <div className="relative group w-20 h-20 rounded-full overflow-hidden bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-blue-500 shadow-lg shadow-blue-500/20 shrink-0 flex items-center justify-center">
                {selectedAvatarUrl ? (
                  <img
                    src={selectedAvatarUrl}
                    alt="Preview Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left space-y-1">
                <span className="text-xs font-bold text-white block">
                  {currentUser?.name}
                </span>
                <p className="text-[11px] text-slate-400">
                  {selectedAvatarUrl
                    ? 'Đang xem trước ảnh bạn vừa chọn. Hãy bấm "Lưu Thay Đổi" để cập nhật.'
                    : 'Đang dùng hình đại diện mặc định (icon con người).'}
                </p>
                {selectedAvatarUrl && (
                  <button
                    type="button"
                    onClick={handleResetToDefaultAvatar}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline inline-flex items-center space-x-1 cursor-pointer pt-0.5"
                  >
                    <span>↺ Gỡ ảnh (Về icon con người mặc định)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Thông báo phản hồi */}
            {avatarMessage.text && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${avatarMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : avatarMessage.type === 'info'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
              >
                <span>
                  {avatarMessage.type === 'success' ? '✓' : avatarMessage.type === 'info' ? 'ℹ️' : '⚠️'}
                </span>
                <span>{avatarMessage.text}</span>
              </div>
            )}

            {/* Tùy chọn nguồn ảnh */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAvatarActiveTab('presets')}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${avatarActiveTab === 'presets'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                  🎬 Kho Phim Hot ({PRESET_AVATARS.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAvatarActiveTab('upload')}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${avatarActiveTab === 'upload'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                  📁 Tải từ máy tính
                </button>

                <button
                  type="button"
                  onClick={() => setAvatarActiveTab('url')}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${avatarActiveTab === 'url'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                  🔗 Dán link ảnh
                </button>
              </div>

              {/* Tab 1: Kho nhân vật phim */}
              {avatarActiveTab === 'presets' && (
                <div className="space-y-2">
                  <span className="text-[11px] text-slate-400 block">
                    Bấm vào nhân vật điện ảnh bạn muốn làm hình đại diện:
                  </span>
                  <div className="grid grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {PRESET_AVATARS.map((item) => {
                      const isSelected = selectedAvatarUrl === item.url;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedAvatarUrl(item.url);
                            setAvatarMessage({
                              type: 'info',
                              text: `Đã chọn "${item.name}". Bấm "Lưu Thay Đổi" để cập nhật.`,
                            });
                          }}
                          className={`relative rounded-2xl overflow-hidden p-1.5 flex flex-col items-center cursor-pointer transition-all border ${isSelected
                            ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-500/20'
                            : 'bg-[#121929] border-slate-800 hover:border-slate-700 hover:bg-[#182238]'
                            }`}
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden mb-1 border border-slate-700">
                            <img
                              src={item.url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-[10px] font-bold text-white text-center truncate w-full">
                            {item.name}
                          </span>
                          <span className="text-[9px] text-blue-400 font-semibold">
                            {item.tag}
                          </span>
                          {isSelected && (
                            <span className="absolute top-1 right-1 bg-blue-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Tải file từ máy tính */}
              {avatarActiveTab === 'upload' && (
                <div className="space-y-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-[#121929] hover:bg-[#152035] rounded-2xl p-6 text-center cursor-pointer transition-colors space-y-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto text-xl">
                      📤
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        Bấm để chọn tệp ảnh từ máy tính
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Hỗ trợ PNG, JPG, JPEG, WEBP (Tối đa 5MB)
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer pointer-events-none"
                    >
                      Duyệt file ảnh
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: Nhập link ảnh trực tiếp */}
              {avatarActiveTab === 'url' && (
                <div className="space-y-3">
                  <span className="text-[11px] text-slate-400 block">
                    Dán đường dẫn URL trực tiếp của hình ảnh (từ Google, Imgur, Unsplash...):
                  </span>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={customAvatarInput}
                      onChange={(e) => setCustomAvatarInput(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="flex-1 bg-[#121929] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!customAvatarInput.trim()) {
                          setAvatarMessage({ type: 'error', text: 'Vui lòng dán liên kết ảnh trước khi bấm Xem thử!' });
                          return;
                        }
                        setSelectedAvatarUrl(customAvatarInput.trim());
                        setAvatarMessage({
                          type: 'success',
                          text: 'Đã tải bản xem trước từ liên kết. Bấm "Lưu Thay Đổi" để cập nhật!',
                        });
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 cursor-pointer transition-colors"
                    >
                      Xem thử
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                disabled={isUpdatingAvatar}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleSaveAvatar}
                disabled={isUpdatingAvatar}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {isUpdatingAvatar ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Lưu Thay Đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
