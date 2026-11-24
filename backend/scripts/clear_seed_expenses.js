import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

await mongoose.connect(process.env.MONGODB_URI);

const Expense = mongoose.model('Expense', new mongoose.Schema({
  costCode: String, title: String, type: String, amount: Number,
  movieId: mongoose.Schema.Types.ObjectId, date: Date, month: Number, year: Number,
}));

const before = await Expense.countDocuments();
console.log(`Trước khi xóa: ${before} khoản chi phí`);

const result = await Expense.deleteMany({});
console.log(`Đã xóa: ${result.deletedCount} khoản chi phí`);

const after = await Expense.countDocuments();
console.log(`Sau khi xóa: ${after} khoản chi phí`);
console.log('✅ Expenses collection đã sạch.');

await mongoose.disconnect();
