import { parseVietnameseDateFromText, parseTimeFilterFromText, getVNDateParts } from './timezoneUtils.js';

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
  BOOKING_LOOKUP: 'BOOKING_LOOKUP',
  PAYMENT_SUPPORT: 'PAYMENT_SUPPORT',
  CUSTOMER_SUPPORT: 'CUSTOMER_SUPPORT',
  GENERAL_CHAT: 'GENERAL_CHAT',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
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
 * Chuẩn hóa từ viết tắt & tiếng lóng GenZ Việt Nam (trên chuỗi không dấu)
 * giúp chatbot hiểu tự nhiên các câu như: "helo", "hnay co phim j hay ko", "phim kd tnay may h", "ve bn tien", "tks ad"...
 */
const GENZ_REPLACEMENTS = [
  // Thể loại phim viết tắt
  [/\bphim\s+kd\b/gi, 'phim kinh di'],
  [/\bphim\s+hd\b/gi, 'phim hanh dong'],
  [/\bphim\s+hh\b/gi, 'phim hoat hinh'],
  [/\bphim\s+tc\b/gi, 'phim tinh cam'],
  [/\bphim\s+gd\b/gi, 'phim gia dinh'],
  [/\bphim\s+vt\b/gi, 'phim vien tuong'],
  [/\bphim\s+tl\b/gi, 'phim tam ly'],
  // Thời gian viết tắt
  [/\b(hnay|h\.nay|homnay)\b/gi, 'hom nay'],
  [/\b(tnay|t\.nay|toinay)\b/gi, 'toi nay'],
  [/\b(ngmai|nmai|ng\.mai)\b/gi, 'ngay mai'],
  [/\b(tmai|toimai)\b/gi, 'toi mai'],
  [/\b(mấy|may)\s*(h|g)\b/gi, 'may gio'],
  [/\b(\d{1,2})\s*h(\d{2})\b/gi, '$1:$2'],
  [/\bbh\b/gi, 'bay gio'],
  [/\bt2\b/gi, 'thu 2'],
  [/\bt3\b/gi, 'thu 3'],
  [/\bt4\b/gi, 'thu 4'],
  [/\bt5\b/gi, 'thu 5'],
  [/\bt6\b/gi, 'thu 6'],
  [/\bt7\b/gi, 'thu 7'],
  [/\bcn\b/gi, 'chu nhat'],
  // Từ để hỏi, trạng thái & phủ định GenZ
  [/\b(dag|dg)\b/gi, 'dang'],
  [/\b(chx|chua)\b/gi, 'chua'],
  [/\b(ko|k|kh|khg|khum|hok|hong|hk)\b/gi, 'khong'],
  [/\b(dc|dk)\b/gi, 'duoc'],
  [/\b(bn|bnh|bnhiu|nhiu)\b/gi, 'bao nhieu'],
  [/\b(ntn|tn)\b/gi, 'nhu the nao'],
  [/\bj\b/gi, 'gi'],
  [/\b(sao\s+z|gi\s+z|dau\s+z)\b/gi, (m) => m.replace(/\bz\b/i, 'vay')],
  [/\bkm\b/gi, 'khuyen mai'],
  [/\bud\b/gi, 'uu dai'],
  [/\bvc\b/gi, 'voucher'],
  [/\bsdt\b/gi, 'so dien thoai'],
  [/\bsl\b/gi, 'so luong'],
  [/\b(mk|mik)\b/gi, 'minh'],
  [/\b(mng|mn)\b/gi, 'moi nguoi'],
  [/\bng\b/gi, 'nguoi'],
  [/\bvs\b/gi, 'voi'],
  [/\bcx\b/gi, 'cung'],
  [/\blun\b/gi, 'luon'],
  [/\b(rui|roi)\b/gi, 'roi'],
  [/\b(tks|tk|ty|thx)\b/gi, 'cam on'],
  [/\b(pp|bai|baibai)\b/gi, 'tam biet'],
  [/\b(helo+|hlo+|he\s+lo)\b/gi, 'hello'],
];

export const normalizeGenZVietnamese = (str = '') => {
  let normalized = removeVietnameseTones(str);
  for (const [pattern, replacement] of GENZ_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, ' ').trim();
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
                movieId: String(item.movieCard.movieId || '').slice(0, 40),
                title: String(item.movieCard.title || '').slice(0, 120),
                showtimeId: String(item.movieCard.showtimeId || '').slice(0, 40),
                time: String(item.movieCard.time || '').slice(0, 20),
                room: String(item.movieCard.room || '').slice(0, 80),
              }
            : null,
        movieCards: Array.isArray(item.movieCards)
          ? item.movieCards.slice(0, 6).map((mc) => ({
              movieId: String(mc?.movieId || '').slice(0, 40),
              title: String(mc?.title || '').slice(0, 120),
              showtimeId: String(mc?.showtimeId || '').slice(0, 40),
            }))
          : [],
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
 * Tính khoảng cách Levenshtein (tối ưu cho chuỗi ngắn) để chịu lỗi chính tả nhẹ khi tìm tên phim
 */
const levenshteinDistance = (a = '', b = '') => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, idx) => idx);
  for (let i = 1; i <= a.length; i++) {
    let curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
};

const normalizeAlphaNum = (str = '') =>
  removeVietnameseTones(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Tìm bộ phim khớp chính xác hoặc gần đúng (không dấu, chịu lỗi chính tả nhẹ) trong danh sách phim từ Database,
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

  // Vòng 1: Khớp chính xác (không dấu, ranh giới từ — gồm tên đầy đủ, phân đoạn tách theo : - – & và từ khóa đặc trưng)
  for (const movie of sortedMovies) {
    const fullTitle = String(movie.title || '').trim();
    if (!fullTitle) continue;

    const titleNoTone = removeVietnameseTones(fullTitle);
    const titleSegments = titleNoTone
      .split(/[:\-–—,&|]|\b(?:va|and|vs|x)\b/i)
      .map((s) => s.trim())
      .filter((s) => {
        if (s.length < 4) return false;
        const segWords = normalizeAlphaNum(s).split(' ').filter(Boolean);
        return segWords.length > 0 && !segWords.every((w) => NON_MOVIE_STOP_TOKENS.has(w));
      });

    const isShortAmbiguousTitle =
      titleNoTone.split(/\s+/).length === 1 && titleNoTone.length <= 4;

    if (isShortAmbiguousTitle) {
      const explicitMovieMention = new RegExp(
        `(?:\\bphim\\s+|["'“])${escapeRegex(titleNoTone)}\\b`,
        'i'
      ).test(rawNoTone);

      const wordBoundaryInScrubbed = new RegExp(`\\b${escapeRegex(titleNoTone)}\\b`, 'i').test(
        scrubbedNoTone
      );

      if (explicitMovieMention || wordBoundaryInScrubbed) {
        return movie;
      }
      continue;
    }

    const fullTitleNoToneRegex = new RegExp(`\\b${escapeRegex(titleNoTone)}\\b`, 'i');
    if (fullTitleNoToneRegex.test(rawNoTone)) {
      return movie;
    }

    for (const seg of titleSegments) {
      const segRegex = new RegExp(`\\b${escapeRegex(seg)}\\b`, 'i');
      if (segRegex.test(rawNoTone)) {
        return movie;
      }
    }
  }

  // Vòng 2: Khớp gần đúng (chịu lỗi chính tả nhẹ / thiếu chữ trên chuỗi không dấu, gồm cả phân đoạn tên phim)
  const cleanQuery = normalizeAlphaNum(scrubbedNoTone);
  const queryWords = cleanQuery.split(' ').filter(Boolean);
  if (queryWords.length === 0) return null;

  let bestFuzzyMovie = null;
  let bestFuzzyScore = 0;

  for (const movie of sortedMovies) {
    const fullTitle = String(movie.title || '').trim();
    if (!fullTitle) continue;

    const titleClean = normalizeAlphaNum(fullTitle);
    const segmentCleans = removeVietnameseTones(fullTitle)
      .split(/[:\-–—,&|]|\b(?:va|and|vs|x)\b/i)
      .map((s) => normalizeAlphaNum(s))
      .filter((s) => {
        if (s.length < 4) return false;
        const words = s.split(' ').filter(Boolean);
        return words.length > 0 && !words.every((w) => NON_MOVIE_STOP_TOKENS.has(w));
      });

    const candidatesToCompare = [...new Set([titleClean, ...segmentCleans])];

    for (const target of candidatesToCompare) {
      const targetWords = target.split(' ').filter(Boolean);
      // Không dùng fuzzy cho tên phim quá ngắn (1 từ <= 4 ký tự như "Mai") để tránh nhận nhầm
      if (targetWords.length === 1 && target.length <= 4) continue;

      const winLen = targetWords.length;
      if (queryWords.length < winLen) continue;

      for (let i = 0; i <= queryWords.length - winLen; i++) {
        const windowStr = queryWords.slice(i, i + winLen).join(' ');
        if (windowStr.length < 4) continue;
        // Bỏ qua cửa sổ chỉ gồm stop-word thông dụng
        if (windowStr.split(' ').every((w) => NON_MOVIE_STOP_TOKENS.has(w))) continue;

        const maxLen = Math.max(windowStr.length, target.length);
        const dist = levenshteinDistance(windowStr, target);
        const maxAllowedDist = target.length <= 6 ? 1 : 2;

        if (dist <= maxAllowedDist) {
          const similarity = 1 - dist / maxLen;
          if (similarity >= 0.78 && similarity > bestFuzzyScore) {
            bestFuzzyScore = similarity;
            bestFuzzyMovie = movie;
          }
        }
      }
    }
  }

  return bestFuzzyMovie;
};

/**
 * Tập từ đơn (không dấu) chỉ trạng thái, thời gian, thể loại, định dạng hoặc từ để hỏi
 * TUYỆT ĐỐI KHÔNG BAO GIỜ được nhận diện là tên một bộ phim cụ thể.
 */
export const NON_MOVIE_STOP_TOKENS = new Set([
  'dang',
  'sap',
  'chieu',
  'hien',
  'tai',
  'nay',
  'mai',
  'kia',
  'hom',
  'ngay',
  'toi',
  'sang',
  'trua',
  'dem',
  'khuya',
  'cuoi',
  'tuan',
  'thang',
  'bo',
  'cac',
  'nhung',
  'mot',
  'vai',
  'tat',
  'ca',
  'nao',
  'gi',
  'sao',
  'hay',
  'hot',
  'moi',
  'nhat',
  'noi',
  'bat',
  'bom',
  'tan',
  'top',
  'rap',
  '2d',
  '3d',
  'imax',
  'laser',
  'gold',
  'class',
  'dolby',
  'atmos',
  'kinh',
  'di',
  'ma',
  'hanh',
  'dong',
  'tinh',
  'cam',
  'lang',
  'man',
  'hoat',
  'hinh',
  'anime',
  'hai',
  'huoc',
  'gia',
  'dinh',
  'tam',
  'ly',
  'chinh',
  'kich',
  'giat',
  'gan',
  'vien',
  'tuong',
  'khoa',
  'hoc',
  'tre',
  'em',
  'thieu',
  'nhi',
  'viet',
  'nam',
  'my',
  'han',
  'quoc',
  'au',
  'nhat',
  'ban',
  'co',
  'con',
  'xem',
  'duoc',
  'khong',
  'ko',
  'k',
  'de',
  'cho',
  'nguoi',
  'lon',
  'do',
  'ay',
  'thu',
  'dau',
  'tien',
  'so',
  'suat',
  'lich',
  've',
  'ghe',
  'phong',
  'cua',
  'o',
  'tai',
  'va',
  'voi',
  'cung',
  'nua',
  'vay',
  'nhi',
  'a',
  'nhe',
  'nha',
  'may',
  'gio',
  'bao',
  'nhieu',
  'tien',
  'gia',
  'kd',
  'hd',
  'hh',
  'tc',
  'gd',
  'vt',
  'tl',
]);

/**
 * Phát hiện tên phim mà người dùng hỏi đích danh nhưng KHÔNG tồn tại trong danh sách phim hiện tại.
 * Đã khắc phục triệt để lỗi nhận nhầm các từ trạng thái/thể loại/thời gian (như "đang", "sắp", "kinh dị", "hiện tại").
 */
export const extractUnmatchedMovieQuery = (text = '', matchedMovie = null) => {
  if (matchedMovie) return null;
  const clean = String(text || '').trim();
  const noTone = normalizeGenZVietnamese(clean);

  // Bỏ qua hoàn toàn nếu câu hỏi rõ ràng là hỏi danh sách phim theo trạng thái / thể loại / thời gian
  if (
    /\b(cac\s+bo\s+phim|nhung\s+bo\s+phim|danh\s+sach\s+phim|phim\s+dang\s+chieu|phim\s+sap\s+chieu|phim\s+gi|phim\s+nao|co\s+phim\s+(?:gi|nao|hay|moi|hot|kinh\s+di|hanh\s+dong|tinh\s+cam|hoat\s+hinh|hai|gia\s+dinh|tam\s+ly|vien\s+tuong|tre\s+em|3d|2d|imax))\b/i.test(
      noTone
    )
  ) {
    return null;
  }

  // Bỏ qua nếu hỏi theo số thứ tự ("phim thứ 2", "phim đầu tiên", "phim số 1")
  if (/\bphim\s+(?:thu\s+\d+|so\s+\d+|dau\s+tien|cuoi\s+cung|cuoi)\b/i.test(noTone)) {
    return null;
  }

  // Mẫu: "phim <Tên riêng>" (ưu tiên trong ngoặc kép hoặc cụm tên riêng thực sự)
  const quotedMatch = clean.match(/phim\s*["'“]([^"'”]{2,40})["'”]/i);
  const rawMatch =
    quotedMatch ||
    clean.match(
      /(?:^|\s)phim\s+([A-Za-zÀ-ỹ0-9][A-Za-zÀ-ỹ0-9\s:\-']{1,35}?)(?:\s+(?:có|còn|đang|sắp|chiếu|lúc|tối|hôm|ngày|suất|giá|ở|không|nào|mấy|bao\s+nhiêu|hay|là|nói|kể|về)|[?!.,]|$)/i
    );

  if (!rawMatch) return null;

  const candidate = rawMatch[1].trim();
  const candidateClean = normalizeAlphaNum(normalizeGenZVietnamese(candidate));
  if (!candidateClean || candidateClean.length < 2 || /^\d+$/.test(candidateClean)) {
    return null;
  }

  const tokens = candidateClean.split(' ').filter(Boolean);
  // Nếu tất cả các từ đều là từ chỉ trạng thái / thể loại / thời gian / từ để hỏi -> KHÔNG PHẢI tên phim
  if (tokens.length === 0 || tokens.every((t) => NON_MOVIE_STOP_TOKENS.has(t))) {
    return null;
  }

  // Nếu từ đầu tiên là trạng thái chiếu ("dang ...", "sap ...", "thu ...") -> KHÔNG PHẢI tên phim
  if (['dang', 'sap', 'thu', 'so', 'nao', 'gi', 'co', 'con'].includes(tokens[0])) {
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
  const noTone = normalizeGenZVietnamese(lower);

  // 1. Tên phim khớp trong DB & Tên phim hỏi nhưng không có trong DB
  const matchedMovie =
    matchMovieFromText(message, availableMovies) || matchMovieFromText(noTone, availableMovies);
  const unmatchedMovieTitle = extractUnmatchedMovieQuery(message, matchedMovie);

  // 2. Ngày chiếu & Khung giờ chiếu (hỗ trợ cả tiếng Việt chuẩn lẫn viết tắt GenZ như hnay, tnay, ngmai)
  const dateFilter =
    parseVietnameseDateFromText(message, nowDate) || parseVietnameseDateFromText(noTone, nowDate);
  const timeFilter = parseTimeFilterFromText(message) || parseTimeFilterFromText(noTone);

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

  // 10. Trạng thái phim (Đang chiếu vs Sắp chiếu)
  let movieStatusFilter = null;
  if (/\b(sap\s+chieu|coming\s+soon|chuan\s+bi\s+chieu|sap\s+ra\s+mat)\b/i.test(noTone)) {
    movieStatusFilter = 'COMING_SOON';
  } else if (/\b(dang\s+chieu|now\s+showing|hien\s+tai)\b/i.test(noTone)) {
    movieStatusFilter = 'NOW_SHOWING';
  }

  // 11. Tham chiếu phim theo số thứ tự ("phim đầu tiên", "phim thứ 2", "phim số 3")
  let ordinalMovieIndex = null;
  if (/\bphim\s+(?:dau\s+tien|thu\s+nhat|thu\s+1|so\s+1)\b/i.test(noTone)) {
    ordinalMovieIndex = 0;
  } else if (/\bphim\s+(?:cuoi\s+cung|cuoi)\b/i.test(noTone)) {
    ordinalMovieIndex = -1;
  } else {
    const ordMatch = noTone.match(/\bphim\s+(?:thu|so)\s+(\d{1,2})\b/i);
    if (ordMatch) {
      const idx = Number(ordMatch[1]) - 1;
      if (idx >= 0 && idx < 10) ordinalMovieIndex = idx;
    }
  }

  // 2b. Lọc theo tháng (VD: "tháng 12 có phim j", "tháng sau", "tháng 1/2027")
  let monthFilter = null;
  const nowPartsForMonth = getVNDateParts(nowDate);
  if (nowPartsForMonth) {
    const explicitMonthMatch = noTone.match(/\bthang\s+(1[0-2]|0?[1-9])(?:\s*[\/\-]\s*(20\d{2}))?\b/i);
    if (explicitMonthMatch) {
      const targetMonth = Number(explicitMonthMatch[1]);
      let targetYear = explicitMonthMatch[2] ? Number(explicitMonthMatch[2]) : nowPartsForMonth.year;
      if (!explicitMonthMatch[2] && targetMonth < nowPartsForMonth.month) {
        targetYear += 1;
      }
      const isFutureMonth =
        targetYear > nowPartsForMonth.year ||
        (targetYear === nowPartsForMonth.year && targetMonth > nowPartsForMonth.month);
      monthFilter = {
        month: targetMonth,
        year: targetYear,
        monthKey: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
        label: `Tháng ${targetMonth}/${targetYear}`,
        isFutureMonth,
      };
    } else if (/\bthang\s+(sau|toi)\b/i.test(noTone)) {
      const nextMonth = nowPartsForMonth.month === 12 ? 1 : nowPartsForMonth.month + 1;
      const nextYear = nowPartsForMonth.month === 12 ? nowPartsForMonth.year + 1 : nowPartsForMonth.year;
      monthFilter = {
        month: nextMonth,
        year: nextYear,
        monthKey: `${nextYear}-${String(nextMonth).padStart(2, '0')}`,
        label: `Tháng ${nextMonth}/${nextYear}`,
        isFutureMonth: true,
      };
    }
  }

  // 12. Mã đặt vé nếu khách cung cấp (VD: MTX-123456, DAV-982134-VN, BK-123456)
  const bookingCodeMatch = String(message || '').match(/\b((?:MTX|DAV|BK|VE)[-_]?[A-Z0-9]{4,14}(?:[-_][A-Z0-9]{2,6})?)\b/i);
  const bookingCode = bookingCodeMatch ? bookingCodeMatch[1].toUpperCase() : null;

  return {
    movieTitle: matchedMovie ? matchedMovie.title : unmatchedMovieTitle,
    matchedMovie,
    unmatchedMovieTitle,
    movieStatusFilter,
    ordinalMovieIndex,
    bookingCode,
    monthFilter,
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
  const noTone = normalizeGenZVietnamese(lower);

  // 1. Chào hỏi / Tán gẫu cơ bản (hỗ trợ cả viết tắt GenZ: helo, hlo, hi, 2, yo, tks, pp, okela...)
  const isGreetingOnly =
    /^(hi+|hello+|helo+|hlo+|hey+|yo+|alo+|2|xin\s+chao|chao(\s+(ban|bot|shop|rap|ad|admin|em|anh|chi|moi\s+nguoi|b|e|a|c|nha|ne))?|good\s+(morning|afternoon|evening)|oi|e|ey|ban\s+oi|bot\s+oi|ad\s+oi|shop\s+oi|co\s+ai\s+o\s+do\s+khong)[!.,?\s]*$/i.test(
      noTone
    );
  const isThanksOrBye =
    /^(cam\s+on(\s+(ban|bot|ad|admin|shop|nhieu|nha|ne|nhieu\s+nha|nhieu\s+ne)){0,3}|thank(s|\s+you)?(\s+(ad|ban|nha|ne)){0,2}|ok(e|i|ie|ela)?(\s+(cam\s+on|nha|ne|ad|ban)){0,3}|tam\s+biet(\s+(ban|ad|nha|ne)){0,2}|bye+(\s+(nha|ne))?|good\s*bye|hen\s+gap\s+lai)[!.,?\s]*$/i.test(
      noTone
    );
  const isIdentityQuestion =
    /\b(ban\s+la\s+ai|ten\s+ban\s+la\s+gi|ban\s+lam\s+duoc\s+gi|giup\s+gi\s+duoc|ban\s+co\s+the\s+lam\s+gi|ban\s+khoe\s+khong)\b/i.test(
      noTone
    );

  if (isGreetingOnly || isThanksOrBye || isIdentityQuestion) {
    return INTENTS.GENERAL_CHAT;
  }

  // 1b. Câu hỏi rõ ràng ngoài phạm vi rạp chiếu phim (ưu tiên bắt trước khi dateFilter/timeFilter kéo nhầm sang MOVIE_SEARCH)
  const hasCinemaSignal =
    Boolean(entities.matchedMovie) ||
    Boolean(entities.format) ||
    Boolean(entities.seatType) ||
    /\b(phim|rap|suat|ve|ghe|chieu|bap|nuoc|combo|voucher|khuyen\s+mai|uu\s+dai|d'avenor|davenor|thanh\s+khe|imax|dolby|3d|2d)\b/i.test(
      noTone
    );
  const isClearlyOffTopic =
    !hasCinemaSignal &&
    /\b(thoi\s+tiet|du\s+bao|nhiet\s+do|troi\s+mua|bong\s+da|ti\s+so|world\s+cup|chung\s+khoan|bitcoin|crypto|gia\s+vang|nau\s+an|cong\s+thuc\s+nau|lam\s+mon|viet\s+code|lap\s+trinh|python|javascript|java|c\+\+|giai\s+toan|phuong\s+trinh|tinh\s+toan|dich\s+tieng\s+anh|bai\s+tap|chinh\s+tri|bau\s+cu|thu\s+do\s+cua|ai\s+la\s+tong\s+thong|tu\s+vi|boi\s+toan|xo\s+so)\b/i.test(
      noTone
    );

  if (isClearlyOffTopic) {
    return INTENTS.OUT_OF_SCOPE;
  }

  // 1c. Tra cứu đơn đặt vé cá nhân (yêu cầu xác thực JWT ở backend)
  const asksPersonalBooking =
    Boolean(entities.bookingCode) ||
    /\b(ve\s+cua\s+(toi|minh|em|anh|chi)|ve\s+(toi|minh|em|anh|chi)\s+(da\s+|vua\s+|moi\s+)?dat|ve\s+(da|vua|moi)\s+dat|don\s+(dat\s+)?ve\s+(cua\s+)?(toi|minh|em|anh|chi)?|don\s+(toi|minh|em)\s+(da\s+|vua\s+)?dat|lich\s+su\s+dat\s+ve|kiem\s+tra\s+(don\s+)?(dat\s+)?ve|check\s+ve|ktra\s+(don\s+)?ve|ma\s+(dat\s+)?ve\s+cua\s+(toi|minh|em)|da\s+dat\s+ve\s+thanh\s+cong|dat\s+ve\s+thanh\s+cong\s+chua|toi\s+da\s+thanh\s+toan\s+chua|minh\s+da\s+thanh\s+toan\s+chua|xem\s+lai\s+ve|tat\s+ca\s+ve\s+cua\s+(toi|minh|em))\b/i.test(
      noTone
    );

  if (asksPersonalBooking) {
    return INTENTS.BOOKING_LOOKUP;
  }

  // 2. Hỗ trợ thanh toán (VNPay, MoMo, chuyển khoản, lỗi trừ tiền)
  if (
    /\b(thanh\s+toan|vnpay|momo|zalopay|chuyen\s+khoan|qr\s+code|the\s+ngan\s+hang|atm|visa|tru\s+tien|loi\s+thanh\s+toan)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.PAYMENT_SUPPORT;
  }

  // 2b. Hỗ trợ khách hàng, liên hệ nhân viên, khiếu nại, mất mã vé, tài khoản, quy định đồ ăn ngoài
  if (
    /\b(nhan\s+vien\s+ho\s+tro|gap\s+nhan\s+vien|lien\s+he\s+(nhan\s+vien|ho\s+tro|cskh|tong\s+dai)|khieu\s+nai|phan\s+hoi|gop\s+y|mat\s+ma\s+ve|quen\s+ma\s+ve|doi\s+mat\s+khau|quen\s+mat\s+khau|dang\s+ky\s+tai\s+khoan|tao\s+tai\s+khoan|mang\s+do\s+an|do\s+an\s+(tu\s+)?ben\s+ngoai|thuc\s+an\s+ben\s+ngoai)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.CUSTOMER_SUPPORT;
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

  // 11. Chi tiết phim (nội dung, thời lượng, đạo diễn, diễn viên, phân loại tuổi của 1 phim cụ thể hoặc theo thứ tự)
  if (
    (entities.matchedMovie || entities.unmatchedMovieTitle || entities.ordinalMovieIndex !== null) &&
    /\b(noi\s+dung|cot\s+truyen|ke\s+ve|thoi\s+luong|dai\s+bao\s+nhieu|may\s+phut|dao\s+dien|dien\s+vien|the\s+loai\s+gi|may\s+tuoi\s+xem\s+duoc|danh\s+gia|review|chi\s+tiet|sao|the\s+nao)\b/i.test(
      noTone
    ) &&
    !/\b(suat|lich\s+chieu|may\s+gio\s+chieu|toi\s+nay|ngay\s+mai)\b/i.test(noTone)
  ) {
    return INTENTS.MOVIE_DETAIL;
  }

  // 12. Nếu hỏi rõ "các bộ phim đang chiếu / sắp chiếu" hoặc hỏi phim theo tháng ("tháng 12 có phim gì")
  if (
    (entities.movieStatusFilter || entities.monthFilter) &&
    !entities.matchedMovie &&
    !entities.unmatchedMovieTitle &&
    !entities.format &&
    !entities.timeFilter
  ) {
    return INTENTS.MOVIE_SEARCH;
  }

  // 13. Tìm kiếm suất chiếu / lịch chiếu
  if (
    entities.matchedMovie ||
    entities.unmatchedMovieTitle ||
    entities.format ||
    entities.timeFilter ||
    /\b(suat\s+chieu|lich\s+chieu|may\s+gio\s+chieu|chieu\s+luc\s+nao|co\s+suat\s+nao|con\s+suat|con\s+chieu|may\s+gio)\b/i.test(
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

  // 14. Tìm kiếm danh sách phim đang chiếu (VD: "Ngày mai có phim gì?", "Hôm nay có phim gì đang chiếu?")
  if (
    entities.dateFilter ||
    /\b(co\s+phim\s+gi|phim\s+gi\s+dang\s+chieu|danh\s+sach\s+phim|phim\s+dang\s+chieu|phim\s+sap\s+chieu|phim\s+moi|chieu\s+gi|cac\s+bo\s+phim)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.MOVIE_SEARCH;
  }

  // 15. Nếu câu hỏi chỉ có hỏi giá chung chung
  if (asksAboutPrice) {
    return INTENTS.TICKET_PRICE;
  }

  return INTENTS.UNKNOWN;
};

/**
 * Kết hợp ngữ cảnh hội thoại nhiều lượt (Multi-turn Context Resolution).
 * Hỗ trợ đồng thời `sessionContext` có cấu trúc (activeMovieId, activeCinema, activeDateKey, activeTimeFilter, lastMovieIds)
 * và suy luận từ `safeHistory` (tương thích ngược 100% khi client chưa gửi sessionContext).
 */
export const resolveMultiTurnContext = (
  currentMessage = '',
  currentIntent = INTENTS.UNKNOWN,
  currentEntities = {},
  safeHistory = [],
  availableMovies = [],
  nowDate = new Date(),
  sessionContext = null
) => {
  const resolved = {
    ...currentEntities,
    inheritedFromContext: false,
    contextShowtimeId: null,
    contextTime: null,
    contextRoom: null,
  };

  if (currentIntent === INTENTS.OUT_OF_SCOPE || currentIntent === INTENTS.GENERAL_CHAT) {
    return { intent: currentIntent, entities: resolved };
  }

  const noTone = removeVietnameseTones(currentMessage || '');
  const hasHistory = Array.isArray(safeHistory) && safeHistory.length > 0;
  const hasSession = sessionContext && typeof sessionContext === 'object';

  if (!hasHistory && !hasSession) {
    return { intent: currentIntent, entities: resolved };
  }

  // 1. Giải quyết tham chiếu phim theo số thứ tự ("phim thứ 2 nội dung sao?")
  if (!resolved.matchedMovie && resolved.ordinalMovieIndex !== null) {
    let candidateMovieIds = Array.isArray(sessionContext?.lastMovieIds)
      ? sessionContext.lastMovieIds.map(String)
      : [];

    if (candidateMovieIds.length === 0 && hasHistory) {
      for (let i = safeHistory.length - 1; i >= 0; i--) {
        const turn = safeHistory[i];
        if (turn?.sender === 'bot' && Array.isArray(turn.movieCards) && turn.movieCards.length > 0) {
          candidateMovieIds = turn.movieCards.map((mc) => String(mc.movieId || '')).filter(Boolean);
          break;
        }
      }
    }

    if (candidateMovieIds.length > 0) {
      const targetIdx =
        resolved.ordinalMovieIndex === -1
          ? candidateMovieIds.length - 1
          : resolved.ordinalMovieIndex;
      const targetId = candidateMovieIds[targetIdx];
      const foundMovie = availableMovies.find((m) => String(m._id) === String(targetId));
      if (foundMovie) {
        resolved.matchedMovie = foundMovie;
        resolved.movieTitle = foundMovie.title;
        resolved.inheritedFromContext = true;
      }
    }
  }

  // 2. Lấy ngữ cảnh từ sessionContext (ưu tiên cao nhất) rồi bổ sung bằng duyệt ngược safeHistory
  let histMovie = null;
  let histDateFilter = null;
  let histTimeFilter = null;
  let histFormat = null;
  let histShowtimeId = null;
  let histExactTime = null;
  let histRoom = null;
  let histCinemaLocation = null;

  if (hasSession) {
    if (sessionContext.activeMovieId) {
      histMovie =
        availableMovies.find((m) => String(m._id) === String(sessionContext.activeMovieId)) || null;
    }
    if (sessionContext.activeDateFilter && sessionContext.activeDateFilter.dateKey) {
      histDateFilter = sessionContext.activeDateFilter;
    }
    if (sessionContext.activeTimeFilter && typeof sessionContext.activeTimeFilter === 'object') {
      histTimeFilter = sessionContext.activeTimeFilter;
    }
    if (sessionContext.activeFormat) {
      histFormat = String(sessionContext.activeFormat);
    }
    if (sessionContext.activeShowtimeId) {
      histShowtimeId = String(sessionContext.activeShowtimeId);
    }
    if (sessionContext.activeCinema) {
      histCinemaLocation = String(sessionContext.activeCinema);
    }
  }

  if (hasHistory) {
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
        if (!histMovie && turn.movieCard.movieId) {
          histMovie =
            availableMovies.find((m) => String(m._id) === String(turn.movieCard.movieId)) || null;
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
    /\b(phim\s+do|phim\s+nay|suat\s+do|suat\s+nay|con\s+suat|the\s+con|vay\s+con|bao\s+nhieu\s+tien|gia\s+ve|may\s+gio|noi\s+dung|cho\s+(toi\s+|minh\s+)?link|dat\s+ve\s+suat\s+do|may\s+ve)\b/i.test(
      noTone
    );

  const isAskingBroadMovieList =
    currentIntent === INTENTS.MOVIE_SEARCH &&
    /\b(co\s+phim\s+gi|nhung\s+phim\s+nao|danh\s+sach\s+phim|phim\s+dang\s+chieu|phim\s+sap\s+chieu|cac\s+bo\s+phim)\b/i.test(
      noTone
    );

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

  if (
    !resolved.dateFilter &&
    histDateFilter &&
    (isFollowUpIntent || hasAnaphoraReference) &&
    !isAskingBroadMovieList
  ) {
    resolved.dateFilter = histDateFilter;
    resolved.inheritedFromContext = true;
  }

  if (
    !resolved.cinemaLocation &&
    histCinemaLocation &&
    (isFollowUpIntent || hasAnaphoraReference)
  ) {
    resolved.cinemaLocation = histCinemaLocation;
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
    else if (/\b(noi\s+dung|cot\s+truyen|dien\s+vien|dao\s+dien|thoi\s+luong)\b/i.test(noTone)) {
      finalIntent = INTENTS.MOVIE_DETAIL;
    } else finalIntent = INTENTS.SHOWTIME_SEARCH;
  }

  return {
    intent: finalIntent,
    entities: resolved,
  };
};
