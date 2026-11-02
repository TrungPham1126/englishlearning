import React from "react";
import {
  DollarSign,
  Activity,
  Users,
  ShieldCheck,
  Workflow,
  Cpu,
  Bot,
} from "lucide-react";
import type { AiStatsResponse } from "@/features/admin/types";

interface AiTierOverviewCardsProps {
  stats: AiStatsResponse | null;
}

export const AiTierOverviewCards: React.FC<AiTierOverviewCardsProps> = ({ stats }) => {
  const remainingPercent = stats?.systemQuotaRemainingPercent ?? 100;
  const isQuotaDanger = remainingPercent <= 10;
  const isQuotaWarning = remainingPercent <= 25 && !isQuotaDanger;

  return (
    <div className="space-y-6">
      {/* 4 STRIPE-STYLE KPI QUOTA CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Monthly Cost */}
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
                  style={{ width: `${costPct}%` }}
                />
              </div>
              <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Đã dùng: <strong className="text-slate-700 dark:text-slate-300">{costPct}%</strong> ngân sách</span>
                <span className="font-bold">Reset: 1/tháng</span>
              </div>
            </div>
          );
        })()}

        {/* Card 2: Token Quota Used */}
        {(() => {
          const totalTok = stats?.totalTokens || 0;
          const maxExpectedTok = 1000000;
          const tokPct = Math.min(100, Math.round((totalTok / maxExpectedTok) * 100));
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
                <span>Hôm nay: <strong className="text-slate-700 dark:text-slate-300">{(stats?.dailyUsage?.[stats.dailyUsage.length - 1]?.totalTokens || 0).toLocaleString()}</strong></span>
                <span className="font-bold">Tokens</span>
              </div>
            </div>
          );
        })()}

        {/* Card 3: System Quota Remaining */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dung Lượng Quota Hệ Thống
            </span>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isQuotaDanger
                  ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                  : isQuotaWarning
                  ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <ShieldCheck size={20} />
            </div>
          </div>
          <div
            className={`text-3xl font-black mt-3 ${
              isQuotaDanger
                ? "text-rose-600 dark:text-rose-400"
                : isQuotaWarning
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {remainingPercent}%
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isQuotaDanger
                  ? "bg-rose-500"
                  : isQuotaWarning
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${remainingPercent}%` }}
            />
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span
              className={`font-semibold ${
                isQuotaDanger
                  ? "text-rose-600 dark:text-rose-400 font-bold"
                  : isQuotaWarning
                  ? "text-amber-600 dark:text-amber-400 font-bold"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isQuotaDanger ? "⚠️ Sắp hết Quota" : isQuotaWarning ? "⚡ Cảnh báo ngưỡng" : "✓ Hạn mức an toàn"}
            </span>
            <span className="font-bold">Hôm nay</span>
          </div>
        </div>

        {/* Card 4: Active & Blocked Users */}
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
                  Học Viên AI &amp; Chặn Spam
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

      {/* 3-TIER AI FALLBACK ARCHITECTURE & STATUS */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
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
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50">
                  Tier 1: Groq Cloud
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                  Tier 2: Gemini 2.5 Flash
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
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

        {/* 3-Tier Pipeline Flow Cards */}
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
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
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
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
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
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
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

        {/* 2 Engine Detail Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Engine 1: Groq */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
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

          {/* Engine 2: Gemini */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-blue-200/80 dark:border-blue-900/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-blue-100 dark:border-blue-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-800 text-white flex items-center justify-center shadow-xs">
                    <Bot size={20} />
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
    </div>
  );
};

export default AiTierOverviewCards;
