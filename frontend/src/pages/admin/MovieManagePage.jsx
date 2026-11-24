import React, { useState, useEffect, useMemo } from 'react';
import AdminSectionTabs from '../../components/admin/AdminSectionTabs';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import MovieModal from '../../components/admin/MovieModal';
import api from '../../services/api';

const MovieManagePage = () => {
  const [rooms, setRooms] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'NOW_SHOWING' | 'COMING_SOON' | 'ENDED'

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null);
  const [selectedMovieForShowtime, setSelectedMovieForShowtime] = useState(null);

  const [showtimeFormData, setShowtimeFormData] = useState({
    roomId: '',
    startTime: '',
    price: 90000,
  });

  useEffect(() => {
    fetchMovies();
    api.get('/admin/rooms')
      .then(({ data }) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]));
  }, []);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/movies');
      setMovies(Array.isArray(res.data) ? res.data : []);
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

  const handleDeleteMovie = async (id, title) => {
    if (window.confirm(`Ngừng chiếu phim "${title}" và khóa các suất sắp tới? Lịch sử vé và giao dịch vẫn được bảo toàn nguyên vẹn.`)) {
      try {
        await api.delete(`/admin/movies/${id}`);
        alert(`Đã ngừng chiếu phim "${title}" thành công.`);
        fetchMovies();
      } catch (err) {
        console.error('Lỗi ngừng chiếu phim:', err);
        alert('Không thể ngừng chiếu phim: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleCreateShowtime = async (e) => {
    e.preventDefault();
    if (!selectedMovieForShowtime || !showtimeFormData.startTime || !showtimeFormData.roomId) {
      alert('Vui lòng chọn phòng chiếu và thời gian bắt đầu!');
      return;
    }

    try {
      await api.post('/admin/showtimes', {
        movieId: selectedMovieForShowtime.id || selectedMovieForShowtime._id,
        roomId: showtimeFormData.roomId,
        startTime: showtimeFormData.startTime,
        price: parseFloat(showtimeFormData.price),
      });
      alert(`Đã thêm suất chiếu thành công cho phim "${selectedMovieForShowtime.title}"!`);
      setSelectedMovieForShowtime(null);
      fetchMovies();
    } catch (err) {
      console.error('Lỗi tạo suất chiếu:', err);
      alert('Lỗi tạo suất chiếu: ' + (err.response?.data?.message || err.message));
    }
  };

  // Lọc danh sách phim theo từ khóa và trạng thái
  const filteredMovies = useMemo(() => {
    return movies.filter((m) => {
      const title = (m.title || '').toLowerCase();
      const genre = (m.genre || '').toLowerCase();
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || title.includes(q) || genre.includes(q);

      let matchStatus = true;
      if (statusFilter !== 'ALL') {
        matchStatus = m.status === statusFilter;
      }
      return matchSearch && matchStatus;
    });
  }, [movies, searchTerm, statusFilter]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 space-y-6 flex-1 overflow-y-auto">
          <AdminSectionTabs />

          {/* Header Quản lý phim */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1 font-medium">
                <span>Hệ thống vận hành</span>
                <span className="text-slate-600">›</span>
                <span className="text-cyan-400 font-semibold">Phim & Lịch chiếu</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-2">
                <span>🎬</span>
                <span>Quản lý phim</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Danh sách phim chiếu rạp D'AVENOR CINEMA và cấu hình định dạng phát hành.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-cyan-600/30 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
            >
              <span>➕</span>
              <span>Thêm Phim Mới</span>
            </button>
          </div>

          {/* Thanh tìm kiếm & Bộ lọc trạng thái */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
            {/* Thanh tìm kiếm */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 w-full sm:w-72">
              <span className="text-slate-500 mr-2 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Tìm tên phim hoặc thể loại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-white text-xs placeholder:text-slate-500 focus:outline-none w-full"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-slate-500 hover:text-white text-xs ml-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Bộ lọc trạng thái */}
            <div className="flex items-center gap-1.5 text-xs">
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'NOW_SHOWING', label: 'Đang chiếu' },
                { key: 'COMING_SOON', label: 'Sắp chiếu' },
                { key: 'ENDED', label: 'Ngừng chiếu' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bảng danh sách phim */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Poster</th>
                  <th className="px-4 py-3">Tên phim & Thể loại</th>
                  <th className="px-4 py-3">Độ tuổi & Đánh giá</th>
                  <th className="px-4 py-3">Định dạng phát hành</th>
                  <th className="px-4 py-3">Thời lượng</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-10 text-center text-slate-400">
                      Đang tải danh sách phim...
                    </td>
                  </tr>
                ) : filteredMovies.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      Không tìm thấy phim nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredMovies.map((m) => {
                    const formatsDisplay = Array.isArray(m.formats)
                      ? m.formats.join(' • ')
                      : m.formats || '2D • 3D';

                    const hasRating = m.rating != null && Number(m.rating) > 0;
                    const ratingScore = hasRating ? Number(m.rating).toFixed(1) : null;

                    const statusBadge =
                      m.status === 'NOW_SHOWING'
                        ? { label: 'Đang chiếu', style: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' }
                        : m.status === 'COMING_SOON'
                        ? { label: 'Sắp chiếu', style: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40' }
                        : { label: 'Ngừng chiếu', style: 'bg-slate-800 text-slate-400 border-slate-700' };

                    return (
                      <tr key={m.id || m._id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <img
                            src={m.posterUrl || m.poster || 'https://via.placeholder.com/100x150'}
                            alt={m.title}
                            className="w-12 h-16 object-cover rounded-lg shadow-sm border border-slate-700"
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
                            {hasRating ? (
                              <span className="text-xs font-bold text-amber-400 bg-slate-950/80 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                ★ {ratingScore}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Chưa có đánh giá
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-cyan-500/30">
                              {m.techFormat || 'Tiêu chuẩn'}
                            </span>
                            <span className="text-xs text-slate-300 font-semibold">{formatsDisplay}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">🕒 {m.duration} phút</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusBadge.style}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(m)}
                            className="text-xs bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
                          >
                            ✏️ Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMovieForShowtime(m);
                              const defaultRoom = rooms[0];
                              setShowtimeFormData({
                                roomId: defaultRoom?._id || defaultRoom?.id || '',
                                startTime: '',
                                price: 90000,
                              });
                            }}
                            className="text-xs bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
                            title="Tạo suất chiếu mới cho phim này"
                          >
                            🗓️ Xếp lịch
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMovie(m.id || m._id, m.title)}
                            className="text-xs bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
                            title="Ngừng chiếu phim và lưu trữ lịch sử"
                          >
                            Ngừng chiếu
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

      {/* Modal Xếp Lịch Chiếu Phim Nhanh */}
      {selectedMovieForShowtime && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🗓️</span>
                  <span>Xếp Lịch Chiếu Phim</span>
                </h3>
                <p className="text-xs text-cyan-400 mt-0.5 font-semibold">
                  {selectedMovieForShowtime.title} ({selectedMovieForShowtime.duration} phút)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMovieForShowtime(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShowtime} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Chọn phòng vật lý *</label>
                <select
                  value={showtimeFormData.roomId}
                  onChange={(e) => setShowtimeFormData({ ...showtimeFormData, roomId: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Chọn phòng</option>
                  {rooms.filter(r => r.status === 'ACTIVE').map((r) => (
                    <option key={r.id || r._id} value={r.id || r._id}>
                      {r.name} ({r.roomType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Thời gian bắt đầu chiếu *</label>
                <input
                  type="datetime-local"
                  required
                  value={showtimeFormData.startTime}
                  onChange={(e) => setShowtimeFormData({ ...showtimeFormData, startTime: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Giá vé cơ bản (VNĐ) *</label>
                <input
                  type="number"
                  step="5000"
                  min="0"
                  value={showtimeFormData.price}
                  onChange={(e) => setShowtimeFormData({ ...showtimeFormData, price: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedMovieForShowtime(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30"
                >
                  Khởi tạo suất chiếu
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
