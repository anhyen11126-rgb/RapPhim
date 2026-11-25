import mongoose from 'mongoose';

const quickChipSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    query: { type: String, required: true },
  },
  { _id: false }
);

const faqRuleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    keywords: { type: String, required: true }, // Chuỗi từ khóa cách nhau dấu phẩy, VD: "3d, kính 3d, reald 3d, phòng 5"
    category: {
      type: String,
      enum: ['SHOWTIME', 'PRICING', 'CONCESSION', 'PROMOTION', 'POLICY'],
      default: 'POLICY',
    },
    answer: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const aiConfigSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      default: 'MAIN_AI_CONFIG',
      unique: true,
    },
    botName: {
      type: String,
      default: "Trợ lý AI D'AVENOR",
    },
    botVersion: {
      type: String,
      default: 'Concierge v3.0',
    },
    welcomeMessage: {
      type: String,
      default:
        "Xin chào **{name}**! Mình là trợ lý tư vấn tại D'AVENOR Thanh Khê Plaza. Mình có thể hỗ trợ bạn tư vấn phim, tra cứu lịch chiếu, kiểm tra ghế trống, đặt vé và giải đáp chính sách rạp.",
    },
    systemPromptNote: {
      type: String,
      default:
        "Chỉ sử dụng dữ liệu thực tế từ MongoDB của cụm rạp D'AVENOR Thanh Khê Plaza (lịch chiếu, phòng chiếu, ghế trống, giá vé, combo và ưu đãi).",
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    quickChips: {
      type: [quickChipSchema],
      default: [],
    },
    faqs: {
      type: [faqRuleSchema],
      default: [
        {
          title: 'Chính sách đổi trả & hoàn vé',
          keywords: 'hoàn vé, trả vé, đổi vé, hủy vé, đổi suất chiếu',
          category: 'POLICY',
          answer:
            "📌 **Chính sách Đổi / Hoàn vé tại D'AVENOR Thanh Khê Plaza:**\n• Vé đã thanh toán thành công không áp dụng hoàn tiền mặt.\n• Hệ thống hỗ trợ **đổi sang suất chiếu khác** miễn phí nếu bạn báo trước giờ chiếu tối thiểu **60 phút** tại quầy dịch vụ hoặc liên hệ Hotline **1900 8899**.",
          isActive: true,
        },
        {
          title: 'Quy định độ tuổi xem phim (P, T13, T16, T18)',
          keywords: 'độ tuổi, t18, t16, t13, cccd, chứng minh thư, trẻ em mấy tuổi',
          category: 'POLICY',
          answer:
            "🔞 **Quy định phân loại độ tuổi theo Luật Điện Ảnh:**\n• **P**: Phim dành cho mọi lứa tuổi.\n• **T13**: Khán giả từ đủ 13 tuổi trở lên.\n• **T16**: Khán giả từ đủ 16 tuổi trở lên.\n• **T18**: Khán giả từ đủ 18 tuổi trở lên (vui lòng mang theo CCCD hoặc VNeID khi soát vé).",
          isActive: true,
        },
      ],
    },
  },
  { timestamps: true }
);

export default mongoose.model('AiConfig', aiConfigSchema);

