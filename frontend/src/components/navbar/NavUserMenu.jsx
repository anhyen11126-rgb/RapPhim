import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const NavUserMenu = ({ currentUser, setCurrentUser, onOpenAvatarModal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  if (!currentUser) {
    return (
      <div className="flex items-center space-x-2">
        <Link
          to="/login"
          state={{
            from:
              location.pathname !== '/login' && location.pathname !== '/register'
                ? location.pathname + location.search
                : '/',
          }}
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center space-x-1.5"
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
          <span>Đăng nhập</span>
        </Link>

        <Link
          to="/register"
          state={{
            from:
              location.pathname !== '/login' && location.pathname !== '/register'
                ? location.pathname + location.search
                : '/',
          }}
          className="hidden sm:inline-flex bg-[#121929] hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-800 transition-colors"
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Nút bấm Avatar cá nhân */}
      <div
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2.5 bg-[#121929] hover:bg-slate-800 border border-slate-700/80 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all hover:border-slate-600 shadow-sm"
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600/80 flex items-center justify-center shrink-0 shadow-inner">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name || 'User Avatar'}
              className="w-full h-full object-cover"
            />
          ) : (
            <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="text-left hidden sm:block">
          <span className="text-xs font-bold text-white block leading-tight">
            {currentUser.name}
          </span>
          <span className="text-[10px] text-amber-400 font-semibold block leading-none">
            {currentUser.role === 'ADMIN'
              ? '🛡️ BAN QUẢN TRỊ'
              : currentUser.tier === 'GOLD_TIER'
              ? '⭐ GOLD TIER'
              : 'Hội viên'}{' '}
            • {currentUser.points || (currentUser.role === 'ADMIN' ? 'Admin' : 100)}
          </span>
        </div>
        <span className="text-slate-500 text-[9px]">▼</span>
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#0f1422] border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-3 border-b border-slate-800/80 flex items-center space-x-3">
            <div
              onClick={() => {
                setIsDropdownOpen(false);
                onOpenAvatarModal();
              }}
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
                  <path
                    fillRule="evenodd"
                    d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                📷 Đổi
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  TÀI KHOẢN D'AVENOR
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenAvatarModal();
                  }}
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

          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen(false);
              onOpenAvatarModal();
            }}
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
              className="w-full text-left flex items-center space-x-2 px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <span>🚪</span>
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavUserMenu;

