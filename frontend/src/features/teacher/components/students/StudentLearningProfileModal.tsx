import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Bot,
  AlertTriangle,
  Check,
  Mic,
  FileText,
  Calendar,
  Clock,
  Award,
  Send,
  Loader2,
  Volume2,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  BookOpen,
  ShieldAlert,
  Info,
} from "lucide-react";
import { teacherApi, type StudentSubmissionItem } from "../../api/teacherApi";
import { AiEvaluationCard } from "../grading/AiEvaluationCard";
import type { GradingSubmissionDetail } from "../grading/gradingTypes";

export interface StudentProfileData {
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  enrolledAt: string;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  averageScore: number;
  weaknesses: string[];
  aiQuota: {
    dailyUsed: number;
    dailyLimit: number;
    isBlocked: boolean;
  };
  attendanceScore?: number;
  totalStudyMinutes?: number;
  dailyProgressDetails?: Array<{
    date: string;
    completedTasks: number;
    studyMinutes: number;
    score: number;
  }>;
}

interface StudentLearningProfileModalProps {
  classId: string;
  student: StudentProfileData;
  onClose: () => void;
  onGradeUpdated?: () => void;
}

type SkillFilter = "SPEAKING_WRITING" | "EXAMS" | "SPEAKING" | "WRITING" | "ALL";
type StatusFilter = "ALL" | "PENDING" | "AI_GRADED" | "COMPLETED";

interface DayGroup {
  key: string;
  title: string;
  subtitle?: string;
  sortOrder: number;
  sortValue: number;
  items: StudentSubmissionItem[];
}

function formatDateVi(isoOrDate?: string | null): string {
  if (!isoOrDate) return "";
  const d = new Date(isoOrDate.length === 10 ? `${isoOrDate}T00:00:00` : isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeDateVi(iso?: string | null): string {
  if (!iso) return "Chưa rõ thời gian";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getLocalDateKey(iso?: string | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSpeakingSubmission(item: StudentSubmissionItem): boolean {
  if (item.isExam) return false;
  const skill = String(item.skillType || "").toUpperCase();
  if (skill === "SPEAKING") return true;
  if (item.hasAudio) return true;
  return Boolean(item.questionTypes?.includes("AUDIO_RESPONSE"));
}

function isWritingSubmission(item: StudentSubmissionItem): boolean {
  if (item.isExam) return false;
  const skill = String(item.skillType || "").toUpperCase();
  if (skill === "WRITING") return true;
  return Boolean(item.questionTypes?.includes("ESSAY"));
}

function isExamSubmission(item: StudentSubmissionItem): boolean {
  return Boolean(item.isExam);
}

function isSubjectiveQuestion(q: any, skillType?: string): boolean {
  const type = String(q.questionType || "").toUpperCase();
  if (type === "ESSAY" || type === "AUDIO_RESPONSE") return true;
  if (q.audioUrl) return true;
  const skill = String(skillType || "").toUpperCase();
  if (skill === "WRITING" && (q.studentAnswer || !q.options || q.options.length === 0)) {
    return true;
  }
  return skill === "SPEAKING";
}

export const StudentLearningProfileModal: React.FC<
  StudentLearningProfileModalProps
> = ({ classId, student, onClose, onGradeUpdated }) => {
  const [activeTab, setActiveTab] = useState<"submissions" | "progress">(
    "submissions",
  );
  const [submissions, setSubmissions] = useState<StudentSubmissionItem[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(true);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  const [skillFilter, setSkillFilter] =
    useState<SkillFilter>("SPEAKING_WRITING");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [selectedItem, setSelectedItem] =
    useState<StudentSubmissionItem | null>(null);
  const [submissionDetail, setSubmissionDetail] =
    useState<GradingSubmissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const [inputScore, setInputScore] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [answerScores, setAnswerScores] = useState<Record<string, number>>({});
  const [savingGrade, setSavingGrade] = useState<boolean>(false);
  const [gradeNotice, setGradeNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load student's submissions in this classroom
  useEffect(() => {
    if (!classId || !student?.studentId) return;
    let isMounted = true;
    setLoadingSubmissions(true);
    setSubmissionsError(null);
    setSelectedItem(null);
    setSubmissionDetail(null);

    teacherApi
      .getStudentClassroomSubmissions(classId, student.studentId)
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data || [];
        setSubmissions(list);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error("Lỗi tải danh sách bài nộp của học viên:", err);
        setSubmissionsError(
          err?.response?.data?.message ||
            "Không thể tải danh sách bài nộp của học viên.",
        );
        setSubmissions([]);
      })
      .finally(() => {
        if (isMounted) setLoadingSubmissions(false);
      });

    return () => {
      isMounted = false;
    };
  }, [classId, student.studentId]);

  const speakingWritingCount = useMemo(
    () =>
      submissions.filter(
        (item) =>
          isSpeakingSubmission(item) ||
          isWritingSubmission(item) ||
          isExamSubmission(item),
      ).length,
    [submissions],
  );

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => {
      if (skillFilter === "SPEAKING_WRITING") {
        if (
          !isSpeakingSubmission(item) &&
          !isWritingSubmission(item) &&
          !isExamSubmission(item)
        ) {
          return false;
        }
      } else if (skillFilter === "EXAMS") {
        if (!isExamSubmission(item)) return false;
      } else if (skillFilter === "SPEAKING") {
        if (!isSpeakingSubmission(item)) return false;
      } else if (skillFilter === "WRITING") {
        if (!isWritingSubmission(item)) return false;
      }

      if (statusFilter === "PENDING" && item.status === "COMPLETED") {
        return false;
      }
      if (statusFilter === "COMPLETED" && item.status !== "COMPLETED") {
        return false;
      }
      if (statusFilter === "AI_GRADED" && !item.hasAiEvaluation) {
        return false;
      }
      return true;
    });
  }, [submissions, skillFilter, statusFilter]);

  const groupedByDay = useMemo<DayGroup[]>(() => {
    const groups = new Map<string, DayGroup>();

    filteredSubmissions.forEach((item) => {
      if (item.dayNumber != null) {
        const key = `plan-day-${item.dayNumber}`;
        const dateStr = item.scheduledDate
          ? formatDateVi(item.scheduledDate)
          : item.submittedAt
            ? formatDateVi(item.submittedAt)
            : "";
        const subParts = [dateStr, item.dayTitle].filter(Boolean);
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            title: `Ngày ${item.dayNumber}`,
            subtitle: subParts.join(" • "),
            sortOrder: 0,
            sortValue: item.dayNumber,
            items: [],
          });
        }
        groups.get(key)!.items.push(item);
      } else if (item.submittedAt) {
        const dateKey = getLocalDateKey(item.submittedAt);
        const key = `date-${dateKey}`;
        if (!groups.has(key)) {
          const ts = new Date(item.submittedAt).getTime();
          groups.set(key, {
            key,
            title: `Ngày ${formatDateVi(item.submittedAt)}`,
            subtitle: "Bài tập trong lớp",
            sortOrder: 1,
            sortValue: Number.isNaN(ts) ? 0 : -ts,
            items: [],
          });
        }
        groups.get(key)!.items.push(item);
      } else {
        const key = "other";
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            title: "Bài tập khác",
            subtitle: "Chưa xếp lịch ngày",
            sortOrder: 2,
            sortValue: 0,
            items: [],
          });
        }
        groups.get(key)!.items.push(item);
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.sortValue - b.sortValue;
    });
  }, [filteredSubmissions]);

  const handleSelectSubmission = async (item: StudentSubmissionItem) => {
    setSelectedItem(item);
    setLoadingDetail(true);
    setGradeNotice(null);
    try {
      const res = await teacherApi.getSubmissionDetail(item.attemptId);
      const detail: GradingSubmissionDetail | null = res.data?.data || null;
      setSubmissionDetail(detail);
      if (detail) {
        const initScores: Record<string, number> = {};
        (detail.questions || []).forEach((q: any) => {
          const k = q.questionId || q.id;
          if (k && q.earnedPoints !== null && q.earnedPoints !== undefined) {
            initScores[k] = Number(q.earnedPoints);
          }
        });
        setAnswerScores(initScores);
        setInputScore(
          detail.score !== null && detail.score !== undefined
            ? String(detail.score)
            : item.aiScore != null
              ? String(Math.min(10, Math.round(item.aiScore * 10) / 10))
              : "",
        );
        setFeedback(detail.teacherFeedback || "");
      } else {
        setAnswerScores({});
      }
    } catch (err: any) {
      console.error("Lỗi tải chi tiết bài nộp:", err);
      setSubmissionDetail(null);
      setGradeNotice({
        type: "error",
        text:
          err?.response?.data?.message ||
          "Không thể tải chi tiết bài nộp này.",
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  // Auto-select first submission in filtered list if current selection isn't visible
  useEffect(() => {
    if (loadingSubmissions || activeTab !== "submissions") return;
    if (filteredSubmissions.length === 0) {
      setSelectedItem(null);
      setSubmissionDetail(null);
      return;
    }
    const stillVisible =
      selectedItem &&
      filteredSubmissions.some((s) => s.attemptId === selectedItem.attemptId);
    if (!stillVisible) {
      handleSelectSubmission(filteredSubmissions[0]);
    }
  }, [filteredSubmissions, loadingSubmissions, activeTab]);

  const displayedQuestions = useMemo(() => {
    const all = submissionDetail?.questions || [];
    if (submissionDetail?.isExam) {
      return all;
    }
    if (submissionDetail?.answersPersisted === false) {
      return [];
    }
    const subjective = all.filter((q) =>
      isSubjectiveQuestion(q, submissionDetail?.skillType),
    );
    return subjective.length > 0 ? subjective : all;
  }, [submissionDetail]);

  const parsedViolations = useMemo(() => {
    if (!submissionDetail?.violationLogJson) return [];
    try {
      const arr = JSON.parse(submissionDetail.violationLogJson);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [submissionDetail?.violationLogJson]);

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const parsedScore = parseFloat(inputScore);
    if (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > 10) {
      setGradeNotice({
        type: "error",
        text: "Vui lòng nhập điểm số hợp lệ từ 0.0 đến 10.0.",
      });
      return;
    }

    try {
      setSavingGrade(true);
      setGradeNotice(null);

      const hasAnswerScores =
        Boolean(submissionDetail?.isExam) && Object.keys(answerScores).length > 0;
      await teacherApi.gradeSubmission(selectedItem.attemptId, {
        score: parsedScore,
        feedback,
        ...(hasAnswerScores ? { answerScores } : {}),
      });

      const wasCompleted = selectedItem.status === "COMPLETED";
      setGradeNotice({
        type: "success",
        text: wasCompleted
          ? `Đã chấm lại thành công: ${parsedScore}/10 và cập nhật nhận xét cho học viên.`
          : `Đã lưu điểm ${parsedScore}/10 và gửi nhận xét cho học viên.`,
      });

      setSubmissions((prev) =>
        prev.map((item) =>
          item.attemptId === selectedItem.attemptId
            ? {
                ...item,
                score: parsedScore,
                teacherFeedback: feedback,
                status: "COMPLETED",
              }
            : item,
        ),
      );
      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              score: parsedScore,
              teacherFeedback: feedback,
              status: "COMPLETED",
            }
          : prev,
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

      onGradeUpdated?.();
    } catch (err: any) {
      console.error("Lỗi khi chấm/cập nhật điểm:", err);
      setGradeNotice({
        type: "error",
        text:
          err?.response?.data?.message ||
          "Không thể lưu kết quả chấm điểm. Vui lòng thử lại.",
      });
    } finally {
      setSavingGrade(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-elevated flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-800/20 text-blue-700 dark:text-blue-400 font-extrabold text-lg border border-blue-200 dark:border-blue-600/30">
              {student.fullName.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                Hồ Sơ Học Tập — {student.fullName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {student.email} • {student.phone} • Nhập học: {student.enrolledAt}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hồ sơ học tập"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Scrollable Area */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* 5 Summary KPI Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                Điểm TB
              </span>
              <span className="text-lg font-black text-blue-700 dark:text-blue-400">
                {student.averageScore} / 10
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                Đã Nộp
              </span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {student.completedTasks} / {student.totalTasks}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                AI Limit (Hôm nay)
              </span>
              {student.aiQuota?.isBlocked ? (
                <span className="text-sm font-black text-rose-500 uppercase mt-1 block">
                  Bị Chặn
                </span>
              ) : (
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {student.aiQuota?.dailyUsed || 0}/{student.aiQuota?.dailyLimit || 20}
                </span>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                Chuyên Cần
              </span>
              <span className="text-lg font-black text-amber-500 dark:text-amber-400">
                {student.attendanceScore || 0}%
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-center col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                Tổng T.Gian
              </span>
              <span className="text-lg font-black text-sky-600 dark:text-cyan-400">
                {Math.floor((student.totalStudyMinutes || 0) / 60)}h{" "}
                {(student.totalStudyMinutes || 0) % 60}m
              </span>
            </div>
          </div>

          {/* Primary Modal Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("submissions")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "submissions"
                  ? "bg-blue-800 text-white shadow-xs"
                  : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-blue-500"
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Bài Nộp Speaking &amp; Viết Luận</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                  activeTab === "submissions"
                    ? "bg-white/20 text-white"
                    : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                }`}
              >
                {speakingWritingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("progress")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "progress"
                  ? "bg-blue-800 text-white shadow-xs"
                  : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-blue-500"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Tiến Độ &amp; Điểm Yếu</span>
            </button>
          </div>

          {activeTab === "submissions" ? (
            <div className="space-y-4">
              {/* Filters Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "SPEAKING_WRITING", label: "Speaking, Viết & Bài thi" },
                      { id: "EXAMS", label: "Chỉ Bài thi" },
                      { id: "SPEAKING", label: "Chỉ Luyện nói" },
                      { id: "WRITING", label: "Chỉ Viết luận" },
                      { id: "ALL", label: "Tất cả bài nộp" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSkillFilter(opt.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                        skillFilter === opt.id
                          ? "bg-blue-700 text-white shadow-2xs"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "ALL", label: "Mọi trạng thái" },
                      { id: "PENDING", label: "Chờ GV chấm" },
                      { id: "AI_GRADED", label: "AI đã chấm" },
                      { id: "COMPLETED", label: "GV đã chấm" },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatusFilter(st.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                        statusFilter === st.id
                          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingSubmissions ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-12 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    Đang tải bài nộp Speaking &amp; Viết luận theo từng ngày...
                  </p>
                </div>
              ) : submissionsError ? (
                <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 p-6 text-center text-xs text-rose-600 dark:text-rose-400">
                  {submissionsError}
                </div>
              ) : groupedByDay.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-10 text-center space-y-2">
                  <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Chưa có bài nộp phù hợp bộ lọc
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Học viên chưa nộp bài Speaking/Viết luận nào hoặc chưa có bài khớp bộ lọc trạng thái hiện tại.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left: Submissions grouped by day */}
                  <div className="lg:col-span-5 space-y-4 max-h-[540px] overflow-y-auto pr-1">
                    {groupedByDay.map((group) => (
                      <div key={group.key} className="space-y-2">
                        <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs px-3 py-1.5 border border-slate-200 dark:border-slate-700/80">
                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span className="truncate">{group.title}</span>
                            </span>
                            {group.subtitle && (
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {group.subtitle}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 rounded-md bg-white dark:bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {group.items.length} bài
                          </span>
                        </div>

                        <div className="space-y-2 pl-1">
                          {group.items.map((item) => {
                            const isSelected =
                              selectedItem?.attemptId === item.attemptId;
                            const isExam = isExamSubmission(item);
                            const isSpeaking = isSpeakingSubmission(item);
                            const isWriting = isWritingSubmission(item);
                            const isCompleted = item.status === "COMPLETED";

                            return (
                              <button
                                key={item.attemptId}
                                type="button"
                                onClick={() => handleSelectSubmission(item)}
                                className={`w-full text-left rounded-xl border p-3 transition cursor-pointer space-y-2 ${
                                  isSelected
                                    ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 ring-1 ring-blue-600/30"
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 hover:border-blue-400 dark:hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                          isExam
                                            ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70"
                                            : isSpeaking
                                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70"
                                              : isWriting
                                                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                        }`}
                                      >
                                        {isExam ? (
                                          <ShieldAlert className="h-3 w-3" />
                                        ) : isSpeaking ? (
                                          <Mic className="h-3 w-3" />
                                        ) : (
                                          <FileText className="h-3 w-3" />
                                        )}
                                        {isExam
                                          ? "Bài thi"
                                          : isSpeaking
                                            ? "Speaking"
                                            : isWriting
                                              ? "Viết luận"
                                              : item.skillType || "Bài tập"}
                                      </span>
                                      {item.isCheatingFlagged && (
                                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                          GIAN LẬN ({item.violationCount ?? 3})
                                        </span>
                                      )}
                                      <span className="text-[10px] font-semibold text-slate-400">
                                        Lần #{item.attemptNumber || 1}
                                      </span>
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                                      {item.assignmentTitle}
                                    </h4>
                                  </div>

                                  <span
                                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                                      isCompleted
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    }`}
                                  >
                                    {isCompleted
                                      ? `GV: ${item.score ?? 0}/10`
                                      : "Chờ GV chấm"}
                                  </span>
                                </div>

                                {item.previewText && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                    {item.previewText}
                                  </p>
                                )}

                                <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-slate-400">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTimeDateVi(item.submittedAt)}
                                  </span>
                                  {item.hasAiEvaluation && (
                                    <span className="inline-flex items-center gap-1 rounded bg-blue-600/15 px-1.5 py-0.5 font-bold text-blue-700 dark:text-blue-300">
                                      <Bot className="h-3 w-3" />
                                      AI:{" "}
                                      {item.aiScore != null
                                        ? item.aiScore
                                        : "Đã chấm"}
                                      {item.aiCefr ? ` • ${item.aiCefr}` : ""}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right: Detail + AI Evaluation + Teacher Re-grading Workspace */}
                  <div className="lg:col-span-7">
                    {!selectedItem ? (
                      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-500">
                        Chọn một bài nộp bên trái để xem nội dung, điểm AI và chấm điểm.
                      </div>
                    ) : loadingDetail ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                        <Loader2 className="h-7 w-7 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">
                          Đang tải nội dung bài nộp và đánh giá AI...
                        </p>
                      </div>
                    ) : !submissionDetail ? (
                      <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 p-6 text-center text-xs text-rose-500">
                        Không thể tải dữ liệu chi tiết cho bài nộp này.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 p-4 sm:p-5 space-y-4">
                        {/* Detail Header */}
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                                {submissionDetail.assignmentTitle}
                              </h3>
                              {selectedItem.dayNumber != null && (
                                <span className="rounded-md bg-blue-600/15 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                  Ngày {selectedItem.dayNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Lần nộp #{selectedItem.attemptNumber || 1} •{" "}
                              {formatTimeDateVi(selectedItem.submittedAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {submissionDetail.score !== null &&
                              submissionDetail.score !== undefined && (
                                <div className="rounded-lg border border-blue-500/30 bg-blue-600/10 px-2.5 py-1 text-right">
                                  <span className="block text-[9px] uppercase font-bold text-blue-700 dark:text-blue-400">
                                    {submissionDetail.status === "COMPLETED"
                                      ? "Điểm GV hiện tại"
                                      : "Điểm tạm tính"}
                                  </span>
                                  <span className="text-sm font-black text-blue-800 dark:text-blue-300">
                                    {submissionDetail.score} / 10
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>

                        {/* Cảnh báo vi phạm / gian lận bài thi */}
                        {(submissionDetail.isCheatingFlagged || (submissionDetail.violationCount ?? 0) > 0) && (
                          <div
                            className={`rounded-xl border p-3.5 space-y-1.5 ${
                              submissionDetail.isCheatingFlagged
                                ? "border-rose-500/40 bg-rose-500/10"
                                : "border-amber-500/40 bg-amber-500/10"
                            }`}
                          >
                            <div
                              className={`flex items-center gap-1.5 text-xs font-extrabold ${
                                submissionDetail.isCheatingFlagged
                                  ? "text-rose-700 dark:text-rose-300"
                                  : "text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              <ShieldAlert className="h-4 w-4 shrink-0" />
                              {submissionDetail.isCheatingFlagged
                                ? `Đánh dấu GIAN LẬN (${submissionDetail.violationCount ?? 3}/${submissionDetail.maxViolations ?? 3} lần vi phạm)`
                                : `Cảnh báo rời màn hình (${submissionDetail.violationCount ?? 0}/${submissionDetail.maxViolations ?? 3})`}
                            </div>
                            {submissionDetail.cheatingReason && (
                              <p className="text-[11px] text-rose-700 dark:text-rose-200 font-medium">
                                {submissionDetail.cheatingReason}
                              </p>
                            )}
                            {parsedViolations.length > 0 && (
                              <ul className="space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300 border-t border-rose-500/20 pt-1.5">
                                {parsedViolations.map((v: any, idx: number) => (
                                  <li key={idx}>
                                    • Lần {v.count ?? idx + 1} [{v.eventType || "FOCUS_LOST"}]:{" "}
                                    {v.reason || "Thoát màn hình thi"}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* Banner bài tập chỉ đánh dấu hoàn thành */}
                        {!submissionDetail.isExam && submissionDetail.answersPersisted === false && (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <span>
                              Bài luyện tập này chỉ lưu trạng thái{" "}
                              <strong>Đã hoàn thành</strong> và điểm tổng, không lưu chi tiết câu trả lời (chỉ lưu bài luận, Speaking và Bài thi).
                            </span>
                          </div>
                        )}

                        {/* Questions + Student Work + AI Evaluation */}
                        <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
                          {displayedQuestions.map((q: any, idx: number) => {
                            const qType = String(q.questionType || "").toUpperCase();
                            const isAudio =
                              qType === "AUDIO_RESPONSE" || Boolean(q.audioUrl);
                            const isEssay =
                              qType === "ESSAY" ||
                              (!isAudio && (!q.options || q.options.length === 0) && Boolean(q.studentAnswer));
                            const qKey = q.questionId || q.id;
                            const maxPts = q.maxPoints ?? q.points ?? 10;
                            const qScoreVal =
                              qKey && answerScores[qKey] !== undefined
                                ? answerScores[qKey]
                                : (q.earnedPoints ?? 0);
                            const wordCount = q.studentAnswer?.trim()
                              ? q.studentAnswer.trim().split(/\s+/).filter(Boolean).length
                              : 0;
                            const fallbackTranscript =
                              q.aiEvaluation?.sttTranscript || q.transcript;

                            return (
                              <div
                                key={q.id || idx}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    <span className="text-blue-700 dark:text-blue-400 mr-1">
                                      Câu {idx + 1}:
                                    </span>
                                    {q.promptText}
                                  </p>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {q.skillType && (
                                      <span className="rounded bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        {q.skillType}
                                      </span>
                                    )}
                                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                      {isAudio
                                        ? "SPEAKING"
                                        : isEssay
                                          ? "VIẾT LUẬN"
                                          : qType || "CÂU HỎI"}
                                    </span>
                                  </div>
                                </div>

                                {q.mediaUrl && (
                                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2">
                                    <span className="text-[10px] font-semibold text-slate-500 flex items-center mb-1">
                                      <Volume2 className="h-3 w-3 mr-1 text-emerald-500" />
                                      Audio đề bài:
                                    </span>
                                    <audio
                                      src={q.mediaUrl}
                                      controls
                                      className="h-8 w-full"
                                    />
                                  </div>
                                )}

                                {/* Student submission body */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                                    <span>Bài làm của học sinh:</span>
                                    {isEssay && q.studentAnswer && (
                                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                                        {wordCount} từ
                                      </span>
                                    )}
                                  </div>

                                  {q.audioUrl && (
                                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 space-y-2">
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                        <Mic className="h-3.5 w-3.5" />
                                        Bản ghi âm bài nói của học sinh:
                                      </div>
                                      <audio
                                        src={q.audioUrl}
                                        controls
                                        className="h-9 w-full"
                                      />
                                      {fallbackTranscript && !q.aiEvaluation?.sttTranscript && (
                                        <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                                          <strong className="mr-1">Gợi ý/Transcript:</strong>
                                          {fallbackTranscript}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {q.options && q.options.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {q.options.map((opt: any) => {
                                        const isChosen =
                                          q.selectedOptionId === opt.id ||
                                          q.studentAnswer === opt.id;
                                        return (
                                          <div
                                            key={opt.id}
                                            className={`rounded-lg border px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 ${
                                              isChosen
                                                ? opt.isCorrect
                                                  ? "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold"
                                                  : "border-rose-300 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-semibold"
                                                : opt.isCorrect
                                                  ? "border-emerald-200/70 bg-emerald-50/30 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400"
                                                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                                            }`}
                                          >
                                            <span>
                                              {opt.optionLabel ? `${opt.optionLabel}. ` : ""}
                                              {opt.optionText}
                                            </span>
                                            {isChosen && (
                                              <span className="text-[10px] font-bold uppercase shrink-0">
                                                Học sinh chọn
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : q.studentAnswer ? (
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                      {q.studentAnswer}
                                    </div>
                                  ) : (
                                    !q.audioUrl && (
                                      <div className="rounded-lg border border-rose-200 dark:border-rose-800/40 bg-rose-50/50 dark:bg-rose-950/20 p-2 text-xs italic text-rose-500">
                                        Học sinh chưa nhập nội dung câu trả lời cho phần này.
                                      </div>
                                    )
                                  )}
                                </div>

                                {/* Điều chỉnh điểm từng câu cho Bài thi */}
                                {submissionDetail.isExam && qKey && (
                                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                                    <span className="text-slate-500 font-semibold">
                                      Điểm câu (tối đa {maxPts}):
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        max={maxPts}
                                        value={qScoreVal}
                                        onChange={(e) =>
                                          setAnswerScores((prev) => ({
                                            ...prev,
                                            [qKey]: Math.max(
                                              0,
                                              Math.min(maxPts, Number(e.target.value) || 0),
                                            ),
                                          }))
                                        }
                                        className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-bold text-slate-900 dark:text-white text-right outline-none focus:border-blue-600"
                                      />
                                      <span className="text-slate-400">/ {maxPts}</span>
                                    </div>
                                  </div>
                                )}

                                {/* Structured AI Evaluation */}
                                {(isEssay || isAudio || q.aiEvaluation || q.evalFeedback) && (
                                  <AiEvaluationCard
                                    question={q}
                                    onApplyAiScore={(val) =>
                                      setInputScore(String(val))
                                    }
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {gradeNotice && (
                          <div
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                              gradeNotice.type === "success"
                                ? "border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                                : "border-rose-300 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>{gradeNotice.text}</span>
                          </div>
                        )}

                        {/* Teacher Grading / Re-grading Form */}
                        <form
                          onSubmit={handleSaveGrade}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                              {submissionDetail.status === "COMPLETED" ? (
                                <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                              ) : (
                                <Award className="h-4 w-4 text-amber-500" />
                              )}
                              {submissionDetail.status === "COMPLETED"
                                ? "Chấm Lại & Cập Nhật Nhận Xét Của Giáo Viên"
                                : "Chấm Điểm & Gửi Nhận Xét"}
                            </span>

                            {selectedItem.aiScore != null && (
                              <button
                                type="button"
                                onClick={() =>
                                  setInputScore(
                                    String(
                                      Math.min(
                                        10,
                                        Math.round(selectedItem.aiScore! * 10) / 10,
                                      ),
                                    ),
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition cursor-pointer"
                              >
                                <Sparkles className="h-3 w-3" />
                                Lấy điểm AI ({selectedItem.aiScore})
                              </button>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                Điểm (0–10):
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                required
                                value={inputScore}
                                onChange={(e) => setInputScore(e.target.value)}
                                placeholder="0.0 - 10.0"
                                className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-sm font-black text-slate-900 dark:text-white outline-none focus:border-blue-600"
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                              {[10, 9, 8.5, 8, 7.5, 7, 6].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setInputScore(String(preset))}
                                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-600 hover:text-blue-700 dark:hover:text-white transition cursor-pointer"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                Nhận xét của giáo viên:
                              </label>
                              <div className="flex flex-wrap items-center gap-1">
                                {[
                                  "Làm bài rất tốt!",
                                  "Cần chú ý ngữ pháp & chia thì",
                                  "Phát âm rõ ràng, cải thiện ngữ điệu",
                                  "Ý tốt, nên dùng thêm từ vựng nâng cao",
                                ].map((chip) => (
                                  <button
                                    key={chip}
                                    type="button"
                                    onClick={() =>
                                      setFeedback((prev) =>
                                        prev ? `${prev}. ${chip}` : chip,
                                      )
                                    }
                                    className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                                  >
                                    + {chip}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <textarea
                              rows={3}
                              value={feedback}
                              onChange={(e) => setFeedback(e.target.value)}
                              placeholder="Nhập nhận xét hoặc góp ý sửa bài cho học viên..."
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 placeholder-slate-400"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={savingGrade}
                              className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-600 transition disabled:opacity-50 cursor-pointer"
                            >
                              {savingGrade ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Đang lưu...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="h-3.5 w-3.5" />
                                  <span>
                                    {submissionDetail.status === "COMPLETED"
                                      ? "Cập Nhật Điểm (Chấm Lại)"
                                      : "Lưu Điểm & Gửi Nhận Xét"}
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Tiến Độ & Điểm Yếu */
            <div className="space-y-4">
              {student.dailyProgressDetails &&
              student.dailyProgressDetails.length > 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-5 space-y-4">
                  <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Chi Tiết Tiến Độ Từng Ngày</span>
                    <span className="text-[11px] font-semibold normal-case text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg">
                      Theo lộ trình lớp học
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-xs font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Ngày</th>
                          <th className="px-4 py-3 text-center">
                            Bài tập hoàn thành
                          </th>
                          <th className="px-4 py-3 text-center">
                            Thời gian học
                          </th>
                          <th className="px-4 py-3 text-center">
                            Điểm số trung bình
                          </th>
                          <th className="px-4 py-3 text-right">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {student.dailyProgressDetails.map((detail, index) => (
                          <tr
                            key={index}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                          >
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                              {detail.date}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center justify-center bg-blue-50 dark:bg-blue-600/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-600/20 rounded-md px-2 py-0.5 text-xs font-bold min-w-[2rem]">
                                {detail.completedTasks}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sky-600 dark:text-cyan-400 font-medium">
                              {detail.studyMinutes} phút
                            </td>
                            <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                              {detail.score}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {detail.completedTasks > 0 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                                  <Check size={14} /> Hoạt động
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-600 text-xs font-semibold">
                                  Vắng mặt
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                  Lớp học chưa có dữ liệu tiến độ theo lộ trình ngày.
                </div>
              )}

              <div className="rounded-xl border border-blue-200 dark:border-blue-600/20 bg-blue-50/50 dark:bg-blue-600/5 p-4 space-y-3">
                <div className="flex items-center text-xs font-bold text-blue-800 dark:text-blue-300">
                  <Bot className="h-4 w-4 mr-1.5 text-blue-700 dark:text-blue-400" />
                  Điểm Yếu Cần Cải Thiện (AI Phân Tích)
                </div>
                {student.weaknesses.length === 0 ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                    Học viên chưa có đủ dữ liệu để AI đánh giá.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {student.weaknesses.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-center rounded-xl bg-white dark:bg-slate-900/80 px-3 py-2 text-xs border border-rose-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 font-medium"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mr-2 shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-200/70 dark:bg-slate-800 px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-300/70 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
