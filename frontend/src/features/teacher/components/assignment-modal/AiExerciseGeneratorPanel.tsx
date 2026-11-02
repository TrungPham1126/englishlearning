import React from "react";
import { Calendar, Check } from "lucide-react";
import type { QuestionFormatItem } from "./assignmentModalConfig";

interface AiExerciseGeneratorPanelProps {
  aiTopic: string;
  setAiTopic: (val: string) => void;
  aiLevel: string;
  handleSelectLevel: (lvl: string) => void;
  aiQuestionCount: number;
  setAiQuestionCount: (val: number) => void;
  assignmentType: string;
  selectedSubFormat: string;
  handleSelectSubFormat: (code: string) => void;
  currentLevelFormats: QuestionFormatItem[];
  readingPassageIelts: 1 | 2 | 3;
  setReadingPassageIelts: (val: 1 | 2 | 3) => void;
  selectedPlanId: string;
  setSelectedPlanId: (val: string) => void;
  dailyPlans: any[];
  scheduledDate: string;
  setScheduledDate: (val: string) => void;
}

export const AiExerciseGeneratorPanel: React.FC<AiExerciseGeneratorPanelProps> = ({
  aiTopic,
  setAiTopic,
  aiLevel,
  handleSelectLevel,
  aiQuestionCount,
  setAiQuestionCount,
  assignmentType,
  selectedSubFormat,
  handleSelectSubFormat,
  currentLevelFormats,
  readingPassageIelts,
  setReadingPassageIelts,
  selectedPlanId,
  setSelectedPlanId,
  dailyPlans,
  scheduledDate,
  setScheduledDate,
}) => {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
            Chủ đề bài tập (Topic):
          </label>
          <input
            type="text"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="Vd: IELTS Speaking Part 2 - Environment"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
            Mức độ khó (Trình độ CEFR / IELTS):
          </label>
          <select
            value={aiLevel}
            onChange={(e) => handleSelectLevel(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
          >
            <option value="A1">A1 - Sơ cấp (Beginner)</option>
            <option value="A2">A2 - Cơ bản (Elementary)</option>
            <option value="B1">B1 - Trung cấp (Intermediate)</option>
            <option value="B2">B2 - Trung cao (Upper-Intermediate)</option>
            <option value="C1">C1 - Cao cấp (Advanced)</option>
            <option value="IELTS">IELTS - Luyện thi IELTS Chuyên sâu</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
            Số lượng câu hỏi:
          </label>
          <select
            value={aiQuestionCount}
            onChange={(e) => setAiQuestionCount(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
          >
            <option value={3}>3 câu</option>
            <option value={5}>5 câu</option>
            <option value={10}>10 câu</option>
            <option value={15}>15 câu</option>
          </select>
        </div>
      </div>

      {/* KHUNG HIỂN THỊ CHI TIẾT ĐỊNH DẠNG THEO TRÌNH ĐỘ */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/40 dark:bg-slate-900/20 p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-600/20 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-800 text-white">
              {aiLevel}
            </span>
            <span className="font-bold text-xs text-blue-800 dark:text-blue-200">
              Định Dạng Câu Hỏi Phù Hợp Trình Độ: {assignmentType} ({aiLevel})
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {aiLevel === "A1" || aiLevel === "A2"
              ? "Trình độ nền tảng • Dữ kiện trực quan"
              : aiLevel === "B1" || aiLevel === "B2"
              ? "Trình độ trung cấp • Paraphrasing & Phân tích"
              : "Trình độ học thuật • Mô phỏng chuẩn đề thi"}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-700 dark:text-slate-300 font-semibold">
            Danh sách định dạng câu hỏi cho {aiLevel}:
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 font-medium">
            Đang chọn: {currentLevelFormats.find((f) => f.code === selectedSubFormat)?.label || "Mặc định"}
          </span>
        </div>

        {/* LƯỚI CÁC ĐỊNH DẠNG CÂU HỎI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {currentLevelFormats.map((fmt) => {
            const isFormatActive = selectedSubFormat === fmt.code;
            return (
              <button
                key={fmt.code}
                type="button"
                onClick={() => handleSelectSubFormat(fmt.code)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isFormatActive
                    ? "bg-blue-50/90 dark:bg-blue-800/25 border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/50 shadow-md scale-[1.01]"
                    : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600/40 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`text-xs font-bold ${
                      isFormatActive ? "text-blue-800 dark:text-blue-200" : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {fmt.label}
                  </span>
                  {isFormatActive && (
                    <span className="p-0.5 rounded-full bg-blue-800 text-white shrink-0">
                      <Check className="h-3.5 w-3.5 font-bold" />
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {fmt.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* ĐỐI VỚI READING IELTS: HỖ TRỢ CHỌN PASSAGE 1 / 2 / 3 */}
        {assignmentType === "READING" && aiLevel === "IELTS" && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-blue-100 dark:border-blue-600/20 text-xs">
            <span className="text-slate-700 dark:text-slate-300 font-bold">Chọn Passage Đọc Hiểu IELTS:</span>
            <div className="flex items-center gap-1.5">
              {([1, 2, 3] as const).map((pNum) => (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setReadingPassageIelts(pNum)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                    readingPassageIelts === pNum
                      ? "bg-blue-800 text-white border-blue-400"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  Passage {pNum}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" /> Gán vào Ngày Học (Daily Study Plan):
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select
            value={selectedPlanId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedPlanId(val);
              if (val !== "NEW_DAY") {
                const plan = dailyPlans.find((p: any) => p.id === val);
                if (plan) setScheduledDate(plan.scheduledDate);
              }
            }}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
          >
            {dailyPlans.map((p: any) => (
              <option key={p.id} value={p.id}>
                Day {p.dayNumber} ({p.scheduledDate}): {p.title || "Lộ trình ngày"}
              </option>
            ))}
            <option value="NEW_DAY">+ Tạo ngày học mới (Thêm Day tiếp theo)</option>
          </select>

          {selectedPlanId === "NEW_DAY" && (
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AiExerciseGeneratorPanel;
