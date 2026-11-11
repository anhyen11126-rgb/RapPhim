import { generateChatResponse, getCinemaCurrentContext, ensureAiConfig } from '../services/aiService.js';

export const chatWithAI = async (req, res) => {
  try {
    const { message, history, userName, userEmail } = req.body || {};

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
      }
    );
    res.json(aiResult);
  } catch (error) {
    console.error('[AiController] Lỗi khi xử lý hội thoại AI:', error.message);
    res.status(500).json({
      success: false,
      message: 'Hệ thống Trợ lý AI đang bận, vui lòng thử lại sau giây lát.',
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
      quickChips: config.quickChips,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy cấu hình Chatbot AI', error: error.message });
  }
};
