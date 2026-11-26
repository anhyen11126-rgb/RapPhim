import React, { useState, useEffect } from 'react';
import { cinemaDate, releaseMonth } from '../../utils/cinemaCalendar';
import { getMoviesCached, getCinemasCached, getCachedData } from '../../services/clientDataCache';
import { resolveCanonicalCinema } from '../../constants/cinemas';
import HomeHeroBanner from '../../components/home/HomeHeroBanner';
import HomeQuickBooking from '../../components/home/HomeQuickBooking';
import HomeMovieTabs from '../../components/home/HomeMovieTabs';
import HomeBrandShowcase from '../../components/home/HomeBrandShowcase';

const formatAndSortMovies = (rawMovies = []) => {
  const formattedMovies = rawMovies.map((m) => ({
    id: m.id || m._id?.toString(),
    title: m.title,
    slug: m.slug,
    genre: m.genre || 'Hành động, Phiêu lưu',
    ageRating: m.ageRating || 'T16',
    ageDescription:
      m.ageRating === 'P'
        ? 'Phim dành cho mọi lứa tuổi'
        : `Phim cấm khán giả dưới ${m.ageRating ? m.ageRating.replace('T', '') : 16} tuổi`,
    techFormat:
      m.techFormat ||
      (Array.isArray(m.formats) && m.formats.length > 0
        ? m.formats[m.formats.length - 1]
        : 'IMAX'),
    rating: m.rating != null && Number.isFinite(Number(m.rating)) ? Number(m.rating).toFixed(1) : null,
    ratingCount: m.ratingCount || '0 lượt đánh giá',
    verifiedRatingCount: Number.isFinite(Number(m.verifiedRatingCount)) ? Number(m.verifiedRatingCount) : 0,
    duration: m.duration || 120,
    formats: Array.isArray(m.formats) && m.formats.length > 0 ? m.formats : ['2D', '3D', 'IMAX'],
    poster: m.poster || m.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
    posterUrl: m.posterUrl || m.poster,
    bannerUrl: m.bannerUrl || '',
    trailerUrl: m.trailerUrl || '',
    description: m.description || '',
    status: m.status || 'NOW_SHOWING',
    releaseDate: m.releaseDate,
    firstShowtimeId: m.firstShowtimeId,
    showtimes: Array.isArray(m.showtimes) ? m.showtimes : [],
  }));

  const currentMonth = cinemaDate().slice(0, 7);
  const rank = (movie) => {
    const month = releaseMonth(movie);
    if (month === currentMonth) return 0;
    return month > currentMonth ? 1 : 2;
  };
  return [...formattedMovies].sort((a, b) => rank(a) - rank(b)
    || cinemaDate(a.releaseDate).localeCompare(cinemaDate(b.releaseDate)));
};

const HomePage = () => {
  const initialCachedMovies = getCachedData('GET:/movies').data;
  const initialSortedMovies = initialCachedMovies ? formatAndSortMovies(initialCachedMovies) : [];
  const initialCachedCinemas = getCachedData('GET:/cinemas?').data;

  const [moviesList, setMoviesList] = useState(initialSortedMovies);
  const [cinemas, setCinemas] = useState(initialCachedCinemas ? [resolveCanonicalCinema(initialCachedCinemas)] : []);
  const [loading, setLoading] = useState(initialSortedMovies.length === 0);

  // Hero Banner Slider State
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHoveringHero, setIsHoveringHero] = useState(false);

  // Quick Booking Bar State (cố định cụm rạp duy nhất D'AVENOR Thanh Khê Plaza)
  const [selectedMovieId, setSelectedMovieId] = useState(() =>
    initialSortedMovies.length > 0 ? String(initialSortedMovies[0].id) : ''
  );
  const [selectedTheater, setSelectedTheater] = useState(() => resolveCanonicalCinema(initialCachedCinemas).name);
  const [selectedDate, setSelectedDate] = useState('Hôm nay');
  const [selectedShowtimeId, setSelectedShowtimeId] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        if (initialSortedMovies.length === 0) setLoading(true);
        const [rawMovies, rawCinemas] = await Promise.all([
          getMoviesCached(),
          getCinemasCached(),
        ]);
        if (!isMounted) return;

        if (Array.isArray(rawMovies)) {
          const sortedMovies = formatAndSortMovies(rawMovies);
          setMoviesList(sortedMovies);
          if (sortedMovies.length > 0) {
            setSelectedMovieId((prev) => prev || String(sortedMovies[0].id));
          }
        }

        const canonical = resolveCanonicalCinema(rawCinemas);
        setCinemas([canonical]);
        setSelectedTheater(canonical.name);
      } catch (err) {
        console.warn('Lỗi tải dữ liệu trang chủ từ máy chủ:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchInitialData();
    return () => { isMounted = false; };
  }, []);

  // Tự động chuyển phim trên banner sau mỗi 6 giây (Tạm dừng khi di chuột)
  useEffect(() => {
    if (moviesList.length <= 1 || isHoveringHero) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % moviesList.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [moviesList.length, isHoveringHero]);

  const handleNextHero = () => {
    if (moviesList.length === 0) return;
    setHeroIndex((prev) => (prev + 1) % moviesList.length);
  };

  const handlePrevHero = () => {
    if (moviesList.length === 0) return;
    setHeroIndex((prev) => (prev - 1 + moviesList.length) % moviesList.length);
  };

  const handleSelectHero = (idx) => {
    setHeroIndex(idx);
  };

  return (
    <div className="bg-[var(--bg-main)] text-[var(--text-main)] min-h-screen">
      {/* 1. HERO SECTION: CINEMATIC BILLBOARD BANNER WITH CAROUSEL */}
      <HomeHeroBanner
        moviesList={moviesList}
        heroIndex={heroIndex}
        onPrevHero={handlePrevHero}
        onNextHero={handleNextHero}
        onSelectHero={handleSelectHero}
        setIsHoveringHero={setIsHoveringHero}
      />

      {/* 2. FLOATING QUICK BOOKING BAR (THANH ĐẶT VÉ NHANH) */}
      <HomeQuickBooking
        moviesList={moviesList}
        cinemas={cinemas}
        selectedMovieId={selectedMovieId}
        setSelectedMovieId={setSelectedMovieId}
        selectedTheater={selectedTheater}
        setSelectedTheater={setSelectedTheater}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedShowtimeId={selectedShowtimeId}
        setSelectedShowtimeId={setSelectedShowtimeId}
      />

      {/* 3. TABS PHIM: ĐANG CHIẾU / SẮP CHIẾU / SUẤT CHIẾU ĐẶC BIỆT */}
      <HomeMovieTabs moviesList={moviesList} />

      {/* 4. SHOWCASE THƯƠNG HIỆU: CÔNG NGHỆ RẠP, HỘI VIÊN & ĐỐI TÁC */}
      <HomeBrandShowcase />
    </div>
  );
};

export default HomePage;
