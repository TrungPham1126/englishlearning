import React from "react";
import { Layers, RotateCcw, Check, HelpCircle } from "lucide-react";
import type { VocabularyMatchingBoardProps } from "./matching/matchingTypes";
import {
  useMatchingLines,
  MatchingSvgOverlay,
  MatchingWordColumn,
  MatchingMeaningColumn,
  MatchingReviewList,
} from "./matching";

export * from "./matching/matchingTypes";

const VocabularyMatchingBoardComponent: React.FC<VocabularyMatchingBoardProps> = (props) => {
  const { disabled = false, isReview = false } = props;

  const {
    containerRef,
    leftAnchorRefs,
    rightAnchorRefs,
    leftItems,
    rightItems,
    connections,
    selectedLeftId,
    selectedRightId,
    playingWord,
    rayCoordinates,
    handlePlayAudio,
    handleLeftClick,
    handleRightClick,
    handleReset,
  } = useMatchingLines(props);

  const matchedCount = Object.keys(connections).length;

  return (
    <div className="w-full space-y-4 select-none animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="p-3 sm:p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-700 dark:bg-blue-600 text-white shadow-xs">
            <Layers size={16} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-950 dark:text-blue-200">
              Ghép Cặp Từ Vựng &amp; Định Nghĩa (Matching Ray Game)
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Bấm vào thẻ Từ tiếng Anh bên trái, sau đó bấm vào thẻ Ý nghĩa tương ứng bên phải để nối tia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs">
            Đã nối: {matchedCount} / {leftItems.length} cặp
          </span>

          {!isReview && !disabled && matchedCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer transition ml-2"
              title="Đặt lại toàn bộ các đường nối"
            >
              <RotateCcw size={13} />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Matching Canvas & Two Columns */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4 sm:p-6 min-h-[420px]"
      >
        {/* SVG Ray Lines Overlay */}
        <MatchingSvgOverlay
          rayCoordinates={rayCoordinates}
          isReview={isReview}
        />

        {/* 2 Interactive Columns */}
        <div className="flex flex-col md:flex-row justify-between items-stretch gap-6 md:gap-10 relative z-0">
          <MatchingWordColumn
            leftItems={leftItems}
            rightItems={rightItems}
            connections={connections}
            selectedLeftId={selectedLeftId}
            playingWord={playingWord}
            leftAnchorRefs={leftAnchorRefs}
            isReview={isReview}
            onLeftClick={handleLeftClick}
            onPlayAudio={handlePlayAudio}
          />

          <MatchingMeaningColumn
            rightItems={rightItems}
            leftItems={leftItems}
            connections={connections}
            selectedRightId={selectedRightId}
            rightAnchorRefs={rightAnchorRefs}
            isReview={isReview}
            onRightClick={handleRightClick}
          />
        </div>

        {/* Review Mode Bottom Summary */}
        {isReview && (
          <MatchingReviewList
            leftItems={leftItems}
            rightItems={rightItems}
            connections={connections}
          />
        )}
      </div>

      {/* Footer Hint */}
      {!isReview && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 italic px-2">
          <HelpCircle size={14} className="text-blue-500 shrink-0" />
          <span>
            Mẹo: Bạn có thể bấm vào thẻ đã nối để hủy đường nối và chọn lại bất kỳ lúc nào trước khi nộp bài.
          </span>
        </div>
      )}
    </div>
  );
};

export const VocabularyMatchingBoard = React.memo(VocabularyMatchingBoardComponent);
export default VocabularyMatchingBoard;
