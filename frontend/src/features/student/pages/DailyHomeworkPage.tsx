// src/features/student/pages/DailyHomeworkPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
import type { DailyHomeworkOverviewResponse } from "@/features/student/types";
import {
  PlayCircle,
  ChevronDown,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Calendar,
  Lock,
  ExternalLink,
  BookText,
  Flame,
  Clock,
  Sparkles,
  Trophy,
  Target,
  Check,
  AlertCircle,
  BookOpen,
  PenTool,
  Mic,
  Headphones,
  Layers,
} from "lucide-react";
import { Card, Badge, Button, EmptyState } from "@/components/ui";

export default function DailyHomeworkPage() {
  const params = useParams();
  const navigate = useNavigate();
  const classId = params.classId || params.id;

  const [data, setData] = useState<DailyHomeworkOverviewResponse | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);

  const fetchOverview = async (dayId?: string) => {
    if (!classId) return;
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
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [classId]);

  const handleSelectDay = (dayId: string) => {
    setSelectedDayId(dayId);
    fetchOverview(dayId);
  };

  const selectedDay = data?.currentSelectedDay;

  const handleCompleteCurrentDay = async () => {
    if (!selectedDay?.id) return;
    setIsMarkingComplete(true);
    try {
      await studentApi.markDailyPlanComplete(selectedDay.id);
      await fetchOverview(selectedDay.id);
    } catch (err: any) {
      alert(
        "Không thể cập nhật: " + (err.response?.data?.message || err.message),
      );
    } finally {
      setIsMarkingComplete(false);
    }
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

  // Tính chuỗi ngày học liên tiếp (Streak) từ danh sách ngày đã mở khóa
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

  // Tính tiến độ hoàn thành các đầu mục bài tập trong ngày đang chọn
  const allSelectedDayItems =
    selectedDay?.sections.flatMap((sec) => sec.items) ?? [];
  const totalDayTasks = allSelectedDayItems.length;
  const completedDayTasks = selectedDay?.isCompleted
    ? totalDayTasks
    : allSelectedDayItems.filter((item) => item.isDone).length;
  const dayCompletionPct =
    selectedDay?.isCompleted
      ? 100
      : totalDayTasks > 0
      ? Math.round((completedDayTasks / totalDayTasks) * 100)
      : 0;

  // =========================================================================
  // LOGIC GOM NHÓM (MERGE) CÁC SECTION (GIỮ NGUYÊN 100%)
  // Gom tất cả các phần "VOCABULARY", "WRITING", "SPEAKING"... vào chung 1 nhóm lớn
  // =========================================================================
  const getSectionIcon = (key: string) => {
    const upper = key.toUpperCase();
    if (upper.includes("VOCABULARY") || upper.includes("TỪ VỰNG"))
      return <BookOpen size={16} className="text-blue-700 dark:text-blue-400" />;
    if (upper.includes("WRITING") || upper.includes("VIẾT"))
      return <PenTool size={16} className="text-emerald-600 dark:text-emerald-400" />;
    if (upper.includes("SPEAKING") || upper.includes("NÓI"))
      return <Mic size={16} className="text-blue-700 dark:text-blue-400" />;
    if (upper.includes("LISTENING") || upper.includes("NGHE"))
      return <Headphones size={16} className="text-sky-600 dark:text-sky-400" />;
    if (upper.includes("READING") || upper.includes("ĐỌC"))
      return <BookText size={16} className="text-amber-600 dark:text-amber-400" />;
    return <Layers size={16} className="text-blue-700 dark:text-blue-400" />;
  };

  const getGroupedSections = () => {
    if (!selectedDay) return [];

    const groupMap = new Map<
      string,
      { mainTitle: string; subSections: typeof selectedDay.sections }
    >();

    selectedDay.sections.forEach((sec) => {
      const upperName = sec.sectionName.toUpperCase();
      let mainKey = sec.sectionName;

      if (
        upperName.includes("VOCABULARY") ||
        upperName.includes("VOCAL") ||
        upperName.includes("TỪ VỰNG")
      ) {
        mainKey = "Từ Vựng & Ngữ Âm (Vocabulary)";
      } else if (upperName.includes("WRITING") || upperName.includes("VIẾT")) {
        mainKey = "Kỹ Năng Viết (Writing)";
      } else if (upperName.includes("SPEAKING") || upperName.includes("NÓI")) {
        mainKey = "Kỹ Năng Nói & Phát Âm (Speaking)";
      } else if (
        upperName.includes("LISTENING") ||
        upperName.includes("NGHE")
      ) {
        mainKey = "Kỹ Năng Nghe (Listening)";
      } else if (upperName.includes("READING") || upperName.includes("ĐỌC")) {
        mainKey = "Kỹ Năng Đọc (Reading)";
      } else if (
        upperName.includes("GRAMMAR") ||
        upperName.includes("NGỮ PHÁP")
      ) {
        mainKey = "Ngữ Pháp (Grammar)";
      }

      if (!groupMap.has(mainKey)) {
        groupMap.set(mainKey, { mainTitle: mainKey, subSections: [] });
      }
      groupMap.get(mainKey)!.subSections.push(sec);
    });

    return Array.from(groupMap.values());
  };

  const groupedSections = getGroupedSections();

  return (
    <div className="max-w-[1350px] mx-auto space-y-6 pb-12">
      {/* ================= TOP HEADER NAVIGATION ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate("/student/courses")}
            aria-label="Quay lại danh sách khóa học"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:hover:bg-slate-800 shadow-2xs transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Lộ Trình Học Theo Ngày
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-600/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-400 border border-blue-200/70 dark:border-blue-600/30">
                <Sparkles size={11} /> Daily Roadmap
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Hệ thống tự động mở khóa bài học mới vào 00:00 mỗi ngày theo tiến
              độ lớp học
            </p>
          </div>
        </div>

        {/* Nút truy cập nhanh Kho Từ Vựng */}
        <div className="flex items-center gap-2.5 self-start md:self-center">
          <button
            type="button"
            onClick={() => navigate("/student/vocabulary")}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/80 dark:bg-blue-600/15 px-4 py-2.5 text-xs font-bold text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-600/25 transition cursor-pointer"
          >
            <Sparkles size={14} />
            <span>Luyện Từ Vựng Thông Minh</span>
          </button>
        </div>
      </div>

      {/* ================= 3 THẺ THỐNG KÊ TIẾN ĐỘ (PROGRESS & STREAK CARDS) ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Tổng tiến độ hoàn thành khóa học */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              <Trophy size={13} /> Tiến Độ Toàn Lộ Trình
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {percentage}%
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                ({completedDaysCount}/{totalDays} ngày)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
              />
            </div>
          </div>

          {/* Radial SVG Mini Gauge */}
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
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
              size={20}
              className="absolute text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>

        {/* Card 2: Chuỗi ngày học (Streak Card) */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Flame size={14} /> Chuỗi Ngày Học (Streak)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {streakCount}
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                ngày tích lũy
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đã mở khóa{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {unlockedDaysCount}/{totalDays}
              </strong>{" "}
              chặng bài học
            </p>
          </div>

          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-500 border border-amber-200/70 dark:border-amber-500/30 shadow-xs">
            <Flame size={28} className="fill-amber-500/20" />
          </div>
        </div>

        {/* Card 3: Thanh phần trăm hoàn thành bài học trong ngày đang chọn */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              <Target size={14} /> Tiến Độ Ngày Đang Chọn
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                dayCompletionPct === 100
                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300"
              }`}
            >
              {dayCompletionPct}% hoàn thành
            </span>
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {selectedDay ? selectedDay.title : "Chưa chọn ngày học"}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-2">
              {completedDayTasks}/{totalDayTasks} nhiệm vụ
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
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

      {/* ================= MAIN 2-COLUMN ROADMAP & TASKS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= CỘT TRÁI: LEARNING PATH TIMELINE ================= */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm">
            {/* Timeline Header */}
            <div className="bg-slate-50/90 dark:bg-[#162033] px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Lộ Trình Học Tập (Learning Path)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Chọn một chặng ngày học để xem và làm bài tập
                </p>
              </div>
              <span className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {days.length} chặng
              </span>
            </div>

            {/* Chú thích trạng thái */}
            <div className="px-6 py-2.5 bg-slate-50/40 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Đã hoàn thành
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-800 animate-pulse" />
                Đang mở khóa
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                Đang khóa
              </span>
            </div>

            {/* Timeline Vertical List */}
            <div className="p-5 max-h-[640px] overflow-y-auto custom-scrollbar">
              {days.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400">
                  Chưa có ngày học nào được giao cho lớp này
                </div>
              ) : (
                <div className="relative space-y-3">
                  {days.map((day, idx) => {
                    const isSelected =
                      selectedDay?.id === day.id || selectedDayId === day.id;
                    const isLocked = !day.isUnlocked;
                    const isCompleted = day.isCompleted;
                    const isLast = idx === days.length - 1;

                    return (
                      <div key={day.id} className="relative flex gap-3.5">
                        {/* Đường nối dọc của Timeline */}
                        {!isLast && (
                          <div
                            aria-hidden="true"
                            className={`absolute left-[19px] top-10 -bottom-3 w-0.5 ${
                              isCompleted
                                ? "bg-emerald-400 dark:bg-emerald-500/60"
                                : !isLocked
                                ? "bg-blue-300 dark:bg-blue-600/40"
                                : "bg-slate-200 dark:bg-slate-800"
                            }`}
                          />
                        )}

                        {/* Node Tròn Trạng Thái */}
                        <div className="relative z-10 shrink-0 mt-1">
                          {isLocked ? (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500">
                              <Lock size={15} />
                            </div>
                          ) : isCompleted ? (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/25">
                              <Check size={18} strokeWidth={2.5} />
                            </div>
                          ) : (
                            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white shadow-md shadow-indigo-500/30 ring-4 ring-blue-600/15">
                              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white dark:ring-[#111827] animate-pulse" />
                              <PlayCircle size={18} />
                            </div>
                          )}
                        </div>

                        {/* Thẻ Nội Dung Ngày Học */}
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
                          className={`flex-1 rounded-xl border p-3.5 transition-all duration-200 ${
                            isLocked
                              ? "opacity-55 cursor-not-allowed border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20"
                              : isSelected
                              ? "border-blue-600 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-600/15 shadow-sm ring-2 ring-blue-600/15 cursor-pointer"
                              : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#162033] hover:border-blue-300 dark:hover:border-blue-600/40 hover:bg-slate-50/70 dark:hover:bg-slate-800/60 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`text-xs font-extrabold ${
                                    isLocked
                                      ? "text-slate-500 dark:text-slate-400"
                                    : isCompleted
                                      ? "text-slate-900 dark:text-white"
                                      : "text-blue-800 dark:text-blue-300"
                                  }`}
                                >
                                  {day.title}
                                </span>
                                {day.isCurrentDay && !isLocked && (
                                  <span className="rounded-md bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                                    Hôm nay
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                                {day.dateLabel && (
                                  <span className="flex items-center gap-1">
                                    <Calendar size={11} />
                                    {day.dateLabel}
                                  </span>
                                )}
                                {day.estimatedMinutes && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={11} />
                                    {day.estimatedMinutes} phút
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status Pill */}
                            <div className="shrink-0">
                              {isLocked ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  Đang khóa
                                </span>
                              ) : isCompleted ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/70 dark:border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                  Hoàn thành
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-600/20 border border-blue-200/70 dark:border-blue-600/30 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                  Đang mở
                                </span>
                              )}
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

        {/* ================= CỘT PHẢI: CHI TIẾT BÀI TẬP THEO SECTION (MERGED) ================= */}
        <div className="lg:col-span-7 space-y-5">
          {!selectedDay ? (
            <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-xl p-16 text-center text-slate-400 shadow-sm">
              <Calendar
                size={44}
                className="mx-auto mb-3 opacity-40 text-blue-700 dark:text-blue-400"
              />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Hãy chọn một ngày học trên lộ trình bên trái để xem chi tiết
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Các bài tập từ vựng, nghe, nói, đọc, viết sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header Card của Day đang chọn */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-blue-50 dark:bg-blue-600/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 border border-blue-200/70 dark:border-blue-600/30">
                        Chặng {selectedDay.dayNumber || ""}
                      </span>
                      {selectedDay.estimatedMinutes && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <Clock size={13} /> ~{selectedDay.estimatedMinutes}{" "}
                          phút học
                        </span>
                      )}
                    </div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mt-2">
                      {selectedDay.fullHeaderLabel}
                    </h2>
                  </div>

                  {selectedDay.isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 px-3.5 py-2 rounded-xl self-start sm:self-center">
                      <CheckCircle2 size={15} /> Đã Hoàn Thành Ngày Học
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isMarkingComplete}
                      onClick={handleCompleteCurrentDay}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none self-start sm:self-center"
                    >
                      {isMarkingComplete ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Đang cập nhật...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Đánh dấu đã hoàn thành</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Thanh phần trăm hoàn thành bài học trong ngày */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Tiến độ hoàn thành bài học trong ngày
                    </span>
                    <span className="font-extrabold text-blue-700 dark:text-blue-400">
                      {dayCompletionPct}% ({completedDayTasks}/{totalDayTasks}{" "}
                      đầu mục)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
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

              {/* Danh sách các Section & Card bài tập đã được GOM NHÓM */}
              {groupedSections.length === 0 ? (
                <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs shadow-sm">
                  <AlertCircle
                    size={28}
                    className="mx-auto mb-2 opacity-40 text-slate-400"
                  />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    Chưa có bài tập được giao cho ngày này
                  </p>
                </div>
              ) : (
                groupedSections.map((group, gIdx) => {
                  const totalItems = group.subSections.reduce(
                    (acc, sub) => acc + sub.items.length,
                    0,
                  );

                  return (
                    <div
                      key={gIdx}
                      className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 sm:p-6 shadow-sm space-y-4 transition-all"
                    >
                      {/* Tiêu đề của Nhóm Lớn (VD: VOCABULARY) */}
                      <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-slate-900/60 border border-blue-100 dark:border-blue-900/60 shrink-0">
                            {getSectionIcon(group.mainTitle)}
                          </span>
                          <span>{group.mainTitle}</span>
                        </h3>
                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-600/15 border border-blue-200/60 dark:border-blue-600/30 px-2.5 py-1 rounded-xl shrink-0">
                          {totalItems} nhiệm vụ
                        </span>
                      </div>

                      {/* Render các Menu Con bên trong Nhóm */}
                      <div className="space-y-4">
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
                            <div key={sIdx} className="space-y-2.5">
                              {/* Chỉ hiển thị Header Menu Con nếu nhóm này có nhiều hơn 1 mục */}
                              {isMerged && (
                                <div className="flex items-center justify-between bg-slate-50/90 dark:bg-[#162033] border border-slate-200/60 dark:border-slate-800 px-3.5 py-2.5 rounded-xl">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <ChevronDown
                                      size={15}
                                      className="text-blue-600"
                                    />
                                    {subTitleClean}
                                  </span>
                                  {isRequired && (
                                    <span className="rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/70 dark:border-emerald-500/30 px-2 py-0.5 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold">
                                      Bắt buộc
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Danh sách bài tập của Menu Con */}
                              <div
                                className={`space-y-2.5 ${
                                  isMerged
                                    ? "pl-4 border-l-2 border-blue-100 dark:border-slate-800 ml-2"
                                    : ""
                                }`}
                              >
                                {sub.items.map((item, idx) => {
                                  const isFirst = idx === 0;
                                  const isItemDone =
                                    item.isDone || selectedDay.isCompleted;

                                  return (
                                    <div
                                      key={item.id}
                                      onClick={() => {
                                        if (item.assignmentId) {
                                          navigate(
                                            `/student/assignments/${item.assignmentId}/take`,
                                          );
                                        }
                                      }}
                                      className={`group rounded-xl border p-4 flex items-center justify-between gap-3 cursor-pointer transition-all duration-200 shadow-2xs ${
                                        isItemDone
                                          ? "border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10 hover:border-emerald-400"
                                          : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0d1322] hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/30 dark:hover:bg-slate-800/60"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3.5 min-w-0">
                                        <div
                                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                            isItemDone
                                              ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                              : isFirst
                                              ? "bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400"
                                              : "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                          }`}
                                        >
                                          {isItemDone ? (
                                            <CheckCircle2 size={18} />
                                          ) : (
                                            <PlayCircle size={18} />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <span className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition truncate">
                                            {item.title}
                                          </span>
                                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                            {isItemDone
                                              ? "Đã hoàn thành nhiệm vụ"
                                              : "Nhấn để bắt đầu làm bài"}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        {item.assignmentId && (
                                          <span className="text-xs text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5 bg-blue-50 dark:bg-blue-600/15 group-hover:bg-blue-800 group-hover:text-white px-3 py-1.5 rounded-xl border border-blue-200/70 dark:border-blue-600/30 transition-all">
                                            <span>
                                              {isItemDone
                                                ? "Làm lại"
                                                : "Làm bài"}
                                            </span>
                                            <ExternalLink size={13} />
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
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
