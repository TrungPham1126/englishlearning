import React from "react";
import {
  Cloud,
  DollarSign,
  HardDrive,
  Activity,
  ShieldCheck,
  Wifi,
  WifiOff,
  FileArchive,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { R2CostReport } from "@/features/admin/types";

interface R2CostReportTabProps {
  report: R2CostReport | null;
  completedClassesCount: number;
  submissionAudioCount: number;
  onSwitchToDatabaseTab?: () => void;
}

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const formatVnd = (vnd: number) => `${vnd.toLocaleString("vi-VN")} ₫`;

export const R2CostReportTab: React.FC<R2CostReportTabProps> = ({
  report,
  completedClassesCount,
  submissionAudioCount,
  onSwitchToDatabaseTab,
}) => {
  if (!report) return null;

  const budgetPct =
    report.monthlyBudgetUsd > 0
      ? Math.min(100, Math.round((report.totalPayableUsd / report.monthlyBudgetUsd) * 100))
      : 0;
  const freeStoragePct = Math.min(100, Math.max(2, report.freeTierUsagePercent));
  const classAPct = Math.min(100, Math.round((report.classAOps / report.freeClassAOps) * 100));
  const classBPct = Math.min(100, Math.round((report.classBOps / report.freeClassBOps) * 100));

  return (
    <div className="space-y-6">
      {/* Connection & Bucket Status Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          report.liveConnected
            ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
            : "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              report.liveConnected
                ? "bg-emerald-600 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {report.liveConnected ? <Wifi size={18} /> : <WifiOff size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-900 dark:text-white">
                Bucket: {report.bucketName || "Chưa cấu hình"}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  report.liveConnected
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                }`}
              >
                {report.liveConnected ? "Live R2" : "Ước tính DB"}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {report.statusMessage}
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0 text-right">
          <div>Egress: <strong className="text-emerald-600 dark:text-emerald-400">$0.00 (Free)</strong></div>
          <div>Tỷ giá: <strong>1 USD = {report.usdToVndRate.toLocaleString("vi-VN")} ₫</strong></div>
        </div>
      </div>

      {/* 4 Spend & Quota KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Net Payable Monthly Cost */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Chi phí R2 (tháng)
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              ${report.totalPayableUsd.toFixed(3)}
            </div>
            <span className="text-xs font-bold text-slate-400">/ ${report.monthlyBudgetUsd.toFixed(0)}</span>
          </div>
          <div className="text-xs font-bold text-blue-700 dark:text-blue-400 mt-1">
            ≈ {formatVnd(report.totalPayableVnd)}
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, budgetPct)}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Chưa trừ Free Tier:</span>
            <strong>${report.grossEquivalentUsd.toFixed(4)}</strong>
          </div>
        </div>

        {/* Card 2: Storage Footprint */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dung lượng R2
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <HardDrive size={20} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <div className="text-3xl font-black text-blue-700 dark:text-blue-400">
              {report.totalStorageGb.toFixed(3)} <span className="text-sm">GB</span>
            </div>
            <span className="text-xs font-bold text-slate-400">/ {report.freeStorageGb} GB Free</span>
          </div>
          <div className="text-xs font-semibold text-slate-500 mt-1">
            {report.totalObjects.toLocaleString()} objects ({formatBytes(report.totalBytes)})
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                report.freeTierUsagePercent >= 85
                  ? "bg-rose-500"
                  : report.freeTierUsagePercent >= 60
                  ? "bg-amber-500"
                  : "bg-blue-600"
              }`}
              style={{ width: `${freeStoragePct}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Free Tier:</span>
            <strong>{report.freeTierUsagePercent.toFixed(1)}%</strong>
          </div>
        </div>

        {/* Card 3: Class A Ops */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Class A (PUT / LIST)
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Cloud size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {report.classAOps.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-slate-500 mt-1">
            Free 1M ops/tháng
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, classAPct)}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Phí ($4.50/1M):</span>
            <strong>${report.classACostUsd.toFixed(4)}</strong>
          </div>
        </div>

        {/* Card 4: Class B + Delete Ops */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Class B (GET) &amp; DELETE
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Activity size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-3">
            {report.classBOps.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-slate-500 mt-1">
            Delete: <strong>{report.deleteOps.toLocaleString()}</strong> ($0)
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, classBPct)}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Phí ($0.36/1M):</span>
            <strong>${report.classBCostUsd.toFixed(4)}</strong>
          </div>
        </div>
      </div>

      {/* Category Distribution + Cost Formula */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileArchive size={18} className="text-blue-700 dark:text-blue-400" />
              Dung lượng theo loại
            </h3>
          </div>

          <div className="space-y-4">
            {report.categoryBreakdowns.map((cat) => (
              <div key={cat.categoryKey} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{cat.label}</span>
                    <span className="ml-2 text-[11px] text-slate-400 font-mono">{cat.prefix}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 dark:text-white">
                      {formatBytes(cat.totalBytes)}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-500">
                      ({cat.objectCount} files • {cat.sharePercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-700 dark:bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(cat.totalBytes > 0 ? 3 : 0, cat.sharePercent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Billing Formula & Optimization Advice */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ShieldCheck size={18} className="text-emerald-600" /> Định giá Cloudflare R2
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Standard (sau 10 GB Free)</span>
                <span className="font-bold text-slate-900 dark:text-white">$0.015 / GB-tháng</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Class A (sau 1M/tháng)</span>
                <span className="font-bold text-slate-900 dark:text-white">$4.50 / 1M req</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Class B (sau 10M/tháng)</span>
                <span className="font-bold text-slate-900 dark:text-white">$0.36 / 1M req</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600 dark:text-slate-400">Egress &amp; Delete</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">$0.00 (Free)</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-6 rounded-xl shadow-sm space-y-3">
            <div className="flex items-center gap-2 font-black text-sm">
              <Sparkles size={18} className="text-amber-300" /> Tối ưu R2 &amp; DB
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              <strong>{completedClassesCount}</strong> lớp đã kết thúc • <strong>{submissionAudioCount}</strong> audio Speaking. Dọn bài làm để giải phóng DB &amp; R2 miễn phí ($0 Delete).
            </p>
            {onSwitchToDatabaseTab && (
              <button
                type="button"
                onClick={onSwitchToDatabaseTab}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg cursor-pointer transition"
              >
                Dọn dữ liệu lớp <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Largest Objects Table */}
      {report.largestObjects.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Tệp dung lượng lớn nhất
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3 pl-6">Object Key</th>
                  <th className="p-3">Loại</th>
                  <th className="p-3 text-right pr-6">Dung lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.largestObjects.map((obj, idx) => (
                  <tr key={`${obj.key}-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 pl-6 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                      {obj.key}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{obj.category}</td>
                    <td className="p-3 pr-6 text-right font-black text-slate-900 dark:text-white">
                      {obj.sizeMb.toFixed(2)} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default R2CostReportTab;
