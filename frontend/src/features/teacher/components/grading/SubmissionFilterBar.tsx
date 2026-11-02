import React from "react";
import { Award } from "lucide-react";
import type { ClassroomItem } from "../../api/teacherApi";

interface SubmissionFilterBarProps {
  classes: ClassroomItem[];
  selectedClassId: string;
  onChangeClassId: (id: string) => void;
  assignments: any[];
  selectedAssignmentId: string;
  onChangeAssignmentId: (id: string) => void;
  loadingClasses: boolean;
  loadingAssignments: boolean;
}

export const SubmissionFilterBar: React.FC<SubmissionFilterBarProps> = ({
  classes,
  selectedClassId,
  onChangeClassId,
  assignments,
  selectedAssignmentId,
  onChangeAssignmentId,
  loadingClasses,
  loadingAssignments,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Trung Tâm Chấm Bài & Đánh Giá
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Xem bài nộp phần Viết đoạn văn (Writing) & Luyện nói (Speaking), tham khảo gợi ý AI và chấm điểm thủ công
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Lựa chọn Lớp học */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-sm">
          <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Lớp:
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => onChangeClassId(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer"
          >
            {loadingClasses ? (
              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Đang tải lớp học...
              </option>
            ) : classes.length === 0 ? (
              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Chưa có lớp phụ trách
              </option>
            ) : (
              classes.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  {c.name} ({c.level || "Chưa set level"})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Lựa chọn Bài tập (Chỉ hiển thị bài Viết & Nói) */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-sm">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Bài tập:
            </label>
            <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
              Viết & Nói
            </span>
          </div>
          <select
            value={selectedAssignmentId}
            onChange={(e) => onChangeAssignmentId(e.target.value)}
            disabled={assignments.length === 0}
            className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer disabled:opacity-50 max-w-[260px] sm:max-w-[340px] truncate"
          >
            {loadingAssignments ? (
              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Đang tải bài tập...
              </option>
            ) : assignments.length === 0 ? (
              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Không có bài tập Viết / Nói nào
              </option>
            ) : (
              assignments.map((a) => {
                const isWriting = a.skillType === "WRITING";
                const isSpeaking = a.skillType === "SPEAKING";
                const badgeLabel = isWriting ? "Viết (Writing)" : isSpeaking ? "Nói (Speaking)" : a.skillType || "Tự luận";
                return (
                  <option
                    key={a.id}
                    value={a.id}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {a.title} ({badgeLabel})
                  </option>
                );
              })
            )}
          </select>
        </div>
      </div>
    </div>
  );
};
