import fs from 'fs';

// ── 1. Patch adminController.js ──────────────────────────────────────────────
const acPath = 'd:/CDIO/movietix-project/backend/src/controllers/adminController.js';
let ac = fs.readFileSync(acPath, 'utf8');

// Patch scheduleInRoom signature & Showtime.create
const oldSchedule = `async function scheduleInRoom({ room, movie, start, price, pricing, session }) {`;
const newSchedule = `async function scheduleInRoom({ room, movie, start, price, pricing, session, formatFeature: fmtOverride, batchId, creationSource, createdBy }) {`;
if (ac.includes(oldSchedule)) {
  ac = ac.replace(oldSchedule, newSchedule);
  console.log('✅ Patched scheduleInRoom signature');
} else {
  console.log('ℹ️ scheduleInRoom signature already modified or pattern not found');
}

const oldCreateSt = `  const [showtime] = await Showtime.create([{
    movieId: movie._id, cinemaId: room.cinemaId, roomId: room._id, roomName: room.name,
    formatFeature: room.formatFeature, startTime: start, endTime, cleaningMinutes,
    price: price ?? calculated.priceStandard,
  }], { session });`;

const newCreateSt = `  const [showtime] = await Showtime.create([{
    movieId: movie._id, cinemaId: room.cinemaId, roomId: room._id, roomName: room.name,
    formatFeature: fmtOverride ?? room.formatFeature, startTime: start, endTime, cleaningMinutes,
    price: price ?? calculated.priceStandard,
    batchId: batchId || null,
    creationSource: creationSource || 'MANUAL',
    createdBy: createdBy || null,
  }], { session });`;

if (ac.includes(oldCreateSt)) {
  ac = ac.replace(oldCreateSt, newCreateSt);
  console.log('✅ Patched Showtime.create in scheduleInRoom');
} else {
  console.log('ℹ️ Showtime.create in scheduleInRoom already modified or pattern not found');
}

// Patch commitRecurringShowtimes to generate batchId
const oldCommitStart = `export const commitRecurringShowtimes = async (req, res) => {
  try {
    const { confirmedSlots, requestId } = req.body;`;

const newCommitStart = `export const commitRecurringShowtimes = async (req, res) => {
  try {
    const { confirmedSlots, requestId } = req.body;
    const batchId = 'BATCH-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();`;

if (ac.includes(oldCommitStart)) {
  ac = ac.replace(oldCommitStart, newCommitStart);
  console.log('✅ Patched commitRecurringShowtimes batchId init');
}

// Pass batchId to scheduleInRoom in commitRecurringShowtimes
const oldCallInCommit = `          return scheduleInRoom({
            room, movie, start,
            price: price == null ? undefined : Number(price),
            pricing, session,
            formatFeature: (typeof slotFormat === 'string' && slotFormat.trim()) ? slotFormat.trim() : undefined,
          });`;

const newCallInCommit = `          return scheduleInRoom({
            room, movie, start,
            price: price == null ? undefined : Number(price),
            pricing, session,
            formatFeature: (typeof slotFormat === 'string' && slotFormat.trim()) ? slotFormat.trim() : undefined,
            batchId,
            creationSource: 'RECURRING',
            createdBy: req.user?._id || null,
          });`;

if (ac.includes(oldCallInCommit)) {
  ac = ac.replace(oldCallInCommit, newCallInCommit);
  console.log('✅ Patched scheduleInRoom call in commitRecurringShowtimes');
}

// Return batchId in commitRecurringShowtimes response
const oldCommitReturn = `    return res.status(allOk ? 201 : 207).json({
      message: allOk
        ? \`Đã tạo thành công \${created.length} suất chiếu.\`
        : \`Tạo \${created.length}/\${confirmedSlots.length} suất chiếu. \${conflicts.length} xung đột, \${failed.length} lỗi.\`,
      created,
      conflicts,
      failed,
      skipped: [],
    });`;

const newCommitReturn = `    return res.status(allOk ? 201 : 207).json({
      message: allOk
        ? \`Đã tạo thành công \${created.length} suất chiếu.\`
        : \`Tạo \${created.length}/\${confirmedSlots.length} suất chiếu. \${conflicts.length} xung đột, \${failed.length} lỗi.\`,
      batchId,
      requestedCount: confirmedSlots.length,
      successCount: created.length,
      created,
      conflicts,
      failed,
      skipped: [],
    });`;

if (ac.includes(oldCommitReturn)) {
  ac = ac.replace(oldCommitReturn, newCommitReturn);
  console.log('✅ Patched commitRecurringShowtimes return payload');
}

// Patch batchScheduleShowtimes to generate batchId
const oldBatchTx = `    const totalCreatedShowtimes = await mongoose.connection.transaction(async session => {
      let count = 0;
      for (const [index, roomId] of uniqueRooms.entries()) {
        const room = await lockRoom(roomId, session);
        for (let date = +start; date <= +end; date += day) {
          const movie = movies[(index + (date - +start) / day) % movies.length];
          for (const time of uniqueTimes) {
            const startsAt = new Date(businessDate(new Date(date)) + 'T' + time + ':00+07:00');
            if (startsAt <= new Date()) continue;
            await scheduleInRoom({ room, movie, start: startsAt, pricing, session });
            count++;
          }
        }
      }
      return count;
    });
    return res.json({ success: true, totalCreatedShowtimes, message: 'Đã tạo ' + totalCreatedShowtimes + ' suất chiếu.' });`;

const newBatchTx = `    const batchId = 'BATCH-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    const createdSlotIds = [];
    const totalCreatedShowtimes = await mongoose.connection.transaction(async session => {
      let count = 0;
      for (const [index, roomId] of uniqueRooms.entries()) {
        const room = await lockRoom(roomId, session);
        for (let date = +start; date <= +end; date += day) {
          const movie = movies[(index + (date - +start) / day) % movies.length];
          for (const time of uniqueTimes) {
            const startsAt = new Date(businessDate(new Date(date)) + 'T' + time + ':00+07:00');
            if (startsAt <= new Date()) continue;
            const created = await scheduleInRoom({
              room, movie, start: startsAt, pricing, session,
              batchId, creationSource: 'BULK', createdBy: req.user?._id || null,
            });
            if (created?._id) createdSlotIds.push(created._id.toString());
            count++;
          }
        }
      }
      return count;
    });
    return res.json({
      success: true,
      batchId,
      totalCreatedShowtimes,
      createdSlotIds,
      message: 'Đã tạo ' + totalCreatedShowtimes + ' suất chiếu.',
    });`;

if (ac.includes(oldBatchTx)) {
  ac = ac.replace(oldBatchTx, newBatchTx);
  console.log('✅ Patched batchScheduleShowtimes with batchId');
}

fs.writeFileSync(acPath, ac, 'utf8');

// ── 2. Patch adminRoutes.js ──────────────────────────────────────────────────
const arPath = 'd:/CDIO/movietix-project/backend/src/routes/adminRoutes.js';
let ar = fs.readFileSync(arPath, 'utf8');

const importBulk = `import {
  previewBulkDeleteShowtimes,
  commitBulkDeleteShowtimes,
  queryShowtimesByCondition,
  deleteShowtimeSafe,
} from '../controllers/bulkShowtimeController.js';\n`;

if (!ar.includes('previewBulkDeleteShowtimes')) {
  ar = importBulk + ar;
  console.log('✅ Added bulkShowtimeController imports to adminRoutes.js');
}

const oldDeleteRoute = `router.delete('/showtimes/:id', authenticateAdmin, deleteShowtime);`;
const newDeleteRoute = `router.post('/showtimes/bulk-delete/preview', authenticateAdmin, previewBulkDeleteShowtimes);
router.post('/showtimes/bulk-delete/commit', authenticateAdmin, commitBulkDeleteShowtimes);
router.post('/showtimes/query-condition', authenticateAdmin, queryShowtimesByCondition);
router.delete('/showtimes/:id', authenticateAdmin, deleteShowtimeSafe);`;

if (ar.includes(oldDeleteRoute)) {
  ar = ar.replace(oldDeleteRoute, newDeleteRoute);
  console.log('✅ Registered bulk delete & safe delete routes in adminRoutes.js');
}

fs.writeFileSync(arPath, ar, 'utf8');
console.log('Done patching backend files.');
