// frontend/src/features/teacher/components/ExcelFormatCheatSheetModal.tsx
import React, { useState } from "react";
import {
  X,
  FileSpreadsheet,
  Download,
  Layers,
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  Bookmark,
  FileText,
  HelpCircle,
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
    { id: "OVERVIEW", label: "Tổng Quan 12 Cột Chuẩn", icon: <Layers className="h-4 w-4" /> },
    { id: "VOCABULARY", label: "1. Từ Vựng & Matching", icon: <Bookmark className="h-4 w-4" /> },
    { id: "GRAMMAR", label: "2. Ngữ Pháp", icon: <FileText className="h-4 w-4" /> },
    { id: "LISTENING", label: "3. Nghe & Kokoro TTS", icon: <Headphones className="h-4 w-4" /> },
    { id: "READING", label: "4. Đọc Hiểu", icon: <BookOpen className="h-4 w-4" /> },
    { id: "SPEAKING", label: "5. Nói & Shadowing", icon: <Mic className="h-4 w-4" /> },
    { id: "WRITING", label: "6. Viết & Essay", icon: <PenTool className="h-4 w-4" /> },
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
                Khớp 100% với 6 Studio học tập: Trắc nghiệm, Điền từ, Ghép từ vựng (Matching), Nghe chép chính tả, Speaking Shadowing &amp; Essay
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
                  Quy Chuẩn Đồng Nhất 12 Cột Trong File Excel (.xlsx)
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-xs">
                  File mẫu dựng sẵn <code className="font-mono bg-blue-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-800 dark:text-blue-300">Mau_Giao_Bai_Tap_Chuan.xlsx</code> đã kẻ sẵn 12 cột, có Dropdown chọn loại câu hỏi &amp; kỹ năng, 6 câu mẫu đa dạng và 41 hàng kẻ sẵn để giáo viên chỉ việc gõ hoặc dán nội dung.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      <th className="py-2.5 px-3 w-12">Cột</th>
                      <th className="py-2.5 px-3 w-40">Tên Cột Header</th>
                      <th className="py-2.5 px-3 w-28">Tính Chất</th>
                      <th className="py-2.5 px-3">Ý Nghĩa &amp; Quy Cách Điền</th>
                      <th className="py-2.5 px-3 w-44">Studio / Giao Diện Học Tập</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">A</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">STT</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Tự động</span></td>
                      <td className="py-2 px-3">Số thứ tự dòng (1, 2, 3...) đã đánh sẵn trong bảng mẫu.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các Studio</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">B</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Loại câu hỏi (*)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Có dropdown chọn: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">MULTIPLE_CHOICE</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">FILL_IN_BLANK</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">MATCHING</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">AUDIO_RESPONSE</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">ESSAY</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">TRUE_FALSE</code>.</td>
                      <td className="py-2 px-3 text-slate-500">Tự động điều hướng Studio tương ứng</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">C</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Kỹ năng</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Có dropdown chọn: <code className="font-mono">LISTENING</code>, <code className="font-mono">SPEAKING</code>, <code className="font-mono">READING</code>, <code className="font-mono">WRITING</code>, <code className="font-mono">GRAMMAR</code>, <code className="font-mono">VOCABULARY</code>.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các Studio</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">D</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Nội dung câu hỏi / Từ vựng (*)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Nội dung câu hỏi, câu mẫu luyện Shadowing, từ vựng cần ghép hoặc chủ đề bài luận. Câu điền từ dùng <code className="font-mono font-bold">___</code> để tạo chỗ trống.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các Studio</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">E</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">Điểm (*)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Mặc định 1</span></td>
                      <td className="py-2 px-3">Điểm số của câu hỏi (mặc định đã điền sẵn 1.0 trong bảng mẫu).</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các Studio</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">F-I</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">Lựa chọn A, B, C, D</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">Theo dạng</span></td>
                      <td className="py-2 px-3"><b>BẮT BUỘC</b> cho trắc nghiệm (tối thiểu A, B). <b>ĐỂ TRỐNG</b> cho Matching, Điền từ, Shadowing, Viết luận Essay.</td>
                      <td className="py-2 px-3 text-slate-500">MultipleChoiceRenderer</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">J</td>
                      <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">Đáp án đúng / Nghĩa ghép cặp (*)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Trắc nghiệm: ghi chữ cái <code className="font-mono font-bold">A</code>, <code className="font-mono font-bold">B</code>, <code className="font-mono font-bold">C</code>, <code className="font-mono font-bold">D</code> (hệ thống tự lấy text) HOẶC ghi toàn văn lựa chọn. Matching: ghi nghĩa tiếng Việt tương ứng. Điền từ: ghi từ cần điền. Shadowing: ghi lại câu mẫu.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các Studio</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">K</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">Giải thích / Gợi ý chấm AI</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Khuyến khích</span></td>
                      <td className="py-2 px-3">Lời giải thích chi tiết, phiên âm IPA cho từ vựng, mẹo ngữ pháp hoặc Rubric tiêu chí chấm điểm tự luận AI.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả các Studio</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">L</td>
                      <td className="py-2 px-3 font-bold text-purple-700 dark:text-purple-400">Văn bản tạo Audio (Kokoro TTS)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-400 font-bold">Tự động TTS</span></td>
                      <td className="py-2 px-3">Đoạn văn bài nghe hoặc câu tiếng Anh cần phát âm. Hệ thống sẽ tự động tổng hợp giọng đọc chuẩn US Native qua Kokoro TTS client!</td>
                      <td className="py-2 px-3 text-slate-500">ListenAndType, Shadowing</td>
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
                    Kỹ Năng Từ Vựng &amp; VocabularyMatchingStudio
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Hỗ trợ đầy đủ màn chơi lật thẻ / ghép đôi từ vựng, trắc nghiệm nghĩa và điền từ vào chỗ trống.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-purple-500/30 p-4 space-y-2 bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-700 text-white font-black text-[10px]">Đặc Biệt</span>
                    <span className="font-bold text-xs text-purple-800 dark:text-purple-300">Ghép cặp từ vựng với nghĩa tiếng Việt (MATCHING / VocabularyMatchingStudio)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Loại câu hỏi (Cột B)</b>: <code className="font-mono font-bold text-purple-700 dark:text-purple-300">MATCHING</code></div>
                    <div>• <b>Nội dung (Cột D)</b>: Từ vựng tiếng Anh (VD: <code className="font-mono">Resilient</code>).</div>
                    <div>• <b>Lựa chọn A-D (Cột F-I)</b>: <b>ĐỂ TRỐNG</b> hoàn toàn.</div>
                    <div>• <b>Đáp án đúng (Cột J)</b>: Nghĩa tiếng Việt tương ứng (VD: <code className="font-mono">Kiên cường, có khả năng phục hồi nhanh trước khó khăn</code>).</div>
                    <div>• <b>Giải thích (Cột K)</b>: Phiên âm IPA (VD: <code className="font-mono">/rɪˈzɪl.jənt/ (adj)</code>).</div>
                    <div>• <b>Văn bản Audio (Cột L)</b>: Câu chứa từ vựng để tạo audio mẫu bản ngữ phát âm (VD: <i>Resilient individuals adapt swiftly...</i>).</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">Trắc nghiệm chọn từ đồng nghĩa / nghĩa đúng (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Điền đề bài ở Cột D, điền 4 lựa chọn A-D ở Cột F-I, Cột J ghi chữ cái đáp án (A, B, C, D) hoặc text phương án.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "GRAMMAR" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Kỹ Năng Ngữ Pháp (Grammar)
              </h4>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 1</span>
                    <span className="font-bold text-xs">Trắc nghiệm ngữ pháp 4 lựa chọn (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Điền đầy đủ 4 cột A, B, C, D. Cột J ghi đáp án đúng (A/B/C/D). Cột K nêu công thức ngữ pháp áp dụng (VD: Câu điều kiện loại 3, Hòa hợp chủ vị).
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">Chia động từ / Điền từ khuyết (FILL_IN_BLANK)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột D chứa câu có chỗ khuyết <code className="font-mono font-bold">___</code> và động từ nguyên mẫu trong ngoặc. Bỏ trống các cột A-D. Cột J ghi dạng chia đúng (VD: <code className="font-mono">would not have missed</code>).
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "LISTENING" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Kỹ Năng Nghe Hiểu (Listening) &amp; Tích Hợp Kokoro TTS
              </h4>
              <div className="space-y-3">
                <div className="rounded-xl border border-purple-500/30 p-4 space-y-2 bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-700 text-white font-black text-[10px]">Phổ Biến</span>
                    <span className="font-bold text-xs text-purple-800 dark:text-purple-300">Nghe chép chính tả (ListenAndTypeRenderer)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Loại câu hỏi (Cột B)</b>: <code className="font-mono">FILL_IN_BLANK</code></div>
                    <div>• <b>Nội dung (Cột D)</b>: <code className="font-mono">Listen and type the missing word: She has worked at the tech laboratory ___ 2015.</code></div>
                    <div>• <b>Đáp án đúng (Cột J)</b>: Từ khóa cần gõ (VD: <code className="font-mono font-bold">since</code>).</div>
                    <div>• <b>Văn bản tạo Audio (Cột L)</b>: Kịch bản câu hoàn chỉnh để Kokoro TTS tự động đọc: <code className="font-mono">She has worked at the tech laboratory since 2015.</code></div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">Nghe hiểu trắc nghiệm (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột L chứa đoạn kịch bản nghe liên tục (chỉ cần điền ở câu đầu tiên, các câu sau để trống hệ thống sẽ tự động kế thừa). Cột F-I điền các lựa chọn A, B, C, D.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "READING" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Kỹ Năng Đọc Hiểu (Reading)
              </h4>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Dạng 1</span>
                    <span className="font-bold text-xs">Đọc hiểu trắc nghiệm 4 lựa chọn (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột L chứa đoạn văn bài đọc dài (Reading Passage). Các câu hỏi sau chỉ cần điền đề bài ở Cột D và lựa chọn A-D ở Cột F-I.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-black text-[10px]">Dạng 2</span>
                    <span className="font-bold text-xs">Xác nhận thông tin Đúng / Sai (TRUE_FALSE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột B chọn <code className="font-mono">TRUE_FALSE</code>. Cột J điền <code className="font-mono font-bold">TRUE</code>, <code className="font-mono font-bold">FALSE</code> hoặc <code className="font-mono font-bold">NOT GIVEN</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "SPEAKING" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Kỹ Năng Nói &amp; Speaking Studios
              </h4>
              <div className="space-y-3">
                <div className="rounded-xl border border-blue-600/30 p-4 space-y-2 bg-blue-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Studio 1</span>
                    <span className="font-bold text-xs text-blue-800 dark:text-blue-300">Luyện nhại câu / Phát âm (SpeakingShadowingStudio)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Loại câu hỏi (Cột B)</b>: <code className="font-mono">AUDIO_RESPONSE</code></div>
                    <div>• <b>Nội dung (Cột D)</b>: Câu mẫu tiếng Anh cần học sinh nhại (VD: <i>Consistency is the key to mastering any new skill.</i>).</div>
                    <div>• <b>Đáp án đúng (Cột J)</b>: Ghi lại trọn vẹn câu mẫu.</div>
                    <div>• <b>Giải thích (Cột K)</b>: Lưu ý về trọng âm, nối âm, ngữ điệu (Intonation).</div>
                    <div>• <b>Văn bản Audio (Cột L)</b>: Ghi câu mẫu để hệ thống tự động sinh file audio chuẩn bản ngữ bằng Kokoro TTS!</div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/30 p-4 space-y-2 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-black text-[10px]">Studio 2</span>
                    <span className="font-bold text-xs text-amber-800 dark:text-amber-300">Phỏng vấn &amp; Trả lời mở kèm AI Chấm điểm (SpeakingQAStudio)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Nội dung (Cột D)</b>: Câu hỏi phỏng vấn (VD: <i>Describe an environmental challenge facing your city...</i>).</div>
                    <div>• <b>Đáp án đúng (Cột J)</b>: Ý chính cần trả lời (AI đối chiếu chấm Task Response).</div>
                    <div>• <b>Giải thích (Cột K)</b>: Tiêu chí chấm AI Rubric: Fluency, Lexical Resource, Grammar, Pronunciation.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "WRITING" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Kỹ Năng Viết (Writing) &amp; AI Rubric
              </h4>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px]">Tự Luận</span>
                  <span className="font-bold text-xs">Viết đoạn văn / Bài luận Essay (ESSAY)</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <div>• <b>Loại câu hỏi (Cột B)</b>: <code className="font-mono font-bold">ESSAY</code></div>
                  <div>• <b>Nội dung (Cột D)</b>: Đề bài viết (Writing Topic).</div>
                  <div>• <b>Lựa chọn A-D (Cột F-I)</b>: <b>ĐỂ TRỐNG</b> hoàn toàn.</div>
                  <div>• <b>Đáp án đúng (Cột J)</b>: Dàn ý mẫu hoặc bài viết tham khảo band điểm cao.</div>
                  <div>• <b>Giải thích (Cột K)</b>: Tiêu chí chấm AI Rubric: Task Achievement, Coherence &amp; Cohesion, Lexical Resource, Grammar.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <HelpCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Mẹo: File Excel mẫu đã sẵn sàng công thức &amp; định dạng chuẩn để tải về điền ngay!</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onDownloadSkillTemplate && activeTab !== "OVERVIEW" && (
              <button
                type="button"
                onClick={() => onDownloadSkillTemplate(activeTab as SkillKey)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>📥 Tải Mẫu Kỹ Năng ({activeTab})</span>
              </button>
            )}

            {onDownloadFullTemplate && (
              <button
                type="button"
                onClick={onDownloadFullTemplate}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Layers className="h-4 w-4" />
                <span>📂 Tải Mẫu Chuẩn Tổng Hợp (.xlsx)</span>
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
