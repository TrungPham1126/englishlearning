import React, { useState, useEffect } from "react";
import { X, ShieldAlert, Loader2 } from "lucide-react";

interface UpdateQuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    studentId: string;
    studentName?: string;
    email: string;
    currentLimit: number;
    isBlocked: boolean;
  } | null;
  onSave: (studentId: string, newLimit: number, isBlocked: boolean) => Promise<void>;
  isProcessing: boolean;
}

export const UpdateQuotaModal: React.FC<UpdateQuotaModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSave,
  isProcessing,
}) => {
  const [limit, setLimit] = useState<number>(20);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (targetUser) {
      setLimit(targetUser.currentLimit || 20);
      setError(null);
    }
  }, [targetUser]);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(limit) || limit < 0) {
      setError("Hạn ngạch phải là số nguyên dương.");
      return;
    }
    try {
      await onSave(targetUser.studentId, limit, targetUser.isBlocked);
      onClose();
    } catch {
      setError("Có lỗi xảy ra khi cập nhật hạn ngạch.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-slate-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Điều Chỉnh Hạn Ngạch AI Quota
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {targetUser.studentName || targetUser.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Giới hạn lượt gọi AI / ngày (Daily Limit):
            </label>
            <input
              type="number"
              min={0}
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-600"
              required
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Áp dụng cho các tính năng sinh đề thi (Teacher) hoặc chấm bài nói (Student).
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isProcessing && <Loader2 size={14} className="animate-spin" />}
              <span>Lưu Hạn Ngạch</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateQuotaModal;
