import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Biểu tượng Cành Nguyệt Quế Hoàng Gia sang trọng (Laurel Wreath)
const LaurelLeft = () => (
  <svg
    className="w-6 h-6 sm:w-8 sm:h-8 text-[#42DFFF]/95 inline-block drop-shadow-[0_0_10px_rgba(66,223,255,0.7)]"
    viewBox="0 0 32 32"
    fill="currentColor"
  >
    <path d="M12.5 4c-.3 1.8-.9 3.5-1.8 5-1.5 2.5-3.8 4.3-6.5 5.2 2.6.8 4.9 2.4 6.3 4.8 1.1 1.8 1.8 3.8 2 6 .9-1.9 1.4-4 1.4-6.2 0-2.4-.6-4.6-1.7-6.6 1.4-2.1 2.1-4.6 2-7.1-.6-.4-1.2-.8-1.7-1.1z" />
    <path d="M7 11.5c-1.1 1.6-2.6 2.8-4.4 3.5 1.7.6 3.2 1.7 4.2 3.2.7-1.2 1.2-2.5 1.4-3.9-.2-1-.6-1.9-1.2-2.8z" />
  </svg>
);

const LaurelRight = () => (
  <svg
    className="w-6 h-6 sm:w-8 sm:h-8 text-[#42DFFF]/95 inline-block -scale-x-100 drop-shadow-[0_0_10px_rgba(66,223,255,0.7)]"
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

  // Vòng lặp vô tận (Infinite Seamless Loop): Bắt đầu ở Set 1 (vị trí Joker: Folie à Deux, index 22) ở chính giữa
  const [comingSoonVirtualIndex, setComingSoonVirtualIndex] = useState(22);
  const comingSoonVirtualIndexRef = useRef(22);
  comingSoonVirtualIndexRef.current = comingSoonVirtualIndex;

  // Ref section và cờ khóa lăn chuột (throttle) để lăn chuột êm ái từng phim
  const comingSoonSectionRef = useRef(null);
  const isWheelLockedRef = useRef(false);
  const wheelLockTimerRef = useRef(null);
  const scrollAnimIdRef = useRef(null);
  const scrollMidTimerRef = useRef(null);

  // Ref container cuộn ngang và ref từng thẻ phim
  const reelScrollRef = useRef(null);
  const cardRefs = useRef([]);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftPos, setScrollLeftPos] = useState(0);
  const isDragMoved = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimerRef = useRef(null);
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

  // Animation cuộn mượt mà 60-120fps bằng RequestAnimationFrame (mượt mà, lướt êm, không gián đoạn)
  const animateScrollTo = (targetX, duration = 380, onMidpoint = null) => {
    const container = reelScrollRef.current;
    if (!container) return;
    if (scrollAnimIdRef.current) cancelAnimationFrame(scrollAnimIdRef.current);
    if (scrollMidTimerRef.current) clearTimeout(scrollMidTimerRef.current);

    const startX = container.scrollLeft;
    const distance = targetX - startX;
    if (Math.abs(distance) < 1) {
      container.scrollLeft = targetX;
      isAutoScrollingRef.current = false;
      if (onMidpoint) onMidpoint();
      return;
    }

    const startTime = performance.now();
    isAutoScrollingRef.current = true;

    // Kích hoạt đổi tâm phim đồng bộ khi thẻ trượt được 75% quãng đường vào giữa
    if (onMidpoint) {
      scrollMidTimerRef.current = setTimeout(() => {
        onMidpoint();
      }, 130);
    }

    // Easing cubic: Lướt nhanh ban đầu và hãm phanh êm ái khi về đích
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeOutCubic(progress);

      container.scrollLeft = startX + distance * ease;

      if (progress < 1) {
        scrollAnimIdRef.current = requestAnimationFrame(step);
      } else {
        container.scrollLeft = targetX;
        isAutoScrollingRef.current = false;
        checkBoundaryReset();
      }
    };

    scrollAnimIdRef.current = requestAnimationFrame(step);
  };

  // Đưa bộ phim mục tiêu về CHÍNH GIỮA màn hình chuẩn xác theo toạ độ tuyệt đối
  const scrollToMovie = (virtualIdx, smooth = true) => {
    if (virtualIdx < 0 || virtualIdx >= loopedMovies.length) return;
    comingSoonVirtualIndexRef.current = virtualIdx;

    const container = reelScrollRef.current;
    const card = cardRefs.current[virtualIdx];
    if (container && card) {
      const containerWidth = container.clientWidth;
      const cardOffsetLeft = card.offsetLeft;
      const cardWidth = card.offsetWidth;
      const targetScrollLeft = cardOffsetLeft - (containerWidth / 2) + (cardWidth / 2);

      if (smooth) {
        animateScrollTo(Math.max(0, targetScrollLeft), 380, () => {
          setComingSoonVirtualIndex(virtualIdx);
        });
      } else {
        if (scrollAnimIdRef.current) cancelAnimationFrame(scrollAnimIdRef.current);
        if (scrollMidTimerRef.current) clearTimeout(scrollMidTimerRef.current);
        setComingSoonVirtualIndex(virtualIdx);
        container.scrollLeft = Math.max(0, targetScrollLeft);
        isAutoScrollingRef.current = false;
      }
    }
  };

  // Căn giữa tĩnh bộ phim Joker ban đầu khi mở tab hoặc tải dữ liệu
  useEffect(() => {
    if (activeTab === 'COMING_SOON' && reelScrollRef.current) {
      const timer = setTimeout(() => {
        const container = reelScrollRef.current;
        const targetIdx = comingSoonVirtualIndexRef.current ?? 22;
        const card = cardRefs.current[targetIdx];
        if (container && card) {
          const containerWidth = container.clientWidth;
          const cardOffsetLeft = card.offsetLeft;
          const cardWidth = card.offsetWidth;
          const targetScrollLeft = cardOffsetLeft - (containerWidth / 2) + (cardWidth / 2);
          container.scrollLeft = Math.max(0, targetScrollLeft);
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeTab, all15ComingSoonMovies.length]);

  // Tự động căn đối chính giữa khi người dùng đổi kích thước cửa sổ
  useEffect(() => {
    const handleResize = () => {
      const container = reelScrollRef.current;
      const targetIdx = comingSoonVirtualIndexRef.current;
      const card = cardRefs.current[targetIdx];
      if (container && card) {
        const containerWidth = container.clientWidth;
        const cardOffsetLeft = card.offsetLeft;
        const cardWidth = card.offsetWidth;
        const targetScrollLeft = cardOffsetLeft - (containerWidth / 2) + (cardWidth / 2);
        container.scrollLeft = Math.max(0, targetScrollLeft);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (scrollAnimIdRef.current) cancelAnimationFrame(scrollAnimIdRef.current);
      if (scrollMidTimerRef.current) clearTimeout(scrollMidTimerRef.current);
    };
  }, []);

  // Khử hoàn toàn lỗi lướt nhanh: Chỉ reset biên cực xa và thực hiện tức thời 0ms, không animation
  const checkBoundaryReset = () => {
    if (isDragging || isAutoScrollingRef.current) return;
    const container = reelScrollRef.current;
    if (!container || all15ComingSoonMovies.length === 0) return;

    const currentIdx = comingSoonVirtualIndexRef.current;
    // Khi người dùng lướt qua cực biên xa Set 2 (từ card 36 trở đi)
    if (currentIdx >= 36) {
      const resetIdx = currentIdx - 15;
      scrollToMovie(resetIdx, false);
    }
    // Khi người dùng lướt lùi qua cực biên xa Set 0 (trước card 9)
    else if (currentIdx < 9) {
      const resetIdx = currentIdx + 15;
      scrollToMovie(resetIdx, false);
    }
  };

  // Hỗ trợ cuộn chuột lăn: Lăn chuột sẽ chuyển mượt qua bộ phim khác và căn bộ phim đó ở CHÍNH GIỮA
  useEffect(() => {
    const sectionEl = comingSoonSectionRef.current;
    const reelEl = reelScrollRef.current;
    const targetEl = sectionEl || reelEl;
    if (!targetEl || activeTab !== 'COMING_SOON') return;

    const onWheel = (e) => {
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      // Bỏ qua các rung lắc chuột quá nhỏ
      if (Math.abs(delta) < 8) return;

      // Chặn cuộn trang ngoài khi đang lăn chuột xem phim
      e.preventDefault();

      if (isWheelLockedRef.current) return;
      isWheelLockedRef.current = true;
      if (wheelLockTimerRef.current) clearTimeout(wheelLockTimerRef.current);
      wheelLockTimerRef.current = setTimeout(() => {
        isWheelLockedRef.current = false;
      }, 230);

      const direction = delta > 0 ? 1 : -1;
      let nextIdx = comingSoonVirtualIndexRef.current + direction;

      if (nextIdx < 0) nextIdx = 0;
      if (nextIdx >= loopedMovies.length) nextIdx = loopedMovies.length - 1;

      scrollToMovie(nextIdx, true);
    };

    targetEl.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      targetEl.removeEventListener('wheel', onWheel);
      if (wheelLockTimerRef.current) clearTimeout(wheelLockTimerRef.current);
    };
  }, [activeTab, loopedMovies.length]);

  // Xử lý kéo thả chuột chuẩn 1:1 bám sát bàn tay người dùng, thả ra là dừng ngay
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
      checkBoundaryReset();
      // Nếu người dùng vừa kéo chuột và buông tay: Căn nhẹ phim gần tâm nhất vào chính giữa cho cân đối
      if (isDragMoved.current) {
        isDragMoved.current = false;
        const container = reelScrollRef.current;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const containerCenter = containerRect.left + containerRect.width / 2;
          let closestIdx = comingSoonVirtualIndex;
          let minDistance = Infinity;

          cardRefs.current.forEach((card, idx) => {
            if (!card) return;
            const cardRect = card.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const dist = Math.abs(containerCenter - cardCenter);
            if (dist < minDistance) {
              minDistance = dist;
              closestIdx = idx;
            }
          });

          scrollToMovie(closestIdx, true);
        }
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

  // Cập nhật thông tin phim ở giữa khi người dùng tự do lướt theo toạ độ thực tế màn hình
  const handleReelScroll = () => {
    if (!reelScrollRef.current || loopedMovies.length === 0) return;
    // Nếu đang trong quá trình animation cuộn mượt tự động thì không can thiệp để tránh xung đột gây nháy
    if (isAutoScrollingRef.current) return;

    const container = reelScrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    let closestIndex = comingSoonVirtualIndex;
    let minDistance = Infinity;

    cardRefs.current.forEach((card, idx) => {
      if (!card) return;
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(containerCenter - cardCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = idx;
      }
    });

    if (closestIndex !== comingSoonVirtualIndex) {
      setComingSoonVirtualIndex(closestIndex);
    }

    checkBoundaryReset();
  };

  const handleCardClick = (idx) => {
    if (isDragMoved.current) {
      isDragMoved.current = false;
      return;
    }
    // Khi click vào phim: đưa phim đó về chính giữa
    scrollToMovie(idx, true);
  };

  // Xử lý click vào 15 chấm tròn chọn phim: Luôn nhắm vào chu kỳ Set 1 để phim luôn có đủ 2 bên đối xứng
  const handleDotClick = (targetRealIdx) => {
    const targetVirtualIdx = targetRealIdx + 15;
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
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-[#AA9BFF]/25">
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto scrollbar-none w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('NOW_SHOWING')}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'NOW_SHOWING'
                ? 'bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] shadow-[0_0_16px_rgba(168,85,247,0.35),0_0_24px_rgba(66,223,255,0.20)] ring-1 ring-[#83F5FF]/60'
                : 'bg-[#11152F] text-[#BEC5E5] hover:text-[#F8F7FF] hover:bg-[#20204B] border border-[#AA9BFF]/25'
            }`}
          >
            🎬 Phim Đang Chiếu ({nowShowingMovies.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMING_SOON')}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'COMING_SOON'
                ? 'bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] shadow-[0_0_16px_rgba(168,85,247,0.35),0_0_24px_rgba(66,223,255,0.20)] ring-1 ring-[#83F5FF]/60'
                : 'bg-[#11152F] text-[#BEC5E5] hover:text-[#F8F7FF] hover:bg-[#20204B] border border-[#AA9BFF]/25'
            }`}
          >
            🍿 Phim Sắp Chiếu ({all15ComingSoonMovies.length || comingSoonMovies.length})
          </button>
        </div>
      </div>

      {/* 1. NỘI DUNG TAB PHIM ĐANG CHIẾU: SÂN KHẤU 3 PHIM ĐẲNG CẤP (TỐI ƯU CHIỀU CAO & CÂN ĐỐI 10/10) */}
      {activeTab === 'NOW_SHOWING' && nowShowingMovies.length > 0 && (
        <div className="mt-6 relative w-full overflow-hidden rounded-3xl bg-gradient-to-b from-[#20204B]/95 via-[#11152F] to-[#0B1026] border border-[#AA9BFF]/30 p-3.5 sm:p-5 lg:p-6 shadow-[0_12px_45px_rgba(11,16,38,0.95)]">
          {/* Ánh sáng sân khấu neon tím cyan lộng lẫy */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[320px] bg-gradient-to-b from-[#A855F7]/20 via-[#42DFFF]/15 to-transparent blur-3xl pointer-events-none rounded-full" />

          {/* Tiêu đề Cành Nguyệt Quế Hoàng Gia */}
          <div className="text-center mb-3 sm:mb-4 relative z-10">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3">
              <LaurelLeft />
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-normal font-sans bg-gradient-to-r from-[#FFFFFF] via-[#F4A5FF] via-[#C56BFF] to-[#E9B5FF] bg-clip-text text-transparent [filter:drop-shadow(0_0_14px_rgba(204,130,255,0.45))] pt-0 pb-1 leading-normal inline-block">
                Phim Đang Chiếu
              </h2>
              <LaurelRight />
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-[#E9B5FF] font-medium tracking-wide">
              Khám phá những bộ phim hot nhất đang có tại D'AVENOR Cinema
            </p>
          </div>

          {/* 3 BỘ PHIM ĐANG CHIẾU SONG SONG - CÂN ĐỐI HOÀN HẢO */}
          <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-5 lg:gap-6 pt-2 sm:pt-3 pb-5 sm:pb-6">
            {nowShowingMovies.slice(0, 3).map((movie, idx) => {
              const isActive = activeNowShowingIndex === idx;
              const badge = getAgeHotBadge(movie);
              const ratingDisplay = getRatingDisplay(movie);

              return (
                <div
                  key={movie.id || movie._id || idx}
                  onMouseEnter={() => setActiveNowShowingIndex(idx)}
                  onClick={() => setActiveNowShowingIndex(idx)}
                  className={`relative w-full max-w-[315px] sm:max-w-[335px] md:max-w-[350px] aspect-[1/1.45] rounded-3xl overflow-hidden transition-all duration-500 ease-out cursor-pointer group ${
                    isActive
                      ? 'scale-100 md:scale-105 -translate-y-1.5 md:-translate-y-3 z-20 ring-2 ring-[#72E8FF]/70 border-2 border-[#B4F7FF] shadow-[0_0_28px_rgba(114,232,255,0.30),0_0_16px_rgba(233,181,255,0.25)] opacity-100'
                      : 'scale-95 translate-y-0 z-10 border border-[#AA9BFF]/35 hover:border-[#72E8FF]/60 opacity-80 hover:opacity-95 shadow-xl'
                  }`}
                >
                  <img
                    src={movie.poster || movie.posterUrl || '/banner-dune.jpg'}
                    alt={movie.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />

                  <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-[#0B1026]/90 via-[#0B1026]/40 to-transparent pointer-events-none z-10" />

                  <div
                    className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-500 pointer-events-none ${
                      isActive
                        ? 'from-[#0B1026] via-[#0B1026]/75 to-transparent opacity-100'
                        : 'from-[#0B1026]/95 via-[#0B1026]/50 to-transparent opacity-85'
                    }`}
                  />

                  {/* Ánh sáng sàn cyan dịu mắt tỏa đều */}
                  {isActive && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-16 bg-gradient-to-r from-transparent via-[#42DFFF]/35 to-transparent blur-xl pointer-events-none rounded-full" />
                  )}

                  {/* Huy hiệu độ tuổi */}
                  <div className="absolute top-3.5 left-3.5 z-20">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-black backdrop-blur-md transition-all border shadow ${badge.cls}`}
                    >
                      <span>{badge.age}</span>
                      {badge.isHot && (
                        <span className="flex items-center space-x-0.5 pl-1 border-l border-white/25">
                          <span className="text-xs">🔥</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-pink-200">HOT</span>
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Huy hiệu Rating cao chuẩn bom tấn */}
                  <div className="absolute top-3.5 right-3.5 z-20">
                    <span className="bg-[#0B1026]/90 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-[#42DFFF]/40 text-xs font-bold text-[#42DFFF] flex items-center space-x-1 shadow">
                      <span>★</span>
                      <span className="text-white">{ratingDisplay}</span>
                    </span>
                  </div>

                  {/* Thông tin phim */}
                  <div className="absolute bottom-3.5 sm:bottom-4 inset-x-3 sm:inset-x-4 text-center z-10">
                    <div className={`text-[11px] sm:text-xs font-medium tracking-wide mb-0.5 line-clamp-1 ${isActive ? 'text-[#E9B5FF]' : 'text-[#E9B5FF]/90'}`}>
                      {movie.genre || 'Hành động, Phiêu lưu'}
                    </div>

                    <h3
                      className={`font-black drop-shadow-md mb-1 transition-all tracking-tight leading-snug px-1 flex items-center justify-center text-center min-h-[38px] sm:min-h-[44px] ${
                        isActive
                          ? 'text-base sm:text-xl text-[#FFFFFF]'
                          : 'text-sm sm:text-lg text-[#F8F7FF]/90'
                      }`}
                    >
                      {movie.title}
                    </h3>

                    <p
                      className={`text-[11px] sm:text-xs leading-relaxed mb-2.5 sm:mb-3 px-1 line-clamp-2 transition-colors ${
                        isActive ? 'text-[#E9B5FF]' : 'text-[#BEC5E5]/90'
                      }`}
                    >
                      {movie.description || 'Hành trình điện ảnh kịch tính và hấp dẫn trên màn ảnh rộng.'}
                    </p>

                    <Link
                      to={`/movie/${movie.slug || movie.id}`}
                      className={`w-full inline-flex items-center justify-center space-x-2 font-black py-2 sm:py-2.5 px-5 rounded-full text-xs transition-all cursor-pointer shadow-lg ${
                        isActive
                          ? 'bg-gradient-to-r from-[#F9B8FF] via-[#D99BFF] via-[#86DEFF] to-[#B4F7FF] hover:brightness-108 text-[#0B1026] shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)] hover:scale-[1.03] active:scale-95'
                          : 'bg-[#171936]/90 hover:bg-[#20204B] text-[#E9B5FF] hover:text-white border border-[#AA9BFF]/35 hover:border-[#72E8FF]'
                      }`}
                    >
                      <span className="text-xs">▶</span>
                      <span>Đặt vé ngay</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vé CINEMA TICKET & Bỏng Ngô góc dưới bên phải */}
          <div className="absolute right-5 bottom-3.5 hidden lg:flex items-center space-x-3 pointer-events-none select-none z-20">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-[#A855F7]/30 rounded-full blur-md" />
              <span className="text-2xl filter drop-shadow-[0_0_12px_rgba(168,85,247,0.9)] transform hover:scale-110 transition-transform">
                🍿
              </span>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] rounded-xl blur-sm opacity-80 animate-pulse" />
              <div className="relative bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] px-3.5 py-1.5 rounded-lg font-black text-[11px] tracking-wider uppercase shadow-[0_0_22px_rgba(168,85,247,0.85)] border-2 border-dashed border-[#0B1026]/60 flex items-center space-x-1.5">
                <span>🎟️</span>
                <span>CINEMA TICKET</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(66,223,255,0.9)] animate-ping" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. NỘI DUNG TAB PHIM SẮP CHIẾU (TỐI ƯU CHIỀU CAO & CÂN ĐỐI 10/10) */}
      {activeTab === 'COMING_SOON' && all15ComingSoonMovies.length > 0 && (
        <div
          ref={comingSoonSectionRef}
          className="mt-6 relative w-full overflow-hidden rounded-3xl bg-gradient-to-b from-[#20204B]/95 via-[#11152F] to-[#0B1026] border border-[#AA9BFF]/30 p-3.5 sm:p-5 lg:p-6 shadow-[0_12px_45px_rgba(11,16,38,0.95)]"
        >
          {/* Ánh sáng sân khấu neon */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[320px] bg-gradient-to-b from-[#A855F7]/20 via-[#42DFFF]/15 to-transparent blur-3xl pointer-events-none rounded-full" />

          {/* Tiêu đề Cành Nguyệt Quế */}
          <div className="text-center mb-3 sm:mb-4 relative z-10">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3">
              <LaurelLeft />
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-normal font-sans bg-gradient-to-r from-[#F4A5FF] via-[#C56BFF] via-[#83F5FF] to-[#F4A5FF] bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(168,85,247,0.45)] pt-0 pb-1 leading-normal inline-block">
                Phim Sắp Chiếu
              </h2>
              <LaurelRight />
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-[#BEC5E5] font-medium tracking-wide">
              Cuộn lướt xem toàn bộ 15 bom tấn sắp ra mắt (Tháng 12/2026 – Tháng 04/2027)
            </p>
          </div>

          {/* VÒNG LẶP VÔ TẬN LIỀN MẠCH */}
          <div
            ref={reelScrollRef}
            onScroll={handleReelScroll}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
            className="relative z-10 w-full overflow-x-auto scrollbar-none flex items-center gap-5 sm:gap-6 pt-5 sm:pt-7 pb-8 px-4 sm:px-8 cursor-grab active:cursor-grabbing select-none"
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
                  className={`relative w-[265px] sm:w-[295px] md:w-[315px] shrink-0 aspect-[1/1.45] rounded-3xl overflow-hidden transition-[transform,opacity,box-shadow,border-color] duration-300 ease-out select-none ${
                    isActive
                      ? 'scale-105 z-30 shadow-[0_12px_45px_rgba(168,85,247,0.4),inset_0_0_20px_rgba(66,223,255,0.2)] ring-4 ring-[#42DFFF]/50 border-2 border-[#83F5FF] opacity-100 cursor-default'
                      : distance === 1
                      ? 'scale-95 z-20 border-2 border-[#AA9BFF]/30 hover:border-[#42DFFF]/60 opacity-75 hover:opacity-100 shadow-xl cursor-pointer'
                      : 'scale-90 z-10 border-2 border-[#AA9BFF]/15 hover:border-[#AA9BFF]/30 opacity-40 hover:opacity-75 shadow-lg cursor-pointer'
                  }`}
                >
                  <img
                    src={movie.poster || movie.posterUrl || '/banner-dune.jpg'}
                    alt={movie.title}
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none"
                  />

                  <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-[#0B1026]/90 via-[#0B1026]/40 to-transparent pointer-events-none z-10" />

                  <div
                    className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-300 pointer-events-none ${
                      isActive
                        ? 'from-[#0B1026] via-[#0B1026]/75 to-transparent opacity-100'
                        : 'from-[#0B1026]/95 via-[#0B1026]/65 to-transparent opacity-90'
                    }`}
                  />

                  {/* Ánh sáng sàn cyan */}
                  <div
                    className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-16 bg-gradient-to-r from-transparent via-[#42DFFF]/35 to-transparent blur-xl pointer-events-none rounded-full transition-opacity duration-300 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />

                  {/* Huy hiệu độ tuổi */}
                  <div className="absolute top-3.5 left-3.5 z-20">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-black backdrop-blur-md transition-all border shadow ${badge.cls}`}
                    >
                      <span>{badge.age}</span>
                      {badge.isHot && (
                        <span className="flex items-center space-x-0.5 pl-1 border-l border-white/25">
                          <span className="text-xs">🔥</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-pink-200">HOT</span>
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Huy hiệu Rating */}
                  <div className="absolute top-3.5 right-3.5 z-20">
                    <span className="bg-[#0B1026]/90 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-[#42DFFF]/40 text-xs font-bold text-[#42DFFF] flex items-center space-x-1 shadow">
                      <span>★</span>
                      <span className="text-white">{ratingDisplay}</span>
                    </span>
                  </div>

                  {/* Thông tin phim */}
                  <div className="absolute bottom-3.5 sm:bottom-4 inset-x-3 sm:inset-x-4 text-center z-10">
                    <div className="text-[11px] sm:text-xs text-[#BEC5E5] font-medium tracking-wide mb-0.5 line-clamp-1">
                      {movie.genre || 'Hành động, Phiêu lưu'}
                    </div>

                    <h3
                      className={`font-black drop-shadow-md mb-1 tracking-tight leading-snug px-1 flex items-center justify-center text-center min-h-[38px] sm:min-h-[44px] text-sm sm:text-base ${
                        isActive
                          ? 'text-[#F8F7FF]'
                          : 'text-[#BEC5E5]'
                      }`}
                    >
                      {movie.title}
                    </h3>

                    <p
                      className={`text-[11px] sm:text-xs leading-relaxed mb-2.5 sm:mb-3 px-1 line-clamp-2 ${
                        isActive ? 'text-[#BEC5E5]' : 'text-[#BEC5E5]/70'
                      }`}
                    >
                      {movie.description || 'Hành trình điện ảnh kịch tính và hấp dẫn trên màn ảnh rộng.'}
                    </p>

                    {/* Nút Đặt Vé */}
                    <div className="w-full h-[36px] flex items-center justify-center">
                      {isActive ? (
                        <Link
                          to={`/movie/${movie.slug || movie.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full inline-flex items-center justify-center space-x-2 font-black py-2 px-5 rounded-full text-xs transition-all cursor-pointer shadow-lg bg-gradient-to-r from-[#F9B8FF] via-[#D99BFF] via-[#86DEFF] to-[#B4F7FF] hover:brightness-108 text-[#0B1026] shadow-[0_0_8px_rgba(255,255,255,0.25),0_0_20px_rgba(204,130,255,0.35),0_0_30px_rgba(80,220,255,0.22)] hover:scale-[1.03] active:scale-95"
                        >
                          <span className="text-xs">▶</span>
                          <span>Đặt trước vé</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollToMovie(idx, true);
                          }}
                          className="w-full inline-flex items-center justify-center space-x-2 font-black py-2 px-5 rounded-full text-xs transition-all cursor-pointer shadow-lg bg-[#171936]/90 hover:bg-[#20204B] text-[#E9B5FF] hover:text-white border border-[#AA9BFF]/35 hover:border-[#72E8FF]"
                        >
                          <span className="text-xs">▶</span>
                          <span>Đặt trước vé</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DÒNG THÔNG BÁO LỊCH CHIẾU */}
          <div className="mt-2.5 text-center relative z-20">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#0B1026]/90 border border-[#AA9BFF]/35 text-[#F8F7FF] text-xs font-medium shadow-md">
              <span className="text-[#42DFFF]">📅</span>
              <span className="text-[#BEC5E5]">Lịch khởi chiếu:</span>
              <span className="text-[#83F5FF] font-bold">
                {getMovieReleaseMonth(activeComingSoonMovie)}
              </span>
              <span className="text-[#BEC5E5]/40">•</span>
              <span className="text-[#BEC5E5]">Phim {comingSoonRealIndex + 1}/15:</span>
              <span className="text-[#F8F7FF] font-bold truncate max-w-[180px] sm:max-w-none">
                {activeComingSoonMovie?.title}
              </span>
            </div>

            {/* Hàng 15 chấm tròn */}
            <div className="flex items-center justify-center space-x-1.5 mt-2.5">
              {all15ComingSoonMovies.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDotClick(i)}
                  title={`Phim ${i + 1}: ${m?.title} (${getMovieReleaseMonth(m)})`}
                  className={`transition-all duration-300 cursor-pointer rounded-full ${
                    comingSoonRealIndex === i
                      ? 'w-7 h-1.5 bg-gradient-to-r from-[#A855F7] to-[#42DFFF] shadow-[0_0_10px_rgba(66,223,255,0.8)]'
                      : 'w-1.5 h-1.5 bg-[#20204B] hover:bg-[#42DFFF]/60'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Vé COMING SOON & Bỏng Ngô góc dưới bên phải */}
          <div className="absolute right-5 bottom-3.5 hidden lg:flex items-center space-x-3 pointer-events-none select-none z-20">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-[#A855F7]/30 rounded-full blur-md" />
              <span className="text-2xl filter drop-shadow-[0_0_12px_rgba(168,85,247,0.9)] transform hover:scale-110 transition-transform">
                🍿
              </span>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] rounded-xl blur-sm opacity-80 animate-pulse" />
              <div className="relative bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] px-3.5 py-1.5 rounded-lg font-black text-[11px] tracking-wider uppercase shadow-[0_0_22px_rgba(168,85,247,0.85)] border-2 border-dashed border-[#0B1026]/60 flex items-center space-x-1.5">
                <span>🎟️</span>
                <span>COMING SOON</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(66,223,255,0.9)] animate-ping" />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HomeMovieTabs;
