import MovieMongo from '../models/MovieMongo.js';

// 1. TẠO MỚI (CREATE) - POST /api/mongodb/movies
export const createMovieMongo = async (req, res) => {
  try {
    const { title, poster, genre, duration, ageRating, description, price, status } = req.body;

    const newMovie = new MovieMongo({
      title,
      poster,
      genre,
      duration,
      ageRating,
      description,
      price,
      status,
    });

    const savedMovie = await newMovie.save();
    return res.status(201).json({
      success: true,
      message: 'Thêm phim vào MongoDB thành công!',
      data: savedMovie,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Lỗi khi tạo phim: ' + error.message,
    });
  }
};

// 2. LẤY TẤT CẢ (READ ALL) - GET /api/mongodb/movies
export const getAllMoviesMongo = async (req, res) => {
  try {
    const movies = await MovieMongo.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: movies.length,
      data: movies,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi truy vấn danh sách: ' + error.message,
    });
  }
};

// 3. LẤY CHI TIẾT 1 PHIM (READ ONE) - GET /api/mongodb/movies/:id
export const getMovieMongoById = async (req, res) => {
  try {
    const movie = await MovieMongo.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phim với ID tương ứng trong MongoDB',
      });
    }
    return res.status(200).json({
      success: true,
      data: movie,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'ID không hợp lệ hoặc lỗi truy vấn: ' + error.message,
    });
  }
};

// 4. CHỈNH SỬA (UPDATE) - PUT /api/mongodb/movies/:id
export const updateMovieMongo = async (req, res) => {
  try {
    const updatedMovie = await MovieMongo.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true, // Trả về tài liệu đã cập nhật
        runValidators: true, // Chạy lại xác thực schema
      }
    );

    if (!updatedMovie) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phim để cập nhật',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật phim trong MongoDB thành công!',
      data: updatedMovie,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Lỗi khi cập nhật: ' + error.message,
    });
  }
};

// 5. XÓA (DELETE) - DELETE /api/mongodb/movies/:id
export const deleteMovieMongo = async (req, res) => {
  try {
    const deletedMovie = await MovieMongo.findByIdAndDelete(req.params.id);

    if (!deletedMovie) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phim để xóa',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa phim khỏi MongoDB thành công!',
      data: deletedMovie,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa: ' + error.message,
    });
  }
};

