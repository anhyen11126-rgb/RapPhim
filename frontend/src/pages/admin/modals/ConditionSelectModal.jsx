import React, { useState } from 'react';
import { X, Search, Filter, Calendar, Clock, Film } from 'lucide-react';
import api from '../../../services/api';

const ConditionSelectModal = ({
  isOpen,
  onClose,
  onApplySelection,
  movies = [],
  rooms = [],
  viewDate,
}) => {
  const [startDate, setStartDate] = useState(viewDate || '');
  const [endDate, setEndDate] = useState(viewDate || '');
  const [selectedMovieIds, setSelectedMovieIds] = useState([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [roomType, setRoomType] = useState('ALL');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('ALL');
  const [searching, setSearching] = useState(false);
  const [matchedResults, setMatchedResults] = useState(null);

  if (!isOpen) return null;

  const handleQuery = async () => {
    try {
      setSearching(true);
      const res = await api.post('/admin/showtimes/query-condition', {
        startDate,
        endDate,
        movieIds: selectedMovieIds,
        roomIds: selectedRoomIds,
        roomType,
        timeFrom,
        timeTo,
        batchId,
        status,
      });
      setMatchedResults(res.data);
    } catch (err) {
      alert('Lỗi truy vấn điều kiện: ' + (err.response?.data?.message || err.message));
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmAdd = () => {
    if (!matchedResults || !matchedResults.showtimeIds) return;
    onApplySelection(matchedResults.showtimeIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#101728] border border-cyan-500/30 w-full max-w-[680px] rounded-[24px] p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-[#F1F5F9]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#080E1D] border border-[#79D9F5]/30 flex items-center justify-center text-[#79D9F5]">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Chọn suất chiếu theo điều kiện</h3>
              <p className="text-xs text-[#94A3B8]">Lọc và thêm các suất chiếu khớp điều kiện vào danh sách chọn</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form điều kiện */}
        <div className="space-y-3.5 text-xs">
          {/* Khoảng ngày */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#94A3B8] font-semibold mb-1">Từ ngày</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setMatchedResults(null); }}
                className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5]"
              />
            </div>
            <div>
              <label className="block text-[#94A3B8] font-semibold mb-1">Đến ngày</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setMatchedResults(null); }}
                className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5]"
              />
            </div>
          </div>

          {/* Phim & Loại phòng */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#94A3B8] font-semibold mb-1">Bộ phim</label>
              <select
                value={selectedMovieIds[0] || 'ALL'}
                onChange={(e) => {
                  setSelectedMovieIds(e.target.value === 'ALL' ? [] : [e.target.value]);
                  setMatchedResults(null);
                }}
                className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#79D9F5]"
              >
                <option value="ALL">-- Tất cả phim --</option>
                {movies.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id}>
                    {m.title} ({m.duration}p)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#94A3B8] font-semibold mb-1">Loại phòng</label>
              <select
                value={roomType}
                onChange={(e) => { setRoomType(e.target.value); setMatchedResults(null); }}
                className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#79D9F5]"
              >
                <option value="ALL">-- Tất cả loại phòng --</option>
                <option value="IMAX">IMAX Laser (Phòng 01–03)</option>
                <option value="Atmos">Dolby Atmos (Phòng 04–06)</option>
                <option value="Gold">Gold Class (Phòng 07–09)</option>
              </select>
            </div>
          </div>

          {/* Phòng vật lý & Khung giờ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#94A3B8] font-semibold mb-1">Phòng vật lý cụ thể</label>
              <select
                value={selectedRoomIds[0] || 'ALL'}
                onChange={(e) => {
                  setSelectedRoomIds(e.target.value === 'ALL' ? [] : [e.target.value]);
                  setMatchedResults(null);
                }}
                className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#79D9F5]"
              >
                <option value="ALL">-- Tất cả phòng vật lý --</option>
                {rooms.map((r) => (
                  <option key={r.id || r._id} value={r.id || r._id}>
                    {r.name} ({r.roomType})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Giờ từ (HH:mm)</label>
                <input
                  type="time"
                  value={timeFrom}
                  onChange={(e) => { setTimeFrom(e.target.value); setMatchedResults(null); }}
                  className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-2 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5]"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Đến (HH:mm)</label>
                <input
                  type="time"
                  value={timeTo}
                  onChange={(e) => { setTimeTo(e.target.value); setMatchedResults(null); }}
                  className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-2 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5]"
                />
              </div>
            </div>
          </div>

          {/* Đợt tạo lịch (batchId) */}
          <div>
            <label className="block text-[#94A3B8] font-semibold mb-1">Mã đợt tạo lịch (Batch ID nếu có)</label>
            <input
              type="text"
              placeholder="VD: BATCH-M5X..."
              value={batchId}
              onChange={(e) => { setBatchId(e.target.value); setMatchedResults(null); }}
              className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] placeholder-slate-600"
            />
          </div>

          {/* Nút tìm kiếm */}
          <button
            type="button"
            onClick={handleQuery}
            disabled={searching}
            className="w-full py-2.5 bg-[#192337] hover:bg-[#202d46] border border-[#79D9F5]/40 text-[#79D9F5] rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {searching ? (
              <span className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Tìm kiếm suất chiếu khớp điều kiện</span>
          </button>

          {/* Kết quả tìm được */}
          {matchedResults && (
            <div className="bg-[#080E1D] border border-slate-800 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#94A3B8]">Số suất chiếu tìm thấy:</span>
                <span className="text-cyan-400 font-bold text-sm font-mono">
                  {matchedResults.count} suất chiếu
                </span>
              </div>

              {matchedResults.count > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-[11px]">
                  {matchedResults.showtimes.slice(0, 50).map((st) => (
                    <div
                      key={st.id}
                      className="p-2 rounded-lg bg-[#192337]/60 border border-slate-700/40 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-white block truncate">{st.movieTitle}</span>
                        <span className="text-[#94A3B8] text-[10px]">
                          {st.roomName} • {new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(st.startTime).toLocaleDateString('vi-VN')})
                        </span>
                      </div>
                      {st.batchId && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono">
                          {st.batchId.slice(0, 12)}...
                        </span>
                      )}
                    </div>
                  ))}
                  {matchedResults.count > 50 && (
                    <p className="text-[10px] text-slate-500 text-center pt-1">
                      ... và {matchedResults.count - 50} suất chiếu khác
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-400 text-center py-2">
                  Không tìm thấy suất chiếu nào khớp với các điều kiện trên.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-white rounded-xl font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleConfirmAdd}
            disabled={!matchedResults || matchedResults.count === 0}
            className="px-5 py-2 bg-[#078CA8] hover:bg-[#067a93] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
          >
            Thêm {matchedResults?.count || 0} suất vào lựa chọn
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConditionSelectModal;
