import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/useAuthStore";
import type { ApiResponse, AuthResponse } from "@/types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Request Interceptor: Tự động đính kèm accessToken kèm Fallback
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 1. Đọc token từ bộ nhớ Zustand
    let token = useAuthStore.getState().accessToken;

    // 2. FALLBACK: Nếu Zustand chưa kịp load xong (F5 trang), đọc thẳng từ localStorage
    if (!token) {
      try {
        // Lưu ý: Đổi tên 'auth-storage' thành tên key bạn đang cấu hình trong persist của Zustand nếu khác
        const authStorageStr = localStorage.getItem("auth-storage");
        if (authStorageStr) {
          const { state } = JSON.parse(authStorageStr);
          if (state?.accessToken) {
            token = state.accessToken;
          }
        }
      } catch (error) {
        console.error("Lỗi parse token từ localStorage", error);
      }
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Nếu gửi FormData (upload file/audio), xóa Content-Type để Axios/trình duyệt tự sinh multipart/form-data kèm boundary
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

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

// Response Interceptor: Bắt lỗi 401 và thực hiện Refresh Token
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Không lặp lại nếu bản thân request lỗi là gọi Login hoặc Refresh Token
    const isAuthEndpoint =
      originalRequest.url?.includes("/api/v1/auth/login") ||
      originalRequest.url?.includes("/api/v1/auth/refresh-token");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return axiosClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Backend Spring Boot đọc cookie HttpOnly mang tên 'refreshToken'
        const res = await axios.post<ApiResponse<AuthResponse>>(
          `${API_BASE_URL}/api/v1/auth/refresh-token`,
          {},
          { withCredentials: true },
        );

        const newAccessToken = res.data.data.accessToken;
        useAuthStore.getState().setAccessToken(newAccessToken);

        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return axiosClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
