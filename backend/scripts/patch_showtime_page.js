import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/CDIO/movietix-project/frontend/src/pages/admin/ShowtimeManagePage.jsx';
let c = readFileSync(p, 'utf8');

// ─── PATCH 1: Add recurring state vars after isDeleting line ───────────────────
const stateAnchor = `  const [isDeleting, setIsDeleting] = useState(false);`;
const newState = `  const [isDeleting, setIsDeleting] = useState(false);

  // ── Recurring showtime mode ─────────────────────────────────────────────────
  const [createMode, setCreateMode] = useState('single'); // 'single' | 'recurring'
  const [recurringData, setRecurringData] = useState({
    startDate: '',
    endDate: '',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    timeSlots: [],
    pricingMode: 'fixed',
    manualTimeInput: '',
  });
  const [recurringPreview, setRecurringPreview] = useState(null); // { validSlots, conflictSlots, ... }
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringCommitting, setRecurringCommitting] = useState(false);
  const [previewFilter, setPreviewFilter] = useState('ALL'); // 'ALL'|'VALID'|'CONFLICT'
  const [previewRemovedKeys, setPreviewRemovedKeys] = useState(new Set()); // keys of removed conflict rows`;

if (!c.includes(stateAnchor)) { console.error('STATE ANCHOR NOT FOUND'); process.exit(1); }
c = c.replace(stateAnchor, newState);

// ─── PATCH 2: Add recurring handlers before handleTimelineSlotClick ────────────
const handlerAnchor = `  // Click vào ô trống trên Timeline: Tự động mở modal và điền sẵn phòng và giờ`;
const newHandlers = `  // ── Recurring helpers ──────────────────────────────────────────────────────
  const recurringDayLabels = [
    { label: 'CN', value: 0 },
    { label: 'T2', value: 1 },
    { label: 'T3', value: 2 },
    { label: 'T4', value: 3 },
    { label: 'T5', value: 4 },
    { label: 'T6', value: 5 },
    { label: 'T7', value: 6 },
  ];

  const getRecurringStartDate = () =>
    recurringData.startDate || viewDate;

  const getRecurringEndDate = () =>
    recurringData.endDate || viewDate;

  const handleRecurringQuickRange = (days) => {
    const start = getRecurringStartDate();
    const d = new Date(start + 'T12:00:00+07:00');
    d.setDate(d.getDate() + days - 1);
    const end = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    setRecurringData(prev => ({ ...prev, startDate: start, endDate: end }));
    setRecurringPreview(null);
  };

  const handleRecurringEndOfMonth = () => {
    const start = getRecurringStartDate();
    const d = new Date(start + 'T12:00:00+07:00');
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    setRecurringData(prev => ({ ...prev, startDate: start, endDate: end }));
    setRecurringPreview(null);
  };

  const toggleDayOfWeek = (day) => {
    setRecurringData(prev => {
      const set = new Set(prev.daysOfWeek);
      if (set.has(day)) { set.delete(day); } else { set.add(day); }
      return { ...prev, daysOfWeek: [...set] };
    });
    setRecurringPreview(null);
  };

  const toggleRecurringSlot = (time) => {
    setRecurringData(prev => {
      const slots = prev.timeSlots.includes(time)
        ? prev.timeSlots.filter(t => t !== time)
        : [...prev.timeSlots, time].sort();
      return { ...prev, timeSlots: slots };
    });
    setRecurringPreview(null);
  };

  const addManualTimeSlot = () => {
    const t = recurringData.manualTimeInput.trim();
    if (!/^\\d{2}:\\d{2}$/.test(t)) { alert('Định dạng giờ phải là HH:mm (ví dụ: 09:30)'); return; }
    if (!recurringData.timeSlots.includes(t)) {
      setRecurringData(prev => ({
        ...prev,
        timeSlots: [...prev.timeSlots, t].sort(),
        manualTimeInput: '',
      }));
      setRecurringPreview(null);
    }
  };

  // Expected count (computed locally, no API call)
  const recurringExpectedCount = (() => {
    const start = getRecurringStartDate();
    const end = getRecurringEndDate();
    if (!start || !end || start > end) return 0;
    const msPerDay = 86400000;
    const startMs = new Date(start + 'T00:00:00+07:00').getTime();
    const endMs   = new Date(end   + 'T00:00:00+07:00').getTime();
    const days = Math.round((endMs - startMs) / msPerDay) + 1;
    let count = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(startMs + i * msPerDay);
      const dow = new Date(d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) + 'T12:00:00+07:00').getDay();
      if (recurringData.daysOfWeek.includes(dow)) count++;
    }
    return count * recurringData.timeSlots.length;
  })();

  const handleRecurringPreview = async () => {
    if (!formData.movieId) { alert('Vui lòng chọn bộ phim.'); return; }
    if (!formData.roomId) { alert('Vui lòng chọn phòng chiếu.'); return; }
    const startDate = getRecurringStartDate();
    const endDate = getRecurringEndDate();
    if (!startDate || !endDate) { alert('Vui lòng chọn ngày bắt đầu và kết thúc.'); return; }
    if (startDate > endDate) { alert('Ngày bắt đầu phải trước ngày kết thúc.'); return; }
    if (recurringData.daysOfWeek.length === 0) { alert('Vui lòng chọn ít nhất 1 ngày trong tuần.'); return; }
    if (recurringData.timeSlots.length === 0) { alert('Vui lòng chọn ít nhất 1 khung giờ.'); return; }

    try {
      setRecurringLoading(true);
      setRecurringPreview(null);
      setPreviewRemovedKeys(new Set());
      const res = await api.post('/admin/showtimes/recurring/preview', {
        movieId: formData.movieId,
        roomId: formData.roomId,
        cinemaId: formData.cinemaId,
        formatFeature: selectedFormat || getCompatibleFormats(selectedMovie, selectedRoom)[0] || '2D Tiêu chuẩn',
        startDate,
        endDate,
        daysOfWeek: recurringData.daysOfWeek,
        timeSlots: recurringData.timeSlots,
        pricingMode: recurringData.pricingMode,
        price: formData.price,
      });
      setRecurringPreview(res.data);
      setPreviewFilter('ALL');
    } catch (err) {
      alert('Lỗi khi tạo preview: ' + (err.response?.data?.message || err.message));
    } finally {
      setRecurringLoading(false);
    }
  };

  const handleRecurringCommit = async () => {
    if (!recurringPreview) return;
    const allValid = recurringPreview.validSlots || [];
    const confirmedSlots = allValid
      .filter(s => !previewRemovedKeys.has(s.startTime + s.roomId))
      .map(s => ({
        movieId: s.movieId,
        roomId: s.roomId,
        cinemaId: formData.cinemaId,
        formatFeature: s.formatFeature,
        startTime: s.startTime,
        price: s.price,
      }));

    if (confirmedSlots.length === 0) { alert('Không có suất chiếu hợp lệ để tạo.'); return; }

    const confirmed = window.confirm(\`Xác nhận tạo \${confirmedSlots.length} suất chiếu hợp lệ?\`);
    if (!confirmed) return;

    try {
      setRecurringCommitting(true);
      const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const res = await api.post('/admin/showtimes/recurring/commit', { confirmedSlots, requestId });
      const { created = [], conflicts = [], failed = [] } = res.data;
      let msg = \`Đã tạo \${created.length} suất chiếu thành công!\`;
      if (conflicts.length > 0) msg += \`\\n\${conflicts.length} suất bị xung đột.\`;
      if (failed.length > 0) msg += \`\\n\${failed.length} suất lỗi kỹ thuật.\`;
      alert(msg);
      setIsModalOpen(false);
      setRecurringPreview(null);
      setCreateMode('single');
      await loadData();
    } catch (err) {
      alert('Lỗi khi tạo lịch chiếu: ' + (err.response?.data?.message || err.message));
    } finally {
      setRecurringCommitting(false);
    }
  };

  // Click vào ô trống trên Timeline: Tự động mở modal và điền sẵn phòng và giờ`;

if (!c.includes(handlerAnchor)) { console.error('HANDLER ANCHOR NOT FOUND'); process.exit(1); }
c = c.replace(handlerAnchor, newHandlers);

// ─── PATCH 3: Inject Segmented Control + Recurring UI inside the modal form ────
// Insert segmented control after the form opening tag and wrap single-mode UI
const formOpen = `                <form onSubmit={handleCreateShowtime} className="space-y-4 text-xs">
                  {/* 2. Movie Selection Card */}`;
const formWithSegmented = `                {/* ── Segmented Control: Một ngày / Lặp lịch chiếu ── */}
                <div className="flex rounded-xl overflow-hidden border border-slate-700/60 bg-[#080E1D] p-0.5 gap-0.5">
                  {[{ key: 'single', label: 'Một ngày' }, { key: 'recurring', label: '🔁 Lặp lịch chiếu' }].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setCreateMode(key); setRecurringPreview(null); }}
                      className={\`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                        createMode === key
                          ? 'bg-[#078CA8] text-[#F1F5F9] shadow-sm'
                          : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#192337]/60'
                      }\`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCreateShowtime} className="space-y-4 text-xs">
                  {/* 2. Movie Selection Card */}`;

if (!c.includes(formOpen)) { console.error('FORM OPEN ANCHOR NOT FOUND'); process.exit(1); }
c = c.replace(formOpen, formWithSegmented);

// ─── PATCH 4: Wrap single-mode fields in {createMode === 'single' && (...)} ───
// and inject recurring UI before the footer
// Strategy: wrap section 4 (date/time) and 5 (available slots) under single mode
// Find the room+format section start and the submit footer

const singleModeWrapStart = `                  {/* 4. Ngày chiếu và giờ bắt đầu (2 Cột tách biệt, 24 giờ) */}`;
const singleModeWrapEnd   = `                  {/* 8. Nút Hủy bỏ và Tạo suất chiếu */}
                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-[#F1F5F9] rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700/40"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingShowtime || conflictStatus.tone === 'danger' || !formData.movieId || !formData.roomId || !formData.startTime}
                      className="px-5 py-2 bg-[#078CA8] hover:bg-[#067a93] disabled:opacity-40 disabled:cursor-not-allowed text-[#F1F5F9] rounded-xl text-xs font-bold transition-all shadow-md shadow-[#078CA8]/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingShowtime ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Đang tạo suất...</span>
                        </>
                      ) : (
                        <span>Tạo suất chiếu</span>
                      )}
                    </button>
                  </div>`;

if (!c.includes(singleModeWrapStart)) { console.error('SINGLE WRAP START NOT FOUND'); process.exit(1); }
if (!c.includes(singleModeWrapEnd))   { console.error('SINGLE WRAP END NOT FOUND'); process.exit(1); }

const recurringUI = `                  {/* ══ RECURRING MODE UI ══════════════════════════════════════════════════════ */}
                  {createMode === 'recurring' && (
                    <div className="space-y-3 text-xs">

                      {/* Date range */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#94A3B8] font-semibold text-xs mb-1">Từ ngày *</label>
                          <input
                            type="date"
                            value={recurringData.startDate || viewDate}
                            onChange={e => { setRecurringData(p => ({ ...p, startDate: e.target.value })); setRecurringPreview(null); }}
                            className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-[#94A3B8] font-semibold text-xs mb-1">Đến ngày *</label>
                          <input
                            type="date"
                            value={recurringData.endDate || viewDate}
                            onChange={e => { setRecurringData(p => ({ ...p, endDate: e.target.value })); setRecurringPreview(null); }}
                            className="w-full bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Quick range picks */}
                      <div className="flex flex-wrap gap-1.5">
                        {[7, 14, 30].map(d => (
                          <button key={d} type="button" onClick={() => handleRecurringQuickRange(d)}
                            className="px-3 py-1.5 bg-[#192337] hover:bg-[#202d46] border border-slate-700/60 text-[#79D9F5] rounded-xl text-[11px] font-bold cursor-pointer transition-colors">
                            {d} ngày
                          </button>
                        ))}
                        <button type="button" onClick={handleRecurringEndOfMonth}
                          className="px-3 py-1.5 bg-[#192337] hover:bg-[#202d46] border border-slate-700/60 text-[#79D9F5] rounded-xl text-[11px] font-bold cursor-pointer transition-colors">
                          Đến cuối tháng
                        </button>
                      </div>

                      {/* Day of week selector */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[#94A3B8] font-semibold text-xs">Ngày trong tuần</span>
                          <div className="flex gap-1.5">
                            {[{ label: 'Cả tuần', days: [0,1,2,3,4,5,6] }, { label: 'T2–T6', days: [1,2,3,4,5] }, { label: 'T7–CN', days: [0,6] }].map(({ label, days }) => (
                              <button key={label} type="button"
                                onClick={() => { setRecurringData(p => ({ ...p, daysOfWeek: days })); setRecurringPreview(null); }}
                                className="text-[10px] px-2 py-0.5 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-[#79D9F5] border border-slate-700/40 rounded-lg cursor-pointer transition-colors">
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {recurringDayLabels.map(({ label, value }) => {
                            const sel = recurringData.daysOfWeek.includes(value);
                            return (
                              <button key={value} type="button" onClick={() => toggleDayOfWeek(value)}
                                className={\`w-10 h-10 rounded-xl text-xs font-bold border cursor-pointer transition-all \${
                                  sel ? 'bg-[#078CA8] text-[#F1F5F9] border-[#79D9F5]/60 shadow-sm' : 'bg-[#080E1D] text-[#94A3B8] border-slate-700/60 hover:border-[#79D9F5]/40 hover:text-[#F1F5F9]'
                                }\`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Multi-slot time selector */}
                      <div>
                        <label className="block text-[#94A3B8] font-semibold text-xs mb-2">Khung giờ chiếu</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {['08:00','09:30','10:00','11:30','13:00','14:00','15:30','16:30','18:00','19:00','20:30','21:30','22:00'].map(t => {
                            const sel = recurringData.timeSlots.includes(t);
                            return (
                              <button key={t} type="button" onClick={() => toggleRecurringSlot(t)}
                                className={\`px-3 py-2 rounded-xl text-xs font-mono font-bold border cursor-pointer transition-all \${
                                  sel ? 'bg-[#078CA8] text-white border-[#79D9F5] shadow-sm' : 'bg-[#080E1D] text-[#79D9F5] border-slate-700/60 hover:border-[#79D9F5]/60 hover:bg-[#192337]'
                                }\`}>
                                {t}
                              </button>
                            );
                          })}
                        </div>
                        {/* Manual time input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="HH:mm"
                            value={recurringData.manualTimeInput}
                            onChange={e => setRecurringData(p => ({ ...p, manualTimeInput: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualTimeSlot(); } }}
                            className="flex-1 bg-[#080E1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#79D9F5] placeholder-slate-600"
                            maxLength={5}
                          />
                          <button type="button" onClick={addManualTimeSlot}
                            className="px-3 py-2 bg-[#192337] hover:bg-[#202d46] text-[#79D9F5] border border-slate-700/60 rounded-xl text-xs font-bold cursor-pointer transition-colors">
                            + Thêm giờ
                          </button>
                        </div>
                        {/* Selected slots summary */}
                        {recurringData.timeSlots.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {recurringData.timeSlots.map(t => (
                              <span key={t} className="flex items-center gap-1 px-2 py-1 bg-[#192337] border border-[#79D9F5]/30 rounded-lg text-[11px] font-mono text-[#79D9F5]">
                                {t}
                                <button type="button" onClick={() => toggleRecurringSlot(t)}
                                  className="text-[#94A3B8] hover:text-rose-400 cursor-pointer transition-colors ml-0.5">
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pricing mode */}
                      <div className="flex items-center justify-between bg-[#080E1D] border border-slate-800 rounded-xl p-3">
                        <span className="text-[#94A3B8] font-semibold">Giá vé:</span>
                        <div className="flex items-center gap-3">
                          <div className="flex rounded-lg overflow-hidden border border-slate-700/60 bg-[#192337] p-0.5 gap-0.5">
                            {[{ key: 'fixed', label: 'Cố định' }, { key: 'auto', label: 'Tự động' }].map(({ key, label }) => (
                              <button key={key} type="button"
                                onClick={() => setRecurringData(p => ({ ...p, pricingMode: key }))}
                                className={\`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all \${
                                  recurringData.pricingMode === key
                                    ? 'bg-[#078CA8] text-white' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                                }\`}>
                                {label}
                              </button>
                            ))}
                          </div>
                          {recurringData.pricingMode === 'fixed' && (
                            <div className="flex items-center gap-1">
                              <input type="number" step="5000" min="0" value={formData.price}
                                onChange={e => setFormData(p => ({ ...p, price: Number(e.target.value) }))}
                                className="w-24 bg-[#192337] border border-slate-700 rounded-lg px-2 py-1 text-right text-[#F1F5F9] font-mono font-bold text-xs focus:outline-none focus:border-[#79D9F5]"
                              />
                              <span className="text-[#79D9F5] font-bold">₫</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Summary card */}
                      <div className="bg-[#192337] border border-[#79D9F5]/20 rounded-xl px-4 py-3 flex items-center justify-between">
                        <span className="text-[#94A3B8] text-xs">Dự kiến tạo:</span>
                        <span className="text-[#79D9F5] font-bold text-sm">
                          {recurringData.timeSlots.length > 0 && recurringData.daysOfWeek.length > 0
                            ? \`\${recurringExpectedCount} suất chiếu\`
                            : '—'}
                        </span>
                      </div>

                      {/* Preview button */}
                      <button
                        type="button"
                        onClick={handleRecurringPreview}
                        disabled={recurringLoading || recurringData.timeSlots.length === 0 || recurringData.daysOfWeek.length === 0}
                        className="w-full py-2.5 bg-[#192337] hover:bg-[#202d46] disabled:opacity-40 disabled:cursor-not-allowed border border-[#79D9F5]/40 hover:border-[#79D9F5] text-[#79D9F5] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {recurringLoading ? (
                          <><span className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" /><span>Đang kiểm tra...</span></>
                        ) : '🔍 Kiểm tra & Xem trước lịch chiếu'}
                      </button>

                      {/* Preview table */}
                      {recurringPreview && (
                        <div className="space-y-2">
                          {/* Filter + summary */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex gap-1.5">
                              {[
                                { key: 'ALL', label: \`Tất cả (\${recurringPreview.totalExpected})\` },
                                { key: 'VALID', label: \`Hợp lệ (\${recurringPreview.validCount})\` },
                                { key: 'CONFLICT', label: \`Xung đột (\${recurringPreview.conflictCount})\` },
                              ].map(({ key, label }) => (
                                <button key={key} type="button" onClick={() => setPreviewFilter(key)}
                                  className={\`px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-all \${
                                    previewFilter === key
                                      ? 'bg-[#078CA8] text-white border-[#79D9F5]/60'
                                      : 'bg-[#080E1D] text-[#94A3B8] border-slate-700/60 hover:text-[#F1F5F9]'
                                  }\`}>
                                  {label}
                                </button>
                              ))}
                            </div>
                            <span className="text-[#94A3B8] text-[11px]">
                              Hợp lệ: <span className="text-emerald-400 font-bold">{recurringPreview.validCount - previewRemovedKeys.size}</span> suất
                            </span>
                          </div>

                          {/* Table */}
                          <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl bg-[#080E1D]">
                            <table className="w-full text-[11px]">
                              <thead className="sticky top-0 bg-[#101728] border-b border-slate-800">
                                <tr>
                                  {['Ngày', 'Thứ', 'Giờ BD', 'Giờ KT', 'Phòng sẵn sàng', 'Giá', 'Trạng thái'].map(h => (
                                    <th key={h} className="px-2 py-2 text-left text-[#94A3B8] font-semibold">{h}</th>
                                  ))}
                                  <th className="px-2 py-2"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...(recurringPreview.validSlots || []), ...(recurringPreview.conflictSlots || [])]
                                  .filter(s => previewFilter === 'ALL' || s.status === previewFilter)
                                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                  .map((s, i) => {
                                    const key = s.startTime + s.roomId;
                                    const removed = previewRemovedKeys.has(key);
                                    const isConflict = s.status === 'CONFLICT';
                                    const dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
                                    const toLocalTime = (iso) => iso
                                      ? new Date(iso).toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
                                      : '—';
                                    return (
                                      <tr key={i}
                                        className={\`border-b border-slate-800/60 \${
                                          removed ? 'opacity-30 line-through' :
                                          isConflict ? 'bg-rose-500/5' : 'hover:bg-[#192337]/30'
                                        }\`}>
                                        <td className="px-2 py-1.5 font-mono text-[#F1F5F9]">{s.date}</td>
                                        <td className="px-2 py-1.5 text-[#94A3B8]">{dayNames[s.dayOfWeek]}</td>
                                        <td className="px-2 py-1.5 font-mono text-[#79D9F5]">{toLocalTime(s.startTime)}</td>
                                        <td className="px-2 py-1.5 font-mono text-[#E5C07B]">{toLocalTime(s.endTime)}</td>
                                        <td className="px-2 py-1.5 font-mono text-[#34D399]">{toLocalTime(s.cleanReadyTime)}</td>
                                        <td className="px-2 py-1.5 text-[#F1F5F9]">{s.price ? (s.price / 1000).toFixed(0) + 'k' : '—'}</td>
                                        <td className="px-2 py-1.5">
                                          {isConflict
                                            ? <span className="text-rose-400 font-bold">⚠ {s.conflictReason || 'Xung đột'}</span>
                                            : <span className="text-emerald-400 font-bold">✓ Hợp lệ</span>
                                          }
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {!isConflict && (
                                            <button type="button"
                                              onClick={() => setPreviewRemovedKeys(prev => {
                                                const next = new Set(prev);
                                                if (next.has(key)) next.delete(key); else next.add(key);
                                                return next;
                                              })}
                                              className={\`text-[10px] px-1.5 py-0.5 rounded cursor-pointer border transition-colors \${
                                                removed
                                                  ? 'text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10'
                                                  : 'text-rose-400 border-rose-500/40 hover:bg-rose-500/10'
                                              }\`}>
                                              {removed ? '↩ Khôi phục' : '× Bỏ'}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ══ SINGLE MODE — Date/Time and below ══════════════════════════════════════ */}
                  {createMode === 'single' && (<>
                  {/* 4. Ngày chiếu và giờ bắt đầu (2 Cột tách biệt, 24 giờ) */}`;

const footerReplacement = `                  {/* 8. Nút Hủy bỏ và Tạo suất chiếu */}
                  {createMode === 'single' && (<>
                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-[#F1F5F9] rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700/40"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingShowtime || conflictStatus.tone === 'danger' || !formData.movieId || !formData.roomId || !formData.startTime}
                      className="px-5 py-2 bg-[#078CA8] hover:bg-[#067a93] disabled:opacity-40 disabled:cursor-not-allowed text-[#F1F5F9] rounded-xl text-xs font-bold transition-all shadow-md shadow-[#078CA8]/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingShowtime ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Đang tạo suất...</span>
                        </>
                      ) : (
                        <span>Tạo suất chiếu</span>
                      )}
                    </button>
                  </div>
                  </>)}

                  {/* Recurring footer */}
                  {createMode === 'recurring' && (
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
                      <button type="button" onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 bg-[#192337] hover:bg-[#202d46] text-[#94A3B8] hover:text-[#F1F5F9] rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700/40">
                        Hủy bỏ
                      </button>
                      {recurringPreview && (
                        <button type="button" onClick={() => { setRecurringPreview(null); setPreviewRemovedKeys(new Set()); }}
                          className="px-4 py-2 bg-[#192337] hover:bg-[#202d46] border border-slate-700/40 text-[#94A3B8] hover:text-[#F1F5F9] rounded-xl text-xs font-semibold cursor-pointer transition-colors">
                          ← Quay lại
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleRecurringCommit}
                        disabled={recurringCommitting || !recurringPreview || (recurringPreview.validCount - previewRemovedKeys.size) === 0}
                        className="px-5 py-2 bg-[#078CA8] hover:bg-[#067a93] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
                        {recurringCommitting
                          ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Đang tạo...</span></>
                          : recurringPreview
                            ? \`Xác nhận tạo \${recurringPreview.validCount - previewRemovedKeys.size} suất hợp lệ\`
                            : 'Kiểm tra trước'}
                      </button>
                    </div>
                  )}`;

// Apply patch 4a: wrap single mode date/time section
const singleModeSectionEnd = `                  {/* 7. Khối thông tin bổ sung: Giá vé, Ngày mở bán, Kiểm tra xung đột */}
                  <div className="bg-[#080E1D] border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">`;
const singleModeSectionEndNew = `                  {/* 7. Khối thông tin bổ sung: Giá vé, Ngày mở bán, Kiểm tra xung đột */}
                  <div className="bg-[#080E1D] border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">`;

// Find section 4 and close the single-mode wrapper just before section 8
// We'll split the insertion into two steps
// Step A: add the recurringUI wrapper before section 4
const beforeSection4 = `                  {/* 4. Ngày chiếu và giờ bắt đầu (2 Cột tách biệt, 24 giờ) */}`;
if (!c.includes(beforeSection4)) { console.error('BEFORE SECTION 4 NOT FOUND'); process.exit(1); }
// Close single mode after section 7 (before section 8)
const beforeSection8 = `                  {/* 8. Nút Hủy bỏ và Tạo suất chiếu */}`;
if (!c.includes(beforeSection8)) { console.error('BEFORE SECTION 8 NOT FOUND'); process.exit(1); }

c = c.replace(beforeSection4, recurringUI);
c = c.replace(singleModeWrapEnd, `                  </>)}\n\n` + footerReplacement);

writeFileSync(p, c, 'utf8');
console.log('ShowtimeManagePage.jsx patched with Recurring UI OK');
