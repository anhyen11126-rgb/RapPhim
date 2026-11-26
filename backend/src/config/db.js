import dns from 'node:dns';
import net from 'node:net';
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
 * Kiểm tra một chuỗi máy chủ DNS có phải địa chỉ IPv4/IPv6 hợp lệ (có hoặc không kèm :port) hay không.
 */
const isValidDnsServerEntry = (entry) => {
  if (typeof entry !== 'string') return false;
  const trimmed = entry.trim();
  if (!trimmed) return false;

  // Hỗ trợ dạng [IPv6]:port
  const bracketMatch = trimmed.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketMatch) {
    const ip = bracketMatch[1];
    const port = bracketMatch[2] ? Number(bracketMatch[2]) : 53;
    return net.isIP(ip) === 6 && Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  // Hỗ trợ IPv4 hoặc IPv6 thuần
  if (net.isIP(trimmed) !== 0) {
    return true;
  }

  // Hỗ trợ dạng IPv4:port
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon > 0 && trimmed.indexOf(':') === lastColon) {
    const ipPart = trimmed.slice(0, lastColon);
    const portPart = Number(trimmed.slice(lastColon + 1));
    return net.isIP(ipPart) === 4 && Number.isInteger(portPart) && portPart >= 1 && portPart <= 65535;
  }

  return false;
};

/**
 * Cấu hình máy chủ DNS tùy chọn từ biến môi trường DNS_SERVERS (ví dụ: DNS_SERVERS=8.8.8.8,8.8.4.4)
 * trước khi thực hiện truy vấn SRV kết nối MongoDB Atlas.
 * - Nếu DNS_SERVERS không được thiết lập hoặc để trống: giữ nguyên cơ chế DNS mặc định của Node.js/OS.
 * - Chỉ áp dụng các địa chỉ IP DNS hợp lệ.
 */
export const configureOptionalDnsServers = (rawEnvValue = process.env.DNS_SERVERS) => {
  const raw = typeof rawEnvValue === 'string' ? rawEnvValue.trim() : '';
  if (!raw) {
    return {
      configured: false,
      servers: dns.getServers(),
      invalidEntries: [],
    };
  }

  const tokens = raw
    .split(/[,\s;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const validServers = [];
  const invalidEntries = [];
  const seen = new Set();

  for (const token of tokens) {
    if (isValidDnsServerEntry(token)) {
      if (!seen.has(token)) {
        seen.add(token);
        validServers.push(token);
      }
    } else {
      invalidEntries.push(token);
    }
  }

  if (invalidEntries.length > 0) {
    console.warn(
      `⚠️ [DNS Config] Bỏ qua giá trị DNS_SERVERS không hợp lệ: ${invalidEntries.join(', ')}`
    );
  }

  if (validServers.length === 0) {
    console.warn(
      '⚠️ [DNS Config] Không tìm thấy địa chỉ IP DNS hợp lệ trong DNS_SERVERS. Giữ nguyên DNS mặc định của hệ thống.'
    );
    return {
      configured: false,
      servers: dns.getServers(),
      invalidEntries,
    };
  }

  try {
    dns.setServers(validServers);
    const applied = dns.getServers();
    console.log(`🌐 [DNS Config] Đã áp dụng DNS_SERVERS tùy chỉnh cho Node.js: ${applied.join(', ')}`);
    return {
      configured: true,
      servers: applied,
      invalidEntries,
    };
  } catch (error) {
    console.warn(`⚠️ [DNS Config] Không thể áp dụng DNS_SERVERS (${error.message}). Giữ nguyên DNS mặc định.`);
    return {
      configured: false,
      servers: dns.getServers(),
      invalidEntries,
      error: error.message,
    };
  }
};

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
  // Áp dụng cấu hình DNS_SERVERS tùy chọn (nếu có) TRƯỚC KHI gọi mongoose.connect()
  configureOptionalDnsServers();

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
