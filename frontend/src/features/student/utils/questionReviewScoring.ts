import type { QuestionResultDetail } from '@/features/student/types';

export interface StudentQuestionAnswer {
  selectedOptionId?: string;
  textAnswer?: string;
  audioUrl?: string;
}

export interface QuestionReviewOutcome {
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidString(value?: string | null): boolean {
  return UUID_PATTERN.test(String(value ?? '').trim());
}

export function normalizeAnswerText(value?: string | null): string {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .toLowerCase();
}

const normalizeText = normalizeAnswerText;

export function normalizeTrueFalseValue(value?: string | null): string {
  const upper = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
  if (upper === 'T') return 'TRUE';
  if (upper === 'F') return 'FALSE';
  if (upper === 'NG') return 'NOT GIVEN';
  return upper;
}

export function formatQuestionPoints(points: number): string {
  if (!Number.isFinite(points)) return '0';
  const rounded = Math.round(points * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function resolveMaxPoints(question: QuestionResultDetail): number {
  const raw = Number((question as any)?.maxPoints ?? (question as any)?.points ?? 1);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function matchesOptionCorrectly(
  question: QuestionResultDetail,
  selectedId: string,
  textAns: string,
): boolean {
  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length === 0) return false;

  const qType = String(question.questionType || '').toUpperCase();
  const isTrueFalse =
    qType === 'TRUE_FALSE' ||
    ['TRUE', 'FALSE', 'NOT GIVEN'].includes(normalizeTrueFalseValue(question.correctAnswer));

  const normSelected = normalizeText(selectedId);
  const normText = normalizeText(textAns);
  const tfSelected = normalizeTrueFalseValue(selectedId);
  const tfText = normalizeTrueFalseValue(textAns);

  const hasExplicitCorrectFlag = options.some((o: any) => o?.isCorrect === true);

  if (hasExplicitCorrectFlag) {
    return options.some((o: any) => {
      if (o?.isCorrect !== true) return false;
      const optId = String(o.id ?? '').trim();
      const optLabel = normalizeText(o.optionLabel);
      const optText = normalizeText(o.optionText ?? o.text);

      if (selectedId) {
        if (optId && selectedId === optId) return true;
        if (optLabel && normSelected === optLabel) return true;
        if (
          isTrueFalse &&
          (tfSelected === normalizeTrueFalseValue(o.optionLabel) ||
            tfSelected === normalizeTrueFalseValue(o.optionText ?? o.text))
        ) {
          return true;
        }
      }

      if (normText) {
        if (optText && normText === optText) return true;
        if (optLabel && normText === optLabel) return true;
        if (
          isTrueFalse &&
          (tfText === normalizeTrueFalseValue(o.optionLabel) ||
            tfText === normalizeTrueFalseValue(o.optionText ?? o.text))
        ) {
          return true;
        }
      }

      return false;
    });
  }

  // Fallback nếu options không gắn cờ isCorrect nhưng question.correctAnswer có giá trị
  const normExpected = normalizeText(question.correctAnswer);
  if (!normExpected) return false;

  const selectedOpt = options.find((o: any) => {
    const optId = String(o?.id ?? '').trim();
    return (
      (selectedId && ((optId && optId === selectedId) || normalizeText(o?.optionLabel) === normSelected)) ||
      (normText && (normalizeText(o?.optionText ?? o?.text) === normText || normalizeText(o?.optionLabel) === normText))
    );
  });

  if (!selectedOpt) return false;

  const selLabel = normalizeText((selectedOpt as any).optionLabel);
  const selText = normalizeText((selectedOpt as any).optionText ?? (selectedOpt as any).text);
  if (selLabel === normExpected || selText === normExpected) return true;
  if (isTrueFalse) {
    const tfExpected = normalizeTrueFalseValue(question.correctAnswer);
    return (
      normalizeTrueFalseValue((selectedOpt as any).optionLabel) === tfExpected ||
      normalizeTrueFalseValue((selectedOpt as any).optionText ?? (selectedOpt as any).text) === tfExpected
    );
  }
  return false;
}

export function evaluateQuestionReviewOutcome(
  question: QuestionResultDetail,
  studentAns?: StudentQuestionAnswer | null,
): QuestionReviewOutcome {
  const maxPoints = resolveMaxPoints(question);
  const rawEarned = (question as any)?.earnedPoints;
  const backendEarned =
    rawEarned != null && Number.isFinite(Number(rawEarned)) ? Number(rawEarned) : null;

  if (question.isCorrect === true || (backendEarned !== null && backendEarned > 0)) {
    return {
      isCorrect: true,
      earnedPoints: backendEarned !== null && backendEarned > 0 ? backendEarned : maxPoints,
      maxPoints,
    };
  }

  const selectedId = String(studentAns?.selectedOptionId ?? question.selectedOptionId ?? '').trim();
  const textAns = String(studentAns?.textAnswer ?? question.studentAnswer ?? '').trim();

  if (!selectedId && !textAns) {
    return { isCorrect: false, earnedPoints: 0, maxPoints };
  }

  const qType = String(question.questionType || '').toUpperCase();

  // 1. Đối chiếu danh sách options (MULTIPLE_CHOICE / TRUE_FALSE có options)
  if (matchesOptionCorrectly(question, selectedId, textAns)) {
    return { isCorrect: true, earnedPoints: maxPoints, maxPoints };
  }

  // 2. TRUE_FALSE (kể cả NOT_GIVEN vs NOT GIVEN)
  const expectedTf = normalizeTrueFalseValue(question.correctAnswer);
  const isTrueFalse =
    qType === 'TRUE_FALSE' || expectedTf === 'TRUE' || expectedTf === 'FALSE' || expectedTf === 'NOT GIVEN';
  if (isTrueFalse && expectedTf) {
    const studentTf = normalizeTrueFalseValue(textAns || selectedId);
    if (studentTf && studentTf === expectedTf) {
      return { isCorrect: true, earnedPoints: maxPoints, maxPoints };
    }
  }

  // 3. Điền từ / Sắp xếp từ / Matching
  const normText = normalizeText(textAns);
  const normExpected = normalizeText(question.correctAnswer);
  if (normText && normExpected) {
    if (normText === normExpected) {
      return { isCorrect: true, earnedPoints: maxPoints, maxPoints };
    }
    if (qType === 'FILL_IN_BLANK' && (question.correctAnswer!.includes('|') || question.correctAnswer!.includes('/'))) {
      const variants = question.correctAnswer!.split(/[|/]/);
      if (variants.some((v) => {
        const nv = normalizeText(v);
        return Boolean(nv) && nv === normText;
      })) {
        return { isCorrect: true, earnedPoints: maxPoints, maxPoints };
      }
    }
  }

  if (qType === 'MATCHING') {
    const normMatchText = normalizeText(question.matchText);
    if (normText && normMatchText && normText === normMatchText) {
      return { isCorrect: true, earnedPoints: maxPoints, maxPoints };
    }
    if (selectedId && question.questionId && selectedId === question.questionId) {
      return { isCorrect: true, earnedPoints: maxPoints, maxPoints };
    }
  }

  return { isCorrect: false, earnedPoints: 0, maxPoints };
}

export function hasMatchingOptionId(
  question: Pick<QuestionResultDetail, 'options'>,
  rawId?: string | null,
): boolean {
  const target = String(rawId ?? '').trim();
  if (!target || !Array.isArray(question.options)) return false;
  return question.options.some((o: any) => String(o?.id ?? '').trim() === target);
}

export function resolveRestoredOptionId(
  question: Pick<QuestionResultDetail, 'selectedOptionId' | 'studentAnswer' | 'options'>,
): string | undefined {
  if (question.selectedOptionId) return question.selectedOptionId;
  const rawStudentAns = String(question.studentAnswer ?? '').trim();
  if (!rawStudentAns) return undefined;
  return isUuidString(rawStudentAns) || hasMatchingOptionId(question, rawStudentAns)
    ? rawStudentAns
    : undefined;
}

export function resolveSubmitAnswerPayload(
  question: Pick<QuestionResultDetail, 'questionId' | 'questionType' | 'options'>,
  ans?: StudentQuestionAnswer | null,
): {
  questionId: string;
  selectedOptionId: string | undefined;
  textAnswer: string | undefined;
  answerText: string | undefined;
} {
  const rawSelected = String(ans?.selectedOptionId ?? '').trim();
  let selectedOptionId: string | undefined;
  let textAnswer = ans?.textAnswer;

  if (rawSelected) {
    if (isUuidString(rawSelected) || hasMatchingOptionId(question, rawSelected)) {
      selectedOptionId = rawSelected;
    } else {
      const normSelected = normalizeAnswerText(rawSelected);
      const tfSelected = normalizeTrueFalseValue(rawSelected);
      const isTf =
        String(question.questionType || '').toUpperCase() === 'TRUE_FALSE' ||
        tfSelected === 'TRUE' ||
        tfSelected === 'FALSE' ||
        tfSelected === 'NOT GIVEN';
      const matchedOpt = Array.isArray(question.options)
        ? question.options.find((o: any) => {
            const label = normalizeAnswerText(o?.optionLabel);
            const text = normalizeAnswerText(o?.optionText ?? o?.text);
            if (label === normSelected || text === normSelected) return true;
            if (isTf) {
              return (
                normalizeTrueFalseValue(o?.optionLabel) === tfSelected ||
                normalizeTrueFalseValue(o?.optionText ?? o?.text) === tfSelected
              );
            }
            return false;
          })
        : undefined;
      const resolvedId = matchedOpt?.id != null ? String(matchedOpt.id).trim() : '';
      selectedOptionId = resolvedId || undefined;
      textAnswer = ans?.textAnswer || rawSelected;
    }
  }

  return {
    questionId: question.questionId,
    selectedOptionId,
    textAnswer,
    answerText: textAnswer,
  };
}
