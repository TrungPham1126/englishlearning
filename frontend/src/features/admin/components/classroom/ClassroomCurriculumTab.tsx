import React, { useState } from "react";
import { Plus, Trash2, XCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ClassroomCurriculumTabProps {
  lessons: any[];
  isProcessing: boolean;
  onDeleteLesson: (lessonId: string) => void;
  onCreateLesson: (form: {
    title: string;
    objectives: string;
    content: string;
    orderIndex: number;
  }) => Promise<boolean>;
}

export const ClassroomCurriculumTab: React.FC<ClassroomCurriculumTabProps> = ({
  lessons,
  isProcessing,
  onDeleteLesson,
  onCreateLesson,
}) => {
  const navigate = useNavigate();
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [lessonForm, setLessonForm] = useState({
    title: "",
    objectives: "",
    content: "",
    orderIndex: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onCreateLesson(lessonForm);
    if (success) {
      setIsLessonModalOpen(false);
      setLessonForm({
        title: "",
        objectives: "",
        content: "",
        orderIndex: lessons.length + 2,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
            Cấu trúc Giáo trình
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tạo các bài giảng (Lesson) để giảng viên có thể tải lên Video và Từ vựng.
          </p>
        </div>
        <button
          onClick={() => {
            setLessonForm((prev) => ({ ...prev, orderIndex: lessons.length + 1 }));
            setIsLessonModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer text-sm"
        >
          <Plus size={16} /> Thêm Bài Giảng
        </button>
      </div>

      <div className="grid gap-3">
        {lessons.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400 text-sm font-semibold">
            Lớp học này chưa có bài giảng nào. Hãy bấm "Thêm Bài Giảng" để bắt đầu.
          </div>
        ) : (
          lessons.map((lesson, idx) => (
            <div
              key={lesson.id}
              onClick={() => navigate(`/admin/lessons/${lesson.id}`)}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-blue-400 dark:hover:border-blue-600/50 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-slate-900/60 text-blue-800 dark:text-blue-300 font-black flex items-center justify-center text-lg">
                  {lesson.orderIndex || idx + 1}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {lesson.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    {lesson.objectives || "Chưa có mục tiêu bài học"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLesson(lesson.id);
                  }}
                  className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition cursor-pointer"
                  title="Xóa bài giảng"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Thêm Bài Giảng */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-elevated w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                Tạo Bài Giảng Mới
              </h2>
              <button
                onClick={() => setIsLessonModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Thứ tự
                  </label>
                  <input
                    required
                    type="number"
                    value={lessonForm.orderIndex}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        orderIndex: Number(e.target.value),
                      })
                    }
                    className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên Bài Giảng
                  </label>
                  <input
                    required
                    type="text"
                    value={lessonForm.title}
                    onChange={(e) =>
                      setLessonForm({ ...lessonForm, title: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    placeholder="VD: Unit 1 - Introduction"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mục tiêu bài học (Objectives)
                </label>
                <textarea
                  rows={2}
                  value={lessonForm.objectives}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, objectives: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:border-blue-700 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  placeholder="VD: Học viên nắm được từ vựng chào hỏi cơ bản..."
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-blue-800 hover:bg-blue-700 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isProcessing && <Loader2 size={16} className="animate-spin" />}
                  <span>Lưu Bài Giảng</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassroomCurriculumTab;
