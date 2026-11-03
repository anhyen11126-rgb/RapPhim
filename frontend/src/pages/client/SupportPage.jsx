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
    <div className="bg-[#0b0f19] min-h-screen text-slate-100 pb-20">
      {/* 1. BREADCRUMBS & HERO SEARCH HEADER */}
      <div className="max-w-[1560px] mx-auto px-4 sm:px-8 pt-5 pb-8 text-center sm:text-left">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-400 mb-3 font-medium justify-center sm:justify-start">
          <Link to="/" className="hover:text-white transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-slate-400">Chăm sóc khách hàng</span>
          <span>/</span>
          <span className="text-slate-200">Trung tâm Hỗ trợ & FAQ</span>
        </div>

        {/* Tiêu đề trung tâm */}
        <div className="max-w-3xl mx-auto text-center space-y-3 pt-2">
          <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold px-3 py-1 rounded-full">
            <span>🎧</span>
            <span>TRUNG TÂM TRỢ GIÚP 24/7 • GIẢI ĐÁP TỨC THÌ</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            D'AVENOR CINEMA có thể giúp gì cho bạn hôm nay?
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl mx-auto">
            Tìm kiếm câu trả lời nhanh chóng hoặc kết nối trực tiếp với đội ngũ Chăm sóc Khách hàng & Trợ lý ảo AI của D'AVENOR CINEMA.
          </p>

          {/* Ô Tìm Kiếm Lớn */}
          <div className="pt-3 max-w-2xl mx-auto">
            <div className="relative flex items-center shadow-2xl">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Nhập vấn đề bạn cần hỗ trợ: hoàn hủy vé, quên mã QR, quy định độ tuổi T18, lỗi ví..."
                className="w-full bg-[#111624] border border-slate-700/80 rounded-2xl pl-11 pr-28 py-3.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
              />
              <button
                type="button"
                className="absolute right-2 bg-[#2563eb] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                Tìm kiếm ➔
              </button>
            </div>

            {/* Các thẻ tìm kiếm phổ biến */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs">
              <span className="text-slate-400 font-medium flex items-center space-x-1">
                <span>🔥</span>
                <span>Tìm kiếm phổ biến:</span>
              </span>
              {hotQueries.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearchKeyword(tag.replace('#', ''))}
                  className="text-slate-300 hover:text-white hover:bg-slate-800/80 bg-[#121929] border border-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
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
        <div className="relative rounded-3xl overflow-hidden border border-slate-800/90 bg-gradient-to-r from-[#121929] via-[#0f1424] to-[#121929] p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-[#2563eb] text-white flex items-center justify-center text-xl shrink-0 shadow-lg shadow-blue-600/30">
              🤖
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black px-2 py-0.5 rounded">
                  CÔNG NGHỆ RAG NEURAL
                </span>
                <span className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Trực tuyến 24/7 • Phản hồi 0.5s</span>
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Cần tra cứu lịch chiếu, giá vé hoặc giải đáp tức thì trong 3 giây? Hãy hỏi Trợ lý AI D'AVENOR CINEMA!
              </h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Hệ thống RAG AI thông minh được huấn luyện trên dữ liệu 12 cụm rạp, cập nhật giá vé, suất chiếu IMAX Laser và chính sách khuyến mãi theo thời gian thực.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAiChat}
            className="shrink-0 bg-[#2563eb] hover:bg-blue-600 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center space-x-2"
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
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">
              CHUYÊN MỤC PHỔ BIẾN
            </span>
            <h2 className="text-base sm:text-lg font-black text-white">Danh mục Hỗ trợ Nhanh</h2>
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            Chọn danh mục bạn cần giải đáp tức thì
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-[#0f1422] border border-slate-800/90 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg text-blue-400">
              💳
            </div>
            <h3 className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">
              Đặt vé & Thanh toán
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
              Xử lý tài khoản bị trừ tiền nhưng chưa nhận mã vé, thanh toán ví MoMo/VNPay và xuất hóa đơn VAT điện tử.
            </p>
            <span className="inline-block text-xs font-bold text-blue-400 group-hover:text-blue-300 transition-colors pt-1">
              Xem 14 hướng dẫn ➔
            </span>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0f1422] border border-slate-800/90 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-lg text-cyan-400">
              🎟️
            </div>
            <h3 className="text-sm font-black text-white group-hover:text-cyan-400 transition-colors">
              Vé điện tử & Check-in
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
              Cách quét mã QR tại cổng kiểm soát, đồng bộ thẻ vé Apple/Google Wallet và lấy lại mã vé qua tin nhắn SMS.
            </p>
            <span className="inline-block text-xs font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors pt-1">
              Xem 9 hướng dẫn ➔
            </span>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0f1422] border border-slate-800/90 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg text-amber-400">
              🛡️
            </div>
            <h3 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">
              Quy định Rạp & Độ tuổi
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
              Chi tiết phân loại phim P, K, T13, T16, T18; giấy tờ xác minh tùy thân Căn cước/VNeID và quy định F&B ngoài rạp.
            </p>
            <span className="inline-block text-xs font-bold text-amber-400 group-hover:text-amber-300 transition-colors pt-1">
              Xem 11 quy chuẩn ➔
            </span>
          </div>

          {/* Card 4 */}
          <div className="bg-[#0f1422] border border-slate-800/90 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg text-emerald-400">
              🏅
            </div>
            <h3 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">
              Thẻ thành viên & Bắp nước
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
              Chính sách tích lũy điểm Star X3, nâng hạng Diamond Pass, quà sinh nhật và làn ưu tiên FastTrack bắp nước.
            </p>
            <span className="inline-block text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors pt-1">
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
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">
                  HỎI ĐÁP TRỰC TIẾP
                </span>
                <h2 className="text-base sm:text-lg font-black text-white">Câu hỏi thường gặp (FAQ)</h2>
              </div>

              {/* Tabs lọc category FAQ */}
              <div className="flex items-center space-x-1 bg-[#121929] border border-slate-800 p-1 rounded-xl">
                {faqCategories.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setActiveCategory(c.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeCategory === c.key
                        ? 'bg-[#2563eb] text-white shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingFaqs ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent mb-2"></div>
                <p>Đang tải câu hỏi thường gặp từ Database...</p>
              </div>
            ) : faqs.length === 0 ? (
              <div className="p-8 text-center bg-[#0f1422] rounded-2xl border border-slate-800 text-slate-400 text-xs">
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
                      className="bg-[#0f1422] border border-slate-800/90 rounded-2xl overflow-hidden transition-colors"
                    >
                      {/* Tiêu đề câu hỏi (Click để mở rộng/thu gọn) */}
                      <button
                        type="button"
                        onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                        className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                      >
                        <span className="text-xs sm:text-sm font-bold text-white flex items-start space-x-2.5">
                          <span className="text-blue-400 shrink-0">❓</span>
                          <span>{faq.question}</span>
                        </span>
                        <span className="text-slate-400 text-xs shrink-0 mt-0.5">
                          {isOpen ? '▲' : '▼'}
                        </span>
                      </button>

                      {/* Nội dung câu trả lời */}
                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-800/60 bg-[#121929]/50">
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                            {faq.answer}
                          </p>

                          {/* Đánh giá câu trả lời */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                            <span>Câu trả lời có hữu ích không?</span>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleVote(faq.id, 'like')}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-all ${
                                  userVote === 'like'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                                }`}
                              >
                                <span>👍</span>
                                <span>Có ({faq.likes || 0})</span>
                              </button>

                              <button
                                onClick={() => handleVote(faq.id, 'dislike')}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-all ${
                                  userVote === 'dislike'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
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
            <div className="bg-[#0f1422] border border-slate-800/90 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <span>📩</span>
                  <span>Gửi yêu cầu hỗ trợ</span>
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Phản hồi ~15 phút
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
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
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    required
                    value={ticketForm.fullName}
                    onChange={(e) => setTicketForm({ ...ticketForm, fullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-[#141b2c] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Số điện thoại / Email liên hệ *
                  </label>
                  <input
                    type="text"
                    required
                    value={ticketForm.contact}
                    onChange={(e) => setTicketForm({ ...ticketForm, contact: e.target.value })}
                    placeholder="0912 345 678 hoặc email@..."
                    className="w-full bg-[#141b2c] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Mã đặt vé / Giao dịch (Nếu có)
                  </label>
                  <input
                    type="text"
                    value={ticketForm.bookingCode}
                    onChange={(e) => setTicketForm({ ...ticketForm, bookingCode: e.target.value })}
                    placeholder="MTX-982134-VN"
                    className="w-full bg-[#141b2c] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Chọn phân loại vấn đề *
                  </label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                    className="w-full bg-[#141b2c] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
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
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Nội dung chi tiết *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={ticketForm.content}
                    onChange={(e) => setTicketForm({ ...ticketForm, content: e.target.value })}
                    placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải, đính kèm tên cụm rạp, suất chiếu..."
                    className="w-full bg-[#141b2c] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-blue-600/20"
                >
                  {isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu hỗ trợ ngay ➔'}
                </button>
              </form>
            </div>

            {/* Các thẻ Liên Hệ Trực Tiếp */}
            <div className="bg-[#0f1422] border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <span className="text-xl">📞</span>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">
                      Hotline Chăm sóc (1.000đ/phút)
                    </span>
                    <strong className="text-sm font-black text-white">1900 8866</strong>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">08:00 - 23:00 hàng ngày</span>
              </div>

              <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-800/80">
                <span className="text-xl">✉️</span>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">
                    Email giải quyết khiếu nại:
                  </span>
                  <a href="mailto:support@davenor.vn" className="text-xs font-bold text-blue-400 hover:underline">
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
                  className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-lg hover:bg-amber-500/30 transition-colors"
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

