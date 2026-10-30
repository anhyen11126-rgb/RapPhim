import mongoose from 'mongoose';
import dns from 'node:dns';

// Đảm bảo phân giải tên miền SRV MongoDB Atlas ổn định trên Windows
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Bỏ qua nếu môi trường không cho phép set server
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/movietix_db';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`🍃 [MongoDB] Đã kết nối thành công: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.warn(`⚠️ [MongoDB] Lỗi kết nối Atlas: ${error.message}`);
    
    // Nếu kết nối Atlas thất bại do timeout / mạng / chưa whitelist IP, thử fallback sang MongoDB Local
    if (!uri.includes('localhost') && !uri.includes('127.0.0.1')) {
      try {
        console.log('🔄 Đang thử kết nối MongoDB Local dự phòng (mongodb://127.0.0.1:27017/movietix_db)...');
        const localConn = await mongoose.connect('mongodb://127.0.0.1:27017/movietix_db', {
          serverSelectionTimeoutMS: 2000,
        });
        console.log(`🍃 [MongoDB Local] Đã kết nối thành công: ${localConn.connection.host}/${localConn.connection.name}`);
        return localConn;
      } catch (localErr) {
        console.warn('⚠️ [MongoDB] Bạn hãy kiểm tra lại kết nối Internet và chắc chắn đã Whitelist IP 0.0.0.0/0 trên MongoDB Atlas (Network Access).');
      }
    }
  }
};

export default connectDB;
