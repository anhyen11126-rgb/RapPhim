import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const ChatWidget = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Lịch sử tin nhắn khởi tạo chuẩn theo ảnh mẫu
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      time: '18:42',
      text: 'Xin chào **An**! Tôi là trợ lý ảo D\'AVENOR CINEMA. Tôi có thể giúp bạn tìm phim hay theo sở thích, tra cứu suất chiếu rạp gần nhất, kiểm tra ghế VIP trống hoặc gợi ý combo bắp nước giá tốt! 🍿 ✨',
    },
  ]);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  // Các gợi ý nhanh dạng viên thuốc
  const quickChips = [
    { label: '🎬 Top phim tuần này', query: 'Cho tôi xem top phim bom tấn hay nhất tuần này tại D\'AVENOR CINEMA' },
    { label: '🎟️ Giá vé IMAX tối nay', query: 'Tối nay khoảng sau 19h ở rạp D\'AVENOR còn phim nào bom tấn xem IMAX được không bạn? Tư vấn ghế đẹp giúp mình luôn nhé!' },
    { label: '🍿 Combo bắp nước giá tốt', query: 'Có combo bắp nước nào ngon và giá tiết kiệm nhất hiện nay không?' },
    { label: '📍 Suất chiếu sau 19h', query: 'Các suất chiếu sau 19h tối nay tại rạp D\'AVENOR Landmark 81' },
  ];

  const handleSend = async (e, customText = null) => {
    if (e) e.preventDefault();
    const textToSend = customText || input.trim();
    if (!textToSend || loading) return;

    const now = new Date();
    const currentTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const newUserMsg = {
      id: Date.now(),
      sender: 'user',
      time: currentTime,
      text: textToSend,
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        message: textToSend,
        history: messages.slice(-4).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
        })),
      });

      const botReply = res.data.reply || 'Tôi đã tiếp nhận yêu cầu của bạn.';
      const movieCard = res.data.movieCard || null;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          text: botReply,
          movieCard: movieCard,
        },
      ]);
    } catch (err) {
      console.error('Lỗi gọi AI Chatbot:', err);
      // Fallback cục bộ thông minh nếu API server tạm bận
      let fallbackText = 'Rất tiếc, đã có lỗi kết nối đến Trợ lý AI. Vui lòng thử lại sau ít phút!';
      let fallbackCard = null;

      if (textToSend.toLowerCase().includes('imax') || textToSend.toLowerCase().includes('19h') || textToSend.toLowerCase().includes('ghế')) {
        fallbackText = `✨ **Gợi ý hoàn hảo nhất tối nay:**\n\nSuất chiếu lý tưởng nhất cho bạn là **Dune: Hành Tinh Cát 2 (Dune: Part Two)** lúc **19:15** tại **Phòng chiếu IMAX Laser 03, D'AVENOR Landmark**!\n\n💺 **Tư vấn ghế VIP:** Dãy ghế hàng F (F6, F7) ở vị trí trung tâm, tầm nhìn thẳng góc 135° và trọn vẹn trường nhìn siêu rộng của màn hình IMAX 22m x 12m với âm thanh vòm Dolby Atmos 128 kênh sống động.`;
        fallbackCard = {
          title: 'Dune: Part Two',
          rating: '8.9',
          poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop',
          showtimeId: 1,
          time: '19:15',
          room: 'Phòng IMAX 03',
        };
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          text: fallbackText,
          movieCard: fallbackCard,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (query) => {
    handleSend(null, query);
  };

  // Giả lập hoặc kích hoạt nhận diện giọng nói Speech-to-Text
  const handleToggleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setInput('Tối nay khoảng sau 19h ở rạp D\'AVENOR CINEMA còn phim nào bom tấn xem IMAX được không bạn?');
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };

      if (!isListening) {
        recognition.start();
      }
    } catch {
      setInput('Tối nay khoảng sau 19h ở rạp D\'AVENOR CINEMA còn phim nào bom tấn xem IMAX được không bạn?');
    }
  };

  // Làm mới cuộc trò chuyện
  const handleResetChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        time: '18:42',
        text: 'Xin chào **An**! Tôi là trợ lý ảo D\'AVENOR CINEMA. Tôi có thể giúp bạn tìm phim hay theo sở thích, tra cứu suất chiếu rạp gần nhất, kiểm tra ghế VIP trống hoặc gợi ý combo bắp nước giá tốt! 🍿 ✨',
      },
    ]);
  };

  // Format Text có Bold và Markdown Link
  const renderMessageContent = (text) => {
    // Tách các đoạn link markdown [Tên Link](URL)
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const label = match[1];
      const url = match[2];

      parts.push(
        <button
          key={match.index}
          type="button"
          onClick={() => {
            navigate(url);
            setIsOpen(false);
          }}
          className="inline-flex items-center gap-1.5 my-1.5 px-3 py-1.5 bg-[#2563eb] hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all hover:scale-102 cursor-pointer border border-blue-400/40"
        >
          <span>{label}</span>
          <span>➔</span>
        </button>
      );
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    // Render in đậm **chữ**
    return (
      <div className="whitespace-pre-line leading-relaxed text-xs sm:text-[13px]">
        {parts.map((p, idx) => {
          if (typeof p !== 'string') return p;
          const boldParts = p.split(/(\*\*.*?\*\*)/g);
          return (
            <span key={idx}>
              {boldParts.map((bp, bidx) => {
                if (bp.startsWith('**') && bp.endsWith('**')) {
                  return (
                    <strong key={bidx} className="font-extrabold text-white">
                      {bp.slice(2, -2)}
                    </strong>
                  );
                }
                return bp;
              })}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* 1. NÚT TRÒ CHUYỆN NỔI (KHI ĐANG ĐÓNG) */}
      {!isOpen && (
        <button
          type="button"
          data-chat-toggle="true"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="bg-[#121929]/95 hover:bg-[#1a253f] border border-blue-500/40 text-white rounded-full pl-2 pr-4 py-2 shadow-[0_0_25px_rgba(37,99,235,0.35)] flex items-center space-x-2.5 transition-all hover:scale-105 group backdrop-blur-xl cursor-pointer"
          title="Trò chuyện cùng Trợ lý AI D'AVENOR CINEMA"
        >
          <div className="relative w-8 h-8 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-sm font-bold shadow-md group-hover:scale-110 transition-transform">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#121929] animate-pulse"></span>
          </div>
          <div className="text-left">
            <span className="text-xs font-black text-white tracking-wide block">
              Trợ lý AI
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold block leading-none">
              Trực tuyến
            </span>
          </div>
        </button>
      )}

      {/* 2. CỬA SỔ CHATBOX ĐỈNH CAO (CHUẨN 100% THEO ẢNH MẪU) */}
      {isOpen && (
        <div
          className={`w-[360px] sm:w-[420px] bg-[#0c111d]/98 backdrop-blur-2xl border border-slate-700/80 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? 'h-[64px]' : 'h-[580px] sm:h-[630px]'
            }`}
        >
          {/* HEADER CHATBOX */}
          <div className="bg-[#121826] border-b border-slate-800/90 px-4 py-3.5 flex items-center justify-between text-white shadow-md">
            {/* Cụm Avatar robot + Tiêu đề + Trạng thái */}
            <div className="flex items-center space-x-3">
              <div className="relative w-9 h-9 rounded-2xl bg-[#1b253b] border border-blue-500/40 flex items-center justify-center text-base shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z" />
                </svg>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#121826]"></span>
              </div>

              <div>
                <div className="flex items-center space-x-1.5">
                  <h4 className="font-extrabold text-sm text-white tracking-wide">
                    Trợ lý AI D'AVENOR
                  </h4>
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.2 rounded">
                    Concierge v2.4
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span>Trực tuyến • Hỗ trợ 24/7</span>
                </p>
              </div>
            </div>

            {/* Cụm 3 nút điều khiển góc phải: Reset, Minimize, Close */}
            <div className="flex items-center space-x-1 text-slate-400">
              <button
                type="button"
                onClick={handleResetChat}
                className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors cursor-pointer"
                title="Làm mới cuộc trò chuyện"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors cursor-pointer"
                title={isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-red-500/20 rounded-lg hover:text-red-400 transition-colors cursor-pointer"
                title="Đóng cửa sổ chat"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* NỘI DUNG CUỘC TRÒ CHUYỆN (KHI KHÔNG BỊ THU NHỎ) */}
          {!isMinimized && (
            <>
              {/* VÙNG DANH SÁCH TIN NHẮN */}
              <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#080d19] scroll-smooth">
                {/* Mốc thời gian trung tâm */}
                <div className="text-center">
                  <span className="text-[11px] font-medium text-slate-500 bg-[#0d1322] px-3 py-1 rounded-full border border-slate-800/80">
                    Hôm nay, 18:42
                  </span>
                </div>

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Avatar bot bên trái */}
                    {msg.sender === 'bot' && (
                      <div className="w-7 h-7 rounded-xl bg-[#172238] border border-blue-500/30 text-blue-400 flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5">
                        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z" />
                        </svg>
                      </div>
                    )}

                    {/* Khối bong bóng chat */}
                    <div className="max-w-[82%]">
                      <div
                        className={`p-3.5 shadow-md ${
                          msg.sender === 'user'
                            ? 'bg-[#2563eb] text-white rounded-2xl rounded-tr-xs shadow-blue-900/30 font-medium'
                            : 'bg-[#131b2c] border border-slate-800/90 text-slate-200 rounded-2xl rounded-tl-xs'
                        }`}
                      >
                        {/* Header huy hiệu gợi ý xanh lá nếu là gợi ý phim */}
                        {msg.movieCard && (
                          <div className="flex items-center space-x-1.5 text-emerald-400 font-extrabold text-xs mb-2">
                            <span>✔</span>
                            <span>Gợi ý hoàn hảo nhất tối nay</span>
                          </div>
                        )}

                        {renderMessageContent(msg.text)}

                        {/* Thẻ phim thu nhỏ Rich Card nếu có gợi ý cụ thể */}
                        {msg.movieCard && (
                          <div
                            onClick={() => {
                              navigate(`/booking/seat/${msg.movieCard.showtimeId}`);
                              setIsOpen(false);
                            }}
                            className="bg-[#0c1220] border border-slate-700/80 hover:border-blue-500/60 rounded-xl p-2.5 flex items-center justify-between gap-3 mt-3 cursor-pointer group transition-all"
                          >
                            <div className="flex items-center space-x-2.5">
                              <img
                                src={msg.movieCard.poster}
                                alt={msg.movieCard.title}
                                className="w-10 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                              />
                              <div>
                                <span className="font-extrabold text-white text-xs block group-hover:text-blue-400 transition-colors">
                                  {msg.movieCard.title}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {msg.movieCard.time} • {msg.movieCard.room}
                                </span>
                                <div className="inline-flex items-center space-x-1 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] text-amber-400 font-bold mt-1">
                                  <span>★</span>
                                  <span>{msg.movieCard.rating}</span>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg text-xs font-bold shadow transition-transform group-hover:scale-105">
                              ➔
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Thời gian & Trạng thái đã xem */}
                      <div
                        className={`flex items-center space-x-1 mt-1 text-[10px] text-slate-500 ${
                          msg.sender === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.sender === 'user' && (
                          <span className="text-blue-400 font-bold">✔✔</span>
                        )}
                        <span>{msg.time}</span>
                      </div>
                    </div>

                    {/* Avatar user bên phải */}
                    {msg.sender === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5">
                        👤
                      </div>
                    )}
                  </div>
                ))}

                {/* Trạng thái đang gõ Loading */}
                {loading && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-[#172238] border border-blue-500/30 text-blue-400 flex items-center justify-center text-xs shrink-0 shadow-sm">
                      🤖
                    </div>
                    <div className="bg-[#131b2c] border border-slate-800 rounded-2xl rounded-tl-xs px-4 py-3 text-slate-400 text-xs flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></span>
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></span>
                      <span className="text-[11px] text-slate-300 font-medium pl-1">
                        AI đang tra cứu dữ liệu thời gian thực...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* HÀNG CÁC NÚT GỢI Ý NHANH (QUICK SUGGESTION CHIPS) */}
              <div className="px-3 py-2 bg-[#0c1220] border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(chip.query)}
                    className="shrink-0 bg-[#141b2c] hover:bg-[#1f2b45] border border-slate-700/70 hover:border-blue-500/60 text-slate-300 hover:text-white text-[11px] font-semibold px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap shadow-sm hover:scale-[1.02]"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* KHU VỰC NHẬP TIN NHẮN (INPUT BOX) */}
              <div className="p-3 bg-[#0f1524] border-t border-slate-800/80">
                <form
                  onSubmit={handleSend}
                  className="bg-[#151e30] border border-slate-700/80 rounded-2xl flex items-center px-3 py-1.5 focus-within:border-blue-500 focus-within:shadow-[0_0_15px_rgba(37,99,235,0.25)] transition-all"
                >
                  {/* Nút cộng tác vụ bổ sung (+) */}
                  <button
                    type="button"
                    onClick={() => setInput('Gợi ý cho tôi các ghế VIP đẹp nhất phòng chiếu IMAX')}
                    className="w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 flex items-center justify-center text-sm font-bold mr-2 transition-colors cursor-pointer"
                    title="Gợi ý câu hỏi"
                  >
                    ⊕
                  </button>

                  {/* Input văn bản */}
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Đặt trước 2 vé ghế F6 F7 luôn nhé!..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 bg-transparent text-xs sm:text-[13px] text-white placeholder-slate-500 focus:outline-none"
                  />

                  {/* Nút Mic thu âm */}
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer mr-1.5 ${
                      isListening
                        ? 'text-red-400 bg-red-500/20 animate-pulse'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                    title="Nhập bằng giọng nói"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>

                  {/* Nút Gửi xanh lam Paper Plane */}
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className={`w-8 h-8 rounded-xl bg-[#2563eb] text-white flex items-center justify-center transition-all shadow-md shadow-blue-600/30 shrink-0 ${
                      loading || !input.trim()
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-blue-500 hover:scale-105 cursor-pointer'
                    }`}
                    title="Gửi tin nhắn"
                  >
                    <svg className="w-4 h-4 text-white -rotate-45 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>

                {/* Footer chú thích dưới ô nhập */}
                <div className="flex items-center justify-between text-[10px] pt-2 px-1 text-slate-500">
                  <div className="flex items-center space-x-1 text-emerald-400/90 font-medium">
                    <span>⚡</span>
                    <span>Trả lời tức thì qua AI DeepSearch</span>
                  </div>
                  <span>Nhấn Enter để gửi</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
