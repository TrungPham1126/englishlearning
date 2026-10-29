// src/features/student/hooks/useShadowingShortcuts.ts
import { useEffect } from "react";

export interface UseShadowingShortcutsParams {
  readonly enabled?: boolean;
  readonly onToggleRecord: () => void;
  readonly onReplayNative: () => void;
  readonly onCloseDrawer?: () => void;
}

/**
 * Tuân thủ tiêu chuẩn Accessibility WCAG 2.1 Level AA (Mục 2.1.1 & 2.1.4):
 * - Phím Space: Bắt đầu / Dừng thu âm (khi focus không nằm trong ô nhập liệu hoặc nút bấm riêng)
 * - Phím R: Nghe lại âm thanh mẫu (Native Speaker)
 * - Phím Escape: Đóng Feedback Drawer/Modal
 */
export function useShadowingShortcuts({
  enabled = true,
  onToggleRecord,
  onReplayNative,
  onCloseDrawer,
}: UseShadowingShortcutsParams): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const isInteractiveElement =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        tag === "button" ||
        tag === "a" ||
        Boolean(target?.isContentEditable);

      if (event.code === "Space" && !isInteractiveElement) {
        event.preventDefault();
        onToggleRecord();
        return;
      }

      if (event.key.toLowerCase() === "r" && !isInteractiveElement) {
        event.preventDefault();
        onReplayNative();
        return;
      }

      if (event.key === "Escape" && onCloseDrawer) {
        onCloseDrawer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onToggleRecord, onReplayNative, onCloseDrawer]);
}
