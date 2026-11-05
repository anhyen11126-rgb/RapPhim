import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const DA_NANG_CINEMAS = [
  {
    id: 'cinema-danang-vincom',
    name: "D'AVENOR Vincom Ngô Quyền",
    district: 'Quận Sơn Trà',
    address: 'Tầng 4 Vincom Plaza, 910A Ngô Quyền, Q. Sơn Trà, Đà Nẵng',
    tag: 'Flagship • 4DX Sound',
    distance: '1.2 km',
  },
  {
    id: 'cinema-danang-lotte',
    name: "D'AVENOR Lotte Mart Đà Nẵng",
    district: 'Quận Hải Châu',
    address: 'Tầng 5 Lotte Mart, 06 Nại Nam, Q. Hải Châu, Đà Nẵng',
    tag: 'Dolby Atmos • Sweetbox',
    distance: '2.8 km',
  },
  {
    id: 'cinema-danang-indochina',
    name: "D'AVENOR Indochina Riverside",
    district: 'Quận Hải Châu',
    address: 'Tầng 3 Indochina Mall, 74 Bạch Đằng, Q. Hải Châu, Đà Nẵng',
    tag: 'IMAX Laser • Gold Class',
    distance: '1.0 km',
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
  const locationRef = useRef(null);

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

  const filteredCinemas = DA_NANG_CINEMAS.filter((c) => {
    const matchesDistrict =
      selectedDistrict === 'Tất cả' || c.district.toLowerCase().includes(selectedDistrict.toLowerCase());
    const matchesSearch =
      !searchCinema.trim() ||
      c.name.toLowerCase().includes(searchCinema.toLowerCase()) ||
      c.address.toLowerCase().includes(searchCinema.toLowerCase());
    return matchesDistrict && matchesSearch;
  });

  return (
    <div className="relative" ref={locationRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hidden sm:flex items-center space-x-1.5 bg-[#131926] hover:bg-[#1a2336] border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-300 transition-all cursor-pointer select-none"
        title="Chọn cụm rạp D'AVENOR tại Đà Nẵng"
      >
        <span className="text-red-400 text-xs">📍</span>
        <span className="font-semibold text-[11px] text-white max-w-[125px] truncate">
          {selectedCity || 'Đà Nẵng'}
        </span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </button>

      {/* Modal chọn rạp tại Đà Nẵng */}
      {isOpen && (
        <div className="absolute right-0 sm:left-auto sm:right-0 mt-2 w-[340px] sm:w-[480px] bg-[#0c1220] border border-slate-800 rounded-3xl shadow-2xl p-4 sm:p-5 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center space-x-2">
              <span className="text-base text-red-400">📍</span>
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  Khu Vực TP. Đà Nẵng
                </h4>
                <p className="text-[10px] text-slate-400">
                  Hệ thống 03 cụm rạp D'AVENOR CINEMA phục vụ khán giả Đà Nẵng
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
                placeholder="Tìm cụm rạp tại Đà Nẵng (Vincom, Lotte Mart, Bạch Đằng...)"
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

          {/* Bộ lọc Quận / Huyện tại Đà Nẵng */}
          <div className="pb-3 border-b border-slate-800/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Chọn Quận / Huyện:
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
              <span>Cụm rạp đang hoạt động ({filteredCinemas.length})</span>
              <span className="text-emerald-400 font-medium">● Mở cửa 08:00 - 01:30</span>
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
                        {c.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      📍 {c.address}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span>Cách bạn ~{c.distance}</span>
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
              Khu vực: <strong className="text-white">Đà Nẵng</strong>
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

