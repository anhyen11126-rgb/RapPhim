import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testStats() {
  await mongoose.connect(process.env.MONGODB_URI);
  const statisticsService = (await import('../src/services/statisticsService.js')).default;
  const stats = await statisticsService.getOverviewStats({ timeRange: 'this_month' });
  console.log('KPIs after clean:');
  console.log('- Doanh thu:', stats.kpis.netRevenue.formatted, `(${stats.kpis.netRevenue.value} đ)`);
  console.log('- Vé đã bán:', stats.kpis.validTicketsSold.formatted);
  console.log('- Tổng chi phí:', stats.kpis.totalExpenses.formatted, `(${stats.kpis.totalExpenses.value} đ)`);
  console.log('- Lợi nhuận:', stats.kpis.profit.formatted, `(${stats.kpis.profit.value} đ)`, 'Status:', stats.kpis.profit.status);
  await mongoose.disconnect();
}

testStats().catch(console.error);
