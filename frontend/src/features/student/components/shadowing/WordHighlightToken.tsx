// src/features/student/components/shadowing/WordHighlightToken.tsx
import { memo } from "react";
import type { SentenceToken } from "@/features/student/types";

export interface WordHighlightTokenProps {
  readonly token: SentenceToken;
  readonly ipaText?: string;
  readonly score?: number;
  readonly isSelected: boolean;
  readonly onSelect: (wordKey: string) => void;
}

interface TokenVisualStyle {
  readonly container: string;
  readonly underline: string;
  readonly badge: string;
  readonly srStatus: string;
}

const COLOR_STYLE_MAP: Record<SentenceToken["color"], TokenVisualStyle> = {
  GREEN: {
    container:
      "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700/80 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60",
    underline: "underline decoration-emerald-600 dark:decoration-emerald-400 decoration-2",
    badge: "✓",
    srStatus: "Phát âm chuẩn",
  },
  YELLOW: {
    container:
      "bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700/80 hover:bg-amber-100/80 dark:hover:bg-amber-900/60",
    underline:
      "underline decoration-wavy decoration-amber-600 dark:decoration-amber-400 decoration-2",
    badge: "~",
    srStatus: "Cần cải thiện",
  },
  RED: {
    container:
      "bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700/80 hover:bg-rose-100/80 dark:hover:bg-rose-900/60",
    underline:
      "underline decoration-double decoration-rose-600 dark:decoration-rose-400 decoration-2",
    badge: "!",
    srStatus: "Phát âm sai",
  },
  GRAY: {
    container:
      "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-800",
    underline: "",
    badge: "",
    srStatus: "Chưa đọc",
  },
};

export const WordHighlightToken = memo<WordHighlightTokenProps>(
  function WordHighlightToken({
    token,
    ipaText,
    score,
    isSelected,
    onSelect,
  }) {
    const cleanKey = token.word.replace(/[.,?!]/g, "").toLowerCase();
    const style = COLOR_STYLE_MAP[token.color] ?? COLOR_STYLE_MAP.GRAY;

    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(cleanKey)}
          aria-pressed={isSelected}
          aria-label={`Từ ${token.word}${ipaText ? `, phiên âm ${ipaText}` : ""}, trạng thái: ${
            style.srStatus
          }${score !== undefined ? `, điểm ${score} trên 100` : ""}`}
          className={`group relative inline-flex flex-col items-center px-3.5 py-2 rounded-xl border-2 transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-500 ${
            style.container
          } ${
            isSelected
              ? "ring-2 ring-blue-700 dark:ring-blue-500 shadow-md -translate-y-0.5"
              : "hover:-translate-y-0.5 shadow-2xs"
          }`}
        >
          <span
            className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight underline-offset-8 ${style.underline}`}
          >
            {token.word}
          </span>

          {(ipaText || style.badge || score !== undefined) && (
            <span className="mt-1 flex items-center gap-1 text-[11px] sm:text-xs font-mono opacity-85">
              {ipaText && <span>/{ipaText}/</span>}
              {score !== undefined && score > 0 && (
                <span className="font-bold">({score}%)</span>
              )}
              {style.badge && (
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black bg-current/15"
                >
                  {style.badge}
                </span>
              )}
            </span>
          )}
        </button>

        {token.hasLinkingAfter && (
          <span
            aria-label="Ký hiệu nối âm"
            title="Nối âm (Liaison)"
            className="text-blue-700 dark:text-blue-400 font-black text-xl px-0.5 select-none"
          >
            ‿
          </span>
        )}

        {token.hasPauseAfter && (
          <span
            aria-label="Ký hiệu ngắt nhịp"
            title="Ngắt nhịp (Pause)"
            className="text-slate-500 dark:text-slate-400 font-black text-sm px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 select-none"
          >
            ||
          </span>
        )}
      </span>
    );
  },
);
