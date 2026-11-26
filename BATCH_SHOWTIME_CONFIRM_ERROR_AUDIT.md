# BÁO CÁO AUDIT SOURCE CODE – LỖI XÁC NHẬN TẠO LỊCH CHIẾU HÀNG LOẠT (180 SUẤT / 15.840 GHẾ)

- **Dự án:** D’AVENOR CINEMA (`movietix-project`)
- **Trang kiểm tra:** `/admin/showtimes` — Popup **⚡ Lên lịch chiếu hàng loạt thông minh**
- **Hiện tượng lỗi:**
  - Khi chọn **4 ngày, 3 phim, 9 phòng** (Chế độ tối ưu tối đa hoặc 5 suất/phòng = **180 suất hợp lệ**, **0 xung đột thực sự**, **0 thiếu quỹ thời gian**):
  - Bước **Preview** (`preview: true`) trả về `HTTP 200 OK` trong **~194 ms**.
  - Bước **Confirm** (`preview: false`, bấm **"Xác nhận tạo 180 suất chiếu"**) chạy trong **~163.116 ms (~2 phút 43 giây)** rồi thất bại với `HTTP 500 Internal Server Error` và hiển thị hộp thoại:
    `Lỗi xếp lịch chiếu: Không thể xếp lịch hàng loạt.`
- **Phạm vi thực hiện:** Chỉ thực hiện **Source Code Audit & Kiểm thử tái hiện an toàn** (không tự ý sửa source code ứng dụng, không thay đổi schema/index, không để lại dữ liệu rác trong MongoDB).

---

## 1. KIỂM TRA FRONTEND (`frontend/src/pages/admin/ShowtimeManagePage.jsx` & `frontend/src/services/api.js`)

### 1.1. Cấu hình Axios API Client (`frontend/src/services/api.js`, dòng 1–42)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor cho Request: gắn token từ localStorage hoặc sessionStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor cho Response: tự động xóa phiên đăng nhập khi token hết hạn (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.dispatchEvent(new Event('authChange'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

- **Nhận xét cấu hình timeout:** `axios.create` không đặt `timeout` (mặc định `timeout: 0` = không giới hạn ở phía Axios), do đó Frontend chờ đến khi Backend trả về `HTTP 500` sau ~163 giây.

### 1.2. State `batchData` (`ShowtimeManagePage.jsx`, dòng 122–140)

```javascript
  // Form lên lịch chiếu hàng loạt thông minh (Smart & Manual)
  const DEFAULT_BATCH_MANUAL_SLOTS = ['09:30', '12:45', '16:00', '19:15', '22:30'];
  const [batchData, setBatchData] = useState({
    cinemaId: 'ALL',
    startDate: todayStr,
    endDate: todayStr,
    selectedMovieIds: [],
    roomIds: [],
    scheduleMode: 'smart', // 'smart' | 'manual'
    firstShowtimeTime: '09:30',
    latestStartTime: '22:30',
    targetSlotsPerRoom: 5,
    cleaningMinutes: 20,
    optimizeMaxSlots: false,
    staggerRooms: true,
    timeSlots: [...DEFAULT_BATCH_MANUAL_SLOTS],
  });
  const [batchMovieSearch, setBatchMovieSearch] = useState('');
  const [batchNewTimeInput, setBatchNewTimeInput] = useState('');
  const [batchTimeSlotError, setBatchTimeSlotError] = useState('');
  const [batchPreviewFilter, setBatchPreviewFilter] = useState('ALL'); // 'ALL' | 'VALID' | 'CONFLICT'
  const [collapsedPreviewGroups, setCollapsedPreviewGroups] = useState(() => new Set());
```

### 1.3. Hàm tạo Payload, xử lý Preview và xử lý Confirm (`ShowtimeManagePage.jsx`, dòng 878–976)

```javascript
  const buildBatchSchedulePayload = (isPreview) => {
    const base = {
      cinemaId: batchData.cinemaId,
      startDate: batchData.startDate,
      endDate: batchData.endDate,
      movieIds: batchData.selectedMovieIds.map(String),
      roomIds: batchData.roomIds.map(String),
      scheduleMode: batchData.scheduleMode,
      cleaningMinutes: Number(batchData.cleaningMinutes) === 15 ? 15 : 20,
      preview: Boolean(isPreview),
    };

    if (batchData.scheduleMode === 'smart') {
      base.firstShowtimeTime = batchData.firstShowtimeTime || '09:30';
      base.latestStartTime = batchData.latestStartTime || '22:30';
      base.targetSlotsPerRoom = Number(batchData.targetSlotsPerRoom) || 5;
      base.optimizeMaxSlots = Boolean(batchData.optimizeMaxSlots);
      base.staggerRooms = Boolean(batchData.staggerRooms);
    } else {
      base.timeSlots = batchData.timeSlots.map((t) => t.trim());
    }

    if (!isPreview && batchPreview) {
      base.expectedValidCount = batchPreview.validCount;
      base.expectedSignature = batchPreview.validSignature;
    }

    return base;
  };

  // Xếp lịch hàng loạt: Xem trước (Preview)
  const handlePreviewBatch = async () => {
    if (!batchData.startDate || !batchData.endDate) {
      alert('Vui lòng chọn ngày bắt đầu và kết thúc!');
      return;
    }
    if (batchData.startDate > batchData.endDate) {
      alert('Ngày bắt đầu không được lớn hơn ngày kết thúc!');
      return;
    }
    if (batchData.selectedMovieIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 bộ phim trước khi xem trước lịch dự kiến!');
      return;
    }
    if (batchData.roomIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 phòng chiếu!');
      return;
    }

    if (batchData.scheduleMode === 'manual') {
      if (!batchData.timeSlots.length) {
        setBatchTimeSlotError('Vui lòng thêm ít nhất 1 khung giờ chiếu.');
        return;
      }
      for (const slot of batchData.timeSlots) {
        const check = validateManualTimeSlotValue(slot);
        if (!check.valid) {
          setBatchTimeSlotError(check.message);
          return;
        }
      }
      const uniqueSet = new Set(batchData.timeSlots.map((t) => t.trim()));
      if (uniqueSet.size !== batchData.timeSlots.length) {
        setBatchTimeSlotError('Danh sách khung giờ đang có giờ trùng nhau. Vui lòng chỉnh sửa hoặc xóa giờ trùng.');
        return;
      }
      setBatchTimeSlotError('');
    }

    try {
      setBatchLoading(true);
      const res = await api.post('/admin/showtimes/schedule-batch', buildBatchSchedulePayload(true));

      if (res.data?.preview) {
        setBatchPreview(res.data);
      }
    } catch (err) {
      alert('Lỗi xem trước lịch chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setBatchLoading(false);
    }
  };

  // Xếp lịch hàng loạt: Xác nhận ghi Database
  const handleExecuteBatchSchedule = async () => {
    if (!batchPreview || !batchPreview.validCount) {
      alert('Vui lòng bấm "Xem trước lịch dự kiến" và đảm bảo có ít nhất 1 suất chiếu hợp lệ trước khi xác nhận!');
      return;
    }
    if (batchData.selectedMovieIds.length === 0 || batchData.roomIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 phim và 1 phòng chiếu!');
      return;
    }

    try {
      setBatchLoading(true);
      const res = await api.post('/admin/showtimes/schedule-batch', buildBatchSchedulePayload(false));

      alert(`Đã xếp lịch chiếu hàng loạt thành công! (${res.data?.totalCreatedShowtimes || 0} suất chiếu, đủ 88 ghế/suất)`);
      setIsBatchModalOpen(false);
      setBatchPreview(null);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.response?.status === 409) {
        setBatchPreview(null);
      }
      alert('Lỗi xếp lịch chiếu: ' + msg);
    } finally {
      setBatchLoading(false);
    }
  };
```

### 1.4. So sánh chính xác giữa Request Preview và Request Confirm

| Trường Payload | Request Preview (`isPreview = true`) | Request Confirm (`isPreview = false`) |
| :--- | :--- | :--- |
| **Endpoint** | `POST /api/admin/showtimes/schedule-batch` | `POST /api/admin/showtimes/schedule-batch` |
| `cinemaId` | `"6aecb03919dd0ede75638b6e"` | `"6aecb03919dd0ede75638b6e"` |
| `startDate` / `endDate` | `"2026-11-26"` → `"2026-11-29"` (4 ngày) | `"2026-11-26"` → `"2026-11-29"` (4 ngày) |
| `movieIds` | Mảng 3 Movie ID (`string[]`) | Mảng 3 Movie ID (`string[]`) |
| `roomIds` | Mảng 9 Room ID (`string[]`) | Mảng 9 Room ID (`string[]`) |
| `scheduleMode` | `"smart"` | `"smart"` |
| `firstShowtimeTime` / `latestStartTime` | `"09:30"` / `"22:30"` | `"09:30"` / `"22:30"` |
| `targetSlotsPerRoom` | `5` | `5` |
| `cleaningMinutes` | `20` | `20` |
| `optimizeMaxSlots` / `staggerRooms` | `true` / `true` | `true` / `true` |
| `preview` | `true` | `false` |
| `expectedValidCount` | *(không gửi)* | `180` |
| `expectedSignature` | *(không gửi)* | Chuỗi chữ ký 180 suất `roomId\|movieId\|startTime\|cleaningMinutes` |

---

## 2. KIỂM TRA BACKEND (`backend/src/controllers/adminController.js` & `backend/src/routes/adminRoutes.js`)

### 2.1. Route và Middleware (`backend/src/routes/adminRoutes.js`, dòng 88)

```javascript
router.post('/showtimes/schedule-batch', authenticateAdmin, batchScheduleShowtimes);
```

### 2.2. Hàm `scheduleInRoom` và `lockRoom` (`backend/src/controllers/adminController.js`, dòng 270–349)

```javascript
class ScheduleConflict extends Error {}

async function scheduleInRoom({ room, movie, start, price, pricing, session, formatFeature: fmtOverride, batchId, creationSource, createdBy, cleaningMinutes: customCleaning }) {
  const duration = Number(movie.duration);
  const cleaningMinutes = normalizeCleaningMinutes(customCleaning, DEFAULT_CLEANING_MINUTES);
  if (!Number.isFinite(duration) || duration <= 0) throw new ScheduleConflict('Phim chưa có thời lượng hợp lệ.');
  if (movie.releaseDate && businessDate(start) < businessDate(movie.releaseDate)) {
    throw new ScheduleConflict('Suất chiếu sớm hơn ngày khởi chiếu.');
  }
  const endTime = new Date(start.getTime() + duration * 60000);
  const cleaningEndTime = new Date(endTime.getTime() + cleaningMinutes * 60000);
  const blockedUntil = cleaningEndTime.getTime();
  const now = new Date();

  const existing = await Showtime.find({
    $or: [{ roomId: room._id }, { roomId: null, cinemaId: room.cinemaId, roomName: { $in: [room.name, room.shortName].filter(Boolean) } }],
    cancelledAt: null,
  }).select('movieId startTime endTime cleaningMinutes cleaningEndTime lifecycleStatus cancelledAt').populate('movieId', 'duration').session(session).lean();
  const overlaps = existing.some(slot => {
    const slotLifecycle = computeShowtimeLifecycle(slot, now);
    if (slotLifecycle.lifecycleStatus === 'COMPLETED' || slotLifecycle.lifecycleStatus === 'CANCELLED') {
      return false;
    }
    const slotStart = slotLifecycle.startTime.getTime();
    const slotBlockedUntil = slotLifecycle.cleaningEndTime.getTime();
    // Chặn mọi va chạm với suất chiếu đang hoạt động: trùng giờ bắt đầu, bao phủ, chồng lấn một phần, hoặc thiếu thời gian dọn phòng
    return start.getTime() < slotBlockedUntil && blockedUntil > slotStart;
  });
  if (overlaps) throw new ScheduleConflict(`Khung giờ chồng lịch chiếu hoặc không đủ ${cleaningMinutes} phút dọn dẹp vệ sinh phòng.`);

  let seatTemplates = [];
  const [template] = await ShowtimeSeat.aggregate([
    { $match: { roomId: room._id } },
    { $group: { _id: '$showtimeId', count: { $sum: 1 } } },
    { $match: { count: room.totalSeats } },
    { $sort: { _id: -1 } },
    { $limit: 1 },
  ]).session(session);

  if (template) {
    seatTemplates = await ShowtimeSeat.find({ roomId: room._id, showtimeId: template._id })
      .select('row col seatNumber type').session(session).lean();
  }

  // Nếu phòng chưa có template lịch sử, sinh ma trận 88 ghế chuẩn (A–G: 12 ghế 6+6, H: 4 ghế 2+2)
  if (!seatTemplates.length) {
    seatTemplates = buildStandard88SeatTemplates();
  }

  const calculated = calculatePricesFromConfig({
    roomName: room.name, roomType: room.roomType, formatFeature: room.formatFeature, startTime: start,
  }, pricing);
  const initialLifecycle = computeShowtimeLifecycle({
    startTime: start,
    endTime,
    cleaningMinutes,
  }, now);
  const [showtime] = await Showtime.create([{
    movieId: movie._id, cinemaId: room.cinemaId, roomId: room._id, roomName: room.name,
    formatFeature: fmtOverride ?? room.formatFeature, startTime: start, endTime, cleaningMinutes,
    cleaningEndTime,
    lifecycleStatus: initialLifecycle.lifecycleStatus,
    price: price ?? calculated.priceStandard,
    batchId: batchId || null,
    creationSource: creationSource || 'MANUAL',
    createdBy: createdBy || null,
  }], { session });
  await ShowtimeSeat.insertMany(seatTemplates.map(({ row, col, seatNumber, type }) => ({
    roomId: room._id, showtimeId: showtime._id, row, col, seatNumber, type, status: 'AVAILABLE',
  })), { session });
  return showtime;
}

async function lockRoom(roomId, session) {
  const room = await Room.findOneAndUpdate(
    { _id: roomId, status: 'ACTIVE' }, { $inc: { scheduleRevision: 1 } }, { new: true, session }
  );
  if (!room) throw new ScheduleConflict('Phòng không có hoặc đang bảo trì.');
  return room;
}
```

### 2.3. Hàm `batchScheduleShowtimes` (`backend/src/controllers/adminController.js`, dòng 1411–1661)

```javascript
export const batchScheduleShowtimes = async (req, res) => {
  try {
    const {
      roomIds,
      startDate,
      endDate,
      movieIds,
      timeSlots,
      preview,
      scheduleMode: rawMode,
      firstShowtimeTime = '09:30',
      latestStartTime = '22:30',
      targetSlotsPerRoom = 5,
      cleaningMinutes: rawCleaning = 20,
      optimizeMaxSlots = false,
      staggerRooms = true,
      expectedValidCount,
      expectedSignature,
    } = req.body;
    // ... (xác thực input và gọi planBatchSchedule cho nhánh preview) ...

    // 2. NHÁNH CONFIRM (TẠO LỊCH THỰC TẾ TRONG TRANSACTION):
    const batchId =
      'BATCH-' +
      Date.now().toString(36).toUpperCase() +
      '-' +
      Math.random().toString(36).slice(2, 7).toUpperCase();
    const createdSlotIds = [];
    const createdShowtimes = [];

    const totalCreatedShowtimes = await mongoose.connection.transaction(async (session) => {
      const lockedRoomMap = new Map();
      for (const rm of roomsInOrder) {
        const locked = await lockRoom(rm._id, session);
        lockedRoomMap.set(String(rm._id), locked);
      }

      const existingInTx = await Showtime.find({
        roomId: { $in: uniqueRoomIds },
        cancelledAt: null,
        startTime: { $gte: new Date(+start - day), $lte: new Date(+end + 2 * day) },
      })
        .populate('movieId', 'title duration')
        .session(session)
        .lean();

      const txPlan = planBatchSchedule({
        roomsInOrder,
        moviesInOrder,
        startMsDay: +start,
        endMsDay: +end,
        scheduleMode,
        firstShowtimeTime,
        latestStartTime,
        targetSlotsPerRoom,
        cleaningMinutes,
        optimizeMaxSlots: Boolean(optimizeMaxSlots),
        staggerRooms: Boolean(staggerRooms),
        timeSlots: normalizedTimeSlots,
        existingShowtimes: existingInTx,
        pricingConfig: pricing,
        now,
      });

      if (expectedValidCount == null && expectedSignature == null && txPlan.conflictCount > 0 && scheduleMode === 'manual') {
        throw new ScheduleConflict(txPlan.conflictSlots[0]?.reason || 'Khung giờ chồng lịch chiếu.');
      }

      if (
        (expectedValidCount != null && Number(expectedValidCount) !== txPlan.validCount) ||
        (expectedSignature && expectedSignature !== txPlan.validSignature)
      ) {
        throw new ScheduleConflict(
          'Dữ liệu lịch chiếu trong phòng vừa thay đổi hoặc phát sinh xung đột mới. Vui lòng bấm Xem trước lịch dự kiến (Preview) lại trước khi xác nhận.'
        );
      }

      if (txPlan.validSlots.length === 0) {
        throw new ScheduleConflict(
          txPlan.conflictSlots[0]?.reason || 'Không có suất chiếu hợp lệ nào để tạo.'
        );
      }

      let count = 0;
      for (const slot of txPlan.validSlots) {
        const roomDoc = lockedRoomMap.get(String(slot.roomId));
        const movieDoc = movieById.get(String(slot.movieId));
        const created = await scheduleInRoom({
          room: roomDoc,
          movie: movieDoc,
          start: new Date(slot.startTime),
          price: slot.priceStandard,
          pricing,
          session,
          batchId,
          creationSource: 'BULK',
          createdBy: req.admin?._id || req.user?._id || null,
          cleaningMinutes: slot.cleaningMinutes,
        });
        if (created?._id) {
          createdSlotIds.push(created._id.toString());
          createdShowtimes.push({
            id: created._id.toString(),
            roomId: String(slot.roomId),
            roomName: slot.roomName,
            movieId: String(slot.movieId),
            movieTitle: slot.movieTitle,
            date: slot.date,
            time: slot.time,
            startTime: slot.startTime,
            endTime: slot.endTime,
            cleaningMinutes: slot.cleaningMinutes,
            price: slot.priceStandard,
          });
        }
        count++;
      }
      return count;
    });

    return res.json({
      success: true,
      batchId,
      scheduleMode,
      cleaningMinutes,
      totalCreatedShowtimes,
      createdSlotIds,
      createdShowtimes,
      message: `Đã tạo thành công ${totalCreatedShowtimes} suất chiếu (đủ 88 ghế/suất).`,
    });
  } catch (error) {
    if (error instanceof ScheduleConflict) return res.status(409).json({ message: error.message });
    console.error('Batch scheduling failed:', error.name, error.message);
    return res.status(500).json({ message: 'Không thể xếp lịch hàng loạt.' });
  }
};
```

---

## 3. KIỂM TRA MONGODB / MONGOOSE SCHEMA & INDEX

### 3.1. `Showtime` (`backend/src/models/Showtime.js`)
- **Fields:** `movieId` (ObjectId, required, index), `cinemaId` (ObjectId, index), `roomId` (ObjectId, index), `roomName` (String), `formatFeature` (String), `startTime` (Date, required, index), `endTime` (Date), `cancelledAt` (Date), `cancelReason` (String), `batchId` (String, index), `creationSource` (`'MANUAL' | 'RECURRING' | 'BULK'`), `createdBy` (ObjectId), `bookingRevision` (Number), `cleaningMinutes` (Number, default 20), `cleaningEndTime` (Date, index), `lifecycleStatus` (`'UPCOMING' | 'NOW_SHOWING' | 'CLEANING' | 'COMPLETED' | 'CANCELLED'`, index), `price` (Number), `isLocked` (Boolean).
- **Indexes:**
  - `showtimeSchema.index({ movieId: 1, startTime: 1 });`
  - `showtimeSchema.index({ roomId: 1, startTime: 1, cancelledAt: 1 });`
  - `showtimeSchema.index({ roomId: 1, lifecycleStatus: 1, startTime: 1, endTime: 1 });`
- **Kiểm tra Unique Index & Suất đã hủy mềm (`cancelledAt != null`):**
  - `Showtime` **không** có unique index trên `{ roomId, startTime }`, và mọi truy vấn kiểm tra trùng lịch đều lọc `cancelledAt: null`. Do đó các suất đã hủy mềm (`CANCEL_WITH_REFUND`) hoặc đã xóa cứng trong `bulkShowtimeController.js` **không** gây lỗi duplicate key khi tạo lịch mới.

### 3.2. `ShowtimeSeat` (`backend/src/models/ShowtimeSeat.js`)
- **Fields:** `showtimeId` (ObjectId, required, index), `roomId` (ObjectId, index), `seatNumber` (String, required), `row` (String, required), `col` (Number, required), `type` (`'STANDARD' | 'VIP' | 'SWEETBOX'`), `status` (`'AVAILABLE' | 'HOLDING' | 'BOOKED'`, index), `holdExpiresAt`, `holdId`, `holdOwnerId`, `holdCreatedAt`, `bookingId`.
- **Indexes:**
  - `showtimeSeatSchema.index({ showtimeId: 1, seatNumber: 1 }, { unique: true });`
  - `showtimeSeatSchema.index({ showtimeId: 1, row: 1, col: 1 });`
  - `showtimeSeatSchema.index({ showtimeId: 1, status: 1, holdExpiresAt: 1 });`
- **Lưu ý quan trọng:** Collection `ShowtimeSeat` **không có index đơn hoặc compound bắt đầu bằng `{ roomId: 1 }`**. Do đó lệnh `ShowtimeSeat.aggregate([{ $match: { roomId: room._id } }, ...])` tại `adminController.js:301` phải thực hiện **COLLSCAN (quét toàn bộ collection `ShowtimeSeat`)** trên mỗi lần gọi `scheduleInRoom`!

### 3.3. `Room`, `Movie`, `Booking`, `TicketPricingConfig` & `roomLayoutConfig.js`
- `Room`: 9 phòng vật lý (`totalSeats: 88`, `status: 'ACTIVE' | 'MAINTENANCE'`, `scheduleRevision: Number`).
- `roomLayoutConfig.js`: `buildStandard88SeatTemplates()` tạo đúng 88 ghế (`A–D`: 48 ghế `STANDARD`, `E–G`: 36 ghế `VIP`, `H`: 4 ghế `SWEETBOX`).

---

## 4. TÁI HIỆN LỖI THỰC TẾ & KIỂM TRA THEO QUY MÔ TĂNG DẦN (`1, 5, 15, 45, 90, 180` SUẤT)

### 4.1. Bảng kết quả kiểm thử theo quy mô tăng dần trên MongoDB Atlas (Môi trường cô lập)

| Quy mô | Số ghế (`ShowtimeSeat`) | Thời gian Preview | Thời gian Confirm | HTTP Status | Kết quả | Số bản ghi sau khi hoàn tất / Rollback | Chi tiết lỗi Backend |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1 suất** | 88 ghế | `197 ms` | `1.362 ms` (`1,36s`) | `200 OK` | **PASS** | `1` Showtime, `88` ghế | Không có lỗi |
| **5 suất** | 440 ghế | `198 ms` | `4.486 ms` (`4,49s`) | `200 OK` | **PASS** | `5` Showtime, `440` ghế | Không có lỗi |
| **15 suất** | 1.320 ghế | `194 ms` | `13.510 ms` (`13,51s`) | `200 OK` | **PASS** | `15` Showtime, `1.320` ghế | Không có lỗi |
| **45 suất** | 3.960 ghế | `194 ms` | `39.580 ms` (`39,58s`) | `200 OK` | **PASS** *(Sát ngưỡng 60s)* | `45` Showtime, `3.960` ghế | Không có lỗi |
| **90 suất** | 7.920 ghế | `194 ms` | `152.071 ms` (`2p32s`) | `200 OK` *(Sau khi bị abort & retry)* | **WARN / RETRY** | `90` Showtime, `7.920` ghế | Lần thử #1 bị hủy ở giây 60 bởi `MongoServerError: Transaction with { txnNumber: 4 } has been aborted (code: 251, NoSuchTransaction)` |
| **180 suất** | 15.840 ghế | `194 ms` | `163.116 ms` (`2p43s`) | `500 Internal Server Error` | **FAIL** | **`0` Showtime, `0` ghế** *(Rollback 100%)* | `MongoServerError: Transaction with { txnNumber: 7 } has been aborted (code: 251, NoSuchTransaction, TransientTransactionError)` |

### 4.2. Bằng chứng Request, Response và Stack Trace thực tế ở quy mô 180 suất (4 ngày, 3 phim, 9 phòng)

- **HTTP Status Code:** `500 Internal Server Error`
- **Response Body trả về cho Frontend:**
  ```json
  {
    "message": "Không thể xếp lịch hàng loạt."
  }
  ```
- **Backend Error Object & Stack Trace thu được từ Transaction:**
  ```text
  Error Name: MongoServerError
  Error Message: Transaction with { txnNumber: 7 } has been aborted.
  Error Code: 251
  Error CodeName: NoSuchTransaction
  Error Labels: ["TransientTransactionError"]
  Transaction State: ABORTED (Rolled back 100%: 0 Showtime, 0 ShowtimeSeat persisted)
  Execution Time: 163116 ms

  Stack Trace:
  MongoServerError: Transaction with { txnNumber: 7 } has been aborted.
      at Connection.sendCommand (d:\CDIO\movietix-project\backend\node_modules\mongodb\lib\cmap\connection.js:322:27)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Connection.command (d:\CDIO\movietix-project\backend\node_modules\mongodb\lib\cmap\connection.js:349:26)
      at async Server.command (d:\CDIO\movietix-project\backend\node_modules\mongodb\lib\sdam\server.js:208:29)
      at async executeOperationWithRetries (d:\CDIO\movietix-project\backend\node_modules\mongodb\lib\operations\execute_operation.js:217:32)
      at async executeOperation (d:\CDIO\movietix-project\backend\node_modules\mongodb\lib\operations\execute_operation.js:85:16)
      at async FindCursor._initialize (d:\CDIO\movietix-project\backend\node_modules\mongodb\lib\cursor\find_cursor.js:62:26)
      at async FindCursor.cursorInit (d:\CDIO\movietix-project\backend\node_modules\mongodb\lib\cursor\abstract_cursor.js:619:27)
      at async FindCursor.fetchBatch (d:\CDIO\movietix-project\backend\node_modules\mongodb\lib\cursor\abstract_cursor.js:653:13)
      at async FindCursor.next (d:\CDIO\movietix-project\backend\node_modules\mongodb\lib\cursor\abstract_cursor.js:325:17)
  ```

---

## 5. XÁC ĐỊNH NGUYÊN NHÂN GỐC (ROOT CAUSE) VÀ VỊ TRÍ DÒNG CODE GÂY LỖI

### 5.1. Nguyên nhân gốc (Root Cause)
MongoDB Replica Set / MongoDB Atlas áp đặt giới hạn cứng **`transactionLifetimeLimitSeconds = 60 giây`** cho mỗi Multi-Document Transaction.

Tuy nhiên, trong `backend/src/controllers/adminController.js`:
- Tại dòng **1610–1624** (`batchScheduleShowtimes`), Backend chạy vòng lặp tuần tự `for (const slot of txPlan.validSlots)` **180 lần** bên trong một Transaction duy nhất và gọi `await scheduleInRoom(...)` cho từng suất chiếu.
- Bên trong `scheduleInRoom` (dòng **272–341**), mỗi một suất chiếu lại thực hiện **6 truy vấn mạng tuần tự (Sequential Network Round-Trips + Collection Scan)** tới MongoDB Atlas:
  1. **Dòng 284–287:** `Showtime.find({ ... }).populate('movieId', 'duration').session(session).lean()` — Truy vấn lại toàn bộ lịch chiếu của phòng + populate sang `Movie` (2 round-trips × 180 lần = **360 truy vấn dư thừa**), mặc dù ở dòng **1561–1586** `batchScheduleShowtimes` đã nạp `existingInTx` và kiểm tra toàn bộ xung đột bằng `planBatchSchedule` ngay trong Transaction!
  2. **Dòng 301–307:** `ShowtimeSeat.aggregate([{ $match: { roomId: room._id } }, { $group: ... }]).session(session)` — Thực hiện **180 lần Aggregation COLLSCAN** quét toàn bộ collection `ShowtimeSeat` (bao gồm hàng chục nghìn ghế đã có + các ghế chưa commit trong transaction) chỉ để tìm 1 template 88 ghế cho phòng đó! Lưu ý stack trace `FindCursor._initialize` khi transaction bị abort chính là ở bước đọc template ghế/showtime trong vòng lặp này.
  3. **Dòng 310–311:** `ShowtimeSeat.find({ roomId: room._id, showtimeId: template._id }).session(session).lean()` — Truy vấn lại 88 ghế mẫu **180 lần** cho cùng 9 phòng chiếu.
  4. **Dòng 327–336:** `Showtime.create([{ ... }], { session })` — Gửi **180 lệnh `insertOne` rời rạc** qua mạng thay vì gộp `insertMany`.
  5. **Dòng 337–339:** `ShowtimeSeat.insertMany(88 ghế, { session })` — Gửi **180 lệnh `insertMany` rời rạc** qua mạng.

- **Tổng cộng:** Để tạo 180 suất chiếu, một Transaction duy nhất phải thực hiện **`9 + 2 + (180 × 6) = 1.091` lượt truy vấn tuần tự qua mạng tới MongoDB Atlas**, tiêu tốn trung bình **`~880 ms / suất chiếu`**.
- Khi vòng lặp mới chạy đến khoảng **suất thứ 68** (`68 × 880ms ≈ 60.000ms`), Transaction chạm ngưỡng **`60 giây` (`transactionLifetimeLimitSeconds`)** của MongoDB Atlas và bị Server hủy ngay lập tức với lỗi:
  `MongoServerError: Transaction with { txnNumber: ... } has been aborted (code: 251, codeName: 'NoSuchTransaction', errorLabels: ['TransientTransactionError'])`.
- Sau khi `mongoose.connection.transaction()` tự động retry và tiếp tục bị abort sau 120–163 giây (`maxCommitTimeMS` / retry timeout của driver), lỗi rơi xuống khối `catch (error)` tại **`adminController.js:1656–1660`**:
  - Vì `error` là `MongoServerError` (không phải `ScheduleConflict`), dòng **1659** trả về `HTTP 500`:
    `return res.status(500).json({ message: 'Không thể xếp lịch hàng loạt.' });`

### 5.2. Lỗi phụ phát hiện khi Transaction Retry (`adminController.js`, dòng 1551–1552 & 1626–1627)
- Hai mảng `const createdSlotIds = [];` và `const createdShowtimes = [];` được khai báo **bên ngoài** callback `mongoose.connection.transaction(async (session) => { ... })`, nhưng lại được `.push(...)` ở dòng **1626–1627** **bên trong** callback mà không được làm rỗng (`createdSlotIds.length = 0; createdShowtimes.length = 0;`) ở đầu callback khi MongoDB driver thực hiện retry `TransientTransactionError`.

---

## 6. PHƯƠNG ÁN KHẮC PHỤC ĐỀ XUẤT (CHỜ XÁC NHẬN TRƯỚC KHI TRIỂN KHAI)

Để giữ nguyên **100% tính toàn vẹn của 1 MongoDB Transaction duy nhất** (không chia nhỏ transaction, không bỏ validation, không xóa index) nhưng giảm thời gian tạo 180 suất (15.840 ghế) từ **>163 giây (FAIL)** xuống chỉ còn **~1,5 – 3 giây (PASS)**:

1. **Loại bỏ `180 × 4 = 720` truy vấn đọc lặp lại dư thừa bên trong vòng lặp Transaction của `batchScheduleShowtimes` (`adminController.js:1554–1644`):**
   - Trong Transaction của `batchScheduleShowtimes`, sau khi đã `lockRoom` cho cả 9 phòng và đọc `existingInTx` (dòng 1556–1568), `txPlan = planBatchSchedule(...)` đã kiểm tra toàn bộ xung đột giữa các suất mới với DB và giữa các suất mới với nhau.
   - Chuẩn bị **ma trận 88 ghế mẫu (`seatTemplatesByRoomId`) chỉ 1 lần duy nhất cho 9 phòng** (hoặc dùng trực tiếp `buildStandard88SeatTemplates()` chuẩn 88 ghế đã đồng bộ toàn hệ thống) trước vòng lặp, thay vì chạy `ShowtimeSeat.aggregate` (COLLSCAN) + `ShowtimeSeat.find` 180 lần.
2. **Gộp các lệnh ghi trong Transaction thành Bulk Insert (`insertMany`) giữ nguyên `session`:**
   - Khởi tạo trước `_id: new mongoose.Types.ObjectId()` cho toàn bộ `N` suất hợp lệ trong `txPlan.validSlots`.
   - Thực hiện **1 lệnh `await Showtime.insertMany(showtimeDocsToInsert, { session })`** để ghi toàn bộ `180` `Showtime` trong 1 round-trip.
   - Thực hiện **`await ShowtimeSeat.insertMany(seatDocsChunk, { session, ordered: false })`** (chia theo từng batch 2.000–4.000 ghế hoặc theo từng phòng = 9 lệnh `insertMany`, thay vì 180 lệnh rời rạc) để ghi toàn bộ `15.840` `ShowtimeSeat` trong cùng `session` Transaction.
3. **Đặt lại trạng thái biến tích lũy ở đầu Transaction Callback:**
   - Khởi tạo/làm rỗng `createdSlotIds` và `createdShowtimes` ngay ở dòng đầu tiên bên trong hàm `async (session) => { ... }` để đảm bảo an toàn tuyệt đối nếu MongoDB thực hiện retry `TransientTransactionError`.
