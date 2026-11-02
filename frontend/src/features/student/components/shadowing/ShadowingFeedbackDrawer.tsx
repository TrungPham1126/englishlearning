// src/features/student/components/shadowing/ShadowingFeedbackDrawer.tsx
import { memo, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Layers,
  Volume2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { usePracticeStore } from "@/store/usePracticeStore";
import { getWordPhonetics } from "@/features/student/utils/ipaDictionary";
import { playGoogleTranslateAudio } from "@/utils/googleTranslateAudio";
import { KpiMetricGauge } from "./KpiMetricGauge";
import { GoogleMouthAnimation } from "./GoogleMouthAnimation";

interface MouthTipGuide {
  readonly word: string;
  readonly ipa: string;
  readonly score: number;
  readonly note: string;
  readonly mouthPosition: string;
}

export const ShadowingFeedbackDrawer = memo(function ShadowingFeedbackDrawer() {
  const evaluationResult = usePracticeStore((s) => s.evaluationResult);
  const isFeedbackDrawerOpen = usePracticeStore((s) => s.isFeedbackDrawerOpen);
  const setFeedbackDrawerOpen = usePracticeStore(
    (s) => s.setFeedbackDrawerOpen,
  );
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  const accuracyScore = useMemo(() => {
    if (!evaluationResult) return 0;
    return (
      evaluationResult.kpi?.pronunciation ??
      Math.round(evaluationResult.overallScore)
    );
  }, [evaluationResult]);

  const fluencyScore = useMemo(() => {
    if (!evaluationResult) return 0;
    return (
      evaluationResult.kpi?.fluency ?? Math.round(evaluationResult.overallScore)
    );
  }, [evaluationResult]);

  const completenessScore = useMemo(() => {
    if (!evaluationResult) return 0;
    return (
      evaluationResult.kpi?.completeness ??
      Math.round(evaluationResult.overallScore)
    );
  }, [evaluationResult]);

  // Trích xuất danh sách gợi ý khẩu hình miệng từ các từ/âm vị cần cải thiện
  const articulationTips: readonly MouthTipGuide[] = useMemo(() => {
    if (!evaluationResult?.wordRows) return [];
    const list: MouthTipGuide[] = [];

    for (const row of evaluationResult.wordRows) {
      const phonetics = getWordPhonetics(row.word);
      const fullIpa =
        (row.phonemes || [])
          .map((p) => p.ipa)
          .filter(Boolean)
          .join("") || phonetics.ipa;

      const weakPhoneme = (row.phonemes || []).find((p) => p.score < 80);
      if (row.score < 85 || weakPhoneme) {
        const rawNote = weakPhoneme?.note || "";
        list.push({
          word: row.word,
          ipa: fullIpa,
          score: row.score,
          note: rawNote || "Cần mở rõ khẩu hình và duy trì độ vang nguyên âm.",
          mouthPosition:
            rawNote ||
            `${phonetics.lipGuide} ${phonetics.tongueGuide}`,
        });
      }
    }

    // Nếu mọi từ đều xuất sắc (>=85), hiển thị 2 từ tiêu biểu để học viên đối chiếu
    if (list.length === 0) {
      return evaluationResult.wordRows.slice(0, 2).map((row) => {
        const phonetics = getWordPhonetics(row.word);
        return {
          word: row.word,
          ipa: (row.phonemes || []).map((p) => p.ipa).join("") || phonetics.ipa,
          score: row.score,
          note: "Phát âm chuẩn xác!",
          mouthPosition:
            "Khẩu hình miệng và vị trí đặt lưỡi hoàn toàn khớp với người bản xứ.",
        };
      });
    }

    return list;
  }, [evaluationResult]);

  const handlePlayWord = (word: string) => {
    setPlayingWord(word);
    playGoogleTranslateAudio(word, {
      accent: "en",
      slow: false,
      onStart: () => setPlayingWord(word),
      onEnd: () => setPlayingWord(null),
      onError: () => setPlayingWord(null),
    });
  };

  if (!isFeedbackDrawerOpen || !evaluationResult) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shadowing-feedback-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-elevated p-4 sm:p-6 flex flex-col gap-4">
        {/* Header của Feedback Drawer */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-800 text-white px-2 py-0.5 text-[11px] font-black uppercase tracking-wider">
                <Zap
                  className="w-3 h-3 fill-amber-300 text-amber-300"
                  aria-hidden="true"
                />
                {evaluationResult.evaluatedBy === "PYTHON_ACOUSTIC_ENGINE"
                  ? "Phân tích âm học"
                  : "Phân tích phát âm"}
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-black border ${
                  evaluationResult.isPassed
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                }`}
              >
                {evaluationResult.isPassed ? (
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <XCircle className="w-3 h-3" aria-hidden="true" />
                )}
                {evaluationResult.isPassed ? "ĐẠT CHUẨN" : "CẦN LUYỆN THÊM"}
              </span>
            </div>

            <h2
              id="shadowing-feedback-title"
              className="text-lg sm:text-xl font-black text-slate-900 dark:text-white"
            >
              Tổng điểm phát âm: {evaluationResult.overallScore} / 100
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
              {evaluationResult.statusMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFeedbackDrawerOpen(false)}
            aria-label="Đóng bảng phân tích kết quả"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Bảng điểm 3 chỉ số cốt lõi: Accuracy, Fluency, Completeness */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiMetricGauge
            label="Accuracy"
            subtitle="Độ chính xác âm vị IPA"
            score={accuracyScore}
            accent="emerald"
          />
          <KpiMetricGauge
            label="Fluency"
            subtitle="Độ trôi chảy & Nhịp điệu"
            score={fluencyScore}
            accent="indigo"
          />
          <KpiMetricGauge
            label="Completeness"
            subtitle="Độ hoàn thiện từ vựng"
            score={completenessScore}
            accent="amber"
          />
        </div>

        {/* Gợi ý khẩu hình miệng & Phân tích IPA từng từ */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Layers
                className="w-4 h-4 text-blue-700 dark:text-blue-400"
                aria-hidden="true"
              />
              <span>Gợi Ý Khẩu Hình Miệng & Giải Phẫu Âm Vị IPA (Google)</span>
            </h3>
            {evaluationResult.kpi?.wordsPerMinute && (
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Tốc độ nói: {evaluationResult.kpi.wordsPerMinute} WPM
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {articulationTips.map((tip, idx) => {
              const phonetics = getWordPhonetics(tip.word);

              return (
                <article
                  key={`${tip.word}-${idx}`}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white capitalize">
                        {tip.word}
                      </span>
                      {tip.ipa && (
                        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-slate-900 text-blue-800 dark:text-blue-300">
                          /{tip.ipa}/
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePlayWord(tip.word)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-800 hover:bg-blue-700 text-white text-[10px] font-semibold cursor-pointer transition shadow-xs"
                      >
                        <Volume2
                          className={`w-3 h-3 ${
                            playingWord === tip.word ? "animate-pulse text-amber-300" : ""
                          }`}
                        />
                        <span>{playingWord === tip.word ? "Đang đọc..." : "Phát âm"}</span>
                      </button>

                      <a
                        href={`https://www.google.com/search?q=how+to+pronounce+${encodeURIComponent(
                          tip.word,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>Google</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                        tip.score >= 80
                          ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                          : tip.score >= 60
                            ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                            : "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700"
                      }`}
                    >
                      {tip.score} / 100 pts
                    </span>
                  </div>

                  {/* Khung Khẩu Hình Google & Hướng dẫn cơ học */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                    <div className="sm:col-span-4 flex justify-center">
                      <GoogleMouthAnimation
                        isPlaying={playingWord === tip.word}
                        isSlow={false}
                        mouthShape={phonetics.mouthShape}
                        word={tip.word}
                        className="w-full max-w-[170px]"
                      />
                    </div>
                    <div className="sm:col-span-8 space-y-1.5 text-[11px]">
                      <p className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{phonetics.mouthTitle}</span>
                      </p>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {tip.mouthPosition}
                      </p>
                      <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/30 text-[10px] text-amber-900 dark:text-amber-200">
                        <span className="font-bold">Mẹo: </span>
                        {phonetics.vietnameseTip}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setFeedbackDrawerOpen(false)}
            className="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Đã hiểu & Tiếp tục luyện tập
          </button>
        </div>
      </div>
    </div>
  );
});
