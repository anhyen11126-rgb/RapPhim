import React, { useState, useEffect } from 'react';

const TECH_FORMAT_PRESETS = [
  { label: 'IMAX', formats: '2D, 3D, IMAX' },
  { label: 'Dolby 7.1', formats: '2D, Dolby 7.1' },
  { label: '4DX', formats: '2D, 3D, 4DX' },
  { label: 'RealD 3D', formats: '2D, 3D, RealD 3D' },
  { label: '70mm IMAX', formats: '2D, 70mm IMAX' },
];

const MovieModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    duration: 120,
    ageRating: 'T16',
    techFormat: 'IMAX',
    formats: '2D, 3D, IMAX',
    rating: '4.8',
    status: 'NOW_SHOWING',
    releaseDate: '',
    poster: '',
    description: '',
  });

  useEffect(() => {
    if (initialData) {
      const formattedReleaseDate = initialData.releaseDate
        ? new Date(initialData.releaseDate).toISOString().split('T')[0]
        : '';
      const formattedFormats = Array.isArray(initialData.formats)
        ? initialData.formats.join(', ')
        : initialData.formats || '2D, 3D, IMAX';

      setFormData({
        title: initialData.title || '',
        genre: initialData.genre || '',
        duration: initialData.duration || 120,
        ageRating: initialData.ageRating || 'T16',
        techFormat: initialData.techFormat || 'IMAX',
        formats: formattedFormats,
        rating: initialData.rating || '4.8',
        status: initialData.status || 'NOW_SHOWING',
        releaseDate: formattedReleaseDate,
        poster: initialData.posterUrl || initialData.poster || '',
        description: initialData.description || '',
      });
    } else {
      setFormData({
        title: '',
        genre: 'Hành Động, Khoa Học Viễn Tưởng',
        duration: 120,
        ageRating: 'T16',
        techFormat: 'IMAX',
        formats: '2D, 3D, IMAX',
        rating: '4.8',
        status: 'NOW_SHOWING',
        releaseDate: new Date().toISOString().split('T')[0],
        poster: '',
        description: '',
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleTechPresetSelect = (preset) => {
    setFormData((prev) => ({
      ...prev,
      techFormat: preset.label,
      formats: preset.formats,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedFormats = String(formData.formats || '')
      .split(/[,•|]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    onSave({
      ...formData,
      formats: parsedFormats.length > 0 ? parsedFormats : ['2D', '3D', formData.techFormat || 'IMAX'],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-white max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <h3 className="text-xl font-black">
            {initialData ? '✏️ Chỉnh sửa thông tin & định dạng phim' : '🎬 Thêm phim mới vào hệ thống'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded-lg bg-slate-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Tên phim</label>
              <input
                type="text"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Trạng thái chiếu</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="NOW_SHOWING">Đang chiếu</option>
                <option value="COMING_SOON">Sắp chiếu</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Giới hạn tuổi</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                value={formData.ageRating}
                onChange={(e) => setFormData({ ...formData, ageRating: e.target.value })}
              >
                <option value="P">P (Mọi lứa tuổi)</option>
                <option value="T13">T13 (13+)</option>
                <option value="T16">T16 (16+)</option>
                <option value="T18">T18 (18+)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Thời lượng (phút)</label>
              <input
                type="number"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Điểm đánh giá (★)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
              />
            </div>
          </div>

          {/* Cấu hình Nhãn công nghệ (Top-left Poster) & Chuỗi định dạng (Dưới Poster) */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                🎛️ Nhãn công nghệ & Định dạng hiển thị ngoài thẻ phim
              </span>
              <div className="flex flex-wrap gap-1">
                {TECH_FORMAT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleTechPresetSelect(preset)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                      formData.techFormat === preset.label
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nhãn góc trái Poster (VD: IMAX, Dolby 7.1, 4DX)
                </label>
                <input
                  type="text"
                  placeholder="IMAX, Dolby 7.1, 4DX..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={formData.techFormat}
                  onChange={(e) => setFormData({ ...formData, techFormat: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Định dạng dưới Poster (ngăn cách dấu phẩy)
                </label>
                <input
                  type="text"
                  placeholder="2D, 3D, IMAX"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={formData.formats}
                  onChange={(e) => setFormData({ ...formData, formats: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Thể loại</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Ngày khởi chiếu</label>
              <input
                type="date"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                value={formData.releaseDate}
                onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Link Poster Image</label>
            <input
              type="text"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              value={formData.poster}
              onChange={(e) => setFormData({ ...formData, poster: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Mô tả tóm tắt</label>
            <textarea
              rows="3"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm transition-colors font-bold shadow-lg shadow-red-600/20"
            >
              {initialData ? 'Cập nhật phim' : 'Lưu phim mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MovieModal;

