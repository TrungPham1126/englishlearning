import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AuthResponse, UserSummaryDto } from "@/types/api";

const { postMock, getMock, navigateMock, mockClient } = vi.hoisted(() => {
  const postMock = vi.fn();
  const getMock = vi.fn();
  return {
    postMock,
    getMock,
    navigateMock: vi.fn(),
    mockClient: {
      post: postMock,
      get: getMock,
    },
  };
});

vi.mock("@/lib/axiosClient", () => ({
  default: mockClient,
  axiosClient: mockClient,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { authApi } from "@/features/auth/api/authApi";
import LoginPage from "@/features/auth/pages/LoginPage";
import RegisterPage from "@/features/auth/pages/RegisterPage";
import { ThemeProvider } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/useAuthStore";

function makeUser(roles: UserSummaryDto["roles"]): UserSummaryDto {
  return {
    id: "1",
    email: "user@elp.edu.vn",
    firstName: "Hoa",
    lastName: "Le",
    roles,
  };
}

function makeAuthResponse(roles: UserSummaryDto["roles"]): AuthResponse {
  return {
    accessToken: "jwt-token-123",
    tokenType: "Bearer",
    expiresIn: 3600,
    user: makeUser(roles),
  };
}

describe("features/auth - authApi", () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
  });

  it("gọi đúng endpoint login, getCurrentUser và logout", async () => {
    const authPayload = makeAuthResponse(["ROLE_STUDENT"]);
    postMock.mockResolvedValueOnce({ data: { status: "SUCCESS", data: authPayload } });
    getMock.mockResolvedValueOnce({ data: { status: "SUCCESS", data: authPayload.user } });
    postMock.mockResolvedValueOnce({ data: { status: "SUCCESS", data: null } });

    const loginRes = await authApi.login({ email: "a@elp.vn", password: "secret" });
    expect(postMock).toHaveBeenCalledWith("/api/v1/auth/login", {
      email: "a@elp.vn",
      password: "secret",
    });
    expect(loginRes).toEqual(authPayload);

    const me = await authApi.getCurrentUser();
    expect(getMock).toHaveBeenCalledWith("/api/v1/auth/me");
    expect(me).toEqual(authPayload.user);

    await authApi.logout();
    expect(postMock).toHaveBeenCalledWith("/api/v1/auth/logout");
  });
});

describe("features/auth - LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
    postMock.mockReset();
    getMock.mockReset();
    navigateMock.mockReset();
    useAuthStore.setState({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  function renderLogin() {
    return render(
      <ThemeProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </ThemeProvider>,
    );
  }

  it("kiểm tra validation email trống, email sai định dạng, mật khẩu trống và bật/tắt hiện mật khẩu", async () => {
    const user = userEvent.setup();
    renderLogin();

    const submitBtn = screen.getByRole("button", { name: /Đăng nhập/i });
    await user.click(submitBtn);
    expect(screen.getByText("Vui lòng nhập địa chỉ email")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập mật khẩu")).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();

    const emailInput = screen.getByLabelText(/Email/i);
    await user.type(emailInput, "khong-hop-le");
    await user.click(submitBtn);
    expect(screen.getByText("Email không đúng định dạng")).toBeInTheDocument();

    const passwordInput = document.querySelector("input[name='password']") as HTMLInputElement;
    expect(passwordInput).toBeTruthy();
    expect(passwordInput.type).toBe("password");

    await user.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(passwordInput.type).toBe("text");
    await user.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
    expect(passwordInput.type).toBe("password");
  });

  it("điều hướng đúng theo từng vai trò (ADMIN -> /admin/users, TEACHER -> /teacher/classrooms, STUDENT -> /student/courses)", async () => {
    const user = userEvent.setup();

    for (const [role, expectedPath] of [
      ["ROLE_ADMIN", "/admin/users"],
      ["ROLE_TEACHER", "/teacher/classrooms"],
      ["ROLE_STUDENT", "/student/courses"],
    ] as const) {
      navigateMock.mockReset();
      postMock.mockResolvedValueOnce({
        data: { status: "SUCCESS", data: makeAuthResponse([role]) },
      });

      const { unmount } = renderLogin();
      const emailInput = screen.getByLabelText(/Email/i);
      const passwordInput = document.querySelector("input[name='password']") as HTMLInputElement;

      await user.type(emailInput, "  teacher@elp.edu.vn  ");
      await user.type(passwordInput, "Password123!");
      await user.click(screen.getByRole("button", { name: /Đăng nhập/i }));

      await waitFor(() => {
        expect(postMock).toHaveBeenCalledWith("/api/v1/auth/login", {
          email: "teacher@elp.edu.vn",
          password: "Password123!",
        });
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
        expect(navigateMock).toHaveBeenCalledWith(expectedPath, { replace: true });
      });

      unmount();
    }
  });

  it("hiển thị thông báo lỗi từ server, lỗi mạng (không có response) và lỗi mặc định", async () => {
    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = document.querySelector("input[name='password']") as HTMLInputElement;
    const submitBtn = screen.getByRole("button", { name: /Đăng nhập/i });

    await user.type(emailInput, "student@elp.edu.vn");
    await user.type(passwordInput, "wrong-pass");

    // 1. Lỗi có message từ server
    postMock.mockRejectedValueOnce({
      response: { data: { message: "Tài khoản đã bị khóa tạm thời" } },
    });
    await user.click(submitBtn);
    expect(await screen.findByText("Tài khoản đã bị khóa tạm thời")).toBeInTheDocument();

    // 2. Lỗi mạng (request có nhưng không có response)
    postMock.mockRejectedValueOnce({
      request: {},
    });
    await user.click(submitBtn);
    expect(
      await screen.findByText(
        "Không thể kết nối đến máy chủ backend. Vui lòng kiểm tra kết nối mạng.",
      ),
    ).toBeInTheDocument();

    // 3. Lỗi mặc định khi server không trả message
    postMock.mockRejectedValueOnce({
      response: { data: {} },
    });
    await user.click(submitBtn);
    expect(await screen.findByText("Email hoặc mật khẩu không chính xác.")).toBeInTheDocument();
  });
});

describe("features/auth - RegisterPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hiển thị thông báo đóng tự đăng ký, link quay lại /login và tự chuyển hướng sau 3 giây", () => {
    vi.useFakeTimers();

    const { unmount } = render(
      <ThemeProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText(/Chức Năng Tự Đăng Ký Đã Đóng/i)).toBeInTheDocument();
    const loginLinks = screen.getAllByRole("link");
    expect(loginLinks.some((a) => a.getAttribute("href") === "/login")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });

    unmount();
  });
});
