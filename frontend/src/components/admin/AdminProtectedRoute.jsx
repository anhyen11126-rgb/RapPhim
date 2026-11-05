import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';

const AdminProtectedRoute = () => {
  const location = useLocation();

  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const user = (() => {
    try {
      return JSON.parse(
        localStorage.getItem('user') ||
        localStorage.getItem('adminUser') ||
        sessionStorage.getItem('user') ||
        sessionStorage.getItem('adminUser') ||
        '{}'
      );
    } catch {
      return {};
    }
  })();

  const isAdmin = token && user?.role === 'ADMIN';

  if (!isAdmin) {
    // Tự động chuyển hướng về trang /login duy nhất, kèm ghi nhớ trang quản trị đang muốn vào
    return (
      <Navigate
        to="/login"
        state={{
          from: location.pathname,
          adminRequired: true,
          message: 'Vui lòng đăng nhập bằng tài khoản Quản trị viên để truy cập trang này.',
        }}
        replace
      />

    );
  }

  return <Outlet />;
};

export default AdminProtectedRoute;

