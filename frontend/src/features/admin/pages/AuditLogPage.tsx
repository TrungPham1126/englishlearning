// src/features/admin/pages/AuditLogPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { AuditLogDto } from "@/features/admin/types";
import {
  Activity,
  Users,
  Video,
  FileText,
  School,
  Search,
  Info,
  AlertTriangle,
  AlertOctagon,
  Cpu,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { Card, Badge, Button, Input, EmptyState, SkeletonTable } from "@/components/ui";

type FilterType = "ALL" | "ACCOUNT" | "VIDEO" | "ASSIGNMENT" | "CLASS" | "AI_PIPELINE";
type SeverityLevel = "ALL" | "INFO" | "WARN" | "ERROR";
type SortField = "createdAt" | "severity" | "userName";
type SortDirection = "asc" | "desc";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const fetchLogs = () => {
    setLoading(true);
    adminApi
      .getAuditLogs(0, 300)
      .then((res) => setLogs(res.content || []))
      .catch((err) => console.error("Lỗi tải Audit Logs:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getLogSeverity = (log: AuditLogDto): "INFO" | "WARN" | "ERROR" => {
    const act = (log.action || "").toUpperCase();
    const meta = (log.metadataJson || "").toUpperCase();

    if (
      act.includes("ERROR") ||
      act.includes("FAIL") ||
      act.includes("DELETE") ||
      act.includes("REJECT") ||
      act.includes("LOCK") ||
      act.includes("BLOCK") ||
      meta.includes("ERROR") ||
      meta.includes("429")
    ) {
      return "ERROR";
    }

    if (
      act.includes("WARN") ||
      act.includes("FALLBACK") ||
      act.includes("RETRY") ||
      act.includes("LIMIT") ||
      act.includes("UPDATE") ||
      meta.includes("FALLBACK") ||
      meta.includes("TIER 2") ||
      meta.includes("TIER 3")
    ) {
      return "WARN";
    }

    return "INFO";
  };

  const getAiTierBadge = (log: AuditLogDto) => {
    const act = (log.action || "").toUpperCase();
    const ent = (log.entityName || "").toUpperCase();
    const meta = (log.metadataJson || "").toUpperCase();

    if (meta.includes("TIER 3") || meta.includes("RULE") || act.includes("FALLBACK_LOCAL")) {
      return {
        variant: "destructive" as const,
        label: "Tier 3 • Rule Fallback",
      };
    }

    if (
      meta.includes("TIER 2") ||
      meta.includes("GEMINI") ||
      meta.includes("UPDATESKILLSCORE") ||
      act.includes("SPEAKING") ||
      act.includes("FALLBACK")
    ) {
      return {
        variant: "warning" as const,
        label: "Tier 2 • Gemini 2.5",
      };
    }

    if (
      meta.includes("TIER 1") ||
      meta.includes("GROQ") ||
      meta.includes("LLAMA") ||
      ent.includes("ASSIGNMENT") ||
      ent.includes("QUESTION") ||
      ent.includes("AI")
    ) {
      return {
        variant: "aiTier" as const,
        label: "Tier 1 • Groq Cloud",
      };
    }

    return {
      variant: "neutral" as const,
      label: "Core System",
    };
  };

  const formatAction = (action: string) => {
    const act = (action || "").toUpperCase();
    if (act.includes("CREATE") || act.includes("ADD") || act.includes("START"))
      return { text: "TẠO MỚI", variant: "success" as const };
    if (
      act.includes("UPDATE") ||
      act.includes("EDIT") ||
      act.includes("SUBMIT") ||
      act.includes("APPROVE")
    )
      return { text: "CẬP NHẬT", variant: "info" as const };
    if (
      act.includes("DELETE") ||
      act.includes("REJECT") ||
      act.includes("REMOVE") ||
      act.includes("LOCK")
    )
      return { text: "XÓA / HỦY", variant: "destructive" as const };

    return { text: act, variant: "neutral" as const };
  };

  const formatEntity = (entityName: string) => {
    const ent = (entityName || "").toUpperCase();
    if (
      ent.includes("USER") ||
      ent.includes("STUDENT") ||
      ent.includes("TEACHER")
    )
      return "Tài khoản";
    if (ent.includes("VIDEO")) return "Video Bài giảng";
    if (
      ent.includes("ASSIGNMENT") ||
      ent.includes("QUESTION") ||
      ent.includes("ATTEMPT")
    )
      return "Bài tập / Đề thi";
    if (
      ent.includes("CLASS") ||
      ent.includes("LESSON") ||
      ent.includes("CURRICULUM")
    )
      return "Lớp học / Giáo trình";
    return entityName;
  };

  const renderReadableMetadata = (jsonStr: string) => {
    if (!jsonStr || jsonStr === "{}" || jsonStr === "null") {
      return (
        <span className="text-slate-400 dark:text-slate-500 italic text-xs">
          Không có thông tin chi tiết
        </span>
      );
    }

    try {
      const data = JSON.parse(jsonStr);
      const keyDictionary: Record<string, string> = {
        method: "Thao tác",
        reason: "Lý do",
        status: "Trạng thái",
        role: "Phân quyền",
        email: "Tài khoản",
        fileName: "Tên tệp",
        score: "Điểm số",
        level: "Cấp độ",
        tier: "Tầng AI",
        model: "Mô hình AI",
      };

      const valueDictionary: Record<string, string> = {
        updateSkillScore: "Cập nhật điểm AI",
        login: "Đăng nhập",
        logout: "Đăng xuất",
        ACTIVE: "Hoạt động",
        INACTIVE: "Khóa",
        PENDING: "Chờ duyệt",
        APPROVED: "Đã duyệt",
        REJECTED: "Từ chối",
      };

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
          {Object.entries(data).map(([key, value]) => {
            const displayKey = keyDictionary[key] || key;
            const valStr = String(value);
            const displayValue = valueDictionary[valStr] || valStr;

            return (
              <div key={key} className="flex items-start gap-1 text-[11px]">
                <span className="font-semibold text-slate-500 dark:text-slate-400 capitalize shrink-0">
                  {displayKey}:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200 break-all font-mono">
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      );
    } catch {
      return (
        <span className="text-slate-700 dark:text-slate-300 text-xs font-mono break-all">
          {jsonStr}
        </span>
      );
    }
  };

  // 1. Filter Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const ent = (log.entityName || "").toUpperCase();
      const act = (log.action || "").toUpperCase();
      const meta = (log.metadataJson || "").toUpperCase();
      const user = (log.userName || log.userId || "").toLowerCase();

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchSearch =
          user.includes(q) ||
          ent.toLowerCase().includes(q) ||
          act.toLowerCase().includes(q) ||
          meta.toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      if (severityFilter !== "ALL") {
        if (getLogSeverity(log) !== severityFilter) return false;
      }

      if (activeFilter === "ALL") return true;
      if (activeFilter === "ACCOUNT")
        return (
          ent.includes("USER") ||
          ent.includes("STUDENT") ||
          ent.includes("TEACHER")
        );
      if (activeFilter === "VIDEO") return ent.includes("VIDEO");
      if (activeFilter === "ASSIGNMENT")
        return (
          ent.includes("ASSIGNMENT") ||
          ent.includes("QUESTION") ||
          ent.includes("ATTEMPT")
        );
      if (activeFilter === "CLASS")
        return (
          ent.includes("CLASS") ||
          ent.includes("LESSON") ||
          ent.includes("CURRICULUM")
        );
      if (activeFilter === "AI_PIPELINE")
        return (
          ent.includes("AI") ||
          ent.includes("ASSIGNMENT") ||
          ent.includes("ATTEMPT") ||
          meta.includes("UPDATESKILLSCORE") ||
          meta.includes("TIER")
        );

      return false;
    });
  }, [logs, activeFilter, severityFilter, searchTerm]);

  // 2. Sort Logs
  const sortedLogs = useMemo(() => {
    const list = [...filteredLogs];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === "severity") {
        const order = { ERROR: 3, WARN: 2, INFO: 1 };
        comparison = order[getLogSeverity(a)] - order[getLogSeverity(b)];
      } else if (sortField === "userName") {
        comparison = (a.userName || "").localeCompare(b.userName || "");
      }
      return sortDirection === "desc" ? -comparison : comparison;
    });
    return list;
  }, [filteredLogs, sortField, sortDirection]);

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, validCurrentPage, pageSize]);

  // Summary counts
  const severityCounts = useMemo(() => {
    let info = 0;
    let warn = 0;
    let error = 0;
    logs.forEach((l) => {
      const sev = getLogSeverity(l);
      if (sev === "ERROR") error++;
      else if (sev === "WARN") warn++;
      else info++;
    });
    return { info, warn, error };
  }, [logs]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filterTabs: { id: FilterType; label: string; icon: React.ReactNode }[] = [
    { id: "ALL", label: "Tất cả", icon: <Activity size={14} /> },
    { id: "AI_PIPELINE", label: "AI & Fallback 3 Tầng", icon: <Cpu size={14} /> },
    { id: "ACCOUNT", label: "Tài khoản", icon: <Users size={14} /> },
    { id: "ASSIGNMENT", label: "Bài tập & Thi", icon: <FileText size={14} /> },
    { id: "CLASS", label: "Lớp học", icon: <School size={14} /> },
    { id: "VIDEO", label: "Video bài giảng", icon: <Video size={14} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 dark:bg-slate-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 mb-2">
            <Activity size={13} />
            <span>Kiểm Toán Hệ Thống &amp; Điều Phối AI</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Nhật Ký Kiểm Toán (Audit Logs)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tra cứu thao tác quản trị, giám sát điều phối AI 3 tầng (Tier 1 / Tier 2 / Tier 3) và phân loại cảnh báo.
          </p>
        </div>

        {/* Severity Summary Pills */}
        <div className="flex items-center gap-2">
          <Badge variant="success" size="md" dot>
            INFO: {severityCounts.info}
          </Badge>
          <Badge variant="warning" size="md" dot>
            WARN: {severityCounts.warn}
          </Badge>
          <Badge variant="destructive" size="md" dot>
            ERROR: {severityCounts.error}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            leftIcon={<RefreshCw size={13} className={loading ? "animate-spin" : ""} />}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <Card className="p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex-1 max-w-md">
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm theo người thao tác, hành động, email hoặc chi tiết..."
              startIcon={<Search size={15} />}
            />
          </div>

          {/* Severity Badges */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200/80 dark:border-slate-800">
            {(["ALL", "INFO", "WARN", "ERROR"] as SeverityLevel[]).map((sev) => {
              const isSelected = severityFilter === sev;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => {
                    setSeverityFilter(sev);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition select-none cursor-pointer ${
                    isSelected
                      ? sev === "ERROR"
                        ? "bg-rose-600 text-white shadow-xs"
                        : sev === "WARN"
                        ? "bg-amber-500 text-white shadow-xs"
                        : sev === "INFO"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {sev === "ALL" ? `Tất cả (${logs.length})` : sev}
                </button>
              );
            })}
          </div>
        </div>

        {/* Functional Entity Category Filter */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {filterTabs.map((item) => {
            const isSelected = activeFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveFilter(item.id);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition select-none cursor-pointer border ${
                  isSelected
                    ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-slate-900/60 dark:text-blue-300 dark:border-blue-900"
                    : "bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 3. Main Data Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8">
            <SkeletonTable rows={8} />
          </div>
        ) : sortedLogs.length === 0 ? (
          <EmptyState
            icon={<Activity size={28} />}
            title="Không tìm thấy bản ghi Audit Log nào"
            description="Không có dữ liệu phù hợp với bộ lọc hiện tại. Hãy thử thay đổi từ khóa hoặc thiết lập lại bộ lọc."
          />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[860px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th
                      className="py-3 px-4 w-40 cursor-pointer select-none hover:text-blue-700 transition"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Thời Gian</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 w-28 text-center cursor-pointer select-none hover:text-blue-700 transition"
                      onClick={() => handleSort("severity")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Mức Độ</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="py-3 px-4 w-44 text-center">Tầng AI / Xử Lý</th>
                    <th
                      className="py-3 px-4 w-44 cursor-pointer select-none hover:text-blue-700 transition"
                      onClick={() => handleSort("userName")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Người Thao Tác</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="py-3 px-4 w-36">Hành Động</th>
                    <th className="py-3 px-4">Chi Tiết Kỹ Thuật (Metadata)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {paginatedLogs.map((log) => {
                    const severity = getLogSeverity(log);
                    const tierBadge = getAiTierBadge(log);
                    const actionBadge = formatAction(log.action);
                    const entityName = formatEntity(log.entityName);

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition align-top"
                      >
                        {/* Time */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="text-slate-900 dark:text-slate-100 font-bold flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-400" />
                            <span className="font-mono tabular-nums">
                              {new Date(log.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] mt-0.5 pl-4 tabular-nums">
                            {new Date(log.createdAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>
                        </td>

                        {/* Severity */}
                        <td className="p-4 text-center whitespace-nowrap">
                          {severity === "ERROR" ? (
                            <Badge variant="destructive" size="sm" dot>
                              ERROR
                            </Badge>
                          ) : severity === "WARN" ? (
                            <Badge variant="warning" size="sm" dot>
                              WARN
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm" dot>
                              INFO
                            </Badge>
                          )}
                        </td>

                        {/* AI Tier */}
                        <td className="p-4 text-center whitespace-nowrap">
                          <Badge variant={tierBadge.variant} size="sm">
                            <Cpu size={11} className="mr-1" />
                            {tierBadge.label}
                          </Badge>
                        </td>

                        {/* Operator */}
                        <td className="p-4">
                          <div
                            className="font-bold text-xs text-blue-800 dark:text-blue-400 truncate max-w-[160px]"
                            title={log.userName || log.userId}
                          >
                            {log.userName || "Hệ thống tự động"}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[160px] font-mono">
                            ID: {log.userId ? String(log.userId).slice(0, 8) : "system"}
                          </div>
                        </td>

                        {/* Action & Entity */}
                        <td className="p-4 whitespace-nowrap">
                          <Badge variant={actionBadge.variant} size="sm">
                            {actionBadge.text}
                          </Badge>
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                            {entityName}
                          </div>
                        </td>

                        {/* Metadata */}
                        <td className="p-4">
                          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800">
                            {renderReadableMetadata(log.metadataJson)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>trong tổng số <strong className="text-slate-800 dark:text-slate-200 font-mono">{sortedLogs.length}</strong> bản ghi</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={validCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  leftIcon={<ChevronLeft size={14} />}
                >
                  Trước
                </Button>

                <div className="px-3 text-xs font-bold text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                  Trang {validCurrentPage} / {totalPages}
                </div>

                <Button
                  variant="outline"
                  size="xs"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  rightIcon={<ChevronRight size={14} />}
                >
                  Sau
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
