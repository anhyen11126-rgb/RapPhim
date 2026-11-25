import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb+srv://davenor:davenor123@movietix.m3q8h.mongodb.net/movietix_db?retryWrites=true&w=majority&appName=movietix';

async function testOverview() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  // Let's import statisticsService
  const { default: statisticsService } = await import('../src/services/statisticsService.js');
  
  const ranges = ['this_month', 'today', 'this_week', 'this_year', 'all'];
  for (const timeRange of ranges) {
    const res = await statisticsService.getOverviewStats({ timeRange });
    console.log(`\n--- TIME RANGE: ${timeRange} ---`);
    console.log('netRevenue:', res.kpis.netRevenue);
    console.log('totalExpenses:', res.kpis.totalExpenses);
    console.log('profit:', res.kpis.profit);
  }

  process.exit(0);
}

testOverview().catch(console.error);
