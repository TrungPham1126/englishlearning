// src/components/notification/NotificationBell.tsx
import { useState, useRef, useEffect } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { axiosClient } from "@/lib/axiosClient";
import type { NotificationItem } from "@/types/notification";
import type { TeacherTaskToastDetail } from "@/utils/teacherTaskNotification";
import { resolveNotificationAction } from "@/utils/notificationAction";
import { NotificationDetailModal } from "./NotificationDetailModal";
import {
  Bell,
  Check,
  ChevronRight,
  GraduationCap,
  Bot,
  FileCheck2,
  BookOpen,
  MessageSquare,
  Clock,
  Layers,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toasts, setToasts] = useState<TeacherTaskToastDetail[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = (toastId: string) => {
    const existingTimer = toastTimersRef.current.get(toastId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      toastTimersRef.current.delete(toastId);
    }
    if (isMountedRef.current) {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }
  };

  const fetchNotifications = async () => {
    try {
      if (isMountedRef.current) setIsLoading(true);
      const res: any = await axiosClient.get(
        "/api/v1/notifications?page=0&size=30",
      );
      if (!isMountedRef.current) return;
      const rawData = res.data?.data ?? res.data;
      const rawList = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.content)
        ? rawData.content
        : [];

      // Deduplicate notifications
      const dedupMap = new Map<string, NotificationItem>();
      for (const item of rawList) {
        const text = (item.message || item.content || "").trim();
        const key = `${(item.title || "").trim()}||${text}`;
        if (!dedupMap.has(key)) {
          dedupMap.set(key, item);
        } else {
          const existing = dedupMap.get(key)!;
          if (
            (!existing.isRead && item.isRead) ||
            (!existing.recipientUserId && item.recipientUserId)
          ) {
            dedupMap.set(key, {
              ...item,
              isRead: Boolean(existing.isRead || item.isRead),
            });
          }
        }
      }
      const serverList = Array.from(dedupMap.values());
      setNotifications((prev) => {
        const preservedLocal = prev.filter((item) => {
          const idStr = String(item.id || "");
          if (!idStr.startsWith("task-") && !idStr.startsWith("local-")) {
            return false;
          }
          const key = `${(item.title || "").trim()}||${(item.message || item.content || "").trim()}`;
          return !dedupMap.has(key);
        });
        const merged = [...preservedLocal, ...serverList];
        setUnreadCount(merged.filter((n: NotificationItem) => !n.isRead).length);
        return merged;
      });
    } catch (err) {
      console.error("Lỗi khi tải thông báo trên Header:", err);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    const handleNotificationUpdated = () => {
      void fetchNotifications();
    };

    const handleLocalNotification = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationItem>;
      const incoming = customEvent.detail;
      if (!incoming || !isMountedRef.current) return;

      const incomingKey = `${(incoming.title || "").trim()}||${(incoming.message || incoming.content || "").trim()}`;
      setNotifications((prev) => {
        const filtered = prev.filter((item) => {
          const itemKey = `${(item.title || "").trim()}||${(item.message || item.content || "").trim()}`;
          return item.id !== incoming.id && itemKey !== incomingKey;
        });
        const nextList = [incoming, ...filtered];
        setUnreadCount(nextList.filter((n) => !n.isRead).length);
        return nextList;
      });
    };

    const handleTaskToast = (event: Event) => {
      const customEvent = event as CustomEvent<TeacherTaskToastDetail>;
      const toast = customEvent.detail;
      if (!toast || !isMountedRef.current) return;

      setToasts((prev) => {
        const next = toast.taskKey
          ? prev.filter((item) => {
              if (item.taskKey === toast.taskKey) {
                const oldTimer = toastTimersRef.current.get(item.id);
                if (oldTimer) {
                  clearTimeout(oldTimer);
                  toastTimersRef.current.delete(item.id);
                }
                return false;
              }
              return true;
            })
          : prev;
        return [toast, ...next].slice(0, 4);
      });

      const durationMs =
        toast.status === "ERROR" ? 12000 : toast.status === "SUCCESS" ? 7000 : 6000;
      const timer = setTimeout(() => {
        dismissToast(toast.id);
      }, durationMs);
      toastTimersRef.current.set(toast.id, timer);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("teacher-notification-updated", handleNotificationUpdated);
    window.addEventListener("teacher-notification-local", handleLocalNotification);
    window.addEventListener("teacher-task-toast", handleTaskToast);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      toastTimersRef.current.forEach((timer) => clearTimeout(timer));
      toastTimersRef.current.clear();
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("teacher-notification-updated", handleNotificationUpdated);
      window.removeEventListener("teacher-notification-local", handleLocalNotification);
      window.removeEventListener("teacher-task-toast", handleTaskToast);
    };
  }, []);

  const handleToggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async (e: ReactMouseEvent) => {
    e.stopPropagation();
    try {
      await axiosClient.put("/api/v1/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      try {
        await axiosClient.patch("/api/v1/notifications/read-all");
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      } catch {}
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    // 1. Đánh dấu đã đọc
    if (!n.isRead) {
      try {
        await axiosClient.put(`/api/v1/notifications/${n.id}/read`);
      } catch {
        try {
          await axiosClient.patch(`/api/v1/notifications/${n.id}/read`);
        } catch {}
      }
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    // 2. Đóng dropdown
    setIsOpen(false);

    // 3. Phân loại hành động
    const action = resolveNotificationAction(n);
    if (action.isModalAction) {
      setSelectedNotification(n);
      setIsModalOpen(true);
    } else if (action.targetUrl) {
      navigate(action.targetUrl);
    } else {
      setSelectedNotification(n);
      setIsModalOpen(true);
    }
  };

  const getActionIcon = (n: NotificationItem) => {
    const action = resolveNotificationAction(n);
    switch (action.actionType) {
      case "GRADED":
        return <GraduationCap size={15} className="text-emerald-500" />;
      case "AI_EVALUATION":
        return <Bot size={15} className="text-blue-600 dark:text-blue-400" />;
      case "NEW_ASSIGNMENT":
        return <FileCheck2 size={15} className="text-blue-500" />;
      case "NEW_LESSON":
        return <BookOpen size={15} className="text-emerald-600 dark:text-emerald-400" />;
      default:
        return <MessageSquare size={15} className="text-amber-500" />;
    }
  };

  return (
    <>
      <div className="relative" ref={bellRef}>
        <button
          type="button"
          onClick={handleToggleOpen}
          aria-label="Thông báo hệ thống"
          aria-expanded={isOpen}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-blue-50/60 dark:hover:bg-slate-800/70 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-slate-700 shadow-2xs transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 cursor-pointer"
          title="Thông báo hệ thống"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#070b14] animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl p-4 shadow-card shadow-slate-900/10 dark:shadow-black/50 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                  Thông Báo ({notifications.length})
                </h4>
                {unreadCount > 0 && (
                  <span className="bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Check size={12} /> Đánh dấu đã đọc
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 custom-scrollbar pr-0.5">
              {isLoading && notifications.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">
                  Đang tải thông báo...
                </p>
              ) : notifications.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">
                  Không có thông báo nào.
                </p>
              ) : (
                notifications.map((n) => {
                  const action = resolveNotificationAction(n);
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`group relative rounded-xl p-3 text-xs transition-all cursor-pointer border ${
                        n.isRead
                          ? "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700"
                          : "bg-blue-50/80 dark:bg-blue-600/15 border-blue-200/90 dark:border-blue-600/30 text-slate-900 dark:text-slate-100 hover:bg-blue-100/70 dark:hover:bg-blue-600/25 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase border ${action.badgeClass}`}
                            >
                              {action.badgeText}
                            </span>
                            <p
                              className={`font-bold text-xs truncate ${
                                n.isRead
                                  ? "text-slate-800 dark:text-slate-200"
                                  : "text-blue-950 dark:text-blue-200"
                              }`}
                            >
                              {n.title}
                            </p>
                          </div>

                          <p className="line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            {n.message || n.content}
                          </p>
                        </div>

                        {/* Action Icon on the right */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs group-hover:border-blue-400 dark:group-hover:border-blue-500 group-hover:scale-105 transition-all">
                            {getActionIcon(n)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating non-blocking teacher task toast notifications */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed top-20 right-4 z-[100] flex flex-col gap-2.5 w-80 sm:w-96 pointer-events-none"
        >
          {toasts.map((toast) => {
            const isError = toast.status === "ERROR";
            const isSuccess = toast.status === "SUCCESS";
            const containerClass = isError
              ? "border-rose-300 dark:border-rose-800 bg-rose-50/95 dark:bg-rose-950/95 text-rose-950 dark:text-rose-100"
              : isSuccess
              ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/95 dark:bg-emerald-950/95 text-emerald-950 dark:text-emerald-100"
              : "border-blue-300 dark:border-blue-800 bg-blue-50/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100";

            return (
              <div
                key={toast.id}
                role="status"
                className={`pointer-events-auto rounded-xl border p-3.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-right-4 ${containerClass}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-0.5">
                    {isError ? (
                      <AlertCircle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Loader2 className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 animate-spin" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold leading-snug">
                      {toast.title}
                    </p>
                    <p className="text-[11px] opacity-90 mt-1 leading-relaxed">
                      {toast.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    aria-label="Đóng thông báo"
                    className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal chi tiết thông báo */}
      <NotificationDetailModal
        notification={selectedNotification}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedNotification(null);
        }}
      />
    </>
  );
}

export default NotificationBell;

