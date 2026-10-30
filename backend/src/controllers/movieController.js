import prisma from '../prisma.js';

// Lấy danh sách phim (kèm lọc theo trạng thái / thể loại / tìm kiếm)
export const getMovies = async (req, res) => {
  try {
    const { status, genre, search } = req.query;
    const where = {};

    if (status) {
      where.status = status;
    }
    if (genre) {
      where.genre = { contains: genre };
    }
    if (search) {
      where.title = { contains: search };
    }

    const movies = await prisma.movie.findMany({
      where,
      orderBy: { releaseDate: 'desc' },
      include: {
        _count: {
          select: { showtimes: true },
        },
      },
    });

    res.json(movies);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách phim', error: error.message });
  }
};

// Lấy chi tiết 1 phim kèm danh sách suất chiếu
export const getMovieById = async (req, res) => {
  try {
    const { id } = req.params;
    const movieId = parseInt(id, 10);

    if (isNaN(movieId)) {
      return res.status(400).json({ message: 'ID phim không hợp lệ' });
    }

    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      include: {
        showtimes: {
          orderBy: { startTime: 'asc' },
          select: {
            id: true,
            roomName: true,
            startTime: true,
            price: true,
          },
        },
      },
    });

    if (!movie) {
      return res.status(404).json({ message: 'Không tìm thấy phim yêu cầu' });
    }

    res.json(movie);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin chi tiết phim', error: error.message });
  }
};

