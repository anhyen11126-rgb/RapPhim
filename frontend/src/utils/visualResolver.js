// Helper đồng bộ hình ảnh đặc sắc cho Combo Bắp Nước & Chương Trình Khuyến Mãi

export const resolveConcessionImage = (c = {}) => {
  const name = (c.name || c.title || '').toLowerCase();
  const rawImg = c.image || c.imageUrl || '';
  const isGenericOrOld =
    !rawImg ||
    rawImg.includes('photo-1578849278619-e73505e9610f') ||
    rawImg.includes('photo-1585647347384-2593bc35786b') ||
    rawImg.includes('photo-1622483767028-3f66f32aef97') ||
    rawImg.includes('photo-1572177812156-58036aae439c') ||
    rawImg.includes('photo-1505686994434-e3cc5abf1330');

  if (!isGenericOrOld) return rawImg;

  if (name.includes('solo') || name.includes('1 bắp')) {
    return '/images/combos/combo-solo.png';
  }
  if (name.includes('couple') || name.includes('đôi') || name.includes('2 người') || name.includes('2 nước')) {
    return '/images/combos/combo-couple.png';
  }
  if (name.includes('gia đình') || name.includes('family') || name.includes('vip')) {
    return '/images/combos/combo-family.png';
  }
  if (name.includes('nước') || name.includes('coca') || name.includes('pepsi') || name.includes('sprite') || name.includes('fanta')) {
    return '/images/combos/soda-drinks.png';
  }
  return '/images/combos/popcorn-bucket.png';
};

export const resolveConcessionBadge = (c = {}) => {
  if (c.badge) return c.badge;
  const name = (c.name || c.title || '').toLowerCase();
  if (name.includes('solo') || name.includes('1 bắp')) return 'BÁN CHẠY NHẤT';
  if (name.includes('couple') || name.includes('đôi') || name.includes('2 người')) return 'DÀNH CHO CẶP ĐÔI';
  if (name.includes('gia đình') || name.includes('vip')) return 'TIẾT KIỆM 30%';
  if (name.includes('nước') || name.includes('coca') || name.includes('sprite') || name.includes('fanta'))
    return 'NƯỚC NGỌT MÁT LẠNH';
  return 'SNACK GIÒN TAN';
};

export const deduplicateConcessions = (items = []) => {
  if (!Array.isArray(items) || items.length <= 5) return items;
  const names = items.map((x) => x.name || x.title || '');
  return items.filter((item) => {
    const n = item.name || item.title || '';
    if (n === 'Combo Couple (1 Bắp Lớn + 2 Nước)' && names.includes('Combo Đôi Cinema (2 Người)')) {
      return false;
    }
    if (n === 'Bắp Rang Bơ (Ngọt/Phô Mai)' && names.includes('Bắp Rang Bơ (Ngọt / Phô Mai / Caramel)')) {
      return false;
    }
    if (n === 'Nước Ngọt Coca-Cola (L)' && names.includes('Nước Ngọt Coca-Cola / Sprite / Fanta (Size L)')) {
      return false;
    }
    return true;
  });
};

export const resolvePromotionVisuals = (p = {}) => {
  const title = (p.title || '').toLowerCase();
  const rawImg = p.image || '';
  const isOldUnsplash = !rawImg || rawImg.includes('images.unsplash.com');

  let image = rawImg || '/images/promotions/promo-happy-day.png';
  if (isOldUnsplash) {
    if (p.type === 'HERO_DEAL') {
      image = '/images/combos/combo-couple.png';
    } else if (title.includes('happy day') || title.includes('thứ 4') || title.includes('50k')) {
      image = '/images/promotions/promo-happy-day.png';
    } else if (title.includes('avatar') || title.includes('combo') || title.includes('ly vip') || title.includes('bắp nước')) {
      image = title.includes('bắp nước') && !title.includes('avatar')
        ? '/images/combos/combo-solo.png'
        : '/images/promotions/promo-avatar-combo.png';
    } else if (title.includes('prime') || title.includes('hội viên') || title.includes('điểm')) {
      image = '/images/promotions/promo-vip-prime.png';
    } else if (title.includes('học sinh') || title.includes('sinh viên') || title.includes('u22')) {
      image = '/images/promotions/promo-student-u22.png';
    } else if (title.includes('vnpay') || title.includes('qr') || title.includes('25.000')) {
      image = '/images/promotions/promo-vnpay-qr.png';
    } else if (title.includes('imax') || title.includes('gold class')) {
      image = '/images/promotions/promo-imax-gold.png';
    }
  }

  const cleanTitle = (p.title || '').replace(/MovieTix/g, "D'AVENOR");
  const cleanDescription = (p.description || '').replace(/MovieTix/g, "D'AVENOR");
  const cleanBadgeTop = (p.badgeTop || '').includes('Landmark 81')
    ? "📍 D'AVENOR Thanh Khê Plaza"
    : p.badgeTop || '';
  const cleanConditions = (p.conditions || '').replace(/Landmark 81/g, "D'AVENOR Thanh Khê Plaza");
  const cleanMetadataLeft = (p.metadataLeft || '').replace(/Tất cả cụm rạp/g, "D'AVENOR Thanh Khê Plaza");

  return {
    ...p,
    title: cleanTitle,
    description: cleanDescription,
    badgeTop: cleanBadgeTop,
    conditions: cleanConditions,
    metadataLeft: cleanMetadataLeft,
    image,
  };
};

