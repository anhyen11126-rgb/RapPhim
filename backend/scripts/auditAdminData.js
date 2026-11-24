import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');

await mongoose.connect(uri, { autoIndex: false, autoCreate: false, timeoutMS: 30000 });
try {
  const db = mongoose.connection.db;
  const roomCollection = db.collection('rooms');
  const showtimes = db.collection('showtimes');
  const seatCollection = db.collection('showtimeseats');
  const bookings = db.collection('bookings');
  const [rooms, slots, noSeatResult, roomLinkIssues, seatLinkIssues, duplicateSeats, brokenSeatOwners, bookingSummary, topology] = await Promise.all([
    roomCollection.find({}, { projection: { roomNumber: 1, totalSeats: 1, roomType: 1, name: 1, shortName: 1, cinemaId: 1 } }).sort({ roomNumber: 1 }).toArray(),
    showtimes.find({}, { projection: { roomId: 1, roomName: 1, cinemaId: 1 } }).toArray(),
    showtimes.aggregate([
      { $lookup: { from: 'showtimeseats', localField: '_id', foreignField: 'showtimeId', pipeline: [{ $limit: 1 }], as: 'seat' } },
      { $match: { seat: { $size: 0 } } }, { $count: 'count' },
    ]).toArray(),
    showtimes.aggregate([
      { $match: { roomId: { $ne: null } } },
      { $lookup: { from: 'rooms', localField: 'roomId', foreignField: '_id', as: 'room' } },
      { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
      { $match: { $expr: { $ne: ['$cinemaId', '$room.cinemaId'] } } }, { $count: 'count' },
    ]).toArray(),
    seatCollection.aggregate([
      { $match: { roomId: null } },
      { $lookup: { from: 'showtimes', localField: 'showtimeId', foreignField: '_id', as: 'slot' } },
      { $unwind: { path: '$slot', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$slot.roomId', null] }, count: { $sum: 1 } } },
    ]).toArray(),
    seatCollection.aggregate([
      { $group: { _id: { showtimeId: '$showtimeId', seatNumber: '$seatNumber' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $count: 'count' },
    ]).toArray(),
    seatCollection.aggregate([
      { $match: { status: 'BOOKED' } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'order' } },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      { $group: { _id: null,
        withoutBooking: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$order._id', null] }, null] }, 1, 0] } },
        withInactiveBooking: { $sum: { $cond: [{ $and: [
          { $ne: [{ $ifNull: ['$order._id', null] }, null] }, { $ne: ['$order.status', 'PAID'] },
        ] }, 1, 0] } },
        wrongShowtime: { $sum: { $cond: [{ $and: [
          { $ne: [{ $ifNull: ['$order._id', null] }, null] }, { $ne: ['$showtimeId', '$order.showtimeId'] },
        ] }, 1, 0] } },
      } },
    ]).toArray(),
    bookings.aggregate([
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', pipeline: [{ $project: { _id: 1 } }], as: 'user' } },
      { $lookup: { from: 'showtimes', localField: 'showtimeId', foreignField: '_id', pipeline: [{ $project: { _id: 1 } }], as: 'slot' } },
      { $group: {
        _id: { $ifNull: ['$paymentStatus', 'LEGACY_UNVERIFIED'] }, count: { $sum: 1 },
        linkedUsers: { $sum: { $size: '$user' } },
        missingShowtime: { $sum: { $cond: [{ $eq: [{ $size: '$slot' }, 0] }, 1, 0] } },
      } },
    ]).toArray(),
    db.admin().command({ hello: 1 }),
  ]);

  const normalize = value => String(value ?? '').trim().toLowerCase().normalize('NFC');
  const unresolved = slots.filter(slot => !slot.roomId);
  const exactCandidates = unresolved.filter(slot => slot.roomName && rooms.filter(room =>
    String(room.cinemaId) === String(slot.cinemaId) &&
    [room.name, room.shortName].map(normalize).includes(normalize(slot.roomName))
  ).length === 1);

  console.log(JSON.stringify({
    mode: 'read-only', supportsTransactions: Boolean(topology.setName || topology.msg === 'isdbgrid'),
    rooms: rooms.map(({ roomNumber, roomType, totalSeats, _id }) => ({
      roomNumber, roomType, totalSeats, showtimes: slots.filter(slot => String(slot.roomId) === String(_id)).length,
    })),
    showtimes: slots.length,
    showtimesWithoutRoom: unresolved.length,
    showtimesWithUniqueExactRoomCandidate: exactCandidates.length,
    showtimesWithInconsistentRoomLink: roomLinkIssues[0]?.count ?? 0,
    showtimesWithoutSeats: noSeatResult[0]?.count ?? 0,
    seatsWithoutRoom: seatLinkIssues.reduce((sum, row) => sum + row.count, 0),
    seatsWithRoomCandidateFromShowtime: seatLinkIssues.filter(row => row._id).reduce((sum, row) => sum + row.count, 0),
    duplicateSeatCodesWithinShowtime: duplicateSeats[0]?.count ?? 0,
    bookedSeatDiagnostics: brokenSeatOwners[0] ?? {},
    bookings: bookingSummary,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
