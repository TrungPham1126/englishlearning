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
  Trophy,
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
    studentApi
      .getClassAssignments(classId)
      .then((data) => {
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
      .finally(() => setLoading(false));
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

  const grouped = useMemo(() => groupAssignments(assignments), [assignments]);

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
      <div className="p-16 text-center text-rose-600 font-bold bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-rose-200 dark:border-rose-900/40">
        <AlertTriangle size={48} className="mx-auto mb-4" />
        Lỗi: Không lấy được ID lớp học từ URL.
        <br />
        Vui lòng kiểm tra lại đường dẫn khóa học.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 dark:text-slate-400 font-semibold text-sm gap-3">
        <Loader2 className="animate-spin text-blue-700 dark:text-blue-400" size={32} />
        <span>Đang phân loại bài tập theo kỹ năng...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ================= TOP HEADER NAVIGATION & SWITCHER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate("/student/courses")}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-2xs cursor-pointer"
            title="Quay lại danh sách khóa học"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Danh Sách Bài Tập Theo Kỹ Năng
            </h1>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium mt-1">
              Phân nhóm theo Reading, Listening, Speaking, Writing & Vocabulary
            </p>
          </div>
        </div>

        {/* Chuyển đổi nhanh sang Lộ trình theo ngày (Daily Plan) */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            type="button"
            onClick={() => navigate(`/student/courses/${classId}/daily-plan`)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
          >
            <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Lộ Trình Theo Ngày (Daily Plan)</span>
          </button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-16 text-center shadow-xs">
          <FileText size={44} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-base">
            Chưa có bài tập nào
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Giảng viên chưa giao bài tập cho lớp học này. Vui lòng quay lại sau hoặc theo dõi thông báo lớp học.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Thanh công cụ mở rộng / thu gọn tổng */}
          <SkillAccordionToolbar
            totalSkills={activeCategories.length}
            completedTasks={totalCompleted}
            totalTasks={totalAssignments}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
          />

          {/* Danh sách các Accordion kỹ năng */}
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
                {/* Danh sách thẻ bài tập bên trong Accordion */}
                <div className="space-y-3">
                  {items.map((assignment) => {
                    const isCompleted = assignment.status === "COMPLETED";
                    const isOverdue = assignment.status === "OVERDUE";

                    return (
                      <div
                        key={assignment.id}
                        className={`rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 shadow-2xs ${
                          isCompleted
                            ? "border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-400"
                            : isOverdue
                            ? "border-rose-200/80 dark:border-rose-800/40 bg-rose-50/20 dark:bg-rose-950/10"
                            : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0d1322] hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/20 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        {/* Chi tiết nội dung bài tập */}
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {isCompleted ? (
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={16} />
                              </span>
                            ) : (
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${theme.squircleBg} ${theme.squircleText}`}>
                                <PlayCircle size={16} />
                              </span>
                            )}

                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug">
                              {assignment.title}
                            </h4>

                            {isCompleted && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                Hoàn thành
                              </span>
                            )}
                            {isOverdue && !isCompleted && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                                Quá hạn
                              </span>
                            )}
                          </div>

                          {assignment.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 pl-8">
                              {assignment.description}
                            </p>
                          )}

                          {/* Thông tin phụ trợ: thời gian, số lần làm, điểm chuẩn */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium pl-8">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {assignment.timeLimitMinutes
                                ? `${assignment.timeLimitMinutes} phút`
                                : "Không giới hạn"}
                            </span>
                            <span>•</span>
                            <span>
                              Đã làm: <b>{assignment.attemptsCount || 0}</b>/{assignment.maxAttempts || 1} lần
                            </span>
                            {assignment.passScore != null && assignment.passScore > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
                                  <Trophy size={11} /> Điểm chuẩn: {assignment.passScore} pts
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Cột phải: Điểm số & Nút CTA */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                          {isCompleted && assignment.highestScore != null && (
                            <div className="text-right mr-1">
                              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                                Điểm cao nhất
                              </span>
                              <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                                {Number(assignment.highestScore).toFixed(1)} / 10
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              isOverdue && !isCompleted
                                ? undefined
                                : navigate(
                                    isCompleted
                                      ? `/student/assignments/${assignment.id}/submissions/latest`
                                      : `/student/assignments/${assignment.id}/take`
                                  )
                            }
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
                              isCompleted
                                ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30 hover:bg-emerald-100"
                                : isOverdue
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                : `${theme.ctaPrimaryBg} text-white hover:scale-[1.02] shadow-sm`
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <RotateCcw size={14} />
                                <span>Xem Lại / Làm Lại</span>
                              </>
                            ) : isOverdue ? (
                              <span>Đã Quá Hạn</span>
                            ) : (
                              <>
                                <PlayCircle size={14} />
                                <span>Làm Bài Ngay</span>
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
