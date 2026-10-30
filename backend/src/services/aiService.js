import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../prisma.js';

// Khởi tạo Gemini Model nếu có API Key
const getGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

// Hàm truy xuất dữ liệu động từ Database (RAG Retrieval Step)
export const getCinemaCurrentContext = async () => {
  const now = new Date();

  // 1. Lấy danh sách phim đang chiếu kèm suất chiếu
  const movies = await prisma.movie.findMany({
    where: { status: 'NOW_SHOWING' },
    include: {
      showtimes: {
        orderBy: { startTime: 'asc' },
        include: {
          _count: {
            select: {
              seats: {
                where: { status: 'AVAILABLE' },
              },
            },
          },
        },
      },
    },
  });

  // Định dạng lại thông tin phim và suất chiếu cho ngắn gọn, súc tích
  const formattedMovies = movies.map((m) => ({
    id: m.id,
    title: m.title,
    genre: m.genre,
    ageRating: m.ageRating,
    duration: `${m.duration} phút`,
    description: m.description,
    showtimes: m.showtimes.map((st) => ({
      showtimeId: st.id,
      room: st.roomName,
      time: new Date(st.startTime).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      price: `${st.price.toLocaleString('vi-VN')} đ`,
      availableSeats: st._count.seats,
    })),
  }));

  // 2. Lấy bảng giá bắp nước
  const concessions = await prisma.concession.findMany({
    select: {
      name: true,
      price: true,
      description: true,
    },
  });

  // 3. Quy định rạp & chính sách vé (Kho tri thức tĩnh)
  const policies = [
    'Địa chỉ rạp: Tầng 5, MovieTix Plaza, 123 Đường Điện Ảnh, TP.HCM.',
    'Quy định độ tuổi: P (Mọi độ tuổi), T13 (Từ 13 tuổi trở lên), T16 (Từ 16 tuổi trở lên), T18 (Từ 18 tuổi trở lên - cần xuất trình CCCD).',
    'Chính sách vé: Vé đã mua không thể hoàn tiền nhưng có thể hỗ trợ đổi suất chiếu trước giờ chiếu ít nhất 60 phút tại quầy vé.',
    'Quy định rạp: Không mang thức ăn/thức uống có mùi nặng từ ngoài vào; vui lòng giữ trật tự và chuyển điện thoại sang chế độ rung.',
  ];

  return {
    updatedAt: now.toLocaleString('vi-VN'),
    movies: formattedMovies,
    concessions: concessions.map((c) => `${c.name}: ${c.price.toLocaleString('vi-VN')} đ (${c.description || ''})`),
    policies,
  };
};

// Hàm xử lý Chatbot RAG
export const generateChatResponse = async (userMessage, history = []) => {
  const model = getGeminiModel();

  // Lấy ngữ cảnh động từ DB (Retrieval)
  const context = await getCinemaCurrentContext();

  // Nếu chưa cấu hình API Key, sử dụng cơ chế phản hồi thông minh nội bộ dựa trên DB (Fallback)
  if (!model) {
    return generateLocalFallbackResponse(userMessage, context);
  }

  // Tăng cường ngữ cảnh (Augmentation)
  const systemInstruction = `
Bạn là "MovieTix AI" - Trợ lý ảo tư vấn rạp chiếu phim chuyên nghiệp, thân thiện và nhiệt tình của hệ thống MovieTix.
Dưới đây là DỮ LIỆU THỰC TẾ TRONG HỆ THỐNG RẠP NGAY LÚC NÀY:
----------------------------
CẬP NHẬT LÚC: ${context.updatedAt}

1. DANH SÁCH PHIM ĐANG CHIẾU & LỊCH CHIẾU HÔM NAY:
${JSON.stringify(context.movies, null, 2)}

2. MENU BẮP NƯỚC:
${context.concessions.join('\n')}

3. ĐỊA CHỈ & QUY ĐỊNH RẠP:
${context.policies.join('\n')}
----------------------------

QUY TẮC PHẢN HỒI BẮT BUỘC:
1. CHỈ sử dụng dữ liệu được cung cấp ở trên. Tuyệt đối KHÔNG tự sáng tác ra phim, giá vé hay giờ chiếu không có trong danh sách.
2. Trả lời bằng tiếng Việt thân thiện, tự nhiên, ngắn gọn và có cấu trúc rõ ràng (sử dụng bullet point, emoji 🎬, 🕒, 🍿 nếu phù hợp).
3. SMART DEEP-LINK: Bất cứ khi nào bạn nhắc đến một suất chiếu, hãy tạo đường link đặt vé theo định dạng chuẩn markdown:
   [👉 Đặt vé ngay suất {Giờ}](/booking/seat/{showtimeId})
   Ví dụ: "Suất 19:30 (Phòng 01 - IMAX Laser) giá 110.000đ: [👉 Đặt vé ngay suất 19:30](/booking/seat/1)"
4. Khi khách hỏi phim cho trẻ em hoặc gia đình, hãy xem nhãn độ tuổi (P) và thể loại (Hoạt hình, Gia đình) để gợi ý.
5. Nếu khách hỏi về phim không có trong rạp, hãy lịch sự thông báo hiện rạp chưa chiếu và gợi ý các phim đang chiếu có cùng thể loại.
`;

  try {
    // Định dạng lịch sử trò chuyện cho Gemini
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemInstruction }],
        },
        {
          role: 'model',
          parts: [{ text: 'Xin chào! Tôi là Trợ lý AI MovieTix. Tôi đã nắm rõ toàn bộ lịch chiếu, giá vé, số ghế trống và quy định rạp hôm nay. Tôi sẵn sàng hỗ trợ bạn!' }],
        },
      ],
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    return {
      success: true,
      reply: responseText,
      source: 'GEMINI_RAG',
    };
  } catch (error) {
    console.error('Lỗi khi gọi Gemini API:', error.message);
    // Nếu có lỗi API (quota, network), tự động fallback về engine xử lý nội bộ
    return generateLocalFallbackResponse(userMessage, context);
  }
};

// Bộ phân tích quy tắc dự phòng khi chưa cấu hình Gemini API Key
function generateLocalFallbackResponse(query, context) {
  const lower = query.toLowerCase();

  // 1. Khách hỏi về bắp nước
  if (lower.includes('bắp') || lower.includes('nước') || lower.includes('combo') || lower.includes('ăn')) {
    const list = context.concessions.map((c) => `• ${c}`).join('\n');
    return {
      success: true,
      reply: `🍿 **Bảng giá Bắp Nước tại rạp MovieTix:**\n${list}\n\nBạn có thể chọn bắp nước ngay tại bước Thanh toán vé nhé!`,
      source: 'LOCAL_RULE_ENGINE',
    };
  }

  // 2. Khách hỏi phim cho trẻ em / hoạt hình
  if (lower.includes('trẻ em') || lower.includes('con nít') || lower.includes('hoạt hình') || lower.includes('gia đình')) {
    const kidsMovie = context.movies.find((m) => m.ageRating === 'P' || m.genre.includes('Hoạt hình'));
    if (kidsMovie) {
      const showtimesText = kidsMovie.showtimes
        .map((st) => `• ${st.time} (${st.room}) - ${st.price}: [👉 Đặt vé ngay](/booking/seat/${st.showtimeId})`)
        .join('\n');
      return {
        success: true,
        reply: `🎬 Phim phù hợp nhất cho trẻ em và gia đình hiện nay là **${kidsMovie.title}** (Nhãn P - Dành cho mọi lứa tuổi).\n\n**Lịch chiếu hôm nay:**\n${showtimesText}`,
        source: 'LOCAL_RULE_ENGINE',
      };
    }
  }

  // 3. Khách hỏi về phim IMAX, Dune, bom tấn, hoặc suất chiếu tối sau 19h
  if (lower.includes('imax') || lower.includes('dune') || lower.includes('bom tấn') || (lower.includes('19h') && lower.includes('phim'))) {
    const duneMovie = context.movies.find((m) => m.title.toLowerCase().includes('dune')) || context.movies[0];
    const imaxShowtime = duneMovie?.showtimes.find((st) => st.room.toLowerCase().includes('imax') || st.time.includes('19')) || duneMovie?.showtimes[0];

    return {
      success: true,
      reply: `✨ **Gợi ý hoàn hảo nhất tối nay:**\n\nSuất chiếu lý tưởng nhất cho bạn là **${duneMovie?.title || 'Dune: Hành Tinh Cát 2'}** lúc **${imaxShowtime?.time || '19:15'}** tại **${imaxShowtime?.room || 'Phòng chiếu IMAX Laser 03, MovieTix Center Landmark'}**!\n\n💺 **Tư vấn ghế VIP:** Dãy ghế hàng F (F6, F7) ở vị trí trung tâm, tầm nhìn thẳng góc 135° và trọn vẹn trường nhìn siêu rộng của màn hình IMAX 22m x 12m với âm thanh vòm Dolby Atmos 128 kênh sống động.\n\n[👉 Đặt vé ngay suất ${imaxShowtime?.time || '19:15'} - Ghế VIP F6, F7](/booking/seat/${imaxShowtime?.showtimeId || 1})`,
      movieCard: {
        title: duneMovie?.title || 'Dune: Part Two',
        rating: '8.9',
        poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop',
        showtimeId: imaxShowtime?.showtimeId || 1,
        time: imaxShowtime?.time || '19:15',
        room: imaxShowtime?.room || 'Phòng IMAX 03',
      },
      source: 'LOCAL_RULE_ENGINE',
    };
  }

  // 4. Khách hỏi về phim hành động hoặc sau 19h nói chung
  if (lower.includes('hành động') || lower.includes('19h') || lower.includes('tối')) {
    const actionMovies = context.movies.filter((m) => m.genre.includes('Hành động'));
    if (actionMovies.length > 0) {
      let reply = `🎬 **Các phim hành động đang có suất chiếu buổi tối tại rạp:**\n\n`;
      actionMovies.forEach((m) => {
        reply += `**${m.title}** (${m.ageRating} - ${m.duration}):\n`;
        m.showtimes.forEach((st) => {
          reply += `• Suất ${st.time} (${st.room}) - Giá ${st.price} (Còn ${st.availableSeats} ghế trống): [👉 Đặt vé](/booking/seat/${st.showtimeId})\n`;
        });
        reply += `\n`;
      });
      return {
        success: true,
        reply: reply.trim(),
        source: 'LOCAL_RULE_ENGINE',
      };
    }
  }

  // 4. Mặc định: Giới thiệu toàn bộ phim đang chiếu kèm suất chiếu
  let defaultReply = `Chào bạn! Hôm nay tại **MovieTix** đang có các bộ phim chiếu rạp hấp dẫn sau:\n\n`;
  context.movies.forEach((m) => {
    defaultReply += `🎬 **${m.title}** (${m.ageRating} • ${m.duration} • ${m.genre})\n`;
    if (m.showtimes.length > 0) {
      m.showtimes.forEach((st) => {
        defaultReply += `   ↳ 🕒 ${st.time} (${st.room}) - ${st.price}: [👉 Đặt vé](/booking/seat/${st.showtimeId})\n`;
      });
    } else {
      defaultReply += `   ↳ *Chưa có suất chiếu hôm nay*\n`;
    }
    defaultReply += `\n`;
  });
  defaultReply += `Bạn muốn xem phim nào hoặc cần mình tư vấn thêm về giá vé/ghế ngồi không?`;

  return {
    success: true,
    reply: defaultReply,
    source: 'LOCAL_RULE_ENGINE',
  };
}

