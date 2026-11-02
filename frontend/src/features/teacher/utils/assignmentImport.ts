// frontend/src/features/teacher/utils/assignmentImport.ts
import * as XLSX from "xlsx";
import type { QuestionDraft } from "../components/CreateAssignmentModal";

export type SkillKey =
  | "VOCABULARY"
  | "READING"
  | "LISTENING"
  | "SPEAKING"
  | "WRITING"
  | "GRAMMAR";

export type SpeakingModeKey = "QA" | "SHADOWING";

export interface ImportGroup {
  key: string;
  skill: SkillKey;
  speakingMode: SpeakingModeKey;
  label?: string;
  questions: QuestionDraft[];
  passage: string;
  audioUrl: string;
}

export interface ImportReport {
  source: "EXCEL" | "TEXT";
  totalRows: number;
  imported: number;
  errors: string[];
  warnings: string[];
}

export interface ImportResult {
  groups: ImportGroup[];
  report: ImportReport;
}

export function groupKeyOf(skill: SkillKey, speakingMode: SpeakingModeKey): string {
  return skill === "SPEAKING" ? `SPEAKING:${speakingMode}` : skill;
}

/**
 * Chuẩn hóa giá trị True/False/Not Given
 */
export function normalizeTrueFalse(val?: string | null): "TRUE" | "FALSE" | "NOT GIVEN" | null {
  if (!val) return null;
  const clean = String(val).trim().toUpperCase();
  if (
    clean === "TRUE" ||
    clean === "T" ||
    clean === "ĐÚNG" ||
    clean === "DUNG" ||
    clean === "Đ" ||
    clean === "1"
  ) {
    return "TRUE";
  }
  if (
    clean === "FALSE" ||
    clean === "F" ||
    clean === "SAI" ||
    clean === "S" ||
    clean === "0"
  ) {
    return "FALSE";
  }
  if (
    clean === "NOT GIVEN" ||
    clean === "NOTGIVEN" ||
    clean === "NG" ||
    clean === "KHÔNG CÓ TRONG BÀI" ||
    clean === "KHONG CO" ||
    clean === "KHÔNG ĐỀ CẬP"
  ) {
    return "NOT GIVEN";
  }
  return null;
}

/**
 * Chuẩn hóa tên Kỹ năng từ text tiếng Việt / tiếng Anh
 */
export function normalizeSkill(rawSkill?: string | null, defaultSkill: SkillKey = "READING"): SkillKey {
  if (!rawSkill) return defaultSkill;
  const s = String(rawSkill).trim().toUpperCase();
  if (s.includes("LISTEN") || s.includes("NGHE")) return "LISTENING";
  if (s.includes("SPEAK") || s.includes("NÓI") || s.includes("PHÁT ÂM") || s.includes("SHADOW")) return "SPEAKING";
  if (s.includes("READ") || s.includes("ĐỌC")) return "READING";
  if (s.includes("WRITE") || s.includes("VIẾT") || s.includes("ESSAY") || s.includes("LUẬN")) return "WRITING";
  if (s.includes("VOCAB") || s.includes("TỪ VỰNG")) return "VOCABULARY";
  if (s.includes("GRAMMAR") || s.includes("NGỮ PHÁP")) return "GRAMMAR";
  return defaultSkill;
}

/**
 * Chuẩn hóa dạng câu hỏi QuestionType
 */
export function normalizeQuestionType(
  rawType?: string | null,
  optionsCount: number = 0,
  defaultType: QuestionDraft["questionType"] = "MULTIPLE_CHOICE"
): QuestionDraft["questionType"] {
  if (!rawType) {
    return optionsCount >= 2 ? "MULTIPLE_CHOICE" : defaultType;
  }
  const t = String(rawType).trim().toUpperCase();

  // 1. Matching (Nối thẻ, ghép cặp từ vựng)
  if (t.includes("MATCH") || t.includes("NỐI") || t.includes("GHÉP") || t.includes("NOI") || t.includes("GHEP")) {
    return "MATCHING";
  }

  // 2. True / False / Not Given
  if (t.includes("TRUE") || t.includes("FALSE") || t.includes("NOT GIVEN") || t.includes("ĐÚNG SAI") || t.includes("DUNG SAI")) {
    return "TRUE_FALSE";
  }

  // 3. Error identification -> Map sang Multiple Choice
  if (t.includes("ERROR") || t.includes("LỖI") || t.includes("LOI")) {
    return "MULTIPLE_CHOICE";
  }

  // 4. Điền từ, chia động từ, viết lại câu, nghe chép chính tả (LISTEN_AND_TYPE)
  if (
    t.includes("BLANK") ||
    t.includes("FILL") ||
    t.includes("ĐIỀN") ||
    t.includes("DIEN") ||
    t.includes("CLOZE") ||
    t.includes("GAP") ||
    t.includes("DICTATION") ||
    t.includes("LISTEN_AND_TYPE") ||
    t.includes("LISTEN") ||
    t.includes("TRANSFORMATION") ||
    t.includes("VIẾT LẠI") ||
    t.includes("VIET LAI") ||
    t.includes("SẮP XẾP") ||
    t.includes("SAP XEP")
  ) {
    return "FILL_IN_BLANK";
  }

  // 5. Nói, phát âm, Shadowing, Audio response
  if (
    t.includes("AUDIO") ||
    t.includes("VOICE") ||
    t.includes("SHADOW") ||
    t.includes("SPEAK") ||
    t.includes("RECORD") ||
    t.includes("PRONUNCIATION") ||
    t.includes("PHÁT ÂM") ||
    t.includes("PHAT AM")
  ) {
    return "AUDIO_RESPONSE";
  }

  // 6. Viết luận Essay
  if (t.includes("ESSAY") || t.includes("VIẾT") || t.includes("PARAGRAPH") || t.includes("TASK") || t.includes("BÀI LUẬN") || t.includes("BAI LUAN") || t.includes("WRITING")) {
    return "ESSAY";
  }

  // 7. Flashcard từ vựng
  if (t.includes("FLASHCARD")) {
    return "MULTIPLE_CHOICE";
  }
  if (t.includes("TỪ VỰNG") || t.includes("TU VUNG")) {
    return optionsCount >= 2 ? "MULTIPLE_CHOICE" : "FILL_IN_BLANK";
  }

  // 8. Trắc nghiệm Multiple Choice
  if (t.includes("CHOICE") || t.includes("MULTIPLE") || t.includes("TRẮC NGHIỆM") || t.includes("TRAC NGHIEM") || t.includes("MC")) {
    return "MULTIPLE_CHOICE";
  }

  return optionsCount >= 2 ? "MULTIPLE_CHOICE" : defaultType;
}

/**
 * Tìm giá trị từ object dòng theo danh sách tên cột tiềm năng
 */
function getRowField(row: Record<string, any>, candidateNames: string[]): string {
  const keys = Object.keys(row);
  for (const name of candidateNames) {
    const directMatch = row[name];
    if (directMatch !== undefined && directMatch !== null && String(directMatch).trim() !== "") {
      return String(directMatch).trim();
    }
    const normName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const foundKey = keys.find(
      (k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === normName
    );
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== "") {
      return String(row[foundKey]).trim();
    }
  }
  return "";
}

// 12 CỘT TIÊU ĐỀ CHUẨN ĐỒNG NHẤT
export const EXCEL_HEADERS = [
  "STT",
  "Loại câu hỏi (*)",
  "Kỹ năng (*)",
  "Nội dung câu hỏi / Transcript / Đề bài (*)",
  "Điểm (*)",
  "Lựa chọn A",
  "Lựa chọn B",
  "Lựa chọn C",
  "Lựa chọn D",
  "Đáp án đúng (*)",
  "Giải thích / Gợi ý chấm AI",
  "Văn bản đọc TTS (Audio Script)",
];

// CẤU HÌNH ĐỘ RỘNG CỘT TỰ ĐỘNG (!cols)
export const STANDARD_COL_WIDTHS = [
  { wch: 6 },  // STT
  { wch: 20 }, // Loại câu hỏi
  { wch: 14 }, // Kỹ năng
  { wch: 45 }, // Nội dung
  { wch: 8 },  // Điểm
  { wch: 20 }, // Lựa chọn A
  { wch: 20 }, // Lựa chọn B
  { wch: 20 }, // Lựa chọn C
  { wch: 20 }, // Lựa chọn D
  { wch: 25 }, // Đáp án đúng
  { wch: 35 }, // Giải thích
  { wch: 35 }, // TTS Script
];

// DỮ LIỆU SHEET HƯỚNG DẪN 0_Huong_Dan
export const GUIDE_SHEET_DATA: (string | number)[][] = [
  ["HƯỚNG DẪN QUY CHUẨN NHẬP DỮ LIỆU BÀI TẬP BẰNG FILE EXCEL (.XLSX)"],
  ["Hệ thống hỗ trợ tự động nhận diện tất cả 6 Kỹ năng và các Studio học tập tương ứng trong nền tảng English Learning."],
  [""],
  ["1. Ý NGHĨA VÀ QUY CÁCH ĐIỀN 12 CỘT DỮ LIỆU CHUẨN:"],
  ["STT", "Tên Cột", "Tính Chất", "Mô Tả & Quy Cách Điền", "Áp Dụng Cho Dạng Bài"],
  [1, "STT", "Tùy chọn", "Số thứ tự dòng (1, 2, 3...) để dễ quản lý trong bảng tính.", "Tất cả các dạng"],
  [2, "Loại câu hỏi (*)", "Bắt buộc", "Mã dạng: MULTIPLE_CHOICE, FILL_IN_BLANK, MATCHING, AUDIO_RESPONSE, ESSAY, TRUE_FALSE (hoặc alias: LISTEN_AND_TYPE, SPEAKING, SPEAKING_QA, WRITING).", "Tất cả các dạng"],
  [3, "Kỹ năng (*)", "Bắt buộc", "Mã kỹ năng chuẩn: VOCABULARY, GRAMMAR, LISTENING, READING, SPEAKING, WRITING.", "Tất cả các dạng"],
  [4, "Nội dung câu hỏi / Transcript / Đề bài (*)", "Bắt buộc", "Nội dung câu hỏi, từ vựng cần nối, câu mẫu Shadowing hoặc đề bài tự luận. Câu điền từ dùng ký hiệu '___' để tạo chỗ trống.", "Tất cả các dạng"],
  [5, "Điểm (*)", "Tùy chọn", "Điểm số của câu (mặc định 1 hoặc 2; Speaking/Writing là 5.0 hoặc 10.0).", "Tất cả các dạng"],
  [6, "Lựa chọn A", "Theo dạng", "BẮT BUỘC cho trắc nghiệm (tối thiểu A, B). ĐỂ TRỐNG cho Matching, Điền từ, Shadowing, Viết luận.", "Trắc nghiệm, Tìm lỗi sai"],
  [7, "Lựa chọn B", "Theo dạng", "Phương án B. BẮT BUỘC cho câu trắc nghiệm.", "Trắc nghiệm, Tìm lỗi sai"],
  [8, "Lựa chọn C", "Theo dạng", "Phương án C. Thường dùng cho câu trắc nghiệm 3-4 phương án.", "Trắc nghiệm, Tìm lỗi sai"],
  [9, "Lựa chọn D", "Theo dạng", "Phương án D. Thường dùng cho câu trắc nghiệm 4 phương án.", "Trắc nghiệm, Tìm lỗi sai"],
  [10, "Đáp án đúng (*)", "Bắt buộc", "Trắc nghiệm: ghi chữ cái 'A', 'B', 'C', 'D' HOẶC ghi toàn văn lựa chọn đúng. Matching: ghi nghĩa tiếng Việt tương ứng. Điền từ: ghi từ cần điền. Shadowing: ghi lại câu mẫu.", "Tất cả các dạng"],
  [11, "Giải thích / Gợi ý chấm AI", "Khuyến khích", "Lời giải thích chi tiết, phiên âm IPA cho từ vựng, mẹo ngữ pháp hoặc Rubric tiêu chí chấm điểm tự luận AI.", "Tất cả các dạng"],
  [12, "Văn bản đọc TTS (Audio Script)", "Tùy chọn", "Đoạn văn bài nghe hoặc câu tiếng Anh cần phát âm. Hệ thống sẽ tự động tổng hợp giọng đọc chuẩn US Native qua Kokoro TTS!", "Listening, Shadowing, Vocab"],
  [""],
  ["2. HƯỚNG DẪN CHI TIẾT THEO TỪNG STUDIO HỌC TẬP:"],
  ["Studio / Giao Diện Học Tập", "Loại Câu Hỏi", "Kỹ Năng", "Cách Điền Cột D, J, L", "Gợi Ý & Mẹo"],
  ["MultipleChoiceRenderer (Trắc nghiệm)", "MULTIPLE_CHOICE", "READING, GRAMMAR, LISTENING", "Cột D: Câu hỏi. Cột F, G, H, I: Lựa chọn A, B, C, D. Cột J: Ghi 'A', 'B', 'C', 'D' hoặc toàn văn lựa chọn.", "Hệ thống tự động nhận diện chữ cái hoặc khớp text."],
  ["FillInBlankRenderer (Điền từ khuyết)", "FILL_IN_BLANK", "GRAMMAR, VOCABULARY, READING", "Cột D: Câu chứa '___' (3 gạch dưới). Cột J: Từ/cụm từ cần điền đúng. Lựa chọn A-D: Để trống.", "Không phân biệt hoa thường khi chấm."],
  ["ListenAndTypeRenderer (Nghe chép chính tả)", "LISTEN_AND_TYPE", "LISTENING", "Cột D: Câu chứa '___'. Cột J: Từ cần gõ. Cột L: Đoạn kịch bản nghe để Kokoro TTS tự tạo audio.", "Hệ thống tự động sinh audio phát âm chuẩn bản ngữ US Native."],
  ["VocabularyMatchingStudio (Ghép cặp từ vựng)", "MATCHING", "VOCABULARY", "Cột D: Từ vựng tiếng Anh (VD: Resilient). Cột J: Nghĩa tiếng Việt. Cột K: Phiên âm IPA.", "Học sinh sẽ chơi màn lật thẻ hoặc nối từ vựng tương ứng."],
  ["SpeakingShadowingStudio (Luyện nhại âm)", "SPEAKING", "SPEAKING", "Cột D: Câu mẫu cần nhại. Cột J: Câu mẫu. Cột L: Câu tiếng Anh để AI sinh file audio chuẩn.", "Học sinh nghe người bản ngữ đọc rồi nói lại, AI chấm điểm phát âm & ngữ điệu."],
  ["SpeakingQAStudio / Essay Studio (Tự luận)", "SPEAKING_QA hoặc WRITING", "SPEAKING, WRITING", "Cột D: Chủ đề phỏng vấn / Đề bài luận. Cột K: Tiêu chí chấm AI (Rubric, dàn ý gợi ý).", "AI Lab sẽ đánh giá theo Rubric: Fluency, Lexical resource, Grammar, Task Response."],
];

// CÁC DÒNG MẪU ĐIỀN SẴN THEO TỪNG KỸ NĂNG
export const SAMPLE_ROWS_BY_SKILL: Record<SkillKey, any[][]> = {
  READING: [
    [
      1,
      "MULTIPLE_CHOICE",
      "READING",
      "What is the primary factor driving modern renewable energy adoption?",
      2.0,
      "Government subsidy reduction",
      "Technological cost decline and efficiency gains",
      "Fossil fuel abundance",
      "Short-term speculative investment",
      "B",
      "Lựa chọn B chính xác vì sự suy giảm chi phí công nghệ và hiệu suất cao là động lực cốt lõi thúc đẩy năng lượng tái tạo.",
      "Renewable energy adoption has accelerated globally due to falling technological costs.",
    ],
    [
      2,
      "FILL_IN_BLANK",
      "READING",
      "Quantum computers exploit the physical principle known as ___ to evaluate combinatorial possibilities simultaneously.",
      2.0,
      "",
      "",
      "",
      "",
      "superposition",
      "Dựa vào bài đọc: 'exploiting the quantum mechanical principle of superposition to evaluate vast possibilities'.",
      "",
    ],
  ],
  GRAMMAR: [
    [
      1,
      "MULTIPLE_CHOICE",
      "GRAMMAR",
      "Neither the senior architect nor the system engineers ___ aware of the database migration yesterday.",
      2.0,
      "was",
      "were",
      "is",
      "are",
      "B",
      "Quy tắc hòa hợp chủ vị 'Neither... nor...': Động từ chia theo danh từ gần nhất ('system engineers' số nhiều ở quá khứ -> 'were').",
      "",
    ],
    [
      2,
      "FILL_IN_BLANK",
      "GRAMMAR",
      "If she had checked the train schedule earlier, she ___ (not miss) the morning seminar.",
      2.0,
      "",
      "",
      "",
      "",
      "would not have missed",
      "Câu điều kiện loại 3: If + S + had + V3/ed, S + would have + V3/ed.",
      "",
    ],
  ],
  LISTENING: [
    [
      1,
      "LISTEN_AND_TYPE",
      "LISTENING",
      "Listen and type the missing word: She has worked at the tech laboratory ___ 2015.",
      2.0,
      "",
      "",
      "",
      "",
      "since",
      "Dùng 'since' trước mốc thời gian cụ thể (2015) trong thì hiện tại hoàn thành.",
      "She has worked at the tech laboratory since 2015.",
    ],
    [
      2,
      "MULTIPLE_CHOICE",
      "LISTENING",
      "What primary engineering challenge in offshore wind energy does Dr. Aris highlight?",
      2.0,
      "High turbine blade manufacturing costs",
      "Saltwater corrosion and long-distance transmission losses",
      "Shortage of qualified marine electrical technicians",
      "Public opposition from regional coastal tourism",
      "B",
      "Tiến sĩ Aris nhấn mạnh: 'Our foremost technical hurdle is mitigating saltwater galvanic corrosion and transmission losses'.",
      "Good morning delegates. Today our foremost technical hurdle is mitigating saltwater galvanic corrosion and reducing long-distance transmission losses across subsea power lines.",
    ],
  ],
  SPEAKING: [
    [
      1,
      "SPEAKING",
      "SPEAKING",
      "Consistency is the key to mastering any new skill.",
      5.0,
      "",
      "",
      "",
      "",
      "Consistency is the key to mastering any new skill.",
      "Chú ý nối âm 'is the', trọng âm 'conSIStency', 'MAStering'. Ngữ điệu xuống ở cuối câu trần thuật.",
      "Consistency is the key to mastering any new skill.",
    ],
    [
      2,
      "SPEAKING_QA",
      "SPEAKING",
      "Describe an environmental challenge facing your city and propose a practical community solution.",
      5.0,
      "",
      "",
      "",
      "",
      "Sample response covering issue analysis, local impact, and actionable community mitigation steps.",
      "Rubric chấm AI: 1. Fluency & Coherence, 2. Lexical Resource, 3. Grammatical Range, 4. Task Response.",
      "",
    ],
  ],
  VOCABULARY: [
    [
      1,
      "MATCHING",
      "VOCABULARY",
      "Resilient",
      2.0,
      "",
      "",
      "",
      "",
      "Kiên cường, có khả năng phục hồi nhanh trước khó khăn",
      "/rɪˈzɪl.jənt/ (adj): able to recover quickly from difficult conditions.",
      "Resilient individuals adapt swiftly to adverse circumstances.",
    ],
    [
      2,
      "MATCHING",
      "VOCABULARY",
      "Perseverance",
      2.0,
      "",
      "",
      "",
      "",
      "Tính kiên trì, sự bền chí theo đuổi mục tiêu",
      "/ˌpɜː.sɪˈvɪə.rəns/ (noun): persistence in doing something despite difficulty.",
      "Perseverance is essential to achieve long-term success.",
    ],
    [
      3,
      "MATCHING",
      "VOCABULARY",
      "Innovative",
      2.0,
      "",
      "",
      "",
      "",
      "Có tính đổi mới, sáng tạo đột phá",
      "/ˈɪn.ə.və.tɪv/ (adj): featuring new methods; advanced and original.",
      "The tech company is famous for its innovative products.",
    ],
  ],
  WRITING: [
    [
      1,
      "WRITING",
      "WRITING",
      "Write a short paragraph (80-120 words) discussing whether technology enhances or hinders classroom learning.",
      10.0,
      "",
      "",
      "",
      "",
      "Sample response: Technology has revolutionized modern classrooms by providing access to boundless educational resources...",
      "Rubric chấm AI: 1. Task Achievement (80-120 từ, đúng trọng tâm), 2. Coherence & Cohesion, 3. Lexical Resource, 4. Grammatical Range & Accuracy.",
      "",
    ],
  ],
};

// 6 DÒNG MẪU TỔNG HỢP BAO QUÁT 6 STUDIO HỌC TẬP
export const DIVERSE_SAMPLE_ROWS: any[][] = [
  ...SAMPLE_ROWS_BY_SKILL.READING.slice(0, 1),
  ...SAMPLE_ROWS_BY_SKILL.GRAMMAR.slice(1, 2),
  ...SAMPLE_ROWS_BY_SKILL.LISTENING.slice(0, 1),
  ...SAMPLE_ROWS_BY_SKILL.VOCABULARY.slice(0, 1),
  ...SAMPLE_ROWS_BY_SKILL.SPEAKING.slice(0, 1),
  ...SAMPLE_ROWS_BY_SKILL.WRITING.slice(0, 1),
];

/**
 * 1. TẢI FILE EXCEL MẪU THEO KỸ NĂNG ĐANG CHỌN (.XLSX)
 * Xuất file nhị phân chuẩn OpenXML (.xlsx) trực tiếp trên Client bằng SheetJS
 */
export function downloadSkillExcelTemplate(skill: SkillKey = "READING"): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Hướng dẫn
  const wsGuide = XLSX.utils.aoa_to_sheet(GUIDE_SHEET_DATA);
  wsGuide["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 50 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "0_Huong_Dan");

  // Sheet 2: Mẫu nhập bài tập
  const rows = SAMPLE_ROWS_BY_SKILL[skill] || SAMPLE_ROWS_BY_SKILL.READING;
  const wsData = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...rows]);
  wsData["!cols"] = STANDARD_COL_WIDTHS;
  XLSX.utils.book_append_sheet(wb, wsData, `Mau_Giao_Bai_${skill}`);

  // Xuất file chuẩn XLSX nhị phân
  XLSX.writeFile(wb, `Mau_Giao_Bai_Tap_${skill}.xlsx`, { bookType: "xlsx", type: "binary" });
}

/**
 * 2. TẢI FILE EXCEL MẪU TỔNG HỢP TOÀN BỘ KỸ NĂNG (.XLSX)
 * Xuất file nhị phân chuẩn OpenXML (.xlsx) trực tiếp trên Client bằng SheetJS
 */
export function downloadExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Hướng dẫn
  const wsGuide = XLSX.utils.aoa_to_sheet(GUIDE_SHEET_DATA);
  wsGuide["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 50 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "0_Huong_Dan");

  // Sheet 2: Tổng hợp đa dạng các Studio
  const wsAll = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...DIVERSE_SAMPLE_ROWS]);
  wsAll["!cols"] = STANDARD_COL_WIDTHS;
  XLSX.utils.book_append_sheet(wb, wsAll, "Mau_Tong_Hop");

  // Thêm từng Sheet theo kỹ năng riêng biệt để giáo viên tiện soạn theo môn
  const skills: SkillKey[] = ["VOCABULARY", "GRAMMAR", "LISTENING", "READING", "SPEAKING", "WRITING"];
  skills.forEach((sk) => {
    const sRows = SAMPLE_ROWS_BY_SKILL[sk];
    if (sRows && sRows.length > 0) {
      const wsSkill = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...sRows]);
      wsSkill["!cols"] = STANDARD_COL_WIDTHS;
      XLSX.utils.book_append_sheet(wb, wsSkill, `Mau_${sk}`);
    }
  });

  // Xuất file chuẩn XLSX nhị phân
  XLSX.writeFile(wb, "Mau_Giao_Bai_Tap_Chuan.xlsx", { bookType: "xlsx", type: "binary" });
}

/**
 * Đọc file bảng tính Excel/CSV sang mảng Object các dòng (Hỗ trợ quét đa sheet & nhận diện thông minh dòng Header)
 */
export async function readSpreadsheetFile(file: File): Promise<Record<string, any>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) return [];

  const allRows: Record<string, any>[] = [];

  // Lọc các sheet không phải là sheet hướng dẫn chung
  const candidateSheets = workbook.SheetNames.filter((name) => {
    const clean = name.trim().toLowerCase();
    return !(
      clean.includes("huong_dan") ||
      clean.includes("huongdan") ||
      clean.includes("guide") ||
      clean.includes("instruction") ||
      clean.includes("readme")
    );
  });

  const sheetsToScan = candidateSheets.length > 0 ? candidateSheets : workbook.SheetNames;

  for (const sheetName of sheetsToScan) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Quét tìm dòng header thực sự từ dòng 0 đến dòng 10 (kể cả khi dòng 0-1 là banner gộp ô)
    const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
    let headerRowIndex = 0;
    const maxScan = Math.min(10, rawData.length);
    for (let r = 0; r < maxScan; r++) {
      const row = rawData[r] || [];
      const rowStr = row.map((cell) => String(cell || "").toLowerCase()).join(" ");
      const hasQuestion =
        rowStr.includes("câu hỏi") ||
        rowStr.includes("question") ||
        rowStr.includes("nội dung") ||
        rowStr.includes("đề bài") ||
        rowStr.includes("prompt");
      const hasType =
        rowStr.includes("loại") || rowStr.includes("type") || rowStr.includes("dạng");
      const hasAnswer =
        rowStr.includes("đáp án") ||
        rowStr.includes("correct") ||
        rowStr.includes("answer") ||
        rowStr.includes("nghĩa");
      if (hasQuestion && (hasType || hasAnswer)) {
        headerRowIndex = r;
        break;
      }
    }

    const sheetRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      range: headerRowIndex,
      defval: "",
      raw: false,
    });

    // Kiểm tra xem sheet này có dòng dữ liệu câu hỏi thực sự hay không
    const hasData = sheetRows.some((r) => {
      const promptVal = getRowField(r, [
        "Nội dung câu hỏi / Transcript / Đề bài (*)",
        "Nội dung câu hỏi / Câu mẫu Shadowing / Từ vựng (*)",
        "Nội dung câu hỏi",
        "Đề bài / Câu hỏi",
        "Đề bài",
        "Câu hỏi",
        "Question",
        "Prompt",
        "Noi dung cau hoi",
      ]);
      return promptVal.trim().length > 0;
    });

    if (hasData) {
      sheetRows.forEach((r, idx) => {
        r._sheetName = sheetName;
        r._rowNum = headerRowIndex + idx + 2;
      });
      allRows.push(...sheetRows);
    }
  }

  // Fallback nếu allRows vẫn trống
  if (allRows.length === 0) {
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;
      const sheetRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: "",
        raw: false,
      });
      if (sheetRows.length > 0) {
        sheetRows.forEach((r, idx) => {
          r._sheetName = sheetName;
          r._rowNum = idx + 2;
        });
        allRows.push(...sheetRows);
        break;
      }
    }
  }

  return allRows;
}

/**
 * 3. PHÂN TÍCH FILE EXCEL VỚI SMART CORRECT ANSWER, HỖ TRỢ ĐA DẠNG STUDIO VÀ BÁO CÁO LỖI TỪNG DÒNG
 */
export function parseExcelRows(
  rows: Record<string, any>[],
  defaultSkill: SkillKey = "READING",
  defaultSpeakingMode: SpeakingModeKey = "SHADOWING"
): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validQuestionsByGroup = new Map<
    string,
    { skill: SkillKey; speakingMode: SpeakingModeKey; questions: QuestionDraft[]; passage: string; audioUrl: string }
  >();

  // Kế thừa bài đọc / kịch bản nghe liên tiếp cho các câu dùng chung
  const lastPassageBySkill: Record<string, string> = {};
  let totalDataRows = 0;

  rows.forEach((row, idx) => {
    const rowNum = row._rowNum || idx + 2;
    const rowLoc = row._sheetName
      ? `Sheet "${row._sheetName}" - Dòng ${rowNum}`
      : `Dòng ${rowNum}`;

    // 1. Kiểm tra dòng trống hoàn toàn
    const allValues = Object.entries(row)
      .filter(([k]) => !k.startsWith("_"))
      .map(([, v]) => String(v ?? "").trim());
    if (allValues.every((v) => v === "")) {
      return;
    }

    // 2. Trích xuất các trường theo nhiều biến thể tên cột
    const rawSkill = getRowField(row, ["Kỹ năng (*)", "Kỹ năng", "Ky nang", "Skill", "SkillType"]);
    const rawType = getRowField(row, [
      "Loại câu hỏi (*)",
      "Loại câu hỏi",
      "Loại",
      "Dạng câu hỏi",
      "Dang cau hoi",
      "Question Type",
      "QuestionType",
      "Type",
    ]);
    const rawPrompt = getRowField(row, [
      "Nội dung câu hỏi / Transcript / Đề bài (*)",
      "Nội dung câu hỏi / Câu mẫu Shadowing / Từ vựng (*)",
      "Nội dung câu hỏi",
      "Đề bài / Câu hỏi",
      "Đề bài",
      "De bai",
      "Câu hỏi",
      "Question",
      "Prompt",
      "PromptText",
    ]);
    const optA = getRowField(row, ["Lựa chọn A", "Option A", "A", "Phương án A", "Đáp án A", "Choice A"]);
    const optB = getRowField(row, ["Lựa chọn B", "Option B", "B", "Phương án B", "Đáp án B", "Choice B"]);
    const optC = getRowField(row, ["Lựa chọn C", "Option C", "C", "Phương án C", "Đáp án C", "Choice C"]);
    const optD = getRowField(row, ["Lựa chọn D", "Option D", "D", "Phương án D", "Đáp án D", "Choice D"]);
    const rawAnswer = getRowField(row, [
      "Đáp án đúng (*)",
      "Đáp án đúng / Từ điền / Nghĩa ghép cặp (*)",
      "Đáp án đúng",
      "Dap an dung",
      "Correct Answer",
      "CorrectAnswer",
      "Answer",
      "Key",
      "Đáp án",
    ]);
    const rawExplanation = getRowField(row, [
      "Giải thích / Gợi ý chấm AI",
      "Giải thích / Gợi ý chấm AI (Rubric/Hint)",
      "Giải thích",
      "Giai thich",
      "Explanation",
      "Explain",
      "Gợi ý",
      "Rubric",
      "Note",
    ]);
    const rawAudioScript = getRowField(row, [
      "Văn bản đọc TTS (Audio Script)",
      "Văn bản tạo Audio (Kokoro TTS Script)",
      "Văn bản tạo Audio",
      "Audio Script",
      "Kokoro TTS Script",
      "Kokoro TTS",
      "Bài đọc / Kịch bản (Passage/Transcript)",
      "Đoạn văn / Kịch bản (Passage/Transcript)",
      "Passage",
      "Transcript",
      "Bài đọc",
      "Kịch bản nghe",
    ]);
    const rawIpa = getRowField(row, ["Từ khóa / IPA", "Từ vựng / IPA", "IPA", "Target Word", "Word", "Từ khóa", "Từ vựng"]);
    const rawPoints = getRowField(row, ["Điểm (*)", "Điểm số", "Diem so", "Points", "Điểm", "Score"]);

    // 3. Nếu đề bài trống hoàn toàn:
    if (!rawPrompt.trim()) {
      if (!optA && !optB && !rawAnswer) {
        return;
      }
      errors.push(`${rowLoc}: Thiếu nội dung đề bài / câu hỏi.`);
      return;
    }

    totalDataRows++;

    const skill = normalizeSkill(rawSkill, defaultSkill);
    const optionsRaw = [optA, optB, optC, optD].filter((o) => o !== "");
    const questionType = normalizeQuestionType(rawType, optionsRaw.length);

    // Kế thừa bài đọc / kịch bản nghe nếu dòng hiện tại để trống
    let passage = rawAudioScript;
    if (passage) {
      lastPassageBySkill[skill] = passage;
    } else if (lastPassageBySkill[skill]) {
      passage = lastPassageBySkill[skill];
    }

    // 4. NHẬN DIỆN THÔNG MINH ĐÁP ÁN ĐÚNG (SMART ANSWER MATCHING)
    let finalOptions: string[] = [];
    let finalAnswer = rawAnswer.trim();

    if (questionType === "MULTIPLE_CHOICE") {
      if (optionsRaw.length < 2) {
        errors.push(`${rowLoc}: Câu trắc nghiệm cần ít nhất 2 phương án (Lựa chọn A, B).`);
        return;
      }
      finalOptions = [optA, optB, optC, optD].filter((o) => o !== "");

      // Nhận diện chữ cái A, B, C, D hoặc "Đáp án A", "1", "2"
      const ansUpper = finalAnswer.toUpperCase().replace(/[\.\)\(\[\]]/g, "").trim();
      if ((ansUpper === "A" || ansUpper === "1" || ansUpper.includes("ĐÁP ÁN A") || ansUpper.includes("LỰA CHỌN A")) && optA) {
        finalAnswer = optA;
      } else if ((ansUpper === "B" || ansUpper === "2" || ansUpper.includes("ĐÁP ÁN B") || ansUpper.includes("LỰA CHỌN B")) && optB) {
        finalAnswer = optB;
      } else if ((ansUpper === "C" || ansUpper === "3" || ansUpper.includes("ĐÁP ÁN C") || ansUpper.includes("LỰA CHỌN C")) && optC) {
        finalAnswer = optC;
      } else if ((ansUpper === "D" || ansUpper === "4" || ansUpper.includes("ĐÁP ÁN D") || ansUpper.includes("LỰA CHỌN D")) && optD) {
        finalAnswer = optD;
      } else {
        const matched = finalOptions.find(
          (o) => o.toLowerCase().trim() === finalAnswer.toLowerCase()
        );
        if (matched) {
          finalAnswer = matched;
        } else if (!finalAnswer) {
          errors.push(`${rowLoc}: Chưa chọn đáp án đúng cho câu trắc nghiệm.`);
          return;
        } else {
          warnings.push(
            `${rowLoc}: Đáp án "${finalAnswer}" không khớp chính xác với lựa chọn A, B, C, D nào. Đã tạm thời gán vào lựa chọn A.`
          );
          if (!finalOptions.includes(finalAnswer)) {
            finalAnswer = finalOptions[0] || optA;
          }
        }
      }
    } else if (questionType === "MATCHING") {
      finalOptions = [];
      if (!finalAnswer) {
        errors.push(`${rowLoc}: Dạng ghép cặp (MATCHING) yêu cầu phải có nghĩa hoặc cặp ghép ở cột 'Đáp án đúng'.`);
        return;
      }
    } else if (questionType === "TRUE_FALSE") {
      finalOptions = ["TRUE", "FALSE", "NOT GIVEN"];
      const normTf = normalizeTrueFalse(finalAnswer);
      if (normTf) {
        finalAnswer = normTf;
      } else {
        warnings.push(`${rowLoc}: Đáp án True/False "${finalAnswer}" chưa chuẩn. Tự động chuẩn hóa về "TRUE".`);
        finalAnswer = "TRUE";
      }
    } else if (questionType === "FILL_IN_BLANK") {
      if (!finalAnswer) {
        errors.push(`${rowLoc}: Dạng câu hỏi điền từ yêu cầu phải có "Đáp án đúng".`);
        return;
      }
      finalOptions = [];
    } else if (questionType === "AUDIO_RESPONSE") {
      finalOptions = [];
      if (!finalAnswer) {
        finalAnswer = rawPrompt;
      }
    } else if (questionType === "ESSAY") {
      finalOptions = [];
      if (!finalAnswer) {
        finalAnswer = "Sample academic response structure";
      }
    }

    // 5. Xác định chế độ Speaking (QA vs SHADOWING)
    let speakingMode: SpeakingModeKey = defaultSpeakingMode;
    if (skill === "SPEAKING") {
      const isShadowingPrompt =
        rawPrompt.toLowerCase().includes("shadow") ||
        rawPrompt.toLowerCase().includes("nhại") ||
        rawPrompt.toLowerCase().includes("repeat") ||
        rawPrompt.toLowerCase().includes("lặp lại") ||
        rawPrompt.toLowerCase().includes("đọc to") ||
        (rawType && (rawType.toLowerCase().includes("shadow") || rawType.toUpperCase() === "SPEAKING"));
      const isQA =
        (rawType && rawType.toUpperCase().includes("QA")) ||
        rawPrompt.toLowerCase().includes("describe") ||
        rawPrompt.toLowerCase().includes("tell me") ||
        rawPrompt.toLowerCase().includes("what do you think");
      speakingMode = isQA ? "QA" : isShadowingPrompt ? "SHADOWING" : "QA";
    }

    // 6. Điểm số
    const parsedPoints = parseFloat(rawPoints);
    const points = !isNaN(parsedPoints) && parsedPoints > 0 ? parsedPoints : skill === "WRITING" ? 10.0 : skill === "SPEAKING" ? 5.0 : 2.0;

    // 7. Tạo QuestionDraft chuẩn
    const qDraft: QuestionDraft = {
      id: `q-excel-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      prompt: rawPrompt,
      questionType,
      options: finalOptions,
      correctAnswer: finalAnswer,
      explanation: rawExplanation,
      transcript: passage || rawAudioScript || undefined,
      ipa: rawIpa,
      targetWord: questionType === "MATCHING" ? rawPrompt : rawIpa.split("|")[0]?.trim() || "",
      points,
    };

    // 8. Gom nhóm theo kỹ năng (ImportGroup)
    const grpKey = groupKeyOf(skill, speakingMode);
    if (!validQuestionsByGroup.has(grpKey)) {
      validQuestionsByGroup.set(grpKey, {
        skill,
        speakingMode,
        questions: [],
        passage: passage || "",
        audioUrl: "",
      });
    }
    const currentGroup = validQuestionsByGroup.get(grpKey)!;
    currentGroup.questions.push(qDraft);
    if (!currentGroup.passage && passage) {
      currentGroup.passage = passage;
    }
  });

  const groups: ImportGroup[] = Array.from(validQuestionsByGroup.entries()).map(
    ([key, val]) => ({
      key,
      skill: val.skill,
      speakingMode: val.speakingMode,
      label: val.skill === "SPEAKING" ? `Speaking (${val.speakingMode})` : val.skill,
      questions: val.questions,
      passage: val.passage,
      audioUrl: val.audioUrl,
    })
  );

  const importedCount = groups.reduce((acc, g) => acc + g.questions.length, 0);

  return {
    groups,
    report: {
      source: "EXCEL",
      totalRows: totalDataRows,
      imported: importedCount,
      errors,
      warnings,
    },
  };
}

/**
 * 4. BỘ PHÂN TÍCH CÚ PHÁP VĂN BẢN THÔ (RAW TEXT PARSER)
 */
export function parseRawText(
  rawText: string,
  defaultSkill: SkillKey = "READING",
  defaultSpeakingMode: SpeakingModeKey = "SHADOWING"
): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const text = rawText.trim();

  if (!text) {
    return {
      groups: [],
      report: {
        source: "TEXT",
        totalRows: 0,
        imported: 0,
        errors: ["Nội dung văn bản thô đang để trống."],
        warnings: [],
      },
    };
  }

  let passage = "";
  let cleanText = text;

  const passageMatch = text.match(
    /(?:\[(?:Bài đọc|Bai doc|Passage|Reading Passage|Kịch bản|Kich ban|Transcript|Audio Script)\]|\b(?:Bài đọc|Passage|Transcript):)([\s\S]*?)(?=(?:\[(?:Câu hỏi|Questions?)\]|(?:Câu|Question)\s*1[:\.]|\n\s*1[\.\)])|$)/i
  );

  if (passageMatch && passageMatch[1]) {
    passage = passageMatch[1].trim();
    cleanText = text.replace(passageMatch[0], "").trim();
  }

  const questionSplitRegex = /(?:^|\n+)(?=(?:(?:Câu|Question)\s*\d+[:\.]?|\d+[\.\/\)]\s+))/i;
  const rawBlocks = cleanText
    .split(questionSplitRegex)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const parsedQuestions: QuestionDraft[] = [];

  rawBlocks.forEach((block, idx) => {
    let prompt = "";
    const promptMatch = block.match(
      /^(?:(?:Câu|Question)\s*\d+[:\.]?|\d+[\.\/\)])\s*([^\n\r]+)/i
    );
    if (promptMatch && promptMatch[1]) {
      prompt = promptMatch[1].trim();
    }

    if (!prompt) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      prompt = lines[0]?.replace(/^(?:(?:Câu|Question)\s*\d+[:\.]?|\d+[\.\/\)])\s*/i, "") || "";
    }

    if (!prompt) {
      errors.push(`Khối câu hỏi ${idx + 1}: Không tìm thấy đề bài hợp lệ.`);
      return;
    }

    const options: string[] = [];
    const optRegex = /(?:^|\n+)\s*(?:([A-D])[.)]|\(([A-D])\)|\[([A-D])\])\s*([^\n\r]+)/gi;
    const optMatches = Array.from(block.matchAll(optRegex));

    optMatches.forEach((m) => {
      let optText = (m[4] || "").trim();
      optText = optText.replace(/\s*(?:Đáp án|Dap an|Answer|Key)[:\s]+.+$/i, "").trim();
      if (optText) options.push(optText);
    });

    let answer = "";
    const ansMatch = block.match(
      /(?:^|\n+)\s*(?:Đáp án|Dap an|Answer|Key)[:\s]+([^\n\r]+)/i
    );
    if (ansMatch && ansMatch[1]) {
      answer = ansMatch[1].trim();
    }

    let explanation = "";
    const expMatch = block.match(
      /(?:^|\n+)\s*(?:Giải thích|Giai thich|Explanation|Explain)[:\s]+([^\n\r]+)/i
    );
    if (expMatch && expMatch[1]) {
      explanation = expMatch[1].trim();
    }

    let ipa = "";
    let targetWord = "";
    const ipaMatch = block.match(
      /(?:\[(?:Từ vựng|Tu vung|IPA|Word|Từ khóa):?\s*([^\]]+)\]|(?:IPA|Từ khóa)[:\s]+([^\n\r]+))/i
    );
    if (ipaMatch) {
      const rawIpaStr = (ipaMatch[1] || ipaMatch[2] || "").trim();
      ipa = rawIpaStr;
      targetWord = rawIpaStr.split("|")[0]?.trim() || "";
    }

    const hasBlanks = prompt.includes("______") || prompt.includes("___") || prompt.includes("[...]");
    let questionType: QuestionDraft["questionType"] = "MULTIPLE_CHOICE";

    if (options.length >= 2) {
      questionType = "MULTIPLE_CHOICE";
      const ansLetter = answer.toUpperCase().replace(/[\.\)\(\[\]]/g, "").trim();
      if (ansLetter === "A" && options[0]) {
        answer = options[0];
      } else if (ansLetter === "B" && options[1]) {
        answer = options[1];
      } else if (ansLetter === "C" && options[2]) {
        answer = options[2];
      } else if (ansLetter === "D" && options[3]) {
        answer = options[3];
      } else if (!answer) {
        answer = options[0];
      }
    } else {
      const tfVal = normalizeTrueFalse(answer || prompt);
      if (tfVal) {
        questionType = "TRUE_FALSE";
        answer = tfVal;
      } else if (hasBlanks) {
        questionType = "FILL_IN_BLANK";
      } else if (defaultSkill === "SPEAKING") {
        questionType = "AUDIO_RESPONSE";
        if (!answer) answer = prompt;
      } else if (defaultSkill === "WRITING") {
        questionType = "ESSAY";
        if (!answer) answer = "Sample response";
      } else {
        questionType = "FILL_IN_BLANK";
      }
    }

    parsedQuestions.push({
      id: `q-regex-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      prompt,
      questionType,
      options: questionType === "TRUE_FALSE" ? ["TRUE", "FALSE", "NOT GIVEN"] : options,
      correctAnswer: answer,
      explanation,
      transcript: passage,
      ipa,
      targetWord,
      points: defaultSkill === "WRITING" ? 10.0 : defaultSkill === "SPEAKING" ? 5.0 : 2.0,
    });
  });

  const skill = defaultSkill;
  const speakingMode = defaultSpeakingMode;
  const grpKey = groupKeyOf(skill, speakingMode);

  const groups: ImportGroup[] = parsedQuestions.length > 0
    ? [
        {
          key: grpKey,
          skill,
          speakingMode,
          label: skill === "SPEAKING" ? `Speaking (${speakingMode})` : skill,
          questions: parsedQuestions,
          passage,
          audioUrl: "",
        },
      ]
    : [];

  return {
    groups,
    report: {
      source: "TEXT",
      totalRows: rawBlocks.length,
      imported: parsedQuestions.length,
      errors,
      warnings,
    },
  };
}
