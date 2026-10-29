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
  Sparkles,
} from "lucide-react";
import { Card, Badge, Button, EmptyState, SkeletonCard } from "@/components/ui";

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
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 dark:bg-slate-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
            <Sparkles size={12} className="text-blue-700 dark:text-blue-400" />
            <span>Học Tập &amp; Lộ Trình</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mt-2">
            Không Gian Khóa Học
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi giáo trình bài giảng và hoàn thành bài tập theo lộ trình hàng ngày (Daily Plan).
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white dark:bg-[#0e1526] border border-slate-200 dark:border-slate-800 px-5 py-3 rounded-xl shadow-card min-w-[120px] text-center">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Đang tham gia
            </span>
            <span className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-0.5 block font-mono tabular-nums">
              {activeCoursesCount}{" "}
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">lớp</span>
            </span>
          </div>
          <div className="bg-white dark:bg-[#0e1526] border border-slate-200 dark:border-slate-800 px-5 py-3 rounded-xl shadow-card min-w-[120px] text-center">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Tiến độ trung bình
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block font-mono tabular-nums">
              {avgProgress}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. COURSE LIST SECTION */}
      {courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} />}
          title="Bạn chưa tham gia lớp học nào"
          description="Vui lòng liên hệ giảng viên hoặc phòng đào tạo để được ghi danh vào lớp học tương ứng."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <BookOpen size={14} className="text-blue-700 dark:text-blue-400" />
              Khóa học đang hoạt động ({courses.length})
            </h2>
          </div>

          {courses.map((course) => {
            const progress = course.progressPercentage || 0;
            const teacherInitial = course.teacherName
              ? course.teacherName.trim().charAt(0).toUpperCase()
              : "T";

            return (
              <Card
                key={course.classId}
                hoverable
                className="p-5 sm:p-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* CỘT TRÁI: THÔNG TIN LỚP & GIẢNG VIÊN */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary" size="sm">
                        {course.level || "GENERAL"}
                      </Badge>
                      <Badge variant="success" size="sm" dot>
                        {course.status || "Đang học"}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors truncate">
                        {course.className}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center shrink-0">
                          {teacherInitial}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          Giảng viên:{" "}
                          <strong className="text-slate-900 dark:text-slate-100 font-semibold">
                            {course.teacherName || "Chưa phân công"}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        Ghi danh:{" "}
                        <span className="font-medium text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                          {new Date(course.enrolledAt).toLocaleDateString("vi-VN")}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* CỘT GIỮA: THANH TIẾN ĐỘ THỜI GIAN HIỆN TẠI */}
                  <div className="lg:w-64 space-y-2 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <TrendingUp size={13} className="text-blue-700 dark:text-blue-400" />
                        Tiến độ khóa học
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                        {progress}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-800 transition-all duration-500"
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

                  {/* CỘT PHẢI: HÀNH ĐỘNG */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800/80">
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() =>
                        navigate(`/student/courses/${course.classId}/daily-plan`)
                      }
                      leftIcon={<Calendar size={14} />}
                    >
                      Lộ Trình Ngày (Daily Plan)
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        navigate(`/student/courses/${course.classId}/lessons`)
                      }
                      leftIcon={<BookOpen size={14} />}
                      rightIcon={<ArrowRight size={13} />}
                    >
                      Bài giảng
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
