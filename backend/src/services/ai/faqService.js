import { INTENTS, removeVietnameseTones } from './intentService.js';

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Đánh giá và tìm câu trả lời FAQ từ cấu hình Admin.
 * - Không dùng `lower.includes()` đơn giản dễ bắt nhầm từ ngắn.
 * - Không cho phép FAQ tĩnh ghi đè các truy vấn nghiệp vụ động (tìm phim theo tuổi, tìm suất chiếu cụ thể,
 *   tính giá N vé, kiểm tra ghế liền nhau...).
 */
export const matchFaqRule = (message = '', faqs = [], intent = INTENTS.UNKNOWN, entities = {}) => {
  if (!message || !Array.isArray(faqs) || faqs.length === 0) {
    return null;
  }

  // Nếu người dùng đang hỏi nghiệp vụ cần truy xuất dữ liệu thực từ Database, ưu tiên xử lý theo Intent
  const hasTransactionalEntities = Boolean(
    entities.matchedMovie ||
      entities.unmatchedMovieTitle ||
      entities.dateFilter ||
      entities.timeFilter ||
      entities.ticketQuantity !== null ||
      entities.requireContiguousSeats ||
      entities.viewerAge !== null ||
      (Array.isArray(entities.genres) && entities.genres.length > 0)
  );

  const transactionalIntents = [
    INTENTS.SHOWTIME_SEARCH,
    INTENTS.SHOWTIME_3D,
    INTENTS.SEAT_AVAILABILITY,
    INTENTS.MOVIE_RECOMMENDATION,
    INTENTS.MOVIE_SEARCH,
    INTENTS.MOVIE_DETAIL,
  ];

  if (hasTransactionalEntities || transactionalIntents.includes(intent)) {
    return null;
  }

  const lower = String(message).toLowerCase().trim();
  const noTone = removeVietnameseTones(lower);

  let bestRule = null;
  let bestScore = 0;

  for (const rule of faqs) {
    if (!rule || rule.isActive === false || !rule.keywords || !rule.answer) continue;

    const rawKeywords = String(rule.keywords)
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length >= 2);

    if (rawKeywords.length === 0) continue;

    let ruleScore = 0;
    let matchedCount = 0;

    for (const kw of rawKeywords) {
      const kwNoTone = removeVietnameseTones(kw);
      const wordCount = kw.split(/\s+/).length;

      // Sử dụng ranh giới từ (\b) để tránh khớp một phần chữ không liên quan
      const exactRegex = new RegExp(`(?:^|\\s|[.,?!])${escapeRegex(kw)}(?:$|\\s|[.,?!])`, 'i');
      const noToneRegex = new RegExp(
        `(?:^|\\s|[.,?!])${escapeRegex(kwNoTone)}(?:$|\\s|[.,?!])`,
        'i'
      );

      if (exactRegex.test(lower)) {
        // Cụm nhiều từ có trọng số cao hơn từ đơn
        ruleScore += wordCount >= 2 ? wordCount * 3 : 1.5;
        matchedCount += 1;
      } else if (wordCount >= 2 && noToneRegex.test(noTone)) {
        ruleScore += wordCount * 2;
        matchedCount += 1;
      }
    }

    // Yêu cầu ngưỡng điểm tối thiểu (>= 3 điểm, tương đương ít nhất 1 cụm từ khóa >= 2 từ hoặc 2 từ khóa đơn khớp chính xác)
    if (matchedCount > 0 && ruleScore >= 3 && ruleScore > bestScore) {
      bestScore = ruleScore;
      bestRule = rule;
    }
  }

  if (!bestRule) return null;

  return {
    rule: bestRule,
    score: bestScore,
    category: bestRule.category || 'POLICY',
    answer: bestRule.answer,
  };
};

