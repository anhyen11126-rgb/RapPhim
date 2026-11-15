import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import Room from '../models/Room.js';
import Cinema from '../models/Cinema.js';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Booking from '../models/Booking.js';

const EIGHT_ROOMS = [
  {
    roomNumber: 1,
    name: 'Phòng IMAX 01 (Grand Hall)',
    shortName: 'Phòng 1 (IMAX)',
    roomType: 'IMAX Laser',
    formatFeature: 'IMAX Laser 2D • Âm thanh 12 kênh độc quyền',
    defaultSlots: '17:30 • 19:15 • 20:45 • 22:30',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 2,
    name: 'Rạp 02 (Tầng 2 - 2D Tiêu chuẩn)',
    shortName: 'Phòng 2 (2D)',
    roomType: '2D Tiêu chuẩn',
    formatFeature: '2D Digital Phụ đề • Màn chiếu phẳng 4K sắc nét',
    defaultSlots: '10:00 • 13:00 • 15:45 • 18:30 • 21:15',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 3,
    name: 'Rạp 03 (Tầng 2 - 2D Dolby Atmos)',
    shortName: 'Phòng 3 (Dolby Atmos)',
    roomType: 'Dolby Atmos',
    formatFeature: '2D Dolby Atmos 64 kênh • Âm thanh vòm đa chiều 360°',
    defaultSlots: '11:15 • 14:30 • 17:45 • 20:30 • 23:00',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 4,
    name: 'Rạp 04 (Tầng 3 - 4DX Sound)',
    shortName: 'Phòng 4 (4DX Sound)',
    roomType: '4DX Sound',
    formatFeature: '4DX Dynamic Motion • Hiệu ứng âm thanh và rung chuyển ghế',
    defaultSlots: '10:30 • 13:30 • 16:30 • 19:30 • 22:15',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 5,
    name: 'Rạp 05 (Tầng 3 - RealD 3D)',
    shortName: 'Phòng 5 (RealD 3D)',
    roomType: 'RealD 3D',
    formatFeature: '3D Phụ Đề • RealD 3D High Frame Rate • Kính 3D siêu nhẹ',
    defaultSlots: '12:00 • 15:00 • 18:00 • 21:00',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 6,
    name: 'Phòng VIP Recliner 06 (Tầng 3)',
    shortName: 'Phòng 6 (VIP Recliner)',
    roomType: '2D Tiêu chuẩn',
    formatFeature: 'Ghế bọc da chỉnh điện ngả 180° • Phục vụ bắp nước tận nơi',
    defaultSlots: '11:00 • 14:00 • 17:00 • 20:00 • 22:45',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 7,
    name: 'Rạp 07 (Tầng 4 - Studio 2D)',
    shortName: 'Phòng 7 (Studio 2D)',
    roomType: '2D Tiêu chuẩn',
    formatFeature: 'Màn chiếu cong điện ảnh • Máy chiếu Laser 4K Christie',
    defaultSlots: '09:45 • 12:45 • 15:45 • 18:45 • 21:45',
    totalSeats: 88,
    status: 'ACTIVE',
  },
  {
    roomNumber: 8,
    name: 'Phòng Grand Luxe 08 (Tầng 4)',
    shortName: 'Phòng 8 (Grand Luxe)',
    roomType: 'Dolby Atmos',
    formatFeature: 'Phòng chiếu sang trọng bậc nhất • Âm thanh Dolby Atmos siêu thực',
    defaultSlots: '10:15 • 13:15 • 16:15 • 19:15 • 22:15',
    totalSeats: 88,
    status: 'ACTIVE',
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas!');

  const cinema = await Cinema.findOne({});
  if (!cinema) {
    console.error('Không tìm thấy rạp chiếu nào!');
    process.exit(1);
  }

  console.log(`Đồng bộ 8 phòng chiếu cho rạp [${cinema.name}]...`);
  cinema.roomCount = 8;
  await cinema.save();

  // Đảm bảo đủ 8 phòng chiếu trong database
  const createdRooms = [];
  for (const r of EIGHT_ROOMS) {
    let roomDoc = await Room.findOne({ cinemaId: cinema._id, roomNumber: r.roomNumber });
    if (!roomDoc) {
      roomDoc = await Room.create({
        cinemaId: cinema._id,
        ...r,
      });
      console.log(`+ Đã tạo mới: ${r.name}`);
    } else {
      roomDoc.name = r.name;
      roomDoc.shortName = r.shortName;
      roomDoc.roomType = r.roomType;
      roomDoc.formatFeature = r.formatFeature;
      roomDoc.totalSeats = 88;
      roomDoc.status = 'ACTIVE';
      await roomDoc.save();
      console.log(`✓ Đã cập nhật chuẩn 88 ghế: ${r.name}`);
    }
    createdRooms.push(roomDoc);
  }

  const movies = await Movie.find({});
  console.log(`Cập nhật số liệu 8 phòng và vé/ghế cho ${movies.length} bộ phim...`);

  // Phân bổ số ghế và người mua vé chuẩn xác theo từng phim
  for (let idx = 0; idx < movies.length; idx++) {
    const m = movies[idx];
    const isMai = (m.slug || '').includes('mai');
    const isDune = (m.slug || '').includes('dune');

    // Thống kê 8 phòng chiếu cho bộ phim
    const roomsStats = createdRooms.map((room, rIdx) => {
      // Phân bổ tỷ lệ lấp đầy theo công nghệ phòng
      let occupancyRate = 72;
      if (room.roomType === 'IMAX Laser') occupancyRate = isDune ? 94 : 88;
      else if (room.roomType === 'Dolby Atmos') occupancyRate = isMai ? 96 : 85;
      else if (room.name.includes('VIP')) occupancyRate = 89;
      else if (room.roomType === '4DX Sound') occupancyRate = 81;
      else occupancyRate = 70 + ((idx + rIdx) % 15);

      const bookedSeats = Math.round((88 * occupancyRate) / 100);
      const availableSeats = 88 - bookedSeats;
      const buyersCount = Math.round(bookedSeats / 2.1); // Bình quân ~2.1 vé/khách

      return {
        roomNumber: room.roomNumber,
        roomName: room.name,
        shortName: room.shortName,
        roomType: room.roomType,
        totalSeats: 88,
        bookedSeats,
        availableSeats,
        buyersCount,
        occupancyRate,
      };
    });

    const totalSeatsIn8Rooms = 88 * 8; // 704 ghế
    const totalBookedIn8Rooms = roomsStats.reduce((sum, r) => sum + r.bookedSeats, 0);
    const totalAvailableIn8Rooms = totalSeatsIn8Rooms - totalBookedIn8Rooms;
    const totalBuyersIn8Rooms = roomsStats.reduce((sum, r) => sum + r.buyersCount, 0);
    const avgOccupancy = Math.round((totalBookedIn8Rooms / totalSeatsIn8Rooms) * 100);

    // Tính tổng số vé và doanh thu tích lũy toàn bộ các ca chiếu
    const multiplier = isMai ? 160 : isDune ? 140 : 120;
    const totalCumulativeTickets = totalBookedIn8Rooms * multiplier;
    const totalCumulativeBuyers = Math.round(totalCumulativeTickets / 2.15);
    const ticketPrice = roomTypePrice(m.techFormat);
    const totalRevenue = totalCumulativeTickets * ticketPrice;

    // Cập nhật trường analytics đầy đủ trong MongoDB
    m.analytics = {
      ...(m.analytics || {}),
      title: m.title,
      originalTitle: `${m.title} (${new Date(m.releaseDate || Date.now()).getFullYear()})`,
      posterUrl: m.posterUrl || m.poster,
      bannerUrl: m.bannerUrl,
      status: m.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đang chiếu',
      statusBadge: `${m.status === 'COMING_SOON' ? 'Sắp chiếu' : 'Đang chiếu'} • ${m.duration || 120}’`,
      ageRating: m.ageRating || 'T16',
      posterTagline: `Phim rạp ${m.ageRating || 'T16'} – Quán quân vé`,
      genre: m.genre || 'Hành động, Phiêu lưu',
      director: m.director || 'Denis Villeneuve',
      cast: Array.isArray(m.cast) && m.cast.length > 0
        ? m.cast.map((c) => c.name).filter(Boolean).join(', ')
        : 'Đang cập nhật dàn diễn viên',
      cinemasCount: '12/12 Cụm rạp toàn quốc (24 phòng chiếu)',
      duration: m.duration || 120,
      releaseDate: new Date(m.releaseDate || Date.now()).toLocaleDateString('vi-VN'),
      rating: m.rating || 4.8,
      ratingCount: m.ratingCount || '3,420',
      freshScore: m.rottenTomatoes || '96%',
      verifiedRate: '100% Khách Hàng Thật (Verified E-Ticket)',

      // SỐ LIỆU ĐỒNG BỘ 8 PHÒNG CHIẾU & LƯỢNG NGƯỜI ĐẶT GHẾ / MUA VÉ
      eightRoomsStats: {
        totalRooms: 8,
        seatsPerRoom: 88,
        totalSeatsPerSlot: 704, // 8 * 88
        bookedSeatsPerSlot: totalBookedIn8Rooms,
        availableSeatsPerSlot: totalAvailableIn8Rooms,
        buyersPerSlot: totalBuyersIn8Rooms,
        avgOccupancy,
        roomsList: roomsStats,
      },

      metrics: {
        revenue: `${totalRevenue.toLocaleString('vi-VN')} đ`,
        revenueGrowth: isMai ? '+18.2%' : '+13.4%',
        revenueNote: isMai ? 'Chiếm 52.4% tổng doanh thu toàn rạp' : 'Chiếm 41.5% tổng doanh thu toàn rạp',
        ticketsSold: totalCumulativeTickets.toLocaleString('vi-VN'),
        avgTicketPrice: `TB ~${ticketPrice.toLocaleString('vi-VN')} đ / vé`,
        ticketsNote: 'Không gồm vé hủy / hoàn',
        seatsBooked: totalCumulativeTickets.toLocaleString('vi-VN'),
        occupancyRatio: `Lấp đầy 8 phòng: ${avgOccupancy}%`,
        vipSeatRatio: 'Tỷ trọng phòng VIP: 42%',
        seatsAvailable: (totalCumulativeTickets * 0.28).toFixed(0).toLocaleString('vi-VN'),
        totalSeats: `Trên 8 phòng chiếu (${totalSeatsIn8Rooms} ghế/lượt)`,
        availableNote: 'Tập trung các suất sáng & trưa',
        totalBuyers: totalCumulativeBuyers.toLocaleString('vi-VN'),
        totalShowtimes: `${Math.round(totalCumulativeTickets / totalBookedIn8Rooms)} suất`,
        roomCoverage: 'Phủ trọn vẹn 8/8 phòng chiếu',
        avgDailyShowtimes: 'TB 28.5 suất/ngày',
        avgOccupancy: `${avgOccupancy}%`,
        occupancyGrowth: '+7.2% vs TB rạp 71.3%',
        laserEfficiency: 'Hiệu suất phòng Laser: 94%',
      },

      seatTypesBreakdown: {
        regular: { name: 'Ghế Thường (A–D)', total: 48 * 8, booked: Math.round(totalBookedIn8Rooms * 0.54), percent: 76 },
        vip: { name: 'Ghế VIP (E–G)', total: 30 * 8, booked: Math.round(totalBookedIn8Rooms * 0.34), percent: 88 },
        sweetbox: { name: 'Ghế Sweetbox (H)', total: 10 * 8, booked: Math.round(totalBookedIn8Rooms * 0.12), percent: 92 },
      },

      trendDays: isMai
        ? [
            { day: 'T2', tickets: 12000, revenue: 1.4, label: '12,000 vé' },
            { day: 'T3', tickets: 14500, revenue: 1.7, label: '14,500 vé' },
            { day: 'T4', tickets: 16800, revenue: 2.1, label: '16,800 vé' },
            { day: 'T5', tickets: 19400, revenue: 2.4, label: '19,400 vé' },
            { day: 'T6', tickets: 25100, revenue: 3.2, label: '25,100 vé' },
            { day: 'T7', tickets: 38200, revenue: 4.8, label: '38,200 vé (Cháy vé)' },
            { day: 'CN', tickets: 41200, revenue: 5.2, label: '41,200 vé (Đỉnh cao)' },
          ]
        : [
            { day: 'T2', tickets: 8400, revenue: 1.1, label: '8,400 vé' },
            { day: 'T3', tickets: 9200, revenue: 1.25, label: '9,200 vé' },
            { day: 'T4', tickets: 11500, revenue: 1.6, label: '11,500 vé' },
            { day: 'T5', tickets: 12800, revenue: 1.8, label: '12,800 vé' },
            { day: 'T6', tickets: 16400, revenue: 2.3, label: '16,400 vé' },
            { day: 'T7', tickets: 24100, revenue: 3.2, label: '24,100 vé (Đỉnh điểm)' },
            { day: 'CN', tickets: 26020, revenue: 3.6, label: '26,020 vé (Cháy vé)' },
          ],

      cinemasDistribution: [
        { name: 'Phòng 1 (IMAX Grand Hall)', booked: roomsStats[0]?.bookedSeats || 82, total: 88, percent: roomsStats[0]?.occupancyRate || 94, color: '#f59e0b' },
        { name: 'Phòng 3 (2D Dolby Atmos)', booked: roomsStats[2]?.bookedSeats || 76, total: 88, percent: roomsStats[2]?.occupancyRate || 86, color: '#10b981' },
        { name: 'Phòng 6 (VIP Recliner)', booked: roomsStats[5]?.bookedSeats || 78, total: 88, percent: roomsStats[5]?.occupancyRate || 89, color: '#3b82f6' },
        { name: 'Phòng 4 (4DX Dynamic Sound)', booked: roomsStats[3]?.bookedSeats || 71, total: 88, percent: roomsStats[3]?.occupancyRate || 81, color: '#8b5cf6' },
      ],

      ratingBreakdown: [
        { star: 5, count: '2,716', percent: 79.4 },
        { star: 4, count: '513', percent: 15.0 },
        { star: 3, count: '123', percent: 3.6 },
        { star: 2, count: '48', percent: 1.4 },
        { star: 1, count: '20', percent: 0.6 },
      ],

      timeSlots: [
        { time: '10:00 - 13:00', title: 'Suất Sáng', rate: 52, color: '#60a5fa' },
        { time: '13:30 - 17:30', title: 'Suất Chiều', rate: 71, color: '#34d399' },
        { time: '18:00 - 21:30', title: 'Giờ Vàng', rate: 94, color: '#f97316', isHot: true },
        { time: '22:00 - 01:00', title: 'Suất Khuya', rate: 66, color: '#a78bfa' },
      ],

      highlightSessions: [
        {
          id: `#SC-${(m.slug || 'MOV').slice(0, 4).toUpperCase()}-1930`,
          cinema: 'D’AVENOR Thanh Khê',
          room: 'Phòng IMAX 01 (Grand Hall)',
          time: '19:30 - 22:15',
          format: 'IMAX Laser',
          formatStyle: 'bg-blue-600/20 text-blue-400 border-blue-500/40',
          bookedSeats: `${roomsStats[0]?.bookedSeats || 82} / 88`,
          buyersCount: `${roomsStats[0]?.buyersCount || 39} khách`,
          revenue: `${((roomsStats[0]?.bookedSeats || 82) * 165000).toLocaleString('vi-VN')} đ`,
          statusText: 'Cháy vé (94.0%)',
          statusStyle: 'bg-red-500/20 text-red-400 border-red-500/40',
        },
        {
          id: `#SC-${(m.slug || 'MOV').slice(0, 4).toUpperCase()}-2015`,
          cinema: 'D’AVENOR Thanh Khê',
          room: 'Rạp 03 (Dolby Atmos)',
          time: '20:15 - 22:45',
          format: 'Dolby Atmos',
          formatStyle: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
          bookedSeats: `${roomsStats[2]?.bookedSeats || 78} / 88`,
          buyersCount: `${roomsStats[2]?.buyersCount || 36} khách`,
          revenue: `${((roomsStats[2]?.bookedSeats || 78) * 110000).toLocaleString('vi-VN')} đ`,
          statusText: 'Gần đầy (88.6%)',
          statusStyle: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        },
        {
          id: `#SC-${(m.slug || 'MOV').slice(0, 4).toUpperCase()}-1845`,
          cinema: 'D’AVENOR Thanh Khê',
          room: 'Phòng VIP Recliner 06',
          time: '18:45 - 21:15',
          format: 'VIP Recliner',
          formatStyle: 'bg-purple-600/20 text-purple-400 border-purple-500/40',
          bookedSeats: `${roomsStats[5]?.bookedSeats || 76} / 88`,
          buyersCount: `${roomsStats[5]?.buyersCount || 34} khách`,
          revenue: `${((roomsStats[5]?.bookedSeats || 76) * 140000).toLocaleString('vi-VN')} đ`,
          statusText: 'Cháy vé (86.4%)',
          statusStyle: 'bg-red-500/20 text-red-400 border-red-500/40',
        },
        {
          id: `#SC-${(m.slug || 'MOV').slice(0, 4).toUpperCase()}-1500`,
          cinema: 'D’AVENOR Thanh Khê',
          room: 'Rạp 02 (2D Tiêu chuẩn)',
          time: '15:00 - 17:30',
          format: '2D Digital',
          formatStyle: 'bg-slate-800 text-slate-400 border-slate-700',
          bookedSeats: `${roomsStats[1]?.bookedSeats || 62} / 88`,
          buyersCount: `${roomsStats[1]?.buyersCount || 28} khách`,
          revenue: `${((roomsStats[1]?.bookedSeats || 62) * 85000).toLocaleString('vi-VN')} đ`,
          statusText: 'Ổn định (70.5%)',
          statusStyle: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        },
      ],

      verifiedReviews: [
        {
          id: 'rev-1',
          name: 'Trần Hoàng Nam',
          initial: 'TN',
          ticketCode: '#MTX-98214',
          roomLocation: 'Phòng IMAX 01 (Grand Hall)',
          rating: 5.0,
          timeAgo: 'Hôm nay, 14:20',
          quote: `Hình ảnh và âm thanh của "${m.title}" tại phòng IMAX 01 thực sự choáng ngợp! Âm trầm rung chuyển cả ghế ngồi. Trải nghiệm điện ảnh đỉnh nhất!`,
          pros: 'Màn chiếu IMAX siêu lớn 88 ghế chuẩn, âm thanh sống động, diễn xuất đỉnh cao, ghế ngồi êm ái.',
          cons: 'Phim hơi dài, rạp rất đông nên xếp hàng lấy bắp nước hơi lâu.',
        },
        {
          id: 'rev-2',
          name: 'Lê Minh Thảo',
          initial: 'LT',
          ticketCode: '#MTX-77612',
          roomLocation: 'Phòng VIP Recliner 06',
          rating: 5.0,
          timeAgo: 'Hôm qua, 21:45',
          quote: `Cốt truyện phát triển rất cuốn hút, không một phút thừa thãi. Đặt vé trên MovieTix chọn ghế Sweet spot ở hàng E rất chuẩn tầm mắt.`,
          pros: 'Nội dung kịch tính, kỹ xảo xuất sắc, chọn ghế theo app rất chuẩn.',
          cons: 'Suất tối khá đông, giá vé VIP hơi cao nhưng trải nghiệm hoàn toàn xứng đáng.',
        },
        {
          id: 'rev-3',
          name: 'Đặng Quốc Hưng',
          initial: 'ĐH',
          ticketCode: '#MTX-52019',
          roomLocation: 'Rạp 03 (Dolby Atmos)',
          rating: 4.0,
          timeAgo: '22/03/2026, 19:15',
          quote: `Phim hay, nhạc phim quá xuất sắc. Rạp điều hòa hơi lạnh một chút nhưng nhân viên phục vụ rất nhiệt tình.`,
          pros: 'Nhạc phim hoành tráng, màu sắc tốt, âm thanh Dolby Atmos 64 kênh tuyệt vời.',
          cons: 'Nhiệt độ phòng chiếu hơi lạnh vào ban đêm.',
        },
        {
          id: 'rev-4',
          name: 'Nguyễn Bảo Trâm',
          initial: 'NT',
          ticketCode: '#MTX-64890',
          roomLocation: 'Rạp 04 (4DX Sound)',
          rating: 5.0,
          timeAgo: '20/03/2026, 15:30',
          quote: `Xem lại lần 2 vẫn thấy nổi da gà từng phân cảnh cao trào. Rất đáng đồng tiền bát gạo cho vé xem tại rạp!`,
          pros: 'Trải nghiệm thị giác và rung chuyển ghế 4DX tuyệt đối, bắp phô mai ngon giòn.',
          cons: 'Hoàn toàn không có điểm trừ!',
        },
      ],
    };

    await m.save();
    console.log(`✓ Đồng bộ 8 phòng & thống kê vé/ghế cho: [${m.title}]`);
  }

  console.log('\n🎉 Hoàn thành 100% đồng bộ 8 phòng chiếu và thống kê người đặt/mua vé lên MongoDB Atlas!');
  process.exit(0);
}

function roomTypePrice(tech) {
  if (tech === 'IMAX' || tech === 'IMAX Laser') return 145000;
  if (tech === 'RealD 3D' || tech === '3D') return 110000;
  if (tech === '4DX' || tech === '4DX Sound') return 135000;
  return 95000;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
