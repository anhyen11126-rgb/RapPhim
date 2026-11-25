import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb+srv://davenor:davenor123@movietix.m3q8h.mongodb.net/movietix_db?retryWrites=true&w=majority&appName=movietix';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const Expense = mongoose.model('Expense', new mongoose.Schema({}, { strict: false }));
  const count = await Expense.countDocuments();
  console.log('Expense count:', count);

  const sample = await Expense.find().limit(5).lean();
  console.log('Sample expenses:', JSON.stringify(sample, null, 2));

  const total = await Expense.aggregate([
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  console.log('Total expense amount:', total);

  const byType = await Expense.aggregate([
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);
  console.log('By type:', byType);

  const dateRange = await Expense.aggregate([
    {
      $group: {
        _id: null,
        minDate: { $min: '$date' },
        maxDate: { $max: '$date' }
      }
    }
  ]);
  console.log('Expense date range:', dateRange);

  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }));
  const bookingStats = await Booking.aggregate([
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$finalTotal' },
        count: { $sum: 1 }
      }
    }
  ]);
  console.log('Booking stats by status:', bookingStats);

  process.exit(0);
}

check().catch(console.error);
