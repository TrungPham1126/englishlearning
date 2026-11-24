import { describe, expect, it } from "vitest";
import { sortQuestionOptions } from "../questionOptions";

describe("utils/questionOptions", () => {
  it("sắp xếp đáp án trắc nghiệm bị xáo trộn D, B, A, C hoặc C, B, A, D về đúng thứ tự A, B, C, D mà không mutate mảng gốc", () => {
    const original = [
      { id: "opt-d", optionLabel: "D", optionText: "Delta" },
      { id: "opt-b", optionLabel: "B", optionText: "Bravo" },
      { id: "opt-a", optionLabel: "A", optionText: "Alpha" },
      { id: "opt-c", optionLabel: "C", optionText: "Charlie" },
    ];
    const snapshot = [...original];

    const sorted1 = sortQuestionOptions(original);
    expect(sorted1.map((o) => o.optionLabel)).toEqual(["A", "B", "C", "D"]);
    expect(sorted1.map((o) => o.optionText)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
    expect(original).toEqual(snapshot);

    const scrambled2 = [
      { id: "opt-c", optionLabel: "C", optionText: "Charlie" },
      { id: "opt-b", optionLabel: "B", optionText: "Bravo" },
      { id: "opt-a", optionLabel: "A", optionText: "Alpha" },
      { id: "opt-d", optionLabel: "D", optionText: "Delta" },
    ];
    expect(sortQuestionOptions(scrambled2).map((o) => o.optionLabel)).toEqual(["A", "B", "C", "D"]);
  });

  it("chuẩn hóa nhãn viết thường, có dấu câu (d., b)) hoặc suy từ tiền tố optionText khi thiếu optionLabel", () => {
    const withPunct = [
      { optionLabel: "d.", optionText: "Option 4" },
      { optionLabel: " b) ", optionText: "Option 2" },
      { optionLabel: "c:", optionText: "Option 3" },
      { optionLabel: "a", optionText: "Option 1" },
    ];
    expect(sortQuestionOptions(withPunct).map((o) => o.optionText)).toEqual([
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4",
    ]);

    const withoutLabel = [
      { optionText: "D. Fourth" },
      { optionText: "B) Second" },
      { optionText: "A. First" },
      { optionText: "C: Third" },
    ];
    expect(sortQuestionOptions(withoutLabel).map((o) => o.optionText)).toEqual([
      "A. First",
      "B) Second",
      "C: Third",
      "D. Fourth",
    ]);
  });

  it("sắp xếp TRUE / FALSE / NOT_GIVEN theo đúng chuẩn và giữ nguyên thứ tự gốc khi không có nhãn", () => {
    const tf = [
      { optionLabel: "FALSE", optionText: "Sai" },
      { optionLabel: "NOT_GIVEN", optionText: "Không có thông tin" },
      { optionLabel: "TRUE", optionText: "Đúng" },
    ];
    expect(sortQuestionOptions(tf).map((o) => o.optionLabel)).toEqual([
      "TRUE",
      "FALSE",
      "NOT_GIVEN",
    ]);

    const unlabelled = [
      { id: "1", optionText: "First item" },
      { id: "2", optionText: "Second item" },
      { id: "3", optionText: "Third item" },
    ];
    expect(sortQuestionOptions(unlabelled).map((o) => o.id)).toEqual(["1", "2", "3"]);
    expect(sortQuestionOptions(null)).toEqual([]);
    expect(sortQuestionOptions(undefined)).toEqual([]);
  });
});
