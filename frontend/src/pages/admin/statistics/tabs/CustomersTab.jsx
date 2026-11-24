import React from 'react';
import StatisticCard from '../components/StatisticCard';
import { formatCurrency, formatNumber, formatDate } from '../utils/statisticsFormatter';

const CustomersTab = ({ customersData, loading, onPageChange }) => {
  const metrics = customersData?.metrics || {};
  const ranking = customersData?.customersRanking || [];
  const total = customersData?.total || 0;
  const page = customersData?.page || 1;
  const totalPages = customersData?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* 1. DÃY 3 CHỈ SỐ KHÁCH HÀNG THIẾT YẾU */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatisticCard
          title="Tổng Số Khách Hàng"
          value={`${formatNumber(metrics.totalRegistered || 0)} người`}
          tooltip="Tổng tài khoản khách hàng thực tế trong cơ sở dữ liệu (không bao gồm Admin)"
          loading={loading}
          icon="👥"
          iconBg="bg-blue-500/10 text-blue-400"
        />

        <StatisticCard
          title="Khách Hàng Mới Trong Kỳ"
          value={`${formatNumber(metrics.newInPeriod || 0)} người`}
          tooltip="Số tài khoản mới đăng ký gia nhập hệ thống trong khoảng thời gian đã chọn"
          loading={loading}
          icon="✨"
          iconBg="bg-emerald-500/10 text-emerald-400"
        />

        <StatisticCard
          title="Khách Hàng Đã Giao Dịch"
          value={`${formatNumber(metrics.transactingCount || 0)} người`}
          tooltip="Số lượng khách hàng đã hoàn tất ít nhất một đơn đặt vé xem phim"
          loading={loading}
          icon="💳"
          iconBg="bg-purple-500/10 text-purple-400"
        />
      </div>

      {/* 2. BẢNG XẾP HẠNG KHÁCH HÀNG CHI TIÊU HÀNG ĐẦU (VIP SPENDERS) */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-default)]/80 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Bảng Xếp Hạng Khách Hàng Chi Tiêu</h3>
            <p className="text-xs text-slate-400">
              Danh sách khách hàng VIP thân thiết có lượng đặt vé và đóng góp doanh số cao nhất
            </p>
          </div>
          <span className="text-xs text-slate-400 font-semibold bg-[var(--bg-surface)] px-3 py-1.5 rounded-xl border border-slate-700">
            Bảo mật số điện thoại (Masked)
          </span>
        </div>

        {/* Bảng dữ liệu */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[var(--bg-surface)]/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4 text-center">Thứ hạng</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Số điện thoại</th>
                <th className="py-3 px-4 text-center">Đơn thành công</th>
                <th className="py-3 px-4 text-center">Số vé mua</th>
                <th className="py-3 px-4 text-right">Tổng chi tiêu thuần</th>
                <th className="py-3 px-4 text-right">Lần đặt gần nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center">
                    <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <span className="text-slate-400 text-xs">Đang nạp dữ liệu khách hàng...</span>
                  </td>
                </tr>
              ) : ranking.length > 0 ? (
                ranking.map((c) => (
                  <tr key={c.rank} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                    {/* Thứ hạng */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`w-6 h-6 rounded-lg text-xs font-bold inline-flex items-center justify-center ${
                          c.rank === 1
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : c.rank === 2
                            ? 'bg-slate-300 text-slate-950 font-black'
                            : c.rank === 3
                            ? 'bg-amber-700 text-white font-black'
                            : 'bg-[var(--bg-surface)] text-slate-400'
                        }`}
                      >
                        {c.rank}
                      </span>
                    </td>

                    {/* Họ tên & Avatar chữ cái */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 font-black text-xs flex items-center justify-center shrink-0">
                          {c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <span className="font-bold text-white truncate">{c.name}</span>
                      </div>
                    </td>

                    {/* Số điện thoại (Che bảo mật) */}
                    <td className="py-3.5 px-4 font-mono text-slate-400">{c.maskedPhone}</td>

                    {/* Đơn thành công */}
                    <td className="py-3.5 px-4 text-center text-slate-200 font-semibold">{c.successfulOrders} đơn</td>

                    {/* Số vé mua */}
                    <td className="py-3.5 px-4 text-center font-bold text-white">{formatNumber(c.totalTickets)} vé</td>

                    {/* Tổng chi tiêu */}
                    <td className="py-3.5 px-4 text-right font-black text-emerald-400">{c.spendFormatted}</td>

                    {/* Lần đặt gần nhất */}
                    <td className="py-3.5 px-4 text-right text-slate-400">{formatDate(c.lastBooking)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    Chưa có dữ liệu giao dịch khách hàng trong kỳ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-default)] text-xs text-slate-400">
            <span>Trang {page} / {totalPages} (Tổng {total} khách)</span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => onPageChange && onPageChange(page - 1)}
                className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-slate-700 disabled:opacity-40"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPageChange && onPageChange(i + 1)}
                  className={`px-2.5 py-1 rounded font-bold ${
                    page === i + 1 ? 'bg-red-600 text-white' : 'bg-[var(--bg-surface)] text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => onPageChange && onPageChange(page + 1)}
                className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-slate-700 disabled:opacity-40"
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

export default CustomersTab;
