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
        {/* Cụm Trái: Brand Logo & Navigation */}
        <div className="flex items-center space-x-5 lg:space-x-7">
          <Link
            to="/"
            className="group flex items-center space-x-3 transition-all duration-300"
            title="D'AVENOR CINEMA"
          >
            <div className="h-9 sm:h-10 w-[86px] sm:w-[96px] rounded-xl overflow-hidden border border-slate-700/80 group-hover:border-blue-400 group-hover:shadow-[0_0_18px_rgba(59,130,246,0.65),0_0_35px_rgba(37,99,235,0.3)] group-hover:ring-1 group-hover:ring-blue-400/50 transition-all duration-300 shrink-0">
              <img
                src="/Logo.png"
                alt="D'AVENOR CINEMA Logo"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 block"
              />
            </div>
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

        {/* Cụm Phải: Search, Đà Nẵng Location, Admin Shortcut, User Auth & Profile */}
        <div className="flex items-center space-x-3">
          {/* 1. Thanh tìm kiếm phim trực tiếp Database */}
          <NavSearchBar />

          {/* 2. Modal chọn cụm rạp tại Đà Nẵng */}
          <NavLocationModal
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
          />

          {/* 3. Nút tắt nhanh vào Admin nếu là Quản trị viên */}
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

          {/* 4. Menu tài khoản người dùng & Đăng nhập / Đăng ký */}
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
