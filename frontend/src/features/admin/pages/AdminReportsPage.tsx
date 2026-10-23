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
        <Loader2 className="animate-spin text-indigo-600 mb-3" size={36} />
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200 pb-12">
      {/* 1. CLEAN OPEN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent print:hidden">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50 mb-2">
            <BarChart3 size={14} />
            <span>Báo Cáo Học Vụ & Hiệu Quả</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Báo Cáo Hoạt Động & Đào Tạo Trung Tâm
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tổng hợp dữ liệu học viên, phân bổ cấp độ CEFR, tải giảng dạy của giáo viên và tiến độ đào tạo.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer text-xs"
        >
          <Printer size={16} /> In Báo Cáo
        </button>
      </div>

      {/* 2. CENTER HIGH-LEVEL SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Học viên toàn hệ thống
          </span>
          <span className="text-3xl font-black text-slate-900 block mt-2">
            {stats?.totalStudents || 0}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {totalEnrolledInClasses} lượt ghi danh lớp
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Đội ngũ Giảng viên
          </span>
          <span className="text-3xl font-black text-indigo-600 block mt-2">
            {stats?.totalTeachers || 0}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            Phụ trách {classes.length} lớp học
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Lớp đang giảng dạy
          </span>
          <span className="text-3xl font-black text-emerald-600 block mt-2">
            {stats?.inProgressClasses || 0}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {stats?.openClasses || 0} lớp đang tuyển sinh
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Lượt nộp bài tập
          </span>
          <span className="text-3xl font-black text-sky-600 block mt-2">
            {stats?.totalSubmissions || 0}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {stats?.pendingGrading || 0} bài chờ chấm
          </span>
        </div>
      </div>

      {/* 3. CEFR LEVEL DISTRIBUTION */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers size={18} className="text-indigo-600" /> Phân Bổ Quy Mô Theo Trình Độ (CEFR Level)
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
                className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg">
                      {level}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{pct}%</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-4">
                    {data.studentCount}{" "}
                    <span className="text-xs font-semibold text-slate-500">học viên</span>
                  </div>
                  <span className="text-xs text-slate-500 block mt-1">
                    {data.classCount} lớp học
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-4">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(pct, 5)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. TEACHER WORKLOAD ROSTER */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <GraduationCap size={18} className="text-indigo-600" /> Báo Cáo Phân Công & Tải Giảng Dạy Của Giảng Viên
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Danh sách giáo viên, các lớp phụ trách và tổng số học sinh đang theo học
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-black border-b border-slate-200">
                <th className="p-4 pl-6">Giảng Viên</th>
                <th className="p-4">Email</th>
                <th className="p-4">Lớp Học Đang Phụ Trách</th>
                <th className="p-4 text-center">Tổng Học Sinh</th>
                <th className="p-4 pr-6 text-center">Tải Giảng Dạy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {teachers.map((teacher) => {
                const assigned = classes.filter((c) => c.teacherId === teacher.id);
                const totalStudents = assigned.reduce(
                  (sum, c) => sum + (c.currentStudentsCount || 0),
                  0,
                );
                return (
                  <tr key={teacher.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 pl-6 font-bold text-slate-900">
                      {teacher.lastName} {teacher.firstName}
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-600">
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
                              className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-xs font-semibold border border-slate-200"
                            >
                              {cls.name} ({cls.level})
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-900">
                      {totalStudents}
                    </td>
                    <td className="p-4 pr-6 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          assigned.length >= 3
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : assigned.length > 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500"
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

