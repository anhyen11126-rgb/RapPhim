/**
 * Script kiểm thử tự động các tình huống nâng cấp AI Chatbot D'AVENOR CINEMA.
 * Chạy: node backend/scripts/testChatbotUpgrade.js
 */
import assert from 'node:assert/strict';
import {
  generateChatResponse,
  buildNormalizedCinemaContext,
  createVNDate,
  INTENTS,
} from '../src/services/aiService.js';

const nowDate = createVNDate(2026, 11, 24, 15, 0, 0); // Thứ 3, 24/11/2026 lúc 15:00 giờ VN

const mockMovies = [
  {
    _id: '65f000000000000000000001',
    title: 'Lật Mặt 7: Một Điều Ước',
    genre: 'Gia đình, Tâm lý',
    duration: 138,
    rating: 4.9,
    ageRating: 'P',
    status: 'NOW_SHOWING',
    posterUrl: '/images/movies/lat-mat-7.jpg',
    director: 'Lý Hải',
    cast: ['Thanh Hiền', 'Trương Minh Cường', 'Đinh Y Nhung'],
    description: 'Câu chuyện cảm động về tình mẫu tử của bà Hai và năm người con.',
  },
  {
    _id: '65f000000000000000000002',
    title: 'Quật Mộ Trùng Ma',
    genre: 'Kinh dị, Bí ẩn',
    duration: 134,
    rating: 4.8,
    ageRating: 'T16',
    status: 'NOW_SHOWING',
    posterUrl: '/images/movies/exhuma.jpg',
    director: 'Jang Jae-hyun',
    cast: ['Choi Min-sik', 'Kim Go-eun', 'Lee Do-hyun'],
    description: 'Nhóm pháp sư và thầy phong thủy khai quật ngôi mộ bí ẩn chứa lời nguyền cổ xưa.',
  },
  {
    _id: '65f000000000000000000003',
    title: 'Avatar: Dòng Chảy Của Nước',
    genre: 'Hành động, Viễn tưởng',
    duration: 192,
    rating: 4.9,
    ageRating: 'T13',
    status: 'NOW_SHOWING',
    posterUrl: '/images/movies/avatar.jpg',
    director: 'James Cameron',
    cast: ['Sam Worthington', 'Zoe Saldana'],
    description: 'Jake Sully cùng gia đình khám phá vùng đại dương Pandora đầy kỳ vĩ.',
  },
];

const mockCinemas = [
  {
    _id: '6aecb03919dd0ede75638b6e',
    name: "D'AVENOR Thanh Khê Plaza",
    address: 'Tầng 4 TTTM Thanh Khê Plaza, 295 Điện Biên Phủ, P. Chính Gián, Q. Thanh Khê, Đà Nẵng',
    city: 'Đà Nẵng',
    district: 'Thanh Khê',
    openingHours: '08:00 - 02:00 sáng',
    hotline: '1900 8899',
    parking: 'Hầm B1 & B2 TTTM Thanh Khê Plaza 24/7',
    isFlagship: true,
  },
];

const mockShowtimes = [
  {
    _id: '65a000000000000000000101',
    movieId: '65f000000000000000000001',
    cinemaId: '6aecb03919dd0ede75638b6e',
    roomName: 'Phòng Dolby Atmos',
    formatFeature: '2D Dolby Atmos',
    startTime: createVNDate(2026, 11, 24, 19, 30, 0),
    price: 75000,
    availableSeats: 62,
  },
  {
    _id: '65a000000000000000000102',
    movieId: '65f000000000000000000002',
    cinemaId: '6aecb03919dd0ede75638b6e',
    roomName: 'Phòng IMAX Laser',
    formatFeature: 'IMAX Laser',
    startTime: createVNDate(2026, 11, 24, 21, 0, 0),
    price: 150000,
    availableSeats: 48,
  },
  {
    _id: '65a000000000000000000103',
    movieId: '65f000000000000000000003',
    cinemaId: '6aecb03919dd0ede75638b6e',
    roomName: 'Phòng IMAX Laser',
    formatFeature: 'IMAX Laser',
    startTime: createVNDate(2026, 11, 24, 20, 15, 0),
    price: 160000,
    availableSeats: 55,
  },
];

const mockContext = buildNormalizedCinemaContext({
  movies: mockMovies,
  showtimes: mockShowtimes,
  cinemas: mockCinemas,
  concessions: [
    { _id: 'c1', name: 'Combo Đôi Cinema', price: 115000, description: '1 Bắp lớn + 2 Nước ngọt' },
  ],
  promotions: [
    { _id: 'p1', title: 'Giảm 20K Vé 2D', code: 'MTX20K', discountValue: 'GIẢM 20K', isActive: true },
  ],
  nowDate,
});

const emptyContext = buildNormalizedCinemaContext({
  movies: [],
  showtimes: [],
  cinemas: [],
  concessions: [],
  promotions: [],
  nowDate,
});

const baseOpts = {
  nowDate,
  skipLog: true,
  mockConfig: { botName: "Trợ lý AI D'AVENOR", isEnabled: true, faqs: [] },
  mockContext,
};

const tests = [
  {
    name: '1. "Các bộ phim đang chiếu hiện tại?" (KHÔNG bắt nhầm chữ "đang" thành tên phim)',
    run: async () => {
      const res = await generateChatResponse('Các bộ phim đang chiếu hiện tại?', [], undefined, baseOpts);
      assert.equal(res.intent, INTENTS.MOVIE_SEARCH);
      assert.ok(!res.reply.includes('"đang"'), 'Không được báo phim "đang" không chiếu');
      assert.ok(res.reply.includes('Lật Mặt 7'), 'Phải liệt kê Lật Mặt 7');
      assert.ok(res.reply.includes('Quật Mộ Trùng Ma'), 'Phải liệt kê Quật Mộ Trùng Ma');
      assert.equal(res.movieCards.length, 3, 'movieCards phải khớp 3 phim đang chiếu');
    },
  },
  {
    name: '2. "Có phim kinh dị nào tối nay không?" (Lọc đúng thể loại + khung giờ tối)',
    run: async () => {
      const res = await generateChatResponse('Có phim kinh dị nào tối nay không?', [], undefined, baseOpts);
      assert.equal(res.intent, INTENTS.MOVIE_RECOMMENDATION);
      assert.ok(res.reply.includes('Quật Mộ Trùng Ma'), 'Phải trả về phim kinh dị Quật Mộ Trùng Ma');
      assert.ok(res.reply.includes('21:00'), 'Phải có suất tối 21:00');
      assert.equal(res.movieCards.length, 1);
      assert.equal(res.movieCards[0].title, 'Quật Mộ Trùng Ma');
    },
  },
  {
    name: '3. Hội thoại nối tiếp 3 lượt dựa vào ngữ cảnh (Phim -> Tối nay mấy giờ -> Giá vé bao nhiêu)',
    run: async () => {
      const history = [];
      // Lượt 1
      const r1 = await generateChatResponse('Phim Lật Mặt 7 hôm nay có chiếu không?', history, undefined, baseOpts);
      assert.ok(r1.reply.includes('Lật Mặt 7'));
      history.push({ sender: 'user', text: 'Phim Lật Mặt 7 hôm nay có chiếu không?' });
      history.push({ sender: 'bot', text: r1.reply, movieCard: r1.movieCard, movieCards: r1.movieCards });

      // Lượt 2
      const r2 = await generateChatResponse('Tối nay mấy giờ?', history, undefined, {
        ...baseOpts,
        sessionContext: r1.sessionContext,
      });
      assert.equal(r2.intent, INTENTS.SHOWTIME_SEARCH);
      assert.ok(r2.reply.includes('Lật Mặt 7'), 'Lượt 2 phải nhớ phim Lật Mặt 7');
      assert.ok(r2.reply.includes('19:30'), 'Lượt 2 phải trả đúng suất 19:30');
      history.push({ sender: 'user', text: 'Tối nay mấy giờ?' });
      history.push({ sender: 'bot', text: r2.reply, movieCard: r2.movieCard, movieCards: r2.movieCards });

      // Lượt 3
      const r3 = await generateChatResponse('Giá vé bao nhiêu?', history, undefined, {
        ...baseOpts,
        sessionContext: r2.sessionContext,
      });
      assert.equal(r3.intent, INTENTS.TICKET_PRICE);
      assert.ok(r3.reply.includes('Lật Mặt 7'), 'Lượt 3 phải nhớ phim Lật Mặt 7');
      assert.ok(r3.reply.includes('19:30'), 'Lượt 3 phải báo giá đúng suất 19:30');
    },
  },
  {
    name: '4. Hỏi theo số thứ tự ("Phim thứ 2 nội dung sao?") sau khi xem danh sách phim',
    run: async () => {
      const r1 = await generateChatResponse('Các bộ phim đang chiếu hiện tại?', [], undefined, baseOpts);
      const history = [
        { sender: 'user', text: 'Các bộ phim đang chiếu hiện tại?' },
        { sender: 'bot', text: r1.reply, movieCard: r1.movieCard, movieCards: r1.movieCards },
      ];
      const r2 = await generateChatResponse('Phim thứ 2 nội dung sao?', history, undefined, {
        ...baseOpts,
        sessionContext: r1.sessionContext,
      });
      assert.equal(r2.intent, INTENTS.MOVIE_DETAIL);
      assert.ok(r2.reply.includes('Quật Mộ Trùng Ma'), 'Phim thứ 2 phải là Quật Mộ Trùng Ma');
      assert.ok(r2.reply.includes('ngôi mộ bí ẩn'), 'Phải trả về mô tả nội dung thật từ DB');
    },
  },
  {
    name: '5. Gõ sai chính tả / không dấu tên phim ("Lich chieu phim Avartar toi nay")',
    run: async () => {
      const res = await generateChatResponse('Lich chieu phim Avartar toi nay', [], undefined, baseOpts);
      assert.equal(res.intent, INTENTS.SHOWTIME_SEARCH);
      assert.ok(res.reply.includes('Avatar: Dòng Chảy Của Nước'), 'Phải khớp gần đúng sang Avatar');
      assert.ok(res.reply.includes('20:15'), 'Phải trả về suất 20:15');
    },
  },
  {
    name: '6. Hỏi phim không tồn tại trong hệ thống ("Phim Oppenheimer tối nay có chiếu không?")',
    run: async () => {
      const res = await generateChatResponse('Phim Oppenheimer tối nay có chiếu không?', [], undefined, baseOpts);
      assert.ok(res.reply.includes('Oppenheimer'));
      assert.ok(res.reply.includes('chưa có lịch chiếu'));
      assert.equal(res.movieCards.length, 0, 'Không được trả về movieCards giả');
    },
  },
  {
    name: '7. Câu hỏi ngoài lề không liên quan đến đặt vé ("Thời tiết Hà Nội hôm nay thế nào?")',
    run: async () => {
      const res = await generateChatResponse('Thời tiết Hà Nội hôm nay thế nào?', [], undefined, baseOpts);
      assert.equal(res.intent, INTENTS.OUT_OF_SCOPE);
      assert.ok(res.reply.includes("D'AVENOR Thanh Khê Plaza"));
      assert.equal(res.movieCards.length, 0);
    },
  },
  {
    name: '8. An toàn khi DB rỗng & tương thích ngược khi Frontend không gửi sessionContext',
    run: async () => {
      const res = await generateChatResponse('Các bộ phim đang chiếu hiện tại?', [], undefined, {
        ...baseOpts,
        mockContext: emptyContext,
      });
      assert.equal(res.success, true);
      assert.equal(res.movieCards.length, 0);
      const promoRes = await generateChatResponse('Có khuyến mãi gì không?', [], undefined, {
        ...baseOpts,
        mockContext: emptyContext,
      });
      assert.equal(promoRes.success, true);
    },
  },
  {
    name: '9. Đồng bộ chính xác số ghế trống với hệ thống (88/88 khi chưa đặt, 87/88 khi đặt 1 ghế)',
    run: async () => {
      const uninitContext = buildNormalizedCinemaContext({
        movies: [mockMovies[0]],
        showtimes: [
          {
            _id: '65a000000000000000000201',
            movieId: mockMovies[0]._id,
            cinemaId: mockCinemas[0]._id,
            roomId: { totalSeats: 88 },
            roomName: 'Phòng 01 - IMAX Laser',
            formatFeature: 'IMAX Laser',
            startTime: createVNDate(2026, 11, 24, 16, 30, 0),
            price: 140000,
          },
          {
            _id: '65a000000000000000000202',
            movieId: mockMovies[0]._id,
            cinemaId: mockCinemas[0]._id,
            roomId: { totalSeats: 88 },
            roomName: 'Phòng 01 - IMAX Laser',
            formatFeature: 'IMAX Laser',
            startTime: createVNDate(2026, 11, 24, 22, 20, 0),
            price: 150000,
          },
        ],
        seatsByShowtimeId: new Map(),
        bookedCountByShowtimeId: new Map([['65a000000000000000000202', 1]]),
        cinemas: mockCinemas,
        nowDate,
      });
      const res = await generateChatResponse('Lật Mặt 7 hôm nay còn bao nhiêu ghế?', [], undefined, {
        ...baseOpts,
        mockContext: uninitContext,
      });
      assert.ok(res.reply.includes('88/88'), `Phải hiển thị 88/88 cho suất 16:30, nhận được: ${res.reply}`);
      assert.ok(res.reply.includes('87/88'), `Phải hiển thị 87/88 cho suất 22:20, nhận được: ${res.reply}`);
      assert.ok(!res.reply.includes('86'), 'Không được fallback cứng 86 ghế nữa');
    },
  },
  {
    name: '10. Hiểu từ viết tắt & ngôn ngữ GenZ VN (helo, hnay co phim j hay ko, phim kd tnay may h, ve bn tien, tks ad)',
    run: async () => {
      const rHello = await generateChatResponse('helo', [], undefined, baseOpts);
      assert.equal(rHello.intent, INTENTS.GENERAL_CHAT);
      assert.ok(rHello.reply.includes('Chào'));

      const rList = await generateChatResponse('hnay co phim j hay ko', [], undefined, baseOpts);
      assert.ok([INTENTS.MOVIE_SEARCH, INTENTS.MOVIE_RECOMMENDATION].includes(rList.intent));
      assert.ok(rList.reply.includes('Lật Mặt 7'));

      const rHorror = await generateChatResponse('phim kd tnay may h', [], undefined, baseOpts);
      assert.equal(rHorror.intent, INTENTS.MOVIE_RECOMMENDATION);
      assert.ok(rHorror.reply.includes('Quật Mộ Trùng Ma'));
      assert.ok(rHorror.reply.includes('21:00'));

      const rPrice = await generateChatResponse('ve lat mat 7 bn tien', [], undefined, baseOpts);
      assert.equal(rPrice.intent, INTENTS.TICKET_PRICE);
      assert.ok(rPrice.reply.includes('Lật Mặt 7'));

      const rThanks = await generateChatResponse('tks ad nha', [], undefined, baseOpts);
      assert.equal(rThanks.intent, INTENTS.GENERAL_CHAT);
      assert.ok(rThanks.reply.includes('Rất vui'));
    },
  },
  {
    name: '11. Tra cứu đơn đặt vé cá nhân có xác thực JWT (chặn khách chưa đăng nhập & chặn xem vé người khác)',
    run: async () => {
      const sampleBookings = [
        {
          bookingCode: 'DAV-111222',
          customerEmail: 'khachA@gmail.com',
          customerPhone: '0901112222',
          movieTitle: 'Lật Mặt 7: Một Điều Ước',
          roomName: 'Phòng Dolby Atmos',
          cinemaName: "D'AVENOR Thanh Khê Plaza",
          startTime: createVNDate(2026, 11, 24, 19, 30, 0),
          seats: 'F5, F6',
          totalAmount: 150000,
          status: 'PAID',
          paymentMethod: 'VNPAY',
          isCheckedIn: false,
        },
        {
          bookingCode: 'DAV-999888',
          customerEmail: 'khachB@gmail.com',
          customerPhone: '0909998888',
          movieTitle: 'Quật Mộ Trùng Ma',
          roomName: 'Phòng IMAX Laser',
          cinemaName: "D'AVENOR Thanh Khê Plaza",
          startTime: createVNDate(2026, 11, 24, 21, 0, 0),
          seats: 'E3',
          totalAmount: 150000,
          status: 'PAID',
          paymentMethod: 'MOMO',
          isCheckedIn: false,
        },
      ];

      // 11a. Chưa đăng nhập -> yêu cầu đăng nhập, không lộ dữ liệu
      const rGuest = await generateChatResponse('Kiểm tra vé của tôi', [], undefined, {
        ...baseOpts,
        mockAuthUser: null,
        mockBookings: sampleBookings,
      });
      assert.equal(rGuest.intent, INTENTS.BOOKING_LOOKUP);
      assert.ok(rGuest.reply.includes('đăng nhập'));
      assert.ok(!rGuest.reply.includes('DAV-111222'));

      // 11b. Đã đăng nhập khách A -> chỉ thấy vé của khách A (hỗ trợ cả cách hỏi "vé mình đã đặt")
      const rUserA = await generateChatResponse('vé mình đã đặt', [], undefined, {
        ...baseOpts,
        mockAuthUser: { id: 'u1', name: 'Khách A', email: 'khachA@gmail.com', phone: '0901112222' },
        mockBookings: sampleBookings,
      });
      assert.equal(rUserA.intent, INTENTS.BOOKING_LOOKUP);
      assert.ok(rUserA.reply.includes('DAV-111222'));
      assert.ok(rUserA.reply.includes('F5, F6'));
      assert.ok(!rUserA.reply.includes('DAV-999888'), 'Không được lộ vé của khách B');

      // 11c. Khách A cố tra mã vé của khách B -> từ chối / không tìm thấy
      const rCross = await generateChatResponse('Kiểm tra mã vé DAV-999888', [], undefined, {
        ...baseOpts,
        mockAuthUser: { id: 'u1', name: 'Khách A', email: 'khachA@gmail.com', phone: '0901112222' },
        mockBookings: sampleBookings,
      });
      assert.equal(rCross.intent, INTENTS.BOOKING_LOOKUP);
      assert.ok(rCross.reply.includes('không tìm thấy'));
      assert.ok(!rCross.reply.includes('Quật Mộ Trùng Ma'));
    },
  },
  {
    name: '12. Đồng bộ ưu đãi theo từng thứ trong tuần (Hôm nay Thứ 3 -> TUE45K, Ngày mai Thứ 4 -> WED50K)',
    run: async () => {
      const rToday = await generateChatResponse('Hôm nay có ưu đãi gì?', [], undefined, baseOpts);
      assert.equal(rToday.intent, INTENTS.PROMOTION_VOUCHER);
      assert.ok(rToday.reply.includes('THỨ 3 VUI VẺ'));
      assert.ok(rToday.reply.includes('TUE45K'));

      const rTomorrow = await generateChatResponse('Ngày mai có khuyến mãi gì?', [], undefined, baseOpts);
      assert.equal(rTomorrow.intent, INTENTS.PROMOTION_VOUCHER);
      assert.ok(rTomorrow.reply.includes('THỨ 4 HAPPY DAY'));
      assert.ok(rTomorrow.reply.includes('WED50K'));
    },
  },
  {
    name: '13. Hỗ trợ khách hàng & điều hướng nhanh sang trang /support (nhân viên, đồ ăn ngoài, mất mã vé)',
    run: async () => {
      const rStaff = await generateChatResponse('Tôi muốn liên hệ nhân viên hỗ trợ', [], undefined, baseOpts);
      assert.equal(rStaff.intent, INTENTS.CUSTOMER_SUPPORT);
      assert.ok(rStaff.reply.includes('1900 8899'));
      assert.ok(rStaff.reply.includes('/support'));

      const rFood = await generateChatResponse('Có được mang đồ ăn từ bên ngoài vào không?', [], undefined, baseOpts);
      assert.equal(rFood.intent, INTENTS.CUSTOMER_SUPPORT);
      assert.ok(rFood.reply.includes('không cho phép mang đồ ăn'));

      const rLost = await generateChatResponse('Tôi bị mất mã vé thì phải làm sao?', [], undefined, baseOpts);
      assert.equal(rLost.intent, INTENTS.CUSTOMER_SUPPORT);
      assert.ok(rLost.reply.includes('/my-tickets'));
      assert.ok(rLost.reply.includes('/support'));
    },
  },
  {
    name: '14. Đồng bộ đầy đủ tất cả khung giờ & 3 phòng chiếu trong ngày (16:30, 19:30, 22:20 × IMAX/Dolby/Gold Class)',
    run: async () => {
      const fullDayShowtimes = [
        // IMAX Laser
        { _id: '65b000000000000000000301', movieId: mockMovies[0]._id, cinemaId: mockCinemas[0]._id, roomId: { totalSeats: 88 }, roomName: 'Phòng 01 - IMAX Laser', formatFeature: 'IMAX Laser', startTime: createVNDate(2026, 11, 24, 16, 30, 0), price: 140000 },
        { _id: '65b000000000000000000302', movieId: mockMovies[0]._id, cinemaId: mockCinemas[0]._id, roomId: { totalSeats: 88 }, roomName: 'Phòng 01 - IMAX Laser', formatFeature: 'IMAX Laser', startTime: createVNDate(2026, 11, 24, 19, 30, 0), price: 150000 },
        { _id: '65b000000000000000000303', movieId: mockMovies[0]._id, cinemaId: mockCinemas[0]._id, roomId: { totalSeats: 88 }, roomName: 'Phòng 01 - IMAX Laser', formatFeature: 'IMAX Laser', startTime: createVNDate(2026, 11, 24, 22, 20, 0), price: 150000 },
        // Dolby Atmos
        { _id: '65b000000000000000000304', movieId: mockMovies[0]._id, cinemaId: mockCinemas[0]._id, roomId: { totalSeats: 88 }, roomName: 'Phòng 05 - Dolby Atmos', formatFeature: '2D Dolby Atmos', startTime: createVNDate(2026, 11, 24, 16, 30, 0), price: 110000 },
        { _id: '65b000000000000000000305', movieId: mockMovies[0]._id, cinemaId: mockCinemas[0]._id, roomId: { totalSeats: 88 }, roomName: 'Phòng 05 - Dolby Atmos', formatFeature: '2D Dolby Atmos', startTime: createVNDate(2026, 11, 24, 19, 30, 0), price: 120000 },
        { _id: '65b000000000000000000306', movieId: mockMovies[0]._id, cinemaId: mockCinemas[0]._id, roomId: { totalSeats: 88 }, roomName: 'Phòng 05 - Dolby Atmos', formatFeature: '2D Dolby Atmos', startTime: createVNDate(2026, 11, 24, 22, 20, 0), price: 120000 },
        // Gold Class
        { _id: '65b000000000000000000307', movieId: mockMovies[0]._id, cinemaId: mockCinemas[0]._id, roomId: { totalSeats: 88 }, roomName: 'Phòng 09 - Gold Class', formatFeature: 'Gold Class', startTime: createVNDate(2026, 11, 24, 16, 30, 0), price: 180000 },
        { _id: '65b000000000000000000308', movieId: mockMovies[0]._id, cinemaId: mockCinemas[0]._id, roomId: { totalSeats: 88 }, roomName: 'Phòng 09 - Gold Class', formatFeature: 'Gold Class', startTime: createVNDate(2026, 11, 24, 19, 30, 0), price: 190000 },
        { _id: '65b000000000000000000309', movieId: mockMovies[0]._id, cinemaId: mockCinemas[0]._id, roomId: { totalSeats: 88 }, roomName: 'Phòng 09 - Gold Class', formatFeature: 'Gold Class', startTime: createVNDate(2026, 11, 24, 22, 20, 0), price: 190000 },
      ];
      const fullDayCtx = buildNormalizedCinemaContext({
        movies: [mockMovies[0]],
        showtimes: fullDayShowtimes,
        seatsByShowtimeId: new Map(),
        bookedCountByShowtimeId: new Map([
          ['65b000000000000000000303', 1], // 87/88
          ['65b000000000000000000307', 2], // 86/88
        ]),
        cinemas: mockCinemas,
        nowDate,
      });

      const res = await generateChatResponse('Lịch chiếu Lật Mặt 7 hôm nay', [], undefined, {
        ...baseOpts,
        mockContext: fullDayCtx,
      });
      assert.ok(res.reply.includes('Phòng chiếu IMAX Laser'));
      assert.ok(res.reply.includes('Phòng chiếu Dolby Atmos'));
      assert.ok(res.reply.includes('Phòng chiếu Gold Class'));
      assert.ok(res.reply.includes('16:30'));
      assert.ok(res.reply.includes('19:30'));
      assert.ok(res.reply.includes('22:20'));
      assert.ok(res.reply.includes('87/88'));
      assert.ok(res.reply.includes('86/88'));
      assert.equal(res.movieCards.length, 1);
      assert.equal(res.movieCards[0].showtimes.length, 9, 'Thẻ phim phải chứa đủ cả 9 suất chiếu trong ngày');
    },
  },
  {
    name: '15. Tìm phim bằng tên rút gọn ngăn cách bởi "&" / "x" ("ghế trống phim deadpool" -> Deadpool & Wolverine)',
    run: async () => {
      const deadpoolCtx = buildNormalizedCinemaContext({
        movies: [
          {
            _id: '65f000000000000000000009',
            title: 'Deadpool & Wolverine',
            genre: 'Hành động, Hài',
            duration: 128,
            rating: 4.8,
            ageRating: 'T18',
            status: 'NOW_SHOWING',
          },
        ],
        showtimes: [
          {
            _id: '65b000000000000000000401',
            movieId: '65f000000000000000000009',
            cinemaId: mockCinemas[0]._id,
            roomId: { totalSeats: 88 },
            roomName: 'Phòng 01 - IMAX Laser',
            formatFeature: 'IMAX Laser',
            startTime: createVNDate(2026, 11, 24, 19, 30, 0),
            price: 150000,
          },
        ],
        seatsByShowtimeId: new Map(),
        cinemas: mockCinemas,
        nowDate,
      });

      const res = await generateChatResponse('ghế trống phim deadpool', [], undefined, {
        ...baseOpts,
        mockContext: deadpoolCtx,
      });
      assert.equal(res.intent, INTENTS.SEAT_AVAILABILITY);
      assert.ok(res.reply.includes('Deadpool & Wolverine'), `Phải nhận đúng Deadpool & Wolverine, nhận được: ${res.reply}`);
      assert.ok(res.reply.includes('88/88'));
      assert.equal(res.movieCards.length, 1);
    },
  },
  {
    name: '16. Hỏi phim theo tháng ("tháng 12 có phim j" -> trả đúng 3 phim sắp chiếu Tháng 12/2026)',
    run: async () => {
      const decCtx = buildNormalizedCinemaContext({
        movies: [
          ...mockMovies,
          {
            _id: '65f000000000000000000011',
            title: 'Venom: Kèo Cuối (Venom: The Last Dance)',
            genre: 'Hành động, Viễn tưởng',
            duration: 110,
            rating: 4.6,
            ageRating: 'T16',
            status: 'COMING_SOON',
            releaseDate: createVNDate(2026, 12, 5, 0, 0, 0),
          },
          {
            _id: '65f000000000000000000012',
            title: 'Mufasa: Vua Sư Tử (Mufasa: The Lion King)',
            genre: 'Hoạt hình, Phiêu lưu',
            duration: 118,
            rating: 4.6,
            ageRating: 'P',
            status: 'COMING_SOON',
            releaseDate: createVNDate(2026, 12, 18, 0, 0, 0),
          },
          {
            _id: '65f000000000000000000013',
            title: 'Hành Trình Của Moana 2',
            genre: 'Hoạt hình, Gia đình',
            duration: 100,
            rating: 4.6,
            ageRating: 'P',
            status: 'COMING_SOON',
            releaseDate: createVNDate(2026, 12, 24, 0, 0, 0),
          },
        ],
        showtimes: mockShowtimes,
        cinemas: mockCinemas,
        nowDate,
      });

      const res = await generateChatResponse('tháng 12 có phim j', [], undefined, {
        ...baseOpts,
        mockContext: decCtx,
      });
      assert.equal(res.intent, INTENTS.MOVIE_SEARCH);
      assert.ok(res.reply.includes('Tháng 12/2026'));
      assert.ok(res.reply.includes('Venom: Kèo Cuối'));
      assert.ok(res.reply.includes('Mufasa: Vua Sư Tử'));
      assert.ok(res.reply.includes('Moana 2'));
      assert.ok(!res.reply.includes('Lật Mặt 7'), 'Không được trả phim tháng 11 khi khách hỏi tháng 12');
    },
  },
  {
    name: '17. Hỏi "mình muốn đặt vé" -> gợi ý ngay các phim đang chiếu kèm thẻ chọn giờ đặt vé',
    run: async () => {
      const res = await generateChatResponse('mình muốn đặt vé', [], undefined, baseOpts);
      assert.equal(res.intent, INTENTS.BOOKING_GUIDE);
      assert.ok(res.reply.includes('Lật Mặt 7'));
      assert.ok(res.movieCards.length > 0, 'Phải trả về thẻ phim để khách chọn đặt vé ngay');
    },
  },
];

let passed = 0;
for (const t of tests) {
  try {
    await t.run();
    console.log(`✅ PASS: ${t.name}`);
    passed += 1;
  } catch (err) {
    console.error(`❌ FAIL: ${t.name}\n   -> ${err.message}`);
    process.exitCode = 1;
  }
}

console.log(`\nKết quả: ${passed}/${tests.length} test cases PASS.`);
