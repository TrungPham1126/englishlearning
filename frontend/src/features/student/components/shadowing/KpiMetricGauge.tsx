// src/features/student/components/shadowing/KpiMetricGauge.tsx
import { memo } from "react";

export interface KpiMetricGaugeProps {
  readonly label: string;
  readonly subtitle: string;
  readonly score: number;
  readonly accent: "emerald" | "indigo" | "amber";
}

const ACCENT_MAP: Record<
  KpiMetricGaugeProps["accent"],
  { readonly stroke: string; readonly wrapper: string }
> = {
  emerald: {
    stroke: "text-emerald-600 dark:text-emerald-400",
    wrapper:
      "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70",
  },
  indigo: {
    stroke: "text-blue-700 dark:text-blue-400",
    wrapper:
      "bg-blue-50/70 dark:bg-slate-900/40 border-blue-200 dark:border-blue-900/70",
  },
  amber: {
    stroke: "text-amber-600 dark:text-amber-400",
    wrapper:
      "bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70",
  },
};

export const KpiMetricGauge = memo<KpiMetricGaugeProps>(
  function KpiMetricGauge({ label, subtitle, score, accent }) {
    const safeScore = Math.max(0, Math.min(100, Math.round(score)));
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (safeScore / 100) * circumference;
    const style = ACCENT_MAP[accent];

    return (
      <div
        role="progressbar"
        aria-label={`Chỉ số ${label}: ${safeScore} trên 100`}
        aria-valuenow={safeScore}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`flex flex-col items-center p-4 rounded-xl border ${style.wrapper}`}
      >
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 76 76">
            <circle
              cx="38"
              cy="38"
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth="6"
              className="text-slate-200 dark:text-slate-800"
            />
            <circle
              cx="38"
              cy="38"
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={`transition-all duration-700 ease-out ${style.stroke}`}
            />
          </svg>
          <span className="absolute text-lg font-black text-slate-900 dark:text-white">
            {safeScore}%
          </span>
        </div>
        <span className="mt-2 text-sm font-black text-slate-900 dark:text-white">
          {label}
        </span>
        <span className="text-[11px] text-center font-medium text-slate-600 dark:text-slate-400">
          {subtitle}
        </span>
      </div>
    );
  },
);
