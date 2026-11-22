import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { studentApi } from "@/features/student/api/studentApi";
import { useAssignmentTakeSession } from "@/features/student/hooks/useAssignmentTakeSession";
import { useExamProctoring } from "@/features/student/hooks/useExamProctoring";
import { useShadowingAudioEngine } from "@/features/student/hooks/useShadowingAudioEngine";
import { useShadowingShortcuts } from "@/features/student/hooks/useShadowingShortcuts";
import { useSpeakingAudioRecorder } from "@/features/student/hooks/useSpeakingAudioRecorder";
import { useSpeakingDailyPlans } from "@/features/student/hooks/useSpeakingDailyPlans";
import { useAudioStore } from "@/store/useAudioStore";
import { usePracticeStore } from "@/store/usePracticeStore";
import { stopAllSampleAudio } from "@/utils/sampleAudioPlayer";

vi.mock("@/features/student/api/studentApi", () => ({
  studentApi: {
    getMyAttempts: vi.fn(),
    getAttemptDetail: vi.fn(),
    startAssignment: vi.fn(),
    submitAssignment: vi.fn(),
    recordExamViolation: vi.fn(),
    evaluateShadowingAI: vi.fn(),
    repairQuestionAudio: vi.fn(),
    getMyCourses: vi.fn(),
    getClassDailyPlans: vi.fn(),
    getDailyHomeworkOverview: vi.fn(),
    getClassAssignments: vi.fn(),
    uploadSpeakingAudio: vi.fn(),
    evaluateSpeakingAI: vi.fn(),
    evaluateWritingAI: vi.fn(),
    checkInstantAnswer: vi.fn(),
    repairListeningAudio: vi.fn(),
    synthesizeTts: vi.fn(),
  },
}));

vi.mock("@/utils/sampleAudioPlayer", () => ({
  appendAudioCacheBuster: (url: string) => url,
  clearSampleAudioCache: vi.fn(),
  extractReferenceSentence: (q: { promptText?: string }) => q?.promptText || "",
  isGradingRubricOrMetaText: () => false,
  isInvalidSampleAudioUrl: () => false,
  isMockOrBrokenAudioUrl: () => false,
  playSampleAudio: vi.fn().mockResolvedValue(undefined),
  resolveFullAudioUrl: (url: string) => url,
  stopAllSampleAudio: vi.fn(),
}));

function installBrowserMediaMocks() {
  let trackStopSpy = vi.fn();
  const mockStream = {
    getTracks: () => [{ stop: trackStopSpy }],
  } as unknown as MediaStream;

  const getUserMediaSpy = vi.fn().mockResolvedValue(mockStream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getUserMediaSpy },
  });

  const audioCtxCloseSpy = vi.fn().mockResolvedValue(undefined);
  const analyserInstance = {
    fftSize: 256,
    smoothingTimeConstant: 0.76,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(128)),
  };
  class MockAudioContext {
    state = "running";
    close = audioCtxCloseSpy;
    createMediaStreamSource = vi.fn().mockReturnValue({ connect: vi.fn() });
    createAnalyser = vi.fn().mockReturnValue(analyserInstance);
  }
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: MockAudioContext,
  });

  const createdRecorders: MockMediaRecorder[] = [];
  class MockMediaRecorder {
    static isTypeSupported = vi.fn().mockReturnValue(true);
    state: "inactive" | "recording" | "paused" = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((e: BlobEvent) => void) | null = null;
    onstop: (() => void) | null = null;
    start = vi.fn(() => {
      this.state = "recording";
      this.ondataavailable?.({
        data: new Blob(["chunk"], { type: "audio/webm" }),
      } as BlobEvent);
    });
    stop = vi.fn(() => {
      this.state = "inactive";
      this.onstop?.();
    });
    constructor() {
      createdRecorders.push(this);
    }
  }
  Object.defineProperty(window, "MediaRecorder", {
    configurable: true,
    value: MockMediaRecorder,
  });
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: MockMediaRecorder,
  });

  let blobCounter = 0;
  const createObjectURLSpy = vi.fn(() => `blob:mock-url-${++blobCounter}`);
  const revokeObjectURLSpy = vi.fn();
  URL.createObjectURL = createObjectURLSpy;
  URL.revokeObjectURL = revokeObjectURLSpy;

  return {
    getUserMediaSpy,
    getTrackStopSpy: () => trackStopSpy,
    setTrackStopSpy: (spy: typeof trackStopSpy) => {
      trackStopSpy = spy;
    },
    audioCtxCloseSpy,
    createdRecorders,
    MockMediaRecorder,
    createObjectURLSpy,
    revokeObjectURLSpy,
  };
}

describe("features/student/hooks — Suite 1: useAssignmentTakeSession & useExamProctoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn(),
      },
    });
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:init");
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("useAssignmentTakeSession: tự động nộp bài khi hết giờ luôn giữ lại đáp án mới nhất (tránh stale closure)", async () => {
    vi.useFakeTimers();

    vi.mocked(studentApi.getMyAttempts).mockResolvedValue([
      {
        attemptId: "att-1",
        assignmentId: "asg-1",
        assignmentTitle: "Grammar Practice",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        isExam: false,
      },
    ]);

    vi.mocked(studentApi.getAttemptDetail).mockResolvedValue({
      attemptId: "att-1",
      assignmentId: "asg-1",
      assignmentTitle: "Grammar Practice",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      timeLimitMinutes: 1,
      isExam: false,
      questions: [
        {
          id: "sa-1",
          questionId: "q-1",
          promptText: "Fill in the blank",
          questionType: "FILL_IN_BLANK",
          maxPoints: 10,
        },
      ],
    });

    vi.mocked(studentApi.submitAssignment).mockResolvedValue({
      attemptId: "att-1",
      assignmentId: "asg-1",
      assignmentTitle: "Grammar Practice",
      attemptNumber: 1,
      status: "COMPLETED",
      score: 10,
      questions: [],
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/student/assignments/asg-1/take"]}>
        <Routes>
          <Route
            path="/student/assignments/:assignmentId/take"
            element={<>{children}</>}
          />
        </Routes>
      </MemoryRouter>
    );

    const { result, unmount } = renderHook(() => useAssignmentTakeSession(), {
      wrapper,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result.current.phase).toBe("TESTING");

    act(() => {
      result.current.updateAnswer("q-1", { textAnswer: "updated latest value" });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    // Flush setTimeout(..., 0) được xếp hàng trong phase commit khi remainingSeconds chạm 0
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result.current.remainingSeconds).toBe(0);
    expect(studentApi.submitAssignment).toHaveBeenCalledWith(
      "asg-1",
      "att-1",
      [
        {
          questionId: "q-1",
          selectedOptionId: undefined,
          textAnswer: "updated latest value",
          answerText: "updated latest value",
        },
      ],
    );

    unmount();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it("useExamProctoring: ghi nhận vi phạm qua blur, kích hoạt lockout khi chạm ngưỡng, và gỡ toàn bộ listener khi unmount", async () => {
    vi.useFakeTimers();

    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });

    const addDocSpy = vi.spyOn(document, "addEventListener");
    const removeDocSpy = vi.spyOn(document, "removeEventListener");
    const addWinSpy = vi.spyOn(window, "addEventListener");
    const removeWinSpy = vi.spyOn(window, "removeEventListener");

    vi.mocked(studentApi.recordExamViolation).mockResolvedValue({
      attemptId: "att-exam",
      assignmentId: "exam-1",
      assignmentTitle: "Midterm",
      attemptNumber: 1,
      status: "COMPLETED",
      violationCount: 3,
      maxViolations: 3,
      isCheatingFlagged: true,
    });

    const onCheatingLockout = vi.fn();
    const onAttemptSynced = vi.fn();
    const onGetCurrentAnswers = vi.fn(() => [
      { questionId: "q-9", textAnswer: "draft-answer" },
    ]);

    const { result, unmount } = renderHook(() =>
      useExamProctoring({
        attemptId: "att-exam",
        active: true,
        strictFullscreen: true,
        maxViolations: 3,
        initialViolationCount: 2,
        onGetCurrentAnswers,
        onCheatingLockout,
        onAttemptSynced,
      }),
    );

    await act(async () => {
      await result.current.enterFullscreen();
    });

    // Vượt qua grace period 1200ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Chặn copy / F12
    const copyEv = new Event("copy", { cancelable: true });
    document.dispatchEvent(copyEv);
    expect(copyEv.defaultPrevented).toBe(true);

    const f12Ev = new KeyboardEvent("keydown", { key: "F12", cancelable: true });
    window.dispatchEvent(f12Ev);
    expect(f12Ev.defaultPrevented).toBe(true);

    // Gây vi phạm rời cửa sổ -> chạm ngưỡng 3/3 -> tự động khóa bài
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
      await vi.runOnlyPendingTimersAsync();
    });

    expect(studentApi.recordExamViolation).toHaveBeenCalledWith("att-exam", {
      eventType: "WINDOW_BLUR",
      reason: "Rời khỏi cửa sổ trình duyệt trong khi làm bài thi.",
      currentAnswers: [{ questionId: "q-9", textAnswer: "draft-answer" }],
    });
    expect(onAttemptSynced).toHaveBeenCalledTimes(1);
    expect(onCheatingLockout).toHaveBeenCalledTimes(1);

    const addedDocTypes = addDocSpy.mock.calls.map((c) => c[0]);
    const addedWinTypes = addWinSpy.mock.calls.map((c) => c[0]);
    unmount();
    const removedDocTypes = removeDocSpy.mock.calls.map((c) => c[0]);
    const removedWinTypes = removeWinSpy.mock.calls.map((c) => c[0]);

    for (const type of ["fullscreenchange", "visibilitychange", "contextmenu", "copy", "cut", "paste"]) {
      expect(addedDocTypes).toContain(type);
      expect(removedDocTypes).toContain(type);
    }
    for (const type of ["blur", "keydown"]) {
      expect(addedWinTypes).toContain(type);
      expect(removedWinTypes).toContain(type);
    }
  });

  it("useExamProctoring: cảnh báo chuyển tab (TAB_SWITCH) và thoát toàn màn hình (FULLSCREEN_EXIT) khi chưa chạm ngưỡng khóa, kèm dismissWarningAndResume", async () => {
    vi.useFakeTimers();

    let fullscreenElementMock: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElementMock,
    });
    const requestFullscreen = vi.fn().mockImplementation(async () => {
      fullscreenElementMock = document.documentElement;
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });

    vi.mocked(studentApi.recordExamViolation)
      .mockResolvedValueOnce({
        attemptId: "att-exam-warn",
        assignmentId: "exam-1",
        assignmentTitle: "Midterm",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        violationCount: 1,
        maxViolations: 3,
        isCheatingFlagged: false,
      })
      .mockResolvedValueOnce({
        attemptId: "att-exam-warn",
        assignmentId: "exam-1",
        assignmentTitle: "Midterm",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        violationCount: 2,
        maxViolations: 3,
        isCheatingFlagged: false,
      });

    const onCheatingLockout = vi.fn();
    const { result, unmount } = renderHook(() =>
      useExamProctoring({
        attemptId: "att-exam-warn",
        active: true,
        strictFullscreen: true,
        maxViolations: 3,
        initialViolationCount: 0,
        onGetCurrentAnswers: () => [{ questionId: "q-1", textAnswer: "ans-1" }],
        onCheatingLockout,
      }),
    );

    await act(async () => {
      await result.current.enterFullscreen();
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // 1. Chuyển tab (visibilitychange với document.hidden = true) -> Strike 1/3 -> hiển thị warningModal
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.runOnlyPendingTimersAsync();
    });

    expect(studentApi.recordExamViolation).toHaveBeenCalledWith("att-exam-warn", {
      eventType: "TAB_SWITCH",
      reason: "Chuyển sang tab hoặc ứng dụng khác trong giờ thi.",
      currentAnswers: [{ questionId: "q-1", textAnswer: "ans-1" }],
    });
    expect(result.current.violationCount).toBe(1);
    expect(result.current.warningModal).toEqual({
      count: 1,
      max: 3,
      reason: "Chuyển sang tab hoặc ứng dụng khác trong giờ thi.",
    });
    expect(onCheatingLockout).not.toHaveBeenCalled();

    // Bấm đóng cảnh báo để quay lại toàn màn hình
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    await act(async () => {
      await result.current.dismissWarningAndResume();
    });
    expect(result.current.warningModal).toBeNull();

    // Chờ qua cooldown 1500ms rồi thoát fullscreen -> Strike 2/3 (FULLSCREEN_EXIT)
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    fullscreenElementMock = null;
    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
      await vi.runOnlyPendingTimersAsync();
    });

    expect(studentApi.recordExamViolation).toHaveBeenCalledWith("att-exam-warn", {
      eventType: "FULLSCREEN_EXIT",
      reason: "Thoát khỏi chế độ toàn màn hình khi đang làm bài thi.",
      currentAnswers: [{ questionId: "q-1", textAnswer: "ans-1" }],
    });
    expect(result.current.violationCount).toBe(2);
    expect(result.current.warningModal?.count).toBe(2);
    expect(onCheatingLockout).not.toHaveBeenCalled();

    unmount();
  });

  it("useAssignmentTakeSession: xử lý lỗi API khi nộp bài, chặn làm lại khi đã đạt hoặc hết lượt, và chuyển hướng nếu bài là EXAM", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    vi.mocked(studentApi.getMyAttempts).mockResolvedValue([
      {
        attemptId: "att-in-prog",
        assignmentId: "asg-err",
        assignmentTitle: "Vocabulary Drill",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        isExam: false,
      },
    ]);
    vi.mocked(studentApi.getAttemptDetail).mockResolvedValue({
      attemptId: "att-in-prog",
      assignmentId: "asg-err",
      assignmentTitle: "Vocabulary Drill",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      timeLimitMinutes: 15,
      isExam: false,
      questions: [
        {
          id: "sa-1",
          questionId: "q-1",
          promptText: "Meaning of 'Resilient'?",
          questionType: "FILL_IN_BLANK",
          correctAnswer: "kiên cường",
          maxPoints: 10,
        },
      ],
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/student/assignments/asg-err/take"]}>
        <Routes>
          <Route
            path="/student/assignments/:assignmentId/take"
            element={<>{children}</>}
          />
          <Route
            path="/student/exams/:assignmentId/take"
            element={<div>Exam Route</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    const { result, unmount } = renderHook(() => useAssignmentTakeSession(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("TESTING");
    });

    // 1. Kiểm tra đáp án tức thì (handleCheckInstantAnswer)
    act(() => {
      result.current.updateAnswer("q-1", { textAnswer: "Kiên cường" });
    });
    act(() => {
      result.current.handleCheckInstantAnswer("q-1");
    });
    expect(result.current.checkedQuestions["q-1"]?.isCorrect).toBe(true);
    expect(result.current.streakCount).toBe(1);

    // 2. Nộp bài gặp lỗi API -> hiển thị alert lỗi và giữ nguyên phase TESTING, isSubmitting=false
    vi.mocked(studentApi.submitAssignment).mockRejectedValueOnce({
      response: { data: { message: "Máy chủ chấm điểm đang bảo trì" } },
    });

    await act(async () => {
      await result.current.handleSubmitTest();
    });
    expect(alertSpy).toHaveBeenCalledWith("Máy chủ chấm điểm đang bảo trì");
    expect(result.current.phase).toBe("TESTING");
    expect(result.current.isSubmitting).toBe(false);

    // 3. Nộp bài thành công -> chuyển sang phase REVIEW
    vi.mocked(studentApi.submitAssignment).mockResolvedValueOnce({
      attemptId: "att-in-prog",
      assignmentId: "asg-err",
      assignmentTitle: "Vocabulary Drill",
      attemptNumber: 1,
      status: "COMPLETED",
      score: 9.0,
    });
    vi.mocked(studentApi.getAttemptDetail).mockResolvedValueOnce({
      attemptId: "att-in-prog",
      assignmentId: "asg-err",
      assignmentTitle: "Vocabulary Drill",
      attemptNumber: 1,
      status: "COMPLETED",
      score: 9.0,
      maxAttempts: 2,
      questions: [
        {
          id: "sa-1",
          questionId: "q-1",
          promptText: "Meaning of 'Resilient'?",
          questionType: "FILL_IN_BLANK",
          studentAnswer: "Kiên cường",
          isCorrect: true,
          earnedPoints: 10,
          maxPoints: 10,
        },
      ],
    });

    await act(async () => {
      await result.current.handleSubmitTest();
    });
    expect(result.current.phase).toBe("REVIEW");
    expect(result.current.reviewStats).toEqual({
      correctCount: 1,
      totalQuestions: 1,
    });
    expect(scrollToSpy).toHaveBeenCalled();

    unmount();
  });
});

describe("features/student/hooks — Suite 2: Shadowing & Speaking Hooks + Memory Cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAudioStore.getState().resetAudioSession();
    usePracticeStore.getState().resetPracticeState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("useShadowingShortcuts: kích hoạt Space/R/Escape khi focus hợp lệ và bỏ qua trong input/textarea/button", () => {
    const onToggleRecord = vi.fn();
    const onReplayNative = vi.fn();
    const onCloseDrawer = vi.fn();

    const { unmount } = renderHook(() =>
      useShadowingShortcuts({
        enabled: true,
        onToggleRecord,
        onReplayNative,
        onCloseDrawer,
      }),
    );

    const divTarget = document.createElement("div");
    document.body.appendChild(divTarget);

    const spaceEv = new KeyboardEvent("keydown", { code: "Space", cancelable: true, bubbles: true });
    divTarget.dispatchEvent(spaceEv);
    expect(onToggleRecord).toHaveBeenCalledTimes(1);
    expect(spaceEv.defaultPrevented).toBe(true);

    const rEv = new KeyboardEvent("keydown", { key: "R", cancelable: true, bubbles: true });
    divTarget.dispatchEvent(rEv);
    expect(onReplayNative).toHaveBeenCalledTimes(1);

    const inputEl = document.createElement("input");
    document.body.appendChild(inputEl);
    inputEl.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true }));
    expect(onToggleRecord).toHaveBeenCalledTimes(1);
    expect(onReplayNative).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onCloseDrawer).toHaveBeenCalledTimes(1);

    unmount();
    divTarget.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    expect(onToggleRecord).toHaveBeenCalledTimes(1);
  });

  it("useSpeakingAudioRecorder: dọn track micro, MediaRecorder, interval và thu hồi blob URL khi reset/unmount", async () => {
    const mocks = installBrowserMediaMocks();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useSpeakingAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);

    act(() => {
      result.current.stopRecording();
    });
    expect(result.current.isRecording).toBe(false);
    expect(result.current.activeAudioUrl).toBe("blob:mock-url-1");
    expect(mocks.getTrackStopSpy()).toHaveBeenCalled();

    // Upload file mới phải thu hồi URL cũ ("blob:mock-url-1")
    const fakeFile = new File(["audio"], "reply.webm", { type: "audio/webm" });
    act(() => {
      result.current.handleFileUpload({
        target: { files: [fakeFile] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    expect(mocks.revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url-1");
    expect(result.current.activeAudioUrl).toBe("blob:mock-url-2");

    // Unmount phải thu hồi "blob:mock-url-2" và stopAllSampleAudio
    unmount();
    expect(mocks.revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url-2");
    expect(stopAllSampleAudio).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();

    // Trường hợp MediaRecorder constructor lỗi sau getUserMedia -> vẫn phải dọn track micro
    const trackSpyOnError = vi.fn();
    mocks.setTrackStopSpy(trackSpyOnError);
    class BrokenMediaRecorder {
      static isTypeSupported = () => true;
      constructor() {
        throw new Error("Unsupported codec");
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: BrokenMediaRecorder,
    });
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: BrokenMediaRecorder,
    });

    const errHook = renderHook(() => useSpeakingAudioRecorder());
    await act(async () => {
      await errHook.result.current.startRecording();
    });
    expect(trackSpyOnError).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    errHook.unmount();
  });

  it("useShadowingAudioEngine: đóng AudioContext, hủy RAF, dọn track, thu hồi blob URL và thoát trạng thái evaluating khi API lỗi", async () => {
    const mocks = installBrowserMediaMocks();
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 101);
    const cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const onAudioSubmitted = vi.fn();

    const { result, unmount } = renderHook(() =>
      useShadowingAudioEngine({
        questionId: "q-shadow-1",
        studentAnswerId: "ans-shadow-1",
        targetSentence: "Practice makes progress",
        onAudioSubmitted,
      }),
    );

    vi.spyOn(Date, "now")
      .mockReturnValueOnce(10_000)
      .mockReturnValueOnce(12_500);

    await act(async () => {
      await result.current.startRecording();
    });

    expect(rafSpy).toHaveBeenCalled();
    expect(useAudioStore.getState().recordingState).toBe("recording");

    act(() => {
      result.current.stopRecording();
    });

    expect(onAudioSubmitted).toHaveBeenCalledTimes(1);
    expect(useAudioStore.getState().recordingDuration).toBeGreaterThanOrEqual(2);
    expect(mocks.audioCtxCloseSpy).toHaveBeenCalled();
    expect(mocks.getTrackStopSpy()).toHaveBeenCalled();
    expect(cancelRafSpy).toHaveBeenCalledWith(101);
    expect(useAudioStore.getState().recordedAudioUrl).toBe("blob:mock-url-1");

    // Khi evaluateShadowingAI thất bại -> không bị kẹt ở 'evaluating'
    vi.mocked(studentApi.evaluateShadowingAI).mockRejectedValueOnce({
      response: { data: { message: "Whisper offline" } },
    });

    await act(async () => {
      await result.current.triggerAiEvaluation();
    });
    expect(useAudioStore.getState().recordingState).toBe("error");
    expect(useAudioStore.getState().errorMessage).toBe("Whisper offline");

    // Reset + unmount thu hồi blob URL
    act(() => {
      result.current.resetRecording();
    });
    expect(mocks.revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url-1");
    unmount();
  });

  it("useSpeakingDailyPlans: gom bài Speaking, chọn attempt điểm cao nhất và chống race condition khi chuyển bài liên tiếp", async () => {
    vi.mocked(studentApi.getMyCourses).mockResolvedValue([
      {
        classId: "cls-1",
        className: "Speak Up",
        level: "B1",
        teacherName: "Cô Lan",
        status: "ACTIVE",
        enrolledAt: "2026-01-01",
        progressPercentage: 50,
      },
    ]);
    vi.mocked(studentApi.getClassDailyPlans).mockResolvedValue([
      {
        id: "day-1",
        dayNumber: 1,
        title: "DAY 1",
        items: [
          {
            itemType: "SPEAKING",
            sectionName: "Shadowing Practice",
            title: "Shadowing: Daily Greeting",
            assignmentId: "asg-speak-1",
          },
          {
            itemType: "SPEAKING",
            sectionName: "Speaking Q&A",
            title: "Interview Part 1",
            assignmentId: "asg-speak-2",
          },
        ],
      },
    ]);
    vi.mocked(studentApi.getDailyHomeworkOverview).mockResolvedValue({
      completionPercentage: 50,
      totalDays: 1,
      completedDays: 0,
      days: [],
      currentSelectedDay: null,
    });
    vi.mocked(studentApi.getClassAssignments).mockResolvedValue([
      {
        id: "asg-speak-1",
        title: "Shadowing: Daily Greeting",
        description: "",
        skillType: "SPEAKING",
        maxAttempts: 3,
        passScore: 5,
        attemptsCount: 2,
        highestScore: 8.5,
        status: "COMPLETED",
      },
    ]);

    vi.mocked(studentApi.getMyAttempts).mockImplementation(async (asgId: string) => {
      if (asgId === "asg-speak-1") {
        return [
          {
            attemptId: "att-old",
            assignmentId: "asg-speak-1",
            assignmentTitle: "Shadowing: Daily Greeting",
            attemptNumber: 1,
            status: "COMPLETED",
            score: 6.0,
          },
          {
            attemptId: "att-best",
            assignmentId: "asg-speak-1",
            assignmentTitle: "Shadowing: Daily Greeting",
            attemptNumber: 2,
            status: "COMPLETED",
            score: 8.5,
          },
        ];
      }
      return [
        {
          attemptId: "att-2",
          assignmentId: "asg-speak-2",
          assignmentTitle: "Interview Part 1",
          attemptNumber: 1,
          status: "IN_PROGRESS",
        },
      ];
    });

    vi.mocked(studentApi.getAttemptDetail).mockImplementation(async (attemptId: string) => ({
      attemptId,
      assignmentId: attemptId === "att-2" ? "asg-speak-2" : "asg-speak-1",
      assignmentTitle: attemptId === "att-2" ? "Interview Part 1" : "Shadowing: Daily Greeting",
      attemptNumber: 1,
      status: attemptId === "att-2" ? "IN_PROGRESS" : "COMPLETED",
      score: attemptId === "att-best" ? 8.5 : undefined,
      questions: [
        {
          id: "sa-1",
          questionId: "q-1",
          promptText: "Say hello",
          questionType: "AUDIO_RESPONSE",
          maxPoints: 10,
          evalFeedback:
            attemptId === "att-best"
              ? JSON.stringify({ overallScore: 85, sentenceTokens: [] })
              : "null",
        },
      ],
    }));

    const { result } = renderHook(() => useSpeakingDailyPlans());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.currentAttempt?.attemptId).toBe("att-best");
    expect(result.current.shadowingReport?.overallScore).toBe(85);
    expect(result.current.isShadowingMode).toBe(true);

    // Đã đạt >= 80 điểm -> handleStartNewAttempt phải chặn làm lại
    await act(async () => {
      await result.current.handleStartNewAttempt();
    });
    expect(result.current.errorMessage).toContain("ĐẠT CHUẨN");
    expect(studentApi.startAssignment).not.toHaveBeenCalled();

    // Chuyển bài tập 2
    await act(async () => {
      await result.current.handleSelectAssignment("asg-speak-2");
    });
    expect(result.current.currentAttempt?.attemptId).toBe("att-2");
    expect(result.current.shadowingReport).toBeNull();
  });
});
