import React from 'react';
import {
  Bot,
  Lightbulb,
} from 'lucide-react';
import type { QuestionResultDetail } from '@/features/student/types';
import {
  evaluateQuestionReviewOutcome,
  formatQuestionPoints,
  type StudentQuestionAnswer,
} from '@/features/student/utils/questionReviewScoring';

export interface AssignmentExplanationSectionProps {
  question: QuestionResultDetail;
  checkedState?: {
    isChecked?: boolean;
    isCorrect?: boolean;
    isContentCorrect?: boolean;
    isGrammarCorrect?: boolean;
    feedback?: string;
    contentAnalysis?: string;
    grammarAnalysis?: string;
    suggestedAnswer?: string;
  };
  studentAnswer?: StudentQuestionAnswer;
  isCorrectOverride?: boolean;
  earnedPointsOverride?: number;
  phase: 'CHECKING' | 'INTRO' | 'TESTING' | 'REVIEW' | 'EXHAUSTED';
  studyMode: 'PRACTICE' | 'TEST';
}

export const AssignmentExplanationSection: React.FC<AssignmentExplanationSectionProps> = ({
  question,
  studentAnswer,
  isCorrectOverride,
  earnedPointsOverride,
  phase,
}) => {
  const isReview = phase === 'REVIEW';

  if (!isReview) return null;

  const outcome = evaluateQuestionReviewOutcome(question, studentAnswer);
  const resolvedIsCorrect =
    isCorrectOverride !== undefined ? isCorrectOverride : outcome.isCorrect;
  const resolvedPoints =
    earnedPointsOverride !== undefined
      ? earnedPointsOverride
      : resolvedIsCorrect
      ? outcome.earnedPoints > 0
        ? outcome.earnedPoints
        : outcome.maxPoints
      : 0;

  return (
    <div className="pt-2">
      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Lightbulb size={14} className="text-amber-500" />
            Lời giải
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ${
              resolvedIsCorrect
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
            }`}
          >
            {resolvedIsCorrect
              ? `+${formatQuestionPoints(resolvedPoints)} đ`
              : '+0 đ'}
          </span>
        </div>

        {question.correctAnswer && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Đáp án:
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-mono">
              {question.correctAnswer}
            </span>
          </div>
        )}

        {question.explanation && (
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            <strong className="block text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1">
              Giải thích:
            </strong>
            <p className="whitespace-pre-line leading-relaxed">
              {question.explanation}
            </p>
          </div>
        )}

        {(question as any).evalFeedback && (
          <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200">
            <strong className="text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1.5">
              <Bot size={13} />
              Nhận xét:
            </strong>
            <p className="whitespace-pre-line leading-relaxed">
              {(question as any).evalFeedback}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentExplanationSection;
