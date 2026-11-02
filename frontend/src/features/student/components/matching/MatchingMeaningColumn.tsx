import React from "react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { RightMeaningItem, LeftWordItem } from "./matchingTypes";

interface MatchingMeaningColumnProps {
  rightItems: RightMeaningItem[];
  leftItems: LeftWordItem[];
  connections: Record<string, string>;
  selectedRightId: string | null;
  rightAnchorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  isReview?: boolean;
  onRightClick: (item: RightMeaningItem) => void;
}

export const MatchingMeaningColumn: React.FC<MatchingMeaningColumnProps> = ({
  rightItems,
  leftItems,
  connections,
  selectedRightId,
  rightAnchorRefs,
  isReview = false,
  onRightClick,
}) => {
  return (
    <div className="w-full md:w-1/2 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-[11px] font-bold">
            B
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Ý NGHĨA &amp; ĐỊNH NGHĨA TIẾNG VIỆT
          </h3>
        </div>
        <span className="text-[10px] font-medium text-slate-400">
          Bấm để chọn / nối thẻ
        </span>
      </div>

      <div className="space-y-2.5">
        {rightItems.map((item, idx) => {
          const linkedLeftId = Object.keys(connections).find(
            (lId) => connections[lId] === item.id,
          );
          const isMatched = Boolean(linkedLeftId);
          const isSelected = selectedRightId === item.id;

          const linkedLeftItem = leftItems.find((l) => l.id === linkedLeftId);

          const isCorrectReview =
            linkedLeftItem?.isCorrect === true ||
            (linkedLeftItem?.correctAnswer &&
              item.text.trim().toLowerCase() ===
                linkedLeftItem.correctAnswer.trim().toLowerCase());

          return (
            <div
              key={item.id}
              onClick={() => onRightClick(item)}
              className={`relative p-2.5 sm:p-3 rounded-lg border transition-all cursor-pointer select-none flex items-center justify-between gap-2.5 ${
                isReview
                  ? isMatched
                    ? isCorrectReview
                      ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30"
                      : "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-80"
                  : isSelected
                  ? "border-blue-700 bg-blue-50/80 dark:bg-slate-900/60 shadow-xs ring-2 ring-blue-600/20"
                  : isMatched
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-600"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-850"
              }`}
            >
              {/* Anchor Dot on left of card */}
              <div
                ref={(el) => {
                  rightAnchorRefs.current[item.id] = el;
                }}
                className={`absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all z-20 ${
                  isReview
                    ? isMatched
                      ? isCorrectReview
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-rose-500 bg-rose-500"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    : isMatched
                    ? "border-emerald-500 bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/40"
                    : isSelected
                    ? "border-blue-700 bg-blue-800 ring-4 ring-blue-500 dark:ring-blue-700/60 animate-pulse"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                }`}
              />

              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                    isReview
                      ? isMatched
                        ? isCorrectReview
                          ? "bg-emerald-600 text-white"
                          : "bg-rose-600 text-white"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      : isMatched
                      ? "bg-emerald-600 text-white"
                      : isSelected
                      ? "bg-blue-800 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>

                <span className="text-xs sm:text-[13px] font-medium text-slate-800 dark:text-slate-200 leading-snug">
                  {item.text || "—"}
                </span>
              </div>

              {/* Review icon */}
              {isReview && (
                <div className="shrink-0">
                  {isMatched ? (
                    isCorrectReview ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <XCircle size={18} className="text-rose-500" />
                    )
                  ) : (
                    <AlertCircle size={18} className="text-slate-400" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchingMeaningColumn;
