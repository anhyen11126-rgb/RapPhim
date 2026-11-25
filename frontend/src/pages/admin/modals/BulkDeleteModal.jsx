import React, { useState, useMemo } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Armchair,
  Calendar,
  Layers,
} from 'lucide-react';

const BulkDeleteModal = ({
  isOpen,
  onClose,
  previewData,
  onConfirmDelete,
  isDeleting,
}) => {
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'ELIGIBLE' | 'BLOCKED'
  const [removedSlotIds, setRemovedSlotIds] = useState(new Set());
  const [reason, setReason] = useState('Xóa hàng loạt lịch thiết lập sai');

  if (!isOpen || !previewData) return null;

  const eligibleSlots = previewData.eligibleSlots || [];
  const blockedSlots = previewData.blockedSlots || [];

  // Danh sách các slot hợp lệ sau khi loại trừ thủ công
  const activeConfirmedIds = useMemo(() => {
    return eligibleSlots
      .map(s => s.id)
      .filter(id => !removedSlotIds.has(id));
  }, [eligibleSlots, removedSlotIds]);

  const activeSeatsCount = useMemo(() => {
    return eligibleSlots
      .filter(s => !removedSlotIds.has(s.id))
      .reduce((sum, s) => sum + (s.totalSeats || 88), 0);
  }, [eligibleSlots, removedSlotIds]);

  const toggleExcludeSlot = (id) => {
    setRemovedSlotIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExecute = () => {
    if (activeConfirmedIds.length === 0) {
      alert('Không có suất chiếu hợp lệ nào để thực hiện xóa.');
      return;
    }
    onConfirmDelete(activeConfirmedIds, reason);
  };

  const allDisplaySlots = useMemo(() => {
    const list = [];
    if (filterTab === 'ALL' || filterTab === 'ELIGIBLE') {
      eligibleSlots.forEach(s => list.push({ ...s, category: 'ELIGIBLE' }));
    }
    if (filterTab === 'ALL' || filterTab === 'BLOCKED') {
      blockedSlots.forEach(s => list.push({ ...s, category: 'BLOCKED' }));
    }
    return list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [eligibleSlots, blockedSlots, filterTab]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#101728] border border-red-500/30 w-full max-w-[840px] rounded-[24px] p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-[#F1F5F9]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-950/50 border border-red-500/40 flex items-center justify-center text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Xem trước & xác nhận xóa suất chiếu
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Kiểm tra kỹ lưỡng điều kiện an toàn trước khi xóa vĩnh viễn dữ liệu khỏi hệ thống
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Thẻ KPI Thống kê */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Tổng suất đã chọn */}
          <div className="bg-[#192337] border border-slate-700/60 rounded-xl p-3 text-center space-y-0.5">
            <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider block">
              Tổng suất đã chọn
            </span>
            <span className="text-base font-bold font-mono text-white block">
              {previewData.totalSelected} suất
            </span>
          </div>

          {/* 2. Đủ điều kiện xóa */}
          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-center space-y-0.5">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
              Đủ điều kiện xóa
            </span>
            <span className="text-base font-bold font-mono text-emerald-300 block">
              {activeConfirmedIds.length} suất
            </span>
          </div>

          {/* 3. Được bảo vệ (Bị chặn) */}
          <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 text-center space-y-0.5">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
              Suất được bảo vệ
            </span>
            <span className="text-base font-bold font-mono text-amber-300 block">
              {blockedSlots.length} suất
            </span>
          </div>

          {/* 4. Tổng ghế giải phóng */}
          <div className="bg-[#192337] border border-cyan-500/30 rounded-xl p-3 text-center space-y-0.5">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
              Ghế giải phóng
            </span>
            <span className="text-base font-bold font-mono text-cyan-300 block">
              {activeSeatsCount} ghế
            </span>
          </div>
        </div>

        {/* Thông báo phân loại Nhóm A & Nhóm B */}
        <div className="bg-[#080E1D] border border-slate-800 rounded-xl p-3 text-xs space-y-1.5 text-slate-300">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Nhóm A ({activeConfirmedIds.length} suất):</span>
            <span className="text-slate-300 font-normal">
              0 đơn vé, chưa bắt đầu chiếu $\rightarrow$ Đủ điều kiện xóa sạch hoàn toàn khỏi MongoDB.
            </span>
          </div>
          {blockedSlots.length > 0 && (
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Nhóm B ({blockedSlots.length} suất):</span>
              <span className="text-slate-300 font-normal">
                Đã có khách mua vé hoặc đã chiếu $\rightarrow$ Hệ thống tự động bảo vệ, KHÔNG xóa để tránh mất mát dữ liệu khách hàng.
              </span>
            </div>
          )}
        </div>

        {/* Bộ lọc bảng chi tiết */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex gap-1.5 bg-[#080E1D] p-1 rounded-xl border border-slate-800">
            {[
              { key: 'ALL', label: `Tất cả (${previewData.totalSelected})` },
              { key: 'ELIGIBLE', label: `Đủ điều kiện (${eligibleSlots.length})` },
              { key: 'BLOCKED', label: `Được bảo vệ (${blockedSlots.length})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterTab(key)}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterTab === key
                    ? 'bg-[#078CA8] text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="text-[#94A3B8] text-[11px]">
            Sẽ xóa: <strong className="text-emerald-400 font-mono text-xs">{activeConfirmedIds.length}</strong> suất
          </span>
        </div>

        {/* Bảng chi tiết từng suất chiếu */}
        <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl bg-[#080E1D] custom-scrollbar">
          <table className="w-full text-[11px] text-left">
            <thead className="sticky top-0 bg-[#101728] border-b border-slate-800 text-[#94A3B8]">
              <tr>
                <th className="py-2 px-3">Phim</th>
                <th className="py-2 px-3">Phòng</th>
                <th className="py-2 px-3">Ngày & Giờ</th>
                <th className="py-2 px-3">Trạng thái kiểm tra</th>
                <th className="py-2 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {allDisplaySlots.map((st) => {
                const isBlocked = st.category === 'BLOCKED';
                const isExcluded = removedSlotIds.has(st.id);
                const dateObj = new Date(st.startTime);
                const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

                return (
                  <tr
                    key={st.id}
                    className={`transition-colors ${
                      isExcluded
                        ? 'opacity-35 line-through bg-slate-900/30'
                        : isBlocked
                        ? 'bg-amber-950/10'
                        : 'hover:bg-[#192337]/40'
                    }`}
                  >
                    <td className="py-2 px-3 font-bold text-white max-w-[200px] truncate">
                      {st.movieTitle}
                    </td>
                    <td className="py-2 px-3 text-cyan-300">
                      {st.roomName}
                    </td>
                    <td className="py-2 px-3 font-mono text-[#CBD5E1]">
                      {timeStr} • {dateStr}
                    </td>
                    <td className="py-2 px-3">
                      {isBlocked ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>{st.reason || 'Bị chặn an toàn'}</span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Đủ điều kiện xóa sạch</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {!isBlocked && (
                        <button
                          type="button"
                          onClick={() => toggleExcludeSlot(st.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors border ${
                            isExcluded
                              ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-red-500/40 text-red-300 hover:bg-red-500/20'
                          }`}
                        >
                          {isExcluded ? '↩ Khôi phục' : '× Bỏ qua'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Nhập lý do thao tác */}
        <div className="space-y-1">
          <label className="block text-[11px] text-[#94A3B8] font-semibold">
            Lý do thao tác (Ghi nhận vào AuditLog):
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#79D9F5]"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2.5 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-white rounded-xl font-semibold transition-colors cursor-pointer border border-slate-700/40"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isDeleting || activeConfirmedIds.length === 0}
            onClick={handleExecute}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-red-900/30 flex items-center gap-2 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang xử lý giao dịch...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Xóa {activeConfirmedIds.length} suất đủ điều kiện</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkDeleteModal;
