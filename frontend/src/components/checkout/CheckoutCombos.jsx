import React from 'react';

const CheckoutCombos = ({
  popcornFlavors,
  selectedFlavor,
  setSelectedFlavor,
  concessions,
  comboQuantities,
  onQuantityChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Tiêu đề & Giới thiệu */}
      <div>
        <span className="text-amber-500 font-bold text-xs uppercase tracking-widest block mb-1">
          NÂNG TẦM CẢM XÚC
        </span>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Combo Bắp Nước Rạp Chiếu
          </h1>
          <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold flex items-center gap-1.5 w-fit">
            <span>🍿</span>
            <span>Bắp nóng giòn tại quầy VIP</span>
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed max-w-2xl">
          Tiết kiệm tới 25% khi đặt trước combo F&B online. Nhận đồ ăn nhanh chóng tại làn ưu tiên D'AVENOR Express không cần xếp hàng.
        </p>
      </div>

      {/* THANH CHỌN VỊ BẮP YÊU THÍCH */}
      <div className="bg-[#0f1524] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black text-white flex items-center gap-1.5">
            <span>👥</span>
            <span>Chọn vị bắp yêu thích của bạn</span>
          </span>
          <span className="text-[11px] text-slate-500">Áp dụng cho combo đã chọn</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {popcornFlavors.map((flavor) => {
            const isSelected = selectedFlavor === flavor.id;
            return (
              <button
                key={flavor.id}
                type="button"
                onClick={() => setSelectedFlavor(flavor.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer border ${
                  isSelected
                    ? 'bg-[#2563eb] border-blue-400 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-300'
                    : 'bg-[#161f30] hover:bg-[#202b40] text-slate-300 border-slate-700/70'
                }`}
              >
                <span>★</span>
                <span>{flavor.name}</span>
                {isSelected && <span className="ml-1">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* DANH SÁCH THẺ COMBO & BẮP NƯỚC TỪ DATABASE */}
      <div className="space-y-4">
        {concessions.map((combo) => {
          const qty = comboQuantities[combo.id] || 0;
          const isAdded = qty > 0;

          return (
            <div
              key={combo.id}
              className={`bg-[#0d1322] border ${
                isAdded ? 'border-blue-500/70 shadow-lg shadow-blue-500/10' : 'border-slate-800'
              } rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 transition-all`}
            >
              {/* Hình ảnh combo */}
              <div className="w-full sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-700/60 shadow">
                <img
                  src={combo.image}
                  alt={combo.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Nội dung thông tin combo */}
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                    {combo.badge}
                  </span>
                  {isAdded && (
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      ✓ Đã thêm vào vé
                    </span>
                  )}
                </div>

                <h3 className="text-base font-black text-white">{combo.title}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                  {combo.desc}
                </p>

                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-base font-black text-blue-400">
                    {combo.price.toLocaleString('vi-VN')} đ
                  </span>
                  <span className="text-xs text-slate-500 line-through">
                    {combo.oldPrice.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              {/* Bộ tăng giảm số lượng / Nút Thêm */}
              <div className="shrink-0 w-full sm:w-auto flex justify-end">
                {isAdded ? (
                  <div className="flex items-center space-x-2 bg-[#162033] border border-blue-500/60 rounded-xl p-1 shadow-md">
                    <button
                      type="button"
                      onClick={() => onQuantityChange(combo.id, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-7 text-center font-black text-sm text-white">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuantityChange(combo.id, 1)}
                      className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onQuantityChange(combo.id, 1)}
                    className="w-full sm:w-auto px-4 py-2 bg-[#162033] hover:bg-blue-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 hover:border-blue-500 flex items-center justify-center space-x-1.5 cursor-pointer shadow"
                  >
                    <span>+</span>
                    <span>Thêm vào vé</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DẢI CAM KẾT CHẤT LƯỢNG NGUYÊN LIỆU */}
      <div className="bg-[#0b101c] border border-slate-800/90 rounded-2xl p-4 flex items-start space-x-3.5 shadow-lg">
        <svg
          className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.12"></path>
          <path d="m9 12 2 2 4-4" strokeWidth="2.5"></path>
        </svg>
        <div className="text-xs leading-relaxed">
          <h4 className="font-bold text-white mb-0.5">
            Cam kết nguyên liệu chuẩn rạp phim quốc tế
          </h4>
          <p className="text-slate-400">
            Hạt ngô nhập khẩu không biến đổi gen (Non-GMO), chế biến với bơ thực vật nguyên chất không chứa Trans-fat.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutCombos;

