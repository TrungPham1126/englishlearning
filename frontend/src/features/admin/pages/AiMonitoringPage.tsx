// src/features/admin/pages/AiMonitoringPage.tsx
import { useEffect, useState, useMemo } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { AiStatsResponse, StudentQuotaItem } from "@/features/admin/types";
import {
  Cpu,
  DollarSign,
  Activity,
  ShieldAlert,
  Loader2,
  Ban,
  CheckCircle2,
  AlertOctagon,
  Search,
  Sparkles,
  RefreshCw,
  Power,
  TrendingUp,
  PieChart as PieIcon,
  Users,
  ArrowRight,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Workflow,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function AiMonitoringPage() {
  const [stats, setStats] = useState<AiStatsResponse | null>(null);
  const [quotas, setQuotas] = useState<StudentQuotaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, quotasRes] = await Promise.all([
        adminApi.getAiUsageStats(),
        adminApi.getAiUserQuotas(),
      ]);
      setStats(statsRes);
      setQuotas(quotasRes);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu AI Monitoring:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleKillSwitch = async () => {
    const isCurrentlyActive = stats?.systemKillSwitchActive;
    const confirmMsg = isCurrentlyActive
      ? "Bạn có chắc chắn muốn TẮT Kill-Switch và KHÔI PHỤC hoạt động bình thường của toàn bộ tính năng AI?"
      : "CẢNH BÁO NGUY CẤP: Kích hoạt Kill-Switch sẽ NGAY LẬP TỨC TẠM DỪNG toàn bộ chức năng gọi AI (chấm phát âm, tạo đề) trên toàn hệ thống!\n\nBạn có chắc chắn muốn kích hoạt?";

    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      const newStatus = await adminApi.toggleAiKillSwitch();
      setStats((prev) =>
        prev ? { ...prev, systemKillSwitchActive: newStatus } : null,
      );
      alert(
        newStatus
          ? "ĐÃ KÍCH HOẠT KILL-SWITCH: Toàn bộ AI đã được tạm dừng."
          : "ĐÃ HỦY KILL-SWITCH: Hệ thống AI đã trở lại hoạt động bình thường.",
      );
    } catch (err) {
      alert("Lỗi khi thay đổi trạng thái Kill-Switch.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateQuota = async (
    studentId: string,
    currentLimit: number,
    currentBlocked: boolean,
  ) => {
    const newLimit = window.prompt(
      "Nhập giới hạn số lượt gọi AI / ngày cho người dùng này:",
      currentLimit.toString(),
    );
    if (newLimit === null || isNaN(Number(newLimit))) return;

    setIsProcessing(true);
    try {
      await adminApi.updateUserAiQuota(
        studentId,
        Number(newLimit),
        currentBlocked,
      );
      await fetchData();
    } catch (err) {
      alert("Lỗi khi cập nhật giới hạn quota.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleBlock = async (
    studentId: string,
    currentLimit: number,
    currentBlocked: boolean,
  ) => {
    if (
      !window.confirm(
        `Bạn muốn ${currentBlocked ? "MỞ KHÓA" : "CHẶN"} quyền sử dụng AI của người dùng này?`,
      )
    )
      return;

    setIsProcessing(true);
    try {
      await adminApi.updateUserAiQuota(
        studentId,
        currentLimit,
        !currentBlocked,
      );
      await fetchData();
    } catch (err) {
      alert("Lỗi khi thay đổi trạng thái chặn.");
    } finally {
      setIsProcessing(false);
    }
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
        const statusRank = (item: StudentQuotaItem) => (item.isBlocked ? 2 : (item.dailyUsed >= item.dailyLimit ? 1 : 0));
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

  // Quota remaining logic & styling
  const remainingPercent = stats?.systemQuotaRemainingPercent ?? 100;
  const isQuotaDanger = remainingPercent <= 10;
  const isQuotaWarning = remainingPercent <= 25 && !isQuotaDanger;

  // Donut chart data - 100% dữ liệu thật từ API
  const pieData = useMemo(() => {
    const studentCost = Number(stats?.costBreakdown?.studentSpeakingCost?.toFixed(3)) || 0;
    const teacherCost = Number(stats?.costBreakdown?.teacherCreationCost?.toFixed(3)) || 0;

    if (studentCost === 0 && teacherCost === 0) {
      return [
        {
          name: "Chưa phát sinh chi phí",
          value: 1,
          color: "#94a3b8",
        },
      ];
    }

    return [
      {
        name: "Học viên (Speaking Shadowing)",
        value: studentCost,
        color: "#6366f1",
      },
      {
        name: "Giáo viên (Soạn đề thi/bài tập)",
        value: teacherCost,
        color: "#10b981",
      },
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin text-blue-700 dark:text-blue-400 mb-3" size={36} />
        <p className="text-sm font-semibold">Đang tổng hợp dữ liệu giám sát AI...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
      {/* 1. CLEAN OPEN HEADER & KILL-SWITCH CONTROL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-slate-900/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50 mb-2">
            <Cpu size={14} />
            <span>Giám Sát Hệ Thống AI</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Giám Sát Chi Phí & Hiệu Suất AI
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
              Gemini 2.5 Flash
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              Groq LLaMA 3.3
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Giám sát hạn mức, lưu lượng token và chi phí vận hành các mô hình AI tích hợp trong hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchData}
            disabled={loading || isProcessing}
            className="p-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition shadow-sm cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Global Kill Switch Button */}
          <button
            onClick={handleToggleKillSwitch}
            disabled={isProcessing}
            className={`flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer ${
              stats?.systemKillSwitchActive
                ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-rose-600/30"
                : "bg-white dark:bg-[#111827] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-800"
            }`}
          >
            {stats?.systemKillSwitchActive ? (
              <>
                <AlertOctagon size={16} /> KILL-SWITCH ĐANG BẬT (AI TẠM DỪNG)
              </>
            ) : (
              <>
                <Power size={16} /> Kích Hoạt Kill-Switch Khẩn Cấp
              </>
            )}
          </button>
        </div>

        {/* DATA TABLE PAGINATION CONTROLS */}
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

      {/* 2. KILL-SWITCH ACTIVE WARNING BANNER */}
      {stats?.systemKillSwitchActive && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-xl p-4 flex items-center gap-4 text-rose-800 dark:text-rose-200">
          <AlertOctagon size={28} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex-1">
            <h4 className="font-black text-sm uppercase tracking-wide">
              Cảnh báo: Toàn bộ dịch vụ AI đang bị tạm dừng khẩn cấp!
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
              Tất cả yêu cầu chấm bài nói (Speaking), tạo bài tập tự động từ giáo viên và học viên đều bị chặn với mã HTTP 429. Bấm nút Kill-Switch phía trên để khôi phục hoạt động.
            </p>
          </div>
        </div>
      )}

      {/* 3. FOUR MODERN STRIPE-STYLE KPI QUOTA CARDS WITH THRESHOLD PROGRESS BARS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Chi Phí Tháng & Hạn Ngạch Ngân Sách */}
        {(() => {
          const monthlyCost = stats?.monthlyCostUsd ?? stats?.estimatedCostUsd ?? 0;
          const budgetLimitUsd = 50;
          const costPct = Math.min(100, Math.round((monthlyCost / budgetLimitUsd) * 100));
          const costColor =
            costPct >= 85
              ? "bg-rose-500 text-rose-600 dark:text-rose-400"
              : costPct >= 60
                ? "bg-amber-500 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500 text-emerald-600 dark:text-emerald-400";
          return (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Hạn Ngạch Chi Phí (Tháng)
                </span>
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <DollarSign size={20} />
                </div>
              </div>
              <div className="flex items-baseline justify-between mt-3">
                <div className="text-3xl font-black text-slate-900 dark:text-white">
                  ${monthlyCost.toFixed(3)}
                </div>
                <span className="text-xs font-bold text-slate-400">/ ${budgetLimitUsd}.00</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${costColor.split(" ")[0]}`}
                  style={{ width: `${Math.max(4, costPct)}%` }}
                />
              </div>
              <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Ngưỡng ngân sách: {costPct}%</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {costPct >= 85 ? "Sắp chạm trần" : costPct >= 60 ? "Cảnh báo" : "An toàn"}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Card 2: Tổng Token Tiêu Thụ & Quota Token */}
        {(() => {
          const totalTok = stats?.totalTokens || 0;
          const tokenCap = 5_000_000;
          const tokPct = Math.min(100, Math.round((totalTok / tokenCap) * 100));
          const tokBarColor =
            tokPct >= 85 ? "bg-rose-500" : tokPct >= 65 ? "bg-amber-500" : "bg-emerald-500";
          return (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Quota Token Tiêu Thụ
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-slate-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                  <Activity size={20} />
                </div>
              </div>
              <div className="text-3xl font-black text-blue-700 dark:text-blue-400 mt-3">
                {totalTok.toLocaleString()}
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${tokBarColor}`}
                  style={{ width: `${Math.max(5, tokPct)}%` }}
                />
              </div>
              <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>In: {(stats?.promptTokens || 0).toLocaleString()}</span>
                <span>Out: {(stats?.completionTokens || 0).toLocaleString()}</span>
              </div>
            </div>
          );
        })()}

        {/* Card 3: Hạn Mức Toàn Hệ Thống Còn Lại */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Hạn Mức Hệ Thống Còn Lại
            </span>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isQuotaDanger
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                  : isQuotaWarning
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
              }`}
            >
              <TrendingUp size={20} />
            </div>
          </div>
          <div
            className={`text-3xl font-black mt-3 ${
              isQuotaDanger
                ? "text-rose-600 dark:text-rose-400"
                : isQuotaWarning
                ? "text-amber-500 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {remainingPercent.toFixed(1)}%
          </div>
          {/* Threshold Progress Bar (Emerald -> Amber -> Rose) */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isQuotaDanger
                  ? "bg-rose-600"
                  : isQuotaWarning
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, remainingPercent))}%` }}
            />
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span
              className={`font-bold ${
                isQuotaDanger
                  ? "text-rose-600 dark:text-rose-400"
                  : isQuotaWarning
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isQuotaDanger ? "🔴 Sắp hết Quota" : isQuotaWarning ? "🟡 Cảnh báo ngưỡng" : "🟢 Hạn mức an toàn"}
            </span>
            <span className="font-bold">Hôm nay</span>
          </div>
        </div>

        {/* Card 4: Người Dùng & Bị Chặn Rate Limit */}
        {(() => {
          const activeU = stats?.activeUsers || 0;
          const blockedU = stats?.blockedUsers || 0;
          const blockRatio = activeU > 0 ? Math.min(100, Math.round((blockedU / activeU) * 100)) : 0;
          const blockBarColor =
            blockedU > 3 ? "bg-rose-500" : blockedU > 0 ? "bg-amber-500" : "bg-emerald-500";
          return (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Học Viên AI & Chặn Spam
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-slate-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                  <Users size={20} />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {activeU}
                </span>
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">active</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${blockBarColor}`}
                  style={{ width: `${blockedU === 0 ? 100 : Math.max(15, blockRatio)}%` }}
                />
              </div>
              <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Chặn spam (HTTP 429):</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full ${
                    blockedU > 0
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                  }`}
                >
                  {blockedU} bị khóa
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3.5 KIẾN TRÚC FALLBACK AI 3 TẦNG (3-TIER AI FALLBACK ARCHITECTURE & STATUS) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        {/* Header Kiến Trúc Phối Hợp */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-slate-900/60 text-blue-700 dark:text-blue-400 rounded-xl">
              <Workflow size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Kiến Trúc Điều Phối &amp; Lịch Sử Fallback AI 3 Tầng (3-Tier AI Pipeline)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50">
                  Tier 1: Groq Cloud
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                  Tier 2: Gemini 2.5 Flash
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                  Tier 3: Local Rule / Edge
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hệ thống tự động chuyển tầng dự phòng (Auto-Failover) giữa <strong>Tier 1 (Groq LLaMA 3.3)</strong> &rarr; <strong>Tier 2 (Gemini 2.5 Flash)</strong> &rarr; <strong>Tier 3 (Rule-based / Local)</strong> khi phát sinh lỗi mạng hoặc chạm ngưỡng Rate Limit 429.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            3-Tier Failover Active
          </div>
        </div>

        {/* Sơ đồ trực quan hóa Luồng Fallback 3 tầng (Visual 3-Tier Pipeline Flow) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
          {/* Tier 1 */}
          <div className="flex items-start gap-3 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-xs shrink-0">
              T1
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Tier 1 • Primary Cloud
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  INFO • 99.4%
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                Groq LLaMA 3.3 70B &amp; Whisper
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Xử lý chính cho sinh bài tập &amp; nhận diện giọng nói tốc độ cao (&lt;800ms).
              </p>
            </div>
          </div>

          {/* Tier 2 */}
          <div className="flex items-start gap-3 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-200/80 dark:border-blue-900/50 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-slate-900 text-blue-800 dark:text-blue-300 flex items-center justify-center font-black text-xs shrink-0">
              T2
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-blue-800 dark:text-blue-400 uppercase tracking-wider">
                  Tier 2 • Multimodal / Failover
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                  WARN • Standby
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                Google Gemini 2.5 Flash
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Chấm phát âm Multimodal &amp; tự động tiếp quản khi Tier 1 quá tải (HTTP 429).
              </p>
            </div>
          </div>

          {/* Tier 3 */}
          <div className="flex items-start gap-3 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/80 dark:border-amber-900/50 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black text-xs shrink-0">
              T3
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Tier 3 • Deterministic Fallback
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
                  Safe-Mode
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                Local Phonetic / Rule Engine
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Đảm bảo phiên học 0% gián đoạn ngay cả khi đứt kết nối Cloud AI.
              </p>
            </div>
          </div>
        </div>

        {/* Hai thẻ Động cơ AI Chuyên Biệt */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Dịch vụ 1: Mô hình Soạn Đề & Xử Lý Văn Bản */}
          <div className="bg-white dark:bg-surface-card p-5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 shadow-card relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-emerald-100 dark:border-emerald-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        Mô hình Soạn Đề &amp; Xử Lý Văn Bản
                      </h3>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        LLaMA 3.3 70B
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Phạm vi: Sinh đề thi trắc nghiệm, bài tập ngữ pháp, bài đọc hiểu.
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Đang hoạt động
                </span>
              </div>

              {/* Số liệu thống kê Groq */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="bg-white/90 dark:bg-slate-800/70 p-3 rounded-xl border border-emerald-100 dark:border-emerald-950/50">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Lượt Tạo Đề
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {(stats?.groqStats?.totalRequests || 0).toLocaleString()} <span className="text-xs font-semibold text-slate-500">đề thi</span>
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-slate-800/70 p-3 rounded-xl border border-emerald-100 dark:border-emerald-950/50">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Token Tiêu Thụ
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                    {(stats?.groqStats?.totalTokens || 0).toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-slate-800/70 p-3 rounded-xl border border-emerald-100 dark:border-emerald-950/50">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Chi Phí ($)
                  </span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
                    ${stats?.groqStats?.costUsd?.toFixed(4) || "0.0000"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-100 dark:border-emerald-950/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>In: {(stats?.groqStats?.promptTokens || 0).toLocaleString()} | Out: {(stats?.groqStats?.completionTokens || 0).toLocaleString()} tokens</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats?.groqStats?.pricingModel || "$0.59 / $0.79 per 1M"}</span>
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium bg-slate-100/80 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg">
                Cơ chế dự phòng: Tự động chuyển hướng sang Gemini khi vượt hạn mức (Rate Limit).
              </div>
            </div>
          </div>

          {/* Dịch vụ 2: Mô hình Chấm Phát Âm & Đa Phương Thức */}
          <div className="bg-white dark:bg-surface-card p-5 rounded-xl border border-blue-200/80 dark:border-blue-900/40 shadow-card relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-blue-100 dark:border-blue-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-800 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        Mô hình Chấm Phát Âm &amp; Đa Phương Thức
                      </h3>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        Gemini 2.5 Flash
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Phạm vi: Đánh giá âm học Speaking, phân tích phát âm và dự phòng tạo đề.
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-blue-300 bg-blue-100/80 dark:bg-slate-900/50 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-900 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  Sẵn sàng dự phòng
                </span>
              </div>

              {/* Số liệu thống kê Gemini */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="bg-white/90 dark:bg-slate-800/70 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Số Lượt Chấm Nói
                  </span>
                  <span className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1 block">
                    {(stats?.geminiStats?.totalRequests || 0).toLocaleString()} <span className="text-xs font-semibold text-slate-500">lượt</span>
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-slate-800/70 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Token Tiêu Thụ
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                    {(stats?.geminiStats?.totalTokens || 0).toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-slate-800/70 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Chi Phí ($)
                  </span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
                    ${stats?.geminiStats?.costUsd?.toFixed(4) || "0.0000"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-100 dark:border-blue-900/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>In: {(stats?.geminiStats?.promptTokens || 0).toLocaleString()} | Out: {(stats?.geminiStats?.completionTokens || 0).toLocaleString()} tokens</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">{stats?.geminiStats?.pricingModel || "$0.075 / $0.30 per 1M"}</span>
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium bg-slate-100/80 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg">
                Cơ chế dự phòng: Kích hoạt tự động khi dịch vụ chính gặp sự cố.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CHARTS SECTION (Recharts AreaChart + Donut Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ diện tích: Xu hướng tiêu thụ Token 7 ngày gần nhất */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-700 dark:text-blue-400" />
                Thống Kê Token Tiêu Thụ (7 Ngày)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Dữ liệu phân tách giữa Token gửi đi (Input) và Token nhận về (Output)
              </p>
            </div>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-900/50 px-2.5 py-1 rounded-lg">
              Token Analytics
            </span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats?.dailyUsage || []}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="promptColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="compColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#f8fafc" }}
                  formatter={(val: any, name: any) => [
                    Number(val).toLocaleString() + " tokens",
                    name === "promptTokens" ? "Prompt Tokens" : name === "completionTokens" ? "Completion Tokens" : name,
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {value === "promptTokens" ? "Prompt (Input)" : "Completion (Output)"}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="promptTokens"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#promptColor)"
                />
                <Area
                  type="monotone"
                  dataKey="completionTokens"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#compColor)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ tròn: Phân bổ chi phí AI giữa Học viên vs Giáo viên */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <PieIcon size={18} className="text-emerald-600 dark:text-emerald-400" />
              Tỷ Lệ Phân Bổ Chi Phí AI
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Phân bổ ngân sách giữa tính năng Luyện Nói (Speaking) và Soạn Đề Thi
            </p>
          </div>

          <div className="h-56 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => [`$${Number(val).toFixed(3)}`, "Chi phí"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Breakdown labels */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">Học viên (Speaking)</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                ${stats?.costBreakdown?.studentSpeakingCost?.toFixed(3) || "0.000"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">Giáo viên (Tạo đề)</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                ${stats?.costBreakdown?.teacherCreationCost?.toFixed(3) || "0.000"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. ANTI-SPAM & RATE LIMIT QUOTA TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert size={20} className="text-blue-700 dark:text-blue-400" />
              Kiểm Soát Hạn Mức & Chống Lạm Dụng AI (Anti-Spam)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tối đa 5 lần/phút với giáo viên, 3 lần/phút với học viên. Theo dõi chi tiết từng lượt tạo đề (Groq) &amp; chấm nói (Gemini).
            </p>
          </div>

          {/* Filter tabs & Search box */}
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
                            handleUpdateQuota(
                              q.studentId,
                              q.dailyLimit,
                              q.isBlocked,
                            )
                          }
                          className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-slate-900 dark:hover:text-blue-300 rounded-lg cursor-pointer transition"
                        >
                          Đổi Limit
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() =>
                            handleToggleBlock(
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
      </div>
    </div>
  );
}
