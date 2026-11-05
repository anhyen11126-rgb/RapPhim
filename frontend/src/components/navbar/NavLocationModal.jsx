import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export const DA_NANG_CINEMAS = [
  // 1. QUẬN HẢI CHÂU
  {
    id: 'cinema-danang-indochina',
    name: "D'AVENOR Indochina Riverside",
    district: 'Hải Châu',
    address: 'Tầng 3 Indochina Riverside Mall, 74 Bạch Đằng, Q. Hải Châu, Đà Nẵng',
    tag: 'IMAX Laser • Gold Class',
    distance: '1.0 km',
  },
  {
    id: 'cinema-danang-lotte',
    name: "D'AVENOR Lotte Mart Đà Nẵng",
    district: 'Hải Châu',
    address: 'Tầng 5 Lotte Mart Đà Nẵng, 06 Nại Nam, P. Hòa Cường Bắc, Q. Hải Châu, Đà Nẵng',
    tag: 'Dolby Atmos • Sweetbox',
    distance: '2.8 km',
  },

  // 2. QUẬN SƠN TRÀ
  {
    id: 'cinema-danang-vincom',
    name: "D'AVENOR Vincom Ngô Quyền",
    district: 'Sơn Trà',
    address: 'Tầng 4 Vincom Plaza, 910A Ngô Quyền, Q. Sơn Trà, Đà Nẵng',
    tag: 'Flagship • 4DX Sound',
    distance: '1.2 km',
  },
  {
    id: 'cinema-danang-sontra-marina',
    name: "D'AVENOR Sơn Trà Marina Cineplex",
    district: 'Sơn Trà',
    address: 'Khu du lịch Sơn Trà Marina, Đường Hoàng Sa, Bán đảo Sơn Trà, Q. Sơn Trà, Đà Nẵng',
    tag: 'IMAX Laser • VIP Lounge',
    distance: '3.6 km',
  },

  // 3. QUẬN THANH KHÊ
  {
    id: 'cinema-danang-thanhkhe-plaza',
    name: "D'AVENOR Thanh Khê Plaza",
    district: 'Thanh Khê',
    address: 'Tầng 4 TTTM Thanh Khê Plaza, 295 Điện Biên Phủ, P. Chính Gián, Q. Thanh Khê, Đà Nẵng',
    tag: 'Dolby Atmos • 4DX Sound',
    distance: '2.1 km',
  },
  {
    id: 'cinema-danang-coopmart-thanhkhe',
    name: "D'AVENOR Co.opmart Dũng Sĩ Thanh Khê",
    district: 'Thanh Khê',
    address: 'Tầng 3 Siêu thị Co.opmart, 478 Điện Biên Phủ, P. Thanh Khê Đông, Q. Thanh Khê, Đà Nẵng',
    tag: 'Dolby Atmos • Kids Hall',
    distance: '2.9 km',
  },

  // 4. QUẬN CẨM LỆ
  {
    id: 'cinema-danang-camle-megamall',
    name: "D'AVENOR Cẩm Lệ Megamall",
    district: 'Cẩm Lệ',
    address: 'Tầng 4 Cẩm Lệ Megamall, 102 Cách Mạng Tháng 8, P. Khuê Trung, Q. Cẩm Lệ, Đà Nẵng',
    tag: 'Dolby Atmos • IMAX Laser',
    distance: '3.8 km',
  },
  {
    id: 'cinema-danang-hoaxuan-riverside',
    name: "D'AVENOR Hòa Xuân Riverside Cineplex",
    district: 'Cẩm Lệ',
    address: 'Đại lộ Võ Chí Công, KĐT Sinh Thái Nam Hòa Xuân, Q. Cẩm Lệ, Đà Nẵng',
    tag: 'Sweetbox Lounge • Gold Class',
    distance: '4.5 km',
  },

  // 5. QUẬN NGŨ HÀNH SƠN
  {
    id: 'cinema-danang-nguhanhson-resort',
    name: "D'AVENOR Ngũ Hành Sơn Resort Cinema",
    district: 'Ngũ Hành Sơn',
    address: 'Tầng 2 Luxury Complex, Đường Võ Nguyên Giáp, P. Khuê Mỹ, Q. Ngũ Hành Sơn, Đà Nẵng',
    tag: 'IMAX Laser • Gold Class',
    distance: '4.2 km',
  },
  {
    id: 'cinema-danang-fptcity',
    name: "D'AVENOR FPT City Đà Nẵng",
    district: 'Ngũ Hành Sơn',
    address: 'Tòa nhà FPT Complex, Đường Nam Kỳ Khởi Nghĩa, P. Hòa Hải, Q. Ngũ Hành Sơn, Đà Nẵng',
    tag: 'Dolby Atmos • Students Hall',
    distance: '6.5 km',
  },

  // 6. QUẬN LIÊN CHIỂU
  {
    id: 'cinema-danang-lienchieu-center',
    name: "D'AVENOR Liên Chiểu Center",
    district: 'Liên Chiểu',
    address: 'Tầng 4 TTTM Hòa Khánh, 437 Tôn Đức Thắng, P. Hòa Khánh Nam, Q. Liên Chiểu, Đà Nẵng',
    tag: 'Dolby Atmos • Sweetbox Lounge',
    distance: '5.0 km',
  },
  {
    id: 'cinema-danang-hoakhanh-univ',
    name: "D'AVENOR Đại Học Bách Khoa Cineplex",
    district: 'Liên Chiểu',
    address: '54 Nguyễn Lương Bằng, P. Hòa Khánh Bắc, Q. Liên Chiểu, Đà Nẵng',
    tag: 'Dolby Atmos • Students Hall',
    distance: '5.8 km',
  },
];

const DA_NANG_DISTRICTS = [
  'Tất cả',
  'Hải Châu',
  'Sơn Trà',
  'Thanh Khê',
  'Cẩm Lệ',
  'Ngũ Hành Sơn',
  'Liên Chiểu',
];

const NavLocationModal = ({ selectedCity, setSelectedCity }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả');
  const [searchCinema, setSearchCinema] = useState('');
  const [cinemasList, setCinemasList] = useState(DA_NANG_CINEMAS);
  const [isLoading, setIsLoading] = useState(false);
  const locationRef = useRef(null);

  // Tải danh sách rạp trực tiếp từ CSDL Database MongoDB
  useEffect(() => {
    fetchCinemasFromDatabase();
  }, []);

  const fetchCinemasFromDatabase = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/cinemas', { params: { city: 'Đà Nẵng' } });
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const formatted = res.data.map((c) => ({
          id: c.id || c._id,
          name: c.name,
          district: c.district || 'Hải Châu',
          address: c.address,
          tag: Array.isArray(c.tags) && c.tags.length > 0 ? c.tags.join(' • ') : (c.specialBadge || 'Rạp hiện đại'),
          distance: c.distance || '2.0 km',
        }));
        setCinemasList(formatted);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách rạp từ DB (dùng danh sách dự phòng):', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (locationRef.current && !locationRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    const handleOpenModal = () => {
      setIsOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('openLocationModal', handleOpenModal);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('openLocationModal', handleOpenModal);
    };
  }, []);

  const handleSelectCinema = (cinema) => {
    setSelectedCity('Đà Nẵng');
    localStorage.setItem('selectedCity', 'Đà Nẵng');
    localStorage.setItem('selectedCinema', cinema.name);
    window.dispatchEvent(new CustomEvent('cityChange', { detail: 'Đà Nẵng' }));
    window.dispatchEvent(new CustomEvent('cinemaChange', { detail: cinema.name }));
    setIsOpen(false);
  };

  const filteredCinemas = cinemasList.filter((c) => {
    const matchesDistrict =
      selectedDistrict === 'Tất cả' ||
      (c.district && c.district.toLowerCase() === selectedDistrict.toLowerCase());
    const matchesSearch =
      !searchCinema.trim() ||
      c.name.toLowerCase().includes(searchCinema.toLowerCase()) ||
      c.address.toLowerCase().includes(searchCinema.toLowerCase()) ||
      (c.district && c.district.toLowerCase().includes(searchCinema.toLowerCase()));
    return matchesDistrict && matchesSearch;
  });

  return (
    <div className="relative" ref={locationRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hidden sm:flex items-center space-x-1.5 bg-[#131926] hover:bg-[#1a2336] border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-300 transition-all cursor-pointer select-none"
        title="Chọn cụm rạp D'AVENOR tại 6 quận Đà Nẵng (Kết nối Database)"
      >
        <span className="text-red-400 text-xs">📍</span>
        <span className="font-semibold text-[11px] text-white max-w-[125px] truncate">
          {selectedCity || 'Đà Nẵng'}
        </span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </button>

      {/* Modal chọn rạp tại Đà Nẵng kết nối Database */}
      {isOpen && (
        <div className="absolute right-0 sm:left-auto sm:right-0 mt-2 w-[360px] sm:w-[520px] bg-[#0c1220] border border-slate-800 rounded-3xl shadow-2xl p-4 sm:p-5 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center space-x-2">
              <span className="text-base text-red-400">📍</span>
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  Hệ Thống Rạp D'AVENOR Tại Đà Nẵng
                </h4>
                <p className="text-[10px] text-slate-400">
                  Dữ liệu trực tiếp từ CSDL MongoDB ({cinemasList.length} cụm rạp tại 6 quận)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Ô tìm kiếm rạp */}
          <div className="pt-3 pb-2.5">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                🔍
              </span>
              <input
                type="text"
                autoFocus
                value={searchCinema}
                onChange={(e) => setSearchCinema(e.target.value)}
                placeholder="Tìm rạp tại Đà Nẵng (Vincom, Thanh Khê, Cẩm Lệ, FPT City, Hòa Khánh...)"
                className="w-full bg-[#12192a] border border-slate-700/80 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchCinema && (
                <button
                  type="button"
                  onClick={() => setSearchCinema('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Bộ lọc 6 Quận / Huyện tại Đà Nẵng */}
          <div className="pb-3 border-b border-slate-800/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Chọn Quận / Huyện ({DA_NANG_DISTRICTS.length - 1} quận):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DA_NANG_DISTRICTS.map((district) => (
                <button
                  key={district}
                  type="button"
                  onClick={() => setSelectedDistrict(district)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    selectedDistrict === district
                      ? 'bg-[#2563eb] text-white font-bold shadow-md shadow-blue-600/30'
                      : 'bg-[#141b2c] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {district}
                </button>
              ))}
            </div>
          </div>

          {/* Danh sách các cụm rạp tại Đà Nẵng */}
          <div className="pt-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              <span>Cụm rạp tìm thấy ({filteredCinemas.length})</span>
              {isLoading ? (
                <span className="text-blue-400 font-medium">Đang đồng bộ DB...</span>
              ) : (
                <span className="text-emerald-400 font-medium">● Giá vé từ 45.000 VNĐ</span>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
              {filteredCinemas.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  Không tìm thấy rạp nào ở khu vực đã chọn
                </div>
              ) : (
                filteredCinemas.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCinema(c)}
                    className="p-2.5 rounded-xl bg-[#12192a]/90 hover:bg-[#182339] border border-slate-800/80 hover:border-blue-500/60 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-blue-400 text-xs">🏛️</span>
                        <h5 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                          {c.name}
                        </h5>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Q. {c.district}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      📍 {c.address}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span>{c.tag} • ~{c.distance}</span>
                      <span className="text-blue-400 font-bold group-hover:underline">Chọn rạp này ›</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Khu vực: <strong className="text-white">TP. Đà Nẵng</strong>
            </span>
            <Link
              to="/theaters"
              onClick={() => setIsOpen(false)}
              className="text-blue-400 hover:text-blue-300 font-bold hover:underline flex items-center space-x-1"
            >
              <span>Xem toàn bộ lịch chiếu</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavLocationModal;
