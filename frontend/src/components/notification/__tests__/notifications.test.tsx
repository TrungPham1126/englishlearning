import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { NotificationItem } from "@/types/notification";

const { getMock, putMock, patchMock, navigateMock, mockClient } = vi.hoisted(() => {
  const getMock = vi.fn();
  const putMock = vi.fn();
  const patchMock = vi.fn();
  return {
    getMock,
    putMock,
    patchMock,
    navigateMock: vi.fn(),
    mockClient: {
      get: getMock,
      put: putMock,
      patch: patchMock,
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

import { NotificationBell } from "@/components/notification/NotificationBell";
import { NotificationDetailModal } from "@/components/notification/NotificationDetailModal";
import { useAuthStore } from "@/store/useAuthStore";

const sampleNotifications: NotificationItem[] = [
  {
    id: "1",
    title: "Bài tập mới tuần 5",
    message: "Hoàn thành bài Listening trước thứ 6",
    actionType: "NEW_ASSIGNMENT",
    referenceId: 99,
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  // Bản ghi trùng title + text -> NotificationBell cần khử trùng giữ 1 bản
  {
    id: "2",
    title: "Bài tập mới tuần 5",
    message: "Hoàn thành bài Listening trước thứ 6",
    actionType: "NEW_ASSIGNMENT",
    referenceId: 99,
    isRead: true,
    recipientUserId: "10",
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Kết quả chấm bài Writing",
    message: "Điểm 8.5/10 Nhận xét: Bố cục rõ ràng",
    actionType: "GRADED",
    referenceId: 55,
    isRead: false,
    createdAt: new Date().toISOString(),
  },
];

describe("components/notification - NotificationBell & NotificationDetailModal", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    patchMock.mockReset();
    navigateMock.mockReset();
    useAuthStore.setState({
      accessToken: "jwt-1",
      user: {
        id: "10",
        email: "an@elp.vn",
        firstName: "An",
        lastName: "Nguyen",
        roles: ["ROLE_STUDENT"],
      },
      isAuthenticated: true,
    });
  });

  it("tải thông báo, khử trùng, mở panel, đánh dấu tất cả đã đọc (PUT fallback PATCH) và điều hướng", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValue({
      data: {
        data: {
          content: sampleNotifications,
        },
      },
    });
    // PUT read-all thất bại -> phải fallback sang PATCH read-all
    putMock.mockRejectedValueOnce(new Error("405 Method Not Allowed"));
    patchMock.mockResolvedValue({ data: { status: "SUCCESS" } });

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("/api/v1/notifications?page=0&size=30");
    });

    const bellBtn = screen.getByRole("button", { name: "Thông báo hệ thống" });
    // Sau khử trùng item 1 & 2 (ưu tiên item 2 đã đọc + khớp recipientUserId=10), chỉ còn 1 tin chưa đọc (id=3)
    expect(bellBtn).toHaveTextContent("1");

    await user.click(bellBtn);
    expect(bellBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Kết quả chấm bài Writing")).toBeInTheDocument();

    // Đánh dấu tất cả đã đọc
    await user.click(screen.getByRole("button", { name: /Đánh dấu đã đọc/i }));
    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/notifications/read-all");
      expect(patchMock).toHaveBeenCalledWith("/api/v1/notifications/read-all");
    });

    // Click item NEW_ASSIGNMENT -> điều hướng thẳng tới /student/assignments/99/take
    await user.click(screen.getByText("Bài tập mới tuần 5"));
    expect(navigateMock).toHaveBeenCalledWith("/student/assignments/99/take");

    // Mở lại và nhấn Escape để đóng dropdown
    await user.click(bellBtn);
    expect(bellBtn).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(bellBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("click thông báo GRADED sẽ mở NotificationDetailModal và gọi API mark-read", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValue({
      data: {
        data: [sampleNotifications[2]],
      },
    });
    putMock.mockResolvedValue({ data: { status: "SUCCESS" } });

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getMock).toHaveBeenCalled());

    const bellBtn = screen.getByRole("button", { name: "Thông báo hệ thống" });
    await user.click(bellBtn);

    await user.click(screen.getByText("Kết quả chấm bài Writing"));
    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/notifications/3/read");
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("8.5/10")).toBeInTheDocument();
    expect(screen.getByText("Bố cục rõ ràng")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Xem chi tiết bài làm/i }));
    expect(navigateMock).toHaveBeenCalledWith("/student/assignments/55/take");
  });

  it("NotificationDetailModal render đúng AI_EVALUATION, TEXT_ANNOUNCEMENT và trả về null khi rỗng", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { rerender } = render(
      <MemoryRouter>
        <NotificationDetailModal notification={null} isOpen={true} onClose={onClose} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <NotificationDetailModal
          isOpen={true}
          notification={{
            id: "77",
            title: "Kết quả AI Speaking",
            message: "AI đánh giá đạt Band 7.5 và CEFR C1",
            actionType: "AI_EVALUATION",
            isRead: true,
            createdAt: new Date().toISOString(),
          }}
          onClose={onClose}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Band 7.5")).toBeInTheDocument();
    expect(screen.getByText("CEFR C1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mở phòng luyện AI/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/student/submissions");

    rerender(
      <MemoryRouter>
        <NotificationDetailModal
          isOpen={true}
          notification={{
            id: "88",
            title: "Thông báo bảo trì",
            message: "Hệ thống nâng cấp lúc 23:00",
            isRead: true,
            createdAt: new Date().toISOString(),
          }}
          onClose={onClose}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("HỆ THỐNG")).toBeInTheDocument();
    expect(screen.getByText("Hệ thống nâng cấp lúc 23:00")).toBeInTheDocument();
  });

  it("hiển thị floating toast và cập nhật chuông khi nhận sự kiện teacher-task-toast & teacher-notification-local", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValue({ data: { data: { content: [] } } });
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("/api/v1/notifications?page=0&size=30");
    });

    window.dispatchEvent(
      new CustomEvent("teacher-task-toast", {
        detail: {
          id: "toast-1",
          taskKey: "assign:unit-1",
          status: "PROCESSING",
          title: 'Đang tạo và gán "Unit 1"',
          message: "Hệ thống đang xử lý gán bài tập vào lộ trình.",
          createdAt: new Date().toISOString(),
        },
      }),
    );

    expect(
      await screen.findByText('Đang tạo và gán "Unit 1"'),
    ).toBeInTheDocument();

    window.dispatchEvent(
      new CustomEvent("teacher-task-toast", {
        detail: {
          id: "toast-2",
          taskKey: "assign:unit-1",
          status: "SUCCESS",
          title: "Gán bài tập vào lộ trình thành công",
          message: 'Đã gán "Unit 1" vào Ngày 5.',
          createdAt: new Date().toISOString(),
        },
      }),
    );

    expect(
      await screen.findByText("Gán bài tập vào lộ trình thành công"),
    ).toBeInTheDocument();

    window.dispatchEvent(
      new CustomEvent("teacher-notification-local", {
        detail: {
          id: "local-notif-1",
          title: "Lỗi gán bài tập vào lộ trình - Cần gán lại",
          message: 'Không thể gán "Unit 2" vào lộ trình: Lỗi mạng.',
          type: "SYSTEM_ALERT",
          actionType: "TEXT_ANNOUNCEMENT",
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      }),
    );

    const bellButton = screen.getByRole("button", { name: "Thông báo hệ thống" });
    await user.click(bellButton);

    expect(
      await screen.findByText("Lỗi gán bài tập vào lộ trình - Cần gán lại"),
    ).toBeInTheDocument();
  });
});
