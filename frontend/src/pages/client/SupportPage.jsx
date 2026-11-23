import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const SupportPage = () => {
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

  // 1. Tải danh sách FAQ từ API Backend MongoDB
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        setLoadingFaqs(true);
        const params = {};
        if (activeCategory !== 'ALL') params.category = activeCategory;
        if (searchKeyword.trim()) params.search = searchKeyword.trim();

        const res = await api.get('/support/faqs', { params });
        if (res.data) {
          setFaqs(res.data);
          // Mở mặc định FAQ đầu tiên nếu có
          const defaultOpen = res.data.find((f) => f.isDefaultOpen) || res.data[0];
          if (defaultOpen && !expandedFaqId) {
            setExpandedFaqId(defaultOpen.id);
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải FAQ từ Database:', err);
      } finally {
        setLoadingFaqs(false);
      }
    };

    fetchFaqs();
  }, [activeCategory, searchKeyword]);

  // Xử lý vote Hữu ích / Không hữu ích
  const handleVote = async (faqId, type) => {
    if (votedMap[faqId]) return;

    try {
      const res = await api.post(`/support/faqs/${faqId}/vote`, { type });
      setVotedMap((prev) => ({ ...prev, [faqId]: type }));

      // Cập nhật số like/dislike trực tiếp trên UI
      setFaqs((prev) =>
        prev.map((f) =>
          f.id === faqId
            ? { ...f, likes: res.data.likes, dislikes: res.data.dislikes }
            : f
        )
      );
    } catch (err) {
      console.error('Lỗi vote FAQ:', err);
    }
  };

  // Xử lý nộp đơn hỗ trợ sự cố
  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!ticketForm.fullName || !ticketForm.contact || !ticketForm.content) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
      return;
    }

    try {
      setIsSubmitting(true);
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

  const faqCategories = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'TICKET_CINEMA', label: 'Vé & Rạp' },
    { key: 'PAYMENT', label: 'Thanh toán' },
    { key: 'MEMBERSHIP', label: 'Hội viên' },
  ];

  const hotQueries = [
    '#HủyVé',
    '#QuênMãQR',
    '#ĐộTuổiT18',
    '#LỗiThanhToánVNPay',
    '#ComboBắpAvatar',
  ];

  return (
    <div className="bg-[#0B1026] min-h-screen text-[#F8F7FF] pb-20">
      {/* 1. BREADCRUMBS & HERO SEARCH HEADER */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-5 pb-8 text-center sm:text-left">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-[#BEC5E5] mb-3 font-medium justify-center sm:justify-start">
          <Link to="/" className="hover:text-[#F8F7FF] transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-[#BEC5E5]/70">Chăm sóc khách hàng</span>
          <span>/</span>
          <span className="text-[#42DFFF]">Trung tâm Hỗ trợ & FAQ</span>
        </div>

        {/* Tiêu đề trung tâm */}
        <div className="max-w-3xl mx-auto text-center space-y-3 pt-2">
          <div className="inline-flex items-center space-x-2 bg-[#20204B] border border-[#AA9BFF]/30 text-[#83F5FF] text-[11px] font-bold px-3 py-1 rounded-full">
            <span>🎧</span>
            <span>TRUNG TÂM TRỢ GIÚP 24/7 • GIẢI ĐÁP TỨC THÌ</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black bg-gradient-to-r from-[#F4A5FF] via-[#C56BFF] via-[#83F5FF] to-[#F4A5FF] bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(168,85,247,0.35)] tracking-tight leading-tight">
            D'AVENOR CINEMA có thể giúp gì cho bạn hôm nay?
          </h1>

          <p className="text-xs sm:text-sm text-[#BEC5E5] leading-relaxed max-w-xl mx-auto">
            Tìm kiếm câu trả lời nhanh chóng hoặc kết nối trực tiếp với đội ngũ Chăm sóc Khách hàng & Trợ lý ảo AI của D'AVENOR CINEMA.
          </p>

          {/* Ô Tìm Kiếm Lớn */}
          <div className="pt-3 max-w-2xl mx-auto">
            <div className="relative flex items-center shadow-2xl">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#BEC5E5]/60 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Nhập vấn đề bạn cần hỗ trợ: hoàn hủy vé, quên mã QR, quy định độ tuổi T18, lỗi ví..."
                className="w-full bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl pl-11 pr-28 py-3.5 text-xs sm:text-sm text-[#F8F7FF] placeholder-[#BEC5E5]/40 focus:outline-none focus:border-[#42DFFF] transition-all shadow-inner"
              />
              <button
                type="button"
                className="absolute right-2 bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-[0_0_12px_rgba(168,85,247,0.35)] hover:brightness-110 cursor-pointer"
              >
                Tìm kiếm ➔
              </button>
            </div>

            {/* Các thẻ tìm kiếm phổ biến */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs">
              <span className="text-[#BEC5E5] font-medium flex items-center space-x-1">
                <span>🔥</span>
                <span>Tìm kiếm phổ biến:</span>
              </span>
              {hotQueries.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearchKeyword(tag.replace('#', ''))}
                  className="text-[#BEC5E5] hover:text-[#F8F7FF] hover:bg-[#20204B] bg-[#11152F] border border-[#AA9BFF]/20 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. AI ASSISTANT BANNER CARD */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 py-3">
        <div className="relative rounded-3xl overflow-hidden border border-[#AA9BFF]/25 bg-gradient-to-r from-[#20204B] via-[#11152F] to-[#20204B] p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] flex items-center justify-center text-xl shrink-0 shadow-lg shadow-purple-500/25">
              🤖
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-[#20204B] text-[#42DFFF] border border-[#42DFFF]/30 text-[10px] font-black px-2 py-0.5 rounded">
                  CÔNG NGHỆ RAG NEURAL
                </span>
                <span className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Trực tuyến 24/7 • Phản hồi 0.5s</span>
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-[#F8F7FF]">
                Cần tra cứu lịch chiếu, giá vé hoặc giải đáp tức thì trong 3 giây? Hãy hỏi Trợ lý AI D'AVENOR CINEMA!
              </h3>
              <p className="text-xs text-[#BEC5E5] max-w-2xl leading-relaxed">
                Hệ thống RAG AI thông minh được huấn luyện trên dữ liệu cụm rạp D'AVENOR Thanh Khê Plaza, cập nhật giá vé, suất chiếu IMAX Laser và chính sách khuyến mãi theo thời gian thực.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAiChat}
            className="shrink-0 bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] font-black text-xs sm:text-sm px-5 py-3 rounded-xl transition-all shadow-[0_0_16px_rgba(168,85,247,0.35)] hover:brightness-110 flex items-center space-x-2 cursor-pointer"
          >
            <span>✨</span>
            <span>Mở khung Chat AI ngay</span>
          </button>
        </div>
      </div>

      {/* 3. CHUYÊN MỤC PHỔ BIẾN (4 THẺ NHANH) */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#42DFFF] block">
              CHUYÊN MỤC PHỔ BIẾN
            </span>
            <h2 className="text-base sm:text-lg font-black text-[#F8F7FF]">Danh mục Hỗ trợ Nhanh</h2>
          </div>
          <span className="text-xs text-[#BEC5E5] font-medium hidden sm:inline">
            Chọn danh mục bạn cần giải đáp tức thì
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl p-5 space-y-3 hover:border-[#42DFFF]/60 transition-all group shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-[#20204B] border border-[#AA9BFF]/30 flex items-center justify-center text-lg text-[#83F5FF]">
              💳
            </div>
            <h3 className="text-sm font-black text-[#F8F7FF] group-hover:text-[#42DFFF] transition-colors">
              Đặt vé & Thanh toán
            </h3>
            <p className="text-xs text-[#BEC5E5] leading-relaxed line-clamp-3">
              Xử lý tài khoản bị trừ tiền nhưng chưa nhận mã vé, thanh toán ví MoMo/VNPay và xuất hóa đơn VAT điện tử.
            </p>
            <span className="inline-block text-xs font-bold text-[#42DFFF] group-hover:text-[#83F5FF] transition-colors pt-1">
              Xem 14 hướng dẫn ➔
            </span>
          </div>

          {/* Card 2 */}
          <div className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl p-5 space-y-3 hover:border-[#42DFFF]/60 transition-all group shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-[#20204B] border border-[#AA9BFF]/30 flex items-center justify-center text-lg text-[#83F5FF]">
              🎟️
            </div>
            <h3 className="text-sm font-black text-[#F8F7FF] group-hover:text-[#42DFFF] transition-colors">
              Vé điện tử & Check-in
            </h3>
            <p className="text-xs text-[#BEC5E5] leading-relaxed line-clamp-3">
              Cách quét mã QR tại cổng kiểm soát, đồng bộ thẻ vé Apple/Google Wallet và lấy lại mã vé qua tin nhắn SMS.
            </p>
            <span className="inline-block text-xs font-bold text-[#42DFFF] group-hover:text-[#83F5FF] transition-colors pt-1">
              Xem 9 hướng dẫn ➔
            </span>
          </div>

          {/* Card 3 */}
          <div className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl p-5 space-y-3 hover:border-[#42DFFF]/60 transition-all group shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-[#20204B] border border-[#AA9BFF]/30 flex items-center justify-center text-lg text-[#83F5FF]">
              🛡️
            </div>
            <h3 className="text-sm font-black text-[#F8F7FF] group-hover:text-[#42DFFF] transition-colors">
              Quy định Rạp & Độ tuổi
            </h3>
            <p className="text-xs text-[#BEC5E5] leading-relaxed line-clamp-3">
              Chi tiết phân loại phim P, K, T13, T16, T18; giấy tờ xác minh tùy thân Căn cước/VNeID và quy định F&B ngoài rạp.
            </p>
            <span className="inline-block text-xs font-bold text-[#42DFFF] group-hover:text-[#83F5FF] transition-colors pt-1">
              Xem 11 quy chuẩn ➔
            </span>
          </div>

          {/* Card 4 */}
          <div className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl p-5 space-y-3 hover:border-[#42DFFF]/60 transition-all group shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-[#20204B] border border-[#AA9BFF]/30 flex items-center justify-center text-lg text-[#83F5FF]">
              🏅
            </div>
            <h3 className="text-sm font-black text-[#FFF3DE] group-hover:text-[#FFCC45] transition-colors">
              Thẻ thành viên & Bắp nước
            </h3>
            <p className="text-xs text-[#D6BFA3] leading-relaxed line-clamp-3">
              Chính sách tích lũy điểm Star X3, nâng hạng Diamond Pass, quà sinh nhật và làn ưu tiên FastTrack bắp nước.
            </p>
            <span className="inline-block text-xs font-bold text-[#FFCC45] group-hover:text-[#FFE17B] transition-colors pt-1">
              Xem 8 quyền lợi ➔
            </span>
          </div>
        </div>
      </div>

      {/* 4. HỎI ĐÁP TRỰC TIẾP (FAQ) & FORM GỬI YÊU CẦU HỖ TRỢ */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CỘT TRÁI (7 cols): CÂU HỎI THƯỜNG GẶP (FAQ ACCORDION) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FFCC45] block">
                  HỎI ĐÁP TRỰC TIẾP
                </span>
                <h2 className="text-base sm:text-lg font-black text-[#FFF3DE]">Câu hỏi thường gặp (FAQ)</h2>
              </div>

              {/* Tabs lọc category FAQ */}
              <div className="flex items-center space-x-1 bg-[#0B1026] border border-[#AA9BFF]/25 p-1 rounded-xl">
                {faqCategories.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setActiveCategory(c.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeCategory === c.key
                        ? 'bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] font-black shadow-sm'
                        : 'text-[#BEC5E5] hover:text-[#F8F7FF]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingFaqs ? (
              <div className="p-12 text-center text-[#BEC5E5] text-xs">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[#42DFFF] border-t-transparent mb-2"></div>
                <p>Đang tải câu hỏi thường gặp từ Database...</p>
              </div>
            ) : faqs.length === 0 ? (
              <div className="p-8 text-center bg-[#11152F] rounded-2xl border border-[#AA9BFF]/25 text-[#BEC5E5] text-xs">
                Không tìm thấy câu hỏi phù hợp.
              </div>
            ) : (
              <div className="space-y-3">
                {faqs.map((faq) => {
                  const isOpen = expandedFaqId === faq.id;
                  const userVote = votedMap[faq.id];
                  return (
                    <div
                      key={faq.id}
                      className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl overflow-hidden transition-colors"
                    >
                      {/* Tiêu đề câu hỏi */}
                      <button
                        type="button"
                        onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                        className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-3 hover:bg-[#20204B] transition-colors cursor-pointer"
                      >
                        <span className="text-xs sm:text-sm font-bold text-[#F8F7FF] flex items-start space-x-2.5">
                          <span className="text-[#42DFFF] shrink-0">❓</span>
                          <span>{faq.question}</span>
                        </span>
                        <span className="text-[#BEC5E5] text-xs shrink-0 mt-0.5">
                          {isOpen ? '▲' : '▼'}
                        </span>
                      </button>

                      {/* Nội dung câu trả lời */}
                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-[#AA9BFF]/20 bg-[#0B1026]/80">
                          <p className="text-xs text-[#BEC5E5] leading-relaxed whitespace-pre-line">
                            {faq.answer}
                          </p>

                          {/* Đánh giá câu trả lời */}
                          <div className="flex items-center justify-between pt-2 border-t border-[#AA9BFF]/15 text-[11px] text-[#BEC5E5]/70">
                            <span>Câu trả lời có hữu ích không?</span>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleVote(faq.id, 'like')}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                                  userVote === 'like'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-[#0B1026] border-[#AA9BFF]/20 text-[#BEC5E5] hover:text-[#F8F7FF]'
                                }`}
                              >
                                <span>👍</span>
                                <span>Có ({faq.likes || 0})</span>
                              </button>

                              <button
                                onClick={() => handleVote(faq.id, 'dislike')}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                                  userVote === 'dislike'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                    : 'bg-[#0B1026] border-[#AA9BFF]/20 text-[#BEC5E5] hover:text-[#F8F7FF]'
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

          {/* CỘT PHẢI (5 cols): FORM GỬI YÊU CẦU HỖ TRỢ & LIÊN HỆ */}
          <div className="lg:col-span-5 space-y-4">
            {/* Form Hộp Ticket */}
            <div className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-[#F8F7FF] flex items-center space-x-2">
                  <span>📩</span>
                  <span>Gửi yêu cầu hỗ trợ</span>
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Phản hồi ~15 phút
                </span>
              </div>

              <p className="text-xs text-[#BEC5E5] leading-relaxed">
                Điền thông tin sự cố để chuyên viên kỹ thuật xử lý và gửi phản hồi ngay về số điện thoại của bạn.
              </p>

              {ticketResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold leading-relaxed ${
                    ticketResult.success
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
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

              <form onSubmit={handleSubmitTicket} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#BEC5E5] mb-1">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    required
                    value={ticketForm.fullName}
                    onChange={(e) => setTicketForm({ ...ticketForm, fullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3.5 py-2.5 text-xs text-[#F8F7FF] placeholder-[#BEC5E5]/40 focus:outline-none focus:border-[#42DFFF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#BEC5E5] mb-1">
                    Số điện thoại / Email liên hệ *
                  </label>
                  <input
                    type="text"
                    required
                    value={ticketForm.contact}
                    onChange={(e) => setTicketForm({ ...ticketForm, contact: e.target.value })}
                    placeholder="0912 345 678 hoặc email@..."
                    className="w-full bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3.5 py-2.5 text-xs text-[#F8F7FF] placeholder-[#BEC5E5]/40 focus:outline-none focus:border-[#42DFFF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#BEC5E5] mb-1">
                    Mã đặt vé / Giao dịch (Nếu có)
                  </label>
                  <input
                    type="text"
                    value={ticketForm.bookingCode}
                    onChange={(e) => setTicketForm({ ...ticketForm, bookingCode: e.target.value })}
                    placeholder="MTX-982134-VN"
                    className="w-full bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3.5 py-2.5 text-xs text-[#F8F7FF] placeholder-[#BEC5E5]/40 focus:outline-none focus:border-[#42DFFF] uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#BEC5E5] mb-1">
                    Chọn phân loại vấn đề *
                  </label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                    className="w-full bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3.5 py-2.5 text-xs text-[#BEC5E5] focus:outline-none focus:border-[#42DFFF] cursor-pointer"
                  >
                    <option value="">Vui lòng chọn phân loại...</option>
                    <option value="Lỗi trừ tiền chưa nhận vé">Lỗi trừ tiền chưa nhận vé</option>
                    <option value="Đổi suất chiếu khẩn cấp">Đổi suất chiếu khẩn cấp</option>
                    <option value="Thắc mắc quy định độ tuổi">Thắc mắc quy định độ tuổi</option>
                    <option value="Vấn đề bắp nước & quà tặng">Vấn đề bắp nước & quà tặng</option>
                    <option value="Khác">Vấn đề khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#BEC5E5] mb-1">
                    Nội dung chi tiết *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={ticketForm.content}
                    onChange={(e) => setTicketForm({ ...ticketForm, content: e.target.value })}
                    placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải, đính kèm tên cụm rạp, suất chiếu..."
                    className="w-full bg-[#0B1026] border border-[#AA9BFF]/25 rounded-xl px-3.5 py-2 text-xs text-[#F8F7FF] placeholder-[#BEC5E5]/40 focus:outline-none focus:border-[#42DFFF] resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] font-black text-xs py-3 rounded-xl transition-all shadow-[0_0_16px_rgba(168,85,247,0.35)] hover:brightness-110 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu hỗ trợ ngay ➔'}
                </button>
              </form>
            </div>

            {/* Các thẻ Liên Hệ Trực Tiếp */}
            <div className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#AA9BFF]/20">
                <div className="flex items-center space-x-2.5">
                  <span className="text-xl">📞</span>
                  <div>
                    <span className="text-[10px] text-[#BEC5E5]/70 block font-semibold">
                      Hotline Chăm sóc (1.000đ/phút)
                    </span>
                    <strong className="text-sm font-black text-[#F8F7FF]">1900 8866</strong>
                  </div>
                </div>
                <span className="text-[10px] text-[#BEC5E5] font-medium">08:00 - 23:00 hàng ngày</span>
              </div>

              <div className="flex items-center space-x-2.5 pb-2 border-b border-[#AA9BFF]/20">
                <span className="text-xl">✉️</span>
                <div>
                  <span className="text-[10px] text-[#BEC5E5]/70 block font-semibold">
                    Email giải quyết khiếu nại:
                  </span>
                  <a href="mailto:support@davenor.vn" className="text-xs font-bold text-[#42DFFF] hover:underline">
                    support@davenor.vn
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2.5">
                  <span className="text-xl">🏢</span>
                  <div>
                    <strong className="text-xs font-bold text-white block">Thuê rạp sự kiện & Vé đoàn</strong>
                    <span className="text-[10px] text-slate-400">Dành cho nhóm từ 20 người trở lên</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="bg-[#20204B] text-[#83F5FF] border border-[#42DFFF]/40 text-[10px] font-bold px-2.5 py-1 rounded-lg hover:bg-[#25234D] transition-colors"
                >
                  Liên hệ B2B
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

