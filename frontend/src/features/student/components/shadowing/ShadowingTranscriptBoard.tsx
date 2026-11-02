// src/features/student/components/shadowing/ShadowingTranscriptBoard.tsx
import { memo, useMemo, useState } from "react";
import { Volume2, X } from "lucide-react";
import type {
  SentenceToken,
  ShadowingEvaluationResponse,
  WordPhonemeDetail,
} from "@/features/student/types";
import { usePracticeStore } from "@/store/usePracticeStore";
import { getWordPhonetics } from "@/features/student/utils/ipaDictionary";
import {
  playGoogleTranslateAudio,
  type GoogleAccent,
} from "@/utils/googleTranslateAudio";
import { GoogleMouthAnimation } from "./GoogleMouthAnimation";
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
    const [localSelectedWordKey, setLocalSelectedWordKey] = useState<string | null>(null);
    const [isPlayingWord, setIsPlayingWord] = useState<boolean>(false);
    const [accent, setAccent] = useState<GoogleAccent>("en"); // "en" (US) hoặc "en-GB" (UK)
    const [isSlowMode, setIsSlowMode] = useState<boolean>(false); // Chế độ đọc chậm 0.6x

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

    // Phát âm từ đơn bằng Google Translate TTS Audio API chính thức
    const handlePlayAudio = (wordKey: string, overrideSlow?: boolean) => {
      const slow = overrideSlow !== undefined ? overrideSlow : isSlowMode;
      setIsPlayingWord(true);
      playGoogleTranslateAudio(wordKey, {
        accent,
        slow,
        onStart: () => setIsPlayingWord(true),
        onEnd: () => setIsPlayingWord(false),
        onError: () => setIsPlayingWord(false),
      });
    };

    // Khi người dùng bấm vào bất kỳ từ nào: lập tức phát âm bằng Google và mở widget khẩu hình
    const handleSelectWord = (key: string) => {
      setLocalSelectedWordKey(key);
      handlePlayAudio(key);
    };

    // Lấy thông tin ngữ âm & khẩu hình của từ đang chọn
    const activeWordData = useMemo(() => {
      if (!localSelectedWordKey) return null;
      const phonetics = getWordPhonetics(localSelectedWordKey);
      const detail = wordDetailMap.get(localSelectedWordKey);
      const displayWord = detail?.word || localSelectedWordKey;
      const displayIpa =
        detail?.phonemes && detail.phonemes.length > 0
          ? detail.phonemes.map((p) => p.ipa).filter(Boolean).join("")
          : phonetics.ipa;

      return {
        word: displayWord,
        ipa: displayIpa,
        syllables: phonetics.syllables || displayWord,
        respelling: phonetics.googleRespelling || displayIpa,
        score: detail?.score,
        phonetics,
        detail,
      };
    }, [localSelectedWordKey, wordDetailMap]);

    return (
      <section
        aria-label="Nội dung câu tiếng Anh cần luyện phát âm"
        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-3 sm:p-3.5 space-y-2.5"
      >
        {/* Header Transcript */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-400">
          <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Transcript Luyện Đọc (Chạm vào từ để phát âm & xem khẩu hình Google)</span>
        </div>

        {/* Danh sách từ tiếng Anh trong câu */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 py-1.5">
          {displayTokens.map((tok, idx) => {
            const cleanKey = tok.word.replace(/[.,?!]/g, "").toLowerCase();
            const detail = wordDetailMap.get(cleanKey);
            const phonetics = getWordPhonetics(cleanKey);
            const joinedIpa =
              detail?.phonemes
                ?.map((p) => p.ipa)
                .filter(Boolean)
                .join("") || phonetics.ipa;

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

        {/* =========================================================================
            WIDGET KHẨU HÌNH ĐỘNG & PHÁT ÂM CHUẨN PHONG CÁCH GOOGLE (GOOGLE PRONUNCIATION)
           ========================================================================= */}
        {activeWordData && (
          <div
            role="region"
            aria-live="polite"
            aria-label={`Khẩu hình phát âm Google của từ ${activeWordData.word}`}
            className="p-3 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Top Bar: Word Header, Syllables, Pronunciation Badges & Direct Google Link */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white capitalize">
                  {activeWordData.word}
                </span>

                <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {activeWordData.syllables}
                </span>

                <span className="font-mono text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">
                  /{activeWordData.ipa}/
                </span>

                {activeWordData.score !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      activeWordData.score >= 80
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                        : activeWordData.score >= 60
                          ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                          : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700"
                    }`}
                  >
                    Điểm: {activeWordData.score}/100
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Nút đóng */}
                <button
                  type="button"
                  onClick={() => setLocalSelectedWordKey(null)}
                  aria-label="Đóng bảng khẩu hình"
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Google Control Toolbar: Accent Selector (US/UK) & Speed Toggle (Slow/Normal) */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Phát âm:
                </span>
                <div className="inline-flex rounded-md bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setAccent("en");
                      playGoogleTranslateAudio(activeWordData.word, {
                        accent: "en",
                        slow: isSlowMode,
                        onStart: () => setIsPlayingWord(true),
                        onEnd: () => setIsPlayingWord(false),
                      });
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      accent === "en"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Anh - Mỹ (US)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccent("en-GB");
                      playGoogleTranslateAudio(activeWordData.word, {
                        accent: "en-GB",
                        slow: isSlowMode,
                        onStart: () => setIsPlayingWord(true),
                        onEnd: () => setIsPlayingWord(false),
                      });
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      accent === "en-GB"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Anh - Anh (UK)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Nút bật/tắt tốc độ Chậm (Slow 0.6x) như Google */}
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isSlowMode}
                    onChange={(e) => {
                      const newSlow = e.target.checked;
                      setIsSlowMode(newSlow);
                      handlePlayAudio(activeWordData.word, newSlow);
                    }}
                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Đọc chậm (Slow)</span>
                </label>

                {/* Nút tròn phát âm thanh Google */}
                <button
                  type="button"
                  onClick={() => handlePlayAudio(activeWordData.word)}
                  aria-label={`Phát âm từ ${activeWordData.word}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-800 hover:bg-blue-700 active:bg-blue-900 text-white font-semibold transition shadow-xs cursor-pointer text-[11px]"
                >
                  <Volume2
                    className={`w-3.5 h-3.5 ${
                      isPlayingWord ? "animate-pulse text-amber-300" : ""
                    }`}
                  />
                  <span>{isPlayingWord ? "Đang phát..." : "Nghe"}</span>
                </button>
              </div>
            </div>

            {/* Nội dung chính: Cột trái (Hoạt họa khẩu hình Google) & Cột phải (Hướng dẫn chuẩn mực) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Cột Trái: Đồ họa Khẩu hình Động (Google Mouth Animation) */}
              <div className="md:col-span-5 flex justify-center">
                <GoogleMouthAnimation
                  isPlaying={isPlayingWord}
                  isSlow={isSlowMode}
                  mouthShape={activeWordData.phonetics.mouthShape}
                  word={activeWordData.word}
                  onPlay={() => handlePlayAudio(activeWordData.word)}
                  className="w-full max-w-[220px]"
                />
              </div>

              {/* Cột Phải: Thẻ hướng dẫn cử động cơ học môi - lưỡi phong cách Google */}
              <div className="md:col-span-7 space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700/80 space-y-1.5">
                  <p className="font-bold text-blue-900 dark:text-blue-300 text-[11px]">
                    📍 Vị trí khẩu hình chuẩn:
                  </p>
                  <div className="space-y-1 text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                    <p>
                      <strong className="text-slate-900 dark:text-slate-200">Môi (Lips): </strong>
                      {activeWordData.phonetics.lipGuide}
                    </p>
                    <p>
                      <strong className="text-slate-900 dark:text-slate-200">Lưỡi (Tongue): </strong>
                      {activeWordData.phonetics.tongueGuide}
                    </p>
                    <p>
                      <strong className="text-slate-900 dark:text-slate-200">Luồng hơi (Airflow): </strong>
                      {activeWordData.phonetics.airflowGuide}
                    </p>
                  </div>
                </div>

                {/* Mẹo phát âm */}
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200">
                  <span className="font-bold">💡 Mẹo chuẩn hóa: </span>
                  {activeWordData.phonetics.vietnameseTip}
                </div>
              </div>
            </div>

            {/* Dải âm vị cấu thành */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Âm vị:
              </span>
              {activeWordData.phonetics.phonemes.map((ph, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  /{ph.ipa}/
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  },
);
