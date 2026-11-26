import api from './api';

/**
 * Lightweight Stale-While-Revalidate + In-flight Request Deduplication cache.
 * CHỈ dùng cho dữ liệu danh mục ít thay đổi (/movies, /cinemas).
 * TUYỆT ĐỐI KHÔNG dùng cho trạng thái ghế, giữ ghế 600s, lịch chiếu live, giá checkout hoặc voucher.
 */
const DEFAULT_TTL_MS = 60 * 1000;
const memoryCache = new Map();
const inFlightRequests = new Map();

export function getCachedData(key, ttlMs = DEFAULT_TTL_MS) {
  const entry = memoryCache.get(key);
  if (!entry) return { data: null, isFresh: false };
  const age = Date.now() - entry.ts;
  return { data: entry.data, isFresh: age < ttlMs };
}

export function fetchWithDedup(key, fetcher, { ttlMs = DEFAULT_TTL_MS, force = false } = {}) {
  if (!force) {
    const { data, isFresh } = getCachedData(key, ttlMs);
    if (isFresh && data !== null) {
      return Promise.resolve(data);
    }
  }

  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      memoryCache.set(key, { data, ts: Date.now() });
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, promise);
  return promise;
}

export const invalidateMoviesCache = () => {
  memoryCache.delete('GET:/movies');
};

export const getMoviesCached = (options = {}) =>
  fetchWithDedup(
    'GET:/movies',
    async () => {
      const res = await api.get('/movies');
      return Array.isArray(res.data) ? res.data : [];
    },
    options
  );

export const getCinemasCached = (params = {}, options = {}) => {
  const paramKey = Object.keys(params || {})
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const cacheKey = `GET:/cinemas?${paramKey}`;
  return fetchWithDedup(
    cacheKey,
    async () => {
      const res = await api.get('/cinemas', { params });
      return Array.isArray(res.data) ? res.data : [];
    },
    options
  );
};
