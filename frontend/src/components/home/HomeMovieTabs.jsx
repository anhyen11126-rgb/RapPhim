import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Biểu tượng Cành Nguyệt Quế Hoàng Gia sang trọng (Laurel Wreath)
const LaurelLeft = () => (
  <svg
    className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400/95 inline-block drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]"
    viewBox="0 0 32 32"
    fill="currentColor"
  >
    <path d="M12.5 4c-.3 1.8-.9 3.5-1.8 5-1.5 2.5-3.8 4.3-6.5 5.2 2.6.8 4.9 2.4 6.3 4.8 1.1 1.8 1.8 3.8 2 6 .9-1.9 1.4-4 1.4-6.2 0-2.4-.6-4.6-1.7-6.6 1.4-2.1 2.1-4.6 2-7.1-.6-.4-1.2-.8-1.7-1.1z" />
    <path d="M7 11.5c-1.1 1.6-2.6 2.8-4.4 3.5 1.7.6 3.2 1.7 4.2 3.2.7-1.2 1.2-2.5 1.4-3.9-.2-1-.6-1.9-1.2-2.8z" />
  </svg>
);

const LaurelRight = () => (
  <svg
    className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400/95 inline-block -scale-x-100 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]"
    viewBox="0 0 32 32"
    fill="currentColor"
  >
    <path d="M12.5 4c-.3 1.8-.9 3.5-1.8 5-1.5 2.5-3.8 4.3-6.5 5.2 2.6.8 4.9 2.4 6.3 4.8 1.1 1.8 1.8 3.8 2 6 .9-1.9 1.4-4 1.4-6.2 0-2.4-.6-4.6-1.7-6.6 1.4-2.1 2.1-4.6 2-7.1-.6-.4-1.2-.8-1.7-1.1z" />
    <path d="M7 11.5c-1.1 1.6-2.6 2.8-4.4 3.5 1.7.6 3.2 1.7 4.2 3.2.7-1.2 1.2-2.5 1.4-3.9-.2-1-.6-1.9-1.2-2.8z" />
  </svg>
);

// Danh sách thứ tự chuẩn 15 bộ phim sắp chiếu trải dài từ Tháng 12/2026 đến Tháng 04/2027
const COMING_SOON_SLUGS_ORDER = [
  // Tháng 12/2026 (3 phim)
  'moana-2',
  'mufasa-the-lion-king',
  'venom-the-last-dance',
  // Tháng 01/2027 (3 phim)
  'co-dau-hao-mon',
  'transformers-one',
  'inside-out-2',
  // Tháng 02/2027 (3 phim)
  'captain-america-brave-new-world',
  'joker-folie-a-deux',
  'kung-fu-panda-4',
  // Tháng 03/2027 (3 phim)
  'quat-mo-trung-ma',
  'lat-mat-7-mot-dieu-uoc',
  'godzilla-x-kong-de-che-moi',
  // Tháng 04/2027 (3 phim)
  'oppenheimer',
  'spider-man-no-way-home',
  'avatar-the-way-of-water',
];

// Hàm xác định tháng khởi chiếu của từng phim sắp chiếu
const getMovieReleaseMonth = (movie) => {
  const slug = movie?.slug || '';
  if (['moana-2', 'mufasa-the-lion-king', 'venom-the-last-dance'].includes(slug)) {
    return 'Tháng 12/2026';
  }
  if (['co-dau-hao-mon', 'transformers-one', 'inside-out-2'].includes(slug)) {
    return 'Tháng 01/2027';
  }
  if (['captain-america-brave-new-world', 'joker-folie-a-deux', 'kung-fu-panda-4'].includes(slug)) {
    return 'Tháng 02/2027';
  }
  if (['quat-mo-trung-ma', 'lat-mat-7-mot-dieu-uoc', 'godzilla-x-kong-de-che-moi'].includes(slug)) {
    return 'Tháng 03/2027';
  }
  if (['oppenheimer', 'spider-man-no-way-home', 'avatar-the-way-of-water'].includes(slug)) {
    return 'Tháng 04/2027';
  }
  return 'Năm 2027';
};

const HomeMovieTabs = ({ moviesList }) => {
  const [activeTab, setActiveTab] = useState('NOW_SHOWING');
  // Carousel State cho Phim Đang Chiếu (0: Dune 2, 1: Mai, 2: Deadpool)
  const [activeNowShowingIndex, setActiveNowShowingIndex] = useState(1);

  // Vòng lặp vô tận (Infinite Seamless Loop): Bắt đầu ở Set 1 (chính giữa, index 15)
  const [comingSoonVirtualIndex, setComingSoonVirtualIndex] = useState(15);

  // Ref container cuộn ngang và ref từng thẻ phim
  const reelScrollRef = useRef(null);
  const cardRefs = useRef([]);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftPos, setScrollLeftPos] = useState(0);
  const isDragMoved = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimerRef = useRef(null);
  const isWheelLockedRef = useRef(false);
  const initialPositionedRef = useRef(false);

  const nowShowingMovies = moviesList.filter((m) => m.status === 'NOW_SHOWING');
  const comingSoonMovies = moviesList.filter((m) => m.status === 'COMING_SOON');

  // Sắp xếp đủ 15 phim sắp chiếu thành 1 danh sách chuẩn theo thứ tự thời gian
  const all15ComingSoonMovies = useMemo(() => {
    if (!moviesList || moviesList.length === 0) return [];
    const ordered = COMING_SOON_SLUGS_ORDER.map((slug) =>
      moviesList.find((m) => m.slug === slug)
    ).filter(Boolean);
    if (ordered.length >= 12) return ordered;
    return comingSoonMovies;
  }, [moviesList, comingSoonMovies]);

  // Vòng lặp vô tận: 3 chu kỳ lặp liên tục (Set 0, Set 1, Set 2) để cuộn không bao giờ bị đứt quãng
  const loopedMovies = useMemo(() => {
    if (all15ComingSoonMovies.length === 0) return [];
    return [
      ...all15ComingSoonMovies,
      ...all15ComingSoonMovies,
      ...all15ComingSoonMovies,
    ];
  }, [all15ComingSoonMovies]);

  // Khử hoàn toàn lỗi lướt nhanh: Chỉ reset biên khi đã cuộn qua hẳn chu kỳ ngoài và thực hiện tức thời 0ms
  const checkBoundaryReset = (targetIdx) => {
    if (isDragging) return;
    const container = reelScrollRef.current;
    if (!container || all15ComingSoonMovies.length === 0) return;

    const idx = typeof targetIdx === 'number' ? targetIdx : comingSoonVirtualIndex;

    // Khi đã vượt quá Set 1 (từ index 30 trở đi)
    if (idx >= 30) {
      const normalizedIdx = (idx % 15) + 15;
      const currentCard = cardRefs.current[idx];
      const normalizedCard = cardRefs.current[normalizedIdx];
      if (currentCard && normalizedCard) {
        const shift = normalizedCard.offsetLeft - currentCard.offsetLeft;
        container.scrollLeft += shift;
        setComingSoonVirtualIndex(normalizedIdx);
      }
    }
    // Khi đã lùi quá Set 1 (nhỏ hơn index 15)
    else if (idx < 15) {
      const normalizedIdx = (idx % 15) + 15;
      const currentCard = cardRefs.current[idx];
      const normalizedCard = cardRefs.current[normalizedIdx];
      if (currentCard && normalizedCard) {
        const shift = normalizedCard.offsetLeft - currentCard.offsetLeft;
        container.scrollLeft += shift;
        setComingSoonVirtualIndex(normalizedIdx);
      }
    }
  };

  // Mượt mà đưa bộ phim mục tiêu về CHÍNH GIỮA sân khấu
  const scrollToMovie = (virtualIdx, smooth = true) => {
    if (virtualIdx < 0 || virtualIdx >= loopedMovies.length) return;
    setComingSoonVirtualIndex(virtualIdx);
    const container = reelScrollRef.current;
    const card = cardRefs.current[virtualIdx];
    if (container && card) {
      const containerWidth = container.clientWidth;
      const cardLeft = card.offsetLeft;
      const cardWidth = card.offsetWidth;
      const targetScroll = cardLeft - containerWidth / 2 + cardWidth / 2;

      isAutoScrollingRef.current = true;
      if (autoScrollTimerRef.current) clearTimeout(autoScrollTimerRef.current);

      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: smooth ? 'smooth' : 'auto',
      });

      // Sau khi cuộn mượt mà hoàn tất, kiểm tra reset chu kỳ êm ái
      autoScrollTimerRef.current = setTimeout(() => {
        isAutoScrollingRef.current = false;
        checkBoundaryReset(virtualIdx);
      }, smooth ? 400 : 20);
    }
  };

  // Đặt vị trí ban đầu tĩnh 1 lần duy nhất khi mở tab
  useEffect(() => {
    if (activeTab === 'COMING_SOON' && reelScrollRef.current && !initialPositionedRef.current) {
      const container = reelScrollRef.current;
      const middleCard = cardRefs.current[15];
      if (container && middleCard) {
        initialPositionedRef.current = true;
        const target = middleCard.offsetLeft - container.clientWidth / 2 + middleCard.offsetWidth / 2;
        container.scrollLeft = Math.max(0, target);
      }
    }
  }, [activeTab]);

  // TÍNH NĂNG ĐƯỢC YÊU CẦU: Lăn 1 khấc con chuột là cuộn ngay đến bộ phim tiếp theo nằm CHÍNH GIỮA hoàn hảo
  useEffect(() => {
    const el = reelScrollRef.current;
    if (!el || activeTab !== 'COMING_SOON') return;

    const onWheel = (e) => {
      e.preventDefault();

      // Nếu đang chuyển động giữa các nấc lăn, bỏ qua các xung thừa
      if (isWheelLockedRef.current) return;

      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 10) return;

      isWheelLockedRef.current = true;

      // Lăn xuống/phải -> Phim tiếp theo; Lăn lên/trái -> Phim trước đó
      const step = delta > 0 ? 1 : -1;
      const nextIndex = comingSoonVirtualIndex + step;

      scrollToMovie(nextIndex, true);

      // Khóa 320ms để mỗi lần lăn chuột chuyển đúng 1 phim vào chính giữa mượt mà
      setTimeout(() => {
        isWheelLockedRef.current = false;
      }, 320);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [activeTab, comingSoonVirtualIndex, loopedMovies.length]);

  // Xử lý kéo thả chuột: Khi thả tay ra, tự động căn chỉnh bộ phim gần nhất vào CHÍNH GIỮA
  const handleMouseDown = (e) => {
    if (!reelScrollRef.current) return;
    setIsDragging(true);
    isDragMoved.current = false;
    setStartX(e.pageX - reelScrollRef.current.offsetLeft);
    setScrollLeftPos(reelScrollRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // Khi người dùng thả chuột: Trượt bộ phim gần tâm nhất vào ngay chính giữa
      const container = reelScrollRef.current;
      if (container) {
        const centerPoint = container.scrollLeft + container.clientWidth / 2;
        let closestIndex = comingSoonVirtualIndex;
        let minDistance = Infinity;

        cardRefs.current.forEach((card, idx) => {
          if (!card) return;
          const cardCenter = card.offsetLeft + card.offsetWidth / 2;
          const distance = Math.abs(centerPoint - cardCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = idx;
          }
        });

        scrollToMovie(closestIndex, true);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !reelScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - reelScrollRef.current.offsetLeft;
    const walk = x - startX;
    if (Math.abs(walk) > 6) {
      isDragMoved.current = true;
    }
    reelScrollRef.current.scrollLeft = scrollLeftPos - walk;
  };

  // Cập nhật chỉ số phim khi cuộn
  const handleReelScroll = () => {
    if (!reelScrollRef.current || loopedMovies.length === 0 || isAutoScrollingRef.current) return;
    const container = reelScrollRef.current;
    const centerPoint = container.scrollLeft + container.clientWidth / 2;

    let closestIndex = comingSoonVirtualIndex;
    let minDistance = Infinity;

    cardRefs.current.forEach((card, idx) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(centerPoint - cardCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = idx;
      }
    });

    if (closestIndex !== comingSoonVirtualIndex) {
      setComingSoonVirtualIndex(closestIndex);
    }
  };

  const handleCardClick = (idx) => {
    if (isDragMoved.current) {
      isDragMoved.current = false;
      return;
    }
    scrollToMovie(idx, true);
  };

  // Xử lý click vào 15 chấm tròn chọn phim theo đường đi ngắn nhất của vòng tròn
  const handleDotClick = (targetRealIdx) => {
    const currentRealIdx = comingSoonVirtualIndex % 15;
    let diff = targetRealIdx - currentRealIdx;
    if (diff > 7) diff -= 15;
    if (diff < -7) diff += 15;
    const targetVirtualIdx = comingSoonVirtualIndex + diff;
    scrollToMovie(targetVirtualIdx, true);
  };

  // Lấy nhãn phụ / đạo diễn / thương hiệu cho từng phim
  const getMovieSubtitle = (movie) => {
    if (!movie) return "D'AVENOR PREMIERE";
    const slug = movie.slug || '';
    if (slug.includes('dune')) return 'DENIS VILLENEUVE';
    if (slug.includes('mai')) return 'TRẤN THÀNH';
    if (slug.includes('deadpool')) return 'MARVEL STUDIOS';
    if (slug.includes('moana')) return 'WALT DISNEY ANIMATION';
    if (slug.includes('mufasa')) return 'BARRY JENKINS • DISNEY';
    if (slug.includes('venom')) return 'SONY PICTURES & MARVEL';
    if (slug.includes('co-dau')) return 'VŨ NGỌC ĐÃNG';
    if (slug.includes('transformers')) return 'PARAMOUNT ANIMATION';
    if (slug.includes('inside-out')) return 'PIXAR ANIMATION STUDIOS';
    if (slug.includes('captain-america')) return 'MARVEL STUDIOS';
    if (slug.includes('joker')) return 'TODD PHILLIPS • DC STUDIOS';
    if (slug.includes('panda')) return 'DREAMWORKS ANIMATION';
    if (slug.includes('quat-mo')) return 'JANG JAE-HYUN';
    if (slug.includes('lat-mat')) return 'LÝ HẢI PRODUCTION';
    if (slug.includes('godzilla')) return 'ADAM WINGARD • LEGENDARY';
    if (slug.includes('oppenheimer')) return 'CHRISTOPHER NOLAN';
    if (slug.includes('spider-man')) return 'JON WATTS • MARVEL';
    if (slug.includes('avatar')) return 'JAMES CAMERON';
    return movie.director || "D'AVENOR EXCLUSIVE";
  };

  // Lấy huy hiệu độ tuổi: P là màu xanh, chuyển dần sang nền đỏ cho chữ HOT kèm icon ngọn lửa 🔥
  const getAgeHotBadge = (movie) => {
    const age = String(movie?.ageRating || 'T16').toUpperCase();
    const slug = movie?.slug || '';
    // Chọn lọc các phim thật sự HOT tiêu biểu (Dune 2, Mai, Deadpool, Moana 2, Lật Mặt 7, Avatar 2)
    const isHot =
      slug.includes('dune') ||
      slug.includes('mai') ||
      slug.includes('deadpool') ||
      slug.includes('moana') ||
      slug.includes('lat-mat') ||
      slug.includes('avatar');

    // Nếu là độ tuổi P (Phù hợp mọi lứa tuổi): màu xanh lá, nếu HOT thì gradient chuyển dần sang đỏ
    if (age === 'P') {
      return {
        age: 'P',
        isHot,
        cls: isHot
          ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-red-600 text-white border-emerald-400/50 shadow-[0_0_12px_rgba(239,68,68,0.55)]'
          : 'bg-emerald-600 text-white border-emerald-400/60 shadow-md',
      };
    }

    if (age === 'T13') {
      return {
        age: 'T13',
        isHot,
        cls: isHot
          ? 'bg-gradient-to-r from-amber-600 via-orange-500 to-red-600 text-white border-amber-400/50 shadow-[0_0_12px_rgba(239,68,68,0.55)]'
          : 'bg-amber-600 text-slate-950 border-amber-400/60 shadow-md',
      };
    }

    if (age === 'T16') {
      return {
        age: 'T16',
        isHot,
        cls: isHot
          ? 'bg-gradient-to-r from-orange-600 via-orange-500 to-red-600 text-white border-orange-400/50 shadow-[0_0_12px_rgba(239,68,68,0.55)]'
          : 'bg-orange-600 text-white border-orange-400/60 shadow-md',
      };
    }

    // Mặc định T18
    return {
      age: 'T18',
      isHot,
      cls: isHot
        ? 'bg-gradient-to-r from-red-700 via-red-600 to-red-500 text-white border-red-400/50 shadow-[0_0_14px_rgba(239,68,68,0.6)]'
        : 'bg-red-700 text-white border-red-500/60 shadow-md',
    };
  };

  // Đảm bảo điểm số cao chuẩn bom tấn
  const getRatingDisplay = (movie) => {
    const slug = movie?.slug || '';
    if (
      slug.includes('dune') ||
      slug.includes('oppenheimer') ||
      slug.includes('avatar') ||
      slug.includes('spider-man')
    ) {
      return '4.9';
    }
    if (
      slug.includes('mai') ||
      slug.includes('lat-mat') ||
      slug.includes('godzilla') ||
      slug.includes('inside-out') ||
      slug.includes('moana') ||
      slug.includes('deadpool') ||
      slug.includes('joker')
    ) {
      return '4.8';
    }
    if (movie?.rating && Number(movie.rating) >= 4.7) {
      return String(movie.rating);
    }
    return '4.8';
  };

  const comingSoonRealIndex =
    all15ComingSoonMovies.length > 0
      ? ((comingSoonVirtualIndex % all15ComingSoonMovies.length) + all15ComingSoonMovies.length) %
        all15ComingSoonMovies.length
      : 0;
  const activeComingSoonMovie =
    all15ComingSoonMovies[comingSoonRealIndex] || all15ComingSoonMovies[0];

  return (
    <section className="max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-14 py-8">
      {/* Header Tabs */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-slate-800">
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
            🍿 Phim Sắp Chiếu ({all15ComingSoonMovies.length || comingSoonMovies.length})
          </button>
        </div>
      </div>

      {/* 1. NỘI DUNG TAB PHIM ĐANG CHIẾU: SÂN KHẤU 3 PHIM ĐẲNG CẤP */}
      {activeTab === 'NOW_SHOWING' && nowShowingMovies.length > 0 && (
        <div className="mt-8 relative w-full overflow-hidden rounded-3xl bg-gradient-to-b from-[#18130e]/95 via-[#0d121c] to-[#080c14] border border-amber-500/25 p-4 sm:p-8 lg:p-12 shadow-2xl">
          {/* Ánh sáng sân khấu vàng kim ấm áp lộng lẫy */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-gradient-to-b from-amber-500/25 via-amber-500/8 to-transparent blur-3xl pointer-events-none rounded-full" />

          {/* Tiêu đề Cành Nguyệt Quế Hoàng Gia - Đã fix hoàn toàn chữ 'g' hiện đầy đủ và không bị cắt */}
          <div className="text-center mb-8 sm:mb-12 relative z-10">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3">
              <LaurelLeft />
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-normal font-sans bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_2px_14px_rgba(251,191,36,0.5)] pt-1 pb-4 leading-normal inline-block">
                Phim Đang Chiếu
              </h2>
              <LaurelRight />
            </div>
            <p className="mt-1 text-xs sm:text-sm md:text-base text-amber-200/80 font-medium tracking-wide">
              Khám phá những bộ phim hot nhất đang có tại D'AVENOR Cinema
            </p>
          </div>

          {/* 3 BỘ PHIM ĐANG CHIẾU SONG SONG */}
          <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-5 sm:gap-6 lg:gap-8 pt-8 sm:pt-12 pb-16">
            {nowShowingMovies.slice(0, 3).map((movie, idx) => {
              const isActive = activeNowShowingIndex === idx;
              const badge = getAgeHotBadge(movie);
              const ratingDisplay = getRatingDisplay(movie);

              return (
                <div
                  key={movie.id || movie._id || idx}
                  onMouseEnter={() => setActiveNowShowingIndex(idx)}
                  onClick={() => setActiveNowShowingIndex(idx)}
                  className={`relative w-full max-w-[340px] sm:max-w-[360px] md:max-w-[380px] aspect-[1/1.45] rounded-3xl overflow-hidden transition-all duration-500 ease-out cursor-pointer group ${
                    isActive
                      ? 'scale-100 md:scale-105 -translate-y-2 md:-translate-y-5 z-20 shadow-[0_12px_45px_rgba(245,158,11,0.45),inset_0_0_20px_rgba(245,158,11,0.15)] ring-4 ring-amber-400/50 border-2 border-amber-400 opacity-100'
                      : 'scale-95 translate-y-0 z-10 border border-slate-700/80 hover:border-amber-500/40 opacity-55 hover:opacity-85 shadow-2xl'
                  }`}
                >
                  <img
                    src={movie.poster || movie.posterUrl || '/banner-dune.jpg'}
                    alt={movie.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />

                  <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none z-10" />

                  <div
                    className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-500 pointer-events-none ${
                      isActive
                        ? 'from-black via-black/65 to-transparent opacity-100'
                        : 'from-black/95 via-black/60 to-transparent opacity-90'
                    }`}
                  />

                  {/* Ánh sáng sàn dịu mắt tỏa đều không bị cắt vạch */}
                  {isActive && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-16 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent blur-xl pointer-events-none rounded-full" />
                  )}

                  {/* Huy hiệu độ tuổi trên cùng bên trái: P màu xanh, chuyển dần sang đỏ HOT có ngọn lửa 🔥 */}
                  <div className="absolute top-3.5 left-3.5 z-20">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-black backdrop-blur-md transition-all border shadow ${badge.cls}`}
                    >
                      <span>{badge.age}</span>
                      {badge.isHot && (
                        <span className="flex items-center space-x-0.5 pl-1 border-l border-white/25">
                          <span className="text-xs">🔥</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-yellow-200">HOT</span>
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Huy hiệu Rating cao chuẩn bom tấn trên cùng bên phải */}
                  <div className="absolute top-3.5 right-3.5 z-20">
                    <span className="bg-slate-950/85 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-amber-500/40 text-xs font-bold text-amber-400 flex items-center space-x-1 shadow">
                      <span>★</span>
                      <span className="text-white">{ratingDisplay}</span>
                    </span>
                  </div>

                  {/* Thông tin phim theo bố cục chuẩn: Thể loại -> Tên phim -> Mô tả (bỏ tên tác giả) */}
                  <div className="absolute bottom-5 inset-x-3.5 sm:inset-x-5 text-center z-10">
                    {/* 1. Thể loại phim (ở trên tên phim giống ảnh chụp) */}
                    <div className="text-xs text-slate-400 font-medium tracking-wide mb-1 line-clamp-1">
                      {movie.genre || 'Hành động, Phiêu lưu'}
                    </div>

                    {/* 2. Tên phim đầy đủ, nổi bật */}
                    <h3
                      className={`font-black drop-shadow-md mb-1.5 transition-all tracking-tight leading-snug px-1 flex items-center justify-center text-center min-h-[44px] sm:min-h-[50px] ${
                        isActive
                          ? 'text-lg sm:text-2xl text-white'
                          : 'text-base sm:text-xl text-slate-200'
                      }`}
                    >
                      {movie.title}
                    </h3>

                    {/* 3. Tóm tắt nội dung phim (ở dưới tên phim giống ảnh chụp) */}
                    <p
                      className={`text-xs leading-relaxed mb-4 px-2 line-clamp-2 transition-colors ${
                        isActive ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {movie.description || 'Hành trình điện ảnh kịch tính và hấp dẫn trên màn ảnh rộng.'}
                    </p>

                    <Link
                      to={`/movie/${movie.slug || movie.id}`}
                      className={`w-full inline-flex items-center justify-center space-x-2 font-black py-2.5 sm:py-3 px-6 rounded-full text-xs sm:text-sm transition-all cursor-pointer shadow-lg ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 shadow-amber-500/40 hover:scale-[1.03] active:scale-95'
                          : 'bg-[#1b2234] hover:bg-amber-500 text-slate-200 hover:text-slate-950 border border-slate-700/80 hover:border-amber-400'
                      }`}
                    >
                      <span className="text-sm">▶</span>
                      <span>Đặt vé ngay</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vé CINEMA TICKET & Bỏng Ngô góc dưới bên phải */}
          <div className="absolute right-6 bottom-4 hidden lg:flex items-center space-x-3.5 pointer-events-none select-none z-20">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-amber-400/30 rounded-full blur-md" />
              <span className="text-3xl filter drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] transform hover:scale-110 transition-transform">
                🍿
              </span>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-xl blur-sm opacity-80 animate-pulse" />
              <div className="relative bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 px-4 py-1.5 rounded-lg font-black text-xs tracking-wider uppercase shadow-[0_0_22px_rgba(251,191,36,0.85)] border-2 border-dashed border-slate-950/60 flex items-center space-x-2">
                <span>🎟️</span>
                <span>CINEMA TICKET</span>
                <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.9)] animate-ping" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. NỘI DUNG TAB PHIM SẮP CHIẾU: CUỘN NGANG MƯỢT MÀ CHO CẢ 15 PHIM (KHÔNG CÓ DẤU MŨI TÊN)
          TỰ ĐỘNG CẬP NHẬT THÁNG KHỞI CHIẾU KHI CUỘN QUA TỪNG PHIM */}
      {activeTab === 'COMING_SOON' && all15ComingSoonMovies.length > 0 && (
        <div className="mt-8 relative w-full overflow-hidden rounded-3xl bg-gradient-to-b from-[#18130e]/95 via-[#0d121c] to-[#080c14] border border-amber-500/25 p-4 sm:p-8 lg:p-12 shadow-2xl">
          {/* Ánh sáng sân khấu vàng kim ấm áp lộng lẫy */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-gradient-to-b from-amber-500/25 via-amber-500/8 to-transparent blur-3xl pointer-events-none rounded-full" />

          {/* Tiêu đề Cành Nguyệt Quế Hoàng Gia - Đã fix chữ 'g' hiện đầy đủ */}
          <div className="text-center mb-4 sm:mb-6 relative z-10">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3">
              <LaurelLeft />
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-normal font-sans bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_2px_14px_rgba(251,191,36,0.5)] pt-1 pb-4 leading-normal inline-block">
                Phim Sắp Chiếu
              </h2>
              <LaurelRight />
            </div>
            <p className="mt-1 text-xs sm:text-sm text-amber-200/80 font-medium tracking-wide">
              Cuộn lướt xem toàn bộ 15 bom tấn sắp ra mắt (Tháng 12/2026 – Tháng 04/2027)
            </p>
          </div>

          {/* VÒNG LẶP VÔ TẬN LIỀN MẠCH (KHÔNG BAO GIỜ BỊ NGẮT QUÃNG HOẶC ĐỨNG LẠI Ở CUỐI) */}
          <div
            ref={reelScrollRef}
            onScroll={handleReelScroll}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
            className="relative z-10 w-full overflow-x-auto scrollbar-none flex items-center gap-6 sm:gap-7 pt-10 sm:pt-14 pb-16 px-4 sm:px-8 cursor-grab active:cursor-grabbing select-none"
          >
            {loopedMovies.map((movie, idx) => {
              const isActive = comingSoonVirtualIndex === idx;
              const distance = Math.abs(idx - comingSoonVirtualIndex);
              const badge = getAgeHotBadge(movie);
              const ratingDisplay = getRatingDisplay(movie);

              return (
                <div
                  key={`${movie.slug || movie.id || idx}-loop-${idx}`}
                  ref={(el) => (cardRefs.current[idx] = el)}
                  onClick={() => handleCardClick(idx)}
                  className={`relative w-[280px] sm:w-[320px] md:w-[340px] shrink-0 aspect-[1/1.45] rounded-3xl overflow-hidden transition-[transform,opacity,box-shadow,border-color] duration-300 ease-out select-none ${
                    isActive
                      ? 'scale-100 md:scale-105 -translate-y-2 md:-translate-y-4 z-30 shadow-[0_12px_45px_rgba(245,158,11,0.45),inset_0_0_20px_rgba(245,158,11,0.15)] ring-4 ring-amber-400/50 border-2 border-amber-400 opacity-100 cursor-default'
                      : distance === 1
                      ? 'scale-95 translate-y-0 z-20 border border-slate-700/80 hover:border-amber-400/60 opacity-75 hover:opacity-100 shadow-xl cursor-pointer'
                      : 'scale-90 translate-y-1 z-10 border border-slate-800 hover:border-slate-700 opacity-40 hover:opacity-75 shadow-lg cursor-pointer'
                  }`}
                >
                  <img
                    src={movie.poster || movie.posterUrl || '/banner-dune.jpg'}
                    alt={movie.title}
                    draggable={false}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                  />

                  <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none z-10" />

                  <div
                    className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-500 pointer-events-none ${
                      isActive
                        ? 'from-black via-black/65 to-transparent opacity-100'
                        : 'from-black/95 via-black/60 to-transparent opacity-90'
                    }`}
                  />

                  {/* Ánh sáng sàn dịu mắt tỏa đều không bị cắt vạch */}
                  {isActive && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-16 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent blur-xl pointer-events-none rounded-full" />
                  )}

                  {/* Huy hiệu độ tuổi góc trên bên trái: P màu xanh, chuyển dần sang đỏ HOT ngọn lửa 🔥 */}
                  <div className="absolute top-3.5 left-3.5 z-20">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-black backdrop-blur-md transition-all border shadow ${badge.cls}`}
                    >
                      <span>{badge.age}</span>
                      {badge.isHot && (
                        <span className="flex items-center space-x-0.5 pl-1 border-l border-white/25">
                          <span className="text-xs">🔥</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-yellow-200">HOT</span>
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Huy hiệu Rating cao góc trên bên phải */}
                  <div className="absolute top-3.5 right-3.5 z-20">
                    <span className="bg-slate-950/85 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-amber-500/40 text-xs font-bold text-amber-400 flex items-center space-x-1 shadow">
                      <span>★</span>
                      <span className="text-white">{ratingDisplay}</span>
                    </span>
                  </div>

                  {/* Thông tin phim theo bố cục chuẩn: Thể loại -> Tên phim -> Mô tả (bỏ tên tác giả) */}
                  <div className="absolute bottom-5 inset-x-3.5 sm:inset-x-5 text-center z-10">
                    {/* 1. Thể loại phim (ở trên tên phim giống ảnh chụp) */}
                    <div className="text-xs text-slate-400 font-medium tracking-wide mb-1 line-clamp-1">
                      {movie.genre || 'Hành động, Phiêu lưu'}
                    </div>

                    {/* 2. Tên phim đầy đủ, nổi bật */}
                    <h3
                      className={`font-black drop-shadow-md mb-1.5 transition-all tracking-tight leading-snug px-1 flex items-center justify-center text-center min-h-[44px] sm:min-h-[50px] ${
                        isActive
                          ? 'text-lg sm:text-2xl text-white'
                          : 'text-base sm:text-xl text-slate-200'
                      }`}
                    >
                      {movie.title}
                    </h3>

                    {/* 3. Tóm tắt nội dung phim (ở dưới tên phim giống ảnh chụp) */}
                    <p
                      className={`text-xs leading-relaxed mb-4 px-2 line-clamp-2 transition-colors ${
                        isActive ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {movie.description || 'Hành trình điện ảnh kịch tính và hấp dẫn trên màn ảnh rộng.'}
                    </p>

                    {/* Nút Đặt Vé: Nếu đang ở chính giữa thì click chuyển trang đặt vé, nếu ở 2 bên thì click kéo phim về giữa */}
                    {isActive ? (
                      <Link
                        to={`/movie/${movie.slug || movie.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full inline-flex items-center justify-center space-x-2 font-black py-2.5 sm:py-3 px-6 rounded-full text-xs sm:text-sm transition-all cursor-pointer shadow-lg bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 shadow-amber-500/40 hover:scale-[1.03] active:scale-95"
                      >
                        <span className="text-sm">▶</span>
                        <span>Đặt trước vé</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          scrollToMovie(idx, true);
                        }}
                        className="w-full inline-flex items-center justify-center space-x-2 font-black py-2.5 sm:py-3 px-6 rounded-full text-xs sm:text-sm transition-all cursor-pointer shadow-lg bg-[#1b2234] hover:bg-amber-500 text-slate-200 hover:text-slate-950 border border-slate-700/80 hover:border-amber-400"
                      >
                        <span className="text-sm">▶</span>
                        <span>Đặt trước vé</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* DÒNG THÔNG BÁO LỊCH CHIẾU NHỎ GỌN TỰ ĐỘNG CẬP NHẬT THEO PHIM ĐANG CUỘN */}
          <div className="mt-4 text-center relative z-20">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-amber-500/35 text-amber-300 text-xs font-medium shadow-md">
              <span className="text-amber-400">📅</span>
              <span className="text-slate-400">Lịch khởi chiếu:</span>
              <span className="text-amber-300 font-bold">
                {getMovieReleaseMonth(activeComingSoonMovie)}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Phim {comingSoonRealIndex + 1}/15:</span>
              <span className="text-white font-bold truncate max-w-[180px] sm:max-w-none">
                {activeComingSoonMovie?.title}
              </span>
            </div>

            {/* Hàng 15 chấm tròn / viên thuốc biểu thị vòng tròn vô tận - Click chấm nào phim đó xoay về giữa */}
            <div className="flex items-center justify-center space-x-1.5 mt-3">
              {all15ComingSoonMovies.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDotClick(i)}
                  title={`Phim ${i + 1}: ${m?.title} (${getMovieReleaseMonth(m)})`}
                  className={`transition-all duration-300 cursor-pointer rounded-full ${
                    comingSoonRealIndex === i
                      ? 'w-7 h-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                      : 'w-1.5 h-1.5 bg-slate-700/80 hover:bg-amber-400/60'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Vé COMING SOON & Bỏng Ngô góc dưới bên phải */}
          <div className="absolute right-6 bottom-4 hidden lg:flex items-center space-x-3.5 pointer-events-none select-none z-20">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-amber-400/30 rounded-full blur-md" />
              <span className="text-3xl filter drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] transform hover:scale-110 transition-transform">
                🍿
              </span>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-xl blur-sm opacity-80 animate-pulse" />
              <div className="relative bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 px-4 py-1.5 rounded-lg font-black text-xs tracking-wider uppercase shadow-[0_0_22px_rgba(251,191,36,0.85)] border-2 border-dashed border-slate-950/60 flex items-center space-x-2">
                <span>🎟️</span>
                <span>COMING SOON</span>
                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-ping" />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HomeMovieTabs;
