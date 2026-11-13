import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axiosClient from "@/lib/axiosClient";
import { authApi } from "@/features/auth/api/authApi";
import { studentApi } from "@/features/student/api/studentApi";
import { teacherApi } from "@/features/teacher/api/teacherApi";
import { adminApi } from "@/features/admin/api/adminApi";
import VideoPlayer from "@/features/student/components/VideoPlayer";
import ExamTakePage from "@/features/student/pages/ExamTakePage";

describe("Frontend <-> Backend API Contract & Media Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("multipart FormData helpers send exact field names and query params expected by Spring Boot controllers", async () => {
    const postSpy = vi.spyOn(axiosClient, "post").mockResolvedValue({
      data: { data: { ok: true } },
    } as never);

    const samplePdf = new File(["pdf"], "slides.pdf", { type: "application/pdf" });
    const sampleMp4 = new File(["mp4"], "lecture.mp4", { type: "video/mp4" });
    const sampleMp3 = new File(["mp3"], "listening.mp3", { type: "audio/mpeg" });
    const sampleAudio = new Blob(["audio"], { type: "audio/webm" });

    await teacherApi.uploadLessonDocument("lesson-1", samplePdf);
    expect(postSpy).toHaveBeenLastCalledWith(
      "/api/curriculum/lessons/lesson-1/documents?fileType=PDF",
      expect.any(FormData),
      expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } }),
    );
    const docForm = postSpy.mock.calls.at(-1)?.[1] as FormData;
    expect(docForm.get("file")).toBeInstanceOf(File);

    await teacherApi.uploadLessonVideo("lesson-1", sampleMp4);
    expect(postSpy).toHaveBeenLastCalledWith(
      "/api/v1/videos?lessonId=lesson-1",
      expect.any(FormData),
      expect.any(Object),
    );
    const vidForm = postSpy.mock.calls.at(-1)?.[1] as FormData;
    expect(vidForm.get("file")).toBeInstanceOf(File);

    await teacherApi.uploadAudioFile(sampleMp3);
    expect(postSpy).toHaveBeenLastCalledWith(
      "/api/v1/teacher/assignments/upload-audio",
      expect.any(FormData),
      expect.any(Object),
    );
    const audioForm = postSpy.mock.calls.at(-1)?.[1] as FormData;
    expect(audioForm.get("file")).toBeInstanceOf(File);

    await studentApi.uploadSpeakingAudio("att-1", "q-1", sampleAudio);
    expect(postSpy).toHaveBeenLastCalledWith(
      "/api/v1/student/assignments/attempts/att-1/questions/q-1/audio",
      expect.any(FormData),
    );
    const subAudioForm = postSpy.mock.calls.at(-1)?.[1] as FormData;
    expect(subAudioForm.get("audio")).toBeInstanceOf(Blob);

    await studentApi.evaluateSpeakingAI("Describe your city", sampleAudio, "ans-1");
    expect(postSpy).toHaveBeenLastCalledWith(
      "/api/v1/ai/speaking/evaluate",
      expect.any(FormData),
    );
    const spForm = postSpy.mock.calls.at(-1)?.[1] as FormData;
    expect(spForm.get("topic")).toBe("Describe your city");
    expect(spForm.get("audio")).toBeInstanceOf(Blob);
    expect(spForm.get("studentAnswerId")).toBe("ans-1");

    await studentApi.evaluateShadowingAI(sampleAudio, "ans-2", "Hello world");
    expect(postSpy).toHaveBeenLastCalledWith(
      "/api/v1/ai/speaking/shadowing-evaluate",
      expect.any(FormData),
    );
    const shForm = postSpy.mock.calls.at(-1)?.[1] as FormData;
    expect(shForm.get("audio")).toBeInstanceOf(Blob);
    expect(shForm.get("studentAnswerId")).toBe("ans-2");
    expect(shForm.get("referenceSentence")).toBe("Hello world");

    await studentApi.evaluatePronunciationAI(sampleAudio, "Hello world");
    expect(postSpy).toHaveBeenLastCalledWith(
      "/api/v1/ai/pronunciation/whisper-evaluate",
      expect.any(FormData),
    );
    const whForm = postSpy.mock.calls.at(-1)?.[1] as FormData;
    expect(whForm.get("audio")).toBeInstanceOf(Blob);
    expect(whForm.get("referenceText")).toBe("Hello world");

    const resourceForm = new FormData();
    resourceForm.append("file", samplePdf);
    resourceForm.append("type", "DOC");
    await adminApi.uploadGlobalResource(resourceForm);
    expect(postSpy).toHaveBeenLastCalledWith(
      "/api/v1/admin/resources/upload",
      resourceForm,
      expect.any(Object),
    );
  });

  it("consume backend contract DTO fields cleanly (isHealthy, isAccurate, completed/isCompleted, hasVideo, documentsCount)", async () => {
    vi.spyOn(axiosClient, "get").mockImplementation(async (url: string) => {
      if (url === "/api/v1/admin/ai-monitoring/stats") {
        return {
          data: {
            data: {
              totalTokens: 1000,
              geminiStats: { engineName: "Gemini", isHealthy: true },
              groqStats: { engineName: "Groq", isHealthy: false },
            },
          },
        } as never;
      }
      if (url === "/api/v1/videos/vid-1/progress") {
        return {
          data: {
            data: {
              watchedSeconds: 90,
              completionPercentage: 90,
              completed: true,
              isCompleted: true,
            },
          },
        } as never;
      }
      if (url === "/api/curriculum/classes/cls-1/lessons") {
        return {
          data: {
            data: [
              {
                id: "l-1",
                title: "Unit 1",
                orderIndex: 1,
                hasVideo: true,
                documentsCount: 3,
                completed: false,
                isCompleted: false,
              },
            ],
          },
        } as never;
      }
      return { data: { data: null } } as never;
    });

    const stats = await adminApi.getAiUsageStats();
    expect(stats.geminiStats?.isHealthy).toBe(true);
    expect(stats.groqStats?.isHealthy).toBe(false);

    const watchProgress = await studentApi.getVideoProgress("vid-1");
    expect(watchProgress.completed).toBe(true);
    expect(watchProgress.isCompleted).toBe(true);

    const lessons = await studentApi.getClassLessons("cls-1");
    expect(lessons[0].hasVideo).toBe(true);
    expect(lessons[0].documentsCount).toBe(3);

    vi.spyOn(axiosClient, "post").mockResolvedValueOnce({
      data: {
        data: {
          overallScore: 89,
          feedback: "Good",
          wordScores: [{ word: "english", score: 92, isAccurate: true }],
        },
      },
    } as never);

    const pronunciation = await studentApi.evaluatePronunciationAI(new Blob(["a"]), "english");
    expect(pronunciation.wordScores?.[0]?.isAccurate).toBe(true);
  });

  it("auth, admin, and teacher API wrappers hit matching Spring Boot paths and HTTP verbs", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: { data: [] } } as never);
    const postSpy = vi.spyOn(axiosClient, "post").mockResolvedValue({ data: { data: {} } } as never);
    const putSpy = vi.spyOn(axiosClient, "put").mockResolvedValue({ data: { data: {} } } as never);
    const patchSpy = vi.spyOn(axiosClient, "patch").mockResolvedValue({ data: { data: {} } } as never);
    const deleteSpy = vi.spyOn(axiosClient, "delete").mockResolvedValue({ data: { data: null } } as never);

    await authApi.getCurrentUser();
    expect(getSpy).toHaveBeenCalledWith("/api/v1/auth/me");

    await adminApi.updateUserAiQuota("stu-1", 50, false);
    expect(putSpy).toHaveBeenCalledWith("/api/v1/admin/ai-monitoring/quotas/stu-1", {
      dailyLimit: 50,
      isBlocked: false,
    });

    await adminApi.toggleAiKillSwitch();
    expect(postSpy).toHaveBeenCalledWith("/api/v1/admin/ai-monitoring/kill-switch/toggle");

    await adminApi.reviewVideo("vid-1", true);
    expect(patchSpy).toHaveBeenCalledWith(
      "/api/v1/videos/vid-1/review?approved=true&reason=",
    );

    await teacherApi.deletePlanItem("item-1");
    expect(deleteSpy).toHaveBeenCalledWith("/api/v1/curriculum/daily-plans/items/item-1");
  });

  it("VideoPlayer serves normalized .m3u8 first and falls back to /api/v1/videos/{id}/raw on playback error", () => {
    const { container } = render(
      <VideoPlayer
        videoId="vid-123"
        streamUrl="http://localhost:8080/api/v1/videos/vid-123/hls/master.m3u8"
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe("/api/v1/videos/vid-123/hls/master.m3u8");

    fireEvent.error(video!);
    expect(video?.getAttribute("src")).toBe("/api/v1/videos/vid-123/raw");
  });

  it("ExamTakePage resolves relative media URLs cleanly without hardcoding http://localhost:8080 when VITE_API_BASE_URL is empty", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const gradedAttempt = {
      attemptId: "att-1",
      assignmentId: "exam-1",
      assignmentTitle: "Midterm Listening",
      status: "GRADED",
      totalScore: 8,
      maxScore: 10,
      questions: [
        {
          questionId: "q-1",
          orderIndex: 1,
          questionType: "AUDIO_RESPONSE",
          promptText: "Record your answer",
          audioUrl: "/uploads/audio/part1.mp3",
          studentAnswer: "My spoken response",
          isCorrect: true,
        },
      ],
    };

    vi.spyOn(studentApi, "getMyAttempts").mockResolvedValue([gradedAttempt as never]);
    vi.spyOn(studentApi, "getAttemptDetail").mockResolvedValue(gradedAttempt as never);

    const { container } = render(
      <MemoryRouter initialEntries={["/student/exams/exam-1"]}>
        <Routes>
          <Route path="/student/exams/:assignmentId" element={<ExamTakePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText(/Midterm Listening/i);
    await waitFor(() => {
      const audioEl = container.querySelector("audio");
      expect(audioEl).not.toBeNull();
      expect(audioEl?.getAttribute("src")).toBe("/uploads/audio/part1.mp3");
      expect(audioEl?.getAttribute("src")).not.toContain("localhost:8080");
    });
  });
});
