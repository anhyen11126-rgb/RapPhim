import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

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

            <a
              href="#promotions"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors whitespace-nowrap hidden md:inline-block"
            >
              Ưu đãi
            </a>

            <a
              href="#news"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors whitespace-nowrap hidden lg:inline-block"
            >
              Tin tức
            </a>

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

        {/* Right: Search, Location, Login & Profile */}
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

          {/* Đăng nhập Admin / User */}
          <Link
            to="/admin/login"
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition-all"
          >
            Đăng nhập
          </Link>

          {/* Avatar Icon */}
          <div className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-xs text-slate-300 cursor-pointer transition-colors">
            👤
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
