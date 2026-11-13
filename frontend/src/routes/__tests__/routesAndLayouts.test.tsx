import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { UserSummaryDto } from "@/types/api";

const {
  getMock,
  postMock,
  putMock,
  patchMock,
  getPendingVideosMock,
  getMyCoursesMock,
  getSkillProfileMock,
  mockClient,
} = vi.hoisted(() => {
  const getMock = vi.fn();
  const postMock = vi.fn();
  const putMock = vi.fn();
  const patchMock = vi.fn();
  return {
    getMock,
    postMock,
    putMock,
    patchMock,
    getPendingVideosMock: vi.fn(),
    getMyCoursesMock: vi.fn(),
    getSkillProfileMock: vi.fn(),
    mockClient: {
      get: getMock,
      post: postMock,
      put: putMock,
      patch: patchMock,
    },
  };
});

vi.mock("@/lib/axiosClient", () => ({
  default: mockClient,
  axiosClient: mockClient,
}));

vi.mock("@/features/admin/api/adminApi", () => ({
  adminApi: {
    getPendingVideos: getPendingVideosMock,
  },
}));

vi.mock("@/features/student/api/studentApi", () => ({
  studentApi: {
    getMyCourses: getMyCoursesMock,
    getSkillProfile: getSkillProfileMock,
  },
}));

import ProtectedRoute from "@/routes/ProtectedRoute";
import PublicLayout from "@/components/layouts/PublicLayout";
import StudentLayout from "@/components/layouts/StudentLayout";
import TeacherLayout from "@/components/layouts/TeacherLayout";
import AdminLayout from "@/components/layouts/AdminLayout";
import StudentProfileMenu from "@/components/layouts/StudentProfileMenu";
import { ThemeProvider } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/useAuthStore";

function makeUser(roles: UserSummaryDto["roles"]): UserSummaryDto {
  return {
    id: "7",
    email: "demo@elp.edu.vn",
    firstName: "Minh",
    lastName: "Nguyen",
    phone: "0909123456",
    roles,
  };
}

describe("routes/ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ accessToken: null, user: null, isAuthenticated: false });
  });

  function renderProtected(allowedRoles: UserSummaryDto["roles"]) {
    return render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/login" element={<div>Login View</div>} />
          <Route path="/unauthorized" element={<div>Unauthorized View</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute allowedRoles={allowedRoles}>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("chuyển hướng /login khi chưa đăng nhập hoặc thiếu user", () => {
    renderProtected(["ROLE_STUDENT"]);
    expect(screen.getByText("Login View")).toBeInTheDocument();
  });

  it("chuyển hướng /unauthorized khi vai trò không nằm trong allowedRoles", () => {
    useAuthStore.getState().setAuth("jwt", makeUser(["ROLE_STUDENT"]));
    renderProtected(["ROLE_ADMIN", "ROLE_TEACHER"]);
    expect(screen.getByText("Unauthorized View")).toBeInTheDocument();
  });

  it("hiển thị children khi đã đăng nhập với vai trò hợp lệ", () => {
    useAuthStore.getState().setAuth("jwt", makeUser(["ROLE_TEACHER"]));
    renderProtected(["ROLE_TEACHER", "ROLE_ADMIN"]);
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});

describe("components/layouts", () => {
  beforeEach(() => {
    localStorage.clear();
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    patchMock.mockReset();
    getPendingVideosMock.mockReset();
    getMyCoursesMock.mockReset();
    getSkillProfileMock.mockReset();

    getMock.mockImplementation((url: string) => {
      if (url.includes("/notifications")) {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url.includes("/my-courses")) {
        return Promise.resolve({ data: { data: [{ id: 1 }, { id: 2 }] } });
      }
      if (url.includes("/my-profile")) {
        return Promise.resolve({
          data: {
            data: {
              listeningScore: 10,
              speakingScore: 20,
              readingScore: 15,
              writingScore: 15,
              grammarScore: 10,
              vocabularyScore: 10,
            },
          },
        });
      }
      return Promise.resolve({ data: { data: null } });
    });
    postMock.mockResolvedValue({ data: { status: "SUCCESS", data: "/uploads/new-avatar.png" } });
    getPendingVideosMock.mockResolvedValue([]);
    getMyCoursesMock.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    getSkillProfileMock.mockResolvedValue({
      listeningScore: 2,
      speakingScore: 3,
      readingScore: 1.5,
      writingScore: 2,
      grammarScore: 2,
      vocabularyScore: 2,
    });
  });

  it("PublicLayout hiển thị header thương hiệu, nút đổi theme và Outlet", () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/login" element={<div>Login Body</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText("ELP LEARNING")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chuyển đổi giao diện Sáng/Tối" })).toBeInTheDocument();
    expect(screen.getByText("Login Body")).toBeInTheDocument();
  });

  it("StudentLayout điều hướng mobile menu, ẩn bottom nav tại route '/take' và hỗ trợ logout", async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setAuth("jwt-student", makeUser(["ROLE_STUDENT"]));

    const firstView = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/student/courses"]}>
          <Routes>
            <Route element={<StudentLayout />}>
              <Route path="/student/courses" element={<div>Courses Outlet</div>} />
            </Route>
            <Route path="/login" element={<div>Login Page Redirected</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText("Courses Outlet")).toBeInTheDocument();
    // Tại /student/courses có cả top nav và mobile bottom nav -> link 'Khóa học' xuất hiện nhiều hơn 1 lần
    const courseLinksOnNormalRoute = screen.getAllByRole("link", { name: /Khóa học/i }).length;
    expect(courseLinksOnNormalRoute).toBeGreaterThanOrEqual(2);

    // Mở menu điều hướng mobile
    const hamburger = screen.getByRole("button", { name: "Mở menu điều hướng" });
    await user.click(hamburger);
    expect(screen.getByRole("button", { name: "Đóng menu điều hướng" })).toBeInTheDocument();

    firstView.unmount();

    // Khi route chứa '/take', bottom nav bị ẩn đi
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/student/assignments/42/take"]}>
          <Routes>
            <Route element={<StudentLayout />}>
              <Route
                path="/student/assignments/42/take"
                element={<div>Exam Taking Outlet</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText("Exam Taking Outlet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Khóa học/i }).length).toBeLessThan(
      courseLinksOnNormalRoute,
    );
  });

  it("StudentProfileMenu tải my-courses & skill profile, tính tổng điểm năng lực và logout", async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setAuth("jwt-student", makeUser(["ROLE_STUDENT"]));

    render(
      <MemoryRouter initialEntries={["/student/courses"]}>
        <Routes>
          <Route path="/student/courses" element={<StudentProfileMenu />} />
          <Route path="/student/profile" element={<div>Profile Page</div>} />
          <Route path="/login" element={<div>Login After Logout</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: /Nguyen Minh/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(getMyCoursesMock).toHaveBeenCalledTimes(1);
      expect(getSkillProfileMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("3 lớp")).toBeInTheDocument();
    expect(screen.getByText("12.5 pts")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Đăng xuất/i }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/auth/logout");
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(screen.getByText("Login After Logout")).toBeInTheDocument();
    });
  });

  it("TeacherLayout upload avatar cập nhật store và thực hiện đăng xuất an toàn", async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setAuth("jwt-teacher", makeUser(["ROLE_TEACHER"]));

    const { container } = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/teacher/classrooms"]}>
          <Routes>
            <Route element={<TeacherLayout />}>
              <Route path="/teacher/classrooms" element={<div>Teacher Classrooms</div>} />
            </Route>
            <Route path="/login" element={<div>Login View</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText("Cổng Thông Tin Giảng Viên")).toBeInTheDocument();
    expect(screen.getByText("Teacher Classrooms")).toBeInTheDocument();

    const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;
    const avatarFile = new File(["img"], "avatar.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [avatarFile] } });

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/users/avatar", expect.any(FormData));
      expect(useAuthStore.getState().user?.avatarUrl).toBe("/uploads/new-avatar.png");
    });

    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/auth/logout");
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(screen.getByText("Login View")).toBeInTheDocument();
    });
  });

  it("AdminLayout hiển thị badge số video chờ duyệt, điều hướng tới trang duyệt video và logout", async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setAuth("jwt-admin", makeUser(["ROLE_ADMIN"]));
    getPendingVideosMock.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/admin/users"]}>
          <Routes>
            <Route element={<AdminLayout />}>
              <Route path="/admin/users" element={<div>Admin Users</div>} />
              <Route path="/admin/video-moderation" element={<div>Video Moderation</div>} />
            </Route>
            <Route path="/login" element={<div>Login View</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText("Hệ Thống Quản Trị Trung Tâm")).toBeInTheDocument();
    const pendingBtn = await screen.findByRole("button", { name: /3 video chờ duyệt/i });
    await user.click(pendingBtn);
    expect(screen.getByText("Video Moderation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/auth/logout");
      expect(screen.getByText("Login View")).toBeInTheDocument();
    });
  });
});
