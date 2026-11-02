// src/features/student/components/speaking/SpeakingSubmissionDaysList.tsx
import React, { useState, useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Headphones,
  MessageSquare,
  XCircle,
  Video,
  PlayCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DaySpeakingGroup } from "@/features/student/types";
import { normalizeScoreTo100 } from "@/features/student/utils/speakingScoring";

const MAX_ATTEMPTS = 3;
const dayTypeLabel = (tasks: { isShadowing?: boolean }[]) => {
  const hasShadow = tasks.some((t) => t.isShadowing);
  const hasQa = tasks.some((t) => !t.isShadowing);
  if (hasShadow && hasQa) return "SHADOWING & Q&A";
  return hasShadow ? "SHADOWING" : "Q&A";
};
const PASS_SCORE = 80;

export interface SpeakingSubmissionDaysListProps {
  daysList: DaySpeakingGroup[];
  selectedDayId: string | null;
  selectedAssignmentId: string | null;
  onSelectDay: (day: DaySpeakingGroup) => void;
  onSelectAssignment: (asgId: string) => void;
}

/**
 * Cột bên trái: Danh sách các Ngày có bài nộp Speaking / Shadowing AI.
 * Ngày nào không có bài AI sẽ không hiển thị.
 * Bấm vào ngày để xem chi tiết lịch sử bài nộp ở cột bên phải.
 */
export const SpeakingSubmissionDaysList: React.FC<SpeakingSubmissionDaysListProps> = ({
  daysList,
  selectedDayId,
  selectedAssignmentId,
  onSelectDay,
  onSelectAssignment,
}) => {
  const navigate = useNavigate();
  // Bộ lọc: 'all' (Tất cả ngày có bài AI) hoặc 'submitted' (Chỉ hiện ngày đã có bài nộp)
  const [filterMode, setFilterMode] = useState<"all" | "submitted">("all");

  // Lọc chỉ giữ các ngày có bài tập Speaking AI
  const aiDays = useMemo(() => {
    return daysList.filter((day) => day.speakingTasks && day.speakingTasks.length > 0);
  }, [daysList]);

  // Áp dụng bộ lọc
  const filteredDays = useMemo(() => {
    if (filterMode === "submitted") {
      return aiDays.filter((day) =>
        day.speakingTasks.some((t) => t.isCompleted || (t.attemptsCount && t.attemptsCount > 0)),
      );
    }
    return aiDays;
  }, [aiDays, filterMode]);

  return (
    <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden flex flex-col">
      {/* Header cột trái */}
      <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Video size={14} className="text-blue-700 dark:text-blue-400" />
            Bài Speaking Đã Nộp
          </span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            {filteredDays.length} ngày
          </span>
        </div>

        {/* Tab lọc nhanh */}
        <div className="grid grid-cols-2 gap-1 bg-slate-200/60 dark:bg-slate-900/60 p-0.5 rounded-lg text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`py-1 rounded-md transition cursor-pointer ${
              filterMode === "all"
                ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-2xs font-black"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Tất cả bài ({aiDays.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("submitted")}
            className={`py-1 rounded-md transition cursor-pointer ${
              filterMode === "submitted"
                ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-2xs font-black"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Đã có bài nộp
          </button>
        </div>
      </div>

      {/* Danh sách các Ngày theo chiều dọc (Vertical List) */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin p-1.5 space-y-1">
        {filteredDays.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <Calendar className="mx-auto text-slate-400" size={24} />
            <p className="font-semibold">
              {filterMode === "submitted"
                ? "Chưa có ngày nào có bài nộp."
                : "Không có bài Speaking nào trong lộ trình."}
            </p>
          </div>
        ) : (
          filteredDays.map((day) => {
            const isSelectedDay = day.id === selectedDayId;
            const primaryTask = day.speakingTasks[0];
            const isShadowing = primaryTask?.isShadowing;

            // Xác định trạng thái nộp bài tổng quan của Ngày (Điểm đạt chuẩn >= 80, tối đa 3 lần làm)
            const attemptsCount = primaryTask?.attemptsCount ?? 0;
            const rawHighest = primaryTask?.highestScore ?? null;
            const highestScore = rawHighest !== null ? normalizeScoreTo100(rawHighest) : null;
            const isDone = day.speakingTasks.some((t) => t.isCompleted);
            const isPassed = highestScore !== null && highestScore >= 80;
            const isExhaustedNotPass = !isPassed && attemptsCount >= 3;
            const inProgress = !isDone && attemptsCount > 0;

            return (
              <div
                key={day.id}
                onClick={() => onSelectDay(day)}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                  isSelectedDay
                    ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-700 dark:border-blue-500 ring-2 ring-blue-600/20 shadow-xs"
                    : "border-transparent bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700"
                }`}
              >
                {/* Header Ngày & Loại bài */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span
                      className={`text-xs font-black uppercase tracking-tight block truncate ${
                        isSelectedDay
                          ? "text-blue-900 dark:text-blue-300"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      DAY {day.dayNumber} – {dayTypeLabel(day.speakingTasks)}
                    </span>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1 font-medium">
                      <Clock size={11} className="shrink-0" />
                      <span>{day.scheduledDate || day.title || "Lộ trình học"}</span>
                    </p>
                  </div>

                  {/* Icon loại bài */}
                  <div
                    className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${
                      isShadowing
                        ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : "bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300"
                    }`}
                  >
                    {isShadowing ? <Headphones size={13} /> : <MessageSquare size={13} />}
                  </div>
                </div>

                {/* Subtitle / Trạng thái nộp bài theo quy tắc: >= 80 Pass, 3 lần Not Pass */}
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  {isPassed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                      <CheckCircle2 size={12} />
                      <span>✓ Đã chấm đạt</span>
                    </span>
                  ) : isExhaustedNotPass ? (
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-black">
                      <XCircle size={12} />
                      <span>✗ NOT PASS (Hết lượt)</span>
                    </span>
                  ) : isDone || inProgress ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                      <Clock size={12} />
                      <span>~ Lần {attemptsCount}/3 (Chưa đạt 80)</span>
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      — Chưa nộp (Tối đa 3 lần)
                    </span>
                  )}

                  {highestScore !== null && highestScore !== undefined && (
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                      {highestScore.toFixed(1)} pts
                    </span>
                  )}
                </div>

                {/* Làm bài trực tiếp: chỉ với bài chưa làm hoặc chưa hết lượt & chưa đạt */}
                {day.speakingTasks
                  .filter((t) => {
                    const used = t.attemptsCount ?? 0;
                    const best =
                      t.highestScore != null ? normalizeScoreTo100(t.highestScore) : null;
                    return used < MAX_ATTEMPTS && !(best !== null && best >= PASS_SCORE);
                  })
                  .map((task) => {
                    const used = task.attemptsCount ?? 0;
                    return (
                      <button
                        key={`take-${task.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/student/assignments/${task.id}/take`);
                        }}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-white text-[11px] font-bold transition cursor-pointer shadow-2xs"
                      >
                        <PlayCircle size={13} />
                        <span>
                          {used === 0 ? "Làm bài" : "Làm lại"}
                          {` ${task.isShadowing ? "Shadowing" : "Q&A"}`} (
                          {used}/{MAX_ATTEMPTS})
                        </span>
                      </button>
                    );
                  })}

                {/* Nếu ngày có nhiều hơn 1 bài tập Speaking */}
                {day.speakingTasks.length > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap gap-1">
                    {day.speakingTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDay(day);
                          onSelectAssignment(task.id);
                        }}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                          task.id === selectedAssignmentId
                            ? "bg-blue-800 text-white"
                            : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                        }`}
                      >
                        {task.isShadowing ? "Shadowing" : "Q&A"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SpeakingSubmissionDaysList;
