import React from "react";
import { CheckCircle2, Clock } from "lucide-react";

export interface SpeakingPromptHeaderProps {
  dayNumber: number;
  questionIndex: number;
  totalQuestions: number;
  isShadowingMode: boolean;
  isSubmitted: boolean;
  totalScore?: number | null;
}

export const SpeakingPromptHeader: React.FC<SpeakingPromptHeaderProps> = ({
  dayNumber,
  questionIndex,
  totalQuestions,
  isShadowingMode,
  isSubmitted,
  totalScore,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
          Ngày {dayNumber} • Câu {questionIndex + 1}/{totalQuestions}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            isShadowingMode
              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
              : "bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-600/30"
          }`}
        >
          {isShadowingMode
            ? "SHADOWING SENTENCE"
            : "SPEAKING Q&A INTERVIEW"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isSubmitted ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/30 shadow-2xs">
            <CheckCircle2 size={13} /> ĐÃ HOÀN THÀNH
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-2.5 py-1 rounded-md">
            <Clock size={13} /> Đang làm bài
          </span>
        )}

        {totalScore !== undefined && totalScore !== null && (
          <span className="text-xs font-bold bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-600/30 px-2.5 py-1 rounded-md">
            Tổng điểm: {totalScore.toFixed(1)} pts
          </span>
        )}
      </div>
    </div>
  );
};

export default SpeakingPromptHeader;
