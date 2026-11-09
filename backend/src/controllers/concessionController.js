import Concession from '../models/Concession.js';

export const resolveConcessionVisuals = (c = {}) => {
  const name = (c.name || '').toLowerCase();
  const currentImg = c.image || c.imageUrl || '';
  const isGenericOrOld =
    !currentImg ||
    currentImg.includes('photo-1578849278619-e73505e9610f') ||
    currentImg.includes('photo-1585647347384-2593bc35786b') ||
    currentImg.includes('photo-1622483767028-3f66f32aef97') ||
    currentImg.includes('photo-1572177812156-58036aae439c') ||
    currentImg.includes('photo-1505686994434-e3cc5abf1330');

  let defaultImage = '/images/combos/popcorn-bucket.png';
  let defaultCategory = c.category || 'COMBO';
  let defaultBadge = c.badge || 'BÁN CHẠY NHẤT';

  if (name.includes('solo') || name.includes('1 bắp')) {
    defaultImage = '/images/combos/combo-solo.png';
    defaultCategory = 'COMBO';
    defaultBadge = 'BÁN CHẠY NHẤT';
  } else if (name.includes('couple') || name.includes('đôi') || name.includes('2 người') || name.includes('2 nước')) {
    defaultImage = '/images/combos/combo-couple.png';
    defaultCategory = 'COMBO';
    defaultBadge = 'DÀNH CHO CẶP ĐÔI';
  } else if (name.includes('gia đình') || name.includes('family') || name.includes('vip')) {
    defaultImage = '/images/combos/combo-family.png';
    defaultCategory = 'COMBO';
    defaultBadge = 'TIẾT KIỆM 30%';
  } else if (name.includes('nước') || name.includes('coca') || name.includes('pepsi') || name.includes('sprite') || name.includes('fanta')) {
    defaultImage = '/images/combos/soda-drinks.png';
    defaultCategory = 'DRINK';
    defaultBadge = 'NƯỚC NGỌT MÁT LẠNH';
  } else if (name.includes('bắp')) {
    defaultImage = '/images/combos/popcorn-bucket.png';
    defaultCategory = 'POPCORN';
    defaultBadge = 'SNACK GIÒN TAN';
  }

  const finalImage = isGenericOrOld ? defaultImage : currentImg;

  return {
    image: finalImage,
    imageUrl: finalImage,
    category: c.category || defaultCategory,
    badge: c.badge || defaultBadge,
  };
};

let hasCleanedDuplicates = false;

export const ensureCleanConcessions = async () => {
  try {
    const all = await Concession.find({}).sort({ createdAt: 1 });
    if (all.length === 0) return;

    // Nếu DB đang bị trùng lặp 8 món từ 2 lần seed cũ (ví dụ vừa có "Combo Couple" vừa có "Combo Đôi Cinema",
    // vừa có "Nước Ngọt Coca-Cola (L)" vừa có "Nước Ngọt Coca-Cola / Sprite / Fanta (Size L)"),
    // ta gộp/loại bỏ bản trùng cũ để danh sách gọn đẹp đúng chuẩn.
    if (!hasCleanedDuplicates && all.length >= 7) {
      const names = all.map((x) => x.name);
      const LegacyDuplicates = [];
      if (names.includes('Combo Đôi Cinema (2 Người)') && names.includes('Combo Couple (1 Bắp Lớn + 2 Nước)')) {
        LegacyDuplicates.push('Combo Couple (1 Bắp Lớn + 2 Nước)');
      }
      if (
        names.includes('Bắp Rang Bơ (Ngọt / Phô Mai / Caramel)') &&
        names.includes('Bắp Rang Bơ (Ngọt/Phô Mai)')
      ) {
        LegacyDuplicates.push('Bắp Rang Bơ (Ngọt/Phô Mai)');
      }
      if (
        names.includes('Nước Ngọt Coca-Cola / Sprite / Fanta (Size L)') &&
        names.includes('Nước Ngọt Coca-Cola (L)')
      ) {
        LegacyDuplicates.push('Nước Ngọt Coca-Cola (L)');
      }
      if (LegacyDuplicates.length > 0) {
        await Concession.deleteMany({ name: { $in: LegacyDuplicates } });
      }
      hasCleanedDuplicates = true;
    }

    // Đồng bộ hình ảnh đặc sắc cho từng món trong DB
    const currentItems = await Concession.find({});
    for (const doc of currentItems) {
      const resolved = resolveConcessionVisuals(doc);
      if (
        doc.image !== resolved.image ||
        doc.imageUrl !== resolved.imageUrl ||
        doc.category !== resolved.category ||
        doc.badge !== resolved.badge
      ) {
        doc.image = resolved.image;
        doc.imageUrl = resolved.imageUrl;
        doc.category = resolved.category;
        doc.badge = resolved.badge;
        await doc.save();
      }
    }
  } catch (err) {
    console.warn('Concession sync warning:', err.message);
  }
};

export const getConcessions = async (req, res) => {
  try {
    await ensureCleanConcessions();
    const rawConcessions = await Concession.find({}).sort({ price: 1 }).lean();
    const concessions = rawConcessions.map((c) => {
      const visuals = resolveConcessionVisuals(c);
      return {
        ...c,
        ...visuals,
        id: c._id.toString(),
      };
    });
    res.json(concessions);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh mục bắp nước', error: error.message });
  }
};
