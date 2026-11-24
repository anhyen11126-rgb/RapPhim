import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const MyTicketsPage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setCurrentUser(u);
        fetchMyBookings(u);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const fetchMyBookings = async (user) => {
    try {
      setLoading(true);
      const res = await api.get('/bookings/my-bookings', {
        params: {
          email: user.email,
          phone: user.phone,
        },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setBookings(data);
      if (data.length > 0) {
        setSelectedBooking(data[0]);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách vé:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1380px] mx-auto space-y-8">
        {/* HEADER TRANG */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#AA9BFF]/25 pb-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#7C3AED]/30 border border-[#A855F7]/40 text-[#42DFFF] text-xs font-bold mb-2">
              <span>🎟️</span>
              <span>CINEMA PASS & TICKET WALLET</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-[#F4A5FF] via-[#C56BFF] via-[#83F5FF] to-[#F4A5FF] bg-clip-text text-transparent tracking-tight">
              Vé Của Tôi & Lịch Sử Đặt Vé
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
              Quản lý vé điện tử, mã check-in phòng chiếu và lịch sử giao dịch tại D'AVENOR CINEMA.
            </p>
          </div>

          {currentUser && (
            <div className="flex items-center space-x-3 bg-[var(--bg-secondary)] border border-[#AA9BFF]/25 px-4 py-2.5 rounded-2xl">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] to-[#42DFFF] text-[#0B1026] flex items-center justify-center font-bold text-sm uppercase shadow border border-[#42DFFF]/40 shrink-0">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  currentUser.name ? currentUser.name[0] : 'U'
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{currentUser.name}</span>
                <span className="text-[11px] text-[#42DFFF] font-semibold block">
                  {currentUser.tier === 'GOLD_TIER' ? '⭐ GOLD TIER' : 'Hội viên'} • {currentUser.points || 100}p
                </span>
              </div>
            </div>
          )}
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-4 border-[#AA9BFF]/20 border-t-[#42DFFF] rounded-full animate-spin"></div>
            <p className="text-xs text-[var(--text-muted)]">Đang đồng bộ dữ liệu vé từ hệ thống D'AVENOR CINEMA...</p>
          </div>
        ) : !currentUser ? (
          /* TRƯỜNG HỢP CHƯA ĐĂNG NHẬP */
          <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/25 rounded-3xl p-10 sm:p-14 text-center max-w-xl mx-auto space-y-5 shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-[#20204B] border border-[#AA9BFF]/30 flex items-center justify-center mx-auto text-3xl text-[#42DFFF]">
              👤
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-white">Vui lòng đăng nhập tài khoản</h2>
              <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                Đăng nhập để xem danh sách vé điện tử đã đặt và lịch sử xem phim của bạn.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/login"
                state={{ from: '/my-tickets' }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] font-black text-xs transition-all shadow-[0_0_16px_rgba(168,85,247,0.35),0_0_24px_rgba(66,223,255,0.20)] hover:brightness-110 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                <span>Đăng nhập ngay</span>
              </Link>
              <Link
                to="/register"
                state={{ from: '/my-tickets' }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--bg-main)] hover:bg-[#20204B] text-[var(--text-main)] font-bold text-xs transition-all border border-[#AA9BFF]/25 cursor-pointer"
              >
                Đăng ký tài khoản
              </Link>
            </div>
          </div>
        ) : bookings.length === 0 ? (
          /* TRƯỜNG HỢP CHƯA ĐẶT VÉ / LỊCH SỬ TRỐNG (THEO YÊU CẦU CỦA USER: KHÔNG CÓ GÌ CẢ) */
          <div className="bg-[var(--bg-secondary)] border border-[#AA9BFF]/25 rounded-3xl p-10 sm:p-16 text-center max-w-2xl mx-auto space-y-6 shadow-2xl animate-in fade-in duration-300">
            {/* Biểu tượng vé trống */}
            <div className="w-24 h-24 rounded-full bg-[#20204B] border border-[#AA9BFF]/30 flex items-center justify-center mx-auto text-4xl shadow-inner text-[#42DFFF]">
              🎟️
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#42DFFF] bg-[#7C3AED]/30 px-3 py-1 rounded-full border border-[#A855F7]/40">
                LỊCH SỬ TRỐNG
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Bạn chưa có vé xem phim nào!
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
                Tài khoản <strong className="text-white">{currentUser.name}</strong> ({currentUser.email}) chưa từng đặt vé hoặc chưa có giao dịch nào được ghi nhận.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[#AA9BFF]/20 max-w-md mx-auto text-left flex items-start space-x-3 text-xs text-[var(--text-muted)]">
              <span className="text-[#42DFFF] text-base shrink-0">💡</span>
              <p className="leading-relaxed">
                Hãy chọn ngay các bộ phim bom tấn đang chiếu tại hệ thống D'AVENOR CINEMA để trải nghiệm công nghệ màn chiếu laser đỉnh cao và tích điểm thăng hạng hội viên!
              </p>
            </div>

            {/* Các nút khám phá */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#F4A5FF] via-[#A855F7] via-[#42DFFF] to-[#83F5FF] text-[#0B1026] font-black text-xs sm:text-sm transition-all shadow-[0_0_16px_rgba(168,85,247,0.35),0_0_24px_rgba(66,223,255,0.20)] hover:brightness-110 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>🎬</span>
                <span>Khám phá phim đang chiếu</span>
              </Link>
              <Link
                to="/theaters"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[var(--bg-main)] hover:bg-[#20204B] text-[var(--text-main)] font-bold text-xs sm:text-sm transition-all border border-[#AA9BFF]/25 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>📍</span>
                <span>Xem lịch rạp chiếu</span>
              </Link>
              <Link
                to="/promotions"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[var(--bg-main)] hover:bg-[#20204B] text-[#42DFFF] font-bold text-xs sm:text-sm transition-all border border-[#AA9BFF]/25 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>🎁</span>
                <span>Kho voucher ưu đãi</span>
              </Link>
            </div>
          </div>
        ) : (
          /* TRƯỜNG HỢP CÓ VÉ ĐÃ ĐẶT THẬT TỪ DATABASE */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* CỘT TRÁI: DANH SÁCH CÁC VÉ ĐÃ ĐẶT */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                  LỊCH SỬ ĐẶT VÉ ({bookings.length})
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  ● Dữ liệu đồng bộ máy chủ
                </span>
              </div>

              <div className="space-y-3">
                {bookings.map((b) => {
                  const isSelected = selectedBooking?.id === b.id || selectedBooking?._id === b._id;
                  const movie = b.showtime?.movie;
                  const dateStr = b.showtime?.startTime
                    ? new Date(b.showtime.startTime).toLocaleDateString('vi-VN', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      })
                    : new Date(b.createdAt).toLocaleDateString('vi-VN');
                  const timeStr = b.showtime?.startTime
                    ? new Date(b.showtime.startTime).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '19:00';

                  return (
                    <div
                      key={b.id || b._id}
                      onClick={() => setSelectedBooking(b)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-[#20204B] border-[#42DFFF] shadow-[0_4px_20px_rgba(66,223,255,0.25)] ring-1 ring-[#83F5FF]/50'
                          : 'bg-[var(--bg-secondary)] hover:bg-[#20204B] border-[#AA9BFF]/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono font-bold text-[#42DFFF] bg-[#7C3AED]/30 px-2 py-0.5 rounded border border-[#A855F7]/30">
                              #{b.bookingCode}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                              {b.status === 'PAID' ? '✓ ĐÃ THANH TOÁN' : b.status}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-white line-clamp-1">
                            {movie?.title || 'Vé xem phim D\'AVENOR'}
                          </h3>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {b.showtime?.roomName || 'Phòng chiếu D\'AVENOR'} • Ghế: <strong className="text-[#42DFFF]">{b.seats}</strong>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-white block">
                            {b.totalAmount ? b.totalAmount.toLocaleString('vi-VN') : 0} đ
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                            {dateStr} • {timeStr}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CỘT PHẢI: CHI TIẾT CUỐNG VÉ ĐIỆN TỬ VỪA CHỌN */}
            {selectedBooking && (
              <div className="lg:col-span-7 bg-[var(--bg-secondary)] border border-[#AA9BFF]/25 rounded-3xl shadow-2xl relative p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between pb-3.5 border-b border-[#AA9BFF]/20">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      MÃ VÉ ĐIỆN TỬ
                    </span>
                    <span className="text-sm font-black font-mono text-[#42DFFF] bg-[#7C3AED]/30 px-2.5 py-0.5 rounded border border-[#A855F7]/30">
                      #{selectedBooking.bookingCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(selectedBooking.bookingCode)}
                      className="text-xs text-[var(--text-muted)] hover:text-white bg-[var(--bg-main)] px-2.5 py-0.5 rounded border border-[#AA9BFF]/20 transition-colors cursor-pointer"
                      title="Sao chép mã vé"
                    >
                      {copied ? 'Đã sao chép' : '📋'}
                    </button>
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    GIAO DỊCH HỢP LỆ
                  </span>
                </div>

                {/* Thông tin phim */}
                <div className="flex items-start space-x-4">
                  <div className="w-20 h-28 rounded-xl overflow-hidden bg-[var(--bg-main)] border border-[#AA9BFF]/25 shrink-0 shadow-md relative">
                    <img
                      src={
                        selectedBooking.showtime?.movie?.posterUrl ||
                        'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop'
                      }
                      alt={selectedBooking.showtime?.movie?.title || 'Phim'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="bg-[#20204B] text-[#42DFFF] font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-[#AA9BFF]/30 uppercase tracking-wider">
                      {selectedBooking.showtime?.movie?.ageRating || 'T16'} • IMAX LASER
                    </span>
                    <h3 className="text-xl font-black text-white">
                      {selectedBooking.showtime?.movie?.title || 'Vé Xem Phim D\'AVENOR'}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {selectedBooking.showtime?.movie?.genre || 'Điện ảnh đặc sắc'} • {selectedBooking.showtime?.movie?.duration || 120} phút
                    </p>
                    <p className="text-xs text-[var(--text-muted)] pt-1">
                      Họ tên khách: <strong className="text-white">{selectedBooking.customerName}</strong> • SĐT: <strong className="text-white">{selectedBooking.customerPhone}</strong>
                    </p>
                  </div>
                </div>

                {/* Grid 4 chi tiết */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#AA9BFF]/20 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block font-medium">📽️ Phòng chiếu</span>
                    <span className="font-bold text-white text-xs block mt-0.5">{selectedBooking.showtime?.roomName || 'Phòng 03'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block font-medium">🕒 Giờ chiếu</span>
                    <span className="font-bold text-white text-xs block mt-0.5">
                      {selectedBooking.showtime?.startTime
                        ? new Date(selectedBooking.showtime.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        : '19:00'}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {selectedBooking.showtime?.startTime
                        ? new Date(selectedBooking.showtime.startTime).toLocaleDateString('vi-VN')
                        : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block font-medium">💺 Ghế</span>
                    <span className="font-black text-[#42DFFF] text-sm block mt-0.5">{selectedBooking.seats}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block font-medium">💳 Tổng tiền</span>
                    <span className="font-black text-emerald-400 text-sm block mt-0.5">
                      {selectedBooking.totalAmount ? selectedBooking.totalAmount.toLocaleString('vi-VN') : 0} đ
                    </span>
                  </div>
                </div>

                {/* Bắp nước */}
                {selectedBooking.concessions && (
                  <div className="bg-[var(--bg-main)] border border-[#AA9BFF]/20 rounded-xl p-3 text-xs flex items-center space-x-2.5">
                    <span className="text-[#42DFFF] text-lg">🍿</span>
                    <div>
                      <span className="text-[10px] text-[#42DFFF] font-bold block uppercase tracking-wider">
                        Bắp nước đi kèm
                      </span>
                      <span className="font-bold text-white">{selectedBooking.concessions}</span>
                    </div>
                  </div>
                )}

                {/* Mã QR Check-in */}
                <div className="text-center pt-2 space-y-3">
                  <div className="inline-block p-4 bg-white rounded-2xl shadow-xl border-4 border-[#AA9BFF]/30">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${selectedBooking.bookingCode}`}
                      alt="Check-in QR"
                      className="w-36 h-36 object-contain rounded-lg mx-auto"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] max-w-sm mx-auto">
                    Xuất trình mã QR tại cửa phòng chiếu hoặc quầy D'AVENOR Express để vào xem phim.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTicketsPage;

