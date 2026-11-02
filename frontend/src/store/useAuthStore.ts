// src/store/useAuthStore.ts
import { create } from "zustand";
import type { UserSummaryDto } from "@/types/api";

interface AuthState {
  accessToken: string | null;
  user: UserSummaryDto | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserSummaryDto) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

// Hàm đọc user an toàn tránh crash toàn bộ ứng dụng khi localStorage bị hỏng
const getInitialUser = (): UserSummaryDto | null => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Không thể parse thông tin user từ localStorage, xóa cache auth lỗi", error);
    localStorage.removeItem("user");
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("accessToken"),
  user: getInitialUser(),
  isAuthenticated: Boolean(localStorage.getItem("accessToken")),

  setAuth: (token, user) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ accessToken: token, user, isAuthenticated: true });
  },

  setAccessToken: (token) => {
    localStorage.setItem("accessToken", token);
    set({ accessToken: token });
  },

  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    set({ accessToken: null, user: null, isAuthenticated: false });
  },
}));
