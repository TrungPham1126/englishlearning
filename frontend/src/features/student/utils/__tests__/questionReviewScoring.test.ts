import { describe, expect, it } from "vitest";
import type { QuestionResultDetail } from "@/features/student/types";
import {
  evaluateQuestionReviewOutcome,
  formatQuestionPoints,
  isUuidString,
  normalizeTrueFalseValue,
  resolveSubmitAnswerPayload,
} from "../questionReviewScoring";

const makeQ = (
  overrides: Partial<QuestionResultDetail> = {},
): QuestionResultDetail => ({
  id: "sa-1",
  questionId: "q-1",
  promptText: "Sample prompt",
  questionType: "MULTIPLE_CHOICE",
  maxPoints: 2,
  isCorrect: false,
  earnedPoints: 0,
  ...overrides,
});

describe("utils/questionReviewScoring", () => {
  it("tính đúng điểm khi answersPersisted=false (isCorrect=false, earnedPoints=0) cho MCQ, TRUE_FALSE, FILL_IN_BLANK, UNSCRAMBLE, MATCHING", () => {
    const mcq = makeQ({
      questionType: "MULTIPLE_CHOICE",
      maxPoints: 2,
      correctAnswer: "B",
      options: [
        { id: "opt-a", optionLabel: "A", optionText: "Wrong", isCorrect: false },
        { id: "opt-b", optionLabel: "B", optionText: "Right", isCorrect: true },
      ],
    });
    expect(evaluateQuestionReviewOutcome(mcq, { selectedOptionId: "opt-b" })).toEqual({
      isCorrect: true,
      earnedPoints: 2,
      maxPoints: 2,
    });
    expect(evaluateQuestionReviewOutcome(mcq, { selectedOptionId: "opt-a" })).toEqual({
      isCorrect: false,
      earnedPoints: 0,
      maxPoints: 2,
    });

    const tf = makeQ({
      questionType: "TRUE_FALSE",
      maxPoints: 2,
      correctAnswer: "NOT_GIVEN",
      options: [
        { id: "tf-t", optionLabel: "TRUE", optionText: "TRUE" },
        { id: "tf-f", optionLabel: "FALSE", optionText: "FALSE" },
        { id: "tf-n", optionLabel: "NOT_GIVEN", optionText: "NOT GIVEN" },
      ],
    });
    expect(
      evaluateQuestionReviewOutcome(tf, {
        selectedOptionId: "NOT GIVEN",
        textAnswer: "NOT GIVEN",
      }),
    ).toEqual({
      isCorrect: true,
      earnedPoints: 2,
      maxPoints: 2,
    });

    const fill = makeQ({
      questionType: "FILL_IN_BLANK",
      maxPoints: 1.5,
      correctAnswer: "color / colour",
    });
    expect(evaluateQuestionReviewOutcome(fill, { textAnswer: "  COLOUR " })).toEqual({
      isCorrect: true,
      earnedPoints: 1.5,
      maxPoints: 1.5,
    });

    const unscramble = makeQ({
      questionType: "UNSCRAMBLE",
      maxPoints: 2,
      correctAnswer: "She always wakes early",
    });
    expect(
      evaluateQuestionReviewOutcome(unscramble, { textAnswer: "she always wakes early" }),
    ).toEqual({
      isCorrect: true,
      earnedPoints: 2,
      maxPoints: 2,
    });

    const matching = makeQ({
      questionId: "q-match-1",
      questionType: "MATCHING",
      maxPoints: 3,
      correctAnswer: "Kiên cường",
    });
    expect(evaluateQuestionReviewOutcome(matching, { textAnswer: " kiên cường " })).toEqual({
      isCorrect: true,
      earnedPoints: 3,
      maxPoints: 3,
    });
  });

  it("ưu tiên earnedPoints > 0 hoặc fallback maxPoints khi backend đã trả isCorrect=true với earnedPoints=0", () => {
    const persisted = makeQ({ isCorrect: true, earnedPoints: 4.5, maxPoints: 5 });
    expect(evaluateQuestionReviewOutcome(persisted)).toEqual({
      isCorrect: true,
      earnedPoints: 4.5,
      maxPoints: 5,
    });

    const backendFlagOnly = makeQ({ isCorrect: true, earnedPoints: 0, maxPoints: 2 });
    expect(evaluateQuestionReviewOutcome(backendFlagOnly)).toEqual({
      isCorrect: true,
      earnedPoints: 2,
      maxPoints: 2,
    });
  });

  it("chuẩn hóa TRUE/FALSE/NOT_GIVEN và format điểm gọn đẹp", () => {
    expect(normalizeTrueFalseValue("not_given")).toBe("NOT GIVEN");
    expect(normalizeTrueFalseValue("ng")).toBe("NOT GIVEN");
    expect(normalizeTrueFalseValue("t")).toBe("TRUE");
    expect(normalizeTrueFalseValue("f")).toBe("FALSE");
    expect(formatQuestionPoints(1.0)).toBe("1");
    expect(formatQuestionPoints(1.5)).toBe("1.5");
    expect(formatQuestionPoints(0)).toBe("0");
  });

  it("chuẩn hóa khoảng trắng trước dấu câu và giải quyết selectedOptionId an toàn khi nộp bài", () => {
    const q1 = makeQ({
      questionType: "FILL_IN_BLANK",
      maxPoints: 2,
      correctAnswer: "How often do you practice piano?",
    });
    expect(
      evaluateQuestionReviewOutcome(q1, { textAnswer: "How often do you practice piano ?" }),
    ).toEqual({
      isCorrect: true,
      earnedPoints: 2,
      maxPoints: 2,
    });

    const q2 = makeQ({
      questionType: "FILL_IN_BLANK",
      maxPoints: 2,
      correctAnswer: "The documentary often watches on wildlife.",
    });
    expect(
      evaluateQuestionReviewOutcome(q2, {
        textAnswer: "The documentary often watches on wildlife .",
      }),
    ).toEqual({
      isCorrect: true,
      earnedPoints: 2,
      maxPoints: 2,
    });

    expect(isUuidString("013296ad-4796-4e5d-bbb2-428d24f028be")).toBe(true);
    expect(isUuidString("NOT GIVEN")).toBe(false);
    expect(isUuidString("opt-has")).toBe(false);

    const tfNoOpts = makeQ({
      questionId: "q-tf-1",
      questionType: "TRUE_FALSE",
      options: [],
    });
    expect(
      resolveSubmitAnswerPayload(tfNoOpts, {
        selectedOptionId: "NOT GIVEN",
        textAnswer: "NOT GIVEN",
      }),
    ).toEqual({
      questionId: "q-tf-1",
      selectedOptionId: undefined,
      textAnswer: "NOT GIVEN",
      answerText: "NOT GIVEN",
    });

    const tfUuid = "1b7a126a-6c95-464e-b92b-39fb9e5ee685";
    const tfWithOpts = makeQ({
      questionId: "q-tf-2",
      questionType: "TRUE_FALSE",
      options: [{ id: tfUuid, optionLabel: "C", optionText: "NOT GIVEN" }],
    });
    expect(
      resolveSubmitAnswerPayload(tfWithOpts, {
        selectedOptionId: "NOT GIVEN",
        textAnswer: "NOT GIVEN",
      }),
    ).toEqual({
      questionId: "q-tf-2",
      selectedOptionId: tfUuid,
      textAnswer: "NOT GIVEN",
      answerText: "NOT GIVEN",
    });
  });
});
