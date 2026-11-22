import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Loader2, Award, CheckCircle2, AlertCircle, Copy, Check, Edit3, Sparkles, BookOpen, ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import { studentApi } from '@/features/student/api/studentApi';
import type {
  WritingAiEvaluationResult,
  WritingCriterionDetail,
} from '@/features/student/types';

export function countIeltsWords(text: string): number {
  const cleaned = (text || '').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter((tok) => /[A-Za-z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(tok)).length;
}

export interface WritingTaskClassificationContext {
  questionType?: string | null;
  assignmentTitle?: string | null;
  assignmentDescription?: string | null;
  promptText?: string | null;
  explanation?: string | null;
  mediaUrl?: string | null;
  hasOptions?: boolean;
  isSpeaking?: boolean;
  isWordUnscramble?: boolean;
}

export type WritingStudioClassification =
  | { kind: 'NONE' }
  | { kind: 'PARAGRAPH' }
  | { kind: 'ESSAY'; writingTask: 'TASK_1' | 'TASK_2' };

const WRITING_TASK1_WORDCOUNT_PATTERN = /(?:^|[^–—\-\d])150\s*(?:từ|words)\b/i;
const WRITING_TASK2_WORDCOUNT_PATTERN = /(?:^|[^–—\-\d])250\s*(?:từ|words)\b/i;
const WRITING_TASK2_RANGE_PATTERN = /\b150\s*[-–—]\s*250\s*(?:từ|words)\b/i;
const WRITING_PARAGRAPH_RANGE_PATTERN =
  /\b(?:30|40|50|60|80|100|120)\s*[-–—]\s*(?:50|80|100|120|150|180)\s*(?:từ|words)\b/i;
const WRITING_VISUAL_TASK1_PATTERN = new RegExp(
  [
    '\\bdiagram\\b',
    '\\b(?:the|given|two)\\s+(?:chart|charts|graph|graphs|table|tables|diagram|diagrams|map|maps|process)\\b',
    '\\btable\\s+(?:below|above|shows?|illustrates?|compares?|gives?)\\b',
    '\\bmaps?\\s+(?:below|above|shows?|comparison)\\b',
    '\\bprocess\\s+(?:diagram|below|shows?|illustrates?|of\\s+(?:making|producing|manufacturing|recycling|generating|creating|purifying|water|brick|cement|coffee|tea|paper|glass|sugar|electricity))\\b',
    '(?:^|\\s)(?:table|map|process)\\s*[:\\-–]',
  ].join('|'),
  'i',
);

export function detectChartMediaUrl(mediaUrl?: string | null): boolean {
  const url = String(mediaUrl || '').trim();
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    !/\.(mp3|wav|ogg|webm|m4a|aac)(\?|$)/i.test(lower) &&
    !lower.includes('dictvoice')
  );
}

function containsStrongTask1Signal(rawType: string, fullText: string): boolean {
  return (
    rawType.includes('TASK1') ||
    rawType.includes('TASK_1') ||
    /\bielts(?:\s+writing)?\s*task\s*1\b/i.test(fullText) ||
    /\btask[\s_]*1\b/i.test(fullText) ||
    fullText.includes('biểu đồ') ||
    /\b(?:bar chart|line graph|pie chart|column chart|stacked bar|flow chart|flowchart|process diagram|map comparison)\b/i.test(
      fullText,
    ) ||
    fullText.includes('summarise the information') ||
    fullText.includes('summarize the information') ||
    fullText.includes('report the main features') ||
    fullText.includes('reporting the main features') ||
    WRITING_TASK1_WORDCOUNT_PATTERN.test(fullText)
  );
}

function containsStrongTask2Signal(rawType: string, fullText: string): boolean {
  return (
    rawType.includes('TASK2') ||
    rawType.includes('TASK_2') ||
    rawType.includes('DISCURSIVE') ||
    /\bielts(?:\s+writing)?\s*task\s*2\b/i.test(fullText) ||
    /\btask[\s_]*2\b/i.test(fullText) ||
    WRITING_TASK2_WORDCOUNT_PATTERN.test(fullText) ||
    WRITING_TASK2_RANGE_PATTERN.test(fullText) ||
    fullText.includes('discursive') ||
    fullText.includes('nghị luận') ||
    fullText.includes('bài luận') ||
    fullText.includes('to what extent do you agree') ||
    fullText.includes('agree or disagree') ||
    fullText.includes('discuss both views') ||
    fullText.includes('advantages and disadvantages') ||
    fullText.includes('outweigh the disadvantages')
  );
}

function containsParagraphSignal(rawType: string, fullText: string): boolean {
  if (
    rawType.includes('PARAGRAPH') ||
    rawType.includes('EMAIL') ||
    rawType.includes('DESCRIPTIVE') ||
    rawType === 'WRITING_SENTENCE' ||
    fullText.includes('writing_paragraph') ||
    fullText.includes('writing_descriptive_paragraph') ||
    fullText.includes('writing_short_email') ||
    fullText.includes('short email') ||
    fullText.includes('viết email') ||
    fullText.includes('tin nhắn ngắn') ||
    fullText.includes('descriptive paragraph') ||
    fullText.includes('writing_sentence') ||
    fullText.includes('đoạn văn') ||
    fullText.includes('viết đoạn') ||
    fullText.includes('hoàn thành câu') ||
    fullText.includes('viết câu từ từ khóa') ||
    fullText.includes('single paragraph') ||
    fullText.includes('one paragraph') ||
    fullText.includes('one single cohesive paragraph') ||
    fullText.includes('guided paragraph') ||
    fullText.includes('guided academic paragraph') ||
    fullText.includes('opinion paragraph') ||
    fullText.includes('short paragraph') ||
    fullText.includes('write a paragraph') ||
    fullText.includes('topic sentence') ||
    WRITING_PARAGRAPH_RANGE_PATTERN.test(fullText)
  ) {
    return true;
  }
  const withoutMultiParagraph = fullText.replace(
    /\b(?:\d+|four|five|multi)[-\s]+paragraph\b/gi,
    ' ',
  );
  return /(?:^|[^-\w])paragraph\b/i.test(withoutMultiParagraph);
}

/**
 * Resolve an IELTS Writing essay prompt and metadata into 'TASK_1' or 'TASK_2'.
 */
export function detectIeltsWritingTask(ctx: {
  questionType?: string | null;
  assignmentTitle?: string | null;
  assignmentDescription?: string | null;
  promptText?: string | null;
  explanation?: string | null;
  mediaUrl?: string | null;
}): 'TASK_1' | 'TASK_2' {
  const rawType = String(ctx.questionType || '').trim().toUpperCase();
  const titleLower = String(ctx.assignmentTitle || '').toLowerCase();
  const descLower = String(ctx.assignmentDescription || '').toLowerCase();
  const promptLower = String(ctx.promptText || '').toLowerCase();
  const explanationLower = String(ctx.explanation || '').toLowerCase();
  const primaryText = `${rawType.toLowerCase()} ${titleLower} ${descLower} ${promptLower}`;
  const fullText = `${primaryText} ${explanationLower}`;

  if (rawType === 'ESSAY' && detectChartMediaUrl(ctx.mediaUrl)) {
    return 'TASK_1';
  }

  const strongTask1 = containsStrongTask1Signal(rawType, fullText);
  const strongTask2 = containsStrongTask2Signal(rawType, fullText);

  if (strongTask1 && !strongTask2) return 'TASK_1';
  if (strongTask2 && !strongTask1) return 'TASK_2';
  if (strongTask1) return 'TASK_1';

  return WRITING_VISUAL_TASK1_PATTERN.test(primaryText) ? 'TASK_1' : 'TASK_2';
}

/**
 * Classify a question into Paragraph Writing, IELTS Writing Task 1, IELTS Writing Task 2, or non-writing.
 */
export function classifyWritingQuestion(
  ctx: WritingTaskClassificationContext,
): WritingStudioClassification {
  const rawType = String(ctx.questionType || '').trim().toUpperCase();
  const promptLower = String(ctx.promptText || '').toLowerCase();
  const explanationLower = String(ctx.explanation || '').toLowerCase();
  const titleLower = String(ctx.assignmentTitle || '').toLowerCase();
  const descLower = String(ctx.assignmentDescription || '').toLowerCase();

  const isNonWritingType =
    Boolean(ctx.isSpeaking) ||
    Boolean(ctx.isWordUnscramble) ||
    Boolean(ctx.hasOptions) ||
    rawType === 'MULTIPLE_CHOICE' ||
    rawType === 'TRUE_FALSE' ||
    rawType === 'FILL_IN_BLANK' ||
    rawType === 'MATCHING' ||
    rawType === 'UNSCRAMBLE' ||
    rawType === 'AUDIO_RESPONSE' ||
    rawType.includes('SPEAKING') ||
    rawType.includes('WORD_ORDER');

  if (isNonWritingType) {
    return { kind: 'NONE' };
  }

  const isWritingQuestion =
    rawType === 'ESSAY' ||
    rawType === 'WRITING' ||
    rawType.includes('IELTS_TASK') ||
    rawType.includes('PARAGRAPH') ||
    rawType.startsWith('WRITING_') ||
    promptLower.includes('bài luận') ||
    promptLower.includes('ielts task') ||
    promptLower.includes('đoạn văn') ||
    promptLower.includes('opinion paragraph') ||
    promptLower.includes('write a paragraph');

  if (!isWritingQuestion) {
    return { kind: 'NONE' };
  }

  if (rawType.includes('TASK1') || rawType.includes('TASK_1')) {
    return { kind: 'ESSAY', writingTask: 'TASK_1' };
  }
  if (rawType.includes('DISCURSIVE') || rawType.includes('TASK2') || rawType.includes('TASK_2')) {
    return { kind: 'ESSAY', writingTask: 'TASK_2' };
  }
  if (
    rawType.includes('PARAGRAPH') ||
    rawType.includes('EMAIL') ||
    rawType.includes('DESCRIPTIVE') ||
    rawType === 'WRITING_SENTENCE'
  ) {
    return { kind: 'PARAGRAPH' };
  }

  if (rawType === 'ESSAY' && detectChartMediaUrl(ctx.mediaUrl)) {
    return { kind: 'ESSAY', writingTask: 'TASK_1' };
  }

  const primaryText = `${rawType.toLowerCase()} ${titleLower} ${descLower} ${promptLower}`;
  const fullText = `${primaryText} ${explanationLower}`;

  if (containsStrongTask1Signal(rawType, fullText)) {
    return { kind: 'ESSAY', writingTask: 'TASK_1' };
  }
  if (containsStrongTask2Signal(rawType, fullText)) {
    return { kind: 'ESSAY', writingTask: 'TASK_2' };
  }
  if (containsParagraphSignal(rawType, fullText)) {
    return { kind: 'PARAGRAPH' };
  }
  if (WRITING_VISUAL_TASK1_PATTERN.test(primaryText)) {
    return { kind: 'ESSAY', writingTask: 'TASK_1' };
  }
  return { kind: 'ESSAY', writingTask: 'TASK_2' };
}

export type WritingEssaySubType =
  | 'TASK1_DATA'
  | 'TASK1_PROCESS'
  | 'TASK1_MAP'
  | 'TASK2_OPINION'
  | 'TASK2_DISCUSSION'
  | 'TASK2_ADV_DISADV'
  | 'TASK2_PROBLEM_SOLUTION'
  | 'TASK2_TWO_PART'
  | 'TASK2_DISCURSIVE_C1';

export function detectWritingSubType(
  writingTask: 'TASK_1' | 'TASK_2',
  promptText?: string | null,
  explanation?: string | null,
  questionType?: string | null,
): WritingEssaySubType {
  const combined = `${questionType || ''} ${promptText || ''} ${explanation || ''}`.toLowerCase();
  if (writingTask === 'TASK_1') {
    if (
      combined.includes('process diagram') ||
      combined.includes('flow chart') ||
      combined.includes('flowchart') ||
      combined.includes('manufacturing') ||
      combined.includes('quy trình') ||
      /\bcycle\b/.test(combined)
    ) {
      return 'TASK1_PROCESS';
    }
    if (
      combined.includes('map comparison') ||
      combined.includes('floor plan') ||
      combined.includes('two maps') ||
      combined.includes('redevelopment') ||
      combined.includes('bản đồ')
    ) {
      return 'TASK1_MAP';
    }
    return 'TASK1_DATA';
  }
  if (combined.includes('discursive') || combined.includes('phản biện đa chiều')) {
    return 'TASK2_DISCURSIVE_C1';
  }
  if (combined.includes('discuss both') || combined.includes('both views') || combined.includes('both sides')) {
    return 'TASK2_DISCUSSION';
  }
  if (
    combined.includes('outweigh') ||
    (combined.includes('advantage') && combined.includes('disadvantage'))
  ) {
    return 'TASK2_ADV_DISADV';
  }
  if (
    (combined.includes('problem') || combined.includes('cause')) &&
    (combined.includes('solution') || combined.includes('measure'))
  ) {
    return 'TASK2_PROBLEM_SOLUTION';
  }
  const qCount = String(promptText || '').split('?').length - 1;
  if (combined.includes('why is this') || combined.includes('two-part') || qCount >= 2) {
    return 'TASK2_TWO_PART';
  }
  return 'TASK2_OPINION';
}

const WRITING_SUBTYPE_UI_HINTS: Record<WritingEssaySubType, { label: string; tip: string }> = {
  TASK1_DATA: {
    label: 'Biểu đồ số liệu (Data)',
    tip: 'Chọn lọc số liệu cao/thấp nhất, nhóm xu hướng và đối chiếu giữa các năm trong 2 đoạn Thân bài.',
  },
  TASK1_PROCESS: {
    label: 'Quy trình (Process Diagram)',
    tip: 'Overview cần nêu rõ số bước, điểm đầu–cuối; dùng từ nối trình tự (First, Next, Finally) và thể bị động.',
  },
  TASK1_MAP: {
    label: 'Bản đồ (Map Comparison)',
    tip: 'Mô tả các thay đổi lớn nhất ở Overview, định vị phương hướng (north/south/east/west) và chia đúng thì theo năm.',
  },
  TASK2_OPINION: {
    label: 'Opinion Essay',
    tip: 'Nêu rõ lập trường (Agree / Disagree / Balanced) ở Thesis Statement và bảo vệ nhất quán đến Kết luận.',
  },
  TASK2_DISCUSSION: {
    label: 'Discussion Both Views',
    tip: 'Thân bài 1 phân tích quan điểm thứ nhất, Thân bài 2 phân tích quan điểm thứ hai kèm lập trường của bạn.',
  },
  TASK2_ADV_DISADV: {
    label: 'Advantages & Disadvantages',
    tip: 'So sánh cân bằng mặt lợi và mặt hại; nếu đề hỏi "outweigh", khẳng định rõ bên nào vượt trội hơn.',
  },
  TASK2_PROBLEM_SOLUTION: {
    label: 'Problem & Solution',
    tip: 'Thân bài 1 làm rõ nguyên nhân/hệ quả, Thân bài 2 đề xuất giải pháp thực tế tương ứng cho từng vấn đề.',
  },
  TASK2_TWO_PART: {
    label: 'Two-Part Questions',
    tip: 'Đảm bảo trả lời trực diện cả 2 câu hỏi trong đề (mỗi câu hỏi triển khai trọng tâm ở một đoạn Thân bài).',
  },
  TASK2_DISCURSIVE_C1: {
    label: 'Discursive Essay (C1)',
    tip: 'Khai thác góc nhìn phản biện đa chiều bằng lập luận học thuật C1, danh từ hóa và câu nhượng bộ.',
  },
};

const WRITING_TASK_UI_CONFIG: Record<
  'TASK_1' | 'TASK_2',
  {
    badgeLabel: string;
    badgeClass: string;
    subtitle: string;
    minWords: number;
    targetLabel: string;
    placeholder: string;
    firstCriterionCode: string;
    firstCriterionName: string;
    outlineTitle: string;
    outlineSteps: Array<{ title: string; detail: string }>;
    tipText: string;
  }
> = {
  TASK_1: {
    badgeLabel: 'IELTS Writing Task 1',
    badgeClass:
      'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    subtitle: 'Báo cáo biểu đồ / số liệu / quy trình — tối thiểu 150 từ',
    minWords: 150,
    targetLabel: 'tối thiểu 150 từ',
    placeholder: 'Viết bài báo cáo IELTS Writing Task 1 (tối thiểu 150 từ)...',
    firstCriterionCode: 'TA',
    firstCriterionName: 'Task Achievement',
    outlineTitle: 'Cấu trúc Task 1',
    outlineSteps: [
      {
        title: '1. Introduction',
        detail: 'Paraphrase đề bài: biểu đồ/bảng/sơ đồ thể hiện gì, ở đâu, giai đoạn nào.',
      },
      {
        title: '2. Overview',
        detail: 'Nêu 2–3 xu hướng tổng quan nổi bật nhất (không đưa số liệu chi tiết).',
      },
      {
        title: '3. Key Features',
        detail: 'Chọn lọc đặc điểm chính, nhóm thông tin logic kèm số liệu dẫn chứng.',
      },
      {
        title: '4. Data Comparison',
        detail: 'So sánh mức tăng/giảm, cao nhất/thấp nhất giữa các nhóm (khách quan, không nêu ý kiến).',
      },
    ],
    tipText:
      'Lưu ý Task 1: Cần đoạn Overview rõ ràng và so sánh số liệu nổi bật thay vì liệt kê rời rạc.',
  },
  TASK_2: {
    badgeLabel: 'IELTS Writing Task 2',
    badgeClass:
      'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    subtitle: 'Nghị luận học thuật (Essay) — tối thiểu 250 từ',
    minWords: 250,
    targetLabel: 'tối thiểu 250 từ',
    placeholder: 'Viết bài luận IELTS Writing Task 2 (tối thiểu 250 từ)...',
    firstCriterionCode: 'TR',
    firstCriterionName: 'Task Response',
    outlineTitle: 'Cấu trúc Task 2',
    outlineSteps: [
      {
        title: '1. Introduction',
        detail: 'Paraphrase chủ đề và nêu rõ lập trường/quan điểm (Position / Thesis).',
      },
      {
        title: '2. Body Paragraph 1',
        detail: 'Luận điểm chính 1 + giải thích logic + ví dụ minh họa cụ thể.',
      },
      {
        title: '3. Body Paragraph 2',
        detail: 'Luận điểm chính 2 (hoặc mặt đối lập) + phân tích chuyên sâu.',
      },
      {
        title: '4. Conclusion',
        detail: 'Tóm tắt các ý chính và khẳng định lại Position, không thêm ý mới.',
      },
    ],
    tipText:
      'Lưu ý Task 2: Trả lời đủ các vế câu hỏi, giữ Position xuyên suốt và phát triển lập luận có dẫn chứng.',
  },
};

const CRIT_BADGE_COLORS: Record<string, string> = {
  TR: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  TA: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  CC: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  LR: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  GRA: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
};

function formatBandValue(val: number): string {
  const num = Number(val || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

export function WritingEvaluationReportPanel({
  gradingResult,
  passBand = 6.0,
  failCount = 0,
  badgeLabel,
  firstCriterionCode = 'TR',
  firstCriterionName = 'Task Response',
  copied,
  onCopyCorrected,
  onEditClick,
  modelAnswer,
}: {
  gradingResult: WritingAiEvaluationResult;
  passBand?: number;
  failCount?: number;
  badgeLabel?: string;
  firstCriterionCode?: string;
  firstCriterionName?: string;
  copied: boolean;
  onCopyCorrected: () => void;
  onEditClick?: () => void;
  modelAnswer?: string;
}) {
  const band = Number(gradingResult.overallBand ?? 6.0);
  const isPassed = band >= passBand;
  const critRows = [
    {
      code: firstCriterionCode,
      name: firstCriterionName,
      val: gradingResult.taskAchievement?.score ?? band,
    },
    {
      code: 'CC',
      name: 'Coherence & Cohesion',
      val: gradingResult.coherenceScore ?? band,
    },
    {
      code: 'LR',
      name: 'Lexical Resource',
      val: gradingResult.vocabularyScore ?? band,
    },
    {
      code: 'GRA',
      name: 'Grammatical Range & Accuracy',
      val: gradingResult.grammarScore ?? band,
    },
  ];

  const orderedDetailKeys: Array<{ key: string; detail: WritingCriterionDetail }> = [];
  if (gradingResult.criteriaDetails) {
    for (const k of ['TR', 'TA', 'CC', 'LR', 'GRA']) {
      const detail = gradingResult.criteriaDetails[k];
      if (detail) {
        orderedDetailKeys.push({ key: k, detail });
      }
    }
  }

  const revisedWordCount =
    gradingResult.correctedWordCount && gradingResult.correctedWordCount > 0
      ? gradingResult.correctedWordCount
      : countIeltsWords(gradingResult.correctedText || '');

  return (
    <div className="space-y-4">
      {/* Top ForumFlash-style Band Ước Lượng + 4-Criteria Score Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-[175px_1fr] gap-4 items-stretch">
          <div className="rounded-xl bg-teal-900 dark:bg-teal-950 text-white p-4 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-teal-100/90">
                Band ước lượng
              </div>
              <div className="text-4xl font-black tracking-tight tabular-nums mt-1">
                {band.toFixed(1)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/15 text-white">
                CEFR {gradingResult.estimatedCefr || 'B2'}
              </span>
              {badgeLabel && (
                <span className="text-[10px] font-medium text-teal-100/90 truncate max-w-full">
                  {badgeLabel}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3.5 py-1.5 bg-slate-50/40 dark:bg-slate-800/30">
            {critRows.map((crit) => (
              <div key={crit.code} className="flex items-center justify-between py-2 gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center justify-center min-w-[34px] px-1.5 py-0.5 rounded text-[10.5px] font-extrabold border ${
                      CRIT_BADGE_COLORS[crit.code] || CRIT_BADGE_COLORS.TR
                    }`}
                  >
                    {crit.code}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {crit.name}
                  </span>
                </div>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formatBandValue(crit.val)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {gradingResult.generalFeedback && (
          <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800">
            {gradingResult.generalFeedback}
          </p>
        )}
      </div>

      {/* Pass / Retake Banner */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
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
                  ? 'Hết 3 lượt thử. Có thể sang câu tiếp theo hoặc sửa lại.'
                  : `Lần ${failCount}/3. Xem nhận xét từng tiêu chí bên dưới rồi sửa bài.`}
              </p>
            )}
          </div>
        </div>
        {!isPassed && onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-xs font-bold text-slate-800 dark:text-slate-200 transition cursor-pointer shrink-0"
          >
            <Edit3 size={13} />
            <span>Sửa bài</span>
          </button>
        )}
      </div>

      {/* Per-criterion Detailed Breakdown (TR/TA, CC, LR, GRA) */}
      {orderedDetailKeys.length > 0 && (
        <div className="space-y-3.5">
          {orderedDetailKeys.map(({ key, detail }) => (
            <div
              key={key}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10.5px] font-extrabold border ${
                      CRIT_BADGE_COLORS[detail.code] || CRIT_BADGE_COLORS.TR
                    }`}
                  >
                    Tiêu chí {detail.code}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{detail.name}</h4>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  band {formatBandValue(detail.band)}
                </span>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {detail.summary}
              </p>

              {detail.highlights && detail.highlights.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-[11.5px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2 px-3 font-semibold w-1/2">Trong bài</th>
                        <th className="py-2 px-3 font-semibold w-1/2">Nhận xét và cách sửa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {detail.highlights.map((hl, idx) => (
                        <tr key={idx} className="align-top">
                          <td className="p-3 space-y-2">
                            <p className="rounded-lg bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/60 p-2 text-slate-800 dark:text-teal-100 leading-relaxed">
                              {hl.inEssay}
                            </p>
                            {hl.rewritten && (
                              <p className="font-bold text-teal-800 dark:text-teal-300 leading-relaxed">
                                {hl.rewritten}
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 leading-relaxed">
                            <span>{hl.critique} </span>
                            {hl.howToFix && (
                              <>
                                <strong className="text-slate-900 dark:text-white">Cách sửa. </strong>
                                <span>{hl.howToFix}</span>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {detail.nextBandAdvice && (
                <div className="rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 px-3 py-2 text-[11.5px] text-slate-700 dark:text-slate-200 leading-relaxed">
                  <strong className="text-emerald-900 dark:text-emerald-300">
                    Để lên band {detail.nextBand}.{' '}
                  </strong>
                  <span>{detail.nextBandAdvice}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Specific Mechanical Errors (if any) */}
      {gradingResult.mistakes && gradingResult.mistakes.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
            <AlertCircle size={14} />
            Sửa lỗi chi tiết ({gradingResult.mistakes.length})
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
      )}

      {/* Từ vựng gợi ý 4-Column Table */}
      {gradingResult.suggestedVocabulary && gradingResult.suggestedVocabulary.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <BookOpen size={14} className="text-teal-700 dark:text-teal-400" />
              Từ vựng gợi ý
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {gradingResult.suggestedVocabulary.length} collocations nâng cấp
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11.5px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-semibold min-w-[140px]">Từ</th>
                  <th className="py-2 pr-3 font-semibold min-w-[125px]">Nghĩa</th>
                  <th className="py-2 pr-3 font-semibold min-w-[200px]">Ví dụ</th>
                  <th className="py-2 font-semibold min-w-[190px]">Ngữ cảnh dùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gradingResult.suggestedVocabulary.map((v, vIdx) => (
                  <tr key={vIdx} className="align-top">
                    <td className="py-2.5 pr-3">
                      <div className="font-bold text-slate-900 dark:text-white">{v.word}</div>
                      {v.ipa && (
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {v.ipa}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{v.meaning}</td>
                    <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{v.example}</td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-400">{v.usageContext}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bài viết lại (Complete Rewritten Essay) */}
      {gradingResult.correctedText && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Bài viết lại</h4>
              {revisedWordCount > 0 && (
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {revisedWordCount} từ
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onCopyCorrected}
              className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 px-2.5 py-1 rounded-md border border-teal-200/70 dark:border-teal-800/60 transition cursor-pointer"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
          <div className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200/70 dark:border-slate-700/70">
            {gradingResult.correctedText}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Điểm do AI ước lượng theo bảng mô tả band công khai của IELTS, chỉ để tự luyện. Band chung là trung bình bốn tiêu chí, làm tròn xuống nửa band.
          </p>
        </div>
      )}

      {/* Fallback Gợi ý nâng cao when criteriaDetails isn't populated (legacy evaluations) */}
      {orderedDetailKeys.length === 0 && gradingResult.suggestions && gradingResult.suggestions.length > 0 && (
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

      {modelAnswer && (
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
          <b className="text-slate-800 dark:text-slate-200 block">Bài mẫu</b>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{modelAnswer}</p>
        </div>
      )}
    </div>
  );
}

export function WritingScaffoldingStudio({
  promptText,
  explanation,
  currentEssay,
  onEssayChange,
  studentAnswerId,
  writingTask,
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
  writingTask?: 'TASK_1' | 'TASK_2';
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
  const [showOutlineGuide, setShowOutlineGuide] = useState(true);
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

  const resolvedWritingTask: 'TASK_1' | 'TASK_2' = useMemo(() => {
    if (writingTask === 'TASK_1' || writingTask === 'TASK_2') {
      return writingTask;
    }
    return detectIeltsWritingTask({ promptText, explanation });
  }, [writingTask, promptText, explanation]);

  const taskUi = WRITING_TASK_UI_CONFIG[resolvedWritingTask];
  const resolvedSubType = useMemo(
    () => detectWritingSubType(resolvedWritingTask, promptText, explanation),
    [resolvedWritingTask, promptText, explanation],
  );
  const subtypeUi = WRITING_SUBTYPE_UI_HINTS[resolvedSubType];

  // Đếm số từ thực tế theo chuẩn IELTS
  const wordCount = useMemo(() => countIeltsWords(currentEssay), [currentEssay]);

  const targetSpec = useMemo(() => {
    return {
      min: taskUi.minWords,
      label: taskUi.targetLabel,
    };
  }, [taskUi]);

  const isLengthSufficient = wordCount >= targetSpec.min;

  const handleAiGrade = async () => {
    const textToEvaluate = currentEssay.trim();
    const wordCountActual = countIeltsWords(textToEvaluate);
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
        studentAnswerId || '',
        { writingTask: resolvedWritingTask },
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

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${taskUi.badgeClass}`}
              >
                {taskUi.badgeLabel}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {subtypeUi.label}
              </span>
              <span className="font-medium text-slate-500 dark:text-slate-400 text-[11px]">
                {taskUi.subtitle}
              </span>
            </div>
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

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 text-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOutlineGuide((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-slate-800 dark:text-slate-200 font-semibold cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition"
            >
              <span className="flex items-center gap-1.5">
                <ListChecks size={13} className="text-blue-600 dark:text-blue-400" />
                <span>{taskUi.outlineTitle}</span>
              </span>
              {showOutlineGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showOutlineGuide && (
              <div className="px-3 pb-3 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {taskUi.outlineSteps.map((step) => (
                    <div
                      key={step.title}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-[11px]"
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">
                        {step.title}
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {step.detail}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  {taskUi.tipText}
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                  Trọng tâm dạng bài ({subtypeUi.label}): {subtypeUi.tip}
                </p>
              </div>
            )}
          </div>

          <textarea
            rows={9}
            disabled={disabled}
            placeholder={taskUi.placeholder}
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
          <WritingEvaluationReportPanel
            gradingResult={gradingResult}
            passBand={passBand}
            failCount={failCount}
            badgeLabel={taskUi.badgeLabel}
            firstCriterionCode={taskUi.firstCriterionCode}
            firstCriterionName={taskUi.firstCriterionName}
            copied={copied}
            onCopyCorrected={handleCopyCorrected}
            onEditClick={() => setViewMode('WRITE')}
          />

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
