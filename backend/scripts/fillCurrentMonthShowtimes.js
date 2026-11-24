import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import TicketPricingConfig from '../src/models/TicketPricingConfig.js';
import { calculatePricesFromConfig } from '../src/services/pricingConfigService.js';
import { generateStandard88Seats } from './migrateShowtimeData.js';

const timeZone = 'Asia/Ho_Chi_Minh';
const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const day = 86400000;
const turnaround = 15; // Chuẩn nghiệp vụ dọn dẹp vệ sinh rạp D'AVENOR là 15 phút
const dayStart = (key) => Date.parse(key + 'T00:00:00+07:00');
const formatKey = (movieId, type) => String(movieId) + '/' + type;
const types = new Set(['IMAX Laser', 'Dolby Atmos', 'Gold Class']);
const now = Date.now();
const today = calendar.format(now);
const month = today.slice(0, 7);
const start = dayStart(month + '-01');
const end = dayStart(calendar.format(start + 32 * day).slice(0, 7) + '-01');

/**
 * Làm tròn mốc thời gian lên các mốc 15 phút (:00, :15, :30, :45)
 */
function roundToNext15Minutes(ms) {
  const date = new Date(ms);
  const minutes = date.getMinutes();
  const remainder = minutes % 15;
  if (remainder !== 0) {
    date.setMinutes(minutes + (15 - remainder), 0, 0);
  } else {
    date.setSeconds(0, 0);
  }
  return date.getTime();
}

function findOpenTime(occupied, desired, length) {
  let time = roundToNext15Minutes(desired);
  for (const slot of occupied) {
    if (time + length <= slot.start) break;
    if (time < slot.end) {
      time = roundToNext15Minutes(slot.end);
    }
  }
  return time;
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  const [movies, rooms, showtimes, prices] = await Promise.all([
    Movie.find({ status: { $ne: 'ENDED' } }).select('title duration releaseDate status').lean(),
    Room.find({ status: 'ACTIVE', roomType: { $in: [...types] } }).select('name roomType cinemaId formatFeature totalSeats status').lean(),
    Showtime.find({ startTime: { $gte: new Date(start - day), $lt: new Date(end + day) }, cancelledAt: null })
      .populate('movieId', 'duration').sort({ startTime: 1 }).lean(),
    TicketPricingConfig.findOne({ configKey: 'MAIN_PRICING_CONFIG' }).lean(),
  ]);

  // Toàn bộ 9 phòng vật lý ACTIVE đều đủ điều kiện tham gia xếp lịch
  const eligibleRooms = rooms;
  console.log(`Physical rooms active and eligible: ${eligibleRooms.length}/${rooms.length}`);

  const movieIds = new Set(movies.map(movie => String(movie._id)));
  const byId = new Map(rooms.map(room => [String(room._id), room]));
  const roomsByName = new Map(rooms.map(room => [String(room.cinemaId) + '/' + room.name, room]));
  const occupied = new Map(rooms.map(room => [String(room._id), []]));
  const rosters = new Map();

  const setSlot = (room, start, duration) => {
    const list = occupied.get(String(room._id));
    if (!list) return;
    list.push({ start, end: start + (duration + turnaround) * 60000 });
    list.sort((a, b) => a.start - b.start);
  };

  for (const slot of showtimes) {
    const room = slot.roomId
      ? byId.get(String(slot.roomId)) : roomsByName.get(String(slot.cinemaId) + '/' + slot.roomName);
    if (!room) continue;
    const ms = slot.startTime.getTime();
    setSlot(room, ms, Number(slot.movieId?.duration) || 120);
    const date = calendar.format(ms);
    if (!date.startsWith(month) || !movieIds.has(String(slot.movieId?._id))) continue;
    const key = formatKey(slot.movieId._id, room.roomType);
    if (!rosters.has(key)) rosters.set(key, new Map());
    const days = rosters.get(key);
    if (!days.has(date)) days.set(date, []);
    days.get(date).push({ offset: ms - dayStart(date), cinemaId: room.cinemaId, room });
  }

  // Khung giờ rạp mở cửa chuẩn: 09:00, 11:30, 14:00, 16:30, 19:00, 21:30
  const defaultOffsets = [
    9 * 3600000,
    11.5 * 3600000,
    14 * 3600000,
    16.5 * 3600000,
    19 * 3600000,
    21.5 * 3600000,
  ];

  const plans = [];
  const gaps = [];

  for (let dayMs = dayStart(today); dayMs < end; dayMs += day) {
    const date = calendar.format(dayMs);
    const requests = [];

    for (const movie of movies) {
      if (movie.releaseDate && date < calendar.format(movie.releaseDate)) continue;
      for (const type of types) {
        // Phân bổ đều cho các ngày
        for (const offset of defaultOffsets) {
          const desired = dayMs + offset;
          if (desired > now) {
            requests.push({ movie, type, desired, cinemaId: rooms[0]?.cinemaId });
          }
        }
      }
    }

    requests.sort((a, b) => a.desired - b.desired || String(a.movie._id).localeCompare(String(b.movie._id)));

    for (const request of requests) {
      const { movie, type, desired, cinemaId } = request;
      const duration = Number(movie.duration) || 120;
      const length = (duration + turnaround) * 60000;

      // Tìm phòng cùng loại có slot trống
      const candidateRooms = eligibleRooms.filter(r => r.roomType === type);
      const options = candidateRooms.map(room => ({
        room,
        time: findOpenTime(occupied.get(String(room._id)) || [], desired, length),
      })).sort((a, b) => a.time - b.time);

      const next = options[0];
      if (!next || next.time >= dayMs + day + 2 * 3600000) {
        gaps.push({ date, movie: movie.title, format: type, reason: 'Không còn phòng trống trước nửa đêm' });
        continue;
      }

      setSlot(next.room, next.time, duration);
      const startTime = new Date(next.time);
      const endTime = new Date(next.time + duration * 60000);

      const doc = {
        movieId: movie._id,
        roomId: next.room._id,
        cinemaId: next.room.cinemaId,
        roomName: next.room.name,
        formatFeature: next.room.formatFeature,
        startTime,
        endTime,
        cleaningMinutes: turnaround,
        isLocked: false,
      };

      doc.price = calculatePricesFromConfig({ ...doc, roomType: type }, prices, { preferRuleMatrix: true }).priceStandard;
      plans.push({ date, title: movie.title, format: type, roomName: next.room.name, doc });
    }
  }

  const grouped = Object.groupBy(plans, plan => plan.date);
  console.log(JSON.stringify({
    mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
    month,
    totalPlannedShowtimes: plans.length,
    skippedSlots: gaps.length,
  }, null, 2));

  if (!process.argv.includes('--apply')) {
    console.log('[DRY-RUN XONG] Thêm cờ --apply để áp dụng ghi vào Database kèm 88 ShowtimeSeat cho mỗi suất.');
    return;
  }

  console.log(`Đang ghi ${plans.length} suất chiếu kèm 88 ghế ShowtimeSeat vào MongoDB...`);
  let createdCount = 0;
  for (const plan of plans) {
    const showtime = await Showtime.create(plan.doc);
    const seats = generateStandard88Seats(plan.doc.roomId, showtime._id);
    await ShowtimeSeat.insertMany(seats);
    createdCount++;
  }
  console.log(`Hoàn tất ghi ${createdCount} suất chiếu kèm ghế đầy đủ.`);
}

try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
