import React from 'react';
import { Trash2, CheckSquare, X, Filter, Square } from 'lucide-react';

const BulkActionBar = ({
  selectedCount = 0,
  onSelectAllVisible,
  onClearSelection,
  onOpenConditionModal,
  onOpenBulkDelete,
  onExitSelectionMode,
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-[860px] bg-[#101728]/95 backdrop-blur-md border border-[#79D9F5]/40 rounded-2xl p-3 sm:px-5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-slideUp text-[#F1F5F9]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Bên trái: Số lượng đã chọn */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">
              Đã chọn <strong className="text-cyan-300 font-mono text-sm">{selectedCount}</strong> suất chiếu
            </span>
            <span className="text-[10px] text-[#94A3B8] block">
              Đang ở chế độ Quản lý & Xóa hàng loạt
            </span>
          </div>
        </div>

        {/* Ở giữa: Các nút chọn nhanh */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onSelectAllVisible}
            className="px-2.5 py-1.5 rounded-lg bg-[#192337] hover:bg-[#202d46] border border-slate-700/60 text-slate-200 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
            title="Chọn tất cả các suất chiếu đang hiển thị trên màn hình hiện tại"
          >
            <span>Chọn tất cả đang hiển thị</span>
          </button>

          <button
            type="button"
            onClick={onOpenConditionModal}
            className="px-2.5 py-1.5 rounded-lg bg-[#192337] hover:bg-[#202d46] border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
            title="Chọn suất chiếu theo phim, phòng, khoảng ngày hoặc giờ"
          >
            <Filter className="w-3 h-3" />
            <span>Chọn theo điều kiện...</span>
          </button>

          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="px-2.5 py-1.5 rounded-lg bg-[#192337] hover:bg-[#202d46] border border-slate-700/60 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
              title="Bỏ chọn toàn bộ các suất chiếu đã chọn"
            >
              <span>Bỏ chọn tất cả</span>
            </button>
          )}
        </div>

        {/* Bên phải: Nút Xóa & Nút Thoát */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={onOpenBulkDelete}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-red-900/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa {selectedCount} suất đã chọn</span>
          </button>

          <button
            type="button"
            onClick={onExitSelectionMode}
            className="w-8 h-8 rounded-xl bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-white flex items-center justify-center cursor-pointer transition-colors border border-slate-700/60"
            title="Thoát chế độ chọn nhiều"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionBar;
