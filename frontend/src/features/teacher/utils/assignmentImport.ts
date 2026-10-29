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

  // 1. True / False / Not Given
  if (t.includes("TRUE") || t.includes("FALSE") || t.includes("NOT GIVEN") || t.includes("ĐÚNG SAI") || t.includes("DUNG SAI")) {
    return "TRUE_FALSE";
  }

  // 2. Error identification -> Map sang Multiple Choice
  if (t.includes("ERROR") || t.includes("LỖI") || t.includes("LOI")) {
    return "MULTIPLE_CHOICE";
  }

  // 3. Điền từ, chia động từ, viết lại câu, sentence transformation
  if (
    t.includes("BLANK") ||
    t.includes("FILL") ||
    t.includes("ĐIỀN") ||
    t.includes("DIEN") ||
    t.includes("CLOZE") ||
    t.includes("GAP") ||
    t.includes("DICTATION") ||
    t.includes("TRANSFORMATION") ||
    t.includes("VIẾT LẠI") ||
    t.includes("VIET LAI") ||
    t.includes("SẮP XẾP") ||
    t.includes("SAP XEP")
  ) {
    return "FILL_IN_BLANK";
  }

  // 4. Nói, phát âm, Shadowing, Audio response
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

  // 5. Viết luận Essay
  if (t.includes("ESSAY") || t.includes("VIẾT") || t.includes("PARAGRAPH") || t.includes("TASK") || t.includes("BÀI LUẬN") || t.includes("BAI LUAN")) {
    return "ESSAY";
  }

  // 6. Flashcard từ vựng (Fallback tự động về MULTIPLE_CHOICE theo yêu cầu)
  if (t.includes("FLASHCARD")) {
    return "MULTIPLE_CHOICE";
  }
  if (t.includes("TỪ VỰNG") || t.includes("TU VUNG")) {
    return optionsCount >= 2 ? "MULTIPLE_CHOICE" : "FILL_IN_BLANK";
  }

  // 7. Trắc nghiệm Multiple Choice
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

// 13 CỘT TIÊU ĐỀ CHUẨN ĐỒNG NHẤT
export const EXCEL_HEADERS = [
  "STT",
  "Kỹ năng",
  "Dạng câu hỏi",
  "Đề bài / Câu hỏi",
  "Lựa chọn A",
  "Lựa chọn B",
  "Lựa chọn C",
  "Lựa chọn D",
  "Đáp án đúng",
  "Giải thích",
  "Bài đọc / Kịch bản (Passage/Transcript)",
  "Từ khóa / IPA",
  "Điểm số",
];

// CẤU HÌNH ĐỘ RỘNG CỘT TỰ ĐỘNG (!cols)
export const STANDARD_COL_WIDTHS = [
  { wch: 6 },  // STT
  { wch: 15 }, // Kỹ năng
  { wch: 24 }, // Dạng câu hỏi
  { wch: 48 }, // Đề bài / Câu hỏi
  { wch: 28 }, // Lựa chọn A
  { wch: 28 }, // Lựa chọn B
  { wch: 28 }, // Lựa chọn C
  { wch: 28 }, // Lựa chọn D
  { wch: 30 }, // Đáp án đúng
  { wch: 38 }, // Giải thích
  { wch: 55 }, // Bài đọc / Kịch bản
  { wch: 28 }, // Từ khóa / IPA
  { wch: 10 }, // Điểm số
];

// DỮ LIỆU SHEET HƯỚNG DẪN 0_Huong_Dan_Chung
export const GUIDE_SHEET_DATA: (string | number)[][] = [
  ["HƯỚNG DẪN QUY CHUẨN NHẬP DỮ LIỆU BÀI TẬP BẰNG FILE EXCEL (.XLSX)"],
  ["Hệ thống hỗ trợ tự động nhận diện tất cả 6 Kỹ năng và các dạng bài tập tương ứng trong nền tảng English Learning."],
  [""],
  ["1. Ý NGHĨA VÀ QUY CÁCH ĐIỀN 13 CỘT DỮ LIỆU CHUẨN:"],
  ["STT", "Tên Cột", "Tính Chất", "Mô Tả & Quy Cách Điền", "Áp Dụng Cho Dạng Bài"],
  [1, "STT", "Tùy chọn", "Số thứ tự dòng (1, 2, 3...) để dễ quản lý trong bảng tính.", "Tất cả các dạng"],
  [2, "Kỹ năng", "Bắt buộc", "Mã kỹ năng chuẩn: VOCABULARY, GRAMMAR, LISTENING, READING, SPEAKING, WRITING.", "Tất cả các dạng"],
  [3, "Dạng câu hỏi", "Bắt buộc", "Mã dạng: MULTIPLE_CHOICE, FILL_IN_BLANK, TRUE_FALSE, AUDIO_RESPONSE, ESSAY (hoặc alias: SHADOWING, ERROR_IDENTIFICATION, SENTENCE_TRANSFORMATION).", "Tất cả các dạng"],
  [4, "Đề bài / Câu hỏi", "Bắt buộc", "Nội dung câu hỏi hoặc yêu cầu bài làm. Câu điền từ dùng ký hiệu '______'. Câu tìm lỗi sai đánh dấu các vị trí (A), (B), (C), (D).", "Tất cả các dạng"],
  [5, "Lựa chọn A", "Theo dạng", "BẮT BUỘC cho câu Trắc nghiệm & Tìm lỗi sai (tối thiểu phương án A, B). ĐỂ TRỐNG cho bài Điền từ, Viết luận, Nói.", "Trắc nghiệm, Tìm lỗi sai"],
  [6, "Lựa chọn B", "Theo dạng", "Phương án B. BẮT BUỘC cho câu Trắc nghiệm.", "Trắc nghiệm, Tìm lỗi sai"],
  [7, "Lựa chọn C", "Theo dạng", "Phương án C. Thường dùng cho câu Trắc nghiệm 3-4 phương án.", "Trắc nghiệm, Tìm lỗi sai"],
  [8, "Lựa chọn D", "Theo dạng", "Phương án D. Thường dùng cho câu Trắc nghiệm 4 phương án.", "Trắc nghiệm, Tìm lỗi sai"],
  [9, "Đáp án đúng", "Bắt buộc", "Trắc nghiệm: có thể ghi chữ cái 'A', 'B', 'C', 'D' HOẶC ghi trọn vẹn text phương án đúng. True/False: ghi 'TRUE', 'FALSE' hoặc 'NOT GIVEN'. Điền từ: ghi từ/cụm từ cần điền. Shadowing: ghi lại câu mẫu.", "Tất cả các dạng"],
  [10, "Giải thích", "Khuyến khích", "Lời giải thích chi tiết, mẹo ngữ pháp, phiên âm và quy tắc nối âm, hoặc dàn ý gợi ý & tiêu chí chấm cho bài Viết/Nói.", "Tất cả các dạng"],
  [11, "Bài đọc / Kịch bản (Passage/Transcript)", "Kế thừa", "Đoạn văn bài đọc (Reading Passage) hoặc kịch bản nghe liên tục (Listening Script). MẸO: Nếu nhiều câu hỏi chung 1 bài đọc/nghe, CHỈ CẦN ĐIỀN Ở CÂU ĐẦU TIÊN, các câu sau để trống hệ thống sẽ tự động kế thừa!", "Reading, Listening, Shadowing"],
  [12, "Từ khóa / IPA", "Tùy chọn", "Từ vựng mục tiêu kèm ký âm quốc tế IPA (VD: enormous | /ɪˈnɔːməs/). Dùng cho kỹ năng Vocabulary và Speaking Shadowing.", "Vocabulary, Speaking Shadowing"],
  [13, "Điểm số", "Tùy chọn", "Điểm số của câu (mặc định 2.5 nếu để trống; Speaking/Writing thường là 5.0 hoặc 10.0).", "Tất cả các dạng"],
  [""],
  ["2. BẢNG MÃ KỸ NĂNG VÀ DẠNG CÂU HỎI TƯƠNG ỨNG:"],
  ["Kỹ Năng", "Mã Kỹ Năng", "Dạng Bài Tập Hỗ Trợ", "Ghi Chú Chi Tiết"],
  ["Từ vựng", "VOCABULARY", "MULTIPLE_CHOICE, FILL_IN_BLANK, AUDIO_RESPONSE", "Có thể điền cột 'Từ khóa / IPA' để luyện phát âm US Native và nhận diện giọng nói AI."],
  ["Ngữ pháp", "GRAMMAR", "MULTIPLE_CHOICE, FILL_IN_BLANK, ERROR_IDENTIFICATION", "Hỗ trợ chia động từ, trắc nghiệm cấu trúc và tìm lỗi sai trong câu."],
  ["Nghe hiểu", "LISTENING", "MULTIPLE_CHOICE, FILL_IN_BLANK, TRUE_FALSE", "Điền lời thoại vào cột 'Bài đọc / Kịch bản' để hệ thống tự động sinh audio Neural TTS."],
  ["Đọc hiểu", "READING", "MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_BLANK", "Điền đoạn văn dài vào cột 'Bài đọc / Kịch bản'. Hiển thị cố định ở đầu bài làm."],
  ["Nói & Phát âm", "SPEAKING", "SHADOWING, AUDIO_RESPONSE", "Shadowing luyện câu mẫu; Audio Response trả lời chủ đề phỏng vấn mở."],
  ["Kỹ năng Viết", "WRITING", "ESSAY, SENTENCE_TRANSFORMATION, FILL_IN_BLANK", "Essay viết đoạn văn/bài luận; Sentence Transformation viết lại câu hoàn chỉnh."],
  [""],
  ["3. LƯU Ý KHI SỬ DỤNG:"],
  ["• Bạn có thể nhập dữ liệu vào Sheet Kỹ năng tương ứng trong file này hoặc gộp chung vào 1 Sheet."],
  ["• Hệ thống sẽ tự động bỏ qua Sheet '0_Huong_Dan_Chung' này khi phân tích dữ liệu, bạn không cần phải xóa sheet này."],
  ["• Với câu hỏi trắc nghiệm, cột Đáp án đúng chỉ cần gõ chữ cái 'A' hoặc 'B' hoặc 'C' hoặc 'D', hệ thống tự động đối chiếu nội dung lựa chọn tương ứng."],
  ["• Hỗ trợ định dạng file: .xlsx, .xls, .csv."],
];

// CÁC DÒNG DỮ LIỆU MẪU THEO TỪNG KỸ NĂNG VÀ DẠNG BÀI CỤ THỂ
export const SAMPLE_ROWS_BY_SKILL: Record<SkillKey, any[][]> = {
  VOCABULARY: [
    [
      1,
      "VOCABULARY",
      "MULTIPLE_CHOICE",
      "Choose the word CLOSEST in meaning to 'enormous' in the sentence: 'The startup received an enormous funding round from venture capitalists.'",
      "huge",
      "tiny",
      "fragile",
      "obscure",
      "A",
      "'enormous' mang nghĩa to lớn, khổng lồ, đồng nghĩa với 'huge' hoặc 'immense'.",
      "",
      "enormous | /ɪˈnɔːməs/",
      2.5,
    ],
    [
      2,
      "VOCABULARY",
      "FILL_IN_BLANK",
      "Her remarkable ______ (creativity) was unanimously recognized by all project evaluators.",
      "",
      "",
      "",
      "",
      "creativity",
      "Sau tính từ 'remarkable' cần một danh từ: 'creativity' (sự sáng tạo).",
      "",
      "creativity | /ˌkriː.eɪˈtɪv.ə.t̬i/",
      2.5,
    ],
  ],
  GRAMMAR: [
    [
      1,
      "GRAMMAR",
      "MULTIPLE_CHOICE",
      "Neither the senior architect nor the system engineers ______ aware of the critical database migration yesterday.",
      "was",
      "were",
      "is",
      "are",
      "B",
      "Quy tắc hòa hợp chủ vị 'Neither... nor...': Động từ chia theo danh từ gần nhất ('the system engineers' là số nhiều trong quá khứ -> 'were').",
      "",
      "",
      2.5,
    ],
    [
      2,
      "GRAMMAR",
      "FILL_IN_BLANK",
      "If the security team ______ (inspect) the access logs yesterday, the data breach would have been prevented.",
      "",
      "",
      "",
      "",
      "had inspected",
      "Câu điều kiện loại 3 (Third Conditional): If + S + had + V3/ed, S + would have + V3/ed (giả định trái ngược quá khứ).",
      "",
      "",
      2.5,
    ],
    [
      3,
      "GRAMMAR",
      "ERROR_IDENTIFICATION",
      "Although (A) the severe weather conditions, the search-and-rescue team managed (B) to locate (C) the lost hikers safely (D).",
      "Although",
      "managed",
      "to locate",
      "safely",
      "A",
      "Lỗi sai ở vị trí (A) 'Although'. Vì đứng trước một cụm danh từ ('the severe weather conditions'), ta phải dùng giới từ 'Despite' hoặc 'In spite of' thay vì liên từ 'Although'.",
      "",
      "",
      2.5,
    ],
  ],
  LISTENING: [
    [
      1,
      "LISTENING",
      "MULTIPLE_CHOICE",
      "What primary engineering challenge in offshore wind energy does Dr. Aris highlight in his symposium address?",
      "High turbine blade manufacturing costs",
      "Saltwater corrosion and long-distance transmission losses",
      "Shortage of qualified marine electrical technicians",
      "Public opposition from regional coastal tourism",
      "B",
      "Tiến sĩ Aris nhấn mạnh: 'Our foremost technical hurdle is mitigating saltwater galvanic corrosion and reducing long-distance high-voltage transmission losses across subsea power lines.'",
      "Dr. Aris: Good morning delegates and welcome to the Renewable Energy Summit. Today I want to focus on offshore wind farms. Our foremost technical hurdle is mitigating saltwater galvanic corrosion and reducing long-distance high-voltage transmission losses across subsea power lines. To combat this, our multidisciplinary team engineered an advanced zinc-alloy protective coating that successfully repels marine salt crusts.",
      "",
      2.5,
    ],
    [
      2,
      "LISTENING",
      "FILL_IN_BLANK",
      "The multidisciplinary team introduced an advanced zinc-alloy coating to minimize ______ on marine wind structures.",
      "",
      "",
      "",
      "",
      "corrosion",
      "Trong bài nghe, diễn giả phát âm rõ ràng: 'engineered an advanced zinc-alloy protective coating that successfully repels marine salt crusts to minimize corrosion'.",
      "",
      "corrosion | /kəˈroʊ.ʒən/",
      2.5,
    ],
    [
      3,
      "LISTENING",
      "TRUE_FALSE",
      "Dr. Aris claims that high-voltage subsea power lines have already eliminated all transmission losses entirely.",
      "TRUE",
      "FALSE",
      "NOT GIVEN",
      "",
      "FALSE",
      "Bài nghe khẳng định transmission losses (hao hụt truyền tải) vẫn là một 'foremost technical hurdle' (thách thức kỹ thuật hàng đầu), chưa hề được loại bỏ hoàn toàn -> FALSE.",
      "",
      "",
      2.5,
    ],
  ],
  READING: [
    [
      1,
      "READING",
      "MULTIPLE_CHOICE",
      "According to paragraph 1, what fundamental property enables quantum computers to solve complex problems exponentially faster than classical supercomputers?",
      "Qubits consume zero electrical energy during computation.",
      "Qubits can exploit superposition to exist in combinations of both 0 and 1 simultaneously.",
      "Classical bits function considerably faster in low-temperature biological environments.",
      "Classical bits store infinite numerical states using optical light pulses.",
      "B",
      "Đoạn 1 nêu rõ: 'In stark contrast, quantum systems harness quantum bits, or qubits, exploiting the quantum mechanical principle of superposition to exist in combinations of both states simultaneously.'",
      "Quantum computing represents a fundamental paradigm shift in information processing. Traditional computers utilize binary bits, which exist in one of two definite states: 0 or 1. In stark contrast, quantum systems harness quantum bits, or qubits, exploiting the quantum mechanical principle of superposition to exist in combinations of both states simultaneously. This fundamental characteristic enables quantum architectures to evaluate vast combinatorial possibilities exponentially faster than the most capable silicon supercomputers.",
      "",
      2.5,
    ],
    [
      2,
      "READING",
      "TRUE_FALSE",
      "Traditional silicon supercomputers can evaluate complex combinatorial problems just as fast as quantum computers.",
      "TRUE",
      "FALSE",
      "NOT GIVEN",
      "",
      "FALSE",
      "Bài đọc nêu rõ quantum architectures giải bài toán tổ hợp 'exponentially faster' (nhanh hơn theo hàm mũ) so với silicon supercomputers -> Đáp án là FALSE.",
      "",
      "",
      2.5,
    ],
    [
      3,
      "READING",
      "FILL_IN_BLANK",
      "Quantum computers exploit the physical principle known as ______ to evaluate immense combinatorial possibilities simultaneously.",
      "",
      "",
      "",
      "",
      "superposition",
      "Dựa vào đoạn văn: 'exploiting the quantum mechanical principle of superposition to exist in combinations of both states simultaneously'.",
      "",
      "superposition | /ˌsuː.pɚ.pəˈzɪʃ.ən/",
      2.5,
    ],
  ],
  SPEAKING: [
    [
      1,
      "SPEAKING",
      "SHADOWING",
      "Continuous practice empowers learners to speak with unwavering confidence.",
      "",
      "",
      "",
      "",
      "Continuous practice empowers learners to speak with unwavering confidence.",
      "Luyện tập ngữ điệu xuống ở cuối câu trần thuật. Chú ý trọng âm các từ: conTINuous, emPOWers, unWAvering, CONfidence. Nối âm mượt mà giữa 'empowers' và 'learners'.",
      "Continuous practice empowers learners to speak with unwavering confidence.",
      "confidence | /ˈkɑːn.fɪ.dəns/",
      5.0,
    ],
    [
      2,
      "SPEAKING",
      "AUDIO_RESPONSE",
      "Describe an environmentally friendly initiative in your local community that you admire. You should speak for 1 to 2 minutes.",
      "",
      "",
      "",
      "",
      "Sample Outline: 1. Overview of the community tree-planting program; 2. Youth volunteer leadership and local resident participation; 3. Long-term impacts: lowered urban temperatures and reinforced community solidarity.",
      "Thời lượng nói yêu cầu: 1 - 2 phút. AI sẽ chấm điểm dựa trên độ trôi chảy (Fluency), phát âm (Pronunciation), vốn từ vựng (Lexical Resource) và độ chính xác ngữ pháp (Grammar).",
      "",
      "",
      5.0,
    ],
  ],
  WRITING: [
    [
      1,
      "WRITING",
      "ESSAY",
      "Some educators argue that artificial intelligence tools should be banned in classrooms, while others believe they enhance personalized education. Discuss both views and give your opinion. (Write at least 250 words).",
      "",
      "",
      "",
      "",
      "Sample Academic Response Structure: Paragraph 1: Introduction & Thesis Statement; Paragraph 2: Arguments regarding academic integrity and over-reliance risks; Paragraph 3: Benefits of adaptive tutoring and customized learning pace; Paragraph 4: Balanced conclusion advocating ethical AI integration.",
      "Yêu cầu tối thiểu: 250 từ. Tiêu chí chấm AI: Task Response (trả lời đầy đủ 2 quan điểm + nêu rõ lập trường), Coherence & Cohesion (mạch lạc, liên kết câu), Lexical Resource (từ vựng C1), Grammatical Range & Accuracy.",
      "",
      "",
      10.0,
    ],
    [
      2,
      "WRITING",
      "SENTENCE_TRANSFORMATION",
      "Complete the second sentence so that it has a similar meaning: 'They started constructing the renewable energy facility two years ago.' -> 'The renewable energy facility has ______.'",
      "",
      "",
      "",
      "",
      "been under construction for two years",
      "Chuyển đổi từ thì Quá khứ đơn 'started constructing... two years ago' sang cấu trúc Hiện tại hoàn thành với cụm giới từ 'has been under construction for two years'.",
      "",
      "",
      5.0,
    ],
  ],
};

function createSkillWorksheet(rows: any[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...rows]);
  ws["!cols"] = STANDARD_COL_WIDTHS;
  return ws;
}

/**
 * 1. XUẤT FILE EXCEL MẪU TRỌN BỘ 7 SHEETS CHUẨN ĐẦY ĐỦ TẤT CẢ KỸ NĂNG (.XLSX)
 */
export function downloadExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 0_Huong_Dan_Chung
  const wsGuide = XLSX.utils.aoa_to_sheet(GUIDE_SHEET_DATA);
  wsGuide["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 65 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "0_Huong_Dan_Chung");

  // Sheet 2: 1_Tu_Vung_Vocabulary
  XLSX.utils.book_append_sheet(wb, createSkillWorksheet(SAMPLE_ROWS_BY_SKILL.VOCABULARY), "1_Tu_Vung_Vocabulary");

  // Sheet 3: 2_Ngu_Phap_Grammar
  XLSX.utils.book_append_sheet(wb, createSkillWorksheet(SAMPLE_ROWS_BY_SKILL.GRAMMAR), "2_Ngu_Phap_Grammar");

  // Sheet 4: 3_Nghe_Listening
  XLSX.utils.book_append_sheet(wb, createSkillWorksheet(SAMPLE_ROWS_BY_SKILL.LISTENING), "3_Nghe_Listening");

  // Sheet 5: 4_Doc_Reading
  XLSX.utils.book_append_sheet(wb, createSkillWorksheet(SAMPLE_ROWS_BY_SKILL.READING), "4_Doc_Reading");

  // Sheet 6: 5_Noi_Phat_Am_Speaking
  XLSX.utils.book_append_sheet(wb, createSkillWorksheet(SAMPLE_ROWS_BY_SKILL.SPEAKING), "5_Noi_Phat_Am_Speaking");

  // Sheet 7: 6_Viet_Writing
  XLSX.utils.book_append_sheet(wb, createSkillWorksheet(SAMPLE_ROWS_BY_SKILL.WRITING), "6_Viet_Writing");

  XLSX.writeFile(wb, "Mau_Nhap_Bai_Tap_Tat_Ca_Ky_Nang.xlsx");
}

/**
 * XUẤT FILE EXCEL MẪU THEO KỸ NĂNG ĐANG CHỌN (GỒM HƯỚNG DẪN + SHEET KỸ NĂNG TƯƠNG ỨNG)
 */
export function downloadSkillExcelTemplate(skill: SkillKey = "READING"): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 0_Huong_Dan_Chung
  const wsGuide = XLSX.utils.aoa_to_sheet(GUIDE_SHEET_DATA);
  wsGuide["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 65 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "0_Huong_Dan_Chung");

  // Sheet 2: Mau_${skill}
  const rows = SAMPLE_ROWS_BY_SKILL[skill] || SAMPLE_ROWS_BY_SKILL.READING;
  XLSX.utils.book_append_sheet(wb, createSkillWorksheet(rows), `Mau_${skill}`);

  XLSX.writeFile(wb, `Mau_Nhap_Bai_Tap_${skill}.xlsx`);
}

/**
 * Đọc file bảng tính Excel/CSV sang mảng Object các dòng (Hỗ trợ quét đa sheet thông minh)
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
    const sheetRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: "",
      raw: false,
    });

    // Kiểm tra xem sheet này có dòng dữ liệu câu hỏi thực sự hay không
    const hasData = sheetRows.some((r) => {
      const promptVal = getRowField(r, [
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
        r._rowNum = idx + 2; // Dòng 1 là Header
      });
      allRows.push(...sheetRows);
    }
  }

  // Fallback: nếu allRows vẫn trống (ví dụ file chỉ có 1 sheet duy nhất dù tên gì)
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
 * 2. BƯỚC 2: PHÂN TÍCH FILE EXCEL VỚI SMART CORRECT ANSWER VÀ BÁO CÁO LỖI TỪNG DÒNG
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
    totalDataRows++;

    // 2. Trích xuất các trường theo nhiều biến thể tên cột
    const rawSkill = getRowField(row, ["Kỹ năng", "Ky nang", "Skill", "SkillType"]);
    const rawType = getRowField(row, ["Dạng câu hỏi", "Dang cau hoi", "Question Type", "QuestionType", "Type", "Loại câu hỏi"]);
    const rawPrompt = getRowField(row, ["Đề bài / Câu hỏi", "Đề bài", "De bai", "Câu hỏi", "Question", "Prompt", "PromptText"]);
    const optA = getRowField(row, ["Lựa chọn A", "Option A", "A", "Phương án A", "Đáp án A", "Choice A"]);
    const optB = getRowField(row, ["Lựa chọn B", "Option B", "B", "Phương án B", "Đáp án B", "Choice B"]);
    const optC = getRowField(row, ["Lựa chọn C", "Option C", "C", "Phương án C", "Đáp án C", "Choice C"]);
    const optD = getRowField(row, ["Lựa chọn D", "Option D", "D", "Phương án D", "Đáp án D", "Choice D"]);
    const rawAnswer = getRowField(row, ["Đáp án đúng", "Dap an dung", "Correct Answer", "CorrectAnswer", "Answer", "Key", "Đáp án"]);
    const rawExplanation = getRowField(row, ["Giải thích", "Giai thich", "Explanation", "Explain", "Gợi ý", "Note"]);
    const rawPassage = getRowField(row, [
      "Bài đọc / Kịch bản (Passage/Transcript)",
      "Đoạn văn / Kịch bản (Passage/Transcript)",
      "Đoạn văn / Kịch bản",
      "Passage",
      "Transcript",
      "Bài đọc",
      "Kịch bản nghe",
      "Listening Script",
      "Kịch bản",
    ]);
    const rawIpa = getRowField(row, ["Từ khóa / IPA", "Từ vựng / IPA", "IPA", "Target Word", "Word", "Từ khóa", "Từ vựng"]);
    const rawPoints = getRowField(row, ["Điểm số", "Diem so", "Points", "Điểm", "Score"]);

    // 3. Kiểm tra tính hợp lệ tối thiểu của đề bài
    if (!rawPrompt) {
      errors.push(`${rowLoc}: Thiếu nội dung đề bài / câu hỏi.`);
      return;
    }

    const skill = normalizeSkill(rawSkill, defaultSkill);
    const optionsRaw = [optA, optB, optC, optD].filter((o) => o !== "");
    const questionType = normalizeQuestionType(rawType, optionsRaw.length);

    // Kế thừa bài đọc / kịch bản nếu dòng hiện tại để trống
    let passage = rawPassage;
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

      // Nếu giáo viên ghi A, B, C, D (hoặc A., B), (A)) -> tự động gán text của option tương ứng
      const ansUpper = finalAnswer.toUpperCase().replace(/[\.\)\(\[\]]/g, "").trim();
      if (ansUpper === "A" && optA) {
        finalAnswer = optA;
      } else if (ansUpper === "B" && optB) {
        finalAnswer = optB;
      } else if (ansUpper === "C" && optC) {
        finalAnswer = optC;
      } else if (ansUpper === "D" && optD) {
        finalAnswer = optD;
      } else {
        // Nếu ghi trực tiếp text đáp án, kiểm tra xem có khớp phương án nào không
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
        finalAnswer = "Sample high-band academic response structure";
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
        (rawType && rawType.toLowerCase().includes("shadow"));
      speakingMode = isShadowingPrompt ? "SHADOWING" : "QA";
    }

    // 6. Điểm số
    const parsedPoints = parseFloat(rawPoints);
    const points = !isNaN(parsedPoints) && parsedPoints > 0 ? parsedPoints : skill === "WRITING" ? 10.0 : skill === "SPEAKING" ? 5.0 : 2.5;

    // 7. Tạo QuestionDraft chuẩn
    const qDraft: QuestionDraft = {
      id: `q-excel-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      prompt: rawPrompt,
      questionType,
      options: finalOptions,
      correctAnswer: finalAnswer,
      explanation: rawExplanation,
      transcript: passage,
      ipa: rawIpa,
      targetWord: rawIpa.split("|")[0]?.trim() || "",
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
 * 3. BƯỚC 3: XÂY DỰNG BỘ PHÂN TÍCH CÚ PHÁP VĂN BẢN THÔ TỨC THÌ (INSTANT REGEX TEXT PARSER)
 * Hoạt động thuần túy client-side trong < 10ms, không phụ thuộc vào Gemini AI.
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

  // Tách đoạn văn bài đọc / kịch bản nghe nếu có đánh dấu [Passage], [Bài đọc], [Transcript]
  let passage = "";
  let cleanText = text;

  const passageMatch = text.match(
    /(?:\[(?:Bài đọc|Bai doc|Passage|Reading Passage|Kịch bản|Kich ban|Transcript|Audio Script)\]|\b(?:Bài đọc|Passage|Transcript):)([\s\S]*?)(?=(?:\[(?:Câu hỏi|Questions?)\]|(?:Câu|Question)\s*1[:\.]|\n\s*1[\.\)])|$)/i
  );

  if (passageMatch && passageMatch[1]) {
    passage = passageMatch[1].trim();
    cleanText = text.replace(passageMatch[0], "").trim();
  }

  // Tách thành từng khối câu hỏi theo định dạng "Câu 1:", "Question 1:", "1.", "1/"
  const questionSplitRegex = /(?:^|\n+)(?=(?:(?:Câu|Question)\s*\d+[:\.]?|\d+[\.\/\)]\s+))/i;
  const rawBlocks = cleanText
    .split(questionSplitRegex)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const parsedQuestions: QuestionDraft[] = [];

  rawBlocks.forEach((block, idx) => {
    // Trích xuất Đề bài / Câu hỏi
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

    // Trích xuất các phương án A, B, C, D
    const options: string[] = [];
    const optRegex = /(?:^|\n+)\s*(?:([A-D])[.)]|\(([A-D])\)|\[([A-D])\])\s*([^\n\r]+)/gi;
    const optMatches = Array.from(block.matchAll(optRegex));

    optMatches.forEach((m) => {
      let optText = (m[4] || "").trim();
      optText = optText.replace(/\s*(?:Đáp án|Dap an|Answer|Key)[:\s]+.+$/i, "").trim();
      if (optText) options.push(optText);
    });

    // Trích xuất Đáp án đúng
    let answer = "";
    const ansMatch = block.match(
      /(?:^|\n+)\s*(?:Đáp án|Dap an|Answer|Key)[:\s]+([^\n\r]+)/i
    );
    if (ansMatch && ansMatch[1]) {
      answer = ansMatch[1].trim();
    }

    // Trích xuất Lời giải thích
    let explanation = "";
    const expMatch = block.match(
      /(?:^|\n+)\s*(?:Giải thích|Giai thich|Explanation|Explain)[:\s]+([^\n\r]+)/i
    );
    if (expMatch && expMatch[1]) {
      explanation = expMatch[1].trim();
    }

    // Trích xuất Từ khóa / IPA
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

    // Xác định dạng câu hỏi
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
      points: defaultSkill === "WRITING" ? 10.0 : defaultSkill === "SPEAKING" ? 5.0 : 2.5,
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
