import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SpeakingShadowingStudio from "../components/SpeakingShadowingStudio";
import ShadowingEvaluationView from "../components/ShadowingEvaluationView";
import SpeakingQAStudio from "../components/SpeakingQAStudio";
import {
  SkillAccordionToolbar,
  SkillAccordionCard,
  detectSkillCategory,
  detectItemCategory,
} from "../components/SkillAccordion";
import { IeltsSpeakingReportCard } from "../components/speaking/IeltsSpeakingReportCard";
import { TeacherFeedbackCard } from "../components/speaking/TeacherFeedbackCard";
import { SpeakingDaySelector } from "../components/speaking/SpeakingDaySelector";
import { SpeakingPromptHeader } from "../components/speaking/SpeakingPromptHeader";
import { SpeakingPromptCard } from "../components/speaking/SpeakingPromptCard";
import { SpeakingRecordStudio } from "../components/speaking/SpeakingRecordStudio";
import { SpeakingSubmissionDaysList } from "../components/speaking/SpeakingSubmissionDaysList";
import { SpeakingTasksSidebar } from "../components/speaking/SpeakingTasksSidebar";
import { SpeakingSubmissionDetailView } from "../components/speaking/SpeakingSubmissionDetailView";
import { studentApi } from "../api/studentApi";
import { useAudioStore } from "@/store/useAudioStore";
import { usePracticeStore } from "@/store/usePracticeStore";
import * as googleTts from "@/utils/googleTranslateAudio";
import * as sampleAudio from "@/utils/sampleAudioPlayer";
import type {
  AttemptResponse,
  DaySpeakingGroup,
  FullSpeakingAiResult,
  QuestionResultDetail,
  ShadowingEvaluationResponse,
} from "../types";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = vi.fn().mockReturnValue(true);

  state: "inactive" | "recording" | "paused" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  stream: MediaStream;

  constructor(stream: MediaStream) {
    this.stream = stream;
    FakeMediaRecorder.instances.push(this);
  }

  start = vi.fn(() => {
    this.state = "recording";
  });

  stop = vi.fn(() => {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["audio-chunk"], { type: this.mimeType }),
    });
    this.onstop?.();
  });
}

function buildShadowingEvaluation(
  overrides: Partial<ShadowingEvaluationResponse> = {},
): ShadowingEvaluationResponse {
  return {
    overallScore: 88,
    isPassed: true,
    passScore: 80,
    statusMessage: "Phát âm rất tự nhiên!",
    evaluatedBy: "PYTHON_ACOUSTIC_ENGINE",
    kpi: {
      pronunciation: 90,
      fluency: 85,
      completeness: 100,
      prosody: 84,
      wordsPerMinute: 128,
    },
    sentenceTokens: [
      {
        word: "Hello",
        color: "GREEN",
        hasPauseAfter: false,
        hasLinkingAfter: true,
        wordStatus: "SPOKEN",
      },
      {
        word: "world!",
        color: "YELLOW",
        hasPauseAfter: true,
        hasLinkingAfter: false,
        wordStatus: "PARTIAL",
      },
    ],
    wordRows: [
      {
        word: "Hello",
        score: 94,
        wordStatus: "SPOKEN",
        phonemes: [{ ipa: "həˈloʊ", score: 94, note: "Rõ âm" }],
      },
      {
        word: "world",
        score: 72,
        wordStatus: "PARTIAL",
        phonemes: [{ ipa: "wɜːrld", score: 72, note: "Âm cuối nhẹ" }],
      },
    ],
    ...overrides,
  };
}

function buildIeltsResult(
  overrides: Partial<FullSpeakingAiResult> = {},
): FullSpeakingAiResult {
  return {
    transcript: "I enjoy learning English every morning.",
    wordsPerMinute: 132,
    isOffTopic: false,
    taskAchievement: {
      score: 7.5,
      addressedPoints: ["Nói rõ thói quen buổi sáng"],
      missingPoints: ["Thêm ví dụ cụ thể"],
    },
    overallBand: 7.0,
    estimatedCefr: "B2",
    pronunciationScore: 7.0,
    fluencyScore: 7.5,
    lexicalScore: 6.5,
    grammarScore: 7.0,
    coherenceScore: 7.0,
    correctedText: "I really enjoy practicing English every single morning.",
    mistakes: [
      {
        original: "learn English",
        correction: "practicing English",
        type: "VOCABULARY",
        explanation: "Dùng collocation tự nhiên hơn.",
      },
    ],
    suggestions: [
      {
        area: "Lexical Resource",
        recommendation: "Bổ sung thêm cụm từ nối tự nhiên.",
      },
    ],
    generalFeedback: "Bài nói mạch lạc, phát âm ổn định.",
    ...overrides,
  };
}

describe("Student Shadowing & Speaking Studios Components", () => {
  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    if (typeof useAudioStore.getState().recordedAudioUrl !== "string") {
      useAudioStore.setState({ recordedAudioUrl: null, recordedBlob: null });
    }
    useAudioStore.getState().resetAudioSession();
    usePracticeStore.getState().setEvaluationResult(null, false);
    usePracticeStore.getState().setFeedbackDrawerOpen(false);
    mockNavigate.mockReset();

    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          roundRect: vi.fn(),
          createLinearGradient: () => ({ addColorStop: vi.fn() }),
          strokeStyle: "",
          fillStyle: "",
          lineWidth: 1,
        }) as unknown as CanvasRenderingContext2D,
    );

    vi.spyOn(URL, "createObjectURL").mockImplementation(
      (obj) => `blob:mock-${FakeMediaRecorder.instances.length}-${String((obj as Blob).size)}`,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    vi.spyOn(sampleAudio, "playSampleAudio").mockResolvedValue(undefined);
    vi.spyOn(sampleAudio, "stopAllSampleAudio").mockImplementation(() => {});
    vi.spyOn(googleTts, "playGoogleTranslateAudio").mockResolvedValue(undefined);

    vi.spyOn(studentApi, "getQuestionAudioStatus").mockResolvedValue({
      exerciseType: "SHADOWING",
      assignmentId: "asg-1",
      questionId: "q-1",
      status: "READY",
      url: "https://cdn.example.com/native.wav",
      version: 1,
    });
    vi.spyOn(studentApi, "synthesizeTTS").mockResolvedValue({
      audioUrl: "https://cdn.example.com/native.wav",
      voice: "af_heart",
      speed: 1.0,
    });
    vi.spyOn(studentApi, "repairQuestionAudio").mockResolvedValue({
      exerciseType: "SHADOWING",
      assignmentId: "asg-1",
      questionId: "q-1",
      status: "READY",
      url: "https://cdn.example.com/repaired.wav",
      version: 2,
    });
    vi.spyOn(studentApi, "evaluateShadowingAI").mockResolvedValue(
      buildShadowingEvaluation(),
    );
    vi.spyOn(studentApi, "evaluateSpeakingAI").mockResolvedValue(
      buildIeltsResult(),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    useAudioStore.getState().resetAudioSession();
  });

  describe("SpeakingShadowingStudio + Shadowing Subcomponents", () => {
    it("renders ShadowingTopBar, DualWaveformVisualizer, TranscriptBoard and opens FeedbackDrawer + GoogleMouthAnimation", async () => {
      render(
        <SpeakingShadowingStudio
          questionId="q-1"
          studentAnswerId="ans-1"
          referenceSentence="Hello world!"
          referenceAudioUrl="https://cdn.example.com/native.wav"
          currentStep={2}
          totalSteps={5}
          onBack={vi.fn()}
          onAudioSubmitted={vi.fn()}
        />,
      );

      expect(screen.getByText("Learner Wave (Bạn)")).toBeInTheDocument();
      expect(screen.getByText("Luyện nói")).toBeInTheDocument();
      expect(screen.getByText("40%")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "2",
      );

      // Mode switch radio button
      const normalRadio = screen.getByRole("radio", { name: "Normal" });
      fireEvent.click(normalRadio);
      expect(normalRadio).toHaveAttribute("aria-checked", "true");

      // Repair native audio button triggers API
      fireEvent.click(
        screen.getByRole("button", {
          name: "Tạo lại âm thanh mẫu trên máy chủ nếu gặp sự cố",
        }),
      );
      await waitFor(() => {
        expect(studentApi.repairQuestionAudio).toHaveBeenCalled();
      });

      // Populate an evaluation result + recorded audio in store and verify drawer + word mouth guide
      act(() => {
        useAudioStore
          .getState()
          .setRecordedAudio(
            new Blob(["audio"], { type: "audio/webm" }),
            "blob:mock-learner",
            2.4,
          );
        usePracticeStore
          .getState()
          .setEvaluationResult(buildShadowingEvaluation(), false);
      });

      const resultBtn = await screen.findByRole("button", {
        name: /Kết quả \(88\/100\)/i,
      });
      fireEvent.click(resultBtn);

      expect(screen.getByText(/Tổng điểm phát âm:\s*88\s*\/\s*100/)).toBeInTheDocument();
      expect(screen.getByText("ĐẠT CHUẨN")).toBeInTheDocument();

      // Click word button in transcript to reveal GoogleMouthAnimation panel and test accent TTS
      const wordBtn = screen.getByRole("button", { name: /^Từ Hello/i });
      fireEvent.click(wordBtn);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Anh - Anh (UK)" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Anh - Anh (UK)" }));
      expect(googleTts.playGoogleTranslateAudio).toHaveBeenCalledWith(
        "hello",
        expect.objectContaining({ accent: "en-GB", slow: false }),
      );

      fireEvent.click(screen.getByLabelText("Đọc chậm (Slow)"));
      expect(googleTts.playGoogleTranslateAudio).toHaveBeenCalledWith(
        "hello",
        expect.objectContaining({ slow: true }),
      );
    });
  });

  describe("ShadowingEvaluationView", () => {
    it("renders linking/pause symbols, filters phonemes on word click, and tolerates empty arrays/missing KPI", () => {
      render(<ShadowingEvaluationView data={buildShadowingEvaluation()} />);

      expect(screen.getByText(/ĐẠT CHUẨN/)).toBeInTheDocument();
      expect(screen.getByTitle("Nối âm (Liaison)")).toHaveTextContent("‿");
      expect(screen.getByTitle("Dừng/Ngắt nhịp (Pause)")).toHaveTextContent(
        "||",
      );

      // Filter breakdown by clicking "world!"
      fireEvent.click(
        screen.getByRole("button", {
          name: /Từ world!, nhấn để lọc phân tích âm vị/i,
        }),
      );
      expect(screen.queryByText("Rõ âm")).not.toBeInTheDocument();
      expect(screen.getByText("Âm cuối nhẹ")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Xem tất cả" }));
      expect(screen.getByText("Rõ âm")).toBeInTheDocument();

      // Missing KPI & MISSING word edge cases
      render(
        <ShadowingEvaluationView
          data={
            {
              overallScore: 55,
              isPassed: false,
              passScore: 80,
              statusMessage: "Cần cố gắng hơn",
              sentenceTokens: [],
              wordRows: [
                {
                  word: "apple",
                  score: 0,
                  wordStatus: "MISSING",
                  phonemes: undefined as unknown as [],
                },
              ],
            } as unknown as ShadowingEvaluationResponse
          }
        />,
      );

      expect(screen.getByText("CẦN LUYỆN THÊM")).toBeInTheDocument();
      expect(screen.getAllByText("Chưa đọc").length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("SpeakingQAStudio", () => {
    it("runs 60s prep timer, records audio, evaluates AI (preserving overallBand 0.0), and handles retry", async () => {
      const trackStop = vi.fn();
      const fakeStream = {
        getTracks: () => [{ stop: trackStop }],
      } as unknown as MediaStream;
      const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia },
        configurable: true,
      });
      vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

      const onSubmitted = vi.fn();
      render(
        <SpeakingQAStudio
          questionId="q-qa-1"
          studentAnswerId="ans-qa-1"
          promptQuestion="Describe your morning routine."
          guidelines="Mention time and activity."
          keyPoints="Band 7+ focus"
          onAudioSubmitted={onSubmitted}
        />,
      );

      // Guidelines toggle
      expect(
        screen.getByText("Mention time and activity."),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Gợi ý ý tưởng/i }));
      expect(
        screen.queryByText("Mention time and activity."),
      ).not.toBeInTheDocument();

      // 60s prep timer
      vi.useFakeTimers();
      fireEvent.click(screen.getByRole("button", { name: /60s chuẩn bị/i }));
      expect(screen.getByText("01:00")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByText("00:57")).toBeInTheDocument();
      vi.useRealTimers();

      // Start recording (stops prep timer automatically)
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Bắt đầu thu âm" }),
        );
      });
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(screen.getByText("Đang thu")).toBeInTheDocument();

      // First evaluation rejects so Retry button appears, then succeeds with overallBand: 0
      vi.mocked(studentApi.evaluateSpeakingAI)
        .mockRejectedValueOnce(new Error("AI timeout"))
        .mockResolvedValueOnce(
          buildIeltsResult({
            overallBand: 0,
            isOffTopic: true,
            taskAchievement: { score: 2.0 },
          }),
        );

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Dừng ghi âm và chấm điểm" }),
        );
      });

      expect(trackStop).toHaveBeenCalled();
      expect(await screen.findByText("AI timeout")).toBeInTheDocument();

      // Click Retry
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
      });

      await waitFor(() => {
        expect(screen.getByText("0.0")).toBeInTheDocument();
      });
      expect(screen.getByText("Lạc đề")).toBeInTheDocument();
      expect(screen.getByText("Trọng tâm: 2.0/9.0")).toBeInTheDocument();
    });

    it("cleans up stream, revokes blob URLs on unmount while recording, and ignores stale async results after question switch", async () => {
      const trackStop = vi.fn();
      const fakeStream = {
        getTracks: () => [{ stop: trackStop }],
      } as unknown as MediaStream;
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
        configurable: true,
      });
      vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

      let resolveEval!: (val: FullSpeakingAiResult) => void;
      vi.mocked(studentApi.evaluateSpeakingAI).mockImplementation(
        () =>
          new Promise<FullSpeakingAiResult>((resolve) => {
            resolveEval = resolve;
          }),
      );

      const onSubmitted = vi.fn();
      const { rerender, unmount } = render(
        <SpeakingQAStudio
          questionId="q-1"
          promptQuestion="Prompt one"
          onAudioSubmitted={onSubmitted}
        />,
      );

      // Record & stop on q-1 so evaluateSpeakingAI stays in-flight
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Bắt đầu thu âm" }),
        );
      });
      act(() => {
        fireEvent.click(
          screen.getByRole("button", { name: "Dừng ghi âm và chấm điểm" }),
        );
      });

      // Switch to q-2 before q-1 evaluation finishes -> revokes old blob URL
      rerender(
        <SpeakingQAStudio
          questionId="q-2"
          promptQuestion="Prompt two"
          onAudioSubmitted={onSubmitted}
        />,
      );
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

      // Resolve stale q-1 promise -> must NOT update q-2 or call onSubmitted
      await act(async () => {
        resolveEval(buildIeltsResult({ transcript: "STALE Q1 TRANSCRIPT" }));
      });
      expect(screen.queryByText(/STALE Q1 TRANSCRIPT/)).not.toBeInTheDocument();
      expect(onSubmitted).not.toHaveBeenCalled();

      // Start recording on q-2 and unmount mid-recording -> stops recorder + tracks without triggering evaluation
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Bắt đầu thu âm" }),
        );
      });
      trackStop.mockClear();
      unmount();

      expect(trackStop).toHaveBeenCalled();
      expect(onSubmitted).not.toHaveBeenCalled();
    });
  });

  describe("IeltsSpeakingReportCard, TeacherFeedbackCard & SkillAccordion", () => {
    it("renders IeltsSpeakingReportCard safely even when taskAchievement.score is null and isOffTopic is true", () => {
      render(
        <IeltsSpeakingReportCard
          report={buildIeltsResult({
            isOffTopic: true,
            taskAchievement: {
              score: null as unknown as number,
              addressedPoints: [],
              missingPoints: [],
            },
            pronunciationScore: undefined as unknown as number,
          })}
        />,
      );

      expect(screen.getByText("Lạc đề (tối đa 4.0)")).toBeInTheDocument();
      expect(screen.getByText("--")).toBeInTheDocument();
      expect(screen.getByText("Đủ ý")).toBeInTheDocument();

      render(
        <TeacherFeedbackCard
          teacherFeedback="Tốt lắm!"
          score={8.5}
          dayNumber={1}
        />,
      );
      expect(screen.getByText("8.5/10")).toBeInTheDocument();
      expect(screen.getByText("Tốt lắm!")).toBeInTheDocument();

      render(<TeacherFeedbackCard dayNumber={2} />);
      expect(screen.getByText("Chờ chấm")).toBeInTheDocument();
    });

    it("detects skill categories accurately and toggles SkillAccordionCard", () => {
      expect(detectSkillCategory("LISTENING")).toBe("LISTENING");
      expect(detectSkillCategory("Luyện phát âm Shadowing")).toBe("SPEAKING");
      expect(detectSkillCategory("Essay Writing")).toBe("WRITING");
      expect(detectSkillCategory("Đọc hiểu")).toBe("READING");
      expect(detectSkillCategory("Ngữ pháp")).toBe("VOCABULARY_GRAMMAR");

      expect(detectItemCategory("SHADOWING", "Bất kỳ")).toBe("SPEAKING");
      expect(detectItemCategory("GRAMMAR", "Speaking")).toBe(
        "VOCABULARY_GRAMMAR",
      );
      expect(detectItemCategory(null, "Writing Task")).toBe("WRITING");

      const onToggle = vi.fn();
      render(
        <div>
          <SkillAccordionToolbar
            totalSkills={1}
            completedTasks={2}
            totalTasks={3}
            onExpandAll={vi.fn()}
            onCollapseAll={vi.fn()}
          />
          <SkillAccordionCard
            category="SPEAKING"
            totalTasks={2}
            completedTasks={2}
            isExpanded={true}
            onToggle={onToggle}
          >
            <div>Inner task</div>
          </SkillAccordionCard>
        </div>,
      );

      expect(screen.getByText("2/3 xong")).toBeInTheDocument();
      const toggleBtn = screen.getByRole("button", { name: /Nói/i });
      expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(toggleBtn);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe("components/speaking workflow components", () => {
    const days: DaySpeakingGroup[] = [
      {
        id: "day-1",
        dayNumber: 1,
        title: "Day 1",
        scheduledDate: "2026-04-01",
        isCompleted: true,
        isCurrentDay: false,
        speakingTasks: [
          {
            id: "asg-pass",
            title: "Shadowing Unit 1",
            isShadowing: true,
            isCompleted: true,
            highestScore: 86,
            attemptsCount: 1,
          },
        ],
      },
      {
        id: "day-2",
        dayNumber: 2,
        title: "Day 2",
        scheduledDate: "2026-04-02",
        isCompleted: false,
        isCurrentDay: true,
        speakingTasks: [
          {
            id: "asg-fail",
            title: "Q&A Daily Routine",
            isShadowing: false,
            isCompleted: false,
            highestScore: 62,
            attemptsCount: 3,
          },
        ],
      },
      {
        id: "day-3",
        dayNumber: 3,
        title: "Day 3",
        scheduledDate: "2026-04-03",
        isCompleted: false,
        isCurrentDay: false,
        speakingTasks: [
          {
            id: "asg-open",
            title: "Shadowing Travel",
            isShadowing: true,
            isCompleted: false,
            highestScore: null,
            attemptsCount: 0,
          },
        ],
      },
    ];

    it("filters days in SpeakingSubmissionDaysList and navigates to take assignment", () => {
      const onSelectDay = vi.fn();
      const onSelectAsg = vi.fn();
      render(
        <MemoryRouter>
          <SpeakingSubmissionDaysList
            daysList={days}
            selectedDayId="day-1"
            selectedAssignmentId="asg-pass"
            onSelectDay={onSelectDay}
            onSelectAssignment={onSelectAsg}
          />
          <SpeakingDaySelector
            daysList={days}
            selectedDayId="day-1"
            onSelectDay={onSelectDay}
          />
        </MemoryRouter>,
      );

      expect(screen.getByText("Tất cả (3)")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Đã nộp" }));
      expect(screen.getByText("2 ngày")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Tất cả (3)" }));
      expect(screen.getByText("Chưa đạt (Hết lượt)")).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: /Làm Shadowing \(0\/3\)/i }),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        "/student/assignments/asg-open/take",
      );
    });

    it("renders SpeakingTasksSidebar, SpeakingPromptHeader/Card/RecordStudio, and SpeakingSubmissionDetailView lock & navigation", () => {
      const questions: QuestionResultDetail[] = [
        {
          id: "sa-1",
          questionId: "q-pass",
          studentAnswerId: "sa-1",
          promptText: "First passed sentence",
          questionType: "SPEAKING",
          maxPoints: 100,
          earnedPoints: 90,
          isCorrect: true,
        },
        {
          id: "sa-2",
          questionId: "q-next",
          studentAnswerId: "sa-2",
          promptText: "Second unpassed question",
          questionType: "SPEAKING",
          maxPoints: 100,
          earnedPoints: 40,
          isCorrect: false,
          explanation: "Speak clearly",
        },
      ];
      const attempt: AttemptResponse = {
        attemptId: "att-1",
        assignmentId: "asg-2",
        assignmentTitle: "Speaking Test",
        attemptNumber: 1,
        status: "GRADED",
        score: 65,
        passScore: 80,
        maxAttempts: 3,
        submittedAt: "2026-04-02T09:00:00Z",
        teacherFeedback: "Cần nói chậm lại chút.",
        questions,
      };

      const onSelectQuestionIndex = vi.fn();
      const onRetake = vi.fn();

      render(
        <SpeakingSubmissionDetailView
          currentDay={days[2]}
          currentAttempt={attempt}
          attempts={[attempt]}
          selectedQuestionIndex={0}
          questions={questions}
          currentQ={questions[0]}
          activeAudioUrl="https://cdn.example.com/rec.wav"
          activeAudioBlob={null}
          aiReport={null}
          shadowingReport={null}
          reportQuestionId={null}
          isEvaluating={false}
          isSubmitting={false}
          isSubmitted={true}
          isShadowingMode={false}
          isRecording={false}
          recordingSeconds={0}
          isSynthesizingTts={false}
          isPlayingRefTts={false}
          selectedVoice="af_heart"
          ttsSpeed={1}
          isPlayingStudentRec={false}
          onSelectQuestionIndex={onSelectQuestionIndex}
          onSelectAttempt={vi.fn()}
          onRetake={onRetake}
          onStartRecord={vi.fn()}
          onStopRecord={vi.fn()}
          onFileUpload={vi.fn()}
          onEvaluateAi={vi.fn()}
          onSubmit={vi.fn()}
          onPlayTtsPrompt={vi.fn()}
          onChangeVoice={vi.fn()}
          onChangeSpeed={vi.fn()}
          onAudioPlay={vi.fn()}
          onAudioPause={vi.fn()}
          onAudioEnded={vi.fn()}
        />,
      );

      expect(screen.getByText("First passed sentence")).toBeInTheDocument();
      expect(screen.getByText("Cần nói chậm lại chút.")).toBeInTheDocument();

      // Carousel next goes to question index 1
      fireEvent.click(screen.getByRole("button", { name: /Sau/i }));
      expect(onSelectQuestionIndex).toHaveBeenCalledWith(1);

      // Also test SpeakingTasksSidebar + standalone PromptHeader / PromptCard / RecordStudio
      const onStartRec = vi.fn();
      const onEval = vi.fn();
      render(
        <div>
          <SpeakingTasksSidebar
            currentDay={days[2]}
            selectedAssignmentId="asg-open"
            attempts={[attempt]}
            currentAttemptId="att-1"
            switching={false}
            isSubmitted={true}
            onSelectAssignment={vi.fn()}
            onSelectAttempt={vi.fn()}
            onRetake={onRetake}
          />
          <SpeakingPromptHeader
            dayNumber={3}
            questionIndex={1}
            totalQuestions={2}
            isShadowingMode={true}
            isSubmitted={false}
            totalScore={82.5}
          />
          <SpeakingPromptCard
            question={questions[1]}
            isSynthesizingTts={false}
            isPlayingRefTts={false}
            selectedVoice="af_heart"
            ttsSpeed={1.0}
            showGuidelines={true}
            onPlayTts={vi.fn()}
            onChangeVoice={vi.fn()}
            onChangeSpeed={vi.fn()}
            onToggleGuidelines={vi.fn()}
          />
          <SpeakingRecordStudio
            activeAudioUrl={null}
            isRecording={false}
            recordingSeconds={0}
            isEvaluating={false}
            isSubmitting={false}
            isSubmitted={false}
            dayNumber={3}
            hasAudioBlob={true}
            onStartRecord={onStartRec}
            onStopRecord={vi.fn()}
            onFileUpload={vi.fn()}
            onEvaluateAi={onEval}
            onSubmit={vi.fn()}
          />
        </div>,
      );

      expect(screen.getByText("Ngày 3 • Câu 2/2")).toBeInTheDocument();
      expect(screen.getByText("Speak clearly")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Thu âm" }));
      expect(onStartRec).toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Chấm điểm" }));
      expect(onEval).toHaveBeenCalled();
    });
  });
});
