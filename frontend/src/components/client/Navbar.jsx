import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NavSearchBar from '../navbar/NavSearchBar';
import NavLocationModal from '../navbar/NavLocationModal';
import NavUserMenu from '../navbar/NavUserMenu';
import NavAvatarModal from '../navbar/NavAvatarModal';

const Navbar = () => {
  const location = useLocation();

  // State người dùng hiện tại
  const [currentUser, setCurrentUser] = useState(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  // Vị trí mặc định là Đà Nẵng theo yêu cầu quy mô nhỏ
  const [selectedCity, setSelectedCity] = useState(
    () => localStorage.getItem('selectedCity') || 'Đà Nẵng'
  );

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
    };
  }, []);

  return (
    <header className="bg-[#0b0f19] border-b border-slate-800/80 sticky top-0 z-50 transition-all">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-10 h-16 flex items-center justify-between gap-4">
        {/* Cụm Trái: Brand Logo & Navigation (Không có viền khung) */}
        <div className="flex items-center space-x-5 lg:space-x-7">
          <Link
            to="/"
            className="group flex items-center transition-all duration-300 py-1"
            title="D'AVENOR CINEMA"
          >
            <img
              src="/Logo.png"
              alt="D'AVENOR CINEMA Logo"
              className="h-10 sm:h-11 w-auto object-contain drop-shadow-[0_2px_12px_rgba(212,175,55,0.35)] group-hover:scale-105 transition-transform duration-300 block"
            />
          </Link>

          {/* Menu Điều Hướng */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto scrollbar-none">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${
                location.pathname === '/'
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900 font-medium'
              }`}
            >
              Phim
            </Link>

            <Link
              to="/theaters"
              className={`px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${
                location.pathname === '/theaters'
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900 font-medium'
              }`}
            >
              Rạp chiếu
            </Link>

            <Link
              to="/promotions"
              className={`px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${
                location.pathname === '/promotions'
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900 font-medium'
              }`}
            >
              Ưu đãi
            </Link>

            <Link
              to="/support"
              className={`px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${
                location.pathname === '/support'
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900 font-medium'
              }`}
            >
              Hỗ trợ
            </Link>
          </nav>
        </div>

        {/* Cụm Phải: Search, Đà Nẵng Location, User Auth & Profile */}
        <div className="flex items-center space-x-3">
          {/* 1. Thanh tìm kiếm phim trực tiếp Database */}
          <NavSearchBar />

          {/* 2. Modal chọn cụm rạp tại Đà Nẵng */}
          <NavLocationModal
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
          />

          {/* 3. Menu tài khoản người dùng & Nút Admin thống nhất */}
          <NavUserMenu
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
          />
        </div>
      </div>

      {/* 5. Modal Đổi Ảnh Đại Diện */}
      <NavAvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />
    </header>
  );
};

export default Navbar;
