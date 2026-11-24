import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();
import mongoose from 'mongoose';

async function inspectCollections() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('=== KẾT NỐI DATABASE THÀNH CÔNG ===');
  console.log('Database Name:', mongoose.connection.name);
  console.log('Host:', mongoose.connection.host);

  const cols = await db.listCollections().toArray();
  console.log(`\n=== TỔNG CỘNG ${cols.length} COLLECTIONS TRONG DATABASE ===`);
  const counts = {};
  for (const c of cols) {
    const count = await db.collection(c.name).countDocuments();
    counts[c.name] = count;
    console.log(`- ${c.name.padEnd(25)}: ${count.toLocaleString()} documents`);
  }

  // Kiểm tra chi tiết collection bookings
  console.log('\n=== KIỂM TOÁN TÍNH CHẤT TEST CỦA DỮ LIỆU BOOKINGS ===');
  const bookingCol = db.collection('bookings');
  const totalBookings = await bookingCol.countDocuments();
  const sampleBookings = await bookingCol.find().limit(10).toArray();
  
  console.log(`Tổng số booking: ${totalBookings}`);
  console.log('Mẫu 5 đơn hàng:');
  sampleBookings.slice(0, 5).forEach((b, idx) => {
    console.log(`[${idx+1}] Mã: ${b.bookingCode}, Khách: ${b.customerName}, SĐT: ${b.customerPhone}, Email: ${b.customerEmail}, Ghế: ${b.seats}, Tổng tiền: ${b.totalAmount}, Status: ${b.status}, PaymentStatus: ${b.paymentStatus}, Ngày tạo: ${b.createdAt}`);
  });

  // Kiểm tra xem có email khách hàng thực hay đều là seed
  const customerEmails = await bookingCol.distinct('customerEmail');
  const customerPhones = await bookingCol.distinct('customerPhone');
  const paymentStatuses = await bookingCol.distinct('paymentStatus');
  console.log(`Số email duy nhất: ${customerEmails.length}`);
  console.log(`Số SĐT duy nhất: ${customerPhones.length}`);
  console.log(`Các trạng thái thanh toán (paymentStatus):`, paymentStatuses);

  // Kiểm tra các collection liên quan đến vé / chi phí / log
  console.log('\n=== KIỂM TRA EXPENSES, TICKETS, CHAT LOGS ===');
  if (counts['expenses']) {
    const expCount = counts['expenses'];
    const sampleExp = await db.collection('expenses').find().limit(3).toArray();
    console.log(`Expenses (${expCount} docs):`, sampleExp.map(e => ({ title: e.title, amount: e.amount, date: e.date })));
  }

  await mongoose.disconnect();
}

inspectCollections().catch(console.error);
