import React from 'react';

/**
 * ==============================================================================
 * THEATRICAL MOVIE INFO SIDEBAR COMPONENT
 * Hiển thị thẻ kính thông tin phim bên trái khớp với 3 ảnh tham khảo:
 * - IMAX Laser (Xanh Cyan - Blue - Violet)
 * - Dolby Atmos (Tím Violet - Lavender - Cyan)
 * - Gold Class (Vàng Champagne - Rose Gold - Pink)
 * ==============================================================================
 */
const MovieInfoSidebar = ({
  movie,
  showtime,
  roomType = 'IMAX', // 'IMAX' | 'ATMOS' | 'GOLD'
}) => {
  const isImax = roomType === 'IMAX';
  const isAtmos = roomType === 'ATMOS';
  const isGold = roomType === 'GOLD';

  // Hàm định dạng ngày chiếu tiếng Việt kèm thứ chính xác trong tuần
  const formatVietnameseDate = (rawDate) => {
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    if (!rawDate) {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      return `${dayNames[now.getDay()]}, ${d}/${m}/${now.getFullYear()}`;
    }

    // Nếu dạng YYYY-MM-DD
    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      const [y, m, d] = rawDate.split('T')[0].split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = dayNames[dateObj.getDay()];
      const dStr = String(d).padStart(2, '0');
      const mStr = String(m).padStart(2, '0');
      return `${dayName}, ${dStr}/${mStr}/${y}`;
    }

    // Nếu dạng DD/MM/YYYY
    if (typeof rawDate === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(rawDate)) {
      const [d, m, y] = rawDate.split('/').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = dayNames[dateObj.getDay()];
      const dStr = String(d).padStart(2, '0');
      const mStr = String(m).padStart(2, '0');
      return `${dayName}, ${dStr}/${mStr}/${y}`;
    }

    const dateObj = new Date(rawDate);
    if (!isNaN(dateObj.getTime())) {
      const dayName = dayNames[dateObj.getDay()];
      const dStr = String(dateObj.getDate()).padStart(2, '0');
      const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
      return `${dayName}, ${dStr}/${mStr}/${dateObj.getFullYear()}`;
    }

    return String(rawDate);
  };

  const rawDateValue = showtime?.date || showtime?.startTime;
  const displayFormattedDate = formatVietnameseDate(rawDateValue);
  const displayTime = showtime?.time || '19:30';
  const roomLabel =
    showtime?.roomName ||
    (isGold ? 'Phòng: Gold Class' : isAtmos ? 'Phòng: Dolby Atmos' : 'Phòng: IMAX Laser');

  // Format thời lượng
  const durationText = movie?.duration ? `${movie.duration} phút` : '166 phút';

  // Theme styling theo từng phòng
  const themeStyles = isGold
    ? {
        cardBorder:
          'border-[#FFD18A]/45 hover:border-[#FFD18A]/75 shadow-[0_0_35px_rgba(255,209,138,0.22),0_15px_40px_rgba(5,8,20,0.95)]',
        cardBg: 'bg-gradient-to-b from-[#0F1532]/95 via-[#0B0F26]/95 to-[#070A1D]/95',
        titleGlow: 'from-[#FFF4E8] via-[#FFD18A] to-[#E5A93C]',
        accentText: 'text-[#FFD18A]',
        bulletIconColor: 'text-[#FFD18A]',
        badgeBg:
          'bg-[#FFD18A]/20 text-[#FFD18A] border-[#FFD18A]/50 shadow-[0_0_10px_rgba(255,209,138,0.2)]',
        cornerGlow: 'from-[#FFD18A]/25 via-[#E5A93C]/15 to-transparent',
      }
    : isAtmos
    ? {
        cardBorder: 'border-[#7B2CFF]/45 hover:border-[#00D5FF]/60 shadow-[0_0_35px_rgba(123,44,255,0.25),0_15px_40px_rgba(16,6,37,0.9)]',
        cardBg: 'bg-gradient-to-b from-[#1A0C3D]/95 via-[#13072E]/95 to-[#0D0420]/95',
        titleGlow: 'from-[#F8F5FF] via-[#D8B4FF] to-[#00D5FF]',
        accentText: 'text-[#D8B4FF]',
        bulletIconColor: 'text-[#00D5FF]',
        badgeBg: 'bg-[#7B2CFF]/25 text-[#D8B4FF] border-[#7B2CFF]/50',
        cornerGlow: 'from-[#A44BFF]/25 via-[#00D5FF]/15 to-transparent',
      }
    : {
        cardBorder: 'border-[#00D9FF]/45 hover:border-[#00D9FF]/75 shadow-[0_0_35px_rgba(0,217,255,0.25),0_15px_40px_rgba(3,13,37,0.9)]',
        cardBg: 'bg-gradient-to-b from-[#071A42]/95 via-[#04112E]/95 to-[#020A1E]/95',
        titleGlow: 'from-[#FFFFFF] via-[#83F5FF] to-[#00D9FF]',
        accentText: 'text-[#00D9FF]',
        bulletIconColor: 'text-[#00D9FF]',
        badgeBg: 'bg-[#00D9FF]/20 text-[#83F5FF] border-[#00D9FF]/40',
        cornerGlow: 'from-[#E34BFF]/25 via-[#00D9FF]/20 to-transparent',
      };

  return (
    <aside
      className={`w-full lg:w-[290px] xl:w-[310px] shrink-0 rounded-2xl p-4 sm:p-5 border backdrop-blur-2xl transition-all relative overflow-hidden ${themeStyles.cardBg} ${themeStyles.cardBorder}`}
    >
      {/* Vệt sáng trang trí ở góc đáy sidebar */}
      <div
        className={`absolute -bottom-16 -left-16 w-52 h-52 bg-gradient-to-tr ${themeStyles.cornerGlow} rounded-full blur-3xl pointer-events-none`}
      ></div>

      {/* 1. KHU VỰC POSTER & TIÊU ĐỀ PHIM */}
      <div className="flex items-start space-x-3.5 pb-4 border-b border-white/10 relative z-10">
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-black text-white leading-snug line-clamp-2 tracking-wide">
            {movie?.title || '?'}
          </h2>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-md border shadow-sm ${themeStyles.badgeBg}`}
            >
              {movie?.ageRating || '13+'}
            </span>
            <span className="text-xs text-[#BEC5E5] font-semibold">
              {durationText}
            </span>
          </div>

          <p className="text-[11px] text-[#BEC5E5]/70 line-clamp-1 mt-1 font-medium">
            {movie?.genre || 'Khoa Học Viễn Tưởng, Hành Động'}
          </p>
        </div>
      </div>

      {/* 2. THÔNG TIN LỊCH CHIẾU (NGÀY, GIỜ, TÊN PHÒNG) */}
      <div className="py-4 space-y-2.5 border-b border-white/10 text-xs text-[#F5FAFF] relative z-10">
        <div className="flex items-center space-x-2.5">
          <span className={`${themeStyles.accentText} text-sm`}>📅</span>
          <span className="font-semibold text-slate-200">
            {displayFormattedDate}
          </span>
        </div>

        <div className="flex items-center space-x-2.5">
          <span className={`${themeStyles.accentText} text-sm`}>🕒</span>
          <span className="font-bold text-white text-sm tracking-wide">
            {displayTime}
          </span>
        </div>

        <div className="flex items-center space-x-2.5">
          <span className={`${themeStyles.accentText} text-sm`}>📍</span>
          <span className="font-bold text-white">
            {roomLabel}
          </span>
        </div>
      </div>

      {/* 3. ĐẶC TÍNH CÔNG NGHỆ RIÊNG CHO TỪNG PHÒNG */}
      <div className="pt-4 relative z-10">
        {/* Tiêu đề mục công nghệ */}
        <p className="text-[11px] font-bold tracking-wider uppercase text-slate-300/80 mb-2">
          {isGold ? 'Phòng chiếu cao cấp' : isAtmos ? 'Công nghệ phòng chiếu' : 'Thông tin phòng'}
        </p>

        {/* Logo định dạng phòng tương ứng */}
        {isImax && (
          <div className="mb-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#00D9FF]/15 border border-[#00D9FF]/40 shadow-[0_0_15px_rgba(0,217,255,0.3)]">
              <span className="text-base sm:text-lg font-black tracking-widest text-[#00D9FF]">
                IMAX®
              </span>
              <span className="text-[11px] font-black tracking-widest text-[#E34BFF] uppercase">
                LASER
              </span>
            </div>
          </div>
        )}

        {isAtmos && (
          <div className="mb-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#7B2CFF]/20 border border-[#7B2CFF]/50 shadow-[0_0_15px_rgba(123,44,255,0.3)]">
              <span className="text-base font-black tracking-tight text-[#00D5FF]">
                Dolby
              </span>
              <span className="text-base font-black tracking-tight text-[#D8B4FF]">
                Atmos®
              </span>
            </div>
          </div>
        )}

        {isGold && (
          <div className="mb-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#FFD18A]/15 border border-[#FFD18A]/45 shadow-[0_0_15px_rgba(255,209,138,0.25)]">
              <span className="text-sm">👑</span>
              <span className="text-sm font-black tracking-widest text-[#FFD18A]">
                GOLD CLASS
              </span>
            </div>
            <p className="text-[10px] text-amber-200/80 font-medium mt-1">
              Trải nghiệm điện ảnh đẳng cấp hoàng gia
            </p>
          </div>
        )}

        {/* Danh sách 4 đặc tính nổi bật */}
        <ul className="space-y-3 text-xs">
          {isImax && (
            <>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#00D9FF] text-base shrink-0">🖥️</span>
                <span className="font-medium">Màn hình IMAX cong siêu lớn</span>
              </li>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#00D9FF] text-base shrink-0">💎</span>
                <span className="font-medium">Độ phân giải 4K Laser sắc nét</span>
              </li>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#00D9FF] text-base shrink-0">🔊</span>
                <span className="font-medium">Âm thanh vòm sống động</span>
              </li>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#00D9FF] text-base shrink-0">🌐</span>
                <span className="font-medium">Không gian chuẩn điện ảnh quốc tế</span>
              </li>
            </>
          )}

          {isAtmos && (
            <>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#00D5FF] text-base shrink-0">🔄</span>
                <span className="font-medium">Âm thanh vòm 360° chuẩn Dolby Atmos</span>
              </li>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#00D5FF] text-base shrink-0">🔊</span>
                <span className="font-medium">Âm thanh đa chiều sống động</span>
              </li>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#00D5FF] text-base shrink-0">📶</span>
                <span className="font-medium">Không gian hiện đại đẳng cấp</span>
              </li>
            </>
          )}

          {isGold && (
            <>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#FFD18A] text-base shrink-0">🛋️</span>
                <span className="font-medium">Ghế da cao cấp ngả lưng thư giãn</span>
              </li>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#FFD18A] text-base shrink-0">💎</span>
                <span className="font-medium">Không gian riêng tư & sang trọng</span>
              </li>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#FFD18A] text-base shrink-0">🔊</span>
                <span className="font-medium">Âm thanh sống động chuẩn điện ảnh</span>
              </li>
              <li className="flex items-center space-x-2.5 text-slate-200">
                <span className="text-[#FFD18A] text-base shrink-0">🍽️</span>
                <span className="font-medium">Dịch vụ VIP đồ ăn & thức uống</span>
              </li>
            </>
          )}
        </ul>

        {/* Họa tiết minh họa góc dưới mô phỏng khán phòng */}
        <div className="mt-6 pt-4 border-t border-white/10 opacity-70">
          {isImax && (
            <div className="flex items-center justify-between text-[11px] text-[#00D9FF]">
              <span>Laser Phosphor 4K</span>
              <span>1.90:1 Aspect</span>
            </div>
          )}
          {isAtmos && (
            <div className="flex items-center justify-between text-[11px] text-[#00D5FF]">
              <span>64 Independent Audio Feeds</span>
              <span>360° Soundfield</span>
            </div>
          )}
          {isGold && (
            <div className="flex items-center justify-between text-[11px] text-[#FFD18A]">
              <span>Italian Leather Recliner</span>
              <span>Complimentary Welcome Drink</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default React.memo(MovieInfoSidebar);
