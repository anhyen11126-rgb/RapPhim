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
 * Xác định chế độ Database đang kích hoạt ('LIVE' | 'DEMO')
 * Mặc định luôn là 'LIVE' (movietix_db).
 */
export const getActiveDbMode = () => {
  return String(process.env.DB_MODE || 'LIVE').trim().toUpperCase() === 'DEMO' ? 'DEMO' : 'LIVE';
};

/**
 * Xác định URI kết nối dựa trên chế độ DB_MODE ('LIVE' | 'DEMO')
 * - Khi DB_MODE=LIVE: bắt buộc sử dụng MONGODB_LIVE_URI hoặc MONGODB_URI trỏ về movietix_db
 * - Khi DB_MODE=DEMO: sử dụng MONGODB_DEMO_URI (movietix_demo_db)
 */
export const resolveMongoUri = () => {
  const mode = getActiveDbMode();
  const liveUri =
    process.env.MONGODB_LIVE_URI ||
    (process.env.MONGODB_URI
      ? process.env.MONGODB_URI.replace(/\/movietix_demo_db(\?|$)/, '/movietix_db$1')
      : 'mongodb://127.0.0.1:27017/movietix_db');

  if (mode === 'DEMO') {
    if (process.env.MONGODB_DEMO_URI) {
      return process.env.MONGODB_DEMO_URI;
    }
    return liveUri.replace(/\/movietix_db(\?|$)/, '/movietix_demo_db$1');
  }

  return liveUri;
};

const connectDB = async () => {
  const mode = getActiveDbMode();
  const uri = resolveMongoUri();
  const expectedDbName = mode === 'DEMO' ? 'movietix_demo_db' : 'movietix_db';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    const connectedDbName = conn.connection.name;
    console.log(
      `🍃 [MongoDB - ${mode} MODE] Đã kết nối thành công: ${conn.connection.host}/${connectedDbName}`
    );

    if (connectedDbName !== expectedDbName) {
      console.warn(
        `⚠️ [MongoDB] Cảnh báo: DB_MODE=${mode} kỳ vọng kết nối tới "${expectedDbName}" nhưng đang kết nối tới "${connectedDbName}".`
      );
    }
    return conn;
  } catch (error) {
    console.error(
      `❌ [MongoDB - ${mode} MODE] Không thể kết nối tới cơ sở dữ liệu chính (${expectedDbName}): ${error.message}`
    );
    console.error(
      '⚠️ Hệ thống KHÔNG tự động chuyển sang database DEMO hoặc MongoDB Local để tránh sai lệch dữ liệu.'
    );

    if (
      String(process.env.ALLOW_LOCAL_DB_FALLBACK || '').trim().toLowerCase() === 'true' &&
      !uri.includes('localhost') &&
      !uri.includes('127.0.0.1')
    ) {
      try {
        console.warn(
          `⚠️ [CẢNH BÁO FALLBACK] ALLOW_LOCAL_DB_FALLBACK=true được bật: Đang kết nối dự phòng tới mongodb://127.0.0.1:27017/${expectedDbName}...`
        );
        const localConn = await mongoose.connect(`mongodb://127.0.0.1:27017/${expectedDbName}`, {
          serverSelectionTimeoutMS: 3000,
        });
        console.warn(
          `⚠️ [MongoDB Local Fallback - ${mode}] Đang chạy tạm trên Local DB: ${localConn.connection.host}/${localConn.connection.name}`
        );
        return localConn;
      } catch (localErr) {
        console.error(`❌ [MongoDB Local Fallback] Thất bại: ${localErr.message}`);
      }
    }
    return null;
  }
};

export default connectDB;
