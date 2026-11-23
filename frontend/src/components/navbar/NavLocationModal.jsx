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
      className="hidden sm:flex items-center space-x-1.5 bg-[#171936] hover:bg-[#20204B] border border-[#AA9BFF]/35 hover:border-[#72E8FF] px-3.5 py-1.5 rounded-full text-xs transition-all shadow-sm select-none group"
      title="Cụm rạp D'AVENOR Thanh Khê Plaza (Bấm để xem lịch chiếu & thông tin rạp)"
    >
      <span className="text-[#42DFFF] text-xs group-hover:scale-110 transition-transform">📍</span>
      <span className="font-semibold text-[11px] text-[#BEC5E5] group-hover:text-[#F8F7FF] transition-colors">
        Đà Nẵng - Q. Thanh Khê
      </span>
    </Link>
  );
};

export default NavLocationModal;
