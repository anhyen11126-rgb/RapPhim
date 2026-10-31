import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('adminUser');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch {
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('adminUser');
    setCurrentUser(null);
    setShowProfileMenu(false);
    navigate('/');
  };

  return (
    <header className="bg-[#0b0f19] border-b border-slate-800/80 sticky top-0 z-50 transition-all select-none">
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

            <a
              href="#pricing"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors whitespace-nowrap hidden md:inline-block"
            >
              Giá vé
            </a>

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

            <button
              onClick={() => {
                const chatTrigger = document.querySelector('[data-chat-toggle="true"]');
                if (chatTrigger) chatTrigger.click();
              }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-blue-400 hover:text-white hover:bg-blue-600/20 transition-colors flex items-center space-x-1 whitespace-nowrap"
            >
              <span>✨</span>
              <span>AI Assistant</span>
            </button>
          </nav>
        </div>

        {/* Right: Search, Location, Login/User Profile */}
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

          {/* Đăng nhập hoặc Menu Quản trị */}
          {currentUser ? (
            <div className="relative">
              <div
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 bg-[#141b2c] hover:bg-[#1a233a] border border-slate-700 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                  👤
                </div>
                <span className="text-xs font-bold text-white max-w-[100px] truncate">
                  {currentUser.name || 'Admin'}
                </span>
                <span className="text-slate-400 text-[9px]">▼</span>
              </div>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#0f1424] border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-semibold">Tài khoản:</span>
                    <span className="font-bold text-white truncate block">{currentUser.email}</span>
                  </div>
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <span>📊</span>
                    <span>Bảng điều khiển Admin</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center space-x-2 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-bold"
                  >
                    <span>🚪</span>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/admin/login"
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition-all"
            >
              Đăng nhập
            </Link>
          )}

          {/* Avatar Icon */}
          <Link
            to="/admin/login"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-xs text-slate-300 cursor-pointer transition-colors"
            title="Cổng Quản trị MovieTix"
          >
            👤
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
