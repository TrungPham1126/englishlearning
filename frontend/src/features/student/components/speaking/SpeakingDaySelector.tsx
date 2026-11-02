import React from "react";
import { Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DaySpeakingGroup } from "@/features/student/types";

export interface SpeakingDaySelectorProps {
  daysList: DaySpeakingGroup[];
  selectedDayId: string | null;
  onSelectDay: (day: DaySpeakingGroup) => void;
}

export const SpeakingDaySelector: React.FC<SpeakingDaySelectorProps> = ({
  daysList,
  selectedDayId,
  onSelectDay,
}) => {
  return (
    <div className="elp-card bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-blue-700 dark:text-blue-400" />
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
            Lộ trình bài tập Speaking theo Ngày (Daily Plan):
          </h2>
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
          {daysList.length} Ngày trong lộ trình
        </span>
      </div>

      {daysList.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
          <AlertTriangle className="mx-auto text-amber-500" size={32} />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Chưa có ngày học nào được giao bài Speaking trong lớp này.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
          {daysList.map((day) => {
            const isSelectedDay = day.id === selectedDayId;
            const completedCount = day.speakingTasks.filter((t) => t.isCompleted).length;
            const totalCount = day.speakingTasks.length;
            const allDone = totalCount > 0 && completedCount === totalCount;

            return (
              <button
                key={day.id}
                type="button"
                onClick={() => onSelectDay(day)}
                className={`flex flex-col items-center justify-center min-w-[120px] py-2 px-3 rounded-lg border transition cursor-pointer shrink-0 text-left ${
                  isSelectedDay
                    ? "border-blue-700 bg-blue-50/70 dark:bg-blue-600/15 shadow-xs ring-2 ring-blue-600/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 hover:bg-slate-100/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 w-full justify-between">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isSelectedDay ? "text-blue-800 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    Ngày {day.dayNumber}
                  </span>
                  {allDone ? (
                    <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                  ) : day.isCurrentDay ? (
                    <span className="h-2 w-2 rounded-full bg-blue-800 animate-pulse" />
                  ) : null}
                </div>

                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate w-full">
                  {day.scheduledDate || day.title}
                </span>

                <div className="mt-2 w-full flex items-center justify-between text-[10px]">
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded ${
                      isSelectedDay
                        ? "bg-blue-200/60 dark:bg-blue-600/30 text-blue-900 dark:text-blue-200"
                        : "bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {totalCount} bài nói
                  </span>
                  {allDone && (
                    <span className="text-emerald-700 dark:text-emerald-400 font-black">
                      Đã nộp ({completedCount}/{totalCount})
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SpeakingDaySelector;
