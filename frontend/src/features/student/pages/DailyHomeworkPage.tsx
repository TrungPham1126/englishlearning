// src/features/student/pages/DailyHomeworkPage.tsx
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
import { useAuthStore } from "@/store/useAuthStore";
import { Tooltip } from "@/components/ui/Tooltip";
import type {
  DailyHomeworkOverviewResponse,
  SectionGroupDto,
} from "@/features/student/types";
import {
  PlayCircle,
  ChevronDown,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Calendar,
  Lock,
  Flame,
  Clock,
  Check,
  AlertCircle,
  RotateCcw,
  ListOrdered,
} from "lucide-react";
import type { SkillCategory } from "@/features/student/components/SkillAccordion";
import {
  SKILL_THEMES,
  detectItemCategory,
  SkillAccordionCard,
} from "@/features/student/components/SkillAccordion";

interface DailySkillGroup {
  category: SkillCategory;
  title: string;
  subSections: SectionGroupDto[];
  totalTasks: number;
  completedTasks: number;
}

export default function DailyHomeworkPage() {
  const params = useParams();
  const navigate = useNavigate();
  const classId = params.classId || params.id;

  const [data, setData] = useState<DailyHomeworkOverviewResponse | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(true);

  // Accordion State cho các nhóm kỹ năng
  const [expandedCategories, setExpandedCategories] = useState<
    Set<SkillCategory>
  >(new Set());

  const lastDayExpandedRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const lastFocusFetchTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchOverview = useCallback(
    async (dayId?: string, isBackground = false) => {
      if (!classId) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (!isBackground && isMountedRef.current) setLoading(true);
      try {
        const res = await studentApi.getDailyHomeworkOverview(classId, dayId);
        if (!isMountedRef.current) return;
        setData(res);
        if (!dayId && res.currentSelectedDay) {
          setSelectedDayId(res.currentSelectedDay.id);
        }
        if (
          typeof res?.currentStreak === "number" &&
          Number.isFinite(res.currentStreak) &&
          res.currentStreak >= 0
        ) {
          const normalizedStreak = Math.floor(res.currentStreak);
          try {
            localStorage.setItem("elp_student_streak", String(normalizedStreak));
          } catch {
            // Ignore storage write errors
          }
          const currentUser = useAuthStore.getState().user;
          if (currentUser && currentUser.currentStreak !== normalizedStreak) {
            useAuthStore.getState().updateUser({ currentStreak: normalizedStreak });
          }
          window.dispatchEvent(
            new CustomEvent("student-streak-updated", {
              detail: {
                currentStreak: normalizedStreak,
                hasHomeworkToday: res.hasHomeworkToday,
                completedToday: res.completedToday,
              },
            }),
          );
        }
      } catch (err) {
        console.error("Lỗi tải tiến trình bảng ngày:", err);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
        isFetchingRef.current = false;
      }
    },
    [classId]
  );

  // Chỉ gọi fetch lần đầu khi classId thay đổi (triệt tiêu 100% duplicate fetch khi mount)
  useEffect(() => {
    fetchOverview(undefined);
  }, [classId, fetchOverview]);

  // Lắng nghe sự kiện hoàn thành bài tập hoặc quay lại tab (có throttle 30s)
  useEffect(() => {
    const handleProgressUpdate = () => {
      fetchOverview(selectedDayId, true);
    };

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusFetchTimeRef.current > 30000) {
        lastFocusFetchTimeRef.current = now;
        fetchOverview(selectedDayId, true);
      }
    };

    window.addEventListener("student-progress-updated", handleProgressUpdate);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener(
        "student-progress-updated",
        handleProgressUpdate
      );
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedDayId, fetchOverview]);

  const handleSelectDay = (dayId: string) => {
    if (dayId === selectedDayId) return;
    setSelectedDayId(dayId);
    fetchOverview(dayId);
  };

  const selectedDay = data?.currentSelectedDay;

  // =========================================================================
  // GOM NHÓM CÁC SECTION TRONG NGÀY THÀNH 5 KỸ NĂNG ACCORDION
  // =========================================================================
  const groupedSkills = useMemo<DailySkillGroup[]>(() => {
    if (!selectedDay) return [];

    const map = new Map<
      SkillCategory,
      { category: SkillCategory; title: string; subSections: SectionGroupDto[] }
    >([
      [
        "VOCABULARY_GRAMMAR",
        {
          category: "VOCABULARY_GRAMMAR",
          title: "Từ vựng & Ngữ pháp",
          subSections: [],
        },
      ],
      [
        "LISTENING",
        {
          category: "LISTENING",
          title: "Nghe",
          subSections: [],
        },
      ],
      [
        "SPEAKING",
        {
          category: "SPEAKING",
          title: "Nói",
          subSections: [],
        },
      ],
      [
        "READING",
        {
          category: "READING",
          title: "Đọc",
          subSections: [],
        },
      ],
      [
        "WRITING",
        {
          category: "WRITING",
          title: "Viết",
          subSections: [],
        },
      ],
    ]);

    // Phân loại theo từng bài (itemType) rồi gom lại theo mục con của kỹ năng đó
    selectedDay.sections.forEach((sec) => {
      const byCat = new Map<SkillCategory, typeof sec.items>();
      sec.items.forEach((it) => {
        let cat = detectItemCategory(it.itemType, sec.sectionName);
        if (!map.has(cat)) cat = "VOCABULARY_GRAMMAR";
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat)!.push(it);
      });
      byCat.forEach((items, cat) => {
        map.get(cat)!.subSections.push({ ...sec, items });
      });
    });

    const result: DailySkillGroup[] = [];
    const order: SkillCategory[] = [
      "VOCABULARY_GRAMMAR",
      "LISTENING",
      "SPEAKING",
      "READING",
      "WRITING",
    ];

    order.forEach((cat) => {
      const g = map.get(cat);
      if (g && g.subSections.length > 0) {
        const allItems = g.subSections.flatMap((s) => s.items);
        if (allItems.length > 0) {
          result.push({
            category: cat,
            title: g.title,
            subSections: g.subSections,
            totalTasks: allItems.length,
            completedTasks: allItems.filter((i) => i.isDone).length,
          });
        }
      }
    });

    return result;
  }, [selectedDay]);

  // SMART INITIAL STATE: Tự động mở nhóm đầu tiên có bài tập chưa làm khi chuyển sang ngày mới
  useEffect(() => {
    if (!selectedDay?.id || groupedSkills.length === 0) return;
    if (lastDayExpandedRef.current === selectedDay.id) return;
    lastDayExpandedRef.current = selectedDay.id;

    const firstPending = groupedSkills.find(
      (g) => g.completedTasks < g.totalTasks
    );
    if (firstPending) {
      setExpandedCategories(new Set([firstPending.category]));
    } else {
      setExpandedCategories(new Set([groupedSkills[0].category]));
    }
  }, [selectedDay?.id, groupedSkills]);

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

  if (!classId) {
    return (
      <div className="p-8 text-center text-rose-600 dark:text-rose-400 font-bold bg-white dark:bg-[#111827] rounded-xl border border-rose-200 dark:border-rose-900/50">
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

  const percentage = data?.completionPercentage ?? 0;
  const days = data?.days ?? [];
  const totalDays = data?.totalDays ?? days.length;
  const completedDaysCount =
    data?.completedDays ?? days.filter((d) => d.isCompleted).length;
  const unlockedDaysCount = days.filter((d) => d.isUnlocked).length;

  // Chuỗi ngày có bài tập hoàn thành liên tiếp (ưu tiên số liệu chuẩn từ backend)
  const streakCount = (() => {
    if (
      typeof data?.currentStreak === "number" &&
      Number.isFinite(data.currentStreak) &&
      data.currentStreak >= 0
    ) {
      return Math.floor(data.currentStreak);
    }
    let streak = 0;
    const unlockedDesc = days
      .filter((d) => d.isUnlocked)
      .sort((a, b) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""));
    for (const day of unlockedDesc) {
      if (day.isCompleted) {
        streak++;
      } else if (day.isCurrentDay) {
        // Hôm nay còn đang diễn ra -> không làm đứt chuỗi trước đó
        continue;
      } else {
        break;
      }
    }
    return streak;
  })();

  const streakTooltipText = (() => {
    if (data?.hasHomeworkToday === true && data?.completedToday === true) {
      return "Đã hoàn thành 100% bài tập hôm nay! Chuỗi tiếp tục được duy trì.";
    }
    if (data?.hasHomeworkToday === true && data?.completedToday === false) {
      return "Hoàn thành hết bài tập hôm nay để tăng chuỗi. Ngày không có bài tập sẽ không làm mất chuỗi.";
    }
    if (data?.hasHomeworkToday === false) {
      return "Hôm nay không có bài tập ngày — chuỗi của bạn vẫn được giữ nguyên!";
    }
    return "Hoàn thành đủ bài tập mỗi ngày có lịch để tăng chuỗi. Ngày không có bài tập sẽ không làm mất chuỗi.";
  })();

  // Tiến độ hoàn thành bài tập trong ngày đang chọn
  const allSelectedDayItems =
    selectedDay?.sections.flatMap((sec) => sec.items) ?? [];
  const totalDayTasks = allSelectedDayItems.length;
  const completedDayTasks = allSelectedDayItems.filter((item) => item.isDone).length;
  const dayCompletionPct =
    totalDayTasks > 0
      ? Math.round((completedDayTasks / totalDayTasks) * 100)
      : 0;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-4 pb-8">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/student/courses")}
            aria-label="Quay lại danh sách lớp"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Lộ trình ngày
            </h1>
            <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {completedDaysCount}/{totalDays} • {percentage}%
            </span>
            <Tooltip
              position="bottom"
              content={
                <div className="text-center p-1 max-w-[260px] whitespace-normal">
                  <p className="font-bold text-amber-400">
                    Chuỗi bài tập ngày: {streakCount} ngày
                  </p>
                  <p className="text-slate-300 text-[10px] mt-0.5">
                    {streakTooltipText}
                  </p>
                </div>
              }
            >
              <span
                data-testid="daily-homework-streak"
                className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums px-2 py-0.5 rounded-md cursor-help ${
                  streakCount > 0
                    ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <Flame size={12} /> {streakCount}
              </span>
            </Tooltip>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/student/courses/${classId}/assignments`)}
          className="inline-flex items-center gap-1.5 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          <ListOrdered size={14} className="text-blue-700 dark:text-blue-400" />
          <span>Tất cả bài tập</span>
        </button>
      </div>

      {/* Mobile Day Strip */}
      <div className="lg:hidden bg-white dark:bg-[#111827] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-700 dark:text-blue-400" />
            Ngày học
          </span>
          <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
            {unlockedDaysCount}/{totalDays} mở
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {days.map((day) => {
            const isSelected = selectedDay?.id === day.id || selectedDayId === day.id;
            const isLocked = !day.isUnlocked;
            const isCompleted = day.isCompleted;

            return (
              <button
                key={day.id}
                type="button"
                disabled={isLocked}
                onClick={() => handleSelectDay(day.id)}
                className={`flex flex-col items-center justify-center min-w-[68px] min-h-[48px] px-2.5 py-1.5 rounded-xl border transition select-none touch-manipulation cursor-pointer ${
                  isSelected
                    ? "bg-blue-700 text-white border-blue-800"
                    : isCompleted
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                    : isLocked
                    ? "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60"
                    : "bg-white dark:bg-[#0e1526] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-blue-300"
                }`}
              >
                <div className="flex items-center gap-1 text-xs font-bold tabular-nums">
                  <span>N{day.dayNumber}</span>
                  {isCompleted ? (
                    <CheckCircle2 size={12} className={isSelected ? "text-emerald-200" : "text-emerald-600"} />
                  ) : isLocked ? (
                    <Lock size={10} />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-start">
        {/* Desktop Timeline Sidebar */}
        <div className="hidden lg:block lg:col-span-2">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
            <div className="bg-slate-50/90 dark:bg-[#162033] px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                Ngày học
              </h2>
              <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
                {days.length}
              </span>
            </div>

            <div className="p-2 max-h-[720px] overflow-y-auto custom-scrollbar">
              {days.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400">
                  Chưa có ngày học
                </div>
              ) : (
                <div className="relative space-y-2">
                  {days.map((day, idx) => {
                    const isSelected =
                      selectedDay?.id === day.id || selectedDayId === day.id;
                    const isLocked = !day.isUnlocked;
                    const isCompleted = day.isCompleted;
                    const isLast = idx === days.length - 1;

                    return (
                      <div key={day.id} className="relative flex gap-2">
                        {!isLast && (
                          <div
                            aria-hidden="true"
                            className={`absolute left-[13px] top-7 -bottom-2 w-0.5 ${
                              isCompleted
                                ? "bg-emerald-400 dark:bg-emerald-500/60"
                                : !isLocked
                                ? "bg-blue-300 dark:bg-blue-600/40"
                                : "bg-slate-200 dark:bg-slate-800"
                            }`}
                          />
                        )}

                        <div className="relative z-10 shrink-0 mt-0.5">
                          {isLocked ? (
                            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500">
                              <Lock size={12} />
                            </div>
                          ) : isCompleted ? (
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-white">
                              <Check size={13} strokeWidth={2.5} />
                            </div>
                          ) : (
                            <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-white">
                              <PlayCircle size={13} />
                            </div>
                          )}
                        </div>

                        <div
                          role="button"
                          tabIndex={isLocked ? -1 : 0}
                          aria-disabled={isLocked}
                          onClick={() => !isLocked && handleSelectDay(day.id)}
                          onKeyDown={(e) => {
                            if (
                              !isLocked &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault();
                              handleSelectDay(day.id);
                            }
                          }}
                          className={`flex-1 rounded-md border p-2 transition min-w-0 ${
                            isLocked
                              ? "opacity-55 cursor-not-allowed border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20"
                              : isSelected
                              ? "border-blue-600 bg-blue-50/60 dark:bg-blue-600/15 ring-1 ring-blue-600/20 cursor-pointer"
                              : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#162033] hover:border-blue-300 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className={`text-[11px] font-semibold leading-tight truncate ${
                                isLocked
                                  ? "text-slate-500 dark:text-slate-400"
                                  : isCompleted
                                  ? "text-slate-900 dark:text-white"
                                  : "text-blue-800 dark:text-blue-300 font-bold"
                              }`}
                              title={day.title}
                            >
                              {day.title}
                            </span>
                            {day.isCurrentDay && !isLocked && (
                              <span className="shrink-0 rounded bg-amber-100 dark:bg-amber-500/20 px-1 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                                Nay
                              </span>
                            )}
                          </div>

                          {(day.dateLabel || day.estimatedMinutes) && (
                            <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                              <span className="truncate">{day.dateLabel || ""}</span>
                              {day.estimatedMinutes && <span>{day.estimatedMinutes}p</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Day Tasks */}
        <div className="lg:col-span-8 space-y-3">
          {!selectedDay ? (
            <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-xl p-10 text-center text-slate-500">
              <Calendar size={30} className="mx-auto mb-2 opacity-40 text-blue-700 dark:text-blue-400" />
              <p className="text-xs font-semibold">Chọn một ngày để xem bài tập</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {selectedDay.fullHeaderLabel}
                    </h2>
                    {selectedDay.estimatedMinutes && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                        <Clock size={11} /> {selectedDay.estimatedMinutes}p
                      </span>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md ${
                      completedDayTasks === totalDayTasks && totalDayTasks > 0
                        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15"
                        : "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15"
                    }`}
                  >
                    {completedDayTasks === totalDayTasks && totalDayTasks > 0 && <CheckCircle2 size={12} />}
                    {completedDayTasks}/{totalDayTasks} ({dayCompletionPct}%)
                  </span>
                </div>

                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      dayCompletionPct === 100 ? "bg-emerald-500" : "bg-blue-700 dark:bg-blue-500"
                    }`}
                    style={{ width: `${dayCompletionPct}%` }}
                  />
                </div>
              </div>

              {groupedSkills.length === 0 ? (
                <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                  <AlertCircle size={22} className="mx-auto mb-1.5 opacity-40" />
                  <p>Chưa có bài tập cho ngày này</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {groupedSkills.map((group) => {
                    const isExpanded = expandedCategories.has(group.category);
                    const theme =
                      SKILL_THEMES[group.category] ||
                      SKILL_THEMES.VOCABULARY_GRAMMAR;

                    return (
                      <SkillAccordionCard
                        key={group.category}
                        category={group.category}
                        customTitle={group.title}
                        totalTasks={group.totalTasks}
                        completedTasks={group.completedTasks}
                        isExpanded={isExpanded}
                        onToggle={() => toggleCategory(group.category)}
                      >
                        <div className="space-y-2">
                          {group.subSections.map((sub, sIdx) => {
                            const isMerged = group.subSections.length > 1;

                            let subTitleClean = sub.sectionName;
                            if (subTitleClean.includes(":")) {
                              subTitleClean = subTitleClean
                                .substring(subTitleClean.indexOf(":") + 1)
                                .trim();
                            } else if (subTitleClean.includes(" - ")) {
                              subTitleClean = subTitleClean
                                .substring(subTitleClean.indexOf(" - ") + 3)
                                .trim();
                            }
                            const isRequired =
                              sub.sectionName.includes("Bắt buộc");

                            return (
                              <div key={sIdx} className="space-y-1.5">
                                {isMerged && (
                                  <div className="flex items-center justify-between bg-slate-50/70 dark:bg-[#162033] px-2.5 py-1 rounded-md">
                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                      <ChevronDown
                                        size={12}
                                        className="text-blue-600 dark:text-blue-400"
                                      />
                                      {subTitleClean}
                                    </span>
                                    {isRequired && (
                                      <span className="rounded bg-emerald-50 dark:bg-emerald-500/15 px-1.5 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                                        Bắt buộc
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div
                                  className={`space-y-1.5 ${
                                    isMerged
                                      ? "pl-2.5 border-l border-slate-200/80 dark:border-slate-800 ml-1"
                                      : ""
                                  }`}
                                >
                                  {sub.items.map((item) => {
                                    const isItemDone = Boolean(item.isDone);

                                    return (
                                      <div
                                        key={item.id}
                                        onClick={() => {
                                          if (item.assignmentId) {
                                            navigate(
                                              `/student/assignments/${item.assignmentId}/take`
                                            );
                                          }
                                        }}
                                        className={`group rounded-lg border px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer transition ${
                                          isItemDone
                                            ? "border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-400"
                                            : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0d1322] hover:border-blue-400 dark:hover:border-blue-600"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div
                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                              isItemDone
                                                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                : `${theme.squircleBg} ${theme.squircleText}`
                                            }`}
                                          >
                                            {isItemDone ? (
                                              <CheckCircle2 size={14} />
                                            ) : (
                                              <PlayCircle size={14} />
                                            )}
                                          </div>
                                          <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition truncate">
                                            {item.title}
                                          </span>
                                        </div>

                                        {item.assignmentId && (
                                          <span
                                            className={`text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg border shrink-0 transition ${
                                              isItemDone
                                                ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                                : `${theme.ctaPrimaryBg} ${theme.ctaPrimaryText} border-transparent`
                                            }`}
                                          >
                                            {isItemDone ? (
                                              <>
                                                <RotateCcw size={12} />
                                                <span>Làm lại</span>
                                              </>
                                            ) : (
                                              <>
                                                <PlayCircle size={12} />
                                                <span>Làm</span>
                                              </>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
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
          )}
        </div>
      </div>
    </div>
  );
}
