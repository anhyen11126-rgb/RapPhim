import React, { useState, useMemo } from 'react';
import StatisticCard from '../components/StatisticCard';
import RevenueChart from '../components/RevenueChart';
import { formatCurrency, formatNumber, formatPercent } from '../utils/statisticsFormatter';

const RevenueTab = ({ data, loading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const metrics = data?.metrics || {};
  const paymentMethods = data?.paymentMethods || [];
  const cinemaBreakdown = data?.cinemaBreakdown || [];
  const rows = data?.revenueTableRows || [];

  // Lọc tìm kiếm theo ngày
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    return rows.filter((r) => r.date.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [rows, searchTerm]);

  // Phân trang
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* 1. DÃY 6 CHỈ SỐ TÀI CHÍNH */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatisticCard
          title="Tổng Thu Trước Hoàn"
          value={metrics.grossFormatted || '0 đ'}
          tooltip="Tổng giá trị tất cả các giao dịch thanh toán thành công"
          loading={loading}
          icon="💰"
          iconBg="bg-blue-500/10 text-blue-400"
        />

        <StatisticCard
          title="Doanh Thu Thuần"
          value={metrics.netFormatted || '0 đ'}
          tooltip="Doanh thu thực tế sau khi đã trừ các khoản hủy vé / hoàn tiền"
          loading={loading}
          icon="💳"
          iconBg="bg-emerald-500/10 text-emerald-400"
        />

        <StatisticCard
          title="Doanh Thu Vé"
          value={metrics.ticketFormatted || '0 đ'}
          tooltip="Doanh thu trực tiếp từ bán vé xem phim các định dạng"
          loading={loading}
          icon="🎟️"
          iconBg="bg-red-500/10 text-red-400"
        />

        <StatisticCard
          title="Doanh Thu Bắp Nước"
          value={metrics.concessionFormatted || '0 đ'}
          tooltip="Doanh thu từ các combo bắp rang bơ và đồ uống tại quầy Concession"
          loading={loading}
          icon="🍿"
          iconBg="bg-amber-500/10 text-amber-400"
        />

        <StatisticCard
          title="Tiền Đã Hoàn"
          value={metrics.refundedFormatted || '0 đ'}
          tooltip="Tổng tiền đã hoàn lại cho khách hàng do hủy vé hoặc đổi lịch"
          loading={loading}
          icon="↩️"
          iconBg="bg-rose-500/10 text-rose-400"
        />

        <StatisticCard
          title="Giá Trị TB Đơn (AOV)"
          value={metrics.aovFormatted || '0 đ'}
          tooltip="Số tiền chi tiêu trung bình trên mỗi đơn hàng thành công"
          loading={loading}
          icon="📊"
          iconBg="bg-purple-500/10 text-purple-400"
        />
      </div>

      {/* 2. BIỂU ĐỒ DOANH THU TOÀN RẠP (VÉ XEM PHIM & BẮP NƯỚC) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Biểu Đồ Doanh Thu Toàn Rạp</h3>
            <p className="text-xs text-slate-400">
              Diễn biến doanh thu thực tế phân tách giữa Vé xem phim và Dịch vụ Bắp nước theo các ngày
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            Thực thu qua các cổng
          </span>
        </div>

        <RevenueChart data={data?.revenueChartData || []} loading={loading} />
      </div>

      {/* 3. CƠ CẤU DOANH THU & PHƯƠNG THỨC THANH TOÁN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cơ cấu Vé vs Bắp nước (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Cơ Cấu Doanh Thu Sản Phẩm</h3>
              <p className="text-xs text-slate-400">Tỷ trọng đóng góp giữa Vé xem phim và Bắp nước</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">Tỷ trọng %</span>
          </div>

          <div className="space-y-4">
            {/* Thanh Vé xem phim */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-600"></span>
                  <span>Vé xem phim ({metrics.ticketPercent || 0}%)</span>
                </span>
                <span className="font-bold text-emerald-400">{metrics.ticketFormatted || '0 đ'}</span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 rounded-full transition-all duration-700"
                  style={{ width: `${metrics.ticketPercent || 0}%` }}
                ></div>
              </div>
            </div>

            {/* Thanh Bắp nước */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                  <span>Bắp nước & Combo ({metrics.concessionPercent || 0}%)</span>
                </span>
                <span className="font-bold text-amber-400">{metrics.concessionFormatted || '0 đ'}</span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-700"
                  style={{ width: `${metrics.concessionPercent || 0}%` }}
                ></div>
              </div>
            </div>

            <p className="text-xs text-slate-400 pt-2 border-t border-slate-800/80 leading-relaxed">
              💡 Doanh thu bắp nước chiếm khoảng <strong className="text-amber-400">{metrics.concessionPercent || 0}%</strong> tổng doanh thu rạp, đem lại biên lợi nhuận cao cho hệ thống.
            </p>
          </div>
        </div>

        {/* Phương thức thanh toán (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Phương Thức Thanh Toán</h3>
              <p className="text-xs text-slate-400">Tỷ lệ các cổng thanh toán khách hàng lựa chọn</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">Cổng thanh toán</span>
          </div>

          <div className="space-y-3">
            {paymentMethods.map((pm) => (
              <div
                key={pm.method}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 text-xs"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-black text-xs text-white">
                    {pm.method === 'MOMO' ? '🌸' : pm.method === 'VNPAY' ? '💳' : '💵'}
                  </div>
                  <div>
                    <span className="font-bold text-white block">
                      {pm.method === 'MOMO' ? 'Ví MoMo' : pm.method === 'VNPAY' ? 'VNPAY-QR' : 'Tiền mặt tại quầy'}
                    </span>
                    <span className="text-[11px] text-slate-400">{pm.count} giao dịch thành công</span>
                  </div>
                </div>

                <div className="text-right">
                  <strong className="text-white block font-bold">{formatCurrency(pm.amount)}</strong>
                  <span className="text-[11px] text-emerald-400 font-semibold">{pm.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. BẢNG BÁO CÁO DOANH THU CHI TIẾT THEO NGÀY */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-white">Bảng Báo Cáo Doanh Thu Chi Tiết</h3>
            <p className="text-xs text-slate-400">Số đơn, lượng vé bán và đối soát dòng tiền theo từng ngày</p>
          </div>

          {/* Ô tìm kiếm ngày */}
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm theo ngày (dd/mm)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 w-48"
            />
          </div>
        </div>

        {/* Bảng dữ liệu */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Ngày</th>
                <th className="py-3 px-4 text-center">Đơn thành công</th>
                <th className="py-3 px-4 text-center">Số vé bán</th>
                <th className="py-3 px-4 text-right">Doanh thu vé</th>
                <th className="py-3 px-4 text-right">Bắp nước</th>
                <th className="py-3 px-4 text-right">Tiền hoàn</th>
                <th className="py-3 px-4 text-right font-black text-emerald-400">Doanh thu thuần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">{r.date}</td>
                    <td className="py-3.5 px-4 text-center">{r.orders}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-200">{formatNumber(r.tickets)}</td>
                    <td className="py-3.5 px-4 text-right text-slate-300">{formatCurrency(r.ticketRev)}</td>
                    <td className="py-3.5 px-4 text-right text-amber-400">{formatCurrency(r.concessionRev)}</td>
                    <td className="py-3.5 px-4 text-right text-rose-400">{formatCurrency(r.refunded)}</td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-400">{formatCurrency(r.netRev)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    Không tìm thấy dữ liệu doanh thu phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
            <span>Trang {currentPage} / {totalPages} ({filteredRows.length} ngày)</span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-2.5 py-1 rounded font-bold ${
                    currentPage === i + 1 ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueTab;
