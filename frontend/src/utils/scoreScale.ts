/**
 * Helpers to enforce the canonical 0.0–10.0 student scoring scale across the UI.
 * Legacy backend/database scores stored on a 0–100 scale (> 10) are normalized by dividing by 10.
 */

export function normalizeScoreTo10(
  score: number | string | null | undefined,
): number | null {
  if (score === null || score === undefined || score === "") {
    return null;
  }
  const num = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(num)) {
    return null;
  }
  const scaled = num > 10 ? num / 10 : num;
  const clamped = Math.max(0, Math.min(10, scaled));
  return Math.round(clamped * 10) / 10;
}

export function normalizeScoreTo10OrZero(
  score: number | string | null | undefined,
): number {
  return normalizeScoreTo10(score) ?? 0;
}

export function formatScore10(
  score: number | string | null | undefined,
  fallback = "0.0",
  fractionDigits = 1,
): string {
  const normalized = normalizeScoreTo10(score);
  if (normalized === null) {
    return fallback;
  }
  return normalized.toFixed(fractionDigits);
}

/**
 * Normalizes an AI evaluation score to the 0.0–10.0 scale.
 * - Legacy 0–100 scores (> 10) are divided by 10.
 * - Optional IELTS Band mode (when isBandScale is true and evalType !== "SHADOWING" and score <= 9)
 *   converts Band 0–9 to scale 10 via (score / 9) * 10.
 */
export function normalizeAiScoreTo10(
  aiScore: number | string | null | undefined,
  evalType?: string | null,
  isBandScale = false,
): number | null {
  if (aiScore === null || aiScore === undefined || aiScore === "") {
    return null;
  }
  const num = typeof aiScore === "number" ? aiScore : Number(aiScore);
  if (!Number.isFinite(num)) {
    return null;
  }
  if (num > 10) {
    return Math.round(Math.max(0, Math.min(10, num / 10)) * 10) / 10;
  }
  if (isBandScale && evalType !== "SHADOWING" && num <= 9) {
    return Math.round(Math.max(0, Math.min(10, (num / 9.0) * 10)) * 10) / 10;
  }
  return Math.round(Math.max(0, Math.min(10, num)) * 10) / 10;
}
