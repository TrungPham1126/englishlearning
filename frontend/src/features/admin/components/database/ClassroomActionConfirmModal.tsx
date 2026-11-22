import React, { useState, useEffect } from "react";
import { AlertTriangle, Trash2, DatabaseZap, X, Loader2 } from "lucide-react";

export type ClassroomDestructiveActionMode = "PURGE_SUBMISSIONS" | "DELETE_CLASSROOM";

interface ClassroomActionConfirmModalProps {
  open: boolean;
  mode: ClassroomDestructiveActionMode;
  classroomName: string;
  classroomStatus: string;
  attemptCount?: number;
  answerCount?: number;
  audioCount?: number;
  processing: boolean;
  onCancel: () => void;
  onConfirm: (forcePurge: boolean) => void;
}

export const ClassroomActionConfirmModal: React.FC<ClassroomActionConfirmModalProps> = ({
  open,
  mode,
  classroomName,
  classroomStatus,
  attemptCount = 0,
  answerCount = 0,
  audioCount = 0,
  processing,
  onCancel,
  onConfirm,
}) => {
  const [confirmText, setConfirmText] = useState("");
  const [forceOverride, setForceOverride] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmText("");
      setForceOverride(false);
    }
  }, [open, classroomName, mode]);

  if (!open) return null;

  const isDeleteClass = mode === "DELETE_CLASSROOM";
  const isCompletedOrCancelled =
    classroomStatus === "COMPLETED" || classroomStatus === "CANCELLED";
  const needsForceCheckbox = !isDeleteClass && !isCompletedOrCancelled;
  const mustMatchName = isDeleteClass;
  const nameMatches = confirmText.trim() === classroomName.trim();

  const canSubmit =
    !processing &&
    (!mustMatchName || nameMatches) &&
    (!needsForceCheckbox || forceOverride);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDeleteClass
              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isDeleteClass ? (
              <Trash2 size={20} className="text-rose-600" />
            ) : (
              <DatabaseZap size={20} className="text-amber-600" />
            )}
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {isDeleteClass
                ? "Xóa vĩnh viễn lớp học"
                : "Dọn dữ liệu bài làm"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="text-slate-400 hover:text-rose-500 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white">
              Lớp: {classroomName} ({classroomStatus})
            </div>
            <div className="text-xs text-slate-500">
              Hiện có: <strong className="text-slate-800 dark:text-slate-200">{attemptCount}</strong> lượt nộp,{" "}
              <strong className="text-slate-800 dark:text-slate-200">{answerCount}</strong> đáp án,{" "}
              <strong className="text-slate-800 dark:text-slate-200">{audioCount}</strong> audio R2.
            </div>
          </div>

          {isDeleteClass ? (
            <div className="flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50/70 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Không thể hoàn tác!</p>
                <p className="mt-1">
                  Xóa toàn bộ bài nộp, file R2 của lớp, bài giảng, đề thi và ghi danh (giữ lại Kho học liệu chung).
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Nên xuất Excel trước khi dọn!</p>
                <p className="mt-1">
                  Chỉ xóa bài làm, điểm, AI eval, tiến độ và audio R2 — <strong>giữ nguyên</strong> lớp, bài giảng và đề.
                </p>
              </div>
            </div>
          )}

          {needsForceCheckbox && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={forceOverride}
                onChange={(e) => setForceOverride(e.target.checked)}
                className="mt-0.5 accent-amber-600"
              />
              <span>
                Lớp đang ở trạng thái <strong>{classroomStatus}</strong> (chưa kết thúc). Xác nhận vẫn dọn bài làm.
              </span>
            </label>
          )}

          {mustMatchName && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nhập tên lớp <span className="text-rose-600 select-all">"{classroomName}"</span> để xác nhận:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={classroomName}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-600"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-[#0d1424]">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer transition"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm(needsForceCheckbox ? forceOverride : false)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer transition disabled:opacity-45 disabled:cursor-not-allowed ${
              isDeleteClass
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {processing && <Loader2 size={14} className="animate-spin" />}
            {isDeleteClass ? "Xóa vĩnh viễn" : "Xác nhận dọn"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassroomActionConfirmModal;
