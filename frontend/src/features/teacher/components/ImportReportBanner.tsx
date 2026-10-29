// src/features/teacher/components/ImportReportBanner.tsx
import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, X, Layers } from "lucide-react";
import type { ImportReport, ImportGroup } from "../utils/assignmentImport";

interface ImportReportBannerProps {
  report: ImportReport | null;
  groups?: ImportGroup[];
  activeGroupKey?: string;
  onSwitchGroup?: (key: string) => void;
  onClose: () => void;
}

export default function ImportReportBanner({
  report,
  groups = [],
  activeGroupKey,
  onSwitchGroup,
  onClose,
}: ImportReportBannerProps) {
  const [expanded, setExpanded] = useState<boolean>(false);

  if (!report) return null;

  const hasErrors = report.errors.length > 0;
  const hasWarnings = report.warnings.length > 0;
  const isSuccess = report.imported > 0;

  return (
    <div
      role="region"
      aria-label="Báo cáo kết quả nhập dữ liệu"
      className={`rounded-xl border p-4 transition-all duration-200 animate-in fade-in ${
        hasErrors && !isSuccess
          ? "border-rose-300 dark:border-rose-500/30 bg-rose-50/90 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100"
          : hasErrors || hasWarnings
          ? "border-amber-300 dark:border-amber-500/30 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
          : "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {hasErrors && !isSuccess ? (
              <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            ) : hasErrors || hasWarnings ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-black uppercase tracking-wider">
                {isSuccess
                  ? `Nhập Thành Công ${report.imported} Câu Hỏi Từ ${report.source === "EXCEL" ? "File Excel" : "Văn Bản Thô"}`
                  : `Không Thể Nhập Câu Hỏi Từ ${report.source === "EXCEL" ? "File Excel" : "Văn Bản Thô"}`}
              </h4>

              {groups.length > 1 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Layers className="h-3 w-3" />
                  Phát hiện {groups.length} nhóm kỹ năng
                </span>
              )}
            </div>

            <p className="text-xs leading-relaxed opacity-90">
              {isSuccess ? (
                <>
                  Hệ thống đã tự động chuẩn hóa định dạng câu hỏi và chuyển sang <b>Bước 2 (Xem &amp; Chỉnh sửa)</b>. Bạn có thể kiểm tra đề bài, các lựa chọn và đáp án trước khi lưu.
                </>
              ) : (
                <>
                  Vui lòng kiểm tra lại cấu trúc file hoặc văn bản nhập vào theo các thông báo chi tiết bên dưới.
                </>
              )}
            </p>

            {/* Các nhóm kỹ năng nếu file Excel chứa nhiều kỹ năng cùng lúc */}
            {groups.length > 1 && onSwitchGroup && (
              <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                <span className="text-[11px] font-bold opacity-80 mr-1">Chuyển nhóm kỹ năng:</span>
                {groups.map((g) => {
                  const isActive = g.key === activeGroupKey;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => onSwitchGroup(g.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer border ${
                        isActive
                          ? "bg-blue-800 text-white border-blue-600 shadow-xs ring-2 ring-blue-600/30"
                          : "bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {g.skill} ({g.questions.length} câu)
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(hasErrors || hasWarnings) && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-xs font-bold transition cursor-pointer"
            >
              <span>{expanded ? "Thu gọn" : `Chi tiết (${report.errors.length + report.warnings.length})`}</span>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Danh sách lỗi và cảnh báo chi tiết theo từng dòng */}
      {expanded && (hasErrors || hasWarnings) && (
        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 space-y-2 text-xs">
          {report.errors.length > 0 && (
            <div className="space-y-1">
              <span className="font-extrabold text-rose-700 dark:text-rose-400 block">
                ⛔ Các dòng có lỗi ({report.errors.length}):
              </span>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-rose-800 dark:text-rose-200">
                {report.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {report.warnings.length > 0 && (
            <div className="space-y-1">
              <span className="font-extrabold text-amber-700 dark:text-amber-400 block">
                ⚠️ Cảnh báo tự động điều chỉnh ({report.warnings.length}):
              </span>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800 dark:text-amber-200">
                {report.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
