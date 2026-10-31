import Faq from '../models/Faq.js';
import SupportTicket from '../models/SupportTicket.js';

// Lấy danh sách câu hỏi thường gặp (FAQ)
export const getFaqs = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } },
      ];
    }

    const faqs = await Faq.find(filter).sort({ order: 1, createdAt: 1 }).lean();

    res.json(faqs.map((f) => ({ ...f, id: f._id.toString() })));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách FAQ', error: error.message });
  }
};

// Đánh giá câu trả lời FAQ (Hữu ích / Không hữu ích)
export const voteFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'like' hoặc 'dislike'

    const updateField = type === 'like' ? { $inc: { likes: 1 } } : { $inc: { dislikes: 1 } };
    const updated = await Faq.findByIdAndUpdate(id, updateField, { new: true }).lean();

    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }

    res.json({
      success: true,
      likes: updated.likes,
      dislikes: updated.dislikes,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi đánh giá câu trả lời', error: error.message });
  }
};

// Khách gửi yêu cầu hỗ trợ sự cố
export const submitSupportTicket = async (req, res) => {
  try {
    const { fullName, contact, bookingCode, category, content } = req.body;

    if (!fullName || !contact || !content) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các thông tin bắt buộc (*)' });
    }

    // Sinh mã yêu cầu hỗ trợ duy nhất: SPT-XXXXXX-VN
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const ticketCode = `SPT-${randomCode}-VN`;

    const ticket = await SupportTicket.create({
      ticketCode,
      fullName: fullName.trim(),
      contact: contact.trim(),
      bookingCode: bookingCode ? bookingCode.trim() : '',
      category: category || 'Khác',
      content: content.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Gửi yêu cầu hỗ trợ thành công! Chuyên viên sẽ liên hệ lại bạn trong ~15 phút.',
      ticket: {
        id: ticket._id.toString(),
        ticketCode: ticket.ticketCode,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi yêu cầu hỗ trợ', error: error.message });
  }
};
