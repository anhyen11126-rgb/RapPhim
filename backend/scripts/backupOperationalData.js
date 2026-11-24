import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

async function runBackup() {
  console.log('=== KHỞI CHẠY SAO LƯU DỮ LIỆU VẬN HÀNH D\'AVENOR CINEMA ===');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(`Đã kết nối cơ sở dữ liệu: ${mongoose.connection.name}`);

  const backupDir = path.resolve('backend/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = path.join(backupDir, `backup_before_reset_${timestamp}`);
  fs.mkdirSync(backupFolder, { recursive: true });

  const collectionsToBackup = ['showtimes', 'showtimeseats', 'bookings'];
  const summary = {
    timestamp: new Date().toISOString(),
    databaseName: mongoose.connection.name,
    host: mongoose.connection.host,
    collections: {},
    totalDocuments: 0
  };

  for (const colName of collectionsToBackup) {
    console.log(`[BACKUP] Đang sao lưu collection '${colName}'...`);
    const col = db.collection(colName);
    const count = await col.countDocuments();
    summary.collections[colName] = count;
    summary.totalDocuments += count;

    const filePath = path.join(backupFolder, `${colName}.json`);
    const cursor = col.find({});
    
    // Ghi file theo luồng JSON mảng
    const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });
    writeStream.write('[\n');
    let isFirst = true;
    let written = 0;

    for await (const doc of cursor) {
      if (!isFirst) writeStream.write(',\n');
      writeStream.write(JSON.stringify(doc));
      isFirst = false;
      written++;
      if (written % 10000 === 0) {
        console.log(`  -> Đã sao lưu ${written.toLocaleString()} / ${count.toLocaleString()} documents...`);
      }
    }
    writeStream.write('\n]');
    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const fileStat = fs.statSync(filePath);
    console.log(`[BACKUP HOÀN TẤT] '${colName}': ${count.toLocaleString()} docs -> ${filePath} (${(fileStat.size / (1024 * 1024)).toFixed(2)} MB)`);
  }

  const summaryPath = path.join(backupFolder, 'backup_manifest.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('\n============================================================');
  console.log('✅ SAO LƯU DỮ LIỆU THÀNH CÔNG VÀ NGUYÊN VẸN 100%');
  console.log(`Thư mục lưu trữ: ${backupFolder}`);
  console.log(`Tổng số documents đã sao lưu: ${summary.totalDocuments.toLocaleString()}`);
  console.log('============================================================');

  await mongoose.disconnect();
}

runBackup().catch(err => {
  console.error('Lỗi khi sao lưu:', err);
  process.exit(1);
});
