// src/features/student/components/shadowing/ShadowingTranscriptBoard.tsx
import { memo, useMemo, useState } from "react";
import { Sparkles, Volume2 } from "lucide-react";
import type {
  SentenceToken,
  ShadowingEvaluationResponse,
  WordPhonemeDetail,
} from "@/features/student/types";
import { usePracticeStore } from "@/store/usePracticeStore";
import { WordHighlightToken } from "./WordHighlightToken";

export interface ShadowingTranscriptBoardProps {
  readonly targetSentence?: string;
  readonly evaluationResult?: ShadowingEvaluationResponse | null;
}

export const ShadowingTranscriptBoard = memo<ShadowingTranscriptBoardProps>(
  function ShadowingTranscriptBoard({
    targetSentence: propTargetSentence,
    evaluationResult: propEvaluationResult,
  }) {
    const storeTargetSentence = usePracticeStore((s) => s.targetSentence);
    const storeEvaluationResult = usePracticeStore((s) => s.evaluationResult);
    const [localSelectedWordKey, setLocalSelectedWordKey] = useState<
      string | null
    >(null);

    const targetSentence = propTargetSentence || storeTargetSentence;
    const evaluationResult =
      propEvaluationResult !== undefined
        ? propEvaluationResult
        : storeEvaluationResult;

    // Ánh xạ thông tin từng từ (IPA, Điểm) từ wordRows nếu đã chấm
    const wordDetailMap = useMemo(() => {
      const map = new Map<string, WordPhonemeDetail>();
      if (!evaluationResult?.wordRows) return map;
      for (const row of evaluationResult.wordRows) {
        const clean = row.word.replace(/[.,?!]/g, "").toLowerCase();
        map.set(clean, row);
      }
      return map;
    }, [evaluationResult?.wordRows]);

    // Nếu chưa chấm AI, tách câu mẫu thành danh sách token trạng thái GRAY (Chưa đọc)
    const displayTokens: readonly SentenceToken[] = useMemo(() => {
      if (
        evaluationResult?.sentenceTokens &&
        evaluationResult.sentenceTokens.length > 0
      ) {
        return evaluationResult.sentenceTokens;
      }
      const rawWords = (
        targetSentence || "Listen to the native speaker and shadow the sentence."
      )
        .split(/\s+/)
        .filter(Boolean);

      return rawWords.map((word) => ({
        word,
        color: "GRAY" as const,
        hasPauseAfter: false,
        hasLinkingAfter: false,
        wordStatus: "MISSING" as const,
      }));
    }, [evaluationResult?.sentenceTokens, targetSentence]);

    const handleSelectWord = (key: string) => {
      setLocalSelectedWordKey((prev) => (prev === key ? null : key));
    };

  return (
    <section
      aria-label="Nội dung câu tiếng Anh cần luyện phát âm"
      className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-5 sm:p-7 space-y-5"
    >
      {/* Header & Chú giải màu sắc chuẩn WCAG */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
          <Volume2 className="w-4 h-4" aria-hidden="true" />
          <span>Transcript Luyện Đọc (Chạm vào từ để xem khẩu hình IPA)</span>
        </div>

        <div
          role="list"
          aria-label="Chú giải màu trạng thái phát âm"
          className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700"
        >
          <span role="listitem" className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full bg-emerald-500"
            />
            <span>Chuẩn (✓)</span>
          </span>
          <span role="listitem" className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full bg-amber-500"
            />
            <span>Cần cải thiện (~)</span>
          </span>
          <span role="listitem" className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full bg-rose-500"
            />
            <span>Phát âm sai (!)</span>
          </span>
          <span role="listitem" className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full bg-slate-400"
            />
            <span>Chưa đọc</span>
          </span>
        </div>
      </div>

      {/* Các từ tiếng Anh cỡ lớn */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5 py-3">
        {displayTokens.map((tok, idx) => {
          const cleanKey = tok.word.replace(/[.,?!]/g, "").toLowerCase();
          const detail = wordDetailMap.get(cleanKey);
          const joinedIpa = detail?.phonemes
            ?.map((p) => p.ipa)
            .filter(Boolean)
            .join("");

          return (
            <WordHighlightToken
              key={`${cleanKey}-${idx}`}
              token={tok}
              ipaText={joinedIpa}
              score={detail?.score}
              isSelected={localSelectedWordKey === cleanKey}
              onSelect={handleSelectWord}
            />
          );
        })}
      </div>

      {/* Chi tiết nhanh của từ đang chọn (nếu đã chấm điểm) */}
      {localSelectedWordKey && wordDetailMap.has(localSelectedWordKey) && (
        <div
          role="region"
          aria-live="polite"
          aria-label="Chi tiết phát âm của từ đang chọn"
          className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-600/40 space-y-2 animate-in fade-in"
        >
          {(() => {
            const row = wordDetailMap.get(localSelectedWordKey)!;
            return (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles
                      className="w-4 h-4 text-blue-700 dark:text-blue-400"
                      aria-hidden="true"
                    />
                    Giải phẫu âm vị IPA từ “{row.word}” ({row.score}/100 pts)
                  </span>
                  <button
                    type="button"
                    onClick={() => setLocalSelectedWordKey(null)}
                    className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Đóng chi tiết
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(row.phonemes || []).map((ph, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-2"
                    >
                      <span className="font-mono font-black text-blue-800 dark:text-blue-300">
                        /{ph.ipa}/
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          ph.score >= 80
                            ? "text-emerald-600 dark:text-emerald-400"
                            : ph.score >= 60
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {ph.score}%
                      </span>
                      {ph.note && (
                        <span className="text-slate-600 dark:text-slate-400">
                          — {ph.note}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
});
