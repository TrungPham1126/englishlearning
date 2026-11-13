import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VideoPlayer, { normalizeStreamUrl } from "../components/VideoPlayer";
import {
  PasswordChangeForm,
  SkillCompetencyCard,
} from "../components/profile";
import StudentProfilePage from "../pages/StudentProfilePage";
import LessonDetailPage from "../pages/LessonDetailPage";
import StudentCoursesPage from "../pages/StudentCoursesPage";
import ClassLessonsPage from "../pages/ClassLessonsPage";
import ClassAssignmentsPage from "../pages/ClassAssignmentsPage";
import DailyHomeworkPage from "../pages/DailyHomeworkPage";
import ExamTakePage from "../pages/ExamTakePage";
import { studentApi } from "../api/studentApi";
import { axiosClient } from "@/lib/axiosClient";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  AttemptResponse,
  DailyHomeworkOverviewResponse,
  LessonDetailResponse,
  MyCourseResponse,
  StudentSkillProfile,
} from "../types";

vi.mock("../api/studentApi", () => ({
  studentApi: {
    getMyCourses: vi.fn(),
    getClassLessons: vi.fn(),
    getLessonDetail: vi.fn(),
    getVideoByLesson: vi.fn(),
    getVideoProgress: vi.fn(),
    updateVideoProgress: vi.fn(),
    getClassAssignments: vi.fn(),
    getDailyHomeworkOverview: vi.fn(),
    getSkillProfile: vi.fn(),
    updateProfile: vi.fn(),
    updateAvatar: vi.fn(),
    getMyAttempts: vi.fn(),
    getAttemptDetail: vi.fn(),
    startAssignment: vi.fn(),
    submitAssignment: vi.fn(),
    recordExamViolation: vi.fn(),
    uploadSpeakingAudio: vi.fn(),
  },
}));

vi.mock("@/lib/axiosClient", () => ({
  axiosClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  stop = vi.fn(() => {
    this.state = "inactive";
    this.onstop?.();
  });
  start = vi.fn(() => {
    this.state = "recording";
  });

  constructor(_stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }
}

describe("features/student — VideoPlayer, Profile & Student Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeMediaRecorder.instances = [];

    useAuthStore.setState({
      accessToken: "token-student-1",
      user: {
        id: "stu-1",
        email: "minh@example.com",
        firstName: "Minh",
        lastName: "Nguyễn",
        phone: "0909123456",
        currentLevel: "B1",
        targetCefr: "B2 (IELTS 6.0+)",
        roles: ["ROLE_STUDENT"],
      },
    });

    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      writable: true,
      value: FakeMediaRecorder,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe("VideoPlayer", () => {
    it("chuẩn hóa streamUrl, xử lý playback/speed/seek và dọn listener kéo scrubber khi unmount", async () => {
      expect(
        normalizeStreamUrl("http://localhost:8080/api/videos/v1/index.m3u8"),
      ).toBe("/api/videos/v1/index.m3u8");
      expect(normalizeStreamUrl("")).toBe("");

      vi.mocked(studentApi.updateVideoProgress).mockResolvedValue(undefined);
      const addSpy = vi.spyOn(window, "addEventListener");
      const removeSpy = vi.spyOn(window, "removeEventListener");

      const { container, rerender, unmount } = render(
        <VideoPlayer
          videoId="vid-1"
          streamUrl="http://localhost:8080/streams/v1.m3u8"
          initialSeconds={15}
        />,
      );

      const videoEl = container.querySelector("video") as HTMLVideoElement;
      expect(videoEl).toBeTruthy();
      expect(videoEl.getAttribute("src")).toBe("/streams/v1.m3u8");

      Object.defineProperty(videoEl, "duration", {
        configurable: true,
        value: 120,
      });
      fireEvent.loadedMetadata(videoEl);
      expect(videoEl.currentTime).toBe(15);

      // Play & pause controls
      fireEvent.click(screen.getByLabelText("Phát"));
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
      fireEvent.playing(videoEl);
      expect(screen.getByLabelText("Tạm dừng")).toBeInTheDocument();

      // Skip +10s / Mute / Speed menu
      fireEvent.click(screen.getByLabelText("Tiến 10 giây"));
      expect(videoEl.currentTime).toBe(25);
      fireEvent.click(screen.getByLabelText("Tắt âm thanh"));
      expect(screen.getByLabelText("Bật âm thanh")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Tốc độ phát"));
      fireEvent.click(screen.getByText("1.5x"));
      expect(videoEl.playbackRate).toBe(1.5);

      // Scrubber drag unmount cleanup check
      const scrubber = container.querySelector(
        ".cursor-pointer.select-none",
      ) as HTMLElement;
      fireEvent.mouseDown(scrubber, { clientX: 50 });

      const mouseMoveHandler = addSpy.mock.calls.find(
        ([evt]) => evt === "mousemove",
      )?.[1];
      const mouseUpHandler = addSpy.mock.calls.find(
        ([evt]) => evt === "mouseup",
      )?.[1];
      expect(mouseMoveHandler).toBeDefined();
      expect(mouseUpHandler).toBeDefined();

      // Test ended -> dispatches progress event
      const progressEventSpy = vi.fn();
      window.addEventListener("student-progress-updated", progressEventSpy);
      fireEvent.ended(videoEl);
      await waitFor(() => {
        expect(studentApi.updateVideoProgress).toHaveBeenCalledWith(
          "vid-1",
          120,
          true,
        );
      });
      expect(progressEventSpy).toHaveBeenCalled();
      window.removeEventListener("student-progress-updated", progressEventSpy);

      // Switching videoId resets completed & currentTime UI
      rerender(
        <VideoPlayer
          videoId="vid-2"
          streamUrl="http://localhost:8080/streams/v2.m3u8"
          initialSeconds={0}
        />,
      );
      expect(screen.queryByText("Hoàn thành")).not.toBeInTheDocument();

      // Unmount cleans active window drag listeners
      unmount();
      expect(removeSpy).toHaveBeenCalledWith("mousemove", mouseMoveHandler);
      expect(removeSpy).toHaveBeenCalledWith("mouseup", mouseUpHandler);
    });
  });

  describe("Profile Components & StudentProfilePage", () => {
    it("kiểm tra PasswordChangeForm validation và SkillCompetencyCard navigation", () => {
      render(
        <MemoryRouter>
          <PasswordChangeForm />
        </MemoryRouter>,
      );

      const inputs = document.querySelectorAll('input[type="password"]');
      fireEvent.change(inputs[0], { target: { value: "oldPass123" } });
      fireEvent.change(inputs[1], { target: { value: "short" } });
      fireEvent.change(inputs[2], { target: { value: "short" } });
      fireEvent.click(screen.getByRole("button", { name: /Cập nhật/i }));
      expect(window.alert).toHaveBeenCalledWith(
        "Mật khẩu mới phải có ít nhất 8 ký tự!",
      );

      fireEvent.change(inputs[1], { target: { value: "StrongPass1" } });
      fireEvent.change(inputs[2], { target: { value: "Mismatch1" } });
      fireEvent.click(screen.getByRole("button", { name: /Cập nhật/i }));
      expect(window.alert).toHaveBeenCalledWith(
        "Mật khẩu xác nhận không khớp!",
      );

      fireEvent.change(inputs[2], { target: { value: "StrongPass1" } });
      fireEvent.click(screen.getByRole("button", { name: /Cập nhật/i }));
      expect(window.alert).toHaveBeenCalledWith(
        "Đã cập nhật mật khẩu thành công!",
      );

      const onRefresh = vi.fn();
      const skillProfile: StudentSkillProfile = {
        listeningScore: 80,
        readingScore: 78,
        writingScore: 72,
        grammarScore: 75,
        vocabularyScore: 74,
        speakingScore: 77,
        aiRecommendedPath: "Tập trung Speaking Part 2",
      };

      render(
        <MemoryRouter>
          <SkillCompetencyCard
            profile={skillProfile}
            firstCourse={{ classId: "cls-1", className: "IELTS 6.5" }}
            isRefreshingSkills={false}
            onRefreshSkills={onRefresh}
          />
        </MemoryRouter>,
      );

      expect(screen.getByText("Tập trung Speaking Part 2")).toBeInTheDocument();
      expect(document.querySelector("svg")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /Lộ trình/i }));
      expect(mockNavigate).toHaveBeenCalledWith("/student/courses/cls-1/daily-plan");
    });

    it("tải dữ liệu StudentProfilePage, lưu hồ sơ, chuyển tab Thông báo và dọn timer khi unmount", async () => {
      const skillData: StudentSkillProfile = {
        listeningScore: 85,
        readingScore: 82,
        writingScore: 80,
        grammarScore: 81,
        vocabularyScore: 83,
        speakingScore: 84,
      };
      const courses: MyCourseResponse[] = [
        {
          classId: "cls-1",
          className: "IELTS Target 7.0",
          level: "B2",
          teacherName: "Cô Lan",
          status: "ACTIVE",
          enrolledAt: "2026-01-01",
          progressPercentage: 65,
        },
      ];

      vi.mocked(studentApi.getSkillProfile).mockResolvedValue(skillData);
      vi.mocked(studentApi.getMyCourses).mockResolvedValue(courses);
      vi.mocked(studentApi.updateProfile).mockResolvedValue({
        ...useAuthStore.getState().user!,
        phone: "0988777666",
      });
      vi.mocked(axiosClient.get).mockResolvedValue({
        data: {
          data: [
            {
              id: "noti-1",
              title: "Chấm bài nói",
              message: "Điểm Band 7.0",
              isRead: false,
            },
          ],
        },
      });
      vi.mocked(axiosClient.put).mockResolvedValue({ data: {} });

      const { unmount } = render(
        <MemoryRouter>
          <StudentProfilePage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("IELTS Target 7.0")).toBeInTheDocument();
      });

      const phoneInput = screen.getByPlaceholderText("Số điện thoại...");
      fireEvent.change(phoneInput, {
        target: { name: "phone", value: "0988777666" },
      });

      fireEvent.click(screen.getByRole("button", { name: /^Lưu$/i }));
      await waitFor(() => {
        expect(studentApi.updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({ phone: "0988777666" }),
        );
      });
      expect(screen.getByText("Đã lưu")).toBeInTheDocument();

      // Switch to Thông báo tab -> fetch & mark all read
      fireEvent.click(screen.getByRole("tab", { name: /Thông báo/i }));
      await waitFor(() => {
        expect(screen.getByText("Chấm bài nói")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: /Đọc tất cả/i }));
      await waitFor(() => {
        expect(axiosClient.put).toHaveBeenCalledWith(
          "/api/v1/notifications/read-all",
        );
      });

      // Switch to Lớp học & Mật khẩu tabs
      fireEvent.click(screen.getByRole("tab", { name: /Lớp học/i }));
      expect(screen.getByText("65.0%")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: /Mật khẩu/i }));
      expect(screen.getByText("Đổi mật khẩu")).toBeInTheDocument();

      // Unmount safely while 4s save timer was scheduled
      unmount();
    });
  });

  describe("Student Feature Pages", () => {
    it("LessonDetailPage chỉ fetch đúng 1 lần sau khi video.id hydrate, đổi tab và đồng bộ progress", async () => {
      const lessonDetail: LessonDetailResponse = {
        id: "les-1",
        classId: "cls-1",
        title: "Lesson 1: Pronunciation Basics",
        objectives: "Nắm chắc nguyên âm đơn",
        orderIndex: 1,
        watchedSeconds: 20,
        documents: [
          {
            id: "doc-1",
            lessonId: "les-1",
            fileName: "Slide PDF",
            fileUrl: "/docs/slide.pdf",
            fileSizeBytes: 1024,
            fileType: "PDF",
          },
        ],
        vocabularies: [
          {
            id: "voc-1",
            word: "fluent",
            ipa: "ˈfluːənt",
            meaning: "trôi chảy",
          },
        ],
        grammarTopics: [
          {
            id: "gram-1",
            lessonId: "les-1",
            title: "Present Simple",
            ruleSummary: "Thói quen hàng ngày",
          },
        ],
      };

      vi.mocked(studentApi.getLessonDetail).mockResolvedValue(lessonDetail);
      vi.mocked(studentApi.getVideoByLesson).mockResolvedValue({
        id: "vid-1",
        title: "Intro Video",
        hlsPlaylistUrl: "/api/videos/vid-1/index.m3u8",
        durationSeconds: 180,
      });
      vi.mocked(studentApi.getClassLessons).mockResolvedValue([
        { id: "les-1", title: "Lesson 1: Pronunciation Basics", orderIndex: 1 },
      ]);
      vi.mocked(studentApi.getVideoProgress).mockResolvedValue({
        watchedSeconds: 45,
        completed: false,
      });

      render(
        <MemoryRouter initialEntries={["/student/lessons/les-1"]}>
          <Routes>
            <Route path="/student/lessons/:lessonId" element={<LessonDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Lesson 1: Pronunciation Basics" }),
        ).toBeInTheDocument();
      });

      // Ensure no duplicate fetch after video?.id updates
      expect(studentApi.getLessonDetail).toHaveBeenCalledTimes(1);
      expect(studentApi.getVideoByLesson).toHaveBeenCalledTimes(1);
      expect(studentApi.getVideoProgress).toHaveBeenCalledTimes(1);

      // Switch tabs
      fireEvent.click(screen.getByRole("button", { name: "Tài liệu (1)" }));
      expect(screen.getByText("Slide PDF")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Từ vựng (1)" }));
      expect(screen.getByText("fluent")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Ngữ pháp (1)" }));
      expect(screen.getByText("Present Simple")).toBeInTheDocument();

      // Switch back to overview and emit progress event
      fireEvent.click(screen.getByRole("button", { name: "Tổng quan" }));
      act(() => {
        window.dispatchEvent(
          new CustomEvent("student-progress-updated", {
            detail: { videoId: "vid-1", completed: true, watchedSeconds: 180 },
          }),
        );
      });
      expect(screen.getByText("Xong")).toBeInTheDocument();
      expect(studentApi.getLessonDetail).toHaveBeenCalledTimes(1);
    });

    it("StudentCoursesPage, ClassLessonsPage, ClassAssignmentsPage và DailyHomeworkPage xử lý render & điều hướng", async () => {
      // 1. StudentCoursesPage empty + populated
      vi.mocked(studentApi.getMyCourses).mockResolvedValueOnce([]);
      const coursesRender = render(
        <MemoryRouter>
          <StudentCoursesPage />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByText("Chưa có lớp học")).toBeInTheDocument();
      });
      coursesRender.unmount();

      vi.mocked(studentApi.getMyCourses).mockResolvedValueOnce([
        {
          classId: "cls-2",
          className: "IELTS Speaking Clinic",
          level: "B2",
          teacherName: "Thầy Nam",
          status: "ACTIVE",
          enrolledAt: "2026-01-01",
          progressPercentage: 40,
        },
      ]);
      render(
        <MemoryRouter>
          <StudentCoursesPage />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByText("IELTS Speaking Clinic")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: /Lộ trình/i }));
      expect(mockNavigate).toHaveBeenCalledWith("/student/courses/cls-2/daily-plan");

      // 2. ClassLessonsPage handles rejection cleanly
      vi.mocked(studentApi.getClassLessons).mockRejectedValueOnce(new Error("Network"));
      const lessonsView = render(
        <MemoryRouter initialEntries={["/student/courses/cls-2/lessons"]}>
          <Routes>
            <Route path="/student/courses/:classId/lessons" element={<ClassLessonsPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(studentApi.getClassLessons).toHaveBeenCalledWith("cls-2");
      });
      lessonsView.unmount();

      // 3. ClassAssignmentsPage expands pending category & routes exam
      vi.mocked(studentApi.getClassAssignments).mockResolvedValueOnce([
        {
          id: "asg-exam-1",
          title: "Midterm Proctored Test",
          assignmentType: "EXAM",
          skillType: "GRAMMAR",
          status: "PENDING",
          totalQuestions: 10,
        } as any,
      ]);
      render(
        <MemoryRouter initialEntries={["/student/courses/cls-2/assignments"]}>
          <Routes>
            <Route
              path="/student/courses/:classId/assignments"
              element={<ClassAssignmentsPage />}
            />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByText("Midterm Proctored Test")).toBeInTheDocument();
      });

      // 4. DailyHomeworkPage loads days and switches selected day
      const dayOverview1: DailyHomeworkOverviewResponse = {
        completionPercentage: 50,
        totalDays: 2,
        completedDays: 1,
        days: [
          {
            id: "day-1",
            dayNumber: 1,
            title: "Day 1",
            dateLabel: "13/11",
            scheduledDate: "2026-11-13",
            isUnlocked: true,
            isCompleted: true,
            isCurrentDay: false,
          },
          {
            id: "day-2",
            dayNumber: 2,
            title: "Day 2",
            dateLabel: "14/11",
            scheduledDate: "2026-11-14",
            isUnlocked: true,
            isCompleted: false,
            isCurrentDay: true,
          },
        ],
        currentSelectedDay: {
          id: "day-1",
          dayNumber: 1,
          title: "Day 1",
          fullHeaderLabel: "Day 1 - 13/11",
          scheduledDate: "2026-11-13",
          isCompleted: true,
          sections: [],
        },
      };
      vi.mocked(studentApi.getDailyHomeworkOverview).mockResolvedValue(dayOverview1);
      render(
        <MemoryRouter initialEntries={["/student/courses/cls-2/daily-plan"]}>
          <Routes>
            <Route path="/student/courses/:classId/daily-plan" element={<DailyHomeworkPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(studentApi.getDailyHomeworkOverview).toHaveBeenCalledWith(
          "cls-2",
          undefined,
        );
      });
      fireEvent.click(screen.getByTitle("Day 2"));
      await waitFor(() => {
        expect(studentApi.getDailyHomeworkOverview).toHaveBeenCalledWith(
          "cls-2",
          "day-2",
        );
      });
    });

    it("ExamTakePage dọn micro khi unmount giữa lúc ghi âm và tự động nộp khi hết giờ", async () => {
      const trackStop = vi.fn();
      const fakeStream = {
        getTracks: () => [{ stop: trackStop }],
      } as unknown as MediaStream;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: vi.fn().mockResolvedValue(fakeStream),
        },
      });

      const activeAttempt: AttemptResponse = {
        attemptId: "att-exam-1",
        assignmentId: "asg-exam-1",
        assignmentTitle: "Final Exam",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        timeLimitMinutes: 1,
        startedAt: new Date().toISOString(),
        strictFullscreen: false,
        maxViolations: 3,
        questions: [
          {
            questionId: "q-mcq",
            questionType: "MULTIPLE_CHOICE",
            skillType: "GRAMMAR",
            promptText: "Pick the correct verb.",
            maxPoints: 1,
            options: [
              { id: "opt-1", optionLabel: "A", optionText: "goes" },
              { id: "opt-2", optionLabel: "B", optionText: "go" },
            ],
          } as any,
          {
            questionId: "q-audio",
            questionType: "AUDIO_RESPONSE",
            skillType: "SPEAKING",
            promptText: "Introduce yourself.",
            maxPoints: 2,
          } as any,
        ],
      };

      vi.mocked(studentApi.getMyAttempts).mockResolvedValue([]);
      vi.mocked(studentApi.startAssignment).mockResolvedValue(activeAttempt);
      vi.mocked(studentApi.getAttemptDetail).mockResolvedValue(activeAttempt);

      const { unmount } = render(
        <MemoryRouter initialEntries={["/student/exams/asg-exam-1/take"]}>
          <Routes>
            <Route path="/student/exams/:assignmentId/take" element={<ExamTakePage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Bắt đầu thi/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Bắt đầu thi/i }));
      await waitFor(() => {
        expect(screen.getByText("Pick the correct verb.")).toBeInTheDocument();
      });

      // Answer MCQ & navigate to Audio question -> start recording -> unmount
      fireEvent.click(screen.getByRole("button", { name: /goes/i }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      await waitFor(() => {
        expect(screen.getByText("Introduce yourself.")).toBeInTheDocument();
      });

      fireEvent.click(
        document.querySelector("button.bg-emerald-600") as HTMLElement,
      );
      await waitFor(() => {
        expect(FakeMediaRecorder.instances.length).toBe(1);
      });

      unmount();
      expect(trackStop).toHaveBeenCalled();
      expect(studentApi.uploadSpeakingAudio).not.toHaveBeenCalled();

      // Cheating lockout view test
      vi.mocked(studentApi.getMyAttempts).mockResolvedValue([
        {
          attemptId: "att-cheat",
          assignmentId: "asg-exam-2",
          assignmentTitle: "Locked Exam",
          attemptNumber: 1,
          status: "COMPLETED",
          isCheatingFlagged: true,
          violationCount: 3,
          maxViolations: 3,
          cheatingReason: "Thoát toàn màn hình 3 lần",
        } as any,
      ]);
      vi.mocked(studentApi.getAttemptDetail).mockResolvedValue({
        attemptId: "att-cheat",
        assignmentId: "asg-exam-2",
        assignmentTitle: "Locked Exam",
        attemptNumber: 1,
        status: "COMPLETED",
        isCheatingFlagged: true,
        violationCount: 3,
        maxViolations: 3,
        cheatingReason: "Thoát toàn màn hình 3 lần",
        questions: [],
      } as any);

      render(
        <MemoryRouter initialEntries={["/student/exams/asg-exam-2/take"]}>
          <Routes>
            <Route path="/student/exams/:assignmentId/take" element={<ExamTakePage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Bài thi bị khóa do vi phạm \(3\/3\)/i),
        ).toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: /Thi lại/i })).not.toBeInTheDocument();
    });

    it("ExamTakePage tự động nộp bài đúng 1 lần khi đồng hồ đếm ngược về 0", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-13T08:00:00.000Z"));

      const expiringAttempt: AttemptResponse = {
        attemptId: "att-timeout-1",
        assignmentId: "asg-timeout-1",
        assignmentTitle: "Timed Exam",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        timeLimitMinutes: 1,
        // Elapsed 55s -> hydrateAttempt sets max(30, 60-55) = 30s
        startedAt: new Date("2026-11-13T07:59:05.000Z").toISOString(),
        strictFullscreen: false,
        questions: [
          {
            questionId: "q1",
            questionType: "ESSAY",
            promptText: "Write about technology.",
            maxPoints: 5,
          } as any,
        ],
      };

      const submittedAttempt: AttemptResponse = {
        ...expiringAttempt,
        status: "SUBMITTED",
        score: 8,
      };

      vi.mocked(studentApi.getMyAttempts).mockResolvedValue([]);
      vi.mocked(studentApi.startAssignment).mockResolvedValue(expiringAttempt);
      vi.mocked(studentApi.getAttemptDetail)
        .mockResolvedValueOnce(expiringAttempt)
        .mockResolvedValueOnce(submittedAttempt);
      vi.mocked(studentApi.submitAssignment).mockResolvedValue(submittedAttempt);

      render(
        <MemoryRouter initialEntries={["/student/exams/asg-timeout-1/take"]}>
          <Routes>
            <Route path="/student/exams/:assignmentId/take" element={<ExamTakePage />} />
          </Routes>
        </MemoryRouter>,
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.click(screen.getByRole("button", { name: /Bắt đầu thi/i }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText("Write about technology.")).toBeInTheDocument();

      // Advance 30s to hit 0 -> auto submit
      await act(async () => {
        vi.advanceTimersByTime(31000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(studentApi.submitAssignment).toHaveBeenCalledTimes(1);
    });
  });
});
