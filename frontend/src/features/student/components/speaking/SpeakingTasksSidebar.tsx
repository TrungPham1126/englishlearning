import React from "react";
import {
  Mic,
  Headphones,
  MessageSquare,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react";
import type { AttemptResponse, DaySpeakingGroup } from "@/features/student/types";

export interface SpeakingTasksSidebarProps {
  currentDay: DaySpeakingGroup | null;
  selectedAssignmentId: string | null;
  attempts: AttemptResponse[];
  currentAttemptId?: string;
  switching: boolean;
  isSubmitted?: boolean;
  onSelectAssignment: (asgId: string) => void;
  onSelectAttempt: (attempt: AttemptResponse) => void;
  onRetake: () => void;
}

export const SpeakingTasksSidebar: React.FC<SpeakingTasksSidebarProps> = ({
  currentDay,
  selectedAssignmentId,
  attempts,
  currentAttemptId,
  switching,
  isSubmitted = false,
  onSelectAssignment,
  onSelectAttempt,
  onRetake,
}) => {
  if (!currentDay) return null;

  return (
    <div className="space-y-4">
      {/* Box 1: Danh sách bài tập của Ngày đang chọn */}
      <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/70 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Mic size={14} className="text-blue-700 dark:text-blue-400" />
            Bài tập Ngày {currentDay.dayNumber}
          </span>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {currentDay.speakingTasks.length} bài
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[350px] overflow-y-auto">
          {currentDay.speakingTasks.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Ngày này chưa có bài tập Speaking nào
            </div>
          ) : (
            currentDay.speakingTasks.map((asg) => {
              const isAct = asg.id === selectedAssignmentId;
              return (
                <div
                  key={asg.id}
                  onClick={() => onSelectAssignment(asg.id)}
                  className={`p-3 cursor-pointer transition flex items-center justify-between gap-3 ${
                    isAct
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border border-blue-700 dark:border-blue-500 rounded-lg"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        asg.isShadowing
                          ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                          : "bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300"
                      }`}
                    >
                      {asg.isShadowing ? (
                        <Headphones size={16} />
                      ) : (
                        <MessageSquare size={16} />
                      )}
                    </div>
                    <div className="truncate">
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          asg.isShadowing
                            ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                            : "bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-600/30"
                        }`}
                      >
                        {asg.isShadowing ? "Shadowing" : "Speaking Q&A"}
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                        {asg.title}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {asg.isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md">
                        <CheckCircle2 size={11} /> Đã nộp
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md">
                        Chưa nộp
                      </span>
                    )}
                    {asg.highestScore !== undefined && asg.highestScore !== null && (
                      <p className="text-[11px] font-bold text-blue-800 dark:text-blue-400 mt-0.5">
                        {asg.highestScore.toFixed(1)} pts
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Box 2: Lịch Sử Lượt Nộp Bài Của Bài Tập Đang Chọn */}
      <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/70 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={13} className="text-blue-700 dark:text-blue-400" />
            Lịch Sử Các Lần Nộp
          </span>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {attempts.length} lượt
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
          {attempts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Chưa có lượt nộp bài nào
            </div>
          ) : (
            attempts.map((att) => {
              const isSelectedAtt = att.attemptId === currentAttemptId;
              const isDone = att.status !== "IN_PROGRESS";
              return (
                <div
                  key={att.attemptId}
                  onClick={() => {
                    if (!switching && !isSelectedAtt) {
                      onSelectAttempt(att);
                    }
                  }}
                  className={`p-3.5 cursor-pointer transition ${
                    isSelectedAtt
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border border-blue-700 dark:border-blue-500 rounded-md"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Lần làm #{att.attemptNumber}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        isDone
                          ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-500/20"
                          : "text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-500/20"
                      }`}
                    >
                      {isDone ? (
                        att.score !== undefined && att.score !== null ? (
                          `${att.score.toFixed(1)} pts`
                        ) : (
                          "Đã hoàn thành"
                        )
                      ) : (
                        "Đang làm dở"
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {att.submittedAt
                        ? new Date(att.submittedAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Chưa nộp"}
                    </span>
                    <span>
                      {att.submittedAt
                        ? new Date(att.submittedAt).toLocaleDateString("vi-VN")
                        : ""}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {isSubmitted && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              disabled={switching}
              onClick={onRetake}
              className="w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RotateCcw size={13} className="text-blue-700 dark:text-blue-400" />
              <span>Luyện tập lại (Tạo bài nộp mới)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeakingTasksSidebar;
