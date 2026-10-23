// src/features/student/pages/DailyHomeworkPage.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
import type { DailyHomeworkOverviewResponse } from "@/features/student/types";
import {
  Folder,
  PlayCircle,
  ChevronDown,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Lock,
  ExternalLink,
  BookText,
} from "lucide-react";

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
      <div className="p-12 text-center text-rose-600 font-bold bg-white rounded-xl border border-rose-200">
        Không tìm thấy ID lớp học trong đường dẫn URL.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 font-medium gap-3">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <span>Đang tải bảng ngày...</span>
      </div>
    );
  }

  const percentage = data?.completionPercentage ?? 0;
  const days = data?.days ?? [];
  const selectedDay = data?.currentSelectedDay;

  // =========================================================================
  // LOGIC GOM NHÓM (MERGE) CÁC SECTION
  // Gom tất cả các phần "VOCABULARY", "WRITING", "SPEAKING"... vào chung 1 nhóm lớn
  // =========================================================================
  const getGroupedSections = () => {
    if (!selectedDay) return [];

    // Sử dụng Map để gộp các section có chung từ khóa
    const groupMap = new Map<
      string,
      { mainTitle: string; subSections: typeof selectedDay.sections }
    >();

    selectedDay.sections.forEach((sec) => {
      const upperName = sec.sectionName.toUpperCase();
      let mainKey = sec.sectionName; // Mặc định giữ nguyên tên ban đầu

      // Phân loại và gộp nhóm
      if (upperName.includes("VOCABULARY") || upperName.includes("VOCAL") || upperName.includes("TỪ VỰNG")) {
        mainKey = "📚 TỪ VỰNG & NGỮ ÂM (VOCABULARY)";
      } else if (upperName.includes("WRITING") || upperName.includes("VIẾT")) {
        mainKey = "✍️ KỸ NĂNG VIẾT (WRITING)";
      } else if (upperName.includes("SPEAKING") || upperName.includes("NÓI")) {
        mainKey = "🎙️ KỸ NĂNG NÓI (SPEAKING)";
      } else if (upperName.includes("LISTENING") || upperName.includes("NGHE")) {
        mainKey = "🎧 KỸ NĂNG NGHE (LISTENING)";
      } else if (upperName.includes("READING") || upperName.includes("ĐỌC")) {
        mainKey = "📖 KỸ NĂNG ĐỌC (READING)";
      } else if (upperName.includes("GRAMMAR") || upperName.includes("NGỮ PHÁP")) {
        mainKey = "🧩 NGỮ PHÁP (GRAMMAR)";
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
      {/* Top Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/student/courses")}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Bảng Ngày Học (Daily Plan)
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Hệ thống tự động mở khóa lộ trình vào 00:00 mỗi ngày
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= CỘT TRÁI: GAUGE TIẾN ĐỘ & DANH SÁCH CÁC NGÀY ================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* Box 1: Vòng Tròn Hoàn Thành */}
          <div className="bg-white dark:bg-[#121a2d] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col items-center justify-center text-center">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight mb-5">
              Tỉ lệ hoàn thành bài tập
            </h2>
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg
                className="w-full h-full transform -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="text-slate-100 dark:text-slate-800"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="text-[#2eb85c] transition-all duration-700 ease-out"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - percentage / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                  {percentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Box 2: BẢNG NGÀY List */}
          <div className="bg-white dark:bg-[#121a2d] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="bg-[#f0f3f8] dark:bg-slate-800/60 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                BÀI TẬP HÀNG NGÀY
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-[550px] overflow-y-auto">
              {days.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Chưa có ngày học nào được giao cho lớp này
                </div>
              ) : (
                days.map((day) => {
                  const isSelected = selectedDay?.id === day.id;
                  const isLocked = !day.isUnlocked;

                  return (
                    <div
                      key={day.id}
                      onClick={() => !isLocked && handleSelectDay(day.id)}
                      className={`px-5 py-3.5 flex items-center justify-between transition ${
                        isLocked
                          ? "opacity-50 cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/30"
                          : isSelected
                            ? "bg-slate-100/90 dark:bg-slate-800/70 font-bold cursor-pointer"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3 text-xs truncate">
                        <Folder
                          size={18}
                          className={`shrink-0 ${
                            !day.isCompleted
                              ? "text-[#d32f2f] fill-[#d32f2f]"
                              : "text-[#2855af] fill-[#2855af]"
                          }`}
                        />
                        <span
                          className={`font-black ${
                            !day.isCompleted
                              ? "text-[#d32f2f] dark:text-rose-400"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {day.title}
                        </span>
                        {day.estimatedMinutes && (
                          <span className="text-slate-500 dark:text-slate-400 font-normal">
                            ({day.estimatedMinutes} min)
                          </span>
                        )}
                        <span className="text-slate-500 dark:text-slate-400 italic text-[11px] truncate">
                          {day.dateLabel}
                        </span>
                      </div>
                      <div className="shrink-0 ml-3 flex items-center">
                        {isLocked ? (
                          <Lock size={14} className="text-slate-400" />
                        ) : day.isCompleted ? (
                          <span className="h-3.5 w-3.5 rounded-full bg-[#2eb85c] inline-block shadow-2xs" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full bg-[#f03d3d] inline-block shadow-2xs animate-pulse" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ================= CỘT PHẢI: CHI TIẾT BÀI TẬP THEO SECTION (MERGED) ================= */}
        <div className="lg:col-span-7 space-y-4">
          {!selectedDay ? (
            <div className="bg-white dark:bg-[#121a2d] border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center text-slate-400 shadow-xs">
              <Calendar
                size={40}
                className="mx-auto mb-3 opacity-40 text-indigo-600 dark:text-indigo-400"
              />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Hãy chọn một ngày bên danh sách để xem chi tiết
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header của Day đang chọn */}
              <div className="bg-[#f0f3f8] dark:bg-[#121a2d] border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3.5 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  {selectedDay.fullHeaderLabel}
                </h2>
                {selectedDay.isCompleted ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 size={13} /> Đã Hoàn Thành
                  </span>
                ) : (
                  <button
                    disabled={isMarkingComplete}
                    onClick={handleCompleteCurrentDay}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isMarkingComplete ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    Đánh dấu đã học
                  </button>
                )}
              </div>

              {/* Danh sách các Section & Card bài tập đã được GOM NHÓM */}
              {groupedSections.length === 0 ? (
                <div className="bg-white dark:bg-[#121a2d] border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs shadow-xs">
                  Chưa có bài tập được giao cho ngày này
                </div>
              ) : (
                groupedSections.map((group, gIdx) => {
                  // Đếm tổng số bài tập trong nhóm này
                  const totalItems = group.subSections.reduce(
                    (acc, sub) => acc + sub.items.length,
                    0,
                  );

                  return (
                    <div
                      key={gIdx}
                      className="bg-white dark:bg-[#121a2d] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4"
                    >
                      {/* Tiêu đề của Nhóm Lớn (VD: VOCABULARY) */}
                      <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
                          <BookText size={18} className="text-indigo-600 dark:text-indigo-400" />
                          {group.mainTitle}
                        </h3>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                          {totalItems} đầu mục
                        </span>
                      </div>

                      {/* Render các Menu Con bên trong Nhóm */}
                      <div className="space-y-4">
                        {group.subSections.map((sub, sIdx) => {
                          const isMerged = group.subSections.length > 1;

                          // Hiển thị tên Menu Con rõ ràng, chuyên nghiệp
                          let subTitleClean = sub.sectionName;
                          if (subTitleClean.includes(":")) {
                            subTitleClean = subTitleClean.substring(subTitleClean.indexOf(":") + 1).trim();
                          } else if (subTitleClean.includes(" - ")) {
                            subTitleClean = subTitleClean.substring(subTitleClean.indexOf(" - ") + 3).trim();
                          }
                          const isRequired =
                            sub.sectionName.includes("Bắt buộc");

                          return (
                            <div key={sIdx} className="space-y-2.5">
                              {/* Chỉ hiển thị Header Menu Con nếu nhóm này có nhiều hơn 1 mục */}
                              {isMerged && (
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-lg">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <ChevronDown
                                      size={15}
                                      className="text-slate-400"
                                    />
                                    {subTitleClean}
                                  </span>
                                  {isRequired && (
                                    <span className="text-[#2eb85c] text-[10px] font-bold">
                                      (Bắt buộc)
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Danh sách bài tập của Menu Con */}
                              <div
                                className={`space-y-2.5 ${
                                  isMerged
                                    ? "pl-4 border-l-2 border-slate-100 dark:border-slate-800 ml-2"
                                    : ""
                                }`}
                              >
                                {sub.items.map((item, idx) => {
                                  const isFirst = idx === 0;
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
                                      className="group border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-lg p-3.5 flex items-center justify-between cursor-pointer transition bg-white dark:bg-[#0d1322] hover:bg-slate-50/70 dark:hover:bg-slate-800/60 shadow-2xs"
                                    >
                                      <div className="flex items-center gap-3">
                                        <PlayCircle
                                          size={20}
                                          className={`shrink-0 ${
                                            isFirst
                                              ? "text-[#0088cc]"
                                              : "text-[#e84e40]"
                                          }`}
                                        />
                                        <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                                          {item.title}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {item.assignmentId && (
                                          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/15 px-2 py-1 rounded">
                                            Làm bài <ExternalLink size={12} />
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
