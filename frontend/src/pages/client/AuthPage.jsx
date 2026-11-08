import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';

const AuthPage = ({ initialMode = 'login' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Xác định mode dựa trên URL: /register -> 'register', /login -> 'login'
  const isInitialRegister = location.pathname === '/register' || initialMode === 'register';
  const [mode, setMode] = useState(isInitialRegister ? 'register' : 'login');

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
    confirmPassword: '',
    agreeTerms: false, // Để trống mặc định để người dùng tự tay tích chọn
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ===================== STATE XỬ LÝ OTP =====================
  // 1. Quên mật khẩu qua OTP
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Nhập email/SĐT, 2: Nhập OTP, 3: Đặt mật khẩu mới
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtpInput, setForgotOtpInput] = useState('');
  const [forgotGeneratedOtp, setForgotGeneratedOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotCountdown, setForgotCountdown] = useState(60);

  // 2. Xác thực OTP khi Đăng ký tài khoản
  const [showRegisterOtpModal, setShowRegisterOtpModal] = useState(false);
  const [registerOtpInput, setRegisterOtpInput] = useState('');
  const [registerGeneratedOtp, setRegisterGeneratedOtp] = useState('');
  const [registerCountdown, setRegisterCountdown] = useState(60);
  const [registerOtpLoading, setRegisterOtpLoading] = useState(false);
  const [registerOtpError, setRegisterOtpError] = useState('');

  // Đếm ngược 60 giây cho OTP Quên mật khẩu
  useEffect(() => {
    let timer;
    if (showForgotModal && forgotStep === 2 && forgotCountdown > 0) {
      timer = setInterval(() => {
        setForgotCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showForgotModal, forgotStep, forgotCountdown]);

  // Đếm ngược 60 giây cho OTP Đăng ký
  useEffect(() => {
    let timer;
    if (showRegisterOtpModal && registerCountdown > 0) {
      timer = setInterval(() => {
        setRegisterCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showRegisterOtpModal, registerCountdown]);

  // 1. Kiểm tra nếu đã có phiên đăng nhập hợp lệ thì tự động chuyển hướng
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const user = (() => {
      try {
        return JSON.parse(
          localStorage.getItem('user') ||
          localStorage.getItem('adminUser') ||
          sessionStorage.getItem('user') ||
          '{}'
        );
      } catch {
        return null;
      }
    })();

    if (token && user?.id) {
      if (user.role === 'ADMIN') {
        const target = location.state?.from || '/admin/dashboard';
        navigate(target, { replace: true });
      } else {
        const target = location.state?.from?.startsWith('/admin') ? '/' : (location.state?.from || '/');
        navigate(target, { replace: true });
      }
    }
  }, [navigate, location.state]);

  // 2. Đồng bộ mode khi URL thay đổi (VD: người dùng nhấn Back / Forward trình duyệt)
  useEffect(() => {
    if (location.pathname === '/register') {
      setMode('register');
    } else if (location.pathname === '/login') {
      setMode('login');
    }
  }, [location.pathname]);

  // Chuyển đổi qua lại giữa Đăng nhập & Đăng ký kèm cập nhật URL mượt mà
  const handleSwitchMode = (targetMode) => {
    setMode(targetMode);
    setErrorMsg('');
    setSuccessMsg('');
    navigate(targetMode === 'register' ? '/register' : '/login', {
      state: location.state,
      replace: true,
    });
  };

  // Đánh giá độ mạnh mật khẩu trực quan
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '', width: '0%' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[a-zA-Z]/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

    if (score <= 2) {
      return { score: 1, label: 'Mật khẩu yếu', color: 'bg-rose-500', text: 'text-rose-400', width: '33%' };
    }
    if (score <= 3) {
      return { score: 2, label: 'Mật khẩu vừa phải', color: 'bg-amber-500', text: 'text-amber-400', width: '66%' };
    }
    return { score: 3, label: 'Mật khẩu mạnh & an toàn', color: 'bg-emerald-500', text: 'text-emerald-400', width: '100%' };
  };

  const passwordStrength = getPasswordStrength(registerForm.password);

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
        const isAdmin = res.data.user.role === 'ADMIN';

        // Áp dụng đúng chuẩn "Ghi nhớ đăng nhập":
        if (loginForm.rememberMe) {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          if (isAdmin) localStorage.setItem('adminUser', JSON.stringify(res.data.user));
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('adminUser');
        } else {
          sessionStorage.setItem('token', res.data.token);
          sessionStorage.setItem('user', JSON.stringify(res.data.user));
          if (isAdmin) sessionStorage.setItem('adminUser', JSON.stringify(res.data.user));
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('adminUser');
        }

        // Bắn sự kiện đồng bộ toàn bộ app
        window.dispatchEvent(new Event('authChange'));

        // Xác định trang chuyển tiếp
        let target = location.state?.from || (isAdmin ? '/admin/dashboard' : '/');

        // Nếu là khách hàng bình thường nhưng cố truy cập admin -> điều hướng về trang chủ
        if (!isAdmin && target.startsWith('/admin')) {
          target = '/';
        }

        const isRedirectingBack = target !== '/' && target !== '/login' && target !== '/register';

        setSuccessMsg(
          isAdmin
            ? 'Đăng nhập Ban Quản Trị thành công! Đang chuyển hướng vào Bảng điều khiển...'
            : isRedirectingBack
              ? `${res.data.message || 'Đăng nhập thành công!'} Đang chuyển bạn trở lại trang bạn vừa xem...`
              : (res.data.message || 'Đăng nhập thành công! Chào mừng bạn trở lại.')
        );

        setTimeout(() => {
          navigate(target, { replace: true });
        }, 800);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  // ===================== XỬ LÝ OTP QUA EMAIL (QUÊN MẬT KHẨU) =====================
  // 1. Mở modal Quên mật khẩu
  const handleOpenForgotModal = () => {
    setForgotStep(1);
    setForgotIdentifier(loginForm.identifier.includes('@') ? loginForm.identifier.trim() : '');
    setForgotOtpInput('');
    setForgotGeneratedOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setForgotCountdown(60);
    setShowForgotModal(true);
  };

  // 2. Gửi mã OTP xác thực qua Email
  const handleSendForgotOtp = async (e) => {
    e?.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const emailTrim = forgotIdentifier.trim();
    if (!emailTrim) {
      setForgotError('Vui lòng nhập địa chỉ Email đăng ký tài khoản của bạn.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      setForgotError('Địa chỉ Email không đúng định dạng hợp lệ (VD: tenban@gmail.com).');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await api.post('/auth/send-email-otp', {
        email: emailTrim,
        type: 'reset_password',
      });

      setForgotStep(2);
      setForgotCountdown(30);
      setForgotOtpInput('');
      setForgotError('');
      setForgotSuccess(res.data?.message || `Mã xác thực OTP đã được gửi đến hộp thư: ${emailTrim}`);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setForgotLoading(false);
    }
  };

  // 3. Xác thực mã OTP Email Quên mật khẩu
  const handleVerifyForgotOtp = async (e) => {
    e?.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotOtpInput.trim()) {
      setForgotError('Vui lòng nhập mã OTP 6 chữ số gửi về Email của bạn.');
      return;
    }

    try {
      setForgotLoading(true);
      await api.post('/auth/verify-email-otp', {
        email: forgotIdentifier.trim(),
        otp: forgotOtpInput.trim(),
      });
      setForgotSuccess('Xác thực OTP qua Email thành công! Vui lòng tạo mật khẩu mới.');
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn! Vui lòng kiểm tra lại hòm thư Email.');
    } finally {
      setForgotLoading(false);
    }
  };

  // 4. Lưu mật khẩu mới sau khi xác thực OTP thành công
  const handleResetPassword = async (e) => {
    e?.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotNewPassword) {
      setForgotError('Vui lòng nhập mật khẩu mới.');
      return;
    }

    if (forgotNewPassword.length < 6) {
      setForgotError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Mật khẩu xác nhận không khớp! Vui lòng kiểm tra lại.');
      return;
    }

    try {
      setForgotLoading(true);
      // Gọi API backend đặt lại mật khẩu với xác thực email
      await api.post('/auth/reset-password', {
        email: forgotIdentifier.trim(),
        newPassword: forgotNewPassword,
        otp: forgotOtpInput.trim(),
      });

      setForgotSuccess('Cập nhật mật khẩu thành công! Đang chuyển bạn về đăng nhập...');
      setTimeout(() => {
        setShowForgotModal(false);
        setLoginForm((prev) => ({ ...prev, identifier: forgotIdentifier.trim(), password: '' }));
        setSuccessMsg('Đổi mật khẩu thành công! Vui lòng nhập mật khẩu mới để đăng nhập.');
      }, 1200);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Có lỗi xảy ra khi đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setForgotLoading(false);
    }
  };

  // ===================== XỬ LÝ OTP QUA EMAIL KHI ĐĂNG KÝ =====================
  // Bước 1: Validate Form Đăng ký & Gửi OTP qua Email
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!registerForm.name.trim() || !registerForm.email.trim() || !registerForm.phone.trim() || !registerForm.password) {
      setErrorMsg('Vui lòng điền đầy đủ tất cả các trường (*).');
      return;
    }

    // Kiểm tra định dạng Email chuẩn
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerForm.email.trim())) {
      setErrorMsg('Địa chỉ Email không đúng định dạng hợp lệ (VD: tenban@gmail.com).');
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

    if (registerForm.password !== registerForm.confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp! Vui lòng kiểm tra lại ô Xác nhận mật khẩu.');
      return;
    }

    if (!registerForm.agreeTerms) {
      setErrorMsg('Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật để tiếp tục.');
      return;
    }

    // Gửi mã OTP xác thực qua Email
    try {
      setLoading(true);
      const res = await api.post('/auth/send-email-otp', {
        email: registerForm.email.trim(),
        type: 'register',
      });

      setRegisterOtpInput('');
      setRegisterCountdown(30);
      setRegisterOtpError('');
      setShowRegisterOtpModal(true);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Bước 2: Xác nhận mã OTP Email và gửi API tạo tài khoản chính thức
  const handleConfirmRegisterOtp = async (e) => {
    e?.preventDefault();
    setRegisterOtpError('');

    if (!registerOtpInput.trim()) {
      setRegisterOtpError('Vui lòng nhập mã OTP 6 chữ số gửi về hộp thư Email của bạn.');
      return;
    }

    try {
      setRegisterOtpLoading(true);
      // Xác thực mã OTP qua Email với server
      await api.post('/auth/verify-email-otp', {
        email: registerForm.email.trim(),
        otp: registerOtpInput.trim(),
      });
    } catch (err) {
      setRegisterOtpError(err.response?.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn! Vui lòng kiểm tra lại hòm thư Email.');
      setRegisterOtpLoading(false);
      return;
    }

    const cleanPhone = registerForm.phone.replace(/[\s.-]/g, '');

    try {
      setRegisterOtpLoading(true);
      const res = await api.post('/auth/register', {
        name: registerForm.name.trim(),
        email: registerForm.email.trim(),
        phone: cleanPhone,
        password: registerForm.password,
        confirmPassword: registerForm.confirmPassword,
      });

      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');

        setShowRegisterOtpModal(false);

        const target = location.state?.from || '/';
        const isRedirectingBack = target !== '/' && target !== '/login' && target !== '/register';

        setSuccessMsg(
          isRedirectingBack
            ? `${res.data.message || 'Xác thực OTP Email & Đăng ký thành công!'} Đang chuyển bạn trở lại trang bạn vừa xem...`
            : (res.data.message || "Xác thực OTP Email & Đăng ký thành công! Chào mừng bạn gia nhập D'AVENOR CINEMA.")
        );

        window.dispatchEvent(new Event('authChange'));

        setTimeout(() => {
          navigate(target, { replace: true });
        }, 900);
      }
    } catch (err) {
      setRegisterOtpError(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setRegisterOtpLoading(false);
    }
  };

  const redirectFrom = location.state?.from;
  const isBackToPage = redirectFrom && redirectFrom !== '/' && redirectFrom !== '/login' && redirectFrom !== '/register';

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
      {/* 1. TOP HEADER */}
      <div className="max-w-[1380px] w-full mx-auto flex items-center justify-between py-2">
        {/* Nút quay lại Trang chủ hoặc trang trước */}
        <Link
          to={redirectFrom || '/'}
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors"
        >
          <span>←</span>
          <span>{isBackToPage ? 'Quay lại trang trước' : 'Về trang chủ'}</span>
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
        <div className="bg-[#0c1220] border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
          {/* CỘT TRÁI (5 cols): BANNER ĐẶC QUYỀN VIP PASS */}
          <div className="lg:col-span-5 relative p-8 sm:p-10 flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#12192e] via-[#0d1424] to-[#080d18] border-b lg:border-b-0 lg:border-r border-slate-800/80">
            {/* Background ambient */}
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

              {/* Thông báo nếu đang đăng nhập để quay lại trang đặt vé */}
              {isBackToPage && (
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-1">
                  <div className="flex items-center space-x-1.5 text-blue-400 font-bold text-xs">
                    <span>💡</span>
                    <span>Bạn đang tiếp tục tiến trình:</span>
                  </div>
                  <p className="text-[11px] text-slate-300 break-all truncate">
                    Sau khi đăng nhập xong, hệ thống sẽ tự động đưa bạn quay lại đúng trang này.
                  </p>
                </div>
              )}

              {/* 3 Lợi ích nổi bật */}
              <div className="space-y-4 pt-2">
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

            {/* Social proof */}
            <div className="relative pt-6 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-3">
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
            {/* Top Bar: Nút Đóng & Nút Toggle Tab đồng bộ URL */}
            <div className="flex items-center justify-between">
              <div className="bg-[#121929] border border-slate-800 p-1 rounded-2xl flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${mode === 'login'
                    ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket"></i>
                  <span>Đăng nhập</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${mode === 'register'
                    ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <span>👤</span>
                  <span>Đăng ký</span>
                </button>
              </div>

              {/* Quay lại */}
              <Link
                to={redirectFrom || '/'}
                className="text-xs text-slate-400 hover:text-white transition-colors bg-[#121929] hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-800"
              >
                ✕ Đóng
              </Link>
            </div>

            {/* Thông báo nếu được chuyển từ trang Quản trị Admin */}
            {location.state?.adminRequired && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-500/20 via-amber-500/15 to-red-500/20 border border-red-500/40 text-red-200 text-xs space-y-1.5 animate-in fade-in">
                <div className="flex items-center space-x-1.5 font-bold text-red-400">
                  <span>🛡️</span>
                  <span>YÊU CẦU XÁC THỰC QUẢN TRỊ VIÊN</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {location.state?.message || 'Trang bạn đang truy cập yêu cầu tài khoản Ban Quản Trị. Vui lòng đăng nhập để tiếp tục.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLoginForm({ identifier: 'admin@davenor.vn', password: 'admin123', rememberMe: true });
                    setErrorMsg('');
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline inline-flex items-center space-x-1 cursor-pointer pt-0.5"
                >
                  <span>⚡ Bấm để điền nhanh tài khoản Admin mặc định (admin@davenor.vn)</span>
                </button>
              </div>
            )}

            {/* Thông báo Lỗi / Thành công */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-200">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-200">
                <span>🎉</span>
                <span>{successMsg}</span>
              </div>
            )}

            {/* FORM ĐĂNG NHẬP (LOGIN) */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">Chào mừng bạn trở lại!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Nhập thông tin xác thực để truy cập kho vé và quyền lợi hội viên D'AVENOR.
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
                        className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-11 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors [&::-ms-reveal]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
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
                        className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>Ghi nhớ đăng nhập trên thiết bị này</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleOpenForgotModal}
                      className="text-blue-400 hover:text-blue-300 hover:underline text-xs cursor-pointer font-medium"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Đang xác thực tài khoản...</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng nhập ngay</span>
                      <span>➔</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* FORM ĐĂNG KÝ (REGISTER) */
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">Tạo tài khoản D'AVENOR CINEMA mới!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Trở thành hội viên để tích điểm thưởng và nhận voucher xem phim độc quyền.
                  </p>
                </div>

                <div className="space-y-2.5 pt-1">
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
                        className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                          className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
                          className={`w-full bg-[#111726] border rounded-xl pl-10 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${registerForm.phone && !/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(registerForm.phone.replace(/[\s.-]/g, ''))
                            ? 'border-amber-500/80 focus:border-amber-500'
                            : 'border-slate-700/80 focus:border-blue-500'
                            }`}
                        />
                      </div>
                      {registerForm.phone && !/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(registerForm.phone.replace(/[\s.-]/g, '')) && (
                        <p className="text-[10px] text-amber-400 mt-0.5 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>SĐT phải gồm 10 chữ số (đầu 03, 05, 07, 08, 09 hoặc +84)</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Cặp ô Mật khẩu & Nhập lại Mật khẩu */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                          className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 [&::-ms-reveal]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors text-xs cursor-pointer"
                        >
                          {showPassword ? (
                            <i className="fa-solid fa-eye"></i>
                          ) : (
                            <i className="fa-solid fa-eye-slash"></i>
                          )}
                        </button>
                      </div>

                      {/* Thanh đo độ mạnh mật khẩu */}
                      {registerForm.password && (
                        <div className="mt-1 space-y-0.5">
                          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${passwordStrength.color} transition-all duration-300`}
                              style={{ width: passwordStrength.width }}
                            />
                          </div>
                          <span className={`text-[10px] ${passwordStrength.text} font-medium block`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Xác nhận mật khẩu *
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                          🔐
                        </span>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={registerForm.confirmPassword}
                          onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                          placeholder="Nhập lại mật khẩu"
                          className={`w-full bg-[#111726] border rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors [&::-ms-reveal]:hidden [&::-webkit-contacts-auto-fill-button]:hidden ${registerForm.confirmPassword && registerForm.password !== registerForm.confirmPassword
                            ? 'border-rose-500/80 focus:border-rose-500'
                            : registerForm.confirmPassword && registerForm.password === registerForm.confirmPassword
                              ? 'border-emerald-500/80 focus:border-emerald-500'
                              : 'border-slate-700/80 focus:border-blue-500'
                            }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors text-xs cursor-pointer"
                        >
                          {showConfirmPassword ? (
                            <i className="fa-solid fa-eye"></i>
                          ) : (
                            <i className="fa-solid fa-eye-slash"></i>
                          )}
                        </button>
                      </div>

                      {/* Kiểm tra khớp mật khẩu Real-time */}
                      {registerForm.confirmPassword && (
                        <p
                          className={`text-[10px] mt-0.5 flex items-center space-x-1 font-semibold ${registerForm.password === registerForm.confirmPassword
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                            }`}
                        >
                          <span>{registerForm.password === registerForm.confirmPassword ? '✓' : '⚠️'}</span>
                          <span>
                            {registerForm.password === registerForm.confirmPassword
                              ? 'Mật khẩu trùng khớp'
                              : 'Mật khẩu xác nhận chưa khớp'}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start space-x-2 cursor-pointer text-[11px] text-slate-400 leading-tight">
                      <input
                        type="checkbox"
                        checked={registerForm.agreeTerms}
                        onChange={(e) => setRegisterForm({ ...registerForm, agreeTerms: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 mt-0.5 cursor-pointer"
                      />
                      <span>
                        Tôi đồng ý với <a href="#terms" className="text-blue-400 hover:underline">Điều khoản dịch vụ</a> và <a href="#privacy" className="text-blue-400 hover:underline">Chính sách bảo mật</a> của D'AVENOR CINEMA.
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Đang tạo tài khoản...</span>
                    </>
                  ) : (
                    <>
                      <span>Tạo tài khoản ngay</span>
                      <span>➔</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* HOẶC TIẾP TỤC VỚI SOCIAL */}
            <div className="space-y-4 pt-1">
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
                  onClick={() => alert("Đăng nhập nhanh với Google đang được liên kết tài khoản rạp!")}
                  className="bg-[#121929] hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <span className="text-red-500 font-bold">G</span>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => alert("Đăng nhập nhanh với Facebook đang được liên kết tài khoản rạp!")}
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
                    Bạn chưa có tài khoản D'AVENOR?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('register')}
                      className="text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      Đăng ký ngay
                    </button>
                  </p>
                ) : (
                  <p>
                    Bạn đã có tài khoản rồi?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('login')}
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

      {/* ================= MODAL QUÊN MẬT KHẨU QUA EMAIL OTP ================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0c1220] border border-slate-700/80 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative space-y-5">
            {/* Nút Đóng Modal */}
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors cursor-pointer"
            >
              ✕
            </button>

            {/* Header Modal */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg">
                ✉️
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">Khôi phục mật khẩu qua Email</h3>
                <p className="text-xs text-slate-400">Nhận mã bảo mật OTP gửi về hộp thư Email</p>
              </div>
            </div>

            {/* Thanh tiến trình Stepper 3 bước */}
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-1 border-b border-slate-800 pb-3">
              <span className={forgotStep === 1 ? 'text-blue-400 font-extrabold' : forgotStep > 1 ? 'text-emerald-400' : ''}>
                1. Nhập Email
              </span>
              <span>➔</span>
              <span className={forgotStep === 2 ? 'text-blue-400 font-extrabold' : forgotStep > 2 ? 'text-emerald-400' : ''}>
                2. Xác thực OTP Email
              </span>
              <span>➔</span>
              <span className={forgotStep === 3 ? 'text-blue-400 font-extrabold' : ''}>
                3. Đổi mật khẩu
              </span>
            </div>

            {/* Thông báo Lỗi / Thành công trong Modal */}
            {forgotError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center space-x-2">
                <span>⚠️</span>
                <span>{forgotError}</span>
              </div>
            )}
            {forgotSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center space-x-2">
                <span>✓</span>
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* BƯỚC 1: NHẬP ĐỊA CHỈ EMAIL */}
            {forgotStep === 1 && (
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                    Địa chỉ Email đăng ký tài khoản *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                      ✉️
                    </span>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="tenban@gmail.com"
                      className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Hệ thống sẽ gửi mã xác thực OTP 6 chữ số đến hộp thư Email này để bảo vệ tài khoản.
                  </p>
                </div>

                <div className="flex items-center space-x-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-3 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-2/3 bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Đang gửi mã...</span>
                      </>
                    ) : (
                      <>
                        <span>Gửi mã OTP qua Email</span>
                        <span>➔</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* BƯỚC 2: NHẬP MÃ OTP 6 CHỮ SỐ GỬI VỀ EMAIL */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                <div className="bg-[#111726] p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Mã xác thực đã được gửi đến hộp thư <strong className="text-blue-400">{forgotIdentifier}</strong>.
                  </p>
                  <p className="text-[10px] text-amber-400/90 flex items-center gap-1">
                    <span>💡</span>
                    <span>Hãy kiểm tra thêm mục <strong>Thư rác (Spam)</strong> nếu chưa thấy ở Hộp thư đến.</span>
                  </p>
                </div>


                {/* Không hiển thị mã OTP trên giao diện - bắt buộc lấy mã từ hộp thư Gmail */}

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5 text-center">
                    Nhập mã xác thực 6 chữ số từ Email
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    required
                    value={forgotOtpInput}
                    onChange={(e) => setForgotOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full bg-[#111726] border border-slate-700/80 rounded-xl py-3 text-center text-xl font-mono font-black tracking-[0.5em] text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Đếm ngược và Gửi lại mã liền mạch, tinh tế */}
                <div className="text-center text-xs text-slate-400 pt-1">
                  <span>Chưa nhận được email? </span>
                  {forgotCountdown > 0 ? (
                    <span className="text-slate-500 font-semibold font-mono">
                      Gửi lại sau ({forgotCountdown}s)
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendForgotOtp}
                      className="text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer transition-colors ml-1"
                    >
                      Gửi lại mã ngay
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-3 rounded-xl transition-colors cursor-pointer"
                  >
                    Đổi email
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-2/3 bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Đang xác thực...</span>
                      </>
                    ) : (
                      <>
                        <span>Xác thực OTP Email</span>
                        <span>➔</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* BƯỚC 3: ĐẶT MẬT KHẨU MỚI */}
            {forgotStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Mật khẩu mới *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                      🔒
                    </span>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors text-xs cursor-pointer"
                    >
                      {showForgotNewPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Xác nhận mật khẩu mới *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                      🔐
                    </span>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full bg-[#111726] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  {forgotConfirmPassword && (
                    <p className={`text-[10px] mt-1 font-semibold ${forgotNewPassword === forgotConfirmPassword ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {forgotNewPassword === forgotConfirmPassword ? '✓ Mật khẩu trùng khớp' : '⚠️ Mật khẩu xác nhận chưa khớp'}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {forgotLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Đang cập nhật mật khẩu...</span>
                    </>
                  ) : (
                    <>
                      <span>Cập nhật mật khẩu mới</span>
                      <span>➔</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL XÁC THỰC OTP QUA EMAIL KHI ĐĂNG KÝ ================= */}
      {showRegisterOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0c1220] border border-slate-700/80 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative space-y-5">
            {/* Nút Đóng Modal */}
            <button
              type="button"
              onClick={() => setShowRegisterOtpModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors cursor-pointer"
            >
              ✕
            </button>

            {/* Header Modal */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg">
                ✉️
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">Xác thực Email kích hoạt tài khoản</h3>
                <p className="text-xs text-slate-400">Mã OTP bảo mật được gửi trực tiếp đến Email</p>
              </div>
            </div>

            <div className="bg-[#111726] p-3 rounded-xl border border-slate-800 space-y-1.5">
              <p className="text-xs text-slate-300 leading-relaxed">
                Mã xác thực OTP đã được gửi đến địa chỉ email: <strong className="text-blue-400 font-bold">{registerForm.email}</strong>. Vui lòng mở hộp thư email để lấy mã kích hoạt tài khoản.
              </p>
              <p className="text-[11px] text-amber-400/90 flex items-center gap-1.5">
                <span>💡</span>
                <span>Lưu ý: Nếu không thấy ở Hộp thư đến, vui lòng kiểm tra thêm mục <strong>Thư rác (Spam)</strong> hoặc <strong>Quảng cáo</strong> nhé!</span>
              </p>
            </div>


            {/* Không hiển thị mã OTP trên giao diện - bắt buộc lấy mã từ hộp thư Gmail */}

            {/* Thông báo lỗi nếu có */}
            {registerOtpError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center space-x-2">
                <span>⚠️</span>
                <span>{registerOtpError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmRegisterOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5 text-center">
                  Nhập mã OTP 6 chữ số từ Email
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  required
                  value={registerOtpInput}
                  onChange={(e) => setRegisterOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full bg-[#111726] border border-slate-700/80 rounded-xl py-3 text-center text-xl font-mono font-black tracking-[0.5em] text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Đếm ngược và Gửi lại mã liền mạch, tinh tế */}
              <div className="text-center text-xs text-slate-400 pt-1">
                <span>Chưa nhận được email? </span>
                {registerCountdown > 0 ? (
                  <span className="text-slate-500 font-semibold font-mono">
                    Gửi lại sau ({registerCountdown}s)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post('/auth/send-email-otp', {
                          email: registerForm.email.trim(),
                          type: 'register',
                        });
                        setRegisterCountdown(30);
                        setRegisterOtpInput('');
                        setRegisterOtpError('');
                      } catch (err) {
                        setRegisterOtpError(err.response?.data?.message || 'Không thể gửi lại OTP. Vui lòng thử lại.');
                      }
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer transition-colors ml-1"
                  >
                    Gửi lại mã ngay
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterOtpModal(false)}
                  className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-3.5 rounded-xl transition-colors cursor-pointer"
                >
                  Sửa thông tin
                </button>
                <button
                  type="submit"
                  disabled={registerOtpLoading}
                  className="w-2/3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {registerOtpLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Đang kích hoạt...</span>
                    </>
                  ) : (
                    <>
                      <span>Xác nhận & Tạo tài khoản</span>
                      <span>➔</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;
