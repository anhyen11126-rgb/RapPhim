import { parseVietnameseDateFromText, parseTimeFilterFromText } from './timezoneUtils.js';

export const INTENTS = {
  MOVIE_SEARCH: 'MOVIE_SEARCH',
  MOVIE_DETAIL: 'MOVIE_DETAIL',
  MOVIE_RECOMMENDATION: 'MOVIE_RECOMMENDATION',
  SHOWTIME_SEARCH: 'SHOWTIME_SEARCH',
  SHOWTIME_3D: 'SHOWTIME_3D',
  TICKET_PRICE: 'TICKET_PRICE',
  SEAT_AVAILABILITY: 'SEAT_AVAILABILITY',
  CINEMA_LOCATION: 'CINEMA_LOCATION',
  CONCESSION_COMBO: 'CONCESSION_COMBO',
  PROMOTION_VOUCHER: 'PROMOTION_VOUCHER',
  BOOKING_GUIDE: 'BOOKING_GUIDE',
  PAYMENT_SUPPORT: 'PAYMENT_SUPPORT',
  GENERAL_CHAT: 'GENERAL_CHAT',
  UNKNOWN: 'UNKNOWN',
};

export const MAX_USER_MESSAGE_LENGTH = 500;
export const MAX_HISTORY_ITEMS = 10;
export const MAX_HISTORY_TEXT_LENGTH = 600;

/**
 * Chuẩn hóa chuỗi bỏ dấu tiếng Việt để so khớp tên phim / thực thể chính xác với ranh giới từ ASCII (\b)
 */
export const removeVietnameseTones = (str = '') => {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};

/**
 * Thoát ký tự đặc biệt trong Regex
 */
const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Kiểm tra & làm sạch dữ liệu đầu vào (userMessage, history, userInfo)
 */
export const validateAndSanitizeInput = (rawMessage, rawHistory = [], rawUserInfo = {}) => {
  const rawStr = typeof rawMessage === 'string' ? rawMessage.trim() : String(rawMessage || '').trim();
  const isTooLong = rawStr.length > MAX_USER_MESSAGE_LENGTH;
  const cleanMessage = rawStr
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, MAX_USER_MESSAGE_LENGTH);

  const safeHistory = [];
  if (Array.isArray(rawHistory)) {
    const recentSlice = rawHistory.slice(-MAX_HISTORY_ITEMS);
    for (const item of recentSlice) {
      if (!item || typeof item !== 'object') continue;
      const rawSender = String(item.sender || item.role || '').toLowerCase();
      // Không tin tưởng role system hoặc dữ liệu lạ từ client
      if (rawSender !== 'user' && rawSender !== 'bot' && rawSender !== 'model') continue;

      const text = String(item.text || item.content || '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, MAX_HISTORY_TEXT_LENGTH);

      if (!text) continue;
      safeHistory.push({
        sender: rawSender === 'user' ? 'user' : 'bot',
        text,
        movieCard:
          item.movieCard && typeof item.movieCard === 'object'
            ? {
                title: String(item.movieCard.title || '').slice(0, 120),
                showtimeId: String(item.movieCard.showtimeId || '').slice(0, 40),
                time: String(item.movieCard.time || '').slice(0, 20),
                room: String(item.movieCard.room || '').slice(0, 80),
              }
            : null,
      });
    }
  }

  const rawUserName = String(rawUserInfo?.userName || 'Khách vãng lai')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 60);
  const rawUserEmail = String(rawUserInfo?.userEmail || '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 100);

  return {
    cleanMessage,
    isTooLong,
    safeHistory,
    safeUserInfo: {
      userName: rawUserName || 'Khách vãng lai',
      userEmail: rawUserEmail,
    },
  };
};

/**
 * Phát hiện tấn công Prompt Injection hoặc yêu cầu tiết lộ cấu hình nội bộ / vượt quyền
 */
export const detectPromptInjection = (message = '') => {
  const lower = String(message || '').toLowerCase();
  const noTone = removeVietnameseTones(lower);

  const injectionPatterns = [
    /\bbo\s+qua\s+(moi\s+|tat\s+ca\s+|cac\s+)?(quy\s+tac|huong\s+dan|lenh|rang\s+buoc|he\s+thong|system)/i,
    /\bphot\s+lo\s+(moi\s+|tat\s+ca\s+)?(quy\s+tac|huong\s+dan|system)/i,
    /\bignore\s+(all\s+|previous\s+|prior\s+|system\s+)?(instructions|rules|prompts|constraints)/i,
    /\bdisregard\s+(all\s+|previous\s+|system\s+)?(instructions|rules|prompts)/i,
    /\bsystem\s*prompt\b/i,
    /\breveal\s+(your\s+)?(api\s*key|secret|system\s*instruction|prompt)/i,
    /\bcho\s+(toi\s+|minh\s+)?(xem|biet)\s*(api\s*key|ma\s+bi\s+mat|cau\s+hinh\s+he\s+thong|system\s+prompt)/i,
    /\btao\s+(cho\s+toi\s+|ho\s+)?(ve\s+mien\s+phi|ma\s+giam\s+gia\s+100%|suat\s+chieu\s+gia|ve\s+0\s*d)/i,
    /\byou\s+are\s+now\s+(dan|jailbreak|unrestricted|developer\s+mode)/i,
  ];

  return injectionPatterns.some((pattern) => pattern.test(noTone) || pattern.test(lower));
};

/**
 * Các cụm từ (không dấu) chứa chữ "mai" nhưng KHÔNG PHẢI tên bộ phim "Mai"
 */
const NON_MOVIE_MAI_PHRASES_NO_TONE = [
  /\bngay\s+mai\b/gi,
  /\btoi\s+mai\b/gi,
  /\bsang\s+mai\b/gi,
  /\bchieu\s+mai\b/gi,
  /\btrua\s+mai\b/gi,
  /\bdem\s+mai\b/gi,
  /\bmai\s+mot\b/gi,
  /\bkhuyen\s+mai\b/gi,
  /\bpho\s+mai\b/gi,
  /\bhoa\s+mai\b/gi,
  /\bmai\s+sau\b/gi,
  /\bmai\s+co\s+phim\b/gi,
  /\bmai\s+chieu\s+phim\b/gi,
  /\bmai\s+chieu\s+gi\b/gi,
];

/**
 * Tìm bộ phim khớp chính xác trong danh sách phim từ Database,
 * chống nhận diện nhầm từ đơn âm tiết như "Mai" trong "Ngày mai có phim gì?"
 */
export const matchMovieFromText = (text = '', availableMovies = []) => {
  if (!text || !Array.isArray(availableMovies) || availableMovies.length === 0) {
    return null;
  }

  const rawLower = String(text).toLowerCase().trim();
  const rawNoTone = removeVietnameseTones(rawLower);

  // Loại bỏ các cụm từ thời gian/thông dụng chứa "mai" trên chuỗi không dấu
  let scrubbedNoTone = rawNoTone;
  for (const regex of NON_MOVIE_MAI_PHRASES_NO_TONE) {
    scrubbedNoTone = scrubbedNoTone.replace(regex, ' ');
  }

  // Sắp xếp phim có tiêu đề dài trước để ưu tiên khớp tên đầy đủ hơn tên ngắn
  const sortedMovies = [...availableMovies].sort(
    (a, b) => String(b.title || '').length - String(a.title || '').length
  );

  for (const movie of sortedMovies) {
    const fullTitle = String(movie.title || '').trim();
    if (!fullTitle) continue;

    const titleNoTone = removeVietnameseTones(fullTitle);

    // Tách phần tên chính trước dấu ":" hoặc "-" (VD: "Avatar: Dòng Chảy Của Nước" -> "avatar")
    const mainPrefixNoTone = titleNoTone.split(/[:\-–]/)[0].trim();

    const isShortAmbiguousTitle =
      titleNoTone.split(/\s+/).length === 1 && titleNoTone.length <= 4;

    if (isShortAmbiguousTitle) {
      // Nếu tên phim ngắn 1 âm tiết (như "Mai"):
      // 1. Có cụm "phim <ten>" hoặc trong ngoặc kép
      const explicitMovieMention = new RegExp(
        `(?:\\bphim\\s+|["'“])${escapeRegex(titleNoTone)}\\b`,
        'i'
      ).test(rawNoTone);

      // 2. Hoặc sau khi đã loại bỏ "ngay mai", "toi mai", "khuyen mai", "pho mai"... vẫn còn từ "mai" độc lập
      const wordBoundaryInScrubbed = new RegExp(`\\b${escapeRegex(titleNoTone)}\\b`, 'i').test(
        scrubbedNoTone
      );

      if (explicitMovieMention || wordBoundaryInScrubbed) {
        return movie;
      }
      continue;
    }

    // Với phim có tên bình thường (từ 2 từ trở lên hoặc > 4 ký tự, VD: "Avatar", "Dune", "Lật Mặt 7")
    const fullTitleNoToneRegex = new RegExp(`\\b${escapeRegex(titleNoTone)}\\b`, 'i');
    if (fullTitleNoToneRegex.test(rawNoTone)) {
      return movie;
    }

    if (mainPrefixNoTone.length >= 4) {
      const prefixNoToneRegex = new RegExp(`\\b${escapeRegex(mainPrefixNoTone)}\\b`, 'i');
      if (prefixNoToneRegex.test(rawNoTone)) {
        return movie;
      }
    }
  }

  return null;
};

/**
 * Phát hiện tên phim mà người dùng hỏi nhưng KHÔNG tồn tại trong danh sách phim hiện tại
 * VD: "Phim Oppenheimer tối nay có chiếu không?", "Phim Spider-Man có suất nào không?"
 */
export const extractUnmatchedMovieQuery = (text = '', matchedMovie = null) => {
  if (matchedMovie) return null;
  const clean = String(text || '').trim();

  // Mẫu: "phim <Tên riêng>" nhưng không phải các từ chung chung
  const match = clean.match(
    /(?:^|\s)phim\s+([A-Za-zÀ-ỹ0-9][A-Za-zÀ-ỹ0-9\s:\-']{1,35}?)(?:\s+(?:có|còn|chiếu|lúc|tối|hôm|ngày|suất|giá|ở|không|nào|mấy|bao\s+nhiêu|hay)|[?!.,]|$)/i
  );
  if (!match) return null;

  const candidate = match[1].trim();
  const candidateNoTone = removeVietnameseTones(candidate);

  const genericWordsNoTone = [
    'gi',
    'nao',
    'hay',
    'moi',
    'bom tan',
    'dang chieu',
    'sap chieu',
    'hom nay',
    'ngay mai',
    'toi nay',
    'toi mai',
    'cuoi tuan',
    'hanh dong',
    'kinh di',
    'tinh cam',
    'hoat hinh',
    'hai',
    'vien tuong',
    'gia dinh',
    'tam ly',
    'tre em',
    '3d',
    '2d',
    'imax',
    'rap',
    'do',
    'nay',
    'ay',
    'viet nam',
    'my',
    'han quoc',
  ];

  if (
    genericWordsNoTone.some(
      (w) =>
        candidateNoTone === w ||
        candidateNoTone.startsWith(`${w} `) ||
        candidateNoTone.endsWith(` ${w}`)
    )
  ) {
    return null;
  }

  return candidate;
};

/**
 * Trích xuất tất cả thực thể (Entities) từ câu hỏi
 * Sử dụng `noTone` cho các biểu thức chính quy có `\b` để tương thích 100% với tiếng Việt.
 */
export const extractEntities = (
  message = '',
  availableMovies = [],
  availableCinemas = [],
  nowDate = new Date()
) => {
  const lower = String(message || '').toLowerCase().trim();
  const noTone = removeVietnameseTones(lower);

  // 1. Tên phim khớp trong DB & Tên phim hỏi nhưng không có trong DB
  const matchedMovie = matchMovieFromText(message, availableMovies);
  const unmatchedMovieTitle = extractUnmatchedMovieQuery(message, matchedMovie);

  // 2. Ngày chiếu & Khung giờ chiếu
  const dateFilter = parseVietnameseDateFromText(message, nowDate);
  const timeFilter = parseTimeFilterFromText(message);

  // 3. Định dạng chiếu (3D, IMAX, Gold Class, 2D)
  let format = null;
  if (/\b(3d|reald\s*3d|kinh\s*3d|rap\s*05|phong\s*05)\b/i.test(noTone)) {
    format = '3D';
  } else if (/\b(imax|laser)\b/i.test(noTone)) {
    format = 'IMAX';
  } else if (/\b(gold\s*class)\b/i.test(noTone)) {
    format = 'GOLD_CLASS';
  } else if (/\b(2d)\b/i.test(noTone)) {
    format = '2D';
  }

  // 4. Số lượng vé / ghế & Yêu cầu ghế liền nhau
  let ticketQuantity = null;
  const qtyMatch = noTone.match(/\b(\d{1,2})\s*(ve|ghe|nguoi|cho|suat)\b/i);
  if (qtyMatch) {
    const n = Number(qtyMatch[1]);
    if (n >= 1 && n <= 50) ticketQuantity = n;
  }

  const requireContiguousSeats =
    /\b(lien\s+nhau|canh\s+nhau|sat\s+nhau|lien\s+ke|ngoi\s+chung|ngoi\s+canh|cung\s+hang)\b/i.test(
      noTone
    );

  // 5. Loại ghế (VIP, Sweetbox, Standard)
  let seatType = null;
  if (/\b(sweetbox|ghe\s+doi|couple)\b/i.test(noTone)) {
    seatType = 'SWEETBOX';
  } else if (/\b(vip|ghe\s+vip|hang\s+[efg])\b/i.test(noTone)) {
    seatType = 'VIP';
  } else if (/\b(ghe\s+thuong|standard|tieu\s+chuan)\b/i.test(noTone)) {
    seatType = 'STANDARD';
  }

  // 6. Độ tuổi người xem (VD: "trẻ 6 tuổi", "bé 10 tuổi", "15 tuổi", "trẻ em")
  let viewerAge = null;
  let allowedAgeRatings = null;
  const ageMatch = noTone.match(
    /\b(?:tre|be|em\s+be|con|chau|hoc\s+sinh|khan\s+gia|nguoi)?\s*(\d{1,2})\s*tuoi\b/i
  );
  if (ageMatch) {
    const parsedAge = Number(ageMatch[1]);
    if (parsedAge >= 1 && parsedAge <= 99) {
      viewerAge = parsedAge;
    }
  } else if (/\b(tre\s+em|em\s+be|thieu\s+nhi|con\s+nho|be\s+nho|mau\s+giao|tieu\s+hoc)\b/i.test(noTone)) {
    viewerAge = 8; // Mặc định nhóm trẻ em dưới 13 tuổi
  }

  if (viewerAge !== null) {
    if (viewerAge < 13) {
      allowedAgeRatings = ['P'];
    } else if (viewerAge < 16) {
      allowedAgeRatings = ['P', 'T13'];
    } else if (viewerAge < 18) {
      allowedAgeRatings = ['P', 'T13', 'T16'];
    } else {
      allowedAgeRatings = ['P', 'T13', 'T16', 'T18'];
    }
  }

  // 7. Thể loại phim
  const genreMappings = [
    { key: 'Hành động', regex: /\b(hanh\s+dong|action|danh\s+nhau|vo\s+thuat|bom\s+tan)\b/i },
    { key: 'Kinh dị', regex: /\b(kinh\s+di|phim\s+ma|rung\s+ron|horror)\b/i },
    { key: 'Hoạt hình', regex: /\b(hoat\s+hinh|anime|cartoon)\b/i },
    { key: 'Tình cảm', regex: /\b(tinh\s+cam|lang\s+man|romance|ngon\s+tinh)\b/i },
    { key: 'Hài', regex: /\b(phim\s+hai|hai\s+huoc|vui\s+nhon|comedy)\b/i },
    { key: 'Viễn tưởng', regex: /\b(vien\s+tuong|khoa\s+hoc|sci[\-\s]?fi|vu\s+tru)\b/i },
    { key: 'Gia đình', regex: /\b(gia\s+dinh|family)\b/i },
    { key: 'Tâm lý', regex: /\b(tam\s+ly|chinh\s+kich|drama|giat\s+gan|thriller)\b/i },
  ];
  const matchedGenres = genreMappings.filter((g) => g.regex.test(noTone)).map((g) => g.key);

  // 8. Cụm rạp
  let cinemaLocation = null;
  if (/\b(thanh\s+khe|dien\s+bien\s+phu)\b/i.test(noTone)) {
    cinemaLocation = "D'AVENOR Thanh Khê Plaza";
  } else if (/\b(vincom|ngo\s+quyen|son\s+tra)\b/i.test(noTone)) {
    cinemaLocation = "D'AVENOR Vincom Ngô Quyền";
  } else if (/\b(hai\s+chau|bach\s+dang|indochina)\b/i.test(noTone)) {
    cinemaLocation = "D'AVENOR Hải Châu Center";
  } else if (Array.isArray(availableCinemas)) {
    for (const c of availableCinemas) {
      if (c.name && noTone.includes(removeVietnameseTones(c.name))) {
        cinemaLocation = c.name;
        break;
      }
    }
  }

  // 9. Khoảng giá
  let maxPrice = null;
  const underPriceMatch = noTone.match(/\b(?:duoi|toi\s+da|khong\s+qua)\s*(\d{2,3})\s*(?:k|nghin|ngan|\.000)/i);
  if (underPriceMatch) {
    maxPrice = Number(underPriceMatch[1]) * 1000;
  }

  return {
    movieTitle: matchedMovie ? matchedMovie.title : unmatchedMovieTitle,
    matchedMovie,
    unmatchedMovieTitle,
    dateFilter,
    timeFilter,
    format,
    ticketQuantity,
    requireContiguousSeats,
    seatType,
    viewerAge,
    allowedAgeRatings,
    genres: matchedGenres,
    cinemaLocation,
    maxPrice,
  };
};

/**
 * Nhận diện Intent chính từ câu hỏi và các Entities đã trích xuất
 */
export const classifyIntent = (message = '', entities = {}) => {
  const lower = String(message || '').toLowerCase().trim();
  const noTone = removeVietnameseTones(lower);

  // 1. Chào hỏi / Tán gẫu cơ bản (chỉ khi câu ngắn và không kèm truy vấn nghiệp vụ)
  const isGreetingOnly =
    /^(hi+|hello+|hey+|alo+|xin\s+chao|chao\s+(ban|bot|shop|rap|ad|admin|em|anh|chi)|good\s+(morning|afternoon|evening)|oi|ban\s+oi|bot\s+oi|co\s+ai\s+o\s+do\s+khong)[!.,?\s]*$/i.test(
      noTone
    );
  const isThanksOrBye =
    /^(cam\s+on|thank(s|\s+you)?|ok\s+cam\s+on|tam\s+biet|bye+|good\s*bye|hen\s+gap\s+lai)[!.,?\s]*$/i.test(
      noTone
    );
  const isIdentityQuestion =
    /\b(ban\s+la\s+ai|ten\s+ban\s+la\s+gi|ban\s+lam\s+duoc\s+gi|giup\s+gi\s+duoc|ban\s+co\s+the\s+lam\s+gi|ban\s+khoe\s+khong)\b/i.test(
      noTone
    );

  if (isGreetingOnly || isThanksOrBye || isIdentityQuestion) {
    return INTENTS.GENERAL_CHAT;
  }

  // 2. Hỗ trợ thanh toán (VNPay, MoMo, chuyển khoản, lỗi trừ tiền)
  if (
    /\b(thanh\s+toan|vnpay|momo|zalopay|chuyen\s+khoan|qr\s+code|the\s+ngan\s+hang|atm|visa|tru\s+tien|loi\s+thanh\s+toan)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.PAYMENT_SUPPORT;
  }

  // 3. Hướng dẫn đặt vé / xin link đặt vé / chính sách hoàn đổi vé
  if (
    /\b(link\s+dat\s+ve|duong\s+dan\s+dat\s+ve|cho\s+(toi\s+|minh\s+)?link|cach\s+dat\s+ve|huong\s+dan\s+dat\s+ve|lam\s+sao\s+(de\s+)?dat\s+ve|mua\s+ve\s+nhu\s+the\s+nao|hoan\s+ve|doi\s+ve|huy\s+ve|tra\s+ve)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.BOOKING_GUIDE;
  }

  // 4. Kiểm tra ghế trống / ghế liền nhau / sơ đồ ghế
  if (
    entities.requireContiguousSeats ||
    /\b(ghe\s+trong|con\s+ghe|con\s+cho|het\s+ghe|het\s+cho|bao\s+nhieu\s+ghe|may\s+ghe|so\s+do\s+ghe|vi\s+tri\s+ghe|chon\s+ghe|con\s+\d+\s+ghe)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.SEAT_AVAILABILITY;
  }

  // 5. Hỏi giá vé / tính tiền N vé
  const asksAboutPrice =
    /\b(gia\s+ve|ve\s+bao\s+nhieu|bao\s+nhieu\s+tien|may\s+tien|bang\s+gia|tinh\s+tien|het\s+bao\s+nhieu)\b/i.test(
      noTone
    ) ||
    (entities.ticketQuantity !== null && /\b(bao\s+nhieu|tien|gia)\b/i.test(noTone));

  if (
    asksAboutPrice &&
    !/\b(nhung\s+suat\s+chieu\s+nao|co\s+suat\s+nao|lich\s+chieu)\b/i.test(noTone)
  ) {
    return INTENTS.TICKET_PRICE;
  }

  // 6. Khuyến mãi / Voucher
  if (
    /\b(voucher|khuyen\s+mai|ma\s+giam\s+gia|uu\s+dai|giam\s+gia|code\s+giam|promotion|deal)\b/i.test(
      noTone
    ) &&
    !entities.matchedMovie &&
    !entities.format
  ) {
    return INTENTS.PROMOTION_VOUCHER;
  }

  // 7. Combo bắp nước (Chỉ kích hoạt khi hỏi cụ thể về bắp, nước, combo rạp)
  if (/\b(bap\s+rang|bap\s+nuoc|bong\s+ngo|combo|nuoc\s+ngot|pepsi|coca|snack\s+rap|mua\s+bap)\b/i.test(noTone)) {
    return INTENTS.CONCESSION_COMBO;
  }

  // 8. Địa chỉ rạp / Gửi xe / Vị trí cụm rạp
  if (
    /\b(dia\s+chi|o\s+dau|cho\s+nao|gui\s+xe|do\s+xe|bai\s+xe|duong\s+di|cum\s+rap|chi\s+nhanh)\b/i.test(
      noTone
    ) &&
    !entities.matchedMovie &&
    !/\b(suat\s+chieu|lich\s+chieu)\b/i.test(noTone)
  ) {
    return INTENTS.CINEMA_LOCATION;
  }

  // 9. Suất chiếu 3D chuyên biệt
  if (entities.format === '3D') {
    return INTENTS.SHOWTIME_3D;
  }

  // 10. Tư vấn / Gợi ý phim (theo độ tuổi, trẻ em, thể loại, tâm trạng, phim hay nhất)
  if (
    entities.viewerAge !== null ||
    entities.genres.length > 0 ||
    /\b(goi\s+y|tu\s+van|nen\s+xem\s+phim\s+gi|phim\s+nao\s+hay|top\s+phim|phim\s+hot|phim\s+dang\s+xem|phim\s+cho\s+tre|phim\s+gia\s+dinh)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.MOVIE_RECOMMENDATION;
  }

  // 11. Chi tiết phim (nội dung, thời lượng, đạo diễn, diễn viên, phân loại tuổi của 1 phim cụ thể)
  if (
    (entities.matchedMovie || entities.unmatchedMovieTitle) &&
    /\b(noi\s+dung|cot\s+truyen|ke\s+ve|thoi\s+luong|dai\s+bao\s+nhieu|may\s+phut|dao\s+dien|dien\s+vien|the\s+loai\s+gi|may\s+tuoi\s+xem\s+duoc|danh\s+gia|review|chi\s+tiet\s+phim)\b/i.test(
      noTone
    ) &&
    !/\b(suat|lich\s+chieu|may\s+gio\s+chieu|toi\s+nay|ngay\s+mai)\b/i.test(noTone)
  ) {
    return INTENTS.MOVIE_DETAIL;
  }

  // 12. Tìm kiếm suất chiếu / lịch chiếu
  if (
    entities.matchedMovie ||
    entities.unmatchedMovieTitle ||
    entities.format ||
    entities.timeFilter ||
    /\b(suat\s+chieu|lich\s+chieu|may\s+gio\s+chieu|chieu\s+luc\s+nao|co\s+suat\s+nao|con\s+suat|con\s+chieu)\b/i.test(
      noTone
    )
  ) {
    if (
      entities.dateFilter &&
      !entities.matchedMovie &&
      !entities.unmatchedMovieTitle &&
      !entities.format &&
      !entities.timeFilter &&
      /\b(co\s+phim\s+gi|chieu\s+phim\s+gi|nhung\s+phim\s+nao|phim\s+nao\s+dang\s+chieu)\b/i.test(
        noTone
      )
    ) {
      return INTENTS.MOVIE_SEARCH;
    }
    return INTENTS.SHOWTIME_SEARCH;
  }

  // 13. Tìm kiếm danh sách phim đang chiếu (VD: "Ngày mai có phim gì?", "Hôm nay có phim gì đang chiếu?")
  if (
    entities.dateFilter ||
    /\b(co\s+phim\s+gi|phim\s+gi\s+dang\s+chieu|danh\s+sach\s+phim|phim\s+dang\s+chieu|phim\s+moi|chieu\s+gi)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.MOVIE_SEARCH;
  }

  // 14. Nếu câu hỏi chỉ có hỏi giá chung chung
  if (asksAboutPrice) {
    return INTENTS.TICKET_PRICE;
  }

  return INTENTS.UNKNOWN;
};

/**
 * Kết hợp ngữ cảnh hội thoại nhiều lượt (Multi-turn Context Resolution).
 */
export const resolveMultiTurnContext = (
  currentMessage = '',
  currentIntent = INTENTS.UNKNOWN,
  currentEntities = {},
  safeHistory = [],
  availableMovies = [],
  nowDate = new Date()
) => {
  const resolved = {
    ...currentEntities,
    inheritedFromContext: false,
    contextShowtimeId: null,
    contextTime: null,
    contextRoom: null,
  };

  if (!Array.isArray(safeHistory) || safeHistory.length === 0) {
    return { intent: currentIntent, entities: resolved };
  }

  const noTone = removeVietnameseTones(currentMessage || '');

  // Duyệt ngược lịch sử từ gần nhất về trước để tìm ngữ cảnh phim, ngày, giờ, định dạng, showtimeId
  let histMovie = null;
  let histDateFilter = null;
  let histTimeFilter = null;
  let histFormat = null;
  let histShowtimeId = null;
  let histExactTime = null;
  let histRoom = null;

  for (let i = safeHistory.length - 1; i >= 0; i--) {
    const turn = safeHistory[i];
    if (!turn || !turn.text) continue;

    if (turn.sender === 'bot' && turn.movieCard) {
      if (!histShowtimeId && turn.movieCard.showtimeId) {
        histShowtimeId = String(turn.movieCard.showtimeId);
      }
      if (!histExactTime && turn.movieCard.time) {
        histExactTime = String(turn.movieCard.time);
      }
      if (!histRoom && turn.movieCard.room) {
        histRoom = String(turn.movieCard.room);
      }
      if (!histMovie && turn.movieCard.title) {
        histMovie = matchMovieFromText(turn.movieCard.title, availableMovies);
      }
    }

    if (turn.sender === 'bot' && !histShowtimeId) {
      const linkMatch = turn.text.match(/\/booking\/seat\/([a-fA-F0-9]{24})/);
      if (linkMatch) {
        histShowtimeId = linkMatch[1];
      }
    }

    if (!histMovie) {
      const m = matchMovieFromText(turn.text, availableMovies);
      if (m) histMovie = m;
    }

    if (turn.sender === 'user') {
      const turnNoTone = removeVietnameseTones(turn.text);
      if (!histDateFilter) {
        const df = parseVietnameseDateFromText(turn.text, nowDate);
        if (df) histDateFilter = df;
      }
      if (!histTimeFilter) {
        const tf = parseTimeFilterFromText(turn.text);
        if (tf) histTimeFilter = tf;
      }
      if (!histFormat) {
        if (/\b(3d|reald\s*3d)\b/i.test(turnNoTone)) histFormat = '3D';
        else if (/\bimax\b/i.test(turnNoTone)) histFormat = 'IMAX';
        else if (/\b2d\b/i.test(turnNoTone)) histFormat = '2D';
      }
    }
  }

  const isFollowUpIntent = [
    INTENTS.SHOWTIME_3D,
    INTENTS.SHOWTIME_SEARCH,
    INTENTS.TICKET_PRICE,
    INTENTS.SEAT_AVAILABILITY,
    INTENTS.BOOKING_GUIDE,
    INTENTS.MOVIE_DETAIL,
  ].includes(currentIntent);

  const hasAnaphoraReference =
    /\b(phim\s+do|phim\s+nay|suat\s+do|suat\s+nay|con\s+suat|the\s+con|vay\s+con|bao\s+nhieu\s+tien|cho\s+(toi\s+|minh\s+)?link|dat\s+ve\s+suat\s+do|may\s+ve)\b/i.test(
      noTone
    );

  const isAskingBroadMovieList =
    currentIntent === INTENTS.MOVIE_SEARCH &&
    /\b(co\s+phim\s+gi|nhung\s+phim\s+nao|danh\s+sach\s+phim)\b/i.test(noTone);

  if (
    !resolved.matchedMovie &&
    !resolved.unmatchedMovieTitle &&
    histMovie &&
    (isFollowUpIntent || hasAnaphoraReference) &&
    !isAskingBroadMovieList
  ) {
    resolved.matchedMovie = histMovie;
    resolved.movieTitle = histMovie.title;
    resolved.inheritedFromContext = true;
  }

  if (!resolved.dateFilter && histDateFilter && (isFollowUpIntent || hasAnaphoraReference)) {
    resolved.dateFilter = histDateFilter;
    resolved.inheritedFromContext = true;
  }

  if (
    !resolved.format &&
    histFormat &&
    [INTENTS.TICKET_PRICE, INTENTS.SEAT_AVAILABILITY, INTENTS.BOOKING_GUIDE].includes(currentIntent)
  ) {
    resolved.format = histFormat;
    resolved.inheritedFromContext = true;
  }

  if (
    !resolved.timeFilter &&
    histTimeFilter &&
    [INTENTS.TICKET_PRICE, INTENTS.SEAT_AVAILABILITY, INTENTS.BOOKING_GUIDE].includes(currentIntent)
  ) {
    resolved.timeFilter = histTimeFilter;
    resolved.inheritedFromContext = true;
  }

  if (histShowtimeId) {
    resolved.contextShowtimeId = histShowtimeId;
    resolved.contextTime = histExactTime;
    resolved.contextRoom = histRoom;
  }

  let finalIntent = currentIntent;
  if (finalIntent === INTENTS.UNKNOWN && resolved.matchedMovie) {
    if (resolved.format === '3D') finalIntent = INTENTS.SHOWTIME_3D;
    else if (resolved.ticketQuantity) finalIntent = INTENTS.TICKET_PRICE;
    else finalIntent = INTENTS.SHOWTIME_SEARCH;
  }

  return {
    intent: finalIntent,
    entities: resolved,
  };
};
