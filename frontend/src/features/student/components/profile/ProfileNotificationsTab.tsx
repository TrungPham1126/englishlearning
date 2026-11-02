import React from "react";
import { Bell, Check, Loader2, ExternalLink } from "lucide-react";

interface ProfileNotificationsTabProps {
  notifications: any[];
  notificationsLoading: boolean;
  unreadNotificationsCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string, targetUrl?: string) => void;
}

export const ProfileNotificationsTab: React.FC<ProfileNotificationsTabProps> = ({
  notifications,
  notificationsLoading,
  unreadNotificationsCount,
  onMarkAllRead,
  onMarkRead,
}) => {
  return (
    <div className="p-6 sm:p-8 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-blue-700 dark:text-blue-400" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            Thông Báo Đã Nhận
          </h3>
          {unreadNotificationsCount > 0 && (
            <span className="ml-1 rounded-md bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              {unreadNotificationsCount} chưa đọc
            </span>
          )}
        </div>
        {notifications.some((n) => !n.isRead) && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition cursor-pointer"
          >
            <Check size={14} />
            <span>Đánh dấu tất cả đã đọc</span>
          </button>
        )}
      </div>

      {notificationsLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 gap-2">
          <Loader2 size={24} className="animate-spin text-blue-700" />
          <p className="text-xs">Đang tải thông báo...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Bell size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs font-medium">
            Bạn chưa có thông báo nào.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => onMarkRead(item.id, item.targetUrl)}
              className={`group relative flex items-start gap-3.5 rounded-xl border p-4 transition-all cursor-pointer ${
                item.isRead
                  ? "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-85"
                  : "border-blue-200/80 dark:border-blue-900/50 bg-blue-50/50 dark:bg-slate-900/25 hover:bg-blue-50/80 dark:hover:bg-slate-900/40 shadow-2xs"
              }`}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                <Bell size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                        item.classroomId
                          ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                          : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {item.classroomId ? "[Lớp học]" : "[Thông báo chung]"}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </h4>
                  </div>
                  {item.createdAt && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                      {new Date(item.createdAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                  {item.message || item.content || "Không có nội dung chi tiết"}
                </p>
                {item.targetUrl && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400">
                    <span>Chi tiết liên kết</span>
                    <ExternalLink size={12} />
                  </div>
                )}
              </div>
              {!item.isRead && (
                <div className="shrink-0 flex items-center self-center pl-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-blue-800 dark:bg-blue-400"
                    title="Chưa đọc"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileNotificationsTab;
