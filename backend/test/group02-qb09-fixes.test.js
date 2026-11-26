import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import movieRoutes from '../src/routes/movieRoutes.js';
import cinemaRoutes from '../src/routes/cinemaRoutes.js';
import Cinema from '../src/models/Cinema.js';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';

let server;
let mongo;
let url;
let cinema;
let room;
let movie;

const modulePath = process.env.DAVENOR_TEST_MONGO_MODULE || 'mongodb-memory-server';

async function create88Seats(showtimeId, status, holdExpiresAt = null) {
  const seats = [];
  for (const r of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
    for (let c = 1; c <= 11; c++) {
      seats.push({
        showtimeId,
        roomId: room._id,
        seatNumber: `${r}${c}`,
        row: r,
        col: c,
        type: ['E', 'F', 'G', 'H'].includes(r) ? 'VIP' : 'STANDARD',
        status,
        holdExpiresAt,
      });
    }
  }
  await ShowtimeSeat.insertMany(seats);
}

before(async () => {
  const { MongoMemoryReplSet } = createRequire(import.meta.url)(modulePath);
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('davenor_group02'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  cinema = await Cinema.create({
    _id: new mongoose.Types.ObjectId('6aecb03919dd0ede75638b6e'),
    name: "D'AVENOR Thanh Khê Plaza",
    slug: 'thanhkhe-plaza-primary',
    city: 'Đà Nẵng',
    district: 'Thanh Khê',
    address: '295 Điện Biên Phủ, Thanh Khê, Đà Nẵng',
    isFlagship: true,
  });
  // Insert duplicate orphan cinema to verify QB-02 deduplication
  await Cinema.create({
    name: "D'AVENOR Thanh Khê Plaza",
    slug: 'thanhkhe-plaza-duplicate',
    city: 'Đà Nẵng',
    district: '',
    address: '295 Điện Biên Phủ, Đà Nẵng',
    isFlagship: false,
  });

  room = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 01 - IMAX Laser',
    shortName: 'P01',
    roomType: 'IMAX Laser',
    totalSeats: 88,
  });

  movie = await Movie.create({
    title: 'QB-09 Sold Out Test Movie',
    slug: 'qb09-sold-out-movie',
    posterUrl: '/banner-dune.jpg',
    genre: 'Sci-Fi',
    duration: 120,
    status: 'NOW_SHOWING',
    releaseDate: new Date(Date.now() - 86400000),
  });

  const app = express();
  app.use(express.json());
  app.use('/api/movies', movieRoutes);
  app.use('/api/cinemas', cinemaRoutes);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('QB-02: GET /api/cinemas deduplicates duplicate cinema records and returns canonical flagship cinema', async () => {
  const res = await fetch(`${url}/api/cinemas`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.length, 1, 'Must return only 1 deduplicated cinema');
  assert.equal(data[0].id, '6aecb03919dd0ede75638b6e');
  assert.equal(data[0].isFlagship, true);
});

test('QB-09: getMovieSchedule accurately reports AVAILABLE, 88 BOOKED, 88 active HOLDING, and 88 expired HOLDING', async () => {
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const dateStr = tomorrow.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const base = new Date(`${dateStr}T10:00:00+07:00`);

  const [stAvail, stBooked, stHoldingActive, stHoldingExpired] = await Showtime.create([
    { movieId: movie._id, cinemaId: cinema._id, roomId: room._id, roomName: room.name, startTime: new Date(base.getTime()), endTime: new Date(base.getTime() + 120 * 60000), price: 120000 },
    { movieId: movie._id, cinemaId: cinema._id, roomId: room._id, roomName: room.name, startTime: new Date(base.getTime() + 3 * 3600000), endTime: new Date(base.getTime() + 5 * 3600000), price: 120000 },
    { movieId: movie._id, cinemaId: cinema._id, roomId: room._id, roomName: room.name, startTime: new Date(base.getTime() + 6 * 3600000), endTime: new Date(base.getTime() + 8 * 3600000), price: 120000 },
    { movieId: movie._id, cinemaId: cinema._id, roomId: room._id, roomName: room.name, startTime: new Date(base.getTime() + 9 * 3600000), endTime: new Date(base.getTime() + 11 * 3600000), price: 120000 },
  ]);

  await create88Seats(stAvail._id, 'AVAILABLE');
  await create88Seats(stBooked._id, 'BOOKED');
  await create88Seats(stHoldingActive._id, 'HOLDING', new Date(Date.now() + 600000));
  await create88Seats(stHoldingExpired._id, 'HOLDING', new Date(Date.now() - 5000));

  const res = await fetch(`${url}/api/movies/${movie._id}/schedule?date=${dateStr}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const byId = new Map(body.showtimes.map((s) => [s.id, s]));

  const rAvail = byId.get(String(stAvail._id));
  assert.equal(rAvail.availableSeats, 88);
  assert.equal(rAvail.isSoldOut, false);

  const rBooked = byId.get(String(stBooked._id));
  assert.equal(rBooked.availableSeats, 0);
  assert.equal(rBooked.bookedSeats, 88);
  assert.equal(rBooked.isSoldOut, true);

  const rHoldAct = byId.get(String(stHoldingActive._id));
  assert.equal(rHoldAct.availableSeats, 0);
  assert.equal(rHoldAct.holdingSeats, 88);
  assert.equal(rHoldAct.isSoldOut, true);

  const rHoldExp = byId.get(String(stHoldingExpired._id));
  assert.equal(rHoldExp.availableSeats, 88);
  assert.equal(rHoldExp.holdingSeats, 0);
  assert.equal(rHoldExp.isSoldOut, false);
});
