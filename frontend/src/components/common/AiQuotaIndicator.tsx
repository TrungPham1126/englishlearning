// src/components/common/AiQuotaIndicator.tsx
import React, { useState, useEffect } from "react";
import { Zap, ShieldCheck, Cpu } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

export interface AiQuotaIndicatorProps {
  used?: number;
  total?: number;
  className?: string;
}

export function AiQuotaIndicator({
  used = 18,
  total = 50,
  className,
}: AiQuotaIndicatorProps) {
  const [quotaUsed, setQuotaUsed] = useState(used);
  const [quotaLimit, setQuotaLimit] = useState(total);

  useEffect(() => {
    try {
      const storedUsed = localStorage.getItem("elp_ai_quota_used");
      const storedLimit = localStorage.getItem("elp_ai_quota_limit");
      if (storedUsed) setQuotaUsed(parseInt(storedUsed, 10));
      if (storedLimit) setQuotaLimit(parseInt(storedLimit, 10));
    } catch {
      // ignore
    }
  }, []);

  const remaining = Math.max(0, quotaLimit - quotaUsed);
  const pct = Math.round((remaining / quotaLimit) * 100);

  const isLow = pct <= 20;
  const isExhausted = remaining === 0;

  return (
    <Tooltip
      content={
        <div className="p-1 space-y-1.5 text-left min-w-[210px]">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1">
            <span className="font-bold text-white text-xs">Hạn ngạch AI hôm nay</span>
            <span
              className={cn(
                "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                isExhausted
                  ? "bg-rose-900/60 text-rose-300"
                  : isLow
                  ? "bg-amber-900/60 text-amber-300"
                  : "bg-emerald-900/60 text-emerald-300",
              )}
            >
              {remaining}/{quotaLimit} lượt
            </span>
          </div>

          <div className="text-[10px] text-slate-300 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Cpu size={11} className="text-blue-400" /> Tier 1 Cloud AI
              </span>
              <span className="text-emerald-400 font-semibold">Hoạt động</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-400" /> Tier 2/3 Fallback
              </span>
              <span className="text-slate-400">Tự động kích hoạt</span>
            </div>
          </div>
        </div>
      }
    >
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold select-none cursor-pointer transition-colors shadow-2xs",
          isExhausted
            ? "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
            : isLow
            ? "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60 text-amber-700 dark:text-amber-300"
            : "bg-blue-50 border-blue-200/80 dark:bg-blue-950/40 dark:border-blue-900/60 text-blue-800 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40",
          className,
        )}
      >
        <Zap
          size={14}
          className={cn(
            isExhausted
              ? "text-rose-500"
              : isLow
              ? "text-amber-500"
              : "text-blue-700 dark:text-blue-400 fill-blue-500/20",
          )}
        />
        <span className="hidden sm:inline text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          AI:
        </span>
        <span className="font-mono tabular-nums">{remaining}</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
          /{quotaLimit}
        </span>
      </div>
    </Tooltip>
  );
}
