import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

const BulkResultModal = ({ isOpen, onClose, result }) => {
  if (!isOpen || !result) return null;

  const {
    deletedCount = 0,
    skippedCount = 0,
    failedCount = 0,
    requestedCount = 0,
    skippedItems = [],
    failedItems = [],
    message = '',
  } = result;

  const isFullSuccess = failedCount === 0 && skippedCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#101728] border border-cyan-500/30 w-full max-w-[560px] rounded-[24px] p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-[#F1F5F9]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
              isFullSuccess
                ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-400'
                : 'bg-cyan-950/50 border border-cyan-500/40 text-cyan-400'
            }`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Kết quả xử lý xóa suất chiếu
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Báo cáo tổng kết đợt thao tác xóa an toàn
              </p>
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

        {/* 3 Thẻ thống kê */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase font-bold block">Thành công</span>
            <span className="text-lg font-bold font-mono text-emerald-300 block">{deletedCount}</span>
            <span className="text-[10px] text-slate-400 block">Đã xóa hoàn toàn</span>
          </div>

          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-amber-400 uppercase font-bold block">Bỏ qua</span>
            <span className="text-lg font-bold font-mono text-amber-300 block">{skippedCount}</span>
            <span className="text-[10px] text-slate-400 block">Được bảo vệ</span>
          </div>

          <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-rose-400 uppercase font-bold block">Thất bại</span>
            <span className="text-lg font-bold font-mono text-rose-300 block">{failedCount}</span>
            <span className="text-[10px] text-slate-400 block">Lỗi kỹ thuật</span>
          </div>
        </div>

        {/* Message tóm tắt */}
        <div className="bg-[#080E1D] border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300">
          <p className="font-semibold text-white">{message || `Đã xử lý ${requestedCount} suất chiếu.`}</p>
          <p className="text-[11px] text-[#94A3B8] mt-1">
            Toàn bộ suất chiếu thỏa mãn điều kiện đã được xóa vĩnh viễn khỏi MongoDB và giải phóng toàn bộ số ghế vật lý trong phòng chiếu.
          </p>
        </div>

        {/* Danh sách các suất bị bỏ qua hoặc lỗi nếu có */}
        {(skippedItems.length > 0 || failedItems.length > 0) && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-amber-300 block">
              Chi tiết các suất được bỏ qua / cần lưu ý:
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-800 rounded-xl p-2 bg-[#080E1D] text-[11px] custom-scrollbar">
              {skippedItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-amber-300 bg-amber-950/20 p-2 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-mono font-bold">Mã {item.id ? item.id.slice(-6) : idx + 1}: </span>
                    <span>{item.reason}</span>
                  </div>
                </div>
              ))}
              {failedItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-rose-300 bg-rose-950/20 p-2 rounded-lg">
                  <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-mono font-bold">Mã {item.id ? item.id.slice(-6) : idx + 1}: </span>
                    <span>{item.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#078CA8] hover:bg-[#067a93] text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
          >
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkResultModal;
