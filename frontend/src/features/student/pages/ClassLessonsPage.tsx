// src/features/student/pages/ClassLessonsPage.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "../api/studentApi";
import type { LessonSummary } from "../types";
import { PlayCircle, ArrowLeft, CheckCircle2, Clock } from "lucide-react";

export default function ClassLessonsPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLessons = () => {
    if (classId) {
      studentApi
        .getClassLessons(classId)
        .then(setLessons)
        .finally(() => setLoading(false));
    }
  };

  const lastFocusFetchTimeRef = useRef(0);

  useEffect(() => {
    fetchLessons();

    // Lắng nghe sự kiện cập nhật tiến độ từ video hoặc bài tập
    const handleProgressUpdate = () => fetchLessons();
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusFetchTimeRef.current > 30000) {
        lastFocusFetchTimeRef.current = now;
        fetchLessons();
      }
    };

    window.addEventListener("student-progress-updated", handleProgressUpdate);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("student-progress-updated", handleProgressUpdate);
      window.removeEventListener("focus", handleFocus);
    };
  }, [classId]);

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tải danh sách bài học...
      </div>
    );

  const completedCount = lessons.filter(
    (l) => l.completed || l.isCompleted || (l.progressPercentage ?? 0) >= 100
  ).length;

  return (
    <div className="space-y-6">
      {/* Clean Open Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate("/student/courses")}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              Lộ Trình Bài Học
            </h1>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">
              Lựa chọn bài học để phát video bài giảng HLS và tài liệu đi kèm
            </p>
          </div>
        </div>

        {lessons.length > 0 && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-3.5 py-1.5 text-xs font-bold text-blue-800 dark:text-blue-300">
            <span>Tiến độ hoàn thành:</span>
            <span className="text-blue-700 dark:text-blue-400 font-extrabold">
              {completedCount}/{lessons.length} bài
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        {lessons.map((lesson, idx) => {
          const isDone =
            lesson.completed ||
            lesson.isCompleted ||
            (lesson.progressPercentage ?? 0) >= 100;
          const prog = Math.min(100, Math.max(0, lesson.progressPercentage ?? (isDone ? 100 : 0)));
          const isStarted = prog > 0;

          return (
            <div
              key={lesson.id}
              onClick={() => navigate(`/student/lessons/${lesson.id}`)}
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm transition hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-md cursor-pointer gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                    isDone
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                      : isStarted
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                  }`}
                >
                  {isDone ? <CheckCircle2 size={20} /> : idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-950 dark:text-white truncate">
                      {lesson.title}
                    </h3>
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        <CheckCircle2 size={11} /> Đã hoàn thành
                      </span>
                    ) : isStarted ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        <Clock size={11} /> Đang học ({prog}%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-[10px] font-bold">
                        Chưa học
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-1 mt-0.5">
                    {lesson.objectives || "Xem video bài giảng, ngữ pháp và từ vựng"}
                  </p>

                  {/* Thanh tiến độ thật của từng bài học */}
                  {isStarted && !isDone && (
                    <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 shrink-0 self-end sm:self-center">
                <PlayCircle size={18} />
                <span>{isDone ? "Xem lại" : isStarted ? "Học tiếp" : "Vào học"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
