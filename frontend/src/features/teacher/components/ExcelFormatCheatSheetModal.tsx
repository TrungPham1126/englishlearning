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
    { id: "OVERVIEW", label: "12 cột chuẩn", icon: <Layers className="h-4 w-4" /> },
    { id: "VOCABULARY", label: "1. Từ vựng", icon: <Bookmark className="h-4 w-4" /> },
    { id: "GRAMMAR", label: "2. Ngữ pháp", icon: <FileText className="h-4 w-4" /> },
    { id: "LISTENING", label: "3. Nghe", icon: <Headphones className="h-4 w-4" /> },
    { id: "READING", label: "4. Đọc", icon: <BookOpen className="h-4 w-4" /> },
    { id: "SPEAKING", label: "5. Nói", icon: <Mic className="h-4 w-4" /> },
    { id: "WRITING", label: "6. Viết", icon: <PenTool className="h-4 w-4" /> },
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
                Quy chuẩn file Excel (.xlsx)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tương thích 6 kỹ năng &amp; các dạng câu hỏi
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
              <div className="rounded-xl border border-blue-600/20 bg-blue-50/60 dark:bg-slate-900/30 p-4 space-y-1.5">
                <h4 className="font-extrabold text-blue-800 dark:text-blue-300 flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4" />
                  Cấu trúc 12 cột (.xlsx)
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-xs">
                  File mẫu <code className="font-mono bg-blue-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-800 dark:text-blue-300">Mau_Giao_Bai_Tap_Chuan.xlsx</code> có sẵn dropdown loại câu hỏi, kỹ năng và ví dụ.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      <th className="py-2.5 px-3 w-12">Cột</th>
                      <th className="py-2.5 px-3 w-40">Tên cột</th>
                      <th className="py-2.5 px-3 w-28">Bắt buộc</th>
                      <th className="py-2.5 px-3">Quy cách điền</th>
                      <th className="py-2.5 px-3 w-44">Áp dụng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">A</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">STT</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Tự động</span></td>
                      <td className="py-2 px-3">Số thứ tự dòng (1, 2, 3...).</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">B</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Loại câu hỏi (*)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3"><code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">MULTIPLE_CHOICE</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">FILL_IN_BLANK</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">MATCHING</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">AUDIO_RESPONSE</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">ESSAY</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">TRUE_FALSE</code>.</td>
                      <td className="py-2 px-3 text-slate-500">Tự chọn Studio</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">C</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Kỹ năng</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3"><code className="font-mono">LISTENING</code>, <code className="font-mono">SPEAKING</code>, <code className="font-mono">READING</code>, <code className="font-mono">WRITING</code>, <code className="font-mono">GRAMMAR</code>, <code className="font-mono">VOCABULARY</code>.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">D</td>
                      <td className="py-2 px-3 font-bold text-blue-700 dark:text-blue-400">Nội dung câu hỏi / Từ vựng (*)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Đề bài, từ vựng, câu Shadowing hoặc đề luận. Điền từ dùng <code className="font-mono font-bold">___</code>.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">E</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">Điểm (*)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Mặc định 1</span></td>
                      <td className="py-2 px-3">Điểm câu hỏi (mặc định 1.0).</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">F-I</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">Lựa chọn A, B, C, D</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">Theo dạng</span></td>
                      <td className="py-2 px-3"><b>Bắt buộc</b> với trắc nghiệm (tối thiểu A, B). <b>Để trống</b> với Matching, Điền từ, Shadowing, Essay.</td>
                      <td className="py-2 px-3 text-slate-500">MultipleChoice</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">J</td>
                      <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">Đáp án đúng / Nghĩa ghép cặp (*)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">Bắt buộc</span></td>
                      <td className="py-2 px-3">Trắc nghiệm: <code className="font-mono font-bold">A</code>/<code className="font-mono font-bold">B</code>/<code className="font-mono font-bold">C</code>/<code className="font-mono font-bold">D</code> hoặc text đáp án. Matching: nghĩa. Điền từ: từ đúng. Shadowing: câu mẫu.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">K</td>
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">Giải thích / Gợi ý chấm AI</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">Tùy chọn</span></td>
                      <td className="py-2 px-3">Giải thích, IPA hoặc AI Rubric.</td>
                      <td className="py-2 px-3 text-slate-500">Tất cả</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">L</td>
                      <td className="py-2 px-3 font-bold text-purple-700 dark:text-purple-400">Văn bản tạo Audio (Kokoro TTS)</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-400 font-bold">Tự động TTS</span></td>
                      <td className="py-2 px-3">Đoạn nghe hoặc câu đọc để sinh giọng Kokoro TTS.</td>
                      <td className="py-2 px-3 text-slate-500">Listening, Shadowing</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "VOCABULARY" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Từ vựng (Vocabulary)
              </h4>

              <div className="space-y-3">
                <div className="rounded-xl border border-purple-500/30 p-4 space-y-2 bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-700 text-white font-black text-[10px]">Matching</span>
                    <span className="font-bold text-xs text-purple-800 dark:text-purple-300">Ghép cặp từ - nghĩa (MATCHING)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Cột B</b>: <code className="font-mono font-bold text-purple-700 dark:text-purple-300">MATCHING</code></div>
                    <div>• <b>Cột D</b>: Từ tiếng Anh (VD: <code className="font-mono">Resilient</code>)</div>
                    <div>• <b>Cột F–I</b>: <b>Để trống</b></div>
                    <div>• <b>Cột J</b>: Nghĩa tiếng Việt (VD: <code className="font-mono">Kiên cường</code>)</div>
                    <div>• <b>Cột K</b>: Phiên âm IPA (VD: <code className="font-mono">/rɪˈzɪl.jənt/ (adj)</code>)</div>
                    <div>• <b>Cột L</b>: Câu ví dụ để tạo audio</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">MC</span>
                    <span className="font-bold text-xs">Trắc nghiệm (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột D: câu hỏi • Cột F–I: A–D • Cột J: A/B/C/D hoặc text đáp án.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "GRAMMAR" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Ngữ pháp (Grammar)
              </h4>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">MC</span>
                    <span className="font-bold text-xs">Trắc nghiệm (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột F–I: A–D • Cột J: A/B/C/D • Cột K: ghi chú ngữ pháp.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px]">Điền từ</span>
                    <span className="font-bold text-xs">Chia động từ / Điền từ (FILL_IN_BLANK)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột D: câu có <code className="font-mono font-bold">___</code> • Cột F–I: để trống • Cột J: đáp án đúng (VD: <code className="font-mono">would not have missed</code>).
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "LISTENING" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Nghe hiểu (Listening &amp; Kokoro TTS)
              </h4>
              <div className="space-y-3">
                <div className="rounded-xl border border-purple-500/30 p-4 space-y-2 bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-700 text-white font-black text-[10px]">Chính tả</span>
                    <span className="font-bold text-xs text-purple-800 dark:text-purple-300">Nghe chép chính tả (FILL_IN_BLANK)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Cột B</b>: <code className="font-mono">FILL_IN_BLANK</code></div>
                    <div>• <b>Cột D</b>: Câu có <code className="font-mono">___</code> (VD: <code className="font-mono">She has worked here ___ 2015.</code>)</div>
                    <div>• <b>Cột J</b>: Từ cần gõ (VD: <code className="font-mono font-bold">since</code>)</div>
                    <div>• <b>Cột L</b>: Câu hoàn chỉnh để Kokoro TTS đọc</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">MC</span>
                    <span className="font-bold text-xs">Nghe trắc nghiệm (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột L: kịch bản nghe (điền câu đầu, câu sau tự kế thừa) • Cột F–I: A–D.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "READING" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Đọc hiểu (Reading)
              </h4>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">MC</span>
                    <span className="font-bold text-xs">Trắc nghiệm (MULTIPLE_CHOICE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột L: bài đọc (kế thừa tự động) • Cột D: câu hỏi • Cột F–I: A–D.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-black text-[10px]">T/F</span>
                    <span className="font-bold text-xs">Đúng / Sai (TRUE_FALSE)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cột B: <code className="font-mono">TRUE_FALSE</code> • Cột J: <code className="font-mono font-bold">TRUE</code>, <code className="font-mono font-bold">FALSE</code> hoặc <code className="font-mono font-bold">NOT GIVEN</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "SPEAKING" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Nói (Speaking)
              </h4>
              <div className="space-y-3">
                <div className="rounded-xl border border-blue-600/30 p-4 space-y-2 bg-blue-50/50 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-black text-[10px]">Shadowing</span>
                    <span className="font-bold text-xs text-blue-800 dark:text-blue-300">Nhại câu / Phát âm (AUDIO_RESPONSE)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Cột B</b>: <code className="font-mono">AUDIO_RESPONSE</code></div>
                    <div>• <b>Cột D &amp; J</b>: Câu mẫu tiếng Anh</div>
                    <div>• <b>Cột K</b>: Ghi chú trọng âm, nối âm</div>
                    <div>• <b>Cột L</b>: Câu mẫu để Kokoro TTS tạo audio</div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/30 p-4 space-y-2 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-black text-[10px]">Q&amp;A</span>
                    <span className="font-bold text-xs text-amber-800 dark:text-amber-300">Phỏng vấn AI (SpeakingQA)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div>• <b>Cột D</b>: Câu hỏi phỏng vấn</div>
                    <div>• <b>Cột J</b>: Ý chính (AI đối chiếu Task Response)</div>
                    <div>• <b>Cột K</b>: AI Rubric (Fluency, Lexical, Grammar, Pronunciation)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "WRITING" && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Viết (Writing)
              </h4>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px]">Essay</span>
                  <span className="font-bold text-xs">Đoạn văn / Essay (ESSAY)</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <div>• <b>Cột B</b>: <code className="font-mono font-bold">ESSAY</code></div>
                  <div>• <b>Cột D</b>: Đề bài</div>
                  <div>• <b>Cột F–I</b>: <b>Để trống</b></div>
                  <div>• <b>Cột J</b>: Dàn ý / bài mẫu</div>
                  <div>• <b>Cột K</b>: AI Rubric (TA, CC, LR, GRA)</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <HelpCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>File mẫu đã có sẵn định dạng chuẩn.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onDownloadSkillTemplate && activeTab !== "OVERVIEW" && (
              <button
                type="button"
                onClick={() => onDownloadSkillTemplate(activeTab as SkillKey)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>Tải mẫu {activeTab}</span>
              </button>
            )}

            {onDownloadFullTemplate && (
              <button
                type="button"
                onClick={onDownloadFullTemplate}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Layers className="h-4 w-4" />
                <span>Tải mẫu chuẩn (.xlsx)</span>
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
