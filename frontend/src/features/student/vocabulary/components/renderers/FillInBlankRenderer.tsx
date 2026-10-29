// src/features/student/vocabulary/components/renderers/FillInBlankRenderer.tsx
import React, { useRef, useEffect } from 'react';
import { Edit3, BookOpen, Sparkles } from 'lucide-react';
import type { FillInBlankQuestion } from '../../types/vocabulary';
import { useVocabularySessionStore } from '../../stores/useVocabularySessionStore';

interface FillInBlankRendererProps {
  readonly question: FillInBlankQuestion;
}

export const FillInBlankRenderer: React.FC<FillInBlankRendererProps> = ({ question }) => {
  const typedText = useVocabularySessionStore((s) => s.selectedAnswer.typedText || '');
  const setAnswerPayload = useVocabularySessionStore((s) => s.setAnswerPayload);
  const submissionStatus = useVocabularySessionStore((s) => s.submissionStatus);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [question.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (submissionStatus !== 'IDLE') return;
    setAnswerPayload({ typedText: e.target.value });
  };

  // Tách câu thành 2 phần trước và sau chỗ trống "______"
  const parts = question.sentenceWithBlank.split('______');
  const prefix = parts[0] || '';
  const suffix = parts[1] || '';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 py-2">
      <div className="text-center space-y-1.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300">
          <Edit3 className="w-4 h-4" /> {question.prompt}
        </span>
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          Điền dạng đúng của từ vào chỗ trống để hoàn thành câu hoàn chỉnh
        </h3>
      </div>

      {/* Khung câu ngữ cảnh tương tác */}
      <div className="p-6 sm:p-8 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
        <div className="text-lg sm:text-xl font-bold leading-relaxed text-slate-800 dark:text-slate-200 text-center sm:text-left">
          <span>{prefix}</span>
          <span className="inline-block mx-1">
            <input
              ref={inputRef}
              type="text"
              value={typedText}
              disabled={submissionStatus !== 'IDLE'}
              onChange={handleChange}
              placeholder="..."
              autoComplete="off"
              className={`min-w-[120px] max-w-[200px] px-3 py-1 text-center font-black rounded-md border-2 outline-none transition-all ${
                submissionStatus === 'IDLE'
                  ? 'border-blue-700 bg-blue-50/60 dark:bg-slate-900/50 text-blue-900 dark:text-blue-200 focus:bg-blue-100/80'
                  : submissionStatus === 'CORRECT'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:text-emerald-200'
                  : 'border-rose-600 bg-rose-50 text-rose-900 dark:text-rose-200'
              }`}
            />
          </span>
          <span>{suffix}</span>
        </div>

        {/* Gợi ý dạng gốc của từ hoặc bản dịch */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {question.givenWordHint && (
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Từ gợi ý: <b>{question.givenWordHint}</b></span>
            </span>
          )}

          <span className="text-slate-500 dark:text-slate-400 italic flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>Nghĩa: {question.vocabularyItem.meaningVi}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
