/**
 * Script seed bình luận & đánh giá mẫu (DEMO) phục vụ trình diễn đồ án CDIO — IDEMPOTENT.
 * LƯU Ý: KHÔNG tự động chạy trên MongoDB Atlas vận hành. Chỉ chạy trên DB demo/test cô lập
 * với biến môi trường ALLOW_DEMO_REVIEW_SEED=1 và MONGO_URI trỏ tới DB thử nghiệm.
 *
 * Quy tắc:
 * - Nội dung bình luận riêng cho từng bộ phim (kèm phản hồi tương tác mẫu).
 * - Tất cả dữ liệu mẫu được đánh dấu rõ isDemo: true, verifiedAttendance: false.
 * - KHÔNG tự tạo đánh giá đã xác minh xem phim hay giả mạo lịch sử mua vé.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Movie from '../src/models/Movie.js';
import User from '../src/models/User.js';

const MOVIE_SPECIFIC_DEMO_THREADS = [
  {
    match: (title) => title.includes('mai'),
    items: [
      {
        fallbackName: 'Minh Anh',
        rating: null,
        likesCount: 9,
        comment: 'Phim có nhiều cảnh buồn không mọi người? Mình đang định đặt vé cuối tuần.',
        replies: [
          {
            fallbackName: 'Quốc Huy',
            likesCount: 4,
            comment: 'Mình xem rồi, phim thiên về tâm lý và tình cảm, có nhiều đoạn khá lắng đọng.',
          },
        ],
      },
      {
        fallbackName: 'Thảo Vy',
        rating: 5,
        likesCount: 14,
        comment: 'Diễn xuất của nữ chính rất tự nhiên, phần cuối khá xúc động.',
        replies: [],
      },
      {
        fallbackName: 'Gia Bảo',
        rating: null,
        likesCount: 6,
        comment: 'Mọi người xem rồi cho mình hỏi phim có phù hợp để đi xem cùng gia đình không?',
        replies: [
          {
            fallbackName: 'Ngọc Hân',
            likesCount: 3,
            comment: 'Phim có nhãn độ tuổi trưởng thành nên đi cùng bạn bè hoặc người yêu sẽ hợp hơn nhé.',
          },
        ],
      },
    ],
  },
  {
    match: (title) => title.includes('bố già') || title.includes('bo gia'),
    items: [
      {
        fallbackName: 'Khánh Linh',
        rating: null,
        likesCount: 7,
        comment: 'Phim thiên về hài hay cảm động hơn vậy mọi người? Mình tính rủ ba mẹ đi xem.',
        replies: [
          {
            fallbackName: 'Đức Anh',
            likesCount: 5,
            comment: 'Nửa đầu rất duyên dáng hài hước, nửa sau chạm đúng tâm lý gia đình nên xem cùng ba mẹ cực hợp.',
          },
        ],
      },
      {
        fallbackName: 'Hoàng Nam',
        rating: 5,
        likesCount: 11,
        comment: 'Thoại đời thường gần gũi, góc máy khu hẻm Sài Gòn làm rất có hồn.',
        replies: [],
      },
    ],
  },
  {
    match: (title) => title.includes('lật mặt') || title.includes('lat mat'),
    items: [
      {
        fallbackName: 'Phương Thảo',
        rating: null,
        likesCount: 8,
        comment: 'Phần này có cần xem các phần Lật Mặt trước không cả nhà?',
        replies: [
          {
            fallbackName: 'Tuấn Kiệt',
            likesCount: 6,
            comment: 'Cốt truyện độc lập hoàn toàn nha bạn, đi xem trực tiếp vẫn hiểu trọn vẹn.',
          },
        ],
      },
      {
        fallbackName: 'Mỹ Duyên',
        rating: 5,
        likesCount: 10,
        comment: 'Câu chuyện gia đình ấm áp, nhiều đoạn khiến cả rạp sụt sùi luôn.',
        replies: [],
      },
    ],
  },
  {
    match: (title) => title.includes('avatar'),
    items: [
      {
        fallbackName: 'Nhật Minh',
        rating: null,
        likesCount: 12,
        comment: 'Phim này nên chọn phòng IMAX Laser hay Dolby Atmos để trải nghiệm đã nhất mọi người?',
        replies: [
          {
            fallbackName: 'Hải Đăng',
            likesCount: 7,
            comment: 'Hình ảnh Pandora cực kỳ choáng ngợp nên ưu tiên IMAX Laser nếu còn ghế giữa nhé!',
          },
        ],
      },
      {
        fallbackName: 'Lan Chi',
        rating: 5,
        likesCount: 9,
        comment: 'Kỹ xảo và khung hình mãn nhãn, đúng chuẩn bom tấn điện ảnh.',
        replies: [],
      },
    ],
  },
];

const buildTailoredFallbackThreads = (movie) => [
  {
    fallbackName: 'Minh Khôi',
    rating: null,
    likesCount: 5,
    comment: `Có ai xem ${movie.title} rồi cho mình xin ít cảm nhận trước khi đặt vé cuối tuần được không?`,
    replies: [
      {
        fallbackName: 'Thanh Trúc',
        likesCount: 3,
        comment: `Nhịp phim ${movie.title} cuốn và hình ảnh chiếu ở phòng IMAX Laser / Dolby Atmos rất sắc nét nhé.`,
      },
    ],
  },
  {
    fallbackName: 'Quỳnh Như',
    rating: 4,
    likesCount: 7,
    comment: `Không khí thể loại ${movie.genre || 'điện ảnh'} của ${movie.title} khá cuốn hút, xem ngoài rạp rất đáng trải nghiệm.`,
    replies: [],
  },
];

export async function seedDemoReviews(connectionUri) {
  const shouldDisconnect = mongoose.connection.readyState === 0;
  if (shouldDisconnect) {
    if (!connectionUri) throw new Error('Thiếu MONGO_URI cho môi trường demo/test cô lập.');
    await mongoose.connect(connectionUri);
  }

  const existingCustomers = await User.find({ role: { $in: ['CUSTOMER', 'VIP'] } })
    .select('name')
    .limit(12)
    .lean();
  const customerNames = existingCustomers.map((u) => u.name).filter(Boolean);
  let nameCursor = 0;
  const pickDisplayName = (fallbackName) => {
    if (customerNames.length > 0) {
      const picked = customerNames[nameCursor % customerNames.length];
      nameCursor += 1;
      return picked;
    }
    return fallbackName;
  };

  const movies = await Movie.find({ status: { $in: ['NOW_SHOWING', 'COMING_SOON'] } }).select('_id title genre reviews');
  let added = 0;

  for (const movie of movies) {
    const lowerTitle = (movie.title || '').toLowerCase();
    const matched = MOVIE_SPECIFIC_DEMO_THREADS.find((entry) => entry.match(lowerTitle));
    const templates = matched ? matched.items : buildTailoredFallbackThreads(movie);

    const existingComments = new Set((movie.reviews || []).map((r) => String(r.comment || '').trim()));
    const toInsert = templates
      .filter((t) => !existingComments.has(t.comment.trim()))
      .map((t) => ({
        _id: new mongoose.Types.ObjectId(),
        userName: pickDisplayName(t.fallbackName),
        rating: t.rating,
        comment: t.comment,
        likes: [],
        likesCount: t.likesCount || 0,
        replies: (t.replies || []).map((rep) => ({
          _id: new mongoose.Types.ObjectId(),
          userName: pickDisplayName(rep.fallbackName),
          comment: rep.comment,
          likes: [],
          likesCount: rep.likesCount || 0,
          verifiedAttendance: false,
          hasBookedTicket: false,
          isDemo: true,
          createdAt: new Date(),
        })),
        createdAt: new Date(),
        verifiedAttendance: false, // Phân biệt rõ DEMO — KHÔNG giả mạo khách hàng đã xác minh xem phim
        hasBookedTicket: false,
        isDemo: true,
      }));

    if (toInsert.length > 0) {
      await Movie.updateOne({ _id: movie._id }, { $push: { reviews: { $each: toInsert } } });
      added += toInsert.length;
    }
  }

  if (shouldDisconnect) await mongoose.disconnect();
  return { moviesProcessed: movies.length, reviewsAdded: added };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  if (!process.env.ALLOW_DEMO_REVIEW_SEED) {
    console.error('Chặn chạy nhầm: hãy đặt ALLOW_DEMO_REVIEW_SEED=1 và trỏ MONGO_URI vào DB demo/test cô lập.');
    process.exit(1);
  }
  seedDemoReviews(process.env.MONGO_URI)
    .then((res) => console.log('Seed demo reviews hoàn tất:', res))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
