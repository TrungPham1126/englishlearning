import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  groupKeyOf,
  normalizeTrueFalse,
  normalizeSkill,
  normalizeQuestionType,
  parseExcelRows,
  parseRawText,
  readSpreadsheetFile,
  EXCEL_HEADERS,
} from "@/features/teacher/utils/assignmentImport";

describe("features/teacher/utils/assignmentImport", () => {
  it("chuẩn hóa True/False/Not Given, Skill và QuestionType trên nhiều biến thể Anh-Việt", () => {
    expect(groupKeyOf("SPEAKING", "SHADOWING")).toBe("SPEAKING:SHADOWING");
    expect(groupKeyOf("READING", "QA")).toBe("READING");

    expect(normalizeTrueFalse("Đúng")).toBe("TRUE");
    expect(normalizeTrueFalse("0")).toBe("FALSE");
    expect(normalizeTrueFalse("Không đề cập")).toBe("NOT GIVEN");
    expect(normalizeTrueFalse("maybe")).toBeNull();

    expect(normalizeSkill("Nghe hiểu")).toBe("LISTENING");
    expect(normalizeSkill("Phát âm Speaking")).toBe("SPEAKING");
    expect(normalizeSkill("Đọc hiểu")).toBe("READING");
    expect(normalizeSkill("Bài luận Writing")).toBe("WRITING");
    expect(normalizeSkill("Từ vựng")).toBe("VOCABULARY");
    expect(normalizeSkill("Ngữ pháp")).toBe("GRAMMAR");
    expect(normalizeSkill("unknown", "WRITING")).toBe("WRITING");

    expect(normalizeQuestionType("Nối cặp từ")).toBe("MATCHING");
    expect(normalizeQuestionType("Đúng Sai")).toBe("TRUE_FALSE");
    expect(normalizeQuestionType("Tìm lỗi sai")).toBe("MULTIPLE_CHOICE");
    expect(normalizeQuestionType("LISTEN_AND_TYPE")).toBe("FILL_IN_BLANK");
    expect(normalizeQuestionType("Shadowing speaking")).toBe("AUDIO_RESPONSE");
    expect(normalizeQuestionType("Viết luận Essay")).toBe("ESSAY");
    expect(normalizeQuestionType("Từ vựng", 0)).toBe("FILL_IN_BLANK");
    expect(normalizeQuestionType("Từ vựng", 4)).toBe("MULTIPLE_CHOICE");
    expect(normalizeQuestionType(undefined, 3)).toBe("MULTIPLE_CHOICE");
  });

  it("parseExcelRows nhận diện thông minh đáp án, kế thừa passage, gom nhóm và bắt lỗi/cảnh báo từng dòng", () => {
    const result = parseExcelRows([
      // Dòng trống -> bỏ qua
      { _rowNum: 2, _sheetName: "Sheet1", "Nội dung câu hỏi": "" },
      // Câu 1 READING MC hợp lệ dùng chữ cái B + có Audio Script để câu 2 kế thừa
      {
        _rowNum: 3,
        _sheetName: "Sheet1",
        "Loại câu hỏi (*)": "MULTIPLE_CHOICE",
        "Kỹ năng (*)": "READING",
        "Nội dung câu hỏi / Transcript / Đề bài (*)": "Main idea?",
        "Lựa chọn A": "Option One",
        "Lựa chọn B": "Option Two",
        "Lựa chọn C": "Option Three",
        "Đáp án đúng (*)": "B",
        "Văn bản đọc TTS (Audio Script)": "Passage paragraph 1",
      },
      // Câu 2 READING TRUE_FALSE với đáp án không chuẩn -> warning tự gán TRUE + kế thừa passage
      {
        _rowNum: 4,
        _sheetName: "Sheet1",
        "Loại câu hỏi (*)": "TRUE_FALSE",
        "Kỹ năng (*)": "READING",
        "Nội dung câu hỏi / Transcript / Đề bài (*)": "Statement 1",
        "Đáp án đúng (*)": "UNCLEAR",
      },
      // Câu 3 VOCABULARY MATCHING hợp lệ
      {
        _rowNum: 5,
        _sheetName: "Sheet1",
        "Loại câu hỏi (*)": "MATCHING",
        "Kỹ năng (*)": "VOCABULARY",
        "Nội dung câu hỏi / Transcript / Đề bài (*)": "Resilient",
        "Đáp án đúng (*)": "Kiên cường",
        "Từ khóa / IPA": "/rɪˈzɪliənt/",
      },
      // Câu 4 FILL_IN_BLANK thiếu đáp án -> ghi vào errors
      {
        _rowNum: 6,
        _sheetName: "Sheet1",
        "Loại câu hỏi (*)": "FILL_IN_BLANK",
        "Kỹ năng (*)": "GRAMMAR",
        "Nội dung câu hỏi / Transcript / Đề bài (*)": "She ___ to school.",
        "Đáp án đúng (*)": "",
      },
      // Câu 5 SPEAKING Shadowing tự suy luận
      {
        _rowNum: 7,
        _sheetName: "Sheet1",
        "Loại câu hỏi (*)": "AUDIO_RESPONSE",
        "Kỹ năng (*)": "SPEAKING",
        "Nội dung câu hỏi / Transcript / Đề bài (*)": "Nghe và lặp lại: Learning daily helps.",
        "Đáp án đúng (*)": "",
      },
    ]);

    expect(result.report.source).toBe("EXCEL");
    expect(result.report.totalRows).toBe(5);
    expect(result.report.imported).toBe(4);
    expect(result.report.errors).toHaveLength(1);
    expect(result.report.errors[0]).toContain('Sheet "Sheet1" - Dòng 6');
    expect(result.report.warnings).toHaveLength(1);

    const readingGroup = result.groups.find((g) => g.key === "READING");
    expect(readingGroup?.questions).toHaveLength(2);
    expect(readingGroup?.questions[0].correctAnswer).toBe("Option Two");
    expect(readingGroup?.questions[1].transcript).toBe("Passage paragraph 1");
    expect(readingGroup?.questions[1].correctAnswer).toBe("TRUE");

    const matchingGroup = result.groups.find((g) => g.key === "VOCABULARY");
    expect(matchingGroup?.questions[0].targetWord).toBe("Resilient");

    const speakingGroup = result.groups.find((g) => g.key === "SPEAKING:SHADOWING");
    expect(speakingGroup?.questions[0].correctAnswer).toBe(
      "Nghe và lặp lại: Learning daily helps.",
    );
    expect(speakingGroup?.questions[0].points).toBe(5);
  });

  it("parseRawText phân tích đúng passage, câu trắc nghiệm, đáp án và từ vựng IPA", () => {
    const emptyRes = parseRawText("   ");
    expect(emptyRes.groups).toHaveLength(0);
    expect(emptyRes.report.errors).toHaveLength(1);

    const sampleText = `[Bài đọc] Technology has transformed global education.

Câu 1. What has technology transformed?
A. Sports
B. Global education
C. Agriculture
Đáp án: B
Giải thích: Theo câu đầu tiên trong bài đọc.
[Từ vựng: transform | /trænsˈfɔːm/]

Câu 2. Technology helps learners connect ___ anywhere.
Đáp án: from`;

    const parsed = parseRawText(sampleText, "READING");
    expect(parsed.report.imported).toBe(2);
    expect(parsed.groups[0].passage).toContain("Technology has transformed");

    const q1 = parsed.groups[0].questions[0];
    expect(q1.questionType).toBe("MULTIPLE_CHOICE");
    expect(q1.options).toHaveLength(3);
    expect(q1.correctAnswer).toBe("Global education");
    expect(q1.targetWord).toBe("transform");

    const q2 = parsed.groups[0].questions[1];
    expect(q2.questionType).toBe("FILL_IN_BLANK");
    expect(q2.correctAnswer).toBe("from");
  });

  it("readSpreadsheetFile bỏ qua sheet Hướng dẫn và quét header nằm dưới dòng banner", async () => {
    const wb = XLSX.utils.book_new();
    const wsGuide = XLSX.utils.aoa_to_sheet([["HƯỚNG DẪN SỬ DỤNG"]]);
    XLSX.utils.book_append_sheet(wb, wsGuide, "0_Huong_Dan");

    const wsData = XLSX.utils.aoa_to_sheet([
      ["BANNER TIÊU ĐỀ TRƯỜNG HỌC"],
      [""],
      EXCEL_HEADERS,
      [
        1,
        "MULTIPLE_CHOICE",
        "GRAMMAR",
        "He ___ here yesterday.",
        2,
        "was",
        "were",
        "is",
        "are",
        "A",
        "Chủ ngữ ngôi thứ ba số ít quá khứ.",
        "",
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, wsData, "De_Kiem_Tra");

    const arrayBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const fakeFile = {
      arrayBuffer: async () => arrayBuf,
    } as unknown as File;

    const rows = await readSpreadsheetFile(fakeFile);
    expect(rows).toHaveLength(1);
    expect(rows[0]._sheetName).toBe("De_Kiem_Tra");
    expect(rows[0]._rowNum).toBe(4);
    expect(rows[0]["Đáp án đúng (*)"]).toBe("A");
  });
});
