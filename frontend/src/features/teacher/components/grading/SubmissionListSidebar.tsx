import React from "react";
import { Search, Loader2, Clock } from "lucide-react";
import type { GradingSubmission } from "./gradingTypes";

interface SubmissionListSidebarProps {
  submissions: GradingSubmission[];
  filteredSubmissions: GradingSubmission[];
  selectedSub: GradingSubmission | null;
  onSelectSubmission: (sub: GradingSubmission) => void;
  statusFilter: "ALL" | "PENDING" | "COMPLETED";
  onChangeStatusFilter: (status: "ALL" | "PENDING" | "COMPLETED") => void;
  search: string;
  onChangeSearch: (val: string) => void;
  pendingCount: number;
  completedCount: number;
  loadingSubmissions: boolean;
}

export const SubmissionListSidebar: React.FC<SubmissionListSidebarProps> = ({
  submissions,
  filteredSubmissions,
  selectedSub,
  onSelectSubmission,
  statusFilter,
  onChangeStatusFilter,
  search,
  onChangeSearch,
  pendingCount,
  completedCount,
  loadingSubmissions,
}) => {
  return (
    <div className="lg:col-span-5 space-y-3.5">
      {/* Status Tabs */}
      <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-1 text-xs shadow-sm">
        <button
          onClick={() => onChangeStatusFilter("ALL")}
          className={`flex-1 rounded-lg py-1.5 font-medium transition ${
            statusFilter === "ALL"
              ? "bg-blue-800 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Tất cả ({submissions.length})
        </button>
        <button
          onClick={() => onChangeStatusFilter("PENDING")}
          className={`flex-1 rounded-lg py-1.5 font-medium transition ${
            statusFilter === "PENDING"
              ? "bg-amber-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Chờ chấm ({pendingCount})
        </button>
        <button
          onClick={() => onChangeStatusFilter("COMPLETED")}
          className={`flex-1 rounded-lg py-1.5 font-medium transition ${
            statusFilter === "COMPLETED"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Đã chấm ({completedCount})
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm theo tên hoặc email học viên..."
          value={search}
          onChange={(e) => onChangeSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-600 transition shadow-sm"
        />
      </div>

      {/* List of submissions */}
      <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
        {loadingSubmissions ? (
          <div className="p-10 text-center text-slate-400 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin h-6 w-6 text-blue-600 mb-2" />
            <span className="text-xs">Đang tải danh sách bài nộp...</span>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-10 text-center text-slate-500 text-xs">
            {submissions.length === 0
              ? "Chưa có học sinh nào nộp bài tập này."
              : "Không tìm thấy học sinh phù hợp với bộ lọc."}
          </div>
        ) : (
          filteredSubmissions.map((sub) => {
            const isSelected = selectedSub?.attemptId === sub.attemptId;
            const isCompleted = sub.status === "COMPLETED";

            return (
              <div
                key={sub.attemptId}
                onClick={() => onSelectSubmission(sub)}
                className={`cursor-pointer rounded-xl border p-4 transition shadow-sm ${
                  isSelected
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-600/10 shadow-xs ring-1 ring-blue-600/30"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-slate-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200/80 dark:border-blue-900/50">
                      {sub.studentName?.charAt(0) || "U"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm">
                        {sub.studentName}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {sub.studentEmail}
                      </p>
                    </div>
                  </div>

                  {isCompleted ? (
                    <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      {sub.score !== null && sub.score !== undefined
                        ? `${sub.score} đ`
                        : "Đã chấm"}
                    </span>
                  ) : (
                    <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      Chờ chấm
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1 text-slate-400" />
                    Nộp:{" "}
                    {sub.submittedAt
                      ? new Date(sub.submittedAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })
                      : "Gần đây"}
                  </span>
                  {sub.attemptNumber && (
                    <span>Lần nộp #{sub.attemptNumber}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
