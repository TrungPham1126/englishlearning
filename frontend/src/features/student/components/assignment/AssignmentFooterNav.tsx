import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  LayoutGrid,
  Send,
  Loader2,
} from 'lucide-react';

export interface AssignmentFooterNavProps {
  activeQuestionIdx: number;
  totalQuestions: number;
  answeredCount: number;
  isFlagged: boolean;
  onToggleFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onToggleMobilePalette: () => void;
  phase: 'CHECKING' | 'INTRO' | 'TESTING' | 'REVIEW' | 'EXHAUSTED';
  isSubmitting?: boolean;
  isUploadingAudio?: boolean;
  isNextDisabled?: boolean;
  hidePaletteToggle?: boolean;
}

export const AssignmentFooterNav: React.FC<AssignmentFooterNavProps> = ({
  activeQuestionIdx,
  totalQuestions,
  answeredCount,
  isFlagged,
  onToggleFlag,
  onPrev,
  onNext,
  onSubmit,
  onToggleMobilePalette,
  phase,
  isSubmitting = false,
  isUploadingAudio = false,
  isNextDisabled = false,
  hidePaletteToggle = false,
}) => {
  if (totalQuestions <= 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-lg">
      <div className="max-w-[1550px] mx-auto flex items-center justify-between gap-2">
        {/* Cụm điều hướng: Trước, Đánh dấu, Sau */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={activeQuestionIdx <= 0}
            onClick={onPrev}
            className="min-h-[44px] flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition cursor-pointer touch-manipulation"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Câu trước</span>
          </button>

          <button
            type="button"
            onClick={onToggleFlag}
            className={`min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer active:scale-[0.98] touch-manipulation ${
              isFlagged
                ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Flag
              size={14}
              className={isFlagged ? 'fill-amber-500 text-amber-500' : ''}
            />
            <span>
              Câu {activeQuestionIdx + 1}/{totalQuestions}
            </span>
          </button>

          <button
            type="button"
            disabled={isNextDisabled || activeQuestionIdx >= totalQuestions - 1}
            onClick={onNext}
            className="min-h-[44px] flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition cursor-pointer touch-manipulation"
          >
            <span className="hidden sm:inline">Câu tiếp</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Nút bật Palette di động & Nộp bài */}
        <div className="flex items-center gap-2">
          {!hidePaletteToggle && (
            <button
              type="button"
              onClick={onToggleMobilePalette}
              className="lg:hidden min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer active:scale-[0.98] touch-manipulation"
            >
              <LayoutGrid size={15} />
              <span>
                {answeredCount}/{totalQuestions}
              </span>
            </button>
          )}

          {phase !== 'REVIEW' && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || isUploadingAudio}
              className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-50 touch-manipulation"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>
                Nộp Bài ({answeredCount}/{totalQuestions})
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentFooterNav;
