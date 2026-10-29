// src/features/student/vocabulary/components/renderers/MultipleChoiceRenderer.tsx
import React from 'react';
import { Volume2, HelpCircle } from 'lucide-react';
import type { MultipleChoiceQuestion } from '../../types/vocabulary';
import { useVocabularySessionStore } from '../../stores/useVocabularySessionStore';

interface MultipleChoiceRendererProps {
  readonly question: MultipleChoiceQuestion;
}

export const MultipleChoiceRenderer: React.FC<MultipleChoiceRendererProps> = ({ question }) => {
  const selectedOptionId = useVocabularySessionStore((s) => s.selectedAnswer.selectedOptionId);
  const setAnswerPayload = useVocabularySessionStore((s) => s.setAnswerPayload);
  const submissionStatus = useVocabularySessionStore((s) => s.submissionStatus);

  const vocab = question.vocabularyItem;

  const handleSelectOption = (optId: string) => {
    if (submissionStatus !== 'IDLE') return;
    setAnswerPayload({ selectedOptionId: optId });
  };

  const handlePlayAudio = () => {
    const url = vocab.audioUrlUs || vocab.audioUrlUk;
    if (url) {
      const audio = new Audio(url);
      audio.play().catch(() => {});
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(vocab.word);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 py-2">
      {/* Khung câu hỏi trung tâm */}
      <div className="p-6 rounded-xl border-2 border-blue-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-blue-800 dark:text-blue-400">
            <HelpCircle className="w-4 h-4" /> {question.prompt}
          </span>
          <button
            type="button"
            onClick={handlePlayAudio}
            className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 hover:bg-blue-200 transition-colors"
            title="Phát âm từ vựng"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center py-2">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            {vocab.word}
          </h2>
          <span className="text-sm font-mono text-blue-700 dark:text-blue-400 font-bold">
            [{vocab.ipa}] • ({vocab.partOfSpeech})
          </span>
        </div>
      </div>

      {/* 4 Lựa chọn trắc nghiệm dạng Grid 2x2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {question.options.map((opt, index) => {
          const isSelected = selectedOptionId === opt.id;
          const letter = String.fromCharCode(65 + index); // A, B, C, D

          let borderBgClasses =
            'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-slate-800';

          if (isSelected) {
            borderBgClasses =
              'border-blue-700 dark:border-blue-600 bg-blue-50 dark:bg-slate-900/50 text-blue-900 dark:text-blue-200 ring-2 ring-blue-600/40 shadow-sm';
          }

          if (submissionStatus !== 'IDLE') {
            if (opt.isCorrect) {
              borderBgClasses =
                'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/50';
            } else if (isSelected && !opt.isCorrect) {
              borderBgClasses =
                'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/50';
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              disabled={submissionStatus !== 'IDLE'}
              onClick={() => handleSelectOption(opt.id)}
              className={`p-4 sm:p-5 rounded-xl border-2 text-left font-bold text-sm sm:text-base flex items-center gap-3.5 transition-all duration-150 cursor-pointer disabled:cursor-default ${borderBgClasses}`}
            >
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                  isSelected
                    ? 'bg-blue-800 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {letter}
              </span>
              <span className="flex-1 leading-snug">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
