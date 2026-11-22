import React from 'react';
import { Clock, AlertCircle, CheckCircle2, RotateCcw, Loader2, XCircle } from 'lucide-react';
import type { AttemptResponse } from '@/features/student/types';
import { normalizeScoreTo10 } from '@/utils/scoreScale';

export interface AssignmentResultBannerProps {
  retakeEvaluation: {
    isEssay: boolean;
    canRetry: boolean;
    errorRate: number;
    scorePercent: number;
    message: string;
  } | null;
  reviewStats: {
    correctCount: number;
    totalQuestions: number;
  };
  attempt: AttemptResponse | null;
  onRetake: () => void;
  isStarting?: boolean;
}

export const AssignmentResultBanner: React.FC<AssignmentResultBannerProps> = ({
  retakeEvaluation,
  reviewStats,
  attempt,
  onRetake,
  isStarting = false,
}) => {
  if (!retakeEvaluation && !attempt) return null;

  const isEssay = retakeEvaluation?.isEssay ?? false;
  
  // Tính tỷ lệ chính xác tin cậy (kết hợp cả score lẫn reviewStats)
  const totalQ = reviewStats.totalQuestions || 1;
  const correctCount = reviewStats.correctCount;
  const statsPercent = Math.round((correctCount / totalQ) * 100);
  
  // Điểm số từ attempt (chuẩn thang 10)
  const rawScore = attempt?.score != null ? attempt.score : (attempt as any)?.totalScore;
  const normalizedScore = normalizeScoreTo10(rawScore);
  const scorePercent =
    normalizedScore != null
      ? Math.min(100, Math.max(0, (normalizedScore / 10) * 100))
      : statsPercent;
  
  const isNotPass = Boolean(retakeEvaluation && !retakeEvaluation.canRetry && retakeEvaluation.message.includes('NOT PASS'));

  // Kiểm tra ngưỡng đạt chuẩn từ cấu hình giáo viên
  const isAllCorrect = correctCount === totalQ && totalQ > 0;
  const maxAllowedError = attempt?.maxAllowedErrorPercent != null
    ? attempt.maxAllowedErrorPercent
    : (attempt?.passScore != null ? Math.max(0, 100 - (attempt.passScore <= 10 ? attempt.passScore * 10 : attempt.passScore)) : 20);
  const effectiveErrorRate = isAllCorrect ? 0 : Math.round(100 - Math.max(scorePercent, statsPercent));
  const canRetry = isEssay ? false : (retakeEvaluation != null ? retakeEvaluation.canRetry : (!isAllCorrect && effectiveErrorRate > maxAllowedError));

  return (
    <div
      className={`p-4 sm:p-5 rounded-xl border transition-all shadow-xs ${
        isEssay
          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100'
          : isNotPass
          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/80 text-rose-950 dark:text-rose-100'
          : canRetry
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-100'
          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-100'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isEssay
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                : isNotPass
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-300'
                : canRetry
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300'
            }`}
          >
            {isEssay ? (
              <Clock size={20} />
            ) : isNotPass ? (
              <XCircle size={20} />
            ) : canRetry ? (
              <AlertCircle size={20} />
            ) : (
              <CheckCircle2 size={20} />
            )}
          </div>

          <div className="space-y-0.5">
            <h3 className="font-bold text-sm sm:text-base">
              {isEssay
                ? 'Đã gửi bài viết'
                : isNotPass
                ? 'Chưa đạt (Hết lượt)'
                : canRetry
                ? `Chưa đạt (${effectiveErrorRate}% lỗi > ${maxAllowedError}%)`
                : 'Hoàn thành'}
            </h3>
            <p className="text-xs font-medium opacity-90">
              {isEssay
                ? 'Đang chờ chấm điểm.'
                : retakeEvaluation?.message ||
                  (canRetry
                    ? `Đúng ${correctCount}/${totalQ} câu. Cần làm lại để đạt chuẩn.`
                    : `Đúng ${correctCount}/${totalQ} câu.`)}
            </p>
          </div>
        </div>

        {canRetry && !isEssay && (
          <button
            type="button"
            disabled={isStarting}
            onClick={onRetake}
            className="min-h-[38px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-semibold text-xs shadow-xs transition cursor-pointer shrink-0 touch-manipulation disabled:opacity-50"
          >
            {isStarting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            <span>Làm lại</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AssignmentResultBanner;
