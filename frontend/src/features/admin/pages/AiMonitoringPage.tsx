import { useEffect, useState } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { AiStatsResponse, StudentQuotaItem } from "@/features/admin/types";
import {
  Cpu,
  Loader2,
  AlertOctagon,
  Power,
  RefreshCw,
} from "lucide-react";
import {
  AiTierOverviewCards,
  AiUsageCharts,
  StudentQuotaTable,
  UpdateQuotaModal,
} from "@/features/admin/components/ai-monitoring";

export default function AiMonitoringPage() {
  const [stats, setStats] = useState<AiStatsResponse | null>(null);
  const [quotas, setQuotas] = useState<StudentQuotaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    studentId: string;
    studentName?: string;
    email: string;
    currentLimit: number;
    isBlocked: boolean;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, quotasRes] = await Promise.all([
        adminApi.getAiUsageStats(),
        adminApi.getAiUserQuotas(),
      ]);
      setStats(statsRes);
      setQuotas(quotasRes);
    } catch {
      console.error("Failed to fetch AI monitoring stats");
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
      ? "Mở lại toàn bộ dịch vụ AI?"
      : "CẢNH BÁO: Bật Kill-Switch sẽ ngắt ngay toàn bộ AI (Gemini/Groq) của học viên và giáo viên. Xác nhận bật?";

    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      await adminApi.toggleAiKillSwitch();
      await fetchData();
    } catch {
      alert("Đổi trạng thái Kill-Switch thất bại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleBlock = async (
    studentId: string,
    currentLimit: number,
    currentBlocked: boolean,
  ) => {
    setIsProcessing(true);
    try {
      await adminApi.updateUserAiQuota(
        studentId,
        currentLimit,
        !currentBlocked,
      );
      await fetchData();
    } catch {
      alert("Đổi trạng thái chặn thất bại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveQuota = async (studentId: string, newLimit: number, isBlocked: boolean) => {
    setIsProcessing(true);
    try {
      await adminApi.updateUserAiQuota(studentId, newLimit, isBlocked);
      await fetchData();
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin text-blue-700 dark:text-blue-400 mb-3" size={36} />
        <p className="text-sm font-semibold">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
      {/* 1. Header & Kill-Switch Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Giám sát AI &amp; Chi phí
          </h1>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            Gemini 2.5 Flash
          </span>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Groq LLaMA 3.3
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading || isProcessing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={handleToggleKillSwitch}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black shadow-sm transition cursor-pointer ${
              stats?.systemKillSwitchActive
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-rose-600 hover:bg-rose-500 text-white"
            }`}
          >
            {isProcessing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Power size={16} />
                <span>
                  {stats?.systemKillSwitchActive
                    ? "Mở lại AI"
                    : "Bật Kill-Switch"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Kill-Switch Active Banner */}
      {stats?.systemKillSwitchActive && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-xl p-4 flex items-center gap-4 text-rose-800 dark:text-rose-200">
          <AlertOctagon size={28} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex-1">
            <h4 className="font-black text-sm uppercase tracking-wide">
              AI đang tạm dừng (Kill-Switch bật)
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
              Mọi request Speaking &amp; tạo bài bị chặn (HTTP 429). Bấm &quot;Mở lại AI&quot; để khôi phục.
            </p>
          </div>
        </div>
      )}

      {/* 3. KPI & 3-Tier Architecture Cards */}
      <AiTierOverviewCards stats={stats} />

      {/* 4. Charts */}
      <AiUsageCharts stats={stats} />

      {/* 5. Quota & Anti-Spam Table */}
      <StudentQuotaTable
        quotas={quotas}
        isProcessing={isProcessing}
        onOpenUpdateQuota={(user) => setEditingUser(user)}
        onToggleBlock={handleToggleBlock}
      />

      {/* 6. Update Quota Modal */}
      <UpdateQuotaModal
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        targetUser={editingUser}
        onSave={handleSaveQuota}
        isProcessing={isProcessing}
      />
    </div>
  );
}
