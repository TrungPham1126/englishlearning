// src/features/student/pages/ClassLessonsPage.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "../api/studentApi";
import type { LessonSummary } from "../types";
import { PlayCircle, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ClassLessonsPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchLessons = () => {
    if (classId) {
      studentApi
        .getClassLessons(classId)
        .then((data) => {
          if (isMountedRef.current) {
            setLessons(Array.isArray(data) ? data : []);
          }
        })
        .catch((err) => {
          console.error("Lỗi danh sách bài học:", err);
        })
        .finally(() => {
          if (isMountedRef.current) {
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
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
      <div className="p-8 text-center text-sm text-slate-500">
        Đang tải...
      </div>
    );

  const completedCount = lessons.filter(
    (l) => l.completed || l.isCompleted || (l.progressPercentage ?? 0) >= 100
  ).length;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/student/courses")}
            aria-label="Quay lại danh sách lớp"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            Bài giảng
          </h1>
        </div>

        {lessons.length > 0 && (
          <span className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-3 py-1 text-xs font-bold tabular-nums text-blue-700 dark:text-blue-300">
            {completedCount}/{lessons.length}
          </span>
        )}
      </div>

      <div className="grid gap-2.5">
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
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 transition hover:border-blue-400 dark:hover:border-blue-700 cursor-pointer gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm tabular-nums ${
                    isDone
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                      : isStarted
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {isDone ? <CheckCircle2 size={18} /> : idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-950 dark:text-white truncate">
                      {lesson.title}
                    </h2>
                    {isStarted && !isDone && (
                      <span className="text-[11px] font-bold tabular-nums text-blue-700 dark:text-blue-400 shrink-0">
                        {prog}%
                      </span>
                    )}
                  </div>
                  {lesson.objectives && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {lesson.objectives}
                    </p>
                  )}

                  {isStarted && !isDone && (
                    <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 shrink-0 self-end sm:self-center">
                <PlayCircle size={17} />
                <span>{isDone ? "Xem lại" : isStarted ? "Học tiếp" : "Học"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
