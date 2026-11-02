import React, { useMemo } from "react";
import { TrendingUp, PieChart as PieIcon } from "lucide-react";
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
import type { AiStatsResponse } from "@/features/admin/types";

interface AiUsageChartsProps {
  stats: AiStatsResponse | null;
}

export const AiUsageCharts: React.FC<AiUsageChartsProps> = ({ stats }) => {
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 7-Day Token Trends AreaChart */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-700 dark:text-blue-400" />
              Thống Kê Token Tiêu Thụ (7 Ngày)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Dữ liệu phân tích giữa Token gửi đi (Input) và Token nhận về (Output)
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

      {/* Cost Breakdown Donut Chart */}
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
  );
};

export default AiUsageCharts;
