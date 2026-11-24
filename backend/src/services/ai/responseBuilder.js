import { INTENTS, removeVietnameseTones } from './intentService.js';
import { calculateTicketQuote, formatVND } from './pricingService.js';
import { getDailyDealForDate } from './dailyPromotionService.js';
import {
  findContiguousAvailableSeats,
  isValidShowtimeForBooking,
} from './cinemaContextService.js';

/**
 * Tạo đối tượng `movieCard` đơn (giữ nguyên tương thích ngược API Frontend).
 * Trả về `null` nếu suất chiếu không hợp lệ, đã qua giờ chiếu, hết ghế (0 ghế) hoặc thiếu showtimeId thực.
 */
export const buildSafeMovieCard = (showtime, movie, nowDate = new Date()) => {
  if (!showtime || !movie) return null;
  if (!isValidShowtimeForBooking(showtime, movie._id, nowDate)) {
    return null;
  }

  return {
    movieId: movie._id ? String(movie._id) : null,
    title: movie.title,
    ageRating: movie.ageRating || 'P',
    rating: String(movie.rating || 4.8),
    poster: movie.posterUrl || '',
    showtimeId: String(showtime.showtimeId || showtime._id),
    time: showtime.time,
    room: showtime.roomName || 'Phòng chiếu tiêu chuẩn',
    price: showtime.priceFormatted || '',
    format: showtime.format || '2D',
  };
};

const getRoomSortRank = (st = {}) => {
  const label = `${st.format || ''} ${st.roomName || ''} ${st.formatFeature || ''}`.toUpperCase();
  if (label.includes('IMAX')) return 1;
  if (label.includes('DOLBY') || label.includes('2D')) return 2;
  if (label.includes('GOLD')) return 3;
  if (label.includes('3D')) return 4;
  return 5;
};

const getRoomDisplayGroup = (st = {}) => {
  const label = `${st.format || ''} ${st.roomName || ''} ${st.formatFeature || ''}`.toUpperCase();
  if (label.includes('IMAX')) return 'Phòng chiếu IMAX Laser';
  if (label.includes('GOLD')) return 'Phòng chiếu Gold Class';
  if (label.includes('DOLBY') || label.includes('2D')) return 'Phòng chiếu Dolby Atmos';
  return st.roomName || 'Phòng chiếu tiêu chuẩn';
};

const sortShowtimesForDisplay = (slots = []) =>
  [...slots].sort((a, b) => {
    const rankDiff = getRoomSortRank(a) - getRoomSortRank(b);
    if (rankDiff !== 0) return rankDiff;
    return (a.dayMinutes || 0) - (b.dayMinutes || 0);
  });

/**
 * Chọn trọn bộ suất chiếu của ngày mục tiêu (hôm nay / ngày khách hỏi / ngày gần nhất có suất)
 * và liệt kê các ngày sắp tới khác để khách có thể hỏi tiếp theo từng ngày.
 */
const selectDayShowtimesAndOtherDates = (slots = [], entities = {}) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return { daySlots: [], dayLabel: '', otherDates: [] };
  }

  const byDateKey = new Map();
  for (const st of slots) {
    const key = st.dateKey || 'UNKNOWN';
    if (!byDateKey.has(key)) byDateKey.set(key, []);
    byDateKey.get(key).push(st);
  }

  const orderedDateKeys = [...byDateKey.keys()].sort();
  const targetDateKey =
    entities.dateFilter?.dateKey && byDateKey.has(entities.dateFilter.dateKey)
      ? entities.dateFilter.dateKey
      : orderedDateKeys[0];

  const daySlots = sortShowtimesForDisplay(byDateKey.get(targetDateKey) || []);
  const dayLabel = daySlots[0]?.relativeDayLabel || entities.dateFilter?.label || targetDateKey;
  const otherDates = orderedDateKeys
    .filter((k) => k !== targetDateKey)
    .slice(0, 5)
    .map((k) => {
      const sample = byDateKey.get(k)?.[0];
      return sample?.shortDate || k;
    });

  return { daySlots, dayLabel, otherDates };
};

/**
 * Định dạng trọn bộ lịch chiếu & ghế trống theo từng phòng (IMAX Laser -> Dolby Atmos -> Gold Class)
 * và đầy đủ từng khung giờ trong ngày (16:30, 19:30, 22:20...) khớp 100% với trang lịch chiếu.
 */
const formatShowtimesGroupedByRoom = (slots = []) => {
  const ordered = sortShowtimesForDisplay(slots);
  const byRoom = new Map();

  for (const st of ordered) {
    const groupName = getRoomDisplayGroup(st);
    if (!byRoom.has(groupName)) byRoom.set(groupName, []);
    byRoom.get(groupName).push(st);
  }

  const sections = [];
  for (const [groupName, roomSlots] of byRoom.entries()) {
    const slotLines = roomSlots.map((st) => {
      const total = Number(st.totalSeats) > 0 ? st.totalSeats : 88;
      const seatText =
        st.availableSeats > 0
          ? `Còn **${st.availableSeats}/${total}** ghế`
          : `**HẾT GHẾ (0/${total})**`;
      const linkText =
        st.bookingLink && st.availableSeats > 0 ? ` — [Chọn ghế ➔](${st.bookingLink})` : '';
      return `• **${st.time}** — ${st.priceFormatted} | ${seatText}${linkText}`;
    });
    sections.push(`🎬 **${groupName}**\n${slotLines.join('\n')}`);
  }

  return sections.join('\n\n');
};

const formatDisplayFormat = (format = '') => {
  const f = String(format || '').toUpperCase();
  if (f === 'GOLD_CLASS') return 'Gold Class';
  if (f === 'IMAX') return 'IMAX';
  if (f === '3D') return '3D';
  if (f === '2D') return 'Dolby Atmos';
  return format || '2D';
};

const summarizeMovieSlotsCompact = (slots = []) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return 'Chưa có suất chiếu mở bán';
  }
  const orderedByTime = [...slots].sort((a, b) => (a.dayMinutes || 0) - (b.dayMinutes || 0));
  const distinctTimes = [...new Set(orderedByTime.map((s) => s.time).filter(Boolean))];
  const minPrice = Math.min(...orderedByTime.map((s) => Number(s.priceStandard || s.price || 0)).filter((p) => p > 0));
  const formats = [...new Set(sortShowtimesForDisplay(slots).map((s) => formatDisplayFormat(s.format)))];
  const priceText = Number.isFinite(minPrice) && minPrice > 0 ? ` • Giá từ **${formatVND(minPrice)}**` : '';
  const formatText = formats.length > 0 ? ` (${formats.join(' / ')})` : '';
  return `Khung giờ: ${distinctTimes.map((t) => `**${t}**`).join(', ')}${priceText}${formatText}`;
};

const pickRepresentativeSlotsForMultiCard = (validSlots = [], maxCount = 4) => {
  const byTimeFirst = [...validSlots].sort((a, b) => {
    const tDiff = (a.dayMinutes || 0) - (b.dayMinutes || 0);
    if (tDiff !== 0) return tDiff;
    return getRoomSortRank(a) - getRoomSortRank(b);
  });
  const picked = [];
  const seenTimes = new Set();
  for (const st of byTimeFirst) {
    if (!seenTimes.has(st.time) && picked.length < maxCount) {
      seenTimes.add(st.time);
      picked.push(st);
    }
  }
  for (const st of byTimeFirst) {
    if (picked.length >= maxCount) break;
    if (!picked.includes(st)) picked.push(st);
  }
  return picked;
};

/**
 * Tạo danh sách thẻ phim tương tác (`movieCards`) cho nhiều phim / nhiều suất chiếu cùng lúc,
 * giúp người dùng bấm trực tiếp vào bất kỳ phim hoặc giờ chiếu nào họ muốn xem.
 */
export const buildInteractiveMovieCards = (movieGroups = [], nowDate = new Date()) => {
  if (!Array.isArray(movieGroups) || movieGroups.length === 0) return [];
  const cards = [];
  const isSingleMovie = movieGroups.length === 1;
  const maxSlotsPerCard = isSingleMovie ? 9 : 4;

  for (const group of movieGroups) {
    const movie = group?.movie;
    if (!movie) continue;
    const rawSlots = Array.isArray(group.showtimes) ? group.showtimes : movie.showtimes || [];
    const validSlots = sortShowtimesForDisplay(
      rawSlots.filter((st) => isValidShowtimeForBooking(st, movie._id, nowDate))
    );
    if (validSlots.length === 0) continue;

    const chosenSlots = isSingleMovie
      ? validSlots.slice(0, maxSlotsPerCard)
      : pickRepresentativeSlotsForMultiCard(validSlots, maxSlotsPerCard);

    const primarySlot = chosenSlots[0];
    cards.push({
      movieId: movie._id ? String(movie._id) : null,
      title: movie.title,
      ageRating: movie.ageRating || 'P',
      genre: movie.genre || '',
      rating: String(movie.rating || 4.8),
      poster: movie.posterUrl || '',
      showtimeId: String(primarySlot.showtimeId || primarySlot._id),
      time: primarySlot.time,
      dateLabel: primarySlot.relativeDayLabel || '',
      room: primarySlot.roomName || 'Phòng chiếu tiêu chuẩn',
      format: formatDisplayFormat(primarySlot.format),
      price: primarySlot.priceFormatted || '',
      availableSeats: primarySlot.availableSeats,
      showtimes: chosenSlots.map((st) => ({
        showtimeId: String(st.showtimeId || st._id),
        time: st.time,
        dateLabel: st.relativeDayLabel || '',
        room: st.roomName || 'Phòng chiếu tiêu chuẩn',
        format: formatDisplayFormat(st.format),
        price: st.priceFormatted || '',
        availableSeats: st.availableSeats,
      })),
    });
  }

  return cards;
};

/**
 * Nhóm mảng `{ movie, showtime }` thành `movieCards` theo từng bộ phim (giữ nguyên thứ tự xuất hiện)
 */
export const buildInteractiveCardsFromPairs = (pairs = [], nowDate = new Date()) => {
  if (!Array.isArray(pairs) || pairs.length === 0) return [];
  const byMovieId = new Map();

  for (const pair of pairs) {
    if (!pair?.movie || !pair?.showtime) continue;
    const mId = String(pair.movie._id || pair.movie.title);
    if (!byMovieId.has(mId)) {
      byMovieId.set(mId, { movie: pair.movie, showtimes: [] });
    }
    byMovieId.get(mId).showtimes.push(pair.showtime);
  }

  return buildInteractiveMovieCards([...byMovieId.values()].slice(0, 6), nowDate);
};

/**
 * Lọc danh sách suất chiếu của một bộ phim theo các điều kiện thực thể (ngày, khung giờ, định dạng, cụm rạp)
 */
export const filterShowtimesByEntities = (showtimes = [], entities = {}) => {
  if (!Array.isArray(showtimes) || showtimes.length === 0) return [];

  return showtimes.filter((st) => {
    // Lọc theo ngày (hôm nay, ngày mai, ngày cụ thể)
    if (entities.dateFilter?.dateKey && st.dateKey !== entities.dateFilter.dateKey) {
      return false;
    }

    // Lọc theo định dạng (2D, 3D, IMAX, GOLD_CLASS)
    if (entities.format && st.format !== entities.format) {
      return false;
    }

    // Lọc theo khung giờ
    if (entities.timeFilter) {
      const tf = entities.timeFilter;
      if (tf.type === 'EXACT' && tf.exactTime) {
        if (st.time !== tf.exactTime && (st.dayMinutes < tf.minMinutes || st.dayMinutes > tf.maxMinutes)) {
          return false;
        }
      } else if (typeof tf.minMinutes === 'number' && typeof tf.maxMinutes === 'number') {
        if (st.dayMinutes < tf.minMinutes || st.dayMinutes > tf.maxMinutes) {
          return false;
        }
      }
    }

    // Lọc theo cụm rạp
    if (entities.cinemaLocation) {
      const locNoTone = removeVietnameseTones(entities.cinemaLocation);
      const stCinemaNoTone = removeVietnameseTones(st.cinemaName || '');
      if (!stCinemaNoTone.includes(locNoTone) && !locNoTone.includes(stCinemaNoTone)) {
        return false;
      }
    }

    // Lọc theo khoảng giá tối đa
    if (entities.maxPrice && st.priceStandard > entities.maxPrice) {
      return false;
    }

    return true;
  });
};

/**
 * Định dạng một dòng thông tin suất chiếu chuẩn xác từ dữ liệu MongoDB
 */
const formatShowtimeLine = (st, includeMovieTitle = false, movieTitle = '') => {
  const prefix = includeMovieTitle && movieTitle ? `🎬 **${movieTitle}** — ` : '';
  const totalSeats = Number(st.totalSeats) > 0 ? st.totalSeats : 88;
  const seatStatus =
    st.availableSeats > 0
      ? `Còn **${st.availableSeats}/${totalSeats}** ghế trống`
      : `**HẾT GHẾ (0/${totalSeats} ghế)**`;
  const linkMarkdown =
    st.bookingLink && st.availableSeats > 0 ? ` — [Đặt vé ngay ➔](${st.bookingLink})` : '';

  return `• ${prefix}**${st.time}** (${st.relativeDayLabel}) | Định dạng: **${st.format}** | **${st.roomName}** (${st.cinemaName}) | Giá từ: **${st.priceFormatted}** (VIP: ${st.priceVipFormatted}) | ${seatStatus}${linkMarkdown}`;
};

/**
 * Xây dựng phản hồi xác thực 100% từ dữ liệu MongoDB cho từng Intent
 */
export const buildVerifiedDatabaseResponse = ({
  userMessage = '',
  intent = INTENTS.UNKNOWN,
  entities = {},
  contextData = {},
  userInfo = { userName: 'Khách vãng lai' },
  nowDate = new Date(),
}) => {
  const { movies = [], cinemas = [], concessions = [], promotions = [] } = contextData;
  const primaryCinema = contextData.primaryCinema || cinemas[0] || {
    name: "D'AVENOR Thanh Khê Plaza",
    address: 'Tầng 4 TTTM Thanh Khê Plaza, 295 Điện Biên Phủ, P. Chính Gián, Q. Thanh Khê, Đà Nẵng',
    openingHours: '08:00 - 02:00 sáng',
    hotline: '1900 8899',
    parking: 'Hầm B1 & B2 TTTM Thanh Khê Plaza 24/7',
  };
  const cinemaName = primaryCinema.name || "D'AVENOR Thanh Khê Plaza";
  const cinemaHotline = primaryCinema.hotline || '1900 8899';
  const cinemaHours = primaryCinema.openingHours || '08:00 - 02:00 sáng';
  const displayName =
    userInfo?.userName && userInfo.userName !== 'Khách vãng lai' ? userInfo.userName : 'bạn';
  const lower = String(userMessage || '').toLowerCase().trim();

  // =========================================================================
  // -1. OUT_OF_SCOPE (Câu hỏi ngoài phạm vi rạp chiếu phim — từ chối khéo trong 1 câu)
  // =========================================================================
  if (intent === INTENTS.OUT_OF_SCOPE) {
    return {
      reply: `Mình chỉ chuyên hỗ trợ về phim, lịch chiếu, đặt vé và ưu đãi tại **${cinemaName}** thôi — bạn muốn xem danh sách phim đang chiếu hôm nay hay tra cứu suất chiếu tối nay không?`,
      movieCard: null,
      movieCards: [],
      quickReplies: [
        'Các bộ phim đang chiếu hiện tại?',
        'Tối nay có suất chiếu nào?',
        'Giá vé & ưu đãi hôm nay',
      ],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 0. NẾU KHÁCH HỎI ĐÍCH DANH MỘT PHIM KHÔNG CÓ TRONG DATABASE
  // =========================================================================
  if (entities.unmatchedMovieTitle && !entities.matchedMovie) {
    const activeMovies = movies
      .filter((m) => m.status === 'NOW_SHOWING')
      .slice(0, 5);
    const activeMovieTitles = activeMovies
      .map((m) => `**${m.title}** (${m.ageRating})`)
      .join(', ');

    const suggestionPart = activeMovieTitles
      ? `\n\nHiện rạp đang mở bán vé cho các phim: ${activeMovieTitles}. Bạn muốn mình kiểm tra suất chiếu của bộ phim nào trong danh sách này không?`
      : '\n\nBạn có thể kiểm tra lại tên phim hoặc xem lịch chiếu cập nhật trên trang chủ nhé!';

    return {
      reply: `Hiện tại hệ thống **${cinemaName}** chưa có lịch chiếu cho phim **"${entities.unmatchedMovieTitle}"**.${suggestionPart}`,
      movieCard: null,
      movieCards: [],
      quickReplies: activeMovies.slice(0, 2).map((m) => `Lịch chiếu phim ${m.title}`),
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 1. GENERAL_CHAT (Chào hỏi, cảm ơn, hỏi thông tin trợ lý)
  // =========================================================================
  if (intent === INTENTS.GENERAL_CHAT) {
    if (/^(cảm\s+ơn|cám\s+ơn|cam\s+on|thank|tks|tk|ty|thx|ok(e|i|ie|ela)?(\s+(cảm\s+ơn|cam\s+on|nha|nè|ad))?)/i.test(lower)) {
      return {
        reply: `Rất vui được hỗ trợ **${displayName}**! Chúc bạn có những giây phút thưởng thức điện ảnh tuyệt vời tại **${cinemaName}**. Nếu cần kiểm tra thêm suất chiếu, ghế trống hay giá vé, bạn cứ nhắn mình nhé! 🍿`,
        movieCard: null,
        movieCards: [],
        recommendedMovie: '',
      };
    }

    if (/^(tạm\s+biệt|tam\s+biet|bye|good\s*bye|pp|bai|bái\s+bai|hẹn\s+gặp\s+lại)/i.test(lower)) {
      return {
        reply: `Tạm biệt **${displayName}**! Hẹn gặp lại bạn tại **${cinemaName}** nhé! 👋🎬`,
        movieCard: null,
        movieCards: [],
        recommendedMovie: '',
      };
    }

    const totalShowing = movies.filter((m) => m.status === 'NOW_SHOWING').length;
    return {
      reply: `Chào **${displayName}**! 👋 Mình là trợ lý tư vấn của **D'AVENOR CINEMA Đà Nẵng**.\n\nHiện tại hệ thống đang phục vụ **${totalShowing} bộ phim** với dữ liệu lịch chiếu, giá vé và ghế trống cập nhật trực tiếp theo thời gian thực. Bạn muốn mình hỗ trợ thông tin nào ạ?\n• 🎬 Tìm phim đang chiếu (hôm nay, ngày mai, theo độ tuổi/thể loại)\n• 🕒 Tra cứu suất chiếu 2D / RealD 3D / IMAX\n• 💺 Kiểm tra số ghế trống hoặc tìm dãy ghế liền nhau\n• 🎟️ Tính giá vé & tra cứu Combo bắp nước, Voucher khuyến mãi`,
      movieCard: null,
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 2. SHOWTIME_3D (Truy vấn chuyên biệt suất chiếu 3D - Không bao giờ tự tạo suất giả)
  // =========================================================================
  if (intent === INTENTS.SHOWTIME_3D) {
    const dateLabel = entities.dateFilter ? ` vào **${entities.dateFilter.label}**` : '';
    const targetMovies = entities.matchedMovie ? [entities.matchedMovie] : movies;

    const matched3DSlots = [];
    for (const m of targetMovies) {
      const slots3D = filterShowtimesByEntities(m.showtimes || [], {
        ...entities,
        format: '3D',
      });
      for (const st of slots3D) {
        matched3DSlots.push({ movie: m, showtime: st });
      }
    }

    // Trường hợp KHÔNG có suất chiếu 3D thực tế trong Database
    if (matched3DSlots.length === 0) {
      if (entities.matchedMovie) {
        const m = entities.matchedMovie;
        const otherSlots = filterShowtimesByEntities(m.showtimes || [], {
          ...entities,
          format: null,
        });

        if (otherSlots.length > 0) {
          const altLines = otherSlots
            .slice(0, 4)
            .map((st) => formatShowtimeLine(st, false))
            .join('\n');
          return {
            reply: `Hiện tại phim **${m.title}** **không có suất chiếu định dạng 3D** nào${dateLabel} trong hệ thống D'AVENOR CINEMA.\n\nTuy nhiên, phim đang có các suất chiếu thực tế ở định dạng **${m.supportedFormats.join(', ')}** sau đây:\n${altLines}`,
            movieCard: null,
            recommendedMovie: m.title,
          };
        }

        return {
          reply: `Hiện tại phim **${m.title}** **không có suất chiếu 3D** nào${dateLabel} trong hệ thống D'AVENOR CINEMA. Bạn vui lòng chọn ngày chiếu khác hoặc tham khảo các phim khác trên website nhé!`,
          movieCard: null,
          recommendedMovie: m.title,
        };
      }

      return {
        reply: `Hiện tại hệ thống **D'AVENOR CINEMA** **không có suất chiếu định dạng 3D** nào${dateLabel} đang mở bán trong cơ sở dữ liệu. Mời bạn tham khảo các suất chiếu định dạng **2D** hoặc **IMAX** hiện có trên trang Lịch chiếu nhé!`,
        movieCard: null,
        recommendedMovie: '',
      };
    }

    // Trường hợp CÓ suất chiếu 3D thực tế trong Database
    const lines = matched3DSlots
      .slice(0, 6)
      .map(({ movie, showtime }) => formatShowtimeLine(showtime, !entities.matchedMovie, movie.title))
      .join('\n');

    const firstOpen = matched3DSlots.find(({ showtime }) => showtime.availableSeats > 0);
    const card = firstOpen
      ? buildSafeMovieCard(firstOpen.showtime, firstOpen.movie, nowDate)
      : null;
    const movieCards = buildInteractiveCardsFromPairs(matched3DSlots, nowDate);

    const headerTitle = entities.matchedMovie
      ? `👓 **Lịch chiếu 3D thực tế của phim ${entities.matchedMovie.title}${dateLabel}:**`
      : `👓 **Các suất chiếu 3D đang mở bán${dateLabel} tại D'AVENOR CINEMA:**`;

    return {
      reply: `${headerTitle}\n\n${lines}`,
      movieCard: card,
      movieCards,
      recommendedMovie: firstOpen ? firstOpen.movie.title : matched3DSlots[0].movie.title,
    };
  }

  // =========================================================================
  // 3. SEAT_AVAILABILITY (Kiểm tra số ghế trống thực tế & tìm dãy ghế liền nhau)
  // =========================================================================
  if (intent === INTENTS.SEAT_AVAILABILITY) {
    const targetMovies = entities.matchedMovie ? [entities.matchedMovie] : movies;
    const candidatePairs = [];

    for (const m of targetMovies) {
      for (const st of m.showtimes || []) {
        if (entities.contextShowtimeId && !entities.timeFilter && !entities.dateFilter) {
          if (String(st.showtimeId) === String(entities.contextShowtimeId)) {
            candidatePairs.push({ movie: m, showtime: st });
          }
        }
      }
    }

    if (candidatePairs.length === 0) {
      for (const m of targetMovies) {
        const filtered = filterShowtimesByEntities(m.showtimes || [], entities);
        for (const st of filtered) {
          candidatePairs.push({ movie: m, showtime: st });
        }
      }
    }

    if (candidatePairs.length === 0) {
      const timeDesc = entities.timeFilter ? ` ${entities.timeFilter.label}` : '';
      const movieDesc = entities.matchedMovie ? ` cho phim **${entities.matchedMovie.title}**` : '';
      return {
        reply: `Hiện tại không tìm thấy suất chiếu nào${movieDesc}${timeDesc} đang mở bán trong hệ thống để kiểm tra ghế trống. Bạn vui lòng cho mình biết tên phim và khung giờ cụ thể hơn nhé!`,
        movieCard: null,
        recommendedMovie: entities.matchedMovie?.title || '',
      };
    }

    const reqCount = entities.ticketQuantity || (entities.requireContiguousSeats ? 2 : 1);

    // Xử lý kiểm tra ghế liền nhau nếu người dùng yêu cầu (VD: "Còn 4 ghế liền nhau cho suất 21:15 không?")
    if (entities.requireContiguousSeats) {
      const pair = candidatePairs[0];
      const { movie, showtime } = pair;

      if (showtime.availableSeats <= 0) {
        return {
          reply: `⚠️ Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel}) tại **${showtime.roomName}** hiện đã **HẾT GHẾ (còn 0 ghế trống)**, vì vậy không còn ${reqCount} ghế liền nhau.`,
          movieCard: null,
          recommendedMovie: movie.title,
        };
      }

      if (showtime.availableSeats < reqCount) {
        return {
          reply: `⚠️ Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel} - ${showtime.roomName}) hiện chỉ còn tổng cộng **${showtime.availableSeats} ghế trống**, không đủ **${reqCount} ghế liền nhau** như bạn yêu cầu.`,
          movieCard: null,
          recommendedMovie: movie.title,
        };
      }

      // Nếu có danh sách ghế chi tiết trong rawSeats -> kiểm tra chính xác cùng hàng & cột liên tiếp
      if (Array.isArray(showtime.rawSeats) && showtime.rawSeats.length > 0) {
        const contiguousBlocks = findContiguousAvailableSeats(
          showtime.rawSeats,
          reqCount,
          nowDate,
          entities.seatType
        );

        if (contiguousBlocks.length === 0) {
          return {
            reply: `⚠️ Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel} - ${showtime.roomName}) hiện còn **${showtime.availableSeats} ghế trống** rải rác, nhưng **KHÔNG còn cụm ${reqCount} ghế liền nhau** trên cùng một hàng ghế.\n\nBạn có thể cân nhắc chọn ghế tách rời hoặc chuyển sang suất chiếu khác nhé!`,
            movieCard: null,
            recommendedMovie: movie.title,
          };
        }

        const sampleBlock = contiguousBlocks[0].join(', ');
        const secondBlock = contiguousBlocks[1] ? ` hoặc **${contiguousBlocks[1].join(', ')}**` : '';
        const linkPart = showtime.bookingLink
          ? `\n\n👉 [Chọn ghế ngay cho suất ${showtime.time} ➔](${showtime.bookingLink})`
          : '';

        return {
          reply: `✅ Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel}) tại **${showtime.roomName}** hiện còn **${showtime.availableSeats} ghế trống** và **CÓ đủ ${reqCount} ghế liền nhau**!\n\n💺 **Gợi ý dãy ghế liền nhau đang trống:** **${sampleBlock}**${secondBlock}\n💵 **Giá vé:** Thường ${showtime.priceFormatted} | VIP ${showtime.priceVipFormatted}${linkPart}`,
          movieCard: buildSafeMovieCard(showtime, movie, nowDate),
          recommendedMovie: movie.title,
        };
      }

      // Trường hợp suất chiếu mới chưa khởi tạo ghế chi tiết (còn 86/88 ghế trống)
      const linkPart = showtime.bookingLink
        ? `\n\n👉 [Chọn ghế ngay cho suất ${showtime.time} ➔](${showtime.bookingLink})`
        : '';
      return {
        reply: `✅ Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel}) tại **${showtime.roomName}** hiện còn **${showtime.availableSeats} ghế trống** và vẫn còn nhiều dãy **${reqCount} ghế liền nhau** (khu vực hàng E, F, G trung tâm).${linkPart}`,
        movieCard: buildSafeMovieCard(showtime, movie, nowDate),
        recommendedMovie: movie.title,
      };
    }

    // Nếu khách hỏi tình trạng ghế của 1 bộ phim cụ thể -> gom theo từng phòng & hiển thị đầy đủ mọi khung giờ của ngày đó
    if (entities.matchedMovie) {
      const movieSlots = candidatePairs.map((p) => p.showtime);
      const { daySlots, dayLabel, otherDates } = selectDayShowtimesAndOtherDates(movieSlots, entities);
      const groupedText = formatShowtimesGroupedByRoom(daySlots);
      const otherDatesNote =
        otherDates.length > 0
          ? `\n\n📅 *Các ngày chiếu khác của phim: ${otherDates.join(', ')} — bạn có thể hỏi thêm theo ngày muốn xem!*`
          : '';
      const firstOpenSlot = daySlots.find((s) => s.availableSeats > 0) || null;

      return {
        reply: `💺 **Số ghế trống thực tế phim ${entities.matchedMovie.title} — ${dayLabel}:**\n\n${groupedText}${otherDatesNote}`,
        movieCard: firstOpenSlot ? buildSafeMovieCard(firstOpenSlot, entities.matchedMovie, nowDate) : null,
        movieCards: buildInteractiveMovieCards([{ movie: entities.matchedMovie, showtimes: daySlots }], nowDate),
        quickReplies:
          otherDates.length > 0
            ? [`Lịch chiếu ${entities.matchedMovie.title} ngày mai`, `Giá vé phim ${entities.matchedMovie.title}`]
            : [`Giá vé phim ${entities.matchedMovie.title}`],
        recommendedMovie: entities.matchedMovie.title,
      };
    }

    // Báo cáo số ghế trống thực tế khi hỏi chung nhiều phim
    const seatLines = candidatePairs.slice(0, 9).map(({ movie, showtime }) => {
      const total = Number(showtime.totalSeats) > 0 ? showtime.totalSeats : 88;
      if (showtime.availableSeats <= 0) {
        return `• **${movie.title}** — Suất **${showtime.time}** (${showtime.relativeDayLabel}, ${showtime.roomName}): **HẾT GHẾ (0/${total} ghế)**`;
      }
      const linkStr = showtime.bookingLink ? ` — [Chọn ghế ➔](${showtime.bookingLink})` : '';
      return `• **${movie.title}** — Suất **${showtime.time}** (${showtime.relativeDayLabel}, ${showtime.roomName}): Còn **${showtime.availableSeats}/${total}** ghế trống (Giá từ ${showtime.priceFormatted})${linkStr}`;
    });

    const firstOpen = candidatePairs.find(({ showtime }) => showtime.availableSeats > 0);
    return {
      reply: `💺 **Tình trạng ghế trống thực tế từ hệ thống:**\n\n${seatLines.join('\n')}`,
      movieCard: firstOpen ? buildSafeMovieCard(firstOpen.showtime, firstOpen.movie, nowDate) : null,
      movieCards: buildInteractiveCardsFromPairs(candidatePairs, nowDate),
      recommendedMovie: firstOpen ? firstOpen.movie.title : candidatePairs[0].movie.title,
    };
  }

  // =========================================================================
  // 4. TICKET_PRICE (Báo giá vé đúng theo Database & tính tổng tiền N vé)
  // =========================================================================
  if (intent === INTENTS.TICKET_PRICE) {
    const qty = entities.ticketQuantity || 1;
    let targetMovie = entities.matchedMovie;
    let targetShowtime = null;

    if (targetMovie) {
      const filtered = filterShowtimesByEntities(targetMovie.showtimes || [], entities);
      if (entities.contextShowtimeId) {
        targetShowtime =
          filtered.find((s) => String(s.showtimeId) === String(entities.contextShowtimeId)) ||
          (targetMovie.showtimes || []).find(
            (s) => String(s.showtimeId) === String(entities.contextShowtimeId)
          ) ||
          filtered[0] ||
          (targetMovie.showtimes || [])[0];
      } else {
        targetShowtime = filtered[0] || (targetMovie.showtimes || [])[0] || null;
      }
    } else if (entities.contextShowtimeId) {
      for (const m of movies) {
        const found = (m.showtimes || []).find(
          (s) => String(s.showtimeId) === String(entities.contextShowtimeId)
        );
        if (found) {
          targetMovie = m;
          targetShowtime = found;
          break;
        }
      }
    } else if (entities.format) {
      for (const m of movies) {
        const found = filterShowtimesByEntities(m.showtimes || [], entities)[0];
        if (found) {
          targetMovie = m;
          targetShowtime = found;
          break;
        }
      }
    }

    if (targetMovie && targetShowtime) {
      const quoteStandard = calculateTicketQuote(targetShowtime, qty, 'STANDARD');
      const quoteVip = calculateTicketQuote(targetShowtime, qty, 'VIP');
      const quoteSweetbox = calculateTicketQuote(targetShowtime, qty, 'SWEETBOX');

      const requestedTier = entities.seatType || 'STANDARD';
      const primaryQuote = calculateTicketQuote(targetShowtime, qty, requestedTier);
      const linkPart =
        targetShowtime.bookingLink && targetShowtime.availableSeats > 0
          ? `\n\n👉 [Đặt vé suất ${targetShowtime.time} ngay ➔](${targetShowtime.bookingLink})`
          : targetShowtime.availableSeats <= 0
            ? '\n\n⚠️ *Lưu ý: Suất chiếu này hiện đã hết ghế (0 ghế trống).*'
            : '';

      if (qty > 1 || entities.seatType) {
        return {
          reply: `🎟️ **Báo giá ${qty} vé cho phim ${targetMovie.title}** — Suất **${targetShowtime.time}** (${targetShowtime.relativeDayLabel}, **${targetShowtime.roomName} - ${targetShowtime.format}**):\n\n• **${primaryQuote.seatTypeLabel}:** ${qty} vé × ${primaryQuote.unitPriceFormatted} = **${primaryQuote.totalPriceFormatted}**\n\n📋 *Chi tiết theo từng hạng ghế cho ${qty} vé:*\n• Ghế Thường (Standard): ${qty} × ${quoteStandard.unitPriceFormatted} = **${quoteStandard.totalPriceFormatted}**\n• Ghế VIP (Hàng E–G): ${qty} × ${quoteVip.unitPriceFormatted} = **${quoteVip.totalPriceFormatted}**\n• Ghế Đôi (Sweetbox): ${qty} × ${quoteSweetbox.unitPriceFormatted} = **${quoteSweetbox.totalPriceFormatted}**${linkPart}`,
          movieCard: buildSafeMovieCard(targetShowtime, targetMovie, nowDate),
          recommendedMovie: targetMovie.title,
        };
      }

      return {
        reply: `🎟️ **Bảng giá vé thực tế phim ${targetMovie.title}** — Suất **${targetShowtime.time}** (${targetShowtime.relativeDayLabel}, **${targetShowtime.roomName} - ${targetShowtime.format}**):\n\n• **Ghế Thường (Standard):** **${targetShowtime.priceFormatted} / vé**\n• **Ghế VIP (Trung tâm E–G):** **${targetShowtime.priceVipFormatted} / vé**\n• **Ghế Đôi Sweetbox (Hàng H):** **${targetShowtime.priceSweetboxFormatted} / cặp**\n• **Số ghế trống hiện tại:** ${targetShowtime.availableSeats > 0 ? `Còn **${targetShowtime.availableSeats}** ghế` : '**HẾT GHẾ (0 ghế)**'}${linkPart}`,
        movieCard: buildSafeMovieCard(targetShowtime, targetMovie, nowDate),
        recommendedMovie: targetMovie.title,
      };
    }

    // Nếu khách hỏi giá vé chung chung mà chưa xác định phim / suất chiếu cụ thể
    const allShowtimes = movies.flatMap((m) =>
      (m.showtimes || []).map((st) => ({ movie: m, showtime: st }))
    );

    if (allShowtimes.length > 0) {
      const sampleLines = allShowtimes
        .slice(0, 5)
        .map(
          ({ movie, showtime }) =>
            `• **${movie.title}** (${showtime.time} - ${showtime.format} - ${showtime.roomName}): Ghế thường **${showtime.priceFormatted}** | Ghế VIP **${showtime.priceVipFormatted}** | Sweetbox **${showtime.priceSweetboxFormatted}**`
        )
        .join('\n');

      const clarifyNote =
        qty > 1
          ? `\n\n💡 Để mình tính chính xác tổng tiền **${qty} vé**, bạn vui lòng cho mình biết **tên phim**, **suất chiếu** và **loại ghế (Thường / VIP / Sweetbox)** bạn muốn chọn nhé!`
          : `\n\n💡 Bạn đang quan tâm đến bộ phim hay khung giờ nào để mình báo giá chi tiết và gửi link đặt vé cho bạn nhé?`;

      return {
        reply: `🎟️ **Giá vé thực tế theo các suất chiếu đang mở bán tại D'AVENOR CINEMA:**\n\n${sampleLines}${clarifyNote}`,
        movieCard: null,
        recommendedMovie: '',
      };
    }

    return {
      reply: `Hiện tại hệ thống chưa có suất chiếu nào đang mở bán để tra cứu giá vé. Bạn vui lòng kiểm tra lại tại mục Lịch chiếu trên website nhé!`,
      movieCard: null,
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 5. MOVIE_RECOMMENDATION (Tư vấn phim theo độ tuổi / thể loại + lọc ngày & khung giờ)
  // =========================================================================
  if (intent === INTENTS.MOVIE_RECOMMENDATION) {
    let candidates = movies.filter((m) => m.status === 'NOW_SHOWING');

    // Lọc nghiêm ngặt theo độ tuổi nếu có (VD: trẻ 6 tuổi -> CHỈ được xem phim P)
    if (Array.isArray(entities.allowedAgeRatings) && entities.allowedAgeRatings.length > 0) {
      candidates = candidates.filter((m) =>
        entities.allowedAgeRatings.includes(String(m.ageRating || 'P').toUpperCase())
      );
    }

    // Lọc theo thể loại nếu người dùng yêu cầu
    if (Array.isArray(entities.genres) && entities.genres.length > 0) {
      const genreFiltered = candidates.filter((m) => {
        const gNoTone = removeVietnameseTones(m.genre || '');
        return entities.genres.some((reqG) => gNoTone.includes(removeVietnameseTones(reqG)));
      });
      if (genreFiltered.length > 0) {
        candidates = genreFiltered;
      } else {
        const fallbackShowing = movies
          .filter((m) => m.status === 'NOW_SHOWING')
          .slice(0, 3)
          .map((m) => `**${m.title}** (${m.genre})`)
          .join(', ');
        return {
          reply: `Hiện tại rạp chưa có bộ phim nào thuộc thể loại **${entities.genres.join(', ')}**${entities.viewerAge ? ` phù hợp cho khán giả **${entities.viewerAge} tuổi**` : ''} đang chiếu.${fallbackShowing ? `\n\nBạn có thể tham khảo các phim đang chiếu khác như: ${fallbackShowing}.` : ''}`,
          movieCard: null,
          movieCards: [],
          quickReplies: ['Các bộ phim đang chiếu hiện tại?', 'Tối nay có suất chiếu nào?'],
          recommendedMovie: '',
        };
      }
    }

    if (candidates.length === 0) {
      if (entities.viewerAge !== null) {
        return {
          reply: `Theo quy định phân loại độ tuổi, khán giả **${entities.viewerAge} tuổi** chỉ được xem các bộ phim phân loại **${entities.allowedAgeRatings.join(', ')}** (không xem các phim T13, T16, T18).\n\nHiện tại hệ thống **${cinemaName}** chưa có phim phân loại **${entities.allowedAgeRatings.join(', ')}** nào đang mở bán suất chiếu. Bạn vui lòng theo dõi lịch chiếu cập nhật trên website nhé!`,
          movieCard: null,
          movieCards: [],
          recommendedMovie: '',
        };
      }

      return {
        reply: `Hiện tại hệ thống chưa có bộ phim nào khớp với tiêu chí bạn tìm kiếm. Bạn có muốn xem danh sách tất cả phim đang chiếu hôm nay không?`,
        movieCard: null,
        movieCards: [],
        quickReplies: ['Các bộ phim đang chiếu hiện tại?'],
        recommendedMovie: '',
      };
    }

    // Nếu người dùng có lọc thêm theo ngày / khung giờ / định dạng (VD: "Có phim kinh dị nào tối nay không?")
    const hasScheduleFilter = Boolean(entities.dateFilter || entities.timeFilter || entities.format || entities.cinemaLocation);
    const groupedCandidates = candidates.map((m) => ({
      movie: m,
      slots: hasScheduleFilter
        ? filterShowtimesByEntities(m.showtimes || [], entities)
        : (m.showtimes || []),
    }));

    const matchedWithSlots = hasScheduleFilter
      ? groupedCandidates.filter((g) => g.slots.length > 0)
      : groupedCandidates;

    if (hasScheduleFilter && matchedWithSlots.length === 0) {
      const filterDesc = [
        entities.genres?.length ? `thể loại **${entities.genres.join(', ')}**` : '',
        entities.dateFilter ? `vào **${entities.dateFilter.label}**` : '',
        entities.timeFilter ? `khung giờ **${entities.timeFilter.label}**` : '',
      ]
        .filter(Boolean)
        .join(' ');

      const altGroups = candidates
        .filter((m) => (m.showtimes || []).length > 0)
        .slice(0, 3);

      const altLines = altGroups.map((m) => {
        const nextSt = m.showtimes[0];
        return `• **${m.title}** (${m.genre} | ${m.ageRating}) — Suất gần nhất: **${nextSt.time}** (${nextSt.relativeDayLabel}, ${nextSt.format})`;
      });

      return {
        reply: `Hiện tại chưa có suất chiếu nào ${filterDesc} tại **${cinemaName}**.${
          altLines.length > 0
            ? `\n\nTuy nhiên, các phim cùng thể loại vẫn còn suất chiếu ở khung giờ/ngày khác:\n${altLines.join('\n')}`
            : '\n\nBạn muốn mình kiểm tra tất cả các phim có suất chiếu tối nay không?'
        }`,
        movieCard: null,
        movieCards: buildInteractiveMovieCards(
          altGroups.map((m) => ({ movie: m, showtimes: m.showtimes.slice(0, 2) })),
          nowDate
        ),
        quickReplies: ['Tối nay có suất chiếu nào?', 'Các bộ phim đang chiếu hiện tại?'],
        recommendedMovie: altGroups[0]?.title || '',
      };
    }

    const displayGroups = matchedWithSlots.slice(0, 4);

    const headerParts = [];
    if (entities.viewerAge !== null) {
      headerParts.push(`phù hợp cho khán giả **${entities.viewerAge} tuổi** (phân loại ${entities.allowedAgeRatings.join(', ')})`);
    }
    if (entities.genres?.length > 0) {
      headerParts.push(`thể loại **${entities.genres.join(', ')}**`);
    }
    if (entities.dateFilter) headerParts.push(`vào **${entities.dateFilter.label}**`);
    if (entities.timeFilter) headerParts.push(`khung giờ **${entities.timeFilter.label}**`);

    const headerTitle =
      headerParts.length > 0
        ? `🎬 **Các phim ${headerParts.join(' ')} tại ${cinemaName}:**\n\n`
        : `🌟 **Gợi ý phim đang chiếu nổi bật tại ${cinemaName}:**\n\n`;

    const movieLines = displayGroups.map(({ movie: m, slots }) => {
      const openSlots = slots.filter((s) => s.availableSeats > 0);
      const slotPreview =
        openSlots.length > 0
          ? openSlots
              .slice(0, 3)
              .map(
                (s) =>
                  `**${s.time}** (${s.relativeDayLabel}, ${s.format}, ${s.priceFormatted}, còn ${s.availableSeats} ghế)`
              )
              .join(' | ')
          : 'Hiện chưa có suất chiếu mở bán';
      const firstLink = openSlots[0]?.bookingLink
        ? ` — [Đặt vé ngay ➔](${openSlots[0].bookingLink})`
        : '';
      return `• 🎬 **${m.title}** (**${m.ageRating}** | ⭐ ${m.rating}/5 | ${m.genre} | ${m.duration} phút)\n  🕒 Suất chiếu: ${slotPreview}${firstLink}`;
    });

    const firstGroupWithOpenSlot = displayGroups.find((g) =>
      g.slots.some((s) => s.availableSeats > 0)
    );
    const firstOpenSlot = firstGroupWithOpenSlot
      ? firstGroupWithOpenSlot.slots.find((s) => s.availableSeats > 0)
      : null;

    const movieCards = buildInteractiveMovieCards(
      displayGroups.map(({ movie, slots }) => ({ movie, showtimes: slots })),
      nowDate
    );

    return {
      reply: `${headerTitle}${movieLines.join('\n\n')}`,
      movieCard: firstOpenSlot
        ? buildSafeMovieCard(firstOpenSlot, firstGroupWithOpenSlot.movie, nowDate)
        : null,
      movieCards,
      quickReplies: displayGroups[0]
        ? [`Giá vé phim ${displayGroups[0].movie.title}`, `Phim đầu tiên nội dung sao?`]
        : [],
      recommendedMovie: firstGroupWithOpenSlot
        ? firstGroupWithOpenSlot.movie.title
        : displayGroups[0].movie.title,
    };
  }

  // =========================================================================
  // 6. MOVIE_DETAIL (Thông tin chi tiết về 1 bộ phim cụ thể)
  // =========================================================================
  if (intent === INTENTS.MOVIE_DETAIL && entities.matchedMovie) {
    const m = entities.matchedMovie;
    const openSlots = (m.showtimes || []).filter((s) => s.availableSeats > 0);
    const slotText =
      openSlots.length > 0
        ? openSlots
            .slice(0, 4)
            .map((s) => formatShowtimeLine(s, false))
            .join('\n')
        : '• Hiện chưa có suất chiếu nào đang mở bán.';

    const castNames = Array.isArray(m.cast)
      ? m.cast
          .slice(0, 4)
          .map((c) => (typeof c === 'string' ? c : c?.name || ''))
          .filter(Boolean)
          .join(', ')
      : '';

    const detailLines = [
      `• **Thể loại:** ${m.genre}`,
      `• **Thời lượng:** ${m.duration} phút`,
      `• **Phân loại độ tuổi:** **${m.ageRating}**`,
      `• **Đánh giá:** ⭐ ${m.rating}/5`,
      m.releaseDate ? `• **Khởi chiếu:** ${m.releaseDate}` : '',
      m.director ? `• **Đạo diễn:** ${m.director}` : '',
      castNames ? `• **Diễn viên:** ${castNames}` : '',
      `• **Định dạng hỗ trợ:** ${m.supportedFormats.length > 0 ? m.supportedFormats.join(', ') : 'Đang cập nhật'}`,
      m.description ? `• **Nội dung:** ${m.description}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      reply: `🎬 **Thông tin chi tiết phim ${m.title}:**\n\n${detailLines}\n\n🕒 **Các suất chiếu sắp tới:**\n${slotText}`,
      movieCard: openSlots[0] ? buildSafeMovieCard(openSlots[0], m, nowDate) : null,
      movieCards: openSlots.length > 0 ? buildInteractiveMovieCards([{ movie: m, showtimes: openSlots }], nowDate) : [],
      quickReplies: [`Tối nay ${m.title} chiếu mấy giờ?`, `Giá vé phim ${m.title}`],
      recommendedMovie: m.title,
    };
  }

  // =========================================================================
  // 7. MOVIE_SEARCH (Danh sách phim đang chiếu / sắp chiếu / theo tháng / theo ngày)
  // =========================================================================
  if (intent === INTENTS.MOVIE_SEARCH) {
    // Trường hợp khách hỏi phim theo tháng cụ thể (VD: "tháng 12 có phim j", "tháng sau có phim gì")
    if (entities.monthFilter) {
      const { month, year, monthKey, label, isFutureMonth } = entities.monthFilter;
      const moviesInMonth = movies.filter((m) => {
        const matchRelease = m.releaseMonth === month && m.releaseYear === year;
        const matchShowtime = (m.showtimes || []).some((s) => String(s.dateKey || '').startsWith(monthKey));
        if (isFutureMonth) {
          return matchRelease || (m.status === 'COMING_SOON' && matchShowtime);
        }
        return matchRelease || matchShowtime || m.status === 'NOW_SHOWING';
      });

      if (moviesInMonth.length === 0) {
        const availableMonths = [
          ...new Set(
            movies
              .filter((m) => m.releaseMonth && m.releaseYear)
              .map((m) => `Tháng ${m.releaseMonth}/${m.releaseYear}`)
          ),
        ].slice(0, 5);
        const hint =
          availableMonths.length > 0
            ? `\n\n📅 Hiện hệ thống có lịch phim cho: **${availableMonths.join(', ')}**. Bạn muốn xem tháng nào?`
            : '';
        return {
          reply: `Hiện tại **${cinemaName}** chưa có phim nào được công bố cho **${label}**.${hint}`,
          movieCard: null,
          movieCards: [],
          quickReplies: ['Phim sắp chiếu có gì?', 'Các bộ phim đang chiếu hiện tại?'],
          recommendedMovie: '',
        };
      }

      const monthLines = moviesInMonth.slice(0, 8).map((m, idx) => {
        const statusTag = m.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đang chiếu';
        const releaseNote = m.releaseDate ? ` • Khởi chiếu: **${m.releaseDate}**` : '';
        const detailLink = m._id ? ` — [Xem chi tiết](/movie/${m._id})` : '';
        return `${idx + 1}. 🎞️ **${m.title}** (**${m.ageRating}** | ${m.duration} phút | ${m.genre})\n   📌 *${statusTag}*${releaseNote}${detailLink}`;
      });

      const footerNote = isFutureMonth
        ? `\n\n💡 *Các phim ${label} hiện ở trạng thái sắp chiếu — bạn có thể bấm "Xem chi tiết" để xem thông tin & trailer trước ngày mở bán vé.*`
        : '';

      return {
        reply: `📅 **Danh sách phim ${label} (${moviesInMonth.length} phim) tại ${cinemaName}:**\n\n${monthLines.join('\n\n')}${footerNote}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [
          ...moviesInMonth.slice(0, 2).map((m) => `Nội dung phim ${m.title}`),
          'Các bộ phim đang chiếu hiện tại?',
        ].slice(0, 3),
        recommendedMovie: moviesInMonth[0]?.title || '',
      };
    }

    // Trường hợp khách hỏi riêng "phim sắp chiếu"
    if (entities.movieStatusFilter === 'COMING_SOON') {
      const comingSoonMovies = movies.filter((m) => m.status === 'COMING_SOON');
      if (comingSoonMovies.length === 0) {
        return {
          reply: `Hiện tại **${cinemaName}** chưa có danh sách phim sắp chiếu mới được công bố. Bạn có muốn xem các bộ phim **đang chiếu** hiện tại không?`,
          movieCard: null,
          movieCards: [],
          quickReplies: ['Các bộ phim đang chiếu hiện tại?'],
          recommendedMovie: '',
        };
      }
      const comingLines = comingSoonMovies.slice(0, 6).map((m) => {
        const releaseNote = m.releaseDate ? ` • Khởi chiếu: **${m.releaseDate}**` : '';
        const detailLink = m._id ? ` • [Chi tiết](/movie/${m._id})` : '';
        return `• 🎞️ **${m.title}** (**${m.ageRating}** | ${m.genre} | ${m.duration} phút${releaseNote})${detailLink}`;
      });
      return {
        reply: `🎞️ **Các bộ phim sắp chiếu tại ${cinemaName}:**\n\n${comingLines.join('\n')}\n\nBạn muốn mình tóm tắt nội dung bộ phim nào không?`,
        movieCard: null,
        movieCards: [],
        quickReplies: comingSoonMovies.slice(0, 2).map((m) => `Nội dung phim ${m.title}`),
        recommendedMovie: comingSoonMovies[0]?.title || '',
      };
    }

    if (entities.dateFilter) {
      const targetDateKey = entities.dateFilter.dateKey;
      const moviesOnDate = movies
        .filter((m) => m.status === 'NOW_SHOWING')
        .map((m) => ({
          movie: m,
          slots: (m.showtimes || []).filter((s) => s.dateKey === targetDateKey),
        }))
        .filter((item) => item.slots.length > 0);

      if (moviesOnDate.length === 0) {
        const showingNowNames = movies
          .filter((m) => m.status === 'NOW_SHOWING')
          .slice(0, 5)
          .map((m) => `**${m.title}** (${m.ageRating})`)
          .join(', ');

        return {
          reply: `Hiện tại hệ thống chưa có lịch chiếu mở bán cho **${entities.dateFilter.label}**.\n\n🎬 Các bộ phim đang có mặt tại rạp gồm: ${showingNowNames || 'Đang cập nhật'}. Bạn có muốn kiểm tra suất chiếu của ngày khác không?`,
          movieCard: null,
          movieCards: [],
          quickReplies: ['Các bộ phim đang chiếu hiện tại?'],
          recommendedMovie: '',
        };
      }

      const displayDateGroups = moviesOnDate.slice(0, 6);
      const lines = displayDateGroups.map(({ movie, slots }, idx) => {
        const slotSummary = summarizeMovieSlotsCompact(slots);
        return `${idx + 1}. 🎬 **${movie.title}** (**${movie.ageRating}** | ⭐ ${movie.rating}/5 | ${movie.genre})\n   🕒 ${slotSummary}`;
      });

      const movieCards = buildInteractiveMovieCards(
        displayDateGroups.map(({ movie, slots }) => ({ movie, showtimes: slots })),
        nowDate
      );

      const firstOpenPair = displayDateGroups
        .flatMap(({ movie, slots }) => slots.map((s) => ({ movie, showtime: s })))
        .find(({ showtime }) => showtime.availableSeats > 0);

      return {
        reply: `📅 **Các bộ phim đang chiếu vào ${entities.dateFilter.label} tại ${cinemaName}:**\n\n${lines.join('\n\n')}\n\n💡 *Bấm vào thẻ phim bên dưới để xem chi tiết hoặc chọn giờ đặt vé ngay!*`,
        movieCard: firstOpenPair
          ? buildSafeMovieCard(firstOpenPair.showtime, firstOpenPair.movie, nowDate)
          : null,
        movieCards,
        quickReplies: displayDateGroups[0]
          ? [`Lịch chiếu ${displayDateGroups[0].movie.title} hôm nay`, 'Phim thứ 2 nội dung sao?']
          : [],
        recommendedMovie: firstOpenPair ? firstOpenPair.movie.title : displayDateGroups[0].movie.title,
      };
    }

    // Không chỉ định ngày cụ thể -> Chỉ liệt kê đúng các phim đang chiếu (status === 'NOW_SHOWING') khớp 100% với trang chủ
    const showingMovies = movies.filter((m) => m.status === 'NOW_SHOWING');
    if (showingMovies.length === 0) {
      return {
        reply: `Hiện tại **${cinemaName}** đang cập nhật danh sách phim mới. Bạn vui lòng kiểm tra lại trên trang chủ sau ít phút nhé!`,
        movieCard: null,
        movieCards: [],
        recommendedMovie: '',
      };
    }

    const displayShowing = showingMovies.slice(0, 6);
    const lines = displayShowing.map((m, idx) => {
      const { daySlots, dayLabel } = selectDayShowtimesAndOtherDates(m.showtimes || [], entities);
      const slotDesc =
        daySlots.length > 0
          ? `${dayLabel ? `(${dayLabel}) ` : ''}${summarizeMovieSlotsCompact(daySlots)}`
          : 'Chưa có suất chiếu mở bán';
      return `${idx + 1}. 🎬 **${m.title}** (**${m.ageRating}** | ⭐ ${m.rating}/5 | ${m.genre})\n   🕒 ${slotDesc}`;
    });

    const movieCards = buildInteractiveMovieCards(
      displayShowing.map((m) => {
        const { daySlots } = selectDayShowtimesAndOtherDates(m.showtimes || [], entities);
        return { movie: m, showtimes: daySlots.length > 0 ? daySlots : m.showtimes || [] };
      }),
      nowDate
    );

    const firstMovieWithSlot = displayShowing.find((m) =>
      (m.showtimes || []).some((s) => s.availableSeats > 0)
    );
    const firstSlot = firstMovieWithSlot?.showtimes.find((s) => s.availableSeats > 0) || null;

    return {
      reply: `Các bộ phim đang chiếu hiện tại tại **${cinemaName}** gồm:\n\n${lines.join('\n\n')}\n\nBạn muốn xem lịch chiếu chi tiết hoặc đặt vé phim nào?`,
      movieCard: firstSlot ? buildSafeMovieCard(firstSlot, firstMovieWithSlot, nowDate) : null,
      movieCards,
      quickReplies: displayShowing.slice(0, 2).map((m) => `Tối nay ${m.title} chiếu mấy giờ?`),
      recommendedMovie: firstMovieWithSlot?.title || displayShowing[0].title,
    };
  }

  // =========================================================================
  // 8. SHOWTIME_SEARCH (Tìm suất chiếu theo phim, ngày, giờ, định dạng IMAX/2D)
  // =========================================================================
  if (intent === INTENTS.SHOWTIME_SEARCH) {
    const targetMovies = entities.matchedMovie ? [entities.matchedMovie] : movies;
    const matchedPairs = [];

    for (const m of targetMovies) {
      const filtered = filterShowtimesByEntities(m.showtimes || [], entities);
      for (const st of filtered) {
        matchedPairs.push({ movie: m, showtime: st });
      }
    }

    const filterLabels = [];
    if (entities.matchedMovie) filterLabels.push(`phim **${entities.matchedMovie.title}**`);
    if (entities.format) filterLabels.push(`định dạng **${entities.format}**`);
    if (entities.dateFilter) filterLabels.push(`vào **${entities.dateFilter.label}**`);
    if (entities.timeFilter) filterLabels.push(`khung giờ **${entities.timeFilter.label}**`);
    if (entities.cinemaLocation) filterLabels.push(`tại **${entities.cinemaLocation}**`);
    const descText = filterLabels.length > 0 ? filterLabels.join(' ') : 'theo yêu cầu của bạn';

    if (matchedPairs.length === 0) {
      // Nếu khách hỏi 1 phim cụ thể mà ngày/giờ/định dạng đó không có, gợi ý các suất thực tế khác của phim đó
      if (entities.matchedMovie && (entities.matchedMovie.showtimes || []).length > 0) {
        const altLines = entities.matchedMovie.showtimes
          .slice(0, 4)
          .map((st) => formatShowtimeLine(st, false))
          .join('\n');

        return {
          reply: `Hiện tại không có suất chiếu nào cho ${descText}.\n\n🕒 Tuy nhiên, phim **${entities.matchedMovie.title}** đang có các suất chiếu thực tế khác sau đây:\n${altLines}`,
          movieCard: null,
          recommendedMovie: entities.matchedMovie.title,
        };
      }

      return {
        reply: `Hiện tại hệ thống **D'AVENOR CINEMA** không có suất chiếu nào cho ${descText}. Bạn vui lòng thử chọn khung giờ hoặc ngày chiếu khác trên website nhé!`,
        movieCard: null,
        recommendedMovie: entities.matchedMovie?.title || '',
      };
    }

    // Nếu khách hỏi lịch chiếu của 1 bộ phim cụ thể -> hiển thị đầy đủ tất cả khung giờ & phòng chiếu của ngày đó (không cắt sót suất)
    if (entities.matchedMovie) {
      const movieSlots = matchedPairs.map((p) => p.showtime);
      const { daySlots, dayLabel, otherDates } = selectDayShowtimesAndOtherDates(movieSlots, entities);
      const groupedText = formatShowtimesGroupedByRoom(daySlots);
      const otherDatesNote =
        otherDates.length > 0
          ? `\n\n📅 *Các ngày chiếu khác: ${otherDates.join(', ')} — bạn muốn xem ngày nào cứ nhắn mình nhé!*`
          : '';
      const firstOpenSlot = daySlots.find((s) => s.availableSeats > 0) || null;

      return {
        reply: `🕒 **Lịch chiếu phim ${entities.matchedMovie.title} — ${dayLabel}:**\n\n${groupedText}${otherDatesNote}`,
        movieCard: firstOpenSlot ? buildSafeMovieCard(firstOpenSlot, entities.matchedMovie, nowDate) : null,
        movieCards: buildInteractiveMovieCards([{ movie: entities.matchedMovie, showtimes: daySlots }], nowDate),
        quickReplies:
          otherDates.length > 0
            ? [`Lịch chiếu ${entities.matchedMovie.title} ngày mai`, `Giá vé phim ${entities.matchedMovie.title}`]
            : [`Giá vé phim ${entities.matchedMovie.title}`],
        recommendedMovie: entities.matchedMovie.title,
      };
    }

    const lines = matchedPairs
      .slice(0, 9)
      .map(({ movie, showtime }) =>
        formatShowtimeLine(showtime, !entities.matchedMovie, movie.title)
      )
      .join('\n');

    const firstOpen = matchedPairs.find(({ showtime }) => showtime.availableSeats > 0);
    const movieCards = buildInteractiveCardsFromPairs(matchedPairs, nowDate);

    return {
      reply: `🕒 **Lịch chiếu thực tế cho ${descText}:**\n\n${lines}`,
      movieCard: firstOpen ? buildSafeMovieCard(firstOpen.showtime, firstOpen.movie, nowDate) : null,
      movieCards,
      recommendedMovie: firstOpen ? firstOpen.movie.title : matchedPairs[0].movie.title,
    };
  }

  // =========================================================================
  // 9. BOOKING_GUIDE (Xin link đặt vé / hướng dẫn đặt vé / chính sách đổi trả)
  // =========================================================================
  if (intent === INTENTS.BOOKING_GUIDE) {
    if (/\b(hoàn\s+vé|đổi\s+vé|hủy\s+vé|trả\s+vé|hoàn\s+tiền)\b/i.test(lower)) {
      return {
        reply: `📌 **Chính sách Đổi / Hoàn vé tại ${cinemaName}:**\n• Vé đã thanh toán thành công không áp dụng hoàn tiền mặt.\n• Hệ thống hỗ trợ **đổi sang suất chiếu khác** nếu bạn liên hệ trước giờ chiếu tối thiểu **60 phút** tại quầy dịch vụ hoặc qua Hotline **${cinemaHotline}**.\n\n👉 [Gửi yêu cầu đổi suất tại trang Hỗ trợ ➔](/support) • [Xem Vé của tôi ➔](/my-tickets)`,
        movieCard: null,
        movieCards: [],
        quickReplies: ['Kiểm tra vé của tôi', 'Liên hệ nhân viên hỗ trợ'],
        recommendedMovie: '',
      };
    }

    // Tìm suất chiếu đã xác định trong ngữ cảnh hội thoại
    let targetMovie = entities.matchedMovie;
    let targetShowtime = null;

    if (entities.contextShowtimeId) {
      for (const m of movies) {
        const st = (m.showtimes || []).find(
          (s) => String(s.showtimeId) === String(entities.contextShowtimeId)
        );
        if (st) {
          targetMovie = m;
          targetShowtime = st;
          break;
        }
      }
    }

    if (!targetShowtime && targetMovie) {
      const filtered = filterShowtimesByEntities(targetMovie.showtimes || [], entities);
      targetShowtime =
        filtered.find((s) => s.availableSeats > 0) ||
        (targetMovie.showtimes || []).find((s) => s.availableSeats > 0) ||
        filtered[0] ||
        null;
    }

    if (targetMovie && targetShowtime) {
      if (!targetShowtime.bookingLink || targetShowtime.availableSeats <= 0) {
        return {
          reply: `⚠️ Rất tiếc, suất chiếu phim **${targetMovie.title}** lúc **${targetShowtime.time}** (${targetShowtime.roomName}) hiện đã **HẾT GHẾ (0 ghế trống)** hoặc đã đóng bán nên hệ thống không thể tạo link đặt vé. Bạn vui lòng chọn suất chiếu khác nhé!`,
          movieCard: null,
          recommendedMovie: targetMovie.title,
        };
      }

      return {
        reply: `🎟️ **Link đặt vé chính thức cho suất chiếu bạn đã chọn:**\n\n• **Phim:** **${targetMovie.title}** (${targetMovie.ageRating})\n• **Suất chiếu:** **${targetShowtime.time}** (${targetShowtime.relativeDayLabel})\n• **Phòng chiếu:** **${targetShowtime.roomName}** (${targetShowtime.format}) — ${targetShowtime.cinemaName}\n• **Giá vé:** Thường **${targetShowtime.priceFormatted}** | VIP **${targetShowtime.priceVipFormatted}** | Còn **${targetShowtime.availableSeats}** ghế trống\n\n👉 [Đặt vé & Chọn ghế ngay ➔](${targetShowtime.bookingLink})`,
        movieCard: buildSafeMovieCard(targetShowtime, targetMovie, nowDate),
        recommendedMovie: targetMovie.title,
      };
    }

    // Nếu chưa biết khách muốn đặt phim nào -> Hỏi lại lịch sự kèm hướng dẫn
    return {
      reply: `🎟️ Để gửi đúng **link đặt vé trực tiếp**, bạn vui lòng cho mình biết **tên bộ phim** và **khung giờ chiếu** bạn muốn xem nhé!\n\n📌 **Quy trình đặt vé nhanh tại D'AVENOR CINEMA:**\n1. Chọn phim và suất chiếu mong muốn.\n2. Chọn vị trí ghế trống trên sơ đồ phòng chiếu.\n3. Chọn thêm Combo bắp nước & nhập mã Voucher (nếu có).\n4. Thanh toán qua QR VNPay / MoMo / Thẻ ngân hàng và nhận mã vé QR điện tử.`,
      movieCard: null,
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 10. PROMOTION_VOUCHER (Đồng bộ ưu đãi theo thứ + các khuyến mãi đang ACTIVE từ DB)
  // =========================================================================
  if (intent === INTENTS.PROMOTION_VOUCHER) {
    const targetDealDate = entities.dateFilter?.startOfDay || nowDate;
    const dailyDeal = getDailyDealForDate(targetDealDate);
    const dayPrefix = entities.dateFilter?.label
      ? `${entities.dateFilter.label} (${dailyDeal.weekdayName})`
      : `Hôm nay — ${dailyDeal.weekdayName} (${dailyDeal.shortDate})`;

    const dailySection = `⚡ **Ưu đãi nổi bật ${dayPrefix}:**\n• **${dailyDeal.title}** — Mã: **\`${dailyDeal.code}\`** (${dailyDeal.discountTag})\n  _${dailyDeal.description}_`;

    const promoLines = (promotions || []).slice(0, 6).map((p) => {
      const codeBadge = p.code ? ` — Mã: **\`${p.code}\`**` : '';
      const discountInfo =
        p.discountPercent > 0
          ? `Giảm **${p.discountPercent}%**`
          : p.discountAmount > 0
            ? `Giảm **${formatVND(p.discountAmount)}**`
            : p.discountValue
              ? `**${p.discountValue}**`
              : p.badgeText
                ? `**${p.badgeText}**`
                : '';
      const minOrder =
        p.minOrderValue > 0 ? ` (Đơn tối thiểu ${formatVND(p.minOrderValue)})` : '';
      const expiry = p.endDate ? ` • ${String(p.endDate).startsWith('HSD') ? p.endDate : `HSD: ${p.endDate}`}` : '';
      return `• 🎁 **${p.title}**${codeBadge}${discountInfo ? `: ${discountInfo}` : ''}${minOrder}${expiry}${p.description ? `\n  _${p.description}_` : ''}`;
    });

    const dbSection =
      promoLines.length > 0
        ? `\n\n🎟️ **Kho Voucher & Chương trình đang áp dụng tại ${cinemaName}:**\n${promoLines.join('\n\n')}`
        : '';

    return {
      reply: `🎉 **Ưu đãi & Khuyến mãi tại ${cinemaName}:**\n\n${dailySection}${dbSection}\n\n👉 [Xem đầy đủ trang Ưu đãi ➔](/promotions)`,
      movieCard: null,
      movieCards: [],
      quickReplies: ['Ngày mai có ưu đãi gì?', 'Các bộ phim đang chiếu hiện tại?'],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 11. CONCESSION_COMBO (Bảng giá Combo bắp nước thực tế từ Database)
  // =========================================================================
  if (intent === INTENTS.CONCESSION_COMBO) {
    if (!concessions || concessions.length === 0) {
      return {
        reply: `Hiện tại danh sách Combo bắp nước đang được cập nhật trên hệ thống. Bạn có thể xem trực tiếp ở bước chọn bắp nước khi đặt vé trên website nhé!`,
        movieCard: null,
        recommendedMovie: '',
      };
    }

    const comboLines = concessions.map(
      (c) =>
        `• 🍿 **${c.name}** — Giá: **${c.priceFormatted}**${c.badge ? ` _(${c.badge})_` : ''}\n  _${c.description}_`
    );

    return {
      reply: `🍿 **Thực đơn Combo Bắp Nước chính thức tại quầy Concessions D'AVENOR CINEMA:**\n\n${comboLines.join('\n\n')}\n\n💡 Bạn có thể chọn kèm Combo ngay ở bước đặt ghế để được chuẩn bị sẵn trước giờ vào phòng chiếu nhé!`,
      movieCard: null,
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 12. CINEMA_LOCATION (Địa chỉ cụm rạp, giờ mở cửa & tiện ích gửi xe)
  // =========================================================================
  if (intent === INTENTS.CINEMA_LOCATION) {
    const cinemaLines = cinemas
      .map(
        (c) =>
          `• 📍 **${c.name}**: ${c.address}${c.openingHours ? ` (Mở cửa: **${c.openingHours}**)` : ''}`
      )
      .join('\n');
    return {
      reply: `📍 **Thông tin cụm rạp D'AVENOR CINEMA:**\n\n${cinemaLines}\n\n📞 **Hotline:** **${cinemaHotline}** | 🕒 **Giờ mở cửa:** **${cinemaHours}**\n🛵 **Gửi xe:** ${primaryCinema.parking || 'Hầm giữ xe B1–B2 TTTM Thanh Khê Plaza 24/7.'}`,
      movieCard: null,
      movieCards: [],
      quickReplies: ['Các bộ phim đang chiếu hiện tại?', 'Giá vé hôm nay bao nhiêu?'],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 13. PAYMENT_SUPPORT (Hỗ trợ phương thức thanh toán & chuyển tiếp Hỗ trợ)
  // =========================================================================
  if (intent === INTENTS.PAYMENT_SUPPORT) {
    return {
      reply: `💳 **Hỗ trợ Thanh toán tại ${cinemaName}:**\n\n• **Phương thức hỗ trợ:** Quét mã **VNPAY-QR**, Ví **MoMo**, **ZaloPay**, và Thẻ ngân hàng **ATM / Napas / Visa / Mastercard**.\n• **Thời gian giữ ghế:** Hệ thống giữ ghế tối đa **10 phút** trong lúc thanh toán.\n• **Xử lý sự cố trừ tiền chưa nhận vé:** Bạn có thể kiểm tra lại ở mục [Vé của tôi ➔](/my-tickets), gửi phiếu đối soát ngay tại [Trung tâm Hỗ trợ ➔](/support) hoặc gọi Hotline **${cinemaHotline}** để được xử lý tức thì.`,
      movieCard: null,
      movieCards: [],
      quickReplies: ['Kiểm tra vé của tôi', 'Liên hệ nhân viên hỗ trợ'],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 13b. CUSTOMER_SUPPORT (Quy định đồ ăn ngoài, mất mã vé, tài khoản, liên hệ CSKH)
  // =========================================================================
  if (intent === INTENTS.CUSTOMER_SUPPORT) {
    const noToneMsg = removeVietnameseTones(userMessage);

    if (/\b(mang\s+do\s+an|do\s+an\s+(tu\s+)?ben\s+ngoai|thuc\s+an\s+ben\s+ngoai)\b/i.test(noToneMsg)) {
      return {
        reply: `🍿 **Quy định về đồ ăn & thức uống tại ${cinemaName}:**\n• Để đảm bảo vệ sinh và trải nghiệm chung trong phòng chiếu, rạp **không cho phép mang đồ ăn và thức uống từ bên ngoài** vào phòng chiếu.\n• Bạn có thể chọn các phần **Combo Bắp Nước** chính thức tại quầy hoặc đặt kèm ngay khi chọn ghế để nhận nhanh tại làn **F&B FastTrack** nhé!`,
        movieCard: null,
        movieCards: [],
        quickReplies: ['Xem bảng giá Combo bắp nước', 'Các bộ phim đang chiếu hiện tại?'],
        recommendedMovie: '',
      };
    }

    if (/\b(mat\s+ma\s+ve|quen\s+ma\s+ve)\b/i.test(noToneMsg)) {
      return {
        reply: `🎟️ **Cách lấy lại mã vé khi bị mất hoặc quên mã QR:**\n1. Đăng nhập tài khoản và mở mục [Vé của tôi ➔](/my-tickets) để xem lại mã QR điện tử.\n2. Hoặc nhắn trực tiếp cho mình **"Kiểm tra vé của tôi"** (khi đã đăng nhập).\n3. Nếu cần hỗ trợ khẩn cấp trước giờ chiếu, bạn liên hệ Hotline **${cinemaHotline}** hoặc gửi yêu cầu tại [Trang Hỗ trợ ➔](/support).`,
        movieCard: null,
        movieCards: [],
        quickReplies: ['Kiểm tra vé của tôi', 'Liên hệ nhân viên hỗ trợ'],
        recommendedMovie: '',
      };
    }

    if (/\b(doi\s+mat\s+khau|quen\s+mat\s+khau|dang\s+ky\s+tai\s+khoan|tao\s+tai\s+khoan)\b/i.test(noToneMsg)) {
      return {
        reply: `👤 **Hướng dẫn Tài khoản thành viên ${cinemaName}:**\n• Để đăng ký tài khoản mới hoặc đăng nhập, bạn truy cập [Trang Đăng nhập / Đăng ký ➔](/auth).\n• Nếu quên mật khẩu hoặc gặp sự cố tài khoản, bạn có thể gửi yêu cầu hỗ trợ tại [Trung tâm Hỗ trợ ➔](/support) hoặc gọi Hotline **${cinemaHotline}** để được cấp lại nhanh chóng.`,
        movieCard: null,
        movieCards: [],
        quickReplies: ['Ưu đãi hôm nay có gì?', 'Các bộ phim đang chiếu hiện tại?'],
        recommendedMovie: '',
      };
    }

    return {
      reply: `🎧 **Kết nối Đội ngũ Chăm sóc Khách hàng ${cinemaName}:**\n\n• 📞 **Hotline:** **${cinemaHotline}** (${cinemaHours})\n• ✉️ **Email hỗ trợ & khiếu nại:** **support@davenor.vn**\n• 📍 **Quầy CSKH trực tiếp:** ${primaryCinema.address}\n\nBạn có thể gửi phiếu yêu cầu / khiếu nại trực tuyến để chuyên viên phản hồi trong khoảng **15 phút**:\n👉 [Mở Trung tâm Hỗ trợ & Gửi phiếu ➔](/support)`,
      movieCard: null,
      movieCards: [],
      quickReplies: ['Kiểm tra vé của tôi', 'Chính sách đổi/hủy vé'],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 14. UNKNOWN / CÂU HỎI MƠ HỒ (VD: "Tôi muốn ăn gì đó" hoặc câu ngoài phạm vi)
  // =========================================================================
  if (/\b(ăn\s+gì|đói\s+bụng|muốn\s+ăn|đồ\s+ăn)\b/i.test(lower)) {
    return {
      reply: `Tại rạp **D'AVENOR CINEMA**, tụi mình có phục vụ các phần **Combo Bắp Rang Bơ (vị Phô mai / Caramel) và Nước ngọt** thơm ngon để nhâm nhi khi xem phim. 🍿🥤\n\nBạn có muốn mình gửi bảng giá **Combo Bắp Nước** hiện có tại rạp hoặc gợi ý một bộ phim hay để vừa xem vừa thưởng thức không?`,
      movieCard: null,
      recommendedMovie: '',
    };
  }

  return {
    reply: `Mình chưa nắm rõ toàn bộ ý câu hỏi của **${displayName}**. Tại **D'AVENOR CINEMA**, mình có thể hỗ trợ chính xác cho bạn về:\n• 🎬 Danh sách phim đang chiếu (hôm nay, ngày mai, theo độ tuổi P/T13/T16/T18)\n• 🕒 Lịch chiếu thực tế theo khung giờ & định dạng (2D / RealD 3D / IMAX)\n• 💺 Kiểm tra số ghế trống & tìm dãy ghế liền nhau\n• 🎟️ Báo giá vé theo hạng ghế (Standard / VIP / Sweetbox), Combo bắp nước & Voucher\n\nBạn vui lòng cho mình biết thêm tên phim hoặc thông tin bạn cần tra cứu nhé!`,
    movieCard: null,
    recommendedMovie: '',
  };
};

