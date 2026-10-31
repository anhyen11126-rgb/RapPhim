import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const PromotionsPage = () => {
  const navigate = useNavigate();

  // State dữ liệu khuyến mãi từ Database
  const [heroDeal, setHeroDeal] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [counts, setCounts] = useState({ all: 0, ticket: 0, concession: 0, student: 0, payment: 0 });
  const [loading, setLoading] = useState(true);

  // State bộ lọc
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCinema, setSelectedCinema] = useState('Tất cả rạp chiếu');
  const [copiedCode, setCopiedCode] = useState(null);
  const [voucherInput, setVoucherInput] = useState('');
  const [applyMessage, setApplyMessage] = useState(null);

  // Countdown timer cho Hero Deal
  const [timeLeft, setTimeLeft] = useState({
    days: 2,
    hours: 14,
    minutes: 35,
    seconds: 11,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return prev;
      });
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
          setHeroDeal(res.data.heroDeal);
          setVouchers(res.data.vouchers || []);
          setPrograms(res.data.programs || []);
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

  // Xử lý sao chép mã voucher
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
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
    { key: 'ALL', label: `Tất cả ưu đãi (${counts.all || 24})` },
    { key: 'TICKET', label: `Ưu đãi Giá vé (${counts.ticket || 8})` },
    { key: 'CONCESSION', label: `Combo Bắp nước (${counts.concession || 6})` },
    { key: 'STUDENT', label: `Học sinh - U22 (${counts.student || 4})` },
    { key: 'PAYMENT', label: `Đối tác thanh toán (${counts.payment || 6})` },
  ];

  return (
    <div className="bg-[#0b0f19] min-h-screen text-slate-100 pb-20">
      {/* 1. BREADCRUMBS & TIÊU ĐỀ TRANG */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-5 pb-4">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-400 mb-2 font-medium">
          <Link to="/" className="hover:text-white transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-slate-200">Ưu đãi & Khuyến mãi</span>
        </div>

        {/* Tiêu đề & Thẻ Thống kê bên phải */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-full mb-1.5">
              <span>🔥</span>
              <span>HOT DEAL • Hơn 24 ưu đãi đang diễn ra</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Ưu Đãi & Kho Voucher Độc Quyền
            </h1>
          </div>

          {/* Thẻ Thống kê mã của bạn */}
          <div className="bg-[#121929] border border-slate-800 rounded-2xl px-5 py-3 flex items-center space-x-5 shadow-lg">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🎟️</span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Mã của bạn</span>
                <span className="text-xs font-black text-white">04 Sẵn sàng</span>
              </div>
            </div>
            <div className="h-7 w-[1px] bg-slate-800" />
            <div className="flex items-center space-x-3">
              <span className="text-2xl">💰</span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Tiết kiệm tối đa</span>
                <span className="text-xs font-black text-amber-400">120.000đ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. HERO FEATURED PROMOTION (SIÊU BÃO THỨ 3) */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 py-3">
        <div className="relative rounded-3xl overflow-hidden border border-slate-800/90 bg-gradient-to-br from-[#101728] via-[#0d1322] to-[#0a0e19] shadow-2xl p-6 sm:p-10">
          {/* Background ambient glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Cột trái: Nội dung Hot Deal & Countdown */}
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center space-x-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black px-3 py-1 rounded-md">
                <span>⚡</span>
                <span>{heroDeal?.badgeTop || 'SIÊU BÃO THỨ 3 TOÀN QUỐC'}</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                {heroDeal?.title ? (
                  <>
                    THỨ 3 VUI VẺ — <span className="text-amber-400">ĐỒNG GIÁ VÉ 45K</span>
                  </>
                ) : (
                  'THỨ 3 VUI VẺ — ĐỒNG GIÁ VÉ 45K'
                )}
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                {heroDeal?.description ||
                  'Thưởng thức mọi bom tấn màn ảnh rộng Laser hiện đại nhất MovieTix với giá vé chỉ 45.000đ. Tặng kèm 01 bắp ngọt Caramel thơm lừng khi áp dụng mua vé đôi online hôm nay.'}
              </p>

              {/* Bộ đếm ngược thời gian (Countdown Timer) */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <span>⏱️</span>
                  <span>Ưu đãi kết thúc sau:</span>
                </span>
                <div className="flex items-center space-x-2 text-center">
                  <div className="bg-[#172033] border border-slate-700/80 rounded-xl px-3 py-2 min-w-[58px]">
                    <span className="text-lg sm:text-xl font-black text-white block">
                      {String(timeLeft.days).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Ngày</span>
                  </div>
                  <span className="text-slate-600 font-black">:</span>
                  <div className="bg-[#172033] border border-slate-700/80 rounded-xl px-3 py-2 min-w-[58px]">
                    <span className="text-lg sm:text-xl font-black text-white block">
                      {String(timeLeft.hours).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Giờ</span>
                  </div>
                  <span className="text-slate-600 font-black">:</span>
                  <div className="bg-[#172033] border border-slate-700/80 rounded-xl px-3 py-2 min-w-[58px]">
                    <span className="text-lg sm:text-xl font-black text-white block">
                      {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Phút</span>
                  </div>
                  <span className="text-slate-600 font-black">:</span>
                  <div className="bg-[#172033] border border-slate-700/80 rounded-xl px-3 py-2 min-w-[58px]">
                    <span className="text-lg sm:text-xl font-black text-amber-400 block">
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Giây</span>
                  </div>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/theaters')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center space-x-2"
                >
                  <span>Săn ưu đãi ngay</span>
                  <span>➔</span>
                </button>
                <button className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm px-5 py-3 rounded-xl transition-colors border border-slate-700 flex items-center space-x-1.5">
                  <span>ℹ️</span>
                  <span>Xem thể lệ chi tiết</span>
                </button>
              </div>
            </div>

            {/* Cột phải: Thẻ quà tặng kèm ảnh (Bắp lớn + Nước ngọt) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-sm bg-[#141b2c] border border-slate-700/80 rounded-3xl p-4 shadow-2xl overflow-hidden group hover:border-slate-600 transition-all">
                {/* Badge giảm 50% góc phải */}
                <div className="absolute top-4 right-4 z-10 bg-amber-500 text-slate-950 text-xs font-black px-2.5 py-1 rounded-full shadow-lg">
                  -50%
                </div>

                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-800 mb-3 relative">
                  <img
                    src={heroDeal?.image || 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=600&auto=format&fit=crop'}
                    alt="Combo Bắp Nước"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-md text-[10px] text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/20">
                    Combo Tặng Kèm Đôi
                  </div>
                </div>

                <div className="text-center py-1">
                  <h3 className="text-base font-black text-white">Bắp Lớn + Nước Ngọt</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Miễn phí cho bạn và đối tác/bạn bè</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. THANH DANH MỤC & TÌM KIẾM KHUYẾN MÃI */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-8 pb-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Pills danh mục */}
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-1">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat.key
                    ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30 font-bold'
                    : 'bg-[#121929] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Ô tìm kiếm & Dropdown Rạp */}
          <div className="flex items-center space-x-3">
            <div className="relative flex-1 sm:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm tên ưu đãi, mã code..."
                className="w-full bg-[#111624] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <select
              value={selectedCinema}
              onChange={(e) => setSelectedCinema(e.target.value)}
              className="bg-[#111624] border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="Tất cả rạp chiếu">🏢 Tất cả rạp chiếu</option>
              <option value="MovieTix Landmark 81 IMAX">MovieTix Landmark 81</option>
              <option value="MovieTix Vincom Đồng Khởi">Vincom Đồng Khởi</option>
              <option value="MovieTix Sala Thủ Thiêm">Sala Thủ Thiêm</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. KHO VOUCHER ĐỔI THƯỞNG & NHẬP MÃ NHANH */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 py-5">
        <div className="bg-[#0f1422] border border-slate-800/90 rounded-3xl p-6 sm:p-7 space-y-5">
          {/* Header Kho Voucher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                <span>🎟️</span>
                <span>Kho Voucher Đổi Thưởng & Nhập Mã Nhanh</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Lưu mã ngay để áp dụng tự động ở bước thanh toán & hoàn tiền đơn hàng.
              </p>
            </div>

            {/* Form nhập mã voucher cá nhân */}
            <form onSubmit={handleApplyQuickVoucher} className="flex items-center space-x-2">
              <input
                type="text"
                value={voucherInput}
                onChange={(e) => setVoucherInput(e.target.value)}
                placeholder="NHẬP MÃ VOUCHER CỦA BẠN"
                className="bg-[#141b2c] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 uppercase tracking-wider focus:outline-none focus:border-blue-500 w-48 sm:w-56"
              />
              <button
                type="submit"
                className="bg-[#2563eb] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                Áp dụng
              </button>
            </form>
          </div>

          {applyMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                applyMessage.success
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}
            >
              {applyMessage.text}
            </div>
          )}

          {/* Dải Thẻ Voucher Cuộn Ngang / Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 pt-1">
            {vouchers.map((v) => {
              const isCopied = copiedCode === v.code;
              return (
                <div
                  key={v.id}
                  className="relative bg-[#141b2c] border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-600 transition-all group"
                >
                  {/* Top Badge & HSD */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-wider">
                      {v.badgeTop}
                    </span>
                    <span className="text-slate-400 font-medium">{v.expiryDate}</span>
                  </div>

                  {/* Giá trị giảm & Điều kiện */}
                  <div>
                    <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors">
                      {v.discountValue}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {v.conditions}
                    </p>
                  </div>

                  {/* Dòng gạch đứt vé (Perforated ticket effect) */}
                  <div className="border-t border-dashed border-slate-700/80 pt-2.5 flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-black text-slate-200 tracking-wider">
                      {v.code}
                    </span>
                    <button
                      onClick={() => handleCopyCode(v.code)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                        isCopied
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                    >
                      {isCopied ? '✔ Đã lưu' : '📋 Sao chép'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. CHƯƠNG TRÌNH KHUYẾN MÃI NỔI BẬT (GRID 6 CARDS) */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 py-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center space-x-2">
              <span>📅</span>
              <span>Chương Trình Khuyến Mãi Nổi Bật</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Khám phá các gói combo vé giá cực hấp dẫn dành riêng cho tuần này.
            </p>
          </div>

          <div className="text-xs text-slate-400 hidden sm:flex items-center space-x-1.5">
            <span>Sắp xếp theo:</span>
            <select className="bg-[#111624] border border-slate-800 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none">
              <option>Mới nhất</option>
              <option>Giảm nhiều nhất</option>
              <option>Sắp hết hạn</option>
            </select>
          </div>
        </div>

        {/* Grid 6 Thẻ Khuyến Mãi */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mb-2"></div>
            <p>Đang tải danh sách khuyến mãi từ Database...</p>
          </div>
        ) : programs.length === 0 ? (
          <div className="p-12 text-center bg-[#0f1422] rounded-3xl border border-slate-800 text-slate-400 text-xs">
            Không có chương trình khuyến mãi nào phù hợp với bộ lọc này.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((prog) => (
              <div
                key={prog.id}
                className="bg-[#0f1422] border border-slate-800/90 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all duration-300 group"
              >
                <div>
                  {/* Ảnh bìa + Badges */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900">
                    <img
                      src={prog.image}
                      alt={prog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f1422] via-transparent to-transparent opacity-80" />

                    {/* Badge top-left */}
                    {prog.badgeTop && (
                      <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-md border border-white/10 shadow">
                        {prog.badgeTop}
                      </div>
                    )}

                    {/* Badge top-right (Giá/Ưu đãi) */}
                    {prog.badgeSpecial && (
                      <div
                        className={`absolute top-3 right-3 text-[11px] font-black px-2.5 py-1 rounded-md shadow ${
                          prog.badgeColor === 'emerald'
                            ? 'bg-emerald-500 text-white'
                            : prog.badgeColor === 'blue'
                            ? 'bg-blue-600 text-white'
                            : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {prog.badgeSpecial}
                      </div>
                    )}
                  </div>

                  {/* Nội dung text */}
                  <div className="p-5 space-y-2.5">
                    <h3 className="text-base font-black text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                      {prog.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {prog.description}
                    </p>

                    {/* Metadata pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-slate-400">
                      {prog.metadataLeft && (
                        <span className="bg-[#141b2c] border border-slate-800 px-2 py-0.5 rounded text-slate-300 font-medium">
                          {prog.metadataLeft}
                        </span>
                      )}
                      {prog.metadataRight && (
                        <span className="bg-[#141b2c] border border-slate-800 px-2 py-0.5 rounded text-slate-300 font-medium">
                          {prog.metadataRight}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-5 pt-0 flex items-center justify-between gap-3">
                  <button className="text-xs text-slate-400 hover:text-white font-medium transition-colors">
                    Xem thể lệ
                  </button>

                  <button
                    onClick={() => navigate(prog.buttonAction || '/theaters')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      prog.buttonText === 'Nâng cấp VIP'
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : 'bg-[#2563eb] hover:bg-blue-600 text-white'
                    }`}
                  >
                    {prog.buttonText || 'Đặt vé ngay'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. MỘT SỐ LƯU Ý KHI SỬ DỤNG MÃ ƯU ĐÃI (3 CARDS) */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-8">
        <div className="bg-[#0f1422] border border-slate-800/90 rounded-3xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <span className="text-blue-400">ℹ️</span>
              <span>Một số lưu ý khi sử dụng mã ưu đãi MovieTix</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Quy chế chung áp dụng toàn quốc
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-[#141b2c] border border-slate-800/80 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center space-x-2 text-white font-bold">
                <span className="text-amber-400">🔄</span>
                <span>Áp dụng đồng thời</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Mỗi đơn đặt vé có thể áp dụng tối đa 01 voucher giảm giá vé và 01 voucher combo bắp nước.
              </p>
            </div>

            <div className="bg-[#141b2c] border border-slate-800/80 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center space-x-2 text-white font-bold">
                <span className="text-blue-400">⏳</span>
                <span>Đổi vé & Hoàn hủy</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Vé đã áp dụng mã khuyến mãi không được hỗ trợ hoàn tiền, chỉ hỗ trợ đổi suất chiếu trước 60 phút.
              </p>
            </div>

            <div className="bg-[#141b2c] border border-slate-800/80 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center space-x-2 text-white font-bold">
                <span className="text-emerald-400">🥤</span>
                <span>Nhận bắp nước tại quầy</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Đưa mã QR trên ứng dụng MovieTix tại làn F&B FastTrack để nhận combo nhanh không cần xếp hàng.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionsPage;
