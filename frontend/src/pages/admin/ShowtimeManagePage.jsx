import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const ShowtimeManagePage = () => {
  const [showtimes, setShowtimes] = useState([]);
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [filterCinemaId, setFilterCinemaId] = useState('ALL');
  const [filterMovieId, setFilterMovieId] = useState('ALL');

  const [formData, setFormData] = useState({
    movieId: '',
    cinemaId: '',
    roomName: 'Phòng 01 - IMAX Laser',
    startTime: '',
    price: 95000,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stRes, mRes, cRes] = await Promise.all([
        api.get('/admin/showtimes'),
        api.get('/movies'),
        api.get('/admin/cinemas'),
      ]);
      setShowtimes(stRes.data || []);
      setMovies(mRes.data || []);
      setCinemas(cRes.data || []);

      if (mRes.data?.length > 0 && cRes.data?.length > 0) {
        setFormData((prev) => ({
          ...prev,
          movieId: mRes.data[0].id || mRes.data[0]._id,
          cinemaId: cRes.data[0].id || cRes.data[0]._id,
        }));
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu suất chiếu:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShowtime = async (e) => {
    e.preventDefault();
    if (!formData.startTime) {
      alert('Vui lòng chọn ngày và giờ chiếu!');
      return;
    }

    try {
      await api.post('/admin/showtimes', formData);
      alert('Đã tạo suất chiếu mới và tự động sinh 48 ghế ngồi!');
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert('Không thể tạo suất chiếu: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa suất chiếu này? Các ghế liên kết cũng sẽ bị hủy!')) {
      try {
        await api.delete(`/admin/showtimes/${id}`);
        loadData();
        alert('Đã xóa suất chiếu thành công!');
      } catch (err) {
        alert('Lỗi xóa suất chiếu: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const filteredShowtimes = showtimes.filter((st) => {
    const cId = st.cinemaId?._id || st.cinemaId?.id || st.cinemaId;
    const mId = st.movieId?._id || st.movieId?.id || st.movieId;
    const matchCinema = filterCinemaId === 'ALL' || cId === filterCinemaId;
    const matchMovie = filterMovieId === 'ALL' || mId === filterMovieId;
    return matchCinema && matchMovie;
  });

  return (
    <div className="flex bg-slate-950 min-h-screen">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 flex-1 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
                <span>🕒</span>
                <span>Quản Lý Suất Chiếu & Ghế Ngồi</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Lên lịch chiếu phim theo rạp, định dạng phòng chiếu (IMAX, 2D) và tự động sinh ma trận ghế.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg shadow-red-600/20"
            >
              <span>➕</span>
              <span>Mở Suất Chiếu Mới</span>
            </button>
          </div>

          {/* Bộ lọc theo Phim & Cụm rạp */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <label className="text-[11px] text-slate-400 block font-semibold mb-1">Lọc theo cụm rạp:</label>
              <select
                value={filterCinemaId}
                onChange={(e) => setFilterCinemaId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              >
                <option value="ALL">Tất cả cụm rạp ({cinemas.length} rạp)</option>
                {cinemas.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    [{c.city}] {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 w-full">
              <label className="text-[11px] text-slate-400 block font-semibold mb-1">Lọc theo bộ phim:</label>
              <select
                value={filterMovieId}
                onChange={(e) => setFilterMovieId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              >
                <option value="ALL">Tất cả phim ({movies.length} phim)</option>
                {movies.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bảng danh sách suất chiếu */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách suất chiếu...</div>
            ) : filteredShowtimes.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Chưa có suất chiếu nào phù hợp với bộ lọc đã chọn
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Phim</th>
                      <th className="py-3 px-4">Cụm rạp</th>
                      <th className="py-3 px-4">Phòng chiếu</th>
                      <th className="py-3 px-4">Thời gian chiếu</th>
                      <th className="py-3 px-4">Giá vé gốc</th>
                      <th className="py-3 px-4 text-center">Tỷ lệ lấp đầy ghế</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {filteredShowtimes.map((st) => {
                      const movie = st.movie || st.movieId;
                      const cinema = st.cinema || st.cinemaId;
                      const dateObj = new Date(st.startTime);
                      const timeFormatted = dateObj.toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const dateFormatted = dateObj.toLocaleDateString('vi-VN', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      });

                      const booked = st.bookedSeats || 0;
                      const total = st.totalSeats || 48;
                      const percent = Math.round((booked / total) * 100);

                      return (
                        <tr key={st.id || st._id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              {movie?.posterUrl && (
                                <img
                                  src={movie.posterUrl}
                                  alt=""
                                  className="w-8 h-12 object-cover rounded-md shrink-0 border border-slate-700"
                                />
                              )}
                              <div>
                                <span className="font-bold text-white block">{movie?.title || 'Phim đã chọn'}</span>
                                <span className="text-[10px] text-slate-400">
                                  {movie?.duration ? `${movie.duration} phút` : ''} • {movie?.ageRating || 'P'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-200 block">{cinema?.name || 'Cụm rạp D\'AVENOR'}</span>
                            <span className="text-[10px] text-slate-400">{cinema?.city || ''}</span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-blue-400">{st.roomName}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-amber-400 block font-mono text-sm">{timeFormatted}</span>
                            <span className="text-[10px] text-slate-400">{dateFormatted}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {Number(st.price || 0).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-slate-300">
                                {booked} / {total} ghế
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  percent > 50
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : percent > 0
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                }`}
                              >
                                {percent}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDelete(st.id || st._id)}
                              className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all text-xs"
                              title="Hủy suất chiếu"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Mở suất chiếu mới */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <h3 className="text-lg font-bold text-white">Mở Suất Chiếu & Sinh Sơ Đồ Ghế</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateShowtime} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Chọn bộ phim *</label>
                    <select
                      value={formData.movieId}
                      onChange={(e) => setFormData({ ...formData, movieId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    >
                      {movies.map((m) => (
                        <option key={m.id || m._id} value={m.id || m._id}>
                          {m.title} ({m.duration} phút)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Chọn Cụm rạp D'AVENOR *</label>
                    <select
                      value={formData.cinemaId}
                      onChange={(e) => setFormData({ ...formData, cinemaId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    >
                      {cinemas.map((c) => (
                        <option key={c.id || c._id} value={c.id || c._id}>
                          [{c.city}] {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Phòng chiếu & Định dạng</label>
                      <select
                        value={formData.roomName}
                        onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                      >
                        <option value="Phòng 01 - IMAX Laser 3D">Phòng 01 - IMAX Laser 3D</option>
                        <option value="Phòng 02 - Dolby Atmos">Phòng 02 - Dolby Atmos</option>
                        <option value="Phòng 03 - 2D Tiêu chuẩn">Phòng 03 - 2D Tiêu chuẩn</option>
                        <option value="Phòng 05 - VIP Gold Class">Phòng 05 - VIP Gold Class</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Giá vé cơ bản (VNĐ) *</label>
                      <input
                        type="number"
                        step="5000"
                        min="50000"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Ngày & Giờ chiếu *</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-[11px] leading-relaxed">
                    💡 <strong>Cơ chế tự động:</strong> Khi bạn tạo suất chiếu này, hệ thống sẽ tự động khởi tạo ma trận <strong>48 ghế ngồi</strong> (Dãy A-F, Ghế 1-8) với phân cấp ghế Tiêu chuẩn & Ghế VIP cho khách đặt vé.
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30"
                    >
                      Khởi tạo suất chiếu
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ShowtimeManagePage;

