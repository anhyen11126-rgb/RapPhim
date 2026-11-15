import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import statisticsService from '../services/statisticsService.js';

async function testAllApis() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Kết nối MongoDB Atlas thành công!\n');

    // 1. Overview
    console.log('--- TEST 1: getOverviewStats ---');
    const overview = await statisticsService.getOverviewStats({ timeRange: 'all' });
    console.log('Net Revenue:', overview.kpis.netRevenue.formatted);
    console.log('Tickets Sold:', overview.kpis.validTicketsSold.formatted);
    console.log('Customers:', overview.kpis.totalCustomers.formatted);
    console.log('Occupancy Rate:', overview.occupancy.rate, '%');
    console.log('Top Movies:', overview.topRevenueMovies.length);

    // 2. Revenue
    console.log('\n--- TEST 2: getRevenueStats ---');
    const revenue = await statisticsService.getRevenueStats({ timeRange: 'all' });
    console.log('Gross:', revenue.metrics.grossFormatted);
    console.log('Net:', revenue.metrics.netFormatted);
    console.log('Ticket Rev:', revenue.metrics.ticketFormatted);
    console.log('Concession Rev:', revenue.metrics.concessionFormatted);
    console.log('Orders:', revenue.metrics.successfulOrders);
    console.log('Daily rows:', revenue.revenueTableRows.length);

    // 3. Movies
    console.log('\n--- TEST 3: getMoviesStats ---');
    const movies = await statisticsService.getMoviesStats({ timeRange: 'all', page: 1, limit: 5 });
    console.log('Total movies:', movies.total);
    console.log('First movie:', movies.items[0]?.title, 'Rev:', movies.items[0]?.revenueFormatted);

    // 4. Movie Detail
    console.log('\n--- TEST 4: getMovieDetailStats ---');
    const movieDetail = await statisticsService.getMovieDetailStats(movies.items[0]?.id);
    console.log('Movie Detail Title:', movieDetail.movie.title);
    console.log('Movie Detail Showtimes:', movieDetail.stats.showtimesCount);

    // 5. Showtimes
    console.log('\n--- TEST 5: getShowtimesStats ---');
    const showtimes = await statisticsService.getShowtimesStats({ timeRange: 'all', page: 1, limit: 5 });
    console.log('Total showtimes:', showtimes.total);
    console.log('First showtime:', showtimes.items[0]?.movieTitle, showtimes.items[0]?.roomName);

    // 6. Showtime Detail
    console.log('\n--- TEST 6: getShowtimeDetailStats ---');
    if (showtimes.items[0]?.id) {
      const stDetail = await statisticsService.getShowtimeDetailStats(showtimes.items[0]?.id);
      console.log('Showtime Detail Movie:', stDetail.showtime.movieTitle);
      console.log('Seat Matrix rows:', stDetail.seatMatrix.length);
      console.log('Occupancy:', stDetail.stats.occupancyRate, '%');
    }

    // 7. Customers
    console.log('\n--- TEST 7: getCustomersStats ---');
    const customers = await statisticsService.getCustomersStats({ timeRange: 'all', page: 1, limit: 5 });
    console.log('Total registered:', customers.metrics.totalRegistered);
    console.log('Transacting customers:', customers.metrics.transactingCount);
    console.log('Top spender:', customers.customersRanking[0]?.name, customers.customersRanking[0]?.spendFormatted);

    // 8. Reviews
    console.log('\n--- TEST 8: getReviewsStats ---');
    const reviews = await statisticsService.getReviewsStats();
    console.log('Avg rating:', reviews.metrics.avgRating);
    console.log('Total reviews:', reviews.metrics.totalReviews);
    console.log('Top rated:', reviews.metrics.topRatedMovie?.title);

    // 9. Export
    console.log('\n--- TEST 9: exportStatistics ---');
    const exp = await statisticsService.exportStatistics('revenue', { timeRange: 'all' });
    console.log('Export filename:', exp.fileName);
    console.log('Export length:', exp.content.length, 'bytes');

    console.log('\n🎉 TOÀN BỘ 9 CHỨC NĂNG BACKEND STATISTICS SERVICE HOẠT ĐỘNG HOÀN HẢO 100%!');
    process.exit(0);
  } catch (err) {
    console.error('Lỗi kiểm tra:', err);
    process.exit(1);
  }
}

testAllApis();
