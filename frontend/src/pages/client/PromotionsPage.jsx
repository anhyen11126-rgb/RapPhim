import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { resolvePromotionVisuals } from '../../utils/visualResolver';

const IMAGE_VERSION = 'real2';

const appendImageVersion = (url) => {
  if (!url || !url.startsWith('/images/promotions/')) return url;
  return url.includes('?') ? `${url}&v=${IMAGE_VERSION}` : `${url}?v=${IMAGE_VERSION}`;
};

const WEEKDAY_NAMES = [
  'Chủ Nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Bảng ưu đãi cố định theo từng thứ trong tuần (0: Chủ Nhật -> 6: Thứ 7)
const DAILY_DEAL_BY_WEEKDAY = {
  1: {
    badge: 'ƯU ĐÃI THỨ 2',
    titlePrefix: 'THỨ 2 KHỞI ĐẦU',
    titleHighlight: 'GIẢM 25% VÉ 2D',
    description:
      "Khởi động tuần mới nhẹ nhàng với ưu đãi giảm ngay 25% giá vé 2D cho tất cả các suất chiếu trong ngày tại D'AVENOR Thanh Khê Plaza.",
    voucherCode: 'MON25',
    discountTag: '-25%',
    comboBadge: 'Combo Khởi Tuần',
    comboTitle: 'Bắp Ngọt Size M + 01 Nước Ngọt',
    comboSubtitle: 'Giảm thêm 15.000đ khi đặt kèm vé online',
    image: '/images/promotions/promo-happy-day.png',
    rules: [
      'Áp dụng cho tất cả suất chiếu 2D vào mỗi Thứ 2 hàng tuần.',
      'Nhập mã MON25 ở bước thanh toán hoặc xuất trình tại quầy vé.',
      'Không áp dụng đồng thời với các chương trình đồng giá vé khác.',
    ],
  },
  2: {
    badge: 'SIÊU BÃO THỨ 3',
    titlePrefix: 'THỨ 3 VUI VẺ',
    titleHighlight: 'ĐỒNG GIÁ VÉ 45K',
    description:
      "Thưởng thức mọi bộ phim 2D màn ảnh rộng Laser tại D'AVENOR Thanh Khê Plaza với giá vé đồng nhất chỉ 45.000đ cả ngày Thứ 3.",
    voucherCode: 'TUE45K',
    discountTag: '45K',
    comboBadge: 'Combo Đôi Cinema',
    comboTitle: 'Bắp Lớn 2 Ngăn + 02 Nước Ngọt',
    comboSubtitle: 'Ưu đãi giảm 20% khi đặt kèm vé đôi online',
    image: '/images/promotions/promo-daily-hero.png',
    rules: [
      'Đồng giá 45.000đ/vé 2D cho thành viên vào mỗi Thứ 3 hàng tuần.',
      'Áp dụng cho cả đặt vé trực tuyến và mua trực tiếp tại quầy.',
      'Phụ thu ghế VIP/Sweetbox theo bảng giá niêm yết của rạp.',
    ],
  },
  3: {
    badge: 'HAPPY DAY THỨ 4',
    titlePrefix: 'THỨ 4 HAPPY DAY',
    titleHighlight: 'ĐỒNG GIÁ 50K MỌI SUẤT',
    description:
      "Ngày hội điện ảnh giữa tuần — đồng giá 50.000đ/vé mọi khung giờ chiếu tại D'AVENOR Thanh Khê Plaza, tặng kèm ưu đãi nâng size bắp.",
    voucherCode: 'WED50K',
    discountTag: '50K',
    comboBadge: 'Ưu Đãi Giữa Tuần',
    comboTitle: 'Nâng Size Bắp Lớn Miễn Phí',
    comboSubtitle: 'Áp dụng khi nhập mã WED50K trong ngày Thứ 4',
    image: '/images/promotions/promo-happy-day.png',
    rules: [
      'Áp dụng đồng giá 50.000đ/vé 2D cho toàn bộ suất chiếu ngày Thứ 4.',
      'Mỗi tài khoản được đặt tối đa 06 vé ưu đãi trong ngày.',
      'Miễn phí nâng size bắp khi mua kèm combo bất kỳ tại quầy.',
    ],
  },
  4: {
    badge: 'NGÀY HỘI THÀNH VIÊN',
    titlePrefix: 'THỨ 5 THÀNH VIÊN',
    titleHighlight: 'GIẢM 30K & X2 ĐIỂM',
    description:
      "Đặc quyền Thứ 5 dành riêng cho hội viên D'AVENOR: giảm ngay 30.000đ cho đơn từ 150.000đ và nhân đôi điểm tích lũy đổi quà.",
    voucherCode: 'THU30K',
    discountTag: '-30K',
    comboBadge: "Đặc Quyền D'AVENOR",
    comboTitle: 'X2 Điểm Tích Lũy Thành Viên',
    comboSubtitle: 'Cộng điểm tự động ngay sau khi thanh toán thành công',
    image: '/images/promotions/promo-vip-prime.png',
    rules: [
      'Áp dụng cho khách hàng đã đăng nhập tài khoản thành viên vào Thứ 5.',
      'Giảm 30.000đ cho đơn hàng vé + bắp nước từ 150.000đ khi nhập mã THU30K.',
      'Điểm thưởng X2 được cộng tự động trong vòng 15 phút sau suất chiếu.',
    ],
  },
  5: {
    badge: 'QUẨY CUỐI TUẦN THỨ 6',
    titlePrefix: 'THỨ 6 BÙNG NỔ',
    titleHighlight: 'COMBO ĐÔI GIẢM 40%',
    description:
      "Mở màn cuối tuần rực rỡ: giảm ngay 40% Combo Bắp Nước Đôi khi đặt từ 02 vé trở lên cho các suất chiếu tối Thứ 6.",
    voucherCode: 'FRI40',
    discountTag: '-40%',
    comboBadge: 'Combo Bắp Nước',
    comboTitle: 'Combo Đôi Bắp Lớn + 02 Nước Lớn',
    comboSubtitle: 'Nhận bắp nhanh tại làn F&B FastTrack bằng mã QR',
    image: '/images/promotions/promo-avatar-combo.png',
    rules: [
      'Áp dụng vào Thứ 6 hàng tuần cho đơn hàng có tối thiểu 02 vé xem phim.',
      'Nhập mã FRI40 để giảm trực tiếp 40% giá trị 01 Combo Đôi trong đơn.',
      'Số lượng ưu đãi giới hạn theo ngày, kết thúc sớm khi hết suất.',
    ],
  },
  6: {
    badge: 'ƯU ĐÃI CUỐI TUẦN THỨ 7',
    titlePrefix: 'THỨ 7 CỰC ĐÃ',
    titleHighlight: 'HOÀN 30K VNPAY-QR',
    description:
      "Đặt vé cuối tuần thả ga, thanh toán qua VNPAY-QR giảm ngay 30.000đ cho đơn từ 150.000đ mọi định dạng 2D, IMAX & Gold Class.",
    voucherCode: 'SAT30K',
    discountTag: '-30K',
    comboBadge: 'Thanh Toán VNPAY-QR',
    comboTitle: 'Quét QR Giảm Trực Tiếp 30.000đ',
    comboSubtitle: 'Áp dụng cho cả vé phim và combo bắp nước ngày Thứ 7',
    image: '/images/promotions/promo-vnpay-qr.png',
    rules: [
      'Áp dụng vào Thứ 7 hàng tuần khi thanh toán qua cổng VNPAY-QR.',
      'Đơn hàng hợp lệ có tổng giá trị từ 150.000đ trở lên.',
      'Mỗi khách hàng được áp dụng 01 lần ưu đãi trong ngày Thứ 7.',
    ],
  },
  0: {
    badge: 'CHỦ NHẬT SUM VẦY',
    titlePrefix: 'CHỦ NHẬT GIA ĐÌNH',
    titleHighlight: 'MUA 3 TẶNG 1 VÉ',
    description:
      "Dành trọn Chủ Nhật bên gia đình và bạn bè: đặt nhóm 04 vé chỉ tính tiền 03 vé, kèm ưu đãi giảm 20% Combo Gia Đình.",
    voucherCode: 'SUNFAM',
    discountTag: '3 + 1',
    comboBadge: 'Ưu Đãi Nhóm & Gia Đình',
    comboTitle: 'Combo Gia Đình 02 Bắp + 04 Nước',
    comboSubtitle: 'Áp dụng cho mọi khung giờ Chủ Nhật tại Thanh Khê Plaza',
    image: '/images/promotions/promo-student-u22.png',
    rules: [
      'Áp dụng vào Chủ Nhật hàng tuần cho đơn đặt từ 04 vé cùng suất chiếu.',
      'Nhập mã SUNFAM để được miễn phí 01 vé tiêu chuẩn trong đơn.',
      'Không áp dụng tách đơn hoặc cộng dồn với chương trình U22.',
    ],
  },
};

const formatDateDDMM = (date) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
};

const formatDateFull = (date) => `${formatDateDDMM(date)}/${date.getFullYear()}`;

const getRemainingTimeToday = () => {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const diffSec = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
  return {
    hours: Math.floor(diffSec / 3600),
    minutes: Math.floor((diffSec % 3600) / 60),
    seconds: diffSec % 60,
  };
};

const getTodayDailyDeal = () => {
  const today = new Date();
  const dayIdx = today.getDay();
  const deal = DAILY_DEAL_BY_WEEKDAY[dayIdx];
  return {
    dayIdx,
    weekdayName: WEEKDAY_NAMES[dayIdx],
    weekdayShort: WEEKDAY_SHORT[dayIdx],
    shortDate: formatDateDDMM(today),
    fullDate: formatDateFull(today),
    ...deal,
    image: appendImageVersion(deal.image),
  };
};

const PromotionsPage = () => {
  const navigate = useNavigate();

  // Ưu đãi tự động theo ngày & thứ hiện tại
  const activeDailyDeal = useMemo(() => getTodayDailyDeal(), []);

  // State dữ liệu khuyến mãi từ Database
  const [vouchers, setVouchers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [counts, setCounts] = useState({ all: 0, ticket: 0, concession: 0, student: 0, payment: 0 });
  const [loading, setLoading] = useState(true);

  // State bộ lọc, sắp xếp & modal thể lệ
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [copiedCode, setCopiedCode] = useState(null);
  const [voucherInput, setVoucherInput] = useState('');
  const [applyMessage, setApplyMessage] = useState(null);
  const [selectedProgramModal, setSelectedProgramModal] = useState(null);

  // Đếm ngược thực tế đến hết ngày hôm nay (23:59:59)
  const [timeLeft, setTimeLeft] = useState(() => getRemainingTimeToday());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getRemainingTimeToday());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tải dữ liệu Khuyến mãi từ API Backend MongoDB
  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        setLoading(true);
        const params = {};
        if (activeCategory !== 'ALL') params.category = activeCategory;
        if (searchKeyword.trim()) params.search = searchKeyword.trim();

        const res = await api.get('/promotions', { params });
        if (res.data) {
          setVouchers(
            (res.data.vouchers || []).map((v) => {
              const resolved = resolvePromotionVisuals(v);
              return { ...resolved, image: appendImageVersion(resolved.image) };
            })
          );
          setPrograms(
            (res.data.programs || []).map((p) => {
              const resolved = resolvePromotionVisuals(p);
              return { ...resolved, image: appendImageVersion(resolved.image) };
            })
          );
          if (res.data.counts) setCounts(res.data.counts);
        }
      } catch (err) {
        console.error('Lỗi khi tải khuyến mãi từ Database:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();
  }, [activeCategory, searchKeyword]);

  const sortedPrograms = useMemo(() => {
    const list = [...programs];
    if (sortBy === 'discount') {
      const score = (p) => {
        const text = `${p.badgeSpecial || ''} ${p.title || ''}`;
        const num = parseInt(text.replace(/[^\d]/g, ''), 10);
        return Number.isNaN(num) ? 0 : num;
      };
      return list.sort((a, b) => score(b) - score(a));
    }
    if (sortBy === 'expiring') {
      return list.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    return list;
  }, [programs, sortBy]);

  // Xử lý sao chép mã voucher
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2200);
  };

  // Xử lý kiểm tra voucher nhập nhanh
  const handleApplyQuickVoucher = async (e) => {
    e.preventDefault();
    if (!voucherInput.trim()) return;

    try {
      const res = await api.post('/promotions/apply', { code: voucherInput.trim() });
      setApplyMessage({ success: true, text: res.data.message });
      setTimeout(() => setApplyMessage(null), 3500);
      setVoucherInput('');
    } catch (err) {
      setApplyMessage({
        success: false,
        text: err.response?.data?.message || 'Mã voucher không hợp lệ',
      });
      setTimeout(() => setApplyMessage(null), 3500);
    }
  };

  const categories = [
    { key: 'ALL', label: `Tất cả (${counts.all || 6})` },
    { key: 'TICKET', label: `Giá vé (${counts.ticket || 2})` },
    { key: 'CONCESSION', label: `Bắp nước (${counts.concession || 1})` },
    { key: 'STUDENT', label: `Học sinh - U22 (${counts.student || 1})` },
    { key: 'PAYMENT', label: `Thanh toán (${counts.payment || 1})` },
  ];

  const getTopBadgeClasses = (prog) => {
    const title = (prog.title || '').toLowerCase();
    if (title.includes('happy day') || title.includes('thứ 4')) {
      return 'bg-[#f59e0b] text-slate-950';
    }
    if (title.includes('avatar') || title.includes('vnpay')) {
      return 'bg-[#60a5fa] text-slate-950';
    }
    if (title.includes('học sinh') || title.includes('u22')) {
      return 'bg-[#10b981] text-slate-950';
    }
    if (title.includes('prime') || title.includes('vip')) {
      return 'bg-[#f5b041] text-slate-950';
    }
    return 'bg-slate-900/90 text-amber-200 border border-amber-500/30';
  };

  const getSpecialBadgeClasses = (prog) => {
    if (prog.badgeColor === 'emerald' || (prog.badgeSpecial || '').includes('VIP')) {
      return 'bg-slate-950/90 text-emerald-400 border border-emerald-500/40';
    }
    if (prog.badgeColor === 'blue' || (prog.badgeSpecial || '').includes('45.000')) {
      return 'bg-slate-950/90 text-[var(--ice-blue)] border border-blue-400/40';
    }
    return 'bg-slate-950/90 text-amber-400 border border-amber-500/40';
  };

  return (
    <div className="bg-[var(--bg-main)] min-h-screen text-[var(--text-main)] pb-14">
      {/* 1. HEADER GỌN GÀNG */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-5 pb-3">
        <div className="flex items-center space-x-2 text-xs text-[var(--text-muted)] mb-2 font-medium">
          <Link to="/" className="hover:text-white transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-[var(--text-main)]">Ưu đãi & Khuyến mãi</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-[#F4A5FF] via-[#C56BFF] to-[#83F5FF] bg-clip-text text-transparent tracking-tight">
              Ưu Đãi & Kho Voucher
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Ưu đãi cập nhật tự động theo từng ngày trong tuần tại D'AVENOR Thanh Khê Plaza
            </p>
          </div>

          <div className="inline-flex items-center gap-4 bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 rounded-xl px-4 py-2 text-xs self-start sm:self-auto">
            <div className="flex items-center gap-2">
              <span>🎟️</span>
              <span className="text-[var(--text-muted)]">Mã khả dụng:</span>
              <span className="font-black text-white">{String(vouchers.length || 5).padStart(2, '0')}</span>
            </div>
            <div className="h-4 w-[1px] bg-[#AA9BFF]/20" />
            <div className="flex items-center gap-1.5 text-[#42DFFF] font-semibold">
              <span>📍</span>
              <span>Thanh Khê Plaza</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. HERO ƯU ĐÃI TỰ ĐỘNG THEO NGÀY / THỨ HIỆN TẠI */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-2">
        <div className="relative rounded-2xl overflow-hidden border border-[#AA9BFF]/25 bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-card)]/60 to-[var(--bg-main)] shadow-xl p-5 sm:p-6">
          {/* Nội dung ưu đãi hôm nay */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Cột trái */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-[#A855F7]/20 text-[#F4A5FF] border border-[#A855F7]/40 text-[11px] font-black px-2.5 py-1 rounded-md uppercase tracking-wide">
                  <span>⚡</span>
                  <span>{activeDailyDeal.badge}</span>
                </span>
                <span className="text-xs font-semibold text-[#42DFFF] bg-cyan-500/10 border border-[#42DFFF]/25 px-2.5 py-1 rounded-md">
                  Hôm nay • {activeDailyDeal.weekdayName} ({activeDailyDeal.fullDate})
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                {activeDailyDeal.titlePrefix} —{' '}
                <span className="bg-gradient-to-r from-[#F4A5FF] via-[#C56BFF] to-[#83F5FF] bg-clip-text text-transparent">
                  {activeDailyDeal.titleHighlight}
                </span>
              </h2>

              <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed max-w-2xl">
                {activeDailyDeal.description}
              </p>

              {/* Hàng Voucher theo ngày + Đếm ngược gọn gàng */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Hộp mã voucher trong ngày */}
                <div className="flex items-center gap-2.5 bg-[var(--bg-main)]/80 border border-dashed border-[#42DFFF]/40 rounded-xl px-3.5 py-2">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-semibold block leading-none">
                      MÃ ƯU ĐÃI {activeDailyDeal.weekdayShort}
                    </span>
                    <span className="font-mono text-sm font-black text-white tracking-wider">
                      {activeDailyDeal.voucherCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(activeDailyDeal.voucherCode)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      copiedCode === activeDailyDeal.voucherCode
                        ? 'bg-emerald-500 text-white'
                        : 'bg-[var(--bg-card)] hover:bg-[#25234D] text-[#42DFFF] border border-[#42DFFF]/30'
                    }`}
                  >
                    {copiedCode === activeDailyDeal.voucherCode ? '✔ Đã chép' : 'Sao chép'}
                  </button>
                </div>

                {/* Bộ đếm ngược thực tế cho hôm nay */}
                <div className="flex items-center gap-2 bg-[var(--bg-card)]/80 border border-[#AA9BFF]/25 rounded-xl px-3.5 py-2">
                  <span className="text-[11px] text-[var(--text-muted)] font-semibold">Còn lại hôm nay:</span>
                  <div className="flex items-center gap-1 font-mono text-xs sm:text-sm font-black text-white">
                    <span className="bg-[var(--bg-main)] px-1.5 py-0.5 rounded">
                      {String(timeLeft.hours).padStart(2, '0')}g
                    </span>
                    <span className="text-[#AA9BFF]/50">:</span>
                    <span className="bg-[var(--bg-main)] px-1.5 py-0.5 rounded">
                      {String(timeLeft.minutes).padStart(2, '0')}p
                    </span>
                    <span className="text-[#AA9BFF]/50">:</span>
                    <span className="bg-[var(--bg-main)] px-1.5 py-0.5 rounded text-[#42DFFF]">
                      {String(timeLeft.seconds).padStart(2, '0')}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/theaters')}
                  className="bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] hover:brightness-110 text-[#0B1026] font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Săn ưu đãi hôm nay</span>
                  <span>➔</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedProgramModal({
                      title: `${activeDailyDeal.titlePrefix} — ${activeDailyDeal.titleHighlight}`,
                      badgeTop: `⚡ ${activeDailyDeal.badge} (${activeDailyDeal.shortDate})`,
                      badgeSpecial: activeDailyDeal.discountTag,
                      description: activeDailyDeal.description,
                      image: activeDailyDeal.image,
                      rules: activeDailyDeal.rules,
                      buttonText: 'Đặt vé ngay',
                      buttonAction: '/theaters',
                    })
                  }
                  className="bg-[var(--bg-card)] hover:bg-[#25234D] text-[var(--text-main)] font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-colors border border-[#AA9BFF]/25 cursor-pointer"
                >
                  Xem thể lệ
                </button>
              </div>
            </div>

            {/* Cột phải: Ảnh minh họa thực tế gọn gàng */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border border-[#AA9BFF]/25 bg-[var(--bg-main)] shadow-lg group">
                <div className="aspect-[16/10] w-full overflow-hidden">
                  <img
                    src={activeDailyDeal.image}
                    alt={activeDailyDeal.comboTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                <div className="absolute top-3 right-3 bg-slate-950/85 backdrop-blur-md text-[#F4A5FF] border border-[#F4A5FF]/40 text-xs font-black px-2.5 py-1 rounded-lg">
                  {activeDailyDeal.discountTag}
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <span className="inline-block text-[10px] font-bold text-[#42DFFF] bg-slate-950/80 border border-[#42DFFF]/30 px-2 py-0.5 rounded mb-1">
                    {activeDailyDeal.comboBadge}
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white leading-snug">
                    {activeDailyDeal.comboTitle}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">{activeDailyDeal.comboSubtitle}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KHO VOUCHER ĐỔI THƯỞNG & NHẬP MÃ NHANH */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-5 pb-3">
        <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>🎟️</span>
                <span>Kho Voucher & Nhập Mã Nhanh</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Sao chép mã để áp dụng trực tiếp tại bước thanh toán.
              </p>
            </div>

            <form onSubmit={handleApplyQuickVoucher} className="flex items-center gap-2">
              <input
                type="text"
                value={voucherInput}
                onChange={(e) => setVoucherInput(e.target.value)}
                placeholder="Nhập mã voucher..."
                className="bg-[var(--bg-main)] border border-[#AA9BFF]/25 rounded-xl px-3 py-2 text-xs text-white placeholder-[#BEC5E5]/50 uppercase tracking-wider focus:outline-none focus:border-[#42DFFF] w-44 sm:w-52"
              />
              <button
                type="submit"
                className="bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] hover:brightness-110 text-[#0B1026] font-black text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                Áp dụng
              </button>
            </form>
          </div>

          {applyMessage && (
            <div
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                applyMessage.success
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-300 border border-red-500/30'
              }`}
            >
              {applyMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {vouchers.map((v) => {
              const isCopied = copiedCode === v.code;
              return (
                <div
                  key={v.id}
                  className="bg-[var(--bg-card)] border border-[#AA9BFF]/20 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 hover:border-[#42DFFF]/50 transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-[#42DFFF] bg-cyan-500/10 px-2 py-0.5 rounded border border-[#42DFFF]/25 uppercase">
                      {v.badgeTop}
                    </span>
                    <span className="text-[var(--text-muted)] font-medium">{v.expiryDate}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white group-hover:text-[#42DFFF] transition-colors">
                      {v.discountValue}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-1 leading-snug">
                      {v.conditions}
                    </p>
                  </div>

                  <div className="border-t border-dashed border-[#AA9BFF]/20 pt-2 flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-black text-slate-200 tracking-wider">
                      {v.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(v.code)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-[var(--bg-secondary)] hover:bg-[#25234D] text-[var(--text-muted)] hover:text-white border border-[#AA9BFF]/25'
                      }`}
                    >
                      {isCopied ? '✔ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. THANH LỌC & CHƯƠNG TRÌNH KHUYẾN MÃI NỔI BẬT */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-4 pb-3 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>🎬</span>
              <span>Chương Trình Khuyến Mãi Nổi Bật</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Pills danh mục */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === cat.key
                      ? 'bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] font-black'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-white border border-[#AA9BFF]/20'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Tìm kiếm & Sắp xếp */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative w-44 sm:w-52">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[var(--text-muted)]/60 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Tìm ưu đãi..."
                  className="w-full bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[#BEC5E5]/50 focus:outline-none focus:border-[#42DFFF]"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 text-[var(--cyan)] font-bold rounded-xl px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
              >
                <option value="newest">Mới nhất</option>
                <option value="discount">Giảm nhiều</option>
                <option value="expiring">Phổ biến</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grid Thẻ Khuyến Mãi */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[var(--cyan)] border-t-transparent mb-2" />
            <p>Đang tải danh sách khuyến mãi...</p>
          </div>
        ) : sortedPrograms.length === 0 ? (
          <div className="p-10 text-center bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] text-slate-400 text-xs">
            Không có chương trình khuyến mãi nào phù hợp với bộ lọc này.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedPrograms.map((prog) => {
              const isRightHighlight =
                (prog.metadataRight || '').includes('Còn') ||
                (prog.metadataRight || '').includes('Tặng vé sinh nhật');

              return (
                <div
                  key={prog.id}
                  className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between hover:border-[#42DFFF]/50 transition-all duration-300 group"
                >
                  <div>
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-950">
                      <img
                        src={prog.image}
                        alt={prog.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)]/90 via-transparent to-black/15" />

                      {prog.badgeTop && (
                        <div
                          className={`absolute top-2.5 left-2.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md shadow ${getTopBadgeClasses(
                            prog
                          )}`}
                        >
                          {prog.badgeTop}
                        </div>
                      )}

                      {prog.badgeSpecial && (
                        <div
                          className={`absolute bottom-2.5 right-2.5 text-xs font-black px-2.5 py-0.5 rounded-lg backdrop-blur-md shadow ${getSpecialBadgeClasses(
                            prog
                          )}`}
                        >
                          {prog.badgeSpecial}
                        </div>
                      )}
                    </div>

                    <div className="p-4 pb-3 space-y-2">
                      <h3 className="text-sm sm:text-[15px] font-black text-white group-hover:text-[#42DFFF] transition-colors line-clamp-1">
                        {prog.title}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                        {prog.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                        {prog.metadataLeft && (
                          <span className="text-slate-300 font-semibold">{prog.metadataLeft}</span>
                        )}
                        {prog.metadataRight && (
                          <span
                            className={`font-semibold ${
                              isRightHighlight
                                ? (prog.metadataRight || '').includes('Tặng')
                                  ? 'text-[#F4A5FF]'
                                  : 'text-emerald-400'
                                : 'text-[var(--text-muted)]'
                            }`}
                          >
                            • {prog.metadataRight.replace(/^•\s*/, '')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedProgramModal(prog)}
                      className="py-2 px-3 rounded-xl bg-[var(--bg-card)] hover:bg-[#25234D] border border-[#AA9BFF]/25 text-xs font-bold text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      Xem thể lệ
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(prog.buttonAction || '/theaters')}
                      className="py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] hover:brightness-110 text-[#0B1026]"
                    >
                      {prog.buttonText || 'Đặt vé ngay'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL CHI TIẾT THỂ LỆ CHƯƠNG TRÌNH */}
      {selectedProgramModal && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedProgramModal(null)}
        >
          <div
            className="bg-[var(--bg-secondary)] border border-slate-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedProgramModal.image && (
              <div className="relative h-44 w-full bg-slate-950">
                <img
                  src={selectedProgramModal.image}
                  alt={selectedProgramModal.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-transparent to-black/35" />
                <button
                  type="button"
                  onClick={() => setSelectedProgramModal(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/80 text-slate-300 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                {selectedProgramModal.badgeTop && (
                  <span className="text-[10px] font-bold bg-blue-500/20 text-[var(--ice-blue)] border border-[var(--cyan)]/30 px-2.5 py-0.5 rounded">
                    {selectedProgramModal.badgeTop}
                  </span>
                )}
                {selectedProgramModal.badgeSpecial && (
                  <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded">
                    {selectedProgramModal.badgeSpecial}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-white">{selectedProgramModal.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedProgramModal.description}</p>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-3.5 space-y-1.5 text-xs text-slate-300">
                <p className="font-bold text-amber-400">📌 Điều kiện & Thể lệ áp dụng:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  {(
                    selectedProgramModal.rules || [
                      "Địa điểm áp dụng: Cụm rạp D'AVENOR Thanh Khê Plaza (Đà Nẵng).",
                      'Áp dụng cho cả giao dịch đặt vé trực tuyến trên website/app và mua trực tiếp tại quầy.',
                      'Số lượng ưu đãi có thể kết thúc sớm khi hết ngân sách khuyến mãi trong tuần.',
                    ]
                  ).map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedProgramModal(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = selectedProgramModal.buttonAction || '/theaters';
                    setSelectedProgramModal(null);
                    navigate(action);
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white cursor-pointer"
                >
                  {selectedProgramModal.buttonText || 'Đặt vé ngay'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LƯU Ý SỬ DỤNG MÃ ƯU ĐÃI (GỌN 3 CỘT) */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-5">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)]/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
              <span className="text-[var(--cyan)]">ℹ️</span>
              <span>Lưu ý khi sử dụng mã ưu đãi D'AVENOR CINEMA</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Áp dụng tại D'AVENOR Thanh Khê Plaza
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)]/70 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-white font-bold">
                <span className="text-amber-400">🔄</span>
                <span>Áp dụng đồng thời</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Mỗi đơn đặt vé áp dụng tối đa 01 voucher giảm giá vé và 01 voucher combo bắp nước.
              </p>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)]/70 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-white font-bold">
                <span className="text-[var(--cyan)]">⏳</span>
                <span>Đổi vé & Hoàn hủy</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Vé đã áp dụng mã khuyến mãi không hỗ trợ hoàn tiền, chỉ hỗ trợ đổi suất chiếu trước 60 phút.
              </p>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)]/70 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-white font-bold">
                <span className="text-emerald-400">🥤</span>
                <span>Nhận bắp nước tại quầy</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Đưa mã QR trên ứng dụng D'AVENOR tại làn F&B FastTrack để nhận combo nhanh không cần xếp hàng.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionsPage;
