// src/features/student/pages/StudentCoursesPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
import type { MyCourseResponse } from "@/features/student/types";
import {
  BookOpen,
  Calendar,
  ArrowRight,
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
      <div className="max-w-5xl mx-auto space-y-4 pb-10">
        <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 dark:text-slate-100">
            Lớp học
          </h1>
          {courses.length > 0 && (
            <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {courses.length}
            </span>
          )}
        </div>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} />}
          title="Chưa có lớp học"
          description="Bạn chưa được ghi danh vào lớp nào."
        />
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const progress = course.progressPercentage || 0;

            return (
              <Card
                key={course.classId}
                hoverable
                className="p-4 sm:p-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="primary" size="sm">
                        {course.level || "GENERAL"}
                      </Badge>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-slate-100 truncate">
                      {course.className}
                    </h2>
                    {course.teacherName && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate">
                        {course.teacherName}
                      </p>
                    )}
                  </div>

                  <div className="lg:w-48 flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-700 dark:bg-blue-500 transition-all duration-500"
                        style={{ width: `${Math.max(progress, 3)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums w-9 text-right">
                      {progress}%
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <Button
                      variant="subtle"
                      size="md"
                      className="min-h-[42px] touch-manipulation w-full sm:w-auto text-xs font-bold"
                      onClick={() =>
                        navigate(`/student/courses/${course.classId}/daily-plan`)
                      }
                      leftIcon={<Calendar size={15} />}
                    >
                      Lộ trình
                    </Button>

                    <Button
                      variant="primary"
                      size="md"
                      className="min-h-[42px] touch-manipulation w-full sm:w-auto text-xs font-bold"
                      onClick={() =>
                        navigate(`/student/courses/${course.classId}/lessons`)
                      }
                      leftIcon={<BookOpen size={15} />}
                      rightIcon={<ArrowRight size={14} />}
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
