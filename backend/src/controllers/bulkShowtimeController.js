import { getCancellationRefundUpdate } from '../services/bookingRefundService.js';
import mongoose from 'mongoose';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Movie from '../models/Movie.js';
import AuditLog from '../models/AuditLog.js';
import { businessDate } from '../services/bookingPolicy.js';
import { computeShowtimeLifecycle } from '../services/showtimeLifecycleService.js';

// Cache in-memory cho Preview token (15 phút TTL)
const _bulkPreviewCache = new Map();

// Helper khóa phòng ghi nhận revision
async function lockRoomForDelete(roomId, session) {
  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) return null;
  const room = await Room.findOneAndUpdate(
    { _id: roomId, status: 'ACTIVE' },
    { $inc: { scheduleRevision: 1 } },
    { new: true, session }
  );
  return room;
}

/**
 * 1. PREVIEW XÓA HÀNG LOẠT (READ-ONLY)
 * POST /api/admin/showtimes/bulk-delete/preview
 */
export const previewBulkDeleteShowtimes = async (req, res) => {
  try {
    const { showtimeIds, queryCondition } = req.body;

    let targetIds = [];
    if (Array.isArray(showtimeIds) && showtimeIds.length > 0) {
      targetIds = [...new Set(showtimeIds.filter(id => mongoose.Types.ObjectId.isValid(id)))];
    } else if (queryCondition && typeof queryCondition === 'object') {
      const match = {};
      if (queryCondition.startDate && queryCondition.endDate) {
        match.startTime = {
          $gte: new Date(`${queryCondition.startDate}T00:00:00+07:00`),
          $lte: new Date(`${queryCondition.endDate}T23:59:59.999+07:00`),
        };
      }
      if (queryCondition.movieId && mongoose.Types.ObjectId.isValid(queryCondition.movieId)) {
        match.movieId = new mongoose.Types.ObjectId(queryCondition.movieId);
      }
      if (queryCondition.roomId && mongoose.Types.ObjectId.isValid(queryCondition.roomId)) {
        match.roomId = new mongoose.Types.ObjectId(queryCondition.roomId);
      }
      if (queryCondition.batchId) {
        match.batchId = queryCondition.batchId;
      }
      const matched = await Showtime.find(match).select('_id').limit(500).lean();
      targetIds = matched.map(s => s._id.toString());
    }

    if (targetIds.length === 0) {
      return res.status(400).json({ message: 'Danh sách suất chiếu cần kiểm tra trống hoặc không hợp lệ.' });
    }

    if (targetIds.length > 300) {
      return res.status(400).json({ message: 'Tối đa kiểm tra 300 suất chiếu mỗi lần thao tác.' });
    }

    const objectIds = targetIds.map(id => new mongoose.Types.ObjectId(id));

    // Truy vấn song song dữ liệu suất chiếu, bookings và ghế liên quan
    const [showtimes, bookings, activeSeats] = await Promise.all([
      Showtime.find({ _id: { $in: objectIds } })
        .populate('movieId', 'title duration poster posterUrl')
        .populate('roomId', 'name roomType formatFeature totalSeats')
        .lean(),
      Booking.find({ showtimeId: { $in: objectIds } })
        .select('showtimeId bookingCode status paymentStatus isCheckedIn createdAt')
        .lean(),
      ShowtimeSeat.find({
        showtimeId: { $in: objectIds },
        status: { $in: ['BOOKED', 'HOLDING'] },
      }).select('showtimeId status holdExpiresAt').lean(),
    ]);

    const bookingsBySt = new Map();
    for (const b of bookings) {
      const stId = b.showtimeId.toString();
      if (!bookingsBySt.has(stId)) bookingsBySt.set(stId, []);
      bookingsBySt.get(stId).push(b);
    }

    const activeSeatsBySt = new Map();
    for (const s of activeSeats) {
      const stId = s.showtimeId.toString();
      if (!activeSeatsBySt.has(stId)) activeSeatsBySt.set(stId, []);
      activeSeatsBySt.get(stId).push(s);
    }

    const eligibleSlots = [];
    const blockedSlots = [];
    const now = new Date();

    for (const st of showtimes) {
      const stId = st._id.toString();
      const stStart = new Date(st.startTime);
      const movieTitle = st.movieId?.title || 'Phim đã chọn';
      const roomName = st.roomId?.name || st.roomName || 'Phòng chiếu';
      const roomType = st.roomId?.roomType || 'Tiêu chuẩn';
      const bks = bookingsBySt.get(stId) || [];
      const seats = activeSeatsBySt.get(stId) || [];
      const lifecycle = computeShowtimeLifecycle(st, now);

      // Kiểm tra các điều kiện an toàn nghiêm ngặt
      let blockReason = null;

      if (st.cancelledAt) {
        blockReason = 'Suất chiếu đã bị hủy trước đó.';
      } else if (bks.some(b => b.isCheckedIn)) {
        blockReason = 'Đã có vé check-in vào phòng chiếu.';
      } else if (bks.some(b => ['PAID', 'PENDING', 'EXCHANGED'].includes(b.status))) {
        const paidCount = bks.filter(b => b.status === 'PAID').length;
        blockReason = `Đã có ${bks.length} đơn đặt vé (${paidCount} đơn đã thanh toán).`;
      } else if (bks.some(b => b.status === 'CANCELLED')) {
        blockReason = `Có ${bks.length} đơn đặt vé đã hủy, cần bảo tồn dữ liệu kế toán và đối soát.`;
      } else if (seats.some(s => s.status === 'BOOKED')) {
        blockReason = 'Dữ liệu ghế ghi nhận trạng thái đã đặt.';
      } else if (seats.some(s => s.status === 'HOLDING' && (!s.holdExpiresAt || new Date(s.holdExpiresAt) > now))) {
        blockReason = 'Có ghế đang được khách hàng giữ chỗ trong phiên đặt vé.';
      } else if (lifecycle.lifecycleStatus === 'NOW_SHOWING') {
        blockReason = 'Suất chiếu đang diễn ra trong phòng chiếu.';
      } else if (lifecycle.lifecycleStatus === 'CLEANING') {
        blockReason = 'Phòng chiếu đang trong thời gian vệ sinh sau suất chiếu.';
      }

      const slotItem = {
        id: stId,
        showtimeId: stId,
        movieId: st.movieId?._id || st.movieId,
        movieTitle,
        poster: st.movieId?.poster || st.movieId?.posterUrl || '',
        roomId: st.roomId?._id || st.roomId,
        roomName,
        roomType,
        formatFeature: st.formatFeature || '',
        startTime: st.startTime,
        endTime: lifecycle.endTime,
        cleaningEndTime: lifecycle.cleaningEndTime,
        lifecycleStatus: lifecycle.lifecycleStatus,
        price: st.price,
        totalSeats: st.roomId?.totalSeats || 88,
        batchId: st.batchId || null,
        creationSource: st.creationSource || 'MANUAL',
      };

      if (blockReason) {
        blockedSlots.push({
          ...slotItem,
          reason: blockReason,
          bookingCount: bks.length,
          status: 'BLOCKED',
        });
      } else {
        eligibleSlots.push({
          ...slotItem,
          status: 'ELIGIBLE',
        });
      }
    }

    const previewId = 'PREV-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 phút hiệu lực

    _bulkPreviewCache.set(previewId, {
      adminId: (req.admin?._id || req.user?._id)?.toString() || 'ADMIN',
      eligibleIds: eligibleSlots.map(s => s.id),
      blockedIds: blockedSlots.map(s => s.id),
      createdAt: Date.now(),
      expiresAt,
    });

    const totalSeatsToRelease = eligibleSlots.reduce((sum, s) => sum + (s.totalSeats || 88), 0);

    return res.json({
      success: true,
      previewId,
      createdAt: new Date(),
      expiresAt: new Date(expiresAt),
      totalSelected: targetIds.length,
      eligibleCount: eligibleSlots.length,
      blockedCount: blockedSlots.length,
      totalSeatsToRelease,
      eligibleSlots,
      blockedSlots,
      summary: {
        total: targetIds.length,
        eligible: eligibleSlots.length,
        blocked: blockedSlots.length,
        totalSeats: totalSeatsToRelease,
      },
    });
  } catch (error) {
    console.error('Lỗi khi preview xóa hàng loạt:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi kiểm tra danh sách xóa: ' + error.message });
  }
};

/**
 * 2. COMMIT XÓA HÀNG LOẠT (PER-SLOT TRANSACTIONS + IDEMPOTENCY)
 * POST /api/admin/showtimes/bulk-delete/commit
 */
export const commitBulkDeleteShowtimes = async (req, res) => {
  try {
    const { previewId, confirmedIds, requestId, reason, batchId } = req.body;

    if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
      return res.status(400).json({ message: 'Mã yêu cầu requestId là bắt buộc để đảm bảo an toàn.' });
    }

    // Chống thực thi trùng lặp bền vững qua AuditLog trong MongoDB
    const existingLog = await AuditLog.findOne({ requestId: requestId.trim() }).lean();
    if (existingLog) {
      return res.status(200).json({
        success: true,
        isIdempotentReplay: true,
        message: 'Yêu cầu này đã được xử lý trước đó (kết quả trả về nhất quán).',
        ...existingLog.details,
      });
    }

    if (!Array.isArray(confirmedIds) || confirmedIds.length === 0) {
      return res.status(400).json({ message: 'Danh sách suất chiếu xác nhận xóa trống.' });
    }

    // Xác minh Preview Token
    const preview = _bulkPreviewCache.get(previewId);
    if (!preview) {
      return res.status(410).json({ message: 'Phiên xem trước (Preview) đã hết hạn hoặc không tồn tại. Vui lòng thực hiện kiểm tra lại.' });
    }

    if (Date.now() > preview.expiresAt) {
      _bulkPreviewCache.delete(previewId);
      return res.status(410).json({ message: 'Phiên xem trước đã hết thời gian hiệu lực (15 phút). Vui lòng tạo lại preview.' });
    }

    // Đảm bảo toàn bộ ID trong confirmedIds phải nằm trong danh sách ĐÃ ĐƯỢC PHÊ DUYỆT BỞI PREVIEW
    const approvedSet = new Set(preview.eligibleIds);
    const unapprovedIds = confirmedIds.filter(id => !approvedSet.has(id));
    if (unapprovedIds.length > 0) {
      return res.status(400).json({
        message: 'Phát hiện suất chiếu chưa qua kiểm tra an toàn trong Preview. Không được phép xóa.',
        unapprovedCount: unapprovedIds.length,
      });
    }

    const deletedIds = [];
    const skippedItems = [];
    const failedItems = [];
    const deletedShowtimesInfo = [];

    // Duyệt qua từng suất chiếu: mỗi suất chiếu thực hiện trong 1 Transaction độc lập
    for (const id of confirmedIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        skippedItems.push({ id, reason: 'ID không hợp lệ' });
        continue;
      }

      try {
        const slotResult = await mongoose.connection.transaction(async (session) => {
          const txNow = new Date();
          // 1. Tái xác minh suất chiếu ngay tại thời điểm ghi
          const slot = await Showtime.findById(id).populate('movieId', 'title duration').session(session);
          if (!slot) {
            return { skipped: true, reason: 'Suất chiếu không còn tồn tại hoặc đã được xóa.' };
          }

          const lifecycle = computeShowtimeLifecycle(slot, txNow);
          if (slot.cancelledAt) {
            return { skipped: true, reason: 'Suất chiếu đã bị hủy trước đó.' };
          }
          if (lifecycle.lifecycleStatus === 'NOW_SHOWING') {
            return { skipped: true, reason: 'Suất chiếu đang diễn ra trong phòng chiếu.' };
          }
          if (lifecycle.lifecycleStatus === 'CLEANING') {
            return { skipped: true, reason: 'Phòng chiếu đang trong thời gian vệ sinh sau suất chiếu.' };
          }

          // 2. Tái xác minh Booking ngay trong Transaction
          const bookingCount = await Booking.countDocuments({ showtimeId: slot._id }).session(session);
          if (bookingCount > 0) {
            return { skipped: true, reason: 'Suất chiếu vừa phát sinh đơn đặt vé, đã được bỏ qua để bảo vệ khách hàng.' };
          }

          // 3. Tái xác minh ghế BOOKED hoặc HOLDING còn hiệu lực
          const activeSeatCount = await ShowtimeSeat.countDocuments({
            showtimeId: slot._id,
            $or: [
              { status: 'BOOKED' },
              {
                status: 'HOLDING',
                $or: [{ holdExpiresAt: null }, { holdExpiresAt: { $gt: txNow } }],
              },
            ],
          }).session(session);
          if (activeSeatCount > 0) {
            return { skipped: true, reason: 'Ghế phòng chiếu vừa được khách hàng đặt hoặc đang giữ chỗ, bỏ qua để bảo vệ khách hàng.' };
          }

          // 4. Khóa phòng chiếu ghi nhận revision
          if (slot.roomId) {
            await lockRoomForDelete(slot.roomId, session);
          }

          // 5. Xóa sạch ghế và xóa suất chiếu
          const seatDeleteResult = await ShowtimeSeat.deleteMany({ showtimeId: slot._id }, { session });
          await Showtime.deleteOne({ _id: slot._id }, { session });

          return {
            deleted: true,
            info: {
              showtimeId: String(slot._id),
              movieTitle: slot.movieId?.title || slot.roomName || 'Phim',
              roomName: slot.roomName,
              startTime: slot.startTime,
              totalSeats: seatDeleteResult.deletedCount,
            },
          };
        });

        if (slotResult.deleted) {
          deletedIds.push(id);
          deletedShowtimesInfo.push(slotResult.info);
        } else if (slotResult.skipped) {
          skippedItems.push({ id, reason: slotResult.reason });
        }
      } catch (err) {
        console.error(`Lỗi khi xóa suất ${id}:`, err);
        failedItems.push({ id, reason: err.message || 'Lỗi giao dịch Transaction' });
      }
    }

    const resultPayload = {
      requestedCount: confirmedIds.length,
      deletedCount: deletedIds.length,
      skippedCount: skippedItems.length,
      failedCount: failedItems.length,
      deletedIds,
      skippedItems,
      failedItems,
      requestId,
    };

    // Ghi nhật ký thao tác bền vững vào AuditLog (phục vụ đối soát và Idempotency)
    const auditRecord = await AuditLog.create({
      adminId: req.admin?._id || req.user?._id || null,
      adminEmail: req.admin?.email || req.user?.email || 'admin@davenor.vn',
      actionType: batchId ? 'UNDO_BATCH' : 'BULK_DELETE',
      requestId: requestId.trim(),
      batchId: batchId || null,
      showtimeIds: confirmedIds.map(id => new mongoose.Types.ObjectId(id)),
      deletedShowtimesInfo,
      reason: reason || 'Xóa hàng loạt lịch thiết lập sai',
      resultSummary: {
        requestedCount: confirmedIds.length,
        deletedCount: deletedIds.length,
        skippedCount: skippedItems.length,
        failedCount: failedItems.length,
      },
      details: resultPayload,
    });

    // Xóa preview sau khi hoàn tất
    _bulkPreviewCache.delete(previewId);

    return res.status(200).json({
      success: true,
      message: `Đã xóa thành công ${deletedIds.length}/${confirmedIds.length} suất chiếu an toàn.`,
      auditLogId: auditRecord._id,
      ...resultPayload,
    });
  } catch (error) {
    console.error('Lỗi khi commit xóa hàng loạt:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi thực hiện xóa hàng loạt: ' + error.message });
  }
};

/**
 * 3. TRUY VẤN SUẤT CHIẾU THEO ĐIỀU KIỆN NÂNG CAO (CHO MODAL CHỌN NHANH)
 * POST /api/admin/showtimes/query-condition
 */
export const queryShowtimesByCondition = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      movieIds,
      roomIds,
      roomType,
      timeFrom,
      timeTo,
      batchId,
      status,
    } = req.body;

    const filter = {
      cancelledAt: null,
    };

    if (startDate && endDate) {
      filter.startTime = {
        $gte: new Date(`${startDate}T00:00:00+07:00`),
        $lte: new Date(`${endDate}T23:59:59.999+07:00`),
      };
    }

    if (Array.isArray(movieIds) && movieIds.length > 0) {
      filter.movieId = { $in: movieIds.filter(id => mongoose.Types.ObjectId.isValid(id)) };
    }

    if (Array.isArray(roomIds) && roomIds.length > 0) {
      filter.roomId = { $in: roomIds.filter(id => mongoose.Types.ObjectId.isValid(id)) };
    }

    if (batchId && typeof batchId === 'string' && batchId.trim()) {
      filter.batchId = batchId.trim();
    }

    if (status === 'LOCKED') {
      filter.isLocked = true;
    } else if (status === 'UNLOCKED') {
      filter.isLocked = { $ne: true };
    }

    const showtimes = await Showtime.find(filter)
      .populate('movieId', 'title duration poster posterUrl')
      .populate('roomId', 'name roomType formatFeature totalSeats')
      .sort({ startTime: 1 })
      .lean();

    // Lọc phụ theo roomType và giờ chiếu (timeFrom, timeTo) nếu có
    const filtered = showtimes.filter((st) => {
      if (roomType && roomType !== 'ALL') {
        const rType = st.roomId?.roomType || '';
        if (!rType.includes(roomType)) return false;
      }

      if (timeFrom || timeTo) {
        const stDate = new Date(st.startTime);
        const timeStr = stDate.toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
        if (timeFrom && timeStr < timeFrom) return false;
        if (timeTo && timeStr > timeTo) return false;
      }

      return true;
    });

    const showtimeIds = filtered.map(s => s._id.toString());

    return res.json({
      success: true,
      count: filtered.length,
      showtimeIds,
      showtimes: filtered.map(s => ({
        id: s._id.toString(),
        movieTitle: s.movieId?.title || 'Phim',
        roomName: s.roomId?.name || s.roomName,
        roomType: s.roomId?.roomType || 'Tiêu chuẩn',
        startTime: s.startTime,
        endTime: s.endTime,
        batchId: s.batchId || null,
        isLocked: s.isLocked,
      })),
    });
  } catch (error) {
    console.error('Lỗi khi truy vấn suất chiếu theo điều kiện:', error);
    return res.status(500).json({ message: 'Lỗi truy vấn điều kiện: ' + error.message });
  }
};

/**
 * 4. XÓA ĐƠN LẺ AN TOÀN CÓ TRANSACTION (SỬA LỖI ĐƠN LẺ)
 * DELETE /api/admin/showtimes/:id
 */
export const deleteShowtimeSafe = async (req, res) => {
  const { id } = req.params;
  const { action, reason } = req.body || {};

  if (!mongoose.isObjectIdOrHexString(id)) return res.sendStatus(400);

  try {
    const outcome = await mongoose.connection.transaction(async (session) => {
      const slot = await Showtime.findById(id).populate('movieId', 'title').session(session);
      if (!slot) return { status: 404, message: 'Không tìm thấy suất chiếu cần xóa.' };
      if (slot.cancelledAt || slot.lifecycleStatus === 'CANCELLED') {
        return {
          success: true, alreadyCancelled: true, deletedCompletely: false, affectedOrdersCount: 0,
          message: 'Suất chiếu này đã được hủy trước đó.',
        };
      }

      const orders = await Booking.find({
        showtimeId: slot._id,
        status: { $in: ['PAID', 'EXCHANGED', 'PENDING'] },
      }).session(session).lean();
      const actor = {
        adminId: req.user?._id || null,
        adminEmail: req.user?.email || 'admin@davenor.vn',
        showtimeIds: [slot._id],
      };

      if (!orders.length) {
        const holdingCount = await ShowtimeSeat.countDocuments({
          showtimeId: slot._id,
          status: 'HOLDING',
          holdExpiresAt: { $gt: new Date() },
        }).session(session);
        if (holdingCount > 0) {
          return {
            status: 409, hasActiveHolds: true, holdingCount,
            message: 'Không thể xóa hoàn toàn: Suất chiếu đang có ghế được khách giữ tạm thời.',
          };
        }

        if (slot.roomId) await lockRoomForDelete(slot.roomId, session);
        await Showtime.deleteOne({ _id: slot._id }, { session });
        await ShowtimeSeat.deleteMany({ showtimeId: slot._id }, { session });
        await AuditLog.create([{
          ...actor,
          actionType: 'SINGLE_DELETE',
          deletedShowtimesInfo: [{
            showtimeId: String(slot._id),
            movieTitle: slot.movieId?.title || slot.roomName,
            roomName: slot.roomName,
            startTime: slot.startTime,
          }],
          reason: reason || 'Xóa suất chiếu chưa có giao dịch',
          resultSummary: { requestedCount: 1, deletedCount: 1, skippedCount: 0, failedCount: 0 },
        }], { session });
        return { success: true, deletedCompletely: true, message: 'Đã xóa suất chiếu và giải phóng ghế.' };
      }

      if (action !== 'CANCEL_WITH_REFUND') {
        return {
          status: 409, hasBookings: true, ordersCount: orders.length,
          message: 'Suất chiếu đã có đơn đặt vé. Vui lòng sử dụng chức năng Hủy suất chiếu.',
        };
      }
      if (orders.some((order) => order.isCheckedIn)) {
        return { status: 409, message: 'Không thể hủy suất chiếu: Đã có vé được check-in.' };
      }

      await Showtime.updateOne({ _id: slot._id }, {
        $set: {
          isLocked: true,
          cancelledAt: new Date(),
          lifecycleStatus: 'CANCELLED',
          cancelReason: reason || 'Hủy bởi Admin quản lý rạp',
        },
      }, { session });

      for (const order of orders) {
        const newRefund = getCancellationRefundUpdate(order);
        await Booking.updateOne({ _id: order._id }, {
          $set: { status: 'CANCELLED', qrToken: null, ...newRefund },
        }, { session });
      }

      await ShowtimeSeat.updateMany({ showtimeId: slot._id }, {
        $set: {
          status: 'AVAILABLE',
          bookingId: null,
          holdId: null,
          holdOwnerId: null,
          holdCreatedAt: null,
          holdExpiresAt: null,
        },
      }, { session });

      await AuditLog.create([{
        ...actor,
        actionType: 'CANCEL_SHOWTIME',
        reason: reason || 'Hủy suất chiếu đã bán vé',
        resultSummary: { requestedCount: 1, deletedCount: 0, skippedCount: 0, failedCount: 0 },
        details: { affectedOrdersCount: orders.length },
      }], { session });

      return {
        success: true,
        deletedCompletely: false,
        affectedOrdersCount: orders.length,
        affectedOrders: orders.map((order) => order.bookingCode),
        message: 'Đã hủy suất chiếu và ghi nhận trạng thái hoàn tiền của các đơn bị ảnh hưởng.',
      };
    });

    const { status = 200, ...payload } = outcome;
    return res.status(status).json(payload);
  } catch (error) {
    console.error('Lỗi khi xóa suất chiếu:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi xóa suất chiếu: ' + error.message });
  }
};
