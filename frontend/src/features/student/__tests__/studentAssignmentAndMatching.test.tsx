import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { studentApi } from "@/features/student/api/studentApi";
import AudioRecorder from "@/features/student/components/AudioRecorder";
import { QuestionMatchingRenderer } from "@/features/student/components/QuestionMatchingRenderer";
import { VocabularyMatchingBoard } from "@/features/student/components/VocabularyMatchingBoard";
import { VocabularyMatchingStudio } from "@/features/student/components/VocabularyMatchingStudio";
import { AssignmentExplanationSection } from "@/features/student/components/assignment/AssignmentExplanationSection";
import { AssignmentFooterNav } from "@/features/student/components/assignment/AssignmentFooterNav";
import { AssignmentResultBanner } from "@/features/student/components/assignment/AssignmentResultBanner";
import { AssignmentTopBar } from "@/features/student/components/assignment/AssignmentTopBar";
import { QuestionContextView } from "@/features/student/components/assignment/QuestionContextView";
import { QuestionPalette } from "@/features/student/components/assignment/QuestionPalette";
import { QuestionRendererPolymorphic } from "@/features/student/components/assignment/QuestionRendererPolymorphic";
import {
  WritingScaffoldingStudio,
  classifyWritingQuestion,
  detectIeltsWritingTask,
  detectWritingSubType,
} from "@/features/student/components/assignment/WritingScaffoldingStudio";
import { ParagraphWritingStudio } from "@/features/student/components/assignment/ParagraphWritingStudio";
import { SubmitConfirmModal } from "@/features/student/components/assignment/SubmitConfirmModal";
import { WordUnscrambleInteractive } from "@/features/student/components/assignment/WordUnscrambleInteractive";
import type { AttemptResponse, QuestionResultDetail } from "@/features/student/types";

vi.mock("@/features/student/api/studentApi", () => ({
  studentApi: {
    evaluateWritingAI: vi.fn(),
  },
}));

vi.mock("@/features/student/components/SpeakingShadowingStudio", () => ({
  cleanShadowingSentence: (s: string) => s,
  default: ({ referenceSentence }: { referenceSentence: string }) => (
    <div data-testid="mock-shadowing-studio">{referenceSentence}</div>
  ),
}));

vi.mock("@/features/student/components/SpeakingQAStudio", () => ({
  default: ({ promptQuestion }: { promptQuestion: string }) => (
    <div data-testid="mock-speaking-qa-studio">{promptQuestion}</div>
  ),
}));

const makeQuestion = (
  overrides: Partial<QuestionResultDetail> = {},
): QuestionResultDetail => ({
  id: "sa-1",
  questionId: "q-1",
  promptText: "Sample prompt",
  questionType: "MULTIPLE_CHOICE",
  maxPoints: 10,
  ...overrides,
});

const baseHandlers = {
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
  onWritingEvaluated: vi.fn(),
};

describe("features/student CBT Assignment Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("QuestionRendererPolymorphic: điều phối chính xác Trắc nghiệm (click + bàn phím), Đúng/Sai và Điền từ", async () => {
    const user = userEvent.setup();
    const onUpdateAnswer = vi.fn();

    // 1. Multiple Choice
    const mcQ = makeQuestion({
      questionId: "q-mc",
      questionType: "MULTIPLE_CHOICE",
      promptText: "Choose the correct synonym",
      options: [
        { id: "opt-a", optionLabel: "A", optionText: "Resilient" },
        { id: "opt-b", optionLabel: "B", optionText: "Fragile" },
      ],
    });

    const { rerender } = render(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        question={mcQ}
        index={0}
        totalQuestions={3}
        onUpdateAnswer={onUpdateAnswer}
      />,
    );

    const optA = screen.getByText("Resilient").closest('[role="button"]')!;
    await user.click(optA);
    expect(onUpdateAnswer).toHaveBeenCalledWith("q-mc", { selectedOptionId: "opt-a" });

    fireEvent.keyDown(optA, { key: "Enter" });
    expect(onUpdateAnswer).toHaveBeenCalledTimes(2);

    // 2. True / False
    const tfQ = makeQuestion({
      questionId: "q-tf",
      questionType: "TRUE_FALSE",
      promptText: "The Earth orbits the Sun.",
      correctAnswer: "TRUE",
    });

    rerender(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        question={tfQ}
        index={1}
        totalQuestions={3}
        onUpdateAnswer={onUpdateAnswer}
      />,
    );
    await user.click(screen.getByRole("button", { name: "NOT GIVEN" }));
    expect(onUpdateAnswer).toHaveBeenCalledWith("q-tf", {
      selectedOptionId: "NOT GIVEN",
      textAnswer: "NOT GIVEN",
    });

    // 3. Fill in blank + Review hint
    const fillQ = makeQuestion({
      questionId: "q-fill",
      questionType: "FILL_IN_BLANK",
      promptText: "She ____ to school every day.",
      correctAnswer: "walks",
      explanation: "Simple present tense.",
    });

    rerender(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        question={fillQ}
        index={2}
        totalQuestions={3}
        phase="REVIEW"
        answers={{ "q-fill": { textAnswer: "walks" } }}
        onUpdateAnswer={onUpdateAnswer}
      />,
    );
    expect(screen.getByText(/W\.\.\./)).toBeInTheDocument();
    expect(screen.getByText("Simple present tense.")).toBeInTheDocument();
  });

  it("QuestionRendererPolymorphic: điều phối Sắp xếp từ, Đoạn văn, Bài luận AI và Speaking (kèm khóa câu đã đạt)", async () => {
    const user = userEvent.setup();
    const onUpdateAnswer = vi.fn();
    const onWritingEvaluated = vi.fn();

    vi.mocked(studentApi.evaluateWritingAI).mockResolvedValue({
      wordCount: 150,
      overallBand: 7.5,
      estimatedCefr: "C1",
      grammarScore: 7.5,
      vocabularyScore: 7.0,
      coherenceScore: 8.0,
      generalFeedback: "Coherent argument and strong vocabulary.",
      correctedText: "Sample improved essay text.",
      mistakes: [
        {
          original: "peoples",
          correction: "people",
          type: "grammar",
          explanation: "Uncountable plural form",
        },
      ],
      suggestions: [{ area: "Cohesion", recommendation: "Vary discourse markers." }],
    });

    // 1. Word Unscramble
    const unscrambleQ = makeQuestion({
      questionId: "q-un",
      questionType: "UNSCRAMBLE",
      promptText: "Sắp xếp: always / she / early / wakes",
    });

    const { rerender } = render(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        question={unscrambleQ}
        index={0}
        totalQuestions={4}
        onUpdateAnswer={onUpdateAnswer}
      />,
    );

    await user.click(screen.getByRole("button", { name: "always" }));
    expect(onUpdateAnswer).toHaveBeenCalledWith("q-un", { textAnswer: "always" });

    // 2. IELTS Essay WritingScaffoldingStudio -> AI grade
    const essayQ = makeQuestion({
      questionId: "q-essay",
      studentAnswerId: "sa-essay",
      questionType: "ESSAY",
      promptText: "IELTS Task 2 (150-250 từ): Discuss remote work.",
      explanation: "Include pros and cons.",
    });

    const longEssay =
      "Remote work has become increasingly common around the world because technology allows teams to collaborate effectively from anywhere.";

    rerender(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        question={essayQ}
        index={1}
        totalQuestions={4}
        answers={{ "q-essay": { textAnswer: longEssay } }}
        onUpdateAnswer={onUpdateAnswer}
        onWritingEvaluated={onWritingEvaluated}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Chấm điểm/i }));
    await waitFor(() => {
      expect(studentApi.evaluateWritingAI).toHaveBeenCalledWith(
        essayQ.promptText,
        longEssay,
        "sa-essay",
        { writingTask: "TASK_2" },
      );
    });
    expect(onWritingEvaluated).toHaveBeenCalledWith(
      "q-essay",
      expect.objectContaining({ overallBand: 7.5 }),
      longEssay,
      true,
    );
    expect(screen.getByText(/Kết quả \(7\.5\)/i)).toBeInTheDocument();

    // 3. Speaking Q&A vs Shadowing vs Passed Lock
    rerender(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        question={makeQuestion({
          questionId: "q-qa",
          questionType: "AUDIO_RESPONSE",
          promptText: "Q&A: Describe your hometown",
        })}
        index={2}
        totalQuestions={4}
      />,
    );
    expect(screen.getByTestId("mock-speaking-qa-studio")).toHaveTextContent(
      "Describe your hometown",
    );

    rerender(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        question={makeQuestion({
          questionId: "q-shad",
          questionType: "AUDIO_RESPONSE",
          promptText: "Repeat clearly",
          correctAnswer: "Practice makes progress",
          evalFeedback: JSON.stringify({ overallScore: 92 }),
        })}
        index={3}
        totalQuestions={4}
      />,
    );
    expect(screen.getByText(/Đã đạt \(92\.0\/100\)/i)).toBeInTheDocument();
  });

  it("Phân tách IELTS Writing Task 1 (150 từ), Task 2 (250 từ) và Paragraph Writing gửi đúng writingTask tới AI", async () => {
    const user = userEvent.setup();

    vi.mocked(studentApi.evaluateWritingAI).mockResolvedValue({
      wordCount: 160,
      writingTask: "TASK_1",
      overallBand: 7.0,
      estimatedCefr: "C1",
      grammarScore: 7.0,
      vocabularyScore: 7.0,
      coherenceScore: 7.0,
      taskAchievement: { score: 7.0 },
      generalFeedback: "Clear overview and accurate data comparisons.",
      correctedText: "Improved writing sample.",
      mistakes: [],
      suggestions: [],
    });

    const sampleText =
      "The chart clearly compares energy consumption across five regions over a ten year period with notable growth in solar power.";

    // 1. Task 1 qua QuestionRendererPolymorphic (kèm mediaUrl biểu đồ + explanation có từ 'overview paragraph')
    const task1Question = makeQuestion({
      questionId: "q-task1",
      studentAnswerId: "sa-task1",
      questionType: "ESSAY",
      promptText: "Summarize the information in the bar chart below (at least 150 words).",
      explanation: "Write a clear overview paragraph and compare key figures.",
      mediaUrl: "https://example.com/charts/energy-bar.png",
    });

    const task1Attempt: AttemptResponse = {
      attemptId: "att-w1",
      assignmentId: "asg-w1",
      assignmentTitle: "IELTS Task 1: Bar Chart",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      questions: [task1Question],
    };

    const { unmount: unmountTask1 } = render(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        attempt={task1Attempt}
        question={task1Question}
        index={0}
        totalQuestions={1}
        answers={{ "q-task1": { textAnswer: sampleText } }}
      />,
    );

    expect(screen.getAllByText("IELTS Writing Task 1").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/tối thiểu 150 từ/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2\. Overview/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Data Comparison/i)).toBeInTheDocument();
    expect(screen.getByAltText("IELTS Task 1 visual")).toHaveAttribute(
      "src",
      "https://example.com/charts/energy-bar.png",
    );
    expect(screen.queryByRole("button", { name: /Nghe/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Chấm điểm/i }));
    await waitFor(() => {
      expect(studentApi.evaluateWritingAI).toHaveBeenCalledWith(
        task1Question.promptText,
        sampleText,
        "sa-task1",
        { writingTask: "TASK_1" },
      );
    });
    expect(screen.getByText("TA")).toBeInTheDocument();
    unmountTask1();

    // 2. Task 2 qua QuestionRendererPolymorphic (kiểm tra 'sustainable' không bị nhận nhầm 'table' -> Task 1)
    const task2Question = makeQuestion({
      questionId: "q-task2",
      studentAnswerId: "sa-task2",
      questionType: "ESSAY",
      promptText:
        "Sustainable urban planning requires prioritizing public transit over private cars. To what extent do you agree or disagree?",
      explanation: "Write at least 250 words with clear topic sentences.",
    });

    const { unmount: unmountTask2 } = render(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        question={task2Question}
        index={0}
        totalQuestions={1}
        answers={{ "q-task2": { textAnswer: sampleText } }}
      />,
    );

    expect(screen.getAllByText("IELTS Writing Task 2").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/tối thiểu 250 từ/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2\. Body Paragraph 1/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Conclusion/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Chấm điểm/i }));
    await waitFor(() => {
      expect(studentApi.evaluateWritingAI).toHaveBeenCalledWith(
        task2Question.promptText,
        sampleText,
        "sa-task2",
        { writingTask: "TASK_2" },
      );
    });
    expect(screen.getByText("TR")).toBeInTheDocument();
    unmountTask2();

    // 3. Paragraph Writing dù DB lưu questionType="ESSAY" (giống luồng teacher create) vẫn phải mở ParagraphWritingStudio và gửi PARAGRAPH
    const paragraphQuestion = makeQuestion({
      questionId: "q-para",
      studentAnswerId: "sa-para",
      questionType: "ESSAY",
      promptText: "Viết đoạn văn (40–80 từ) mô tả thói quen đọc sách mỗi ngày.",
    });

    const { unmount: unmountPara } = render(
      <QuestionRendererPolymorphic
        {...baseHandlers}
        question={paragraphQuestion}
        index={0}
        totalQuestions={1}
        answers={{ "q-para": { textAnswer: sampleText } }}
      />,
    );

    expect(screen.getByText("Viết đoạn")).toBeInTheDocument();
    expect(screen.getAllByText(/40–80 từ/i).length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getByRole("button", { name: /Chấm điểm/i }));
    await waitFor(() => {
      expect(studentApi.evaluateWritingAI).toHaveBeenCalledWith(
        paragraphQuestion.promptText,
        sampleText,
        "sa-para",
        { writingTask: "PARAGRAPH" },
      );
    });
    unmountPara();

    // 4. Kiểm tra trực tiếp WritingScaffoldingStudio fallback auto-detect + ParagraphWritingStudio
    const { rerender, unmount: unmountStudio } = render(
      <WritingScaffoldingStudio
        promptText="The process diagram illustrates glass recycling. Write at least 150 words."
        currentEssay={sampleText}
        onEssayChange={vi.fn()}
        studentAnswerId="sa-direct-1"
      />,
    );
    expect(screen.getByText("IELTS Writing Task 1")).toBeInTheDocument();
    expect(screen.getAllByText(/tối thiểu 150 từ/i).length).toBeGreaterThanOrEqual(1);

    rerender(
      <WritingScaffoldingStudio
        promptText="Discuss both views and give your opinion on remote education."
        currentEssay={sampleText}
        onEssayChange={vi.fn()}
        studentAnswerId="sa-direct-2"
      />,
    );
    expect(screen.getByText("IELTS Writing Task 2")).toBeInTheDocument();
    expect(screen.getAllByText(/tối thiểu 250 từ/i).length).toBeGreaterThanOrEqual(1);
    unmountStudio();

    render(
      <ParagraphWritingStudio
        promptText="Opinion (B1): Should students have part-time jobs? (100–150 words)"
        currentParagraph={sampleText}
        onParagraphChange={vi.fn()}
        studentAnswerId="sa-direct-para"
      />,
    );
    expect(screen.getAllByText(/100–150 từ/i).length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getByRole("button", { name: /Chấm điểm/i }));
    await waitFor(() => {
      expect(studentApi.evaluateWritingAI).toHaveBeenCalledWith(
        "Opinion (B1): Should students have part-time jobs? (100–150 words)",
        sampleText,
        "sa-direct-para",
        { writingTask: "PARAGRAPH" },
      );
    });
  });

  it("Khớp chặt phân loại TASK_1 / TASK_2 / PARAGRAPH với backend (tránh bare 'process'/'100-150', giữ single/short paragraph & topic sentence)", () => {
    // 1. Bare "process" trong chủ đề xã hội phải giữ nguyên TASK_2 (không rơi vào TASK_1)
    expect(
      classifyWritingQuestion({
        questionType: "ESSAY",
        promptText: "Education is a lifelong process that benefits society.",
      }),
    ).toEqual({ kind: "ESSAY", writingTask: "TASK_2" });

    // 2. "table below" / "process diagram" / "the map" là ngữ cảnh biểu đồ -> TASK_1
    expect(
      classifyWritingQuestion({
        questionType: "ESSAY",
        promptText: "The table below shows tourism revenue across four countries.",
      }),
    ).toEqual({ kind: "ESSAY", writingTask: "TASK_1" });

    // 3. Range "100-150 words" không được match nhầm standalone "150 words" trong detectIeltsWritingTask
    expect(
      detectIeltsWritingTask({
        promptText: "Opinion (B1): Should students have part-time jobs? (100-150 words)",
      }),
    ).toBe("TASK_2");
    expect(
      detectIeltsWritingTask({
        promptText: "Summarize the chart in at least 150 words.",
      }),
    ).toBe("TASK_1");

    // 4. Paragraph cues ("single paragraph", "one paragraph", "short paragraph", "topic sentence") trên ESSAY -> PARAGRAPH,
    //    trong khi "4-paragraph" vẫn giữ là TASK_2
    for (const paraPrompt of [
      "Write a single paragraph about your daily routine.",
      "Write one paragraph explaining why exercise matters.",
      "Write a short paragraph describing your favorite place.",
      "Write a cohesive text with a clear topic sentence and supporting examples.",
    ]) {
      expect(
        classifyWritingQuestion({
          questionType: "ESSAY",
          promptText: paraPrompt,
        }),
      ).toEqual({ kind: "PARAGRAPH" });
    }

    expect(
      classifyWritingQuestion({
        questionType: "ESSAY",
        promptText: "Write a 4-paragraph essay about renewable energy.",
      }),
    ).toEqual({ kind: "ESSAY", writingTask: "TASK_2" });

    // 5. Subtype detection: C1 Discursive -> TASK_2; Email / Descriptive -> PARAGRAPH; Task 1 Process/Map/Data & Task 2 sub-genres
    expect(
      classifyWritingQuestion({
        questionType: "WRITING_DISCURSIVE_ESSAY",
        promptText: "Artificial intelligence and ethics in education.",
      }),
    ).toEqual({ kind: "ESSAY", writingTask: "TASK_2" });
    expect(
      classifyWritingQuestion({
        questionType: "WRITING_SHORT_EMAIL",
        promptText: "Invite your friend to a study session.",
      }),
    ).toEqual({ kind: "PARAGRAPH" });
    expect(
      classifyWritingQuestion({
        questionType: "WRITING_DESCRIPTIVE_PARAGRAPH",
        promptText: "Describe your favorite weekend routine.",
      }),
    ).toEqual({ kind: "PARAGRAPH" });

    expect(detectWritingSubType("TASK_1", "The flow chart illustrates how glass is recycled.")).toBe("TASK1_PROCESS");
    expect(detectWritingSubType("TASK_1", "The two maps show campus redevelopment from 2005 to 2025.")).toBe("TASK1_MAP");
    expect(detectWritingSubType("TASK_1", "The bar chart compares electricity usage.")).toBe("TASK1_DATA");
    expect(detectWritingSubType("TASK_2", "Discuss both views and give your opinion.")).toBe("TASK2_DISCUSSION");
    expect(detectWritingSubType("TASK_2", "Discursive Academic Essay (C1): Automation in society.")).toBe("TASK2_DISCURSIVE_C1");
  });

  it("ParagraphWritingStudio hiển thị badge Email & gửi writingTask=WRITING_SHORT_EMAIL khi gặp đề Email", async () => {
    const user = userEvent.setup();
    vi.mocked(studentApi.evaluateWritingAI).mockResolvedValue({
      wordCount: 48,
      overallBand: 6.5,
      estimatedCefr: "B1",
      grammarScore: 6.5,
      vocabularyScore: 6.5,
      coherenceScore: 6.5,
      correctedText: "Hi Nam, Let's meet at the library.",
      mistakes: [],
      suggestions: [],
      generalFeedback: "Email rõ ràng.",
    });

    const emailText = "Hi Nam, Are you free this Saturday morning? Let's meet at the city library to practice English writing together. Best regards, Minh";
    render(
      <ParagraphWritingStudio
        promptText="Write a short email (40-80 words) inviting a friend to a study club."
        currentParagraph={emailText}
        onParagraphChange={vi.fn()}
        studentAnswerId="sa-email-1"
      />,
    );

    expect(screen.getByText("Email / Tin nhắn ngắn")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Chấm điểm/i }));
    await waitFor(() => {
      expect(studentApi.evaluateWritingAI).toHaveBeenCalledWith(
        "Write a short email (40-80 words) inviting a friend to a study club.",
        emailText,
        "sa-email-1",
        { writingTask: "WRITING_SHORT_EMAIL" },
      );
    });
  });

  it("WritingScaffoldingStudio hiển thị chi tiết 4 tiêu chí, Trong bài / Cách sửa, Từ vựng gợi ý và Bài viết lại theo chuẩn IELTS", async () => {
    const user = userEvent.setup();
    vi.mocked(studentApi.evaluateWritingAI).mockResolvedValue({
      wordCount: 297,
      correctedWordCount: 293,
      writingTask: "TASK_2",
      writingSubType: "TASK2_DISCUSSION",
      overallBand: 7.5,
      estimatedCefr: "C1",
      taskResponseScore: 7,
      coherenceScore: 8,
      vocabularyScore: 8,
      grammarScore: 8,
      taskAchievement: { score: 7, addressedPoints: [], missingPoints: [] },
      generalFeedback: "Bài viết thể hiện tư duy logic rõ ràng cùng vốn từ vựng phong phú.",
      correctedText: "The global transition... For instance, Germany has successfully transitioned its Ruhr valley...",
      mistakes: [],
      suggestions: [],
      criteriaDetails: {
        TR: {
          code: "TR",
          name: "Task Response",
          band: 7,
          summary: "Bài viết giải quyết đầy đủ các phần của đề bài.",
          nextBand: 8,
          nextBandAdvice: "Đoạn này cần đưa ra các ví dụ thực tế cụ thể và số liệu rõ ràng.",
          highlights: [
            {
              inEssay: "For instance, Northern European nations...",
              rewritten: "For instance, Germany has successfully transitioned its Ruhr valley...",
              critique: "Ví dụ này chỉ nhắc chung chung đến khu vực Bắc Âu.",
              howToFix: "Cần thay thế bằng một quốc gia cụ thể cùng thành tựu đo lường được.",
            },
          ],
        },
        CC: {
          code: "CC",
          name: "Coherence & Cohesion",
          band: 8,
          summary: "Thông tin sắp xếp hợp lý với sự tiến triển rõ ràng.",
          nextBand: 9,
          nextBandAdvice: "Duy trì mạch lạc và cấu trúc đoạn văn rõ ràng.",
          highlights: [],
        },
        LR: {
          code: "LR",
          name: "Lexical Resource",
          band: 8,
          summary: "Vốn từ phong phú, collocation tự nhiên.",
          nextBand: 9,
          nextBandAdvice: "Duy trì độ chính xác khi lựa chọn collocation.",
          highlights: [],
        },
        GRA: {
          code: "GRA",
          name: "Grammatical Range & Accuracy",
          band: 8,
          summary: "Đa dạng cấu trúc câu phức chính xác.",
          nextBand: 9,
          nextBandAdvice: "Tiếp tục phát huy cấu trúc câu phức đa dạng.",
          highlights: [],
        },
      },
      suggestedVocabulary: [
        {
          word: "fossil fuel phase-out",
          ipa: "/ˈfɒs.əl ˈfjuː.əl ˈfeɪz aʊt/",
          meaning: "sự loại bỏ dần nhiên liệu hóa thạch",
          example: "The fossil fuel phase-out requires massive investment.",
          usageContext: "Dùng trong phần mở bài.",
        },
      ],
    });

    const essayWords = Array.from({ length: 260 }, (_, idx) => `energy${idx}`).join(" ");
    render(
      <WritingScaffoldingStudio
        promptText="Discuss both the environmental benefits and socio-economic challenges of renewable energy. Write at least 250 words."
        currentEssay={essayWords}
        onEssayChange={vi.fn()}
        studentAnswerId="sa-forumflash"
        writingTask="TASK_2"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Chấm điểm/i }));

    await waitFor(() => {
      expect(screen.getByText(/Band ước lượng/i)).toBeInTheDocument();
    });
    expect(screen.getByText("7.5")).toBeInTheDocument();
    expect(screen.getByText("Tiêu chí TR")).toBeInTheDocument();
    expect(screen.getByText("Trong bài")).toBeInTheDocument();
    expect(screen.getByText("Nhận xét và cách sửa")).toBeInTheDocument();
    expect(screen.getByText(/Để lên band 8\./i)).toBeInTheDocument();
    expect(screen.getByText("Từ vựng gợi ý")).toBeInTheDocument();
    expect(screen.getByText("fossil fuel phase-out")).toBeInTheDocument();
    expect(screen.getByText("Bài viết lại")).toBeInTheDocument();
    expect(screen.getByText(/293 từ/i)).toBeInTheDocument();
  });

  it("WordUnscrambleInteractive: thêm/gỡ chip và đặt lại câu", async () => {
    const user = userEvent.setup();
    const onAnswerChange = vi.fn();

    render(
      <WordUnscrambleInteractive
        promptText="Sắp xếp câu: reads / every / day / he"
        currentAnswer="he reads"
        onAnswerChange={onAnswerChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "every" }));
    expect(onAnswerChange).toHaveBeenCalledWith("he reads every");

    await user.click(screen.getAllByTitle("Chạm để gỡ từ này khỏi câu")[0]);
    expect(onAnswerChange).toHaveBeenCalledWith("reads");

    await user.click(screen.getByRole("button", { name: /Đặt lại/i }));
    expect(onAnswerChange).toHaveBeenCalledWith("");
  });

  it("TopBar, FooterNav, QuestionPalette, SubmitConfirmModal, ResultBanner, ExplanationSection & QuestionContextView", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const onSelectQuestion = vi.fn();
    const onToggleFlag = vi.fn();
    const onRetake = vi.fn();

    const attempt: AttemptResponse = {
      attemptId: "att-1",
      assignmentId: "asg-1",
      assignmentTitle: "Unit 1 Review",
      attemptNumber: 1,
      status: "COMPLETED",
      score: 6.0,
      questions: [
        makeQuestion({ questionId: "q-1", isCorrect: true, earnedPoints: 5 }),
        makeQuestion({ questionId: "q-2", isCorrect: false, earnedPoints: 0 }),
      ],
    };

    render(
      <>
        <AssignmentTopBar
          attempt={attempt}
          phase="REVIEW"
          questionsCount={2}
          answeredCount={2}
          remainingSeconds={125}
          hasPassage={false}
          studyMode="PRACTICE"
          onToggleStudyMode={vi.fn()}
          fontSizeLevel="normal"
          onChangeFontSize={vi.fn()}
          onApplyHighlight={vi.fn()}
          onRemoveAllHighlights={vi.fn()}
          reviewStats={{ correctCount: 1, totalQuestions: 2 }}
          retakeEvaluation={{ canRetry: true, message: "Cần đạt >= 80%" }}
          onRetake={onRetake}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
        <AssignmentResultBanner
          retakeEvaluation={{
            isEssay: false,
            canRetry: true,
            errorRate: 40,
            scorePercent: 60,
            message: "Đúng 1/2 câu",
          }}
          reviewStats={{ correctCount: 1, totalQuestions: 2 }}
          attempt={attempt}
          onRetake={onRetake}
        />
        <QuestionPalette
          questions={attempt.questions!}
          activeQuestionIdx={0}
          answers={{ "q-1": { selectedOptionId: "opt-a" } }}
          flaggedQuestions={{ "q-2": true }}
          checkedQuestions={{}}
          phase="TESTING"
          answeredCount={1}
          onSelectQuestion={onSelectQuestion}
          onSubmit={vi.fn()}
        />
        <AssignmentFooterNav
          activeQuestionIdx={0}
          totalQuestions={2}
          answeredCount={1}
          isFlagged={false}
          onToggleFlag={onToggleFlag}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onSubmit={vi.fn()}
          onToggleMobilePalette={vi.fn()}
          phase="TESTING"
        />
        <SubmitConfirmModal
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          answeredCount={1}
          totalQuestions={2}
        />
        <AssignmentExplanationSection
          question={makeQuestion({
            questionId: "q-1",
            isCorrect: true,
            earnedPoints: 5,
            correctAnswer: "Resilient",
            explanation: "Means able to recover quickly.",
            evalFeedback: "Well reasoned.",
          })}
          phase="REVIEW"
          studyMode="PRACTICE"
        />
        <QuestionContextView
          isListening={true}
          isReading={false}
          isVocab={true}
          audioUrl="https://example.com/audio.mp3"
          phase="TESTING"
          audioRef={{ current: null }}
          isPlayingAudio={false}
          onTogglePlayAudio={vi.fn()}
          audioCurrentTime={0}
          audioDuration={60}
          onSeekAudio={vi.fn()}
          onSkipAudio={vi.fn()}
          playbackRate={1}
          onChangePlaybackRate={vi.fn()}
          isMuted={false}
          onToggleMute={vi.fn()}
          showListeningScript={false}
          onToggleListeningScript={vi.fn()}
          isPlayingAiVoice={false}
          onToggleAiVoice={vi.fn()}
          isRepairingAudio={false}
          onRepairAudio={vi.fn()}
          fontSizeLevel="normal"
          passageContainerRef={{ current: null }}
          readingMobileTab="QUESTIONS"
          onToggleMobileTab={vi.fn()}
        />
      </>,
    );

    expect(screen.getByText(/Còn 1 câu chưa trả lời/i)).toBeInTheDocument();
    expect(screen.getByText("Means able to recover quickly.")).toBeInTheDocument();
    expect(screen.getByText("Well reasoned.")).toBeInTheDocument();
    // Với isVocab=true thì audio bar tổng phải bị ẩn
    expect(document.querySelector("audio")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Câu hỏi 2/i }));
    expect(onSelectQuestion).toHaveBeenCalledWith(1, "q-2");

    await user.click(screen.getAllByRole("button", { name: /Làm lại/i })[0]);
    expect(onRetake).toHaveBeenCalled();
  });
});

describe("features/student Matching & AudioRecorder Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();
  });

  it("QuestionMatchingRenderer: bóc tách JSON pairs, ghép/hủy nối và đặt lại", async () => {
    const user = userEvent.setup();
    const onAnswerChange = vi.fn();

    const q = makeQuestion({
      questionId: "q-match",
      questionType: "MATCHING",
      promptText: JSON.stringify({
        pairs: [
          { id: "1", word: "Ubiquitous", meaning: "Có mặt khắp nơi" },
          { id: "2", word: "Pragmatic", meaning: "Thực tế" },
        ],
      }),
    });

    render(
      <QuestionMatchingRenderer
        question={q}
        currentAnswer="{}"
        onAnswerChange={onAnswerChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Ubiquitous/i }));
    await user.click(screen.getByRole("button", { name: /Có mặt khắp nơi/i }));

    expect(onAnswerChange).toHaveBeenCalledWith(JSON.stringify({ "1": "1" }));

    await user.click(screen.getByRole("button", { name: /Đặt lại/i }));
    expect(onAnswerChange).toHaveBeenCalledWith("{}");
  });

  it("VocabularyMatchingBoard: nối cặp qua useMatchingLines và gỡ listeners + ResizeObserver khi unmount", async () => {
    const user = userEvent.setup();
    const onAnswersChange = vi.fn();

    const disconnectSpy = vi.fn();
    const observeSpy = vi.fn();
    class MockResizeObserver {
      observe = observeSpy;
      unobserve = vi.fn();
      disconnect = disconnectSpy;
    }
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: MockResizeObserver,
    });

    const addWinSpy = vi.spyOn(window, "addEventListener");
    const removeWinSpy = vi.spyOn(window, "removeEventListener");

    const questions: QuestionResultDetail[] = [
      makeQuestion({
        questionId: "w-1",
        promptText: '"Mitigate" /ˈmɪtɪɡeɪt/',
        options: [{ id: "o-1", optionText: "Mitigate", matchText: "Làm giảm nhẹ", isCorrect: true }],
      }),
      makeQuestion({
        questionId: "w-2",
        promptText: '"Foster" /ˈfɒstə/',
        options: [{ id: "o-2", optionText: "Foster", matchText: "Nuôi dưỡng", isCorrect: true }],
      }),
    ];

    const { unmount } = render(
      <VocabularyMatchingBoard
        questions={questions}
        answers={{}}
        onAnswersChange={onAnswersChange}
      />,
    );

    const mitigateCard = screen.getByText("Mitigate").closest("div.cursor-pointer")!;
    await user.click(mitigateCard);
    await user.click(screen.getByText("Làm giảm nhẹ"));

    expect(onAnswersChange).toHaveBeenCalledWith("w-1", {
      selectedOptionId: "o-1",
      textAnswer: "Làm giảm nhẹ",
    });

    const resizeAdds = addWinSpy.mock.calls.filter((c) => c[0] === "resize").length;
    unmount();
    const resizeRemoves = removeWinSpy.mock.calls.filter((c) => c[0] === "resize").length;

    expect(disconnectSpy).toHaveBeenCalled();
    expect(resizeAdds).toBeGreaterThan(0);
    expect(resizeRemoves).toBe(resizeAdds);
  });

  it("VocabularyMatchingStudio: nối và gỡ ghép từ vựng", async () => {
    const user = userEvent.setup();
    const onUpdateAnswer = vi.fn();

    const questions: QuestionResultDetail[] = [
      makeQuestion({
        questionId: "vm-1",
        promptText: '"Amplify"',
        options: [{ id: "opt-amp", optionText: "Amplify", matchText: "Khuếch đại", isCorrect: true }],
      }),
    ];

    render(
      <VocabularyMatchingStudio
        questions={questions}
        answers={{}}
        onUpdateAnswer={onUpdateAnswer}
      />,
    );

    await user.click(screen.getByText("Khuếch đại"));
    expect(onUpdateAnswer).toHaveBeenCalledWith("vm-1", {
      selectedOptionId: "opt-amp",
      textAnswer: "Khuếch đại",
    });
  });

  it("AudioRecorder: ghi âm, tạo URL mới thu hồi URL cũ và dừng micro stream khi unmount", async () => {
    const trackStopSpy = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: trackStopSpy }],
        }),
      },
    });

    class MockRecorder {
      state: "inactive" | "recording" = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((e: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      start = vi.fn(() => {
        this.state = "recording";
        this.ondataavailable?.({ data: new Blob(["a"]) } as BlobEvent);
      });
      stop = vi.fn(() => {
        this.state = "inactive";
        this.onstop?.();
      });
    }
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: MockRecorder,
    });

    let seq = 0;
    URL.createObjectURL = vi.fn(() => `blob:rec-${++seq}`);
    const revokeSpy = vi.fn();
    URL.revokeObjectURL = revokeSpy;

    const user = userEvent.setup();
    const onRecordingComplete = vi.fn();
    const { unmount } = render(
      <AudioRecorder onRecordingComplete={onRecordingComplete} />,
    );

    await user.click(screen.getByRole("button", { name: /Bắt đầu ghi âm/i }));
    await user.click(screen.getByRole("button", { name: /Dừng ghi âm/i }));

    expect(onRecordingComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelector("audio")).toHaveAttribute("src", "blob:rec-1");

    // Ghi lần 2 -> phải thu hồi blob:rec-1
    await user.click(screen.getByRole("button", { name: /Bắt đầu ghi âm/i }));
    await user.click(screen.getByRole("button", { name: /Dừng ghi âm/i }));
    expect(revokeSpy).toHaveBeenCalledWith("blob:rec-1");

    unmount();
    expect(revokeSpy).toHaveBeenCalledWith("blob:rec-2");
    expect(trackStopSpy).toHaveBeenCalled();
  });
});
