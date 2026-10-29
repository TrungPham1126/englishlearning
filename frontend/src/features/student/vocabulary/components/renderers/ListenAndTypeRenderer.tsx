// src/features/student/vocabulary/components/renderers/ListenAndTypeRenderer.tsx
import React, { useRef, useEffect } from 'react';
import { Volume2, Headphones, Play, Sparkles } from 'lucide-react';
import type { ListenAndTypeQuestion } from '../../types/vocabulary';
import { useVocabularySessionStore } from '../../stores/useVocabularySessionStore';
import { playSampleAudio } from '@/utils/sampleAudioPlayer';

interface ListenAndTypeRendererProps {
  readonly question: ListenAndTypeQuestion;
}

export const ListenAndTypeRenderer: React.FC<ListenAndTypeRendererProps> = ({ question }) => {
  const typedText = useVocabularySessionStore((s) => s.selectedAnswer.typedText || '');
  const setAnswerPayload = useVocabularySessionStore((s) => s.setAnswerPayload);
  const submissionStatus = useVocabularySessionStore((s) => s.submissionStatus);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handlePlayAudio = () => {
    const audioUrl = question.audioUrl || question.vocabularyItem.audioUrlUs;
    void playSampleAudio(question.expectedWord, {
      audioUrl,
      lang: 'en-US',
      skipBackendTts: true,
    });
  };

  // Tự động phát âm thanh khi nạp câu hỏi mới và focus ô gõ
  useEffect(() => {
    handlePlayAudio();
    inputRef.current?.focus();
  }, [question.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (submissionStatus !== 'IDLE') return;
    setAnswerPayload({ typedText: e.target.value });
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 py-2">
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300">
          <Headphones className="w-4 h-4" /> {question.prompt}
        </span>
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
          Bấm loa nghe phát âm và gõ chính xác từ vựng tiếng Anh
        </h3>
      </div>

      {/* Nút phát âm thanh to bản ở trung tâm */}
      <div className="flex flex-col items-center justify-center py-4">
        <button
          type="button"
          onClick={handlePlayAudio}
          aria-label="Nghe lại phát âm từ vựng"
          className="group relative flex items-center justify-center w-24 h-24 rounded-full bg-blue-800 hover:bg-blue-800 text-white shadow-card hover:scale-105 active:scale-95 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/50"
        >
          <span className="absolute inset-0 rounded-full bg-blue-600/30 animate-ping group-hover:block" />
          <Volume2 className="w-10 h-10 relative z-10" />
        </button>
        <span className="mt-3 text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
          <Play className="w-3 h-3 fill-current" /> Bấm để nghe lại (hoặc nhấn phím R)
        </span>
      </div>

      {/* Ô gõ từ vựng */}
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="text"
          value={typedText}
          disabled={submissionStatus !== 'IDLE'}
          onChange={handleChange}
          placeholder="Gõ từ bạn nghe được vào đây..."
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          className={`w-full px-5 py-4 rounded-xl border-2 text-center text-xl sm:text-2xl font-black outline-none transition-all ${
            submissionStatus === 'IDLE'
              ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-700 dark:focus:border-blue-400 shadow-sm'
              : submissionStatus === 'CORRECT'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
              : 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
          }`}
        />

        {question.hint && (
          <p className="text-xs text-center text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Gợi ý: {question.hint}</span>
          </p>
        )}
      </div>
    </div>
  );
};
