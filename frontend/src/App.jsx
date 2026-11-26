import React, { Suspense, lazy } from 'react';
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

// Pages Admin (Lazy-loaded để tách bundle Quản trị khỏi bundle Khách hàng)
const StatisticsPage = lazy(() => import('./pages/admin/statistics/StatisticsPage'));
const MovieManagePage = lazy(() => import('./pages/admin/MovieManagePage'));
const RoomManagePage = lazy(() => import('./pages/admin/RoomManagePage'));
const ShowtimeManagePage = lazy(() => import('./pages/admin/ShowtimeManagePage'));
const PricingManagePage = lazy(() => import('./pages/admin/PricingManagePage'));
const BookingManagePage = lazy(() => import('./pages/admin/BookingManagePage'));
const CheckInManagePage = lazy(() => import('./pages/admin/CheckInManagePage'));
const SeatManagePage = lazy(() => import('./pages/admin/SeatManagePage'));
const UserManagePage = lazy(() => import('./pages/admin/UserManagePage'));
const ConcessionManagePage = lazy(() => import('./pages/admin/ConcessionManagePage'));
const PromotionManagePage = lazy(() => import('./pages/admin/PromotionManagePage'));
const ChatbotManagePage = lazy(() => import('./pages/admin/ChatbotManagePage'));

const RouteLoadingFallback = () => (
  <div className="min-h-screen bg-[#070B1E] flex items-center justify-center text-slate-300 text-sm">
    Đang tải giao diện...
  </div>
);

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
      <Suspense fallback={<RouteLoadingFallback />}>
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
          {/* Các nhóm quản trị */}
          <Route path="/admin" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/statistics" element={<StatisticsPage />} />
          <Route path="/admin/movies" element={<MovieManagePage />} />
          <Route path="/admin/rooms" element={<RoomManagePage />} />
          <Route path="/admin/seats" element={<SeatManagePage />} />
          <Route path="/admin/chatbot" element={<ChatbotManagePage />} />

          {/* Các đường dẫn quản trị và chuyển hướng cũ */}
          <Route path="/admin/cinemas" element={<Navigate to="/admin/rooms" replace />} />
          <Route path="/admin/showtimes" element={<ShowtimeManagePage />} />
          <Route path="/admin/movie-analytics" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/dashboard" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/showtimes-occupancy" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/occupancy" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/pricing" element={<PricingManagePage />} />
          <Route path="/admin/bookings" element={<BookingManagePage />} />
          <Route path="/admin/check-in" element={<CheckInManagePage />} />
          <Route path="/admin/users" element={<UserManagePage />} />
          <Route path="/admin/otps" element={<Navigate to="/admin/statistics" replace />} />
          <Route path="/admin/concessions" element={<ConcessionManagePage />} />
          <Route path="/admin/promotions" element={<PromotionManagePage />} />
          <Route path="/admin/*" element={<Navigate to="/admin/statistics" replace />} />
        </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
