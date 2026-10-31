import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // State người dùng hiện tại
  const [currentUser, setCurrentUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

    // Đóng dropdown khi click ra ngoài
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('authChange', loadUser);
      window.removeEventListener('storage', loadUser);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

          {/* Location selector */}
          <div className="hidden sm:flex items-center space-x-1.5 bg-[#131926] border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:border-slate-700 cursor-pointer transition-colors">
            <span className="text-red-400 text-xs">📍</span>
            <span className="font-semibold text-[11px] text-white">TP. Hồ Chí Minh</span>
            <span className="text-slate-500 text-[9px]">▼</span>
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
                    to="/booking-success"
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
