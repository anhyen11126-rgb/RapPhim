import statisticsService from '../services/statisticsService.js';

const handleStatsError = (res, error, defaultMessage, defaultStatus = 500) => {
  const statusCode =
    error?.statusCode ||
    (error?.name === 'StatisticsPeriodValidationError' ? 400 : defaultStatus);
  if (statusCode >= 500) {
    console.error(`${defaultMessage}:`, error);
  }
  return res.status(statusCode).json({
    success: false,
    code: error?.code || (statusCode === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR'),
    message: error?.message || defaultMessage,
    details: error?.details || null,
    error: error?.message || defaultMessage,
  });
};

export const getFilterMovies = async (req, res) => {
  try {
    const data = await statisticsService.getPeriodFilterMovies(req.query);
    res.json({ success: true, data });
  } catch (error) {
    return handleStatsError(res, error, 'Lỗi lấy danh sách phim trong kỳ báo cáo');
  }
};

export const getOverview = async (req, res) => {
  try {
    const data = await statisticsService.getOverviewStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    return handleStatsError(res, error, 'Lỗi lấy dữ liệu tổng quan');
  }
};

export const getRevenue = async (req, res) => {
  try {
    const data = await statisticsService.getRevenueStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    return handleStatsError(res, error, 'Lỗi lấy dữ liệu doanh thu');
  }
};

export const getMovies = async (req, res) => {
  try {
    const data = await statisticsService.getMoviesStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    return handleStatsError(res, error, 'Lỗi lấy danh sách phim');
  }
};

export const getMovieDetail = async (req, res) => {
  try {
    const data = await statisticsService.getMovieDetailStats(req.params.id, req.query);
    res.json({ success: true, data });
  } catch (error) {
    const defaultStatus = error?.statusCode || 404;
    return handleStatsError(res, error, error.message || 'Không tìm thấy phim', defaultStatus);
  }
};

export const getShowtimes = async (req, res) => {
  try {
    const data = await statisticsService.getShowtimesStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    return handleStatsError(res, error, 'Lỗi lấy danh sách suất chiếu');
  }
};

export const getShowtimeDetail = async (req, res) => {
  try {
    const data = await statisticsService.getShowtimeDetailStats(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    return handleStatsError(res, error, error.message || 'Không tìm thấy suất chiếu', 404);
  }
};

export const getCustomers = async (req, res) => {
  try {
    const data = await statisticsService.getCustomersStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    return handleStatsError(res, error, 'Lỗi lấy dữ liệu khách hàng');
  }
};

export const getReviews = async (req, res) => {
  try {
    const data = await statisticsService.getReviewsStats();
    res.json({ success: true, data });
  } catch (error) {
    return handleStatsError(res, error, 'Lỗi lấy dữ liệu đánh giá');
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
    return handleStatsError(res, error, 'Lỗi xuất file báo cáo');
  }
};
