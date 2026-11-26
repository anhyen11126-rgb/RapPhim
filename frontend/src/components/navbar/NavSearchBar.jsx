import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getMoviesCached } from '../../services/clientDataCache';

const NavSearchBar = () => {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const requestSeqRef = useRef(0);

  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Tất cả');
  const [allGenres, setAllGenres] = useState(['Tất cả']);
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);

  // Nạp danh sách thể loại thực tế từ dữ liệu phim (không hardcode)
  useEffect(() => {
    let mounted = true;
    getMoviesCached()
      .then((movies) => {
        if (!mounted || !Array.isArray(movies)) return;
        const genreSet = new Set();
        movies.forEach((m) => {
          String(m.genre || '')
            .split(/[,•|/]+/)
            .map((g) => g.trim())
            .filter(Boolean)
            .forEach((g) => genreSet.add(g));
        });
        setAllGenres(['Tất cả', ...Array.from(genreSet).sort((a, b) => a.localeCompare(b, 'vi'))]);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilter = Boolean(movieSearchQuery.trim() || selectedGenre !== 'Tất cả');

  // Tìm kiếm phim thời gian thực (hỗ trợ tiếng Việt không dấu + cụm từ tự nhiên + lọc thể loại + AbortController)
  useEffect(() => {
    if (!hasActiveFilter) {
      setMovieSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const mySeq = ++requestSeqRef.current;

    const timer = setTimeout(async () => {
      try {
        setIsSearchLoading(true);
        setIsSearchDropdownOpen(true);
        const params = {};
        if (movieSearchQuery.trim()) params.search = movieSearchQuery.trim();
        if (selectedGenre !== 'Tất cả') params.genre = selectedGenre;

        const res = await api.get('/movies', {
          params,
          signal: controller.signal,
        });
        if (controller.signal.aborted || mySeq !== requestSeqRef.current) return;
        setMovieSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        console.warn('Lỗi tìm kiếm phim từ database:', err);
        if (mySeq === requestSeqRef.current) setMovieSearchResults([]);
      } finally {
        if (!controller.signal.aborted && mySeq === requestSeqRef.current) {
          setIsSearchLoading(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [movieSearchQuery, selectedGenre, hasActiveFilter]);

  const handleSelectMovie = (movie) => {
    setIsSearchDropdownOpen(false);
    setMovieSearchQuery('');
    setSelectedGenre('Tất cả');
    navigate(`/movie/${movie.id || movie._id || movie.slug}`);
  };

  const handleResetFilters = () => {
    setMovieSearchQuery('');
    setSelectedGenre('Tất cả');
    setMovieSearchResults([]);
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

  const displayedGenres = useMemo(() => allGenres.slice(0, 12), [allGenres]);

  return (
    <div className="relative hidden md:block w-56 lg:w-72" ref={searchRef}>
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
        🔍
      </span>
      <input
        type="text"
        value={movieSearchQuery}
        onChange={(e) => setMovieSearchQuery(e.target.value)}
        onFocus={() => setIsSearchDropdownOpen(true)}
        onKeyDown={handleSearchKeyDown}
        placeholder="Tìm phim (VD: phim mai, lat mat)..."
        aria-label="Tìm kiếm phim"
        className="w-full bg-[#171936] border border-[#AA9BFF]/35 rounded-full pl-8 pr-8 py-1.5 text-xs text-[#F8F7FF] placeholder-[#BEC5E5]/60 focus:outline-none focus:border-[#72E8FF] focus:ring-1 focus:ring-[#72E8FF]/50 transition-all"
      />
      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => {
            handleResetFilters();
            setIsSearchDropdownOpen(false);
          }}
          aria-label="Xóa từ khóa và bộ lọc"
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#BEC5E5]/60 hover:text-[#F8F7FF] text-xs cursor-pointer"
        >
          ✕
        </button>
      )}

      {/* Menu Dropdown hiển thị bộ lọc thể loại + kết quả phim tìm kiếm */}
      {isSearchDropdownOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-[420px] bg-[#171936] border border-[#AA9BFF]/35 rounded-2xl shadow-[0_12px_36px_rgba(11,16,38,0.95),0_0_24px_rgba(168,85,247,0.25)] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Bộ lọc thể loại (SEARCH-07) */}
          <div className="px-3.5 py-2.5 border-b border-[#AA9BFF]/20 bg-[#11152F]/70 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#BEC5E5] uppercase tracking-wider">
                Lọc theo thể loại
              </span>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[10px] font-bold text-[#42DFFF] hover:text-white transition-colors cursor-pointer"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {displayedGenres.map((genre) => {
                const isActive = selectedGenre === genre;
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-gradient-to-r from-[#A855F7] to-[#42DFFF] text-[#0B1026] border-transparent shadow-sm'
                        : 'bg-[#0B1026]/80 text-[#BEC5E5] border-[#AA9BFF]/25 hover:border-[#42DFFF]/60 hover:text-white'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-3.5 py-2 border-b border-[#AA9BFF]/20 flex items-center justify-between text-[11px]">
            <span className="font-bold text-[#BEC5E5] uppercase tracking-wider">
              KẾT QUẢ TÌM KIẾM ({movieSearchResults.length})
            </span>
            {isSearchLoading && (
              <span className="text-[#42DFFF] flex items-center gap-1 font-semibold">
                <span className="w-2.5 h-2.5 border-2 border-[#42DFFF] border-t-transparent rounded-full animate-spin"></span>
                Đang tra cứu...
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#AA9BFF]/10">
            {!hasActiveFilter ? (
              <div className="py-5 px-4 text-center text-[11px] text-[#BEC5E5]/80">
                Nhập tên phim (có dấu hoặc không dấu) hoặc chọn một thể loại phía trên.
              </div>
            ) : isSearchLoading && movieSearchResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#BEC5E5]">
                Đang tìm kiếm phim trong hệ thống...
              </div>
            ) : movieSearchResults.length === 0 ? (
              <div className="py-6 px-4 text-center space-y-1.5">
                <p className="text-xs font-semibold text-[#F8F7FF]">
                  Không tìm thấy phim phù hợp
                  {movieSearchQuery.trim() ? ` với từ khóa "${movieSearchQuery.trim()}"` : ''}
                  {selectedGenre !== 'Tất cả' ? ` thuộc thể loại "${selectedGenre}"` : ''}.
                </p>
                <p className="text-[11px] text-[#BEC5E5]/70">
                  Thử tìm 'phim mai', 'lat mat', 'dune', 'avatar' hoặc đặt lại bộ lọc.
                </p>
              </div>
            ) : (
              movieSearchResults.map((m) => {
                const isComingSoon = m.status === 'COMING_SOON';
                const displayRating = m.rating;
                return (
                  <div
                    key={m.id || m._id}
                    onClick={() => handleSelectMovie(m)}
                    className="p-3 hover:bg-[#20204B] transition-colors cursor-pointer flex items-center space-x-3 group"
                  >
                    <div className="w-11 h-15 rounded-lg overflow-hidden bg-[#0B1026] border border-[#AA9BFF]/20 shrink-0">
                      <img
                        src={m.posterUrl || m.poster || '/banner-dune.jpg'}
                        alt={m.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span className="text-xs font-black text-[#F8F7FF] group-hover:text-[#83F5FF] transition-colors truncate">
                          {m.title}
                        </span>
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-500/20 text-[#F4A5FF] border border-[#A855F7]/30">
                          {m.ageRating || 'T16'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#BEC5E5] truncate">
                        {m.genre} • {m.duration} phút
                      </p>
                      <div className="flex items-center space-x-2 text-[10px]">
                        {/* SEARCH-08 & SEARCH-09: Đang chiếu #22C55E, Sắp chiếu #60A5FA */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${
                            isComingSoon
                              ? 'text-[#60A5FA] bg-[#60A5FA]/15 border-[#60A5FA]/40'
                              : 'text-[#22C55E] bg-[#22C55E]/15 border-[#22C55E]/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isComingSoon ? 'bg-[#60A5FA]' : 'bg-[#22C55E]'
                            }`}
                          />
                          <span>{isComingSoon ? 'Sắp chiếu' : 'Đang chiếu'}</span>
                        </span>
                        {displayRating != null ? (
                          <span className="text-amber-400 font-bold">
                            ★ {Number(displayRating).toFixed(1)}
                            {m.verifiedRatingCount > 0 ? ` (${m.verifiedRatingCount})` : ''}
                          </span>
                        ) : (
                          <span className="text-[#929ABD]">Chưa có đánh giá</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[#BEC5E5] group-hover:text-[#42DFFF] text-xs">➔</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-3.5 py-2 bg-[#0B1026] border-t border-[#AA9BFF]/20 text-[10px] text-[#929ABD] text-center">
            Nhấn vào phim để xem chi tiết & chọn suất chiếu
          </div>
        </div>
      )}
    </div>
  );
};

export default NavSearchBar;
