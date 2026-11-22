// src/store/useAuthStore.ts
import { create } from "zustand";
import type { UserSummaryDto } from "@/types/api";

interface AuthState {
  accessToken: string | null;
  user: UserSummaryDto | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserSummaryDto) => void;
  setAccessToken: (token: string) => void;
  updateUser: (partialUser: Partial<UserSummaryDto>) => void;
  logout: () => void;
}

const getInitialToken = (): string | null => {
  try {
    const raw = localStorage.getItem("accessToken");
    if (!raw || raw === "null" || raw === "undefined" || !raw.trim()) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
};

// Hàm đọc user an toàn tránh crash toàn bộ ứng dụng khi localStorage bị hỏng
const getInitialUser = (): UserSummaryDto | null => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      localStorage.removeItem("user");
      return null;
    }
    return parsed as UserSummaryDto;
  } catch (error) {
    console.warn("Không thể parse thông tin user từ localStorage, xóa cache auth lỗi", error);
    try {
      localStorage.removeItem("user");
    } catch {
      // Ignore storage removal errors
    }
    return null;
  }
};

const initialToken = getInitialToken();

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: initialToken,
  user: getInitialUser(),
  isAuthenticated: Boolean(initialToken),

  setAuth: (token, user) => {
    try {
      localStorage.setItem("accessToken", token);
      localStorage.setItem("user", JSON.stringify(user));
    } catch {
      // Ignore storage quota/access errors
    }
    set({ accessToken: token, user, isAuthenticated: Boolean(token && token.trim()) });
  },

  setAccessToken: (token) => {
    try {
      localStorage.setItem("accessToken", token);
    } catch {
      // Ignore storage quota/access errors
    }
    set({ accessToken: token, isAuthenticated: Boolean(token && token.trim()) });
  },

  updateUser: (partialUser) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...partialUser };
    try {
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch {
      // Ignore storage quota/access errors
    }
    set({ user: updatedUser });
  },

  logout: () => {
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      localStorage.removeItem("elp_student_streak");
    } catch {
      // Ignore storage errors
    }
    set({ accessToken: null, user: null, isAuthenticated: false });
  },
}));
