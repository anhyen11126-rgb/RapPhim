import React, { useState, useEffect } from 'react';
import SidebarAdmin from '../../components/admin/SidebarAdmin';
import TopbarAdmin from '../../components/admin/TopbarAdmin';
import api from '../../services/api';

const OtpManagePage = () => {
  const [otps, setOtps] = useState([]);
  const [senderEmail, setSenderEmail] = useState('rapphim265@gmail.com');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Bộ lọc & tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form gửi / cấp mã OTP trực tiếp từ Admin
  const [targetEmail, setTargetEmail] = useState('');
  const [otpType, setOtpType] = useState('register');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchOtps();
  }, []);

  const fetchOtps = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/otps');
      if (res.data) {
        setOtps(Array.isArray(res.data.otps) ? res.data.otps : []);
        if (res.data.senderEmail) setSenderEmail(res.data.senderEmail);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách OTP:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!targetEmail.trim()) {
      alert('Vui lòng nhập địa chỉ Gmail cần gửi mã OTP!');
      return;
    }

    try {
      setSending(true);
      const res = await api.post('/admin/otps', {
        email: targetEmail.trim(),
        type: otpType,
      });
      alert(res.data?.message || 'Đã tạo và gửi mã OTP thành công!');
      setTargetEmail('');
      fetchOtps();
    } catch (err) {
      alert('Lỗi gửi OTP: ' + (err.response?.data?.message || err.message));
    } finally {
      setSending(false);
    }
  };

  const handleResendForEmail = async (email, type) => {
    try {
      setSending(true);
      const res = await api.post('/admin/otps', { email, type });
      alert(res.data?.message || `Đã gửi lại mã OTP mới tới ${email}!`);
      fetchOtps();
    } catch (err) {
      alert('Lỗi gửi lại OTP: ' + (err.response?.data?.message || err.message));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteOtp = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa bản ghi OTP này khỏi Database?')) return;
    try {
      await api.delete(`/admin/otps/${id}`);
      fetchOtps();
    } catch (err) {
      alert('Không thể xóa OTP: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCleanupExpired = async () => {
    if (!window.confirm('Dọn dẹp toàn bộ các mã OTP đã hết hạn hoặc đã sử dụng khỏi Database?')) return;
    try {
      const res = await api.delete('/admin/otps-cleanup/expired');
      alert(res.data?.message || 'Đã dọn dẹp danh sách OTP!');
      fetchOtps();
    } catch (err) {
      alert('Không thể dọn dẹp OTP: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCopyCode = (id, code) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredOtps = otps.filter((item) => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (item.email || '').toLowerCase().includes(q) ||
      (item.code || '').toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const pendingCount = otps.filter((o) => o.status === 'PENDING').length;
  const verifiedCount = otps.filter((o) => o.status === 'VERIFIED').length;
  const expiredCount = otps.filter((o) => o.status === 'EXPIRED').length;

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <SidebarAdmin />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAdmin />

        <main className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black flex items-center gap-2">
                <span>🔐</span>
                <span>Quản Lý Mã Xác Thực OTP & Lịch Sử Gửi Gmail</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Theo dõi mã OTP Đăng ký & Quên mật khẩu thời gian thực trong Database MongoDB và kiểm tra luồng bắn Gmail.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={fetchOtps}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              >
                🔄 Làm mới
              </button>
              <button
                onClick={handleCleanupExpired}
                className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold border border-rose-500/30 transition-all cursor-pointer"
              >
                🧹 Dọn mã hết hạn ({expiredCount + verifiedCount})
              </button>
            </div>
          </div>

          {/* 4 Thẻ thống kê trạng thái OTP & Tổng đài Gmail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] uppercase font-bold text-slate-400">Tổng đài Gmail gửi OTP</span>
              <div className="text-sm font-black text-blue-400 truncate mt-1">{senderEmail}</div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                <span>●</span>
                <span>SMTP TLS (Port 465) Sẵn sàng</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] uppercase font-bold text-slate-400">Đang chờ xác thực (5 phút)</span>
              <div className="text-2xl font-black text-amber-400 mt-1">{pendingCount} mã</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Mã đang còn hiệu lực nhập</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] uppercase font-bold text-slate-400">Đã xác thực thành công</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">{verifiedCount} mã</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Khách đã nhập đúng mã OTP</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] uppercase font-bold text-slate-400">Tổng bản ghi trong DB</span>
              <div className="text-2xl font-black text-white mt-1">{otps.length} bản ghi</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Lưu trữ tại bảng OtpVerification</div>
            </div>
          </div>

          {/* Khung Cấp & Gửi thử mã OTP trực tiếp về Gmail điện thoại */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>📨</span>
              <span>Cấp mới / Gửi mã OTP trực tiếp về Gmail khách hàng</span>
            </h2>
            <form onSubmit={handleSendOtp} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <input
                  type="email"
                  required
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="Nhập địa chỉ Gmail người nhận (VD: tenban@gmail.com)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-3">
                <select
                  value={otpType}
                  onChange={(e) => setOtpType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="register">Đăng ký tài khoản mới</option>
                  <option value="reset_password">Khôi phục quên mật khẩu</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                >
                  {sending ? 'Đang gửi Gmail...' : '🚀 Tạo & Gửi OTP'}
                </button>
              </div>
            </form>
          </div>

          {/* Bộ lọc & Tìm kiếm */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'ALL', label: `Tất cả (${otps.length})` },
                { key: 'PENDING', label: `Đang hiệu lực (${pendingCount})` },
                { key: 'VERIFIED', label: `Đã xác thực (${verifiedCount})` },
                { key: 'EXPIRED', label: `Hết hạn (${expiredCount})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Tìm theo Email hoặc mã 6 số..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
              />
            </div>
          </div>

          {/* Bảng danh sách mã OTP trong Database */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/90 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3.5">Email nhận OTP</th>
                    <th className="px-4 py-3.5">Loại xác thực</th>
                    <th className="px-4 py-3.5">Mã OTP (6 số)</th>
                    <th className="px-4 py-3.5">Trạng thái Gmail</th>
                    <th className="px-4 py-3.5">Trạng thái mã</th>
                    <th className="px-4 py-3.5">Thời gian tạo / Hết hạn</th>
                    <th className="px-4 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-10 text-center text-slate-400">
                        Đang tải dữ liệu OTP từ Database...
                      </td>
                    </tr>
                  ) : filteredOtps.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-10 text-center text-slate-500">
                        Chưa có bản ghi OTP nào khớp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredOtps.map((item) => {
                      const isRegister = item.type !== 'reset_password';
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-white">{item.email}</div>
                            <div className="text-[11px] text-slate-500">
                              Gửi từ: {item.senderEmail || senderEmail}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                                isRegister
                                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                  : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                              }`}
                            >
                              {isRegister ? '📝 Đăng ký TK' : '🔑 Quên mật khẩu'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-base tracking-widest text-amber-400 bg-slate-950 border border-amber-500/30 px-3 py-1 rounded-lg">
                                {item.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyCode(item.id, item.code)}
                                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                title="Sao chép mã OTP"
                              >
                                {copiedId === item.id ? '✓ Đã chép' : '📋'}
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {item.emailSent ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                                <span>✓</span>
                                <span>Đã gửi về Gmail</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg"
                                title={item.errorMessage || 'Chưa gửi qua SMTP'}
                              >
                                <span>⚠️</span>
                                <span>Lưu trên DB</span>
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {item.status === 'PENDING' && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">
                                <span>⏳</span>
                                <span>Đang hiệu lực</span>
                              </span>
                            )}
                            {item.status === 'VERIFIED' && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                                <span>✓</span>
                                <span>Đã xác thực</span>
                              </span>
                            )}
                            {item.status === 'EXPIRED' && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">
                                <span>✕</span>
                                <span>Đã hết hạn</span>
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                            <div>
                              Tạo lúc:{' '}
                              <span className="text-slate-200 font-medium">
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleString('vi-VN')
                                  : '---'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Hết hạn:{' '}
                              {item.expiresAt
                                ? new Date(item.expiresAt).toLocaleTimeString('vi-VN')
                                : '---'}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              disabled={sending}
                              onClick={() => handleResendForEmail(item.email, item.type)}
                              className="text-xs bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors font-semibold cursor-pointer"
                            >
                              🔄 Gửi lại
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOtp(item.id)}
                              className="text-xs bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors font-semibold cursor-pointer"
                            >
                              🗑️ Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default OtpManagePage;

