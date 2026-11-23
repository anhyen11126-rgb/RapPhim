import React from 'react';

/**
 * Logo D'AVENOR CINEMA: Vương miện tím hoàng gia & Chữ D'AVENOR CINEMA xanh neon Holographic
 * Chuẩn nhận diện thương hiệu sang trọng, không có viền khung / hộp bao quanh.
 */
const CinemaLogo = ({
  className = 'h-10 sm:h-11 w-auto',
  showText = false,
  textClassName = 'text-sm font-bold text-white tracking-wider',
  subText = '',
}) => {
  return (
    <div className="flex items-center space-x-2 select-none group">
      <img
        src="/Logo.png"
        alt="D'AVENOR CINEMA"
        className={`${className} object-contain drop-shadow-[0_2px_14px_rgba(66,223,255,0.4)] group-hover:scale-105 transition-transform duration-300 block`}
      />
      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <span className={textClassName}>D'AVENOR</span>
          {subText && (
            <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
              {subText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default CinemaLogo;
