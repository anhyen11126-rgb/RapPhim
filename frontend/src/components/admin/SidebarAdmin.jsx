import { useState } from 'react';
import { Armchair, Bot, ChartNoAxesColumn, Clapperboard, Globe, PanelLeftClose, PanelLeftOpen, Ticket } from 'lucide-react';
import { NavLink, Link, useLocation } from 'react-router-dom';

const SidebarAdmin = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    {
      to: '/admin/statistics',
      label: 'Tổng quan',
      icon: ChartNoAxesColumn,
      isActiveExtra: location.pathname === '/admin' || location.pathname.startsWith('/admin/statistics'),
    },
    {
      to: '/admin/movies',
      label: 'Phim & Lịch chiếu',
      icon: Clapperboard,
      isActiveExtra: ['/admin/movies', '/admin/showtimes', '/admin/pricing'].includes(location.pathname),
    },
    {
      to: '/admin/rooms',
      label: 'Phòng & Ghế',
      icon: Armchair,
      isActiveExtra: location.pathname.startsWith('/admin/rooms') || location.pathname.startsWith('/admin/seats'),
    },
    {
      to: '/admin/bookings',
      label: 'Vé & Khách hàng',
      icon: Ticket,
      isActiveExtra: ['/admin/bookings', '/admin/check-in', '/admin/users', '/admin/concessions', '/admin/promotions'].includes(location.pathname),
    },
    {
      to: '/admin/chatbot',
      label: 'Trợ lý AI',
      icon: Bot,
      isActiveExtra: location.pathname.startsWith('/admin/chatbot'),
    },
  ];

  return (
    <aside className={`w-14 ${collapsed ? 'md:w-16' : 'md:w-60'} bg-[var(--bg-secondary)] text-slate-300 h-screen sticky top-0 self-start flex flex-col border-r border-[var(--border-default)] shrink-0 z-20 select-none`}>
      <div className="flex h-16 shrink-0 items-center justify-center gap-2 border-b border-[var(--border-default)] px-2">
        <Link to="/admin/statistics" aria-label="D'AVENOR CINEMA">
          <img src="/Logo.png" alt="D'AVENOR CINEMA" className="max-h-10 w-auto object-contain" />
        </Link>
        <button type="button" title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} aria-expanded={!collapsed}
          onClick={() => setCollapsed(value => !value)}
          className="hidden rounded-lg p-1.5 text-slate-300 hover:bg-white/10 md:block">
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-1.5 md:p-2 space-y-2 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isMatch = item.isActiveExtra || location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) => {
                const active = isActive || isMatch;
                return `flex items-center justify-center md:justify-start px-2 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  active
                    ? 'bg-cyan-400/10 text-cyan-200 ring-1 ring-inset ring-violet-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-[var(--bg-surface)]/80'
                }`;
              }}
            >
              <item.icon size={19} className="shrink-0" />
              {!collapsed && <span className="ml-2 hidden truncate md:inline">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Nav Link */}
      <div className="p-1.5 md:p-2 shrink-0 border-t border-[var(--border-default)] bg-slate-950/50">
        <Link
          to="/"
          aria-label="Trang khách hàng" title="Trang khách hàng"
          className="flex items-center justify-center space-x-2 w-full py-2 bg-[var(--bg-surface)]/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700/60"
        >
          <Globe size={18} />
          {!collapsed && <span className="hidden md:inline">Trang khách hàng</span>}
        </Link>
      </div>
    </aside>
  );
};

export default SidebarAdmin;
