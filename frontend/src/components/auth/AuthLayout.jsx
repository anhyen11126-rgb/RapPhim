import React, { useEffect, useId, useRef } from 'react';
import { ArrowRight, Eye, EyeOff, LoaderCircle, QrCode, Ticket, Tags, X } from 'lucide-react';
import './authLayout.css';

const benefits = [
  [Tags, 'Ưu đãi khi đặt vé', 'Khám phá ưu đãi vé và combo tại rạp.'],
  [QrCode, 'Check-in bằng mã QR', 'Mở vé điện tử để vào phòng chiếu.'],
  [Ticket, 'Chọn ghế theo ý bạn', 'Xem sơ đồ và góc nhìn từ ghế trước khi đặt.'],
];
export default function AuthLayout({ children }) {
  return (
    <div className="auth-scene">
      <main className="auth-shell">
        <section className="auth-story" aria-label="D’AVENOR CINEMA">
          <div className="auth-brand">
            <img src="/Logo.png" alt="D’AVENOR CINEMA" />
            <span>Cinema<br />Experience</span>
          </div>
          <div className="auth-story-copy">
            <h2>Trải nghiệm điện ảnh đỉnh cao trong tầm tay bạn.</h2>
            <p>Đặt vé nhanh chóng · Chọn ghế yêu thích · Ưu đãi độc quyền</p>
            <ul className="auth-benefits">
              {benefits.map(([Icon, title, description]) => (
                <li key={title}><span><Icon size={23} /></span><div><strong>{title}</strong><small>{description}</small></div></li>
              ))}
            </ul>
          </div>
          <figure className="auth-artwork" aria-hidden="true">
            <img className="auth-member-art" src="/davenor-card.png" alt="" />
          </figure>
        </section>
        {children}
      </main>
    </div>
  );
}

export function AuthField({ label, icon: Icon, onToggle, isVisible, ...props }) {
  const id = useId();
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      <div className="auth-input">
        <Icon size={19} aria-hidden="true" />
        <input id={id} required {...props} />
        {onToggle && <button type="button" onClick={onToggle} aria-label={isVisible ? 'Ẩn ' + label.toLowerCase() : 'Hiện ' + label.toLowerCase()} aria-pressed={isVisible}>
          {isVisible ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>}
      </div>
    </div>
  );
}

export function AuthMessage({ error, success }) {
  return <>{error && <p role="alert" className="auth-error">{error}</p>}{success && <p role="status" className="auth-success">{success}</p>}</>;
}

export function AuthSubmit({ busy, children }) {
  return <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}>
    {busy ? <><LoaderCircle className="auth-spinner" size={19} /> Đang xử lý…</> : <>{children}<ArrowRight size={21} /></>}
  </button>;
}

export function AuthDialog({ title, onClose, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  return <dialog className="auth-dialog" ref={dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="auth-dialog-heading"><h2 id={titleId}>{title}</h2>
      <button type="button" className="auth-close" onClick={onClose} aria-label="Đóng hộp thoại"><X size={17} /></button>
    </div>
    {children}
  </dialog>;
}

export function SocialIcon({ provider }) {
  return provider === 'google' ? (
    <svg viewBox="0 0 48 48" width="21" height="21" aria-hidden="true">
      <path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.34-3.91H24v7.4h11.01a9.41 9.41 0 0 1-4.08 6.2v5.16h6.61c3.87-3.56 6.07-8.81 6.07-14.85Z" />
      <path fill="#34A853" d="M24 44c5.51 0 10.13-1.82 13.5-4.69l-6.57-5.16c-1.83 1.23-4.16 1.97-6.93 1.97-5.32 0-9.83-3.6-11.45-8.44H5.75V33A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.55 27.68a12 12 0 0 1 0-7.36V15H5.75a20 20 0 0 0 0 18l6.8-5.32Z" />
      <path fill="#EA4335" d="M24 11.88c3 0 5.7 1.03 7.81 3.07l5.85-5.85A19.2 19.2 0 0 0 24 4 20 20 0 0 0 5.75 15l6.8 5.32c1.62-4.84 6.13-8.44 11.45-8.44Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M13.9 24v-9.24H17l.46-3.6H13.9v-2.3c0-1.05.29-1.77 1.79-1.77h1.91V3.87c-.33-.05-1.47-.15-2.79-.15-2.76 0-4.65 1.69-4.65 4.79v2.65H7.04v3.6h3.12V24z" />
    </svg>
  );
}

