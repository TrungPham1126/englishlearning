import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  AudioPlayer,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  TabContent,
  TabList,
  TabTrigger,
  Tabs,
  Textarea,
  Tooltip,
} from "@/components/ui";

describe("components/ui primitives", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("Button hỗ trợ variants, icons, trạng thái disabled và isLoading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    const { rerender } = render(
      <Button
        variant="primary"
        size="lg"
        leftIcon={<span data-testid="left-icon">L</span>}
        rightIcon={<span data-testid="right-icon">R</span>}
        onClick={onClick}
      >
        Nộp bài
      </Button>,
    );

    const btn = screen.getByRole("button", { name: /Nộp bài/i });
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    expect(screen.getByTestId("right-icon")).toBeInTheDocument();
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button variant="destructive" isLoading onClick={onClick}>
        Đang xử lý
      </Button>,
    );
    expect(btn).toBeDisabled();
    expect(screen.queryByTestId("left-icon")).not.toBeInTheDocument();
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Badge, Card, EmptyState và Skeleton render đúng nội dung & số lượng dòng", () => {
    render(
      <div>
        <Badge variant="success" size="md" dot>
          Hoàn thành
        </Badge>
        <Card className="custom-card">
          <CardHeader>
            <CardTitle>Tiêu đề thẻ</CardTitle>
            <CardDescription>Mô tả chi tiết</CardDescription>
          </CardHeader>
          <CardContent>Nội dung chính</CardContent>
          <CardFooter>Chân trang</CardFooter>
        </Card>
        <EmptyState
          title="Chưa có dữ liệu"
          description="Hãy thêm bài học mới"
          icon={<span data-testid="empty-icon">!</span>}
          action={<button type="button">Tạo mới</button>}
        />
        <Skeleton className="h-4 w-10" />
        <SkeletonCard />
        <SkeletonTable rows={3} />
      </div>,
    );

    expect(screen.getByText("Hoàn thành")).toBeInTheDocument();
    expect(screen.getByText("Tiêu đề thẻ")).toBeInTheDocument();
    expect(screen.getByText("Mô tả chi tiết")).toBeInTheDocument();
    expect(screen.getByText("Nội dung chính")).toBeInTheDocument();
    expect(screen.getByText("Chân trang")).toBeInTheDocument();
    expect(screen.getByText("Chưa có dữ liệu")).toBeInTheDocument();
    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo mới" })).toBeInTheDocument();
  });

  it("Input & Textarea gắn label/aria-invalid/aria-describedby chính xác", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <div>
        <Input
          label="Email học viên"
          helperText="Dùng email trường cấp"
          startIcon={<span data-testid="start-ic">@</span>}
          endIcon={<span data-testid="end-ic">OK</span>}
        />
        <Textarea label="Ghi chú" rows={4} helperText="Tối đa 500 ký tự" />
      </div>,
    );

    const emailInput = screen.getByLabelText("Email học viên");
    expect(emailInput).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText("Dùng email trường cấp")).toBeInTheDocument();
    expect(screen.getByTestId("start-ic")).toBeInTheDocument();
    expect(screen.getByTestId("end-ic")).toBeInTheDocument();
    await user.type(emailInput, "an@elp.vn");
    expect(emailInput).toHaveValue("an@elp.vn");

    const noteArea = screen.getByLabelText("Ghi chú");
    expect(noteArea).toHaveAttribute("rows", "4");

    rerender(
      <div>
        <Input label="Email học viên" error="Email không hợp lệ" />
        <Textarea label="Ghi chú" error="Vui lòng nhập ghi chú" />
      </div>,
    );

    const emailInputEl = screen.getByLabelText("Email học viên");
    expect(emailInputEl).toHaveAttribute("aria-invalid", "true");
    const emailErrText = screen.getByText("Email không hợp lệ");
    expect(emailInputEl).toHaveAttribute(
      "aria-describedby",
      emailErrText.closest("p")?.getAttribute("id"),
    );
    expect(screen.getByLabelText("Ghi chú")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Vui lòng nhập ghi chú")).toBeInTheDocument();
  });

  it("Tabs hỗ trợ uncontrolled, controlled, disabled tab và báo lỗi nếu dùng ngoài Tabs", async () => {
    const user = userEvent.setup();
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TabTrigger value="a">A</TabTrigger>)).toThrow(
      "TabTrigger must be used inside Tabs",
    );
    expect(() => render(<TabContent value="a">Body</TabContent>)).toThrow(
      "TabContent must be used inside Tabs",
    );
    consoleErr.mockRestore();

    const onValueChange = vi.fn();
    const { rerender } = render(
      <Tabs defaultValue="t1" onValueChange={onValueChange}>
        <TabList>
          <TabTrigger value="t1">Tab 1</TabTrigger>
          <TabTrigger value="t2">Tab 2</TabTrigger>
          <TabTrigger value="t3" disabled>
            Tab 3 Disabled
          </TabTrigger>
        </TabList>
        <TabContent value="t1">Panel 1</TabContent>
        <TabContent value="t2">Panel 2</TabContent>
        <TabContent value="t3">Panel 3</TabContent>
      </Tabs>,
    );

    expect(screen.getByText("Panel 1")).toBeInTheDocument();
    expect(screen.queryByText("Panel 2")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tab 2" }));
    expect(onValueChange).toHaveBeenCalledWith("t2");
    expect(screen.getByText("Panel 2")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tab 3 Disabled" }));
    expect(screen.queryByText("Panel 3")).not.toBeInTheDocument();

    rerender(
      <Tabs value="t1" onValueChange={onValueChange}>
        <TabList>
          <TabTrigger value="t1">Tab 1</TabTrigger>
          <TabTrigger value="t2">Tab 2</TabTrigger>
        </TabList>
        <TabContent value="t1">Panel 1</TabContent>
        <TabContent value="t2">Panel 2</TabContent>
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: "Tab 1" })).toHaveAttribute("aria-selected", "true");
  });

  it("Tooltip hiển thị theo delay, ẩn khi rời chuột / Escape và dọn timer khi unmount", () => {
    vi.useFakeTimers();

    const { unmount } = render(
      <Tooltip content="Mở rộng thẻ" delayMs={250}>
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Hover me" }).parentElement!;
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Mở rộng thẻ");

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Focus rồi blur trước khi hết delay -> không rò rỉ hiển thị tooltip
    fireEvent.focus(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.blur(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Schedule timer rồi unmount ngay -> không lỗi timer
    fireEvent.mouseEnter(trigger);
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });
  });

  it("Dropdown mở menu, kích hoạt item bằng click/Enter/Space, đóng bằng Escape và click ngoài", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <div>
        <div data-testid="outside">Ngoài menu</div>
        <Dropdown trigger={<button type="button">Thao tác</button>}>
          <DropdownItem onClick={onEdit}>Chỉnh sửa</DropdownItem>
          <DropdownSeparator />
          <DropdownItem destructive onClick={onDelete}>
            Xóa mục
          </DropdownItem>
        </Dropdown>
      </div>,
    );

    const triggerBtn = screen.getByRole("button", { name: "Thao tác" });
    const triggerWrapper = triggerBtn.parentElement!;
    expect(triggerWrapper).toHaveAttribute("aria-expanded", "false");

    await user.click(triggerBtn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(triggerWrapper).toHaveAttribute("aria-expanded", "true");

    // Nhấn Enter trên item đầu
    const editItem = screen.getByText("Chỉnh sửa").closest("[role='menuitem']")!;
    fireEvent.keyDown(editItem, { key: "Enter" });
    expect(onEdit).toHaveBeenCalledTimes(1);

    // Đóng bằng Escape
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Mở lại rồi click bên ngoài để đóng
    await user.click(triggerBtn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Mở lại rồi click destructive item
    await user.click(triggerBtn);
    await user.click(screen.getByText("Xóa mục"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Modal hỗ trợ portal, backdrop, Escape, focus restoration và không reset focus khi inline onClose thay đổi", async () => {
    const user = userEvent.setup();

    function ModalHarness({ closeOnBackdrop = true }: { closeOnBackdrop?: boolean }) {
      const [open, setOpen] = useState(false);
      const [text, setText] = useState("");
      const [tick, setTick] = useState(0);

      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Mở hộp thoại
          </button>
          <Modal
            isOpen={open}
            onClose={() => setOpen(false)}
            title="Xác nhận nộp bài"
            description="Kiểm tra lại trước khi gửi"
            closeOnBackdropClick={closeOnBackdrop}
          >
            <input
              aria-label="Ghi chú nộp bài"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="button" onClick={() => setTick((t) => t + 1)}>
              Cập nhật ({tick})
            </button>
          </Modal>
        </div>
      );
    }

    const { rerender } = render(<ModalHarness closeOnBackdrop={true} />);
    const openBtn = screen.getByRole("button", { name: "Mở hộp thoại" });
    openBtn.focus();
    await user.click(openBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Xác nhận nộp bài")).toBeInTheDocument();

    // Focus vào input trong modal rồi gõ + trigger parent state re-render (inline onClose mới)
    const noteInput = screen.getByLabelText("Ghi chú nộp bài");
    noteInput.focus();
    await user.type(noteInput, "abc");
    expect(document.activeElement).toBe(noteInput);

    // Escape đóng modal và khôi phục focus về nút mở
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(openBtn);

    // Backdrop click khi closeOnBackdrop=false không đóng modal
    rerender(<ModalHarness closeOnBackdrop={false} />);
    await user.click(openBtn);
    const backdrop = document.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Đóng qua nút aria-label="Đóng"
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("AudioPlayer xử lý phát/tạm dừng, tốc độ, tắt tiếng, thanh tua, lỗi tải và không bị reset bởi inline onEnded", async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    const pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});

    const onEnded1 = vi.fn();
    const onEnded2 = vi.fn();

    const { rerender } = render(
      <AudioPlayer src="https://cdn.elp.vn/audio/lesson1.mp3" title="Track 1" onEnded={onEnded1} />,
    );

    const audioEl = document.querySelector("audio") as HTMLAudioElement;
    expect(audioEl).toBeTruthy();

    // Ban đầu isLoading=true -> nút Play đang disabled
    const playBtn = screen.getByRole("button", { name: "Phát âm thanh" });
    expect(playBtn).toBeDisabled();

    // Nạp metadata thành công
    Object.defineProperty(audioEl, "duration", { configurable: true, value: 90 });
    fireEvent(audioEl, new Event("loadedmetadata"));
    expect(playBtn).not.toBeDisabled();

    // Phát âm thanh (setIsPlaying(true) chạy sau Promise .play().then())
    fireEvent.click(playBtn);
    expect(playSpy).toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Tạm dừng" })).toBeInTheDocument();

    // Truyền inline onEnded mới (re-render): không được pause hay reset currentTime
    const pauseCountBeforeRerender = pauseSpy.mock.calls.length;
    rerender(
      <AudioPlayer src="https://cdn.elp.vn/audio/lesson1.mp3" title="Track 1" onEnded={onEnded2} />,
    );
    expect(pauseSpy.mock.calls.length).toBe(pauseCountBeforeRerender);
    expect(screen.getByRole("button", { name: "Tạm dừng" })).toBeInTheDocument();

    // Kích hoạt ended -> gọi onEnded2 (callback mới nhất!)
    fireEvent(audioEl, new Event("ended"));
    expect(onEnded1).not.toHaveBeenCalled();
    expect(onEnded2).toHaveBeenCalledTimes(1);

    // Chu kỳ tốc độ phát: 1x -> 1.25x -> 1.5x -> 0.75x -> 1x
    const speedBtn = screen.getByTitle("Tốc độ phát");
    expect(speedBtn).toHaveTextContent("1x");
    fireEvent.click(speedBtn);
    expect(speedBtn).toHaveTextContent("1.25x");
    fireEvent.click(speedBtn);
    expect(speedBtn).toHaveTextContent("1.5x");
    fireEvent.click(speedBtn);
    expect(speedBtn).toHaveTextContent("0.75x");
    fireEvent.click(speedBtn);
    expect(speedBtn).toHaveTextContent("1x");

    // Thanh tua & nút phát lại từ đầu
    const slider = screen.getByRole("slider", { name: "Thanh tiến trình âm thanh" });
    fireEvent.change(slider, { target: { value: "45" } });
    expect(audioEl.currentTime).toBe(45);

    fireEvent.click(screen.getByRole("button", { name: "Phát lại từ đầu" }));
    expect(audioEl.currentTime).toBe(0);

    // Mute / Unmute
    fireEvent.click(screen.getByRole("button", { name: "Tắt tiếng" }));
    expect(audioEl.muted).toBe(true);
    expect(screen.getByRole("button", { name: "Bật âm thanh" })).toBeInTheDocument();

    // Lỗi tải file audio
    fireEvent(audioEl, new Event("error"));
    expect(screen.getByText("Không thể tải file âm thanh")).toBeInTheDocument();

    // src rỗng không bị kẹt trạng thái loading
    rerender(<AudioPlayer src="" title="Trống" />);
    expect(screen.getByRole("button", { name: "Phát âm thanh" })).not.toBeDisabled();
  });
});
