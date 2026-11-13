// src/features/student/pages/ClassAssignmentsPage.tsx
import { useEffect, useState, useMemo } from "react";
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
  RotateCcw,
  Calendar,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import type { SkillCategory } from "@/features/student/components/SkillAccordion";
import {
  SKILL_THEMES,
  detectSkillCategory,
  SkillAccordionCard,
  SkillAccordionToolbar,
} from "@/features/student/components/SkillAccordion";

export default function ClassAssignmentsPage() {
  const params = useParams();
  const navigate = useNavigate();

  const classId = params.classId || params.id;

  const [assignments, setAssignments] = useState<
    StudentAssignmentSummaryResponse[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Danh sách các nhóm Kỹ Năng đang mở rộng (Accordion State)
  const [expandedCategories, setExpandedCategories] = useState<Set<SkillCategory>>(
    new Set()
  );

  useEffect(() => {
    if (!classId) return;
    let mounted = true;
    studentApi
      .getClassAssignments(classId)
      .then((data) => {
        if (!mounted) return;
        const list = Array.isArray(data) ? data : [];
        setAssignments(list);

        // Smart Initial State: Mở nhóm đầu tiên có bài tập chưa làm
        const grouped = groupAssignments(list);
        let firstPendingCategory: SkillCategory | null = null;
        let firstAvailableCategory: SkillCategory | null = null;

        for (const [cat, items] of grouped.entries()) {
          if (items.length > 0) {
            if (!firstAvailableCategory) firstAvailableCategory = cat;
            const hasPending = items.some((a) => a.status !== "COMPLETED");
            if (hasPending && !firstPendingCategory) {
              firstPendingCategory = cat;
              break;
            }
          }
        }

        const initialCategory = firstPendingCategory || firstAvailableCategory;
        if (initialCategory) {
          setExpandedCategories(new Set([initialCategory]));
        }
      })
      .catch((err) => console.error("Lỗi danh sách bài tập:", err))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [classId]);

  // Phân nhóm bài tập theo 5 kỹ năng chính
  const groupAssignments = (list: StudentAssignmentSummaryResponse[]) => {
    const map = new Map<SkillCategory, StudentAssignmentSummaryResponse[]>([
      ["VOCABULARY_GRAMMAR", []],
      ["LISTENING", []],
      ["SPEAKING", []],
      ["READING", []],
      ["WRITING", []],
    ]);

    list.forEach((item) => {
      const cat = detectSkillCategory(item.skillType || item.title);
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(item);
    });

    return map;
  };

  const examAssignments = useMemo(
    () => assignments.filter((a) => Boolean(a.isExam)),
    [assignments]
  );

  const practiceAssignments = useMemo(
    () => assignments.filter((a) => !a.isExam),
    [assignments]
  );

  const grouped = useMemo(
    () => groupAssignments(practiceAssignments),
    [practiceAssignments]
  );

  // Các kỹ năng có bài tập
  const activeCategories = useMemo(() => {
    const list: {
      category: SkillCategory;
      items: StudentAssignmentSummaryResponse[];
      totalCount: number;
      completedCount: number;
    }[] = [];

    // Thứ tự hiển thị chuẩn Sư phạm
    const order: SkillCategory[] = [
      "VOCABULARY_GRAMMAR",
      "LISTENING",
      "SPEAKING",
      "READING",
      "WRITING",
    ];

    order.forEach((cat) => {
      const items = grouped.get(cat) || [];
      if (items.length > 0) {
        const completedCount = items.filter((a) => a.status === "COMPLETED").length;
        list.push({
          category: cat,
          items,
          totalCount: items.length,
          completedCount,
        });
      }
    });

    return list;
  }, [grouped]);

  const totalAssignments = assignments.length;
  const totalCompleted = useMemo(
    () => assignments.filter((a) => a.status === "COMPLETED").length,
    [assignments]
  );

  const toggleCategory = (cat: SkillCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedCategories(new Set(activeCategories.map((c) => c.category)));
  };

  const handleCollapseAll = () => {
    setExpandedCategories(new Set());
  };

  if (!classId) {
    return (
      <div className="p-10 text-center text-rose-600 font-bold bg-white dark:bg-[#111827] rounded-xl border border-rose-200 dark:border-rose-900/40">
        <AlertTriangle size={36} className="mx-auto mb-3" />
        Không tìm thấy lớp học.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 text-slate-500 dark:text-slate-400 font-medium text-sm gap-2.5">
        <Loader2 className="animate-spin text-blue-700 dark:text-blue-400" size={20} />
        <span>Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/student/courses")}
            aria-label="Quay lại danh sách lớp"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Bài tập
          </h1>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/student/courses/${classId}/daily-plan`)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
          <span>Lộ trình ngày</span>
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <FileText size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
            Chưa có bài tập
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {examAssignments.length > 0 && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-indigo-700 dark:text-indigo-400" />
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Bài thi ({examAssignments.length})
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Toàn màn hình • Lưu bài làm
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {examAssignments.map((exam) => {
                  const isCompleted = exam.status === "COMPLETED";
                  const isFlagged = Boolean(exam.isCheatingFlagged);
                  const skillsList = (exam.examSkills || exam.skillType || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);

                  return (
                    <div
                      key={exam.id}
                      className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 bg-white dark:bg-[#0d1322] ${
                        isFlagged
                          ? "border-rose-300 dark:border-rose-800/60"
                          : isCompleted
                            ? "border-emerald-200 dark:border-emerald-700/50"
                            : "border-indigo-200 dark:border-indigo-800/50"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {exam.title}
                          </h3>
                          {isFlagged ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                              <ShieldAlert size={11} />
                              Bị khóa
                            </span>
                          ) : isCompleted ? (
                            <span className="rounded-md bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              Đã nộp
                            </span>
                          ) : null}
                        </div>

                        {skillsList.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {skillsList.map((sk) => (
                              <span
                                key={sk}
                                className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                              >
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 tabular-nums">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {exam.timeLimitMinutes || 45}p
                          </span>
                          <span>•</span>
                          <span>
                            {exam.attemptsCount || 0}/{exam.maxAttempts || 1} lượt
                          </span>
                          {exam.highestScore != null && isCompleted && (
                            <>
                              <span>•</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {Number(exam.highestScore).toFixed(1)}/10
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/student/exams/${exam.id}/take`)}
                        className={`w-full flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                          isFlagged
                            ? "bg-rose-600 hover:bg-rose-700 text-white"
                            : isCompleted
                              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-600/40 hover:bg-emerald-100"
                              : "bg-indigo-700 hover:bg-indigo-600 text-white"
                        }`}
                      >
                        {isFlagged ? (
                          <>
                            <ShieldAlert size={14} />
                            <span>Xem biên bản</span>
                          </>
                        ) : isCompleted ? (
                          <>
                            <CheckCircle2 size={14} />
                            <span>Xem kết quả</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle size={14} />
                            <span>Vào thi</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <SkillAccordionToolbar
            totalSkills={activeCategories.length}
            completedTasks={totalCompleted}
            totalTasks={totalAssignments}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
          />

          {activeCategories.map(({ category, items, totalCount, completedCount }) => {
            const isExpanded = expandedCategories.has(category);
            const theme = SKILL_THEMES[category] || SKILL_THEMES.VOCABULARY_GRAMMAR;

            return (
              <SkillAccordionCard
                key={category}
                category={category}
                totalTasks={totalCount}
                completedTasks={completedCount}
                isExpanded={isExpanded}
                onToggle={() => toggleCategory(category)}
              >
                <div className="space-y-2">
                  {items.map((assignment) => {
                    const isCompleted = assignment.status === "COMPLETED";
                    const isOverdue = assignment.status === "OVERDUE";

                    return (
                      <div
                        key={assignment.id}
                        className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                          isCompleted
                            ? "border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-400"
                            : isOverdue
                            ? "border-rose-200/80 dark:border-rose-800/40 bg-rose-50/20 dark:bg-rose-950/10"
                            : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0d1322] hover:border-blue-400 dark:hover:border-blue-600"
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isCompleted ? (
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={15} />
                              </span>
                            ) : (
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${theme.squircleBg} ${theme.squircleText}`}>
                                <PlayCircle size={15} />
                              </span>
                            )}

                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug truncate">
                              {assignment.title}
                            </h3>

                            {isOverdue && !isCompleted && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                                Quá hạn
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium pl-8 tabular-nums">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {assignment.timeLimitMinutes
                                ? `${assignment.timeLimitMinutes}p`
                                : "Tự do"}
                            </span>
                            <span>•</span>
                            <span>
                              {assignment.attemptsCount || 0}/{assignment.maxAttempts || 1} lượt
                            </span>
                            {assignment.passScore != null && assignment.passScore > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-blue-700 dark:text-blue-300">
                                  Đạt ≥ {assignment.passScore}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          {isCompleted && assignment.highestScore != null && (
                            <span className="text-sm font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {Number(assignment.highestScore).toFixed(1)}/10
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              isOverdue && !isCompleted
                                ? undefined
                                : navigate(
                                    assignment.isExam
                                      ? `/student/exams/${assignment.id}/take`
                                      : isCompleted &&
                                          String(assignment.skillType || "").toUpperCase() === "SPEAKING"
                                        ? `/student/assignments/${assignment.id}/submissions/latest`
                                        : `/student/assignments/${assignment.id}/take`
                                  )
                            }
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                              isCompleted
                                ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30 hover:bg-emerald-100"
                                : isOverdue
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                : `${theme.ctaPrimaryBg} text-white`
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <RotateCcw size={13} />
                                <span>Làm lại</span>
                              </>
                            ) : isOverdue ? (
                              <span>Quá hạn</span>
                            ) : (
                              <>
                                <PlayCircle size={13} />
                                <span>Làm bài</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SkillAccordionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
