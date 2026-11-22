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
import SpeakingAiEvaluationPage from "../pages/SpeakingAiEvaluationPage";
import { ParagraphWritingStudio } from "../components/assignment/ParagraphWritingStudio";
import { WritingScaffoldingStudio } from "../components/assignment/WritingScaffoldingStudio";
import { QuestionRendererPolymorphic } from "../components/assignment/QuestionRendererPolymorphic";
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

    it("routes AUDIO_RESPONSE Q&A with Vietnamese rubric to SpeakingQAStudio without sample audio or mouth-shape tiles, and supports Part 2 & Part 3", () => {
      const commonProps = {
        index: 0,
        totalQuestions: 3,
        answers: {},
        onUpdateAnswer: vi.fn(),
        isFlagged: false,
        onToggleFlag: vi.fn(),
        onCheckInstant: vi.fn(),
        isHintExpanded: false,
        onToggleHint: vi.fn(),
        studyMode: "PRACTICE" as const,
        phase: "TESTING" as const,
        resolveAudioUrl: (url?: string) => url || "",
        speakText: vi.fn(),
        onUploadAudio: vi.fn(),
      };

      const { rerender } = render(
        <QuestionRendererPolymorphic
          {...commonProps}
          attempt={
            {
              attemptId: "att-1",
              assignmentId: "asg-1",
              assignmentTitle: "Hỏi - Đáp Q&A (B2) - Ngày 2026-11-14",
              status: "IN_PROGRESS",
              totalScore: 0,
              questions: [],
            } as unknown as AttemptResponse
          }
          question={{
            id: "sa-qa-1",
            questionId: "q-qa-real",
            studentAnswerId: "sa-qa-1",
            promptText: "Explain how green roofs benefit urban environments?",
            questionType: "AUDIO_RESPONSE",
            correctAnswer:
              "(1) lắp đặt mái xanh và vườn treo để tạo môi trường sống cho thực vật và côn trùng.",
            transcript:
              "(1) lắp đặt mái xanh và vườn treo để tạo môi trường sống cho thực vật và côn trùng.",
            explanation: "Gợi ý: urban heat island, biodiversity",
            maxPoints: 10,
          }}
        />,
      );

      // Must route to SpeakingQAStudio (normal English question, no Shadowing mouth-shape tiles, no 'Nghe' button, no Vietnamese rubric shown)
      expect(screen.getByText("Hỏi - đáp Speaking")).toBeInTheDocument();
      expect(
        screen.getByText("Explain how green roofs benefit urban environments?"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/TRANSCRIPT LUYỆN ĐỌC/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^Nghe$/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/lắp đặt mái xanh/i),
      ).not.toBeInTheDocument();

      // IELTS Part 2 Cue Card
      rerender(
        <QuestionRendererPolymorphic
          {...commonProps}
          attempt={
            {
              attemptId: "att-2",
              assignmentId: "asg-2",
              assignmentTitle: "IELTS Speaking Part 2 (IELTS)",
              status: "IN_PROGRESS",
              totalScore: 0,
              questions: [],
            } as unknown as AttemptResponse
          }
          question={{
            id: "sa-p2-1",
            questionId: "q-p2-1",
            studentAnswerId: "sa-p2-1",
            promptText:
              "Describe a park you enjoy visiting.\nYou should say:\n- where it is\n- what you do there",
            questionType: "AUDIO_RESPONSE",
            correctAnswer: "Bao phủ đủ các ý trên Cue Card trong 1–2 phút",
            maxPoints: 10,
          }}
        />,
      );
      expect(
        screen.getByText("IELTS Speaking Part 2 • Cue Card"),
      ).toBeInTheDocument();
      expect(screen.getByText("IELTS Part 2")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Ghi chú Cue Card/i }),
      ).toBeInTheDocument();

      // IELTS Part 3 Discussion
      rerender(
        <QuestionRendererPolymorphic
          {...commonProps}
          attempt={
            {
              attemptId: "att-3",
              assignmentId: "asg-3",
              assignmentTitle: "IELTS Speaking Part 3 (IELTS)",
              status: "IN_PROGRESS",
              totalScore: 0,
              questions: [],
            } as unknown as AttemptResponse
          }
          question={{
            id: "sa-p3-1",
            questionId: "q-p3-1",
            studentAnswerId: "sa-p3-1",
            promptText: "Why do young people prefer living in big cities?",
            questionType: "AUDIO_RESPONSE",
            correctAnswer: "Lập luận PEEL so sánh cơ hội và thách thức",
            maxPoints: 10,
          }}
        />,
      );
      expect(
        screen.getByText("IELTS Speaking Part 3 • Discussion"),
      ).toBeInTheDocument();
      expect(screen.getByText("IELTS Part 3")).toBeInTheDocument();
      expect(screen.getByText(/Câu 1\/\d+, đọc trong 90 giây/)).toBeInTheDocument();
    });

    it("auto-recovers corrupted Vietnamese Part 2 prompt to plain English Cue Card and renders Python IPA phonetics card", async () => {
      const fakeStream = {
        getTracks: () => [{ stop: vi.fn() }],
      } as unknown as MediaStream;
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
        configurable: true,
      });
      vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

      vi.mocked(studentApi.evaluateSpeakingAI).mockResolvedValueOnce(
        buildIeltsResult({
          overallBand: 5.5,
          isPassed: true,
          pronunciationScore: 5.5,
          phoneticEvaluation: {
            overallScore: 62,
            isPassed: false,
            passScore: 80,
            statusMessage: "Cần cải thiện âm cuối",
            evaluatedBy: "PYTHON_ACOUSTIC_ENGINE",
            kpi: {
              pronunciation: 60,
              fluency: 68,
              completeness: 92,
              prosody: 64,
              wordsPerMinute: 128,
            },
            sentenceTokens: [],
            wordRows: [
              {
                word: "beach",
                score: 55,
                wordStatus: "PARTIAL",
                phonemes: [
                  { ipa: "/iː/", score: 52, note: "Kéo dài nguyên âm /iː/" },
                  { ipa: "/tʃ/", score: 85, note: "Âm cuối rõ" },
                ],
              },
            ],
          },
        }) as unknown as FullSpeakingAiResult,
      );

      render(
        <QuestionRendererPolymorphic
          question={{
            id: "sa-corrupted-p2",
            questionId: "q-corrupted-p2",
            studentAnswerId: "sa-corrupted-p2",
            promptText:
              "(1) bãi biển ở đâu, (2) thời gian đi, (3) hoạt động chính, (4) lý do khiến chuyến đi đáng nhớ",
            questionType: "AUDIO_RESPONSE",
            correctAnswer:
              "(1) bãi biển ở đâu, (2) thời gian đi, (3) hoạt động chính, (4) lý do khiến chuyến đi đáng nhớ",
            maxPoints: 10,
          }}
          index={0}
          totalQuestions={5}
          answers={{}}
          onUpdateAnswer={vi.fn()}
          isFlagged={false}
          onToggleFlag={vi.fn()}
          onCheckInstant={vi.fn()}
          isHintExpanded={false}
          onToggleHint={vi.fn()}
          studyMode="PRACTICE"
          phase="TESTING"
          resolveAudioUrl={(u) => u || ""}
          speakText={vi.fn()}
          attempt={
            {
              attemptId: "att-corrupt",
              assignmentId: "asg-corrupt",
              assignmentTitle: "Speaking Part 2 (Cue Card) (A1) - Ngày 2026-11-14",
              status: "IN_PROGRESS",
              totalScore: 0,
              questions: [],
            } as unknown as AttemptResponse
          }
          onUploadAudio={vi.fn()}
        />,
      );

      expect(screen.queryByText(/TRANSCRIPT LUYỆN ĐỌC/i)).not.toBeInTheDocument();
      expect(screen.getByText("Câu 1/5, đọc trong 120 giây")).toBeInTheDocument();
      expect(
        screen.getByText(/Describe a memorable trip to the beach/i),
      ).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Bắt đầu thu âm" }),
        );
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Dừng ghi âm và chấm điểm" }),
        );
      });

      expect(
        await screen.findByText(/Phân tích Phát âm Python/i),
      ).toBeInTheDocument();
      expect(screen.getByText("Kết quả: 5.5/9.0 điểm")).toBeInTheDocument();
      expect(screen.getByText("Bạn đã đạt!")).toBeInTheDocument();

      const wordBtn = screen.getByRole("button", { name: /beach/i });
      fireEvent.click(wordBtn);
      expect(screen.getByText("/iː/")).toBeInTheDocument();
      expect(screen.getByText(/Kéo dài nguyên âm/i)).toBeInTheDocument();
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

    it("SpeakingShadowingStudio tô màu đầy đủ 4 trạng thái từ GREEN / YELLOW / RED / GRAY và SpeakingQAStudio xử lý lỗi từ chối quyền Micro", async () => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      const { unmount } = render(
        <SpeakingShadowingStudio
          questionId="q-colors"
          studentAnswerId="ans-colors"
          referenceSentence="Speak English every morning"
          onAudioSubmitted={vi.fn()}
        />,
      );

      // 1. Khi chưa có kết quả chấm -> cả 4 từ hiển thị màu GRAY (trạng thái: Chưa đọc)
      expect(
        screen.getByRole("button", { name: /Từ Speak.*trạng thái: Chưa đọc/i }),
      ).toBeInTheDocument();

      // 2. Nạp kết quả chấm có đủ 4 màu GREEN, YELLOW, RED, GRAY
      act(() => {
        usePracticeStore.getState().setEvaluationResult(
          buildShadowingEvaluation({
            sentenceTokens: [
              {
                word: "Speak",
                color: "GREEN",
                hasPauseAfter: false,
                hasLinkingAfter: true,
                wordStatus: "SPOKEN",
              },
              {
                word: "English",
                color: "YELLOW",
                hasPauseAfter: false,
                hasLinkingAfter: false,
                wordStatus: "PARTIAL",
              },
              {
                word: "every",
                color: "RED",
                hasPauseAfter: true,
                hasLinkingAfter: false,
                wordStatus: "MISPRONOUNCED",
              },
              {
                word: "morning",
                color: "GRAY",
                hasPauseAfter: false,
                hasLinkingAfter: false,
                wordStatus: "MISSING",
              },
            ],
            wordRows: [
              { word: "Speak", score: 95, wordStatus: "SPOKEN", phonemes: [] },
              { word: "English", score: 70, wordStatus: "PARTIAL", phonemes: [] },
              { word: "every", score: 35, wordStatus: "MISPRONOUNCED", phonemes: [] },
              { word: "morning", score: 0, wordStatus: "MISSING", phonemes: [] },
            ],
          }),
          false,
        );
      });

      const greenBtn = screen.getByRole("button", {
        name: /Từ Speak.*trạng thái: Phát âm chuẩn/i,
      });
      const yellowBtn = screen.getByRole("button", {
        name: /Từ English.*trạng thái: Cần cải thiện/i,
      });
      const redBtn = screen.getByRole("button", {
        name: /Từ every.*trạng thái: Phát âm sai/i,
      });
      const grayBtn = screen.getByRole("button", {
        name: /Từ morning.*trạng thái: Chưa đọc/i,
      });

      expect(greenBtn.className).toContain("bg-emerald-50");
      expect(yellowBtn.className).toContain("bg-amber-50");
      expect(redBtn.className).toContain("bg-rose-50");
      expect(grayBtn.className).toContain("bg-slate-100");
      unmount();

      // 3. SpeakingQAStudio khi trình duyệt từ chối quyền Micro (NotAllowedError)
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
        },
      });

      render(
        <SpeakingQAStudio
          questionId="q-mic-err"
          promptQuestion="What is your favorite book?"
          speakingMode="PART_3"
          onAudioSubmitted={vi.fn()}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thu âm" }));
      });
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Không thể truy cập Microphone/i),
      );
    });

    it("ParagraphWritingStudio và WritingScaffoldingStudio đếm từ chuẩn IELTS, hiển thị criteriaDetails/mistakes/suggestedVocabulary và xử lý lỗi API", async () => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      vi.spyOn(studentApi, "evaluateWritingAI").mockRejectedValueOnce({
        response: { data: { message: "Dịch vụ chấm Writing đang quá tải" } },
      });

      const essayText =
        "Renewable energy plays an essential role in reducing carbon emissions and protecting global ecosystems from severe climate change.";

      const onWritingEvaluated = vi.fn();
      const { unmount } = render(
        <WritingScaffoldingStudio
          promptText="IELTS Task 2: Discuss the role of renewable energy in modern society. Write at least 250 words."
          currentEssay={essayText}
          onEssayChange={vi.fn()}
          studentAnswerId="sa-w-1"
          writingTask="TASK_2"
          onWritingEvaluated={onWritingEvaluated}
        />,
      );

      // Kiểm tra đếm từ (18 từ / tối thiểu 250 từ)
      expect(screen.getByText(/18 \/ tối thiểu 250 từ/i)).toBeInTheDocument();

      // 1. Khi API lỗi -> hiển thị alert lỗi
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Chấm điểm/i }));
      });
      expect(alertSpy).toHaveBeenCalledWith(
        "Chấm bài Writing thất bại: Dịch vụ chấm Writing đang quá tải",
      );

      // 2. Khi API thành công -> hiển thị criteriaDetails, mistakes và suggestedVocabulary
      vi.mocked(studentApi.evaluateWritingAI).mockResolvedValueOnce({
        wordCount: 18,
        correctedWordCount: 22,
        writingTask: "TASK_2",
        overallBand: 7.0,
        estimatedCefr: "C1",
        taskResponseScore: 7.0,
        coherenceScore: 7.0,
        vocabularyScore: 7.0,
        grammarScore: 7.0,
        generalFeedback: "Lập luận sáng rõ, từ vựng học thuật tốt.",
        correctedText:
          "Renewable energy plays a pivotal role in curtailing carbon emissions and safeguarding global ecosystems.",
        mistakes: [
          {
            original: "an essential role",
            correction: "a pivotal role",
            type: "vocabulary",
            explanation: "Nâng cấp collocation học thuật C1.",
          },
        ],
        suggestions: [],
        criteriaDetails: {
          TR: {
            code: "TR",
            name: "Task Response",
            band: 7,
            summary: "Đáp ứng tốt yêu cầu đề bài.",
            nextBand: 8,
            nextBandAdvice: "Bổ sung dẫn chứng định lượng cụ thể.",
            highlights: [
              {
                inEssay: "Renewable energy plays an essential role",
                rewritten: "Renewable energy plays a pivotal role",
                critique: "Cách diễn đạt còn phổ thông.",
                howToFix: "Thay bằng collocation học thuật.",
              },
            ],
          },
        },
        suggestedVocabulary: [
          {
            word: "carbon footprint reduction",
            ipa: "/ˈkɑː.bən ˈfʊt.prɪnt rɪˈdʌk.ʃən/",
            meaning: "giảm dấu chân carbon",
            example: "Solar power accelerates carbon footprint reduction.",
            usageContext: "Dùng trong câu chủ đề đoạn thân bài.",
          },
        ],
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Chấm điểm/i }));
      });

      expect(onWritingEvaluated).toHaveBeenCalledWith(
        expect.objectContaining({ overallBand: 7.0 }),
        essayText,
        true,
      );
      expect(screen.getByText("Tiêu chí TR")).toBeInTheDocument();
      expect(screen.getByText("Sửa lỗi chi tiết (1)")).toBeInTheDocument();
      expect(screen.getByText("an essential role")).toBeInTheDocument();
      expect(screen.getByText("a pivotal role")).toBeInTheDocument();
      expect(screen.getByText("Từ vựng gợi ý")).toBeInTheDocument();
      expect(screen.getByText("carbon footprint reduction")).toBeInTheDocument();
      unmount();

      // 3. ParagraphWritingStudio: kiểm tra chặn chấm khi dưới 10 từ và xử lý lỗi API khi chấm đoạn văn
      alertSpy.mockClear();
      const { rerender: rerenderPara } = render(
        <ParagraphWritingStudio
          promptText="Write a short paragraph (40-80 words) about your daily routine."
          currentParagraph="Too short text here now."
          onParagraphChange={vi.fn()}
          studentAnswerId="sa-p-1"
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Chấm điểm/i }));
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringMatching(/tối thiểu một vài câu/i),
      );

      vi.mocked(studentApi.evaluateWritingAI).mockRejectedValueOnce(
        new Error("Paragraph AI service unavailable"),
      );
      rerenderPara(
        <ParagraphWritingStudio
          promptText="Write a short paragraph (40-80 words) about your daily routine."
          currentParagraph="Every morning I wake up early at six o'clock, drink a glass of warm water, and read an English book for thirty minutes."
          onParagraphChange={vi.fn()}
          studentAnswerId="sa-p-1"
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Chấm điểm/i }));
      });
      expect(alertSpy).toHaveBeenCalledWith(
        "Chấm đoạn văn thất bại: Paragraph AI service unavailable",
      );
    });

    it("SpeakingAiEvaluationPage tải lộ trình Speaking, chuyển lớp học, hiển thị chi tiết bài nộp và đóng thông báo lỗi", async () => {
      vi.spyOn(studentApi, "getMyCourses").mockResolvedValue([
        {
          classId: "cls-speak-1",
          className: "IELTS Speaking 6.5",
          level: "B2",
          teacherName: "Cô Lan",
          status: "ACTIVE",
          enrolledAt: "2026-01-01",
          progressPercentage: 60,
        },
        {
          classId: "cls-speak-2",
          className: "IELTS Speaking 7.5",
          level: "C1",
          teacherName: "Thầy Minh",
          status: "ACTIVE",
          enrolledAt: "2026-01-02",
          progressPercentage: 30,
        },
      ]);
      vi.spyOn(studentApi, "getClassDailyPlans").mockResolvedValue([
        {
          id: "day-s1",
          dayNumber: 1,
          title: "DAY 1",
          items: [
            {
              itemType: "SPEAKING",
              sectionName: "Speaking Part 2",
              title: "Cue Card: Hometown",
              assignmentId: "asg-sp-1",
            },
          ],
        },
      ]);
      vi.spyOn(studentApi, "getDailyHomeworkOverview").mockResolvedValue({
        completionPercentage: 50,
        totalDays: 1,
        completedDays: 0,
        days: [],
        currentSelectedDay: null,
      });
      vi.spyOn(studentApi, "getClassAssignments").mockResolvedValue([
        {
          id: "asg-sp-1",
          title: "Cue Card: Hometown",
          description: "IELTS Part 2",
          skillType: "SPEAKING",
          maxAttempts: 3,
          passScore: 5,
          attemptsCount: 1,
          highestScore: 7.0,
          status: "COMPLETED",
        },
      ]);
      vi.spyOn(studentApi, "getMyAttempts").mockResolvedValue([
        {
          attemptId: "att-sp-1",
          assignmentId: "asg-sp-1",
          assignmentTitle: "Cue Card: Hometown",
          attemptNumber: 1,
          status: "COMPLETED",
          score: 7.0,
        },
      ]);
      vi.spyOn(studentApi, "getAttemptDetail").mockResolvedValue({
        attemptId: "att-sp-1",
        assignmentId: "asg-sp-1",
        assignmentTitle: "Cue Card: Hometown",
        attemptNumber: 1,
        status: "COMPLETED",
        score: 7.0,
        questions: [
          {
            id: "sa-sp-1",
            questionId: "q-sp-1",
            promptText: "Describe your hometown.",
            questionType: "AUDIO_RESPONSE",
            audioUrl: "https://cdn.example.com/student-hometown.webm",
            maxPoints: 10,
            evalFeedback: JSON.stringify(buildIeltsResult({ overallBand: 7.0 })),
          },
        ],
      });

      render(
        <MemoryRouter>
          <SpeakingAiEvaluationPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Bài nộp Speaking")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText("Describe your hometown.")).toBeInTheDocument();
      });

      // Chuyển tab mobile Danh sách / Chi tiết
      fireEvent.click(screen.getByRole("button", { name: /Ngày \(1\)/i }));
      fireEvent.click(screen.getByRole("button", { name: /Chi tiết/i }));

      // Đổi lớp học trên dropdown
      const classSelect = screen.getByRole("combobox");
      fireEvent.change(classSelect, { target: { value: "cls-speak-2" } });
      await waitFor(() => {
        expect(studentApi.getClassDailyPlans).toHaveBeenCalledWith("cls-speak-2");
      });
    });
  });
});
