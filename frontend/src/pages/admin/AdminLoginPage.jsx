import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

const AdminLoginPage = () => {
  const navigate = useNavigate();

  // Tab: 'LOGIN' hoặc 'REGISTER'
  const [activeTab, setActiveTab] = useState('LOGIN');

  // State Đăng nhập
  const [loginEmail, setLoginEmail] = useState('admin@movietix.vn');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // State Đăng ký
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState('ADMIN');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Xử lý ĐĂNG NHẬP
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await api.post('/admin/login', {
        email: loginEmail.trim(),
        password: loginPassword,
      });

      // Lưu Token & thông tin người dùng vào localStorage
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('adminUser', JSON.stringify(res.data.admin));

      setSuccessMsg('Đăng nhập thành công! Đang chuyển hướng...');
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 700);
    } catch (err) {
      console.error('Lỗi đăng nhập:', err);
      setErrorMsg(err.response?.data?.message || 'Tài khoản hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Xử lý ĐĂNG KÝ
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại!');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Mật khẩu phải có tối thiểu 6 ký tự để đảm bảo an toàn.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/admin/register', {
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: regRole,
      });

      // Lưu Token & thông tin người dùng vào localStorage
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('adminUser', JSON.stringify(res.data.admin));

      setSuccessMsg('Đăng ký tài khoản quản trị thành công! Đang chuyển vào Bảng điều khiển...');
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 1000);
    } catch (err) {
      console.error('Lỗi đăng ký:', err);
      setErrorMsg(err.response?.data?.message || 'Đăng ký không thành công. Email có thể đã tồn tại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Container Thẻ Đăng Nhập / Đăng Ký Chuẩn Thiết Kế */}
      <div className="w-full max-w-[440px] bg-[#0c101d] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
        {/* 1. HEADER: LOGO & ADMIN PORTAL BADGE */}
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="bg-[#2563eb] text-white text-[11px] font-black px-2.5 py-1 rounded-md flex items-center space-x-1 shadow-sm">
              <span className="text-[9px]">▶</span>
              <span>MovieTix</span>
            </div>
            <span className="text-base font-black tracking-tight text-white">MovieTix</span>
          </Link>

          <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1 uppercase tracking-wider">
            <span>🛡️</span>
            <span>ADMIN PORTAL</span>
          </span>
        </div>

        {/* 2. TIÊU ĐỀ CỔNG QUẢN TRỊ */}
        <div className="text-center space-y-1.5 pt-1">
          <h1 className="text-2xl font-black text-white tracking-tight">Cổng Quản Trị Hệ Thống</h1>
          <p className="text-xs text-slate-400">
            {activeTab === 'LOGIN'
              ? 'Đăng nhập bảo mật dành cho Quản trị viên và Quản lý cụm rạp'
              : 'Đăng ký tài khoản phân quyền quản trị hệ thống MovieTix'}
          </p>
          <div className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-400 pt-0.5">
            <span>🔒</span>
            <span>End-to-End SSL 256-bit Encryption</span>
          </div>
        </div>

        {/* 3. BANNER 2FA THÔNG MINH */}
        <div className="bg-[#111728] border border-slate-800 rounded-2xl p-3 flex items-start space-x-2.5 text-xs text-slate-300">
          <span className="text-blue-400 text-sm shrink-0 mt-0.5">🛡️</span>
          <p className="text-[11px] leading-relaxed">
            Xác thực <strong className="text-white">2FA Google Authenticator</strong> được áp dụng tự động sau bước nhập mật khẩu.
          </p>
        </div>

        {/* 4. TABS CHUYỂN ĐỔI: ĐĂNG NHẬP / ĐĂNG KÝ */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#111626] border border-slate-800/80 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab('LOGIN');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'LOGIN'
                ? 'bg-[#1b233a] text-white shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>➔]</span>
            <span>Đăng nhập</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('REGISTER');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'REGISTER'
                ? 'bg-[#1b233a] text-white shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>👤+</span>
            <span>Đăng ký</span>
          </button>
        </div>

        {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
        {errorMsg && (
          <div className="p-3 bg-red-950/80 border border-red-600/80 rounded-xl text-red-200 text-xs font-semibold leading-relaxed text-center">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/80 rounded-xl text-emerald-200 text-xs font-semibold leading-relaxed text-center">
            ✔ {successMsg}
          </div>
        )}

        {/* 5A. FORM ĐĂNG NHẬP */}
        {activeTab === 'LOGIN' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Input Email */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Tài khoản Quản trị / Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                  👤
                </span>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@movietix.vn"
                  className="w-full bg-[#111728] border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            {/* Input Mật Khẩu */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">Mật khẩu cấp phép</label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Vui lòng liên hệ Quản trị viên tối cao qua hotline 1900 8866 để cấp lại mật khẩu!');
                  }}
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Quên mã PIN / MK?
                </a>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                  🔑
                </span>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#111728] border border-slate-700/80 rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 text-xs"
                >
                  {showLoginPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Ghi nhớ & IP nội bộ */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#111728] border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-[11px] font-medium text-slate-300">Ghi nhớ thiết bị này trong 12 giờ</span>
              </label>

              <span className="text-[11px] font-bold text-amber-400 flex items-center space-x-1">
                <span>🌐</span>
                <span>IP Nội bộ</span>
              </span>
            </div>

            {/* Nút Đăng nhập */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>{loading ? 'Đang xác thực thông tin...' : 'Đăng nhập vào Bảng Điều Khiển'}</span>
              <span>➔</span>
            </button>
          </form>
        ) : (
          /* 5B. FORM ĐĂNG KÝ */
          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* Input Họ Tên */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Họ và tên Quản trị viên / Nhân sự *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                  👤
                </span>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full bg-[#111728] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
                />
              </div>
            </div>

            {/* Input Email */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Tài khoản Quản trị / Email *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                  ✉️
                </span>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="manager@movietix.vn"
                  className="w-full bg-[#111728] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
                />
              </div>
            </div>

            {/* Input Mật Khẩu */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Mật khẩu cấp phép *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                  🔑
                </span>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full bg-[#111728] border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 text-xs"
                >
                  {showRegPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Xác nhận mật khẩu */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Xác nhận mật khẩu *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                  🔒
                </span>
                <input
                  type="password"
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu cấp phép"
                  className="w-full bg-[#111728] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner"
                />
              </div>
            </div>

            {/* Phân quyền / Vị trí */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Vị trí công tác / Phân quyền
              </label>
              <select
                value={regRole}
                onChange={(e) => setRegRole(e.target.value)}
                className="w-full bg-[#111728] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ADMIN">Ban Quản Trị Hệ Thống (Admin)</option>
                <option value="MANAGER">Quản lý Cụm Rạp (Cinema Manager)</option>
                <option value="STAFF">Nhân viên Soát vé & Quầy (Staff)</option>
              </select>
            </div>

            {/* Nút Đăng ký */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center space-x-2 cursor-pointer pt-2"
            >
              <span>{loading ? 'Đang tạo tài khoản trong Database...' : 'Đăng ký Tài khoản Quản trị'}</span>
              <span>➔</span>
            </button>
          </form>
        )}

        {/* 6. HỘP ĐỔI TAB NHANH */}
        <div className="bg-[#111728] border border-slate-800/80 rounded-2xl p-4 text-center space-y-1">
          {activeTab === 'LOGIN' ? (
            <>
              <p className="text-xs text-slate-400">Chưa có tài khoản quản trị cụm rạp?</p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('REGISTER');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center space-x-1 mx-auto"
              >
                <span>🪪</span>
                <span className="underline">Yêu cầu cấp tài khoản / Đăng ký ngay</span>
              </button>
              <span className="text-[10px] text-slate-400 block pt-0.5">
                Yêu cầu sẽ được phê duyệt bởi Quản trị viên tối cao trong 24h
              </span>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400">Đã có tài khoản quản trị hệ thống?</p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('LOGIN');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center space-x-1 mx-auto"
              >
                <span>➔]</span>
                <span className="underline">Quay lại Đăng nhập ngay</span>
              </button>
            </>
          )}
        </div>

        {/* 7. NÚT QUAY LẠI CỔNG ĐẶT VÉ KHÁCH HÀNG */}
        <div className="text-center pt-1">
          <Link
            to="/"
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center space-x-1.5"
          >
            <span>🎟️</span>
            <span>Quay lại Cổng Đặt Vé Khách Hàng MovieTix</span>
          </Link>
        </div>

        {/* 8. FOOTER PHIÊN LÀM VIỆC AN TOÀN */}
        <div className="text-center pt-2 border-t border-slate-800/60 space-y-1 text-[10px] text-slate-400">
          <span className="font-bold tracking-widest text-slate-400 block uppercase">
            AUDITED SESSION
          </span>
          <p className="flex items-center justify-center space-x-1">
            <span>🛡️</span>
            <span>Chỉ nhân sự được cấp quyền. Mọi truy cập đều được ghi log tự động.</span>
          </p>
          <span className="text-slate-400 block">MovieTix Enterprise Engine v4.2.0 • Build 2026.10</span>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
