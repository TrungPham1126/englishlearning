import axiosClient from "@/lib/axiosClient";
import { useAuthStore } from "@/store/useAuthStore";
import type { NotificationItem } from "@/types/notification";

export type TeacherTaskNotificationStatus = "PROCESSING" | "SUCCESS" | "ERROR";

export interface TeacherTaskNotificationPayload {
  status: TeacherTaskNotificationStatus;
  title: string;
  message: string;
  classroomId?: string | null;
  targetUrl?: string | null;
  referenceId?: string | null;
  taskKey?: string;
}

export interface TeacherTaskToastDetail {
  id: string;
  taskKey?: string;
  status: TeacherTaskNotificationStatus;
  title: string;
  message: string;
  targetUrl?: string | null;
  createdAt: string;
}

async function persistTeacherNotification(
  payload: TeacherTaskNotificationPayload,
  recipientUserId?: string | null,
): Promise<void> {
  if (typeof axiosClient?.post !== "function") return;

  const body = {
    title: payload.title,
    message: payload.message,
    content: payload.message,
    classroomId: payload.classroomId || null,
    notificationType: payload.status === "ERROR" ? "SYSTEM_ALERT" : "ANNOUNCEMENT",
    actionType: "TEXT_ANNOUNCEMENT",
    targetUrl: payload.targetUrl || null,
    referenceId: payload.referenceId || null,
  };

  try {
    await axiosClient.post("/api/v1/notifications/self", body);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teacher-notification-updated"));
    }
  } catch {
    if (recipientUserId) {
      try {
        await axiosClient.post("/api/v1/notifications/broadcast", {
          ...body,
          recipientUserId,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("teacher-notification-updated"));
        }
      } catch {
        // Bỏ qua lỗi mạng khi lưu thông báo cá nhân; đã hiển thị toast & bell cục bộ
      }
    }
  }
}

export function notifyTeacherTaskStatus(
  payload: TeacherTaskNotificationPayload,
): void {
  const nowIso = new Date().toISOString();
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (typeof window !== "undefined") {
    const toastDetail: TeacherTaskToastDetail = {
      id,
      taskKey: payload.taskKey,
      status: payload.status,
      title: payload.title,
      message: payload.message,
      targetUrl: payload.targetUrl || null,
      createdAt: nowIso,
    };
    window.dispatchEvent(
      new CustomEvent("teacher-task-toast", { detail: toastDetail }),
    );
  }

  if (payload.status === "SUCCESS" || payload.status === "ERROR") {
    const currentUser = useAuthStore.getState?.()?.user;
    if (typeof window !== "undefined") {
      const localItem: NotificationItem = {
        id,
        title: payload.title,
        message: payload.message,
        classroomId: payload.classroomId || null,
        type: payload.status === "ERROR" ? "SYSTEM_ALERT" : "ANNOUNCEMENT",
        actionType: "TEXT_ANNOUNCEMENT",
        targetUrl: payload.targetUrl || null,
        referenceId: payload.referenceId || null,
        recipientUserId: currentUser?.id || null,
        isRead: false,
        createdAt: nowIso,
      };
      window.dispatchEvent(
        new CustomEvent("teacher-notification-local", { detail: localItem }),
      );
    }

    void persistTeacherNotification(payload, currentUser?.id).catch(() => {});
  }
}
