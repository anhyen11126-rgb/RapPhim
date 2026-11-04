import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * ScrollManager:
 * 1. Khi chuyển sang trang mới (PUSH): Luôn cuộn lên đầu trang (top = 0).
 * 2. Khi Back / Forward (POP): Khôi phục chính xác vị trí cuộn trước đó của trang,
 *    không bị nhảy lên đầu hay nhảy xuống đáy dù trang tải dữ liệu bất đồng bộ.
 */
const ScrollManager = () => {
  const location = useLocation();
  const navigationType = useNavigationType();

  const scrollPositions = useRef(new Map());
  const currentKeyRef = useRef(location.key);
  const isRestoringRef = useRef(false);

  // Tắt tính năng tự khôi phục cuộn mặc định của trình duyệt để tránh xung đột với SPA
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Lắng nghe sự kiện scroll để liên tục lưu vị trí hiện tại
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (isRestoringRef.current) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          if (currentKeyRef.current) {
            scrollPositions.current.set(currentKeyRef.current, currentY);
            try {
              sessionStorage.setItem(`scroll_${currentKeyRef.current}`, String(currentY));
            } catch (e) {
              // Bỏ qua lỗi sessionStorage nếu bị giới hạn
            }
          }
          // Lưu dự phòng theo pathname + search
          const pathKey = `${window.location.pathname}${window.location.search}`;
          scrollPositions.current.set(pathKey, currentY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Xử lý khi thay đổi Route
  useEffect(() => {
    currentKeyRef.current = location.key;

    // Nếu có hash (ví dụ #lich-chieu), ưu tiên cuộn tới phần tử đó
    if (location.hash) {
      const elementId = location.hash.replace('#', '');
      const targetElement = document.getElementById(elementId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    // TRƯỜNG HỢP 1: Vào trang mới (PUSH) -> Luôn về đỉnh trang
    if (navigationType === 'PUSH') {
      isRestoringRef.current = false;
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      scrollPositions.current.set(location.key, 0);
      return;
    }

    // TRƯỜNG HỢP 2: Quay lại (POP - Back / Forward) -> Khôi phục chính xác vị trí cũ
    if (navigationType === 'POP') {
      let savedY = scrollPositions.current.get(location.key);
      if (savedY === undefined) {
        try {
          const fromSession = sessionStorage.getItem(`scroll_${location.key}`);
          if (fromSession !== null) {
            savedY = Number(fromSession);
          }
        } catch (e) {}
      }

      if (savedY === undefined) {
        const pathKey = `${location.pathname}${location.search}`;
        savedY = scrollPositions.current.get(pathKey);
      }

      const targetY = typeof savedY === 'number' && !isNaN(savedY) ? savedY : 0;

      if (targetY === 0) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        return;
      }

      // Khi trang có dữ liệu API cần thời gian tải (DOM ban đầu thấp hơn targetY):
      // Dùng loop requestAnimationFrame + MutationObserver để áp dụng chính xác vị trí
      isRestoringRef.current = true;
      const startTime = Date.now();
      let rafId;

      const stopRestoration = () => {
        isRestoringRef.current = false;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('wheel', onUserInteract);
        window.removeEventListener('touchstart', onUserInteract);
        window.removeEventListener('keydown', onUserInteract);
        if (observer) observer.disconnect();
      };

      // Nếu người dùng chủ động chạm/cuộn chuột, dừng tự động khôi phục ngay lập tức
      const onUserInteract = () => {
        stopRestoration();
      };

      window.addEventListener('wheel', onUserInteract, { passive: true });
      window.addEventListener('touchstart', onUserInteract, { passive: true });
      window.addEventListener('keydown', onUserInteract, { passive: true });

      const attemptScroll = () => {
        if (!isRestoringRef.current) return;
        window.scrollTo({ top: targetY, behavior: 'instant' });

        const currentY = window.scrollY;
        // Nếu đã cuộn sát vị trí hoặc đã quá 1.5 giây thì dừng
        if (Math.abs(currentY - targetY) <= 5 || Date.now() - startTime > 1500) {
          stopRestoration();
        } else {
          rafId = requestAnimationFrame(attemptScroll);
        }
      };

      // Theo dõi DOM thay đổi khi API nạp dữ liệu xong để cuộn ngay lập tức
      const observer = new MutationObserver(() => {
        if (!isRestoringRef.current) return;
        window.scrollTo({ top: targetY, behavior: 'instant' });
        if (Math.abs(window.scrollY - targetY) <= 5) {
          stopRestoration();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      rafId = requestAnimationFrame(attemptScroll);

      return () => {
        stopRestoration();
      };
    }
  }, [location.pathname, location.search, location.hash, location.key, navigationType]);

  return null;
};

export default ScrollManager;

