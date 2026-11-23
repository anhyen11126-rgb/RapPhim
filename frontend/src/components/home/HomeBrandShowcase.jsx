import React from 'react';
import { Link } from 'react-router-dom';

const HomeBrandShowcase = () => {
  return (
    <>
      {/* 1. CÔNG NGHỆ CHIẾU PHIM ĐỈNH CAO */}
      <section className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 py-10 border-t border-[#AA9BFF]/20">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#42DFFF]">
            TRẢI NGHIỆM ĐIỆN ẢNH VƯỢT TRỘI
          </span>
          <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-[#F4A5FF] via-[#C56BFF] via-[#83F5FF] to-[#F4A5FF] bg-clip-text text-transparent mt-1">
            Công Nghệ Chiếu Phim Đỉnh Cao
          </h2>
          <p className="text-xs sm:text-sm text-[#BEC5E5] mt-2">
            Đắm chìm vào từng khuôn hình sắc nét và âm thanh chân thực tại hệ thống phòng chiếu D'AVENOR CINEMA
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: IMAX with Laser */}
          <div className="bg-gradient-to-b from-[#20204B]/90 to-[#11152F]/90 backdrop-blur-xl border border-[#AA9BFF]/35 rounded-2xl p-6 space-y-4 hover:border-[#72E8FF] hover:from-[#25234D]/95 hover:to-[#1a1f42]/95 transition-all shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black tracking-wider text-[#72E8FF]">IMAX LASER</span>
              <span className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-[#72E8FF]/40 flex items-center justify-center text-[#72E8FF] text-sm font-bold shadow-sm">
                📽️
              </span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#F8F7FF]">Màn Chiếu Laser Siêu Thực</h4>
              <p className="text-xs text-[#E9D5FF] mt-2 leading-relaxed">
                Máy chiếu Laser thế hệ mới tái hiện hình ảnh sắc nét gấp 4 lần, tỷ lệ khung hình mở rộng tăng 40% diện tích nhìn.
              </p>
            </div>
            <Link to="/theaters" className="inline-block text-xs text-[#72E8FF] hover:text-[#B4F7FF] font-bold pt-1">
              Tìm rạp IMAX Laser ›
            </Link>
          </div>

          {/* Card 2: DOLBY ATMOS */}
          <div className="bg-gradient-to-b from-[#20204B]/90 to-[#11152F]/90 backdrop-blur-xl border border-[#AA9BFF]/35 rounded-2xl p-6 space-y-4 hover:border-emerald-400 hover:from-[#25234D]/95 hover:to-[#1a1f42]/95 transition-all shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black tracking-wider text-emerald-400">ATMOS</span>
              <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 text-sm font-bold shadow-sm">
                🔊
              </span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#F8F7FF]">Âm Thanh Đa Chiều 360°</h4>
              <p className="text-xs text-[#E9D5FF] mt-2 leading-relaxed">
                Hơn 64 loa độc lập bao phủ toàn bộ phòng chiếu, dẫn truyền từng tiếng thở và tiếng động cơ lướt chân thực xung quanh bạn.
              </p>
            </div>
            <Link to="/theaters" className="inline-block text-xs text-emerald-400 hover:text-emerald-300 font-bold pt-1">
              Khám phá Dolby Atmos ›
            </Link>
          </div>

          {/* Card 3: GOLD CLASS */}
          <div className="bg-gradient-to-b from-[#20204B]/90 to-[#11152F]/90 backdrop-blur-xl border border-[#AA9BFF]/35 rounded-2xl p-6 space-y-4 hover:border-[#B47AFF] hover:from-[#25234D]/95 hover:to-[#1a1f42]/95 transition-all shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black tracking-wider text-[#B47AFF]">GOLD CLASS</span>
              <span className="w-8 h-8 rounded-lg bg-purple-500/15 border border-[#B47AFF]/40 flex items-center justify-center text-[#B47AFF] text-sm font-bold shadow-sm">
                ★
              </span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#F8F7FF]">Ghế Da Recliner & Đồ Ăn VIP</h4>
              <p className="text-xs text-[#E9D5FF] mt-2 leading-relaxed">
                Ghế sofa điều chỉnh điện ngả 180 độ, phục vụ ẩm thực cao cấp tận ghế và phòng chờ đón khách thương gia đẳng cấp.
              </p>
            </div>
            <Link to="/theaters" className="inline-block text-xs text-[#B47AFF] hover:text-[#D99BFF] font-bold pt-1">
              Dịch vụ VIP Lounge ›
            </Link>
          </div>
        </div>
      </section>

      {/* 2. PROMOTION BANNER (HỘI VIÊN D'AVENOR CLUB) */}
      <section id="promotions" className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 py-6">
        <div className="bg-gradient-to-b from-[#20204B]/90 to-[#11152F]/90 backdrop-blur-xl border border-[#AA9BFF]/35 rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-[#B47AFF]/15 text-[#72E8FF] rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border border-[#AA9BFF]/40 shadow-sm">
              🎟️
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#72E8FF] uppercase tracking-widest block">
                ĐẶC QUYỀN HỘI VIÊN D'AVENOR CLUB
              </span>
              <h3 className="text-lg sm:text-xl font-black text-[#F8F7FF] mt-0.5">
                Tặng ngay 01 vé xem phim 2D & Bắp nước miễn phí
              </h3>
              <p className="text-xs text-[#E9B5FF] mt-1">
                Đăng ký thành viên mới hôm nay. Tích lũy 10% điểm thưởng cho mỗi giao dịch mua vé trực tuyến.
              </p>
            </div>
          </div>

          <Link
            to="/register"
            className="w-full sm:w-auto flex-shrink-0 bg-gradient-to-r from-[#F9B8FF] via-[#D99BFF] via-[#86DEFF] to-[#B4F7FF] text-[#0B1026] font-black px-7 py-3 rounded-xl text-xs sm:text-sm transition-all shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)] hover:brightness-108 hover:scale-105 text-center cursor-pointer"
          >
            Đăng ký miễn phí
          </Link>
        </div>
      </section>

      {/* 3. ĐỐI TÁC THANH TOÁN BẢO MẬT */}
      <section className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 py-8 border-t border-[#AA9BFF]/20">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#BEC5E5]">
          <div className="flex items-center space-x-2.5">
            <svg
              className="w-4 h-4 text-[#42DFFF] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.15"></path>
              <path d="m9 12 2 2 4-4" strokeWidth="2.5"></path>
            </svg>
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#BEC5E5]">
              ĐỐI TÁC THANH TOÁN BẢO MẬT
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 font-semibold text-[#BEC5E5] text-xs">
            <span className="hover:text-[#F8F7FF] transition-colors cursor-pointer">MoMo</span>
            <span className="hover:text-[#F8F7FF] transition-colors cursor-pointer">ZaloPay</span>
            <span className="hover:text-[#F8F7FF] transition-colors cursor-pointer">VNPay</span>
            <span className="hover:text-[#F8F7FF] transition-colors cursor-pointer">Apple Pay</span>
            <span className="hover:text-[#F8F7FF] transition-colors cursor-pointer">VISA / Mastercard</span>
          </div>
        </div>
      </section>
    </>
  );
};

export default HomeBrandShowcase;

