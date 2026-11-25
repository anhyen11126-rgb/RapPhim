import { parseVietnameseDateFromText, parseTimeFilterFromText, getVNDateParts } from './timezoneUtils.js';

export const INTENTS = {
  MOVIE_SEARCH: 'MOVIE_SEARCH',
  MOVIE_DETAIL: 'MOVIE_DETAIL',
  MOVIE_RECOMMENDATION: 'MOVIE_RECOMMENDATION',
  SHOWTIME_SEARCH: 'SHOWTIME_SEARCH',
  SHOWTIME_3D: 'SHOWTIME_3D',
  ROOM_INFO: 'ROOM_INFO',
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
 * Nhận diện ngôn ngữ tin nhắn của khách hàng ('en' hoặc 'vi').
 * Nếu khách hỏi bằng tiếng Anh -> trả lời hoàn toàn bằng tiếng Anh.
 */
export const detectMessageLanguage = (message = '', fallbackLang = 'vi') => {
  const raw = String(message || '').trim();
  if (!raw) return fallbackLang || 'vi';

  // Có dấu tiếng Việt -> chắc chắn là tiếng Việt
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(raw)) {
    return 'vi';
  }

  const lower = raw.toLowerCase();
  const hasStrongVietnamese =
    /\b(phim|suat|chieu|ghe|bap|nuoc|rap|hom\s+nay|toi\s+nay|ngay\s+mai|bao\s+nhieu|khong|duoc|cua\s+toi|xin\s+chao|cam\s+on|tam\s+biet|uu\s+dai|khuyen\s+mai|sinh\s+vien|hnay|tnay|ngmai|khum|nha|nhe|dat\s+ve|kiem\s+tra|cho\s+toi|cho\s+minh|nhan\s+vien|dien\s+thoai|mo\s+cua|dong\s+cua|nam\s+o\s+dau|o\s+dau|khac\s+nhau|co\s+gi)\b/i.test(
      lower
    );
  if (hasStrongVietnamese) {
    return 'vi';
  }

  const hasEnglishSignal =
    /\b(what|which|where|when|how|who|why|are|is|can|could|would|should|do|does|did|show|give|tell|find|check|list|recommend|suggest|want|need|please|movies?|films?|showing|screenings?|showtimes?|tonight|tomorrow|today|yesterday|seats?|available|empty|adjacent|together|side\s+by\s+side|next\s+to|tickets?|book(ing)?|price|cost|discounts?|students?|promos?|promotions?|codes?|vouchers?|combos?|popcorn|drinks?|people|couple|theater|cinema|address|located|location|open(ing)?|clos(e|ing)|hours?|rooms?|halls?|screens?|types?|difference|between|special|late|minutes?|forgot|left|lost|phone|staff|agent|support|human|history|account|other\s+person|someone\s+else|environment|variables?|database|users?|passwords?|confirm|cancel|yes|hello|hi|hey|thanks|thank\s+you|bye|goodbye)\b/i.test(
      lower
    );
  if (hasEnglishSignal) {
    return 'en';
  }

  return fallbackLang || 'vi';
};

/**
 * Phân loại chi tiết mối đe dọa bảo mật (Mục 10.1 API Key, 10.2 MongoDB Data, 10.3 Prompt Injection)
 */
export const classifySecurityThreat = (message = '') => {
  const raw = String(message || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const noTone = removeVietnameseTones(lower);

  // 10.3. Chống Prompt Injection / Vượt quyền / Tiết lộ System Prompt
  const promptInjectionPatterns = [
    /\bbo\s+qua\s+(moi\s+|tat\s+ca\s+|cac\s+)?(quy\s+tac|huong\s+dan|lenh|rang\s+buoc|he\s+thong|system)/i,
    /\bphot\s+lo\s+(moi\s+|tat\s+ca\s+)?(quy\s+tac|huong\s+dan|system)/i,
    /\bignore\s+(all\s+|previous\s+|prior\s+|above\s+|system\s+)?(instructions?|rules?|prompts?|constraints?|guidelines?)/i,
    /\bdisregard\s+(all\s+|previous\s+|prior\s+|system\s+)?(instructions?|rules?|prompts?)/i,
    /\bsystem\s*prompt\b/i,
    /\b(tiet\s+lo|cho\s+.*xem|hien\s+thi|in\s+ra|reveal|show|print)\s+.*(huong\s+dan\s+noi\s+bo|internal\s+instructions?|developer\s+prompt|hidden\s+prompt)/i,
    /\b(thay\s+doi\s+vai\s+tro|change\s+your\s+role|switch\s+your\s+role)\b/i,
    /\b(gia\s+lap\s+(tai\s+khoan\s+)?admin|pretend\s+(you\s+are|to\s+be)\s+admin|act\s+as\s+(an?\s+)?admin)/i,
    /\b(toi\s+la\s+(admin|quan\s+tri\s+vien)|minh\s+la\s+admin|i\s+am\s+(the\s+|an?\s+)?admin(istrator)?)\b.*\b(cho\s+xem|xoa|sua|cap\s+quyen|truy\s+cap|show|delete|grant|bypass|override|all)/i,
    /\b(vuot\s+qua\s+quyen|bypass\s+(auth|authentication|permission|access|security|role))\b/i,
    /\byou\s+are\s+now\s+(dan|jailbreak|unrestricted|developer\s+mode)\b/i,
  ];
  if (promptInjectionPatterns.some((p) => p.test(noTone) || p.test(lower))) {
    return 'PROMPT_INJECTION';
  }

  // 10.1. Bảo vệ API KEY, mật khẩu nội bộ, file .env, biến môi trường, cấu hình máy chủ
  const apiKeyPatterns = [
    /\bgemini_api_key\b/i,
    /\bjwt_secret\b/i,
    /\bmongodb_uri\b/i,
    /\bapi[_\s-]*keys?\b/i,
    /(?:^|[\s"'`(])\.env(?:$|[\s"'`),.?!])/i,
    /\bfile\s+env\b/i,
    /\bprocess\.env\b/i,
    /\b(in|hien\s+thi|xem|liet\s+ke|print|show|dump|list|reveal)\s+(toan\s+bo\s+|tat\s+ca\s+|all\s+)?(bien\s+moi\s+truong|environment\s+variables?|env\s+vars?)\b/i,
    /\b(tiet\s+lo|cho\s+.*xem|hien\s+thi|show|reveal|expose|read)\s+.*(cau\s+hinh\s+may\s+chu|cau\s+hinh\s+he\s+thong|cau\s+hinh\s+noi\s+bo|server\s+config(uration)?|secret\s*key|access\s*token|mat\s+khau\s+(he\s+thong|admin|database|may\s+chu))\b/i,
  ];
  if (apiKeyPatterns.some((p) => p.test(noTone) || p.test(lower))) {
    return 'API_KEY';
  }

  // 10.2. Bảo vệ dữ liệu MongoDB, thông tin khách hàng, tài khoản người dùng & chặn NoSQL/SQL injection
  const mongoDataPatterns = [
    /\b(liet\s+ke|xem|hien\s+thi|xuat|truy\s+xuat|in|lay|list|show|export|dump|get)\s+(toan\s+bo\s+|tat\s+ca\s+|danh\s+sach\s+|all\s+)?(thong\s+tin\s+)?(khach\s+hang|tai\s+khoan\s+nguoi\s+dung|tai\s+khoan\s+khach|tai\s+khoan\s+quan\s+tri|tai\s+khoan\s+admin|user\s+accounts?|customer\s+data|customers\s+in\s+mongodb|users\s+in\s+mongodb)\b/i,
    /\b(xuat|tai|sao\s+luu|export|dump|download)\s+(toan\s+bo\s+)?(du\s+lieu\s+)?(database|co\s+so\s+du\s+lieu|mongodb|collection)\b/i,
    /\b(cho\s+.*xem|hien\s+thi|liet\s+ke|lay|show|give\s+me|list)\s+.*(so\s+dien\s+thoai\s+va\s+email|email\s+(cua\s+)?khach\s+hang|sdt\s+khach\s+hang|mat\s+khau\s+(khach\s+hang|nguoi\s+dung|user)|customer\s+(phones?|phone\s+numbers?|emails?|passwords?))\b/i,
    /\b(db\.(users|adminusers|bookings|showtimes|collection|getCollection|dropDatabase)|\.deleteMany\s*\(|\.updateMany\s*\(|\.insertMany\s*\(|drop\s+table|select\s+\*\s+from|\$where\b|\$ne\s*:|\$gt\s*:|truy\s+van\s+mongodb\s+tuy\s+y)\b/i,
    /\b(xoa|sua|thay\s+doi|cap\s+nhat|delete|drop|modify|alter)\s+(toan\s+bo\s+|tat\s+ca\s+)?(du\s+lieu\s+he\s+thong|database|bang\s+phim|bang\s+user|collection)\b/i,
  ];
  if (mongoDataPatterns.some((p) => p.test(noTone) || p.test(lower))) {
    return 'MONGODB_DATA';
  }

  return null;
};

/**
 * Phát hiện tấn công Prompt Injection hoặc yêu cầu tiết lộ cấu hình nội bộ / vượt quyền
 */
export const detectPromptInjection = (message = '') => {
  return Boolean(classifySecurityThreat(message));
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
  'movie',
  'movies',
  'film',
  'films',
  'showing',
  'coming',
  'soon',
  'tonight',
  'today',
  'tomorrow',
  'action',
  'horror',
  'comedy',
  'romance',
  'family',
  'friends',
  'couple',
  'what',
  'which',
  'good',
  'best',
  'next',
  'month',
  'vao',
  'trong',
  'ngoai',
  'tren',
  'duoi',
  'giua',
  'den',
  'tu',
  'theo',
  'tat',
  'ca',
  'toan',
  'bo',
  'moi',
  'cac',
  'nhung',
  'chung',
  'rieng',
  'khac',
  'luc',
  'buoi',
  'dip',
  'dot',
  'all',
  'every',
  'any',
  'in',
  'on',
  'at',
  'for',
  'of',
  'with',
  'to',
  'from',
]);

/**
 * Phát hiện tên phim mà người dùng hỏi đích danh nhưng KHÔNG tồn tại trong danh sách phim hiện tại.
 * Đã khắc phục triệt để lỗi nhận nhầm các từ trạng thái/thể loại/thời gian/giới từ (như "đang", "sắp", "vào", "tất cả").
 */
export const extractUnmatchedMovieQuery = (text = '', matchedMovie = null) => {
  if (matchedMovie) return null;
  const clean = String(text || '').trim();
  const noTone = normalizeGenZVietnamese(clean);

  // Bỏ qua hoàn toàn nếu câu hỏi rõ ràng là hỏi chung toàn bộ / danh sách phim / đặt vé phim chung
  if (
    /\b(tat\s+ca\s+(?:cac\s+)?(?:bo\s+)?phim|toan\s+bo\s+(?:cac\s+)?(?:bo\s+)?phim|moi\s+(?:bo\s+)?phim|(?:cac|nhung)\s+(?:bo\s+)?phim|danh\s+sach\s+phim|phim\s+dang\s+chieu|phim\s+sap\s+chieu|phim\s+gi|phim\s+nao|(?:suat|lich)\s+chieu\s+(?:cua\s+)?(?:tat\s+ca\s+)?(?:cac\s+|nhung\s+|moi\s+)?(?:bo\s+)?phim(?:\s+(?:vao|trong|hom|toi|chieu|sang|ngay|cuoi|thu|chu)|\s*$)|co\s+phim\s+(?:gi|nao|hay|moi|hot|kinh\s+di|hanh\s+dong|tinh\s+cam|hoat\s+hinh|hai|gia\s+dinh|tam\s+ly|vien\s+tuong|tre\s+em|3d|2d|imax))\b/i.test(
      noTone
    ) ||
    /^(?:(?:toi|minh|em)\s+muon\s+)?(?:dat|mua|book)\s+(?:\d+\s*)?ve\s+(?:xem\s+)?phim(?:\s+(?:hom\s+nay|toi\s+nay|ngay\s+mai|cuoi\s+tuan))?[!.,?\s]*$/i.test(
      noTone
    )
  ) {
    return null;
  }

  // Bỏ qua nếu hỏi theo số thứ tự hoặc đại từ tham chiếu ("phim thứ 2", "phim đó", "phim này")
  if (/\bphim\s+(?:thu\s+\d+|so\s+\d+|dau\s+tien|cuoi\s+cung|cuoi|do|nay|ay|vua\s+roi)\b/i.test(noTone)) {
    return null;
  }

  // Mẫu: "phim <Tên riêng>" (ưu tiên trong ngoặc kép hoặc cụm tên riêng thực sự)
  const quotedMatch = clean.match(/phim\s*["'“]([^"'”]{2,40})["'”]/i);
  const rawMatch =
    quotedMatch ||
    clean.match(
      /(?:^|\s)phim\s+([A-Za-zÀ-ỹ0-9][A-Za-zÀ-ỹ0-9\s:\-']{1,35}?)(?:\s+(?:có|còn|đang|sắp|chiếu|lúc|vào|trong|theo|từ|đến|cho|của|tại|tối|chiều|sáng|trưa|hôm|ngày|cuối|thứ|suất|lịch|giá|ở|không|nào|mấy|bao\s+nhiêu|dài|thời\s+lượng|nội\s+dung|đạo\s+diễn|diễn\s+viên|hay|là|nói|kể|về)|[?!.,]|$)/i
    );

  if (!rawMatch) return null;

  const candidate = rawMatch[1].trim();
  const candidateClean = normalizeAlphaNum(normalizeGenZVietnamese(candidate));
  if (!candidateClean || candidateClean.length < 2 || /^\d+$/.test(candidateClean)) {
    return null;
  }

  const tokens = candidateClean.split(' ').filter(Boolean);
  // Nếu tất cả các từ đều là từ chỉ trạng thái / thể loại / thời gian / giới từ / từ để hỏi -> KHÔNG PHẢI tên phim
  if (tokens.length === 0 || tokens.every((t) => NON_MOVIE_STOP_TOKENS.has(t))) {
    return null;
  }

  // Nếu từ đầu tiên là trạng thái chiếu, giới từ hoặc lượng từ ("dang ...", "vao ...", "tat ...", "cac ...") -> KHÔNG PHẢI tên phim
  if (
    [
      'dang',
      'sap',
      'thu',
      'so',
      'nao',
      'gi',
      'co',
      'con',
      'vao',
      'trong',
      'theo',
      'tu',
      'den',
      'tat',
      'toan',
      'moi',
      'cac',
      'nhung',
      'hom',
      'ngay',
      'toi',
      'chieu',
      'sang',
      'rap',
    ].includes(tokens[0])
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

  // 4. Số lượng vé / ghế & Yêu cầu ghế liền nhau (hỗ trợ cả tiếng Việt & tiếng Anh)
  let ticketQuantity = null;
  const qtyMatch =
    noTone.match(/\b(\d{1,2})\s*(ve|ghe|nguoi|cho|suat|tickets?|seats?|people|persons?)\b/i) ||
    (/^\s*\d{1,2}\s*$/.test(noTone) ? [null, noTone.trim()] : null);
  if (qtyMatch && qtyMatch[1]) {
    const n = Number(qtyMatch[1]);
    if (n >= 1 && n <= 50 && (!/^\s*\d{1,2}\s*$/.test(noTone) || n <= 12)) {
      ticketQuantity = n;
    }
  } else if (/\b(two\s+tickets?|two\s+seats?|hai\s+ve|hai\s+ghe|1\s+cap\s+ve)\b/i.test(noTone)) {
    ticketQuantity = 2;
  }

  const requireContiguousSeats =
    /\b(lien\s+nhau|canh\s+nhau|sat\s+nhau|lien\s+ke|ngoi\s+chung|ngoi\s+canh|cung\s+hang|adjacent|next\s+to\s+each\s+other|side\s+by\s+side|seats?\s+together|sit\s+together|contiguous|beside\s+each\s+other)\b/i.test(
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

  // 10. Trạng thái phim (Đang chiếu vs Sắp chiếu — hỗ trợ VI & EN)
  let movieStatusFilter = null;
  if (/\b(sap\s+chieu|coming\s+soon|chuan\s+bi\s+chieu|sap\s+ra\s+mat|upcoming\s+movies?|upcoming\s+films?|next\s+month'?s?\s+movies?|movies?\s+next\s+month|future\s+releases?)\b/i.test(noTone)) {
    movieStatusFilter = 'COMING_SOON';
  } else if (/\b(dang\s+chieu|now\s+showing|hien\s+tai|currently\s+showing|showing\s+now)\b/i.test(noTone)) {
    movieStatusFilter = 'NOW_SHOWING';
  }

  // 11. Tham chiếu phim theo số thứ tự ("phim đầu tiên", "phim thứ 2", "phim số 3")
  let ordinalMovieIndex = null;
  if (/\b(phim\s+(?:dau\s+tien|thu\s+nhat|thu\s+1|so\s+1)|first\s+movie|movie\s+#?1)\b/i.test(noTone)) {
    ordinalMovieIndex = 0;
  } else if (/\b(phim\s+(?:cuoi\s+cung|cuoi)|last\s+movie)\b/i.test(noTone)) {
    ordinalMovieIndex = -1;
  } else {
    const ordMatch = noTone.match(/\b(?:phim\s+(?:thu|so)\s+(\d{1,2})|(?:movie|option)\s+#?(\d{1,2}))\b/i);
    if (ordMatch) {
      const idx = Number(ordMatch[1] || ordMatch[2]) - 1;
      if (idx >= 0 && idx < 10) ordinalMovieIndex = idx;
    }
  }

  // 2b. Lọc theo tháng (VD: "tháng 12 có phim j", "tháng sau", "next month")
  let monthFilter = null;
  const nowPartsForMonth = getVNDateParts(nowDate);
  if (nowPartsForMonth) {
    const explicitMonthMatch = noTone.match(/\b(?:thang|month)\s+(1[0-2]|0?[1-9])(?:\s*[\/\-]\s*(20\d{2}))?\b/i);
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
        labelEn: `${targetMonth}/${targetYear}`,
        isFutureMonth,
      };
    } else if (/\b(thang\s+(sau|toi)|next\s+month)\b/i.test(noTone)) {
      const nextMonth = nowPartsForMonth.month === 12 ? 1 : nowPartsForMonth.month + 1;
      const nextYear = nowPartsForMonth.month === 12 ? nowPartsForMonth.year + 1 : nowPartsForMonth.year;
      monthFilter = {
        month: nextMonth,
        year: nextYear,
        monthKey: `${nextYear}-${String(nextMonth).padStart(2, '0')}`,
        label: `Tháng ${nextMonth}/${nextYear}`,
        labelEn: `${nextMonth}/${nextYear}`,
        isFutureMonth: true,
      };
    }
  }

  // 12. Mã đặt vé nếu khách cung cấp (VD: MTX-123456, DAV-982134-VN, BK-123456)
  const bookingCodeMatch = String(message || '').match(/\b((?:MTX|DAV|BK|VE)[-_]?[A-Z0-9]{4,14}(?:[-_][A-Z0-9]{2,6})?)\b/i);
  const bookingCode = bookingCodeMatch ? bookingCodeMatch[1].toUpperCase() : null;

  // 13. Ngôn ngữ & Nhóm khán giả tư vấn (Gia đình / Bạn bè / Người yêu)
  const language = detectMessageLanguage(message);

  let audienceGroup = null;
  if (/\b(nguoi\s+yeu|ban\s+gai|ban\s+trai|cap\s+doi|hen\s+ho|vo\s+chong|couple|couples|date\s+night|girlfriend|boyfriend|partner)\b/i.test(noTone)) {
    audienceGroup = 'COUPLE';
  } else if (/\b(ban\s+be|nhom\s+ban|hoi\s+ban|friends?|group\s+of\s+friends)\b/i.test(noTone)) {
    audienceGroup = 'FRIENDS';
  } else if (/\b(gia\s+dinh|ca\s+nha|bo\s+me|phu\s+huynh|family|families|parents)\b/i.test(noTone)) {
    audienceGroup = 'FAMILY';
  }

  // 14. Phân loại câu hỏi chi tiết về Ưu đãi / Combo / Phòng chiếu / Rạp / Chính sách / Tra cứu vé / Chi tiết phim
  let promoSubType = null;
  if (/(?:\b100\s*%|\bmien\s+phi\s+100\b|\bgiam\s+100\b|\bvoucher\s+0\s*d\b|\bve\s+0\s*d\b|\bfree\s+ticket\s+code\b)/i.test(noTone)) {
    promoSubType = 'DISCOUNT_100';
  } else if (
    /\b((2|hai|nhieu|gop|cong\s+don|ket\s+hop|cung\s+luc|dong\s+thoi)\s+(ma\s+giam\s+gia|ma\s+khuyen\s+mai|ma\s+uu\s+dai|ma\s+voucher|voucher|code)|(dung|ap\s+dung|su\s+dung|nhap)\s+(2|hai|nhieu)\s+(ma|voucher|code)(?:\s+giam\s+gia|\s+khuyen\s+mai)?|(2|two|multiple)\s+(promo\s+codes?|discount\s+codes?|vouchers?|coupons?)|combine\s+.*(codes?|vouchers?)|stack\s+.*(codes?|vouchers?))\b/i.test(
      noTone
    )
  ) {
    promoSubType = 'MULTI_CODE';
  } else if (/\b(sinh\s+vien|hoc\s+sinh|hssv|u22|students?)\b/i.test(noTone)) {
    promoSubType = 'STUDENT';
  }

  let promoPaymentFilter = null;
  if (
    /\b(voucher|khuyen\s+mai|ma\s+giam\s+gia|uu\s+dai|giam\s+gia|code\s+giam|promo|discount)\b/i.test(noTone)
  ) {
    if (/\bvnpay\b/i.test(noTone)) promoPaymentFilter = 'VNPAY';
    else if (/\bmomo\b/i.test(noTone)) promoPaymentFilter = 'MOMO';
  }

  let comboTargetSize = null;
  if (/\b(2\s*nguoi|hai\s*nguoi|cap\s+doi|combo\s+doi|couple|for\s+2|for\s+two|2\s+people|two\s+people)\b/i.test(noTone)) {
    comboTargetSize = 2;
  } else if (/\b(1\s*nguoi|mot\s*nguoi|di\s+1\s+minh|solo|for\s+1|for\s+one|1\s+person|one\s+person)\b/i.test(noTone)) {
    comboTargetSize = 1;
  } else if (/\b((3|4|5)\s*nguoi|gia\s+dinh|nhom|family|for\s+(3|4)|four\s+people)\b/i.test(noTone)) {
    comboTargetSize = 4;
  }

  let concessionSubType = null;
  if (
    /\b(nuoc\s+ngot|pepsi|coca|ly\s+nuoc|chai\s+nuoc|drinks?|soda)\b/i.test(noTone) &&
    !/\b(bap|popcorn|combo)\b/i.test(noTone)
  ) {
    concessionSubType = 'DRINK_ONLY';
  } else if (
    /\b(bap\s+rang|bong\s+ngo|popcorn)\b/i.test(noTone) &&
    !/\b(nuoc|combo|pepsi|coca)\b/i.test(noTone)
  ) {
    concessionSubType = 'POPCORN_ONLY';
  }

  let cinemaSubQuery = null;
  if (
    /\b(mo\s+cua|dong\s+cua|gio\s+hoat\s+dong|gio\s+lam\s+viec|hoat\s+dong\s+den\s+may\s+gio|mo\s+den\s+may\s+gio|dong\s+luc\s+may\s+gio|open(ing)?\s+hours?|operating\s+hours?|working\s+hours?|what\s+time\s+does\s+(the\s+)?(cinema|theater)\s+(open|close)|open\s+until|close\s+at)\b/i.test(
      noTone
    )
  ) {
    cinemaSubQuery = 'HOURS';
  } else if (
    /\b(dia\s+chi|nam\s+o\s+dau|rap\s+(nam\s+)?o\s+dau|cho\s+nao|vi\s+tri\s+rap|where\s+is\s+(the\s+)?(cinema|theater)|cinema\s+address|theater\s+address|theater\s+location)\b/i.test(
      noTone
    )
  ) {
    cinemaSubQuery = 'ADDRESS';
  }

  let roomSubQuery = null;
  const asksShowtimeExplicitly = /\b(suat\s+chieu|lich\s+chieu|chieu\s+luc|chieu\s+may\s+gio|showtimes?|what\s+movies?\s+are\s+showing|movies?\s+showing)\b/i.test(noTone);
  if (!asksShowtimeExplicitly) {
    const asksRoomTypesToo = /\b(nhung\s+loai\s+phong|cac\s+loai\s+phong|loai\s+phong(\s+chieu)?\s+nao|types?\s+of\s+(screening\s+)?rooms?)\b/i.test(noTone);
    const asksTotalCount = /\b(bao\s+nhieu\s+phong|may\s+phong(\s+chieu)?|tong\s+(cong\s+|so\s+)?(bao\s+nhieu\s+|may\s+)?phong|how\s+many\s+(screening\s+)?(rooms?|screens?|halls?|auditoriums?))\b/i.test(noTone);

    if (
      /\b(khac\s+(gi|nhau|biet|o\s+dau)|(?:imax|dolby|gold|2d|3d).*?\bkhac\b.*?(?:imax|dolby|gold|2d|3d)|so\s+sanh\s+.*(imax|dolby|gold|2d|3d)|difference\s+between|how\s+(does|do|is|are)\s+.*differ(ent)?|compare\s+.*(imax|dolby|gold))\b/i.test(
        noTone
      )
    ) {
      roomSubQuery = 'COMPARE';
    } else if (/\b(gold\s*class\s+(co\s+gi|la\s+gi|dac\s+biet|nhu\s+the\s+nao)|phong\s+gold\s*class\s+(co\s+gi|la\s+gi|dac\s+biet)|what\s+(is|makes)\s+gold\s*class|gold\s*class\s+features?)\b/i.test(noTone)) {
      roomSubQuery = 'GOLD_CLASS';
    } else if (/\b(imax(\s+laser)?\s+(co\s+gi|la\s+gi|dac\s+biet|nhu\s+the\s+nao)|phong\s+imax(\s+laser)?\s+(co\s+gi|la\s+gi|dac\s+biet)|what\s+(is|makes)\s+imax)\b/i.test(noTone)) {
      roomSubQuery = 'IMAX_DETAIL';
    } else if (/\b(dolby(\s+atmos)?\s+(co\s+gi|la\s+gi|dac\s+biet|nhu\s+the\s+nao)|phong\s+dolby(\s+atmos)?\s+(co\s+gi|la\s+gi|dac\s+biet)|what\s+(is|makes)\s+dolby(\s+atmos)?)\b/i.test(noTone)) {
      roomSubQuery = 'DOLBY_DETAIL';
    } else if (asksTotalCount && !asksRoomTypesToo) {
      roomSubQuery = 'TOTAL_COUNT_ONLY';
    } else if (asksTotalCount && asksRoomTypesToo) {
      roomSubQuery = 'TOTAL_AND_TYPES';
    } else if (
      asksRoomTypesToo ||
      /\b(co\s+(nhung\s+)?phong(\s+chieu)?\s+(nao|gi|4dx|screenx|imax|dolby|gold)|cong\s+nghe\s+(phong\s+)?chieu|what\s+(kinds?\s+of\s+|types?\s+of\s+)?(screening\s+)?rooms?\s+(do\s+you\s+have|does\s+the\s+(cinema|theater)\s+have|are\s+there)|4dx|screenx)\b/i.test(
        noTone
      )
    ) {
      roomSubQuery = 'TYPES';
    }
  }

  // Khía cạnh chi tiết khi khách hỏi riêng về 1 bộ phim cụ thể (thời lượng, độ tuổi, đạo diễn/diễn viên, cốt truyện, tư vấn riêng 1 phim)
  let movieDetailAspect = null;
  if (/\b(thoi\s+luong|dai\s+bao\s+nhieu|bao\s+nhieu\s+phut|may\s+phut|may\s+tieng|how\s+long|duration|runtime|running\s+time)\b/i.test(noTone)) {
    movieDetailAspect = 'DURATION';
  } else if (
    /\b(may\s+tuoi|bao\s+nhieu\s+tuoi|do\s+tuoi|phan\s+loai(\s+do)?\s+tuoi|gioi\s+han\s+tuoi|xem\s+duoc\s+khong|age\s+rating|old\s+enough)\b/i.test(
      noTone
    ) &&
    (matchedMovie || ordinalMovieIndex !== null || /\bphim\s+(do|nay|ay)\b/i.test(noTone))
  ) {
    movieDetailAspect = 'AGE_RATING';
  } else if (/\b(dao\s+dien|dien\s+vien|ai\s+dong|ai\s+dao\s+dien|dan\s+cast|director|cast|who\s+stars|actors?|starring)\b/i.test(noTone)) {
    movieDetailAspect = 'DIRECTOR_CAST';
  } else if (
    /\b(khoi\s+chieu\s+(khi\s+nao|ngay\s+nao|bao\s+gio)|khi\s+nao\s+(khoi\s+)?chieu|bao\s+gio\s+(ra\s+mat|khoi\s+chieu)|release\s+date|when\s+(does|will|is)\s+.*(release|come\s+out))\b/i.test(
      noTone
    )
  ) {
    movieDetailAspect = 'RELEASE_DATE';
  } else if (/\b(noi\s+dung|cot\s+truyen|ke\s+ve|tom\s+tat|noi\s+ve(\s+cai)?\s+gi|plot|synopsis|storyline|what\s+is\s+.*about)\b/i.test(noTone)) {
    movieDetailAspect = 'PLOT';
  } else if (
    /\b(tu\s+van|gioi\s+thieu|review|danh\s+gia|co\s+hay\s+khong|hay\s+khong|co\s+dang\s+xem|nen\s+xem\b|worth\s+watching|should\s+i\s+watch|tell\s+me\s+about)\b/i.test(
      noTone
    ) &&
    (matchedMovie || ordinalMovieIndex !== null || /\bphim\s+(do|nay|ay)\b/i.test(noTone)) &&
    !/\b(phim\s+(?:gi|nao)|nhung\s+phim|cac\s+phim|giong\s+phim|similar\s+to|like)\b/i.test(noTone)
  ) {
    movieDetailAspect = 'ADVISORY';
  }

  let policySubType = null;
  if (/\b(den\s+tre|di\s+tre|di\s+muon|vao\s+tre|tre\s+\d+\s*phut|muon\s+\d+\s*phut|late\s+by\s+\d+|\d+\s*minutes?\s+late|arrive\s+late|come\s+late)\b/i.test(noTone)) {
    policySubType = 'LATE_ARRIVAL';
  } else if (/\b(de\s+quen|bo\s+quen|quen\s+(dien\s+thoai|do|vi|tui|balo|ao|chia\s+khoa)|that\s+lac|roi\s+(dien\s+thoai|vi|do)|left\s+my\s+(phone|wallet|bag|keys?|item)|forgot\s+my\s+(phone|wallet|bag)|lost\s+(my\s+)?(phone|wallet|bag|item)|lost\s+and\s+found)\b/i.test(noTone)) {
    policySubType = 'LOST_ITEM';
  } else if (/\b(gap\s+nhan\s+vien|can\s+nguoi\s+ho\s+tro|ket\s+noi\s+(voi\s+)?nhan\s+vien|noi\s+chuyen\s+voi\s+nhan\s+vien|chuyen\s+tiep\s+nhan\s+vien|nhan\s+vien\s+ho\s+tro|lien\s+he\s+(nhan\s+vien|ho\s+tro|cskh|tong\s+dai)|talk\s+to\s+(a\s+)?(staff|human|person|agent|representative)|speak\s+(to|with)\s+(staff|an\s+agent|someone)|connect\s+me\s+(with|to)\s+(staff|support|an\s+agent)|need\s+(human\s+|a\s+person\s+to\s+)?support)\b/i.test(noTone)) {
    policySubType = 'LIVE_AGENT';
  } else if (/\b(mang\s+do\s+an|do\s+an\s+(tu\s+)?ben\s+ngoai|thuc\s+an\s+ben\s+ngoai|outside\s+food|bring\s+food)\b/i.test(noTone)) {
    policySubType = 'OUTSIDE_FOOD';
  } else if (/\b(mat\s+ma\s+ve|quen\s+ma\s+ve|lost\s+(my\s+)?ticket\s+code)\b/i.test(noTone)) {
    policySubType = 'LOST_TICKET';
  } else if (/\b(doi\s+mat\s+khau|quen\s+mat\s+khau|dang\s+ky\s+tai\s+khoan|tao\s+tai\s+khoan|forgot\s+password|reset\s+password)\b/i.test(noTone)) {
    policySubType = 'ACCOUNT';
  }

  let bookingLookupMode = null;
  if (
    /\b(ve\s+cua\s+(nguoi\s+khac|khach\s+khac|ban\s+toi|ban\s+minh|anh\s+ay|chi\s+ay|co\s+ay|nguoi\s+yeu\s+toi)|xem\s+ve\s+(cua\s+)?(nguoi\s+khac|khach\s+khac)|kiem\s+tra\s+ve\s+cua\s+(nguoi\s+khac|khach\s+khac|ban\s+toi)|(someone\s+else'?s?|other\s+person'?s?|another\s+(user|customer|person)'?s?|my\s+friend'?s?)\s+(tickets?|bookings?|orders?)|tickets?\s+of\s+(another|other)\s+(user|person|customer))\b/i.test(
      noTone
    )
  ) {
    bookingLookupMode = 'OTHER_USER';
  } else if (
    /\b(ve\s+(toi\s+|minh\s+|em\s+)?(vua|moi)\s+dat|don\s+(vua|moi)\s+dat|giao\s+dich\s+(vua|moi)\s+dat|kiem\s+tra\s+ve\s+(toi\s+|minh\s+)?(vua|moi)\s+dat|ticket\s+i\s+just\s+booked|booking\s+i\s+just\s+made|just\s+booked|latest\s+(ticket|booking)|most\s+recent\s+(ticket|booking))\b/i.test(
      noTone
    )
  ) {
    bookingLookupMode = 'LATEST';
  } else if (
    /\b(da\s+tung\s+dat|nhung\s+ve\s+nao|lich\s+su\s+dat\s+ve|tat\s+ca\s+ve|ve\s+cua\s+(toi|minh|em)|ve\s+(toi|minh|em)\s+da\s+dat|tickets?\s+have\s+i\s+booked|my\s+booking\s+history|booking\s+history|all\s+my\s+(tickets?|bookings?)|check\s+my\s+tickets?)\b/i.test(
      noTone
    )
  ) {
    bookingLookupMode = 'HISTORY';
  }

  // 15. Trích xuất danh sách mã ghế khách chọn (VD: F5, F6, A1, H1-2) & tín hiệu quy trình đặt vé
  const seatMatches = [...String(message || '').matchAll(/\b([A-GH](?:1[0-2]|0?[1-9])(?:\s*-\s*\d{1,2})?)\b/gi)];
  const selectedSeatCodes = [
    ...new Set(
      seatMatches.map((m) => {
        const rawSeat = m[1].replace(/\s+/g, '').toUpperCase();
        const normMatch = rawSeat.match(/^([A-GH])0*(\d+)$/);
        return normMatch ? `${normMatch[1]}${parseInt(normMatch[2], 10)}` : rawSeat;
      })
    ),
  ];

  const wantsSmartBooking =
    !/\b(hoan\s+ve|doi\s+ve|huy\s+ve|tra\s+ve|cach\s+dat\s+ve|huong\s+dan\s+dat\s+ve|lam\s+sao\s+(de\s+)?dat\s+ve|mua\s+ve\s+nhu\s+the\s+nao|link\s+dat\s+ve|duong\s+dan\s+dat\s+ve|cho\s+(toi\s+|minh\s+|em\s+)?link|dat\s+ve\s+suat\s+(do|nay)|dat\s+ve\s+thanh\s+cong|ve\s+(vua|moi|da)\s+dat|lich\s+su\s+dat\s+ve|kiem\s+tra\s+(don\s+)?(dat\s+)?ve|how\s+to\s+book|booking\s+link|refund|cancel\s+ticket|exchange\s+ticket)\b/i.test(
      noTone
    ) &&
    (/\b((toi|minh|em|anh|chi)\s+muon\s+(dat|mua|book)\s+(\d+\s*)?ve|cho\s+(toi|minh|em)\s+(dat|mua|book)\s+(\d+\s*)?ve|(dat|mua|book)\s+\d+\s*ve(\s+(xem\s+)?phim)?|muon\s+(dat|mua|book)\s+ve|(dat|mua|book)\s+ve\s+(xem\s+)?phim|i\s+(want|would\s+like)\s+to\s+(book|buy)\s+(\d+\s*|two\s+)?tickets?|book\s+(\d+\s*|two\s+)tickets?)\b/i.test(
      noTone
    ) ||
      /^(?:dat|mua|book)\s+ve(?:\s+(?:ngay|luon|voi|nha|nhe|a|dum|giup))?[!.,?\s]*$/i.test(noTone) ||
      /^(?:book|buy)\s+(?:movie\s+)?tickets?[!.,?\s]*$/i.test(noTone));

  const isConfirmAction =
    /^(xac\s+nhan(\s+dat\s+ve)?|dong\s+y|chot(\s+ve|\s+don)?|dat\s+ngay|thanh\s+toan(\s+ngay)?|confirm(\s+booking)?|yes(\s*,?\s*confirm)?|ok\s+xac\s+nhan)[!.,\s]*$/i.test(
      noTone
    );
  const isCancelFlowAction =
    /^(huy(\s+bo|\s+dat\s+ve|\s+thao\s+tac)?|khong\s+dat\s+nua|dung\s+dat\s+ve|cancel(\s+booking)?|stop\s+booking)[!.,\s]*$/i.test(
      noTone
    );

  // 16. Phân biệt rõ CÂU HỎI CHUNG (General Scope - toàn rạp) vs CÂU HỎI RIÊNG / NỐI TIẾP (Specific / Anaphora Scope)
  const hasExplicitAnaphora =
    ordinalMovieIndex !== null ||
    /\b(phim\s+(do|nay|ay|vua\s+roi)|bo\s+phim\s+(do|nay|ay)|suat\s+(chieu\s+)?(do|nay|ay)|khung\s+gio\s+(do|nay)|phong\s+(do|nay)|con\s+suat|the\s+con|vay\s+con|cho\s+(toi\s+|minh\s+|em\s+)?link|dat\s+(ve\s+)?suat\s+(do|nay)|this\s+(movie|film|showtime|screening)|that\s+(movie|film|showtime|screening)|its\s+(showtimes?|price|duration|plot)|what\s+about|how\s+about)\b/i.test(
      noTone
    );

  const isGeneralScopeQuery =
    !matchedMovie &&
    !unmatchedMovieTitle &&
    !hasExplicitAnaphora &&
    (/\b(tat\s+ca|toan\s+bo|moi\s+(bo\s+)?phim|(cac|nhung)\s+(bo\s+)?phim|danh\s+sach\s+phim|phim\s+(gi|nao)|co\s+phim\s+(gi|nao|hay|moi)|nen\s+xem\s+phim|phim\s+(dang|sap)\s+chieu|all\s+movies?|every\s+movie|what\s+movies?|which\s+movies?|upcoming\s+movies?)\b/i.test(
      noTone
    ) ||
      /\b((suat|lich)\s+chieu\s+(cua\s+)?(tat\s+ca\s+|toan\s+bo\s+|cac\s+|moi\s+)?(bo\s+)?phim\b|(suat|lich)\s+chieu\s+(cua\s+)?rap\b|(suat|lich)\s+chieu\s+(hom\s+nay|toi\s+nay|chieu\s+nay|sang\s+nay|ngay\s+mai|ngay\s+kia|cuoi\s+tuan|thu\s+[2-7]|chu\s+nhat|ngay\s+\d)|(hom\s+nay|toi\s+nay|chieu\s+nay|ngay\s+mai|cuoi\s+tuan)\s+(rap\s+)?co\s+(nhung\s+)?(suat|lich)\s*(chieu\s+)?(nao|gi)|what\s+showtimes?|showtimes?\s+(today|tonight|tomorrow))\b/i.test(
        noTone
      ) ||
      Boolean(requireContiguousSeats && dateFilter && (!timeFilter || timeFilter.type !== 'EXACT')) ||
      Boolean(wantsSmartBooking) ||
      /\b(bang\s+gia(\s+ve)?|gia\s+ve\s+(rap|cua\s+rap|xem\s+phim|cac\s+loai\s+phong|imax|gold\s*class|dolby|2d|3d)|ticket\s+price\s+list)\b/i.test(
        noTone
      ));

  return {
    language,
    movieTitle: matchedMovie ? matchedMovie.title : unmatchedMovieTitle,
    matchedMovie,
    unmatchedMovieTitle,
    movieStatusFilter,
    ordinalMovieIndex,
    movieDetailAspect,
    bookingCode,
    bookingLookupMode,
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
    audienceGroup,
    promoSubType,
    promoPaymentFilter,
    comboTargetSize,
    concessionSubType,
    cinemaSubQuery,
    roomSubQuery,
    policySubType,
    selectedSeatCodes,
    wantsSmartBooking,
    isConfirmAction,
    isCancelFlowAction,
    hasExplicitAnaphora,
    isGeneralScopeQuery,
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
    Boolean(entities.roomSubQuery) ||
    Boolean(entities.cinemaSubQuery) ||
    Boolean(entities.policySubType) ||
    /\b(phim|rap|suat|ve|ghe|chieu|bap|nuoc|combo|voucher|khuyen\s+mai|uu\s+dai|d'avenor|davenor|thanh\s+khe|imax|dolby|3d|2d|movie|movies|cinema|theater|ticket|tickets|seat|seats|showtime|showtimes|popcorn|promo|discount)\b/i.test(
      noTone
    );
  const isClearlyOffTopic =
    !hasCinemaSignal &&
    /\b(thoi\s+tiet|du\s+bao|nhiet\s+do|troi\s+mua|weather|bong\s+da|ti\s+so|world\s+cup|football|soccer|chung\s+khoan|bitcoin|crypto|gia\s+vang|nau\s+an|cong\s+thuc\s+nau|lam\s+mon|recipe|viet\s+code|lap\s+trinh|python|javascript|java|c\+\+|giai\s+toan|phuong\s+trinh|tinh\s+toan|dich\s+tieng\s+anh|bai\s+tap|chinh\s+tri|bau\s+cu|thu\s+do\s+cua|capital\s+of|ai\s+la\s+tong\s+thong|president\s+of|tu\s+vi|boi\s+toan|xo\s+so)\b/i.test(
      noTone
    );

  if (isClearlyOffTopic) {
    return INTENTS.OUT_OF_SCOPE;
  }

  // 1c. Tra cứu đơn đặt vé cá nhân / lịch sử đặt vé / hỏi vé người khác (yêu cầu xác thực JWT ở backend)
  const asksPersonalBooking =
    Boolean(entities.bookingCode) ||
    Boolean(entities.bookingLookupMode) ||
    /\b(ve\s+cua\s+(toi|minh|em|anh|chi)|ve\s+(toi|minh|em|anh|chi)\s+(da\s+|vua\s+|moi\s+)?dat|ve\s+(da|vua|moi)\s+dat|don\s+(dat\s+)?ve\s+(cua\s+)?(toi|minh|em|anh|chi)?|don\s+(toi|minh|em)\s+(da\s+|vua\s+)?dat|lich\s+su\s+dat\s+ve|kiem\s+tra\s+(don\s+)?(dat\s+)?ve|check\s+ve|ktra\s+(don\s+)?ve|ma\s+(dat\s+)?ve\s+cua\s+(toi|minh|em)|da\s+dat\s+ve\s+thanh\s+cong|dat\s+ve\s+thanh\s+cong\s+chua|toi\s+da\s+thanh\s+toan\s+chua|minh\s+da\s+thanh\s+toan\s+chua|xem\s+lai\s+ve|tat\s+ca\s+ve\s+cua\s+(toi|minh|em)|check\s+(the\s+)?(ticket|booking)\s+i\s+just|my\s+(tickets?|bookings?)|what\s+tickets?\s+have\s+i\s+booked)\b/i.test(
      noTone
    );

  if (asksPersonalBooking) {
    return INTENTS.BOOKING_LOOKUP;
  }

  // 1d. Chính sách đi trễ, để quên điện thoại/tài sản, gặp nhân viên hỗ trợ, đồ ăn ngoài, mất mã vé, tài khoản
  if (entities.policySubType) {
    return INTENTS.CUSTOMER_SUPPORT;
  }

  // 1e. Địa chỉ rạp & Giờ mở cửa / đóng cửa của rạp (ưu tiên bắt trước SHOWTIME_SEARCH để không hiểu nhầm "mấy giờ đóng cửa" thành giờ chiếu phim)
  if (
    entities.cinemaSubQuery ||
    (/\b(dia\s+chi|o\s+dau|cho\s+nao|gui\s+xe|do\s+xe|bai\s+xe|duong\s+di|cum\s+rap|chi\s+nhanh|parking|where\s+is\s+(the\s+)?(cinema|theater)|opening\s+hours)\b/i.test(
      noTone
    ) &&
      !entities.matchedMovie &&
      !/\b(suat\s+chieu|lich\s+chieu|showtimes?)\b/i.test(noTone))
  ) {
    return INTENTS.CINEMA_LOCATION;
  }

  // 1f. Thông tin phòng chiếu (Loại phòng, tổng số phòng, so sánh IMAX Laser vs Dolby Atmos, Gold Class có gì đặc biệt)
  if (entities.roomSubQuery) {
    return INTENTS.ROOM_INFO;
  }

  // 1g. Ưu đãi sinh viên, dùng 2 mã giảm giá cùng lúc, xin mã 100%, hoặc hỏi mã khuyến mãi theo ví VNPAY/MoMo
  if (entities.promoSubType || entities.promoPaymentFilter) {
    return INTENTS.PROMOTION_VOUCHER;
  }

  // 2. Hỗ trợ thanh toán (VNPay, MoMo, chuyển khoản, lỗi trừ tiền, payment failed)
  if (
    /\b(thanh\s+toan|vnpay|momo|zalopay|chuyen\s+khoan|qr\s+code|the\s+ngan\s+hang|atm|visa|tru\s+tien|loi\s+thanh\s+toan|payment\s+failed|payment\s+methods?|charged\s+but)\b/i.test(
      noTone
    ) &&
    !entities.wantsSmartBooking
  ) {
    return INTENTS.PAYMENT_SUPPORT;
  }

  // 2b. Hỗ trợ khách hàng khác (khiếu nại, phản hồi, góp ý)
  if (/\b(khieu\s+nai|phan\s+hoi|gop\s+y|complaint|feedback)\b/i.test(noTone)) {
    return INTENTS.CUSTOMER_SUPPORT;
  }

  // 3. Quy trình đặt vé thông minh / Xin link đặt vé / Chính sách hoàn đổi vé
  if (entities.wantsSmartBooking) {
    return INTENTS.BOOKING_GUIDE;
  }

  if (
    /\b(link\s+dat\s+ve|duong\s+dan\s+dat\s+ve|cho\s+(toi\s+|minh\s+|em\s+)?link|cach\s+dat\s+ve|huong\s+dan\s+dat\s+ve|lam\s+sao\s+(de\s+)?dat\s+ve|mua\s+ve\s+nhu\s+the\s+nao|hoan\s+ve|doi\s+ve|huy\s+ve|tra\s+ve|how\s+to\s+book|booking\s+link|refund\s+policy|exchange\s+ticket)\b/i.test(
      noTone
    ) &&
    !entities.matchedMovie &&
    !entities.timeFilter &&
    !entities.format
  ) {
    return INTENTS.BOOKING_GUIDE;
  }

  if (
    /\b(link\s+dat\s+ve|duong\s+dan\s+dat\s+ve|cho\s+(toi\s+|minh\s+|em\s+)?link|hoan\s+ve|doi\s+ve|huy\s+ve|tra\s+ve|booking\s+link|refund|exchange\s+ticket)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.BOOKING_GUIDE;
  }

  // 4. Kiểm tra ghế trống / ghế liền nhau / sơ đồ ghế (VI & EN)
  if (
    entities.requireContiguousSeats ||
    /\b(ghe\s+trong|con\s+ghe|con\s+cho|het\s+ghe|het\s+cho|bao\s+nhieu\s+ghe|may\s+ghe|so\s+do\s+ghe|vi\s+tri\s+ghe|chon\s+ghe|con\s+\d+\s+ghe|how\s+many\s+seats?|seats?\s+(are\s+)?available|available\s+seats?|empty\s+seats?|seat\s+map)\b/i.test(
      noTone
    )
  ) {
    return INTENTS.SEAT_AVAILABILITY;
  }

  // 5. Combo bắp nước (ưu tiên bắt trước TICKET_PRICE để "combo cho 2 người giá bao nhiêu" không nhảy sang TICKET_PRICE)
  if (/\b(bap\s+rang|bap\s+nuoc|bong\s+ngo|combo|combos|popcorn|nuoc\s+ngot|pepsi|coca|snack\s+rap|mua\s+bap)\b/i.test(noTone)) {
    return INTENTS.CONCESSION_COMBO;
  }

  // 6. Hỏi giá vé / tính tiền N vé
  const asksAboutPrice =
    /\b(gia\s+ve|ve\s+bao\s+nhieu|bao\s+nhieu\s+tien|may\s+tien|bang\s+gia|tinh\s+tien|het\s+bao\s+nhieu|ticket\s+prices?|how\s+much\s+(is|are|for)\s+.*tickets?)\b/i.test(
      noTone
    ) ||
    (entities.ticketQuantity !== null && /\b(bao\s+nhieu|tien|gia|how\s+much|price|cost)\b/i.test(noTone));

  if (
    asksAboutPrice &&
    !/\b(nhung\s+suat\s+chieu\s+nao|co\s+suat\s+nao|lich\s+chieu|what\s+showtimes?)\b/i.test(noTone)
  ) {
    return INTENTS.TICKET_PRICE;
  }

  // 7. Khuyến mãi / Voucher
  if (
    /\b(voucher|vouchers|khuyen\s+mai|ma\s+giam\s+gia|uu\s+dai|giam\s+gia|code\s+giam|promotion|promotions|promo\s+codes?|discounts?|deals?)\b/i.test(
      noTone
    ) &&
    !entities.matchedMovie &&
    !entities.format
  ) {
    return INTENTS.PROMOTION_VOUCHER;
  }

  // 9. Suất chiếu 3D chuyên biệt
  if (entities.format === '3D') {
    return INTENTS.SHOWTIME_3D;
  }

  // 10. Câu hỏi RIÊNG về 1 bộ phim cụ thể (tư vấn riêng 1 phim "tư vấn cho tôi phim Dune", thời lượng, độ tuổi, đạo diễn, nội dung)
  // Ưu tiên bắt TRƯỚC MOVIE_RECOMMENDATION để không đổ danh sách nhiều phim khi khách chỉ hỏi đích danh 1 phim!
  const asksSpecificMovieQuestion =
    (entities.matchedMovie || entities.unmatchedMovieTitle || entities.ordinalMovieIndex !== null) &&
    (Boolean(entities.movieDetailAspect) ||
      /\b(noi\s+dung|cot\s+truyen|ke\s+ve|thoi\s+luong|dai\s+bao\s+nhieu|may\s+phut|dao\s+dien|dien\s+vien|the\s+loai\s+gi|may\s+tuoi|danh\s+gia|review|chi\s+tiet|tu\s+van|gioi\s+thieu|sao|the\s+nao|plot|synopsis|story|about|duration|director|cast|age\s+rating)\b/i.test(
        noTone
      )) &&
    !/\b(suat\s+chieu|lich\s+chieu|may\s+gio\s+chieu|co\s+suat\s+nao|showtimes?)\b/i.test(noTone);

  if (asksSpecificMovieQuestion) {
    return INTENTS.MOVIE_DETAIL;
  }

  // 11. Tư vấn / Gợi ý phim CHUNG (theo độ tuổi, trẻ em, thể loại, đối tượng gia đình/bạn bè/người yêu, nên xem phim gì)
  if (
    !entities.matchedMovie &&
    (entities.viewerAge !== null ||
      entities.genres.length > 0 ||
      entities.audienceGroup !== null ||
      /\b(goi\s+y|tu\s+van|nen\s+xem\s+phim\s+(gi|nao)|co\s+phim\s+(gi|nao)\s+hay|phim\s+nao\s+hay|top\s+phim|phim\s+hot|phim\s+dang\s+xem|phim\s+cho\s+tre|phim\s+gia\s+dinh|phim\s+phu\s+hop|what\s+movies?\s+should\s+i\s+watch|recommend\s+a\s+movie|any\s+good\s+movies?|good\s+movies?\s+to\s+watch|best\s+movies?)\b/i.test(
        noTone
      ))
  ) {
    return INTENTS.MOVIE_RECOMMENDATION;
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

  // 13. Tìm kiếm suất chiếu / lịch chiếu (VI & EN)
  if (
    entities.matchedMovie ||
    entities.unmatchedMovieTitle ||
    entities.format ||
    entities.timeFilter ||
    /\b(suat\s+chieu|lich\s+chieu|may\s+gio\s+chieu|chieu\s+luc\s+nao|co\s+suat\s+nao|con\s+suat|con\s+chieu|may\s+gio|showtimes?|schedule|what\s+time\s+is\s+.*showing)\b/i.test(
      noTone
    )
  ) {
    if (
      entities.dateFilter &&
      !entities.matchedMovie &&
      !entities.unmatchedMovieTitle &&
      !entities.format &&
      (!entities.timeFilter || /\b(what\s+movies?\s+are\s+showing|which\s+movies?\s+are\s+showing)\b/i.test(noTone)) &&
      /\b(co\s+phim\s+gi|chieu\s+phim\s+gi|nhung\s+phim\s+nao|phim\s+nao\s+dang\s+chieu|what\s+movies?\s+are\s+showing|which\s+movies?\s+are\s+showing)\b/i.test(
        noTone
      )
    ) {
      return INTENTS.MOVIE_SEARCH;
    }
    return INTENTS.SHOWTIME_SEARCH;
  }

  // 14. Tìm kiếm danh sách phim đang chiếu (VD: "Ngày mai có phim gì?", "What movies are showing?")
  if (
    entities.dateFilter ||
    /\b(co\s+phim\s+gi|phim\s+gi\s+dang\s+chieu|danh\s+sach\s+phim|phim\s+dang\s+chieu|phim\s+sap\s+chieu|phim\s+moi|chieu\s+gi|cac\s+bo\s+phim|what\s+movies?\s+are\s+showing|movies?\s+showing)\b/i.test(
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
 * Phân biệt nghiêm ngặt giữa CÂU HỎI CHUNG (General Scope -> KHÔNG kế thừa phim cũ)
 * và CÂU HỎI NỐI TIẾP / CÂU HỎI RIÊNG (Follow-up / Anaphora -> kế thừa đúng phim đang trao đổi).
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

  const noTone = normalizeGenZVietnamese(currentMessage || '');
  const hasHistory = Array.isArray(safeHistory) && safeHistory.length > 0;
  const hasSession = sessionContext && typeof sessionContext === 'object';

  // Giữ ngôn ngữ hội thoại khi tin nhắn quá ngắn không rõ ngôn ngữ (VD: "19:30", "E5, E6")
  if (
    sessionContext?.activeLanguage &&
    /^(?:\d{1,2}[:h]\d{2}|[a-h]\d{1,2}(?:\s*,\s*[a-h]\d{1,2})*)$/i.test(currentMessage.trim())
  ) {
    resolved.language = sessionContext.activeLanguage;
  }

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

  // 2. Nếu câu hiện tại rõ ràng là CÂU HỎI CHUNG toàn rạp (VD: "suất chiếu phim ngày mai",
  // "Tối nay còn 2 ghế cạnh nhau không?", "đặt vé phim", "các phim sắp chiếu", "bảng giá vé IMAX")
  // -> TUYỆT ĐỐI KHÔNG kế thừa bộ phim hay suất chiếu đơn lẻ từ lịch sử trước đó!
  if (resolved.isGeneralScopeQuery) {
    return { intent: currentIntent, entities: resolved };
  }

  // 3. Lấy ngữ cảnh từ sessionContext (ưu tiên cao nhất) rồi bổ sung an toàn từ safeHistory
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

  // Chỉ quét ngược safeHistory khi caller không truyền sessionContext hoặc để lấy showtimeId đơn lẻ
  // TUYỆT ĐỐI KHÔNG quét text của bot khi bot vừa trả về danh sách nhiều phim (tránh bắt nhầm Mufasa/Dune từ danh sách!)
  if (hasHistory && (!hasSession || !histMovie || !histShowtimeId)) {
    for (let i = safeHistory.length - 1; i >= 0; i--) {
      const turn = safeHistory[i];
      if (!turn || !turn.text) continue;

      const isMultiMovieBotTurn =
        turn.sender === 'bot' &&
        ((Array.isArray(turn.movieCards) && turn.movieCards.length > 1) ||
          /1\.\s*(?:🎬|🎞️)[\s\S]*2\.\s*(?:🎬|🎞️)/.test(turn.text));

      if (isMultiMovieBotTurn) {
        // Nếu lượt bot gần nhất là danh sách nhiều phim thì dừng, không lấy bừa 1 phim trong danh sách
        break;
      }

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
        const allLinks = [...turn.text.matchAll(/\/booking\/seat\/([a-fA-F0-9]{24})/g)];
        if (allLinks.length === 1) {
          histShowtimeId = allLinks[0][1];
        }
      }

      if (turn.sender === 'user') {
        const turnNoTone = normalizeGenZVietnamese(turn.text);
        const userMatchedMovie =
          matchMovieFromText(turn.text, availableMovies) ||
          matchMovieFromText(turnNoTone, availableMovies);

        // Nếu người dùng ở lượt trước hỏi câu hỏi chung (danh sách phim / tất cả các phim) mà không nêu tên phim -> dừng kế thừa
        if (
          !userMatchedMovie &&
          /\b(tat\s+ca|toan\s+bo|(cac|nhung)\s+(bo\s+)?phim|danh\s+sach\s+phim|phim\s+(dang|sap)\s+chieu|phim\s+(gi|nao))\b/i.test(
            turnNoTone
          )
        ) {
          break;
        }

        if (!histMovie && userMatchedMovie) {
          histMovie = userMatchedMovie;
        }
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
          else if (/\bgold\s*class\b/i.test(turnNoTone)) histFormat = 'GOLD_CLASS';
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
    Boolean(resolved.hasExplicitAnaphora) ||
    /\b(bao\s+nhieu\s+tien|gia\s+ve|may\s+gio|noi\s+dung|thoi\s+luong|may\s+ve|how\s+many\s+seats|booking\s+link)\b/i.test(
      noTone
    );

  // Khi khách hỏi riêng suất chiếu theo giờ chính xác ("Còn 4 ghế liền nhau cho suất 21:15 không?") mà lịch sử không có phim khớp giờ đó thì không ép phim cũ
  const exactTimeConflictsWithHistMovie =
    resolved.timeFilter?.type === 'EXACT' &&
    histMovie &&
    Array.isArray(histMovie.showtimes) &&
    histMovie.showtimes.length > 0 &&
    !histMovie.showtimes.some((st) => st.time === resolved.timeFilter.exactTime);

  if (
    !resolved.matchedMovie &&
    !resolved.unmatchedMovieTitle &&
    histMovie &&
    !exactTimeConflictsWithHistMovie &&
    (isFollowUpIntent || hasAnaphoraReference) &&
    currentIntent !== INTENTS.MOVIE_SEARCH
  ) {
    resolved.matchedMovie = histMovie;
    resolved.movieTitle = histMovie.title;
    resolved.inheritedFromContext = true;
  }

  if (
    !resolved.dateFilter &&
    histDateFilter &&
    (isFollowUpIntent || hasAnaphoraReference) &&
    currentIntent !== INTENTS.MOVIE_SEARCH
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

  // Chỉ giữ contextShowtimeId khi cùng bộ phim (hoặc khách xin link/ghế của suất vừa trao đổi)
  if (
    histShowtimeId &&
    (!resolved.matchedMovie ||
      !histMovie ||
      String(resolved.matchedMovie._id) === String(histMovie._id))
  ) {
    resolved.contextShowtimeId = histShowtimeId;
    resolved.contextTime = histExactTime;
    resolved.contextRoom = histRoom;
  }

  let finalIntent = currentIntent;
  if (finalIntent === INTENTS.UNKNOWN && resolved.matchedMovie) {
    if (resolved.format === '3D') finalIntent = INTENTS.SHOWTIME_3D;
    else if (resolved.ticketQuantity) finalIntent = INTENTS.TICKET_PRICE;
    else if (resolved.movieDetailAspect || /\b(noi\s+dung|cot\s+truyen|dien\s+vien|dao\s+dien|thoi\s+luong)\b/i.test(noTone)) {
      finalIntent = INTENTS.MOVIE_DETAIL;
    } else finalIntent = INTENTS.SHOWTIME_SEARCH;
  }

  return {
    intent: finalIntent,
    entities: resolved,
  };
};
