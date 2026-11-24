import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';

const SidebarAdmin = () => {
  const location = useLocation();

  const navItems = [
    {
      to: '/admin/statistics',
      label: 'Thống kê doanh thu',
      icon: '📊',
      badge: 'V2.0',
      isActiveExtra: location.pathname === '/admin' || location.pathname.startsWith('/admin/statistics'),
    },
    {
      to: '/admin/movies',
      label: 'Quản lý Phim',
      icon: '🎬',
      isActiveExtra: location.pathname.startsWith('/admin/movies'),
    },
    {
      to: '/admin/rooms',
      label: 'Quản lý Ghế & Phòng',
      icon: '💺',
      isActiveExtra: location.pathname.startsWith('/admin/rooms') || location.pathname.startsWith('/admin/seats'),
    },
    {
      to: '/admin/chatbot',
      label: 'Trợ lý ảo Chatbot AI',
      icon: '🤖',
      isActiveExtra: location.pathname.startsWith('/admin/chatbot'),
    },
  ];

  return (
    <aside className="w-64 bg-[var(--bg-secondary)] text-slate-300 h-screen sticky top-0 self-start flex flex-col border-r border-[var(--border-default)] shrink-0 z-20 select-none">
      {/* Brand Header: Logo Vương Miện & D'AVENOR CINEMA (Không có khung) */}
      <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-[var(--border-default)] bg-slate-950/70">
        <Link to="/admin/statistics" className="flex items-center space-x-2 group py-1" title="D'AVENOR CINEMA">
          <img
            src="/Logo.png"
            alt="D'AVENOR CINEMA"
            className="h-10 w-auto object-contain drop-shadow-[0_2px_12px_rgba(66,223,255,0.35)] group-hover:scale-105 transition-transform duration-300 block"
          />
          <div className="border-l border-[var(--border-default)]/80 pl-2">
            <span className="text-[10px] font-black tracking-wider text-amber-400/90 uppercase block leading-none">ADMIN</span>
            <span className="text-[9px] text-slate-500 font-semibold tracking-wider block mt-0.5">PANEL V2.0</span>
          </div>
        </Link>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Online
        </span>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
        <div className="text-[10px] font-extrabold text-slate-400 px-3 tracking-wider uppercase mb-2">
          DANH MỤC QUẢN TRỊ
        </div>
        {navItems.map((item) => {
          const isMatch = item.isActiveExtra || location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => {
                const active = isActive || isMatch;
                return `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  active
                    ? 'cinema-action text-white font-bold shadow-md shadow-violet-700/30'
                    : 'text-slate-400 hover:text-white hover:bg-[var(--bg-surface)]/80'
                }`;
              }}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <span className="text-base shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-violet-500/25 text-violet-200 border border-violet-400/40">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Nav Link */}
      <div className="p-3 shrink-0 border-t border-[var(--border-default)] bg-slate-950/50">
        <Link
          to="/"
          className="flex items-center justify-center space-x-2 w-full py-2 bg-[var(--bg-surface)]/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700/60"
        >
          <span>🌐</span>
          <span>Xem trang khách hàng</span>
        </Link>
      </div>
    </aside>
  );
};

export default SidebarAdmin;
