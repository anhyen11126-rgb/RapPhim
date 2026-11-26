import mongoose from 'mongoose';
import Showtime from '../models/Showtime.js';

export const DEFAULT_CLEANING_MINUTES = 20;
export const MIN_CLEANING_MINUTES = 15;
export const MAX_CLEANING_MINUTES = 20;

export const normalizeCleaningMinutes = (value, fallback = DEFAULT_CLEANING_MINUTES) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= MIN_CLEANING_MINUTES && num <= MAX_CLEANING_MINUTES) {
    return Math.round(num);
  }
  return fallback;
};

/**
 * Tính toán chính xác vòng đời suất chiếu theo thời gian thực:
 * - endTime = startTime + movieDuration
 * - cleaningEndTime = endTime + cleaningMinutes (mặc định 20 phút, cho phép 15-20 phút)
 * - UPCOMING: now < startTime
 * - NOW_SHOWING: startTime <= now < endTime
 * - CLEANING: endTime <= now < cleaningEndTime
 * - COMPLETED: now >= cleaningEndTime
 * - CANCELLED: cancelledAt != null
 */
export const computeShowtimeLifecycle = (showtime = {}, nowInput = new Date()) => {
  const nowDate = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const nowMs = Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now();

  const startDate = showtime?.startTime ? new Date(showtime.startTime) : new Date(nowMs);
  const startMs = Number.isFinite(startDate.getTime()) ? startDate.getTime() : nowMs;

  const rawDuration = Number(
    showtime?.movieDuration ??
      showtime?.movieId?.duration ??
      showtime?.movie?.duration ??
      120
  );
  const durationMinutes = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : 120;

  const rawEndMs = showtime?.endTime ? new Date(showtime.endTime).getTime() : NaN;
  const endMs =
    Number.isFinite(rawEndMs) && rawEndMs > startMs
      ? rawEndMs
      : startMs + durationMinutes * 60000;

  const cleaningMinutes = normalizeCleaningMinutes(
    showtime?.cleaningMinutes,
    DEFAULT_CLEANING_MINUTES
  );
  const cleaningEndMs = endMs + cleaningMinutes * 60000;

  let lifecycleStatus = 'UPCOMING';
  if (showtime?.cancelledAt) {
    lifecycleStatus = 'CANCELLED';
  } else if (nowMs >= cleaningEndMs) {
    lifecycleStatus = 'COMPLETED';
  } else if (nowMs >= endMs) {
    lifecycleStatus = 'CLEANING';
  } else if (nowMs >= startMs) {
    lifecycleStatus = 'NOW_SHOWING';
  } else {
    lifecycleStatus = 'UPCOMING';
  }

  const isActiveSchedule =
    lifecycleStatus === 'UPCOMING' ||
    lifecycleStatus === 'NOW_SHOWING' ||
    lifecycleStatus === 'CLEANING';

  return {
    lifecycleStatus,
    startTime: new Date(startMs),
    endTime: new Date(endMs),
    cleaningMinutes,
    cleaningEndTime: new Date(cleaningEndMs),
    durationMinutes,
    isActiveSchedule,
    isCompleted: lifecycleStatus === 'COMPLETED',
    isCancelled: lifecycleStatus === 'CANCELLED',
  };
};

/**
 * Đồng bộ trạng thái vòng đời (UPCOMING / NOW_SHOWING / CLEANING / COMPLETED / CANCELLED)
 * xuống MongoDB mà không xóa dữ liệu lịch sử của các suất đã chiếu.
 */
export const syncShowtimeLifecycleStatuses = async (nowInput = new Date()) => {
  if (mongoose.connection.readyState !== 1) {
    return { scanned: 0, updated: 0 };
  }

  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const candidates = await Showtime.find({
    $or: [
      { lifecycleStatus: { $nin: ['COMPLETED', 'CANCELLED'] } },
      { lifecycleStatus: { $exists: false } },
      { cleaningEndTime: null },
      { cleaningEndTime: { $exists: false } },
      { cancelledAt: { $ne: null }, lifecycleStatus: { $ne: 'CANCELLED' } },
    ],
  })
    .select('_id movieId startTime endTime cleaningMinutes cleaningEndTime lifecycleStatus cancelledAt')
    .populate('movieId', 'duration')
    .lean();

  if (!candidates.length) {
    return { scanned: 0, updated: 0 };
  }

  const bulkOps = [];
  for (const st of candidates) {
    const lifecycle = computeShowtimeLifecycle(st, now);
    const currentEndMs = st.endTime ? new Date(st.endTime).getTime() : 0;
    const currentCleaningEndMs = st.cleaningEndTime ? new Date(st.cleaningEndTime).getTime() : 0;

    const needsUpdate =
      st.lifecycleStatus !== lifecycle.lifecycleStatus ||
      st.cleaningMinutes !== lifecycle.cleaningMinutes ||
      currentEndMs !== lifecycle.endTime.getTime() ||
      currentCleaningEndMs !== lifecycle.cleaningEndTime.getTime();

    if (needsUpdate) {
      bulkOps.push({
        updateOne: {
          filter: { _id: st._id },
          update: {
            $set: {
              lifecycleStatus: lifecycle.lifecycleStatus,
              endTime: lifecycle.endTime,
              cleaningMinutes: lifecycle.cleaningMinutes,
              cleaningEndTime: lifecycle.cleaningEndTime,
            },
          },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await Showtime.bulkWrite(bulkOps, { ordered: false });
  }

  return { scanned: candidates.length, updated: bulkOps.length };
};

let lifecycleTimer = null;

export const startShowtimeLifecycleScheduler = (intervalMs = 60000) => {
  if (lifecycleTimer) return lifecycleTimer;

  const runTick = async () => {
    try {
      await syncShowtimeLifecycleStatuses(new Date());
    } catch (err) {
      console.warn('⚠️ [ShowtimeLifecycleScheduler] Lỗi cập nhật trạng thái suất chiếu:', err.message);
    }
  };

  setTimeout(runTick, 1500).unref?.();
  lifecycleTimer = setInterval(runTick, intervalMs);
  lifecycleTimer.unref?.();
  return lifecycleTimer;
};
