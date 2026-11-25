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

const getRoomDisplayGroup = (st = {}, isEn = false) => {
  const label = `${st.format || ''} ${st.roomName || ''} ${st.formatFeature || ''}`.toUpperCase();
  if (label.includes('IMAX')) return isEn ? 'IMAX Laser Hall' : 'Phòng chiếu IMAX Laser';
  if (label.includes('GOLD')) return isEn ? 'Gold Class Hall' : 'Phòng chiếu Gold Class';
  if (label.includes('DOLBY') || label.includes('2D')) return isEn ? 'Dolby Atmos Hall' : 'Phòng chiếu Dolby Atmos';
  return st.roomName || (isEn ? 'Standard Hall' : 'Phòng chiếu tiêu chuẩn');
};

const sortShowtimesForDisplay = (slots = []) =>
  [...slots].sort((a, b) => {
    const rankDiff = getRoomSortRank(a) - getRoomSortRank(b);
    if (rankDiff !== 0) return rankDiff;
    return (a.dayMinutes || 0) - (b.dayMinutes || 0);
  });

const selectDayShowtimesAndOtherDates = (slots = [], entities = {}, isEn = false) => {
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
  const dayLabel = isEn
    ? entities.dateFilter?.labelEn || daySlots[0]?.date || targetDateKey
    : daySlots[0]?.relativeDayLabel || entities.dateFilter?.label || targetDateKey;
  const otherDates = orderedDateKeys
    .filter((k) => k !== targetDateKey)
    .slice(0, 6)
    .map((k) => {
      const sample = byDateKey.get(k)?.[0];
      return sample?.shortDate || k;
    });

  return { daySlots, dayLabel, otherDates };
};

const formatDisplayFormat = (format = '') => {
  const f = String(format || '').toUpperCase();
  if (f === 'GOLD_CLASS') return 'Gold Class';
  if (f === 'IMAX') return 'IMAX Laser';
  if (f === '3D') return 'RealD 3D';
  if (f === '2D') return '2D Dolby Atmos';
  return format || '2D';
};

const formatShowtimesGroupedByRoom = (slots = [], isEn = false) => {
  const ordered = sortShowtimesForDisplay(slots);
  const byRoom = new Map();

  for (const st of ordered) {
    const groupName = getRoomDisplayGroup(st, isEn);
    if (!byRoom.has(groupName)) byRoom.set(groupName, []);
    byRoom.get(groupName).push(st);
  }

  const sections = [];
  for (const [groupName, roomSlots] of byRoom.entries()) {
    const slotLines = roomSlots.map((st) => {
      const total = Number(st.totalSeats) > 0 ? st.totalSeats : 88;
      const fmtText = formatDisplayFormat(st.format);
      if (isEn) {
        const seatText =
          st.availableSeats > 0
            ? `**${st.availableSeats}/${total}** seats available`
            : `**SOLD OUT (0/${total})**`;
        const linkText =
          st.bookingLink && st.availableSeats > 0 ? ` — [Select seats ➔](${st.bookingLink})` : '';
        return `• **${st.time}** (${st.date}) | ${st.roomName} | ${fmtText} | **${st.priceFormatted}** | ${seatText}${linkText}`;
      }
      const seatText =
        st.availableSeats > 0
          ? `Còn **${st.availableSeats}/${total}** ghế`
          : `**HẾT GHẾ (0/${total})**`;
      const linkText =
        st.bookingLink && st.availableSeats > 0 ? ` — [Chọn ghế ➔](${st.bookingLink})` : '';
      return `• **${st.time}** (${st.date}) | ${fmtText} | **${st.priceFormatted}** | ${seatText}${linkText}`;
    });
    sections.push(`🎬 **${groupName}**\n${slotLines.join('\n')}`);
  }

  return sections.join('\n\n');
};

const summarizeMovieSlotsCompact = (slots = [], isEn = false) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return isEn ? 'No open showtimes yet' : 'Chưa có suất chiếu mở bán';
  }
  const orderedByTime = [...slots].sort((a, b) => (a.dayMinutes || 0) - (b.dayMinutes || 0));
  const distinctTimes = [...new Set(orderedByTime.map((s) => s.time).filter(Boolean))];
  const minPrice = Math.min(
    ...orderedByTime.map((s) => Number(s.priceStandard || s.price || 0)).filter((p) => p > 0)
  );
  const formats = [...new Set(sortShowtimesForDisplay(slots).map((s) => formatDisplayFormat(s.format)))];
  if (isEn) {
    const priceText = Number.isFinite(minPrice) && minPrice > 0 ? ` • From **${formatVND(minPrice)}**` : '';
    const formatText = formats.length > 0 ? ` (${formats.join(' / ')})` : '';
    return `Showtimes: ${distinctTimes.map((t) => `**${t}**`).join(', ')}${priceText}${formatText}`;
  }
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

export const buildInteractiveMovieCards = (movieGroups = [], nowDate = new Date()) => {
  if (!Array.isArray(movieGroups) || movieGroups.length === 0) return [];
  const cards = [];
  const isSingleMovie = movieGroups.length === 1;
  const maxSlotsPerCard = isSingleMovie ? 12 : 4;

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

  return buildInteractiveMovieCards([...byMovieId.values()].slice(0, 8), nowDate);
};

export const filterShowtimesByEntities = (showtimes = [], entities = {}) => {
  if (!Array.isArray(showtimes) || showtimes.length === 0) return [];

  return showtimes.filter((st) => {
    if (entities.dateFilter?.dateKey && st.dateKey !== entities.dateFilter.dateKey) {
      return false;
    }
    if (entities.format && st.format !== entities.format) {
      return false;
    }
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
    if (entities.cinemaLocation) {
      const locNoTone = removeVietnameseTones(entities.cinemaLocation);
      const stCinemaNoTone = removeVietnameseTones(st.cinemaName || '');
      if (!stCinemaNoTone.includes(locNoTone) && !locNoTone.includes(stCinemaNoTone)) {
        return false;
      }
    }
    if (entities.maxPrice && st.priceStandard > entities.maxPrice) {
      return false;
    }
    return true;
  });
};

const formatShowtimeLine = (st, includeMovieTitle = false, movieTitle = '', isEn = false) => {
  const prefix = includeMovieTitle && movieTitle ? `🎬 **${movieTitle}** — ` : '';
  const totalSeats = Number(st.totalSeats) > 0 ? st.totalSeats : 88;
  const fmtDisplay = formatDisplayFormat(st.format);
  if (isEn) {
    const seatStatus =
      st.availableSeats > 0
        ? `**${st.availableSeats}/${totalSeats}** seats left`
        : `**SOLD OUT (0/${totalSeats})**`;
    const linkMarkdown =
      st.bookingLink && st.availableSeats > 0 ? ` — [Book now ➔](${st.bookingLink})` : '';
    return `• ${prefix}**${st.time}** (${st.date}) | Room: **${st.roomName}** | Format: **${fmtDisplay}** | Price: **${st.priceFormatted}** | ${seatStatus}${linkMarkdown}`;
  }

  const seatStatus =
    st.availableSeats > 0
      ? `Còn **${st.availableSeats}/${totalSeats}** ghế trống`
      : `**HẾT GHẾ (0/${totalSeats} ghế)**`;
  const linkMarkdown =
    st.bookingLink && st.availableSeats > 0 ? ` — [Đặt vé ngay ➔](${st.bookingLink})` : '';

  return `• ${prefix}**${st.time}** (${st.relativeDayLabel} - ${st.date}) | Phòng: **${st.roomName}** | Định dạng: **${fmtDisplay}** | Giá từ: **${st.priceFormatted}** (VIP: ${st.priceVipFormatted}) | ${seatStatus}${linkMarkdown}`;
};

const buildAdvisoryReason = (movie, entities = {}, isEn = false) => {
  const gNoTone = removeVietnameseTones(movie.genre || '');
  if (entities.audienceGroup === 'FAMILY' || entities.viewerAge !== null) {
    return isEn
      ? `Great choice for family viewing (rated ${movie.ageRating}) with warm, accessible storytelling.`
      : `Phù hợp xem cùng gia đình (phân loại ${movie.ageRating}), nội dung dễ theo dõi và giàu cảm xúc.`;
  }
  if (entities.audienceGroup === 'COUPLE') {
    return isEn
      ? 'Ideal for a date night with engaging emotions and memorable atmosphere.'
      : 'Rất hợp để đi xem cùng người yêu nhờ mạch cảm xúc cuốn hút và không khí lãng mạn/sâu lắng.';
  }
  if (entities.audienceGroup === 'FRIENDS') {
    return isEn
      ? 'Exciting pacing and entertainment value, great for watching with friends.'
      : 'Nhịp phim sôi động, giải trí cao, rất hợp để thưởng thức cùng hội bạn bè.';
  }
  if (gNoTone.includes('hanh dong') || gNoTone.includes('vien tuong')) {
    return isEn
      ? `High-impact visuals and thrilling pace (rated ⭐ ${movie.rating}/5).`
      : `Kỹ xảo hoành tráng, nhịp phim kịch tính, đạt điểm đánh giá ⭐ ${movie.rating}/5.`;
  }
  if (gNoTone.includes('tam ly') || gNoTone.includes('tinh cam')) {
    return isEn
      ? `Deep emotional storyline and strong acting performances (⭐ ${movie.rating}/5).`
      : `Cốt truyện giàu chiều sâu cảm xúc, diễn xuất ấn tượng (⭐ ${movie.rating}/5).`;
  }
  return isEn
    ? `Well-rated ${movie.genre} release currently showing (⭐ ${movie.rating}/5).`
    : `Tác phẩm nổi bật thuộc dòng phim ${movie.genre} đang được khán giả đánh giá cao (⭐ ${movie.rating}/5).`;
};

const trimDescription = (desc = '', maxLen = 180, isEn = false) => {
  const clean = String(desc || '').replace(/\s+/g, ' ').trim();
  if (!clean) return isEn ? 'Synopsis is being updated.' : 'Nội dung tóm tắt đang cập nhật.';
  return clean.length > maxLen ? `${clean.slice(0, maxLen).trim()}...` : clean;
};

/**
 * Xây dựng phản hồi xác thực 100% từ dữ liệu MongoDB cho từng Intent (Song ngữ Việt - Anh, không tạo gợi ý câu hỏi tự động)
 */
export const buildVerifiedDatabaseResponse = ({
  userMessage = '',
  intent = INTENTS.UNKNOWN,
  entities = {},
  contextData = {},
  userInfo = { userName: 'Khách vãng lai' },
  nowDate = new Date(),
  handoffTicket = null,
}) => {
  const {
    movies = [],
    cinemas = [],
    rooms = [],
    roomSummary = null,
    systemFaqs = [],
    concessions = [],
    promotions = [],
  } = contextData;

  const isEn = entities.language === 'en';
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
    userInfo?.userName && userInfo.userName !== 'Khách vãng lai'
      ? userInfo.userName
      : isEn
        ? 'there'
        : 'bạn';
  const lower = String(userMessage || '').toLowerCase().trim();

  // =========================================================================
  // -1. OUT_OF_SCOPE (Câu hỏi ngoài phạm vi rạp chiếu phim)
  // =========================================================================
  if (intent === INTENTS.OUT_OF_SCOPE) {
    return {
      reply: isEn
        ? `I only assist with movies, showtimes, seat availability, ticket booking, and policies at **${cinemaName}**. Let me know if you need help checking movies or showtimes!`
        : `Mình chỉ hỗ trợ tra cứu phim, lịch chiếu, ghế trống, đặt vé và chính sách tại **${cinemaName}** — bạn cần mình kiểm tra thông tin phim hay suất chiếu nào không?`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 0. KHÁCH HỎI LỊCH CHIẾU ĐÃ QUA (Mục 15)
  // =========================================================================
  if (
    entities.dateFilter?.isPastDate &&
    [INTENTS.SHOWTIME_SEARCH, INTENTS.SHOWTIME_3D, INTENTS.MOVIE_SEARCH, INTENTS.SEAT_AVAILABILITY].includes(intent)
  ) {
    return {
      reply: isEn
        ? `Showtimes for **${entities.dateFilter.labelEn || entities.dateFilter.displayDate}** have already passed. Would you like me to check showtimes for **today** or **tomorrow** instead?`
        : `Lịch chiếu của **${entities.dateFilter.label}** đã qua nên không còn mở bán. Bạn có muốn mình kiểm tra lịch chiếu **hôm nay** hoặc **ngày mai** không?`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 0b. NẾU KHÁCH HỎI ĐÍCH DANH MỘT PHIM KHÔNG CÓ TRONG DATABASE
  // =========================================================================
  if (entities.unmatchedMovieTitle && !entities.matchedMovie) {
    const activeMovies = movies.filter((m) => m.status === 'NOW_SHOWING').slice(0, 5);
    const activeMovieTitles = activeMovies.map((m) => `**${m.title}** (${m.ageRating})`).join(', ');

    if (isEn) {
      const suggestionPart = activeMovieTitles
        ? ` Currently showing at **${cinemaName}**: ${activeMovieTitles}.`
        : '';
      return {
        reply: `**"${entities.unmatchedMovieTitle}"** is not in the currently showing list and has no scheduled showtimes at **${cinemaName}**.${suggestionPart}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    const suggestionPart = activeMovieTitles
      ? `\n\nHiện rạp đang chiếu các phim: ${activeMovieTitles}. Bạn muốn kiểm tra suất chiếu của bộ phim nào trong danh sách này?`
      : '';

    return {
      reply: `Hiện tại phim **"${entities.unmatchedMovieTitle}"** không có trong danh sách đang chiếu và chưa có lịch chiếu tại hệ thống **${cinemaName}**.${suggestionPart}`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 1. GENERAL_CHAT (Chào hỏi, cảm ơn, hỏi thông tin trợ lý — ngắn gọn, tự nhiên)
  // =========================================================================
  if (intent === INTENTS.GENERAL_CHAT) {
    if (/^(cảm\s+ơn|cám\s+ơn|cam\s+on|thank|thanks|tks|tk|ty|thx|ok(e|i|ie|ela)?(\s+(cảm\s+ơn|cam\s+on|nha|nè|ad))?)/i.test(lower)) {
      return {
        reply: isEn
          ? `You're welcome! Enjoy your movie at **${cinemaName}**. Let me know anytime if you need help with showtimes or tickets.`
          : `Rất vui được hỗ trợ **${displayName}**! Chúc bạn xem phim vui vẻ tại **${cinemaName}**. Cần kiểm tra thêm lịch chiếu hay vé, bạn cứ nhắn mình nhé!`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    if (/^(tạm\s+biệt|tam\s+biet|bye|good\s*bye|pp|bai|bái\s+bai|hẹn\s+gặp\s+lại)/i.test(lower)) {
      return {
        reply: isEn
          ? `Goodbye! See you soon at **${cinemaName}**!`
          : `Tạm biệt **${displayName}**! Hẹn gặp lại bạn tại **${cinemaName}** nhé!`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    const totalShowing = movies.filter((m) => m.status === 'NOW_SHOWING').length;
    return {
      reply: isEn
        ? `Hello! I'm the cinema assistant for **${cinemaName}** (currently serving **${totalShowing}** movies). How can I help you with movie recommendations, showtimes, seat availability, or ticket booking today?`
        : `Chào **${displayName}**! Mình là trợ lý tư vấn của **${cinemaName}** (hiện đang phục vụ **${totalShowing} bộ phim**). Mình có thể hỗ trợ bạn tư vấn phim, xem lịch chiếu, kiểm tra ghế trống, đặt vé hoặc giải đáp chính sách rạp nhé!`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 1b. ROOM_INFO (Mục 4: Thông tin phòng chiếu từ MongoDB)
  // =========================================================================
  if (intent === INTENTS.ROOM_INFO) {
    const noToneMsg = removeVietnameseTones(userMessage);
    const roomTypesList = roomSummary?.roomTypes || [];
    const totalPhysicalRooms = roomSummary?.totalRooms ?? rooms.length;
    const declaredTypeNames = roomTypesList.map((rt) => rt.roomType);

    // Nếu dữ liệu rooms từ DB chưa có bản ghi nào
    if (totalPhysicalRooms === 0) {
      return {
        reply: isEn
          ? `Screening room data is currently not available in the system. Please check again later.`
          : `Hiện tại hệ thống chưa có dữ liệu khai báo phòng chiếu trong cơ sở dữ liệu.`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // Kiểm tra nếu khách hỏi công nghệ chưa triển khai (4DX, ScreenX, Bed Cinema...)
    const asks4DX = /\b4dx\b/i.test(noToneMsg) && !declaredTypeNames.some((t) => /4dx/i.test(t));
    const asksScreenX = /\bscreenx\b/i.test(noToneMsg) && !declaredTypeNames.some((t) => /screenx/i.test(t));
    if (asks4DX || asksScreenX) {
      const askedTech = asks4DX ? '4DX' : 'ScreenX';
      const existingTypesStr = declaredTypeNames.map((t) => `**${t}**`).join(', ');
      return {
        reply: isEn
          ? `Currently, **${cinemaName}** does **not** deploy **${askedTech}** screening rooms. Our system operates **${totalPhysicalRooms} screening rooms** across **${declaredTypeNames.length} room types**: ${existingTypesStr}.`
          : `Hiện tại hệ thống **${cinemaName}** **chưa triển khai** phòng chiếu công nghệ **${askedTech}**. Rạp đang vận hành tổng cộng **${totalPhysicalRooms} phòng chiếu** thuộc **${declaredTypeNames.length} loại phòng** thực tế gồm: ${existingTypesStr}.`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    const hasImax = declaredTypeNames.some((t) => /imax/i.test(t));
    const hasDolby = declaredTypeNames.some((t) => /dolby/i.test(t));
    const hasGold = declaredTypeNames.some((t) => /gold/i.test(t));

    // So sánh IMAX Laser vs Dolby Atmos
    if (entities.roomSubQuery === 'COMPARE') {
      if (hasImax && hasDolby) {
        const imaxInfo = roomTypesList.find((t) => /imax/i.test(t.roomType));
        const dolbyInfo = roomTypesList.find((t) => /dolby/i.test(t.roomType));
        return {
          reply: isEn
            ? `At **${cinemaName}**, **IMAX Laser** and **Dolby Atmos** differ in projection and sound focus:\n\n• **IMAX Laser** (${imaxInfo.totalCount} room(s), ${imaxInfo.totalSeatsPerRoom} seats/room): Uses **4K Laser projection** on a giant curved floor-to-ceiling screen for maximum brightness, contrast, and expanded aspect ratio, paired with precision multi-channel IMAX audio.\n• **Dolby Atmos** (${dolbyInfo.totalCount} room(s), ${dolbyInfo.totalSeatsPerRoom} seats/room): Standard 2D digital projection focused on **360° object-based surround sound** (overhead & surround speakers moving sound around the auditorium) at a more economical ticket price than IMAX Laser.`
            : `Tại **${cinemaName}**, sự khác nhau giữa **IMAX Laser** và **Dolby Atmos** như sau:\n\n• **IMAX Laser** (${imaxInfo.totalCount} phòng, ${imaxInfo.totalSeatsPerRoom} ghế/phòng): Nổi bật về **hình ảnh khổ lớn kết hợp âm thanh IMAX** — sử dụng máy chiếu Laser 4K độ sáng và tương phản cao trên màn hình cong tràn viền cỡ đại (${imaxInfo.sampleFeature || 'Màn hình cong Laser 4K'}).\n• **Dolby Atmos** (${dolbyInfo.totalCount} phòng, ${dolbyInfo.totalSeatsPerRoom} ghế/phòng): Tập trung vào **công nghệ âm thanh vòm đa chiều 360°** với hệ thống loa trần và bao quanh khán phòng giúp âm thanh di chuyển chân thực theo vật thể trên màn ảnh (${dolbyInfo.sampleFeature || 'Âm thanh vòm 360°'}), mức giá vé mềm hơn so với IMAX Laser.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }
    }

    // Hỏi riêng Gold Class có gì đặc biệt
    if (entities.roomSubQuery === 'GOLD_CLASS') {
      if (!hasGold) {
        return {
          reply: isEn
            ? `**${cinemaName}** currently does not have a **Gold Class** room configured in the system. Available room types: ${declaredTypeNames.map((t) => `**${t}**`).join(', ')}.`
            : `Hiện tại hệ thống **${cinemaName}** chưa khai báo loại phòng **Gold Class**. Các loại phòng hiện có gồm: ${declaredTypeNames.map((t) => `**${t}**`).join(', ')}.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }
      const goldInfo = roomTypesList.find((t) => /gold/i.test(t.roomType));
      return {
        reply: isEn
          ? `👑 **Gold Class at ${cinemaName}** (${goldInfo.totalCount} room(s), ${goldInfo.totalSeatsPerRoom} seats/room):\n• Premium **Gold Class** luxury auditorium featuring leather recliner seating, spacious legroom, and a quiet, upscale viewing environment (${goldInfo.sampleFeature || 'Luxury Recliner & VIP Service'}).`
          : `👑 **Điểm đặc biệt của phòng Gold Class tại ${cinemaName}** (hiện có **${goldInfo.totalCount} phòng**, mỗi phòng **${goldInfo.totalSeatsPerRoom} ghế**):\n• Không gian phòng chiếu hạng thương gia sang trọng, trang bị ghế da cao cấp êm ái, khoảng cách hàng ghế rộng rãi và trải nghiệm xem phim riêng tư (${goldInfo.sampleFeature || 'Ghế da cao cấp & không gian VIP'}).`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // Hỏi riêng IMAX Laser có gì đặc biệt
    if (entities.roomSubQuery === 'IMAX_DETAIL' && hasImax) {
      const imaxInfo = roomTypesList.find((t) => /imax/i.test(t.roomType));
      return {
        reply: isEn
          ? `🎥 **IMAX Laser at ${cinemaName}** (${imaxInfo.totalCount} room(s), ${imaxInfo.totalSeatsPerRoom} seats/room):\n• Equipped with **4K Laser projection** on a giant curved screen for ultra-high brightness/contrast and precision IMAX surround sound (${imaxInfo.sampleFeature || '4K Curved Laser Screen • IMAX Sound'}).`
          : `🎥 **Phòng chiếu IMAX Laser tại ${cinemaName}** (hiện có **${imaxInfo.totalCount} phòng**, mỗi phòng **${imaxInfo.totalSeatsPerRoom} ghế**):\n• Trang bị công nghệ máy chiếu **Laser 4K** trên màn hình cong tràn viền cỡ lớn cho độ sáng, độ tương phản vượt trội kết hợp hệ thống âm thanh IMAX sống động (${imaxInfo.sampleFeature || 'Màn hình cong Laser 4K • Âm thanh IMAX'}).`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // Hỏi riêng Dolby Atmos có gì đặc biệt
    if (entities.roomSubQuery === 'DOLBY_DETAIL' && hasDolby) {
      const dolbyInfo = roomTypesList.find((t) => /dolby/i.test(t.roomType));
      return {
        reply: isEn
          ? `🔊 **Dolby Atmos at ${cinemaName}** (${dolbyInfo.totalCount} room(s), ${dolbyInfo.totalSeatsPerRoom} seats/room):\n• Features **360° object-based surround sound** with overhead and surround speakers that move audio naturally around the auditorium (${dolbyInfo.sampleFeature || '360° Dolby Atmos Surround'}).`
          : `🔊 **Phòng chiếu Dolby Atmos tại ${cinemaName}** (hiện có **${dolbyInfo.totalCount} phòng**, mỗi phòng **${dolbyInfo.totalSeatsPerRoom} ghế**):\n• Nổi bật với hệ thống **âm thanh vòm đa chiều 360°** có loa trần và loa bao quanh khán phòng, tái tạo âm thanh di chuyển chân thực theo từng khung hình (${dolbyInfo.sampleFeature || 'Âm thanh vòm đa chiều 360°'}).`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    const activeNote =
      roomSummary.maintenanceRooms > 0
        ? isEn
          ? ` (${roomSummary.activeRooms} active, ${roomSummary.maintenanceRooms} under maintenance)`
          : ` (${roomSummary.activeRooms} phòng đang hoạt động, ${roomSummary.maintenanceRooms} phòng đang bảo trì)`
        : '';

    // Hỏi riêng tổng số phòng chiếu ("Rạp có tổng cộng bao nhiêu phòng chiếu?") -> Trả lời ngắn gọn đúng con số trước
    if (entities.roomSubQuery === 'TOTAL_COUNT_ONLY') {
      const shortBreakdown = roomTypesList
        .map((rt) => (isEn ? `**${rt.totalCount}** ${rt.roomType}` : `**${rt.totalCount}** phòng ${rt.roomType}`))
        .join(', ');
      return {
        reply: isEn
          ? `🏢 **${cinemaName}** currently has a total of **${totalPhysicalRooms} physical screening rooms**${activeNote} across **${roomTypesList.length} room types** (${shortBreakdown}).`
          : `🏢 Hệ thống **${cinemaName}** hiện có tổng cộng **${totalPhysicalRooms} phòng chiếu**${activeNote} thuộc **${roomTypesList.length} loại phòng** (${shortBreakdown}).`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // Hỏi danh sách các loại phòng chiếu thực tế (hoặc hỏi cả số lượng lẫn loại phòng)
    const typeBreakdownLines = roomTypesList.map((rt) => {
      const featurePart = rt.sampleFeature ? ` — ${rt.sampleFeature}` : '';
      return isEn
        ? `• **${rt.roomType}**: **${rt.totalCount} room(s)** (${rt.totalSeatsPerRoom} seats/room)${featurePart}`
        : `• **${rt.roomType}**: **${rt.totalCount} phòng** (${rt.totalSeatsPerRoom} ghế/phòng)${featurePart}`;
    });

    return {
      reply: isEn
        ? `🏢 **${cinemaName}** has a total of **${totalPhysicalRooms} physical screening rooms**${activeNote}, divided into **${roomTypesList.length} room types**:\n\n${typeBreakdownLines.join('\n')}`
        : `🏢 Hệ thống **${cinemaName}** hiện có tổng cộng **${totalPhysicalRooms} phòng chiếu**${activeNote}, được chia thành **${roomTypesList.length} loại phòng chiếu**:\n\n${typeBreakdownLines.join('\n')}`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 2. SHOWTIME_3D (Truy vấn chuyên biệt suất chiếu 3D)
  // =========================================================================
  if (intent === INTENTS.SHOWTIME_3D) {
    const dateLabel = entities.dateFilter
      ? isEn
        ? ` ${entities.dateFilter.labelEn || entities.dateFilter.displayDate}`
        : ` vào **${entities.dateFilter.label}**`
      : '';
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

    if (matched3DSlots.length === 0) {
      if (entities.matchedMovie) {
        const m = entities.matchedMovie;
        const otherSlots = filterShowtimesByEntities(m.showtimes || [], {
          ...entities,
          format: null,
        });

        if (otherSlots.length > 0) {
          const altLines = otherSlots
            .slice(0, 5)
            .map((st) => formatShowtimeLine(st, false, '', isEn))
            .join('\n');
          return {
            reply: isEn
              ? `**${m.title}** currently has **no 3D showtimes**${dateLabel} at **${cinemaName}**. Available showtimes in **${m.supportedFormats.join(', ')}**:\n${altLines}`
              : `Hiện tại phim **${m.title}** **không có suất chiếu định dạng 3D** nào${dateLabel} trong hệ thống **${cinemaName}**.\n\nTuy nhiên, phim đang có các suất chiếu thực tế ở định dạng **${m.supportedFormats.join(', ')}**:\n${altLines}`,
            movieCard: null,
            movieCards: [],
            quickReplies: [],
            recommendedMovie: m.title,
          };
        }

        return {
          reply: isEn
            ? `**${m.title}** currently has **no 3D showtimes**${dateLabel} at **${cinemaName}**.`
            : `Hiện tại phim **${m.title}** **không có suất chiếu định dạng 3D** nào${dateLabel} trong hệ thống **${cinemaName}**.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: m.title,
        };
      }

      return {
        reply: isEn
          ? `There are currently **no 3D showtimes**${dateLabel} open for sale at **${cinemaName}**.`
          : `Hiện tại hệ thống **${cinemaName}** **không có suất chiếu định dạng 3D** nào${dateLabel} đang mở bán.`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    const lines = matched3DSlots
      .map(({ movie, showtime }) => formatShowtimeLine(showtime, !entities.matchedMovie, movie.title, isEn))
      .join('\n');

    const firstOpen = matched3DSlots.find(({ showtime }) => showtime.availableSeats > 0);
    const card = firstOpen ? buildSafeMovieCard(firstOpen.showtime, firstOpen.movie, nowDate) : null;
    const movieCards = buildInteractiveCardsFromPairs(matched3DSlots, nowDate);

    const headerTitle = isEn
      ? entities.matchedMovie
        ? `👓 **3D Showtimes for ${entities.matchedMovie.title}${dateLabel}:**`
        : `👓 **Available 3D Showtimes${dateLabel} at ${cinemaName}:**`
      : entities.matchedMovie
        ? `👓 **Lịch chiếu 3D thực tế của phim ${entities.matchedMovie.title}${dateLabel}:**`
        : `👓 **Các suất chiếu 3D đang mở bán${dateLabel} tại ${cinemaName}:**`;

    return {
      reply: `${headerTitle}\n\n${lines}`,
      movieCard: card,
      movieCards,
      quickReplies: [],
      recommendedMovie: firstOpen ? firstOpen.movie.title : matched3DSlots[0].movie.title,
    };
  }

  // =========================================================================
  // 3. SEAT_AVAILABILITY (Mục 5.1 Ghế cạnh nhau toàn rạp & Mục 5.2 Số ghế trống)
  // =========================================================================
  if (intent === INTENTS.SEAT_AVAILABILITY) {
    // 5.2: Nếu khách hỏi "Suất chiếu này còn bao nhiêu ghế trống?" / "How many seats are available?"
    // mà chưa cung cấp phim/giờ chiếu và không có ngữ cảnh suất chiếu trước đó -> chủ động hỏi lại!
    const hasSpecificTarget = Boolean(
      entities.matchedMovie ||
        entities.contextShowtimeId ||
        entities.timeFilter ||
        (entities.requireContiguousSeats && entities.dateFilter)
    );

    if (!hasSpecificTarget) {
      return {
        reply: isEn
          ? 'Which **movie** and **showtime** would you like me to check available seats for?'
          : 'Bạn muốn kiểm tra số ghế trống của **bộ phim nào** và **suất chiếu lúc mấy giờ** ạ?',
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    const targetMovies = entities.matchedMovie ? [entities.matchedMovie] : movies;
    const candidatePairs = [];

    if (entities.contextShowtimeId && !entities.timeFilter && !entities.dateFilter && !entities.requireContiguousSeats) {
      for (const m of targetMovies) {
        for (const st of m.showtimes || []) {
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
      const timeDesc = entities.timeFilter
        ? ` ${isEn ? entities.timeFilter.labelEn || entities.timeFilter.label : entities.timeFilter.label}`
        : '';
      const dateDesc = entities.dateFilter
        ? ` ${isEn ? entities.dateFilter.labelEn || entities.dateFilter.displayDate : entities.dateFilter.label}`
        : '';
      const movieDesc = entities.matchedMovie
        ? isEn
          ? ` for **${entities.matchedMovie.title}**`
          : ` cho phim **${entities.matchedMovie.title}**`
        : '';
      return {
        reply: isEn
          ? `No open showtimes were found${movieDesc}${dateDesc}${timeDesc} to check seat availability. Would you like to check another date or time?`
          : `Hiện không tìm thấy suất chiếu nào${movieDesc}${dateDesc}${timeDesc} đang mở bán trong hệ thống để kiểm tra ghế trống. Bạn có muốn kiểm tra ngày hoặc khung giờ khác không?`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: entities.matchedMovie?.title || '',
      };
    }

    const reqCount = entities.ticketQuantity || (entities.requireContiguousSeats ? 2 : 1);

    // 5.1: Tìm ghế trống nằm cạnh nhau
    if (entities.requireContiguousSeats) {
      // Trường hợp khách hỏi đúng 1 suất chiếu cụ thể (VD: "Còn 4 ghế liền nhau cho suất 21:15 không?")
      if (candidatePairs.length === 1) {
        const { movie, showtime } = candidatePairs[0];
        const total = Number(showtime.totalSeats) > 0 ? showtime.totalSeats : 88;

        if (showtime.availableSeats <= 0) {
          return {
            reply: isEn
              ? `⚠️ **${movie.title}** at **${showtime.time}** (${showtime.roomName}) is **SOLD OUT (0/${total} seats available)**, so there are no ${reqCount} adjacent seats.`
              : `⚠️ Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel}) tại **${showtime.roomName}** hiện đã **HẾT GHẾ (còn 0 ghế trống)**, vì vậy không còn ${reqCount} ghế liền nhau.`,
            movieCard: null,
            movieCards: [],
            quickReplies: [],
            recommendedMovie: movie.title,
          };
        }

        if (showtime.availableSeats < reqCount) {
          return {
            reply: isEn
              ? `⚠️ **${movie.title}** at **${showtime.time}** (${showtime.roomName}) only has **${showtime.availableSeats}** seat(s) left in total — not enough for **${reqCount} adjacent seats**.`
              : `⚠️ Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel} - ${showtime.roomName}) hiện chỉ còn tổng cộng **${showtime.availableSeats} ghế trống**, không đủ **${reqCount} ghế liền nhau** như bạn yêu cầu.`,
            movieCard: null,
            movieCards: [],
            quickReplies: [],
            recommendedMovie: movie.title,
          };
        }

        if (Array.isArray(showtime.rawSeats) && showtime.rawSeats.length > 0) {
          const contiguousBlocks = findContiguousAvailableSeats(
            showtime.rawSeats,
            reqCount,
            nowDate,
            entities.seatType
          );

          if (contiguousBlocks.length === 0) {
            return {
              reply: isEn
                ? `⚠️ **${movie.title}** at **${showtime.time}** (${showtime.roomName}) still has **${showtime.availableSeats} scattered seats**, but **NO ${reqCount} adjacent seats** in the same row.`
                : `⚠️ Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel} - ${showtime.roomName}) hiện còn **${showtime.availableSeats} ghế trống** rải rác, nhưng **KHÔNG còn cụm ${reqCount} ghế liền nhau** trên cùng một hàng ghế.\n\nBạn có thể cân nhắc chọn ghế tách rời hoặc chuyển sang suất chiếu khác nhé!`,
              movieCard: null,
              movieCards: [],
              quickReplies: [],
              recommendedMovie: movie.title,
            };
          }

          const sampleBlock = contiguousBlocks[0].join(', ');
          const secondBlock = contiguousBlocks[1]
            ? isEn
              ? ` or **${contiguousBlocks[1].join(', ')}**`
              : ` hoặc **${contiguousBlocks[1].join(', ')}**`
            : '';
          const linkPart = showtime.bookingLink
            ? isEn
              ? `\n\n👉 [Select seats for ${showtime.time} ➔](${showtime.bookingLink})`
              : `\n\n👉 [Chọn ghế ngay cho suất ${showtime.time} ➔](${showtime.bookingLink})`
            : '';

          return {
            reply: isEn
              ? `✅ **${movie.title}** at **${showtime.time}** (${showtime.date}) in **${showtime.roomName}** has **${showtime.availableSeats}/${total} available seats** with **${reqCount} adjacent seats**!\n\n💺 **Available adjacent seats:** **${sampleBlock}**${secondBlock}\n💵 **Price:** Standard ${showtime.priceFormatted} | VIP ${showtime.priceVipFormatted}${linkPart}`
              : `✅ Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel}) tại **${showtime.roomName}** hiện còn **${showtime.availableSeats} ghế trống** và **CÓ đủ ${reqCount} ghế liền nhau**!\n\n💺 **Gợi ý dãy ghế liền nhau đang trống:** **${sampleBlock}**${secondBlock}\n💵 **Giá vé:** Thường ${showtime.priceFormatted} | VIP ${showtime.priceVipFormatted}${linkPart}`,
            movieCard: buildSafeMovieCard(showtime, movie, nowDate),
            movieCards: buildInteractiveMovieCards([{ movie, showtimes: [showtime] }], nowDate),
            quickReplies: [],
            recommendedMovie: movie.title,
          };
        }

        return {
          reply: isEn
            ? `Seat layout details for **${movie.title}** (${showtime.time}) are not initialized yet.`
            : `Mình chưa xác nhận được sơ đồ ghế chi tiết của suất chiếu này.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: movie.title,
        };
      }

      // Trường hợp nhiều suất chiếu (VD: "Tối nay còn 2 ghế cạnh nhau không?"):
      // BẮT BUỘC kiểm tra TẤT CẢ các bộ phim và TẤT CẢ các phòng chiếu tương ứng!
      const matchedShowtimeResults = [];
      for (const { movie, showtime } of candidatePairs) {
        if (showtime.availableSeats < reqCount) continue;
        if (Array.isArray(showtime.rawSeats) && showtime.rawSeats.length > 0) {
          const blocks = findContiguousAvailableSeats(
            showtime.rawSeats,
            reqCount,
            nowDate,
            entities.seatType
          );
          if (blocks.length > 0) {
            matchedShowtimeResults.push({ movie, showtime, blocks });
          }
        }
      }

      if (matchedShowtimeResults.length === 0) {
        return {
          reply: isEn
            ? `I checked all **${candidatePairs.length}** matching showtimes across all movies and rooms, and none currently have **${reqCount} adjacent available seats** in the same row.`
            : `Mình đã kiểm tra toàn bộ **${candidatePairs.length} suất chiếu** tương ứng nhưng hiện **không còn suất nào có đủ ${reqCount} ghế trống nằm cạnh nhau** trên cùng một hàng. Bạn có muốn kiểm tra ngày chiếu khác không?`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      const byMovie = new Map();
      for (const item of matchedShowtimeResults) {
        const mKey = String(item.movie._id || item.movie.title);
        if (!byMovie.has(mKey)) byMovie.set(mKey, { movie: item.movie, items: [] });
        byMovie.get(mKey).items.push(item);
      }

      const movieSections = [];
      for (const { movie, items } of byMovie.values()) {
        const slotLines = items.map(({ showtime, blocks }) => {
          const total = Number(showtime.totalSeats) > 0 ? showtime.totalSeats : 88;
          const pairPreview = blocks
            .slice(0, 3)
            .map((b) => `**${b.join('-')}**`)
            .join(', ');
          const linkStr = showtime.bookingLink
            ? isEn
              ? ` — [Select seats ➔](${showtime.bookingLink})`
              : ` — [Chọn ghế ➔](${showtime.bookingLink})`
            : '';
          return isEn
            ? `  • **${showtime.time}** (${showtime.date}) | **${showtime.roomName}** (${formatDisplayFormat(showtime.format)}) | **${showtime.availableSeats}/${total}** empty — Adjacent seats: ${pairPreview}${linkStr}`
            : `  • **${showtime.time}** (${showtime.date}) | **${showtime.roomName}** (${formatDisplayFormat(showtime.format)}) | Trống **${showtime.availableSeats}/${total}** ghế — Cặp ghế trống: ${pairPreview}${linkStr}`;
        });
        movieSections.push(`🎬 **${movie.title}**\n${slotLines.join('\n')}`);
      }

      const firstMatch = matchedShowtimeResults[0];
      const interactivePairs = matchedShowtimeResults.map(({ movie, showtime }) => ({ movie, showtime }));

      return {
        reply: isEn
          ? `💺 **Showtimes with at least ${reqCount} adjacent seats available (${matchedShowtimeResults.length} showtimes across ${byMovie.size} movie(s)):**\n\n${movieSections.join('\n\n')}`
          : `💺 **Các suất chiếu còn ít nhất ${reqCount} ghế trống cạnh nhau (${matchedShowtimeResults.length} suất thuộc ${byMovie.size} phim):**\n\n${movieSections.join('\n\n')}`,
        movieCard: buildSafeMovieCard(firstMatch.showtime, firstMatch.movie, nowDate),
        movieCards: buildInteractiveCardsFromPairs(interactivePairs, nowDate),
        quickReplies: [],
        recommendedMovie: firstMatch.movie.title,
      };
    }

    // 5.2: Kiểm tra số ghế trống của 1 suất chiếu cụ thể -> Hiển thị Tổng số ghế, Đã đặt và Còn trống
    if (candidatePairs.length === 1) {
      const { movie, showtime } = candidatePairs[0];
      const total = Number(showtime.totalSeats) > 0 ? showtime.totalSeats : 88;
      const avail = Math.max(0, Number(showtime.availableSeats) || 0);
      const holding = Math.max(0, Number(showtime.holdingSeats) || 0);
      const booked = Math.max(0, total - avail - holding);

      if (avail <= 0) {
        return {
          reply: isEn
            ? `💺 **${movie.title}** — **${showtime.time}** (${showtime.date}, **${showtime.roomName}**): **SOLD OUT (0 available seats)**.\n• Total seats: **${total}** | Booked/Held: **${total}** | Available: **0**`
            : `💺 Suất chiếu phim **${movie.title}** lúc **${showtime.time}** (${showtime.relativeDayLabel}, **${showtime.roomName}**): **HẾT GHẾ (0 ghế trống)**.\n• Tổng số ghế: **${total}** | Đã đặt: **${booked}**${holding > 0 ? ` | Đang giữ chỗ: **${holding}**` : ''} | Còn trống: **0**`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: movie.title,
        };
      }

      const holdingPartVi = holding > 0 ? ` | Đang giữ chỗ: **${holding}**` : '';
      const holdingPartEn = holding > 0 ? ` | Holding: **${holding}**` : '';
      const linkStr = showtime.bookingLink
        ? isEn
          ? `\n\n👉 [Select seats ➔](${showtime.bookingLink})`
          : `\n\n👉 [Chọn ghế ngay ➔](${showtime.bookingLink})`
        : '';

      return {
        reply: isEn
          ? `💺 **Seat Availability — ${movie.title}** (**${showtime.time}**, ${showtime.date}, **${showtime.roomName}**):\n• **Total seats:** **${total}**\n• **Booked:** **${booked}**${holdingPartEn}\n• **Available seats:** **${avail}/${total}** (Price from **${showtime.priceFormatted}**)${linkStr}`
          : `💺 **Tình trạng ghế — ${movie.title}** (Suất **${showtime.time}**, ${showtime.relativeDayLabel}, **${showtime.roomName}**):\n• **Tổng số ghế:** **${total}**\n• **Số ghế đã đặt:** **${booked}**${holdingPartVi}\n• **Số ghế còn trống:** **${avail}/${total}** ghế (Giá từ **${showtime.priceFormatted}**)${linkStr}`,
        movieCard: buildSafeMovieCard(showtime, movie, nowDate),
        movieCards: buildInteractiveMovieCards([{ movie, showtimes: [showtime] }], nowDate),
        quickReplies: [],
        recommendedMovie: movie.title,
      };
    }

    // Nếu hỏi ghế trống của 1 bộ phim trong ngày (nhiều suất)
    if (entities.matchedMovie) {
      const movieSlots = candidatePairs.map((p) => p.showtime);
      const { daySlots, dayLabel, otherDates } = selectDayShowtimesAndOtherDates(movieSlots, entities, isEn);
      const groupedText = formatShowtimesGroupedByRoom(daySlots, isEn);
      const otherDatesNote =
        otherDates.length > 0
          ? isEn
            ? `\n\n📅 *Other dates available: ${otherDates.join(', ')}*`
            : `\n\n📅 *Các ngày chiếu khác của phim: ${otherDates.join(', ')}*`
          : '';
      const firstOpenSlot = daySlots.find((s) => s.availableSeats > 0) || null;

      return {
        reply: isEn
          ? `💺 **Real-time Seat Availability for ${entities.matchedMovie.title} — ${dayLabel}:**\n\n${groupedText}${otherDatesNote}`
          : `💺 **Số ghế trống thực tế phim ${entities.matchedMovie.title} — ${dayLabel}:**\n\n${groupedText}${otherDatesNote}`,
        movieCard: firstOpenSlot ? buildSafeMovieCard(firstOpenSlot, entities.matchedMovie, nowDate) : null,
        movieCards: buildInteractiveMovieCards([{ movie: entities.matchedMovie, showtimes: daySlots }], nowDate),
        quickReplies: [],
        recommendedMovie: entities.matchedMovie.title,
      };
    }

    const seatLines = candidatePairs.map(({ movie, showtime }) => {
      const total = Number(showtime.totalSeats) > 0 ? showtime.totalSeats : 88;
      const avail = Math.max(0, Number(showtime.availableSeats) || 0);
      const booked = Math.max(0, total - avail);
      if (avail <= 0) {
        return isEn
          ? `• **${movie.title}** — **${showtime.time}** (${showtime.roomName}): **SOLD OUT (0/${total} available, ${booked} booked)**`
          : `• **${movie.title}** — Suất **${showtime.time}** (${showtime.relativeDayLabel}, ${showtime.roomName}): **HẾT GHẾ (0/${total} ghế trống, đã đặt ${booked})**`;
      }
      const linkStr = showtime.bookingLink
        ? isEn
          ? ` — [Select seats ➔](${showtime.bookingLink})`
          : ` — [Chọn ghế ➔](${showtime.bookingLink})`
        : '';
      return isEn
        ? `• **${movie.title}** — **${showtime.time}** (${showtime.roomName}): **${avail}/${total}** available (${booked} booked)${linkStr}`
        : `• **${movie.title}** — Suất **${showtime.time}** (${showtime.relativeDayLabel}, ${showtime.roomName}): Còn **${avail}/${total}** ghế trống (đã đặt ${booked})${linkStr}`;
    });

    const firstOpen = candidatePairs.find(({ showtime }) => showtime.availableSeats > 0);
    return {
      reply: isEn
        ? `💺 **Real-time Seat Availability:**\n\n${seatLines.join('\n')}`
        : `💺 **Tình trạng ghế trống thực tế từ hệ thống:**\n\n${seatLines.join('\n')}`,
      movieCard: firstOpen ? buildSafeMovieCard(firstOpen.showtime, firstOpen.movie, nowDate) : null,
      movieCards: buildInteractiveCardsFromPairs(candidatePairs, nowDate),
      quickReplies: [],
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
    }

    // Nếu khách hỏi RIÊNG giá vé của 1 định dạng phòng (VD: "Giá vé IMAX bao nhiêu?", "Giá vé Gold Class bao nhiêu?")
    // mà KHÔNG nêu tên phim cụ thể -> Trả lời đúng bảng giá của định dạng phòng đó, không gán ghép sang 1 phim ngẫu nhiên!
    if (!targetMovie && !targetShowtime && entities.format) {
      const formatSlots = movies.flatMap((m) =>
        filterShowtimesByEntities(m.showtimes || [], { ...entities, format: entities.format })
      );
      const fmtLabel = formatDisplayFormat(entities.format);
      if (formatSlots.length === 0) {
        return {
          reply: isEn
            ? `Currently there are no open **${fmtLabel}** showtimes at **${cinemaName}** to look up ticket prices.`
            : `Hiện tại hệ thống **${cinemaName}** chưa có suất chiếu định dạng **${fmtLabel}** đang mở bán để tra cứu giá vé.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      const stdPrices = [...new Set(formatSlots.map((s) => s.priceStandard))].sort((a, b) => a - b);
      const vipPrices = [...new Set(formatSlots.map((s) => s.priceVip))].sort((a, b) => a - b);
      const sweetPrices = [...new Set(formatSlots.map((s) => s.priceSweetbox))].sort((a, b) => a - b);
      const fmtRange = (arr) =>
        arr.length === 1 ? formatVND(arr[0]) : `${formatVND(arr[0])} – ${formatVND(arr[arr.length - 1])}`;

      return {
        reply: isEn
          ? `🎟️ **${fmtLabel} Ticket Prices at ${cinemaName}**${qty > 1 ? ` (for ${qty} tickets: ×${qty})` : ''}:\n• **Standard:** **${fmtRange(stdPrices)} / ticket**\n• **VIP (Rows E–G):** **${fmtRange(vipPrices)} / ticket**\n• **Sweetbox Couple (Row H):** **${fmtRange(sweetPrices)} / pair**`
          : `🎟️ **Giá vé phòng chiếu ${fmtLabel} thực tế tại ${cinemaName}**${qty > 1 ? ` (nếu đặt ${qty} vé sẽ nhân tương ứng theo hạng ghế)` : ''}:\n• **Ghế Thường (Standard):** **${fmtRange(stdPrices)} / vé**\n• **Ghế VIP (Trung tâm E–G):** **${fmtRange(vipPrices)} / vé**\n• **Ghế Đôi Sweetbox (Hàng H):** **${fmtRange(sweetPrices)} / cặp**`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    if (targetMovie && targetShowtime) {
      const quoteStandard = calculateTicketQuote(targetShowtime, qty, 'STANDARD');
      const quoteVip = calculateTicketQuote(targetShowtime, qty, 'VIP');
      const quoteSweetbox = calculateTicketQuote(targetShowtime, qty, 'SWEETBOX');

      const requestedTier = entities.seatType || 'STANDARD';
      const primaryQuote = calculateTicketQuote(targetShowtime, qty, requestedTier);
      const linkPart =
        targetShowtime.bookingLink && targetShowtime.availableSeats > 0
          ? isEn
            ? `\n\n👉 [Book ${targetShowtime.time} showtime ➔](${targetShowtime.bookingLink})`
            : `\n\n👉 [Đặt vé suất ${targetShowtime.time} ngay ➔](${targetShowtime.bookingLink})`
          : targetShowtime.availableSeats <= 0
            ? isEn
              ? '\n\n⚠️ *Note: This showtime is currently sold out (0 seats left).*'
              : '\n\n⚠️ *Lưu ý: Suất chiếu này hiện đã hết ghế (0 ghế trống).*'
            : '';

      if (qty > 1 || entities.seatType) {
        return {
          reply: isEn
            ? `🎟️ **Quote for ${qty} ticket(s) — ${targetMovie.title}** (**${targetShowtime.time}**, ${targetShowtime.date}, **${targetShowtime.roomName} - ${targetShowtime.format}**):\n\n• **Standard:** ${qty} × ${quoteStandard.unitPriceFormatted} = **${quoteStandard.totalPriceFormatted}**\n• **VIP (Rows E–G):** ${qty} × ${quoteVip.unitPriceFormatted} = **${quoteVip.totalPriceFormatted}**\n• **Sweetbox Couple (Row H):** ${qty} × ${quoteSweetbox.unitPriceFormatted} = **${quoteSweetbox.totalPriceFormatted}**${linkPart}`
            : `🎟️ **Báo giá ${qty} vé cho phim ${targetMovie.title}** — Suất **${targetShowtime.time}** (${targetShowtime.relativeDayLabel}, **${targetShowtime.roomName} - ${targetShowtime.format}**):\n\n• **${primaryQuote.seatTypeLabel}:** ${qty} vé × ${primaryQuote.unitPriceFormatted} = **${primaryQuote.totalPriceFormatted}**\n\n📋 *Chi tiết theo từng hạng ghế cho ${qty} vé:*\n• Ghế Thường (Standard): ${qty} × ${quoteStandard.unitPriceFormatted} = **${quoteStandard.totalPriceFormatted}**\n• Ghế VIP (Hàng E–G): ${qty} × ${quoteVip.unitPriceFormatted} = **${quoteVip.totalPriceFormatted}**\n• Ghế Đôi (Sweetbox): ${qty} × ${quoteSweetbox.unitPriceFormatted} = **${quoteSweetbox.totalPriceFormatted}**${linkPart}`,
          movieCard: buildSafeMovieCard(targetShowtime, targetMovie, nowDate),
          movieCards: [],
          quickReplies: [],
          recommendedMovie: targetMovie.title,
        };
      }

      return {
        reply: isEn
          ? `🎟️ **Ticket Prices — ${targetMovie.title}** (**${targetShowtime.time}**, ${targetShowtime.date}, **${targetShowtime.roomName} - ${targetShowtime.format}**):\n\n• **Standard:** **${targetShowtime.priceFormatted} / ticket**\n• **VIP (Rows E–G):** **${targetShowtime.priceVipFormatted} / ticket**\n• **Sweetbox Couple (Row H):** **${targetShowtime.priceSweetboxFormatted} / pair**\n• **Available seats:** ${targetShowtime.availableSeats > 0 ? `**${targetShowtime.availableSeats}** left` : '**SOLD OUT (0)**'}${linkPart}`
          : `🎟️ **Bảng giá vé thực tế phim ${targetMovie.title}** — Suất **${targetShowtime.time}** (${targetShowtime.relativeDayLabel}, **${targetShowtime.roomName} - ${targetShowtime.format}**):\n\n• **Ghế Thường (Standard):** **${targetShowtime.priceFormatted} / vé**\n• **Ghế VIP (Trung tâm E–G):** **${targetShowtime.priceVipFormatted} / vé**\n• **Ghế Đôi Sweetbox (Hàng H):** **${targetShowtime.priceSweetboxFormatted} / cặp**\n• **Số ghế trống hiện tại:** ${targetShowtime.availableSeats > 0 ? `Còn **${targetShowtime.availableSeats}** ghế` : '**HẾT GHẾ (0 ghế)**'}${linkPart}`,
        movieCard: buildSafeMovieCard(targetShowtime, targetMovie, nowDate),
        movieCards: [],
        quickReplies: [],
        recommendedMovie: targetMovie.title,
      };
    }

    const allShowtimes = movies.flatMap((m) =>
      (m.showtimes || []).map((st) => ({ movie: m, showtime: st }))
    );

    if (allShowtimes.length > 0) {
      // Câu hỏi CHUNG về giá vé toàn rạp -> Tổng hợp gọn gàng theo từng loại phòng chiếu thay vì liệt kê 5 suất lẻ của 1 phim
      const byFormat = new Map();
      for (const { showtime } of allShowtimes) {
        const fmtKey = formatDisplayFormat(showtime.format);
        if (!byFormat.has(fmtKey)) byFormat.set(fmtKey, []);
        byFormat.get(fmtKey).push(showtime);
      }

      const formatLines = [...byFormat.entries()].map(([fmtName, slots]) => {
        const stdArr = [...new Set(slots.map((s) => s.priceStandard))].sort((a, b) => a - b);
        const vipArr = [...new Set(slots.map((s) => s.priceVip))].sort((a, b) => a - b);
        const swArr = [...new Set(slots.map((s) => s.priceSweetbox))].sort((a, b) => a - b);
        const r = (arr) =>
          arr.length === 1 ? formatVND(arr[0]) : `${formatVND(arr[0])} – ${formatVND(arr[arr.length - 1])}`;
        return isEn
          ? `• **${fmtName}:** Standard **${r(stdArr)}** | VIP **${r(vipArr)}** | Sweetbox **${r(swArr)}**`
          : `• **Phòng ${fmtName}:** Ghế thường **${r(stdArr)}** | Ghế VIP **${r(vipArr)}** | Sweetbox **${r(swArr)}**`;
      });

      const askWhich = isEn
        ? '\n\nWhich movie and showtime would you like me to calculate the exact price for?'
        : '\n\nBạn muốn mình báo giá chi tiết cho **bộ phim** và **khung giờ** nào ạ?';

      return {
        reply: isEn
          ? `🎟️ **Current Ticket Prices by Room Format at ${cinemaName}:**\n\n${formatLines.join('\n')}${askWhich}`
          : `🎟️ **Bảng giá vé thực tế theo loại phòng chiếu tại ${cinemaName}:**\n\n${formatLines.join('\n')}${askWhich}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    return {
      reply: isEn
        ? 'There are currently no open showtimes in the system to look up ticket prices.'
        : 'Hiện tại hệ thống chưa có suất chiếu nào đang mở bán để tra cứu giá vé.',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 5. MOVIE_RECOMMENDATION (Mục 2.1: Tư vấn 3-5 phim có tóm tắt, thời lượng & lý do)
  // =========================================================================
  if (intent === INTENTS.MOVIE_RECOMMENDATION) {
    let candidates = movies.filter((m) => m.status === 'NOW_SHOWING');

    // Lọc nghiêm ngặt theo độ tuổi nếu có (VD: trẻ 6 tuổi -> CHỈ được xem phim P)
    if (Array.isArray(entities.allowedAgeRatings) && entities.allowedAgeRatings.length > 0) {
      candidates = candidates.filter((m) =>
        entities.allowedAgeRatings.includes(String(m.ageRating || 'P').toUpperCase())
      );
    }

    // Lọc theo đối tượng đi xem (gia đình / người yêu / bạn bè) nếu chưa chỉ định thể loại cụ thể
    if (entities.audienceGroup && (!entities.genres || entities.genres.length === 0)) {
      const preferredGenreTokens =
        entities.audienceGroup === 'FAMILY'
          ? ['gia dinh', 'hoat hinh', 'hai', 'phieu luu']
          : entities.audienceGroup === 'COUPLE'
            ? ['tinh cam', 'tam ly', 'lang man', 'hai']
            : ['hanh dong', 'vien tuong', 'hai', 'kinh di'];

      const audienceMatched = candidates.filter((m) => {
        const gNoTone = removeVietnameseTones(m.genre || '');
        if (entities.audienceGroup === 'FAMILY' && String(m.ageRating).toUpperCase() === 'T18') {
          return false;
        }
        return preferredGenreTokens.some((tok) => gNoTone.includes(tok));
      });
      if (audienceMatched.length > 0) {
        candidates = audienceMatched;
      }
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
          .map((m) => `**${m.title}** (${m.genre} — ${m.duration} ${isEn ? 'mins' : 'phút'})`)
          .join(', ');
        return {
          reply: isEn
            ? `Currently there are no **${entities.genres.join(', ')}** movies showing at **${cinemaName}**.${fallbackShowing ? ` Closest options now showing: ${fallbackShowing}.` : ''}`
            : `Hiện tại rạp chưa có bộ phim nào thuộc thể loại **${entities.genres.join(', ')}**${entities.viewerAge ? ` phù hợp cho khán giả **${entities.viewerAge} tuổi**` : ''} đang chiếu.${fallbackShowing ? `\n\nLựa chọn gần nhất đang chiếu tại rạp gồm: ${fallbackShowing}.` : ''}`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }
    }

    if (candidates.length === 0) {
      if (entities.viewerAge !== null) {
        return {
          reply: isEn
            ? `Viewers aged **${entities.viewerAge}** may only watch movies rated **${entities.allowedAgeRatings.join(', ')}**. Currently there are no **${entities.allowedAgeRatings.join(', ')}** movies showing at **${cinemaName}**.`
            : `Theo quy định phân loại độ tuổi, khán giả **${entities.viewerAge} tuổi** chỉ được xem phim phân loại **${entities.allowedAgeRatings.join(', ')}**. Hiện tại **${cinemaName}** chưa có phim **${entities.allowedAgeRatings.join(', ')}** nào đang chiếu.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      return {
        reply: isEn
          ? 'There are currently no movies matching your criteria in the system.'
          : 'Hiện tại hệ thống chưa có bộ phim nào khớp với tiêu chí bạn tìm kiếm.',
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    const hasScheduleFilter = Boolean(
      entities.dateFilter || entities.timeFilter || entities.format || entities.cinemaLocation
    );
    const groupedCandidates = candidates.map((m) => ({
      movie: m,
      slots: hasScheduleFilter
        ? filterShowtimesByEntities(m.showtimes || [], entities)
        : m.showtimes || [],
    }));

    const matchedWithSlots = hasScheduleFilter
      ? groupedCandidates.filter((g) => g.slots.length > 0)
      : groupedCandidates;

    if (hasScheduleFilter && matchedWithSlots.length === 0) {
      const altGroups = candidates.filter((m) => (m.showtimes || []).length > 0).slice(0, 3);
      const altLines = altGroups.map((m) => {
        const nextSt = m.showtimes[0];
        return isEn
          ? `• **${m.title}** (${m.genre} | ${m.duration} mins) — Next showtime: **${nextSt.time}** (${nextSt.date}, ${nextSt.format})`
          : `• **${m.title}** (${m.genre} | ${m.duration} phút) — Suất gần nhất: **${nextSt.time}** (${nextSt.relativeDayLabel}, ${nextSt.format})`;
      });

      return {
        reply: isEn
          ? `No showtimes matched that exact time/date filter at **${cinemaName}**.${altLines.length > 0 ? `\n\nClosest available showtimes for matching movies:\n${altLines.join('\n')}` : ''}`
          : `Hiện chưa có suất chiếu nào khớp khung giờ/ngày bạn hỏi tại **${cinemaName}**.${altLines.length > 0 ? `\n\nCác phim phù hợp vẫn còn suất ở khung giờ khác:\n${altLines.join('\n')}` : ''}`,
        movieCard: null,
        movieCards: buildInteractiveMovieCards(
          altGroups.map((m) => ({ movie: m, showtimes: m.showtimes.slice(0, 2) })),
          nowDate
        ),
        quickReplies: [],
        recommendedMovie: altGroups[0]?.title || '',
      };
    }

    // Tối đa 3–5 bộ phim phù hợp nhất, kèm đầy đủ Tên, Thể loại, Tóm tắt, Thời lượng & Lý do đề xuất
    const displayGroups = matchedWithSlots.slice(0, 5);
    const movieLines = displayGroups.map(({ movie: m, slots }, idx) => {
      const openSlots = slots.filter((s) => s.availableSeats > 0);
      const synopsis = trimDescription(m.description, 170, isEn);
      const reason = buildAdvisoryReason(m, entities, isEn);
      const slotPreview =
        openSlots.length > 0
          ? openSlots
              .slice(0, 3)
              .map((s) =>
                isEn
                  ? `**${s.time}** (${s.date}, ${s.format}, ${s.priceFormatted})`
                  : `**${s.time}** (${s.relativeDayLabel}, ${s.format}, ${s.priceFormatted}, còn ${s.availableSeats} ghế)`
              )
              .join(' | ')
          : isEn
            ? 'No open showtimes yet'
            : 'Hiện chưa có suất mở bán';
      const firstLink = openSlots[0]?.bookingLink
        ? isEn
          ? ` — [Book now ➔](${openSlots[0].bookingLink})`
          : ` — [Đặt vé ngay ➔](${openSlots[0].bookingLink})`
        : '';

      if (isEn) {
        return `${idx + 1}. 🎬 **${m.title}** (**${m.ageRating}** | ${m.genre} | **${m.duration} mins**)\n   📖 *Synopsis:* ${synopsis}\n   💡 *Why watch:* ${reason}\n   🕒 *Showtimes:* ${slotPreview}${firstLink}`;
      }
      return `${idx + 1}. 🎬 **${m.title}** (**${m.ageRating}** | ${m.genre} | **${m.duration} phút**)\n   📖 *Nội dung:* ${synopsis}\n   💡 *Gợi ý:* ${reason}\n   🕒 *Suất chiếu:* ${slotPreview}${firstLink}`;
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

    const headerTitle = isEn
      ? `🌟 **Recommended Movies Currently Showing at ${cinemaName}:**\n\n`
      : `🌟 **Tư vấn các bộ phim đang chiếu phù hợp tại ${cinemaName}:**\n\n`;

    return {
      reply: `${headerTitle}${movieLines.join('\n\n')}`,
      movieCard: firstOpenSlot
        ? buildSafeMovieCard(firstOpenSlot, firstGroupWithOpenSlot.movie, nowDate)
        : null,
      movieCards,
      quickReplies: [],
      recommendedMovie: firstGroupWithOpenSlot
        ? firstGroupWithOpenSlot.movie.title
        : displayGroups[0].movie.title,
    };
  }

  // =========================================================================
  // 6. MOVIE_DETAIL (Trả lời RIÊNG đúng trọng tâm cho 1 bộ phim cụ thể: Tư vấn riêng 1 phim, Thời lượng, Độ tuổi, Đạo diễn, Cốt truyện)
  // =========================================================================
  if (intent === INTENTS.MOVIE_DETAIL && entities.matchedMovie) {
    const m = entities.matchedMovie;
    const isComingSoon = m.status === 'COMING_SOON';
    const statusLabel = isComingSoon
      ? isEn
        ? 'Coming Soon'
        : 'Sắp chiếu'
      : isEn
        ? 'Now Showing'
        : 'Đang chiếu';

    const openSlots = (m.showtimes || []).filter((s) => s.availableSeats > 0);
    const singleMovieCards =
      openSlots.length > 0
        ? buildInteractiveMovieCards([{ movie: m, showtimes: openSlots }], nowDate)
        : [];
    const primaryCard = openSlots[0] ? buildSafeMovieCard(openSlots[0], m, nowDate) : null;

    const castNames = Array.isArray(m.cast)
      ? m.cast
          .slice(0, 5)
          .map((c) => (typeof c === 'string' ? c : c?.name || ''))
          .filter(Boolean)
          .join(', ')
      : '';

    const aspect = entities.movieDetailAspect;

    // 6a. Hỏi riêng THỜI LƯỢNG phim ("Phim Dune dài bao nhiêu phút?")
    if (aspect === 'DURATION') {
      const hrs = Math.floor((Number(m.duration) || 0) / 60);
      const mins = (Number(m.duration) || 0) % 60;
      const hmVi = hrs > 0 ? ` (khoảng ${hrs} giờ ${mins > 0 ? `${mins} phút` : ''})`.replace(/\s+\)/, ')') : '';
      const hmEn = hrs > 0 ? ` (~${hrs}h ${mins > 0 ? `${mins}m` : ''})`.replace(/\s+\)/, ')') : '';
      return {
        reply: isEn
          ? `⏱️ **${m.title}** has a runtime of **${m.duration} minutes**${hmEn} (${statusLabel} • Genre: ${m.genre} • Rated **${m.ageRating}**).`
          : `⏱️ Phim **${m.title}** có thời lượng **${m.duration} phút**${hmVi} (${statusLabel} • Thể loại: ${m.genre} • Phân loại **${m.ageRating}**).`,
        movieCard: primaryCard,
        movieCards: singleMovieCards,
        quickReplies: [],
        recommendedMovie: m.title,
      };
    }

    // 6b. Hỏi riêng ĐỘ TUỔI xem phim ("Phim Mai mấy tuổi xem được?", "Bé 12 tuổi xem Dune được không?")
    if (aspect === 'AGE_RATING') {
      const ratingCode = String(m.ageRating || 'P').toUpperCase();
      const minAgeMap = { P: 0, K: 0, T13: 13, T16: 16, T18: 18 };
      const minRequiredAge = minAgeMap[ratingCode] ?? 0;
      const ruleExplainVi =
        minRequiredAge === 0
          ? 'phổ biến cho **mọi độ tuổi**'
          : `chỉ dành cho khán giả **từ đủ ${minRequiredAge} tuổi trở lên**`;
      const ruleExplainEn =
        minRequiredAge === 0
          ? 'suitable for **all ages**'
          : `restricted to viewers aged **${minRequiredAge} and above**`;

      let ageVerdict = '';
      if (entities.viewerAge !== null) {
        const allowed = entities.viewerAge >= minRequiredAge;
        ageVerdict = isEn
          ? allowed
            ? `\n• **For age ${entities.viewerAge}:** **Allowed** to watch.`
            : `\n• **For age ${entities.viewerAge}:** **Not eligible** (requires age ${minRequiredAge}+).`
          : allowed
            ? `\n• **Với khán giả ${entities.viewerAge} tuổi:** **Đủ điều kiện** vào xem phim này.`
            : `\n• **Với khán giả ${entities.viewerAge} tuổi:** **Chưa đủ tuổi quy định** để xem phim này (yêu cầu từ đủ ${minRequiredAge} tuổi).`;
      }

      return {
        reply: isEn
          ? `🔞 **${m.title}** is rated **${ratingCode}** — ${ruleExplainEn}.${ageVerdict}`
          : `🔞 Phim **${m.title}** được phân loại **${ratingCode}** — ${ruleExplainVi}.${ageVerdict}`,
        movieCard: primaryCard,
        movieCards: singleMovieCards,
        quickReplies: [],
        recommendedMovie: m.title,
      };
    }

    // 6c. Hỏi riêng ĐẠO DIỄN / DIỄN VIÊN ("Ai đạo diễn phim Mai?")
    if (aspect === 'DIRECTOR_CAST') {
      const dirLineVi = m.director ? `• **Đạo diễn:** **${m.director}**` : '• **Đạo diễn:** Đang cập nhật';
      const castLineVi = castNames ? `\n• **Diễn viên chính:** ${castNames}` : '';
      const dirLineEn = m.director ? `• **Director:** **${m.director}**` : '• **Director:** Updating';
      const castLineEn = castNames ? `\n• **Main Cast:** ${castNames}` : '';
      return {
        reply: isEn
          ? `🎬 **Director & Cast — ${m.title}** (${m.genre} | ${m.duration} mins):\n${dirLineEn}${castLineEn}`
          : `🎬 **Đạo diễn & Diễn viên phim ${m.title}** (${m.genre} | ${m.duration} phút):\n${dirLineVi}${castLineVi}`,
        movieCard: primaryCard,
        movieCards: singleMovieCards,
        quickReplies: [],
        recommendedMovie: m.title,
      };
    }

    // 6d. Hỏi riêng NGÀY KHỞI CHIẾU ("Khi nào phim Mufasa khởi chiếu?")
    if (aspect === 'RELEASE_DATE') {
      const relStr = m.releaseDate || (isEn ? 'TBA' : 'Đang cập nhật');
      return {
        reply: isEn
          ? `📅 **${m.title}** (${statusLabel}) — Release date: **${relStr}** (${m.genre} • ${m.duration} mins • Rated **${m.ageRating}**).`
          : `📅 Phim **${m.title}** hiện ở trạng thái **${statusLabel}** — Ngày khởi chiếu: **${relStr}** (${m.genre} • ${m.duration} phút • Phân loại **${m.ageRating}**).`,
        movieCard: primaryCard,
        movieCards: singleMovieCards,
        quickReplies: [],
        recommendedMovie: m.title,
      };
    }

    // 6e. Hỏi riêng NỘI DUNG / CỐT TRUYỆN ("Phim thứ 2 nội dung sao?", "Phim Mai kể về gì?")
    if (aspect === 'PLOT') {
      const desc = m.description || (isEn ? 'Synopsis is being updated.' : 'Nội dung tóm tắt đang được cập nhật.');
      return {
        reply: isEn
          ? `📖 **Synopsis — ${m.title}** (${statusLabel} | ${m.genre} | ${m.duration} mins | Rated **${m.ageRating}**):\n\n${desc}`
          : `📖 **Nội dung phim ${m.title}** (${statusLabel} | ${m.genre} | ${m.duration} phút | Phân loại **${m.ageRating}**):\n\n${desc}`,
        movieCard: primaryCard,
        movieCards: singleMovieCards,
        quickReplies: [],
        recommendedMovie: m.title,
      };
    }

    // 6f. TƯ VẤN RIÊNG 1 BỘ PHIM ĐÍCH DANH (VD: "tư vấn cho tôi phim Dune", "phim Dune có hay không?")
    // Tuyệt đối CHỈ tư vấn sâu về đúng 1 bộ phim khách hỏi, KHÔNG liệt kê các phim khác!
    if (aspect === 'ADVISORY') {
      const reason = buildAdvisoryReason(m, entities, isEn);
      const desc = m.description || (isEn ? 'Synopsis is being updated.' : 'Nội dung đang cập nhật.');
      const formatsAvailable = Array.isArray(m.supportedFormats) && m.supportedFormats.length > 0
        ? m.supportedFormats.map(formatDisplayFormat).join(', ')
        : null;
      const bestFormatTipVi = formatsAvailable
        ? `\n• **Định dạng chiếu tại rạp:** **${formatsAvailable}**`
        : '';
      const bestFormatTipEn = formatsAvailable
        ? `\n• **Available formats:** **${formatsAvailable}**`
        : '';

      const schedulePartVi = isComingSoon
        ? `\n\n📅 **Lịch khởi chiếu:** Phim thuộc nhóm **Sắp chiếu**${m.releaseDate ? ` (dự kiến khởi chiếu **${m.releaseDate}**)` : ''}, hiện chưa mở bán vé.`
        : openSlots.length > 0
          ? `\n\n🕒 **Suất chiếu thực tế của phim ${m.title} đang mở bán:**\n${summarizeMovieSlotsCompact(openSlots, false)}`
          : `\n\n🕒 Hiện tại phim chưa có suất chiếu mở bán trong khung giờ còn lại hôm nay.`;

      const schedulePartEn = isComingSoon
        ? `\n\n📅 **Release Status:** **Coming Soon**${m.releaseDate ? ` (releasing **${m.releaseDate}**)` : ''} — tickets are not on sale yet.`
        : openSlots.length > 0
          ? `\n\n🕒 **Available showtimes for ${m.title}:**\n${summarizeMovieSlotsCompact(openSlots, true)}`
          : `\n\n🕒 No open showtimes remaining right now.`;

      return {
        reply: isEn
          ? `🌟 **Movie Consultation — ${m.title}**\n• **Genre & Runtime:** ${m.genre} | **${m.duration} mins** | Rated **${m.ageRating}** (${statusLabel})\n• **Synopsis:** ${desc}\n• **Why watch:** ${reason}${bestFormatTipEn}${schedulePartEn}`
          : `🌟 **Tư vấn chi tiết phim ${m.title}**\n• **Thể loại & Thời lượng:** ${m.genre} | **${m.duration} phút** | Phân loại **${m.ageRating}** (${statusLabel})\n• **Tóm tắt nội dung:** ${desc}\n• **Điểm đáng xem:** ${reason}${bestFormatTipVi}${schedulePartVi}`,
        movieCard: primaryCard,
        movieCards: singleMovieCards,
        quickReplies: [],
        recommendedMovie: m.title,
      };
    }

    // 6g. Tổng quan chi tiết đầy đủ của 1 bộ phim ("Thông tin chi tiết phim Dune")
    const slotText =
      openSlots.length > 0
        ? openSlots
            .slice(0, 6)
            .map((s) => formatShowtimeLine(s, false, '', isEn))
            .join('\n')
        : isComingSoon
          ? isEn
            ? `• Coming Soon${m.releaseDate ? ` (Release date: **${m.releaseDate}**)` : ''} — tickets not yet open.`
            : `• Phim **Sắp chiếu**${m.releaseDate ? ` (khởi chiếu **${m.releaseDate}**)` : ''} — hiện chưa mở bán suất chiếu.`
          : isEn
            ? '• No open showtimes available right now.'
            : '• Hiện chưa có suất chiếu nào đang mở bán.';

    const detailLines = isEn
      ? [
          `• **Status:** ${statusLabel}`,
          `• **Genre:** ${m.genre}`,
          `• **Duration:** ${m.duration} mins`,
          `• **Age Rating:** **${m.ageRating}**`,
          m.releaseDate ? `• **Release Date:** ${m.releaseDate}` : '',
          m.director ? `• **Director:** ${m.director}` : '',
          castNames ? `• **Cast:** ${castNames}` : '',
          m.description ? `• **Synopsis:** ${m.description}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `• **Trạng thái:** ${statusLabel}`,
          `• **Thể loại:** ${m.genre}`,
          `• **Thời lượng:** ${m.duration} phút`,
          `• **Phân loại độ tuổi:** **${m.ageRating}**`,
          m.releaseDate ? `• **Khởi chiếu:** ${m.releaseDate}` : '',
          m.director ? `• **Đạo diễn:** ${m.director}` : '',
          castNames ? `• **Diễn viên:** ${castNames}` : '',
          m.description ? `• **Nội dung:** ${m.description}` : '',
        ]
          .filter(Boolean)
          .join('\n');

    return {
      reply: isEn
        ? `🎬 **Movie Details — ${m.title}:**\n\n${detailLines}\n\n🕒 **Upcoming Showtimes:**\n${slotText}`
        : `🎬 **Thông tin chi tiết phim ${m.title}:**\n\n${detailLines}\n\n🕒 **Các suất chiếu sắp tới:**\n${slotText}`,
      movieCard: primaryCard,
      movieCards: singleMovieCards,
      quickReplies: [],
      recommendedMovie: m.title,
    };
  }

  // =========================================================================
  // 7. MOVIE_SEARCH (Mục 2.2: Phim sắp chiếu ĐẦY ĐỦ + Phim đang chiếu theo ngày/tháng)
  // =========================================================================
  if (intent === INTENTS.MOVIE_SEARCH) {
    // 7a. Hỏi phim theo tháng cụ thể ("tháng 12 có phim gì", "tháng sau", "next month")
    if (entities.monthFilter) {
      const { month, year, monthKey, label, labelEn, isFutureMonth } = entities.monthFilter;
      const moviesInMonth = movies.filter((m) => {
        if (String(m.status).toUpperCase() === 'ENDED') return false;
        const matchRelease = m.releaseMonth === month && m.releaseYear === year;
        const matchShowtime = (m.showtimes || []).some((s) =>
          String(s.dateKey || '').startsWith(monthKey)
        );
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
              .map((m) =>
                isEn ? `${m.releaseMonth}/${m.releaseYear}` : `Tháng ${m.releaseMonth}/${m.releaseYear}`
              )
          ),
        ].slice(0, 6);
        const hint =
          availableMonths.length > 0
            ? isEn
              ? ` Available release months: **${availableMonths.join(', ')}**.`
              : ` Hiện hệ thống có lịch phim cho: **${availableMonths.join(', ')}**.`
            : '';
        return {
          reply: isEn
            ? `No movies are scheduled for **${labelEn || label}** at **${cinemaName}**.${hint}`
            : `Hiện tại **${cinemaName}** chưa có phim nào được công bố cho **${label}**.${hint}`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      // Hiển thị ĐẦY ĐỦ tất cả phim trong tháng (không cắt bớt) kèm ngày khởi chiếu, thể loại, mô tả & trạng thái rõ ràng
      const monthLines = moviesInMonth.map((m, idx) => {
        const statusTag =
          m.status === 'COMING_SOON'
            ? isEn
              ? 'Coming Soon'
              : 'Sắp chiếu'
            : isEn
              ? 'Now Showing'
              : 'Đang chiếu';
        const releaseNote = m.releaseDate
          ? isEn
            ? ` • Release: **${m.releaseDate}**`
            : ` • Khởi chiếu: **${m.releaseDate}**`
          : '';
        const synopsis = trimDescription(m.description, 150, isEn);
        return `${idx + 1}. 🎞️ **${m.title}** (**${statusTag}** | ${m.ageRating} | ${m.genre} | ${m.duration} ${isEn ? 'mins' : 'phút'}${releaseNote})\n   📖 ${synopsis}`;
      });

      return {
        reply: isEn
          ? `📅 **Movies for ${labelEn || label} (${moviesInMonth.length} movie(s)) at ${cinemaName}:**\n\n${monthLines.join('\n\n')}`
          : `📅 **Danh sách phim ${label} (${moviesInMonth.length} phim) tại ${cinemaName}:**\n\n${monthLines.join('\n\n')}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: moviesInMonth[0]?.title || '',
      };
    }

    // 7b. Mục 2.2: Hỏi "Phim sắp chiếu" (Coming Soon) -> Liệt kê ĐẦY ĐỦ toàn bộ phim COMING_SOON từ MongoDB
    if (entities.movieStatusFilter === 'COMING_SOON') {
      const comingSoonMovies = movies.filter((m) => m.status === 'COMING_SOON');
      if (comingSoonMovies.length === 0) {
        return {
          reply: isEn
            ? `There are currently no **Coming Soon** movies announced at **${cinemaName}**.`
            : `Hiện tại **${cinemaName}** chưa có bộ phim nào ở trạng thái **Sắp chiếu**.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      // Hiển thị ĐẦY ĐỦ tất cả phim COMING_SOON (không giới hạn 3 hay 6 phim), có đủ Tên, Ngày khởi chiếu, Thể loại và Mô tả
      const comingLines = comingSoonMovies.map((m, idx) => {
        const releaseNote = m.releaseDate
          ? isEn
            ? `Release Date: **${m.releaseDate}**`
            : `Khởi chiếu: **${m.releaseDate}**`
          : isEn
            ? 'Release Date: TBA'
            : 'Khởi chiếu: Đang cập nhật';
        const synopsis = trimDescription(m.description, 150, isEn);
        return isEn
          ? `${idx + 1}. 🎞️ **${m.title}** *(Coming Soon)* — ${releaseNote} | Genre: **${m.genre}** (${m.duration} mins)\n   📖 ${synopsis}`
          : `${idx + 1}. 🎞️ **${m.title}** *(Sắp chiếu)* — ${releaseNote} | Thể loại: **${m.genre}** (${m.duration} phút)\n   📖 ${synopsis}`;
      });

      return {
        reply: isEn
          ? `🎞️ **Full List of Coming Soon Movies at ${cinemaName} (${comingSoonMovies.length} movies — distinct from Now Showing):**\n\n${comingLines.join('\n\n')}`
          : `🎞️ **Danh sách đầy đủ phim Sắp chiếu tại ${cinemaName} (${comingSoonMovies.length} bộ phim — chưa mở bán như nhóm Đang chiếu):**\n\n${comingLines.join('\n\n')}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: comingSoonMovies[0]?.title || '',
      };
    }

    // 7c. Hỏi phim có suất chiếu theo ngày cụ thể (VD: "What movies are showing tonight?", "Ngày mai có phim gì?")
    if (entities.dateFilter) {
      const targetDateKey = entities.dateFilter.dateKey;
      const moviesOnDate = movies
        .filter((m) => m.status === 'NOW_SHOWING')
        .map((m) => ({
          movie: m,
          slots: filterShowtimesByEntities(m.showtimes || [], {
            dateFilter: entities.dateFilter,
            timeFilter: entities.timeFilter,
          }),
        }))
        .filter((item) => item.slots.length > 0);

      if (moviesOnDate.length === 0) {
        const showingNowNames = movies
          .filter((m) => m.status === 'NOW_SHOWING')
          .map((m) => `**${m.title}** (${m.ageRating})`)
          .join(', ');

        return {
          reply: isEn
            ? `There are currently no open showtimes scheduled for **${entities.dateFilter.labelEn || entities.dateFilter.displayDate}** at **${cinemaName}**.${showingNowNames ? `\n\nMovies currently in theaters: ${showingNowNames}. Would you like to check another date?` : ''}`
            : `Hiện tại hệ thống chưa có suất chiếu mở bán cho **${entities.dateFilter.label}**.${showingNowNames ? `\n\n🎬 Các bộ phim đang chiếu tại rạp gồm: ${showingNowNames}. Bạn có muốn kiểm tra ngày chiếu khác không?` : ''}`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      // Hiển thị ĐẦY ĐỦ tất cả các bộ phim có suất chiếu trong ngày yêu cầu
      const lines = moviesOnDate.map(({ movie, slots }, idx) => {
        const slotSummary = summarizeMovieSlotsCompact(slots, isEn);
        return `${idx + 1}. 🎬 **${movie.title}** (**${movie.ageRating}** | ${movie.genre} | ${movie.duration} ${isEn ? 'mins' : 'phút'})\n   🕒 ${slotSummary}`;
      });

      const movieCards = buildInteractiveMovieCards(
        moviesOnDate.map(({ movie, slots }) => ({ movie, showtimes: slots })),
        nowDate
      );

      const firstOpenPair = moviesOnDate
        .flatMap(({ movie, slots }) => slots.map((s) => ({ movie, showtime: s })))
        .find(({ showtime }) => showtime.availableSeats > 0);

      const dayHeading = isEn
        ? entities.timeFilter?.period === 'EVENING'
          ? `tonight (${entities.dateFilter.displayShortDate})`
          : entities.dateFilter.labelEn || entities.dateFilter.displayDate
        : entities.dateFilter.label;

      return {
        reply: isEn
          ? `📅 **Movies showing ${dayHeading} at ${cinemaName} (${moviesOnDate.length} movie(s)):**\n\n${lines.join('\n\n')}`
          : `📅 **Các bộ phim đang chiếu vào ${dayHeading} tại ${cinemaName} (${moviesOnDate.length} bộ phim):**\n\n${lines.join('\n\n')}`,
        movieCard: firstOpenPair
          ? buildSafeMovieCard(firstOpenPair.showtime, firstOpenPair.movie, nowDate)
          : null,
        movieCards,
        quickReplies: [],
        recommendedMovie: firstOpenPair ? firstOpenPair.movie.title : moviesOnDate[0].movie.title,
      };
    }

    // 7d. Không chỉ định ngày cụ thể -> Hiển thị ĐẦY ĐỦ các phim Đang chiếu (status === 'NOW_SHOWING')
    const showingMovies = movies.filter((m) => m.status === 'NOW_SHOWING');
    if (showingMovies.length === 0) {
      return {
        reply: isEn
          ? `There are currently no **Now Showing** movies listed at **${cinemaName}**.`
          : `Hiện tại **${cinemaName}** chưa có bộ phim nào đang mở chiếu.`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    const lines = showingMovies.map((m, idx) => {
      const { daySlots, dayLabel } = selectDayShowtimesAndOtherDates(m.showtimes || [], entities, isEn);
      const slotDesc =
        daySlots.length > 0
          ? `${dayLabel ? `(${dayLabel}) ` : ''}${summarizeMovieSlotsCompact(daySlots, isEn)}`
          : isEn
            ? 'No open showtimes yet'
            : 'Chưa có suất chiếu mở bán';
      return `${idx + 1}. 🎬 **${m.title}** (**${m.ageRating}** | ${m.genre} | ${m.duration} ${isEn ? 'mins' : 'phút'})\n   🕒 ${slotDesc}`;
    });

    const movieCards = buildInteractiveMovieCards(
      showingMovies.map((m) => {
        const { daySlots } = selectDayShowtimesAndOtherDates(m.showtimes || [], entities, isEn);
        return { movie: m, showtimes: daySlots.length > 0 ? daySlots : m.showtimes || [] };
      }),
      nowDate
    );

    const firstMovieWithSlot = showingMovies.find((m) =>
      (m.showtimes || []).some((s) => s.availableSeats > 0)
    );
    const firstSlot = firstMovieWithSlot?.showtimes.find((s) => s.availableSeats > 0) || null;

    return {
      reply: isEn
        ? `🎬 **Movies Currently Showing at ${cinemaName} (${showingMovies.length} movies):**\n\n${lines.join('\n\n')}`
        : `🎬 **Các bộ phim Đang chiếu hiện tại tại ${cinemaName} (${showingMovies.length} bộ phim):**\n\n${lines.join('\n\n')}`,
      movieCard: firstSlot ? buildSafeMovieCard(firstSlot, firstMovieWithSlot, nowDate) : null,
      movieCards,
      quickReplies: [],
      recommendedMovie: firstMovieWithSlot?.title || showingMovies[0].title,
    };
  }

  // =========================================================================
  // 8. SHOWTIME_SEARCH (Mục 3: Đầy đủ Tên phim, Ngày, Giờ, Phòng, Định dạng, Giá vé)
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
    if (entities.matchedMovie) {
      filterLabels.push(isEn ? `**${entities.matchedMovie.title}**` : `phim **${entities.matchedMovie.title}**`);
    }
    if (entities.format) {
      filterLabels.push(isEn ? `format **${entities.format}**` : `định dạng **${entities.format}**`);
    }
    if (entities.dateFilter) {
      filterLabels.push(
        isEn
          ? `${entities.dateFilter.labelEn || entities.dateFilter.displayDate}`
          : `vào **${entities.dateFilter.label}**`
      );
    }
    if (entities.timeFilter) {
      filterLabels.push(
        isEn
          ? `${entities.timeFilter.labelEn || entities.timeFilter.label}`
          : `khung giờ **${entities.timeFilter.label}**`
      );
    }
    const descText =
      filterLabels.length > 0
        ? filterLabels.join(' ')
        : isEn
          ? 'your request'
          : 'theo yêu cầu của bạn';

    if (matchedPairs.length === 0) {
      // Nếu khách hỏi RIÊNG lịch chiếu của 1 bộ phim Sắp chiếu (COMING_SOON) -> Báo rõ trạng thái Sắp chiếu & ngày khởi chiếu
      if (entities.matchedMovie && entities.matchedMovie.status === 'COMING_SOON') {
        const rel = entities.matchedMovie.releaseDate;
        return {
          reply: isEn
            ? `**${entities.matchedMovie.title}** is currently **Coming Soon**${rel ? ` (scheduled release: **${rel}**)` : ''} and has not opened showtime ticket sales at **${cinemaName}** yet.`
            : `Phim **${entities.matchedMovie.title}** hiện thuộc danh sách **Phim sắp chiếu**${rel ? ` (dự kiến khởi chiếu: **${rel}**)` : ''} nên chưa mở bán suất chiếu tại **${cinemaName}**.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: entities.matchedMovie.title,
        };
      }

      if (entities.matchedMovie && (entities.matchedMovie.showtimes || []).length > 0) {
        const altLines = entities.matchedMovie.showtimes
          .slice(0, 5)
          .map((st) => formatShowtimeLine(st, false, '', isEn))
          .join('\n');

        return {
          reply: isEn
            ? `No showtimes matched ${descText}.\n\n🕒 Other available showtimes for **${entities.matchedMovie.title}**:\n${altLines}`
            : `Hiện tại không có suất chiếu nào cho ${descText}.\n\n🕒 Tuy nhiên, phim **${entities.matchedMovie.title}** đang có các suất chiếu thực tế khác sau đây:\n${altLines}`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: entities.matchedMovie.title,
        };
      }

      // Câu hỏi CHUNG toàn rạp (VD: "suất chiếu phim ngày mai", "suất chiếu của tất cả các phim vào ngày mai") nhưng ngày đó chưa mở lịch
      const otherAvailableDates = [
        ...new Set(movies.flatMap((m) => (m.showtimes || []).map((s) => s.shortDate || s.date))),
      ].slice(0, 4);
      const showingNowTitles = movies
        .filter((m) => m.status === 'NOW_SHOWING')
        .map((m) => `**${m.title}**`)
        .join(', ');

      if (!entities.matchedMovie) {
        const dateTargetVi = entities.dateFilter ? `vào **${entities.dateFilter.label}**` : descText;
        const dateTargetEn = entities.dateFilter
          ? `for **${entities.dateFilter.labelEn || entities.dateFilter.displayDate}**`
          : `for ${descText}`;
        const suggestVi =
          otherAvailableDates.length > 0
            ? ` Hiện rạp đang mở bán suất chiếu vào ngày **${otherAvailableDates.join(', ')}**${showingNowTitles ? ` cho các phim: ${showingNowTitles}` : ''}. Bạn có muốn xem lịch chiếu ngày **${otherAvailableDates[0]}** không?`
            : '';
        const suggestEn =
          otherAvailableDates.length > 0
            ? ` Currently open showtime dates: **${otherAvailableDates.join(', ')}**${showingNowTitles ? ` (${showingNowTitles})` : ''}. Would you like to check **${otherAvailableDates[0]}**?`
            : '';

        return {
          reply: isEn
            ? `Currently **${cinemaName}** has no open showtimes scheduled across any movies ${dateTargetEn}.${suggestEn}`
            : `Hiện tại hệ thống **${cinemaName}** chưa có lịch chiếu mở bán cho các bộ phim ${dateTargetVi}.${suggestVi}`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      const suggestDates =
        otherAvailableDates.length > 0
          ? isEn
            ? ` Available showtime dates in the system: **${otherAvailableDates.join(', ')}**.`
            : ` Bạn có thể tham khảo lịch chiếu đang mở vào ngày: **${otherAvailableDates.join(', ')}**.`
          : '';

      return {
        reply: isEn
          ? `There are currently no open showtimes for ${descText} at **${cinemaName}**.${suggestDates}`
          : `Hiện tại hệ thống **${cinemaName}** không có suất chiếu nào cho ${descText}.${suggestDates}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: entities.matchedMovie?.title || '',
      };
    }

    // Khi khách hỏi lịch chiếu của 1 bộ phim cụ thể
    if (entities.matchedMovie) {
      const movieSlots = matchedPairs.map((p) => p.showtime);
      const { daySlots, dayLabel, otherDates } = selectDayShowtimesAndOtherDates(movieSlots, entities, isEn);
      const groupedText = formatShowtimesGroupedByRoom(daySlots, isEn);
      const otherDatesNote =
        otherDates.length > 0
          ? isEn
            ? `\n\n📅 *Other dates with showtimes: ${otherDates.join(', ')}*`
            : `\n\n📅 *Các ngày chiếu khác: ${otherDates.join(', ')}*`
          : '';
      const firstOpenSlot = daySlots.find((s) => s.availableSeats > 0) || null;

      return {
        reply: isEn
          ? `🕒 **Showtimes for movie **${entities.matchedMovie.title}** — ${dayLabel}:**\n\n${groupedText}${otherDatesNote}`
          : `🕒 **Lịch chiếu phim **${entities.matchedMovie.title}** — ${dayLabel}:**\n\n${groupedText}${otherDatesNote}`,
        movieCard: firstOpenSlot ? buildSafeMovieCard(firstOpenSlot, entities.matchedMovie, nowDate) : null,
        movieCards: buildInteractiveMovieCards([{ movie: entities.matchedMovie, showtimes: daySlots }], nowDate),
        quickReplies: [],
        recommendedMovie: entities.matchedMovie.title,
      };
    }

    // Khi khách hỏi lịch chiếu chung (không mặc định 1 phim cố định -> hiển thị ĐẦY ĐỦ tất cả các phim có suất chiếu)
    const groupedByMovie = new Map();
    for (const pair of matchedPairs) {
      const mKey = String(pair.movie._id || pair.movie.title);
      if (!groupedByMovie.has(mKey)) {
        groupedByMovie.set(mKey, { movie: pair.movie, showtimes: [] });
      }
      groupedByMovie.get(mKey).showtimes.push(pair.showtime);
    }

    const movieSections = [];
    for (const { movie, showtimes: mSlots } of groupedByMovie.values()) {
      const orderedSlots = [...mSlots].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      const slotLines = orderedSlots.map((st) => formatShowtimeLine(st, false, '', isEn));
      movieSections.push(`🎬 **${movie.title}** (${movie.ageRating} | ${movie.genre})\n${slotLines.join('\n')}`);
    }

    const firstOpen = matchedPairs.find(({ showtime }) => showtime.availableSeats > 0);
    const movieCards = buildInteractiveCardsFromPairs(matchedPairs, nowDate);

    return {
      reply: isEn
        ? `🕒 **Showtimes for ${descText} (${groupedByMovie.size} movie(s)):**\n\n${movieSections.join('\n\n')}`
        : `🕒 **Lịch chiếu thực tế cho ${descText} (${groupedByMovie.size} bộ phim):**\n\n${movieSections.join('\n\n')}`,
      movieCard: firstOpen ? buildSafeMovieCard(firstOpen.showtime, firstOpen.movie, nowDate) : null,
      movieCards,
      quickReplies: [],
      recommendedMovie: firstOpen ? firstOpen.movie.title : matchedPairs[0].movie.title,
    };
  }

  // =========================================================================
  // 9. BOOKING_GUIDE (Xin link đặt vé / chính sách đổi trả / hỏi muốn đặt vé chung)
  // =========================================================================
  if (intent === INTENTS.BOOKING_GUIDE) {
    if (/\b(hoàn\s+vé|đổi\s+vé|hủy\s+vé|trả\s+vé|hoàn\s+tiền|refund|exchange\s+ticket|cancel\s+ticket)\b/i.test(lower)) {
      return {
        reply: isEn
          ? `📌 **Ticket Cancellation & Exchange Policy at ${cinemaName}:**\n• Paid tickets are non-refundable in cash, except online cancellations/exchanges requested at least **24 hours** before showtime in [My Tickets ➔](/my-tickets) or showtime exchanges supported at the counter up to **60 minutes** prior via Hotline **${cinemaHotline}**.`
          : `📌 **Chính sách Đổi / Hủy vé tại ${cinemaName}:**\n• Hệ thống hỗ trợ đổi/hủy đơn trực tuyến trước giờ chiếu tối thiểu **24 giờ** tại mục [Vé của tôi ➔](/my-tickets), hoặc hỗ trợ đổi suất tại quầy trước **60 phút** qua Hotline **${cinemaHotline}**.`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

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
          reply: isEn
            ? `⚠️ Sorry, **${targetMovie.title}** at **${targetShowtime.time}** (${targetShowtime.roomName}) is currently **SOLD OUT (0 seats)** or closed for sale.`
            : `⚠️ Suất chiếu phim **${targetMovie.title}** lúc **${targetShowtime.time}** (${targetShowtime.roomName}) hiện đã **HẾT GHẾ (0 ghế trống)** nên không thể tạo link đặt vé. Bạn vui lòng chọn suất chiếu khác nhé!`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: targetMovie.title,
        };
      }

      return {
        reply: isEn
          ? `🎟️ **Official Booking Link:**\n• **Movie:** **${targetMovie.title}** (${targetMovie.ageRating})\n• **Showtime:** **${targetShowtime.time}** (${targetShowtime.date})\n• **Room:** **${targetShowtime.roomName}** (${targetShowtime.format})\n• **Price:** Standard **${targetShowtime.priceFormatted}** | VIP **${targetShowtime.priceVipFormatted}** | **${targetShowtime.availableSeats}** seats available\n\n👉 [Select Seats & Book Now ➔](${targetShowtime.bookingLink})`
          : `🎟️ **Link đặt vé chính thức cho suất chiếu của bạn:**\n• **Phim:** **${targetMovie.title}** (${targetMovie.ageRating})\n• **Suất chiếu:** **${targetShowtime.time}** (${targetShowtime.relativeDayLabel})\n• **Phòng chiếu:** **${targetShowtime.roomName}** (${targetShowtime.format}) — ${targetShowtime.cinemaName}\n• **Giá vé:** Thường **${targetShowtime.priceFormatted}** | VIP **${targetShowtime.priceVipFormatted}** | Còn **${targetShowtime.availableSeats}** ghế trống\n\n👉 [Đặt vé & Chọn ghế ngay ➔](${targetShowtime.bookingLink})`,
        movieCard: buildSafeMovieCard(targetShowtime, targetMovie, nowDate),
        movieCards: [],
        quickReplies: [],
        recommendedMovie: targetMovie.title,
      };
    }

    const showingForBooking = movies.filter((m) => m.status === 'NOW_SHOWING');
    if (showingForBooking.length > 0) {
      const movieListLines = showingForBooking.map((m, idx) => {
        const { daySlots, dayLabel } = selectDayShowtimesAndOtherDates(m.showtimes || [], entities, isEn);
        const slotDesc =
          daySlots.length > 0
            ? `${dayLabel ? `(${dayLabel}) ` : ''}${summarizeMovieSlotsCompact(daySlots, isEn)}`
            : isEn
              ? 'No open showtimes yet'
              : 'Chưa có suất mở bán';
        return `${idx + 1}. 🎬 **${m.title}** (**${m.ageRating}** | ${m.genre})\n   🕒 ${slotDesc}`;
      });

      const bookingCards = buildInteractiveMovieCards(
        showingForBooking.map((m) => {
          const { daySlots } = selectDayShowtimesAndOtherDates(m.showtimes || [], entities, isEn);
          return { movie: m, showtimes: daySlots.length > 0 ? daySlots : m.showtimes || [] };
        }),
        nowDate
      );

      return {
        reply: isEn
          ? `🎟️ How many tickets would you like to book, for which date, and which movie? Movies currently showing at **${cinemaName}**:\n\n${movieListLines.join('\n\n')}`
          : `🎟️ Bạn muốn đặt **bao nhiêu vé**, xem vào **ngày nào** và chọn **bộ phim nào** tại **${cinemaName}**? Hiện rạp đang chiếu:\n\n${movieListLines.join('\n\n')}`,
        movieCard: bookingCards[0] || null,
        movieCards: bookingCards,
        quickReplies: [],
        recommendedMovie: showingForBooking[0]?.title || '',
      };
    }

    return {
      reply: isEn
        ? 'Please let me know how many tickets, which date, and which movie you would like to book.'
        : 'Bạn vui lòng cho mình biết **số lượng vé**, **ngày xem** và **tên bộ phim** muốn đặt nhé!',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 10. PROMOTION_VOUCHER (Mục 6.1 Sinh viên, 6.3 Dùng 2 mã, 6.4 Mã 100%, Ưu đãi thực tế)
  // =========================================================================
  if (intent === INTENTS.PROMOTION_VOUCHER) {
    const formatPromoLine = (p) => {
      const codeBadge = p.code ? (isEn ? ` — Code: **\`${p.code}\`**` : ` — Mã: **\`${p.code}\`**`) : '';
      const discountInfo =
        p.discountPercent > 0
          ? isEn
            ? `**${p.discountPercent}% OFF**`
            : `Giảm **${p.discountPercent}%**`
          : p.discountAmount > 0
            ? isEn
              ? `**${formatVND(p.discountAmount)} OFF**`
              : `Giảm **${formatVND(p.discountAmount)}**`
            : p.discountValue
              ? `**${p.discountValue}**`
              : '';
      const minOrder =
        p.minOrderValue > 0
          ? isEn
            ? ` (Min order ${formatVND(p.minOrderValue)})`
            : ` (Đơn tối thiểu ${formatVND(p.minOrderValue)})`
          : '';
      const expiry = p.endDate
        ? ` • ${String(p.endDate).startsWith('HSD') ? p.endDate : isEn ? `Valid until: ${p.endDate}` : `HSD: ${p.endDate}`}`
        : '';
      return `• 🎁 **${p.title}**${codeBadge}${discountInfo ? `: ${discountInfo}` : ''}${minOrder}${expiry}${p.description ? `\n  _${p.description}_` : ''}`;
    };

    // 6.4: Khách yêu cầu mã giảm giá 100%
    if (entities.promoSubType === 'DISCOUNT_100') {
      const activePromoLines = (promotions || []).map(formatPromoLine);
      const refusalSentence = isEn
        ? 'Currently, the system does not offer any 100% discount codes. You can check out our active promotions below to choose one!'
        : 'Hiện tại hệ thống không có mã giảm giá 100% được cung cấp. Bạn có thể tham khảo các chương trình ưu đãi hiện đang áp dụng để lựa chọn nhé!';
      const activeSection =
        activePromoLines.length > 0
          ? `\n\n${activePromoLines.join('\n\n')}`
          : '';
      return {
        reply: `${refusalSentence}${activeSection}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // 6.3: Khách hỏi dùng 2 mã giảm giá cùng lúc
    if (entities.promoSubType === 'MULTI_CODE') {
      const faqMulti = systemFaqs.find((f) =>
        /nhiều mã|cùng lúc|2 mã/i.test(`${f.question} ${f.answer}`)
      );
      const extraException = faqMulti
        ? isEn
          ? '\n• **Combo Note:** Direct bundle discounts already built into Concession Combos remain valid alongside your 01 order voucher code.'
          : '\n• **Trường hợp kết hợp bắp nước:** Ưu đãi giảm giá trực tiếp trên gói Combo bắp nước vẫn được giữ nguyên khi bạn nhập 01 mã voucher hợp lệ cho đơn hàng.'
        : '';

      return {
        reply: isEn
          ? `📌 **Promo Code Combining Policy at ${cinemaName}:**\n• **Simultaneous codes:** **No** — the online checkout system accepts **at most 01 voucher code (\`voucherCode\`) per order**; two promo codes cannot be stacked on the same transaction.\n• **Conditions:** Each code must be active, unexpired, and meet the minimum order value; promo codes cannot be stacked with flat-rate Student/U22 ticket deals.${extraException}`
          : `📌 **Chính sách áp dụng mã giảm giá tại ${cinemaName}:**\n• **Áp dụng đồng thời 2 mã giảm giá:** **Không** — hệ thống thanh toán trực tuyến chỉ cho phép nhập **tối đa 01 mã giảm giá (\`voucherCode\`) cho mỗi đơn đặt vé**, không cộng dồn 2 mã giảm giá vé cùng lúc.\n• **Điều kiện áp dụng:** Mã còn thời hạn hiệu lực, đạt giá trị đơn tối thiểu (nếu có) và không cộng dồn đồng thời với chương trình đồng giá U22/HSSV.${extraException}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // 6.1: Khách hỏi ưu đãi sinh viên -> CHỈ trả lời thông tin ưu đãi sinh viên, không hiển thị KM không liên quan
    if (entities.promoSubType === 'STUDENT') {
      const studentPromos = (promotions || []).filter(
        (p) =>
          String(p.category || '').toUpperCase() === 'STUDENT' ||
          /sinh\s*viên|học\s*sinh|hssv|u22|student/i.test(
            `${p.title} ${p.code} ${p.description} ${p.badgeText}`
          )
      );

      if (studentPromos.length === 0) {
        return {
          reply: isEn
            ? `Currently, **${cinemaName}** does **not** have an active Student / U22 discount program in the system.`
            : `Hiện tại hệ thống **${cinemaName}** **chưa có** chương trình giảm giá dành riêng cho sinh viên đang hoạt động.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      const studentLines = studentPromos.map((sp) => {
        const codePart = sp.code ? (isEn ? ` (Code: **\`${sp.code}\`**)` : ` (Mã: **\`${sp.code}\`**)`) : '';
        const discountVal =
          sp.discountPercent > 0
            ? `${sp.discountPercent}%`
            : sp.discountAmount > 0
              ? formatVND(sp.discountAmount)
              : sp.discountValue || '45.000đ/vé 2D';
        const timePart = sp.endDate ? ` (${sp.endDate})` : '';
        return isEn
          ? `• **Program:** **${sp.title}**${codePart}\n• **Discount / Rate:** **${discountVal}**\n• **Conditions & Time:** ${sp.description || 'Applicable to 2D screenings as specified'}${timePart}\n• **Required ID:** Valid **Student ID card** or **Citizen ID (CCCD) under 22** at ticket check-in.`
          : `• **Chương trình:** **${sp.title}**${codePart}\n• **Mức ưu đãi:** **${discountVal}**\n• **Điều kiện & Thời gian áp dụng:** ${sp.description || 'Áp dụng cho suất chiếu 2D theo thể lệ chương trình'}${timePart}\n• **Giấy tờ cần xuất trình:** **Thẻ Học sinh – Sinh viên** còn hạn hoặc **CCCD dưới 22 tuổi** khi soát vé tại rạp.`;
      });

      return {
        reply: isEn
          ? `🎓 **Yes — Student / U22 Discount at ${cinemaName}:**\n\n${studentLines.join('\n\n')}`
          : `🎓 **Có — Ưu đãi dành cho Học sinh – Sinh viên tại ${cinemaName}:**\n\n${studentLines.join('\n\n')}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // Hỏi riêng ưu đãi theo cổng thanh toán (VNPAY / MoMo)
    if (entities.promoPaymentFilter) {
      const payKeyword = entities.promoPaymentFilter;
      const payPromos = (promotions || []).filter((p) =>
        new RegExp(payKeyword, 'i').test(`${p.title} ${p.code} ${p.description}`)
      );
      if (payPromos.length === 0) {
        return {
          reply: isEn
            ? `Currently **${cinemaName}** does not have a specific **${payKeyword}** voucher active in the system.`
            : `Hiện tại hệ thống **${cinemaName}** chưa có mã ưu đãi dành riêng cho **${payKeyword}** đang hoạt động.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }
      return {
        reply: isEn
          ? `💳 **${payKeyword} Promotions at ${cinemaName}:**\n\n${payPromos.map(formatPromoLine).join('\n\n')}`
          : `💳 **Ưu đãi thanh toán ${payKeyword} tại ${cinemaName}:**\n\n${payPromos.map(formatPromoLine).join('\n\n')}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // Hỏi ưu đãi chung
    const targetDealDate = entities.dateFilter?.startOfDay || nowDate;
    const dailyDeal = getDailyDealForDate(targetDealDate);
    const dayPrefix = entities.dateFilter?.label
      ? `${entities.dateFilter.label} (${dailyDeal.weekdayName})`
      : `Hôm nay — ${dailyDeal.weekdayName} (${dailyDeal.shortDate})`;

    const dailySection = isEn
      ? `⚡ **Daily Deal (${dailyDeal.shortDate}):** **${dailyDeal.title}** — Code: **\`${dailyDeal.code}\`** (${dailyDeal.discountTag})\n  _${dailyDeal.description}_`
      : `⚡ **Ưu đãi ${dayPrefix}:** **${dailyDeal.title}** — Mã: **\`${dailyDeal.code}\`** (${dailyDeal.discountTag})\n  _${dailyDeal.description}_`;

    const promoLines = (promotions || []).map(formatPromoLine);
    const dbSection =
      promoLines.length > 0
        ? isEn
          ? `\n\n🎟️ **Active Vouchers & Promotions at ${cinemaName}:**\n${promoLines.join('\n\n')}`
          : `\n\n🎟️ **Các chương trình & Voucher đang hiệu lực tại ${cinemaName}:**\n${promoLines.join('\n\n')}`
        : '';

    return {
      reply: `${dailySection}${dbSection}`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 11. CONCESSION_COMBO (Mục 6.2: Lọc chính xác Combo 2 người hoặc theo nhu cầu)
  // =========================================================================
  if (intent === INTENTS.CONCESSION_COMBO) {
    if (!concessions || concessions.length === 0) {
      return {
        reply: isEn
          ? 'Concession combo data is currently not available in the system.'
          : 'Hiện tại hệ thống chưa có dữ liệu combo bắp nước.',
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // 6.2: Nếu khách hỏi combo dành cho 2 người -> CHỈ hiển thị combo 2 người, loại bỏ combo đơn/gia đình/nước lẻ
    if (entities.comboTargetSize === 2) {
      const coupleCombos = concessions.filter((c) => {
        const text = `${c.name} ${c.description} ${c.badge}`.toLowerCase();
        const isTwoPerson =
          /2\s*người|hai\s*người|đôi|cặp\s*đôi|couple|2\s*nước|02\s*nước|2\s*pepsi|2\s*coca/i.test(text);
        const isFamilyOrSolo =
          /gia\s*đình|family|4\s*nước|04\s*nước|solo|1\s*người/i.test(text) && !/đôi|couple|2\s*người/i.test(c.name);
        return isTwoPerson && !isFamilyOrSolo;
      });

      if (coupleCombos.length === 0) {
        return {
          reply: isEn
            ? `Currently there are no specific 2-person combos listed at **${cinemaName}**.`
            : `Hiện tại hệ thống **${cinemaName}** chưa có gói combo bắp nước dành riêng cho 2 người.`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      const coupleLines = coupleCombos.map(
        (c) => `- **${c.name}**: ${c.description || (isEn ? 'Popcorn & 2 drinks' : 'Bắp & 2 nước')} – **${c.priceFormatted}**`
      );

      return {
        reply: isEn
          ? `🍿 **Combos for 2 people at ${cinemaName}:**\n${coupleLines.join('\n')}`
          : `🍿 **Hiện có các combo bắp nước dành cho 2 người tại ${cinemaName}:**\n${coupleLines.join('\n')}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    if (entities.comboTargetSize === 1) {
      const soloCombos = concessions.filter((c) =>
        /solo|1\s*người|1\s*bắp.*1\s*(nước|pepsi|coca)|my\s*combo/i.test(`${c.name} ${c.description}`)
      );
      if (soloCombos.length > 0) {
        const lines = soloCombos.map(
          (c) => `- **${c.name}**: ${c.description} – **${c.priceFormatted}**`
        );
        return {
          reply: isEn
            ? `🍿 **Combos for 1 person:**\n${lines.join('\n')}`
            : `🍿 **Combo bắp nước dành cho 1 người:**\n${lines.join('\n')}`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }
    }

    if (entities.comboTargetSize === 4) {
      const familyCombos = concessions.filter((c) =>
        /gia\s*đình|family|nhóm|4\s*nước|04\s*nước|2\s*bắp|02\s*bắp/i.test(`${c.name} ${c.description}`)
      );
      if (familyCombos.length > 0) {
        const lines = familyCombos.map(
          (c) => `- **${c.name}**: ${c.description} – **${c.priceFormatted}**`
        );
        return {
          reply: isEn
            ? `🍿 **Family / Group Combos at ${cinemaName}:**\n${lines.join('\n')}`
            : `🍿 **Combo bắp nước dành cho nhóm / gia đình tại ${cinemaName}:**\n${lines.join('\n')}`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }
    }

    if (entities.concessionSubType === 'DRINK_ONLY') {
      const drinkItems = concessions.filter(
        (c) =>
          String(c.category || '').toUpperCase() === 'DRINK' ||
          (/pepsi|coca|nước\s+ngọt|trà|nước\s+suối/i.test(c.name) && !/combo|bắp/i.test(c.name))
      );
      if (drinkItems.length > 0) {
        const lines = drinkItems.map(
          (c) => `- **${c.name}**: ${c.description || c.category} – **${c.priceFormatted}**`
        );
        return {
          reply: isEn
            ? `🥤 **Beverages at ${cinemaName}:**\n${lines.join('\n')}`
            : `🥤 **Thức uống lẻ hiện có tại ${cinemaName}:**\n${lines.join('\n')}`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }
    }

    if (entities.concessionSubType === 'POPCORN_ONLY') {
      const popcornItems = concessions.filter(
        (c) =>
          String(c.category || '').toUpperCase() === 'POPCORN' ||
          (/bắp|popcorn/i.test(c.name) && !/combo|nước/i.test(c.name))
      );
      if (popcornItems.length > 0) {
        const lines = popcornItems.map(
          (c) => `- **${c.name}**: ${c.description || c.category} – **${c.priceFormatted}**`
        );
        return {
          reply: isEn
            ? `🍿 **Popcorn Items at ${cinemaName}:**\n${lines.join('\n')}`
            : `🍿 **Bắp rang bơ lẻ hiện có tại ${cinemaName}:**\n${lines.join('\n')}`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }
    }

    const comboLines = concessions.map(
      (c) => `- **${c.name}**: ${c.description || c.category} – **${c.priceFormatted}**`
    );

    return {
      reply: isEn
        ? `🍿 **Concessions & Combos at ${cinemaName}:**\n${comboLines.join('\n')}`
        : `🍿 **Danh sách Combo bắp nước hiện có tại ${cinemaName}:**\n${comboLines.join('\n')}`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 12. CINEMA_LOCATION (Mục 9.1 Địa chỉ 1 cụm rạp duy nhất & Mục 9.2 Giờ hoạt động)
  // =========================================================================
  if (intent === INTENTS.CINEMA_LOCATION) {
    // 9.2: Khách hỏi giờ mở cửa / đóng cửa của rạp -> trả lời ngắn gọn, đúng trọng tâm, không nhầm giờ suất cuối
    if (entities.cinemaSubQuery === 'HOURS') {
      const hourParts = String(cinemaHours)
        .split(/\s*[-–]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      const hoursSentenceVi =
        hourParts.length === 2
          ? `Rạp **${cinemaName}** mở cửa từ **${hourParts[0]}** đến **${hourParts[1]}** hằng ngày.`
          : `Rạp **${cinemaName}** mở cửa trong khung giờ **${cinemaHours}** hằng ngày.`;
      const hoursSentenceEn =
        hourParts.length === 2
          ? `**${cinemaName}** is open daily from **${hourParts[0]}** to **${hourParts[1].replace(/sáng/i, 'AM').trim()}**.`
          : `**${cinemaName}** is open daily during **${cinemaHours}**.`;

      return {
        reply: isEn ? hoursSentenceEn : hoursSentenceVi,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // 9.1: Địa chỉ rạp -> CHỈ hiển thị ĐÚNG 1 cụm rạp đang được hệ thống sử dụng (Tên, Địa chỉ đầy đủ, Liên hệ)
    return {
      reply: isEn
        ? `📍 **Cinema Location & Contact:**\n• **Cinema:** **${cinemaName}**\n• **Address:** ${primaryCinema.address}\n• **Contact:** Hotline **${cinemaHotline}** | Email: **support@davenor.vn** (Open: **${cinemaHours}**)`
        : `📍 **Thông tin rạp chiếu phim:**\n• **Tên rạp:** **${cinemaName}**\n• **Địa chỉ:** ${primaryCinema.address}\n• **Liên hệ:** Hotline **${cinemaHotline}** | Email: **support@davenor.vn** (Giờ mở cửa: **${cinemaHours}**)`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 13. PAYMENT_SUPPORT (Hỗ trợ phương thức thanh toán & sự cố thanh toán thất bại)
  // =========================================================================
  if (intent === INTENTS.PAYMENT_SUPPORT) {
    return {
      reply: isEn
        ? `💳 **Payment Support at ${cinemaName}:**\n• **Accepted methods:** **VNPAY-QR**, **MoMo**, **ATM / Visa / Mastercard**.\n• **If payment failed or was charged without receiving a ticket:** Seats are automatically released if the transaction fails; please check [My Tickets ➔](/my-tickets) first, or submit your transaction ID via [Support Center ➔](/support) / Hotline **${cinemaHotline}** for immediate verification.`
        : `💳 **Hỗ trợ Thanh toán tại ${cinemaName}:**\n• **Phương thức hỗ trợ:** **VNPAY-QR**, Ví **MoMo**, và Thẻ ngân hàng **ATM / Visa / Mastercard**.\n• **Trường hợp thanh toán thất bại hoặc bị trừ tiền chưa nhận vé:** Nếu giao dịch lỗi, hệ thống không ghi nhận đơn và tự giải phóng ghế; nếu tài khoản đã bị trừ tiền, bạn kiểm tra mục [Vé của tôi ➔](/my-tickets) hoặc gửi mã giao dịch tại [Trung tâm Hỗ trợ ➔](/support) / Hotline **${cinemaHotline}** để nhân viên đối soát ngay.`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 13b. CUSTOMER_SUPPORT (Mục 9.3 Đi trễ 15p, 9.4 Quên điện thoại, 9.5 Gặp nhân viên, Đồ ăn ngoài...)
  // =========================================================================
  if (intent === INTENTS.CUSTOMER_SUPPORT) {
    // 9.3: Khách đến trễ 15 phút
    if (entities.policySubType === 'LATE_ARRIVAL') {
      return {
        reply: isEn
          ? `🕒 **Late Arrival Policy at ${cinemaName}:**\n• **Entry allowed:** **Yes** — if you arrive 15 minutes late while the screening is still in progress and hold a valid ticket QR code, you are still allowed into the auditorium.\n• **Conditions:** Present your valid ticket at check-in, silence your phone, dim your screen, and enter quietly (note: missed opening scenes cannot be replayed and started tickets cannot be refunded/exchanged).\n• **Staff assistance:** Please ask the ticket usher at the auditorium door to guide you safely to your assigned seat with a flashlight.`
          : `🕒 **Chính sách vào rạp khi đến trễ tại ${cinemaName}:**\n• **Có được vào xem không:** **Có** — theo quy định hiện hành của rạp, khi đến trễ 15 phút (suất chiếu vẫn đang diễn ra) và có mã vé QR hợp lệ, bạn vẫn được vào phòng chiếu.\n• **Điều kiện áp dụng:** Xuất trình vé hợp lệ tại quầy soát vé, chuyển điện thoại sang chế độ im lặng, giảm độ sáng màn hình và di chuyển trật tự *(lưu ý vé của suất đã bắt đầu chiếu không áp dụng đổi/hoàn)*.\n• **Hỗ trợ từ nhân viên:** Bạn vui lòng liên hệ nhân viên soát vé ngay cửa phòng chiếu để được hỗ trợ dùng đèn pin chuyên dụng dẫn vào đúng vị trí ghế đã đặt, tránh ảnh hưởng các khán giả khác.`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // 9.4: Khách để quên điện thoại / tài sản trong phòng chiếu
    if (entities.policySubType === 'LOST_ITEM') {
      return {
        reply: isEn
          ? `📱 **Lost Property Assistance at ${cinemaName}:**\nPlease stay calm and follow these steps so our team can check right away:\n1. **Movie title:** Note the exact movie you watched.\n2. **Showtime & Room:** Provide the screening date/time, auditorium name, and your seat number(s).\n3. **Item description:** Describe your phone (brand/model, color, phone case, lock screen).\n4. **Contact Support immediately:** Reach our Customer Service counter at **${primaryCinema.address}**, call Hotline **${cinemaHotline}**, or submit a ticket at [Support Center ➔](/support).\n5. **Staff inspection:** Our floor staff will inspect the auditorium and Lost & Found log and contact you as soon as verification is complete *(we cannot confirm an item is found until verified by on-site staff)*.`
          : `📱 **Hướng dẫn xử lý khi để quên điện thoại / tài sản trong phòng chiếu:**\nBạn hãy giữ bình tĩnh và thực hiện theo 5 bước sau để rạp hỗ trợ kiểm tra nhanh nhất:\n1. **Cung cấp tên bộ phim** bạn vừa xem.\n2. **Cung cấp suất chiếu (ngày, giờ chiếu) và phòng chiếu** *(kèm vị trí ghế ngồi nếu nhớ)*.\n3. **Mô tả đặc điểm điện thoại** (dòng máy, màu sắc, loại ốp lưng, đặc điểm nhận dạng...).\n4. **Liên hệ ngay bộ phận hỗ trợ:** Quầy Chăm sóc khách hàng tại **${primaryCinema.address}**, gọi Hotline **${cinemaHotline}**, hoặc gửi phiếu báo thất lạc tại [Trung tâm Hỗ trợ ➔](/support).\n5. **Nhân viên kiểm tra thực tế:** Bộ phận giám sát phòng chiếu sẽ trực tiếp kiểm tra khu vực ghế ngồi & kho đồ thất lạc, sau đó phản hồi kết quả xác nhận chính thức cho bạn.`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    // 9.5: Gặp nhân viên hỗ trợ
    if (entities.policySubType === 'LIVE_AGENT') {
      if (handoffTicket?.ticketCode) {
        return {
          reply: isEn
            ? `🎧 **Support Request Created:**\n• **Ticket Code:** **\`${handoffTicket.ticketCode}\`**\n• **Conversation Forwarded:** Your recent chat context has been sent to our Customer Support queue.\n• **Connection Status:** **Waiting for a support agent to pick up** *(live in-chat human takeover is not yet active; an agent will contact you via your registered phone/email shortly)*.\n• **Direct Channels:** Hotline **${cinemaHotline}** (${cinemaHours}) | Email: **support@davenor.vn** | [Support Center ➔](/support)`
            : `🎧 **Đã tạo yêu cầu kết nối nhân viên hỗ trợ:**\n• **Mã phiếu hỗ trợ:** **\`${handoffTicket.ticketCode}\`**\n• **Chuyển tiếp hội thoại:** Nội dung cuộc trò chuyện đã được gửi tới hàng đợi Chăm sóc khách hàng.\n• **Trạng thái kết nối:** **Đang chờ nhân viên tiếp nhận** *(hiện khung chat chưa kết nối trực tiếp tức thời với nhân viên thật; chuyên viên sẽ liên hệ lại qua SĐT/Email tài khoản của bạn trong khoảng 15 phút)*.\n• **Kênh liên hệ trực tiếp ngay lập tức:** Hotline **${cinemaHotline}** (${cinemaHours}) | Email: **support@davenor.vn** | [Trung tâm Hỗ trợ ➔](/support)`,
          movieCard: null,
          movieCards: [],
          quickReplies: [],
          recommendedMovie: '',
        };
      }

      return {
        reply: isEn
          ? `🎧 **Connect with ${cinemaName} Customer Support:**\nLive agent chat takeover is not directly active inside this widget yet, so please reach our staff directly through our official channels:\n• 📞 **Hotline:** **${cinemaHotline}** (${cinemaHours})\n• ✉️ **Email:** **support@davenor.vn**\n• 📝 **Online Support Request:** [Submit a Support Ticket ➔](/support) *(staff response within ~15 mins)*\n• 📍 **Counter:** ${primaryCinema.address}`
          : `🎧 **Liên hệ Nhân viên Hỗ trợ ${cinemaName}:**\nHiện khung chat chưa tích hợp kết nối chat trực tiếp tức thời với nhân viên, bạn vui lòng liên hệ trực tiếp đội ngũ hỗ trợ qua các kênh chính thức sau:\n• 📞 **Hotline:** **${cinemaHotline}** (${cinemaHours})\n• ✉️ **Email:** **support@davenor.vn**\n• 📝 **Gửi phiếu yêu cầu cho nhân viên:** [Mở Trung tâm Hỗ trợ ➔](/support) *(nhân viên phản hồi trong ~15 phút; hoặc đăng nhập tài khoản rồi nhắn lại để mình tạo phiếu tự động)*\n• 📍 **Quầy CSKH trực tiếp:** ${primaryCinema.address}`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    if (entities.policySubType === 'OUTSIDE_FOOD') {
      return {
        reply: isEn
          ? `🍿 **Outside Food & Drink Policy:** **${cinemaName}** does not allow outside food or beverages inside the screening rooms to maintain cleanliness and comfort.`
          : `🍿 **Quy định đồ ăn ngoài:** Để đảm bảo vệ sinh và không gian chung trong phòng chiếu, **${cinemaName}** **không cho phép mang đồ ăn và thức uống từ bên ngoài** vào rạp.`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    if (entities.policySubType === 'LOST_TICKET') {
      return {
        reply: isEn
          ? `🎟️ **Lost Ticket QR Code:** Sign in and open [My Tickets ➔](/my-tickets) to view your QR code, or contact Hotline **${cinemaHotline}** / [Support Center ➔](/support).`
          : `🎟️ **Lấy lại mã vé QR:** Bạn đăng nhập tài khoản và mở mục [Vé của tôi ➔](/my-tickets) để xem lại mã QR, hoặc liên hệ Hotline **${cinemaHotline}** / [Trang Hỗ trợ ➔](/support).`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    if (entities.policySubType === 'ACCOUNT') {
      return {
        reply: isEn
          ? `👤 **Account Support:** Manage sign-in, registration, or password reset via OTP at [Sign In / Register ➔](/auth), or contact [Support Center ➔](/support) / Hotline **${cinemaHotline}**.`
          : `👤 **Hỗ trợ Tài khoản:** Bạn có thể đăng nhập, đăng ký hoặc khôi phục mật khẩu qua OTP tại [Trang Đăng nhập / Đăng ký ➔](/auth), hoặc gửi yêu cầu tại [Trung tâm Hỗ trợ ➔](/support).`,
        movieCard: null,
        movieCards: [],
        quickReplies: [],
        recommendedMovie: '',
      };
    }

    return {
      reply: isEn
        ? `🎧 **${cinemaName} Customer Support:**\n• 📞 **Hotline:** **${cinemaHotline}** (${cinemaHours})\n• ✉️ **Email:** **support@davenor.vn**\n• 👉 [Open Support Center ➔](/support)`
        : `🎧 **Chăm sóc Khách hàng ${cinemaName}:**\n• 📞 **Hotline:** **${cinemaHotline}** (${cinemaHours})\n• ✉️ **Email:** **support@davenor.vn**\n• 👉 [Mở Trung tâm Hỗ trợ & Gửi phiếu ➔](/support)`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 14. UNKNOWN / CÂU HỎI CHƯA RÕ NGHĨA (Hỏi lại ngắn gọn phần thông tin còn thiếu)
  // =========================================================================
  if (/\b(ăn\s+gì|đói\s+bụng|muốn\s+ăn|đồ\s+ăn)\b/i.test(lower)) {
    return {
      reply: `Tại **${cinemaName}** có phục vụ các gói **Combo Bắp Rang Bơ và Nước ngọt** tại quầy Concessions. Bạn muốn xem danh sách combo chung hay combo dành cho 2 người ạ?`,
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      recommendedMovie: '',
    };
  }

  return {
    reply: isEn
      ? `Could you clarify what you'd like to check at **${cinemaName}** (for example: movie recommendations, showtimes, room types, seat availability, ticket booking, or cinema policies)?`
      : `Mình chưa nắm rõ yêu cầu của bạn. Bạn vui lòng cho mình biết cụ thể thông tin cần hỗ trợ tại **${cinemaName}** nhé (ví dụ: tư vấn phim, lịch chiếu, phòng chiếu, kiểm tra ghế trống, đặt vé hoặc chính sách rạp)!`,
    movieCard: null,
    movieCards: [],
    quickReplies: [],
    recommendedMovie: '',
  };
};
