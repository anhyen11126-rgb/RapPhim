import Promotion from '../models/Promotion.js';

export const resolvePromotionVisuals = (p = {}) => {
  const title = (p.title || '').toLowerCase();
  const currentImg = p.image || '';
  const isOldUnsplash = !currentImg || currentImg.includes('images.unsplash.com');

  let defaultImage = currentImg || '/images/promotions/promo-happy-day.png';
  let badgeTop = p.badgeTop || '';
  let conditions = p.conditions || '';
  let description = p.description || '';

  // Đồng bộ tên rạp về cụm rạp duy nhất D'AVENOR Thanh Khê Plaza
  if (badgeTop.includes('Landmark 81')) {
    badgeTop = "📍 D'AVENOR Thanh Khê Plaza";
  }
  if (conditions.includes('Landmark 81')) {
    conditions = conditions.replace(/Landmark 81/g, "D'AVENOR Thanh Khê Plaza");
  }
  if (description.includes('MovieTix')) {
    description = description.replace(/MovieTix/g, "D'AVENOR");
  }

  if (p.type === 'HERO_DEAL') {
    if (isOldUnsplash) defaultImage = '/images/combos/combo-couple.png';
  } else if (title.includes('happy day') || title.includes('thứ 4') || title.includes('50k')) {
    if (isOldUnsplash) defaultImage = '/images/promotions/promo-happy-day.png';
  } else if (title.includes('avatar') || title.includes('combo') || title.includes('ly vip')) {
    if (isOldUnsplash) defaultImage = '/images/promotions/promo-avatar-combo.png';
  } else if (title.includes('prime') || title.includes('hội viên') || title.includes('điểm')) {
    if (isOldUnsplash) defaultImage = '/images/promotions/promo-vip-prime.png';
  } else if (title.includes('học sinh') || title.includes('sinh viên') || title.includes('u22')) {
    if (isOldUnsplash) defaultImage = '/images/promotions/promo-student-u22.png';
  } else if (title.includes('vnpay') || title.includes('qr') || title.includes('25.000')) {
    if (isOldUnsplash) defaultImage = '/images/promotions/promo-vnpay-qr.png';
  } else if (title.includes('imax') || title.includes('gold class')) {
    if (isOldUnsplash) defaultImage = '/images/promotions/promo-imax-gold.png';
  }

  return {
    image: defaultImage,
    badgeTop,
    conditions,
    description,
  };
};

let hasSyncedPromos = false;

export const ensureCleanPromotions = async () => {
  if (hasSyncedPromos) return;
  try {
    const allPromos = await Promotion.find({});
    for (const doc of allPromos) {
      const resolved = resolvePromotionVisuals(doc);
      let changed = false;
      if (doc.image !== resolved.image) {
        doc.image = resolved.image;
        changed = true;
      }
      if (doc.badgeTop !== resolved.badgeTop) {
        doc.badgeTop = resolved.badgeTop;
        changed = true;
      }
      if (doc.conditions !== resolved.conditions) {
        doc.conditions = resolved.conditions;
        changed = true;
      }
      if (doc.description !== resolved.description) {
        doc.description = resolved.description;
        changed = true;
      }
      if (doc.title && doc.title.includes('MovieTix')) {
        doc.title = doc.title.replace(/MovieTix/g, "D'AVENOR");
        changed = true;
      }
      if (changed) {
        await doc.save();
      }
    }
    hasSyncedPromos = true;
  } catch (err) {
    console.warn('Promotion sync warning:', err.message);
  }
};

// Lấy danh sách toàn bộ khuyến mãi & voucher từ Database
export const getPromotions = async (req, res) => {
  try {
    await ensureCleanPromotions();
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
      heroDeal: heroDeal
        ? { ...heroDeal, ...resolvePromotionVisuals(heroDeal), id: heroDeal._id.toString() }
        : null,
      vouchers: vouchers.map((v) => ({
        ...v,
        ...resolvePromotionVisuals(v),
        id: v._id.toString(),
      })),
      programs: programs.map((p) => ({
        ...p,
        ...resolvePromotionVisuals(p),
        id: p._id.toString(),
      })),
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

    let discountAmount = 20000;
    const dv = voucher.discountValue || '';
    if (dv.includes('30K') || dv.includes('30.000')) {
      discountAmount = 30000;
    } else if (dv.includes('20K') || dv.includes('20.000')) {
      discountAmount = 20000;
    } else if (dv.includes('45.000')) {
      discountAmount = 45000;
    } else if (dv.includes('%')) {
      const match = dv.match(/(\d+)%/);
      const percent = match ? parseInt(match[1], 10) : 10;
      discountAmount = Math.round(((totalAmount || 100000) * percent) / 100);
    }

    res.json({
      success: true,
      message: `Áp dụng thành công mã: ${voucher.code}`,
      discountAmount,
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
