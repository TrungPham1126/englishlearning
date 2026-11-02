import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Ban,
} from "lucide-react";
import type { StudentQuotaItem } from "@/features/admin/types";

interface StudentQuotaTableProps {
  quotas: StudentQuotaItem[];
  isProcessing: boolean;
  onOpenUpdateQuota: (user: {
    studentId: string;
    studentName?: string;
    email: string;
    currentLimit: number;
    isBlocked: boolean;
  }) => void;
  onToggleBlock: (studentId: string, currentLimit: number, currentBlocked: boolean) => void;
}

export const StudentQuotaTable: React.FC<StudentQuotaTableProps> = ({
  quotas,
  isProcessing,
  onOpenUpdateQuota,
  onToggleBlock,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");
  const [sortField, setSortField] = useState<"name" | "used" | "tokens" | "cost" | "status">("used");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const toggleSort = (field: "name" | "used" | "tokens" | "cost" | "status") => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const filteredQuotas = useMemo(() => {
    let result = quotas;
    if (roleFilter !== "ALL") {
      result = result.filter(
        (item) => (item.role || "STUDENT").toUpperCase() === roleFilter,
      );
    }
    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(
      (item) =>
        item.email.toLowerCase().includes(q) ||
        (item.studentName && item.studentName.toLowerCase().includes(q)),
    );
  }, [quotas, roleFilter, searchQuery]);

  const sortedQuotas = useMemo(() => {
    return [...filteredQuotas].sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        const nameA = a.studentName || a.email;
        const nameB = b.studentName || b.email;
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === "used") {
        comparison = (a.dailyUsed || 0) - (b.dailyUsed || 0);
      } else if (sortField === "tokens") {
        comparison = (a.totalTokensUsed || 0) - (b.totalTokensUsed || 0);
      } else if (sortField === "cost") {
        comparison = (a.estimatedCostUsd || 0) - (b.estimatedCostUsd || 0);
      } else if (sortField === "status") {
        const statusRank = (item: StudentQuotaItem) =>
          item.isBlocked ? 2 : item.dailyUsed >= item.dailyLimit ? 1 : 0;
        comparison = statusRank(a) - statusRank(b);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredQuotas, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedQuotas.length / pageSize));
  const paginatedQuotas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedQuotas.slice(start, start + pageSize);
  }, [sortedQuotas, currentPage, pageSize]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header, Filters & Search */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/40">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert size={20} className="text-blue-700 dark:text-blue-400" />
            Kiểm Soát Hạn Mức &amp; Chống Lạm Dụng AI (Anti-Spam)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tối đa 5 lần/phút với giáo viên, 3 lần/phút với học viên. Theo dõi chi tiết từng lượt tạo đề (Groq) &amp; chấm nói (Gemini).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl text-xs font-bold shrink-0">
            <button
              onClick={() => { setRoleFilter("ALL"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                roleFilter === "ALL"
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Tất cả ({quotas.length})
            </button>
            <button
              onClick={() => { setRoleFilter("TEACHER"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                roleFilter === "TEACHER"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Giáo viên ({quotas.filter((q) => (q.role || "").toUpperCase() === "TEACHER").length})
            </button>
            <button
              onClick={() => { setRoleFilter("STUDENT"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                roleFilter === "STUDENT"
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Học viên ({quotas.filter((q) => (q.role || "STUDENT").toUpperCase() === "STUDENT").length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 select-none">
              <th className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition" onClick={() => toggleSort("name")}>
                <div className="flex items-center gap-1.5">
                  <span>Người Dùng &amp; Vai Trò</span>
                  {sortField === "name" ? (sortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={13} className="text-slate-400" />}
                </div>
              </th>
              <th className="p-4 text-center">Tầng AI (Tier)</th>
              <th className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition" onClick={() => toggleSort("used")}>
                <div className="flex items-center gap-1.5">
                  <span>Hạn Ngạch Hôm Nay</span>
                  {sortField === "used" ? (sortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={13} className="text-slate-400" />}
                </div>
              </th>
              <th className="p-4 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition" onClick={() => toggleSort("tokens")}>
                <div className="flex items-center justify-center gap-1.5">
                  <span>Tổng Token</span>
                  {sortField === "tokens" ? (sortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={13} className="text-slate-400" />}
                </div>
              </th>
              <th className="p-4 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition" onClick={() => toggleSort("cost")}>
                <div className="flex items-center justify-center gap-1.5">
                  <span>Chi Phí ($)</span>
                  {sortField === "cost" ? (sortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={13} className="text-slate-400" />}
                </div>
              </th>
              <th className="p-4 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition" onClick={() => toggleSort("status")}>
                <div className="flex items-center justify-center gap-1.5">
                  <span>Trạng Thái</span>
                  {sortField === "status" ? (sortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={13} className="text-slate-400" />}
                </div>
              </th>
              <th className="p-4 text-right">Hành Động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {sortedQuotas.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  Không tìm thấy người dùng nào khớp với bộ lọc và tìm kiếm.
                </td>
              </tr>
            ) : (
              paginatedQuotas.map((q) => {
                const isTeacher = (q.role || "").toUpperCase() === "TEACHER";
                const used = q.dailyUsed || 0;
                const limit = q.dailyLimit || 20;
                const usagePct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                const isExceeded = used >= limit;
                const isWarn = !isExceeded && usagePct >= 75;
                const barColor =
                  q.isBlocked || isExceeded || usagePct >= 90
                    ? "bg-rose-500"
                    : usagePct >= 70
                    ? "bg-amber-500"
                    : "bg-emerald-500";

                return (
                  <tr
                    key={q.studentId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {q.studentName || (isTeacher ? "Giáo viên" : "Học viên")}
                        </span>
                        {isTeacher ? (
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                            GIÁO VIÊN
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-blue-100 text-blue-800 dark:bg-slate-900/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                            HỌC VIÊN
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {q.email}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                            isExceeded
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : isTeacher
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-blue-50 text-blue-800 dark:bg-slate-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                          }`}
                        >
                          {isExceeded
                            ? "TIER 3 • FALLBACK"
                            : isTeacher
                            ? "TIER 1 • GROQ LLaMA"
                            : "TIER 2 • GEMINI FLASH"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {q.serviceEngine || (isTeacher ? "Groq Cloud" : "Gemini Multimodal")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 min-w-[200px]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {used} / {limit} {isTeacher ? "đề" : "lượt"}
                          </span>
                          <span
                            className={`text-[11px] font-extrabold ${
                              isExceeded || usagePct >= 90
                                ? "text-rose-600 dark:text-rose-400"
                                : usagePct >= 70
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {usagePct}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                      {(q.totalTokensUsed || 0).toLocaleString()}
                    </td>
                    <td className="p-4 text-center text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      ${q.estimatedCostUsd ? q.estimatedCostUsd.toFixed(4) : "0.0000"}
                    </td>
                    <td className="p-4 text-center">
                      {q.isBlocked || isExceeded ? (
                        <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          ERROR • {q.isBlocked ? "ĐANG CHẶN" : "HẾT QUOTA"}
                        </span>
                      ) : isWarn ? (
                        <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          WARN • CẢNH BÁO
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          INFO • AN TOÀN
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        disabled={isProcessing}
                        onClick={() =>
                          onOpenUpdateQuota({
                            studentId: q.studentId,
                            studentName: q.studentName,
                            email: q.email,
                            currentLimit: q.dailyLimit,
                            isBlocked: q.isBlocked,
                          })
                        }
                        className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-slate-900 dark:hover:text-blue-300 rounded-lg cursor-pointer transition"
                      >
                        Đổi Limit
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() =>
                          onToggleBlock(
                            q.studentId,
                            q.dailyLimit,
                            q.isBlocked,
                          )
                        }
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${
                          q.isBlocked
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}
                      >
                        {q.isBlocked ? (
                          <CheckCircle2 size={13} className="inline mr-1" />
                        ) : (
                          <Ban size={13} className="inline mr-1" />
                        )}
                        {q.isBlocked ? "Mở Khóa" : "Chặn AI"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>trên tổng <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{sortedQuotas.length}</strong> người dùng</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            Trang <strong className="text-slate-800 dark:text-slate-200">{currentPage}</strong> / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              title="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              title="Trang kế tiếp"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentQuotaTable;
