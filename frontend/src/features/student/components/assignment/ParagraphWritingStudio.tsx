import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Loader2, BookOpen, CheckCircle2, Lightbulb, AlertCircle, Edit3, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { studentApi } from '@/features/student/api/studentApi';
import type { WritingAiEvaluationResult } from '@/features/student/types';
import {
  countIeltsWords,
  WritingEvaluationReportPanel,
} from '@/features/student/components/assignment/WritingScaffoldingStudio';

export function ParagraphWritingStudio({
  promptText,
  explanation,
  currentParagraph,
  onParagraphChange,
  studentAnswerId,
  modelAnswer,
  passBand = 6.0,
  failCount = 0,
  onWritingEvaluated,
  disabled,
}: {
  promptText: string;
  explanation?: string;
  currentParagraph: string;
  onParagraphChange: (text: string) => void;
  studentAnswerId?: string;
  modelAnswer?: string;
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
  const [showConnectors, setShowConnectors] = useState(false);
  const [showOutlineGuide, setShowOutlineGuide] = useState(false);
  const [copied, setCopied] = useState(false);
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

  // Đếm từ thực tế theo chuẩn IELTS
  const wordCount = useMemo(() => countIeltsWords(currentParagraph), [currentParagraph]);

  // Nhận diện linh hoạt khoảng từ mục tiêu từ đề bài
  const targetRange = useMemo(() => {
    const text = (promptText + ' ' + (explanation || '')).toLowerCase();

    // 1. Khoảng từ cụ thể: vd "40-80 từ", "50–100 từ", "100–150 words"
    const rangeMatch = text.match(/(\d+)\s*[-–—]\s*(\d+)\s*(?:từ|words)/);
    if (rangeMatch) {
      return {
        min: parseInt(rangeMatch[1], 10),
        max: parseInt(rangeMatch[2], 10),
        label: `${rangeMatch[1]}–${rangeMatch[2]} từ`,
      };
    }

    // 2. Số đơn lẻ: vd "ít nhất 50 từ"
    const singleMatch = text.match(/(?:tối thiểu|ít nhất|khoảng|at least)?\s*(\d+)\s*(?:từ|words)/);
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

  const paragraphGenre = useMemo(() => {
    const text = `${promptText || ''} ${explanation || ''}`.toLowerCase();
    if (
      text.includes('short email') ||
      text.includes('email') ||
      text.includes('e-mail') ||
      text.includes('tin nhắn ngắn') ||
      text.includes('viết thư')
    ) {
      return {
        code: 'PARAGRAPH_EMAIL',
        taskArg: 'WRITING_SHORT_EMAIL' as const,
        label: 'Email / Tin nhắn ngắn',
        badgeClass:
          'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
        outlineSteps: [
          { title: '1. Lời chào mở đầu (Greeting)', detail: 'Chào người nhận thân thiện (Hi/Dear...) & nêu lý do viết thư.' },
          { title: '2. Nội dung trọng tâm (Body)', detail: 'Trả lời đủ 2–3 ý gợi ý (thời gian, địa điểm, chi tiết liên quan).' },
          { title: '3. Kết thư & ký tên (Sign-off)', detail: 'Lời chúc / hẹn phản hồi và ký tên (Best regards / See you soon).' },
        ],
      };
    }
    if (text.includes('descriptive') || text.includes('miêu tả') || text.includes('kể chuyện') || text.includes('daily routine')) {
      return {
        code: 'PARAGRAPH_DESCRIPTIVE',
        taskArg: 'PARAGRAPH' as const,
        label: 'Đoạn văn miêu tả / kể chuyện',
        badgeClass:
          'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
        outlineSteps: [
          { title: '1. Mở đoạn (Topic Sentence)', detail: 'Giới thiệu đối tượng, sự việc hoặc thói quen cần miêu tả.' },
          { title: '2. Thân đoạn (Supporting)', detail: 'Bổ sung chi tiết cụ thể bằng tính từ/trạng từ và chia đúng thì.' },
          { title: '3. Kết đoạn (Concluding)', detail: 'Nêu cảm nghĩ ngắn gọn hoặc ấn tượng tổng quan.' },
        ],
      };
    }
    if (text.includes('opinion') || text.includes('nêu quan điểm')) {
      return {
        code: 'PARAGRAPH_OPINION',
        taskArg: 'PARAGRAPH' as const,
        label: 'Opinion Paragraph',
        badgeClass:
          'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        outlineSteps: [
          { title: '1. Mở đoạn (Topic Sentence)', detail: 'Nêu rõ quan điểm cá nhân ngay câu đầu đoạn.' },
          { title: '2. Thân đoạn (Supporting)', detail: 'Phát triển 2–3 lý do thuyết phục kèm ví dụ minh họa.' },
          { title: '3. Kết đoạn (Concluding)', detail: 'Khẳng định lại lập trường bằng cách diễn đạt khác.' },
        ],
      };
    }
    if ((text.includes('advantage') && text.includes('disadvantage')) || text.includes('adv-disadv')) {
      return {
        code: 'PARAGRAPH_ADV_DISADV',
        taskArg: 'PARAGRAPH' as const,
        label: 'Advantages & Disadvantages',
        badgeClass:
          'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        outlineSteps: [
          { title: '1. Mở đoạn (Topic Sentence)', detail: 'Giới thiệu chủ đề có cả mặt lợi và mặt hại.' },
          { title: '2. Thân đoạn (Supporting)', detail: 'Nêu 1–2 ưu điểm (On the one hand) và nhược điểm đối ứng (On the other hand).' },
          { title: '3. Kết đoạn (Concluding)', detail: 'Tóm lược góc nhìn cân bằng về xu hướng này.' },
        ],
      };
    }
    if ((text.includes('cause') && text.includes('effect')) || text.includes('nguyên nhân')) {
      return {
        code: 'PARAGRAPH_CAUSE_EFFECT',
        taskArg: 'PARAGRAPH' as const,
        label: 'Cause & Effect',
        badgeClass:
          'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        outlineSteps: [
          { title: '1. Mở đoạn (Topic Sentence)', detail: 'Giới thiệu hiện tượng đang xem xét.' },
          { title: '2. Thân đoạn (Supporting)', detail: 'Trình bày nguyên nhân (Because/Due to) dẫn đến hệ quả (As a result/Lead to).' },
          { title: '3. Kết đoạn (Concluding)', detail: 'Nhấn mạnh tác động chính hoặc bài học rút ra.' },
        ],
      };
    }
    if ((text.includes('problem') && text.includes('solution')) || text.includes('vấn đề')) {
      return {
        code: 'PARAGRAPH_PROBLEM_SOLUTION',
        taskArg: 'PARAGRAPH' as const,
        label: 'Problem & Solution',
        badgeClass:
          'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        outlineSteps: [
          { title: '1. Mở đoạn (Topic Sentence)', detail: 'Nêu thực trạng vấn đề cần giải quyết.' },
          { title: '2. Thân đoạn (Supporting)', detail: 'Phân tích tác hại ngắn gọn và đề xuất 1–2 giải pháp khả thi.' },
          { title: '3. Kết đoạn (Concluding)', detail: 'Nêu kỳ vọng cải thiện nếu áp dụng giải pháp.' },
        ],
      };
    }
    return {
      code: 'PARAGRAPH_GUIDED',
      taskArg: 'PARAGRAPH' as const,
      label: 'Guided Paragraph',
      badgeClass:
        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      outlineSteps: [
        { title: '1. Mở đoạn (Topic Sentence)', detail: 'Nêu chủ đề chính và ý cốt lõi.' },
        { title: '2. Thân đoạn (Supporting)', detail: 'Phát triển 2–3 ý giải thích và ví dụ.' },
        { title: '3. Kết đoạn (Concluding)', detail: 'Tóm tắt ngắn gọn hoặc nêu cảm nghĩ.' },
      ],
    };
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
    const textToEvaluate = currentParagraph.trim();
    const wordCountActual = countIeltsWords(textToEvaluate);
    if (wordCountActual < 10) {
      alert('Vui lòng viết tối thiểu một vài câu trước khi yêu cầu chấm điểm đoạn văn!');
      return;
    }

    // Đảm bảo cập nhật text mới nhất lên form cha
    onParagraphChange(textToEvaluate);

    setIsAiGrading(true);
    try {
      const res = await studentApi.evaluateWritingAI(
        promptText,
        textToEvaluate,
        studentAnswerId || '',
        { writingTask: paragraphGenre.taskArg },
      );
      if (!isMountedRef.current) return;
      setGradingResult(res);

      const band = Number(res.overallBand ?? 6.0);
      const isPassed = band >= passBand;
      if (onWritingEvaluated) {
        onWritingEvaluated(res, textToEvaluate, isPassed);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        alert('Chấm đoạn văn thất bại: ' + (e.response?.data?.message || e.message));
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
      {/* VÙNG NHẬP NỘI DUNG ĐOẠN VĂN - TẬP TRUNG, TỐI GIẢN */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Edit3 size={14} className="text-blue-600" />
              Đoạn văn
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${paragraphGenre.badgeClass}`}>
              {paragraphGenre.label}
            </span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
              isLengthSufficient
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
            }`}
          >
            {wordCount} / {targetRange.label}
          </span>
        </div>

        <textarea
          rows={7}
          disabled={disabled}
          placeholder="Viết đoạn văn..."
          value={currentParagraph}
          onChange={(e) => onParagraphChange(e.target.value)}
          className="w-full border border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-3.5 text-sm leading-relaxed outline-none bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-y transition"
        />

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setShowOutlineGuide(!showOutlineGuide)}
            className="flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
          >
            <BookOpen size={12} />
            <span>{showOutlineGuide ? 'Ẩn cấu trúc' : 'Cấu trúc'}</span>
            {showOutlineGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <button
            type="button"
            onClick={() => setShowConnectors(!showConnectors)}
            className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
          >
            <Lightbulb size={12} />
            <span>{showConnectors ? 'Ẩn từ nối' : 'Từ nối'}</span>
            {showConnectors ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Bảng checklist cấu trúc 3 phần (chỉ hiện khi click) */}
        {showOutlineGuide && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-blue-50/40 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 text-[11px] animate-in fade-in">
            {paragraphGenre.outlineSteps.map((step) => (
              <div key={step.title} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800">
                <span className="font-bold text-blue-900 dark:text-blue-300 block mb-0.5">{step.title}</span>
                <p className="text-slate-500 dark:text-slate-400">{step.detail}</p>
              </div>
            ))}
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <div className="text-[11px]">
            {!isLengthSufficient ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 tabular-nums">
                <AlertCircle size={13} />
                Thiếu từ ({wordCount}/{targetRange.label})
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

      {gradingResult && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <WritingEvaluationReportPanel
            gradingResult={gradingResult}
            passBand={passBand}
            failCount={failCount}
            badgeLabel={paragraphGenre.label}
            firstCriterionCode="TA"
            firstCriterionName="Task Achievement"
            copied={copied}
            onCopyCorrected={handleCopyCorrected}
            modelAnswer={modelAnswer}
          />
        </div>
      )}
    </div>
  );
}

export default ParagraphWritingStudio;
