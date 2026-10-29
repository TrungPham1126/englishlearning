// frontend/src/features/teacher/components/ExcelFormatCheatSheetModal.tsx
import React, { useState } from "react";
import {
  X,
  FileSpreadsheet,
  Download,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  Bookmark,
  FileText,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { SkillKey } from "../utils/assignmentImport";

interface ExcelFormatCheatSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSkill?: SkillKey;
  onDownloadSkillTemplate?: (skill: SkillKey) => void;
  onDownloadFullTemplate?: () => void;
}

export default function ExcelFormatCheatSheetModal({
  isOpen,
  onClose,
  currentSkill = "READING",
  onDownloadSkillTemplate,
  onDownloadFullTemplate,
}: ExcelFormatCheatSheetModalProps) {
  const [activeTab, setActiveTab] = useState<SkillKey | "OVERVIEW">(currentSkill);

  if (!isOpen) return null;

  const skillTabs: { id: SkillKey | "OVERVIEW"; label: string; icon: React.ReactNode }[] = [
    { id: "OVERVIEW", label: "Tổng Quan 13 Cột", icon: <Layers className="h-4 w-4" /> },
    { id: "VOCABULARY", label: "1. Từ Vựng", icon: <Bookmark className="h-4 w-4" /> },
    { id: "GRAMMAR", label: "2. Ngữ Pháp", icon: <FileText className="h-4 w-4" /> },
    { id: "LISTENING", label: "3. Nghe Hiểu", icon: <Headphones className="h-4 w-4" /> },
    { id: "READING", label: "4. Đọc Hiểu", icon: <BookOpen className="h-4 w-4" /> },
    { id: "SPEAKING", label: "5. Nói & Shadowing", icon: <Mic className="h-4 w-4" /> },
    { id: "WRITING", label: "6. Kỹ Năng Viết", icon: <PenTool className="h-4 w-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheat-sheet-title"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-elevated overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/80 dark:bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h3 id="cheat-sheet-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                Bảng Hướng Dẫn &amp; Quy Chuẩn Nhập File Excel (.xlsx)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chi tiết quy cách điền dữ liệu, cột bắt buộc và ví dụ thực tế cho tất cả 6 kỹ năng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40 overflow-x-auto scrollbar-none">
          {skillTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-md text-xs font-bold transition border-b whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border-blue-700 shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed">
          {activeTab === "OVERVIEW" && (
            <div className="space-y-5 animate-in fade-in">
              <div className="rounded-xl border border-blue-600/20 bg-blue-50/60 dark:bg-slate-900/30 p-4 space-y-2">
                <h4 className="font-extrabold text-blue-800 dark:text-blue-300 flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4" />
                  Quy Chuẩn Đồng Nhất 13 Cột Trong File Excel (.xlsx)
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-xs">
                  Dù là file đơn kỹ năng hay file trọn bộ 7 Sheets, mỗi Sheet câu hỏi đều dùng chung đúng thứ tự 13 cột sau. Hệ thống tự động nhận diện tiêu đề tiếng Việt hoặc tiếng Anh không phân biệt hoa thường.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      <th className="py-2.5 px-3 w-12">STT</th>
                      <th className="py-2.5 px-3 w-40">Tên Cột</th>
                      <th className="py-2.5 px-3 w-28">Tính Chất</th>
                      <th className="py-2.5 px-3">Ý Nghĩa &amp; Quy Cách Điền</th>
                      <th className="py-2.5 px-3 w-44">Áp Dụng Cho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">1</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">STT</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Tùy chọn</span></td>
                      <td className="py-2 px-3">Số thứ tự dòng (1, 2, 3...) để dễ quản lý trong Excel.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các dạng</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">2</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Kỹ năng</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Mã chuẩn: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">VOCABULARY</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">GRAMMAR</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">LISTENING</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">READING</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">SPEAKING</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">WRITING</code>.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các dạng</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">3</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Dạng câu hỏi</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Mã chuẩn: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">MULTIPLE_CHOICE</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">FILL_IN_BLANK</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">TRUE_FALSE</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">AUDIO_RESPONSE</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">ESSAY</code> (hoặc alias: SHADOWING, ERROR_IDENTIFICATION, SENTENCE_TRANSFORMATION).</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các dạng</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">4</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Đề bài / Câu hỏi</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Nội dung câu hỏi hoặc yêu cầu bài làm. Câu điền từ dùng ký hiệu <code className="font-mono font-bold">______</code> để đánh dấu vị trí khuyết.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các dạng</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">5-8</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">Lựa chọn A, B, C, D</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">Theo dạng</span></td>
                      <td className="py-2 px-3"><b>BẮT BUỘC</b> cho trắc nghiệm (tối thiểu A, B). <b>BỎ TRỐNG</b> cho bài Điền từ, Viết luận Essay, Luyện Shadowing, Trả lời nói.</td>
                      <td className="py-2 px-3 text-slate-500">Trắc nghiệm, Tìm lỗi sai</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">9</td>
                      <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">Đáp án đúng</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Trắc nghiệm: có thể ghi chữ cái <code className="font-mono font-bold">A</code>, <code className="font-mono font-bold">B</code>, <code className="font-mono font-bold">C</code>, <code className="font-mono font-bold">D</code> (hệ thống tự lấy text) HOẶC ghi trọn vẹn text. True/False ghi <code className="font-mono font-bold">TRUE</code>, <code className="font-mono font-bold">FALSE</code>, <code className="font-mono font-bold">NOT GIVEN</code>. Điền từ ghi từ/cụm từ đúng.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các dạng</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">10</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">Giải thích</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Khuyến khích</span></td>
                      <td className="py-2 px-3">Lời giải thích chi tiết, công thức ngữ pháp, mẹo dịch nghĩa, hoặc dàn ý gợi ý &amp; tiêu chí chấm cho bài Viết/Nói.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các dạng</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">11</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Bài đọc / Kịch bản</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-700 dark:text-blue-400 font-bold">Kế thừa</span></td>
                      <td className="py-2 px-3">Đoạn văn đọc hiểu (Reading Passage) hoặc kịch bản nghe liên tục (Listening Script). <b>MẸO</b>: Nếu nhiều câu hỏi chung 1 bài đọc/nghe, chỉ cần điền ở câu đầu tiên, các câu sau để trống hệ thống sẽ tự động kế thừa!</td>
                      <td className="py-2 px-3 text-slate-500">Reading, Listening, Shadowing</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">12</td>
                      <td className="py-2 px-3 font-bold text-amber-600 dark:text-amber-400">Từ khóa / IPA</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Tùy chọn</span></td>
                      <td className="py-2 px-3">Từ vựng mục tiêu kèm ký âm quốc tế IPA (VD: <code className="font-mono">enormous | /ɪˈnɔːməs/</code>) để tự động phát âm US Native và luyện tập phát âm chuẩn.</td>
                      <td className="py-2 px-3 text-slate-500">Vocabulary, Shadowing</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">13</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">Điểm số</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Tùy chọn</span></td>
                      <td className="py-2 px-3">Điểm số cho câu hỏi (mặc định 2.5 nếu để trống; Speaking/Writing thường là 5.0 hoặc 10.0).</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các dạng</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "VOCABULARY" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Kỹ Năng Từ Vựng (Vocabulary) - 3 Dạng Bài Tiêu Biểu
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Tập trung vào trắc nghiệm chọn nghĩa, điền dạng đúng của từ và học từ vựng kèm phát âm IPA.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Dạng 1 */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 1</span>
                    <span className="font-bold text-xs">Trắc nghiệm chọn nghĩa / từ đồng nghĩa (MULTIPLE_CHOICE)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Kỹ năng</b>: <code className="font-mono">VOCABULARY</code> | <b>Dạng</b>: <code className="font-mono">MULTIPLE_CHOICE</code></div>
                    <div>• <b>Lựa chọn A, B, C, D</b>: Bắt buộc điền đủ 4 phương án.</div>
                    <div>• <b>Đáp án đúng</b>: Điền chữ cái <code className="font-mono font-bold">A</code> (hoặc B, C, D). Hệ thống sẽ tự động gán text tương ứng.</div>
                    <div>• <b>Từ khóa / IPA</b>: Ghi từ vựng và phiên âm (VD: <code className="font-mono">enormous | /ɪˈnɔːməs/</code>).</div>
                  </div>
                </div>

                {/* Dạng 2 */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">Điền dạng đúng của từ trong ngoặc (FILL_IN_BLANK)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Kỹ năng</b>: <code className="font-mono">VOCABULARY</code> | <b>Dạng</b>: <code className="font-mono">FILL_IN_BLANK</code></div>
                    <div>• <b>Đề bài</b>: Đặt từ gốc trong ngoặc đơn và chỗ trống, ví dụ: <i>Her exceptional ______ (creativity) was praised...</i></div>
                    <div>• <b>Lựa chọn A, B, C, D</b>: <b>ĐỂ TRỐNG</b> hoàn toàn.</div>
                    <div>• <b>Đáp án đúng</b>: Điền dạng đúng của từ (VD: <code className="font-mono font-bold">creativity</code>).</div>
                  </div>
                </div>

                {/* Dạng 3 */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 3</span>
                    <span className="font-bold text-xs">Luyện phát âm từ vựng kèm IPA (AUDIO_RESPONSE / PRONUNCIATION_DRILL)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Kỹ năng</b>: <code className="font-mono">VOCABULARY</code> | <b>Dạng</b>: <code className="font-mono">AUDIO_RESPONSE</code></div>
                    <div>• <b>Đề bài</b>: Đọc to từ vựng hoặc câu chứa từ để AI nhận diện phát âm (VD: <i>Read aloud the word 'resilient'...</i>).</div>
                    <div>• <b>Lựa chọn A, B, C, D</b>: <b>ĐỂ TRỐNG</b> hoàn toàn.</div>
                    <div>• <b>Từ khóa / IPA</b>: Điền phiên âm IPA chuẩn (VD: <code className="font-mono">resilient | /rɪˈzɪl.jənt/</code>) để hệ thống phát âm mẫu US Native và nhận diện giọng nói.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "GRAMMAR" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Kỹ Năng Ngữ Pháp (Grammar) - 3 Dạng Bài Tiêu Biểu
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Bao gồm trắc nghiệm cấu trúc câu, chia động từ theo thì/câu điều kiện và tìm lỗi sai trong câu.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 1</span>
                    <span className="font-bold text-xs">Trắc nghiệm ngữ pháp 4 lựa chọn (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Điền đầy đủ 4 cột A, B, C, D. Cột đáp án ghi chữ cái (A, B, C, D). Cột Giải thích nêu quy tắc ngữ pháp (VD: Hòa hợp chủ vị, Mệnh đề quan hệ).
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">Chia động từ trong ngoặc (FILL_IN_BLANK)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Đề bài chứa động từ nguyên mẫu trong ngoặc <i>(inspect)</i> và chỗ trống <i>______</i>. Bỏ trống các cột A-D. Đáp án ghi động từ đã chia đúng thì (VD: <i>had inspected</i>).
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px]">Dạng 3</span>
                    <span className="font-bold text-xs">Tìm lỗi sai trong câu (ERROR_IDENTIFICATION / MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Đề bài đánh dấu 4 vị trí gạch chân: <i>Although (A) the severe weather... managed (B) to locate (C)... safely (D).</i> Các cột A, B, C, D điền các từ tương ứng. Cột Đáp án ghi chữ cái lỗi sai kèm giải thích cách sửa đúng.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "LISTENING" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Kỹ Năng Nghe Hiểu (Listening) - 3 Dạng Bài Tiêu Biểu
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Điểm mấu chốt là cột <b>Bài đọc / Kịch bản (Passage/Transcript)</b> chứa lời thoại để hệ thống sinh âm thanh AI TTS tự động.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 1</span>
                    <span className="font-bold text-xs">Nghe hiểu trắc nghiệm (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột Kịch bản chứa toàn bộ đoạn hội thoại. Các câu hỏi có đầy đủ lựa chọn A-D và đáp án.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">Nghe chép chính tả / Điền từ khuyết (FILL_IN_BLANK)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Đề bài chứa câu khuyết <i>______</i>. Bỏ trống các cột A-D. Đáp án ghi chính xác từ người nói phát âm. Cột Kịch bản để trống để tự động kế thừa từ câu trước.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-black text-[10px]">Dạng 3</span>
                    <span className="font-bold text-xs">Nghe xác nhận Đúng / Sai (TRUE_FALSE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Lựa chọn A là <code className="font-mono">TRUE</code>, B là <code className="font-mono">FALSE</code>, C là <code className="font-mono">NOT GIVEN</code>. Cột Đáp án ghi chữ cái hoặc chữ in hoa tương ứng.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "READING" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Kỹ Năng Đọc Hiểu (Reading) - 3 Dạng Bài Tiêu Biểu
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Cột <b>Bài đọc / Kịch bản (Passage/Transcript)</b> chứa văn bản bài đọc dài hiển thị cố định ở đầu bài làm của học sinh.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 1</span>
                    <span className="font-bold text-xs">Đọc hiểu trắc nghiệm (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Đoạn văn đọc hiểu được dán ở dòng câu hỏi đầu tiên. Các câu hỏi đọc hiểu tiếp theo <b>để trống cột Passage</b> để hệ thống tự động kế thừa chung 1 bài đọc duy nhất.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">True / False / Not Given (TRUE_FALSE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Đề bài đưa ra một nhận định dựa trên bài đọc. Cột Đáp án ghi rõ <code className="font-mono">TRUE</code>, <code className="font-mono">FALSE</code>, hoặc <code className="font-mono">NOT GIVEN</code>.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px]">Dạng 3</span>
                    <span className="font-bold text-xs">Điền từ vào đoạn tóm tắt bài đọc (FILL_IN_BLANK)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Đề bài tóm tắt nội dung bài đọc và có chỗ khuyết <i>______</i>. Bỏ trống các cột A-D. Đáp án ghi chính xác từ cần lấy từ bài đọc để điền vào.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "SPEAKING" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Kỹ Năng Nói &amp; Phát Âm (Speaking &amp; Shadowing)
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Hỗ trợ chế độ luyện nói nhại theo câu mẫu (Shadowing) và trả lời phỏng vấn giao tiếp mở (Q&amp;A / Audio Response).
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">Dạng 1</span>
                    <span className="font-bold text-xs">Luyện phát âm câu mẫu (SHADOWING / AUDIO_RESPONSE)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Đề bài &amp; Đáp án</b>: Ghi chính xác câu tiếng Anh mẫu học sinh cần luyện đọc to.</div>
                    <div>• <b>Lựa chọn A, B, C, D</b>: <b>ĐỂ TRỐNG</b> hoàn toàn.</div>
                    <div>• <b>Giải thích</b>: Dịch nghĩa tiếng Việt, lưu ý trọng âm từ và nối âm.</div>
                    <div>• <b>Từ khóa / IPA</b>: Ghi ký âm IPA của các từ khó trong câu.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">Trả lời câu hỏi mở / Chủ đề nói (AUDIO_RESPONSE / Q&amp;A)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Đề bài</b>: Đề tài phỏng vấn (Cue Card / Speaking Topic).</div>
                    <div>• <b>Đáp án đúng</b>: Ghi các luận điểm chính cần trả lời (AI đối chiếu chấm Task Response).</div>
                    <div>• <b>Giải thích</b>: Gợi ý dàn ý và thời lượng nói tối thiểu (VD: 1 - 2 phút).</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "WRITING" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Kỹ Năng Viết (Writing) - 2 Dạng Bài Tiêu Biểu
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Hỗ trợ viết luận/đoạn văn học thuật (chấm theo 4 tiêu chí IELTS) và sắp xếp từ / viết lại câu.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 1</span>
                    <span className="font-bold text-xs">Viết bài luận / đoạn văn học thuật (ESSAY)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Đề bài</b>: Đề bài yêu cầu viết bài (ghi rõ số từ tối thiểu, VD: ít nhất 250 từ).</div>
                    <div>• <b>Lựa chọn A, B, C, D</b>: <b>ĐỂ TRỐNG</b> hoàn toàn.</div>
                    <div>• <b>Đáp án đúng</b>: Đoạn văn mẫu tham khảo hoặc cấu trúc dàn ý điểm cao.</div>
                    <div>• <b>Giải thích</b>: Hướng dẫn tiêu chí chấm (Task Response, Coherence, Lexical, Grammar).</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">Sắp xếp từ / Viết lại câu không đổi nghĩa (SENTENCE_TRANSFORMATION / FILL_IN_BLANK)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Đề bài</b>: Câu gốc và từ gợi ý kèm vị trí khuyết <i>______</i>.</div>
                    <div>• <b>Lựa chọn A, B, C, D</b>: <b>ĐỂ TRỐNG</b> hoàn toàn.</div>
                    <div>• <b>Đáp án đúng</b>: Cụm từ hoặc câu viết lại hoàn chỉnh chính xác.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <HelpCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Mẹo: Bạn có thể tải file mẫu tương ứng bên dưới để mở bằng Excel hoặc Google Sheets!</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onDownloadSkillTemplate && activeTab !== "OVERVIEW" && (
              <button
                type="button"
                onClick={() => onDownloadSkillTemplate(activeTab as SkillKey)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>Tải Mẫu Kỹ Năng ({activeTab})</span>
              </button>
            )}

            {onDownloadFullTemplate && (
              <button
                type="button"
                onClick={onDownloadFullTemplate}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Layers className="h-4 w-4" />
                <span>Tải Trọn Bộ 7 Sheets (.xlsx)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
