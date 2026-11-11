import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  calculateDynamicPrices,
  getRoomPriceRange,
  loadPricingConfig,
  DEFAULT_PRICING_CONFIG,
} from '../../utils/pricing';

const MovieShowtimesSection = ({
  movie,
  dateTabs,
  selectedDateIndex,
  onSelectDateIndex,
  selectedCity,
  filteredCinemas,
  selectedCinemaId,
  onSelectCinemaId,
  fallbackImaxTimes,
  fallbackStandardTimes,
  fallback3DTimes,
  currentActiveShowtime,
  onSelectSlot,
  getEndTime,
  selectedDate,
  displayCinema,
  onProceedToBooking,
}) => {
  const isWeekend = selectedDate?.fullDate
    ? (selectedDate.fullDate.getDay() === 0 || selectedDate.fullDate.getDay() === 5 || selectedDate.fullDate.getDay() === 6)
    : false;

  // Quản lý bộ lọc theo Quận / Huyện tại Đà Nẵng + Cấu hình giá động từ DB
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả');
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);

  useEffect(() => {
    loadPricingConfig().then((cfg) => {
      if (cfg) setPricingConfig(cfg);
    });
  }, []);

  // Lấy danh sách các Quận / Huyện có rạp tại Đà Nẵng
  const availableDistricts = useMemo(() => {
    const set = new Set();
    filteredCinemas.forEach((c) => {
      if (c.district) {
        set.add(c.district);
      } else if (c.address) {
        const match = c.address.match(/Q\.\s*([^,]+)|Quận\s*([^,]+)/i);
        if (match) set.add((match[1] || match[2]).trim());
      }
    });
    return ['Tất cả', ...Array.from(set)];
  }, [filteredCinemas]);

  // Lọc danh sách cụm rạp theo Quận đang chọn
  const displayedCinemas = useMemo(() => {
    if (!selectedDistrict || selectedDistrict === 'Tất cả') return filteredCinemas;
    return filteredCinemas.filter((c) => {
      const dist = (c.district || '').toLowerCase();
      const addr = (c.address || '').toLowerCase();
      const target = selectedDistrict.toLowerCase();
      return dist.includes(target) || addr.includes(target);
    });
  }, [filteredCinemas, selectedDistrict]);

  // Tự động chọn rạp đầu tiên khi đổi quận nếu rạp hiện tại không nằm trong quận đó
  useEffect(() => {
    if (displayedCinemas.length > 0) {
      const isCurrentInList = displayedCinemas.some((c) => (c._id || c.id) === selectedCinemaId);
      if (!isCurrentInList) {
        onSelectCinemaId(displayedCinemas[0]._id || displayedCinemas[0].id);
      }
    }
  }, [displayedCinemas, selectedCinemaId, onSelectCinemaId]);
  return (
    <section id="showtimes-section" className="relative z-20 max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-12 mt-12">
      <div className="bg-[#101625] border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        
        {/* Header Khu Vực Đặt Vé */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest block">
              LỊCH CHIẾU RẠP TOÀN QUỐC
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Chọn Ngày & Suất Chiếu
            </h2>
          </div>
          <div className="flex items-center space-x-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Cập nhật dữ liệu vé theo thời gian thực</span>
          </div>
        </div>

        {/* HÀNG CÁC TABS NGÀY CHIẾU (7 NGÀY) */}
        <div className="flex items-center space-x-3 overflow-x-auto pb-2 scrollbar-none">
          {dateTabs.map((d) => (
            <button
              key={d.index}
              type="button"
              onClick={() => onSelectDateIndex(d.index)}
              className={`shrink-0 px-5 py-3 rounded-2xl flex flex-col items-center justify-center min-w-[110px] transition-all cursor-pointer border ${
                selectedDateIndex === d.index
                  ? 'bg-[#2563eb] text-white border-blue-400 shadow-lg shadow-blue-600/30 scale-105'
                  : 'bg-[#151c2d] hover:bg-[#1a2339] text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  selectedDateIndex === d.index ? 'text-blue-200' : 'text-slate-500'
                }`}
              >
                {d.tag}
              </span>
              <span className="text-base sm:text-lg font-black mt-0.5">{d.dateStr}</span>
              <span className="text-[11px] font-medium opacity-80">{d.dayName}</span>
            </button>
          ))}
        </div>

        {/* HÀNG CHỌN CỤM RẠP (ĐỒNG BỘ 100% VỚI KHU VỰC TRÊN NAVBAR) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/60 pb-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-base text-red-400">📍</span>
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider">
                CỤM RẠP TẠI <span className="text-blue-400 font-extrabold">{selectedCity}</span>
              </label>
              <span className="text-[11px] font-semibold text-emerald-400 font-bold">
                • {displayedCinemas[0]?.name || "D'AVENOR Thanh Khê Plaza"} (Q. Thanh Khê)
              </span>
            </div>

            {/* Nút bấm xem thông tin chi tiết rạp */}
            <Link
              to="/theaters"
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-[#151c2d] hover:bg-[#1f2b45] border border-slate-700/80 hover:border-blue-500/50 transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Nhấn để xem thông tin chi tiết rạp"
            >
              <span>📍</span>
              <span>Thông tin cụm rạp</span>
              <span className="text-[10px] text-blue-400">↗</span>
            </Link>
          </div>

          {/* BỘ LỌC CHỌN QUẬN NẾU CÓ NHIỀU QUẬN */}
          {availableDistricts.length > 2 && (
            <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 scrollbar-none pt-0.5">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
                <span>🏘️</span>
                <span>Quận:</span>
              </span>
              {availableDistricts.map((dist) => {
                const isDistActive = selectedDistrict === dist;
                const countInDist =
                  dist === 'Tất cả'
                    ? filteredCinemas.length
                    : filteredCinemas.filter((c) =>
                        (c.district || c.address || '').toLowerCase().includes(dist.toLowerCase())
                      ).length;
                return (
                  <button
                    key={dist}
                    type="button"
                    onClick={() => setSelectedDistrict(dist)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                      isDistActive
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                        : 'bg-[#151c2d] text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{dist === 'Tất cả' ? 'Tất cả quận' : `Q. ${dist}`}</span>
                    <span className="ml-1 text-[10px] opacity-75">({countInDist})</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {displayedCinemas.length > 0 ? (
              displayedCinemas.map((c) => {
                const cId = c._id || c.id;
                const isSelected = selectedCinemaId === cId;
                return (
                  <button
                    key={cId}
                    type="button"
                    onClick={() => onSelectCinemaId(cId)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-2 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 text-white border-blue-500 shadow-md ring-2 ring-blue-500/40'
                        : 'bg-[#151c2d] hover:bg-[#1b243b] text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    <span>🏢</span>
                    <span>{c.name}</span>
                    {c.district && (
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({c.district})
                      </span>
                    )}
                    {c.isFlagship && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/40">
                        Flagship
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                Chưa có cụm rạp nào tại quận này. Vui lòng chọn quận khác!
              </p>
            )}
          </div>
        </div>

        {/* DANH SÁCH SUẤT CHIẾU THEO 3 ĐỊNH DẠNG PHÒNG CHIẾU */}
        <div className="space-y-6 pt-2">
          
          {/* NHÓM 1: PHÒNG CHIẾU IMAX LASER GRAND HALL */}
          <div className="bg-[#121827] border border-amber-500/20 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
              <div className="flex items-center space-x-3">
                <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[11px] px-2.5 py-1 rounded-md shadow-md tracking-wider">
                  IMAX LASER 2D
                </span>
                <h4 className="text-xs sm:text-sm font-black text-white">
                  Phòng chiếu IMAX Laser Grand Hall • Âm thanh 12 kênh độc quyền
                </h4>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400">Giá vé dao động:</span>
                <span className="text-amber-400 font-black text-sm">
                  {getRoomPriceRange('imax', isWeekend, pricingConfig).label}
                </span>
              </div>
            </div>

            {/* Các thẻ suất chiếu IMAX */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {fallbackImaxTimes.map((st) => {
                const isChosen = currentActiveShowtime?.id === st.id;
                const isUrgent = st.availableSeats > 0 && st.availableSeats <= 15;
                const endTime = getEndTime(st.time, movie.duration);
                const imaxPricing = calculateDynamicPrices(
                  {
                    ...st,
                    startTime: selectedDate?.fullDate,
                    roomName: 'Phòng IMAX 01',
                    format: 'IMAX Laser 2D',
                  },
                  pricingConfig
                );
                const slotPrice = imaxPricing.priceStandard;

                return (
                  <div
                    key={st.id}
                    onClick={() => onSelectSlot({ ...st, price: slotPrice }, 'IMAX Laser 2D', isChosen)}
                    onDoubleClick={() => onSelectSlot({ ...st, price: slotPrice }, 'IMAX Laser 2D', true)}
                    role="button"
                    tabIndex={0}
                    title="Nhấn để chọn suất chiếu, nhấn đúp để vào thẳng chọn ghế"
                    className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 select-none group ${
                      isChosen
                        ? 'bg-gradient-to-br from-blue-600/25 via-indigo-950/40 to-[#0e1628] border-blue-400 ring-2 ring-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.35)] scale-[1.02]'
                        : 'bg-[#151c2d] hover:bg-[#1a2339] border-slate-700/60 hover:border-blue-400/60 hover:shadow-lg'
                    }`}
                  >
                    {/* Hàng 1: Giờ chiếu + Giờ kết thúc + Huy hiệu */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-baseline space-x-1.5">
                          <span
                            className={`text-2xl font-black tracking-tight ${
                              isChosen ? 'text-white' : 'text-slate-100 group-hover:text-blue-300'
                            } transition-colors`}
                          >
                            {st.time}
                          </span>
                          {endTime && (
                            <span className="text-[11px] font-medium text-slate-400">{endTime}</span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold text-amber-400 mt-0.5">
                          {slotPrice.toLocaleString('vi-VN')} đ
                        </div>
                      </div>

                      {/* Huy hiệu góc phải */}
                      {isChosen ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500 text-white shadow-md flex items-center space-x-1 animate-in fade-in">
                          <span>✓</span>
                          <span>ĐANG CHỌN</span>
                        </span>
                      ) : st.tag === 'ĐẶT NHIỀU NHẤT' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                          <span>🔥</span>
                          <span>BÁN CHẠY</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Hàng 2: Phòng chiếu & Số ghế trống */}
                    <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium truncate max-w-[100px]">{st.roomName}</span>
                      {isUrgent ? (
                        <span className="text-amber-400 font-bold flex items-center space-x-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          <span>Còn {st.availableSeats} chỗ</span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Còn {st.availableSeats} chỗ</span>
                        </span>
                      )}
                    </div>

                    {/* Hover action tip */}
                    <div className="text-[10px] text-center font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isChosen ? 'Bấm để vào chọn ghế →' : 'Chọn suất chiếu này'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* NHÓM 2: PHÒNG CHIẾU TIÊU CHUẨN DOLBY 7.1 */}
          <div className="bg-[#121827] border border-slate-800/80 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
              <div className="flex items-center space-x-3">
                <span className="bg-slate-700 text-slate-100 font-black text-[11px] px-2.5 py-1 rounded-md shadow-md tracking-wider">
                  2D PHỤ ĐỀ
                </span>
                <h4 className="text-xs sm:text-sm font-black text-white">
                  Phòng chiếu tiêu chuẩn Dolby 7.1 • Màn chiếu 4K sắc nét
                </h4>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400">Giá vé dao động:</span>
                <span className="text-blue-400 font-black text-sm">
                  {getRoomPriceRange('2d', isWeekend, pricingConfig).label}
                </span>
              </div>
            </div>

            {/* Các thẻ suất chiếu 2D */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {fallbackStandardTimes.map((st) => {
                const isChosen = currentActiveShowtime?.id === st.id;
                const isSoldOut = st.availableSeats === 0;
                const isUrgent = st.availableSeats > 0 && st.availableSeats <= 15;
                const endTime = getEndTime(st.time, movie.duration);
                const stdPricing = calculateDynamicPrices(
                  {
                    ...st,
                    startTime: selectedDate?.fullDate,
                    roomName: st.roomName || 'Rạp 03 (Tầng 2)',
                    format: '2D Tiêu Chuẩn Dolby 7.1',
                  },
                  pricingConfig
                );
                const slotPrice = stdPricing.priceStandard;

                return (
                  <div
                    key={st.id}
                    onClick={() => !isSoldOut && onSelectSlot({ ...st, price: slotPrice }, '2D Tiêu Chuẩn Dolby 7.1', isChosen)}
                    onDoubleClick={() => !isSoldOut && onSelectSlot({ ...st, price: slotPrice }, '2D Tiêu Chuẩn Dolby 7.1', true)}
                    role="button"
                    tabIndex={0}
                    className={`relative p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 select-none group ${
                      isSoldOut
                        ? 'bg-[#10141f] border-slate-800/50 opacity-40 cursor-not-allowed'
                        : isChosen
                        ? 'bg-gradient-to-br from-blue-600/25 via-indigo-950/40 to-[#0e1628] border-blue-400 ring-2 ring-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.35)] scale-[1.02] cursor-pointer'
                        : 'bg-[#151c2d] hover:bg-[#1a2339] border-slate-700/60 hover:border-blue-400/60 hover:shadow-lg cursor-pointer'
                    }`}
                  >
                    {/* Hàng 1: Giờ chiếu + Giờ kết thúc + Huy hiệu */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-baseline space-x-1.5">
                          <span
                            className={`text-2xl font-black tracking-tight ${
                              isSoldOut
                                ? 'text-slate-500 line-through'
                                : isChosen
                                ? 'text-white'
                                : 'text-slate-100 group-hover:text-blue-300'
                            } transition-colors`}
                          >
                            {st.time}
                          </span>
                          {!isSoldOut && endTime && (
                            <span className="text-[11px] font-medium text-slate-400">{endTime}</span>
                          )}
                        </div>
                        {!isSoldOut && (
                          <div className="text-[11px] font-bold text-blue-400 mt-0.5">
                            {slotPrice.toLocaleString('vi-VN')} đ
                          </div>
                        )}
                      </div>

                      {/* Huy hiệu góc phải */}
                      {isSoldOut ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30">
                          HẾT VÉ
                        </span>
                      ) : isChosen ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500 text-white shadow-md flex items-center space-x-1 animate-in fade-in">
                          <span>✓</span>
                          <span>ĐANG CHỌN</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Hàng 2: Phòng chiếu & Số ghế trống */}
                    <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium truncate max-w-[100px]">{st.roomName}</span>
                      {isSoldOut ? (
                        <span className="text-slate-500 font-medium text-[11px]">0 chỗ trống</span>
                      ) : isUrgent ? (
                        <span className="text-amber-400 font-bold flex items-center space-x-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          <span>Còn {st.availableSeats} chỗ</span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Còn {st.availableSeats} chỗ</span>
                        </span>
                      )}
                    </div>

                    {/* Hover action tip */}
                    {!isSoldOut && (
                      <div className="text-[10px] text-center font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isChosen ? 'Bấm để vào chọn ghế →' : 'Chọn suất chiếu này'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* NHÓM 3: PHÒNG CHIẾU REALD 3D HIGH FRAME RATE */}
          <div className="bg-[#121827] border border-emerald-500/20 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
              <div className="flex items-center space-x-3">
                <span className="bg-emerald-600 text-white font-black text-[11px] px-2.5 py-1 rounded-md shadow-md tracking-wider">
                  3D PHỤ ĐỀ
                </span>
                <h4 className="text-xs sm:text-sm font-black text-white">
                  Phòng chiếu RealD 3D High Frame Rate • Kính 3D siêu nhẹ êm ái
                </h4>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400">Giá vé dao động:</span>
                <span className="text-emerald-400 font-black text-sm">
                  {getRoomPriceRange('3d', isWeekend, pricingConfig).label}
                </span>
              </div>
            </div>

            {/* Các thẻ suất chiếu 3D */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {fallback3DTimes.map((st) => {
                const isChosen = currentActiveShowtime?.id === st.id;
                const isUrgent = st.availableSeats > 0 && st.availableSeats <= 15;
                const endTime = getEndTime(st.time, movie.duration);
                const threeDPricing = calculateDynamicPrices(
                  {
                    ...st,
                    startTime: selectedDate?.fullDate,
                    roomName: st.roomName || 'Rạp 05 (Tầng 3)',
                    format: 'RealD 3D HFR',
                  },
                  pricingConfig
                );
                const slotPrice = threeDPricing.priceStandard;

                return (
                  <div
                    key={st.id}
                    onClick={() => onSelectSlot({ ...st, price: slotPrice }, 'RealD 3D HFR', isChosen)}
                    onDoubleClick={() => onSelectSlot({ ...st, price: slotPrice }, 'RealD 3D HFR', true)}
                    role="button"
                    tabIndex={0}
                    className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 select-none group ${
                      isChosen
                        ? 'bg-gradient-to-br from-blue-600/25 via-indigo-950/40 to-[#0e1628] border-blue-400 ring-2 ring-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.35)] scale-[1.02]'
                        : 'bg-[#151c2d] hover:bg-[#1a2339] border-slate-700/60 hover:border-blue-400/60 hover:shadow-lg'
                    }`}
                  >
                    {/* Hàng 1: Giờ chiếu + Giờ kết thúc + Huy hiệu */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-baseline space-x-1.5">
                          <span
                            className={`text-2xl font-black tracking-tight ${
                              isChosen ? 'text-white' : 'text-slate-100 group-hover:text-blue-300'
                            } transition-colors`}
                          >
                            {st.time}
                          </span>
                          {endTime && (
                            <span className="text-[11px] font-medium text-slate-400">{endTime}</span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold text-emerald-400 mt-0.5">
                          {slotPrice.toLocaleString('vi-VN')} đ
                        </div>
                      </div>

                      {/* Huy hiệu góc phải */}
                      {isChosen ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500 text-white shadow-md flex items-center space-x-1 animate-in fade-in">
                          <span>✓</span>
                          <span>ĐANG CHỌN</span>
                        </span>
                      ) : st.tag ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                          <span>⚡</span>
                          <span>{st.tag}</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Hàng 2: Phòng chiếu & Số ghế trống */}
                    <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium truncate max-w-[100px]">{st.roomName}</span>
                      {isUrgent ? (
                        <span className="text-amber-400 font-bold flex items-center space-x-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          <span>Còn {st.availableSeats} chỗ</span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Còn {st.availableSeats} chỗ</span>
                        </span>
                      )}
                    </div>

                    {/* Hover action tip */}
                    <div className="text-[10px] text-center font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isChosen ? 'Bấm để vào chọn ghế →' : 'Chọn suất chiếu này'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* THANH GỢI Ý & ĐẶT VÉ NHANH BÊN TRONG BẢNG */}
        <div className="bg-gradient-to-r from-[#141d33] via-[#101728] to-[#141d33] border-2 border-blue-500/40 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xl">
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-2xl text-blue-400 shrink-0">
              🎟️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase text-blue-400 tracking-wider">Suất chiếu đang chọn</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-white mt-0.5">
                {currentActiveShowtime?.time || '19:15'} ({selectedDate?.tag} {selectedDate?.dateStr}) • {currentActiveShowtime?.format || 'IMAX Laser 2D'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {displayCinema?.name} • {currentActiveShowtime?.roomName || 'Phòng IMAX 01'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end space-x-5 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-800">
            <div className="text-left md:text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Giá vé dự kiến:</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400">
                {(calculateDynamicPrices({ ...currentActiveShowtime, startTime: selectedDate?.fullDate }, pricingConfig).priceStandard).toLocaleString('vi-VN')} đ
              </span>
            </div>
            <button
              type="button"
              onClick={onProceedToBooking}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black px-7 py-3.5 rounded-2xl text-sm flex items-center space-x-2.5 transition-all shadow-xl shadow-blue-600/30 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
            >
              <span>Tiếp Tục Chọn Ghế</span>
              <span className="text-lg">→</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};

export default MovieShowtimesSection;

