import mongoose from 'mongoose';
import AiConfig from '../models/AiConfig.js';
import AiChatLog from '../models/AiChatLog.js';
import {
  VN_TIMEZONE,
  getVNDateParts,
  createVNDate,
  getVNDayBounds,
  getRelativeDayLabel,
  parseVietnameseDateFromText,
  parseTimeFilterFromText,
} from './ai/timezoneUtils.js';
import {
  formatVND,
  detectShowtimeFormat,
  getFormatDisplayLabel,
  calculateShowtimePrices,
  resolveDisplayPrice,
  calculateTicketQuote,
} from './ai/pricingService.js';
import {
  INTENTS,
  MAX_USER_MESSAGE_LENGTH,
  validateAndSanitizeInput,
  detectPromptInjection,
  matchMovieFromText,
  extractEntities,
  classifyIntent,
  resolveMultiTurnContext,
} from './ai/intentService.js';
import { matchFaqRule } from './ai/faqService.js';
import {
  isSeatAvailableAt,
  findContiguousAvailableSeats,
  isValidShowtimeForBooking,
  buildValidBookingLink,
  isPromotionValid,
  buildNormalizedCinemaContext,
  fetchCinemaContextOptimized,
} from './ai/cinemaContextService.js';
import {
  buildSafeMovieCard,
  buildInteractiveMovieCards,
  buildInteractiveCardsFromPairs,
  filterShowtimesByEntities,
  buildVerifiedDatabaseResponse,
} from './ai/responseBuilder.js';
import {
  buildSelectivePromptContext,
  buildSystemInstruction,
  validateAndSanitizeAiReply,
  callGeminiWithGuardrails,
} from './ai/geminiService.js';

const DEFAULT_CONFIG_FALLBACK = {
  botName: "Trợ lý AI D'AVENOR",
  botVersion: 'Concierge v3.0',
  isEnabled: true,
  systemPromptNote: '',
  faqs: [],
  quickChips: [],
};

/**
 * Đảm bảo luôn có 1 bản ghi cấu hình AI mặc định trong Database
 */
export const ensureAiConfig = async () => {
  if (mongoose.connection.readyState !== 1) {
    return DEFAULT_CONFIG_FALLBACK;
  }
  try {
    let config = await AiConfig.findOne({ configKey: 'MAIN_AI_CONFIG' });
    if (!config) {
      config = await AiConfig.create({ configKey: 'MAIN_AI_CONFIG' });
    }
    return config;
  } catch (err) {
    console.warn('[AiService] Không thể đọc AiConfig từ DB, dùng cấu hình mặc định:', err.message);
    return DEFAULT_CONFIG_FALLBACK;
  }
};

/**
 * Lưu lịch sử chat vào Database để Admin theo dõi & huấn luyện (Non-blocking, an toàn tuyệt đối)
 */
const saveChatLogSafe = async ({
  userName,
  userEmail,
  userMessage,
  botReply,
  intent,
  source,
  recommendedMovie,
  skipLog = false,
}) => {
  if (skipLog || mongoose.connection.readyState !== 1) return;
  try {
    await AiChatLog.create({
      userName: String(userName || 'Khách vãng lai').slice(0, 60),
      userEmail: String(userEmail || '').slice(0, 100),
      userMessage: String(userMessage || '').slice(0, MAX_USER_MESSAGE_LENGTH),
      botReply: String(botReply || '').slice(0, 4000),
      intent: String(intent || INTENTS.UNKNOWN),
      source: String(source || 'DATABASE_RAG'),
      recommendedMovie: String(recommendedMovie || '').slice(0, 150),
    });
  } catch (err) {
    console.warn('[AiService] Không thể lưu AiChatLog:', err.message);
  }
};

/**
 * Lấy toàn bộ ngữ cảnh thực tế từ MongoDB (Phim, Suất chiếu, Ghế trống, Combo, Khuyến mãi)
 * - Đã loại bỏ hoàn toàn logic tự tạo suất chiếu 3D giả
 * - Đã sửa lỗi `availableSeatsCount || 42`
 * - Đã loại bỏ N+1 queries bằng batch query & aggregation
 * - Đã lọc bỏ các suất chiếu đã qua (`startTime <= now`)
 */
export const getCinemaCurrentContext = async (options = {}) => {
  return fetchCinemaContextOptimized(options);
};

/**
 * Xử lý hội thoại AI chính:
 * Kết hợp Security Guard + Intent/Entity Detection + Multi-turn Context + Database Verification + Gemini AI
 * Giữ nguyên cấu trúc API Response tương thích 100% với Frontend:
 * `{ success, reply, intent, source, movieCard }`
 */
export const generateChatResponse = async (
  userMessage,
  history = [],
  userInfo = { userName: 'Khách vãng lai', userEmail: '' },
  options = {}
) => {
  const nowDate = options.nowDate instanceof Date ? options.nowDate : new Date();
  const skipLog = Boolean(options.skipLog);

  // 1. Validate & Sanitize dữ liệu đầu vào
  const { cleanMessage, isTooLong, safeHistory, safeUserInfo } = validateAndSanitizeInput(
    userMessage,
    history,
    userInfo
  );

  if (!cleanMessage) {
    return {
      success: true,
      reply: 'Bạn vui lòng nhập nội dung câu hỏi để mình có thể hỗ trợ tra cứu lịch chiếu, giá vé hoặc ghế trống nhé!',
      intent: INTENTS.UNKNOWN,
      source: 'INPUT_VALIDATION',
      movieCard: null,
      movieCards: [],
    };
  }

  // 2. Chặn tấn công Prompt Injection ngay từ đầu
  if (detectPromptInjection(cleanMessage)) {
    const safeRefusal =
      "Xin lỗi bạn, tôi chỉ có thể hỗ trợ tư vấn phim, lịch chiếu, giá vé, ghế trống, combo bắp nước và khuyến mãi hợp lệ theo đúng dữ liệu của **D'AVENOR CINEMA**. Tôi không thể bỏ qua quy tắc hệ thống, tiết lộ cấu hình nội bộ hoặc tạo dữ liệu giao dịch giả.";

    await saveChatLogSafe({
      userName: safeUserInfo.userName,
      userEmail: safeUserInfo.userEmail,
      userMessage: cleanMessage,
      botReply: safeRefusal,
      intent: INTENTS.UNKNOWN,
      source: 'SECURITY_GUARD',
      recommendedMovie: '',
      skipLog,
    });

    return {
      success: true,
      reply: safeRefusal,
      intent: INTENTS.UNKNOWN,
      source: 'SECURITY_GUARD',
      movieCard: null,
      movieCards: [],
    };
  }

  // 3. Tải cấu hình Chatbot từ Database (hoặc mockConfig trong test)
  const botConfig = options.mockConfig || (await ensureAiConfig());

  if (botConfig && botConfig.isEnabled === false) {
    const maintenanceReply =
      "Hiện tại Trợ lý AI D'AVENOR đang tạm bảo trì để nâng cấp dữ liệu lịch chiếu. Bạn vui lòng đặt vé trực tiếp tại trang chủ hoặc liên hệ Hotline **1900 6868** nhé!";
    return {
      success: true,
      reply: maintenanceReply,
      intent: 'MAINTENANCE',
      source: 'SYSTEM_CONFIG',
      movieCard: null,
      movieCards: [],
    };
  }

  // 4. Lấy ngữ cảnh dữ liệu rạp chiếu thực tế
  const needsDetailedSeats =
    /\b(liền\s+nhau|cạnh\s+nhau|sát\s+nhau|ghế\s+trống|còn\s+ghế|còn\s+\d+\s+ghế|sơ\s+đồ\s+ghế)\b/i.test(
      cleanMessage
    );

  let contextData;
  if (options.mockContext) {
    contextData = options.mockContext.nowIso
      ? options.mockContext
      : buildNormalizedCinemaContext({ ...options.mockContext, nowDate });
  } else {
    contextData = await fetchCinemaContextOptimized({
      nowDate,
      includeSeatDetails: needsDetailedSeats,
    });
  }

  // 5. Nhận diện Intent + Trích xuất Entities + Giải quyết ngữ cảnh nhiều lượt (Multi-turn)
  const rawEntities = extractEntities(
    cleanMessage,
    contextData.movies,
    contextData.cinemas,
    nowDate
  );
  const rawIntent = classifyIntent(cleanMessage, rawEntities);
  const { intent, entities } = resolveMultiTurnContext(
    cleanMessage,
    rawIntent,
    rawEntities,
    safeHistory,
    contextData.movies,
    nowDate
  );

  // 6. Kiểm tra FAQ do Admin huấn luyện (chỉ khớp khi độ tin cậy cao và không đè lên truy vấn giao dịch động)
  const matchedFaq = matchFaqRule(cleanMessage, botConfig?.faqs || [], intent, entities);
  if (matchedFaq) {
    await saveChatLogSafe({
      userName: safeUserInfo.userName,
      userEmail: safeUserInfo.userEmail,
      userMessage: cleanMessage,
      botReply: matchedFaq.answer,
      intent: matchedFaq.category || intent,
      source: 'ADMIN_FAQ_TRAINING',
      recommendedMovie: '',
      skipLog,
    });

    return {
      success: true,
      reply: matchedFaq.answer,
      intent: matchedFaq.category || intent,
      source: 'ADMIN_FAQ_TRAINING',
      movieCard: null,
      movieCards: [],
    };
  }

  // 7. Xây dựng câu trả lời xác thực từ Database
  const dbVerified = buildVerifiedDatabaseResponse({
    userMessage: cleanMessage,
    intent,
    entities,
    contextData,
    userInfo: safeUserInfo,
    nowDate,
  });

  const resolvedMovieCards =
    Array.isArray(dbVerified.movieCards) && dbVerified.movieCards.length > 0
      ? dbVerified.movieCards
      : dbVerified.movieCard
        ? [dbVerified.movieCard]
        : [];

  // 8. Kết hợp Gemini AI khi câu hỏi mở (UNKNOWN) hoặc khi có customGeminiCaller cần diễn đạt tự nhiên
  const shouldInvokeGemini =
    typeof options.customGeminiCaller === 'function' ||
    (intent === INTENTS.UNKNOWN &&
      !entities.unmatchedMovieTitle &&
      Boolean(process.env.GEMINI_API_KEY) &&
      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');

  if (shouldInvokeGemini) {
    try {
      const geminiReply = await callGeminiWithGuardrails({
        userMessage: cleanMessage,
        safeHistory,
        botConfig,
        userInfo: safeUserInfo,
        contextData,
        intent,
        entities,
        customGeminiCaller: options.customGeminiCaller,
      });

      if (geminiReply && geminiReply.trim().length > 0) {
        await saveChatLogSafe({
          userName: safeUserInfo.userName,
          userEmail: safeUserInfo.userEmail,
          userMessage: cleanMessage,
          botReply: geminiReply,
          intent,
          source: 'GEMINI_RAG',
          recommendedMovie: dbVerified.recommendedMovie || '',
          skipLog,
        });

        return {
          success: true,
          reply: geminiReply,
          intent,
          source: 'GEMINI_RAG',
          movieCard: dbVerified.movieCard,
          movieCards: resolvedMovieCards,
        };
      }
    } catch (geminiErr) {
      console.warn('[AiService] Lỗi gọi Gemini, chuyển sang Database Fallback:', geminiErr.message);
    }

    // Khi Gemini lỗi / timeout / trả về rỗng -> Dùng kết quả xác thực từ Database (DATABASE_FALLBACK)
    await saveChatLogSafe({
      userName: safeUserInfo.userName,
      userEmail: safeUserInfo.userEmail,
      userMessage: cleanMessage,
      botReply: dbVerified.reply,
      intent,
      source: 'DATABASE_FALLBACK',
      recommendedMovie: dbVerified.recommendedMovie || '',
      skipLog,
    });

    return {
      success: true,
      reply: dbVerified.reply,
      intent,
      source: 'DATABASE_FALLBACK',
      movieCard: dbVerified.movieCard,
      movieCards: resolvedMovieCards,
    };
  }

  // 9. Trả về phản hồi xác thực trực tiếp từ Database
  const lengthNotice = isTooLong
    ? '\n\n*(Lưu ý: Tin nhắn của bạn khá dài nên hệ thống đã tóm lược phần nội dung chính để xử lý nhanh nhất)*'
    : '';
  const finalReply = `${dbVerified.reply}${lengthNotice}`;

  await saveChatLogSafe({
    userName: safeUserInfo.userName,
    userEmail: safeUserInfo.userEmail,
    userMessage: cleanMessage,
    botReply: finalReply,
    intent,
    source: 'DATABASE_RAG',
    recommendedMovie: dbVerified.recommendedMovie || '',
    skipLog,
  });

  return {
    success: true,
    reply: finalReply,
    intent,
    source: 'DATABASE_RAG',
    movieCard: dbVerified.movieCard,
    movieCards: resolvedMovieCards,
  };
};

// Export thêm các hàm nội bộ phục vụ kiểm thử Unit / Integration Tests
export {
  VN_TIMEZONE,
  INTENTS,
  getVNDateParts,
  createVNDate,
  getVNDayBounds,
  getRelativeDayLabel,
  parseVietnameseDateFromText,
  parseTimeFilterFromText,
  formatVND,
  detectShowtimeFormat,
  calculateShowtimePrices,
  resolveDisplayPrice,
  calculateTicketQuote,
  validateAndSanitizeInput,
  detectPromptInjection,
  matchMovieFromText,
  extractEntities,
  classifyIntent,
  resolveMultiTurnContext,
  matchFaqRule,
  isSeatAvailableAt,
  findContiguousAvailableSeats,
  isValidShowtimeForBooking,
  buildValidBookingLink,
  isPromotionValid,
  buildNormalizedCinemaContext,
  buildSafeMovieCard,
  buildInteractiveMovieCards,
  buildInteractiveCardsFromPairs,
  filterShowtimesByEntities,
  buildVerifiedDatabaseResponse,
  buildSelectivePromptContext,
  buildSystemInstruction,
  validateAndSanitizeAiReply,
};
