import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-[#080c14] text-slate-400 border-t border-slate-800/80 pt-14 pb-28 text-xs leading-relaxed">
      <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Logo & Giới thiệu */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img
                src="/Logo.png"
                alt="D'AVENOR CINEMA"
                className="h-14 w-auto object-contain drop-shadow-[0_2px_12px_rgba(212,175,55,0.3)] block"
              />
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Trải nghiệm điện ảnh đỉnh cao với hệ thống rạp chiếu hiện đại, công nghệ IMAX & Dolby Atmos tiêu chuẩn quốc tế tại Việt Nam.
            </p>
            <div className="flex items-center space-x-3 pt-1">
              <span className="w-8 h-8 rounded-full bg-[#111726] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors shadow">
                🌐
              </span>
              <span className="w-8 h-8 rounded-full bg-[#111726] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors shadow">
                📽️
              </span>
              <span className="w-8 h-8 rounded-full bg-[#111726] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors shadow">
                💬
              </span>
            </div>
          </div>

          {/* Cột 1: Cụm Rạp Chiếu Flagship */}
          <div className="space-y-3">
            <h4 className="font-bold text-white tracking-wide text-sm">Cụm Rạp Chiếu</h4>
            <div className="space-y-2.5 text-slate-400 text-xs">
              <Link
                to="/theaters"
                className="group block"
              >
                <div className="font-bold text-amber-400 group-hover:text-amber-300 transition-colors flex items-center space-x-1.5">
                  <span>📍</span>
                  <span>D'AVENOR Thanh Khê Plaza</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed group-hover:text-slate-300 transition-colors">
                  Tầng 4 TTTM Thanh Khê Plaza, 295 Điện Biên Phủ, Q. Thanh Khê, TP. Đà Nẵng
                </p>
              </Link>
              <div className="text-[11px] space-y-1 text-slate-400 pt-0.5">
                <p>• <span className="text-slate-300 font-medium">Giờ mở cửa:</span> 08:00 – 02:00 sáng</p>
                <p>• <span className="text-slate-300 font-medium">Quy mô:</span> 9 phòng chiếu (3 IMAX Laser, 3 Dolby Atmos, 3 Gold Class • 88 ghế/phòng)</p>
                <p>• <span className="text-slate-300 font-medium">Gửi xe:</span> Hầm B1 & B2 miễn phí 24/7</p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="bg-[#18130e] border border-amber-500/40 text-amber-400 text-[10px] px-2 py-0.5 rounded font-medium">
                  IMAX Laser
                </span>
                <span className="bg-[#111726] border border-slate-700/80 text-slate-300 text-[10px] px-2 py-0.5 rounded font-medium">
                  Dolby Atmos
                </span>
                <span className="bg-[#111726] border border-slate-700/80 text-slate-300 text-[10px] px-2 py-0.5 rounded font-medium">
                  RealD 3D
                </span>
              </div>
            </div>
          </div>

          {/* Cột 2: Chính sách & Hỗ trợ */}
          <div className="space-y-3">
            <h4 className="font-bold text-white tracking-wide text-sm">Chính sách & Hỗ trợ</h4>
            <ul className="space-y-2 text-slate-400 text-xs">
              <li className="hover:text-slate-200 transition-colors cursor-pointer">Điều khoản sử dụng</li>
              <li className="hover:text-slate-200 transition-colors cursor-pointer">Chính sách đổi trả vé</li>
              <li className="hover:text-slate-200 transition-colors cursor-pointer">Bảo mật thông tin khách hàng</li>
              <li className="hover:text-slate-200 transition-colors cursor-pointer">Câu hỏi thường gặp (FAQ)</li>
              <li className="hover:text-slate-200 transition-colors cursor-pointer">Liên hệ hợp tác & Sự kiện</li>
            </ul>
          </div>

          {/* Cột 3: Chứng nhận & Đối tác */}
          <div className="space-y-3">
            <h4 className="font-bold text-white tracking-wide text-sm">Chứng nhận & Đối tác</h4>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              <span className="bg-[#211709] border border-amber-500/40 text-amber-500 px-2.5 py-1 rounded">
                IMAX Certified
              </span>
              <span className="bg-[#111726] border border-slate-700/80 text-slate-300 px-2.5 py-1 rounded">
                Dolby Atmos
              </span>
              <span className="bg-[#0b1e17] border border-emerald-500/40 text-emerald-400 px-2.5 py-1 rounded">
                4DX Motion
              </span>
            </div>
            <div className="pt-2">
              <p className="text-[11px] text-slate-400">
                Hotline: <strong className="text-white">1900 8899</strong> (8:00 - 23:00 tất cả các ngày trong tuần)
              </p>
            </div>
          </div>
        </div>

        {/* Bản quyền */}
        <div className="border-t border-slate-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© 2026 D'AVENOR CINEMA Vietnam Corporation. Tất cả quyền được bảo lưu.</p>
          <div className="flex space-x-6">
            <span className="hover:text-slate-400 cursor-pointer transition-colors">Quyền riêng tư</span>
            <span className="hover:text-slate-400 cursor-pointer transition-colors">Bảo mật</span>
            <span className="hover:text-slate-400 cursor-pointer transition-colors">Sơ đồ trang</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
