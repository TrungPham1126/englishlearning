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

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("accessToken"),
  user: localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user")!)
    : null,
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
