// src/features/student/pages/DailyHomeworkPage.tsx
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
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
  ExternalLink,
  Flame,
  Clock,
  Trophy,
  Target,
  Check,
  AlertCircle,
  BookOpen,
  PenTool,
  Mic,
  Headphones,
  BookText,
  Layers,
  RotateCcw,
  ListOrdered,
} from "lucide-react";
import type { SkillCategory } from "@/features/student/components/SkillAccordion";
import {
  SKILL_THEMES,
  detectItemCategory,
  SkillAccordionCard,
  SkillAccordionToolbar,
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

  const fetchOverview = useCallback(
    async (dayId?: string, isBackground = false) => {
      if (!classId) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (!isBackground) setLoading(true);
      try {
        const res = await studentApi.getDailyHomeworkOverview(classId, dayId);
        setData(res);
        if (!dayId && res.currentSelectedDay) {
          setSelectedDayId(res.currentSelectedDay.id);
        }
      } catch (err) {
        console.error("Lỗi tải tiến trình bảng ngày:", err);
      } finally {
        setLoading(false);
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
          title: "Từ Vựng & Ngữ Pháp (Vocabulary & Grammar)",
          subSections: [],
        },
      ],
      [
        "LISTENING",
        {
          category: "LISTENING",
          title: "Kỹ Năng Nghe (Listening)",
          subSections: [],
        },
      ],
      [
        "SPEAKING",
        {
          category: "SPEAKING",
          title: "Kỹ Năng Nói & Phát Âm (Speaking)",
          subSections: [],
        },
      ],
      [
        "READING",
        {
          category: "READING",
          title: "Kỹ Năng Đọc (Reading)",
          subSections: [],
        },
      ],
      [
        "WRITING",
        {
          category: "WRITING",
          title: "Kỹ Năng Viết (Writing)",
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

  const handleExpandAll = () => {
    setExpandedCategories(new Set(groupedSkills.map((g) => g.category)));
  };

  const handleCollapseAll = () => {
    setExpandedCategories(new Set());
  };

  if (!classId) {
    return (
      <div className="p-12 text-center text-rose-600 dark:text-rose-400 font-bold bg-white dark:bg-[#111827] rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-sm">
        Không tìm thấy ID lớp học trong đường dẫn URL.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 dark:text-slate-400 font-semibold gap-3">
        <Loader2
          className="animate-spin text-blue-700 dark:text-blue-400"
          size={36}
        />
        <span>Đang tải lộ trình học tập theo ngày...</span>
      </div>
    );
  }

  const percentage = data?.completionPercentage ?? 0;
  const days = data?.days ?? [];
  const totalDays = data?.totalDays ?? days.length;
  const completedDaysCount =
    data?.completedDays ?? days.filter((d) => d.isCompleted).length;
  const unlockedDaysCount = days.filter((d) => d.isUnlocked).length;

  // Tính chuỗi ngày học liên tiếp (Streak)
  const streakCount = (() => {
    let streak = 0;
    const unlockedList = days.filter((d) => d.isUnlocked);
    for (let i = unlockedList.length - 1; i >= 0; i--) {
      if (unlockedList[i].isCompleted) {
        streak++;
      } else if (i !== unlockedList.length - 1) {
        break;
      }
    }
    return Math.max(streak, completedDaysCount);
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
    <div className="max-w-[1536px] mx-auto px-4 sm:px-6 space-y-3 pb-8">
      {/* ================= TOP HEADER NAVIGATION ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/student/courses")}
            aria-label="Quay lại danh sách khóa học"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:hover:bg-slate-800 shadow-2xs transition-all cursor-pointer touch-manipulation active:scale-95 shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 dark:text-white">
              Lộ Trình Học Theo Ngày
            </h1>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">
              Bài học mới được mở khóa lúc 00:00 mỗi ngày theo tiến độ lớp học
            </p>
          </div>
        </div>

        {/* Nút hành động nhanh - Tối ưu chạm trên di động */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => navigate(`/student/courses/${classId}/assignments`)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs touch-manipulation"
            title="Xem toàn bộ bài tập gom theo kỹ năng"
          >
            <ListOrdered size={14} className="text-blue-700 dark:text-blue-400" />
            <span>Toàn Bộ Bài Tập</span>
          </button>
        </div>
      </div>

      {/* ================= 3 THẺ THỐNG KÊ TIẾN ĐỘ ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Card 1: Tổng tiến độ hoàn thành khóa học */}
        <div className="rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-2.5 shadow-2xs flex items-center justify-between gap-2.5">
          <div className="space-y-0.5 flex-1 min-w-0">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              <Trophy size={11} /> Tiến Độ Toàn Lộ Trình
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-bold text-slate-950 dark:text-white tracking-tight leading-tight">
                {percentage}%
              </span>
              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                ({completedDaysCount}/{totalDays} ngày)
              </span>
            </div>
            <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-1">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
              />
            </div>
          </div>

          <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="40"
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className="text-emerald-500 transition-all duration-700 ease-out"
                strokeWidth="10"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={2 * Math.PI * 40 * (1 - percentage / 100)}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            <CheckCircle2
              size={12}
              className="absolute text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>

        {/* Card 2: Chuỗi ngày học (Streak Card) */}
        <div className="rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-2.5 shadow-2xs flex items-center justify-between gap-2.5">
          <div className="space-y-0.5 min-w-0">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Flame size={11} /> Chuỗi Ngày Học (Streak)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                {streakCount}
              </span>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                ngày tích lũy
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Đã mở khóa{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {unlockedDaysCount}/{totalDays}
              </strong>{" "}
              chặng bài học
            </p>
          </div>

          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-500/15 text-amber-500 border border-amber-200/70 dark:border-amber-500/30 shadow-2xs">
            <Flame size={14} className="fill-amber-500/20" />
          </div>
        </div>

        {/* Card 3: Tiến độ ngày đang chọn */}
        <div className="rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-2.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              <Target size={11} /> Tiến Độ Ngày Đang Chọn
            </span>
            <span
              className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                dayCompletionPct === 100
                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300"
              }`}
            >
              {dayCompletionPct}% hoàn thành
            </span>
          </div>

          <div className="my-0.5 flex items-baseline justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-900 dark:text-white truncate">
              {selectedDay ? selectedDay.title : "Chưa chọn ngày học"}
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
              {completedDayTasks}/{totalDayTasks} nhiệm vụ
            </span>
          </div>

          <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                dayCompletionPct === 100
                  ? "bg-emerald-500"
                  : "bg-brand-600"
              }`}
              style={{ width: `${dayCompletionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ================= MOBILE HORIZONTAL DAY SELECTOR STRIP ================= */}
      <div className="lg:hidden bg-white dark:bg-[#111827] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-700 dark:text-blue-400" />
            Lộ Trình Các Ngày Học
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {unlockedDaysCount}/{totalDays} ngày mở
          </span>
        </div>

        {/* Dải cuộn ngang mượt mà cho cảm ứng ngón cái */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth">
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
                className={`flex flex-col items-center justify-center min-w-[76px] min-h-[58px] p-2 rounded-xl border transition-all select-none touch-manipulation cursor-pointer active:scale-95 ${
                  isSelected
                    ? "bg-blue-800 text-white border-blue-900 shadow-sm"
                    : isCompleted
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                    : isLocked
                    ? "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60"
                    : "bg-white dark:bg-[#0e1526] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-blue-300"
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] font-black">
                  <span>Ngày {day.dayNumber}</span>
                  {isCompleted ? (
                    <CheckCircle2 size={12} className={isSelected ? "text-emerald-300" : "text-emerald-600"} />
                  ) : isLocked ? (
                    <Lock size={10} />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>
                <span
                  className={`text-[9px] mt-0.5 font-medium truncate max-w-[68px] ${
                    isSelected ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {day.title || `Chặng ${day.dayNumber}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= MAIN 2-COLUMN ROADMAP & ACCORDION TASKS (TỈ LỆ 2 : 8) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3.5 xl:gap-4 items-start">
        {/* ================= CỘT TRÁI: LEARNING PATH TIMELINE (CHỈ HIỆN TRÊN DESKTOP) ================= */}
        <div className="hidden lg:block lg:col-span-2">
          <div className="bg-white dark:bg-[#111827] rounded-lg border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-2xs">
            {/* Timeline Header */}
            <div className="bg-slate-50/90 dark:bg-[#162033] px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white truncate">
                  Lộ Trình
                </h2>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">
                  Chọn ngày học
                </p>
              </div>
              <span className="rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                {days.length} chặng
              </span>
            </div>

            {/* Chú thích trạng thái */}
            <div className="px-2.5 py-1.5 bg-slate-50/40 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-1 text-[9px] font-medium text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                Xong
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-800 animate-pulse shrink-0" />
                Đang mở
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                Khóa
              </span>
            </div>

            {/* Timeline Vertical List */}
            <div className="p-2 sm:p-2.5 max-h-[720px] overflow-y-auto custom-scrollbar">
              {days.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Chưa có ngày học nào được giao cho lớp này
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
                        {/* Đường nối dọc của Timeline */}
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

                        {/* Node Tròn Trạng Thái */}
                        <div className="relative z-10 shrink-0 mt-0.5">
                          {isLocked ? (
                            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500">
                              <Lock size={12} />
                            </div>
                          ) : isCompleted ? (
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-white shadow-2xs">
                              <Check size={13} strokeWidth={2.5} />
                            </div>
                          ) : (
                            <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-blue-800 text-white shadow-2xs ring-1 ring-blue-600/20">
                              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 ring-1 ring-white dark:ring-[#111827] animate-pulse" />
                              <PlayCircle size={13} />
                            </div>
                          )}
                        </div>

                        {/* Thẻ Chọn Ngày Học */}
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
                          className={`flex-1 rounded-md border p-1.5 sm:p-2 transition-all duration-150 min-w-0 ${
                            isLocked
                              ? "opacity-55 cursor-not-allowed border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20"
                              : isSelected
                              ? "border-blue-600 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-600/15 shadow-2xs ring-1 ring-blue-600/20 cursor-pointer"
                              : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#162033] hover:border-blue-300 dark:hover:border-blue-600/40 hover:bg-slate-50/70 dark:hover:bg-slate-800/60 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 min-w-0">
                            <div className="min-w-0 flex-1">
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
                                  <span className="shrink-0 rounded bg-amber-100 dark:bg-amber-500/20 px-1 py-0.2 text-[8px] font-black uppercase text-amber-700 dark:text-amber-300">
                                    Hôm nay
                                  </span>
                                )}
                              </div>

                              <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                                {day.dateLabel ? (
                                  <span className="truncate flex items-center gap-0.5">
                                    <Calendar size={9} className="shrink-0" />
                                    <span className="truncate">{day.dateLabel}</span>
                                  </span>
                                ) : (
                                  <span />
                                )}
                                {day.estimatedMinutes && (
                                  <span className="shrink-0 flex items-center gap-0.5 text-slate-400">
                                    <Clock size={9} />
                                    {day.estimatedMinutes}p
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= CỘT PHẢI: BÀI TẬP THEO KỸ NĂNG DẠNG ACCORDION THU GỌN (TỈ LỆ 8) ================= */}
        <div className="lg:col-span-8 space-y-3">
          {!selectedDay ? (
            <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-lg p-10 text-center text-slate-400 shadow-2xs">
              <Calendar
                size={36}
                className="mx-auto mb-2 opacity-40 text-blue-700 dark:text-blue-400"
              />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Hãy chọn một ngày học trên lộ trình bên trái để xem chi tiết
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Các bài tập từ vựng, nghe, nói, đọc, viết sẽ hiển thị theo dạng Accordion thu gọn.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Header Card của Ngày đang chọn */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 shadow-2xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-blue-50 dark:bg-blue-600/15 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 border border-blue-200/70 dark:border-blue-600/30">
                        Chặng {selectedDay.dayNumber || ""}
                      </span>
                      {selectedDay.estimatedMinutes && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          <Clock size={11} /> ~{selectedDay.estimatedMinutes} phút học
                        </span>
                      )}
                    </div>
                    <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
                      {selectedDay.fullHeaderLabel}
                    </h2>
                  </div>

                  {completedDayTasks === totalDayTasks && totalDayTasks > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded-md self-start sm:self-center">
                      <CheckCircle2 size={12} /> Đã Hoàn Thành Ngày Học
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md self-start sm:self-center">
                      <Clock size={11} /> Đang Thực Hiện ({completedDayTasks}/{totalDayTasks})
                    </span>
                  )}
                </div>

                {/* Thanh phần trăm tiến độ ngày */}
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Tiến độ hoàn thành bài học trong ngày
                    </span>
                    <span className="font-bold text-blue-700 dark:text-blue-400">
                      {dayCompletionPct}% ({completedDayTasks}/{totalDayTasks} đầu mục)
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        dayCompletionPct === 100 ? "bg-emerald-500" : "bg-brand-600"
                      }`}
                      style={{ width: `${dayCompletionPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Thanh Toolbar Mở tất cả / Thu gọn tất cả */}
              {groupedSkills.length > 0 && (
                <SkillAccordionToolbar
                  totalSkills={groupedSkills.length}
                  completedTasks={completedDayTasks}
                  totalTasks={totalDayTasks}
                  onExpandAll={handleExpandAll}
                  onCollapseAll={handleCollapseAll}
                />
              )}

              {/* Danh sách các Nhóm Kỹ Năng dạng Accordion */}
              {groupedSkills.length === 0 ? (
                <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs shadow-xs">
                  <AlertCircle size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    Chưa có bài tập nào được giao cho ngày này
                  </p>
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
                        {/* Nội dung chi tiết các Menu con & bài tập */}
                        <div className="space-y-2.5">
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
                                {/* Header Menu Con nếu nhóm có nhiều hơn 1 mục */}
                                {isMerged && (
                                  <div className="flex items-center justify-between bg-slate-50/70 dark:bg-[#162033] border border-slate-200/50 dark:border-slate-800/80 px-2.5 py-1 rounded-md">
                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                      <ChevronDown
                                        size={12}
                                        className="text-blue-600 dark:text-blue-400"
                                      />
                                      {subTitleClean}
                                    </span>
                                    {isRequired && (
                                      <span className="rounded bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/70 dark:border-emerald-500/30 px-1.5 py-0.2 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold">
                                        Bắt buộc
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Danh sách bài tập của Menu Con */}
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
                                        className={`group rounded-lg border px-3 py-2 sm:px-3.5 sm:py-2 flex items-center justify-between gap-2.5 cursor-pointer transition-all duration-150 shadow-2xs ${
                                          isItemDone
                                            ? "border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-400"
                                            : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0d1322] hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/20 dark:hover:bg-slate-800/60"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div
                                            className={`flex h-7 w-7 sm:h-7.5 sm:w-7.5 shrink-0 items-center justify-center rounded-lg ${
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
                                          <div className="min-w-0">
                                            <span className="block text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition truncate">
                                              {item.title}
                                            </span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-none">
                                              {isItemDone
                                                ? "Đã hoàn thành nhiệm vụ"
                                                : "Nhấn để bắt đầu làm bài"}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          {item.assignmentId && (
                                            <span
                                              className={`text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
                                                isItemDone
                                                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 group-hover:bg-emerald-100"
                                                  : `${theme.ctaPrimaryBg} ${theme.ctaPrimaryText} shadow-2xs group-hover:scale-102`
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
                                                  <span>Làm bài</span>
                                                </>
                                              )}
                                            </span>
                                          )}
                                        </div>
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
