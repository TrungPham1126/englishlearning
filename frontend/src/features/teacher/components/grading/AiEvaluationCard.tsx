import React, { useMemo } from "react";
import {
  Bot,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Volume2,
} from "lucide-react";
import type { GradingQuestion, AiFeedbackParsed } from "./gradingTypes";
import { normalizeScoreTo10 } from "@/utils/scoreScale";

interface AiEvaluationCardProps {
  question: GradingQuestion;
  onApplyAiScore?: (score: number) => void;
}

interface ParsedMistake {
  original: string;
  correction: string;
  type?: string;
  explanation?: string;
}

function safeParseJson<T = any>(raw: string | null | undefined): T | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const AiEvaluationCard: React.FC<AiEvaluationCardProps> = ({
  question,
  onApplyAiScore,
}) => {
  const aiDetail = question.aiEvaluation;

  const parsedFeedback = useMemo<AiFeedbackParsed | null>(() => {
    if (!question.evalFeedback) return null;
    const obj = safeParseJson<AiFeedbackParsed>(question.evalFeedback);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj;
    }
    return { generalFeedback: question.evalFeedback };
  }, [question.evalFeedback]);

  const rawMistakes = useMemo(() => {
    const fromEntity = safeParseJson(aiDetail?.mistakesJson);
    if (Array.isArray(fromEntity) && fromEntity.length > 0) return fromEntity;
    if (Array.isArray(parsedFeedback?.mistakes)) return parsedFeedback.mistakes;
    if (Array.isArray(parsedFeedback?.grammarCorrections)) {
      return parsedFeedback.grammarCorrections;
    }
    return [];
  }, [aiDetail?.mistakesJson, parsedFeedback]);

  const mistakes = useMemo<ParsedMistake[]>(() => {
    return rawMistakes
      .map((m: any) => {
        if (typeof m === "string") {
          return { original: m, correction: "" };
        }
        return {
          original:
            m.error || m.original || m.sentence || m.wrong || m.mistake || "",
          correction: m.correction || m.corrected || m.fix || m.right || "",
          type: m.type || m.category || undefined,
          explanation: m.explanation || m.reason || m.note || undefined,
        };
      })
      .filter((m: ParsedMistake) => m.original || m.correction || m.explanation);
  }, [rawMistakes]);

  const suggestions = useMemo<string[]>(() => {
    const fromEntity = safeParseJson(aiDetail?.suggestionsJson);
    if (Array.isArray(fromEntity)) {
      return fromEntity.map((s) => String(s)).filter(Boolean);
    }
    if (Array.isArray(parsedFeedback?.suggestions)) {
      return parsedFeedback.suggestions.map((s: any) => String(s)).filter(Boolean);
    }
    if (typeof parsedFeedback?.suggestions === "string" && parsedFeedback.suggestions.trim()) {
      return [parsedFeedback.suggestions.trim()];
    }
    return [];
  }, [aiDetail?.suggestionsJson, parsedFeedback]);

  const overallScore =
    aiDetail?.overallScore ??
    (typeof parsedFeedback?.overallBand === "number"
      ? parsedFeedback.overallBand
      : typeof parsedFeedback?.bandScore === "number"
        ? parsedFeedback.bandScore
        : parsedFeedback?.bandScore
          ? Number(parsedFeedback.bandScore)
          : null);

  const cefr = aiDetail?.estimatedCefr || parsedFeedback?.estimatedCefr || null;
  const generalFeedback =
    parsedFeedback?.generalFeedback || parsedFeedback?.pronunciationNotes || null;
  const correctedText =
    aiDetail?.correctedText || parsedFeedback?.correctedText || null;
  const sttTranscript =
    aiDetail?.sttTranscript || parsedFeedback?.transcript || null;

  const criterionScores = [
    {
      label: "Phát âm",
      value: aiDetail?.pronunciationScore ?? parsedFeedback?.pronunciationScore,
    },
    {
      label: "Trôi chảy",
      value: aiDetail?.fluencyScore ?? parsedFeedback?.fluencyScore,
    },
    {
      label: "Trả lời đề",
      value: parsedFeedback?.taskResponseScore,
    },
    {
      label: "Mạch lạc",
      value: aiDetail?.coherenceScore ?? parsedFeedback?.coherenceScore,
    },
    {
      label: "Từ vựng",
      value: aiDetail?.vocabularyScore ?? parsedFeedback?.lexicalScore,
    },
    {
      label: "Ngữ pháp",
      value: aiDetail?.grammarScore ?? parsedFeedback?.grammarScore,
    },
  ].filter(
    (c): c is { label: string; value: number } =>
      typeof c.value === "number" && !Number.isNaN(c.value) && c.value > 0,
  );

  const hasAnyAiData =
    aiDetail != null ||
    overallScore != null ||
    generalFeedback ||
    correctedText ||
    mistakes.length > 0 ||
    suggestions.length > 0 ||
    criterionScores.length > 0 ||
    sttTranscript;

  if (!hasAnyAiData) {
    return null;
  }

  const isLegacy100 = overallScore != null && overallScore > 10;
  const maxScale = isLegacy100
    ? 100
    : aiDetail?.evalType === "SHADOWING"
      ? 10
      : overallScore != null && overallScore > 9
        ? 10
        : 9;
  const normalizedApplyScore =
    overallScore != null && !Number.isNaN(overallScore)
      ? maxScale === 9
        ? Math.min(10, Math.round(((overallScore / 9.0) * 10) * 10) / 10)
        : normalizeScoreTo10(overallScore)
      : null;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/20 p-3.5 space-y-3 text-xs">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
            <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Đánh giá AI
          </span>
          {aiDetail?.evalType && (
            <span className="rounded-md bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
              {aiDetail.evalType}
            </span>
          )}
          {cefr && (
            <span className="rounded-md bg-indigo-600/15 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
              CEFR: {cefr}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {overallScore != null && !Number.isNaN(overallScore) && (
            <span className="rounded-lg bg-blue-700 px-2.5 py-1 text-xs font-extrabold text-white shadow-2xs tabular-nums">
              {maxScale === 9 && normalizedApplyScore !== null
                ? `Điểm AI: Band ${overallScore}/${maxScale} (~${normalizedApplyScore}/10)`
                : maxScale === 100 && normalizedApplyScore !== null
                  ? `Điểm AI: ${overallScore}/100 (~${normalizedApplyScore}/10)`
                  : `Điểm AI: ${overallScore}/${maxScale}`}
            </span>
          )}
          {onApplyAiScore && normalizedApplyScore !== null && (
            <button
              type="button"
              onClick={() => onApplyAiScore(normalizedApplyScore)}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition cursor-pointer"
              title={
                maxScale === 9
                  ? "Quy đổi IELTS Band (thang 9.0) sang thang 10 và áp dụng"
                  : maxScale === 100
                    ? "Chuẩn hóa từ thang 100 sang thang 10 và áp dụng"
                    : "Áp dụng điểm AI"
              }
            >
              <Sparkles className="h-3 w-3" />
              Dùng điểm AI ({normalizedApplyScore})
            </button>
          )}
        </div>
      </div>

      {/* Sub-scores */}
      {criterionScores.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {criterionScores.map((crit) => (
            <div
              key={crit.label}
              className="rounded-lg border border-blue-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-2.5 py-1.5"
            >
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {crit.label}
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white">
                {crit.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STT Transcript */}
      {sttTranscript && (
        <div className="rounded-lg border border-cyan-200 dark:border-cyan-800/60 bg-white dark:bg-slate-900/80 p-2.5 space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-700 dark:text-cyan-400">
            <Volume2 className="h-3.5 w-3.5" />
            Transcript AI:
          </div>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic">
            "{sttTranscript}"
          </p>
        </div>
      )}

      {/* General feedback */}
      {generalFeedback && (
        <div className="rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2.5 space-y-1">
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
            Nhận xét AI:
          </span>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {generalFeedback}
          </p>
        </div>
      )}

      {/* Mistakes */}
      {mistakes.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" />
            Lỗi ({mistakes.length}):
          </div>
          <div className="space-y-1.5">
            {mistakes.map((m, idx) => (
              <div
                key={idx}
                className="rounded-md bg-white dark:bg-slate-900/90 border border-amber-200/70 dark:border-slate-800 px-2.5 py-1.5 text-[11px] space-y-0.5"
              >
                {m.original && (
                  <div className="text-rose-600 dark:text-rose-400 line-through">
                    {m.original}
                  </div>
                )}
                {m.correction && (
                  <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    → {m.correction}
                  </div>
                )}
                {m.explanation && (
                  <div className="text-slate-500 dark:text-slate-400">
                    {m.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corrected / Upgraded Text */}
      {correctedText && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Gợi ý sửa AI:
          </div>
          <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
            {correctedText}
          </p>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-slate-900/80 p-2.5 space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
            <Lightbulb className="h-3.5 w-3.5" />
            Gợi ý cải thiện:
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
            {suggestions.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
