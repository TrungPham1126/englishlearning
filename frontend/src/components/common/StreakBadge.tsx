// src/components/common/StreakBadge.tsx
import { useState, useEffect } from "react";
import { Flame } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import type { StudentStreakResponse } from "@/features/student/types";

export interface StreakBadgeProps {
  initialStreak?: number;
  hasHomeworkToday?: boolean;
  completedToday?: boolean;
  todayCompletedTasks?: number;
  todayTotalTasks?: number;
  className?: string;
}

const STORAGE_KEY = "elp_student_streak";

function readStoredStreak(): number | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    const trimmed = stored.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function resolveInitialStreak(propValue?: number): number {
  if (typeof propValue === "number" && Number.isFinite(propValue) && propValue >= 0) {
    return Math.floor(propValue);
  }
  return readStoredStreak() ?? 0;
}

export function StreakBadge({
  initialStreak,
  hasHomeworkToday,
  completedToday,
  todayCompletedTasks,
  todayTotalTasks,
  className,
}: StreakBadgeProps) {
  const [streak, setStreak] = useState<number>(() => resolveInitialStreak(initialStreak));
  const [statusInfo, setStatusInfo] = useState<{
    hasHomeworkToday?: boolean;
    completedToday?: boolean;
    todayCompletedTasks?: number;
    todayTotalTasks?: number;
  }>({
    hasHomeworkToday,
    completedToday,
    todayCompletedTasks,
    todayTotalTasks,
  });

  useEffect(() => {
    setStreak(resolveInitialStreak(initialStreak));
  }, [initialStreak]);

  useEffect(() => {
    setStatusInfo({
      hasHomeworkToday,
      completedToday,
      todayCompletedTasks,
      todayTotalTasks,
    });
  }, [hasHomeworkToday, completedToday, todayCompletedTasks, todayTotalTasks]);

  useEffect(() => {
    const handleStreakUpdated = (event: Event) => {
      const detail = (event as CustomEvent<Partial<StudentStreakResponse>>).detail;
      if (!detail || typeof detail !== "object") return;

      if (
        typeof detail.currentStreak === "number" &&
        Number.isFinite(detail.currentStreak) &&
        detail.currentStreak >= 0
      ) {
        setStreak(Math.floor(detail.currentStreak));
      }

      setStatusInfo((prev) => ({
        hasHomeworkToday:
          typeof detail.hasHomeworkToday === "boolean"
            ? detail.hasHomeworkToday
            : prev.hasHomeworkToday,
        completedToday:
          typeof detail.completedToday === "boolean"
            ? detail.completedToday
            : prev.completedToday,
        todayCompletedTasks:
          typeof detail.todayCompletedTasks === "number"
            ? detail.todayCompletedTasks
            : prev.todayCompletedTasks,
        todayTotalTasks:
          typeof detail.todayTotalTasks === "number"
            ? detail.todayTotalTasks
            : prev.todayTotalTasks,
      }));
    };

    window.addEventListener("student-streak-updated", handleStreakUpdated);
    return () => {
      window.removeEventListener("student-streak-updated", handleStreakUpdated);
    };
  }, []);

  const tooltipSubtitle = (() => {
    if (statusInfo.hasHomeworkToday === true && statusInfo.completedToday === true) {
      return "Đã hoàn thành 100% bài tập hôm nay! Tiếp tục duy trì chuỗi nhé.";
    }
    if (statusInfo.hasHomeworkToday === true && statusInfo.completedToday === false) {
      const done = statusInfo.todayCompletedTasks ?? 0;
      const total = statusInfo.todayTotalTasks ?? 0;
      return `Hoàn thành đủ bài tập hôm nay (${done}/${total}) để tăng chuỗi. Ngày không có bài tập sẽ không làm mất chuỗi.`;
    }
    if (statusInfo.hasHomeworkToday === false) {
      return "Hôm nay không có bài tập ngày — chuỗi của bạn vẫn được giữ nguyên!";
    }
    return "Hoàn thành đủ bài tập mỗi ngày có lịch để tăng chuỗi. Ngày không có bài tập sẽ không làm mất chuỗi.";
  })();

  const isActiveStreak = streak > 0;

  return (
    <Tooltip
      position="bottom"
      content={
        <div className="text-center p-1 max-w-[260px] whitespace-normal">
          <p className="font-bold text-amber-400">Chuỗi bài tập ngày: {streak} ngày</p>
          <p className="text-slate-300 text-[10px] mt-0.5">{tooltipSubtitle}</p>
        </div>
      }
    >
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-black select-none cursor-pointer transition-colors shadow-2xs",
          isActiveStreak
            ? "border-amber-200/80 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40"
            : "border-slate-200/80 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/70",
          className,
        )}
      >
        <Flame
          size={15}
          className={
            isActiveStreak
              ? "text-amber-500 animate-pulse fill-amber-500/20"
              : "text-slate-400 dark:text-slate-500"
          }
        />
        <span className="font-mono tabular-nums">{streak}</span>
        <span
          className={cn(
            "hidden sm:inline text-[11px] font-semibold",
            isActiveStreak
              ? "text-amber-600 dark:text-amber-400"
              : "text-slate-500 dark:text-slate-400",
          )}
        >
          Ngày
        </span>
      </div>
    </Tooltip>
  );
}
