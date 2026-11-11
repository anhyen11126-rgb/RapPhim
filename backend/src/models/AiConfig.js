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
        "Xin chào **{name}**! Tôi là trợ lý ảo D'AVENOR CINEMA tại Đà Nẵng. Tôi có thể giúp bạn tìm phim bom tấn, tra cứu lịch chiếu 2D / RealD 3D / IMAX, báo giá vé chính xác theo suất chiếu hoặc gợi ý combo bắp nước & mã voucher giảm giá! 🍿 ✨",
    },
    systemPromptNote: {
      type: String,
      default:
        "Ưu tiên giới thiệu hệ thống cụm rạp D'AVENOR tại Đà Nẵng (Thanh Khê Plaza, Vincom Ngô Quyền, Hải Châu Center) dựa trên dữ liệu lịch chiếu, giá vé và ghế trống thực tế từ hệ thống.",
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    quickChips: {
      type: [quickChipSchema],
      default: [
        {
          label: '🎬 Top phim tuần này',
          query: "Cho tôi xem top phim bom tấn hay nhất đang chiếu tại D'AVENOR CINEMA",
        },
        {
          label: '👓 Suất chiếu 3D hôm nay',
          query: 'Hôm nay có những suất chiếu 3D nào và giá vé bao nhiêu?',
        },
        {
          label: '🎟️ Giá vé & IMAX tối nay',
          query: 'Tối nay sau 19h có suất chiếu IMAX nào đẹp và giá vé các hạng ghế là bao nhiêu?',
        },
        {
          label: '🍿 Combo bắp nước & Ưu đãi',
          query: 'Cho mình xem bảng giá Combo bắp nước và các mã Voucher khuyến mãi đang áp dụng nhé!',
        },
      ],
    },
    faqs: {
      type: [faqRuleSchema],
      default: [
        {
          title: 'Chính sách đổi trả & hoàn vé',
          keywords: 'hoàn vé, trả vé, đổi vé, hủy vé, đổi suất chiếu',
          category: 'POLICY',
          answer:
            "📌 **Chính sách Đổi / Hoàn vé tại D'AVENOR CINEMA:**\n• Vé đã thanh toán không áp dụng hoàn tiền mặt.\n• Tuy nhiên, hệ thống hỗ trợ **đổi sang suất chiếu khác** miễn phí nếu bạn báo trước giờ chiếu tối thiểu **60 phút** tại quầy dịch vụ D'AVENOR Thanh Khê Plaza hoặc liên hệ Hotline **1900 6868**.",
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
        {
          title: 'Gửi xe & Tiện ích tại cụm rạp Đà Nẵng',
          keywords: 'gửi xe, đỗ xe, bãi xe, tầng mấy, ở đâu, địa chỉ rạp',
          category: 'POLICY',
          answer:
            "📍 **Hệ thống cụm rạp D'AVENOR tại Đà Nẵng & Tiện ích:**\n• **D'AVENOR Thanh Khê Plaza**: Tầng 4–5 TTTM Thanh Khê Plaza, 279 Điện Biên Phủ, Q. Thanh Khê, Đà Nẵng.\n• **D'AVENOR Vincom Ngô Quyền**: Tầng 4 Vincom Plaza, 910A Ngô Quyền, Q. Sơn Trà, Đà Nẵng.\n• **D'AVENOR Hải Châu Center**: Tầng 5 Indochina Riverside, 74 Bạch Đằng, Q. Hải Châu, Đà Nẵng.\n• **Miễn phí 100% vé gửi xe máy & giảm 50% phí đỗ ô tô** tại hầm B1–B2 khi xuất trình cuống vé điện tử QR!",
          isActive: true,
        },
      ],
    },
  },
  { timestamps: true }
);

export default mongoose.model('AiConfig', aiConfigSchema);

