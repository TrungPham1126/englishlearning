import { beforeEach, describe, expect, it, vi } from "vitest";
import { studentApi } from "@/features/student/api/studentApi";
import { axiosClient } from "@/lib/axiosClient";
import { useAuthStore } from "@/store/useAuthStore";
import type { UserSummaryDto } from "@/types/api";

vi.mock("@/lib/axiosClient", () => ({
  axiosClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const makeUser = (id: string): UserSummaryDto => ({
  id,
  email: `${id}@example.com`,
  firstName: "Student",
  lastName: id,
  roles: ["ROLE_STUDENT"],
});

describe("features/student/api/studentApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("phân tách cache getMyCourses theo userId để không rò rỉ dữ liệu khi đổi tài khoản", async () => {
    const coursesUser1 = [
      { classId: "cls-1", className: "IELTS 6.5", courseTitle: "IELTS Core" },
    ];
    const coursesUser2 = [
      { classId: "cls-2", className: "TOEIC 800", courseTitle: "TOEIC Pro" },
    ];

    vi.mocked(axiosClient.get)
      .mockResolvedValueOnce({ data: { data: coursesUser1 } })
      .mockResolvedValueOnce({ data: { data: coursesUser2 } });

    useAuthStore.setState({ user: makeUser("user-a") });
    const firstCall = await studentApi.getMyCourses();
    const cachedSecondCall = await studentApi.getMyCourses();

    expect(firstCall).toHaveLength(1);
    expect(firstCall[0].classId).toBe("cls-1");
    expect(cachedSecondCall[0].classId).toBe("cls-1");
    expect(axiosClient.get).toHaveBeenCalledTimes(1);

    // Đổi tài khoản trong vòng 60s TTL -> phải gọi API mới cho user-b
    useAuthStore.setState({ user: makeUser("user-b") });
    const user2Call = await studentApi.getMyCourses();
    expect(user2Call).toHaveLength(1);
    expect(user2Call[0].classId).toBe("cls-2");
    expect(axiosClient.get).toHaveBeenCalledTimes(2);
  });

  it("chuẩn hóa an toàn questions bị null/undefined trong getAttemptDetail", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({
      data: {
        data: {
          attemptId: "att-1",
          assignmentId: "asg-1",
          assignmentTitle: "Demo Quiz",
          attemptNumber: 1,
          status: "COMPLETED",
          questions: null,
        },
      },
    });

    const detail = await studentApi.getAttemptDetail("att-1");
    expect(detail.attemptId).toBe("att-1");
    expect(Array.isArray(detail.questions)).toBe(true);
    expect(detail.questions).toEqual([]);
  });

  it("chuẩn hóa mảng lồng nhau trong evaluateShadowingAI (sentenceTokens, wordRows, phonemes)", async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: {
        data: {
          overallScore: 86,
          sentenceTokens: null,
          wordRows: [
            {
              word: "hello",
              phonemes: undefined,
            },
            {
              word: "world",
              phonemes: null,
            },
          ],
        },
      },
    });

    const blob = new Blob(["audio-bytes"], { type: "audio/webm" });
    const result = await studentApi.evaluateShadowingAI(
      blob,
      "ans-1",
      "Hello world",
    );

    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(result.sentenceTokens).toEqual([]);
    expect(result.wordRows).toHaveLength(2);
    expect(result.wordRows[0].phonemes).toEqual([]);
    expect(result.wordRows[1].phonemes).toEqual([]);
  });

  it("chuẩn hóa mistakes và suggestions bị thiếu trong evaluateSpeakingAI", async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: {
        data: {
          overallBand: 7.0,
          mistakes: null,
          suggestions: undefined,
        },
      },
    });

    const file = new File(["audio"], "speak.webm", { type: "audio/webm" });
    const result = await studentApi.evaluateSpeakingAI(
      "Daily routine",
      file,
      "ans 99",
    );

    expect(result.mistakes).toEqual([]);
    expect(result.suggestions).toEqual([]);
  });

  it("chuẩn hóa cấu trúc days và currentSelectedDay.sections/items bị null trong getDailyHomeworkOverview", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({
      data: {
        data: {
          classId: "cls-1",
          className: "Foundation",
          days: null,
          currentSelectedDay: {
            id: "day-1",
            dayNumber: 1,
            title: "Day 1",
            sections: [
              {
                sectionKey: "SEC-1",
                sectionName: "Vocabulary",
                items: null,
              },
            ],
          },
        },
      },
    });

    const overview = await studentApi.getDailyHomeworkOverview("cls-1", "day 1");
    expect(axiosClient.get).toHaveBeenCalledWith(
      "/api/v1/curriculum/daily-plans/classrooms/cls-1/student-overview?selectedDayId=day%201",
    );
    expect(overview.days).toEqual([]);
    expect(overview.currentSelectedDay?.sections[0].items).toEqual([]);
  });

  it("chuẩn hóa dữ liệu chuỗi bài tập ngày trong getMyStreak", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({
      data: {
        data: {
          currentStreak: 4,
          lastActiveDate: "2026-11-18",
          hasHomeworkToday: false,
          completedToday: false,
          todayCompletedTasks: null,
          todayTotalTasks: undefined,
        },
      },
    });

    const streak = await studentApi.getMyStreak();
    expect(axiosClient.get).toHaveBeenCalledWith(
      "/api/v1/curriculum/daily-plans/my-streak",
    );
    expect(streak).toEqual({
      currentStreak: 4,
      lastActiveDate: "2026-11-18",
      hasHomeworkToday: false,
      completedToday: false,
      todayCompletedTasks: 0,
      todayTotalTasks: 0,
    });

    vi.mocked(axiosClient.get).mockResolvedValueOnce({
      data: {
        data: {
          currentStreak: -2,
          hasHomeworkToday: 1,
          completedToday: 0,
          todayCompletedTasks: -1,
          todayTotalTasks: 3,
        },
      },
    });

    const sanitized = await studentApi.getMyStreak();
    expect(sanitized.currentStreak).toBe(0);
    expect(sanitized.hasHomeworkToday).toBe(true);
    expect(sanitized.completedToday).toBe(false);
    expect(sanitized.todayCompletedTasks).toBe(0);
    expect(sanitized.todayTotalTasks).toBe(3);
  });

  it("chuẩn hóa documents, vocabularies và grammarTopics trong getLessonDetail", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({
      data: {
        data: {
          id: "les-1",
          classId: "cls-1",
          title: "Unit 1",
          documents: null,
          vocabularies: undefined,
          grammarTopics: null,
        },
      },
    });

    const lesson = await studentApi.getLessonDetail("les-1");
    expect(axiosClient.get).toHaveBeenCalledWith("/api/curriculum/lessons/les-1");
    expect(lesson.documents).toEqual([]);
    expect(lesson.vocabularies).toEqual([]);
    expect(lesson.grammarTopics).toEqual([]);
  });

  it("gửi text/plain cùng query params encode trong evaluateWritingAI và chuẩn hóa mảng lỗi/gợi ý", async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: {
        data: {
          overallBand: 7.5,
          mistakes: null,
          suggestions: undefined,
        },
      },
    });

    const result = await studentApi.evaluateWritingAI(
      "AI & Education",
      "Technology transforms learning.",
      "ans 01",
    );

    expect(axiosClient.post).toHaveBeenCalledWith(
      "/api/v1/ai/writing/evaluate?topic=AI%20%26%20Education&studentAnswerId=ans%2001",
      "Technology transforms learning.",
      { headers: { "Content-Type": "text/plain" } },
    );
    expect(result.mistakes).toEqual([]);
    expect(result.suggestions).toEqual([]);
  });

  it("gửi query param writingTask trong evaluateWritingAI khi có options.writingTask và bỏ qua khi không truyền", async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({
      data: {
        data: {
          overallBand: 6.5,
          writingTask: "TASK_1",
          mistakes: [],
          suggestions: [],
        },
      },
    });

    await studentApi.evaluateWritingAI(
      "Bar chart report",
      "The chart illustrates sales figures.",
      "sa-t1",
      { writingTask: "TASK_1" },
    );
    expect(axiosClient.post).toHaveBeenNthCalledWith(
      1,
      "/api/v1/ai/writing/evaluate?topic=Bar%20chart%20report&studentAnswerId=sa-t1&writingTask=TASK_1",
      "The chart illustrates sales figures.",
      { headers: { "Content-Type": "text/plain" } },
    );

    await studentApi.evaluateWritingAI(
      "Remote work essay",
      "Remote work offers clear benefits.",
      "sa-t2",
      { writingTask: "TASK_2" },
    );
    expect(axiosClient.post).toHaveBeenNthCalledWith(
      2,
      "/api/v1/ai/writing/evaluate?topic=Remote%20work%20essay&studentAnswerId=sa-t2&writingTask=TASK_2",
      "Remote work offers clear benefits.",
      { headers: { "Content-Type": "text/plain" } },
    );

    await studentApi.evaluateWritingAI(
      "My hobby paragraph",
      "Reading books helps me relax.",
      "sa-p",
      { writingTask: "PARAGRAPH" },
    );
    expect(axiosClient.post).toHaveBeenNthCalledWith(
      3,
      "/api/v1/ai/writing/evaluate?topic=My%20hobby%20paragraph&studentAnswerId=sa-p&writingTask=PARAGRAPH",
      "Reading books helps me relax.",
      { headers: { "Content-Type": "text/plain" } },
    );

    await studentApi.evaluateWritingAI(
      "Default essay",
      "Body text here.",
      "sa-default",
      { writingTask: undefined },
    );
    expect(axiosClient.post).toHaveBeenNthCalledWith(
      4,
      "/api/v1/ai/writing/evaluate?topic=Default%20essay&studentAnswerId=sa-default",
      "Body text here.",
      { headers: { "Content-Type": "text/plain" } },
    );
  });

  it("trả về mảng rỗng khi getKokoroVoices nhận dữ liệu không phải mảng", async () => {
    vi.mocked(axiosClient.get)
      .mockResolvedValueOnce({ data: { data: [{ id: "af_bella", name: "Bella" }] } })
      .mockResolvedValueOnce({ data: { data: { invalid: true } } });

    const voices = await studentApi.getKokoroVoices();
    expect(voices).toEqual([{ id: "af_bella", name: "Bella" }]);

    const fallback = await studentApi.getKokoroVoices();
    expect(fallback).toEqual([]);
  });

  it("khử trùng lặp thông báo trong getMyNotifications và fallback PUT -> PATCH khi đánh dấu đã đọc", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({
      data: {
        data: {
          content: [
            { id: "n1", title: "Bài tập mới", message: "Hạn nộp 20:00", isRead: false },
            { id: "n2", title: "Bài tập mới", content: "Hạn nộp 20:00", isRead: true, recipientUserId: "u1" },
          ],
        },
      },
    });

    const notifications = await studentApi.getMyNotifications(1, 20);
    expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/notifications?page=1&size=20");
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe("n2");
    expect(notifications[0].isRead).toBe(true);

    vi.mocked(axiosClient.put)
      .mockRejectedValueOnce(new Error("405"))
      .mockResolvedValueOnce({ data: {} });
    vi.mocked(axiosClient.patch).mockResolvedValueOnce({ data: {} });

    await studentApi.markNotificationAsRead("n2");
    expect(axiosClient.put).toHaveBeenCalledWith("/api/v1/notifications/n2/read");
    expect(axiosClient.patch).toHaveBeenCalledWith("/api/v1/notifications/n2/read");

    await studentApi.markAllNotificationsAsRead();
    expect(axiosClient.put).toHaveBeenCalledWith("/api/v1/notifications/read-all");
  });

  it("truyền speakingMode và keyPoints vào FormData của evaluateSpeakingAI và xử lý tên file wav/webm trong evaluateShadowingAI", async () => {
    vi.mocked(axiosClient.post)
      .mockResolvedValueOnce({
        data: {
          data: {
            overallBand: 6.5,
            speakingMode: "PART_2",
            mistakes: [],
            suggestions: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            overallScore: 91,
            sentenceTokens: [],
            wordRows: [],
          },
        },
      });

    const webmBlob = new Blob(["audio-webm"], { type: "audio/webm" });
    await studentApi.evaluateSpeakingAI(
      "Describe a book you read recently.",
      webmBlob,
      "sa-part2",
      {
        speakingMode: "PART_2",
        keyPoints: "  author, plot, why memorable  ",
      },
    );

    const [speakUrl, speakFormData] = vi.mocked(axiosClient.post).mock.calls[0];
    expect(speakUrl).toBe("/api/v1/ai/speaking/evaluate");
    const form = speakFormData as FormData;
    expect(form.get("topic")).toBe("Describe a book you read recently.");
    expect(form.get("studentAnswerId")).toBe("sa-part2");
    expect(form.get("speakingMode")).toBe("PART_2");
    expect(form.get("keyPoints")).toBe("author, plot, why memorable");

    const wavBlob = new Blob(["audio-wav"], { type: "audio/wav" });
    await studentApi.evaluateShadowingAI(wavBlob, "  sa-shad-1  ", "  Practice daily  ");

    const [shadUrl, shadFormData] = vi.mocked(axiosClient.post).mock.calls[1];
    expect(shadUrl).toBe("/api/v1/ai/speaking/shadowing-evaluate");
    const shadForm = shadFormData as FormData;
    expect(shadForm.get("studentAnswerId")).toBe("sa-shad-1");
    expect(shadForm.get("referenceSentence")).toBe("Practice daily");
    expect((shadForm.get("audio") as File).name).toBe("shadowing.wav");
  });
});
