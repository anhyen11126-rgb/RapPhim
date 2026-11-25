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
  detectMessageLanguage,
  classifySecurityThreat,
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
  extractAuthenticatedUserFromHeader,
  lookupUserBookings,
  buildBookingLookupReply,
} from './ai/bookingLookupService.js';
import {
  shouldHandleSmartBookingFlow,
  handleSmartBookingTurn,
  createSupportHandoffTicketIfPossible,
} from './ai/smartBookingService.js';
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

export const getCinemaCurrentContext = async (options = {}) => {
  return fetchCinemaContextOptimized(options);
};

/**
 * Xây dựng thông báo từ chối bảo mật đúng chuẩn Mục 10.1, 10.2 và 10.3 (hỗ trợ tiếng Việt & tiếng Anh)
 */
const buildSecurityRefusalMessage = (threatType, lang = 'vi') => {
  const isEn = lang === 'en';
  if (threatType === 'API_KEY') {
    return isEn
      ? 'Sorry, I cannot provide API Keys, passwords, or internal system configuration details. I can help you check movies, showtimes, and book tickets!'
      : 'Xin lỗi, mình không thể cung cấp API Key, mật khẩu hoặc thông tin cấu hình nội bộ của hệ thống. Mình có thể hỗ trợ bạn tra cứu phim, lịch chiếu và đặt vé xem phim nhé!';
  }
  if (threatType === 'MONGODB_DATA') {
    return isEn
      ? 'Sorry, I cannot retrieve or disclose personal data of other customers or internal database records. I can only assist with information related to your own account and transactions.'
      : 'Xin lỗi, mình không thể truy xuất hoặc tiết lộ dữ liệu cá nhân của khách hàng khác. Mình chỉ có thể hỗ trợ các thông tin liên quan đến tài khoản và giao dịch của chính bạn.';
  }
  return isEn
    ? 'Sorry, I cannot ignore system rules, change my role, or reveal internal instructions. I can assist you with movies, showtimes, seat availability, and ticket bookings!'
    : 'Xin lỗi, mình không thể bỏ qua quy tắc hệ thống, thay đổi vai trò hoặc tiết lộ hướng dẫn nội bộ. Mình có thể hỗ trợ bạn tra cứu phim, lịch chiếu và đặt vé xem phim nhé!';
};

/**
 * Xử lý hội thoại AI chính:
 * Bảo mật 3 lớp + Nhận diện Song ngữ + Đa lượt (Multi-turn) + Đặt vé 6 bước + Đồng bộ MongoDB thực tế + Gemini Guardrails
 */
export const generateChatResponse = async (
  userMessage,
  history = [],
  userInfo = { userName: 'Khách vãng lai', userEmail: '' },
  options = {}
) => {
  const nowDate = options.nowDate instanceof Date ? options.nowDate : new Date();
  const skipLog = Boolean(options.skipLog);
  const prevSession =
    options.sessionContext && typeof options.sessionContext === 'object' ? options.sessionContext : {};

  // 1. Validate & Sanitize dữ liệu đầu vào
  const { cleanMessage, isTooLong, safeHistory, safeUserInfo } = validateAndSanitizeInput(
    userMessage,
    history,
    userInfo
  );

  const detectedLang = detectMessageLanguage(cleanMessage, prevSession.activeLanguage || 'vi');

  if (!cleanMessage) {
    return {
      success: true,
      reply:
        detectedLang === 'en'
          ? 'Please enter your question so I can help you check movies, showtimes, or seat availability!'
          : 'Bạn vui lòng nhập nội dung câu hỏi để mình hỗ trợ tra cứu phim, lịch chiếu hoặc ghế trống nhé!',
      intent: INTENTS.UNKNOWN,
      source: 'INPUT_VALIDATION',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      sessionContext: options.sessionContext || null,
    };
  }

  // 2. Chặn tấn công Bảo mật (Mục 10.1 API Key, 10.2 MongoDB Data, 10.3 Prompt Injection) ngay từ đầu
  const securityThreat = classifySecurityThreat(cleanMessage);
  if (securityThreat) {
    const safeRefusal = buildSecurityRefusalMessage(securityThreat, detectedLang);

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
      quickReplies: [],
      sessionContext: prevSession,
    };
  }

  // 3. Tải cấu hình Chatbot từ Database (hoặc mockConfig trong test)
  const botConfig = options.mockConfig || (await ensureAiConfig());

  if (botConfig && botConfig.isEnabled === false) {
    const maintenanceReply =
      detectedLang === 'en'
        ? "D'AVENOR AI Assistant is temporarily under maintenance. Please book tickets directly on our website or call **1900 8899**!"
        : "Hiện tại Trợ lý AI D'AVENOR đang tạm bảo trì. Bạn vui lòng đặt vé trực tiếp trên website hoặc liên hệ Hotline **1900 8899** nhé!";
    return {
      success: true,
      reply: maintenanceReply,
      intent: 'MAINTENANCE',
      source: 'SYSTEM_CONFIG',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      sessionContext: options.sessionContext || null,
    };
  }

  // 4. Lấy ngữ cảnh dữ liệu rạp chiếu thực tế từ MongoDB
  const needsDetailedSeats =
    Boolean(prevSession.bookingFlow?.active) ||
    /\b(liền\s+nhau|cạnh\s+nhau|sát\s+nhau|lien\s+nhau|canh\s+nhau|ghế\s+trống|ghe\s+trong|còn\s+ghế|con\s+ghe|còn\s+\d+\s+ghế|sơ\s+đồ\s+ghế|so\s+do\s+ghe|adjacent|next\s+to\s+each\s+other|side\s+by\s+side|together|contiguous|available\s+seats?|how\s+many\s+seats?|seat\s+map|muốn\s+đặt|muon\s+dat|want\s+to\s+book)\b/i.test(
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

  // Mục 12 & 15: Xử lý lỗi API hoặc trường hợp MongoDB không phản hồi (không tự tạo kết quả giả)
  if (contextData.dbError) {
    const dbErrReply =
      detectedLang === 'en'
        ? 'I am unable to load information from the system right now. Please try again in a few minutes!'
        : 'Hiện tại mình chưa thể tải được thông tin từ hệ thống. Bạn vui lòng thử lại sau ít phút nhé!';
    return {
      success: true,
      reply: dbErrReply,
      intent: INTENTS.UNKNOWN,
      source: 'DB_UNAVAILABLE',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      sessionContext: prevSession,
    };
  }

  // 5. Nhận diện Intent + Trích xuất Entities + Giải quyết ngữ cảnh nhiều lượt
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
    nowDate,
    options.sessionContext || null
  );

  // Xác thực người dùng từ JWT Backend (Mục 10.4: Không tin vào tự khai Admin/khách hàng từ client)
  const authUser =
    options.mockAuthUser !== undefined
      ? options.mockAuthUser
      : await extractAuthenticatedUserFromHeader(options.authHeader || '');

  // 5b. Xử lý tra cứu đơn đặt vé & lịch sử đặt vé (Mục 8.1, 8.2, 8.3 — Bắt buộc xác thực JWT, không gửi sang LLM)
  if (intent === INTENTS.BOOKING_LOOKUP) {
    const lookupResult = await lookupUserBookings({
      authUser,
      bookingCode: entities.bookingCode,
      mode: entities.bookingLookupMode || 'HISTORY',
      userMessage: cleanMessage,
      nowDate,
      mockBookings: options.mockBookings || null,
    });

    const bookingResponse = buildBookingLookupReply({
      lookupResult,
      bookingCode: entities.bookingCode,
      authUser,
      primaryCinema: contextData.primaryCinema,
      language: entities.language || detectedLang,
    });

    await saveChatLogSafe({
      userName: safeUserInfo.userName,
      userEmail: safeUserInfo.userEmail,
      userMessage: cleanMessage,
      botReply: bookingResponse.reply,
      intent: INTENTS.BOOKING_LOOKUP,
      source: 'BOOKING_AUTH_LOOKUP',
      recommendedMovie: '',
      skipLog,
    });

    return {
      success: true,
      reply: bookingResponse.reply,
      intent: INTENTS.BOOKING_LOOKUP,
      source: 'BOOKING_AUTH_LOOKUP',
      movieCard: null,
      movieCards: [],
      quickReplies: [],
      sessionContext: {
        ...prevSession,
        activeLanguage: entities.language || detectedLang,
      },
    };
  }

  // 5c. Xử lý Quy trình đặt vé thông minh 6 bước (Mục 7)
  if (shouldHandleSmartBookingFlow({ intent, entities, sessionContext: prevSession })) {
    const flowResult = await handleSmartBookingTurn({
      userMessage: cleanMessage,
      entities,
      contextData,
      sessionContext: prevSession,
      authUser,
      nowDate,
      mockBookingExecutor: options.mockBookingExecutor || null,
    });

    const nextFlowSession = {
      ...prevSession,
      activeLanguage: entities.language || detectedLang,
      activeMovieId: flowResult.bookingFlow?.movieId || null,
      activeShowtimeId: flowResult.bookingFlow?.showtimeId || null,
      bookingFlow: flowResult.bookingFlow,
    };

    await saveChatLogSafe({
      userName: safeUserInfo.userName,
      userEmail: safeUserInfo.userEmail,
      userMessage: cleanMessage,
      botReply: flowResult.reply,
      intent: INTENTS.BOOKING_GUIDE,
      source: 'SMART_BOOKING_FLOW',
      recommendedMovie: flowResult.bookingFlow?.movieTitle || '',
      skipLog,
    });

    return {
      success: true,
      reply: flowResult.reply,
      intent: INTENTS.BOOKING_GUIDE,
      source: 'SMART_BOOKING_FLOW',
      movieCard: flowResult.movieCard || null,
      movieCards: flowResult.movieCards || [],
      quickReplies: [],
      sessionContext: nextFlowSession,
    };
  }

  // 6. Kiểm tra FAQ do Admin huấn luyện (chỉ khớp khi độ tin cậy cao và không đè lên truy vấn động)
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
      quickReplies: [],
      sessionContext: {
        ...prevSession,
        activeLanguage: entities.language || detectedLang,
      },
    };
  }

  // 6b. Nếu khách yêu cầu gặp nhân viên hỗ trợ (Mục 9.5) và đã đăng nhập -> tạo phiếu chuyển tiếp hội thoại thật
  let handoffTicket = null;
  if (intent === INTENTS.CUSTOMER_SUPPORT && entities.policySubType === 'LIVE_AGENT') {
    handoffTicket = await createSupportHandoffTicketIfPossible({
      authUser,
      userMessage: cleanMessage,
      safeHistory,
    });
  }

  // 7. Xây dựng câu trả lời xác thực từ Database
  const dbVerified = buildVerifiedDatabaseResponse({
    userMessage: cleanMessage,
    intent,
    entities,
    contextData,
    userInfo: safeUserInfo,
    nowDate,
    handoffTicket,
  });

  const resolvedMovieCards =
    Array.isArray(dbVerified.movieCards) && dbVerified.movieCards.length > 0
      ? dbVerified.movieCards
      : dbVerified.movieCard
        ? [dbVerified.movieCard]
        : [];

  const nextMovieIds =
    resolvedMovieCards.length > 0
      ? resolvedMovieCards.map((c) => c.movieId).filter(Boolean)
      : Array.isArray(prevSession.lastMovieIds)
        ? prevSession.lastMovieIds
        : [];

  // Chỉ lưu activeMovieId / activeShowtimeId khi lượt hội thoại thực sự xoay quanh ĐÚNG 1 bộ phim cụ thể!
  // Nếu là câu hỏi chung toàn rạp (isGeneralScopeQuery) hoặc trả về danh sách nhiều phim -> reset về null để tránh nhiễm ngữ cảnh sang câu sau.
  const isSingleMovieTurn =
    !entities.isGeneralScopeQuery &&
    intent !== INTENTS.MOVIE_SEARCH &&
    intent !== INTENTS.MOVIE_RECOMMENDATION &&
    (Boolean(entities.matchedMovie) || resolvedMovieCards.length === 1);

  const nextActiveMovieId = isSingleMovieTurn
    ? String(entities.matchedMovie?._id || resolvedMovieCards[0]?.movieId || '') || null
    : null;

  const nextActiveShowtimeId = isSingleMovieTurn
    ? dbVerified.movieCard?.showtimeId || entities.contextShowtimeId || null
    : null;

  const nextSessionContext = {
    activeLanguage: entities.language || detectedLang,
    activeMovieId: nextActiveMovieId,
    activeCinema: entities.cinemaLocation || prevSession.activeCinema || null,
    activeDateFilter: isSingleMovieTurn ? entities.dateFilter || prevSession.activeDateFilter || null : null,
    activeTimeFilter: isSingleMovieTurn ? entities.timeFilter || null : null,
    activeFormat: isSingleMovieTurn ? entities.format || null : null,
    activeShowtimeId: nextActiveShowtimeId,
    lastMovieIds: nextMovieIds,
    bookingFlow: null,
  };

  // 8. Kết hợp Gemini AI khi câu hỏi mở (UNKNOWN) hoặc khi có customGeminiCaller
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
          quickReplies: [],
          sessionContext: nextSessionContext,
        };
      }
    } catch (geminiErr) {
      console.warn('[AiService] Lỗi gọi Gemini, chuyển sang Database Fallback:', geminiErr.message);
    }

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
      quickReplies: [],
      sessionContext: nextSessionContext,
    };
  }

  // 9. Trả về phản hồi xác thực trực tiếp từ Database
  const lengthNotice = isTooLong
    ? detectedLang === 'en'
      ? '\n\n*(Note: Your message was quite long, so the system summarized the key part for fast processing)*'
      : '\n\n*(Lưu ý: Tin nhắn của bạn khá dài nên hệ thống đã tóm lược phần nội dung chính để xử lý nhanh nhất)*'
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
    quickReplies: [],
    sessionContext: nextSessionContext,
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
  detectMessageLanguage,
  classifySecurityThreat,
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
