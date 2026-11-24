import React from 'react';
import { useNavigate } from 'react-router-dom';

const TopbarAdmin = () => {
  const navigate = useNavigate();

  const admin = (() => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser') || localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('adminUser');
    window.dispatchEvent(new Event('authChange'));
    navigate('/login');
  };

  return (
    <header className="h-16 bg-[var(--bg-secondary)] border-b border-[var(--border-default)] px-4 sm:px-6 flex items-center justify-between text-white">
      <div className="flex items-center space-x-3">
        <span className="text-xs font-black uppercase tracking-wider text-[var(--lavender)] bg-violet-500/10 border border-violet-500/25 px-2.5 py-1 rounded-lg">
          Quản trị
        </span>
        <span className="text-xs text-slate-400 hidden sm:inline font-medium">
          D'AVENOR CINEMA Management
        </span>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Thông tin Admin */}
        <div className="flex items-center space-x-2.5 pl-2 border-l border-[var(--border-default)]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center text-xs font-black text-white shadow">
            {admin.name ? admin.name[0] : 'A'}
          </div>
          <div className="text-left hidden md:block">
            <span className="text-xs font-bold text-white block leading-tight">{admin.name || 'Ban Quản Trị'}</span>
            <span className="text-[10px] text-red-400 font-semibold block leading-none">Admin</span>
          </div>
        </div>

        {/* Nút đăng xuất đồng bộ */}
        <button
          onClick={handleLogout}
          className="text-xs bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
};

export default TopbarAdmin;
