import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { SEAT_LAYOUT_CONFIG, resolveRowAisleSplitCol } from './seatLayout';

const PREFERENCE_OPTIONS = [
  { id: 'CENTER', label: 'Điểm ngọt trung tâm', icon: '🎯', desc: 'Góc nhìn & âm thanh chuẩn điện ảnh' },
  { id: 'VIP', label: 'Khu vực VIP', icon: '👑', desc: 'Ghế bọc da hàng E - G & H' },
  { id: 'NEAR_SCREEN', label: 'Gần màn hình', icon: '📐', desc: 'Hàng B - D, trải nghiệm choáng ngợp' },
  { id: 'FAR_SCREEN', label: 'Xa màn hình', icon: '🔭', desc: 'Hàng F - H, bao quát toàn cảnh rạp' },
];

const SmartSeatRecommender = ({
  showtimeId,
  roomType = 'IMAX',
  seats = [],
  selectedSeats = [],
  bookedSeats = [],
  onSelectSeats,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [seatCount, setSeatCount] = useState(2);
  const [preference, setPreference] = useState('CENTER');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  // Màu sắc chủ đạo theo từng loại phòng chiếu
  const theme =
    roomType === 'GOLD'
      ? {
          border: 'border-[#FFD18A]/40',
          bg: 'bg-[#0B1026]/90',
          accent: 'text-[#FFD18A]',
          accentBg: 'bg-[#FFD18A]/15',
          btnActive: 'bg-gradient-to-r from-[#FFD18A] to-[#E5A93C] text-[#0A0E23]',
          btnGlow: 'shadow-[0_0_15px_rgba(255,209,138,0.4)]',
          badge: 'bg-[#FFD18A]/20 text-[#FFF5E6] border-[#FFD18A]/50',
        }
      : roomType === 'ATMOS'
      ? {
          border: 'border-[#7B2CFF]/40',
          bg: 'bg-[#100625]/90',
          accent: 'text-[#C084FC]',
          accentBg: 'bg-[#7B2CFF]/15',
          btnActive: 'bg-gradient-to-r from-[#7B2CFF] to-[#00D5FF] text-white',
          btnGlow: 'shadow-[0_0_15px_rgba(123,44,255,0.4)]',
          badge: 'bg-[#7B2CFF]/20 text-[#E9D5FF] border-[#7B2CFF]/50',
        }
      : {
          border: 'border-[#00D9FF]/40',
          bg: 'bg-[#030D25]/90',
          accent: 'text-[#00D9FF]',
          accentBg: 'bg-[#00D9FF]/15',
          btnActive: 'bg-gradient-to-r from-[#00D9FF] to-[#006DFF] text-[#030D25]',
          btnGlow: 'shadow-[0_0_15px_rgba(0,217,255,0.4)]',
          badge: 'bg-[#00D9FF]/20 text-[#E0F2FE] border-[#00D9FF]/50',
        };

  // Tính toán gợi ý ghế
  const handleFindSeats = async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const res = await api.get(`/showtimes/${showtimeId}/recommend-seats`, {
        params: { count: seatCount, preference },
      });

      if (res.data?.success && res.data.bestRecommendation) {
        setRecommendation(res.data.bestRecommendation);
        setAlternatives(res.data.alternatives || []);
        setStatusMessage('');
      } else {
        // Fallback thuật toán trên client nếu API chưa có hoặc cần phản hồi tức thì
        const clientResult = computeLocalRecommendation(seatCount, preference, bookedSeats);
        if (clientResult.best) {
          setRecommendation(clientResult.best);
          setAlternatives(clientResult.alternatives || []);
        } else {
          setRecommendation(null);
          setAlternatives([]);
          setStatusMessage(`Không còn cụm ${seatCount} ghế liền kề phù hợp với tiêu chí này.`);
        }
      }
    } catch (err) {
      console.warn('Lỗi API gợi ý ghế, chuyển sang thuật toán cục bộ:', err);
      const clientResult = computeLocalRecommendation(seatCount, preference, bookedSeats);
      if (clientResult.best) {
        setRecommendation(clientResult.best);
        setAlternatives(clientResult.alternatives || []);
      } else {
        setRecommendation(null);
        setAlternatives([]);
        setStatusMessage(`Không còn cụm ${seatCount} ghế liền kề phù hợp với tiêu chí này.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Thuật toán tìm ghế liền kề cục bộ dựa trên dữ liệu ghế thực tế (tuyệt đối không cắt lối đi & không tạo ghế ảo)
  const computeLocalRecommendation = (count, pref, bookedList) => {
    const bookedSet = new Set((bookedList || []).map((s) => String(s).toUpperCase()));
    const sourceSeats =
      Array.isArray(seats) && seats.length > 0
        ? seats
        : SEAT_LAYOUT_CONFIG.rows.flatMap((row) =>
            Array.from({ length: SEAT_LAYOUT_CONFIG.colsPerRow }, (_, idx) => ({
              row,
              col: idx + 1,
              seatNumber: `${row}${idx + 1}`,
              type: ['E', 'F', 'G'].includes(row) ? 'VIP' : row === 'H' ? 'SWEETBOX' : 'STANDARD',
            }))
          );

    const byRow = new Map();
    for (const s of sourceSeats) {
      const rowLabel = String(s.row || '').trim().toUpperCase();
      const colNum = Number(s.col);
      if (!rowLabel || !Number.isFinite(colNum)) continue;
      if (!byRow.has(rowLabel)) byRow.set(rowLabel, []);
      byRow.get(rowLabel).push({
        seatCode: String(s.seatNumber || `${rowLabel}${colNum}`).toUpperCase(),
        row: rowLabel,
        col: colNum,
        type: String(s.type || 'STANDARD').toUpperCase(),
      });
    }

    const candidates = [];
    for (const [rowLabel, rowEntries] of [...byRow.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const ordered = rowEntries.slice().sort((a, b) => a.col - b.col);
      const splitCol = resolveRowAisleSplitCol(ordered);
      const aisleCenter = splitCol + 0.5;
      const baseScore = SEAT_LAYOUT_CONFIG.rowBaseScores[rowLabel] ?? 70;

      const leftBlock = ordered.filter((s) => s.col <= splitCol);
      const rightBlock = ordered.filter((s) => s.col > splitCol);

      [leftBlock, rightBlock].forEach((blockSeats, blockIdx) => {
        const sideName = blockIdx === 0 ? 'Dãy trái' : 'Dãy phải';
        if (blockSeats.length < count) return;

        for (let i = 0; i <= blockSeats.length - count; i++) {
          const slice = blockSeats.slice(i, i + count);
          const isFree = slice.every((s) => !bookedSet.has(s.seatCode));
          if (!isFree) continue;

          let isAdjacent = true;
          for (let k = 1; k < slice.length; k++) {
            if (slice[k].col !== slice[k - 1].col + 1) {
              isAdjacent = false;
              break;
            }
          }
          if (!isAdjacent) continue;

          const sliceCols = slice.map((s) => s.col);
          const seatCodes = slice.map((s) => s.seatCode);
          const dominantType = slice[0].type;

          let s = baseScore;
          const avgCol = sliceCols.reduce((a, b) => a + b, 0) / count;
          const distFromCenter = Math.abs(avgCol - aisleCenter);
          s += Math.max(0, 30 - distFromCenter * 6);

          if (pref === 'CENTER' && ['D', 'E', 'F'].includes(rowLabel)) s += 40;
          if (pref === 'VIP' && (dominantType === 'VIP' || dominantType === 'SWEETBOX')) s += 45;
          if (pref === 'NEAR_SCREEN' && ['B', 'C', 'D'].includes(rowLabel)) s += 45;
          if (pref === 'FAR_SCREEN' && ['F', 'G', 'H'].includes(rowLabel)) s += 45;

          candidates.push({
            row: rowLabel,
            cols: sliceCols,
            seatCodes,
            type: dominantType,
            side: sideName,
            score: Math.round(s),
            label: `Hàng ${rowLabel} (${sideName}) - Ghế ${seatCodes.join(', ')}`,
          });
        }
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    return {
      best: candidates[0] || null,
      alternatives: candidates.slice(1, 4),
    };
  };

  const applySeats = (seatCodes) => {
    if (onSelectSeats) {
      onSelectSeats(seatCodes);
    }
  };

  return (
    <div className={`w-full mb-4 rounded-2xl border ${theme.border} ${theme.bg} backdrop-blur-xl shadow-2xl transition-all duration-300 overflow-hidden`}>
      {/* Header bar / Toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all select-none"
      >
        <div className="flex items-center space-x-2.5">
          <span className="text-lg">✨</span>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                Gợi Ý Ghế Thông Minh (AI Smart Recommender)
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${theme.badge}`}>
                Tự động
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tự động tìm 1-4 ghế liền kề điểm ngọt, không cắt ngang lối đi
            </p>
          </div>
        </div>

        <button
          type="button"
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${theme.border} text-slate-200 hover:text-white flex items-center space-x-1`}
        >
          <span>{isOpen ? 'Thu gọn' : 'Mở bộ lọc gợi ý'}</span>
          <span className="text-[10px] transform transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </span>
        </button>
      </div>

      {/* Chi tiết bộ lọc & kết quả gợi ý */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-white/10 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lựa chọn số lượng vé */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                1. Số lượng ghế cần chọn:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((num) => {
                  const isSelected = seatCount === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSeatCount(num)}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isSelected
                          ? `${theme.btnActive} ${theme.btnGlow} scale-102`
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                      }`}
                    >
                      {num} Ghế
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lựa chọn vị trí mong muốn */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                2. Vị trí ưu tiên:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PREFERENCE_OPTIONS.map((opt) => {
                  const isSelected = preference === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPreference(opt.id)}
                      className={`py-2 px-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                        isSelected
                          ? `${theme.border} ${theme.accentBg} ${theme.accent} font-bold shadow-md`
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs">{opt.icon}</span>
                        <span className="text-[11px] font-bold">{opt.label}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 block truncate mt-0.5">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Nút hành động tìm ghế */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400 italic">
              Đảm bảo các ghế liền nhau trên cùng hàng và nằm trọn trong 1 dãy (không bị lối đi ngăn cách).
            </span>
            <button
              type="button"
              onClick={handleFindSeats}
              disabled={loading}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${theme.btnActive} ${theme.btnGlow}`}
            >
              {loading ? 'Đang phân tích...' : '✨ Tìm ghế tối ưu'}
            </button>
          </div>

          {/* Kết quả gợi ý */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center font-medium">
              {statusMessage}
            </div>
          )}

          {recommendation && (
            <div className="pt-2 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span>🎯</span> Lựa chọn tối ưu nhất:
                </span>
                <span className="text-[11px] text-slate-400">
                  Độ phù hợp: <strong className={theme.accent}>{recommendation.score}%</strong>
                </span>
              </div>

              {/* Thẻ gợi ý #1 */}
              <div className={`p-3 rounded-xl border ${theme.border} bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-white">
                      Hàng {recommendation.row} ({recommendation.side})
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-bold text-amber-300">
                      Ghế: {recommendation.seatCodes.join(', ')}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${theme.badge}`}>
                      {recommendation.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">{recommendation.label}</p>
                </div>

                <button
                  type="button"
                  onClick={() => applySeats(recommendation.seatCodes)}
                  className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition-all active:scale-95 shrink-0 ${theme.btnActive} ${theme.btnGlow}`}
                >
                  Chọn cụm ghế này ✓
                </button>
              </div>

              {/* Các phương án thay thế */}
              {alternatives.length > 0 && (
                <div className="pt-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Các lựa chọn thay thế khả dụng:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {alternatives.map((alt, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between hover:border-white/20 transition-all"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-xs font-bold text-white block truncate">
                            Hàng {alt.row} ({alt.seatCodes.join(', ')})
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">{alt.side}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => applySeats(alt.seatCodes)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-black border border-white/20 text-slate-200 hover:text-white hover:border-white/40 cursor-pointer active:scale-95 shrink-0"
                        >
                          Chọn
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartSeatRecommender;
