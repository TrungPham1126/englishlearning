import React from "react";
import { ArrowLeft, School, BookOpen, Settings2, UserPlus, Video } from "lucide-react";
import type { ClassroomResponse } from "@/features/admin/types";

interface ClassroomOverviewHeaderProps {
  classroom: ClassroomResponse;
  activeTab: "settings" | "students" | "videos" | "lessons";
  setActiveTab: (tab: "settings" | "students" | "videos" | "lessons") => void;
  pendingVideosCount: number;
  onBack: () => void;
}

export const ClassroomOverviewHeader: React.FC<ClassroomOverviewHeaderProps> = ({
  classroom,
  activeTab,
  setActiveTab,
  pendingVideosCount,
  onBack,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400 text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Quay lại danh sách
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {classroom.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-slate-900/50 text-blue-800 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900 uppercase">
              Level: {classroom.level}
            </span>
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm">
              Sức chứa: {classroom.currentStudentsCount} / {classroom.maxStudents || "∞"}
            </span>
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm">
              GV: {classroom.teacherName || "Chưa phân công"}
            </span>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 px-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("lessons")}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition cursor-pointer border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "lessons"
              ? "border-blue-700 text-blue-800 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <BookOpen size={16} /> Giáo Trình &amp; Bài Giảng
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition cursor-pointer border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "settings"
              ? "border-blue-700 text-blue-800 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Settings2 size={16} /> Cấu hình chung
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition cursor-pointer border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "students"
              ? "border-blue-700 text-blue-800 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <UserPlus size={16} /> Ghi danh Học viên
        </button>
        <button
          onClick={() => setActiveTab("videos")}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition cursor-pointer border-b-2 flex items-center gap-2 whitespace-nowrap relative ${
            activeTab === "videos"
              ? "border-rose-600 text-rose-700 dark:text-rose-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Video size={16} /> Kiểm duyệt Video
          {pendingVideosCount > 0 && (
            <span className="absolute -top-3 -right-4 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
              {pendingVideosCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default ClassroomOverviewHeader;
