import React, { useState } from 'react';
import MovieCard from '../client/MovieCard';

const HomeMovieTabs = ({ moviesList }) => {
  const [activeTab, setActiveTab] = useState('NOW_SHOWING');

  const nowShowingMovies = moviesList.filter((m) => m.status === 'NOW_SHOWING' || !m.status);
  const comingSoonMovies = moviesList.filter((m) => m.status === 'COMING_SOON');
  const specialMovies = moviesList.filter(
    (m) =>
      (Array.isArray(m.formats) && m.formats.some((f) => f.includes('IMAX'))) ||
      m.ageRating === 'T18'
  );

  let displayedMovies = nowShowingMovies;
  if (activeTab === 'COMING_SOON') displayedMovies = comingSoonMovies;
  if (activeTab === 'SPECIAL') displayedMovies = specialMovies;

  return (
    <section className="max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto scrollbar-none w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('NOW_SHOWING')}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'NOW_SHOWING'
                ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/50'
                : 'bg-[#121828] text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            🎬 Phim Đang Chiếu ({nowShowingMovies.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMING_SOON')}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'COMING_SOON'
                ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/50'
                : 'bg-[#121828] text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            🍿 Phim Sắp Chiếu ({comingSoonMovies.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SPECIAL')}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'SPECIAL'
                ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/50'
                : 'bg-[#121828] text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            ⭐ Suất Chiếu IMAX & VIP ({specialMovies.length})
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium hidden md:block">
          Hiển thị <strong>{displayedMovies.length}</strong> bộ phim chất lượng cao
        </span>
      </div>

      {/* Grid Danh sách phim */}
      <div className="mt-8">
        {displayedMovies.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            Hiện không có phim nào trong mục này. Vui lòng quay lại sau!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {displayedMovies.map((movie) => (
              <MovieCard key={movie.id || movie._id} movie={movie} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HomeMovieTabs;

