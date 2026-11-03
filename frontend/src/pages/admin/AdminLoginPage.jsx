import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@davenor.vn');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await api.post('/admin/login', { email, password });
      // Lưu JWT Token vào localStorage
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('adminUser', JSON.stringify(res.data.admin));

      navigate('/admin/dashboard');
    } catch (err) {
      console.error('Lỗi đăng nhập admin:', err);
      setErrorMsg(err.response?.data?.message || 'Đăng nhập không thành công. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-white">
        <div className="text-center mb-8">
          <span className="text-xs uppercase font-bold text-red-500 tracking-widest">Quản trị hệ thống</span>
          <h1 className="text-3xl font-black text-white mt-1">D'AVENOR ADMIN</h1>
          <p className="text-slate-400 text-xs mt-1">Đăng nhập tài khoản quản lý rạp chiếu phim</p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 bg-red-950/80 border border-red-600 rounded-xl text-red-200 text-xs text-center">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Email quản trị
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500 text-sm"
              placeholder="admin@davenor.vn"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-11 py-2.5 text-white focus:outline-none focus:border-red-500 text-sm"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors text-xs cursor-pointer"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? (
                  <i className="fa-solid fa-eye-slash"></i>
                ) : (
                  <i className="fa-solid fa-eye"></i>
                )}
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 text-[11px] text-slate-400">
            💡 Tài khoản mặc định: <br />
            Email: <strong className="text-slate-200">admin@davenor.vn</strong> | Mật khẩu: <strong className="text-slate-200">admin123</strong>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-lg hover:shadow-red-600/30"
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập trang quản trị'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
