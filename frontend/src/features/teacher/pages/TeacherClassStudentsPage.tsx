// src/features/teacher/pages/TeacherClassStudentsPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { teacherApi } from "../api/teacherApi";
import ClassroomHeaderNav from "../components/ClassroomHeaderNav";
import {
  Search,
  AlertTriangle,
  Sparkles,
  X,
  Cpu,
  Ban,
  Check,
  Users,
  Award,
  TrendingUp,
  Clock,
  CheckCircle2,
  Eye,
  LayoutGrid,
  List,
  Loader2,
} from "lucide-react";

export default function TeacherClassStudentsPage() {
  const { classId } = useParams<{ classId: string }>();
  const [students, setStudents] = useState<any[]>([]);
  const [, setAiQuotas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "AT_RISK" | "AI_LIMIT">("ALL");
  const [viewMode, setViewMode] = useState<"TABLE" | "GRID">("TABLE");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resStudents, resQuota]: any = await Promise.allSettled([
        teacherApi.getClassStudents(classId!),
        teacherApi.getAiQuotas(),
      ]);

      let quotas = [];
      if (resQuota.status === "fulfilled" && resQuota.value?.data) {
        quotas = resQuota.value.data?.data || [];
      }
      setAiQuotas(quotas);

      if (resStudents.status === "fulfilled" && resStudents.value?.data) {
        const rawData = resStudents.value.data?.data || [];
        // Map dữ liệu thật, mặc định 0 nếu BE chưa trả đủ progress
        const mapped = rawData.map((item: any) => {
          const quotaInfo = quotas.find(
            (q: any) => q.studentId === item.student?.id,
          ) || { dailyUsed: 0, dailyLimit: 20, isBlocked: false };
          return {
            studentId: item.student?.id || item.id,
            fullName: item.student?.user
              ? `${item.student.user.firstName} ${item.student.user.lastName}`
              : "Học viên",
            email: item.student?.user?.email || "N/A",
            phone: item.student?.user?.phone || "N/A",
            enrolledAt: item.enrolledAt
              ? new Date(item.enrolledAt).toLocaleDateString("vi-VN")
              : "N/A",
            completedTasks: item.completedTasks || 0,
            totalTasks: item.totalTasks || 0,
            completionRate: item.completionRate || 0,
            averageScore: item.averageScore || 0,
            weaknesses: item.weaknesses || [],
            aiQuota: quotaInfo,
            attendanceScore: item.attendanceScore || 0,
            totalStudyMinutes: item.totalStudyMinutes || 0,
            dailyProgressDetails: item.dailyProgressDetails || [],
          };
        });
        setStudents(mapped);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách học sinh:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchSearch =
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchSearch) return false;

    const quotaPct =
      s.aiQuota?.dailyLimit > 0
        ? Math.round((s.aiQuota.dailyUsed / s.aiQuota.dailyLimit) * 100)
        : 0;

    if (statusFilter === "ACTIVE") return s.completionRate >= 50 && !s.aiQuota?.isBlocked;
    if (statusFilter === "AT_RISK") return s.completionRate < 50 || (s.weaknesses && s.weaknesses.length > 0);
    if (statusFilter === "AI_LIMIT") return s.aiQuota?.isBlocked || quotaPct >= 80;
    return true;
  });

  const avgCompletion =
    students.length > 0
      ? Math.round(students.reduce((acc, s) => acc + (s.completionRate || 0), 0) / students.length)
      : 0;

  const avgClassScore =
    students.length > 0
      ? (students.reduce((acc, s) => acc + Number(s.averageScore || 0), 0) / students.length).toFixed(1)
      : "0.0";

  const aiAlertCount = students.filter((s) => {
    const pct = s.aiQuota?.dailyLimit > 0 ? (s.aiQuota.dailyUsed / s.aiQuota.dailyLimit) * 100 : 0;
    return s.aiQuota?.isBlocked || pct >= 80;
  }).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Unified Classroom Header & Sub-Nav */}
      <ClassroomHeaderNav
        classId={classId!}
        activeTab="students"
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  viewMode === "TABLE"
                    ? "bg-blue-800 text-white"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span>Bảng</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("GRID")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  viewMode === "GRID"
                    ? "bg-blue-800 text-white"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Thẻ</span>
              </button>
            </div>
          </div>
        }
      />

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sĩ Số Lớp Học
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {students.length} <span className="text-xs font-semibold text-slate-400">học viên</span>
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-100 dark:border-blue-600/20 flex items-center justify-center text-blue-700 dark:text-blue-400">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-500/20 bg-white dark:bg-slate-900 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Tiến Độ Hoàn Thành TB
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {avgCompletion}%
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-sky-200/80 dark:border-sky-500/20 bg-white dark:bg-slate-900 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Điểm Trung Bình Lớp
            </span>
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
              {avgClassScore} <span className="text-xs font-semibold text-slate-400">/ 10</span>
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Award className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/20 bg-white dark:bg-slate-900 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Cảnh Báo Quota AI
            </span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {aiAlertCount} <span className="text-xs font-semibold text-slate-400">học viên</span>
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Cpu className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo họ tên hoặc email học viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 text-xs">
          {[
            { id: "ALL", label: `Tất cả (${students.length})` },
            { id: "ACTIVE", label: "Tiến độ tốt" },
            { id: "AT_RISK", label: "Cần kèm cặp" },
            { id: "AI_LIMIT", label: "Sắp hết Quota AI" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-700 dark:text-blue-400" />
          <span className="text-xs font-medium">Đang tải dữ liệu học viên &amp; AI Quota...</span>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
          <Users className="h-10 w-10 mx-auto mb-2.5 text-slate-300 dark:text-slate-700" />
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
            Không tìm thấy học viên nào phù hợp.
          </p>
        </div>
      ) : viewMode === "TABLE" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300 min-w-[760px]">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4">Học Viên</th>
                  <th className="px-6 py-4 text-center">Tiến Độ Bài Tập</th>
                  <th className="px-6 py-4 text-center">Điểm TB</th>
                  <th className="px-6 py-4 text-center">Trạng Thái Học Tập</th>
                  <th className="px-6 py-4 text-center">Hạn Ngạch AI (Hôm Nay)</th>
                  <th className="px-6 py-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60">
                {filteredStudents.map((student) => {
                  const used = student.aiQuota?.dailyUsed || 0;
                  const limit = student.aiQuota?.dailyLimit || 20;
                  const quotaPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                  const quotaBarColor =
                    student.aiQuota?.isBlocked || quotaPct >= 90
                      ? "bg-rose-500"
                      : quotaPct >= 70
                        ? "bg-amber-500"
                        : "bg-emerald-500";

                  return (
                    <tr
                      key={student.studentId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400 font-extrabold text-sm border border-blue-200/60 dark:border-blue-600/30">
                            {student.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {student.fullName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {student.email}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              Gia nhập: {student.enrolledAt}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-block w-40 text-left">
                          <div className="flex justify-between text-[11px] mb-1.5">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                              {student.completedTasks}/{student.totalTasks} nhiệm vụ
                            </span>
                            <span
                              className={`font-extrabold ${
                                student.completionRate >= 75
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : student.completionRate >= 40
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {student.completionRate}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                student.completionRate >= 75
                                  ? "bg-emerald-500"
                                  : student.completionRate >= 40
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                              }`}
                              style={{ width: `${student.completionRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center rounded-xl bg-blue-50 dark:bg-blue-600/10 px-3 py-1 text-sm font-black text-blue-700 dark:text-blue-400 border border-blue-200/70 dark:border-blue-600/20">
                          {student.averageScore}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {student.completionRate >= 75 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Tích cực
                          </span>
                        ) : student.completionRate >= 40 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            <Clock className="h-3 w-3" /> Đang theo học
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                            <AlertTriangle className="h-3 w-3" /> Cần nhắc nhở
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {student.aiQuota.isBlocked ? (
                          <span className="inline-flex items-center text-[11px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-2.5 py-1 rounded-lg font-extrabold uppercase">
                            <Ban className="w-3.5 h-3.5 mr-1" /> Đã khóa AI
                          </span>
                        ) : (
                          <div className="inline-block w-36 text-left">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                <Cpu className="w-3 h-3 text-blue-600" />
                                {used}/{limit} lượt
                              </span>
                              <span
                                className={`text-[10px] font-bold ${
                                  quotaPct >= 90
                                    ? "text-rose-600 dark:text-rose-400"
                                    : quotaPct >= 70
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {quotaPct}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${quotaBarColor}`}
                                style={{ width: `${quotaPct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-800 hover:border-blue-700 hover:text-white dark:hover:bg-blue-800 transition cursor-pointer shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Hồ sơ học tập</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Cards View for Students */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStudents.map((student) => {
            const used = student.aiQuota?.dailyUsed || 0;
            const limit = student.aiQuota?.dailyLimit || 20;
            const quotaPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            return (
              <div
                key={student.studentId}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400 font-black text-base border border-blue-200/60 dark:border-blue-600/30">
                      {student.fullName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {student.fullName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{student.email}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-xl bg-blue-50 dark:bg-blue-600/10 px-2.5 py-1 text-xs font-black text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-600/20">
                    {student.averageScore} đ
                  </span>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-slate-400">
                        Tiến độ ({student.completedTasks}/{student.totalTasks} bài)
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {student.completionRate}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          student.completionRate >= 75
                            ? "bg-emerald-500"
                            : student.completionRate >= 40
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${student.completionRate}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-slate-400">
                        Hạn ngạch AI hôm nay
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {used}/{limit} lượt ({quotaPct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          quotaPct >= 90 ? "bg-rose-500" : quotaPct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${quotaPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStudent(student)}
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-800 hover:text-white dark:hover:bg-blue-800 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  Xem Chi Tiết Tiến Độ
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-elevated space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-800/20 text-blue-700 dark:text-blue-400 font-extrabold text-lg border border-blue-200 dark:border-blue-600/30">
                  {selectedStudent.fullName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {selectedStudent.fullName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedStudent.email} • {selectedStudent.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Điểm TB
                </span>
                <span className="text-xl font-black text-blue-700 dark:text-blue-400">
                  {selectedStudent.averageScore} / 10
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Đã Nộp
                </span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {selectedStudent.completedTasks} / {selectedStudent.totalTasks}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  AI Limit (Hôm nay)
                </span>
                {selectedStudent.aiQuota.isBlocked ? (
                  <span className="text-base font-black text-rose-500 uppercase mt-1 block">
                    Bị Chặn
                  </span>
                ) : (
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {selectedStudent.aiQuota.dailyUsed}/{selectedStudent.aiQuota.dailyLimit}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Chuyên Cần
                </span>
                <span className="text-xl font-black text-amber-500 dark:text-amber-400">
                  {selectedStudent.attendanceScore || 0}%
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-center col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Tổng T.Gian
                </span>
                <span className="text-xl font-black text-sky-600 dark:text-cyan-400">
                  {Math.floor((selectedStudent.totalStudyMinutes || 0) / 60)}h{" "}
                  {(selectedStudent.totalStudyMinutes || 0) % 60}m
                </span>
              </div>
            </div>

            {selectedStudent.dailyProgressDetails &&
              selectedStudent.dailyProgressDetails.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-5 space-y-4">
                  <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Chi Tiết Tiến Độ Từng Ngày</span>
                    <span className="text-[11px] font-semibold normal-case text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg">
                      7 ngày gần nhất
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-xs font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Ngày</th>
                          <th className="px-4 py-3 text-center">Bài tập hoàn thành</th>
                          <th className="px-4 py-3 text-center">Thời gian học</th>
                          <th className="px-4 py-3 text-center">Điểm số trung bình</th>
                          <th className="px-4 py-3 text-right">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {selectedStudent.dailyProgressDetails.map(
                          (detail: any, index: number) => (
                            <tr
                              key={index}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                            >
                              <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                                {detail.date}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center bg-blue-50 dark:bg-blue-600/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-600/20 rounded-md px-2 py-0.5 text-xs font-bold min-w-[2rem]">
                                  {detail.completedTasks}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-sky-600 dark:text-cyan-400 font-medium">
                                {detail.studyMinutes} phút
                              </td>
                              <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                                {detail.score}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {detail.completedTasks > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                                    <Check size={14} /> Hoạt động
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-600 text-xs font-semibold">
                                    Vắng mặt
                                  </span>
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            <div className="rounded-xl border border-blue-200 dark:border-blue-600/20 bg-blue-50/50 dark:bg-blue-600/5 p-4 space-y-3">
              <div className="flex items-center text-xs font-bold text-blue-800 dark:text-blue-300">
                <Sparkles className="h-4 w-4 mr-1.5 text-blue-700 dark:text-blue-400" /> Điểm
                Yếu Cần Cải Thiện (AI Phân Tích)
              </div>
              {selectedStudent.weaknesses.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Học viên chưa có đủ dữ liệu để AI đánh giá.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStudent.weaknesses.map((w: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-center rounded-xl bg-white dark:bg-slate-900/80 px-3 py-2 text-xs border border-rose-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 font-medium"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-2 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedStudent(null)}
                className="rounded-xl bg-slate-100 dark:bg-slate-800 px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
