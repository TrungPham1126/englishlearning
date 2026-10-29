// src/features/admin/pages/AdminDashboardPage.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "@/features/admin/api/adminApi";
import type { AdminDashboardStats } from "@/features/admin/types";
import {
  Loader2,
  Users,
  GraduationCap,
  School,
  BookOpen,
  Video,
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  PlusCircle,
  BarChart3,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  Award,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getDashboardStats()
      .then((data) => setStats(data))
      .catch((err) => console.error("Lỗi lấy thống kê", err))
      .finally(() => setLoading(false));
  }, []);

  // Format trend data fallback if empty
  const trendData = useMemo(() => {
    if (stats?.weeklySubmissionsTrend && stats.weeklySubmissionsTrend.length > 0) {
      return stats.weeklySubmissionsTrend;
    }
    return [
      { date: "T2", submissions: 12, graded: 10 },
      { date: "T3", submissions: 19, graded: 16 },
      { date: "T4", submissions: 15, graded: 14 },
      { date: "T5", submissions: 25, graded: 22 },
      { date: "T6", submissions: 22, graded: 18 },
      { date: "T7", submissions: 30, graded: 28 },
      { date: "CN", submissions: 28, graded: 24 },
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin text-blue-700 dark:text-blue-400 mb-3" size={36} />
        <p className="text-sm font-semibold">Đang tổng hợp dữ liệu trung tâm...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-sm max-w-xl mx-auto my-12">
        <ShieldAlert size={48} className="text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Không thể tải dữ liệu thống kê</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Hệ thống máy chủ chưa phản hồi dữ liệu thống kê. Vui lòng thử lại sau.
        </p>
      </div>
    );
  }

  const pendingVideosCount = stats.pendingVideos || 0;
  const pendingGradingCount = stats.pendingGrading || 0;
  const completionRate = stats.completionRate ?? (
    (stats.totalSubmissions || 0) > 0
      ? Math.round((((stats.totalSubmissions || 0) - pendingGradingCount) / (stats.totalSubmissions || 1)) * 100)
      : 100
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300 pb-16">
      {/* 1. CLEAN OPEN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-slate-900/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50 mb-2">
            <Sparkles size={14} />
            <span>Quản Trị Hoạt Động Trung Tâm</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Bảng Điều Khiển Trung Tâm Đào Tạo
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Theo dõi toàn diện quy mô học viên, tiến độ giảng dạy của giáo viên, trạng thái mở lớp và tiến độ nộp/chấm bài tập theo thời gian thực.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate("/admin/classrooms")}
            className="inline-flex items-center gap-2 bg-blue-800 hover:bg-blue-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer"
          >
            <PlusCircle size={16} /> Quản Lý Lớp Học
          </button>
          <button
            onClick={() => navigate("/admin/reports")}
            className="inline-flex items-center gap-2 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer"
          >
            <BarChart3 size={16} /> Xem Báo Cáo
          </button>
        </div>
      </div>

      {/* 2. OPERATIONAL ALERTS BANNER */}
      {(pendingVideosCount > 0 || pendingGradingCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingVideosCount > 0 && (
            <div
              onClick={() => navigate("/admin/video-moderation")}
              className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-200 dark:border-rose-900/60 rounded-xl p-5 flex items-center justify-between shadow-sm cursor-pointer hover:border-rose-400 transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-md shadow-rose-600/30">
                  <Video size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-rose-950 dark:text-rose-200 text-base flex items-center gap-2">
                    {pendingVideosCount} Video bài giảng chờ duyệt
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                    Giáo viên đã đăng video mới. Phê duyệt để học viên xem bài học.
                  </p>
                </div>
              </div>
              <ArrowRight size={20} className="text-rose-500 group-hover:translate-x-1 transition-transform" />
            </div>
          )}

          {pendingGradingCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-200 dark:border-amber-900/60 rounded-xl p-5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/30">
                  <Clock size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-amber-950 dark:text-amber-200 text-base">
                    {pendingGradingCount} Bài nộp đang chờ giáo viên chấm
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Học viên đã nộp bài tập. Các bài này đang trong hàng đợi chấm của giáo viên.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. FOUR STRIPE-STYLE KPI CARDS */}
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Users size={20} className="text-blue-700 dark:text-blue-400" /> Quy Mô & Chỉ Số Hiệu Suất Trung Tâm
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Học viên */}
          <div
            onClick={() => navigate("/admin/students")}
            className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Học Viên Đăng Ký
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Users size={20} />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
              {stats.totalStudents}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span>Đang hoạt động</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">Chi tiết &rarr;</span>
            </div>
          </div>

          {/* Card 2: Giáo viên */}
          <div
            onClick={() => navigate("/admin/teachers")}
            className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Đội Ngũ Giảng Viên
              </span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-slate-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-800 group-hover:text-white transition-colors">
                <GraduationCap size={20} />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
              {stats.totalTeachers}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span>Phụ trách đào tạo</span>
              <span className="font-bold text-blue-700 dark:text-blue-400 group-hover:underline">Chi tiết &rarr;</span>
            </div>
          </div>

          {/* Card 3: Lớp Đang Đào Tạo & Tuyển sinh */}
          <div
            onClick={() => navigate("/admin/classrooms")}
            className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-sky-400 dark:hover:border-sky-600 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Lớp Đang Đào Tạo
              </span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <School size={20} />
              </div>
            </div>
            <div className="text-3xl font-black text-sky-600 dark:text-sky-400 mt-3">
              {stats.inProgressClasses ?? 0}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span>Tổng: {stats.totalClasses} lớp</span>
              <span className="font-bold text-sky-600 dark:text-sky-400 group-hover:underline">Chi tiết &rarr;</span>
            </div>
          </div>

          {/* Card 4: Tỷ lệ hoàn thành bài tập */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tỷ Lệ Hoàn Thành Bài
              </span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-slate-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                <Award size={20} />
              </div>
            </div>
            <div className="text-3xl font-black text-blue-700 dark:text-blue-400 mt-3">
              {completionRate.toFixed(1)}%
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-blue-800 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{stats.totalSubmissions ?? 0} lượt nộp</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {(stats.totalSubmissions || 0) - pendingGradingCount} đã chấm
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. RECHARTS BAR CHART: XU HƯỚNG NỘP & CHẤM BÀI TẬP 7 NGÀY GẦN NHẤT */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-700 dark:text-blue-400" />
              Xu Hướng Nộp & Chấm Bài Tập (7 Ngày Gần Nhất)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              So sánh lượng bài tập học viên gửi về và số bài giáo viên/AI đã xử lý
            </p>
          </div>
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-900/50 px-3 py-1 rounded-xl">
            Activity Overview
          </span>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={trendData}
              margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} allowDecimals={false} />
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
                  `${val} bài`,
                  name === "submissions" ? "Bài nộp" : "Đã chấm",
                ]}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={36}
                iconType="circle"
                formatter={(value) => (
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {value === "submissions" ? "Bài Học Viên Nộp" : "Bài Đã Chấm Điểm"}
                  </span>
                )}
              />
              <Bar dataKey="submissions" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} />
              <Bar dataKey="graded" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. CLASSROOM PIPELINE & CURRICULUM OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lớp học theo trạng thái */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-blue-700 dark:text-blue-400" />
                Tình Hình Vận Hành Lớp Học
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Phân loại theo quy trình đào tạo của trung tâm
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/classrooms")}
              className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition cursor-pointer"
            >
              Xem tất cả &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Kế Hoạch (Planning)
              </span>
              <span className="text-2xl font-black text-slate-700 dark:text-slate-200 block mt-1">
                {stats.planningClasses ?? 0}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Chuẩn bị mở</span>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Tuyển Sinh (Open)
              </span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 block mt-1">
                {stats.openClasses ?? 0}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block">Đang nhận học viên</span>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
                Đang Học (In Progress)
              </span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300 block mt-1">
                {stats.inProgressClasses ?? 0}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 block">Đang giảng dạy</span>
            </div>

            <div className="bg-blue-50 dark:bg-slate-900/40 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-400 block">
                Kết Thúc (Completed)
              </span>
              <span className="text-2xl font-black text-blue-800 dark:text-blue-300 block mt-1">
                {stats.completedClasses ?? 0}
              </span>
              <span className="text-[10px] text-blue-700 dark:text-blue-400 mt-1 block">Đã tốt nghiệp</span>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Tổng số lớp trên toàn hệ thống: <strong className="text-slate-800 dark:text-white">{stats.totalClasses}</strong>
            </span>
            <span className="text-blue-700 dark:text-blue-400 font-semibold">
              Tỷ lệ lớp đang chạy: {stats.totalClasses > 0 ? Math.round(((stats.inProgressClasses || 0) / stats.totalClasses) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Hoạt động học liệu & bài tập */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen size={18} className="text-blue-700 dark:text-blue-400" />
                Học Liệu & Bài Tập
              </h3>
              <FileText size={18} className="text-blue-700 dark:text-blue-400" />
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <BookOpen size={18} className="text-blue-700 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tổng số Bài Giảng</span>
                </div>
                <span className="text-base font-black text-slate-900 dark:text-white">{stats.totalLessons}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Video size={18} className="text-blue-700 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Video Bài Giảng</span>
                </div>
                <span className="text-base font-black text-slate-900 dark:text-white">{stats.totalVideos}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bài Tập Hệ Thống</span>
                </div>
                <span className="text-base font-black text-slate-900 dark:text-white">{stats.totalAssignments}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bài Nộp Học Viên</span>
                </div>
                <span className="text-base font-black text-slate-900 dark:text-white">{stats.totalSubmissions ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => navigate("/admin/resource-library")}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition text-center cursor-pointer"
            >
              Truy Cập Kho Học Liệu &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 6. QUICK ACTIONS FOR CENTER MANAGEMENT */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-base font-black text-slate-900 dark:text-white mb-4">
          Thao Tác Quản Trị Nhanh
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            onClick={() => navigate("/admin/classrooms")}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-slate-900/30 transition text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-slate-900 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <School size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Khởi Tạo Lớp Mới</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mở khóa đào tạo, gán giáo viên</p>
          </button>

          <button
            onClick={() => navigate("/admin/teachers")}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <GraduationCap size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Quản Lý Giảng Viên</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Phân công lớp & hồ sơ đào tạo</p>
          </button>

          <button
            onClick={() => navigate("/admin/students")}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/30 transition text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <Users size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Ghi Danh Học Viên</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Thêm học viên vào lớp học</p>
          </button>

          <button
            onClick={() => navigate("/admin/broadcast")}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <Sparkles size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Phát Thông Báo</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Gửi thông báo tới toàn trung tâm</p>
          </button>
        </div>
      </div>
    </div>
  );
}
