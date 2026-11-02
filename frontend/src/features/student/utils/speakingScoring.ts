// src/features/student/utils/speakingScoring.ts
import type { AttemptResponse, QuestionResultDetail } from "../types";

/**
 * Chuẩn hóa điểm số về thang điểm 100 (0 - 100).
 * Nếu điểm dạng 0 - 10 (vd: 8.6, 9.0) -> nhân 10 thành 86.0, 90.0.
 * Nếu đã là thang 100 (vd: 86.0) -> giữ nguyên.
 */
export function normalizeScoreTo100(rawScore: number | null | undefined): number {
  if (rawScore === null || rawScore === undefined || isNaN(rawScore)) return 0;
  if (rawScore <= 10 && rawScore > 0) {
    return Math.round(rawScore * 100) / 10;
  }
  return Math.round(rawScore * 10) / 10;
}

/**
 * Lấy điểm số của một câu hỏi cụ thể từ QuestionResultDetail
 */
export function getQuestionScore(q: QuestionResultDetail | null | undefined): number {
  if (!q) return 0;

  // 1. Kiểm tra evalFeedback JSON (chứa phân tích âm vị Groq hoặc IELTS Speaking)
  if (q.evalFeedback) {
    try {
      const parsed = JSON.parse(q.evalFeedback);
      if (parsed.overallScore !== undefined && parsed.overallScore !== null) {
        return normalizeScoreTo100(Number(parsed.overallScore));
      }
      if (parsed.score !== undefined && parsed.score !== null) {
        return normalizeScoreTo100(Number(parsed.score));
      }
      if (parsed.overallBand !== undefined && parsed.overallBand !== null) {
        return normalizeScoreTo100(Number(parsed.overallBand) * 10);
      }
    } catch {}
  }

  // 2. Điểm đạt được theo maxPoints
  if (q.earnedPoints !== undefined && q.earnedPoints !== null) {
    if (q.maxPoints && q.maxPoints > 0) {
      return Math.round((q.earnedPoints / q.maxPoints) * 1000) / 10;
    }
    return normalizeScoreTo100(q.earnedPoints);
  }

  // 3. Fallback score trên entity
  if ((q as any).score !== undefined && (q as any).score !== null) {
    return normalizeScoreTo100((q as any).score);
  }

  // 4. Đánh dấu isCorrect
  if (q.isCorrect === true) {
    return 100;
  }

  return 0;
}

/**
 * Tìm điểm cao nhất của 1 câu hỏi trên TẤT CẢ các lần làm bài (attempts)
 */
export function getQuestionBestScoreAcrossAttempts(
  questionId: string,
  currentQ: QuestionResultDetail | null | undefined,
  attempts: AttemptResponse[] = [],
): number {
  let best = currentQ ? getQuestionScore(currentQ) : 0;

  for (const att of attempts) {
    const matched = att.questions?.find((item) => item.questionId === questionId);
    if (matched) {
      const score = getQuestionScore(matched);
      if (score > best) best = score;
    }
  }

  return best;
}

/**
 * Kiểm tra câu hỏi đã ĐẠT CHUẨN hay chưa (theo tỷ lệ sai cho phép của giáo viên hoặc mặc định 80 điểm)
 */
export function isQuestionPassed(
  questionId: string,
  currentQ: QuestionResultDetail | null | undefined,
  attempts: AttemptResponse[] = [],
  customPassThreshold?: number,
): boolean {
  if (currentQ?.isCorrect) return true;
  const bestScore = getQuestionBestScoreAcrossAttempts(questionId, currentQ, attempts);
  const sampleAttempt = attempts[0];
  const maxAllowedError = sampleAttempt?.maxAllowedErrorPercent != null
    ? sampleAttempt.maxAllowedErrorPercent
    : (sampleAttempt?.passScore != null ? Math.max(0, 100 - (sampleAttempt.passScore <= 10 ? sampleAttempt.passScore * 10 : sampleAttempt.passScore)) : 20);
  const threshold = customPassThreshold ?? (100 - maxAllowedError);
  return bestScore >= threshold;
}

/**
 * Tìm chỉ mục (index) của câu hỏi CHƯA ĐẠT tiếp theo trong danh sách câu hỏi.
 * Ưu tiên tìm từ vị trí hiện tại + 1 đến cuối, nếu không có thì vòng lại từ đầu.
 * Trả về -1 nếu TẤT CẢ các câu hỏi đều đã đạt.
 */
export function findNextUnpassedQuestionIndex(
  currentIndex: number,
  questions: QuestionResultDetail[],
  attempts: AttemptResponse[] = [],
  customPassThreshold?: number,
): number {
  if (!questions || questions.length === 0) return -1;

  // 1. Tìm từ currentIndex + 1 đến cuối danh sách
  for (let i = currentIndex + 1; i < questions.length; i++) {
    const q = questions[i];
    if (!isQuestionPassed(q.questionId, q, attempts, customPassThreshold)) {
      return i;
    }
  }

  // 2. Vòng lại tìm từ đầu (0) đến currentIndex - 1
  for (let i = 0; i < currentIndex; i++) {
    const q = questions[i];
    if (!isQuestionPassed(q.questionId, q, attempts, customPassThreshold)) {
      return i;
    }
  }

  return -1; // Tất cả câu hỏi đều đã đạt chuẩn
}

/**
 * Tổng hợp thông tin điểm số, trạng thái PASS / NOT PASS và số lần nộp bài
 * Dựa trên cấu hình maxAllowedErrorPercent và maxAttempts của giáo viên
 */
export function getAssignmentScoreSummary(attempts: AttemptResponse[] = []) {
  const completedAttempts = attempts.filter((a) => a.status !== "IN_PROGRESS");

  const getScore = (att: AttemptResponse) => {
    return normalizeScoreTo100(att.score ?? att.totalScore ?? 0);
  };

  const highestScore = completedAttempts.reduce(
    (max, a) => Math.max(max, getScore(a)),
    0,
  );

  const bestAttempt =
    completedAttempts.length > 0
      ? [...completedAttempts].sort((a, b) => getScore(b) - getScore(a))[0]
      : null;

  const sampleAttempt = attempts[0];
  const maxAllowedError = sampleAttempt?.maxAllowedErrorPercent != null
    ? sampleAttempt.maxAllowedErrorPercent
    : (sampleAttempt?.passScore != null ? Math.max(0, 100 - (sampleAttempt.passScore <= 10 ? sampleAttempt.passScore * 10 : sampleAttempt.passScore)) : 20);
  const passThreshold = 100 - maxAllowedError;
  const maxAttemptsCount = sampleAttempt?.maxAttempts != null && sampleAttempt.maxAttempts > 0 ? sampleAttempt.maxAttempts : 3;

  const isPassed = highestScore >= passThreshold;
  const isAttemptsExhausted = !isPassed && completedAttempts.length >= maxAttemptsCount;
  const remainingAttempts = Math.max(0, maxAttemptsCount - completedAttempts.length);

  return {
    completedAttempts,
    highestScore,
    bestAttempt,
    isPassed,
    passThreshold,
    maxAllowedError,
    maxAttemptsCount,
    isAttemptsExhausted,
    remainingAttempts,
    attemptsCount: attempts.length,
    completedCount: completedAttempts.length,
  };
}
