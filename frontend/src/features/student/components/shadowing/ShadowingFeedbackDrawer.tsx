// src/features/student/components/shadowing/ShadowingFeedbackDrawer.tsx
import { memo, useMemo } from "react";
import {
  CheckCircle2,
  Layers,
  Sparkles,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { usePracticeStore } from "@/store/usePracticeStore";
import { KpiMetricGauge } from "./KpiMetricGauge";

interface MouthTipGuide {
  readonly word: string;
  readonly ipa: string;
  readonly score: number;
  readonly note: string;
  readonly mouthPosition: string;
}

/**
 * Suy luận gợi ý khẩu hình miệng chuyên sâu theo âm vị IPA hoặc ghi chú từ Acoustic Engine
 */
function buildMouthPositionGuidance(ipa: string, fallbackNote: string): string {
  if (fallbackNote && fallbackNote.trim().length > 5) {
    return fallbackNote;
  }
  const clean = ipa.toLowerCase();
  if (clean.includes("θ") || clean.includes("ð")) {
    return "Đặt nhẹ đầu lưỡi giữa hai hàm răng cửa và đẩy luồng hơi ma sát nhẹ qua khe răng.";
  }
  if (clean.includes("ʃ") || clean.includes("ʒ") || clean.includes("tʃ")) {
    return "Chu nhẹ hai môi về phía trước, nâng mặt lưỡi gần vòm cứng để tạo âm xát chuẩn.";
  }
  if (clean.includes("r") || clean.includes("ɹ")) {
    return "Cong nhẹ đầu lưỡi hướng lên vòm miệng trên nhưng không chạm vào nướu răng.";
  }
  if (clean.includes("æ")) {
    return "Mở rộng miệng theo cả chiều dọc lẫn chiều ngang (khẩu hình chữ A bẹt), hạ thấp hàm dưới.";
  }
  if (clean.includes("iː") || clean.includes("ɪ")) {
    return "Kéo nhẹ khóe miệng sang hai bên và nâng phần trước của lưỡi hướng lên vòm cứng.";
  }
  return "Mở khẩu hình miệng rõ ràng, giữ luồng hơi đều và nhấn đúng trọng âm của từ.";
}

export const ShadowingFeedbackDrawer = memo(function ShadowingFeedbackDrawer() {
  const evaluationResult = usePracticeStore((s) => s.evaluationResult);
  const isFeedbackDrawerOpen = usePracticeStore((s) => s.isFeedbackDrawerOpen);
  const setFeedbackDrawerOpen = usePracticeStore(
    (s) => s.setFeedbackDrawerOpen,
  );

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
      const fullIpa =
        (row.phonemes || [])
          .map((p) => p.ipa)
          .filter(Boolean)
          .join("") || row.word;

      const weakPhoneme = (row.phonemes || []).find((p) => p.score < 80);
      if (row.score < 85 || weakPhoneme) {
        const targetIpa = weakPhoneme?.ipa || fullIpa;
        const rawNote = weakPhoneme?.note || "";
        list.push({
          word: row.word,
          ipa: fullIpa,
          score: row.score,
          note: rawNote || "Cần mở rõ khẩu hình và duy trì độ vang nguyên âm.",
          mouthPosition: buildMouthPositionGuidance(targetIpa, rawNote),
        });
      }
    }

    // Nếu mọi từ đều xuất sắc (>=85), hiển thị 2 từ tiêu biểu để học viên đối chiếu
    if (list.length === 0) {
      return evaluationResult.wordRows.slice(0, 2).map((row) => ({
        word: row.word,
        ipa: (row.phonemes || []).map((p) => p.ipa).join(""),
        score: row.score,
        note: "Phát âm chuẩn xác!",
        mouthPosition:
          "Khẩu hình miệng và vị trí đặt lưỡi F1/F2 hoàn toàn khớp với người bản xứ.",
      }));
    }

    return list;
  }, [evaluationResult]);

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
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-elevated p-6 sm:p-8 flex flex-col gap-6">
        {/* Header của Feedback Drawer */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-800 text-white px-2.5 py-1 text-xs font-black uppercase tracking-wider">
                <Zap
                  className="w-3.5 h-3.5 fill-amber-300 text-amber-300"
                  aria-hidden="true"
                />
                {evaluationResult.evaluatedBy === "PYTHON_ACOUSTIC_ENGINE"
                  ? "Acoustic AI (Praat F1/F2)"
                  : "Groq Whisper AI Engine"}
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black border ${
                  evaluationResult.isPassed
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                }`}
              >
                {evaluationResult.isPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {evaluationResult.isPassed ? "ĐẠT CHUẨN" : "CẦN LUYỆN THÊM"}
              </span>
            </div>

            <h2
              id="shadowing-feedback-title"
              className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white"
            >
              Tổng điểm phát âm: {evaluationResult.overallScore} / 100
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
              {evaluationResult.statusMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFeedbackDrawerOpen(false)}
            aria-label="Đóng bảng phân tích kết quả (Phím tắt Escape)"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Bảng điểm 3 chỉ số cốt lõi: Accuracy, Fluency, Completeness */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Layers
                className="w-4 h-4 text-blue-700 dark:text-blue-400"
                aria-hidden="true"
              />
              <span>Gợi Ý Khẩu Hình Miệng & Giải Phẫu Âm Vị IPA</span>
            </h3>
            {evaluationResult.kpi?.wordsPerMinute && (
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Tốc độ nói: {evaluationResult.kpi.wordsPerMinute} WPM
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-72 overflow-y-auto pr-1">
            {articulationTips.map((tip, idx) => (
              <article
                key={`${tip.word}-${idx}`}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {tip.word}
                    </span>
                    {tip.ipa && (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-slate-900 text-blue-800 dark:text-blue-300">
                        /{tip.ipa}/
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-lg border ${
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

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                  <p className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hướng dẫn khẩu hình miệng & đặt lưỡi:</span>
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {tip.mouthPosition}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setFeedbackDrawerOpen(false)}
            className="px-5 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-600 text-white text-xs sm:text-sm font-bold transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Đã hiểu & Tiếp tục luyện tập
          </button>
        </div>
      </div>
    </div>
  );
});
