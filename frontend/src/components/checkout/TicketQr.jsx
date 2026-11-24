import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function TicketQr({ token, size }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    QRCode.toDataURL(token, { width: size, margin: 2 })
      .then(url => { if (active) setResult({ token, url }); })
      .catch(() => { if (active) setResult({ token, url: null }); });
    return () => { active = false; };
  }, [size, token]);

  if (!token) return <span>Mã QR chưa khả dụng</span>;
  if (result?.token !== token) return <span>Đang tạo mã QR…</span>;
  if (!result.url) return <span>Không thể tạo mã QR</span>;
  return <img src={result.url} width={size} height={size} alt="Mã QR soát vé của đơn" />;
}
