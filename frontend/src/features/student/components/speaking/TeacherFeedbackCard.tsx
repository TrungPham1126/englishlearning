import React from "react";
import { Lightbulb } from "lucide-react";

export interface TeacherFeedbackCardProps {
  teacherFeedback?: string;
  score?: number | null;
  dayNumber: number;
}

export const TeacherFeedbackCard: React.FC<TeacherFeedbackCardProps> = ({
  teacherFeedback,
  score,
  dayNumber,
}) => {
  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/50 dark:bg-slate-900/20 p-4 sm:p-5 space-y-2.5 shadow-card">
      <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-600/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-blue-800 text-white flex items-center justify-center font-bold text-base shadow-xs">
            👩‍🏫
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wide">
              Nhận Xét & Đánh Giá Của Giáo Viên (Cô Giáo)
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Giáo viên phụ trách lớp học
            </span>
          </div>
        </div>

        {teacherFeedback ? (
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/30 shadow-2xs">
            ✓ Đã có nhận xét
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md">
            Chờ cô giáo phê duyệt thêm
          </span>
        )}
      </div>

      {teacherFeedback ? (
        <div className="space-y-1.5 pt-1">
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-blue-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed font-medium shadow-2xs whitespace-pre-wrap">
            "{teacherFeedback}"
          </div>
          {typeof score === "number" && (
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">
              Điểm giáo viên ghi nhận:{" "}
              <span className="text-sm font-bold text-blue-800 dark:text-blue-400">
                {score.toFixed(1)} / 10 pts
              </span>
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-xl border border-dashed border-blue-200 dark:border-blue-600/30 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Lightbulb size={16} className="text-amber-500 shrink-0" />
          <span>
            Bài tập Ngày {dayNumber} đã được chấm điểm. Khi cô giáo xem lại bài nộp, nhận xét chi tiết của cô sẽ hiển thị tại đây.
          </span>
        </div>
      )}
    </div>
  );
};

export default TeacherFeedbackCard;
