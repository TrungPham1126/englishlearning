// src/components/common/StreakBadge.tsx
import React, { useState, useEffect } from "react";
import { Flame } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

export interface StreakBadgeProps {
  initialStreak?: number;
  className?: string;
}

export function StreakBadge({ initialStreak = 5, className }: StreakBadgeProps) {
  const [streak, setStreak] = useState(initialStreak);

  useEffect(() => {
    // Tự động đọc dữ liệu streak nếu được lưu từ Daily Plan hoặc profile
    try {
      const storedStreak = localStorage.getItem("elp_student_streak");
      if (storedStreak) {
        setStreak(parseInt(storedStreak, 10));
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <Tooltip
      content={
        <div className="text-center p-1">
          <p className="font-bold text-amber-400">🔥 Chuỗi học tập: {streak} ngày liên tục</p>
          <p className="text-slate-300 text-[10px] mt-0.5">
            Hoàn thành mục tiêu học tập hôm nay để bảo toàn và tăng Streak!
          </p>
        </div>
      }
    >
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-black select-none cursor-pointer hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors shadow-2xs",
          className,
        )}
      >
        <Flame size={15} className="text-amber-500 animate-pulse fill-amber-500/20" />
        <span className="font-mono tabular-nums">{streak}</span>
        <span className="hidden sm:inline text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          Ngày
        </span>
      </div>
    </Tooltip>
  );
}
