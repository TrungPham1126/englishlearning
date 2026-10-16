// src/features/student/pages/StudentCoursesPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
import type { MyCourseResponse } from "@/features/student/types";
import {
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<MyCourseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    studentApi
      .getMyCourses()
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Lỗi khi tải danh sách khóa học:", err);
        setCourses([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">
          Đang nạp dữ liệu khóa học...
        </span>
      </div>
    );
  }

  const activeCoursesCount = courses.length;
  const avgProgress =
    courses.length > 0
      ? Math.round(
          courses.reduce((acc, c) => acc + (c.progressPercentage || 0), 0) /
            courses.length,
        )
      : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* 1. HERO HEADER & QUICK METRICS */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-7 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles size={12} className="text-indigo-400" />
              <span>Học Tập & Tiến Trình</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Không Gian Lớp Học
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Theo dõi giáo trình bài giảng và hoàn thành bài tập theo lộ trình
              hàng ngày (Daily Plan).
            </p>
          </div>
          {/* Quick Stats Badges */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10 min-w-[110px] text-center">
              <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wider block">
                Đang tham gia
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {activeCoursesCount}{" "}
                <span className="text-xs font-normal text-slate-400">lớp</span>
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10 min-w-[110px] text-center">
              <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wider block">
                Tiến độ
              </span>
              <span className="text-xl font-black text-emerald-400 mt-0.5 block">
                {avgProgress}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. COURSE LIST SECTION */}
      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto">
            <AlertCircle size={26} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Bạn chưa tham gia lớp học nào
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Vui lòng liên hệ giảng viên để được ghi danh vào lớp.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <BookOpen size={14} className="text-indigo-600" />
              Khóa học đang hoạt động ({courses.length})
            </h2>
          </div>
          {courses.map((course) => {
            const progress = course.progressPercentage || 0;
            const teacherInitial = course.teacherName
              ? course.teacherName.trim().charAt(0).toUpperCase()
              : "T";
            return (
              <div
                key={course.classId}
                className="group relative bg-white border border-slate-200/90 hover:border-indigo-300/80 rounded-2xl p-6 transition-all duration-200 hover:shadow-md hover:shadow-slate-200/50"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* CỘT TRÁI: THÔNG TIN LỚP & GIẢNG VIÊN */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase tracking-wide">
                        {course.level || "GENERAL"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {course.status || "Đang học"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {course.className}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center">
                          {teacherInitial}
                        </div>
                        <p className="text-xs text-slate-600">
                          Giảng viên phụ trách:{" "}
                          <strong className="text-slate-800 font-semibold">
                            {course.teacherName || "Chưa phân công"}
                          </strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        Ghi danh:{" "}
                        <span className="font-medium text-slate-600">
                          {new Date(course.enrolledAt).toLocaleDateString(
                            "vi-VN",
                          )}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* CỘT GIỮA: THANH TIẾN ĐỘ THỜI GIAN HIỆN TẠI */}
                  <div className="lg:w-64 space-y-2 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                        <TrendingUp size={13} className="text-indigo-600" />
                        Tiến độ khóa học
                      </span>
                      <span className="font-bold text-slate-900">
                        {progress}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(progress, 3)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block text-right font-medium">
                      {progress === 100
                        ? "Đã hoàn thành khóa học"
                        : progress > 0
                          ? "Đang học theo lộ trình"
                          : "Chưa bắt đầu"}
                    </span>
                  </div>

                  {/* CỘT PHẢI: HÀNH ĐỘNG (CHỈ CÒN BÀI TẬP HÀNG NGÀY & BÀI GIẢNG) */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/student/courses/${course.classId}/daily-plan`,
                        )
                      }
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/90 border border-indigo-200/90 transition-all cursor-pointer shadow-2xs"
                    >
                      <Calendar size={15} className="text-indigo-600" />
                      <span>Bài Tập Hàng Ngày (Daily Plan)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/student/courses/${course.classId}/lessons`)
                      }
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-indigo-600 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-indigo-500/25"
                    >
                      <BookOpen size={14} />
                      <span>Bài giảng</span>
                      <ArrowRight
                        size={13}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
