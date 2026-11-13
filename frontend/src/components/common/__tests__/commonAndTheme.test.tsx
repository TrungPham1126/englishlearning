import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import ThemeToggle from "@/components/common/ThemeToggle";
import { AiQuotaIndicator } from "@/components/common/AiQuotaIndicator";
import { StreakBadge } from "@/components/common/StreakBadge";

function ThemeInspector() {
  const { theme, themeMode, setTheme, setThemeMode, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="resolved-theme">{theme}</span>
      <span data-testid="theme-mode">{themeMode}</span>
      <button type="button" onClick={() => setTheme("dark")}>
        Set Dark
      </button>
      <button type="button" onClick={() => setThemeMode("system")}>
        Set System
      </button>
      <button type="button" onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
}

describe("context/ThemeContext & common components", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
    vi.restoreAllMocks();
  });

  it("useTheme báo lỗi nếu dùng ngoài ThemeProvider", () => {
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ThemeInspector />)).toThrow(
      "useTheme must be used within a ThemeProvider",
    );
    consoleErr.mockRestore();
  });

  it("ThemeProvider giữ nguyên 'system' trong localStorage và cập nhật theo media query change", async () => {
    const user = userEvent.setup();
    let mediaMatches = false;
    const listeners = new Set<(e: MediaQueryListEvent) => void>();

    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      get matches() {
        return mediaMatches;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_: string, cb: EventListenerOrEventListenerObject) => {
        listeners.add(cb as (e: MediaQueryListEvent) => void);
      },
      removeEventListener: (_: string, cb: EventListenerOrEventListenerObject) => {
        listeners.delete(cb as (e: MediaQueryListEvent) => void);
      },
      dispatchEvent: vi.fn(),
    }));

    render(
      <ThemeProvider>
        <ThemeInspector />
        <ThemeToggle variant="pill" showLabel />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("light");

    await user.click(screen.getByRole("button", { name: "Set System" }));
    expect(screen.getByTestId("theme-mode")).toHaveTextContent("system");
    // Bug fix check: localStorage phải giữ nguyên "system" thay vì bị ghi đè thành "light"
    expect(localStorage.getItem("elp_theme")).toBe("system");

    // Hệ điều hành chuyển sang Dark Mode -> giao diện tự đổi sang dark nhưng localStorage vẫn giữ "system"
    act(() => {
      mediaMatches = true;
      listeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent));
    });
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("elp_theme")).toBe("system");

    // Chuyển sang explicit dark rồi toggle sang light qua ThemeToggle
    await user.click(screen.getByRole("button", { name: "Chuyển đổi giao diện Sáng/Tối" }));
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("light");
    expect(screen.getByText("Sáng")).toBeInTheDocument();
  });

  it("AiQuotaIndicator tính đúng lượt còn lại và chống NaN / chia cho 0 từ localStorage", () => {
    localStorage.setItem("elp_ai_quota_used", "not-a-number");
    localStorage.setItem("elp_ai_quota_limit", "0");

    const { unmount } = render(<AiQuotaIndicator />);
    // Fallback an toàn về default used = 18, limit = 50 -> remaining = 32 / 50
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText(/\/.*50/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("NaN");

    unmount();
    localStorage.clear();

    // Props hợp lệ khi localStorage trống
    const { rerender } = render(<AiQuotaIndicator used={47} total={50} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/\/.*50/)).toBeInTheDocument();

    // Khi vượt quá giới hạn -> remaining tối thiểu bằng 0
    rerender(<AiQuotaIndicator used={80} total={50} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("StreakBadge hiển thị chuỗi ngày học và lọc bỏ NaN/số âm từ localStorage", () => {
    localStorage.setItem("elp_student_streak", "NaN");
    const first = render(<StreakBadge />);
    // Giá trị NaN bị bỏ qua -> giữ nguyên default initialStreak = 5
    expect(screen.getByText("5")).toBeInTheDocument();
    first.unmount();

    localStorage.setItem("elp_student_streak", "14");
    const second = render(<StreakBadge />);
    expect(screen.getByText("14")).toBeInTheDocument();
    second.unmount();

    localStorage.removeItem("elp_student_streak");
    render(<StreakBadge initialStreak={21} />);
    expect(screen.getByText("21")).toBeInTheDocument();
  });
});
