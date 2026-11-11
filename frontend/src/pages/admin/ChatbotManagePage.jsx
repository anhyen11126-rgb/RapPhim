import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const INTENT_LABELS = {
  GREETING: { label: '👋 Chào hỏi mở đầu', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  GRATITUDE: { label: '🥰 Cảm ơn / Phản hồi', cls: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  GOODBYE: { label: '👋 Tạm biệt', cls: 'bg-slate-700/50 text-slate-300 border-slate-600' },
  BOT_IDENTITY: { label: '🤖 Hỏi thông tin Bot', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  COUPLE_DATING: { label: '💑 Tư vấn Hẹn hò / Cặp đôi', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  MOOD_THERAPY: { label: '🌈 Tâm sự / Xả stress', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  PAYMENT_GUIDE: { label: '💳 Hướng dẫn Thanh toán', cls: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  MEMBERSHIP_TIER: { label: '👑 Hạng thẻ & Tích điểm', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  COMING_SOON: { label: '🍿 Phim sắp chiếu', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  GENRE_SEARCH: { label: '🎭 Tìm theo thể loại', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  CONVERSATIONAL_FOLLOWUP: { label: '💬 Trò chuyện tự nhiên', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  MOVIE_DETAIL: { label: '🎬 Tra cứu phim', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  SHOWTIME_3D: { label: '👓 Suất chiếu 3D', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  PROMOTION_VOUCHER: { label: '🎁 Ưu đãi & Voucher', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  CONCESSION_COMBO: { label: '🍿 Bắp nước & Combo', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  PRICE_TICKET: { label: '🎟️ Giá vé', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  CINEMA_LOCATION: { label: '🏢 Cụm rạp Đà Nẵng', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
  KIDS_FAMILY_MOVIE: { label: '👨‍👩‍👧 Phim gia đình', cls: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  TOP_RECOMMENDATION: { label: '✨ Tư vấn ghế & IMAX', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  GEMINI_RAG: { label: '🤖 Gemini AI RAG', cls: 'bg-blue-600/20 text-blue-300 border-blue-400/40' },
};

const ChatbotManagePage = () => {
  const [activeTab, setActiveTab] = useState('LOGS'); // 'LOGS' | 'FAQS' | 'CONFIG'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({
    botName: "Trợ lý AI D'AVENOR",
    botVersion: 'Concierge v3.0',
    welcomeMessage: '',
    systemPromptNote: '',
    isEnabled: true,
    quickChips: [],
    faqs: [],
  });
  const [logs, setLogs] = useState([]);
  const [ragStats, setRagStats] = useState({
    hasGeminiKey: false,
    engineMode: 'Database RAG Engine (Trực tiếp MongoDB)',
    movies: 0,
    showtimes: 0,
    concessions: 0,
    promotions: 0,
  });

  // Form thêm mới kịch bản FAQ
  const [faqForm, setFaqForm] = useState({
    title: '',
    keywords: '',
    category: 'POLICY',
    answer: '',
  });

  // Khung test nhanh Chatbot ngay tại trang Admin
  const [testQuestion, setTestQuestion] = useState('');
  const [testReply, setTestReply] = useState(null);
  const [testingBot, setTestingBot] = useState(false);
  const [searchLog, setSearchLog] = useState('');

  useEffect(() => {
    fetchChatbotData();
  }, []);

  const fetchChatbotData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/chatbot');
      if (res.data) {
        if (res.data.config) setConfig(res.data.config);
        if (Array.isArray(res.data.logs)) setLogs(res.data.logs);
        if (res.data.ragStats) setRagStats(res.data.ragStats);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu quản lý Chatbot AI:', err);
    } finally {
      setLoading(false);
    }
  };

  // Lưu cấu hình chung & Quick Chips
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/admin/chatbot/config', {
        botName: config.botName,
        botVersion: config.botVersion,
        welcomeMessage: config.welcomeMessage,
        systemPromptNote: config.systemPromptNote,
        isEnabled: config.isEnabled,
        quickChips: config.quickChips,
      });
      alert(res.data?.message || 'Đã lưu cấu hình Chatbot AI thành công!');
      fetchChatbotData();
    } catch (err) {
      alert('Lỗi lưu cấu hình: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Bật / Tắt nhanh trạng thái hoạt động của Chatbot
  const handleToggleBotEnabled = async () => {
    try {
      const nextState = !config.isEnabled;
      setConfig((prev) => ({ ...prev, isEnabled: nextState }));
      await api.put('/admin/chatbot/config', {
        ...config,
        isEnabled: nextState,
      });
    } catch (err) {
      alert('Không thể đổi trạng thái Chatbot: ' + (err.response?.data?.message || err.message));
    }
  };

  // Thêm kịch bản FAQ mới vào Kho tri thức DB
  const handleAddFaq = async (e) => {
    e.preventDefault();
    if (!faqForm.title.trim() || !faqForm.keywords.trim() || !faqForm.answer.trim()) {
      alert('Vui lòng điền đầy đủ Tiêu đề, Từ khóa nhận diện và Nội dung câu trả lời!');
      return;
    }

    try {
      setSaving(true);
      const res = await api.post('/admin/chatbot/faqs', faqForm);
      alert(res.data?.message || 'Đã thêm kịch bản hỏi đáp mới!');
      setFaqForm({ title: '', keywords: '', category: 'POLICY', answer: '' });
      fetchChatbotData();
    } catch (err) {
      alert('Lỗi thêm kịch bản: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFaqActive = async (faq) => {
    try {
      const faqId = faq._id || faq.id;
      await api.put(`/admin/chatbot/faqs/${faqId}`, {
        isActive: !faq.isActive,
      });
      fetchChatbotData();
    } catch (err) {
      alert('Lỗi cập nhật FAQ: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteFaq = async (faqId) => {
    if (!window.confirm('Xóa kịch bản câu hỏi này khỏi Kho tri thức AI?')) return;
    try {
      await api.delete(`/admin/chatbot/faqs/${faqId}`);
      fetchChatbotData();
    } catch (err) {
      alert('Lỗi xóa FAQ: ' + (err.response?.data?.message || err.message));
    }
  };

  // Quản lý Quick Chips
  const handleChipChange = (index, field, value) => {
    const updated = [...(config.quickChips || [])];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, quickChips: updated });
  };

  const handleAddChip = () => {
    setConfig({
      ...config,
      quickChips: [
        ...(config.quickChips || []),
        { label: '✨ Gợi ý mới', query: 'Cho tôi hỏi thông tin về rạp D\'AVENOR Đà Nẵng' },
      ],
    });
  };

  const handleRemoveChip = (index) => {
    const updated = (config.quickChips || []).filter((_, i) => i !== index);
    setConfig({ ...config, quickChips: updated });
  };

  // Xóa lịch sử hội thoại
  const handleDeleteLog = async (id) => {
    try {
      await api.delete(`/admin/chatbot/logs/${id}`);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      alert('Không thể xóa bản ghi: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleClearAllLogs = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử hội thoại khách hàng?')) return;
    try {
      const res = await api.delete('/admin/chatbot/logs-cleanup/all');
      alert(res.data?.message || 'Đã dọn dẹp lịch sử hội thoại!');
      fetchChatbotData();
    } catch (err) {
      alert('Lỗi dọn lịch sử chat: ' + (err.response?.data?.message || err.message));
    }
  };

  // Gửi câu hỏi test thử AI ngay tại trang Admin
  const handleTestBot = async (e) => {
    e.preventDefault();
    if (!testQuestion.trim() || testingBot) return;
    try {
      setTestingBot(true);
      const res = await api.post('/ai/chat', {
        message: testQuestion.trim(),
        userName: 'Admin (Test hệ thống)',
        userEmail: 'admin@davenor.vn',
      });
      setTestReply(res.data);
      fetchChatbotData();
    } catch (err) {
      alert('Lỗi test AI: ' + (err.response?.data?.message || err.message));
    } finally {
      setTestingBot(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    const q = searchLog.toLowerCase().trim();
    if (!q) return true;
    return (
      (l.userMessage || '').toLowerCase().includes(q) ||
      (l.botReply || '').toLowerCase().includes(q) ||
      (l.userName || '').toLowerCase().includes(q) ||
      (l.intent || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />

        <main className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black flex items-center gap-2.5">
                <span>🤖</span>
                <span>Quản Lý Trợ Lý Ảo Chatbot AI & Kho Tri Thức (RAG)</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Đồng bộ trực tiếp dữ liệu Phim, Suất chiếu 2D/3D/IMAX, Combo bắp nước & Voucher từ MongoDB vào bộ não AI.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleBotEnabled}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  config.isEnabled
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/40 hover:bg-rose-500/25'
                }`}
              >
                {config.isEnabled ? '● Đang bật Chatbot ngoài trang chủ' : '○ Đang tạm tắt Chatbot'}
              </button>
              <button
                type="button"
                onClick={fetchChatbotData}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              >
                🔄 Làm mới
              </button>
            </div>
          </div>

          {/* 4 Thẻ thống kê trạng thái RAG & Database */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] uppercase font-bold text-slate-400">Chế độ vận hành AI</span>
              <div className="text-sm font-black text-blue-400 mt-1 truncate">
                {ragStats.engineMode}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                ● Trả lời thời gian thực 24/7
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] uppercase font-bold text-slate-400">Dữ liệu RAG nạp từ DB</span>
              <div className="text-base font-black text-white mt-1">
                {ragStats.movies} Phim • {ragStats.showtimes} Suất chiếu
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {ragStats.concessions} Combo bắp nước • {ragStats.promotions} Khuyến mãi
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] uppercase font-bold text-slate-400">Kịch bản Kho Tri Thức</span>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {config.faqs?.length || 0} kịch bản
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Tự động khớp từ khóa câu hỏi khách
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] uppercase font-bold text-slate-400">Lịch sử hội thoại đã lưu</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {logs.length} lượt hỏi đáp
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Lưu trong bảng AiChatLog
              </div>
            </div>
          </div>

          {/* Khung Test nhanh phản hồi AI ngay trong Admin */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>⚡</span>
                <span>Kiểm tra nhanh phản hồi của Trợ lý AI (Live Sandbox)</span>
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Suất chiếu 3D lúc 21h-22h giá bao nhiêu?',
                  'Có mã voucher giảm giá hay combo bắp nước nào rẻ không?',
                  'Chính sách đổi trả vé của rạp thế nào?',
                ].map((sample, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTestQuestion(sample)}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleTestBot} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={testQuestion}
                onChange={(e) => setTestQuestion(e.target.value)}
                placeholder="Nhập câu hỏi đóng vai khách hàng để kiểm tra độ thông minh của Chatbot..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={testingBot}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-blue-600/20 cursor-pointer shrink-0"
              >
                {testingBot ? 'Đang suy nghĩ...' : '🤖 Hỏi thử AI'}
              </button>
            </form>

            {testReply && (
              <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-400">
                    Phản hồi từ AI ({testReply.source || 'DATABASE_RAG'} • Intent: {testReply.intent || 'GENERAL'}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setTestReply(null)}
                    className="text-slate-500 hover:text-white"
                  >
                    ✕ Đóng
                  </button>
                </div>
                <div className="text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                  {testReply.reply}
                </div>
              </div>
            )}
          </div>

          {/* 3 Tabs điều hướng Quản trị Chatbot */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'LOGS', label: `💬 Lịch sử hội thoại khách hàng (${logs.length})` },
                { key: 'FAQS', label: `📚 Kho tri thức & Kịch bản câu trả lời (${config.faqs?.length || 0})` },
                { key: 'CONFIG', label: '⚙️ Cấu hình lời chào & Nút gợi ý nhanh' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    activeTab === tab.key
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'LOGS' && logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllLogs}
                className="text-xs bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-3.5 py-2 rounded-xl font-bold border border-rose-500/30 transition-all cursor-pointer"
              >
                🧹 Xóa toàn bộ lịch sử chat
              </button>
            )}
          </div>

          {/* ==================== TAB 1: LỊCH SỬ HỘI THOẠI KHÁCH HÀNG ==================== */}
          {activeTab === 'LOGS' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <input
                  type="text"
                  value={searchLog}
                  onChange={(e) => setSearchLog(e.target.value)}
                  placeholder="🔍 Tìm trong lịch sử câu hỏi của khách..."
                  className="w-full sm:w-80 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
                />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-800/90 text-slate-400 uppercase text-[11px]">
                      <tr>
                        <th className="px-4 py-3.5">Khách hàng</th>
                        <th className="px-4 py-3.5">Câu hỏi của khách</th>
                        <th className="px-4 py-3.5">Chủ đề (Intent)</th>
                        <th className="px-4 py-3.5">Câu trả lời của AI</th>
                        <th className="px-4 py-3.5">Thời gian</th>
                        <th className="px-4 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {loading ? (
                        <tr>
                          <td colSpan="6" className="px-4 py-10 text-center text-slate-400">
                            Đang tải lịch sử hội thoại AI...
                          </td>
                        </tr>
                      ) : filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                            Chưa có cuộc hội thoại nào được ghi nhận. Bạn có thể bấm "Hỏi thử AI" ở khung trên để kiểm tra!
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => {
                          const badge = INTENT_LABELS[log.intent] || {
                            label: log.intent || '💬 Tư vấn chung',
                            cls: 'bg-slate-800 text-slate-300 border-slate-700',
                          };
                          return (
                            <tr key={log.id} className="hover:bg-slate-800/40 transition-colors align-top">
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="font-bold text-white text-xs">{log.userName || 'Khách vãng lai'}</div>
                                {log.userEmail && (
                                  <div className="text-[11px] text-slate-500">{log.userEmail}</div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 max-w-xs">
                                <div className="text-xs font-semibold text-blue-300 leading-relaxed">
                                  “{log.userMessage}”
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border inline-block ${badge.cls}`}>
                                  {badge.label}
                                </span>
                                {log.recommendedMovie && (
                                  <div className="text-[10px] text-amber-400 font-semibold mt-1">
                                    ★ {log.recommendedMovie}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 max-w-md">
                                <div className="text-xs text-slate-300 line-clamp-3 whitespace-pre-line leading-relaxed">
                                  {log.botReply}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                                {log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : '---'}
                              </td>
                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="text-xs bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  🗑️ Xóa
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: KHO TRI THỨC & KỊCH BẢN HỎI ĐÁP (FAQS) ==================== */}
          {activeTab === 'FAQS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Cột trái: Form thêm kịch bản trả lời mới */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 h-fit space-y-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>➕</span>
                  <span>Dạy thêm kịch bản trả lời mới cho AI</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Khi câu hỏi của khách chứa bất kỳ từ khóa nào bên dưới, AI sẽ lập tức trả lời chính xác theo nội dung bạn cài đặt.
                </p>

                <form onSubmit={handleAddFaq} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      Tên chủ đề / Câu hỏi
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Chính sách mang thú cưng hoặc đồ ăn ngoài"
                      value={faqForm.title}
                      onChange={(e) => setFaqForm({ ...faqForm, title: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      Từ khóa nhận diện (ngăn cách bằng dấu phẩy)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: đồ ăn ngoài, trà sữa, thú cưng, chó mèo"
                      value={faqForm.keywords}
                      onChange={(e) => setFaqForm({ ...faqForm, keywords: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      Phân nhóm
                    </label>
                    <select
                      value={faqForm.category}
                      onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="POLICY">📌 Quy định & Tiện ích rạp</option>
                      <option value="PRICING">🎟️ Chính sách giá vé</option>
                      <option value="PROMOTION">🎁 Khuyến mãi & Thành viên</option>
                      <option value="SHOWTIME">🕒 Suất chiếu & Phòng chiếu</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      Nội dung AI sẽ trả lời khách (hỗ trợ in đậm **chữ**)
                    </label>
                    <textarea
                      rows="4"
                      required
                      placeholder="Nhập câu trả lời chi tiết mà bạn muốn Chatbot phản hồi..."
                      value={faqForm.answer}
                      onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm shadow-lg shadow-red-600/20 cursor-pointer transition-all"
                  >
                    {saving ? 'Đang lưu vào Database...' : '💾 Lưu vào Kho Tri Thức AI'}
                  </button>
                </form>
              </div>

              {/* Cột phải: Danh sách các kịch bản FAQ đang có trong DB */}
              <div className="lg:col-span-7 space-y-3">
                {(config.faqs || []).map((faq) => {
                  const faqId = faq._id || faq.id;
                  return (
                    <div
                      key={faqId}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-white text-sm">{faq.title}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              Từ khóa: {faq.keywords}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleFaqActive(faq)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer ${
                              faq.isActive
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {faq.isActive ? '✓ Đang kích hoạt' : 'Đã tắt'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFaq(faqId)}
                            className="text-xs bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                          >
                            🗑️ Xóa
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-300 bg-slate-950/80 border border-slate-800 rounded-xl p-3 whitespace-pre-line leading-relaxed">
                        {faq.answer}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== TAB 3: CẤU HÌNH LỜI CHÀO & NÚT GỢI Ý NHANH ==================== */}
          {activeTab === 'CONFIG' && (
            <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Tên hiển thị của Chatbot
                  </label>
                  <input
                    type="text"
                    value={config.botName || ''}
                    onChange={(e) => setConfig({ ...config, botName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Nhãn phiên bản (Badge)
                  </label>
                  <input
                    type="text"
                    value={config.botVersion || ''}
                    onChange={(e) => setConfig({ ...config, botVersion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Lời chào mở đầu (Dùng biến {'{name}'} để tự động thay bằng tên tài khoản khách đang đăng nhập)
                </label>
                <textarea
                  rows="3"
                  value={config.welcomeMessage || ''}
                  onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Chỉ thị điều hướng AI (System Prompt Note)
                </label>
                <textarea
                  rows="2"
                  value={config.systemPromptNote || ''}
                  onChange={(e) => setConfig({ ...config, systemPromptNote: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Quản lý các nút gợi ý nhanh (Quick Suggestion Chips) */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-amber-400">
                    💊 Các nút gợi ý nhanh dưới khung Chat (Quick Suggestion Chips)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddChip}
                    className="text-xs bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    + Thêm nút gợi ý
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(config.quickChips || []).map((chip, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          value={chip.label}
                          onChange={(e) => handleChipChange(index, 'label', e.target.value)}
                          placeholder="Nhãn nút (VD: 👓 Suất chiếu 3D)"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="sm:col-span-7">
                        <input
                          type="text"
                          value={chip.query}
                          onChange={(e) => handleChipChange(index, 'query', e.target.value)}
                          placeholder="Câu hỏi gửi đi khi khách bấm vào nút..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveChip(index)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-red-600/25 cursor-pointer transition-all"
                >
                  {saving ? 'Đang lưu cấu hình...' : '💾 Lưu Cấu Hình Chatbot AI'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default ChatbotManagePage;

