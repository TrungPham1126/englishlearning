import React from 'react';
import { Check, Send, Loader2, X } from 'lucide-react';
import type { QuestionResultDetail } from '@/features/student/types';
import { isQuestionPassed } from '@/features/student/utils/speakingScoring';

export interface QuestionPaletteProps {
  questions: QuestionResultDetail[];
  activeQuestionIdx: number;
  answers: Record<string, { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }>;
  flaggedQuestions: Record<string, boolean>;
  checkedQuestions: Record<string, any>;
  phase: 'CHECKING' | 'INTRO' | 'TESTING' | 'REVIEW' | 'EXHAUSTED';
  answeredCount: number;
  showMobilePalette?: boolean;
  hasPassage?: boolean;
  onSelectQuestion: (index: number, questionId: string) => void;
  onSubmit: () => void;
  onCloseMobile?: () => void;
  isSubmitting?: boolean;
  isUploadingAudio?: boolean;
}

const QuestionPaletteComponent: React.FC<QuestionPaletteProps> = ({
  questions,
  activeQuestionIdx,
  answers,
  flaggedQuestions,
  checkedQuestions,
  phase,
  answeredCount,
  showMobilePalette = false,
  hasPassage = false,
  onSelectQuestion,
  onSubmit,
  onCloseMobile,
  isSubmitting = false,
  isUploadingAudio = false,
}) => {
  return (
    <div
      className={`${
        hasPassage ? 'lg:col-span-2' : 'lg:col-span-3'
      } ${
        showMobilePalette
          ? 'fixed inset-x-4 bottom-20 z-50 lg:static'
          : 'hidden lg:block'
      } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 shadow-card lg:shadow-2xs space-y-2.5 lg:sticky lg:top-20`}
    >
      <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
          Bảng Câu Hỏi
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-1.5 py-0.2 rounded">
            {answeredCount}/{questions.length} câu
          </span>
          {showMobilePalette && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Lưới các nút câu hỏi (5 trạng thái màu) */}
      <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto pr-1">
        {questions.map((q, idx) => {
          const ans = answers[q.questionId];
          const isDone = Boolean(
            ans?.selectedOptionId ||
              (ans?.textAnswer && ans.textAnswer.trim().length > 0) ||
              ans?.audioUrl,
          );
          const isFlagged = Boolean(flaggedQuestions[q.questionId]);
          const isActive = activeQuestionIdx === idx;
          const ck = checkedQuestions[q.questionId];

          const isCorrectInReview =
            phase === 'REVIEW' &&
            ((q as any).isCorrect === true ||
              ((q as any).earnedPoints != null && (q as any).earnedPoints > 0) ||
              ((q as any).options &&
                (q as any).options.some(
                  (o: any) =>
                    (o.id === ans?.selectedOptionId || o.optionLabel === ans?.selectedOptionId) &&
                    o.isCorrect === true,
                )));
          const isWrongInReview = phase === 'REVIEW' && isDone && !isCorrectInReview;

          const isSpeaking =
            String(q.questionType || '').toUpperCase() === 'SPEAKING' ||
            String(q.questionType || '').toUpperCase() === 'AUDIO_RESPONSE';
          const isPassedSpeaking = isSpeaking && isQuestionPassed(q.questionId, q);

          const isWrong = (ck?.isChecked && ck.isCorrect === false) || isWrongInReview;
          const isCorrectChecked = (ck?.isChecked && ck.isCorrect === true) || isCorrectInReview || isPassedSpeaking;

          return (
            <button
              key={q.questionId}
              type="button"
              onClick={() => onSelectQuestion(idx, q.questionId)}
              aria-label={`Câu hỏi ${idx + 1}${isFlagged ? ', đã đánh dấu' : ''}${isDone ? ', đã làm' : ', chưa làm'}${isCorrectChecked ? ', đúng' : isWrong ? ', sai' : ''}`}
              className={`min-h-[34px] sm:min-h-[28px] py-1.5 sm:py-1 px-1 rounded-md text-[11px] font-bold transition-all border flex items-center justify-center cursor-pointer relative active:scale-[0.96] touch-manipulation ${
                isWrong
                  ? 'bg-rose-500 border-rose-600 text-white shadow-2xs'
                  : isCorrectChecked
                  ? 'bg-emerald-500 border-emerald-600 text-white shadow-2xs'
                  : isDone
                  ? 'bg-blue-600 border-blue-700 text-white shadow-2xs'
                  : isFlagged
                  ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
              } ${
                isActive
                  ? 'ring-2 ring-blue-700 dark:ring-blue-500 ring-offset-1 dark:ring-offset-slate-900'
                  : ''
              }`}
              title={`Bấm để cuộn đến câu hỏi ${idx + 1}`}
            >
              {isFlagged && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 border border-white dark:border-slate-900" />
              )}
              {phase === 'REVIEW' ? (
                isCorrectChecked ? (
                  <span className="flex items-center gap-0.5">
                    <Check size={11} strokeWidth={2.5} /> {idx + 1}
                  </span>
                ) : isWrong ? (
                  <span className="flex items-center gap-0.5">
                    <span className="text-[10px]">✕</span> {idx + 1}
                  </span>
                ) : (
                  idx + 1
                )
              ) : isDone ? (
                <span className="flex items-center gap-0.5">
                  <Check size={11} strokeWidth={2.5} /> {idx + 1}
                </span>
              ) : (
                idx + 1
              )}
            </button>
          );
        })}
      </div>

      {/* Chú thích màu sắc */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 inline-block shrink-0 shadow-2xs" />
          <span>Đã trả lời / Đúng</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400 inline-block shrink-0 shadow-2xs" />
          <span>Đánh dấu cần xem lại</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500 inline-block shrink-0 shadow-2xs" />
          <span>Cần sửa lại (Sai)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-block shrink-0" />
          <span>Chưa hoàn thành</span>
        </div>
      </div>

      {/* Nút Nộp Bài ở cột Palette */}
      {phase !== 'REVIEW' && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || isUploadingAudio}
          className="w-full min-h-[34px] mt-2 flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white text-[11px] font-bold py-2 rounded-lg shadow-2xs transition cursor-pointer disabled:opacity-50 touch-manipulation"
        >
          {isSubmitting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Send size={13} />
          )}
          <span>Nộp Toàn Bộ Bài Tập</span>
        </button>
      )}
    </div>
  );
};

export const QuestionPalette = React.memo(QuestionPaletteComponent);
export default QuestionPalette;
