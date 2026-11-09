import React from 'react';
import { NavLink, Link } from 'react-router-dom';

const SidebarAdmin = () => {
  const navItems = [
    { to: '/admin/dashboard', label: 'Bảng thống kê', icon: '📊' },
    { to: '/admin/movies', label: 'Quản lý phim', icon: '🎬' },
    { to: '/admin/cinemas', label: 'Quản lý cụm rạp', icon: '🏢' },
    { to: '/admin/rooms', label: 'Quản lý phòng chiếu', icon: '📽️' },
    { to: '/admin/showtimes', label: 'Quản lý suất chiếu', icon: '🕒' },
    { to: '/admin/bookings', label: 'Quản lý đặt vé', icon: '🎟️' },
    { to: '/admin/users', label: 'Quản lý thành viên', icon: '👥' },
    { to: '/admin/concessions', label: 'Bắp nước & Combo', icon: '🍿' },
    { to: '/admin/promotions', label: 'Khuyến mãi & Voucher', icon: '🏷️' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col border-r border-slate-800 shrink-0">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 font-black text-sm">
            D
          </div>
          <span className="text-base font-black text-white tracking-wider">D'AVENOR ADMIN</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1.5 tracking-wider">
          Chức năng quản trị
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-bold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Nút thoát về Client */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <Link
          to="/"
          className="flex items-center justify-center space-x-2 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all"
        >
          <span>🌐</span>
          <span>Xem trang khách hàng</span>
        </Link>
      </div>
    </aside>
  );
};

export default SidebarAdmin;

