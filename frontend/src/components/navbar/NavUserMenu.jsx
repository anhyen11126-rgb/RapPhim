import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// Chuẩn hóa và phân cấp thứ hạng thành viên rõ ràng:
// 1. Dưới 500 điểm: 🎫 THÀNH VIÊN (Mới đăng ký)
// 2. Từ 500 - 999 điểm: 🥈 THÀNH VIÊN BẠC
// 3. Từ 1000 - 1999 điểm: ⭐ THÀNH VIÊN VÀNG
// 4. Từ 2000 điểm trở lên: 💎 THÀNH VIÊN KIM CƯƠNG
const getTierInfo = (user) => {
  if (!user) return { label: 'Khách', color: 'text-slate-400' };
  if (user.role === 'ADMIN') return { label: '🛡️ BAN QUẢN TRỊ', color: 'text-red-400' };

  const points = Number(user.points) || 0;
  if (user.tier === 'DIAMOND' || points >= 2000) {
    return { label: '💎 THÀNH VIÊN KIM CƯƠNG', color: 'text-cyan-400' };
  }
  if ((user.tier === 'GOLD_TIER' && points >= 1000) || points >= 1000) {
    return { label: '⭐ THÀNH VIÊN VÀNG', color: 'text-amber-400' };
  }
  if (user.tier === 'SILVER_TIER' || (points >= 500 && points < 1000)) {
    return { label: '🥈 THÀNH VIÊN BẠC', color: 'text-slate-200' };
  }
  return { label: '🎫 THÀNH VIÊN', color: 'text-blue-400' };
};

const NavUserMenu = ({ currentUser, setCurrentUser, onOpenAvatarModal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const timeoutRef = useRef(null);

  const tierInfo = getTierInfo(currentUser);
  const isAdmin = currentUser?.role === 'ADMIN';

  // Hiệu ứng rê chuột (Hover) mở dropdown mượt mà
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 150);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('adminUser');
    setCurrentUser(null);
    setIsDropdownOpen(false);
    window.dispatchEvent(new Event('authChange'));
    navigate('/');
  };

  if (!currentUser) {
    return (
      <div className="flex items-center space-x-2">
        <Link
          to="/login"
          state={{
            from:
              location.pathname !== '/login' && location.pathname !== '/register'
                ? location.pathname + location.search
                : '/',
          }}
          className="bg-gradient-to-r from-[#F9B8FF] via-[#D99BFF] via-[#86DEFF] to-[#B4F7FF] text-[#0B1026] font-black text-xs px-4 py-2 rounded-xl shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)] hover:brightness-108 transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
          <span>Đăng nhập</span>
        </Link>

        <Link
          to="/register"
          state={{
            from:
              location.pathname !== '/login' && location.pathname !== '/register'
                ? location.pathname + location.search
                : '/',
          }}
          className="hidden sm:inline-flex bg-[#11152F] hover:bg-[#20204B] text-[#F8F7FF] hover:text-white font-semibold text-xs px-3.5 py-2 rounded-xl border border-[#AA9BFF]/30 hover:border-[#AA9BFF]/60 transition-colors"
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* NÚT KÍCH HOẠT: DÀNH CHO ADMIN - THIẾT KẾ DẠNG VIÊN THUỐC (👤 Trang Quản Lý ▼) */}
      {isAdmin ? (
        <div
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center bg-[#171936] hover:bg-[#20204B] border border-[#AA9BFF]/35 hover:border-[#72E8FF] rounded-full pl-1 pr-2.5 py-1 shadow-md transition-all cursor-pointer select-none"
          title="Bấm để mở menu quản trị"
        >
          {/* 1. Hình đại diện 👤 hiển thị bình thường trên navbar */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-gradient-to-tr from-[#20204B] to-[#11152F] border border-[#AA9BFF]/40 flex items-center justify-center shrink-0 shadow-inner">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name || 'Admin Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-4 h-4 text-[#42DFFF]" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>

          {/* 2. Chữ "Trang Quản Lý": Nhấn vào để mở menu bên dưới */}
          <span
            className="pl-2 pr-1.5 py-1 text-xs font-bold text-[#F8F7FF] hover:text-[#83F5FF] transition-colors cursor-pointer select-none whitespace-nowrap"
          >
            Trang Quản Lý
          </span>

          {/* 3. Mũi tên ▼ */}
          <span
            className="text-[#42DFFF] text-[10px] pl-1 pr-0.5 py-1 transition-colors select-none"
          >
            ▼
          </span>
        </div>
      ) : (
        /* GIAO DIỆN KHÁCH HÀNG THƯỜNG */
        <div
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 bg-[#171936] hover:bg-[#20204B] border border-[#AA9BFF]/35 hover:border-[#72E8FF] pl-1 pr-2.5 py-1 rounded-full cursor-pointer transition-all shadow-sm"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-gradient-to-tr from-[#20204B] to-[#11152F] border border-[#AA9BFF]/40 flex items-center justify-center shrink-0 shadow-inner">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name || 'User Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-4 h-4 text-[#42DFFF]" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <div className="text-left hidden sm:block">
            <span className="text-xs font-bold text-[#F8F7FF] block leading-tight">
              {currentUser.name}
            </span>
            <span className={`text-[10px] font-semibold block leading-none ${tierInfo.color}`}>
              {tierInfo.label} • {currentUser.points ?? 0} điểm
            </span>
          </div>
          <span className="text-[#BEC5E5] text-[9px]">▼</span>
        </div>
      )}

      {/* DROPDOWN MENU (Hỗ trợ cả Hover & Click mượt mà) */}
      {isDropdownOpen && (
        <div className="absolute right-0 top-full pt-1.5 w-64 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-[#11152F] border border-[#AA9BFF]/30 rounded-2xl shadow-[0_12px_36px_rgba(11,16,38,0.9),0_0_20px_rgba(168,85,247,0.2)] py-2 space-y-1">
            {/* Header Thông Tin Tài Khoản */}
            <div className="px-4 py-3 border-b border-[#AA9BFF]/20 flex items-center space-x-3">
              <div
                onClick={() => {
                  if (onOpenAvatarModal) {
                    setIsDropdownOpen(false);
                    onOpenAvatarModal();
                  }
                }}
                title="Bấm để đổi ảnh đại diện"
                className="relative group w-11 h-11 rounded-full overflow-hidden bg-gradient-to-tr from-[#20204B] to-[#11152F] border-2 border-[#AA9BFF]/40 hover:border-[#42DFFF] cursor-pointer hover:scale-105 transition-all flex items-center justify-center shrink-0 shadow-md"
              >
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-5 h-5 text-[#42DFFF]" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                  📷 Đổi
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-[#BEC5E5] block">
                  {isAdmin ? 'TÀI KHOẢN ADMIN' : "TÀI KHOẢN D'AVENOR"}
                </span>
                <strong className="text-xs text-[#F8F7FF] block truncate">{currentUser.name}</strong>
                <span className="text-[11px] text-[#929ABD] block truncate">{currentUser.email}</span>
                <span className={`text-[10px] font-bold block mt-0.5 ${tierInfo.color}`}>
                  {tierInfo.label} • {isAdmin ? 'Admin' : `${currentUser.points ?? 0} điểm`}
                </span>
              </div>
            </div>

            {/* NẾU LÀ ADMIN: TRANG QUẢN LÝ VÀ ĐĂNG XUẤT (ẢNH ĐẠI DIỆN ĐÃ ĐỔI ĐƯỢC Ở TRÊN) */}
            {isAdmin ? (
              <div className="py-1">
                <Link
                  to="/admin/statistics"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center space-x-2 px-4 py-2.5 text-xs text-[#BEC5E5] hover:text-[#F8F7FF] hover:bg-[#20204B] transition-colors font-medium cursor-pointer"
                >
                  <span>🛡️</span>
                  <span>Trang Quản Lý</span>
                </Link>

                <div className="pt-1 border-t border-[#AA9BFF]/20 mt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer font-semibold"
                  >
                    <span>🚪</span>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            ) : (
              /* NẾU LÀ KHÁCH HÀNG THƯỜNG */
              <>
                <Link
                  to="/my-tickets"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center space-x-2 px-4 py-2 text-xs text-[#BEC5E5] hover:text-[#F8F7FF] hover:bg-[#20204B] transition-colors"
                >
                  <span>🎟️</span>
                  <span>Vé của tôi & Lịch sử</span>
                </Link>

                <Link
                  to="/promotions"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center space-x-2 px-4 py-2 text-xs text-[#BEC5E5] hover:text-[#F8F7FF] hover:bg-[#20204B] transition-colors"
                >
                  <span>🎁</span>
                  <span>Kho Voucher đổi thưởng</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (onOpenAvatarModal) onOpenAvatarModal();
                  }}
                  className="w-full text-left flex items-center space-x-2 px-4 py-2 text-xs text-[#42DFFF] hover:text-[#83F5FF] hover:bg-cyan-500/10 transition-colors font-medium cursor-pointer"
                >
                  <span>🖼️</span>
                  <span>Đổi ảnh đại diện</span>
                </button>

                <div className="pt-1 border-t border-[#AA9BFF]/20">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left flex items-center space-x-2 px-4 py-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer font-semibold"
                  >
                    <span>🚪</span>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavUserMenu;
