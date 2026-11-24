import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { KeyRound, LockKeyhole, LogIn, Mail, Phone, UserRound, X } from 'lucide-react';
import AuthLayout, { AuthDialog, AuthField, AuthMessage, AuthSubmit, SocialIcon } from '../../components/auth/AuthLayout';


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
    rememberMe: false,
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
        const target = (isBackToPage ? redirectFrom : '/admin/dashboard');
        navigate(target, { replace: true });
      } else {
        const target = redirectFrom.startsWith('/admin') ? '/' : redirectFrom;
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
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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
    if (loading) return;
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
        let target = isBackToPage ? redirectFrom : (isAdmin ? '/admin/dashboard' : '/');

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
        otp: forgotOtpInput.trim(), type: 'reset_password',
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
    if (loading) return;
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
      await api.post('/auth/send-email-otp', {
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
    if (registerOtpLoading) return;
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
        otp: registerOtpInput.trim(),
      });

      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');

        setShowRegisterOtpModal(false);

        const target = redirectFrom.startsWith('/admin') ? '/' : redirectFrom;
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

  const redirectFrom = typeof location.state?.from === 'string' && /^\/(?!\/)/.test(location.state.from)
    ? location.state.from : '/';
  const isBackToPage = !['/', '/login', '/register', '/auth'].includes(redirectFrom);
  const isRegister = mode === 'register';
  const legalDocument = location.hash === '#dieu-khoan' ? 'terms'
    : location.hash === '#bao-mat' ? 'privacy' : null;
  const legalLink = (hash) => ({ pathname: location.pathname, search: location.search, hash });
  const closeLegal = () => navigate(legalLink(''), { replace: true, state: location.state });
  const updateRegister = (field, event) => {
    const { value } = event.target;
    setRegisterForm(current => ({ ...current, [field]: value }));
  };

  return (
    <>
      <AuthLayout>
        <section className="auth-panel" data-mode={mode} aria-labelledby="auth-heading">
          <div className="auth-toolbar">
            <div className="auth-tabs" data-register={isRegister} role="group" aria-label="Chọn chế độ xác thực">
              <button type="button" aria-pressed={!isRegister} disabled={loading} onClick={() => handleSwitchMode('login')}><LogIn /> Đăng nhập</button>
              <button type="button" aria-pressed={isRegister} disabled={loading} onClick={() => handleSwitchMode('register')}><UserRound /> Đăng ký</button>
            </div>
            <Link to={isBackToPage ? redirectFrom : '/'} state={location.state?.returnState} className="auth-close"><X size={16} /> Đóng</Link>
          </div>

          <div key={mode} className="auth-content">
            <h1 id="auth-heading">{isRegister ? 'Tạo tài khoản D’AVENOR' : 'Chào mừng bạn trở lại!'}</h1>
            <p className="auth-intro">{isRegister
              ? 'Chỉ vài bước để trở thành thành viên của D’AVENOR CINEMA.'
              : 'Nhập thông tin xác thực để truy cập kho vé và quyền lợi hội viên D’AVENOR.'}</p>
            <AuthMessage error={errorMsg} success={successMsg} />

            {isRegister ? (
              <form className="auth-form" onSubmit={handleRegister}>
                <AuthField label="Họ và tên" icon={UserRound} autoComplete="name" placeholder="Nhập họ và tên của bạn"
                  value={registerForm.name} onChange={event => updateRegister('name', event)} />
                <AuthField label="Email" icon={Mail} type="email" autoComplete="email" placeholder="Ví dụ your@email.com"
                  value={registerForm.email} onChange={event => updateRegister('email', event)} />
                <AuthField label="Số điện thoại" icon={Phone} type="tel" autoComplete="tel" placeholder="Ví dụ 0912 345 678"
                  value={registerForm.phone} onChange={event => updateRegister('phone', event)} />
                <div className="auth-password-grid">
                  <AuthField label="Mật khẩu" icon={LockKeyhole} type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                    minLength={6} placeholder="Tối thiểu 6 ký tự" value={registerForm.password} onChange={event => updateRegister('password', event)}
                    isVisible={showPassword} onToggle={() => setShowPassword(value => !value)} />
                  <AuthField label="Xác nhận mật khẩu" icon={LockKeyhole} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password"
                    minLength={6} placeholder="Nhập lại mật khẩu" value={registerForm.confirmPassword} onChange={event => updateRegister('confirmPassword', event)}
                    isVisible={showConfirmPassword} onToggle={() => setShowConfirmPassword(value => !value)} />
                </div>
                {registerForm.password && <div className="auth-strength">
                  <progress value={passwordStrength.score} max={3} aria-label="Độ mạnh mật khẩu" />
                  <span>{passwordStrength.label}</span>
                </div>}
                <label className="auth-check">
                  <input type="checkbox" required checked={registerForm.agreeTerms} onChange={event => setRegisterForm(current => ({ ...current, agreeTerms: event.target.checked }))} />
                  <span>Tôi đồng ý với{' '}
                    <Link to={legalLink('#dieu-khoan')} replace state={location.state}>Điều khoản sử dụng</Link>{' và '}
                    <Link to={legalLink('#bao-mat')} replace state={location.state}>Chính sách bảo mật</Link>{' của D’AVENOR.'}
                  </span>
                </label>
                <AuthSubmit busy={loading}>Đăng ký tài khoản</AuthSubmit>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleLogin}>
                <AuthField label="Email hoặc Số điện thoại" icon={Mail} autoComplete="username" placeholder="nguyen.van.a@example.com hoặc 0912…"
                  value={loginForm.identifier} onChange={event => setLoginForm(current => ({ ...current, identifier: event.target.value }))} />
                <AuthField label="Mật khẩu" icon={LockKeyhole} type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="Nhập mật khẩu" value={loginForm.password} onChange={event => setLoginForm(current => ({ ...current, password: event.target.value }))}
                  isVisible={showPassword} onToggle={() => setShowPassword(value => !value)} />
                <div className="auth-form-options">
                  <label className="auth-check"><input type="checkbox" checked={loginForm.rememberMe}
                    onChange={event => setLoginForm(current => ({ ...current, rememberMe: event.target.checked }))} /> Ghi nhớ đăng nhập trên thiết bị này</label>
                  <button type="button" className="auth-link" onClick={handleOpenForgotModal}>Quên mật khẩu?</button>
                </div>
                <AuthSubmit busy={loading}>Đăng nhập ngay</AuthSubmit>
              </form>
            )}

            <div className="auth-divider">{isRegister ? 'Hoặc đăng ký bằng' : 'Hoặc tiếp tục với'}</div>
            <div className="auth-social" aria-describedby="auth-social-status">
              <button type="button" disabled><SocialIcon provider="google" /> Google</button>
              <button type="button" disabled><SocialIcon provider="facebook" /> Facebook</button>
            </div>
            <p id="auth-social-status" className="auth-social-status">Đăng nhập qua Google và Facebook chưa khả dụng.</p>
            <p className="auth-switch">
              {isRegister ? 'Bạn đã có tài khoản?' : 'Bạn chưa có tài khoản D’AVENOR?'}{' '}
              <button type="button" disabled={loading} onClick={() => handleSwitchMode(isRegister ? 'login' : 'register')}>
                {isRegister ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
              </button>
            </p>
          </div>
        </section>
      </AuthLayout>

      {legalDocument && (
        <AuthDialog key={legalDocument}
          title={legalDocument === 'terms' ? 'Điều khoản sử dụng' : 'Chính sách bảo mật'}
          onClose={closeLegal}>
          <div className="auth-legal-copy">
            {legalDocument === 'terms' ? <>
              <p>Tài khoản D’AVENOR dùng để đặt vé và xem vé điện tử. Hãy kiểm tra phim, giờ chiếu, ghế và số tiền trước khi xác nhận thanh toán.</p>
              <p>Hãy giữ bí mật mật khẩu và mã xác thực của bạn.</p>
            </> : <>
              <p>Khi tạo tài khoản, hệ thống lưu họ tên, email và số điện thoại để quản lý tài khoản. Email được dùng để gửi mã xác thực đăng ký hoặc khôi phục mật khẩu.</p>
              <p>Ô Ghi nhớ đăng nhập cho phép trình duyệt giữ phiên đăng nhập trên thiết bị này.</p>
            </>}
            <p>Đây là thông tin tóm tắt. <Link to="/support">Liên hệ D’AVENOR</Link> để hỏi về văn bản chính thức.</p>
          </div>
        </AuthDialog>
      )}

      {showForgotModal && (
        <AuthDialog title="Khôi phục mật khẩu" onClose={() => setShowForgotModal(false)}>
          <p className="auth-intro">{forgotStep === 1 ? 'Nhập email đã đăng ký để nhận mã OTP.'
            : forgotStep === 2 ? 'Nhập mã gồm 6 chữ số gửi tới ' + forgotIdentifier : 'Tạo mật khẩu mới cho tài khoản của bạn.'}</p>
          <AuthMessage error={forgotError} success={forgotSuccess} />
          <form className="auth-form" onSubmit={[handleSendForgotOtp, handleVerifyForgotOtp, handleResetPassword][forgotStep - 1]}>
            {forgotStep === 1 && <AuthField label="Email" icon={Mail} type="email" autoComplete="email" value={forgotIdentifier}
              onChange={event => setForgotIdentifier(event.target.value)} />}
            {forgotStep === 2 && <>
              <AuthField label="Mã OTP" icon={KeyRound} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
                value={forgotOtpInput} onChange={event => setForgotOtpInput(event.target.value.replace(/\D/g, ''))} />
              <button className="auth-link" type="button" disabled={forgotCountdown > 0 || forgotLoading} onClick={handleSendForgotOtp}>
                {forgotCountdown > 0 ? 'Gửi lại sau ' + forgotCountdown + ' giây' : 'Gửi lại mã'}
              </button>
            </>}
            {forgotStep === 3 && <>
              <AuthField label="Mật khẩu mới" icon={LockKeyhole} type={showForgotNewPassword ? 'text' : 'password'} autoComplete="new-password"
                minLength={6} value={forgotNewPassword} onChange={event => setForgotNewPassword(event.target.value)}
                isVisible={showForgotNewPassword} onToggle={() => setShowForgotNewPassword(value => !value)} />
              <AuthField label="Xác nhận mật khẩu mới" icon={LockKeyhole} type={showForgotNewPassword ? 'text' : 'password'} autoComplete="new-password"
                minLength={6} value={forgotConfirmPassword} onChange={event => setForgotConfirmPassword(event.target.value)} />
            </>}
            <AuthSubmit busy={forgotLoading}>{['Gửi mã xác thực', 'Xác minh mã', 'Đặt lại mật khẩu'][forgotStep - 1]}</AuthSubmit>
          </form>
        </AuthDialog>
      )}

      {showRegisterOtpModal && (
        <AuthDialog title="Xác thực email" onClose={() => setShowRegisterOtpModal(false)}>
          <p className="auth-intro">Nhập mã gồm 6 chữ số đã gửi tới <strong>{registerForm.email}</strong>.</p>
          <AuthMessage error={registerOtpError} />
          <form className="auth-form" onSubmit={handleConfirmRegisterOtp}>
            <AuthField label="Mã OTP" icon={KeyRound} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
              value={registerOtpInput} onChange={event => setRegisterOtpInput(event.target.value.replace(/\D/g, ''))} />
            <button className="auth-link" type="button" disabled={registerCountdown > 0 || loading || registerOtpLoading} onClick={handleRegister}>
              {registerCountdown > 0 ? 'Gửi lại sau ' + registerCountdown + ' giây' : 'Gửi lại mã'}
            </button>
            <AuthSubmit busy={registerOtpLoading}>Xác thực và tạo tài khoản</AuthSubmit>
          </form>
        </AuthDialog>
      )}
    </>
  );
};

export default AuthPage;
