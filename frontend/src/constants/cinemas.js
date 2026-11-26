// Cụm rạp duy nhất của hệ thống D'AVENOR CINEMA tại Quận Thanh Khê, TP. Đà Nẵng
export const PRIMARY_CINEMA_ID = '6aecb03919dd0ede75638b6e';

export const FALLBACK_CINEMAS = [
  {
    id: PRIMARY_CINEMA_ID,
    name: "D'AVENOR Thanh Khê Plaza",
    slug: 'thanhkhe-plaza-danang',
    city: 'Đà Nẵng',
    district: 'Thanh Khê',
    address: 'Tầng 4 TTTM Thanh Khê Plaza, 295 Điện Biên Phủ, P. Chính Gián, Q. Thanh Khê, Đà Nẵng',
    distance: '1.5 km',
    isFlagship: true,
    rating: 4.9,
    reviewsCount: 2850,
    tags: ['IMAX Laser', 'Dolby Atmos', 'Gold Class'],
    specialBadge: "Cụm rạp Flagship D'AVENOR Thanh Khê - Đà Nẵng",
    image: '/images/cinemas/davenor-flagship-cinema.jpg',
    openingHours: '08:00 - 02:00 sáng',
    hotline: '1900 8899',
    parking: 'Hầm B1 & B2 TTTM Thanh Khê Plaza 24/7',
    roomCount: 9,
  },
];

// Luôn chọn chính xác cụm rạp duy nhất D'AVENOR Thanh Khê Plaza (không chọn ngẫu nhiên phần tử đầu)
export const resolveCanonicalCinema = (cinemas = []) => {
  const list = Array.isArray(cinemas) ? cinemas : [];
  const byId = list.find((c) => String(c.id || c._id) === PRIMARY_CINEMA_ID);
  if (byId) return byId;
  const byFlagship = list.find(
    (c) => c.isFlagship === true || (c.district || '').toLowerCase().includes('thanh khê')
  );
  if (byFlagship) return byFlagship;
  const byName = list.find((c) => (c.name || '').toLowerCase().includes('thanh khê'));
  return byName || FALLBACK_CINEMAS[0];
};
