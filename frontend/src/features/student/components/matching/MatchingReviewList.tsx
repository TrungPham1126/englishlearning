import React from "react";
import { CheckCircle2, XCircle, AlertCircle, BookOpen } from "lucide-react";
import type { LeftWordItem, RightMeaningItem } from "./matchingTypes";

interface MatchingReviewListProps {
  leftItems: LeftWordItem[];
  rightItems: RightMeaningItem[];
  connections: Record<string, string>;
}

export const MatchingReviewList: React.FC<MatchingReviewListProps> = ({
  leftItems,
  rightItems,
  connections,
}) => {
  const correctCount = leftItems.filter((item) => {
    const connectedRightId = connections[item.id];
    const matchedRight = rightItems.find((r) => r.id === connectedRightId);
    return (
      item.isCorrect === true ||
      (Boolean(item.correctAnswer) &&
        matchedRight?.text?.trim().toLowerCase() ===
          item.correctAnswer?.trim().toLowerCase())
    );
  }).length;

  return (
    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <BookOpen size={16} className="text-blue-700 dark:text-blue-400" />
          <span>Chi Tiết Kết Quả &amp; Giải Thích Đáp Án</span>
        </h4>
        <span className="text-xs font-black px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          {correctCount} / {leftItems.length} Cặp Đúng
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {leftItems.map((item, idx) => {
          const connectedRightId = connections[item.id];
          const matchedRight = rightItems.find((r) => r.id === connectedRightId);
          const isMatched = Boolean(connectedRightId);
          const isCorrectReview =
            item.isCorrect === true ||
            (Boolean(item.correctAnswer) &&
              matchedRight?.text?.trim().toLowerCase() ===
                item.correctAnswer?.trim().toLowerCase());

          return (
            <div
              key={`review-detail-${item.id}`}
              className={`p-4 rounded-xl border transition-all space-y-3 ${
                !isMatched
                  ? "border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20"
                  : isCorrectReview
                  ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20"
                  : "border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${
                      !isMatched
                        ? "bg-amber-500 text-white"
                        : isCorrectReview
                        ? "bg-emerald-600 text-white"
                        : "bg-rose-600 text-white"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {item.word}
                  </span>
                  {item.ipa && (
                    <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-slate-900/60 px-2 py-0.5 rounded">
                      {item.ipa}
                    </span>
                  )}
                </div>

                <div className="shrink-0">
                  {!isMatched ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      CHƯA NỐI
                    </span>
                  ) : isCorrectReview ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      CHÍNH XÁC
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      NỐI SAI
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs space-y-1 bg-white/70 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-1">
                  <span className="font-bold text-slate-500 dark:text-slate-400">Bạn đã nối:</span>
                  <span
                    className={`font-bold ${
                      isCorrectReview
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {matchedRight?.text || "Chưa chọn đáp án"}
                  </span>
                </div>
                {!isCorrectReview && item.correctAnswer && (
                  <div className="flex items-start gap-1">
                    <span className="font-bold text-slate-500 dark:text-slate-400">Đáp án đúng:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {item.correctAnswer}
                    </span>
                  </div>
                )}
              </div>

              {item.explanation && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed italic">
                  💡 {item.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchingReviewList;
