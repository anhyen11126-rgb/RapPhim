import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Huy hiệu vị trí cố định của hệ thống D'AVENOR CINEMA
 * Cố định tại Cụm rạp Flagship Quận Thanh Khê, TP. Đà Nẵng
 */
const NavLocationModal = () => {
  return (
    <Link
      to="/theaters"
      className="hidden sm:flex items-center space-x-1.5 bg-[#131926]/90 hover:bg-[#1a2336] border border-slate-800/90 hover:border-slate-700 px-3 py-1.5 rounded-xl text-xs transition-all shadow-sm select-none group"
      title="Cụm rạp D'AVENOR Thanh Khê Plaza (Bấm để xem lịch chiếu & thông tin rạp)"
    >
      <span className="text-red-400 text-xs group-hover:scale-110 transition-transform">📍</span>
      <span className="font-semibold text-[11px] text-slate-200 group-hover:text-white transition-colors">
        Đà Nẵng - Q. Thanh Khê
      </span>
    </Link>
  );
};

export default NavLocationModal;
