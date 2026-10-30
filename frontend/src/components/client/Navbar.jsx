
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  return (
    <header className="bg-[#0b0f19] border-b border-slate-800/80 sticky top-0 z-50 transition-all">
      <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 h-16 flex items-center justify-between gap-4">
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
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <Link
              to="/"
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${location.pathname === '/'
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
            >
              Phim
            </Link>
            <a
              href="#theaters"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              Rạp chiếu
            </a>
            <a
              href="#promotions"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              Khuyến mãi
            </a>
            <a
              href="#support"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              Hỗ trợ
            </a>
          </nav>
        </div>

        {/* Right: Search, Admin & Profile */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="relative hidden md:block w-56 lg:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Tìm kiếm phim, rạp, đạo diễn..."
              className="w-full bg-[#131926] border border-slate-800 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <Link
            to="/admin/login"
            className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white bg-[#131926] hover:bg-slate-800 border border-slate-800 px-2.5 py-1.5 rounded-md transition-colors"
          >
            <span>🪪</span>
            <span className="font-semibold text-[11px]">Admin</span>
          </Link>

          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-full transition-colors relative"
            title="Thông báo"
          >
            <span className="text-sm">🔔</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
          </button>

          <div className="w-7 h-7 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] flex items-center justify-center text-xs font-bold text-white shadow-sm cursor-pointer transition-colors">
            👤
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
