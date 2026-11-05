import React, { useState, useRef } from 'react';
import api from '../../services/api';

const PRESET_AVATARS = [
  {
    id: 'spiderman',
    name: 'Spider-Man',
    url: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=300&auto=format&fit=crop',
    tag: 'Marvel',
  },
  {
    id: 'dune',
    name: 'Dune Sci-Fi',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop',
    tag: 'Sci-Fi',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Hero',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop',
    tag: 'Action',
  },
  {
    id: 'batman',
    name: 'Dark Knight',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop',
    tag: 'DC',
  },
  {
    id: 'vip_gold',
    name: "D'Avenor VIP Gold",
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop',
    tag: 'VIP',
  },
  {
    id: 'popart',
    name: 'Pop Art Cinema',
    url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop',
    tag: 'Art',
  },
  {
    id: 'retro_3d',
    name: '3D Glasses Movie',
    url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&auto=format&fit=crop',
    tag: 'Cinema',
  },
  {
    id: 'filmreel',
    name: 'Film Director',
    url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=300&auto=format&fit=crop',
    tag: 'Director',
  },
];

const NavAvatarModal = ({ isOpen, onClose, currentUser, setCurrentUser }) => {
  const [avatarActiveTab, setAvatarActiveTab] = useState('presets'); // 'presets' | 'upload' | 'url'
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(currentUser?.avatar || '');
  const [customAvatarInput, setCustomAvatarInput] = useState(
    currentUser?.avatar && currentUser.avatar.startsWith('http') ? currentUser.avatar : ''
  );
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarMessage({
        type: 'error',
        text: 'Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP, JPEG)!',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage({
        type: 'error',
        text: 'Kích thước file ảnh không được vượt quá 5MB!',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedAvatarUrl(event.target.result);
      setAvatarMessage({
        type: 'success',
        text: 'Đã tải ảnh lên thành công. Bấm "Lưu Thay Đổi" để áp dụng ảnh mới!',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async () => {
    try {
      setIsUpdatingAvatar(true);
      setAvatarMessage({ type: '', text: '' });

      const newAvatar = selectedAvatarUrl ? selectedAvatarUrl.trim() : '';
      const token = localStorage.getItem('token');
      const payload = {
        avatar: newAvatar,
        userId: currentUser?.id || currentUser?._id,
        email: currentUser?.email,
      };

      const res = await api.put('/auth/avatar', payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const updatedUser = {
        ...currentUser,
        avatar: newAvatar,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      window.dispatchEvent(new Event('authChange'));

      setAvatarMessage({
        type: 'success',
        text: res.data?.message || 'Cập nhật ảnh đại diện thành công!',
      });

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      console.error('Lỗi cập nhật ảnh đại diện:', err);
      setAvatarMessage({
        type: 'error',
        text: err.response?.data?.message || 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại!',
      });
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleResetToDefaultAvatar = () => {
    setSelectedAvatarUrl('');
    setCustomAvatarInput('');
    setAvatarMessage({
      type: 'info',
      text: 'Đã chọn ảnh đại diện con người mặc định. Bấm "Lưu Thay Đổi" để xác nhận.',
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0e1424] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">🖼️</span>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Đổi Ảnh Đại Diện
              </h3>
              <p className="text-[11px] text-slate-400">
                Cá nhân hóa tài khoản D'AVENOR CINEMA của bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Xem trước Avatar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#141b2e] p-4 rounded-2xl border border-slate-800/80">
          <div className="relative group w-20 h-20 rounded-full overflow-hidden bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-blue-500 shadow-lg shadow-blue-500/20 shrink-0 flex items-center justify-center">
            {selectedAvatarUrl ? (
              <img
                src={selectedAvatarUrl}
                alt="Preview Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left space-y-1">
            <span className="text-xs font-bold text-white block">
              {currentUser?.name}
            </span>
            <p className="text-[11px] text-slate-400">
              {selectedAvatarUrl
                ? 'Đang xem trước ảnh bạn vừa chọn. Hãy bấm "Lưu Thay Đổi" để cập nhật.'
                : 'Đang dùng hình đại diện mặc định (icon con người).'}
            </p>
            {selectedAvatarUrl && (
              <button
                type="button"
                onClick={handleResetToDefaultAvatar}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline inline-flex items-center space-x-1 cursor-pointer pt-0.5"
              >
                <span>↺ Gỡ ảnh (Về icon con người mặc định)</span>
              </button>
            )}
          </div>
        </div>

        {/* Thông báo phản hồi */}
        {avatarMessage.text && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
              avatarMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : avatarMessage.type === 'info'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}
          >
            <span>
              {avatarMessage.type === 'success' ? '✓' : avatarMessage.type === 'info' ? 'ℹ️' : '⚠️'}
            </span>
            <span>{avatarMessage.text}</span>
          </div>
        )}

        {/* 3 Tabs chọn cách đổi */}
        <div className="flex items-center p-1 bg-[#121828] rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setAvatarActiveTab('presets')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              avatarActiveTab === 'presets'
                ? 'bg-[#2563eb] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bộ Sưu Tập Phim
          </button>
          <button
            type="button"
            onClick={() => setAvatarActiveTab('upload')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              avatarActiveTab === 'upload'
                ? 'bg-[#2563eb] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tải Ảnh Lên
          </button>
          <button
            type="button"
            onClick={() => setAvatarActiveTab('url')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              avatarActiveTab === 'url'
                ? 'bg-[#2563eb] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Dán Link Ảnh
          </button>
        </div>

        {/* Nội dung Tab 1: Bộ sưu tập mẫu */}
        {avatarActiveTab === 'presets' && (
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Chọn nhân vật điện ảnh bạn yêu thích:
            </span>
            <div className="grid grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {PRESET_AVATARS.map((item) => {
                const isSelected = selectedAvatarUrl === item.url;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatarUrl(item.url);
                      setAvatarMessage({
                        type: 'info',
                        text: `Đã chọn "${item.name}". Bấm "Lưu Thay Đổi" để cập nhật!`,
                      });
                    }}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all p-1 group flex flex-col items-center bg-[#151c2e] cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden mb-1">
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] font-bold text-white truncate max-w-[70px]">
                      {item.name}
                    </span>
                    <span className="text-[9px] text-amber-400 font-semibold">{item.tag}</span>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-[9px] text-white font-black shadow">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Nội dung Tab 2: Tải file từ máy tính */}
        {avatarActiveTab === 'upload' && (
          <div className="space-y-3 py-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-[#131929] hover:bg-[#182136] transition-colors"
            >
              <span className="text-3xl block mb-2">📁</span>
              <p className="text-xs font-bold text-white">Bấm vào đây để chọn ảnh từ thiết bị</p>
              <p className="text-[11px] text-slate-400 mt-1">Hỗ trợ PNG, JPG, WEBP dung lượng tối đa 5MB</p>
            </div>
          </div>
        )}

        {/* Nội dung Tab 3: Nhập link ảnh trực tiếp */}
        {avatarActiveTab === 'url' && (
          <div className="space-y-3 py-2">
            <label className="text-xs font-bold text-slate-300 block">
              Dán đường dẫn ảnh đại diện (URL trực tiếp):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customAvatarInput}
                onChange={(e) => setCustomAvatarInput(e.target.value)}
                placeholder="https://example.com/my-photo.jpg"
                className="flex-1 bg-[#13192a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (customAvatarInput.trim()) {
                    setSelectedAvatarUrl(customAvatarInput.trim());
                    setAvatarMessage({
                      type: 'info',
                      text: 'Đã tải link xem trước! Bấm "Lưu Thay Đổi" để cập nhật.',
                    });
                  }
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Xem thử
              </button>
            </div>
          </div>
        )}

        {/* Footer Modal */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={handleSaveAvatar}
            disabled={isUpdatingAvatar}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#2563eb] hover:bg-blue-600 transition-colors shadow-md shadow-blue-600/30 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {isUpdatingAvatar && (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            )}
            <span>{isUpdatingAvatar ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavAvatarModal;

