import React from 'react';
import { NavLink } from 'react-router-dom';

const SidebarAdmin = () => {
  const navItems = [
    { to: '/admin/dashboard', label: 'Bảng thống kê', icon: '📊' },
    { to: '/admin/movies', label: 'Quản lý phim & suất chiếu', icon: '🎬' },
    { to: '/admin/bookings', label: 'Quản lý đặt vé', icon: '🎟️' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col border-r border-slate-800">
      <div className="h-16 flex items-center px-6 border-b border-slate-800 text-xl font-bold text-red-500">
        MOVIETIX ADMIN
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-red-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default SidebarAdmin;

