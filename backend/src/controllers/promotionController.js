import Promotion from '../models/Promotion.js';

// Lấy danh sách toàn bộ khuyến mãi & voucher từ Database
export const getPromotions = async (req, res) => {
  try {
    const { category, search } = req.query;

    // 1. Lấy Hero Deal nổi bật nhất
    const heroDeal = await Promotion.findOne({ type: 'HERO_DEAL', isActive: true }).lean();

    // 2. Lấy danh sách Voucher đổi thưởng
    const vouchers = await Promotion.find({ type: 'VOUCHER', isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    // 3. Lọc danh sách chương trình khuyến mãi nổi bật
    const programFilter = { type: 'PROGRAM', isActive: true };

    if (category && category !== 'ALL') {
      programFilter.category = category;
    }

    if (search) {
      programFilter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const programs = await Promotion.find(programFilter)
      .sort({ order: 1, createdAt: -1 })
      .lean();

    // 4. Thống kê số lượng từng danh mục cho thanh Tabs
    const totalCount = await Promotion.countDocuments({ type: 'PROGRAM', isActive: true });
    const ticketCount = await Promotion.countDocuments({ type: 'PROGRAM', category: 'TICKET', isActive: true });
    const concessionCount = await Promotion.countDocuments({ type: 'PROGRAM', category: 'CONCESSION', isActive: true });
    const studentCount = await Promotion.countDocuments({ type: 'PROGRAM', category: 'STUDENT', isActive: true });
    const paymentCount = await Promotion.countDocuments({ type: 'PROGRAM', category: 'PAYMENT', isActive: true });

    res.json({
      heroDeal: heroDeal ? { ...heroDeal, id: heroDeal._id.toString() } : null,
      vouchers: vouchers.map((v) => ({ ...v, id: v._id.toString() })),
      programs: programs.map((p) => ({ ...p, id: p._id.toString() })),
      counts: {
        all: totalCount,
        ticket: ticketCount,
        concession: concessionCount,
        student: studentCount,
        payment: paymentCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách khuyến mãi', error: error.message });
  }
};

// Kiểm tra và áp dụng mã voucher
export const applyVoucher = async (req, res) => {
  try {
    const { code, totalAmount } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Vui lòng nhập mã voucher' });
    }

    const voucher = await Promotion.findOne({
      code: code.toUpperCase().trim(),
      type: 'VOUCHER',
      isActive: true,
    });

    if (!voucher) {
      return res.status(404).json({ message: 'Mã voucher không tồn tại hoặc đã hết hạn' });
    }

    res.json({
      success: true,
      message: `Áp dụng thành công mã: ${voucher.code}`,
      voucher: {
        id: voucher._id.toString(),
        code: voucher.code,
        discountValue: voucher.discountValue,
        description: voucher.description,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi áp dụng voucher', error: error.message });
  }
};

// Tạo khuyến mãi mới (Admin)
export const createPromotion = async (req, res) => {
  try {
    const newPromo = await Promotion.create(req.body);
    res.status(201).json({
      ...newPromo.toObject(),
      id: newPromo._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo chương trình khuyến mãi', error: error.message });
  }
};

