import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "@/features/admin/api/adminApi";
import { ClassroomReportPreviewModal } from "@/features/admin/components/database";
import { formatScore10, normalizeScoreTo10OrZero } from "@/utils/scoreScale";
import type {
  AdminDashboardStats,
  AdminDatabaseOverview,
  AiStatsResponse,
  AuditLogDto,
  ClassroomDatabaseItem,
  ClassroomDetailedReport,
  ClassroomResponse,
} from "@/features/admin/types";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cpu,
  Database,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HardDrive,
  Headphones,
  History,
  Layers,
  Loader2,
  Megaphone,
  Mic,
  PenTool,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  School,
  Search,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CLASS_STATUS_META: Record<
  string,
  { label: string; color: string; badgeCls: string }
> = {
  IN_PROGRESS: {
    label: "Đang dạy",
    color: "#1d4ed8",
    badgeCls:
      "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  OPEN: {
    label: "Tuyển sinh",
    color: "#0284c7",
    badgeCls:
      "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  },
  PLANNING: {
    label: "Kế hoạch",
    color: "#d97706",
    badgeCls:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  COMPLETED: {
    label: "Hoàn thành",
    color: "#059669",
    badgeCls:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  CANCELLED: {
    label: "Đã hủy",
    color: "#e11d48",
    badgeCls:
      "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  },
};

const SKILL_CONFIG = [
  {
    key: "Listening",
    aliases: ["Listening", "listening", "LISTENING", "Nghe"],
    label: "Listening",
    shortLabel: "Listening",
    color: "#1d4ed8",
    icon: Headphones,
  },
  {
    key: "Speaking",
    aliases: ["Speaking", "speaking", "SPEAKING", "Nói"],
    label: "Speaking",
    shortLabel: "Speaking",
    color: "#0284c7",
    icon: Mic,
  },
  {
    key: "Reading",
    aliases: ["Reading", "reading", "READING", "Đọc"],
    label: "Reading",
    shortLabel: "Reading",
    color: "#059669",
    icon: BookOpen,
  },
  {
    key: "Writing",
    aliases: ["Writing", "writing", "WRITING", "Viết"],
    label: "Writing",
    shortLabel: "Writing",
    color: "#d97706",
    icon: PenTool,
  },
] as const;

const LEVEL_COLORS: Record<string, string> = {
  A1: "#0284c7",
  A2: "#0ea5e9",
  B1: "#1d4ed8",
  B2: "#1e40af",
  C1: "#059669",
  C2: "#047857",
  IELTS_PREP: "#d97706",
  TOEIC: "#64748b",
};

interface MergedClassroomRow {
  id: string;
  name: string;
  level: string;
  status: string;
  teacherName: string;
  startDate?: string;
  endDate?: string;
  studentCount: number;
  maxStudents: number;
  lessonCount: number;
  assignmentCount: number;
  examCount: number;
  attemptCount: number;
  averageScore: number | null;
  cheatingFlagCount: number;
}

function formatCompactNumber(num: number): string {
  if (!Number.isFinite(num)) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("vi-VN");
}

function formatStorageSize(kb: number): string {
  if (!Number.isFinite(kb) || kb <= 0) return "0 KB";
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.round(kb)} KB`;
}

function formatShortDateLabel(rawDate: string): string {
  if (!rawDate) return "";
  const parts = rawDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getDate()).padStart(2, "0")}/${String(
      parsed.getMonth() + 1,
    ).padStart(2, "0")}`;
  }
  return rawDate;
}

function formatRelativeTime(iso: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveSkillScore(
  map: Record<string, number> | undefined,
  aliases: readonly string[],
): number {
  if (!map) return 0;
  for (const key of aliases) {
    const val = map[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      return Number(val.toFixed(1));
    }
  }
  return 0;
}

function parseAuditActionMeta(log: AuditLogDto): {
  label: string;
  cls: string;
  detail: string;
} {
  const action = (log.action ?? "").toUpperCase();
  let detail = `${log.entityName || "Hệ thống"} ${log.entityId ? `#${log.entityId.slice(0, 8)}` : ""}`.trim();

  if (log.metadataJson) {
    try {
      const parsed = JSON.parse(log.metadataJson) as Record<string, unknown>;
      const reason = parsed.reason ?? parsed.message ?? parsed.detail;
      if (typeof reason === "string" && reason.trim().length > 0) {
        detail = reason;
      }
    } catch {
      // Keep raw entity summary when metadataJson is not JSON
    }
  }

  if (
    action.includes("FAIL") ||
    action.includes("ERROR") ||
    action.includes("KILL") ||
    action.includes("BLOCK")
  ) {
    return {
      label: log.action || "Cảnh báo",
      cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      detail,
    };
  }
  if (action.includes("FALLBACK") || action.includes("WARN") || action.includes("PURGE")) {
    return {
      label: log.action || "Lưu ý",
      cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      detail,
    };
  }
  if (action.includes("CREATE") || action.includes("APPROVE") || action.includes("EXPORT")) {
    return {
      label: log.action || "Hoàn tất",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      detail,
    };
  }
  return {
    label: log.action || "Hoạt động",
    cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    detail,
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Đang tải...">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-72 rounded-md bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-96 rounded-md bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-md bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-40 rounded-md bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-36 rounded-md bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      <div className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="h-28 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 space-y-3"
          >
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-7 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-44 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="h-80 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5"
          />
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomResponse[]>([]);
  const [aiStats, setAiStats] = useState<AiStatsResponse | null>(null);
  const [dbOverview, setDbOverview] = useState<AdminDatabaseOverview | null>(
    null,
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

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

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const [statsRes, classesRes, aiRes, dbRes, logsRes] =
        await Promise.allSettled([
          adminApi.getDashboardStats(),
          adminApi.getClassrooms(0, 100),
          adminApi.getAiUsageStats(),
          adminApi.getDatabaseOverview(),
          adminApi.getAuditLogs(0, 8),
        ]);

      if (statsRes.status === "rejected") {
        setLoadError("Không thể tải dữ liệu. Kiểm tra kết nối máy chủ.");
      } else {
        setStats(statsRes.value);
        setLastSyncedAt(new Date());
      }

      if (classesRes.status === "fulfilled") {
        setClassrooms(classesRes.value?.content ?? []);
      }
      if (aiRes.status === "fulfilled") {
        setAiStats(aiRes.value);
      }
      if (dbRes.status === "fulfilled") {
        setDbOverview(dbRes.value);
      }
      if (logsRes.status === "fulfilled") {
        setAuditLogs(logsRes.value?.content ?? []);
      }
    } catch {
      setLoadError("Lỗi đồng bộ dữ liệu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const handleExportCenterExcel = async () => {
    setExportingCenter(true);
    setExportFeedback(null);
    try {
      await adminApi.downloadCenterReportExcel();
      setExportFeedback({
        type: "success",
        text: "Đã xuất Bao_cao_tong_hop_trung_tam_ELP.xlsx.",
      });
    } catch {
      setExportFeedback({
        type: "error",
        text: "Xuất Excel thất bại. Thử lại sau.",
      });
    } finally {
      setExportingCenter(false);
    }
  };

  const handleExportClassroomExcel = async (
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
    } catch {
      setExportFeedback({
        type: "error",
        text: `Xuất Excel lớp ${classroomName || classroomId} thất bại.`,
      });
    } finally {
      setExportingClassId(null);
    }
  };

  const handleOpenClassPreview = async (classroomId: string) => {
    setPreviewLoading(true);
    try {
      const detailed = await adminApi.getClassroomDetailedReport(classroomId);
      setPreviewReport(detailed);
    } catch {
      setExportFeedback({
        type: "error",
        text: "Không thể tải báo cáo lớp.",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Merge classroom catalog with database metrics
  const mergedClassrooms = useMemo<MergedClassroomRow[]>(() => {
    const dbMap = new Map<string, ClassroomDatabaseItem>();
    for (const item of dbOverview?.classrooms ?? []) {
      dbMap.set(item.id, item);
    }

    if (classrooms.length > 0) {
      return classrooms.map((cls) => {
        const dbItem = dbMap.get(cls.id);
        return {
          id: cls.id,
          name: cls.name,
          level: cls.level || dbItem?.level || "N/A",
          status: cls.status || dbItem?.status || "PLANNING",
          teacherName: cls.teacherName || dbItem?.teacherName || "Chưa gán",
          startDate: cls.startDate ?? dbItem?.startDate,
          endDate: cls.endDate ?? dbItem?.endDate,
          studentCount: cls.currentStudentsCount ?? dbItem?.studentCount ?? 0,
          maxStudents: cls.maxStudents ?? 0,
          lessonCount: dbItem?.lessonCount ?? 0,
          assignmentCount: dbItem?.assignmentCount ?? 0,
          examCount: dbItem?.examCount ?? 0,
          attemptCount: dbItem?.attemptCount ?? 0,
          averageScore:
            typeof dbItem?.averageScore === "number" ? dbItem.averageScore : null,
          cheatingFlagCount: dbItem?.cheatingFlagCount ?? 0,
        };
      });
    }

    return (dbOverview?.classrooms ?? []).map((dbItem) => ({
      id: dbItem.id,
      name: dbItem.name,
      level: dbItem.level || "N/A",
      status: dbItem.status || "PLANNING",
      teacherName: dbItem.teacherName || "Chưa gán",
      startDate: dbItem.startDate,
      endDate: dbItem.endDate,
      studentCount: dbItem.studentCount ?? 0,
      maxStudents: 0,
      lessonCount: dbItem.lessonCount ?? 0,
      assignmentCount: dbItem.assignmentCount ?? 0,
      examCount: dbItem.examCount ?? 0,
      attemptCount: dbItem.attemptCount ?? 0,
      averageScore:
        typeof dbItem.averageScore === "number" ? dbItem.averageScore : null,
      cheatingFlagCount: dbItem.cheatingFlagCount ?? 0,
    }));
  }, [classrooms, dbOverview]);

  const filteredClassrooms = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    return mergedClassrooms.filter((cls) => {
      if (classStatusFilter !== "ALL" && cls.status !== classStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        cls.name.toLowerCase().includes(q) ||
        cls.teacherName.toLowerCase().includes(q) ||
        cls.level.toLowerCase().includes(q)
      );
    });
  }, [mergedClassrooms, classSearch, classStatusFilter]);

  // Derived AI stats normalized across contract shapes
  const aiSummary = useMemo(() => {
    const raw = aiStats as Record<string, unknown> | null;
    const totalTokens =
      aiStats?.totalTokens ??
      (typeof raw?.totalTokensUsedToday === "number" ? raw.totalTokensUsedToday : 0);
    const killSwitch =
      aiStats?.systemKillSwitchActive ??
      (typeof raw?.isKillSwitchActive === "boolean" ? raw.isKillSwitchActive : false);
    const activeUsers =
      aiStats?.activeUsers ??
      (typeof raw?.activeStudentsToday === "number" ? raw.activeStudentsToday : 0);
    const quotaRemaining = aiStats?.systemQuotaRemainingPercent ?? 100;
    const estimatedCost = aiStats?.estimatedCostUsd ?? 0;
    const monthlyCost = aiStats?.monthlyCostUsd ?? 0;
    return {
      totalTokens,
      killSwitch,
      activeUsers,
      quotaRemaining,
      estimatedCost,
      monthlyCost,
    };
  }, [aiStats]);

  // Class status breakdown derived from stats + fallback to classrooms list
  const classStatusData = useMemo(() => {
    const fallbackCounts = mergedClassrooms.reduce<Record<string, number>>(
      (acc, c) => {
        acc[c.status] = (acc[c.status] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const inProgress =
      stats?.inProgressClasses ?? fallbackCounts.IN_PROGRESS ?? 0;
    const open = stats?.openClasses ?? fallbackCounts.OPEN ?? 0;
    const planning = stats?.planningClasses ?? fallbackCounts.PLANNING ?? 0;
    const completed = stats?.completedClasses ?? fallbackCounts.COMPLETED ?? 0;

    return [
      {
        key: "IN_PROGRESS",
        name: "Đang dạy",
        value: inProgress,
        color: CLASS_STATUS_META.IN_PROGRESS.color,
      },
      {
        key: "OPEN",
        name: "Tuyển sinh",
        value: open,
        color: CLASS_STATUS_META.OPEN.color,
      },
      {
        key: "PLANNING",
        name: "Kế hoạch",
        value: planning,
        color: CLASS_STATUS_META.PLANNING.color,
      },
      {
        key: "COMPLETED",
        name: "Hoàn thành",
        value: completed,
        color: CLASS_STATUS_META.COMPLETED.color,
      },
    ];
  }, [stats, mergedClassrooms]);

  // CEFR Level distribution from classrooms
  const levelDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cls of mergedClassrooms) {
      const lv = cls.level || "OTHER";
      counts.set(lv, (counts.get(lv) ?? 0) + 1);
    }
    const total = mergedClassrooms.length || 1;
    return Array.from(counts.entries())
      .map(([level, count]) => ({
        level,
        count,
        percent: Math.round((count / total) * 100),
        color: LEVEL_COLORS[level] ?? "#64748b",
      }))
      .sort((a, b) => b.count - a.count);
  }, [mergedClassrooms]);

  // 7-day submissions & grading trend
  const weeklyTrend = useMemo(() => {
    const raw = stats?.weeklySubmissionsTrend ?? [];
    return raw.map((item) => ({
      dateLabel: formatShortDateLabel(item.date),
      rawDate: item.date,
      submissions: item.submissions ?? 0,
      graded: item.graded ?? 0,
    }));
  }, [stats]);

  const weeklyTotals = useMemo(() => {
    const totalSub = weeklyTrend.reduce((sum, i) => sum + i.submissions, 0);
    const totalGraded = weeklyTrend.reduce((sum, i) => sum + i.graded, 0);
    const avgPerDay =
      weeklyTrend.length > 0 ? (totalSub / weeklyTrend.length).toFixed(1) : "0";
    const pendingInWeek = Math.max(0, totalSub - totalGraded);
    return { totalSub, totalGraded, avgPerDay, pendingInWeek };
  }, [weeklyTrend]);

  // 4-Skill Scores for Radar + Breakdown bars
  const skillChartData = useMemo(() => {
    return SKILL_CONFIG.map((cfg) => ({
      key: cfg.key,
      subject: cfg.shortLabel,
      shortLabel: cfg.shortLabel,
      label: cfg.label,
      score: resolveSkillScore(stats?.averageSkillScores, cfg.aliases),
      fullMark: 10,
      color: cfg.color,
      icon: cfg.icon,
    }));
  }, [stats]);

  const overallSkillAvg = useMemo(() => {
    const valid = skillChartData.filter((s) => s.score > 0);
    if (valid.length === 0) return "0.0";
    const sum = valid.reduce((acc, s) => acc + s.score, 0);
    return (sum / valid.length).toFixed(1);
  }, [skillChartData]);

  // Completion Distribution (high >= 80%, medium 50-79%, low < 50%)
  const completionBuckets = useMemo(() => {
    const high = stats?.completionDistribution?.high ?? 0;
    const medium = stats?.completionDistribution?.medium ?? 0;
    const low = stats?.completionDistribution?.low ?? 0;
    const total = high + medium + low;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    return {
      total,
      items: [
        {
          key: "high",
          label: "Tốt (>= 80%)",
          count: high,
          percent: pct(high),
          color: "#059669",
          badgeCls:
            "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        },
        {
          key: "medium",
          label: "Trung bình (50–79%)",
          count: medium,
          percent: pct(medium),
          color: "#d97706",
          badgeCls:
            "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
        },
        {
          key: "low",
          label: "Thấp (< 50%)",
          count: low,
          percent: pct(low),
          color: "#e11d48",
          badgeCls:
            "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
        },
      ],
    };
  }, [stats]);

  // Top classrooms comparison bar data (students vs attempts)
  const classroomComparisonData = useMemo(() => {
    return [...mergedClassrooms]
      .sort(
        (a, b) =>
          b.studentCount + b.attemptCount - (a.studentCount + a.attemptCount),
      )
      .slice(0, 6)
      .map((c) => ({
        name: c.name.length > 16 ? `${c.name.slice(0, 15)}…` : c.name,
        fullName: c.name,
        students: c.studentCount,
        attempts: c.attemptCount,
        avgScore: normalizeScoreTo10OrZero(c.averageScore),
      }));
  }, [mergedClassrooms]);

  // System health calculations
  const totalCheatingFlags = useMemo(
    () =>
      mergedClassrooms.reduce((sum, c) => sum + (c.cheatingFlagCount ?? 0), 0),
    [mergedClassrooms],
  );

  const avgStudentsPerTeacher = useMemo(() => {
    if (!stats || stats.totalTeachers <= 0) return "0";
    return (stats.totalStudents / stats.totalTeachers).toFixed(1);
  }, [stats]);

  const approvedVideos = Math.max(
    0,
    (stats?.totalVideos ?? 0) - (stats?.pendingVideos ?? 0),
  );
  const videoApprovalRate =
    stats && stats.totalVideos > 0
      ? Math.round((approvedVideos / stats.totalVideos) * 100)
      : 100;

  const totalSubmissions = stats?.totalSubmissions ?? 0;
  const pendingGrading = stats?.pendingGrading ?? 0;
  const gradedCount = Math.max(0, totalSubmissions - pendingGrading);
  const gradingRate =
    totalSubmissions > 0
      ? Math.round((gradedCount / totalSubmissions) * 100)
      : 100;

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  if (loadError && !stats) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 p-8 max-w-2xl mx-auto my-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Không thể tải tổng quan
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {loadError}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard(false)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Thử lại
        </button>
      </div>
    );
  }

  const inProgressCount =
    classStatusData.find((s) => s.key === "IN_PROGRESS")?.value ?? 0;
  const openCount = classStatusData.find((s) => s.key === "OPEN")?.value ?? 0;
  const completedCount =
    classStatusData.find((s) => s.key === "COMPLETED")?.value ?? 0;

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header Command Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tổng quan
          </h1>
          {lastSyncedAt && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Cập nhật{" "}
              {lastSyncedAt.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => void handleExportCenterExcel()}
            disabled={exportingCenter}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {exportingCenter ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Xuất Excel (.xlsx)
          </button>

          <Link
            to="/admin/classrooms"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors"
          >
            <School className="w-4 h-4" />
            Quản lý lớp
          </Link>

          <Link
            to="/admin/reports"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Báo cáo
          </Link>
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {(exportFeedback || loadError) && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-sm ${
            loadError || exportFeedback?.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
              : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {loadError || exportFeedback?.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{loadError || exportFeedback?.text}</span>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => {
              setExportFeedback(null);
              setLoadError(null);
            }}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Operational Alerts & System Health Strip */}
      <div className="space-y-3">
        {((stats?.pendingVideos ?? 0) > 0 ||
          pendingGrading > 0 ||
          totalCheatingFlags > 0 ||
          aiSummary.killSwitch) && (
          <div className="flex flex-wrap items-center gap-2.5">
            {(stats?.pendingVideos ?? 0) > 0 && (
              <Link
                to="/admin/video-moderation"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                <Video className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  {stats?.pendingVideos} video chờ duyệt
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {pendingGrading > 0 && (
              <Link
                to="/admin/reports"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  {pendingGrading} bài chờ chấm
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {totalCheatingFlags > 0 && (
              <Link
                to="/admin/reports"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  {totalCheatingFlags} cảnh báo gian lận
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {aiSummary.killSwitch && (
              <Link
                to="/admin/ai-monitoring"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-semibold"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                AI Kill-Switch đang bật
              </Link>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 sm:border-r sm:border-slate-200 dark:sm:border-slate-800 sm:pr-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tài khoản
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {(stats?.totalUsers ?? 0).toLocaleString("vi-VN")}
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {stats?.totalStudents ?? 0} HV · {stats?.totalTeachers ?? 0} GV
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 xl:border-r xl:border-slate-200 dark:xl:border-slate-800 xl:pr-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quota AI 3-Tier
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  Còn {aiSummary.quotaRemaining}%
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${
                aiSummary.killSwitch
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              }`}
            >
              {aiSummary.killSwitch ? "Đang khóa" : "Hoạt động"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 sm:border-r sm:border-slate-200 dark:sm:border-slate-800 sm:pr-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Duyệt video
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {videoApprovalRate}% ({approvedVideos}/{stats?.totalVideos ?? 0})
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {stats?.pendingVideos ?? 0} chờ
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chấm bài &amp; Lượt thi
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {gradingRate}% đã chấm
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {(dbOverview?.totalAttempts ?? 0).toLocaleString("vi-VN")} lượt
            </span>
          </div>
        </div>
      </div>

      {/* 3. 8 Primary KPI Cards (2 Rows x 4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Học viên
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {(stats?.totalStudents ?? 0).toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {dbOverview?.totalEnrolledStudents ?? stats?.totalStudents ?? 0} ghi
            danh · {stats?.totalUsers ?? 0} tài khoản
          </p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Giảng viên
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {(stats?.totalTeachers ?? 0).toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            TB {avgStudentsPerTeacher} HV / GV
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Lớp đang dạy
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {inProgressCount}
                <span className="text-sm font-medium text-slate-400 ml-1">
                  / {stats?.totalClasses ?? mergedClassrooms.length}
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <School className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {openCount} tuyển sinh · {completedCount} hoàn thành
          </p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tỷ lệ hoàn thành
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {(stats?.completionRate ?? 0).toFixed(1)}%
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {totalSubmissions.toLocaleString("vi-VN")} bài nộp · {pendingGrading}{" "}
            chờ chấm
          </p>
        </div>

        {/* KPI 5 */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Điểm TB 4 kỹ năng
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {overallSkillAvg}
                <span className="text-sm font-medium text-slate-400 ml-1">
                  / 10
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-medium tabular-nums">
            {skillChartData.map((s) => (
              <span
                key={s.key}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                {s.shortLabel[0]}: {s.score.toFixed(1)}
              </span>
            ))}
          </div>
        </div>

        {/* KPI 6 */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Học liệu &amp; Đề thi
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {(
                  (stats?.totalLessons ?? 0) +
                  (stats?.totalAssignments ?? 0) +
                  (dbOverview?.totalExams ?? 0)
                ).toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {stats?.totalLessons ?? 0} bài giảng · {stats?.totalAssignments ?? 0}{" "}
            BT · {stats?.totalVideos ?? 0} video
          </p>
        </div>

        {/* KPI 7 */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                AI 3-Tier
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {formatCompactNumber(aiSummary.totalTokens)}
                <span className="text-xs font-medium text-slate-400 ml-1">
                  tokens
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            ${aiSummary.estimatedCost.toFixed(2)}/ngày · $
            {aiSummary.monthlyCost.toFixed(2)}/tháng · {aiSummary.activeUsers}{" "}
            users
          </p>
        </div>

        {/* KPI 8 */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Lưu trữ &amp; Audio R2
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {formatStorageSize(dbOverview?.estimatedSubmissionDataKb ?? 0)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {dbOverview?.totalAttempts ?? 0} lượt thi ·{" "}
            {dbOverview?.totalSubmissionAudioFiles ?? 0} audio ·{" "}
            {dbOverview?.totalAiEvaluations ?? 0} chấm AI
          </p>
        </div>
      </div>

      {/* 4. 4 Rich Visual Charts Grid (2x2) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: 7-Day Submission & Grading BarChart */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Nộp &amp; chấm bài (7 ngày)
            </h2>
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 tabular-nums">
              {weeklyTotals.totalSub} bài nộp
            </span>
          </div>

          <div className="h-64 w-full">
            {weeklyTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                Chưa có dữ liệu 7 ngày qua
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyTrend}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
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
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar
                    dataKey="submissions"
                    name="Đã nộp"
                    fill="#1d4ed8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="graded"
                    name="Đã chấm"
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tổng nộp
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                {weeklyTotals.totalSub}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                TB / ngày
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                {weeklyTotals.avgPerDay}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Đã chấm
              </p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {weeklyTotals.totalGraded}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Chưa chấm
              </p>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {weeklyTotals.pendingInWeek}
              </p>
            </div>
          </div>
        </div>

        {/* Chart 2: 4-Skill Radar Chart + Progress Breakdown */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Điểm TB 4 kỹ năng
            </h2>
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 tabular-nums">
              TB: {overallSkillAvg} / 10
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="72%" data={skillChartData}>
                  <PolarGrid stroke="#cbd5e1" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 10]}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                  />
                  <Radar
                    name="Điểm TB"
                    dataKey="score"
                    stroke="#1d4ed8"
                    fill="#1d4ed8"
                    fillOpacity={0.22}
                    strokeWidth={2}
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
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="md:col-span-6 space-y-3.5">
              {skillChartData.map((skill) => {
                const IconComp = skill.icon;
                const widthPct = Math.min(100, Math.max(0, skill.score * 10));
                const levelText =
                  skill.score >= 8
                    ? "Tốt"
                    : skill.score >= 6.5
                      ? "Khá"
                      : skill.score > 0
                        ? "Cần cải thiện"
                        : "Chưa có";
                return (
                  <div key={skill.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                        <IconComp
                          className="w-3.5 h-3.5"
                          style={{ color: skill.color }}
                        />
                        {skill.label}
                      </span>
                      <span className="tabular-nums font-bold text-slate-900 dark:text-white">
                        {skill.score.toFixed(1)}
                        <span className="text-slate-400 font-normal ml-1">
                          · {levelText}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: skill.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 3: Class Status Donut Pie + CEFR Level Breakdown */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Trạng thái lớp &amp; CEFR
            </h2>
            <PieChartIcon className="w-5 h-5 text-slate-400 shrink-0" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-6 h-56 relative">
              {classStatusData.every((d) => d.value === 0) ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  Chưa có lớp học
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {classStatusData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
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
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="md:col-span-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {classStatusData.map((st) => (
                  <div
                    key={st.key}
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                  >
                    <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: st.color }}
                      />
                      <span className="truncate">{st.name}</span>
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums ml-1">
                      {st.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Theo trình độ CEFR
                </p>
                {levelDistribution.length === 0 ? (
                  <p className="text-xs text-slate-400">Chưa có dữ liệu</p>
                ) : (
                  <div className="space-y-1.5">
                    {levelDistribution.slice(0, 5).map((lv) => (
                      <div key={lv.level} className="space-y-1">
                        <div className="flex justify-between text-xs tabular-nums">
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {lv.level}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {lv.count} lớp ({lv.percent}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${lv.percent}%`,
                              backgroundColor: lv.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chart 4: Completion Distribution + Top Classroom Activity BarChart */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Hoàn thành &amp; Top lớp học
            </h2>
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 tabular-nums">
              {completionBuckets.total} HV
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {completionBuckets.items.map((bucket) => (
              <div
                key={bucket.key}
                className={`px-3 py-2 rounded-lg border ${bucket.badgeCls}`}
              >
                <p className="text-[11px] font-medium truncate">
                  {bucket.label}
                </p>
                <div className="flex items-baseline justify-between mt-1 tabular-nums">
                  <span className="text-lg font-bold">{bucket.count}</span>
                  <span className="text-xs font-semibold">{bucket.percent}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="h-52 w-full">
            {classroomComparisonData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                Chưa có dữ liệu
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={classroomComparisonData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
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
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar
                    dataKey="students"
                    name="Sĩ số"
                    fill="#0284c7"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />
                  <Bar
                    dataKey="attempts"
                    name="Lượt thi/nộp"
                    fill="#1d4ed8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 5. Bottom Operational Section: Classroom Operations Table + Recent Audit Logs & Quick Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Operating Classrooms Table */}
        <div className="xl:col-span-8 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Danh sách lớp học
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {filteredClassrooms.length} / {mergedClassrooms.length} lớp
                </p>
              </div>
              <Link
                to="/admin/classrooms"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
              >
                Xem tất cả
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Tìm lớp, GV, trình độ..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "ALL", label: "Tất cả" },
                  { id: "IN_PROGRESS", label: "Đang dạy" },
                  { id: "OPEN", label: "Tuyển sinh" },
                  { id: "COMPLETED", label: "Hoàn thành" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setClassStatusFilter(tab.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      classStatusFilter === tab.id
                        ? "bg-blue-700 text-white border-blue-700"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-semibold">Lớp học</th>
                  <th className="py-3 px-4 font-semibold">Trạng thái</th>
                  <th className="py-3 px-4 font-semibold">Giảng viên</th>
                  <th className="py-3 px-4 font-semibold">Sĩ số</th>
                  <th className="py-3 px-4 font-semibold text-right">
                    Lượt thi / ĐTB
                  </th>
                  <th className="py-3 px-4 font-semibold text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredClassrooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-slate-400 text-sm"
                    >
                      Không có lớp phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredClassrooms.slice(0, 8).map((cls) => {
                    const statusInfo = CLASS_STATUS_META[cls.status] ?? {
                      label: cls.status,
                      color: "#64748b",
                      badgeCls:
                        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                    };
                    const fillPct =
                      cls.maxStudents > 0
                        ? Math.min(
                            100,
                            Math.round((cls.studentCount / cls.maxStudents) * 100),
                          )
                        : 0;

                    return (
                      <tr
                        key={cls.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {cls.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300">
                              {cls.level}
                            </span>
                            <span>
                              {cls.lessonCount} bài · {cls.assignmentCount} BT ·{" "}
                              {cls.examCount} thi
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${statusInfo.badgeCls}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          {cls.teacherName}
                        </td>

                        <td className="py-3 px-4 min-w-[120px]">
                          <div className="flex items-center justify-between text-xs tabular-nums mb-1">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {cls.studentCount}
                              {cls.maxStudents > 0 ? `/${cls.maxStudents}` : ""} HV
                            </span>
                            {cls.maxStudents > 0 && (
                              <span className="text-slate-400">{fillPct}%</span>
                            )}
                          </div>
                          {cls.maxStudents > 0 && (
                            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-700"
                                style={{ width: `${fillPct}%` }}
                              />
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right tabular-nums">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {cls.attemptCount} lượt
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            ĐTB:{" "}
                            {formatScore10(cls.averageScore, "—")}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleOpenClassPreview(cls.id)}
                              title="Xem báo cáo"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Xem
                            </button>
                            <button
                              type="button"
                              disabled={exportingClassId === cls.id}
                              onClick={() =>
                                void handleExportClassroomExcel(cls.id, cls.name)
                              }
                              title="Xuất Excel"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
                            >
                              {exportingClassId === cls.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              )}
                              Excel
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

        {/* Right: Recent Audit Logs & Quick Operations */}
        <div className="xl:col-span-4 space-y-6">
          {/* Recent Audit Logs */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Nhật ký gần đây
                </h2>
              </div>
              <Link
                to="/admin/audit-logs"
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
              >
                Chi tiết
              </Link>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                Chưa có nhật ký.
              </p>
            ) : (
              <div className="space-y-2.5">
                {auditLogs.slice(0, 5).map((log) => {
                  const meta = parseAuditActionMeta(log);
                  return (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate max-w-[170px] ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-1">
                        {meta.detail}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {log.userName || log.userId || "Hệ thống"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions & Curriculum Links */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Thao tác nhanh
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
              <Link
                to="/admin/classrooms"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <Plus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  Tạo &amp; xếp lớp mới
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                to="/admin/teachers"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Phân công giảng viên
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                to="/admin/students"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Quản lý học viên
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                to="/admin/broadcast"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Phát thông báo
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                to="/admin/database"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <Database className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  CSDL &amp; Cloud R2
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                to="/admin/reports"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  Xuất báo cáo Excel
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Classroom Detailed Report Preview Modal */}
      <ClassroomReportPreviewModal
        report={previewReport}
        loading={previewLoading}
        exporting={exportingClassId !== null}
        onClose={() => {
          setPreviewReport(null);
          setPreviewLoading(false);
        }}
        onDownloadExcel={(classId, className) =>
          void handleExportClassroomExcel(classId, className)
        }
      />
    </div>
  );
}

export default AdminDashboardPage;
