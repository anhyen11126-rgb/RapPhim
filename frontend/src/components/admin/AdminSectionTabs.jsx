import { NavLink, useLocation } from 'react-router-dom';

const groups = [
  [['/admin/movies', 'Danh sách phim'], ['/admin/showtimes', 'Lịch chiếu'], ['/admin/pricing', 'Bảng giá']],
  [['/admin/bookings', 'Đơn đặt vé'], ['/admin/check-in', 'Soát vé QR'], ['/admin/users', 'Khách hàng']],
];

export default function AdminSectionTabs() {
  const { pathname } = useLocation();
  const items = groups.find(group => group.some(([path]) => path === pathname));
  if (!items) return null;

  return (
    <nav aria-label="Mục quản trị" className="flex flex-wrap gap-2 border-b border-[var(--border-default)] pb-3">
      {items.map(([path, label]) => (
        <NavLink key={path} to={path} end className={({ isActive }) =>
          `rounded-lg px-4 py-2 text-sm font-medium ${isActive ? 'bg-cyan-400/10 text-cyan-300' : 'text-slate-300 hover:bg-white/5'}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
