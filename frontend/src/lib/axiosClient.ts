import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/useAuthStore";
import type { ApiResponse, AuthResponse } from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
  withCredentials: true,
});

const isAuthEndpoint = (url?: string): boolean =>
  Boolean(
    url?.includes("/api/v1/auth/login") ||
      url?.includes("/api/v1/auth/refresh-token") ||
      url?.includes("/api/v1/auth/logout"),
  );

const readStoredAccessToken = (): string | null => {
  let token = useAuthStore.getState().accessToken;
  if (token) return token;
  try {
    const directToken = localStorage.getItem("accessToken");
    if (directToken && directToken !== "null" && directToken !== "undefined") {
      return directToken;
    }
    const authStorageStr = localStorage.getItem("auth-storage");
    if (authStorageStr) {
      const parsed = JSON.parse(authStorageStr);
      if (parsed?.state?.accessToken) {
        return parsed.state.accessToken;
      }
    }
  } catch (error) {
    console.error("Lỗi parse token từ localStorage", error);
  }
  return null;
};

const isJwtExpiringSoon = (token: string, bufferMs = 60_000): boolean => {
  const parts = token.split(".");
  if (parts.length !== 3 || typeof atob !== "function") return false;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return false;
    }
    return payload.exp * 1000 <= Date.now() + bufferMs;
  } catch {
    return false;
  }
};

// Hàng đợi lưu lại các request bị hoãn trong thời gian chờ cấp mới token
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

const refreshAccessToken = async (): Promise<string> => {
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({
        resolve: (val) => resolve(String(val)),
        reject,
      });
    });
  }

  isRefreshing = true;
  try {
    // Backend Spring Boot đọc cookie HttpOnly mang tên 'refreshToken'
    const res = await axios.post<ApiResponse<AuthResponse>>(
      `${API_BASE_URL}/api/v1/auth/refresh-token`,
      {},
      {
        withCredentials: true,
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      },
    );

    const newAccessToken = res.data?.data?.accessToken;
    if (!newAccessToken) {
      throw new Error("Phản hồi refresh token không chứa accessToken hợp lệ");
    }
    useAuthStore.getState().setAccessToken(newAccessToken);
    processQueue(null, newAccessToken);
    return newAccessToken;
  } catch (refreshErr) {
    processQueue(refreshErr, null);
    useAuthStore.getState().logout();
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.pathname !== "/login"
    ) {
      try {
        window.location.assign("/login");
      } catch {
        // Ignore navigation errors in headless/test environments
      }
    }
    throw refreshErr;
  } finally {
    isRefreshing = false;
  }
};

// Request Interceptor: Tự động đính kèm accessToken kèm Fallback
axiosClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Đảm bảo header bỏ qua màn hình chờ của ngrok khi gọi API
    if (config.headers) {
      config.headers["ngrok-skip-browser-warning"] = "true";
    }

    let token = readStoredAccessToken();
    const isFormData =
      typeof FormData !== "undefined" && config.data instanceof FormData;

    if (isFormData) {
      // Nếu gửi FormData (upload file/video), xóa Content-Type để Axios/trình duyệt tự sinh boundary
      if (config.headers) {
        delete config.headers["Content-Type"];
      }
      if (config.timeout === undefined) {
        config.timeout = 0;
      }
      // Làm mới JWT trước khi đẩy luồng multipart lớn để tránh server đóng socket 401 giữa chừng (ERR_CONNECTION_ABORTED)
      if (token && !isAuthEndpoint(config.url) && isJwtExpiringSoon(token)) {
        token = await refreshAccessToken();
      }
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Bắt lỗi 401 và thực hiện Refresh Token
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true;
      const newAccessToken = await refreshAccessToken();
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }
      return axiosClient(originalRequest);
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
