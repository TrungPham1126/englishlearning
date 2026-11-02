// src/types/notification.ts

export type NotificationActionType =
  | "GRADED"
  | "NEW_ASSIGNMENT"
  | "AI_EVALUATION"
  | "NEW_LESSON"
  | "SRS_REMINDER"
  | "SUBMISSION_RECEIVED"
  | "TEXT_ANNOUNCEMENT";

export interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  content?: string;
  classroomId?: string | null;
  type?: string;
  notificationType?: string;
  actionType?: string;
  targetUrl?: string | null;
  referenceId?: string | number | null;
  recipientUserId?: string | null;
  isRead: boolean;
  createdAt?: string;
}
