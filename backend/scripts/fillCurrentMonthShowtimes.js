import 'dotenv/config';
import mongoose from 'mongoose';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';
import TicketPricingConfig from '../src/models/TicketPricingConfig.js';
import { calculatePricesFromConfig } from '../src/services/pricingConfigService.js';

const timeZone = 'Asia/Ho_Chi_Minh';
const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const day = 86400000;
const turnaround = 30;
const dayStart = (key) => Date.parse(key + 'T00:00:00+07:00');
const formatKey = (movieId, type) => String(movieId) + '/' + type;
const types = new Set(['IMAX Laser', 'Dolby Atmos', 'Gold Class']);
const now = Date.now();
const today = calendar.format(now);
const month = today.slice(0, 7);
const start = dayStart(month + '-01');
const end = dayStart(calendar.format(start + 32 * day).slice(0, 7) + '-01');

function findOpenTime(occupied, desired, length) {
  let time = desired;
  for (const slot of occupied) {
    if (time + length <= slot.start) break;
    if (time < slot.end) time = slot.end;
  }
  return time;
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  const [movies, rooms, showtimes, prices] = await Promise.all([
    Movie.find({ releaseDate: { $gte: new Date(start), $lt: new Date(end) } }).select('title duration releaseDate').lean(),
    Room.find({ status: 'ACTIVE', roomType: { $in: [...types] } }).select('name roomType cinemaId formatFeature totalSeats').lean(),
    Showtime.find({ startTime: { $gte: new Date(start - day), $lt: new Date(end + day) } })
      .populate('movieId', 'duration').sort({ startTime: 1 }).lean(),
    TicketPricingConfig.findOne({ configKey: 'MAIN_PRICING_CONFIG' }).lean(),
  ]);

  const layouts = await ShowtimeSeat.aggregate([
    { $match: { roomId: { $in: rooms.map(room => room._id) } } },
    { $group: { _id: { room: '$roomId', showtime: '$showtimeId' }, seats: { $sum: 1 } } },
    { $group: { _id: '$_id.room', sizes: { $addToSet: '$seats' } } },
  ]);
  const sizes = new Map(layouts.map(item => [String(item._id), item.sizes]));
  const eligibleRooms = rooms.filter(room => sizes.get(String(room._id))?.includes(room.totalSeats));
  console.log('Physical rooms with stored complete layouts: ' + eligibleRooms.length + '/' + rooms.length);
  const movieIds = new Set(movies.map(movie => String(movie._id)));
  const byId = new Map(rooms.map(room => [String(room._id), room]));
  const roomsByName = new Map(rooms.map(room => [String(room.cinemaId) + '/' + room.name, room]));
  const occupied = new Map(rooms.map(room => [String(room._id), []]));
  const rosters = new Map();
  const setSlot = (room, start, duration) => {
    const list = occupied.get(String(room._id));
    list.push({ start, end: start + (duration + turnaround) * 60000 });
    list.sort((a, b) => a.start - b.start);
  };

  for (const slot of showtimes) {
    const room = slot.roomId
      ? byId.get(String(slot.roomId)) : roomsByName.get(String(slot.cinemaId) + '/' + slot.roomName);
    if (!room) continue;
    const ms = slot.startTime.getTime();
    setSlot(room, ms, Number(slot.movieId?.duration) || 180);
    const date = calendar.format(ms);
    if (!date.startsWith(month) || !movieIds.has(String(slot.movieId?._id))) continue;
    const key = formatKey(slot.movieId._id, room.roomType);
    if (!rosters.has(key)) rosters.set(key, new Map());
    const days = rosters.get(key);
    if (!days.has(date)) days.set(date, []);
    days.get(date).push({ offset: ms - dayStart(date), cinemaId: room.cinemaId, room });
  }

  const plans = [];
  const gaps = [];
  const coverage = new Map();
  for (let dayMs = dayStart(today); dayMs < end; dayMs += day) {
    const date = calendar.format(dayMs);
    const requests = [];
    for (const movie of movies) {
      if (date < calendar.format(movie.releaseDate)) continue;
      for (const type of types) {
        const key = formatKey(movie._id, type);
        const days = rosters.get(key);
        if (dayMs > dayStart(today)) coverage.set(date + '/' + key, Boolean(days?.get(date)?.length));
        if (!days?.size) {
          gaps.push({ date, movie: movie.title, format: type, reason: 'No stored time template' });
          continue;
        }
        const template = [...days.values()].reduce((best, slots) => slots.length > best.length ? slots : best);
        const existing = days.get(date) ?? [];
        if (existing.length >= template.length) continue;
        const missing = [...template];
        for (const slot of existing) {
          const closest = missing.reduce((best, t, i) =>
            Math.abs(t.offset - slot.offset) < Math.abs(missing[best].offset - slot.offset) ? i : best, 0);
          missing.splice(closest, 1);
        }
        for (const slot of missing) {
          const desired = dayMs + slot.offset;
          if (desired > now) requests.push({ movie, type, desired, cinemaId: slot.cinemaId, room: slot.room });
        }
      }
    }

    requests.sort((a, b) => a.desired - b.desired || String(a.movie._id).localeCompare(String(b.movie._id)));
    for (const request of requests) {
      const { movie, type, desired, cinemaId } = request;
      const length = (Number(movie.duration) + turnaround) * 60000;
      const options = eligibleRooms.filter(room => room.roomType === type && String(room.cinemaId) === String(cinemaId))
        .map(room => ({ room, time: findOpenTime(occupied.get(String(room._id)), desired, length) }))
        .sort((a, b) => a.time - b.time || Number(String(b.room._id) === String(request.room._id)) - Number(String(a.room._id) === String(request.room._id)));
      const next = options[0];
      if (!(length > turnaround * 60000) || !next || next.time >= dayMs + day) {
        gaps.push({ date, movie: movie.title, format: type, reason: 'No available physical room before midnight' });
        continue;
      }
      setSlot(next.room, next.time, Number(movie.duration));
      const doc = {
        movieId: movie._id, roomId: next.room._id, cinemaId: next.room.cinemaId, roomName: next.room.name,
        formatFeature: next.room.formatFeature, startTime: new Date(next.time), isLocked: false,
      };
      doc.price = calculatePricesFromConfig({ ...doc, roomType: type }, prices, { preferRuleMatrix: true }).priceStandard;
      plans.push({ date, title: movie.title, format: type, doc });
      coverage.set(date + '/' + formatKey(movie._id, type), true);
    }
  }

  const missingCoverage = [...coverage].filter(([, covered]) => !covered).map(([key]) => key);
  const grouped = Object.groupBy(plans, plan => plan.date);
  console.log(JSON.stringify({
    mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
    month, days: Object.fromEntries(Object.entries(grouped).map(([date, entries]) => [date,
      Object.fromEntries(Object.entries(Object.groupBy(entries, entry => entry.title)).map(([title, list]) => [title, list.length])),
    ])),
    skippedSlots: gaps.length, missingCoverage,
  }, null, 2));
  if (!process.argv.includes('--apply')) return;
  if (missingCoverage.length) throw new Error('At least one day has no slot for a film and format; no showtimes written.');
  if (!plans.length) return;
  const result = await Showtime.bulkWrite(plans.map(({ doc }) => ({
    updateOne: {
      filter: { roomId: doc.roomId, startTime: doc.startTime },
      update: { $setOnInsert: doc },
      upsert: true,
    },
  })));
  console.log('Inserted showtimes: ' + result.upsertedCount);
}

try {
  await run();
} catch (error) {
  console.error(error.name + ': ' + (error.code ?? error.message));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

