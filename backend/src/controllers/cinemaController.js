import mongoose from 'mongoose';
import Cinema from '../models/Cinema.js';
import Showtime from '../models/Showtime.js';
import ShowtimeSeat from '../models/ShowtimeSeat.js';
import Movie from '../models/Movie.js';

// Lấy danh sách rạp (kèm lọc theo thành phố, quận huyện, công nghệ, tìm kiếm)
export const getCinemas = async (req, res) => {
  try {
    const { city, district, tech, search } = req.query;
    const filter = {};

    if (city && city !== 'Tất cả khu vực' && city !== 'Tất cả quận') {
      filter.city = { $regex: new RegExp(`^${city.trim()}$`, 'i') };
    }

    if (district && district !== 'Tất cả quận' && district !== 'Tất cả khu vực' && district !== 'Tất cả') {
      filter.district = { $regex: new RegExp(district.trim(), 'i') };
    }

    if (tech && tech !== 'Tất cả') {
      filter.tags = tech;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { district: { $regex: search, $options: 'i' } },
      ];
    }

    const cinemas = await Cinema.find(filter).sort({ isFlagship: -1, createdAt: 1 }).lean();

    const formatted = cinemas.map((c) => ({
      ...c,
      id: c._id.toString(),
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách rạp', error: error.message });
  }
};

// Hàm hỗ trợ tự động khởi tạo và lưu trực tiếp suất chiếu vào MongoDB Atlas nếu ngày đó chưa có lịch
const autoSeedCinemaShowtimes = async (cinema, targetDate) => {
  try {
    const movies = await Movie.find({});
    if (!movies || movies.length === 0) return;

    const dayOfWeek = targetDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

    const featuredMovies = movies.filter((m) =>
      ['dune-hanh-tinh-cat-phan-2', 'mai', 'kung-fu-panda-4', 'godzilla-x-kong-de-che-moi', 'quat-mo-trung-ma', 'lat-mat-7-mot-dieu-uoc'].includes(m.slug)
    );
    const selectedMovies = featuredMovies.length >= 3 ? featuredMovies : movies.slice(0, 4);

    const hasImax = cinema.tags?.includes('IMAX Laser') || (cinema.name || '').includes('Vincom');
    const roomConfigs = [
      {
        roomName: hasImax ? 'Phòng IMAX 01' : 'Phòng Chiếu 01 (Dolby Atmos)',
        formatFeature: hasImax ? 'IMAX Laser 2D • Âm thanh 12 kênh độc quyền' : '2D Phụ Đề • Âm thanh vòm Dolby Atmos',
        formatType: hasImax ? 'imax' : '2d',
        slots: [
          { hour: 17, minute: 30 },
          { hour: 19, minute: 15 },
          { hour: 20, minute: 45 },
          { hour: 22, minute: 30 },
        ],
      },
      {
        roomName: 'Rạp 03 (Tầng 2)',
        formatFeature: '2D Phụ Đề • Chuẩn Dolby 7.1 • Màn chiếu 4K',
        formatType: '2d',
        slots: [
          { hour: 18, minute: 0 },
          { hour: 19, minute: 45 },
          { hour: 21, minute: 15 },
          { hour: 23, minute: 0 },
        ],
      },
      {
        roomName: 'Rạp 05 (Tầng 3)',
        formatFeature: '3D Phụ Đề • RealD 3D High Frame Rate • Kính 3D siêu nhẹ',
        formatType: '3d',
        slots: [
          { hour: 18, minute: 30 },
          { hour: 20, minute: 0 },
          { hour: 21, minute: 15 },
          { hour: 22, minute: 15 },
        ],
      },
    ];

    const standardRows = ['A', 'B', 'C', 'D'];
    const vipRows = ['E', 'F', 'G'];
    const sweetboxSeats = [
      { row: 'H', col: 1, seatNumber: 'H1-2' },
      { row: 'H', col: 3, seatNumber: 'H3-4' },
      { row: 'H', col: 5, seatNumber: 'H5-6' },
      { row: 'H', col: 7, seatNumber: 'H7-8' },
    ];

    for (let rIdx = 0; rIdx < roomConfigs.length; rIdx++) {
      const room = roomConfigs[rIdx];
      const assignedMovie = selectedMovies[rIdx % selectedMovies.length];

      for (const slot of room.slots) {
        const startTime = new Date(targetDate);
        startTime.setHours(slot.hour, slot.minute, 0, 0);

        const isLate = slot.hour >= 22;
        let calculatedPrice = 50000;
        if (room.formatType === 'imax') {
          calculatedPrice = isLate ? 140000 : (isWeekend ? 170000 : 160000);
        } else if (room.formatType === '3d') {
          calculatedPrice = isLate ? (isWeekend ? 50000 : 45000) : (isWeekend ? 60000 : 50000);
        } else {
          calculatedPrice = isLate ? 45000 : (isWeekend ? 65000 : 50000);
        }

        const showtime = await Showtime.create({
          cinemaId: cinema._id,
          movieId: assignedMovie._id,
          roomName: room.roomName,
          formatFeature: room.formatFeature,
          startTime,
          price: calculatedPrice,
        });

        const seats = [];
        for (const row of standardRows) {
          for (let col = 1; col <= 12; col++) {
            seats.push({
              showtimeId: showtime._id,
              seatNumber: `${row}${col}`,
              row,
              col,
              type: 'STANDARD',
              status: (col === 4 && row === 'C') ? 'BOOKED' : 'AVAILABLE',
            });
          }
        }
        for (const row of vipRows) {
          for (let col = 1; col <= 12; col++) {
            seats.push({
              showtimeId: showtime._id,
              seatNumber: `${row}${col}`,
              row,
              col,
              type: 'VIP',
              status: (col === 8 && row === 'E') ? 'BOOKED' : 'AVAILABLE',
            });
          }
        }
        for (const sb of sweetboxSeats) {
          seats.push({
            showtimeId: showtime._id,
            seatNumber: sb.seatNumber,
            row: sb.row,
            col: sb.col,
            type: 'SWEETBOX',
            status: 'AVAILABLE',
          });
        }
        await ShowtimeSeat.insertMany(seats);
      }
    }
  } catch (err) {
    console.warn('⚠️ [AutoSeed] Lỗi khi tạo lịch chiếu rạp:', err.message);
  }
};

let hasSynced3D = false;

export const ensure3DShowtimesSynced = async () => {
  if (hasSynced3D) return;
  try {
    // 1. Cập nhật giá các suất chiếu 3D cũ (Rạp 05 / RealD 3D) về mức giá mới 45.000đ - 50.000đ
    const existing3D = await Showtime.find({
      $or: [
        { roomName: { $regex: /Rạp 05|RealD 3D/i } },
        { formatFeature: { $regex: /RealD 3D/i } },
      ],
    });

    for (const st of existing3D) {
      const d = new Date(st.startTime);
      const hr = d.getHours();
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 5 || dow === 6;
      const isLate = hr >= 22;
      const targetPrice = isLate ? (isWeekend ? 50000 : 45000) : (isWeekend ? 60000 : 50000);
      if (st.price !== targetPrice) {
        st.price = targetPrice;
        await st.save();
      }
    }

    // 2. Bổ sung các khung giờ 18:30, 20:00, 21:15, 22:15 cho Rạp 05 (Tầng 3 - RealD 3D) trong 3 ngày tới nếu còn thiếu
    const cinema = await Cinema.findOne({ city: 'Đà Nẵng' });
    const movies = await Movie.find({});
    if (cinema && movies.length > 0) {
      const targetMovie =
        movies.find((m) => m.slug === 'kung-fu-panda-4' || m.slug === 'dune-hanh-tinh-cat-phan-2') ||
        movies[0];

      const standardRows = ['A', 'B', 'C', 'D'];
      const vipRows = ['E', 'F', 'G'];
      const sweetboxSeats = [
        { row: 'H', col: 1, seatNumber: 'H1-2' },
        { row: 'H', col: 3, seatNumber: 'H3-4' },
        { row: 'H', col: 5, seatNumber: 'H5-6' },
        { row: 'H', col: 7, seatNumber: 'H7-8' },
      ];

      const threeDSlots = [
        { hour: 18, minute: 30 },
        { hour: 20, minute: 0 },
        { hour: 21, minute: 15 },
        { hour: 22, minute: 15 },
      ];

      const now = new Date();
      for (let dOffset = 0; dOffset < 3; dOffset++) {
        const dayDate = new Date(now);
        dayDate.setDate(now.getDate() + dOffset);
        const dow = dayDate.getDay();
        const isWeekend = dow === 0 || dow === 5 || dow === 6;

        for (const slot of threeDSlots) {
          const slotTime = new Date(dayDate);
          slotTime.setHours(slot.hour, slot.minute, 0, 0);

          const startWindow = new Date(slotTime.getTime() - 10 * 60000);
          const endWindow = new Date(slotTime.getTime() + 10 * 60000);

          const alreadyExists = await Showtime.exists({
            cinemaId: cinema._id,
            roomName: { $regex: /Rạp 05|RealD 3D/i },
            startTime: { $gte: startWindow, $lte: endWindow },
          });

          if (!alreadyExists) {
            const isLate = slot.hour >= 22;
            const calcPrice = isLate ? (isWeekend ? 50000 : 45000) : (isWeekend ? 60000 : 50000);
            const newSt = await Showtime.create({
              cinemaId: cinema._id,
              movieId: targetMovie._id,
              roomName: 'Rạp 05 (Tầng 3)',
              formatFeature: '3D Phụ Đề • RealD 3D High Frame Rate • Kính 3D siêu nhẹ',
              startTime: slotTime,
              price: calcPrice,
            });

            const seats = [];
            for (const row of standardRows) {
              for (let col = 1; col <= 12; col++) {
                seats.push({
                  showtimeId: newSt._id,
                  seatNumber: `${row}${col}`,
                  row,
                  col,
                  type: 'STANDARD',
                  status: col === 4 && row === 'C' ? 'BOOKED' : 'AVAILABLE',
                });
              }
            }
            for (const row of vipRows) {
              for (let col = 1; col <= 12; col++) {
                seats.push({
                  showtimeId: newSt._id,
                  seatNumber: `${row}${col}`,
                  row,
                  col,
                  type: 'VIP',
                  status: col === 8 && row === 'E' ? 'BOOKED' : 'AVAILABLE',
                });
              }
            }
            for (const sb of sweetboxSeats) {
              seats.push({
                showtimeId: newSt._id,
                seatNumber: sb.seatNumber,
                row: sb.row,
                col: sb.col,
                type: 'SWEETBOX',
                status: 'AVAILABLE',
              });
            }
            await ShowtimeSeat.insertMany(seats);
          }
        }
      }
    }
    hasSynced3D = true;
  } catch (err) {
    console.warn('⚠️ [3DSync] Lỗi đồng bộ suất chiếu 3D:', err.message);
  }
};

// Lấy chi tiết 1 rạp kèm toàn bộ lịch chiếu & số ghế trống thực tế
export const getCinemaShowtimes = async (req, res) => {
  try {
    await ensure3DShowtimesSynced();
    const { id } = req.params;
    const { date } = req.query; // YYYY-MM-DD (tùy chọn)

    let cinema = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      cinema = await Cinema.findById(id).lean();
    } else {
      cinema = await Cinema.findOne({ slug: id }).lean();
      if (!cinema) {
        const slugClean = id.replace(/^cinema-danang-/, '');
        cinema = await Cinema.findOne({
          $or: [
            { slug: { $regex: slugClean, $options: 'i' } },
            { name: { $regex: slugClean, $options: 'i' } },
          ],
        }).lean();
      }
    }

    if (!cinema) {
      return res.status(404).json({ message: 'Không tìm thấy cụm rạp yêu cầu' });
    }

    // Xác định khoảng thời gian của ngày cần xem lịch chiếu chuẩn theo giờ địa phương
    let startOfDay, endOfDay;
    if (date) {
      const parts = date.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        startOfDay = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        endOfDay = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      } else {
        startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
      }
    } else {
      startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date();
      endOfDay.setDate(endOfDay.getDate() + 3); // Lấy 3 ngày tới nếu chưa chọn ngày
      endOfDay.setHours(23, 59, 59, 999);
    }

    // Truy vấn các suất chiếu của rạp này từ Database
    let showtimes = await Showtime.find({
      cinemaId: cinema._id,
      startTime: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ startTime: 1 })
      .populate('movieId')
      .lean();

    // Nếu chưa có suất chiếu trong Database cho ngày này, tự động khởi tạo và LƯU TRỰC TIẾP vào MongoDB Atlas
    if (showtimes.length === 0) {
      await autoSeedCinemaShowtimes(cinema, startOfDay);
      showtimes = await Showtime.find({
        cinemaId: cinema._id,
        startTime: { $gte: startOfDay, $lte: endOfDay },
      })
        .sort({ startTime: 1 })
        .populate('movieId')
        .lean();
    }

    // Nhóm các suất chiếu theo từng Phim
    const moviesMap = new Map();

    for (const st of showtimes) {
      if (!st.movieId) continue;

      const movie = st.movieId;
      const movieIdStr = movie._id.toString();

      if (!moviesMap.has(movieIdStr)) {
        moviesMap.set(movieIdStr, {
          id: movieIdStr,
          title: movie.title,
          originalTitle: movie.slug || movie.title,
          ageRating: movie.ageRating || 'P',
          poster: movie.posterUrl || movie.poster,
          duration: `${movie.duration || 120} phút`,
          genre: movie.genre || 'Hành động',
          ratingPercent: '98% Hài lòng',
          roomsMap: new Map(),
        });
      }

      // Đếm số ghế trống thực tế trong DB
      const availableSeatsCount = await ShowtimeSeat.countDocuments({
        showtimeId: st._id,
        status: 'AVAILABLE',
      });

      const totalSeatsCount = await ShowtimeSeat.countDocuments({
        showtimeId: st._id,
      });

      const movieEntry = moviesMap.get(movieIdStr);
      const roomName = st.roomName || 'Phòng 01 - Tiêu chuẩn';

      if (!movieEntry.roomsMap.has(roomName)) {
        const fullSpec = (roomName + ' ' + (st.formatFeature || '')).toLowerCase();
        const isImax = fullSpec.includes('imax');
        const is3D = fullSpec.includes('3d');
        const dayOfWeek = new Date(st.startTime).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

        let priceRangeLabel = '';
        if (isImax) {
          priceRangeLabel = isWeekend
            ? 'Giá vé cuối tuần dao động: 140.000đ - 170.000đ'
            : 'Giá vé ngày thường dao động: 140.000đ - 160.000đ';
        } else if (is3D) {
          priceRangeLabel = isWeekend
            ? 'Giá vé 3D cuối tuần dao động: 50.000đ - 60.000đ'
            : 'Giá vé 3D ngày thường dao động: 45.000đ - 50.000đ';
        } else {
          priceRangeLabel = isWeekend
            ? 'Giá vé cuối tuần dao động: 60.000đ - 65.000đ'
            : 'Giá vé ngày thường dao động: 45.000đ - 50.000đ';
        }

        movieEntry.roomsMap.set(roomName, {
          name: roomName,
          feature: st.formatFeature || 'Âm thanh vòm Dolby Atmos',
          priceText: priceRangeLabel,
          showtimes: [],
        });
      }

      const timeStr = new Date(st.startTime).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      movieEntry.roomsMap.get(roomName).showtimes.push({
        id: st._id.toString(),
        time: timeStr,
        price: st.price,
        availableSeats: availableSeatsCount,
        totalSeats: totalSeatsCount,
        seatText: `còn ${availableSeatsCount} chỗ`,
        statusColor: availableSeatsCount <= 10 ? 'text-amber-400' : 'text-emerald-400',
      });
    }

    // Chuyển cấu trúc Map thành Array cho Frontend render
    const formattedMovies = Array.from(moviesMap.values()).map((m) => ({
      id: m.id,
      title: m.title,
      originalTitle: m.originalTitle,
      ageRating: m.ageRating,
      poster: m.poster,
      duration: m.duration,
      genre: m.genre,
      ratingPercent: m.ratingPercent,
      rooms: Array.from(m.roomsMap.values()),
    }));

    res.json({
      cinema: {
        ...cinema,
        id: cinema._id.toString(),
      },
      movies: formattedMovies,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy lịch chiếu của rạp', error: error.message });
  }
};

// Tạo rạp mới (Admin)
export const createCinema = async (req, res) => {
  try {
    const data = req.body;
    if (!data.name || !data.address) {
      return res.status(400).json({ message: 'Tên và địa chỉ rạp là bắt buộc' });
    }

    const slug =
      data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-') +
      '-' +
      Date.now();

    const cinema = await Cinema.create({
      ...data,
      slug,
    });

    res.status(201).json({
      ...cinema.toObject(),
      id: cinema._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo rạp mới', error: error.message });
  }
};

