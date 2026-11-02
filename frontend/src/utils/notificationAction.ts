// src/utils/notificationAction.ts
import type { NotificationItem, NotificationActionType } from "@/types/notification";

export interface ResolvedNotificationAction {
  actionType: NotificationActionType;
  targetUrl: string | null;
  referenceId?: string | number | null;
  score?: string | null;
  feedback?: string | null;
  cefr?: string | null;
  badgeText: string;
  badgeClass: string;
  isModalAction: boolean;
  buttonLabel?: string;
  fullMessage: string;
}

export function resolveNotificationAction(notification: NotificationItem): ResolvedNotificationAction {
  const rawTitle = (notification.title || "").trim();
  const rawMessage = (notification.message || notification.content || "").trim();
  const fullText = `${rawTitle} ${rawMessage}`;
  const rawAction = (notification.actionType || "").trim().toUpperCase();

  // 1. GRADED (Giáo viên chấm bài)
  if (
    rawAction === "GRADED" ||
    rawAction === "NEW_GRADE" ||
    /chấm\s*điểm|đã\s*chấm|kết\s*quả\s*chấm/i.test(fullText)
  ) {
    // Trích xuất điểm số (ví dụ: "Điểm 8.5/10" hoặc "Điểm 8.5")
    const scoreMatch = fullText.match(/Điểm\s*([0-9]+(?:[\.,][0-9]+)?(?:\s*\/\s*[0-9]+)?)/i);
    const score = scoreMatch ? scoreMatch[1].trim() : null;

    // Trích xuất nhận xét sau chữ "Nhận xét:"
    let feedback: string | null = null;
    const feedbackIdx = rawMessage.search(/Nhận xét\s*:\s*/i);
    if (feedbackIdx !== -1) {
      feedback = rawMessage.substring(feedbackIdx).replace(/^Nhận xét\s*:\s*/i, "").trim();
    }

    const targetUrl =
      notification.targetUrl ||
      (notification.referenceId
        ? `/student/assignments/${notification.referenceId}/take`
        : "/student/courses");

    return {
      actionType: "GRADED",
      targetUrl,
      referenceId: notification.referenceId,
      score,
      feedback,
      badgeText: "ĐÃ CHẤM ĐIỂM",
      badgeClass:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      isModalAction: true,
      buttonLabel: "Xem chi tiết bài làm",
      fullMessage: rawMessage,
    };
  }

  // 2. AI_EVALUATION (AI Speaking / Writing / Shadowing)
  if (
    rawAction === "AI_EVALUATION" ||
    /AI\s*(Speaking|Writing|Evaluation)|Shadowing|đánh\s*giá\s*AI|AI\s*đã\s*chấm/i.test(fullText)
  ) {
    // Trích xuất Band hoặc Điểm
    const bandMatch = fullText.match(/Band\s*([0-9]+(?:[\.,][0-9]+)?)/i);
    const scoreMatch = fullText.match(/Điểm\s*([0-9]+(?:[\.,][0-9]+)?(?:\s*\/\s*[0-9]+)?)/i);
    const score = bandMatch ? `Band ${bandMatch[1]}` : scoreMatch ? scoreMatch[1] : null;

    const cefrMatch = fullText.match(/CEFR\s*([A-C][1-2])/i);
    const cefr = cefrMatch ? cefrMatch[1] : null;

    const targetUrl = notification.targetUrl || "/student/submissions";

    return {
      actionType: "AI_EVALUATION",
      targetUrl,
      referenceId: notification.referenceId,
      score,
      cefr,
      badgeText: "KẾT QUẢ AI",
      badgeClass:
        "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      isModalAction: true,
      buttonLabel: "Mở phòng luyện AI",
      fullMessage: rawMessage,
    };
  }

  // 3. NEW_ASSIGNMENT (Giáo viên giao bài tập mới hoặc Lộ trình mới)
  if (
    rawAction === "NEW_ASSIGNMENT" ||
    /Bài tập mới|giao bài|lộ trình học mới|bài tập đã mở khóa/i.test(fullText)
  ) {
    const targetUrl =
      notification.targetUrl ||
      (notification.referenceId
        ? `/student/assignments/${notification.referenceId}/take`
        : "/student/courses");

    return {
      actionType: "NEW_ASSIGNMENT",
      targetUrl,
      referenceId: notification.referenceId,
      badgeText: "BÀI TẬP MỚI",
      badgeClass:
        "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      isModalAction: false, // Điều hướng trực tiếp tới trang làm bài
      buttonLabel: "Làm bài ngay",
      fullMessage: rawMessage,
    };
  }

  // 4. NEW_LESSON (Bài học mới / Tài liệu mới)
  if (
    rawAction === "NEW_LESSON" ||
    /Bài học mới|tài liệu mới|video bài học/i.test(fullText)
  ) {
    const targetUrl =
      notification.targetUrl ||
      (notification.referenceId
        ? `/student/lessons/${notification.referenceId}`
        : "/student/courses");

    return {
      actionType: "NEW_LESSON",
      targetUrl,
      referenceId: notification.referenceId,
      badgeText: "BÀI HỌC MỚI",
      badgeClass:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      isModalAction: false,
      buttonLabel: "Vào bài học",
      fullMessage: rawMessage,
    };
  }

  // 5. SRS_REMINDER (Nhắc ôn từ vựng SRS)
  if (
    rawAction === "SRS_REMINDER" ||
    /từ vựng|flashcard|ôn tập SRS|spced repetition/i.test(fullText)
  ) {
    return {
      actionType: "SRS_REMINDER",
      targetUrl: notification.targetUrl || "/student/vocabulary",
      referenceId: notification.referenceId,
      badgeText: "ÔN TẬP TỪ VỰNG",
      badgeClass:
        "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      isModalAction: false,
      buttonLabel: "Ôn từ vựng ngay",
      fullMessage: rawMessage,
    };
  }

  // 6. SUBMISSION_RECEIVED (Học sinh nộp bài, giáo viên cần chấm)
  if (
    rawAction === "SUBMISSION_RECEIVED" ||
    /Bài nộp mới|cần chấm điểm/i.test(fullText)
  ) {
    return {
      actionType: "SUBMISSION_RECEIVED",
      targetUrl: notification.targetUrl || "/teacher/grading",
      referenceId: notification.referenceId,
      badgeText: "BÀI NỘP MỚI",
      badgeClass:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
      isModalAction: false,
      buttonLabel: "Đến trang chấm bài",
      fullMessage: rawMessage,
    };
  }

  // 7. Mặc định: TEXT_ANNOUNCEMENT (Thông báo văn bản / Broadcast hệ thống)
  return {
    actionType: "TEXT_ANNOUNCEMENT",
    targetUrl: notification.targetUrl || null,
    referenceId: notification.referenceId,
    badgeText: notification.classroomId ? "LỚP HỌC" : "HỆ THỐNG",
    badgeClass: notification.classroomId
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
      : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    isModalAction: true,
    fullMessage: rawMessage,
  };
}
