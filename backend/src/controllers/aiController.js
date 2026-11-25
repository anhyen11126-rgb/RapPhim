import { generateChatResponse, getCinemaCurrentContext, ensureAiConfig } from '../services/aiService.js';

// Giới hạn tần suất gửi tin nhắn nhẹ chống spam API (tối đa 25 lượt / 60 giây mỗi IP)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 25;
const chatRateLimitMap = new Map();

const isRateLimited = (clientKey) => {
  const now = Date.now();
  const timestamps = (chatRateLimitMap.get(clientKey) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    chatRateLimitMap.set(clientKey, timestamps);
    return true;
  }
  timestamps.push(now);
  chatRateLimitMap.set(clientKey, timestamps);
  return false;
};

export const chatWithAI = async (req, res) => {
  try {
    const clientIp = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đang gửi tin nhắn hơi nhanh, vui lòng đợi vài giây rồi thử lại nhé!',
      });
    }

    const { message, history, userName, userEmail, sessionContext } = req.body || {};

    if (typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp nội dung câu hỏi',
      });
    }

    const aiResult = await generateChatResponse(
      message,
      Array.isArray(history) ? history : [],
      {
        userName: userName || 'Khách vãng lai',
        userEmail: userEmail || '',
      },
      {
        sessionContext: sessionContext && typeof sessionContext === 'object' ? sessionContext : null,
        authHeader: req.headers.authorization || '',
      }
    );
    res.json(aiResult);
  } catch (error) {
    console.error('[AiController] Lỗi khi xử lý hội thoại AI:', error.message);
    res.status(500).json({
      success: false,
      reply: 'Hiện tại mình chưa thể tải được thông tin từ hệ thống. Bạn vui lòng thử lại sau ít phút nhé!',
      message: 'Hiện tại mình chưa thể tải được thông tin từ hệ thống. Bạn vui lòng thử lại sau ít phút nhé!',
    });
  }
};

export const getAIContext = async (req, res) => {
  try {
    const context = await getCinemaCurrentContext();
    res.json(context);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy ngữ cảnh AI', error: error.message });
  }
};

export const getPublicAiConfig = async (req, res) => {
  try {
    const config = await ensureAiConfig();
    res.json({
      botName: config.botName,
      botVersion: config.botVersion,
      welcomeMessage: config.welcomeMessage,
      isEnabled: config.isEnabled,
      quickChips: [],
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy cấu hình Chatbot AI', error: error.message });
  }
};
