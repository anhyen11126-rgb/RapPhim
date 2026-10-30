import { generateChatResponse, getCinemaCurrentContext } from '../services/aiService.js';

export const chatWithAI = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'Vui lòng cung cấp nội dung câu hỏi' });
    }

    const aiResult = await generateChatResponse(message, history || []);
    res.json(aiResult);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xử lý hội thoại AI', error: error.message });
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

