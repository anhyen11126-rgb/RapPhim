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

const count = await Expense.countDocuments();
const total = await Expense.aggregate([
  { $group: { _id: null, sum: { $sum: '$amount' }, minDate: { $min: '$date' }, maxDate: { $max: '$date' } } }
]);
const byType = await Expense.aggregate([
  { $group: { _id: '$type', sum: { $sum: '$amount' }, count: { $sum: 1 } } },
  { $sort: { sum: -1 } }
]);
const byMonth = await Expense.aggregate([
  { $group: { _id: { year: '$year', month: '$month' }, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
  { $sort: { '_id.year': -1, '_id.month': -1 } },
  { $limit: 8 }
]);
const sample = await Expense.find().sort({ date: -1 }).limit(3).lean();

console.log('=== EXPENSES COLLECTION ===');
console.log('Total documents:', count);
console.log('Total amount:', total[0]?.sum?.toLocaleString('vi-VN'), 'đ');
console.log('Date range:', total[0]?.minDate, '→', total[0]?.maxDate);
console.log('\n--- By Type ---');
byType.forEach(t => console.log(t._id, ':', t.count, 'docs,', t.sum?.toLocaleString('vi-VN'), 'đ'));
console.log('\n--- By Month (last 8) ---');
byMonth.forEach(m => console.log(`${m._id.year}/${m._id.month}:`, m.count, 'docs,', m.sum?.toLocaleString('vi-VN'), 'đ'));
console.log('\n--- 3 Newest ---');
sample.forEach(e => console.log(e.costCode, '|', e.title, '|', e.type, '|', e.amount, '| date:', e.date));

await mongoose.disconnect();
