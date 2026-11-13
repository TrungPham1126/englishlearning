import { describe, it, expect } from "vitest";
import { getFirstLetterHint } from "@/features/student/utils/hintHelper";
import { getWordPhonetics } from "@/features/student/utils/ipaDictionary";
import {
  normalizeScoreTo100,
  getQuestionScore,
  getQuestionBestScoreAcrossAttempts,
  isQuestionPassed,
  findNextUnpassedQuestionIndex,
  getAssignmentScoreSummary,
} from "@/features/student/utils/speakingScoring";
import type { AttemptResponse, QuestionResultDetail } from "@/features/student/types";

describe("features/student/utils/hintHelper", () => {
  it("trả về chữ cái đầu tiên viết hoa hoặc chuỗi rỗng nếu thiếu/khoảng trắng", () => {
    expect(getFirstLetterHint(undefined)).toBe("");
    expect(getFirstLetterHint("")).toBe("");
    expect(getFirstLetterHint("   ")).toBe("");
    expect(getFirstLetterHint("  resilient")).toBe("R");
    expect(getFirstLetterHint("Java")).toBe("J");
  });
});

describe("features/student/utils/ipaDictionary", () => {
  it("tra cứu đúng từ trong từ điển sau khi bỏ dấu câu và chuyển chữ thường", () => {
    const walk = getWordPhonetics("  Walk! ");
    expect(walk.word).toBe("walk");
    expect(walk.ipa).toBe("wɔːk");
    expect(walk.mouthShape).toBe("ROUNDED");

    const listen = getWordPhonetics("Listen?");
    expect(listen.ipa).toBe("ˈlɪsən");
    expect(listen.mouthShape).toBe("ALVEOLAR_TAP");
  });

  it("suy luận đầy đủ 8 nhóm khẩu hình heuristic khi từ không có trong từ điển tĩnh", () => {
    expect(getWordPhonetics("think").mouthShape).toBe("INTERDENTAL");
    expect(getWordPhonetics("wood").mouthShape).toBe("ROUNDED");
    expect(getWordPhonetics("cheese").mouthShape).toBe("PALATAL_SIBILANT");
    expect(getWordPhonetics("phone").mouthShape).toBe("LABIODENTAL");
    expect(getWordPhonetics("tree").mouthShape).toBe("SPREAD");
    expect(getWordPhonetics("cat").mouthShape).toBe("OPEN_WIDE");
    expect(getWordPhonetics("bird").mouthShape).toBe("RETROFLEX_R");
    expect(getWordPhonetics("pen").mouthShape).toBe("NEUTRAL");
  });
});

describe("features/student/utils/speakingScoring", () => {
  const makeQ = (
    id: string,
    overrides: Partial<QuestionResultDetail> = {},
  ): QuestionResultDetail => ({
    id: `ans-${id}`,
    questionId: id,
    promptText: "Speak this sentence",
    questionType: "AUDIO_RESPONSE",
    maxPoints: 10,
    ...overrides,
  });

  const makeAttempt = (
    overrides: Partial<AttemptResponse> = {},
  ): AttemptResponse => ({
    attemptId: "att-1",
    assignmentId: "asg-1",
    assignmentTitle: "Speaking Test",
    attemptNumber: 1,
    status: "COMPLETED",
    ...overrides,
  });

  it("normalizeScoreTo100 xử lý null, NaN, Infinity, số âm và quy đổi thang 10 -> 100", () => {
    expect(normalizeScoreTo100(null)).toBe(0);
    expect(normalizeScoreTo100(undefined)).toBe(0);
    expect(normalizeScoreTo100(Number.NaN)).toBe(0);
    expect(normalizeScoreTo100(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeScoreTo100(-5)).toBe(0);
    expect(normalizeScoreTo100(0)).toBe(0);
    expect(normalizeScoreTo100(8.6)).toBe(86);
    expect(normalizeScoreTo100(10)).toBe(100);
    expect(normalizeScoreTo100(87.34)).toBe(87.3);
  });

  it("getQuestionScore tuân theo đúng thứ tự ưu tiên evalFeedback -> earnedPoints -> score -> isCorrect", () => {
    expect(getQuestionScore(null)).toBe(0);
    expect(
      getQuestionScore(makeQ("q1", { evalFeedback: JSON.stringify({ overallScore: 88.5 }) })),
    ).toBe(88.5);
    expect(
      getQuestionScore(makeQ("q1", { evalFeedback: JSON.stringify({ score: 9.2 }) })),
    ).toBe(92);
    expect(
      getQuestionScore(makeQ("q1", { evalFeedback: JSON.stringify({ overallBand: 7.5 }) })),
    ).toBe(75);
    expect(
      getQuestionScore(
        makeQ("q1", { evalFeedback: "{invalid json", earnedPoints: 4, maxPoints: 5 }),
      ),
    ).toBe(80);
    expect(
      getQuestionScore(makeQ("q1", { earnedPoints: 8.5, maxPoints: 0 })),
    ).toBe(85);
    expect(
      getQuestionScore({ ...makeQ("q1"), score: 7.4 } as QuestionResultDetail & { score: number }),
    ).toBe(74);
    expect(getQuestionScore(makeQ("q1", { isCorrect: true }))).toBe(100);
    expect(getQuestionScore(makeQ("q1"))).toBe(0);
  });

  it("getQuestionBestScoreAcrossAttempts, isQuestionPassed & findNextUnpassedQuestionIndex hoạt động chính xác", () => {
    const q1 = makeQ("q1", { earnedPoints: 9, maxPoints: 10 }); // 90%
    const q2 = makeQ("q2", { earnedPoints: 5, maxPoints: 10 }); // 50%
    const q3 = makeQ("q3", { isCorrect: true });

    const attempts = [
      makeAttempt({
        maxAllowedErrorPercent: 20, // pass >= 80
        questions: [
          makeQ("q1", { earnedPoints: 9.5, maxPoints: 10 }), // 95
          makeQ("q2", { earnedPoints: 6, maxPoints: 10 }), // 60
        ],
      }),
    ];

    expect(getQuestionBestScoreAcrossAttempts("q1", q1, attempts)).toBe(95);
    expect(isQuestionPassed("q1", q1, attempts)).toBe(true);
    expect(isQuestionPassed("q2", q2, attempts)).toBe(false);
    expect(isQuestionPassed("q2", q2, attempts, 55)).toBe(true);

    // Từ index 2 vòng lên đầu tìm thấy q2 ở index 1
    expect(findNextUnpassedQuestionIndex(2, [q1, q2, q3], attempts)).toBe(1);
    // Nếu đặt ngưỡng 50% thì tất cả đạt -> trả -1
    expect(findNextUnpassedQuestionIndex(0, [q1, q2, q3], attempts, 50)).toBe(-1);
    expect(findNextUnpassedQuestionIndex(0, [], attempts)).toBe(-1);
  });

  it("getAssignmentScoreSummary bỏ qua bài IN_PROGRESS và tính hết lượt thi", () => {
    const summary = getAssignmentScoreSummary([
      makeAttempt({ attemptId: "a1", status: "COMPLETED", score: 6.5, passScore: 8, maxAttempts: 2 }),
      makeAttempt({ attemptId: "a2", status: "COMPLETED", totalScore: 72, passScore: 8, maxAttempts: 2 }),
      makeAttempt({ attemptId: "a3", status: "IN_PROGRESS", score: 100 }),
    ]);

    expect(summary.completedCount).toBe(2);
    expect(summary.highestScore).toBe(72);
    expect(summary.bestAttempt?.attemptId).toBe("a2");
    expect(summary.passThreshold).toBe(80);
    expect(summary.isPassed).toBe(false);
    expect(summary.isAttemptsExhausted).toBe(true);
    expect(summary.remainingAttempts).toBe(0);
  });
});
