import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import MovieModal from '../../components/admin/MovieModal';
import api from '../../services/api';

const MovieManagePage = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null);
  const [selectedMovieForShowtime, setSelectedMovieForShowtime] = useState(null);
  const [showtimeFormData, setShowtimeFormData] = useState({
    roomName: 'Phòng 01 - IMAX Laser',
    startTime: '',
    price: 90000,
  });

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/movies');
      setMovies(res.data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách phim:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMovie = async (movieData) => {
    try {
      const payload = {
        ...movieData,
        posterUrl: movieData.poster,
      };
      if (editingMovie) {
        const movieId = editingMovie.id || editingMovie._id;
        await api.put(`/admin/movies/${movieId}`, payload);
        alert('Cập nhật thông tin & định dạng phim thành công!');
      } else {
        await api.post('/admin/movies', payload);
        alert('Thêm phim mới thành công!');
      }
      setIsModalOpen(false);
      setEditingMovie(null);
      fetchMovies();
    } catch (err) {
      console.error('Lỗi lưu phim:', err);
      alert('Không thể lưu phim: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleOpenCreateModal = () => {
    setEditingMovie(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (movie) => {
    setEditingMovie(movie);
    setIsModalOpen(true);
  };

  const handleDeleteMovie = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bộ phim này khỏi hệ thống không?')) {
      try {
        await api.delete(`/admin/movies/${id}`);
        fetchMovies();
      } catch (err) {
        console.error('Lỗi xóa phim:', err);
        alert('Không thể xóa phim: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleCreateShowtime = async (e) => {
    e.preventDefault();
    if (!selectedMovieForShowtime || !showtimeFormData.startTime) {
      alert('Vui lòng chọn thời gian bắt đầu chiếu!');
      return;
    }

    try {
      await api.post('/admin/showtimes', {
        movieId: selectedMovieForShowtime.id,
        roomName: showtimeFormData.roomName,
        startTime: new Date(showtimeFormData.startTime).toISOString(),
        price: parseFloat(showtimeFormData.price),
      });
      alert(`Đã thêm suất chiếu thành công và tự động tạo 48 ghế ngồi cho phim "${selectedMovieForShowtime.title}"!`);
      setSelectedMovieForShowtime(null);
      fetchMovies();
    } catch (err) {
      console.error('Lỗi tạo suất chiếu:', err);
      alert('Lỗi tạo suất chiếu: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black">Quản Lý Danh Mục Phim & Suất Chiếu</h1>
              <p className="text-xs text-slate-400">
                Danh sách phim, nhãn công nghệ (IMAX / Dolby 7.1 / 4DX / RealD 3D) và định dạng được lưu trữ trong Database
              </p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-red-600/30"
            >
              + Thêm Phim Mới
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Poster</th>
                  <th className="px-4 py-3">Tên phim & Thể loại</th>
                  <th className="px-4 py-3">Độ tuổi & Đánh giá</th>
                  <th className="px-4 py-3">Nhãn & Định dạng</th>
                  <th className="px-4 py-3">Thời lượng</th>
                  <th className="px-4 py-3">Số suất chiếu</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-10 text-center text-slate-400">
                      Đang tải dữ liệu phim...
                    </td>
                  </tr>
                ) : movies.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      Chưa có phim nào trong danh mục.
                    </td>
                  </tr>
                ) : (
                  movies.map((m) => {
                    const formatsDisplay = Array.isArray(m.formats)
                      ? m.formats.join(' • ')
                      : m.formats || '2D • 3D • IMAX';
                    return (
                      <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <img
                            src={m.posterUrl || m.poster || 'https://via.placeholder.com/100x150'}
                            alt={m.title}
                            className="w-12 h-16 object-cover rounded-lg shadow-sm"
                          />
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-bold text-white line-clamp-1">{m.title}</div>
                          <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">{m.genre}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-black px-2 py-0.5 rounded ${
                                m.ageRating === 'T13'
                                  ? 'bg-amber-500 text-slate-950'
                                  : m.ageRating === 'P'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-red-600 text-white'
                              }`}
                            >
                              {m.ageRating || 'T16'}
                            </span>
                            <span className="text-xs font-bold text-amber-400 bg-slate-950/80 border border-amber-500/30 px-2 py-0.5 rounded-full">
                              ★ {m.rating || '4.8'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                              {m.techFormat || 'IMAX'}
                            </span>
                            <span className="text-xs text-slate-300 font-semibold">{formatsDisplay}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">🕒 {m.duration} phút</td>
                        <td className="px-4 py-3 font-semibold text-emerald-400 whitespace-nowrap">
                          {m._count?.showtimes || 0} suất
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                          <button
                            onClick={() => handleOpenEditModal(m)}
                            className="text-xs bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                          >
                            ✏️ Sửa
                          </button>
                          <button
                            onClick={() => setSelectedMovieForShowtime(m)}
                            className="text-xs bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                          >
                            + Mở suất
                          </button>
                          <button
                            onClick={() => handleDeleteMovie(m.id)}
                            className="text-xs bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Modal Thêm / Chỉnh Sửa Phim */}
      <MovieModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMovie(null);
        }}
        onSave={handleSaveMovie}
        initialData={editingMovie}
      />

      {/* Modal Mở Suất Chiếu Nhanh */}
      {selectedMovieForShowtime && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl">
            <h3 className="text-xl font-bold mb-1">Mở Suất Chiếu Mới</h3>
            <p className="text-xs text-red-400 mb-4">{selectedMovieForShowtime.title}</p>

            <form onSubmit={handleCreateShowtime} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Phòng chiếu</label>
                <select
                  value={showtimeFormData.roomName}
                  onChange={(e) => setShowtimeFormData({ ...showtimeFormData, roomName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="Phòng 01 - IMAX Laser">Phòng 01 - IMAX Laser</option>
                  <option value="Phòng 02 - 2D Dolby Atmos">Phòng 02 - 2D Dolby Atmos</option>
                  <option value="Phòng 03 - 2D Tiêu chuẩn">Phòng 03 - 2D Tiêu chuẩn</option>
                  <option value="Rạp 05 (Tầng 3 - RealD 3D)">Rạp 05 (Tầng 3 - RealD 3D)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Thời gian chiếu (Ngày & Giờ)</label>
                <input
                  type="datetime-local"
                  required
                  value={showtimeFormData.startTime}
                  onChange={(e) => setShowtimeFormData({ ...showtimeFormData, startTime: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Giá vé cơ bản (VND)</label>
                <input
                  type="number"
                  required
                  step="5000"
                  value={showtimeFormData.price}
                  onChange={(e) => setShowtimeFormData({ ...showtimeFormData, price: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedMovieForShowtime(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-xs font-bold"
                >
                  Tạo suất & Sinh 48 ghế
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieManagePage;
