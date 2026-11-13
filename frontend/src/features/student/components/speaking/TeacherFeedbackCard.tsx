import React from "react";
import { MessageSquare } from "lucide-react";

export interface TeacherFeedbackCardProps {
  teacherFeedback?: string;
  score?: number | null;
  dayNumber: number;
}

export const TeacherFeedbackCard: React.FC<TeacherFeedbackCardProps> = ({
  teacherFeedback,
  score,
}) => {
  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/50 dark:bg-slate-900/20 p-4 space-y-2.5 shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-600/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-800 text-white flex items-center justify-center shrink-0">
            <MessageSquare size={14} />
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-blue-950 dark:text-blue-200">
            Nhận xét giáo viên
          </h4>
        </div>

        {teacherFeedback ? (
          typeof score === "number" && (
            <span className="text-xs font-bold tabular-nums text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-200 dark:border-slate-700">
              {score.toFixed(1)}/10
            </span>
          )
        ) : (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Chờ chấm
          </span>
        )}
      </div>

      {teacherFeedback ? (
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
          {teacherFeedback}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Chưa có nhận xét.
        </p>
      )}
    </div>
  );
};

export default TeacherFeedbackCard;
