import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Loader2, Award, CheckCircle2, AlertCircle, Copy, Check, Edit3, Sparkles, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { studentApi } from '@/features/student/api/studentApi';
import type { WritingAiEvaluationResult } from '@/features/student/types';

export function WritingScaffoldingStudio({
  promptText,
  explanation,
  currentEssay,
  onEssayChange,
  studentAnswerId,
  passBand = 6.0,
  failCount = 0,
  onWritingEvaluated,
  disabled,
}: {
  promptText: string;
  explanation?: string;
  currentEssay: string;
  onEssayChange: (text: string) => void;
  studentAnswerId?: string;
  passBand?: number;
  failCount?: number;
  onWritingEvaluated?: (
    result: WritingAiEvaluationResult,
    text: string,
    isPassed: boolean,
  ) => void;
  disabled?: boolean;
}) {
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<WritingAiEvaluationResult | null>(null);
  const [viewMode, setViewMode] = useState<'WRITE' | 'RESULT'>('WRITE');
  const [copied, setCopied] = useState(false);
  const [showPromptHint, setShowPromptHint] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  // Đếm số từ thực tế
  const wordCount = useMemo(() => {
    return currentEssay.trim() ? currentEssay.trim().split(/\s+/).length : 0;
  }, [currentEssay]);

  // Tự động nhận diện độ dài mục tiêu từ đề bài (vd: 40-80 từ, 150 từ, 250 từ)
  const targetSpec = useMemo(() => {
    const text = (promptText + ' ' + (explanation || '')).toLowerCase();

    // 1. Dạng khoảng từ: "40–80 từ", "40-80 từ", "100-150 từ", "150–200 từ"
    const rangeMatch = text.match(/(\d+)\s*[-–—]\s*(\d+)\s*từ/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return { min, max, label: `${min}–${max} từ` };
    }

    // 2. Dạng số đơn lẻ: "tối thiểu 150 từ", "khoảng 250 từ", "ít nhất 40 từ"
    const singleMatch = text.match(/(?:tối thiểu|ít nhất|khoảng|độ dài)?\s*(\d+)\s*từ/);
    if (singleMatch) {
      const val = parseInt(singleMatch[1], 10);
      if (val >= 30) {
        return { min: val, max: undefined, label: `tối thiểu ${val} từ` };
      }
    }

    // 3. Fallback theo ngữ cảnh đề bài
    if (text.includes('task 1') || text.includes('150')) {
      return { min: 150, max: undefined, label: 'tối thiểu 150 từ' };
    }
    if (text.includes('đoạn văn') || text.includes('paragraph')) {
      return { min: 40, max: 80, label: '40–80 từ' };
    }
    return { min: 150, max: 250, label: '150–250 từ' };
  }, [promptText, explanation]);

  const isLengthSufficient = wordCount >= targetSpec.min;

  const handleAiGrade = async () => {
    const textToEvaluate = currentEssay.trim();
    const wordCountActual = textToEvaluate ? textToEvaluate.split(/\s+/).filter(Boolean).length : 0;
    if (wordCountActual < 10) {
      alert('Vui lòng viết tối thiểu một vài câu trước khi yêu cầu chấm điểm!');
      return;
    }

    // Đảm bảo cập nhật text mới nhất lên form cha
    onEssayChange(textToEvaluate);

    setIsAiGrading(true);
    try {
      const res = await studentApi.evaluateWritingAI(
        promptText,
        textToEvaluate,
        studentAnswerId || ''
      );
      if (!isMountedRef.current) return;
      setGradingResult(res);
      setViewMode('RESULT');

      const band = Number(res.overallBand ?? 6.0);
      const isPassed = band >= passBand;
      if (onWritingEvaluated) {
        onWritingEvaluated(res, textToEvaluate, isPassed);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        alert('Chấm bài Writing thất bại: ' + (e.response?.data?.message || e.message));
      }
    } finally {
      if (isMountedRef.current) setIsAiGrading(false);
    }
  };

  const handleCopyCorrected = () => {
    if (!gradingResult?.correctedText) return;
    navigator.clipboard.writeText(gradingResult.correctedText);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setCopied(false);
    }, 2000);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-all">
      {gradingResult && (
        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('WRITE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'WRITE'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Edit3 size={13} />
              <span>Viết bài</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('RESULT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer tabular-nums ${
                viewMode === 'RESULT'
                  ? 'bg-blue-700 text-white font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award size={13} />
              <span>Kết quả ({gradingResult.overallBand?.toFixed(1) || '6.0'})</span>
            </button>
          </div>
        </div>
      )}

      {viewMode === 'WRITE' && (
        <div className="space-y-3">
          {explanation && (
            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPromptHint(!showPromptHint)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-blue-900 dark:text-blue-300 font-semibold cursor-pointer hover:bg-blue-100/40 transition"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen size={13} className="text-blue-600" />
                  <span>Gợi ý</span>
                </span>
                {showPromptHint ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showPromptHint && (
                <div className="px-3 pb-3 pt-1 text-slate-700 dark:text-slate-300 border-t border-blue-100/60 dark:border-blue-900/40 leading-relaxed whitespace-pre-wrap text-[11.5px]">
                  {explanation}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Edit3 size={14} className="text-blue-600" />
              Bài viết
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
                isLengthSufficient
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              }`}
            >
              {wordCount} / {targetSpec.label}
            </span>
          </div>

          <textarea
            rows={9}
            disabled={disabled}
            placeholder="Viết bài..."
            value={currentEssay}
            onChange={(e) => onEssayChange(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-3.5 text-sm leading-relaxed outline-none bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-y transition"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="text-[11px]">
              {!isLengthSufficient ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 tabular-nums">
                  <AlertCircle size={13} />
                  Thiếu từ ({wordCount}/{targetSpec.label})
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 tabular-nums">
                  <CheckCircle2 size={13} />
                  Đủ độ dài ({wordCount} từ)
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={disabled || isAiGrading || wordCount < 5}
              onClick={handleAiGrade}
              className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAiGrading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Đang chấm...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-amber-300" />
                  <span>{gradingResult ? 'Chấm lại' : 'Chấm điểm'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {viewMode === 'RESULT' && gradingResult && (
        <div className="space-y-3.5">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Award size={14} /> Kết quả
              </span>
              <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Band {gradingResult.overallBand?.toFixed(1) || '6.0'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold">
                  {gradingResult.estimatedCefr || 'B2'}
                </span>
                <span className="text-xs text-slate-400">/ 9.0</span>
              </div>
            </div>

            {/* 4 Tiêu chí IELTS tinh gọn */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                {
                  code: 'TR / TA',
                  name: 'Task Response',
                  val: gradingResult.taskAchievement?.score ?? gradingResult.overallBand ?? 6.0,
                  bar: 'bg-blue-600',
                },
                {
                  code: 'CC',
                  name: 'Coherence',
                  val: gradingResult.coherenceScore ?? 6.0,
                  bar: 'bg-indigo-600',
                },
                {
                  code: 'LR',
                  name: 'Lexical',
                  val: gradingResult.vocabularyScore ?? 6.0,
                  bar: 'bg-emerald-600',
                },
                {
                  code: 'GRA',
                  name: 'Grammar',
                  val: gradingResult.grammarScore ?? 6.0,
                  bar: 'bg-amber-500',
                },
              ].map((crit) => (
                <div
                  key={crit.code}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-w-[75px]"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-bold">{crit.code}</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {Number(crit.val).toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${crit.bar}`}
                      style={{ width: `${Math.min(100, Math.round((Number(crit.val) / 9) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BANNER SO SÁNH ĐIỂM CHUẨN PASS VỚI THANG IELTS */}
          {(() => {
            const band = Number(gradingResult.overallBand ?? 6.0);
            const isPassed = band >= passBand;
            return (
              <div
                className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isPassed
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/60 text-rose-900 dark:text-rose-200'
                }`}
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  {isPassed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold flex items-center gap-2 flex-wrap tabular-nums">
                      <span>{isPassed ? 'Đạt chuẩn' : 'Chưa đạt'}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80">
                        {band.toFixed(1)} / {passBand.toFixed(1)}
                      </span>
                    </div>
                    {!isPassed && (
                      <p className="text-[11px] opacity-90 mt-0.5">
                        {failCount >= 3
                          ? 'Hết 3 lượt thử. Có thể sang câu tiếp hoặc sửa lại.'
                          : `Lần ${failCount}/3. Sửa lỗi bên dưới rồi nộp lại.`}
                      </p>
                    )}
                  </div>
                </div>
                {!isPassed && (
                  <button
                    type="button"
                    onClick={() => setViewMode('WRITE')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-xs font-bold text-slate-800 dark:text-slate-200 transition cursor-pointer shrink-0"
                  >
                    <Edit3 size={13} />
                    <span>Sửa bài</span>
                  </button>
                )}
              </div>
            );
          })()}

          {gradingResult.generalFeedback && (
            <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-slate-800/40 border border-blue-100 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
              <span className="font-bold text-blue-900 dark:text-blue-300 block mb-0.5">
                Nhận xét
              </span>
              <p>{gradingResult.generalFeedback}</p>
            </div>
          )}

          {gradingResult.correctedText && (
            <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Bản gợi ý
                </span>
                <button
                  type="button"
                  onClick={handleCopyCorrected}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 px-2 py-0.5 rounded-md transition cursor-pointer"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-800 dark:text-emerald-100 leading-relaxed whitespace-pre-wrap font-medium bg-white/70 dark:bg-slate-900/60 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                {gradingResult.correctedText}
              </p>
            </div>
          )}

          {gradingResult.mistakes && gradingResult.mistakes.length > 0 ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle size={14} />
                Sửa lỗi ({gradingResult.mistakes.length})
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {gradingResult.mistakes.map((m, mIdx) => {
                  const typeLabel =
                    m.type?.toLowerCase().includes('grammar') || m.type?.toLowerCase().includes('ngữ pháp')
                      ? 'Ngữ pháp'
                      : m.type?.toLowerCase().includes('vocab') || m.type?.toLowerCase().includes('từ vựng')
                      ? 'Từ vựng'
                      : m.type?.toLowerCase().includes('punct') || m.type?.toLowerCase().includes('dấu')
                      ? 'Dấu câu'
                      : m.type?.toLowerCase().includes('spell') || m.type?.toLowerCase().includes('chính tả')
                      ? 'Chính tả'
                      : m.type || 'Diễn đạt';

                  return (
                    <div
                      key={mIdx}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="line-through text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/40">
                          {m.original}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/40">
                          {m.correction}
                        </span>
                        <span className="text-[10px] ml-auto font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {typeLabel}
                        </span>
                      </div>

                      {m.explanation && (
                        <p className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {m.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>Không phát hiện lỗi nghiêm trọng.</span>
            </div>
          )}

          {gradingResult.suggestions && gradingResult.suggestions.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                Gợi ý nâng cao
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {gradingResult.suggestions.map((s, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 text-[11.5px] space-y-1"
                  >
                    <b className="text-blue-900 dark:text-blue-300 block">{s.area}:</b>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{s.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => setViewMode('WRITE')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              <Edit3 size={13} />
              <span>Sửa bài</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WritingScaffoldingStudio;
