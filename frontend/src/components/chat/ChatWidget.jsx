import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const getStoredUser = () => {
  try {
    const raw =
      localStorage.getItem('user') ||
      sessionStorage.getItem('user') ||
      localStorage.getItem('adminUser') ||
      '{}';
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const DEFAULT_WELCOME_TEMPLATE =
  "Xin chào **{name}**! Mình là trợ lý tư vấn của D'AVENOR CINEMA tại Đà Nẵng. Mình có thể giúp bạn xem phim đang chiếu, tra cứu suất chiếu theo khung giờ, kiểm tra ghế trống, báo giá vé và gợi ý combo bắp nước & ưu đãi! 🍿✨";

const formatWelcomeMessage = (template, user) => {
  const displayName = user?.name ? user.name.trim() : 'bạn';
  return String(template || DEFAULT_WELCOME_TEMPLATE).replace(/\{name\}/gi, displayName);
};

const CHAT_STORAGE_KEYS = {
  messages: 'davenor_chat_messages_v1',
  context: 'davenor_chat_context_v1',
  size: 'davenor_chat_size_v1',
};

const readSessionJson = (key, fallback = null) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const ChatWidget = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [sessionContext, setSessionContext] = useState(() =>
    readSessionJson(CHAT_STORAGE_KEYS.context, null)
  );
  const [sessionStartedTime] = useState(() =>
    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  );

  // Kích thước thu phóng tự do của cửa sổ Chatbox (khôi phục từ sessionStorage nếu có)
  const getDefaultChatSize = () => {
    if (typeof window === 'undefined') return { width: 420, height: 630 };
    return {
      width: Math.min(window.innerWidth < 640 ? 360 : 420, window.innerWidth - 24),
      height: Math.min(window.innerWidth < 640 ? 580 : 630, window.innerHeight - 24),
    };
  };

  const [chatSize, setChatSize] = useState(() => {
    const saved = readSessionJson(CHAT_STORAGE_KEYS.size, null);
    if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height) && typeof window !== 'undefined') {
      return {
        width: Math.max(320, Math.min(saved.width, window.innerWidth - 24)),
        height: Math.max(420, Math.min(saved.height, window.innerHeight - 24)),
      };
    }
    return getDefaultChatSize();
  });
  const [isResizing, setIsResizing] = useState(false);

  // Vị trí kéo thả tự do của Trợ lý AI (null = vị trí mặc định ở góc dưới bên phải)
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    elemStartX: 0,
    elemStartY: 0,
    hasMoved: false,
  });
  const containerRef = useRef(null);
  const justDraggedRef = useRef(false);

  // Đưa Trợ lý AI trở về vị trí & kích thước mặc định ban đầu
  const handleResetToDefault = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setPosition(null);
    setChatSize(getDefaultChatSize());
  };

  // Phóng to nhanh / thu về kích thước mặc định
  const isExpanded =
    typeof window !== 'undefined' &&
    (chatSize.width >= Math.min(680, window.innerWidth - 48) ||
      chatSize.height >= Math.min(760, window.innerHeight - 48));

  const handleToggleExpand = () => {
    if (typeof window === 'undefined') return;
    if (isExpanded) {
      setChatSize(getDefaultChatSize());
    } else {
      setChatSize({
        width: Math.min(720, window.innerWidth - 32),
        height: Math.min(820, window.innerHeight - 32),
      });
    }
  };

  // Kéo viền / góc để thu phóng tự do kích thước khung Chatbox (hỗ trợ cả chuột & cảm ứng)
  const handleResizeStart = (direction) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX ?? e.touches?.[0]?.clientX;
    const startY = e.clientY ?? e.touches?.[0]?.clientY;
    if (startX === undefined || startY === undefined) return;

    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startW = rect.width;
    const startH = rect.height;
    const startLeft = rect.left;
    const startTop = rect.top;
    const wasPositioned = Boolean(position);

    const MIN_W = 320;
    const MIN_H = 420;
    const MAX_W = Math.max(MIN_W, window.innerWidth - 24);
    const MAX_H = Math.max(MIN_H, window.innerHeight - 24);

    setIsResizing(true);

    const onMove = (moveEvt) => {
      const curX = moveEvt.clientX ?? moveEvt.touches?.[0]?.clientX;
      const curY = moveEvt.clientY ?? moveEvt.touches?.[0]?.clientY;
      if (curX === undefined || curY === undefined) return;
      if (moveEvt.cancelable) moveEvt.preventDefault();

      const dx = curX - startX;
      const dy = curY - startY;

      let nextW = startW;
      let nextH = startH;
      let nextLeft = startLeft;
      let nextTop = startTop;

      if (direction.includes('e')) {
        nextW = Math.max(MIN_W, Math.min(MAX_W, startW + dx));
      }
      if (direction.includes('w')) {
        const clampedW = Math.max(MIN_W, Math.min(MAX_W, startW - dx));
        nextLeft = startLeft + (startW - clampedW);
        nextW = clampedW;
      }
      if (direction.includes('s')) {
        nextH = Math.max(MIN_H, Math.min(MAX_H, startH + dy));
      }
      if (direction.includes('n')) {
        const clampedH = Math.max(MIN_H, Math.min(MAX_H, startH - dy));
        nextTop = startTop + (startH - clampedH);
        nextH = clampedH;
      }

      setChatSize({ width: Math.round(nextW), height: Math.round(nextH) });

      if (wasPositioned) {
        const safeLeft = Math.max(12, Math.min(window.innerWidth - nextW - 12, nextLeft));
        const safeTop = Math.max(12, Math.min(window.innerHeight - nextH - 12, nextTop));
        setPosition({ x: Math.round(safeLeft), y: Math.round(safeTop) });
      }
    };

    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  // Tự động căn chỉnh lại nếu màn hình thay đổi kích thước
  useEffect(() => {
    const handleResize = () => {
      setChatSize((prev) => ({
        width: Math.max(320, Math.min(prev.width, window.innerWidth - 24)),
        height: Math.max(420, Math.min(prev.height, window.innerHeight - 24)),
      }));
      setPosition((prev) => {
        if (!prev) return null;
        const el = containerRef.current;
        const width = el?.offsetWidth || 150;
        const height = el?.offsetHeight || 50;
        const newX = Math.max(12, Math.min(window.innerWidth - width - 12, prev.x));
        const newY = Math.max(12, Math.min(window.innerHeight - height - 12, prev.y));
        return { x: newX, y: newY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Xử lý kéo thả tự do con AI khắp màn hình (hỗ trợ cả chuột và cảm ứng)
  const handleDragStart = (e) => {
    if (e.button !== undefined && e.button !== 0) return;

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    dragInfoRef.current = {
      isDown: true,
      startX: clientX,
      startY: clientY,
      elemStartX: rect.left,
      elemStartY: rect.top,
      hasMoved: false,
    };

    const onMove = (moveEvt) => {
      if (!dragInfoRef.current.isDown) return;
      const curX = moveEvt.clientX ?? moveEvt.touches?.[0]?.clientX;
      const curY = moveEvt.clientY ?? moveEvt.touches?.[0]?.clientY;
      if (curX === undefined || curY === undefined) return;

      const dx = curX - dragInfoRef.current.startX;
      const dy = curY - dragInfoRef.current.startY;

      if (!dragInfoRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
        dragInfoRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragInfoRef.current.hasMoved) {
        if (moveEvt.cancelable) moveEvt.preventDefault();
        const width = el.offsetWidth || 150;
        const height = el.offsetHeight || 50;

        const clampedX = Math.max(12, Math.min(window.innerWidth - width - 12, dragInfoRef.current.elemStartX + dx));
        const clampedY = Math.max(12, Math.min(window.innerHeight - height - 12, dragInfoRef.current.elemStartY + dy));

        setPosition({ x: clampedX, y: clampedY });
      }
    };

    const onUp = () => {
      dragInfoRef.current.isDown = false;
      if (dragInfoRef.current.hasMoved) {
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 150);
      }
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const getContainerStyle = () => {
    if (!position) return undefined;
    if (!isOpen) {
      return {
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: 'auto',
        bottom: 'auto',
      };
    }
    const chatWidth = chatSize.width;
    const chatHeight = isMinimized ? 64 : chatSize.height;

    let left = position.x;
    if (left + chatWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - chatWidth - 12);
    }
    if (left < 12) left = 12;

    let top = position.y;
    if (top + chatHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - chatHeight - 12);
    }
    if (top < 12) top = 12;

    return {
      left: `${left}px`,
      top: `${top}px`,
      right: 'auto',
      bottom: 'auto',
    };
  };

  const [botConfig, setBotConfig] = useState({
    botName: "Trợ lý AI D'AVENOR",
    botVersion: 'Concierge v3.0',
    welcomeMessage: DEFAULT_WELCOME_TEMPLATE,
    isEnabled: true,
    quickChips: [
      {
        label: '🎬 Phim đang chiếu',
        query: 'Các bộ phim đang chiếu hiện tại?',
      },
      {
        label: '🕒 Suất chiếu tối nay',
        query: 'Tối nay có những suất chiếu nào?',
      },
      {
        label: '🎟️ Giá vé & IMAX',
        query: 'Tối nay có suất chiếu IMAX nào và giá vé bao nhiêu?',
      },
      {
        label: '🍿 Combo & Ưu đãi',
        query: 'Hôm nay có ưu đãi và combo bắp nước gì?',
      },
      {
        label: '🎫 Vé của tôi',
        query: 'Kiểm tra vé của tôi',
      },
    ],
  });

  // Lịch sử tin nhắn khởi tạo từ sessionStorage (để F5 không mất mạch trò chuyện) hoặc lời chào mặc định
  const [messages, setMessages] = useState(() => {
    const saved = readSessionJson(CHAT_STORAGE_KEYS.messages, null);
    if (Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
    return [
      {
        id: 1,
        sender: 'bot',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        text: formatWelcomeMessage(DEFAULT_WELCOME_TEMPLATE, getStoredUser()),
      },
    ];
  });

  // Đồng bộ lịch sử chat, ngữ cảnh hội thoại và kích cỡ khung chat vào sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEYS.messages, JSON.stringify(messages.slice(-30)));
    } catch {
      // Bỏ qua nếu trình duyệt chặn storage hoặc đầy bộ nhớ
    }
  }, [messages]);

  useEffect(() => {
    try {
      if (sessionContext) {
        sessionStorage.setItem(CHAT_STORAGE_KEYS.context, JSON.stringify(sessionContext));
      } else {
        sessionStorage.removeItem(CHAT_STORAGE_KEYS.context);
      }
    } catch {
      // Bỏ qua lỗi storage
    }
  }, [sessionContext]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEYS.size, JSON.stringify(chatSize));
    } catch {
      // Bỏ qua lỗi storage
    }
  }, [chatSize]);

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

  // Tải cấu hình Chatbot từ Database và lắng nghe sự kiện đăng nhập/đăng xuất
  useEffect(() => {
    let mounted = true;
    const loadAiConfig = async () => {
      try {
        const res = await api.get('/ai/config');
        if (mounted && res.data) {
          const incomingChips = Array.isArray(res.data.quickChips) ? res.data.quickChips : [];
          const hasStaleLegacyChip = incomingChips.some((c) =>
            /45k-50k|rạp\s*05|21h-22h/i.test(`${c?.label || ''} ${c?.query || ''}`)
          );
          setBotConfig((prev) => ({
            ...prev,
            ...res.data,
            quickChips:
              incomingChips.length > 0 && !hasStaleLegacyChip ? incomingChips : prev.quickChips,
          }));
          const userNow = getStoredUser();
          setMessages((prev) => {
            if (prev.length === 1 && prev[0].id === 1) {
              return [
                {
                  ...prev[0],
                  text: formatWelcomeMessage(res.data.welcomeMessage, userNow),
                },
              ];
            }
            return prev;
          });
        }
      } catch {
        // Giữ cấu hình mặc định nếu chưa kết nối
      }
    };

    loadAiConfig();

    const handleAuthSync = () => {
      const updatedUser = getStoredUser();
      setCurrentUser(updatedUser);
      setMessages((prev) => {
        if (prev.length === 1) {
          return [
            {
              ...prev[0],
              text: formatWelcomeMessage(botConfig.welcomeMessage, updatedUser),
            },
          ];
        }
        return prev;
      });
    };

    window.addEventListener('authChange', handleAuthSync);
    window.addEventListener('storage', handleAuthSync);
    return () => {
      mounted = false;
      window.removeEventListener('authChange', handleAuthSync);
      window.removeEventListener('storage', handleAuthSync);
    };
  }, [botConfig.welcomeMessage]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const quickChips = botConfig.quickChips;

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
      const activeUser = getStoredUser();
      const res = await api.post('/ai/chat', {
        message: textToSend,
        userName: activeUser?.name || 'Khách vãng lai',
        userEmail: activeUser?.email || '',
        sessionContext,
        history: messages.slice(-10).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
          movieCard: m.movieCard || null,
          movieCards: Array.isArray(m.movieCards)
            ? m.movieCards.map((c) => ({
                movieId: c.movieId,
                title: c.title,
                showtimeId: c.showtimeId,
              }))
            : [],
        })),
      });

      const botReply = res.data.reply || 'Tôi đã tiếp nhận yêu cầu của bạn.';
      const movieCard = res.data.movieCard || null;
      const movieCards = Array.isArray(res.data.movieCards)
        ? res.data.movieCards
        : movieCard
          ? [movieCard]
          : [];
      const quickReplies = Array.isArray(res.data.quickReplies) ? res.data.quickReplies : [];

      if (res.data.sessionContext && typeof res.data.sessionContext === 'object') {
        setSessionContext(res.data.sessionContext);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          text: botReply,
          movieCard: movieCard,
          movieCards: movieCards,
          quickReplies,
        },
      ]);
    } catch (err) {
      console.error('Lỗi gọi AI Chatbot:', err);
      const fallbackText =
        'Rất tiếc, hiện tại kết nối đến Trợ lý AI đang gián đoạn tạm thời. Bạn vui lòng thử lại sau giây lát hoặc tra cứu trực tiếp tại mục Lịch chiếu trên website nhé!';

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          text: fallbackText,
          movieCard: null,
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
      setInput('Hôm nay phòng chiếu 3D (Rạp 05) có những suất chiếu nào lúc 21h-22h và giá vé bao nhiêu?');
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
      setInput('Hôm nay phòng chiếu 3D (Rạp 05) có những suất chiếu nào lúc 21h-22h và giá vé bao nhiêu?');
    }
  };

  // Làm mới cuộc trò chuyện (xóa lịch sử & ngữ cảnh đã lưu trong phiên)
  const handleResetChat = () => {
    setSessionContext(null);
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEYS.messages);
      sessionStorage.removeItem(CHAT_STORAGE_KEYS.context);
    } catch {
      // Bỏ qua lỗi storage
    }
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        text: formatWelcomeMessage(botConfig.welcomeMessage, currentUser),
      },
    ]);
  };

  // Format Text có Bold và Markdown Link
  const renderMessageContent = (text, hasCards = false) => {
    // Tách các đoạn link markdown [Tên Link](URL)
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const cleanLabel = match[1].replace(/\*\*/g, '').trim();
      const url = match[2].trim();

      parts.push(
        <button
          key={match.index}
          type="button"
          onClick={() => {
            navigate(url);
            setIsOpen(false);
          }}
          className={
            hasCards
              ? 'inline-flex items-center gap-1 mx-0.5 my-0.5 px-2 py-0.5 bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 hover:text-white font-bold text-[11px] rounded-md border border-blue-500/35 transition-colors cursor-pointer'
              : 'inline-flex items-center gap-1.5 my-1.5 px-3 py-1.5 bg-[#2563eb] hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all hover:scale-102 cursor-pointer border border-blue-400/40'
          }
        >
          <span>{cleanLabel}</span>
          {!cleanLabel.includes('➔') && <span>➔</span>}
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
    <div
      ref={containerRef}
      style={getContainerStyle()}
      className={`fixed z-50 select-none ${!position ? 'bottom-6 right-6' : ''} ${
        isDragging || isResizing ? 'transition-none' : 'transition-all duration-300 ease-out'
      }`}
    >
      {/* 1. NÚT TRÒ CHUYỆN NỔI (KHI ĐANG ĐÓNG) */}
      {!isOpen && (
        <button
          type="button"
          data-chat-toggle="true"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onDoubleClick={handleResetToDefault}
          onClick={() => {
            if (justDraggedRef.current) return;
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className={`bg-[#11152F]/95 hover:bg-[#20204B] border border-[#AA9BFF]/40 text-[#F8F7FF] rounded-full pl-2 pr-4 py-2 shadow-[0_0_20px_rgba(66,223,255,0.35)] flex items-center space-x-2.5 backdrop-blur-xl ${
            isDragging
              ? 'cursor-grabbing scale-105 shadow-[0_0_30px_rgba(168,85,247,0.6)] ring-2 ring-[#42DFFF]/60'
              : 'cursor-grab hover:scale-105 transition-all'
          } group`}
          title="Kéo thả để di chuyển • Bấm để trò chuyện • Nhấp đúp để về góc cũ"
        >
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-r from-[#42DFFF] to-[#A855F7] text-[#0B1026] flex items-center justify-center text-sm font-bold shadow-md group-hover:scale-110 transition-transform">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#11152F] animate-pulse"></span>
          </div>
          <div className="text-left">
            <span className="text-xs font-black text-[#F8F7FF] tracking-wide block">
              Trợ lý AI
            </span>
            <span className="text-[10px] text-[#42DFFF] font-semibold block leading-none">
              Trực tuyến
            </span>
          </div>
        </button>
      )}

      {/* 2. CỬA SỔ CHATBOX ĐỈNH CAO (HỖ TRỢ THU PHÓNG TÙY Ý KÍCH CỠ) */}
      {isOpen && (
        <div
          style={{
            width: `${chatSize.width}px`,
            height: isMinimized ? '64px' : `${chatSize.height}px`,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'calc(100vh - 24px)',
          }}
          className={`relative bg-[#0B1026]/98 backdrop-blur-2xl border border-[#AA9BFF]/30 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_25px_rgba(66,223,255,0.15)] flex flex-col overflow-hidden ${
            isResizing ? 'transition-none ring-2 ring-[#42DFFF]/50' : 'transition-all duration-200'
          }`}
        >
          {/* Các vùng kéo thu phóng kích thước 4 cạnh & 4 góc */}
          {!isMinimized && (
            <>
              <div
                onMouseDown={handleResizeStart('n')}
                onTouchStart={handleResizeStart('n')}
                className="absolute top-0 left-4 right-4 h-2 cursor-ns-resize z-30"
                title="Kéo để thay đổi chiều cao"
              />
              <div
                onMouseDown={handleResizeStart('s')}
                onTouchStart={handleResizeStart('s')}
                className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize z-30"
                title="Kéo để thay đổi chiều cao"
              />
              <div
                onMouseDown={handleResizeStart('w')}
                onTouchStart={handleResizeStart('w')}
                className="absolute top-4 bottom-4 left-0 w-2 cursor-ew-resize z-30"
                title="Kéo để thay đổi chiều rộng"
              />
              <div
                onMouseDown={handleResizeStart('e')}
                onTouchStart={handleResizeStart('e')}
                className="absolute top-4 bottom-4 right-0 w-2 cursor-ew-resize z-30"
                title="Kéo để thay đổi chiều rộng"
              />
              <div
                onMouseDown={handleResizeStart('nw')}
                onTouchStart={handleResizeStart('nw')}
                className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-40 group flex items-center justify-center"
                title="Kéo góc để thu phóng khung chat"
              >
                <span className="w-2 h-2 border-t-2 border-l-2 border-[#42DFFF]/50 group-hover:border-[#42DFFF] rounded-tl-sm transition-colors" />
              </div>
              <div
                onMouseDown={handleResizeStart('ne')}
                onTouchStart={handleResizeStart('ne')}
                className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize z-40"
                title="Kéo góc để thu phóng khung chat"
              />
              <div
                onMouseDown={handleResizeStart('sw')}
                onTouchStart={handleResizeStart('sw')}
                className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-40"
                title="Kéo góc để thu phóng khung chat"
              />
              <div
                onMouseDown={handleResizeStart('se')}
                onTouchStart={handleResizeStart('se')}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-40 group flex items-center justify-center"
                title="Kéo góc để thu phóng khung chat"
              >
                <span className="w-2 h-2 border-b-2 border-r-2 border-[#42DFFF]/40 group-hover:border-[#42DFFF] rounded-br-sm transition-colors" />
              </div>
            </>
          )}
          {/* HEADER CHATBOX (Hỗ trợ kéo di chuyển cửa sổ & nhấp đúp để về chỗ cũ) */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onDoubleClick={handleResetToDefault}
            className="bg-[#11152F] border-b border-[#AA9BFF]/20 px-4 py-3.5 flex items-center justify-between text-[#F8F7FF] shadow-md cursor-grab active:cursor-grabbing select-none"
            title="Kéo thả thanh tiêu đề để di chuyển • Nhấp đúp để về chỗ cũ"
          >
            {/* Cụm Avatar robot + Tiêu đề + Trạng thái */}
            <div className="flex items-center space-x-3">
              <div className="relative w-9 h-9 rounded-2xl bg-[#20204B] border border-[#AA9BFF]/40 flex items-center justify-center text-base shadow-[0_0_15px_rgba(66,223,255,0.25)]">
                <svg className="w-5 h-5 text-[#42DFFF]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z" />
                </svg>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#11152F]"></span>
              </div>

              <div>
                <div className="flex items-center space-x-1.5">
                  <h4 className="font-extrabold text-sm text-[#F8F7FF] tracking-wide">
                    {botConfig.botName || "Trợ lý AI D'AVENOR"}
                  </h4>
                  <span className="text-[10px] font-bold text-[#83F5FF] bg-[#20204B] border border-[#AA9BFF]/30 px-1.5 py-0.2 rounded">
                    {botConfig.botVersion || 'Concierge v3.0'}
                  </span>
                </div>
                <p className="text-[11px] text-[#BEC5E5] flex items-center space-x-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span>Trực tuyến • Đồng bộ Database Đà Nẵng</span>
                </p>
              </div>
            </div>

            {/* Cụm nút điều khiển góc phải: Làm mới chat, Thu nhỏ & về góc cũ, Đóng */}
            <div className="flex items-center space-x-1 text-slate-400" onMouseDown={(e) => e.stopPropagation()}>
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
                onClick={handleToggleExpand}
                className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors cursor-pointer"
                title={isExpanded ? 'Thu về kích thước mặc định' : 'Phóng to khung chat'}
              >
                {isExpanded ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                  handleResetToDefault();
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors cursor-pointer"
                title="Thu nhỏ & trở về vị trí góc ban đầu"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                  handleResetToDefault();
                }}
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
              <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#0B1026] scroll-smooth">
                {/* Mốc thời gian trung tâm */}
                <div className="text-center">
                  <span className="text-[11px] font-medium text-[#BEC5E5] bg-[#11152F] px-3 py-1 rounded-full border border-[#AA9BFF]/20">
                    Hôm nay, {sessionStartedTime}
                  </span>
                </div>

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                  >
                    {/* Avatar bot bên trái */}
                    {msg.sender === 'bot' && (
                      <div className="w-7 h-7 rounded-xl bg-[#20204B] border border-[#AA9BFF]/40 text-[#42DFFF] flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5">
                        <svg className="w-4 h-4 text-[#42DFFF]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z" />
                        </svg>
                      </div>
                    )}

                    {/* Khối bong bóng chat */}
                    {(() => {
                      const cardsToRender =
                        Array.isArray(msg.movieCards) && msg.movieCards.length > 0
                          ? msg.movieCards
                          : msg.movieCard && msg.movieCard.showtimeId
                            ? [msg.movieCard]
                            : [];
                      const hasCards = cardsToRender.length > 0;
                      const isWideGrid = chatSize.width >= 580 && cardsToRender.length > 1;

                      return (
                        <div className={isWideGrid ? 'max-w-[92%] w-full' : 'max-w-[85%]'}>
                          <div
                            className={`p-3.5 shadow-md ${msg.sender === 'user'
                                ? 'bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] rounded-2xl rounded-tr-xs shadow-[0_0_16px_rgba(168,85,247,0.35)] font-bold'
                                : 'bg-[#11152F] border border-[#AA9BFF]/20 text-[#F8F7FF] rounded-2xl rounded-tl-xs'
                              }`}
                          >
                            {/* Header huy hiệu gợi ý xanh lá phù hợp ngữ cảnh */}
                            {hasCards && (
                              <div className="flex items-center space-x-1.5 text-emerald-400 font-extrabold text-xs mb-2">
                                <span>{cardsToRender.length > 1 ? '🎬' : '✔'}</span>
                                <span>
                                  {cardsToRender.length > 1
                                    ? 'Chọn phim hoặc bấm giờ chiếu để đặt vé'
                                    : 'Suất chiếu phù hợp từ hệ thống'}
                                </span>
                              </div>
                            )}

                            {renderMessageContent(msg.text, hasCards)}

                            {/* Danh sách Thẻ Phim Tương Tác (tự động dàn 2 cột khi khung chat rộng >= 580px) */}
                            {hasCards && (
                              <div className={isWideGrid ? 'grid grid-cols-2 gap-2.5 mt-3' : 'space-y-2 mt-3'}>
                                {cardsToRender.map((card, cIdx) => {
                                  const slots =
                                    Array.isArray(card.showtimes) && card.showtimes.length > 0
                                      ? card.showtimes
                                      : card.showtimeId
                                        ? [
                                            {
                                              showtimeId: card.showtimeId,
                                              time: card.time,
                                              room: card.room,
                                              format: card.format || '',
                                              price: card.price || '',
                                              availableSeats: card.availableSeats,
                                            },
                                          ]
                                        : [];

                                  return (
                                    <div
                                      key={`${card.movieId || card.title}-${cIdx}`}
                                      className="bg-[#0B1026] border border-[#AA9BFF]/25 hover:border-[#42DFFF]/60 rounded-xl p-2.5 transition-all"
                                    >
                                      <div className="flex items-center justify-between gap-2.5">
                                        <div
                                          onClick={() => {
                                            const targetUrl = card.movieId
                                              ? `/movie/${card.movieId}`
                                              : card.showtimeId
                                                ? `/booking/seat/${card.showtimeId}`
                                                : null;
                                            if (targetUrl) {
                                              navigate(targetUrl);
                                              setIsOpen(false);
                                            }
                                          }}
                                          className="flex items-center space-x-2.5 cursor-pointer group min-w-0 flex-1"
                                          title="Xem chi tiết phim"
                                        >
                                          <img
                                            src={card.poster}
                                            alt={card.title}
                                            className="w-10 h-14 rounded-lg object-cover border border-[#AA9BFF]/25 shrink-0"
                                          />
                                          <div className="min-w-0 flex-1">
                                            <span className="font-extrabold text-[#F8F7FF] text-xs block truncate group-hover:text-[#42DFFF] transition-colors">
                                              {card.title}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                              {card.ageRating && (
                                                <span className="px-1.5 py-0.5 rounded bg-[#20204B] border border-[#AA9BFF]/25 text-[9px] font-black text-[#F8F7FF]">
                                                  {card.ageRating}
                                                </span>
                                              )}
                                              <div className="inline-flex items-center space-x-0.5 bg-cyan-500/15 border border-[#42DFFF]/30 px-1.5 py-0.2 rounded text-[10px] text-[#42DFFF] font-bold">
                                                <span>★</span>
                                                <span>{card.rating}</span>
                                              </div>
                                            </div>
                                            {slots.length === 1 && (
                                              <span className="text-[10px] text-[#BEC5E5] block truncate mt-1">
                                                {slots[0].time} • {slots[0].room}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {card.movieId ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigate(`/movie/${card.movieId}`);
                                              setIsOpen(false);
                                            }}
                                            className="shrink-0 bg-[#20204B] hover:bg-[#25234D] text-[#F8F7FF] px-2 py-1.5 rounded-lg text-[10px] font-bold border border-[#AA9BFF]/25 cursor-pointer transition-colors"
                                            title="Xem chi tiết & tất cả suất chiếu của phim này"
                                          >
                                            Chi tiết
                                          </button>
                                        ) : (
                                          card.showtimeId && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                navigate(`/booking/seat/${card.showtimeId}`);
                                                setIsOpen(false);
                                              }}
                                              className="shrink-0 bg-gradient-to-r from-[#A855F7] to-[#42DFFF] text-[#0B1026] p-2 rounded-lg text-xs font-bold shadow transition-transform hover:scale-105 cursor-pointer"
                                            >
                                              ➔
                                            </button>
                                          )
                                        )}
                                      </div>

                                      {/* Các nút suất chiếu bấm đặt vé trực tiếp */}
                                      {slots.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[#AA9BFF]/20">
                                          {slots.map((slot) => (
                                            <button
                                              key={slot.showtimeId}
                                              type="button"
                                              onClick={() => {
                                                navigate(`/booking/seat/${slot.showtimeId}`);
                                                setIsOpen(false);
                                              }}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] text-[10px] font-black rounded-lg shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                                              title={`Đặt vé ${card.title} lúc ${slot.time}`}
                                            >
                                              <span>
                                                Đặt {slot.time}
                                                {slot.format ? ` • ${slot.format}` : ''}
                                                {slot.price ? ` • ${slot.price}` : ''}
                                              </span>
                                              <span>➔</span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {/* Gợi ý bước tiếp theo theo ngữ cảnh (quickReplies từ Backend) */}
                            {msg.sender === 'bot' && Array.isArray(msg.quickReplies) && msg.quickReplies.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-[#AA9BFF]/15">
                                {msg.quickReplies.map((qr, qIdx) => (
                                  <button
                                    key={qIdx}
                                    type="button"
                                    onClick={() => handleChipClick(qr)}
                                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#20204B] hover:bg-[#2a2a60] text-[#83F5FF] border border-[#42DFFF]/30 transition-colors cursor-pointer"
                                  >
                                    {qr}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Thời gian & Trạng thái đã xem */}
                          <div
                            className={`flex items-center space-x-1 mt-1 text-[10px] text-[#929ABD] ${msg.sender === 'user' ? 'justify-end' : 'justify-start'
                              }`}
                          >
                            {msg.sender === 'user' && (
                              <span className="text-[#42DFFF] font-bold">✔✔</span>
                            )}
                            <span>{msg.time}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Avatar user bên phải */}
                    {msg.sender === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/40 text-[#F4A5FF] flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5">
                        👤
                      </div>
                    )}
                  </div>
                ))}

                {/* Trạng thái đang gõ Loading */}
                {loading && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-[#20204B] border border-[#42DFFF]/40 text-[#42DFFF] flex items-center justify-center text-xs shrink-0 shadow-sm">
                      🤖
                    </div>
                    <div className="bg-[#11152F] border border-[#AA9BFF]/25 rounded-2xl rounded-tl-xs px-4 py-3 text-[#BEC5E5] text-xs flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-[#42DFFF] animate-bounce"></span>
                      <span className="w-2 h-2 rounded-full bg-[#A855F7] animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 rounded-full bg-[#F4A5FF] animate-bounce [animation-delay:0.4s]"></span>
                      <span className="text-[11px] text-[#BEC5E5] font-medium pl-1">
                        AI đang tra cứu dữ liệu thời gian thực...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* HÀNG CÁC NÚT GỢI Ý NHANH (QUICK SUGGESTION CHIPS) */}
              <div
                onWheel={(e) => {
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
                className="px-3 pt-2 pb-2 bg-[#0B1026] border-t border-[#AA9BFF]/20 flex items-center gap-2 overflow-x-auto scrollbar-sleek-x scroll-smooth"
              >
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(chip.query)}
                    className="shrink-0 bg-[#11152F] hover:bg-[#20204B] border border-[#AA9BFF]/25 hover:border-[#42DFFF]/60 text-[#BEC5E5] hover:text-[#F8F7FF] text-[11px] font-semibold px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap shadow-sm hover:scale-[1.02]"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* KHU VỰC NHẬP TIN NHẮN (INPUT BOX) */}
              <div className="p-3 bg-[#11152F] border-t border-[#AA9BFF]/20">
                <form
                  onSubmit={handleSend}
                  className="bg-[#0B1026] border border-[#AA9BFF]/30 rounded-2xl flex items-center px-3 py-1.5 focus-within:border-[#42DFFF] focus-within:shadow-[0_0_15px_rgba(66,223,255,0.25)] transition-all"
                >
                  {/* Nút cộng tác vụ bổ sung (+) */}
                  <button
                    type="button"
                    onClick={() => setInput('Các bộ phim đang chiếu hiện tại?')}
                    className="w-6 h-6 rounded-lg text-[#BEC5E5] hover:text-[#F8F7FF] hover:bg-[#20204B] flex items-center justify-center text-sm font-bold mr-2 transition-colors cursor-pointer"
                    title="Gợi ý câu hỏi nhanh"
                  >
                    ⊕
                  </button>

                  {/* Input văn bản */}
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Hỏi phim đang chiếu, suất tối nay, ghế trống, vé của tôi..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 bg-transparent text-xs sm:text-[13px] text-[#F8F7FF] placeholder-[#BEC5E5]/50 focus:outline-none"
                  />

                  {/* Nút Mic thu âm */}
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer mr-1.5 ${isListening
                        ? 'text-red-400 bg-red-500/20 animate-pulse'
                        : 'text-[#BEC5E5] hover:text-[#F8F7FF] hover:bg-[#20204B]'
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

                  {/* Nút Gửi Paper Plane */}
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className={`w-8 h-8 rounded-xl bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] flex items-center justify-center transition-all shadow-md shadow-purple-500/25 shrink-0 ${loading || !input.trim()
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:brightness-110 hover:scale-105 cursor-pointer'
                      }`}
                    title="Gửi tin nhắn"
                  >
                    <svg className="w-4 h-4 text-[#0B1026] -rotate-45 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>

                {/* Footer chú thích dưới ô nhập */}
                <div className="flex items-center justify-between text-[10px] pt-2 px-1 text-[#929ABD]">
                  <div className="flex items-center space-x-1 text-[#42DFFF] font-medium">
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
