import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import Showtime from '../src/models/Showtime.js';

async function testBackupRollback() {
  console.log('--- KIỂM TRA TÍNH NĂNG BACKUP VÀ ROLLBACK ---');
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Tạo 1 document thử nghiệm
  const testDoc = await Showtime.create({
    movieId: new mongoose.Types.ObjectId(),
    roomId: new mongoose.Types.ObjectId(),
    cinemaId: new mongoose.Types.ObjectId(),
    roomName: 'Phòng Test Rollback',
    startTime: new Date('2026-12-31T10:00:00Z'),
    price: 100000,
    isLocked: false
  });
  console.log('1. Đã tạo document test:', testDoc._id);

  // 2. Tạo backup file mô phỏng
  const backupDir = path.resolve('backend/data');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const testBackupFile = path.join(backupDir, `test_rollback_backup_${Date.now()}.json`);
  const backupData = {
    timestamp: new Date().toISOString(),
    cancelledShowtimeIds: [testDoc._id.toString()]
  };
  fs.writeFileSync(testBackupFile, JSON.stringify(backupData, null, 2));
  console.log('2. Đã tạo file backup mô phỏng:', testBackupFile);

  // 3. Thực hiện soft-delete document test
  await Showtime.findByIdAndUpdate(testDoc._id, {
    cancelledAt: new Date(),
    isLocked: true,
    cancelReason: 'Test soft-delete'
  });
  const afterCancel = await Showtime.findById(testDoc._id);
  console.log('3. Trạng thái sau hủy mềm: cancelledAt =', afterCancel.cancelledAt, ', isLocked =', afterCancel.isLocked);

  // 4. Thực hiện rollback từ file backup
  const parsed = JSON.parse(fs.readFileSync(testBackupFile, 'utf-8'));
  const rollbackRes = await Showtime.updateMany(
    { _id: { $in: parsed.cancelledShowtimeIds } },
    { $set: { cancelledAt: null, isLocked: false, cancelReason: null } }
  );
  console.log('4. Kết quả rollback modifiedCount:', rollbackRes.modifiedCount);

  const afterRollback = await Showtime.findById(testDoc._id);
  console.log('5. Trạng thái sau rollback: cancelledAt =', afterRollback.cancelledAt, ', isLocked =', afterRollback.isLocked);

  const isSuccess = afterRollback.cancelledAt === null && afterRollback.isLocked === false;
  console.log(isSuccess ? '✅ KIỂM TRA ROLLBACK THÀNH CÔNG 100%' : '❌ ROLLBACK THẤT BẠI');

  // Dọn dẹp
  await Showtime.findByIdAndDelete(testDoc._id);
  if (fs.existsSync(testBackupFile)) fs.unlinkSync(testBackupFile);
  await mongoose.disconnect();
}

testBackupRollback().catch(err => {
  console.error(err);
  process.exit(1);
});
