import { INTENTS, removeVietnameseTones } from './intentService.js';
import { calculateTicketQuote, formatVND } from './pricingService.js';
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

/**
 * Tạo danh sách thẻ phim tương tác (`movieCards`) cho nhiều phim / nhiều suất chiếu cùng lúc,
 * giúp người dùng bấm trực tiếp vào bất kỳ phim hoặc giờ chiếu nào họ muốn xem (VD: chọn thẳng phim Mai
 * hoặc Quật Mộ Trùng Ma ngay trong danh sách phim hôm nay).
 */
export const buildInteractiveMovieCards = (movieGroups = [], nowDate = new Date()) => {
  if (!Array.isArray(movieGroups) || movieGroups.length === 0) return [];
  const cards = [];

  for (const group of movieGroups) {
    const movie = group?.movie;
    if (!movie) continue;
    const rawSlots = Array.isArray(group.showtimes) ? group.showtimes : movie.showtimes || [];
    const validSlots = rawSlots.filter((st) => isValidShowtimeForBooking(st, movie._id, nowDate));
    if (validSlots.length === 0) continue;

    const primarySlot = validSlots[0];
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
      format: primarySlot.format || '2D',
      price: primarySlot.priceFormatted || '',
      availableSeats: primarySlot.availableSeats,
      showtimes: validSlots.slice(0, 4).map((st) => ({
        showtimeId: String(st.showtimeId || st._id),
        time: st.time,
        dateLabel: st.relativeDayLabel || '',
        room: st.roomName || 'Phòng chiếu tiêu chuẩn',
        format: st.format || '2D',
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
  const seatStatus =
    st.availableSeats > 0
      ? `Còn **${st.availableSeats}** ghế trống`
      : `**HẾT GHẾ (0 ghế trống)**`;
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
  const displayName =
    userInfo?.userName && userInfo.userName !== 'Khách vãng lai' ? userInfo.userName : 'bạn';
  const lower = String(userMessage || '').toLowerCase().trim();

  // =========================================================================
  // 0. NẾU KHÁCH HỎI ĐÍCH DANH MỘT PHIM KHÔNG CÓ TRONG DATABASE
  // =========================================================================
  if (entities.unmatchedMovieTitle && !entities.matchedMovie) {
    const activeMovieTitles = movies
      .filter((m) => m.status === 'NOW_SHOWING')
      .slice(0, 5)
      .map((m) => `**${m.title}** (${m.ageRating})`)
      .join(', ');

    const suggestionPart = activeMovieTitles
      ? `\n\n🎬 Các bộ phim hiện đang mở bán vé tại rạp gồm: ${activeMovieTitles}. Bạn có muốn mình tra cứu lịch chiếu của một trong các phim này không?`
      : '\n\nBạn vui lòng kiểm tra lại tên phim hoặc theo dõi lịch chiếu mới nhất trên trang chủ nhé!';

    return {
      reply: `Hiện tại phim **"${entities.unmatchedMovieTitle}"** không có trong danh sách đang chiếu tại hệ thống **D'AVENOR CINEMA**.${suggestionPart}`,
      movieCard: null,
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 1. GENERAL_CHAT (Chào hỏi, cảm ơn, hỏi thông tin trợ lý)
  // =========================================================================
  if (intent === INTENTS.GENERAL_CHAT) {
    if (/^(cảm\s+ơn|cám\s+ơn|thank|ok\s+cảm\s+ơn)/i.test(lower)) {
      return {
        reply: `Rất vui được hỗ trợ **${displayName}**! Chúc bạn có những giây phút thưởng thức điện ảnh tuyệt vời tại **D'AVENOR CINEMA**. Nếu cần kiểm tra thêm suất chiếu, ghế trống hay giá vé, bạn cứ nhắn mình nhé! 🍿`,
        movieCard: null,
        recommendedMovie: '',
      };
    }

    if (/^(tạm\s+biệt|bye|good\s*bye|hẹn\s+gặp\s+lại)/i.test(lower)) {
      return {
        reply: `Tạm biệt **${displayName}**! Hẹn gặp lại bạn tại cụm rạp **D'AVENOR CINEMA Đà Nẵng** nhé! 👋🎬`,
        movieCard: null,
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

    // Báo cáo số ghế trống thực tế của các suất khớp điều kiện
    const seatLines = candidatePairs.slice(0, 5).map(({ movie, showtime }) => {
      if (showtime.availableSeats <= 0) {
        return `• **${movie.title}** — Suất **${showtime.time}** (${showtime.relativeDayLabel}, ${showtime.roomName}): **HẾT GHẾ (0 ghế trống)**`;
      }
      const linkStr = showtime.bookingLink ? ` — [Chọn ghế ➔](${showtime.bookingLink})` : '';
      return `• **${movie.title}** — Suất **${showtime.time}** (${showtime.relativeDayLabel}, ${showtime.roomName}): Còn **${showtime.availableSeats}** ghế trống (Giá từ ${showtime.priceFormatted})${linkStr}`;
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
  // 5. MOVIE_RECOMMENDATION (Tư vấn phim theo độ tuổi trẻ em / thể loại / đánh giá)
  // =========================================================================
  if (intent === INTENTS.MOVIE_RECOMMENDATION) {
    let candidates = movies.filter((m) => m.status === 'NOW_SHOWING' || (m.showtimes && m.showtimes.length > 0));

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
        return {
          reply: `Hiện tại rạp chưa có bộ phim nào thuộc thể loại **${entities.genres.join(', ')}**${entities.viewerAge ? ` phù hợp cho khán giả **${entities.viewerAge} tuổi**` : ''} đang chiếu. Bạn có muốn tham khảo các thể loại khác đang mở bán tại rạp không?`,
          movieCard: null,
          recommendedMovie: '',
        };
      }
    }

    if (candidates.length === 0) {
      if (entities.viewerAge !== null) {
        return {
          reply: `Theo quy định phân loại độ tuổi, khán giả **${entities.viewerAge} tuổi** chỉ được xem các bộ phim phân loại **${entities.allowedAgeRatings.join(', ')}** (không xem các phim T13, T16, T18).\n\nHiện tại hệ thống D'AVENOR CINEMA chưa có phim phân loại **${entities.allowedAgeRatings.join(', ')}** nào đang mở bán suất chiếu. Bạn vui lòng theo dõi lịch chiếu cập nhật trên website nhé!`,
          movieCard: null,
          recommendedMovie: '',
        };
      }

      return {
        reply: `Hiện tại hệ thống chưa có bộ phim nào khớp với tiêu chí bạn tìm kiếm. Bạn vui lòng tham khảo danh sách phim trên trang chủ nhé!`,
        movieCard: null,
        recommendedMovie: '',
      };
    }

    const ageHeader =
      entities.viewerAge !== null
        ? `👶 **Gợi ý phim phù hợp cho khán giả ${entities.viewerAge} tuổi (Chỉ lọc phim phân loại ${entities.allowedAgeRatings.join(', ')}, an toàn theo quy định độ tuổi):**\n\n`
        : `🌟 **Gợi ý phim đang chiếu nổi bật tại D'AVENOR CINEMA:**\n\n`;

    const movieLines = candidates.slice(0, 4).map((m) => {
      const openSlots = (m.showtimes || []).filter((s) => s.availableSeats > 0);
      const slotPreview =
        openSlots.length > 0
          ? openSlots
              .slice(0, 3)
              .map(
                (s) =>
                  `${s.time} (${s.relativeDayLabel}, ${s.format}, ${s.priceFormatted}, còn ${s.availableSeats} ghế)`
              )
              .join(' | ')
          : 'Hiện chưa có suất chiếu mở bán';
      const firstLink = openSlots[0]?.bookingLink
        ? ` — [Đặt vé ngay ➔](${openSlots[0].bookingLink})`
        : '';
      return `• 🎬 **${m.title}** (Độ tuổi: **${m.ageRating}** | ⭐ ${m.rating}/5 | ${m.genre} | ${m.duration} phút)\n  🕒 Suất chiếu: ${slotPreview}${firstLink}`;
    });

    const firstMovieWithOpenSlot = candidates.find((m) =>
      (m.showtimes || []).some((s) => s.availableSeats > 0)
    );
    const firstOpenSlot = firstMovieWithOpenSlot
      ? firstMovieWithOpenSlot.showtimes.find((s) => s.availableSeats > 0)
      : null;

    const movieCards = buildInteractiveMovieCards(
      candidates.slice(0, 4).map((m) => ({ movie: m, showtimes: m.showtimes || [] })),
      nowDate
    );

    return {
      reply: `${ageHeader}${movieLines.join('\n\n')}`,
      movieCard: firstOpenSlot
        ? buildSafeMovieCard(firstOpenSlot, firstMovieWithOpenSlot, nowDate)
        : null,
      movieCards,
      recommendedMovie: firstMovieWithOpenSlot
        ? firstMovieWithOpenSlot.title
        : candidates[0].title,
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

    return {
      reply: `🎬 **Thông tin chi tiết phim: ${m.title}**\n\n• **Thể loại:** ${m.genre}\n• **Thời lượng:** ${m.duration} phút\n• **Phân loại độ tuổi:** **${m.ageRating}**\n• **Đánh giá:** ⭐ ${m.rating}/5\n• **Định dạng hỗ trợ:** ${m.supportedFormats.length > 0 ? m.supportedFormats.join(', ') : 'Đang cập nhật'}${m.description ? `\n• **Tóm tắt nội dung:** ${m.description}` : ''}\n\n🕒 **Các suất chiếu sắp tới:**\n${slotText}`,
      movieCard: openSlots[0] ? buildSafeMovieCard(openSlots[0], m, nowDate) : null,
      recommendedMovie: m.title,
    };
  }

  // =========================================================================
  // 7. MOVIE_SEARCH (Danh sách phim đang chiếu hôm nay / ngày mai / ngày cụ thể)
  // =========================================================================
  if (intent === INTENTS.MOVIE_SEARCH) {
    if (entities.dateFilter) {
      const targetDateKey = entities.dateFilter.dateKey;
      const moviesOnDate = movies
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
          recommendedMovie: '',
        };
      }

      const lines = moviesOnDate.slice(0, 6).map(({ movie, slots }) => {
        const slotSummary = slots
          .slice(0, 4)
          .map((s) => {
            const seatNote = s.availableSeats > 0 ? `còn ${s.availableSeats} ghế` : 'HẾT GHẾ';
            const quickLink =
              s.bookingLink && s.availableSeats > 0 ? ` [Đặt ${s.time}](${s.bookingLink})` : '';
            return `**${s.time}** (${s.format} - ${s.priceFormatted} - ${seatNote})${quickLink}`;
          })
          .join(', ');
        const detailLink = movie._id ? ` • [Chi tiết](/movie/${movie._id})` : '';
        return `• 🎬 **${movie.title}** (Độ tuổi: **${movie.ageRating}** | ${movie.genre}): ${slotSummary}${detailLink}`;
      });

      const movieCards = buildInteractiveMovieCards(
        moviesOnDate.slice(0, 6).map(({ movie, slots }) => ({ movie, showtimes: slots })),
        nowDate
      );

      const firstOpenPair = moviesOnDate
        .flatMap(({ movie, slots }) => slots.map((s) => ({ movie, showtime: s })))
        .find(({ showtime }) => showtime.availableSeats > 0);

      return {
        reply: `📅 **Danh sách phim và suất chiếu vào ${entities.dateFilter.label} tại D'AVENOR CINEMA:**\n\n${lines.join('\n\n')}\n\n💡 *Bấm trực tiếp vào tên phim hoặc thẻ suất chiếu bên dưới để chọn ghế đặt vé ngay!*`,
        movieCard: firstOpenPair
          ? buildSafeMovieCard(firstOpenPair.showtime, firstOpenPair.movie, nowDate)
          : null,
        movieCards,
        recommendedMovie: firstOpenPair ? firstOpenPair.movie.title : moviesOnDate[0].movie.title,
      };
    }

    // Không chỉ định ngày cụ thể -> Liệt kê tất cả phim đang chiếu
    const showingMovies = movies.filter((m) => m.status === 'NOW_SHOWING' || (m.showtimes && m.showtimes.length > 0));
    if (showingMovies.length === 0) {
      return {
        reply: `Hiện tại hệ thống D'AVENOR CINEMA đang cập nhật danh sách phim mới. Bạn vui lòng kiểm tra lại trên trang chủ sau ít phút nhé!`,
        movieCard: null,
        movieCards: [],
        recommendedMovie: '',
      };
    }

    const lines = showingMovies.slice(0, 6).map((m) => {
      const nextSlots = (m.showtimes || []).slice(0, 3);
      const slotDesc =
        nextSlots.length > 0
          ? nextSlots
              .map((s) => {
                const quickLink =
                  s.bookingLink && s.availableSeats > 0 ? ` [Đặt ${s.time}](${s.bookingLink})` : '';
                return `**${s.time}** (${s.relativeDayLabel}, ${s.format}, ${s.priceFormatted})${quickLink}`;
              })
              .join(' | ')
          : 'Chưa có suất chiếu mở bán';
      const detailLink = m._id ? ` • [Chi tiết](/movie/${m._id})` : '';
      return `• 🎬 **${m.title}** (**${m.ageRating}** | ⭐ ${m.rating}/5 | ${m.genre}) — Suất: ${slotDesc}${detailLink}`;
    });

    const movieCards = buildInteractiveMovieCards(
      showingMovies.slice(0, 6).map((m) => ({ movie: m, showtimes: m.showtimes || [] })),
      nowDate
    );

    const firstMovieWithSlot = showingMovies.find((m) =>
      (m.showtimes || []).some((s) => s.availableSeats > 0)
    );
    const firstSlot = firstMovieWithSlot?.showtimes.find((s) => s.availableSeats > 0) || null;

    return {
      reply: `🎬 **Danh sách phim đang chiếu tại D'AVENOR CINEMA:**\n\n${lines.join('\n\n')}\n\n💡 *Bấm trực tiếp vào phim hoặc khung giờ chiếu bên dưới để đặt vé ngay!*`,
      movieCard: firstSlot ? buildSafeMovieCard(firstSlot, firstMovieWithSlot, nowDate) : null,
      movieCards,
      recommendedMovie: firstMovieWithSlot?.title || showingMovies[0].title,
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

    const lines = matchedPairs
      .slice(0, 6)
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
        reply: `📌 **Chính sách Đổi / Hoàn vé tại D'AVENOR CINEMA:**\n• Vé đã thanh toán thành công không áp dụng hoàn tiền mặt.\n• Hệ thống hỗ trợ **đổi sang suất chiếu khác** nếu bạn liên hệ trước giờ chiếu tối thiểu **60 phút** tại quầy dịch vụ D'AVENOR hoặc qua Hotline **1900 6868**.`,
        movieCard: null,
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
  // 10. PROMOTION_VOUCHER (Chỉ trả về các khuyến mãi đang ACTIVE và còn hạn)
  // =========================================================================
  if (intent === INTENTS.PROMOTION_VOUCHER) {
    if (!promotions || promotions.length === 0) {
      return {
        reply: `Hiện tại hệ thống **D'AVENOR CINEMA** không có chương trình khuyến mãi hoặc mã voucher nào đang trong thời gian áp dụng. Bạn vui lòng theo dõi mục **Khuyến mãi** trên website để cập nhật ưu đãi mới nhất nhé!`,
        movieCard: null,
        recommendedMovie: '',
      };
    }

    const promoLines = promotions.map((p) => {
      const codeBadge = p.code ? ` — Mã: **\`${p.code}\`**` : '';
      const discountInfo =
        p.discountPercent > 0
          ? `Giảm **${p.discountPercent}%**`
          : p.discountAmount > 0
            ? `Giảm **${formatVND(p.discountAmount)}**`
            : p.badgeText
              ? `**${p.badgeText}**`
              : '';
      const minOrder =
        p.minOrderValue > 0 ? ` (Đơn tối thiểu ${formatVND(p.minOrderValue)})` : '';
      const expiry = p.endDate ? ` • HSD: ${p.endDate}` : '';
      return `• 🎁 **${p.title}**${codeBadge}: ${discountInfo}${minOrder}${expiry}\n  _${p.description}_`;
    });

    return {
      reply: `🎉 **Các chương trình Khuyến mãi & Mã Voucher đang có hiệu lực tại D'AVENOR CINEMA:**\n\n${promoLines.join('\n\n')}`,
      movieCard: null,
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
  // 12. CINEMA_LOCATION (Địa chỉ cụm rạp & tiện ích gửi xe)
  // =========================================================================
  if (intent === INTENTS.CINEMA_LOCATION) {
    const cinemaLines = cinemas.map((c) => `• 📍 **${c.name}**: ${c.address}`).join('\n');
    return {
      reply: `📍 **Hệ thống cụm rạp D'AVENOR CINEMA tại Đà Nẵng:**\n\n${cinemaLines}\n\n🛵 **Tiện ích gửi xe:** Hầm giữ xe B1–B2 thông thoáng, hỗ trợ giữ xe cho khách xem phim khi xuất trình mã vé điện tử QR.`,
      movieCard: null,
      recommendedMovie: '',
    };
  }

  // =========================================================================
  // 13. PAYMENT_SUPPORT (Hỗ trợ phương thức thanh toán)
  // =========================================================================
  if (intent === INTENTS.PAYMENT_SUPPORT) {
    return {
      reply: `💳 **Hỗ trợ Thanh toán tại D'AVENOR CINEMA:**\n\n• **Các phương thức hỗ trợ:** Quét mã QR **VNPay**, Ví điện tử **MoMo**, **ZaloPay**, và Thẻ ngân hàng nội địa **ATM / Napas** hoặc **Visa / Mastercard**.\n• **Thời gian giữ ghế:** Hệ thống giữ ghế tối đa **10 phút** trong lúc bạn thực hiện thanh toán.\n• **Xử lý sự cố:** Nếu tài khoản đã trừ tiền nhưng chưa nhận được mã vé QR trong mục **"Vé của tôi"**, bạn vui lòng liên hệ Hotline **1900 6868** để được kiểm tra đối soát ngay lập tức.`,
      movieCard: null,
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

