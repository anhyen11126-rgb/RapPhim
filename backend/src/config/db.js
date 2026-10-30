import mongoose from 'mongoose';
import dns from 'node:dns';

// Đảm bảo phân giải tên miền SRV MongoDB Atlas ổn định trên Windows
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Bỏ qua nếu môi trường không cho phép set server
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('⚠️ MONGODB_URI chưa được cấu hình trong file .env');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Timeout 5s nếu server MongoDB chưa bật
    });
    console.log(`🍃 [MongoDB] Đã kết nối thành công: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.warn(`⚠️ [MongoDB] Chưa thể kết nối đến MongoDB (${error.message}). Bạn hãy kiểm tra đã bật MongoDB Local hoặc nhập đúng chuỗi kết nối MongoDB Atlas trong .env nhé!`);
  }
};

export default connectDB;

