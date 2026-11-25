import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Expense = (await import('../src/models/Expense.js')).default;
  const countBefore = await Expense.countDocuments();
  console.log(`Current expense count: ${countBefore}`);

  // Delete all old seed expenses
  const res = await Expense.deleteMany({});
  console.log(`Deleted ${res.deletedCount} old seed expenses.`);

  const countAfter = await Expense.countDocuments();
  console.log(`Expenses after clean: ${countAfter}`);

  await mongoose.disconnect();
}

clean().catch(console.error);
