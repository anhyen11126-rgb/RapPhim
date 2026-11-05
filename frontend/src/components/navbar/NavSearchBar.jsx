import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const NavSearchBar = () => {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tìm kiếm phim thời gian thực từ Database MongoDB
  useEffect(() => {
    if (!movieSearchQuery.trim()) {
      setMovieSearchResults([]);
      setIsSearchDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchLoading(true);
        setIsSearchDropdownOpen(true);
        const res = await api.get('/movies', {
          params: { search: movieSearchQuery.trim() },
        });
        setMovieSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.warn('Lỗi tìm kiếm phim từ database:', err);
        setMovieSearchResults([]);
      } finally {
        setIsSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [movieSearchQuery]);

  const handleSelectMovie = (movie) => {
    setIsSearchDropdownOpen(false);
    setMovieSearchQuery('');
    navigate(`/movie/${movie.id || movie._id || movie.slug}`);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (movieSearchResults.length > 0) {
        handleSelectMovie(movieSearchResults[0]);
      }
    } else if (e.key === 'Escape') {
      setIsSearchDropdownOpen(false);
    }
  };

  return (
    <div className="relative hidden md:block w-56 lg:w-72" ref={searchRef}>
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
        🔍
      </span>
      <input
        type="text"
        value={movieSearchQuery}
        onChange={(e) => setMovieSearchQuery(e.target.value)}
        onFocus={() => {
          if (movieSearchQuery.trim()) setIsSearchDropdownOpen(true);
        }}
        onKeyDown={handleSearchKeyDown}
        placeholder="Tìm phim, diễn viên, rạp..."
        className="w-full bg-[#131926] border border-slate-800 rounded-full pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
      />
      {movieSearchQuery && (
        <button
          type="button"
          onClick={() => {
            setMovieSearchQuery('');
            setMovieSearchResults([]);
            setIsSearchDropdownOpen(false);
          }}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white text-xs cursor-pointer"
        >
          ✕
        </button>
      )}

      {/* Menu Dropdown hiển thị kết quả phim tìm kiếm từ Database */}
      {isSearchDropdownOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-[#0c1220] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3.5 py-2 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-400 uppercase tracking-wider">
              KẾT QUẢ TÌM KIẾM ({movieSearchResults.length})
            </span>
            {isSearchLoading && (
              <span className="text-blue-400 flex items-center gap-1 font-semibold">
                <span className="w-2.5 h-2.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                Đang tra cứu...
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {isSearchLoading && movieSearchResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Đang tìm kiếm phim trong hệ thống...
              </div>
            ) : movieSearchResults.length === 0 ? (
              <div className="py-6 px-4 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-300">
                  Không tìm thấy phim với từ khóa "{movieSearchQuery}"
                </p>
                <p className="text-[11px] text-slate-500">
                  Thử tìm theo tên khác như 'Spider-Man', 'Dune', 'Mai', 'Godzilla'...
                </p>
              </div>
            ) : (
              movieSearchResults.map((m) => (
                <div
                  key={m.id || m._id}
                  onClick={() => handleSelectMovie(m)}
                  className="p-3 hover:bg-[#141c2e] transition-colors cursor-pointer flex items-center space-x-3 group"
                >
                  <div className="w-11 h-15 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
                    <img
                      src={m.posterUrl || m.poster || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop'}
                      alt={m.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="text-xs font-black text-white group-hover:text-blue-400 transition-colors truncate">
                        {m.title}
                      </span>
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {m.ageRating || 'T16'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {m.genre} • {m.duration} phút
                    </p>
                    <div className="flex items-center space-x-2 text-[10px]">
                      <span className="text-emerald-400 font-semibold">
                        ● {m.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đang chiếu'}
                      </span>
                      <span className="text-amber-400">⭐ 4.9</span>
                    </div>
                  </div>
                  <span className="text-slate-500 group-hover:text-blue-400 text-xs">➔</span>
                </div>
              ))
            )}
          </div>

          <div className="px-3.5 py-2 bg-[#090d16] border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
            Nhấn vào phim để xem chi tiết & chọn suất chiếu
          </div>
        </div>
      )}
    </div>
  );
};

export default NavSearchBar;

