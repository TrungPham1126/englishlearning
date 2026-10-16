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
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/student/courses")}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Lộ Trình Bài Học
          </h1>
          <p className="text-xs text-slate-500">
            Lựa chọn bài học để phát video HLS và tài liệu đi kèm
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {lessons.map((lesson, idx) => (
          <div
            key={lesson.id}
            onClick={() => navigate(`/student/lessons/${lesson.id}`)}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-600">
                {idx + 1}
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{lesson.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {lesson.objectives || "Xem video bài giảng và từ vựng"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
              <PlayCircle size={18} /> Vào học
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
