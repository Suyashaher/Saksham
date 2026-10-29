import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// In-memory access token storage
let inMemoryAccessToken: string | null = null;
let onTokenRefreshedCallback: ((token: string | null) => void) | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  if (onTokenRefreshedCallback) {
    onTokenRefreshedCallback(token);
  }
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const setTokenRefreshedCallback = (cb: (token: string | null) => void) => {
  onTokenRefreshedCallback = cb;
};

// Storage for refresh token in sessionStorage
const REFRESH_TOKEN_KEY = 'aicte_fdr_refresh_token';

export const getRefreshToken = (): string | null => {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setRefreshToken = (token: string | null) => {
  try {
    if (token) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // sessionStorage might be restricted
  }
};

// Single-flight refresh token queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 with single-flight refresh lock
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Avoid infinite retry loop or if endpoint was auth itself
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        isRefreshing = false;
        setAccessToken(null);
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const newAccessToken = response.data.access_token;
        const newRefreshToken = response.data.refresh_token;

        setAccessToken(newAccessToken);
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken);
        }

        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        setRefreshToken(null);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Safely extracts a displayable string from any API error, AxiosError, or unknown exception.
 * Guarantees that the returned value is always a primitive string (never an object or array),
 * preventing React "Objects are not valid as a React child" crashes when rendered in JSX.
 */
export function formatApiError(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (!err) return fallback;

  const anyErr = err as any;
  const detail = anyErr.response?.data?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const loc = Array.isArray(item.loc)
            ? item.loc.filter((l: any) => l !== 'body' && l !== 'path').join('.')
            : (typeof item.field === 'string' ? item.field : '');
          const msg = item.msg || item.message || JSON.stringify(item);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(item);
      })
      .filter(Boolean)
      .join('; ');
  }

  if (detail && typeof detail === 'object') {
    return detail.message || detail.msg || JSON.stringify(detail);
  }

  if (anyErr.response?.data?.message && typeof anyErr.response.data.message === 'string') {
    return anyErr.response.data.message;
  }

  if (anyErr.message && typeof anyErr.message === 'string') {
    return anyErr.message;
  }

  return fallback;
}
