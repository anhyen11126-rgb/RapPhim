import React from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';

// Components Client & Chat
import Navbar from './components/client/Navbar';
import Footer from './components/client/Footer';
import ChatWidget from './components/chat/ChatWidget';
import AdminProtectedRoute from './components/admin/AdminProtectedRoute';
import ScrollManager from './components/common/ScrollManager';

// Pages Client (1-5 + Rạp chiếu)
import HomePage from './pages/client/HomePage';
import MovieDetailPage from './pages/client/MovieDetailPage';
import SeatSelectionPage from './pages/client/SeatSelectionPage';
import CheckoutPage from './pages/client/CheckoutPage';
import BookingSuccessPage from './pages/client/BookingSuccessPage';
import MyTicketsPage from './pages/client/MyTicketsPage';
import TheatersPage from './pages/client/TheatersPage';
import PromotionsPage from './pages/client/PromotionsPage';
import SupportPage from './pages/client/SupportPage';
import AuthPage from './pages/client/AuthPage';

// Pages Admin (4 Mục Chủ Chốt: Thống Kê · Phim · Ghế & Phòng · Chatbot)
import StatisticsPage from './pages/admin/statistics/StatisticsPage';
import MovieManagePage from './pages/admin/MovieManagePage';
import RoomManagePage from './pages/admin/RoomManagePage';
import SeatManagePage from './pages/admin/SeatManagePage';
import ChatbotManagePage from './pages/admin/ChatbotManagePage';

// Client Layout bọc Navbar, Footer và Chatbot AI (Màn hình 6)
const ClientLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-main)] text-[var(--text-main)]">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {/* Màn hình 6: Cửa sổ Chatbot AI nổi */}
      <ChatWidget />
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        {/* Cụm màn hình Khách hàng */}
        <Route element={<ClientLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/theaters" element={<TheatersPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/movie/:id" element={<MovieDetailPage />} />
          <Route path="/booking/seat/:showtimeId" element={<SeatSelectionPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/booking-success" element={<BookingSuccessPage />} />
          <Route path="/my-tickets" element={<MyTicketsPage />} />
        </Route>

        {/* Cụm màn hình Đăng ký / Đăng nhập khách hàng */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/login" element={<AuthPage initialMode="login" />} />
        <Route path="/register" element={<AuthPage initialMode="register" />} />

        {/* Redirect cổng /admin/login tự động về /login duy nhất */}
        <Route
          path="/admin/login"
          element={<Navigate to="/login" state={{ from: '/admin/statistics', adminRequired: true }} replace />}
        />

        {/* Cụm màn hình Quản trị viên (Được bảo vệ bằng AdminProtectedRoute) */}
        <Route element={<AdminProtectedRoute />}>
          {/* 4 Mục Quản Trị Chủ Chốt */}
          <Route path="/admin" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/statistics" element={<StatisticsPage />} />
          <Route path="/admin/movies" element={<MovieManagePage />} />
          <Route path="/admin/rooms" element={<RoomManagePage />} />
          <Route path="/admin/seats" element={<SeatManagePage />} />
          <Route path="/admin/chatbot" element={<ChatbotManagePage />} />

          {/* Điều hướng thông minh & khóa các URL cũ ngoài 4 mục */}
          <Route path="/admin/cinemas" element={<Navigate to="/admin/rooms" replace />} />
          <Route path="/admin/showtimes" element={<Navigate to="/admin/seats" replace />} />
          <Route path="/admin/movie-analytics" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/dashboard" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/showtimes-occupancy" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/occupancy" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/pricing" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/bookings" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/users" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/otps" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/concessions" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/promotions" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/*" element={<Navigate to="/admin/statistics" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
