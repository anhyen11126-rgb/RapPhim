import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

// Components Client & Chat
import Navbar from './components/client/Navbar';
import Footer from './components/client/Footer';
import ChatWidget from './components/chat/ChatWidget';

// Pages Client (1-5 + Rạp chiếu)
import HomePage from './pages/client/HomePage';
import MovieDetailPage from './pages/client/MovieDetailPage';
import SeatSelectionPage from './pages/client/SeatSelectionPage';
import CheckoutPage from './pages/client/CheckoutPage';
import BookingSuccessPage from './pages/client/BookingSuccessPage';
import TheatersPage from './pages/client/TheatersPage';
import PromotionsPage from './pages/client/PromotionsPage';

// Pages Admin (7-10)
import AdminLoginPage from './pages/admin/AdminLoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import MovieManagePage from './pages/admin/MovieManagePage';
import BookingManagePage from './pages/admin/BookingManagePage';

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
      <Routes>
        {/* Cụm màn hình Khách hàng */}
        <Route element={<ClientLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/theaters" element={<TheatersPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/movie/:id" element={<MovieDetailPage />} />
          <Route path="/booking/seat/:showtimeId" element={<SeatSelectionPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/booking-success" element={<BookingSuccessPage />} />
        </Route>

        {/* Cụm màn hình Quản trị viên */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<DashboardPage />} />
        <Route path="/admin/movies" element={<MovieManagePage />} />
        <Route path="/admin/bookings" element={<BookingManagePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
