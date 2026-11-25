import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function backup() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Expense = (await import('../src/models/Expense.js')).default;
  const all = await Expense.find().lean();
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, 'expenses_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(all, null, 2), 'utf8');
  console.log(`Backed up ${all.length} expenses to ${backupPath}`);
  await mongoose.disconnect();
}

backup().catch(console.error);
