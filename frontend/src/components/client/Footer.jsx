import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-[#080c14] text-slate-400 border-t border-slate-800/80 pt-14 pb-28 text-xs leading-relaxed">
      <div className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Logo & Giới thiệu */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-[#101726] border border-slate-700/80 flex items-center justify-center shadow-md">
                <img
                  src="/Logo.png"
                  alt="D'AVENOR CINEMA"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                D'AVENOR CINEMA
              </span>
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

          {/* Cột 1: Hệ thống Rạp */}
          <div className="space-y-3">
            <h4 className="font-bold text-white tracking-wide text-sm">Hệ thống Rạp</h4>
            <ul className="space-y-2 text-slate-400 text-xs">
              <li className="hover:text-slate-200 transition-colors cursor-pointer">D'AVENOR Vincom Ngô Quyền (IMAX)</li>
              <li className="hover:text-slate-200 transition-colors cursor-pointer">D'AVENOR Indochina Riverside</li>
              <li className="hover:text-slate-200 transition-colors cursor-pointer">D'AVENOR Lotte Mart Đà Nẵng</li>
              <li className="hover:text-slate-200 transition-colors cursor-pointer">D'AVENOR Thanh Khê Plaza</li>
              <li className="hover:text-slate-200 transition-colors cursor-pointer">D'AVENOR Ngũ Hành Sơn Resort</li>
            </ul>
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
