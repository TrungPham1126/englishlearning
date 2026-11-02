import React from "react";
import { Volume2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { LeftWordItem, RightMeaningItem } from "./matchingTypes";

interface MatchingWordColumnProps {
  leftItems: LeftWordItem[];
  rightItems: RightMeaningItem[];
  connections: Record<string, string>;
  selectedLeftId: string | null;
  playingWord: string | null;
  leftAnchorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  isReview?: boolean;
  onLeftClick: (item: LeftWordItem) => void;
  onPlayAudio: (word: string, customAudioUrl?: string, e?: React.MouseEvent) => void;
}

export const MatchingWordColumn: React.FC<MatchingWordColumnProps> = ({
  leftItems,
  rightItems,
  connections,
  selectedLeftId,
  playingWord,
  leftAnchorRefs,
  isReview = false,
  onLeftClick,
  onPlayAudio,
}) => {
  return (
    <div className="w-full md:w-1/2 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center text-[11px] font-bold">
            A
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            TỪ TIẾNG ANH &amp; PHIÊN ÂM IPA
          </h3>
        </div>
        <span className="text-[10px] font-medium text-slate-400">
          Bấm từ/IPA để phát âm
        </span>
      </div>

      <div className="space-y-2.5">
        {leftItems.map((item, idx) => {
          const connectedRightId = connections[item.id];
          const isMatched = Boolean(connectedRightId);
          const isSelected = selectedLeftId === item.id;
          const isPlaying = playingWord === item.word;

          const matchedRight = rightItems.find(
            (r) => r.id === connectedRightId,
          );

          const isCorrectReview =
            item.isCorrect === true ||
            (item.correctAnswer &&
              matchedRight?.text?.trim().toLowerCase() ===
                item.correctAnswer.trim().toLowerCase());

          return (
            <div
              key={item.id}
              onClick={() => onLeftClick(item)}
              className={`relative p-2.5 sm:p-3 rounded-lg border transition-all cursor-pointer select-none flex items-center justify-between gap-2.5 ${
                isReview
                  ? isMatched
                    ? isCorrectReview
                      ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30"
                      : "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30"
                    : "border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/20"
                  : isSelected
                  ? "border-blue-700 bg-blue-50/80 dark:bg-slate-900/60 shadow-xs ring-2 ring-blue-600/20"
                  : isMatched
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-600"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-850"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                    isReview
                      ? isMatched
                        ? isCorrectReview
                          ? "bg-emerald-600 text-white"
                          : "bg-rose-600 text-white"
                        : "bg-amber-500 text-white"
                      : isMatched
                      ? "bg-emerald-600 text-white"
                      : isSelected
                      ? "bg-blue-800 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    onClick={(e) => onPlayAudio(item.word, item.audioUrl, e)}
                    className="text-sm sm:text-[15px] font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 transition cursor-pointer"
                    title="Bấm để nghe phát âm"
                  >
                    {item.word}
                  </span>

                  {item.ipa && (
                    <span
                      onClick={(e) => onPlayAudio(item.word, item.audioUrl, e)}
                      className="text-[11px] font-mono font-medium text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-slate-900/60 hover:bg-blue-100 dark:hover:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900/80 transition cursor-pointer"
                      title="Phiên âm IPA - Bấm để nghe phát âm chuẩn"
                    >
                      {item.ipa}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => onPlayAudio(item.word, item.audioUrl, e)}
                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                    isPlaying
                      ? "bg-blue-800 text-white border-blue-700 animate-pulse"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400"
                  }`}
                  title="Nghe phát âm chuẩn bản xứ"
                >
                  <Volume2
                    size={15}
                    className={isPlaying ? "scale-105 transition-transform" : ""}
                  />
                </button>

                {isReview && (
                  <div className="ml-1">
                    {isMatched ? (
                      isCorrectReview ? (
                        <CheckCircle2 size={18} className="text-emerald-500" />
                      ) : (
                        <XCircle size={18} className="text-rose-500" />
                      )
                    ) : (
                      <AlertCircle size={18} className="text-amber-500" />
                    )}
                  </div>
                )}
              </div>

              {/* Anchor Dot */}
              <div
                ref={(el) => {
                  leftAnchorRefs.current[item.id] = el;
                }}
                className={`absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all z-20 ${
                  isReview
                    ? isMatched
                      ? isCorrectReview
                        ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200 dark:shadow-none"
                        : "border-rose-500 bg-rose-500 shadow-sm shadow-rose-200 dark:shadow-none"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    : isMatched
                    ? "border-emerald-500 bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/40"
                    : isSelected
                    ? "border-blue-700 bg-blue-800 ring-4 ring-blue-500 dark:ring-blue-700/60 animate-pulse"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchingWordColumn;
