import React from 'react';
import {
  Bot,
  Lightbulb,
} from 'lucide-react';
import type { QuestionResultDetail } from '@/features/student/types';

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
  phase: 'CHECKING' | 'INTRO' | 'TESTING' | 'REVIEW' | 'EXHAUSTED';
  studyMode: 'PRACTICE' | 'TEST';
}

export const AssignmentExplanationSection: React.FC<AssignmentExplanationSectionProps> = ({
  question,
  checkedState,
  phase,
  studyMode,
}) => {
  const isReview = phase === 'REVIEW';

  // Tuyệt đối không hiển thị đáp án/giải thích nếu chưa nộp bài
  if (!isReview) return null;

  return (
    <div className="space-y-4 pt-2">
      {/* KẾT QUẢ ĐÁNH GIÁ & LỜI GIẢI SAU KHI NỘP BÀI (PHASE REVIEW) */}
      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
            <Lightbulb size={14} className="text-amber-500" />
            Đánh Giá Kết Quả & Lời Giải
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              (question as any).isCorrect
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
            }`}
          >
            {(question as any).isCorrect
              ? `+${(question as any).earnedPoints ?? (question as any).maxPoints ?? 1} pts`
              : '+0 / 1 pts'}
          </span>
        </div>

        {/* Đáp án chính xác */}
        {question.correctAnswer && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Đáp án chính xác:
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-mono">
              {question.correctAnswer}
            </span>
          </div>
        )}

        {/* Lời giải chi tiết */}
        {question.explanation && (
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            <strong className="block text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1">
              💡 Lời giải chi tiết:
            </strong>
            <p className="whitespace-pre-line leading-relaxed">
              {question.explanation}
            </p>
          </div>
        )}

        {/* Nhận xét AI / Giáo viên nếu có */}
        {(question as any).evalFeedback && (
          <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200">
            <strong className="block text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1.5">
              <Bot size={13} />
              Nhận xét & Hướng dẫn cải thiện:
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
