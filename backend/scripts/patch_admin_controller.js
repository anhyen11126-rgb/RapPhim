import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/CDIO/movietix-project/backend/src/controllers/adminController.js';
let c = readFileSync(p, 'utf8');

// ─── FIX 1: scheduleInRoom – add formatFeature param ─────────────────────────
const old1 = `async function scheduleInRoom({ room, movie, start, price, pricing, session }) {`;
const new1 = `async function scheduleInRoom({ room, movie, start, price, pricing, session, formatFeature: fmtOverride }) {`;
if (!c.includes(old1)) { console.error('PATTERN 1 NOT FOUND'); process.exit(1); }
c = c.replace(old1, new1);

// ─── FIX 2: scheduleInRoom – use fmtOverride when creating showtime ───────────
const old2 = `    formatFeature: room.formatFeature, startTime: start, endTime, cleaningMinutes,`;
const new2 = `    formatFeature: fmtOverride ?? room.formatFeature, startTime: start, endTime, cleaningMinutes,`;
if (!c.includes(old2)) { console.error('PATTERN 2 NOT FOUND'); process.exit(1); }
c = c.replace(old2, new2);

// ─── FIX 3: createShowtime – destructure formatFeature from req.body ──────────
const old3 = `    const { movieId, cinemaId, roomId, roomName, startTime, price } = req.body;`;
const new3 = `    const { movieId, cinemaId, roomId, roomName, startTime, price, formatFeature: bodyFormat } = req.body;`;
if (!c.includes(old3)) { console.error('PATTERN 3 NOT FOUND'); process.exit(1); }
c = c.replace(old3, new3);

// ─── FIX 4: createShowtime – pass formatFeature to scheduleInRoom ─────────────
const old4 = `      return scheduleInRoom({ room, movie, start, price: price == null ? undefined : Number(price), pricing, session });`;
const new4 = `      return scheduleInRoom({ room, movie, start, price: price == null ? undefined : Number(price), pricing, session, formatFeature: typeof bodyFormat === 'string' && bodyFormat.trim() ? bodyFormat.trim() : undefined });`;
if (!c.includes(old4)) { console.error('PATTERN 4 NOT FOUND'); process.exit(1); }
c = c.replace(old4, new4);

// ─── APPEND: previewRecurringShowtimes + commitRecurringShowtimes ─────────────
const append = `

// ════════════════════════════════════════════════════════════════════════════════
// RECURRING SHOWTIME – Preview (READ-ONLY, no DB writes)
// ════════════════════════════════════════════════════════════════════════════════
export const previewRecurringShowtimes = async (req, res) => {
  try {
    const {
      movieId, roomId, cinemaId, formatFeature,
      startDate, endDate,
      daysOfWeek,   // number[] 0-6 (JS getDay)
      timeSlots,    // string[] "HH:mm"
      pricingMode,  // "fixed" | "auto"
      price,
    } = req.body;

    // ── Validate inputs ────────────────────────────────────────────────────────
    if (!mongoose.isObjectIdOrHexString(movieId)) return res.status(400).json({ message: 'movieId không hợp lệ.' });
    if (!mongoose.isObjectIdOrHexString(roomId))  return res.status(400).json({ message: 'roomId không hợp lệ.' });
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(startDate) || !/^\\d{4}-\\d{2}-\\d{2}$/.test(endDate))
      return res.status(400).json({ message: 'startDate / endDate phải định dạng YYYY-MM-DD.' });
    if (startDate > endDate) return res.status(400).json({ message: 'startDate phải ≤ endDate.' });

    const msPerDay = 86400000;
    const startMs = new Date(startDate + 'T00:00:00+07:00').getTime();
    const endMs   = new Date(endDate   + 'T00:00:00+07:00').getTime();
    const rangeDays = Math.round((endMs - startMs) / msPerDay) + 1;
    if (rangeDays > 31) return res.status(400).json({ message: 'Phạm vi lặp lịch tối đa 31 ngày.' });

    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0)
      return res.status(400).json({ message: 'Chọn ít nhất 1 ngày trong tuần.' });
    if (!Array.isArray(timeSlots) || timeSlots.length === 0)
      return res.status(400).json({ message: 'Chọn ít nhất 1 khung giờ.' });
    for (const t of timeSlots) {
      if (!/^\\d{2}:\\d{2}$/.test(t)) return res.status(400).json({ message: \`Khung giờ "\${t}" không đúng định dạng HH:mm.\` });
    }
    if (pricingMode === 'fixed' && (price == null || !Number.isSafeInteger(Number(price)) || Number(price) <= 0))
      return res.status(400).json({ message: 'Giá vé cố định không hợp lệ.' });

    // ── Load movie, room, pricing ──────────────────────────────────────────────
    const [movie, room, pricing] = await Promise.all([
      Movie.findById(movieId).lean(),
      Room.findOne({ _id: roomId, status: 'ACTIVE' }).lean(),
      ensurePricingConfig(),
    ]);
    if (!movie) return res.status(404).json({ message: 'Không tìm thấy phim.' });
    if (!room)  return res.status(404).json({ message: 'Phòng không tồn tại hoặc đang bảo trì.' });
    if (cinemaId && cinemaId !== 'ALL' && String(room.cinemaId) !== cinemaId)
      return res.status(400).json({ message: 'Phòng không thuộc cụm rạp đã chọn.' });

    const duration = Number(movie.duration);
    if (!Number.isFinite(duration) || duration <= 0)
      return res.status(400).json({ message: 'Phim chưa có thời lượng hợp lệ.' });

    const cleaningMs = 15 * 60000;
    const durationMs = duration * 60000;
    const usedFormatFeature = (typeof formatFeature === 'string' && formatFeature.trim()) ? formatFeature.trim() : room.formatFeature;

    // ── Load existing showtimes for this room in the date range (read-only) ────
    const rangeStart = new Date(startDate + 'T00:00:00+07:00');
    const rangeEnd   = new Date(endDate   + 'T23:59:59+07:00');
    const existingShowtimes = await Showtime.find({
      $or: [
        { roomId: room._id },
        { roomId: null, cinemaId: room.cinemaId, roomName: { $in: [room.name, room.shortName].filter(Boolean) } },
      ],
      cancelledAt: null,
      startTime: { $lte: rangeEnd },
      endTime:   { $gte: rangeStart },
    }).select('startTime endTime cleaningMinutes').lean();

    // Build existing intervals [start, blockedUntil)
    const existingIntervals = existingShowtimes.map(st => {
      const s = st.startTime.getTime();
      const e = (st.endTime?.getTime() ?? (s + 120 * 60000));
      const cleanMs = (st.cleaningMinutes ?? 15) * 60000;
      return { s, blockedUntil: e + cleanMs };
    });

    // localRelease check
    const localRelease = movie.releaseDate?.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

    // ── Generate candidate slots ───────────────────────────────────────────────
    const validSlots = [];
    const conflictSlots = [];
    // Accumulate committed (intra-batch) intervals as we go
    const batchIntervals = [];

    for (let d = 0; d < rangeDays; d++) {
      const dateMs = startMs + d * msPerDay;
      const dateObj = new Date(dateMs);
      // dateStr in Ho Chi Minh timezone
      const dateStr = dateObj.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
      const dow = new Date(dateStr + 'T12:00:00+07:00').getDay(); // 0=Sun..6=Sat

      if (!daysOfWeek.includes(dow)) continue;

      // Release date check
      if (localRelease && dateStr < localRelease) {
        for (const slot of timeSlots) {
          conflictSlots.push({
            date: dateStr, dayOfWeek: dow,
            movieTitle: movie.title, roomName: room.name,
            formatFeature: usedFormatFeature,
            startTime: \`\${dateStr}T\${slot}:00+07:00\`,
            status: 'CONFLICT', conflictReason: 'Trước ngày khởi chiếu phim.',
          });
        }
        continue;
      }

      for (const slot of timeSlots) {
        const slotStart = new Date(\`\${dateStr}T\${slot}:00+07:00\`).getTime();
        const slotEnd   = slotStart + durationMs;
        const slotBlock = slotEnd + cleaningMs;

        const resolvedPrice = pricingMode === 'fixed'
          ? Number(price)
          : calculatePricesFromConfig({ roomName: room.name, roomType: room.roomType, formatFeature: usedFormatFeature, startTime: new Date(slotStart) }, pricing).priceStandard;

        // Check conflicts against existing + same batch
        const allIntervals = [...existingIntervals, ...batchIntervals];
        const conflict = allIntervals.find(iv => slotStart < iv.blockedUntil && slotBlock > iv.s);

        if (conflict) {
          conflictSlots.push({
            date: dateStr, dayOfWeek: dow,
            movieId: String(movie._id), movieTitle: movie.title,
            roomId: String(room._id), roomName: room.name,
            formatFeature: usedFormatFeature,
            startTime: new Date(slotStart).toISOString(),
            endTime:   new Date(slotEnd).toISOString(),
            cleanReadyTime: new Date(slotBlock).toISOString(),
            price: resolvedPrice,
            status: 'CONFLICT',
            conflictReason: 'Chồng lịch chiếu hoặc thiếu 15 phút dọn phòng.',
          });
        } else {
          batchIntervals.push({ s: slotStart, blockedUntil: slotBlock });
          validSlots.push({
            date: dateStr, dayOfWeek: dow,
            movieId: String(movie._id), movieTitle: movie.title,
            roomId: String(room._id), roomName: room.name,
            formatFeature: usedFormatFeature,
            startTime: new Date(slotStart).toISOString(),
            endTime:   new Date(slotEnd).toISOString(),
            cleanReadyTime: new Date(slotBlock).toISOString(),
            price: resolvedPrice,
            status: 'VALID',
          });
        }
      }
    }

    // slotAvailability: for each time slot, how many days it's VALID vs total selected days
    const slotAvail = {};
    for (const t of timeSlots) {
      const tLabel = t;
      slotAvail[tLabel] = { available: 0, conflict: 0 };
    }
    for (const vs of validSlots) {
      const t = vs.startTime.substring(11, 16); // "HH:mm" in UTC — convert back
      const localT = new Date(vs.startTime).toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
      if (slotAvail[localT]) slotAvail[localT].available++;
    }
    for (const cs of conflictSlots) {
      if (!cs.startTime.includes('T')) continue;
      const localT = new Date(cs.startTime).toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
      if (slotAvail[localT]) slotAvail[localT].conflict++;
    }

    return res.json({
      validSlots,
      conflictSlots,
      validCount: validSlots.length,
      conflictCount: conflictSlots.length,
      totalExpected: validSlots.length + conflictSlots.length,
      slotAvailability: slotAvail,
    });
  } catch (error) {
    console.error('previewRecurringShowtimes error:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo preview lịch chiếu lặp.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// RECURRING SHOWTIME – Commit (creates Showtime + ShowtimeSeats per slot)
// ════════════════════════════════════════════════════════════════════════════════
// Simple idempotency cache (in-process, restart clears it; acceptable for MVP)
const _recurringRequestCache = new Set();

export const commitRecurringShowtimes = async (req, res) => {
  try {
    const { confirmedSlots, requestId } = req.body;

    if (!Array.isArray(confirmedSlots) || confirmedSlots.length === 0)
      return res.status(400).json({ message: 'Danh sách suất chiếu xác nhận trống.' });
    if (confirmedSlots.length > 200)
      return res.status(400).json({ message: 'Tối đa 200 suất chiếu mỗi lần tạo hàng loạt.' });

    // Idempotency check
    if (requestId) {
      if (_recurringRequestCache.has(requestId))
        return res.status(409).json({ message: 'Request này đã được xử lý. Không tạo lại.' });
      _recurringRequestCache.add(requestId);
      // Auto-evict after 10 minutes to avoid unbounded growth
      setTimeout(() => _recurringRequestCache.delete(requestId), 10 * 60 * 1000);
    }

    const pricing = await ensurePricingConfig();

    const created = [];
    const conflicts = [];
    const failed = [];

    // Per-slot independent transactions for resilience
    for (const slot of confirmedSlots) {
      const { movieId, roomId, cinemaId, formatFeature: slotFormat, startTime, price } = slot;

      if (!mongoose.isObjectIdOrHexString(movieId) || !mongoose.isObjectIdOrHexString(roomId)) {
        failed.push({ slot, reason: 'movieId hoặc roomId không hợp lệ.' });
        continue;
      }
      const start = new Date(startTime);
      if (!Number.isFinite(start.getTime())) {
        failed.push({ slot, reason: 'startTime không hợp lệ.' });
        continue;
      }

      try {
        const [movie] = await Promise.all([Movie.findById(movieId).lean()]);
        if (!movie) { failed.push({ slot, reason: 'Không tìm thấy phim.' }); continue; }

        const showtime = await mongoose.connection.transaction(async session => {
          const room = await lockRoom(roomId, session);
          if (cinemaId && cinemaId !== 'ALL' && String(room.cinemaId) !== cinemaId) {
            throw new ScheduleConflict('Phòng không thuộc cụm rạp đã chọn.');
          }
          return scheduleInRoom({
            room, movie, start,
            price: price == null ? undefined : Number(price),
            pricing, session,
            formatFeature: (typeof slotFormat === 'string' && slotFormat.trim()) ? slotFormat.trim() : undefined,
          });
        });

        created.push({
          id: String(showtime._id),
          movieId, roomId,
          startTime: showtime.startTime,
          endTime: showtime.endTime,
          price: showtime.price,
        });
      } catch (err) {
        if (err instanceof ScheduleConflict) {
          conflicts.push({ slot, reason: err.message });
        } else {
          console.error('commitRecurringShowtimes slot error:', err.message);
          failed.push({ slot, reason: 'Lỗi nội bộ khi tạo suất chiếu.' });
        }
      }
    }

    const allOk = conflicts.length === 0 && failed.length === 0;
    return res.status(allOk ? 201 : 207).json({
      message: allOk
        ? \`Đã tạo thành công \${created.length} suất chiếu.\`
        : \`Tạo \${created.length}/\${confirmedSlots.length} suất chiếu. \${conflicts.length} xung đột, \${failed.length} lỗi.\`,
      created,
      conflicts,
      failed,
      skipped: [],
    });
  } catch (error) {
    console.error('commitRecurringShowtimes error:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo lịch chiếu lặp.' });
  }
};
`;

writeFileSync(p, readFileSync(p, 'utf8') + append, 'utf8');
console.log('adminController: formatFeature fixes + 2 recurring endpoints appended OK');
