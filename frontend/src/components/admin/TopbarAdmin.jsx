import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const TopbarAdmin = () => {
  const navigate = useNavigate();

  const admin = (() => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || localStorage.getItem('user') || '{}');
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
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between text-white">
      <div className="flex items-center space-x-3">
        <span className="text-xs font-black uppercase tracking-wider text-red-500 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
          🛡️ Control Panel
        </span>
        <span className="text-xs text-slate-400 hidden sm:inline font-medium">
          D'AVENOR CINEMA Management
        </span>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Nút chuyển đổi nhanh: Xem trang khách hàng */}
        <Link
          to="/"
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 hover:border-blue-500/50 shadow-sm"
          title="Mở giao diện khách hàng xem phim & đặt vé"
        >
          <span>🌐</span>
          <span className="hidden sm:inline">Xem trang khách hàng</span>
        </Link>

        {/* Thông tin Admin */}
        <div className="flex items-center space-x-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center text-xs font-black text-white shadow">
            {admin.name ? admin.name[0] : 'A'}
          </div>
          <div className="text-left hidden md:block">
            <span className="text-xs font-bold text-white block leading-tight">{admin.name || 'Ban Quản Trị'}</span>
            <span className="text-[10px] text-red-400 font-semibold block leading-none">Super Admin</span>
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
