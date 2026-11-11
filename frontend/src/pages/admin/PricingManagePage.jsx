import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';
import { DEFAULT_PRICING_CONFIG, setCachedPricingConfig } from '../../utils/pricing';

const FORMAT_ORDER = [
  { key: '2D', badge: 'bg-blue-600/20 text-blue-300 border-blue-500/30', icon: '🎬' },
  { key: '3D', badge: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30', icon: '👓' },
  { key: 'IMAX', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: '⚡' },
  { key: 'GOLD_CLASS', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '👑' },
];

const TIME_SLOT_LABELS = [
  { key: 'before17', label: 'Trước 17:00' },
  { key: 'goldenHour', label: 'Giờ vàng (17:00 – 21:59)' },
  { key: 'lateNight', label: 'Suất khuya (từ 22:00)' },
];

const PricingManagePage = () => {
  const [config, setConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyToExistingShowtimes, setApplyToExistingShowtimes] = useState(true);
  const [statusBanner, setStatusBanner] = useState(null);

  useEffect(() => {
    fetchPricingConfig();
  }, []);

  const fetchPricingConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/pricing');
      if (res.data?.config?.formats) {
        setConfig(res.data.config);
        setCachedPricingConfig(res.data.config);
      }
    } catch (err) {
      console.error('Lỗi tải cấu hình bảng giá vé:', err);
      setStatusBanner({
        type: 'error',
        text: 'Không thể tải cấu hình bảng giá vé từ Database.',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDaySlotPrice = (fmtKey, dayKey, slotKey, value) => {
    const numVal = Math.max(0, Number(value) || 0);
    setConfig((prev) => ({
      ...prev,
      formats: {
        ...prev.formats,
        [fmtKey]: {
          ...prev.formats[fmtKey],
          [dayKey]: {
            ...prev.formats[fmtKey][dayKey],
            [slotKey]: numVal,
          },
        },
      },
    }));
  };

  const updateSeatSurcharge = (fmtKey, field, value) => {
    const numVal = Math.max(0, Number(value) || 0);
    setConfig((prev) => ({
      ...prev,
      formats: {
        ...prev.formats,
        [fmtKey]: {
          ...prev.formats[fmtKey],
          [field]: numVal,
        },
      },
    }));
  };

  // Kiểm tra bất biến 2D < 3D < IMAX trước khi lưu
  const hierarchyIssues = (() => {
    const issues = [];
    const f2D = config.formats?.['2D'];
    const f3D = config.formats?.['3D'];
    const fImax = config.formats?.IMAX;
    if (!f2D || !f3D || !fImax) return issues;

    for (const dayKey of ['weekday', 'weekend']) {
      const dayLabel = dayKey === 'weekday' ? 'Thứ 2–5' : 'Thứ 6–CN';
      for (const slot of TIME_SLOT_LABELS) {
        if (Number(f3D[dayKey][slot.key]) <= Number(f2D[dayKey][slot.key])) {
          issues.push(`${dayLabel} (${slot.label}): Giá 3D phải cao hơn 2D`);
        }
        if (Number(fImax[dayKey][slot.key]) <= Number(f3D[dayKey][slot.key])) {
          issues.push(`${dayLabel} (${slot.label}): Giá IMAX phải cao hơn 3D`);
        }
      }
    }
    return issues;
  })();

  const handleSave = async (e) => {
    e.preventDefault();
    if (hierarchyIssues.length > 0) {
      setStatusBanner({
        type: 'error',
        text: `Không thể lưu vì cấu hình chưa hợp lệ: ${hierarchyIssues[0]}`,
      });
      return;
    }

    try {
      setSaving(true);
      setStatusBanner(null);
      const res = await api.put('/admin/pricing', {
        formats: config.formats,
        holidaySurcharge: config.holidaySurcharge,
        note: config.note,
        applyToExistingShowtimes,
      });

      if (res.data?.config) {
        setConfig(res.data.config);
        setCachedPricingConfig(res.data.config);
      }

      setStatusBanner({
        type: 'success',
        text: res.data?.message || 'Đã cập nhật bảng giá vé thành công!',
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err.response?.data?.message || 'Lỗi khi lưu cấu hình giá vé!',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetRecommended = () => {
    setConfig((prev) => ({
      ...prev,
      formats: DEFAULT_PRICING_CONFIG.formats,
      holidaySurcharge: DEFAULT_PRICING_CONFIG.holidaySurcharge,
    }));
    setStatusBanner({
      type: 'info',
      text: 'Đã nạp mức giá tiêu chuẩn đề xuất (2D < RealD 3D < IMAX < Gold Class). Bấm "Lưu & Đồng bộ giá vé" để áp dụng vào Database.',
    });
  };

  return (
    <div className="flex bg-slate-950 min-h-screen text-white">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />
        <main className="p-6 flex-1 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                <span>💰</span>
                <span>Quản Lý Bảng Giá Vé & Phụ Thu Ghế Ngồi</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Cấu hình động từ MongoDB — Mọi thay đổi được đồng bộ trực tiếp tới trang Rạp chiếu, Đặt ghế, Suất chiếu và Chatbot AI.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleResetRecommended}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer transition-colors"
              >
                ↺ Khôi phục mức chuẩn
              </button>
              <button
                type="button"
                onClick={fetchPricingConfig}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer transition-colors"
              >
                🔄 Tải lại
              </button>
            </div>
          </div>

          {statusBanner && (
            <div
              className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
                statusBanner.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : statusBanner.type === 'error'
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
              }`}
            >
              <span>{statusBanner.text}</span>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {hierarchyIssues.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs space-y-1">
              <div className="font-black">⚠️ Phát hiện mức giá chưa hợp lý theo phân hạng phòng chiếu:</div>
              {hierarchyIssues.slice(0, 3).map((msg, i) => (
                <div key={i}>• {msg}</div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Đang tải bảng giá vé từ Database...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {FORMAT_ORDER.map(({ key, badge, icon }) => {
                const rule = config.formats?.[key];
                if (!rule) return null;

                return (
                  <div
                    key={key}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
                  >
                    {/* Header định dạng */}
                    <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black border ${badge}`}>
                          {icon} {key}
                        </span>
                        <div>
                          <h2 className="text-sm sm:text-base font-black text-white">{rule.label}</h2>
                          <span className="text-[11px] text-slate-400">{rule.roomTypeLabel}</span>
                        </div>
                      </div>

                      {/* Phụ thu hạng ghế VIP & Sweetbox */}
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <label className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-xl">
                          <span className="text-amber-400 font-bold">Phụ thu VIP (+):</span>
                          <input
                            type="number"
                            step="5000"
                            min="0"
                            value={rule.vipSurcharge}
                            onChange={(e) => updateSeatSurcharge(key, 'vipSurcharge', e.target.value)}
                            className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                          />
                        </label>
                        <label className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-xl">
                          <span className="text-pink-400 font-bold">Sweetbox (2×Thường +):</span>
                          <input
                            type="number"
                            step="5000"
                            min="0"
                            value={rule.sweetboxExtra}
                            onChange={(e) => updateSeatSurcharge(key, 'sweetboxExtra', e.target.value)}
                            className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Bảng nhập giá Ngày thường vs Cuối tuần */}
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {[
                        { dayKey: 'weekday', title: '📅 Thứ 2 – Thứ 5 (Ngày thường)', accent: 'text-blue-400' },
                        { dayKey: 'weekend', title: '🌟 Thứ 6 – Chủ Nhật (Cuối tuần)', accent: 'text-amber-400' },
                      ].map(({ dayKey, title, accent }) => (
                        <div
                          key={dayKey}
                          className="bg-slate-950/60 border border-slate-800/80 rounded-xl overflow-hidden"
                        >
                          <div className={`px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-black ${accent}`}>
                            {title}
                          </div>
                          <div className="p-3 space-y-2.5">
                            {TIME_SLOT_LABELS.map((slot) => {
                              const stdVal = Number(rule[dayKey]?.[slot.key] || 0);
                              const vipVal = stdVal + Number(rule.vipSurcharge || 0);
                              const sbVal = stdVal * 2 + Number(rule.sweetboxExtra || 0);

                              return (
                                <div
                                  key={slot.key}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/70"
                                >
                                  <div>
                                    <div className="text-xs font-bold text-white">{slot.label}</div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      VIP: <strong className="text-amber-400">{vipVal.toLocaleString('vi-VN')}đ</strong> • Sweetbox:{' '}
                                      <strong className="text-pink-400">{sbVal.toLocaleString('vi-VN')}đ</strong>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400">Ghế thường:</span>
                                    <input
                                      type="number"
                                      step="5000"
                                      min="0"
                                      value={stdVal}
                                      onChange={(e) => updateDaySlotPrice(key, dayKey, slot.key, e.target.value)}
                                      className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-right font-mono text-xs font-black text-emerald-400 focus:outline-none focus:border-blue-500"
                                    />
                                    <span className="text-xs text-slate-400 font-bold">đ</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Tùy chọn đồng bộ & Lưu */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="font-bold text-white">Phụ thu Ngày Lễ / Tết (+):</span>
                      <input
                        type="number"
                        step="5000"
                        min="0"
                        value={config.holidaySurcharge ?? 15000}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            holidaySurcharge: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-white"
                      />
                      <span>đ</span>
                    </label>
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyToExistingShowtimes}
                      onChange={(e) => setApplyToExistingShowtimes(e.target.checked)}
                      className="w-4 h-4 rounded accent-red-600 cursor-pointer"
                    />
                    <span>
                      Tự động đồng bộ lại <strong>giá suất chiếu sắp tới</strong> &{' '}
                      <strong>khoảng giá phòng chiếu</strong> trong MongoDB theo bảng giá mới
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving || hierarchyIssues.length > 0}
                  className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-black shadow-lg shadow-red-600/25 cursor-pointer shrink-0 transition-all"
                >
                  {saving ? 'Đang lưu & đồng bộ...' : '💾 Lưu & Đồng Bộ Bảng Giá Vé'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default PricingManagePage;

