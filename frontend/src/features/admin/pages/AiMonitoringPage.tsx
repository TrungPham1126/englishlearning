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
        <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400 mb-3" size={36} />
        <p className="text-sm font-semibold">Đang tổng hợp dữ liệu giám sát AI...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
      {/* 1. TOP HEADER & KILL-SWITCH CONTROL */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <Cpu size={32} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Giám Sát Chi Phí & Hiệu Suất AI
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                Gemini 2.5 Flash
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                Groq LLaMA 3.3
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Hệ thống giám sát đa động cơ: Google Gemini (chấm bài nói Speaking) & Groq LLaMA (giáo viên tạo đề thi).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchData}
            disabled={loading || isProcessing}
            className="p-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition cursor-pointer"
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
                : "bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700"
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
      </div>

      {/* 2. KILL-SWITCH ACTIVE WARNING BANNER */}
      {stats?.systemKillSwitchActive && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-4 flex items-center gap-4 text-rose-800 dark:text-rose-200">
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

      {/* 3. FOUR MODERN STRIPE-STYLE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Chi Phí Tháng */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ước Tính Chi Phí (Tháng)
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-3">
            ${stats?.monthlyCostUsd?.toFixed(3) ?? stats?.estimatedCostUsd?.toFixed(3) ?? "0.000"}
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Model: Gemini 2.5 Flash</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">$0.075 / 1M token</span>
          </div>
        </div>

        {/* Card 2: Tổng Token Tiêu Thụ */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tổng Token Tiêu Thụ
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Activity size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-3">
            {(stats?.totalTokens || 0).toLocaleString()}
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>In: {(stats?.promptTokens || 0).toLocaleString()}</span>
            <span>Out: {(stats?.completionTokens || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Card 3: Hạn Mức Toàn Hệ Thống Còn Lại */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
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
          {/* Progress Bar */}
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
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{isQuotaDanger ? "Mức nguy hiểm" : isQuotaWarning ? "Mức cảnh báo" : "Hạn mức an toàn"}</span>
            <span className="font-bold">Ngày hôm nay</span>
          </div>
        </div>

        {/* Card 4: Người Dùng & Bị Chặn */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Học Viên AI & Chặn Spam
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {stats?.activeUsers || 0}
            </span>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">active</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Bị chặn spam (429):</span>
            <span className={`font-bold px-2 py-0.5 rounded-full ${
              (stats?.blockedUsers || 0) > 0
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}>
              {stats?.blockedUsers || 0} user
            </span>
          </div>
        </div>
      </div>

      {/* 3.5 KIẾN TRÚC PHỐI HỢP ĐA TRÍ TUỆ NHÂN TẠO (HYBRID DUAL-AI COOPERATIVE ARCHITECTURE) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        {/* Header Kiến Trúc Phối Hợp */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Workflow size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Kiến Trúc Phối Hợp Đa Trí Tuệ Nhân Tạo (Dual-AI Cooperative Pipeline)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  Router Phân Luồng Tự Động
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  Auto-Failover 0% Downtime
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Mô hình hợp tác 2 tầng: <strong>Groq LLaMA 3.3</strong> đảm nhận tạo đề &amp; xử lý văn bản tốc độ cao (&lt;1.2s); <strong>Gemini 2.5 Flash</strong> đảm nhận phân tích âm thanh đa phương thức &amp; làm chốt chặn dự phòng tự động khi có sự cố.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Cả 2 Động Cơ Sẵn Sàng Phối Hợp
          </div>
        </div>

        {/* Sơ đồ trực quan hóa Luồng phối hợp (Visual Pipeline Flow) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
          {/* Luồng 1: Giáo viên soạn đề */}
          <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-sm shrink-0">
              <Zap size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Luồng 1: Soạn Đề &amp; Bài Tập
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  Giáo viên
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-700 dark:text-slate-300 font-semibold truncate">
                <span>Soạn Quiz / Passage</span>
                <ArrowRight size={12} className="text-slate-400 shrink-0" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Groq LLaMA (Chính)</span>
                <ArrowRight size={12} className="text-slate-400 shrink-0" />
                <span className="text-indigo-600 dark:text-indigo-400 text-[11px] font-normal truncate">Gemini (Dự phòng)</span>
              </div>
            </div>
          </div>

          {/* Luồng 2: Học sinh luyện nói */}
          <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200/70 dark:border-indigo-900/40 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-sm shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                  Luồng 2: Chấm Điểm Phát Âm
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                  Học viên
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-700 dark:text-slate-300 font-semibold truncate">
                <span>Audio Stream / Mic</span>
                <ArrowRight size={12} className="text-slate-400 shrink-0" />
                <span className="text-indigo-600 dark:text-indigo-400 font-bold truncate">Gemini 2.5 Flash Multimodal</span>
                <ArrowRight size={12} className="text-slate-400 shrink-0" />
                <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-normal">IELTS Band</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hai thẻ Động cơ AI Chuyên Biệt */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Động cơ 1: Groq LLaMA 3.3 70B (Primary Fast Engine) */}
          <div className="bg-gradient-to-br from-emerald-500/5 via-white to-emerald-500/10 dark:from-emerald-950/30 dark:via-slate-900 dark:to-emerald-950/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-emerald-100 dark:border-emerald-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        Groq LLaMA 3.3 70B
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        Động cơ chính (Primary)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      <strong>Nhiệm vụ:</strong> Soạn đề thi trắc nghiệm, tạo bài tập ngữ pháp, bài đọc hiểu &amp; phân tích câu văn bản.
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  &lt;1.2s Tốc độ cao
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
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400/90 font-medium bg-emerald-50/60 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                ⚡ Phối hợp: Tự động chuyển tải sang Gemini nếu chạm hạn mức Rate Limit 429
              </div>
            </div>
          </div>

          {/* Động cơ 2: Google Gemini 2.5 Flash (Multimodal & Auto-Failover) */}
          <div className="bg-gradient-to-br from-indigo-500/5 via-white to-indigo-500/10 dark:from-indigo-950/30 dark:via-slate-900 dark:to-indigo-950/20 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-indigo-100 dark:border-indigo-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        Google Gemini 2.5 Flash
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                        Đa phương thức &amp; Dự phòng
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      <strong>Nhiệm vụ:</strong> Chấm điểm phát âm IELTS, Shadowing, phân tích sóng âm &amp; Chốt chặn dự phòng tạo đề.
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  Sẵn sàng Failover
                </span>
              </div>

              {/* Số liệu thống kê Gemini */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="bg-white/90 dark:bg-slate-800/70 p-3 rounded-xl border border-indigo-100 dark:border-indigo-950/50">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Số Lượt Chấm Nói
                  </span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {(stats?.geminiStats?.totalRequests || 0).toLocaleString()} <span className="text-xs font-semibold text-slate-500">lượt</span>
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-slate-800/70 p-3 rounded-xl border border-indigo-100 dark:border-indigo-950/50">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Token Tiêu Thụ
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                    {(stats?.geminiStats?.totalTokens || 0).toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-slate-800/70 p-3 rounded-xl border border-indigo-100 dark:border-indigo-950/50">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Chi Phí ($)
                  </span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
                    ${stats?.geminiStats?.costUsd?.toFixed(4) || "0.0000"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-950/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>In: {(stats?.geminiStats?.promptTokens || 0).toLocaleString()} | Out: {(stats?.geminiStats?.completionTokens || 0).toLocaleString()} tokens</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{stats?.geminiStats?.pricingModel || "$0.075 / $0.30 per 1M"}</span>
              </div>
              <div className="text-[10px] text-indigo-700 dark:text-indigo-400/90 font-medium bg-indigo-50/60 dark:bg-indigo-950/30 px-2 py-0.5 rounded">
                🛡️ Phối hợp: Hot Standby - Tiếp nhận 100% request khi Groq lỗi hoặc rate limit (0% Downtime)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CHARTS SECTION (Recharts AreaChart + Donut Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ diện tích: Xu hướng tiêu thụ Token 7 ngày gần nhất */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" />
                Lưu Lượng Token Tiêu Thụ (7 Ngày Gần Nhất)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Theo dõi biến thiên Token đầu vào (Prompt) và Token sinh ra (Completion)
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg">
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
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <PieIcon size={18} className="text-emerald-600 dark:text-emerald-400" />
              Tỷ Lệ Phân Bổ Chi Phí AI
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Phân tách giữa Chấm Speaking học viên và Soạn đề giáo viên
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
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
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
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert size={20} className="text-indigo-600 dark:text-indigo-400" />
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
                onClick={() => setRoleFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  roleFilter === "ALL"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tất cả ({quotas.length})
              </button>
              <button
                onClick={() => setRoleFilter("TEACHER")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  roleFilter === "TEACHER"
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Giáo viên ({quotas.filter((q) => (q.role || "").toUpperCase() === "TEACHER").length})
              </button>
              <button
                onClick={() => setRoleFilter("STUDENT")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  roleFilter === "STUDENT"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="p-4">Người Dùng &amp; Vai Trò</th>
                <th className="p-4 text-center">Động Cơ AI</th>
                <th className="p-4 text-center">Đã Dùng Hôm Nay</th>
                <th className="p-4 text-center">Giới Hạn / Ngày</th>
                <th className="p-4 text-center">Tổng Token</th>
                <th className="p-4 text-center">Chi Phí ($)</th>
                <th className="p-4 text-center">Trạng Thái</th>
                <th className="p-4 text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredQuotas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    Không tìm thấy người dùng nào khớp với bộ lọc và tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredQuotas.map((q) => {
                  const isTeacher = (q.role || "").toUpperCase() === "TEACHER";
                  const isExceeded = q.dailyUsed >= q.dailyLimit;
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
                            <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                              HỌC VIÊN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {q.email}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${
                          isTeacher
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                        }`}>
                          {q.serviceEngine || (isTeacher ? "GROQ LLaMA 3.3" : "GEMINI 2.5 FLASH")}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`font-black px-2.5 py-1 rounded-lg text-xs ${
                            isExceeded
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                              : isTeacher
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {q.dailyUsed} {isTeacher ? "lần tạo đề" : "lần chấm"}
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-400">
                        {q.dailyLimit} lần
                      </td>
                      <td className="p-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {(q.totalTokensUsed || 0).toLocaleString()}
                      </td>
                      <td className="p-4 text-center text-xs font-black text-rose-600 dark:text-rose-400">
                        ${q.estimatedCostUsd ? q.estimatedCostUsd.toFixed(4) : "0.0000"}
                      </td>
                      <td className="p-4 text-center">
                        {q.isBlocked ? (
                          <span className="px-2.5 py-1 text-[11px] font-black rounded-lg uppercase bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            ĐANG BỊ CHẶN
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-black rounded-lg uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            HOẠT ĐỘNG
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          disabled={isProcessing}
                          onClick={() =>
                            handleUpdateQuota(
                              q.studentId,
                              q.dailyLimit,
                              q.isBlocked,
                            )
                          }
                          className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 rounded-lg cursor-pointer transition"
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
