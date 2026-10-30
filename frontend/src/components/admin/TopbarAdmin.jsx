import React from 'react';
import { useNavigate } from 'react-router-dom';

const TopbarAdmin = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/admin/login');
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white">
      <div className="text-sm text-slate-400">
        Hệ thống quản trị rạp chiếu phim
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium">Xin chào, Admin</span>
        <button
          onClick={handleLogout}
          className="text-xs bg-slate-800 hover:bg-red-600 px-3 py-1.5 rounded transition-colors text-slate-300 hover:text-white"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
};

export default TopbarAdmin;

