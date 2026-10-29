// src/features/student/vocabulary/components/renderers/WordMatchingRenderer.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Shuffle, Check, Sparkles } from 'lucide-react';
import type { WordMatchingQuestion } from '../../types/vocabulary';
import { useVocabularySessionStore } from '../../stores/useVocabularySessionStore';

interface WordMatchingRendererProps {
  readonly question: WordMatchingQuestion;
}

export const WordMatchingRenderer: React.FC<WordMatchingRendererProps> = ({ question }) => {
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [completedPairs, setCompletedPairs] = useState<ReadonlyArray<{ leftId: string; rightId: string }>>([]);
  const [wrongEffect, setWrongEffect] = useState<{ leftId: string; rightId: string } | null>(null);

  const setAnswerPayload = useVocabularySessionStore((s) => s.setAnswerPayload);
  const submissionStatus = useVocabularySessionStore((s) => s.submissionStatus);

  // Xáo trộn ngẫu nhiên cột phải
  const shuffledRightColumn = useMemo(() => {
    return [...question.pairs].sort(() => Math.random() - 0.5);
  }, [question.id]);

  useEffect(() => {
    setSelectedLeftId(null);
    setSelectedRightId(null);
    setCompletedPairs([]);
    setWrongEffect(null);
  }, [question.id]);

  const handleSelectLeft = (id: string) => {
    if (submissionStatus !== 'IDLE') return;
    if (completedPairs.some((p) => p.leftId === id)) return;
    setSelectedLeftId(id);
    if (selectedRightId) {
      checkMatch(id, selectedRightId);
    }
  };

  const handleSelectRight = (id: string) => {
    if (submissionStatus !== 'IDLE') return;
    if (completedPairs.some((p) => p.rightId === id)) return;
    setSelectedRightId(id);
    if (selectedLeftId) {
      checkMatch(selectedLeftId, id);
    }
  };

  const checkMatch = (leftId: string, rightId: string) => {
    // Nếu leftId trùng rightId -> Khớp cặp chuẩn xác
    if (leftId === rightId) {
      const nextPairs = [...completedPairs, { leftId, rightId }];
      setCompletedPairs(nextPairs);
      setSelectedLeftId(null);
      setSelectedRightId(null);
      setAnswerPayload({ matchedPairs: nextPairs });
    } else {
      // Báo đỏ sai trong 500ms
      setWrongEffect({ leftId, rightId });
      setTimeout(() => {
        setWrongEffect(null);
        setSelectedLeftId(null);
        setSelectedRightId(null);
      }, 450);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 py-2">
      <div className="text-center space-y-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300">
          <Shuffle className="w-4 h-4" /> {question.prompt}
        </span>
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          Chạm một từ tiếng Anh ở cột trái và nghĩa tương ứng ở cột phải
        </h3>
      </div>

      {/* Grid 2 Cột Đối Xứng */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        {/* Cột Trái (English Words) */}
        <div className="space-y-3">
          <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-500">
            Từ Tiếng Anh
          </div>
          {question.pairs.map((pair) => {
            const isMatched = completedPairs.some((p) => p.leftId === pair.id);
            const isSelected = selectedLeftId === pair.id;
            const isWrong = wrongEffect?.leftId === pair.id;

            return (
              <button
                key={pair.id}
                type="button"
                disabled={isMatched || submissionStatus !== 'IDLE'}
                onClick={() => handleSelectLeft(pair.id)}
                className={`w-full p-4 rounded-xl border-2 font-bold text-sm sm:text-base flex items-center justify-between transition-all duration-150 cursor-pointer ${
                  isMatched
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 opacity-60 cursor-default'
                    : isWrong
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-800 animate-shake'
                    : isSelected
                    ? 'border-blue-700 bg-blue-50 dark:bg-slate-900/60 text-blue-900 dark:text-blue-200 ring-2 ring-blue-600/50 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-blue-300'
                }`}
              >
                <span>{pair.leftText}</span>
                {isMatched && <Check className="w-4 h-4 text-emerald-600" />}
              </button>
            );
          })}
        </div>

        {/* Cột Phải (Vietnamese Meanings) */}
        <div className="space-y-3">
          <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-500">
            Nghĩa Tiếng Việt
          </div>
          {shuffledRightColumn.map((pair) => {
            const isMatched = completedPairs.some((p) => p.rightId === pair.id);
            const isSelected = selectedRightId === pair.id;
            const isWrong = wrongEffect?.rightId === pair.id;

            return (
              <button
                key={pair.id}
                type="button"
                disabled={isMatched || submissionStatus !== 'IDLE'}
                onClick={() => handleSelectRight(pair.id)}
                className={`w-full p-4 rounded-xl border-2 font-bold text-sm sm:text-base flex items-center justify-between transition-all duration-150 cursor-pointer ${
                  isMatched
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 opacity-60 cursor-default'
                    : isWrong
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-800 animate-shake'
                    : isSelected
                    ? 'border-blue-700 bg-blue-50 dark:bg-slate-900/60 text-blue-900 dark:text-blue-200 ring-2 ring-blue-600/50 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-blue-300'
                }`}
              >
                <span>{pair.rightText}</span>
                {isMatched && <Check className="w-4 h-4 text-emerald-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thanh tiến độ ghép cặp */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-2">
        <span>Tiến độ ghép cặp:</span>
        <span className="text-blue-700 dark:text-blue-400 font-black">
          {completedPairs.length} / {question.pairs.length} Cặp
        </span>
      </div>
    </div>
  );
};
