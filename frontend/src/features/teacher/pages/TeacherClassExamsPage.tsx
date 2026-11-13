import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ShieldCheck,
  Plus,
  Clock,
  Edit3,
  Trash2,
  Loader2,
  FileCheck2,
  ShieldAlert,
} from "lucide-react";
import ClassroomHeaderNav from "../components/ClassroomHeaderNav";
import { teacherApi } from "../api/teacherApi";
import type {
  GradingSubmission,
  GradingSubmissionDetail,
} from "../components/grading/gradingTypes";
import { SubmissionListSidebar } from "../components/grading/SubmissionListSidebar";
import { GradingWorkspacePanel } from "../components/grading/GradingWorkspacePanel";
import { ExamBuilderModal } from "../components/exams/ExamBuilderModal";

function splitSkills(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export default function TeacherClassExamsPage() {
  const { classId } = useParams<{ classId: string }>();

  const [exams, setExams] = useState<any[]>([]);
  const [loadingExams, setLoadingExams] = useState<boolean>(true);
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  const [builderOpen, setBuilderOpen] = useState<boolean>(false);
  const [editingExam, setEditingExam] = useState<any | null>(null);

  const [submissions, setSubmissions] = useState<GradingSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);
  const [selectedSub, setSelectedSub] = useState<GradingSubmission | null>(null);
  const [submissionDetail, setSubmissionDetail] =
    useState<GradingSubmissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [search, setSearch] = useState<string>("");

  const [inputScore, setInputScore] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [answerScores, setAnswerScores] = useState<Record<string, number>>({});
  const [savingGrade, setSavingGrade] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadExams = () => {
    if (!classId) return;
    setLoadingExams(true);
    teacherApi
      .getClassExams(classId)
      .then((res) => {
        const list = res.data?.data || [];
        setExams(list);
        if (list.length > 0) {
          setSelectedExamId((prev) =>
            prev && list.some((e: any) => e.id === prev) ? prev : list[0].id,
          );
        } else {
          setSelectedExamId("");
          setSubmissions([]);
          setSelectedSub(null);
          setSubmissionDetail(null);
        }
      })
      .catch((err) => {
        console.error("Lỗi tải danh sách bài thi:", err);
        setExams([]);
      })
      .finally(() => setLoadingExams(false));
  };

  useEffect(() => {
    loadExams();
  }, [classId]);

  const handleSelectSubmission = async (sub: GradingSubmission) => {
    setSelectedSub(sub);
    setLoadingDetail(true);
    setSaveSuccess(null);
    try {
      const res = await teacherApi.getSubmissionDetail(sub.attemptId);
      const detail: GradingSubmissionDetail | null = res.data?.data || null;
      if (detail) {
        const initScores: Record<string, number> = {};
        (detail.questions || []).forEach((q: any) => {
          const k = q.questionId || q.id;
          if (k && q.earnedPoints !== null && q.earnedPoints !== undefined) {
            initScores[k] = Number(q.earnedPoints);
          }
        });
        setAnswerScores(initScores);
        setSubmissionDetail(detail);
        setInputScore(
          detail.score !== null && detail.score !== undefined
            ? String(detail.score)
            : "",
        );
        setFeedback(detail.teacherFeedback || "");
      } else {
        setAnswerScores({});
        setSubmissionDetail(null);
      }
    } catch (err) {
      console.error("Lỗi tải chi tiết bài thi:", err);
      setSubmissionDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!selectedExamId) return;
    setLoadingSubmissions(true);
    teacherApi
      .getSubmissionsForGrading(selectedExamId)
      .then((res) => {
        const list = res.data?.data || [];
        setSubmissions(list);
        if (list.length > 0) {
          handleSelectSubmission(list[0]);
        } else {
          setSelectedSub(null);
          setSubmissionDetail(null);
        }
      })
      .catch((err) => {
        console.error("Lỗi tải bài nộp của bài thi:", err);
        setSubmissions([]);
      })
      .finally(() => setLoadingSubmissions(false));
  }, [selectedExamId]);

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    const parsedScore = parseFloat(inputScore);
    if (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > 10) {
      alert("Vui lòng nhập điểm tổng hợp lệ từ 0.0 đến 10.0.");
      return;
    }
    try {
      setSavingGrade(true);
      setSaveSuccess(null);
      await teacherApi.gradeSubmission(selectedSub.attemptId, {
        score: parsedScore,
        feedback,
        ...(Object.keys(answerScores).length > 0 ? { answerScores } : {}),
      });
      setSaveSuccess(`Đã lưu điểm ${parsedScore}/10 và nhận xét bài thi cho học viên.`);
      setSubmissions((prev) =>
        prev.map((item) =>
          item.attemptId === selectedSub.attemptId
            ? { ...item, score: parsedScore, status: "COMPLETED" }
            : item,
        ),
      );
      setSelectedSub((prev) =>
        prev ? { ...prev, score: parsedScore, status: "COMPLETED" } : prev,
      );
      setSubmissionDetail((prev) =>
        prev
          ? {
              ...prev,
              score: parsedScore,
              teacherFeedback: feedback,
              status: "COMPLETED",
            }
          : prev,
      );
    } catch (err: any) {
      console.error("Lỗi chấm lại bài thi:", err);
      alert(err?.response?.data?.message || "Không thể lưu điểm bài thi.");
    } finally {
      setSavingGrade(false);
    }
  };

  const handleDeleteExam = async (examId: string, examTitle: string) => {
    if (!window.confirm(`Bạn chắc chắn muốn xóa bài thi "${examTitle}"?`)) return;
    try {
      await teacherApi.deleteAssignment(examId);
      loadExams();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể xóa bài thi.");
    }
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const kw = search.trim().toLowerCase();
      if (
        kw &&
        !s.studentName.toLowerCase().includes(kw) &&
        !s.studentEmail.toLowerCase().includes(kw)
      ) {
        return false;
      }
      if (statusFilter === "PENDING") return s.status !== "COMPLETED";
      if (statusFilter === "COMPLETED") return s.status === "COMPLETED";
      return true;
    });
  }, [submissions, search, statusFilter]);

  const pendingCount = submissions.filter((s) => s.status !== "COMPLETED").length;
  const completedCount = submissions.filter((s) => s.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {classId && (
        <ClassroomHeaderNav
          classId={classId}
          activeTab="exams"
          actions={
            <button
              type="button"
              onClick={() => {
                setEditingExam(null);
                setBuilderOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-blue-600 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo Bài Thi Mới</span>
            </button>
          }
        />
      )}

      {/* Danh sách Đề thi của lớp */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Danh Sách Bài Thi Chính Thức ({exams.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tất cả bài thi đều lưu toàn bộ bài làm của học sinh, hỗ trợ AI sinh đề và giám sát toàn màn hình chống gian lận.
            </p>
          </div>
        </div>

        {loadingExams ? (
          <div className="py-10 text-center text-xs text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
            Đang tải danh sách bài thi...
          </div>
        ) : exams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
            <FileCheck2 className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Lớp học chưa có bài thi nào
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Nhấn &quot;Tạo Bài Thi Mới&quot; để chọn nhiều kỹ năng, dùng AI sinh đề tự động hoặc chọn câu hỏi từ lớp.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {exams.map((exam) => {
              const isSelected = selectedExamId === exam.id;
              const skills = splitSkills(exam.examSkills || exam.skillType);
              return (
                <div
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`rounded-xl border p-4 space-y-3 transition cursor-pointer ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/25 ring-1 ring-blue-600/30"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:border-blue-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-1">
                      {exam.title}
                    </h3>
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const detailRes = await teacherApi.getAssignment(exam.id);
                            setEditingExam(detailRes.data?.data || exam);
                          } catch {
                            setEditingExam(exam);
                          }
                          setBuilderOpen(true);
                        }}
                        title="Sửa đề thi"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-blue-600"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExam(exam.id, exam.title)}
                        title="Xóa đề thi"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {skills.map((sk) => (
                      <span
                        key={sk}
                        className="rounded bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-bold"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {exam.timeLimitMinutes || 45} phút • {exam.questions?.length ?? 0} câu
                    </span>
                    <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Tối đa {exam.maxViolations || 3} vi phạm
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Khu vực Xem Bài Làm & Chấm Lại Bài Thi */}
      {selectedExamId && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <SubmissionListSidebar
            submissions={submissions}
            filteredSubmissions={filteredSubmissions}
            selectedSub={selectedSub}
            onSelectSubmission={handleSelectSubmission}
            statusFilter={statusFilter}
            onChangeStatusFilter={setStatusFilter}
            search={search}
            onChangeSearch={setSearch}
            pendingCount={pendingCount}
            completedCount={completedCount}
            loadingSubmissions={loadingSubmissions}
          />

          <GradingWorkspacePanel
            selectedSub={selectedSub}
            submissionDetail={submissionDetail}
            loadingDetail={loadingDetail}
            inputScore={inputScore}
            setInputScore={setInputScore}
            feedback={feedback}
            setFeedback={setFeedback}
            savingGrade={savingGrade}
            saveSuccess={saveSuccess}
            onSaveGrade={handleSaveGrade}
            answerScores={answerScores}
            onUpdateQuestionScore={(qKey, scoreVal) =>
              setAnswerScores((prev) => ({ ...prev, [qKey]: scoreVal }))
            }
          />
        </div>
      )}

      {builderOpen && classId && (
        <ExamBuilderModal
          classId={classId}
          initialExam={editingExam}
          onClose={() => {
            setBuilderOpen(false);
            setEditingExam(null);
          }}
          onSaved={() => {
            setBuilderOpen(false);
            setEditingExam(null);
            loadExams();
          }}
        />
      )}
    </div>
  );
}
