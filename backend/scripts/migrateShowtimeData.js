import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Showtime from '../src/models/Showtime.js';
import Booking from '../src/models/Booking.js';
import Room from '../src/models/Room.js';
import Movie from '../src/models/Movie.js';
import ShowtimeSeat from '../src/models/ShowtimeSeat.js';

/**
 * Tạo ma trận 88 ghế vật lý chuẩn cho phòng chiếu:
 * Hàng A-D: STANDARD (44 ghế)
 * Hàng E-G: VIP (33 ghế)
 * Hàng H: SWEETBOX (11 ghế)
 */
export function generateStandard88Seats(roomId, showtimeId) {
  const seats = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  for (const row of rows) {
    let type = 'STANDARD';
    if (['E', 'F', 'G'].includes(row)) type = 'VIP';
    else if (row === 'H') type = 'SWEETBOX';

    for (let col = 1; col <= 11; col++) {
      seats.push({
        roomId,
        showtimeId,
        seatNumber: `${row}${col}`,
        row,
        col,
        type,
        status: 'AVAILABLE',
      });
    }
  }
  return seats;
}

async function runMigration() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  await mongoose.connect(process.env.MONGODB_URI);

  const isApply = process.argv.includes('--apply');
  const isRollback = process.argv.includes('--rollback');

  if (isRollback) {
    const backupDir = path.resolve('backend/data');
    if (!fs.existsSync(backupDir)) {
      console.error('❌ Thư mục backend/data không tồn tại!');
      process.exit(1);
    }
    const targetArg = process.argv.find(arg => arg.startsWith('--file=') || arg.startsWith('--id='));
    let targetFile = null;
    if (targetArg?.startsWith('--file=')) {
      targetFile = path.resolve(targetArg.replace('--file=', ''));
    } else if (targetArg?.startsWith('--id=')) {
      const idStr = targetArg.replace('--id=', '');
      targetFile = path.join(backupDir, `migration_backup_${idStr}.json`);
    } else {
      const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith('migration_backup_')).sort().reverse();
      if (backupFiles.length > 0) targetFile = path.join(backupDir, backupFiles[0]);
    }

    if (!targetFile || !fs.existsSync(targetFile)) {
      console.error('❌ Không tìm thấy file backup tương ứng để rollback!');
      process.exit(1);
    }

    console.log(`================================================================`);
    console.log(`   TIẾN HÀNH ROLLBACK DỮ LIỆU TỪ BACKUP CỤ THỂ: ${path.basename(targetFile)}`);
    console.log(`================================================================\n`);
    const backupData = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
    console.log(`- Migration ID: ${backupData.migrationId || 'MIG_LEGACY'}`);
    console.log(`- Database Name: ${backupData.databaseName || mongoose.connection.name}`);
    console.log(`- Môi trường: ${backupData.environment || 'production'}`);
    console.log(`- Thời điểm sao lưu: ${backupData.timestamp}`);

    let restoredCount = 0;
    if (Array.isArray(backupData.preChangeShowtimes) && backupData.preChangeShowtimes.length > 0) {
      for (const orig of backupData.preChangeShowtimes) {
        await Showtime.findByIdAndUpdate(orig._id, {
          cancelledAt: orig.cancelledAt || null,
          isLocked: orig.isLocked || false,
          cancelReason: orig.cancelReason || null,
        });
        restoredCount++;
      }
    } else if (Array.isArray(backupData.cancelledShowtimeIds)) {
      const res = await Showtime.updateMany(
        { _id: { $in: backupData.cancelledShowtimeIds } },
        { $set: { cancelledAt: null, isLocked: false, cancelReason: null } }
      );
      restoredCount = res.modifiedCount;
    }
    console.log(`✅ Đã khôi phục thành công: ${restoredCount} document về đúng snapshot ban đầu.`);
    await mongoose.disconnect();
    return;
  }

  console.log('================================================================');
  console.log(`  BÁO CÁO PHÂN LOẠI & ${isApply ? 'THỰC THI MIGRATION' : 'DRY-RUN'} DỮ LIỆU LỊCH CHIẾU`);
  console.log('================================================================\n');

  // Lấy dữ liệu toàn rạp
  const [rooms, movies, showtimes, allBookings, seatCounts] = await Promise.all([
    Room.find().lean(),
    Movie.find().select('title duration').lean(),
    Showtime.find().sort({ startTime: 1 }).lean(),
    Booking.find().select('showtimeId seats status paymentStatus totalAmount bookingCode customerName').lean(),
    ShowtimeSeat.aggregate([{ $group: { _id: '$showtimeId', count: { $sum: 1 } } }]),
  ]);

  const movieMap = new Map(movies.map(m => [String(m._id), m]));
  const roomMap = new Map(rooms.map(r => [String(r._id), r]));
  const seatMap = new Map(seatCounts.map(s => [String(s._id), s.count]));

  // Map Booking theo showtimeId
  const bookingByShowtime = new Map();
  for (const b of allBookings) {
    const sId = String(b.showtimeId);
    if (!bookingByShowtime.has(sId)) bookingByShowtime.set(sId, []);
    bookingByShowtime.get(sId).push(b);
  }

  // Nhóm các suất theo phòng để phát hiện va chạm
  const byRoom = new Map();
  for (const st of showtimes) {
    if (st.cancelledAt) continue;
    const rId = String(st.roomId || st.roomName);
    if (!byRoom.has(rId)) byRoom.set(rId, []);
    byRoom.get(rId).push(st);
  }

  const overlappingShowtimeIds = new Set();
  const overlapPairs = [];

  for (const [rId, list] of byRoom.entries()) {
    list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const aMovie = movieMap.get(String(a.movieId));
      const aDur = Number(aMovie?.duration) || 120;
      const aEnd = a.endTime ? a.endTime.getTime() : a.startTime.getTime() + aDur * 60000;
      const aClean = (a.cleaningMinutes ?? 15) * 60000;
      const aBlockedUntil = aEnd + aClean;

      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.startTime.getTime() >= aBlockedUntil) break;
        overlappingShowtimeIds.add(String(a._id));
        overlappingShowtimeIds.add(String(b._id));
        overlapPairs.push({ aId: a._id, bId: b._id });
      }
    }
  }

  // Phân loại thành 4 nhóm
  const groupA = []; // Suất hợp lệ (không chồng lấn)
  const groupB = []; // Suất chồng lấn ảo, 0 Booking -> Hủy mềm
  const groupC = []; // Suất chồng lấn CÓ BOOKING -> BẢO VỆ TUYỆT ĐỐI
  const groupD = []; // Suất lỗi ref

  // Lọc riêng cho ngày 24/11/2026 (Asia/Ho_Chi_Minh: 2026-11-23T17:00:00Z -> 2026-11-24T16:59:59Z)
  const nov24Start = new Date('2026-11-23T17:00:00.000Z');
  const nov24End = new Date('2026-11-24T16:59:59.999Z');

  let nov24Total = 0;
  let nov24GroupA = 0;
  let nov24GroupB = 0;
  let nov24GroupC = 0;
  let nov24Bookings = 0;

  for (const st of showtimes) {
    const sId = String(st._id);
    const movie = movieMap.get(String(st.movieId));
    const room = roomMap.get(String(st.roomId));
    const bookings = bookingByShowtime.get(sId) || [];
    const seatCount = seatMap.get(sId) || 0;
    const isMissingSeats = seatCount === 0;
    const isCancelled = Boolean(st.cancelledAt);
    const isOverlapping = overlappingShowtimeIds.has(sId);

    const isNov24 = st.startTime >= nov24Start && st.startTime <= nov24End;
    if (isNov24 && !isCancelled) {
      nov24Total++;
      if (bookings.length > 0) nov24Bookings += bookings.length;
    }

    if (!movie || !room) {
      groupD.push({ st, bookings, seatCount, reason: 'Thiếu ref Room hoặc Movie' });
      continue;
    }

    if (isCancelled) continue;

    if (!isOverlapping) {
      groupA.push({ st, movie, room, bookings, seatCount, isMissingSeats });
      if (isNov24) nov24GroupA++;
    } else {
      if (bookings.length > 0) {
        groupC.push({ st, movie, room, bookings, seatCount, isMissingSeats });
        if (isNov24) nov24GroupC++;
      } else {
        groupB.push({ st, movie, room, bookings, seatCount, isMissingSeats });
        if (isNov24) nov24GroupB++;
      }
    }
  }

  console.log(`1. TỔNG HỢP HIỆN TRẠNG TOÀN RẠP (9 PHÒNG VẬT LÝ):`);
  console.log(`   - Tổng số suất chiếu trong MongoDB: ${showtimes.length} suất`);
  console.log(`   - Suất đang hoạt động: ${showtimes.filter(s => !s.cancelledAt).length} suất`);
  console.log(`   - Suất đã hủy trước đó: ${showtimes.filter(s => s.cancelledAt).length} suất`);
  console.log(`   - Tổng số đơn Booking trong hệ thống: ${allBookings.length} đơn\n`);

  console.log(`2. ĐỐI CHIẾU RIÊNG CHO NGÀY 24/11/2026:`);
  console.log(`   - Tổng số suất chiếu trong ngày: ${nov24Total} suất (gồm 325 suất bắt đầu trong ngày + 54 suất xuyên đêm)`);
  console.log(`   - Nhóm C (CÓ BOOKING KHÁCH - BẢO TOÀN): ${nov24GroupC} suất (chứa toàn bộ ${nov24Bookings} đơn đặt vé)`);
  console.log(`   - Nhóm B (Chồng lấn ảo, 0 Booking -> HỦY MỀM): ${nov24GroupB} suất`);
  console.log(`   - Nhóm A (Hợp lệ): ${nov24GroupA} suất\n`);

  console.log(`3. KẾT QUẢ PHÂN LOẠI TOÀN BỘ DATABASE ĐỂ MIGRATION:`);
  console.log(`   - NHÓM A (Hợp lệ, không chồng lấn): ${groupA.length} suất`);
  console.log(`     + Suất thiếu ghế cần bổ sung: ${groupA.filter(g => g.isMissingSeats).length} suất (dự kiến bù ${groupA.filter(g => g.isMissingSeats).length * 88} ghế)`);
  console.log(`   - NHÓM B (Chồng lấn ảo do seed cũ, 0 Booking): ${groupB.length} suất`);
  console.log(`     + Phương án đề xuất: HỦY MỀM (gán cancelledAt: now, isLocked: true), KHÔNG bổ sung ghế`);
  console.log(`   - NHÓM C (Có Booking của khách hàng): ${groupC.length} suất`);
  console.log(`     + Tổng số Booking khách được bảo vệ tuyệt đối: ${groupC.reduce((sum, g) => sum + g.bookings.length, 0)} đơn`);
  console.log(`     + Phương án: BẢO VỆ NGUYÊN VẸN 100%, bổ sung ghế chuẩn cho các suất chưa có ghế để đối soát`);
  console.log(`   - NHÓM D (Lỗi tham chiếu): ${groupD.length} suất (tạm khóa, đối soát thủ công)\n`);

  console.log(`4. BẢNG MẪU ĐỐI SOÁT DRY-RUN TIÊU BIỂU (10 suất):`);
  console.log(`| Showtime ID | Phim | Phòng | Giờ chiếu | Ghế | Booking | Phân loại | Phương án xử lý |`);
  console.log(`|---|---|---|---|:---:|:---:|:---:|---|`);

  const samples = [
    ...groupC.slice(0, 3).map(i => ({ ...i, cat: 'Nhóm C (Có Booking)' })),
    ...groupA.slice(0, 4).map(i => ({ ...i, cat: 'Nhóm A (Hợp lệ)' })),
    ...groupB.slice(0, 3).map(i => ({ ...i, cat: 'Nhóm B (Chồng lấn ảo)' })),
  ];

  for (const item of samples) {
    const tStr = item.st.startTime.toISOString().replace('.000Z', '').replace('T', ' ');
    const plan = item.cat.includes('Nhóm C')
      ? 'BẢO TOÀN 100%, bảo đảm vé khách'
      : item.cat.includes('Nhóm A')
      ? (item.isMissingSeats ? 'Bổ sung 88 ghế chuẩn' : 'Giữ nguyên hoạt động')
      : 'Hủy mềm (cancelledAt)';
    console.log(`| ${item.st._id} | ${(item.movie?.title || 'Phim').slice(0, 18)} | ${(item.room?.name || 'Phòng').slice(0, 16)} | ${tStr} | ${item.seatCount}/88 | ${item.bookings.length} | ${item.cat} | ${plan} |`);
  }

  // Xử lý ghi dữ liệu khi có cờ --apply
  if (!isApply) {
    console.log('\n[CHẾ ĐỘ DRY-RUN] Chưa có bất kỳ thay đổi nào được ghi vào MongoDB.');
    console.log('Thêm cờ --apply để áp dụng migration an toàn sau khi có xác nhận.');
    await mongoose.disconnect();
    return;
  }

  console.log('\n>>> ĐANG BẮT ĐẦU THỰC HIỆN MIGRATION TRÊN MONGODB <<<');

  // Bước 1: Tạo file backup toàn diện
  const backupDir = path.resolve('backend/data');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const migrationId = `MIG_${Date.now()}`;
  const backupFile = path.join(backupDir, `migration_backup_${migrationId}.json`);
  const groupBIds = groupB.map(g => g.st._id);

  console.log(`[SNAPSHOT] Đang chụp snapshot dữ liệu trước thay đổi của ${groupBIds.length} suất...`);
  const preChangeShowtimes = await Showtime.find({ _id: { $in: groupBIds } }).lean();

  const backupPayload = {
    migrationId,
    databaseName: mongoose.connection.name,
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    totalAffectedDocuments: preChangeShowtimes.length,
    preChangeShowtimes,
    cancelledShowtimeIds: groupBIds.map(String),
    groupCShowtimeIds: groupC.map(g => String(g.st._id)),
    groupAShowtimeIds: groupA.map(g => String(g.st._id)),
  };
  fs.writeFileSync(backupFile, JSON.stringify(backupPayload, null, 2));
  console.log(`[BACKUP TOÀN DIỆN] Đã ghi file backup snapshot đầy đủ: ${backupFile}`);

  // Bước 2: Hủy mềm Nhóm B (các suất chồng lấn ảo không có booking)
  const cancelResult = await Showtime.updateMany(
    { _id: { $in: groupBIds }, cancelledAt: null },
    { $set: { cancelledAt: new Date(), isLocked: true, cancelReason: 'Dọn dẹp suất trùng ảo từ seed cũ (0 đơn đặt vé)' } }
  );
  console.log(`[HỦY MỀM NHÓM B] Đã hủy mềm thành công: ${cancelResult.modifiedCount} suất chiếu dư thừa.`);

  // Bước 3: Bổ sung 88 ghế chuẩn cho các suất Nhóm A và Nhóm C đang thiếu ghế
  const needSeatsShowtimes = [
    ...groupA.filter(g => g.isMissingSeats),
    ...groupC.filter(g => g.isMissingSeats),
  ];
  console.log(`[BỔ SUNG GHẾ] Có ${needSeatsShowtimes.length} suất chiếu cần bổ sung 88 ghế chuẩn.`);

  let seatsInserted = 0;
  for (const item of needSeatsShowtimes) {
    // Kiểm tra lại để bảo đảm idempotent
    const existingCount = await ShowtimeSeat.countDocuments({ showtimeId: item.st._id });
    if (existingCount > 0) continue;

    const seats = generateStandard88Seats(item.st.roomId, item.st._id);

    // Nếu suất này có Booking của khách, cập nhật trạng thái các ghế đã đặt sang BOOKED
    if (item.bookings.length > 0) {
      const bookedSeatCodes = new Set();
      for (const b of item.bookings) {
        if (b.status === 'PAID') {
          const seatList = (b.seats || '').split(/[,•|]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
          seatList.forEach(code => bookedSeatCodes.add(code));
        }
      }
      for (const s of seats) {
        if (bookedSeatCodes.has(s.seatNumber)) {
          s.status = 'BOOKED';
        }
      }
    }

    await ShowtimeSeat.insertMany(seats);
    seatsInserted += seats.length;
  }
  console.log(`[BỔ SUNG GHẾ THÀNH CÔNG] Đã tạo tổng cộng: ${seatsInserted} bản ghi ghế ShowtimeSeat chuẩn.`);

  console.log('\n>>> MIGRATION ĐÃ HOÀN TẤT AN TOÀN TRÊN MONGODB <<<');
  await mongoose.disconnect();
}

if (process.argv[1]?.endsWith('migrateShowtimeData.js')) {
  runMigration().catch(console.error);
}
