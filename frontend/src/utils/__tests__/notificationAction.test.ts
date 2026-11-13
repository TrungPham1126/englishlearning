import { describe, it, expect } from "vitest";
import { resolveNotificationAction } from "@/utils/notificationAction";
import type { NotificationItem } from "@/types/notification";

const baseItem = (overrides: Partial<NotificationItem>): NotificationItem => ({
  id: "n-1",
  title: "Thông báo",
  isRead: false,
  ...overrides,
});

describe("utils/notificationAction - resolveNotificationAction()", () => {
  it("xử lý GRADED / NEW_GRADE và trích xuất điểm + nhận xét chính xác", () => {
    const res = resolveNotificationAction(
      baseItem({
        actionType: "NEW_GRADE",
        referenceId: "assign-99",
        title: "Bài tập Essay đã chấm điểm",
        message: "Điểm 8.5/10. Nhận xét: Lập luận mạch lạc, cần chú ý thì quá khứ.",
      }),
    );

    expect(res.actionType).toBe("GRADED");
    expect(res.score).toBe("8.5/10");
    expect(res.feedback).toBe("Lập luận mạch lạc, cần chú ý thì quá khứ.");
    expect(res.targetUrl).toBe("/student/assignments/assign-99/take");
    expect(res.isModalAction).toBe(true);
    expect(res.badgeText).toBe("ĐÃ CHẤM ĐIỂM");
  });

  it("xử lý GRADED theo từ khóa khi không có referenceId và targetUrl", () => {
    const res = resolveNotificationAction(
      baseItem({
        title: "Kết quả chấm bài kiểm tra",
        content: "Điểm 9",
      }),
    );

    expect(res.actionType).toBe("GRADED");
    expect(res.score).toBe("9");
    expect(res.feedback).toBeNull();
    expect(res.targetUrl).toBe("/student/courses");
  });

  it("xử lý AI_EVALUATION và trích xuất Band / điểm + trình độ CEFR", () => {
    const byBand = resolveNotificationAction(
      baseItem({
        actionType: "AI_EVALUATION",
        title: "AI Speaking hoàn tất",
        message: "Ước lượng Band 7.5, trình độ CEFR C1.",
      }),
    );
    expect(byBand.actionType).toBe("AI_EVALUATION");
    expect(byBand.score).toBe("Band 7.5");
    expect(byBand.cefr).toBe("C1");
    expect(byBand.targetUrl).toBe("/student/submissions");
    expect(byBand.isModalAction).toBe(true);

    const byScoreAndKeyword = resolveNotificationAction(
      baseItem({
        title: "Luyện tập Shadowing",
        message: "AI đã chấm: Điểm 86/100 CEFR B2",
        targetUrl: "/student/speaking-ai",
      }),
    );
    expect(byScoreAndKeyword.actionType).toBe("AI_EVALUATION");
    expect(byScoreAndKeyword.score).toBe("86/100");
    expect(byScoreAndKeyword.cefr).toBe("B2");
    expect(byScoreAndKeyword.targetUrl).toBe("/student/submissions".replace("/submissions", "/speaking-ai"));
  });

  it("xử lý NEW_ASSIGNMENT (điều hướng trực tiếp không qua modal)", () => {
    const withRef = resolveNotificationAction(
      baseItem({
        title: "Bài tập mới tuần 3",
        referenceId: 42,
      }),
    );
    expect(withRef.actionType).toBe("NEW_ASSIGNMENT");
    expect(withRef.isModalAction).toBe(false);
    expect(withRef.targetUrl).toBe("/student/assignments/42/take");

    const withoutRef = resolveNotificationAction(
      baseItem({
        actionType: "NEW_ASSIGNMENT",
        title: "Lộ trình mới",
      }),
    );
    expect(withoutRef.targetUrl).toBe("/student/courses");
  });

  it("xử lý NEW_LESSON", () => {
    const res = resolveNotificationAction(
      baseItem({
        title: "Có video bài học mới",
        referenceId: "lesson-12",
      }),
    );
    expect(res.actionType).toBe("NEW_LESSON");
    expect(res.isModalAction).toBe(false);
    expect(res.targetUrl).toBe("/student/lessons/lesson-12");

    const noRef = resolveNotificationAction(baseItem({ actionType: "NEW_LESSON", title: "Lesson" }));
    expect(noRef.targetUrl).toBe("/student/courses");
  });

  it("xử lý SRS_REMINDER bao gồm cả từ khóa Spaced Repetition", () => {
    const res = resolveNotificationAction(
      baseItem({
        title: "Nhắc nhở ôn tập",
        message: "Đã đến lúc ôn tập từ vựng theo lịch spaced repetition.",
      }),
    );
    expect(res.actionType).toBe("SRS_REMINDER");
    expect(res.targetUrl).toBe("/student/vocabulary");
    expect(res.isModalAction).toBe(false);
  });

  it("xử lý SUBMISSION_RECEIVED điều hướng giảng viên tới trang chấm bài của lớp", () => {
    const withClass = resolveNotificationAction(
      baseItem({
        actionType: "SUBMISSION_RECEIVED",
        title: "Bài nộp mới",
        message: "Học sinh vừa nộp bài cần chấm điểm",
        classroomId: "cls-7",
      }),
    );
    expect(withClass.actionType).toBe("SUBMISSION_RECEIVED");
    expect(withClass.targetUrl).toBe("/teacher/classrooms/cls-7/grading");
    expect(withClass.isModalAction).toBe(false);

    const noClass = resolveNotificationAction(
      baseItem({
        title: "Có bài nộp cần chấm điểm",
      }),
    );
    expect(noClass.targetUrl).toBe("/teacher/classrooms");
  });

  it("mặc định TEXT_ANNOUNCEMENT phân biệt thông báo lớp học và hệ thống", () => {
    const classMsg = resolveNotificationAction(
      baseItem({
        title: "Lịch nghỉ lễ",
        message: "Lớp nghỉ thứ 6",
        classroomId: "cls-1",
      }),
    );
    expect(classMsg.actionType).toBe("TEXT_ANNOUNCEMENT");
    expect(classMsg.badgeText).toBe("LỚP HỌC");
    expect(classMsg.targetUrl).toBeNull();
    expect(classMsg.isModalAction).toBe(true);

    const sysMsg = resolveNotificationAction(
      baseItem({
        title: "Bảo trì server",
        content: "Bảo trì lúc 23h",
      }),
    );
    expect(sysMsg.badgeText).toBe("HỆ THỐNG");
  });
});
