import statisticsService from '../services/statisticsService.js';

export const getOverview = async (req, res) => {
  try {
    const data = await statisticsService.getOverviewStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy thống kê tổng quan:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy dữ liệu tổng quan', error: error.message });
  }
};

export const getRevenue = async (req, res) => {
  try {
    const data = await statisticsService.getRevenueStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy phân tích doanh thu:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy dữ liệu doanh thu', error: error.message });
  }
};

export const getMovies = async (req, res) => {
  try {
    const data = await statisticsService.getMoviesStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy thống kê phim:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách phim', error: error.message });
  }
};

export const getMovieDetail = async (req, res) => {
  try {
    const data = await statisticsService.getMovieDetailStats(req.params.id, req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy chi tiết thống kê phim:', error);
    res.status(404).json({ success: false, message: error.message || 'Không tìm thấy phim', error: error.message });
  }
};

export const getShowtimes = async (req, res) => {
  try {
    const data = await statisticsService.getShowtimesStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy thống kê suất chiếu:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách suất chiếu', error: error.message });
  }
};

export const getShowtimeDetail = async (req, res) => {
  try {
    const data = await statisticsService.getShowtimeDetailStats(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy chi tiết suất chiếu:', error);
    res.status(404).json({ success: false, message: error.message || 'Không tìm thấy suất chiếu', error: error.message });
  }
};

export const getCustomers = async (req, res) => {
  try {
    const data = await statisticsService.getCustomersStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy thống kê khách hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy dữ liệu khách hàng', error: error.message });
  }
};

export const getReviews = async (req, res) => {
  try {
    const data = await statisticsService.getReviewsStats();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy thống kê đánh giá:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy dữ liệu đánh giá', error: error.message });
  }
};

export const exportReport = async (req, res) => {
  try {
    const type = req.query.type || 'revenue';
    const { fileName, content } = await statisticsService.exportStatistics(type, req.query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(content);
  } catch (error) {
    console.error('Lỗi xuất báo cáo:', error);
    res.status(500).json({ success: false, message: 'Lỗi xuất file báo cáo', error: error.message });
  }
};
