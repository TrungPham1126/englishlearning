// src/features/teacher/pages/TeacherClassStudentsPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { teacherApi } from "../api/teacherApi";
import ClassroomHeaderNav from "../components/ClassroomHeaderNav";
import { StudentLearningProfileModal } from "../components/students/StudentLearningProfileModal";
import { formatScore10, normalizeScoreTo10OrZero } from "@/utils/scoreScale";
import {
  Search,
  AlertTriangle,
  Cpu,
  Ban,
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
        // Map cả DTO phẳng (StudentProgressResponse) lẫn nested entity nếu có
        const mapped = rawData.map((item: any) => {
          const resolvedStudentId = item.studentId || item.student?.id || item.id;
          const quotaInfo = quotas.find(
            (q: any) => q.studentId === resolvedStudentId,
          ) || { dailyUsed: 0, dailyLimit: 20, isBlocked: false };
          const resolvedName =
            item.fullName ||
            (item.student?.user
              ? `${item.student.user.firstName} ${item.student.user.lastName}`.trim()
              : "Học viên");
          const resolvedEnrolled =
            item.enrolledAt && item.enrolledAt !== "N/A"
              ? (() => {
                  const d = new Date(item.enrolledAt);
                  return Number.isNaN(d.getTime())
                    ? item.enrolledAt
                    : d.toLocaleDateString("vi-VN");
                })()
              : "N/A";
          return {
            studentId: resolvedStudentId,
            fullName: resolvedName || "Học viên",
            email: item.email || item.student?.user?.email || "N/A",
            phone: item.phone || item.student?.user?.phone || "N/A",
            enrolledAt: resolvedEnrolled,
            completedTasks: item.completedTasks || 0,
            totalTasks: item.totalTasks || 0,
            completionRate: item.completionRate || 0,
            averageScore: normalizeScoreTo10OrZero(item.averageScore),
            weaknesses: item.weaknesses || [],
            aiQuota: quotaInfo,
            attendanceScore: item.attendanceScore || 0,
            totalStudyMinutes: item.totalStudyMinutes || 0,
            dailyProgressDetails: Array.isArray(item.dailyProgressDetails)
              ? item.dailyProgressDetails.map((d: any) => ({
                  ...d,
                  score: normalizeScoreTo10OrZero(d?.score),
                }))
              : [],
          };
        });
        setStudents(mapped);
        setSelectedStudent((prev: any) =>
          prev
            ? mapped.find((m: any) => m.studentId === prev.studentId) || prev
            : null,
        );
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

  const scoredStudents = students.filter(
    (s) =>
      normalizeScoreTo10OrZero(s.averageScore) > 0 || (s.completedTasks || 0) > 0,
  );
  const avgClassScore =
    scoredStudents.length > 0
      ? (
          scoredStudents.reduce(
            (acc, s) => acc + normalizeScoreTo10OrZero(s.averageScore),
            0,
          ) / scoredStudents.length
        ).toFixed(1)
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
              Sĩ số
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
              Hoàn thành TB
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
              Điểm TB
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
              Cảnh báo AI
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
            placeholder="Tìm tên, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 text-xs">
          {[
            { id: "ALL", label: `Tất cả (${students.length})` },
            { id: "ACTIVE", label: "Tiến độ tốt" },
            { id: "AT_RISK", label: "Cần hỗ trợ" },
            { id: "AI_LIMIT", label: "Cảnh báo AI" },
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
          <span className="text-xs font-medium">Đang tải...</span>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
          <Users className="h-10 w-10 mx-auto mb-2.5 text-slate-300 dark:text-slate-700" />
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
            Không có học viên phù hợp.
          </p>
        </div>
      ) : viewMode === "TABLE" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300 min-w-[760px]">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4">Học viên</th>
                  <th className="px-6 py-4 text-center">Tiến độ</th>
                  <th className="px-6 py-4 text-center">Điểm TB</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-center">Quota AI</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
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
                              Vào lớp: {student.enrolledAt}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-block w-40 text-left">
                          <div className="flex justify-between text-[11px] mb-1.5">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                              {student.completedTasks}/{student.totalTasks} bài
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
                          {formatScore10(student.averageScore)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {student.completionRate >= 75 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Tích cực
                          </span>
                        ) : student.completionRate >= 40 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            <Clock className="h-3 w-3" /> Đang học
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                            <AlertTriangle className="h-3 w-3" /> Cần nhắc
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {student.aiQuota.isBlocked ? (
                          <span className="inline-flex items-center text-[11px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-2.5 py-1 rounded-lg font-extrabold uppercase">
                            <Ban className="w-3.5 h-3.5 mr-1" /> Khóa AI
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
                          <span>Hồ sơ</span>
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
                    {formatScore10(student.averageScore)} đ
                  </span>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-slate-400">
                        Tiến độ ({student.completedTasks}/{student.totalTasks})
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
                        Quota AI
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
                  Xem hồ sơ
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedStudent && classId && (
        <StudentLearningProfileModal
          classId={classId}
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onGradeUpdated={loadData}
        />
      )}
    </div>
  );
}
