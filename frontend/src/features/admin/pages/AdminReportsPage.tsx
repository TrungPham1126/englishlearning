// src/features/admin/pages/AdminReportsPage.tsx
import { useEffect, useState } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { AdminDashboardStats, ClassroomResponse } from "@/features/admin/types";
import type { UserSummaryDto } from "@/types/api";
import {
  Loader2,
  BarChart3,
  Users,
  GraduationCap,
  School,
  FileText,
  Printer,
  TrendingUp,
  Award,
  Layers,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  PieChart,
  Headphones,
  Mic,
  BookOpen,
  PenTool,
} from "lucide-react";

export default function AdminReportsPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [classes, setClasses] = useState<ClassroomResponse[]>([]);
  const [teachers, setTeachers] = useState<UserSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [statsRes, classRes, usersRes] = await Promise.all([
          adminApi.getDashboardStats(),
          adminApi.getClassrooms(0, 100),
          adminApi.getUsers(0, 100, "ROLE_TEACHER"),
        ]);
        setStats(statsRes);
        setClasses(classRes.content);
        setTeachers(usersRes.content);
      } catch (err) {
        console.error("Lỗi tải dữ liệu báo cáo", err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500">
        <Loader2 className="animate-spin text-blue-700 mb-3" size={36} />
        <p className="text-sm font-semibold">Đang tổng hợp báo cáo trung tâm...</p>
      </div>
    );
  }

  // Phân tích phân bổ theo CEFR level
  const levelCounts: Record<string, { classCount: number; studentCount: number }> = {
    A1: { classCount: 0, studentCount: 0 },
    A2: { classCount: 0, studentCount: 0 },
    B1: { classCount: 0, studentCount: 0 },
    B2: { classCount: 0, studentCount: 0 },
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

  const totalEnrolledInClasses = classes.reduce((sum, c) => sum + (c.currentStudentsCount || 0), 0);

  // Dữ liệu thật từ Backend API
  const completionDist = stats?.completionDistribution || { high: 0, medium: 0, low: 0 };
  const hasSubmissions = (stats?.totalSubmissions || 0) > 0;

  const rawSkillScores = stats?.averageSkillScores || {};
  const skillList = [
    {
      key: "Listening",
      name: "Nghe (Listening)",
      icon: Headphones,
      score: rawSkillScores["Listening"] ?? 0,
      color: "text-sky-600 dark:text-sky-400",
      barColor: "bg-sky-500",
    },
    {
      key: "Speaking",
      name: "Nói (Speaking)",
      icon: Mic,
      score: rawSkillScores["Speaking"] ?? 0,
      color: "text-rose-600 dark:text-rose-400",
      barColor: "bg-rose-500",
    },
    {
      key: "Reading",
      name: "Đọc (Reading)",
      icon: BookOpen,
      score: rawSkillScores["Reading"] ?? 0,
      color: "text-blue-600 dark:text-blue-400",
      barColor: "bg-blue-600",
    },
    {
      key: "Writing",
      name: "Viết (Writing)",
      icon: PenTool,
      score: rawSkillScores["Writing"] ?? 0,
      color: "text-amber-600 dark:text-amber-400",
      barColor: "bg-amber-500",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200 pb-12">
      {/* 1. CLEAN OPEN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Báo Cáo Hoạt Động & Đào Tạo Trung Tâm
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tổng hợp dữ liệu học viên, phân bổ cấp độ CEFR, tải giảng dạy của giáo viên và tiến độ đào tạo thực tế.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-blue-800 hover:bg-blue-900 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer text-xs"
        >
          <Printer size={16} /> In Báo Cáo
        </button>
      </div>

      {/* 2. CENTER HIGH-LEVEL SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Học viên toàn hệ thống
          </span>
          <span className="text-3xl font-black text-slate-900 dark:text-white block mt-2">
            {stats?.totalStudents || 0}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {totalEnrolledInClasses} lượt ghi danh lớp
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Đội ngũ Giảng viên
          </span>
          <span className="text-3xl font-black text-blue-700 dark:text-blue-400 block mt-2">
            {stats?.totalTeachers || 0}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            Phụ trách {classes.length} lớp học
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Lớp đang giảng dạy
          </span>
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block mt-2">
            {stats?.inProgressClasses || 0}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {stats?.openClasses || 0} lớp đang tuyển sinh
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Lượt nộp bài tập
          </span>
          <span className="text-3xl font-black text-sky-600 dark:text-sky-400 block mt-2">
            {stats?.totalSubmissions || 0}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {stats?.pendingGrading || 0} bài chờ chấm
          </span>
        </div>
      </div>

      {/* 3. PHÂN BỐ TIẾN ĐỘ HOÀN THÀNH & ĐIỂM KỸ NĂNG THẬT TỪ DATABASE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Phân bố mức độ hoàn thành nhiệm vụ */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart size={18} className="text-blue-700 dark:text-blue-400" /> Phân Bố Mức Hoàn Thành
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                Dữ liệu thực tế
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-4">
              Tỷ lệ % học viên đạt mức hoàn thành nhiệm vụ và bài nộp theo các ngưỡng
            </p>

            <div className="space-y-4">
              {/* Cao >= 80% */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Xuất sắc (≥ 80%)
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">
                    {completionDist.high.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-emerald-200/60 dark:bg-emerald-900/50 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, completionDist.high))}%` }}
                  />
                </div>
              </div>

              {/* Trung bình 50 - 79% */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Trung bình (50% - 79%)
                  </span>
                  <span className="text-amber-700 dark:text-amber-400 font-extrabold text-sm">
                    {completionDist.medium.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-amber-200/60 dark:bg-amber-900/50 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, completionDist.medium))}%` }}
                  />
                </div>
              </div>

              {/* Thấp < 50% */}
              <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <HelpCircle size={14} /> Cần nhắc nhở (&lt; 50%)
                  </span>
                  <span className="text-rose-700 dark:text-rose-400 font-extrabold text-sm">
                    {completionDist.low.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-rose-200/60 dark:bg-rose-900/50 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, completionDist.low))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Tỷ lệ hoàn thành bình quân:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {stats?.completionRate ? `${stats.completionRate.toFixed(1)}%` : "100.0%"}
            </span>
          </div>
        </div>

        {/* Điểm kỹ năng trung bình toàn hệ thống */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Award size={18} className="text-blue-700 dark:text-blue-400" /> Điểm Kỹ Năng Trung Bình Toàn Hệ Thống
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                Thang 100 & CEFR
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-4">
              Tổng hợp điểm trung bình thực tế từ các bài làm đã nộp và đánh giá AI của học viên
            </p>

            <div className="space-y-4">
              {skillList.map((skill) => {
                const IconComp = skill.icon;
                const score100 = skill.score;
                const score10 = (score100 / 10).toFixed(1);
                const hasScore = score100 > 0;

                return (
                  <div key={skill.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <IconComp size={15} className={skill.color} />
                        <span>{skill.name}</span>
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-slate-900 dark:text-white font-black text-sm">
                          {hasScore ? `${score100.toFixed(1)}` : "0.0"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          pts ({hasScore ? `${score10}/10` : "0.0/10"})
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`${skill.barColor} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, Math.max(hasScore ? 5 : 0, score100))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Trạng thái dữ liệu đánh giá:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {hasSubmissions ? "Đã đồng bộ từ Database & AI" : "Chưa có bài nộp (Hiển thị 0.0 pts)"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. CEFR LEVEL DISTRIBUTION */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={18} className="text-blue-700 dark:text-blue-400" /> Phân Bổ Quy Mô Theo Trình Độ (CEFR Level)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Số lượng lớp và học viên đang theo học theo từng cấp độ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(levelCounts).map(([level, data]) => {
            const pct =
              totalEnrolledInClasses > 0
                ? Math.round((data.studentCount / totalEnrolledInClasses) * 100)
                : 0;
            return (
              <div
                key={level}
                className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2.5 py-1 rounded-lg">
                      {level}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{pct}%</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-4">
                    {data.studentCount}{" "}
                    <span className="text-xs font-semibold text-slate-500">học viên</span>
                  </div>
                  <span className="text-xs text-slate-500 block mt-1">
                    {data.classCount} lớp học
                  </span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-4">
                  <div
                    className="bg-blue-800 dark:bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(pct, 5)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. TEACHER WORKLOAD ROSTER */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap size={18} className="text-blue-700 dark:text-blue-400" /> Báo Cáo Phân Công & Tải Giảng Dạy Của Giảng Viên
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Danh sách giáo viên, các lớp phụ trách và tổng số học sinh đang theo học
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 pl-6">Giảng Viên</th>
                <th className="p-4">Email</th>
                <th className="p-4">Lớp Học Đang Phụ Trách</th>
                <th className="p-4 text-center">Tổng Học Sinh</th>
                <th className="p-4 pr-6 text-center">Tải Giảng Dạy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {teachers.map((teacher) => {
                const assigned = classes.filter((c) => c.teacherId === teacher.id);
                const totalStudents = assigned.reduce(
                  (sum, c) => sum + (c.currentStudentsCount || 0),
                  0,
                );
                return (
                  <tr key={teacher.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition">
                    <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white">
                      {teacher.lastName} {teacher.firstName}
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {teacher.email}
                    </td>
                    <td className="p-4">
                      {assigned.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Chưa nhận lớp</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {assigned.map((cls) => (
                            <span
                              key={cls.id}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded text-xs font-semibold border border-slate-200 dark:border-slate-700"
                            >
                              {cls.name} ({cls.level})
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-900 dark:text-white">
                      {totalStudents}
                    </td>
                    <td className="p-4 pr-6 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                          assigned.length >= 3
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            : assigned.length > 0
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {assigned.length >= 3
                          ? "Tải cao"
                          : assigned.length > 0
                            ? "Bình thường"
                            : "Sẵn sàng nhận lớp"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
