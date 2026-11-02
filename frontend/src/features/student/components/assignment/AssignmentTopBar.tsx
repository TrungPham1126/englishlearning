import React from 'react';
import {
  ArrowLeft,
  Clock,
  Flame,
  RotateCcw,
  Loader2,
  Highlighter,
  Eraser,
  Type,
  Lightbulb,
  Send,
} from 'lucide-react';
import type { AttemptResponse } from '@/features/student/types';

export interface AssignmentTopBarProps {
  attempt: AttemptResponse | null;
  phase: 'CHECKING' | 'INTRO' | 'TESTING' | 'REVIEW' | 'EXHAUSTED';
  questionsCount: number;
  answeredCount: number;
  remainingSeconds: number;
  streakCount?: number;
  hasPassage: boolean;
  studyMode: 'PRACTICE' | 'TEST';
  onToggleStudyMode: (mode: 'PRACTICE' | 'TEST') => void;
  fontSizeLevel: 'normal' | 'large' | 'xlarge';
  onChangeFontSize: () => void;
  onApplyHighlight: (color: 'yellow' | 'green') => void;
  onRemoveAllHighlights: () => void;
  reviewStats: {
    correctCount: number;
    totalQuestions: number;
  };
  retakeEvaluation: any;
  onRetake: () => void;
  onSubmit: () => void;
  onBack: () => void;
  isStarting?: boolean;
  isSubmitting?: boolean;
  isUploadingAudio?: boolean;
}

export const AssignmentTopBar: React.FC<AssignmentTopBarProps> = ({
  attempt,
  phase,
  questionsCount,
  answeredCount,
  remainingSeconds,
  streakCount = 0,
  hasPassage,
  studyMode,
  onToggleStudyMode,
  fontSizeLevel,
  onChangeFontSize,
  onApplyHighlight,
  onRemoveAllHighlights,
  reviewStats,
  retakeEvaluation,
  onRetake,
  onSubmit,
  onBack,
  isStarting = false,
  isSubmitting = false,
  isUploadingAudio = false,
}) => {
  const completionProgressPct =
    questionsCount > 0 ? Math.round((answeredCount / questionsCount) * 100) : 0;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Tính điểm số chuẩn xác cho phần Review
  const displayScore = (() => {
    if (reviewStats.totalQuestions > 0 && reviewStats.correctCount === reviewStats.totalQuestions) {
      return '10.0';
    }
    if (attempt?.score != null && Number(attempt.score) > 0) return Number(attempt.score).toFixed(1);
    if ((attempt as any)?.totalScore != null && Number((attempt as any).totalScore) > 0) return Number((attempt as any).totalScore).toFixed(1);
    if (reviewStats.totalQuestions > 0 && reviewStats.correctCount > 0) {
      return ((reviewStats.correctCount / reviewStats.totalQuestions) * 10).toFixed(1);
    }
    if (attempt?.score != null) return Number(attempt.score).toFixed(1);
    if ((attempt as any)?.totalScore != null) return Number((attempt as any).totalScore).toFixed(1);
    return '0.0';
  })();

  return (
    <header className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg p-2 sm:p-2.5 shadow-2xs space-y-1.5 sticky top-1 z-40 transition-colors duration-200">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5">
        {/* Cột trái: Nút Quay lại & Tiêu đề bài thi */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Thoát phiên học"
            className="rounded-md border border-slate-200 dark:border-slate-700 p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition shrink-0 active:scale-[0.97] touch-manipulation"
          >
            <ArrowLeft size={14} />
          </button>

          <div className="min-w-0">
            <h1 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white leading-tight truncate">
              {attempt?.assignmentTitle || 'Bài Tập Tiếng Anh'}
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>IELTS / Cambridge CBT</span>
              <span>•</span>
              <span className="text-blue-700 dark:text-blue-400 font-semibold">
                Đã làm {answeredCount}/{questionsCount} câu ({completionProgressPct}%)
              </span>
            </p>
          </div>
        </div>

        {/* Badges trung tâm: Countdown Timer, Streak, AI Quota */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {phase !== 'REVIEW' && (
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] tabular-nums font-medium transition ${
                remainingSeconds <= 60
                  ? 'bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse'
                  : remainingSeconds <= 300
                  ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
              title="Thời gian còn lại của phiên làm bài"
            >
              <Clock
                size={12}
                className={remainingSeconds <= 300 ? 'text-amber-500' : 'text-blue-600'}
              />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          )}

          {/* Streak Badge */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-bold transition ${
              streakCount > 0
                ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
            title="Chuỗi trả lời đúng liên tiếp trong phiên luyện tập"
          >
            <Flame
              size={12}
              className={streakCount > 0 ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}
            />
            <span>{streakCount} Streak</span>
          </div>


        </div>

        {/* Cột phải: Review Score hoặc Công cụ làm bài */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
          {phase === 'REVIEW' ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <div className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-center">
                  <span className="text-[10px] text-blue-800 dark:text-blue-300 font-semibold block uppercase tracking-wider">
                    Số Câu Đúng
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-400">
                    {reviewStats.correctCount}/{reviewStats.totalQuestions}
                  </span>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-center">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold block uppercase tracking-wider">
                    Điểm Số
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {displayScore} / 10 pts
                  </span>
                </div>
              </div>

              {!retakeEvaluation?.isEssay && (
                <button
                  type="button"
                  disabled={isStarting}
                  onClick={onRetake}
                  className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer shadow-xs active:scale-[0.98] touch-manipulation disabled:opacity-50 ${
                    retakeEvaluation?.canRetry
                      ? 'border-amber-300 bg-amber-500 hover:bg-amber-600 text-white'
                      : 'border-blue-200 bg-white hover:bg-blue-50 text-blue-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                  }`}
                >
                  {isStarting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  <span>{retakeEvaluation?.canRetry ? 'Làm Lại Bài Ngay' : 'Làm Lại Đề Này'}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Highlight Tools nếu có Reading Passage */}
              {hasPassage && (
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => onApplyHighlight('yellow')}
                    className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer"
                    title="Bôi đen chữ rồi bấm nút này để Highlight Vàng"
                  >
                    <Highlighter size={12} className="text-amber-600 dark:text-amber-400" />
                    <span className="hidden sm:inline">Vàng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onApplyHighlight('green')}
                    className="flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer"
                    title="Bôi đen chữ rồi bấm nút này để Highlight Xanh"
                  >
                    <Highlighter size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">Xanh</span>
                  </button>

                  <button
                    type="button"
                    onClick={onRemoveAllHighlights}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-500 dark:text-slate-400 transition cursor-pointer"
                    title="Xóa tất cả Highlight"
                  >
                    <Eraser size={14} />
                  </button>

                  <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

                  <button
                    type="button"
                    onClick={onChangeFontSize}
                    className="flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer"
                    title="Đổi cỡ chữ bài đọc"
                  >
                    <Type size={12} />
                    <span>
                      {fontSizeLevel === 'normal' ? '1x' : fontSizeLevel === 'large' ? '1.2x' : '1.4x'}
                    </span>
                  </button>
                </div>
              )}

              {/* Chế độ Luyện tập vs Thi thử */}
              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => onToggleStudyMode('PRACTICE')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 text-[11px] font-medium ${
                    studyMode === 'PRACTICE'
                      ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-400 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Chế độ Luyện tập: Kiểm tra đáp án từng câu tức thì"
                >
                  <Lightbulb
                    size={12}
                    className={studyMode === 'PRACTICE' ? 'text-amber-500' : ''}
                  />
                  <span>Luyện Tập</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleStudyMode('TEST')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 text-[11px] font-medium ${
                    studyMode === 'TEST'
                      ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Chế độ Thi thử: Chuẩn đề thi, tính điểm cuối cùng"
                >
                  <Clock size={12} className={studyMode === 'TEST' ? 'text-rose-500' : ''} />
                  <span>Thi Thử</span>
                </button>
              </div>

              {/* Nút Nộp Bài Topbar */}
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting || isUploadingAudio}
                className="min-h-[30px] flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white text-[11px] font-bold px-3 py-1 rounded-md disabled:opacity-50 cursor-pointer shadow-2xs transition touch-manipulation"
              >
                {isSubmitting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                <span>Nộp Bài</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${completionProgressPct}%` }}
        />
      </div>
    </header>
  );
};

export default AssignmentTopBar;
