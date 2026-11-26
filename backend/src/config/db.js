import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tự động load file .env từ thư mục backend/ hoặc root bất kể thư mục thực thi
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config();

/**
 * Xác định URI kết nối dựa trên chế độ DB_MODE ('DEMO' | 'LIVE')
 * - Khi DB_MODE=DEMO: ưu tiên MONGODB_DEMO_URI (movietix_demo_db)
 * - Khi DB_MODE=LIVE: sử dụng MONGODB_LIVE_URI hoặc MONGODB_URI (movietix_db)
 */
export const resolveMongoUri = () => {
  const mode = String(process.env.DB_MODE || 'LIVE').trim().toUpperCase();
  const baseUri = process.env.MONGODB_LIVE_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/movietix_db';

  if (mode === 'DEMO') {
    if (process.env.MONGODB_DEMO_URI) {
      return process.env.MONGODB_DEMO_URI;
    }
    return baseUri.replace(/\/movietix_db(\?|$)/, '/movietix_demo_db$1');
  }

  return baseUri;
};

const connectDB = async () => {
  const mode = String(process.env.DB_MODE || 'LIVE').trim().toUpperCase();
  const uri = resolveMongoUri();

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`🍃 [MongoDB - ${mode} MODE] Đã kết nối thành công: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.warn(`⚠️ [MongoDB] Lỗi kết nối Atlas: ${error.message}`);

    if (!uri.includes('localhost') && !uri.includes('127.0.0.1')) {
      try {
        const localDbName = mode === 'DEMO' ? 'movietix_demo_db' : 'movietix_db';
        console.log(`🔄 Đang thử kết nối MongoDB Local dự phòng (mongodb://127.0.0.1:27017/${localDbName})...`);
        const localConn = await mongoose.connect(`mongodb://127.0.0.1:27017/${localDbName}`, {
          serverSelectionTimeoutMS: 3000,
        });
        console.log(`🍃 [MongoDB Local - ${mode}] Đã kết nối thành công: ${localConn.connection.host}/${localConn.connection.name}`);
        return localConn;
      } catch {
        console.warn('⚠️ [MongoDB] Bạn hãy kiểm tra lại kết nối Internet và chắc chắn đã Whitelist IP 0.0.0.0/0 trên MongoDB Atlas (Network Access).');
      }
    }
  }
};

export default connectDB;
