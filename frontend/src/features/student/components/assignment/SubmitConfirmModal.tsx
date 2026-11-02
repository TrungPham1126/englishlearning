import React from 'react';
import { AlertCircle, CheckCircle2, Send, Loader2, X } from 'lucide-react';

export interface SubmitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  answeredCount: number;
  totalQuestions: number;
  isSubmitting?: boolean;
}

export const SubmitConfirmModal: React.FC<SubmitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  answeredCount,
  totalQuestions,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  const unanswered = Math.max(0, totalQuestions - answeredCount);
  const isAllAnswered = unanswered === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-elevated p-6 space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isAllAnswered
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isAllAnswered ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            </div>
            <div>
              <h3 id="submit-modal-title" className="text-lg font-black text-slate-900 dark:text-slate-100">
                Xác Nhận Nộp Bài Thi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kiểm tra tiến độ làm bài trước khi hoàn tất
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Thống kê tiến độ */}
        <div
          className={`p-4 rounded-xl border text-sm leading-relaxed ${
            isAllAnswered
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
          }`}
        >
          {isAllAnswered ? (
            <p className="font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              Tuyệt vời! Bạn đã hoàn thành tất cả {totalQuestions}/{totalQuestions} câu hỏi.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="font-bold flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                Bạn vẫn còn {unanswered} câu chưa trả lời!
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Các câu chưa làm sẽ được tính 0 điểm. Bạn có muốn quay lại kiểm tra trước khi nộp không?
              </p>
            </div>
          )}
        </div>

        {/* Thanh đếm câu */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
          <span>Tiến độ hoàn thành</span>
          <span className="font-black text-slate-900 dark:text-slate-100">
            {answeredCount} / {totalQuestions} câu ({Math.round((answeredCount / (totalQuestions || 1)) * 100)}%)
          </span>
        </div>

        {/* Action Buttons (WCAG 44px touch-target) */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition cursor-pointer disabled:opacity-50 touch-manipulation"
          >
            Tiếp Tục Làm Bài
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-black text-sm shadow-md active:scale-[0.98] transition cursor-pointer disabled:opacity-50 touch-manipulation"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang nộp...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Nộp Bài Ngay</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmitConfirmModal;
