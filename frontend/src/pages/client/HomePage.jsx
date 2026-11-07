import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import HomeHeroBanner from '../../components/home/HomeHeroBanner';
import HomeQuickBooking from '../../components/home/HomeQuickBooking';
import HomeMovieTabs from '../../components/home/HomeMovieTabs';
import HomeBrandShowcase from '../../components/home/HomeBrandShowcase';

const HomePage = () => {
  const [moviesList, setMoviesList] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Hero Banner Slider State
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHoveringHero, setIsHoveringHero] = useState(false);

  // Quick Booking Bar State
  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [selectedTheater, setSelectedTheater] = useState('');
  const [selectedDate, setSelectedDate] = useState('Hôm nay');
  const [selectedShowtimeId, setSelectedShowtimeId] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Tự động chuyển phim trên banner sau mỗi 6 giây (Tạm dừng khi di chuột)
  useEffect(() => {
    if (moviesList.length <= 1 || isHoveringHero) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % moviesList.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [moviesList.length, isHoveringHero]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [resMovies, resCinemas] = await Promise.all([
        api.get('/movies'),
        api.get('/cinemas'),
      ]);

      if (resMovies.data && Array.isArray(resMovies.data)) {
        const formattedMovies = resMovies.data.map((m) => ({
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
            Array.isArray(m.formats) && m.formats.length > 0
              ? m.formats[0]
              : m.techFormat || 'IMAX Laser',
          rating: m.rating || '4.8',
          duration: m.duration || 120,
          formats: Array.isArray(m.formats) && m.formats.length > 0 ? m.formats : ['2D', '3D', 'IMAX Laser'],
          poster: m.poster || m.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
          posterUrl: m.posterUrl || m.poster,
          bannerUrl: m.bannerUrl || '',
          trailerUrl: m.trailerUrl || '',
          description: m.description || '',
          status: m.status || 'NOW_SHOWING',
          firstShowtimeId: m.firstShowtimeId,
          showtimes:
            m.showtimes ||
            (m.firstShowtimeId
              ? [{ id: m.firstShowtimeId, roomName: 'Phòng 01 - IMAX Laser', time: '19:30' }]
              : []),
        }));

        setMoviesList(formattedMovies);
        if (formattedMovies.length > 0) {
          setSelectedMovieId(String(formattedMovies[0].id));
          if (formattedMovies[0].firstShowtimeId) {
            setSelectedShowtimeId(String(formattedMovies[0].firstShowtimeId));
          }
        }
      }

      if (resCinemas.data && Array.isArray(resCinemas.data)) {
        // Chỉ lấy các rạp tại Đà Nẵng
        const daNangOnly = resCinemas.data.filter((c) => (c.city || '').toLowerCase().includes('đà nẵng') || !c.city);
        const finalList = daNangOnly.length > 0 ? daNangOnly : resCinemas.data;
        setCinemas(finalList);
        if (finalList.length > 0) {
          setSelectedTheater(finalList[0].name);
        }
      }
    } catch (err) {
      console.warn('Lỗi tải dữ liệu trang chủ từ máy chủ:', err.message);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="bg-[#0c1017] text-slate-100 min-h-screen">
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
