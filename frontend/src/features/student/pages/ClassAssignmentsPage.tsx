// src/features/student/pages/ClassAssignmentsPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
import type { StudentAssignmentSummaryResponse } from "@/features/student/types";
import {
  ArrowLeft,
  FileText,
  PlayCircle,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export default function ClassAssignmentsPage() {
  const params = useParams();
  const navigate = useNavigate();

  // MẸO: Lấy ID dự phòng cho cả 2 cách khai báo Route (:classId hoặc :id)
  const classId = params.classId || params.id;

  const [assignments, setAssignments] = useState<
    StudentAssignmentSummaryResponse[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    studentApi
      .getClassAssignments(classId)
      .then((data) => setAssignments(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Lỗi danh sách bài tập:", err))
      .finally(() => setLoading(false));
  }, [classId]);

  if (!classId) {
    return (
      <div className="p-20 text-center text-rose-600 font-bold bg-white rounded-xl shadow-sm border border-rose-200">
        <AlertTriangle size={48} className="mx-auto mb-4" />
        Lỗi: Không lấy được ID lớp học từ URL.
        <br />
        Vui lòng kiểm tra lại cấu hình Route trong App.tsx.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 text-slate-500 font-semibold text-sm gap-2">
        <Loader2 className="animate-spin text-indigo-600" size={20} />
        <span>Đang tải danh sách bài tập...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={() => navigate("/student/courses")}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            Danh Sách Bài Tập
          </h1>
          <p className="text-xs text-slate-500">
            Hoàn thành các bài tập để hệ thống AI phân tích và cập nhật biểu đồ
            năng lực
          </p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-700">Chưa có bài tập nào</h3>
          <p className="text-xs text-slate-500 mt-1">
            Giảng viên chưa giao bài tập cho lớp học này.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {assignments.map((assignment) => {
            const isCompleted = assignment.status === "COMPLETED";
            const isOverdue = assignment.status === "OVERDUE";

            return (
              <div
                key={assignment.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:border-indigo-300 transition"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {assignment.skillType}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">
                      {assignment.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-1">
                    {assignment.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-medium pt-1">
                    <span className="flex items-center gap-1">
                      <Clock size={13} />{" "}
                      {assignment.timeLimitMinutes
                        ? `${assignment.timeLimitMinutes} phút`
                        : "Không giới hạn"}
                    </span>
                    <span>•</span>
                    <span>
                      Đã làm: {assignment.attemptsCount} /{" "}
                      {assignment.maxAttempts} lần
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  {isCompleted && (
                    <div className="text-right mr-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Điểm cao nhất
                      </span>
                      <span className="text-lg font-black text-emerald-600">
                        {assignment.highestScore?.toFixed(1)}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      isOverdue && !isCompleted
                        ? undefined
                        : navigate(
                            isCompleted
                              ? `/student/assignments/${assignment.id}/submissions/latest`
                              : `/student/assignments/${assignment.id}/take`,
                          )
                    }
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isCompleted
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        : isOverdue
                          ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    {isCompleted ? (
                      <>
                        <CheckCircle2 size={15} /> Xem Kết Quả
                      </>
                    ) : isOverdue ? (
                      "Đã Quá Hạn"
                    ) : (
                      <>
                        <PlayCircle size={15} /> Làm Bài Ngay
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
