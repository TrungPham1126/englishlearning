// src/features/admin/pages/AdminReportsPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import {
  ClassroomReportPreviewModal,
  ReportsR2AndClassExportWidget,
} from "@/features/admin/components/database";
import type {
  AdminDashboardStats,
  AdminDatabaseOverview,
  ClassroomDetailedReport,
  ClassroomResponse,
} from "@/features/admin/types";
import type { UserSummaryDto } from "@/types/api";
import { formatScore10, normalizeScoreTo10OrZero } from "@/utils/scoreScale";
import {
  GraduationCap,
  Printer,
  Award,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  PieChart as PieIcon,
  Headphones,
  Mic,
  BookOpen,
  PenTool,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Eye,
  Loader2,
  School,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const STATUS_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  IN_PROGRESS: {
    label: "Đang dạy",
    cls: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  OPEN: {
    label: "Tuyển sinh",
    cls: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  },
  PLANNING: {
    label: "Kế hoạch",
    cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  COMPLETED: {
    label: "Hoàn thành",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  CANCELLED: {
    label: "Đã hủy",
    cls: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  },
};

export default function AdminReportsPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [classes, setClasses] = useState<ClassroomResponse[]>([]);
  const [teachers, setTeachers] = useState<UserSummaryDto[]>([]);
  const [dbOverview, setDbOverview] = useState<AdminDatabaseOverview | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [exportingCenter, setExportingCenter] = useState(false);
  const [exportingClassId, setExportingClassId] = useState<string | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [previewReport, setPreviewReport] =
    useState<ClassroomDetailedReport | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [classSearch, setClassSearch] = useState("");
  const [classStatusFilter, setClassStatusFilter] = useState("ALL");

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const [statsRes, classRes, usersRes, dbRes] = await Promise.allSettled([
        adminApi.getDashboardStats(),
        adminApi.getClassrooms(0, 100),
        adminApi.getUsers(0, 100, "ROLE_TEACHER"),
        adminApi.getDatabaseOverview(),
      ]);

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value);
      }
      if (classRes.status === "fulfilled") {
        setClasses(classRes.value?.content || []);
      }
      if (usersRes.status === "fulfilled") {
        setTeachers(usersRes.value?.content || []);
      }
      if (dbRes.status === "fulfilled") {
        setDbOverview(dbRes.value || null);
      }

      if (
        statsRes.status === "rejected" &&
        classRes.status === "rejected" &&
        usersRes.status === "rejected"
      ) {
        setLoadError("Không thể tải dữ liệu. Thử lại sau.");
      }
    } catch {
      setLoadError("Lỗi tải báo cáo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleExportCenter = async () => {
    setExportingCenter(true);
    setExportFeedback(null);
    try {
      await adminApi.downloadCenterReportExcel();
      setExportFeedback({
        type: "success",
        text: "Đã xuất Bao_cao_tong_hop_trung_tam_ELP.xlsx.",
      });
    } catch (err: any) {
      setExportFeedback({
        type: "error",
        text: err?.response?.data?.message || "Xuất Excel thất bại.",
      });
    } finally {
      setExportingCenter(false);
    }
  };

  const handleExportClass = async (
    classroomId: string,
    classroomName?: string,
  ) => {
    setExportingClassId(classroomId);
    setExportFeedback(null);
    try {
      await adminApi.downloadClassroomReportExcel(classroomId, classroomName);
      setExportFeedback({
        type: "success",
        text: `Đã xuất Excel lớp ${classroomName || classroomId}.`,
      });
    } catch (err: any) {
      setExportFeedback({
        type: "error",
        text: err?.response?.data?.message || "Xuất Excel lớp thất bại.",
      });
    } finally {
      setExportingClassId(null);
    }
  };

  const handlePreviewClass = async (classroomId: string) => {
    setPreviewLoading(true);
    setPreviewReport(null);
    try {
      const detail = await adminApi.getClassroomDetailedReport(classroomId);
      setPreviewReport(detail);
    } catch (err: any) {
      setExportFeedback({
        type: "error",
        text: err?.response?.data?.message || "Không thể tải báo cáo lớp.",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const dbClassMap = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<AdminDatabaseOverview["classrooms"]>[number]
    >();
    (dbOverview?.classrooms || []).forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [dbOverview]);

  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      if (classStatusFilter !== "ALL" && cls.status !== classStatusFilter) {
        return false;
      }
      if (classSearch.trim()) {
        const q = classSearch.trim().toLowerCase();
        const matchName = cls.name?.toLowerCase().includes(q);
        const matchTeacher = cls.teacherName?.toLowerCase().includes(q);
        const matchLevel = cls.level?.toLowerCase().includes(q);
        if (!matchName && !matchTeacher && !matchLevel) return false;
      }
      return true;
    });
  }, [classes, classSearch, classStatusFilter]);

  const levelData = useMemo(() => {
    const levelCounts: Record<
      string,
      { classCount: number; studentCount: number }
    > = {
      A1: { classCount: 0, studentCount: 0 },
      A2: { classCount: 0, studentCount: 0 },
      B1: { classCount: 0, studentCount: 0 },
      B2: { classCount: 0, studentCount: 0 },
      C1: { classCount: 0, studentCount: 0 },
      IELTS_PREP: { classCount: 0, studentCount: 0 },
    };

    classes.forEach((c) => {
      const lvl = c.level || "B1";
      if (!levelCounts[lvl]) {
        levelCounts[lvl] = { classCount: 0, studentCount: 0 };
      }
      levelCounts[lvl].classCount += 1;
      levelCounts[lvl].studentCount += c.currentStudentsCount || 0;
    });

    return Object.entries(levelCounts).map(([level, val]) => ({
      level,
      classCount: val.classCount,
      studentCount: val.studentCount,
    }));
  }, [classes]);

  const totalEnrolledInClasses = useMemo(
    () => classes.reduce((sum, c) => sum + (c.currentStudentsCount || 0), 0),
    [classes],
  );

  const completionDist = stats?.completionDistribution || {
    high: 0,
    medium: 0,
    low: 0,
  };
  const hasSubmissions = (stats?.totalSubmissions || 0) > 0;

  const completionPieData = useMemo(() => {
    const entries = [
      { name: "Tốt (≥ 80%)", value: completionDist.high, color: "#059669" },
      { name: "Trung bình (50–79%)", value: completionDist.medium, color: "#d97706" },
      { name: "Thấp (< 50%)", value: completionDist.low, color: "#e11d48" },
    ];
    const sum = entries.reduce((acc, item) => acc + item.value, 0);
    if (sum <= 0) {
      return [{ name: "Chưa có dữ liệu", value: 100, color: "#94a3b8" }];
    }
    return entries.filter((e) => e.value > 0);
  }, [completionDist]);

  const rawSkillScores = stats?.averageSkillScores || {};
  const skillList = [
    {
      key: "Listening",
      shortName: "Listening",
      name: "Listening",
      icon: Headphones,
      score: rawSkillScores["Listening"] ?? 0,
      color: "text-sky-600 dark:text-sky-400",
      barColor: "bg-sky-600",
      fill: "#0284c7",
    },
    {
      key: "Speaking",
      shortName: "Speaking",
      name: "Speaking",
      icon: Mic,
      score: rawSkillScores["Speaking"] ?? 0,
      color: "text-rose-600 dark:text-rose-400",
      barColor: "bg-rose-600",
      fill: "#e11d48",
    },
    {
      key: "Reading",
      shortName: "Reading",
      name: "Reading",
      icon: BookOpen,
      score: rawSkillScores["Reading"] ?? 0,
      color: "text-blue-700 dark:text-blue-400",
      barColor: "bg-blue-700",
      fill: "#1d4ed8",
    },
    {
      key: "Writing",
      shortName: "Writing",
      name: "Writing",
      icon: PenTool,
      score: rawSkillScores["Writing"] ?? 0,
      color: "text-amber-600 dark:text-amber-400",
      barColor: "bg-amber-600",
      fill: "#d97706",
    },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12" aria-busy="true">
        <div className="h-16 bg-slate-200/70 dark:bg-slate-800/70 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 bg-slate-200/70 dark:bg-slate-800/70 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200/70 dark:bg-slate-800/70 rounded-xl animate-pulse" />
          <div className="h-64 bg-slate-200/70 dark:bg-slate-800/70 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* 1. CLEAN OPEN HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800 print:hidden">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Báo cáo trung tâm
        </h1>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={exportingCenter}
            onClick={handleExportCenter}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold transition shadow-xs cursor-pointer text-xs disabled:opacity-50"
          >
            {exportingCenter ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={15} />
            )}
            {exportingCenter
              ? "Đang xuất..."
              : "Xuất Excel (.xlsx)"}
          </button>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => loadAll(true)}
            className="inline-flex items-center gap-1.5 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-lg font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer text-xs disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold transition shadow-xs cursor-pointer text-xs"
          >
            <Printer size={15} /> In báo cáo
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={16} /> {loadError}
          </span>
          <button
            type="button"
            onClick={() => loadAll(true)}
            className="px-3 py-1 rounded-md bg-rose-600 text-white font-bold cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {exportFeedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 print:hidden ${
            exportFeedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          <span className="flex items-center gap-2">
            {exportFeedback.type === "success" ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <AlertCircle size={16} className="shrink-0" />
            )}
            {exportFeedback.text}
          </span>
          <button
            type="button"
            onClick={() => setExportFeedback(null)}
            className="underline font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 2. CENTER HIGH-LEVEL SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111827] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Học viên
          </span>
          <span className="text-3xl font-black text-slate-900 dark:text-white block mt-2 tabular-nums">
            {stats?.totalStudents || 0}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block tabular-nums">
            {totalEnrolledInClasses} lượt ghi danh
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Giảng viên
          </span>
          <span className="text-3xl font-black text-blue-700 dark:text-blue-400 block mt-2 tabular-nums">
            {stats?.totalTeachers || 0}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block tabular-nums">
            {classes.length} lớp học
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Lớp đang dạy
          </span>
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block mt-2 tabular-nums">
            {stats?.inProgressClasses || 0}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block tabular-nums">
            {stats?.openClasses || 0} tuyển sinh
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Bài nộp
          </span>
          <span className="text-3xl font-black text-sky-600 dark:text-sky-400 block mt-2 tabular-nums">
            {stats?.totalSubmissions || 0}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block tabular-nums">
            {stats?.pendingGrading || 0} chờ chấm
          </span>
        </div>
      </div>

      {/* 2B. BÁO CÁO CHI TIÊU CLOUD R2 & TRUNG TÂM XUẤT EXCEL */}
      <ReportsR2AndClassExportWidget classes={classes} />

      {/* 3. PHÂN BỐ TIẾN ĐỘ HOÀN THÀNH & ĐIỂM KỸ NĂNG THẬT TỪ DATABASE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Phân bố mức độ hoàn thành nhiệm vụ */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111827] rounded-xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <PieIcon size={18} className="text-blue-700 dark:text-blue-400" />
                Mức hoàn thành
              </h3>
            </div>

            <div className="h-44 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={completionPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {completionPieData.map((entry, idx) => (
                      <Cell key={`comp-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "8px",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => [`${Number(val).toFixed(1)}%`, "Tỷ lệ"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 mt-2">
              <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Tốt (≥ 80%)
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-extrabold tabular-nums">
                    {completionDist.high.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-emerald-200/60 dark:bg-emerald-900/50 h-2 rounded-md overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, completionDist.high))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Trung bình (50–79%)
                  </span>
                  <span className="text-amber-700 dark:text-amber-400 font-extrabold tabular-nums">
                    {completionDist.medium.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-amber-200/60 dark:bg-amber-900/50 h-2 rounded-md overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, completionDist.medium))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <HelpCircle size={14} /> Thấp (&lt; 50%)
                  </span>
                  <span className="text-rose-700 dark:text-rose-400 font-extrabold tabular-nums">
                    {completionDist.low.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-rose-200/60 dark:bg-rose-900/50 h-2 rounded-md overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, completionDist.low))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between tabular-nums">
            <span>Hoàn thành TB:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {stats?.completionRate != null
                ? `${stats.completionRate.toFixed(1)}%`
                : "100.0%"}
            </span>
          </div>
        </div>

        {/* Điểm kỹ năng trung bình toàn hệ thống */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111827] rounded-xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Award size={18} className="text-blue-700 dark:text-blue-400" />
                Điểm TB 4 kỹ năng
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                Thang 100 / 10
              </span>
            </div>

            <div className="h-52 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={skillList.map((s) => ({
                    name: s.shortName,
                    score: Number(s.score.toFixed(1)),
                    fill: s.fill,
                  }))}
                  margin={{ top: 10, right: 16, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#94a3b8"
                    opacity={0.2}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "8px",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => [`${val} / 100 pts`, "Điểm TB"]}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {skillList.map((s, idx) => (
                      <Cell key={`skill-${idx}`} fill={s.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
              {skillList.map((skill) => {
                const IconComp = skill.icon;
                const score100 = skill.score;
                const score10 = (score100 / 10).toFixed(1);
                const hasScore = score100 > 0;

                return (
                  <div
                    key={skill.key}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <IconComp size={15} className={skill.color} />
                        <span>{skill.name}</span>
                      </span>
                      <div className="flex items-baseline gap-1 tabular-nums">
                        <span className="text-slate-900 dark:text-white font-black text-sm">
                          {hasScore ? score100.toFixed(1) : "0.0"}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          ({hasScore ? `${score10}/10` : "0.0/10"})
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-md overflow-hidden">
                      <div
                        className={`${skill.barColor} h-full rounded-md transition-all duration-500`}
                        style={{
                          width: `${Math.min(100, Math.max(hasScore ? 5 : 0, score100))}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Nguồn dữ liệu:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {hasSubmissions
                ? "Database & AI"
                : "Chưa có bài nộp"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. CEFR LEVEL DISTRIBUTION CHART & CARDS */}
      <div className="bg-white dark:bg-[#111827] rounded-xl p-6 border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={18} className="text-blue-700 dark:text-blue-400" />
            Phân bổ theo trình độ CEFR
          </h3>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={levelData}
              margin={{ top: 10, right: 16, left: -15, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#94a3b8"
                opacity={0.2}
              />
              <XAxis
                dataKey="level"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#1e293b",
                  borderRadius: "8px",
                  color: "#f8fafc",
                  fontSize: "12px",
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={30}
                formatter={(value) => (
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {value === "studentCount" ? "Học viên" : "Lớp học"}
                  </span>
                )}
              />
              <Bar
                dataKey="studentCount"
                fill="#1d4ed8"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                dataKey="classCount"
                fill="#0284c7"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {levelData.map((item) => {
            const pct =
              totalEnrolledInClasses > 0
                ? Math.round((item.studentCount / totalEnrolledInClasses) * 100)
                : 0;
            return (
              <div
                key={item.level}
                className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-md">
                      {item.level}
                    </span>
                    <span className="text-xs font-bold text-slate-500 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-3 tabular-nums">
                    {item.studentCount}{" "}
                    <span className="text-xs font-semibold text-slate-500">
                      HV
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5 tabular-nums">
                    {item.classCount} lớp
                  </span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-md overflow-hidden mt-3">
                  <div
                    className="bg-blue-800 dark:bg-blue-500 h-full rounded-md transition-all duration-500"
                    style={{ width: `${Math.max(pct, item.studentCount > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. CLASSROOM REPORT TABLE WITH QUICK PREVIEW & EXCEL EXPORT */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <School size={18} className="text-blue-700 dark:text-blue-400" />
            Báo cáo theo lớp ({filteredClasses.length})
          </h3>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 print:hidden">
            <select
              value={classStatusFilter}
              onChange={(e) => setClassStatusFilter(e.target.value)}
              aria-label="Lọc trạng thái"
              className="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b0f17] text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-700"
            >
              <option value="ALL">Tất cả</option>
              <option value="IN_PROGRESS">Đang dạy</option>
              <option value="OPEN">Tuyển sinh</option>
              <option value="PLANNING">Kế hoạch</option>
              <option value="COMPLETED">Hoàn thành</option>
            </select>

            <div className="relative w-full sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                placeholder="Tìm lớp, GV, trình độ..."
                className="w-full pl-8 pr-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b0f17] text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-700"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 pl-6">Lớp học</th>
                <th className="p-4 text-center">Trình độ</th>
                <th className="p-4 text-center">Trạng thái</th>
                <th className="p-4">Giảng viên</th>
                <th className="p-4 text-center">Sĩ số</th>
                <th className="p-4 text-center">Lượt nộp / ĐTB</th>
                <th className="p-4 pr-6 text-right print:hidden">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredClasses.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Không có lớp phù hợp.
                  </td>
                </tr>
              ) : (
                filteredClasses.map((cls) => {
                  const dbItem = dbClassMap.get(cls.id);
                  const badge = STATUS_BADGE_MAP[cls.status] || {
                    label: cls.status,
                    cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                  };
                  return (
                    <tr
                      key={cls.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="p-4 pl-6">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {cls.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          {cls.startDate || "-"} &rarr; {cls.endDate || "-"}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                          {cls.level}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                        {cls.teacherName || (
                          <span className="text-slate-400 italic">
                            Chưa gán
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900 dark:text-white tabular-nums">
                        {cls.currentStudentsCount ?? 0}
                        {cls.maxStudents ? ` / ${cls.maxStudents}` : ""}
                      </td>
                      <td className="p-4 text-center tabular-nums">
                        {dbItem ? (
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {dbItem.attemptCount} lượt
                            </span>
                            <span className="text-slate-400 mx-1">•</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {normalizeScoreTo10OrZero(dbItem.averageScore) > 0
                                ? `${formatScore10(dbItem.averageScore)} đ`
                                : "—"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-right print:hidden">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePreviewClass(cls.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer transition"
                          >
                            <Eye size={13} /> Xem
                          </button>
                          <button
                            type="button"
                            disabled={exportingClassId === cls.id}
                            onClick={() => handleExportClass(cls.id, cls.name)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition disabled:opacity-50"
                          >
                            {exportingClassId === cls.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <FileSpreadsheet size={13} />
                            )}
                            Xuất Excel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. TEACHER WORKLOAD ROSTER */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap
              size={18}
              className="text-blue-700 dark:text-blue-400"
            />
            Phân công giảng viên
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 pl-6">Giảng viên</th>
                <th className="p-4">Email</th>
                <th className="p-4">Lớp phụ trách</th>
                <th className="p-4 text-center">Học viên</th>
                <th className="p-4 pr-6 text-center">Mức tải</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {teachers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    Chưa có giảng viên.
                  </td>
                </tr>
              ) : (
                teachers.map((teacher) => {
                  const assigned = classes.filter(
                    (c) => c.teacherId === teacher.id,
                  );
                  const totalStudents = assigned.reduce(
                    (sum, c) => sum + (c.currentStudentsCount || 0),
                    0,
                  );
                  return (
                    <tr
                      key={teacher.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition"
                    >
                      <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white">
                        {teacher.lastName} {teacher.firstName}
                      </td>
                      <td className="p-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {teacher.email}
                      </td>
                      <td className="p-4">
                        {assigned.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">
                            Chưa có lớp
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {assigned.map((cls) => (
                              <span
                                key={cls.id}
                                className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700"
                              >
                                {cls.name} ({cls.level})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900 dark:text-white tabular-nums">
                        {totalStudents}
                      </td>
                      <td className="p-4 pr-6 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${
                            assigned.length >= 3
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              : assigned.length > 0
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {assigned.length >= 3
                            ? "Tải cao"
                            : assigned.length > 0
                              ? "Bình thường"
                              : "Sẵn sàng"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClassroomReportPreviewModal
        report={previewReport}
        loading={previewLoading}
        exporting={exportingClassId !== null}
        onClose={() => {
          setPreviewReport(null);
          setPreviewLoading(false);
        }}
        onDownloadExcel={(classId, className) =>
          handleExportClass(classId, className)
        }
      />
    </div>
  );
}
