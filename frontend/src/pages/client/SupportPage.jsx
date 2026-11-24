import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { FALLBACK_CINEMAS } from '../../constants/cinemas';

const CINEMA_INFO = FALLBACK_CINEMAS[0];

const normalizeSystemText = (text = '') =>
  String(text)
    .replace(/MovieTix/gi, "D'AVENOR CINEMA")
    .replace(/1900\s*8866/g, CINEMA_INFO.hotline)
    .replace(/support@movietix\.vn/gi, 'support@davenor.vn');

const QUICK_CATEGORIES = [
  {
    id: 'payment',
    icon: '💳',
    title: 'Đặt vé & Thanh toán',
    desc: 'Xử lý trừ tiền chưa nhận vé, thanh toán VNPAY-QR/MoMo và áp dụng mã ưu đãi.',
    faqCategory: 'PAYMENT',
    keyword: '',
  },
  {
    id: 'ticket',
    icon: '🎟️',
    title: 'Vé điện tử & Check-in',
    desc: 'Quét mã QR tại cổng soát vé, xem lại mã đặt vé trong mục "Vé của tôi" và đổi suất chiếu.',
    faqCategory: 'TICKET_CINEMA',
    keyword: '',
  },
  {
    id: 'rules',
    icon: '🛡️',
    title: 'Quy định Rạp & Độ tuổi',
    desc: 'Phân loại phim P, K, T13, T16, T18; giấy tờ xác minh độ tuổi và quy định mang đồ ăn vào rạp.',
    faqCategory: 'TICKET_CINEMA',
    keyword: 'độ tuổi',
  },
  {
    id: 'member',
    icon: '🍿',
    title: 'Hội viên & Bắp nước',
    desc: 'Tài khoản thành viên, tích điểm đổi quà, mã voucher và nhận combo nhanh tại làn F&B FastTrack.',
    faqCategory: 'MEMBERSHIP',
    keyword: '',
  },
];

const HOT_QUERIES = [
  { label: 'Hoàn hủy vé', keyword: 'hủy' },
  { label: 'Mã QR vé', keyword: 'QR' },
  { label: 'Độ tuổi T18', keyword: 'T18' },
  { label: 'Thanh toán', keyword: 'thanh toán' },
  { label: 'Bắp nước', keyword: 'bắp' },
];

const FAQ_CATEGORIES = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'TICKET_CINEMA', label: 'Vé & Rạp' },
  { key: 'PAYMENT', label: 'Thanh toán' },
  { key: 'MEMBERSHIP', label: 'Hội viên' },
];

const SupportPage = () => {
  const faqSectionRef = useRef(null);
  const ticketFormRef = useRef(null);

  // State dữ liệu FAQ từ Database
  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState(null);
  const [votedMap, setVotedMap] = useState({});

  // State Form gửi yêu cầu hỗ trợ
  const [ticketForm, setTicketForm] = useState({
    fullName: '',
    contact: '',
    bookingCode: '',
    category: '',
    content: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState(null);

  // Tải danh sách FAQ từ API Backend MongoDB
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        setLoadingFaqs(true);
        const params = {};
        if (activeCategory !== 'ALL') params.category = activeCategory;
        if (searchKeyword.trim()) params.search = searchKeyword.trim();

        const res = await api.get('/support/faqs', { params });
        if (res.data) {
          const normalized = res.data.map((item) => ({
            ...item,
            question: normalizeSystemText(item.question),
            answer: normalizeSystemText(item.answer),
          }));
          setFaqs(normalized);
          const defaultOpen = normalized.find((f) => f.isDefaultOpen) || normalized[0];
          setExpandedFaqId((prev) =>
            prev && normalized.some((f) => f.id === prev) ? prev : defaultOpen?.id || null
          );
        }
      } catch (err) {
        console.error('Lỗi khi tải FAQ từ Database:', err);
      } finally {
        setLoadingFaqs(false);
      }
    };

    fetchFaqs();
  }, [activeCategory, searchKeyword]);

  const scrollToFaq = () => {
    faqSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleQuickCategoryClick = (item) => {
    setActiveCategory(item.faqCategory);
    setSearchKeyword(item.keyword);
    scrollToFaq();
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    scrollToFaq();
  };

  // Xử lý vote Hữu ích / Không hữu ích
  const handleVote = async (faqId, type) => {
    if (votedMap[faqId]) return;

    try {
      const res = await api.post(`/support/faqs/${faqId}/vote`, { type });
      setVotedMap((prev) => ({ ...prev, [faqId]: type }));
      setFaqs((prev) =>
        prev.map((f) =>
          f.id === faqId ? { ...f, likes: res.data.likes, dislikes: res.data.dislikes } : f
        )
      );
    } catch (err) {
      console.error('Lỗi vote FAQ:', err);
    }
  };

  // Xử lý nộp đơn hỗ trợ sự cố
  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!ticketForm.fullName.trim() || !ticketForm.contact.trim() || !ticketForm.content.trim()) {
      setTicketResult({
        success: false,
        message: 'Vui lòng điền đầy đủ Họ tên, SĐT/Email liên hệ và Nội dung chi tiết.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setTicketResult(null);
      const res = await api.post('/support/tickets', ticketForm);
      setTicketResult({
        success: true,
        message: res.data.message,
        ticketCode: res.data.ticket?.ticketCode,
      });
      setTicketForm({
        fullName: '',
        contact: '',
        bookingCode: '',
        category: '',
        content: '',
      });
    } catch (err) {
      setTicketResult({
        success: false,
        message: err.response?.data?.message || 'Không thể gửi yêu cầu hỗ trợ lúc này.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mở Chat Widget AI
  const handleOpenAiChat = () => {
    const chatTrigger = document.querySelector('[data-chat-toggle="true"]');
    if (chatTrigger) chatTrigger.click();
  };

  // Chọn nhanh mục thuê rạp / vé đoàn
  const handleSelectB2B = () => {
    setTicketForm((prev) => ({
      ...prev,
      category: 'Thuê rạp sự kiện & Vé đoàn',
    }));
    ticketFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="bg-[var(--bg-main)] min-h-screen text-[var(--text-main)] pb-14">
      {/* 1. HEADER & TÌM KIẾM NHANH GỌN GÀNG */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-5 pb-4">
        <div className="flex items-center space-x-2 text-xs text-[var(--text-muted)] mb-3 font-medium">
          <Link to="/" className="hover:text-[var(--text-main)] transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-[#42DFFF]">Trung tâm Hỗ trợ</span>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 rounded-2xl p-5 sm:p-7 text-center space-y-3.5 shadow-lg">
          <div className="inline-flex items-center gap-1.5 bg-[#20204B] border border-[#AA9BFF]/25 text-[#83F5FF] text-[11px] font-bold px-3 py-1 rounded-full">
            <span>🎧</span>
            <span>TRUNG TÂM HỖ TRỢ • {CINEMA_INFO.name.toUpperCase()}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-[#F4A5FF] via-[#C56BFF] to-[#83F5FF] bg-clip-text text-transparent tracking-tight">
            D'AVENOR CINEMA có thể giúp gì cho bạn?
          </h1>

          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-xl mx-auto">
            Tra cứu nhanh câu hỏi thường gặp, hỏi Trợ lý AI hoặc gửi yêu cầu trực tiếp đến đội ngũ hỗ trợ rạp.
          </p>

          {/* Thanh tìm kiếm */}
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto pt-1">
            <div className="relative flex items-center">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]/60 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm nhanh: hoàn hủy vé, mã QR, độ tuổi T18, thanh toán..."
                className="w-full bg-[var(--bg-main)] border border-[#AA9BFF]/25 rounded-xl pl-10 pr-28 py-2.5 text-xs sm:text-sm text-[var(--text-main)] placeholder-[#BEC5E5]/45 focus:outline-none focus:border-[#42DFFF] transition-colors"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-24 text-[var(--text-muted)] hover:text-white text-xs px-1.5 cursor-pointer"
                  aria-label="Xóa từ khóa"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] font-black text-xs px-4 py-1.5 rounded-lg hover:brightness-110 transition-all cursor-pointer"
              >
                Tìm kiếm
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2.5 text-xs">
              <span className="text-[11px] text-[var(--text-muted)]">Gợi ý:</span>
              {HOT_QUERIES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setActiveCategory('ALL');
                    setSearchKeyword(item.keyword);
                    scrollToFaq();
                  }}
                  className="text-[var(--text-muted)] hover:text-white hover:bg-[#20204B] bg-[var(--bg-main)] border border-[#AA9BFF]/20 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>

      {/* 2. THANH TRỢ LÝ AI NHANH GỌN */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pb-4">
        <div className="rounded-2xl border border-[#AA9BFF]/25 bg-gradient-to-r from-[#20204B]/90 via-[#11152F] to-[#20204B]/90 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] flex items-center justify-center text-lg shrink-0">
              🤖
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-black text-white">Trợ lý AI D'AVENOR CINEMA</h2>
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Trực tuyến 24/7</span>
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Hỏi nhanh lịch chiếu, số ghế trống, giá vé, ưu đãi và hướng dẫn đặt vé theo dữ liệu thực tế của rạp.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAiChat}
            className="shrink-0 bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] font-black text-xs px-4 py-2.5 rounded-xl hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>✨</span>
            <span>Mở Chat AI</span>
          </button>
        </div>
      </div>

      {/* 3. DANH MỤC HỖ TRỢ NHANH (4 THẺ CLICK LỌC FAQ) */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {QUICK_CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleQuickCategoryClick(item)}
              className="text-left bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 rounded-2xl p-4 space-y-2 hover:border-[#42DFFF]/50 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#20204B] border border-[#AA9BFF]/25 flex items-center justify-center text-base shrink-0">
                  {item.icon}
                </div>
                <h3 className="text-sm font-black text-white group-hover:text-[#42DFFF] transition-colors">
                  {item.title}
                </h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                {item.desc}
              </p>
              <span className="inline-block text-[11px] font-bold text-[#42DFFF] group-hover:text-[#83F5FF]">
                Xem giải đáp ➔
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. FAQ & FORM GỬI YÊU CẦU HỖ TRỢ */}
      <div ref={faqSectionRef} className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI (7 cols): FAQ */}
          <div className="lg:col-span-7 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">Câu hỏi thường gặp (FAQ)</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {faqs.length} câu hỏi phù hợp
                  {searchKeyword.trim() ? ` với từ khóa "${searchKeyword.trim()}"` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 p-1 rounded-xl self-start sm:self-auto">
                {FAQ_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setActiveCategory(c.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeCategory === c.key
                        ? 'bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] font-black'
                        : 'text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingFaqs ? (
              <div className="p-10 text-center text-[var(--text-muted)] text-xs">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[#42DFFF] border-t-transparent mb-2" />
                <p>Đang tải câu hỏi thường gặp...</p>
              </div>
            ) : faqs.length === 0 ? (
              <div className="p-8 text-center bg-[var(--bg-secondary)] rounded-2xl border border-[#AA9BFF]/20 space-y-2">
                <p className="text-xs text-[var(--text-muted)]">
                  Không tìm thấy câu hỏi phù hợp với từ khóa hiện tại.
                </p>
                {(searchKeyword || activeCategory !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchKeyword('');
                      setActiveCategory('ALL');
                    }}
                    className="text-xs font-bold text-[#42DFFF] hover:underline cursor-pointer"
                  >
                    Xem tất cả câu hỏi
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {faqs.map((faq) => {
                  const isOpen = expandedFaqId === faq.id;
                  const userVote = votedMap[faq.id];
                  return (
                    <div
                      key={faq.id}
                      className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 rounded-2xl overflow-hidden transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                        className="w-full text-left px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-[#20204B]/70 transition-colors cursor-pointer"
                      >
                        <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] flex items-start gap-2">
                          <span className="text-[#42DFFF] shrink-0">?</span>
                          <span>{faq.question}</span>
                        </span>
                        <span className="text-[var(--text-muted)] text-[11px] shrink-0 mt-0.5">
                          {isOpen ? '▲' : '▼'}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-2.5 space-y-3 border-t border-[#AA9BFF]/15 bg-[var(--bg-main)]/65">
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
                            {faq.answer}
                          </p>

                          <div className="flex items-center justify-between pt-2 border-t border-[#AA9BFF]/15 text-[11px] text-[var(--text-muted)]/75">
                            <span>Câu trả lời có hữu ích không?</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleVote(faq.id, 'like')}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                  userVote === 'like'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-[var(--bg-main)] border-[#AA9BFF]/20 text-[var(--text-muted)] hover:text-white'
                                }`}
                              >
                                <span>👍</span>
                                <span>Có ({faq.likes || 0})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleVote(faq.id, 'dislike')}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                  userVote === 'dislike'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                    : 'bg-[var(--bg-main)] border-[#AA9BFF]/20 text-[var(--text-muted)] hover:text-white'
                                }`}
                              >
                                <span>👎</span>
                                <span>Không ({faq.dislikes || 0})</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CỘT PHẢI (5 cols): FORM GỬI YÊU CẦU & THÔNG TIN RẠP */}
          <div ref={ticketFormRef} className="lg:col-span-5 space-y-4">
            {/* Form gửi yêu cầu */}
            <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 rounded-2xl p-5 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <span>📩</span>
                  <span>Gửi yêu cầu hỗ trợ</span>
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Phản hồi ~15 phút
                </span>
              </div>

              <p className="text-xs text-[var(--text-muted)]">
                Điền thông tin sự cố để nhân viên hỗ trợ xử lý và phản hồi qua SĐT/Email của bạn.
              </p>

              {ticketResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold leading-relaxed ${
                    ticketResult.success
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-300 border border-red-500/30'
                  }`}
                >
                  {ticketResult.message}
                  {ticketResult.ticketCode && (
                    <span className="block mt-1 font-mono font-bold text-white">
                      Mã phiếu: #{ticketResult.ticketCode}
                    </span>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmitTicket} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Họ và tên *
                    </label>
                    <input
                      type="text"
                      required
                      value={ticketForm.fullName}
                      onChange={(e) => setTicketForm({ ...ticketForm, fullName: e.target.value })}
                      placeholder="Nguyễn Văn A"
                      className="w-full bg-[var(--bg-main)] border border-[#AA9BFF]/25 rounded-xl px-3 py-2 text-xs text-[var(--text-main)] placeholder-[#BEC5E5]/40 focus:outline-none focus:border-[#42DFFF]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      SĐT / Email liên hệ *
                    </label>
                    <input
                      type="text"
                      required
                      value={ticketForm.contact}
                      onChange={(e) => setTicketForm({ ...ticketForm, contact: e.target.value })}
                      placeholder="0912 345 678"
                      className="w-full bg-[var(--bg-main)] border border-[#AA9BFF]/25 rounded-xl px-3 py-2 text-xs text-[var(--text-main)] placeholder-[#BEC5E5]/40 focus:outline-none focus:border-[#42DFFF]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Mã đặt vé (nếu có)
                    </label>
                    <input
                      type="text"
                      value={ticketForm.bookingCode}
                      onChange={(e) => setTicketForm({ ...ticketForm, bookingCode: e.target.value })}
                      placeholder="DAV-982134-VN"
                      className="w-full bg-[var(--bg-main)] border border-[#AA9BFF]/25 rounded-xl px-3 py-2 text-xs text-[var(--text-main)] placeholder-[#BEC5E5]/40 focus:outline-none focus:border-[#42DFFF] uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Phân loại vấn đề *
                    </label>
                    <select
                      required
                      value={ticketForm.category}
                      onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                      className="w-full bg-[var(--bg-main)] border border-[#AA9BFF]/25 rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[#42DFFF] cursor-pointer"
                    >
                      <option value="">Chọn phân loại...</option>
                      <option value="Lỗi trừ tiền chưa nhận vé">Lỗi trừ tiền chưa nhận vé</option>
                      <option value="Đổi suất chiếu khẩn cấp">Đổi suất chiếu</option>
                      <option value="Thắc mắc quy định độ tuổi">Quy định độ tuổi</option>
                      <option value="Vấn đề bắp nước & quà tặng">Bắp nước & ưu đãi</option>
                      <option value="Thuê rạp sự kiện & Vé đoàn">Thuê rạp & Vé đoàn</option>
                      <option value="Khác">Vấn đề khác</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                    Nội dung chi tiết *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={ticketForm.content}
                    onChange={(e) => setTicketForm({ ...ticketForm, content: e.target.value })}
                    placeholder="Mô tả vấn đề bạn gặp phải, suất chiếu hoặc mã giao dịch..."
                    className="w-full bg-[var(--bg-main)] border border-[#AA9BFF]/25 rounded-xl px-3 py-2 text-xs text-[var(--text-main)] placeholder-[#BEC5E5]/40 focus:outline-none focus:border-[#42DFFF] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] font-black text-xs py-2.5 rounded-xl hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu hỗ trợ ➔'}
                </button>
              </form>
            </div>

            {/* Thông tin liên hệ đồng bộ với hệ thống rạp */}
            <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/20 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#AA9BFF]/15">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">📞</span>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block">Hotline hỗ trợ</span>
                    <a href={`tel:${CINEMA_INFO.hotline.replace(/\s+/g, '')}`} className="text-sm font-black text-white hover:text-[#42DFFF]">
                      {CINEMA_INFO.hotline}
                    </a>
                  </div>
                </div>
                <span className="text-[11px] text-[#42DFFF] font-semibold">
                  {CINEMA_INFO.openingHours}
                </span>
              </div>

              <div className="flex items-start gap-2.5 pb-2.5 border-b border-[#AA9BFF]/15">
                <span className="text-lg">📍</span>
                <div>
                  <strong className="text-xs font-bold text-white block">{CINEMA_INFO.name}</strong>
                  <span className="text-[11px] text-[var(--text-muted)] leading-snug block">
                    {CINEMA_INFO.address}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">✉️</span>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block">Email hỗ trợ & khiếu nại</span>
                    <a href="mailto:support@davenor.vn" className="text-xs font-bold text-[#42DFFF] hover:underline">
                      support@davenor.vn
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSelectB2B}
                  className="bg-[#20204B] text-[#83F5FF] border border-[#42DFFF]/35 text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-[#25234D] transition-colors cursor-pointer"
                >
                  Đặt vé đoàn
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
