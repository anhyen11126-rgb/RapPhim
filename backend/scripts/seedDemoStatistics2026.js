import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
// Tạo 88 ghế chuẩn cho mỗi phòng chiếu (Hàng A-D: STANDARD, E-G: VIP, H: 4 ghế SWEETBOX = 88 ghế)
function buildStandard88SeatTemplates() {
  const templates = [];
  const standardRows = ['A', 'B', 'C', 'D'];
  const vipRows = ['E', 'F', 'G'];
  for (const row of standardRows) {
    for (let col = 1; col <= 12; col++) {
      templates.push({ seatNumber: `${row}${col}`, row, col, type: 'STANDARD' });
    }
  }
  for (const row of vipRows) {
    for (let col = 1; col <= 12; col++) {
      templates.push({ seatNumber: `${row}${col}`, row, col, type: 'VIP' });
    }
  }
  for (let col = 1; col <= 4; col++) {
    templates.push({ seatNumber: `H${col}`, row: 'H', col, type: 'SWEETBOX' });
  }
  return templates;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const LIVE_URI =
  process.env.MONGODB_LIVE_URI ||
  'mongodb+srv://anhyen11126_db_user:MovieTix123456@movietixcluster.hi1rrqr.mongodb.net/movietix_db?retryWrites=true&w=majority';
const DEMO_URI =
  process.env.MONGODB_DEMO_URI ||
  LIVE_URI.replace(/\/movietix_db(\?|$)/, '/movietix_demo_db$1');

// Deterministic PRNG để chạy lại nhiều lần vẫn ra đúng bộ dữ liệu nhất quán
function createSeededRandom(seed = 20261126) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const CUSTOMER_POOL = [
  { name: 'Nguyễn Văn Minh', phone: '0905123451', email: 'minh.nguyen@davenor.demo' },
  { name: 'Trần Thị Thu Hà', phone: '0905123452', email: 'ha.tran@davenor.demo' },
  { name: 'Lê Hoàng Nam', phone: '0914234563', email: 'nam.le@davenor.demo' },
  { name: 'Phạm Ngọc Ánh', phone: '0935345674', email: 'anh.pham@davenor.demo' },
  { name: 'Hoàng Quốc Bảo', phone: '0988456785', email: 'bao.hoang@davenor.demo' },
  { name: 'Đặng Khánh Linh', phone: '0977567896', email: 'linh.dang@davenor.demo' },
  { name: 'Võ Thanh Tùng', phone: '0905678907', email: 'tung.vo@davenor.demo' },
  { name: 'Bùi Phương Thảo', phone: '0932789018', email: 'thao.bui@davenor.demo' },
  { name: 'Đỗ Minh Quân', phone: '0918890129', email: 'quan.do@davenor.demo' },
  { name: 'Ngô Bảo Châu', phone: '0909901230', email: 'chau.ngo@davenor.demo' },
  { name: 'Huỳnh Gia Huy', phone: '0935112233', email: 'huy.huynh@davenor.demo' },
  { name: 'Phan Mỹ Duyên', phone: '0905445566', email: 'duyen.phan@davenor.demo' },
];

const PAYMENT_METHODS = ['MOMO', 'VNPAY', 'MOMO', 'VNPAY', 'CASH'];

// Giá vé chuẩn theo hạng phòng & loại ghế của D'AVENOR CINEMA
const ROOM_SEAT_PRICES = {
  'IMAX Laser': { STANDARD: 130000, VIP: 150000, SWEETBOX: 320000, base: 130000 },
  'Dolby Atmos': { STANDARD: 95000, VIP: 115000, SWEETBOX: 250000, base: 95000 },
  'Gold Class': { STANDARD: 210000, VIP: 240000, SWEETBOX: 500000, base: 210000 },
};

// Mức doanh thu vé mục tiêu (triệu đồng) cho 31 ngày Tháng 10/2026 (01/10 -> 31/10)
// Có ngày cao điểm cuối tuần, ngày lễ 20/10, ngày thấp điểm đầu tuần và 1 ngày bảo trì/không phát sinh (13/10)
const OCT_DAILY_TARGET_REVENUE = [
  3800000,  // 01/10 (Thu)
  6400000,  // 02/10 (Fri)
  11200000, // 03/10 (Sat)
  12800000, // 04/10 (Sun)
  3200000,  // 05/10 (Mon)
  2400000,  // 06/10 (Tue)
  4500000,  // 07/10 (Wed)
  5100000,  // 08/10 (Thu)
  7800000,  // 09/10 (Fri)
  13500000, // 10/10 (Sat)
  11900000, // 11/10 (Sun)
  2100000,  // 12/10 (Mon)
  0,        // 13/10 (Tue - Ngày thấp điểm không phát sinh giao dịch)
  3900000,  // 14/10 (Wed)
  5400000,  // 15/10 (Thu)
  8200000,  // 16/10 (Fri)
  14200000, // 17/10 (Sat)
  13100000, // 18/10 (Sun)
  6800000,  // 19/10 (Mon - Cận lễ 20/10)
  14800000, // 20/10 (Tue - Lễ Phụ nữ Việt Nam 20/10 cao điểm)
  4900000,  // 21/10 (Wed)
  4200000,  // 22/10 (Thu)
  7500000,  // 23/10 (Fri)
  12600000, // 24/10 (Sat)
  11400000, // 25/10 (Sun)
  2900000,  // 26/10 (Mon)
  3400000,  // 27/10 (Tue)
  5200000,  // 28/10 (Wed)
  6700000,  // 29/10 (Thu)
  9600000,  // 30/10 (Fri - Halloween Eve)
  15200000, // 31/10 (Sat - Đêm Halloween đỉnh điểm)
];

// Mức doanh thu mục tiêu cho 26 ngày Tháng 11/2026 (01/11 -> 26/11/2026)
// Tuyệt đối không tạo doanh thu cho ngày 27/11 -> 30/11 (tương lai)
const NOV_DAILY_TARGET_REVENUE = [
  13800000, // 01/11 (Sun)
  3400000,  // 02/11 (Mon)
  2600000,  // 03/11 (Tue)
  4800000,  // 04/11 (Wed)
  5500000,  // 05/11 (Thu)
  8900000,  // 06/11 (Fri)
  14400000, // 07/11 (Sat)
  13200000, // 08/11 (Sun)
  2200000,  // 09/11 (Mon)
  1650000,  // 10/11 (Tue - Ngày rất ít vé)
  4300000,  // 11/11 (Wed)
  5900000,  // 12/11 (Thu)
  8400000,  // 13/11 (Fri)
  13900000, // 14/11 (Sat)
  12700000, // 15/11 (Sun)
  3100000,  // 16/11 (Mon)
  3700000,  // 17/11 (Tue)
  5100000,  // 18/11 (Wed)
  7600000,  // 19/11 (Thu)
  14900000, // 20/11 (Fri - Lễ Nhà giáo Việt Nam 20/11 cao điểm)
  15600000, // 21/11 (Sat - Cuối tuần lễ 20/11)
  13400000, // 22/11 (Sun)
  3800000,  // 23/11 (Mon)
  4600000,  // 24/11 (Tue)
  6800000,  // 25/11 (Wed)
  8500000,  // 26/11 (Thu - Ngày hiện tại)
];

const DAILY_TIME_SLOTS = ['09:30', '13:30', '16:30', '19:15', '21:45'];

function makeVnDate(year, month, day, hour = 0, minute = 0, second = 0) {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, 0) - 7 * 3600 * 1000;
  return new Date(utcMs);
}

async function run() {
  console.log('🚀 Bắt đầu khởi tạo và đồng bộ dữ liệu DEMO trên movietix_demo_db...');
  console.log('   - LIVE DB (Chỉ đọc):', LIVE_URI.replace(/\/\/.*@/, '//***@'));
  console.log('   - DEMO DB (Đích):   ', DEMO_URI.replace(/\/\/.*@/, '//***@'));

  await mongoose.connect(LIVE_URI, { serverSelectionTimeoutMS: 15000 });
  const liveConn = mongoose.connection.useDb('movietix_db', { useCache: true });
  const demoConn = mongoose.connection.useDb('movietix_demo_db', { useCache: true });

  try {
    // 1. Sao chép các collection nền từ movietix_db sang movietix_demo_db (giữ nguyên _id và liên kết)
    const baseCollections = [
      'adminusers',
      'users',
      'cinemas',
      'rooms',
      'movies',
      'concessions',
      'promotions',
      'ticketpricingconfigs',
      'aiconfigs',
    ];

    for (const colName of baseCollections) {
      const docs = await liveConn.db.collection(colName).find({}).toArray();
      if (docs.length > 0) {
        const bulkOps = docs.map((doc) => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true,
          },
        }));
        await demoConn.db.collection(colName).bulkWrite(bulkOps, { ordered: false });
      }
      console.log(`✔ Đã đồng bộ collection nền [${colName}]: ${docs.length} bản ghi`);
    }

    // 2. Sao chép các Showtime hiện có của ngày 25/11 -> 29/11 từ LIVE sang DEMO nếu chưa có
    const liveShowtimes = await liveConn.db.collection('showtimes').find({}).toArray();
    if (liveShowtimes.length > 0) {
      const stOps = liveShowtimes.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await demoConn.db.collection('showtimes').bulkWrite(stOps, { ordered: false });
      console.log(`✔ Đã đồng bộ ${liveShowtimes.length} suất chiếu gốc từ LIVE sang DEMO`);
    }

    // Dọn sạch dữ liệu DEMO batch cũ (idempotent) trước khi tạo lại
    const oldDemoShowtimes = await demoConn.db
      .collection('showtimes')
      .find({ batchId: /^DEMO_HIST_2026_/ })
      .project({ _id: 1 })
      .toArray();
    const oldDemoStIds = oldDemoShowtimes.map((s) => s._id);

    if (oldDemoStIds.length > 0) {
      await demoConn.db.collection('showtimeseats').deleteMany({ showtimeId: { $in: oldDemoStIds } });
      await demoConn.db.collection('showtimes').deleteMany({ _id: { $in: oldDemoStIds } });
    }
    await demoConn.db.collection('bookings').deleteMany({ bookingCode: /^MTX-DEMO-/ });

    // Đảm bảo tất cả các suất chiếu gốc (25/11 - 29/11) trên DEMO có đủ 88 ghế AVAILABLE ban đầu
    const existingLiveStIds = liveShowtimes.map((s) => s._id);
    if (existingLiveStIds.length > 0) {
      await demoConn.db.collection('showtimeseats').deleteMany({ showtimeId: { $in: existingLiveStIds } });
      const seatTemplates88 = buildStandard88SeatTemplates();
      const seatChunks = [];
      for (const st of liveShowtimes) {
        for (const tpl of seatTemplates88) {
          seatChunks.push({
            showtimeId: st._id,
            roomId: st.roomId,
            seatNumber: tpl.seatNumber,
            row: tpl.row,
            col: tpl.col,
            type: tpl.type,
            status: 'AVAILABLE',
            holdId: null,
            holdOwnerId: null,
            holdExpiresAt: null,
            bookingId: null,
            version: 0,
          });
        }
      }
      for (let i = 0; i < seatChunks.length; i += 4000) {
        await demoConn.db.collection('showtimeseats').insertMany(seatChunks.slice(i, i + 4000), { ordered: false });
      }
      console.log(`✔ Đã khởi tạo 88 ghế chuẩn cho ${liveShowtimes.length} suất chiếu gốc`);
    }

    // 3. Lấy danh sách Rooms, Movies, Concessions, Users trong DEMO DB để tạo lịch chiếu & giao dịch lịch sử
    const rooms = await demoConn.db.collection('rooms').find({}).sort({ roomNumber: 1 }).toArray();
    const movies = await demoConn.db.collection('movies').find({}).toArray();
    const concessions = await demoConn.db.collection('concessions').find({}).toArray();
    const users = await demoConn.db.collection('users').find({ role: { $ne: 'ADMIN' } }).toArray();
    const cinema = await demoConn.db.collection('cinemas').findOne({});

    // Chọn nhóm phim chủ lực cho Tháng 10 và Tháng 11
    const findMovie = (kw) => movies.find((m) => m.title.toLowerCase().includes(kw.toLowerCase()));
    const duneMovie = findMovie('Dune') || movies[0];
    const maiMovie = findMovie('Mai') || movies[1];
    const deadpoolMovie = findMovie('Deadpool') || movies[2];
    const oppenheimerMovie = findMovie('Oppenheimer') || movies[3] || duneMovie;
    const spidermanMovie = findMovie('Spider-Man') || movies[4] || maiMovie;
    const exhumaMovie = findMovie('Quật Mộ') || movies[5] || deadpoolMovie;
    const godzillaMovie = findMovie('Godzilla') || movies[6] || duneMovie;
    const latMatMovie = findMovie('Lật Mặt') || movies[7] || maiMovie;

    const octMoviesPool = [
      duneMovie,
      oppenheimerMovie,
      exhumaMovie,
      spidermanMovie,
      godzillaMovie,
      latMatMovie,
      maiMovie,
    ].filter(Boolean);

    const novMoviesPool = [
      duneMovie,
      maiMovie,
      deadpoolMovie,
      oppenheimerMovie,
      exhumaMovie,
      spidermanMovie,
      godzillaMovie,
    ].filter(Boolean);

    const rand = createSeededRandom(20261011);
    const seatTemplates88 = buildStandard88SeatTemplates();

    const newShowtimes = [];
    const newShowtimeSeats = [];
    const newBookings = [];

    // Helper tạo lịch chiếu & đơn đặt vé cho 1 ngày
    const generateDayActivity = ({ year, month, day, targetRevenue, moviesPool, existingDayShowtimes = [] }) => {
      const isWeekend = [0, 5, 6].includes(makeVnDate(year, month, day, 12, 0).getUTCDay());
      const dayShowtimes = [...existingDayShowtimes];

      // Nếu ngày này chưa có suất chiếu (01/10 -> 24/11), tạo suất chiếu phân bổ đều trên 9 phòng vật lý (IMAX, Dolby, Gold Class)
      if (dayShowtimes.length === 0) {
        const roomsToSchedule = isWeekend || targetRevenue >= 9000000 ? rooms : rooms.filter((_, idx) => idx % 2 === (day % 2));
        const slotsToUse = isWeekend || targetRevenue >= 10000000
          ? ['09:30', '14:00', '18:30', '21:15']
          : ['10:00', '15:30', '19:30'];

        roomsToSchedule.forEach((room, rIdx) => {
          slotsToUse.forEach((slotStr, sIdx) => {
            const [hh, mm] = slotStr.split(':').map(Number);
            // Xếp lệch 5-15 phút giữa các phòng cùng loại
            const staggerMin = ((room.roomNumber - 1) % 3) * 10;
            const startTime = makeVnDate(year, month, day, hh, mm + staggerMin, 0);
            const mv = moviesPool[(day + rIdx + sIdx) % moviesPool.length];
            const durationMin = Number(mv.duration || 130);
            const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);
            const cleaningEndTime = new Date(endTime.getTime() + 20 * 60 * 1000);
            const basePrice = ROOM_SEAT_PRICES[room.roomType]?.base || 130000;

            const nowCutoff = makeVnDate(2026, 11, 26, 9, 35, 0);
            const lifecycleStatus =
              endTime <= nowCutoff
                ? 'COMPLETED'
                : startTime <= nowCutoff && endTime > nowCutoff
                ? 'NOW_SHOWING'
                : 'UPCOMING';

            const stDoc = {
              _id: new mongoose.Types.ObjectId(),
              movieId: mv._id,
              cinemaId: cinema?._id || room.cinemaId,
              roomId: room._id,
              roomName: room.name,
              formatFeature: room.formatFeature || room.roomType,
              startTime,
              endTime,
              cleaningMinutes: 20,
              cleaningEndTime,
              lifecycleStatus,
              price: basePrice,
              isLocked: false,
              cancelledAt: null,
              cancelReason: '',
              batchId: `DEMO_HIST_2026_${String(month).padStart(2, '0')}`,
              creationSource: 'BULK',
              createdAt: new Date(startTime.getTime() - 7 * 86400000),
              updatedAt: startTime,
            };

            newShowtimes.push(stDoc);
            dayShowtimes.push({ ...stDoc, _roomType: room.roomType, _movieTitle: mv.title });
          });
        });
      } else {
        // Gắn _roomType cho các suất chiếu đã có sẵn (25/11, 26/11)
        const roomMap = new Map(rooms.map((r) => [String(r._id), r]));
        dayShowtimes.forEach((st) => {
          const r = roomMap.get(String(st.roomId));
          st._roomType = r?.roomType || 'IMAX Laser';
        });
      }

      // Khởi tạo bản đồ ghế trống cho từng suất chiếu trong ngày để tuyệt đối không trùng ghế hoặc vượt 88 ghế
      const showtimeAvailableSeatsMap = new Map();
      const showtimeBookedSeatSetMap = new Map();

      dayShowtimes.forEach((st) => {
        // Ưu tiên ghế trung tâm hàng C, D, E, F, G trước
        const orderedPool = [...seatTemplates88].sort((a, b) => {
          const rowPriority = { E: 1, F: 2, D: 3, G: 4, C: 5, B: 6, H: 7, A: 8 };
          return (rowPriority[a.row] || 9) - (rowPriority[b.row] || 9) || Math.abs(a.col - 6.5) - Math.abs(b.col - 6.5);
        });
        showtimeAvailableSeatsMap.set(String(st._id), orderedPool);
        showtimeBookedSeatSetMap.set(String(st._id), new Map());
      });

      // Nếu targetRevenue > 0, tạo các đơn đặt vé PAID (paymentStatus: SIMULATED) cho ngày này
      let accumulatedRevenue = 0;
      let orderSeq = 0;

      // Sắp xếp các suất chiếu ưu tiên khung giờ vàng (17h - 22h) có nhiều đơn đặt vé hơn
      const weightedShowtimes = [];
      dayShowtimes.forEach((st) => {
        const vnHour = (new Date(st.startTime).getUTCHours() + 7) % 24;
        const weight = vnHour >= 17 && vnHour <= 22 ? 3 : vnHour >= 12 ? 2 : 1;
        for (let w = 0; w < weight; w++) weightedShowtimes.push(st);
      });

      while (accumulatedRevenue < targetRevenue && weightedShowtimes.length > 0 && orderSeq < 120) {
        const st = weightedShowtimes[Math.floor(rand() * weightedShowtimes.length)];
        const stIdStr = String(st._id);
        const availPool = showtimeAvailableSeatsMap.get(stIdStr) || [];
        if (availPool.length < 4) break;

        orderSeq += 1;
        const roomType = st._roomType || 'IMAX Laser';
        const priceTable = ROOM_SEAT_PRICES[roomType] || ROOM_SEAT_PRICES['IMAX Laser'];

        // Số ghế mỗi đơn: 1 đến 4 ghế
        const ticketCount = Math.min(availPool.length, 1 + Math.floor(rand() * 4));
        const chosenSeats = availPool.splice(0, ticketCount);

        const ticketSnapshots = chosenSeats.map((s) => ({
          seatNumber: s.seatNumber,
          price: priceTable[s.type] || priceTable.STANDARD,
        }));
        const ticketSubtotal = ticketSnapshots.reduce((sum, t) => sum + t.price, 0);

        // ~62% đơn hàng có mua kèm bắp nước / combo
        const comboSnapshots = [];
        let concessionTextParts = [];
        let comboSubtotal = 0;

        if (concessions.length > 0 && rand() < 0.62) {
          const comboItem = concessions[Math.floor(rand() * concessions.length)];
          const qty = ticketCount >= 3 && rand() < 0.5 ? 2 : 1;
          const unitPrice = Number(comboItem.price || 75000);
          comboSnapshots.push({
            concessionId: comboItem._id,
            name: comboItem.name,
            flavor: 'Tiêu chuẩn',
            quantity: qty,
            price: unitPrice,
          });
          concessionTextParts.push(`${qty}x ${comboItem.name}`);
          comboSubtotal += unitPrice * qty;
        }

        // ~15% đơn có áp dụng voucher giảm giá 20.000đ
        const discount = ticketSubtotal + comboSubtotal >= 250000 && rand() < 0.15 ? 20000 : 0;
        const totalAmount = Math.max(priceTable.STANDARD, ticketSubtotal + comboSubtotal - discount);

        const customer = CUSTOMER_POOL[(day + orderSeq) % CUSTOMER_POOL.length];
        const userDoc = users.length > 0 ? users[(day + orderSeq) % users.length] : null;
        const paymentMethod = PAYMENT_METHODS[(day + orderSeq) % PAYMENT_METHODS.length];

        // Thời điểm phát sinh giao dịch nằm đúng trong ngày (year, month, day) theo múi giờ Asia/Ho_Chi_Minh
        const txHour = Math.min(22, Math.max(8, 9 + (orderSeq % 13)));
        const txMinute = (orderSeq * 7 + day * 3) % 60;
        const txSecond = (orderSeq * 13) % 60;
        const txDate = makeVnDate(year, month, day, txHour, txMinute, txSecond);

        const bookingId = new mongoose.Types.ObjectId();
        const bookingCode = `MTX-DEMO-${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-${String(orderSeq).padStart(3, '0')}`;

        const bookingDoc = {
          _id: bookingId,
          bookingCode,
          userId: userDoc?._id || null,
          movieId: st.movieId,
          roomId: st.roomId,
          showtimeId: st._id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          seats: chosenSeats.map((s) => s.seatNumber).join(', '),
          concessions: concessionTextParts.join(', '),
          totalAmount,
          status: 'PAID',
          paymentStatus: 'SIMULATED',
          priceSnapshot: {
            tickets: ticketSnapshots,
            combos: comboSnapshots,
            voucherCode: discount > 0 ? 'TEST20' : '',
            discount,
          },
          paymentMethod,
          qrToken: `QR-DEMO-${bookingCode}`,
          isCheckedIn: month === 10 || day < 26,
          checkedInAt: month === 10 || day < 26 ? txDate : null,
          refundStatus: 'NONE',
          refundAmount: 0,
          exchangeHistory: [],
          createdAt: txDate,
          updatedAt: txDate,
        };

        newBookings.push(bookingDoc);
        accumulatedRevenue += totalAmount;

        // Đánh dấu ghế đã BOOKED cho suất chiếu này
        const bookedMap = showtimeBookedSeatSetMap.get(stIdStr);
        chosenSeats.forEach((s) => {
          bookedMap.set(s.seatNumber, bookingId);
        });
      }

      // Tạo 88 bản ghi ShowtimeSeat cho các suất chiếu mới tạo trong ngày ( hoặc cập nhật ghế BOOKED cho suất đã có sẵn)
      dayShowtimes.forEach((st) => {
        const stIdStr = String(st._id);
        const bookedMap = showtimeBookedSeatSetMap.get(stIdStr) || new Map();
        const isNewShowtime = String(st.batchId || '').startsWith('DEMO_HIST_2026_');

        if (isNewShowtime) {
          for (const tpl of seatTemplates88) {
            const bkId = bookedMap.get(tpl.seatNumber) || null;
            newShowtimeSeats.push({
              showtimeId: st._id,
              roomId: st.roomId,
              seatNumber: tpl.seatNumber,
              row: tpl.row,
              col: tpl.col,
              type: tpl.type,
              status: bkId ? 'BOOKED' : 'AVAILABLE',
              holdId: null,
              holdOwnerId: null,
              holdExpiresAt: null,
              bookingId: bkId,
              version: bkId ? 1 : 0,
            });
          }
        }
      });

      return { showtimesCreated: dayShowtimes.length, ordersCreated: orderSeq, revenue: accumulatedRevenue, showtimeBookedSeatSetMap, existingDayShowtimes };
    };

    // 4. Sinh dữ liệu cho 31 ngày Tháng 10/2026 (01/10 -> 31/10/2026)
    let octTotalRev = 0;
    let octTotalOrders = 0;
    for (let day = 1; day <= 31; day++) {
      const targetRev = OCT_DAILY_TARGET_REVENUE[day - 1] || 0;
      const res = generateDayActivity({
        year: 2026,
        month: 10,
        day,
        targetRevenue: targetRev,
        moviesPool: octMoviesPool,
      });
      octTotalRev += res.revenue;
      octTotalOrders += res.ordersCreated;
    }
    console.log(`✔ Tháng 10/2026: Đã tạo ${octTotalOrders} đơn SIMULATED, Tổng doanh thu = ${octTotalRev.toLocaleString('vi-VN')} đ`);

    // 5. Sinh dữ liệu cho 26 ngày Tháng 11/2026 (01/11 -> 26/11/2026)
    // Với ngày 25/11 và 26/11 đã có sẵn 45 suất chiếu gốc/ngày từ LIVE DB, tái sử dụng trực tiếp các suất chiếu đó!
    let novTotalRev = 0;
    let novTotalOrders = 0;
    const existingSeatUpdates = [];

    for (let day = 1; day <= 26; day++) {
      const dayStart = makeVnDate(2026, 11, day, 0, 0, 0);
      const dayEnd = makeVnDate(2026, 11, day, 23, 59, 59);
      const existingForDay = liveShowtimes.filter((st) => {
        const t = new Date(st.startTime);
        return !st.cancelledAt && st.lifecycleStatus !== 'CANCELLED' && t >= dayStart && t <= dayEnd;
      });

      const targetRev = NOV_DAILY_TARGET_REVENUE[day - 1] || 0;
      const res = generateDayActivity({
        year: 2026,
        month: 11,
        day,
        targetRevenue: targetRev,
        moviesPool: novMoviesPool,
        existingDayShowtimes: existingForDay,
      });
      novTotalRev += res.revenue;
      novTotalOrders += res.ordersCreated;

      if (existingForDay.length > 0) {
        for (const st of existingForDay) {
          const bookedMap = res.showtimeBookedSeatSetMap.get(String(st._id));
          if (bookedMap && bookedMap.size > 0) {
            for (const [seatNumber, bookingId] of bookedMap.entries()) {
              existingSeatUpdates.push({
                updateOne: {
                  filter: { showtimeId: st._id, seatNumber },
                  update: { $set: { status: 'BOOKED', bookingId, version: 1 } },
                },
              });
            }
          }
        }
      }
    }
    console.log(`✔ Tháng 11/2026 (01/11 -> 26/11): Đã tạo ${novTotalOrders} đơn SIMULATED, Tổng doanh thu = ${novTotalRev.toLocaleString('vi-VN')} đ`);

    // 6. Ghi hàng loạt vào movietix_demo_db theo chunk để đảm bảo tốc độ cao
    if (newShowtimes.length > 0) {
      await demoConn.db.collection('showtimes').insertMany(newShowtimes, { ordered: false });
      console.log(`✔ Đã lưu ${newShowtimes.length} suất chiếu lịch sử vào movietix_demo_db`);
    }

    if (newShowtimeSeats.length > 0) {
      for (let i = 0; i < newShowtimeSeats.length; i += 5000) {
        await demoConn.db
          .collection('showtimeseats')
          .insertMany(newShowtimeSeats.slice(i, i + 5000), { ordered: false });
      }
      console.log(`✔ Đã lưu ${newShowtimeSeats.length.toLocaleString('vi-VN')} bản ghi ghế (88 ghế/suất) vào movietix_demo_db`);
    }

    if (existingSeatUpdates.length > 0) {
      await demoConn.db.collection('showtimeseats').bulkWrite(existingSeatUpdates, { ordered: false });
      console.log(`✔ Đã đồng bộ ${existingSeatUpdates.length} ghế BOOKED trên các suất chiếu ngày 25-26/11`);
    }

    // Thêm vài ghế đang HOLDING tạm thời (chưa hết hạn) trên một suất sắp chiếu tối 26/11 để biểu đồ Công suất hiển thị cả trạng thái ghế đang giữ
    const upcomingNov26Showtime = liveShowtimes.find((st) => {
      const t = new Date(st.startTime);
      return !st.cancelledAt && t >= makeVnDate(2026, 11, 26, 18, 0, 0) && t <= makeVnDate(2026, 11, 26, 23, 0, 0);
    });
    if (upcomingNov26Showtime) {
      const holdSeats = await demoConn.db
        .collection('showtimeseats')
        .find({ showtimeId: upcomingNov26Showtime._id, status: 'AVAILABLE' })
        .limit(12)
        .toArray();
      if (holdSeats.length > 0) {
        await demoConn.db.collection('showtimeseats').updateMany(
          { _id: { $in: holdSeats.map((s) => s._id) } },
          {
            $set: {
              status: 'HOLDING',
              holdId: 'DEMO-ACTIVE-HOLD-20261126',
              holdExpiresAt: makeVnDate(2026, 11, 26, 23, 59, 0),
            },
          }
        );
        console.log(`✔ Đã tạo ${holdSeats.length} ghế HOLDING tạm thời trên suất tối 26/11 để kiểm chứng tách biệt ghế giữ tạm`);
      }
    }

    if (newBookings.length > 0) {
      await demoConn.db.collection('bookings').insertMany(newBookings, { ordered: false });
      console.log(`✔ Đã lưu ${newBookings.length} đơn đặt vé SIMULATED vào movietix_demo_db`);
    }

    // Sao chép 4 đơn CANCELLED lịch sử từ LIVE sang DEMO để giữ nguyên lịch sử đơn hủy
    const liveCancelled = await liveConn.db.collection('bookings').find({ status: 'CANCELLED' }).toArray();
    if (liveCancelled.length > 0) {
      const cancelOps = liveCancelled.map((doc) => ({
        replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
      }));
      await demoConn.db.collection('bookings').bulkWrite(cancelOps, { ordered: false });
    }

    // 7. Khởi tạo các khoản chi phí thực tế (Expense) hợp lý cho Tháng 10 và Tháng 11/2026 trên movietix_demo_db
    await demoConn.db.collection('expenses').deleteMany({ costCode: /^CP-DEMO-/ });
    const demoExpenses = [
      // Tháng 10/2026
      {
        costCode: 'CP-DEMO-202610-001',
        title: 'Chi phí bản quyền phim Dune: Hành Tinh Cát – Phần 2 (T10)',
        type: 'MOVIE_LICENSE',
        amount: 28000000,
        movieId: duneMovie?._id || null,
        roomId: null,
        cinemaId: cinema?._id || null,
        date: makeVnDate(2026, 10, 5, 10, 0),
        month: 10,
        year: 2026,
        notes: 'Thanh toán đợt 1 hợp đồng phát hành phim IMAX & 2D',
        createdAt: makeVnDate(2026, 10, 5, 10, 0),
        updatedAt: makeVnDate(2026, 10, 5, 10, 0),
      },
      {
        costCode: 'CP-DEMO-202610-002',
        title: 'Chi phí bản quyền phim Oppenheimer & Quật Mộ Trùng Ma (T10)',
        type: 'MOVIE_LICENSE',
        amount: 24000000,
        movieId: oppenheimerMovie?._id || null,
        roomId: null,
        cinemaId: cinema?._id || null,
        date: makeVnDate(2026, 10, 10, 14, 0),
        month: 10,
        year: 2026,
        notes: 'Phí bản quyền nhà phát hành CJ & Universal',
        createdAt: makeVnDate(2026, 10, 10, 14, 0),
        updatedAt: makeVnDate(2026, 10, 10, 14, 0),
      },
      {
        costCode: 'CP-DEMO-202610-003',
        title: 'Chi phí điện nước, điều hòa trung tâm & vận hành 9 phòng chiếu (T10)',
        type: 'ELECTRICITY_WATER',
        amount: 32000000,
        movieId: null,
        roomId: null,
        cinemaId: cinema?._id || null,
        date: makeVnDate(2026, 10, 25, 15, 0),
        month: 10,
        year: 2026,
        notes: 'Hóa đơn điện nước cụm rạp Thanh Khê Plaza tháng 10/2026',
        createdAt: makeVnDate(2026, 10, 25, 15, 0),
        updatedAt: makeVnDate(2026, 10, 25, 15, 0),
      },
      {
        costCode: 'CP-DEMO-202610-004',
        title: 'Chi phí nhân sự, vệ sinh & nguyên liệu bắp nước (T10)',
        type: 'STAFF',
        amount: 26000000,
        movieId: null,
        roomId: null,
        cinemaId: cinema?._id || null,
        date: makeVnDate(2026, 10, 28, 16, 0),
        month: 10,
        year: 2026,
        notes: 'Bảng lương ca chiếu & nhập nguyên liệu quầy Concession T10',
        createdAt: makeVnDate(2026, 10, 28, 16, 0),
        updatedAt: makeVnDate(2026, 10, 28, 16, 0),
      },
      // Tháng 11/2026
      {
        costCode: 'CP-DEMO-202611-001',
        title: 'Chi phí bản quyền phim Dune: Hành Tinh Cát – Phần 2 (T11)',
        type: 'MOVIE_LICENSE',
        amount: 25000000,
        movieId: duneMovie?._id || null,
        roomId: null,
        cinemaId: cinema?._id || null,
        date: makeVnDate(2026, 11, 3, 9, 30),
        month: 11,
        year: 2026,
        notes: 'Phí bản quyền phát hành tháng 11/2026',
        createdAt: makeVnDate(2026, 11, 3, 9, 30),
        updatedAt: makeVnDate(2026, 11, 3, 9, 30),
      },
      {
        costCode: 'CP-DEMO-202611-002',
        title: 'Chi phí bản quyền & chia sẻ doanh thu phim Mai (T11)',
        type: 'MOVIE_LICENSE',
        amount: 21000000,
        movieId: maiMovie?._id || null,
        roomId: null,
        cinemaId: cinema?._id || null,
        date: makeVnDate(2026, 11, 5, 11, 0),
        month: 11,
        year: 2026,
        notes: 'Phí bản quyền phát hành phim Việt Nam tháng 11/2026',
        createdAt: makeVnDate(2026, 11, 5, 11, 0),
        updatedAt: makeVnDate(2026, 11, 5, 11, 0),
      },
      {
        costCode: 'CP-DEMO-202611-003',
        title: 'Chi phí bản quyền & Marketing phim Deadpool & Wolverine (T11)',
        type: 'MOVIE_LICENSE',
        amount: 22000000,
        movieId: deadpoolMovie?._id || null,
        roomId: null,
        cinemaId: cinema?._id || null,
        date: makeVnDate(2026, 11, 8, 10, 0),
        month: 11,
        year: 2026,
        notes: 'Hợp đồng bản quyền Marvel Studios tháng 11/2026',
        createdAt: makeVnDate(2026, 11, 8, 10, 0),
        updatedAt: makeVnDate(2026, 11, 8, 10, 0),
      },
      {
        costCode: 'CP-DEMO-202611-004',
        title: 'Chi phí điện nước, bảo trì máy chiếu IMAX Laser & Dolby Atmos (T11)',
        type: 'ELECTRICITY_WATER',
        amount: 28000000,
        movieId: null,
        roomId: null,
        cinemaId: cinema?._id || null,
        date: makeVnDate(2026, 11, 20, 14, 0),
        month: 11,
        year: 2026,
        notes: 'Vận hành kỹ thuật cụm rạp 9 phòng chiếu tháng 11/2026',
        createdAt: makeVnDate(2026, 11, 20, 14, 0),
        updatedAt: makeVnDate(2026, 11, 20, 14, 0),
      },
      {
        costCode: 'CP-DEMO-202611-005',
        title: 'Chi phí lương nhân sự & nguyên liệu quầy Bắp nước (T11)',
        type: 'STAFF',
        amount: 24000000,
        movieId: null,
        roomId: null,
        cinemaId: cinema?._id || null,
        date: makeVnDate(2026, 11, 24, 16, 0),
        month: 11,
        year: 2026,
        notes: 'Chi phí nhân sự vận hành & COGS bắp nước tháng 11/2026',
        createdAt: makeVnDate(2026, 11, 24, 16, 0),
        updatedAt: makeVnDate(2026, 11, 24, 16, 0),
      },
    ];
    await demoConn.db.collection('expenses').insertMany(demoExpenses);
    console.log(`✔ Đã khởi tạo ${demoExpenses.length} chứng từ chi phí DEMO cho Tháng 10 & 11/2026`);

    // Kiểm tra đảm bảo LIVE DB hoàn toàn không bị thay đổi
    const liveBookingsAfter = await liveConn.db.collection('bookings').countDocuments();
    const demoBookingsAfter = await demoConn.db.collection('bookings').countDocuments();
    console.log('================================================================');
    console.log(`✅ HOÀN TẤT SEED DEMO DB (movietix_demo_db)!`);
    console.log(`   - Số lượng Booking trên LIVE DB (movietix_db):      ${liveBookingsAfter} (Giữ nguyên 100%)`);
    console.log(`   - Số lượng Booking trên DEMO DB (movietix_demo_db): ${demoBookingsAfter}`);
    console.log('================================================================');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu DEMO:', err);
  process.exit(1);
});
