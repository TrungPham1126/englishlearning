import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosHeaders } from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import axiosClient from "@/lib/axiosClient";
import { useAuthStore } from "@/store/useAuthStore";
import type { UserSummaryDto } from "@/types/api";

const mockUser: UserSummaryDto = {
  id: "1",
  email: "student@elp.edu.vn",
  firstName: "An",
  lastName: "Nguyen",
  roles: ["ROLE_STUDENT"],
};

function makeConfig(
  url: string,
  extra?: Partial<InternalAxiosRequestConfig>,
): InternalAxiosRequestConfig {
  return {
    url,
    method: "get",
    headers: new AxiosHeaders(),
    ...extra,
  } as InternalAxiosRequestConfig;
}

describe("lib/axiosClient - Interceptors & Refresh Token Queue", () => {
  const originalAdapter = axiosClient.defaults.adapter;

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    axiosClient.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it("tự động đính kèm ngrok header và Bearer token từ Zustand store", async () => {
    useAuthStore.getState().setAuth("jwt-from-store", mockUser);

    let capturedConfig: InternalAxiosRequestConfig | null = null;
    const adapter: AxiosAdapter = async (config) => {
      capturedConfig = config;
      return {
        data: { status: "SUCCESS", data: { ok: true } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      } satisfies AxiosResponse;
    };
    axiosClient.defaults.adapter = adapter;

    await axiosClient.get("/api/v1/student/profile");

    expect(capturedConfig).not.toBeNull();
    expect(capturedConfig!.headers.get("ngrok-skip-browser-warning")).toBe("true");
    expect(capturedConfig!.headers.get("Authorization")).toBe("Bearer jwt-from-store");
  });

  it("fallback đọc token từ localStorage('accessToken') hoặc localStorage('auth-storage') khi Zustand trống", async () => {
    localStorage.setItem("accessToken", "fallback-raw-token");

    const authHeadersSeen: Array<string | undefined> = [];
    axiosClient.defaults.adapter = async (config) => {
      authHeadersSeen.push(config.headers.get("Authorization") as string | undefined);
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    await axiosClient.get("/api/v1/test-1");

    // Bỏ qua giá trị rác "null"/"undefined", fallback sang auth-storage JSON
    localStorage.setItem("accessToken", "null");
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({ state: { accessToken: "persisted-zustand-token" } }),
    );
    await axiosClient.get("/api/v1/test-2");

    // Nếu không có token nào thì không gửi Authorization
    localStorage.removeItem("accessToken");
    localStorage.setItem("auth-storage", "{broken-json");
    await axiosClient.get("/api/v1/test-3");

    expect(authHeadersSeen).toEqual([
      "Bearer fallback-raw-token",
      "Bearer persisted-zustand-token",
      undefined,
    ]);
  });

  it("xóa Content-Type trước transformRequest khi payload là FormData để giữ nguyên FormData thay vì JSON.stringify", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["hello"], { type: "text/plain" }), "note.txt");

    let headerInsideTransform: unknown = "unset";
    let seenData: unknown = null;
    axiosClient.defaults.adapter = async (config) => {
      seenData = config.data;
      return {
        data: { uploaded: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    await axiosClient.post("/api/v1/files/upload", formData, {
      headers: { "Content-Type": "application/json" },
      transformRequest: [
        (data, headers) => {
          headerInsideTransform = headers.get("Content-Type");
          return data;
        },
        ...(Array.isArray(axios.defaults.transformRequest)
          ? axios.defaults.transformRequest
          : []),
      ],
    });

    expect(headerInsideTransform).toBeUndefined();
    expect(seenData).toBeInstanceOf(FormData);
  });

  it("không kích hoạt refresh token với các endpoint auth (/login, /refresh-token, /logout) và xử lý lỗi thiếu config", async () => {
    const refreshSpy = vi.spyOn(axios, "post");

    axiosClient.defaults.adapter = async (config) => {
      const err = new axios.AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
        data: { message: "Invalid credentials" },
      });
      throw err;
    };

    await expect(axiosClient.post("/api/v1/auth/login", {})).rejects.toThrow();
    await expect(axiosClient.post("/api/v1/auth/refresh-token", {})).rejects.toThrow();
    await expect(axiosClient.post("/api/v1/auth/logout", {})).rejects.toThrow();
    expect(refreshSpy).not.toHaveBeenCalled();

    // Khi adapter reject lỗi không có error.config
    axiosClient.defaults.adapter = async () => {
      throw new Error("Network failure without config");
    };
    await expect(axiosClient.get("/api/v1/anything")).rejects.toThrow(
      "Network failure without config",
    );
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("xử lý hàng đợi 401 đồng thời: chỉ gọi refresh-token 1 lần và retry tất cả request với token mới", async () => {
    useAuthStore.getState().setAuth("expired-token", mockUser);

    let callCount = 0;
    const seenTokensByCall: string[] = [];

    axiosClient.defaults.adapter = async (config) => {
      callCount += 1;
      const auth = String(config.headers.get("Authorization") ?? "");
      seenTokensByCall.push(`${config.url}:${auth}`);

      if (auth === "Bearer expired-token") {
        throw new axios.AxiosError("Expired", "ERR_BAD_REQUEST", config, undefined, {
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          config,
          data: {},
        });
      }

      return {
        data: { url: config.url, ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const refreshSpy = vi.spyOn(axios, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: {
                status: "SUCCESS",
                data: { accessToken: "fresh-token-999" },
              },
            });
          }, 15);
        }),
    );

    const [res1, res2, res3] = await Promise.all([
      axiosClient.get("/api/v1/courses"),
      axiosClient.get("/api/v1/notifications"),
      axiosClient.get("/api/v1/profile"),
    ]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy.mock.calls[0][0]).toMatch(/\/api\/v1\/auth\/refresh-token$/);
    expect(useAuthStore.getState().accessToken).toBe("fresh-token-999");
    expect(res1.data.ok).toBe(true);
    expect(res2.data.ok).toBe(true);
    expect(res3.data.ok).toBe(true);
    expect(callCount).toBe(6);
    expect(seenTokensByCall.filter((s) => s.includes("Bearer fresh-token-999"))).toHaveLength(3);
  });

  it("logout và reject toàn bộ hàng đợi khi refresh-token thất bại hoặc thiếu accessToken", async () => {
    useAuthStore.getState().setAuth("expired-token", mockUser);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logoutSpy = vi.spyOn(useAuthStore.getState(), "logout");

    axiosClient.defaults.adapter = async (config) => {
      throw new axios.AxiosError("Expired", "ERR_BAD_REQUEST", config, undefined, {
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config: makeConfig(config.url || "/api/v1/protected"),
        data: {},
      });
    };

    // Trường hợp server trả 200 nhưng thiếu accessToken trong payload
    const refreshSpy = vi.spyOn(axios, "post").mockResolvedValue({
      data: { status: "SUCCESS", data: {} },
    });

    const p1 = axiosClient.get("/api/v1/a");
    const p2 = axiosClient.get("/api/v1/b");

    await expect(p1).rejects.toThrow();
    await expect(p2).rejects.toThrow();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    consoleErrorSpy.mockRestore();
  });

  it("không lặp vô hạn khi request đã _retry vẫn trả 401 và bỏ qua lỗi khác 401 (403/500)", async () => {
    useAuthStore.getState().setAuth("expired-token", mockUser);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // 1. Lỗi 500 không gọi refresh
    axiosClient.defaults.adapter = async (config) => {
      throw new axios.AxiosError("Server Error", "ERR_BAD_RESPONSE", config, undefined, {
        status: 500,
        statusText: "Internal Server Error",
        headers: {},
        config,
        data: {},
      });
    };
    const refreshSpy = vi.spyOn(axios, "post").mockResolvedValue({
      data: { status: "SUCCESS", data: { accessToken: "still-bad-token" } },
    });

    await expect(axiosClient.get("/api/v1/server-down")).rejects.toThrow();
    expect(refreshSpy).not.toHaveBeenCalled();

    // 2. Retry xong vẫn nhận 401 -> không refresh lần 2
    axiosClient.defaults.adapter = async (config) => {
      throw new axios.AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
        data: {},
      });
    };

    await expect(axiosClient.get("/api/v1/always-401")).rejects.toThrow();
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });
});
