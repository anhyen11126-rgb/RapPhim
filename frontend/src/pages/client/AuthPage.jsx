import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';

const AuthPage = ({ initialMode = 'login' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: 'login' hoặc 'register'
  const [mode, setMode] = useState(initialMode);

  // Form Đăng nhập
  const [loginForm, setLoginForm] = useState({
    identifier: '',
    password: '',
    rememberMe: true,
  });

  // Form Đăng ký
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    agreeTerms: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Xử lý Đăng nhập
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!loginForm.identifier.trim() || !loginForm.password) {
      setErrorMsg('Vui lòng nhập Email hoặc Số điện thoại và mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/login', {
        identifier: loginForm.identifier.trim(),
        password: loginForm.password,
      });

      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        setSuccessMsg(res.data.message || 'Đăng nhập thành công!');

        // Dispatch sự kiện để Navbar tự cập nhật mà không cần reload
        window.dispatchEvent(new Event('authChange'));

        setTimeout(() => {
          navigate(location.state?.from || '/');
        }, 800);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý Đăng ký
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!registerForm.name.trim() || !registerForm.email.trim() || !registerForm.phone.trim() || !registerForm.password) {
      setErrorMsg('Vui lòng điền đầy đủ tất cả các trường (*).');
      return;
    }

    // Kiểm tra định dạng số điện thoại Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)
    const cleanPhone = registerForm.phone.replace(/[\s.-]/g, '');
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setErrorMsg('Số điện thoại không hợp lệ! Vui lòng nhập số điện thoại Việt Nam gồm 10 chữ số (bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84).');
      return;
    }

    if (registerForm.password.length < 6) {
      setErrorMsg('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (!registerForm.agreeTerms) {
      setErrorMsg('Vui lòng đồng ý với Điều khoản sử dụng để tiếp tục.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/register', {
        name: registerForm.name.trim(),
        email: registerForm.email.trim(),
        phone: cleanPhone,
        password: registerForm.password,
      });

      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        setSuccessMsg(res.data.message || 'Đăng ký tài khoản thành công!');

        // Dispatch sự kiện để Navbar tự cập nhật
        window.dispatchEvent(new Event('authChange'));

        setTimeout(() => {
          navigate('/');
        }, 1000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
      {/* 1. TOP HEADER */}
      <div className="max-w-[1380px] w-full mx-auto flex items-center justify-between py-2">
        {/* Nút quay lại Trang chủ */}
        <Link
          to="/"
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors"
        >
          <span>←</span>
          <span>Back to Movies</span>
        </Link>

        {/* Logo D'AVENOR CINEMA */}
        <Link to="/" className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#101726] border border-slate-700/80 flex items-center justify-center shadow-md">
            <img
              src="/Logo.png"
              alt="D'AVENOR CINEMA Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-sm sm:text-base font-black tracking-tight text-white hidden sm:inline">
            D'AVENOR CINEMA
          </span>
        </Link>

        {/* Cinema Pass text */}
        <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500">
          CINEMA PASS
        </span>
      </div>

      {/* 2. MAIN CARD: 2 CỘT CHÍNH */}
      <div className="max-w-[1140px] w-full mx-auto my-auto py-6">
        <div className="bg-[#0c1220] border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
          {/* CỘT TRÁI (5 cols): BANNER ĐẶC QUYỀN VIP PASS */}
          <div className="lg:col-span-5 relative p-8 sm:p-10 flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#12192e] via-[#0d1424] to-[#080d18] border-b lg:border-b-0 lg:border-r border-slate-800/80">
            {/* Background image & gradient ambient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/15 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative space-y-6">
              {/* Badge VIP Pass */}
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2563eb] text-white flex items-center justify-center font-black text-xs shadow-md">
                  🎟️
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-white text-sm">D'AVENOR</span>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                      VIP PASS
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    Hệ sinh thái rạp chiếu phim kỹ thuật số
                  </span>
                </div>
              </div>

              {/* Headline */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black tracking-widest uppercase text-blue-400 block">
                  CINEMA EXPERIENCE
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  Trải nghiệm điện ảnh đỉnh cao trong tầm tay bạn.
                </h2>
              </div>

              {/* 3 Lợi ích nổi bật */}
              <div className="space-y-4 pt-2">
                {/* Lợi ích 1 */}
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-sm shrink-0 mt-0.5 text-amber-400">
                    ⭐
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-black text-white">Tích điểm 5% mọi đơn hàng</h4>
                      <span className="bg-amber-500/20 text-amber-400 text-[9px] font-bold px-1.5 py-0.2 rounded">
                        GOLD TIER
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Tích lũy bắp nước & vé xem phim, thăng hạng Diamond nhận bắp nước miễn phí mỗi tháng.
                    </p>
                  </div>
                </div>

                {/* Lợi ích 2 */}
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-sm shrink-0 mt-0.5 text-blue-400">
                    🎟️
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-white">Check-in QR Code siêu tốc</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Lưu vé điện tử tức thì vào ví Movie Pass, quét mã vào phòng chiếu trong 1 giây không cần xếp hàng.
                    </p>
                  </div>
                </div>

                {/* Lợi ích 3 */}
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm shrink-0 mt-0.5 text-emerald-400">
                    🤖
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-white">Trợ lý AI gợi ý phim & chọn ghế</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Phân tích khẩu vị điện ảnh, giữ chỗ vị trí tầm nhìn vàng trung tâm (Sweet spot) tự động.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social proof bên dưới */}
            <div className="relative pt-6 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Avatars stack */}
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-[#0c1220] flex items-center justify-center text-[10px] font-black text-white">
                    AD
                  </div>
                  <div className="w-7 h-7 rounded-full bg-emerald-600 border-2 border-[#0c1220] flex items-center justify-center text-[10px] font-black text-white">
                    TL
                  </div>
                  <div className="w-7 h-7 rounded-full bg-amber-600 border-2 border-[#0c1220] flex items-center justify-center text-[10px] font-black text-white">
                    HN
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-1 text-xs font-bold text-white">
                    <span>500,000+</span>
                    <span className="text-blue-400 text-[10px]">✔</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block font-medium">Tín đồ điện ảnh tin dùng</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-amber-400 text-xs">★★★★★</div>
                <span className="text-[11px] font-black text-white">4.9 / 5</span>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (7 cols): FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
          <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-6">
            {/* Top Bar: Nút Đóng & Nút Toggle Tab */}
            <div className="flex items-center justify-between">
              {/* Tab Toggle Chuyển Đổi Đăng nhập / Đăng ký */}
              <div className="bg-[#121929] border border-slate-800 p-1 rounded-2xl flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${mode === 'login'
                    ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket"></i>
                  <span>Đăng nhập</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${mode === 'register'
                    ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <span>👤</span>
                  <span>Đăng ký</span>
                </button>
              </div>

              {/* Quay lại Trang chủ */}
              <Link
                to="/"
                className="text-xs text-slate-400 hover:text-white transition-colors bg-[#121929] hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-800"
              >
                Quay lại Trang chủ ✕
              </Link>
            </div>

            {/* Thông báo Lỗi / Thành công */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                🎉 {successMsg}
              </div>
            )}

            {/* FORM ĐĂNG NHẬP (LOGIN) */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">Chào mừng bạn trở lại!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Nhập thông tin xác thực để truy cập kho vé và ưu đãi độc quyền.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Email hoặc Số điện thoại *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                        ✉️
                      </span>
                      <input
                        type="text"
                        required
                        value={loginForm.identifier}
                        onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                        placeholder="nguyen.van.a@example.com hoặc 0912..."
                        className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Mật khẩu *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                        🔒
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-11 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors text-xs cursor-pointer"
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? (
                          <i className="fa-solid fa-eye"></i>
                        ) : (
                          <i className="fa-solid fa-eye-slash"></i>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={loginForm.rememberMe}
                        onChange={(e) => setLoginForm({ ...loginForm, rememberMe: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                      />
                      <span>Ghi nhớ đăng nhập</span>
                    </label>

                    <a href="#forgot" className="text-blue-400 hover:underline text-xs">
                      Quên mật khẩu?
                    </a>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>{loading ? 'Đang xác thực...' : 'Đăng nhập ngay'}</span>
                  <span>➔</span>
                </button>
              </form>
            ) : (
              /* FORM ĐĂNG KÝ (REGISTER) */
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">Tạo tài khoản D'AVENOR CINEMA mới!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Trở thành hội viên để nhận ngay voucher 50.000đ và tích điểm xem phim.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Họ và tên *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                        👤
                      </span>
                      <input
                        type="text"
                        required
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                        placeholder="Nguyễn Văn A"
                        className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Email *
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                          ✉️
                        </span>
                        <input
                          type="email"
                          required
                          value={registerForm.email}
                          onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                          placeholder="nguyen.van.a@example.com"
                          className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Số điện thoại *
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                          📞
                        </span>
                        <input
                          type="tel"
                          required
                          value={registerForm.phone}
                          onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                          placeholder="0912 345 678"
                          className={`w-full bg-[#111726] border rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${registerForm.phone && !/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(registerForm.phone.replace(/[\s.-]/g, ''))
                              ? 'border-amber-500/80 focus:border-amber-500'
                              : 'border-slate-700/80 focus:border-blue-500'
                            }`}
                        />
                      </div>
                      {registerForm.phone && !/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(registerForm.phone.replace(/[\s.-]/g, '')) && (
                        <p className="text-[10px] text-amber-400 mt-1 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>SĐT phải gồm 10 chữ số (đầu 03, 05, 07, 08, 09 hoặc +84)</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Mật khẩu *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                        🔒
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        placeholder="Tối thiểu 6 ký tự"
                        className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-11 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors text-xs cursor-pointer"
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? (
                          <i className="fa-solid fa-eye"></i>
                        ) : (
                          <i className="fa-solid fa-eye-slash"></i>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start space-x-2 cursor-pointer text-[11px] text-slate-400 leading-tight">
                      <input
                        type="checkbox"
                        checked={registerForm.agreeTerms}
                        onChange={(e) => setRegisterForm({ ...registerForm, agreeTerms: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 mt-0.5"
                      />
                      <span>
                        Tôi đồng ý với <a href="#terms" className="text-blue-400 hover:underline">Điều khoản sử dụng</a> và <a href="#privacy" className="text-blue-400 hover:underline">Chính sách bảo mật</a> của D'AVENOR CINEMA.
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>{loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản ngay'}</span>
                  <span>➔</span>
                </button>
              </form>
            )}

            {/* HOẶC TIẾP TỤC VỚI SOCIAL */}
            <div className="space-y-4 pt-2">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-[#0c1220] px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                  HOẶC TIẾP TỤC VỚI
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => alert('Đăng nhập Google hiện đang được kết nối với tài khoản rạp!')}
                  className="bg-[#121929] hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <span className="text-red-500 font-bold">G</span>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => alert('Đăng nhập Facebook hiện đang được kết nối với tài khoản rạp!')}
                  className="bg-[#121929] hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <span className="text-blue-500 font-bold">f</span>
                  <span>Facebook</span>
                </button>
              </div>

              {/* Chuyển đổi giữa Đăng ký và Đăng nhập */}
              <div className="text-center text-xs text-slate-400 pt-1">
                {mode === 'login' ? (
                  <p>
                    Bạn chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      Đăng ký ngay
                    </button>
                  </p>
                ) : (
                  <p>
                    Bạn đã có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      Đăng nhập ngay
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FOOTER */}
      <div className="text-center py-2 text-[11px] text-slate-500">
        © 2026 D'AVENOR CINEMA Entertainment Group. Secure Cinematic Gateway.
      </div>
    </div>
  );
};

export default AuthPage;

