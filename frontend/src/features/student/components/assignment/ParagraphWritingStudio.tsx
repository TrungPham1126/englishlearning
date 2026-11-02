import React, { useState, useMemo } from 'react';
import { Loader2, BookOpen, CheckCircle2, Lightbulb, Award, AlertCircle, Copy, Check, Edit3, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { studentApi } from '@/features/student/api/studentApi';
import type { WritingAiEvaluationResult } from '@/features/student/types';

export function ParagraphWritingStudio({
  promptText,
  explanation,
  currentParagraph,
  onParagraphChange,
  studentAnswerId,
  modelAnswer,
  disabled,
}: {
  promptText: string;
  explanation?: string;
  currentParagraph: string;
  onParagraphChange: (text: string) => void;
  studentAnswerId?: string;
  modelAnswer?: string;
  disabled?: boolean;
}) {
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<WritingAiEvaluationResult | null>(null);
  const [showConnectors, setShowConnectors] = useState(false);
  const [showOutlineGuide, setShowOutlineGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  // Đếm từ thực tế
  const wordCount = useMemo(() => {
    return currentParagraph.trim() ? currentParagraph.trim().split(/\s+/).length : 0;
  }, [currentParagraph]);

  // Nhận diện linh hoạt khoảng từ mục tiêu từ đề bài
  const targetRange = useMemo(() => {
    const text = (promptText + ' ' + (explanation || '')).toLowerCase();

    // 1. Khoảng từ cụ thể: vd "40-80 từ", "50–100 từ"
    const rangeMatch = text.match(/(\d+)\s*[-–—]\s*(\d+)\s*từ/);
    if (rangeMatch) {
      return {
        min: parseInt(rangeMatch[1], 10),
        max: parseInt(rangeMatch[2], 10),
        label: `${rangeMatch[1]}–${rangeMatch[2]} từ`,
      };
    }

    // 2. Số đơn lẻ: vd "ít nhất 50 từ"
    const singleMatch = text.match(/(?:tối thiểu|ít nhất|khoảng)?\s*(\d+)\s*từ/);
    if (singleMatch) {
      const val = parseInt(singleMatch[1], 10);
      if (val >= 20) {
        return { min: val, max: val * 2, label: `tối thiểu ${val} từ` };
      }
    }

    if (text.includes('30-50') || text.includes('30–50')) return { min: 30, max: 50, label: '30–50 từ' };
    if (text.includes('100-150') || text.includes('100–150')) return { min: 100, max: 150, label: '100–150 từ' };
    if (text.includes('120-180') || text.includes('120–180')) return { min: 120, max: 180, label: '120–180 từ' };

    return { min: 40, max: 80, label: '40–80 từ' };
  }, [promptText, explanation]);

  const isLengthSufficient = wordCount >= targetRange.min;

  const connectorGroups = [
    { label: 'Bổ sung ý', words: ['Furthermore', 'In addition', 'Moreover', 'Besides', 'Also'] },
    { label: 'Tương phản', words: ['However', 'On the other hand', 'In contrast', 'Although', 'Nevertheless'] },
    { label: 'Nguyên nhân / Kết quả', words: ['Therefore', 'As a result', 'Because of this', 'Consequently'] },
    { label: 'Ví dụ dẫn chứng', words: ['For example', 'For instance', 'Specifically', 'In particular'] },
    { label: 'Kết luận', words: ['In conclusion', 'To sum up', 'Overall', 'In brief'] },
  ];

  const handleInsertWord = (word: string) => {
    const trimmed = currentParagraph.trimEnd();
    const needsSpace = trimmed.length > 0 && !trimmed.endsWith(' ') && !trimmed.endsWith('\n');
    const newText = (needsSpace ? trimmed + ' ' : trimmed) + word + ', ';
    onParagraphChange(newText);
  };

  const handleAiGrade = async () => {
    if (wordCount < 10) {
      alert('Vui lòng viết tối thiểu một vài câu trước khi yêu cầu chấm điểm đoạn văn!');
      return;
    }

    setIsAiGrading(true);
    try {
      const res = await studentApi.evaluateWritingAI(
        promptText,
        currentParagraph,
        studentAnswerId || ''
      );
      setGradingResult(res);
    } catch (e: any) {
      alert('Chấm đoạn văn thất bại: ' + (e.response?.data?.message || e.message));
    } finally {
      setIsAiGrading(false);
    }
  };

  const handleCopyCorrected = () => {
    if (!gradingResult?.correctedText) return;
    navigator.clipboard.writeText(gradingResult.correctedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-all">
      {/* VÙNG NHẬP NỘI DUNG ĐOẠN VĂN - TẬP TRUNG, TỐI GIẢN */}
      <div className="space-y-3">
        {/* Header vùng viết & Bộ đếm từ */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Edit3 size={14} className="text-blue-600" />
            Soạn thảo đoạn văn:
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition ${
                isLengthSufficient
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              }`}
            >
              {wordCount} / {targetRange.label}
            </span>
          </div>
        </div>

        {/* Ô nhập nội dung */}
        <textarea
          rows={7}
          disabled={disabled}
          placeholder="Nhập đoạn văn hoàn chỉnh của bạn tại đây..."
          value={currentParagraph}
          onChange={(e) => onParagraphChange(e.target.value)}
          className="w-full border border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-3.5 sm:p-4 text-sm font-normal leading-relaxed outline-none bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-y transition"
        />

        {/* Công cụ hỗ trợ thu gọn: Gợi ý cấu trúc & Từ nối học thuật */}
        <div className="flex items-center gap-3 text-xs pt-0.5">
          <button
            type="button"
            onClick={() => setShowOutlineGuide(!showOutlineGuide)}
            className="flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
          >
            <BookOpen size={12} />
            <span>{showOutlineGuide ? 'Ẩn cấu trúc đoạn' : 'Xem cấu trúc 3 phần'}</span>
            {showOutlineGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <button
            type="button"
            onClick={() => setShowConnectors(!showConnectors)}
            className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
          >
            <Lightbulb size={12} />
            <span>{showConnectors ? 'Ẩn từ nối' : 'Gợi ý từ nối nhanh'}</span>
            {showConnectors ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Bảng checklist cấu trúc 3 phần (chỉ hiện khi click) */}
        {showOutlineGuide && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-blue-50/40 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 text-[11px] animate-in fade-in">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800">
              <span className="font-bold text-blue-900 dark:text-blue-300 block mb-0.5">1. Mở đoạn (Topic Sentence)</span>
              <p className="text-slate-500 dark:text-slate-400">Nêu chủ đề chính và ý cốt lõi.</p>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800">
              <span className="font-bold text-blue-900 dark:text-blue-300 block mb-0.5">2. Thân đoạn (Supporting)</span>
              <p className="text-slate-500 dark:text-slate-400">Phát triển 2–3 ý giải thích và ví dụ.</p>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800">
              <span className="font-bold text-blue-900 dark:text-blue-300 block mb-0.5">3. Kết đoạn (Concluding)</span>
              <p className="text-slate-500 dark:text-slate-400">Tóm tắt ngắn gọn hoặc nêu cảm nghĩ.</p>
            </div>
          </div>
        )}

        {/* Bảng từ nối học thuật (chỉ hiện khi click) */}
        {showConnectors && (
          <div className="p-3 rounded-xl bg-amber-50/40 dark:bg-slate-800/60 border border-amber-200/60 dark:border-slate-700 space-y-2 text-xs animate-in fade-in">
            {connectorGroups.map((g, idx) => (
              <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 min-w-[110px]">
                  {g.label}:
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {g.words.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => handleInsertWord(w)}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      +{w}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer: Trạng thái & Nút chấm */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-[11px]">
            {!isLengthSufficient ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertCircle size={13} />
                Chưa đủ số từ tối thiểu ({wordCount}/{targetRange.label})
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} />
                Đã đạt độ dài ({wordCount} từ)
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={disabled || isAiGrading || wordCount < 5}
            onClick={handleAiGrade}
            className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAiGrading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Đang chấm đoạn văn...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-amber-300" />
                <span>{gradingResult ? 'Chấm Lại Đoạn Văn' : 'Chấm Điểm Đoạn Văn'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ================= KẾT QUẢ ĐÁNH GIÁ (BỎ ĐOẠN VĂN GỐC, TẬP TRUNG SỬA LỖI & NÂNG CẤP) ================= */}
      {gradingResult && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
          {/* 1. Điểm số tổng quan */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Award size={14} /> Kết Quả Đánh Giá Đoạn Văn
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  Band {gradingResult.overallBand?.toFixed(1) || '6.5'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-extrabold">
                  {gradingResult.estimatedCefr || 'B2'}
                </span>
                <span className="text-xs text-slate-400">/ 9.0</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { code: 'TA', name: 'Task Response', val: gradingResult.taskAchievement?.score ?? gradingResult.overallBand ?? 6.5, bar: 'bg-blue-600' },
                { code: 'CC', name: 'Coherence', val: gradingResult.coherenceScore ?? 6.5, bar: 'bg-indigo-600' },
                { code: 'LR', name: 'Vocabulary', val: gradingResult.vocabularyScore ?? 6.5, bar: 'bg-emerald-600' },
                { code: 'GRA', name: 'Grammar', val: gradingResult.grammarScore ?? 6.5, bar: 'bg-amber-500' },
              ].map((crit) => (
                <div key={crit.code} className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-w-[75px]">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-bold">{crit.code}</span>
                    <span className="font-black text-slate-900 dark:text-white">{Number(crit.val).toFixed(1)}</span>
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

          {/* 2. Nhận xét tổng quan */}
          {gradingResult.generalFeedback && (
            <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-slate-800/40 border border-blue-100 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
              <span className="font-bold text-blue-900 dark:text-blue-300 block mb-0.5">📌 Nhận xét của giáo viên AI:</span>
              <p>{gradingResult.generalFeedback}</p>
            </div>
          )}

          {/* 3. BẢN VIẾT NÂNG CẤP GỢI Ý (ĐÃ BỎ ĐOẠN VĂN GỐC THEO YÊU CẦU) */}
          {gradingResult.correctedText && (
            <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Phiên bản nâng cấp gợi ý chuẩn (Band 8.0+)
                </span>
                <button
                  type="button"
                  onClick={handleCopyCorrected}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 px-2 py-0.5 rounded-md hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition cursor-pointer"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Đã chép' : 'Sao chép đoạn văn'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-800 dark:text-emerald-100 leading-relaxed whitespace-pre-wrap font-medium bg-white/70 dark:bg-slate-900/60 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                {gradingResult.correctedText}
              </p>
            </div>
          )}

          {/* 4. CHI TIẾT CÁC LỖI SAI & HƯỚNG DẪN CÁCH SỬA, CẤU TRÚC NGỮ PHÁP TỪ VỰNG */}
          {gradingResult.mistakes && gradingResult.mistakes.length > 0 ? (
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle size={14} />
                Hướng dẫn sửa lỗi sai & cấu trúc ngữ pháp ({gradingResult.mistakes.length}):
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
                      : m.type || 'Lỗi diễn đạt';

                  return (
                    <div
                      key={mIdx}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition space-y-2 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="line-through text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/40">
                          {m.original}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/40">
                          {m.correction}
                        </span>
                        <span className="text-[10px] ml-auto font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {typeLabel}
                        </span>
                      </div>

                      {m.explanation && (
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                          <div className="flex items-start gap-1">
                            <span className="text-amber-600 shrink-0">💡</span>
                            <span>{m.explanation}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                <b>Rất tốt!</b> Không phát hiện lỗi ngữ pháp hay từ vựng nghiêm trọng.
              </span>
            </div>
          )}

          {/* 5. Gợi ý cấu trúc nâng cao & Từ vựng (Suggestions) */}
          {gradingResult.suggestions && gradingResult.suggestions.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                Gợi ý nâng cao cấu trúc & từ vựng đắt giá:
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

          {/* 6. Bài mẫu của giáo viên (nếu có) */}
          {modelAnswer && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <b className="text-slate-800 dark:text-slate-200 block">📖 Đoạn văn mẫu tham khảo của giáo viên:</b>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{modelAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ParagraphWritingStudio;
