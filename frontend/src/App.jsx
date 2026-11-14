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

// Pages Admin (7-10 & Mở rộng đầy đủ)
import DashboardPage from './pages/admin/DashboardPage';
import MovieManagePage from './pages/admin/MovieManagePage';
import BookingManagePage from './pages/admin/BookingManagePage';
import CinemaManagePage from './pages/admin/CinemaManagePage';
import RoomManagePage from './pages/admin/RoomManagePage';
import ShowtimeManagePage from './pages/admin/ShowtimeManagePage';
import ShowtimeOccupancyPage from './pages/admin/ShowtimeOccupancyPage';
import PricingManagePage from './pages/admin/PricingManagePage';
import UserManagePage from './pages/admin/UserManagePage';
import OtpManagePage from './pages/admin/OtpManagePage';
import ChatbotManagePage from './pages/admin/ChatbotManagePage';
import ConcessionManagePage from './pages/admin/ConcessionManagePage';
import PromotionManagePage from './pages/admin/PromotionManagePage';

// Client Layout bọc Navbar, Footer và Chatbot AI (Màn hình 6)
const ClientLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
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
          element={<Navigate to="/login" state={{ from: '/admin/dashboard', adminRequired: true }} replace />}
        />

        {/* Cụm màn hình Quản trị viên (Được bảo vệ bằng AdminProtectedRoute) */}
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/movies" element={<MovieManagePage />} />
          <Route path="/admin/cinemas" element={<CinemaManagePage />} />
          <Route path="/admin/rooms" element={<RoomManagePage />} />
          <Route path="/admin/showtimes" element={<ShowtimeManagePage />} />
          <Route path="/admin/showtimes-occupancy" element={<ShowtimeOccupancyPage />} />
          <Route path="/admin/occupancy" element={<Navigate to="/admin/showtimes-occupancy" replace />} />
          <Route path="/admin/pricing" element={<PricingManagePage />} />
          <Route path="/admin/bookings" element={<BookingManagePage />} />
          <Route path="/admin/users" element={<UserManagePage />} />
          <Route path="/admin/otps" element={<OtpManagePage />} />
          <Route path="/admin/chatbot" element={<ChatbotManagePage />} />
          <Route path="/admin/concessions" element={<ConcessionManagePage />} />
          <Route path="/admin/promotions" element={<PromotionManagePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
