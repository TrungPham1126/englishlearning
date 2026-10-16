// src/features/auth/api/authApi.ts
import { axiosClient } from "@/lib/axiosClient";
import type { ApiResponse, AuthResponse, UserSummaryDto } from "@/types/api";
import type { LoginFormData } from "../types";

export const authApi = {
  // POST /api/v1/auth/login
  login: async (credentials: LoginFormData): Promise<AuthResponse> => {
    const response = await axiosClient.post<ApiResponse<AuthResponse>>(
      "/api/v1/auth/login",
      credentials,
    );
    return response.data.data;
  },

  // GET /api/v1/auth/me
  getCurrentUser: async (): Promise<UserSummaryDto> => {
    const response =
      await axiosClient.get<ApiResponse<UserSummaryDto>>("/api/v1/auth/me");
    return response.data.data;
  },

  // POST /api/v1/auth/logout
  logout: async (): Promise<void> => {
    await axiosClient.post("/api/v1/auth/logout");
  },
};
