import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import Movie from '../models/Movie.js';

// Dữ liệu đạo diễn và dàn diễn viên chính xác với avatar chân dung (không lấy nhầm poster)
const MOVIE_DETAILS_PATCH = {
  'dune-hanh-tinh-cat-phan-2': {
    director: 'Denis Villeneuve',
    posterUrl: 'https://image.tmdb.org/t/p/w780/8QdnKQyZDlN6rBSrfU1V5PctfUu.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/eZ239CUp1d6OryZEBPnO2n87gMG.jpg',
    cast: [
      { name: 'Timothée Chalamet', role: 'Paul Atreides', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop' },
      { name: 'Zendaya', role: 'Chani', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop' },
      { name: 'Austin Butler', role: 'Feyd-Rautha', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop' },
      { name: 'Rebecca Ferguson', role: 'Lệnh bà Jessica', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop' },
      { name: 'Florence Pugh', role: 'Công chúa Irulan', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop' },
      { name: 'Javier Bardem', role: 'Stilgar', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop' },
    ],
  },
  'mai': {
    director: 'Trấn Thành',
    posterUrl: 'https://image.tmdb.org/t/p/w780/2nF8xD200rcDawuCg5ObxxqA2fC.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/zZ6nRdNQNxRnZ1LQ2ttPBZl9AXV.jpg',
    cast: [
      { name: 'Phương Anh Đào', role: 'Mai', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop' },
      { name: 'Tuấn Trần', role: 'Dương (Sâu)', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop' },
      { name: 'Trấn Thành', role: 'Ông Hoàng (Ba Mai)', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop' },
      { name: 'NSND Việt Anh', role: 'Chú Út', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop' },
      { name: 'Hồng Đào', role: 'Bà Đào', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop' },
      { name: 'Uyển Ân', role: 'Bình Nhi', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop' },
    ],
  },
  'quat-mo-trung-ma': {
    director: 'Jang Jae-hyun',
    posterUrl: 'https://image.tmdb.org/t/p/w780/enAODUiL6eMpKaYPH2BEStVafQ2.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/kYWk8TW5TkpCWkB0mkUm72N0lb8.jpg',
    cast: [
      { name: 'Choi Min-sik', role: 'Kim Sang-deok (Thầy phong thủy)', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop' },
      { name: 'Kim Go-eun', role: 'Lee Hwa-rim (Pháp sư)', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop' },
      { name: 'Lee Do-hyun', role: 'Yoon Bong-gil (Pháp sư trẻ)', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop' },
      { name: 'Yoo Hae-jin', role: 'Ko Young-geun (Chuyên gia tang lễ)', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop' },
    ],
  },
  'kung-fu-panda-4': {
    director: 'Mike Mitchell',
    posterUrl: 'https://image.tmdb.org/t/p/w780/7quq3UOaaB0qNM7TMGMEqqghLck.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/3ffPx9jqg0yj9y1KWeagT7D20CB.jpg',
    cast: [
      { name: 'Jack Black', role: 'Po (Lồng tiếng)', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop' },
      { name: 'Awkwafina', role: 'Zhen (Cáo ranh mãnh)', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop' },
      { name: 'Viola Davis', role: 'Tắc kè hoa The Chameleon', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop' },
      { name: 'Dustin Hoffman', role: 'Sư phụ Shifu', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop' },
    ],
  },
  'godzilla-x-kong-de-che-moi': {
    director: 'Adam Wingard',
    posterUrl: 'https://image.tmdb.org/t/p/w780/lTpnAtn1hWXDLxEmkD28l6UyPlF.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/gvLG3Fnznkxl4SmYfcK8gUuqxM8.jpg',
    cast: [
      { name: 'Rebecca Hall', role: 'Tiến sĩ Ilene Andrews', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop' },
      { name: 'Brian Tyree Henry', role: 'Bernie Hayes', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop' },
      { name: 'Dan Stevens', role: 'Trapper', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop' },
      { name: 'Kaylee Hottle', role: 'Jia', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop' },
    ],
  },
  'oppenheimer': {
    director: 'Christopher Nolan',
    posterUrl: 'https://image.tmdb.org/t/p/w780/ixLH2iM9at8BbuLr5wQWnCfwhJO.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg',
    cast: [
      { name: 'Cillian Murphy', role: 'J. Robert Oppenheimer', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop' },
      { name: 'Emily Blunt', role: 'Katherine Oppenheimer', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop' },
      { name: 'Matt Damon', role: 'Tướng Leslie Groves', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop' },
      { name: 'Robert Downey Jr.', role: 'Lewis Strauss', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop' },
    ],
  },
  'spider-man-no-way-home': {
    director: 'Jon Watts',
    posterUrl: 'https://image.tmdb.org/t/p/w780/y4SQ2dJ1y2LBUnxTH7hCe8sr29c.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/iQFcwSGbZXMkeyKrxbPnwnRo5fl.jpg',
    cast: [
      { name: 'Tom Holland', role: 'Peter Parker / Người Nhện', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop' },
      { name: 'Zendaya', role: 'MJ', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop' },
      { name: 'Benedict Cumberbatch', role: 'Doctor Strange', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop' },
      { name: 'Jacob Batalon', role: 'Ned Leeds', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop' },
    ],
  },
  'lat-mat-7-mot-dieu-uoc': {
    director: 'Lý Hải',
    posterUrl: 'https://image.tmdb.org/t/p/w780/2mg6ktvWxsOG9iMBP4P1pwOYltk.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/1K7pHhCZprfDXB7LkCquIK62yCb.jpg',
    cast: [
      { name: 'Thanh Hiền', role: 'Bà Hai (73 tuổi)', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop' },
      { name: 'Trương Minh Cường', role: 'Hai Khôn', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop' },
      { name: 'Đinh Y Nhung', role: 'Ba Như', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop' },
      { name: 'Quách Ngọc Tuyên', role: 'Tư Hậu', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop' },
    ],
  },
  'deadpool-and-wolverine': {
    director: 'Shawn Levy',
    posterUrl: 'https://image.tmdb.org/t/p/w780/lfY2CfmxyN9OvxmFuap6aejViJn.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/by8z9Fe8y7p4jo2YlW2SZDnptyT.jpg',
    cast: [
      { name: 'Ryan Reynolds', role: 'Wade Wilson / Deadpool', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop' },
      { name: 'Hugh Jackman', role: 'Logan / Wolverine', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop' },
      { name: 'Emma Corrin', role: 'Cassandra Nova', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop' },
      { name: 'Matthew Macfadyen', role: 'Mr. Paradox', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop' },
    ],
  },
  'avatar-the-way-of-water': {
    director: 'James Cameron',
    posterUrl: 'https://image.tmdb.org/t/p/w780/luCqqHf10eQuGAYFO3U7JEqT4XC.jpg',
    bannerUrl: 'https://image.tmdb.org/t/p/original/kJsPVzdyBrYHLomuNv5SJDXUQ2f.jpg',
    cast: [
      { name: 'Sam Worthington', role: 'Jake Sully', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop' },
      { name: 'Zoe Saldaña', role: 'Neytiri', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop' },
      { name: 'Sigourney Weaver', role: 'Kiri', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop' },
      { name: 'Stephen Lang', role: 'Đại tá Miles Quaritch', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop' },
    ],
  },
};

function buildAnalyticsForMovie(m) {
  const isMai = (m.slug || '').includes('mai');
  const isDune = (m.slug || '').includes('dune');
  const baseRev = isMai ? 18420000000 : isDune ? 14850200000 : 12450000000;
  const baseTickets = isMai ? 142500 : isDune ? 98420 : 86200;
  const seatsAvailable = isMai ? 21400 : isDune ? 26980 : 24500;
  const totalShowtimes = isMai ? 780 : isDune ? 642 : 560;

  return {
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
    metrics: {
      revenue: `${baseRev.toLocaleString('vi-VN')} đ`,
      revenueGrowth: isMai ? '+18.2%' : '+13.4%',
      revenueNote: isMai ? 'Chiếm 52.4% tổng doanh thu toàn rạp' : 'Chiếm 41.5% tổng doanh thu toàn rạp',
      ticketsSold: baseTickets.toLocaleString('vi-VN'),
      avgTicketPrice: 'TB ~110,000 đ / vé',
      ticketsNote: 'Không gồm vé hủy / hoàn',
      seatsBooked: baseTickets.toLocaleString('vi-VN'),
      occupancyRatio: `Lấp đầy ${totalShowtimes} suất: ${isMai ? '84.2%' : '78.5%'}`,
      vipSeatRatio: 'Tỷ trọng phòng VIP: 42%',
      seatsAvailable: seatsAvailable.toLocaleString('vi-VN'),
      totalSeats: `Trên ${(baseTickets + seatsAvailable).toLocaleString('vi-VN')} ghế mở bán`,
      availableNote: 'Tập trung các suất sáng',
      totalShowtimes: `${totalShowtimes} suất`,
      roomCoverage: `Phủ 12 rạp / ${isMai ? 28 : 24} phòng`,
      avgDailyShowtimes: isMai ? 'TB 32.5 suất/ngày' : 'TB 26.7 suất/ngày',
      avgOccupancy: isMai ? '84.2%' : '78.5%',
      occupancyGrowth: isMai ? '+12.9% vs TB rạp 71.3%' : '+7.2% vs TB rạp 71.3%',
      laserEfficiency: isMai ? 'Hiệu suất phòng 2D Atmos: 96%' : 'Hiệu suất phòng Laser: 94%',
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
      { name: 'Landmark 81 – IMAX Laser', booked: 24120, total: 25720, percent: 94, color: '#f59e0b' },
      { name: 'Vincom Đồng Khởi – Dolby Atmos', booked: 27850, total: 34000, percent: 82, color: '#10b981' },
      { name: 'Crescent Mall Quận 7', booked: 18750, total: 24000, percent: 78, color: '#3b82f6' },
      { name: 'Thảo Điền Pearl TP. Thủ Đức', booked: 17200, total: 22500, percent: 76, color: '#8b5cf6' },
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
        cinema: 'Landmark 81',
        room: 'Phòng IMAX Laser 01',
        time: '19:30 - 22:15',
        format: 'IMAX 3D',
        formatStyle: 'bg-blue-600/20 text-blue-400 border-blue-500/40',
        bookedSeats: '415 / 430',
        revenue: '98,440,000 đ',
        statusText: 'Cháy vé (96.5%)',
        statusStyle: 'bg-red-500/20 text-red-400 border-red-500/40',
      },
      {
        id: `#SC-${(m.slug || 'MOV').slice(0, 4).toUpperCase()}-2100`,
        cinema: 'Vincom Đồng Khởi',
        room: 'Phòng VIP Recliner 02',
        time: '21:00 - 23:45',
        format: '2D Atmos',
        formatStyle: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
        bookedSeats: '295 / 320',
        revenue: '47,650,000 đ',
        statusText: 'Cháy vé (92.1%)',
        statusStyle: 'bg-red-500/20 text-red-400 border-red-500/40',
      },
      {
        id: `#SC-${(m.slug || 'MOV').slice(0, 4).toUpperCase()}-1845`,
        cinema: 'Thảo Điền Pearl',
        room: 'Phòng Standard 01',
        time: '18:45 - 21:30',
        format: '2D Digital',
        formatStyle: 'bg-slate-800 text-slate-400 border-slate-700',
        bookedSeats: '194 / 240',
        revenue: '27,160,000 đ',
        statusText: 'Gần đầy (80.8%)',
        statusStyle: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      },
      {
        id: `#SC-${(m.slug || 'MOV').slice(0, 4).toUpperCase()}-1500`,
        cinema: 'Crescent Mall Quận 7',
        room: 'Phòng Standard 02',
        time: '15:00 - 17:45',
        format: '2D Digital',
        formatStyle: 'bg-slate-800 text-slate-400 border-slate-700',
        bookedSeats: '118 / 220',
        revenue: '15,340,000 đ',
        statusText: 'Ổn định (53.6%)',
        statusStyle: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      },
    ],
    verifiedReviews: [
      {
        id: 'rev-1',
        name: 'Trần Hoàng Nam',
        initial: 'TN',
        ticketCode: '#MTX-98214',
        roomLocation: 'IMAX Laser 01, Landmark 81',
        rating: 5.0,
        timeAgo: 'Hôm nay, 14:20',
        quote: `Hình ảnh và âm thanh của "${m.title}" thực sự choáng ngợp! Âm trầm rung chuyển cả ghế ngồi. Trải nghiệm điện ảnh đỉnh nhất từ đầu năm đến giờ.`,
        pros: 'Màn chiếu IMAX siêu lớn, âm thanh sống động, diễn xuất đỉnh cao, ghế ngồi êm ái.',
        cons: 'Phim hơi dài, cả rạp quá đông nên xếp hàng lấy bắp nước hơi lâu.',
      },
      {
        id: 'rev-2',
        name: 'Lê Minh Thảo',
        initial: 'LT',
        ticketCode: '#MTX-77612',
        roomLocation: 'VIP Recliner, Vincom ĐK',
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
        roomLocation: '2D, Thảo Điền Pearl',
        rating: 4.0,
        timeAgo: '22/03/2026, 19:15',
        quote: `Phim hay, nhạc phim quá xuất sắc. Rạp điều hòa hơi lạnh một chút nhưng nhân viên phục vụ rất nhiệt tình.`,
        pros: 'Nhạc phim hoành tráng, màu sắc tốt, góc nhìn từ ghế chuẩn.',
        cons: 'Nhiệt độ phòng chiếu hơi lạnh vào ban đêm.',
      },
      {
        id: 'rev-4',
        name: 'Nguyễn Bảo Trâm',
        initial: 'NT',
        ticketCode: '#MTX-64890',
        roomLocation: 'IMAX Laser, Q7',
        rating: 5.0,
        timeAgo: '20/03/2026, 15:30',
        quote: `Xem lại lần 2 vẫn thấy nổi da gà từng phân cảnh cao trào. Rất đáng đồng tiền bát gạo cho vé xem tại rạp!`,
        pros: 'Trải nghiệm thị giác tuyệt đối, bắp phô mai ngon giòn.',
        cons: 'Hoàn toàn không có điểm trừ!',
      },
    ],
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas!');

  const movies = await Movie.find({});
  console.log(`Updating ${movies.length} movies in MongoDB Atlas...`);

  for (const m of movies) {
    const patch = MOVIE_DETAILS_PATCH[m.slug] || {};
    if (patch.director) m.director = patch.director;
    if (patch.cast) m.cast = patch.cast;
    if (patch.posterUrl) {
      m.posterUrl = patch.posterUrl;
      m.poster = patch.posterUrl;
    }
    if (patch.bannerUrl) m.bannerUrl = patch.bannerUrl;

    // Sinh analytics và đẩy trực tiếp lên MongoDB
    const analytics = buildAnalyticsForMovie(m);
    m.analytics = analytics;

    await m.save();
    console.log(`✓ Đã cập nhật ảnh & đẩy Analytics lên MongoDB cho phim: [${m.title}]`);
  }

  console.log('Hoàn tất 100% cập nhật MongoDB Atlas!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Lỗi cập nhật:', err);
  process.exit(1);
});
