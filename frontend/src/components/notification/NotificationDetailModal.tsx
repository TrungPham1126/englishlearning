// src/components/notification/NotificationDetailModal.tsx
import { Modal } from "@/components/ui/Modal";
import type { NotificationItem } from "@/types/notification";
import {
  resolveNotificationAction,
  type ResolvedNotificationAction,
} from "@/utils/notificationAction";
import {
  GraduationCap,
  Bot,
  Bell,
  ArrowRight,
  Clock,
  Calendar,
  BookOpen,
  MessageSquare,
  FileCheck2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NotificationDetailModalProps {
  notification: NotificationItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDetailModal({
  notification,
  isOpen,
  onClose,
}: NotificationDetailModalProps) {
  const navigate = useNavigate();

  if (!notification) return null;

  const action: ResolvedNotificationAction =
    resolveNotificationAction(notification);

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleActionClick = () => {
    onClose();
    if (action.targetUrl) {
      navigate(action.targetUrl);
    }
  };

  const getHeaderIcon = () => {
    switch (action.actionType) {
      case "GRADED":
        return <GraduationCap size={22} className="text-emerald-500" />;
      case "AI_EVALUATION":
        return <Bot size={22} className="text-blue-600 dark:text-blue-400" />;
      case "NEW_ASSIGNMENT":
        return <FileCheck2 size={22} className="text-blue-500" />;
      case "NEW_LESSON":
        return <BookOpen size={22} className="text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Bell size={22} className="text-amber-500" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className="p-0 overflow-hidden"
    >
      <div className="p-6 space-y-5">
        {/* Top Header Badge & Timestamp */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider border ${action.badgeClass}`}
            >
              {action.badgeText}
            </span>
            {notification.classroomId && (
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                • Lớp học
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {notification.createdAt && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
                <Clock size={13} />
                <span>{formatDateTime(notification.createdAt)}</span>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Đóng"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Title Area */}
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
            {getHeaderIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
              {notification.title}
            </h3>
          </div>
        </div>

        {/* ================= NỘI DUNG THEO TỪNG LOẠI ================= */}

        {/* 1. GRADED (Giáo viên chấm bài) */}
        {action.actionType === "GRADED" && (
          <div className="space-y-4">
            {/* Box Điểm cỡ lớn */}
            {action.score && (
              <div className="flex items-center justify-between rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 p-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Điểm số bài làm
                  </span>
                  <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                    {action.score.includes("/") ? action.score : `${action.score}/10`}
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <GraduationCap size={26} />
                </div>
              </div>
            )}

            {/* Nhận xét của giáo viên */}
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <MessageSquare size={14} className="text-blue-700 dark:text-blue-400" />
                Nhận xét từ giáo viên:
              </span>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 text-sm md:text-base leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200 max-h-60 overflow-y-auto custom-scrollbar">
                {action.feedback || action.fullMessage}
              </div>
            </div>
          </div>
        )}

        {/* 2. AI_EVALUATION (Kết quả chấm AI) */}
        {action.actionType === "AI_EVALUATION" && (
          <div className="space-y-4">
            {action.score && (
              <div className="flex items-center justify-between rounded-xl bg-blue-50/70 dark:bg-slate-900/80 border border-blue-200 dark:border-blue-900/60 p-4 shadow-xs">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    Đánh giá từ AI
                  </span>
                  <div className="text-3xl font-black text-blue-800 dark:text-blue-400 tracking-tight mt-0.5">
                    {action.score}
                  </div>
                </div>
                {action.cefr && (
                  <span className="rounded-md bg-blue-100 dark:bg-blue-600/20 px-3 py-1 text-xs font-extrabold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-600/30">
                    CEFR {action.cefr}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Chi tiết đánh giá:
              </span>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 text-sm md:text-base leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200 max-h-60 overflow-y-auto custom-scrollbar">
                {action.fullMessage}
              </div>
            </div>
          </div>
        )}

        {/* 3. NEW_ASSIGNMENT (Giao bài tập mới) */}
        {action.actionType === "NEW_ASSIGNMENT" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/30 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {action.fullMessage}
            </div>
          </div>
        )}

        {/* 4. TEXT_ANNOUNCEMENT (Thông báo chữ toàn màn hình) */}
        {action.actionType === "TEXT_ANNOUNCEMENT" && (
          <div className="space-y-2">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-base md:text-lg leading-relaxed whitespace-pre-wrap text-slate-900 dark:text-slate-100 max-h-72 overflow-y-auto custom-scrollbar shadow-inner">
              {action.fullMessage}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Đóng
          </button>

          {action.targetUrl && (
            <button
              type="button"
              onClick={handleActionClick}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer"
            >
              <span>{action.buttonLabel || "Xem chi tiết"}</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
