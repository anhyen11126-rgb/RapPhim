import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

async function runRestore() {
  const targetFolder = process.argv[2];
  if (!targetFolder || !fs.existsSync(targetFolder)) {
    console.error('Vui lòng truyền đường dẫn thư mục backup hợp lệ để phục hồi.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(`=== BẮT ĐẦU KHÔI PHỤC DỮ LIỆU TỪ: ${targetFolder} ===`);

  const manifestPath = path.join(targetFolder, 'backup_manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('Manifest:', manifest);
  }

  const collections = ['showtimes', 'showtimeseats', 'bookings'];
  for (const colName of collections) {
    const filePath = path.join(targetFolder, `${colName}.json`);
    if (!fs.existsSync(filePath)) continue;

    console.log(`Đang đọc file ${filePath}...`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const docs = JSON.parse(raw);
    console.log(`Đang phục hồi ${docs.length.toLocaleString()} documents vào collection '${colName}'...`);

    const col = db.collection(colName);
    // Xóa dữ liệu hiện tại trước khi import lại
    await col.deleteMany({});
    
    // Insert theo lô 2000
    const batchSize = 2000;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize).map(doc => {
        // Chuyển đổi _id string thành ObjectId nếu cần
        if (doc._id && typeof doc._id === 'object' && doc._id.$oid) {
          doc._id = new mongoose.Types.ObjectId(doc._id.$oid);
        } else if (doc._id && typeof doc._id === 'string') {
          doc._id = new mongoose.Types.ObjectId(doc._id);
        }
        return doc;
      });
      await col.insertMany(batch);
    }
    console.log(`✅ Khôi phục thành công '${colName}': ${docs.length.toLocaleString()} docs.`);
  }

  console.log('🎉 TOÀN BỘ DỮ LIỆU ĐÃ ĐƯỢC PHỤC HỒI NGUYÊN VẸN!');
  await mongoose.disconnect();
}

if (process.argv[1]?.endsWith('restoreOperationalData.js')) {
  runRestore().catch(console.error);
}
