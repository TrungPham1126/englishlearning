// src/features/student/components/QuestionMatchingRenderer.tsx
import React, { useState, useMemo, useEffect } from "react";
import { Check, X, RotateCcw, Layers } from "lucide-react";
import type { QuestionResultDetail } from "@/features/student/types";

export interface QuestionMatchingRendererProps {
  question: QuestionResultDetail;
  currentAnswer?: string;
  onAnswerChange: (answer: string) => void;
  disabled?: boolean;
  isReview?: boolean;
}

interface MatchingPairItem {
  id: string;
  word: string;
  ipa: string;
  meaning: string;
}

export const QuestionMatchingRenderer: React.FC<QuestionMatchingRendererProps> = ({
  question,
  currentAnswer,
  onAnswerChange,
  disabled = false,
  isReview = false,
}) => {
  // 1. Chuẩn hóa hàm bóc tách dữ liệu cặp nối (Normalize Pairs Parser)
  const pairs = useMemo<MatchingPairItem[]>(() => {
    // Ưu tiên 1: Hỗ trợ trường hợp câu hỏi Matching lưu JSON trong question.content hoặc promptText
    const rawContent =
      (question as any).content || question.promptText || "";
    if (
      typeof rawContent === "string" &&
      rawContent.trim().startsWith("{") &&
      rawContent.includes("pairs")
    ) {
      try {
        const parsed = JSON.parse(rawContent);
        if (Array.isArray(parsed.pairs) && parsed.pairs.length > 0) {
          return parsed.pairs.map((p: any, idx: number) => ({
            id: String(p.id || idx + 1),
            word: p.word || p.term || "",
            ipa: p.ipa || "",
            meaning: p.meaning || p.definition || "",
          }));
        }
      } catch (e) {
        console.warn("Lỗi parse JSON pairs trong QuestionMatchingRenderer:", e);
      }
    }

    // Ưu tiên 2: Bóc tách từ mảng question.options
    if (Array.isArray(question.options) && question.options.length > 0) {
      return question.options.map((opt: any, idx: number) => {
        // Lấy định nghĩa từ nhiều trường dự phòng khác nhau theo thứ tự ưu tiên
        const meaningText =
          opt.matchText ||
          opt.explanation ||
          opt.meaning ||
          opt.definition ||
          opt.targetText ||
          opt.correctAnswer ||
          (question.options && question.options.length === 1 ? question.correctAnswer : "") ||
          "";

        return {
          id: String(opt.id || idx + 1),
          word:
            opt.optionText ||
            opt.word ||
            opt.term ||
            (question.options && question.options.length === 1 ? question.promptText : `Từ ${idx + 1}`),
          ipa: opt.ipa || "",
          meaning: meaningText || "", // Tuyệt đối KHÔNG hardcode chuỗi 'Ý nghĩa / Định nghĩa'
        };
      });
    }

    // Ưu tiên 3: Nếu câu hỏi đơn lẻ có promptText và correctAnswer
    if (question.promptText && (question.correctAnswer || question.explanation)) {
      return [
        {
          id: String(question.id || "1"),
          word: question.promptText,
          ipa: "",
          meaning: question.correctAnswer || question.explanation || "",
        },
      ];
    }

    return [];
  }, [question]);

  // 2. Cố định dữ liệu xáo trộn bằng useMemo theo question.id
  const shuffledMeanings = useMemo(() => {
    const list = pairs.map((p) => ({
      id: p.id,
      text: p.meaning,
    }));

    // Deterministic shuffle để vị trí luôn ổn định khi render
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (i * 3 + 1) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [question.id, pairs]);

  // State lưu trữ kết nối: matches[wordId] = meaningId (id của cặp tương ứng)
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);

  // Đồng bộ answer từ ngoài vào
  useEffect(() => {
    if (!currentAnswer) {
      setMatches({});
      return;
    }
    try {
      const parsed = JSON.parse(currentAnswer);
      if (typeof parsed === "object" && parsed !== null) {
        setMatches(parsed);
      }
    } catch {
      // Nếu là chuỗi đơn giản
      setMatches({});
    }
  }, [currentAnswer, question.id]);

  const handleSelectLeft = (leftId: string) => {
    if (disabled || isReview) return;

    // Nếu đã nối trước đó -> Hủy nối
    if (matches[leftId]) {
      const next = { ...matches };
      delete next[leftId];
      setMatches(next);
      onAnswerChange(JSON.stringify(next));
      setSelectedLeftId(null);
      setSelectedRightId(null);
      return;
    }

    if (selectedRightId) {
      // Hoàn tất ghép cặp
      const next = { ...matches, [leftId]: selectedRightId };
      setMatches(next);
      onAnswerChange(JSON.stringify(next));
      setSelectedLeftId(null);
      setSelectedRightId(null);
    } else {
      setSelectedLeftId(selectedLeftId === leftId ? null : leftId);
    }
  };

  const handleSelectRight = (rightId: string) => {
    if (disabled || isReview) return;

    // Kiểm tra xem thẻ phải này đã được nối với từ nào chưa
    const existingLeftId = Object.keys(matches).find(
      (k) => matches[k] === rightId
    );
    if (existingLeftId) {
      // Hủy nối
      const next = { ...matches };
      delete next[existingLeftId];
      setMatches(next);
      onAnswerChange(JSON.stringify(next));
      setSelectedLeftId(null);
      setSelectedRightId(null);
      return;
    }

    if (selectedLeftId) {
      // Hoàn tất ghép cặp
      const next = { ...matches, [selectedLeftId]: rightId };
      setMatches(next);
      onAnswerChange(JSON.stringify(next));
      setSelectedLeftId(null);
      setSelectedRightId(null);
    } else {
      setSelectedRightId(selectedRightId === rightId ? null : rightId);
    }
  };

  const handleReset = () => {
    if (disabled || isReview) return;
    setMatches({});
    setSelectedLeftId(null);
    setSelectedRightId(null);
    onAnswerChange(JSON.stringify({}));
  };

  const matchedCount = Object.keys(matches).length;
  const isAllMatched = pairs.length > 0 && matchedCount === pairs.length;

  if (pairs.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
        Chưa có dữ liệu cặp từ vựng để nối.
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Header hướng dẫn & trạng thái */}
      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Chạm vào từ vựng ở cột trái, sau đó chạm vào định nghĩa tương ứng ở cột phải:
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
            {matchedCount} / {pairs.length} cặp
          </span>
          {!disabled && !isReview && matchedCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer"
              title="Đặt lại các cặp đã nối"
            >
              <RotateCcw size={12} />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid 2 Cột Đối Xứng */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CỘT TRÁI: TỪ VỰNG TIẾNG ANH */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Từ vựng tiếng Anh
          </div>
          {pairs.map((p, idx) => {
            const isSelected = selectedLeftId === p.id;
            const matchedRightId = matches[p.id];
            const isMatched = Boolean(matchedRightId);
            const isCorrect = isReview && matchedRightId === p.id;
            const isWrong = isReview && isMatched && matchedRightId !== p.id;

            return (
              <button
                key={`left-${p.id}`}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectLeft(p.id)}
                className={`w-full p-3.5 rounded-xl border-2 text-left transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer ${
                  isReview
                    ? isCorrect
                      ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                      : isWrong
                      ? "border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-400"
                    : isSelected
                    ? "border-blue-700 bg-blue-50/90 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-2 ring-blue-600/30 shadow-sm"
                    : isMatched
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 shadow-2xs"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-400">
                    {idx + 1}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-extrabold text-sm md:text-base tracking-tight truncate">
                      {p.word}
                    </span>
                    {p.ipa && (
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {p.ipa}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isReview ? (
                    isCorrect ? (
                      <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                    ) : isWrong ? (
                      <X size={16} className="text-rose-600 dark:text-rose-400" />
                    ) : null
                  ) : isMatched ? (
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {/* CỘT PHẢI: ĐỊNH NGHĨA TIẾNG ANH (XÁO TRỘN ỔN ĐỊNH) */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Định nghĩa / Ý nghĩa
          </div>
          {shuffledMeanings.map((m, idx) => {
            const isSelected = selectedRightId === m.id;
            const linkedLeftId = Object.keys(matches).find(
              (k) => matches[k] === m.id
            );
            const isMatched = Boolean(linkedLeftId);
            const isCorrect = isReview && linkedLeftId === m.id;
            const isWrong = isReview && isMatched && linkedLeftId !== m.id;

            return (
              <button
                key={`right-${m.id}`}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectRight(m.id)}
                className={`w-full p-3.5 rounded-xl border-2 text-left transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer ${
                  isReview
                    ? isCorrect
                      ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                      : isWrong
                      ? "border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-400"
                    : isSelected
                    ? "border-blue-700 bg-blue-50/90 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-2 ring-blue-600/30 shadow-sm"
                    : isMatched
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 shadow-2xs"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-400">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-xs md:text-sm font-semibold leading-relaxed line-clamp-3">
                    {m.text || <span className="text-slate-400 italic">(Chưa có định nghĩa)</span>}
                  </span>
                </div>

                <div className="shrink-0">
                  {isReview ? (
                    isCorrect ? (
                      <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                    ) : isWrong ? (
                      <X size={16} className="text-rose-600 dark:text-rose-400" />
                    ) : null
                  ) : isMatched ? (
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuestionMatchingRenderer;
