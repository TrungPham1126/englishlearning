// src/features/student/components/speaking/AiCoachingCard.tsx
import React from "react";
import { Sparkles, CheckCircle2, Dumbbell } from "lucide-react";
import type { AiCoachingAdvice } from "@/features/student/types";

export interface AiCoachingCardProps {
  readonly coaching?: AiCoachingAdvice | null;
  readonly compact?: boolean;
  readonly title?: string;
}

function resolveCoachBadgeLabel(generatedBy?: string): string | null {
  if (!generatedBy) return null;
  const upper = generatedBy.toUpperCase();
  if (upper.includes("GROQ")) return "Groq AI";
  if (upper.includes("GEMINI")) return "Gemini AI";
  if (upper.includes("IELTS")) return "AI Coach";
  return generatedBy;
}

export const AiCoachingCard: React.FC<AiCoachingCardProps> = ({
  coaching,
  compact = false,
  title = "Lời khuyên từ AI Coach",
}) => {
  if (!coaching) {
    return null;
  }

  const summary = coaching.summary?.trim() || "";
  const actionTips = Array.isArray(coaching.actionTips)
    ? coaching.actionTips.filter((t) => typeof t === "string" && t.trim().length > 0)
    : [];
  const practiceDrill = coaching.practiceDrill?.trim() || "";

  if (!summary && actionTips.length === 0) {
    return null;
  }

  const badgeLabel = resolveCoachBadgeLabel(coaching.generatedBy);

  return (
    <section
      aria-label={title}
      className={`rounded-xl border border-indigo-200 dark:border-indigo-500/35 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/60 dark:from-indigo-950/35 dark:via-slate-900 dark:to-slate-900 shadow-xs ${
        compact ? "p-3.5 space-y-2.5" : "p-4 sm:p-5 space-y-3"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 dark:border-indigo-800/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <Sparkles size={15} aria-hidden="true" />
          </span>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
              {title}
            </h4>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Tổng hợp từ dữ liệu chấm âm học Python
            </p>
          </div>
        </div>

        {badgeLabel && (
          <span className="inline-flex items-center rounded-md bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-700/60 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">
            {badgeLabel}
          </span>
        )}
      </div>

      {summary && (
        <p
          className={`font-semibold text-slate-800 dark:text-slate-100 leading-relaxed ${
            compact ? "text-xs" : "text-xs sm:text-sm"
          }`}
        >
          {summary}
        </p>
      )}

      {actionTips.length > 0 && (
        <ul className="space-y-1.5">
          {actionTips.map((tip, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-2 rounded-lg bg-white/90 dark:bg-slate-950/60 border border-indigo-100/90 dark:border-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200 leading-relaxed ${
                compact ? "text-[11px]" : "text-xs"
              }`}
            >
              <CheckCircle2
                size={14}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}

      {practiceDrill && (
        <div className="rounded-lg border border-dashed border-emerald-300 dark:border-emerald-700/70 bg-emerald-50/70 dark:bg-emerald-950/25 px-3 py-2.5 flex items-start gap-2">
          <Dumbbell
            size={15}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400"
          />
          <div className={compact ? "text-[11px]" : "text-xs"}>
            <span className="font-extrabold text-emerald-800 dark:text-emerald-300 mr-1.5">
              Bài tập luyện ngay:
            </span>
            <span className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
              {practiceDrill}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};

export default AiCoachingCard;
