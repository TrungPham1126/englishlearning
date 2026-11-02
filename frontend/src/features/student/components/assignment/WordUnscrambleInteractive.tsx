import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcw, HelpCircle } from 'lucide-react';

export function WordUnscrambleInteractive({

  promptText,

  currentAnswer,

  onAnswerChange,

  disabled,

}: {

  promptText: string;

  currentAnswer: string;

  onAnswerChange: (ans: string) => void;

  disabled?: boolean;

}) {

  const chips = useMemo(() => {

    const raw = promptText.includes(":") ? promptText.split(":")[1] || promptText : promptText;

    const tokens = raw

      .replace(/^[0-9]+\.\s*/, "")

      .split("/")

      .map((s) => s.trim().replace(/^["']|["']$/g, ""))

      .filter((s) => s.length > 0 && !s.includes("Sắp xếp") && !s.includes("Unscramble"));

    return tokens;

  }, [promptText]);

  const placedTokens = useMemo(() => {

    return currentAnswer ? currentAnswer.split(" ").filter(Boolean) : [];

  }, [currentAnswer]);

  const availableChips = useMemo(() => {

    const placedCopy = [...placedTokens];

    const available: { word: string; id: number }[] = [];

    chips.forEach((c, idx) => {

      const placedIdx = placedCopy.indexOf(c);

      if (placedIdx !== -1) {

        placedCopy.splice(placedIdx, 1);

      } else {

        available.push({ word: c, id: idx });

      }

    });

    return available;

  }, [chips, placedTokens]);

  const handleAddChip = (word: string) => {

    if (disabled) return;

    const newPlaced = [...placedTokens, word];

    onAnswerChange(newPlaced.join(" "));

  };

  const handleRemoveChip = (index: number) => {

    if (disabled) return;

    const newPlaced = [...placedTokens];

    newPlaced.splice(index, 1);

    onAnswerChange(newPlaced.join(" "));

  };

  const handleReset = () => {

    if (disabled) return;

    onAnswerChange("");

  };

  if (chips.length <= 1) return null;

  return (
    <div className="space-y-2.5 p-3.5 sm:p-4 rounded-xl border border-blue-100 dark:border-blue-600/20 bg-blue-50/30 dark:bg-slate-900/20">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
          <HelpCircle size={13} className="text-blue-700 dark:text-blue-400" /> Chạm vào các thẻ từ (Word Chips) để sắp xếp câu hoàn chỉnh:
        </span>

        {placedTokens.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            <RotateCcw size={12} /> Đặt lại khay
          </button>
        )}
      </div>

      {/* Khay câu trả lời đang ghép */}
      <div className="min-h-[48px] p-2.5 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-600/40 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-1.5 shadow-inner">
        {placedTokens.length === 0 ? (
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium italic select-none">
            Chạm vào các từ bên dưới theo đúng trật tự ngữ pháp để thả vào khay này...
          </span>
        ) : (
          placedTokens.map((word, idx) => (
            <button
              key={`${word}-${idx}`}
              type="button"
              disabled={disabled}
              onClick={() => handleRemoveChip(idx)}
              className="px-2.5 py-1.5 rounded-lg bg-blue-800 hover:bg-rose-600 text-white font-semibold text-xs sm:text-[13px] shadow-xs transition-all cursor-pointer group flex items-center gap-1 animate-in zoom-in-95 duration-150"
              title="Chạm để gỡ từ này khỏi câu"
            >
              <span>{word}</span>
              <span className="text-xs opacity-60 group-hover:opacity-100">×</span>
            </button>
          ))
        )}
      </div>

      {/* Khay các từ còn lại */}
      <div className="pt-0.5 flex flex-wrap gap-1.5">
        {availableChips.map(({ word, id }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => handleAddChip(word)}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-600 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-900/40 text-slate-800 dark:text-slate-100 font-medium text-xs sm:text-[13px] shadow-2xs transition-all cursor-pointer active:scale-95"
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );

}

export default WordUnscrambleInteractive;
