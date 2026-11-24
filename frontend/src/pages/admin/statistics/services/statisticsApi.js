import api from '../../../../services/api';

/**
 * Service API gọi backend thống kê & báo cáo D'AVENOR CINEMA
 */
export const statisticsApi = {
  // 1. Tổng quan (KPIs, Biểu đồ doanh thu, Tỷ lệ lấp đầy, Top phim, Khung giờ vàng)
  getOverview: (params = {}, signal) => api.get('/admin/statistics/overview', { params, signal }),

  // 2. Phân tích Doanh thu & Chi phí - Lợi nhuận
  getRevenue: (params = {}, signal) => api.get('/admin/statistics/revenue', { params, signal }),

  // 3. Thống kê Phim (Tỷ lệ bán vé, Doanh thu, Chi phí, Lợi nhuận từng phim)
  getMovies: (params = {}, signal) => api.get('/admin/statistics/movies', { params, signal }),
  getMovieDetail: (id) => api.get(`/admin/statistics/movies/${id}`),

  // 4. Thống kê Suất chiếu
  getShowtimes: (params = {}, signal) => api.get('/admin/statistics/showtimes', { params, signal }),
  getShowtimeDetail: (id) => api.get(`/admin/statistics/showtimes/${id}`),

  // 5. Thống kê Khách hàng
  getCustomers: (params = {}) => api.get('/admin/statistics/customers', { params }),

  // 6. Thống kê Đánh giá
  getReviews: (params = {}) => api.get('/admin/statistics/reviews', { params }),

  // 7. Xuất file Báo cáo CSV / Excel (Blob download)
  exportReport: async (type = 'revenue', params = {}) => {
    const res = await api.get('/admin/statistics/export', {
      params: { ...params, type },
      responseType: 'blob',
    });
    return res;
  },

  // 8. Quản lý chi phí rạp & phim (Expense CRUD)
  getExpenses: (params = {}) => api.get('/admin/statistics/expenses', { params }),
  createExpense: (data) => api.post('/admin/statistics/expenses', data),
  updateExpense: (id, data) => api.put(`/admin/statistics/expenses/${id}`, data),
  deleteExpense: (id) => api.delete(`/admin/statistics/expenses/${id}`),

  // Danh mục hỗ trợ lọc
  getCinemas: () => api.get('/cinemas'),
  getFilterMovies: () => api.get('/movies'),
};

export default statisticsApi;
