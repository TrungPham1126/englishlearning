// src/features/student/pages/ClassLessonsPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "../api/studentApi";
import type { LessonSummary } from "../types";
import { PlayCircle, ArrowLeft, BookOpen } from "lucide-react";

export default function ClassLessonsPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (classId) {
      studentApi
        .getClassLessons(classId)
        .then(setLessons)
        .finally(() => setLoading(false));
    }
  }, [classId]);

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tải danh sách bài học...
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Clean Open Header */}
      <div className="flex items-center gap-3.5 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <button
          onClick={() => navigate("/student/courses")}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Lộ Trình Bài Học
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Lựa chọn bài học để phát video HLS và tài liệu đi kèm
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {lessons.map((lesson, idx) => (
          <div
            key={lesson.id}
            onClick={() => navigate(`/student/lessons/${lesson.id}`)}
            className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm transition hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-slate-900/50 font-bold text-blue-700 dark:text-blue-400">
                {idx + 1}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{lesson.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                  {lesson.objectives || "Xem video bài giảng và từ vựng"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
              <PlayCircle size={18} /> Vào học
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
