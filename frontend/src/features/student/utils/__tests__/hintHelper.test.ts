import { describe, expect, it } from "vitest";
import {
  buildQuestionHintText,
  extractInlinePromptHint,
  getFirstLetterHint,
  stripInlinePromptHint,
} from "../hintHelper";

describe("utils/hintHelper", () => {
  it("trả về chữ cái đầu viết hoa với getFirstLetterHint", () => {
    expect(getFirstLetterHint("  breakfast ")).toBe("B");
    expect(getFirstLetterHint("")).toBe("");
    expect(getFirstLetterHint(undefined)).toBe("");
  });

  it("tách và dọn gợi ý nội tuyến (Gợi ý: ...) trong đề bài", () => {
    const rawPrompt =
      "Đọc định nghĩa và nhập từ vựng tiếng Anh phù hợp (Gợi ý: b______):\nThe first meal of the day";
    expect(extractInlinePromptHint(rawPrompt)).toBe("b______");
    expect(stripInlinePromptHint(rawPrompt)).toBe(
      "Đọc định nghĩa và nhập từ vựng tiếng Anh phù hợp:\nThe first meal of the day",
    );
    expect(extractInlinePromptHint("She ____ to school.")).toBeNull();
  });

  it("tạo gợi ý an toàn ưu tiên server hint -> inline prompt -> fallback từ correctAnswer", () => {
    expect(
      buildQuestionHintText({
        promptText: "Prompt (Gợi ý: x____):",
        hint: "b________ (9 ký tự)",
        correctAnswer: "breakfast",
      }),
    ).toBe("b________ (9 ký tự)");

    expect(
      buildQuestionHintText({
        promptText: "Đọc định nghĩa (Gợi ý: b______):\nFirst meal",
        hint: null,
        correctAnswer: null,
      }),
    ).toBe("b______");

    expect(
      buildQuestionHintText({
        promptText: "She ____ to school.",
        correctAnswer: "walks",
      }),
    ).toBe("w____ (5 ký tự)");

    expect(
      buildQuestionHintText({
        promptText: "Complete the phrase",
        correctAnswer: "working memory",
      }),
    ).toBe("w______ m_____ (2 từ)");

    expect(
      buildQuestionHintText({
        promptText: "Article",
        correctAnswer: "a",
      }),
    ).toBe("1 ký tự");

    expect(
      buildQuestionHintText({
        promptText: "Sắp xếp các từ: How / often / do / you / practice / piano / ?",
        correctAnswer: "How often do you practice piano?",
        isWordUnscramble: true,
      }),
    ).toBe('Bắt đầu bằng "How" (6 từ)');
  });
});
