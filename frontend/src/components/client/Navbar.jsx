import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  VIETNAM_PROVINCES,
  POPULAR_CITIES,
  CITIES_WITH_CINEMAS,
  removeVietnameseTones,
} from '../../constants/provinces';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // State người dùng hiện tại
  const [currentUser, setCurrentUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // State vị trí tỉnh / thành phố
  const [selectedCity, setSelectedCity] = useState(
    () => localStorage.getItem('selectedCity') || 'TP. Hồ Chí Minh'
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const locationRef = useRef(null);

  const loadUser = () => {
    try {
      const stored = localStorage.getItem('user');
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

    // Đóng dropdown & modal vị trí khi click ra ngoài
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (locationRef.current && !locationRef.current.contains(event.target)) {
        setIsLocationModalOpen(false);
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setIsDropdownOpen(false);
    window.dispatchEvent(new Event('authChange'));
    navigate('/');
  };

  return (
    <header className="bg-[#0b0f19] border-b border-slate-800/80 sticky top-0 z-50 transition-all">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-10 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center space-x-6 lg:space-x-8">
          <Link to="/" className="flex items-center space-x-3">
            {/* Blue pill logo icon */}
            <div className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[11px] font-black px-2.5 py-1 rounded-md flex items-center space-x-1 shadow-sm transition-colors">
              <span className="text-[9px]">▶</span>
              <span>MovieTix</span>
            </div>
            {/* White Brand Text */}
            <span className="text-lg font-black tracking-tight text-white hidden sm:inline">
              MovieTix
            </span>
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
          {/* Search box */}
          <div className="relative hidden xl:block w-56">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Tìm phim, diễn viên, rạp..."
              className="w-full bg-[#131926] border border-slate-800 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
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
                        Chọn khu vực để hiển thị cụm rạp MovieTix và lịch chiếu gần bạn nhất
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
                    <span className="text-emerald-400 font-medium">● Có rạp MovieTix</span>
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
                                    title="Có rạp MovieTix đang hoạt động"
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

          {/* Người dùng đã đăng nhập HOẶC Nút Đăng nhập / Đăng ký */}
          {currentUser ? (
            <div className="relative" ref={dropdownRef}>
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2.5 bg-[#121929] hover:bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
              >
                <div className="w-6 h-6 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[10px] font-black uppercase">
                  {currentUser.name ? currentUser.name[0] : 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold text-white block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-amber-400 font-semibold block leading-none">
                    {currentUser.tier === 'GOLD_TIER' ? '⭐ GOLD TIER' : 'Hội viên'} • {currentUser.points || 100}p
                  </span>
                </div>
                <span className="text-slate-500 text-[9px]">▼</span>
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0f1422] border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 space-y-1">
                  <div className="px-4 py-2 border-b border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Tài khoản MovieTix</span>
                    <strong className="text-xs text-white block">{currentUser.name}</strong>
                    <span className="text-[11px] text-slate-400 block truncate">{currentUser.email}</span>
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

                  {currentUser.role === 'ADMIN' && (
                    <Link
                      to="/admin/dashboard"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center space-x-2 px-4 py-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-600/10 transition-colors font-bold"
                    >
                      <span>🪪</span>
                      <span>Trang Quản trị Admin</span>
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
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center space-x-1.5"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                <span>Đăng nhập</span>
              </Link>

              <Link
                to="/register"
                className="hidden sm:inline-flex bg-[#121929] hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-800 transition-colors"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
